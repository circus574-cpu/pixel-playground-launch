#!/usr/bin/env python3
"""Build the admin atlas from an Android OTA extraction and a Godot runtime index."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MAPS = ROOT / "public/game/admin/android-superior"
COLLECTIONS = {
    "buildings": "building", "npcs": "npc", "monsters": "spawn", "fauna": "fauna",
    "sub_biomes": "biome", "exp_zones": "zone", "labyrinths": "dungeon", "treasures": "secret",
    "gatherables": "resource", "waystones": "waystone", "props": "scenery",
}


def load(root, path):
    return json.loads((root / path).read_text())


def island_background(island, out):
    """Same shoreline, trail and hills as _load_procedural_island in world.gd."""
    grid, size, seed = (island[key] for key in ("grid_size", "world_size", "seed"))
    middle = size / 2
    harbor = island["safe_harbor"]
    tint = {"verdant": (65, 108, 66), "pyra": (111, 66, 56),
            "aether": (104, 137, 153), "nexus": (87, 109, 108)}[island["theme"]]
    pixels = []
    for row in range(grid):
        for col in range(grid):
            x, z = col * size / (grid - 1), row * size / (grid - 1)
            dx, dz = x - middle, z - middle
            angle = math.atan2(dz, dx)
            edge = (198 + math.sin(angle * 3 + seed * .13) * 14
                    + math.cos(angle * 5 - seed * .09) * 8 - math.hypot(dx, dz))
            if edge < 12:
                f = max(0, 1 + edge / 54)
                pixels.append((round(12 + f * 24), round(41 + f * 64), round(64 + f * 71)))
            elif abs(dx) < 16 and 120 <= z <= harbor[1] + 12:
                pixels.append((140, 122, 92))
            elif edge < 28:
                pixels.append((174, 157, 117))
            else:
                contour = (math.sin(x * .028 + seed) * math.cos(z * .025 - seed * .4) + 1) * 5.5
                pixels.append(tuple(round(channel + contour * 3) for channel in tint))
    image = Image.new("RGB", (grid, grid))
    image.putdata(pixels)
    image.resize((512, 512), Image.Resampling.BICUBIC).save(out, quality=91, method=6)


def make_region(meta, data, bosses, quests, runtime, image_url):
    land = meta["id"]
    island = meta["kind"] == "island"
    size = data["world_size"]
    shift = 0 if island else size / 2

    def position(x, z, offset=shift):
        point = [round(x + offset, 3), round(z + offset, 3)]
        if not all(math.isfinite(v) and 0 <= v <= size for v in point):
            raise ValueError(f"{land}: point outside Android extent {point}")
        return point

    points, roads, unmapped = [], [], []

    def add(kind, uid, name, point, detail="", **extra):
        points.append({"id": f"{kind}:{uid}", "kind": kind, "title": name,
                       "position": point, "detail": detail, **extra})

    if island:
        x, z = data["safe_harbor"]
        add("capital", land, f"Przystań · {meta['name']}", position(x, z), data["lore"],
            radius=data["safe_radius"], level=data["recommended_level"])
        roads.append({"tier": "main", "points": [[size / 2, z], [size / 2, 136]]})
        data = {**data, "npcs": [data["npc"]] if data.get("npc") else [], "props": []}
    else:
        add("capital", land, meta["settlement"], position(*data["capital_center"]),
            "Centrum strefy bezpiecznej", radius=data["safe_city_radius"])
        roads = [{"tier": road["tier"], "points": [position(*p) for p in road["pts"]]}
                 for road in data["roads"]]
    monsters = {}

    for collection, kind in COLLECTIONS.items():
        for i, row in enumerate(data.get(collection, [])):
            uid = row.get("id") or f"{land}-{i + 1}"
            marker_kind = "town" if collection == "buildings" and row.get("map_kind") == "town" else kind
            point = position(row["x"], row["z"])
            title = row.get("title") or row.get("name") or row.get("actor_id") or uid
            details = [row[k] for k in ("role", "subtitle", "lore", "kind", "actor_id", "zone_id")
                       if row.get(k)]
            extra = {dst: row[key] for key, dst in (("level", "level"), ("min_level", "level"),
                     ("radius", "radius"), ("patrol_radius", "radius"), ("gold", "gold"),
                     ("xp", "xp"), ("item_id", "item")) if key in row}
            if collection == "labyrinths":
                extra["grid"] = row["grid"]
                extra["entryCell"] = row["spawn"]
                extra["exitCell"] = row["exit"]
            if collection == "buildings":
                details.append("Dostępne wejście" if row.get("enterable") else "Budynek zewnętrzny")
                if row.get("entrance"):
                    add("door", uid, f"Wejście · {title}", position(*row["entrance"]), row.get("role", ""))
            add(marker_kind, uid, title, point, " · ".join(details), **extra)
            if kind == "spawn":
                monsters.setdefault(row["actor_id"], []).append(points[-1]["id"])

    for boss in bosses:
        if boss["continent"] == land:
            add("boss", boss["id"], boss["name"], position(*boss["arenaPos"], offset=0),
                boss.get("behavior", ""), level=boss["level"], arena=boss.get("locationName", ""),
                stats=boss["stats"], loot=boss.get("lootTable", []))
            monsters.setdefault(boss["guardian"], []).append(points[-1]["id"])

    for event in quests["events"]:
        if event["continent"] == land:
            placement = runtime["events"][event["id"]]
            add("event", event["id"], event["name"], position(*placement["position"], offset=0),
                event.get("description", ""), level=event["minLevel"], eventSpawn=placement["spawn"],
                eventSpawnCount=placement["count"])

    npc_points = [p for p in points if p["kind"] == "npc"]
    quest_rows = []
    for quest in quests["quests"]:
        qid = quest["id"]
        start_land = quest["continent"]
        relevant = [
            (stage, obj) for stage in quest["stages"] for obj in stage["objectives"]
            if (obj.get("continent") or start_land) == land
        ]
        if start_land != land and not (relevant and quest["playableInCurrentRuntime"]):
            continue
        start = runtime.get("givers", {}).get(qid, []) if start_land == land else []
        quest_row = {"id": qid, "title": quest["title"], "level": quest["recommendedLevel"],
                     "giver": quest["giverName"], "sourceLand": start_land,
                     "active": quest["playableInCurrentRuntime"], "summary": quest["summary"],
                     "giverPoints": [npc_points[i]["id"] for i in start], "objectives": []}
        quest_rows.append(quest_row)
        for i in start:
            add("quest", f"{qid}:{i}", quest["title"], npc_points[i]["position"],
                f"{qid} · Zleca {npc_points[i]['title']}", questId=qid, level=quest["recommendedLevel"])
        for stage, obj in relevant:
            oid = obj["id"]
            label = obj["description"]
            refs = []
            if oid in runtime.get("objectives", {}):
                point = position(*runtime["objectives"][oid], offset=0)
                add("objective", oid, label, point, f"{qid} · {stage['title']}", questId=qid, radius=135)
                refs.append(points[-1]["id"])
            for i in runtime.get("talk", {}).get(oid, []):
                refs.append(npc_points[i]["id"])
            if quest["playableInCurrentRuntime"] and obj["type"] == "combat":
                refs += monsters.get(obj.get("targetId"), [])
            quest_row["objectives"].append({"id": oid, "title": label, "refs": refs})
    objectives_by_target = {}
    for quest in quests["quests"]:
        for stage in quest["stages"]:
            for objective in stage["objectives"]:
                objectives_by_target.setdefault(objective.get("targetId"), set()).add(f"objective:{objective['id']}")
    for key in ("famous", "hidden"):
        for row in quests[key]:
            if row["continent"] != land:
                continue
            matches = [p for p in points if p.get("questId") and p["kind"] == "objective"
                       and p["id"] in objectives_by_target.get(row["id"], set())]
            if not matches:
                unmapped.append({"id": row["id"], "title": row["name"],
                                 "detail": row.get("lore", row.get("description", ""))})
            for i, match in enumerate(matches):
                add("secret" if key == "hidden" else "landmark", f"{row['id']}:{i}", row["name"],
                    match["position"], row.get("lore", row.get("description", "")))
    if len({p["id"] for p in points}) != len(points):
        raise ValueError(f"{land}: duplicate map marker ID")
    return {"id": land, "size": size, "image": image_url, "procedural": island,
            "points": points, "roads": roads, "quests": quest_rows, "unmapped": unmapped}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("extraction", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("core_pck", type=Path)
    parser.add_argument("regions_pck", type=Path)
    parser.add_argument("private_snapshot", type=Path)
    args = parser.parse_args()
    if args.private_snapshot.resolve().is_relative_to(ROOT):
        parser.error("Write the administrator snapshot outside the public checkout.")
    src = args.extraction
    manifest = load(args.manifest.parent, args.manifest.name)["manifest"]
    pack_hashes = {}
    for key, path in (("core-c101", args.core_pck), ("world-regions", args.regions_pck)):
        with path.open("rb") as pack:
            digest = hashlib.file_digest(pack, "sha256").hexdigest()
        if digest != manifest["packs"][key]["sha256"]:
            raise ValueError(f"{key}: invalid SHA-256 for Android OTA {manifest['version']}")
        pack_hashes[key] = digest
    planet = load(src, "data/map.json")
    bosses = load(src, "data/bosses.json")["bosses"]
    islands = {row["id"]: row for row in load(src, "data/islands.json")["islands"]}
    quests = load(src, "data/quests.json")
    runtime = load(src, "runtime.json")
    MAPS.mkdir(parents=True, exist_ok=True)
    with Image.open(src / "atlas/planet_real_world.png") as image:
        image.convert("RGB").save(MAPS / "planet.webp", quality=92, method=6)
    regions = {}
    for meta in planet["regions"]:
        land = meta["id"]
        if land in islands:
            raw = islands[land]
            island_background(raw, MAPS / f"{land}.webp")
        else:
            raw = load(src, f"{land}/buildings.json")
            Image.open(src / f"{land}/minimap_hq.png").convert("RGB").save(
                MAPS / f"{land}.webp", quality=91, method=6)
        regions[land] = make_region(meta, raw, bosses, quests, runtime.get(land, {}),
                                    f"/game/admin/android-superior/{land}.webp")
    index = {"version": manifest["version"], "createdAt": manifest["createdAt"],
             "width": planet["mapW"], "height": planet["mapH"], "packHashes": pack_hashes,
             "image": "/game/admin/android-superior/planet.webp",
             "bosses": [{"id": f"boss:{boss['id']}", "land": boss["continent"], "title": boss["name"],
                         "position": runtime[boss["continent"]]["planetBosses"][boss["id"]]} for boss in bosses],
             "regions": [{**{key: row[key] for key in ("id", "kind", "name", "outline", "label")},
                          "islandPin": islands[row["id"]]["atlas_pos"] if row["id"] in islands else None}
                         for row in planet["regions"]],
             "pendingBosses": ["Azh’Kar", "Varkessa", "Nhar’Rok", "Ghorum", "Elaris", "Morgath",
                               "Shirokan", "Tenshu", "Axiom-Omega", "Leviatan Zero"]}
    args.private_snapshot.parent.mkdir(parents=True, exist_ok=True)
    # Restrict the exported coordinates on disk before writing the snapshot.
    fd = os.open(args.private_snapshot, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as output:
        output.write(json.dumps({"index": index, "regions": regions}, ensure_ascii=False,
                                separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
