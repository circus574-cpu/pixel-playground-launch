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

Na gałęzi CPU przeniesiono streaming dekoracji Claude'a (`a0d5b2e`), dostosowany
do obecnego renderera regionów. `sceneryStream.ts` indeksuje punkty oparcia w komórkach
1024; `renderWorld.ts` tworzy tylko pobliskie obrazy, usuwa odległe i sprząta przy
dispose. Cache obejmuje wszystkie granice widoku, także zmianę samej wysokości;
margines obejmuje kotwice nadpisane przez binding. Reguły kolizji pozostają w mapie.
Renderer lasu bez `world.terrain` zachowuje dotychczasową ścieżkę — nie używać jej
do masowego włączenia wygenerowanych lądów. Testy indeksu 30 000/300 000 obiektów
nie są pomiarem FPS ani liczby aktywnych sprite'ów na telefonie.
[Kontrole przeniesienia](zmiany/2026-10-23/qa/scenery-stream/): 313 testów jednostkowych,
pełny TypeScript, lint i build. Integracja nowych danych świata pozostaje otwarta.

Benchmark po uruchomieniu lokalnego serwera:

```sh
npm run bench:game
KI_BENCH_WEBGL=1 npm run bench:game
```

Nowe wyniki zapisują się do `docs/zmiany/<data UTC>/qa/benchmark/`;
`KI_QA_OUTPUT_DIR` pozwala wskazać katalog konkretnego przebiegu.
Nie nadpisywać historycznego pomiaru `pre-gpu` nową sesją.

## Konta, zapisy w chmurze i panel administracyjny (26.10.2026)

Decyzja właściciela 26.10.2026: konta graczy i panel administratora/game mastera.
Konto jest opcjonalne; bez logowania gra zapisuje postacie tylko w przeglądarce, jak wcześniej.

- Baza: [docs/db/2026-10-26-accounts.sql](db/2026-10-26-accounts.sql), zastosowana w bazie Lovable Cloud.
  Tabele `profiles`, `user_roles` (`admin`, `gm`), `characters` (kopia kluczy zapisu gry), `admin_audit`.
  Uprawnienia pilnuje RLS: gracz widzi i zmienia tylko swoje wiersze, game master czyta i edytuje
  postacie, tylko administrator nadaje role. Dziennik zapisują wyzwalacze, nie klient.
  Reguły sprawdzono w bazie (transakcja wycofana): cudzy zapis, samonadanie roli i odczyt anonimowy odrzucone.
- Synchronizacja: `src/game/account/cloudSaves.ts`. Pełna (pobranie i wysłanie) tylko bez uruchomionej
  gry: na ekranie startowym i po wyjściu z gry. Podczas gry tylko wysyłanie co 60 s i przy ukryciu karty,
  z kontrolą wersji wiersza. Gdy wersja z chmury wygrywa z lokalną zmianą, lokalny tekst trafia pod
  `ki-legends:recovery:cloud:<klucz>`. Zapisy testowe (`playtest`), preferencje interfejsu i kopie
  odzyskiwania nie są wysyłane.
- Strony: `/konto` (rejestracja z nickiem, logowanie, synchronizacja, wylogowanie) i `/admin`
  (gracze, postacie, role, dziennik zmian, podgląd zawartości gry tylko do odczytu).
- Edycja postaci przez game mastera (`src/game/account/gmEdit.ts`) stosuje reguły wczytywania gry:
  doświadczenie poniżej progu poziomu, poznane umiejętności zgodne z poziomem, przedmioty 0–99,
  założony sprzęt pozostaje w plecaku. Zmiana dociera do gracza przy następnym wejściu do gry;
  edycja w trakcie jego gry wygrywa, a jego postęp od ostatniej synchronizacji trafia do kopii odzyskiwania.
- Pierwszego administratora nadaje się raz poleceniem SQL po rejestracji właściciela.
- Postacie specjalne (`src/game/account/staff.ts`, `StaffTools.tsx`): zalogowany administrator lub
  game master może przy tworzeniu oznaczyć postać jako specjalną. Narzędzia (teleport do miast,
  słynnych i ukrytych miejsc, na współrzędne i do innych krain bez przystani, leczenie,
  nieśmiertelność, poziom, złoto, mikstury) działają tylko, gdy przy wejściu do gry konto nadal ma
  rolę w bazie; game master nie użyje postaci administratora. Gra jest lokalnym PvE, więc
  narzędzia zmieniają wyłącznie zapis tej postaci.
