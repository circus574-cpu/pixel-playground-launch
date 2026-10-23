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


## Kopia etapu CPU na GitHub — polecenie właściciela

- Gałąź `feature/cpu-game-content-20261023`, baza `79d5627`. Zapisano wszystkie
  dotychczasowe zmiany źródeł, testów, dane dostawy i raporty, także nieukończone
  rozszerzenia zakresów balansu i botów. Bez sekretów, cache Pythona i zależności.
- Archiwum `deliveries/cpu-game-content-20261023/cpu-game-content.tar.gz`:
  12 609 488 bajtów, SHA-256
  `88c49a9d8f574ab5a530924594a08f1cfca6a04d1c9a493911c14a252a88a35b`.
  Źródła poprzedniego zakończonego przebiegu pozostają obok jako `source.tar.gz`.
- Dane: konwersja 10 lądów, 10 000 par tras, 144 trasy rzeczywistego nawigatora
  i 14 000 porównań kolizji; wstępny balans 22 272 walk; 456 pięter,
  6384 osobne spawny lochów; 948 mieszkańców i 12 karawan.
- Moduły TS: loader zweryfikowanego JSON i 12 chunków cache, nawigacja terenu,
  klucze/bramy/skrzynie i harmonogramy mieszkańców. Scena Phaser nie jest podłączona.
- Zapisano wynik pełnej próby Playwright: 85 PASS / 20 FAIL, w tym odmowy połączenia
  z serwerem aplikacyjnym na 4176. To nie jest pozytywny odbiór wydania.
- Próby botów i proponowanych przeciwników zachowano jako niepełne, bez deklaracji
  zamknięcia balansu 1–20/20–40. Stan szczegółowy: [checkpoint](qa/cpu-game-content/checkpoint-status.json).
- Brak scalenia, publikacji i operacji cyklu życia poda. Wstrzymanie prac nad
  grafiką do dostawy Claude'a pozostaje w mocy.
- Kontrole kopii: pełny TypeScript PASS, Vitest 310/310 (36 plików) PASS;
  dokumentacja PASS (10 tematów, 5 dzienników, niezmienione chronione dowody).


## Partia 1 Claude'a i pierwsze przypisanie grafik świata CPU

- Pobrano `assets/world-kit-for-codex-20261023`, commit `fd2597e`, i połączono
  z gałęzią CPU (`6b9f201`); wynik od razu wysłano na GitHub. Nie pobierano
  `feat/continent-worlds`, zmian kontynentów ani kuźni z drugiej gałęzi Claude'a.
- 10 nowych paczek / 138 części. Katalog: 194 obiekty i 31 powierzchni; wszystkie
  nowe części mają placement, 17 starszych wpisów go nie ma. Oryginalny opis
  dostawy i JSON zachowano w [dowodach](qa/world-kit-intake/). Aktualne reguły
  włączono do GPU-I-ZASOBY, zachowując dokładnie 10 dokumentów tematycznych.
- Eksporter ustala teraz zainstalowane paczki z bieżącego checkoutu; usunięto
  fałszywą deklarację zainstalowanej kuźni i stare stałe o oczekujących paczkach.
- Nowy generator `bind_world_art.py` utworzył na podzie CPU osobną warstwę
  prezentacji: 10 lądów, 271 531 dekoracji, 583 budynki, 6511 zasobów i 152 wejścia
  do lochów, w 1451 chunkach. Użyto 58 wiązań. Pozostałe zasoby pozostają dostępne.
- Sprawdzono 1561 plików źródłowych przed i po składaniu, bez zmiany geometrii.
  Niezależne złożenie lokalne i CPU dało identyczne bajty wszystkich 1463 plików
  manifestu dostawy. `check_world_art.py` weryfikuje fizyczne położenie dekoracji,
  ich solid/footprint i drzwi budynków względem źródła.
- [Kopia wyniku CPU poza podem](../../../deliveries/world-art-20261023-batch1/world-art.tar.gz):
  4 075 916 bajtów; SHA-256 `72588c0606d1b5074302eedc1acb05364c476a62f11ddbb453b7f9af5ff4f1c6`.
