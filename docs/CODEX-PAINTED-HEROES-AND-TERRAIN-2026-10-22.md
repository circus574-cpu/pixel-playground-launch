# Instrukcja dla Codexa — cztery rasy i tekstury kontynentów (2026-10-22)

**Stan:** wszystko poniżej jest **gotowym materiałem w repozytorium, jeszcze NIE zainstalowanym w grze**. Nie scalaj PR, nie publikuj, nie zmieniaj produkcji bez odrębnej zgody właściciela (AGENTS.md). **Nie wolno** Start/Stop/Restart/Terminate poda GPU. Nie przepisuj opublikowanej historii gita (projekt jest połączony z Lovable).

Źródło tej dostawy: gałąź `ccr-b63f9ce9-bu75ez`. Metoda i wady: [PAINTED-MESH-PIPELINE.md](PAINTED-MESH-PIPELINE.md). Decyzje właściciela: [DECISIONS.md](DECISIONS.md). Zadania dla Ciebie są w sekcjach 2–5.

## 1. Co leży w repo

**Bohaterowie** — `deliveries/<id>-1.0.0/` (manifest + 2 atlasy WebP 2048² + JSON; **416 klatek = 8 kierunków × 52**, klient 128 px, kotwica stóp `(0.5, 0.95)`, rozmiar 96×96, profil `hero`, prezentacja `legacy`). Źródła: `art/production/heroes/<rasa>/painted-v1/` (mastery 512×512 RGBA, 8 malowanych widoków w lossless WebP, `provenance.json` z sumami SHA-256, `preview.gif`). Zwalidowane `npm run assets:import -- <manifest>` **bez** `--install`.

| Rasa | Pakiet | Świat | `actorBindings` | SHA-256 manifestu | Status u właściciela | Sposób wdrożenia |
|---|---|---|---|---|---|---|
| Android | `hero-android` | nexus | `nexus.hero: hero-android` | `e729ce083a3afc67…` | identity zaakceptowany; przegląd ruchu zaakceptowany; wynik końcowy NIE oceniony | previewOnly + przełącznik `ki-hero-android` |
| Planetarni | `hero-planetary-painted` | verdant | `verdant.hero: hero-planetary-painted` | `ae59e5153b5a90c3…` | ZAAKCEPTOWANI przez właściciela (22.10.2026) | zastępuje `hero-planetary` (przełącznik `ki-hero-art`) |
| Legendy | `hero-legend` | pyra | `pyra.hero: hero-legend` | `844973d5d4a7b59c…` | identity zaakceptowany; animacja NIE oceniona | previewOnly + przełącznik `ki-hero-legend` |
| Mędrcy (męska wersja) | `hero-sage-painted` | aether | `aether.hero: hero-sage-painted` | `1aed6563555daaec…` | ZAAKCEPTOWANI przez właściciela (22.10.2026) | zastępuje `hero-sage` (domyślny w Aetherii) |

**Tekstury kontynentów** — `deliveries/<świat>-terrain-v2-1.0.0/` (manifest z `previewOnly: true`, cztery obrazy 512² WebP: podłoże, ścieżka, plac, mur). Źródła 1024² (lossless), arkusze i `provenance.json`: `art/production/terrain/v2/`. Format jak zainstalowane `*-start`: `kind: image`, `fit: stretch`, `tileSize` 320/208/288/256 jednostek. **Verdantia nie ma nowych tekstur** — zaakceptowany atlas lasu (`terrain.verdant`) zostaje bez zmian.

| Pakiet | Klucze `renderBindings` | SHA-256 manifestu |
|---|---|---|
| `aether-terrain-v2` | `terrain.aether-ground`, `terrain.aether-path`, `terrain.aether-plaza`, `terrain.aether-wall` | `39d85932dd2ca4da…` |
| `nexus-terrain-v2` | `terrain.nexus-ground`, `terrain.nexus-path`, `terrain.nexus-plaza`, `terrain.nexus-wall` | `11b856b964fd3901…` |
| `pyra-terrain-v2` | `terrain.pyra-ground`, `terrain.pyra-path`, `terrain.pyra-plaza`, `terrain.pyra-wall` | `c8199743a89cdfe5…` |

Tekstury **nie były oglądane przez właściciela** (status: NIEOCENIONE); generator: `scripts/gpu/gen_terrain_textures.py`, kołowe dopełnienie (bezszwowe), wybór ziaren w `art/production/terrain/v2/selection.json`.

## 2. Bohaterowie — kroki

