#!/usr/bin/env python3
"""Skill icons of the four races (public/game/icons-v3/<race>-*.webp) -> circular RGBA icons for the Godot skill tree.

The painted icons are used unchanged except for a soft circular mask; item icons (public/game/items) are copied as they are
for the economy screens.
"""
import json, pathlib, shutil
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "public/game/icons-v3"
OUT = ROOT / "ports/godot-pyra/assets/icons/skills"
OUT.mkdir(parents=True, exist_ok=True)
ids = ["R"] + [f"{b}{n}" for b in "ABC" for n in range(1, 10)] + ["T"]
mask = Image.new("L", (512, 512), 0)
ImageDraw.Draw(mask).ellipse([8, 8, 504, 504], fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(3)).resize((128, 128), Image.LANCZOS)
for race in ("legend", "planetary", "sage", "android"):
    (OUT / race).mkdir(parents=True, exist_ok=True)
    for i in ids:
        icon = Image.open(SRC / f"{race}-{i}.webp").convert("RGB").resize((128, 128), Image.LANCZOS)
        rgba = icon.convert("RGBA")
        rgba.putalpha(mask)
        rgba.save(OUT / race / f"{i}.png", optimize=True)
for name in ["hud-hp", "hud-ki", "hud-zar"]:
    shutil.copyfile(SRC / f"{name}.webp", ROOT / f"ports/godot-pyra/assets/icons/{name}.webp")
print("skill icons:", len(ids))
