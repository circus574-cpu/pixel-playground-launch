#!/usr/bin/env python3
"""Cut the Tryb KI stance, basic attack and skill clips (kiidle, kiattack, kiskill) of one race from the owner's Gemini
stage-4 video (art-wip/gemini-anim-stages/<race>-etap4-walka-po-transformacji.mp4) and build an import-ready package.

    python3 scripts/anim/kiform_build.py <android|legend|sage|planetary> <work-dir>
    npm run assets:import -- <work-dir>/pkg/<race>/pack.json --install --replace      (KIFORM_VERSION bumps the pack)

The stage-4 videos are side views facing right on a plain (white or grey) background. Windows of the video give
 - kiidle   6 frames, 6 fps, loop: the powered-up stance (4 video frames played forward and back),
 - kiattack 6 frames, 12 fps: one strike with the video's own impact effect,
 - kiskill  8 frames, 12 fps: charge and energy blast.
The same camera transform is used for every frame of a race so the hero does not pop in size: it is scaled to the height of
the race's existing walk, feet on the same baseline. Right-facing directions (right, up-right, down-right, down, up) use
the profile; left ones use its mirror. Matting keeps the video's effects (glow, flames, beams, dust): the figure comes from
rembg (isnet-anime, completed with isnet-general-use behind bright effects) and the effects from a colour-to-alpha pass
against the video background (scripts/anim/kimatte.py). The 256 px cell fades out at its border. Frames are trimmed and
shelf-packed into the smallest lossless atlas. Needs: ffmpeg, rembg (isnet-anime and isnet-general-use models),
opencv-python, numpy, pillow.
"""
import os, sys, json, glob, shutil, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
WORK = Path(sys.argv[2]).resolve()
os.makedirs(WORK, exist_ok=True)
os.chdir(WORK)
import numpy as np, cv2
from PIL import Image
from rembg import remove, new_session
import kimatte

R = sys.argv[1]
ACTOR = {'android': 'hero-android', 'legend': 'hero-legend', 'sage': 'hero-sage-painted', 'planetary': 'hero-planetary-painted'}[R]
PID = {'android': 'hero-android-walk-v3', 'legend': 'hero-legend-walk-v3', 'sage': 'hero-sage-painted-walk-v3', 'planetary': 'hero-planetary-painted-walk-v3'}[R]
G = str(ROOT / 'public/game/assets/gpu') + '/'
VID = str(ROOT / f'art-wip/gemini-anim-stages/{R}-etap4-walka-po-transformacji.mp4')
DIRS = ['down', 'down-left', 'left', 'up-left', 'up', 'up-right', 'right', 'down-right']
FLIPPED = {'left', 'up-left', 'down-left'}
FPS_VIDEO = 24
# seconds in the video: four still-stance frames (played forward and back), six strike frames, eight charge-and-blast frames
CFG = {
    'legend': {'idle': [0.0, 0.17, 0.33, 0.5], 'attack': (3.0, 3.67), 'skill': (4.33, 5.5)},
    'android': {'idle': [0.0, 0.17, 0.33, 0.5], 'attack': (3.0, 3.67), 'skill': (4.5, 5.67)},
    'sage': {'idle': [0.0, 0.1, 0.2, 0.33], 'attack': (3.0, 3.67), 'skill': (4.5, 5.67)},
    'planetary': {'idle': [0.17, 0.33, 0.5, 0.67], 'attack': (1.0, 1.83), 'skill': (4.33, 5.5)},
}[R]
N_ATTACK, N_SKILL = 6, 8
def window(w, n): return [int(round((w[0] + (w[1] - w[0]) * j / (n - 1)) * FPS_VIDEO)) for j in range(n)]
idx_idle = [int(round(t * FPS_VIDEO)) for t in CFG['idle']]
idx_atk = window(CFG['attack'], N_ATTACK)
idx_skl = window(CFG['skill'], N_SKILL)
need = sorted({*idx_idle, *idx_atk, *idx_skl})
print(R, 'idle', idx_idle, 'attack', idx_atk, 'skill', idx_skl)