- Nie dotyczy przestrzeni szkiców `/test` (osobna sesja z hasłem) ani multiplayera (NET-01).

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

| Przebieg                                                     | Wynik    | Czas ścienny      |
| ------------------------------------------------------------ | -------- | ----------------- |
| 8 wariantów 16 384 × 12 288, 4 workery                       | 8/8 PASS | 2,263 s           |
| 1 wariant 45 056 × 28 672, 1 worker                          | PASS     | 5,386 s           |
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

## Domyślny świat Superior

Uruchomienie: `npm run playtest`, następnie `/scripts/playtest.html`.
Adapter `superiorRuntime.ts` podaje własny `GameSession`, nawigację i renderer;
jest jedyną ścieżką uruchomienia gry w `Index`. `renderSuperior.ts` pobiera
zweryfikowane chunki i trzyma wyłącznie pobliskie obrazy. `spawnStream.ts` steruje
slotami AI. `superiorSave.ts` zapisuje rozszerzone współrzędne i stany spawnów w tym samym slocie, który czyta `superiorCharacters.ts`.
HUD otrzymuje aktywny świat, więc minimapa i plan miasta nie używają starego prostokąta.

Eksport po odtworzeniu zabezpieczonych danych CPU:

```sh
python3 scripts/worldgen/bind_world_art.py --export-input /tmp/art-input.json
python3 scripts/worldgen/bind_world_art.py --input /tmp/art-input.json --world /path/browser --output /tmp/new-art --workers 8
python3 scripts/worldgen/prepare_runtime.py --world /path/browser --art /tmp/new-art --output /tmp/new-runtime
```

Narzędzia wymagają nowego katalogu wyjścia. Publiczny zestaw jest w
`public/game/worlds/superior-v1`; JSON dekoracji jest nieskompresowany na dysku,
aby przezroczysta dekompresja serwera nie psuła weryfikacji SHA pobieranych bajtów.
Serwer może kompresować transport HTTP. NPZ ani narzędzia Pythona nie trafiają do JS.
`index.json` identyfikuje geometrię; zmiana oprawy nie wymusza migracji współrzędnych.

Testy: `superior-save.test.ts`, `superior-spawns.test.ts`, `e2e/superior-world.spec.ts`.
Przeglądarka sprawdza dziesięć transferów i powrót, jeden slot postaci,
rasę, depozyt po przeładowaniu oraz walkę i zapis odrodzenia. Przeciwnicy poza miastem
mogą być aktywni, gdy gracz jest w mieście; warunek bezpieczeństwa dotyczy ich pozycji,
nie pustej tablicy wszystkich aktywnych przeciwników na całym lądzie.
[Dowody i wyniki](zmiany/2026-10-23/qa/superior-runtime/).

## Manga UI/HUD — grafika, implementacja i testy (23.10.2026)

Gałąź robocza: `feat/manga-hud-20261023`, baza `d0bfc2c`.
Polecenie właściciela: zająć się UI/HUD i konkretną grafiką według zaakceptowanej
koncepcji manga/anime; dostarczyć rzeczywiste zrzuty z testów. Zakres obejmuje
React HUD i oprawę wspólnych okien. Nie zmienia świata, aktorów, danych ras,
mechanik walki, schematu zapisu ani usług serwerowych. Nie jest publikacją gry.

### Wykonanie

- Matowa czerń, ciepłe złoto i kość słoniowa, czerwone HP i błękitne KI.
- Portret właściwej rasy z istniejącego `origins-v1`; kadrowanie w CSS, bez
  generowania nowych projektów postaci. Poziom, nazwa, HP, KI, XP, zasób rasowy
  i efekty pochodzą wyłącznie z aktualnego stanu gry.
- Stała dolna nawigacja: Ekwipunek, Zadania, Umiejętności, Ustawienia.
- Okrągłe przyciski walki z osobnymi stronami poznanych technik (po dwa pełne przyciski).
  Podstawowy atak i mikstura pozostają stale dostępne, także przy wielu technikach.
  Nawigacja stron ma przyciski 44 × 44 px i licznik; nie pokazuje fragmentów kolejnej ikony.
  Zachowane komendy, koszty, odnowienia, blokady i skróty klawiatury.
