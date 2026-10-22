"""Enlarge Aetheria to 3600x2560 with curved roads, organic courts and new districts.

Old content (spawn, NPCs, buildings, footprints, terraces, first four enemies) keeps its
coordinates, so existing saves stay valid. New solid objects are placed only where the
validator below confirms they do not cover roads, points of interest or each other.

Usage: python3 scripts/expand_aether.py   (reads/writes src/game/world/regions/aether.json,
writes public/game/assets/stage3/aether-minimap.webp from the installed anime textures)
"""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
REGION = ROOT / "src/game/world/regions/aether.json"
W, H = 3600, 2560

world = json.loads(REGION.read_text())
keep = [o for o in world["objects"] if not o.get("expansion")]
world["objects"] = keep
world["width"], world["height"] = W, H
world["minimap"] = "/game/assets/stage3/aether-minimap.webp"

# Boundary terraces follow the new edge; the old inner terraces stay untouched.
TERRACES = [(200, 940, 670, 70), (1530, 940, 670, 70), (160, 1550, 650, 160), (1670, 1570, 550, 130)]
inner = [dict(x=x, y=y, width=w, height=h) for x, y, w, h in TERRACES]
world["obstacles"] = [
    dict(x=0, y=0, width=W, height=100),
    dict(x=0, y=100, width=150, height=H - 100),
    dict(x=W - 150, y=100, width=150, height=H - 100),
    dict(x=150, y=H - 100, width=W - 300, height=100),
    *inner,
    dict(x=2900, y=1300, width=450, height=80),
]

ROADS = [
    (170, [(1200, 560), (1190, 820), (1170, 1050), (1210, 1300), (1290, 1560), (1260, 1820),
           (1200, 2100), (1230, 2400)]),
    (150, [(560, 1110), (800, 1080), (1000, 1110), (1200, 1130)]),
    (120, [(660, 930), (640, 1040), (620, 1100)]),
    (160, [(1200, 1130), (1450, 1120), (1720, 1090), (1980, 1160), (2250, 1130), (2480, 1020),
           (2700, 960), (2880, 920)]),
    (120, [(1700, 860), (1710, 980), (1720, 1090)]),
    (150, [(2250, 1130), (2420, 1380), (2650, 1650), (2900, 1900), (3080, 2150)]),
    (140, [(1260, 1820), (1000, 1960), (790, 2080), (640, 2170)]),
    (130, [(1200, 2100), (1500, 2170), (1800, 2160), (2140, 2110)]),
    (120, [(2880, 920), (3060, 760), (3150, 560)]),
]
COURTS = [((1200, 690), 230, 160, 1), ((1200, 1180), 290, 165, 2), ((2880, 960), 250, 140, 3),
          ((1220, 2110), 210, 120, 4), ((2160, 2130), 170, 100, 5)]


def blob(center, rx, ry, seed, n=28):
    cx, cy = center
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 1 + 0.09 * math.sin(3 * a + seed) + 0.06 * math.sin(5 * a + seed * 2.3)
        pts.append([round(cx + math.cos(a) * rx * r), round(cy + math.sin(a) * ry * r)])
    return pts


world["terrain"]["paths"] = []
world["terrain"]["plazas"] = []
world["terrain"]["roads"] = [dict(width=w, points=[list(p) for p in pts]) for w, pts in ROADS]
world["terrain"]["courts"] = [dict(points=blob(c, rx, ry, s)) for c, rx, ry, s in COURTS]

FP = {  # kind -> (width, height, footprint or None)
    "pagoda": (380, 457, (250, 110)),
    "koi-pond": (380, 248, (300, 110)),
    "spirit-gate": (260, 306, None),
    "stone-lantern": (70, 152, (30, 22)),
    "cherry-tree": (300, 294, (60, 46)),
    "archive": (370, 330, (280, 145)),
    "ki-tree": (290, 330, (75, 60)),
    "garden": (170, 120, None),
    "cloud-peak": (420, 270, None),
}
NEW = [
    ("pagoda", 2880, 800), ("pagoda", 520, 2000), ("archive", 2150, 2000),
    ("koi-pond", 2520, 820), ("koi-pond", 900, 2300),
    ("spirit-gate", 2050, 1170), ("spirit-gate", 1272, 1700), ("spirit-gate", 2700, 965),
    *[("stone-lantern", x, y) for x, y in [(1060, 1520), (1430, 1520), (1060, 2010), (1350, 1990),
                                            (2580, 1110), (2770, 1080), (2640, 1430), (2430, 1600),
                                            (1980, 1290), (2990, 1080)]],
    *[("cherry-tree", x, y) for x, y in [(2300, 700), (3200, 1110), (3250, 1530), (1600, 1980),
                                          (880, 1850), (2700, 2300), (3250, 2300), (1950, 2400),
                                          (3200, 800), (1650, 1450)]],
    *[("ki-tree", x, y) for x, y in [(2950, 1580), (3300, 1950), (2420, 2330), (380, 1880)]],
    *[("garden", x, y) for x, y in [(2650, 1250), (3100, 1220), (2350, 1800), (1520, 2330),
                                     (3150, 2080), (2700, 2050), (1900, 2020), (700, 2420)]],
    *[("cloud-peak", x, 240) for x in (2560, 3010, 3360)],
]
for i, (kind, x, y) in enumerate(NEW):
    w, h, fp = FP[kind]
    o = dict(id=f"x-{kind}-{i}", kind=kind, asset=kind, x=x, y=y, width=w, height=h,
             anchorX=.5, anchorY=.92, solid=bool(fp), expansion=True)
    if fp:
        o["footprint"] = dict(width=fp[0], height=fp[1])
    world["objects"].append(o)

