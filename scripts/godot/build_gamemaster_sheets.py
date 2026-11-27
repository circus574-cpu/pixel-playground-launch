#!/usr/bin/env python3
"""Packs rendered 5-direction PNG frames of KI-Legends-GameMaster.glb into compact WebP sheets
under ports/godot-isometric-world/assets/gm/ and writes the "gm.hero" entry in
ports/godot-isometric-world/data/actors.json.

Placing sheets under assets/gm/ (instead of assets/actors/) keeps all 8 modular world-* OTA packs
100% untouched (rebuilt_world_packs == 0) while shipping the towering GameMaster cleanly in core-c101.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ISO_PORT = ROOT / "ports" / "godot-isometric-world"
CELL = 256
CELL_IDLE_HEIGHT = 204
FEET_Y = 244
DIRS = ["down", "down-right", "right", "up-right", "up"]
MIRROR = {"down-left": "down-right", "left": "right", "up-left": "up-right"}
ATLAS_WIDTH = 2048
ALPHA_CUT = 8

CLIP_META = {
    "idle":         {"fps": 5,  "loop": True},
    "walk":         {"fps": 12, "loop": True, "refSpeed": 125},
    "takeoff":      {"fps": 18, "loop": False},
    "hover":        {"fps": 8,  "loop": True},
    "glide":        {"fps": 10, "loop": True, "refSpeed": 220},
    "land":         {"fps": 18, "loop": False},
    "heavy_strike": {"fps": 17, "loop": False},
    "ki_blast":     {"fps": 18, "loop": False},
}


def bbox(image: Image.Image):
    a = np.asarray(image.getchannel("A")) > ALPHA_CUT
    ys, xs = np.where(a)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1) if len(xs) else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--frames", required=True)
    parser.add_argument("--out-dir", default=str(ISO_PORT / "assets" / "gm"))
    parser.add_argument("--actors-json", default=str(ISO_PORT / "data" / "actors.json"))
    args = parser.parse_args()

    frames_dir = Path(args.frames)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    ref_files = sorted((frames_dir / "idle").glob("down_*.png"))
    if not ref_files:
        ref_files = sorted((frames_dir / "walk").glob("down_*.png"))
    assert ref_files, f"No idle/walk down frames found in {frames_dir}"
    ref_imgs = [Image.open(f).convert("RGBA") for f in ref_files]
    boxes = [b for b in (bbox(im) for im in ref_imgs) if b is not None]
    height = float(np.median([b[3] - b[1] for b in boxes]))
    feet_src = float(np.median([b[3] for b in boxes]))
    scale = CELL_IDLE_HEIGHT / height
    src_w = CELL / scale
    print(f"GM idle height {height:.1f}px -> scale {scale:.3f}, feet_src={feet_src:.1f}, src_w={src_w:.1f}")

    clips = {}
    total_bytes = 0
    for clip_name, meta in CLIP_META.items():
        files = {d: sorted((frames_dir / clip_name).glob(f"{d}_*.png")) for d in DIRS}
        count = len(files["down"])
        if count == 0:
            print(f"SKIP {clip_name}: no frames")
            continue
        pieces = []
        for d in DIRS:
            for idx, fp in enumerate(files[d]):
                im = Image.open(fp).convert("RGBA")
                left = im.width / 2.0 - src_w / 2.0
                top = feet_src - FEET_Y / scale
                cell = im.crop((round(left), round(top), round(left + src_w), round(top + src_w)))
                cell = cell.convert("RGBa").resize((CELL, CELL), Image.LANCZOS).convert("RGBA")
                b = bbox(cell)
                if b is None:
                    b = (0, 0, 1, 1)
                b = (max(0, b[0] - 1), max(0, b[1] - 1), min(CELL, b[2] + 1), min(CELL, b[3] + 1))
                pieces.append((d, idx, cell.crop(b), b))

        # Shelf packing into <= 2048px wide atlas
        x = y = shelf = 0
        placed = []
        for d, idx, im, b in sorted(pieces, key=lambda t: -t[2].height):
            if x + im.width > ATLAS_WIDTH:
                x, y, shelf = 0, y + shelf, 0
            placed.append((d, idx, im, b, x, y))
            x += im.width
            shelf = max(shelf, im.height)
        atlas = Image.new("RGBA", (ATLAS_WIDTH, max(1, y + shelf)), (0, 0, 0, 0))
        directions = {d: [None] * len(files[d]) for d in DIRS}
        for d, idx, im, b, px, py in placed:
            atlas.paste(im, (px, py))
            directions[d][idx] = [px, py, im.width, im.height, b[0], b[1], CELL - im.width, CELL - im.height]

        sheet_name = f"gm-hero3d-{clip_name}.webp"
        sheet_path = out_dir / sheet_name
        atlas.save(sheet_path, "WEBP", quality=82, alpha_quality=92, method=6)
        sz = sheet_path.stat().st_size
        total_bytes += sz
        for mirrored, source in MIRROR.items():
            directions[mirrored] = directions[source]
        entry = {
            "sheet": f"res://assets/gm/{sheet_name}",
            "fps": meta["fps"],
            "loop": meta["loop"],
            "mirrored": list(MIRROR),
            "directions": directions,
        }
        if "refSpeed" in meta:
            entry["refSpeed"] = meta["refSpeed"]
        clips[clip_name] = entry
        print(f"  {clip_name:14s}: {count:2d} frames x {len(DIRS)} dirs -> {atlas.size[0]}x{atlas.size[1]}, {sz // 1024} KB")

    print(f"Total GameMaster WebP sheets: {total_bytes / (1024 * 1024):.2f} MB ({total_bytes} bytes)")

    # Write "gm.hero" to actors.json — 238x238 with CELL_IDLE_HEIGHT=204/256 (~1.62x taller than regular 133x133 heroes!)
    actors_path = Path(args.actors_json)
    actors = json.loads(actors_path.read_text(encoding="utf-8"))
    actors["gm.hero"] = {
        "id": "hero-gm-3d",
        "cell": CELL,
        "size": [238, 238],
        "origin": [0.5, 0.953],
        "interiorScale": 1.26,
        "clips": clips,
    }
    actors_path.write_text(json.dumps(actors, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"Updated {actors_path} with key 'gm.hero' ({len(clips)} clips)")


if __name__ == "__main__":
    main()
