"""Landscape v2: rebuild elevation, rivers, biomes and roads inside Codex's fixed land mask.
Keeps: land mask (coastline), settlement positions. Writes world/<c>/terrain2.json + roads2.json.
usage: python landscape.py <continent>
"""
import sys, json, heapq, math
import numpy as np
from PIL import Image, ImageFilter

C = sys.argv[1]
D = f"world/{C}"
T = json.load(open(f"{D}/terrain.json"))
P = json.load(open(f"{D}/content-plan.json"))
cell, gw, gh = T["cell"], T["width"], T["height"]
SEED = sum(map(ord, C))
rng = np.random.default_rng(SEED)

def unrle(r):
    return np.concatenate([np.full(n, v, np.uint8) for v, n in r]).reshape(gh, gw)

def rle(a):
    f = a.ravel(); out = []; i = 0
    while i < len(f):
        j = i
        while j < len(f) and f[j] == f[i]: j += 1
        out.append([int(f[i]), j - i]); i = j
    return out

land = unrle(T["land"]) > 0

def blur(a, r):
    a = a.astype(np.float32)
    k = int(max(1, r * 3)); x = np.arange(-k, k + 1); w = np.exp(-x * x / (2 * r * r)); w /= w.sum()
    p = np.pad(a, k, mode="edge")
    p = sum(w[i] * p[:, i:i + a.shape[1]] for i in range(2 * k + 1))
    return sum(w[i] * p[i:i + a.shape[0], :] for i in range(2 * k + 1))

