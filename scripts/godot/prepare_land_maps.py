#!/usr/bin/env python3
"""Detailed map of every land, painted from the published terrain grids (no generated artwork).

The 32-unit land/biome grids and the 16-unit road mask that the ground shader already uses are turned into one painted
overview: smooth biome colours with a little texture and hill shading, a sea that darkens away from the coast with a soft
foam line, lakes and rivers in lighter water, lava or crystal where the world marks impassable ground, and the published
roads. Replaces the debug-looking `map-hi.webp` as the in-game "Mapa szczegółowa".
"""
import json, pathlib, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[2]
PORT = ROOT / "ports/godot-pyra"
LANDS = ["pyra", "verdant", "aether", "nexus"] + [f"island-{i}" for i in range(1, 7)]
PALETTE = {
    "pyra": ([(0.68, 0.42, 0.25), (0.47, 0.32, 0.27), (0.30, 0.25, 0.26), (0.74, 0.37, 0.21)], (1.0, 0.45, 0.12), (0.10, 0.30, 0.38)),
    "verdant": ([(0.50, 0.69, 0.28), (0.22, 0.47, 0.22), (0.65, 0.63, 0.52), (0.34, 0.53, 0.40)], None, (0.10, 0.36, 0.42)),
    "aether": ([(0.82, 0.88, 0.80), (0.56, 0.76, 0.62), (0.80, 0.83, 0.93), (0.66, 0.86, 0.96)], None, (0.16, 0.42, 0.55)),
    "nexus": ([(0.30, 0.40, 0.45), (0.30, 0.56, 0.52), (0.56, 0.59, 0.64), (0.39, 0.31, 0.47)], (0.35, 0.78, 0.98), (0.07, 0.25, 0.40)),
}
SET_OF = {"island-1": "aether", "island-2": "aether", "island-3": "aether", "island-4": "verdant", "island-5": "verdant", "island-6": "pyra"}
rng = np.random.default_rng(7)


def noise(shape, cells):
    """Smooth value noise: random grid with `cells` columns, bicubic-resized to `shape` (h, w)."""
    h, w = shape
    g = rng.random((max(2, round(cells * h / w)), cells)).astype(np.float32)
    return np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255.0


def blur(a, r):
    return np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), np.float32) / 255.0


def process(land):
    base = PORT / "assets/lands" / land
    palette, special, deep = PALETTE[SET_OF.get(land, land)]
    ctrl_land = np.asarray(Image.open(base / "ctrl-land.png").convert("RGB"), np.float32) / 255.0
    ctrl_biome = np.asarray(Image.open(base / "ctrl-biome.png").convert("RGB"), np.float32) / 255.0
    gh, gw = ctrl_land.shape[:2]
    W = 2048
    H = round(W * gh / gw)
    up = lambda a, mode=Image.BICUBIC: np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).resize((W, H), mode), np.float32) / 255.0
    land_m = blur(up(ctrl_land[..., 0]), 2.2)
    land_m = np.clip((land_m - 0.5) * 3.2 + 0.5, 0, 1)
    weights = [up(ctrl_biome[..., i]) for i in range(3)]
    weights.append(np.clip(land_m - sum(weights), 0, 1))
    total = np.maximum(sum(weights), 1e-3)
    colour = sum(w[..., None] / total[..., None] * np.array(c, np.float32) for w, c in zip(weights, palette))
    # texture and hill shading
    grain = (noise((H, W), 90) - 0.5) * 0.10 + (noise((H, W), 28) - 0.5) * 0.16 + (noise((H, W), 9) - 0.5) * 0.14
    height = blur(weights[2] + 0.5 * weights[1], 9) + noise((H, W), 14) * 0.25
    gy, gx = np.gradient(blur(height, 2.5))
    shade = np.clip((-gx * 0.8 - gy * 1.0) * 26.0, -0.5, 0.5)
    land_col = np.clip(colour * (1.0 + grain[..., None] + shade[..., None] * 0.32), 0, 1)
    if special is not None:
        molten = blur(up(ctrl_land[..., 1]), 1.2)[..., None]
        glow = np.array(special, np.float32) * (0.85 + 0.25 * noise((H, W), 60)[..., None])
        land_col = land_col * (1 - molten) + glow * molten
    # sea: darker away from the coast, light foam on the shore
    dist = blur(land_m, 38)
    depth = np.clip(1.0 - dist * 1.7, 0, 1) ** 0.8
    shallow = np.array([min(1.0, d + 0.34) for d in deep], np.float32)
    sea = shallow * (1 - depth[..., None]) + np.array(deep, np.float32) * depth[..., None]
    sea += (noise((H, W), 70)[..., None] - 0.5) * 0.05
    coast = np.exp(-(((blur(land_m, 3.0) - 0.5) / 0.14) ** 2))[..., None]
    sea = sea * (1 - coast * 0.5) + np.array([0.86, 0.93, 0.95], np.float32) * coast * 0.5
    out = sea * (1 - land_m[..., None]) + land_col * land_m[..., None]
    # published roads: dark casing + warm core
    road = np.asarray(Image.open(base / "road-mask.png").convert("L"), np.float32) / 255.0
    klass = Image.open(base / "road-class.png").convert("L").resize(road.shape[::-1], Image.NEAREST)
    main_road = (np.asarray(klass, np.float32) > 5) & (np.asarray(klass, np.float32) < 30)   # class 0: roads and city paths only
    road = blur(np.asarray(Image.fromarray((road * main_road * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), np.float32) / 255.0, 2.2) * 1.7
    road = np.clip(road, 0, 1)
    world_w = json.load(open(PORT / "data/lands" / land / "land.json"))["width"]
    cutoff = 0.30 + min(0.42, max(0.0, (W / world_w - 0.03) * 3.0))   # small islands are drawn at a larger scale: thinner roads
    core = np.clip((road - cutoff) * 5, 0, 1)
    casing = blur(core, 1.4) * 1.6
    out = out * (1 - np.clip(casing, 0, 0.6)[..., None]) + np.array([0.10, 0.07, 0.05], np.float32) * np.clip(casing, 0, 0.6)[..., None]
    out = out * (1 - core[..., None] * 0.92) + np.array([0.93, 0.80, 0.52], np.float32) * core[..., None] * 0.92
    # gentle vignette
    yy, xx = np.mgrid[0:H, 0:W]
    v = 1 - 0.28 * np.clip(((xx / W - 0.5) ** 2 + (yy / H - 0.5) ** 2) * 2.2, 0, 1)
    out *= v[..., None]
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(base / "map.webp", quality=88, method=6)
    print(land, (W, H))


if __name__ == "__main__":
    for land in (sys.argv[1:] or LANDS):
        process(land)
