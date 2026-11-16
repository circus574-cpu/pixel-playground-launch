#!/usr/bin/env python3
"""Bosses of the browser game -> ports/godot-pyra/data/bosses.json.

Reads /tmp/godot-bosses/bosses.json (npx tsx scripts/godot/export-bosses.ts), keeps what the Godot runtime plays (stats,
phases, attacks, loot table, the combat translation `monster`, the guardian whose art the boss wears and the sound folder),
and checks that every loot item exists in data/economy.json and every guardian / summon kind in data/monsters.json.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "ports" / "godot-pyra"
SRC = Path("/tmp/godot-bosses/bosses.json")


def main() -> int:
    src = json.loads(SRC.read_text())
    items = {i["id"] for i in json.loads((ROOT / "data" / "economy.json").read_text())["items"]}
    monsters = json.loads((ROOT / "data" / "monsters.json").read_text())["monsters"]
    out = []
    problems = []
    for b in src["bosses"]:
        if b["guardian"] not in monsters:
            problems.append(f"{b['id']}: unknown guardian {b['guardian']}")
        for drop in b["lootTable"]:
            if drop["itemId"] not in items:
                problems.append(f"{b['id']}: loot item {drop['itemId']} is not in the economy catalogue")
        for s in b["monster"]["skills"]:
            kind = (s.get("summon") or {}).get("kind")
            if kind and kind not in monsters:
                problems.append(f"{b['id']}: summons unknown {kind}")
        keep = {k: b[k] for k in (
            "id", "name", "title", "continent", "level", "speed", "range", "agro", "stats", "behavior", "weakness",
            "lore", "locationName", "associatedLocationId", "phases", "attacks", "lootTable", "guardian", "sound", "monster",
        )}
        out.append(keep)
    if problems:
        print("\n".join(problems))
        return 1
    (ROOT / "data" / "bosses.json").write_text(json.dumps({"preview": src["preview"], "bosses": out}, ensure_ascii=False, separators=(",", ":")))
    print(json.dumps({"bosses": len(out), "bytes": (ROOT / "data" / "bosses.json").stat().st_size}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
