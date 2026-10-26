#!/usr/bin/env python3
"""Roads and places of world v2 projected onto the planet atlas (map units 2000 x 1000).

  python3 scripts/worldgen/v2/build_v2_atlas_overlay.py
Every land's local coordinates go through the same azimuthal projection landscape.py uses
(local -> unit sphere -> lon/lat -> equirectangular). Writes
src/components/planet-map/worldOverlay.v2.json; every road and place keeps its world id so a
fog of war can hide what the player has not discovered yet.
"""
import json, math, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from geometry import read, forward, IDS  # noqa: E402

W = ROOT / 'public/game/worlds/superior-v2'
planet = read(ROOT / 'art/production/worlds/superior-v2-context.json')['planet']
places = json.loads((ROOT / 'src/game/worlds/v2Places.generated.json').read_text())
MW, MH = 2000, 1000


def project(key, anchor, pts):
    a = np.asarray(pts, float)
    xy = np.stack([(a[:, 0] - anchor['x']) / planet['radius'], (anchor['y'] - a[:, 1]) / planet['radius']], -1)
    v = forward(xy, planet['features'][key])
    lon = np.arctan2(v[:, 1], v[:, 0]); lat = np.arcsin(np.clip(v[:, 2], -1, 1))
    return np.stack([(lon + math.pi) / (2 * math.pi) * MW, (math.pi / 2 - lat) / math.pi * MH], -1)


def pieces(p):
    """Split a projected line where it crosses the map seam; drop near-duplicate points."""
    out, cur = [], [p[0]]
    for q in p[1:]:
        if abs(q[0] - cur[-1][0]) > MW / 2:
            out.append(cur); cur = [q]
        elif math.hypot(q[0] - cur[-1][0], q[1] - cur[-1][1]) > 0.03:
            cur.append(q)
    out.append(cur)
    return [[[round(float(x), 2), round(float(y), 2)] for x, y in c] for c in out if len(c) > 1]


roads, marks, tiles = [], [], []
for key in IDS:
    world = json.loads((W / key / 'world.json').read_text()); anchor = world['geometry']['anchor']
    # Detail tiles: the land's painted map (map.webp) cut into a grid, each cell placed with the affine
    # transform of its projected corners, so zoomed-in atlas views stay sharp.
    meta = json.loads((W / key / 'map-hi.json').read_text()); upp = meta['unitsPerPixel']
    gx, gy = 16, 12
    for j in range(gy):
        for i in range(gx):
            x0, x1 = meta['width'] * i / gx, meta['width'] * (i + 1) / gx
            y0, y1 = meta['height'] * j / gy, meta['height'] * (j + 1) / gy
            c = project(key, anchor, [[x0 * upp, y0 * upp], [x1 * upp, y0 * upp], [x0 * upp, y1 * upp]])
            if abs(c[1][0] - c[0][0]) > MW / 2 or abs(c[2][0] - c[0][0]) > MW / 2: continue
            a = (c[1] - c[0]) / (x1 - x0); d = (c[2] - c[0]) / (y1 - y0)
            tiles.append({'land': key, 'crop': [round(x0, 2), round(y0, 2), round(x1 - x0, 2), round(y1 - y0, 2)],
                          'm': [round(float(v), 5) for v in (a[0], a[1], d[0], d[1], c[0][0] - a[0] * x0 - d[0] * y0, c[0][1] - a[1] * x0 - d[1] * y0)],
                          'size': [meta['width'], meta['height']]})
    for r in world['roads']:
        for part in pieces(project(key, anchor, r['points'])):
            roads.append({'id': r['id'], 'land': key, 'kind': r.get('kind', 'road'), 'width': r.get('width', 160), 'points': part})
    names = {c['settlement']: c['name'] for c in places.get(key, {}).get('cities', {}).values()}
    famous = places.get(key, {}).get('famous', {})
    spots = [(s['id'], s['kind'], names.get(s['id'], s.get('name', s['id'])), s['x'], s['y']) for s in world['settlements']]
    taken = {s[0] for s in spots}
    spots += [(l['id'], l['kind'], l.get('name') or '', l['x'], l['y']) for l in world['locations']
              if l['id'] not in taken and not l.get('hidden') and l['kind'] != 'settlement']
    spots += [(fid, 'famous', f['name'], f['x'], f['y']) for fid, f in famous.items()]
    spots += [(c['id'], 'camp', 'Obóz · poz. %d' % c['level'], c['x'], c['y']) for c in world.get('camps', [])]
    if spots:
        xy = project(key, anchor, [[s[3], s[4]] for s in spots])
        for (sid, kind, name, _, _), (x, y) in zip(spots, xy):
            marks.append({'id': sid, 'land': key, 'kind': kind, 'name': name, 'x': round(float(x), 2), 'y': round(float(y), 2)})
(ROOT / 'src/components/planet-map/worldOverlay.v2.json').write_text(json.dumps({'roads': roads, 'places': marks, 'tiles': tiles}, ensure_ascii=False, separators=(',', ':')) + '\n')
print(len(roads), 'road pieces', len(marks), 'places', round((ROOT / 'src/components/planet-map/worldOverlay.v2.json').stat().st_size / 1024), 'KiB')
