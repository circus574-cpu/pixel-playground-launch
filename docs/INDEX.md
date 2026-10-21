# Ki Legends — indeks dokumentacji dla agentów

Ten plik jest punktem startowym dla Codexa, architekta, audytora i nowych agentów. Czytaj dokumentację z tej samej gałęzi/commita, na którym pracujesz. `main` jest bazą obowiązującą dopiero po scaleniu zatwierdzonych zmian.

## Źródła
- [Instrukcje dla agentów](../AGENTS.md)
- [Produkcja i zasady publikacji](PRODUCTION.md)
- [Pipeline zasobów GPU](GPU_ASSET_PIPELINE.md)
- [Plan czterech kontynentów](STAGE3-FOUR-CONTINENTS.md)
- [Lista zasobów GPU](STAGE3-GPU-ASSET-LIST.md)
- [Etap PvE](STAGE2-GAMEPLAY.md)
- [Testy ras](TESTING-RACE-SWITCH.md)
- [Raport stabilizacji PvE](QA-STAGE2-2026-10-20.md)
- [Globus 3D /mapa](MAPA-GLOBUS-3D.md)
- [Centralny kanon ras i etapów — tekst z dokumentu właściciela](design/RASY_I_ETAPY.md)
- Oryginalny dokument właściciela: `Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf` (12 stron, 20.10.2026). **Nie jest jeszcze umieszczony w repozytorium.** Wymagane dodanie binarnego oryginału do `docs/design/` i weryfikacja SHA-256. Nie zastępować go tekstowym streszczeniem.

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