- Osobny panel Widok: oddalenie, przybliżenie, reset kamery, pełny ekran, czat.
- Zwarte okna usług miejskich, ekwipunku, dialogów i umiejętności z tą samą oprawą.
  Drzewko zachowuje istniejącą strukturę oraz dane 29 węzłów; nie udaje nowego
  systemu rozwoju. Ruch nadal odbywa się istniejącym kliknięciem/dotykiem mapy.
- Przyciski dotykowe minimum 44 px, bez zewnętrznych fontów i dodatkowych bibliotek.
  Oprawa końcowa w `manga-hud.css`, po dotychczasowych stylach; ikony przedmiotów
  zachowują oryginalny atlas i współrzędne 3 × 3.

### Grafika i pochodzenie

Nowy zasób: `public/game/assets/hud-manga-v1/icons.png`.
Wygenerowany narzędziem wbudowanym imagegen w tej sesji, na polecenie właściciela;
bez zewnętrznej płatnej usługi. Narzędzie nie podało identyfikatora modelu.
Nie deklarujemy odrębnego audytu prawnego grafiki. Portrety pochodzą z istniejących
zasobów projektu, a ich dotychczasowy status praw pozostaje w rejestrze licencji.

PNG RGBA 1448 × 1086, siatka 4 × 3, komórki dokładnie 362 × 362.
Alpha 0–255, SHA-256:
`094a183f236c82ab22c1d37af15d0a415874c6d081f811b5e73f8d0107418e0f`.
Ikony są dekoracją istniejących przycisków HTML; nie zastępują etykiet dostępności.

| Rząd | 1          | 2      | 3        | 4            |
| ---- | ---------- | ------ | -------- | ------------ |
| 1    | Atak       | Cięcie | Energia  | Tarcza       |
| 2    | Mikstura   | Plecak | Dziennik | Umiejętności |
| 3    | Ustawienia | Mapa   | Rozmowa  | Wyjście      |

#### Pełny prompt generowania

> Use case: stylized-concept. Asset type: production game HUD icon sprite atlas for KI Legends manga anime action RPG. Generate ONE transparent PNG atlas, exactly 4 columns by 3 rows, aspect ratio 4:3, square equal cells, each symbol centered in its own cell with generous 15% transparent padding, all symbols same visual scale. No frames around cells, no grid lines, NO text or numbers or lettering. Hand painted premium shonen anime game item illustration, bold black ink contour, warm ivory highlights, burnished antique gold details, expressive angular brush strokes, crisp silhouettes legible at 40 pixels. Contents in exact reading order: row1 col1 crossed ivory steel swords with red handles, col2 dynamic vermilion flame slash, col3 cyan blue KI energy burst, col4 golden defensive shield; row2 col1 round red healing potion glass flask with cork, col2 tan leather adventurer backpack, col3 ivory parchment quest scroll with red seal, col4 powerful red gold flame emblem; row3 col1 antique golden settings cog, col2 gold navigation compass, col3 ivory dialogue speech bubble with three dark dots, col4 open wooden exit door with outward ivory arrow. Each isolated element must fit entirely inside its cell and not touch neighbor. Transparent background true alpha, absolutely no opaque white or checkerboard background, no external shadow spilling between cells. The result will be used directly with CSS sprite coordinates so regular grid alignment is essential.

### Weryfikacja

Zweryfikowano: 302/302 testy Vitest, pełny TypeScript (app/e2e/tools), build aplikacji,
walidację zasobów przez `node --import tsx scripts/check-game-assets.ts` oraz lint
(0 błędów, 9 wcześniejszych ostrzeżeń w innych plikach). Przebieg 10/10 HUD + manga
zaliczony: siedem układów 360–1280 px, cztery rasy, okna, dotyk, kuźnia i przewijanie
technik. Dodatkowo zaliczono trzy testy miejskie (handel, depozyt/reload, trening)
oraz siedem scenariuszy komunikatów, ustawień, zapisu i śmierci. Nie jest to pełny
przebieg całego repozytorium. Dodatkowa kontrola Software WebGL i komunikatu celu: 5/5 PASS w
`test-results-last` (w tym kontrola celu na sześciu rozdzielczościach oraz zwalniania
zasobów wnętrza w Software WebGL).

