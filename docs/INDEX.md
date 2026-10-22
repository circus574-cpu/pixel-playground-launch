# Ki Legends — indeks dokumentacji dla agentów

Ten plik jest punktem startowym dla Codexa, architekta, audytora i nowych agentów. Czytaj dokumentację z tej samej gałęzi/commita, na którym pracujesz. `main` jest bazą obowiązującą dopiero po scaleniu zatwierdzonych zmian.

## Dokumentacja audytowa i bieżąca
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
- [Rejestr licencji grafik i modeli — nierozstrzygnięte prawa](ASSET-LICENSE-REGISTER.md)
- [Rejestr licencji zależności i notices](DEPENDENCY-LICENSE-REGISTER.md)
- [Instrukcje dla agentów](../AGENTS.md)
- [Produkcja i zasady publikacji](PRODUCTION.md)
- [Pipeline zasobów GPU](GPU_ASSET_PIPELINE.md)
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
