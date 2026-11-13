#!/usr/bin/env python3
"""Rebuild the front/back-derived walk directions of a hero from the owner's walk-turnaround video with a full gait cycle.

    python3 scripts/anim/walk_rebuild.py <legend|planetary|android> <video.mp4> <work-dir>
    (CELL=200 for packs stored at the 200 px hero cell, see scripts/assets/downscale_hero_pack.py)
    npm run assets:import -- <work-dir>/pkg/<race>/pack.json --install --replace      (WALK_VERSION bumps the pack)

The first walk cut chose each loop as the pair of frames with the most similar silhouette (12..44 frames apart). In the
front and back views that picks a stretch with almost no leg motion (or half a cycle), so the legs looked locked.
Here the loop length is the real gait period: the first lag whose lower-body RGB difference is a strong minimum
(Legend front and back: 30 frames), otherwise the longest lag the segment allows (short Planetary segments). Eight frames are
sampled evenly over that period. The side views (left, right) are kept from the installed pack; the rebuilt directions
get new walk frames and the breathing idle derived from them (same rule as the first build). Matting: rembg isnet-anime;
placement: one scale per video (from frame 0), feet on y=248, body centred on x=128, like the first cut.
Needs: ffmpeg, rembg (isnet-anime), opencv-python, numpy, pillow.
"""
import os, sys, json, glob, shutil, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
R, VIDEO = sys.argv[1], str(Path(sys.argv[2]).resolve())
WORK = Path(sys.argv[3]).resolve()
os.makedirs(WORK, exist_ok=True)
os.chdir(WORK)
import numpy as np, cv2
from PIL import Image
from rembg import remove, new_session

ACTOR = {'legend': 'hero-legend', 'planetary': 'hero-planetary-painted', 'android': 'hero-android'}[R]
PID = {'legend': 'hero-legend-walk-v3', 'planetary': 'hero-planetary-painted-walk-v3', 'android': 'hero-android-walk-v3'}[R]
G = str(ROOT / 'public/game/assets/gpu') + '/'
# the figure is placed on a 256 px cell (feet on y=248, 240 px tall); a pack stored at a smaller cell (CELL=200) gets the
# new frames scaled down as a whole (premultiplied Lanczos) and keeps its other frames untouched
B, FOOT, H_TARGET = 256, 248, 240
F = int(os.environ.get('CELL', B))
DIRS = ['down', 'down-left', 'left', 'up-left', 'up', 'up-right', 'right', 'down-right']
# view segments of the video (frame ranges) and which directions use them: direction -> (view, mirrored)
VIEWS = {
    # Legend: second walk film (13.11.2026): front 0-58, back 60-118 (frames 128-178 / 180-239 repeat the same walk)
    'legend': {'front': (0, 58), 'back': (60, 118)},
    'planetary': {'front': (0, 30), 'back': (35, 56), 'front34': (118, 178), 'back34': (178, 239)},
    # Android (13.11.2026): front 0-61, back 68-120, front 3/4 (turned to the viewer's left) 133-176; the 3/4 back part
    # (189-239) turns to a plain back view after a few frames, so the back diagonals use the plain back
    'android': {'front': (0, 61), 'back': (68, 120), 'front34': (133, 176)},
}[R]
MAP = {
    'legend': {'down': ('front', 0), 'down-left': ('front', 0), 'down-right': ('front', 1),
               'up': ('back', 0), 'up-left': ('back', 0), 'up-right': ('back', 1)},
    'planetary': {'down': ('front', 0), 'up': ('back', 0), 'down-left': ('front34', 1), 'down-right': ('front34', 0),
                  'up-left': ('back34', 1), 'up-right': ('back34', 0)},
    'android': {'down': ('front', 0), 'up': ('back', 0), 'down-left': ('front34', 0), 'down-right': ('front34', 1),
                'up-left': ('back', 0), 'up-right': ('back', 1)},
}[R]

os.makedirs('raw', exist_ok=True)
if not os.path.exists('raw/f_001.png'):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', VIDEO, 'raw/f_%03d.png'], check=True)
files = sorted(glob.glob('raw/f_*.png'))
sess = new_session('isnet-anime')


