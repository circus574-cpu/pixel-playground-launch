#!/usr/bin/env python3
"""Populate all 4 expanded 4096m KI Legends continents with:
1. Owner-approved 40 canonical monster spawns (10 zones / 38 monsters per continent = 152 total, 0 in safe capitals)
2. 8 Playable Labyrinths (2 per continent) with solvable 15x15 mazes, 32 Hidden Labyrinth Treasure Chests (4/lab),
   and 24 Labyrinth Guardians + enterable portal entrances on the continent
3. 24 Hidden World Treasures & Field Adventure Shrines (6 per continent across all 5 sub-biomes)
4. 8 Wilderness Quest NPCs / Expedition Scouts (2 per continent near labyrinth entrances & outer strongholds)
5. Auto-export REAL 1:1 /admin "Świat Superior" data bundle (src/game/world/superiorLiveWorld.generated.ts)
   and real painted continent WebP maps (public/admin-world/*.webp).

Idempotent: safe to re-run without duplicating entries.
"""
import json
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
REGIONS_DIR = ROOT / "ports" / "godot-isometric-world" / "regions"
MONSTERS_JSON = ROOT / "ports" / "godot-isometric-world" / "data" / "monsters.json"
ADMIN_MAP_DIR = ROOT / "public" / "admin-world"
ADMIN_TS_OUT = ROOT / "src" / "game" / "world" / "superiorLiveWorld.generated.ts"

# Accepted 4096m spawn layout — closer outer-gate hunting rings (Lv.1-4 near capital) + smooth frontier progression
ZONE_LAYOUT = [
    ("green",  5, 130,  345,  -45),
    ("green",  5, 130,  420,  140),
    ("green",  5, 130,  540,   45),
    ("gold",   4, 135,  760, -135),
    ("gold",   4, 135,  880,   15),
    ("gold",   4, 135, 1020,  105),
    ("orange", 3, 135, 1220, -100),
    ("orange", 3, 135, 1340,  -15),
    ("orange", 3, 135, 1460,  165),
    ("red",    2, 120, 1620,   75),
]


def monster_stats_for_level(lvl: int) -> tuple[int, int, int, int]:
    """Rebalanced Lv.1-18 monster stats (hp, atk, xp, gold) for smooth solo progression without Lv.1 brick wall."""
    lv = max(1, int(lvl))
    if lv == 1:
        return (145, 15, 28, 14)
    if lv == 2:
        return (225, 22, 40, 19)
    if lv == 3:
        return (320, 30, 54, 25)
    if lv == 4:
        return (440, 39, 70, 32)
    m_hp = int(125 + lv * 64 + (lv ** 2) * 9)
    m_atk = int(14 + lv * 6.8 + (lv ** 1.5) * 1.5)
    m_xp = int(22 + lv * 13)
    m_gold = int(10 + lv * 6)
    return (m_hp, m_atk, m_xp, m_gold)


WAYSTONE_DEFS = {
    "pyra": [
        ("ws-pyra-north", "Kamień Szlaku — Północne Łowiska", 440, -55, "res://assets/library/props/prop_waystone_pillar.webp"),
        ("ws-pyra-south", "Kamień Szlaku — Południowy Trakt", 560, 135, "res://assets/library/props/prop_waystone_pillar.webp"),
        ("ws-pyra-lab1", "Kamień Szlaku — Wrota Kaldery", 0, 0, "res://assets/library/props/prop_waystone_pillar.webp", "lab-pyra-caldera"),
        ("ws-pyra-lab2", "Kamień Szlaku — Cmentarzysko Smoków", 0, 0, "res://assets/library/props/prop_waystone_pillar.webp", "lab-pyra-dragon"),
    ],
    "verdant": [
        ("ws-verdant-north", "Kamień Szlaku — Polana Łowców", 440, -35, "res://assets/library/props/prop_waystone_pillar.webp"),
        ("ws-verdant-south", "Kamień Szlaku — Szlak Korzeni", 560, 125, "res://assets/library/props/prop_waystone_pillar.webp"),
        ("ws-verdant-lab1", "Kamień Szlaku — Krąg Druidów", 0, 0, "res://assets/library/props/prop_waystone_pillar.webp", "lab-verdant-roots"),
        ("ws-verdant-lab2", "Kamień Szlaku — Katakumby Lotosu", 0, 0, "res://assets/library/props/prop_waystone_pillar.webp", "lab-verdant-lotus"),
    ],
    "aether": [
        ("ws-aether-north", "Kamień Szlaku — Źródła Eteru", 450, -130, "res://assets/library/props/prop_runic_obelisk.webp"),
        ("ws-aether-south", "Kamień Szlaku — Śnieżny Trakt", 570, 55, "res://assets/library/props/prop_runic_obelisk.webp"),
        ("ws-aether-lab1", "Kamień Szlaku — Lodowy Labirynt", 0, 0, "res://assets/library/props/prop_runic_obelisk.webp", "lab-aether-glacier"),
        ("ws-aether-lab2", "Kamień Szlaku — Krypta Astrolabium", 0, 0, "res://assets/library/props/prop_runic_obelisk.webp", "lab-aether-astro"),
    ],
    "nexus": [
        ("ws-nexus-north", "Węzeł Telemetrii — Sektor Północny", 440, -45, "res://assets/biomes/nexus_holo_monolith.webp"),
        ("ws-nexus-south", "Węzeł Telemetrii — Południowy Kanał", 560, 125, "res://assets/biomes/nexus_holo_monolith.webp"),
        ("ws-nexus-lab1", "Węzeł Telemetrii — Labirynt Rdzenia", 0, 0, "res://assets/biomes/nexus_holo_monolith.webp", "lab-nexus-core"),
        ("ws-nexus-lab2", "Węzeł Telemetrii — Cmentarzysko Mechów", 0, 0, "res://assets/biomes/nexus_holo_monolith.webp", "lab-nexus-mechs"),
    ],
}

