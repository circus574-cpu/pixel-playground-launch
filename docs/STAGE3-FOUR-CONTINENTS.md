# KI LEGENDS — etap 3: cztery pochodzenia i regiony startowe

Data: 20.10.2026. Gra lokalna PvE, Phaser **4.2.1**, TypeScript, React 19,
TanStack Start, Vite, istniejący hosting Lovable. Brak kont, serwera autorytatywnego,
synchronizacji graczy i trwałej bazy postaci. Ten etap nie deklaruje pełnego MMO.

## Audyt i zamknięcie 2.1

Przed pracą sprawdzono zdalny main: `33c687497deba5ddf83d2f00010aa05cba1dea4e`.
Nie był nowszy od wskazanego przez użytkownika. Przeczytano instrukcje repozytorium,
raport QA etapu 2, cały załączony PDF (12 stron) i obejrzano wszystkie ilustracje.
Starsza tabela ras Human/Orc/Dwarf/Elf z PRODUCTION.md została zastąpiona aktualnym
poleceniem użytkownika: Planetarni/Mędrcy/Androidy/Legendy. Zachowano istniejącą wioskę.

Bazowe 45 testów i pełny TypeScript przeszły. Przeglądarka rzeczywiście wykonała
Aira → przyjęcie → widoczny przycisk marszu → rynek → powrót → 40 XP, bez błędów konsoli.
Nie potwierdzono usterki samouczka; pierwszy timeout wolnego renderera nie był podstawą poprawki.
Szczegóły w `QA-STAGE21-2026-10-20.md`.

Późniejsze QA potwierdziło usterkę joysticka: dotyk nad dzikiem w strefie sterowania
wybierał przeciwnika przed rozpoznaniem przeciągnięcia. Teraz tap wykonuje interakcję,
a ruch palca powyżej 10 px rozpoczyna joystick i anuluje autoatak. Test CDP touch,
który wcześniej zawodził w pionie, przechodzi po poprawce. Dodatkowo w 640×480
usunięto nakładanie przycisku rozmowy na pasek umiejętności; dodano regresję prostokątów UI.

## Architektura

- `GameSession` pozostaje wspólnym modelem zasad: ruch, A*, AI, walka, HP/KI/XP,
  zadania, łupy, ekwipunek, handel, ulepszenia, śmierć i odrodzenie.
- `world/types.ts` definiuje kontrakt mapy. `world/worlds.ts` to rejestr czterech światów.
  Definicja zawiera granice, spawn, obiekty, footprinty, przeszkody, NPC, cele eksploracji,
  wrogów i punkty zainteresowania. Logika nie zależy od nazw NPC ani współrzędnych rynku.
- `world/regions/*.json`: trzy osobne, autorskie układy. `forest-map.json` jest zachowany.
- `renderWorld` wybiera format renderowania; `renderForest` zachowuje dotychczasowy atlas
  i warstwy zaakceptowanej mapy. Jedna scena Phaser obsługuje wszystkie regiony.
- `world/assets.ts` to używany manifest zasobów i adapter tożsamości wizualnej.
  `characterVisual.ts` wybiera 4/8 kierunków i klatki arkusza/atlasu niezależnie od pochodzenia.
- `CharacterStore` zarządza slotami; `SaveStore` zachowuje walidację i ochronę przed konfliktem kart.
- React: wybór pochodzenia/lista postaci → `GameScreen` → Phaser. HUD i dialogi używają
  danych wybranego kontynentu. Nie skopiowano silnika ani łańcucha mechanik dla każdej mapy.

## Rasy i kontynenty

| Rasa       | ID          | Kontynent / ID        | Region startowy            | Tożsamość                                                       |
| ---------- | ----------- | --------------------- | -------------------------- | --------------------------------------------------------------- |
| Planetarni | `planetary` | Verdantia / `verdant` | Wioska Początkowa          | Żywa energia, podróżnicy, rzemiosło i ochrona natury            |
| Mędrcy     | `sage`      | Aetheria / `aether`   | Sanktuarium Tysiąca Źródeł | Dyscyplina KI, biblioteki, tarasy, źródła i stare drzewa        |
| Androidy   | `android`   | Nexus-9 / `nexus`     | Węzeł Świadomości          | Syntetyczna energia, laboratoria, reaktor i świadomość maszyn   |
| Legendy    | `legend`    | Pyra / `pyra`         | Twierdza Popiołu           | Honor, klany, arena, kamienne monumenty i wulkaniczne szczeliny |

Wszystkie cztery korzystają **z tego samego ludzkiego sprite'a** `human-v2`.
Brak nowych bonusów rasowych i drzewek zdolności. Energia/kultura w wyborze to kierunek
świata i przyszłej produkcji; nie obietnica wdrożonych zdolności rasowych.

