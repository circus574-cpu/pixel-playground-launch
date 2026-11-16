#!/usr/bin/env python3
"""The 40 bestiary monsters (rules from export-monsters.ts, anime sheets `enemy-v3-*`) and the per-land spawn registries -> Godot.

Reads /tmp/godot-monsters/monsters.json and the published packs and spawns; writes data/monsters.json, assets/monsters/<id>.webp
and data/lands/<land>/spawns.json. Presentation and rules only: nothing is rebalanced or generated.
"""
import glob, json, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parents[2]
PUB = ROOT / "public"
PORT = ROOT / "ports/godot-pyra"
LANDS = ["pyra", "verdant", "aether", "nexus"] + [f"island-{i}" for i in range(1, 7)]


def main():
    src = json.load(open("/tmp/godot-monsters/monsters.json"))
    out_dir = PORT / "assets/monsters"
    out_dir.mkdir(parents=True, exist_ok=True)
    monsters = {}
    for mid, m in src["monsters"].items():
        pack = json.load(open(glob.glob(str(PUB / f"game/assets/gpu/enemy-v3-{mid}/*/pack.json"))[0]))
        actor = pack["actors"][0]
        asset = pack["assets"][0]
        sheet = out_dir / (mid + ".webp")
        shutil.copyfile(PUB / asset["url"].lstrip("/"), sheet)
        frames = json.load(open(PUB / asset["atlasUrl"].lstrip("/")))["frames"]
        frames = {f["filename"]: f for f in frames} if isinstance(frames, list) else frames
        clips = {}
        for name, clip in actor["clips"].items():
            dirs = {}
            for d, names in clip["directions"].items():
                row = []
                for n in names:
                    f = frames[n]
                    fr, ss, sz = f["frame"], f["spriteSourceSize"], f["sourceSize"]
                    row.append([fr["x"], fr["y"], fr["w"], fr["h"], ss["x"], ss["y"], sz["w"] - fr["w"], sz["h"] - fr["h"]])
                dirs[d] = row
            clips[name] = {"sheet": f"res://assets/monsters/{mid}.webp", "fps": clip["fps"], "loop": clip["loop"], "mirrored": clip.get("mirrored", []), "directions": dirs}
        cell = next(iter(frames.values()))["sourceSize"]["w"]
        fpx = m.pop("framePx")
        m.pop("bodyExtent", None)
        pool = m.pop("pool")
        m["pool"] = {"ids": pool["ids"], "weights": pool["weights"], "total": pool["total"]}
        m["actor"] = {"id": actor["id"], "cell": cell, "size": [fpx, fpx], "origin": actor["origin"], "clips": clips, "interiorScale": 1.0}
        monsters[mid] = m
    json.dump({"dropChance": src["dropChance"], "monsters": monsters}, open(PORT / "data/monsters.json", "w"), ensure_ascii=False, separators=(",", ":"))
    total = 0
    for land in LANDS:
        d = json.load(open(PUB / f"game/worlds/superior-v2/{land}/spawns.json"))
        kinds = sorted({s["kind"] for s in d["overworld"]})
        index = {k: i for i, k in enumerate(kinds)}
        rows = [[index[s["kind"]], round(s["x"]), round(s["y"]), s["homeLeash"], s["respawnMs"], s["safeExclusion"], s["level"]] for s in d["overworld"]]
        json.dump({"kinds": kinds, "activation": d["activation"], "spawns": rows}, open(PORT / f"data/lands/{land}/spawns.json", "w"), separators=(",", ":"))
        total += len(rows)
    print("monsters", len(monsters), "spawns", total)


main()