LABYRINTH_DEFS = {
    "pyra": [
        {
            "id": "lab-pyra-caldera",
            "title": "Labirynt Wulkanicznej Kaldery",
            "subtitle": "Magmowe Korytarze i Ołtarz Żaru",
            "level": 5,
            "theme": "pyra",
            "sprite": "res://assets/biomes/pyra_fire_arch.webp",
            "target_dist": 720,
            "angle_deg": -20,
            "seed": 1101,
            "chests": [
                ("Skarbiec Bazaltowego Korytarza", 140, 120, "crystal_ki"),
                ("Kasetka Kowali Ognia", 180, 150, "mat_elite_core"),
                ("Ukryty Relikwiarz Żaru", 220, 180, "boots_swift_t2"),
                ("Koronna Skrzynia Kaldery", 320, 260, "amulet_guardian_q"),
            ],
            "guardian": ("pyra-skalny-berserker", "Strażnik Kaldery", 6),
        },
        {
            "id": "lab-pyra-dragon",
            "title": "Krypta Cmentarzyska Smoków",
            "subtitle": "Pradawny Labirynt Popiołu i Kości",
            "level": 14,
            "theme": "pyra",
            "sprite": "res://assets/biomes/pyra_obsidian_monolith.webp",
            "target_dist": 1340,
            "angle_deg": 25,
            "seed": 1102,
            "chests": [
                ("Skrzynia Smoczych Łusek", 260, 220, "mat_elite_core"),
                ("Zapieczętowana Urna Popiołu", 310, 260, "potion_ki"),
                ("Skarb Obsydianowej Komnaty", 380, 320, "shield_basalt"),
                ("Dziedzictwo Płomiennego Smoka", 520, 460, "ring_titan"),
            ],
            "guardian": ("pyra-plomien-duch", "Kustosz Smoczej Krypty", 15),
        },
    ],
    "verdant": [
        {
            "id": "lab-verdant-roots",
            "title": "Labirynt Korzeni Druidów",
            "subtitle": "Zarośnięte Dolmeny i Zielone Komnaty",
            "level": 5,
            "theme": "verdant",
            "sprite": "res://assets/biomes/verdant_druid_dolmen.webp",
            "target_dist": 740,
            "angle_deg": 165,
            "seed": 2201,
            "chests": [
                ("Skrzynia Mchowego Ołtarza", 140, 120, "potion_hp"),
                ("Zasobnik Zielarza Przystani", 180, 150, "mat_elite_core"),
                ("Relikwia Starego Dębu", 220, 180, "gloves_adept_t2"),
                ("Skarbiec Kręgu Druidów", 320, 260, "amulet_guardian_q"),
            ],
            "guardian": ("verdant-korzeniowy-pelzacz", "Strażnik Korzeni", 6),
        },
        {
            "id": "lab-verdant-lotus",
            "title": "Zatopione Katakumby Lotosu",
            "subtitle": "Świetliste Podziemia Mokradeł",
            "level": 14,
            "theme": "verdant",
            "sprite": "res://assets/biomes/verdant_moss_shrine.webp",
            "target_dist": 1360,
            "angle_deg": 70,
            "seed": 2202,
            "chests": [
                ("Skrytka Świetlistych Zarodników", 260, 220, "mat_elite_core"),
                ("Kufer Zatopionej Świątyni", 310, 260, "crystal_ki"),
                ("Skarb Szmaragdowego Nurtu", 380, 320, "amulet_ki"),
                ("Pieczęć Pradawnego Lotosu", 520, 460, "ring_titan"),
            ],
            "guardian": ("verdant-lesny-pajak", "Tkacz Katakumb", 15),
        },
    ],
    "aether": [
        {
            "id": "lab-aether-glacier",
            "title": "Lodowy Labirynt Pieczęci",
            "subtitle": "Kryształowe Korytarze Mrozu",
            "level": 5,
            "theme": "aether",
            "sprite": "res://assets/biomes/aether_glacier_arch.webp",
            "target_dist": 750,
            "angle_deg": 195,
            "seed": 3301,
            "chests": [
                ("Szkatuła Białej Pieczęci", 140, 120, "potion_ki"),
                ("Zamarznięty Kufer Kronikarza", 180, 150, "mat_elite_core"),
                ("Skarb Kryształowej Sali", 220, 180, "amulet_spark_t2"),
                ("Relikwiarz Lodowego Mędrca", 320, 260, "amulet_guardian_q"),
            ],
            "guardian": ("aether-szmaragdowy-waz", "Strażnik Pieczęci", 6),
        },
        {
            "id": "lab-aether-astro",
            "title": "Krypta Gwiazd i Astrolabium",
            "subtitle": "Marmurowe Podziemia Sanktuarium",
            "level": 14,
            "theme": "aether",
            "sprite": "res://assets/biomes/aether_astrolabe.webp",
            "target_dist": 1320,
            "angle_deg": 10,
            "seed": 3302,
            "chests": [
                ("Komnata Gwiezdnych Tablic", 260, 220, "mat_elite_core"),
                ("Sejf Bibliotekarzy Eteru", 310, 260, "potion_hp"),
                ("Kasetka Srebrnego Astrolabium", 380, 320, "helm_aether"),
                ("Korona Tysiąca Źródeł", 520, 460, "ring_titan"),
            ],
            "guardian": ("aether-oko-wiedzy", "Strażnik Astrolabium", 15),
        },
    ],
    "nexus": [
        {
            "id": "lab-nexus-core",
            "title": "Sektor Labiryntu Rdzenia",
            "subtitle": "Zabezpieczony Węzeł Plazmowy",
            "level": 5,
            "theme": "nexus",
            "sprite": "res://assets/biomes/nexus_holo_monolith.webp",
            "target_dist": 730,
            "angle_deg": -85,
            "seed": 4401,
            "chests": [
                ("Kapsuła Danych Sektora-4", 140, 120, "crystal_ki"),
                ("Zasobnik Plazmowy RD-9", 180, 150, "mat_elite_core"),
                ("Skrytka Szyfrowanego Rdzenia", 220, 180, "helm_scout_t2"),
                ("Moduł Nadrzędny Nexusa", 320, 260, "amulet_guardian_q"),
            ],
            "guardian": ("nexus-pajak-spawalniczy", "Jednostka Ochrony Rdzenia", 6),
        },
        {
            "id": "lab-nexus-mechs",
            "title": "Podziemia Cmentarzyska Mechów",
            "subtitle": "Zapomniany Hangar Prototypów",
            "level": 14,
            "theme": "nexus",
            "sprite": "res://assets/biomes/nexus_reactor_ruin.webp",
            "target_dist": 1320,
            "angle_deg": 175,
            "seed": 4402,
            "chests": [
                ("Kontener Tytanowy MK-IV", 260, 220, "mat_elite_core"),
                ("Czarna Skrzynka Tytana", 310, 260, "crystal_ki"),
                ("Zbrojownia Hangaru Zero", 380, 320, "shield_basalt"),
                ("Rdzeń Prototypu Alfa-9", 520, 460, "ring_titan"),
            ],
            "guardian": ("nexus-straznik-rdzenia", "Egzekutor Hangaru", 15),
        },
    ],
}

