# KI Legends — zweryfikowany status projektu

**Odczyt 2026-10-21.** Repozytorium `circus574-cpu/pixel-playground-launch`. `main`: `b3872c73c9df06e2a793190a6120f0948b021cb0`. PR #15: `b9f44577cb7bc1bab737c67000369b7a25919e26` odczytany przed ostatnią aktualizacją dokumentacji; sprawdzić HEAD przy następnym audycie.

## Main vs propozycje
- PR #9 (Planetarni, 416 klatek i tryb opt-in): scalony.
- PR #11 (Mędrcy): otwarty, historyczny i konfliktowy; nie scalać bezpośrednio.
- PR #12 (Mędrcy + Planetarni): Draft, nie scalony.
- PR #14 (powiązanie globusa z wyborem kontynentów): Draft, nie scalony.
- PR #15 (zbiorcza integracja, testy i poprawki): Draft, **nie scalony**, podstawowy kandydat do audytu.
- PR #13 (stan architektury/multiplayer): dokumentacyjny Draft, nie scalony.

## CI — dowody z GitHub Actions
- PR #15 `ae3f8b98`: Software WebGL SUCCESS, pełny Playwright **90/91**, jeden FAIL w `e2e/private-sketch.spec.ts:23` (`net::ERR_ABORTED` przy nawigacji). [Run WebGL](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39665659353); [run pełny](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39665659452).
- Przy sporządzaniu dokumentu HEAD PR #15 to `b9f44577cb7bc1bab737c67000369b7a25919e26`, jego workflow [39673680742](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39673680742) i [39673680679](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39673680679) były **IN PROGRESS**. Wyników nie wolno zgadywać; sprawdzić po zakończeniu.
- Odbiór fizycznego Androida, sprzętowego WebGL, licencji i jakości animacji: NIEZWERYFIKOWANE.

## Produkcja
`https://kilegends.pl/` i `/mapa` odpowiadały podczas kontroli odczytu. Strona `/mapa` opisywała się jako DEMO, niepołączone z grą; metadane głównej strony podawały `ki-build: pre-gpu-engine-r1`. Zgodność aktywnej produkcji z proponowanym HEAD **NIEZWERYFIKOWANA**.

## Decyzja publikacyjna
**BLOKADA** dla zmian PR #15 do pełnego zaliczenia wymaganych testów i odbiorów, zgodności produkcji z zatwierdzonym SHA oraz jednoznacznej zgody właściciela. Ten dokument nie jest pozwoleniem na merge/deploy.

Źródła szczegółowe: [TASKS.md](TASKS.md), [QA raport PR #15](https://github.com/circus574-cpu/pixel-playground-launch/blob/integration/ki-regressions-20261021/docs/QA-INTEGRATION-REGRESSIONS-2026-10-21.md).

## Archiwizacja projektu właściciela — aktualizacja 22.10.2026
Oryginalny 12-stronicowy PDF z ilustracjami został zapisany bezstratnie **na gałęzi dokumentacyjnego PR #16** w `docs/design/original-pdf-parts/` jako 12 części + `restore.py` (commit `fb8940cfe69f66d273fbfb7af2fdcf97c62b4eab`). GitHub potwierdza pliki, sumy git blob oraz rozmiar 5 343 097 B. Oczekiwany SHA-256 odtworzonego PDF: `be58d9df4fb49d19b11a66d47a1a3fc3fbbf5acc9c11ddc5cf76213f6be15734`. `main` nie otrzymał jeszcze tej zmiany.
