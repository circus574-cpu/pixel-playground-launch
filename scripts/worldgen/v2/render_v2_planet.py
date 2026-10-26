#!/usr/bin/env python3
"""Paint the world-v2 planet (equirectangular) from the spherical land labels the game geometry uses.

  python3 scripts/worldgen/v2/render_v2_planet.py
Labels 1..10 (verdant, aether, nexus, pyra, island-1..6) come from
public/game/worlds/superior-v2-prototype (45% land). Each land is painted with its ki-v2 ground
textures, ranges from ridged noise, shores and ocean depth. Writes
public/game/worlds/superior-v2/planet-4096.webp and planet-2048.webp plus planet.json (label centres).
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from geometry import read, IDS  # noqa: E402
from migration_preview import decode  # noqa: E402

P = ROOT / 'public/game/worlds/superior-v2-prototype'
OUT = ROOT / 'public/game/worlds/superior-v2'
TEX = ROOT / 'deliveries/ki-v2-terrain-1.0.0'
m = read(P / 'sphere-chunks.json'); labels = np.zeros((m['height'], m['width']), np.uint8)
for n in m['chunks']:
    c = read(P / n); labels[c['y']:c['y'] + c['height'], c['x']:c['x'] + c['width']] = decode(c['labels'], c['width'], c['height'])
H, W = labels.shape
land = labels > 0
rng = np.random.default_rng(7)


def noise(spacing, octaves=4, ridge=False):
    acc = np.zeros((H, W)); amp = 1.; tot = 0.
    for o in range(octaves):
        s = max(2, int(spacing / 2 ** o)); g = rng.random((H // s + 2, W // s + 2))
        n = np.asarray(Image.fromarray(g.astype(np.float32)).resize(((W // s + 2) * s, (H // s + 2) * s), Image.BICUBIC))[:H, :W]
        if ridge: n = 1 - np.abs(n * 2 - 1)
        acc += n * amp; tot += amp; amp *= .5
    return acc / tot


def colour(name):
    im = Image.open(TEX / f'ki-v2-terrain-{name}.webp').convert('RGB').resize((64, 64))
    return np.asarray(im, np.float32).reshape(-1, 3).mean(0)


AFF = {i + 1: (k if k in ('verdant', 'aether', 'nexus', 'pyra') else ['verdant', 'aether', 'verdant', 'pyra', 'nexus', 'aether'][int(k[-1]) - 1]) for i, k in enumerate(IDS)}
coast = ndimage.distance_transform_edt(land); sea_d = ndimage.distance_transform_edt(~land)
ridge = noise(220, 5, True) ** 2.4; forest = noise(90); detail = noise(18, 3)
img = np.zeros((H, W, 3), np.float32)
deep, shallow = np.array([14, 46, 92.]), np.array([40, 120, 160.])
t = np.clip(sea_d / 60, 0, 1)[..., None]
img[:] = shallow * (1 - t) + deep * t
img *= (.9 + .2 * detail)[..., None]
for lab, aff in AFF.items():
    mask = labels == lab
    if not mask.any(): continue
    g, f, mt, sh = colour(f'{aff}-grass-0'), colour(f'{aff}-forest-0'), colour(f'{aff}-mountain-0'), colour(f'{aff}-shore-0')
    inland = np.clip(coast / 40, 0, 1)
    mount = np.clip((ridge - .35) * 3, 0, 1) * inland
    base = np.where((forest > .52)[..., None], f, g)
    c = base * (1 - mount[..., None]) + mt * mount[..., None]
    snow = np.clip((mount - .7) * 3, 0, 1)[..., None]
    peak = np.array([255, 120, 30.]) if aff == 'pyra' else np.array([236, 240, 245.])  # lava on Pyra, snow elsewhere
    c = c * (1 - snow) + peak * snow
    c = np.where((coast < 3)[..., None], sh, c)
    c *= (.85 + .3 * detail)[..., None]
    img[mask] = c[mask]
# Hillshade from the mountain field gives relief on the globe.
hs = np.gradient(ndimage.gaussian_filter(ridge * land, 2), axis=1)
img *= np.clip(1 + hs[..., None] * 18 * land[..., None], .7, 1.3)
edge = land & (coast < 1.5)
img[edge] = img[edge] * .6
pic = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.SMOOTH)
pic.save(OUT / 'planet-4096.webp', quality=88, method=6)
pic.resize((2048, 1024), Image.LANCZOS).save(OUT / 'planet-2048.webp', quality=88, method=6)
centres = {}
for lab, key in enumerate(IDS, 1):
    ys, xs = np.nonzero(labels == lab)
    if len(xs):
        lon = np.angle(np.exp(1j * (xs / W * 2 * np.pi - np.pi)).mean())
        centres[key] = {'lon': round(float(np.degrees(lon)), 2), 'lat': round(float(90 - ys.mean() / H * 180), 2)}
lat = np.linspace(np.pi / 2, -np.pi / 2, H); wgt = np.cos(lat)[:, None] * np.ones((H, W))
(OUT / 'planet.json').write_text(json.dumps({'landPercent': round(float((wgt * land).sum() / wgt.sum() * 100), 1), 'centres': centres}, ensure_ascii=False) + '\n')
print(json.loads((OUT / 'planet.json').read_text()))
