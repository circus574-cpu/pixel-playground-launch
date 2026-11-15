#!/usr/bin/env python3
"""Open fields for monster spawns, and paths that lead to them (world v2, published runtime data).

  python3 scripts/worldgen/v2/open_fields.py [--land verdant ...] [--dry-run]

Reads, per land, public/game/worlds/superior-v2/<land>/{navigation,terrain,world,spawns}.json and

1. moves every overworld spawn that stands in a cramped place (less than CRAMPED units of free ground around it,
   typically wedged between rocks and bushes) to the nearest open field: dry land with at least OPEN units of free
   ground, outside the safe zone of a town and off the roads. A spawn keeps its id, kind, level and group; only x, y and
   the stream cell change, never by more than MAX_MOVE units;
2. writes paths.json: shortest walkable paths, cheap along existing roads, from the road network to every cluster of
   spawns. Terrain, collision and navigation are not touched (a path is ground that is already walkable).

spawns.json and paths.json are then listed in manifest.json with their SHA-256, which is what the browser loader and
the game server verify. The result is deterministic; running it again on its own output changes nothing.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from scipy import ndimage
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra

ROOT = Path(__file__).resolve().parents[3]
W = ROOT / 'public/game/worlds/superior-v2'
LANDS = ['verdant', 'aether', 'nexus', 'pyra'] + ['island-%d' % i for i in range(1, 7)]
CELL = 16          # navigation cell, world units
COARSE = 4         # path grid = 4 navigation cells = 64 units
CRAMPED = 128.0    # a spawn with less free ground than this is moved
OPEN = 224.0       # ... to a place with at least this much
MAX_MOVE = 1400.0
MIN_GAP = 120.0    # moved spawns keep this distance from every other spawn
SAFE_EXTRA = 64.0  # beyond the spawn's own safe exclusion
CLUSTER = 2560
SPUR = 900
PATH_WIDTH = 64


def unrle(runs, h, w):
    out = np.zeros(h * w, np.uint8)
    at = 0
    for value, count in runs:
        out[at:at + count] = value
        at += count
    assert at == h * w
    return out.reshape(h, w)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rdp(points, eps):
    """Ramer-Douglas-Peucker on a list of (x, y)."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1.0
        best, at = -1.0, -1
        for i in range(a + 1, b):
            d = abs(dy * (points[i][0] - ax) - dx * (points[i][1] - ay)) / norm
            if d > best:
                best, at = d, i
        if best > eps:
            keep[at] = True
            stack.append((a, at))
            stack.append((at, b))
    return [p for p, k in zip(points, keep) if k]