- Kontrole: pełny TypeScript PASS; Vitest 310/310 (36 plików) PASS; assets PASS;
  lint 0 błędów / 9 istniejących ostrzeżeń; build PASS. Logi w dowodach dostawy.
  Nie powtarzano pełnej regresji przeglądarkowej: ten etap dodał dane i narzędzia
  offline, bez podłączenia ich do sceny. Poprzedni wynik 85/105 pozostaje otwarty.
- To przypisania prezentacji do danych, nie gotowa scena Phaser. Otwarte: streaming
  grafiki, podłączenie runtime, ocena wizualnych drzwi, grafiki aktorów, telefon i prawa.
  Bez scalenia do main, publikacji i zmian cyklu życia poda.


## Zabezpieczenie CPU przed wyłączeniem przez właściciela

- Zakres: wyłącznie pod CPU `z0cd3m8oppqdyv`. Nie dotyczy A100 Claude'a ani partii 2.
- [Pełna kopia projektu CPU](../../../deliveries/cpu-shutdown-20261023/):
  wszystkie warianty wyników (także niepełne), źródła i narzędzia app, source-history,
  incoming, poprzednie archiwa, logi, metadane środowiska i wersje zależności.
- 19 199 plików / 308 632 922 bajty źródeł. Archiwum 165 780 899 bajtów,
  podzielone na 8 części; SHA-256 całości:
  `296faa6a1878d912d3a4ce23ca26ddc67b2b1438f9bd14bfe22a67eb27986b1e`.
- Pobrano wszystkie części, sprawdzono ich SHA-256 i odtworzono cały projekt poza
  podem narzędziem `restore.py`. [Kontrola](qa/cpu-shutdown/restore-verification.json):
  19 199/19 199 plików z identycznymi bajtami.
- Pominięto odtwarzalne binaria środowiska/runtime, cache i pycache; zachowano
  instalatory, metadane źródeł i wersje. Nie kopiowano konfiguracji logowania, kluczy
  ani sekretów. Nie zmieniano stanu poda. Decyzja o wyłączeniu należy do właściciela.
- Otrzymano informację o streamingu Claude'a `a0d5b2e`. Wybrano do integracji
  tylko zmianę renderowania pobliskich dekoracji i testy, bez innych zmian kontynentów.


## Streaming dekoracji — przeniesienie poprawki Claude'a

- Przeniesiono `sceneryStream.ts` i testy z `a0d5b2e`; dostosowano `renderWorld.ts`
  do tej gałęzi, bez innych zmian renderu kontynentów, nowych cieni i obróbki terenu.
- Indeks komórek 1024; obiekty graficzne powstają blisko widoku, dalekie są usuwane,
  a dispose usuwa pozostałe. Logiczne obiekty/kolizje mapy pozostają bez zmian.
- Cache zapytania zależy od czterech rzeczywistych granic komórek, także wysokości
  widoku, zamiast tylko pozycji i szerokości kamery. Zasięg uwzględnia pełne wymiary
  obiektu, więc obejmuje również kotwice nadpisane przez render binding.
- Testy Claude'a: przy 30 000 wpisów sąsiedztwo zapytania stanowi poniżej 3%;
  żaden widoczny obiekt nie ginie; test budowy indeksu 300 000 wpisów. To testy
  selekcji danych, nie pomiar liczby sprite'ów ani FPS fizycznego telefonu.
- TypeScript PASS; Vitest 313/313 (37 plików) PASS; lint 0 błędów / 9 istniejących
  ostrzeżeń; build PASS. [Logi](qa/scenery-stream/). Pełne testy przeglądarkowe
  końcowego commita mają oddzielny przebieg CI; nie wpisano ich wyniku z góry.
- Nie podłączono jeszcze wygenerowanych lądów do sceny; nie ogłoszono odbioru
  całej planety ani telefonu. Kopia CPU została niezależnie zakończona i wypchnięta
  jako `10248b8`; właściciel otrzymał znak dotyczący wyłącznie poda CPU.


## Partia 2, opcjonalna scena Superior i instalacja bestiariusza

- Osobna gałąź `feature/superior-runtime-20261023`, baza `95e2d2a`; partia 2
  `8b0a814` połączona przez `53a5688`. Katalog: 302 obiekty i 31 powierzchni.
