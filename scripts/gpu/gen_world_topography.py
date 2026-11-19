#!/usr/bin/env python3
"""
Phase A + Phase C Continent Topography, Catmull-Rom Spline Road Generator,
24 Exp-Zone Combat Clearings, Vivid Rivers/Lakes/Oceans/Lava, Rich Architecture,
Fortification Walls, 40 NPCs, 41 Monsters, 10 Fauna Animals & 250+ Diverse Flora/Props Generator.
"""

import json
import math
import os
import random
import struct
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


def load_noise(name: str, target_shape: tuple[int, int]) -> np.ndarray:
    p = NOISE_DIR / f"{name}.png"
    if p.exists():
        img = Image.open(p).convert("L").resize((target_shape[1], target_shape[0]), Image.Resampling.BICUBIC)
        return np.asarray(img, dtype=np.float32) / 255.0
    # Smooth 4-octave Bicubic FBM fractal noise (never white noise!)
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


def catmull_rom_spline(points: list[tuple[float, float]], samples_per_seg: int = 180) -> np.ndarray:
    """Evaluates a smooth Catmull-Rom spline through a sequence of 2D control points."""
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


# ==============================================================================
# 1. PLANETARY ATLAS (2048 x 1024)
# ==============================================================================
def generate_planet_atlas() -> dict:
    W, H = 2048, 1024
    macro = load_noise("planet_macro", (H, W))
    ridge = load_noise("planet_ridge", (H, W))
    detail = load_noise("biome_detail", (H, W))

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    continents = [
        {
            "id": "verdant",
            "title": "Verdantia",
            "capital": "Zielona Przystań",
            "cx": 362.0, "cy": 267.0,
            "rx": 285.0, "ry": 175.0,
            "world_dims": [77504, 58560],
            "palette_low": (38, 102, 52),
            "palette_mid": (74, 152, 68),
            "palette_high": (215, 226, 235),
        },
        {
            "id": "aether",
            "title": "Aetheria",
            "capital": "Sanktuarium Tysiąca Źródeł",
            "cx": 1337.0, "cy": 309.0,
            "rx": 270.0, "ry": 168.0,
            "world_dims": [70208, 53440],
            "palette_low": (64, 148, 138),
            "palette_mid": (132, 184, 162),
            "palette_high": (244, 248, 255),
        },
        {
            "id": "pyra",
            "title": "Pyra",
            "capital": "Twierdza Popiołu",
            "cx": 731.0, "cy": 730.0,
            "rx": 255.0, "ry": 148.0,
            "world_dims": [65600, 42304],
            "palette_low": (56, 36, 34),
            "palette_mid": (138, 62, 34),
            "palette_high": (252, 128, 36),
        },
        {
            "id": "nexus",
            "title": "Nexus-9",
            "capital": "Węzeł Świadomości",
            "cx": 1845.0, "cy": 709.0,
            "rx": 240.0, "ry": 158.0,
            "world_dims": [63168, 49728],
            "palette_low": (32, 44, 62),
            "palette_mid": (62, 88, 118),
            "palette_high": (110, 232, 248),
        },
    ]

    islands = [
        {"id": "island-1", "title": "Wyspa Zefiru", "cx": 107.0, "cy": 501.0, "r": 38.0},
        {"id": "island-2", "title": "Wyspa Koralowa", "cx": 608.0, "cy": 501.0, "r": 42.0},
        {"id": "island-3", "title": "Wyspa Mgły", "cx": 1109.0, "cy": 501.0, "r": 40.0},
        {"id": "island-4", "title": "Wyspa Rdzy", "cx": 1632.0, "cy": 501.0, "r": 38.0},
        {"id": "island-5", "title": "Wyspa Północna", "cx": 480.0, "cy": 36.0, "r": 34.0},
        {"id": "island-6", "title": "Wyspa Południowa", "cx": 640.0, "cy": 984.0, "r": 36.0},
    ]

    archipelagos = [
        {"id": "arch-1", "x": 980.0, "y": 190.0, "r": 22.0},
        {"id": "arch-2", "x": 1020.0, "y": 225.0, "r": 16.0},
        {"id": "arch-3", "x": 210.0, "y": 760.0, "r": 24.0},
        {"id": "arch-4", "x": 250.0, "y": 790.0, "r": 15.0},
        {"id": "arch-5", "x": 1340.0, "y": 790.0, "r": 25.0},
        {"id": "arch-6", "x": 1390.0, "y": 825.0, "r": 18.0},
        {"id": "arch-7", "x": 1790.0, "y": 180.0, "r": 21.0},
        {"id": "arch-8", "x": 850.0, "y": 420.0, "r": 17.0},
    ]

    planet_h = np.full((H, W), -25.0, dtype=np.float32)
    biome_rgb = np.zeros((H, W, 3), dtype=np.float32)

    ocean_depth = np.clip((macro * 0.7 + detail * 0.3), 0.0, 1.0)
    biome_rgb[..., 0] = 10.0 + ocean_depth * 18.0
    biome_rgb[..., 1] = 34.0 + ocean_depth * 52.0
    biome_rgb[..., 2] = 68.0 + ocean_depth * 82.0

    warp_x = (macro - 0.5) * 110.0 + (detail - 0.5) * 45.0
    warp_y = (ridge - 0.5) * 85.0 + (detail - 0.5) * 40.0

    for c in continents:
        dx = (xx + warp_x - c["cx"]) / c["rx"]
        dy = (yy + warp_y - c["cy"]) / c["ry"]
        dist = np.sqrt(dx * dx + dy * dy)
        mask = 1.0 - smoothstep(0.55, 1.08, dist)
        if np.max(mask) <= 0.0:
            continue
        m_elev = (mask ** 1.35) * (35.0 + ridge * 68.0 + detail * 22.0)
        river = np.exp(-((dx * 3.2 + np.sin(dy * 5.0) * 0.35) ** 2) * 18.0) * mask
        m_elev -= river * 26.0
        higher = m_elev > planet_h
        planet_h = np.where(higher, m_elev, planet_h)

        t_mid = smoothstep(5.0, 48.0, m_elev)
        t_high = smoothstep(52.0, 92.0, m_elev)
        c_low = np.array(c["palette_low"], dtype=np.float32)
        c_mid = np.array(c["palette_mid"], dtype=np.float32)
        c_high = np.array(c["palette_high"], dtype=np.float32)
        col = c_low[None, None, :] * (1.0 - t_mid[..., None]) + c_mid[None, None, :] * t_mid[..., None]
        col = col * (1.0 - t_high[..., None]) + c_high[None, None, :] * t_high[..., None]
        shore = smoothstep(-4.0, 4.0, m_elev)
        biome_rgb = biome_rgb * (1.0 - shore[..., None]) + col * shore[..., None]

    for isl in islands:
        dx = (xx + warp_x * 0.35 - isl["cx"]) / isl["r"]
        dy = (yy + warp_y * 0.35 - isl["cy"]) / isl["r"]
        dist = np.sqrt(dx * dx + dy * dy)
        mask = 1.0 - smoothstep(0.45, 1.05, dist)
        m_elev = (mask ** 1.4) * (24.0 + ridge * 35.0)
        shore = smoothstep(0.05, 0.3, mask)
        planet_h = np.maximum(planet_h, np.where(mask > 0.05, m_elev, -25.0))
        isl_col = np.array([156.0, 178.0, 112.0], dtype=np.float32)
        biome_rgb = biome_rgb * (1.0 - shore[..., None]) + isl_col[None, None, :] * shore[..., None]

    for arch in archipelagos:
        dx = (xx + warp_x * 0.25 - arch["x"]) / arch["r"]
        dy = (yy + warp_y * 0.25 - arch["y"]) / arch["r"]
        dist = np.sqrt(dx * dx + dy * dy)
        mask = 1.0 - smoothstep(0.35, 1.0, dist)
        m_elev = (mask ** 1.5) * (16.0 + detail * 20.0)
        shore = smoothstep(0.08, 0.35, mask)
        planet_h = np.maximum(planet_h, np.where(mask > 0.08, m_elev, -25.0))
        arch_col = np.array([118.0, 188.0, 152.0], dtype=np.float32)
        biome_rgb = biome_rgb * (1.0 - shore[..., None]) + arch_col[None, None, :] * shore[..., None]

    _, shade = compute_normal_and_hillshade(planet_h, cell_size_m=12.0)
    coast_foam = (planet_h > -2.5) & (planet_h < 2.2)
    shaded = np.clip(biome_rgb * (0.55 + 0.65 * shade[..., None]), 0, 255)
    shaded[coast_foam] = np.clip(shaded[coast_foam] * 0.65 + np.array([210, 238, 248]) * 0.35, 0, 255)

    atlas_img = Image.fromarray(shaded.astype(np.uint8), mode="RGB")
    atlas_img.save(ATLAS_DIR / "planet_atlas_relief.png")
    return {"continents": continents, "quest_islands": islands, "archipelagos": archipelagos}


# ==============================================================================
# 2. ASSET & ACTOR CATALOGS (AUTHENTIC PAINTED OBJECTS + GEONODES WALLS + ACTORS)
# ==============================================================================

# Canonical pixel display dimensions (w, h) from ports/godot-pyra/data/lands/*/land.json
# plus Blender Cycles GPU / Geometry Nodes fortifications
ARCH_CATALOG = {
    "pyra": {
        "fortress": ("pyra-premium-citadel.webp", 720, 700),
        "altar": ("pyra-aaa-altar.webp", 490, 470),
        "statue": ("73fdbb3d-ki-v2-landmarks-pyra-statue.webp", 420, 690),
        "hall": ("pyra-aaa-hall.webp", 545, 515),
        "arena": ("pyra-aaa-arena.webp", 585, 535),
        "smithy": ("pyra-aaa-smithy.webp", 525, 545),
        "inn": ("pyra-aaa-inn.webp", 545, 515),
        "shop": ("pyra-aaa-shop.webp", 525, 510),
        "depot": ("pyra-aaa-depot.webp", 535, 525),
        "house": ("pyra-aaa-house.webp", 335, 345),
        "bridge": ("pyra-premium-bridge.webp", 560, 460),
        "gate": ("pyra-citadel-gate.webp", 520, 440),
        "wall_ne": ("pyra-citadel-wall-ne.webp", 360, 220),
        "wall_nw": ("pyra-citadel-wall-nw.webp", 360, 220),
        "tower": ("pyra-tower.webp", 320, 440),
        "brazier": ("pyra-citadel-brazier.webp", 140, 155),
        "lantern": ("pyra-street-lantern.webp", 130, 260),
    },
    "verdant": {
        "forge": ("verdant-aaa-forge.webp", 590, 580),
        "cottage": ("verdant-aaa-cottage.webp", 440, 590),
        "hall": ("verdant-premium-treehall.webp", 660, 680),
        "arena": ("verdant-aaa-arena.webp", 565, 515),
        "smithy": ("verdant-aaa-smithy.webp", 535, 520),
        "inn": ("verdant-aaa-inn.webp", 515, 560),
        "shop": ("verdant-aaa-shop.webp", 540, 520),
        "depot": ("verdant-aaa-depot.webp", 550, 510),
        "house": ("verdant-aaa-house.webp", 330, 325),
        "fountain": ("7c9c601a-verdantia-extra-spring.webp", 430, 355),
        "bridge": ("5f861b00-verdantia-extra-bridge.webp", 528, 390),
        "bridge2": ("5f861b00-verdantia-extra-bridge.webp", 528, 390),
        "lamp": ("b63f70b2-verdant-city-lamp.webp", 145, 420),
        "arch": ("a98e0b02-verdantia-extra-arch.webp", 340, 320),
        "wall_ne": ("verdant-wall-ne.webp", 360, 220),
        "wall_nw": ("verdant-wall-nw.webp", 360, 220),
    },
    "aether": {
        "sanctum": ("aether-premium-pagoda.webp", 690, 730),
        "observatory": ("0ca65cb7-ki-v2-landmarks-aether-observatory.webp", 640, 740),
        "archive": ("fff58068-ki-v2-landmarks-aether-archive.webp", 680, 730),
        "hall": ("aether-aaa-hall.webp", 565, 540),
        "arena": ("aether-aaa-arena.webp", 575, 545),
        "smithy": ("aether-aaa-smithy.webp", 540, 525),
        "inn": ("aether-aaa-inn.webp", 525, 540),
        "shop": ("aether-aaa-shop.webp", 550, 515),
        "depot": ("aether-aaa-depot.webp", 525, 515),
        "house": ("aether-aaa-house.webp", 320, 315),
        "spirit_gate": ("23099b47-aether-x-spirit-gate.webp", 480, 560),
        "koi_pond": ("971c1090-aether-x-koi-pond.webp", 620, 410),
        "lantern": ("a69fa5ad-aether-x-stone-lantern.webp", 155, 330),
        "arch": ("2bb9e10a-aetheria-continent-arch.webp", 380, 340),
        "wall_ne": ("aether-wall-ne.webp", 360, 220),
        "wall_nw": ("aether-wall-nw.webp", 360, 220),
    },
    "nexus": {
        "reactor_art": ("93c8e791-nexus-art-reactor.webp", 680, 690),
        "reactor": ("3da45722-nexus-continent-reactor.webp", 380, 400),
        "hall": ("nexus-aaa-hall.webp", 580, 550),
        "arena": ("nexus-aaa-arena.webp", 580, 550),
        "smithy": ("nexus-aaa-smithy.webp", 520, 495),
        "inn": ("nexus-aaa-inn.webp", 500, 520),
        "shop": ("nexus-aaa-shop.webp", 550, 525),
        "depot": ("nexus-aaa-depot.webp", 550, 525),
        "house": ("nexus-aaa-house.webp", 320, 315),
        "transit_gate": ("2a827b38-nexus-continent-transit-gate.webp", 420, 420),
        "field_lab": ("b2f6afaa-nexus-continent-field-lab.webp", 390, 380),
        "terminal": ("006e9795-nexus-continent-terminal.webp", 310, 340),
        "terminal_art": ("1a0a0110-nexus-art-terminal.webp", 150, 360),
        "pylon": ("44993ea9-nexus-art-pylon.webp", 125, 384),
        "brazier": ("12447581-nexus-continent-energy-brazier.webp", 190, 255),
        "tech_garden": ("3a6c0fa4-nexus-art-tech-garden.webp", 460, 390),
        "wall_ne": ("nexus-wall-ne.webp", 360, 220),
        "wall_nw": ("nexus-wall-nw.webp", 360, 220),
    },
}