# metrics of the race's existing walk (height and feet baseline of the 256 px cell); frames are trimmed, so add their offsets
walk_pack = sorted(glob.glob(G + PID + '/*'))[-1]
base = os.path.relpath(walk_pack + '/' + PID + '-page-0', G)
atl = json.load(open(G + base + '.json')); img = np.array(Image.open(G + base + '.webp').convert('RGBA'))
hs, bs = [], []
for name, fr in atl['frames'].items():
    if name.split('/')[1] != 'walk': continue
    f = fr['frame']; oy = fr.get('spriteSourceSize', {'y': 0})['y']
    a = img[f['y']:f['y'] + f['h'], f['x']:f['x'] + f['w'], 3] > 128
    ys, xs = np.where(a)
    if len(ys): hs.append(ys.max() - ys.min() + 1); bs.append(ys.max() + oy)
baseH = float(np.median(hs)); baseBottom = float(np.median(bs))
print('base height', baseH, 'bottom', baseBottom)

os.makedirs('full', exist_ok=True); os.makedirs('mat', exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', VID, '-vf', 'select=' + '+'.join(f'eq(n\\,{i})' for i in need),
                '-vsync', '0', 'full/f_%03d.png'], check=True)
sess_a = new_session('isnet-anime'); sess_g = new_session('isnet-general-use'); mats = {}; anime = {}
for k, i in enumerate(need):
    p = f'mat/{i:03d}.png'
    if not os.path.exists(p):
        im = Image.open(f'full/f_{k + 1:03d}.png').convert('RGB'); rgb = np.array(im)
        body = np.array(remove(im, session=sess_a)); gen = np.array(remove(im, session=sess_g))[..., 3]
        Image.fromarray(kimatte.composite(rgb, body, gen)).save(p)
        Image.fromarray(body[..., 3]).save(f'mat/{i:03d}-body.png')
    mats[i] = np.array(Image.open(p).convert('RGBA')); anime[i] = np.array(Image.open(f'mat/{i:03d}-body.png'))

def bbox(a, th=128):
    ys, xs = np.where(a > th)
    return (ys.min(), ys.max(), xs.min(), xs.max()) if len(ys) else (0, 0, 0, 0)

# one transform for the whole race, measured on the neutral frame (the figure only, without effects)
nb = bbox(anime[idx_idle[0]])
scale = baseH / float(nb[1] - nb[0] + 1)
print('neutral height', nb[1] - nb[0] + 1, 'scale', round(scale, 3))

def render(rgba):
    a = rgba.astype(np.float32); a[:, :, :3] *= a[:, :, 3:4] / 255.0
    h, w = a.shape[:2]; nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    r = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC)
    al = r[:, :, 3:4]; rgb = np.where(al > 0.5, r[:, :, :3] / np.maximum(al / 255.0, 1e-3), 0)
    return np.clip(np.concatenate([rgb, al], 2), 0, 255).astype(np.uint8)

rn = render(np.concatenate([np.zeros_like(anime[idx_idle[0]])[..., None].repeat(3, 2), anime[idx_idle[0]][..., None]], 2)); rb = bbox(rn[..., 3])
dy = int(round(baseBottom - rb[1])); dx = int(round(128 - (rb[2] + rb[3]) / 2))
FEATHER = 18
ramp = np.minimum(np.minimum(np.arange(256), np.arange(256)[::-1]) / FEATHER, 1.0).astype(np.float32)
edge = np.minimum(ramp[:, None], ramp[None, :])

def cell(i, mirror):
    r = render(mats[i]); c = np.zeros((256, 256, 4), np.uint8); h, w = r.shape[:2]
    sy0, sx0 = max(0, -dy), max(0, -dx); dy0, dx0 = max(0, dy), max(0, dx)
    hh = min(h - sy0, 256 - dy0); ww = min(w - sx0, 256 - dx0)
    if hh > 0 and ww > 0: c[dy0:dy0 + hh, dx0:dx0 + ww] = r[sy0:sy0 + hh, sx0:sx0 + ww]
    c[:, :, 3] = (c[:, :, 3] * edge).astype(np.uint8)
    return c[:, ::-1].copy() if mirror else c

CLIPS = {'kiidle': [idx_idle[0], idx_idle[1], idx_idle[2], idx_idle[3], idx_idle[2], idx_idle[1]],
         'kiattack': idx_atk, 'kiskill': idx_skl}
