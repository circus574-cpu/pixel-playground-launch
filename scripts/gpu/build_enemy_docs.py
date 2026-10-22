"""Writes docs/ENEMIES-KI-LEGENDS.md from art/production/enemies/roster.json (run from the repo root).
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
head = """# Ki Legends — 40 potworów (przeciwnicy NPC) — dokumentacja produkcyjna

**Data: 2026-10-22. Status: PRZYGOTOWANE W REPO, NIEZAINSTALOWANE W GRZE, NIEOCENIONE PRZEZ WŁAŚCICIELA** (poza podglądem pilota). Bossowie (8) **nie** należą do tej partii.
Źródło wymagań: bestiariusz właściciela [`design/BESTIARY-OWNER-2026-10-22.html`](design/BESTIARY-OWNER-2026-10-22.html) (obrazy tamże są tylko poglądowe; projekty wizualne potworów są własne). Surowe dane: `art/production/enemies/bestiary-owner.json`, wybrane projekty: `art/production/enemies/roster.json`, `selection-v1.json`.

## 1. Kontrakt wizualny (ten sam dla wszystkich)
- Paczka na potwora: **8 kierunków × 52 klatki = 416** (`idle 8`, `walk 8`, `attack 8`, `skill 8`, `hit 4`, `death 8`, `respawn 8`). Master 512×512 RGBA, dostawa 128×128, 2 strony atlasu ≤ 2048 px, profil `enemy` (rozmiar 84×84, origin `[0.5, 0.8]`).
- FPS: `idle 6`, `walk 16`, `attack 16`, `skill 12`, `hit 16`, `death 10`, `respawn 12`; `idle` i `walk` w pętli, pozostałe jednorazowo.
- Kierunki: `down`, `down-right`, `right`, `up-right`, `up` są malowane osobno; `left`, `down-left`, `up-left` są **dokładnymi lustrzanymi odbiciami** `right`, `down-right`, `up-right` (asymetria projektu jest więc odbijana).
- Punkt stóp stały: (256; 409,6) w masterze; latające i unoszące się potwory mają stopy podniesione o 36 px, a przy `death`/`respawn` lądują na ziemi.
- Atak: skok w stronę kierunku patrzenia, największe wychylenie w klatce 0, potem powrót. `skill`: pulsujące rozjaśnienie i powiększenie (sam efekt umiejętności nie jest częścią sprite'a). `hit`: biały błysk 60 → 35 → 15 → 0%, odrzut przeciwny do kierunku. `death`: opadanie i przyciemnienie wg archetypu; `respawn` to ten sam ruch odwrócony.
- Skala w ramce zależy od klasy rozmiaru (S 0,62 / M 0,80 / L 0,98 szerokości bazowej). Gdy animacja wychodzi poza margines bezpieczny (22 px), cały potwór jest zmniejszany (`shrink` w `report.json`).
- Kontrola: `report.json` w każdym wyjściu (`violations` musi być puste, `frames` = 416).

## 2. Powiększanie w grze bez GPU
Rozmiar potwora w świecie to pole `size` aktora w manifeście (domyślnie `[84, 84]`) i da się je zmienić tekstem. Klatki mają 128 px, więc **powiększenie do ok. 1,3× jest bezpieczne, powyżej ok. 1,3× obraz się rozmywa**. Ostrzejsze, większe klatki wymagałyby zmiany kontraktu (dostawa 128 px), więc to osobna decyzja; mastery 512 px są zachowane jako źródło. Zwiększenie bez GPU nie zmienia kolizji: footprint pozostaje w danych regionu.

## 3. Archetypy ruchu (animacja proceduralna deformacją siatki, bez szkieletu)
| Archetyp | Chód / bezruch | Śmierć |
|---|---|---|
"""
rows = "\n".join("| `%s` | %s: %s | %s |" % (k, v[0], v[1], v[2]) for k, v in MOTION.items())
bind = """

## 4. Wiązanie z grą — decyzja do podjęcia przez Codexa
Packer nadaje paczkom `actorBindings` `<świat>.enemy`, co dla 10 wrogów jednego świata **nadpisywałoby się nawzajem**. Walidator `scripts/lib/gpu-import.ts` dopuszcza tylko role `default|guide|hunter|merchant|smith`. Dlatego **paczki mają puste `actorBindings`**, a docelowe klucze `<świat>.enemy.<slug>` są w `art/production/enemies/bindings.json`. `actorVisual()` w `src/game/assets/catalog.ts` już szuka `<świat>.enemy.<rola>`, ale `worldAssets()` ładuje tylko `<świat>.enemy`. Do zrobienia przez Codexa: (1) rozszerzyć regex walidatora o `enemy.<slug>`, (2) w `worldAssets()` ładować wszystkie wizerunki wrogów danego świata, (3) przypisać potworom wygląd po ich id w definicjach wrogów regionu. Zmiana kolizji, statystyk i zachowań **nie jest** częścią tej partii.

## 5. Dane bestiariusza (wartości z dokumentu właściciela — nie wdrożone w kodzie gry)
Statystyki, zasięgi, zachowania i łupy poniżej są **kopią wymagań właściciela**, a nie opisem stanu implementacji.
"""
body = []
for w in WORLD:
    body.append("\n### %s\n" % WORLD[w])
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
tail = """
## 6. Znane wady i prawa
- Widoki malowane są niezależnie, więc proporcje i detale mogą różnić się między kierunkami; kierunki lewe to lustra.
- Animacja jest deformacją pojedynczego obrazu: nie ma ruchu kończyn jak w animacji ręcznej, a duże wychylenia wymuszają zmniejszenie potwora (wilk i krab pilota: 72% i 78%).
- Prawa do obrazów referencyjnych, punktów kontrolnych modeli i obrazów pochodnych są nierozstrzygnięte (patrz `ASSET-LICENSE-REGISTER.md`); nie publikować przed decyzją właściciela.
- Pod nie zostało zatrzymane ani zmienione; nic nie jest zainstalowane w grze ani opublikowane.
"""
(ROOT / "docs/ENEMIES-KI-LEGENDS.md").write_text(head + rows + bind + "\n".join(body) + tail, encoding="utf-8")
print("OK", len(roster))