1. `git fetch origin main && git checkout -b feature/painted-heroes origin/main`
2. Przenieś tylko dostawę: `git checkout origin/ccr-b63f9ce9-bu75ez -- deliveries art/production/heroes art/production/terrain docs/PAINTED-MESH-PIPELINE.md docs/design/identity docs/CODEX-PAINTED-HEROES-AND-TERRAIN-2026-10-22.md` oraz skrypty `scripts/gpu/*` (jeśli potrzebne do regeneracji).
3. `npm ci`, potem dla każdego pakietu: `npm run assets:import -- deliveries/<id>-1.0.0/manifest.json` (walidacja i plan), a po sprawdzeniu `... --install`. Wersjonowane pliki trafiają do `public/game/assets/gpu/<id>/<wersja>-<sha>/`; **starych nie kasuj**.
4. **Kolizje wiązań.** `makeCatalog` w `src/game/assets/catalog.ts` robi `Object.assign` kolejno po pakietach z `imported.json`: **późniejszy pakiet wygrywa**. `hero-planetary-painted` (`verdant.hero`) i `hero-sage-painted` (`aether.hero`) kolidują ze starymi `hero-planetary` i `hero-sage`. Umieść nowe wpisy **za** starymi albo usuń stare wiązania w nowych wpisach; nie usuwaj starych plików ani starych wpisów bez decyzji właściciela (rollback = poprzedni commit `imported.json`).
5. **Przełączniki** (`PREVIEW_SWITCHES`, `previewPacks` w `catalog.ts`): Mędrcy są domyślni w Aetherii przez stałe `"hero-sage"` → zamień na `"hero-sage-painted"` (właściciel zaakceptował). Planetarni: `"ki-hero-art": ["hero-planetary"]` → `["hero-planetary-painted"]`; domyślność w Verdantii pozostaje opt-in, dopóki właściciel nie zdecyduje inaczej. Android i Legendy **nie są zaakceptowane**: ustaw `previewOnly: true` we wpisie `imported.json` i dodaj `"ki-hero-android": ["hero-android"]`, `"ki-hero-legend": ["hero-legend"]`.
6. Nie zmieniaj `GameSession`, kolizji, zapisów, walki, kamery ani domyślnej skali (96×96). Postacie są w kadrze zmniejszone (Android ≈86%, Planetarni ≈93%, Legendy ≈80%, Mędrcy ≈71%), żeby upadek mieścił się w marginesie; jeśli właściciel uzna je za zbyt małe, regeneracja jest opisana w sekcji 5.

## 3. Tekstury kontynentów — kroki

1. Zainstaluj trzy pakiety (`assets:import ... --install`); manifest ma `previewOnly: true`.
2. Dodaj przełączniki, np. `"ki-aether-terrain": ["aether-terrain-v2"]`, `"ki-nexus-terrain": ["nexus-terrain-v2"]`, `"ki-pyra-terrain": ["pyra-terrain-v2"]`. Pakiety nadpisują `terrain.<świat>-ground|path|plaza|wall` z `aether-sanctuary` / `nexus-start` / `pyra-start` tylko po włączeniu i tylko jeśli stoją **później** w `imported.json`.
3. Sprawdź budżet tekstur (`assets:import` wypisuje bajty per świat; limit świata 128 MiB) i że ścieżki/place (`renderRoads.ts`) nadal wypalają się do chunków bez zmiany kolizji. Zrób zrzuty ekranu na viewport 360×800 i desktop, każdy świat z włączonym przełącznikiem.

## 4. Testy i dowody (wymagane przed PR)

`npm run assets:check`, pełny TypeScript (`npm run typecheck`, cała konfiguracja repozytorium), `npm run test`, `npm run lint`, `npm run build`, `npm run build:playtest`, `npm run test:e2e`; dodaj scenariusze Playwright: Mędrcy domyślnie w Aetherii (8 kierunków i 7 stanów), `?ki-hero-art=1` (Planetarni), przełączniki Androida/Legend/tekstur, błędny atlas + ponowienie, powrót do poprzednich zasobów. Wyniki z SHA commita w PR. **FPS i pamięć na fizycznym urządzeniu: NIEZWERYFIKOWANE** (headless Chromium nie jest dowodem). PR otwieraj dopiero na wyraźne polecenie właściciela; scalenie i publikacja wymagają jego odrębnej zgody.

## 5. Znane wady i regeneracja

- Widoki jednej rasy nie są w pełni spójne; deformacja rwie teksturę na styku nóg i płaszcza oraz w tunice Planetarnych (atak z przodu); chód z przodu ma mały ruch; kostur Mędrców nie jest narysowany; Legendy mają resztki czerwonych smug.
- **Prawa:** do ilustracji referencyjnych, checkpointów (Animagine XL 3.1, DreamShaper XL Turbo) i obrazów pochodnych są **NIEROZSTRZYGNIĘTE** (`ASSET-LICENSE-REGISTER.md`). Nie publikować.
- **Regeneracja** (wymaga działającego poda; dostęp do Jupytera i jego hasło ma wyłącznie właściciel, nie ma ich w repo): `painted_views.py` → `matte_masters.py` → `animate_painted.py` (renderuj na dysk lokalny: `KI_OUT_ROOT=/opt/renders KI_SAFE=22`) → `assets:pack` (układ `stan/kierunek/NN.png`) → `assets:import`. Surowe klatki 512² (416 na rasę) są na volume: `ki-legends-gpu/deliveries-src/layout-<rasa>-v6.tar`. Pod kosztuje 0,59 USD/h; jego cyklem życia steruje tylko właściciel.
- Volume: usunięto 30 GB (Flux, koder umt5, archiwum Flux). Pozostałe kandydaci do usunięcia czekają na decyzję właściciela (patrz lista w rozmowie: ollama 20,7 GB, CADPRO 2,4 GB, codex-runpod-setup 3,3 GB, DreamShaperXL 6,9 GB — używany do tekstur, więc nie usuwać, dopóki tekstury nie są zaakceptowane).

