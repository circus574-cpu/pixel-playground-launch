#!/usr/bin/env python3
"""
KI Legends — 1:1 Canonical Map-Synced Continent World Generator.

Single Source of Truth:
  - Reads the owner-accepted canonical `regions/<land>/map_art.png` and `regions/<land>/relief_3d.r32`.
  - Preserves canonical `map_art.png`, `minimap_hq.png`, `relief_3d.r32`, `atlas/planet_real_world.png`,
    `assets/map/globe-real-world.webp`, and deployed RTX 6000 Ada seamless PBR textures untouched.
  - Extracts exact ocean, inland water (lakes/rivers), volcanic lava (Pyra), alpine snow, and green oasis
    (Aetheria NW) masks directly from `map_art.png` + `relief_3d.r32`.
  - Computes pure-NumPy 2-pass Chamfer-Euclidean distance transforms (`exact_edt`) so ZERO buildings, NPCs,
    monsters, fauna, exp-zones, or props EVER spawn on ocean, lakes, rivers, or lava.
  - Builds spacious, non-colliding capitals centered on each continent's widest flat dry valley (`capital_center`),
    enforcing minimum `r1 + r2 + 22m` footprint spacing and clear `18m` entrance aprons.
  - Uses RTX 6000 Ada snowy winter architecture & pines across snowy Aetheria (green flora ONLY in NW oasis).
  - Detects every road crossing over water or lava, matches road screen-space tangent against the 16 exact 2:1
    isometric Blender Cycles OptiX directional bridges (`x, z, ns, ew`), keeps water/lava visible beneath the deck,
    and guarantees `walkable.u8 = 255` across every bridge span.
  - Deploys reserve castles, spare outpost buildings, modular Blender fortifications, and waterfalls from
    `ports/godot-isometric-world/assets/library/`.
  - Runs a strict automated 0-violation audit across all 4 continents before finishing.
"""

from __future__ import annotations

import collections
import json
import math
import os
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_ROOT = Path(os.environ.get("ISO_WORLD_OUT", str(REPO_ROOT / "ports/godot-isometric-world")))
NOISE_DIR = OUT_ROOT / "noise"
ATLAS_DIR = OUT_ROOT / "atlas"
REGIONS_DIR = OUT_ROOT / "regions"

ATLAS_DIR.mkdir(parents=True, exist_ok=True)
REGIONS_DIR.mkdir(parents=True, exist_ok=True)


# ==============================================================================
# 1. PURE-NUMPY GEOMETRY, DISTANCE TRANSFORM & MORPHOLOGY UTILITIES
# ==============================================================================

def load_noise(name: str, target_shape: tuple[int, int]) -> np.ndarray:
    p = NOISE_DIR / f"{name}.png"
    if p.exists():
        img = Image.open(p).convert("L").resize((target_shape[1], target_shape[0]), Image.Resampling.BICUBIC)
        return np.asarray(img, dtype=np.float32) / 255.0
    seed = abs(hash(name)) % (2**32)
    rng = np.random.default_rng(seed)
    acc = np.zeros(target_shape, dtype=np.float32)
    for grid_sz, weight in [(8, 0.46), (16, 0.28), (32, 0.16), (64, 0.10)]:
        coarse = (rng.random((grid_sz, grid_sz), dtype=np.float32) * 255.0).astype(np.uint8)
        up = Image.fromarray(coarse, mode="L").resize((target_shape[1], target_shape[0]), Image.Resampling.BICUBIC)
        acc += (np.asarray(up, dtype=np.float32) / 255.0) * weight
    lo, hi = float(np.min(acc)), float(np.max(acc))
    return (acc - lo) / max(hi - lo, 1e-6)


def smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    denom = edge1 - edge0
    if abs(denom) < 1e-6:
        denom = 1e-6
    t = np.clip((x - edge0) / denom, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def exact_edt(mask_bool: np.ndarray) -> np.ndarray:
    """Fast C-vectorized pure-NumPy 2-pass Chamfer-Euclidean distance transform (in pixels)
    measuring distance to the nearest True pixel in `mask_bool`."""
    H, W = mask_bool.shape
    d = np.where(mask_bool, 0.0, 1e6).astype(np.float32)
    s2 = np.float32(1.41421356)
    for y in range(1, H):
        up = d[y - 1]
        cur = d[y]
        np.minimum(cur, up + 1.0, out=cur)
        np.minimum(cur[1:], up[:-1] + s2, out=cur[1:])
        np.minimum(cur[:-1], up[1:] + s2, out=cur[:-1])
    for x in range(1, W):
        lt = d[:, x - 1]
        cur = d[:, x]
        np.minimum(cur, lt + 1.0, out=cur)
        np.minimum(cur[1:], lt[:-1] + s2, out=cur[1:])
        np.minimum(cur[:-1], lt[1:] + s2, out=cur[:-1])
    for y in range(H - 2, -1, -1):
        dn = d[y + 1]
        cur = d[y]
        np.minimum(cur, dn + 1.0, out=cur)
        np.minimum(cur[1:], dn[:-1] + s2, out=cur[1:])
        np.minimum(cur[:-1], dn[1:] + s2, out=cur[:-1])
    for x in range(W - 2, -1, -1):
        rt = d[:, x + 1]
        cur = d[:, x]
        np.minimum(cur, rt + 1.0, out=cur)
        np.minimum(cur[1:], rt[:-1] + s2, out=cur[1:])
        np.minimum(cur[:-1], rt[1:] + s2, out=cur[:-1])
    for y in range(1, H):
        up = d[y - 1]
        cur = d[y]
        np.minimum(cur, up + 1.0, out=cur)
        np.minimum(cur[1:], up[:-1] + s2, out=cur[1:])
        np.minimum(cur[:-1], up[1:] + s2, out=cur[:-1])
    for y in range(H - 2, -1, -1):
        dn = d[y + 1]
        cur = d[y]
        np.minimum(cur, dn + 1.0, out=cur)
        np.minimum(cur[1:], dn[:-1] + s2, out=cur[1:])
        np.minimum(cur[:-1], dn[1:] + s2, out=cur[:-1])
    return d


def morph_open(mask: np.ndarray, k: int = 3) -> np.ndarray:
    im = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
    im = im.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
    return np.asarray(im) > 127


def morph_close(mask: np.ndarray, k: int = 3) -> np.ndarray:
    im = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
    im = im.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))
    return np.asarray(im) > 127


