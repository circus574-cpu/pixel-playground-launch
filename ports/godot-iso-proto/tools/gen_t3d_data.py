"""Data for Terrain3D (Godot): heightmap, control map (texture ids and blends) and eight tiling PBR-ish textures, all generated procedurally (NumPy/SciPy/Pillow/OpenCV).
  python3 gen_t3d_data.py OUT_DIR
Writes height.f32, control.f32, meta.json, tex_<name>_albedo.png (alpha = height) and tex_<name>_normal.png (alpha = roughness)."""
import sys, json, math, struct
from pathlib import Path
import numpy as np
from scipy import ndimage
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
from zp_world import river_cx, river_half, height, smooth, hnoise

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
RNG = np.random.default_rng(11)
STEP = 0.25
X0, X1, Y0, Y1 = -72.0, 82.0, -68.0, 52.0
NX, NY = int((X1 - X0) / STEP), int((Y1 - Y0) / STEP)
xs = X0 + (np.arange(NX) + 0.5) * STEP; ys = Y1 - (np.arange(NY) + 0.5) * STEP    # row 0 = north (godot z = -y)

# ------------------------------------------------------------------ textures
def fbm(size, beta=2.0, seed=0, cutoff=None):
    """periodic 1/f^beta noise, 0..1"""
    r = np.random.default_rng(seed); f = np.fft.fftfreq(size)[:, None] ** 2 + np.fft.fftfreq(size)[None, :] ** 2; f[0, 0] = 1
    spec = (r.normal(size=(size, size)) + 1j * r.normal(size=(size, size))) / (f ** (beta / 2))
    if cutoff: spec *= np.exp(-f * cutoff)
    n = np.real(np.fft.ifft2(spec)); n = (n - n.min()) / (n.max() - n.min()); return n
def ridged(size, beta=2.2, seed=0):
    n = fbm(size, beta, seed) * 2 - 1; return 1 - np.abs(n)
