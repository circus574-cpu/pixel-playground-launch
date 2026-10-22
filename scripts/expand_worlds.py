"""Expand aether/nexus/pyra to open-world size: new zones to the north, south, east and west.

One-shot and deterministic. The legacy rectangle keeps its content but every coordinate is
shifted by (shift.x, shift.y); saves are migrated by `layout` (see session.ts). Collision always
comes from `obstacles` and solid footprints; zone floors, roads and nature stickers are presentation.

Usage: python3 scripts/expand_worlds.py            (aether, nexus, pyra; skips already expanded)
Writes src/game/world/regions/<world>.json and src/game/world/zones.json (shared with /mapa).
"""
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGIONS = ROOT / "src/game/world/regions"
ZONES_JSON = ROOT / "src/game/world/zones.json"
LAYOUT = 2
M_X, M_Y = 1200, 900  # margin added on every side
WALL = 110

# Atlas data (map units of src/components/planet-map): city point and traced outline bbox.
ATLAS = {
    "verdant": dict(settle=(755, 498), bbox=(245, 173, 977, 630)),
    "aether": dict(settle=(1396, 273), bbox=(1035, 55, 1717, 494)),
    "nexus": dict(settle=(1453, 711), bbox=(1068, 535, 1669, 934)),
    "pyra": dict(settle=(750, 688), bbox=(193, 629, 874, 972)),
}

# Per-world zone themes: floor texture (nature pack binding), name, summary, scenery, enemy label.
THEMES = {
    "aether": {
        "north": ("nature-snow", "Lodowe Szczyty", "Wiatr nad śnieżnymi graniami i szklistymi turniami.",
                  [("mountain-peak", 430, True), ("patch-glacier-block", 300, False), ("patch-ice-spires", 260, False)]),
        "south": ("nature-meadow-grass", "Dolina Strumieni", "Łąki, trzcina i wodospady spływające z tarasów.",
                  [("patch-waterfall", 320, False), ("reed-clump", 150, False), ("flower-bush", 150, False), ("grassy-hill", 330, False)]),
        "east": ("nature-ice-glacier", "Lodowce Wschodu", "Lodowe pola i kryształowe drzewa jarzące się KI.",
                 [("crystal-tree", 240, True), ("patch-glacier-block", 300, False), ("patch-ice-spires", 260, False)]),
        "west": ("nature-cliff-rock", "Skały Zachodu", "Wietrzne urwiska i głazy dawnych pielgrzymów.",
                 [("patch-cliff-outcrop", 300, False), ("patch-boulder-group", 230, False), ("pine-tree", 230, True)]),
    },
    "nexus": {
        "north": ("nature-cliff-rock", "Płaskowyż Północny", "Skaliste wyżyny nad reaktorem, wiatr niesie szum przekaźników.",
                  [("patch-cliff-outcrop", 300, False), ("mountain-peak", 430, True), ("patch-boulder-group", 230, False)]),
        "south": ("nature-ash-ground", "Pustkowia Rdzeni", "Spękana ziemia pełna wygasłych modułów.",
                  [("patch-basalt-columns", 260, False), ("patch-boulder-group", 230, False), ("patch-lava-rocks", 220, False)]),
        "east": ("nature-sand-beach", "Doki Wschodnie", "Piaszczyste wybrzeże, dawne doki i skały morskie.",
                 [("patch-sea-stacks", 300, False), ("patch-small-island", 280, False), ("reed-clump", 150, False)]),
        "west": ("nature-ice-glacier", "Zbocza Zachodnie", "Lodowe stoki i lśniące iglice nad miastem.",
                 [("patch-ice-spires", 270, False), ("patch-glacier-block", 300, False), ("mountain-peak", 400, True)]),
    },
    "pyra": {
        "north": ("nature-lava-crust", "Pola Wulkaniczne", "Skorupa lawy, dymiące kratery i czerwone żyły ognia.",
                  [("patch-volcano-active", 440, True), ("patch-volcano-dormant", 440, True), ("patch-lava-rocks", 240, False)]),
        "south": ("nature-basalt-columns", "Rzeki Lawy", "Bazaltowe kolumny nad rozpadlinami żarzącej lawy.",
                  [("patch-lava-rocks", 260, False), ("patch-basalt-columns", 260, False), ("patch-boulder-group", 220, False)]),
        "east": ("nature-cliff-rock", "Czerwone Kaniony", "Kaniony klanów i skalne bramy dawnych wojowników.",
                 [("patch-cliff-outcrop", 320, False), ("mountain-peak", 430, True), ("patch-boulder-group", 230, False)]),
        "west": ("nature-ash-ground", "Czarne Pustkowia", "Popiół, szkło wulkaniczne i wypalone głazy.",
                 [("patch-basalt-columns", 260, False), ("patch-lava-rocks", 240, False), ("patch-cliff-outcrop", 300, False)]),
    },
}
THEMES["verdant"] = {
    "north": ("nature-cliff-rock", "Grzbiety Północy", "Skaliste grzbiety i ośnieżone szczyty nad lasem.",
              [("mountain-peak", 430, True), ("patch-cliff-outcrop", 300, False), ("pine-tree", 230, True)]),
    "south": ("nature-sand-beach", "Rzeczna Delta", "Piaszczyste ujście rzek, trzcina i skały morskie.",
              [("reed-clump", 150, False), ("patch-sea-stacks", 300, False), ("patch-small-island", 280, False)]),
    "east": ("nature-meadow-grass", "Wybrzeże Wschodnie", "Kwieciste łąki opadające ku morzu.",
             [("flower-bush", 150, False), ("broadleaf-tree", 260, True), ("grassy-hill", 330, False)]),
    "west": ("nature-forest-floor", "Puszcza Zachodnia", "Stare, gęste lasy sięgające końca kontynentu.",
             [("pine-tree", 230, True), ("broadleaf-tree", 260, True), ("patch-boulder-group", 230, False)]),
}
SEEDS = {"aether": 5741, "nexus": 5742, "pyra": 5743, "verdant": 5744}
DIRS = ["north", "south", "east", "west"]


