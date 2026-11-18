"""Terrain data of the four capital city zones (4000 x 2500 game units, no buildings): height map, control map (texture layers) and the texture set made from the
game's OWN accepted ground textures (ports/godot-pyra/assets/lands/<land>/terrain/*.webp), for Terrain3D (render.gd).
  python3 gen_capital.py LAND LANDS_DIR OUT_DIR       LAND = pyra | nexus | aether | verdant
Writes height.f32, control.f32, tex_<i>_albedo.png / tex_<i>_normal.png (i = 0..7), config.json. 1 Godot unit = 1 game unit."""
import sys, json
from pathlib import Path
import numpy as np
from scipy import ndimage
from PIL import Image

LAND, LANDS, OUT = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]); OUT.mkdir(parents=True, exist_ok=True)
ZX, ZY = 4000.0, 2500.0
PAD = 1500.0                         # the mountains / sea around the zone
STEP = 4.0
X0, X1, Y0, Y1 = -ZX / 2 - PAD, ZX / 2 + PAD, -ZY / 2 - PAD, ZY / 2 + PAD
NX, NY = int((X1 - X0) / STEP), int((Y1 - Y0) / STEP)
xs = X0 + (np.arange(NX) + .5) * STEP; ys = Y0 + (np.arange(NY) + .5) * STEP        # row 0 = north edge (y up in the picture = north)
XX, YY = np.meshgrid(xs, ys)
def P(u, v): return (-ZX / 2 + u * ZX, -ZY / 2 + v * ZY)            # normalised (u east, v south) -> units (x east, y: row coordinate, v south)

# role order: 0 base, 1 alt, 2 rock, 3 detail, 4 plaza/paving, 5 road, 6 side road, 7 shore
TEX = {"pyra": ["b0", "b3", "b2", "over2", "b1", "road2", "road1", "shore"], "verdant": ["b0", "b1", "b2", "b3", "b2", "road0", "road1", "shore"],
       "aether": ["b0", "b1", "b2", "over2", "b2", "road0", "road2", "shore"], "nexus": ["b0", "b1", "b2", "b3", "road0", "road3", "road1", "shore"]}
EXTRA = {"water": "water", "pyra": "special"}
# ------------------------------------------------------------------ layouts after the reference plans: plateaus (polygon, height), roads (polyline, width), water
L = {
 "pyra": {   # Twierdza Popiołu: citadel plateau top-left, market below the gate, forges on a terrace at the lava river, stairs-road diagonal
   "plateaus": [([(.14, .05), (.46, .05), (.5, .3), (.42, .4), (.16, .38)], 170), ([(.1, .55), (.42, .52), (.46, .78), (.18, .9), (.08, .8)], 30), ([(.62, .45), (.9, .42), (.93, .8), (.66, .86)], 60)],
   "roads": [([(.02, .98), (.12, .9), (.2, .8), (.26, .66)], 150), ([(.26, .66), (.36, .56), (.5, .46), (.62, .36), (.78, .26), (.96, .1)], 190), ([(.3, .3), (.4, .22), (.48, .12)], 130), ([(.5, .46), (.62, .6), (.72, .7)], 120),
             ([(.16, .62), (.3, .72), (.4, .64)], 110), ([(.72, .7), (.86, .64), (.9, .52)], 100)],
   "water": ([(.98, .15), (.96, .35), (.9, .55), (.84, .75), (.78, .9), (.6, 1.0), (.3, 1.04)], 150, -50), "water_kind": "lava", "mountain": 480, "ground_wobble": 14},
 "nexus": {  # Węzeł Świadomości: admin plateau top-right with the energy core, lower docks at the sea (bottom-left), zigzag corridors between the levels
   "plateaus": [([(.58, .04), (.96, .05), (.97, .42), (.6, .44)], 230), ([(.1, .55), (.5, .6), (.52, .96), (.08, .98)], 40), ([(.14, .06), (.4, .06), (.44, .3), (.16, .34)], 120)],
   "roads": [([(.6, .24), (.5, .34), (.36, .42), (.3, .5), (.36, .58)], 130), ([(.36, .58), (.2, .62), (.14, .72)], 120), ([(.3, .24), (.4, .36), (.52, .42)], 110), ([(.2, .75), (.5, .75), (.78, .8), (.95, .9)], 160), ([(.7, .44), (.78, .6), (.84, .8)], 110), ([(.3, .2), (.2, .2)], 110)],
   "water": ([(-.1, .55), (.08, .6), (.1, .8), (.06, .98), (-.1, 1.1)], 0, -60), "water_kind": "sea", "mountain": 380, "ground_wobble": 9},
 "aether": { # Sanktuarium Tysiąca Źródeł: lower town (bottom-left) -> learning terraces -> upper sanctuary (top-right) with spring pools
   "plateaus": [([(.02, .6), (.5, .55), (.55, .95), (.02, .98)], 0), ([(.18, .3), (.6, .28), (.64, .55), (.2, .56)], 90), ([(.5, .04), (.94, .05), (.97, .3), (.55, .34)], 190)],
   "roads": [([(.05, .95), (.2, .85), (.3, .72), (.36, .6)], 160), ([(.36, .6), (.4, .45), (.52, .32), (.66, .22), (.8, .16)], 150), ([(.1, .72), (.3, .78), (.5, .8)], 110), ([(.3, .72), (.5, .66), (.56, .6)], 100)],
   "pools": [((.62, .12), 260), ((.76, .2), 200), ((.84, .1), 170)], "water": None, "water_kind": "springs", "mountain": 540, "ground_wobble": 11},
 "verdant": {# Zielona Przystań: river through the middle (north-east to south-west), market on the left bank, orchards and garden houses on the right
   "plateaus": [], "roads": [([(.02, .62), (.2, .55), (.36, .5)], 150), ([(.28, .1), (.28, .5), (.3, .98)], 130), ([(.62, .48), (.8, .5), (.97, .52)], 130), ([(.62, .48), (.7, .7), (.76, .98)], 100)],
   "water": ([(.72, -.1), (.62, .12), (.52, .3), (.45, .46), (.4, .62), (.28, .82), (.2, 1.1)], 330, -25), "water_kind": "river", "bridge": (.5, .38), "mountain": 360, "ground_wobble": 12}}
