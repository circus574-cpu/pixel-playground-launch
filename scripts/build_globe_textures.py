#!/usr/bin/env python3
"""Derive the /mapa 3D globe textures from the painted planet Superior atlas.

The globe wraps the same equirectangular 2:1 atlas used by the 2D map, so the
traced region outlines (src/components/planet-map/atlasRegions.json) stay
aligned with the painted coasts on the sphere. Re-run this script whenever the
atlas or the outlines change:

    python3 scripts/build_globe_textures.py [path/to/cloud-source.jpg]

Outputs (src/assets/planet-map/):
  globe-color-{1920,3840}.webp  seam-matched colour with pole-aware blur
  globe-surface-2048.webp       R = relief height (bump), G = roughness
  globe-lights-2048.webp        lava and reactor glow (emissive, night side)
  globe-clouds-2048.webp        cloud opacity (only when a source is given)
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, gaussian_filter1d

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "src/assets/planet-map"
OUTLINES = ROOT / "src/components/planet-map/atlasRegions.json"
MAP_W, MAP_H = 2000, 1000


def seam_match(img: np.ndarray, band: int) -> np.ndarray:
    """Remove the low-frequency step where x = 0 meets x = W on the sphere."""
    out = img.copy()
    left = img[:, :12].mean(axis=1)
    right = img[:, -12:].mean(axis=1)
    diff = gaussian_filter1d(left - right, 24, axis=0)
    ramp = np.linspace(0.0, 1.0, band)
    shape = (1, band, 1) if img.ndim == 3 else (1, band)
    up = ramp.reshape(shape)
    down = ramp[::-1].reshape(shape)
    d = diff[:, None]
    out[:, -band:] += d * up * 0.5
    out[:, :band] -= d * down * 0.5
    return out


def pole_blur(img: np.ndarray, strength: float) -> np.ndarray:
    """Blur rows horizontally by how much the sphere compresses them."""
    h = img.shape[0]
    out = img.copy()
    for y in range(h):
        lat = (0.5 - (y + 0.5) / h) * np.pi
        sigma = strength * (1.0 / max(np.cos(lat), 0.02) - 1.0)
        if sigma > 0.6:
            out[y] = gaussian_filter1d(img[y], min(sigma, img.shape[1] / 6), axis=0, mode="wrap")
    return out


def land_mask(w: int, h: int) -> np.ndarray:
    outlines = json.loads(OUTLINES.read_text())
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    for pts in outlines.values():
        draw.polygon([(x * w / MAP_W, y * h / MAP_H) for x, y in pts], fill=255)
    return np.asarray(mask, dtype=np.float32) / 255.0


def save(arr: np.ndarray, name: str, quality: int = 86) -> None:
    img = Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8))
    img.save(ASSETS / name, "WEBP", quality=quality, method=6)
    print(name, img.size, (ASSETS / name).stat().st_size // 1024, "KiB")


def main() -> None:
    atlas = np.asarray(Image.open(ASSETS / "atlas-3840.webp").convert("RGB"), dtype=np.float32) / 255
    color = pole_blur(seam_match(atlas, 260), 3.0)
    save(color, "globe-color-3840.webp", 88)
    lo = Image.fromarray(np.clip(color * 255 + 0.5, 0, 255).astype(np.uint8)).resize(
        (1920, 960), Image.LANCZOS
    )
    lo.save(ASSETS / "globe-color-1920.webp", "WEBP", quality=86, method=6)
    print("globe-color-1920.webp", lo.size)

    w, h = 2048, 1024
    small = np.asarray(
        Image.fromarray((color * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS),
        dtype=np.float32,
    ) / 255
    land = gaussian_filter(land_mask(w, h), 1.5)
    r, g, b = small[..., 0], small[..., 1], small[..., 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    # Painted light/shadow reads as relief; keep it to land and soften noise.
    relief = gaussian_filter(lum, 1.2) - gaussian_filter(lum, 24) * 0.55
    relief = (relief - relief.min()) / (np.ptp(relief) + 1e-6)
    height = relief * land
    snow = np.clip((lum - 0.72) / 0.2, 0, 1) * land
    rough = 0.56 + land * 0.38 - snow * 0.2
    surface = np.stack([height, rough, np.zeros_like(height)], axis=-1)
    save(pole_blur(seam_match(surface, 120), 1.5), "globe-surface-2048.webp", 90)

    mx = small.max(axis=-1)
    mn = small.min(axis=-1)
    sat = (mx - mn) / (mx + 1e-6)
    lava = np.clip((r - g * 1.25) * 3, 0, 1) * np.clip((mx - 0.55) * 4, 0, 1) * (sat > 0.45)
    core = np.clip((b + g) * 0.5 - r * 0.9, 0, 1) * np.clip((mx - 0.7) * 5, 0, 1) * (sat > 0.3)
    # Keep glow off the painted turquoise shallows around every coast.
    inland = np.clip((gaussian_filter(land_mask(w, h), 7) - 0.93) / 0.07, 0, 1)
    glow = np.clip(lava + core * 1.4, 0, 1) * inland
    lights = small * glow[..., None] * 1.6
    lights = np.maximum(lights, gaussian_filter(lights, (5, 5, 0)) * 1.4)
    save(np.clip(lights, 0, 1), "globe-lights-2048.webp", 86)

    if len(sys.argv) > 1:
        src = Image.open(sys.argv[1]).convert("L").resize((w, h), Image.LANCZOS)
        c = np.asarray(src, dtype=np.float32) / 255
        c = np.clip((c - 0.22) / 0.7, 0, 1) ** 1.35
        c = pole_blur(seam_match(c, 160), 2.0)
        save(np.clip(c, 0, 1), "globe-clouds-2048.webp", 80)


if __name__ == "__main__":
    main()