## 6. Zestaw przyrody (woda, oceany, lodowce, wulkany, lawa, ukształtowanie terenu) — dodane 22.10.2026

Dwie paczki w `deliveries/`, obie `previewOnly: true`, zwalidowane `assets:import` bez instalacji, **nieoglądane przez właściciela (NIEOCENIONE)**. Źródła i arkusze podglądu: `art/production/nature/v1/` (tekstury 1024² i obiekty w lossless WebP, `provenance.json`, `selection.json`); surowe obrazy 1024² są też na volume w `ki-legends-gpu/renders/nature-v1/`.

| Pakiet | Zawartość | SHA-256 manifestu |
|---|---|---|
| `nature-textures-v1` | 16 bezszwowych tekstur 512² → klucze `terrain.nature-<nazwa>`, `tileSize` 256 | `70c53c17d7c71c3f…` |
| `nature-objects-v1` | 19 obiektów → klucze `object.nature.<nazwa>` (wycinki, `origin` `[0.5,0.92]`) lub `object.nature.patch-<nazwa>` (łaty) | `79f46f85dc60d87d…` |

- **Tekstury:** `water-ocean-deep`, `water-ocean-shallow`, `water-river`, `water-lake-calm`, `water-crystal`, `energy-liquid`, `ice-glacier`, `snow`, `sand-beach`, `meadow-grass`, `forest-floor`, `cliff-rock`, `lava-flow`, `lava-crust`, `ash-ground`, `basalt-columns`.
- **Wycinki (8):** `iceberg`, `mountain-peak`, `grassy-hill`, `pine-tree`, `broadleaf-tree`, `crystal-tree`, `flower-bush`, `reed-clump`.
- **Łaty (11):** `volcano-active`, `volcano-dormant`, `glacier-block`, `ice-spires`, `sea-stacks`, `waterfall`, `lava-rocks`, `basalt-columns`, `cliff-outcrop`, `boulder-group`, `small-island` — nieprzezroczyste kadry z góry zamienione na „nalepki” z miękkim eliptycznym brzegiem (importer wymaga przezroczystości dla `object.*`); używać jako duże dekory terenu, nie jako obiekty stojące.

**To są nowe klucze — żadna mapa ich jeszcze nie używa.** Wpięcie wymaga Twojej pracy w danych regionów (`terrain.*` w JSON regionu, obiekty w `scenery`) bez zmiany współrzędnych kluczowych punktów, kolizji i zapisów; footprinty zostają w JSON regionu. Propozycja doboru (do akceptacji właściciela):

| Obszar | Tekstury | Obiekty / łaty |
|---|---|---|
| Verdantia (tylko nowe, opcjonalne dodatki; zaakceptowany atlas lasu zostaje) | `meadow-grass`, `forest-floor`, `water-river`, `water-lake-calm`, `sand-beach` | `pine-tree`, `broadleaf-tree`, `flower-bush`, `reed-clump`, `grassy-hill`, `boulder-group`, `waterfall` |
| Aetheria | `water-crystal`, `cliff-rock`, `snow` | `crystal-tree`, `mountain-peak`, `waterfall`, `cliff-outcrop` |
| Nexus-9 | `energy-liquid`, `basalt-columns`, `ice-glacier` | `ice-spires`, `basalt-columns` |
| Pyra | `lava-flow`, `lava-crust`, `ash-ground`, `basalt-columns`, `cliff-rock` | `volcano-active`, `volcano-dormant`, `lava-rocks`, `cliff-outcrop` |
| Brzegi mapy / globus `/mapa` (oceany, bieguny) | `water-ocean-deep`, `water-ocean-shallow`, `ice-glacier`, `snow` | `glacier-block`, `iceberg`, `ice-spires`, `sea-stacks`, `small-island` |

**Wady (nie ukrywać):** `water-ocean-deep` wygląda jak stylizowana mapa raf, a `water-lake-calm` jak lilie wodne, nie jak spokojna woda; wycinki mają ostre krawędzie z maskowania `rembg`; nie ma map wysokości ani przejść brzegowych (wybrzeże, krawędź lodu, brzeg lawy) — brzegi trzeba zbudować w kodzie renderowania albo wygenerować osobno; lawa nie może być przechodnim podłożem bez osobnej mechaniki (AGENTS/GPU-PRODUCTION-SEQUENCE, Etap 6). Prawa do checkpointu DreamShaper XL Turbo i obrazów pochodnych: **NIEROZSTRZYGNIĘTE**.
