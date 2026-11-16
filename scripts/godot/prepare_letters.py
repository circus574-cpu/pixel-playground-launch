#!/usr/bin/env python3
"""The owner's gold letters (art/production/ui/letters-full.png: capitals and small letters with the Polish ones, digits, punctuation and symbols, 5 rows)
-> ports/godot-pyra/data/letters.json, a bitmap font that scripts/look.gd (Look.letters) turns into a Godot FontFile at run time. Titles, the start button
and place names are written with it.

Why a JSON and not a font file: data/*.json travels in the core pack, so a new set of letters reaches an installed app from the server, without a new APK.
The atlas is a lossless WebP stored as base64 inside the JSON.

Cutting: the sheet is read as shapes. Pieces that sit one above the other (the dot of i, an accent, the two dots of a colon) belong together, so shapes that
overlap in x are merged into one glyph; the glyphs of a row are then named in reading order from ROWS. If a row has fewer shapes than names (two letters touch),
the widest shape is split at its thinnest column. The faint glow below alpha 40 is dropped (no halo specks). One scale for the whole sheet (from the cap
height of the plain capitals) and one baseline per row keep the letters level; the `rise` of a glyph is its distance above its row's baseline (a negative-going
tail such as the comma or the g simply reaches below it).

  python3 scripts/godot/prepare_letters.py
"""
import base64
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SHEET = ROOT / "art" / "production" / "ui" / "letters-full.png"
OUT = ROOT / "ports" / "godot-pyra" / "data" / "letters.json"
CAP = 72            # cap height of the capitals in the atlas, px
PAD = 3
BANDS = [(5, 147), (151, 294), (297, 433), (462, 569), (594, 684)]
ROWS = [
    list("AaĄąBbCcĆćDdEeĘęFfGgHhIi"),
    list("JjKkLlŁłMmNnŃńOoÓóPpRrSs"),
    list("ŚśTtUuWwYyZzŹźŻżVvXxQq"),
    list("0123456789!?.,:;’”„()[]{}"),
    list("+−×÷=%‰@#€$£¥¤&*_/\\|<>≤≥"),
]
PLAIN_CAPS = set("ABDEFHIKLMNOPRSTUVWXYZ")


def shapes(body: np.ndarray, y0: int, y1: int) -> list[tuple[int, int, np.ndarray]]:
    """The glyph groups of one row: (x0, x1, mask of the group), left to right."""
    closed = ndimage.binary_closing(body, iterations=2)
    labels, count = ndimage.label(closed, structure=np.ones((3, 3)))
    boxes = ndimage.find_objects(labels)
    areas = ndimage.sum(closed, labels, range(1, count + 1))
    parts = []
    for i, box in enumerate(boxes):
        cy = (box[0].start + box[0].stop) / 2
        if y0 - 15 <= cy <= y1 + 15 and areas[i] > 40:
            parts.append([box[1].start, box[1].stop, labels == i + 1])
    parts.sort(key=lambda g: g[0])
    merged: list[list] = []
    for part in parts:
        for group in merged:
            overlap = min(group[1], part[1]) - max(group[0], part[0])
            if overlap > 0.6 * min(group[1] - group[0], part[1] - part[0]):
                group[0], group[1], group[2] = min(group[0], part[0]), max(group[1], part[1]), group[2] | part[2]
                break
        else:
            merged.append(part)
    merged.sort(key=lambda g: g[0])
    # the double marks (the two commas of a quotation mark) sit side by side: two narrow shapes with a hair of space are one glyph
    joined: list[list] = []
    for group in merged:
        if joined and group[0] - joined[-1][1] < 12 and group[1] - group[0] < 30 and joined[-1][1] - joined[-1][0] < 30:
            joined[-1][1], joined[-1][2] = group[1], joined[-1][2] | group[2]
        else:
            joined.append(list(group))
    return [(g[0], g[1], g[2]) for g in joined]


def split_widest(groups: list, body: np.ndarray) -> list:
    widths = [g[1] - g[0] for g in groups]
    i = int(np.argmax(widths))
    x0, x1, mask = groups[i]
    columns = (body & mask).sum(axis=0)
    lo, hi = x0 + int((x1 - x0) * 0.3), x0 + int((x1 - x0) * 0.8)
    cut = lo + int(np.argmin(columns[lo:hi]))
    left, right = mask.copy(), mask.copy()
    left[:, cut:] = False
    right[:, :cut] = False
    return groups[:i] + [(x0, cut, left), (cut, x1, right)] + groups[i + 1:]


def main() -> None:
    image = Image.open(SHEET).convert("RGBA")
    a = np.array(image)
    a[a[..., 3] < 40] = 0
    body = (a[..., 3] > 150) & (a[..., 0] > 120)
    glyphs: dict[str, dict] = {}
    row_of: dict[str, int] = {}
    for r, ((y0, y1), names) in enumerate(zip(BANDS, ROWS)):
        groups = shapes(body, y0, y1)
        while len(groups) < len(names):
            groups = split_widest(groups, body)
        assert len(groups) == len(names), (r, len(groups), len(names))
        for name, (x0, x1, mask) in zip(names, groups):
            keep = ndimage.binary_dilation(mask, iterations=5) & (a[..., 3] > 0)
            ys, xs = np.where(keep)
            crop = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
            crop[~keep[ys.min():ys.max() + 1, xs.min():xs.max() + 1]] = 0
            gy, _ = np.where(mask & body)
            glyphs[name] = {"image": Image.fromarray(crop, "RGBA"), "top": int(ys.min()), "body_top": int(gy.min()), "body_bottom": int(gy.max())}
            row_of[name] = r
    caps = [g["body_bottom"] - g["body_top"] for c, g in glyphs.items() if c in PLAIN_CAPS]
    scale = CAP / float(np.median(caps))
    baselines = {}
    for r in range(len(ROWS)):
        names = [c for c in ROWS[r] if row_of[c] == r]
        baselines[r] = float(np.median([glyphs[c]["body_bottom"] for c in names]))
    out = {}
    for c, g in glyphs.items():
        img = g["image"]
        w, h = max(1, round(img.width * scale)), max(1, round(img.height * scale))
        img = img.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA")
        out[c] = {"image": img, "rise": round((baselines[row_of[c]] - g["top"]) * scale)}
    order = sorted(out, key=lambda c: -out[c]["image"].height)
    width, x, y, shelf, place = 1400, 0, 0, 0, {}
    for c in order:
        img = out[c]["image"]
        if x + img.width + PAD > width:
            x, y, shelf = 0, y + shelf + PAD, 0
        place[c] = (x, y)
        x += img.width + PAD
        shelf = max(shelf, img.height)
    atlas = Image.new("RGBA", (width, y + shelf), (0, 0, 0, 0))
    for c, (px, py) in place.items():
        atlas.paste(out[c]["image"], (px, py))
    buffer = io.BytesIO()
    atlas.save(buffer, "WEBP", lossless=True, quality=100, method=6)
    data = {
        "format": "ki-letters-2", "cap": CAP, "ascent": max(g["rise"] for g in out.values()),
        "descent": max(0, max(g["image"].height - g["rise"] for g in out.values())), "space": round(CAP * 0.36), "spacing": round(CAP * 0.05),
        "atlas": base64.b64encode(buffer.getvalue()).decode("ascii"),
        "glyphs": {c: {"rect": [place[c][0], place[c][1], g["image"].width, g["image"].height], "rise": g["rise"]} for c, g in out.items()},
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(out)} glyphs, atlas {atlas.size}, {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