WORLD_TREASURE_DEFS = {
    "pyra": [
        ("tr-pyra-1", "Ołtarz Płomiennego Żaru", "Starożytny żar wciąż tli się w misie z obsydianu.", 95, 80, "potion_hp", 460, -110),
        ("tr-pyra-2", "Zasypany Wóz Górników", "Porzucona skrzynia z wyprawy do bazaltowych kopalń.", 130, 110, "mat_obsidian", 820, -45),
        ("tr-pyra-3", "Kapliczka Żelazodrzewu", "Spalone pnie kryją schowek dawnych zwiadowców.", 150, 130, "scroll_tp", 760, 155),
        ("tr-pyra-4", "Relikwiarz Smoczego Żebra", "Pod kośćmi pradawnej bestii lśni kasetka z brązu.", 210, 180, "mat_ember", 1160, 35),
        ("tr-pyra-5", "Skrytka Północnych Fiordów", "Ukryty depozyt korsarzy Popielnego Morza.", 240, 200, "mat_elite_core", 1120, -115),
        ("tr-pyra-6", "Pieczęć Wulkanicznej Grani", "Runiczny obelisk ze skarbem dla wytrwałych odkrywców.", 310, 260, "ring_aether", 1480, 110),
    ],
    "verdant": [
        ("tr-verdant-1", "Dziupla Starego Dębu", "W wydrążonym pniu spoczywa sakwa leśnych strażników.", 95, 80, "potion_hp", 460, -140),
        ("tr-verdant-2", "Ołtarz Kwitnącej Sakury", "Pod latarniami sakury ukryto dar wędrowców.", 130, 110, "mat_amber", 790, -15),
        ("tr-verdant-3", "Zatopiona Skrzynia Lotosu", "Pomiędzy liliami wystaje okuty kufer z brązu.", 150, 130, "potion_ki", 900, 85),
        ("tr-verdant-4", "Kamienny Dolmen Przodków", "Mchowe runy otwierają skrytkę z dawnymi monetami.", 210, 180, "scroll_tp", 1100, 185),
        ("tr-verdant-5", "Skarb Północnej Przełęczy", "Zamarznięty zasobnik na skraju ośnieżonych szczytów.", 240, 200, "mat_elite_core", 1200, -65),
        ("tr-verdant-6", "Relikwiarz Zielonej Kaskady", "Za mgłą wodospadu czeka ukryty depozyt druidów.", 310, 260, "amulet_ki", 1460, 40),
    ],
    "aether": [
        ("tr-aether-1", "Kapliczka Gorącego Źródła", "Para wodna skrywa rzeźbioną kasetkę z nefrytu.", 95, 80, "potion_ki", 510, -145),
        ("tr-aether-2", "Zasypany Obelisk Śniegu", "Pod zaspą tkwi skrzynia ekspedycji kartografów.", 130, 110, "mat_rune", 800, 115),
        ("tr-aether-3", "Skrytka Marmurowego Akweduktu", "W niszy starego łuku zachował się skarb zakonu.", 150, 130, "crystal_ki", 860, 20),
        ("tr-aether-4", "Kryształowa Grota Lodowca", "Lodowe odłamki otaczają nienaruszoną urnę Ki.", 210, 180, "mat_lightdust", 1120, 195),
        ("tr-aether-5", "Północny Schowek Obserwatora", "Stare notatki i sakiewka złotych monet przy szlaku.", 240, 200, "mat_elite_core", 1160, -80),
        ("tr-aether-6", "Relikwiarz Południowego Mrozu", "Ostatnia skrzynia dawnych strażników wybrzeża.", 310, 260, "ring_aether", 1460, 95),
    ],
    "nexus": [
        ("tr-nexus-1", "Porzucony Kontener Zaopatrzenia", "Zapieczętowana skrzynia z konwoju Sektor-3.", 95, 80, "potion_hp", 470, -50),
        ("tr-nexus-2", "Zaszyfrowany Terminal Danych", "Po odszyfrowaniu uwalnia kredyty i kryształy Ki.", 130, 110, "mat_coil", 790, -110),
        ("tr-nexus-3", "Wrak Zwiadowczego Ślizgacza", "W kokpicie zachował się nietknięty moduł zasobów.", 150, 130, "potion_ki", 900, 175),
        ("tr-nexus-4", "Skrytka Bioluminescencyjnego Gaju", "Wśród świecących grzybów spoczywa kapsuła badawcza.", 210, 180, "mat_plasma", 1060, -45),
        ("tr-nexus-5", "Sejf Przekaźnika Solarnego", "Zapasowa skrzynka techniczna inżynierów wschodu.", 240, 200, "mat_elite_core", 1160, 25),
        ("tr-nexus-6", "Kapsuła Wielkiego Kanału", "Elitarny depozyt ukryty na południowym krańcu kanału.", 310, 260, "amulet_ki", 1440, 115),
    ],
}

