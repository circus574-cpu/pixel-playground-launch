#!/usr/bin/env python3
"""Render visual monster spawn plan sketch maps on the NEW 4096 m continents.

Shows:
- Real canonical continent art + real 4096 m roads + plotted capital & outer town buildings
- Compact Green Safe Capital circle (r = 250 m = 12.2% of continent width, 1.5% area, 0 monsters)
- 5 named Sub-Biome landscape regions per continent
- 10 tiered monster spawn zones per continent (40 canonical monsters Lv. 1..18)
  strictly on dry walkable ground outside safe_city_radius.

NOTE: Visual sketch ONLY! Does NOT write any monsters into buildings.json.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
REGIONS_DIR = ROOT / "ports" / "godot-isometric-world" / "regions"
MONSTERS_JSON = ROOT / "ports" / "godot-isometric-world" / "data" / "monsters.json"
QA_DIR = ROOT / "docs" / "zmiany" / "2026-11-18" / "qa"
ART_DIR = Path("/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/48b1af26-2be3-4934-914d-17ea6b155df5")

LAND_META = {
    "pyra": ("Pyra — Twierdza Popiołu (4096×4096 m)", "pyra"),
    "verdant": ("Verdantia — Zielona Przystań (4096×4096 m)", "verdant"),
    "aether": ("Aetheria — Lodowe Sanktuarium (4096×4096 m)", "aether"),
    "nexus": ("Nexus-9 — Węzeł Świadomości (4096×4096 m)", "nexus"),
}

# Target radial distance (in 4096m world units from capital_center) & sector angles for 10 progressive tiers
ZONE_LAYOUT = [
    # (tier_band, pack_size, zone_radius_m, target_dist_m, preferred_angle_deg)
    ("green",  5, 115,  460,  -45),
    ("green",  5, 115,  540,  140),
    ("green",  5, 115,  640,   45),
    ("gold",   4, 120,  860, -135),
    ("gold",   4, 120,  960,   15),
    ("gold",   4, 120, 1080,  105),
    ("orange", 3, 120, 1280, -100),
    ("orange", 3, 120, 1360,  -15),
    ("orange", 3, 120, 1460,  165),
    ("red",    2, 110, 1650,   75),
]

BAND_COLORS = {
    "green":  ((64, 224, 110),  (20, 95, 42)),
    "gold":   ((255, 212, 68),  (125, 88, 12)),
    "orange": ((255, 138, 48),  (132, 52, 10)),
    "red":    ((255, 68, 72),   (138, 18, 22)),
}


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for p in candidates:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def get_land_monsters(land: str) -> list[dict]:
    raw = json.loads(MONSTERS_JSON.read_text(encoding="utf-8"))["monsters"]
    prefix = land + "-"
    items = [v for k, v in raw.items() if k.startswith(prefix)]
    items.sort(key=lambda m: (int(m.get("level", 1)), str(m.get("id", ""))))
    return items[:10]


def pick_dry_zone(walk: np.ndarray, surf: np.ndarray, ws: float, cx: float, cz: float,
                  safe_r: float, target_d: float, pref_deg: float, existing: list[tuple[float, float]]) -> tuple[float, float]:
    half = ws * 0.5
    dry = (walk > 0) & (surf[:, :, 0] < 35) & (surf[:, :, 1] < 35)
    # Candidate search spiraling around target distance & angle
    best_pt = None
    best_score = 1e18
    for d_off in (0, 80, -80, 180, -180, 300, -300, 450, -450):
        dist = max(safe_r + 170.0, min(1820.0, target_d + d_off))
        for a_step in range(0, 360, 10):
            for sign in (1, -1):
                ang = math.radians(pref_deg + sign * a_step)
                wx = cx + math.cos(ang) * dist
                wz = cz + math.sin(ang) * dist
                if abs(wx) > half - 140.0 or abs(wz) > half - 140.0:
                    continue
                gx = int(round((wx + half) / ws * 511))
                gz = int(round((wz + half) / ws * 511))
                # Verify 7x7 dry neighborhood
                patch = dry[max(0, gz - 3):min(512, gz + 4), max(0, gx - 3):min(512, gx + 4)]
                if patch.size == 0 or patch.mean() < 0.85:
                    continue
                # Enforce min spacing from already placed zones
                too_close = False
                for ex, ez in existing:
                    if math.hypot(wx - ex, wz - ez) < 290.0:
                        too_close = True
                        break
                if too_close:
                    continue
                score = abs(d_off) * 1.4 + a_step * 4.5
                if score < best_score:
                    best_score = score
                    best_pt = (wx, wz)
            if best_pt is not None and best_score < 220.0:
                return best_pt
    if best_pt is not None:
        return best_pt
    # Ultimate fallback: any dry point outside safe_r
    ys, xs = np.where(dry)
    for k in range(0, len(xs), 17):
        wx = (xs[k] / 511.0 - 0.5) * ws
        wz = (ys[k] / 511.0 - 0.5) * ws
        if math.hypot(wx - cx, wz - cz) > safe_r + 180.0 and all(math.hypot(wx - ex, wz - ez) > 220.0 for ex, ez in existing):
            return wx, wz
    return cx + 480.0, cz


def render_continent_sketch(land: str) -> tuple[Image.Image, list[dict]]:
    rdir = REGIONS_DIR / land
    bdata = json.loads((rdir / "buildings.json").read_text(encoding="utf-8"))
    ws = float(bdata["world_size"])
    half = ws * 0.5
    safe_r = float(bdata["safe_city_radius"])
    cx, cz = float(bdata["capital_center"][0]), float(bdata["capital_center"][1])

    walk = np.fromfile(rdir / "walkable.u8", dtype=np.uint8).reshape(512, 512)
    surf = np.array(Image.open(rdir / "surface.png").convert("RGBA").resize((512, 512), Image.Resampling.BILINEAR))

    # Canvas: 1024x1024 map on left + 476px legend sidebar on right = 1500x1100
    MAP_SZ = 1024
    TOP_H = 72
    SIDE_W = 480
    W = MAP_SZ + SIDE_W
    H = MAP_SZ + TOP_H

    base_map = Image.open(rdir / "map_art.png").convert("RGBA").resize((MAP_SZ, MAP_SZ), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (14, 17, 24, 255))
    canvas.paste(base_map, (0, TOP_H))
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    def w2p(wx: float, wz: float) -> tuple[float, float]:
        return ((wx + half) / ws * MAP_SZ, TOP_H + (wz + half) / ws * MAP_SZ)

    # 1. Draw real 4096m roads
    for rd in bdata.get("roads", []):
        pts = rd.get("pts", [])
        if len(pts) < 2:
            continue
        pxs = [w2p(float(p[0]), float(p[1])) for p in pts]
        tier = rd.get("tier", "footpath")
        rw = 3 if tier == "highway" else 2
        draw.line(pxs, fill=(28, 20, 14, 170), width=rw + 2)
        draw.line(pxs, fill=(242, 220, 165, 215), width=rw)

    # 2. Draw compact Safe Capital circle (r = 250 m = 12.2% width, 1.5% area!)
    cap_px, cap_py = w2p(cx, cz)
    safe_px = safe_r / ws * MAP_SZ
    draw.ellipse(
        [cap_px - safe_px, cap_py - safe_px, cap_px + safe_px, cap_py + safe_px],
        fill=(48, 215, 118, 48),
        outline=(78, 255, 152, 245),
        width=3,
    )

    # 3. Draw REAL capital & outer town buildings as crisp dots so city footprint vs circle is 100% clear!
    for b in bdata.get("buildings", []):
        mk = b.get("map_kind", "")
        bx, bz = w2p(float(b["x"]), float(b["z"]))
        if mk == "capital":
            draw.ellipse([bx - 7, bz - 7, bx + 7, bz + 7], fill=(255, 224, 88, 255), outline=(25, 16, 8, 255), width=2)
        elif mk == "town":
            draw.rectangle([bx - 5, bz - 5, bx + 5, bz + 5], fill=(120, 210, 255, 245), outline=(10, 20, 35, 255), width=2)
        elif mk in ("service", "house"):
            draw.rectangle([bx - 3, bz - 3, bx + 3, bz + 3], fill=(255, 242, 205, 235), outline=(24, 16, 10, 230), width=1)

    # 4. Draw subtle Sub-Biome region names
    f_sb = load_font(15, bold=True)
    for sb in bdata.get("sub_biomes", []):
        sx, sy = w2p(float(sb["x"]), float(sb["z"]))
        sx = max(90, min(MAP_SZ - 150, sx))
        sy = max(TOP_H + 22, min(H - 28, sy))
        txt = sb["name"]
        draw.text((sx + 1, sy + 1), txt, font=f_sb, fill=(0, 0, 0, 220), anchor="mm")
        draw.text((sx, sy), txt, font=f_sb, fill=(225, 240, 255, 195), anchor="mm")

    # 5. Compute & draw 10 tiered monster spawn zones on dry ground outside safe_city_radius
    monsters = get_land_monsters(land)
    placed: list[tuple[float, float]] = []
    zones_summary = []
    f_num = load_font(18, bold=True)
    f_tag = load_font(13, bold=True)

    for i, mon in enumerate(monsters):
        band, count, zrad_m, target_d, pref_deg = ZONE_LAYOUT[i]
        wx, wz = pick_dry_zone(walk, surf, ws, cx, cz, safe_r, target_d, pref_deg, placed)
        placed.append((wx, wz))
        zx, zy = w2p(wx, wz)
        zr_px = max(18.0, zrad_m / ws * MAP_SZ)
        col_fg, col_bg = BAND_COLORS[band]

        draw.ellipse(
            [zx - zr_px, zy - zr_px, zx + zr_px, zy + zr_px],
            fill=(*col_fg, 58),
            outline=(*col_fg, 245),
            width=3,
        )
        # Number badge in center
        draw.ellipse([zx - 13, zy - 13, zx + 13, zy + 13], fill=(*col_bg, 245), outline=(*col_fg, 255), width=2)
        draw.text((zx, zy), str(i + 1), font=f_num, fill=(255, 255, 255, 255), anchor="mm")
        lvl = int(mon.get("level", 1))
        lbl = f"Poz.{lvl}"
        draw.text((zx + 1, zy + zr_px + 9), lbl, font=f_tag, fill=(0, 0, 0, 235), anchor="mm")
        draw.text((zx, zy + zr_px + 8), lbl, font=f_tag, fill=(*col_fg, 255), anchor="mm")

        zones_summary.append({
            "num": i + 1,
            "id": mon["id"],
            "name": mon["name"],
            "level": lvl,
            "count": count,
            "band": band,
            "x": round(wx, 1),
            "z": round(wz, 1),
            "dist_cap_m": round(math.hypot(wx - cx, wz - cz), 0),
        })

    # 6. Top header & right sidebar legend
    draw.rectangle([0, 0, W, TOP_H], fill=(16, 20, 30, 255))
    draw.line([(0, TOP_H - 1), (W, TOP_H - 1)], fill=(215, 172, 88, 255), width=2)
    f_title = load_font(26, bold=True)
    f_sub = load_font(15, bold=False)
    f_h2 = load_font(18, bold=True)
    f_row = load_font(15, bold=False)
    f_row_b = load_font(15, bold=True)

    title, _ = LAND_META[land]
    draw.text((20, 14), f"SZKIC SPAWNÓW (4× WIĘKSZY KONTYNENT) • {title}", font=f_title, fill=(255, 232, 166, 255))
    draw.text(
        (20, 46),
        f"Bezpieczna stolica: zielony okrąg r = {int(safe_r)} m (12,2% szer. / 1,5% pow. — 0 potworów)  •  10 stref / 38 osobników  •  PROJEKT DO AKCEPTACJI",
        font=f_sub,
        fill=(185, 224, 205, 255),
    )

    sx0 = MAP_SZ + 20
    draw.rectangle([MAP_SZ, TOP_H, W, H], fill=(14, 18, 26, 255))
    draw.line([(MAP_SZ, TOP_H), (MAP_SZ, H)], fill=(215, 172, 88, 200), width=2)

    y = TOP_H + 18
    draw.text((sx0, y), "LEGENDA MAPY (4096 × 4096 m)", font=f_h2, fill=(255, 222, 140, 255))
    y += 32
    legend_rows = [
        ((78, 255, 152),  "Bezpieczna Stolica (r = 250 m, 0 mobów)"),
        ((255, 242, 205), "Prawdziwe budynki stolicy (zwarty układ)"),
        ((120, 210, 255), "Zewnętrzne miasta / warownie"),
        ((64, 224, 110),  "Poz. 1–4: strefy startowe (5 szt.)"),
        ((255, 212, 68),  "Poz. 6–10: szlaki średnie (4 szt.)"),
        ((255, 138, 48),  "Poz. 12–16: głębokie biomy (3 szt.)"),
        ((255, 68, 72),   "Poz. 18: strefa elitarna (2 szt.)"),
    ]
    for col, txt in legend_rows:
        draw.ellipse([sx0, y + 2, sx0 + 14, y + 16], fill=(*col, 255), outline=(10, 10, 12, 255), width=1)
        draw.text((sx0 + 22, y), txt, font=f_row, fill=(228, 234, 242, 255))
        y += 24

    y += 14
    draw.line([(sx0, y), (W - 20, y)], fill=(90, 105, 130, 180), width=1)
    y += 14
    draw.text((sx0, y), "10 STREF POTWORÓW (KANON):", font=f_h2, fill=(255, 222, 140, 255))
    y += 30

    for z in zones_summary:
        col_fg, col_bg = BAND_COLORS[z["band"]]
        draw.ellipse([sx0, y + 2, sx0 + 24, y + 26], fill=(*col_bg, 255), outline=(*col_fg, 255), width=2)
        draw.text((sx0 + 12, y + 14), str(z["num"]), font=f_tag, fill=(255, 255, 255, 255), anchor="mm")
        draw.text((sx0 + 32, y), f"{z['name']}", font=f_row_b, fill=(246, 248, 252, 255))
        draw.text((sx0 + 32, y + 18), f"Poz. {z['level']}  •  {z['count']} szt.  •  odl. od stolicy: {int(z['dist_cap_m'])} m", font=f_sub, fill=(*col_fg, 235))
        y += 46

    y += 10
    draw.line([(sx0, y), (W - 20, y)], fill=(90, 105, 130, 180), width=1)
    y += 14
    draw.text((sx0, y), "5 RÓŻNORODNYCH SUB-BIOMÓW:", font=f_h2, fill=(140, 220, 255, 255))
    y += 28
    for sb in bdata.get("sub_biomes", []):
        draw.text((sx0, y), f"• {sb['name']} ({sb['props_count']} ob.)", font=f_row, fill=(205, 230, 245, 255))
        y += 22

    out = Image.alpha_composite(canvas, overlay).convert("RGB")
    return out, zones_summary


def main() -> None:
    QA_DIR.mkdir(parents=True, exist_ok=True)
    ART_DIR.mkdir(parents=True, exist_ok=True)
    thumbs = []
    all_info = {}
    for land in ("pyra", "verdant", "aether", "nexus"):
        img, zones = render_continent_sketch(land)
        all_info[land] = zones
        img.save(QA_DIR / f"spawn_sketch_{land}.jpg", quality=88, optimize=True)
        img.save(ART_DIR / f"spawn_sketch_{land}.png")
        thumbs.append(img.resize((960, 704), Image.Resampling.LANCZOS))

    # 2x2 overview sheet
    grid = Image.new("RGB", (1920, 1408), (12, 15, 22))
    grid.paste(thumbs[0], (0, 0))
    grid.paste(thumbs[1], (960, 0))
    grid.paste(thumbs[2], (0, 704))
    grid.paste(thumbs[3], (960, 704))
    grid.save(QA_DIR / "spawn_sketch_all_4_continents.jpg", quality=88, optimize=True)
    grid.save(ART_DIR / "spawn_sketch_all_4_continents.png")
    print("RENDERED_SPAWN_SKETCHES_4096M_OK", {k: len(v) for k, v in all_info.items()})


if __name__ == "__main__":
    main()
