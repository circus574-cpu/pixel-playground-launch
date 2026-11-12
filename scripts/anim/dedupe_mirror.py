#!/usr/bin/env python3
"""Drop the mirrored copies of side-view frames from an installed hero pack: the game draws them with sprite flipX.

    python3 scripts/anim/dedupe_mirror.py <android|legend|sage|planetary> <work-dir>
    npm run assets:import -- <work-dir>/pkg/<race>/pack.json --install --replace      (MIRROR_VERSION bumps the pack)

Side-view clips (fights, Tryb KI, combat) store a right-facing strip and its horizontal mirror for the left-facing
directions. For every clip whose left-facing frames are, pixel for pixel, the mirror of the right-facing ones, the
left directions now reference the right frames and are listed in the clip's `mirrored` field; the mirror copies
leave the atlases, which are repacked trimmed and lossless (about half the decoded size of those atlases).
Frames that are not exact mirrors are kept as they are. Needs: numpy, pillow.
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
VER = os.environ.get('MIRROR_VERSION', '2.7.0')
LEFT = {'left': 'right', 'up-left': 'up-right', 'down-left': 'down-right'}
# SRC_PACK (a directory with pack.json) dedupes a freshly built pack before it is installed (the importer checks the budget)
src = Path(os.environ['SRC_PACK']) if os.environ.get('SRC_PACK') else Path(sorted(glob.glob(str(ROOT / 'public/game/assets/gpu' / PID / '*')))[-1])
dst = WORK / 'pkg' / R
shutil.rmtree(dst, ignore_errors=True)
os.makedirs(dst)
pack = json.load(open(src / 'pack.json'))
clips = pack['actors'][0]['clips']

atlases = {}
def atlas(aid):
    if aid not in atlases:
        js = json.load(open(src / f'{aid}.json'))['frames']
        img = np.array(Image.open(src / f'{aid}.webp').convert('RGBA'))
        atlases[aid] = (js, img)
    return atlases[aid]

def cell(aid, name):
    js, img = atlas(aid)
    f = js[name]; r = f['frame']; ss = f.get('spriteSourceSize', {'x': 0, 'y': 0}); s = f['sourceSize']
    c = np.zeros((s['h'], s['w'], 4), np.uint8)
    c[ss['y']:ss['y'] + r['h'], ss['x']:ss['x'] + r['w']] = img[r['y']:r['y'] + r['h'], r['x']:r['x'] + r['w']]
    return c

dropped = {}
for state, clip in clips.items():
    dirs = clip['directions']
    if clip.get('mirrored'): continue
    ok = True
    for left, right in LEFT.items():
        a, b = dirs.get(left), dirs.get(right)
        if not a or not b or len(a) != len(b) or a == b: ok = False; break
        for na, nb in zip(a, b):
            m, c = cell(clip['asset'], na)[:, ::-1], cell(clip['asset'], nb)
            # colour under fully transparent pixels does not matter (lossless WebP may change it)
            vis = c[:, :, 3] > 0
            if not (np.array_equal(m[:, :, 3], c[:, :, 3]) and np.array_equal(m[vis], c[vis])): ok = False; break
        if not ok: break
    if not ok: continue
    # every left-facing direction (and any other direction sharing the left strip) now draws the right strip flipped
    left_strip = dirs['left']
    mirrored = [d for d, names in dirs.items() if names == left_strip]
    for d in mirrored: dirs[d] = list(dirs['right'])
    clip['mirrored'] = sorted(mirrored)
    dropped.setdefault(clip['asset'], set()).update(left_strip)
    print(state, 'mirrored', clip['mirrored'])

used = {}
for clip in clips.values():
    for names in clip['directions'].values(): used.setdefault(clip['asset'], set()).update(names)

PAD = 2
def repack(asset):
    js, img = atlas(asset['id'])
    keep = [n for n in js if n in used.get(asset['id'], set())]
    items = []
    for n in keep:
        c = cell(asset['id'], n)
        ys, xs = np.where(c[:, :, 3] > 0)
        if len(ys): y0, y1, x0, x1 = max(0, ys.min() - 1), min(c.shape[0] - 1, ys.max() + 1), max(0, xs.min() - 1), min(c.shape[1] - 1, xs.max() + 1)
        else: y0 = y1 = x0 = x1 = 0
        items.append((n, c[y0:y1 + 1, x0:x1 + 1].copy(), int(x0), int(y0), js[n]['sourceSize']))
    items.sort(key=lambda t: -t[1].shape[0])
    def shelf(width):
        x = y = PAD; sh = 0; pl = {}
        for n, c, ox, oy, _ in items:
            h, w = c.shape[:2]
            if x + w + PAD > width: x = PAD; y += sh + PAD; sh = 0
            pl[n] = (x, y); x += w + PAD; sh = max(sh, h)
        return pl, (y + sh + PAD + 3) // 4 * 4
    widest = max(c.shape[1] for _, c, _, _, _ in items) + 2 * PAD
    W, (place, H) = min(((w, shelf(w)) for w in range(widest, 2049, 16) if shelf(w)[1] <= 2048), key=lambda t: t[0] * t[1][1])
    out = np.zeros((H, W, 4), np.uint8); frames = {}
    for n, c, ox, oy, size in items:
        x, y = place[n]; h, w = c.shape[:2]; out[y:y + h, x:x + w] = c
        frames[n] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True, 'sourceSize': size,
                     'spriteSourceSize': {'x': ox, 'y': oy, 'w': w, 'h': h}}
    Image.fromarray(out).save(dst / f"{asset['id']}.webp", lossless=True, quality=100, method=4)
    json.dump({'frames': frames, 'meta': {'image': asset['id'] + '.webp', 'size': {'w': W, 'h': H}, 'scale': '1'}}, open(dst / f"{asset['id']}.json", 'w'))
    return W, H

before = after = 0
for a in pack['assets']:
    before += a['width'] * a['height'] * 4
    if a['id'] in dropped:
        a['width'], a['height'] = repack(a)
    else:
        for ext in ('webp', 'json'): shutil.copy(src / f"{a['id']}.{ext}", dst)
    after += a['width'] * a['height'] * 4
    a['version'] = VER; a['url'] = a['id'] + '.webp'
    if a.get('atlasUrl'): a['atlasUrl'] = a['id'] + '.json'
pack['version'] = VER
json.dump(pack, open(dst / 'pack.json', 'w'), indent=2)
print(R, f'decoded {before / 2**20:.1f} -> {after / 2**20:.1f} MiB', 'pack ready', VER)
