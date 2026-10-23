# KI Legends — architektura i testy

## Odtworzenie po wyłączeniu poda CPU

[Końcowa kopia](../deliveries/cpu-shutdown-20261023/) zawiera 8 części archiwum,
indeks z SHA-256, manifest 19 199 plików, wersje środowiska i `restore.py`.
Pobrano i próbnie odtworzono całość poza podem; każdy plik przeszedł kontrolę sumy.
Zakres obejmuje wszystkie warianty wyników projektu, źródła, historię narzędzi,
poprzednie archiwa i logi. Python/Node, instalatory i przypięte zależności pozwalają
odtworzyć narzędzia; odtwarzalnych binariów, cache i konfiguracji logowania nie kopiowano.

Po pobraniu całego katalogu dostawy z GitHuba, na Pythonie 3.12 lub nowszym:

```sh
python deliveries/cpu-shutdown-20261023/restore.py --output /nowy/katalog/odtworzenia
```

Katalog docelowy musi być nowy. Narzędzie sprawdza części i całe archiwum przed
rozpakowaniem oraz wszystkie odtworzone pliki. Dane znajdą się w jego podfolderze
`ki-legends-worldgen/`; `restore-environment.json` opisuje wersje środowiska,
a `requirements-restored.txt` zawiera normalizowane wersje pakietów zamiast ścieżki
budowania `file://` zapisanej przez conda w surowym pip freeze.
To kopia danych i narzędzi, nie obraz systemu ani automatyczna instalacja runtime.
Dalsza integracja grafiki nie wymaga tego poda. Ta procedura nie dotyczy A100 Claude'a.

## Kopia prac CPU — 23.10.2026

Gałąź `feature/cpu-game-content-20261023` zawiera dane i kod roboczy kolejnego etapu.
[Archiwum wyników](../deliveries/cpu-game-content-20261023/cpu-game-content.tar.gz)
obejmuje konwersję dziesięciu lądów do JSON/chunków przeglądarki, nawigację,
wstępną symulację balansu, lochy, osobne spawny lochów i życie osad.
[Źródła zakończonego przebiegu](../deliveries/cpu-game-content-20261023/source.tar.gz)
zachowują wersje użyte do tych wyników; bieżące `scripts/worldgen/` zawierają także
późniejsze, niedokończone rozszerzenia balansu i botów. Nie utożsamiać tych wersji.
[Raporty i stan kopii](zmiany/2026-10-23/qa/cpu-game-content/) rozróżniają te etapy.

Konwersja sprawdziła 10 000 par tras; rzeczywisty moduł nawigacji TypeScript
sprawdził 144 trasy i 14 000 porównań kolizji. Dodano opcjonalny teren nawigacji
oraz opcjonalne `world`/`navigation` sesji; domyślne mapy pozostają bez zmian.
Moduły `src/game/world/generated/` zapewniają loader JSON z weryfikacją SHA-256
i cache 12 chunków, nawigację, stan skrzyń/kluczy/bram oraz harmonogramy mieszkańców.
Nie są jeszcze podłączone do sceny Phaser, podróży ani pełnej migracji zapisów.
Paczki gzip z indeksami mają łącznie 5 172 640 bajtów; loader używa obecnie JSON,
nie odczytu zakresów bajtów z tych paczek.

Pełna próba Playwright zakończyła się 85 PASS / 20 FAIL. Log zachowano w QA;
wśród błędów jest brak połączenia z lokalnym serwerem aplikacji na porcie 4176.
Ten checkpoint jest kopią prac, nie zaliczonym odbiorem końcowym ani publikacją.

Stan kodu: 23.10.2026, `d0bfc2c`. Polecenia uruchamiać z katalogu repozytorium.

## Moduły i odpowiedzialności

