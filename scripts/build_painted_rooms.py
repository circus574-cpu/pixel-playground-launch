#!/usr/bin/env python3
"""Ship the painted room pictures of the special buildings (see src/game/city/paintedRooms.ts).

    python3 scripts/build_painted_rooms.py

Reads art/production/interiors/<city>/<world>-<building>-interior.png (1536x1024 (Pyra smithy: 1024x1536)) and writes
public/game/interiors/<world>-<building>.webp. Pictures are loaded one at a time when the player enters a building.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CITIES = {"verdantia": "verdant", "aetheria": "aether", "nexus-9": "nexus", "pyra": "pyra"}
BUILDINGS = ["hall", "shop", "arena", "depot", "smithy", "inn"]
out = ROOT / "public/game/interiors"
out.mkdir(parents=True, exist_ok=True)
total = 0
for city, world in CITIES.items():
    for b in BUILDINGS:
        src = ROOT / f"art/production/interiors/{city}/{world}-{b}-interior.png"
        im = Image.open(src).convert("RGB")
        assert im.size in ((1536, 1024), (1024, 1536)), (src, im.size)  # only the Pyra smithy is a portrait
        dst = out / f"{world}-{b}.webp"
        im.save(dst, quality=88, method=6)
        total += dst.stat().st_size
print(f"{len(CITIES) * len(BUILDINGS)} pictures, {total / 1048576:.1f} MiB")
