# KI Legends — rejestr decyzji właściciela i granic audytu

Stan wiedzy na **2026-10-22**; weryfikacja repo na `main` `66a615dec1d4259e1bf668956ec1cb09e9aa177e`. Rozdzielać instrukcję właściciela, implementację, testy i publikację.

| Data | Ustalenie | Źródło i granice |
| --- | --- | --- |
| 2026-10-19 | Rozwijać lokalne PvE na zachowanej mapie anime; brak deklaracji ukończonego multiplayera | [PRODUCTION](PRODUCTION.md), [STAGE2](STAGE2-GAMEPLAY.md) |
| 2026-10-20 | Kanoniczne rasy i krainy: Planetarni/Verdantia, Mędrcy/Aetheria, Androidy/Nexus-9, Legendy/Pyra | [STAGE3](STAGE3-FOUR-CONTINENTS.md), `src/game/world/races.ts` |
| 2026-10-21 | Wyłącznie właściciel steruje cyklem życia instancji GPU; zakaz samodzielnego start/stop/restart/terminate | [AGENTS.md](../AGENTS.md), [GPU-PRODUCTION-SEQUENCE](GPU-PRODUCTION-SEQUENCE.md) |
| 2026-10-21 | Dokumenty w otwartym PR nie są automatycznie stanem `main`; dowodami są Git i Actions | [INDEX](INDEX.md) |
| 2026-10-22 | Właściciel wydał polecenie scalenia przygotowanych zmian i publikacji oraz sprawdzenia gry na Androidzie | [Zapis zgody](qa/PUBLISH-AUTHORIZATION-2026-10-22.md); **zgoda nie oznacza wykonania deploy ani zaliczenia testów** |
| 2026-10-22 | Faktyczne scalenie PR #15, #16, #17 | GitHub [#15](https://github.com/circus574-cpu/pixel-playground-launch/pull/15), [#16](https://github.com/circus574-cpu/pixel-playground-launch/pull/16), [#17](https://github.com/circus574-cpu/pixel-playground-launch/pull/17); to fakt repo, nie potwierdzenie wdrożenia na domenie |
| 2026-10-22 | Integracja atlasu planety 2D/3D w grze znalazła się na `main` | Commit [`66a615d`](https://github.com/circus574-cpu/pixel-playground-launch/commit/66a615dec1d4259e1bf668956ec1cb09e9aa177e), `src/components/game/GameHud.tsx`, [MAPA](MAPA-GLOBUS-3D.md) |
| 2026-10-22 | Właściciel wymaga domyślnego bohatera Planetarnych bez parametru podglądu | [PR #21](https://github.com/circus574-cpu/pixel-playground-launch/pull/21), aktualnie OPEN; nie traktować jako obowiązującego `main` |
| 2026-10-22 | Nowe załączniki ras i bestiariusz zostały przedstawione w osobnym PR dokumentacyjnym | [PR #20](https://github.com/circus574-cpu/pixel-playground-launch/pull/20), OPEN; nie są jeszcze elementem `main` |

## Decyzje techniczne wymagające odrębnego potwierdzenia
- PR #21: obecny pełny QA to **FAILURE (89/95)**, Software WebGL **SUCCESS** na tym samym SHA; techniczne bramki niezakończone. Nie ma zgody audytora na publikację tej zmiany.
- Niezweryfikowane są testy fizycznego Androida, sprzętowego WebGL, pełny łańcuch praw do pierwowzorów grafik, dokładny SHA produkcji i finalny odbiór wizualny.
- Nie wpisano nowej, specyficznej zgody na scalanie PR #20/#21 ani PR dokumentacyjnego powstającego przy synchronizacji stanu. Odrębna wcześniejsza zgoda właściciela z 22.10 pozostaje faktem historycznym, lecz nie jest uniwersalnym zwolnieniem z kontroli.
- Sztuczne obniżanie progów testów lub usuwanie regresji nie jest dopuszczalnym dowodem naprawy.

Każdą następną decyzję podpinać pod konkretny SHA/PR, datę, adres dowodu i zakres. Nie zmieniać historycznego PDF.