W trakcie pracy wykryto przestarzały scenariusz targetowania w bezpiecznym mieście:
QA teraz ustawia zwykły zapis testowy poza jego granicami. Jeden wcześniejszy reload
nie powiódł się podczas równoległej przebudowy katalogu testowego; powtórzenie
wszystkich pięciu testów ustawień/reload bez przebudowy równoległej zaliczone.
Przeglądarkowe zrzuty pokazują rzeczywisty build lokalny, nie ilustrację koncepcyjną.
Emulacja dotyku i rozdzielczości nie zastępuje testu na fizycznym telefonie.

### Poprawka po uwadze o uciętych przyciskach

- Poziomo przewijany pasek pokazywał część kolejnej ikony. Zastąpiono go stronami
  po dwa pełne przyciski, z poprzednią/następną stroną i licznikiem.
- Podpis budynku wychodzący poza widok kamery jest w całości ukrywany, zamiast
  renderować ucięty tekst na brzegu. Zmiana dotyczy wyłącznie prezentacji etykiet;
  nie przesuwa budynków, drzwi ani kolizji.
- Nagłówek i zamknięcie okna pozostają widoczne przy przewijaniu, dodano miejsce
  na końcu listy i margines przewijania przy kartach. Usunięto odziedziczony
  nadmierny odstęp w nagłówkach kart umiejętności.
- Końcowy test geometrii bada rzeczywiste prostokąty przycinania wszystkich
  przodków przycisków na każdej stronie technik; rozdzielczości 320×568, 360×640
  i 852×393. Wymaga pełnych przycisków i pola dotyku minimum 44×44 px.

Wynik poprawki: 13/13 Playwright PASS (7 układów HUD, 2 widoki kuźni, 3 scenariusze
stron technik i 1 scenariusz Software WebGL). Pełny TypeScript i lint zmienionych
plików PASS. Etykiety budynków uwzględniają rzeczywiste prostokąty HUD, w tym menu i przyciski walki;
nie pokazują tekstu częściowo schowanego pod przyciskami. Pomiar układu DOM jest
buforowany na 100 ms, niezależnie od liczby podpisów i klatek renderowania.

Po uwzględnieniu rzeczywistych prostokątów HUD ponowiono cztery dotknięte scenariusze
(komputer i trzy strony technik): 4/4 PASS; pełny TypeScript PASS.

## Oddzielny panel Coder w /admin (27.10.2026)

Integracja źródła `coder@fb2abfa52679ecaa1575b58440e548cf91da0b81` zachowuje dotychczasowy
`/admin` (Gracze, Dziennik zmian, Zawartość gry, domyślnie Gracze). Nowa zakładka
`Coder · Edytor świata` ładuje osobny `CoderAdminPanel` przez React.lazy. Współdzieli
istniejący useAccount, sesję oraz role admin/gm; nie wymaga drugiego logowania.
Style nowego panelu są zamknięte w `@scope (.ki-coder-panel)`; account.css i stary StaffTools
pozostały nietknięte. Nie zmieniono klienta Supabase, schematu DB ani RLS.

Edytor świata, rozszerzony edytor postaci lokalnych/chmurowych i narzędzia eksportu/importu
pochodzą z gałęzi coder. Nadpisania świata są lokalne, pod kluczem
`ki-legends:admin-world-overrides-v1`; nie oznacza to publikacji zmian dla wszystkich graczy.
Runtime nakłada je przy przygotowaniu świata, a domyślne spawny pozostają bez zmian,
gdy nie zapisano własnych spawnów. Nie przeniesiono zastępującego stare UI StaffTools.
Testy pominięto na wyraźne polecenie właściciela; nie deklarować sprawdzenia przeglądarkowego.

### Mapa świata w edytorze Coder

`AdminWorldMap` jest osobną, leniwie ładowaną zakładką. Korzysta z atlasu v2,
`worldOverlay.v2.json` i tego samego `worldToAtlas` co mapa gry. Pokazuje wszystkie
10 lądów, 1690 dróg/ścieżek z overlay, bazowe spawny z publicznych spawns.json oraz
lokalne nadpisania Coder. Warstwy drogi/spawny/zadania/lokacje mają niezależne checkboxy.
Spawny są jednym SVG path, a nie tysiącami elementów DOM; pobieranie danych ma trzy
równoległe workery, anulowanie przy zamknięciu i ponowienie po błędzie.

