# Ki Legends — indeks dokumentacji dla agentów

Ten plik jest punktem startowym dla Codexa, architekta, audytora i nowych agentów. Czytaj dokumentację z tej samej gałęzi/commita, na którym pracujesz. `main` jest bazą obowiązującą dopiero po scaleniu zatwierdzonych zmian.

## Dokumentacja audytowa i bieżąca

- [Zielona Przystań — funkcjonalne miasto Planetarnych](VERDANTIA-FUNCTIONAL-CITY-2026-10-23.md)
- [Miasta — kontrakt wspólnego silnika i podział Codex / Claude](CITY-INTEGRATION-CONTRACT-2026-10-23.md)

- [Integracja czterech malowanych ras z dostawy Claude’a — źródła, runtime i QA](FOUR-PAINTED-RACES-INTEGRATION-2026-10-22.md)
- [Malowane widoki i deformacja siatki — pipeline oraz znane wady dostawy](PAINTED-MESH-PIPELINE.md)
- [ORYGINALNY PDF 12 stron — kompletne binarne archiwum z obrazami, odtwarzalne bezstratnie](design/original-pdf-parts/README.md)
- [Transkrypcja tekstowa PDF — pomocnicza](design/SOURCE-PDF-ARCHIVE.md)
- [Osobna kolejka GPU: Androidy → Legendy → miasta czterech ras](GPU-PRODUCTION-SEQUENCE.md)
- [Architektura i źródła implementacji](ARCHITECTURE.md)
- [Roadmap i bramy etapów](ROADMAP.md)
- [Rejestr decyzji](DECISIONS.md)
- [Status zweryfikowany / main vs PR](STATUS.md)
- [Otwarte zadania i usterki](TASKS.md)
- [Historia zmian](CHANGELOG.md)
- [Roboczy raport QA PR #15](https://github.com/circus574-cpu/pixel-playground-launch/blob/integration/ki-regressions-20261021/docs/QA-INTEGRATION-REGRESSIONS-2026-10-21.md) — tylko gałąź PR, nie main.

## Źródła

- [Przekazanie sesji 22.10.2026 — stan, decyzje, plan na rano](SESSION-2026-10-22-HANDOFF.md)
- [Geometria planety: miasta w czworościanie, 80 000 j. między każdą parą (22.10.2026)](PLANET-GEOMETRY-2026-10-22.md)
- [Wdrożenie tekstur kontynentów i przyrody (22.10.2026)](NATURE-TERRAIN-DEPLOYMENT-2026-10-22.md)
- [Analiza gry i zbiorcza lista zleceń na GPU (23.10.2026)](GPU-BACKLOG-2026-10-23.md)
- [GPU: krajobraz planety i neutralna fauna — specyfikacja zlecenia (23.10.2026)](GPU-LANDSCAPE-AND-FAUNA-2026-10-23.md)
- [Kontynenty w skali planety, miasta 4000 × 2500 (gałąź feat/continent-worlds)](CITY-CONTINENT-SCALE-2026-10-23.md)
- [Aetheria — miasto Mędrców: układ, budynki, mieszkańcy (gałąź feat/aetheria-city, niescalone)](CITY-AETHERIA-2026-10-23.md)
- [Nexus-9 — miasto Androidów: układ, budynki, mieszkańcy (gałąź feat/nexus-city, niescalone)](CITY-NEXUS-2026-10-23.md)
- [Pyra — miasto Legend: układ, budynki, mieszkańcy (gałąź feat/pyra-city, niescalone)](CITY-PYRA-2026-10-23.md)
- [Rejestr licencji grafik i modeli — nierozstrzygnięte prawa](ASSET-LICENSE-REGISTER.md)
- [Rejestr licencji zależności i notices](DEPENDENCY-LICENSE-REGISTER.md)
- [Instrukcje dla agentów](../AGENTS.md)
- [Produkcja i zasady publikacji](PRODUCTION.md)
- [Pipeline zasobów GPU](GPU_ASSET_PIPELINE.md)
- [Instrukcja dla Codexa: cztery rasy i tekstury kontynentów (22.10.2026)](CODEX-PAINTED-HEROES-AND-TERRAIN-2026-10-22.md)
- [Malowane widoki + deformacja siatki — pipeline bohaterów](PAINTED-MESH-PIPELINE.md)
- [40 potworów — kontrakt, animacje, dane bestiariusza (22.10.2026)](ENEMIES-KI-LEGENDS.md)
- [Rasy, drzewka umiejętności i potwory w rozgrywce — wdrożenie (22.10.2026)](GAMEPLAY-RACES-AND-MONSTERS.md)
- [Aneks właściciela: statystyki ras i drzewka umiejętności (poz. 1–20)](design/CHARACTER-PROGRESSION-LEVELS-1-20.md)
- [Plan czterech kontynentów](STAGE3-FOUR-CONTINENTS.md)
- [Lista zasobów GPU](STAGE3-GPU-ASSET-LIST.md)
- [Etap PvE](STAGE2-GAMEPLAY.md)
- [Testy ras](TESTING-RACE-SWITCH.md)
- [Raport stabilizacji PvE](QA-STAGE2-2026-10-20.md)
- [Globus 3D /mapa](MAPA-GLOBUS-3D.md)
- [Aetheria — anime punkt startowy (podgląd do oceny)](AETHER-ANIME-START.md)
- [Nexus-9 i Pyra — anime punkty startowe (podgląd do oceny)](NEXUS-PYRA-ANIME-START.md)
- [Verdantia — alternatywna wioska startowa (podgląd do oceny)](VERDANT-ANIME-START.md)
- [Centralny kanon ras i etapów — tekst z dokumentu właściciela](design/RASY_I_ETAPY.md)
- Oryginalny dokument właściciela: `Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf` (12 stron, 20.10.2026). **Jest zarchiwizowany na gałęzi tego PR bezstratnie w 12 binarnych częściach** pod `docs/design/original-pdf-parts/`. Rekonstrukcja przez `python3 docs/design/original-pdf-parts/restore.py` odtwarza identyczny PDF o SHA-256 `be58d9df4fb49d19b11a66d47a1a3fc3fbbf5acc9c11ddc5cf76213f6be15734`. Archiwum nie znajduje się jeszcze w `main`; wymaga scalenia PR #16. Nie zastępować tekstowym streszczeniem.

## Hierarchia i stan

1. Wyraźne decyzje właściciela oraz zatwierdzony kanon mają pierwszeństwo.
2. Odróżniaj **koncepcję**, **implementację**, **zweryfikowane testy** i **zatwierdzoną publikację**.
3. Dokumenty w otwartych PR-ach są materiałem roboczym, nie automatycznie obowiązującym stanem `main`.
4. Nie zakładaj, że wszystkie rasy i funkcje opisane w koncepcji są już zaimplementowane.
5. Zapisuj istotne decyzje, commity, testy i nierozwiązane problemy w repozytorium.

## Decyzja właściciela: kontrola GPU (21.10.2026)

Wyłącznie właściciel decyduje o **uruchomieniu, zatrzymaniu, restarcie, usunięciu lub zmianie konfiguracji instancji GPU**, także gdy prace się skończyły, instancja jest bezczynna lub wystąpił błąd. Codex może odczytywać stan, wykonywać zatwierdzone zadania na już działającej instancji, zabezpieczać dane i zgłaszać potrzebę decyzji. Nie wolno mu samodzielnie zmieniać stanu ani parametrów instancji.

## Publikacja

Bez odrębnej zgody właściciela nie scalać PR, nie publikować gry i nie modyfikować produkcji. Niezależny audyt wymaga dowodów z kodu, commitów, CI i działającej gry.
