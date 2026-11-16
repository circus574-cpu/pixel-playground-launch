#!/usr/bin/env python3
"""Peaceful animals for the Godot port: sheets cut by scripts/gpu/ingest_creature_sheet.py (public/game/assets/gpu/enemy-v3-<A-xx>/) ->
ports/godot-pyra/data/animals.json (the actor of each animal) and assets/monsters/<world>-animal-<a-xx>.webp.

An animal appears in the game only once it is listed in data/animals.json (scripts/animals.gd). Animals whose sheet is not ready yet are skipped
and reported. The sheet's rows are walk, flee (the slot of the attack row of monster sheets), fall: here `attack` becomes the looping clip
`run` (monster.gd runs it while an animal flees) and `skill` is dropped.

  python3 scripts/godot/prepare_animals.py [--public DIR] [--port DIR]
"""
import argparse
import glob
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--public", default=str(ROOT / "public"))
    parser.add_argument("--port", default=str(ROOT / "ports" / "godot-pyra"))
    args = parser.parse_args()
    pub, port = Path(args.public), Path(args.port)
    food = json.loads((port / "data" / "food.json").read_text())
    target = port / "data" / "animals.json"
    animals = json.loads(target.read_text())["animals"] if target.exists() else {}
    out_dir = port / "assets" / "monsters"
    out_dir.mkdir(parents=True, exist_ok=True)
    ready, missing = [], []
    for animal in food["animals"]:
        aid = animal["id"]
        packs = sorted(glob.glob(str(pub / f"game/assets/gpu/enemy-v3-{aid}/*/pack.json")))
        if not packs:
            missing.append(aid)
            continue
        pack = json.loads(Path(packs[-1]).read_text())
        actor, asset = pack["actors"][0], pack["assets"][0]
        name = f"{animal['world']}-animal-{aid.lower()}"
        sheet = out_dir / f"{name}.webp"
        shutil.copyfile(pub / asset["url"].lstrip("/"), sheet)
        frames = json.loads((pub / asset["atlasUrl"].lstrip("/")).read_text())["frames"]
        frames = {f["filename"]: f for f in frames} if isinstance(frames, list) else frames
        clips = {}
        for clip_name, clip in actor["clips"].items():
            if clip_name == "skill":
                continue
            directions = {}
            for direction, names in clip["directions"].items():
                row = []
                for n in names:
                    f = frames[n]
                    fr, ss, sz = f["frame"], f["spriteSourceSize"], f["sourceSize"]
                    row.append([fr["x"], fr["y"], fr["w"], fr["h"], ss["x"], ss["y"], sz["w"] - fr["w"], sz["h"] - fr["h"]])
                directions[direction] = row
            final = "run" if clip_name == "attack" else clip_name
            clips[final] = {"sheet": f"res://assets/monsters/{name}.webp", "fps": clip["fps"], "loop": True if final == "run" else clip["loop"],
                            "mirrored": clip.get("mirrored", []), "directions": directions}
        cell = next(iter(frames.values()))["sourceSize"]["w"]
        px = 56 if animal["hp"] < 100 else 90
        animals[aid] = {"actor": {"id": actor["id"], "cell": cell, "size": [px, px], "origin": actor["origin"], "clips": clips, "interiorScale": 1.0}}
        ready.append(aid)
    target.write_text(json.dumps({"format": "ki-godot-animals-1", "animals": animals}, ensure_ascii=False, separators=(",", ":")))
    print(json.dumps({"ready": ready, "missing": missing, "total": len(animals)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
