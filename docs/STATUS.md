# KI Legends — stan projektu
**Stan przejściowy / rekonstrukcja: 2026-10-21. Nie jest końcowym audytem implementacji.**

## Repozytorium i zakres
GitHub: https://github.com/circus574-cpu/pixel-playground-launch
Produkcja: https://kilegends.pl/
Dokumentacyjny punkt odniesienia: drzewo `main` SHA `8045a0bd2ebe77bcbd00dcedf17d8b48e13b3d40` odczytane podczas rekonstrukcji; **jest to SHA drzewa, nie commit**. Ostateczny commit gry należy dopisać po zakończeniu prac Codexa.

## Potwierdzone dokumentacją i historycznymi testami (nie jest to świeży re-test)
- Lokalne PvE, A*, NPC, zadania, walka, HP/KI/XP, łupy, handel, ulepszenia, zapisy.
- Cztery regiony startowe i selektor postaci; lokalna migracja zapisów.
- Adapter i pipeline GPU, testy importerów i przygotowanie renderera.
- Raporty `docs/STAGE3-FOUR-CONTINENTS.md`, `docs/PRE_GPU_STABILIZATION.md` dokumentują wyniki QA na wcześniejszych SHA; nie przenosić automatycznie statusu PASS na nowy kod.

## Prace aktywne/niezweryfikowane
- PR #4 `feat/gpu-hero-approval-20261020` — Planetarni rig/animacje, na ostatniej kontroli draft; produkcja zasobów trwała.
- Gałąź `feat/gpu-city-assets-20261020` — historycznie 89 PNG w `art/production/city-v1/sources` względem `main` przy odczycie SHA drzewa `65515228c469a73a8681a4a42ad85f73f97a55ca`. Obejmuje eksperymenty/odrzucone obrazy i klatki efektów, nie 89 zaakceptowanych obiektów.
- Pełna dostawa postaci wszystkich ras, ostateczna jakość i integracja graficzna — NIEZWERYFIKOWANE.
- Bieżące testy PR, dostępność danych Git LFS, fizyczny telefon, finalny SHA produkcji — NIEZWERYFIKOWANE.

## Werdykt przejściowy
**NIEZWERYFIKOWANE — bez zgody na publikację nowych zmian.** Brak końcowego SHA i kompletu niezależnych dowodów dla bieżącej produkcji GPU. Stan uzupełnić dopiero po zamknięciu napraw Codexa, bez ingerencji w jego gałęzie.


## Sprawdzona kotwica historii
Bezpośrednio odczytana historia `main`: 79 commitów, od `dad00cb77760242916c556adb1286c543648c5fe` (2026-10-16) do commita `8045a0bd2ebe77bcbd00dcedf17d8b48e13b3d40` (2026-10-20). Wcześniejszy identyfikator drzewa `main` ma tę samą wartość wyświetloną przez odczyt API w tym przypadku; jako bazowy **commit** traktować odczyt z endpointu commits, nie sam odczyt drzewa. Nie jest to końcowy SHA prac GPU.


## Aktualizacja po analizie PR #8 — 2026-10-21 (nowszy punkt odniesienia)
**Nadrzędny stan dla bieżącego main:** commit `86a1e411339bc41fb218d4633ed2a7bd81e1f167` (merge PR #7); poprzedni `8045a0b` jest historyczną bazą rekonstrukcji, nie aktualnym main. Dokumentacyjny PR #8: `779ad95d041093fb7b2fcb0409562cf0ab1d7cb7`, bazuje na `86a1e41`. Szczegóły źródłowe: [HANDOFF](https://github.com/circus574-cpu/pixel-playground-launch/blob/779ad95d041093fb7b2fcb0409562cf0ab1d7cb7/docs/HANDOFF.md), [TECHNICAL_STATE](https://github.com/circus574-cpu/pixel-playground-launch/blob/779ad95d041093fb7b2fcb0409562cf0ab1d7cb7/docs/TECHNICAL_STATE.md), [FINAL_TESTS](https://github.com/circus574-cpu/pixel-playground-launch/blob/779ad95d041093fb7b2fcb0409562cf0ab1d7cb7/docs/handoff/FINAL_TESTS.md).

**Potwierdzone dowodami:** PR #5 (HUD) i PR #7 (weryfikacja) scalono; workflow GitHub Actions [39540694141](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39540694141) dla `7a52aaeb0412b671e6d9e0bf0825980b7bc131e9` zakończył się `success`. Raport PR #8 dla kodu `86a1e41` zawiera świeże lokalne: typecheck PASS, 97/97 unit, assets:check PASS, lint 0 błędów/7 zastanych ostrzeżeń, build PASS, 54/54 Playwright PASS (0 fail/skip, 893,33 s), w środowisku headless Chromium/Canvas. Logi i wyniki są w PR #8. Testów nie uruchamiał niezależnie autor niniejszej rekonstrukcji; zweryfikowano obecność raportów i status CI. Lokalny test używał istniejących node_modules, nie czystego `npm ci`.

**Produkcja:** raport #8 wiąże wcześniejsze wdrożenie HUD z deployment `ba5606b9-a3d2-40e1-a6ee-8514cdf0c02d` i 7/7 testów domeny; nie przeprowadzono teraz niezależnej kontroli publicznej domeny ani bezpośredniego dowodu zgodności deploy z każdym kolejnym SHA. PR #8 nie wdrażał gry.

**GPU/bohater:** PR #4 na `7c50e8d5a93a3cf98c094f1ee341829fd6b0354c` nadal DRAFT OPEN; 179/416 klatek (idle 64, walk 64, attack 51), brak 237. Nie ma pełnego aktora ani zatwierdzonego testu w grze. Raport #8: pobrano i sprawdzono SHA/rozmiary 181 obiektów LFS (31 918 089 B), 179 PNG oraz edytowalny .blend; jest to **dowód z raportu i artefaktów Codexa**, nie nasz ponowny download. Nie dowodzi obecności modeli ani pełnego woluminu. GPU wyłączone według właściciela przekazanego Codexowi.

**Werdykt:** bazowe PvE/HUD mają mocne dowody automatyczne; pełna oprawa GPU, fizyczny Android, produkcja aktualnego SHA i finalny odbiór wizualny pozostają NIEZWERYFIKOWANE. Brak zgody na nowe wdrożenie.