def blob(rng, cx, cy, rx, ry, n=14, wob=0.12):
    """Closed organic outline (centre/radii with deterministic wobble)."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        k = 1 + rng.uniform(-wob, wob)
        pts.append([round(cx + math.cos(a) * rx * k), round(cy + math.sin(a) * ry * k)])
    return pts


def edge_poly(rng, x0, y0, x1, y1, step=240, wob=70, soft=(True, True, True, True)):
    """Rectangle outline whose inner (soft) sides wobble; outer sides run under the wall."""
    pts = []
    # top, right, bottom, left (clockwise)
    for x in range(x0, x1, step):
        pts.append([x, y0 + (round(rng.uniform(-wob, wob)) if soft[0] else 0)])
    for y in range(y0, y1, step):
        pts.append([x1 + (round(rng.uniform(-wob, wob)) if soft[1] else 0), y])
    for x in range(x1, x0, -step):
        pts.append([x, y1 + (round(rng.uniform(-wob, wob)) if soft[2] else 0)])
    for y in range(y1, y0, -step):
        pts.append([x0 + (round(rng.uniform(-wob, wob)) if soft[3] else 0), y])
    return pts


def build(world_id):
    path = REGIONS / f"{world_id}.json"
    d = json.loads(path.read_text())
    if d.get("layout") == LAYOUT:
        print(world_id, "already expanded")
        return None
    res = expand(world_id, d, drop_walls=True)
    path.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    return res


def expand(world_id, d, drop_walls):
    rng = random.Random(SEEDS[world_id])
    lw, lh = d["width"], d["height"]
    dx, dy = M_X, M_Y
    W, H = lw + 2 * M_X, lh + 2 * M_Y

    def sh(p):
        p["x"] += dx
        p["y"] += dy

    for key in ("spawn",):
        sh(d[key])
    sh(d["market"])
    for k in ("npcs", "enemies", "landmarks"):
        for p in d[k]:
            sh(p)
    for o in d["objects"]:
        sh(o)
    for r in d["terrain"]["paths"] + d["terrain"]["plazas"]:
        sh(r)
    for r in d["terrain"].get("roads", []):
        r["points"] = [[x + dx, y + dy] for x, y in r["points"]]
    for c in d["terrain"].get("courts", []):
        c["points"] = [[x + dx, y + dy] for x, y in c["points"]]
    # Drop the legacy outer walls (leading obstacles that touch the legacy border); keep the rest shifted.
    legacy = d["obstacles"]
    inner = []
    for o in legacy:
        touches = o["x"] <= 0 or o["y"] <= 0 or o["x"] + o["width"] >= lw or o["y"] + o["height"] >= lh
        if drop_walls and touches and (o["width"] >= lw * 0.5 or o["height"] >= lh * 0.5):
            continue
        inner.append(dict(o, x=o["x"] + dx, y=o["y"] + dy))
    d["obstacles"] = [
        dict(x=0, y=0, width=W, height=WALL),
        dict(x=0, y=WALL, width=140, height=H - WALL),
        dict(x=W - 140, y=WALL, width=140, height=H - WALL),
        dict(x=140, y=H - 100, width=W - 280, height=100),
    ] + inner
    d["border"] = 4
    d["width"], d["height"] = W, H
    d["layout"] = LAYOUT
    d["legacyShift"] = {"x": dx, "y": dy}

    anchor = next(l for l in d["landmarks"] if l["kind"] == "settlement")
    ax, ay = anchor["x"], anchor["y"]
    cx = dx + lw // 2
    cy = dy + lh // 2

    # --- zone floors -------------------------------------------------------------------------
    themes = THEMES[world_id]
    bands = {
        "north": (60, 60, W - 60, dy + 70, (False, False, True, False)),
        "south": (60, dy + lh - 70, W - 60, H - 60, (True, False, False, False)),
        "west": (60, dy - 90, dx + 70, dy + lh + 90, (True, True, True, False)),
        "east": (dx + lw - 70, dy - 90, W - 60, dy + lh + 90, (True, False, True, True)),
    }
    zones, floors, centers = [], [], {}
    for name in DIRS:
        x0, y0, x1, y1, soft = bands[name]
        floors.append(dict(id=name, texture=themes[name][0], points=edge_poly(rng, x0, y0, x1, y1, soft=soft)))
        centers[name] = ((x0 + x1) // 2, (y0 + y1) // 2, x1 - x0, y1 - y0)
    # Draw order: north/south first, east/west over the corners.
    d["terrain"]["zones"] = floors

    # --- roads from the city to each zone ----------------------------------------------------
    roads = d["terrain"].setdefault("roads", [])
    targets = {
        "north": (cx, dy + 20, centers["north"][0], centers["north"][1]),
        "south": (cx, dy + lh - 20, centers["south"][0], centers["south"][1]),
        "west": (dx + 20, cy, centers["west"][0], centers["west"][1]),
        "east": (dx + lw - 20, cy, centers["east"][0], centers["east"][1]),
    }
    road_lines = []
    for name, (sx, sy, tx, ty) in targets.items():
        sx, sy = (ax, ay) if False else (sx, sy)
        mx, my = (sx + tx) / 2 + rng.uniform(-90, 90), (sy + ty) / 2 + rng.uniform(-90, 90)
        pts = [[round(sx), round(sy)], [round((sx + mx) / 2 + rng.uniform(-40, 40)), round((sy + my) / 2 + rng.uniform(-40, 40))],
               [round(mx), round(my)], [round((mx + tx) / 2 + rng.uniform(-40, 40)), round((my + ty) / 2 + rng.uniform(-40, 40))],
               [round(tx), round(ty)]]
        roads.append(dict(width=130, points=pts))
        road_lines.append(pts)

    # --- collision validator helpers ---------------------------------------------------------
    def rects():
        out = [(o["x"], o["y"], o["x"] + o["width"], o["y"] + o["height"]) for o in d["obstacles"]]
        for o in d["objects"]:
            if o["solid"] and o.get("footprint"):
                f = o["footprint"]
                out.append((o["x"] - f["width"] / 2, o["y"] + f.get("offsetY", 0) - f["height"] / 2,
                            o["x"] + f["width"] / 2, o["y"] + f.get("offsetY", 0) + f["height"] / 2))
        return out

    def near_road(x, y, pad):
        for pts in road_lines:
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                n = max(1, int(math.hypot(x1 - x0, y1 - y0) // 40))
                for i in range(n + 1):
                    px, py = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
                    if math.hypot(px - x, py - y) < 65 + pad:
                        return True
        return False

    keep_clear = [(p["x"], p["y"]) for p in d["npcs"]] + [(d["spawn"]["x"], d["spawn"]["y"]), (d["market"]["x"], d["market"]["y"])]
    occupied = []  # sticker boxes (x0,y0,x1,y1)

    def place_ok(x, y, w, h, solid):
        box = (x - w / 2, y - h * 0.95, x + w / 2, y + h * 0.1)
        if box[0] < 220 or box[2] > W - 220 or box[1] < 200 or box[3] > H - 200:
            return False
        if near_road(x, y, w / 2):
            return False
        for q in occupied:
            if box[0] < q[2] + 20 and box[2] > q[0] - 20 and box[1] < q[3] + 20 and box[3] > q[1] - 20:
                return False
        for r in rects():
            if box[0] < r[2] and box[2] > r[0] and box[1] < r[3] and box[3] > r[1]:
                return False
        return True

    # --- scenery + enemies + landmarks -------------------------------------------------------
    nature = []
    for name in DIRS:
        zx, zy, zw, zh = centers[name]
        lo_x, hi_x = (zx - zw / 2 + 260, zx + zw / 2 - 260)
        lo_y, hi_y = (zy - zh / 2 + 260, zy + zh / 2 - 260)
        # Keep the east/west bands off the corner cells and the north/south bands off the legacy rect.
        scenery = themes[name][3]
        count = 0
        guard = 0
        target = 12
        while count < target and guard < 6000:
            guard += 1
            key, size, solid = scenery[count % len(scenery)]
            x, y = rng.uniform(lo_x, hi_x), rng.uniform(lo_y, hi_y)
            x, y = round(x), round(y)
            h = size if not key.startswith("patch-") else size
            if not place_ok(x, y, size, h, solid):
                continue
            occupied.append((x - size / 2, y - h * 0.95, x + size / 2, y + h * 0.1))
            o = dict(id=f"zone-{name}-{key}-{count}", kind=key, asset=f"nature.{key}", x=x, y=y, width=size, height=h,
                     anchorX=0.5, anchorY=0.92 if not key.startswith("patch-") else 0.6, solid=bool(solid))
            if solid:
                o["footprint"] = dict(width=round(size * 0.5), height=round(size * 0.18), offsetY=-round(size * 0.04))
            d["objects"].append(o)
            nature.append(key)
            count += 1
        # enemies
        e = 0
        guard = 0
        while e < 5 and guard < 4000:
            guard += 1
            x, y = round(rng.uniform(lo_x, hi_x)), round(rng.uniform(lo_y, hi_y))
            if any(r[0] - 60 < x < r[2] + 60 and r[1] - 60 < y < r[3] + 60 for r in rects()):
                continue
            if any(q[0] - 40 < x < q[2] + 40 and q[1] - 40 < y < q[3] + 40 for q in occupied):
                continue
            if any(math.hypot(x - ex["x"], y - ex["y"]) < 160 for ex in d["enemies"]):
                continue
            d["enemies"].append({"x": x, "y": y})
            e += 1
        d["landmarks"].append({"x": zx, "y": zy, "label": themes[name][1], "kind": "danger"})
        zones.append(dict(id=name, name=themes[name][1], summary=themes[name][2], x=zx, y=zy, width=zw, height=zh))

    # --- reachability (24-unit grid, 12-unit clearance) --------------------------------------
    cell = 24
    gw, gh = W // cell + 1, H // cell + 1
    blocked = bytearray(gw * gh)
    for (x0, y0, x1, y1) in rects():
        for gy in range(max(0, int((y0 - 12) // cell)), min(gh, int((y1 + 12) // cell) + 1)):
            for gx in range(max(0, int((x0 - 12) // cell)), min(gw, int((x1 + 12) // cell) + 1)):
                blocked[gy * gw + gx] = 1
    start = (int(d["spawn"]["x"] // cell), int(d["spawn"]["y"] // cell))
    seen = {start}
    stack = [start]
    while stack:
        gx, gy = stack.pop()
        for nx, ny in ((gx + 1, gy), (gx - 1, gy), (gx, gy + 1), (gx, gy - 1)):
            if 0 <= nx < gw and 0 <= ny < gh and (nx, ny) not in seen and not blocked[ny * gw + nx]:
                seen.add((nx, ny))
                stack.append((nx, ny))
    bad = [p for p in d["enemies"] + d["landmarks"] + [d["market"]] + d["npcs"]
           if (int(p["x"] // cell), int(p["y"] // cell)) not in seen]
    if bad:
        raise SystemExit(f"{world_id}: unreachable {bad}")

    print(world_id, W, H, "objects", len(d["objects"]), "enemies", len(d["enemies"]), "kinds", sorted(set(nature)))
    return dict(width=W, height=H, anchor=dict(x=ax, y=ay), zones=zones, nature=sorted(set(nature)))


def main():
    out = json.loads(ZONES_JSON.read_text()) if ZONES_JSON.exists() else {}
    for w in ("aether", "nexus", "pyra"):
        res = build(w)
        if res:
            a = ATLAS[w]
            res["atlas"] = dict(settle=dict(x=a["settle"][0], y=a["settle"][1]),
                                bbox=dict(x0=a["bbox"][0], y0=a["bbox"][1], x1=a["bbox"][2], y1=a["bbox"][3]))
            out[w] = res
            for key in res.pop("nature"):
                f = ROOT / f"public/game/assets/stage3/nature.{key}.svg"
                if not f.exists():
                    f.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><ellipse cx="64" cy="64" rx="56" ry="40" fill="#6c7a6a" fill-opacity="0.55" stroke="#2b3b2b" stroke-width="3"/></svg>\n')
    ZONES_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
