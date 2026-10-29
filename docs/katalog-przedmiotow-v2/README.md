# KI Legends — katalog przedmiotów V2 (29.10.2026)

**Status: specyfikacja do wdrożenia, nie stan funkcjonalny produkcyjnej gry.** Aktualny silnik `GameSession` zachowuje własny prosty ekwipunek i handel; ten katalog nie zmienia runtime, zapisów graczy, mechanik ani wdrożenia.

## Dostępne dane (zatwierdzona decyzja właściciela o pasywnych buffach)

- [366 przedmiotów — pełne dane JSON](KI_LEGENDS_366_PRZEDMIOTOW_V2.json) — 139 pozycji katalogu istniejącego, 116 wariantów starszej księgi, 6 odrębnych materiałów bestiariusza, 70 pozycji z plansz wyposażenia i 35 specjalnych artefaktów.
- [366 przedmiotów — CSV](KI_LEGENDS_366_PRZEDMIOTOW_V2.csv).
- [140 receptur — CSV](KI_LEGENDS_140_RECEPTUR_V2.csv); ich pełne dane są także w JSON.
- [Zasady balansu V2](ZASADY_BALANSU_PASYWNE_ARTEFAKTY_V2.md).

## Zasady obowiązujące dla przyszłego wdrożenia

1. Specjalnych kompletów artefaktów jest **dokładnie 5, po 7 elementów**. Buffy każdego założonego artefaktu i bonusy za 2/4/7 części działają **ciągle podczas wyposażenia**, bez aktywacji, proca, timera ani cooldownu. Zdjęcie artefaktu usuwa odpowiedni buff.
2. Nowe bonusy maksymalnych **HP, KI, ATK i DEF wyraża się procentowo** względem bazowych statystyk postaci; nie konwertuje się przez to automatycznie bieżących danych `GameSession`.
3. Zestawy zwykłego wyposażenia i specjalne artefakty mają odmienne reguły. Szczegółowe wartości i ograniczenia: JSON + MD.
4. Zachowano kanoniczne identyfikatory źródłowego katalogu. Kolizje z wariantami starszej księgi otrzymały prefiks `KS-`.
5. Przed implementacją konieczne są testy skalowania, stacking, granic bonusów, migracji zapisu, wyposażania/zdejmowania oraz działania NPC/sklepu.

## Pliki binarne — opublikowane i zweryfikowane

- [Pełny katalog V2 — PDF, 69 stron](KI_LEGENDS_KATALOG_366_PASYWNE_BUFFY_V2.pdf) — opisy, grafiki, klasy jakości i parametry przedmiotów.
- [Pełny pakiet ZIP](KI_LEGENDS_PAKIET_366_PASYWNE_ARTEFAKTY_V2.zip) — 366 przedmiotów, 140 receptur, PDF, zasady balansu, skrypt walidacji i 15 oryginalnych plansz.
- [15 oryginalnych plansz JPG](plansze/) — oddzielne grafiki źródłowe.

GitHub Actions [przebieg 40937429473](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40937429473) **SUCCESS**, potwierdzono SHA-256 ZIP (`2bd02649bc873001b24c655fe5023940e660bec6ae7187a1e87add10dd389852`), PDF i 15 grafik. Samo umieszczenie danych w repozytorium **nie oznacza wdrożenia ekwipunku do gry**.

Szczegółowe sumy kontrolne i nazwy: [MANIFEST_BINARNY.md](MANIFEST_BINARNY.md).

**Dowód źródłowy:** `src/game/items/catalog.ts` i `src/game/items/recipes.ts`, odczytane na `f94f456432783b258eecbdd436dc57482e89c4f2`. Dane JSON/CSV/MD są identyczne bajtowo z przygotowaną rewizją V2 według SHA Git blob.
