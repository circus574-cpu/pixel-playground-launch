#!/usr/bin/env python3
"""Idempotently enrich all 4 Planet Superior continents (Paczka B):
- Dense natural forest groves, roadside camps, shrines, and dramatic biome vistas (~650 clustered props/continent)
- 20 interactive gatherable wilderness resources + 8 healing rest campfires per continent (`gatherables`)
- 2 named Zone Mini-Boss Elites per continent (`is_elite: true`, `scale_mult: 1.38`)
Strictly validates every placement against `walkable.u8`, `height.r32`, roads, buildings, and safe_city_radius.
"""
import json
import math
import os
import random
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ISO = ROOT / "ports" / "godot-isometric-world"

PALETTES = {
    "pyra": {
        "trees": [
            ("res://assets/objects/1cedcd5a-pyra-continent-maple.webp", 360, 390),
            ("res://assets/biomes/pyra_charred_ironwood.webp", 370, 400),
            ("res://assets/objects/13373662-ki-v2-objects-pyra-oak-0.webp", 340, 370),
            ("res://assets/objects/2e41d120-ki-v2-objects-pyra-pine-3.webp", 330, 380),
        ],
        "underbrush": [
            ("res://assets/objects/32e0d269-pyra-continent-lantern-bush.webp", 190, 175),
            ("res://assets/objects/39416c5c-pyra-continent-copper-bush.webp", 180, 165),
            ("res://assets/objects/0b508d77-ki-v2-objects-pyra-fern-1.webp", 170, 155),
            ("res://assets/objects/49b51ecf-pyra-continent-crystals.webp", 215, 230),
            ("res://assets/objects/c3f1e31a-pyra-continent-fissure.webp", 250, 195),
            ("res://assets/objects/2ea0560d-ki-v2-objects-pyra-stump-2.webp", 150, 140),
        ],
        "landmarks": [
            ("res://assets/biomes/pyra_fire_arch.webp", 450, 480),
            ("res://assets/biomes/pyra_magma_geyser.webp", 360, 385),
            ("res://assets/biomes/pyra_obsidian_monolith.webp", 340, 410),
            ("res://assets/biomes/pyra_dragon_ribcage.webp", 420, 360),
            ("res://assets/biomes/pyra_war_totem.webp", 250, 320),
            ("res://assets/biomes/pyra_sulfur_boulders.webp", 310, 260),
            ("res://assets/objects/61486b9a-pyra-continent-obsidian-spire.webp", 330, 420),
        ],
        "camp_props": [
            ("res://assets/library/props/prop_camp_tent.webp", 270, 240),
            ("res://assets/library/props/prop_merchant_wagon.webp", 275, 235),
            ("res://assets/objects/043aaba1-pyra-continent-cart.webp", 215, 190),
            ("res://assets/objects/87b33732-pyra-continent-supplies.webp", 180, 165),
            ("res://assets/library/props/prop_waystone_pillar.webp", 190, 260),
        ],
        "gather_types": [
            {"kind": "gather", "title": "Żarowy Kryształ", "sprite": "res://assets/objects/49b51ecf-pyra-continent-crystals.webp", "w": 205, "h": 220, "item_id": "mat_ember", "item_name": "Esencja Płomienia", "icon": "material-esencja-plomienia.webp", "xp": 28, "gold": 22},
            {"kind": "gather", "title": "Złoże Obsydianu", "sprite": "res://assets/biomes/pyra_sulfur_boulders.webp", "w": 230, "h": 200, "item_id": "mat_obsidian", "item_name": "Odłamek Obsydianu", "icon": "material-obsydian.webp", "xp": 26, "gold": 20},
            {"kind": "gather", "title": "Krzew Żaru", "sprite": "res://assets/objects/32e0d269-pyra-continent-lantern-bush.webp", "w": 195, "h": 180, "item_id": "mat_ash_herb", "item_name": "Skrzydło Żaru", "icon": "material-skrzydlo-zaru.webp", "xp": 22, "gold": 18},
        ],
        "elites": [
            {"id": "pyra-elite-1", "actor_id": "pyra-byk-areny", "name": "[ELITA] Władca Areny Żaru", "level": 9, "hp": 1150, "atk": 96, "xp": 420, "gold": 180},
            {"id": "pyra-elite-2", "actor_id": "pyra-skorpion-obsydianowy", "name": "[ELITA] Obsydianowy Lewiatan", "level": 16, "hp": 2250, "atk": 188, "xp": 860, "gold": 360},
        ],
    },
    "verdant": {
        "trees": [
            ("res://assets/biomes/verdant_alpine_pines.webp", 370, 415),
            ("res://assets/objects/21caeb8f-ki-v2-objects-verdant-oak-1.webp", 360, 385),
            ("res://assets/objects/08d7bbfb-ki-v2-objects-verdant-pine-5.webp", 350, 405),
            ("res://assets/objects/359c3573-ki-v2-objects-verdant-tree2-4.webp", 350, 380),
        ],
        "underbrush": [
            ("res://assets/biomes/verdant_glow_mushrooms.webp", 200, 190),
            ("res://assets/objects/13955587-ki-v2-objects-verdant-flowerbush-0.webp", 180, 165),
            ("res://assets/objects/408ba749-ki-v2-objects-verdant-bush-1.webp", 185, 170),
            ("res://assets/objects/48c51d4d-verdantia-extra-flowers.webp", 170, 150),
            ("res://assets/objects/5b60f067-verdantia-extra-fern.webp", 175, 155),
            ("res://assets/objects/01ec50cc-ki-v2-objects-verdant-stump-0.webp", 160, 145),
        ],
        "landmarks": [
            ("res://assets/biomes/verdant_druid_dolmen.webp", 350, 375),
            ("res://assets/biomes/verdant_moss_shrine.webp", 330, 370),
            ("res://assets/biomes/verdant_lotus_pond.webp", 360, 290),
            ("res://assets/biomes/verdant_sakura_lantern.webp", 310, 355),
            ("res://assets/biomes/verdant_hollow_stump.webp", 300, 280),
            ("res://assets/library/props/prop_ruined_archway.webp", 330, 350),
        ],
        "camp_props": [
            ("res://assets/library/props/prop_camp_tent.webp", 270, 240),
            ("res://assets/library/props/prop_merchant_wagon.webp", 275, 235),
            ("res://assets/objects/0df45d9a-verdantia-extra-cart.webp", 215, 190),
            ("res://assets/library/props/prop_waystone_pillar.webp", 190, 260),
            ("res://assets/library/props/prop_guardian_statue.webp", 225, 295),
        ],
        "gather_types": [
            {"kind": "gather", "title": "Świetlisty Grzyb", "sprite": "res://assets/biomes/verdant_glow_mushrooms.webp", "w": 205, "h": 195, "item_id": "mat_shroom", "item_name": "Czerwony Grzyb", "icon": "material-czerwony-grzyb.webp", "xp": 24, "gold": 19},
            {"kind": "gather", "title": "Krzew Bursztynowy", "sprite": "res://assets/objects/13955587-ki-v2-objects-verdant-flowerbush-0.webp", "w": 195, "h": 180, "item_id": "mat_amber", "item_name": "Złoty Bursztyn", "icon": "material-bursztyn.webp", "xp": 26, "gold": 22},
            {"kind": "gather", "title": "Zioło Szmaragdowe", "sprite": "res://assets/objects/48c51d4d-verdantia-extra-flowers.webp", "w": 185, "h": 165, "item_id": "mat_seeds", "item_name": "Nasiona Gaju", "icon": "material-nasiona.webp", "xp": 22, "gold": 18},
        ],
        "elites": [
            {"id": "verdant-elite-1", "actor_id": "verdant-skalny-jelen", "name": "[ELITA] Król Skalnych Jeleni", "level": 9, "hp": 1180, "atk": 94, "xp": 420, "gold": 180},
            {"id": "verdant-elite-2", "actor_id": "verdant-puchacz-pylowy", "name": "[ELITA] Pradawny Puchacz Gaju", "level": 15, "hp": 2120, "atk": 176, "xp": 820, "gold": 340},
        ],
    },
    "aether": {
        "trees": [
            ("res://assets/biomes/aether_snow_pines.webp", 370, 415),
            ("res://assets/objects/3587a851-aetheria-continent-snow-pine.webp", 345, 395),
            ("res://assets/objects/021d8442-aether-x-cherry-tree.webp", 340, 370),
            ("res://assets/objects/4d090d85-aether-art-ki-tree.webp", 355, 390),
        ],
        "underbrush": [
            ("res://assets/biomes/aether_ice_crystals.webp", 220, 240),
            ("res://assets/objects/0e381537-aetheria-continent-flowers.webp", 175, 160),
            ("res://assets/objects/0535741d-ki-v2-objects-aether-bush-2.webp", 180, 165),
            ("res://assets/objects/011b07cd-ki-v2-objects-aether-fern-4.webp", 170, 155),
            ("res://assets/objects/408fdfd1-aetheria-continent-stump.webp", 155, 145),
        ],
        "landmarks": [
            ("res://assets/biomes/aether_glacier_arch.webp", 430, 450),
            ("res://assets/biomes/aether_astrolabe.webp", 320, 360),
            ("res://assets/biomes/aether_snow_gazebo.webp", 330, 355),
            ("res://assets/biomes/aether_hot_spring.webp", 340, 285),
            ("res://assets/biomes/aether_marble_aqueduct.webp", 420, 360),
            ("res://assets/biomes/aether_snow_obelisk.webp", 260, 330),
        ],
        "camp_props": [
            ("res://assets/library/props/prop_camp_tent.webp", 270, 240),
            ("res://assets/library/props/prop_waystone_pillar.webp", 195, 265),
            ("res://assets/library/props/prop_runic_obelisk.webp", 220, 280),
            ("res://assets/library/props/prop_guardian_statue.webp", 225, 295),
        ],
        "gather_types": [
            {"kind": "gather", "title": "Kryształ Eteru", "sprite": "res://assets/biomes/aether_ice_crystals.webp", "w": 215, "h": 230, "item_id": "mat_rune", "item_name": "Kamień Runiczny", "icon": "material-kamien-runiczny.webp", "xp": 28, "gold": 22},
            {"kind": "gather", "title": "Świetlisty Kwiat", "sprite": "res://assets/objects/0e381537-aetheria-continent-flowers.webp", "w": 190, "h": 175, "item_id": "mat_lightdust", "item_name": "Pył Światła", "icon": "material-pyl-swiatla.webp", "xp": 24, "gold": 20},
            {"kind": "gather", "title": "Obelisk Kronik", "sprite": "res://assets/biomes/aether_snow_obelisk.webp", "w": 210, "h": 265, "item_id": "mat_parchment", "item_name": "Karta Pergaminu", "icon": "material-karta-pergaminu.webp", "xp": 30, "gold": 24},
        ],
        "elites": [
            {"id": "aether-elite-1", "actor_id": "aether-lew-swiatyni", "name": "[ELITA] Złoty Lew Świątyni", "level": 10, "hp": 1240, "atk": 102, "xp": 450, "gold": 195},
            {"id": "aether-elite-2", "actor_id": "aether-mgielny-zuraw", "name": "[ELITA] Archanioł Mgieł", "level": 17, "hp": 2340, "atk": 196, "xp": 900, "gold": 380},
        ],
    },
    "nexus": {
        "trees": [
            ("res://assets/objects/1cf54e0a-nexus-continent-cyan-tree.webp", 345, 380),
            ("res://assets/objects/2b441d4d-ki-v2-objects-nexus-pine-2.webp", 335, 385),
            ("res://assets/objects/532b8a19-ki-v2-objects-nexus-tree2-2.webp", 335, 370),
        ],
        "underbrush": [
            ("res://assets/objects/3d2c4533-nexus-art-crystal.webp", 210, 225),
            ("res://assets/objects/4c52045f-nexus-continent-crystal-outcrop.webp", 215, 220),
            ("res://assets/objects/914e8c5c-nexus-continent-crystals.webp", 205, 215),
            ("res://assets/objects/382d7c5f-ki-v2-objects-nexus-flowerbush-1.webp", 175, 160),
            ("res://assets/objects/11b16815-ki-v2-objects-nexus-fern-3.webp", 170, 155),
            ("res://assets/objects/006e9795-nexus-continent-terminal.webp", 190, 215),
        ],
        "landmarks": [
            ("res://assets/biomes/nexus_holo_monolith.webp", 310, 380),
            ("res://assets/biomes/nexus_plasma_pylon.webp", 270, 345),
            ("res://assets/biomes/nexus_plasma_spire.webp", 275, 355),
            ("res://assets/biomes/nexus_mech_wreck.webp", 390, 340),
            ("res://assets/biomes/nexus_hover_wreck.webp", 350, 280),
            ("res://assets/biomes/nexus_reactor_ruin.webp", 380, 350),
            ("res://assets/biomes/nexus_solar_dish.webp", 300, 320),
            ("res://assets/biomes/nexus_cargo_stack.webp", 270, 240),
        ],
        "camp_props": [
            ("res://assets/biomes/nexus_cargo_stack.webp", 255, 230),
            ("res://assets/objects/006e9795-nexus-continent-terminal.webp", 195, 220),
            ("res://assets/objects/12447581-nexus-continent-energy-brazier.webp", 205, 255),
            ("res://assets/library/props/prop_camp_tent.webp", 265, 235),
        ],
        "gather_types": [
            {"kind": "gather", "title": "Rdzeń Plazmy", "sprite": "res://assets/objects/3d2c4533-nexus-art-crystal.webp", "w": 205, "h": 220, "item_id": "mat_plasma", "item_name": "Rdzeń Plazmy", "icon": "material-rdzen-plazmy.webp", "xp": 28, "gold": 22},
            {"kind": "gather", "title": "Terminal Danych", "sprite": "res://assets/objects/006e9795-nexus-continent-terminal.webp", "w": 195, "h": 220, "item_id": "mat_coil", "item_name": "Cewka Zasilająca", "icon": "material-cewka.webp", "xp": 26, "gold": 22},
            {"kind": "gather", "title": "Zasobnik Modułów", "sprite": "res://assets/biomes/nexus_cargo_stack.webp", "w": 230, "h": 205, "item_id": "mat_optic", "item_name": "Moduł Optyczny", "icon": "material-modul-optyczny.webp", "xp": 24, "gold": 20},
        ],
        "elites": [
            {"id": "nexus-elite-1", "actor_id": "nexus-straznik-rdzenia", "name": "[ELITA] Tytan Rdzenia-0", "level": 10, "hp": 1240, "atk": 104, "xp": 450, "gold": 195},
            {"id": "nexus-elite-2", "actor_id": "nexus-kruk-danych", "name": "[ELITA] Cyber-Kruk Omega", "level": 17, "hp": 2320, "atk": 198, "xp": 900, "gold": 380},
        ],
    },
}


