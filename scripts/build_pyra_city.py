"""Builds the functional city of Pyra (Legends) into src/game/world/regions/pyra.json.

Run from the repo root:  python3 scripts/build_pyra_city.py
Idempotent: starts from the current region file, places six service buildings on a ring around the
central plaza (each in its own district, >= 700 units from the others), adds doors, connecting
roads, residents and the safe-area data, and removes combat spawns from the city.

Scope (docs/CITY-INTEGRATION-CONTRACT-2026-10-23.md): data, layout and look only. Shared mechanics
(entering buildings, trade, smithy, depot, training, save schema) belong to the other branch.
"""
import json
import math
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "src/game/world/regions/pyra.json"
data = json.loads(PATH.read_text(encoding="utf-8"))

CITY = {"x": 1350, "y": 950, "width": 2050, "height": 1750}

# Existing sprites are reused (fortress, war shrines); the extra buildings are clones of a war shrine
# (placeholders until dedicated art exists, see docs/CITY-PYRA-2026-10-23.md).
BUILDINGS = [
    dict(id="hall", obj="fortress-0", pos=(2400, 1150), district="Bramy Twierdzy", name="Sala Przysięgi",
         description="Serce Twierdzy Popiołu. Tu składa się przysięgę, przyjmuje zadania i poznaje historię klanów."),
    dict(id="shop", obj="city-shrine-shop", clone="war-shrine-1", pos=(3100, 1450), district="Targ Klanowy",
         name="Targ Klanów",
         description="Kupcy klanów wymieniają kły na monety, mikstury i pancerze."),
    dict(id="arena", obj="war-shrine-2", pos=(3100, 2200), district="Pole Treningowe", name="Plac Ćwiczeń Klanów",
         description="Plac z manekinem treningowym. Sprawdzaj prawdziwe zdolności bez ryzyka i nagród."),
    dict(id="smithy", obj="city-shrine-smithy", clone="war-shrine-1", pos=(2400, 2460), district="Palenisko",
         name="Kuźnia Żaru", description="Kowale żaru hartują i wzmacniają ostrza w ogniu szczelin."),
    dict(id="depot", obj="city-shrine-depot", clone="war-shrine-1", pos=(1650, 2390), district="Skarbce",
         name="Skarbiec Klanu",
         description="Strzeżony skarbiec z osobistą skrzynią na przedmioty każdej postaci."),
    dict(id="inn", obj="war-shrine-1", pos=(1700, 1450), district="Ostoja",
         name="Gospoda Pod Żarem", description="Ciepła gospoda przy ognisku, gdzie można odpocząć i odzyskać siły."),
]

