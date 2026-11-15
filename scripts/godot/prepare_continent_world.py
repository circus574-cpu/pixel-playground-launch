#!/usr/bin/env python3
"""Pyra continent -> Godot: scenery placements, sprites, roads, towns and map places.

Everything is read from the published Superior v2 files and from the web game's own remapping rules
(`pyraContinent.ts`): geometry, collision, navigation and saves are never regenerated. The result is
presentation data for the native port. Re-run `prepare_continent_terrain.py` first (it builds the biome grid).
"""
import glob, hashlib, json, math, pathlib, shutil, struct
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
PUB = ROOT / "public"
SRC = PUB / "game/worlds/superior-v2"
PYRA = SRC / "pyra"
ART = SRC / "art"
PORT = ROOT / "ports/godot-pyra"
OUT_OBJ = PORT / "assets/continent/objects"
OUT_TER = PORT / "assets/continent/terrain"
DATA = PORT / "data"
PACK = next((PUB / "game/assets/gpu/pyra-continent-v2").glob("*/pack.json"))
M = 0xFFFFFFFF
OFFSET = (44564.286027, 12168.472)  # Godot capital-local city frame -> Superior world frame (see README)


def imul(a, b):
    return (a * b) & M


def noise(x, y):
    n = imul(int(math.floor(x)) & M, 374761393) ^ imul(int(math.floor(y)) & M, 668265263)
    n = imul(n ^ (n >> 13), 1274126177)
    return ((n ^ (n >> 16)) & M) / 4294967295


def position_hash(x, y):
    h = imul(int(round(x)) & M, 73856093) ^ imul(int(round(y)) & M, 19349663)
    h = imul(h ^ (h >> 13), 0x5BD1E995)
    h ^= h >> 15
    return (h & M) / 4294967296


def road_distance(px, py, pts):
    best = 1e18
    for i in range(1, len(pts)):
        ax, ay = pts[i - 1]; bx, by = pts[i]
        dx, dy = bx - ax, by - ay
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / ((dx * dx + dy * dy) or 1)))
        best = min(best, math.hypot(px - ax - t * dx, py - ay - t * dy))
    return best


LEGACY = {
    "object.basalt": "ridge", "object.nature.patch-basalt-columns": "ridge",
    "object.nature.patch-volcano-active": "crater", "object.nature.patch-volcano-dormant": "hill",
    "object.nature.patch-lava-rocks": "pahoehoe", "object.nature.patch-boulder-group": "rocks",
    "object.nature.patch-cliff-outcrop": "cliff", "object.nature.mountain-peak": "hill",
}
import re


def scenery_name(b, x, y, roads):
    n = noise(x + 7919, y - 313)
    pick = lambda a: a[int(math.floor(n * len(a)))]
    if b in LEGACY: return LEGACY[b]
    if re.search(r"pyra-(oak|tree2)-", b): return "maple"
    if re.search(r"pyra-pine-|mountain-pine-tree", b): return "pine"
    if re.search(r"pyra-(flowerbush|bush)-|biome-forest.flowering-bush", b):
        return pick(["berry-bush", "copper-bush", "lantern-bush"])
    if re.search(r"pyra-(fern|reeds|mushrooms)-", b): return pick(["dry-grass", "weeds", "leaf-patch"])
    if re.search(r"pyra-stump-", b): return "stump"
    if re.search(r"pyra-log-|biome-forest.fallen-mossy-log", b):
        if n < 0.12 and any(road_distance(x, y, r["points"]) < r["width"] / 2 + 220 for r in roads):
            return "cart"
        return "log"
    if re.search(r"pyra-(rocks|boulder)-|biome-forest.mossy-boulder", b): return "rocks"
    if b == "object.crystal" or b.endswith("glowing-crystal-cluster"): return "crystals"
    if b.endswith("an-obsidian-shard-formation"): return pick(["shards", "shards", "obsidian-spire"])
    if b.endswith("basalt-column-cluster"): return pick(["ridge", "obsidian-spire", "scree"])
    if b.endswith("magma-pool-rim"): return pick(["crater", "fissure", "pahoehoe"])
    if b.endswith("smoking-volcano"): return pick(["hill", "crater"])
    if b.endswith("sulfur-vent-with-yellow-crust"): return "spring"
    if b.endswith("cliff-outcrop"): return "cliff"
    if b.endswith("pyra-tent"): return "camp"
    if b.endswith("pyra-bonfire"): return "fire"
    if b.endswith("pyra-totem") or b.endswith("pyra-war-shrine"): return "ruin"
    if b.endswith("pyra-banner"): return "sign"
    if b.endswith("pyra-crates"): return "supplies"
    if b == "object.ruins-props.an-ancient-stone-gate-ruin": return pick(["cave", "mine", "rock-arch"])
    return None


