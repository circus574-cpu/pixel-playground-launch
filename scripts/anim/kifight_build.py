#!/usr/bin/env python3
"""Cut the "Tryb KI idle and basic attack" frames (clips kiidle and kiattack) of one race from the owner's Gemini
stage-4 video (art-wip/gemini-anim-stages/<race>-etap4-walka-po-transformacji.mp4) and build an import-ready package.

    python3 scripts/anim/kifight_build.py <android|legend|sage|planetary> <work-dir>
    npm run assets:import -- <work-dir>/pkg/<race>/pack.json --install --replace      (KIFIGHT_VERSION bumps the pack)

The stage-4 videos are side views facing right on a plain background. One strike is cut (6 frames at 12 fps, as long as the 8-frame 16 fps base attack) plus one neutral frame for kiidle. The same camera transform is used for every frame of the race so the
hero does not pop in size: it is scaled to the height of the race's existing walk, feet on the same baseline.
Right-facing directions (right, up-right, down-right, down, up) use the profile; left ones use its mirror. Frames are
matted with rembg (isnet-anime), trimmed to the figure and shelf-packed into the smallest atlas found (trimmed Phaser frames keep the
Verdantia texture budget safe). Needs: ffmpeg, rembg (isnet-anime model), opencv-python, numpy, pillow.
"""
import os, sys, json, glob, shutil, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(sys.argv[2]).resolve()
os.makedirs(WORK, exist_ok=True)
os.chdir(WORK)
import numpy as np, cv2
from PIL import Image
from rembg import remove, new_session

R = sys.argv[1]
ACTOR = {'android': 'hero-android', 'legend': 'hero-legend', 'sage': 'hero-sage-painted', 'planetary': 'hero-planetary-painted'}[R]
PID = {'android': 'hero-android-walk-v3', 'legend': 'hero-legend-walk-v3', 'sage': 'hero-sage-painted-walk-v3', 'planetary': 'hero-planetary-painted-walk-v3'}[R]
G = str(ROOT / 'public/game/assets/gpu') + '/'
VID = str(ROOT / f'art-wip/gemini-anim-stages/{R}-etap4-walka-po-transformacji.mp4')
DIRS = ['down', 'down-left', 'left', 'up-left', 'up', 'up-right', 'right', 'down-right']
FLIPPED = {'left', 'up-left', 'down-left'}
FPS_VIDEO = 24
N_ATTACK = 6  # strike frames; 6 frames at 12 fps last as long as the base attack (8 at 16 fps)
REFS = list(range(N_ATTACK))
# seconds in the video: neutral frame for kiidle, and the strike window (wind-up .. end of impact)
CFG = {
    'legend': {'idle': 0.33, 'strike': (0.45, 1.05)},
    'sage': {'idle': 0.33, 'strike': (0.40, 1.00)},
    'planetary': {'idle': 0.20, 'strike': (0.90, 1.50)},
    'android': {'idle': 0.33, 'strike': (0.45, 1.05)},
}[R]
if os.environ.get('KIFIGHT_IDLE'): CFG['idle'] = float(os.environ['KIFIGHT_IDLE'])
if os.environ.get('KIFIGHT_STRIKE'):
    a, b = os.environ['KIFIGHT_STRIKE'].split(','); CFG['strike'] = (float(a), float(b))

idx_idle = int(round(CFG['idle'] * FPS_VIDEO))
t0, t1 = CFG['strike']
idx_atk = [int(round((t0 + (t1 - t0) * j / (N_ATTACK - 1)) * FPS_VIDEO)) for j in range(N_ATTACK)]
need = sorted({idx_idle, *idx_atk})
print(R, 'idle frame', idx_idle, 'attack frames', idx_atk)

