# Przekazanie sesji — 22.10.2026 (wieczór) → kontynuacja rano

> **Stan na 23.10 rano (koniec pracy tej sesji):** HEAD gałęzi `ccr-b12863e6-qt65bs` = `cf13f9c` (naprawa sekcji 4a/4b wypchnięta). CI PR #24 na tym SHA było w toku (`webgl` od 05:06 UTC, Browser QA jeszcze nie widoczny). **Następny krok dla kolejnego agenta:** sprawdzić oba checki; po zielonych scalić PR #24 (zgoda właściciela w `docs/qa/PUBLISH-AUTHORIZATION-2026-10-22.md`), publikacji przez Lovable nie uruchamiać bez polecenia (kredyty). Potem punkty z sekcji 4.

Stan na koniec sesji. Gałąź robocza: `ccr-b12863e6-qt65bs` (PR #24 do `main`), HEAD `7e30566`, katalog roboczy czysty. **Nic nie jest scalone do `main` ani opublikowane.** Zgodę właściciela na scalenie i publikację zapisano w `docs/qa/PUBLISH-AUTHORIZATION-2026-10-22.md`; publikacja przez Lovable zużywa kredyty (zakaz bez polecenia, AGENTS.md w PR #22).

## 1. Co jest w PR #24 (commity w kolejności)

1. **Cztery malowane rasy** (z PR #23): `hero-planetary-painted`, `hero-sage-painted`, `hero-android`, `hero-legend`, po 416 klatek, aktywne domyślnie, prezentacja 160×160. Właściciel zaakceptował wszystkie rasy (22.10).
2. **Tekstury i przyroda** (`988233e`): `aether/nexus/pyra-terrain-v2`, `nature-textures-v1`, `nature-objects-v1` zainstalowane importerem jako publiczne (obiekty przyrody zmniejszone do 512 px dla budżetu pamięci). Teksturowane blokady wewnętrzne (lawa/energia/woda), niekolizyjne dekory. Opis: `NATURE-TERRAIN-DEPLOYMENT-2026-10-22.md`.
3. **Poprawki nieaktualnych testów e2e** (`c8efcd0`, `38ae3c3`): sztuka startowa jest domyślna; podgląd w menu ma 960 px.
4. **Otwarte światy** (`ec190c3`): Aetheria 6000×4360, Nexus-9 i Pyra 4800×3592 (+1200 j. na wschód/zachód, +900 j. na północ/południe). Cztery strefy N/S/E/W z podłogą, drogami, wrogami (5 na strefę), przyrodą i landmarkami; migracja zapisów (`layout: 2`, `legacyShift`); ground i drogi strumieniowane w kawałkach (pamięć); minimapa z atlasu; znaczniki i lista stref na `/mapa` i globusie. Generator: `scripts/expand_worlds.py`.
5. **Przycisk „Usuń” w wyborze postaci** (`97df05a`): dwustopniowe potwierdzenie, usuwa tylko poprawny slot, uszkodzone/nowsze zapisy chronione, oryginał zapisu etapu 2 nietknięty (znacznik `:legacy-removed`).
6. **Podgląd kontynentu w menu** (`38ae3c3`): wycinek atlasu planety (`<świat>-atlas.webp`).
7. **Geometria planety** (`7e30566`): `PLANET-GEOMETRY-2026-10-22.md`.

## 2. Decyzje właściciela z tej sesji

- Wdrożyć publicznie wszystko z GPU zaczęte przez Codexa: rasy, tekstury, przyroda.
- Mapy: jedna wielka mapa na kontynent; opuszczanie planety kiedyś osobno. Minimapa ma odpowiadać mapie 2D/globusowi.
- Docelowo **4 miasta na kontynent**, miasta większe przy starcie publicznym.
- Główne miasta ras: **80 000 j. od siebie**, wyspy specjalne i woda na planecie. Wybrano układ czworościanu na kuli; „kiedyś najwyżej będziemy kombinować”.
- Menu główne z obrazem bohaterów (bez napisu „JUŻ WKRÓTCE”): **odłożone**, brak pliku obrazu w repo.

## 3. Geometria planety (skrót)

R = 41 870,9 j., obwód 263 083 j.; 1 j. atlasu = 131,54 j. Miasta: Aetheria 61°E/35,26°N, Verdantia 119°W/35,26°N, Pyra 29°W/35,26°S, Nexus-9 145°E/35,26°S (obrót 16°). Wyspy I/VI na biegunach, II–V na równiku. Kontynenty i wyspy w skali 0,5, wycięte z oryginalnego atlasu (`art/production/planet/`) i rzutowane azymutalnie. Regeneracja: `python3 scripts/relayout_planet.py && python3 scripts/build_globe_textures.py` (numpy, Pillow, opencv-python-headless, scipy). Minimapy w grze i podglądy w menu: `scripts/build_atlas_minimaps.py` (z oryginalnego atlasu).

## 4. Do zrobienia rano (kolejność)

1. **CI PR #24**: sprawdzić wynik na `7e30566` (Browser QA + webgl). Poprzedni `webgl` padł na `38ae3c3` (przyczyny nie zbadano). Browser QA padał wcześniej na nieaktualnym teście `stage3.spec.ts` (naprawiony). Po zielonym CI scalić PR #24 (zgoda jest) i poprosić o decyzję o publikacji w Lovable.
2. **Mniej wody**: powiększyć kontynenty. Wstępnie: przy skali 0,5 odstęp ~12 000 j., przy 0,7 ~3 000–4 000 j. (ogranicza Verdantia i wyspy, nie ma przeciętego szwu); wyspy zmniejszyć niezależnie (np. 0,35). Wykonać wyszukiwanie największej skali z odstępem ≥ 3 000 j. i bez przecięcia szwu (skrypt wzorowany na `relayout_planet.py`, parametry `SCALE`, `YAW`), potem przebudować atlas/globus i zaktualizować testy (`planet.test.ts` używa `PLANET.scale`).
3. **Verdantia**: jeszcze nie rozszerzona (3072×2048). Plan: przesunięcie zaakceptowanego lasu o (1200, 900) w renderze (`renderForest`, `cacheForestTerrain`), `worlds.ts`, `tutorial.ts`; strefy z `expand_worlds.py` (motywy Verdantii dodane do `THEMES`; funkcja `expand` wydzielona); migracja zapisów jak dla pozostałych; aktualizacja testów (`forest.test`, `stage21`, `session.test`, `verdant-art`).
4. **Cztery miasta na kontynent** i większe miasta; na dziś jest jedno miasto + 4 strefy. Mapy kolejnych miast generować jak strefy; pozycje miast liczyć w obrysie kontynentu na nowym atlasie (odstęp ≥ 12–14 tys. j.).
5. Obraz menu/loading po dostarczeniu pliku bez napisu.

## 4a. Usterka CI webgl — NAPRAWIONA 23.10 (zwalnianie kawałków poza widokiem + 640 j.)

`webgl` (Software WebGL) w PR #24 na `7e30566` — **1 z 14 testów pada**: `e2e/world-rendering.spec.ts:7` „nexus mobile detail rendering stays within budget and releases each scene”: `samples[1].textures` (60) ≠ `samples[0].textures` (66). Przyczyna to moja zmiana: drogi i podłogi stref są pieczone leniwie (`renderRoads.ts`), a podłoże strumieniowane (`renderWorld.ts`); liczba tekstur zależy od historii kamery (kawałki wypiekane przy kamerze startowej zostają, bo zwalniane są dopiero po przekroczeniu limitu 16). Poprawka (nie wykonana): zwalniać kawałki dróg/podłoża, gdy wyjdą poza widok powiększony o ~640 j. (histereza), zamiast limitu LRU; wtedy liczba tekstur i obiektów zależy tylko od bieżącej pozycji kamery. Przy okazji sprawdzić `Browser QA (full)` na tym samym SHA (wynik nieznany w chwili zapisu).

## 4b. Pełna lista czerwonych testów CI na `cba7cde` (odczyt 23.10 rano)

Wszystkie wynikają z poszerzonych map; poprawki nie są jeszcze wykonane.

1. `webgl` — `world-rendering.spec.ts:7`: Aetheria 76 vs 70 tekstur, Nexus-9 66 vs 60 (leniwe kawałki; poprawka w 4a).
2. `Browser QA (full)` — `pre-gpu.spec.ts:298` „real pursuit, return, enemy collision and world boundary” dla sage, android i legend: asercje o granicy świata/pościgu liczone ze starych wymiarów (np. oczekiwane > 5820, > 4620, a jest 4243, 1800, 4550). Test trzeba przeliczyć z `WORLDS[...].width/height`/`legacyShift` zamiast stałych.
3. `Browser QA (full)` — `stage3.spec.ts:80` (A/B/C): oczekuje stałej pozycji startowej (x 1150), a spawn jest przesunięty o `legacyShift` (x 2350). Użyć `WORLDS[...].spawn`.
   Poza tym 190 testów w tym przebiegu przechodzi (28 + 190 + 99 w trzech projektach).

## 5. Weryfikacja i znane problemy

- Lokalnie na HEAD: typecheck, Vitest 190/190, lint 0 błędów, `assets:check`, build. E2E lokalnie: `world-rendering` 2/2, poprawione `region-start-art`/`aether-art-preview` 4/4. Pełny lokalny Playwright nie został ukończony; testy dotyku Androida (`pre-gpu`) padają lokalnie na `data-focused` (ostrość okna w piaskownicy, w CI przechodziły).
- Uruchamianie e2e w tym środowisku: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; projekt WebGL wymaga dowiązania `chrome-headless-shell` (opisane w historii sesji).
- Prawa do checkpointów, ilustracji referencyjnych i obrazów pochodnych: NIEROZSTRZYGNIĘTE. FPS/pamięć na fizycznym Androidzie: NIEZWERYFIKOWANE.
- Plamy w oceanie po wycięciach na atlasie; wyspy polarne to pasy na płaskim atlasie.
- Nie ruszano instancji GPU. Nie publikowano gry.