Questy są czytane z istniejącego katalogu: znacznik zleceniodawcy to centrum przypisanego
miasta v2 (jawnie opisane), cele lokalizacyjne wykorzystują mapowanie v2Places i runtime
locations. Po wyborze zadania podświetlane są spawny jego gatunków celów walki.
Celom bez przypisania nie dopisuje się arbitralnych współrzędnych starego świata.
Nie jest to śledzenie aktualnych żywych potworów ani postępu questów konta.
Widok jest tylko odczytem: przełączniki nie usuwają spawnów ani dróg i nie zmieniają gry.

## Przygotowanie i renderowanie mapy w grze — 28.10.2026

`components/planet-map/preload.ts` przygotowuje mapę podczas rzeczywistego ekranu
ładowania gry (komunikat „Przygotowywanie mapy świata i globusa…”). Wczytuje moduły
mapy i globusa, atlas 1920/3840, tło, wspólne dane dróg/lokacji i szczegółowy obraz
aktualnego lądu. `preloadGlobeTextures` przygotowuje obrazy w cache loadera Three,
a także tablice pozycji dróg/miast. Nie tworzy dodatkowego kontekstu WebGL i nie
kompiluje shaderów przed otwarciem globusa. Mapy pozostałych lądów są doczytywane
na żądanie; cache szczegółowych obrazów utrzymuje najwyżej dwa wpisy.

Koszt pobrania i dekodowania przeniesiono na start zgodnie z decyzją właściciela.
Awaria opcjonalnej mapy nie blokuje PvE: błędy są izolowane, przygotowanie ma limit
12 sekund, a nieudane pobrania można ponowić przy otwieraniu mapy. To limit czasu
oczekiwania, nie sztuczne opóźnienie ani procent całej inicjalizacji.

`WorldOverlay` rysuje widoczne fragmenty szczegółowego terenu na jednym Canvas 2D
w `foreignObject`, zamiast osobnych zagnieżdżonych SVG/image dla każdego fragmentu.
Korzysta z oryginalnych obrazów, tych samych transformacji afinicznych i wycinania
według widoku; nie zmienia geometrii świata. Rozdzielczość bufora zależy od widoku,
z DPR ograniczonym do 1,5. Nie tworzy ogromnej bitmapy całej planety. Drogi, miejsca,
napisy i trafianie w regiony nadal pozostają w SVG. Spóźnione wyniki poprzedniego
przesunięcia/zoomu nie nadpisują aktualnego widoku.

Panel planety wysyła prezentacyjny `suspendRendering` w istniejącym poleceniu pauzy.
Adapter Phaser usypia pętlę renderowania pod pełnoekranową mapą i budzi ją po
zamknięciu. Pozostałe panele zachowują dotychczasowe renderowanie. Nie zmieniono
zasad walki, sterowania, zapisu ani danych kontynentów. Geometrie/materialy dróg
globusa są zwalniane przy demontażu; tablice współrzędnych można wykorzystać ponownie.

Wyniki i ograniczenia w [dzienniku 28.10](zmiany/2026-10-28/ZMIANY.md).

Cleanup uśpionego adaptera musi po `game.destroy(true)` wywołać `loop.wake()`, jeśli
pętla nie działa. Phaser odkłada faktyczne zniszczenie na początek następnej klatki;
samo żądanie destroy przy uśpieniu pozostawia Canvas i scenę w pamięci. Wznowienie
po żądaniu destroy wykonuje zniszczenie, zanim rozpocznie kolejną symulację. Regresję
kontroluje `e2e/superior-world.spec.ts`: dokładnie jeden Canvas przy każdym z 10 lądów.

## Niezależny audyt Coder i regresji — 28.10.2026

Stan kodu `main@30f7b8d5`. W `src/components/admin/AdminWorldMap.tsx` białe znaczniki z `projection.places` są renderowane, ale obsługa `onPointerUp` składa `candidates` tylko z `shownMarkers`, `combatPoints` i `spawns`. **ŚREDNI, ODRZUCONE (ścieżka kodu):** nie da się uzyskać szczegółów samodzielnego miasta/lokacji przez kliknięcie po wyłączeniu innych warstw. Wymagana obsługa miejsc w selekcji i test E2E; wniosek statyczny, bez własnego odtworzenia w przeglądarce.