# metrics of the race's existing walk (height and feet baseline of the 256 px cell)
walk_pack = sorted(glob.glob(G + PID + '/*'))[-1]
base = os.path.relpath(walk_pack + '/' + PID + '-page-0', G)
atl = json.load(open(G + base + '.json')); img = np.array(Image.open(G + base + '.webp').convert('RGBA'))
hs, bs = [], []
for name, fr in atl['frames'].items():
    if name.split('/')[1] != 'walk': continue
    f = fr['frame']; a = img[f['y']:f['y'] + f['h'], f['x']:f['x'] + f['w'], 3] > 128
    ys, xs = np.where(a)
    if len(ys): hs.append(ys.max() - ys.min() + 1); bs.append(ys.max())
baseH = float(np.median(hs)); baseBottom = float(np.median(bs))
print('base height', baseH, 'bottom', baseBottom)

os.makedirs('full', exist_ok=True); os.makedirs('mat', exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', VID, '-vf', 'select=' + '+'.join(f'eq(n\\,{i})' for i in need),
                '-vsync', '0', 'full/f_%03d.png'], check=True)
sess = new_session('isnet-anime'); mats = {}
for k, i in enumerate(need):
    p = f'mat/{i:03d}.png'
    if not os.path.exists(p):
        remove(Image.open(f'full/f_{k + 1:03d}.png').convert('RGB'), session=sess).save(p)
    mats[i] = np.array(Image.open(p).convert('RGBA'))

def bbox(a, th=128):
    ys, xs = np.where(a[:, :, 3] > th)
    return (ys.min(), ys.max(), xs.min(), xs.max()) if len(ys) else (0, 0, 0, 0)

# one transform for the whole race, measured on the neutral frame
nb = bbox(mats[idx_idle])
scale = baseH / float(nb[1] - nb[0] + 1)
print('neutral height', nb[1] - nb[0] + 1, 'scale', round(scale, 3))

def render(rgba):
    a = rgba.astype(np.float32); a[:, :, :3] *= a[:, :, 3:4] / 255.0
    h, w = a.shape[:2]; nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    r = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC)
    al = r[:, :, 3:4]; rgb = np.where(al > 0.5, r[:, :, :3] / np.maximum(al / 255.0, 1e-3), 0)
    return np.clip(np.concatenate([rgb, al], 2), 0, 255).astype(np.uint8)

rn = render(mats[idx_idle]); rb = bbox(rn)
dy = int(round(baseBottom - rb[1])); dx = int(round(128 - (rb[2] + rb[3]) / 2))

def cell(i, mirror):
    r = render(mats[i]); c = np.zeros((256, 256, 4), np.uint8); h, w = r.shape[:2]
    sy0, sx0 = max(0, -dy), max(0, -dx); dy0, dx0 = max(0, dy), max(0, dx)
    hh = min(h - sy0, 256 - dy0); ww = min(w - sx0, 256 - dx0)
    if hh > 0 and ww > 0: c[dy0:dy0 + hh, dx0:dx0 + ww] = r[sy0:sy0 + hh, sx0:sx0 + ww]
    return c[:, ::-1].copy() if mirror else c

unique = []  # (name, rgba256)
names = {'kiidle': {}, 'kiattack': {}}
for mirror in (False, True):
    tag = 'left' if mirror else 'right'
    idle_name = [f'{ACTOR}/kiidle/{tag}/00']
    uniq_names = [f'{ACTOR}/kiattack/{tag}/{j:02d}' for j in range(N_ATTACK)]
    atk_names = [uniq_names[k] for k in REFS]
    unique.append((idle_name[0], cell(idx_idle, mirror)))
    for j, i in enumerate(idx_atk): unique.append((uniq_names[j], cell(i, mirror)))
    for d in DIRS:
        if (d in FLIPPED) == mirror:
            names['kiidle'][d] = idle_name; names['kiattack'][d] = atk_names

clip = 0
for _, fr in unique:
    a = fr[:, :, 3]
    if a[0].max() > 10 or a[-1].max() > 10 or a[:, 0].max() > 10 or a[:, -1].max() > 10: clip += 1
print('clipped frames', clip, 'of', len(unique))

