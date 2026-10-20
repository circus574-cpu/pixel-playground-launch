# Ki Legends — stabilizacja przed GPU, 2026-10-20

Gałąź `feat/pre-gpu-stabilization-20261020`. Bez scalenia do main i bez publikacji. Identyfikator kodu: `pre-gpu-engine-r1`. Raport jest uzupełniany rzeczywistymi wynikami końcowej regresji i pomiarów; statusy poniżej nie zastępują niewykonanych testów.

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

Warstwy obejmują podłoże, ścieżki, dekoracje pod stopami, wspólne sortowanie obiektów/aktorów po Y, overhead, atmosferę, walkę i etykiety/sterowanie. Zachowano cztery leśne tilemapy, footprinty i przygaszanie obiektów zasłaniających gracza. Culling obejmuje teraz również cienie leśnych obiektów. Nowe grafiki mogą zachować proporcje przez `contain`, a kafle mają osobny rozmiar powtórzenia w jednostkach świata.

Fokus: rzeczywiste blur/focus zeruje klawisze i joystick oraz wstrzymuje symulację, z zachowaniem istniejącej obsługi hidden/visibility. Sprzątanie jest idempotentne, dotyczy obu zdarzeń sceny i odmontowania; obejmuje także nowy telemetryczny postrender. Diagnostyka nie dodaje nakładki do gry.

Testowy przycisk **Zmiana rasy** pozostaje. Podpowiedzi nadal znikają po 5 s, mają × i zapamiętywane ustawienia.

## Nieudane próby i przyczyny

Pełny rejestr: [audit-failures.json](qa/pre-gpu/audit-failures.json), z dokładnymi próbami, oczekiwaniem, wynikiem, screenshotami i ścieżkami trace. Traces lokalnych prób zapisano w `/workspace/scratch/pre-gpu/failure-traces/`; duże archiwa nie są dublowane w historii Git. GitHub Actions zachowuje własne screenshoty/logi/trace w artefaktach.

- Import JSON: błąd kolekcji testów, bez uruchomienia przeglądarki, więc bez fikcyjnego screenshotu/trace.
- W trakcie implementacji nowy guard oparty o początkowe `Phaser.hasFocus` zatrzymał symulację. Wykryto go przed PR/publikacją i zastąpiono stanem opartym o faktycznie zaobserwowane zdarzenia. Rzeczywiste scenariusze PvE trzech ras ponownie przeszły. To była regresja gałęzi roboczej, nie potwierdzony błąd poprzedniej produkcji.
- Pierwsza próba focus QA błędnie zakładała, że nowa karta odbiera fokus. Playwright emuluje aktywność kart, a wysłanie keyup do pierwotnej karty ponownie ją aktywuje. Test wyłącza teraz emulację fokusu, sprawdza rzeczywisty blur/focus i zwalnia klawisz w innej karcie. Brak nieuprawnionej deklaracji „ruchu w tle”.
- Test myszy w mobilnej Pyrze wskazał punkt pod przyciskiem NPC. Helper sprawdza `elementFromPoint` i używa rzeczywistych przycisków zoomu, zamiast force-click lub timeoutu 180 s. To poprawka scenariusza, bez przesuwania UI ani gracza.
- Test pościgu w Pyrze żądał `(1970,920)` na krawędzi clearance przeszkody; gra prawidłowo wybrała `(2004,924)`. Oczekiwanie testu uwzględnia teraz tę projekcję, bez zmiany geometrii. Końcowy przebieg jest ponawiany.

## Cztery rasy — końcowa macierz

Wyniki w trakcie pełnego przebiegu, do uzupełnienia po jego zakończeniu:

| Rasa / kontynent | Pełne PvE, ekonomia, pancerz i reload | Dotyk/klawiatura 8 kierunków, pion/poziom, fokus | Naturalna śmierć/respawn | Pościg/powrót, kolizja i granica |
| --- | --- | --- | --- | --- |
| Planetarni — Verdantia | trwa końcowy przebieg | trwa | trwa | trwa |
| Mędrcy — Aetheria | trwa końcowy przebieg | trwa | trwa | trwa |
| Androidy — Nexus-9 | trwa końcowy przebieg | trwa | trwa | trwa |
| Legendy — Pyra | trwa końcowy przebieg | trwa | trwa | ponowienie po korekcie celu QA |

