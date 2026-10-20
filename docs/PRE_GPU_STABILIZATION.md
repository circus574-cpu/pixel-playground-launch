# Ki Legends — stabilizacja przed GPU, 2026-10-20

Gałąź `feat/pre-gpu-stabilization-20261020`. Bez scalenia do main i bez publikacji. Identyfikator kodu: `pre-gpu-engine-r1`. Testowana implementacja: `f739f0d9bbf194bfffebcbf95bc569dcece2ddff`. Raport rozróżnia pełny lokalny przebieg przed cache, powtórzenie po cache i niezależny końcowy przebieg CI.

## Audyt wejścia i cudza praca

- Sprawdzono aktualny `main`: `a1a307286bc1b406d839ab13ca5ee656d26a2dad`, AGENTS.md, moduły silnika, UI, save, cztery mapy, assety i testy. Phaser faktycznie ma wersję **4.2.1**. Nie przyjęto historycznego SHA za stan bieżący.
- Gałąź `qa/playwright-github-actions-20261020`, head `e8edb7a55ab9913456528f82279ef1f66f3fc3ef`, PR [#1](https://github.com/circus574-cpu/pixel-playground-launch/pull/1): dołączono jej cztery commity przez merge, bez rebase/force-push i bez zmiany tamtej gałęzi.
- [Ostatni run QA](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39419390691) był czerwony **przed uruchomieniem scenariuszy**: Node wymagał import attributes dla JSON map. Wcześniejsze zielone runy [39418339956](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39418339956) i [39412922412](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39412922412) dotyczyły starszych commitów, nie dowodziły przejścia nowych trzech ścieżek PvE.
- Dodano `with { type: "json" }` w importach definicji świata. Dopiero potem faktycznie uruchomiono nowe scenariusze: **3/3 PASS**. Po zmianie adaptera i poprawieniu inicjalizacji fokusu wykonano je ponownie: **3/3 PASS**.
- `lovable-sync` zawiera odrębne prace nad upload API/private sketch storage. Nie dotyczy tego etapu, nie został scalony. Pozostałe gałęzie feature/fix mają pracę obecną już na main. `/test`, sekrety, storage guards i cudze funkcjonalności pozostają bez zmian.

## Implementacja i stan gry

`GameSession` nadal zarządza lokalną mechaniką, kolizją, A*, walką, AI, questami, lootem, XP, ekonomią i istniejącym zapisem. Jedna scena Phaser obsługuje wszystkie światy. React wysyła komendy i pokazuje snapshoty. Nie zmieniono PlayerSchema, slotów, map, punktów startu/questów ani reguł obrażeń/cooldownów. Dodany event ataku przeciwnika jest wyłącznie informacją dla prezentacji.

Nowy katalog renderowania łączy stare assety z wersjonowanymi paczkami GPU. Image, sheet i atlas mają stabilne ID; aktorzy/efekty/obiekty/teren/UI dostają referencje z konfiguracji. Aktor ma klipy idle/walk/run/attack/skill/hit/death/respawn z 4/8 kierunkami. Docelowe rasowe ciała nie zostały wdrożone: wszystkie starty nadal używają `human-v2`. Neutralny rig z ośmioma kierunkami jest dostępny tylko w lokalnym dokumencie playtest.

Adapter animacji reaguje na rzeczywiste zdarzenia i stan ruchu, pauzuje razem z dialogiem, trzyma śmierć do odrodzenia oraz zachowuje stare efekty tam, gdzie brakuje rysowanych klipów. Priorytety uniemożliwiają zastąpienie śmierci animacją ataku. Kierunki są przygotowane raz, nie tworzone od nowa w każdej klatce.

Warstwy obejmują podłoże, ścieżki, dekoracje pod stopami, wspólne sortowanie obiektów/aktorów po Y, overhead, atmosferę, walkę i etykiety/sterowanie. Zachowano cztery warstwy danych leśnego terenu, footprinty i przygaszanie obiektów zasłaniających gracza. Domyślnie renderer jednorazowo składa teren i statyczne cienie do sześciu chunków 1024². Każdy chunk podlega cullingowi; budynki, drzewa, aktorzy, overhead i kolizje pozostają oddzielne. Oryginalny renderer tilemap został zachowany za `STATIC_TERRAIN_CACHE_ENABLED=false`. Cache jest zwalniany przy zamknięciu sceny. Nowe grafiki mogą zachować proporcje przez `contain`, a kafle mają osobny rozmiar powtórzenia w jednostkach świata.

Fokus: rzeczywiste blur/focus zeruje klawisze i joystick oraz wstrzymuje symulację, z zachowaniem istniejącej obsługi hidden/visibility. Sprzątanie jest idempotentne, dotyczy obu zdarzeń sceny i odmontowania; obejmuje także nowy telemetryczny postrender. Diagnostyka nie dodaje nakładki do gry.

Testowy przycisk **Zmiana rasy** pozostaje; wyłącza go `TEST_RACE_SWITCH_ENABLED=false` w `src/game/features.ts`. Podpowiedzi nadal znikają po 5 s, mają × i zapamiętywane ustawienia.

## Nieudane próby i przyczyny

Pełny rejestr: [audit-failures.json](qa/pre-gpu/audit-failures.json), z dokładnymi próbami, oczekiwaniem, wynikiem, screenshotami i ścieżkami trace. Traces lokalnych prób zapisano w `/workspace/scratch/pre-gpu/failure-traces/`; duże archiwa nie są dublowane w historii Git. GitHub Actions zachowuje własne screenshoty/logi/trace w artefaktach.

- Lokalny `npm run preview` wskazał nieistniejące `dist/server/server.js`: niewłaściwa komenda dla tego targetu Nitro/Cloudflare, przed uruchomieniem gry. Poprawny `.output/server/wrangler.json` uruchomiono przez Wrangler `--local`; rzeczywisty scenariusz A/B/C wszystkich ras przeszedł w 56.5 s. Sposób uruchomienia udokumentowano w specyfikacji, bez zmiany hostingu.
- Import JSON: błąd kolekcji testów, bez uruchomienia przeglądarki, więc bez fikcyjnego screenshotu/trace.
- W trakcie implementacji nowy guard oparty o początkowe `Phaser.hasFocus` zatrzymał symulację. Wykryto go przed PR/publikacją i zastąpiono stanem opartym o faktycznie zaobserwowane zdarzenia. Rzeczywiste scenariusze PvE trzech ras ponownie przeszły. To była regresja gałęzi roboczej, nie potwierdzony błąd poprzedniej produkcji.
- Pierwsza próba focus QA błędnie zakładała, że nowa karta odbiera fokus. Playwright emuluje aktywność kart, a wysłanie keyup do pierwotnej karty ponownie ją aktywuje. Test wyłącza teraz emulację fokusu, sprawdza rzeczywisty blur/focus i zwalnia klawisz w innej karcie. Brak nieuprawnionej deklaracji „ruchu w tle”.
- Test myszy w mobilnej Pyrze wskazał punkt pod przyciskiem NPC. Helper sprawdza `elementFromPoint` i używa rzeczywistych przycisków zoomu, zamiast force-click lub timeoutu 180 s. To poprawka scenariusza, bez przesuwania UI ani gracza.
- Test pościgu w Pyrze żądał `(1970,920)` na krawędzi clearance przeszkody; gra prawidłowo wybrała `(2004,924)`. Oczekiwanie testu uwzględnia teraz tę projekcję, bez zmiany geometrii. Korekta została potwierdzona w pełnym lokalnym przebiegu 46/46 i w jego niezależnym powtórzeniu CI.

## Cztery rasy — końcowa macierz

Wyniki końcowego CI **47/47 PASS** na `f739f0d`, potwierdzone także wcześniejszym pełnym przebiegiem lokalnym 46/46, powtórzeniem po cache 6/6 i testem produkcyjnego workera Cloudflare 1/1:

| Rasa / kontynent | Pełne PvE, ekonomia, pancerz i reload | Dotyk/klawiatura 8 kierunków, pion/poziom, fokus | Naturalna śmierć/respawn | Pościg/powrót, kolizja i granica |
| --- | --- | --- | --- | --- |
| Planetarni — Verdantia | PASS | PASS | PASS | PASS |
| Mędrcy — Aetheria | PASS | PASS | PASS | PASS |
| Androidy — Nexus-9 | PASS | PASS | PASS | PASS |
| Legendy — Pyra | PASS | PASS | PASS | PASS |

P0 nie dodaje sztucznych zabójstw/XP/loot/HP/teleportacji do testów. Długie podejścia wykorzystują produkcyjną komendę ruchu z prawdziwym A*, pozostałe działania UI, mysz, klawiaturę i CDP touch. Nowa śmierć odbywa się przez faktyczne ataki przeciwnika; poprzedni fixture 1 HP w teście podpowiedzi usunięto. Starsze fixtures v1 i HP/KI służą wyłącznie migracji/układowi HUD, nie zaliczaniu PvE.

Zrzuty z końcowego CI: [Planetarni — PvE](qa/pre-gpu/screenshots/planetary-combat.png), [Mędrcy — PvE](qa/pre-gpu/screenshots/sage-combat.png), [Androidy — PvE](qa/pre-gpu/screenshots/android-combat.png), [Legendy — PvE](qa/pre-gpu/screenshots/legend-combat.png), [neutralny rig — KI](qa/pre-gpu/screenshots/technical-skill.png). Katalog `qa/pre-gpu/screenshots/` zawiera też każdą śmierć, granicę świata oraz sterowanie w pionie i poziomie. [Start z pełnego workera Cloudflare](qa/pre-gpu/screenshots/planetary-start-cloudflare.png).

## Grafika i gotowość narzędzi

Pełna specyfikacja: [GPU_ASSET_PIPELINE.md](GPU_ASSET_PIPELINE.md). Master 512 RGBA, klient 128, postać 96 jednostek, osiem kierunków, 416 klatek bohatera/przeciwnika. NPC idle/walk 128 klatek. Packer klatek został sprawdzony pełną syntetyczną dostawą; testowy rig ma faktycznie różne neutralne klatki, nie fragmenty ilustracji referencyjnych.

Działają walidacja obrazu/alpha, rozdzielczości, ilości i nazw klatek, metadanych trim, powiązań, limitu tekstur świata, lossless WebP, wersjonowania i atomowej aktualizacji katalogu. Testy sprawdzają też odrzucenie złej dostawy, brak zmiany aktywnego rejestru po błędzie, idempotencję i brak nadpisania istniejącej paczki. Bazowe tekstury świata: Verdantia 42 023 200 B RGBA plus 25 165 824 B cache, razem **67 189 024 B**; pozostałe światy po **16 561 440 B**. Importer uwzględnia cache w budżecie 128 MiB. To plan bazowych tekstur bez narzutu sterownika, mipmap, canvasów i HTML; telemetryczny runtime obejmuje ponadto tekstury wewnętrzne Phasera.

Próba CLI `assets:import` na przenośnej paczce technicznej: **PASS**, manifest i rzeczywiste pliki odczytane, SHA-256 zweryfikowane, plan budżetów poprawny, `installed=false`. [Wynik](qa/pre-gpu/import-cli-plan.json).

Do wykonania przez produkcję artystyczną: kanoniczny bohater, akceptacja kamery/stóp/rytmu, cztery rasowe zestawy, NPC/fauna, budynki, roślinność, podłoże, dekoracje i efekty KI według pliku targets. Obecne SVG nowych krain, wspólny człowiek, dzik i proceduralne efekty nadal są tymczasowe. Nie uruchomiono generowania anime.

## Pomiary

Pomiary wykonano osobno od nagrywania trace, skryptem `npm run bench:game`: 8 przypadków Canvas (desktop i viewport telefonu) i 4 WebGL SwiftShader. Każdy przypadek miał około 10 s próbkowania, rzeczywisty ruch prawo/lewo, osobny kontekst, wejście i zamknięcie sceny. Wszystkie 12 przypadków: **0 błędów konsoli/zasobów**. Środowisko: [measurement-environment.json](qa/pre-gpu/measurement-environment.json). Zasoby pobierano z localhost; nie jest to test wolnej sieci.

| Kontynent | Renderer / viewport | Średnie FPS | P50 klatki, ms* | P95 klatki, ms* | Wejście / loader, ms | Obiekty aktywne | Draw calls/s |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Verdantia | Canvas 1280×900 | 56.7 | 16.7 | 74.3 | 1763 / 438 | 356 | — |
| Aetheria | Canvas 1280×900 | 59.0 | 16.6 | 19.0 | 863 / 151 | 89 | — |
| Nexus-9 | Canvas 1280×900 | 59.0 | 16.6 | 32.5 | 872 / 216 | 89 | — |
| Pyra | Canvas 1280×900 | 58.9 | 16.7 | 28.7 | 987 / 236 | 88 | — |
| Verdantia | Canvas 390×844 | 58.6 | 16.6 | 44.4 | 1582 / 280 | 356 | — |
| Aetheria | Canvas 390×844 | 59.2 | 16.7 | 26.2 | 1319 / 140 | 89 | — |
| Nexus-9 | Canvas 390×844 | 59.4 | 16.7 | 21.1 | 1282 / 114 | 89 | — |
| Pyra | Canvas 390×844 | 59.2 | 16.7 | 31.8 | 1340 / 149 | 88 | — |
| Verdantia | SwiftShader 640×480 | 13.0 | 73.6 | 706.3 | 2703 / 1153 | 356 | 280 |
| Aetheria | SwiftShader 640×480 | 21.8 | 38.1 | 803.1 | 1377 / 373 | 89 | 522 |
| Nexus-9 | SwiftShader 640×480 | 25.1 | 31.7 | 95.3 | 1715 / 433 | 89 | 559 |
| Pyra | SwiftShader 640×480 | 22.2 | 35.1 | 175.9 | 1306 / 383 | 88 | 453 |

\* Średnie FPS to średnia zapisanych sekundowych próbek. P50 to mediana sekundowych P50, P95 to najgorsze sekundowe P95 w danej próbie, nie percentyl z połączonych wszystkich klatek. Duże skoki pierwszych klatek programowego WebGL pozostawiono w wynikach.

Selektor był dostępny po **352–493 ms**. Canvas: JS heap z CDP **8.8–11.0 MiB**, a po wyjściu i wymuszonym GC wszystkich 12 przypadków **8.2–9.1 MiB**. Każda próba potwierdziła **0 canvasów po wyjściu**. Runtime szacował bazowe tekstury Verdantii na **67 310 848 B**, pozostałych krain na **16 683 264 B**, wliczając tekstury wewnętrzne Phasera. Nie jest to pomiar pamięci GPU sterownika ani dowód całkowitego braku wycieków po długiej sesji.

Draw calls są rzeczywistymi zliczeniami wywołań `drawArrays`/`drawElements` i wariantów instanced. Dla Canvas nie są dostępne. Nie uzyskano pomiaru sprzętowego WebGL. Skrypt pomiarowy wymagał poprawki serializacji browser hook: początkowe `__name is not defined` pochodziło z transpilerowego helpera `tsx`, nie z gry; końcowe 12 pomiarów wykonano już literalnym kodem przeglądarki.

### Potwierdzona poprawka wydajności Verdantii

Pomiar wstępny wykrył wielokrotne rysowanie tysięcy widocznych kafli i osobnych cieni. W kontrolowanym porównaniu tego samego hosta, bez równoległych buildów/testów, cache zmienił średnie FPS **Canvas 1280×900: 19.7 → 59.5**, **SwiftShader 640×480: 7.4 → 17.5**. Obiekty spadły z **644 do 356** kosztem **24 MiB** sześciu tekstur cache. To osobna próba porównawcza; tabela powyżej obejmuje dłuższą próbę z ruchem i nie jest z nią mieszana. Wcześniejsze niekontrolowane próby podczas kompilacji nie są podstawą deklaracji poprawy.

Rzeczywiste dane: [terrain-cache-comparison.json](qa/pre-gpu/terrain-cache-comparison.json), [Canvas JSON](qa/pre-gpu/performance-canvas.json), [WebGL JSON](qa/pre-gpu/performance-webgl.json), [podsumowanie](qa/pre-gpu/performance-summary.json). Wizualnie sprawdzono [przed](qa/pre-gpu/terrain-before-canvas.png) i [po](qa/pre-gpu/terrain-after-canvas.png); układ mapy i obiekty zostały zachowane.

**Fizyczny Android, sprzętowy WebGL, pamięć GPU sterownika, obciążenie siecią i wielogodzinna sesja nie zostały zmierzone.** Software WebGL nadal ma niskie FPS, szczególnie w lesie. Wynik Canvas przy emulowanym rozmiarze telefonu nie jest obietnicą 60 FPS na telefonie. Te warunki pozostają w końcowej liście ograniczeń.

## Testy i Actions

- TypeScript: pełna aplikacja, e2e i narzędzia — PASS w wykonanych sprawdzeniach.
- Unit: **95/95 PASS**, 16 plików, 0 niezaliczonych, 0 pominiętych. W tym rzeczywiste pakowanie 416 syntetycznych klatek, odrzucenie błędnych paczek i testy cache.
- Lint: 0 błędów i 7 istniejących ostrzeżeń: 6 Fast Refresh shadcn i 1 zależności efektu w `sketch-preview.tsx`.
- Produkcyjny build: PASS. Istnieją ostrzeżenia narzędzi o dużym chunku Phaser i deprecated createServerFn validator.
- Pełny lokalny Playwright przed cache: **46/46 PASS**, 18.1 min, 0 pominięć, 0 retry, 0 flaky. Zapis: [playwright-local-results.json](qa/pre-gpu/playwright-local-results.json).
- Powtórzenie po cache: **6/6 PASS**, 1.5 min: pełna ścieżka PvE/ekwipunek/ekonomia/reload Verdantii, kolizje/kamera czterech kontynentów i uszkodzony atlas scenografii z retry. Zapis: [playwright-cache-focused-results.json](qa/pre-gpu/playwright-cache-focused-results.json).
- Dodatkowy test właściwego **produkcyjnego artefaktu Cloudflare** na localhost: **1/1 PASS**, 56.5 s, wszystkie cztery rasy/starty/podglądy/lokalne questy/nagrody/zapis/reload/przełączanie, 0 błędów przeglądarki. [playwright-cloudflare-results.json](qa/pre-gpu/playwright-cloudflare-results.json).
- Niezależny CI przed cache: **46/46 PASS**, 17.4 min, [39440336957](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39440336957).
- Końcowy CI na `f739f0d`: [39445655487](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39445655487), **47/47 PASS**, 14.5 min, **0 niezaliczonych, 0 pominiętych, 0 flaky/retry**. TypeScript/unit/assets/lint/build w tym samym runie PASS. [Zapis testów](qa/pre-gpu/playwright-actions-final-results.json), [wyciąg logów](qa/pre-gpu/actions-final-summary.log.txt). Smoke jest warunkowo pominiętym krokiem workflow, ponieważ wykonano pełną suite; żaden test pełnej suite nie został pominięty.
- Workflow z PR #1 zachowany i rozszerzony o typecheck, unit, assets, lint, build oraz ścieżki komponentów/assetów/narzędzi. PR uruchamia pełną suite; nazwa joba już nie sugeruje smoke przy wykonywaniu całości. Artefakty błędów zawierają stan obserwowany, logi konsoli, screenshot i trace. Aktualny run i PR są podlinkowane w tym raporcie. Artefakt `12277367823` (30.5 MiB) jest przechowywany do 2026-10-27; wybrane screenshoty, kompaktowe wyniki i logi pozostają w repozytorium.

## GitHub, wdrożenie i status GPU

Kod, dokumentacja i QA są na osobnej gałęzi. PR [#2](https://github.com/circus574-cpu/pixel-playground-launch/pull/2). Commity: `6d8ef7d` — merge pracy QA, `38310ad` — adapter/pipeline/testy, `82b961d` — walidacja pivotów atlasu, `f739f0d` — cache terenu/cieni i końcowe testy. [Lista zmienionych plików kodu](qa/pre-gpu/changed-files.json); GitHub Files changed zawiera także końcowe dowody i dokumentację. Main/produkcja pozostają bez publikacji tego etapu. Nie wykonano żadnego deploy przez Lovable. Kontrola read-only produkcji: HTTP 200, marker nadal `stage3.2-clear-gameplay-r1`; ta gałąź ma `pre-gpu-engine-r1`. [Dowód](qa/pre-gpu/production-read-only.json).

Końcowy commit po `f739f0d` dodaje wyłącznie dokumentację i zachowane dowody QA. Ma oznaczenie `[skip ci]`, aby nie powtarzać pełnej suite dla PNG/raportu; **cały kod, narzędzia i testy w PR odpowiadają sprawdzonemu `f739f0d`**. Nie pominięto żadnego scenariusza 47-testowego przebiegu.

## Pozostałe ograniczenia i decyzja

- **Nie wykryto otwartego krytycznego błędu** ruchu, walki, kolizji ani ładowania w wykonanej macierzy. Cztery światy, kamera/minimapa, NPC, zadania i nagrody, KI/XP/loot, broń/pancerz, kupiec/kowal, śmierć/respawn i zapis/reload przeszły rzeczywiste testy. Podpowiedzi, HUD i testowa zmiana rasy zachowują działanie.
- Fizyczny Android i sprzętowy WebGL pozostają **NIEWYKONANE**. SwiftShader osiąga 13.0–25.1 FPS; nie deklarujemy mobilnych 60 FPS. Przed szeroką publikacją trzeba sprawdzić docelowy telefon, nagrzewanie i dłuższą sesję.
- Pierwsza kanoniczna postać wymaga akceptacji tożsamości, kamery, kotwicy, chodu i kontaktu w grze. Walidator techniczny nie ocenia jakości artystycznej. Wzorzec należy zatwierdzić przed produkcją czterech pełnych zestawów.
- Gra nadal używa tymczasowego człowieka, wspólnej fauny, SVG trzech krain i proceduralnych efektów tam, gdzie nie dostarczono atlasów. Neutralny rig służy diagnostyce. Nie generowano docelowego anime i nie uruchamiano GPU.
- Publikacja, scalenie main oraz rozbudowa sieciowa nie należą do tego etapu. Właściwe lokalne uruchomienie workera udokumentowano; genericzne `npm run preview` nie obsługuje układu tego Cloudflare builda.

**GOTOWE WARUNKOWO.** Silnik i pipeline są gotowe do pierwszej kanonicznej dostawy GPU bez przebudowy mechaniki: 95/95 unit, 47/47 E2E, pełny lokalny worker i import CLI przeszły. Warunki dotyczą akceptacji pierwszej oprawy i fizycznej wydajności Androida przed masową produkcją/publikacją, a nie zastąpienia niewykonanych testów deklaracją PASS.

## Uzupełnienie: rzeczywiste uruchomienie GPU

Po zamknięciu testów silnika użytkownik udostępnił działający terminal RunPod. Naprawiono i uruchomiono środowisko CUDA/ComfyUI/Blender oraz sprawdzono rzeczywisty render i import. [Raport uruchomienia GPU](RUNPOD_GPU_SETUP.md) zawiera dowody, wersje i ograniczenia. Wcześniejszy zapis „nie uruchamiano GPU” opisuje stan pierwotnego etapu stabilizacji; obecny test nie obejmuje generowania docelowych postaci ani inference AI.
