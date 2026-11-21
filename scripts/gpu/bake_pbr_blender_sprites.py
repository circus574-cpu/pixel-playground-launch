#!/usr/bin/env python3
"""
PBR Lightmap & Hand-Painted Stone/Metal Material Baker for Blender 4.5.3 Cycles OptiX Sprites.

Preserves 100% of the mathematically exact 2:1 isometric Blender geometry, cast shadows,
and glowing lanterns on all 16 directional bridges (`assets/objects/{land}-bridge-{x,z,ns,ew}.webp`)
and 28 modular fortifications (`assets/library/fortifications/{land}-fort-*.webp`), while
replacing flat smooth Cycles grey shading with rich hand-painted biome PBR textures
(`regions/{land}/mat_*.png`), directional weathering, moss/snow/ember accents, warm/cyan
lantern bloom, and crisp dark-fantasy silhouette contours.
"""
from __future__ import annotations

import glob
import os
import shutil
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GAME = os.path.join(REPO, "ports", "godot-isometric-world")
OBJ_DIR = os.path.join(GAME, "assets", "objects")
FORT_DIR = os.path.join(GAME, "assets", "library", "fortifications")
RAW_BAK = "/tmp/blender_raw_bak"

BIOME_CFG = {
    "pyra": {
        "stone_tex": "regions/pyra/mat_3.png",
        "deck_tex": "regions/pyra/mat_2.png",
        "tint": np.array([0.52, 0.44, 0.41], dtype=np.float32),      # dark volcanic obsidian basalt
        "trim_tint": np.array([1.08, 0.72, 0.42], dtype=np.float32), # forged bronze/iron trim
        "glow_rgb": np.array([255.0, 140.0, 38.0], dtype=np.float32),
        "crevice_rgb": np.array([210.0, 68.0, 14.0], dtype=np.float32),
        "crevice_mix": 0.14,
        "snow_cap": 0.0,
        "moss_cap": 0.0,
        "tex_scale": 0.48,
        "contrast": 1.24,
    },
    "verdant": {
        "stone_tex": "regions/verdant/mat_2.png",
        "deck_tex": "regions/verdant/mat_2.png",
        "tint": np.array([0.82, 0.78, 0.68], dtype=np.float32),      # warm weathered medieval granite
        "trim_tint": np.array([0.82, 0.62, 0.38], dtype=np.float32), # aged oak timber & brass
        "glow_rgb": np.array([255.0, 214.0, 118.0], dtype=np.float32),
        "crevice_rgb": np.array([46.0, 82.0, 34.0], dtype=np.float32),
        "crevice_mix": 0.14,
        "snow_cap": 0.0,
        "moss_cap": 0.18,
        "tex_scale": 0.32,
        "tex_amp": 0.95,
        "contrast": 1.16,
    },
    "aether": {
        "stone_tex": "regions/aether/mat_1.png",
        "deck_tex": "regions/aether/mat_0.png",
        "tint": np.array([0.88, 0.94, 1.02], dtype=np.float32),      # frosted alpine silver-marble
        "trim_tint": np.array([0.48, 0.86, 0.98], dtype=np.float32), # frost-turquoise runic trim
        "glow_rgb": np.array([120.0, 236.0, 255.0], dtype=np.float32),
        "crevice_rgb": np.array([76.0, 128.0, 158.0], dtype=np.float32),
        "crevice_mix": 0.14,
        "snow_cap": 0.32,
        "moss_cap": 0.0,
        "tex_scale": 0.34,
        "tex_amp": 0.92,
        "contrast": 1.15,
    },
    "nexus": {
        "stone_tex": "regions/nexus/mat_2.png",
        "deck_tex": "regions/nexus/mat_1.png",
        "tint": np.array([0.54, 0.62, 0.70], dtype=np.float32),      # dark brushed gunmetal titanium
        "trim_tint": np.array([0.36, 0.88, 0.98], dtype=np.float32), # cyan plasma trim
        "glow_rgb": np.array([62.0, 240.0, 255.0], dtype=np.float32),
        "crevice_rgb": np.array([22.0, 178.0, 210.0], dtype=np.float32),
        "crevice_mix": 0.20,
        "snow_cap": 0.0,
        "moss_cap": 0.0,
        "tex_scale": 0.44,
        "tex_amp": 1.45,
        "contrast": 1.24,
    },
}


