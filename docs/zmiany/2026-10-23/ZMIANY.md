# KI Legends — zmiany 2026-10-23

Dziennik historyczny; stan aktualny jest w [indeksie](../../INDEX.md).
Nie przenosi starych zgód/statusów na nowe wydania.

## Lista zmian

- Zatwierdzono nazwy krain z gry oraz założenia balansu spoza aneksu; stara alternatywna lista przeciwników przestała obowiązywać.
- Poprawiono wydajność rysowania aktorów/cieni; zgłoszony pomiar Aetherii na realme 14T: 59,5 FPS. Nie jest to pomiar wszystkich przyszłych scen.
- Verdantia: sześć rozdzielonych usług, wnętrza, handel/kowal, depozyt, trening, odpoczynek i zapis v5.
- Aetheria/Nexus-9/Pyra: układy sześciu usług podłączono do wspólnych mechanik. city.bounds chroni miasto, walka poza nim pozostaje.
- Przygotowano projekt fabularny PDF v1: 89 stron, 98 zadań, 177 przedmiotów, 94 receptury; zapisano go też w głównym folderze projektu. To propozycja, nie wdrożenie kampanii.
- Na polecenie właściciela scalono 83 dawne opisy Markdown do 10 tematów, usunięto nieaktualne statusy i powtórzenia, dowody QA przeniesiono bajtowo do datowanych katalogów.

## Decyzje właściciela

| Data | Decyzja | Dowód | Status |
| --- | --- | --- | --- |
| 2026-10-23 | Nazwy krain: obowiązują nazwy z gry (Verdantia, Aetheria, Nexus-9, Pyra); nazwy z aneksu usunięte z dokumentacji i danych. Kanoniczny bestiariusz to dokument właściciela (40 potworów), wdrożony w grze. | [ROZWOJ-I-WALKA.md](../../ROZWOJ-I-WALKA.md) | Decyzja właściciela |

## Kontrola porządkowania

- 10 aktualnych dokumentów; tylko jeden dziennik na datę.
- Oryginały PDF, JSON kanonu, legal texts i dowody pochodzenia nie zostały usunięte.
- Każdy przeniesiony dowód ma ten sam SHA-256 co przed zmianą.
- [Mapa plików i hashy](segregacja.json).
- Kod symulacji i konfiguracja produkcji nie zmienione przez porządkowanie.
- Skrypt historycznego audytu licencji już na bazie wejściowej zgłaszał rozbieżność hasha; nie oznaczono go jako zaliczony.

## Commity w kolejności historii