Verdantia ma 3072×2048 jednostek, trzy nowe regiony po 2400×1792.
To kompletne grywalne regiony startowe reprezentujące kontynenty, bez gigantycznych pustych map.
Każdy ma własny spawn, centrum, kolizje, dekoracje, punkty zainteresowania, czterech NPC
oraz cztery pozycje dzików. Ich rozmieszczenie i przebieg szlaków są różne.

NPC: Aira/Ren/Mio/Taro; Sora/Ishin/Mei/Enso; LYRA-7/AXON/MIRA-2/HEF-4;
Kaena/Rokan/Yumi/Goro. Role usług wspólne, nazwy i dialogi lokalne. Łańcuch:
Pierwsze kroki → lokalne polowanie na trzy dziki → Pierwsze wyposażenie.
Cele eksploracji: Rynek, Źródło Pamięci, Rdzeń Świadomości, Arena Dziedzictwa.

## Struktura map i tekstur

`worldObstacles()` łączy przeszkody środowiska z footprintami obiektów. Grafika ma
niezależne width/height/anchor, a kolizja width/height/offsetY w jednostkach świata.
Gracz ma clearance 12 jednostek; zapisane pozycje są sprawdzane przez `Navigation.safe()`.
Odrodzenie korzysta ze spawnu aktualnego świata.

Warstwy: materiał → szlaki → dziedzińce → przeszkody → obiekty sortowane po Y →
postacie → etykiety/HP → efekty i HUD. Obiekty zasłaniające postać blakną.
Kafelki lasu mają culling; obiekty lasu i nowych map także sprawdzają prostokąt kamery.
Nowe podłoża to powtarzalne małe tekstury i kilka tileSprite, bez obrazu całej mapy.

`python3 scripts/build_stage3_worlds.py` odtwarza deterministycznie nowe JSON, 18 obiektów
SVG, 9 materiałów i 3 minimapy. Nie generuje losowej grafiki i nie korzysta z GPU.
Minimapy nowych światów powstają z tej samej geometrii i obiektów co scena.
Nie edytować wygenerowanych JSON bez aktualizacji źródła skryptu.

Ładowane są wyłącznie zasoby sceny danego świata oraz współdzielony bohater, dzik i UI.
Powrót do wyboru zapisuje stan, usuwa listenery i niszczy instancję Phaser wraz z teksturami.
Test przełączeń potwierdza brak pozostawionych canvasów i jedną scenę po ponownym otwarciu.
Nie zmierzono miarodajnego FPS ani limitów pamięci na fizycznym telefonie.

## Zapis i migracja

- Dotychczasowy klucz `ki-legends:adventure:v1` pozostaje **nietknięty** przez selektor.
- Przy pierwszym odczycie kopia bajt w bajt trafia do `:character:legacy`, tylko gdy taki klucz nie istnieje.
  Brakujące pola v1 otrzymują Planetarnych i Verdantię. Zachowane są pozycja, statystyki,
  wyposażenie i zadania. Oryginał jest nadal kopią odzyskiwania, również po kolejnych zapisach migranta.
- Nowa postać dostaje `:character:<UUID>`. Nie ma wspólnego mutowalnego indeksu slotów;
  lista odczytuje osobne klucze, więc tworzenie postaci w dwóch kartach nie gubi wpisów.
- Format v3 zapisuje `race`, `continent`, `startContinent`, pozycję i pełen istniejący Player.
  Czytnik obsługuje v1/v3. Domyślne pochodzenie stosuje tylko migracja v1; niepełny v3 jest chroniony jako nieprawidłowy. Nieprawidłowe, przyszłe lub niespójne sloty są zachowane i zablokowane.
- Aktywny UUID w `:active-character` służy do powrotu po reloadzie. Zmiana tego wyboru w innej
  karcie nie przełącza już uruchomionej sesji. SaveStore porównuje poprzednią rewizję każdego slotu.
- Nowa gra nigdy nie używa klucza poprzedniej postaci. Nie dodano przycisku usuwania zapisów.
- Zapis co 2 sekundy, przy akcjach, pagehide/visibilitychange, wyjściu do selektora i zamknięciu sceny.
- Dotychczasowy `?playtest=stage2-1-20261020` nadal ma odrębny prefiks slotów.
- Jak przed tym etapem, wrogowie i łupy pozostawione na ziemi resetują się po odświeżeniu.
  Stan questów, podniesione przedmioty i XP są trwałe lokalnie.

## UI