unique = []  # (name, rgba256)
names = {c: {} for c in CLIPS}
for mirror in (False, True):
    tag = 'left' if mirror else 'right'
    per = {}
    for clip, seq in CLIPS.items():
        per[clip] = []
        for j, i in enumerate(seq):
            nm = f'{ACTOR}/{clip}/{tag}/{j:02d}'; per[clip].append(nm); unique.append((nm, cell(i, mirror)))
    for d in DIRS:
        if (d in FLIPPED) == mirror:
            for clip in CLIPS: names[clip][d] = per[clip]

clip_n = 0
for _, fr in unique:
    a = fr[:, :, 3]
    if a[0].max() > 10 or a[-1].max() > 10 or a[:, 0].max() > 10 or a[:, -1].max() > 10: clip_n += 1
print('frames touching the cell border', clip_n, 'of', len(unique))

items = []
for name, fr in unique:
    ys, xs = np.where(fr[:, :, 3] > 0)
    y0, y1, x0, x1 = int(max(0, ys.min() - 1)), int(min(255, ys.max() + 1)), int(max(0, xs.min() - 1)), int(min(255, xs.max() + 1))
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
W, (place, H) = min(((w, shelf_pack(w)) for w in range(widest, 2049, 16) if shelf_pack(w)[1] <= 2048), key=lambda t: (t[0] * t[1][1], max(t[0], t[1][1])))  # the importer allows at most 2048 px per side
atlas = np.zeros((H, W, 4), np.uint8); meta = {}
for name, crop, ox, oy in items:
    px, py, w, h, _, _ = place[name]; atlas[py:py + h, px:px + w] = crop
    meta[name] = {'frame': {'x': px, 'y': py, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                  'sourceSize': {'w': 256, 'h': 256}, 'spriteSourceSize': {'x': ox, 'y': oy, 'w': w, 'h': h}}
os.makedirs('out', exist_ok=True)
Image.fromarray(atlas).save('out/atlas.png')
Image.fromarray(atlas).save('out/atlas.webp', lossless=True, quality=100, method=4)
print('atlas', W, H, 'decoded MiB', round(W * H * 4 / 2**20, 2), 'webp bytes', os.path.getsize('out/atlas.webp'), 'frames', len(unique))

# package: the installed walk pack plus the kifight atlas and its clips
dst = f'pkg/{R}'; shutil.rmtree(dst, ignore_errors=True); os.makedirs(dst)
aid = f'{PID}-kifight-0'  # re-running on an installed pack replaces its kifight atlas and clips
for f in os.listdir(walk_pack):
    if f != 'pack.json' and not f.startswith(aid + '.'): shutil.copy(os.path.join(walk_pack, f), dst)
pack = json.load(open(walk_pack + '/pack.json'))
pack['assets'] = [a for a in pack['assets'] if a['id'] != aid]
for c in CLIPS: pack['actors'][0]['clips'].pop(c, None)
VER = os.environ.get('KIFORM_VERSION', '2.4.0'); pack['version'] = VER
for a in pack['assets']:
    a['version'] = VER; a['url'] = os.path.basename(a['url'])
    if a.get('atlasUrl'): a['atlasUrl'] = os.path.basename(a['atlasUrl'])
shutil.copy('out/atlas.webp', f'{dst}/{aid}.webp')
json.dump({'frames': meta, 'meta': {'image': aid + '.webp', 'size': {'w': W, 'h': H}, 'scale': '1'}}, open(f'{dst}/{aid}.json', 'w'))
pack['assets'].append({'id': aid, 'version': VER, 'kind': 'atlas', 'url': aid + '.webp', 'atlasUrl': aid + '.json', 'width': W, 'height': H})
actor = pack['actors'][0]
SPEC = {'kiidle': (6, True), 'kiattack': (12, False), 'kiskill': (12, False)}
for c, (fps, loop) in SPEC.items():
    actor['clips'][c] = {'asset': aid, 'fps': fps, 'loop': loop, 'directions': {d: names[c][d] for d in DIRS}}
json.dump(pack, open(f'{dst}/pack.json', 'w'), indent=2)
print(R, 'pack ready', actor['id'], sorted(actor['clips']))