Odczyt GitHub Actions dla `a4ee855e`, PR #52: [WebGL run 40653403301](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40653403301) — **FAILURE, 7 testów niezaliczonych**, w tym `combat-skills.spec.ts` (Mędrcy, Androidzi), `combat-v3.spec.ts` (Mędrcy, Androidzi) oraz trzy przypadki cyklu życia. Wspólny punkt zatrzymania: `e2e/fixtures.ts:223`, `liveEnemy`, `Expected: true / Received: false`, timeout 60 s. Nie rozstrzyga to, czy błąd pochodzi ze spawnów, AI, inicjalizacji świata czy fixture. [Pełny QA 40653403311](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40653403311) był w toku w momencie odczytu.

Oddzielny [Playwright 40595421144](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40595421144) na PR #49: 182 PASS / 1 FAIL w scenariuszu Planetarnego (2 zamiast 3 zabójstw), nie jest dowodem naprawy po PR #52. Mapa produkcyjna ma jedynie ograniczone [2 PASS na viewportcie 390×844](zmiany/2026-10-28/ZMIANY.md), nie zastępujące testu rzeczywistego telefonu ani pełnego PvE.

**Warunek zaliczenia:** wyniki kompletu TS/Vitest/assets/lint/build/Playwright Canvas i WebGL na wskazanym SHA, ślady dla porażek, walidacja uprawnień, zapisów i mapy Coder, bez pomijania asercji. Zewnętrzny dowód produkcyjnego SHA osobno.

## Adapter rozwoju i próby na wypożyczonym profilu — 28.10.2026

`development/training.ts` zawiera reguły treningu, `state.ts` schemat i spójność
księgi nagród, `modifiers.ts` efekty kitów, `exams.ts` cele i odizolowany profil.
`GameSession` jest nadal jedynym silnikiem walki i właścicielem zmiany postaci.
Próba używa osobnej instancji bez `SaveStore`; właściwa scena śpi, zachowując kita,
czas i zasoby. `DevelopmentExam` montuje prawdziwy Phaser, zachowuje istniejący HUD
oraz przywraca właściwą scenę. Pierwszeństwo ma zapis zatwierdzonego wyniku; błąd
zapisu pozostawia możliwość ponowienia lub wyjścia bez nagrody.

`DevelopmentPanel` otwiera się wewnątrz dotychczasowego okna Umiejętności.
Przyciski dojścia najpierw zamykają pauzujące okno, potem wydają istniejące
polecenie interakcji — odwrotna kolejność odrzucałaby nawigację jako akcję w pauzie.
Próby nie mają własnego dostępu do localStorage i nie importują nagród globalnego
`questsV2`. Odbiór 24 nowych rozdziałów, 24 projektów i 48 prób rasowych jest osobny.

Scenariusz `e2e/development.spec.ts` zaczyna nową postacią przez zwykłe UI,
idzie do trenera, przechodzi rzeczywistą trasę wypożyczonego profilu, porównuje
bajty zapisu właściciela i przeładowuje stronę. Nie wstrzykuje flag postępu.
Zdefiniowany dla czterech ras, Canvas i Software WebGL. Wyniki nie wynikają z samej
obecności scenariusza; wykonania i zrzuty znajdują się w dzienniku 28.10.

### Potwierdzony brak miejsca dla potwora w podglądzie v1

Na czystym `3ffd46c7` odtworzono timeout Mędrca w `liveEnemy` bez błędów konsoli.
Zapisano rzeczywiście rezydentne identyfikatory tekstur i telemetryczny odczyt.
Dla **katalogu dobranego do zapisanego URL v1**, po dodaniu oczekiwanego potwora
i rezerwy 20 MiB, estymator wymaga 137,9630126953125 MiB. Stary limit 128 MiB
odmawiał `canAcquire`, zatem przeciwnik nie powstawał. Wstępne oszacowanie
150,47 MiB używało katalogu v2 i nie jest właściwą liczbą dla tego podglądu.

