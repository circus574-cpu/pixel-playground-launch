#!/usr/bin/env python3
"""All ten Superior v2 lands -> Godot data: terrain grids, walk mask, road mask, scenery placements, textures, towns.

Reads the published world files and /tmp/godot-lands/<land>.json (from export-lands.ts, which runs the browser game's own
remapping of scenery). Geometry, collision and navigation are never regenerated. Outputs:
  ports/godot-pyra/data/lands/<land>/{land.json, objects.bin, walk.bin}
  ports/godot-pyra/assets/lands/<land>/{ctrl-biome.png, ctrl-land.png, road-mask.png, road-class.png, map.webp, terrain/*.webp}
  ports/godot-pyra/assets/objects/*.webp   (shared sprites)
Usage: python3 scripts/godot/prepare_lands.py [land ...]
"""
import glob, hashlib, json, math, pathlib, shutil, struct, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[2]
PUB = ROOT / "public"
SRC = PUB / "game/worlds/superior-v2"
PORT = ROOT / "ports/godot-pyra"
TMP = pathlib.Path("/tmp/godot-lands")
LANDS = ["pyra", "verdant", "aether", "nexus"] + [f"island-{i}" for i in range(1, 7)]
FOOT = 12
HOME = {"pyra": "legend", "verdant": "planetary", "aether": "sage", "nexus": "android"}
WORLD_OF = {"pyra": "pyra", "verdant": "verdant", "aether": "aether", "nexus": "nexus", "island-1": "aether", "island-2": "aether", "island-3": "aether", "island-4": "verdant", "island-5": "verdant", "island-6": "pyra"}
MOLTEN_BIOME = {"pyra": 2, "nexus": 3, "island-6": 3}
# band overlays: mode 0 none, 1 = sin(x/a)+sin(y/b)+sin((x+y)/c), 2 = sin(x/a)+cos(y/b), 3 = always
OVERLAYS = {
    "pyra": {"over1": dict(mode=1, p=[550, 720, 1100], thr=0.55, mask=[1, 0, 0, 0], alpha=0.95), "over2": dict(mode=3, p=[1, 1, 1], thr=-9, mask=[0, 0, 0, 1], alpha=0.8), "shore": [1, 1, 0, 1]},
    "aether": {"over1": dict(mode=2, p=[510, 670, 1], thr=-0.1, mask=[0, 0, 1, 1], alpha=0.95), "over2": dict(mode=2, p=[490, 740, 1], thr=1.2, mask=[1, 0, 0, 0], alpha=0.65), "shore": [1, 1, 0, 0]},
    "nexus": {"over1": dict(mode=2, p=[470, 610, 1], thr=1.15, mask=[0, 0, 0, 1], alpha=0.85), "over2": dict(mode=2, p=[520, 700, 1], thr=1.3, mask=[0, 1, 0, 0], alpha=0.6), "shore": [1, 1, 1, 1]},
}


def runs(rle, count):
    out = np.empty(count, np.uint8)
    at = 0
    for value, n in rle:
        out[at:at + n] = value
        at += n
    assert at == count
    return out


def smooth(pts, per=4):
    n = len(pts)
    if n < 3:
        return [list(p) for p in pts]
    at = lambda i: pts[max(0, min(n - 1, i))]
    out = [list(pts[0])]
    for i in range(n - 1):
        p0, p1, p2, p3 = at(i - 1), at(i), at(i + 1), at(i + 2)
        for s in range(1, per + 1):
            t = s / per
            t2, t3 = t * t, t * t * t
            out.append([0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in (0, 1)])
    return out


def copy_file(url, dest):
    src = PUB / url.lstrip("/")
    if not dest.exists() or dest.stat().st_size != src.stat().st_size:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
    return dest


def copy_ref(ref, dest):
    """Copy a published image; a binding that names an atlas frame is cut out of its atlas (sidecar JSON next to the image)."""
    frame = ref.get("frame")
    if not frame:
        return copy_file(ref["url"], dest)
    src = PUB / ref["url"].lstrip("/")
    meta = json.load(open(src.with_suffix(".json")))["frames"][frame]["frame"]
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as atlas:
        # Terrain tiles are mirrored by the shader, so a bright atlas-edge row would show as a crease: cut 3 px in.
        inset = 3 if "terrain" in frame else 0
        atlas.convert("RGBA").crop((meta["x"] + inset, meta["y"] + inset, meta["x"] + meta["w"] - inset, meta["y"] + meta["h"] - inset)).save(dest, "WEBP", quality=92, method=6)
    return dest


