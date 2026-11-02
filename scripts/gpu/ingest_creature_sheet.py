#!/usr/bin/env python3
"""Turns one owner-generated animation sheet (3 rows on white: walk, attack, death) into an actor
pack of the existing format: one 2048x1024 atlas of 256 px square cells (right-facing plus mirrored
left-facing frames), all 8 directions mapped to the right or left frames.

usage: ingest_creature_sheet.py <sheet.jpg|png> <monster-id e.g. verdant-cierniowy-wilk> [version-suffix]
Creates a NEW opt-in pack enemy-v3-<monster>; the existing enemy-v2 pack is left untouched.
"""
import hashlib, json, os, shutil, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CELL, BASEY = 256, 0.8
DIRS = ["down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right"]
LEFT = {"down-left", "left", "up-left"}


def segment(sheet):
    a = np.asarray(sheet.convert("RGB")).astype(int)
    fg = ndimage.binary_closing(a.min(2) < 235, iterations=3)
    lab, _ = ndimage.label(fg)
    boxes = [
        (s[0].start, s[1].start, s[0].stop, s[1].stop)
        for s in ndimage.find_objects(lab)
        if (s[0].stop - s[0].start) * (s[1].stop - s[1].start) > 8000
    ]
    boxes.sort()
    ys = sorted({b[0] for b in boxes})
    rows = [[], [], []]
    # three rows: group by vertical start
    cut = [ys[0]]
    for y in ys[1:]:
        if y - cut[-1] > 200:
            cut.append(y)
    if len(cut) != 3:
        raise SystemExit(f"expected 3 rows, found {len(cut)}")
    for b in boxes:
        rows[max(i for i, c in enumerate(cut) if b[0] >= c - 100)].append(b)
    for r in rows:
        r.sort(key=lambda b: b[1])
    return rows


def cutout(sheet, box):
    y0, x0, y1, x1 = box
    crop = sheet.convert("RGB").crop((max(0, x0 - 12), max(0, y0 - 12), x1 + 12, y1 + 12))
    a = np.asarray(crop).astype(int)
    white = a.min(2) >= 222
    lab, _ = ndimage.label(white)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    lw, nw = ndimage.label(white & ~bg)
    for i in range(1, nw + 1):  # large white gaps between legs are background too
        m = lw == i
        if m.sum() > 120:
            bg |= m
    alpha = ndimage.binary_opening(~bg, iterations=1)
    l2, n2 = ndimage.label(alpha)
    if n2 > 1:
        alpha = l2 == (1 + int(np.argmax(ndimage.sum(alpha, l2, range(1, n2 + 1)))))
    alpha = ndimage.binary_erosion(alpha, iterations=1)
    al = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    rgba = crop.convert("RGBA")
    rgba.putalpha(al)
    return rgba.crop(rgba.getbbox())


