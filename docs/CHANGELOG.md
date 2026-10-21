# KI Legends — chronologia odtworzona
To historia dokumentacyjna, nie zastępuje `git log`. Nie przypisywać datom i opisom nieznanych SHA.

## 2026-10-19
- Audyt bazowy repo, kodu i produkcji; wskazano ograniczenia prostej walki, renderera i błędy pełnego TypeScript. Zob. `docs/AUDIT-2026-10-19.md`.
- Zwrot stylistyczny: anime fantasy zamiast wcześniejszego pixel/medieval; oddzielne tekstury, obiekty i postacie. `docs/ANIME-RESET.md`, `docs/ANIME-FOREST.md`.
- Właściciel zatwierdził pracę nad lokalną pętlą PvE. `docs/STAGE2-GAMEPLAY.md`.

## 2026-10-20
- Udokumentowano etap 2: walka, AI, A*, zadania, XP, handel, ekwipunek i zapis.
- Ustalono cztery kanoniczne pochodzenia i regiony: Planetarni/Verdantia, Mędrcy/Aetheria, Androidy/Nexus-9, Legendy/Pyra; starsze Human/Orc/Dwarf/Elf zastąpiono. `docs/STAGE3-FOUR-CONTINENTS.md`.
- Stabilizacja przed GPU: importer assetów, adapter animacji, testy regresji i cache terenu. `docs/PRE_GPU_STABILIZATION.md`.
- Rozpoczęto GPU art i Git LFS; plansze obiektów i pierwsze ujęcia riga Planetarnych pokazane właścicielowi. Wizualna akceptacja całości nie nastąpiła.
- Otwarty roboczy PR #4 z bohaterem Planetarnych; na ostatniej kontroli pełne E2E były w toku. Brak podstaw do oznaczenia jako gotowy do publikacji.

## 2026-10-21
- Właściciel zlecił trwałą rekonstrukcję historii, planów, mechanik, lore i statusów w repozytorium; odrębna gałąź dokumentacyjna i PR do zatwierdzenia.
- Końcowy stan implementacji celowo pozostawiono otwarty do zakończenia napraw Codexa i sprawdzenia konkretnego SHA.

## Do uzupełnienia
Dokładny rejestr wszystkich commitów i PR od pierwszego commita, powiązanie wersji produkcyjnej z SHA, zamknięte błędy/regresje i wyniki końcowego audytu. Bez bezpośrednich dowodów nie przypisywać ich jako faktów.


## Weryfikacja osi Git (2026-10-21)
Bezpośredni odczyt GitHub `commits?sha=main&per_page=100` zwrócił **79 commitów** na osiągalnej historii `main`, od `dad00cb77760242916c556adb1286c543648c5fe` (2026-10-16, szablon TanStack) do `8045a0bd2ebe77bcbd00dcedf17d8b48e13b3d40` (2026-10-20, „Lovable update”). Ważne kotwice: `d0a2ba66d620715c2d82222758b8971600640e4a` (merge PR #2, stabilizacja przed GPU), `f739f0d9bbf194bfffebcbf95bc569dcece2ddff` (cache terenu), `38310adf343496e4839521d1749e964de8a7f492` (pipeline animacji). Pełna historia jest dostępna w Git; nie przypisano automatycznie znaczenia 79 commitom bez analizy każdego diffu. Gałęzie robocze mogą zawierać dodatkowe commity nieosiągalne z `main`.


## 2026-10-21 — udokumentowane naprawy i przekazanie
- PR #5 `fix/mobile-hud-layout-20261020`, head `7a52aaeb0412b671e6d9e0bf0825980b7bc131e9`, merge `5e72796a5ee450736429cb4101a0bbfd81bf55c6`: układ HUD, menu mobilne, zasięg rozmowy, stack statusu, focus/dotyk, poprawki E2E i lint generowanych typów. Poprzedni CI miał 48 PASS/6 FAIL, po poprawkach CI `39540694141` success (97 unit/54 E2E).
- PR #7 `docs/mobile-hud-verification-20261021`, head `ea8648968acad9899e918ef706009f7022547b5e`, merge `86a1e411339bc41fb218d4633ed2a7bd81e1f167`: dowody QA, bez nowego kodu gameplay. Wcześniejsze wdrożenie HUD: deployment `ba5606b9-a3d2-40e1-a6ee-8514cdf0c02d` i 7/7 testów domeny według raportu Codexa.
- PR #8 `docs/codex-cloud-handoff-20261021`: pierwszy commit `d824ccc400b2f417e6fef656679b72f9297f7b4f`, head `779ad95d041093fb7b2fcb0409562cf0ab1d7cb7`; dodano HANDOFF, GPU_PRODUCTION, TECHNICAL_STATE, FINAL_TESTS i dowody, bez zmian kodu gry. Świeży lokalny test kodu `86a1e41`: 97/97 unit, 54/54 Playwright, typecheck/assets/lint/build PASS według logów #8.
- GPU Planetarni: checkpoint `motion-v2` **179/416**; PR #8 raportuje nową weryfikację 181 obiektów LFS (31 918 089 B), lecz nie nowy render, nie pełną dostawę i nie kontrolę wyłączonego poda. Roboczy PR #4 head `7c50e8d5a93a3cf98c094f1ee341829fd6b0354c` pozostaje niescalony.
- Rekonstrukcja PR #6 uzupełniona o te fakty i rozbieżności bez edycji dokumentów PR #8 i bez publikacji.