def process(land):
    spec = json.load(open(TMP / f"{land}.json"))
    world = json.load(open(SRC / land / "world.json"))
    index = {f["id"]: f for f in json.load(open(SRC / "index.json"))["features"]}
    names_all = json.load(open(ROOT / "src/game/worlds/v2Places.generated.json"))
    names = names_all.get(land)
    out_a = PORT / "assets/lands" / land
    out_d = PORT / "data/lands" / land
    (out_a / "terrain").mkdir(parents=True, exist_ok=True)
    out_d.mkdir(parents=True, exist_ok=True)
    (PORT / "assets/objects").mkdir(parents=True, exist_ok=True)

    # ---- terrain grids -------------------------------------------------------------------------------
    terrain = json.load(open(SRC / land / "terrain.json"))
    W, H = terrain["width"], terrain["height"]
    flags = runs(terrain["flags"], W * H).reshape(H, W)
    biome = np.zeros((H, W), np.uint8)
    colliders = set()
    for f in glob.glob(str(SRC / land / "chunks/*.json")):
        d = json.load(open(f))
        t = d["terrain"]
        b = runs(t["biome"], t["width"] * t["height"]).reshape(t["height"], t["width"])
        x0, y0 = d["x"] // 32, d["y"] // 32
        h, w = min(t["height"], H - y0), min(t["width"], W - x0)
        biome[y0:y0 + h, x0:x0 + w] = b[:h, :w]
        for c in d["colliders"]:
            colliders.add((c["x"], c["y"], c["width"], c["height"]))
    for c in json.load(open(SRC / land / "collision.json")):
        colliders.add((c["x"], c["y"], c["width"], c["height"]))
    land_mask = (flags & 16) > 0
    dry = (flags & 1) > 0
    molten = np.zeros_like(land_mask)
    if land in MOLTEN_BIOME:
        molten = land_mask & ~dry & (biome == MOLTEN_BIOME[land])
    ctrl = np.zeros((H, W, 4), np.uint8)
    for b in range(3):
        ctrl[..., b] = np.where(land_mask & (biome == b), 255, 0)
    ctrl[..., 3] = 255
    Image.fromarray(ctrl, "RGBA").save(out_a / "ctrl-biome.png", optimize=True)
    c2 = np.zeros((H, W, 4), np.uint8)
    c2[..., 0] = np.where(land_mask, 255, 0)
    c2[..., 1] = np.where(molten, 255, 0)
    c2[..., 2] = np.where(dry, 255, 0)
    c2[..., 3] = 255
    Image.fromarray(c2, "RGBA").save(out_a / "ctrl-land.png", optimize=True)

    nav = json.load(open(SRC / land / "navigation.json"))
    NW, NH = nav["width"], nav["height"]
    blocked = runs(nav["blocked"], NW * NH).reshape(NH, NW).astype(bool)
    dry16 = np.kron(dry, np.ones((2, 2), bool))
    pad = np.zeros((NH, NW), bool)
    pad[:min(NH, dry16.shape[0]), :min(NW, dry16.shape[1])] = dry16[:NH, :NW]
    nd = ~pad
    grown = nd.copy()
    grown[1:, :] |= nd[:-1, :]; grown[:-1, :] |= nd[1:, :]; grown[:, 1:] |= nd[:, :-1]; grown[:, :-1] |= nd[:, 1:]
    walk = ~blocked & ~grown
    for x, y, w, h in colliders:
        x0 = max(0, int((x - FOOT) // 16)); x1 = min(NW, int((x + w + FOOT) // 16) + 1)
        y0 = max(0, int((y - FOOT) // 16)); y1 = min(NH, int((y + h + FOOT) // 16) + 1)
        walk[y0:y1, x0:x1] = False
    (out_d / "walk.bin").write_bytes(np.where(walk, 255, 0).astype(np.uint8).tobytes())

    # ---- roads: class per segment, mask at 16 units ------------------------------------------------------
    def cell_biome(mx, my):
        return int(biome[min(H - 1, int(my // 32)), min(W - 1, int(mx // 32))])

    def near_water(mx, my):
        cx, cy = int(mx // 32), int(my // 32)
        for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2)):
            x, y = cx + dx, cy + dy
            if 0 <= x < W and 0 <= y < H and not land_mask[y, x]:
                return True
        return False

    roads_count = len(spec["roles"].get("roads", [])) or 1

    def road_class(kind, mx, my):
        if land.startswith("island"):
            return 0
        b = cell_biome(mx, my)
        if land == "pyra":
            return 2 if b >= 2 else 3 if "trail" in kind else 0 if kind in ("road", "city-path") else 1
        if land == "aether":
            return 3 if b >= 2 else 4 if near_water(mx, my) else 0 if kind in ("road", "city-path") else 2 if b == 1 else 1
        return 3 if b == 2 else 0 if kind in ("road", "city-path") else 2 if "trail" in kind else 1

    SS = 2
    mask = Image.new("L", (NW * SS, NH * SS), 0)
    draw = ImageDraw.Draw(mask)
    klass = Image.new("L", (math.ceil(NW / 4), math.ceil(NH / 4)), 0)
    kdraw = ImageDraw.Draw(klass)
    for r in spec["roads"]:
        pts = smooth(r["points"])
        width = r["width"] * 1.35
        for i in range(1, len(pts)):
            a, b = pts[i - 1], pts[i]
            c = min(roads_count - 1, road_class(r["kind"], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
            draw.line([(a[0] / 16 * SS, a[1] / 16 * SS), (b[0] / 16 * SS, b[1] / 16 * SS)], fill=255, width=max(1, int(round(width / 16 * SS))))
            kdraw.line([(a[0] / 64, a[1] / 64), (b[0] / 64, b[1] / 64)], fill=c * 40 + 20, width=max(2, int(width / 64) + 2))
        for p in pts:
            rad = width / 2 / 16 * SS
            draw.ellipse([p[0] / 16 * SS - rad, p[1] / 16 * SS - rad, p[0] / 16 * SS + rad, p[1] / 16 * SS + rad], fill=255)
    mask = mask.resize((NW, NH), Image.BOX).filter(ImageFilter.GaussianBlur(1.1))
    mask.save(out_a / "road-mask.png", optimize=True)
    klass.save(out_a / "road-class.png", optimize=True)

    # ---- terrain textures -----------------------------------------------------------------------------
    roles = spec["roles"]
    files = spec["files"]
    tex = {}
    for i, b in enumerate(roles["biome"]):
        tex[f"b{i}"] = b
    for k in ("water", "shore", "special", "over1", "over2", "plaza"):
        if roles.get(k):
            tex[k] = roles[k]
    for i, b in enumerate(roles.get("roads", [])):
        tex[f"road{i}"] = b
    terrain_files = {}
    for role, binding in tex.items():
        ref = files[binding]
        dest = out_a / "terrain" / f"{role}.webp"
        copy_ref(ref, dest)
        terrain_files[role] = f"res://assets/lands/{land}/terrain/{role}.webp"
    tile = files[roles["biome"][0]].get("tile") or [768, 768]
    road_tile = files[roles["roads"][0]].get("tile") if roles.get("roads") else None
    road_tile = road_tile or [768, 128]

    # ---- scenery placements ---------------------------------------------------------------------------
    textures, tex_index = [], {}

    def texture_for(binding):
        if binding in tex_index:
            return tex_index[binding]
        ref = files[binding]
        stem = hashlib.sha1((ref["url"] + str(ref.get("frame") or "")).encode()).hexdigest()[:8] + "-" + (str(ref["frame"]) + ".webp" if ref.get("frame") else pathlib.Path(ref["url"]).name)
        dest = PORT / "assets/objects" / stem
        copy_ref(ref, dest)
        with Image.open(dest) as im:
            size = im.size
        tex_index[binding] = len(textures)
        textures.append({"path": f"res://assets/objects/{stem}", "w": size[0], "h": size[1]})
        return tex_index[binding]

    capital = next((s for s in world["settlements"] if s["kind"] == "capital"), None)
    keep = []
    for o in spec["objects"]:
        if o.get("fx"):
            continue
        if land == "pyra" and capital:
            b = capital["bounds"]
            if b["x"] <= o["x"] <= b["x"] + b["width"] and b["y"] <= o["y"] <= b["y"] + b["height"]:
                continue  # the capital keeps the layout carried by the first Godot trial
        keep.append(o)
    keyed = sorted(keep, key=lambda o: (int(o["y"] // 2048), int(o["x"] // 2048), o["y"]))
    chunks, blob = {}, bytearray()
    for i, o in enumerate(keyed):
        t = texture_for(o["b"])
        key = f"{int(o['x'] // 2048)},{int(o['y'] // 2048)}"
        chunks.setdefault(key, [i, 0])[1] += 1
        blob += struct.pack("<HHHBBff", t, int(round(o["w"])), int(round(o["h"])), o["below"], int(round(o["ay"] * 100)), o["x"], o["y"])
    (out_d / "objects.bin").write_bytes(bytes(blob))

    # ---- towns, services, NPCs, places ------------------------------------------------------------------
    city_names = {v["settlement"]: v["name"] for v in names["cities"].values()} if names else {}
    buildings = {}
    for b in world["buildings"]:
        buildings.setdefault(b["settlement"], []).append(b)
    doors = {d["id"]: d for d in world["doors"]}
    settlements = []
    for s in world["settlements"]:
        services = []
        if s["kind"] == "capital":
            for svc in ["hall", "shop", "arena", "depot", "smithy", "inn"]:
                d = doors.get("accepted-" + svc)
                if d:
                    services.append({"id": "accepted-" + svc, "service": svc, "door": {"x": d["x"], "y": d["y"]}})
        else:
            for b in buildings.get(s["id"], []):
                if b.get("service") in ("shop", "hall", "inn", "smithy", "depot", "arena"):
                    services.append({"id": b["id"], "service": b["service"], "door": b["door"]})
        settlements.append({"id": s["id"], "kind": s["kind"], "name": city_names.get(s["id"], s["name"] if not land.startswith("island") else "Przystań " + land[-1]), "bounds": s["bounds"], "x": s["x"], "y": s["y"], "services": services})
    npcs = []
    guides = []
    for n in world["npcs"]:
        if n["id"].startswith("accepted-"):
            npcs.append({"id": n["id"], "name": n["name"], "role": n["role"], "dialogue": n.get("dialogue", ""), "building": n.get("building"), "x": n["x"], "y": n["y"]})
        elif n.get("role") == "guide":
            guides.append({"id": n["id"], "name": n["name"], "dialogue": n["dialogue"], "x": round(n["x"]), "y": round(n["y"])})
    kinds = {"village": "wioska", "port": "port", "cave": "jaskinia", "maze": "labirynt", "watchtower": "wieża strażnicza", "shrine": "kapliczka", "wilderness": "kraina", "camp": "obóz"}
    places = [{"id": l["id"], "kind": l["kind"], "label": kinds.get(l["kind"], l["kind"]), "name": l.get("name", ""), "x": round(l["x"]), "y": round(l["y"])}
              for l in world["locations"] if l["kind"] not in ("settlement", "hidden-cache")]
    famous = [{"id": k, "name": v["name"], "x": v["x"], "y": v["y"]} for k, v in (names or {}).get("famous", {}).items()]

    with Image.open(SRC / land / "map-hi.webp") as im:
        scale = min(1.0, 2050 / im.width)
        im.convert("RGB").resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS).save(out_a / "map.webp", quality=86, method=6)
    capital_buildings = [{"id": b["id"], "x": b["x"], "y": b["y"], "w": round(b["w"]), "h": round(b["h"]), "t": texture_for(b["b"]), "door": b.get("door")} for b in spec.get("capitalBuildings", [])]
    cfg = {"id": land, "capitalBuildings": capital_buildings, "name": world["name"], "world": WORLD_OF[land], "race": HOME.get(land, ""), "width": world["geometry"]["width"], "height": world["geometry"]["height"],
           "arrival": index[land]["arrival"], "biomeNames": world["biomeNames"],
           "grid": {"nav": [NW, NH], "terrain": [W, H]}, "tile": tile, "roadTile": road_tile, "roadCount": roads_count,
           "files": terrain_files, "overlay": OVERLAYS.get(land, {}), "hasSpecial": "special" in terrain_files,
           "settlements": settlements, "npcs": npcs, "guides": guides, "places": places, "famous": famous,
           "textures": textures, "chunks": chunks, "objects": len(keyed)}
    (out_d / "land.json").write_text(json.dumps(cfg, ensure_ascii=False, separators=(",", ":")))
    print(land, "objects", len(keyed), "textures", len(textures), "walkable", int(walk.sum()), "grid", (W, H), (NW, NH), "tile", tile, "roads", roads_count)


if __name__ == "__main__":
    for land in (sys.argv[1:] or LANDS):
        process(land)
