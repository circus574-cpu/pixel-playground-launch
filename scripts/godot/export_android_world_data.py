#!/usr/bin/env python3
"""Export geometry, stable PvE identities (4 continents + 6 Archipelago Islands) and Stage 4 world metadata."""
import base64
import json
import math
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGIONS = ROOT / "ports/godot-isometric-world/regions"
DATA_DIR = ROOT / "ports/godot-isometric-world/data"
OUT = ROOT / "src/server/godot/worldData.generated.json"
OUT_STAGE4 = ROOT / "src/server/godot/stage4Data.generated.json"


def _find_walkable_near(mask: bytes, grid: int, size: float, wx: float, wz: float) -> tuple[float, float]:
    """Return nearest walkable world coordinate (wx, wz) in [0..size]."""
    def is_ok(x: float, z: float) -> bool:
        if x < 24 or z < 24 or x > size - 24 or z > size - 24:
            return False
        gx = round((x / size) * (grid - 1))
        gz = round((z / size) * (grid - 1))
        return bool(mask[gz * grid + gx])

    if is_ok(wx, wz):
        return (round(wx, 3), round(wz, 3))
    for r in range(8, 220, 8):
        for k in range(16):
            ang = math.tau * k / 16.0
            cx = wx + math.cos(ang) * r
            cz = wz + math.sin(ang) * r
            if is_ok(cx, cz):
                return (round(cx, 3), round(cz, 3))
    return (round(wx, 3), round(wz, 3))