Cztery ilustrowane karty, aktywny podgląd mapy, nazwy kontynentów, opis rasy,
środowiska, architektury, kultury i energii. JPEG z PDF są wyłącznie referencjami kart.
Lista postaci pokazuje pochodzenie, poziom i region; zachowany zapis ma osobne oznaczenie.

Ustawienia → **Zapisz i wybierz postać** wraca do listy, z której można kontynuować
lub utworzyć nową postać. Minimapę, etykiety świata, znaczniki, dziennik, dialogi i cel
samouczka powiązano z wybranym kontynentem. Zachowano pełny ekran całej sceny z HUD,
oddalenie, interfejs ekwipunku, sklep i kuźnię. `/test` i zabezpieczenia szkiców zachowano.

## Testy faktycznie wykonane

Końcowe wykonanie: **58/58 unit/DOM (11 plików), 7/7 E2E (3,2 minuty)**.
Raport maszynowy: `docs/qa/STAGE3-RESULTS-2026-10-20.json`.

| Zakres          | Wynik / metoda                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baza 2.1        | 45/45 unit/DOM, pełny TypeScript; rzeczywisty samouczek Airy w Chromium/WebGL                                                                                                                                       |
| Logika etapu 3  | 58/58 unit/DOM; pełna pętla na wszystkich czterech mapach, rzeczywiste footprinty i trasy, stare/nieprawidłowe zapisy, niezależność slotów, przyszły adapter 8 kierunków                                            |
| A / B / C       | Playwright/Chromium: cztery podglądy → cztery sloty → poprawny start → NPC → dojście do lokalnego celu → powrót i nagroda → reload pozycji/rasy/świata → wyjście i przełączenie postaci; bez błędów konsoli/zasobów |
| D               | Playwright przez rzeczywisty UI/canvas: Aira, Ren, trzy dziki, autoatak, umiejętności ze zużyciem KI, XP/awans, trzy łupy, ekwipunek, Taro/nagroda/ulepszenie, Mio/kupno/sprzedaż i reload                          |
| E               | CDP touch w 360×800, 414×896, 852×393: wybór, wszystkie podglądy, rozmowa, zadanie, joystick, eksploracja i ekwipunek; kontrola granic modali oraz kolizji prostokątów kontrolek                                    |
| Dodatkowy układ | 640×480: regresja położenia kontekstowych przycisków względem paska walki                                                                                                                                           |
| WebGL           | Dodatkowy rzeczywisty start i wyjście Nexus-9, Pyry i Aetherii w Chromium/SwiftShader, bez błędów konsoli; osobne zrzuty                                                                                            |
| TypeScript      | Pełny `npx tsc --noEmit`; dodatkowo `npx tsc --noEmit -p tsconfig.e2e.json`                                                                                                                                         |
| Lint / build    | `npm run lint`: 0 błędów, 7 wcześniejszych ostrzeżeń React Fast Refresh. `npm run build` i `build:playtest`: ukończone                                                                                              |

Przeglądarkowe QA korzysta z niezmienianego buildu Vite preview na porcie 4174,
aby HMR podczas pracy nie unieważniał długich testów. Zwykła suite używa Canvas tego samego
Phasera i tego samego Index; dodatkowy start WebGL sprawdza też drugi renderer.
W scenariuszach rozgrywki nie teleportowano postaci, nie zmieniano zapisu ani nie wywoływano ukrytych metod modelu. Osobny test migracji celowo inicjuje izolowany kontekst fixturem v1, ponieważ nowy UI zapisuje już tylko v3.
Odczyty localStorage/dataset i położenia minimapy służą wyłącznie asercjom.
Pierwsze próby automatu (ruch w toku przy reloadzie, trafienie w HUD podczas klikania
w punkt świata poza bezpiecznym obszarem) skorygowano jako błędy testu, bez zmiany zasad gry.

Uruchomienie: `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`,
`npm run test:e2e`. Browser: systemowy `/usr/bin/chromium` lub
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; bez niego `npx playwright install chromium`.
Zewnętrzny host: `KI_QA_BASE_URL=https://... npm run test:e2e`. Dla lokalnego preview
`KI_QA_PATH=/scripts/playtest.html`. Opcja `KI_QA_WEBGL=1` uruchamia suite w WebGL.
Trace błędów i zrzuty trafiają do ignorowanego `test-results/`; tabela dokumentuje wykonanie,
a nie testy fizycznego urządzenia. Przy publikacji należy sprawdzić meta `ki-build` i podglądy.

## Tymczasowe zasoby i przygotowanie Blendera

