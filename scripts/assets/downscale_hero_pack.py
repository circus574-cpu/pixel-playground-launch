#!/usr/bin/env python3
"""Store a hero pack's frames at a smaller cell (256 px -> 200 px by default), trimmed and tightly packed.

    python3 scripts/assets/downscale_hero_pack.py <pack-dir> <new-version> <work-dir> [cell]
    npm run assets:import -- <work-dir>/pkg/<pack-id>/pack.json --install --replace

<pack-dir> is an installed pack (public/game/assets/gpu/<id>/<version>-<digest>) or a package a clip builder just made
(scripts/anim/*_build.py write 256 px cells; run this on their pkg/<race> before importing it). Frames whose cell
(`sourceSize`) is larger than the target are rebuilt at full cell size, scaled as a whole with premultiplied alpha
(Lanczos), then trimmed to the figure (+1 px surroundings) and shelf-packed; frames already at the target cell are only
repacked. Identical frames are stored once and every frame name is kept, so clips and the `mirrored` lists are
unchanged. The game draws the hero at its contract size (`setDisplaySize`, the frame's `sourceSize`), so the hero keeps
its size on screen and the cell origin (feet at 0.95 of the cell) stays in place.
The hero is drawn at most 133 px at zoom 1 (200 px inside buildings), so a 200 px cell keeps it sharp at normal zoom.
"""
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SRC, VERSION, WORK = Path(sys.argv[1]).resolve(), sys.argv[2], Path(sys.argv[3]).resolve()
CELL = int(sys.argv[4]) if len(sys.argv) > 4 else 200
pack = json.loads((SRC / 'pack.json').read_text())
dst = WORK / 'pkg' / pack['id']
shutil.rmtree(dst, ignore_errors=True)
dst.mkdir(parents=True)
assert pack['version'] != VERSION, 'new version required'
pack['version'] = VERSION
PAD = 2
before = after = 0


def full_frame(sheet, f):
    r, sss = f['frame'], f.get('spriteSourceSize', {'x': 0, 'y': 0})
    size = f.get('sourceSize', {'w': r['w'], 'h': r['h']})
    out = np.zeros((size['h'], size['w'], 4), np.uint8)
    out[sss['y']:sss['y'] + r['h'], sss['x']:sss['x'] + r['w']] = sheet[r['y']:r['y'] + r['h'], r['x']:r['x'] + r['w']]
    return out


def scaled(cell):
    # premultiplied resize: transparent pixels contribute no colour, so edges keep their colour
    im = Image.fromarray(cell, 'RGBA').convert('RGBa').resize((CELL, CELL), Image.LANCZOS).convert('RGBA')
    return np.asarray(im)


for asset in pack['assets']:
    asset['version'] = VERSION
    asset['url'] = Path(asset['url']).name
    if asset.get('atlasUrl'):
        asset['atlasUrl'] = Path(asset['atlasUrl']).name
    if asset['kind'] != 'atlas':
        shutil.copy(SRC / asset['url'], dst / asset['url'])
        continue
    meta = json.loads((SRC / asset['atlasUrl']).read_text())
    frames = meta['frames']
    named = list(frames.items()) if isinstance(frames, dict) else [(f['filename'], f) for f in frames]
    sheet = np.asarray(Image.open(SRC / asset['url']).convert('RGBA'))
    crops, key_of, placed = [], {}, {}
    for name, f in named:
        assert not f.get('rotated'), name
        cell = full_frame(sheet, f)
        assert cell.shape[0] == cell.shape[1], name
        if cell.shape[0] > CELL:
            cell = scaled(cell)
        ys, xs = np.where(cell[:, :, 3] > 0)
        if len(ys):
            y0, y1 = max(0, ys.min() - 1), min(cell.shape[0], ys.max() + 2)
            x0, x1 = max(0, xs.min() - 1), min(cell.shape[1], xs.max() + 2)
        else:
            y0, y1, x0, x1 = 0, 1, 0, 1
        crop = np.ascontiguousarray(cell[y0:y1, x0:x1])
        key = (crop.shape, crop.tobytes())
        if key not in key_of:
            key_of[key] = len(crops)
            crops.append(crop)
        placed[name] = (key_of[key], int(x0), int(y0), {'w': cell.shape[1], 'h': cell.shape[0]})
    order = sorted(range(len(crops)), key=lambda i: -crops[i].shape[0])

    def shelf(width):
        x = y = PAD
        row = 0
        pos = {}
        for i in order:
            h, w = crops[i].shape[:2]
            if x + w + PAD > width:
                x, y, row = PAD, y + row + PAD, 0
            pos[i] = (x, y)
            x += w + PAD
            row = max(row, h)
        return pos, (y + row + PAD + 3) // 4 * 4

    widest = max(c.shape[1] for c in crops) + 2 * PAD
    options = []
    for width in range(widest, 2049, 8):
        pos, height = shelf(width)
        if height <= 2048:
            options.append((width * height, width, height, pos))
    assert options, 'does not fit 2048 x 2048: ' + asset['id']
    _, W, H, pos = min(options, key=lambda t: (t[0], max(t[1], t[2])))
    atlas = np.zeros((H, W, 4), np.uint8)
    for i, c in enumerate(crops):
        x, y = pos[i]
        atlas[y:y + c.shape[0], x:x + c.shape[1]] = c
    out = {}
    for name, (i, ox, oy, source) in placed.items():
        x, y = pos[i]
        h, w = crops[i].shape[:2]
        out[name] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                     'sourceSize': source, 'spriteSourceSize': {'x': ox, 'y': oy, 'w': w, 'h': h}}
    before += asset['width'] * asset['height'] * 4
    after += W * H * 4
    Image.fromarray(atlas).save(dst / asset['url'], lossless=True, quality=100, method=4, exact=True)
    assert np.array_equal(np.asarray(Image.open(dst / asset['url']).convert('RGBA')), atlas), 'lossy save'
    meta['frames'] = out
    meta['meta'] = {**meta.get('meta', {}), 'image': asset['url'], 'size': {'w': W, 'h': H}}
    (dst / asset['atlasUrl']).write_text(json.dumps(meta))
    asset['width'], asset['height'] = W, H
    print(asset['id'], 'frames', len(named), 'unique', len(crops), f'-> {W}x{H}')
(dst / 'pack.json').write_text(json.dumps(pack, indent=2))
print(pack['id'], 'cell', CELL, 'decoded MiB', round(before / 2**20, 2), '->', round(after / 2**20, 2), 'pack ready', VERSION)