def export_region(land: str, bosses_by_continent: dict[str, list[dict]]):
    data = json.loads((REGIONS / land / "buildings.json").read_text())
    size, grid = float(data["world_size"]), int(data["grid_size"])
    mask = (REGIONS / land / "walkable.u8").read_bytes()
    if len(mask) != grid * grid:
        raise ValueError(f"{land}: expected {grid * grid} walkability bytes")
    bits = bytearray((len(mask) + 7) // 8)
    for idx, cell in enumerate(mask):
        if cell:
            bits[idx // 8] |= 1 << (idx % 8)

    targets = {}
    legacy_kills = {}
    treasures = {}

    def add(target_id, target):
        if target_id in targets:
            raise ValueError(f"{land}: duplicate target {target_id}")
        targets[target_id] = target

    half = size / 2

    def global_point(entry):
        return {"x": round(entry["x"] + half, 3), "z": round(entry["z"] + half, 3)}

    def treasure(entry, point, room=None):
        reward = {
            **point, "minLevel": entry["min_level"], "gold": entry["gold"], "xp": entry["xp"],
            **({"itemId": entry["item_id"]} if entry.get("item_id") else {}),
        }
        if room:
            reward["room"] = room
        treasures[entry["id"]] = reward

    for entry in data["treasures"]:
        treasure(entry, global_point(entry))
    for enemy in data["monsters"]:
        elite = enemy.get("is_elite", False)
        add(enemy["id"], {
            "kind": "monster",
            "actorId": enemy["actor_id"],
            "level": enemy["level"],
            "elite": elite,
            **global_point(enemy),
        })
        legacy_kills[f"{enemy['actor_id']}:{enemy['level']}:{int(elite)}"] = 1
    for index, animal in enumerate(data["fauna"]):
        add(f"animal_{animal['actor_id']}_{index}", {
            "kind": "animal", **global_point(animal),
        })

    # Place canonical continent bosses near the two highest-level exp zones (verified walkable!)
    exp_zones = sorted(data.get("exp_zones", []), key=lambda e: -int(e.get("level", e.get("min_lv", 1))))
    boss_anchors = {}
    for bi, boss in enumerate(bosses_by_continent.get(land, [])):
        ez = exp_zones[min(bi * 2, len(exp_zones) - 1)] if exp_zones else {"x": 450.0, "z": 450.0}
        raw_x = float(ez["x"]) + half + (52.0 if bi == 0 else -52.0)
        raw_z = float(ez["z"]) + half + (36.0 if bi == 0 else -36.0)
        bx, bz = _find_walkable_near(mask, grid, size, raw_x, raw_z)
        boss_anchors[boss["id"]] = {"x": bx, "z": bz}
        add(f"boss:{boss['id']}", {
            "kind": "boss",
            "bossId": boss["id"],
            "level": int(boss["level"]),
            "x": bx,
            "z": bz,
        })

    rooms = {}
    for maze in data["labyrinths"]:
        room = maze["id"]
        rooms[room] = {"minLevel": maze["level"], "grid": maze["grid"]}
        for enemy in maze["guardians"]:
            add(enemy["id"], {"kind": "guardian", "room": room, "level": enemy["level"]})
            key = f"{enemy['actor_id']}:{enemy['level']}:0"
            legacy_kills[key] = min(legacy_kills.get(key, maze["level"]), maze["level"])
        for entry in maze["chests"]:
            treasure(entry, {"x": (entry["tx"] + 0.5) * 74, "z": (entry["ty"] + 0.5) * 74}, room)

    gatherables = {
        entry["id"]: {
            **global_point(entry), "kind": entry["kind"],
            **({"itemId": entry["item_id"]} if entry.get("item_id") else {}),
        }
        for entry in data["gatherables"]
    }
    inns = {}
    for entry in data["buildings"]:
        if entry["role"] == "inn":
            x, z = entry.get("entrance", [entry["x"], entry["z"]])
            inns[entry["id"]] = global_point({"x": x, "z": z})

    return {
        "size": size, "gridSize": grid,
        "walkable": base64.b64encode(zlib.compress(bits, 9)).decode(),
        "targets": targets, "rooms": rooms, "legacyKills": legacy_kills,
        "treasures": treasures, "gatherables": gatherables, "inns": inns,
    }, boss_anchors


def export_island(isl: dict):
    """Export deterministic circular island walkability mask + PvE targets matching world.gd."""
    size = float(isl["world_size"])
    grid = int(isl["grid_size"])
    center = size * 0.5
    seed = int(isl.get("seed", 101))
    bits = bytearray((grid * grid + 7) // 8)
    for gz in range(grid):
        wz = gz * size / (grid - 1)
        for gx in range(grid):
            wx = gx * size / (grid - 1)
            dx = wx - center
            dz = wz - center
            ang = math.atan2(dz, dx)
            coast_r = 198.0 + math.sin(ang * 3.0 + seed * 0.13) * 14.0 + math.cos(ang * 5.0 - seed * 0.09) * 8.0
            if math.hypot(dx, dz) <= coast_r:
                idx = gz * grid + gx
                bits[idx // 8] |= 1 << (idx % 8)

    targets = {}
    legacy_kills = {}
    for enemy in isl.get("monsters", []):
        elite = bool(enemy.get("is_elite", False))
        targets[enemy["id"]] = {
            "kind": "monster",
            "actorId": enemy["actor_id"],
            "level": int(enemy["level"]),
            "elite": elite,
            "x": round(float(enemy["x"]), 3),
            "z": round(float(enemy["z"]), 3),
        }
        legacy_kills[f"{enemy['actor_id']}:{enemy['level']}:{int(elite)}"] = 1

    treasures = {}
    for entry in isl.get("treasures", []):
        treasures[entry["id"]] = {
            "x": round(float(entry["x"]), 3),
            "z": round(float(entry["z"]), 3),
            "minLevel": int(entry["min_level"]),
            "gold": int(entry["gold"]),
            "xp": int(entry["xp"]),
            **({"itemId": entry["item_id"]} if entry.get("item_id") else {}),
        }

    gatherables = {}
    for entry in isl.get("gatherables", []):
        gatherables[entry["id"]] = {
            "x": round(float(entry["x"]), 3),
            "z": round(float(entry["z"]), 3),
            "kind": entry["kind"],
            **({"itemId": entry["item_id"]} if entry.get("item_id") else {}),
        }

    return {
        "size": size,
        "gridSize": grid,
        "walkable": base64.b64encode(zlib.compress(bits, 9)).decode(),
        "targets": targets,
        "rooms": {},
        "legacyKills": legacy_kills,
        "treasures": treasures,
        "gatherables": gatherables,
        "inns": {},
    }


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    bosses_raw = json.loads((DATA_DIR / "bosses.json").read_text())["bosses"]
    bosses_by_cont: dict[str, list[dict]] = {}
    for b in bosses_raw:
        bosses_by_cont.setdefault(b["continent"], []).append(b)

    lands = ["pyra", "verdant", "aether", "nexus"]
    rows = []
    all_boss_anchors = {}
    for land in lands:
        region, anchors = export_region(land, bosses_by_cont)
        all_boss_anchors.update(anchors)
        targets = region.pop("targets")
        region_fields = [f'    {encoded(key)}: {encoded(value)},' for key, value in region.items()]
        entries = ",\n".join(f"      {encoded(key)}: {encoded(value)}" for key, value in targets.items())
        rows.append(f'  "{land}": {{\n' + "\n".join(region_fields) + '\n    "targets": {\n' + entries + '\n    }\n  }')

    islands_raw = json.loads((DATA_DIR / "islands.json").read_text())["islands"]
    for isl in islands_raw:
        region = export_island(isl)
        targets = region.pop("targets")
        region_fields = [f'    {encoded(key)}: {encoded(value)},' for key, value in region.items()]
        entries = ",\n".join(f"      {encoded(key)}: {encoded(value)}" for key, value in targets.items())
        rows.append(f'  "{isl["id"]}": {{\n' + "\n".join(region_fields) + '\n    "targets": {\n' + entries + '\n    }\n  }')

    OUT.write_text("{\n" + ",\n".join(rows) + "\n}\n", encoding="utf-8")

    # Export canonical Stage 4 metadata (8 bosses, 14 world events, 102 playable quests, 41 monster species loot, 6 islands)
    quests_raw = json.loads((DATA_DIR / "quests.json").read_text())
    wilderness = DATA_DIR / "quests_wilderness.json"
    if wilderness.is_file():
        quests_raw["quests"].extend(json.loads(wilderness.read_text())["quests"])
    monsters_raw = json.loads((DATA_DIR / "monsters.json").read_text())["monsters"]

    bosses_meta = {}
    for b in bosses_raw:
        anchor = all_boss_anchors.get(b["id"], {"x": 2048.0, "z": 2048.0})
        bosses_meta[b["id"]] = {
            "id": b["id"],
            "name": b["name"],
            "continent": b["continent"],
            "level": int(b["level"]),
            "xp": int(b["stats"]["xp"]),
            "x": anchor["x"],
            "z": anchor["z"],
            "lootTable": [
                {
                    "itemId": lt["itemId"],
                    "chancePercent": int(lt["chancePercent"]),
                    "minCount": int(lt.get("minCount", 1)),
                    "maxCount": int(lt.get("maxCount", 1)),
                }
                for lt in b.get("lootTable", [])
            ],
        }

    events_meta = {}
    for ev in quests_raw.get("events", []):
        rew = ev.get("reward", {})
        events_meta[ev["id"]] = {
            "id": ev["id"],
            "name": ev["name"],
            "continent": ev["continent"],
            "minLevel": int(ev.get("minLevel", 1)),
            "repeatability": str(ev.get("repeatability", "cooldown_300s")),
            "xp": int(rew.get("xp", 50)),
            "coins": int(rew.get("coins", 25)),
            **({"itemId": str(rew["itemId"])} if rew.get("itemId") else {}),
        }

    quests_meta = {}
    for q in quests_raw.get("quests", []):
        if not q.get("playableInCurrentRuntime", False):
            continue
        cond = q.get("unlockCondition", {})
        rew = q.get("reward", {})
        fr = rew.get("factionReputation")
        quests_meta[q["id"]] = {
            "id": q["id"],
            "title": q["title"],
            "continent": q["continent"],
            "category": q.get("category", "side"),
            "minLevel": int(cond.get("minLevel", 1)),
            "prereqs": list(cond.get("prerequisiteQuestIds", [])),
            "repeatable": bool(q.get("repeatable", False)),
            "stageCount": len(q.get("stages", [])),
            "xp": int(rew.get("xp", 40)),
            "coins": int(rew.get("coins", 25)),
            **({"itemId": str(rew["itemId"]), "itemCount": int(rew.get("itemCount", 1))} if rew.get("itemId") else {}),
            **({"factionId": str(fr["factionId"]), "factionAmount": int(fr["amount"])} if isinstance(fr, dict) else {}),
        }
        if q.get("frontier"):
            quests_meta[q["id"]]["frontierStages"] = [
                [
                    {"id": obj["id"], "count": int(obj.get("targetCount", 1)),
                     **({"treasureId": obj["targetId"]} if obj["type"] == "retrieve" else {}),
                     **({"spawnId": obj["targetSpawnId"]} if obj.get("targetSpawnId") else {})}
                    for obj in stage["objectives"]
                ]
                for stage in q["stages"]
            ]

    species_drops = {}
    for mid, md in monsters_raw.items():
        drops = [
            {"itemId": str(li["item"]), "chance": float(li["chance"])}
            for li in md.get("lootItems", [])
            if li.get("item")
        ]
        species_drops[mid] = drops

    islands_meta = {
        isl["id"]: {
            "id": isl["id"],
            "name": isl["name"],
            "recommendedLevel": int(isl["recommended_level"]),
            "voyageCost": int(isl["voyage_cost"]),
        }
        for isl in islands_raw
    }

    stage4_payload = {
        "bosses": bosses_meta,
        "events": events_meta,
        "quests": quests_meta,
        "speciesDrops": species_drops,
        "islands": islands_meta,
    }
    OUT_STAGE4.write_text(json.dumps(stage4_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Sync exact walkable arenaPos into Godot client's bosses.json
    bosses_doc = json.loads((DATA_DIR / "bosses.json").read_text())
    for b in bosses_doc["bosses"]:
        anchor = all_boss_anchors.get(b["id"])
        if anchor:
            b["arenaPos"] = [anchor["x"], anchor["z"]]
    (DATA_DIR / "bosses.json").write_text(json.dumps(bosses_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        f"Exported 4 continents + {len(islands_raw)} islands -> {OUT.name}; "
        f"{len(bosses_meta)} bosses, {len(events_meta)} events, {len(quests_meta)} quests, "
        f"{len(species_drops)} species drops -> {OUT_STAGE4.name}"
    )
