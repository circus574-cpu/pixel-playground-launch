#!/usr/bin/env python3
"""Export geometry and stable PvE identities from the isometric Godot source."""
import base64
import json
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGIONS = ROOT / "ports/godot-isometric-world/regions"
OUT = ROOT / "src/server/godot/worldData.generated.json"


def export_region(land):
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
            "kind": "monster", "level": enemy["level"], "elite": elite, **global_point(enemy),
        })
        legacy_kills[f"{enemy['actor_id']}:{enemy['level']}:{int(elite)}"] = 1
    for index, animal in enumerate(data["fauna"]):
        add(f"animal_{animal['actor_id']}_{index}", {
            "kind": "animal", **global_point(animal),
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
    }


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    lands = ["pyra", "verdant", "aether", "nexus"]
    rows = []
    for land in lands:
        region = export_region(land)
        targets = region.pop("targets")
        region_fields = [f'    {encoded(key)}: {encoded(value)},' for key, value in region.items()]
        entries = ",\n".join(f"      {encoded(key)}: {encoded(value)}" for key, value in targets.items())
        rows.append(f'  "{land}": {{\n' + "\n".join(region_fields) + '\n    "targets": {\n' + entries + '\n    }\n  }')
    OUT.write_text("{\n" + ",\n".join(rows) + "\n}\n")
