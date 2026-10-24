"""Updates the generated bestiary block in docs/ROZWOJ-I-WALKA.md from art/production/enemies/roster.json (run from the repo root).
  python3 scripts/gpu/build_enemy_docs.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
roster = json.loads((ROOT / "art/production/enemies/roster.json").read_text())["monsters"]
WORLD = {"verdant": "Verdantia", "aether": "Aetheria", "nexus": "Nexus-9", "pyra": "Pyra"}
SIZE = {"S": "mały (0,62)", "M": "średni (0,80)", "L": "duży (0,98)"}
MOTION = {
    "blob": ("podskok", "ściska się i wyciąga w pionie, odbija się od ziemi", "rozpłaszcza się i ciemnieje"),
    "quad": ("kłus", "unoszą się naprzemiennie łapy, lekki przechył korpusu", "przewraca się na bok (z boku) lub do przodu"),
    "crawl": ("drobne kroki", "szybkie drżenie odnóży, korpus ledwo się unosi", "przewraca się na grzbiet, odnóża w górze"),
    "slither": ("fala", "fala biegnąca wzdłuż ciała", "opada i spłaszcza się"),
    "plant": ("kołysanie", "kołysze się od podstawy, korzeń nieruchomy", "wygina się i opada"),
    "turret": ("prawie bez ruchu", "drżenie górnej części, korpus stoi", "przechyla się i ciemnieje (wygaszenie)"),
    "fly": ("trzepot", "unosi się i opada, skrzydła na zmianę", "spada na ziemię przechylony"),
    "hover": ("unoszenie", "pływa w górę i w dół, lekkie pulsowanie", "gaśnie i opada na ziemię"),
    "stomp": ("ciężki krok", "podskok i nacisk kolejnych łap", "opada na ziemię, spłaszcza się"),
}
head = """### Kontrakt grafiki potworów

Paczka: 8 kierunków × 52 klatki = 416; master 512² RGBA, klient 128²,
profil `enemy` 84×84, origin `(0.5,0.8)`. Ruch/stan nie zmienia statystyk.
Kierunki lewe są odbiciami prawych; asymetria projektu też jest odbijana.
Punkt stóp w masterze `(256,409.6)`, latające unoszą się o 36 px i lądują przy śmierci.
Animacja jest deformacją obrazu, nie pełnym ruchem ręcznie animowanych kończyn.
Kontrola raportu: 416 klatek, brak violations i pustej alfy, zgodne hashe/marginesy.
Skala S/M/L: 0.62/0.80/0.98; shrink w raporcie przy zbyt małym marginesie.
Wiązanie `<świat>.enemy.<slug>`; pełna mapa `art/production/enemies/bindings.json`.
Silnik danych/AI jest zaimplementowany. Grafiki dostaw nie są jeszcze zainstalowane,
a nowe spawny wymagają ukończenia kontynentów. Bossowie nie należą do tej czterdziestki.

| Archetyp | Ruch | Śmierć |
| --- | --- | --- |
"""
rows = "\n".join("| `%s` | %s: %s | %s |" % (k, v[0], v[1], v[2]) for k, v in MOTION.items())
bind = "\n\n### Pełne dane 40 potworów\n"
body = []
for w in WORLD:
    body.append("\n#### %s\n" % WORLD[w])
    for e in [m for m in roster if m["world"] == w]:
        st = e["stats"]; mo = MOTION[e["archetype"]]
        body.append(
            "**%s** (`%s`, poz. %s) — archetyp `%s` (%s), rozmiar %s.\n"
            "- Wygląd: %s.\n"
            "- Statystyki: HP %s, ATK %s, DEF %s, XP %s; prędkość %s, zasięg %s, agro %s.\n"
            "- Zachowanie: %s\n"
            "- Umiejętności: %s\n"
            "- Słabość: %s. Łup: %s.\n"
            "- Animacja: chód — %s; śmierć — %s.\n"
            % (e["name"], e["id"], e["level"], e["archetype"], mo[0], SIZE[e["size"]], e["design"], st["hp"], st["atk"], st["def"], st["xp"],
               e["speed"], e["range"], e["agro"], e["behavior"], "; ".join(e["skills"]), e["weakness"], e["loot"], mo[1], mo[2]))
tail = "\nPrawa do referencji i checkpointów: [licencje](LICENCJE.md). Kontrola grafiki nie jest odbiorem praw.\n"
target = ROOT / "docs/ROZWOJ-I-WALKA.md"
text = target.read_text()
start, end = "<!-- BESTIARY:START -->", "<!-- BESTIARY:END -->"
assert text.count(start) == text.count(end) == 1
before, rest = text.split(start)
_, after = rest.split(end)
target.write_text(before + start + "\n" + head + rows + bind + "\n".join(body) + tail + "\n" + end + after)
print("OK", len(roster), "bestiary records in", target)
