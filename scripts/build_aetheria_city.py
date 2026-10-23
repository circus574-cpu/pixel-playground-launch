"""Builds the functional city of Aetheria (Sages) into src/game/world/regions/aether.json.

Run from the repo root:  python3 scripts/build_aetheria_city.py
Idempotent: it starts from the current region file, moves the existing building sprites into
separate districts, adds doors, connecting roads, street decor and the city data, and removes
combat spawns from the safe city area.

Scope (docs/CITY-INTEGRATION-CONTRACT-2026-10-23.md): data, layout and look only. The shared
mechanics (entering buildings, trade, smithy, depot, training, save schema) belong to the other
branch, so nothing under src/game outside the world data is touched here.
"""
import json
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "src/game/world/regions/aether.json"
data = json.loads(PATH.read_text(encoding="utf-8"))

# City safe area: no combat spawns inside (the open valley around the sanctuary).
CITY = {"x": 1400, "y": 1150, "width": 3300, "height": 2150}

# Service buildings: existing sprites reused (moved apart), names are Sages' own.
BUILDINGS = [
    dict(id="hall", obj="sanctum-0", pos=(2400, 1330), district="Wzgórze Źródła",
         name="Sala Rady Źródeł",
         description="Główny gmach Sanktuarium. Opiekunowie źródeł przyjmują tu nowych uczniów i wydają zadania."),
    dict(id="shop", obj="archive-2", pos=(3250, 1760), district="Targ Wymiany",
         name="Pawilon Wymiany",
         description="Archiwum towarów, gdzie wiedza krąży tak jak mikstury, zwoje i wyposażenie."),
    dict(id="arena", obj="x-pagoda-0", pos=(3980, 1670), district="Ogród Pagód",
         name="Dziedziniec Skupienia",
         description="Pawilon i dziedziniec treningowy z manekinem. Tu ćwiczy się prawdziwe zdolności bez ryzyka."),
    dict(id="depot", obj="archive-1", pos=(1850, 2150), district="Zachodnie Tarasy",
         name="Skarbiec Zwojów",
         description="Bezpieczne archiwum z osobistą skrzynią na przedmioty każdej postaci."),
    dict(id="smithy", obj="x-archive-2", pos=(3360, 2875), district="Dziedziniec Pieczęci",
         name="Warsztat Pieczęci",
         description="Rzemieślnicy pieczęci ostrzą, wzmacniają i naprawiają wyposażenie."),
    dict(id="inn", obj="x-pagoda-1", pos=(1850, 2880), district="Staw Koi",
         name="Herbaciarnia Cichych Wód",
         description="Cicha herbaciarnia nad stawem, gdzie można odpocząć i odzyskać siły."),
]

NPCS = [
    dict(id="guide", name="Sora", role="Opiekunka źródeł", pos=(2440, 2030), tint=11071695,
         dialogue="Zanim otworzysz księgę, naucz się słuchać. Odwiedź Źródło Pamięci i wróć. Jego cisza jest pierwszą lekcją KI."),
    dict(id="hunter", name="Ishin", role="Strażnik ogrodów", pos=(2660, 1650), tint=16762788,
         dialogue="Zdziczałe bestie niszczą korzenie świętego gaju. Uspokój trzy, a powierz ci ostrze strażnika."),
]
# Residents inside the service buildings (interiors are handled by the shared city mechanics).
RESIDENTS = [
    dict(id="steward", building="hall", name="Hoshi", role="Zarządca Sali Rady", tint=15390133,
         dialogue="Sala Rady stoi otworem. Każda historia w Sanktuarium zaczyna się od pytania, nie od odpowiedzi."),
    dict(id="merchant", building="shop", name="Mei", role="Archiwistka wymiany", tint=14070783,
         dialogue="Wiedza krąży tak jak towary. Wymień kły na mikstury i wyposażenie."),
    dict(id="trainer", building="arena", name="Raku", role="Mistrz skupienia", tint=16755370,
         dialogue="Manekin nie oddaje ciosów, więc nie masz wymówki. Użyj każdej zdolności i obserwuj, jak działa."),
    dict(id="keeper", building="depot", name="Kaede", role="Strażniczka zwojów", tint=12116191,
         dialogue="Twoje rzeczy leżą tu bezpieczniej niż w jakiejkolwiek sakwie. Skrzynia należy tylko do ciebie."),
    dict(id="smith", building="smithy", name="Enso", role="Rzemieślnik pieczęci", tint=10802687,
         dialogue="Dobre ostrze wymaga skupienia. Załóż je i wróć; wzmocnię jego pieczęć za 15 monet."),
    dict(id="innkeeper", building="inn", name="Yuna", role="Mistrzyni herbaty", tint=16766139,
         dialogue="Usiądź. Herbata z wiosennego źródła leczy więcej, niż się wydaje."),
]