def normals(h, strength=3.0):
    gx = np.roll(h, -1, 1) - np.roll(h, 1, 1); gy = np.roll(h, -1, 0) - np.roll(h, 1, 0)
    n = np.dstack([-gx * strength, gy * strength, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True); return n * .5 + .5
def mix(a, b, t): return a * (1 - t[..., None]) + b * t[..., None]
def col(h): return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)]) / 255.0
def make_textures(size=1024):
    T = {}
    lo, mid, hi = fbm(size, 3.0, 1), fbm(size, 2.0, 2), fbm(size, 0.8, 3)
    # grass: blades (fine ridged noise), patches of lighter and yellower grass
    blades = ridged(size, 1.0, 4) ** 3
    a = mix(np.broadcast_to(col("22431c"), (size, size, 3)).copy(), np.broadcast_to(col("4a7a2d"), (size, size, 3)).copy(), np.clip(mid * 1.1 - .1, 0, 1))
    a = mix(a, np.broadcast_to(col("6f8236"), (size, size, 3)).copy(), np.clip(lo * 1.6 - .9, 0, .35)); a *= (.82 + .3 * blades[..., None] + .1 * hi[..., None] - .05)
    T["grass"] = (np.clip(a, 0, 1), np.clip(blades * .6 + mid * .4, 0, 1), np.full((size, size), .9))
    # dirt: brown, pebbles (thresholded noise), cart-track darker patches
    peb = (fbm(size, .3, 5) > .86).astype(float); peb = ndimage.gaussian_filter(peb, 1.2)
    a = mix(np.broadcast_to(col("7a5a3a"), (size, size, 3)).copy(), np.broadcast_to(col("a98660"), (size, size, 3)).copy(), np.clip(mid * 1.3 - .15, 0, 1)); a = a * (.86 + .22 * hi[..., None]) + peb[..., None] * .13
    T["dirt"] = (np.clip(a, 0, 1), np.clip(mid * .5 + peb * .5, 0, 1), np.full((size, size), .95))
    # rock: blue-grey strata with dark cracks and lighter ledges
    crack = .45 * ridged(size, 2.4, 6) ** 6; strata = .5 + .5 * np.sin((fbm(size, 3.2, 7) * 5 + np.linspace(0, 3, size)[:, None]) * 2.0)
    a = mix(np.broadcast_to(col("353a46"), (size, size, 3)).copy(), np.broadcast_to(col("767c86"), (size, size, 3)).copy(), np.clip(.6 * mid + .4 * strata, 0, 1)); a = a * (1 - .55 * crack[..., None]) * (.88 + .2 * hi[..., None])
    T["rock"] = (np.clip(a, 0, 1), np.clip(.5 * mid + .5 * strata - crack * .6, 0, 1), np.full((size, size), .92))
    # sand
    rip = .5 + .5 * np.sin(fbm(size, 3.0, 8) * 40); grains = fbm(size, .2, 9)
    a = mix(np.broadcast_to(col("c9b78a"), (size, size, 3)).copy(), np.broadcast_to(col("e6d7aa"), (size, size, 3)).copy(), np.clip(mid + .3 * rip - .3, 0, 1)) * (.95 + .08 * grains[..., None])
    T["sand"] = (np.clip(a, 0, 1), np.clip(rip * .3 + mid * .2, 0, 1), np.full((size, size), .98))
    # cobble: offset-row stones, rounded, with dark joints
    n = 30; yy, xx = np.mgrid[0:size, 0:size] / size * n; row = np.floor(yy); xo = xx + (row % 2) * .5
    cx = np.floor(xo) + .5; cy = row + .5; u = (xo - cx) * 2; v = (yy - cy) * 2.4; d = np.maximum(np.abs(u) ** 4.0 + np.abs(v) ** 4.0, 0) ** (1 / 4.0)
    rid = (np.floor(xo) * 7 + row * 13) % 5; tone = (np.array([.46, .5, .43, .53, .48])[rid.astype(int)] + .10 * (mid - .5))
    stone = np.dstack([tone * 1.05, tone * .98, tone * .9]); joint = np.clip((d - .86) * 9, 0, 1)
    a = stone * (1 - joint[..., None] * .7) * (.9 + .15 * hi[..., None]) * np.clip(1.1 - d * .25, .75, 1)[..., None]
    T["cobble"] = (np.clip(a, 0, 1), np.clip(1 - d * .9, 0, 1), np.full((size, size), .85))
    # water bed: teal with caustic light lines
    c1 = ridged(size, 2.0, 10) ** 5; c2 = ridged(size, 2.0, 11) ** 5
    a = mix(np.broadcast_to(col("155a72"), (size, size, 3)).copy(), np.broadcast_to(col("34929f"), (size, size, 3)).copy(), np.clip(mid * 1.2 - .1, 0, 1)); a = a + (c1 + c2)[..., None] * np.array([.18, .26, .24])
    T["water"] = (np.clip(a, 0, 1), np.clip(mid * .2, 0, 1), np.full((size, size), .12))
    # moss / wet rock
    a = mix(np.broadcast_to(col("2c3a30"), (size, size, 3)).copy(), np.broadcast_to(col("56703a"), (size, size, 3)).copy(), np.clip(mid * 1.5 - .3, 0, 1)) * (.8 + .3 * blades[..., None])
    T["moss"] = (np.clip(a, 0, 1), np.clip(mid * .7 + .2 * blades, 0, 1), np.full((size, size), .7))
    # gravel
    g = fbm(size, .15, 12); gg = ndimage.gaussian_filter((g > .8).astype(float), 1.4)
    a = mix(np.broadcast_to(col("77705f"), (size, size, 3)).copy(), np.broadcast_to(col("b3aa93"), (size, size, 3)).copy(), np.clip(mid + gg * .5 - .3, 0, 1)) * (.9 + .2 * hi[..., None])
    T["gravel"] = (np.clip(a, 0, 1), np.clip(gg * .8 + mid * .2, 0, 1), np.full((size, size), .93))
    return T