- `045f310` — docs: pełna lista czerwonych testów CI po poszerzeniu map
- `57d9d3b` — e2e: specyfikacje dostosowane do kitów ras (w toku, wyniki przebiegu jeszcze nieznane)
- `cf13f9c` — fix: stabilna liczba tekstur otwartych światów i testy dostosowane do nowych wymiarów map
- `6dd2395` — e2e: komunikat bez celu to teraz 'Wybierz cel'
- `776d57d` — Merge ccr-b63f9ce9-bu75ez into integration: races, skill trees, 40 monsters
- `e9a6586` — Back up pre-v4 saves under a recovery key before first v4 write
- `38686e1` — e2e: stage3 start position from WORLDS spawn
- `ee09048` — docs: stan na koniec sesji i następny krok dla kolejnego agenta
- `3f3d402` — Merge origin/ccr-b12863e6-qt65bs (CI fixes) into integration
- `b9f1b0f` — docs: PERF-01 (wydajność przed spawnami) i NET-01 (multiplayer) w TASKS
- `0727c45` — docs: usuń listę 20 przeciwników z aneksu (decyzja właściciela 23.10); bestiariusz HTML jedyną kanoniczną listą
- `7f7b32f` — e2e: HUD shows learned skills only (2 at start); pursuit test goal beyond leash plus ranged reach
- `aa152bf` — feat: grafika główna jako tło ekranu ładowania i menu
- `ce72feb` — feat: nick postaci przy tworzeniu (walidacja, zapis, HUD, lista postaci)
- `e0bf1ff` — feat: poziome tła (menu, lista postaci, ładowanie na szerokich ekranach)
- `098aa26` — feat: odznaka diagnostyczna ?ki-debug=1 (renderer, FPS, obiekty, pamięć tekstur)
- `8b3caeb` — feat: odznaka debug pokazuje czas JS na klatkę, DPR, rozmiar płótna i nazwę GPU
- `09f10c4` — perf: wyłącz MSAA płótna WebGL i poproś o wysoką wydajność GPU; odznaka debug udostępnia grę do pomiarów
- `ae0b249` — debug: tryb ?ki-debug=bench mierzy FPS po wyłączaniu warstw; statystyki pieczenia dróg
- `845c559` — perf: ~93% mniej wywołań rysowania (przycinanie postaci spoza widoku, cień jako obraz)
- `f443013` — debug: bench ukrywa obiekty tuż przed rysowaniem (wcześniej gra cofała ukrywanie)
- `ce81ccd` — docs: wynik naprawy wydajności rysowania (59,5 FPS na urządzeniu)
- `5b81817` — docs/data: GAME-01 zatwierdzone; GAME-06: nazwy krain z gry, usunięte nazwy z aneksu
- `a918ad0` — docs: usuń ślady starego bestiariusza; kanoniczny bestiariusz właściciela (40 potworów)
- `9a2a1ff` — docs: define Verdantia city scope and shared integration contract
- `db39b5a` — feat(aetheria): miasto Mędrców — 6 usług w osobnych dzielnicach, drzwi, mieszkańcy, obszar bezpieczny
- `fa0171f` — feat(nexus): miasto Androidów — 6 usług na pierścieniu, drzwi, mieszkańcy, obszar bezpieczny
- `3f11ec0` — feat(pyra): miasto Legend — 6 usług na pierścieniu, drzwi, mieszkańcy, obszar bezpieczny
- `070451f` — feat: build Verdantia city with enterable services and personal depot
- `07e4f78` — docs: analiza gry i zbiorcza lista zleceń na GPU (GPU-BACKLOG-2026-10-23)
- `9eede2e` — merge: miasto Verdantii i wspólne mechaniki miast (Codex)
- `9948503` — merge: miasto aetheria (dane, układ)
- `3b28508` — merge: miasto nexus (dane, układ)
- `b513f2a` — merge: miasto pyra (dane, układ)
- `90ed2df` — fix: dane miast jako cityPlan (city włącza tryb bez walki u Codexa); formatowanie
- `5bb495c` — docs: lista GPU po scaleniu z gałęzią Codexa (wnętrza, wiązania importera, Verdantia)
- `3d4849b` — feat: miasta jako strefa bezpieczna w kontynencie z walką (city.bounds); trzy miasta podłączone do mechanik
- `1580cbd` — docs: add 89-page adventure campaign and equipment design book
- `d0bfc2c` — test(e2e): filtry etapu miasta po isCityStage (pre-gpu, hero-lifecycle)
- `6ec2cf1` — docs: place adventure book PDF in project root
- `927146f` — Merge remote-tracking branch 'origin/main' into docs/documentation-consolidation-20261023

## Dowody

- [verdantia-city-20261023](qa/verdantia-city-20261023/)

Baza segregacji: `927146f4e5d84ed1b71cd1a732d4f9efd430615c`. Starsze liczby testów dotyczą ich własnych SHA, nie aktualnej głowy.

## Wyniki kontroli segregacji

- Kontrola dokumentacji: PASS — 10 tematów, 5 dzienników, poprawne lokalne linki,
  235 dowodów zachowuje bajty, 346 chronionych źródeł i materiałów prawnych bez zmian.
- Pełny TypeScript aplikacji/e2e/tools: PASS. `assets:check`: PASS.
- Generator bestiariusza: 40 rekordów w istniejącym temacie, bez nowego pliku.
- Generator licencji: 731 ścieżek i 40 nierozstrzygnięć zachowane, bez nowych dokumentów.
- Odtworzenie i kontrola księgi: PASS, nadal 89 stron, identyczny PDF v1.
- Historyczny audyt licencji: nadal FAIL na istniejącej wcześniej zmianie
  `src/assets/planet-map/atlas-1920.webp` względem starej bazy. To nie jest
  zmiana atlasu przez segregację ani nowa opinia o prawach.
- Nie uruchamiano regresji przeglądarkowej — nie zmieniono symulacji, interfejsu gry
  ani produkcji; narzędzia benchmarku mają nową ścieżkę wyjścia raportów.
- [Logi kontroli](qa/documentation/).


