#!/usr/bin/env python3
"""Build an import-ready NPC pack for one role (binding `<world>.npc.<role>`) from the owner's turnaround video.

    python3 scripts/anim/npc_role_build.py <trainer|keeper> <verdant|aether|nexus|pyra> <video.mp4> <work-dir>
    npm run assets:import -- <work-dir>/pkg/<world>/pack.json --install

The video is a turnaround of a standing character on a plain background with a printed caption under the feet.
One frame is picked per facing (NPC_PICKS, "frame:mirror"); left-facing mirrors are generated, never hand drawn.
The figure is matted with rembg (isnet-anime), only its largest connected piece is kept (this drops the
caption), one camera transform (scale + feet baseline) is shared by every frame so the NPC never pops in size,
and a breathing cycle is derived from each pose (rest and a 1.2 % vertical stretch anchored at the feet, 8 idle frames reusing the 2 poses).
The `walk` clip required by the NPC contract reuses the idle frame names, so it costs no texture memory.
Contract (scripts/lib/gpu-import.ts, contract.npcLarge): profile npc, size 192 (2x), origin .5/.95, 256 px source cells, idle 8 @ 6 fps loop,
walk 8 @ 16 fps loop, 8 directions. Frames are trimmed and shelf-packed into the smallest atlas.
Other races reuse the same figure with a recoloured outfit: NPC_HUE=<degrees> shifts the saturated sash/trim and tints the
dark cloth (skin, hair, beard and boots keep their colours). Defaults per world: pyra keeps the original red, verdant 125,
aether 190, nexus 225.
Needs: ffmpeg, rembg (isnet-anime), opencv-python, numpy, pillow.
"""
import os, sys, json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROLE, WORLD, VIDEO = sys.argv[1], sys.argv[2], str(Path(sys.argv[3]).resolve())
WORK = Path(sys.argv[4]).resolve()
os.makedirs(WORK, exist_ok=True)
os.chdir(WORK)
import numpy as np, cv2
from PIL import Image
from rembg import remove, new_session

