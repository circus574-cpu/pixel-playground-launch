#!/usr/bin/env python3
"""Equirectangular planet painted from the runtime terrain the game uses (biomes, inland water,
roads skipped) so the globe and the 2D atlas match the world. Output feeds the GPU repaint.

  python3 scripts/worldgen/v2/render_v2_planet_terrain.py <out.png>
Each spherical land pixel is projected into its land's local map (inverse azimuthal projection,
the same one landscape.py uses) and takes the colour of the cell found there.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from geometry import read, IDS, inverse, sphere_grid  # noqa: E402
from migration_preview import decode  # noqa: E402

P = ROOT / 'public/game/worlds/superior-v2-prototype'
W = ROOT / 'public/game/worlds/superior-v2'
TEX = ROOT / 'deliveries/ki-v2-terrain-1.0.0'
context = read(Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'public/game/worlds/superior-v2-context.json')
planet = context['planet']
m = read(P / 'sphere-chunks.json'); labels = np.zeros((m['height'], m['width']), np.uint8)
for n in m['chunks']:
    c = read(P / n); labels[c['y']:c['y'] + c['height'], c['x']:c['x'] + c['width']] = decode(c['labels'], c['width'], c['height'])
H, Wd = labels.shape
index = {f['id']: f for f in json.loads((W / 'index.json').read_text())['features']}


def colour(name):
    return np.asarray(Image.open(TEX / f'ki-v2-terrain-{name}.webp').convert('RGB').resize((32, 32)), np.float32).reshape(-1, 3).mean(0)


out = np.zeros((H, Wd, 3), np.float32)
land = labels > 0
sea_d = ndimage.distance_transform_edt(~land)
t = np.clip(sea_d / 40, 0, 1)[..., None]
out[:] = np.array([40, 120, 160.]) * (1 - t) + np.array([14, 46, 92.]) * t
for lab, key in enumerate(IDS, 1):
    f = index[key]; world = json.loads((W / key / 'world.json').read_text()); anchor = world['geometry']['anchor']
    aff = f['affinity']; cw, ch = f['width'] // 32, f['height'] // 32
    flags = np.zeros((ch, cw), np.uint8); biome = np.zeros((ch, cw), np.uint8)
    for c in json.loads((W / key / 'chunks.json').read_text()):
        j = json.loads((W / key / c['path']).read_text()); tt = j['terrain']; x, y = j['x'] // 32, j['y'] // 32
        flags[y:y + tt['height'], x:x + tt['width']] = decode(tt['flags'], tt['width'], tt['height'])
        biome[y:y + tt['height'], x:x + tt['width']] = decode(tt['biome'], tt['width'], tt['height'])
    pal = np.array([colour(f'{aff}-{k}-0') for k in ['grass', 'forest', 'mountain', 'wetland']])
    pal[2] = pal[2] * 0.7 + np.array([235, 235, 230.]) * 0.3  # ranges read lighter from orbit
    ys, xs = np.nonzero(labels == lab)
    for s in range(0, len(ys), 400000):
        yy, xx = ys[s:s + 400000], xs[s:s + 400000]
        lon = (xx + .5) / Wd * 2 * np.pi - np.pi; lat = np.pi / 2 - (yy + .5) / H * np.pi
        v = np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], -1)
        xy = inverse(v, planet['features'][key]) * planet['radius']
        cx = np.clip(((anchor['x'] + xy[:, 0]) // 32).astype(int), 0, cw - 1)
        cy = np.clip(((anchor['y'] - xy[:, 1]) // 32).astype(int), 0, ch - 1)
        fl = flags[cy, cx]; b = np.minimum(biome[cy, cx], 3)
        col = pal[b]
        col[(fl & 16) == 0] = [40, 120, 160]
        col[((fl & 16) > 0) & ((fl & 1) == 0)] = [70, 140, 190]
        out[yy, xx] = col
edge = land & (ndimage.distance_transform_edt(land) < 2)
out[edge] *= 0.75
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).filter(ImageFilter.SMOOTH).save(sys.argv[1])
print('ok', sys.argv[1])
