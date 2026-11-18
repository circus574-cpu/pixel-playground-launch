#!/usr/bin/env python3
"""
Pillow + OpenCV + NumPy + SciPy post-processor for:
1. Isometric 2D sprites rendered from Blender (edge-preserving painterly filter,
   crisp dark contour outline, grounded contact shadow, alpha crop, anchor metadata).
2. Capital city building & prop registries (buildings.json) for Pyra, Verdantia,
   Aetheria, and Nexus-9 aligned to each district's terrain elevation and road network.
3. Enhanced 2D Isometric Relief Planet Atlas (combining base continent textures with
   3D isometric elevation relief shading, mountain ridges, crater lakes, lava rivers,
   Nexus-9 concentric tech rings, 6 quest islands, and 8 ocean archipelagos).
"""
import json
import math
import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
from scipy.ndimage import distance_transform_edt, gaussian_filter

OUT_ROOT = "/workspace/ki-world-iso-20261118"
RAW_DIR = os.path.join(OUT_ROOT, "sprites_raw")
SPRITES_DIR = os.path.join(OUT_ROOT, "sprites")
ATLAS_DIR = os.path.join(OUT_ROOT, "atlas")
os.makedirs(SPRITES_DIR, exist_ok=True)


def process_single_sprite(name):
    in_path = os.path.join(RAW_DIR, f"{name}.png")
    if not os.path.exists(in_path):
        raise FileNotFoundError(in_path)

    im = Image.open(in_path).convert("RGBA")
    arr = np.array(im, dtype=np.uint8)
    alpha = arr[:, :, 3]

    # Find non-empty bounding box
    ys, xs = np.where(alpha > 12)
    if len(xs) == 0:
        raise RuntimeError(f"Empty alpha in {in_path}")

    pad = 24
    x0 = max(0, int(xs.min()) - pad)
    x1 = min(arr.shape[1], int(xs.max()) + pad + 1)
    y0 = max(0, int(ys.min()) - pad)
    y1 = min(arr.shape[0], int(ys.max()) + pad + 1)
    crop = arr[y0:y1, x0:x1].copy()

    # Edge-preserving painterly bilateral pass + sharpening on RGB
    rgb = crop[:, :, :3]
    a = crop[:, :, 3]
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    smooth = cv2.bilateralFilter(bgr, d=5, sigmaColor=28, sigmaSpace=28)
    blur = cv2.GaussianBlur(smooth, (0, 0), 1.2)
    sharp = cv2.addWeighted(smooth, 1.32, blur, -0.32, 0)
    rgb_out = cv2.cvtColor(sharp, cv2.COLOR_BGR2RGB)

    # Dark ink contour outline around alpha silhouette
    mask = (a > 24).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    dilated = cv2.dilate(mask, kernel, iterations=1)
    outline = (dilated > 0) & (mask == 0)

    h, w = a.shape
    final = np.zeros((h, w, 4), dtype=np.uint8)

    # Ground contact shadow ellipse near bottom of sprite
    ys_local, xs_local = np.where(mask > 0)
    base_y = int(np.percentile(ys_local, 94))
    center_x = int(np.mean(xs_local))
    rad_x = max(12, int((xs_local.max() - xs_local.min()) * 0.44))
    rad_y = max(6, int(rad_x * 0.45))

    yy, xx = np.mgrid[0:h, 0:w]
    ellipse_dist = ((xx - center_x) / float(rad_x)) ** 2 + ((yy - base_y) / float(rad_y)) ** 2
    shadow_alpha = np.clip((1.0 - ellipse_dist) * 115.0, 0, 115).astype(np.uint8)
    shadow_alpha = cv2.GaussianBlur(shadow_alpha, (15, 15), 4.0)

    # Composite shadow first
    final[:, :, 0] = 14
    final[:, :, 1] = 12
    final[:, :, 2] = 18
    final[:, :, 3] = shadow_alpha

    # Composite dark outline
    final[outline, 0] = 22
    final[outline, 1] = 19
    final[outline, 2] = 24
    final[outline, 3] = 225

    # Composite main sprite over shadow/outline
    fg = a > 16
    alpha_f = (a[fg].astype(np.float32) / 255.0)[:, None]
    final[fg, :3] = np.clip(
        rgb_out[fg].astype(np.float32) * alpha_f + final[fg, :3].astype(np.float32) * (1.0 - alpha_f),
        0,
        255,
    ).astype(np.uint8)
    final[fg, 3] = np.maximum(final[fg, 3], a[fg])

    out_path = os.path.join(SPRITES_DIR, f"{name}.png")
    Image.fromarray(final, mode="RGBA").save(out_path, optimize=True)

    return {
        "id": name,
        "width": int(w),
        "height": int(h),
        "anchor_x": float(center_x) / float(w),
        "anchor_y": float(base_y) / float(h),
    }


