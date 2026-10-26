#!/usr/bin/env python3
"""World v2 atlas for /mapa (preview ?ki-world-v2=1): the painted equirectangular planet of the v2
geometry (deliveries/world-v2-art/maps/globe-equirect.webp, 45% land) plus traced region outlines.

  python3 scripts/worldgen/v2/build_v2_atlas.py && python3 scripts/build_globe_textures.py --v2
Writes src/assets/planet-map/atlas-v2-{1920,3840}.webp, src/components/planet-map/atlasRegions.v2.json
and planetLayout.v2.json (label and settlement spots), in map units 2000 x 1000.
"""
import json, sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from geometry import read, IDS  # noqa: E402
from migration_preview import decode  # noqa: E402

P = ROOT / 'public/game/worlds/superior-v2-prototype'
ASSETS = ROOT / 'src/assets/planet-map'
MW, MH = 2000, 1000
src = Image.open(ROOT / 'deliveries/world-v2-art/maps/globe-equirect.webp').convert('RGB')
src.resize((3840, 1920), Image.LANCZOS).save(ASSETS / 'atlas-v2-3840.webp', 'WEBP', quality=88, method=6)
src.resize((1920, 960), Image.LANCZOS).save(ASSETS / 'atlas-v2-1920.webp', 'WEBP', quality=86, method=6)
m = read(P / 'sphere-chunks.json'); labels = np.zeros((m['height'], m['width']), np.uint8)
for n in m['chunks']:
    c = read(P / n); labels[c['y']:c['y'] + c['height'], c['x']:c['x'] + c['width']] = decode(c['labels'], c['width'], c['height'])
sx, sy = MW / labels.shape[1], MH / labels.shape[0]
outlines, layout = {}, {}
for lab, key in enumerate(IDS, 1):
    mask = (labels == lab).astype(np.uint8)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(contours, key=cv2.contourArea)
    c = cv2.approxPolyDP(c, 2.5, True)[:, 0, :]
    outlines[key] = [[round(float(x) * sx, 1), round(float(y) * sy, 1)] for x, y in c]
    # Label on the deepest inland point, so it never sits on the coast.
    dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5); y, x = np.unravel_index(dist.argmax(), dist.shape)
    spot = {'x': round(float(x) * sx, 1), 'y': round(float(y) * sy, 1)}
    layout[key] = {'label': spot} if key.startswith('island') else {'label': spot, 'settlementPoint': spot}
(ROOT / 'src/components/planet-map/atlasRegions.v2.json').write_text(json.dumps(outlines) + '\n')
(ROOT / 'src/components/planet-map/planetLayout.v2.json').write_text(json.dumps(layout) + '\n')
print({k: len(v) for k, v in outlines.items()})
