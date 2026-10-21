# KI Legends — niezależne uzgodnienie PR #6 i PR #8 (2026-10-21)

Status: **DOKUMENTACJA GOTOWA DO PRZEGLĄDU, WDROŻENIE I GRAFIKA GPU NIEZATWIERDZONE**. Niniejszy aneks uzupełnia historię, nie zmienia kodu ani dokumentów Codexa. Niezależny audytor odczytał dokumenty, ale **nie uruchomił ponownie lokalnych testów Codexa**, nie logował się do wyłączonego GPU ani nie przeprowadzał nowego deploymentu.

## Kotwice Git
- Repo: https://github.com/circus574-cpu/pixel-playground-launch
- Main baseline testów: `86a1e411339bc41fb218d4633ed2a7bd81e1f167`.
- PR #8 przekazanie, head: `779ad95d041093fb7b2fcb0409562cf0ab1d7cb7`; pliki `docs/HANDOFF.md`, `docs/GPU_PRODUCTION.md`, `docs/TECHNICAL_STATE.md`, `docs/handoff/FINAL_TESTS.md`. Odrębna, niescalona gałąź dokumentacyjna.
- PR #4 GPU: `7c50e8d5a93a3cf98c094f1ee341829fd6b0354c`, nie uznawać za main.
- CI HUD: https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39540694141, head `7a52aaeb0412b671e6d9e0bf0825980b7bc131e9`; API GitHub Actions zwróciło status completed, conclusion success. CI innego SHA nie wynika z tego przebiegu.

## Stan potwierdzony i ograniczenia dowodów
- Na bazowym main raportowana jest lokalna pętla PvE w czterech startowych regionach, wspólny ludzki sprite, sloty zapisów i HUD po scaleniu #5/#7. Nie ma wdrożonego backendu MMO ani gotowych grafik czterech ras.
- PR #8 zawiera artefakty testów kodu `86a1e411`: typecheck PASS, Vitest 97/97, assets PASS, lint 0 errors / 7 warnings, build PASS, Playwright 54/54. Testy wykonał Codex w Node 24/headless Chromium/Canvas na współdzielonych node_modules, **bez świeżego npm ci**. Raport nie zastępuje niezależnego powtórzenia testów ani fizycznego Androida/sprzętowego WebGL.
- GPU: historycznie RunPod RTX A6000, ComfyUI 0.3.76 / `30c259c`, Blender 4.5.3 bpy, torch 2.4.1+cu124; modele Animagine XL 3.1 i DreamShaper XL Turbo 2.1, MakeHuman/rig, CPU matting U²-Net. Aktualne wersje i istnienie modeli na wyłączonym woluminie nieodczytane. Zachować Qwen/Ollama i wszystkie pozostałe dane.
- Planetarni: jeden zaakceptowany *wzorzec wyglądu*, nie zaakceptowana kompletna animacja. `motion-v2` ma **179/416** klatek: idle 64, walk 64, attack 51, skill 0, hit 0, death 0, respawn 0; **237 brakuje**. Draft #4 raportuje `grounded`, render ortho 45°, 128² klient, origin .75, 512² masters. Kod main ma 96 jednostek, origin .95, kąt 60°. Import/opt-in nowego aktora nie jest scalony ani przetestowany w grze.
- Codex deklaruje świeży transfer i hashowanie **181 obiektów Git LFS, 31 918 089 B** (179 PNG, preview, BLEND), wraz z walidacją geometryczną alfa. Zachowane manifesty stanowią ślad do niezależnej kontroli; nie stanowią dowodu kompletności modeli, runtime, checkpointu i całego woluminu.
- Wcześniejsze prace nad miastami i 89 PNG obejmują odrzucone warianty oraz klatki efektów. Decyzja o kolejności jest nowsza: najpierw kompletny Planetarny, następnie NPC/przeciwnicy i otoczenie, później pozostałe rasy zgodnie z aprobatą właściciela.
- Produkcja: historyczny deployment HUD i 7/7 kontroli domenowych opisuje #8; nie przeprowadzono nowego audytu aktualnego deploy. Statyczny `ki-build=pre-gpu-engine-r1` nie identyfikuje pełnego SHA.

