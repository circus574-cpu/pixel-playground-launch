#!/usr/bin/env python3
"""Cave entrances of the Superior v2 world and the dungeon-kit art -> ports/godot-pyra/data/dungeons.json, assets/dungeon/.

The browser world reserves 22 entrances (4 per continent, 1 per island) with the status "entrance reserved; interior
integration pending" and ships the `dungeon-kit` art pack (12 props). The interiors do not exist there, so the Godot port builds
them (labyrinth, key, gate, chests, guards) from this data at run time with `scripts/dungeon.gd`.
"""
import json
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ROOT = REPO / "ports" / "godot-pyra"
WORLDS = REPO / "public" / "game" / "worlds" / "superior-v2"
LANDS = ["pyra", "verdant", "aether", "nexus"] + [f"island-{i}" for i in range(1, 7)]


def main() -> None:
    lands = {}
    for land in LANDS:
        world = json.loads((WORLDS / land / "world.json").read_text())
        lands[land] = [
            {
                "id": d["id"],
                "instanceId": d["instanceId"],
                "kind": d["kind"],
                "x": d["overworldEntrance"]["x"],
                "y": d["overworldEntrance"]["y"],
            }
            for d in world["dungeons"]
        ]
    pack_dir = next((REPO / "public" / "game" / "assets" / "gpu" / "dungeon-kit").glob("*/pack.json")).parent
    out = ROOT / "assets" / "dungeon"
    out.mkdir(parents=True, exist_ok=True)
    art = []
    for f in sorted(pack_dir.glob("dungeon-kit-*.webp")):
        name = f.stem.removeprefix("dungeon-kit-")
        shutil.copyfile(f, out / f"{name}.webp")
        art.append(name)
    (ROOT / "data" / "dungeons.json").write_text(json.dumps({"lands": lands, "art": art}, ensure_ascii=False, indent=1))
    print(json.dumps({"entrances": sum(len(v) for v in lands.values()), "art": art}))


if __name__ == "__main__":
    main()