`assets/streamBudget.ts` ustala wspólny limit 192 MiB, identyczny z dotychczasowym
limitem aktualnego świata v2. Nie powiększa limitu v2 i nie zmienia spawnów,
geometrii ani parametrów przeciwnika. Regresyjny test przelicza rzeczywisty zestaw
z przechwyconego śladu na bieżących manifestach; nie podmieniono asercji Playwright
ani nie zmodyfikowano pomocnika `liveEnemy`. To limit szacowanej pamięci tekstur,
a nie pomiar całego RAM ani gwarancja FPS na telefonie.

`examRuntime.ts` jest osobnym adapterem prezentacji. Czysty `ExamAttempt` i sesja
nie importują katalogu graficznego. Sala ładuje tylko atlasy aktualnego bohatera,
UI i właściwe efekty — testy dla każdej rasy sprawdzają pułap poniżej 64 MiB
zadeklarowanych tekstur i brak kopii miejskich budynków/przyrody. Oryginalna scena
pozostaje w pamięci; szczytowe zużycie na fizycznym telefonie wymaga osobnego pomiaru.


### Runtime dziedzictwa — kontrakty kolejnego checkpointu PR #55

- `development/heritage/types.ts`, `goals.ts`, `catalog.ts`: jawny graf 24 rozdziałów
  i 24 projektów; test sprawdza cykle, przepisy, źródła części i budżet tabel.
- `state.ts` oraz nadrzędny `development/state.ts`: ścisły stan, migracja v1 → v2,
  historia celów/zgód, ograniczone 64 surowe zdarzenia i trwałe biznesowe pokwitowania.
- `reducer.ts`: czysty wynik czynności. UI nie może przesłać „zaliczono eskortę”,
  „zobaczono potwora” albo „trafiono”; te źródła potrzebują dowodu runtime.
- `runtime.ts`: fizyczne warunki, routing do stolicy, cały kandydat Player i CAS.
  `equipment.ts` rozdziela ATK osobistej broni od starego miecza/upgrade.
- `projects.ts`, `Navigation.setLocalObstacles`: lokalna nakładka kolizji, bez mutacji
  współdzielonych danych wygenerowanej planety. `render.ts`: culling i zwalnianie
  markerów/technicznych konstrukcji; minimapy dostają tylko aktualne ukończone projekty.
- `development/targets.ts`, `heritage/restraint.ts`: cele w pamięci, realny port kita
  i pociski, okna zatrzymania i poddanie; po śmierci/zmianie wnętrza są czyszczone.
- `HeritagePanel` i `HeritageWeaponCard`: wewnątrz dotychczasowych okien; brak zmiany
  joysticka, przypisań, pozycji HUD, kamery, hostingu i prywatnego `/test`.

Regresja Pyry: `SuperiorSaveStore` sprawdza wymiary `cityRoom(interior, affinity)`,
a nie stałe 960 × 760. Kuźnia Pyry ma 540 × 1100; jej poprawny zapis z y=900
musi się wczytywać. Testy obejmują też błędne współrzędne i zachowanie oryginału.
`e2e/development-heritage.spec.ts` nie ustawia flag postępu: zaczyna nową postacią,
kończy stary prolog przez UI, idzie do kolejnych obiektów, wybiera odpowiedzi,
wykonuje procedurę, odbiera broń, zakłada ją i odświeża. Wyniki na poszczególnych
migawkach oraz niezależnie czerwone CI zapisano w dzienniku, bez uśredniania do PASS.


### Lokalne pomiary instalacji i zasięg zwykłego ataku (PR #55, 28.10)

`heritage/scanner.ts` jest odczytowym kontrolerem w pamięci sesji. Skaner wymaga
Androida i faktycznie podłączonego `mn-scanner`, istniejącego rozpoczętego projektu,
tej samej przestrzeni i LOS. Lista obejmuje wyłącznie znane instalacje do 650 j.,
odczyt wymaga interakcji do 130 j. Oddalenie, przeszkoda, śmierć, odłączenie modułu,
zmiana postępu i ponowne uruchomienie unieważniają wynik. Nie zapisuje odkryć,
nie przyznaje praktyki i nie zwiększa HP/KI. Panel znajduje się wewnątrz istniejącego
Dziedzictwa, bez zmiany HUD lub sterowania. Test integracyjny najpierw legalnie
kończy H-N01, odbiera skaner i podłącza go istniejącym poleceniem warsztatu.

