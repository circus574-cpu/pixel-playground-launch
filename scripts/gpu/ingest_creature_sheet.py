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


COLS, ROWS = 4, 3


def cutouts(sheet):
    """Frames of a COLS x ROWS sheet: components are grouped by the grid cell holding their centroid,
    so debris, sparks and slightly spilling limbs stay with their frame."""
    rgb = np.asarray(sheet.convert("RGB")).astype(int)
    h, w = rgb.shape[:2]
    white = rgb.min(2) >= 222
    lab, _ = ndimage.label(white)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    lw, nw = ndimage.label(white & ~bg)
    mins = rgb.min(2)
    near_bg = ndimage.binary_dilation(bg, iterations=12)
    for i in range(1, nw + 1):
        # An enclosed light region is background only when it is pure white and flat (a gap between
        # legs). Light fur, a mane or a silver panel is off-white and shaded: it stays opaque.
        m = lw == i
        n_px = int(m.sum())
        if n_px <= 25 or np.median(mins[m]) < 246 or rgb[m].std() > 7.6:
            continue
        # A real gap in the background is ringed by dark outlines or dark material (black, brown
        # roots); the white core of a glow (a beam, a plasma ball) is ringed by bright colour
        # and stays opaque.
        ring = ndimage.binary_dilation(m, iterations=3) & ~m
        around = rgb[ring]
        luma = (0.3 * around[:, 0] + 0.59 * around[:, 1] + 0.11 * around[:, 2]).mean()
        dark = (around.max(1) < 110).mean()
        if n_px > 120:
            if dark >= 0.25 or luma < 135:
                bg |= m
        # Small slivers between roots or limbs at the silhouette; an eye's highlight lies deeper.
        elif (m & near_bg).any() and dark >= 0.5 and luma < 110:
            bg |= m
    fg = ~bg
    # Frames that touch (a horn against a neighbour's tail) are split along the grid lines:
    # cut the foreground at every cell border, then group the pieces by their cell.
    cut = fg.copy()
    for c in range(1, COLS):
        x = round(c * w / COLS)
        cut[:, max(0, x - 6) : x + 6] = False
    for r in range(1, ROWS):
        y = round(r * h / ROWS)
        cut[max(0, y - 6) : y + 6, :] = False
    comps, n = ndimage.label(ndimage.binary_closing(cut, iterations=1))
    objs = ndimage.find_objects(comps)
    owner, area, bbox = {}, {}, {}
    for i, sl in enumerate(objs, 1):
        m = comps[sl] == i
        if m.sum() < 400:
            continue
        cy, cx = ndimage.center_of_mass(m)
        row = min(ROWS - 1, int((sl[0].start + cy) / (h / ROWS)))
        col = min(COLS - 1, int((sl[1].start + cx) / (w / COLS)))
        owner[i], area[i], bbox[i] = (row, col), int(m.sum()), sl
    # An attack effect (beam, blades, a thrown talisman) often crosses the grid line: the cut then
    # splits one object in two. A small piece that is continuous with a larger one across a cut
    # zone belongs to the larger one's frame, and the zone pixels between them are put back.
    bridges = {}
    for axis in (1, 0):
        size = w if axis == 1 else h
        count = COLS if axis == 1 else ROWS
        fgv = fg if axis == 1 else fg.T
        cv = comps if axis == 1 else comps.T
        for c in range(1, count):
            z0, z1 = round(c * size / count) - 6, round(c * size / count) + 6
            left = {i for i in owner if (bbox[i][axis].stop >= z0 - 3) and (bbox[i][axis].start < z0)}
            right = {i for i in owner if (bbox[i][axis].start <= z1 + 3) and (bbox[i][axis].stop > z1)}
            for a_ in left:
                for b_ in right:
                    if owner[a_] == owner[b_]:
                        continue
                    ya = np.any(cv[:, max(0, z0 - 3) : z0] == a_, axis=1)
                    yb = np.any(cv[:, z1 : z1 + 3] == b_, axis=1)
                    rows = np.where(ya & yb & np.all(fgv[:, z0:z1], axis=1))[0]
                    if not len(rows) or min(area[a_], area[b_]) >= 0.4 * max(area[a_], area[b_]):
                        continue
                    big, small = (a_, b_) if area[a_] >= area[b_] else (b_, a_)
                    owner[small] = owner[big]
                    mask = np.zeros(fgv.shape, bool)
                    mask[rows.min() : rows.max() + 1, z0:z1] = fgv[rows.min() : rows.max() + 1, z0:z1]
                    bridges.setdefault(owner[big], []).append(mask if axis == 1 else mask.T)
    # What is left of a spill (a sliver touching a cut zone, far smaller than the frame's body) is
    # dropped instead of widening the frame.
    largest = {}
    for i in owner:
        largest[owner[i]] = max(largest.get(owner[i], 0), area[i])
    zones = [(round(c * w / COLS) - 6, round(c * w / COLS) + 6, 1) for c in range(1, COLS)] + [
        (round(r * h / ROWS) - 6, round(r * h / ROWS) + 6, 0) for r in range(1, ROWS)
    ]
    for i in list(owner):
        if area[i] >= 0.06 * largest[owner[i]]:
            continue
        sl = bbox[i]
        if any(sl[ax].start <= z1 + 3 and sl[ax].stop >= z0 - 3 and sl[ax].start < z1 and sl[ax].stop > z0 - 1 and (sl[ax].stop - sl[ax].start) < 60 for z0, z1, ax in zones):
            del owner[i]
    cells = {}
    for i, cell in owner.items():
        cells.setdefault(cell, []).append(i)
    out = {}
    for (row, col), ids in cells.items():
        keep = np.isin(comps, ids)
        for mask in bridges.get((row, col), []):
            keep |= mask
        keep &= fg
        keep = ndimage.binary_opening(keep, iterations=1)
        keep = ndimage.binary_erosion(keep, iterations=1)
        ys, xs = np.where(keep)
        if len(ys) < 400:
            continue
        al = Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        rgba = sheet.convert("RGBA")
        rgba.putalpha(al)
        out[(row, col)] = rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    return out