| Element                  | Źródło                                                                         |
| ------------------------ | ------------------------------------------------------------------------------ |
| Aplikacja, routing i SSR | React 19, TanStack Start, TypeScript, Vite; `src/routes`, `src/components`     |
| Silnik prezentacji       | Phaser 4.2.1; `src/game/mountGame.ts`                                          |
| Lokalna symulacja        | `src/game/session.ts`: ruch, zadania, handel, przedmioty, zapis, miasta        |
| Sloty postaci            | `src/game/characters.ts`, wybór/utworzenie/usunięcie postaci                   |
| Rasy i progresja         | `src/game/kit/`: base, progression, cztery kity, dane generowane               |
| Potwory                  | `src/game/monsters/`: katalog, AI, statusy, materiały i dane generowane        |
| Nawigacja i geometria    | `navigation.ts`, `movement.ts`, `geometry.ts`, footprinty w danych świata      |
| Światy i miasta          | `world/worlds.ts`, `world/regions/*.json`, `city/*`                            |
| Teren i drogi            | `renderWorld.ts`, `renderForest.ts`, `cacheForestTerrain.ts`, `renderRoads.ts` |
| Grafika i importer       | `assets/catalog.ts`, `schema.ts`, `contract.ts`, `imported.json`               |
| HUD                      | `GameHud.tsx`, `AdventurePanels.tsx`, `CityPanels.tsx`, CSS                    |
| Planeta                  | `components/planet-map/`, wspólny `MapaView` i dane obrysów/atlasu             |
| Prywatne szkice          | `/test`, walidowane funkcje serwerowe, odrębna sesja i magazyn                 |

Rozgrywka działa lokalnie; nie ma serwera autorytatywnego, rynku między graczami
ani współdzielonej symulacji. Rozszerzenie do MMORPG wymaga osobnej architektury,
stałego kroku symulacji i wysyłania zmian wyłącznie pobliskich obiektów.
Nie importować GameSession do lekkiej strony `/mapa`; komunikacja idzie przez propsy.

## Zapis, wnętrza i cykl sceny

Zapis v5, odczyt v1/v3/v4, kopie migracyjne i konflikt kart opisuje
[rozwój](ROZWOJ-I-WALKA.md). Scena nie jest źródłem własności przedmiotu:
reguły ekonomii i przejścia kontroluje sesja. Wnętrze używa lokalnej nawigacji;
kamera przestaje śledzić i centruje pomieszczenie, po wyjściu wraca do świata.
Zmiana wnętrza usuwa jego obiekty, a współdzielone tekstury są ponownie używane.
Sprzątanie sceny obejmuje eventy, resize, input, etykiety, komendy i postrender.
Nie kasować zapisu przy błędzie pobrania atlasu; loader ma jawny błąd i retry.

