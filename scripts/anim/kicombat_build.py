#!/usr/bin/env python3
"""Cut the Tryb KI combat and reaction clips of one race from the owner's videos and build an import-ready package.

    python3 scripts/anim/kicombat_build.py <android|legend|sage|planetary> <work-dir>
    npm run assets:import -- <work-dir>/pkg/<race>/pack.json --install --replace      (KICOMBAT_VERSION bumps the pack)
    then scripts/anim/dedupe_mirror.py drops the mirrored copies (the game flips them)

Sources (art-wip/gemini-anim-stages/):
 - <race>-etap4-walka-po-transformacji.mp4: the strikes already used for `kiattack` are the strongest one; the others become
   kiattack2 (6 frames, 12 fps) and kifinisher (8, 12; Planetary has none: its third strike is a flash over the whole frame),
   kiskillb (8, 12: jump and ground slam; Planetary: the landing only), kidodge (6, 14), kiguard (6, 10);
 - <race>-etap5a-reakcje-ki.mp4 (Android, Legend, Planetary, Sage): kihit (6, 14), kihitheavy (8, 12),
   kideath (8, 10: flight, fall, lying), kirespawn (8, 12: sits up, rises), kivictory (8, 10).
 - planetary-etap5c-cios-skok-ki.mp4 (Planetary only): kifinisher (8, 12: heavy palm strike) and kiskillb (8, 12: the
   full jump and ground slam), replacing the stage 4 landing; asset `<pack>-kifight-3`.
KICOMBAT_ONLY=s4,s5c rebuilds only those videos' atlases (the others and their clips stay as installed);
KICOMBAT_RIGHT=1 stores the right-facing frames only (the left directions are listed in the clip's `mirrored` field).
Each video has its own transform (scale from its neutral frame, feet on the walk baseline); a figure wider than the cell
(a lying body) is scaled down to fit and rests on the same baseline. Same matting and trimmed lossless atlas as
scripts/anim/moveform_build.py; new asset `<pack>-kifight-1`.
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
DIRS = ['down', 'down-left', 'left', 'up-left', 'up', 'up-right', 'right', 'down-right']
FLIPPED = {'left', 'up-left', 'down-left'}
FPS_VIDEO = 24
S4 = str(ROOT / ('art-wip/gemini-anim-stages/' + R + '-etap4-walka-po-transformacji.mp4'))
R5 = str(ROOT / ('art-wip/gemini-anim-stages/' + R + '-etap5a-reakcje-ki.mp4'))
# per race: video key -> (file, neutral second); clip -> (video key, window in seconds, frames, fps, loop)
NEUTRAL4 = {'legend': 0.0, 'android': 0.0, 'sage': 0.0, 'planetary': 0.17}[R]
VIDEOS = {'s4': (S4, NEUTRAL4)}
CLIPS_CFG = {
    'legend': {'kiattack2': ('s4', (0.6, 1.2), 6, 12), 'kifinisher': ('s4', (1.6, 2.4), 8, 12), 'kiskillb': ('s4', (6.0, 7.2), 8, 12), 'kidodge': ('s4', (7.8, 8.4), 6, 14), 'kiguard': ('s4', (8.6, 9.6), 6, 10),
               'kihit': ('r5', (0.6, 1.1), 6, 14), 'kihitheavy': ('r5', (2.0, 3.0), 8, 12), 'kideath': ('r5', (3.8, 4.8), 8, 10), 'kirespawn': ('r5', (6.0, 7.0), 8, 12), 'kivictory': ('r5', (8.1, 9.1), 8, 10)},
    'android': {'kiattack2': ('s4', (0.6, 1.2), 6, 12), 'kifinisher': ('s4', (1.5, 2.2), 8, 12), 'kiskillb': ('s4', (6.0, 7.2), 8, 12), 'kidodge': ('s4', (8.0, 8.6), 6, 14), 'kiguard': ('s4', (8.6, 9.6), 6, 10),
                'kihit': ('r5', (0.5, 1.2), 6, 14), 'kihitheavy': ('r5', (1.8, 3.0), 8, 12), 'kideath': ('r5', (3.9, 4.8), 8, 10), 'kirespawn': ('r5', (6.0, 6.9), 8, 12), 'kivictory': ('r5', (8.2, 9.2), 8, 10)},
    'sage': {'kiattack2': ('s4', (0.4, 1.2), 6, 12), 'kifinisher': ('s4', (1.6, 2.2), 8, 12), 'kiskillb': ('s4', (6.0, 7.2), 8, 12), 'kidodge': ('s4', (7.8, 8.6), 6, 14), 'kiguard': ('s4', (8.6, 9.4), 6, 10),
             'kihit': ('r5', (0.55, 1.3), 6, 14), 'kihitheavy': ('r5', (1.85, 2.9), 8, 12), 'kideath': ('r5', (3.8, 4.7), 8, 10), 'kirespawn': ('r5', (5.4, 6.6), 8, 12), 'kivictory': ('r5', (7.9, 9.0), 8, 10)},
    'planetary': {'kiattack2': ('s4', (2.0, 2.9), 6, 12), 'kifinisher': ('s5c', (0.6, 1.8), 8, 12), 'kiskillb': ('s5c', (2.5, 3.7), 8, 12), 'kidodge': ('s4', (8.0, 8.6), 6, 14), 'kiguard': ('s4', (8.8, 9.6), 6, 10),
                  'kihit': ('r5', (0.6, 1.1), 6, 14), 'kihitheavy': ('r5', (2.0, 3.0), 8, 12), 'kideath': ('r5', (3.8, 4.8), 8, 10), 'kirespawn': ('r5', (5.8, 7.2), 8, 12), 'kivictory': ('r5', (8.1, 9.1), 8, 10)},
}[R]
ONLY = set(filter(None, os.environ.get('KICOMBAT_ONLY', '').split(',')))
if ONLY: CLIPS_CFG = {c: v for c, v in CLIPS_CFG.items() if v[0] in ONLY}
RIGHT = os.environ.get('KICOMBAT_RIGHT') == '1'
if any(v[0] == 's5c' for v in CLIPS_CFG.values()):
    VIDEOS['s5c'] = (str(ROOT / 'art-wip/gemini-anim-stages/planetary-etap5c-cios-skok-ki.mp4'), 0.2)
if not any(v[0] == 's4' for v in CLIPS_CFG.values()): VIDEOS.pop('s4')
if any(v[0] == 'r5' for v in CLIPS_CFG.values()): VIDEOS['r5'] = (R5, {'android': 0.2, 'legend': 1.2, 'sage': 0.25, 'planetary': 1.4}[R])
LOOP = set()
def window(w, n): return [int(round((w[0] + (w[1] - w[0]) * j / (n - 1)) * FPS_VIDEO)) for j in range(n)]
SEQ = {c: (v[0], window(v[1], v[2])) for c, v in CLIPS_CFG.items()}
print(R, {c: s for c, s in SEQ.items()})

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

def bbox(a, th=128):
    ys, xs = np.where(a > th)
    return (ys.min(), ys.max(), xs.min(), xs.max()) if len(ys) else (0, 0, 0, 0)

sess_a = new_session('isnet-anime'); sess_g = new_session('isnet-general-use')
FEATHER = 44  # wide fade: the video effects (dust, flashes) can fill the frame
ramp = np.minimum(np.minimum(np.arange(256), np.arange(256)[::-1]) / FEATHER, 1.0).astype(np.float32)
edge = np.minimum(ramp[:, None], ramp[None, :])

V = {}  # video key -> dict(mats, anime, scale, dx, dy)
for key, (vid, neutral_t) in VIDEOS.items():
    idx_neutral = int(round(neutral_t * FPS_VIDEO))
    need = sorted({idx_neutral, *[i for c, (k, seq) in SEQ.items() if k == key for i in seq]})
    os.makedirs(f'full-{key}', exist_ok=True); os.makedirs(f'mat-{key}', exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', vid, '-vf', 'select=' + '+'.join(f'eq(n\\,{i})' for i in need),
                    '-vsync', '0', f'full-{key}/f_%03d.png'], check=True)
    mats, anime = {}, {}
    for k, i in enumerate(need):
        p = f'mat-{key}/{i:03d}.png'
        if not os.path.exists(p):
            im = Image.open(f'full-{key}/f_{k + 1:03d}.png').convert('RGB'); rgb = np.array(im)
            body = np.array(remove(im, session=sess_a)); gen = np.array(remove(im, session=sess_g))[..., 3]
            # the anime matting can lose a lying body (a wide, horizontal figure): trust the general mask there
            gy, gx = np.where(gen > 128)
            # (the reaction films have no big effects, so a body mask far smaller than the general one is a matting failure too)
            lost = key == 'r5' and len(gy) and (body[..., 3] > 128).sum() < 0.6 * len(gy)
            if len(gy) and (lost or ((gx.max() - gx.min() + 1) > 1.6 * (gy.max() - gy.min() + 1) and (body[..., 3] > 128).sum() < 0.8 * len(gy))):
                body[..., 3] = np.maximum(body[..., 3], gen)
                print('lying frame', i, 'body mask taken from the general matting')
            Image.fromarray(kimatte.composite(rgb, body, gen)).save(p)
            Image.fromarray(body[..., 3]).save(f'mat-{key}/{i:03d}-body.png')
        mats[i] = np.array(Image.open(p).convert('RGBA')); anime[i] = np.array(Image.open(f'mat-{key}/{i:03d}-body.png'))
    shutil.rmtree(f'full-{key}')
    nb = bbox(anime[idx_neutral])
    scale = baseH / float(nb[1] - nb[0] + 1)
    V[key] = dict(mats=mats, anime=anime, scale=scale, neutral=idx_neutral)
    print(key, 'neutral height', nb[1] - nb[0] + 1, 'scale', round(scale, 3))

def render(rgba, scale):
    a = rgba.astype(np.float32); a[:, :, :3] *= a[:, :, 3:4] / 255.0
    h, w = a.shape[:2]; nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    r = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC)
    al = r[:, :, 3:4]; rgb = np.where(al > 0.5, r[:, :, :3] / np.maximum(al / 255.0, 1e-3), 0)
    return np.clip(np.concatenate([rgb, al], 2), 0, 255).astype(np.uint8)

for key, v in V.items():
    a = v['anime'][v['neutral']]
    rn = render(np.concatenate([np.zeros_like(a)[..., None].repeat(3, 2), a[..., None]], 2), v['scale']); rb = bbox(rn[..., 3])
    v['dy'] = int(round(baseBottom - rb[1])); v['dx'] = int(round(128 - (rb[2] + rb[3]) / 2))

def localized(v, i, scale):
    """Effects fade out with the distance from the figure, so a flash that fills the whole video frame stays a halo around it."""
    m = v['mats'][i].copy()
    # near-white pixels get no body protection (a white flash or dust cloud can pass the anime matting as body)
    lo = m[:, :, :3].min(2)
    white = lo > 215
    body = ((v['anime'][i] > 80) & ~white).astype(np.uint8)
    dist = cv2.distanceTransform(1 - body, cv2.DIST_L2, 5) * scale
    # a white motion streak glued to the figure is opaque in the matte: away from the coloured figure white turns transparent
    far = white & (dist > 4)
    m[:, :, 3] = np.where(far, m[:, :, 3] * np.clip((255.0 - lo) / 40.0, 0, 1), m[:, :, 3]).astype(np.uint8)
    w = np.exp(-(dist / 110.0) ** 2)
    keep = np.maximum(w, body)
    # the side borders of a narrow video frame fall inside the 256 px cell: fade everything towards them
    wd = body.shape[1]; side = np.minimum(np.arange(wd), np.arange(wd)[::-1]).astype(np.float32)
    keep = keep * np.minimum(side / (24.0 / scale), 1.0)[None, :]
    m[:, :, 3] = (m[:, :, 3].astype(np.float32) * keep).astype(np.uint8)
    return m

def cell(key, i, mirror):
    v = V[key]; scale = v['scale']; ddx, ddy = v['dx'], v['dy']
    r = render(localized(v, i, scale), scale)
    bb = bbox(render(np.concatenate([np.zeros_like(v['anime'][i])[..., None].repeat(3, 2), v['anime'][i][..., None]], 2), scale)[..., 3])
    if bb[3] - bb[2] + 1 > 236:  # a lying body wider than the cell: scale it down to fit, resting on the same baseline
        scale = scale * 236.0 / (bb[3] - bb[2] + 1)
        r = render(localized(v, i, v['scale']), scale)
        bb = bbox(render(np.concatenate([np.zeros_like(v['anime'][i])[..., None].repeat(3, 2), v['anime'][i][..., None]], 2), scale)[..., 3])
        ddx = int(round(128 - (bb[2] + bb[3]) / 2)); ddy = int(round(baseBottom - bb[1]))
    top = bb[0] + ddy
    if top < 4:  # airborne frame taller than the cell (the head would be cut): shrink about the ground point so it fits
        k = (baseBottom - 4.0) / (baseBottom - top)
        scale = scale * k
        r = render(localized(v, i, v['scale']), scale)
        bb = bbox(render(np.concatenate([np.zeros_like(v['anime'][i])[..., None].repeat(3, 2), v['anime'][i][..., None]], 2), scale)[..., 3])
        ddy = int(round(baseBottom * (1 - k) + ddy * k)); ddx = int(round(128 * (1 - k) + ddx * k))
    c = np.zeros((256, 256, 4), np.uint8); h, w = r.shape[:2]
    sy0, sx0 = max(0, -ddy), max(0, -ddx); dy0, dx0 = max(0, ddy), max(0, ddx)
    hh = min(h - sy0, 256 - dy0); ww = min(w - sx0, 256 - dx0)
    if hh > 0 and ww > 0: c[dy0:dy0 + hh, dx0:dx0 + ww] = r[sy0:sy0 + hh, sx0:sx0 + ww]
    # the fade towards the cell border is for effects only: the figure itself (a lying body fills the cell) stays opaque
    bodym = np.zeros((256, 256), np.float32)
    bm = render(np.concatenate([np.zeros_like(v['anime'][i])[..., None].repeat(3, 2), v['anime'][i][..., None]], 2), scale)[..., 3]
    bh, bw = bm.shape
    if hh > 0 and ww > 0: bodym[dy0:dy0 + hh, dx0:dx0 + ww] = (bm[sy0:sy0 + hh, sx0:sx0 + ww] > 128).astype(np.float32)
    c[:, :, 3] = (c[:, :, 3] * np.maximum(edge, bodym)).astype(np.uint8)
    return c[:, ::-1].copy() if mirror else c

CLIPS = SEQ
unique = []  # (name, rgba256)
names = {c: {} for c in CLIPS}
for mirror in ((False,) if RIGHT else (False, True)):
    tag = 'left' if mirror else 'right'
    per = {}
    for clip, (key, seq) in CLIPS.items():
        per[clip] = []
        for j, i in enumerate(seq):
            nm = f'{ACTOR}/{clip}/{tag}/{j:02d}'; per[clip].append(nm); unique.append((nm, cell(key, i, mirror)))
    for d in DIRS:
        if (d in FLIPPED) == mirror or RIGHT:
            for clip in CLIPS: names[clip][d] = per[clip]

clip_n = 0
for _, fr in unique:
    a = fr[:, :, 3]
    if a[0].max() > 10 or a[-1].max() > 10 or a[:, 0].max() > 10 or a[:, -1].max() > 10: clip_n += 1
print('frames touching the cell border', clip_n, 'of', len(unique))

pad = 2
def pack_atlas(sub, aid):
    items = []
    for name, fr in sub:
        ys, xs = np.where(fr[:, :, 3] > 0)
        y0, y1, x0, x1 = int(max(0, ys.min() - 1)), int(min(255, ys.max() + 1)), int(max(0, xs.min() - 1)), int(min(255, xs.max() + 1))
        items.append((name, fr[y0:y1 + 1, x0:x1 + 1].copy(), x0, y0))
    items.sort(key=lambda t: -t[1].shape[0])

    def shelf_pack(width):
        x = pad; y = pad; shelf = 0; pl = {}
        for name, crop, ox, oy in items:
            h, w = crop.shape[:2]
            if x + w + pad > width: x = pad; y += shelf + pad; shelf = 0
            pl[name] = (x, y, w, h, ox, oy); x += w + pad; shelf = max(shelf, h)
        return pl, (y + shelf + pad + 3) // 4 * 4
    # the narrowest-area shelf layout (decoded size is what the texture budget counts); the importer allows 2048 px per side
    widest = max(c.shape[1] for _, c, _, _ in items) + 2 * pad
    W, (place, H) = min(((w, shelf_pack(w)) for w in range(widest, 2049, 16) if shelf_pack(w)[1] <= 2048), key=lambda t: (t[0] * t[1][1], max(t[0], t[1][1])))
    atlas = np.zeros((H, W, 4), np.uint8); meta = {}
    for name, crop, ox, oy in items:
        px, py, w, h, _, _ = place[name]; atlas[py:py + h, px:px + w] = crop
        meta[name] = {'frame': {'x': px, 'y': py, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                      'sourceSize': {'w': 256, 'h': 256}, 'spriteSourceSize': {'x': ox, 'y': oy, 'w': w, 'h': h}}
    os.makedirs('out', exist_ok=True)
    Image.fromarray(atlas).save(f'out/{aid}.png')
    Image.fromarray(atlas).save(f'out/{aid}.webp', lossless=True, quality=100, method=4)
    print(aid, W, H, 'decoded MiB', round(W * H * 4 / 2**20, 2), 'webp bytes', os.path.getsize(f'out/{aid}.webp'), 'frames', len(sub))
    return W, H, meta

# package: the installed walk pack plus the Tryb KI atlases (strikes and skills; reactions) and their clips
dst = f'pkg/{R}'; shutil.rmtree(dst, ignore_errors=True); os.makedirs(dst)
AIDS = {'s4': f'{PID}-kifight-1', 'r5': f'{PID}-kifight-2', 's5c': f'{PID}-kifight-3'}
if ONLY: AIDS = {k: a for k, a in AIDS.items() if k in ONLY}  # re-running on an installed pack replaces these atlases and clips
for f in os.listdir(walk_pack):
    if f != 'pack.json' and not any(f.startswith(a + '.') for a in AIDS.values()): shutil.copy(os.path.join(walk_pack, f), dst)
pack = json.load(open(walk_pack + '/pack.json'))
pack['assets'] = [a for a in pack['assets'] if a['id'] not in AIDS.values()]
for c in CLIPS: pack['actors'][0]['clips'].pop(c, None)
VER = os.environ.get('KICOMBAT_VERSION', '3.0.0'); pack['version'] = VER
for a in pack['assets']:
    a['version'] = VER; a['url'] = os.path.basename(a['url'])
    if a.get('atlasUrl'): a['atlasUrl'] = os.path.basename(a['atlasUrl'])
atlas_of = {c: AIDS[key] for c, (key, _) in CLIPS.items()}
for key, aid in AIDS.items():
    used = {c for c, (k, _) in CLIPS.items() if k == key}
    if not used: continue
    wanted = {n for c in used for d in DIRS for n in names[c][d]}
    W, H, meta = pack_atlas([(n, f) for n, f in unique if n in wanted], aid)
    shutil.copy(f'out/{aid}.webp', f'{dst}/{aid}.webp')
    json.dump({'frames': meta, 'meta': {'image': aid + '.webp', 'size': {'w': W, 'h': H}, 'scale': '1'}}, open(f'{dst}/{aid}.json', 'w'))
    pack['assets'].append({'id': aid, 'version': VER, 'kind': 'atlas', 'url': aid + '.webp', 'atlasUrl': aid + '.json', 'width': W, 'height': H})
actor = pack['actors'][0]
SPEC = {c: (v[3], False) for c, v in CLIPS_CFG.items()}
for c, (fps, loop) in SPEC.items():
    actor['clips'][c] = {'asset': atlas_of[c], 'fps': fps, 'loop': loop, 'directions': {d: names[c][d] for d in DIRS}}
    if RIGHT: actor['clips'][c]['mirrored'] = sorted(FLIPPED)
json.dump(pack, open(f'{dst}/pack.json', 'w'), indent=2)
print(R, 'pack ready', actor['id'], sorted(actor['clips']))
