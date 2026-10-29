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

## Ograniczenia i pliki binarne

Pełny **69-stronicowy PDF**, **15 oryginalnych plansz JPG** i zbiorczy ZIP zostały przygotowane oddzielnie, ale **nie znajdują się jeszcze w tym katalogu repozytorium**: połączenie GitHub wykorzystywane podczas tego commita nie udostępnia przekazywania binarnych plików bezpośrednio z lokalnego kontenera. Nie traktuj poniższego manifestu jako dowodu dodania tych binariów.

Docelowe nazwy:
- `KI_LEGENDS_KATALOG_366_PASYWNE_BUFFY_V2.pdf`
- `KI_LEGENDS_PAKIET_366_PASYWNE_ARTEFAKTY_V2.zip`
- `plansze/*.jpg` (15 obrazów)

Sprawdzenie rozmiarów i SHA-256 oraz lista obrazów: [MANIFEST_BINARNY.md](MANIFEST_BINARNY.md). **Do pełnego archiwum w GitHubie pozostaje przesłać te 17 plików binarnych** (PDF, ZIP i 15 JPG); PDF i ZIP już zawierają ilustracje, więc dupliczne zapisy mogą być uznane za niepotrzebne po zatwierdzeniu przez właściciela.

**Dowód źródłowy:** `src/game/items/catalog.ts` i `src/game/items/recipes.ts`, odczytane na `f94f456432783b258eecbdd436dc57482e89c4f2`. Dane JSON/CSV/MD są identyczne bajtowo z przygotowaną rewizją V2 według SHA Git blob.