# --- Continent layout (docs/CITY-CONTINENT-SCALE-2026-10-23.md) ---------------------------------
# The scene was translated by scripts/expand_continents.py. The city is a safe area of 4000 x 2500
# units: the building plan below (written for the original scene) is spread over that area with the
# same relative arrangement, so the districts keep their order but stand much further apart.
SHIFT = data["layoutShifts"]["3"]
_xs, _ys = [b["pos"][0] for b in BUILDINGS], [b["pos"][1] for b in BUILDINGS]
_CX, _CY = (min(_xs) + max(_xs)) / 2, (min(_ys) + max(_ys)) / 2
# The six buildings fill about 3300 x 1900 of the 4000 x 2500 city, leaving a margin of open ground.
_KX, _KY = 3300 / (max(_xs) - min(_xs)), 1900 / (max(_ys) - min(_ys))


def T(p):
    return (round(_CX + (p[0] - _CX) * _KX + SHIFT["x"]), round(_CY + (p[1] - _CY) * _KY + SHIFT["y"]))


CITY = {"x": round(_CX + SHIFT["x"] - 2000), "y": round(_CY + SHIFT["y"] - 1250), "width": 4000, "height": 2500}
for _b in BUILDINGS:
    _b["pos"] = T(_b["pos"])
for _n in NPCS:
    _n["pos"] = T(_n["pos"])


def fp_rect(o):
    f = o.get("footprint")
    if not f:
        return None
    return (o["x"] - f["width"] / 2, o["y"] + f.get("offsetY", 0) - f["height"] / 2, f["width"], f["height"])


def intersects(a, b, margin=0):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return not (ax + aw + margin <= bx or bx + bw + margin <= ax or ay + ah + margin <= by or by + bh + margin <= ay)


objects = {o["id"]: o for o in data["objects"]}
for b in BUILDINGS:
    o = objects[b["obj"]]
    o["x"], o["y"] = b["pos"]
    f = o["footprint"]
    b["footprint"] = fp_rect(o)
    b["door"] = {"x": o["x"], "y": int(o["y"] + f["height"] / 2 + 55)}
    b["objectId"] = o["id"]

# Ponds that collided with the new districts are moved to free ground instead of being deleted.
RELOCATE = {"x-koi-pond-3": T((3720, 1290)), "x-koi-pond-4": T((2150, 3230))}
for oid, (rx, ry) in RELOCATE.items():
    if oid in objects:
        objects[oid]["x"], objects[oid]["y"] = rx, ry

keep_ids = {b["obj"] for b in BUILDINGS}
# Drop previous city decor so the script is repeatable.
data["objects"] = [o for o in data["objects"] if not o["id"].startswith("city-")]

# Clearances: building footprints (+margin) and door corridors must be free of other solid objects.
zones = []
for b in BUILDINGS:
    zones.append(("footprint", b["footprint"], 70))
    d = b["door"]
    zones.append(("door", (d["x"] - 110, d["y"] - 70, 220, 260), 0))
removed = []
kept = []
for o in data["objects"]:
    r = fp_rect(o)
    # The Source of Memory is the tutorial landmark: it always stays.
    if o["id"] in keep_ids or o["kind"] == "ki-source" or not o.get("solid") or r is None:
        kept.append(o)
        continue
    if any(intersects(r, z[1], z[2]) for z in zones):
        removed.append(o["id"])
    else:
        kept.append(o)
data["objects"] = kept

# Inner walls that cross a building or its door corridor are removed (borders stay).
border = data.get("border", 3)
walls = data["obstacles"]
new_walls = walls[:border]
removed_walls = []
for w in walls[border:]:
    rect = (w["x"], w["y"], w["width"], w["height"])
    if any(intersects(rect, z[1], z[2]) for z in zones):
        removed_walls.append(rect)
    else:
        new_walls.append(w)
data["obstacles"] = new_walls

# Connecting roads from each door to the nearest point of the existing road network.
import math


def nearest_on_roads(pt):
    best = None
    for r in data["terrain"].get("roads", []):
        if r.get("city"):
            continue
        pts = r["points"]
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            dx, dy = x2 - x1, y2 - y1
            L = dx * dx + dy * dy
            t = 0 if not L else max(0, min(1, ((pt[0] - x1) * dx + (pt[1] - y1) * dy) / L))
            q = (x1 + t * dx, y1 + t * dy)
            d = math.hypot(q[0] - pt[0], q[1] - pt[1])
            if best is None or d < best[0]:
                best = (d, q)
    return best[1]