WILDERNESS_NPCS = {
    "pyra": [
        ("pyra.npc.hunter", "Zwiadowca Varek", "Łowca Kaldery (Przygoda)", "!", "lab-pyra-caldera"),
        ("pyra.npc.warden", "Badaczka Orra", "Kronikarka Cmentarzyska Smoków", "!", "lab-pyra-dragon"),
    ],
    "verdant": [
        ("verdant.npc.hunter", "Tropiciel Bran", "Strażnik Korzeni Druidów", "!", "lab-verdant-roots"),
        ("verdant.npc.alchemist", "Zielarka Lira", "Odkrywczyni Katakumb Lotosu", "!", "lab-verdant-lotus"),
    ],
    "aether": [
        ("aether.npc.warden", "Kartograf Thal", "Przewodnik po Lodowym Labiryncie", "!", "lab-aether-glacier"),
        ("aether.npc.keeper", "Astronomka Vea", "Strażniczka Astrolabium", "!", "lab-aether-astro"),
    ],
    "nexus": [
        ("nexus.npc.hunter", "Zwiadowca K-14", "Technik Sektora Labiryntu", "!", "lab-nexus-core"),
        ("nexus.npc.warden", "Inżynier NORA-3", "Poszukiwaczka Wraków Mechów", "!", "lab-nexus-mechs"),
    ],
}


def generate_maze_15x15(seed: int) -> dict:
    """Generate a guaranteed-solvable 15x15 labyrinth maze (0=floor, 1=wall) with 4 dead-end/deep chest rooms & 3 guardians."""
    rng = random.Random(seed)
    W, H = 15, 15
    grid = [[1] * W for _ in range(H)]

    def carve(cx: int, cy: int) -> None:
        grid[cy][cx] = 0
        dirs = [(2, 0), (-2, 0), (0, 2), (0, -2)]
        rng.shuffle(dirs)
        for dx, dy in dirs:
            nx, ny = cx + dx, cy + dy
            if 1 <= nx < W - 1 and 1 <= ny < H - 1 and grid[ny][nx] == 1:
                grid[cy + dy // 2][cx + dx // 2] = 0
                carve(nx, ny)

    carve(1, 1)
    # Add 5 extra loops so navigation feels like a rich dungeon rather than a single linear corridor
    for _ in range(5):
        rx = rng.randrange(2, W - 2)
        ry = rng.randrange(2, H - 2)
        if grid[ry][rx] == 1:
            if (grid[ry][rx - 1] == 0 and grid[ry][rx + 1] == 0) or (grid[ry - 1][rx] == 0 and grid[ry + 1][rx] == 0):
                grid[ry][rx] = 0

    # BFS distance from start (1, 1) to place chests in deep chambers / dead ends
    from collections import deque
    dist = {(1, 1): 0}
    q = deque([(1, 1)])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and grid[ny][nx] == 0 and (nx, ny) not in dist:
                dist[(nx, ny)] = dist[(x, y)] + 1
                q.append((nx, ny))

    # Score floor tiles: prefer dead ends & deep distances from entrance
    candidates = []
    for (x, y), d in dist.items():
        if d < 5:
            continue
        open_n = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if grid[y + dy][x + dx] == 0)
        score = d * 2 + (8 if open_n == 1 else 0)
        candidates.append((score, d, x, y))
    candidates.sort(reverse=True)

    chest_tiles: list[tuple[int, int]] = []
    for _sc, _d, x, y in candidates:
        if len(chest_tiles) >= 4:
            break
        if all(abs(x - cx) + abs(y - cy) >= 4 for cx, cy in chest_tiles):
            chest_tiles.append((x, y))
    # Sort chests from closest to deepest (best loot in deepest chamber!)
    chest_tiles.sort(key=lambda pt: dist[pt])

    # Place 3 patrolling guardians along mid-to-deep corridors
    guard_tiles: list[tuple[int, int]] = []
    mid_cands = sorted(dist.items(), key=lambda kv: -kv[1])
    for (x, y), d in mid_cands:
        if len(guard_tiles) >= 3:
            break
        if d < 6 or (x, y) in chest_tiles:
            continue
        if all(abs(x - gx) + abs(y - gy) >= 4 for gx, gy in guard_tiles):
            guard_tiles.append((x, y))

    return {
        "width": W,
        "height": H,
        "spawn": [1, 1],
        "exit": [1, 1],
        "grid": ["".join("#" if c else "." for c in row) for row in grid],
        "chest_tiles": chest_tiles,
        "guardian_tiles": guard_tiles,
    }


