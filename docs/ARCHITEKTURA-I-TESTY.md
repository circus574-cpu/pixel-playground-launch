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
