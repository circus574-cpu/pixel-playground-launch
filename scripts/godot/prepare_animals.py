#!/usr/bin/env python3
"""Peaceful animals of the Godot port: the owner's 4x3 sheets (art/production/animals/zwierze-A-xx.jpg, white background) ->
ports/godot-pyra/assets/monsters/<world>-animal-a-xx.webp (a trimmed lossless atlas) and ports/godot-pyra/data/animals.json (the actor of each animal),
plus the ten food icons (art/production/animals/ikona-F-xx.png, 1024 px on white) -> ports/godot-pyra/assets/icons/items/F-xx.webp (128 px RGBA).

An animal appears in the game only once it is listed in data/animals.json (scripts/animals.gd); animals whose sheet is missing are reported and skipped.

Sheet format (the prompts in art/pipeline/prompts/zwierzeta/): 4 columns x 3 rows, one pose per cell, side view, the animal faces RIGHT.
Row 1 walk (4 frames, loop), row 2 flee (4 frames, loop: clip `run`), row 3 fall (4 frames: stagger, topple, lie, still).
Clips: idle = first walk frame, walk, run, hit = first fall frame, death = fall 1..4, respawn = fall 4..1 (the animal gets up).

What this script does with each sheet, and why:
- The poses are cut by connected shapes, not by the grid (some poses reach over the cell border): the white background is the part of the picture that touches
  the border; everything else is the animal. Pixels on the edge are turned into soft alpha (the dark outline partly covering white is split back into colour + alpha),
  so there is no white fringe on a dark map.
- One scale for the whole sheet (never per frame), so the animal does not change size between poses. All rows share one ground line: the lowest pose of a row
  stands on it and a pose that is higher in the sheet (a hop, a flight) stays that much higher. Horizontally a pose is centred on the centre of mass of its pixels.
- The atlas is lossless WebP, poses trimmed and shelf-packed. Pixel density is kept at 0.6 of the source (the animals are drawn at 50-90 px on screen).
- `size` of the actor is chosen so that the body (median width of the walk frames) is TARGET_BODY px long on screen.

  python3 scripts/godot/prepare_animals.py [--src DIR] [--port DIR]
"""
import argparse
import json
import statistics
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SCALE = 0.6              # of the source pixels kept in the atlas
CELL = 512               # side of the virtual cell of an actor, in atlas pixels (ground line at 0.8 of it)
WHITE = 236              # a pixel whose darkest channel is at least this is background
EDGE_DARK = 195.0        # 255 minus the darkest channel of an outline pixel (about 60)
# On-screen length of the body, in px (the hero is about 100 px tall). A guess to be tuned by looking at the game.
TARGET_BODY = {"A-01": 64, "A-02": 56, "A-03": 92, "A-04": 80, "A-05": 70, "A-06": 56, "A-07": 80, "A-08": 52, "A-09": 56, "A-10": 62}
FPS = {"idle": 6, "walk": 8, "run": 12, "hit": 12, "death": 6, "respawn": 8}
MIRRORED = ["left", "down-left", "up-left"]
DIRECTIONS = ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"]


def cut_background(img: Image.Image) -> np.ndarray:
    """RGBA array: alpha 0 on the background connected to the image border, soft alpha on its edge."""
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    darkest = rgb.min(axis=2)
    white, _ = ndimage.label(darkest >= WHITE)
    border = set(np.unique(np.concatenate([white[0], white[-1], white[:, 0], white[:, -1]]))) - {0}
    # pure white that is enclosed by the animal (the gap between crossed legs, under the belly) is background too; the paper-white of a highlight is not that bright
    enclosed = [label for label in range(1, int(white.max()) + 1) if label not in border]
    if enclosed:
        areas = ndimage.sum(np.ones_like(darkest), white, index=enclosed)
        lows = ndimage.mean(darkest, white, index=enclosed)
        enclosed = [label for label, area, low in zip(enclosed, areas, lows) if area >= 40 and low >= 248]
    bg = np.isin(white, list(border) + enclosed)
    band = ~bg & ndimage.binary_dilation(bg, iterations=2)
    alpha = np.ones_like(darkest)
    soft = np.clip((255.0 - darkest) / EDGE_DARK, 0.0, 1.0)
    alpha[band] = soft[band]
    alpha[band & (alpha < 0.12)] = 0.0
    alpha[bg] = 0.0
    out = rgb.copy()
    inside = band & (alpha > 0)
    out[inside] = np.clip((rgb[inside] - 255.0 * (1.0 - alpha[inside, None])) / alpha[inside, None], 0, 255)
    return np.dstack([out, alpha * 255.0]).astype(np.uint8)


