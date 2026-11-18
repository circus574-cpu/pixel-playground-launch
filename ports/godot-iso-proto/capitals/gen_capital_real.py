"""The REAL capitals: Terrain3D data built directly from the game's own capital geometry (ports/godot-pyra): the biome map (ctrl-biome), the road network (road-mask, road-class)
and the capital bounds from land.json. The roads, biomes and the position of the capital are the game's; only the relief is added (gentle, the game itself is flat), and the ground
textures are the game's accepted ones (assets/lands/<land>/terrain). No buildings.
  python3 gen_capital_real.py LAND GODOT_PROJECT_DIR OUT_DIR        LAND = pyra | nexus | aether | verdant
Writes height.f32, control.f32, tex_<i>_albedo/normal.png (i = 0..7: b0 b1 b2 b3 road0..3), water.png, config.json. 1 Godot unit = 1 game unit."""
import sys, json
from pathlib import Path
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw

LAND, GP, OUT = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]); OUT.mkdir(parents=True, exist_ok=True)
STEP = 4.0; MARGIN = 450.0
land = json.load(open(GP / "data/lands" / LAND / "land.json")); cap = [s for s in land["settlements"] if s["kind"] == "capital"][0]; B = cap["bounds"]
WW, WH = land["width"], land["height"]
X0, Y0 = B["x"] - MARGIN, B["y"] - MARGIN; CW, CH = B["width"] + 2 * MARGIN, B["height"] + 2 * MARGIN
NX, NY = int(CW / STEP), int(CH / STEP)
def crop(name, mode):
    im = Image.open(GP / "assets/lands" / LAND / f"{name}.png"); sx = im.size[0] / WW; sy = im.size[1] / WH
    box = (X0 * sx, Y0 * sy, (X0 + CW) * sx, (Y0 + CH) * sy)
    return im.convert(mode).resize((NX, NY), Image.BILINEAR, box=box)
bio = np.asarray(crop("ctrl-biome", "RGB")).astype(np.float32) / 255
road = np.asarray(crop("road-mask", "L")).astype(np.float32) / 255
cls_img = Image.open(GP / "assets/lands" / LAND / "road-class.png").convert("L"); sx = cls_img.size[0] / WW; sy = cls_img.size[1] / WH
cls = np.asarray(cls_img.resize((NX, NY), Image.NEAREST, box=(X0 * sx, Y0 * sy, (X0 + CW) * sx, (Y0 + CH) * sy)))
# biome weights: red / green / blue = b0 / b1 / b2, black = b3 (the game's own encoding of ctrl-biome); soft transitions
Wb = np.zeros((8, NY, NX), np.float32)
Wb[0] = bio[..., 0]; Wb[1] = bio[..., 1]; Wb[2] = bio[..., 2]; Wb[3] = np.clip(1 - bio.sum(axis=2), 0, 1)
rng = np.random.default_rng(5)
def fbm(shape, scale, seed, octaves=4):
    r = np.random.default_rng(seed); out = np.zeros(shape); amp = 1.0; tot = 0
    for o in range(octaves):
        s = max(2, int(shape[0] / scale * 2 ** o)); g = r.random((s + 2, int(s * shape[1] / shape[0]) + 2))
        out += amp * ndimage.zoom(g, (shape[0] / g.shape[0], shape[1] / g.shape[1]), order=3)[:shape[0], :shape[1]]; tot += amp; amp *= .5
    out /= tot; return (out - out.min()) / (out.max() - out.min())
Wb[:4] = np.stack([ndimage.gaussian_filter(w, 5) for w in Wb[:4]])
Wb[:4] *= (.8 + .4 * fbm((NY, NX), 12, 1))[None]
# roads: the road mask, painted with the road class of the nearest class cell (20 -> road0, 60 -> road1, 100 -> road2, 140 -> road3)
rm = ndimage.gaussian_filter(road, 1.5); rcls = np.zeros((NY, NX), np.int32)
for v, k in ((20, 0), (60, 1), (100, 2), (140, 3)):
    rcls[cls == v] = k + 1
