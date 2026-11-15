#!/usr/bin/env python3
"""Planet atlas, globe textures and the Pyra continent map -> Godot (2D map + 3D globe).

Outlines, labels and the world->atlas affine tiles come from the same files the web /mapa uses, so both
views pick regions from identical traced outlines. Presentation only.
"""
import json, pathlib, shutil
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
PM = ROOT / "src/components/planet-map"
ASSETS = ROOT / "src/assets/planet-map"
PORT = ROOT / "ports/godot-pyra"
OUT = PORT / "assets/map"

REGIONS = [
    ("verdant", "continent", "Verdantia", "Planetarni", "Zielona Przystań", "Gęste lasy, kręte rzeki, wielkie jezioro i grzbiet ośnieżonych gór. Żywa energia ziemi i rzemiosło."),
    ("aether", "continent", "Aetheria", "Mędrcy", "Sanktuarium Tysiąca Źródeł", "Lodowe szczyty, lodowce i świecące turkusowo źródła skupionego KI wśród świątynnych tarasów."),
    ("nexus", "continent", "Nexus-9", "Androidy", "Węzeł Świadomości", "Cybernetyczna metropolia wokół świecącego reaktora, autostrady-obwody, doki i skaliste płaskowyże."),
    ("pyra", "continent", "Pyra", "Legendy", "Twierdza Popiołu", "Czynne wulkany, rzeki lawy spływające do morza, bazaltowe pustkowia i kaniony z czerwonej skały."),
] + [(f"island-{i + 1}", "island", f"Wyspa questowa {n}", "", "", "Nazwa robocza. Odkrywaj teren poza bezpieczną osadą; zadania fabularne są w przygotowaniu.") for i, n in enumerate(["I", "II", "III", "IV", "V", "VI"])]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (PORT / "data/continent").mkdir(parents=True, exist_ok=True)
    outlines = json.load(open(PM / "atlasRegions.v2.json"))
    layout = json.load(open(PM / "planetLayout.v2.json"))
    overlay = json.load(open(PM / "worldOverlay.v2.json"))
    regions = []
    for rid, kind, name, people, settlement, summary in REGIONS:
        o = outlines[rid]
        xs, ys = [p[0] for p in o], [p[1] for p in o]
        regions.append({"id": rid, "kind": kind, "name": name, "people": people, "settlement": settlement, "summary": summary,
                        "playable": rid == "pyra", "label": layout[rid]["label"], "settlementPoint": layout[rid].get("settlementPoint"),
                        "outline": [[round(x, 1), round(y, 1)] for x, y in o],
                        "center": [(min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2], "radius": [(max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2]})
    tiles = [{"crop": t["crop"], "m": t["m"]} for t in overlay["tiles"] if t["land"] == "pyra"]
    json.dump({"mapW": 2000, "mapH": 1000, "regions": regions, "pyra": {"upp": overlay["lands"]["pyra"]["upp"], "tiles": tiles}},
              open(PORT / "data/map.json", "w"), ensure_ascii=False, separators=(",", ":"))
    for src, dst in [("atlas-v2-1920.webp", "atlas.webp"), ("v2-globe-color-1920.webp", "globe-color.webp"), ("globe-clouds-2048.webp", "globe-clouds.webp"), ("space.jpg", "space.jpg")]:
        shutil.copyfile(ASSETS / src, OUT / dst)
    with Image.open(ROOT / "public/game/worlds/superior-v2/pyra/map-hi.webp") as im:
        im.convert("RGB").resize((2050, 1322), Image.LANCZOS).save(OUT / "pyra-map.webp", quality=88, method=6)
    print("regions", len(regions), "pyra tiles", len(tiles))


main()