def poses(rgba: np.ndarray) -> list[tuple[np.ndarray, int]]:
    """The twelve poses in reading order as (cropped RGBA array, bottom row in the sheet); a pose is the set of connected shapes whose centre lies in a grid cell."""
    h, w = rgba.shape[:2]
    labels, count = ndimage.label(rgba[..., 3] > 0, structure=np.ones((3, 3)))
    boxes = ndimage.find_objects(labels)
    areas = ndimage.sum(np.ones_like(labels), labels, index=np.arange(1, count + 1))
    cells: dict[int, list[int]] = {}
    for index, box in enumerate(boxes, start=1):
        if areas[index - 1] < 60:
            continue
        cy, cx = (box[0].start + box[0].stop) / 2, (box[1].start + box[1].stop) / 2
        cells.setdefault(min(2, int(cy // (h / 3))) * 4 + min(3, int(cx // (w / 4))), []).append(index)
    out = []
    for cell in range(12):
        if cell not in cells:
            raise ValueError(f"no pose in cell {cell + 1}")
        mask = np.isin(labels, cells[cell])
        ys, xs = np.where(mask)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        crop = rgba[y0:y1, x0:x1].copy()
        crop[~mask[y0:y1, x0:x1], 3] = 0
        out.append((crop, int(y1)))
    return out


def resize(rgba: np.ndarray, factor: float) -> Image.Image:
    image = Image.fromarray(rgba, "RGBA").convert("RGBa")
    size = (max(1, round(image.width * factor)), max(1, round(image.height * factor)))
    return image.resize(size, Image.LANCZOS).convert("RGBA")


def centroid_x(image: Image.Image) -> float:
    alpha = np.asarray(image)[..., 3].astype(np.float64)
    return float((alpha.sum(axis=0) * np.arange(image.width)).sum() / max(1.0, alpha.sum()))


def shelf_pack(images: list[Image.Image], width: int = 2048, gap: int = 2) -> tuple[list[tuple[int, int]], tuple[int, int]]:
    order = sorted(range(len(images)), key=lambda i: -images[i].height)
    spots: dict[int, tuple[int, int]] = {}
    x = y = shelf = 0
    for i in order:
        w, h = images[i].size
        if x + w > width:
            x, y, shelf = 0, y + shelf + gap, 0
        spots[i] = (x, y)
        x += w + gap
        shelf = max(shelf, h)
    return [spots[i] for i in range(len(images))], (width, y + shelf)


def build_animal(animal: dict, sheet: Path, out_dir: Path) -> tuple[dict, list[str]]:
    notes: list[str] = []
    cut = poses(cut_background(Image.open(sheet)))
    images = [resize(crop, SCALE) for crop, _ in cut]
    ground = CELL * 0.8
    placed = []   # (x, y) of each trimmed pose inside the virtual cell
    for row in range(3):
        bottoms = [cut[row * 4 + i][1] for i in range(4)]
        lowest = max(bottoms)
        for i in range(4):
            image = images[row * 4 + i]
            lift = (lowest - bottoms[i]) * SCALE
            x = round(CELL / 2 - centroid_x(image))
            y = round(ground - lift - image.height)
            if x < 0 or x + image.width > CELL or y < 0:
                notes.append(f"pose {row * 4 + i + 1} leaves the virtual cell ({x},{y},{image.width}x{image.height}); moved inside")
                x = min(max(0, x), CELL - image.width)
                y = max(0, y)
            placed.append((x, y))
    spots, size = shelf_pack(images)
    atlas = Image.new("RGBA", size, (0, 0, 0, 0))
    for image, spot in zip(images, spots):
        atlas.paste(image, spot)
    name = f"{animal['world']}-animal-{animal['id'].lower()}"
    atlas.save(out_dir / f"{name}.webp", "WEBP", lossless=True, quality=100, method=6)
    rects = [[spots[i][0], spots[i][1], images[i].width, images[i].height, placed[i][0], placed[i][1], CELL - images[i].width, CELL - images[i].height] for i in range(12)]

    def clip(frame_ids: list[int], fps_name: str, loop: bool) -> dict:
        frames = [rects[i] for i in frame_ids]
        return {"sheet": f"res://assets/monsters/{name}.webp", "fps": FPS[fps_name], "loop": loop, "mirrored": MIRRORED,
                "directions": {d: frames for d in DIRECTIONS}}

    clips = {
        "idle": clip([0], "idle", True), "walk": clip([0, 1, 2, 3], "walk", True), "run": clip([4, 5, 6, 7], "run", True),
        "hit": clip([8], "hit", False), "death": clip([8, 9, 10, 11], "death", False), "respawn": clip([11, 10, 9, 8], "respawn", False),
    }
    body = statistics.median(images[i].width for i in range(4))
    px = round(TARGET_BODY[animal["id"]] * CELL / body)
    actor = {"id": f"animal-{animal['id'].lower()}", "cell": CELL, "size": [px, px], "origin": [0.5, 0.8], "clips": clips, "interiorScale": 1.0}
    return {"actor": actor}, notes + [f"atlas {size[0]}x{size[1]}, body {body}px of the cell -> size {px}"]


def build_icon(source: Path, target: Path) -> None:
    rgba = cut_background(Image.open(source))
    ys, xs = np.where(rgba[..., 3] > 0)
    crop = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    side = max(crop.shape[:2])
    scale = 116.0 / side   # about 6 % empty margin on each side of the 128 px icon
    image = resize(crop, scale)
    icon = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    icon.paste(image, ((128 - image.width) // 2, (128 - image.height) // 2))
    icon.save(target, "WEBP", lossless=True, quality=100, method=6)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", default=str(ROOT / "art" / "production" / "animals"))
    parser.add_argument("--port", default=str(ROOT / "ports" / "godot-pyra"))
    args = parser.parse_args()
    src, port = Path(args.src), Path(args.port)
    food = json.loads((port / "data" / "food.json").read_text())
    out_dir = port / "assets" / "monsters"
    out_dir.mkdir(parents=True, exist_ok=True)
    animals, ready, missing = {}, [], []
    for animal in food["animals"]:
        sheet = src / f"zwierze-{animal['id']}.jpg"
        if not sheet.exists():
            missing.append(animal["id"])
            continue
        data, notes = build_animal(animal, sheet, out_dir)
        animals[animal["id"]] = data
        ready.append(animal["id"])
        print(animal["id"], animal["name"], "; ".join(notes))
    (port / "data" / "animals.json").write_text(json.dumps({"format": "ki-godot-animals-1", "animals": animals}, ensure_ascii=False, separators=(",", ":")))
    icons = []
    icon_dir = port / "assets" / "icons" / "items"
    for food_item in food["foods"]:
        source = src / f"ikona-{food_item['id']}.png"
        if source.exists():
            build_icon(source, icon_dir / f"{food_item['id']}.webp")
            icons.append(food_item["id"])
    print(json.dumps({"ready": ready, "missing": missing, "icons": icons}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
