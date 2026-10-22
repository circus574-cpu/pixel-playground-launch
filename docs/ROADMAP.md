# KI Legends — roadmap i bramy jakości

Stan: **2026-10-22**, punkt odniesienia `main` `66a615dec1d4259e1bf668956ec1cb09e9aa177e`. Roadmapa wyraźnie rozróżnia zrealizowany kod, kontrolę i plan.

## Zrealizowana podstawa (kod, nie certyfikat produkcji)
- Lokalna pętla PvE, wybór czterech pochodzeń, regiony, zapis, zadania, walka, HUD.
- Dwie paczki bohaterów po 416 klatek: Planetarni ([PR #9 MERGED](https://github.com/circus574-cpu/pixel-playground-launch/pull/9)) i Mędrcy (integracja [PR #15 MERGED](https://github.com/circus574-cpu/pixel-playground-launch/pull/15)).
- Globus 3D i atlas 2D są połączone w kodzie gry/strony `/mapa` na `main`. Nadal wymaga to porównania z wersją publiczną.
- Paczki otoczenia Aetheria/Verdantia/Nexus-9/Pyra zostały udostępnione domyślnie; nie traktować ich automatycznie jako wizualnie zaakceptowanych.

## P0 — bieżące bramki wydania
1. [PR #21](https://github.com/circus574-cpu/pixel-playground-launch/pull/21): aktywować `hero-planetary` bez flagi URL; zachować oba riggi, izolację ras i zapisy. Obecnie gałąź **OPEN**, `main` nadal używa fallbacku `human-v2` dla Planetarnych.
2. Usunąć 6 niepowodzeń [pełnego QA #39776233057](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39776233057) bez osłabiania wymagań; wynik 89 PASS/6 FAIL. Zachować [zielony Software WebGL #39776233522](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39776233522).
3. Uzyskać **FULL CI PASS** i **Software WebGL PASS** na tym samym finalnym SHA; zabezpieczyć artefakty, screenshoty i ślady. Sprawdzić rzeczywisty Android, dotyk, FPS i wizualne animacje.
4. Zbadać prawa do referencyjnych ilustracji i pochodnych, nierozwiązane zapisy rejestru licencji oraz zgodność publicznej wersji z zatwierdzonym SHA.
5. Respektować udokumentowaną [zgodę właściciela](qa/PUBLISH-AUTHORIZATION-2026-10-22.md), ale traktować ją jako **warunek konieczny, niewystarczający**, dla technicznego wydania. Bez niezależnej kontroli nie publikować.

## P1 — kanon i produkcja grafik
- [PR #20](https://github.com/circus574-cpu/pixel-playground-launch/pull/20): ocenić załączniki właściciela, drzewka czterech ras i bestiariusz; **OPEN, nie jest zatwierdzonym stanem main**.
- Kontynuować docelowe postaci Androidów, Legend i cztery miasta według [kolejki GPU](GPU-PRODUCTION-SEQUENCE.md). Jedna dostawa, test i akceptacja wizualna na etap. Nie nadpisywać istniejących danych ani zasobów.
- Zamknąć lub udokumentować przestarzałe/nakładające się PR #11–#14, #18–#19 po porównaniu, nie scalać w ciemno.

## P2 — multiplayer
Dopiero po P0 i decyzji architektonicznej: backend autorytatywny, konta, serwerowy zapis/synchronizacja, odporność na oszustwa, testy obciążenia. Obecnego PvE nie opisywać jako gotowego MMORPG.

Aktualne ustalenia techniczne i nierozwiązane usterki: [STATUS](STATUS.md) i [TASKS](TASKS.md).