Nowe obiekty i materiały SVG są spójnym, tymczasowym zestawem, a nie finalną malowaną
oprawą anime. Są jawnie oznaczone w selektorze. Ludzki sprite gracza/NPC, tinty NPC,
wspólny dzik i proceduralne efekty walki są dotychczasowymi zasobami zastępczymi.
Mapa lasu i jej grafika pozostają zaakceptowaną bazą; nie wycinano z PDF animacji ani tła map.

Pełna kolejka GPU: `STAGE3-GPU-ASSET-LIST.md`. Kontrakt maszynowy:
`art/pipeline/stage3-render-contract.json`. Skala obecnej postaci 96×96 jednostek;
próby docelowe 128/144/160, źródło 512² RGBA, 8 kierunków, oddzielna aura,
stała kamera i światło, atlas Phaser JSON + PNG/WebP, padding i feet anchor.
Podłoża 256² źródło / 64 jednostki; obiekty do 1024² źródło, niezależne footprinty.
Nie uruchomiono GPU, płatnych instancji, generacji obrazów ani instalacji modeli AI.

## Granice i nierozwiązane prace

- Nie wykonano testu fizycznego Androida/iPhone'a, sprzętowego FPS, rzeczywistego safe-area
  ani pełnego ekranu na telefonie. Emulacja CDP nie zastępuje takiego testu.
- Nowa oprawa świata jest tymczasowa; czeka na produkcję zgodną z referencjami anime.
- Obecny ludzki sprite ma cztery kierunki chodzenia; obsługa atlasów/8 kierunków jest gotowa
  w adapterze, ale finalne klatki i pozostałe stany animacji nie są jeszcze wyprodukowane.
- NPC i fauna wymagają właściwych modeli. Każdy świat ma lokalną historię i dialogi,
  lecz wspólny prosty szkielet trzech zadań oraz ten sam balans PvE.
- Kontynenty otwiera się poprzez pochodzenie/slot. Nie dodano podróży między kontynentami
  jedną postacią ani portali; bezpieczne przełączenie i zwalnianie scen są obsługiwane przez selektor.
- Klucze localStorage należą do originu. Inna domena/tryb prywatny nie dzieli automatycznie zapisów.
  Brak eksportu/chmury/kont; nie usuwać danych przeglądarki gracza przy publikacji.
- Build nadal zgłasza wcześniejsze ostrzeżenia dużych chunków silnika i przestarzałego inputValidator
  w niezwiązanym `/test`; nie zmieniano zabezpieczeń tej części aplikacji.

## Commity i publikacja

Gałąź robocza: `feat/stage3-four-continents`.

- `f471e55` — audyt 2.1 i rzeczywisty test samouczka.
- `a5162ab` — cztery pochodzenia, cztery mapy, wspólna architektura, sloty, migracja,
  manifesty, adapter 4/8 kierunków, poprawka gestu joysticka i 58 testów.
- `9ad98ed` — poprawki kompaktowego UI, przewijania selektora, bezpiecznej tożsamości v3 i klatki atlasu.
- `9508cdf` — Playwright, aktualne lockfile, kontrakt GPU/Blendera i raport wykonania.

Gałąź roboczą scalono fast-forward do `main` po końcowych testach.
Wersja aplikacji opublikowana z `9508cdfa8930b12ff5d7af2bef56b12350cdc392`.
Lovable potwierdził dokładnie ten SHA przed uruchomieniem publikacji.
Projekt: https://lovable.dev/projects/e81106fd-0dd8-47e7-95cc-df4e97e3d071.
Deployment: `b6ba5cef-16a8-484c-b44f-d2f871da46de`.

**Produkcja zweryfikowana: https://kilegends.pl/**, 20.10.2026 około 08:24 UTC.
Domena zgłasza `ki-build=stage3-four-continents-r1` (wcześniej `stage2.1-r3`).
Rzeczywisty Chromium na domenie: wybór Androidów → Nexus-9 → rozmowa z LYRA-7 →
przyjęcie Pierwszych kroków → marsz do Rdzenia Świadomości → zadanie ready → reload.
Zachowano `race=android`, `continent=nexus`, cel ready i pozycję około (1593,638).
Brak błędów konsoli. Osobna kontrola potwierdziła załadowanie wszystkich czterech
portretów 1152×1536 i brak HTTP 4xx/5xx podczas otwierania selektora.
Pełne 7 E2E wykonano na buildzie lokalnym; test produkcyjny był opisanym smoke testem,
a nie powtórzeniem wszystkich siedmiu scenariuszy na domenie.

Końcowy commit raportu publikacji może być nowszy od `9508cdf`; zmienia tylko dokumentację,
nie opublikowany kod. Repozytorium i domena zawierają tę samą logikę etapu 3.
