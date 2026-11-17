#!/usr/bin/env python3
"""Turns the frames rendered from a 3D hero (ports/godot-pyra/tests/render_hero_sprites.gd, one folder per clip, files `<direction>_<nn>.png`, 512 px, transparent)
into game sprite sheets and an actor definition (data/actors.json key `<world>.hero3d`, switched on with the user argument `--hero3d`):

  * one scale for the whole hero: the idle figure is CELL_IDLE_HEIGHT px tall in a CELL px cell, its feet FEET_Y px from the top (same proportions as the
    painted hero: cell 200, figure 183, feet at 0.95 of the cell), so the figure keeps its size and ground line in every clip and direction;
  * every frame is cut to its own box (`[x, y, w, h, ox, oy, mw, mh]`, the atlas format of scripts/actor_view.gd) and packed into one WebP per clip;
  * five directions are rendered; left, down-left and up-left are the mirrored right, down-right and up-right (`mirrored`), as for the painted hero.

  python3 scripts/godot/build_hero3d_sheets.py --frames DIR --game-spec spec-game.json [--world pyra]
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PORT = ROOT / "ports" / "godot-pyra"
CELL = 256
CELL_IDLE_HEIGHT = 234
FEET_Y = 243
DIRS = ["down", "down-right", "right", "up-right", "up"]
MIRROR = {"down-left": "down-right", "left": "right", "up-left": "up-right"}
ATLAS_WIDTH = 2048
ALPHA_CUT = 6


def bbox(image: Image.Image):
    a = np.asarray(image.getchannel("A")) > ALPHA_CUT
    ys, xs = np.where(a)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1) if len(xs) else None


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--frames", required=True)
    p.add_argument("--game-spec", required=True)
    p.add_argument("--world", default="pyra")
    p.add_argument("--out-dir", default=str(PORT / "assets" / "actors" / "hero3d"))
    args = p.parse_args()
    frames = Path(args.frames)
    spec = json.loads(Path(args.game_spec).read_text())
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    # one scale from the idle figure (its height) and the feet line from its lowest pixel
    idle = [Image.open(f).convert("RGBA") for f in sorted((frames / "idle").glob("down_*.png"))]
    boxes = [bbox(im) for im in idle]
    height = float(np.median([b[3] - b[1] for b in boxes]))
    feet_src = float(np.median([b[3] for b in boxes]))
    scale = CELL_IDLE_HEIGHT / height
    src_w = CELL / scale
    print(f"idle height {height:.0f}px -> scale {scale:.3f}, feet row {feet_src:.0f}")
    clips = {}
    total = 0
    for name, info in spec.items():
        files = {d: sorted((frames / name).glob(f"{d}_*.png")) for d in DIRS}
        count = len(files["down"])
        if count == 0:
            print("no frames for", name)
            continue
        pieces = []        # (direction, index, image, box)
        for d in DIRS:
            for i, f in enumerate(files[d]):
                im = Image.open(f).convert("RGBA")
                left = im.width / 2 - src_w / 2
                top = feet_src - FEET_Y / scale
                cell = im.crop((round(left), round(top), round(left + src_w), round(top + src_w)))
                cell = cell.convert("RGBa").resize((CELL, CELL), Image.LANCZOS).convert("RGBA")
                b = bbox(cell)
                if b is None:
                    b = (0, 0, 1, 1)
                b = (max(0, b[0] - 1), max(0, b[1] - 1), min(CELL, b[2] + 1), min(CELL, b[3] + 1))
                pieces.append((d, i, cell.crop(b), b))
        # shelf packing
        x = y = shelf = 0
        placed = []
        for d, i, im, b in sorted(pieces, key=lambda t: -t[2].height):
            if x + im.width > ATLAS_WIDTH:
                x, y, shelf = 0, y + shelf, 0
            placed.append((d, i, im, b, x, y))
            x += im.width
            shelf = max(shelf, im.height)
        atlas = Image.new("RGBA", (ATLAS_WIDTH, y + shelf), (0, 0, 0, 0))
        directions = {d: [None] * len(files[d]) for d in DIRS}
        for d, i, im, b, px, py in placed:
            atlas.paste(im, (px, py))
            directions[d][i] = [px, py, im.width, im.height, b[0], b[1], CELL - im.width, CELL - im.height]
        sheet = out_dir / f"{args.world}-hero3d-{name}.webp"
        atlas.save(sheet, "WEBP", quality=90, alpha_quality=100, method=6)
        total += sheet.stat().st_size
        for mirrored, source in MIRROR.items():
            directions[mirrored] = directions[source]
        clips[name] = {"sheet": f"res://assets/actors/hero3d/{sheet.name}", "fps": info["fps"], "loop": info["loop"], "mirrored": list(MIRROR), "directions": directions}
        print(f"{name:9s} {count:2d} frames x {len(DIRS)} dirs, atlas {atlas.size}, {sheet.stat().st_size // 1024} KB")
    print("sheets", total // 1024, "KB")
    actors_path = PORT / "data" / "actors.json"
    actors = json.loads(actors_path.read_text())
    base = actors[f"{args.world}.hero"]
    actors[f"{args.world}.hero3d"] = {"id": "hero-legend-3d", "cell": CELL, "size": base["size"], "origin": base["origin"], "interiorScale": base.get("interiorScale", 1.5), "clips": clips}
    actors_path.write_text(json.dumps(actors, separators=(",", ":"), ensure_ascii=False))
    print("actors.json:", f"{args.world}.hero3d", len(clips), "clips")


if __name__ == "__main__":
    main()