def smooth(pts, per=5):
    """Catmull-Rom, the same curve the browser uses for roads."""
    n = len(pts)
    if n < 3: return [list(p) for p in pts]
    at = lambda i: pts[max(0, min(n - 1, i))]
    out = [list(pts[0])]
    for i in range(n - 1):
        p0, p1, p2, p3 = at(i - 1), at(i), at(i + 1), at(i + 2)
        for s in range(1, per + 1):
            t = s / per
            t2, t3 = t * t, t * t * t
            out.append([round(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3), 1) for k in (0, 1)])
    return out


def main():
    OUT_OBJ.mkdir(parents=True, exist_ok=True)
    OUT_TER.mkdir(parents=True, exist_ok=True)
    (DATA / "continent").mkdir(parents=True, exist_ok=True)
    world = json.load(open(PYRA / "world.json"))
    paths = json.load(open(PYRA / "paths.json"))
    feature = json.load(open(ART / "pyra/feature.art.json"))
    assets = json.load(open(ART / "assets.json"))
    pack = json.load(open(PACK))
    packdir = PACK.parent
    pack_assets = {a["id"]: a for a in pack["assets"]}
    settlements = world["settlements"]
    places = json.load(open(ROOT / "src/game/worlds/v2Places.generated.json"))["pyra"] if "pyra" in json.load(open(ROOT / "src/game/worlds/v2Places.generated.json")) else None
    v2 = json.load(open(ROOT / "src/game/worlds/v2Places.generated.json"))
    names = v2.get("pyra", v2)

    def inside(s, x, y, m=12):
        b = s["bounds"]
        return b["x"] - m <= x <= b["x"] + b["width"] + m and b["y"] - m <= y <= b["y"] + b["height"] + m

    def outside(x, y):
        return not any(inside(s, x, y) for s in settlements)

    capital = next(s for s in settlements if s["id"] == "pyra-capital")
    roads_raw = [{"points": r["points"], "width": r["width"], "kind": r["kind"]} for r in world["roads"] + paths["roads"]]

    # ---- sprites ------------------------------------------------------------------------------
    textures, tex_index = [], {}
    # Binding -> real file from the installed packs (the generated art manifest can point at an older version).
    pack_files = {}
    for pj in sorted((PUB / "game/assets/gpu").glob("*/*/pack.json")):
        try:
            pk = json.load(open(pj))
        except Exception:
            continue
        urls = {a["id"]: a.get("url", "") for a in pk.get("assets", [])}
        for bind, rb in (pk.get("renderBindings") or {}).items():
            u = urls.get(rb.get("asset"), "")
            f = PUB / u.lstrip("/") if u else None
            if f and f.is_file():
                pack_files[bind] = f

    def texture_for(binding):
        if binding in tex_index: return tex_index[binding]
        src = None
        if binding.startswith("object.pyra-continent."):
            key = binding.replace("object.", "terrain." if False else "object.", 1)
            rb = pack["renderBindings"].get(binding)
            if rb: src = packdir / (rb["asset"] + ".webp")
        elif binding in pack_files:
            src = pack_files[binding]
        elif binding in assets:
            src = PUB / assets[binding]["url"].lstrip("/")
        if not src or not src.is_file(): return None
        name = re.sub(r"[^a-z0-9]+", "-", binding.lower()).strip("-")[:70] + ".webp"
        dest = OUT_OBJ / name
        if not dest.exists() or dest.stat().st_size != src.stat().st_size:
            shutil.copyfile(src, dest)
        with Image.open(dest) as im: size = im.size
        tex_index[binding] = len(textures)
        textures.append({"binding": binding, "path": "res://assets/continent/objects/" + name, "w": size[0], "h": size[1]})
        return tex_index[binding]

    # ---- objects ------------------------------------------------------------------------------
    items = []
    for f in sorted(glob.glob(str(ART / "pyra/chunks/*.json"))):
        items += json.load(open(f))["objects"]
    static = feature["landmarks"] + feature["resources"] + feature["dungeonEntrances"] + feature["buildings"]
    items += static
    out, dropped, missing = [], {"capital": 0, "thinned": 0, "missing": 0}, set()
    for it in items:
        x, y = it["x"], it["y"]
        if inside(capital, x, y, 0):
            dropped["capital"] += 1  # the capital keeps the layout carried by the first Godot trial
            continue
        b = it["binding"]
        layer = it.get("layer", "objects")
        if outside(x, y):
            name = scenery_name(b, x, y, roads_raw)
            if name:
                solid, foot = it.get("solid"), it.get("footprint")
                if not solid and not foot and name in ("maple", "pine", "shards", "obsidian-spire"):
                    density = noise(x / 600, y / 600)
                    if noise(x, y) > 0.18 + density * 0.3 or (name in ("maple", "pine") and any(road_distance(x, y, r["points"]) < r["width"] / 2 + 90 for r in roads_raw)):
                        dropped["thinned"] += 1
                        continue
                b = "object.pyra-continent." + name
        t = texture_for(b)
        if t is None:
            dropped["missing"] += 1
            missing.add(b)
            continue
        out.append((x, y, t, it["width"], it["height"], 1 if layer == "below" else 0, it.get("anchorY", 0.92)))
    # bridges / steps on wide straight tracks (pyraPathScenery)
    count = 0
    for r in [{"points": r["points"], "width": r["width"]} for r in world["roads"] + paths["roads"]]:
        if r["width"] < 64: continue
        for i in range(1, len(r["points"])):
            a, b2 = r["points"][i - 1], r["points"][i]
            px, py = (a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2
            if abs(a[0] - b2[0]) < 320 or abs(a[1] - b2[1]) > 10 or not outside(px, py) or not outside(px - 250, py - 250) or not outside(px + 250, py + 250): continue
            t = texture_for("object.pyra-continent." + ("steps" if count % 2 else "bridge"))
            out.append((px, py, t, r["width"] * 3.4, r["width"] * 2.4, 1, 0.5)); count += 1
            break
        if count == 4: break
    # chunk-ordered binary
    keyed = sorted(out, key=lambda o: (int(o[1] // 2048), int(o[0] // 2048), o[1]))
    chunks, blob = {}, bytearray()
    for i, (x, y, t, w, h, below, ay) in enumerate(keyed):
        key = f"{int(x // 2048)},{int(y // 2048)}"
        chunks.setdefault(key, [i, 0])[1] += 1
        blob += struct.pack("<HHHBBff", t, int(round(w)), int(round(h)), below, int(round(ay * 100)), x, y)
    (DATA / "continent/objects.bin").write_bytes(bytes(blob))
    print("missing bindings", sorted(missing))
    print("objects", len(keyed), "textures", len(textures), "dropped", dropped, "bytes", len(blob))

    # ---- terrain textures ---------------------------------------------------------------------
    for key in ["basalt", "ash", "gravel", "leaves", "water", "lava", "shore", "lava-bank", "sulfur", "ash-rock", "road1", "road2", "road3", "road4"]:
        shutil.copyfile(packdir / f"pyra-continent-{key}.webp", OUT_TER / f"{key}.webp")

    # ---- roads --------------------------------------------------------------------------------
    flags = json.load(open(DATA / "continent.terrain.json"))
    biome_img = np.array(Image.open(PORT / "assets/continent/ctrl-biome.png"))
    def cls(kind, mx, my):
        cx, cy = min(biome_img.shape[1] - 1, int(mx // 32)), min(biome_img.shape[0] - 1, int(my // 32))
        volcanic = biome_img[cy, cx, 2] > 0
        if volcanic: return 3
        if kind in ("road", "city-path"): return 0
        if "trail" in kind: return 2
        return 1
    road_list = []
    SS = 2  # supersampling for antialiased edges
    from PIL import ImageDraw, ImageFilter
    mw, mh = 4100 * SS, 2644 * SS
    mask = Image.new("L", (mw, mh), 0)
    draw = ImageDraw.Draw(mask)
    klass = Image.new("L", (1025, 661), 0)  # 64-unit cells: texture class * 64 (+ 32 = present)
    kdraw = ImageDraw.Draw(klass)
    for r in roads_raw:
        pts = smooth(r["points"])
        width = r["width"] * 1.35
        for i in range(1, len(pts)):
            a, b = pts[i - 1], pts[i]
            c = cls(r["kind"], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            draw.line([(a[0] / 16 * SS, a[1] / 16 * SS), (b[0] / 16 * SS, b[1] / 16 * SS)], fill=255, width=max(1, int(round(width / 16 * SS))))
            kdraw.line([(a[0] / 64, a[1] / 64), (b[0] / 64, b[1] / 64)], fill=c * 64 + 32, width=max(2, int(width / 64) + 2))
        for p in pts:
            rad = width / 2 / 16 * SS
            draw.ellipse([p[0] / 16 * SS - rad, p[1] / 16 * SS - rad, p[0] / 16 * SS + rad, p[1] / 16 * SS + rad], fill=255)
    mask = mask.resize((4100, 2644), Image.BOX).filter(ImageFilter.GaussianBlur(1.1))
    mask.save(PORT / "assets/continent/road-mask.png", optimize=True)
    klass.save(PORT / "assets/continent/road-class.png", optimize=True)
    print("road mask coverage", round(float(np.array(mask).astype(bool).mean()) * 100, 2), "%")
    # ---- towns / places -----------------------------------------------------------------------
    town_names = {v["settlement"]: v["name"] for v in names["cities"].values()}
    buildings_by = {}
    for b in world["buildings"]:
        buildings_by.setdefault(b["settlement"], []).append(b)
    art_buildings = {b["id"]: b for b in feature["buildings"]}
    towns = []
    for s in settlements:
        if s["id"] == "pyra-capital": continue
        svc = []
        for b in buildings_by.get(s["id"], []):
            if not b.get("service"): continue
            art = art_buildings.get(b["id"], {})
            svc.append({"id": b["id"], "service": b["service"], "door": b["door"], "footprint": b["footprint"],
                        "x": art.get("x", b["door"]["x"]), "y": art.get("y", b["door"]["y"])})
        towns.append({"id": s["id"], "name": town_names.get(s["id"], s["name"]), "bounds": s["bounds"], "x": s["x"], "y": s["y"], "services": svc})
    kinds = {"village": "wioska", "port": "port", "cave": "jaskinia", "maze": "labirynt", "watchtower": "wieża strażnicza", "shrine": "kapliczka", "wilderness": "kraina"}
    placed = []
    for l in world["locations"]:
        if l["kind"] in ("settlement", "hidden-cache"): continue
        placed.append({"id": l["id"], "kind": l["kind"], "label": kinds.get(l["kind"], l["kind"]), "name": l.get("name", ""), "x": round(l["x"]), "y": round(l["y"])})
    famous = [{"id": k, "name": v["name"], "x": v["x"], "y": v["y"], "kind": "famous"} for k, v in names["famous"].items()]
    capital_buildings = []
    for b in feature["acceptedCityBuildings"]:
        t = texture_for(b["binding"])
        capital_buildings.append({"id": b["id"], "x": b["x"], "y": b["y"], "w": round(b["width"]), "h": round(b["height"]), "t": t, "door": b.get("door")})
    guides = [{"id": n["id"], "name": n["name"], "dialogue": n["dialogue"], "x": round(n["x"]), "y": round(n["y"])} for n in world["npcs"] if n.get("role") == "guide"]
    json.dump({"offset": OFFSET, "guides": guides, "capitalBuildings": capital_buildings, "capital": {"id": capital["id"], "name": town_names.get(capital["id"], capital["name"]), "bounds": capital["bounds"], "x": capital["x"], "y": capital["y"]},
               "towns": towns, "places": placed, "famous": famous,
               "chunks": chunks, "textures": textures, "chunkSize": 2048, "world": [65600, 42304]},
              open(DATA / "continent/world.json", "w"), ensure_ascii=False, separators=(",", ":"))
    print("towns", len(towns), "places", len(placed), "famous", len(famous))


main()