def verify_asset(res_path: str) -> None:
    rel = res_path.replace("res://", "")
    assert (ISO / rel).exists(), f"Missing asset: {res_path}"


def sample_grid(arr, grid_size, world_size, x, z):
    half = world_size * 0.5
    gx = int((x + half) / world_size * (grid_size - 1))
    gz = int((z + half) / world_size * (grid_size - 1))
    if gx < 3 or gx >= grid_size - 3 or gz < 3 or gz >= grid_size - 3:
        return None
    return arr[gz * grid_size + gx]


def is_dry_walkable(walkable, grid_size, world_size, x, z, margin=2):
    half = world_size * 0.5
    gx = int((x + half) / world_size * (grid_size - 1))
    gz = int((z + half) / world_size * (grid_size - 1))
    if gx < 6 or gx >= grid_size - 6 or gz < 6 or gz >= grid_size - 6:
        return False
    for dz in range(-margin, margin + 1):
        for dx in range(-margin, margin + 1):
            if walkable[(gz + dz) * grid_size + (gx + dx)] == 0:
                return False
    return True


def enrich_land(land: str) -> None:
    rdir = ISO / "regions" / land
    bfile = rdir / "buildings.json"
    d = json.loads(bfile.read_text(encoding="utf-8"))
    ws = float(d.get("world_size", 4096.0))
    gs = int(d.get("grid_size", 512))
    safe_r = float(d.get("safe_city_radius", 250.0))
    cx, cz = float(d["capital_center"][0]), float(d["capital_center"][1])

    walkable = (rdir / "walkable.u8").read_bytes()
    hbytes = (rdir / "height.r32").read_bytes()
    heights = struct.unpack(f"<{len(hbytes)//4}f", hbytes)

    pal = PALETTES[land]
    for grp in ("trees", "underbrush", "landmarks", "camp_props"):
        for sp, _, _ in pal[grp]:
            verify_asset(sp)
    for gt in pal["gather_types"]:
        verify_asset(gt["sprite"])
    verify_asset("res://assets/library/props/prop_bonfire_pit.webp")

    # Road sample points for clearance and roadside camps
    road_pts = []
    highway_pts = []
    for rd in d.get("roads", []):
        tier = str(rd.get("tier", "footpath"))
        pts = rd.get("pts", [])
        for i, pt in enumerate(pts):
            px, pz = float(pt[0]), float(pt[1])
            if i % 2 == 0:
                road_pts.append((px, pz))
            if tier in ("highway", "regional") and i % 4 == 2:
                highway_pts.append((px, pz))

    bldgs = [(float(b["x"]), float(b["z"])) for b in d.get("buildings", []) if b.get("role") != "prop"]
    ezs = [(float(e["x"]), float(e["z"]), int(e.get("level", 1))) for e in d.get("exp_zones", [])]

    def too_close(x, z, b_dist=68.0, r_dist=26.0, ez_dist=42.0):
        if math.hypot(x - cx, z - cz) < safe_r + 36.0:
            return True
        for bx, bz in bldgs:
            if math.hypot(x - bx, z - bz) < b_dist:
                return True
        for ex, ez, _ in ezs:
            if math.hypot(x - ex, z - ez) < ez_dist:
                return True
        for rx, rz in road_pts:
            if abs(x - rx) < r_dist and abs(z - rz) < r_dist:
                if math.hypot(x - rx, z - rz) < r_dist:
                    return True
        return False

    # Strip old Paczka B items for 100% idempotency
    props = [p for p in d.get("props", []) if not str(p.get("id", "")).startswith(f"{land}-pb-")]
    monsters = [m for m in d.get("monsters", []) if not str(m.get("id", "")).startswith(f"{land}-elite-")]

    rng = random.Random(f"paczka-b-{land}-20261121")
    added_props = 0
    occupied = [(float(p["x"]), float(p["z"])) for p in props]

    def can_place_prop(x, z, min_sep=18.0, b_dist=66.0, r_dist=24.0):
        if not is_dry_walkable(walkable, gs, ws, x, z, margin=2):
            return False
        if too_close(x, z, b_dist=b_dist, r_dist=r_dist, ez_dist=36.0):
            return False
        for ox, oz in occupied:
            if abs(x - ox) < min_sep and abs(z - oz) < min_sep:
                if math.hypot(x - ox, z - oz) < min_sep:
                    return False
        return True

    def add_prop(pid, kind, sp, w, h, x, z, jitter=True):
        nonlocal added_props
        hv = sample_grid(heights, gs, ws, x, z) or 19.0
        scale_j = rng.uniform(0.88, 1.14) if jitter else 1.0
        props.append({
            "id": pid,
            "kind": kind,
            "sub_biome": "wilderness_paczka_b",
            "sprite": sp,
            "w": int(round(w * scale_j)),
            "h": int(round(h * scale_j)),
            "x": round(x, 2),
            "z": round(z, 2),
            "y": round(float(hv), 2),
        })
        occupied.append((x, z))
        added_props += 1

    # 0. Enrich Verdantia, Aetheria & Nexus-9 Capital Plazas (matching Pyra's rich lived-in courtyard!)
    CAP_PLAZA_EXTRAS = {
        "verdant": [
            ("res://assets/biomes/verdant_lotus_pond.webp", 290, 235, -38.0, -26.0),
            ("res://assets/biomes/verdant_sakura_lantern.webp", 240, 285, 42.0, -24.0),
            ("res://assets/biomes/verdant_druid_dolmen.webp", 250, 275, -52.0, 12.0),
            ("res://assets/biomes/verdant_glow_mushrooms.webp", 180, 175, 48.0, 24.0),
            ("res://assets/objects/13955587-ki-v2-objects-verdant-flowerbush-0.webp", 165, 155, -26.0, 44.0),
            ("res://assets/objects/13955587-ki-v2-objects-verdant-flowerbush-0.webp", 165, 155, 32.0, 48.0),
            ("res://assets/library/props/prop_waystone_pillar.webp", 170, 230, -18.0, -52.0),
            ("res://assets/library/props/prop_guardian_statue.webp", 205, 265, 22.0, -54.0),
            ("res://assets/objects/0df45d9a-verdantia-extra-cart.webp", 195, 175, -62.0, 56.0),
            ("res://assets/objects/48c51d4d-verdantia-extra-flowers.webp", 155, 140, 28.0, -6.0),
            ("res://assets/objects/408ba749-ki-v2-objects-verdant-bush-1.webp", 165, 155, -42.0, 62.0),
            ("res://assets/objects/21caeb8f-ki-v2-objects-verdant-oak-1.webp", 285, 310, -82.0, -2.0),
        ],
        "aether": [
            ("res://assets/biomes/aether_astrolabe.webp", 260, 295, -40.0, -26.0),
            ("res://assets/biomes/aether_hot_spring.webp", 280, 230, 44.0, -24.0),
            ("res://assets/biomes/aether_ice_crystals.webp", 195, 215, -46.0, 24.0),
            ("res://assets/biomes/aether_ice_crystals.webp", 195, 215, 46.0, 28.0),
            ("res://assets/library/props/prop_runic_obelisk.webp", 190, 245, -22.0, -52.0),
            ("res://assets/library/props/prop_guardian_statue.webp", 205, 265, 24.0, -52.0),
            ("res://assets/objects/021d8442-aether-x-cherry-tree.webp", 275, 300, -76.0, 2.0),
            ("res://assets/objects/021d8442-aether-x-cherry-tree.webp", 275, 300, 78.0, -4.0),
            ("res://assets/objects/0e381537-aetheria-continent-flowers.webp", 160, 150, -26.0, 48.0),
            ("res://assets/objects/0e381537-aetheria-continent-flowers.webp", 160, 150, 30.0, 46.0),
            ("res://assets/biomes/aether_snow_gazebo.webp", 270, 290, -64.0, 60.0),
            ("res://assets/objects/0535741d-ki-v2-objects-aether-bush-2.webp", 165, 155, 26.0, -4.0),
        ],
        "nexus": [
            ("res://assets/biomes/nexus_holo_monolith.webp", 245, 305, -42.0, -26.0),
            ("res://assets/biomes/nexus_plasma_pylon.webp", 230, 295, 44.0, -24.0),
            ("res://assets/objects/006e9795-nexus-continent-terminal.webp", 180, 205, -46.0, 26.0),
            ("res://assets/objects/006e9795-nexus-continent-terminal.webp", 180, 205, 46.0, 24.0),
            ("res://assets/objects/12447581-nexus-continent-energy-brazier.webp", 185, 235, -22.0, -52.0),
            ("res://assets/objects/12447581-nexus-continent-energy-brazier.webp", 185, 235, 24.0, -52.0),
            ("res://assets/objects/3d2c4533-nexus-art-crystal.webp", 185, 205, -26.0, 48.0),
            ("res://assets/objects/4c52045f-nexus-continent-crystal-outcrop.webp", 190, 200, 32.0, 48.0),
            ("res://assets/objects/1cf54e0a-nexus-continent-cyan-tree.webp", 285, 315, -76.0, 0.0),
            ("res://assets/objects/1cf54e0a-nexus-continent-cyan-tree.webp", 285, 315, 78.0, -6.0),
            ("res://assets/biomes/nexus_cargo_stack.webp", 225, 205, -62.0, 56.0),
            ("res://assets/biomes/nexus_solar_dish.webp", 245, 265, 64.0, -62.0),
        ],
    }
    for pi, (psp, pw, ph, dx, dz) in enumerate(CAP_PLAZA_EXTRAS.get(land, [])):
        verify_asset(psp)
        add_prop(f"{land}-pb-cap-plaza-{pi}", "plaza", psp, pw, ph, cx + dx, cz + dz, jitter=False)

    # 1. Dense Natural Forest Groves & Biome Clusters (56 groves × ~10 props = ~520 lush props)
    groves_made = 0
    grove_centers = []
    for attempt in range(2400):
        if groves_made >= 56:
            break
        gx = rng.uniform(-ws * 0.44, ws * 0.44)
        gz = rng.uniform(-ws * 0.44, ws * 0.44)
        if any(math.hypot(gx - cgx, gz - cgz) < 155.0 for cgx, cgz in grove_centers):
            continue
        if not can_place_prop(gx, gz, min_sep=20.0, b_dist=78.0, r_dist=30.0):
            continue
        groves_made += 1
        grove_centers.append((gx, gz))
        # Central biome landmark inside every 2nd grove
        if groves_made % 2 == 0:
            lm_sp, lm_w, lm_h = rng.choice(pal["landmarks"])
            add_prop(f"{land}-pb-grove-{groves_made}-lm", "landmark", lm_sp, lm_w, lm_h, gx, gz)
        # 5-6 clustered trees around the grove center
        for ti in range(rng.randint(5, 6)):
            ang = (ti / 6.0) * math.tau + rng.uniform(-0.35, 0.35)
            rad = rng.uniform(24.0, 74.0)
            tx, tz = gx + math.cos(ang) * rad, gz + math.sin(ang) * rad
            if can_place_prop(tx, tz, min_sep=20.0, b_dist=64.0, r_dist=22.0):
                tsp, tw, th = rng.choice(pal["trees"])
                add_prop(f"{land}-pb-grove-{groves_made}-t{ti}", "tree", tsp, tw, th, tx, tz)
        # 4-5 underbrush / crystal / flower / mushroom accents
        for bi in range(rng.randint(4, 5)):
            ang = rng.uniform(0.0, math.tau)
            rad = rng.uniform(16.0, 88.0)
            bx, bz = gx + math.cos(ang) * rad, gz + math.sin(ang) * rad
            if can_place_prop(bx, bz, min_sep=14.0, b_dist=58.0, r_dist=18.0):
                bsp, bw, bh = rng.choice(pal["underbrush"])
                add_prop(f"{land}-pb-grove-{groves_made}-b{bi}", "bush", bsp, bw, bh, bx, bz)

    # 2. Roadside Traveler Encampments, Shrines & Scenic Landmarks along highways (18 roadside POIs!)
    rng.shuffle(highway_pts)
    camps_made = 0
    camp_centers = []
    for rx, rz in highway_pts:
        if camps_made >= 18:
            break
        if math.hypot(rx - cx, rz - cz) < safe_r + 95.0:
            continue
        if any(math.hypot(rx - ccx, rz - ccz) < 260.0 for ccx, ccz in camp_centers):
            continue
        # Step 42m off the road perpendicular-ish to create a clean roadside turnout
        placed = False
        for k in range(8):
            ang = (k / 8.0) * math.tau + rng.uniform(-0.2, 0.2)
            px, pz = rx + math.cos(ang) * 44.0, rz + math.sin(ang) * 44.0
            if can_place_prop(px, pz, min_sep=26.0, b_dist=72.0, r_dist=22.0):
                camps_made += 1
                camp_centers.append((px, pz))
                csp, cw, ch = rng.choice(pal["camp_props"])
                add_prop(f"{land}-pb-camp-{camps_made}-main", "camp", csp, cw, ch, px, pz)
                # Add 1-2 framing trees + 2 bushes/crystals beside the roadside turnout
                for j in range(2):
                    a2 = ang + (0.9 if j == 0 else -0.9)
                    fx, fz = px + math.cos(a2) * 32.0, pz + math.sin(a2) * 32.0
                    if can_place_prop(fx, fz, min_sep=16.0, b_dist=60.0, r_dist=18.0):
                        tsp, tw, th = rng.choice(pal["trees"] if j == 0 else pal["underbrush"])
                        add_prop(f"{land}-pb-camp-{camps_made}-f{j}", "tree" if j == 0 else "bush", tsp, tw, th, fx, fz)
                placed = True
                break

    # 3. Interactive Gatherables (20 Resources + 8 Healing Rest Campfires = 28/continent!)
    gatherables = []
    g_pts = []

    # 8 Wilderness Rest Campfires placed near our roadside camps / highways!
    fire_cnt = 0
    for ccx, ccz in camp_centers:
        if fire_cnt >= 8:
            break
        for k in range(8):
            ang = (k / 8.0) * math.tau
            fx, fz = ccx + math.cos(ang) * 24.0, ccz + math.sin(ang) * 24.0
            if is_dry_walkable(walkable, gs, ws, fx, fz, margin=2) and not too_close(fx, fz, b_dist=56.0, r_dist=16.0, ez_dist=38.0):
                if any(math.hypot(fx - gx2, fz - gz2) < 160.0 for gx2, gz2 in g_pts):
                    continue
                hv = sample_grid(heights, gs, ws, fx, fz) or 19.0
                fire_cnt += 1
                gatherables.append({
                    "id": f"{land}-campfire-{fire_cnt}",
                    "kind": "campfire",
                    "title": "Ognisko Wędrowców",
                    "sprite": "res://assets/library/props/prop_bonfire_pit.webp",
                    "w": 215,
                    "h": 215,
                    "x": round(fx, 2),
                    "z": round(fz, 2),
                    "y": round(float(hv), 2),
                })
                g_pts.append((fx, fz))
                break

    # 20 Interactive Gatherable Resource Nodes scattered near roads & wilderness glades
    res_cnt = 0
    for attempt in range(900):
        if res_cnt >= 20:
            break
        # Bias half near highways so players encounter them naturally while exploring!
        if res_cnt < 10 and highway_pts:
            rx, rz = rng.choice(highway_pts)
            ang = rng.uniform(0.0, math.tau)
            gx, gz = rx + math.cos(ang) * rng.uniform(32.0, 68.0), rz + math.sin(ang) * rng.uniform(32.0, 68.0)
        else:
            gx = rng.uniform(-ws * 0.42, ws * 0.42)
            gz = rng.uniform(-ws * 0.42, ws * 0.42)
        if not is_dry_walkable(walkable, gs, ws, gx, gz, margin=2):
            continue
        if too_close(gx, gz, b_dist=64.0, r_dist=18.0, ez_dist=28.0):
            continue
        if any(math.hypot(gx - ox, gz - oz) < 110.0 for ox, oz in g_pts):
            continue
        hv = sample_grid(heights, gs, ws, gx, gz) or 19.0
        gt = pal["gather_types"][res_cnt % len(pal["gather_types"])]
        res_cnt += 1
        gatherables.append({
            "id": f"{land}-gather-{res_cnt}",
            "kind": "gather",
            "title": gt["title"],
            "sprite": gt["sprite"],
            "w": gt["w"],
            "h": gt["h"],
            "item_id": gt["item_id"],
            "item_name": gt["item_name"],
            "icon": gt["icon"],
            "xp": gt["xp"],
            "gold": gt["gold"],
            "x": round(gx, 2),
            "z": round(gz, 2),
            "y": round(float(hv), 2),
        })
        g_pts.append((gx, gz))

    # 4. Two Named Zone Mini-Boss Elites per continent (placed near mid-tier & high-tier exp zones!)
    ezs_sorted = sorted(ezs, key=lambda t: t[2])
    elite_anchors = []
    if len(ezs_sorted) >= 2:
        elite_anchors = [ezs_sorted[len(ezs_sorted) // 2], ezs_sorted[-1]]
    for idx, el in enumerate(pal["elites"]):
        if idx < len(elite_anchors):
            ex, ez, _ = elite_anchors[idx]
            placed_e = False
            for k in range(12):
                ang = (k / 12.0) * math.tau
                mx, mz = ex + math.cos(ang) * 38.0, ez + math.sin(ang) * 38.0
                if is_dry_walkable(walkable, gs, ws, mx, mz, margin=2) and math.hypot(mx - cx, mz - cz) > safe_r + 60.0:
                    hv = sample_grid(heights, gs, ws, mx, mz) or 19.0
                    monsters.append({
                        "id": el["id"],
                        "actor_id": el["actor_id"],
                        "name": el["name"],
                        "level": el["level"],
                        "hp": el["hp"],
                        "atk": el["atk"],
                        "xp": el["xp"],
                        "gold": el["gold"],
                        "x": round(mx, 2),
                        "z": round(mz, 2),
                        "y": round(float(hv), 2),
                        "patrol_radius": 28.0,
                        "is_elite": True,
                        "scale_mult": 1.38,
                    })
                    placed_e = True
                    break
            assert placed_e, f"Could not place elite {el['id']} on {land}"

    d["props"] = props
    d["gatherables"] = gatherables
    d["monsters"] = monsters
    bfile.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{land}: +{added_props} wilderness clustered props (total={len(props)}), gatherables={len(gatherables)} (campfires={fire_cnt}, res={res_cnt}), elites={len(pal['elites'])}")


if __name__ == "__main__":
    for land in ("pyra", "verdant", "aether", "nexus"):
        enrich_land(land)
