# KI Legends — roadmap historyczna i przyszła
Rekonstrukcja 2026-10-21; nie jest obietnicą terminów. Status końcowy wymaga audytu na zamkniętym SHA.

## Zrealizowane według historycznych raportów (wymaga kontroli regresji)
1. Etap bazowy: las/wioska, ruch, kamera, kolizje, minimapa, proste celowanie.
2. Etap anime: oddzielne podłoże/obiekty, oddalenie i pełny ekran, odrzucenie płaskiej grafiki świata.
3. Etap 2: lokalna walka PvE, A*, aktywne umiejętności, AI dzików, questy, XP, łupy, ekwipunek, handel, ulepszenie, lokalny zapis.
4. Etap 3: cztery regiony startowe, cztery pochodzenia, sloty postaci, migracja zapisów i mobilne QA.
5. Stabilizacja przed GPU: adapter animacji, importer/manifest assetów, cache terenu, testy regresyjne.

## W toku — nie zatwierdzać jako ukończone
6. Produkcja GPU: pełne, spójne postacie czterech ras; 8 kierunków i animacje; niezależne zasoby miast; KI, NPC, fauna, atlasy; legalność/licencje; optymalizacja.
7. Integracja assetów w Phaserze: jakość faktycznej gry na komputerze i telefonie, test wydajności i pamięci, porównanie produkcji z SHA. Roboczy PR #4 (2026-10-20) dotyczył Planetarnych, pozostawał draft.
8. Niezależny audyt, naprawy, akceptacja wizualna właściciela, jawna zgoda na publikację.

## Kolejne kierunki — bez uzgodnionego zakresu i terminu
9. Rozbudowa świata, NPC, fabuły, przeciwników i progresji po zatwierdzeniu pierwszej kompletnej lokacji.
10. Arena/PvP — późniejszy etap.
11. Architektura serwerowa i rzeczywisty multiplayer/MMORPG — późniejszy etap wymagający osobnej specyfikacji i bezpieczeństwa danych.
12. Rozwój ekonomii, społeczności i długoterminowej zawartości — otwarte.

## Bramki
Każdy etap wymaga: zadania i kryteriów akceptacji, SHA, różnicy kodu, testów, sprawdzenia desktop/mobile, kontroli regresji, aktualizacji dokumentacji, decyzji audytora i osobnej zgody właściciela na publikację.


## Aktualizacja kolejności po przekazaniu #8
**Zamknięte według dowodów:** naprawa mobilnego/desktopowego HUD w PR #5, dokumentacja QA PR #7, bazowy kod `86a1e41`; raportowane 97/97 unit, 54/54 E2E, pełne typecheck/assets/lint/build PASS. Dodatkowo wcześniej opublikowano HUD i raportowano 7/7 testów produkcji. Nie utożsamiać z wdrożeniem grafiki GPU.

**Wstrzymane/nieukończone:** priorytet właściciela to kompletny Planetarny przed pozostałymi rasami i masową produkcją miast. Checkpoint 179/416; najpierw dokończyć 237 klatek, obejrzeć animacje, uzgodnić profil `grounded` z main, spakować/importować opt-in, przetestować w grze, uzyskać akceptację. Potem NPC/przeciwnicy, a następnie otoczenie dopasowane do skali. Wcześniejsze etapy produkcji miast pozostają archiwum, nie nakazem natychmiastowego wznowienia.

**Bramki sprzętowe:** GPU wyłączone; wznowienie wymaga zgody właściciela, kontroli woluminu/runtime/modeli i kosztów. Przed komercyjną publikacją dodatkowo kontrola licencji, fizyczny Android/sprzętowy WebGL, wydajność i porównanie deploy z SHA. Źródło: `docs/GPU_PRODUCTION.md` i `docs/HANDOFF.md` w PR #8.
