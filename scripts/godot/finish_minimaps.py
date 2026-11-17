#!/usr/bin/env python3
"""Finishes the minimap pictures rendered from the real ground (ports/godot-pyra/tests/render_minimaps.gd) so that they read well in a 172 px circle:
a light blur takes the texture moire away, brightness and contrast come up a little, and the roads (the land's own road mask) are drawn as pale lines,
because at this scale the textured roads of the ground almost vanish.

  python3 scripts/godot/finish_minimaps.py [land ...]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from scipy import ndimage

REPO = Path(__file__).resolve().parents[2]
ROOT = REPO / "ports" / "godot-pyra" / "assets" / "lands"
RAW = REPO / "art" / "production" / "minimaps-raw"   # the untouched renders, outside the game project


def finish(land: str) -> None:
    folder = ROOT / land
    raw = folder / "minimap.webp"
    RAW.mkdir(parents=True, exist_ok=True)
    keep = RAW / (land + ".png")
    if not keep.exists():
        Image.open(raw).convert("RGB").save(keep)   # the untouched render, so that this script can be run again
    image = Image.open(keep).convert("RGB")
    image = image.filter(ImageFilter.GaussianBlur(1.1))
    image = ImageEnhance.Contrast(ImageEnhance.Brightness(image).enhance(1.35)).enhance(1.25)
    road_file = folder / "road-mask.png"
    if road_file.exists():
        mask = np.asarray(Image.open(road_file).convert("L").resize(image.size, Image.BILINEAR)) > 40
        mask = ndimage.binary_dilation(mask, iterations=1)
        soft = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255.0
        pixels = np.asarray(image).astype(np.float32)
        line = np.array([236, 214, 160], np.float32)
        pixels = pixels * (1.0 - 0.85 * soft[..., None]) + line * 0.85 * soft[..., None]
        image = Image.fromarray(pixels.clip(0, 255).astype(np.uint8))
    image.save(raw, "WEBP", quality=88, method=6)
    print(land, image.size, raw.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    for land in sys.argv[1:] or ["pyra", "verdant", "aether", "nexus"] + [f"island-{i}" for i in range(1, 7)]:
        finish(land)
