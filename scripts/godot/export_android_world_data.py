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

    def add(target_id, target):
        if target_id in targets:
            raise ValueError(f"{land}: duplicate target {target_id}")
        targets[target_id] = target

    half = size / 2
    for enemy in data["monsters"]:
        add(enemy["id"], {
            "kind": "monster", "level": enemy["level"], "elite": enemy.get("is_elite", False),
            "x": round(enemy["x"] + half, 3), "z": round(enemy["z"] + half, 3),
        })
    for index, animal in enumerate(data["fauna"]):
        add(f"animal_{animal['actor_id']}_{index}", {
            "kind": "animal", "x": round(animal["x"] + half, 3), "z": round(animal["z"] + half, 3),
        })

    rooms = {}
    for maze in data["labyrinths"]:
        room = maze["id"]
        rooms[room] = {"minLevel": maze["level"], "grid": maze["grid"]}
        for enemy in maze["guardians"]:
            add(enemy["id"], {"kind": "guardian", "room": room, "level": enemy["level"]})

    return {
        "size": size, "gridSize": grid,
        "walkable": base64.b64encode(zlib.compress(bits, 9)).decode(),
        "targets": targets, "rooms": rooms,
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
