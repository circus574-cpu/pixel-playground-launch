#!/usr/bin/env python3
"""The owner's gold letters (art/production/ui/letters.png: A-Z with the Polish letters, 5 rows) -> ports/godot-pyra/data/letters.json, a bitmap font
that scripts/skin.gd (PyraSkin.letters) turns into a Godot FontFile at run time. Titles, the start button and place names are written with it.

Why a JSON and not a font file: data/*.json travels in the core pack, so a new set of letters reaches an installed app from the server, without a new APK.
The atlas is a lossless WebP stored as base64 inside the JSON.

Each glyph is cut as the set of shapes (letter, accent, ogonek, glow) whose centre lies in its place on the sheet; the faint glow below alpha 40 is dropped
(no halo specks). All glyphs share one cap height (CAP px) and one baseline; lower-case letters map to the same glyphs, digits and punctuation fall back
to the regular title font.

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
SHEET = ROOT / "art" / "production" / "ui" / "letters.png"
OUT = ROOT / "ports" / "godot-pyra" / "data" / "letters.json"
CAP = 72            # cap height of the letters in the atlas, px
PAD = 3
ROWS = ["AĄBCĆDEĘ", "FGHIJKLŁ", "MNŃOÓPQR", "SŚTUVWXY", "ZŹŻ"]
PLAIN = set("ABCDEFGHIKLMNOPRSTUVWXYZ")   # no accent, no ogonek, no tail: they give the cap height and the baseline


def main() -> None:
    image = Image.open(SHEET).convert("RGBA")
    a = np.array(image)
    alpha = a[..., 3]
    a[alpha < 40] = 0
    body = (alpha > 150) & (a[..., 0] > 120)
    rows = body.sum(axis=1)
    split = 640 + int(np.argmin(rows[640:700]))
    bands = [(14, 258), (274, 451), (459, split), (split, 867), (870, 1067)]
    labels, count = ndimage.label(a[..., 3] > 0, structure=np.ones((3, 3)))
    centres = ndimage.center_of_mass(np.ones_like(labels), labels, range(1, count + 1))
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, count + 1))
    glyphs = {}
    for (y0, y1), letters in zip(bands, ROWS):
        column = body[y0:y1].sum(axis=0) > 2
        segments, start = [], None
        for x, on in enumerate(list(column) + [False]):
            if on and start is None:
                start = x
            elif not on and start is not None:
                if x - start > 12:
                    segments.append((start, x))
                start = None
        assert len(segments) == len(letters), (letters, segments)
        for letter, (x0, x1) in zip(letters, segments):
            members = [i + 1 for i, (cy, cx) in enumerate(centres) if sizes[i] >= 30 and y0 - 30 <= cy < y1 + 10 and x0 - 6 <= cx < x1 + 6]
            mask = np.isin(labels, members)
            ys, xs = np.where(mask)
            crop = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
            crop[~mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]] = 0
            core = body[y0:y1, x0:x1]
            cys = np.where(core.any(axis=1))[0]
            glyphs[letter] = {"image": Image.fromarray(crop, "RGBA"), "top": int(ys.min()), "body_top": y0 + int(cys.min()), "body_bottom": y0 + int(cys.max())}
    # one baseline and cap height per row, from the plain letters of that row
    out_glyphs = {}
    for letters in ROWS:
        plain = [glyphs[c] for c in letters if c in PLAIN]
        baseline = float(np.median([g["body_bottom"] for g in plain]))
        cap = baseline - float(np.median([g["body_top"] for g in plain]))
        scale = CAP / cap
        for c in letters:
            g = glyphs[c]
            img = g["image"]
            w, h = max(1, round(img.width * scale)), max(1, round(img.height * scale))
            img = img.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA")
            out_glyphs[c] = {"image": img, "rise": round((baseline - g["top"]) * scale)}   # px from the baseline up to the glyph's top
    # atlas
    order = sorted(out_glyphs, key=lambda c: -out_glyphs[c]["image"].height)
    width, x, y, shelf, place = 1024, 0, 0, 0, {}
    for c in order:
        img = out_glyphs[c]["image"]
        if x + img.width + PAD > width:
            x, y, shelf = 0, y + shelf + PAD, 0
        place[c] = (x, y)
        x += img.width + PAD
        shelf = max(shelf, img.height)
    atlas = Image.new("RGBA", (width, y + shelf), (0, 0, 0, 0))
    for c, (px, py) in place.items():
        atlas.paste(out_glyphs[c]["image"], (px, py))
    buffer = io.BytesIO()
    atlas.save(buffer, "WEBP", lossless=True, quality=100, method=6)
    ascent = max(g["rise"] for g in out_glyphs.values())
    descent = max(g["image"].height - g["rise"] for g in out_glyphs.values())
    data = {
        "format": "ki-letters-1", "cap": CAP, "ascent": ascent, "descent": max(0, descent), "space": round(CAP * 0.36), "spacing": round(CAP * 0.04),
        "atlas": base64.b64encode(buffer.getvalue()).decode("ascii"),
        "glyphs": {c: {"rect": [place[c][0], place[c][1], g["image"].width, g["image"].height], "rise": g["rise"]} for c, g in out_glyphs.items()},
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(out_glyphs)} letters, atlas {atlas.size}, {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
