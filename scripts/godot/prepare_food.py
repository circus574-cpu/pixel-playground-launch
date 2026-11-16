#!/usr/bin/env python3
"""Food system of the Godot port -> ports/godot-pyra/data/food.json, plus the table of what it means in numbers.

Design (balance budget):
- The hero already regenerates 0.3 % of max HP per second OUT OF COMBAT (BASE_HP_REGEN in race_kit.gd, as in the browser game); in combat
  the natural regeneration stops for 5 s after every hit. A Life Potion heals 40 % at once with a 6 s cooldown: the emergency tool.
- FOOD is the sustained tool: an eaten meal gives the status "Najedzenie" that heals a share of max HP every second for some seconds, in combat too.
  Total healing per meal: tier 1 = 14-18 %, tier 2 = 27-36 %, tier 3 = 42-60 % of max HP (a potion is 40 % at once), spread over 30-90 s.
- One meal at a time: a new one replaces the old one only if it still has more to give (otherwise "Jestes jeszcze najedzony"), so nothing is wasted
  by stacking; at full health the meal is refused (like a potion).
- Ten peaceful animals (never attack, never aggro, run away when hurt) each give one product. Their art does not exist yet: they are listed with
  "art": false and are not spawned until the sprites are made.

Run: python3 scripts/godot/prepare_food.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PORT = ROOT / "ports" / "godot-pyra"
BASE_REGEN = 0.003   # fraction of max HP per second out of combat

# id, name, tier, rate (fraction of max HP per second), seconds, price (coins), extra buff fields, flavour text, buyable in shops (shopPrice or 0)
FOODS = [
    ("F-01", "Udziec zająca", 1, 0.0050, 30, 4, {}, "Szybko upieczone mięso z łąk Verdantii. Lekkie, ale stawia na nogi.", 0),
    ("F-02", "Jajka leśne", 1, 0.0040, 45, 3, {}, "Drobne, ciemne jajka leśnych kur. Gotowane na twardo, na drogę.", 12),
    ("F-03", "Jajko hodowlane", 1, 0.0035, 40, 3, {}, "Jajko z bio-farm Nexusa. Dokładnie takie samo za każdym razem.", 12),
    ("F-04", "Ser kozi", 2, 0.0050, 60, 10, {}, "Twardy, słony ser ze skalnych pastwisk Pyry. Syci na długo.", 40),
    ("F-05", "Mięso jaszczura", 2, 0.0060, 45, 9, {}, "Ogon popielnego jaszczura upieczony w żarze. Chrupie.", 0),
    ("F-06", "Mleko księżycowe", 2, 0.0040, 90, 12, {"kiRegenPct": 0.25}, "Srebrzyste mleko owiec Aetherii. Leczy powoli i wyostrza oddech (+25% regeneracji KI).", 48),
    ("F-07", "Szynka dzicza", 3, 0.0070, 60, 20, {}, "Wędzona szynka mchowych dzików. Ciężka, treściwa.", 0),
    ("F-08", "Pieczony bażant", 3, 0.0080, 60, 26, {}, "Bażant z Żarowego Traktu, pieczony na kamieniu. Gospodarze Pyry są z niego dumni.", 0),
    ("F-09", "Gołąb w ziołach", 3, 0.0090, 60, 32, {}, "Pergaminowy gołąb duszony z ziołami z ogrodów Sanktuarium.", 0),
    ("F-10", "Racja białkowa", 3, 0.0100, 60, 36, {}, "Zbilansowana racja z bio-królika hodowlanego. Najskuteczniejsza, bo wyliczona.", 0),
]

# id, name, world, product, hp, speed (relative to the hero, flee speed), respawn s, notes
ANIMALS = [
    ("A-01", "Zając Łąkowy", "verdant", "F-01", 30, 1.15, 45, "Ucieka zygzakiem; trudny do dogonienia, łatwy do ubicia."),
    ("A-02", "Kura Leśna", "verdant", "F-02", 20, 0.9, 40, "Chodzi stadkiem, ucieka z poklepywaniem skrzydeł."),
    ("A-03", "Dzik Mchowy", "verdant", "F-07", 180, 0.8, 90, "Łagodny, pasie się w mchu. Wytrzymały, ucieka powoli."),
    ("A-04", "Koza Skalna", "pyra", "F-04", 70, 1.0, 60, "Skacze po skałach; daje ser."),
    ("A-05", "Jaszczur Popielny", "pyra", "F-05", 50, 1.05, 50, "Wygrzewa się na ciepłym popiele."),
    ("A-06", "Bażant Żarowy", "pyra", "F-08", 35, 1.1, 70, "Krótkie loty nad ziemią, rudy jak żar."),
    ("A-07", "Owca Księżycowa", "aether", "F-06", 90, 0.85, 75, "Świeci łagodnie w zmroku; daje mleko."),
    ("A-08", "Gołąb Pergaminowy", "aether", "F-09", 25, 1.2, 55, "Siada na parapetach archiwów, płoszy się od ruchu."),
    ("A-09", "Bio-królik Hodowlany", "nexus", "F-10", 40, 1.1, 50, "Ucieka po bio-farmach; ma metalową obrożę z numerem."),
    ("A-10", "Bio-kura Hodowlana", "nexus", "F-03", 25, 0.9, 40, "Znosi jajka co godzinę, według harmonogramu."),
]

RACES = ["legend", "planetary", "sage", "android"]
RACE_NAMES = {"legend": "Legenda", "planetary": "Planetarny", "sage": "Mędrzec", "android": "Android"}


def max_hp(race: str, level: int) -> float:
    d = json.loads((PORT / "data" / "races" / f"{race}.json").read_text())
    return d["base"]["hp"] + d["perLevel"]["hp"] * (level - 1)


def table() -> str:
    lines = []
    lines.append("Regeneracja naturalna (0,3 % maks. HP/s, tylko poza walką, 5 s po ciosie nie działa):")
    lines.append(f"{'Rasa':12s}" + "".join(f"  poz.{lv:>2} (HP {{hp}})".replace('{hp}', '').ljust(18) for lv in (1, 10, 20)))
    for r in RACES:
        row = f"{RACE_NAMES[r]:12s}"
        for lv in (1, 10, 20):
            hp = max_hp(r, lv)
            row += f"  {hp:4.0f} HP: {hp * BASE_REGEN:4.2f}/s".ljust(18)
        lines.append(row)
        full = [f"{1 / BASE_REGEN:.0f} s" for _ in (1, 10, 20)]
    lines.append(f"Pełne życie z zera samą regeneracją: {1 / BASE_REGEN:.0f} s ({1 / BASE_REGEN / 60:.1f} min), niezależnie od poziomu.")
    lines.append("")
    lines.append("Jedzenie (w % maks. HP; HP/s i HP łącznie dla Legendy poz. 10 = 518 HP, Mędrca poz. 10 = 352 HP):")
    lines.append(f"{'':5s}{'Produkt':18s}{'pn':>3s} {'%/s':>6s} {'czas':>6s} {'łącznie':>8s}  {'Legenda 10':>16s}  {'Mędrzec 10':>16s}  {'zwierzę':s}")
    animal_of = {a[3]: a[1] for a in ANIMALS}
    for fid, name, tier, rate, secs, _price, extra, _t, _shop in FOODS:
        total = rate * secs
        L = max_hp("legend", 10)
        S = max_hp("sage", 10)
        lines.append(f"{fid:5s}{name:18s}{tier:>3d} {rate * 100:6.2f} {secs:5d}s {total * 100:7.0f}%  {L * rate:5.2f}/s = {L * total:4.0f} HP  {S * rate:5.2f}/s = {S * total:4.0f} HP  {animal_of[fid]}")
    lines.append("")
    lines.append("Razem poza walką (jedzenie + regeneracja naturalna), Legenda poz. 10:")
    for fid, name, tier, rate, secs, *_ in FOODS:
        hp = max_hp("legend", 10)
        total_rate = rate + BASE_REGEN
        lines.append(f"  {name:18s} {total_rate * hp:5.2f} HP/s przez {secs} s (samo życie: {BASE_REGEN * hp:4.2f} HP/s); w walce tylko jedzenie: {rate * hp:5.2f} HP/s")
    lines.append("")
    lines.append("Dla porównania mikstura życia: 40 % maks. HP od razu (Legenda poz. 10: 207 HP), odnowienie 6 s.")
    return "\n".join(lines)


def main() -> None:
    foods = []
    for fid, name, tier, rate, secs, price, extra, text, shop in FOODS:
        foods.append({
            "id": fid, "name": name, "tier": tier, "regenPerSecond": rate, "seconds": secs, "totalFraction": round(rate * secs, 4),
            "extra": extra, "price": price, "shopPrice": shop, "description": text,
        })
    animals = []
    for aid, name, world, product, hp, speed, respawn, note in ANIMALS:
        animals.append({
            "id": aid, "name": name, "world": world, "drop": product, "hp": hp, "fleeSpeed": speed, "respawnSeconds": respawn,
            "attacks": False, "aggro": 0, "flees": True, "art": False, "note": note,
        })
    assert len({f["id"] for f in foods}) == 10 and len({a["id"] for a in animals}) == 10
    assert {a["drop"] for a in animals} == {f["id"] for f in foods}, "every food comes from exactly one animal"
    data = {"format": "ki-godot-food-1", "baseRegenPerSecond": BASE_REGEN, "foods": foods, "animals": animals,
            "rules": {"oneMealAtATime": True, "refuseAtFullHealth": True, "worksInCombat": True, "eatCooldownSeconds": 2.0}}
    (PORT / "data" / "food.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(table())


if __name__ == "__main__":
    main()
