# KI Legends — stan techniczny

Audyt odczytu: 2026-10-21, baza `86a1e411339bc41fb218d4633ed2a7bd81e1f167`. Uzupełnia, nie nadpisuje draftu Architekta #6. Aktualne zadanie przekazania nie zmienia kodu. Historia/PR i procedura przejęcia: [HANDOFF](HANDOFF.md). Stan GPU: [GPU_PRODUCTION](GPU_PRODUCTION.md).

## Stos i środowisko

`package.json` + `package-lock.json` są źródłem wersji. Phaser **4.2.1**, React/React DOM ^19.2.0, TypeScript ^5.8.3, Vite **8.1.5**, TanStack Start 1.168.60 / Router 1.170.41, `@lovable.dev/vite-tanstack-config` 2.26.5, Nitro 3.0.260603-beta/Cloudflare; Tailwind 4.2.1, Zod 3.25.76. Narzędzia: Vitest ^4.1.10, Playwright ^1.64.1, ESLint 9, tsx, sharp. Dokładne rozstrzygnięte wersje zawsze z lockfile, nie z samych zakresów.

CI używa Node **22** i `npm ci`. Kontrakt narzędzi zaleca 22.18+. Bieżące testy przekazania: lokalny Node **24.19.0**, npm **11.9.0**, git-lfs **3.6.1** — nie mylić z Node 22.23.3 historycznego GPU. Dostęp HTTP w Cloud przez odziedziczony proxy; bieżąca polityka unrestricted HTTP, brak grantów TCP/VPN. Nowa sesja musi sprawdzić własną konfigurację; nic tu nie upoważnia do obchodzenia sieci.

`vite.config.ts` korzysta z wrappera Lovable: nie dodawać ponownie React/TanStack/Nitro/Tailwind pluginów, bo wrapper już je ładuje. `src/server.ts` opakowuje SSR; target Cloudflare w buildzie. Genericzne `vite preview` nie jest dowodem poprawnego uruchomienia pełnego workera Cloudflare. Osobny playtest ma własny config i rzeczywistą stronę gry.

## Przepływ i odpowiedzialności

| Ścieżka | Rola / zależności |
| --- | --- |
| `src/routes/index.tsx` | klientowy CharacterStore, wybór slotu/pochodzenia, dynamiczny mount Phaser, HUD, loader/retry, fullscreen i cleanup |
| `src/game/session.ts` | GameSession i SaveStore: reguły, stan, komendy, AI/PvE/questy/ekonomia; niezależne od tekstur |
| `characters.ts` | sloty, aktywna postać, niedestrukcyjna kopia legacy, bez bazy kont |
| `navigation.ts`, `movement.ts`, `geometry.ts` | A*, clearance, kolizje stóp i line-of-sight; źródło prawdy geometrii |
| `mountGame.ts` | jedna scena dla wszystkich światów, wejście, joystick, kamera, render aktorów i efektów, postęp/awarie loadera, blur/focus, raportowanie i destroy |
| `world/types.ts`, `world/worlds.ts`, `races.ts` | typy i kanoniczne konfiguracje czterech pochodzeń/światów/NPC/celów |
| `world/forest-map.json`, `forest.ts`, `regions/*.json` | dane Verdantii i trzech osobnych map, spawny/POI/przeszkody; generatory `build_anime_forest.py`, `build_stage3_worlds.py` muszą pozostać zgodne z danymi |
| `world/renderForest.ts`, `renderWorld.ts` | grafika map, sortowanie Y, wspólna scena; nie cztery kopie silnika |
| `world/cacheForestTerrain.ts`, `terrainBlits.ts` | cache statycznego terenu i cieni Verdantii, sześć chunków 1024², oryginalna tilemap jako fallback |
| `world/visibility.ts` | culling i widoczność/etykiety |
| `assets/catalog.ts`, `world/assets.ts` | centralny manifest i powiązania per świat, ograniczenie preload do aktywnego świata |
| `assets/schema.ts`, `contract.ts` | wspólny walidator runtime/importu i produkcyjny kontrakt; zmiana wymaga zgodności narzędzi i schematu JSON |
| `assets/phaserAssets.ts`, `actorAnimation.ts` | image/sheet/atlas, kontrola ramek, kierunki i stany; fallback istniejącej grafiki |
| `assets/layers.ts`, `scenery.ts`, `atmosphere.ts` | niezależne warstwy, skala dekoracji, pogoda/efekty |
| `assets/telemetry.ts` | odczytowe metryki; nie sterowanie HP/XP ani hook do oszukiwania testów |
| `components/game/*` | selektor, oryginalne ilustracje, marka, loader, HUD, okna, komunikaty |
| `scripts/lib/gpu-import.ts`, `pack-frames.ts`, `frame-layout.ts` | walidacja i pakowanie; CLI w `scripts/import-game-assets.ts`, `pack-gpu-frames.ts`, `check-game-assets.ts` |