P0 nie dodaje sztucznych zabójstw/XP/loot/HP/teleportacji do testów. Długie podejścia wykorzystują produkcyjną komendę ruchu z prawdziwym A*, pozostałe działania UI, mysz, klawiaturę i CDP touch. Nowa śmierć odbywa się przez faktyczne ataki przeciwnika; poprzedni fixture 1 HP w teście podpowiedzi usunięto. Starsze fixtures v1 i HP/KI służą wyłącznie migracji/układowi HUD, nie zaliczaniu PvE.

## Grafika i gotowość narzędzi

Pełna specyfikacja: [GPU_ASSET_PIPELINE.md](GPU_ASSET_PIPELINE.md). Master 512 RGBA, klient 128, postać 96 jednostek, osiem kierunków, 416 klatek bohatera/przeciwnika. NPC idle/walk 128 klatek. Packer klatek został sprawdzony pełną syntetyczną dostawą; testowy rig ma faktycznie różne neutralne klatki, nie fragmenty ilustracji referencyjnych.

Działają walidacja obrazu/alpha, rozdzielczości, ilości i nazw klatek, metadanych trim, powiązań, limitu tekstur świata, lossless WebP, wersjonowania i atomowej aktualizacji katalogu. Testy sprawdzają też odrzucenie złej dostawy, brak zmiany aktywnego rejestru po błędzie, idempotencję i brak nadpisania istniejącej paczki. Aktualne bazowe tekstury świata: Verdantia 42 023 200 B RGBA, pozostałe światy po 16 561 440 B (bez narzutu sterownika, mipmap i HTML).

Do wykonania przez produkcję artystyczną: kanoniczny bohater, akceptacja kamery/stóp/rytmu, cztery rasowe zestawy, NPC/fauna, budynki, roślinność, podłoże, dekoracje i efekty KI według pliku targets. Obecne SVG nowych krain, wspólny człowiek, dzik i proceduralne efekty nadal są tymczasowe. Nie uruchomiono generowania anime.

## Pomiary

Wykonywane osobno od trace Playwright, skryptem `npm run bench:game`. Zbierane są rzeczywiste FPS, P50/P95 czasu klatki, wejście do świata, czas loadera, obiekty/tekstury, JS heap i szacunek bazowego RGBA. Draw calls są liczone przez instrumentację wywołań WebGL, dla Canvas niedostępne. Tabela i JSON zostaną dopisane po pomiarze, bez deklarowania 60 FPS z samego kodu.

Pomiary dotyczą Linux/cloud Chromium i emulowanych viewportów; WebGL używa SwiftShader. **Fizyczny Android, pamięć GPU sterownika i jego draw calls na urządzeniu nie zostały zmierzone.** Nie należy przekładać wyników hosta na telefon ani traktować GC JS jako dowodu pełnego zwolnienia pamięci GPU.

## Testy i Actions

- TypeScript: pełna aplikacja, e2e i narzędzia — PASS w wykonanych sprawdzeniach.
- Unit: ostatnie wykonanie **91/91**, 15 plików, bez pominięć; końcowe powtórzenie po zmianach narzędzia trwa.
- Lint: 0 błędów i 7 istniejących ostrzeżeń Fast Refresh shadcn.
- Produkcyjny build: PASS. Istnieją ostrzeżenia narzędzi o dużym chunku Phaser i deprecated createServerFn validator.
- Pełny Playwright: **46 testów uruchomione**, wynik zostanie wpisany po zakończeniu. Brak selektywnego pomijania znanych niepowodzeń.
- Workflow z PR #1 zachowany i rozszerzony o typecheck, unit, assets, lint, build oraz ścieżki komponentów/assetów/narzędzi. PR uruchamia pełną suite; nazwa joba już nie sugeruje smoke przy wykonywaniu całości. Artefakty błędów zawierają stan obserwowany, logi konsoli, screenshot i trace. Link aktualnego runa zostanie wpisany po utworzeniu PR.

## GitHub, wdrożenie i status GPU

Kod, dokumentacja i QA są na osobnej gałęzi. PR, SHA oraz pliki zmienione zostaną uzupełnione po zapisaniu checkpointu i końcowych kontrolach. Main/produkcja pozostają bez publikacji tego etapu. Nie wykonano żadnego deploy przez Lovable.

**Status roboczy: GOTOWE WARUNKOWO** — implementacja importu/animacji jest działająca, ale pełna regresja, CI i pomiary jeszcze trwają. Ostateczny status zostanie wyznaczony na podstawie ich rzeczywistych wyników. Fizyczna akceptacja Androida i pierwszy kanoniczny render pozostają osobnymi warunkami jakości grafiki.
