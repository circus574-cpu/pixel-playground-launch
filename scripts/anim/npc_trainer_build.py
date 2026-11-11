#!/usr/bin/env python3
"""Build an import-ready NPC pack ("Trener", binding `<world>.npc.trainer`) from the owner's turnaround video.

    python3 scripts/anim/npc_trainer_build.py <verdant|aether|nexus|pyra> <video.mp4> <work-dir>
    npm run assets:import -- <work-dir>/pkg/<world>/pack.json --install

The video is a turnaround of a standing character on a plain background with a printed caption under the feet.
One frame is picked per facing (NPC_PICKS, "frame:mirror"); left-facing mirrors are generated, never hand drawn.
The figure is matted with rembg (isnet-anime), only its largest connected piece is kept (this drops the
caption), one camera transform (scale + feet baseline) is shared by every frame so the NPC never pops in size,
and an 8-frame breathing cycle is derived from each pose (a 0..1.5 % vertical stretch anchored at the feet).
The `walk` clip required by the NPC contract reuses the idle frame names, so it costs no texture memory.
Contract (scripts/lib/gpu-import.ts): profile npc, size 96, origin .5/.95, 128 px source cells, idle 8 @ 6 fps loop,
walk 8 @ 16 fps loop, 8 directions. Frames are trimmed and shelf-packed into the smallest atlas.
Other races reuse the same figure with a recoloured outfit: NPC_HUE=<degrees> shifts the saturated sash/trim and tints the
dark cloth (skin, hair, beard and boots keep their colours). Defaults per world: pyra keeps the original red, verdant 125,
aether 190, nexus 225.
Needs: ffmpeg, rembg (isnet-anime), opencv-python, numpy, pillow.
"""
import os, sys, json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORLD, VIDEO = sys.argv[1], str(Path(sys.argv[2]).resolve())
WORK = Path(sys.argv[3]).resolve()
os.makedirs(WORK, exist_ok=True)
os.chdir(WORK)
import numpy as np, cv2
from PIL import Image
from rembg import remove, new_session

assert WORLD in ('verdant', 'aether', 'nexus', 'pyra'), WORLD
DIRS = ['down', 'down-left', 'left', 'up-left', 'up', 'up-right', 'right', 'down-right']
# direction -> (video frame number, mirror). Frame numbers at 24 fps of the owner's Trener turnaround.
PICKS = {
    'down': (0, False), 'down-left': (24, False), 'down-right': (24, True),
    'left': (36, False), 'right': (60, False),
    'up-right': (84, False), 'up': (96, False), 'up-left': (132, False),
}
if os.environ.get('NPC_PICKS'):  # e.g. "down=0,left=36,down-right=24m"
    for part in os.environ['NPC_PICKS'].split(','):
        d, v = part.split('=')
        PICKS[d] = (int(v.rstrip('m')), v.endswith('m'))
CELL, FIG_H, FEET_Y = 128, 116, 121   # source cell, figure height in it, feet row (origin .95 * 128 = 121.6)
BREATH = [1.0, 1.004, 1.009, 1.013, 1.015, 1.013, 1.009, 1.004]   # 8 idle frames
ACTOR = f'npc-{WORLD}-trainer'
ASSET = f'{ACTOR}-page-0'

need = sorted({n for n, _ in PICKS.values()})
os.makedirs('full', exist_ok=True); os.makedirs('mat', exist_ok=True)
sel = '+'.join(f'eq(n\\,{n})' for n in need)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', VIDEO, '-vf', f'select={sel}', '-vsync', '0', 'full/f_%03d.png'], check=True)
sess = new_session('isnet-anime'); mats = {}
for k, n in enumerate(need):
    p = f'mat/{n:03d}.png'
    if not os.path.exists(p):
        remove(Image.open(f'full/f_{k + 1:03d}.png').convert('RGB'), session=sess).save(p)
    rgba = np.array(Image.open(p).convert('RGBA'))
    # keep the figure only: the largest connected piece of the (slightly closed) alpha mask; the printed caption is a separate piece
    a = (rgba[:, :, 3] > 20).astype(np.uint8)
    closed = cv2.dilate(a, np.ones((7, 7), np.uint8))
    cnt, lab, stats, _ = cv2.connectedComponentsWithStats(closed, connectivity=8)
    biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    rgba[:, :, 3] = np.where(lab == biggest, rgba[:, :, 3], 0)
    ys, xs = np.where(rgba[:, :, 3] > 20)
    mats[n] = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()   # crop to the figure

HUES = {'pyra': None, 'verdant': 125.0, 'aether': 190.0, 'nexus': 225.0}
HUE = float(os.environ['NPC_HUE']) if os.environ.get('NPC_HUE') else HUES[WORLD]

def recolor(rgba, hue):
    """Recolour outfit only: sash/trim (saturated warm) get the new hue, dark cloth is tinted; head and skin/boots stay."""
    out = rgba.copy()
    rgb = rgba[:, :, :3].astype(np.float32) / 255.0
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h, sat, val = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    rows = np.arange(rgba.shape[0])[:, None] / rgba.shape[0]
    body = (rgba[:, :, 3] > 0) & (rows > 0.16)                      # never touch the head (hair, beard, face)
    warm = (h < 45) | (h > 340)
    trim = body & warm & (sat > 0.52) & (val > 0.30) & (rows < 0.86)   # red-orange sash and embroidery
    cloth = body & ~trim & (val < 0.34) & (rows < 0.86)   # black vest and trousers (boots keep their leather)
    nh = hsv.copy()
    nh[:, :, 0] = np.where(trim, (hue + (np.where(h > 180, h - 360, h) - 15) * 0.35) % 360, h)
    nh[:, :, 0] = np.where(cloth, hue, nh[:, :, 0])
    nh[:, :, 1] = np.where(cloth, np.maximum(sat, 0.42), sat)
    nh[:, :, 2] = np.where(cloth, np.minimum(1.0, val * 1.35 + 0.02), val)
    res = cv2.cvtColor(nh, cv2.COLOR_HSV2RGB)
    out[:, :, :3] = np.clip(res * 255.0, 0, 255).astype(np.uint8)
    return out