CFG = L[LAND]
def to_units(pts): return [P(u, v) for u, v in pts]
def poly_mask(pts):
    from PIL import ImageDraw
    img = Image.new("L", (NX, NY), 0); ImageDraw.Draw(img).polygon([((x - X0) / STEP, (y - Y0) / STEP) for x, y in to_units(pts)], fill=255); return np.asarray(img) > 0
def line_dist(pts):
    from PIL import ImageDraw
    img = Image.new("L", (NX, NY), 255); ImageDraw.Draw(img).line([((x - X0) / STEP, (y - Y0) / STEP) for x, y in to_units(pts)], fill=0, width=1)
    return ndimage.distance_transform_edt(np.asarray(img) > 0) * STEP
def fbm(shape, scale, seed, octaves=5):
    r = np.random.default_rng(seed); out = np.zeros(shape); amp = 1.0; tot = 0
    for o in range(octaves):
        s = max(2, int(shape[0] / scale * 2 ** o)); g = r.random((s + 2, int(s * shape[1] / shape[0]) + 2))
        out += amp * ndimage.zoom(g, (shape[0] / g.shape[0], shape[1] / g.shape[1]), order=3)[:shape[0], :shape[1]]; tot += amp; amp *= .5
    out /= tot; return (out - out.min()) / (out.max() - out.min())
# ------------------------------------------------------------------ height
inside = (np.abs(XX) < ZX / 2) & (np.abs(YY) < ZY / 2)
H = (fbm((NY, NX), 10, 1) - .5) * 2 * CFG["ground_wobble"]
for poly, ht in CFG["plateaus"]:
    m = ndimage.gaussian_filter(poly_mask(poly).astype(float), 10); H += m * ht * 2.6
# mountains / outer ring (only outside the zone, and on the far sides): the zone itself stays open and walkable
dx = np.maximum(np.abs(XX) - ZX / 2, 0); dy = np.maximum(np.abs(YY) - ZY / 2, 0); out = np.hypot(dx, dy)
far = np.clip(1 - (XX - YY) / (ZX), .25, 1) if LAND != "nexus" else np.clip(1 - (XX - YY) / (ZX), .1, 1)
H += (1 - np.exp(-(out / 650) ** 1.6)) * CFG["mountain"] * 0.85 * far * (.6 + .8 * fbm((NY, NX), 6, 2))
water_mask = np.zeros((NY, NX), bool)
if CFG.get("water"):
    pts, width, depth = CFG["water"]
    if LAND == "nexus": water_mask = poly_mask(pts)                        # sea
    else: water_mask = line_dist(pts) < width / 2                           # river / lava river
    wm = ndimage.gaussian_filter(water_mask.astype(float), 14 / STEP * 3); H = H * (1 - wm) + (depth + H * .1) * wm
if LAND == "aether":
    for (u, v), r in CFG["pools"]:
        cx, cy = P(u, v); d = np.hypot(XX - cx, YY - cy); pool = d < r; H -= ndimage.gaussian_filter(pool.astype(float), 6) * 30; water_mask |= pool
roads = np.full((NY, NX), 1e9); sides = np.full((NY, NX), 1e9)
for k, (pts, wd) in enumerate(CFG["roads"]):
    wd = wd * 1.5; d = line_dist(pts); m = np.clip(1 - np.maximum(d - wd / 2, 0) / 90, 0, 1)
    roads = np.minimum(roads, d / wd * 2 if k < 2 else 1e9); sides = np.minimum(sides, d / wd * 2 if k >= 2 else 1e9)
    H = H * (1 - .55 * m) + ndimage.gaussian_filter(H, 30) * .55 * m           # roads follow the ground, a little flattened