def noise(scale, octaves=5, ridge=False):
    acc = np.zeros((gh, gw), np.float32); amp = 1; tot = 0
    for o in range(octaves):
        s = max(1, int(scale / 2 ** o))
        n = rng.random((gh // s + 3, gw // s + 3)).astype(np.float32)
        n = np.asarray(Image.fromarray(n).resize(((gw // s + 3) * s, (gh // s + 3) * s), Image.BICUBIC))[:gh, :gw]
        if ridge: n = 1 - np.abs(n * 2 - 1)
        acc += n * amp; tot += amp; amp *= .5
    return acc / tot

# distance from coast (cells)
dist = np.zeros((gh, gw), np.float32)
cur = land.copy(); k = 0
while cur.any() and k < 200:
    dist += cur; k += 1
    cur = np.asarray(Image.fromarray((cur * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))) > 0
dn = np.clip(dist / max(1, dist.max()), 0, 1)

# mountain ranges: ridged noise, stronger inland, a few long chains
ridges = noise(90, 5, ridge=True) ** 2.2
warp = noise(60, 3)
chain = np.clip((ridges - .35) * 2.2, 0, 1) * (.35 + .65 * np.clip(dn * 1.8, 0, 1))
base = .18 + .45 * np.sqrt(dn) + .12 * (noise(70, 4) - .5)
elev = base + .55 * chain * (.6 + .4 * warp)
elev = blur(elev, 1.2)
elev[~land] = 0
# keep cities on gentle lowland
sx = lambda x: int(x / cell); sy = lambda y: int(y / cell)
YY, XX = np.mgrid[0:gh, 0:gw]
for s in P["settlements"]:
    cx, cy = sx(s["x"]), sy(s["y"])
    r = (s["bounds"]["width"] / cell) * .9
    f = np.exp(-(((XX - cx) ** 2 + (YY - cy) ** 2) / (r * r)))
    elev = elev * (1 - f * .8) + (.32) * f * .8
elev[~land] = 0
e = elev / max(1e-6, elev[land].max())

# rivers: start at high points, walk downhill (with lake filling by small noise), stop at sea
river = np.zeros((gh, gw), np.float32)
heights = e + (noise(14, 3) - .5) * .09 + rng.random(e.shape).astype(np.float32) * 1e-4
cand = np.argwhere(land & (e > .62))
rng.shuffle(cand)
nriv = 0
for y, x in cand[:400]:
    if nriv >= 9: break
    if river[max(0, y - 6):y + 6, max(0, x - 6):x + 6].any(): continue
    path = [(y, x)]; seen = {(y, x)}; ok = False
    for _ in range(1500):
        best = None; bh = heights[y, x] + 0.02
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < gh and 0 <= nx < gw and (ny, nx) not in seen and heights[ny, nx] < bh:
                bh = heights[ny, nx]; best = (ny, nx)
        if best is None: break
        y, x = best; seen.add(best); path.append(best)
        if not land[y, x] or river[y, x] > 0: ok = True; break
    if ok and len(path) > 40:
        nriv += 1
        for i, (py, px) in enumerate(path):
            river[py, px] = max(river[py, px], 1 + i / len(path) * 2)  # widens downstream
        for py, px in path:  # carve
            heights[py, px] *= .97
print("rivers", nriv)

# moisture: near rivers + coast + noise
wet = blur((river > 0).astype(np.float32), 6) * 3 + blur((~land).astype(np.float32), 10) * 1.2 + noise(80, 4) * .9
wet = (wet - wet[land].min()) / max(1e-6, np.ptp(wet[land]))

biome = np.zeros((gh, gw), np.uint8)              # 0 grass
forestness = .5 * wet + .5 * noise(45, 4)
biome[forestness > np.quantile(forestness[land], .62)] = 1                          # forest
biome[(wet > np.quantile(wet[land], .93)) & (e < .5)] = 3                  # wetland near rivers / lowland
biome[e > .66] = 2                                  # mountain
biome[(e > .52) & (e <= .66) & (wet > .45)] = 1     # forested foothills
for s in P["settlements"]:                          # clear settlement areas
    b = s["bounds"]; x0, y0 = sx(b["x"]) - 3, sy(b["y"]) - 3
    biome[max(0, y0):sy(b["y"] + b["height"]) + 3, max(0, x0):sx(b["x"] + b["width"]) + 3] = 0
biome[~land] = 255

# roads: A* on cost grid between capital and every other settlement / landmark
cost = 1 + (e * 6) ** 2 + (biome == 1) * 1.5 + (biome == 3) * 6 + (biome == 2) * 14
cost[~land] = 1e6
cost[river > 0] += 25  # bridges are expensive but possible
def astar(a, b):
    H = lambda p: math.hypot(p[0] - b[0], p[1] - b[1])
    g = {a: 0}; came = {}; pq = [(H(a), a)]
    while pq:
        _, p = heapq.heappop(pq)
        if p == b: break
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
            q = (p[0] + dy, p[1] + dx)
            if not (0 <= q[0] < gh and 0 <= q[1] < gw): continue
            ng = g[p] + cost[q] * (1.414 if dy and dx else 1)
            if ng < g.get(q, 1e18):
                g[q] = ng; came[q] = p; heapq.heappush(pq, (ng + H(q), q))
    path = [b]
    while path[-1] in came: path.append(came[path[-1]])
    return path[::-1]

cap = next((s for s in P["settlements"] if s["kind"] == "capital"), None)
targets = [] if cap is None else [s for s in P["settlements"] if s is not cap] + [l for l in P["landmarks"] if l["kind"] == "design-anchor"]
roads = []
for t in (targets if cap else []):
    p = astar((sy(cap["y"]), sx(cap["x"])), (sy(t["y"]), sx(t["x"])))
    pts = [[(x + .5) * cell, (y + .5) * cell] for y, x in p[::3]] + [[t["x"], t["y"]]]
    roads.append({"to": t["id"], "width": 300 if t.get("kind") in ("town", "capital") else 200, "points": pts})
    for y, x in p: cost[y, x] = max(1, cost[y, x] * .35)  # later roads reuse earlier ones

rivers_out = river.astype(np.uint8)
json.dump({"cell": cell, "width": gw, "height": gh, "land": T["land"], "biome": rle(biome),
           "elevation": rle(np.round(e * 255).astype(np.uint8)), "river": rle(rivers_out),
           "source": "landscape.py v1 on Codex f9e765d land mask"}, open(f"{D}/terrain2.json", "w"))
json.dump(roads, open(f"{D}/roads2.json", "w"))
print("ok", C, "roads", len(roads))