## Mapy i fizyka

Verdantia: 3072×2048 jednostek, zachowana mapa lasu z czterema warstwami kafli. Aetheria/Nexus/Pyra: 2400×1792, osobne JSON i dekoracje. Spawny i cele są w danych, nie wolno ich przesuwać w celu dopasowania artworku bez udowodnionej usterki. Lokalny rynek/źródło/rdzeń/arena to różne poprawne cele, nie globalny przycisk „Podejdź do rynku”.

Promień kolizji stóp 12, margines świata 16, siatka A* 24, prędkość 205 jednostek/s; tick ograniczony do 100 ms. Bazowy atak ma range 78 i cooldown 650 ms; umiejętności i obrażenia określa `session.ts`. Nie synchronizować naliczania obrażeń przez zmianę balansowania pod grafikę. Nie są to pikselowe hitboxy sylwetki; broń/włosy/aura nie powiększają collidera.

Warstwy: ground -100000, paths -99990, below -10000, objects i actors +Y, overhead 20000, atmosphere 30000, combat 40000, labels 50000, controls 60000. Footprint i punkt stóp pochodzą z mapy/kontraktu, nie przypadkowego przycięcia PNG. Rendering obecnie resolution=1; zoom 0.35–1 (domyślne desktop 0.62, mobilne 0.48). Zmiana DPR/rozmiaru postaci wymaga nowych pomiarów i budżetu.

## Grafika main i granica PR #4

Main używa wspólnego ludzkiego spritesheetu, tymczasowej fauny, niezależnych obiektów lasu i SVG trzech nowych regionów. Oryginalne ilustracje pełnych ras z `origins-v1` są **prezentacyjne**, nie źródło wycinanych animacji. `origin-art.json` zawiera rozmiary/kadry/hashe; selektor i loader opisuje QA-STAGE3-1.

`assets/imported.json` zawiera techniczny rig z `technical:true` i pustymi actor/render bindings. Nie oznacza to domyślnego nowego bohatera w grze. `?ki-art=technical` działa w izolowanym playteście; na produkcji ignorowane. `?ki-hero-art=1`, `previewOnly` i `presentation=grounded` są pracą draft PR #4, **nie ma ich w main**. Nie włączać flagi według starego raportu bez sprawdzenia konkretnego checkoutu.

Podstawowy kontrakt main: master 512² RGBA, klient 128², aktor 96 jednostek/origin 0.5,0.95, kamera renderu 60°, 416 klatek hero/enemy lub 128 NPC. Profile/odmienna kamera roboczego Planetarnego opisane oddzielnie w GPU_PRODUCTION. Atlasy ≤2048, 128 MiB bazowych tekstur świata. Packer odrzuca niepełny zestaw, importer kontroluje dekodowanie obrazów, alpha, trim, path traversal, duplikaty, wersje i budżety. `--install` zmienia rejestr; dry-run bez flagi nie instaluje. Nie podmieniać rejestru ręcznie, by „zaliczyć” dostawę.

## Zapisy, wejście i UI

Bazowy klucz `ki-legends:adventure:v1` pozostaje. Envelope obsługuje v1 i v3 z revision. CharacterStore kopiuje legacy do `:character:legacy`, nie usuwa źródła; nowe sloty `:character:<id>`, aktywny `:active-character`. Zapis obejmuje race/continent/pozycję/questy/ekwipunek. Obsługa niezgodnej rasy/świata, zablokowanego storage i konfliktu kart jest częścią bezpieczeństwa. Nie czyścić localStorage ani nie resetować kontynentu dla naprawy UI. Brak synchronizacji chmurowej postaci.

Komendy sesji przechodzą przez typed adapter; UI wyświetla snapshot. Klawiatura/mysz/dotyk współdzielą ruch; fokus okien zatrzymuje wejście. Blur/ukrycie dokumentu zawiesza grę i czyści kierunki; powrót nie może uruchamiać zaległych kroków. Dispose usuwa listenery/observer i niszczy Phaser/canvas; nie montować drugiej sceny przy retry bez cleanup.