## Rejestr rozbieżności i otwartych ryzyk
| ID | Priorytet | Ustalenie | Działanie / kryterium zamknięcia |
| --- | --- | --- | --- |
| DOC-01 | ŚREDNI | PR #6 używał dwukrotnie D-015..D-019 | Rozdzielono na D-015..D-025, bez usuwania treści |
| DOC-02 | NISKI | Historyczny `8045a0b` opisany wcześniej niejednoznacznie jako tree/commit | Traktować jako historyczny commit, nie aktualne main; nie usuwać starego wpisu bez oznaczenia chronologii |
| ART-01 | WYSOKI | Różny kontrakt grafiki main vs #4 | Uzgodnić schema/packer/importer, rozmiar, origin, kamerę; test w rzeczywistym Phaserze przed scaleniem |
| ART-02 | WYSOKI | Planetarni 179/416 | Ukończyć 237 ramek, wszystkie animacje/kierunki, kontrola wizualna i akceptacja właściciela |
| GPU-01 | WYSOKI | Niepotwierdzona bieżąca zawartość storage/modeli i cold restore | Wyłącznie po zgodzie sprawdzić wolumin, SHA, kopie poza woluminem oraz zachowanie danych |
| QA-01 | ŚREDNI | Lokalny PASS Codexa ≠ niezależny retest; czyste npm ci nie wykonane | Niezależny clean install + testy na konkretnym SHA, porównać logi i testy negatywne |
| QA-02 | ŚREDNI | Brak fizycznego Androida, sprzętowego WebGL, długiej sesji i pomiarów wydajności | Test na urządzeniach, FPS/memory/termika/network; zapisać artefakty |
| PROD-01 | WYSOKI | Brak zweryfikowanego aktualnego commit SHA publikacji | Bez nowego deploy ustalić manifest wydania i sprawdzić publiczną grę względem commita |
| LIC-01 | ŚREDNI | Nieukończony przegląd komercyjnych licencji modeli i referencji | Potwierdzić licencje i ograniczenia przed użyciem komercyjnym |
| SCOPE-01 | PLAN | Multiplayer, konta, PvP, pełna fabuła i bonusy rasowe poza obecną bazą | Wymagają decyzji właściciela; nie deklarować implementacji |

## Macierz gotowości do niezależnego audytu
| Zakres | Status | Podstawa |
| --- | --- | --- |
| Odczyt dokumentów PR #8 | ZALICZONE | Bezpośrednio odczytane cztery pliki na przypiętej gałęzi |
| CI wcześniejszego HUD | ZALICZONE | Odpowiedź GitHub Actions dla run 39540694141 = success |
| Raporty lokalnych testów 86a1e411 | NIEZWERYFIKOWANE niezależnie | Raport, logi i artefakty Codexa; brak własnego wykonania |
| Przygotowanie dokumentów do audytu | ZALICZONE WARUNKOWO | Znane SHA, ścieżki i niepewności; potrzebna kontrola załączników i stanu ref przed odbiorem |
| Bohater GPU i wdrożenie jego grafiki | ODRZUCONE jako ukończona funkcja | 179/416 i brak instalacji/testu |
| Obecny runtime GPU, pełna kopia, cold restart | NIEZWERYFIKOWANE | Pod wyłączony, brak bezpośredniego odczytu |
| Produkcja na bieżącym SHA | NIEZWERYFIKOWANE | Historyczny test HUD, marker bez SHA |

## Zalecenia
1. Nie scalać #4, #6 ani #8, nie uruchamiać GPU ani nie publikować na podstawie przekazania.
2. Przed odbiorem technicznym niezależnie przejść przez logi `docs/handoff/qa/*`, `results.json` i manifesty LFS, porównać z testowanym SHA; wykonać clean CI na zatwierdzonej wersji.
3. Wykonać pełny audyt produkcyjnej gry oraz dostępności i jakości grafiki dopiero po spełnieniu wskazanych warunków.
4. Zachować starsze ustalenia i wersje historyczne, a korekty zapisywać jako nowe, datowane adnotacje.

Źródła: [PR #6](https://github.com/circus574-cpu/pixel-playground-launch/pull/6), [PR #8](https://github.com/circus574-cpu/pixel-playground-launch/pull/8), [FINAL_TESTS.md](https://github.com/circus574-cpu/pixel-playground-launch/blob/779ad95d041093fb7b2fcb0409562cf0ab1d7cb7/docs/handoff/FINAL_TESTS.md).
