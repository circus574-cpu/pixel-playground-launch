# KI Legends — aktualny stan potwierdzony w GitHub

**Odczyt: 2026-10-22.** Repo: `circus574-cpu/pixel-playground-launch`. Gałąź bazowa `main`: **`66a615dec1d4259e1bf668956ec1cb09e9aa177e`**. Wszystkie poniższe informacje opisują ten odczyt; przed następną decyzją sprawdzić nowy HEAD.

## Historia zmian zweryfikowana w GitHub
| PR | Stan na 22.10.2026 | Znaczenie |
| --- | --- | --- |
| [#9](https://github.com/circus574-cpu/pixel-playground-launch/pull/9) | MERGED | Atlas Planetarnych 416 klatek; początkowo tylko podgląd |
| [#15](https://github.com/circus574-cpu/pixel-playground-launch/pull/15) | MERGED 22.10 | Integracja Mędrców, regresje, powiązanie map i czterech regionów |
| [#16](https://github.com/circus574-cpu/pixel-playground-launch/pull/16) | MERGED 22.10 | Dokumenty audytowe i binarne archiwum oryginalnego 12-stronicowego PDF w 12 częściach |
| [#17](https://github.com/circus574-cpu/pixel-playground-launch/pull/17) | MERGED 22.10 | Rejestry licencji; **nie** oznacza to potwierdzenia praw do wszystkich assetów |
| #11, #12, #13, #14 | OPEN / DRAFT | Gałęzie historyczne/propozycje; nie wnioskować, że ich stan jest bazą wdrożenia |
| #18, #19 | OPEN | Nakładające się propozycje globusa w grze i grafiki Planetarnych; aktualny main ma już własną integrację globusa |
| [#20](https://github.com/circus574-cpu/pixel-playground-launch/pull/20) | OPEN | Nowe aneksy właściciela (drzewka ras, bestiariusz) — **nie są jeszcze w main** |
| [#21](https://github.com/circus574-cpu/pixel-playground-launch/pull/21) | OPEN, head `97af25798c797b2f98da5417e96a064bdcfec981` | Domyślna aktywacja `hero-planetary`; **jeszcze nie w main** |

## Kod i rozgrywka — granica dowodów
- Na `main` działają implementacje lokalnego PvE, czterech pochodzeń i regionów. **Nie ma potwierdzonego autorytatywnego multiplayera**.
- `src/game/assets/imported.json` obejmuje paczki 416-klatkowych bohaterów Planetarnych i Mędrców; `src/game/assets/catalog.ts` na `main` włącza automatycznie `hero-sage`, a `hero-planetary` nadal wyłącznie poprzez `?ki-hero-art=1`. Bez flagi Planetarni używają fallbacku `human-v2`. Poprawkę proponuje PR #21.
- Pozostałe dwa pochodzenia (Androidy/Legendy) używają dotychczasowego wyglądu `human-v2` do czasu produkcji właściwych rigów.
- Na `main` kod `GameHud.tsx` i mapa planety łączą mapę 2D/3D z interfejsem gry. **Samo istnienie implementacji nie potwierdza publikacji na kilegends.pl**.
- Grafika terenów Aetherii i paczki startowe regionów zostały w międzyczasie włączone domyślnie (`previewOnly: false`); starsze opisy jako wyłącznie podgląd są historyczne.

## Wyniki CI, dokładne SHA
- PR #15 @ `d9599277924e6c3f1ce99b43e2a1b20654b42c22`: [pełny QA #39675441735](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39675441735) **SUCCESS**, [Software WebGL #39675441724](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39675441724) **SUCCESS**; sprawdzone w GitHub Actions.
- PR #21 @ `97af25798c797b2f98da5417e96a064bdcfec981`: [Software WebGL #39776233522](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39776233522) **SUCCESS**; [pełny Browser QA #39776233057](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39776233057) **FAILURE: 89/95 PASS, 6 FAIL**. Krok TypeScript/Vitest/assets/lint/build: SUCCESS, ale całość CI NIEZALICZONA.
- Sześć FAIL w PR #21: `aether-art-preview.spec.ts` (nieaktualne oczekiwanie preview); `planetary-preview.spec.ts` (ruch joystickiem 10,25 przy wymaganiu >12); trzy warianty `region-start-art.spec.ts` (`ERR_HTTP_RESPONSE_CODE_FAILURE` dla `/` na porcie playtest); `stage3.spec.ts` (oczekiwane 2400 px minimapy Aetherii, rzeczywiste 1200 px). Nie traktować każdego FAIL jako potwierdzonej usterki mechaniki; wymagają indywidualnego rozpoznania.

## Produkcja i ryzyka
- Zgodność publicznego `https://kilegends.pl/` z HEAD `main`: **NIEZWERYFIKOWANA** podczas niniejszej kontroli; strona nie była dostępna dla użytego narzędzia zewnętrznego. Nie stwierdzać na tej podstawie awarii produkcji.
- Fizyczny Android, sprzętowy WebGL, wizualna akceptacja wszystkich animacji: **NIEZWERYFIKOWANE**.
- [Rejestr licencji](ASSET-LICENSE-REGISTER.md) nie potwierdza praw do pierwotnych ilustracji i wszystkich pochodnych.
- [Zgoda właściciela z 22.10](qa/PUBLISH-AUTHORIZATION-2026-10-22.md) została zapisana w repo, ale nie zastępuje zaliczonych testów ani weryfikacji konkretnego wydania.

**Werdykt dla PR #21: BLOKADA PUBLIKACJI** do pełnego CI PASS na finalnym SHA, kontroli regresji i wymaganych odbiorów. Nie scalać/publikować automatycznie. Ocenę stanu aktualnego `main` i jego wdrożenia prowadzić osobno.