def get_land_monsters(land: str) -> list[dict]:
    raw = json.loads(MONSTERS_JSON.read_text(encoding="utf-8"))["monsters"]
    prefix = land + "-"
    items = [v for k, v in raw.items() if k.startswith(prefix)]
    items.sort(key=lambda m: (int(m.get("level", 1)), str(m.get("id", ""))))
    return items[:10]


def pick_dry_point(walk: np.ndarray, surf: np.ndarray, ws: float, cx: float, cz: float,
                   safe_r: float, target_d: float, pref_deg: float, existing: list[tuple[float, float]],
                   min_sep: float = 260.0) -> tuple[float, float]:
    half = ws * 0.5
    dry = (walk > 0) & (surf[:, :, 0] < 35) & (surf[:, :, 1] < 35)
    best_pt = None
    best_score = 1e18
    for d_off in (0, 80, -80, 180, -180, 300, -300, 450, -450):
        dist = max(safe_r + 85.0, min(1820.0, target_d + d_off))
        for a_step in range(0, 360, 10):
            for sign in (1, -1):
                ang = math.radians(pref_deg + sign * a_step)
                wx = cx + math.cos(ang) * dist
                wz = cz + math.sin(ang) * dist
                if abs(wx) > half - 140.0 or abs(wz) > half - 140.0:
                    continue
                gx = int(round((wx + half) / ws * 511))
                gz = int(round((wz + half) / ws * 511))
                patch = dry[max(0, gz - 3):min(512, gz + 4), max(0, gx - 3):min(512, gx + 4)]
                if patch.size == 0 or patch.mean() < 0.85:
                    continue
                if any(math.hypot(wx - ex, wz - ez) < min_sep for ex, ez in existing):
                    continue
                score = abs(d_off) * 1.4 + a_step * 4.5
                if score < best_score:
                    best_score = score
                    best_pt = (wx, wz)
            if best_pt is not None and best_score < 220.0:
                return best_pt
    if best_pt is not None:
        return best_pt
    ys, xs = np.where(dry)
    for k in range(0, len(xs), 19):
        wx = (xs[k] / 511.0 - 0.5) * ws
        wz = (ys[k] / 511.0 - 0.5) * ws
        if math.hypot(wx - cx, wz - cz) > safe_r + 95.0 and all(math.hypot(wx - ex, wz - ez) > min_sep * 0.75 for ex, ez in existing):
            return wx, wz
    return cx + 480.0, cz


def height_at(heights: np.ndarray, ws: float, wx: float, wz: float) -> float:
    half = ws * 0.5
    gx = max(0, min(511, int(round((wx + half) / ws * 511))))
    gz = max(0, min(511, int(round((wz + half) / ws * 511))))
    return round(float(heights[gz, gx]), 2)


def is_dry_cell(walk: np.ndarray, surf: np.ndarray, ws: float, wx: float, wz: float) -> bool:
    half = ws * 0.5
    if abs(wx) > half - 80.0 or abs(wz) > half - 80.0:
        return False
    gx = max(0, min(511, int(round((wx + half) / ws * 511))))
    gz = max(0, min(511, int(round((wz + half) / ws * 511))))
    return bool(walk[gz, gx] > 0 and surf[gz, gx, 0] < 35 and surf[gz, gx, 1] < 35)


