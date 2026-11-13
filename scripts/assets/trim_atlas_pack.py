#!/usr/bin/env python3
"""Trim the transparent margin of every frame of an installed atlas pack and repack it tightly (lossless).

    python3 scripts/assets/trim_atlas_pack.py <pack-id> <new-version> <work-dir>
    npm run assets:import -- <work-dir>/pkg/<pack-id>/pack.json --install --replace
    (packs installed outside the importer: add --install-direct, see the end of this file)

Grid atlases (monsters: 128 px cells, 2048 x 2048 pages) store each frame with the empty background around the figure;
the figure typically covers a third of its cell. Every frame is cropped to the bounding box of its non-transparent
pixels, identical crops are stored once, and the crops are shelf-packed into the smallest atlas (at most 2048 px per
side). The atlas JSON keeps every frame name, its `sourceSize` and places the crop with `spriteSourceSize`
(`trimmed: true`), so Phaser draws the frame at exactly the same place and size as before: no pixel changes.
Frames that are already trimmed keep their offsets (the new crop offset is added). Needs: numpy, pillow.
"""
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PACK, VERSION, WORK = sys.argv[1], sys.argv[2], Path(sys.argv[3]).resolve()
GPU = ROOT / 'public/game/assets/gpu' / PACK
installed = sorted(GPU.iterdir())
assert len(installed) == 1, installed
src = installed[0]
dst = WORK / 'pkg' / PACK
shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(src, dst)
pack = json.loads((dst / 'pack.json').read_text())
assert pack['version'] != VERSION, 'new version required'
pack['version'] = VERSION
PAD = 2
before = after = 0
for asset in pack['assets']:
    asset['version'] = VERSION
    asset['url'] = Path(asset['url']).name
    if asset.get('atlasUrl'):
        asset['atlasUrl'] = Path(asset['atlasUrl']).name
    if asset['kind'] != 'atlas':
        continue
    meta = json.loads((dst / asset['atlasUrl']).read_text())
    frames = meta['frames']
    named = list(frames.items()) if isinstance(frames, dict) else [(f['filename'], f) for f in frames]
    img = np.asarray(Image.open(dst / asset['url']).convert('RGBA'))
    crops, key_of, placed_of = [], {}, {}
    for name, f in named:
        assert not f.get('rotated'), name
        r = f['frame']
        cell = img[r['y']:r['y'] + r['h'], r['x']:r['x'] + r['w']]
        ys, xs = np.where(cell[:, :, 3] > 0)
        if len(ys):
            # one pixel of the original surroundings stays around the crop: bilinear sampling at the figure's edge
            # reads it, so the edge blends with the same (transparent but coloured) neighbours as before
            y0, y1 = max(0, ys.min() - 1), min(cell.shape[0], ys.max() + 2)
            x0, x1 = max(0, xs.min() - 1), min(cell.shape[1], xs.max() + 2)
        else:
            y0, y1, x0, x1 = 0, 1, 0, 1
        crop = np.ascontiguousarray(cell[y0:y1, x0:x1])
        key = (crop.shape, crop.tobytes())
        if key not in key_of:
            key_of[key] = len(crops)
            crops.append(crop)
        sss = f.get('spriteSourceSize', {'x': 0, 'y': 0})
        placed_of[name] = (key_of[key], int(sss['x'] + x0), int(sss['y'] + y0), f.get('sourceSize', {'w': r['w'], 'h': r['h']}))
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
    for name, (i, ox, oy, source) in placed_of.items():
        x, y = pos[i]
        h, w = crops[i].shape[:2]
        out[name] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                     'sourceSize': source, 'spriteSourceSize': {'x': ox, 'y': oy, 'w': w, 'h': h}}
    before += asset['width'] * asset['height'] * 4
    after += W * H * 4
    print(asset['id'], f"{asset['width']}x{asset['height']} -> {W}x{H}", 'frames', len(named), 'unique', len(crops))
    # proof: every frame rebuilt at its source size from the new atlas equals the old frame, pixel for pixel
    def rebuild(sheet, f):
        r, sss, size = f['frame'], f.get('spriteSourceSize', {'x': 0, 'y': 0}), f.get('sourceSize', {'w': f['frame']['w'], 'h': f['frame']['h']})
        full = np.zeros((size['h'], size['w'], 4), np.uint8)
        full[sss['y']:sss['y'] + r['h'], sss['x']:sss['x'] + r['w']] = sheet[r['y']:r['y'] + r['h'], r['x']:r['x'] + r['w']]
        return full
    # (fully transparent pixels may hold any colour in the old sheet: they are invisible, so alpha is compared
    # everywhere and colour wherever alpha > 0)
    for name, f in named:
        old, new = rebuild(img, f), rebuild(atlas, out[name])
        seen = old[:, :, 3] > 0
        assert np.array_equal(old[:, :, 3], new[:, :, 3]) and np.array_equal(old[seen], new[seen]), 'pixel mismatch: ' + name
    # exact: keep the colour of transparent pixels (the 1 px surroundings), which plain lossless WebP would zero
    Image.fromarray(atlas).save(dst / asset['url'], lossless=True, quality=100, method=4, exact=True)
    assert np.array_equal(np.asarray(Image.open(dst / asset['url']).convert('RGBA')), atlas), 'lossy save'
    meta['frames'] = out
    meta['meta'] = {**meta.get('meta', {}), 'image': asset['url'], 'size': {'w': W, 'h': H}}
    (dst / asset['atlasUrl']).write_text(json.dumps(meta))
    asset['width'], asset['height'] = W, H
(dst / 'pack.json').write_text(json.dumps(pack, indent=2))
print(PACK, 'decoded MiB', round(before / 2**20, 2), '->', round(after / 2**20, 2), 'pack ready', VERSION)

if '--install-direct' in sys.argv:
    # For packs installed outside the importer (scripts/gpu/ingest_creature_sheet.py writes them directly; their
    # 1-frame idle is outside the importer's production contract): same layout as that script, the registry entry is
    # replaced in place (its position decides which binding wins) and the old version directory is removed.
    import hashlib
    h = hashlib.sha256()
    for f in sorted(dst.iterdir()):
        if f.name != 'pack.json':
            h.update(f.name.encode())
            h.update(f.read_bytes())
    h.update(json.dumps(pack, sort_keys=True).encode())
    target = GPU / f'{VERSION}-{h.hexdigest()[:12]}'
    base = '/game/assets/gpu/' + PACK + '/' + target.name + '/'
    for asset in pack['assets']:
        asset['url'] = base + asset['url']
        if asset.get('atlasUrl'):
            asset['atlasUrl'] = base + asset['atlasUrl']
    (dst / 'pack.json').write_text(json.dumps(pack, ensure_ascii=False))
    shutil.copytree(dst, target)
    registry = ROOT / 'src/game/assets/imported.json'
    packs = json.loads(registry.read_text())
    at = [p['id'] for p in packs].index(PACK)
    packs[at] = pack
    registry.write_text(json.dumps(packs, ensure_ascii=False, indent=2) + '\n')
    shutil.rmtree(src)
    print('installed', target.relative_to(ROOT), 'registry position', at)