NPCS = [
    dict(id="guide", name="Kaena", role="Strażniczka przysięgi", pos=(2470, 2230), tint=11071695,
         dialogue="Honor zaczyna się od dotrzymanej obietnicy. Stań na Arenie Dziedzictwa, potem wróć i opowiedz, co usłyszałeś w ciszy ruin."),
    dict(id="hunter", name="Rokan", role="Mistrz polowania", pos=(2660, 1750), tint=16762788,
         dialogue="Dziki z kanionu podchodzą pod bramy. Pokonaj trzy, a otrzymasz ostrze godne pierwszej próby."),
]
RESIDENTS = [
    dict(id="steward", building="hall", name="Tsubasa", role="Zarządca Sali Przysięgi", tint=15390133,
         dialogue="Sala stoi otworem. Przysięga złożona w popiele trwa dłużej niż ta spisana atramentem."),
    dict(id="merchant", building="shop", name="Yumi", role="Kupczyni klanów", tint=14070783,
         dialogue="Nawet wojownik potrzebuje zapasów. Kły wymienisz tu na monety, mikstury i pancerze."),
    dict(id="trainer", building="arena", name="Kenzo", role="Mistrz ćwiczeń", tint=16755370,
         dialogue="Manekin nie oddaje ciosów i nie płaci nagród. Użyj każdej zdolności i zapamiętaj, jak działa."),
    dict(id="keeper", building="depot", name="Mitsu", role="Strażniczka skarbca", tint=12116191,
         dialogue="Skrzynia jest twoja i tylko twoja. Klan strzeże jej jak własnego ognia."),
    dict(id="smith", building="smithy", name="Goro", role="Kowal żaru", tint=10802687,
         dialogue="Ostrze nie walczy za ciebie. Załóż je i wróć; za 15 monet zahartuję je w ogniu szczelin."),
    dict(id="innkeeper", building="inn", name="Akane", role="Gospodyni ogniska", tint=16766139,
         dialogue="Usiądź przy ogniu. Zmęczony wojownik to martwy wojownik, a ja nie lubię pustych ław."),
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
# Street NPCs keep their place next to the start (only translated, not spread).
for _n in NPCS:
    _n["pos"] = (_n["pos"][0] + SHIFT["x"], _n["pos"][1] + SHIFT["y"])


def fp_rect(o):
    f = o.get("footprint")
    if not f:
        return None
    return (o["x"] - f["width"] / 2, o["y"] + f.get("offsetY", 0) - f["height"] / 2, f["width"], f["height"])


def intersects(a, b, margin=0):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return not (ax + aw + margin <= bx or bx + bw + margin <= ax or ay + ah + margin <= by or by + bh + margin <= ay)


# Drop previous city additions so the script is repeatable.
data["objects"] = [o for o in data["objects"] if not o["id"].startswith("city-")]
objects = {o["id"]: o for o in data["objects"]}
for b in BUILDINGS:
    if "clone" in b:
        src = objects[b["clone"]]
        clone = {**json.loads(json.dumps(src)), "id": b["obj"]}
        data["objects"].append(clone)
        objects[b["obj"]] = clone
for b in BUILDINGS:
    o = objects[b["obj"]]
    o["x"], o["y"] = b["pos"]
    f = o["footprint"]
    b["footprint"] = fp_rect(o)
    b["door"] = {"x": o["x"], "y": int(o["y"] + f["height"] / 2 + 55)}
    b["objectId"] = o["id"]

keep_ids = {b["obj"] for b in BUILDINGS}
zones = []
for b in BUILDINGS:
    zones.append((b["footprint"], 70))
    d = b["door"]
    zones.append(((d["x"] - 110, d["y"] - 70, 220, 260), 0))

# The fortress and its tutorial point always stay; other solid clutter on a building or door goes.
removed = []
kept = []
for o in data["objects"]:
    r = fp_rect(o)
    if o["id"] in keep_ids or o["kind"] == "fortress" or not o.get("solid") or r is None:
        kept.append(o)
    elif any(intersects(r, z, m) for z, m in zones):
        removed.append(o["id"])
    else:
        kept.append(o)
data["objects"] = kept

border = data.get("border", 3)
new_walls = data["obstacles"][:border]
removed_walls = []
for w in data["obstacles"][border:]:
    rect = (w["x"], w["y"], w["width"], w["height"])
    if any(intersects(rect, z, m) for z, m in zones):
        removed_walls.append(rect)
    else:
        new_walls.append(w)
data["obstacles"] = new_walls


def nearest_on_network(p):
    best = None
    for r in data["terrain"]["paths"] + data["terrain"]["plazas"]:
        cx = min(max(p[0], r["x"] + 40), r["x"] + r["width"] - 40)
        cy = min(max(p[1], r["y"] + 40), r["y"] + r["height"] - 40)
        dist = math.hypot(cx - p[0], cy - p[1])
        if best is None or dist < best[0]:
            best = (dist, (cx, cy))
    return best[1]


# Connecting roads from each door to the nearest path or plaza (presentation; collisions come from footprints).
data["terrain"]["roads"] = [r for r in data["terrain"]["roads"] if not r.get("city")]
for b in BUILDINGS:
    d = (b["door"]["x"], b["door"]["y"])
    target = nearest_on_network(d)
    if math.hypot(target[0] - d[0], target[1] - d[1]) < 30:
        continue
    mid = ((d[0] + target[0]) / 2 + (18 if d[0] < target[0] else -18), (d[1] + target[1]) / 2)
    data["terrain"]["roads"].append({"width": 110, "city": True,
                                     "points": [[d[0], d[1]], [round(mid[0]), round(mid[1])],
                                                [round(target[0]), round(target[1])]]})

# Street decor along the connectors: clan banners and statues.
tmpl = next(o for o in data["objects"] if o["kind"] == "clan-banner")
garden = next(o for o in data["objects"] if o["kind"] == "statue")
decor = []
for i, b in enumerate(BUILDINGS):
    d = b["door"]
    for j, (dx, dy) in enumerate(((-185, 90), (185, 90))):
        decor.append({**json.loads(json.dumps(tmpl)), "id": f"city-banner-{i}-{j}", "x": d["x"] + dx, "y": d["y"] + dy})
    decor.append({**json.loads(json.dumps(garden)), "id": f"city-garden-{i}", "x": d["x"] + (240 if d["x"] < 2400 else -240),
                  "y": d["y"] + 40})
decor = [o for o in decor if not any(
    intersects((o["x"] - 40, o["y"] - 30, 80, 60), z, m + 15) for z, m in zones if m == 70)]
# Keep decor off the door corridors and off everything solid already placed.
solid = [fp_rect(o) for o in data["objects"] if o.get("solid") and fp_rect(o)]
decor = [o for o in decor if not any(intersects((o["x"] - 40, o["y"] - 30, 80, 60), s, 10) for s in solid)
         and not any(intersects((o["x"] - 25, o["y"] - 18, 50, 36), z, 0) for z, m in zones if m == 0)]
data["objects"].extend(decor)

before = len(data["enemies"])
# Boars keep at least 400 units from the city border, so a hunter never fights at the gate.
GATE = 400
inside = lambda p: (CITY["x"] - GATE <= p["x"] <= CITY["x"] + CITY["width"] + GATE
                    and CITY["y"] - GATE <= p["y"] <= CITY["y"] + CITY["height"] + GATE)
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

npc_by_id = {n["id"]: n for n in data["npcs"]}
for n in NPCS:
    npc_by_id[n["id"]].update(name=n["name"], role=n["role"], x=n["pos"][0], y=n["pos"][1], dialogue=n["dialogue"])
door = {b["id"]: b["door"] for b in BUILDINGS}
for rid, bid in (("merchant", "shop"), ("smith", "smithy")):
    npc_by_id[rid].update(x=door[bid]["x"] + 70, y=door[bid]["y"] + 30)

data["landmarks"] = [l for l in data["landmarks"] if not l.get("city")]
# The "Szczeliny" danger marker stood where the training yard is now; it moves just outside the safe city.
for l in data["landmarks"]:
    if l["label"] == "Szczeliny":
        l["x"], l["y"] = CITY["x"] + CITY["width"] + 500, CITY["y"] + CITY["height"] // 2
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
print("decor added:", len(decor))
print("doors:", {b["id"]: b["door"] for b in BUILDINGS})