def populate_land(land: str) -> dict:
    rdir = REGIONS_DIR / land
    bpath = rdir / "buildings.json"
    data = json.loads(bpath.read_text(encoding="utf-8"))
    ws = float(data["world_size"])
    safe_r = float(data["safe_city_radius"])
    cx, cz = float(data["capital_center"][0]), float(data["capital_center"][1])

    heights = np.fromfile(rdir / "height.r32", dtype=np.float32).reshape(512, 512)
    walk = np.fromfile(rdir / "walkable.u8", dtype=np.uint8).reshape(512, 512)
    surf = np.array(Image.open(rdir / "surface.png").convert("RGBA").resize((512, 512), Image.Resampling.BILINEAR))

    # Strip previous generated labyrinth buildings & wilderness NPCs for clean idempotency
    buildings = [b for b in data.get("buildings", []) if b.get("role") != "labyrinth"]
    # Ensure Verdantia has an enterable 'hall' role (Dom Zgromadzeń) matching Pyra/Aether/Nexus
    if land == "verdant":
        for b in buildings:
            if b.get("id") == "verdant-hall":
                b["role"] = "hall"
                b["enterable"] = True
    npcs = [n for n in data.get("npcs", []) if not n.get("wilderness")]
    occupied = [(float(b["x"]), float(b["z"])) for b in buildings]

    rng = random.Random(hash(("superior-adventures-v2", land)) & 0xFFFFFFFF)

    # 1. Monster Exp-Zones & 38 live Monsters per continent (0 inside safe_city_radius!)
    monsters_defs = get_land_monsters(land)
    exp_zones = []
    monsters = []
    zone_pts: list[tuple[float, float]] = []
    for idx, mon in enumerate(monsters_defs):
        band, count, zrad_m, target_d, pref_deg = ZONE_LAYOUT[idx]
        zx, zz = pick_dry_point(walk, surf, ws, cx, cz, safe_r, target_d, pref_deg, zone_pts, min_sep=250.0)
        zone_pts.append((zx, zz))
        lvl = int(mon.get("level", 1))
        m_hp, m_atk, m_xp, m_gold = monster_stats_for_level(lvl)
        zone_id = f"{land}-zone-{idx + 1}"
        exp_zones.append({
            "id": zone_id,
            "num": idx + 1,
            "name": f"{mon['name']} (Poz. {lvl})",
            "monster_id": mon["id"],
            "monster_name": mon["name"],
            "level": lvl,
            "band": band,
            "count": count,
            "radius": zrad_m,
            "x": round(zx, 1),
            "z": round(zz, 1),
            "y": height_at(heights, ws, zx, zz),
        })

        zone_mob_pts: list[tuple[float, float]] = []
        for mi in range(count):
            placed_m = None
            for attempt in range(48):
                ang = (2.0 * math.pi * mi / max(count, 1)) + rng.uniform(-0.35, 0.35) + attempt * 0.22
                rad = rng.uniform(34.0, zrad_m * 0.85)
                mx = zx + math.cos(ang) * rad
                mz = zz + math.sin(ang) * rad
                if math.hypot(mx - cx, mz - cz) <= safe_r + 75.0 or not is_dry_cell(walk, surf, ws, mx, mz):
                    continue
                if any(math.hypot(mx - omx, mz - omz) < 36.0 for omx, omz in zone_mob_pts):
                    continue
                placed_m = (mx, mz)
                break
            mx, mz = placed_m if placed_m else (zx, zz)
            zone_mob_pts.append((mx, mz))
            monsters.append({
                "id": f"{zone_id}-m{mi + 1}",
                "zone_id": zone_id,
                "actor_id": mon["id"],
                "name": mon["name"],
                "level": lvl,
                "hp": m_hp,
                "atk": m_atk,
                "xp": m_xp,
                "gold": m_gold,
                "x": round(mx, 2),
                "z": round(mz, 2),
                "y": height_at(heights, ws, mx, mz),
                "patrol_radius": 24.0,
            })

    # 2. 2 Playable Labyrinths per continent (enterable portal + 15x15 maze + 4 hidden chests + 3 guardians!)
    labyrinths = []
    lab_positions: dict[str, tuple[float, float]] = {}
    for ldef in LABYRINTH_DEFS[land]:
        lx, lz = pick_dry_point(walk, surf, ws, cx, cz, safe_r, ldef["target_dist"], ldef["angle_deg"], occupied, min_sep=220.0)
        occupied.append((lx, lz))
        lab_positions[ldef["id"]] = (lx, lz)
        maze = generate_maze_15x15(ldef["seed"])
        chests = []
        lab_lvl = int(ldef["level"])
        chest_xp_tier = [75, 95, 120, 160] if lab_lvl <= 8 else [160, 190, 230, 290]
        for ci, (cname, gold, _old_xp, item_id) in enumerate(ldef["chests"]):
            tx, ty = maze["chest_tiles"][ci] if ci < len(maze["chest_tiles"]) else (13, 13)
            chests.append({
                "id": f"chest-{ldef['id']}-{ci + 1}",
                "title": cname,
                "tx": tx,
                "ty": ty,
                "gold": gold,
                "xp": chest_xp_tier[min(ci, len(chest_xp_tier) - 1)],
                "item_id": item_id,
                "min_level": lab_lvl,
            })
        g_actor, g_name, g_lvl = ldef["guardian"]
        guardians = []
        for gi, (gx_t, gy_t) in enumerate(maze["guardian_tiles"]):
            guardians.append({
                "id": f"guard-{ldef['id']}-{gi + 1}",
                "actor_id": g_actor,
                "name": g_name,
                "level": g_lvl,
                "hp": int(240 + g_lvl * 105 + (g_lvl ** 2) * 11),
                "atk": int(22 + g_lvl * 8.2 + (g_lvl ** 1.5) * 1.6),
                "xp": int(65 + g_lvl * 18),
                "gold": int(28 + g_lvl * 10),
                "tx": gx_t,
                "ty": gy_t,
            })

        labyrinths.append({
            "id": ldef["id"],
            "title": ldef["title"],
            "subtitle": ldef["subtitle"],
            "level": ldef["level"],
            "theme": ldef["theme"],
            "x": round(lx, 2),
            "z": round(lz, 2),
            "y": height_at(heights, ws, lx, lz),
            "width": maze["width"],
            "height": maze["height"],
            "spawn": maze["spawn"],
            "exit": maze["exit"],
            "grid": maze["grid"],
            "chests": chests,
            "guardians": guardians,
        })

        # Add enterable Labyrinth Entrance building on the continent!
        ex, ez = lx, lz + 44.0
        if not is_dry_cell(walk, surf, ws, ex, ez):
            ex, ez = lx, lz
        buildings.append({
            "id": ldef["id"],
            "title": ldef["title"],
            "role": "labyrinth",
            "map_kind": "labyrinth",
            "enterable": True,
            "labyrinth_id": ldef["id"],
            "level": ldef["level"],
            "sprite": ldef["sprite"],
            "w": 520,
            "h": 540,
            "footprint_r": 34.0,
            "x": round(lx, 2),
            "z": round(lz, 2),
            "y": height_at(heights, ws, lx, lz),
            "entrance": [round(ex, 2), round(ez, 2)],
        })

    # 3. 6 Hidden World Treasures / Adventure Shrines per continent (with progressive min_level gates)
    treasures = []
    tr_min_levels = [1, 2, 3, 5, 8, 12]
    tr_xp_values = [45, 65, 85, 115, 145, 180]
    for tidx, (tid, ttitle, tlore, tgold, _old_txp, titem, tdist, tang) in enumerate(WORLD_TREASURE_DEFS[land]):
        tx, tz = pick_dry_point(walk, surf, ws, cx, cz, safe_r, tdist, tang, occupied, min_sep=170.0)
        occupied.append((tx, tz))
        treasures.append({
            "id": tid,
            "title": ttitle,
            "lore": tlore,
            "gold": tgold,
            "xp": tr_xp_values[min(tidx, len(tr_xp_values) - 1)],
            "item_id": titem,
            "min_level": tr_min_levels[min(tidx, len(tr_min_levels) - 1)],
            "x": round(tx, 2),
            "z": round(tz, 2),
            "y": height_at(heights, ws, tx, tz),
        })

    # 4. 2 Wilderness Expedition NPCs near the Labyrinth Entrances
    for aid, nname, nrole, qmark, lab_id in WILDERNESS_NPCS[land]:
        lx, lz = lab_positions[lab_id]
        nx, nz = lx + 48.0, lz + 52.0
        if not is_dry_cell(walk, surf, ws, nx, nz):
            nx, nz = lx, lz + 38.0
        npcs.append({
            "actor_id": aid,
            "name": nname,
            "role": nrole,
            "quest_mark": qmark,
            "wilderness": True,
            "labyrinth_id": lab_id,
            "x": round(nx, 2),
            "z": round(nz, 2),
            "y": height_at(heights, ws, nx, nz),
            "patrol_radius": 8.0,
        })

    # 5. 4 Discoverable Waystones (Kamienie Szlaku) per continent for non-GM fast travel
    waystones = []
    ws_pts: list[tuple[float, float]] = list(occupied)
    for wdef in WAYSTONE_DEFS[land]:
        wid, wtitle, wdist, wang, wsprite = wdef[0], wdef[1], wdef[2], wdef[3], wdef[4]
        lab_anchor = wdef[5] if len(wdef) > 5 else None
        if lab_anchor and lab_anchor in lab_positions:
            lx, lz = lab_positions[lab_anchor]
            placed_ws = None
            for k in range(16):
                a = (k / 16.0) * math.tau + 0.7
                wx, wz = lx + math.cos(a) * 68.0, lz + math.sin(a) * 68.0
                if is_dry_cell(walk, surf, ws, wx, wz) and math.hypot(wx - cx, wz - cz) > safe_r + 95.0:
                    placed_ws = (wx, wz)
                    break
            wx, wz = placed_ws if placed_ws else (lx - 52.0, lz + 36.0)
        else:
            wx, wz = pick_dry_point(walk, surf, ws, cx, cz, safe_r, wdist, wang, ws_pts, min_sep=140.0)
        ws_pts.append((wx, wz))
        waystones.append({
            "id": wid,
            "title": wtitle,
            "land": land,
            "sprite": wsprite,
            "w": 215,
            "h": 285,
            "x": round(wx, 2),
            "z": round(wz, 2),
            "y": height_at(heights, ws, wx, wz),
        })

    data["buildings"] = buildings
    data["npcs"] = npcs
    data["exp_zones"] = exp_zones
    data["monsters"] = monsters
    data["labyrinths"] = labyrinths
    data["treasures"] = treasures
    data["waystones"] = waystones
    bpath.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # Export real 1024x1024 WebP map for /admin "Świat Superior"
    ADMIN_MAP_DIR.mkdir(parents=True, exist_ok=True)
    im = Image.open(rdir / "map_art.png").convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
    im.save(ADMIN_MAP_DIR / f"{land}.webp", format="WEBP", quality=84, method=4)

    return data


