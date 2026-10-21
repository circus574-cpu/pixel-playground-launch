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