def main():
    src, monster = sys.argv[1], sys.argv[2]
    world, name = monster.split("-", 1)
    old_id = f"enemy-v2-{monster}"
    pack_id = f"enemy-v3-{monster}"
    sheet = Image.open(src)
    grid = cutouts(sheet)
    missing = [(r, c) for r in range(ROWS) for c in range(COLS) if (r, c) not in grid]
    if missing:
        raise SystemExit(f"empty cells in the sheet: {missing}")
    frames = {f"{k}{c}": grid[(r, c)] for r, k in enumerate("wad") for c in range(COLS)}
    counts = [COLS, COLS, COLS]
    base = int(CELL * BASEY)
    # Frames much wider than the rest are long effects (tongue, beam): they never set the scale.
    # Every other frame must fit the cell completely, so no body part is ever cut off.
    widths = sorted(f.size[0] for f in frames.values())
    median = widths[len(widths) // 2]
    # --no-effects: wide frames are the body (spread wings, a striking serpent), never clipped.
    effect = set() if "--no-effects" in sys.argv else {k for k, f in frames.items() if f.size[0] > 1.45 * median}
    body = [f for k, f in frames.items() if k not in effect]
    scale = min(min((CELL - 6) / f.size[0], (base - 2) / f.size[1]) for f in body)
    cells = {}
    placed_x = {}
    order = [f"{k}{c}" for k in "wad" for c in range(COLS)]
    for k in order:
        f = frames[k]
        nf = f.resize((max(1, round(f.size[0] * scale)), max(1, round(f.size[1] * scale))), Image.LANCZOS)
        prev = f"{k[0]}{int(k[1:]) - 1}"
        if k in effect and prev in placed_x:
            x = placed_x[prev]  # keep the body where it was; the effect extends past it
        else:
            x = (CELL - nf.size[0]) // 2
        placed_x[k] = x
        c = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        c.paste(nf, (x, base - nf.size[1]), nf)
        if k in effect:  # fade the clipped end instead of a hard cut
            a_ = np.asarray(c.split()[3]).astype(float)
            ramp = np.clip((CELL - np.arange(CELL)) / 40.0, 0, 1)
            c.putalpha(Image.fromarray((a_ * ramp[None, :]).astype(np.uint8)))
        cells[k] = c
    print("effect frames:", sorted(effect))
    print("scale", round(scale, 3))
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
