"""Export the placeable graphics kit for world builders (Codex): docs/world-asset-kit.json.

  python3 scripts/export_world_asset_kit.py
Installed objects/terrains come from src/game/assets/imported.json (render bindings); the recommended display
size, anchor and collision footprint of every object asset are the medians of how the existing regions already use it
(src/game/world/regions/*.json). Pending items are generated on the GPU pod but not installed yet.
"""
import json, statistics, collections
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
imported = json.loads((REPO / "src/game/assets/imported.json").read_text())
rb, assets = {}, {}


def walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == "renderBindings" and isinstance(v, dict):
                rb.update(v)
        if "id" in o and "url" in o:
            assets[o["id"]] = o
        for v in o.values():
            walk(v)
    elif isinstance(o, list):
        for v in o:
            walk(v)


walk(imported)
use = collections.defaultdict(list)
for f in sorted((REPO / "src/game/world/regions").glob("*.json")):
    for o in json.loads(f.read_text()).get("objects", []):
        use[o.get("asset") or o["kind"]].append(o)


def med(xs):
    return round(statistics.median(xs), 2) if xs else None


def placement(asset_key):
    items = use.get(asset_key, [])
    if not items:
        return None
    fp = [o["footprint"] for o in items if o.get("footprint")]
    return {"uses": len(items), "width": med([o["width"] for o in items]), "height": med([o["height"] for o in items]),
            "anchorX": med([o["anchorX"] for o in items]), "anchorY": med([o["anchorY"] for o in items]),
            "solid": sum(1 for o in items if o.get("solid")) > len(items) / 2,
            "footprint": {"width": med([f["width"] for f in fp]), "height": med([f["height"] for f in fp])} if fp else None}


kit = {"generated": "2026-10-23", "objects": [], "terrains": [], "pending": []}
for key, b in sorted(rb.items()):
    a = assets.get(b["asset"], {})
    entry = {"binding": key, "asset": b["asset"], "pixels": [a.get("width"), a.get("height")], "frame": b.get("frame"),
             "fit": b.get("fit"), "layer": b.get("layer", "objects" if key.startswith("object.") else None), "tileSize": b.get("tileSize")}
    if key.startswith("object."):
        asset_key = key.split(".", 1)[1]
        entry["regionAsset"] = asset_key
        entry["placement"] = placement(asset_key)
        kit["objects"].append(entry)
    else:
        kit["terrains"].append(entry)
kit["pending"] = [
    {"set": "city-pyra-c1", "status": "generated on the pod (dream + anime), not matted or installed",
     "items": ["hall-council", "market-stall", "inn-tavern", "smithy-forge", "depot-warehouse", "arena-dojo", "gate-fortress", "wall-segment",
               "tower-watch", "fountain-fire", "house-small", "bridge-stone", "tree-maple-red", "tree-pine-dark", "rocks-cluster", "banner-pole",
               "lantern-stone", "steps-stone"]},
    {"set": "textures-v3-full", "status": "494 textures generated (247 x 2 seeds); refiner restyle in progress; not installed",
     "groups": ["verdant", "aether", "nexus", "pyra", "rock", "water"]},
    {"set": "landscape-v2-full4", "status": "mountains, volcanoes, rocks, trees and 8 neutral animals generated, not matted or installed"},
    {"set": "forge-parts", "status": "installed as pack pyra-smithy 1.1.0 (portrait smithy room only)"},
]
(REPO / "docs/world-asset-kit.json").write_text(json.dumps(kit, indent=1, ensure_ascii=False) + "\n")
print(len(kit["objects"]), "objects", len(kit["terrains"]), "terrains")
