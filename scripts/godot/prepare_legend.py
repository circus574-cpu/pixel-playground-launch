#!/usr/bin/env python3
"""Legends (Pyra): stats, 29-node tree and active-ability numbers -> data/legend.json.

Stats and tree come from the owner annex (docs/design/data/character-progression-1-20.json); cooldown/KI
costs from the browser kit (src/game/kit/legend.ts). Nothing is balanced here; GM overrides are not ported.
"""
import json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2]
annex = json.load(open(ROOT / "docs/design/data/character-progression-1-20.json"))["races"]["legend"]
kit = (ROOT / "src/game/kit/legend.ts").read_text()
defs = {}
for m in re.finditer(r"(\w+): \{ id: \"(\w+)\", ki: (\d+), cd: (\d+)(?:, needsFoe: true)? \}", kit):
    defs[m.group(2)] = {"ki": int(m.group(3)), "cd": int(m.group(4)) / 1000.0}
excl = {}
for a, b in annex["exclusiveChoices"]:
    excl[a], excl[b] = b, a
nodes = []
for n in annex["nodes"]:
    nodes.append({"id": n["id"], "name": n["name"], "type": n["type"], "minLevel": n["minLevel"], "requires": n["requiresAny"],
                  "excludes": excl.get(n["id"], ""), "effect": n["effect"], **({"ki": defs[n["id"]]["ki"], "cd": defs[n["id"]]["cd"]} if n["id"] in defs else {})})
out = {"race": "legend", "raceName": annex["raceName"], "mechanic": annex["raceMechanic"], "role": annex["role"], "branches": annex["skillBranches"],
       "base": annex["base"], "perLevel": annex["perLevel"], "nodes": nodes,
       "source": "docs/design/data/character-progression-1-20.json + src/game/kit/legend.ts"}
(ROOT / "ports/godot-pyra/data/legend.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(len(nodes), "nodes", len(defs), "actives", defs)