def load_tiled_tex(rel_path: str, w: int, h: int, scale: float) -> np.ndarray:
    im = Image.open(os.path.join(GAME, rel_path)).convert("RGB")
    tw = max(32, int(round(im.width * scale)))
    th = max(32, int(round(im.height * scale)))
    im = im.resize((tw, th), Image.Resampling.LANCZOS)
    arr = np.array(im, dtype=np.float32) / 255.0
    rep_y = (h // th) + 2
    rep_x = (w // tw) + 2
    tiled = np.tile(arr, (rep_y, rep_x, 1))[:h, :w]
    return tiled


def isometric_masonry_pattern(w: int, h: int, kind: str) -> np.ndarray:
    """Subtle 2:1 isometric stone block & bevel micro-relief pattern."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = xx * 0.085 + yy * 0.170
    row = np.floor(yy / 11.0)
    mortar_h = (np.abs((yy % 11.0) - 0.5) < 0.90).astype(np.float32)
    stagger_x = (xx + (row % 2) * 12.0) % 24.0
    mortar_v = (np.abs(stagger_x - 0.5) < 0.90).astype(np.float32)
    if kind == "bridge":
        plank = (np.abs((u % 1.8) - 0.1) < 0.11).astype(np.float32)
        mortar = np.clip(0.50 * mortar_h + 0.40 * mortar_v + 0.40 * plank, 0.0, 1.0)
    else:
        mortar = np.clip(0.80 * mortar_h + 0.65 * mortar_v, 0.0, 1.0)
    block_hash = np.sin(row * 12.9898 + np.floor((xx + (row % 2) * 12.0) / 24.0) * 78.233) * 43758.5453
    block_var = (block_hash - np.floor(block_hash)) - 0.5
    return 1.0 - 0.20 * mortar + 0.08 * block_var


def bake_sprite(raw_path: str, out_path: str, biome: str, kind: str) -> None:
    cfg = BIOME_CFG[biome]
    src = Image.open(raw_path).convert("RGBA")
    w, h = src.size
    arr = np.array(src, dtype=np.float32)
    rgb = arr[..., :3]
    alpha = arr[..., 3] / 255.0
    opaque = alpha > 0.12

    lum = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255.0
    max_c = np.max(rgb, axis=-1)
    min_c = np.min(rgb, axis=-1)
    sat = (max_c - min_c) / np.maximum(max_c, 1.0)

    emissive = np.clip((lum - 0.79) / 0.15, 0.0, 1.0) * opaque
    trim_mask = np.clip((sat - 0.14) / 0.22, 0.0, 1.0) * (1.0 - emissive) * opaque

    op_lums = lum[opaque & (emissive < 0.3)]
    p15 = float(np.percentile(op_lums, 15)) if op_lums.size > 16 else 0.22
    p90 = float(np.percentile(op_lums, 90)) if op_lums.size > 16 else 0.72
    span = max(p90 - p15, 0.18)
    light_map = np.clip((lum - p15) / span, 0.0, 1.15)
    shade = 0.36 + 0.88 * np.power(np.clip(light_map, 0.0, 1.15), 0.92)

    stone = load_tiled_tex(cfg["stone_tex"], w, h, cfg["tex_scale"])
    deck = load_tiled_tex(cfg["deck_tex"], w, h, cfg["tex_scale"] * 0.90)

    top_weight = np.clip((light_map - 0.52) / 0.35, 0.0, 1.0)
    base_tex = stone * (1.0 - 0.58 * top_weight[..., None]) + deck * (0.58 * top_weight[..., None])

    tex_mean = np.mean(base_tex, axis=(0, 1), keepdims=True)
    tex_amp = cfg.get("tex_amp", 1.55)
    pbr_detail = np.clip(0.62 + (base_tex - tex_mean) * tex_amp, 0.26, 1.16)
    trim_detail = np.clip(0.76 + (base_tex - tex_mean) * 0.45, 0.48, 1.10)

    masonry = isometric_masonry_pattern(w, h, kind)[..., None]

    stone_rgb = np.clip(pbr_detail * cfg["tint"][None, None, :] * masonry * shade[..., None] * 255.0, 0.0, 255.0)
    trim_rgb = np.clip(trim_detail * cfg["trim_tint"][None, None, :] * shade[..., None] * 235.0, 0.0, 255.0)
    col = stone_rgb * (1.0 - trim_mask[..., None]) + trim_rgb * trim_mask[..., None]

    # Edge-detected Cycles geometry creases -> highlight upper bevels, darken lower crevices
    gy = np.zeros_like(lum)
    gx = np.zeros_like(lum)
    gy[1:-1, :] = lum[2:, :] - lum[:-2, :]
    gx[:, 1:-1] = lum[:, 2:] - lum[:, :-2]
    edge_up = np.clip(-gy * 2.2 - gx * 1.1, 0.0, 0.45) * opaque
    edge_dn = np.clip(gy * 2.2 + gx * 1.1, 0.0, 0.45) * opaque
    col = np.clip(col * (1.0 + 0.55 * edge_up[..., None] - 0.42 * edge_dn[..., None]), 0.0, 255.0)

    # Biome weathering:
    # 1) Grounded base grime / shadow gradient near bottom of sprite
    ys = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    base_ao = 1.0 - 0.24 * np.clip((ys - 0.62) / 0.38, 0.0, 1.0)
    col *= base_ao[..., None]

    # 2) Subtle glowing crevices (ember veins in Pyra, plasma circuits in Nexus, frost/moss in Aether/Verdant)
    crevice = np.clip((0.50 - shade) / 0.18, 0.0, 1.0) * (1.0 - trim_mask) * opaque
    col = col * (1.0 - cfg["crevice_mix"] * crevice[..., None]) + cfg["crevice_rgb"][None, None, :] * (cfg["crevice_mix"] * crevice[..., None])

    # 3) Snow caps on sunlit horizontal ledges (Aetheria) or emerald moss tufts (Verdantia)
    if cfg["snow_cap"] > 0.0:
        cap_mask = np.clip((light_map - 0.68) / 0.26, 0.0, 1.0) * (1.0 - ys * 0.45) * opaque
        snow_c = np.array([236.0, 244.0, 252.0], dtype=np.float32)
        col = col * (1.0 - cfg["snow_cap"] * cap_mask[..., None]) + snow_c[None, None, :] * (cfg["snow_cap"] * cap_mask[..., None])
    if cfg["moss_cap"] > 0.0:
        moss_n = np.clip((stone[..., 1] - stone[..., 0]) * 3.5 + 0.25, 0.0, 1.0)
        cap_mask = np.clip((light_map - 0.60) / 0.32, 0.0, 1.0) * moss_n * opaque
        moss_c = np.array([76.0, 118.0, 52.0], dtype=np.float32)
        col = col * (1.0 - cfg["moss_cap"] * cap_mask[..., None]) + moss_c[None, None, :] * (cfg["moss_cap"] * cap_mask[..., None])

    # 4) Warm / cyan glowing lanterns with soft bloom onto surrounding stone
    em_img = Image.fromarray(np.clip(emissive * 255.0, 0, 255).astype(np.uint8), mode="L")
    bloom = np.array(em_img.filter(ImageFilter.GaussianBlur(radius=6.0)), dtype=np.float32) / 255.0
    col = np.clip(col + cfg["glow_rgb"][None, None, :] * (bloom[..., None] * 0.48) * opaque[..., None], 0.0, 255.0)
    core_glow = np.clip(cfg["glow_rgb"] * 0.55 + 120.0, 0.0, 255.0)
    col = col * (1.0 - emissive[..., None]) + core_glow[None, None, :] * emissive[..., None]

    # 5) Crisp 1.5px dark-fantasy silhouette contour inside opaque edge
    mask_u8 = (alpha > 0.25).astype(np.uint8) * 255
    eroded = np.array(Image.fromarray(mask_u8).filter(ImageFilter.MinFilter(3)), dtype=np.float32) / 255.0
    rim = np.clip((mask_u8 / 255.0) - eroded, 0.0, 1.0)
    col *= (1.0 - 0.56 * rim[..., None])

    # Final crisp painterly polish
    rgb_im = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), mode="RGB")
    rgb_im = ImageEnhance.Contrast(rgb_im).enhance(cfg["contrast"])
    rgb_im = ImageEnhance.Sharpness(rgb_im).enhance(1.30)
    out_arr = np.zeros((h, w, 4), dtype=np.uint8)
    out_arr[..., :3] = np.array(rgb_im, dtype=np.uint8)
    out_arr[..., 3] = np.clip(arr[..., 3], 0, 255).astype(np.uint8)
    Image.fromarray(out_arr, mode="RGBA").save(out_path, "WEBP", quality=92, method=6)


def main() -> None:
    os.makedirs(f"{RAW_BAK}/bridges", exist_ok=True)
    os.makedirs(f"{RAW_BAK}/fortifications", exist_ok=True)

    b_files = sorted(glob.glob(f"{OBJ_DIR}/*-bridge-*.webp"))
    f_files = sorted(glob.glob(f"{FORT_DIR}/*-fort-*.webp"))

    for p in b_files:
        bn = os.path.basename(p)
        bak = f"{RAW_BAK}/bridges/{bn}"
        if not os.path.exists(bak):
            shutil.copy2(p, bak)
        biome = bn.split("-")[0]
        if biome in BIOME_CFG:
            bake_sprite(bak, p, biome, "bridge")

    for p in f_files:
        bn = os.path.basename(p)
        bak = f"{RAW_BAK}/fortifications/{bn}"
        if not os.path.exists(bak):
            shutil.copy2(p, bak)
        biome = bn.split("-")[0]
        if biome in BIOME_CFG:
            bake_sprite(bak, p, biome, "fort")

    print(f"BAKED_PBR_SPRITES_OK: bridges={len(b_files)} fortifications={len(f_files)}")


if __name__ == "__main__":
    main()
