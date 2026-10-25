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
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
WORLD = ROOT / 'public/game/worlds/superior-v2'
TEX = ROOT / 'deliveries/ki-v2-terrain-1.0.0'
MAXW = 2048


def unrle(runs, w, h):
    return np.concatenate([np.full(n, v, np.uint8) for v, n in runs]).reshape(h, w)


def tex(name, size):
    im = Image.open(TEX / f'ki-v2-terrain-{name}.webp').convert('RGB').resize((size, size), Image.LANCZOS)
    return np.asarray(im, np.float32)


def tile(t, h, w):
    reps = (h // t.shape[0] + 1, w // t.shape[1] + 1, 1)
    return np.tile(t, reps)[:h, :w]


index = json.loads((WORLD / 'index.json').read_text())
for f in index['features']:
    land_id, affinity = f['id'], f['affinity']
    cells_w, cells_h = f['width'] // 32, f['height'] // 32
    flags = np.zeros((cells_h, cells_w), np.uint8); biome = np.full((cells_h, cells_w), 255, np.uint8)
    for c in json.loads((WORLD / land_id / 'chunks.json').read_text()):
        j = json.loads((WORLD / land_id / c['path']).read_text()); t = j['terrain']
        x, y = j['x'] // 32, j['y'] // 32
        flags[y:y + t['height'], x:x + t['width']] = unrle(t['flags'], t['width'], t['height'])
        biome[y:y + t['height'], x:x + t['width']] = unrle(t['biome'], t['width'], t['height'])
    scale = min(1.0, MAXW / cells_w)
    w, h = max(1, round(cells_w * scale)), max(1, round(cells_h * scale))
    pick = lambda a: np.asarray(Image.fromarray(a).resize((w, h), Image.NEAREST))
    fl, bi = pick(flags), pick(biome)
    land, walk, road, safe = fl & 16 > 0, fl & 1 > 0, fl & 4 > 0, fl & 2 > 0
    size = 96
    layers = {k: tile(tex(f'{affinity}-{k}-0', size), h, w) for k in ['grass', 'forest', 'mountain', 'wetland', 'sea', 'shore', 'road']}
    # Map style: each ground's average colour with a faint texture, soft borders between biomes.
    calm = lambda k: layers[k].mean((0, 1)) * .82 + (layers[k] - layers[k].mean((0, 1))) * .18 + layers[k].mean((0, 1)) * .18
    flat = np.zeros((h, w, 3), np.float32) + calm('sea') * .9
    for b, k in enumerate(['grass', 'forest', 'mountain', 'wetland']):
        flat = np.where(((bi == b) & land)[..., None], calm(k), flat)
    soft = np.asarray(Image.fromarray(np.clip(flat, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), np.float32)
    img = np.where(land[..., None], soft, flat)
    mountain = (bi == 2) & land
    ridge = np.asarray(Image.fromarray((mountain * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), np.float32) / 255
    img = img * (1 - .25 * ridge[..., None]) + np.array([235, 230, 220]) * (.25 * ridge ** 3)[..., None]
    coast = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))) == 0
    img = np.where((land & coast & walk)[..., None], calm('shore'), img)
    inland_water = np.asarray(Image.fromarray(((land & ~walk) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    img = np.where((inland_water & land)[..., None], np.array([70, 140, 190], np.float32), img)
    img = np.where(road[..., None], np.array([196, 168, 118], np.float32), img)
    img = np.where(safe[..., None], img * .8 + 255 * .2, img)
    edge = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.FIND_EDGES)) > 0
    img[edge] = [40, 30, 22]
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(WORLD / land_id / 'map.webp', quality=86, method=6)
    (WORLD / land_id / 'map.json').write_text(json.dumps({'width': w, 'height': h, 'unitsPerPixel': f['width'] / w}) + '\n')
    print(land_id, w, h)
