#!/usr/bin/env python3
"""Place curated Android side adventures on connected, underused mainland terrain."""
import argparse
import json
from pathlib import Path
from math import atan2, pi

import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2] / "ports/godot-isometric-world"
SPECS = Path(__file__).with_name("wilderness_adventures.json")
PREFIX = "frontier-"
KINDS = ("buildings", "npcs", "exp_zones", "monsters", "labyrinths", "treasures", "gatherables", "waystones")


def write(path, value, check):
    payload = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    if check:
        if path.read_text() != payload:
            raise ValueError(f"Wilderness delivery out of date: {path}")
    else:
        path.write_text(payload, encoding="utf-8")


def place_region(land, specs, boss_positions):
    directory = ROOT / "regions" / land
    region = json.loads((directory / "buildings.json").read_text())
    grid, size = region["grid_size"], region["world_size"]
    half, step = size / 2, size / (grid - 1)
    raw = np.fromfile(directory / "walkable.u8", dtype=np.uint8).reshape(grid, grid)
    heights = np.fromfile(directory / "height.r32", dtype="<f4").reshape(grid, grid)
    components, _ = ndimage.label(raw > 0)
    capital = np.array(region["capital_center"])
    axis = np.arange(grid) * step - half
    x, z = np.meshgrid(axis, axis)
    origin_cost = (x - capital[0]) ** 2 + (z - capital[1]) ** 2
    origin = np.unravel_index(np.where(raw > 0, origin_cost, np.inf).argmin(), raw.shape)
    connected = components == components[origin]
    clearance = ndimage.distance_transform_edt(connected, sampling=step)
    spaced = connected & (origin_cost > (region["safe_city_radius"] + 325) ** 2)
    for key in (*KINDS, "props"):
        region[key] = [r for r in region[key] if not r.get("id", "").startswith(PREFIX)]
    for row in (row for key in KINDS for row in region[key]):
        limit = max(110, float(row.get("radius", 0)) * 0.75)
        spaced &= (x - row["x"]) ** 2 + (z - row["z"]) ** 2 > limit**2
    for wx, wz in boss_positions:
        spaced &= (x - (wx - half)) ** 2 + (z - (wz - half)) ** 2 > 240**2

    sprites = {Path(p["sprite"]).name: p["sprite"] for p in
               [*region["props"], *region["buildings"], *region["gatherables"], *region["waystones"]]
               if p.get("sprite")}
    sprites.setdefault("prop_runic_obelisk.webp", "res://assets/library/props/prop_runic_obelisk.webp")
    sprites.setdefault("prop_waystone_pillar.webp", "res://assets/library/props/prop_waystone_pillar.webp")
    templates = {}
    for mon in region["monsters"]:
        templates.setdefault((mon["actor_id"], mon["level"], bool(mon.get("is_elite"))), mon)

    def near(target, eligible):
        cost = (x - target[0]) ** 2 + (z - target[1]) ** 2
        ranks = np.where(eligible, cost, np.inf)
        iz, ix = np.unravel_index(ranks.argmin(), ranks.shape)
        if not np.isfinite(ranks[iz, ix]):
            raise ValueError(f"{land}: no connected location close to {target}")
        return {"x": round(float(x[iz, ix]), 2), "z": round(float(z[iz, ix]), 2),
                "y": round(float(heights[iz, ix]), 2)}

    sites = []
    for spec in specs:
        ident = f"{PREFIX}{land}-{spec['key']}"
        point = near(spec["hint"], spaced & (clearance >= 135))
        # Orient the site with its friendly scout on the capital side, away from the guards.
        toward = np.array([point["x"], point["z"]]) - capital
        forward = toward / np.linalg.norm(toward)
        across = np.array([-forward[1], forward[0]])
        center = np.array([point["x"], point["z"]])
        booked = [(point["x"], point["z"], 32)]

        def place(a, b, min_distance=0):
            requested = center + forward * a + across * b
            eligible = connected & (clearance >= 21)
            eligible &= origin_cost > (region["safe_city_radius"] + 220) ** 2
            local = (x - requested[0]) ** 2 + (z - requested[1]) ** 2
            eligible &= local < 108**2
            for ax, az, radius in booked:
                eligible &= (x - ax) ** 2 + (z - az) ** 2 >= max(radius, min_distance)**2
            row = near(requested, eligible)
            booked.append((row["x"], row["z"], 23))
            return row

        npc_pos = place(-150, -40)
        cache_pos = place(140, 70)
        second_pos = place(45, -115)
        region["buildings"].append({"id": ident, "title": spec["place"], "role": "landmark",
                                    "map_kind": "landmark", "enterable": False,
                                    "sprite": sprites[spec["model"]], "w": 365, "h": 390,
                                    "footprint_r": 14.0, **point})
        region["npcs"].append({"id": ident + "-npc", "quest_npc_id": ident + "-npc", "actor_id": spec["actor"], "name": spec["npc"],
                               "role": spec["role"], "quest_mark": "", "patrol_radius": 0.0, **npc_pos})
        material = spec["material"]
        region["treasures"].append({"id": ident + "-cache", "title": spec["cache"],
                                    "lore": spec["summary"], "min_level": spec["level"],
                                    "item_id": material, "gold": 25, "xp": 32, **cache_pos})
        for i, prop in enumerate([second_pos, place(-78, 110), place(120, -95)]):
            region["props"].append({"id": f"{ident}-prop-{i + 1}", "kind": "landmark",
                                    "sprite": sprites[spec["decor"][i]], "w": 172, "h": 196, **prop})
        guards = []
        for i, (actor, level, elite, name) in enumerate(spec["enemies"]):
            mount = place(125 + i * 38, 20 + i * 52, min_distance=38)
            row = dict(templates[(actor, level, elite)])
            row.pop("zone_id", None)
            row.update(mount, id=f"{ident}-guard-{i + 1}", name=name, patrol_radius=20.0)
            region["monsters"].append(row)
            guards.append(row)
        directions = ("wschód", "południowy wschód", "południe", "południowy zachód",
                      "zachód", "północny zachód", "północ", "północny wschód")
        vector = np.array([npc_pos["x"], npc_pos["z"]]) - capital
        direction = directions[round(atan2(vector[1], vector[0]) / (pi / 4)) % 8]
        quest, dialogue = make_quest(spec, ident, land, half, point, second_pos, guards)
        quest["summary"] += f" Początek przy lokacji {spec['place']}, na {direction} od stolicy."
        sites.append((quest, dialogue))
        delta = float(np.sqrt((point["x"] - capital[0]) ** 2 + (point["z"] - capital[1]) ** 2))
        print(f"{land:7} {spec['place']:32} {point['x']:+8.2f} {point['z']:+8.2f}, od stolicy {delta:.0f} m")
        spaced &= (x - point["x"]) ** 2 + (z - point["z"]) ** 2 > 550**2
    return directory / "buildings.json", region, sites


