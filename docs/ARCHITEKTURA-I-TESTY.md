# KI Legends — architektura i testy

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