assert WORLD in ('verdant', 'aether', 'nexus', 'pyra'), WORLD
assert ROLE in ('trainer', 'keeper', 'innkeeper', 'guide', 'smith', 'warden', 'steward', 'merchant', 'hunter', 'alchemist'), ROLE
DIRS = ['down', 'down-left', 'left', 'up-left', 'up', 'up-right', 'right', 'down-right']
# direction -> (video frame number, mirror). Frame numbers at 24 fps of the owner's Trener turnaround.
PICKS = {
    # Trener turnaround (Trener video, 24 fps)
    'trainer': {
        'down': (0, False), 'down-left': (24, False), 'down-right': (24, True),
        'left': (36, False), 'right': (60, False),
        'up-right': (84, False), 'up': (96, False), 'up-left': (132, False),
    },
    # Depozytariuszka turnaround: the video really turns both ways, so left poses are real frames, not mirrors
    'keeper': {
        'down': (184, False), 'down-right': (56, False), 'right': (80, False), 'up-right': (88, False),
        'up': (112, False), 'up-left': (136, False), 'left': (152, False), 'down-left': (160, False),
    },
    # Karczmarka turnaround (145 frames, caption only on the first ones): real left and right poses as well
    'innkeeper': {
        'down': (136, False), 'down-right': (16, False), 'right': (32, False), 'up-right': (88, False),
        'up': (104, False), 'up-left': (80, False), 'left': (72, False), 'down-left': (64, False),
    },
    # Przewodniczka turnaround (145 frames, the caption is printed under the feet in every frame; the largest-piece rule drops it)
    'guide': {
        'down': (136, False), 'down-right': (16, False), 'right': (40, False), 'up-right': (64, False),
        'up': (80, False), 'up-left': (96, False), 'left': (104, False), 'down-left': (112, False),
    },
    # Kowal turnaround (193 frames, caption under the feet in every frame); he really turns both ways
    'smith': {
        'down': (184, False), 'down-right': (16, False), 'right': (40, False), 'up-right': (96, False),
        'up': (104, False), 'up-left': (152, False), 'left': (160, False), 'down-left': (168, False),
    },
    # Straznik turnaround (193 frames, caption under the feet in every frame)
    'warden': {
        'down': (180, False), 'down-right': (60, False), 'right': (84, False), 'up-right': (96, False),
        'up': (108, False), 'up-left': (120, False), 'left': (132, False), 'down-left': (156, False),
    },
    # Zarzadca turnaround (145 frames, caption under the feet in every frame)
    'steward': {
        'down': (132, False), 'down-right': (24, False), 'right': (48, False), 'up-right': (60, False),
        'up': (84, False), 'up-left': (96, False), 'left': (108, False), 'down-left': (120, False),
    },
    # Handlarka turnaround (193 frames, caption under the feet in every frame)
    'merchant': {
        'down': (180, False), 'down-right': (20, False), 'right': (60, False), 'up-right': (90, False),
        'up': (100, False), 'up-left': (120, False), 'left': (140, False), 'down-left': (160, False),
    },
    # Mysliwy turnaround (193 frames, caption under the feet in every frame): he turns to the right first
    'hunter': {
        'down': (0, False), 'down-right': (24, False), 'right': (56, False), 'up-right': (88, False),
        'up': (104, False), 'up-left': (120, False), 'left': (144, False), 'down-left': (168, False),
    },
    # Alchemik turnaround (193 frames, caption under the feet): long front hold, then a quick turn through the sides
    'alchemist': {
        'down': (0, False), 'down-right': (72, False), 'right': (81, False), 'up-right': (87, False),
        'up': (104, False), 'up-left': (141, False), 'left': (156, False), 'down-left': (162, False),
    },
}[ROLE]
if os.environ.get('NPC_PICKS'):  # e.g. "down=0,left=36,down-right=24m"
    for part in os.environ['NPC_PICKS'].split(','):
        d, v = part.split('=')
        PICKS[d] = (int(v.rstrip('m')), v.endswith('m'))
# Every NPC is cut at 256 px so it stays sharp when drawn big. The trainer is a landmark NPC drawn twice the size (contract.npcLarge,
# 192); the other roles keep the standard contract size 96 in the pack and are drawn 150 by catalog.ts (`enlargedNpcs`), taller than the
# hero (133) but shorter than the trainer, like the heroes are enlarged from their 96 contract size.
CELL = 256
FIG_H = 232                          # figure height in the cell
FEET_Y = 243                         # feet row (origin .95 * cell)
SIZE = [192, 192] if ROLE == 'trainer' else [96, 96]
# two poses per facing (rest, inhale); the 8 idle frame names reuse the same atlas rectangles, which keeps the texture small
POSES = [1.0, 1.012]
BREATH = [0, 0, 1, 1, 1, 1, 0, 0]   # pose index of each of the 8 idle frames
if ROLE != 'trainer':   # 256 px cells cost memory (Verdantia is at the texture budget): the residents stand on one pose, no breathing
    POSES = [1.0]
    BREATH = [0] * 8
ACTOR = f'npc-{WORLD}-{ROLE}'
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
HEAD_ROWS = {'keeper': 0.16, 'innkeeper': 0.2, 'guide': 0.16, 'smith': 0.2, 'merchant': 0.2}.get(ROLE, 0.16)
DARK_ONLY = ROLE in ('guide', 'warden', 'steward')   # long auburn hair and orange trim look like the cloak's warm colours: only the dark cloth is recoloured   # the top of the figure (face, hair) is never recoloured

def recolor(rgba, hue):
    """Trainer: sash/trim (saturated warm) get the new hue, dark cloth is tinted; head and skin/boots stay."""
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

