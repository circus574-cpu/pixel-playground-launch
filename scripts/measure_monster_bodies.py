#!/usr/bin/env python3
"""Mierzy, jaką część ramki zajmuje ciało każdego potwora (większy z wymiarów ramki ograniczającej, klatki idle 00 ze wszystkich
kierunków, mediana) w paczkach `enemy-v3-*`, i zapisuje src/game/monsters/bodyExtent.generated.ts.
Rozmiar potwora w świecie v2 liczy się z tych pomiarów (src/game/monsters/visualSize.ts), bo grafiki nie odzwierciedlają klasy S/M/L.
Uruchom po dodaniu lub zmianie paczki potwora:  python3 scripts/measure_monster_bodies.py && npx prettier --write src/game/monsters/bodyExtent.generated.ts"""
import glob, json, re, statistics
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
base = (ROOT / "src/game/monsters/base.generated.ts").read_text()
ids = re.findall(r'\n    id: "([a-z0-9-]+)",\n    world:', base)
out = {}
for kind in ids:
    extents = []
    for pj in sorted(glob.glob(str(ROOT / f"public/game/assets/gpu/enemy-v3-{kind}/*/*page-*.json"))):
        meta = json.load(open(pj))
        alpha = np.asarray(Image.open(pj.replace(".json", ".webp")).convert("RGBA"))[..., 3]
        for name, f in meta["frames"].items():
            if "/idle/" in name and name.endswith("/00"):
                r = f["frame"]
                ys, xs = np.where(alpha[r["y"]:r["y"] + r["h"], r["x"]:r["x"] + r["w"]] > 20)
                if len(ys):
                    extents.append(max(ys.max() - ys.min() + 1, xs.max() - xs.min() + 1) / max(r["w"], r["h"]))
    if extents:
        out[kind] = round(statistics.median(extents), 3)
lines = ["// Wygenerowane przez scripts/measure_monster_bodies.py — nie edytuj ręcznie.",
         "/** Większy wymiar ciała potwora jako ułamek jego ramki w paczce `enemy-v3-*`. */",
         "export const BODY_EXTENT: Readonly<Record<string, number>> = {"]
lines += [f'  "{k}": {v},' for k, v in sorted(out.items())]
lines.append("};")
(ROOT / "src/game/monsters/bodyExtent.generated.ts").write_text("\n".join(lines) + "\n")
print(len(out), "z", len(ids), "potworów zmierzonych")