def matte(i):
    p = f'mat/{i:03d}.png'
    os.makedirs('mat', exist_ok=True)
    if not os.path.exists(p):
        remove(Image.open(files[i]).convert('RGB'), session=sess).save(p)
    a = np.asarray(Image.open(p).convert('RGBA')).copy()
    al = a[:, :, 3]; al[al < 24] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats((al > 0).astype(np.uint8), 8)
    if n > 1:
        big = st[1:, 4].max()
        for k in range(1, n):
            if st[k, 4] < 0.004 * big: al[lab == k] = 0
    return a


def gray(i, size=(320, 180)):
    return np.asarray(Image.open(files[i]).convert('L').resize(size)).astype(np.float32)


def pick_loop(s0, s1):
    """(a0, L) of one gait cycle inside frames s0..s1."""
    ims = [gray(i) for i in range(s0, s1 + 1)]
    n = len(ims)
    ys, xs = np.where(ims[0] < 200)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    h = y1 - y0
    low = [im[y0 + int(h * 0.62):y1 + 2, max(0, x0 - 10):x1 + 10] for im in ims]
    lags = list(range(14, n - 2))
    D = {L: float(np.mean([np.abs(low[i] - low[i + L]).mean() for i in range(n - L)])) for L in lags}
    med = float(np.median(list(D.values())))
    cand = [L for L in lags if D[L] < 0.5 * med and (L - 1 not in D or D[L] <= D[L - 1]) and (L + 1 not in D or D[L] <= D[L + 1])]
    if cand: L = cand[0]
    else:
        long_lags = [L for L in lags if L >= 0.7 * n] or lags[-3:]
        L = min(long_lags, key=lambda k: D[k])
    full = [cv2.resize(im, (160, 90)) for im in ims]
    a0 = min(range(0, n - L), key=lambda i: float(np.abs(full[i] - full[i + L]).mean()))
    print('  segment', s0, s1, 'period', L, 'start', s0 + a0, 'D(L)', round(D[L], 1), 'median', round(med, 1))
    return s0 + a0, L


ref = matte(0)
ys, xs = np.nonzero(ref[:, :, 3] > 128)
SC = H_TARGET / ((ys.max() - ys.min()) * 1.08)
print('scale', round(SC, 4))


def body(a):
    ys, xs = np.nonzero(a[:, :, 3] > 128)
    return float(np.median(xs)), float(ys.max())


def place(a):
    cx, foot = body(a)
    img = Image.fromarray(a)
    img = img.resize((round(img.width * SC), round(img.height * SC)), Image.LANCZOS)
    x, y = F // 2 - round(cx * SC), FOOT - round(foot * SC)
    tmp = Image.new('RGBA', (B, B)); tmp.paste(img, (x, y), img)
    if F != B:
        tmp = tmp.convert('RGBa').resize((F, F), Image.LANCZOS).convert('RGBA')
    return tmp


strips = {}
# WALK_LOOPS="front=9:35,back=88:32" fixes a view's gait loop (absolute start frame : period) when the automatic pick is
# wrong; measure it from the feet (left-minus-right lowest foot pixel changes sign every step)
LOOPS = {k: tuple(map(int, v.split(':'))) for k, v in (e.split('=') for e in os.environ.get('WALK_LOOPS', '').split(',') if e)}
for view, (s0, s1) in VIEWS.items():
    a0, L = LOOPS[view] if view in LOOPS else pick_loop(s0, s1)
    idx = [a0 + round(k * L / 8) for k in range(8)]
    print(view, 'frames', idx)
    strips[view] = [place(matte(i)) for i in idx]

# the installed pack: keep what is not rebuilt, rebuild the others
src = Path(sorted(glob.glob(G + PID + '/*'))[-1])
pack = json.load(open(src / 'pack.json'))
actor = pack['actors'][0]
walk_clip, idle_clip = actor['clips']['walk'], actor['clips']['idle']


def load_cells(asset_id):
    js = json.load(open(src / f'{asset_id}.json'))['frames']
    img = Image.open(src / f'{asset_id}.webp').convert('RGBA')
    out = {}
    for name, fr in js.items():
        r, ss = fr['frame'], fr['spriteSourceSize']
        cell = Image.new('RGBA', (F, F)); cell.paste(img.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])), (ss['x'], ss['y']))
        out[name] = cell
    return out