data["terrain"]["roads"] = [r for r in data["terrain"].get("roads", []) if not r.get("city")]
for b in BUILDINGS:
    d = (b["door"]["x"], b["door"]["y"])
    q = nearest_on_roads(d)
    if math.hypot(q[0] - d[0], q[1] - d[1]) < 30:
        continue
    mid = ((d[0] + q[0]) / 2 + (18 if d[0] < q[0] else -18), (d[1] + q[1]) / 2)
    data["terrain"]["roads"].append({"width": 110, "city": True,
                                     "points": [[d[0], d[1]], [round(mid[0]), round(mid[1])], [round(q[0]), round(q[1])]]})

# Street decor: lanterns beside the main roads between districts (non-solid garden beds too).
decor = []
lantern = {"kind": "stone-lantern", "asset": "stone-lantern", "width": 70, "height": 152, "anchorX": 0.5,
           "anchorY": 0.92, "solid": True, "expansion": True, "footprint": {"width": 30, "height": 22}}
for i, bd in enumerate(BUILDINGS):
    dr = bd["door"]
    for j, (ddx, ddy) in enumerate(((-185, 90), (185, 90), (0, 230))):
        decor.append({**lantern, "id": f"city-lantern-{i}-{j}", "x": dr["x"] + ddx, "y": dr["y"] + ddy})
    decor.append({"id": f"city-garden-{i}", "kind": "garden", "asset": "garden",
                  "x": dr["x"] + (240 if dr["x"] < _CX + SHIFT["x"] else -240), "y": dr["y"] + 40,
                  "width": 170, "height": 120, "anchorX": 0.5, "anchorY": 0.92, "solid": False})
# Decor must not sit in building footprints or door corridors.
decor = [o for o in decor if not any(intersects((o["x"] - 40, o["y"] - 30, 80, 60), z[1], z[2] + 20) for z in zones)]
data["objects"].extend(decor)

# City safe area: no combat spawns inside it.
before = len(data["enemies"])
inside = lambda p: CITY["x"] <= p["x"] <= CITY["x"] + CITY["width"] and CITY["y"] <= p["y"] <= CITY["y"] + CITY["height"]
data["enemies"] = [e for e in data["enemies"] if not inside(e)]

# Boars that stood inside the (larger) safe city are placed again on a ring just outside it.
removed_boars = before - len(data["enemies"])
import math as _m
for _i in range(removed_boars):
    _a = 2 * _m.pi * (_i + 0.5) / max(1, removed_boars) + 0.35
    _ring = _i % 3
    data["enemies"].append({
        "x": round(CITY["x"] + CITY["width"] / 2 + (CITY["width"] / 2 + 450 + _ring * 160) * _m.sqrt(2) * _m.cos(_a)),
        "y": round(CITY["y"] + CITY["height"] / 2 + (CITY["height"] / 2 + 450 + _ring * 120) * _m.sqrt(2) * _m.sin(_a)),
    })

# Existing NPCs: street NPCs stay on the street; shop/smith NPCs wait at their doors until the
# interiors of the shared city mechanics take over.
door = {b["id"]: b["door"] for b in BUILDINGS}
npc_by_id = {n["id"]: n for n in data["npcs"]}
for n in NPCS:
    npc_by_id[n["id"]].update(name=n["name"], role=n["role"], x=n["pos"][0], y=n["pos"][1], dialogue=n["dialogue"])
for rid, bid in (("merchant", "shop"), ("smith", "smithy")):
    npc_by_id[rid].update(x=door[bid]["x"] + 70, y=door[bid]["y"] + 30)

data["landmarks"] = [l for l in data["landmarks"] if not l.get("city")]
for b in BUILDINGS:
    data["landmarks"].append({"x": b["door"]["x"], "y": b["door"]["y"], "label": b["name"], "kind": "settlement", "city": True})

# Contract shape (src/game/city/types.ts). `bounds` keeps combat outside: the city is a safe area
# inside a normal combat continent. Residents become building NPCs (shown inside their building).
door = {b["id"]: b["door"] for b in BUILDINGS}
resident_ids = {r["id"] for r in RESIDENTS}
by_id = {n["id"]: n for n in data["npcs"]}
data["npcs"] = [n for n in data["npcs"] if n["id"] not in resident_ids] + [
    {"id": r["id"], "name": r["name"], "role": r["role"], "x": door[r["building"]]["x"],
     "y": door[r["building"]]["y"], "tint": r["tint"], "dialogue": r["dialogue"], "building": r["building"]}
    for r in RESIDENTS
]
data.pop("cityPlan", None)
data["city"] = {
    "name": data["settlement"],
    "bounds": CITY,
    "buildings": [
        {k: b[k] for k in ("id", "name", "district", "description", "objectId", "door")} for b in BUILDINGS
    ],
    "roads": [],
}

PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("removed objects:", len(removed), removed)
print("removed walls:", removed_walls)
print("enemies:", before, "->", len(data["enemies"]))
print("doors:", {b["id"]: b["door"] for b in BUILDINGS})
