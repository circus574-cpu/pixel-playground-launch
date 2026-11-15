#!/usr/bin/env python3
"""Stats, 29-node trees and active-ability numbers of the four races -> data/races/<race>.json.

Stats and trees come from the owner annex (docs/design/data/character-progression-1-20.json); cooldowns and KI costs from
the browser kits (src/game/kit/*.ts). Nothing is balanced here.
"""
import json, pathlib, re
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
annex = json.load(open(ROOT / "docs/design/data/character-progression-1-20.json"))["races"]
OUT = ROOT / "ports/godot-pyra/data/races"
OUT.mkdir(parents=True, exist_ok=True)
LORE = {
    "planetary": {"world": "Verdantia", "city": "Zielona Przystań", "title": "W rytmie żywej planety", "description": "Odkrywcy i strażnicy równowagi. Każda ścieżka prowadzi do nowej historii.", "color": "#b9d994"},
    "sage": {"world": "Aetheria", "city": "Sanktuarium Tysiąca Źródeł", "title": "Wiedza jest formą potęgi", "description": "Strażnicy pradawnych źródeł KI. Cisza sanktuariów skrywa pamięć całych epok.", "color": "#8ee8da"},
    "android": {"world": "Nexus-9", "city": "Węzeł Świadomości", "title": "Świadomość poza granicami ciała", "description": "Syntetyczni odkrywcy, którzy pytają, gdzie kończy się maszyna, a zaczyna dusza.", "color": "#85caff"},
    "legend": {"world": "Pyra", "city": "Twierdza Popiołu", "title": "Twoje czyny staną się dziedzictwem", "description": "Wojownicze klany strzegą aren i ruin, w których nadal płonie energia dawnych mistrzów.", "color": "#ffad78"},
}
PORTRAITS = ROOT / "ports/godot-pyra/assets/races"
PORTRAITS.mkdir(parents=True, exist_ok=True)
for race in ["legend", "planetary", "sage", "android"]:
    a = annex[race]
    ts = (ROOT / f"src/game/kit/{race}.ts").read_text()
    defs = {}
    for m in re.finditer(r"id: \"(\w+)\", ki: (\d+), cd: (\d+)", ts):
        defs[m.group(1)] = {"ki": int(m.group(2)), "cd": int(m.group(3)) / 1000.0}
    excl = {}
    for x, y in a["exclusiveChoices"]:
        excl[x], excl[y] = y, x
    nodes = [{"id": n["id"], "name": n["name"], "type": n["type"], "minLevel": n["minLevel"], "requires": n["requiresAny"], "excludes": excl.get(n["id"], ""), "effect": n["effect"],
              **({"ki": defs[n["id"]]["ki"], "cd": defs[n["id"]]["cd"]} if n["id"] in defs else {})} for n in a["nodes"]]
    out = {"race": race, "raceName": a["raceName"], "mechanic": a["raceMechanic"], "role": a["role"], "branches": a["skillBranches"], "base": a["base"], "perLevel": a["perLevel"], "nodes": nodes, "lore": LORE[race],
           "source": "docs/design/data/character-progression-1-20.json + src/game/kit/%s.ts" % race}
    im = Image.open(ROOT / f"public/game/assets/stage3/references/{race}.jpg").convert("RGB")
    im.thumbnail((520, 700), Image.LANCZOS)
    im.save(PORTRAITS / f"{race}.jpg", quality=88)
    (OUT / f"{race}.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(race, len(nodes), "nodes", len(defs), "actives", {k: v for k, v in defs.items()})