- Dodano publiczny eksport dziesięciu lądów (2996 plików), zweryfikowane JSON,
  teren/chunki i dekoracje blisko kamery, minimapy z obrysów oraz osobny zapis
  `:superior-v1`. Bez migracji i nadpisywania dotychczasowych postaci.
- Podróże zachowują rasę i ekwipunek. Aktywne miasto przełącza drzwi, NPC i rynek;
  depozyt i istniejące usługi używają rzeczywistych przejść, a wnętrza czterech ras
  mają dekoracje partii 2. Geometria i statystyki pozostały kanoniczne.
- Podłączono spawny z osobnej generacji: aktywacja 1400, usypianie 1900, do dwóch
  nowych slotów na klatkę, do 16 korzeni i 24 istot łącznie. Osobna nawigacja
  wyklucza miasta. Zdrowie i śmierć zapisują się z graczem; przejście między chunkami
  nie resetuje odrodzenia. Budżet pamięci może odłożyć dalsze atlasy.
- Poprawiono skalę wzoru podłoża i ponowne pobieranie chunku po szybkim powrocie.
  Rozdzielono pierwszy ekran ładowania od późniejszego doładowywania tekstur;
  poprzednio doładowanie mogło pozostawić nakładkę 100% bez zamknięcia.
- Audyt pierwszego aktywnego katalogu pokazał 40 zastępczych dzików. Właściciel
  wskazał istniejące `deliveries/enemy-*`; skorygowano błędny wniosek o braku grafik.
  Bez nowych renderów zainstalowano komplet 40 paczek w wersji pochodnej 1.0.1.
  Oryginały 1.0.0 zachowane. Zmniejszono wyłącznie puste obszary atlasów:
  1040 → 418,25 MiB całej biblioteki, pobieranej stopniowo, nie naraz.
  Sprawdzono identyczność widocznych pikseli wszystkich 16 640 klatek.
- Wadliwa sosna z sąsiednimi drzewami i ramką pozostaje w źródłach; tymczasowy
  zamiennik to obejrzany dąb. Brakujące animacje mieszkańców i fauny pozostają otwarte.
- Testy obejmują osobny zapis, konflikt kart, podróże i stare sloty, spawny,
  odrodzenie, limit przywołań i bezpieczne osady. Kontrola przypisań: 271 531 pozycji
  i kolizji oraz 583 drzwi bez zmian. Aktualne logi: [QA](qa/superior-runtime/).
- Starszy CI `95e2d2a`: pełna regresja miała trzy błędy (nakładka celu próbowana
  wewnątrz bezpiecznego miasta, oczekiwanie zapisu v4 zamiast v5, trzeci kill Mędrca);
  Software WebGL miał brak zaobserwowanej klatki ataku Mędrca. Nie zaliczono ich
  na podstawie samych testów jednostkowych ani odbioru nowych danych.
- Otwarte: pełna integracja lochów/nagród/zbiorów/życia osad, pełne końcowe CI,
  fizyczny telefon i odbiór artystyczny. Nie scalono do main ani nie opublikowano gry.

- Po zastrzeżeniu właściciela do „kwadratów” rozszerzono oględziny: brzoza,
  paprocie i grzyby również były prostokątnymi wycinkami. Zastąpiono ich przypisania
  poprawnymi pojedynczymi obiektami, zachowując źródła, pozycje i footprinty.
  Podłoże ma spokojniejszy wzór; drogi są rysowane z oryginalnych polilinii
  z zaokrąglonymi narożnikami, zamiast kwadratów maski 32 jednostek. Bez zmiany AI/nawigacji.
- Sprawdzenia kodu przed końcowym CI: pełny TypeScript PASS, Vitest 328/328 PASS,
  assets PASS, kontrola niezmienionej geometrii PASS. Powtórzono mały ekran:
  rzeczywista walka, śmierć potwora i zachowanie odrodzenia po reloadzie PASS.
  Pełne końcowe Canvas/WebGL oraz ocena nowego widoku pozostają do wykonania.

- Checkpoint kodu i kompletu danych wypchnięto jako `557170d` na osobną gałąź.
  Po poprawce kwadratowych wycinków Playwright Canvas wyprawy: **3/3 PASS**
  (10 lądów i zachowanie rasy/zapisów, depozyt, mały ekran z prawdziwą walką
  i zachowaniem czasu odrodzenia). Zrzuty w QA mają status widoku roboczego.
