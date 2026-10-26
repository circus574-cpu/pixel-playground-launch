"""Render a v2 continent from Codex terrain.json + painted textures.
usage: python world_render.py <continent> <tex_dir> <out.jpg> <units_per_px> [x0 y0 w h]  (world units)
"""
import sys, json, math
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

C, TEX, OUT, UPP = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
D = f"world/{C}"
import os as _o0
C = _o0.environ.get("TEXC", C)
import os as _os
V2 = _os.path.exists(f"{D}/terrain2.json") and _os.environ.get("LAND", "2") == "2"
T = json.load(open(f"{D}/terrain2.json" if V2 else f"{D}/terrain.json"))
P = json.load(open(f"{D}/content-plan.json"))
if V2: P["roads"] = json.load(open(f"{D}/roads2.json"))
cell, gw, gh = T["cell"], T["width"], T["height"]

def unrle(r):
    return np.concatenate([np.full(n, v, np.uint8) for v, n in r]).reshape(gh, gw)

biome, elev = unrle(T["biome"]), unrle(T["elevation"]).astype(np.float32) / 255
if len(sys.argv) > 5:
    x0, y0, W, H = map(float, sys.argv[5:9])
else:
    x0, y0, W, H = 0, 0, gw * cell, gh * cell
ow, oh = int(W / UPP), int(H / UPP)
print("out", ow, oh, flush=True)
xs = x0 + (np.arange(ow) + .5) * UPP
ys = y0 + (np.arange(oh) + .5) * UPP
X, Y = np.meshgrid(xs, ys)

# deterministic value noise in world units
def vnoise(X, Y, freq, seed):
    x, y = X * freq, Y * freq
    xi, yi = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    xf, yf = x - xi, y - yi
    def h(a, b):
        v = (a * 374761393 + b * 668265263 + seed * 2246822519) & 0xFFFFFFFF
        v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
        return (v & 0xFFFF) / 65535.0
    u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    return (h(xi, yi) * (1 - u) * (1 - v) + h(xi + 1, yi) * u * (1 - v)
            + h(xi, yi + 1) * (1 - u) * v + h(xi + 1, yi + 1) * u * v)

def fbm(X, Y, f, seed, oct=4):
    s, a, t = 0, 1, 0
    for o in range(oct):
        s += a * vnoise(X, Y, f * 2 ** o, seed + o); t += a; a *= .5
    return s / t

# domain warp kills the 128-unit grid look
wx = (fbm(X, Y, 1 / 2600, 1) - .5) * 900 + (fbm(X, Y, 1 / 500, 7) - .5) * 160
wy = (fbm(X, Y, 1 / 2600, 2) - .5) * 900 + (fbm(X, Y, 1 / 500, 8) - .5) * 160
gx = np.clip((X + wx) / cell - .5, 0, gw - 1.001)
gy = np.clip((Y + wy) / cell - .5, 0, gh - 1.001)

def sample(grid):  # bilinear sample of a cell grid
    ix, iy = gx.astype(int), gy.astype(int); fx, fy = gx - ix, gy - iy
    ix1, iy1 = np.minimum(ix + 1, gw - 1), np.minimum(iy + 1, gh - 1)
    return (grid[iy, ix] * (1 - fx) * (1 - fy) + grid[iy, ix1] * fx * (1 - fy)
            + grid[iy1, ix] * (1 - fx) * fy + grid[iy1, ix1] * fx * fy)

def smooth(g, r):
    im = Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
    return np.asarray(im, np.float32) / 255

land = smooth((biome != 255).astype(np.float32), 1.2)
L = sample(land)                       # 0 sea .. 1 land, soft
E = sample(smooth(elev, 1.5))
coast = L + (fbm(X, Y, 1 / 900, 3) - .5) * .25
is_land = coast > .5

