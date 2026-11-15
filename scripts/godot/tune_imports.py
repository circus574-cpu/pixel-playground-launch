#!/usr/bin/env python3
"""Import settings that keep the APK small without changing what the player sees.

Everything painted (scenery, people, interiors, terrain tiles, maps) is imported as lossy WebP: the APK stays near 100 MB.
Scenery sprites are shared between placements, so their decoded size in memory stays small. Data textures that the shader or
the walk logic reads exactly (control grids, road mask, class map) stay lossless. Run after the first
`godot --headless --import`, then import again.
"""
import pathlib, re

PORT = pathlib.Path(__file__).resolve().parents[2] / "ports/godot-pyra"
LOSSY = {  # folder -> quality
    "assets/objects": 0.78, "assets/actors": 0.84, "assets/hero": 0.9, "assets/rooms": 0.85, "assets/floor": 0.88,
    "assets/races": 0.88, "assets/map": 0.88, "assets/icons": 0.9,
}
LAND_LOSSY = {"terrain/*.webp": 0.9, "map.webp": 0.88}
KEEP_LOSSLESS = ("ctrl-", "road-")
changed = 0

def set_mode(imp: pathlib.Path, quality: float) -> None:
    global changed
    text = imp.read_text()
    new = re.sub(r"^compress/mode=\d+", "compress/mode=1", text, flags=re.M)
    new = re.sub(r"^compress/lossy_quality=[\d.]+", f"compress/lossy_quality={quality}", new, flags=re.M)
    if new != text:
        imp.write_text(new)
        changed += 1

for folder, quality in LOSSY.items():
    for imp in (PORT / folder).rglob("*.import"):
        if imp.name.startswith(KEEP_LOSSLESS) or imp.name.endswith(".svg.import"):
            continue
        set_mode(imp, quality)
for land in (PORT / "assets/lands").iterdir():
    for pattern, quality in LAND_LOSSY.items():
        for imp in land.glob(pattern + ".import"):
            set_mode(imp, quality)
intro = PORT / "assets/branding/intro.webp.import"
if intro.exists():
    text = intro.read_text()
    new = re.sub(r"^mipmaps/generate=\w+", "mipmaps/generate=true", text, flags=re.M)
    if new != text:
        intro.write_text(new)
        changed += 1
print("tuned imports:", changed)
