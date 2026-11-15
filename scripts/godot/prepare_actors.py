#!/usr/bin/env python3
"""Heroes of the four races and NPCs of the four worlds -> Godot sprite clips; six service rooms per world.

Reads /tmp/godot-actors/{actors,rooms}.json (export-actors-rooms.ts). Trimmed atlas frames become AtlasTexture regions with a
margin, so figures keep the browser game's size and foot position. Presentation only.
"""
import json, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parents[2]
PUB = ROOT / "public"
PORT = ROOT / "ports/godot-pyra"
TMP = pathlib.Path("/tmp/godot-actors")
OUT = PORT / "assets/actors"
ROOMS = PORT / "assets/rooms"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ROOMS.mkdir(parents=True, exist_ok=True)
    spec = json.load(open(TMP / "actors.json"))
    atlas_cache = {}
    result = {}
    for key, actor in spec["actors"].items():
        clips = {}
        cell = None
        for name, clip in actor["clips"].items():
            asset = spec["assets"][clip["asset"]]
            sheet = OUT / pathlib.Path(asset["url"]).name
            if not sheet.exists():
                shutil.copyfile(PUB / asset["url"].lstrip("/"), sheet)
            if asset["atlasUrl"] not in atlas_cache:
                raw = json.load(open(PUB / asset["atlasUrl"].lstrip("/")))["frames"]
                atlas_cache[asset["atlasUrl"]] = {f["filename"]: f for f in raw} if isinstance(raw, list) else raw
            frames = atlas_cache[asset["atlasUrl"]]
            dirs = {}
            for d, names in clip["directions"].items():
                row = []
                for n in names:
                    f = frames[str(n)]
                    if f.get("rotated"):
                        raise ValueError("rotated frame " + str(n))
                    fr, ss, sz = f["frame"], f["spriteSourceSize"], f["sourceSize"]
                    cell = cell or sz["w"]
                    row.append([fr["x"], fr["y"], fr["w"], fr["h"], ss["x"], ss["y"], sz["w"] - fr["w"], sz["h"] - fr["h"]])
                dirs[d] = row
            clips[name] = {"sheet": "res://assets/actors/" + sheet.name, "fps": clip["fps"], "loop": clip["loop"], "mirrored": clip.get("mirrored", []), "directions": dirs}
        entry = {"id": actor["id"], "cell": cell or 256, "size": actor["size"], "origin": actor["origin"], "clips": clips}
        entry["interiorScale"] = 1.5 if key.endswith(".hero") else (1.4 if actor["size"][1] >= 192 else 1.6)
        result[key] = entry
    json.dump(result, open(PORT / "data/actors.json", "w"), separators=(",", ":"))
    rooms = json.load(open(TMP / "rooms.json"))
    for world, services in rooms.items():
        for svc, room in services.items():
            dest = ROOMS / f"{world}-{svc}.webp"
            shutil.copyfile(PUB / room["picture"].lstrip("/"), dest)
            room["picture"] = f"res://assets/rooms/{world}-{svc}.webp"
    json.dump(rooms, open(PORT / "data/rooms.json", "w"), separators=(",", ":"))
    print("actors", len(result), "rooms", sum(len(v) for v in rooms.values()))


main()