## Środowisko CPU i pierwszy generator świata

- Osobna gałąź `feature/cpu-worldgen-20261023`. Narzędzia w `scripts/worldgen/`;
  brak zmian runtime gry, map produkcyjnych, zapisów i prywatnego `/test`.
- Po udostępnieniu Jupytera przez właściciela zainstalowano izolowane środowisko
  w `/workspace/ki-legends-worldgen`: Python 3.12.15, NumPy 2.2.6,
  SciPy 1.15.3, Pillow 11.3.0. CPU 8 vCPU, RAM 32 GB, wolumin 500 GB.
- Instalacja 107,49 s; 8 wariantów w 2,263 s; większa mapa 45 056 × 28 672
  w 5,386 s. To propozycje danych świata, nie ukończona integracja ani grafika.
- Każdy wariant zachowuje źródłową Verdantię, dodaje 3 propozycje osad/18 budynków,
  ma 24 dostępne wejścia, 180 zasobów i 2500 dekoracji. Brak spawnów walki.
- Testy generatora: 7/7 lokalnie i 7/7 na podzie. Pełny TypeScript: PASS.
  Build: PASS. Lint: PASS z 9 istniejącymi ostrzeżeniami React.
  Przeglądarkowej regresji nie uruchamiano dla niezależnych narzędzi offline.
- Kopię 9 wyników pobrano poza pod; zweryfikowano sumę archiwum i wszystkie
  pliki z 9 manifestów. [Dowody](qa/worldgen/),
  [kopia źródeł i wyników](../../../deliveries/worldgen-20261023/).
- Nie wykonywano operacji cyklu życia poda, scalenia ani publikacji.
  Otwarte: inne kontynenty, odbiór układu/grafiki, integracja, migracje i testy gry.


## Cała Superior i osobny przebieg spawnów

- Właściciel rozszerzył zlecenie na cztery kontynenty, sześć wysp, wszystkie krainy,
  drogi/ścieżki, ukryte miejsca i labirynty; spawny mają osobny przebieg.
  Zaktualizowano zasadę etapu w AGENTS i tematach zamiast pozostawienia sprzecznej blokady.
- Generator zachowuje kanoniczne obrysy, skalę 0,5, pozycje stolic i wysp.
  Błędne tekstowe 145°E dla Nexusa poprawiono na 151°E zgodne z dotychczasowym JSON;
  żaden plik geometrii planety, atlasu ani miasta runtime nie został zmieniony.
- Pod CPU: teren 10/10 PASS w 11,190 s; osobna generacja spawnów 10/10 PASS
  w 18,739 s przy 8 workerach. 6062 spawny zewnętrzne, 2220 we wnętrzach, 40/40 rodzajów.
- 22 główne osady, 583 wejścia, 472 lokacje, 194 ukryte miejsca, 1699 odcinków
  dróg i ścieżek, 152 rozwiązywalne wnętrza, 6511 zasobów, 271 531 obiektów,
  w tym 32 936 z footprintami. Bezpieczne osady i dojścia wykluczają spawny.
- Dwa zestawy po 7 testów lokalnie i na podzie: PASS. Kontrole dotykają również
  uszkodzeń manifestów, zmienionej geometrii, pochodzenia i rozdzielenia spawnów.
- Powstał samodzielny podgląd map/labiryntów ze spawnami; działa z CSP Jupytera
  bez zmiany zabezpieczeń serwera. Przeglądarkowy smoke obejmuje 10 lądów i kontrolki.
- [Kopia źródeł i całości poza podem](../../../deliveries/superior-world-20261023/),
  [raporty, minimapy i manifest kopii](qa/superior-world/).
- Python tworzy dane JSON/PNG/NPZ; obecny Phaser/TypeScript nie ładuje ich automatycznie.
  Pozostało podłączenie formatu terenu/chunków, podróży, wnętrz, usług i AI do gry,
  migracje, docelowa grafika i pełny odbiór runtime. Nie ogłoszono grywalnego wdrożenia.
- Pełny TypeScript: PASS; Vitest: 302/302 PASS (35 plików); assets: PASS; lint: 0 błędów,
  9 istniejących ostrzeżeń. Podgląd końcowego archiwum: PASS w symulowanym CSP Jupytera.
- Bez zmian cyklu życia poda, produkcji, scalenia i publikacji.