# Rich diverse flora, trees, bushes, flowers, waterfalls, rocks, ruins, caves, shrines & campfires per continent
FLORA_AND_PROPS_CATALOG = {
    "pyra": [
        # Trees & Volcanic Flora
        ("1cedcd5a-pyra-continent-maple.webp", 320, 350, "tree"),
        ("ae37503e-pyra-continent-pine.webp", 280, 360, "tree"),
        ("13373662-ki-v2-objects-pyra-oak-0.webp", 310, 340, "tree"),
        ("d558195b-ki-v2-objects-pyra-oak-1.webp", 300, 330, "tree"),
        ("4a0092f6-ki-v2-objects-pyra-oak-2.webp", 320, 350, "tree"),
        ("13075fb3-ki-v2-objects-pyra-oak-3.webp", 310, 340, "tree"),
        ("46e0b432-ki-v2-objects-pyra-pine-0.webp", 260, 350, "tree"),
        ("62f8c69a-ki-v2-objects-pyra-pine-1.webp", 270, 360, "tree"),
        ("bd71b1c0-ki-v2-objects-pyra-pine-2.webp", 265, 345, "tree"),
        # Bushes, Flowers, Ferns & Reeds
        ("32e0d269-pyra-continent-lantern-bush.webp", 190, 175, "flora"),
        ("39416c5c-pyra-continent-copper-bush.webp", 195, 180, "flora"),
        ("0185c62b-pyra-continent-berry-bush.webp", 185, 170, "flora"),
        ("795d001a-ki-v2-objects-pyra-flowerbush-0.webp", 185, 165, "flora"),
        ("4b4c2b92-ki-v2-objects-pyra-flowerbush-2.webp", 190, 170, "flora"),
        ("0b508d77-ki-v2-objects-pyra-fern-1.webp", 170, 145, "flora"),
        ("2388313c-ki-v2-objects-pyra-fern-2.webp", 175, 150, "flora"),
        ("56230755-ki-v2-objects-pyra-reeds-1.webp", 165, 175, "flora"),
        ("9902b9c8-pyra-continent-dry-grass.webp", 170, 140, "flora"),
        # Volcanic Rocks, Magma Rims, Crystals, Sulfur Vents, Ruins & Camps (100% die-cut continent sprites)
        ("61486b9a-pyra-continent-obsidian-spire.webp", 270, 360, "rock"),
        ("49b51ecf-pyra-continent-crystals.webp", 240, 230, "rock"),
        ("5aa5d3c0-pyra-continent-rock-arch.webp", 390, 340, "landmark"),
        ("b6d73268-pyra-continent-cliff.webp", 380, 310, "rock"),
        ("3d90558c-pyra-continent-rocks.webp", 250, 210, "rock"),
        ("c3f1e31a-pyra-continent-fissure.webp", 310, 220, "rock"),
        ("b525295a-pyra-continent-crater.webp", 330, 250, "rock"),
        ("4234722e-pyra-continent-ridge.webp", 350, 280, "rock"),
        ("3b42d9ee-pyra-continent-spring.webp", 310, 250, "landmark"),
        ("5f186a05-pyra-continent-ruin.webp", 360, 340, "landmark"),
        ("9b0974a2-pyra-continent-cave.webp", 390, 340, "landmark"),
        ("9faf3451-pyra-continent-mine.webp", 370, 340, "landmark"),
        ("a8a6859d-pyra-continent-camp.webp", 320, 260, "camp"),
        ("eed16911-pyra-continent-fire.webp", 190, 185, "camp"),
    ],
    "verdant": [
        # Lush Trees: Ancient Oaks, Willows, Birches, Pines, Olives
        ("74b2bb88-verdantia-extra-ancient-oak.webp", 460, 470, "tree"),
        ("ce21ffe1-verdantia-extra-willow.webp", 390, 410, "tree"),
        ("711c3cbc-verdantia-extra-birch.webp", 310, 390, "tree"),
        ("df63f301-verdantia-continent-pine.webp", 290, 390, "tree"),
        ("8c447433-ki-v2-objects-verdant-oak-0.webp", 340, 360, "tree"),
        ("21caeb8f-ki-v2-objects-verdant-oak-1.webp", 340, 365, "tree"),
        ("37f48ddb-ki-v2-objects-verdant-oak-2.webp", 350, 370, "tree"),
        ("9d3815c8-ki-v2-objects-verdant-oak-3.webp", 340, 360, "tree"),
        ("fe9b1faa-ki-v2-objects-verdant-tree2-0.webp", 320, 350, "tree"),
        ("f977e5a7-ki-v2-objects-verdant-tree2-2.webp", 325, 355, "tree"),
        ("ad73954b-island-4.props.olive-tree.webp", 330, 340, "tree"),
        ("b1a00069-island-5.props.silver-willow.webp", 360, 380, "tree"),
        # Flowers, Roses, Blueberries, Ferns, Mushrooms & Reeds
        ("e70f7fe7-verdantia-extra-rose.webp", 210, 195, "flora"),
        ("48c51d4d-verdantia-extra-flowers.webp", 220, 185, "flora"),
        ("27399570-verdantia-extra-blueberry.webp", 200, 180, "flora"),
        ("9031832d-nature-obj-flower-bush.webp", 215, 190, "flora"),
        ("13955587-ki-v2-objects-verdant-flowerbush-0.webp", 210, 185, "flora"),
        ("5b60f067-verdantia-extra-fern.webp", 195, 165, "flora"),
        ("c4e9e6a1-ki-v2-objects-verdant-fern-0.webp", 185, 160, "flora"),
        ("68b9d6ee-verdantia-extra-mushrooms.webp", 195, 185, "flora"),
        ("6e9e582b-ki-v2-objects-verdant-mushrooms-1.webp", 180, 170, "flora"),
        ("8f3d6df6-ki-v2-objects-verdant-reeds-5.webp", 185, 195, "flora"),
        # Waterfalls, Springs, Mossy Boulders, Shrines, Caves & Camps (100% painted die-cut continent sprites)
        ("7c9c601a-verdantia-extra-spring.webp", 360, 295, "waterfall"),
        ("7c9c601a-verdantia-extra-spring.webp", 340, 280, "landmark"),
        ("701b11e2-verdantia-continent-rocks.webp", 260, 220, "rock"),
        ("98845042-verdantia-extra-cliff.webp", 380, 320, "rock"),
        ("fa6d3bf2-verdantia-extra-shrine.webp", 310, 350, "landmark"),
        ("fc1e269d-verdantia-extra-cave.webp", 390, 350, "landmark"),
        ("29d17949-verdantia-extra-camp.webp", 330, 270, "camp"),
        ("6ceb4056-ki-v2-camps-verdant-bonfire.webp", 240, 230, "camp"),
        ("a98e0b02-verdantia-extra-arch.webp", 350, 330, "landmark"),
    ],
    "aether": [
        # Cherry Blossoms, Ginkgos, Ki Trees, Bamboo, Cypress, Snow Pines
        ("021d8442-aether-x-cherry-tree.webp", 410, 420, "tree"),
        ("a8e4292b-aetheria-continent-cherry.webp", 380, 390, "tree"),
        ("dc095c5f-aetheria-continent-ginkgo.webp", 360, 400, "tree"),
        ("89c801d4-island-2.props.ginkgo.webp", 350, 385, "tree"),
        ("4d090d85-aether-art-ki-tree.webp", 450, 460, "tree"),
        ("ac1ecb7c-aetheria-continent-bamboo.webp", 290, 420, "tree"),
        ("36107785-aetheria-continent-cypress.webp", 210, 410, "tree"),
        ("3587a851-aetheria-continent-snow-pine.webp", 290, 390, "tree"),
        ("b7fdcd43-ki-v2-objects-aether-oak-0.webp", 340, 360, "tree"),
        ("1d5e519a-ki-v2-objects-aether-oak-1.webp", 340, 360, "tree"),
        ("2b93857f-ki-v2-objects-aether-pine-3.webp", 280, 370, "tree"),
        ("ea1d036a-ki-v2-objects-aether-tree2-0.webp", 330, 360, "tree"),
        # Lavender, Sacred Flowers, Ferns, Reeds, Glowing Mushrooms
        ("5ac42fa2-aetheria-continent-lavender.webp", 240, 205, "flora"),
        ("0e381537-aetheria-continent-flowers.webp", 230, 195, "flora"),
        ("c3dedab1-aether-art-garden.webp", 420, 350, "flora"),
        ("01c5ee13-ki-v2-objects-aether-flowerbush-2.webp", 215, 190, "flora"),
        ("5b4871a3-ki-v2-objects-aether-flowerbush-3.webp", 215, 190, "flora"),
        ("f0a05edf-ki-v2-objects-aether-fern-1.webp", 185, 160, "flora"),
        ("06b95ec4-aetheria-continent-reeds.webp", 200, 210, "flora"),
        ("53ec23b9-ki-v2-objects-aether-mushrooms-0.webp", 190, 180, "flora"),
        # Waterfalls, Ki Sources, Glacier Spires, Cloud Peaks, Shrines, Ruins & Camps (100% die-cut continent sprites)
        ("21e2da3e-aetheria-continent-spring.webp", 370, 310, "waterfall"),
        ("df70d07d-aether-art-ki-source.webp", 420, 410, "landmark"),
        ("21e2da3e-aetheria-continent-spring.webp", 350, 290, "landmark"),
        ("28823ef2-aether-art-cloud-peak.webp", 450, 470, "rock"),
        ("6c34a261-aetheria-continent-glacier-ridge.webp", 410, 350, "rock"),
        ("83749d6d-aetheria-continent-peak.webp", 380, 360, "rock"),
        ("29f8b15e-aetheria-continent-cliff.webp", 380, 320, "rock"),
        ("f88f9d0e-aetheria-continent-shrine.webp", 340, 370, "landmark"),
        ("99bc8df9-aetheria-continent-ruin.webp", 370, 350, "landmark"),
        ("2676f749-aetheria-continent-cave.webp", 390, 340, "landmark"),
        ("3e13c2fe-aetheria-continent-camp.webp", 330, 270, "camp"),
        ("3cfdc1af-ki-v2-camps-aether-bonfire.webp", 240, 230, "camp"),
        ("2bb9e10a-aetheria-continent-arch.webp", 370, 340, "landmark"),
    ],
    "nexus": [
        # Crystal Trees, Cyan Trees, Violet Trees, Silver Cypress
        ("b2924462-nexus-continent-crystal-tree.webp", 360, 390, "tree"),
        ("42fbcaa4-nature-obj-crystal-tree.webp", 350, 380, "tree"),
        ("1cf54e0a-nexus-continent-cyan-tree.webp", 350, 385, "tree"),
        ("f42c644b-nexus-continent-violet-tree.webp", 350, 385, "tree"),
        ("1703df02-island-3.props.violet-tree.webp", 340, 375, "tree"),
        ("24d5db1c-nexus-continent-silver-cypress.webp", 260, 390, "tree"),
        ("ccfdd0b1-ki-v2-objects-nexus-oak-3.webp", 330, 355, "tree"),
        ("f01a8406-ki-v2-objects-nexus-pine-0.webp", 275, 365, "tree"),
        ("95e297e9-ki-v2-objects-nexus-pine-1.webp", 275, 365, "tree"),
        ("ccbfb72b-ki-v2-objects-nexus-tree2-0.webp", 320, 350, "tree"),
        ("532b8a19-ki-v2-objects-nexus-tree2-2.webp", 320, 350, "tree"),
        # Luminous Grass, Violet Bushes, Synth Ferns, Cyber Mushrooms, Reeds
        ("9b396bb1-nexus-continent-luminous-grass.webp", 210, 175, "flora"),
        ("dca04e0f-nexus-continent-violet-bush.webp", 215, 190, "flora"),
        ("382d7c5f-ki-v2-objects-nexus-flowerbush-1.webp", 210, 185, "flora"),
        ("7df6af54-ki-v2-objects-nexus-flowerbush-2.webp", 210, 185, "flora"),
        ("caef9d12-nexus-continent-fern.webp", 200, 170, "flora"),
        ("38ac99c6-ki-v2-objects-nexus-fern-0.webp", 185, 160, "flora"),
        ("fce0ef4d-nexus-continent-mushrooms.webp", 200, 190, "flora"),
        ("dcebeac3-ki-v2-objects-nexus-mushrooms-3.webp", 185, 175, "flora"),
        ("b57e1841-ki-v2-objects-nexus-reeds-0.webp", 185, 195, "flora"),
        # Monoliths, Crystal Outcrops, Tech Ruins, Caves & Camps
        ("54c3c2b2-nexus-continent-monolith.webp", 320, 430, "landmark"),
        ("3d2c4533-nexus-art-crystal.webp", 310, 360, "rock"),
        ("4c52045f-nexus-continent-crystal-outcrop.webp", 290, 310, "rock"),
        ("914e8c5c-nexus-continent-crystals.webp", 260, 270, "rock"),
        ("9eed299f-island-3.props.rose-crystals.webp", 260, 270, "rock"),
        ("c8cfa39a-nexus-continent-cliff.webp", 380, 320, "rock"),
        ("fcf607db-nexus-continent-rocks.webp", 260, 220, "rock"),
        ("32b36d65-nexus-continent-ruin.webp", 360, 340, "landmark"),
        ("b639b86b-nexus-continent-cave.webp", 390, 340, "landmark"),
        ("711e2a5b-nexus-continent-camp.webp", 330, 270, "camp"),
        ("cd607c7f-island-3.props.violet-arch.webp", 370, 340, "landmark"),
    ],
}

# All 40 Canonical NPCs (10 per continent)
NPCS_CATALOG = {
    "pyra": [
        ("pyra.npc.guide", "Kaena", "Strażniczka przysięgi", "!", -18.0, 22.0),
        ("pyra.npc.steward", "Tsubasa", "Zarządca Sali Przysięgi", "?", 0.0, -52.0),
        ("pyra.npc.smith", "Goro", "Kowal żaru", "!", -72.0, -18.0),
        ("pyra.npc.innkeeper", "Akane", "Gospodyni ogniska", "", 74.0, -18.0),
        ("pyra.npc.merchant", "Yumi", "Kupczyni klanów", "?", -64.0, 58.0),
        ("pyra.npc.trainer", "Kenzo", "Mistrz ćwiczeń", "!", 72.0, 58.0),
        ("pyra.npc.keeper", "Mitsu", "Strażniczka skarbca", "", 0.0, 82.0),
        ("pyra.npc.hunter", "Rokan", "Mistrz polowania", "!", 0.0, 148.0),
        ("pyra.npc.alchemist", "Homura", "Alchemik popiołu", "?", -118.0, 18.0),
        ("pyra.npc.warden", "Kazan", "Dowódca murów", "", 118.0, 18.0),
    ],
    "verdant": [
        ("verdant.npc.guide", "Aira", "Przewodniczka miasta", "!", -16.0, 20.0),
        ("verdant.npc.steward", "Oren", "Opiekun miasta", "?", 0.0, -56.0),
        ("verdant.npc.smith", "Taro", "Kowal", "!", -76.0, -20.0),
        ("verdant.npc.innkeeper", "Lina", "Gospodyni", "", 76.0, -20.0),
        ("verdant.npc.merchant", "Mio", "Kupczyni", "?", -68.0, 56.0),
        ("verdant.npc.trainer", "Iwo", "Mistrz treningu", "!", 72.0, 56.0),
        ("verdant.npc.keeper", "Nela", "Opiekunka depozytu", "", 0.0, 84.0),
        ("verdant.npc.hunter", "Ren", "Strażnik bramy", "!", 0.0, 148.0),
        ("verdant.npc.alchemist", "Sylwa", "Zielarka korzeni", "?", -116.0, 16.0),
        ("verdant.npc.warden", "Bram", "Kapitan przystani", "", 116.0, 16.0),
    ],
    "aether": [
        ("aether.npc.guide", "Sora", "Opiekunka źródeł", "!", -16.0, 20.0),
        ("aether.npc.steward", "Hoshi", "Zarządca Sali Rady", "?", 0.0, -54.0),
        ("aether.npc.smith", "Enso", "Rzemieślnik pieczęci", "!", -74.0, -20.0),
        ("aether.npc.innkeeper", "Yuna", "Mistrzyni herbaty", "", 74.0, -20.0),
        ("aether.npc.merchant", "Mei", "Archiwistka wymiany", "?", -66.0, 56.0),
        ("aether.npc.trainer", "Raku", "Mistrz skupienia", "!", 70.0, 56.0),
        ("aether.npc.keeper", "Kaede", "Strażniczka zwojów", "", 0.0, 82.0),
        ("aether.npc.hunter", "Ishin", "Strażnik ogrodów", "!", 0.0, 146.0),
        ("aether.npc.alchemist", "Kiri", "Alchemiczka rosy", "?", -115.0, 16.0),
        ("aether.npc.warden", "Tenzin", "Strażnik sanktuarium", "", 115.0, 16.0),
    ],
    "nexus": [
        ("nexus.npc.guide", "LYRA-7", "Przewodniczka sieci", "!", -16.0, 20.0),
        ("nexus.npc.steward", "VEGA-3", "Zarządca synchronizacji", "?", 0.0, -54.0),
        ("nexus.npc.smith", "HEF-4", "Inżynier uzbrojenia", "!", -74.0, -20.0),
        ("nexus.npc.innkeeper", "SOLA-6", "Operatorka regeneracji", "", 74.0, -20.0),
        ("nexus.npc.merchant", "MIRA-2", "Operatorka wymiany", "?", -66.0, 56.0),
        ("nexus.npc.trainer", "KRON-9", "Instruktor kalibracji", "!", 70.0, 56.0),
        ("nexus.npc.keeper", "ARCH-5", "Strażnik magazynu", "", 0.0, 82.0),
        ("nexus.npc.hunter", "AXON", "Strażnik perymetru", "!", 0.0, 146.0),
        ("nexus.npc.alchemist", "FLUX-8", "Syntezator plazmy", "?", -115.0, 16.0),
        ("nexus.npc.warden", "AEGIS-1", "Dowódca obwodu", "", 115.0, 16.0),
    ],
}