## Uruchomienie i kontrola

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run assets:check
npm run lint
npm run build
```

`typecheck` obejmuje aplikację, `tsconfig.e2e.json` i `tsconfig.tools.json`.
Nie zastępować go skróconym wywołaniem TypeScript. Ostrzeżenia lint raportować
oddzielnie od błędów; nie ogłaszać wykonania testów na podstawie samego kompilowania.

Lokalny playtest: `npm run playtest`. Testy przeglądarkowe:

```sh
npx playwright test
npx playwright test --project=software-webgl
```

`playwright.config.ts` rozdziela gameplay, Software WebGL oraz trasy aplikacji
Canvas/WebGL. Serwer aplikacyjny QA używa `scripts/application-qa.vite.ts`,
wyłącza HMR i osobno rozgrzewa zależności. To usuwa konkurencyjny reload, który
historycznie przerywał nawigację `/test` → `/`; nie osłabia ochrony szkiców.
Nie usuwać asercji, nie ignorować `ERR_ABORTED` i nie dodawać retry jako naprawy źródła.

## Wydajność i obserwacja

`?ki-debug=1`: renderer, FPS, czasy klatek, obiekty i tekstury.
`?ki-debug=bench`: porównanie warstw; ukrywanie musi następować tuż przed rysowaniem,
ponieważ aktualizacja gry może wcześniej przywrócić widoczność.

Po poprawce cullingu kontenerów aktorów i zamianie cienia na obraz odnotowano
23.10 w Aetherii na realme 14T około 59,5 FPS (p95 19 ms), wcześniej 11–17.
To dowód konkretnego pomiaru zapisany w dzienniku, nie gwarancja dla każdego świata,
telefonu i przyszłej liczby potworów. Aktualny pomiar wymaga nowego SHA i sceny.
Budżet katalogu ≤128 MiB nie jest rzeczywistym pomiarem VRAM sterownika.

Teren Verdantii jest cache'owany z danych i cieni pod stopami. Cache nie zawiera
budynków, postaci ani colliderów. Chunking, zwalnianie tekstur i culling obiektów
poza widokiem chronią pamięć. Krzywe drogi/place są prezentacją; kolizje z danych.
Nowe potwory wymagają limitu aktywnych w pobliżu, usypiania dalekich i budżetu efektów.

Benchmark po uruchomieniu lokalnego serwera:

```sh
npm run bench:game
KI_BENCH_WEBGL=1 npm run bench:game
```

Nowe wyniki zapisują się do `docs/zmiany/<data UTC>/qa/benchmark/`;
`KI_QA_OUTPUT_DIR` pozwala wskazać katalog konkretnego przebiegu.
Nie nadpisywać historycznego pomiaru `pre-gpu` nową sesją.

## Odbiór i dowody

CI: `.github/workflows/ki-legends-playwright.yml` i `sage-planetary-webgl.yml`.
Zapisywać dokładny SHA, URL przebiegu, projekt, liczbę testów, artefakty i ograniczenia.
Scenariusze: cztery rasy, ruch/kierunki, walka poza miastem, wejścia/usługi,
depozyt i reload, sloty/migracje, uszkodzony atlas i retry, mapa/globus, zamknięte `/test`.
Przy zmianie bezpiecznych miast testy walki wykonują walkę poza granicą, a test miasta
potwierdza brak wroga; nie przywracać dzików do środka dla starej asercji.

Software WebGL to SwiftShader na CPU. Nie uruchamiać równolegle ciężkich benchmarków,
które zafałszują FPS i timeouty. Canvas nie ocenia jakości sprzętowego WebGL.
Test fizyczny musi podać urządzenie, orientację, scenę, długość, temperaturę/pamięć,
FPS oraz ocenę dotyku/fullscreen. Headless viewport nie jest fizycznym Androidem.

## Dokumentacja i narzędzia

Nowa treść trafia do jednego z 10 tematów, historia do dziennika dnia.
Kontrola limitu/odnośników i zachowanych relokacji:
`python3 scripts/docs/check_documentation.py`.
Księgę odtwarzają `docs/design/adventure-20261023/build_book.py` i `verify_book.py`;
instalacja narzędzi: tamtejszy `requirements.txt`. Nie podłączać `campaign-data.json`
do gry bez osobnego zadania implementacyjnego. PDF v1 i jego pochodzenie pozostają
migawką projektu z 23.10, nie automatycznie aktualnym balansem kodu.

Generator księgi v1 pobiera kanoniczne wejścia z zapisanego commita `5bb495c7bfce`,
więc wymaga tej historii Git w lokalnym klonie. Nowe wydanie księgi powinno otrzymać
własną wersję i jawnie wybraną bazę; nie nadpisywać v1 nowymi danymi ras.

## Generator świata na CPU — propozycje offline

Kod: `scripts/worldgen/`. Działa niezależnie od gry; pierwsza wersja rozwija
kontekst Verdantii, nie generuje jeszcze czterech odrębnych kontynentów.
Zachowuje migawkę zaakceptowanego miasta i dodaje trzy propozycje osad, po sześć
budynków usługowych z wejściami i rolami NPC. Usługi są danymi propozycji;
nie są nowymi działającymi interakcjami w grze. Generuje biomy, rzekę, drogi,
zasoby, dekoracje, schematyczną minimapę oraz chunki NPZ. Bez spawnów walki.

Eksport kontekstu, paczka i instalacja na już działającym Linux x86_64:

```sh
npx tsx scripts/worldgen/export-context.ts /tmp/worldgen-context.json
python3 scripts/worldgen/pack.py --context /tmp/worldgen-context.json --output /tmp/worldgen-source.tar.gz
# Po skopiowaniu bootstrap.py i paczki na serwer:
python3 bootstrap.py --root /workspace/ki-legends-worldgen --bundle worldgen-source.tar.gz
/workspace/ki-legends-worldgen/run-worldgen.sh --output /workspace/ki-legends-worldgen/outputs/my-batch --seed 5741200 --variants 8 --workers 4
```

Instalator tworzy własnego Pythona 3.12 i przypięte zależności NumPy/SciPy/Pillow,
sprawdza sumę micromamby z metadanych dystrybutora i sumy źródeł paczki.
Nie jest to pełny lock tranzytywnych zależności środowiska. Nie zmienia globalnego
Pythona ani cyklu życia poda. Wrapper ogranicza wątki bibliotek do jednego;
budżet generatora wynosi 8 vCPU, domyślny przebieg używa 4 workerów.
`--width`, `--height`, `--cell` określają rozmiar i siatkę; limit to 4 mln komórek.
`--resume` wymaga zgodności kodu, kontekstu, konfiguracji i sum wszystkich wyników.

Instalacja 23.10: pod CPU 8 vCPU / 32 GB RAM, wolumin 500 GB, katalog
`/workspace/ki-legends-worldgen`. Host pokazuje 256 wątków i rozmiar wspólnego
systemu plików; nie są to zasoby przydzielone temu podowi. Pierwsza instalacja
zajęła 107,49 s. Pomiary po instalacji:

| Przebieg | Wynik | Czas ścienny |
| --- | --- | --- |
| 8 wariantów 16 384 × 12 288, 4 workery | 8/8 PASS | 2,263 s |
| 1 wariant 45 056 × 28 672, 1 worker | PASS | 5,386 s |
| Testy niezmienności, nawigacji, seedów, chunków i wznowienia | 7/7 PASS | 1,339 s na podzie |

Czasy dotyczą schematów i eksportu danych, nie gotowego artystycznie świata.
Walidator sprawdza 24 wejścia, rozdzielenie usług, drogi poza przeszkodami,
zasoby poza osadami i zachowanie źródła. Siatka 32 jednostek nie zastępuje
nawigacji Phaser, testów rozgrywki, migracji współrzędnych/zapisów ani odbioru grafiki.
Przed integracją potrzebne są te kontrole i dopracowanie ręczne.

Podgląd na podzie: `outputs/first-batch/index.html` (przez zalogowany Jupyter).
Kopia poza podem: [paczki źródeł i dziewięciu wyników](../deliveries/worldgen-20261023/).
[Raporty i zweryfikowane sumy](zmiany/2026-10-23/qa/worldgen/).
Źródłowy kontekst pierwszych wyników pochodzi z `184a9ec`; manifesty wskazują
sumy kontekstu i algorytmu. Nie nadpisywać wyników nowym eksportem bez nowego katalogu.
Odtwarzanie testów: `KI_WORLDGEN_CONTEXT=/tmp/worldgen-context.json python3 scripts/worldgen/test_generator.py`.


## Pełna planeta i osobna generacja spawnów

Nowszy zakres właściciela obejmuje całą Superior. `planet_generate.py` tworzy
cztery kontynenty i sześć wysp według kanonicznych obrysów i skali, bez uruchamiania
spawnów. Potem osobny `spawn_generate.py` czyta zweryfikowane, niezmieniane dane.
Eksport kontekstu v2 zawiera geometrię planety, źródłowe obrysy, 12 zatwierdzonych
nazw stref, cztery istniejące miasta i katalog 40 przeciwników wraz z zachowaniem.

```sh
npx tsx scripts/worldgen/export-context.ts /tmp/planet-context.json
python3 scripts/worldgen/pack.py --context /tmp/planet-context.json --output /tmp/planet-source.tar.gz
# Po skopiowaniu bootstrap.py i paczki na istniejący serwer:
python3 bootstrap.py --root /workspace/ki-legends-worldgen --bundle /tmp/planet-source.tar.gz
/workspace/ki-legends-worldgen/run-planet.sh --output /workspace/ki-legends-worldgen/outputs/new-superior --workers 8
# Osobna generacja, dopiero po zakończeniu powyższego polecenia:
/workspace/ki-legends-worldgen/run-spawns.sh --world /workspace/ki-legends-worldgen/outputs/new-superior --workers 8
```

Nowy katalog wyjściowy jest wymagany: narzędzia odmawiają nadpisania istniejących
wyników. `--seed` pozwala odtworzyć zawartość; identyczność bajtów wymaga tej samej
wersji źródeł i środowiska. Pierwszy kompletny zestaw używa kontekstu z `6ef331d`.
Pełny końcowy przebieg na podzie 8 vCPU / 32 GB: teren **11,190 s**, osobne spawny
**18,739 s**. Czasy nie obejmują napisania narzędzi, odbioru ani wdrożenia do gry.
Katalog: `/workspace/ki-legends-worldgen/outputs/superior-20261023-v3`.

Wynik: 22 osady usługowe (16 miast na kontynentach i 6 przystani wysp), 583 wejścia,
132 drzwi usług, 472 lokacje, 194 ukryte miejsca, 1699 odcinków dróg/ścieżek,
152 wnętrza ruin/jaskiń/labiryntów, 6511 zasobów i 271 531 dekoracji/obiektów.
32 936 obiektów ma footprint kolizji. Osiągalność celów jest sprawdzana po ich dodaniu;
trasy, wejścia i bezpieczne osady mają wykluczenia na blokującą roślinność.
Spawny: 6062 w terenie i 2220 we wnętrzach, wszystkie 40 rodzajów z katalogu.

**Język i zgodność z silnikiem:** generator jest w Pythonie; eksporter w TypeScript.
Gra używa Phaser/TypeScript. JSON, PNG i identyfikatory bestiariusza są czytelne
przez przeglądarkę, ale pakiet nie jest jeszcze bezpośrednim `WorldDefinition`.
NPZ to format obliczeń CPU, nie format ładowany przez obecny silnik. Wymagane są:
konwersja terenu do formatu przeglądarkowego, loader chunków, nowe identyfikatory
wysp/wnętrz i podróże, migracja współrzędnych oraz integracja usług, odkrywania,
nagród i aktywacji AI. Parametry limitów w JSON nie zastępują implementacji limitów.
Nie przedstawiać tego wyniku jako grywalnego wydania ani pełnej regresji gry.

Podgląd `viewer.html` zawiera dane i minimapy wewnątrz pliku; działa również przy
CSP `sandbox allow-scripts` Jupytera bez luzowania konfiguracji usługi. Wybór lądu,
zoom 1–6, odkrywanie ukrytych miejsc, nakładka spawnów i podgląd rozwiązania labiryntu.
`index.html` jest wersją sieciową; w Jupyter używać `viewer.html`.

Kontrole: `KI_WORLDGEN_CONTEXT=/tmp/planet-context.json python3 scripts/worldgen/test_planet.py`
i istniejące `test_generator.py`. Każdy zestaw ma 7 testów. Wszystkie regiony przechodzą
walidację geometrii i osiągalności, wszystkie wnętrza mają połączenie wejście–wyjście.
Spawn-pass weryfikuje sumy każdego pliku terenu, używa osobnych manifestów i nie
zmienia terenu. Przeglądarkę podglądu sprawdza:
`node scripts/worldgen/check-viewer.mjs http://127.0.0.1:8769/viewer.html`.
Test uwzględnia CSP Jupytera, widoczność podłoża, sekrety, zoom i spawny.

[Kopia źródeł i całego świata poza podem](../deliveries/superior-world-20261023/).
[Raporty, manifest 3906 plików i kontrola kopii](zmiany/2026-10-23/qa/superior-world/).
Nie zmieniono produkcji, map runtime ani zapisów. Podłączenie danych do silnika
jest następnym zakresem implementacyjnym; samo wygenerowanie nie zamyka WORLD-01,
GAME-03 ani PERF-01 dla gry.
