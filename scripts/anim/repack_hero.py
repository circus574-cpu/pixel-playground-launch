#!/usr/bin/env python3
"""Repack the atlases of an installed hero pack with trimmed frames (no visual change, far less texture memory).

    python3 scripts/anim/repack_hero.py <android|legend|sage|planetary> <work-dir>
    npm run assets:import -- <work-dir>/pkg/<race>/pack.json --install --replace

The base hero sheets were delivered with full 256 px cells (a 2048x2048 page = 16 MiB decoded for 64 frames) although the
figure fills only a part of each cell. Every frame is cropped to its opaque bounding box (1 px margin), kept under the
same name with Phaser `trimmed`/`spriteSourceSize` offsets, and shelf-packed into the narrowest-area page. Asset ids and
clip definitions are untouched, so the game plays the same animations; the decoded size drops by roughly half.
A frame check against the source atlas (alpha-weighted mean difference) is printed per page.
Needs: opencv-python (not used), numpy, pillow.
"""
import os, sys, json, glob, shutil
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
R = sys.argv[1]
WORK = Path(sys.argv[2]).resolve()
PID = {'android': 'hero-android-walk-v3', 'legend': 'hero-legend-walk-v3', 'sage': 'hero-sage-painted-walk-v3',
       'planetary': 'hero-planetary-painted-walk-v3'}[R]
VER = os.environ.get('HERO_VERSION', '2.3.0')
src = Path(sorted(glob.glob(str(ROOT / 'public/game/assets/gpu' / PID / '*')))[-1])
dst = WORK / 'pkg' / R
shutil.rmtree(dst, ignore_errors=True)
os.makedirs(dst)
pack = json.load(open(src / 'pack.json'))
PAD, MARGIN = 2, 1


def repack(asset):
    img = Image.open(src / asset['url'].split('/')[-1]).convert('RGBA')
    arr = np.array(img)
    js = json.load(open(src / asset['atlasUrl'].split('/')[-1]))
    items = []
    for name, fr in js['frames'].items():
        r = fr['frame']
        crop = arr[r['y']:r['y'] + r['h'], r['x']:r['x'] + r['w']]
        ys, xs = np.where(crop[:, :, 3] > 0)
        if not len(ys):
            box = (0, 0, 1, 1)
        else:
            box = (max(0, xs.min() - MARGIN), max(0, ys.min() - MARGIN),
                   min(r['w'], xs.max() + 1 + MARGIN), min(r['h'], ys.max() + 1 + MARGIN))
        ss = fr.get('spriteSourceSize', {'x': 0, 'y': 0})
        items.append((name, crop[box[1]:box[3], box[0]:box[2]].copy(), ss['x'] + box[0], ss['y'] + box[1], fr['sourceSize']))
    items.sort(key=lambda t: -t[1].shape[0])

    def shelf(width):
        x = y = shelf_h = PAD
        x = PAD; y = PAD; shelf_h = 0; pl = {}
        for name, c, ox, oy, _ in items:
            h, w = c.shape[:2]
            if x + w + PAD > width: x = PAD; y += shelf_h + PAD; shelf_h = 0
            pl[name] = (x, y); x += w + PAD; shelf_h = max(shelf_h, h)
        return pl, (y + shelf_h + PAD + 3) // 4 * 4
    widest = max(c.shape[1] for _, c, _, _, _ in items) + 2 * PAD
    W, (place, H) = min(((w, shelf(w)) for w in range(widest, 2049, 16)), key=lambda t: t[0] * t[1][1])
    atlas = np.zeros((H, W, 4), np.uint8)
    frames = {}
    for name, c, ox, oy, size in items:
        x, y = place[name]
        h, w = c.shape[:2]
        atlas[y:y + h, x:x + w] = c
        frames[name] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                        'sourceSize': size, 'spriteSourceSize': {'x': int(ox), 'y': int(oy), 'w': w, 'h': h}}
    base = asset['id']
    Image.fromarray(atlas).save(dst / (base + '.webp'), lossless=True, quality=100, method=4)
    json.dump({'frames': frames, 'meta': {'image': base + '.webp', 'size': {'w': W, 'h': H}, 'scale': '1'}},
              open(dst / (base + '.json'), 'w'))
    # verify: rebuild every frame on its source canvas from both atlases and compare
    new = np.array(Image.open(dst / (base + '.webp')).convert('RGBA')).astype(np.float32)
    worst = 0.0
    for name, fr in js['frames'].items():
        s = fr['sourceSize']
        def canvas(a, f):
            out = np.zeros((s['h'], s['w'], 4), np.float32)
            r, ss = f['frame'], f['spriteSourceSize']
            out[ss['y']:ss['y'] + r['h'], ss['x']:ss['x'] + r['w']] = a[r['y']:r['y'] + r['h'], r['x']:r['x'] + r['w']]
            return out
        a, b = canvas(arr.astype(np.float32), fr), canvas(new, frames[name])
        wgt = np.maximum(a[:, :, 3], b[:, :, 3])[:, :, None] / 255.0
        diff = (np.abs(a - b)[:, :, :3] * wgt).sum() / max(1.0, wgt.sum() * 3)
        worst = max(worst, float(diff))
    return W, H, worst, len(items)


tot_old = tot_new = 0.0
out_assets = []
for a in pack['assets']:
    if a['kind'] != 'atlas':
        out_assets.append(a); continue
    W, H, worst, n = repack(a)
    old = a['width'] * a['height'] * 4 / 2**20; new = W * H * 4 / 2**20
    tot_old += old; tot_new += new
    print(f"{a['id']}: {n} frames {a['width']}x{a['height']} ({old:.1f} MiB) -> {W}x{H} ({new:.1f} MiB), worst frame diff {worst:.2f}/255")
    na = dict(a); na.update(width=W, height=H, version=VER, url=a['id'] + '.webp', atlasUrl=a['id'] + '.json')
    out_assets.append(na)
print(f'TOTAL {tot_old:.1f} -> {tot_new:.1f} MiB')
pack['assets'] = out_assets
pack['version'] = VER
for a in pack['assets']:
    a['version'] = VER
json.dump(pack, open(dst / 'pack.json', 'w'), indent=2)
print('pack ready', R, VER)
