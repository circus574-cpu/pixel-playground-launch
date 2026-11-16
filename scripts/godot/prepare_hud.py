#!/usr/bin/env python3
"""HUD buttons of the Godot port: the owner's button art (art/production/hud/btn-*.png, 1254 px, transparent) -> ports/godot-pyra/assets/ui/hud/*.webp.

The five top buttons (MAPA, POSTAC, PLECAK, ZOOM, MENU) carry their label inside the picture, so they share one crop box and keep their proportions; the attack
button is cropped to a square around its circle. Everything is resized with premultiplied alpha (no dark fringe) and stored as lossless WebP.
The game draws them in scripts/hud.gd (top row) and scripts/touch_controls.gd (attack); if a file is missing the old code-drawn button is used.

  python3 scripts/godot/prepare_hud.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "art" / "production" / "hud"
OUT = ROOT / "ports" / "godot-pyra" / "assets" / "ui" / "hud"
TOP = ["mapa", "postac", "plecak", "zoom", "menu"]
TOP_BOX = (130, 0, 1124, 1230)   # the same box for every labelled button: they stay aligned
TOP_HEIGHT = 300                 # source px; shown at about 80-90 logical px, so 3x is kept for sharp phones
ATTACK_BOX = (7, -4, 1245, 1234)  # a square around the circle (the circle touches the picture edge, so the box reaches a little beyond)
ATTACK_SIZE = 340


def shrink(image: Image.Image, box: tuple[int, int, int, int], height: int) -> Image.Image:
    cut = image.convert("RGBA").crop(box).convert("RGBa")
    width = round(cut.width * height / cut.height)
    return cut.resize((width, height), Image.LANCZOS).convert("RGBA")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in TOP:
        out = shrink(Image.open(SRC / f"btn-{name}.png"), TOP_BOX, TOP_HEIGHT)
        out.save(OUT / f"btn-{name}.webp", "WEBP", lossless=True, quality=100, method=6)
        print(name, out.size)
    out = shrink(Image.open(SRC / "btn-attack.png"), ATTACK_BOX, ATTACK_SIZE)
    out.save(OUT / "btn-attack.webp", "WEBP", lossless=True, quality=100, method=6)
    print("attack", out.size)


if __name__ == "__main__":
    main()