HUD importuje po kolei game-hud, anime-hud, adventure, game-messages, na końcu hud-layout. Ostatnia warstwa odpowiada za geometrię. Kompaktowy breakpoint: ≤760 px albo wysokość ≤500 i szerokość ≤1100. Menu zwijane, dynamiczny status-stack, lokalna rozmowa; `useGameMessage` kontroluje scope i wygasanie. Zachować błędy zapisu i możliwość zamknięcia podpowiedzi; nie podnosić z-index jako uniwersalnej naprawy nachodzenia.

Flagi main: `TEST_RACE_SWITCH_ENABLED=true`, `STATIC_TERRAIN_CACHE_ENABLED=true`. Druga ma zachowany renderer awaryjny; wyłączenie zmienia koszt rysowania, wymaga pomiaru. Grywalny region i wszystkie POI muszą pozostać osiągalne po wymianie grafiki.

## Równoległa funkcja prywatna — nie ingerować

`/test` jest prywatnym szkicownikiem. `src/routes/test.tsx`, `src/lib/sketches.*`, walidacja, guarded server functions, sesja ze wspólnym hasłem i prywatny bucket są odrębne od gry. Nie przerabiać ich na konta MMO. Nie zmieniać polityk dostępu/bucketu/auth przy naprawie HUD lub GPU. Supabase jest zależnością aplikacji, **nie dowodem przechowywania tam postaci MMORPG**. Sekretów/env nie kopiować do handoffu ani do modeli.

## Uruchomienie i testy

```sh
npm ci
npm run dev
# oddzielny uproszczony host rzeczywistej gry:
npm run playtest
# strona /scripts/playtest.html
npm run typecheck
npm run test
npm run assets:check
npm run lint
npm run build
npm run test:e2e
```

Playwright ma jednego workera, własny `build:playtest` i serwer 4174, trace retained on failure i screenshot na błędzie. Zewnętrzny host wymaga właściwego `KI_QA_BASE_URL`/`KI_QA_PATH`; produkcja `/`, static playtest `/scripts/playtest.html`. Nie polegać na starym serwerze innego worktree. Macierz obejmuje cztery rasy, prawdziwy dotyk, śmierć/respawn, polowanie/handel/kowala, save/migration, kolizje i loader/retry. Istnieją neutralne fixtures do migracji i wartości HP/KI; nie służą zaliczaniu PvE przez wstrzyknięte zabójstwa.

Workflow `.github/workflows/ki-legends-playwright.yml`: PR zmieniający src/e2e/narzędzia/assets uruchamia full. `workflow_dispatch` ma smoke/full; job wysyła artefakty z siedmiodniową retencją. Dokumentacyjny PR bez wskazanych ścieżek nie uruchamia automatycznie pełnego CI. Brak osobnego skryptu `test:integration`: integracje React/loader/storage/importer są w Vitest i E2E, nie fikcyjny dodatkowy test.

## Ograniczenia i pomiary

Historyczne pomiary, środowisko i pełna metodologia są w PRE_GPU_STABILIZATION i `docs/qa/pre-gpu/`. Canvas tam osiągał ok. 56.7–59.4 FPS; software WebGL SwiftShader 13.0–25.1 FPS. Nie przenosić ich na dzisiejszy commit/telefon jako gwarancji. Cache Verdantii poprawiał kontrolowany test kosztem 24 MiB, nie zmieniając mapy. Podczas przekazania nie wykonywano nowego benchmarku, fizycznego Androida, termiki, pamięci sterownika ani długiej sesji. Pozostaje duży chunk Phaser i ostrzeżenia narzędzi; szczegóły aktualnych kontroli w FINAL_TESTS.

Nie wykryto otwartego krytycznego problemu w ostatnim zakończonym zestawie HUD 54/54; to ograniczony dowód testów, nie zapewnienie braku wszystkich błędów. Brak backendu MMO, kont, serwerowej synchronizacji, gotowej produkcyjnej rasy GPU i pełnej oprawy pozostałych krain. Wymiana wizualna ma przechodzić przez manifesty, bez zmiany zasad walki/zapisów i bez pełnego obrazu udającego mapę.

Uwaga identyfikacji publikacji: `src/game/playtest.ts` ma statyczny marker **pre-gpu-engine-r1**, nie pełny SHA. Sam meta tag `ki-build` nie pozwala potwierdzić wydania HUD ani zgodności dowolnego przyszłego deploy. Wiązać commit synchronizacji, deployment i rzeczywiste zasoby/testy na domenie.