if HUE is not None:
    for n in list(mats): mats[n] = recolor(mats[n], HUE)
    print('outfit recoloured to hue', HUE)

front = mats[PICKS['down'][0]]
scale = FIG_H / front.shape[0]
print('front figure', front.shape[:2], 'scale', round(scale, 4))

def render(crop, mirror, factor):
    a = crop.astype(np.float32); a[:, :, :3] *= a[:, :, 3:4] / 255.0
    h, w = a.shape[:2]
    nh, nw = max(1, round(h * scale * factor)), max(1, round(w * scale))
    r = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA)
    al = r[:, :, 3:4]; rgb = np.where(al > 0.5, r[:, :, :3] / np.maximum(al / 255.0, 1e-3), 0)
    r = np.clip(np.concatenate([rgb, al], 2), 0, 255).astype(np.uint8)
    if mirror: r = r[:, ::-1].copy()
    cell = np.zeros((CELL, CELL, 4), np.uint8)
    nh, nw = r.shape[:2]
    if nw > CELL - 4: raise SystemExit(f'figure too wide for the cell: {nw}')
    y0 = max(0, FEET_Y - nh + 1); x0 = (CELL - nw) // 2
    cell[y0:y0 + min(nh, FEET_Y + 1)] [:, x0:x0 + nw] = r[max(0, nh - (FEET_Y + 1)):]
    return cell

items = []   # (name, rgba, ox, oy)
names = {d: [] for d in DIRS}
for d in DIRS:
    n, mirror = PICKS[d]
    for i, f in enumerate(BREATH):
        cell = render(mats[n], mirror, f)
        name = f'{ACTOR}/idle/{d}/{i:02d}'
        names[d].append(name)
        ys, xs = np.where(cell[:, :, 3] > 0)
        y0, y1, x0, x1 = max(0, ys.min() - 1), min(CELL - 1, ys.max() + 1), max(0, xs.min() - 1), min(CELL - 1, xs.max() + 1)
        items.append((name, cell[y0:y1 + 1, x0:x1 + 1].copy(), int(x0), int(y0)))
clipped = sum(1 for _, c, _, _ in items if c[0, :, 3].max() > 10 or c[:, 0, 3].max() > 10 or c[:, -1, 3].max() > 10)
print('frames', len(items), 'touching the cell side', clipped)

items.sort(key=lambda t: -t[1].shape[0])
pad = 2
def shelf_pack(width):
    x = pad; y = pad; shelf = 0; pl = {}
    for name, crop, ox, oy in items:
        h, w = crop.shape[:2]
        if x + w + pad > width: x = pad; y += shelf + pad; shelf = 0
        pl[name] = (x, y, w, h, ox, oy); x += w + pad; shelf = max(shelf, h)
    return pl, (y + shelf + pad + 3) // 4 * 4
widest = max(c.shape[1] for _, c, _, _ in items) + 2 * pad
W, (place, H) = min(((w, shelf_pack(w)) for w in range(widest, 2049, 8)), key=lambda t: t[0] * t[1][1])
atlas = np.zeros((H, W, 4), np.uint8); meta = {}
for name, crop, ox, oy in items:
    px, py, w, h, _, _ = place[name]; atlas[py:py + h, px:px + w] = crop
    meta[name] = {'frame': {'x': px, 'y': py, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                  'sourceSize': {'w': CELL, 'h': CELL}, 'spriteSourceSize': {'x': ox, 'y': oy, 'w': w, 'h': h}}
print('atlas', W, H, 'decoded MiB', round(W * H * 4 / 2**20, 2))

dst = f'pkg/{WORLD}'
os.makedirs(dst, exist_ok=True)
Image.fromarray(atlas).save(f'{dst}/{ASSET}.webp', quality=92, method=6, alpha_quality=100)
Image.fromarray(atlas).save('preview-atlas.png')
json.dump({'frames': meta, 'meta': {'image': ASSET + '.webp', 'size': {'w': W, 'h': H}, 'scale': '1'}}, open(f'{dst}/{ASSET}.json', 'w'))
VER = os.environ.get('NPC_VERSION', '1.0.0')
pack = {
    'schemaVersion': 1, 'id': ACTOR, 'version': VER, 'technical': False, 'previewOnly': False,
    'assets': [{'id': ASSET, 'version': VER, 'kind': 'atlas', 'url': ASSET + '.webp', 'atlasUrl': ASSET + '.json', 'width': W, 'height': H}],
    'actors': [{
        'id': ACTOR, 'profile': 'npc', 'presentation': 'legacy', 'size': [96, 96], 'origin': [0.5, 0.95], 'tintable': False,
        'clips': {
            'idle': {'asset': ASSET, 'fps': 6, 'loop': True, 'directions': {d: names[d] for d in DIRS}},
            'walk': {'asset': ASSET, 'fps': 16, 'loop': True, 'directions': {d: names[d] for d in DIRS}},
        },
    }],
    'actorBindings': {f'{WORLD}.npc.trainer': ACTOR},
    'renderBindings': {}, 'effects': {},
}
json.dump(pack, open(f'{dst}/pack.json', 'w'), indent=2)
print('pack ready', ACTOR, f'{WORLD}.npc.trainer')
