#!/usr/bin/env python3
"""Cut the base-form movement clips (run, channel, skillc, interact) of one race from the owner's stage-3 video
(art-wip/gemini-anim-stages/<race>-etap3-ruch.mp4; Android: -v2) and build an import-ready package.

    python3 scripts/anim/moveform_build.py <android|legend|sage|planetary> <work-dir>
    npm run assets:import -- <work-dir>/pkg/<race>/pack.json --install --replace      (MOVE_VERSION bumps the pack)
    then scripts/anim/dedupe_mirror.py drops the mirrored copies (the game flips them)

 - run      8 frames, 16 fps (the walk cadence), loop: one stride period of the
            side-view run (found from the lower-body difference of the raw video frames, like walk_rebuild.py);
            each frame is centred on the torso,
 - channel  8 frames, 10 fps, loop: gathering KI, ping-pong over the window (held while the hero channels),
 - skillc   8 frames, 12 fps: the tree-C technique (dash strike or blast),
 - interact 6 frames, 10 fps: reaching out to pick something up.
Same camera, matting and trimmed lossless atlas as scripts/anim/reactform_build.py; new asset `<pack>-fight-4`.

MOVE_KI=1 cuts the same four clips in the Tryb KI form from <race>-etap5b-ruch-ki.mp4 (same timeline in all four
videos) as kirun, kichannel, kiskillc and kiinteract into the asset `<pack>-kimove-1`, right-facing frames only (the
left directions are listed in the clip's `mirrored` field and drawn flipped, as after scripts/anim/dedupe_mirror.py).
Hero packs are stored at a 200 px cell (scripts/assets/downscale_hero_pack.py): this builder measures the installed
walk in 256 px units and writes 256 px cells, so run downscale_hero_pack.py on its pkg/<race> before importing it.
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
if R == 'android': os.environ.setdefault('KIMATTE_MIN_A', '0.22')  # its small grey video has blocky colour noise
ACTOR = {'android': 'hero-android', 'legend': 'hero-legend', 'sage': 'hero-sage-painted', 'planetary': 'hero-planetary-painted'}[R]
PID = {'android': 'hero-android-walk-v3', 'legend': 'hero-legend-walk-v3', 'sage': 'hero-sage-painted-walk-v3', 'planetary': 'hero-planetary-painted-walk-v3'}[R]
G = str(ROOT / 'public/game/assets/gpu') + '/'
KI = os.environ.get('MOVE_KI') == '1'
VID = str(ROOT / ('art-wip/gemini-anim-stages/' + R + ('-etap5b-ruch-ki' if KI else '-etap3-ruch' + ('-v2' if R == 'android' else '')) + '.mp4'))
DIRS = ['down', 'down-left', 'left', 'up-left', 'up', 'up-right', 'right', 'down-right']
FLIPPED = {'left', 'up-left', 'down-left'}
FPS_VIDEO = 24
# seconds in the stage-3 video (Planetary's file repeats stages 1 and 2 in its first 20 s); run is the search window
CFG = {
    'legend': {'neutral': 0.2, 'run': (0.6, 3.0), 'channel': (4.0, 5.0), 'skillc': (7.0, 7.6), 'interact': (8.4, 9.4)},
    'android': {'neutral': 0.2, 'run': (0.6, 3.4), 'channel': (4.4, 5.7), 'skillc': (7.0, 8.0), 'interact': (9.0, 9.8)},
    'sage': {'neutral': 0.2, 'run': (0.8, 3.2), 'channel': (4.4, 5.6), 'skillc': (7.2, 8.0), 'interact': (9.0, 9.8)},
    'planetary': {'neutral': 20.2, 'run': (20.6, 22.2), 'channel': (24.4, 25.8), 'skillc': (27.0, 27.8), 'interact': (28.8, 29.8)},
}[R]
if KI: CFG = {'neutral': 0.2, 'run': (0.6, 3.2), 'channel': (4.4, 5.8), 'skillc': (6.9, 8.1), 'interact': (8.8, 9.8)}
if os.environ.get('MOVE_RUN_WINDOW'): CFG['run'] = tuple(map(float, os.environ['MOVE_RUN_WINDOW'].split('-')))  # steady run only
COUNTS = {'run': 8, 'channel': 8, 'skillc': 8, 'interact': 6}
def window(w, n): return [int(round((w[0] + (w[1] - w[0]) * j / (n - 1)) * FPS_VIDEO)) for j in range(n)]

def run_cycle(w, n):
    """n frames evenly over one stride period inside the run window (raw frames, white background)."""
    s0, s1 = int(round(w[0] * FPS_VIDEO)), int(round(w[1] * FPS_VIDEO))
    os.makedirs('runraw', exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', VID, '-vf', f'select=between(n\\,{s0}\\,{s1}),scale=320:-2,format=gray',
                    '-vsync', '0', 'runraw/r_%03d.png'], check=True)
    ims = [np.asarray(Image.open(p)).astype(np.float32) for p in sorted(glob.glob('runraw/r_*.png'))]
    shutil.rmtree('runraw')
    def low(im):
        ys, xs = np.where(im < 200)
        if not len(ys): return np.zeros((40, 60), np.float32)
        y0, y1 = ys.min() + int((ys.max() - ys.min()) * 0.55), ys.max() + 1
        cx = int(np.median(xs)); x0 = max(0, cx - 60)
        return cv2.resize(im[y0:y1, x0:cx + 60], (60, 40))
    lo = [low(im) for im in ims]; m = len(lo)
    lags = list(range(8, m - 4))
    # MOVE_RUN_LAGS="18-26" limits the search to a full stride (two steps) when the automatic pick lands on a half
    # stride (the legs would swap at the loop seam) or on several strides (too few samples per step)
    if os.environ.get('MOVE_RUN_LAGS'):
        lo_l, hi_l = map(int, os.environ['MOVE_RUN_LAGS'].split('-')); lags = [L for L in lags if lo_l <= L <= hi_l]
    D = {L: float(np.mean([np.abs(lo[i] - lo[i + L]).mean() for i in range(m - L)])) for L in lags}
    med = float(np.median(list(D.values())))
    cand = [L for L in lags if D[L] < 0.6 * med and D[L] <= D.get(L - 1, 1e9) and D[L] <= D.get(L + 1, 1e9)]
    L = cand[0] if cand and not os.environ.get('MOVE_RUN_LAGS') else min(lags, key=lambda k: D[k])
    a0 = min(range(0, m - L), key=lambda i: float(np.abs(lo[i] - lo[i + L]).mean()))
    print('run period', L, 'frames from', s0 + a0, 'D', round(D[L], 1), 'median', round(med, 1))
    return [s0 + a0 + int(round(k * L / n)) for k in range(n)]

SEQ = {c: (run_cycle(CFG[c], n) if c == 'run' else window(CFG[c], n)) for c, n in COUNTS.items()}
# the channel is held in a loop: five samples there and back (0 1 2 3 4 3 2 1), so the glow swells and ebbs without a jump
_ch = window(CFG['channel'], 5); SEQ['channel'] = _ch + _ch[3:0:-1]
idx_neutral = int(round(CFG['neutral'] * FPS_VIDEO))
need = sorted({idx_neutral, *[i for v in SEQ.values() for i in v]})
print(R, SEQ)

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
    k = 256.0 / fr.get('sourceSize', {'w': 256})['w']  # the installed pack may be stored at a 200 px cell
    if len(ys): hs.append((ys.max() - ys.min() + 1) * k); bs.append((ys.max() + oy + 1) * k - 1)
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
nb = bbox(anime[idx_neutral])
scale = baseH / float(nb[1] - nb[0] + 1)
print('neutral height', nb[1] - nb[0] + 1, 'scale', round(scale, 3))

def render(rgba):
    a = rgba.astype(np.float32); a[:, :, :3] *= a[:, :, 3:4] / 255.0
    h, w = a.shape[:2]; nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    r = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC)
    al = r[:, :, 3:4]; rgb = np.where(al > 0.5, r[:, :, :3] / np.maximum(al / 255.0, 1e-3), 0)
    return np.clip(np.concatenate([rgb, al], 2), 0, 255).astype(np.uint8)

rn = render(np.concatenate([np.zeros_like(anime[idx_neutral])[..., None].repeat(3, 2), anime[idx_neutral][..., None]], 2)); rb = bbox(rn[..., 3])
dy = int(round(baseBottom - rb[1])); dx = int(round(128 - (rb[2] + rb[3]) / 2))
FEATHER = 44  # wide fade: the video effects (dust, flashes) can fill the frame
ramp = np.minimum(np.minimum(np.arange(256), np.arange(256)[::-1]) / FEATHER, 1.0).astype(np.float32)
edge = np.minimum(ramp[:, None], ramp[None, :])

def localized(i):
    """Effects fade out with the distance from the figure, so a flash that fills the whole video frame stays a halo around it."""
    m = mats[i].copy()
    # a white flash or dust cloud on the white video background can pass the anime matting as body: such near-white
    # pixels get no body protection and fade with the distance like any other effect
    lo = m[:, :, :3].min(2)
    white = lo > 215
    body = ((anime[i] > 80) & ~white).astype(np.uint8)
    dist = cv2.distanceTransform(1 - body, cv2.DIST_L2, 5) * scale
    # a white motion streak glued to the figure is opaque in the matte: away from the coloured figure (highlights of
    # hair and armour stay), white turns transparent as it would against the white video background
    far = white & (dist > 4)
    m[:, :, 3] = np.where(far, m[:, :, 3] * np.clip((255.0 - lo) / 40.0, 0, 1), m[:, :, 3]).astype(np.uint8)
    w = np.exp(-(dist / 110.0) ** 2)
    keep = np.maximum(w, body)
    # the side borders of the video frame fall inside the 256 px cell for Android's portrait video, and the matting
    # counts a flash or dust cloud cut by them as body: fade everything towards them (the figure never reaches them)
    wd = body.shape[1]; side = np.minimum(np.arange(wd), np.arange(wd)[::-1]).astype(np.float32)
    keep = keep * np.minimum(side / (24.0 / scale), 1.0)[None, :]
    m[:, :, 3] = (m[:, :, 3].astype(np.float32) * keep).astype(np.uint8)
    return m

RUN = set(SEQ['run'])

def cell(i, mirror):
    r = render(localized(i)); c = np.zeros((256, 256, 4), np.uint8); h, w = r.shape[:2]
    ddx = dx
    if i in RUN:  # the camera follows the runner loosely: centre each stride frame on its torso
        ys, xs = np.where(anime[i] > 128)
        top = ys < ys.min() + 0.45 * (ys.max() - ys.min())
        ddx = int(round(128 - float(np.median(xs[top])) * scale))
    sy0, sx0 = max(0, -dy), max(0, -ddx); dy0, dx0 = max(0, dy), max(0, ddx)
    hh = min(h - sy0, 256 - dy0); ww = min(w - sx0, 256 - dx0)
    if hh > 0 and ww > 0: c[dy0:dy0 + hh, dx0:dx0 + ww] = r[sy0:sy0 + hh, sx0:sx0 + ww]
    c[:, :, 3] = (c[:, :, 3] * edge).astype(np.uint8)
    return c[:, ::-1].copy() if mirror else c

CLIPS = SEQ
PRE = 'ki' if KI else ''
unique = []  # (name, rgba256)
names = {c: {} for c in CLIPS}
for mirror in ((False,) if KI else (False, True)):  # Tryb KI: the game flips the right strip (clip `mirrored`)
    tag = 'left' if mirror else 'right'
    per = {}
    for clip, seq in CLIPS.items():
        per[clip] = []
        for j, i in enumerate(seq):
            nm = f'{ACTOR}/{PRE}{clip}/{tag}/{j:02d}'; per[clip].append(nm); unique.append((nm, cell(i, mirror)))
    for d in DIRS:
        if (d in FLIPPED) == mirror or KI:
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

# package: the installed walk pack plus the movement atlas and its clips
dst = f'pkg/{R}'; shutil.rmtree(dst, ignore_errors=True); os.makedirs(dst)
aid = f'{PID}-kimove-1' if KI else f'{PID}-fight-4'  # re-running on an installed pack replaces this atlas and its clips
for f in os.listdir(walk_pack):
    if f != 'pack.json' and not f.startswith(aid + '.'): shutil.copy(os.path.join(walk_pack, f), dst)
pack = json.load(open(walk_pack + '/pack.json'))
pack['assets'] = [a for a in pack['assets'] if a['id'] != aid]
for c in CLIPS: pack['actors'][0]['clips'].pop(PRE + c, None)
VER = os.environ.get('MOVE_VERSION', '2.9.0'); pack['version'] = VER
for a in pack['assets']:
    a['version'] = VER; a['url'] = os.path.basename(a['url'])
    if a.get('atlasUrl'): a['atlasUrl'] = os.path.basename(a['atlasUrl'])
shutil.copy('out/atlas.webp', f'{dst}/{aid}.webp')
json.dump({'frames': meta, 'meta': {'image': aid + '.webp', 'size': {'w': W, 'h': H}, 'scale': '1'}}, open(f'{dst}/{aid}.json', 'w'))
pack['assets'].append({'id': aid, 'version': VER, 'kind': 'atlas', 'url': aid + '.webp', 'atlasUrl': aid + '.json', 'width': W, 'height': H})
actor = pack['actors'][0]
SPEC = {'run': (16, True), 'channel': (10, True), 'skillc': (12, False), 'interact': (10, False)}
for c, (fps, loop) in SPEC.items():
    actor['clips'][PRE + c] = {'asset': aid, 'fps': fps, 'loop': loop, 'directions': {d: names[c][d] for d in DIRS}}
    if KI: actor['clips'][PRE + c]['mirrored'] = sorted(FLIPPED)
json.dump(pack, open(f'{dst}/pack.json', 'w'), indent=2)
print(R, 'pack ready', actor['id'], sorted(actor['clips']))