# 6 Exp-Zones per Continent (24 total) aligned strictly onto verified dry land of canonical relief_3d.r32
EXP_ZONES_CATALOG = {
    "pyra": [
        {
            "id": "pyra-exp-1",
            "name": "Kotlina Węgielków i Salamander (Lv. 1–3)",
            "cx": -315.0, "cz": 18.0, "radius": 52.0,
            "monsters": [
                ("pyra-wegielek", "Węgielek", 1, 92),
                ("pyra-ognista-salamandra", "Ognista Salamandra", 2, 100),
                ("pyra-wegielek", "Węgielek", 1, 92),
                ("pyra-ognista-salamandra", "Ognista Salamandra", 2, 100),
                ("pyra-popielny-wilk", "Popielny Wilk", 4, 183),
            ],
        },
        {
            "id": "pyra-exp-2",
            "name": "Wąwóz Popielnych Wilków (Lv. 4–6)",
            "cx": -235.0, "cz": -228.0, "radius": 54.0,
            "monsters": [
                ("pyra-popielny-wilk", "Popielny Wilk", 4, 183),
                ("pyra-popielny-wilk", "Popielny Wilk", 4, 183),
                ("pyra-skalny-berserker", "Skalny Berserker", 6, 484),
                ("pyra-skalny-berserker", "Skalny Berserker", 6, 484),
                ("pyra-ognista-salamandra", "Ognista Salamandra", 2, 100),
            ],
        },
        {
            "id": "pyra-exp-3",
            "name": "Brzeg Magmowych Krabów (Lv. 8–10)",
            "cx": -230.0, "cz": 110.0, "radius": 55.0,
            "monsters": [
                ("pyra-magmowy-krab", "Magmowy Krab", 8, 752),
                ("pyra-magmowy-krab", "Magmowy Krab", 8, 752),
                ("pyra-zarowy-nietoperz", "Żarowy Nietoperz", 10, 452),
                ("pyra-zarowy-nietoperz", "Żarowy Nietoperz", 10, 452),
                ("pyra-magmowy-krab", "Magmowy Krab", 8, 752),
            ],
        },
        {
            "id": "pyra-exp-4",
            "name": "Ruiny Golemów Popiołu (Lv. 12–14)",
            "cx": 330.0, "cz": -12.0, "radius": 55.0,
            "monsters": [
                ("pyra-golem-ruin", "Golem Ruin", 12, 1866),
                ("pyra-golem-ruin", "Golem Ruin", 12, 1866),
                ("pyra-plomien-duch", "Płomień-Duch", 14, 909),
                ("pyra-plomien-duch", "Płomień-Duch", 14, 909),
                ("pyra-zarowy-nietoperz", "Żarowy Nietoperz", 10, 452),
            ],
        },
        {
            "id": "pyra-exp-5",
            "name": "Krwawa Arena Byków (Lv. 14–16)",
            "cx": 210.0, "cz": -155.0, "radius": 54.0,
            "monsters": [
                ("pyra-byk-areny", "Byk Areny", 16, 2440),
                ("pyra-byk-areny", "Byk Areny", 16, 2440),
                ("pyra-plomien-duch", "Płomień-Duch", 14, 909),
                ("pyra-golem-ruin", "Golem Ruin", 12, 1866),
                ("pyra-byk-areny", "Byk Areny", 16, 2440),
            ],
        },
        {
            "id": "pyra-exp-6",
            "name": "Kaldera Skorpiona Obsydianowego (Lv. 16–18)",
            "cx": 188.0, "cz": 186.0, "radius": 56.0,
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
            "id": "verdant-exp-1",
            "name": "Polana Mchowych Szlamaków (Lv. 1–3)",
            "cx": -325.0, "cz": 22.0, "radius": 52.0,
            "monsters": [
                ("verdant-mchowy-szlamak", "Mchowy Szlamak", 1, 110),
                ("verdant-mchowy-szlamak", "Mchowy Szlamak", 1, 110),
                ("verdant-cierniowy-wilk", "Cierniowy Wilk", 2, 100),
                ("verdant-cierniowy-wilk", "Cierniowy Wilk", 2, 100),
                ("verdant-mala-osa", "Mała Osa", 4, 40),
            ],
        },
        {
            "id": "verdant-exp-2",
            "name": "Gaj Liściaków i Pełzaczy (Lv. 4–6)",
            "cx": -215.0, "cz": -222.0, "radius": 54.0,
            "monsters": [
                ("verdant-lisciak-skrytobojca", "Liściak Skrytobójca", 4, 142),
                ("verdant-lisciak-skrytobojca", "Liściak Skrytobójca", 4, 142),
                ("verdant-korzeniowy-pelzacz", "Korzeniowy Pełzacz", 6, 484),
                ("verdant-korzeniowy-pelzacz", "Korzeniowy Pełzacz", 6, 484),
                ("verdant-cierniowy-wilk", "Cierniowy Wilk", 2, 100),
            ],
        },
        {
            "id": "verdant-exp-3",
            "name": "Krąg Grzybowych Zarodników (Lv. 8–10)",
            "cx": 248.0, "cz": -242.0, "radius": 55.0,
            "monsters": [
                ("verdant-grzybowy-zarodnik", "Grzybowy Zarodnik", 8, 703),
                ("verdant-grzybowy-zarodnik", "Grzybowy Zarodnik", 8, 703),
                ("verdant-bursztynowa-osa", "Bursztynowa Osa", 10, 452),
                ("verdant-bursztynowa-osa", "Bursztynowa Osa", 10, 452),
                ("verdant-mala-osa", "Mała Osa", 4, 40),
            ],
        },
        {
            "id": "verdant-exp-4",
            "name": "Wzgórze Skalnych Jeleni (Lv. 12–14)",
            "cx": 330.0, "cz": 18.0, "radius": 55.0,
            "monsters": [
                ("verdant-skalny-jelen", "Skalny Jeleń", 12, 1307),
                ("verdant-skalny-jelen", "Skalny Jeleń", 12, 1307),
                ("verdant-lesny-pajak", "Leśny Pająk", 14, 1135),
                ("verdant-lesny-pajak", "Leśny Pająk", 14, 1135),
                ("verdant-bursztynowa-osa", "Bursztynowa Osa", 10, 452),
            ],
        },
        {
            "id": "verdant-exp-5",
            "name": "Gniazdo Puchaczy Pyłowych (Lv. 14–16)",
            "cx": -245.0, "cz": 245.0, "radius": 54.0,
            "monsters": [
                ("verdant-puchacz-pylowy", "Puchacz Pyłowy", 16, 1219),
                ("verdant-puchacz-pylowy", "Puchacz Pyłowy", 16, 1219),
                ("verdant-lesny-pajak", "Leśny Pająk", 14, 1135),
                ("verdant-skalny-jelen", "Skalny Jeleń", 12, 1307),
                ("verdant-puchacz-pylowy", "Puchacz Pyłowy", 16, 1219),
            ],
        },
        {
            "id": "verdant-exp-6",
            "name": "Pradawne Ruiny Strażników (Lv. 16–18)",
            "cx": 225.0, "cz": 232.0, "radius": 56.0,
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
            "id": "aether-exp-1",
            "name": "Ogród Świetlików Pieczęci (Lv. 1–3)",
            "cx": -325.0, "cz": 18.0, "radius": 52.0,
            "monsters": [
                ("aether-swietlik-pieczeci", "Świetlik Pieczęci", 1, 64),
                ("aether-swietlik-pieczeci", "Świetlik Pieczęci", 1, 64),
                ("aether-pergaminowy-straznik", "Pergaminowy Strażnik", 2, 126),
                ("aether-pergaminowy-straznik", "Pergaminowy Strażnik", 2, 126),
                ("aether-krysztalowy-motyl", "Kryształowy Motyl", 4, 123),
            ],
        },
        {
            "id": "aether-exp-2",
            "name": "Taras Kryształowych Motyli (Lv. 4–6)",
            "cx": -228.0, "cz": -225.0, "radius": 54.0,
            "monsters": [
                ("aether-krysztalowy-motyl", "Kryształowy Motyl", 4, 123),
                ("aether-krysztalowy-motyl", "Kryształowy Motyl", 4, 123),
                ("aether-szmaragdowy-waz", "Szmaragdowy Wąż", 6, 372),
                ("aether-szmaragdowy-waz", "Szmaragdowy Wąż", 6, 372),
                ("aether-pergaminowy-straznik", "Pergaminowy Strażnik", 2, 126),
            ],
        },
        {
            "id": "aether-exp-3",
            "name": "Archiwum Duchów i Skarabeuszy (Lv. 8–10)",
            "cx": 330.0, "cz": 16.0, "radius": 55.0,
            "monsters": [
                ("aether-duch-bibliotekarza", "Duch Bibliotekarza", 8, 401),
                ("aether-duch-bibliotekarza", "Duch Bibliotekarza", 8, 401),
                ("aether-zloty-skarabeusz", "Złoty Skarabeusz", 10, 969),
                ("aether-zloty-skarabeusz", "Złoty Skarabeusz", 10, 969),
                ("aether-szmaragdowy-waz", "Szmaragdowy Wąż", 6, 372),
            ],
        },
        {
            "id": "aether-exp-4",
            "name": "Dziedziniec Lwów Świątyni (Lv. 12–14)",
            "cx": -242.0, "cz": 225.0, "radius": 55.0,
            "monsters": [
                ("aether-lew-swiatyni", "Lew Świątyni", 12, 1492),
                ("aether-lew-swiatyni", "Lew Świątyni", 12, 1492),
                ("aether-oko-wiedzy", "Oko Wiedzy", 14, 1021),
                ("aether-oko-wiedzy", "Oko Wiedzy", 14, 1021),
                ("aether-zloty-skarabeusz", "Złoty Skarabeusz", 10, 969),
            ],
        },
        {
            "id": "aether-exp-5",
            "name": "Krąg Marionetek Rytuału (Lv. 14–16)",
            "cx": 212.0, "cz": -215.0, "radius": 55.0,
            "monsters": [
                ("aether-marionetka-rytualu", "Marionetka Rytuału", 16, 1626),
                ("aether-marionetka-rytualu", "Marionetka Rytuału", 16, 1626),
                ("aether-oko-wiedzy", "Oko Wiedzy", 14, 1021),
                ("aether-lew-swiatyni", "Lew Świątyni", 12, 1492),
                ("aether-marionetka-rytualu", "Marionetka Rytuału", 16, 1626),
            ],
        },
        {
            "id": "aether-exp-6",
            "name": "Sanktuarium Mgielnych Żurawi (Lv. 16–18)",
            "cx": 168.0, "cz": 182.0, "radius": 56.0,
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
            "id": "nexus-exp-1",
            "name": "Strefa Dronów i Pełzaczy (Lv. 1–3)",
            "cx": -322.0, "cz": -12.0, "radius": 52.0,
            "monsters": [
                ("nexus-dron-zwiadowca", "Dron Zwiadowca", 1, 56),
                ("nexus-dron-zwiadowca", "Dron Zwiadowca", 1, 56),
                ("nexus-pelzacz-serwisowy", "Pełzacz Serwisowy", 2, 114),
                ("nexus-pelzacz-serwisowy", "Pełzacz Serwisowy", 2, 114),
                ("nexus-skaner-gasienicowy", "Skaner Gąsienicowy", 4, 266),
            ],
        },
        {
            "id": "nexus-exp-2",
            "name": "Sektor Pająków Spawalniczych (Lv. 4–6)",
            "cx": -198.0, "cz": -202.0, "radius": 54.0,
            "monsters": [
                ("nexus-skaner-gasienicowy", "Skaner Gąsienicowy", 4, 266),
                ("nexus-skaner-gasienicowy", "Skaner Gąsienicowy", 4, 266),
                ("nexus-pajak-spawalniczy", "Pająk Spawalniczy", 6, 372),
                ("nexus-pajak-spawalniczy", "Pająk Spawalniczy", 6, 372),
                ("nexus-pelzacz-serwisowy", "Pełzacz Serwisowy", 2, 114),
            ],
        },
        {
            "id": "nexus-exp-3",
            "name": "Bateria Wieżyczek i Nanitów (Lv. 8–10)",
            "cx": 212.0, "cz": -212.0, "radius": 55.0,
            "monsters": [
                ("nexus-wiezyczka-autonomiczna", "Wieżyczka Autonomiczna", 8, 752),
                ("nexus-wiezyczka-autonomiczna", "Wieżyczka Autonomiczna", 8, 752),
                ("nexus-roj-nanitow", "Rój Nanitów", 10, 517),
                ("nexus-roj-nanitow", "Rój Nanitów", 10, 517),
                ("nexus-pajak-spawalniczy", "Pająk Spawalniczy", 6, 372),
            ],
        },
        {
            "id": "nexus-exp-4",
            "name": "Poligon Psów Łowców (Lv. 12–14)",
            "cx": 330.0, "cz": 16.0, "radius": 55.0,
            "monsters": [
                ("nexus-pies-lowca", "Pies Łowca", 12, 933),
                ("nexus-pies-lowca", "Pies Łowca", 12, 933),
                ("nexus-straznik-rdzenia", "Strażnik Rdzenia", 14, 1929),
                ("nexus-straznik-rdzenia", "Strażnik Rdzenia", 14, 1929),
                ("nexus-roj-nanitow", "Rój Nanitów", 10, 517),
            ],
        },
        {
            "id": "nexus-exp-5",
            "name": "Obwód Latarni Plazmowych (Lv. 14–16)",
            "cx": -168.0, "cz": 175.0, "radius": 54.0,
            "monsters": [
                ("nexus-latarnia-plazmowa", "Latarnia Plazmowa", 16, 1355),
                ("nexus-latarnia-plazmowa", "Latarnia Plazmowa", 16, 1355),
                ("nexus-straznik-rdzenia", "Strażnik Rdzenia", 14, 1929),
                ("nexus-pies-lowca", "Pies Łowca", 12, 933),
                ("nexus-latarnia-plazmowa", "Latarnia Plazmowa", 16, 1355),
            ],
        },
        {
            "id": "nexus-exp-6",
            "name": "Rdzeń Kruków Danych (Lv. 16–18)",
            "cx": 222.0, "cz": 225.0, "radius": 56.0,
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

# 16 Curated Scenic Wilderness POIs (4 per continent) connected by winding side-trails
WILDERNESS_POIS_CATALOG = {
    "pyra": [
        ("pyra-poi-mine", "Stara Kopalnia Popiołu", -125.0, -245.0, "9faf3451-pyra-continent-mine.webp", 430, 390),
        ("pyra-poi-cave", "Jaskinia Żaru", 115.0, -255.0, "9b0974a2-pyra-continent-cave.webp", 430, 380),
        ("pyra-poi-arch", "Wulkaniczny Łuk Przysięgi", -245.0, 110.0, "5aa5d3c0-pyra-continent-rock-arch.webp", 450, 390),
        ("pyra-poi-ruin", "Strażnica Obsydianowych Iglic", 255.0, 108.0, "5f186a05-pyra-continent-ruin.webp", 430, 400),
    ],
    "verdant": [
        ("verdant-poi-shrine", "Zapomniana Kapliczka Gaju", -110.0, -255.0, "fa6d3bf2-verdantia-extra-shrine.webp", 370, 410),
        ("verdant-poi-cave", "Grota Pradawnych Korzeni", 125.0, -260.0, "fc1e269d-verdantia-extra-cave.webp", 440, 390),
        ("verdant-poi-camp", "Obozowisko Zwiadowców Przystani", -255.0, 135.0, "29d17949-verdantia-extra-camp.webp", 390, 330),
        ("verdant-poi-spring", "Szmaragdowy Wodospad Doliny", 255.0, 132.0, "7c9c601a-verdantia-extra-spring.webp", 420, 345),
    ],
    "aether": [
        ("aether-poi-source", "Źródło Błękitnego Ki", -112.0, -258.0, "df70d07d-aether-art-ki-source.webp", 450, 440),
        ("aether-poi-shrine", "Kaplica Mgielnego Wiatru", 118.0, -255.0, "f88f9d0e-aetheria-continent-shrine.webp", 390, 420),
        ("aether-poi-ruin", "Ruiny Starych Zwojów", -255.0, 128.0, "99bc8df9-aetheria-continent-ruin.webp", 420, 395),
        ("aether-poi-cave", "Grota Kryształowych Pieczęci", 252.0, 120.0, "2676f749-aetheria-continent-cave.webp", 430, 385),
    ],
    "nexus": [
        ("nexus-poi-monolith", "Monolit Pierwszego Sygnału", -110.0, -248.0, "54c3c2b2-nexus-continent-monolith.webp", 370, 480),
        ("nexus-poi-ruin", "Zrujnowany Przekaźnik Obwodu", 115.0, -252.0, "32b36d65-nexus-continent-ruin.webp", 420, 395),
        ("nexus-poi-cave", "Podziemny Węzeł Serwisowy", -252.0, 118.0, "b639b86b-nexus-continent-cave.webp", 430, 385),
        ("nexus-poi-arch", "Kryształowa Brama Danych", 252.0, 122.0, "cd607c7f-island-3.props.violet-arch.webp", 420, 385),
    ],
}

FAUNA_CATALOG = {
    "pyra": [
        ("A-04", "Koza Skalna"),
        ("A-05", "Jaszczur Popielny"),
        ("A-06", "Bażant Żarowy"),
    ],
    "verdant": [
        ("A-01", "Zając Łąkowy"),
        ("A-02", "Kura Leśna"),
        ("A-03", "Dzik Mchowy"),
    ],
    "aether": [
        ("A-07", "Owca Księżycowa"),
        ("A-08", "Gołąb Pergaminowy"),
    ],
    "nexus": [
        ("A-09", "Bio-królik Hodowlany"),
        ("A-10", "Bio-kura Hodowlana"),
    ],
}


# ==============================================================================
# 3. FULL-CONTINENT TOPOGRAPHY, SPLINE ROADS, LAKES/OCEANS/LAVA & SCENE BUILDER
# ==============================================================================
def generate_continent(land_id: str) -> dict:
    GRID_N = 512
    WORLD_SIZE = 1024.0
    HALF = WORLD_SIZE * 0.5
    STEP = WORLD_SIZE / GRID_N  # 2.0 m per cell

    reg_dir = REGIONS_DIR / land_id
    reg_dir.mkdir(parents=True, exist_ok=True)

    n_macro = load_noise("planet_macro", (GRID_N, GRID_N))
    n_ridge = load_noise("planet_ridge", (GRID_N, GRID_N))
    n_detail = load_noise("biome_detail", (GRID_N, GRID_N))
    n_micro = load_noise("terrain_micro", (GRID_N, GRID_N))

    z_lin = np.linspace(-HALF, HALF, GRID_N, dtype=np.float32)
    x_lin = np.linspace(-HALF, HALF, GRID_N, dtype=np.float32)
    zz, xx = np.meshgrid(z_lin, x_lin, indexing="ij")
    rr = np.sqrt(xx * xx + zz * zz)

    h = np.zeros((GRID_N, GRID_N), dtype=np.float32)
    weights = np.zeros((GRID_N, GRID_N, 4), dtype=np.float32)
    # surface_rgba: R = Lava, G = Water, B = Spline Road, A = 255 - Energy/Waterfall
    lava_mask = np.zeros((GRID_N, GRID_N), dtype=np.float32)
    water_mask = np.zeros((GRID_N, GRID_N), dtype=np.float32)
    road_mask = np.zeros((GRID_N, GRID_N), dtype=np.float32)
    energy_mask = np.zeros((GRID_N, GRID_N), dtype=np.float32)

    # ------------------------------------------------------------------
    # A. Base Continent Relief + Lakes + Ocean Bays + Lava Rivers
    # ------------------------------------------------------------------
    if land_id == "pyra":
        # Multi-tiered volcanic caldera continent
        # Capital Citadel at center (r < 175m): Upper Core (r < 75m, +16m), Middle Ring (75..165m, +8m)
        upper = 1.0 - smoothstep(58.0, 76.0, rr)
        mid = (1.0 - smoothstep(155.0, 178.0, rr)) * (1.0 - upper)
        outer_hills = (n_ridge * 24.0 + n_detail * 10.0) * smoothstep(170.0, 260.0, rr)
        # NE Volcano Peak around (250, -250)
        d_volcano = np.sqrt((xx - 255.0) ** 2 + (zz + 255.0) ** 2)
        volcano_cone = np.clip(1.0 - d_volcano / 185.0, 0.0, 1.0) ** 1.3 * 44.0
        volcano_crater = (1.0 - smoothstep(48.0, 78.0, d_volcano)) * 38.0
        h = upper * 16.0 + mid * 8.0 + outer_hills + volcano_cone - volcano_crater + (n_micro - 0.5) * 1.4

        # 1) NE Volcano Crater Magma Lake
        m_crater = 1.0 - smoothstep(46.0, 68.0, d_volcano)
        # 2) SW Obsidian Magma Sea / Caldera Lake around (-255, 255)
        d_sw_lake = np.sqrt((xx + 255.0 + (n_detail - 0.5) * 35.0) ** 2 + (zz - 255.0 + (n_macro - 0.5) * 35.0) ** 2)
        m_sw_lake = 1.0 - smoothstep(82.0, 112.0, d_sw_lake)
        # 3) SE Sulfur Magma Pool around (255, 225)
        d_se_lake = np.sqrt((xx - 255.0 + (n_macro - 0.5) * 28.0) ** 2 + (zz - 225.0 + (n_detail - 0.5) * 28.0) ** 2)
        m_se_lake = 1.0 - smoothstep(58.0, 82.0, d_se_lake)
        # 4) Inner Citadel Molten Lava Canyon Moat (r ~ 104m) + 2 Plaza Magma Basins + Outer Caldera River (r ~ 202m)
        moat_angle = np.arctan2(zz, xx)
        axis_causeway = np.maximum(np.exp(-(xx ** 2) / (2.0 * 15.0 ** 2)), np.exp(-(zz ** 2) / (2.0 * 15.0 ** 2)))
        inner_moat_r = 104.0 + np.sin(moat_angle * 4.0) * 4.0
        m_inner_moat = np.exp(-((rr - inner_moat_r) ** 2) / (2.0 * 8.0 ** 2)) * (1.0 - axis_causeway * 0.95)
        m_pool_w = 1.0 - smoothstep(10.0, 16.5, np.sqrt((xx + 52.0) ** 2 + (zz - 26.0) ** 2))
        m_pool_e = 1.0 - smoothstep(10.0, 16.5, np.sqrt((xx - 52.0) ** 2 + (zz - 26.0) ** 2))

        moat_r = 202.0 + np.sin(moat_angle * 4.0) * 12.0 + (n_detail - 0.5) * 14.0
        m_moat = np.exp(-((rr - moat_r) ** 2) / (2.0 * 14.0 ** 2))
        # Diagonal Lava River channel from NE crater to SW Magma Lake
        lav_diag = np.abs((xx + zz) * 0.707 + np.sin((xx - zz) * 0.015) * 28.0)
        m_diag = np.exp(-(lav_diag ** 2) / (2.0 * 15.0 ** 2)) * smoothstep(182.0, 215.0, rr)

        lava_mask = np.clip(np.maximum.reduce([m_crater, m_sw_lake, m_se_lake, m_inner_moat, m_pool_w, m_pool_e, m_moat, m_diag]), 0.0, 1.0)
        h -= lava_mask * 5.5

    elif land_id == "verdant":
        # Lush emerald valley continent with NW mountain ridge, Great NW Emerald Lake,
        # winding Rzeka Przełomu, inner Kanał Przystani & Laguna Źródła, and Southern/Eastern Ocean Harbor Bay!
        city_plat = (1.0 - smoothstep(145.0, 175.0, rr)) * 7.5
        nw_mountains = smoothstep(-80.0, -390.0, xx + zz * 0.85) * (24.0 + n_ridge * 26.0)
        gentle_hills = (n_macro * 11.0 + n_detail * 6.5) * smoothstep(155.0, 235.0, rr)
        h = city_plat + nw_mountains + gentle_hills + (n_micro - 0.5) * 1.1

        # 0) Central Spring Lagoon (Laguna Źródła Pierwszego Oddechu, r = 15..27m) & Inner Harbor River Ring (r ~ 104m)
        axis_causeway = np.maximum(np.exp(-(xx ** 2) / (2.0 * 15.0 ** 2)), np.exp(-(zz ** 2) / (2.0 * 15.0 ** 2)))
        m_spring_lagoon = np.exp(-((rr - 21.0) ** 2) / (2.0 * 5.8 ** 2)) * (1.0 - axis_causeway * 0.90)
        harbor_canal_r = 104.0 + np.sin(np.arctan2(zz, xx) * 4.0) * 4.5
        m_harbor_canal = np.exp(-((rr - harbor_canal_r) ** 2) / (2.0 * 8.5 ** 2)) * (1.0 - axis_causeway * 0.95)

        # 1) Southern & Eastern Ocean Bay (Zatoka Oceaniczna)
        ocean_s = smoothstep(235.0, 295.0, zz + np.sin(xx * 0.014) * 26.0 + (n_detail - 0.5) * 22.0)
        ocean_e = smoothstep(330.0, 390.0, xx + np.cos(zz * 0.014) * 24.0)
        # 2) Great NW Emerald Forest Lake around (-318, -238) framing the NW highlands
        d_nw_lake = np.sqrt((xx + 318.0 + (n_detail - 0.5) * 28.0) ** 2 + (zz + 238.0 + (n_macro - 0.5) * 28.0) ** 2)
        m_nw_lake = 1.0 - smoothstep(66.0, 92.0, d_nw_lake)
        # 3) Wide Rzeka Przełomu flowing from NW Lake around the capital (r ~ 195m) into the Southern Ocean
        riv1_dist = np.abs(zz - (188.0 * np.cos(xx * 0.0065) + np.sin(xx * 0.018) * 22.0))
        m_riv1 = np.exp(-(riv1_dist ** 2) / (2.0 * 17.0 ** 2)) * smoothstep(135.0, 168.0, rr)
        # 4) Western River channel connecting NW Lake to Southern Ocean
        riv2_dist = np.abs(xx - (-195.0 + np.sin(zz * 0.015) * 26.0))
        m_riv2 = np.exp(-(riv2_dist ** 2) / (2.0 * 16.0 ** 2)) * smoothstep(-210.0, -140.0, zz)

        water_mask = np.clip(np.maximum.reduce([m_spring_lagoon, m_harbor_canal, ocean_s, ocean_e, m_nw_lake, m_riv1, m_riv2]), 0.0, 1.0)
        h = np.where(water_mask > 0.25, h - 4.2 * water_mask, h)

        # Waterfall foam where NW mountains drop into NW Lake + around the central spring fountain
        d_wf = np.sqrt((xx + 265.0) ** 2 + (zz + 245.0) ** 2)
        energy_mask = np.clip(np.maximum(1.0 - smoothstep(18.0, 42.0, d_wf), m_spring_lagoon * 0.55), 0.0, 1.0)

    elif land_id == "aether":
        # Sacred stepped concentric terraces + ring lagoon + alpine lakes + southern sky-ocean fjord
        t3 = 1.0 - smoothstep(56.0, 68.0, rr)
        t2 = (1.0 - smoothstep(135.0, 152.0, rr)) * (1.0 - t3)
        t1 = (1.0 - smoothstep(235.0, 255.0, rr)) * (1.0 - t2 - t3)
        alpine = smoothstep(250.0, 420.0, rr) * (16.0 + n_ridge * 28.0) * smoothstep(60.0, -240.0, zz)
        h = t3 * 24.0 + t2 * 13.0 + t1 * 5.0 + alpine + (n_micro - 0.5) * 0.9

        # 1) Sacred Ring Lagoon around the Upper Sanctuary (r = 76..102 m)
        m_ring_lagoon = np.exp(-((rr - 88.0) ** 2) / (2.0 * 11.5 ** 2))
        # Leave 4 dry causeways along N, S, E, W axes so roads cross cleanly
        axis_clear = np.maximum(np.exp(-(xx ** 2) / (2.0 * 15.0 ** 2)), np.exp(-(zz ** 2) / (2.0 * 15.0 ** 2)))
        m_ring_lagoon *= (1.0 - axis_clear * 0.95)

        # 2) NW & NE Mirror Alpine Lakes positioned scenically beside the NW/NE combat terraces
        d_lake_nw = np.sqrt((xx + 325.0) ** 2 + (zz + 245.0) ** 2)
        d_lake_ne = np.sqrt((xx - 325.0) ** 2 + (zz + 245.0) ** 2)
        m_lake_nw = 1.0 - smoothstep(54.0, 78.0, d_lake_nw)
        m_lake_ne = 1.0 - smoothstep(54.0, 78.0, d_lake_ne)

        # 3) Southern Sky-Ocean Fjord & Twin Cascade Streams
        ocean_s = smoothstep(355.0, 415.0, zz + np.cos(xx * 0.012) * 24.0)
        stream_w = np.exp(-((xx + 195.0 - np.sin(zz * 0.016) * 20.0) ** 2) / (2.0 * 14.0 ** 2)) * smoothstep(-195.0, 360.0, zz)
        stream_e = np.exp(-((xx - 195.0 + np.sin(zz * 0.016) * 20.0) ** 2) / (2.0 * 14.0 ** 2)) * smoothstep(-195.0, 360.0, zz)

        water_mask = np.clip(np.maximum.reduce([m_ring_lagoon, m_lake_nw, m_lake_ne, ocean_s, stream_w, stream_e]), 0.0, 1.0)
        h -= water_mask * 4.2

        # Glowing Ki Waterfall foam at lake outlets
        wf1 = 1.0 - smoothstep(16.0, 38.0, np.sqrt((xx + 195.0) ** 2 + (zz + 135.0) ** 2))
        wf2 = 1.0 - smoothstep(16.0, 38.0, np.sqrt((xx - 195.0) ** 2 + (zz + 135.0) ** 2))
        energy_mask = np.clip(np.maximum(wf1, wf2), 0.0, 1.0)

    elif land_id == "nexus":
        # Angular cyber-industrial terraces + Southern/Western Deep Ocean Harbor + NE Cooling Lake + Cyan Plasma Conduits
        oct_d = np.maximum(np.maximum(np.abs(xx), np.abs(zz)), (np.abs(xx) + np.abs(zz)) * 0.7071)
        upper_core = 1.0 - smoothstep(68.0, 78.0, oct_d)
        mid_deck = (1.0 - smoothstep(158.0, 172.0, oct_d)) * (1.0 - upper_core)
        outer_synth = (np.round(n_ridge * 4.0) / 4.0) * 16.0 * smoothstep(175.0, 260.0, oct_d)
        h = upper_core * 18.0 + mid_deck * 9.0 + outer_synth + (n_micro - 0.5) * 0.7

        # 1) Southern & Western Deep Ocean Industrial Harbor (Port Zerowy)
        ocean_s = smoothstep(355.0, 410.0, zz + np.sin(xx * 0.015) * 18.0)
        ocean_w = smoothstep(-355.0, -410.0, xx + np.cos(zz * 0.015) * 18.0)
        # 2) NE Geometric Cooling Reservoir Lake around (235, -215)
        d_cool = np.maximum(np.abs(xx - 235.0), np.abs(zz + 215.0))
        m_cool = 1.0 - smoothstep(56.0, 76.0, d_cool)
        water_mask = np.clip(np.maximum.reduce([ocean_s, ocean_w, m_cool]), 0.0, 1.0)
        h = np.where(water_mask > 0.25, -5.0 * water_mask, h)

        # 3) Glowing Cyan Plasma Canals & Energy Conduits (surface.a)
        ring_canal = np.exp(-((oct_d - 106.0) ** 2) / (2.0 * 7.5 ** 2))
        diag_canal = np.exp(-((np.abs(xx) - np.abs(zz)) ** 2) / (2.0 * 7.0 ** 2)) * smoothstep(72.0, 320.0, oct_d)
        energy_mask = np.clip(np.maximum(ring_canal, diag_canal), 0.0, 1.0)
        h -= energy_mask * 1.8

    # ------------------------------------------------------------------
    # B. 6 Exp-Zone Combat Clearings ("Expowiska") — Natural Amphitheaters (Zero Artificial C-Puddles!)
    # ------------------------------------------------------------------
    exp_zones = EXP_ZONES_CATALOG[land_id]
    wild_pois = WILDERNESS_POIS_CATALOG[land_id]

    for ez in exp_zones:
        ecx, ecz, erad = ez["cx"], ez["cz"], ez["radius"]
        d_ez = np.sqrt((xx - ecx) ** 2 + (zz - ecz) ** 2)
        ez_flat = 1.0 - smoothstep(erad * 0.62, erad * 1.02, d_ez)
        if np.max(ez_flat) > 0.01:
            ci = int(np.clip((ecz + HALF) / WORLD_SIZE * GRID_N, 0, GRID_N - 1))
            cj = int(np.clip((ecx + HALF) / WORLD_SIZE * GRID_N, 0, GRID_N - 1))
            target_h = max(float(h[ci, cj]), 5.5)
            # Gentle terraced natural glade floor with micro-relief (no flat stamp)
            h = h * (1.0 - ez_flat) + (target_h + (n_micro - 0.5) * 0.9) * ez_flat
            # Keep combat floor & immediate perimeter clear of water/lava puddles
            clear_liq = 1.0 - smoothstep(erad * 0.92, erad * 0.64, d_ez)
            water_mask *= clear_liq
            lava_mask *= clear_liq
            # Subtle weathered flagstone clearing center (organic noise-modulated edge, never a hard circle!)
            organic_r = d_ez + (n_detail - 0.5) * 14.0
            clearing_floor = (1.0 - smoothstep(erad * 0.25, erad * 0.56, organic_r)) * 0.62
            road_mask = np.maximum(road_mask, clearing_floor)

    # Flatten small scenic viewpoints for the 4 Wilderness POIs
    for _pid, _ptitle, px, pz, _pspr, _pw, _ph in wild_pois:
        d_p = np.sqrt((xx - px) ** 2 + (zz - pz) ** 2)
        p_flat = 1.0 - smoothstep(22.0, 38.0, d_p)
        if np.max(p_flat) > 0.01:
            ci = int(np.clip((pz + HALF) / WORLD_SIZE * GRID_N, 0, GRID_N - 1))
            cj = int(np.clip((px + HALF) / WORLD_SIZE * GRID_N, 0, GRID_N - 1))
            target_h = max(float(h[ci, cj]), 5.5)
            h = h * (1.0 - p_flat) + target_h * p_flat
            clear_l = 1.0 - smoothstep(32.0, 18.0, d_p)
            water_mask *= clear_l
            lava_mask *= clear_l

    # ------------------------------------------------------------------
    # C. Two-Tier Catmull-Rom Wilderness Road & Scenic Footpath Network
    #    Tier 1: Grand Paved Highways (Capital Gates -> 4 Crossroads Waystations -> 6 Exp-Zones)
    #    Tier 2: Winding Wilderness Dirt/Flagstone Footpaths (linking Exp-Zones & 16 Scenic POIs)
    # ------------------------------------------------------------------
    plaza_m = (1.0 - smoothstep(30.0, 42.0, rr)) * (1.0 - np.clip(water_mask * 1.4, 0.0, 1.0)) * (1.0 - np.clip(lava_mask * 1.4, 0.0, 1.0))
    inner_ring = np.exp(-((rr - 64.0) ** 2) / (2.0 * 5.5 ** 2))
    outer_city_ring = np.exp(-((rr - 148.0) ** 2) / (2.0 * 6.0 ** 2))
    road_mask = np.maximum.reduce([road_mask, plaza_m, inner_ring, outer_city_ring])

    # 4 Scenic Crossroads Waystations just outside each capital gate
    crossroads = [
        ("W", (-175.0, 0.0), (-238.0, 6.0)),
        ("E", (175.0, 0.0), (238.0, -4.0)),
        ("N", (0.0, -175.0), (0.0, -228.0)),
        ("S", (0.0, 175.0), (0.0, 206.0)),
    ]
    # Format: (control_points, width_m, road_strength, tier)
    spline_defs: list[tuple[list[tuple[float, float]], float, float, str]] = [
        # 4 Main City-to-Gate Avenues -> Crossroads Waystations
        ([(0.0, 0.0), (-85.0, 0.0), (-175.0, 0.0), (-238.0, 6.0)], 15.5, 1.0, "highway"),
        ([(0.0, 0.0), (85.0, 0.0), (175.0, 0.0), (238.0, -4.0)], 15.5, 1.0, "highway"),
        ([(0.0, 0.0), (0.0, -85.0), (0.0, -175.0), (0.0, -228.0)], 15.5, 1.0, "highway"),
        ([(0.0, 0.0), (0.0, 85.0), (0.0, 175.0), (0.0, 206.0)], 15.5, 1.0, "highway"),
    ]

    # Tier 1 Highways: Route each Exp-Zone via graceful S-curve from its nearest Crossroads Waystation
    waystation_pts = [cr[2] for cr in crossroads]
    highway_curves: list[np.ndarray] = []
    exp_approach_dirs: dict[str, tuple[float, float]] = {}
    for idx, ez in enumerate(exp_zones):
        ecx, ecz = ez["cx"], ez["cz"]
        best_ws = min(waystation_pts, key=lambda p: (p[0] - ecx) ** 2 + (p[1] - ecz) ** 2)
        dx_w = ecx - best_ws[0]
        dz_w = ecz - best_ws[1]
        seg_len = max(math.hypot(dx_w, dz_w), 1.0)
        px_n, pz_n = -dz_w / seg_len, dx_w / seg_len
        bend = 24.0 if idx % 2 == 0 else -24.0
        p1 = (best_ws[0] + dx_w * 0.36 + px_n * bend, best_ws[1] + dz_w * 0.36 + pz_n * bend)
        p2 = (best_ws[0] + dx_w * 0.72 - px_n * bend * 0.65, best_ws[1] + dz_w * 0.72 - pz_n * bend * 0.65)
        spline_defs.append(([best_ws, p1, p2, (ecx, ecz)], 13.8, 1.0, "highway"))
        # Store approach unit vector pointing from exp-zone back toward road entrance (for gateway arch!)
        exp_approach_dirs[ez["id"]] = ((p2[0] - ecx) / max(math.hypot(p2[0] - ecx, p2[1] - ecz), 1.0),
                                       (p2[1] - ecz) / max(math.hypot(p2[0] - ecx, p2[1] - ecz), 1.0))

    # Tier 2 Scenic Winding Footpaths linking all 4 Wilderness POIs to nearest Crossroads & Exp-Zones
    for p_idx, (_pid, _ptitle, px, pz, _pspr, _pw, _ph) in enumerate(wild_pois):
        best_ws = min(waystation_pts, key=lambda p: (p[0] - px) ** 2 + (p[1] - pz) ** 2)
        best_ez = min(exp_zones, key=lambda e: (e["cx"] - px) ** 2 + (e["cz"] - pz) ** 2)
        mx1 = 0.5 * (best_ws[0] + px) + (18.0 if p_idx % 2 == 0 else -18.0)
        mz1 = 0.5 * (best_ws[1] + pz) + (-16.0 if p_idx % 2 == 0 else 16.0)
        spline_defs.append(([best_ws, (mx1, mz1), (px, pz)], 8.8, 0.80, "footpath"))
        mx2 = 0.5 * (px + best_ez["cx"]) + (-15.0 if p_idx % 2 == 0 else 15.0)
        mz2 = 0.5 * (pz + best_ez["cz"]) + (14.0 if p_idx % 2 == 0 else -14.0)
        spline_defs.append(([(px, pz), (mx2, mz2), (best_ez["cx"], best_ez["cz"])], 8.2, 0.76, "footpath"))

    # Tier 2 Perimeter Wilderness Trail Loop linking neighboring Exp-Zones around the continent
    ez_ordered = sorted(exp_zones, key=lambda e: math.atan2(e["cz"], e["cx"]))
    for i in range(len(ez_ordered)):
        p_a = (ez_ordered[i]["cx"], ez_ordered[i]["cz"])
        p_b = (ez_ordered[(i + 1) % len(ez_ordered)]["cx"], ez_ordered[(i + 1) % len(ez_ordered)]["cz"])
        mx = 0.5 * (p_a[0] + p_b[0]) * 0.90 + (16.0 if i % 2 == 0 else -16.0)
        mz = 0.5 * (p_a[1] + p_b[1]) * 0.90 + (-14.0 if i % 2 == 0 else 14.0)
        spline_defs.append(([p_a, (mx, mz), p_b], 8.4, 0.74, "footpath"))

    bridge_locations: list[tuple[float, float]] = []

    for ctrl_pts, r_width, r_strength, tier in spline_defs:
        curve = catmull_rom_spline(ctrl_pts, samples_per_seg=120)
        if tier == "highway":
            highway_curves.append(curve)
        c_pts = curve
        dx = xx[..., None] - c_pts[None, None, :, 0]
        dz = zz[..., None] - c_pts[None, None, :, 1]
        d_min = np.min(np.sqrt(dx * dx + dz * dz), axis=-1)

        # Slightly organic weathered edges on footpaths
        edge_jit = (n_detail - 0.5) * (2.6 if tier == "footpath" else 1.2)
        seg_mask = (1.0 - smoothstep(r_width * 0.42, r_width * 0.88, d_min + edge_jit)) * r_strength
        road_mask = np.maximum(road_mask, seg_mask)

        # Where any road crosses water or lava, raise a flat bridge deck and clear liquid cleanly
        crossing = (seg_mask > 0.30) & ((water_mask > 0.35) | (lava_mask > 0.35))
        if np.any(crossing):
            h = np.where(crossing, np.maximum(h, 4.8), h)
            water_mask = np.where(seg_mask > 0.38, water_mask * 0.12, water_mask)
            lava_mask = np.where(seg_mask > 0.38, lava_mask * 0.12, lava_mask)
            energy_mask = np.where(seg_mask > 0.38, energy_mask * 0.12, energy_mask)
            ys, xs = np.where(crossing)
            bx = float(np.mean(x_lin[xs]))
            bz = float(np.mean(z_lin[ys]))
            if all((bx - ox) ** 2 + (bz - oz) ** 2 > 52.0 ** 2 for ox, oz in bridge_locations):
                bridge_locations.append((bx, bz))

    # Never let road_mask overwrite open water or lava pools outside bridge crossings
    road_mask = np.where((water_mask > 0.35) | (lava_mask > 0.35), 0.0, road_mask)

    # Copy owner's accepted hand-painted terrain & water textures from ports/godot-pyra/assets/lands/<land_id>/terrain/
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
            src_p = src_terrain_dir / src_name
            if src_p.exists():
                Image.open(src_p).convert("RGB").save(reg_dir / dst_name)

    # ------------------------------------------------------------------
    # D. Compute Normals, Spline Weights, Surface RGBA & Walkable Mask
    # ------------------------------------------------------------------
    normal_rgb, shade = compute_normal_and_hillshade(h, cell_size_m=STEP)
    slope = 1.0 - (normal_rgb[..., 2].astype(np.float32) / 255.0)

    w_cliff = smoothstep(0.08, 0.24, slope)
    w_road = np.clip(road_mask, 0.0, 1.0)
    w_accent = np.clip(n_detail * 0.65 + smoothstep(14.0, 32.0, h) * 0.45, 0.0, 1.0) * (1.0 - w_road) * (1.0 - w_cliff)
    w_base = np.clip(1.0 - w_cliff - w_road - w_accent, 0.0, 1.0)

    weights[..., 0] = w_base
    weights[..., 1] = w_accent
    weights[..., 2] = w_road
    weights[..., 3] = w_cliff
    w_sum = np.sum(weights, axis=-1, keepdims=True) + 1e-6
    weights /= w_sum

    # Save binary height.r32, normal.png, weights.png, surface.png, walkable.u8
    h.astype(np.float32).tofile(reg_dir / "height.r32")
    Image.fromarray(normal_rgb, mode="RGB").save(reg_dir / "normal.png")
    Image.fromarray(np.clip(weights * 255.0, 0, 255).astype(np.uint8), mode="RGBA").save(reg_dir / "weights.png")

    surf_rgba = np.zeros((GRID_N, GRID_N, 4), dtype=np.uint8)
    surf_rgba[..., 0] = np.clip(lava_mask * 255.0, 0, 255).astype(np.uint8)
    surf_rgba[..., 1] = np.clip(water_mask * 255.0, 0, 255).astype(np.uint8)
    surf_rgba[..., 2] = np.clip(road_mask * 255.0, 0, 255).astype(np.uint8)
    surf_rgba[..., 3] = np.clip((1.0 - energy_mask) * 255.0, 0, 255).astype(np.uint8)
    Image.fromarray(surf_rgba, mode="RGBA").save(reg_dir / "surface.png")

    walkable = ((slope < 0.28) & (lava_mask < 0.35) & (water_mask < 0.35)) | (road_mask > 0.30)
    walk_u8 = np.where(walkable, 255, 0).astype(np.uint8)
    walk_u8.tofile(reg_dir / "walkable.u8")

    def sample_h(wx: float, wz: float) -> float:
        ci = int(np.clip((wz + HALF) / WORLD_SIZE * GRID_N, 0, GRID_N - 1))
        cj = int(np.clip((wx + HALF) / WORLD_SIZE * GRID_N, 0, GRID_N - 1))
        return float(h[ci, cj])

    def is_dry_ground(wx: float, wz: float, clear_road: bool = True) -> bool:
        ci = int(np.clip((wz + HALF) / WORLD_SIZE * GRID_N, 0, GRID_N - 1))
        cj = int(np.clip((wx + HALF) / WORLD_SIZE * GRID_N, 0, GRID_N - 1))
        if lava_mask[ci, cj] > 0.20 or water_mask[ci, cj] > 0.20:
            return False
        if clear_road and road_mask[ci, cj] > 0.24:
            return False
        return True

    # ------------------------------------------------------------------
    # E. Assemble Capital Architecture, Perimeter Walls, Gates, Towers & Bridges
    # ------------------------------------------------------------------
    arch = ARCH_CATALOG[land_id]
    buildings_list = []

    def add_bldg(b_id: str, title: str, role: str, asset_key: str, wx: float, wz: float) -> None:
        tex_file, w_px, h_px = arch[asset_key]
        buildings_list.append({
            "id": b_id,
            "title": title,
            "role": role,
            "sprite": f"res://assets/objects/{tex_file}",
            "w": w_px,
            "h": h_px,
            "x": round(wx, 2),
            "z": round(wz, 2),
            "y": round(sample_h(wx, wz), 2),
        })

    if land_id == "pyra":
        add_bldg("pyra-fortress", "Twierdza Popiołu (Cytadela)", "landmark", "fortress", 0.0, -76.0)
        add_bldg("pyra-hall", "Sala Przysięgi", "hall", "hall", 0.0, -24.0)
        add_bldg("pyra-altar", "Ołtarz Płomiennego Pojedynku", "landmark", "altar", -118.0, -98.0)
        add_bldg("pyra-statue", "Kolos Areny Dziedzictwa", "landmark", "statue", 118.0, -98.0)
        add_bldg("pyra-smithy", "Kuźnia Żaru", "smithy", "smithy", -82.0, -22.0)
        add_bldg("pyra-inn", "Gospoda Ogniska", "inn", "inn", 82.0, -22.0)
        add_bldg("pyra-shop", "Targ Klanów", "shop", "shop", -72.0, 48.0)
        add_bldg("pyra-arena", "Arena Krwi i Popiołu", "arena", "arena", 76.0, 48.0)
        add_bldg("pyra-depot", "Skarbiec Twierdzy", "depot", "depot", 0.0, 128.0)
        for idx, (hx, hz) in enumerate([
            (-135.0, -45.0), (-142.0, 28.0), (-125.0, 105.0),
            (135.0, -45.0), (142.0, 28.0), (125.0, 105.0),
            (-48.0, -124.0), (48.0, -124.0), (-52.0, 132.0), (52.0, 132.0),
        ]):
            add_bldg(f"pyra-house-{idx}", "Dom Klanowy", "house", "house", hx, hz)
        for g_idx, (gx, gz) in enumerate([(-172.0, 0.0), (172.0, 0.0), (0.0, -172.0), (0.0, 172.0)]):
            add_bldg(f"pyra-gate-{g_idx}", "Brama Cytadeli", "gate", "gate", gx, gz)
        for t_idx, (tx, tz) in enumerate([(-155.0, -155.0), (155.0, -155.0), (-155.0, 155.0), (155.0, 155.0)]):
            add_bldg(f"pyra-tower-{t_idx}", "Baszta Strażnicza", "tower", "tower", tx, tz)
        for w_idx, (wx, wz, w_key) in enumerate([
            (-115.0, -162.0, "wall_ne"), (-58.0, -168.0, "wall_ne"), (58.0, -168.0, "wall_ne"), (115.0, -162.0, "wall_ne"),
            (-115.0, 162.0, "wall_ne"), (-58.0, 168.0, "wall_ne"), (58.0, 168.0, "wall_ne"), (115.0, 162.0, "wall_ne"),
            (-168.0, -108.0, "wall_nw"), (-168.0, -52.0, "wall_nw"), (-168.0, 52.0, "wall_nw"), (-168.0, 108.0, "wall_nw"),
            (168.0, -108.0, "wall_nw"), (168.0, -52.0, "wall_nw"), (168.0, 52.0, "wall_nw"), (168.0, 108.0, "wall_nw"),
        ]):
            add_bldg(f"pyra-wall-{w_idx}", "Mur Oporowy Cytadeli", "wall", w_key, wx, wz)
        for b_idx, (bx, bz) in enumerate([
            (-36.0, -36.0), (36.0, -36.0), (-36.0, 36.0), (36.0, 36.0),
            (-24.0, 145.0), (24.0, 145.0), (-24.0, -145.0), (24.0, -145.0),
        ]):
            add_bldg(f"pyra-brazier-{b_idx}", "Koksownik Żaru", "prop", "brazier", bx, bz)
        for l_idx, (lx, lz) in enumerate([
            (-65.0, 0.0), (65.0, 0.0), (0.0, -65.0), (0.0, 65.0),
            (-125.0, 0.0), (125.0, 0.0), (0.0, 125.0),
        ]):
            add_bldg(f"pyra-lantern-{l_idx}", "Latarnia Uliczna", "prop", "lantern", lx, lz)

    elif land_id == "verdant":
        add_bldg("verdant-fountain", "Źródło Pierwszego Oddechu (Fontanna Rynku)", "landmark", "fountain", 0.0, 0.0)
        add_bldg("verdant-hall", "Dom Zgromadzeń", "hall", "hall", 0.0, -68.0)
        add_bldg("verdant-forge", "Korzenna Kuźnia Pradawnych Rytów", "landmark", "forge", -125.0, -95.0)
        add_bldg("verdant-cottage", "Dom Podwójnego Echa", "landmark", "cottage", 125.0, -95.0)
        add_bldg("verdant-smithy", "Kuźnia Korzeni", "smithy", "smithy", -82.0, -22.0)
        add_bldg("verdant-inn", "Karczma Pod Liściem", "inn", "inn", 82.0, -22.0)
        add_bldg("verdant-shop", "Zielony Targ", "shop", "shop", -72.0, 48.0)
        add_bldg("verdant-arena", "Krąg Łowców", "arena", "arena", 76.0, 48.0)
        add_bldg("verdant-depot", "Magazyn Przystani", "depot", "depot", 0.0, 128.0)
        for idx, (hx, hz) in enumerate([
            (-138.0, -45.0), (-142.0, 28.0), (-125.0, 108.0),
            (138.0, -45.0), (142.0, 28.0), (125.0, 108.0),
            (-52.0, -122.0), (52.0, -122.0), (-54.0, 132.0), (54.0, 132.0),
        ]):
            add_bldg(f"verdant-house-{idx}", "Dom Ogrodowy", "house", "house", hx, hz)
        for g_idx, (gx, gz) in enumerate([(-172.0, 0.0), (172.0, 0.0), (0.0, -172.0), (0.0, 172.0)]):
            add_bldg(f"verdant-gate-{g_idx}", "Brama Korzeni", "gate", "arch", gx, gz)
        for w_idx, (wx, wz, w_key) in enumerate([
            (-110.0, -165.0, "wall_ne"), (-55.0, -168.0, "wall_ne"), (55.0, -168.0, "wall_ne"), (110.0, -165.0, "wall_ne"),
            (-110.0, 165.0, "wall_ne"), (-55.0, 168.0, "wall_ne"), (55.0, 168.0, "wall_ne"), (110.0, 165.0, "wall_ne"),
            (-168.0, -105.0, "wall_nw"), (-168.0, -52.0, "wall_nw"), (-168.0, 52.0, "wall_nw"), (-168.0, 105.0, "wall_nw"),
            (168.0, -105.0, "wall_nw"), (168.0, -52.0, "wall_nw"), (168.0, 52.0, "wall_nw"), (168.0, 105.0, "wall_nw"),
        ]):
            add_bldg(f"verdant-wall-{w_idx}", "Mur Zielonej Przystani", "wall", w_key, wx, wz)
        for l_idx, (lx, lz) in enumerate([
            (-42.0, -42.0), (42.0, -42.0), (-42.0, 42.0), (42.0, 42.0),
            (-78.0, 0.0), (78.0, 0.0), (0.0, 78.0), (0.0, 140.0),
        ]):
            add_bldg(f"verdant-lamp-{l_idx}", "Latarnia Przystani", "prop", "lamp", lx, lz)

    elif land_id == "aether":
        add_bldg("aether-sanctum", "Sanktuarium Pustej Paginy", "landmark", "sanctum", 0.0, -68.0)
        add_bldg("aether-hall", "Pawilon Tysiąca Źródeł", "hall", "hall", 0.0, -12.0)
        add_bldg("aether-koi", "Staw Lustrzeń i Karpi Koi", "landmark", "koi_pond", 0.0, 42.0)
        add_bldg("aether-observatory", "Wschodnie Obserwatorium Sygnałów", "landmark", "observatory", 132.0, -95.0)
        add_bldg("aether-archive", "Zachodnie Archiwum Imion", "landmark", "archive", -132.0, -95.0)
        add_bldg("aether-smithy", "Kuźnia Pieczęci", "smithy", "smithy", -115.0, -18.0)
        add_bldg("aether-inn", "Herbaciarnia Obłoków", "inn", "inn", 115.0, -18.0)
        add_bldg("aether-shop", "Dom Wymiany Zwojów", "shop", "shop", -112.0, 64.0)
        add_bldg("aether-arena", "Krąg Skupienia Ki", "arena", "arena", 118.0, 64.0)
        add_bldg("aether-depot", "Skarbiec Zwojów", "depot", "depot", 0.0, 118.0)
        for idx, (hx, hz) in enumerate([
            (-145.0, -52.0), (-148.0, 24.0), (-132.0, 112.0),
            (145.0, -52.0), (148.0, 24.0), (132.0, 112.0),
            (-54.0, -128.0), (54.0, -128.0), (-54.0, 138.0), (54.0, 138.0),
        ]):
            add_bldg(f"aether-house-{idx}", "Pawilon Uczonych", "house", "house", hx, hz)
        for g_idx, (gx, gz) in enumerate([(-175.0, 0.0), (175.0, 0.0), (0.0, -175.0), (0.0, 175.0)]):
            add_bldg(f"aether-gate-{g_idx}", "Brama Duchów", "gate", "spirit_gate", gx, gz)
        for w_idx, (wx, wz, w_key) in enumerate([
            (-112.0, -168.0, "wall_ne"), (-56.0, -172.0, "wall_ne"), (56.0, -172.0, "wall_ne"), (112.0, -168.0, "wall_ne"),
            (-112.0, 168.0, "wall_ne"), (-56.0, 172.0, "wall_ne"), (56.0, 172.0, "wall_ne"), (112.0, 168.0, "wall_ne"),
            (-172.0, -108.0, "wall_nw"), (-172.0, -54.0, "wall_nw"), (-172.0, 54.0, "wall_nw"), (-172.0, 108.0, "wall_nw"),
            (172.0, -108.0, "wall_nw"), (172.0, -54.0, "wall_nw"), (172.0, 54.0, "wall_nw"), (172.0, 108.0, "wall_nw"),
        ]):
            add_bldg(f"aether-wall-{w_idx}", "Marmurowa Balustrada Tarasu", "wall", w_key, wx, wz)
        for l_idx, (lx, lz) in enumerate([
            (-38.0, -38.0), (38.0, -38.0), (-38.0, 38.0), (38.0, 38.0),
            (-86.0, 0.0), (86.0, 0.0), (0.0, -86.0), (0.0, 86.0),
        ]):
            add_bldg(f"aether-lantern-{l_idx}", "Kamienna Latarnia", "prop", "lantern", lx, lz)

    elif land_id == "nexus":
        add_bldg("nexus-reactor-core", "Rdzeń Przeciążonej Pamięci (Główny Reaktor)", "landmark", "reactor_art", 0.0, -68.0)
        add_bldg("nexus-hall", "Węzeł Świadomości (Centrum)", "hall", "hall", 0.0, -8.0)
        add_bldg("nexus-garden", "Syntetyczny Ogród Obwodów", "landmark", "tech_garden", 0.0, 48.0)
        add_bldg("nexus-lab-w", "Laboratorium Pierwszej Kalibracji", "landmark", "field_lab", -128.0, -95.0)
        add_bldg("nexus-reactor-e", "Reaktor Pomocniczy Sektor-2", "landmark", "reactor", 128.0, -95.0)
        add_bldg("nexus-smithy", "Zakład Uzbrojenia HEF-4", "smithy", "smithy", -95.0, -18.0)
        add_bldg("nexus-inn", "Stacja Regeneracji SOLA-6", "inn", "inn", 95.0, -18.0)
        add_bldg("nexus-shop", "Terminal Wymiany MIRA-2", "shop", "shop", -92.0, 62.0)
        add_bldg("nexus-arena", "Poligon Kalibracji Bojowej", "arena", "arena", 96.0, 62.0)
        add_bldg("nexus-depot", "Magazyn Rdzeni ARCH-5", "depot", "depot", 0.0, 108.0)
        for idx, (hx, hz) in enumerate([
            (-142.0, -48.0), (-145.0, 26.0), (-128.0, 108.0),
            (142.0, -48.0), (145.0, 26.0), (128.0, 108.0),
            (-52.0, -125.0), (52.0, -125.0), (-52.0, 134.0), (52.0, 134.0),
        ]):
            add_bldg(f"nexus-house-{idx}", "Moduł Mieszkalny", "house", "house", hx, hz)
        for g_idx, (gx, gz) in enumerate([(-175.0, 0.0), (175.0, 0.0), (0.0, -175.0), (0.0, 175.0)]):
            add_bldg(f"nexus-gate-{g_idx}", "Brama Tranzytowa", "gate", "transit_gate", gx, gz)
        for w_idx, (wx, wz, w_key) in enumerate([
            (-112.0, -168.0, "wall_ne"), (-56.0, -172.0, "wall_ne"), (56.0, -172.0, "wall_ne"), (112.0, -168.0, "wall_ne"),
            (-112.0, 168.0, "wall_ne"), (-56.0, 172.0, "wall_ne"), (56.0, 172.0, "wall_ne"), (112.0, 168.0, "wall_ne"),
            (-172.0, -108.0, "wall_nw"), (-172.0, -54.0, "wall_nw"), (-172.0, 54.0, "wall_nw"), (-172.0, 108.0, "wall_nw"),
            (172.0, -108.0, "wall_nw"), (172.0, -54.0, "wall_nw"), (172.0, 54.0, "wall_nw"), (172.0, 108.0, "wall_nw"),
        ]):
            add_bldg(f"nexus-wall-{w_idx}", "Mur Obwodu Bezpieczeństwa", "wall", w_key, wx, wz)
        for p_idx, (px, pz) in enumerate([
            (-42.0, -42.0), (42.0, -42.0), (-42.0, 42.0), (42.0, 42.0),
            (-82.0, 0.0), (82.0, 0.0), (0.0, -82.0), (0.0, 82.0),
        ]):
            add_bldg(f"nexus-pylon-{p_idx}", "Pylon Energetyczny", "prop", "pylon", px, pz)

    # Add Painted Bridges at River/Lava Crossings
    bridge_key = "bridge" if "bridge" in arch else ("arch" if "arch" in arch else "transit_gate")
    for b_idx, (bx, bz) in enumerate(bridge_locations[:10]):
        add_bldg(f"{land_id}-bridge-{b_idx}", "Most Szlaku", "bridge", bridge_key, bx, bz)

    # Add the 4 Curated Scenic Wilderness POIs as named landmarks in buildings_list
    for pid, ptitle, px, pz, pspr, pw, ph in wild_pois:
        buildings_list.append({
            "id": pid,
            "title": ptitle,
            "role": "landmark",
            "sprite": f"res://assets/objects/{pspr}",
            "w": pw,
            "h": ph,
            "x": round(px, 2),
            "z": round(pz, 2),
            "y": round(sample_h(px, pz), 2),
        })

    # Add Roadside Lanterns/Braziers/Pylons lining every wilderness Highway!
    road_light_key = "lantern" if "lantern" in arch else ("lamp" if "lamp" in arch else "pylon")
    placed_lights: list[tuple[float, float]] = []
    for h_idx, h_curve in enumerate(highway_curves):
        # Sample along curve every ~52m outside city walls (r > 188m)
        dist_acc = 0.0
        for si in range(1, len(h_curve)):
            p0 = h_curve[si - 1]
            p1 = h_curve[si]
            step_d = float(math.hypot(p1[0] - p0[0], p1[1] - p0[1]))
            dist_acc += step_d
            if dist_acc < 52.0:
                continue
            dist_acc = 0.0
            rx, rz = float(p1[0]), float(p1[1])
            if math.hypot(rx, rz) < 188.0:
                continue
            if any(math.hypot(rx - ez["cx"], rz - ez["cz"]) < ez["radius"] * 0.78 for ez in exp_zones):
                continue
            tx = (p1[0] - p0[0]) / max(step_d, 1e-4)
            tz = (p1[1] - p0[1]) / max(step_d, 1e-4)
            side = 1.0 if (len(placed_lights) % 2 == 0) else -1.0
            lx = rx - tz * 14.5 * side
            lz = rz + tx * 14.5 * side
            if not is_dry_ground(lx, lz, clear_road=True):
                lx = rx + tz * 14.5 * side
                lz = rz - tx * 14.5 * side
            if is_dry_ground(lx, lz, clear_road=True) and all((lx - ox) ** 2 + (lz - oz) ** 2 > 38.0 ** 2 for ox, oz in placed_lights):
                placed_lights.append((lx, lz))
                add_bldg(f"{land_id}-roadlight-{len(placed_lights)}", "Latarnia Szlaku", "prop", road_light_key, lx, lz)

    # ------------------------------------------------------------------
    # F. Assemble 10 Capital NPCs, 30 Monsters in 6 Exp-Zones & 16 Fauna Animals
    # ------------------------------------------------------------------
    npcs_list = []
    for actor_id, name, role, q_mark, nx, nz in NPCS_CATALOG[land_id]:
        npcs_list.append({
            "actor_id": actor_id,
            "name": name,
            "role": role,
            "quest_mark": q_mark,
            "x": round(nx, 2),
            "z": round(nz, 2),
            "y": round(sample_h(nx, nz), 2),
            "patrol_radius": 18.0,
        })

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
            dist = 16.0 + (m_idx % 2) * 11.0
            mx = ecx + math.cos(ang) * dist
            mz = ecz + math.sin(ang) * dist
            monsters_list.append({
                "actor_id": m_id,
                "name": m_name,
                "level": m_lv,
                "hp": m_hp,
                "exp_zone": ez["id"],
                "x": round(mx, 2),
                "z": round(mz, 2),
                "y": round(sample_h(mx, mz), 2),
                "patrol_radius": 18.0,
            })

    rng = random.Random(f"fauna_{land_id}_20261118")
    fauna_list = []
    fauna_species = FAUNA_CATALOG[land_id]
    tries = 0
    while len(fauna_list) < 18 and tries < 500:
        tries += 1
        fx = rng.uniform(-400.0, 400.0)
        fz = rng.uniform(-340.0, 340.0)
        if math.hypot(fx, fz) < 185.0:
            continue
        if not is_dry_ground(fx, fz, clear_road=False):
            continue
        sp_id, sp_name = fauna_species[len(fauna_list) % len(fauna_species)]
        fauna_list.append({
            "actor_id": sp_id,
            "name": sp_name,
            "x": round(fx, 2),
            "z": round(fz, 2),
            "y": round(sample_h(fx, fz), 2),
            "patrol_radius": 24.0,
        })

    # ------------------------------------------------------------------
    # G. Curated Crossroads Waystations, Exp-Zone Gateway Arches, POI Vignettes & Natural Ecological Groves
    # ------------------------------------------------------------------
    props_catalog = FLORA_AND_PROPS_CATALOG[land_id]
    props_list = []

    perimeter_items = [p for p in props_catalog if p[3] in ("camp", "landmark", "rock")]
    tree_items = [p for p in props_catalog if p[3] == "tree"]
    flora_items = [p for p in props_catalog if p[3] == "flora"]
    rock_items = [p for p in props_catalog if p[3] == "rock"]
    camp_items = [p for p in props_catalog if p[3] == "camp"]
    arch_items = [p for p in props_catalog if ("arch" in p[0] or "ruin" in p[0] or "shrine" in p[0])]
    waterfall_items = [p for p in props_catalog if p[3] == "waterfall"]

    def append_prop(pid: str, item: tuple, px: float, pz: float, scale: float = 1.0) -> None:
        props_list.append({
            "id": pid,
            "kind": item[3],
            "sprite": f"res://assets/objects/{item[0]}",
            "w": int(item[1] * scale),
            "h": int(item[2] * scale),
            "x": round(px, 2),
            "z": round(pz, 2),
            "y": round(sample_h(px, pz), 2),
        })

    # 1) 4 Scenic Crossroads Waystations (camp, campfire/bonfire, boulders & framing trees beside each crossroads)
    for cr_idx, (cr_dir, _g_pt, (cx, cz)) in enumerate(crossroads):
        offsets = [(-22.0, -18.0), (22.0, -18.0), (-24.0, 20.0), (24.0, 20.0)]
        for oi, (ox, oz) in enumerate(offsets):
            px, pz = cx + ox, cz + oz
            if not is_dry_ground(px, pz, clear_road=True):
                continue
            if oi == 0 and camp_items:
                append_prop(f"{land_id}-ws-{cr_dir}-camp", camp_items[0], px, pz, 1.05)
            elif oi == 1 and len(camp_items) > 1:
                append_prop(f"{land_id}-ws-{cr_dir}-fire", camp_items[1], px, pz, 1.0)
            elif oi == 2 and tree_items:
                append_prop(f"{land_id}-ws-{cr_dir}-tree", tree_items[cr_idx % len(tree_items)], px, pz, 1.08)
            elif rock_items:
                append_prop(f"{land_id}-ws-{cr_dir}-rock", rock_items[cr_idx % len(rock_items)], px, pz, 0.95)

    # 2) Frame each of the 6 Exp-Zones with an Entrance Gateway Arch + Scenic Perimeter Clusters
    for ez_idx, ez in enumerate(exp_zones):
        ecx, ecz, erad = ez["cx"], ez["cz"], ez["radius"]
        # Entrance gateway arch flanking the incoming highway
        adx, adz = exp_approach_dirs.get(ez["id"], (0.0, -1.0))
        if arch_items:
            gx = ecx + adx * (erad * 0.78) - adz * 14.0
            gz = ecz + adz * (erad * 0.78) + adx * 14.0
            if is_dry_ground(gx, gz, clear_road=False):
                append_prop(f"{ez['id']}-gateway", arch_items[ez_idx % len(arch_items)], gx, gz, 1.05)
        for k in range(10):
            ang = (2.0 * math.pi * k) / 10.0 + 0.18
            px = ecx + math.cos(ang) * (erad * 0.94)
            pz = ecz + math.sin(ang) * (erad * 0.94)
            if not is_dry_ground(px, pz, clear_road=True):
                continue
            pool = perimeter_items if (k % 2 == 0) else (tree_items + flora_items)
            item = pool[(ez_idx * 3 + k) % len(pool)]
            append_prop(f"{ez['id']}-frame-{k}", item, px, pz, rng.uniform(0.92, 1.12))

    # 3) Storytelling Vignettes around the 4 Curated Wilderness POIs (campfires, rocks, flowers, framing trees)
    for poi_idx, (pid, _ptitle, px, pz, _pspr, _pw, _ph) in enumerate(wild_pois):
        for k in range(6):
            ang = (2.0 * math.pi * k) / 6.0 + 0.45
            rad = 24.0 + (k % 2) * 10.0
            qx = px + math.cos(ang) * rad
            qz = pz + math.sin(ang) * rad
            if not is_dry_ground(qx, qz, clear_road=True):
                continue
            if k == 0 and camp_items:
                item = camp_items[poi_idx % len(camp_items)]
            elif k in (1, 3) and tree_items:
                item = tree_items[(poi_idx * 2 + k) % len(tree_items)]
            elif k in (2, 4) and flora_items:
                item = flora_items[(poi_idx * 3 + k) % len(flora_items)]
            else:
                item = rock_items[poi_idx % len(rock_items)]
            append_prop(f"{pid}-vig-{k}", item, qx, qz, rng.uniform(0.90, 1.12))

    # 4) Place Waterfalls at lake/river cliffs in Verdantia & Aetheria
    if waterfall_items:
        wf_item = waterfall_items[0]
        wf_coords = [(-265.0, -245.0), (-185.0, -255.0)] if land_id == "verdant" else [(-195.0, -135.0), (195.0, -135.0)]
        for w_i, (wx, wz) in enumerate(wf_coords):
            append_prop(f"{land_id}-waterfall-{w_i}", wf_item, wx, wz, 1.0)

    # 5) Scatter 36 ornamental city trees/gardens inside the capital (outside roads & building footprints)
    city_tries = 0
    city_flora_count = 0
    city_pool = tree_items + flora_items
    while city_flora_count < 36 and city_tries < 550:
        city_tries += 1
        px = rng.uniform(-155.0, 155.0)
        pz = rng.uniform(-155.0, 155.0)
        if math.hypot(px, pz) < 38.0:
            continue
        if not is_dry_ground(px, pz, clear_road=True):
            continue
        if any(math.hypot(px - b["x"], pz - b["z"]) < 26.0 for b in buildings_list):
            continue
        item = city_pool[(city_flora_count * 3) % len(city_pool)]
        append_prop(f"{land_id}-city-flora-{city_flora_count}", item, px, pz, 0.85)
        city_flora_count += 1

    # 6) 32 Natural Ecological Wilderness Groves (3-5 clustered trees + undergrowth flora + boulders per grove!)
    groves_placed = 0
    grove_tries = 0
    while groves_placed < 32 and grove_tries < 900:
        grove_tries += 1
        gx = rng.uniform(-440.0, 440.0)
        gz = rng.uniform(-380.0, 380.0)
        if math.hypot(gx, gz) < 192.0:
            continue
        if not is_dry_ground(gx, gz, clear_road=True):
            continue
        if any(math.hypot(gx - ez["cx"], gz - ez["cz"]) < ez["radius"] * 1.02 for ez in exp_zones):
            continue
        if any(math.hypot(gx - wp[2], gz - wp[3]) < 42.0 for wp in wild_pois):
            continue
        groves_placed += 1
        # Core canopy trees (3-4 per grove)
        n_trees = 3 + (groves_placed % 2)
        for ti in range(n_trees):
            ang = (2.0 * math.pi * ti) / n_trees + rng.uniform(-0.35, 0.35)
            rad = rng.uniform(5.0, 22.0)
            tx, tz = gx + math.cos(ang) * rad, gz + math.sin(ang) * rad
            if is_dry_ground(tx, tz, clear_road=True):
                t_item = tree_items[(groves_placed * 5 + ti) % len(tree_items)]
                append_prop(f"{land_id}-grove-{groves_placed}-t{ti}", t_item, tx, tz, rng.uniform(0.88, 1.18))
        # Undergrowth bushes, ferns, flowers, mushrooms (3 per grove)
        for fi in range(3):
            ang = rng.uniform(0.0, 2.0 * math.pi)
            rad = rng.uniform(10.0, 28.0)
            fx, fz = gx + math.cos(ang) * rad, gz + math.sin(ang) * rad
            if is_dry_ground(fx, fz, clear_road=True):
                f_item = flora_items[(groves_placed * 7 + fi) % len(flora_items)]
                append_prop(f"{land_id}-grove-{groves_placed}-f{fi}", f_item, fx, fz, rng.uniform(0.85, 1.15))
        # Natural rocky outcrop / crystal spire nestled beside grove
        rx, rz = gx + rng.uniform(-24.0, 24.0), gz + rng.uniform(-24.0, 24.0)
        if is_dry_ground(rx, rz, clear_road=True) and rock_items:
            r_item = rock_items[groves_placed % len(rock_items)]
            append_prop(f"{land_id}-grove-{groves_placed}-r", r_item, rx, rz, rng.uniform(0.86, 1.12))

    region_payload = {
        "land_id": land_id,
        "world_size": WORLD_SIZE,
        "grid_size": GRID_N,
        "safe_city_radius": 180.0,
        "buildings": buildings_list,
        "npcs": npcs_list,
        "exp_zones": exp_zones_out,
        "monsters": monsters_list,
        "fauna": fauna_list,
        "props": props_list,
    }
    with open(reg_dir / "buildings.json", "w", encoding="utf-8") as f:
        json.dump(region_payload, f, ensure_ascii=False, indent=2)

    # Preserve owner-accepted canonical cartographic minimap_hq.png (built by build_canonical_maps.py)
    if not (reg_dir / "minimap_hq.png").exists():
        render_premium_minimap(
            land_id=land_id,
            reg_dir=reg_dir,
            h=h,
            shade=shade,
            weights=weights,
            lava_mask=lava_mask,
            water_mask=water_mask,
            road_mask=road_mask,
            energy_mask=energy_mask,
            buildings_list=buildings_list,
            props_list=props_list,
            exp_zones_out=exp_zones_out,
            world_size=WORLD_SIZE,
        )

    return {
        "land_id": land_id,
        "grid_size": GRID_N,
        "world_size_m": WORLD_SIZE,
        "height_min_m": round(float(np.min(h)), 2),
        "height_max_m": round(float(np.max(h)), 2),
        "walkable_ratio": round(float(np.mean(walkable)), 3),
        "buildings_count": len(buildings_list),
        "npcs_count": len(npcs_list),
        "exp_zones_count": len(exp_zones_out),
        "monsters_count": len(monsters_list),
        "fauna_count": len(fauna_list),
        "props_count": len(props_list),
    }


def render_premium_minimap(
    land_id: str,
    reg_dir: Path,
    h: np.ndarray,
    shade: np.ndarray,
    weights: np.ndarray,
    lava_mask: np.ndarray,
    water_mask: np.ndarray,
    road_mask: np.ndarray,
    energy_mask: np.ndarray,
    buildings_list: list[dict],
    props_list: list[dict],
    exp_zones_out: list[dict],
    world_size: float,
) -> None:
    """Renders a crisp 1024x1024 top-down satellite/cartographic map directly from real biome textures,
    hillshaded 3D relief, elevation contour lines, organic water/lava/roads, building footprints, and tree canopies."""
    M = 1024
    half = world_size * 0.5

    def up_arr(arr: np.ndarray) -> np.ndarray:
        img = Image.fromarray(np.clip(arr * 255.0, 0, 255).astype(np.uint8), mode="L")
        return np.asarray(img.resize((M, M), Image.Resampling.BILINEAR), dtype=np.float32) / 255.0

    def load_tiled(fname: str, tiles: int) -> np.ndarray:
        p = reg_dir / fname
        if not p.exists():
            return np.full((M, M, 3), 0.35, dtype=np.float32)
        t_sz = max(32, M // tiles)
        tile = np.asarray(Image.open(p).convert("RGB").resize((t_sz, t_sz), Image.Resampling.BICUBIC), dtype=np.float32) / 255.0
        reps = (M // t_sz) + 1
        return np.tile(tile, (reps, reps, 1))[:M, :M, :]

    c0 = load_tiled("mat_0.png", 16)
    c1 = load_tiled("mat_1.png", 16)
    c2 = load_tiled("mat_2.png", 20)
    c3 = load_tiled("mat_3.png", 14)

    w0 = up_arr(weights[..., 0])
    w1 = up_arr(weights[..., 1])
    w2 = up_arr(weights[..., 2])
    w3 = up_arr(weights[..., 3])
    w_sum = np.maximum(w0 + w1 + w2 + w3, 1e-4)

    rgb = (c0 * w0[..., None] + c1 * w1[..., None] + c2 * w2[..., None] + c3 * w3[..., None]) / w_sum[..., None]

    # Directional hillshade + gentle topographic contour lines every 8m
    sh = up_arr(np.clip((shade - 0.30) / 0.85, 0.0, 1.0)) * 0.72 + 0.42
    h_min, h_max = float(np.min(h)), float(np.max(h))
    h_up = up_arr((h - h_min) / max(h_max - h_min, 1e-4)) * (h_max - h_min) + h_min
    contour = np.abs(((h_up / 8.0) - np.floor(h_up / 8.0)) - 0.5)
    contour_line = np.clip(1.0 - contour / 0.032, 0.0, 1.0) * 0.14
    rgb = rgb * sh[..., None] * (1.0 - contour_line[..., None])

    # Crisp spline roads with subtle dark masonry curb border
    rd = up_arr(road_mask)
    rd_edge = np.clip((rd - 0.14) / 0.24, 0.0, 1.0) * (1.0 - np.clip((rd - 0.42) / 0.24, 0.0, 1.0))
    road_col = c2 * 0.82 + np.array([0.18, 0.16, 0.12], dtype=np.float32)
    rgb = rgb * (1.0 - np.clip(rd * 1.15, 0.0, 0.92)[..., None]) + road_col * np.clip(rd * 1.15, 0.0, 0.92)[..., None]
    rgb *= (1.0 - rd_edge[..., None] * 0.32)

    # Natural bathymetric water with damp shoreline bank and delicate surf
    wm = up_arr(water_mask)
    wet_bank = np.clip((wm - 0.04) / 0.16, 0.0, 1.0) * (1.0 - np.clip((wm - 0.22) / 0.14, 0.0, 1.0))
    rgb *= (1.0 - wet_bank[..., None] * 0.28)
    shallow = np.array([0.11, 0.56, 0.68], dtype=np.float32)
    deep = np.array([0.04, 0.22, 0.44], dtype=np.float32)
    depth_t = np.clip((wm - 0.22) / 0.65, 0.0, 1.0)[..., None]
    w_col = shallow * (1.0 - depth_t) + deep * depth_t
    shore_foam = np.clip((wm - 0.18) / 0.10, 0.0, 1.0) * (1.0 - np.clip((wm - 0.30) / 0.14, 0.0, 1.0))
    w_col = w_col * (1.0 - shore_foam[..., None] * 0.42) + np.array([0.85, 0.95, 0.98], dtype=np.float32) * (shore_foam[..., None] * 0.42)
    w_blend = np.clip((wm - 0.14) / 0.20, 0.0, 1.0)[..., None]
    rgb = rgb * (1.0 - w_blend) + w_col * w_blend

    # Volcanic lava with scorched basalt bank and glowing molten core
    lm = up_arr(lava_mask)
    scorch = np.clip((lm - 0.04) / 0.16, 0.0, 1.0) * (1.0 - np.clip((lm - 0.24) / 0.16, 0.0, 1.0))
    rgb *= (1.0 - scorch[..., None] * 0.48)
    crust = np.array([0.22, 0.06, 0.03], dtype=np.float32)
    magma = np.array([0.96, 0.34, 0.05], dtype=np.float32)
    core = np.array([1.0, 0.84, 0.28], dtype=np.float32)
    l_t1 = np.clip((lm - 0.16) / 0.36, 0.0, 1.0)[..., None]
    l_t2 = np.clip((lm - 0.55) / 0.38, 0.0, 1.0)[..., None]
    l_col = (crust * (1.0 - l_t1) + magma * l_t1) * (1.0 - l_t2) + core * l_t2
    l_blend = np.clip((lm - 0.14) / 0.22, 0.0, 1.0)[..., None]
    rgb = rgb * (1.0 - l_blend) + l_col * l_blend

    # Cyan plasma conduits / waterfall mist
    em = up_arr(energy_mask)
    e_col = np.array([0.18, 0.86, 0.98], dtype=np.float32)
    e_blend = np.clip((em - 0.15) / 0.32, 0.0, 0.88)[..., None]
    rgb = rgb * (1.0 - e_blend) + e_col * e_blend

    img = Image.fromarray(np.clip(rgb * 255.0, 0, 255).astype(np.uint8), mode="RGB").convert("RGBA")
    overlay = Image.new("RGBA", (M, M), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    def to_px(wx: float, wz: float) -> tuple[float, float]:
        return ((wx + half) / world_size * M, (wz + half) / world_size * M)

    # Tree & flora canopy clusters with subtle drop shadow
    canopy_palette = {
        "pyra": (122, 54, 34, 210),
        "verdant": (42, 108, 44, 215),
        "aether": (176, 108, 148, 205),
        "nexus": (52, 134, 152, 205),
    }
    c_col = canopy_palette.get(land_id, (56, 112, 58, 210))
    for p in props_list:
        kind = p.get("kind", "")
        if kind not in ("tree", "rock", "landmark", "camp"):
            continue
        px, py = to_px(float(p["x"]), float(p["z"]))
        rad = 6.5 if kind == "tree" else (7.5 if kind == "landmark" else 4.5)
        draw.ellipse((px - rad + 2, py - rad + 2, px + rad + 2, py + rad + 2), fill=(8, 8, 10, 95))
        fill_c = c_col if kind == "tree" else ((136, 128, 118, 210) if kind == "rock" else (218, 174, 88, 220))
        draw.ellipse((px - rad, py - rad, px + rad, py + rad), fill=fill_c, outline=(24, 20, 18, 130))

    # Architectural rooftops, fortification walls, towers, gates & bridges
    roof_palette = {
        "pyra": (184, 58, 36, 245),
        "verdant": (64, 154, 58, 245),
        "aether": (46, 156, 138, 245),
        "nexus": (76, 178, 214, 245),
    }
    r_col = roof_palette.get(land_id, (190, 150, 90, 245))
    for b in buildings_list:
        role = b.get("role", "building")
        bx, by = to_px(float(b["x"]), float(b["z"]))
        if role == "prop":
            continue
        if role == "wall":
            draw.rectangle((bx - 10, by - 5, bx + 10, by + 5), fill=(96, 92, 96, 235), outline=(28, 24, 24, 220))
        elif role == "bridge":
            draw.rectangle((bx - 14, by - 7, bx + 14, by + 7), fill=(172, 146, 108, 245), outline=(42, 30, 22, 240))
        elif role == "tower" or role == "gate":
            draw.rectangle((bx - 10, by - 10, bx + 10, by + 10), fill=(138, 122, 106, 245), outline=(245, 212, 132, 230))
        elif role == "house":
            draw.rectangle((bx - 7, by - 6, bx + 7, by + 6), fill=(154, 132, 108, 235), outline=(36, 28, 24, 220))
        else:
            sz = 14 if role in ("landmark", "hall") else 11
            draw.rectangle((bx - sz + 3, by - sz + 3, bx + sz + 3, by + sz + 3), fill=(10, 8, 8, 135))
            draw.rectangle((bx - sz, by - sz, bx + sz, by + sz), fill=r_col, outline=(252, 226, 152, 245), width=2)

    # Subtle safe-city ring border & exp-zone combat clearing rings
    city_r = (180.0 / world_size) * M
    draw.ellipse((M * 0.5 - city_r, M * 0.5 - city_r, M * 0.5 + city_r, M * 0.5 + city_r), outline=(246, 214, 132, 120), width=2)
    for ez in exp_zones_out:
        ex, ey = to_px(float(ez["x"]), float(ez["z"]))
        er = (float(ez.get("radius", 52.0)) * 0.55 / world_size) * M
        draw.ellipse((ex - er, ey - er, ex + er, ey + er), outline=(255, 112, 74, 165), width=2)

    out_img = Image.alpha_composite(img, overlay).convert("RGB")
    out_img.save(reg_dir / "minimap_hq.png", optimize=True)


def composite_real_planet_atlas() -> None:
    """Composites the ACTUAL 4 generated continents (minimap_hq.png) directly inside their exact
    traced coastlines (data/map.json outlines) onto the Planet Superior equirectangular texture,
    so BOTH the 2D Planet Map and the 3D Planet Globe display the real live game world."""
    map_json_path = OUT_ROOT / "data" / "map.json"
    base_globe_path = OUT_ROOT / "assets" / "map" / "globe-color.webp"
    if not map_json_path.exists() or not base_globe_path.exists():
        return

    map_data = json.loads(map_json_path.read_text(encoding="utf-8"))
    map_w = float(map_data.get("mapW", 2000.0))
    map_h = float(map_data.get("mapH", 1000.0))

    W, H = 2048, 1024
    base_img = Image.open(base_globe_path).convert("RGB").resize((W, H), Image.Resampling.BICUBIC)
    canvas = np.asarray(base_img, dtype=np.float32)

    sx = W / map_w
    sy = H / map_h

    for region in map_data.get("regions", []):
        rid = str(region.get("id", ""))
        if rid not in ("pyra", "verdant", "aether", "nexus"):
            continue
        hq_path = REGIONS_DIR / rid / "minimap_hq.png"
        if not hq_path.exists():
            continue
        outline = region.get("outline", [])
        if not outline:
            continue

        # Rasterize the exact continent polygon (handling horizontal wrap-around across 0 / W)
        mask_img = Image.new("L", (W, H), 0)
        mdraw = ImageDraw.Draw(mask_img)
        pts_base = [(float(pt[0]) * sx, float(pt[1]) * sy) for pt in outline]
        for shift_x in (-W, 0, W):
            shifted = [(x + shift_x, y) for (x, y) in pts_base]
            mdraw.polygon(shifted, fill=255)

        # Softly erode/feather mask so natural painted coastline beaches blend seamlessly
        soft_mask = np.asarray(mask_img.filter(ImageFilter.GaussianBlur(radius=5.0)), dtype=np.float32) / 255.0
        inner_mask = np.clip((soft_mask - 0.35) / 0.55, 0.0, 1.0)

        # Find unwrapped bounding box around the continent center
        center = region.get("center", region.get("label", [map_w * 0.5, map_h * 0.5]))
        if isinstance(center, dict):
            cx = float(center.get("x", map_w * 0.5)) * sx
            cy = float(center.get("y", map_h * 0.5)) * sy
        else:
            cx = float(center[0]) * sx
            cy = float(center[1]) * sy
        unwrapped_x = []
        unwrapped_y = []
        for x, y in pts_base:
            dx = x - cx
            if dx > W * 0.5:
                dx -= W
            elif dx < -W * 0.5:
                dx += W
            unwrapped_x.append(cx + dx)
            unwrapped_y.append(y)
        min_x, max_x = min(unwrapped_x), max(unwrapped_x)
        min_y, max_y = min(unwrapped_y), max(unwrapped_y)
        bw = max(64, int(round(max_x - min_x)))
        bh = max(64, int(round(max_y - min_y)))

        cont_img = Image.open(hq_path).convert("RGB").resize((bw, bh), Image.Resampling.LANCZOS)
        cont_arr = np.asarray(cont_img, dtype=np.float32)

        # Tile into a full WxH buffer at (min_x, min_y) with horizontal modulo wrap
        full_cont = np.zeros((H, W, 3), dtype=np.float32)
        ys = np.arange(bh) + int(round(min_y))
        valid_y = (ys >= 0) & (ys < H)
        ys_valid = ys[valid_y]
        xs_mod = (np.arange(bw) + int(round(min_x))) % W
        full_cont[np.ix_(ys_valid, xs_mod)] = cont_arr[valid_y, :, :]

        # Blend 88% real continent render with 12% original painted relief shading inside the coastline
        alpha = (inner_mask * 0.88)[..., None]
        canvas = canvas * (1.0 - alpha) + full_cont * alpha

    out_atlas = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), mode="RGB")
    out_atlas.save(ATLAS_DIR / "planet_real_world.png", optimize=True)
    out_atlas.save(OUT_ROOT / "assets" / "map" / "globe-real-world.webp", "WEBP", quality=92, method=6)
    print("REAL_PLANET_ATLAS_DONE:", ATLAS_DIR / "planet_real_world.png")


def main() -> None:
    print("Generating Planet Superior 2D Relief Atlas (2048x1024)...")
    atlas_meta = generate_planet_atlas()

    regions_meta = {}
    for land_id in ["pyra", "verdant", "aether", "nexus"]:
        print(f"Generating 1024x1024m Full Continent + Spline Roads + 6 Exp-Zones + Lakes/Oceans/Lava for {land_id}...")
        regions_meta[land_id] = generate_continent(land_id)

    if not (ATLAS_DIR / "planet_real_world.png").exists():
        print("Compositing REAL 4 Continents onto Planet Superior 2D Map & 3D Globe Texture (2048x1024)...")
        composite_real_planet_atlas()
    else:
        print("Preserving owner-accepted canonical planet_real_world.png & globe-real-world.webp.")

    manifest = {
        "planet": "Superior",
        "atlas_resolution": [2048, 1024],
        "continents": atlas_meta["continents"],
        "quest_islands": atlas_meta["quest_islands"],
        "archipelagos": atlas_meta["archipelagos"],
        "capital_regions": regions_meta,
    }
    with open(ATLAS_DIR / "topography_manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("TOPOGRAPHY_DONE:", json.dumps(regions_meta, ensure_ascii=False))


if __name__ == "__main__":
    main()