def generate_capital_placements(sprite_meta):
    """
    Create buildings.json for each of the 4 capitals with architectural landmarks
    and natural biome scatter props placed consistently with terrain.json landmarks.
    """
    layouts = {
        "pyra": {
            "buildings": [
                {"id": "citadel_main", "sprite": "pyra_citadel", "title": "Wysoka Cytadela", "x": 168.0, "z": 58.0, "scale": 0.42, "radius": 11.0},
                {"id": "gate_main", "sprite": "pyra_gate", "title": "Brama Główna", "x": 58.0, "z": 212.0, "scale": 0.34, "radius": 8.0},
                {"id": "market_hall", "sprite": "pyra_market", "title": "Targ przy Bramie", "x": 96.0, "z": 166.0, "scale": 0.30, "radius": 7.0},
                {"id": "market_east", "sprite": "pyra_market", "title": "Zbrojownia Targowa", "x": 74.0, "z": 182.0, "scale": 0.27, "radius": 6.5},
                {"id": "forge_main", "sprite": "pyra_forge", "title": "Wielka Kuźnia", "x": 208.0, "z": 192.0, "scale": 0.34, "radius": 8.5},
                {"id": "forge_south", "sprite": "pyra_forge", "title": "Huta Popiołu", "x": 154.0, "z": 196.0, "scale": 0.31, "radius": 8.0},
                {"id": "tower_west", "sprite": "pyra_watchtower", "title": "Baszta Zachodnia", "x": 116.0, "z": 102.0, "scale": 0.30, "radius": 5.5},
                {"id": "tower_crown", "sprite": "pyra_watchtower", "title": "Baszta Korony", "x": 202.0, "z": 80.0, "scale": 0.31, "radius": 5.5},
                {"id": "bridge_stairs", "sprite": "bridge_arch", "title": "Most nad Przepaścią", "x": 144.0, "z": 118.0, "scale": 0.28, "radius": 0.0},
            ],
            "tree_sprites": ["tree_charred", "cliff_basalt", "rock_cluster", "ruin_pillar"],
        },
        "verdant": {
            "buildings": [
                {"id": "bridge_main", "sprite": "verdant_bridge", "title": "Most Główny", "x": 128.0, "z": 128.0, "scale": 0.38, "radius": 0.0},
                {"id": "guildhall_main", "sprite": "verdant_guildhall", "title": "Dom Cechowy", "x": 58.0, "z": 104.0, "scale": 0.36, "radius": 9.5},
                {"id": "market_west", "sprite": "verdant_market", "title": "Targ Rzemieślników", "x": 96.0, "z": 154.0, "scale": 0.31, "radius": 7.5},
                {"id": "dock_harbor", "sprite": "verdant_dockhouse", "title": "Kapitanat Przystani", "x": 92.0, "z": 204.0, "scale": 0.34, "radius": 8.0},
                {"id": "garden_villa_1", "sprite": "verdant_gardenhouse", "title": "Dom Ogrodowy", "x": 182.0, "z": 114.0, "scale": 0.33, "radius": 8.0},
                {"id": "garden_villa_2", "sprite": "verdant_gardenhouse", "title": "Dwór w Sadach", "x": 212.0, "z": 78.0, "scale": 0.34, "radius": 8.0},
                {"id": "guild_north", "sprite": "verdant_guildhall", "title": "Młyn Doliny", "x": 76.0, "z": 74.0, "scale": 0.31, "radius": 8.0},
            ],
            "tree_sprites": ["tree_oak", "tree_pine", "rock_cluster", "ruin_pillar"],
        },
        "aether": {
            "buildings": [
                {"id": "pagoda_sanctuary", "sprite": "aether_pagoda", "title": "Górne Sanktuarium", "x": 132.0, "z": 54.0, "scale": 0.42, "radius": 10.0},
                {"id": "shrine_east", "sprite": "aether_shrine", "title": "Kaplica Źródeł Wschód", "x": 162.0, "z": 78.0, "scale": 0.29, "radius": 5.5},
                {"id": "shrine_west", "sprite": "aether_shrine", "title": "Kaplica Źródeł Zachód", "x": 102.0, "z": 78.0, "scale": 0.29, "radius": 5.5},
                {"id": "aqueduct_west", "sprite": "aether_aqueduct", "title": "Akwedukt Zachodni", "x": 86.0, "z": 122.0, "scale": 0.35, "radius": 8.0},
                {"id": "aqueduct_east", "sprite": "aether_aqueduct", "title": "Akwedukt Wschodni", "x": 176.0, "z": 122.0, "scale": 0.35, "radius": 8.0},
                {"id": "hall_science_w", "sprite": "aether_hall", "title": "Pawilon Nauki Zachód", "x": 74.0, "z": 152.0, "scale": 0.33, "radius": 8.0},
                {"id": "hall_science_e", "sprite": "aether_hall", "title": "Pawilon Nauki Wschód", "x": 186.0, "z": 152.0, "scale": 0.33, "radius": 8.0},
                {"id": "gate_lower", "sprite": "aether_gate", "title": "Brama Miasta Gościnnego", "x": 128.0, "z": 216.0, "scale": 0.34, "radius": 7.5},
            ],
            "tree_sprites": ["tree_sakura", "tree_pine", "rock_cluster", "ruin_pillar"],
        },
        "nexus": {
            "buildings": [
                {"id": "core_main", "sprite": "nexus_core", "title": "Rdzeń Energetyczny", "x": 150.0, "z": 76.0, "scale": 0.42, "radius": 10.5},
                {"id": "hangar_west", "sprite": "nexus_hangar", "title": "Hala Transportowa", "x": 78.0, "z": 78.0, "scale": 0.36, "radius": 9.0},
                {"id": "conduit_mid_w", "sprite": "nexus_conduit", "title": "Węzeł Przesyłowy W", "x": 102.0, "z": 128.0, "scale": 0.30, "radius": 5.0},
                {"id": "conduit_mid_e", "sprite": "nexus_conduit", "title": "Węzeł Przesyłowy E", "x": 168.0, "z": 128.0, "scale": 0.30, "radius": 5.0},
                {"id": "workshop_lower", "sprite": "nexus_workshop", "title": "Dolne Warsztaty", "x": 76.0, "z": 182.0, "scale": 0.35, "radius": 8.5},
                {"id": "dock_east", "sprite": "nexus_dock", "title": "Plac Przeładunkowy", "x": 196.0, "z": 176.0, "scale": 0.34, "radius": 8.0},
                {"id": "conduit_south", "sprite": "nexus_conduit", "title": "Pylon Doków", "x": 138.0, "z": 196.0, "scale": 0.29, "radius": 5.0},
            ],
            "tree_sprites": ["nexus_conduit", "cliff_basalt", "rock_cluster"],
        },
    }

    for land, cfg in layouts.items():
        reg_dir = os.path.join(OUT_ROOT, "regions", land)
        tjson_path = os.path.join(reg_dir, "terrain.json")
        with open(tjson_path) as f:
            tjson = json.load(f)

        size = int(tjson.get("size", tjson.get("grid_size", 512)))
        world_size = float(tjson.get("world_size", 256.0))
        h_map = np.fromfile(os.path.join(reg_dir, "height.r32"), dtype=np.float32).reshape((size, size))
        w_map = np.fromfile(os.path.join(reg_dir, "walkable.u8"), dtype=np.uint8).reshape((size, size))

        canonical_landmarks = {
            "pyra": [
                {"id": "gate", "title": "Brama Główna", "x": 64.0, "z": 208.0},
                {"id": "market", "title": "Targ przy Bramie", "x": 96.0, "z": 168.0},
                {"id": "stairs", "title": "Schody do Popiołu", "x": 134.0, "z": 124.0},
                {"id": "crown-plaza", "title": "Plac Korony", "x": 168.0, "z": 86.0},
                {"id": "citadel", "title": "Wysoka Cytadela", "x": 168.0, "z": 62.0},
                {"id": "forges", "title": "Dolne Kuźnie i Plac Węglowy", "x": 182.0, "z": 192.0},
            ],
            "verdant": [
                {"id": "crafts", "title": "Dzielnica Rzemieślnicza", "x": 68.0, "z": 106.0},
                {"id": "market", "title": "Targ", "x": 96.0, "z": 154.0},
                {"id": "main-bridge", "title": "Most Główny", "x": 128.0, "z": 128.0},
                {"id": "harbor", "title": "Przystań i Nabrzeże", "x": 92.0, "z": 202.0},
                {"id": "gardens", "title": "Domy Ogrodowe i Sady", "x": 186.0, "z": 110.0},
            ],
            "aether": [
                {"id": "lower-town", "title": "Dolne Miasto Gościnne", "x": 128.0, "z": 210.0},
                {"id": "science-terrace", "title": "Tarasy Nauki", "x": 128.0, "z": 144.0},
                {"id": "upper-sanctuary", "title": "Górne Sanktuarium", "x": 132.0, "z": 62.0},
                {"id": "spring-courtyard", "title": "Źródlany Dziedziniec", "x": 132.0, "z": 88.0},
            ],
            "nexus": [
                {"id": "core", "title": "Rdzeń Energetyczny", "x": 148.0, "z": 78.0},
                {"id": "transport-hall", "title": "Hala Transportowa", "x": 82.0, "z": 82.0},
                {"id": "conduits", "title": "Trakty Łączące", "x": 128.0, "z": 128.0},
                {"id": "workshops", "title": "Dolne Warsztaty i Doki", "x": 82.0, "z": 182.0},
                {"id": "cargo-yard", "title": "Place Przeładunkowe", "x": 192.0, "z": 176.0},
            ],
        }
        landmarks = []
        for lm in canonical_landmarks[land]:
            lx = float(lm["x"])
            lz = float(lm["z"])
            ix = int(np.clip(round(lx * (size - 1) / world_size), 0, size - 1))
            iz = int(np.clip(round(lz * (size - 1) / world_size), 0, size - 1))
            w_map[max(0, iz - 3):min(size, iz + 4), max(0, ix - 3):min(size, ix + 4)] = 255
            landmarks.append({
                "id": lm["id"],
                "title": lm["title"],
                "x": round(lx, 2),
                "z": round(lz, 2),
                "y": round(float(h_map[iz, ix]), 2),
            })

        w_map.tofile(os.path.join(reg_dir, "walkable.u8"))
        tjson["size"] = size
        tjson["world_size"] = world_size
        tjson["landmarks"] = landmarks
        tjson["spawn"] = {"x": landmarks[0]["x"], "z": landmarks[0]["z"]}
        with open(tjson_path, "w") as f:
            json.dump(tjson, f, indent=2, ensure_ascii=False)

        buildings_out = []
        for b in cfg["buildings"]:
            bx = float(b["x"])
            bz = float(b["z"])
            ix = int(np.clip(round(bx * (size - 1) / world_size), 0, size - 1))
            iz = int(np.clip(round(bz * (size - 1) / world_size), 0, size - 1))
            by = float(h_map[iz, ix])
            smeta = sprite_meta[b["sprite"]]
            buildings_out.append({
                **b,
                "y": round(by, 3),
                "anchor_x": smeta["anchor_x"],
                "anchor_y": smeta["anchor_y"],
            })

        # Scatter natural props (trees, rocks, cliffs, ruins) away from landmark paths
        rng = np.random.default_rng(abs(hash(land)) % (2**31))
        props_out = []
        tree_pool = cfg["tree_sprites"]
        attempts = 0
        while len(props_out) < 56 and attempts < 900:
            attempts += 1
            px = float(rng.uniform(22.0, 234.0))
            pz = float(rng.uniform(22.0, 234.0))
            ix = int(np.clip(round(px * (size - 1) / 256.0), 0, size - 1))
            iz = int(np.clip(round(pz * (size - 1) / 256.0), 0, size - 1))
            if w_map[iz, ix] == 0:
                continue
            py = float(h_map[iz, ix])
            if py < 1.5:
                continue
            # Keep distance from landmarks and buildings
            too_close = False
            for lm in landmarks:
                if math.hypot(px - lm["x"], pz - lm["z"]) < 16.0:
                    too_close = True
                    break
            for b in buildings_out:
                if math.hypot(px - b["x"], pz - b["z"]) < 16.0:
                    too_close = True
                    break
            for p in props_out:
                if math.hypot(px - p["x"], pz - p["z"]) < 11.0:
                    too_close = True
                    break
            if too_close:
                continue

            sp = tree_pool[len(props_out) % len(tree_pool)]
            smeta = sprite_meta[sp]
            props_out.append({
                "id": f"prop_{len(props_out)}",
                "sprite": sp,
                "x": round(px, 2),
                "y": round(py, 3),
                "z": round(pz, 2),
                "scale": round(float(rng.uniform(0.18, 0.25)), 3),
                "anchor_x": smeta["anchor_x"],
                "anchor_y": smeta["anchor_y"],
            })

        out_data = {
            "land": land,
            "buildings": buildings_out,
            "props": props_out,
        }
        with open(os.path.join(reg_dir, "buildings.json"), "w") as f:
            json.dump(out_data, f, indent=2, ensure_ascii=False)
        print(f"SAVED_BUILDINGS {land}: buildings={len(buildings_out)} props={len(props_out)}")