def export_admin_ts(all_lands: dict[str, dict]) -> None:
    """Generate strongly typed TypeScript live-world dataset for /admin 'Świat Superior'."""
    slim_lands = {}
    for land, d in all_lands.items():
        slim_lands[land] = {
            "land_id": land,
            "world_size": d["world_size"],
            "safe_city_radius": d["safe_city_radius"],
            "capital_center": d["capital_center"],
            "map_image": f"/admin-world/{land}.webp",
            "sub_biomes": d.get("sub_biomes", []),
            "roads": [{"tier": r.get("tier", "footpath"), "pts": r.get("pts", [])} for r in d.get("roads", [])],
            "buildings": [
                {
                    "id": b.get("id", ""),
                    "title": b.get("title", ""),
                    "role": b.get("role", ""),
                    "map_kind": b.get("map_kind", ""),
                    "enterable": bool(b.get("enterable", False)),
                    "labyrinth_id": b.get("labyrinth_id", ""),
                    "level": int(b.get("level", 0)),
                    "x": b.get("x", 0),
                    "z": b.get("z", 0),
                }
                for b in d.get("buildings", [])
            ],
            "exp_zones": d.get("exp_zones", []),
            "monsters": [
                {
                    "id": m["id"],
                    "zone_id": m.get("zone_id", ""),
                    "actor_id": m["actor_id"],
                    "name": m["name"],
                    "level": m["level"],
                    "hp": m["hp"],
                    "atk": m["atk"],
                    "xp": m["xp"],
                    "gold": m["gold"],
                    "x": m["x"],
                    "z": m["z"],
                    "is_elite": bool(m.get("is_elite", False)),
                }
                for m in d.get("monsters", [])
            ],
            "fauna": [
                {
                    "actor_id": f.get("actor_id", ""),
                    "name": f.get("name", ""),
                    "x": f.get("x", 0),
                    "z": f.get("z", 0),
                    "patrol_radius": f.get("patrol_radius", 16),
                }
                for f in d.get("fauna", [])
            ],
            "npcs": [
                {
                    "actor_id": n.get("actor_id", ""),
                    "name": n.get("name", ""),
                    "role": n.get("role", ""),
                    "quest_mark": n.get("quest_mark", ""),
                    "wilderness": bool(n.get("wilderness", False)),
                    "labyrinth_id": n.get("labyrinth_id", ""),
                    "x": n.get("x", 0),
                    "z": n.get("z", 0),
                }
                for n in d.get("npcs", [])
            ],
            "labyrinths": d.get("labyrinths", []),
            "treasures": [
                {
                    "id": t["id"],
                    "title": t.get("title", ""),
                    "lore": t.get("lore", ""),
                    "gold": int(t.get("gold", 0)),
                    "xp": int(t.get("xp", 0)),
                    "item_id": t.get("item_id", ""),
                    "min_level": int(t.get("min_level", 1)),
                    "x": t["x"],
                    "z": t["z"],
                    "y": t.get("y", 0),
                }
                for t in d.get("treasures", [])
            ],
            "waystones": [
                {
                    "id": w["id"],
                    "title": w.get("title", ""),
                    "land": w.get("land", land),
                    "x": w["x"],
                    "z": w["z"],
                    "y": w.get("y", 0),
                }
                for w in d.get("waystones", [])
            ],
            "props_count": len(d.get("props", [])),
        }

    header = (
        "/* eslint-disable prettier/prettier */\n"
        "// AUTO-GENERATED by scripts/godot/populate_superior_adventures.py — DO NOT EDIT MANUALLY.\n"
        "// 1:1 live snapshot of ports/godot-isometric-world/regions/*/buildings.json (4096x4096 m).\n\n"
    )
    types_ts = """export type SuperiorLandId = "pyra" | "verdant" | "aether" | "nexus";

export type SuperiorSubBiome = {
  id: string;
  name: string;
  x: number;
  z: number;
  props_count: number;
};

export type SuperiorRoad = {
  tier: string;
  pts: [number, number][];
};

export type SuperiorBuilding = {
  id: string;
  title: string;
  role: string;
  map_kind: string;
  enterable: boolean;
  labyrinth_id: string;
  level: number;
  x: number;
  z: number;
};

export type SuperiorExpZone = {
  id: string;
  num: number;
  name: string;
  monster_id: string;
  monster_name: string;
  level: number;
  band: string;
  count: number;
  radius: number;
  x: number;
  z: number;
  y: number;
};

export type SuperiorMonster = {
  id: string;
  zone_id: string;
  actor_id: string;
  name: string;
  level: number;
  hp: number;
  atk: number;
  xp: number;
  gold: number;
  x: number;
  z: number;
  is_elite?: boolean;
};

export type SuperiorFauna = {
  actor_id: string;
  name: string;
  x: number;
  z: number;
  patrol_radius: number;
};

export type SuperiorNpc = {
  actor_id: string;
  name: string;
  role: string;
  quest_mark: string;
  wilderness: boolean;
  labyrinth_id: string;
  x: number;
  z: number;
};

export type SuperiorLabyrinthChest = {
  id: string;
  title: string;
  tx: number;
  ty: number;
  gold: number;
  xp: number;
  item_id: string;
  min_level?: number;
};

export type SuperiorLabyrinthGuardian = {
  id: string;
  actor_id: string;
  name: string;
  level: number;
  hp: number;
  atk: number;
  xp: number;
  gold: number;
  tx: number;
  ty: number;
};

export type SuperiorLabyrinth = {
  id: string;
  title: string;
  subtitle: string;
  level: number;
  theme: string;
  x: number;
  z: number;
  y: number;
  width: number;
  height: number;
  spawn: [number, number];
  exit: [number, number];
  grid: string[];
  chests: SuperiorLabyrinthChest[];
  guardians: SuperiorLabyrinthGuardian[];
};

export type SuperiorTreasure = {
  id: string;
  title: string;
  lore: string;
  gold: number;
  xp: number;
  item_id: string;
  min_level?: number;
  x: number;
  z: number;
  y: number;
};

export type SuperiorWaystone = {
  id: string;
  title: string;
  land: SuperiorLandId;
  x: number;
  z: number;
  y: number;
};

export type SuperiorLiveContinent = {
  land_id: SuperiorLandId;
  world_size: number;
  safe_city_radius: number;
  capital_center: [number, number];
  map_image: string;
  sub_biomes: SuperiorSubBiome[];
  roads: SuperiorRoad[];
  buildings: SuperiorBuilding[];
  exp_zones: SuperiorExpZone[];
  monsters: SuperiorMonster[];
  fauna: SuperiorFauna[];
  npcs: SuperiorNpc[];
  labyrinths: SuperiorLabyrinth[];
  treasures: SuperiorTreasure[];
  waystones?: SuperiorWaystone[];
  props_count: number;
};

"""
    payload = json.dumps(slim_lands, ensure_ascii=False, separators=(",", ":"))
    ADMIN_TS_OUT.write_text(
        header + types_ts + f"export const SUPERIOR_LIVE_WORLD: Record<SuperiorLandId, SuperiorLiveContinent> = {payload};\n",
        encoding="utf-8",
    )


def main() -> None:
    all_lands = {}
    summary = {}
    for land in ("pyra", "verdant", "aether", "nexus"):
        d = populate_land(land)
        all_lands[land] = d
        summary[land] = {
            "exp_zones": len(d["exp_zones"]),
            "monsters": len(d["monsters"]),
            "labyrinths": len(d["labyrinths"]),
            "lab_chests": sum(len(l["chests"]) for l in d["labyrinths"]),
            "treasures": len(d["treasures"]),
            "npcs": len(d["npcs"]),
            "fauna": len(d["fauna"]),
            "buildings": len(d["buildings"]),
        }
    export_admin_ts(all_lands)
    print("POPULATED_SUPERIOR_ADVENTURES_OK")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print("ADMIN_TS_KB:", round(ADMIN_TS_OUT.stat().st_size / 1024.0, 1))


if __name__ == "__main__":
    main()