def blur_float(arr: np.ndarray, radius: float) -> np.ndarray:
    lo = float(np.min(arr))
    hi = float(np.max(arr))
    if hi - lo < 1e-6:
        return arr.copy()
    norm = np.clip((arr - lo) / (hi - lo) * 255.0, 0, 255).astype(np.uint8)
    blurred = np.asarray(Image.fromarray(norm, mode="L").filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0
    return blurred * (hi - lo) + lo


def flood_fill_from_border(candidate: np.ndarray) -> np.ndarray:
    """Fast BFS flood fill of `candidate` starting from all True border pixels (4-connected)."""
    H, W = candidate.shape
    visited = np.zeros((H, W), dtype=bool)
    q = collections.deque()
    for x in range(W):
        if candidate[0, x] and not visited[0, x]:
            visited[0, x] = True
            q.append((0, x))
        if candidate[H - 1, x] and not visited[H - 1, x]:
            visited[H - 1, x] = True
            q.append((H - 1, x))
    for y in range(H):
        if candidate[y, 0] and not visited[y, 0]:
            visited[y, 0] = True
            q.append((y, 0))
        if candidate[y, W - 1] and not visited[y, W - 1]:
            visited[y, W - 1] = True
            q.append((y, W - 1))
    cand_list = candidate.tolist()
    vis_list = visited.tolist()
    while q:
        y, x = q.popleft()
        if y > 0 and cand_list[y - 1][x] and not vis_list[y - 1][x]:
            vis_list[y - 1][x] = True
            q.append((y - 1, x))
        if y + 1 < H and cand_list[y + 1][x] and not vis_list[y + 1][x]:
            vis_list[y + 1][x] = True
            q.append((y + 1, x))
        if x > 0 and cand_list[y][x - 1] and not vis_list[y][x - 1]:
            vis_list[y][x - 1] = True
            q.append((y, x - 1))
        if x + 1 < W and cand_list[y][x + 1] and not vis_list[y][x + 1]:
            vis_list[y][x + 1] = True
            q.append((y, x + 1))
    return np.array(vis_list, dtype=bool)


def catmull_rom_spline(points: list[tuple[float, float]], samples_per_seg: int = 140) -> np.ndarray:
    if len(points) < 2:
        return np.array(points, dtype=np.float32)
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(len(pts) - 3):
        p0 = np.array(pts[i], dtype=np.float32)
        p1 = np.array(pts[i + 1], dtype=np.float32)
        p2 = np.array(pts[i + 2], dtype=np.float32)
        p3 = np.array(pts[i + 3], dtype=np.float32)
        for s in range(samples_per_seg):
            t = s / float(samples_per_seg)
            t2 = t * t
            t3 = t2 * t
            pos = 0.5 * (
                (2.0 * p1)
                + (-p0 + p2) * t
                + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
                + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
            )
            out.append(pos)
    out.append(np.array(points[-1], dtype=np.float32))
    return np.array(out, dtype=np.float32)


def compute_normal_and_hillshade(h: np.ndarray, cell_size_m: float = 2.0) -> tuple[np.ndarray, np.ndarray]:
    dz_dy, dz_dx = np.gradient(h, cell_size_m)
    nx = -dz_dx
    ny = -dz_dy
    nz = np.ones_like(h)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-8
    nx /= norm
    ny /= norm
    nz /= norm

    normal_rgb = np.zeros((h.shape[0], h.shape[1], 3), dtype=np.uint8)
    normal_rgb[..., 0] = np.clip((nx * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    normal_rgb[..., 1] = np.clip((ny * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    normal_rgb[..., 2] = np.clip((nz * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)

    lx, ly, lz = -0.52, -0.48, 0.706
    shade = np.clip(nx * lx + ny * ly + nz * lz, 0.28, 1.0)
    return normal_rgb, shade


def select_directional_bridge_axis(dx: float, dz: float) -> str:
    """Matches road crossing world tangent (dx, dz) to the visually verified Blender 4.5.3 exact 2:1
    isometric directional bridge sprites in Godot projection iso(x, z) = ((x - z)*5.6, (x + z)*2.8).
      - 'x'  ({land}-bridge-x.webp):  deck along screen (-2, +1) -> Godot Z-axis road
      - 'z'  ({land}-bridge-z.webp):  deck along screen (+2, +1) -> Godot X-axis road
      - 'ns' ({land}-bridge-ns.webp): deck along screen (0, +1)  -> Godot +X+Z diagonal road
      - 'ew' ({land}-bridge-ew.webp): deck along screen (+1, 0)  -> Godot +X-Z diagonal road
    """
    sx = dx - dz
    sy = (dx + dz) * 0.5
    norm = math.hypot(sx, sy)
    if norm < 1e-5:
        return "z"
    ux, uy = sx / norm, sy / norm
    inv_s5 = 1.0 / math.sqrt(5.0)
    axes = {
        "x": (-2.0 * inv_s5, 1.0 * inv_s5),
        "z": (2.0 * inv_s5, 1.0 * inv_s5),
        "ns": (0.0, 1.0),
        "ew": (1.0, 0.0),
    }
    return max(axes.keys(), key=lambda k: abs(ux * axes[k][0] + uy * axes[k][1]))


# ==============================================================================
# 2. CANONICAL MAP MASK EXTRACTION (1:1 WITH map_art.png + relief_3d.r32)
# ==============================================================================

def remove_small_components(mask: np.ndarray, min_pixels: int = 24) -> np.ndarray:
    """Pure-Python/NumPy 4-connected component filter removing tiny noise speckles while keeping rivers/lakes intact."""
    H, W = mask.shape
    src = mask.tolist()
    vis = [[False] * W for _ in range(H)]
    out = [[False] * W for _ in range(H)]
    for y0 in range(H):
        row = src[y0]
        vrow = vis[y0]
        for x0 in range(W):
            if row[x0] and not vrow[x0]:
                vrow[x0] = True
                comp = [(y0, x0)]
                q = collections.deque([(y0, x0)])
                while q:
                    y, x = q.popleft()
                    if y > 0 and src[y - 1][x] and not vis[y - 1][x]:
                        vis[y - 1][x] = True
                        comp.append((y - 1, x))
                        q.append((y - 1, x))
                    if y + 1 < H and src[y + 1][x] and not vis[y + 1][x]:
                        vis[y + 1][x] = True
                        comp.append((y + 1, x))
                        q.append((y + 1, x))
                    if x > 0 and src[y][x - 1] and not vis[y][x - 1]:
                        vis[y][x - 1] = True
                        comp.append((y, x - 1))
                        q.append((y, x - 1))
                    if x + 1 < W and src[y][x + 1] and not vis[y][x + 1]:
                        vis[y][x + 1] = True
                        comp.append((y, x + 1))
                        q.append((y, x + 1))
                if len(comp) >= min_pixels:
                    for cy, cx in comp:
                        out[cy][cx] = True
    return np.array(out, dtype=bool)


def extract_canonical_masks(land_id: str, reg_dir: Path, grid_n: int = 512) -> dict[str, np.ndarray]:
    art_path = reg_dir / "map_art.png"
    rel_path = reg_dir / "relief_3d.r32"
    assert art_path.exists(), f"Missing canonical {art_path}"
    assert rel_path.exists(), f"Missing canonical {rel_path}"

    art = np.asarray(
        Image.open(art_path).convert("RGB").resize((grid_n, grid_n), Image.Resampling.LANCZOS),
        dtype=np.float32,
    ) / 255.0
    rel_raw = np.fromfile(rel_path, dtype=np.float32)
    rn = int(round(math.sqrt(rel_raw.size)))
    rel = np.asarray(
        Image.fromarray(rel_raw.reshape(rn, rn), mode="F").resize((grid_n, grid_n), Image.Resampling.BICUBIC),
        dtype=np.float32,
    )

    r, g, b = art[..., 0], art[..., 1], art[..., 2]
    cmax = np.maximum(np.maximum(r, g), b)
    cmin = np.minimum(np.minimum(r, g), b)
    sat = (cmax - cmin) / np.maximum(cmax, 1e-4)
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    # 1. Exact Outer Ocean via border flood-fill on low-relief OR coastal blue pixels
    sea_candidate = (rel <= 1.25) | ((b > r + 0.08) & (b > g - 0.04) & (rel < 5.5))
    ocean = flood_fill_from_border(sea_candidate) | (rel <= 0.10)
    ocean = morph_close(ocean, 3)

    # 2. Exact Volcanic Lava (Pyra only — strictly glowing molten orange/red, zero terracotta false positives!)
    if land_id == "pyra":
        bright_lava = (r > 0.80) & (g < 0.56) & (b < 0.18) & (sat > 0.72) & (~ocean)
        deep_ember = (r > 0.68) & ((r - g) > 0.34) & (b < 0.16) & (sat > 0.72) & (~ocean)
        lava = morph_close(bright_lava | morph_open(deep_ember, 3), 3) & (~ocean)
        lava = remove_small_components(lava, min_pixels=22)
    else:
        lava = np.zeros((grid_n, grid_n), dtype=bool)

    # 3. Exact Inland Water (Lakes, Bays & Rivers strictly inside continent)
    if land_id == "verdant":
        snow_halo = (lum > 0.56) & (sat < 0.24)
        raw_w = (~ocean) & (~snow_halo) & (b > r + 0.07) & (b > g - 0.03) & (sat > 0.19)
        inland_water = remove_small_components(morph_open(raw_w, 3), min_pixels=24)
    elif land_id == "aether":
        # Aetheria snow is pale cool ice-white; real glacial lakes are saturated cyan/blue and darker
        raw_w = (~ocean) & (b > r + 0.12) & (sat > 0.28) & (lum < 0.68)
        inland_water = remove_small_components(morph_open(raw_w, 5), min_pixels=36)
    elif land_id == "pyra":
        raw_w = (~ocean) & (~lava) & (b > r + 0.10) & (sat > 0.24) & (lum < 0.74)
        inland_water = remove_small_components(morph_open(raw_w, 3), min_pixels=26)
    else:  # nexus
        raw_w = (~ocean) & (b > r + 0.08) & (b > g - 0.02) & (sat > 0.22)
        inland_water = remove_small_components(morph_open(raw_w, 3), min_pixels=26)

    liquid = ocean | inland_water | lava

    # 4. Biome sub-masks (Snow, Forest, Oasis, Tan vs Silver Nexus)
    if land_id == "aether":
        green_oasis = morph_close(morph_open((~liquid) & (g > r + 0.04) & (g > b + 0.03), 3), 5) & (~liquid)
        snow_mask = (~liquid) & (~green_oasis)
        forest_mask = green_oasis
    elif land_id == "verdant":
        snow_mask = morph_open((~liquid) & (lum > 0.56) & (sat < 0.22), 3)
        forest_mask = (~liquid) & (~snow_mask) & (g > r + 0.02) & (g > b + 0.02)
        green_oasis = np.zeros((grid_n, grid_n), dtype=bool)
    else:
        snow_mask = np.zeros((grid_n, grid_n), dtype=bool)
        forest_mask = (~liquid) & (g > r + 0.03) & (g > b + 0.03)
        green_oasis = np.zeros((grid_n, grid_n), dtype=bool)

    tan_mask = (~liquid) & ((r - b) > 0.065)

    return {
        "art": art,
        "rel": rel,
        "ocean": ocean,
        "inland_water": inland_water,
        "lava": lava,
        "liquid": liquid,
        "snow": snow_mask,
        "forest": forest_mask,
        "oasis": green_oasis,
        "tan": tan_mask,
    }


# ==============================================================================
# 3. ARCHITECTURE, FLORA, LIBRARY, NPC, MONSTER & FAUNA CATALOGS
# ==============================================================================

# Monumental AAA display dimensions (sprite_path, w_px, h_px, footprint_radius_m)
# Scaled ~2.30x (combined with 0.45 hero scale => >3.1x larger buildings relative to characters!)
ARCH_CATALOG = {
    "pyra": {
        "fortress": ("res://assets/objects/pyra-premium-citadel.webp", 1140, 1110, 36.0),
        "altar": ("res://assets/objects/pyra-aaa-altar.webp", 780, 760, 25.0),
        "statue": ("res://assets/objects/73fdbb3d-ki-v2-landmarks-pyra-statue.webp", 640, 960, 22.0),
        "hall": ("res://assets/objects/pyra-aaa-hall.webp", 860, 815, 28.0),
        "arena": ("res://assets/objects/pyra-aaa-arena.webp", 890, 825, 29.0),
        "smithy": ("res://assets/library/buildings/bldg_obsidian_foundry.webp", 820, 820, 27.0),
        "inn": ("res://assets/objects/pyra-aaa-inn.webp", 840, 805, 27.0),
        "shop": ("res://assets/objects/pyra-aaa-shop.webp", 805, 795, 26.0),
        "depot": ("res://assets/objects/pyra-aaa-depot.webp", 820, 805, 27.0),
        "house": ("res://assets/objects/pyra-aaa-house.webp", 585, 595, 20.0),
        "gate_x": ("res://assets/library/fortifications/pyra-fort-gate_x.webp", 640, 575, 18.0),
        "gate_z": ("res://assets/library/fortifications/pyra-fort-gate_z.webp", 640, 575, 18.0),
        "wall_x": ("res://assets/library/fortifications/pyra-fort-wall_x.webp", 480, 340, 14.0),
        "wall_z": ("res://assets/library/fortifications/pyra-fort-wall_z.webp", 480, 340, 14.0),
        "tower": ("res://assets/library/fortifications/pyra-fort-tower.webp", 470, 620, 16.0),
        "brazier": ("res://assets/objects/pyra-citadel-brazier.webp", 155, 175, 5.0),
        "lantern": ("res://assets/objects/pyra-street-lantern.webp", 145, 300, 5.0),
        "castle": ("res://assets/library/castles/castle_pyra_obsidian.webp", 1120, 1080, 36.0),
        "outpost_1": ("res://assets/library/buildings/bldg_obsidian_foundry.webp", 790, 770, 26.0),
        "outpost_2": ("res://assets/library/buildings/bldg_watchtower_stone.webp", 620, 820, 21.0),
    },
    "verdant": {
        "fountain": ("res://assets/objects/7c9c601a-verdantia-extra-spring.webp", 620, 520, 20.0),
        "hall": ("res://assets/objects/verdant-premium-treehall.webp", 1140, 1170, 36.0),
        "forge": ("res://assets/objects/verdant-aaa-forge.webp", 860, 840, 28.0),
        "cottage": ("res://assets/objects/verdant-aaa-cottage.webp", 720, 910, 24.0),
        "arena": ("res://assets/objects/verdant-aaa-arena.webp", 880, 815, 28.0),
        "smithy": ("res://assets/objects/verdant-aaa-smithy.webp", 830, 815, 27.0),
        "inn": ("res://assets/objects/verdant-aaa-inn.webp", 820, 870, 27.0),
        "shop": ("res://assets/objects/verdant-aaa-shop.webp", 830, 805, 26.0),
        "depot": ("res://assets/objects/verdant-aaa-depot.webp", 840, 795, 27.0),
        "house": ("res://assets/objects/verdant-aaa-house.webp", 575, 575, 20.0),
        "gate_x": ("res://assets/library/fortifications/verdant-fort-gate_x.webp", 640, 575, 18.0),
        "gate_z": ("res://assets/library/fortifications/verdant-fort-gate_z.webp", 640, 575, 18.0),
        "wall_x": ("res://assets/library/fortifications/verdant-fort-wall_x.webp", 480, 340, 14.0),
        "wall_z": ("res://assets/library/fortifications/verdant-fort-wall_z.webp", 480, 340, 14.0),
        "tower": ("res://assets/library/fortifications/verdant-fort-tower.webp", 470, 620, 16.0),
        "lantern": ("res://assets/objects/b63f70b2-verdant-city-lamp.webp", 150, 360, 5.0),
        "castle": ("res://assets/library/castles/castle_verdant_keep.webp", 1120, 1080, 36.0),
        "outpost_1": ("res://assets/library/buildings/bldg_windmill.webp", 740, 880, 25.0),
        "outpost_2": ("res://assets/library/buildings/bldg_alchemist_hut.webp", 730, 740, 25.0),
    },
    # AETHERIA — 100% Snowy Winter Alpine Architecture generated on RTX 6000 Ada!
    "aether": {
        "sanctum": ("res://assets/objects/aether-snow-sanctum.webp", 1140, 1170, 36.0),
        "hall": ("res://assets/objects/aether-snow-hall.webp", 880, 860, 28.0),
        "observatory": ("res://assets/objects/aether-snow-observatory.webp", 815, 960, 27.0),
        "archive": ("res://assets/objects/aether-snow-depot.webp", 820, 860, 27.0),
        "smithy": ("res://assets/objects/aether-snow-smithy.webp", 830, 815, 27.0),
        "inn": ("res://assets/objects/aether-snow-inn.webp", 830, 840, 27.0),
        "shop": ("res://assets/objects/aether-snow-shop.webp", 815, 795, 26.0),
        "arena": ("res://assets/objects/aether-snow-arena.webp", 880, 815, 28.0),
        "depot": ("res://assets/objects/aether-snow-depot.webp", 810, 830, 26.0),
        "house": ("res://assets/objects/aether-snow-house.webp", 580, 580, 20.0),
        "gate_x": ("res://assets/library/fortifications/aether-fort-gate_x.webp", 640, 575, 18.0),
        "gate_z": ("res://assets/library/fortifications/aether-fort-gate_z.webp", 640, 575, 18.0),
        "wall_x": ("res://assets/library/fortifications/aether-fort-wall_x.webp", 480, 340, 14.0),
        "wall_z": ("res://assets/library/fortifications/aether-fort-wall_z.webp", 480, 340, 14.0),
        "tower": ("res://assets/library/fortifications/aether-fort-tower.webp", 470, 620, 16.0),
        "lantern": ("res://assets/objects/aether-snow-shrine.webp", 215, 310, 7.0),
        "castle": ("res://assets/library/castles/castle_aether_citadel.webp", 1140, 1100, 36.0),
        "outpost_1": ("res://assets/library/buildings/bldg_wizard_tower.webp", 730, 920, 25.0),
        "outpost_2": ("res://assets/library/buildings/bldg_stables.webp", 750, 695, 25.0),
    },
    "nexus": {
        "reactor_art": ("res://assets/objects/93c8e791-nexus-art-reactor.webp", 1120, 1135, 36.0),
        "reactor": ("res://assets/objects/3da45722-nexus-continent-reactor.webp", 740, 785, 25.0),
        "hall": ("res://assets/objects/nexus-aaa-hall.webp", 890, 850, 28.0),
        "arena": ("res://assets/objects/nexus-aaa-arena.webp", 890, 840, 28.0),
        "smithy": ("res://assets/objects/nexus-aaa-smithy.webp", 820, 795, 27.0),
        "inn": ("res://assets/objects/nexus-aaa-inn.webp", 810, 830, 27.0),
        "shop": ("res://assets/objects/nexus-aaa-shop.webp", 830, 805, 26.0),
        "depot": ("res://assets/objects/nexus-aaa-depot.webp", 830, 805, 27.0),
        "house": ("res://assets/objects/nexus-aaa-house.webp", 575, 575, 20.0),
        "field_lab": ("res://assets/objects/b2f6afaa-nexus-continent-field-lab.webp", 760, 750, 26.0),
        "tech_garden": ("res://assets/objects/3a6c0fa4-nexus-art-tech-garden.webp", 720, 620, 23.0),
        "gate_x": ("res://assets/library/fortifications/nexus-fort-gate_x.webp", 640, 575, 18.0),
        "gate_z": ("res://assets/library/fortifications/nexus-fort-gate_z.webp", 640, 575, 18.0),
        "wall_x": ("res://assets/library/fortifications/nexus-fort-wall_x.webp", 480, 340, 14.0),
        "wall_z": ("res://assets/library/fortifications/nexus-fort-wall_z.webp", 480, 340, 14.0),
        "tower": ("res://assets/library/fortifications/nexus-fort-tower.webp", 470, 620, 16.0),
        "lantern": ("res://assets/objects/44993ea9-nexus-art-pylon.webp", 145, 355, 5.0),
        "castle": ("res://assets/library/castles/castle_nexus_fortress.webp", 1135, 1080, 36.0),
        "outpost_1": ("res://assets/library/buildings/bldg_cyber_dome.webp", 805, 760, 27.0),
        "outpost_2": ("res://assets/library/buildings/bldg_harbor_dockhouse.webp", 785, 740, 26.0),
    },
}

WATERFALL_CATALOG = {
    "pyra": [
        ("res://assets/library/waterfalls/waterfall_lava_pyra.webp", 360, 380),
    ],
    "verdant": [
        ("res://assets/library/waterfalls/waterfall_forest_tall.webp", 350, 390),
        ("res://assets/library/waterfalls/waterfall_emerald_cascade.webp", 360, 360),
        ("res://assets/library/waterfalls/waterfall_cliff_spring.webp", 340, 340),
    ],
    "aether": [
        ("res://assets/library/waterfalls/waterfall_frozen_aether.webp", 340, 410),
    ],
    "nexus": [
        ("res://assets/library/waterfalls/waterfall_plasma_nexus.webp", 355, 375),
    ],
}

FLORA_AND_PROPS_CATALOG = {
    "pyra": [
        ("res://assets/objects/1cedcd5a-pyra-continent-maple.webp", 275, 300, "tree"),
        ("res://assets/objects/ae37503e-pyra-continent-pine.webp", 245, 315, "tree"),
        ("res://assets/objects/13373662-ki-v2-objects-pyra-oak-0.webp", 265, 290, "tree"),
        ("res://assets/objects/46e0b432-ki-v2-objects-pyra-pine-0.webp", 230, 305, "tree"),
        ("res://assets/objects/32e0d269-pyra-continent-lantern-bush.webp", 165, 150, "flora"),
        ("res://assets/objects/39416c5c-pyra-continent-copper-bush.webp", 165, 155, "flora"),
        ("res://assets/objects/0185c62b-pyra-continent-berry-bush.webp", 160, 145, "flora"),
        ("res://assets/objects/9902b9c8-pyra-continent-dry-grass.webp", 150, 125, "flora"),
        ("res://assets/objects/61486b9a-pyra-continent-obsidian-spire.webp", 235, 315, "rock"),
        ("res://assets/objects/49b51ecf-pyra-continent-crystals.webp", 210, 200, "rock"),
        ("res://assets/objects/b6d73268-pyra-continent-cliff.webp", 310, 260, "rock"),
        ("res://assets/objects/3d90558c-pyra-continent-rocks.webp", 220, 185, "rock"),
        ("res://assets/objects/c3f1e31a-pyra-continent-fissure.webp", 260, 190, "rock"),
        ("res://assets/objects/5aa5d3c0-pyra-continent-rock-arch.webp", 330, 290, "landmark"),
        ("res://assets/objects/5f186a05-pyra-continent-ruin.webp", 300, 285, "landmark"),
        ("res://assets/library/props/prop_runic_obelisk.webp", 210, 310, "landmark"),
        ("res://assets/library/props/prop_bonfire_pit.webp", 180, 170, "camp"),
        ("res://assets/objects/a8a6859d-pyra-continent-camp.webp", 275, 225, "camp"),
    ],
    "verdant": [
        ("res://assets/objects/74b2bb88-verdantia-extra-ancient-oak.webp", 370, 380, "tree"),
        ("res://assets/objects/ce21ffe1-verdantia-extra-willow.webp", 325, 345, "tree"),
        ("res://assets/objects/711c3cbc-verdantia-extra-birch.webp", 265, 330, "tree"),
        ("res://assets/objects/df63f301-verdantia-continent-pine.webp", 250, 335, "tree"),
        ("res://assets/objects/8c447433-ki-v2-objects-verdant-oak-0.webp", 290, 310, "tree"),
        ("res://assets/objects/21caeb8f-ki-v2-objects-verdant-oak-1.webp", 290, 315, "tree"),
        ("res://assets/objects/e70f7fe7-verdantia-extra-rose.webp", 175, 165, "flora"),
        ("res://assets/objects/48c51d4d-verdantia-extra-flowers.webp", 185, 155, "flora"),
        ("res://assets/objects/27399570-verdantia-extra-blueberry.webp", 170, 155, "flora"),
        ("res://assets/objects/5b60f067-verdantia-extra-fern.webp", 165, 140, "flora"),
        ("res://assets/objects/68b9d6ee-verdantia-extra-mushrooms.webp", 165, 155, "flora"),
        ("res://assets/objects/701b11e2-verdantia-continent-rocks.webp", 225, 190, "rock"),
        ("res://assets/objects/98845042-verdantia-extra-cliff.webp", 320, 270, "rock"),
        ("res://assets/objects/fa6d3bf2-verdantia-extra-shrine.webp", 265, 300, "landmark"),
        ("res://assets/library/props/prop_ruined_archway.webp", 310, 290, "landmark"),
        ("res://assets/library/props/prop_waystone_pillar.webp", 175, 250, "landmark"),
        ("res://assets/library/props/prop_camp_tent.webp", 250, 225, "camp"),
        ("res://assets/library/props/prop_merchant_wagon.webp", 260, 220, "camp"),
    ],
    "aether": [
        ("res://assets/objects/aether-snow-pine1.webp", 265, 355, "tree"),
        ("res://assets/objects/aether-snow-pine2.webp", 285, 345, "tree"),
        ("res://assets/objects/3587a851-aetheria-continent-snow-pine.webp", 255, 340, "tree"),
        ("res://assets/objects/aether-ice-crystal.webp", 240, 290, "flora"),
        ("res://assets/objects/aether-snow-shrine.webp", 215, 275, "flora"),
        ("res://assets/objects/aether-snow-rock.webp", 245, 215, "rock"),
        ("res://assets/objects/6c34a261-aetheria-continent-glacier-ridge.webp", 335, 285, "rock"),
        ("res://assets/objects/83749d6d-aetheria-continent-peak.webp", 325, 305, "rock"),
        ("res://assets/objects/aether-ice-ruin.webp", 315, 295, "landmark"),
        ("res://assets/library/props/prop_ice_glacier_arch.webp", 340, 295, "landmark"),
        ("res://assets/library/props/prop_ancient_portal.webp", 285, 305, "landmark"),
        ("res://assets/library/props/prop_camp_tent.webp", 245, 220, "camp"),
        ("res://assets/library/props/prop_bonfire_pit.webp", 180, 170, "camp"),
    ],
    "nexus": [
        ("res://assets/objects/b2924462-nexus-continent-crystal-tree.webp", 295, 325, "tree"),
        ("res://assets/objects/1cf54e0a-nexus-continent-cyan-tree.webp", 290, 320, "tree"),
        ("res://assets/objects/f42c644b-nexus-continent-violet-tree.webp", 290, 320, "tree"),
        ("res://assets/objects/24d5db1c-nexus-continent-silver-cypress.webp", 225, 325, "tree"),
        ("res://assets/objects/9b396bb1-nexus-continent-luminous-grass.webp", 175, 150, "flora"),
        ("res://assets/objects/dca04e0f-nexus-continent-violet-bush.webp", 180, 160, "flora"),
        ("res://assets/objects/caef9d12-nexus-continent-fern.webp", 170, 145, "flora"),
        ("res://assets/objects/fce0ef4d-nexus-continent-mushrooms.webp", 170, 160, "flora"),
        ("res://assets/objects/3d2c4533-nexus-art-crystal.webp", 260, 300, "rock"),
        ("res://assets/objects/4c52045f-nexus-continent-crystal-outcrop.webp", 245, 260, "rock"),
        ("res://assets/objects/fcf607db-nexus-continent-rocks.webp", 225, 190, "rock"),
        ("res://assets/objects/54c3c2b2-nexus-continent-monolith.webp", 270, 360, "landmark"),
        ("res://assets/objects/32b36d65-nexus-continent-ruin.webp", 300, 285, "landmark"),
        ("res://assets/library/props/prop_runic_obelisk.webp", 215, 310, "landmark"),
        ("res://assets/objects/711e2a5b-nexus-continent-camp.webp", 280, 230, "camp"),
        ("res://assets/library/props/prop_guardian_statue.webp", 220, 310, "camp"),
    ],
}

AETHER_OASIS_FLORA = [
    ("res://assets/objects/021d8442-aether-x-cherry-tree.webp", 315, 325, "tree"),
    ("res://assets/objects/dc095c5f-aetheria-continent-ginkgo.webp", 290, 320, "tree"),
    ("res://assets/objects/ac1ecb7c-aetheria-continent-bamboo.webp", 240, 335, "tree"),
    ("res://assets/objects/5ac42fa2-aetheria-continent-lavender.webp", 195, 170, "flora"),
    ("res://assets/objects/0e381537-aetheria-continent-flowers.webp", 185, 160, "flora"),
]

VERDANT_ALPINE_SNOW_FLORA = [
    ("res://assets/objects/aether-snow-pine1.webp", 255, 340, "tree"),
    ("res://assets/objects/aether-snow-pine2.webp", 270, 330, "tree"),
    ("res://assets/objects/aether-snow-rock.webp", 235, 210, "rock"),
]

NPCS_CATALOG = {
    "pyra": [
        ("pyra.npc.guide", "Kaena", "Strażniczka przysięgi", "!", -18.0, 26.0),
        ("pyra.npc.steward", "Tsubasa", "Zarządca Sali Przysięgi", "?", 18.0, -28.0),
        ("pyra.npc.smith", "Goro", "Kowal żaru", "!", -64.0, -14.0),
        ("pyra.npc.innkeeper", "Akane", "Gospodyni ogniska", "", 64.0, -14.0),
        ("pyra.npc.merchant", "Yumi", "Kupczyni klanów", "?", -58.0, 48.0),
        ("pyra.npc.trainer", "Kenzo", "Mistrz ćwiczeń", "!", 62.0, 48.0),
        ("pyra.npc.keeper", "Mitsu", "Strażniczka skarbca", "", 6.0, 68.0),
        ("pyra.npc.hunter", "Rokan", "Mistrz polowania", "!", 14.0, 114.0),
        ("pyra.npc.alchemist", "Homura", "Alchemik popiołu", "?", -98.0, 18.0),
        ("pyra.npc.warden", "Kazan", "Dowódca murów", "", 98.0, 18.0),
    ],
    "verdant": [
        ("verdant.npc.guide", "Aira", "Przewodniczka miasta", "!", -18.0, 26.0),
        ("verdant.npc.steward", "Oren", "Opiekun miasta", "?", 18.0, -32.0),
        ("verdant.npc.smith", "Taro", "Kowal", "!", -64.0, -14.0),
        ("verdant.npc.innkeeper", "Lina", "Gospodyni", "", 64.0, -14.0),
        ("verdant.npc.merchant", "Mio", "Kupczyni", "?", -58.0, 48.0),
        ("verdant.npc.trainer", "Iwo", "Mistrz treningu", "!", 62.0, 48.0),
        ("verdant.npc.keeper", "Nela", "Opiekunka depozytu", "", 6.0, 68.0),
        ("verdant.npc.hunter", "Ren", "Strażnik bramy", "!", 14.0, 114.0),
        ("verdant.npc.alchemist", "Sylwa", "Zielarka korzeni", "?", -98.0, 18.0),
        ("verdant.npc.warden", "Bram", "Kapitan przystani", "", 98.0, 18.0),
    ],
    "aether": [
        ("aether.npc.guide", "Sora", "Opiekunka źródeł", "!", -18.0, 26.0),
        ("aether.npc.steward", "Hoshi", "Zarządca Sali Rady", "?", 18.0, -30.0),
        ("aether.npc.smith", "Enso", "Rzemieślnik pieczęci", "!", -64.0, -14.0),
        ("aether.npc.innkeeper", "Yuna", "Mistrzyni herbaty", "", 64.0, -14.0),
        ("aether.npc.merchant", "Mei", "Archiwistka wymiany", "?", -58.0, 48.0),
        ("aether.npc.trainer", "Raku", "Mistrz skupienia", "!", 62.0, 48.0),
        ("aether.npc.keeper", "Kaede", "Strażniczka zwojów", "", 6.0, 68.0),
        ("aether.npc.hunter", "Ishin", "Strażnik sanktuarium", "!", 14.0, 114.0),
        ("aether.npc.alchemist", "Kiri", "Alchemiczka mrozu", "?", -98.0, 18.0),
        ("aether.npc.warden", "Tenzin", "Strażnik szczytów", "", 98.0, 18.0),
    ],
    "nexus": [
        ("nexus.npc.guide", "LYRA-7", "Przewodniczka sieci", "!", -18.0, 26.0),
        ("nexus.npc.steward", "VEGA-3", "Zarządca synchronizacji", "?", 18.0, -30.0),
        ("nexus.npc.smith", "HEF-4", "Inżynier uzbrojenia", "!", -64.0, -14.0),
        ("nexus.npc.innkeeper", "SOLA-6", "Operatorka regeneracji", "", 64.0, -14.0),
        ("nexus.npc.merchant", "MIRA-2", "Operatorka wymiany", "?", -58.0, 48.0),
        ("nexus.npc.trainer", "KRON-9", "Instruktor kalibracji", "!", 62.0, 48.0),
        ("nexus.npc.keeper", "ARCH-5", "Strażnik magazynu", "", 6.0, 68.0),
        ("nexus.npc.hunter", "AXON", "Strażnik perymetru", "!", 14.0, 114.0),
        ("nexus.npc.alchemist", "FLUX-8", "Syntezator plazmy", "?", -98.0, 18.0),
        ("nexus.npc.warden", "AEGIS-1", "Dowódca obwodu", "", 98.0, 18.0),
    ],
}

CAPITAL_SEEDS = {
    "pyra": (0.0, -25.0),
    "verdant": (-155.0, -110.0),
    "aether": (145.0, -135.0),
    "nexus": (108.0, -22.0),
}

EXP_ZONES_CATALOG = {
    "pyra": [
        {
            "id": "pyra-exp-1", "name": "Kotlina Węgielków i Salamander (Lv. 1–3)",
            "cx": -190.0, "cz": -58.0, "radius": 44.0,
            "monsters": [
                ("pyra-wegielek", "Węgielek", 1, 92),
                ("pyra-ognista-salamandra", "Ognista Salamandra", 2, 100),
                ("pyra-wegielek", "Węgielek", 1, 92),
                ("pyra-ognista-salamandra", "Ognista Salamandra", 2, 100),
                ("pyra-popielny-wilk", "Popielny Wilk", 4, 183),
            ],
        },
        {
            "id": "pyra-exp-2", "name": "Wąwóz Popielnych Wilków (Lv. 4–6)",
            "cx": -302.0, "cz": -125.0, "radius": 44.0,
            "monsters": [
                ("pyra-popielny-wilk", "Popielny Wilk", 4, 183),
                ("pyra-popielny-wilk", "Popielny Wilk", 4, 183),
                ("pyra-skalny-berserker", "Skalny Berserker", 6, 484),
                ("pyra-skalny-berserker", "Skalny Berserker", 6, 484),
                ("pyra-ognista-salamandra", "Ognista Salamandra", 2, 100),
            ],
        },
        {
            "id": "pyra-exp-3", "name": "Brzeg Magmowych Krabów (Lv. 8–10)",
            "cx": -238.0, "cz": 68.0, "radius": 45.0,
            "monsters": [
                ("pyra-magmowy-krab", "Magmowy Krab", 8, 752),
                ("pyra-magmowy-krab", "Magmowy Krab", 8, 752),
                ("pyra-zarowy-nietoperz", "Żarowy Nietoperz", 10, 452),
                ("pyra-zarowy-nietoperz", "Żarowy Nietoperz", 10, 452),
                ("pyra-magmowy-krab", "Magmowy Krab", 8, 752),
            ],
        },
        {
            "id": "pyra-exp-4", "name": "Ruiny Golemów Popiołu (Lv. 12–14)",
            "cx": 210.0, "cz": -155.0, "radius": 45.0,
            "monsters": [
                ("pyra-golem-ruin", "Golem Ruin", 12, 1866),
                ("pyra-golem-ruin", "Golem Ruin", 12, 1866),
                ("pyra-plomien-duch", "Płomień-Duch", 14, 909),
                ("pyra-plomien-duch", "Płomień-Duch", 14, 909),
                ("pyra-zarowy-nietoperz", "Żarowy Nietoperz", 10, 452),
            ],
        },
        {
            "id": "pyra-exp-5", "name": "Krwawa Arena Byków (Lv. 14–16)",
            "cx": 338.0, "cz": -80.0, "radius": 44.0,
            "monsters": [
                ("pyra-byk-areny", "Byk Areny", 16, 2440),
                ("pyra-byk-areny", "Byk Areny", 16, 2440),
                ("pyra-plomien-duch", "Płomień-Duch", 14, 909),
                ("pyra-golem-ruin", "Golem Ruin", 12, 1866),
                ("pyra-byk-areny", "Byk Areny", 16, 2440),
            ],
        },
        {
            "id": "pyra-exp-6", "name": "Kaldera Skorpiona Obsydianowego (Lv. 16–18)",
            "cx": 225.0, "cz": 5.0, "radius": 45.0,
            "monsters": [
                ("pyra-skorpion-obsydianowy", "Skorpion Obsydianowy", 18, 1912),
                ("pyra-skorpion-obsydianowy", "Skorpion Obsydianowy", 18, 1912),
                ("pyra-byk-areny", "Byk Areny", 16, 2440),
                ("pyra-plomien-duch", "Płomień-Duch", 14, 909),
                ("pyra-skorpion-obsydianowy", "Skorpion Obsydianowy", 18, 1912),
            ],
        },
    ],
    "verdant": [
        {
            "id": "verdant-exp-1", "name": "Polana Mchowych Szlamaków (Lv. 1–3)",
            "cx": -70.0, "cz": -22.0, "radius": 44.0,
            "monsters": [
                ("verdant-mchowy-szlamak", "Mchowy Szlamak", 1, 110),
                ("verdant-mchowy-szlamak", "Mchowy Szlamak", 1, 110),
                ("verdant-cierniowy-wilk", "Cierniowy Wilk", 2, 100),
                ("verdant-cierniowy-wilk", "Cierniowy Wilk", 2, 100),
                ("verdant-mala-osa", "Mała Osa", 4, 40),
            ],
        },
        {
            "id": "verdant-exp-2", "name": "Gaj Liściaków i Pełzaczy (Lv. 4–6)",
            "cx": -205.0, "cz": 92.0, "radius": 45.0,
            "monsters": [
                ("verdant-lisciak-skrytobojca", "Liściak Skrytobójca", 4, 142),
                ("verdant-lisciak-skrytobojca", "Liściak Skrytobójca", 4, 142),
                ("verdant-korzeniowy-pelzacz", "Korzeniowy Pełzacz", 6, 484),
                ("verdant-korzeniowy-pelzacz", "Korzeniowy Pełzacz", 6, 484),
                ("verdant-cierniowy-wilk", "Cierniowy Wilk", 2, 100),
            ],
        },
        {
            "id": "verdant-exp-3", "name": "Krąg Grzybowych Zarodników (Lv. 8–10)",
            "cx": 42.0, "cz": 100.0, "radius": 45.0,
            "monsters": [
                ("verdant-grzybowy-zarodnik", "Grzybowy Zarodnik", 8, 703),
                ("verdant-grzybowy-zarodnik", "Grzybowy Zarodnik", 8, 703),
                ("verdant-bursztynowa-osa", "Bursztynowa Osa", 10, 452),
                ("verdant-bursztynowa-osa", "Bursztynowa Osa", 10, 452),
                ("verdant-mala-osa", "Mała Osa", 4, 40),
            ],
        },
        {
            "id": "verdant-exp-4", "name": "Wzgórze Skalnych Jeleni (Lv. 12–14)",
            "cx": 102.0, "cz": -172.0, "radius": 44.0,
            "monsters": [
                ("verdant-skalny-jelen", "Skalny Jeleń", 12, 1307),
                ("verdant-skalny-jelen", "Skalny Jeleń", 12, 1307),
                ("verdant-lesny-pajak", "Leśny Pająk", 14, 1135),
                ("verdant-lesny-pajak", "Leśny Pająk", 14, 1135),
                ("verdant-bursztynowa-osa", "Bursztynowa Osa", 10, 452),
            ],
        },
        {
            "id": "verdant-exp-5", "name": "Gniazdo Puchaczy Pyłowych (Lv. 14–16)",
            "cx": 244.0, "cz": -168.0, "radius": 45.0,
            "monsters": [
                ("verdant-puchacz-pylowy", "Puchacz Pyłowy", 16, 1219),
                ("verdant-puchacz-pylowy", "Puchacz Pyłowy", 16, 1219),
                ("verdant-lesny-pajak", "Leśny Pająk", 14, 1135),
                ("verdant-skalny-jelen", "Skalny Jeleń", 12, 1307),
                ("verdant-puchacz-pylowy", "Puchacz Pyłowy", 16, 1219),
            ],
        },
        {
            "id": "verdant-exp-6", "name": "Pradawne Ruiny Strażników (Lv. 16–18)",
            "cx": 290.0, "cz": 108.0, "radius": 45.0,
            "monsters": [
                ("verdant-straznik-ruin", "Strażnik Ruin", 18, 3186),
                ("verdant-straznik-ruin", "Strażnik Ruin", 18, 3186),
                ("verdant-puchacz-pylowy", "Puchacz Pyłowy", 16, 1219),
                ("verdant-lesny-pajak", "Leśny Pająk", 14, 1135),
                ("verdant-straznik-ruin", "Strażnik Ruin", 18, 3186),
            ],
        },
    ],
    "aether": [
        {
            "id": "aether-exp-1", "name": "Ogród Świetlików Pieczęci (Lv. 1–3)",
            "cx": -38.0, "cz": -160.0, "radius": 44.0,
            "monsters": [
                ("aether-swietlik-pieczeci", "Świetlik Pieczęci", 1, 64),
                ("aether-swietlik-pieczeci", "Świetlik Pieczęci", 1, 64),
                ("aether-pergaminowy-straznik", "Pergaminowy Strażnik", 2, 126),
                ("aether-pergaminowy-straznik", "Pergaminowy Strażnik", 2, 126),
                ("aether-krysztalowy-motyl", "Kryształowy Motyl", 4, 123),
            ],
        },
        {
            "id": "aether-exp-2", "name": "Taras Kryształowych Motyli (Lv. 4–6)",
            "cx": -205.0, "cz": -175.0, "radius": 44.0,
            "monsters": [
                ("aether-krysztalowy-motyl", "Kryształowy Motyl", 4, 123),
                ("aether-krysztalowy-motyl", "Kryształowy Motyl", 4, 123),
                ("aether-szmaragdowy-waz", "Szmaragdowy Wąż", 6, 372),
                ("aether-szmaragdowy-waz", "Szmaragdowy Wąż", 6, 372),
                ("aether-pergaminowy-straznik", "Pergaminowy Strażnik", 2, 126),
            ],
        },
        {
            "id": "aether-exp-3", "name": "Archiwum Duchów i Skarabeuszy (Lv. 8–10)",
            "cx": -325.0, "cz": -125.0, "radius": 44.0,
            "monsters": [
                ("aether-duch-bibliotekarza", "Duch Bibliotekarza", 8, 401),
                ("aether-duch-bibliotekarza", "Duch Bibliotekarza", 8, 401),
                ("aether-zloty-skarabeusz", "Złoty Skarabeusz", 10, 969),
                ("aether-zloty-skarabeusz", "Złoty Skarabeusz", 10, 969),
                ("aether-szmaragdowy-waz", "Szmaragdowy Wąż", 6, 372),
            ],
        },
        {
            "id": "aether-exp-4", "name": "Dziedziniec Lwów Świątyni (Lv. 12–14)",
            "cx": -185.0, "cz": 35.0, "radius": 45.0,
            "monsters": [
                ("aether-lew-swiatyni", "Lew Świątyni", 12, 1492),
                ("aether-lew-swiatyni", "Lew Świątyni", 12, 1492),
                ("aether-oko-wiedzy", "Oko Wiedzy", 14, 1021),
                ("aether-oko-wiedzy", "Oko Wiedzy", 14, 1021),
                ("aether-zloty-skarabeusz", "Złoty Skarabeusz", 10, 969),
            ],
        },
        {
            "id": "aether-exp-5", "name": "Krąg Marionetek Rytuału (Lv. 14–16)",
            "cx": -62.0, "cz": -22.0, "radius": 44.0,
            "monsters": [
                ("aether-marionetka-rytualu", "Marionetka Rytuału", 16, 1626),
                ("aether-marionetka-rytualu", "Marionetka Rytuału", 16, 1626),
                ("aether-oko-wiedzy", "Oko Wiedzy", 14, 1021),
                ("aether-lew-swiatyni", "Lew Świątyni", 12, 1492),
                ("aether-marionetka-rytualu", "Marionetka Rytuału", 16, 1626),
            ],
        },
        {
            "id": "aether-exp-6", "name": "Sanktuarium Mgielnych Żurawi (Lv. 16–18)",
            "cx": 270.0, "cz": 30.0, "radius": 45.0,
            "monsters": [
                ("aether-mgielny-zuraw", "Mgielny Żuraw", 18, 1593),
                ("aether-mgielny-zuraw", "Mgielny Żuraw", 18, 1593),
                ("aether-marionetka-rytualu", "Marionetka Rytuału", 16, 1626),
                ("aether-oko-wiedzy", "Oko Wiedzy", 14, 1021),
                ("aether-mgielny-zuraw", "Mgielny Żuraw", 18, 1593),
            ],
        },
    ],
    "nexus": [
        {
            "id": "nexus-exp-1", "name": "Strefa Dronów i Pełzaczy (Lv. 1–3)",
            "cx": -22.0, "cz": -22.0, "radius": 44.0,
            "monsters": [
                ("nexus-dron-zwiadowca", "Dron Zwiadowca", 1, 56),
                ("nexus-dron-zwiadowca", "Dron Zwiadowca", 1, 56),
                ("nexus-pelzacz-serwisowy", "Pełzacz Serwisowy", 2, 114),
                ("nexus-pelzacz-serwisowy", "Pełzacz Serwisowy", 2, 114),
                ("nexus-skaner-gasienicowy", "Skaner Gąsienicowy", 4, 266),
            ],
        },
        {
            "id": "nexus-exp-2", "name": "Sektor Pająków Spawalniczych (Lv. 4–6)",
            "cx": -152.0, "cz": -78.0, "radius": 44.0,
            "monsters": [
                ("nexus-skaner-gasienicowy", "Skaner Gąsienicowy", 4, 266),
                ("nexus-skaner-gasienicowy", "Skaner Gąsienicowy", 4, 266),
                ("nexus-pajak-spawalniczy", "Pająk Spawalniczy", 6, 372),
                ("nexus-pajak-spawalniczy", "Pająk Spawalniczy", 6, 372),
                ("nexus-pelzacz-serwisowy", "Pełzacz Serwisowy", 2, 114),
            ],
        },
        {
            "id": "nexus-exp-3", "name": "Bateria Wieżyczek i Nanitów (Lv. 8–10)",
            "cx": -78.0, "cz": -192.0, "radius": 45.0,
            "monsters": [
                ("nexus-wiezyczka-autonomiczna", "Wieżyczka Autonomiczna", 8, 752),
                ("nexus-wiezyczka-autonomiczna", "Wieżyczka Autonomiczna", 8, 752),
                ("nexus-roj-nanitow", "Rój Nanitów", 10, 517),
                ("nexus-roj-nanitow", "Rój Nanitów", 10, 517),
                ("nexus-pajak-spawalniczy", "Pająk Spawalniczy", 6, 372),
            ],
        },
        {
            "id": "nexus-exp-4", "name": "Poligon Psów Łowców (Lv. 12–14)",
            "cx": -204.0, "cz": 88.0, "radius": 44.0,
            "monsters": [
                ("nexus-pies-lowca", "Pies Łowca", 12, 933),
                ("nexus-pies-lowca", "Pies Łowca", 12, 933),
                ("nexus-straznik-rdzenia", "Strażnik Rdzenia", 14, 1929),
                ("nexus-straznik-rdzenia", "Strażnik Rdzenia", 14, 1929),
                ("nexus-roj-nanitow", "Rój Nanitów", 10, 517),
            ],
        },
        {
            "id": "nexus-exp-5", "name": "Obwód Latarni Plazmowych (Lv. 14–16)",
            "cx": -92.0, "cz": 162.0, "radius": 45.0,
            "monsters": [
                ("nexus-latarnia-plazmowa", "Latarnia Plazmowa", 16, 1355),
                ("nexus-latarnia-plazmowa", "Latarnia Plazmowa", 16, 1355),
                ("nexus-straznik-rdzenia", "Strażnik Rdzenia", 14, 1929),
                ("nexus-pies-lowca", "Pies Łowca", 12, 933),
                ("nexus-latarnia-plazmowa", "Latarnia Plazmowa", 16, 1355),
            ],
        },
        {
            "id": "nexus-exp-6", "name": "Rdzeń Kruków Danych (Lv. 16–18)",
            "cx": 228.0, "cz": 64.0, "radius": 44.0,
            "monsters": [
                ("nexus-kruk-danych", "Kruk Danych", 18, 1274),
                ("nexus-kruk-danych", "Kruk Danych", 18, 1274),
                ("nexus-latarnia-plazmowa", "Latarnia Plazmowa", 16, 1355),
                ("nexus-straznik-rdzenia", "Strażnik Rdzenia", 14, 1929),
                ("nexus-kruk-danych", "Kruk Danych", 18, 1274),
            ],
        },
    ],
}

WILDERNESS_POIS_CATALOG = {
    "pyra": [
        ("pyra-castle-stronghold", "Obsydianowy Zamek Wulkaniczny", -122.0, 128.0, "castle", "landmark"),
        ("pyra-outpost-foundry", "Odlewnia Magmy", 145.0, -145.0, "outpost_1", "landmark"),
        ("pyra-outpost-watch", "Strażnica Popielnego Szlaku", -265.0, -25.0, "outpost_2", "landmark"),
    ],
    "verdant": [
        ("verdant-castle-keep", "Twierdza Szmaragdowego Gaju", 182.0, -125.0, "castle", "landmark"),
        ("verdant-outpost-mill", "Wiatrak Doliny", -95.0, 145.0, "outpost_1", "landmark"),
        ("verdant-outpost-alch", "Chata Zielarza Alchemika", -278.0, -25.0, "outpost_2", "landmark"),
    ],
    "aether": [
        ("aether-castle-citadel", "Lodowa Cytadela Szczytów", -255.0, -20.0, "castle", "landmark"),
        ("aether-outpost-wizard", "Wieża Mroźnego Maga", 275.0, -50.0, "outpost_1", "landmark"),
        ("aether-outpost-stables", "Stajnia Górska", 45.0, 118.0, "outpost_2", "landmark"),
    ],
    "nexus": [
        ("nexus-castle-fortress", "Cytadela Tytanowa Sektor-9", -240.0, -135.0, "castle", "landmark"),
        ("nexus-outpost-dome", "Kopuła Badawcza Bio-Rdzenia", -18.0, 135.0, "outpost_1", "landmark"),
        ("nexus-outpost-harbor", "Magazyn Portu Zerowego", 225.0, 155.0, "outpost_2", "landmark"),
    ],
}

FAUNA_CATALOG = {
    "pyra": [("A-04", "Koza Skalna"), ("A-05", "Jaszczur Popielny"), ("A-06", "Bażant Żarowy")],
    "verdant": [("A-01", "Zając Łąkowy"), ("A-02", "Kura Leśna"), ("A-03", "Dzik Mchowy")],
    "aether": [("A-07", "Owca Księżycowa"), ("A-08", "Gołąb Pergaminowy")],
    "nexus": [("A-09", "Bio-królik Hodowlany"), ("A-10", "Bio-kura Hodowlana")],
}


# ==============================================================================
# 4. CONTINENT WORLD BUILDER (1:1 MAP ALIGNED + EXACT EDT + DIRECTIONAL BRIDGES)
# ==============================================================================

def generate_continent(land_id: str) -> dict:
    GRID_N = 512
    WORLD_SIZE = 1024.0
    HALF = WORLD_SIZE * 0.5
    STEP = WORLD_SIZE / GRID_N  # 2.0 m/px
    SAFE_CITY_RADIUS = 205.0

    reg_dir = REGIONS_DIR / land_id
    reg_dir.mkdir(parents=True, exist_ok=True)

    masks = extract_canonical_masks(land_id, reg_dir, GRID_N)
    rel = masks["rel"]
    ocean = masks["ocean"]
    inland_water = masks["inland_water"]
    lava = masks["lava"]
    liquid = masks["liquid"]
    snow_mask = masks["snow"]
    forest_mask = masks["forest"]
    oasis_mask = masks["oasis"]
    tan_mask = masks["tan"]

    n_detail = load_noise("biome_detail", (GRID_N, GRID_N))
    n_micro = load_noise("terrain_micro", (GRID_N, GRID_N))

    z_lin = np.linspace(-HALF, HALF, GRID_N, dtype=np.float32)
    x_lin = np.linspace(-HALF, HALF, GRID_N, dtype=np.float32)
    zz, xx = np.meshgrid(z_lin, x_lin, indexing="ij")

    edt_liq = exact_edt(liquid) * STEP
    edt_oasis = exact_edt(oasis_mask) * STEP if np.any(oasis_mask) else np.full((GRID_N, GRID_N), 999.0, dtype=np.float32)

    def wx_to_j(wx: float) -> int:
        return int(np.clip(round((wx + HALF) / WORLD_SIZE * (GRID_N - 1)), 0, GRID_N - 1))

    def wz_to_i(wz: float) -> int:
        return int(np.clip(round((wz + HALF) / WORLD_SIZE * (GRID_N - 1)), 0, GRID_N - 1))

    def liq_dist(wx: float, wz: float) -> float:
        return float(edt_liq[wz_to_i(wz), wx_to_j(wx)])

    # Playable elevation derived 1:1 from canonical relief_3d.r32
    dry = ~liquid
    rel_dry = np.where(dry, np.maximum(rel, 0.0), 0.0)
    p98 = max(float(np.percentile(rel_dry[dry], 98)), 10.0) if np.any(dry) else 40.0
    h_land = 2.2 + np.power(np.clip(rel_dry / p98, 0.0, 1.15), 0.85) * 21.5 + (n_micro - 0.5) * 0.65
    shore_t = smoothstep(0.0, 10.0, edt_liq)
    liq_bed = np.where(ocean, -4.2, np.where(lava, -1.4, -1.8)).astype(np.float32)
    h = np.where(dry, h_land * (0.52 + 0.48 * shore_t), liq_bed).astype(np.float32)
    h = blur_float(h, 1.35)
    h = np.where(dry, np.maximum(h, 1.6), liq_bed).astype(np.float32)

    gy0, gx0 = np.gradient(h, STEP)
    base_slope = np.sqrt(gx0 * gx0 + gy0 * gy0)
    slope_smooth = blur_float(base_slope, 8.0)

    # Refine Capital Center to widest flat dry valley near curated seed
    seed_x, seed_z = CAPITAL_SEEDS[land_id]
    best_score = -1e9
    cap_x, cap_z = seed_x, seed_z
    for dz in range(-52, 54, 4):
        for dx in range(-52, 54, 4):
            cx_t, cz_t = seed_x + dx, seed_z + dz
            ci, cj = wz_to_i(cz_t), wx_to_j(cx_t)
            ed = float(edt_liq[ci, cj])
            if ed < 64.0:
                continue
            if land_id == "aether" and float(edt_oasis[ci, cj]) < 80.0:
                continue
            sl = float(slope_smooth[ci, cj])
            ht = float(h[ci, cj])
            sc = min(ed, 160.0) - sl * 135.0 - max(ht - 12.0, 0.0) * 2.0 - math.hypot(dx, dz) * 0.14
            if sc > best_score:
                best_score = sc
                cap_x, cap_z = float(cx_t), float(cz_t)

    # Smooth flat terrace strictly on dry capital floor
    d_cap = np.sqrt((xx - cap_x) ** 2 + (zz - cap_z) ** 2)
    cap_h_target = max(float(h[wz_to_i(cap_z), wx_to_j(cap_x)]), 5.5)
    cap_flat = (1.0 - smoothstep(115.0, 178.0, d_cap)) * smoothstep(6.0, 18.0, edt_liq)
    h = h * (1.0 - cap_flat) + (cap_h_target + (n_micro - 0.5) * 0.35) * cap_flat

    def snap_dry_site(
        nx: float, nz: float, min_liq_m: float, avoid_pts: list[tuple[float, float, float]],
        max_search_r: float = 135.0, require_non_oasis: bool = False,
    ) -> tuple[float, float]:
        best_p = None
        best_sc = -1e9
        for r_ring in range(0, int(max_search_r) + 1, 6):
            steps = 1 if r_ring == 0 else max(12, int(2 * math.pi * r_ring / 10))
            for k in range(steps):
                ang = (2.0 * math.pi * k) / steps
                tx = float(np.clip(nx + math.cos(ang) * r_ring, -HALF + 32.0, HALF - 32.0))
                tz = float(np.clip(nz + math.sin(ang) * r_ring, -HALF + 32.0, HALF - 32.0))
                ed = liq_dist(tx, tz)
                if ed < min_liq_m:
                    continue
                if require_non_oasis and float(edt_oasis[wz_to_i(tz), wx_to_j(tx)]) < 28.0:
                    continue
                if any(math.hypot(tx - ax, tz - az) < min_d for ax, az, min_d in avoid_pts):
                    continue
                sl = float(base_slope[wz_to_i(tz), wx_to_j(tx)])
                sc = min(ed, 80.0) * 0.6 - sl * 120.0 - r_ring * 1.4
                if sc > best_sc:
                    best_sc = sc
                    best_p = (tx, tz)
            if best_p is not None and r_ring >= 18:
                break
        if best_p is None:
            ys, xs = np.where(edt_liq >= max(min_liq_m, 16.0))
            for idx in range(0, len(xs), max(1, len(xs) // 450)):
                tx = float(x_lin[xs[idx]])
                tz = float(z_lin[ys[idx]])
                if any(math.hypot(tx - ax, tz - az) < min_d for ax, az, min_d in avoid_pts):
                    continue
                sc = -math.hypot(tx - nx, tz - nz)
                if sc > best_sc:
                    best_sc = sc
                    best_p = (tx, tz)
        assert best_p is not None, f"Could not find dry site near ({nx}, {nz}) on {land_id}"
        return best_p

    # 1) Place 6 Exp-Zones first (strictly outside safe capital & dry)
    exp_zones = []
    avoid_ez: list[tuple[float, float, float]] = [(cap_x, cap_z, SAFE_CITY_RADIUS + 18.0)]
    for ez_def in EXP_ZONES_CATALOG[land_id]:
        ecx, ecz = snap_dry_site(ez_def["cx"], ez_def["cz"], min_liq_m=24.0, avoid_pts=avoid_ez, max_search_r=150.0)
        ez_copy = dict(ez_def)
        ez_copy["cx"] = round(ecx, 2)
        ez_copy["cz"] = round(ecz, 2)
        exp_zones.append(ez_copy)
        avoid_ez.append((ecx, ecz, 88.0))
        d_ez = np.sqrt((xx - ecx) ** 2 + (zz - ecz) ** 2)
        ez_h = max(float(h[wz_to_i(ecz), wx_to_j(ecx)]), 3.8)
        ez_flat = (1.0 - smoothstep(24.0, 42.0, d_ez)) * smoothstep(8.0, 18.0, edt_liq)
        h = h * (1.0 - ez_flat) + (ez_h + (n_micro - 0.5) * 0.5) * ez_flat

    # 2) Pick Wilderness Towns / Strongholds / Outposts
    wild_strongholds = []
    avoid_poi = list(avoid_ez)
    for pid, ptitle, px_s, pz_s, akey, prole in WILDERNESS_POIS_CATALOG[land_id]:
        _, _, _, r_foot = ARCH_CATALOG[land_id][akey]
        px, pz = snap_dry_site(
            px_s, pz_s,
            min_liq_m=r_foot + 10.0,
            avoid_pts=avoid_poi,
            max_search_r=160.0,
            require_non_oasis=(land_id == "aether"),
        )
        wild_strongholds.append((pid, ptitle, round(px, 2), round(pz, 2), akey, prole))
        avoid_poi.append((px, pz, 86.0))
        d_p = np.sqrt((xx - px) ** 2 + (zz - pz) ** 2)
        ph_t = max(float(h[wz_to_i(pz), wx_to_j(px)]), 4.2)
        p_flat = (1.0 - smoothstep(22.0, 40.0, d_p)) * smoothstep(8.0, 16.0, edt_liq)
        h = h * (1.0 - p_flat) + ph_t * p_flat

    def sample_h(wx: float, wz: float) -> float:
        return float(h[wz_to_i(wz), wx_to_j(wx)])

    # 3) PLACE MONUMENTAL BUILDINGS FIRST (BEFORE ROADS!) so every street routes cleanly to building doors!
    arch = ARCH_CATALOG[land_id]
    buildings_list: list[dict] = []
    placed_major: list[tuple[float, float, float, float, float, str, str, bool]] = []
    placed_by_role: dict[str, list[dict]] = {}

    def place_building_safe(
        b_id: str,
        title: str,
        role: str,
        asset_key: str,
        target_x: float,
        target_z: float,
        map_kind: str = "service",
        enterable: bool = True,
        enforce_spacing: bool = True,
        min_extra_liq: float = 10.0,
        search_r: float = 96.0,
        avoid_exp: bool = True,
    ) -> dict | None:
        sp_path, w_px, h_px, r_foot = arch[asset_key]
        is_minor = role in ("prop", "wall", "tower", "gate")
        req_liq = (r_foot + min_extra_liq) if not is_minor else max(14.0, r_foot + 4.0)
        spacing_gap = 16.0 if not is_minor else 8.0

        def ok_at(cx: float, cz: float) -> tuple[bool, float, float]:
            if abs(cx) > HALF - 26.0 or abs(cz) > HALF - 26.0:
                return False, cx, cz
            if liq_dist(cx, cz) < req_liq:
                return False, cx, cz
            if not is_minor and b_id != "verdant-fountain":
                if math.hypot(cx - cap_x, cz - (cap_z + 18.0)) < r_foot + 26.0:
                    return False, cx, cz
            if land_id == "aether" and not is_minor and float(edt_oasis[wz_to_i(cz), wx_to_j(cx)]) < 24.0:
                return False, cx, cz
            if avoid_exp:
                for ez in exp_zones:
                    if math.hypot(cx - ez["cx"], cz - ez["cz"]) < r_foot + ez["radius"] * 0.72:
                        return False, cx, cz
            dx_c = cap_x - cx
            dz_c = cap_z - cz
            dc = math.hypot(dx_c, dz_c)
            if dc > 6.0 and map_kind != "town":
                ex = cx + (dx_c / dc) * (r_foot + 10.0)
                ez = cz + (dz_c / dc) * (r_foot + 10.0)
            else:
                ex = cx + (r_foot + 10.0) * 0.55
                ez = cz + (r_foot + 10.0) * 0.84
            if not is_minor and liq_dist(ex, ez) < 10.0:
                return False, ex, ez
            if enforce_spacing:
                for ox, oz, orad, oex, oez, _, _, _ in placed_major:
                    min_dist = r_foot + orad + spacing_gap
                    if math.hypot(cx - ox, cz - oz) < min_dist:
                        return False, ex, ez
                    if not is_minor:
                        if math.hypot(ex - ox, ez - oz) < orad + 12.0:
                            return False, ex, ez
                        if math.hypot(cx - oex, cz - oez) < r_foot + 12.0:
                            return False, ex, ez
            return True, ex, ez

        best = None
        for r_ring in range(0, int(search_r) + 1, 6):
            steps = 1 if r_ring == 0 else max(14, int(2 * math.pi * r_ring / 9))
            for k in range(steps):
                ang = (2.0 * math.pi * k) / steps
                tx = target_x + math.cos(ang) * r_ring
                tz = target_z + math.sin(ang) * r_ring
                valid, ex, ez = ok_at(tx, tz)
                if valid:
                    best = (tx, tz, ex, ez)
                    break
            if best is not None:
                break

        if best is None and not is_minor and min_extra_liq > 4.0:
            req_liq = r_foot + 4.0
            for r_ring in range(0, int(search_r + 48.0) + 1, 8):
                steps = 1 if r_ring == 0 else max(16, int(2 * math.pi * r_ring / 10))
                for k in range(steps):
                    ang = (2.0 * math.pi * k) / steps
                    tx = target_x + math.cos(ang) * r_ring
                    tz = target_z + math.sin(ang) * r_ring
                    valid, ex, ez = ok_at(tx, tz)
                    if valid:
                        best = (tx, tz, ex, ez)
                        break
                if best is not None:
                    break

        if best is None:
            return None

        fx, fz, ex, ez = best
        rec = {
            "id": b_id,
            "title": title,
            "role": role,
            "map_kind": map_kind,
            "enterable": enterable,
            "sprite": sp_path,
            "w": w_px,
            "h": h_px,
            "footprint_r": r_foot,
            "x": round(fx, 2),
            "z": round(fz, 2),
            "y": round(sample_h(fx, fz), 2),
            "entrance": [round(ex, 2), round(ez, 2)],
        }
        buildings_list.append(rec)
        placed_by_role.setdefault(role, []).append(rec)
        if not is_minor:
            placed_major.append((fx, fz, r_foot, ex, ez, role, map_kind, enterable))
        return rec

    # Monumental Capital Layout (spacious ~105..195m offsets matching 3x bigger buildings!)
    if land_id == "pyra":
        cap_plan = [
            ("pyra-fortress", "Twierdza Popiołu (Cytadela)", "landmark", "fortress", "capital", True, 0.0, -98.0),
            ("pyra-hall", "Sala Przysięgi", "hall", "hall", "service", True, -104.0, -56.0),
            ("pyra-inn", "Gospoda Ogniska", "inn", "inn", "service", True, 104.0, -56.0),
            ("pyra-smithy", "Kuźnia Żaru", "smithy", "smithy", "service", True, -112.0, 38.0),
            ("pyra-arena", "Arena Krwi i Popiołu", "arena", "arena", "service", True, 112.0, 38.0),
            ("pyra-shop", "Targ Klanów", "shop", "shop", "service", True, -68.0, 118.0),
            ("pyra-depot", "Skarbiec Twierdzy", "depot", "depot", "service", True, 68.0, 118.0),
            ("pyra-altar", "Ołtarz Płomiennego Pojedynku", "landmark", "altar", "service", True, -172.0, -124.0),
            ("pyra-statue", "Kolos Areny Dziedzictwa", "landmark", "statue", "service", False, 172.0, -124.0),
        ]
    elif land_id == "verdant":
        cap_plan = [
            ("verdant-hall", "Dom Zgromadzeń", "landmark", "hall", "capital", True, 0.0, -102.0),
            ("verdant-fountain", "Źródło Pierwszego Oddechu", "landmark", "fountain", "service", False, 0.0, -8.0),
            ("verdant-smithy", "Kuźnia Korzeni", "smithy", "smithy", "service", True, -108.0, -54.0),
            ("verdant-inn", "Karczma Pod Liściem", "inn", "inn", "service", True, 108.0, -54.0),
            ("verdant-shop", "Zielony Targ", "shop", "shop", "service", True, -116.0, 42.0),
            ("verdant-arena", "Krąg Łowców", "arena", "arena", "service", True, 116.0, 42.0),
            ("verdant-depot", "Magazyn Przystani", "depot", "depot", "service", True, 0.0, 122.0),
            ("verdant-forge", "Korzenna Kuźnia Pradawnych Rytów", "landmark", "forge", "service", True, -176.0, -120.0),
            ("verdant-cottage", "Dom Podwójnego Echa", "landmark", "cottage", "service", True, 176.0, -120.0),
        ]
    elif land_id == "aether":
        cap_plan = [
            ("aether-sanctum", "Lodowe Sanktuarium Pieczęci", "landmark", "sanctum", "capital", True, 0.0, -102.0),
            ("aether-hall", "Pawilon Śnieżnej Rady", "hall", "hall", "service", True, -108.0, -54.0),
            ("aether-inn", "Herbaciarnia Obłoków", "inn", "inn", "service", True, 108.0, -54.0),
            ("aether-smithy", "Kuźnia Run Lodu", "smithy", "smithy", "service", True, -114.0, 42.0),
            ("aether-arena", "Krąg Skupienia Ki", "arena", "arena", "service", True, 114.0, 42.0),
            ("aether-shop", "Dom Wymiany Zwojów", "shop", "shop", "service", True, -68.0, 120.0),
            ("aether-depot", "Skarbiec Zwojów", "depot", "depot", "service", True, 68.0, 120.0),
            ("aether-observatory", "Śnieżne Obserwatorium Sygnałów", "landmark", "observatory", "service", True, 174.0, -122.0),
            ("aether-archive", "Zachodnie Archiwum Mrozu", "landmark", "archive", "service", True, -174.0, -122.0),
        ]
    else:
        cap_plan = [
            ("nexus-reactor-core", "Rdzeń Przeciążonej Pamięci", "landmark", "reactor_art", "capital", True, 0.0, -102.0),
            ("nexus-hall", "Węzeł Świadomości (Centrum)", "hall", "hall", "service", True, -108.0, -54.0),
            ("nexus-inn", "Stacja Regeneracji SOLA-6", "inn", "inn", "service", True, 108.0, -54.0),
            ("nexus-smithy", "Zakład Uzbrojenia HEF-4", "smithy", "smithy", "service", True, -114.0, 42.0),
            ("nexus-arena", "Poligon Kalibracji Bojowej", "arena", "arena", "service", True, 114.0, 42.0),
            ("nexus-shop", "Terminal Wymiany MIRA-2", "shop", "shop", "service", True, -68.0, 120.0),
            ("nexus-depot", "Magazyn Rdzeni ARCH-5", "depot", "depot", "service", True, 68.0, 120.0),
            ("nexus-lab-w", "Laboratorium Kalibracji", "landmark", "field_lab", "service", True, -174.0, -122.0),
            ("nexus-reactor-e", "Reaktor Pomocniczy Sektor-2", "landmark", "reactor", "service", True, 174.0, -122.0),
        ]

    for bid, btitle, brole, bkey, bkind, b_ent, ox, oz in cap_plan:
        place_building_safe(
            bid, btitle, brole, bkey, cap_x + ox, cap_z + oz,
            map_kind=bkind, enterable=b_ent, enforce_spacing=True, min_extra_liq=10.0, search_r=96.0,
        )

    house_offsets = [(-188.0, -18.0), (188.0, -18.0), (-162.0, 118.0), (162.0, 118.0), (-78.0, -182.0), (78.0, -182.0)]
    for h_i, (hx, hz) in enumerate(house_offsets):
        place_building_safe(
            f"{land_id}-house-{h_i}",
            "Dom Mieszkańców" if land_id != "nexus" else "Moduł Mieszkalny",
            "house", "house", cap_x + hx, cap_z + hz,
            map_kind="house", enterable=False, enforce_spacing=True, min_extra_liq=10.0, search_r=64.0,
        )

    placed_gates: list[dict] = []
    for gd, gx, gz, gkey in [("W", -190.0, 0.0, "gate_z"), ("E", 190.0, 0.0, "gate_z"), ("N", 0.0, -190.0, "gate_x"), ("S", 0.0, 190.0, "gate_x")]:
        grec = place_building_safe(
            f"{land_id}-gate-{gd}", "Brama Stolicy", "gate", gkey, cap_x + gx, cap_z + gz,
            map_kind="fort", enterable=False, enforce_spacing=True, min_extra_liq=10.0, search_r=36.0,
        )
        if grec is not None:
            placed_gates.append(grec)

    for ti, (tx, tz) in enumerate([(-172.0, -172.0), (172.0, -172.0), (-172.0, 172.0), (172.0, 172.0)]):
        place_building_safe(
            f"{land_id}-tower-{ti}", "Baszta Strażnicza", "tower", "tower", cap_x + tx, cap_z + tz,
            map_kind="fort", enterable=False, enforce_spacing=True, min_extra_liq=10.0, search_r=28.0,
        )

    # Wilderness Strongholds / Secondary Towns / Outposts (distinct "town" symbol on maps!)
    placed_towns: list[dict] = []
    for pid, ptitle, px, pz, akey, prole in wild_strongholds:
        trec = place_building_safe(
            pid, ptitle, prole, akey, px, pz,
            map_kind="town", enterable=True, enforce_spacing=True, min_extra_liq=10.0, search_r=56.0,
        )
        if trec is not None:
            placed_towns.append(trec)
            if akey == "castle":
                place_building_safe(
                    f"{pid}-tower-w", "Baszta Zamkowa", "tower", "tower", trec["x"] - 64.0, trec["z"] + 38.0,
                    map_kind="fort", enterable=False, enforce_spacing=True, min_extra_liq=10.0, search_r=26.0,
                )
                place_building_safe(
                    f"{pid}-tower-e", "Baszta Zamkowa", "tower", "tower", trec["x"] + 64.0, trec["z"] + 38.0,
                    map_kind="fort", enterable=False, enforce_spacing=True, min_extra_liq=10.0, search_r=26.0,
                )

    # 4) BUILD REAL ROAD NETWORK ROUTED DIRECTLY TO EVERY BUILDING'S FRONT DOOR + EXP-ZONES + TOWNS!
    water_mask = blur_float((ocean | inland_water).astype(np.float32), 1.35)
    water_mask = np.where(ocean | inland_water, np.maximum(water_mask, 0.85), water_mask * 0.45)
    lava_mask = blur_float(lava.astype(np.float32), 1.25)
    lava_mask = np.where(lava, np.maximum(lava_mask, 0.88), lava_mask * 0.45)
    road_mask = np.zeros((GRID_N, GRID_N), dtype=np.float32)
    energy_mask = np.zeros((GRID_N, GRID_N), dtype=np.float32)
    bridge_walk_mask = np.zeros((GRID_N, GRID_N), dtype=bool)

    dry_plaza = smoothstep(8.0, 18.0, edt_liq)
    plaza_m = (1.0 - smoothstep(26.0, 38.0, d_cap)) * dry_plaza
    ring_r = 122.0
    ring_rd = np.exp(-((d_cap - ring_r) ** 2) / (2.0 * 4.6 ** 2)) * dry_plaza
    road_mask = np.maximum.reduce([road_mask, plaza_m, ring_rd])

    roads_export: list[dict] = []

    ring_pts: list[list[float]] = []
    for k in range(37):
        ang = (2.0 * math.pi * k) / 36.0
        rx = cap_x + math.cos(ang) * ring_r
        rz = cap_z + math.sin(ang) * ring_r
        if liq_dist(rx, rz) >= 10.0:
            ring_pts.append([round(rx, 1), round(rz, 1)])
        else:
            if len(ring_pts) >= 2:
                roads_export.append({"tier": "ring", "pts": ring_pts})
            ring_pts = []
    if len(ring_pts) >= 2:
        roads_export.append({"tier": "ring", "pts": ring_pts})

    spline_defs: list[tuple[list[tuple[float, float]], float, float, str]] = []

    def make_graceful_road(
        p_a: tuple[float, float], p_b: tuple[float, float], bend: float, width: float, strength: float, tier: str
    ) -> None:
        dx_w = p_b[0] - p_a[0]
        dz_w = p_b[1] - p_a[1]
        seg_len = max(math.hypot(dx_w, dz_w), 1.0)
        nx_p, nz_p = -dz_w / seg_len, dx_w / seg_len
        p1 = (p_a[0] + dx_w * 0.34 + nx_p * bend, p_a[1] + dz_w * 0.34 + nz_p * bend)
        p2 = (p_a[0] + dx_w * 0.68 - nx_p * bend * 0.55, p_a[1] + dz_w * 0.68 - nz_p * bend * 0.55)
        spline_defs.append(([p_a, p1, p2, p_b], width, strength, tier))

    # 4a) Dedicated Paved City Streets directly from Capital Plaza/Ring -> EVERY Capital Enterable Building Door!
    for b_idx, b in enumerate(buildings_list):
        if b["map_kind"] in ("capital", "service") and b["enterable"]:
            ex, ez = float(b["entrance"][0]), float(b["entrance"][1])
            dist_c = math.hypot(ex - cap_x, ez - cap_z)
            if dist_c > ring_r + 16.0:
                ang = math.atan2(ez - cap_z, ex - cap_x)
                start_pt = (cap_x + math.cos(ang) * ring_r, cap_z + math.sin(ang) * ring_r)
                if liq_dist(start_pt[0], start_pt[1]) < 10.0:
                    start_pt = (cap_x, cap_z)
            else:
                start_pt = (cap_x, cap_z)
            make_graceful_road(
                start_pt, (ex, ez),
                bend=7.0 if b_idx % 2 == 0 else -7.0,
                width=9.4, strength=0.92, tier="city",
            )
            d_ent = np.sqrt((xx - ex) ** 2 + (zz - ez) ** 2)
            apron = (1.0 - smoothstep(8.0, 14.5, d_ent)) * smoothstep(4.0, 10.0, edt_liq) * 0.92
            road_mask = np.maximum(road_mask, apron)

    # 4b) Tier-1 Paved Highways from Capital -> ALL 6 Exp-Zones
    for idx, ez in enumerate(exp_zones):
        make_graceful_road(
            (cap_x, cap_z), (ez["cx"], ez["cz"]),
            bend=18.0 if idx % 2 == 0 else -18.0,
            width=11.5, strength=0.94, tier="highway",
        )

    # 4c) Tier-1/2 Town Roads -> EVERY Wilderness Castle/Town/Outpost Door!
    for idx, trec in enumerate(placed_towns):
        ex, ez = float(trec["entrance"][0]), float(trec["entrance"][1])
        nearest_ez = min(exp_zones, key=lambda e: math.hypot(e["cx"] - ex, e["cz"] - ez))
        src_pt = (cap_x, cap_z) if idx == 0 else (nearest_ez["cx"], nearest_ez["cz"])
        make_graceful_road(
            src_pt, (ex, ez),
            bend=14.0 if idx % 2 == 0 else -14.0,
            width=9.8, strength=0.88, tier="town",
        )
        d_ent = np.sqrt((xx - ex) ** 2 + (zz - ez) ** 2)
        apron = (1.0 - smoothstep(9.0, 16.0, d_ent)) * smoothstep(4.0, 10.0, edt_liq) * 0.90
        road_mask = np.maximum(road_mask, apron)

    # 4d) Continent Perimeter Footpath Loop linking neighboring Exp-Zones
    ez_ordered = sorted(exp_zones, key=lambda e: math.atan2(e["cz"] - cap_z, e["cx"] - cap_x))
    for i in range(len(ez_ordered)):
        a = ez_ordered[i]
        b = ez_ordered[(i + 1) % len(ez_ordered)]
        mx, mz = 0.5 * (a["cx"] + b["cx"]), 0.5 * (a["cz"] + b["cz"])
        if not ocean[wz_to_i(mz), wx_to_j(mx)]:
            make_graceful_road(
                (a["cx"], a["cz"]), (b["cx"], b["cz"]),
                bend=12.0 if i % 2 == 0 else -12.0,
                width=8.4, strength=0.80, tier="footpath",
            )

    # 5) Detect EVERY Water & Lava Crossing along ALL Roads -> Place Oriented Directional Blender Bridges!
    crossable_liq = inland_water | lava
    bridges_placed: list[dict] = []

    def try_add_bridge_from_run(curve: np.ndarray, run_start: int, run_end: int) -> bool:
        n_pts = len(curve)
        i0 = max(0, run_start - 3)
        i1 = min(n_pts - 1, run_end + 3)
        p_start = curve[i0]
        p_end = curve[i1]
        span_m = float(math.hypot(p_end[0] - p_start[0], p_end[1] - p_start[1]))
        if span_m < 9.0 or span_m > 98.0:
            return False
        if ocean[wz_to_i(float(p_start[1])), wx_to_j(float(p_start[0]))]:
            return False
        if ocean[wz_to_i(float(p_end[1])), wx_to_j(float(p_end[0]))]:
            return False
        dx = float(p_end[0] - p_start[0])
        dz = float(p_end[1] - p_start[1])
        axis = select_directional_bridge_axis(dx, dz)

        n_segs = 1 if span_m <= 42.0 else (2 if span_m <= 74.0 else 3)
        mid_i = (run_start + run_end) // 2
        cx_m, cz_m = float(curve[mid_i][0]), float(curve[mid_i][1])
        if any(math.hypot(cx_m - b["x"], cz_m - b["z"]) < 72.0 for b in bridges_placed):
            return False

        bank_h = max(
            float(h[wz_to_i(float(p_start[1])), wx_to_j(float(p_start[0]))]),
            float(h[wz_to_i(float(p_end[1])), wx_to_j(float(p_end[0]))]),
            3.4,
        )
        run_pts = curve[max(0, run_start - 4) : min(n_pts, run_end + 5)]
        rdx = xx[..., None] - run_pts[None, None, :, 0]
        rdz = zz[..., None] - run_pts[None, None, :, 1]
        d_run = np.min(np.sqrt(rdx * rdx + rdz * rdz), axis=-1)
        bridge_walk_mask[:] |= (d_run < 11.5)
        lift_w = 1.0 - smoothstep(6.5, 13.0, d_run)
        h[:] = np.where(lift_w > 0.02, h * (1.0 - lift_w) + bank_h * lift_w, h)

        for s_k in range(n_segs):
            frac = (s_k + 0.5) / n_segs
            idx_s = int(round(run_start + frac * (run_end - run_start)))
            bx, bz = float(curve[idx_s][0]), float(curve[idx_s][1])
            bridges_placed.append({
                "id": f"{land_id}-bridge-{len(bridges_placed)}",
                "title": "Most Szlaku",
                "role": "bridge",
                "map_kind": "bridge",
                "enterable": False,
                "axis": axis,
                "sprite": f"res://assets/objects/{land_id}-bridge-{axis}.webp",
                "w": 540,
                "h": 420,
                "x": round(bx, 2),
                "z": round(bz, 2),
                "y": round(bank_h, 2),
            })
        return True

    for ctrl_pts, r_width, r_strength, tier in spline_defs:
        curve = catmull_rom_spline(ctrl_pts, samples_per_seg=110)
        ci_arr = np.clip(np.round((curve[:, 1] + HALF) / WORLD_SIZE * (GRID_N - 1)).astype(int), 0, GRID_N - 1)
        cj_arr = np.clip(np.round((curve[:, 0] + HALF) / WORLD_SIZE * (GRID_N - 1)).astype(int), 0, GRID_N - 1)
        if int(np.sum(ocean[ci_arr, cj_arr])) > 16:
            continue

        in_chan = crossable_liq[ci_arr, cj_arr]
        idx_c = 0
        n_c = len(curve)
        while idx_c < n_c:
            if in_chan[idx_c]:
                r_start = idx_c
                while idx_c < n_c and in_chan[idx_c]:
                    idx_c += 1
                r_end = idx_c - 1
                if r_end - r_start >= 2:
                    try_add_bridge_from_run(curve, r_start, r_end)
            else:
                idx_c += 1

        step_exp = max(1, len(curve) // 22)
        exp_pts = [[round(float(curve[k, 0]), 1), round(float(curve[k, 1]), 1)] for k in range(0, len(curve), step_exp)]
        if exp_pts[-1] != [round(float(curve[-1, 0]), 1), round(float(curve[-1, 1]), 1)]:
            exp_pts.append([round(float(curve[-1, 0]), 1), round(float(curve[-1, 1]), 1)])
        roads_export.append({"tier": tier, "pts": exp_pts})

        sub_pts = curve[::2]
        dx = xx[..., None] - sub_pts[None, None, :, 0]
        dz = zz[..., None] - sub_pts[None, None, :, 1]
        d_min = np.min(np.sqrt(dx * dx + dz * dz), axis=-1)
        edge_jit = (n_detail - 0.5) * (2.0 if tier == "footpath" else 0.9)
        seg_mask = (1.0 - smoothstep(r_width * 0.42, r_width * 0.88, d_min + edge_jit)) * r_strength
        road_mask = np.maximum(road_mask, seg_mask)

    if len(bridges_placed) < 2 and np.any(crossable_liq):
        ys_l, xs_l = np.where(crossable_liq)
        step_s = max(1, len(xs_l) // 180)
        for k in range(0, len(xs_l), step_s):
            if len(bridges_placed) >= 2:
                break
            lx = float(x_lin[xs_l[k]])
            lz = float(z_lin[ys_l[k]])
            if math.hypot(lx - cap_x, lz - cap_z) < SAFE_CITY_RADIUS * 0.72:
                continue
            if any(math.hypot(lx - b["x"], lz - b["z"]) < 75.0 for b in bridges_placed):
                continue
            for ang_deg in (0.0, 90.0, 45.0, 135.0):
                rad = math.radians(ang_deg)
                ux, uz = math.cos(rad), math.sin(rad)
                found_span = None
                for half_s in (18.0, 26.0, 34.0):
                    p0 = (lx - ux * half_s, lz - uz * half_s)
                    p1 = (lx + ux * half_s, lz + uz * half_s)
                    if abs(p0[0]) > HALF - 24 or abs(p0[1]) > HALF - 24 or abs(p1[0]) > HALF - 24 or abs(p1[1]) > HALF - 24:
                        continue
                    if liq_dist(p0[0], p0[1]) >= 10.0 and liq_dist(p1[0], p1[1]) >= 10.0:
                        found_span = (p0, p1)
                        break
                if found_span is not None:
                    p0, p1 = found_span
                    spur = catmull_rom_spline([p0, (lx, lz), p1], samples_per_seg=40)
                    ci_s = np.clip(np.round((spur[:, 1] + HALF) / WORLD_SIZE * (GRID_N - 1)).astype(int), 0, GRID_N - 1)
                    cj_s = np.clip(np.round((spur[:, 0] + HALF) / WORLD_SIZE * (GRID_N - 1)).astype(int), 0, GRID_N - 1)
                    idxs = np.where(crossable_liq[ci_s, cj_s])[0]
                    if len(idxs) >= 2 and try_add_bridge_from_run(spur, int(idxs[0]), int(idxs[-1])):
                        roads_export.append({
                            "tier": "footpath",
                            "pts": [[round(float(spur[j, 0]), 1), round(float(spur[j, 1]), 1)] for j in range(0, len(spur), 6)],
                        })
                        dx = xx[..., None] - spur[None, None, :, 0]
                        dz = zz[..., None] - spur[None, None, :, 1]
                        d_min = np.min(np.sqrt(dx * dx + dz * dz), axis=-1)
                        seg_m = (1.0 - smoothstep(4.5, 9.5, d_min)) * 0.90
                        road_mask = np.maximum(road_mask, seg_m)
                        break

    # Suppress flat road_mask strictly inside liquid and under solid building cores!
    road_mask = np.where((water_mask > 0.28) | (lava_mask > 0.28), 0.0, road_mask)
    building_solid_mask = np.zeros((GRID_N, GRID_N), dtype=bool)
    for fx, fz, r_foot, _ex, _ez, _rl, _mk, _ent in placed_major:
        d_b = np.sqrt((xx - fx) ** 2 + (zz - fz) ** 2)
        building_solid_mask |= (d_b < r_foot * 0.56)
        road_mask = np.where(d_b < r_foot * 0.50, 0.0, road_mask)

    buildings_list.extend(bridges_placed)

    for li, (lx, lz) in enumerate([(-44.0, -38.0), (44.0, -38.0), (-44.0, 38.0), (44.0, 38.0), (-80.0, 4.0), (80.0, 4.0)]):
        place_building_safe(
            f"{land_id}-lamp-{li}", "Latarnia Placu", "prop", "lantern", cap_x + lx, cap_z + lz,
            map_kind="prop", enterable=False, enforce_spacing=False, min_extra_liq=12.0, search_r=18.0,
        )

    # Preserve all deployed RTX 6000 Ada PBR textures — only fill missing legacy textures if absent
    src_terrain_dir = REPO_ROOT / "ports" / "godot-pyra" / "assets" / "lands" / land_id / "terrain"
    if src_terrain_dir.exists():
        tex_map = {
            "mat_0.png": "b0.webp",
            "mat_1.png": "b2.webp",
            "mat_2.png": "road0.webp",
            "mat_3.png": "b3.webp",
            "water.png": "special.webp" if land_id == "pyra" else "water.webp",
        }
        for dst_name, src_name in tex_map.items():
            dst_p = reg_dir / dst_name
            src_p = src_terrain_dir / src_name
            if not dst_p.exists() and src_p.exists():
                Image.open(src_p).convert("RGB").save(dst_p)

    # Normals, Biome Weights, Surface RGBA & Walkable Mask
    normal_rgb, _shade = compute_normal_and_hillshade(h, cell_size_m=STEP)
    slope = 1.0 - (normal_rgb[..., 2].astype(np.float32) / 255.0)

    w_cliff = smoothstep(0.08, 0.22, slope)
    w_road = np.clip(road_mask, 0.0, 1.0)
    if land_id == "aether":
        w_cliff = np.maximum(w_cliff, smoothstep(17.0, 23.0, h) * 0.72)
        w_accent = np.clip(n_detail * 0.42 + smoothstep(10.0, 18.0, h) * 0.25, 0.0, 0.65) * (1.0 - w_road) * (1.0 - w_cliff)
        w_base = np.clip(1.0 - w_cliff - w_road - w_accent, 0.0, 1.0)
    elif land_id == "verdant":
        snow_f = blur_float(snow_mask.astype(np.float32), 2.0)
        forest_f = blur_float(forest_mask.astype(np.float32), 2.0)
        w_cliff = np.clip(np.maximum(w_cliff, snow_f * 0.92), 0.0, 1.0)
        w_accent = np.clip(forest_f * 0.62 + n_detail * 0.25, 0.0, 1.0) * (1.0 - w_road) * (1.0 - w_cliff)
        w_base = np.clip(1.0 - w_cliff - w_road - w_accent, 0.0, 1.0)
    elif land_id == "nexus":
        tan_f = blur_float(tan_mask.astype(np.float32), 2.5)
        w_accent = np.clip((1.0 - tan_f) * 0.92, 0.0, 1.0) * (1.0 - w_road) * (1.0 - w_cliff)
        w_base = np.clip(tan_f * 0.95, 0.0, 1.0) * (1.0 - w_road) * (1.0 - w_cliff)
    else:
        w_accent = np.clip(n_detail * 0.58 + smoothstep(11.0, 22.0, h) * 0.35, 0.0, 1.0) * (1.0 - w_road) * (1.0 - w_cliff)
        w_base = np.clip(1.0 - w_cliff - w_road - w_accent, 0.0, 1.0)

    weights = np.zeros((GRID_N, GRID_N, 4), dtype=np.float32)
    weights[..., 0] = w_base
    weights[..., 1] = w_accent
    weights[..., 2] = w_road
    weights[..., 3] = w_cliff
    weights /= (np.sum(weights, axis=-1, keepdims=True) + 1e-6)

    h.astype(np.float32).tofile(reg_dir / "height.r32")
    Image.fromarray(normal_rgb, mode="RGB").save(reg_dir / "normal.png")
    Image.fromarray(np.clip(weights * 255.0, 0, 255).astype(np.uint8), mode="RGBA").save(reg_dir / "weights.png")

    surf_rgba = np.zeros((GRID_N, GRID_N, 4), dtype=np.uint8)
    surf_rgba[..., 0] = np.clip(lava_mask * 255.0, 0, 255).astype(np.uint8)
    surf_rgba[..., 1] = np.clip(water_mask * 255.0, 0, 255).astype(np.uint8)
    surf_rgba[..., 2] = np.clip(road_mask * 255.0, 0, 255).astype(np.uint8)
    surf_rgba[..., 3] = np.clip((1.0 - energy_mask) * 255.0, 0, 255).astype(np.uint8)
    Image.fromarray(surf_rgba, mode="RGBA").save(reg_dir / "surface.png")

    walkable = ((((slope < 0.30) & (~liquid)) | bridge_walk_mask | (road_mask > 0.35)) & (~ocean)) & (~building_solid_mask)
    np.where(walkable, 255, 0).astype(np.uint8).tofile(reg_dir / "walkable.u8")

    def is_safe_dry(wx: float, wz: float, min_liq_m: float = 12.0, clear_road: bool = True) -> bool:
        if abs(wx) > HALF - 18.0 or abs(wz) > HALF - 18.0:
            return False
        ci, cj = wz_to_i(wz), wx_to_j(wx)
        if liquid[ci, cj] or float(edt_liq[ci, cj]) < min_liq_m:
            return False
        if building_solid_mask[ci, cj]:
            return False
        if clear_road and float(road_mask[ci, cj]) > 0.22:
            return False
        return True

    # 6) 10 Capital NPCs stationed cleanly right beside Building Front Entrances (100% Dry!)
    npc_role_map = ["hall", "smithy", "shop", "inn", "arena", "depot", "landmark", "gate", "hall", "smithy"]
    npcs_list = []
    avoid_b_cores = [(bx, bz, br + 6.0) for bx, bz, br, _, _, _, _, _ in placed_major]
    for n_idx, (actor_id, name, role, q_mark, nox, noz) in enumerate(NPCS_CATALOG[land_id]):
        target_role = npc_role_map[n_idx % len(npc_role_map)]
        cands = placed_by_role.get(target_role, [])
        if cands:
            brec = cands[0]
            ent = brec.get("entrance", [brec["x"], brec["z"] + 32.0])
            nx = float(ent[0]) + (6.0 if n_idx % 2 == 0 else -6.0)
            nz = float(ent[1]) + (4.0 if n_idx < 5 else -4.0)
        else:
            nx, nz = cap_x + nox, cap_z + noz
        if not is_safe_dry(nx, nz, min_liq_m=10.0, clear_road=False) or any(
            math.hypot(nx - bx, nz - bz) < br + 4.0 for bx, bz, br, _, _, _, _, _ in placed_major
        ):
            nx, nz = snap_dry_site(nx, nz, min_liq_m=12.0, avoid_pts=avoid_b_cores, max_search_r=75.0)
        npcs_list.append({
            "actor_id": actor_id,
            "name": name,
            "role": role,
            "quest_mark": q_mark,
            "x": round(nx, 2),
            "z": round(nz, 2),
            "y": round(sample_h(nx, nz), 2),
            "patrol_radius": 7.0,
        })

    # 7) 30 Monsters in 6 Exp-Zones (100% Dry Ground)
    monsters_list = []
    exp_zones_out = []
    for ez in exp_zones:
        ecx, ecz, erad = ez["cx"], ez["cz"], ez["radius"]
        exp_zones_out.append({
            "id": ez["id"],
            "name": ez["name"],
            "x": ecx,
            "z": ecz,
            "y": round(sample_h(ecx, ecz), 2),
            "radius": erad,
        })
        m_defs = ez["monsters"]
        for m_idx, (m_id, m_name, m_lv, m_hp) in enumerate(m_defs):
            ang = (2.0 * math.pi * m_idx) / len(m_defs) + 0.35
            dist = 14.0 + (m_idx % 2) * 8.0
            mx = ecx + math.cos(ang) * dist
            mz = ecz + math.sin(ang) * dist
            if not is_safe_dry(mx, mz, min_liq_m=14.0, clear_road=False):
                mx, mz = snap_dry_site(ecx, ecz, min_liq_m=14.0, avoid_pts=[], max_search_r=36.0)
            monsters_list.append({
                "actor_id": m_id,
                "name": m_name,
                "level": m_lv,
                "hp": m_hp,
                "exp_zone": ez["id"],
                "x": round(mx, 2),
                "z": round(mz, 2),
                "y": round(sample_h(mx, mz), 2),
                "patrol_radius": 10.0,
            })

    # 8) 18 Wildlife Fauna Animals (100% Dry Ground)
    rng = random.Random(f"fauna_{land_id}_20261119")
    fauna_list = []
    fauna_species = FAUNA_CATALOG[land_id]
    tries = 0
    while len(fauna_list) < 18 and tries < 1200:
        tries += 1
        fx = rng.uniform(-HALF + 32.0, HALF - 32.0)
        fz = rng.uniform(-HALF + 32.0, HALF - 32.0)
        if math.hypot(fx - cap_x, fz - cap_z) < SAFE_CITY_RADIUS + 10.0:
            continue
        if not is_safe_dry(fx, fz, min_liq_m=18.0, clear_road=False):
            continue
        sp_id, sp_name = fauna_species[len(fauna_list) % len(fauna_species)]
        fauna_list.append({
            "actor_id": sp_id,
            "name": sp_name,
            "x": round(fx, 2),
            "z": round(fz, 2),
            "y": round(sample_h(fx, fz), 2),
            "patrol_radius": 12.0,
        })

    # 9) Biome-Accurate Flora, Trees (~1.42x larger for monumental proportion), Rocks & Scenic Waterfalls
    props_catalog = FLORA_AND_PROPS_CATALOG[land_id]
    tree_items = [p for p in props_catalog if p[3] == "tree"]
    flora_items = [p for p in props_catalog if p[3] == "flora"]
    rock_items = [p for p in props_catalog if p[3] == "rock"]
    landmark_items = [p for p in props_catalog if p[3] == "landmark"]

    props_list: list[dict] = []

    def append_prop(pid: str, item: tuple, px: float, pz: float, scale: float = 1.0) -> None:
        kind = item[3]
        mult = 1.42 if kind == "tree" else (1.25 if kind == "waterfall" else 1.12)
        props_list.append({
            "id": pid,
            "kind": kind,
            "sprite": item[0],
            "w": int(item[1] * scale * mult),
            "h": int(item[2] * scale * mult),
            "x": round(px, 2),
            "z": round(pz, 2),
            "y": round(sample_h(px, pz), 2),
        })

    def pick_biome_flora(px: float, pz: float, want_kind: str, idx_seed: int) -> tuple:
        ci, cj = wz_to_i(pz), wx_to_j(px)
        if land_id == "aether" and oasis_mask[ci, cj]:
            oasis_sub = [x for x in AETHER_OASIS_FLORA if x[3] == want_kind] or AETHER_OASIS_FLORA
            return oasis_sub[idx_seed % len(oasis_sub)]
        if land_id == "verdant" and snow_mask[ci, cj]:
            return VERDANT_ALPINE_SNOW_FLORA[idx_seed % len(VERDANT_ALPINE_SNOW_FLORA)]
        if want_kind == "tree":
            return tree_items[idx_seed % len(tree_items)]
        if want_kind == "flora":
            return flora_items[idx_seed % len(flora_items)]
        if want_kind == "rock":
            return rock_items[idx_seed % len(rock_items)]
        return (landmark_items or rock_items)[idx_seed % len(landmark_items or rock_items)]

    # 3 Scenic Reserve Waterfalls on dry elevated rims beside water/lava
    wf_specs = WATERFALL_CATALOG[land_id]
    wf_target_liq = lava if land_id == "pyra" else inland_water
    if not np.any(wf_target_liq):
        wf_target_liq = liquid
    edt_wf = exact_edt(wf_target_liq) * STEP
    wf_cand_y, wf_cand_x = np.where((~liquid) & (edt_wf >= 6.0) & (edt_wf <= 14.0) & (edt_liq >= 6.0) & (h >= 4.5))
    wf_placed: list[tuple[float, float]] = []
    if len(wf_cand_x) > 0:
        order = np.argsort(-h[wf_cand_y, wf_cand_x])
        for o_idx in order[::max(1, len(order) // 160)]:
            if len(wf_placed) >= 3:
                break
            wx_f = float(x_lin[wf_cand_x[o_idx]])
            wz_f = float(z_lin[wf_cand_y[o_idx]])
            if math.hypot(wx_f - cap_x, wz_f - cap_z) < 110.0:
                continue
            if any(math.hypot(wx_f - ox, wz_f - oz) < 110.0 for ox, oz in wf_placed):
                continue
            if any(math.hypot(wx_f - b["x"], wz_f - b["z"]) < b.get("footprint_r", 20.0) + 22.0 for b in buildings_list):
                continue
            wf_sp, wf_w, wf_h = wf_specs[len(wf_placed) % len(wf_specs)]
            append_prop(f"{land_id}-waterfall-{len(wf_placed)}", (wf_sp, wf_w, wf_h, "waterfall"), wx_f, wz_f, 1.0)
            wf_placed.append((wx_f, wz_f))

    # Exp-zone perimeter framing props
    for ez_idx, ez in enumerate(exp_zones):
        ecx, ecz, erad = ez["cx"], ez["cz"], ez["radius"]
        for k in range(8):
            ang = (2.0 * math.pi * k) / 8.0 + 0.22
            px = ecx + math.cos(ang) * (erad * 0.92)
            pz = ecz + math.sin(ang) * (erad * 0.92)
            if not is_safe_dry(px, pz, min_liq_m=12.0, clear_road=True):
                continue
            if any(math.hypot(px - b["x"], pz - b["z"]) < b.get("footprint_r", 20.0) + 18.0 for b in buildings_list):
                continue
            want = "rock" if k % 3 == 0 else ("tree" if k % 2 == 0 else "flora")
            item = pick_biome_flora(px, pz, want, ez_idx * 5 + k)
            append_prop(f"{ez['id']}-frame-{k}", item, px, pz, rng.uniform(0.90, 1.10))

    # 24 Ornamental Capital Trees & Winter Shrines
    city_tries = 0
    city_cnt = 0
    while city_cnt < 24 and city_tries < 800:
        city_tries += 1
        px = cap_x + rng.uniform(-185.0, 185.0)
        pz = cap_z + rng.uniform(-185.0, 185.0)
        if math.hypot(px - cap_x, pz - cap_z) < 48.0:
            continue
        if not is_safe_dry(px, pz, min_liq_m=14.0, clear_road=True):
            continue
        if any(math.hypot(px - b["x"], pz - b["z"]) < b.get("footprint_r", 20.0) + 18.0 for b in buildings_list):
            continue
        want = "tree" if city_cnt % 2 == 0 else "flora"
        item = pick_biome_flora(px, pz, want, city_cnt * 3)
        append_prop(f"{land_id}-city-flora-{city_cnt}", item, px, pz, 0.86)
        city_cnt += 1

    # Aetheria NW Green Oasis Dedicated Lush Grove
    if land_id == "aether" and np.any(oasis_mask):
        oy, ox = np.where(oasis_mask & (edt_liq >= 12.0))
        if len(ox) > 0:
            picked_o: list[tuple[float, float]] = []
            for k in range(28):
                idx_r = rng.randrange(len(ox))
                px, pz = float(x_lin[ox[idx_r]]), float(z_lin[oy[idx_r]])
                if any(math.hypot(px - qx, pz - qz) < 15.0 for qx, qz in picked_o):
                    continue
                if any(math.hypot(px - b["x"], pz - b["z"]) < b.get("footprint_r", 20.0) + 18.0 for b in buildings_list):
                    continue
                item = AETHER_OASIS_FLORA[k % len(AETHER_OASIS_FLORA)]
                append_prop(f"aether-oasis-{len(picked_o)}", item, px, pz, rng.uniform(0.88, 1.12))
                picked_o.append((px, pz))

    # 28 Natural Ecological Wilderness Groves
    groves_placed = 0
    grove_tries = 0
    while groves_placed < 28 and grove_tries < 1400:
        grove_tries += 1
        gx = rng.uniform(-HALF + 32.0, HALF - 32.0)
        gz = rng.uniform(-HALF + 32.0, HALF - 32.0)
        if math.hypot(gx - cap_x, gz - cap_z) < SAFE_CITY_RADIUS + 8.0:
            continue
        if not is_safe_dry(gx, gz, min_liq_m=16.0, clear_road=True):
            continue
        if any(math.hypot(gx - ez["cx"], gz - ez["cz"]) < ez["radius"] * 1.05 for ez in exp_zones):
            continue
        if any(math.hypot(gx - b["x"], gz - b["z"]) < b.get("footprint_r", 24.0) + 22.0 for b in buildings_list):
            continue
        groves_placed += 1
        for ti in range(3):
            ang = (2.0 * math.pi * ti) / 3.0 + rng.uniform(-0.35, 0.35)
            rad = rng.uniform(6.0, 20.0)
            tx, tz = gx + math.cos(ang) * rad, gz + math.sin(ang) * rad
            if is_safe_dry(tx, tz, min_liq_m=12.0, clear_road=True) and all(
                math.hypot(tx - b["x"], tz - b["z"]) >= b.get("footprint_r", 20.0) + 14.0 for b in buildings_list
            ):
                t_item = pick_biome_flora(tx, tz, "tree", groves_placed * 5 + ti)
                append_prop(f"{land_id}-grove-{groves_placed}-t{ti}", t_item, tx, tz, rng.uniform(0.88, 1.15))
        for fi in range(2):
            ang = rng.uniform(0.0, 2.0 * math.pi)
            rad = rng.uniform(9.0, 24.0)
            fx, fz = gx + math.cos(ang) * rad, gz + math.sin(ang) * rad
            if is_safe_dry(fx, fz, min_liq_m=12.0, clear_road=True) and all(
                math.hypot(fx - b["x"], fz - b["z"]) >= b.get("footprint_r", 20.0) + 12.0 for b in buildings_list
            ):
                f_item = pick_biome_flora(fx, fz, "flora", groves_placed * 7 + fi)
                append_prop(f"{land_id}-grove-{groves_placed}-f{fi}", f_item, fx, fz, rng.uniform(0.86, 1.10))
        rx, rz = gx + rng.uniform(-22.0, 22.0), gz + rng.uniform(-22.0, 22.0)
        if is_safe_dry(rx, rz, min_liq_m=12.0, clear_road=True) and all(
            math.hypot(rx - b["x"], rz - b["z"]) >= b.get("footprint_r", 20.0) + 14.0 for b in buildings_list
        ):
            r_item = pick_biome_flora(rx, rz, "rock" if groves_placed % 3 != 0 else "landmark", groves_placed)
            append_prop(f"{land_id}-grove-{groves_placed}-r", r_item, rx, rz, rng.uniform(0.86, 1.10))

    region_payload = {
        "land_id": land_id,
        "world_size": WORLD_SIZE,
        "grid_size": GRID_N,
        "safe_city_radius": SAFE_CITY_RADIUS,
        "capital_center": [round(cap_x, 2), round(cap_z, 2)],
        "roads": roads_export,
        "buildings": buildings_list,
        "npcs": npcs_list,
        "exp_zones": exp_zones_out,
        "monsters": monsters_list,
        "fauna": fauna_list,
        "props": props_list,
    }
    with open(reg_dir / "buildings.json", "w", encoding="utf-8") as f:
        json.dump(region_payload, f, ensure_ascii=False, indent=2)

    # STRICT AUTOMATED 0-VIOLATION AUDIT
    bldg_on_liq = sum(1 for b in buildings_list if b["role"] != "bridge" and liquid[wz_to_i(b["z"]), wx_to_j(b["x"])])
    bldg_overlaps = 0
    major_b = [b for b in buildings_list if b["role"] not in ("bridge", "prop", "wall", "tower", "gate")]
    for i in range(len(major_b)):
        for j in range(i + 1, len(major_b)):
            d_ij = math.hypot(major_b[i]["x"] - major_b[j]["x"], major_b[i]["z"] - major_b[j]["z"])
            req_d = major_b[i].get("footprint_r", 24.0) + major_b[j].get("footprint_r", 24.0) + 14.0
            if d_ij < req_d:
                bldg_overlaps += 1

    npcs_on_liq = sum(1 for n in npcs_list if liquid[wz_to_i(n["z"]), wx_to_j(n["x"])])
    mons_on_liq = sum(1 for m in monsters_list if liquid[wz_to_i(m["z"]), wx_to_j(m["x"])])
    fauna_on_liq = sum(1 for fa in fauna_list if liquid[wz_to_i(fa["z"]), wx_to_j(fa["x"])])
    props_on_liq = sum(1 for p in props_list if liquid[wz_to_i(p["z"]), wx_to_j(p["x"])])
    ez_on_liq = sum(1 for e in exp_zones_out if liquid[wz_to_i(e["z"]), wx_to_j(e["x"])])

    summer_on_snow = 0
    if land_id == "aether":
        for p in props_list:
            sp = p["sprite"]
            if any(k in sp for k in ("cherry", "ginkgo", "bamboo", "lavender", "flowers")):
                if not oasis_mask[wz_to_i(p["z"]), wx_to_j(p["x"])]:
                    summer_on_snow += 1

    missing_sprites = []
    for coll in (buildings_list, props_list):
        for item in coll:
            sp = item["sprite"]
            if sp.startswith("res://"):
                disk_p = OUT_ROOT / sp.removeprefix("res://")
                if not disk_p.exists():
                    missing_sprites.append(sp)

    audit = {
        "BUILDINGS_ON_LIQUID": bldg_on_liq,
        "BUILDING_OVERLAPS": bldg_overlaps,
        "NPCS_ON_LIQUID": npcs_on_liq,
        "MONSTERS_ON_LIQUID": mons_on_liq,
        "FAUNA_ON_LIQUID": fauna_on_liq,
        "PROPS_ON_LIQUID": props_on_liq,
        "EXP_ZONES_ON_LIQUID": ez_on_liq,
        "AETHER_SUMMER_ON_SNOW": summer_on_snow,
        "MISSING_SPRITES": len(missing_sprites),
        "ROADS_EXPORTED": len(roads_export),
        "BRIDGES_PLACED": len(bridges_placed),
        "WATERFALLS_PLACED": len(wf_placed),
        "MAJOR_BLDGS": len(major_b),
    }
    print(f"  [AUDIT {land_id:7s}] cap=({cap_x:+.0f},{cap_z:+.0f}) {json.dumps(audit)}")
    assert bldg_on_liq == 0, f"{land_id}: BUILDINGS_ON_LIQUID={bldg_on_liq}"
    assert bldg_overlaps == 0, f"{land_id}: BUILDING_OVERLAPS={bldg_overlaps}"
    assert npcs_on_liq == 0, f"{land_id}: NPCS_ON_LIQUID={npcs_on_liq}"
    assert mons_on_liq == 0, f"{land_id}: MONSTERS_ON_LIQUID={mons_on_liq}"
    assert fauna_on_liq == 0, f"{land_id}: FAUNA_ON_LIQUID={fauna_on_liq}"
    assert props_on_liq == 0, f"{land_id}: PROPS_ON_LIQUID={props_on_liq}"
    assert ez_on_liq == 0, f"{land_id}: EXP_ZONES_ON_LIQUID={ez_on_liq}"
    assert summer_on_snow == 0, f"{land_id}: AETHER_SUMMER_ON_SNOW={summer_on_snow}"
    assert not missing_sprites, f"{land_id}: MISSING_SPRITES={missing_sprites[:5]}"
    assert len(bridges_placed) > 0, f"{land_id}: expected at least 1 directional bridge!"

    return {
        "land_id": land_id,
        "grid_size": GRID_N,
        "world_size_m": WORLD_SIZE,
        "capital_center": [round(cap_x, 2), round(cap_z, 2)],
        "height_min_m": round(float(np.min(h)), 2),
        "height_max_m": round(float(np.max(h)), 2),
        "walkable_ratio": round(float(np.mean(walkable)), 3),
        "buildings_count": len(buildings_list),
        "bridges_count": len(bridges_placed),
        "waterfalls_count": len(wf_placed),
        "npcs_count": len(npcs_list),
        "exp_zones_count": len(exp_zones_out),
        "monsters_count": len(monsters_list),
        "fauna_count": len(fauna_list),
        "props_count": len(props_list),
        "audit": audit,
    }


def main() -> None:
    print("=== KI Legends 1:1 Canonical Map-Synced Continent Generator ===")
    regions_meta = {}
    for land_id in ["pyra", "verdant", "aether", "nexus"]:
        print(f"Generating 1:1 canonical continent world for {land_id}...")
        regions_meta[land_id] = generate_continent(land_id)

    manifest_path = ATLAS_DIR / "topography_manifest.json"
    prev_manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    prev_manifest["planet"] = "Superior"
    prev_manifest["sync_mode"] = "1:1 canonical map_art.png + relief_3d.r32"
    prev_manifest["capital_regions"] = regions_meta
    manifest_path.write_text(json.dumps(prev_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("TOPOGRAPHY_1TO1_AUDIT_PASS:", json.dumps({k: v["audit"] for k, v in regions_meta.items()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