def make_quest(spec, ident, land, half, point, second, guards):
    def objective(key, kind, text, target, location=None, spawn_id=None):
        obj = {"id": f"{ident}-{key}", "type": kind, "description": text,
               "targetId": target, "targetCount": 1, "continent": land}
        if location is not None:
            obj["activationRadius"] = 62
            obj["coordinates"] = {"x": round(location["x"] + half, 2),
                                  "y": round(location["z"] + half, 2), "radius": 62}
        if spawn_id is not None:
            obj["targetSpawnId"] = spawn_id
        return obj

    clue = objective("clue", "discover", spec["clue"], ident, point)
    if spec["focus"] == "survey":
        follow_up = objective("trace", "visit", "Sprawdź drugi ślad przy kamiennym znaczniku.",
                              ident + "-trace", second)
        stages = [("Pierwszy ślad", [clue]), ("Pomiary poza ścieżką", [follow_up])]
    elif spec["focus"] == "recover":
        follow_up = objective("retrieve", "retrieve", "Odzyskaj: " + spec["cache"] + ".",
                              ident + "-cache")
        stages = [("Miejsce postoju", [clue]), ("Odzyskanie śladów", [follow_up])]
    else:
        monster = guards[0]
        follow_up = objective("hunt", "combat", "Pokonaj: " + monster["name"] + ".",
                              monster["actor_id"], spawn_id=monster["id"])
        stages = [("Ślad i strażnik", [clue, follow_up]),
                  ("Ocalony zapis", [objective("retrieve", "retrieve", "Otwórz: " + spec["cache"] + ".",
                                               ident + "-cache")])]
    giver = ident + "-npc"
    quest = {"id": ident, "title": spec["quest"], "continent": land, "category": "side",
             "giverNpcId": giver, "giverName": spec["npc"], "recommendedLevel": spec["level"],
             "repeatable": False, "frontier": True, "playableInCurrentRuntime": True, "unlockCondition": {"minLevel": spec["level"]},
             "summary": spec["summary"], "stages": [
                 {"id": f"{ident}-s{index + 1}", "title": title, "objectives": objectives}
                 for index, (title, objectives) in enumerate(stages)
             ], "reward": {"xp": 80 if spec["level"] <= 3 else 115, "coins": 35}}
    dialogue = {"npcId": giver, "npcName": spec["npc"], "role": spec["role"],
                "greetings": [spec["summary"]], "rumors": [spec["clue"]],
                "quests": {ident: {"questId": ident, "before": spec["summary"],
                                  "during": spec["clue"], "after": spec["ending"]}}}
    return quest, dialogue


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--check", action="store_true")
    args = cli.parse_args()
    bosses = json.loads((ROOT / "data/bosses.json").read_text())["bosses"]
    quests, dialogues, outputs = [], {}, []
    for land, specs in json.loads(SPECS.read_text()).items():
        anchors = [b["arenaPos"] for b in bosses if b["continent"] == land]
        path, region, sites = place_region(land, specs, anchors)
        outputs.append((path, region))
        for quest, dialogue in sites:
            quests.append(quest)
            dialogues[dialogue["npcId"]] = dialogue
    outputs.append((ROOT / "data/quests_wilderness.json", {"quests": quests, "dialogues": dialogues}))
    for path, payload in outputs:
        write(path, payload, args.check)


if __name__ == "__main__":
    main()