`Kit.basicRange` oddziela zasięg zwykłego strzału od `stats.range` stosowanego przez
pozostałe umiejętności. Ten sam odczyt używają strzał Androida, gotowość celu w HUD,
rozpoczęcie istniejącego autoataku i podgląd statystyk. Optyka nadal nie wydłuża A1/B1/C1;
pozostałe rasy mają niezmieniony zasięg. Nie dodano nowego rodzaju autoataku.


`heritage/escort.ts`: stabilne krótkie odcinki przez istniejące `Navigation.path/step`,
sprawdzenie osiągalności, cache tras per sesja, prędkość spokojnej dostawy 100 j./s
(bohater bazowo szybszy), krok najwyżej 100 ms jak istniejący ruch. Aktor ma
oddzielną prezentację w `HeritageMarkers`, istniejące idle/walk NPC, culling i
sprzątanie. Nie jest wrogim `Foe`, nie uczestniczy w nagradzanych zabójstwach.
Punkt kontrolny pochodzi z należącego do runtime kontrolera, wymaga kolejnego numeru,
właściciela, aktualnej pozycji i LOS. Udany CAS dopiero podnosi licznik; nieudany
zostawia NPC przy punkcie do ponowienia. Zapis używa istniejącego pola celu
`sequence` i nie dodaje nowej wersji koperty ani osobnego storage. Nieprawidłowy
licznik aktywnej eskorty jest odrzucany bez nadpisywania bajtów.

`e2e/heritage-delivery.spec.ts` zaczyna nowym Planetarnym, wykonuje prolog, H-V01,
P-V1, H-V02, odświeża po pierwszym punkcie dostawy i sprawdza broń drugiego stopnia.
Odczytuje zapis do asercji, ale nie wpisuje flag, statystyk ani pozycji. Scenariusz
jest podłączony do obu istniejących rendererów; wynik musi być zapisany po wykonaniu.


Regresja dostawy zatrzymuje helper po **jednym** odcinku: wielofazowe dojście do
budynku mogło automatycznie podążać za kolejnymi zmieniającymi się waypointami i
skończyć przy następnym zadaniu, fałszywie porównując jego licznik z licznikiem
eskorty. Test potwierdza numer etapu i punktu przed reloadem. Dowody i wcześniejsza
porażka są w dzienniku 28.10; asercji nie osłabiono.
`development-mobile.spec.ts` sprawdza dotykowe zakładki i rzeczywisty ruch po
zamknięciu panelu dla czterech ras. W pionie Superior pokazuje istniejący ekran
obrotu; test odtwarza obrót, nie obchodzi blokady. Osiem przypadków Canvas przeszło
na grze `924ff66f`. To nie dowód pracy na fizycznym telefonie.


### Odbiorcy obrażeń poza graczem — partia zamykająca 28.10

`monsters/receivers.ts` definiuje `MonsterReceiver`. Istniejący `MonsterSystem`
obsługuje do ośmiu jawnie zarejestrowanych, żywych odbiorców; odrzuca duplikaty
identyfikatorów i ciał, alias gracza oraz nieprawidłowe HP/pozycje. Cel wybierany
jest jawnie, bez zmiany sterowania. Rozpoczęty windup/pocisk zachowuje odbiorcę;
wyrejestrowanie unieważnia kontakt i odsyła skupionych wrogów. Strefy i AoE
rozliczają odbiorców raz, zachowując jeden mnożnik ataku. Cleanup usuwa rejestracje.

`development/heritage/protectedActor.ts` to fundament przyjaznego ciała z własnym
HP, DEF i istniejącym `PlayerFx`, rzeczywistym DOT i ruchem pull przez nawigację.
Nie pożycza tarcz gracza, nie przyznaje XP i nie resetuje jego zasobów.
**Runtime zadań jeszcze go nie tworzy: bojowe eskorty i cele ochrony NIE są gotowe.**
Polskie etykiety statusów przeniesiono bez zmiany znaczenia do `monsters/fx.ts`.
Zachowano dotychczasowe taktowanie FX na granicy miasta: sprawdzenie bezpieczeństwa
nie może zatrzymywać zegara pulsu gracza. Odtworzony błąd zegara i jego regresja
są w [dzienniku](zmiany/2026-10-28/ZMIANY.md#zamknięcie-partii--odbiorcy-obrażeń-i-dowody-qa).
Nie zmieniono HUD, inputu, atlasów, geometrii, kanonicznych statystyk ani formatów zapisu.
