#!/usr/bin/env python3
"""Bind Argon's continent definitions (cities, famous locations, hidden places) to world v2 positions.

  npx tsx scripts/worldgen/v2/export-quest-places.ts > /tmp/places.json
  python3 scripts/worldgen/v2/bind_quest_places.py /tmp/places.json
Writes src/game/worlds/v2Places.generated.json. Argon authored everything in the accepted capital's
source map, so: the capital keeps its v2 capital, the other three cities take the three v2 towns
by best direction match; famous locations use their map point inside the capital (source + offset),
famous locations stand at the four v2 expedition landmarks of the land (fallback: their map point
inside the capital, the first object of the same kind, then a distinct v2 shrine). Do not edit by hand.
"""
import itertools, json, math, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WORLD = ROOT / 'public/game/worlds/superior-v2'
argon = json.loads(Path(sys.argv[1]).read_text())
out = {}
for cid, data in sorted(argon.items()):
    w = json.loads((WORLD / cid / 'world.json').read_text())
    off, src = w['sourceOffset'], w['acceptedSource']
    towns = {s['id']: s for s in w['settlements'] if s['kind'] in ('capital', 'town')}
    capital = next(s for s in towns.values() if s['kind'] == 'capital')
    others = [s for s in towns.values() if s is not capital]
    acap = next(c for c in data['cities'] if c['role'] == 'capital')
    centre = lambda b: (b['x'] + b['width'] / 2, b['y'] + b['height'] / 2)
    ax, ay = centre(acap['bounds'])
    rest = [c for c in data['cities'] if c is not acap]
    angle = lambda dx, dy: math.atan2(dy, dx)
    diff = lambda a, b: abs((a - b + math.pi) % (2 * math.pi) - math.pi)
    best = min(itertools.permutations(others), key=lambda perm: sum(
        diff(angle(centre(c['bounds'])[0] - ax, centre(c['bounds'])[1] - ay), angle(t['x'] - capital['x'], t['y'] - capital['y']))
        for c, t in zip(rest, perm)))
    cities = {acap['id']: {'settlement': capital['id'], 'name': acap['name'], 'x': capital['x'], 'y': capital['y']}}
    for c, t in zip(rest, best):
        cities[c['id']] = {'settlement': t['id'], 'name': c['name'], 'x': t['x'], 'y': t['y']}
    objects = {o['id']: o for o in src['objects']}
    shrines = [l for l in w['locations'] if l['kind'] in ('shrine', 'watchtower', 'wilderness')]
    famous, used = {}, set()
    # Famous places are expedition goals: the i-th one stands at the v2 landmark the generator
    # reached by a road from the nearest town (<land>-v2-landmark-i).
    wild = {l['id']: l for l in w['locations'] if '-v2-landmark-' in l['id']}
    for i, f in enumerate(data['famous']):
        spot = wild.get('%s-v2-landmark-%d' % (cid, i))
        if spot:
            famous[f['id']] = {'name': f['name'], 'x': spot['x'], 'y': spot['y'], 'source': spot['id']}
            continue
        o = objects.get(f['mapPointId'])
        how = 'map-point'
        if o is None:
            kind = re.sub(r'-\d+$', '', f['mapPointId'])
            o = next((x for x in src['objects'] if x['kind'] == kind and x['id'] not in used), None)
            how = 'same-kind'
        if o is not None:
            used.add(o['id'])
            p = {'x': round(o['x'] + off['x']), 'y': round(o['y'] + off['y'])}
        else:
            loc = next(l for l in shrines if l['id'] not in used)
            used.add(loc['id']); how = 'v2-' + loc['kind']
            p = {'x': loc['x'], 'y': loc['y']}
        famous[f['id']] = {'name': f['name'], **p, 'source': how}
    # Hidden places are the land's real caches (v2 hidden-cache, then caves and mazes), not their
    # point on the capital's source map: those all sat inside or beside the town (owner 26.10.2026).
    caches = [l for kind in ('hidden-cache', 'cave', 'maze') for l in w['locations'] if l['kind'] == kind]
    far = sorted((l for l in caches if math.hypot(l['x'] - capital['x'], l['y'] - capital['y']) > 4000),
                 key=lambda l: math.hypot(l['x'] - capital['x'], l['y'] - capital['y']))
    step = max(1, len(far) // max(1, len(data['hidden'])))
    hidden = {}
    for i, h in enumerate(data['hidden']):
        if i * step < len(far):
            spot = far[i * step]
            hidden[h['id']] = {'name': h['name'], 'x': spot['x'], 'y': spot['y'], 'source': spot['id']}
        else:
            hidden[h['id']] = {'name': h['name'], 'x': round(h['coordinates']['x'] + off['x']),
                               'y': round(h['coordinates']['y'] + off['y']), 'source': 'map-point'}
    out[cid] = {'cities': cities, 'famous': famous, 'hidden': hidden}
target = ROOT / 'src/game/worlds/v2Places.generated.json'
target.write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
for cid, v in out.items():
    print(cid, {k: c['settlement'] for k, c in v['cities'].items()}, [f['source'] for f in v['famous'].values()])
