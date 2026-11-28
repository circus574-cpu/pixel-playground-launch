#!/usr/bin/env python3
"""Pack CPU Blender renders into the directional boss atlases used by Godot."""
import argparse
from pathlib import Path

from PIL import Image

DIRECTIONS = ("down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right")
CELL = 256


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("renders", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for directory in sorted(args.renders.iterdir()):
        if not directory.is_dir():
            continue
        atlas = Image.new("RGBA", (CELL * 4, CELL * 2))
        for index, direction in enumerate(DIRECTIONS):
            frame = Image.open(directory / f"{direction}.png").convert("RGBA")
            bbox = frame.getbbox()
            if frame.size != (CELL, CELL) or not bbox or min(bbox[:2]) < 2 or max(bbox[2:]) > CELL - 2:
                raise ValueError(f"Unexpected bounds: {directory.name}/{direction}, {bbox}")
            atlas.paste(frame, (index % 4 * CELL, index // 4 * CELL))
        atlas.save(args.output / f"{directory.name}.webp", lossless=True, method=6)


if __name__ == "__main__":
    main()