world["enemies"] = world["enemies"][:4] + [dict(x=x, y=y) for x, y in
                                          [(2950, 2150), (3250, 1720), (2050, 2350), (460, 2330)]]
world["landmarks"] = [l for l in world["landmarks"] if l["label"] in
                      ("Sanktuarium", "Źródło Pamięci", "Dziki gaj")] + [
    dict(x=2880, y=950, label="Ogród Pagód", kind="settlement"),
    dict(x=900, y=2170, label="Staw Koi", kind="energy"),
    dict(x=3050, y=2080, label="Dzikie wzgórza", kind="danger"),
]


# ---- validation: new solids never cover roads, points of interest or other solids
def rect(o):
    f = o["footprint"]
    return (o["x"] - f["width"] / 2, o["y"] + f.get("offsetY", 0) - f["height"] / 2,
            f["width"], f["height"])


def seg_dist(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


solids = [rect(o) for o in world["objects"] if o["solid"]] + [
    (o["x"], o["y"], o["width"], o["height"]) for o in world["obstacles"]]
errors = []
for o in world["objects"]:
    if not o.get("expansion") or not o["solid"]:
        continue
    x, y, w, h = rect(o)
    for rw, pts in ROADS:
        for cx in (x, x + w / 2, x + w):
            for cy in (y, y + h / 2, y + h):
                if any(seg_dist((cx, cy), a, b) < rw / 2 + 6 for a, b in zip(pts, pts[1:])):
                    errors.append(("road", o["id"]))
    for r in solids:
        if r == (x, y, w, h):
            continue
        if x < r[0] + r[2] and r[0] < x + w and y < r[1] + r[3] and r[1] < y + h:
            errors.append(("overlap", o["id"], r))
pois = world["enemies"] + world["landmarks"] + world["npcs"] + [world["spawn"], world["market"]]
for p in pois:
    for r in solids:
        if r[0] - 30 < p["x"] < r[0] + r[2] + 30 and r[1] - 30 < p["y"] < r[1] + r[3] + 30:
            errors.append(("poi", p, r))
errors = list(dict.fromkeys(map(str, errors)))
assert not errors, "\n".join(errors)
REGION.write_text(json.dumps(world, ensure_ascii=False, indent=2) + "\n")

# ---- minimap from the installed anime textures (same geometry as the game)
S = 1 / 3
pack = json.loads(next((ROOT / "public/game/assets/gpu/aether-sanctuary").glob("*/pack.json")).read_text())
xpack = json.loads(next((ROOT / "public/game/assets/gpu/aether-expansion").glob("*/pack.json")).read_text())
urls = {a["id"]: ROOT / "public" / a["url"].lstrip("/") for p in (pack, xpack) for a in p["assets"]}
binds = {**pack["renderBindings"], **xpack["renderBindings"]}


def tiled(key, size, w, h):
    b = binds[key]
    tile = Image.open(urls[b["asset"]]).convert("RGBA")
    side = max(8, round(b["tileSize"][0] * S))
    tile = tile.resize((side, side), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (w, h))
    for ty in range(0, h, side):
        for tx in range(0, w, side):
            out.paste(tile, (tx, ty))
    return out


mw, mh = round(W * S), round(H * S)
img = tiled("terrain.aether-ground", None, mw, mh)
path_tex = tiled("terrain.aether-path", None, mw, mh)
plaza_tex = tiled("terrain.aether-plaza", None, mw, mh)
wall_tex = tiled("terrain.aether-wall", None, mw, mh)
mask = Image.new("L", (mw, mh))
d = ImageDraw.Draw(mask)
for rw, pts in ROADS:
    q = [(x * S, y * S) for x, y in pts]
    d.line(q, fill=255, width=round(rw * S), joint="curve")
    for x, y in q:
        r = rw * S / 2
        d.ellipse((x - r, y - r, x + r, y + r), fill=255)
img.paste(path_tex, (0, 0), mask.filter(ImageFilter.GaussianBlur(2)))
mask = Image.new("L", (mw, mh))
d = ImageDraw.Draw(mask)
for c in world["terrain"]["courts"]:
    d.polygon([(x * S, y * S) for x, y in c["points"]], fill=255)
img.paste(plaza_tex, (0, 0), mask.filter(ImageFilter.GaussianBlur(1.5)))
mask = Image.new("L", (mw, mh))
d = ImageDraw.Draw(mask)
for o in world["obstacles"]:
    d.rectangle((o["x"] * S, o["y"] * S, (o["x"] + o["width"]) * S, (o["y"] + o["height"]) * S), fill=255)
img.paste(wall_tex, (0, 0), mask)
for o in sorted(world["objects"], key=lambda o: o["y"]):
    b = binds.get("object." + o["asset"])
    if not b:
        continue
    sprite = Image.open(urls[b["asset"]]).convert("RGBA")
    k = min(o["width"] / sprite.width, o["height"] / sprite.height) * S
    sprite = sprite.resize((max(1, round(sprite.width * k)), max(1, round(sprite.height * k))),
                           Image.Resampling.LANCZOS)
    ox, oy = b.get("origin", [o["anchorX"], o["anchorY"]])
    img.alpha_composite(sprite, (round(o["x"] * S - sprite.width * ox), round(o["y"] * S - sprite.height * oy)))
img.convert("RGB").save(ROOT / "public/game/assets/stage3/aether-minimap.webp", quality=88)
print(json.dumps({"objects": len(world["objects"]), "enemies": len(world["enemies"]),
                  "roads": len(ROADS), "courts": len(COURTS), "minimap": [mw, mh]}))