def main():
    src, monster = sys.argv[1], sys.argv[2]
    world, name = monster.split("-", 1)
    old_id = f"enemy-v2-{monster}"
    pack_id = f"enemy-v3-{monster}"
    sheet = Image.open(src)
    rows = segment(sheet)
    counts = [len(r) for r in rows]
    if counts[0] < 4 or counts[1] < 3 or counts[2] < 3:
        raise SystemExit(f"too few frames per row: {counts}")
    frames = {f"{k}{i}": cutout(sheet, b) for k, row in zip("wad", rows) for i, b in enumerate(row)}
    scale = (CELL - 6) / max(f.size[0] for f in frames.values())
    base = int(CELL * BASEY)
    if max(f.size[1] for f in frames.values()) * scale > base + 2:
        raise SystemExit("a frame is taller than the baseline allows")
    cells = {}
    for k, f in frames.items():
        nf = f.resize((max(1, round(f.size[0] * scale)), max(1, round(f.size[1] * scale))), Image.LANCZOS)
        c = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        c.paste(nf, ((CELL - nf.size[0]) // 2, base - nf.size[1]), nf)
        cells[k] = c
    names = list(cells)
    atlas = Image.new("RGBA", (2048, 1024), (0, 0, 0, 0))
    rect = {}
    for i, k in enumerate(names):
        for side, flip in (("r", False), ("l", True)):
            x = (i * 2 + (1 if flip else 0)) % 8 * CELL
            y = (i * 2 + (1 if flip else 0)) // 8 * CELL
            atlas.paste(cells[k].transpose(Image.FLIP_LEFT_RIGHT) if flip else cells[k], (x, y))
            rect[(k, side)] = {"x": x, "y": y, "w": CELL, "h": CELL}
    w, a_, d = counts
    clips = {
        "idle": ("page", 6, True, [f"w0"]),
        "walk": ("page", 10, True, [f"w{i}" for i in range(w)]),
        "attack": ("page", 10, False, [f"a{i}" for i in range(a_)]),
        "skill": ("page", 10, False, [f"a{i}" for i in range(a_)]),
        "hit": ("page", 12, False, ["d0"]),
        "death": ("page", 6, False, [f"d{i}" for i in range(d)]),
        "respawn": ("page", 8, False, [f"d{i}" for i in reversed(range(d))]),
    }
    atlas_frames, actor_clips = {}, {}
    asset_id = f"{pack_id}-page-0"
    for clip, (_, fps, loop, seq) in clips.items():
        dirs = {}
        for dr in DIRS:
            side = "l" if dr in LEFT else "r"
            lst = []
            for n, k in enumerate(seq):
                fname = f"{pack_id}/{clip}/{dr}/{n:02d}"
                r = rect[(k, side)]
                atlas_frames[fname] = {
                    "frame": r, "rotated": False, "trimmed": False,
                    "sourceSize": {"w": CELL, "h": CELL},
                    "spriteSourceSize": {"x": 0, "y": 0, "w": CELL, "h": CELL},
                }
                lst.append(fname)
            dirs[dr] = lst
        actor_clips[clip] = {"asset": asset_id, "fps": fps, "loop": loop, "directions": dirs}
    atlas_json = {"frames": atlas_frames, "meta": {"app": "ingest_creature_sheet", "image": f"{asset_id}.webp",
                  "format": "RGBA8888", "size": {"w": 2048, "h": 1024}, "scale": "1"}}
    webp = os.path.join("/tmp", f"{asset_id}.webp")
    atlas.save(webp, quality=90, method=6)
    jtxt = json.dumps(atlas_json, separators=(",", ":"))
    h = hashlib.sha256(open(webp, "rb").read() + jtxt.encode()).hexdigest()[:12]
    out = os.path.join(REPO, "public/game/assets/gpu", pack_id, f"1.0.0-{h}")
    os.makedirs(out, exist_ok=True)
    shutil.copy(webp, os.path.join(out, f"{asset_id}.webp"))
    open(os.path.join(out, f"{asset_id}.json"), "w").write(jtxt)
    ext = os.path.splitext(src)[1]
    shutil.copy(src, os.path.join(out, f"source-sheet{ext}"))
    url = f"/game/assets/gpu/{pack_id}/1.0.0-{h}/{asset_id}"
    imported_path = os.path.join(REPO, "src/game/assets/imported.json")
    imported = json.load(open(imported_path))
    old = next((p for p in imported if p["id"] == old_id), None)
    if not old:
        raise SystemExit("existing pack not found in imported.json")
    # The new pack is separate and opt-in: the existing monster pack stays untouched.
    actor = {**{k: v for k, v in old["actors"][0].items() if k != "clips"}, "id": pack_id, "clips": actor_clips}
    pack = {**{k: v for k, v in old.items() if k not in ("assets", "actors")}, "id": pack_id,
            "actorBindings": {k: pack_id for k in old["actorBindings"]},
            "assets": [{"id": asset_id, "version": "1.0.0", "kind": "atlas", "url": url + ".webp",
                        "atlasUrl": url + ".json", "width": 2048, "height": 1024}],
            "actors": [actor]}
    json.dump(pack, open(os.path.join(out, "pack.json"), "w"), ensure_ascii=False)
    imported = [p for p in imported if p["id"] != pack_id] + [pack]
    open(imported_path, "w").write(json.dumps(imported, ensure_ascii=False, indent=2) + "\n")
    print("pack", pack_id, "->", out, "frames", counts)


main()
