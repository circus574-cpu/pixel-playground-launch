#!/usr/bin/env python3
"""Paint the 2D map of every world-v2 continent from its runtime terrain (same data as the game).

  python3 scripts/worldgen/v2/render_v2_maps.py
Reads public/game/worlds/superior-v2/<land>/chunks (flags + biome per 32-unit cell) and the ki-v2
ground textures; writes public/game/worlds/superior-v2/<land>/map.webp (max 2048 px wide) and
map.json (pixel scale). Markers (towns, famous places) are drawn by the page, not baked in.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
WORLD = ROOT / 'public/game/worlds/superior-v2'
TEX = ROOT / 'deliveries/ki-v2-terrain-1.0.0'
import os
MAXW = int(os.environ.get('MAP_WIDTH', 2048))
SUFFIX = os.environ.get('MAP_SUFFIX', '')
# MAP_UPSAMPLE=2 draws every 32-unit cell as 2x2 px with smoothed coasts and biome borders instead of
# one hard square per cell (sharper when the 2D atlas is zoomed in). MAP_LANDS=nexus,pyra limits the run.
UP = float(os.environ.get('MAP_UPSAMPLE', 1))
ONLY = {x for x in os.environ.get('MAP_LANDS', '').split(',') if x}
# The map is decoded into memory while playing, so the upsampled image stays under this many megapixels.
MAX_MP = float(os.environ.get('MAP_MAX_MEGAPIXELS', 12))


def unrle(runs, w, h):
    return np.concatenate([np.full(n, v, np.uint8) for v, n in runs]).reshape(h, w)


def tex(name, size):
    im = Image.open(TEX / f'ki-v2-terrain-{name}.webp').convert('RGB').resize((size, size), Image.LANCZOS)
    return np.asarray(im, np.float32)


def tile(t, h, w):
    reps = (h // t.shape[0] + 1, w // t.shape[1] + 1, 1)
    return np.tile(t, reps)[:h, :w]


index = json.loads((WORLD / 'index.json').read_text())
def chaikin(points, rounds=3):
    """Cut the corners of a grid-routed polyline (display only); the ends stay where they are."""
    pts = [tuple(map(float, p)) for p in points]
    for _ in range(rounds):
        if len(pts) < 3:
            break
        out = [pts[0]]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            out += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
        out.append(pts[-1])
        pts = out
    return pts


def smooth_mask(m, w, h, threshold=128):
    im = Image.fromarray((m * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(im) >= threshold


def smooth_labels(lab, w, h):
    """Biome label map -> smooth label map: each label is interpolated as a field, the strongest wins."""
    ids = [0, 1, 2, 3]
    fields = [np.asarray(Image.fromarray(((lab == b) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) for b in ids]
    out = np.asarray(np.argmax(np.stack(fields), axis=0), np.uint8)
    return out


for f in index['features']:
    if ONLY and f['id'] not in ONLY:
        continue
    land_id, affinity = f['id'], f['affinity']
    cells_w, cells_h = f['width'] // 32, f['height'] // 32
    flags = np.zeros((cells_h, cells_w), np.uint8); biome = np.full((cells_h, cells_w), 255, np.uint8)
    for c in json.loads((WORLD / land_id / 'chunks.json').read_text()):
        j = json.loads((WORLD / land_id / c['path']).read_text()); t = j['terrain']
        x, y = j['x'] // 32, j['y'] // 32
        flags[y:y + t['height'], x:x + t['width']] = unrle(t['flags'], t['width'], t['height'])
        biome[y:y + t['height'], x:x + t['width']] = unrle(t['biome'], t['width'], t['height'])
    scale = min(UP, (MAX_MP * 1e6 / (cells_w * cells_h)) ** 0.5) if UP > 1 else min(1.0, MAXW / cells_w)
    w, h = max(1, round(cells_w * scale)), max(1, round(cells_h * scale))
    if UP > 1:
        land = smooth_mask(flags & 16 > 0, w, h)
        walk = smooth_mask(flags & 1 > 0, w, h)
        road = smooth_mask(flags & 4 > 0, w, h, 70)  # roads are thin; keep them connected
        safe = smooth_mask(flags & 2 > 0, w, h)
        bi = np.where(land, smooth_labels(biome, w, h), 255).astype(np.uint8)
    else:
        pick = lambda a: np.asarray(Image.fromarray(a).resize((w, h), Image.NEAREST))
        fl, bi = pick(flags), pick(biome)
        land, walk, road, safe = fl & 16 > 0, fl & 1 > 0, fl & 4 > 0, fl & 2 > 0
    kk = max(1, round(scale)) if UP > 1 else 1  # filter radii are in pixels: keep them in world units
    size = 96 * kk
    layers = {k: tile(tex(f'{affinity}-{k}-0', size), h, w) for k in ['grass', 'forest', 'mountain', 'wetland', 'sea', 'shore', 'road']}
    # Map style: each ground's average colour with a faint texture, soft borders between biomes.
    calm = lambda k: layers[k].mean((0, 1)) * .82 + (layers[k] - layers[k].mean((0, 1))) * .18 + layers[k].mean((0, 1)) * .18
    flat = np.zeros((h, w, 3), np.float32) + calm('sea') * .9
    for b, k in enumerate(['grass', 'forest', 'mountain', 'wetland']):
        flat = np.where(((bi == b) & land)[..., None], calm(k), flat)
    soft = np.asarray(Image.fromarray(np.clip(flat, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2 * kk)), np.float32)
    img = np.where(land[..., None], soft, flat)
    mountain = (bi == 2) & land
    ridge = np.asarray(Image.fromarray((mountain * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3 * kk)), np.float32) / 255
    img = img * (1 - .25 * ridge[..., None]) + np.array([235, 230, 220]) * (.25 * ridge ** 3)[..., None]
    coast = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(4 * kk + 1))) == 0
    img = np.where((land & coast & walk)[..., None], calm('shore'), img)
    inland_water = np.asarray(Image.fromarray(((land & ~walk) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * kk + 1))) > 0
    img = np.where((inland_water & land)[..., None], np.array([70, 140, 190], np.float32), img)
    if UP > 1:
        # Roads from the authored polylines, anti-aliased, instead of the 1-cell road mask (which
        # showed stair-steps when zoomed in). Secret trails stay off the map, as before.
        world = json.loads((WORLD / land_id / 'world.json').read_text())
        ss = 2
        draw_mask = Image.new('L', (w * ss, h * ss), 0)
        pen = ImageDraw.Draw(draw_mask)
        upp = f['width'] / w
        for r in world.get('roads', []):
            if r.get('kind') == 'secret-trail':
                continue
            pts = [(x / upp * ss, y / upp * ss) for x, y in chaikin(r['points'])]
            wd = max(72, r.get('width', 96) * 1.3) / upp * ss
            if len(pts) > 1:
                pen.line(pts, fill=255, width=max(2, round(wd)), joint='curve')
            for cx, cy in (pts[0], pts[-1]):
                pen.ellipse((cx - wd / 2, cy - wd / 2, cx + wd / 2, cy + wd / 2), fill=255)
        alpha = np.asarray(draw_mask.resize((w, h), Image.LANCZOS), np.float32)[..., None] / 255
        img = img * (1 - alpha) + np.array([196, 168, 118], np.float32) * alpha
    else:
        img = np.where(road[..., None], np.array([196, 168, 118], np.float32), img)
    # The safe-city zones were tinted with a hard-edged white square. In the zoomed atlas (MAP_UPSAMPLE>1) that
    # showed as light rotated rectangles over the terrain, so the tint is off there; cities are marked by the
    # atlas overlay's place glyphs. MAP_SAFE_TINT=1 forces the tint, MAP_SAFE_TINT=0 removes it (the island maps).
    if os.environ.get('MAP_SAFE_TINT', '1' if UP <= 1 else '0') == '1':
        img = np.where(safe[..., None], img * .8 + 255 * .2, img)
    edge = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.FIND_EDGES)) > 0
    img[edge] = [40, 30, 22]
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(WORLD / land_id / f'map{SUFFIX}.webp', quality=86, method=6)
    (WORLD / land_id / f'map{SUFFIX}.json').write_text(json.dumps({'width': w, 'height': h, 'unitsPerPixel': f['width'] / w}) + '\n')
    print(land_id, w, h)