items = []
for name, fr in unique:
    ys, xs = np.where(fr[:, :, 3] > 0)
    y0, y1, x0, x1 = int(max(0, ys.min() - 2)), int(min(255, ys.max() + 2)), int(max(0, xs.min() - 2)), int(min(255, xs.max() + 2))
    items.append((name, fr[y0:y1 + 1, x0:x1 + 1].copy(), x0, y0))
items.sort(key=lambda t: -t[1].shape[0])
pad = 2

def shelf_pack(width):
    x = pad; y = pad; shelf = 0; pl = {}
    for name, crop, ox, oy in items:
        h, w = crop.shape[:2]
        if x + w + pad > width: x = pad; y += shelf + pad; shelf = 0
        pl[name] = (x, y, w, h, ox, oy); x += w + pad; shelf = max(shelf, h)
    return pl, (y + shelf + pad + 3) // 4 * 4

# the narrowest-area shelf layout (decoded size is what the texture budget counts)
widest = max(c.shape[1] for _, c, _, _ in items) + 2 * pad
W, (place, H) = min(((w, shelf_pack(w)) for w in range(widest, 2049, 16)), key=lambda t: t[0] * t[1][1])
atlas = np.zeros((H, W, 4), np.uint8); meta = {}
for name, crop, ox, oy in items:
    px, py, w, h, _, _ = place[name]; atlas[py:py + h, px:px + w] = crop
    meta[name] = {'frame': {'x': px, 'y': py, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                  'sourceSize': {'w': 256, 'h': 256}, 'spriteSourceSize': {'x': ox, 'y': oy, 'w': w, 'h': h}}
os.makedirs('out', exist_ok=True)
Image.fromarray(atlas).save('out/atlas.png')
Image.fromarray(atlas).save('out/atlas.webp', quality=90, method=6, alpha_quality=100)
json.dump({'frames': meta, 'meta': {'image': 'atlas.webp', 'size': {'w': W, 'h': H}, 'scale': '1'}}, open('out/atlas.json', 'w'))
print('atlas', W, H, 'decoded bytes', W * H * 4, 'webp bytes', os.path.getsize('out/atlas.webp'), 'frames', len(unique))

# package: the installed walk pack plus the kifight atlas and the two clips
dst = f'pkg/{R}'; shutil.rmtree(dst, ignore_errors=True); os.makedirs(dst)
aid = f'{PID}-kifight-0'  # re-running on an installed pack replaces its kifight atlas and clips
for f in os.listdir(walk_pack):
    if f != 'pack.json' and not f.startswith(aid + '.'): shutil.copy(os.path.join(walk_pack, f), dst)
pack = json.load(open(walk_pack + '/pack.json'))
pack['assets'] = [a for a in pack['assets'] if a['id'] != aid]
for c in ('kiidle', 'kiattack'): pack['actors'][0]['clips'].pop(c, None)
VER = os.environ.get('KIFIGHT_VERSION', '2.2.0'); pack['version'] = VER
for a in pack['assets']:
    a['version'] = VER; a['url'] = os.path.basename(a['url'])
    if a.get('atlasUrl'): a['atlasUrl'] = os.path.basename(a['atlasUrl'])
shutil.copy('out/atlas.webp', f'{dst}/{aid}.webp')
json.dump({'frames': meta, 'meta': {'image': aid + '.webp', 'size': {'w': W, 'h': H}, 'scale': '1'}}, open(f'{dst}/{aid}.json', 'w'))
pack['assets'].append({'id': aid, 'version': VER, 'kind': 'atlas', 'url': aid + '.webp', 'atlasUrl': aid + '.json', 'width': W, 'height': H})
actor = pack['actors'][0]
actor['clips']['kiidle'] = {'asset': aid, 'fps': 6, 'loop': True, 'directions': {d: names['kiidle'][d] for d in DIRS}}
actor['clips']['kiattack'] = {'asset': aid, 'fps': 12, 'loop': False, 'directions': {d: names['kiattack'][d] for d in DIRS}}
json.dump(pack, open(f'{dst}/pack.json', 'w'), indent=2)
print(R, 'pack ready', actor['id'], sorted(actor['clips']))