def recolor_warm(rgba, hue):
    """Brown/red cloth and trim (every warm pixel that is dark or saturated) turn to the new hue; skin, cream sleeves, apron, hair
    (light or at the top of the figure) and boots keep their colours."""
    out = rgba.copy()
    rgb = rgba[:, :, :3].astype(np.float32) / 255.0
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    h, sat, val = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    rows = np.arange(rgba.shape[0])[:, None] / rgba.shape[0]
    warm = (h < 50) | (h > 340)
    cloth = (rgba[:, :, 3] > 0) & (rows > HEAD_ROWS) & (rows < 0.86) & warm & ((val < 0.58) | (sat > 0.5)) & (sat > 0.18)
    if ROLE == 'smith': cloth = (rgba[:, :, 3] > 0) & (rows > HEAD_ROWS) & (rows < 0.86) & warm & (((val < 0.42) & (sat > 0.15)) | (sat > 0.6))   # leather, apron and trousers; skin (less saturated) stays
    if DARK_ONLY: cloth = (rgba[:, :, 3] > 0) & (rows > HEAD_ROWS) & (rows < 0.86) & warm & (val < 0.42) & (sat > 0.15)
    nh = hsv.copy()
    nh[:, :, 0] = np.where(cloth, (hue + (np.where(h > 180, h - 360, h) - 20) * 0.35) % 360, h)
    nh[:, :, 1] = np.where(cloth, np.maximum(sat, 0.42), sat)
    res = cv2.cvtColor(nh, cv2.COLOR_HSV2RGB)
    out[:, :, :3] = np.clip(res * 255.0, 0, 255).astype(np.uint8)
    return out

if HUE is not None:
    for n in list(mats): mats[n] = (recolor if ROLE == 'trainer' else recolor_warm)(mats[n], HUE)
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

items = []   # unique frames: (name, rgba, ox, oy)
names = {d: [] for d in DIRS}
alias = {}   # frame name -> unique frame it shares pixels with
for d in DIRS:
    n, mirror = PICKS[d]
    uniq = []
    for k, f in enumerate(POSES):
        cell = render(mats[n], mirror, f)
        name = f'{ACTOR}/idle/{d}/{k:02d}'
        uniq.append(name)
        ys, xs = np.where(cell[:, :, 3] > 0)
        y0, y1, x0, x1 = max(0, ys.min() - 1), min(CELL - 1, ys.max() + 1), max(0, xs.min() - 1), min(CELL - 1, xs.max() + 1)
        items.append((name, cell[y0:y1 + 1, x0:x1 + 1].copy(), int(x0), int(y0)))
    for i, pose in enumerate(BREATH):
        name = f'{ACTOR}/idle/{d}/{i:02d}'
        names[d].append(name)
        alias[name] = uniq[pose]
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
def entry(px, py, w, h, ox, oy):
    return {'frame': {'x': px, 'y': py, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
            'sourceSize': {'w': CELL, 'h': CELL}, 'spriteSourceSize': {'x': ox, 'y': oy, 'w': w, 'h': h}}
info = {}
for name, crop, ox, oy in items:
    px, py, w, h, _, _ = place[name]; atlas[py:py + h, px:px + w] = crop
    info[name] = (px, py, w, h, ox, oy)
for name in [n for d in DIRS for n in names[d]]:
    meta[name] = entry(*info[alias[name]])
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
        'id': ACTOR, 'profile': 'npc', 'presentation': 'legacy', 'size': SIZE, 'origin': [0.5, 0.95], 'tintable': False,
        'clips': {
            'idle': {'asset': ASSET, 'fps': 6, 'loop': True, 'directions': {d: names[d] for d in DIRS}},
            'walk': {'asset': ASSET, 'fps': 16, 'loop': True, 'directions': {d: names[d] for d in DIRS}},
        },
    }],
    'actorBindings': {f'{WORLD}.npc.{ROLE}': ACTOR},
    'renderBindings': {}, 'effects': {},
}
json.dump(pack, open(f'{dst}/pack.json', 'w'), indent=2)
print('pack ready', ACTOR, f'{WORLD}.npc.{ROLE}')
