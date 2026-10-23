"""Enlarges the playable continents of Aetheria, Nexus-9 and Pyra to the real size of the continent.

Run from the repo root:  python3 scripts/expand_continents.py
Owner decision 23.10.2026: the local city stays a safe area of about 4000 x 2500 units and the rest
of the continent is empty but reachable ground. The original open-world scene (city, roads, objects,
boars, zones and their floors) keeps its geometry and is translated so that its anchor lands where
the city stands on the painted atlas (docs/PLANET-GEOMETRY-2026-10-22.md). Nothing is rescaled.

Idempotent: a region that is already on layout 3 is left alone. Saves made on layout 2 are moved by
`layoutShifts["3"]` (see migrateLayout in src/game/session.ts).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGIONS = ROOT / "src/game/world/regions"
ZONES = ROOT / "src/game/world/zones.json"

# Bounding box of each painted continent on the planet atlas, in game units (planet.json scale).
CONTINENT = {"aether": (44300, 27400), "nexus": (39700, 26600), "pyra": (42000, 25300)}
LAYOUT = 3

zones = json.loads(ZONES.read_text(encoding="utf-8"))


def shift_xy(items, dx, dy):
    for it in items:
        it["x"] += dx
        it["y"] += dy


for rid, (W, H) in CONTINENT.items():
    path = REGIONS / f"{rid}.json"
    d = json.loads(path.read_text(encoding="utf-8"))
    if (d.get("layout") or 1) >= LAYOUT:
        print(rid, "already on layout", d["layout"])
        continue
    z = zones[rid]
    atlas = z["atlas"]
    fx = (atlas["settle"]["x"] - atlas["bbox"]["x0"]) / (atlas["bbox"]["x1"] - atlas["bbox"]["x0"])
    fy = (atlas["settle"]["y"] - atlas["bbox"]["y0"]) / (atlas["bbox"]["y1"] - atlas["bbox"]["y0"])
    old_w, old_h = d["width"], d["height"]
    old_a = z["anchor"]
    new_a = {"x": round(fx * W), "y": round(fy * H)}
    dx, dy = new_a["x"] - old_a["x"], new_a["y"] - old_a["y"]

    border = d.get("border", 3)
    top, left, right, bottom = d["obstacles"][:4]
    walls = [
        {"x": 0, "y": 0, "width": W, "height": top["height"]},
        {"x": 0, "y": top["height"], "width": left["width"], "height": H - top["height"]},
        {"x": W - right["width"], "y": top["height"], "width": right["width"], "height": H - top["height"]},
        {"x": left["width"], "y": H - bottom["height"], "width": W - left["width"] - right["width"],
         "height": bottom["height"]},
    ]
    inner = d["obstacles"][border:]
    shift_xy(inner, dx, dy)
    d["obstacles"] = walls + inner

    d["width"], d["height"] = W, H
    shift_xy([d["spawn"], d["market"]], dx, dy)
    for key in ("npcs", "enemies", "landmarks", "objects"):
        shift_xy(d[key], dx, dy)
    t = d["terrain"]
    shift_xy(t["paths"], dx, dy)
    shift_xy(t["plazas"], dx, dy)
    for r in t.get("roads", []):
        r["points"] = [[p[0] + dx, p[1] + dy] for p in r["points"]]
    for c in t.get("courts", []) or []:
        c["points"] = [[p[0] + dx, p[1] + dy] for p in c["points"]]
    # The organic zone floors stay with the original scene: it remains a coherent, finished area
    # around the city, and the continent beyond it is plain ground until its content is made.
    for zone in t.get("zones", []):
        zone["points"] = [[p[0] + dx, p[1] + dy] for p in zone["points"]]
    if "city" in d:
        c = d["city"]
        c["bounds"]["x"] += dx
        c["bounds"]["y"] += dy
        shift_xy([bd["door"] for bd in c["buildings"]], dx, dy)
    d["layout"] = LAYOUT
    d["layoutShifts"] = {**d.get("layoutShifts", {}), str(LAYOUT): {"x": dx, "y": dy}}
    path.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Named zones keep their place in the original scene; the map projection follows the new size
    # and anchor, so on the atlas they are the area around the city, at true scale.
    z["width"], z["height"] = W, H
    z["anchor"] = new_a
    for q in z["zones"]:
        q["x"] += dx
        q["y"] += dy
    print(rid, f"{old_w}x{old_h} -> {W}x{H}", "shift", (dx, dy), "anchor", new_a)

# Verdantia is laid out in TypeScript (src/game/city/verdantia.ts, src/game/world/forest.ts): the
# painted valley sits at FOREST_ORIGIN on a 49 000 x 31 400 continent. Only its map projection lives
# here; the atlas crop and minimap come from scripts/build_atlas_minimaps.py.
zones.setdefault("verdant", {
    "width": 49000, "height": 31400, "anchor": {"x": 34176, "y": 22400}, "zones": [],
    "atlas": {"settle": {"x": 755, "y": 498}, "bbox": {"x0": 245, "y0": 173, "x1": 977, "y1": 630},
              "crop": {"x0": 0, "y0": 0, "x1": 1, "y1": 1}},
})
ZONES.write_text(json.dumps(zones, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