# nearest class for road pixels that fall on a class-0 cell
idx = ndimage.distance_transform_edt(rcls == 0, return_distances=False, return_indices=True); rcls_filled = rcls[idx[0], idx[1]]
for k in range(4): Wb[4 + k] += (rm > .35) * (rcls_filled == k + 1) * 6.0 * np.clip(rm * 1.4, 0, 1)
Wb[4:] = np.stack([ndimage.gaussian_filter(w, 1.4) for w in Wb[4:]])
order = np.argsort(-Wb, axis=0); base = order[0]; over = order[1]
wb = np.take_along_axis(Wb, base[None], 0)[0]; wo = np.take_along_axis(Wb, over[None], 0)[0]
blend = (np.clip(wo / np.maximum(wb + wo, 1e-4) * 1.15 - .05, 0, 1) * 255).astype(np.uint32)
ctrl = (base.astype(np.uint32) << 27) | (over.astype(np.uint32) << 22) | (blend << 14)
# relief: gentle (the game is flat): low hills by biome, roads follow them softly
H = (fbm((NY, NX), 9, 2) - .5) * 70 + (fbm((NY, NX), 3, 3) - .5) * 16
H = H * (1 - .6 * np.clip(rm * 1.5, 0, 1)) + ndimage.gaussian_filter(H, 12) * .6 * np.clip(rm * 1.5, 0, 1)
H.astype("<f4").tofile(OUT / "height.f32"); ctrl.astype("<u4").view("<f4").tofile(OUT / "control.f32")
# textures: the game's own
names = ["b0", "b1", "b2", "b3", "road0", "road1", "road2", "road3"]
SZ = 1024
def load_tile(name):
    p = GP / "assets/lands" / LAND / "terrain" / f"{name}.webp"
    if not p.exists(): p = GP / "assets/lands" / LAND / "terrain" / "road0.webp"
    im = Image.open(p).convert("RGB")
    if im.size[1] < im.size[0] * 0.6:
        rows = []; k = 0
        while sum(r.size[1] for r in rows) < im.size[0]:
            rows.append(im if k % 2 == 0 else im.transpose(Image.FLIP_TOP_BOTTOM)); k += 1
        sheet = Image.new("RGB", (im.size[0], sum(r.size[1] for r in rows))); y = 0
        for r in rows: sheet.paste(r, (0, y)); y += r.size[1]
        im = sheet.crop((0, 0, im.size[0], im.size[0]))
    return im.resize((SZ, SZ), Image.LANCZOS)
for i, name in enumerate(names):
    a = np.asarray(load_tile(name)).astype(np.float32) / 255
    if name.startswith("road"): a = np.clip(a * 0.80, 0, 1)        # road beds a little darker than the ground so the network reads
    lum = a @ np.array([.3, .59, .11]); h = ndimage.gaussian_filter(lum, 1.0)
    gx = np.roll(h, -1, 1) - np.roll(h, 1, 1); gy = np.roll(h, -1, 0) - np.roll(h, 1, 0); n = np.dstack([-gx * 2.0, gy * 2.0, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    Image.fromarray((np.dstack([a, lum]) * 255).astype(np.uint8), "RGBA").save(OUT / f"tex_{i}_albedo.png")
    Image.fromarray((np.dstack([n * .5 + .5, np.full_like(h, .85)]) * 255).astype(np.uint8), "RGBA").save(OUT / f"tex_{i}_normal.png")
Image.open(GP / "assets/lands" / LAND / "terrain" / "water.webp").convert("RGB").resize((SZ, SZ)).save(OUT / "water.png")
tile = {"pyra": 768, "verdant": 1024, "aether": 896, "nexus": 896}[LAND]
json.dump({"land": LAND, "nx": NX, "ny": NY, "step": STEP, "x0": -CW / 2, "y0": -CH / 2, "cap": [B["x"], B["y"], B["width"], B["height"]], "origin": [X0 + CW / 2, Y0 + CH / 2], "water_kind": "none", "water_level": -999, "pools": [], "uv": 1.0 / tile,
           "ortho": float((CW + CH) * 0.7071 * 1.03), "cx": 0.0, "cz": 0.0}, open(OUT / "config.json", "w"))
print("OK", LAND, NX, NY, "capital", B)
