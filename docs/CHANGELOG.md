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
