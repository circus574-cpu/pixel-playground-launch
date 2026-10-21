# KI Legends — integracja Mędrców i Planetarnych

**Data:** 2026-10-21. **Gałąź:** `integration/sage-plus-planetary-20261021`, oparta na `main` (`b3872c73c9df06e2a793190a6120f0948b021cb0`). Nie jest to zgoda na scalenie lub publikację.

## Zmiany

- Zachowano całą dotychczasową zawartość `main`, w tym komplet Planetarnych z PR #9 i zmiany globusa bez ich audytowania.
- Z PR #11 dołączono **416/416 klatek** animacji Mędrców: 7 stanów, 8 kierunków, 56 klipów, dwa atlasy WebP oraz metadane paczki runtime.
- `src/game/assets/imported.json` przechowuje teraz `technical-rig`, `hero-planetary` i `hero-sage` równocześnie, bez kolizji identyfikatorów zasobów.
- Domyślny bohater Aetherii to `hero-sage`. Planetarni zachowują istniejący przełącznik `?ki-hero-art=1`; pozostałe regiony mają nadal `human-v2`.
- Poprawiono testy `e2e/pre-gpu.spec.ts` i `e2e/planetary-preview.spec.ts` w miejscach zakładających standardowego bohatera Aetherii. Dodano pełny scenariusz `e2e/sage-preview.spec.ts`, trzy testy integracyjne i workflow WebGL.

## Dowody i CI

- Pełne źródła surowych 416 klatek PNG i sceny robocze pozostały nienaruszone na gałęzi `sage/aetheria-20261021` w [PR #11](https://github.com/circus574-cpu/pixel-playground-launch/pull/11). PR integracyjny zawiera tylko niezbędne pliki produkcyjne, a nie kopię archiwum produkcji GPU.
- Lokalny raport `docs/qa/sage-delivery-review7/validation.json` potwierdza 416 klatek i brak zgubionych referencji. Wcześniejsze 12/12 testów pipeline, 5/5 Playwright i 1/1 SwiftShader **nie są** wynikami końcowej integracji.
- Na gałęzi GPU run [39643608761](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39643608761) potwierdził TypeScript PASS, zasoby PASS i Vitest PASS, ale LINT FAIL (4 błędy formatowania w `src/test/gpu-pipeline.test.ts`). Poprawkę zapisano w commicie `12c2e499`.
- **Wymóg przed scaleniem:** pełny `Ki Legends Playwright QA` i osobny `Sage and Planetary WebGL regressions`, obydwa zakończone sukcesem na aktualnym SHA integracji. Wszelkie nowe błędy wymagają naprawy i ponownego testu.
- Dodatkowe niezależne dowody: zrzuty ekranu Mędrców i Planetarnych, spójność zapisów, wszystkie cztery regiony, PvE, `/test`, błędny atlas + retry. Testy SwiftShader nie zastępują fizycznego Androida.

## Prawa autorskie i finalna akceptacja

Provenance: `art/production/heroes/sage/v3/sources/painted-design-provenance.json` (oryginał z PR #11; plik dołączono do tej gałęzi). Wykorzystano ilustracje referencyjne dostarczone przez właściciela; prawa do oryginalnych ilustracji **nie są niezależnie potwierdzone**. Nowe grafiki pochodne nie usuwają konieczności potwierdzenia tych praw. CC0 MakeHuman dotyczy tylko odrzuconego pilota, nie stanowi licencji na ilustracje bazowe.

Przed publikacją właściciel powinien pisemnie potwierdzić prawa/zgody na komercyjne wykorzystanie pierwowzorów i ostatecznie zaakceptować wygląd oraz animacje Mędrców i Planetarnych. Bez tego licencje i odbiór pozostają **NIEZWERYFIKOWANE**.

## Decyzja wydaniowa

**NO-GO** do momentu zielonego CI na końcowym SHA, weryfikacji poprawnego załadowania atlasów, wyjaśnienia praw i odbioru wizualnego oraz osobnej zgody właściciela na merge i wdrożenie. Kontrola globusa 3D jest poza zakresem zgodnie z poleceniem właściciela.