NAMES = ["grass", "dirt", "rock", "sand", "cobble", "water", "moss", "gravel"]
T = make_textures()
for name in NAMES:
    alb, hmap, rough = T[name]
    Image.fromarray((np.dstack([alb, hmap]) * 255).astype(np.uint8), "RGBA").save(OUT / f"tex_{name}_albedo.png")
    nrm = normals(hmap, 3.0); Image.fromarray((np.dstack([nrm, rough]) * 255).astype(np.uint8), "RGBA").save(OUT / f"tex_{name}_normal.png")

# ------------------------------------------------------------------ heightmap and control map
Z = np.empty((NY, NX), np.float32)
for j, y in enumerate(ys):
    for i, x in enumerate(xs): Z[j, i] = height(x, y)
gy, gx = np.gradient(Z, STEP, STEP); slope = np.hypot(gx, gy)
X, Y = np.meshgrid(xs, ys)
nz1 = ndimage.zoom(fbm(256, 2.4, 21), (NY / 256, NX / 256), order=1)[:NY, :NX]; nz2 = ndimage.zoom(fbm(256, 1.2, 22), (NY / 256, NX / 256), order=1)[:NY, :NX]
CX = np.vectorize(river_cx)(Y); HW = np.vectorize(river_half)(Y); D = X - CX; A = np.abs(D)
plaza = (D < 0) & (X > -26) & (X < -9) & (Y > -20) & (Y < 14)
road = ((D < 0) & (np.abs(Y - (-4 + .18 * (X + 15))) < 1.7) & (X > -34)) | ((D < 0) & (np.abs(X + 14) < 1.5) & (Y > -22) & (Y < 22)) | ((D > 0) & (np.abs(Y - 2) < 1.2) & (X > 9) & (X < 36))
IDX = {n: i for i, n in enumerate(NAMES)}
W = np.zeros((len(NAMES), NY, NX), np.float32)
water = A < HW - .2
W[IDX["water"]] += water * 3
shore = (~water) & (A < HW + 1.6); W[IDX["sand"]] += shore * (1.2 + .6 * nz2); W[IDX["gravel"]] += shore * (.6 + .5 * nz1)
rocky = (slope > .85) | (Z > 8.5); W[IDX["rock"]] += rocky * 2.2 * (.7 + .5 * nz1) + np.clip(slope - .5, 0, 1) * 1.4
wetcliff = (~water) & (A < HW + 2.8) & (slope > .55); W[IDX["moss"]] += wetcliff * 1.6
W[IDX["cobble"]] += plaza * 2.2; W[IDX["dirt"]] += (road & ~plaza) * 2.4 + plaza * .3 * nz1
meadow = ~(water | shore | rocky | plaza | road)
W[IDX["grass"]] += meadow * (1.6 + .4 * nz1); W[IDX["dirt"]] += meadow * np.clip(nz2 - .7, 0, 1) * 1.8; W[IDX["moss"]] += meadow * np.clip(nz1 - .75, 0, 1) * 2.0
W[IDX["grass"]] += (road | plaza) * .25 * (D > 0)
W = np.stack([ndimage.gaussian_filter(w, 3.0) for w in W])   # soft transitions between layers
order = np.argsort(-W, axis=0); base = order[0]; over = order[1]
wb = np.take_along_axis(W, base[None], 0)[0]; wo = np.take_along_axis(W, over[None], 0)[0]
blend = np.clip(wo / np.maximum(wb + wo, 1e-4), 0, 1); blend = (np.clip(blend * 1.15 - .1, 0, 1) * 255).astype(np.uint32)
ctrl = (base.astype(np.uint32) << 27) | (over.astype(np.uint32) << 22) | (blend << 14)
Z = ndimage.gaussian_filter(Z, 1.6).astype(np.float32)   # soft terraces and banks
Z.astype("<f4").tofile(OUT / "height.f32"); ctrl.astype("<u4").view("<f4").tofile(OUT / "control.f32")
json.dump({"nx": NX, "ny": NY, "step": STEP, "x0": X0, "y1": Y1, "names": NAMES, "zmin": float(Z.min()), "zmax": float(Z.max())}, open(OUT / "meta.json", "w"))
print("OK", NX, NY, float(Z.min()), float(Z.max()))