H = ndimage.gaussian_filter(H, 1.2)
# ------------------------------------------------------------------ control map
slope = np.hypot(*np.gradient(H, STEP, STEP)); wobble = fbm((NY, NX), 8, 5); wob2 = fbm((NY, NX), 40, 6)
W = np.zeros((8, NY, NX), np.float32)
W[0] += 1.4 + .5 * wobble
W[1] += np.clip(wob2 * 2.2 - 1.0, 0, 1) * 1.7                                # alt ground in large soft patches
W[3] += np.clip(wobble * 2.4 - 1.5, 0, 1) * 1.4                              # detail speckle
W[2] += np.clip(slope * 5 - .8, 0, 3) * 2 + (H > 260) * .6
for poly, ht in CFG["plateaus"]: W[4] += poly_mask(poly) * .5 * ((np.arange(1)[0] == 0))     # paved top of plateaus
if LAND in ("verdant", "aether", "nexus"): W[4] += (poly_mask([(.2, .35), (.5, .35), (.5, .6), (.2, .6)]) if LAND == "verdant" else 0) * 1.0
W[5] += np.where(roads < 1.0, 4.0, 0) * np.clip(1.3 - roads, 0, 1); W[6] += np.where(sides < 1.0, 3.6, 0) * np.clip(1.3 - sides, 0, 1)
shore = ndimage.binary_dilation(water_mask, iterations=int(70 / STEP)) & ~water_mask; W[7] += shore * 2.6
W[5] += (ndimage.gaussian_filter((roads < 1.25).astype(float), 2) > .3) * .6
W = np.stack([ndimage.gaussian_filter(w, 2.0) for w in W])
order = np.argsort(-W, axis=0); base = order[0]; over = order[1]
wb = np.take_along_axis(W, base[None], 0)[0]; wo = np.take_along_axis(W, over[None], 0)[0]
blend = (np.clip(wo / np.maximum(wb + wo, 1e-4) * 1.2 - .05, 0, 1) * 255).astype(np.uint32)
ctrl = (base.astype(np.uint32) << 27) | (over.astype(np.uint32) << 22) | (blend << 14)
H.astype("<f4").tofile(OUT / "height.f32"); ctrl.astype("<u4").view("<f4").tofile(OUT / "control.f32")
# ------------------------------------------------------------------ textures (the game's own)
SZ = 1024
def load_tile(name):
    im = Image.open(LANDS / LAND / "terrain" / f"{name}.webp").convert("RGB")
    if im.size[1] < im.size[0] * 0.6:       # a road strip: stack it with alternate mirroring into a square tile
        rows = []; k = 0
        while sum(r.size[1] for r in rows) < im.size[0]:
            rows.append(im if k % 2 == 0 else im.transpose(Image.FLIP_TOP_BOTTOM)); k += 1
        sheet = Image.new("RGB", (im.size[0], sum(r.size[1] for r in rows))); y = 0
        for r in rows: sheet.paste(r, (0, y)); y += r.size[1]
        im = sheet.crop((0, 0, im.size[0], im.size[0]))
    return im.resize((SZ, SZ), Image.LANCZOS)
for i, name in enumerate(TEX[LAND]):
    a = np.asarray(load_tile(name)).astype(np.float32) / 255
    lum = a @ np.array([.3, .59, .11]); h = ndimage.gaussian_filter(lum, 1.0)
    gx = np.roll(h, -1, 1) - np.roll(h, 1, 1); gy = np.roll(h, -1, 0) - np.roll(h, 1, 0); n = np.dstack([-gx * 2.0, gy * 2.0, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    Image.fromarray((np.dstack([a, lum]) * 255).astype(np.uint8), "RGBA").save(OUT / f"tex_{i}_albedo.png")
    Image.fromarray((np.dstack([n * .5 + .5, np.full_like(h, .85)]) * 255).astype(np.uint8), "RGBA").save(OUT / f"tex_{i}_normal.png")
extra = Image.open(LANDS / LAND / "terrain" / ("special.webp" if LAND == "pyra" else "water.webp")).convert("RGB").resize((SZ, SZ)); extra.save(OUT / "water.png")
json.dump({"land": LAND, "nx": NX, "ny": NY, "step": STEP, "x0": X0, "y0": Y0, "zone": [ZX, ZY], "water_kind": CFG["water_kind"], "water_level": (CFG["water"][2] + 8) if CFG.get("water") else (-6 if LAND == "aether" else 0),
           "pools": [list(P(u, v)) + [r] for (u, v), r in CFG.get("pools", [])], "uv": {"pyra": 1 / 640, "verdant": 1 / 768, "aether": 1 / 640, "nexus": 1 / 620}[LAND], "hmin": float(H.min()), "hmax": float(H.max())}, open(OUT / "config.json", "w"))
print("OK", LAND, NX, NY, round(float(H.min())), round(float(H.max())))
