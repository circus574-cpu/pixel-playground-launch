#!/usr/bin/env python3
"""Globe hybrid (owner 11.11.2026): lay real ground-texture detail over the hand-painted atlas.

Keeps the painted style, coasts and shading, but adds the actual forest/mountain grain so the globe
reads as real terrain when zoomed. Detail transfer: hybrid = painted * (real / blur(real))^strength,
masked to land so the ocean stays painted. The original globe-painted.webp is NOT modified.

  python3 scripts/worldgen/v2/build_globe_hybrid.py
  GLOBE_PAINTED=deliveries/world-v2-art/maps/globe-hybrid.webp python3 scripts/worldgen/v2/build_v2_atlas.py
  python3 scripts/build_globe_textures.py --v2

HYBRID_STRENGTH (default 0.85) tunes how much real grain shows through.
"""
import os, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from geometry import read  # noqa: E402
from migration_preview import decode  # noqa: E402

MAPS = ROOT / 'deliveries/world-v2-art/maps'
PAINTED = MAPS / 'globe-painted.webp'
HYBRID = MAPS / 'globe-hybrid.webp'
REAL_PNG = ROOT / 'planet-real-tmp.png'
STRENGTH = float(os.environ.get('HYBRID_STRENGTH', '0.85'))

# 1. Real-texture planet at the same projection/resolution as the painted atlas.
env = dict(os.environ, PLANET_REAL='1')
subprocess.run([sys.executable, str(Path(__file__).parent / 'render_v2_planet_terrain.py'), str(REAL_PNG)], env=env, check=True)
real = np.asarray(Image.open(REAL_PNG).convert('RGB'), np.float32)
painted = np.asarray(Image.open(PAINTED).convert('RGB'), np.float32)
if real.shape != painted.shape:
    real = np.asarray(Image.fromarray(real.astype(np.uint8)).resize((painted.shape[1], painted.shape[0]), Image.LANCZOS), np.float32)

# 2. Exact land mask from the sphere labels, so the grain never spills onto the painted ocean.
P = ROOT / 'public/game/worlds/superior-v2-prototype'
m = read(P / 'sphere-chunks.json'); labels = np.zeros((m['height'], m['width']), np.uint8)
for n in m['chunks']:
    c = read(P / n); labels[c['y']:c['y'] + c['height'], c['x']:c['x'] + c['width']] = decode(c['labels'], c['width'], c['height'])
land = labels > 0
if land.shape != painted.shape[:2]:
    land = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).resize((painted.shape[1], painted.shape[0]), Image.NEAREST)) > 127

# 3. Detail transfer: real high-frequency grain over the painted colours (ratio averages ~1, so the
#    painted palette is preserved; clipping avoids hot/dark specks).
blur = ndimage.gaussian_filter(real, sigma=(3, 3, 0))
ratio = np.clip(real / (blur + 1e-3), 0.5, 2.0)
hybrid = painted * (ratio ** STRENGTH)
hybrid = np.where(land[..., None], hybrid, painted)
Image.fromarray(np.clip(hybrid, 0, 255).astype(np.uint8)).save(HYBRID, 'WEBP', quality=90, method=6)
REAL_PNG.unlink(missing_ok=True)
print('hybrid', HYBRID.name, painted.shape[1], 'x', painted.shape[0], 'strength', STRENGTH)