def enhance_planet_atlas():
    """
    Combines base_atlas.webp (the canonical painted continent shapes/textures) with
    our procedural 3D isometric relief elevation shading, mountain peaks, rivers,
    caldera lava channels, Nexus-9 concentric rings, and 8 ocean archipelagos.
    """
    base_path = os.path.join(ATLAS_DIR, "base_atlas.webp")
    proc_path = os.path.join(ATLAS_DIR, "planet_atlas_relief.png")
    manifest_path = os.path.join(ATLAS_DIR, "topography_manifest.json")

    W, H = 2048, 1024
    proc_im = Image.open(proc_path).convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
    proc_arr = np.array(proc_im, dtype=np.float32)

    if os.path.exists(base_path):
        base_im = Image.open(base_path).convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
        base_arr = np.array(base_im, dtype=np.float32)

        # Blend: keep authentic high-detail continent textures from base_atlas while injecting
        # our procedural relief highlights, lava channels, Nexus rings, and ocean archipelagos
        blended = base_arr * 0.68 + proc_arr * 0.32

        # Preserve procedural ocean archipelagos & glowing features where proc_arr is brighter
        diff_bright = np.maximum(0.0, proc_arr - base_arr)
        blended = np.clip(blended + diff_bright * 0.65, 0, 255).astype(np.uint8)
    else:
        blended = proc_arr.astype(np.uint8)

    # Apply crisp local contrast & subtle isometric relief sharpening
    bgr = cv2.cvtColor(blended, cv2.COLOR_RGB2BGR)
    blur = cv2.GaussianBlur(bgr, (0, 0), 2.0)
    sharp = cv2.addWeighted(bgr, 1.28, blur, -0.28, 0)
    rgb = cv2.cvtColor(sharp, cv2.COLOR_BGR2RGB)

    out_im = Image.fromarray(rgb)
    out_im.save(proc_path, optimize=True)
    print(f"ENHANCED_PLANET_ATLAS {proc_path} ({W}x{H})")


def main():
    sprite_names = [
        "cliff_basalt", "rock_cluster", "tree_pine", "tree_oak",
        "tree_sakura", "tree_charred", "ruin_pillar", "bridge_arch",
        "pyra_citadel", "pyra_gate", "pyra_forge", "pyra_market", "pyra_watchtower",
        "verdant_bridge", "verdant_guildhall", "verdant_market", "verdant_dockhouse", "verdant_gardenhouse",
        "aether_pagoda", "aether_aqueduct", "aether_hall", "aether_gate", "aether_shrine",
        "nexus_core", "nexus_hangar", "nexus_workshop", "nexus_conduit", "nexus_dock",
    ]
    sprite_meta = {}
    for s in sprite_names:
        sprite_meta[s] = process_single_sprite(s)
    with open(os.path.join(SPRITES_DIR, "sprites_manifest.json"), "w") as f:
        json.dump(sprite_meta, f, indent=2)
    print(f"PROCESSED_SPRITES count={len(sprite_meta)}")

    generate_capital_placements(sprite_meta)
    enhance_planet_atlas()


if __name__ == "__main__":
    main()
