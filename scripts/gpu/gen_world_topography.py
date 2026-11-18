#!/usr/bin/env python3
"""
Procedural world & capital topography generator for KI Legends (2D Isometric + Terrain3D).
Uses Godot 4.6.3 FastNoiseLite fields + NumPy + SciPy + Pillow + OpenCV.
"""
import hashlib
import json
import math
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path("/workspace/ki-world-iso-20261118")
NOISE_DIR = ROOT / "noise"
SOURCE_DATA = Path("/workspace/ki-legends-prototype-output/ash-fortress-20261118/source-data")
GAME_ASSETS = Path("/workspace/iso-proto/cap/game/assets/lands")
OUT_ATLAS = ROOT / "atlas"
OUT_REGIONS = ROOT / "regions"
OUT_ATLAS.mkdir(parents=True, exist_ok=True)
OUT_REGIONS.mkdir(parents=True, exist_ok=True)


def load_fastnoise(name: str, target_shape=None):
    raw = np.fromfile(NOISE_DIR / f"{name}.f32", dtype="<f4").reshape((512, 512, 3))
    if target_shape and target_shape != (512, 512):
        th, tw = target_shape
        out = np.zeros((th, tw, 3), dtype=np.float32)
        for c in range(3):
            out[:, :, c] = cv2.resize(raw[:, :, c], (tw, th), interpolation=cv2.INTER_CUBIC)
        return out
    return raw


def seg_dist(xx, zz, p0, p1):
    ax, az = p0
    bx, bz = p1
    dx, dz = bx - ax, bz - az
    l2 = dx * dx + dz * dz + 1e-9
    t = np.clip(((xx - ax) * dx + (zz - az) * dz) / l2, 0.0, 1.0)
    return np.hypot(xx - (ax + t * dx), zz - (az + t * dz))


def polyline_dist(xx, zz, paths):
    d = np.full_like(xx, 1e6, dtype=np.float32)
    for path in paths:
        for a, b in zip(path, path[1:]):
            d = np.minimum(d, seg_dist(xx, zz, a, b))
    return d