# texture lookup in world space (1024 px tile == TILE units), 3 variants mixed by large noise
TILE = 700.0
_cache = {}
TS = max(16, min(1024, int(round(TILE / UPP))))  # prefiltered tile size in output px
def tex(kind):
    if kind not in _cache:
        vs = []
        for v in range(3):
            im = Image.open(f"{TEX}/{C}-{kind}-{v}.png").convert("RGB").resize((TS, TS), Image.LANCZOS)
            if v == 2: im = im.transpose(Image.Transpose.ROTATE_90)
            a = np.asarray(im, np.float32)
            blur = np.asarray(im.filter(ImageFilter.GaussianBlur(TS / 24)), np.float32)
            calm = .42 if kind not in ("road", "shore") else .25
            vs.append(a * (1 - calm) + blur * calm)
        _cache[kind] = vs
    vs = _cache[kind]
    def look(t, sc, ox, oy):
        px = (np.floor((X / (TILE * sc)) * TS) + ox).astype(np.int64) % TS
        py = (np.floor((Y / (TILE * sc)) * TS) + oy).astype(np.int64) % TS
        return t[py, px]
    a = np.clip((fbm(X, Y, 1 / 3500, sum(map(ord, kind)), 3) - .5) * 7 + .5, 0, 1)[..., None]
    b = np.clip((fbm(X, Y, 1 / 2700, 13) - .58) * 7 + .5, 0, 1)[..., None]
    t0 = look(vs[0], 1, 0, 0) * (1 - a) + look(vs[1], 1.37, TS // 3, TS // 2) * a
    return t0 * (1 - b) + look(vs[2], .8, TS // 5, TS // 7) * b

SEA_RIVER = {"verdant": (60, 150, 170), "pyra": (255, 105, 25), "aether": (110, 190, 215), "nexus": (50, 110, 150)}[C]
names = {0: "grass", 1: "forest", 2: "mountain", 3: "wetland"}
weights = {}
for bid, k in names.items():
    m = sample(smooth((biome == bid).astype(np.float32), 1.0))
    weights[k] = np.exp(8 * (m + (fbm(X, Y, 1 / 700, 20 + bid) - .5) * .35))
# rock also where elevation is high
weights["mountain"] *= .25 + 8 * np.clip((E - .6) * 5, 0, 1)
texs = {k: tex(k) for k in weights}
for k in weights:
    lum = texs[k].mean(2) / 255
    weights[k] = weights[k] * np.exp(5 * lum)
tot = sum(weights.values())
img = np.zeros((oh, ow, 3), np.float32)
for k, w in weights.items():
    w = (w / tot) ** 3
    weights[k] = w
tot = sum(weights.values())
for k, w in weights.items():
    img += texs[k] * (w / tot)[..., None]

# shore sand band
d_land = coast - .5
sand = np.clip((.2 + (fbm(X, Y, 1 / 1200, 33) - .5) * .2 - d_land) / .05, 0, 1) * is_land
img = img * (1 - sand[..., None]) + tex("shore") * sand[..., None]

# roads on top
road = Image.new("L", (ow, oh), 0); dr = ImageDraw.Draw(road)
for r in P["roads"]:
    q = []
    rp = r["points"]
    for p0, p1 in zip(rp, rp[1:]):
        n = max(1, int(math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 500))
        q += [(p0[0] + (p1[0] - p0[0]) * i / n, p0[1] + (p1[1] - p0[1]) * i / n) for i in range(n)]
    q += [tuple(rp[-1])] if rp else []
    for _ in range(5):
        if len(q) < 3: break
        n = [q[0]]
        for p0, p1 in zip(q, q[1:]):
            n += [(.75 * p0[0] + .25 * p1[0], .75 * p0[1] + .25 * p1[1]), (.25 * p0[0] + .75 * p1[0], .25 * p0[1] + .75 * p1[1])]
        q = n + [q[-1]]
    qa = np.array(q, np.float64)
    if len(qa) > 2:
        mx = (np.array([vnoise(np.array(p[0]), np.array(p[1]), 1 / 1800, 61) for p in q]) - .5) * 700
        my = (np.array([vnoise(np.array(p[0]), np.array(p[1]), 1 / 1800, 62) for p in q]) - .5) * 700
        qa[1:-1, 0] += mx[1:-1]; qa[1:-1, 1] += my[1:-1]
    pts = [((x - x0) / UPP, (y - y0) / UPP) for x, y in qa]
    if len(pts) > 1:
        w = max(2, int(r["width"] * .55 / UPP))
        dr.line(pts, fill=255, width=w, joint="curve")
        for p in pts: dr.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=255)
rm = np.asarray(road.filter(ImageFilter.GaussianBlur(max(1, 60 / UPP))), np.float32) / 255
rm = np.clip((rm - .35 + (fbm(X, Y, 1 / 180, 40) - .5) * .5) * 3, 0, 1) * is_land
img = img * (1 - rm[..., None]) + tex("road") * rm[..., None]

# rivers
if V2:
    riv = unrle(T["river"]).astype(np.float32)
    rw = smooth(np.clip(riv / 3, 0, 1), .9) * 3
    RV = sample(rw)
    rmask = np.clip((RV - .35 + (fbm(X, Y, 1 / 300, 81) - .5) * .15) * 4, 0, 1) * is_land
    bank = np.clip((RV - .2) * 4, 0, 1) * is_land * (1 - rmask)
    if C == "pyra":
        img = img * (1 - bank[..., None] * .7) + tex("mountain") * .6 * bank[..., None] * .7
    else:
        img = img * (1 - bank[..., None] * .55) + tex("shore") * bank[..., None] * .55
    rc = np.array(SEA_RIVER, np.float32)
    rip2 = np.asarray(Image.open(f"{TEX}/aether-sea-2.png").convert("L").resize((TS, TS)), np.float32) / 255
    rr = rip2[(np.floor(Y / TILE * TS)).astype(np.int64) % TS, (np.floor(X / TILE * TS)).astype(np.int64) % TS] - rip2.mean()
    water = rc * (1 + rr[..., None] * .5)
    if C == "pyra":  # lava: dark cooling crust plates over glowing flow
        crust = np.clip((fbm(X, Y, 1 / 160, 91) - .52) * 6, 0, 1)[..., None]
        water = water * (1 - crust * .8) + np.array([45, 30, 28], np.float32) * crust * .8
        bank_col = np.array([40, 34, 34], np.float32)
    img = img * (1 - rmask[..., None]) + water * rmask[..., None]
    sand = np.maximum(sand, bank * 0)  # keep objects off banks via blocked below
    RIVER_BLOCK = (rmask > .05) | (bank > .3)
else:
    RIVER_BLOCK = np.zeros((oh, ow), bool)

# hillshade from elevation
Eg = smooth(elev, 2.0)
dy, dx = np.gradient(Eg)
shade = np.clip(1 + (-dx * 1.0 - dy * 1.0) * 14, .72, 1.22)
img *= sample(shade)[..., None] * 1.0

# sea: depth gradient from coast distance + texture
SEA = {"verdant": ((110, 205, 200), (22, 70, 120)), "pyra": ((90, 170, 165), (25, 45, 70)),
       "aether": ((150, 220, 235), (60, 110, 175)), "nexus": ((70, 170, 190), (25, 30, 80))}[C]
rip = Image.open(f"{TEX}/aether-sea-2.png").convert("L").resize((TS, TS), Image.LANCZOS)
rip = np.asarray(rip, np.float32) / 255
rpx = (np.floor(X / TILE * TS)).astype(np.int64) % TS; rpy = (np.floor(Y / TILE * TS)).astype(np.int64) % TS
ripple = rip[rpy, rpx] - rip.mean()
depth = np.clip((.5 - coast) / .45, 0, 1) ** .7
shallow = np.array(SEA[0], np.float32); deep = np.array(SEA[1], np.float32)
seacol = shallow * (1 - depth[..., None]) + deep * depth[..., None]
seacol = seacol * (1 + ripple[..., None] * (.55 - .3 * depth[..., None]))
seacol *= (.92 + .16 * fbm(X, Y, 1 / 4000, 70))[..., None]
foam = np.exp(-((coast - .5) / .035) ** 2) * (.6 + .4 * fbm(X, Y, 1 / 120, 50))
seacol = seacol * (1 - foam[..., None] * .7) + 245 * foam[..., None] * .7
land_a = np.clip((coast - .5) / .02 + .5, 0, 1)[..., None]
img = img * land_a + seacol * (1 - land_a)


# ---------- scatter objects ----------
import glob, os
OBJ = os.environ.get("OBJ", "objw")
SIZE = {"oak": 520, "tree2": 440, "pine": 380, "bush": 170, "flowerbush": 170, "boulder": 230, "rocks": 200,
        "reeds": 150, "log": 240, "stump": 130, "mushrooms": 100, "fern": 120}
DENS = {  # per 1000x1000 units, by biome
    "forest": {"oak": 5, "tree2": 2.5, "pine": 2.5, "bush": 1.5, "fern": 3, "mushrooms": .6, "log": .4, "stump": .4},
    "grass": {"oak": .25, "tree2": .3, "bush": .5, "flowerbush": .8, "rocks": .15, "stump": .05},
    "mountain": {"boulder": 1.4, "rocks": 1.6, "pine": .5, "bush": .2},
    "wetland": {"reeds": 3.5, "bush": .4, "tree2": .3, "log": .15}}
sprites = {}
for k in SIZE:
    fs = sorted(glob.glob(f"{OBJ}/{C}-{k}-[0-9].png"))
    sprites[k] = [Image.open(f).convert("RGBA") for f in fs]
blocked = (rm > .05) | (sand > .05) | (~is_land) | RIVER_BLOCK
for st in P["settlements"]:
    b = st["bounds"]; bx, by = int((b["x"] - x0) / UPP), int((b["y"] - y0) / UPP)
    blocked[max(0, by):max(0, by + int(b["height"] / UPP)), max(0, bx):max(0, bx + int(b["width"] / UPP))] = True
bw = {k: weights[k] / tot for k in names.values()}
cands = []
CS = 1000
for cy in range(int(y0 // CS), int((y0 + H) // CS) + 1):
    for cx in range(int(x0 // CS), int((x0 + W) // CS) + 1):
        rng = np.random.default_rng([cx + 100000, cy + 100000, sum(map(ord, C))])
        for biome_name, dd in DENS.items():
            for k, dn in dd.items():
                if not sprites.get(k): continue
                n = rng.poisson(dn * (1.6 if biome_name == "forest" else 1))
                for _ in range(n):
                    wx_, wy_ = cx * CS + rng.random() * CS, cy * CS + rng.random() * CS
                    sc = .75 + rng.random() * .5; vi = rng.integers(len(sprites[k])); fl = rng.random() < .5
                    cands.append((wy_, wx_, k, biome_name, sc, vi, fl))
cands.sort()
base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGBA")
shadow = Image.new("L", base.size, 0); sd = ImageDraw.Draw(shadow)
placed = []
for wy_, wx_, k, bn, sc, vi, fl in cands:
    px_, py_ = int((wx_ - x0) / UPP), int((wy_ - y0) / UPP)
    if not (0 <= px_ < ow and 0 <= py_ < oh) or blocked[py_, px_]: continue
    if bw[bn][py_, px_] < .55: continue
    sz = SIZE[k] * sc / UPP
    if sz < 3: continue
    placed.append((px_, py_, k, vi, fl, sz))
    sd.ellipse([px_ - sz * .42, py_ - sz * .12, px_ + sz * .42, py_ + sz * .12], fill=110)
shadow = shadow.filter(ImageFilter.GaussianBlur(max(1, 30 / UPP)))
dark = Image.new("RGBA", base.size, (20, 35, 25, 255))
base = Image.composite(dark, base, shadow.point(lambda v: int(v * .55)))
for px_, py_, k, vi, fl, sz in placed:
    sp = sprites[k][vi]
    if fl: sp = sp.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    w_ = int(sz); h_ = max(1, int(sp.height * w_ / sp.width))
    sp = sp.resize((max(1, w_), h_), Image.LANCZOS)
    base.alpha_composite(sp, (int(px_ - w_ / 2), int(py_ - h_ * .92)))
img = np.asarray(base.convert("RGB"), np.float32)
print("objects", len(placed), flush=True)
# paste painted settlements
for st in P["settlements"]:
    fp = f"cities/{st['id']}.jpg"
    if not os.path.exists(fp): continue
    b = st["bounds"]; bx, by = (b["x"] - x0) / UPP, (b["y"] - y0) / UPP
    bw_, bh_ = int(b["width"] / UPP), int(b["height"] / UPP)
    if bx + bw_ < 0 or by + bh_ < 0 or bx > ow or by > oh or bw_ < 4: continue
    ci = Image.open(fp).convert("RGB").resize((bw_, bh_), Image.LANCZOS)
    # harmonize colors with surrounding terrain (partial mean/std transfer)
    x0i, y0i = max(0, int(bx) - bw_ // 4), max(0, int(by) - bh_ // 4)
    ring = img[y0i:int(by) + bh_ + bh_ // 4, x0i:int(bx) + bw_ + bw_ // 4].reshape(-1, 3)
    if ring.size:
        ca = np.asarray(ci, np.float32); cm, cs = ca.reshape(-1, 3).mean(0), ca.reshape(-1, 3).std(0) + 1
        tm, ts = ring.mean(0), ring.std(0) + 1
        k = .35
        ca = (ca - cm) * (1 - k + k * ts / cs) + cm * (1 - k) + tm * k
        ci = Image.fromarray(np.clip(ca, 0, 255).astype(np.uint8))
    fe = max(2, int(min(bw_, bh_) * .10))
    mk = Image.new("L", (bw_, bh_), 0); ImageDraw.Draw(mk).rounded_rectangle([fe, fe, bw_ - fe, bh_ - fe], radius=fe * 2, fill=255)
    mk = mk.filter(ImageFilter.GaussianBlur(fe * .6))
    bimg = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    bimg.paste(ci, (int(bx), int(by)), mk)
    img = np.asarray(bimg, np.float32)

Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(OUT, quality=88)
np.save(OUT + ".mask.npy", np.stack([coast, E]).astype(np.float16)) if ow * oh < 30e6 else None
print("saved", OUT)
