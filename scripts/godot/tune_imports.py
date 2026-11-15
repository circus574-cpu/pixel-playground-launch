#!/usr/bin/env python3
"""Mark scenery sprites and hero sheets as VRAM-compressed (ETC2/ASTC on Android, 4x less texture memory).

Data textures (biome/land grids, road mask) and the terrain tiles stay lossless: the shader reads exact values from them.
Run after the first `godot --headless --editor --import`, then import again.
"""
import pathlib, re

PORT = pathlib.Path(__file__).resolve().parents[2] / "ports/godot-pyra"
changed = 0
for folder in ["assets/continent/objects", "assets/hero"]:
    for imp in (PORT / folder).glob("*.import"):
        text = imp.read_text()
        new = re.sub(r"^compress/mode=\d+", "compress/mode=2", text, flags=re.M)
        new = re.sub(r"^compress/lossy_quality=[\d.]+", "compress/lossy_quality=0.9", new, flags=re.M)
        if new != text:
            imp.write_text(new)
            changed += 1
intro = PORT / "assets/branding/intro.webp.import"
if intro.exists():
    text = intro.read_text()
    new = re.sub(r"^mipmaps/generate=\w+", "mipmaps/generate=true", text, flags=re.M)
    if new != text:
        intro.write_text(new)
        changed += 1
print("tuned imports:", changed)