def make_albedo_normal(webp_path: Path, size: int = 512, tint=(1.0, 1.0, 1.0)):
    im = Image.open(webp_path).convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
    rgb = np.asarray(im, dtype=np.float32)
    rgb[:, :, 0] = np.clip(rgb[:, :, 0] * tint[0], 0, 255)
    rgb[:, :, 1] = np.clip(rgb[:, :, 1] * tint[1], 0, 255)
    rgb[:, :, 2] = np.clip(rgb[:, :, 2] * tint[2], 0, 255)
    rgb_u8 = rgb.astype(np.uint8)
    # Use OpenCV bilateral filter + unsharp mask for clean anime/JRPG surface readability
    bgr = cv2.cvtColor(rgb_u8, cv2.COLOR_RGB2BGR)
    smooth = cv2.bilateralFilter(bgr, d=5, sigmaColor=24, sigmaSpace=24)
    sharp = cv2.addWeighted(rgb_u8, 1.25, cv2.cvtColor(smooth, cv2.COLOR_BGR2RGB), -0.25, 0)
    gray = cv2.cvtColor(sharp, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    h_alpha = np.clip(gray * 255.0, 8.0, 248.0).astype(np.uint8)
    albedo_rgba = np.dstack([sharp, h_alpha])

    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3) * 1.6
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3) * 1.6
    gz = np.ones_like(gray)
    norm = np.sqrt(gx * gx + gy * gy + gz * gz)
    nx = np.clip(((-gx / norm) * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    ny = np.clip(((-gy / norm) * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    nz = np.clip(((gz / norm) * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    rough = np.clip((0.78 - 0.25 * gray) * 255.0, 40, 235).astype(np.uint8)
    normal_rgba = np.dstack([nx, ny, nz, rough])
    return Image.fromarray(albedo_rgba, "RGBA"), Image.fromarray(normal_rgba, "RGBA")


def pack_terrain3d_control(base_id: np.ndarray, over_id: np.ndarray, blend: np.ndarray) -> np.ndarray:
    b = (base_id.astype(np.uint32) & 0x1F) << 27
    o = (over_id.astype(np.uint32) & 0x1F) << 22
    w = (np.clip(np.round(blend * 255.0), 0, 255).astype(np.uint32) & 0xFF) << 14
    return (b | o | w).view(np.float32)


def generate_capital_region(land_id: str):
    out = OUT_REGIONS / land_id
    out.mkdir(parents=True, exist_ok=True)
    n = 512
    spacing = 2.0
    z_idx, x_idx = np.mgrid[:n, :n].astype(np.float32)
    xx = (x_idx - n / 2.0) * spacing  # [-512, 510]
    zz = (z_idx - n / 2.0) * spacing

    fn = load_fastnoise(land_id, (n, n))
    fbm, ridged, cell = fn[:, :, 0], fn[:, :, 1], fn[:, :, 2]

    land_meta = json.loads((SOURCE_DATA / "lands" / land_id / "land.json").read_text())
    cap_info = [s for s in land_meta["settlements"] if s["kind"] == "capital"][0]

    if land_id == "pyra":
        title = "Pyra · Twierdza Popiołu"
        # 3-level volcanic cliff fortress matching 04_PYRA_Twierdza_Popiolu.jpg
        h = 16.0 + fbm * 5.0 + ridged * 3.5
        # NW Upper Citadel plateau ("Wysoka Cytadela" & "Plac Korony")
        citadel_d = np.maximum(np.abs(xx + 145.0) / 145.0, np.abs(zz + 150.0) / 115.0)
        citadel_mask = np.clip((1.18 - citadel_d) / 0.22, 0.0, 1.0)
        h = h * (1.0 - citadel_mask) + (38.0 + fbm * 0.7) * citadel_mask

        # SW Gate & Market terrace ("Targ przy Bramie")
        market_d = np.hypot((xx + 185.0) / 145.0, (zz - 140.0) / 115.0)
        market_mask = np.clip((1.15 - market_d) / 0.25, 0.0, 1.0)
        h = h * (1.0 - market_mask) + (14.0 + fbm * 0.4) * market_mask

        # SE Lower Forges basin ("Dolne Kuźnie" & "Plac Węglowy")
        forge_d = np.hypot((xx - 120.0) / 145.0, (zz - 125.0) / 115.0)
        forge_mask = np.clip((1.15 - forge_d) / 0.25, 0.0, 1.0)
        h = h * (1.0 - forge_mask) + (7.5 + fbm * 0.4) * forge_mask

        # Glowing Lava River ("Rzeka Lawy") on SE edge + NE volcano waterfall source
        lava_axis = 290.0 - 0.42 * zz + 24.0 * np.sin(zz / 75.0)
        lava_dist = np.abs(xx - lava_axis)
        lava_trench = np.exp(-((lava_dist / 30.0) ** 4))
        h = h * (1.0 - lava_trench) + (-4.5 + fbm * 0.5) * lava_trench

        # Outer volcanic mountains (NE and W ridges)
        rim = np.clip((np.hypot(xx, zz) - 370.0) / 130.0, 0.0, 1.0)
        ne_volcano = np.exp(-((np.hypot(xx - 290.0, zz + 295.0) / 150.0) ** 2))
        h += rim * (34.0 + 18.0 * ridged) * (1.0 - lava_trench) + ne_volcano * 52.0

        paths = [
            [[-370, 320], [-265, 220], [-185, 140]],  # Droga do Doliny -> Brama Główna -> Targ
            [[-185, 140], [-40, 20], [135, -120], [250, -220]],  # Schody do Popiołu -> Droga do Cytadeli
            [[-185, 140], [-165, 10], [-145, -135]],  # Schody zachodnie -> Wysoka Cytadela / Plac Korony
            [[-40, 20], [-95, -60], [-145, -135]],    # Schody wschodnie -> Plac Korony
            [[-40, 20], [45, 85], [120, 130]],        # Zejście do Dolnych Kuźni i Placu Węglowego
            [[120, 130], [185, 165]],                 # Dojście do mostku nad Rzeką Lawy
        ]
        spawn = [-185, 140]
        landmarks = [
            {"id": "market", "name": "Targ przy Bramie", "xz": [-185, 140]},
            {"id": "crown-plaza", "name": "Wysoka Cytadela · Plac Korony", "xz": [-145, -135]},
            {"id": "coal-plaza", "name": "Dolne Kuźnie · Plac Węglowy", "xz": [120, 130]},
            {"id": "citadel-road", "name": "Droga do Cytadeli", "xz": [135, -120]},
        ]
        tex_list = ["b0", "b3", "b2", "over2", "b1", "road2", "road1", "shore"]
        water_kind = "lava"
        water_level = -1.5

    elif land_id == "verdant":
        title = "Verdantia · Zielona Przystań"
        # River valley split by Rzeka Przełomu matching 03_VERDANTIA_Zielona_Przystan.jpg
        h = 14.0 + fbm * 4.5 + ridged * 2.5
        river_x = 18.0 * np.sin(zz / 110.0) - 0.14 * zz
        river_w = 54.0 + 8.0 * np.sin(zz / 70.0)
        river_d = np.abs(xx - river_x)

        # West bank: Dzielnica Rzemieślnicza & Targ (h=11m), sloping to Przystań i Nabrzeże (h=3.5m)
        west_plaza = np.clip((1.15 - np.hypot((xx + 175.0) / 145.0, (zz - 15.0) / 165.0)) / 0.25, 0.0, 1.0)
        h = h * (1.0 - west_plaza) + (11.0 + fbm * 0.4) * west_plaza

        # East bank: terraced Domy Ogrodowe & Sady (h=14..22m)
        east_terrace = np.clip((1.15 - np.hypot((xx - 185.0) / 155.0, (zz - 10.0) / 170.0)) / 0.25, 0.0, 1.0)
        h = h * (1.0 - east_terrace) + (15.5 + 4.0 * np.clip((xx - 120.0) / 180.0, 0.0, 1.0) + fbm * 0.5) * east_terrace

        # Northern gorge cliffs & forested hills
        north_gorge = np.exp(-(((zz + 330.0) / 110.0) ** 2)) * np.clip((river_d - river_w) / 55.0, 0.0, 1.0)
        h += north_gorge * (32.0 + 10.0 * ridged)

        # Carve Rzeka Przełomu channel, except raise a bridge causeway at z in [-28, 28]
        bridge_span = (np.abs(zz) < 24.0) & (river_d < river_w + 18.0)
        channel = np.clip((river_w - river_d) / 18.0, 0.0, 1.0)
        h = h * (1.0 - channel) + (-4.0) * channel
        # Bridge deck ("Most Główny") keeps walkable elevation across the river
        bridge_mask = np.clip((22.0 - np.abs(zz)) / 8.0, 0.0, 1.0) * np.clip((river_w + 20.0 - river_d) / 12.0, 0.0, 1.0)
        h = h * (1.0 - bridge_mask) + 12.5 * bridge_mask

        paths = [
            [[-340, 260], [-210, 110], [-145, 0], [-200, -170], [-310, -290]],  # Droga do Doliny & Targ
            [[-145, 0], [-75, 0], [0, 0], [85, 0], [175, 0]],                  # Most Główny
            [[-145, 0], [-85, 95]],                                             # Zejście na Przystań i Nabrzeże
            [[175, 0], [185, -115], [275, -135]],                               # Domy Ogrodowe i Sady (północ)
            [[175, 0], [195, 125], [295, 220]],                                 # Domy Ogrodowe (południe)
        ]
        spawn = [-145, 0]
        landmarks = [
            {"id": "market", "name": "Targ i Dzielnica Rzemieślnicza", "xz": [-145, 0]},
            {"id": "main-bridge", "name": "Most Główny nad Rzeką Przełomu", "xz": [0, 0]},
            {"id": "harbor", "name": "Przystań i Nabrzeże", "xz": [-85, 95]},
            {"id": "gardens", "name": "Domy Ogrodowe i Sady", "xz": [185, -115]},
        ]
        tex_list = ["b0", "b1", "b2", "b3", "b2", "road0", "road1", "shore"]
        water_kind = "river"
        water_level = -0.8

    elif land_id == "aether":
        title = "Aetheria · Sanktuarium Tysiąca Źródeł"
        # 3-tier cascading mountain sanctuary matching 01_AETHERIA_Sanktuarium_Tysiaca_Zrodel.jpg
        h = 18.0 + fbm * 5.0 + ridged * 4.5
        # Tier 1 (SW): Dolne Miasto Gościnne (h=10m)
        t1 = np.clip((1.15 - np.hypot((xx + 175.0) / 145.0, (zz - 175.0) / 130.0)) / 0.22, 0.0, 1.0)
        h = h * (1.0 - t1) + (10.0 + fbm * 0.3) * t1

        # Tier 2 (Center): Tarasy Nauki (h=24m)
        t2 = np.clip((1.15 - np.maximum(np.abs(xx - 10.0) / 170.0, np.abs(zz - 15.0) / 105.0)) / 0.20, 0.0, 1.0)
        h = h * (1.0 - t2) + (24.0 + fbm * 0.3) * t2

        # Tier 3 (NE): Górne Sanktuarium & Źródlany Dziedziniec (h=38m)
        t3 = np.clip((1.15 - np.hypot((xx - 140.0) / 160.0, (zz + 165.0) / 120.0)) / 0.20, 0.0, 1.0)
        h = h * (1.0 - t3) + (38.0 + fbm * 0.3) * t3

        # Surrounding high snowy alpine peaks (NW and NE perimeter)
        alpine = np.clip((np.hypot(xx, zz) - 340.0) / 140.0, 0.0, 1.0) * (1.0 - 0.7 * t1)
        h += alpine * (42.0 + 22.0 * ridged)

        paths = [
            [[-285, 275], [-175, 175], [-95, 115]],     # Dolne Miasto Gościnne
            [[-95, 115], [-20, 45], [35, 15]],          # Schody -> Tarasy Nauki
            [[35, 15], [-85, -35]],                     # Zachodnie skrzydło Tarasów Nauki
            [[35, 15], [75, -75], [135, -155]],         # Wielkie Schody -> Górne Sanktuarium
            [[135, -155], [60, -185]],                  # Mostek do zachodniej pagody
            [[135, -155], [215, -175]],                 # Mostek do wschodniej pagody
        ]
        spawn = [-175, 175]
        landmarks = [
            {"id": "lower-town", "name": "Dolne Miasto Gościnne", "xz": [-175, 175]},
            {"id": "science-terrace", "name": "Tarasy Nauki", "xz": [35, 15]},
            {"id": "upper-sanctuary", "name": "Górne Sanktuarium · Źródlany Dziedziniec", "xz": [135, -155]},
            {"id": "west-pagoda", "name": "Zachodnia Pagoda Źródeł", "xz": [60, -185]},
        ]
        tex_list = ["b0", "b1", "b2", "b3", "road0", "road2", "road1", "shore"]
        water_kind = "springs"
        water_level = -1.0

    else:  # nexus
        title = "Nexus-9 · Węzeł Świadomości"
        # High plateau reactor core + lower docks matching 02_NEXUS_9_Wezel_Swiadomosci.jpg
        h = 15.0 + fbm * 4.0 + cell * 3.0
        # Upper NE plateau ("Górny Taras Administracyjny" & "Rdzeń Energetyczny", h=36m)
        upper = np.clip((1.15 - np.maximum(np.abs(xx - 135.0) / 165.0, np.abs(zz + 145.0) / 135.0)) / 0.18, 0.0, 1.0)
        h = h * (1.0 - upper) + (36.0 + fbm * 0.2) * upper

        # NW Secondary Tech Terrace (h=26m)
        nw_pad = np.clip((1.15 - np.maximum(np.abs(xx + 195.0) / 110.0, np.abs(zz + 155.0) / 95.0)) / 0.20, 0.0, 1.0)
        h = h * (1.0 - nw_pad) + 26.0 * nw_pad

        # Lower SW Workshops, Docks & Cargo Yards ("Dolne Warsztaty i Doki", h=7m)
        docks = np.clip((1.18 - np.hypot((xx + 95.0) / 210.0, (zz - 145.0) / 145.0)) / 0.22, 0.0, 1.0)
        h = h * (1.0 - docks) + 7.0 * docks

        # SW Harbor water basin (z > 235 and x < 60)
        harbor = np.clip(((zz - 220.0) - 0.45 * xx) / 38.0, 0.0, 1.0)
        h = h * (1.0 - harbor) + (-4.5) * harbor

        paths = [
            [[-185, 105], [-75, 165], [65, 225]],       # Dolne Warsztaty, Doki i Place Przeładunkowe
            [[-75, 165], [10, 45], [85, -55], [135, -145]],  # Trakty Łączące -> Rdzeń Energetyczny
            [[-75, 165], [-145, 10], [-195, -145]],     # Zachodni Trakt Łączący -> Taras Techniczny
            [[135, -145], [235, -145]],                 # Dojście do Hali Transportowej
        ]
        spawn = [-75, 165]
        landmarks = [
            {"id": "docks", "name": "Dolne Warsztaty i Doki", "xz": [-75, 165]},
            {"id": "core", "name": "Górny Taras · Rdzeń Energetyczny", "xz": [135, -145]},
            {"id": "transport-hall", "name": "Hala Transportowa", "xz": [235, -145]},
            {"id": "cargo-yard", "name": "Place Przeładunkowe", "xz": [65, 225]},
        ]
        tex_list = ["b0", "b1", "b2", "b3", "road2", "road0", "road1", "shore"]
        water_kind = "harbor"
        water_level = -1.0

    # Smooth road corridors so all stairs/ramps/bridges between terraces are smoothly walkable
    road_dist = polyline_dist(xx, zz, paths)
    route_h = ndimage.gaussian_filter(h, sigma=9.0)
    road_blend = np.clip((16.0 - road_dist) / 8.0, 0.0, 1.0)
    h = h * (1.0 - road_blend) + route_h * road_blend
    h = ndimage.gaussian_filter(h, sigma=0.65).astype("<f4")

    dz, dx = np.gradient(h, spacing)
    slope = np.rad2deg(np.arctan(np.hypot(dx, dz)))

    # Texture IDs: 0=base ground, 1=cliff/rock, 2=paving/road, 3=high terrace/special
    tex_id = np.where(slope > 24.0, 1, 0).astype(np.uint32)
    tex_id[road_dist < 8.5] = 2
    for lm in landmarks:
        lx, lz = lm["xz"]
        tex_id[np.hypot(xx - lx, zz - lz) < 34.0] = 2
    tex_id[(h > 30.0) & (tex_id == 0)] = 3

    weights = np.stack([ndimage.gaussian_filter((tex_id == i).astype(np.float32), 1.1) for i in range(4)], axis=-1)
    weights /= np.maximum(weights.sum(axis=-1, keepdims=True), 1e-6)
    Image.fromarray(np.clip(weights * 255.0, 0, 255).astype(np.uint8), "RGBA").save(out / "weights.png")

    hazard = (h < water_level) & (road_dist >= 8.5)
    surface = np.zeros((n, n, 3), dtype=np.uint8)
    surface[:, :, 0] = (hazard & (land_id == "pyra")).astype(np.uint8) * 255
    surface[:, :, 2] = (hazard & (land_id != "pyra")).astype(np.uint8) * 255
    Image.fromarray(surface, "RGB").save(out / "surface.png")

    # Terrain3D 8-layer control map with smooth slope & road transitions
    base_layer = np.where(slope > 25.0, 2, np.where(h > 28.0, 1, 0)).astype(np.uint32)
    over_layer = np.where(road_dist < 10.0, 5, np.where(hazard, 7, 3)).astype(np.uint32)
    blend_val = np.where(road_dist < 10.0, np.clip((10.0 - road_dist) / 4.5, 0.0, 1.0), np.clip(slope / 42.0, 0.0, 0.85))
    ctrl_f32 = pack_terrain3d_control(base_layer, over_layer, blend_val)
    ctrl_r32 = (tex_id << 27).astype("<u4")

    h.tofile(out / "height.r32")
    h.tofile(out / "height.f32")
    ctrl_r32.tofile(out / "control.r32")
    ctrl_f32.tofile(out / "control.f32")

    walkable = ((slope < 37.0) | (road_dist < 10.5)) & (~hazard)
    walkable.astype(np.uint8).tofile(out / "walkable.u8")
    comps, _ = ndimage.label(walkable)

    def at_pt(pt):
        return (
            int(np.clip(pt[1] / spacing + n / 2, 0, n - 1)),
            int(np.clip(pt[0] / spacing + n / 2, 0, n - 1)),
        )

    origin_comp = int(comps[at_pt(spawn)])
    for lm in landmarks:
        rz, rx = at_pt(lm["xz"])
        lm["height"] = round(float(h[rz, rx]), 2)
        lm["reachable"] = bool(origin_comp > 0 and int(comps[rz, rx]) == origin_comp)
        assert lm["reachable"], f"{land_id}: landmark {lm['id']} not reachable!"

    # Prepare 8 PBR texture pairs (albedo + normal) using Pillow + OpenCV
    t_dir = GAME_ASSETS / land_id / "terrain"
    for i, tname in enumerate(tex_list):
        src_webp = t_dir / f"{tname}.webp"
        if not src_webp.exists():
            src_webp = t_dir / "b0.webp"
        alb, nrm = make_albedo_normal(src_webp, 512)
        alb.save(out / f"tex_{i}_albedo.png")
        nrm.save(out / f"tex_{i}_normal.png")
        if i < 4:
            alb.convert("RGB").save(out / f"mat_{i}.webp", "WEBP", quality=92)

    water_src = t_dir / "water.webp"
    if water_src.exists():
        Image.open(water_src).convert("RGBA").resize((512, 512), Image.Resampling.LANCZOS).save(out / "water.png")

    cfg = {
        "id": land_id,
        "title": title,
        "capital_name": cap_info["name"],
        "canonical_land_size": [land_meta["width"], land_meta["height"]],
        "canonical_capital_bounds": cap_info["bounds"],
        "seed": 20261118,
        "samples": n,
        "nx": n,
        "ny": n,
        "step": spacing,
        "spacing_m": spacing,
        "size_m": n * spacing,
        "x0": -512.0,
        "y0": -512.0,
        "cx": 0.0,
        "cz": 0.0,
        "ortho": 760.0,
        "uv": 0.035,
        "water_kind": water_kind,
        "water_level": water_level,
        "height_range": [round(float(h.min()), 2), round(float(h.max()), 2)],
        "walkable_percent": round(float(walkable.mean() * 100.0), 2),
        "spawn": spawn,
        "landmarks": landmarks,
        "paths": paths,
        "texture_assets": ["mat_0", "mat_1", "mat_2", "mat_3"],
        "files": {
            fname: hashlib.sha256((out / fname).read_bytes()).hexdigest()
            for fname in ["height.r32", "control.r32", "walkable.u8", "weights.png", "surface.png"]
        },
    }
    (out / "terrain.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n")
    (out / "config.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n")
    print(f"CAPITAL_REGION_OK {land_id}: height={cfg['height_range']} walkable={cfg['walkable_percent']}%")
    return cfg


def generate_planet_atlas():
    atlas = json.loads((SOURCE_DATA / "map.json").read_text())
    W, H = atlas["mapW"], atlas["mapH"]  # 2000 x 1000
    fn = load_fastnoise("atlas", (H, W))
    fbm, ridged, cell = fn[:, :, 0], fn[:, :, 1], fn[:, :, 2]

    # Ocean base with depth rings & subtle grid lines
    yy, xx = np.mgrid[:H, :W].astype(np.float32)
    ocean_r = np.clip(18.0 + 10.0 * fbm, 8, 40)
    ocean_g = np.clip(48.0 + 16.0 * fbm, 24, 78)
    ocean_b = np.clip(76.0 + 22.0 * fbm, 42, 118)
    canvas = np.dstack([ocean_r, ocean_g, ocean_b]).astype(np.float32)

    occupancy = np.zeros((H, W), dtype=np.uint8)
    global_height = np.zeros((H, W), dtype=np.float32)

    palettes = {
        "verdant": [(198, 186, 132), (104, 158, 76), (58, 114, 52), (120, 116, 108), (242, 246, 250)],
        "aether":  [(168, 202, 218), (196, 218, 232), (138, 162, 182), (218, 234, 246), (250, 253, 255)],
        "nexus":   [(172, 152, 122), (196, 176, 142), (144, 136, 128), (112, 116, 122), (178, 186, 194)],
        "pyra":    [(112, 54, 34),   (188, 88, 42),   (138, 62, 34),   (58, 48, 46),    (255, 116, 28)],
    }

    manifest = {
        "seed": 20261118,
        "atlasSize": [W, H],
        "continents": {},
        "quest_islands": {},
        "archipelagos": [],
    }

    for reg in atlas["regions"]:
        rid = reg["id"]
        mask_im = Image.new("L", (W, H), 0)
        outline = [tuple(p) for p in reg["outline"]]
        ImageDraw.Draw(mask_im).polygon(outline, fill=255)
        mask = np.asarray(mask_im) > 127
        occupancy[mask] = 255

        dist = ndimage.distance_transform_edt(mask).astype(np.float32)
        max_d = max(float(dist.max()), 1.0)
        coast_ramp = np.clip(dist / min(38.0, max_d * 0.45), 0.0, 1.0)
        elev = coast_ramp * (0.48 * (fbm * 0.5 + 0.5) + 0.36 * (ridged * 0.5 + 0.5) + 0.16 * (cell * 0.5 + 0.5))

        # Continent-specific macro landmarks matching 05_ATLAS_Cztery_Kontynenty.jpg
        cx, cy = reg["center"]
        if rid == "verdant":
            # Northern snow-capped mountain arc + Central-East Wielkie Jezioro
            mtn_arc = np.exp(-(((yy - (cy - 95.0)) / 42.0) ** 2)) * np.exp(-(((xx - (cx + 30.0)) / 135.0) ** 2))
            elev = np.clip(elev + mtn_arc * 0.58, 0.0, 1.0)
            lake = np.hypot((xx - (cx + 75.0)) / 78.0, (yy - (cy - 15.0)) / 46.0) + 0.15 * fbm
            is_lake = mask & (lake < 0.85) & (lake > 0.24)  # island in middle of Wielkie Jezioro!
            elev[is_lake] = 0.02
        elif rid == "aether":
            # Central sacred peak + concentric stepped terraces
            r_center = np.hypot((xx - (cx - 45.0)) / 140.0, (yy - (cy + 10.0)) / 95.0)
            terraces = np.floor(np.clip(1.0 - r_center, 0.0, 1.0) * 6.0) / 6.0
            elev = np.clip(elev * 0.65 + terraces * 0.55, 0.0, 1.0)
        elif rid == "nexus":
            # Flat stepped plateau + eastern mountain ridge + southern canal bay
            plateau = np.floor(np.clip(elev * 4.5, 0.0, 4.0)) / 4.5
            east_mtn = np.exp(-(((xx - (cx + 70.0)) / 65.0) ** 2)) * np.exp(-(((yy - (cy - 30.0)) / 90.0) ** 2))
            elev = np.clip(plateau * 0.7 + east_mtn * 0.5, 0.0, 1.0)
        elif rid == "pyra":
            # Volcanic calderas & glowing lava cracks
            v1 = np.hypot(xx - (cx - 55.0), yy - (cy - 15.0))
            v2 = np.hypot(xx - (cx + 95.0), yy - (cy + 25.0))
            caldera = 0.55 * np.exp(-((v1 / 65.0) ** 2)) - 0.35 * np.exp(-((v1 / 18.0) ** 2))
            caldera += 0.50 * np.exp(-((v2 / 55.0) ** 2)) - 0.30 * np.exp(-((v2 / 15.0) ** 2))
            elev = np.clip(elev + caldera, 0.0, 1.0)

        global_height[mask] = elev[mask]

        # Colorize relief with directional hillshade (NW light source)
        pal = palettes.get(rid, [(195, 185, 140), (118, 156, 96), (78, 118, 68), (130, 128, 122), (235, 240, 245)])
        gy, gx = np.gradient(elev * 28.0)
        shade = np.clip(0.72 - 0.28 * gx - 0.22 * gy, 0.42, 1.18)

        bands = np.clip(elev * 4.0, 0.0, 3.999)
        b_idx = bands.astype(np.int32)
        b_frac = bands - b_idx
        col = np.zeros((H, W, 3), dtype=np.float32)
        for c in range(3):
            c0 = np.choose(b_idx, [p[c] for p in pal[:4]])
            c1 = np.choose(np.minimum(b_idx + 1, 4), [p[c] for p in pal])
            col[:, :, c] = (c0 * (1.0 - b_frac) + c1 * b_frac) * shade

        if rid == "verdant":
            col[is_lake] = [72, 168, 196]
        elif rid == "pyra":
            lava_vein = mask & (np.abs(ridged) < 0.065) & (dist > 14.0)
            col[lava_vein] = [255, 108, 24]

        # Shallow water coastal glow + dark ink shoreline outline
        shallow = (dist == 0) & (ndimage.distance_transform_edt(~mask) < 12.0)
        canvas[shallow] = canvas[shallow] * 0.6 + np.array([68.0, 142.0, 168.0]) * 0.4
        canvas[mask] = col[mask]
        shore_line = mask & (dist <= 2.2)
        canvas[shore_line] = [32, 26, 22]

        land_json = json.loads((SOURCE_DATA / "lands" / rid / "land.json").read_text())
        entry = {
            "id": rid,
            "name": reg["name"],
            "kind": reg["kind"],
            "size": [land_json["width"], land_json["height"]],
            "center": reg["center"],
            "settlements": land_json["settlements"],
        }
        if reg["kind"] == "continent":
            manifest["continents"][rid] = entry
        else:
            manifest["quest_islands"][rid] = entry

    # Generate 8 deterministic ocean archipelagos (52 islets) away from existing continents/islands
    rng = np.random.default_rng(20261118)
    clearance = ndimage.distance_transform_edt(occupancy == 0)
    for _ in range(4000):
        if len(manifest["archipelagos"]) >= 8:
            break
        ax = int(rng.integers(90, W - 90))
        ay = int(rng.integers(90, H - 90))
        if clearance[ay, ax] < 62.0:
            continue
        if any(math.hypot(ax - g["center"][0], ay - g["center"][1]) < 150.0 for g in manifest["archipelagos"]):
            continue
        islets = []
        for k in range(int(rng.integers(5, 8))):
            ang = k * 1.15 + float(rng.uniform(-0.25, 0.25))
            rad = 0.0 if k == 0 else float(rng.uniform(14.0, 36.0))
            ix = int(np.clip(round(ax + math.cos(ang) * rad), 25, W - 25))
            iy = int(np.clip(round(ay + math.sin(ang) * rad), 25, H - 25))
            ir = int(rng.integers(6, 11) if k == 0 else rng.integers(2, 6))
            islets.append([ix, iy, ir])
            d_islet = np.hypot(xx - ix, yy - iy)
            imask = d_islet <= ir
            occupancy[imask] = 255
            canvas[imask] = [124, 158, 96]
            canvas[(d_islet <= ir * 0.55)] = [88, 128, 72]
            canvas[(d_islet <= ir + 1.5) & (d_islet > ir - 0.8)] = [34, 28, 24]
        manifest["archipelagos"].append({
            "id": f"archipelago-{len(manifest['archipelagos']) + 1}",
            "center": [ax, ay],
            "islets": islets,
        })

    # Apply OpenCV painterly finish to the planet atlas
    atlas_u8 = np.clip(canvas, 0, 255).astype(np.uint8)
    bgr = cv2.cvtColor(atlas_u8, cv2.COLOR_RGB2BGR)
    painted = cv2.edgePreservingFilter(bgr, flags=1, sigma_s=18, sigma_r=0.22)
    atlas_rgb = cv2.cvtColor(painted, cv2.COLOR_BGR2RGB)
    Image.fromarray(atlas_rgb, "RGB").save(OUT_ATLAS / "planet_atlas_relief.png")

    (OUT_ATLAS / "topography_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(
        f"PLANET_ATLAS_OK continents={len(manifest['continents'])} "
        f"quest_islands={len(manifest['quest_islands'])} archipelagos={len(manifest['archipelagos'])}"
    )


if __name__ == "__main__":
    generate_planet_atlas()
    for lid in ["pyra", "verdant", "aether", "nexus"]:
        generate_capital_region(lid)
