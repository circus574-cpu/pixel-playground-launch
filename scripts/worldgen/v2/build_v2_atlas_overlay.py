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


roads, marks = [], []
for key in IDS:
    world = json.loads((W / key / 'world.json').read_text()); anchor = world['geometry']['anchor']
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
    if spots:
        xy = project(key, anchor, [[s[3], s[4]] for s in spots])
        for (sid, kind, name, _, _), (x, y) in zip(spots, xy):
            marks.append({'id': sid, 'land': key, 'kind': kind, 'name': name, 'x': round(float(x), 2), 'y': round(float(y), 2)})
(ROOT / 'src/components/planet-map/worldOverlay.v2.json').write_text(json.dumps({'roads': roads, 'places': marks}, ensure_ascii=False, separators=(',', ':')) + '\n')
print(len(roads), 'road pieces', len(marks), 'places', round((ROOT / 'src/components/planet-map/worldOverlay.v2.json').stat().st_size / 1024), 'KiB')