walk_cells, idle_cells = load_cells(walk_clip['asset']), load_cells(idle_clip['asset'])


def width(f):
    a = np.array(f)[F * 3 // 4:, :, 3] > 40
    xs = np.where(a.any(0))[0]
    return int(xs.max() - xs.min()) if len(xs) else 9999


for d, (view, mir) in MAP.items():
    fr = [f.transpose(Image.FLIP_LEFT_RIGHT) if mir else f for f in strips[view]]
    for i, f in enumerate(fr): walk_cells[f'{ACTOR}/walk/{d}/{i:02d}'] = f
    base = min(fr, key=width); bb = base.getbbox(); foot = bb[3]
    for i in range(8):
        dh = [0, 1, 2, 3, 4, 3, 2, 1][i]; dw = [0, 0, 1, 1, 2, 1, 1, 0][i]
        b = base.crop(bb).resize((bb[2] - bb[0] + dw, bb[3] - bb[1] + dh), Image.LANCZOS)
        c = Image.new('RGBA', (F, F)); c.alpha_composite(b, (bb[0] - dw // 2, max(0, foot - b.height)))
        idle_cells[f'{ACTOR}/idle/{d}/{i:02d}'] = c


def pack_atlas(cells, atlas_id, dst):
    items = []
    for name, cell in cells.items():
        a = np.array(cell); ys, xs = np.where(a[:, :, 3] > 0)
        y0, y1, x0, x1 = (max(0, ys.min() - 1), min(F - 1, ys.max() + 1), max(0, xs.min() - 1), min(F - 1, xs.max() + 1)) if len(ys) else (0, 0, 0, 0)
        items.append((name, a[y0:y1 + 1, x0:x1 + 1].copy(), int(x0), int(y0)))
    items.sort(key=lambda t: -t[1].shape[0])
    pad = 2

    def shelf(width_):
        x = y = pad; sh = 0; pl = {}
        for name, crop, ox, oy in items:
            h, w = crop.shape[:2]
            if x + w + pad > width_: x = pad; y += sh + pad; sh = 0
            pl[name] = (x, y, w, h, ox, oy); x += w + pad; sh = max(sh, h)
        return pl, (y + sh + pad + 3) // 4 * 4
    widest = max(c.shape[1] for _, c, _, _ in items) + 2 * pad
    W, (place_, H) = min(((w, shelf(w)) for w in range(widest, 2049, 16)), key=lambda t: t[0] * t[1][1])
    atlas = np.zeros((H, W, 4), np.uint8); meta = {}
    for name, crop, ox, oy in items:
        px, py, w, h, _, _ = place_[name]; atlas[py:py + h, px:px + w] = crop
        meta[name] = {'frame': {'x': px, 'y': py, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                      'sourceSize': {'w': F, 'h': F}, 'spriteSourceSize': {'x': ox, 'y': oy, 'w': w, 'h': h}}
    Image.fromarray(atlas).save(f'{dst}/{atlas_id}.webp', lossless=True, quality=100, method=4)
    json.dump({'frames': meta, 'meta': {'image': atlas_id + '.webp', 'size': {'w': W, 'h': H}, 'scale': '1'}}, open(f'{dst}/{atlas_id}.json', 'w'))
    return W, H


dst = f'pkg/{R}'; shutil.rmtree(dst, ignore_errors=True); os.makedirs(dst)
VER = os.environ.get('WALK_VERSION', '2.5.0')
rebuilt = {walk_clip['asset']: walk_cells, idle_clip['asset']: idle_cells}
for a in pack['assets']:
    if a['id'] in rebuilt:
        a['width'], a['height'] = pack_atlas(rebuilt[a['id']], a['id'], dst)
        print(a['id'], a['width'], a['height'], 'MiB', round(a['width'] * a['height'] * 4 / 2**20, 2))
    else:
        for ext in ('webp', 'json'): shutil.copy(src / f"{a['id']}.{ext}", dst)
    a['version'] = VER; a['url'] = a['id'] + '.webp'
    if a.get('atlasUrl'): a['atlasUrl'] = a['id'] + '.json'
pack['version'] = VER
json.dump(pack, open(f'{dst}/pack.json', 'w'), indent=2)
print(R, 'pack ready', VER)