def process(land, dry):
    base = W / land
    nav = json.loads((base / 'navigation.json').read_text())
    ter = json.loads((base / 'terrain.json').read_text())
    world = json.loads((base / 'world.json').read_text())
    spawns_doc = json.loads((base / 'spawns.json').read_text())
    spawns = spawns_doc['overworld']
    h, w = nav['height'], nav['width']
    blocked = unrle(nav['blocked'], h, w).astype(bool)
    flags32 = unrle(ter['flags'], ter['height'], ter['width'])
    flags = np.repeat(np.repeat(flags32, 2, axis=0), 2, axis=1)[:h, :w]
    dry_land = (flags & 16 > 0) & (flags & 1 > 0)
    free = ~blocked & dry_land
    clear = ndimage.distance_transform_edt(free) * CELL
    safe = flags & 2 > 0
    safe_dist = ndimage.distance_transform_edt(~safe) * CELL if safe.any() else np.full((h, w), 1e9)
    road_cells = flags & 4 > 0
    near_road = ndimage.binary_dilation(road_cells, iterations=4) if road_cells.any() else road_cells

    # 1. spawns out of cramped places
    ix = lambda v: np.clip((np.asarray(v) // CELL).astype(int), 0, w - 1)
    iy = lambda v: np.clip((np.asarray(v) // CELL).astype(int), 0, h - 1)
    xs = np.array([s['x'] for s in spawns], float)
    ys = np.array([s['y'] for s in spawns], float)
    clearance = clear[iy(ys), ix(xs)]
    poor = np.where(clearance < CRAMPED)[0]
    moved = 0
    if len(poor):
        need = np.array([max(spawns[i].get('safeExclusion', 556), 556) + SAFE_EXTRA for i in range(len(spawns))])
        floor_safe = float(need.max())
        candidate = free & (clear >= OPEN) & (safe_dist >= floor_safe) & ~near_road
        # candidates on a 4-cell stride: one per 64 units is plenty
        cy, cx = np.nonzero(candidate[::COARSE, ::COARSE])
        cpts = np.stack([(cx * COARSE + COARSE / 2) * CELL, (cy * COARSE + COARSE / 2) * CELL], -1)
        from scipy.spatial import cKDTree
        tree = cKDTree(cpts)
        placed = {}
        def key(x, y):
            return int(x // 256), int(y // 256)
        for i, (x, y) in enumerate(zip(xs, ys)):
            placed.setdefault(key(x, y), []).append(i)
        def crowded(x, y, me):
            kx, ky = key(x, y)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for j in placed.get((kx + dx, ky + dy), []):
                        if j != me and math.hypot(xs[j] - x, ys[j] - y) < MIN_GAP:
                            return True
            return False
        for i in poor:
            dist, order = tree.query([xs[i], ys[i]], k=min(60, len(cpts)), distance_upper_bound=MAX_MOVE)
            for d, j in zip(np.atleast_1d(dist), np.atleast_1d(order)):
                if not math.isfinite(d):
                    break
                x, y = cpts[j]
                if safe_dist[iy(y), ix(x)] < need[i] or crowded(x, y, i):
                    continue
                placed[key(xs[i], ys[i])].remove(i)
                xs[i], ys[i] = float(x), float(y)
                placed.setdefault(key(x, y), []).append(i)
                spawns[i]['x'], spawns[i]['y'] = int(round(x)), int(round(y))
                spawns[i]['streamCell'] = [int(x // 2048), int(y // 2048)]
                moved += 1
                break
    clearance_after = clear[iy(ys), ix(xs)]

    # 2. paths from the road network to every cluster of spawns
    ch, cw = h // COARSE, w // COARSE
    block = clear[:ch * COARSE, :cw * COARSE].reshape(ch, COARSE, cw, COARSE).min(axis=(1, 3))
    walk = block >= 48
    node = np.arange(ch * cw).reshape(ch, cw)
    penalty = np.where(block < 128, 3.0, np.where(block < 224, 1.5, 1.0))
    rows, cols, cost = [], [], []
    for dy, dx, step in ((0, 1, 1.0), (1, 0, 1.0), (1, 1, math.sqrt(2)), (1, -1, math.sqrt(2))):
        ys0, ys1 = (0, ch - dy)
        if dx >= 0:
            xs0, xs1 = 0, cw - dx
        else:
            xs0, xs1 = -dx, cw
        a = node[ys0:ys1, xs0:xs1]
        b = node[dy + ys0:dy + ys1, xs0 + dx:xs1 + dx]
        ok = walk[ys0:ys1, xs0:xs1] & walk[dy + ys0:dy + ys1, xs0 + dx:xs1 + dx]
        c = step * (penalty[ys0:ys1, xs0:xs1] + penalty[dy + ys0:dy + ys1, xs0 + dx:xs1 + dx]) / 2
        rows.append(a[ok]); cols.append(b[ok]); cost.append(c[ok])
    r, c_, v = np.concatenate(rows), np.concatenate(cols), np.concatenate(cost)
    graph = coo_matrix((np.concatenate([v, v]), (np.concatenate([r, c_]), np.concatenate([c_, r]))), shape=(ch * cw,) * 2).tocsr()

    sources = np.zeros((ch, cw), bool)
    def stamp(points, width):
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            n = max(1, int(math.hypot(x1 - x0, y1 - y0) // 32))
            for t in range(n + 1):
                x = x0 + (x1 - x0) * t / n
                y = y0 + (y1 - y0) * t / n
                cx_, cy_ = int(x // (CELL * COARSE)), int(y // (CELL * COARSE))
                if 0 <= cx_ < cw and 0 <= cy_ < ch:
                    sources[cy_, cx_] = True
    for road in world['roads']:
        if road.get('kind') != 'secret-trail':
            stamp(road['points'], road.get('width', 64))
    sources |= walk & ndimage.binary_dilation(safe[::COARSE, ::COARSE][:ch, :cw], iterations=1) & ~safe[::COARSE, ::COARSE][:ch, :cw]
    sources &= walk
    if not sources.any():
        return dict(land=land, spawns=len(spawns), moved=moved, paths=0, length=0)
    src = np.nonzero(sources.ravel())[0]
    dist, pred, _ = dijkstra(graph, directed=False, indices=src, min_only=True, return_predecessors=True)
    cell_world = CELL * COARSE
    built = sources.ravel().copy()   # nodes already on the network
    chains = []

    def lead_to(x, y):
        cx_, cy_ = int(x // cell_world), int(y // cell_world)
        if not (0 <= cx_ < cw and 0 <= cy_ < ch):
            return
        start = node[cy_, cx_]
        if not walk[cy_, cx_]:
            # nearest walkable coarse cell
            ring = [(cy_ + dy, cx_ + dx) for dy in range(-3, 4) for dx in range(-3, 4)
                    if 0 <= cy_ + dy < ch and 0 <= cx_ + dx < cw and walk[cy_ + dy, cx_ + dx]]
            if not ring:
                return
            cy2, cx2 = min(ring, key=lambda p: (p[0] - cy_) ** 2 + (p[1] - cx_) ** 2)
            start = node[cy2, cx2]
        if built[start] or not math.isfinite(dist[start]):
            return
        chain = [start]
        at = start
        while True:
            nxt = pred[at]
            if nxt < 0:
                break
            chain.append(nxt)
            if built[nxt]:
                break
            at = nxt
        for n in chain:
            built[n] = True
        chains.append(chain)

    # clusters of spawns: the spawn nearest the cluster's centre is the target
    buckets = {}
    for i, (x, y) in enumerate(zip(xs, ys)):
        buckets.setdefault((int(x // CLUSTER), int(y // CLUSTER)), []).append(i)
    for (kx, ky), members in sorted(buckets.items()):
        mx, my = xs[members].mean(), ys[members].mean()
        best = min(members, key=lambda i: (xs[i] - mx) ** 2 + (ys[i] - my) ** 2)
        lead_to(xs[best], ys[best])
    # spawns that are still far from every path get a spur
    built_xy = None
    def nearest_built(x, y):
        nonlocal built_xy
        if built_xy is None:
            by, bx = np.nonzero(built.reshape(ch, cw))
            built_xy = np.stack([(bx + .5) * cell_world, (by + .5) * cell_world], -1)
        return float(np.min(np.hypot(built_xy[:, 0] - x, built_xy[:, 1] - y)))
    for i in range(len(spawns)):
        if nearest_built(xs[i], ys[i]) > SPUR:
            lead_to(xs[i], ys[i])
            built_xy = None

    roads_out = []
    length = 0.0
    for n, chain in enumerate(chains):
        pts = [((c % cw + .5) * cell_world, (c // cw + .5) * cell_world) for c in reversed(chain)]
        pts = rdp(pts, 40.0)
        if len(pts) < 2:
            continue
        pts = [[int(round(x)), int(round(y))] for x, y in pts]
        length += sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))
        roads_out.append({'id': '%s-spawn-path-%d' % (land, n), 'kind': 'path', 'width': PATH_WIDTH, 'points': pts})

    if not dry:
        spawns_doc['overworld'] = spawns
        (base / 'spawns.json').write_text(json.dumps(spawns_doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
        (base / 'paths.json').write_text(json.dumps({'format': 'superior-paths-1', 'feature': land, 'roads': roads_out}, separators=(',', ':')) + '\n', encoding='utf-8')
        manifest = json.loads((base / 'manifest.json').read_text())
        manifest['files']['spawns.json'] = sha(base / 'spawns.json')
        manifest['files']['paths.json'] = sha(base / 'paths.json')
        (base / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':')))
    return dict(land=land, spawns=len(spawns), cramped_before=int(len(poor)), moved=moved,
                cramped_after=int((clearance_after < CRAMPED).sum()), paths=len(roads_out), length=int(length))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--land', action='append')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    for land in args.land or LANDS:
        print(json.dumps(process(land, args.dry_run)), flush=True)
