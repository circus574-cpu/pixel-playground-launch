#!/usr/bin/env python3
"""Legend hero (hero-legend-walk-v3 3.3.0, 200 px cells) -> Godot sprite clips.

Trimmed atlas frames become AtlasTexture regions with a margin, so the figure keeps the same size
and foot position as in the browser game. Only presentation data; stats come from the annex.
"""
import json, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parents[2]
PACKDIR = next((ROOT / "public/game/assets/gpu/hero-legend-walk-v3").glob("*/"))
PORT = ROOT / "ports/godot-pyra"
OUT = PORT / "assets/hero"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pack = json.load(open(PACKDIR / "pack.json"))
    actor = pack["actors"][0]
    sheets = {}
    clips = {}
    for name, clip in actor["clips"].items():
        asset = clip["asset"]
        if asset not in sheets:
            atlas = json.load(open(PACKDIR / (asset + ".json")))
            png = asset + ".webp"
            shutil.copyfile(PACKDIR / png, OUT / png)
            sheets[asset] = atlas["frames"]
        frames = sheets[asset]
        dirs = {}
        for d, names in clip["directions"].items():
            row = []
            for n in names:
                f = frames[n]
                fr, ss, sz = f["frame"], f["spriteSourceSize"], f["sourceSize"]
                row.append([fr["x"], fr["y"], fr["w"], fr["h"], ss["x"], ss["y"], sz["w"] - fr["w"], sz["h"] - fr["h"]])
            dirs[d] = row
        clips[name] = {"sheet": "res://assets/hero/" + asset + ".webp", "fps": clip["fps"], "loop": clip["loop"],
                       "mirrored": clip.get("mirrored", []), "directions": dirs}
    json.dump({"id": actor["id"], "cell": 200, "size": [133, 133], "interiorScale": 1.5, "origin": actor["origin"], "clips": clips,
               "source": {"pack": pack["id"], "version": pack["version"]}},
              open(PORT / "data/hero.json", "w"), separators=(",", ":"))
    print("clips", len(clips), "sheets", len(sheets))


main()
