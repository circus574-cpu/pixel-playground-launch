# KI Legends — GPU i zasoby

## Verdantia — materiały kontynentu 04.11.2026

Paczka `verdantia-continent-v2@1.0.1` jest domyślnie włączona od 05.11.2026 (`ki-verdant-continent=0` wyłącza):
15 zasobów, około 4,37 MiB plików runtime i 15,95 MiB rozkodowanych pikseli.
Miasta zachowują swoje zaakceptowane wiązania; nowe klucze mają przestrzeń
`terrain.verdantia-continent.*` / `object.verdantia-continent.*`.
Nie podniesiono limitu pamięci streamingu dla potworów.

Źródła: pięć powierzchni z `art/world-verdantia-v2@00e15ad5`, cztery drogi
i cztery przezroczyste obiekty z dwóch ZIP-ów właściciela na Dysku Google.
Dodatkowo wygenerowano oddzielne drzewo liściaste bez wyspy podłoża i teksturę
łąki przez narzędzie `image_gen`, na podstawie palety dostarczonego krzewu.
Oryginalne PNG, dostępne prompty, SHA-256 i identyfikatory archiwów zachowano
w [pakiecie źródłowym](../art/production/verdantia-continent-v2/).
[Pochodzenie i ograniczenia](../art/production/verdantia-continent-v2/provenance.json).
Nie uruchamiano ani nie zmieniano instancji GPU właściciela.

Odtworzenie: `node art/production/verdantia-continent-v2/prepare.mjs`, następnie
`npm run assets:import -- art/production/verdantia-continent-v2/manifest.json --install`.
Przy ponownym imporcie istniejącej wersji dodać `--replace`. Zachowana alfa,
przycięcie pustych marginesów i dopasowanie rozmiaru nie zmieniają fizycznych
kotwic. Z ilustracji dróg wycięto pas samej nawierzchni; renderer nakłada go
na maski istniejących tras, bez wklejania prostokątnych obrazków całej drogi.
Piasek i woda korzystają z istniejącej maski lądu. [Dowody z gry](zmiany/2026-11-04/ZMIANY.md#verdantia--oprawa-kontynentu-na-osobnej-gałęzi).

## Aetheria — materiały właściciela 03.11.2026

Pakiet `aether-painted-preview@1.0.0`, flaga `ki-aether-painted=1`: cztery
powierzchnie, sześć budynków i atlas jedenastu statycznych dekoracji. Źródła
są w `Grafika/` z `main@327727e2`; [pochodzenie i SHA-256](../art/production/aether-painted-preview/provenance.json).
Białe tło czterech nieprzezroczystych budynków usunięto przez flood fill
połączony z zewnętrzną krawędzią, zachowując biel we wnętrzach. Pozostała alfa
została zachowana. Plansza dekoracji ma jawne prostokątne klatki atlasu.
[Pakiet i odtwarzalny skrypt](../art/production/aether-painted-preview/).
Nie używano GPU ani nowej generacji; to prototyp bez odbioru na fizycznym telefonie.
Runtime ma około 21 MiB plików, wymaga dalszej optymalizacji przed publikacją.
[Zrzuty i zakres](zmiany/2026-11-03/ZMIANY.md#aetheria--oprawa-z-materiałów-właściciela).

## Pyra — materiały właściciela, 03.11.2026

Oddzielna gałąź `preview/pyra-painted-world`, pakiet `pyra-painted-preview@1.0.1`,
opcja `ki-pyra-painted=1`. Cztery tekstury JPG: spękana skała, jesienna ściółka,
ozdobny kamień oraz ceglana droga. Sześć przezroczystych PNG z ZIP właściciela:
sala wodza → sala przysięgi, targ → sklep, karczma → gospoda, kuźnia Goro →
kuźnia żaru, skarbiec → depozyt, arena treningowa → arena.
Nazwy, usługi i fizyczna geometria miasta pozostają kanoniczne.

[Źródła, manifest, skrypt i sumy SHA-256](../art/production/pyra-painted-preview/).
Odtworzenie: `node art/production/pyra-painted-preview/prepare.mjs`, import:
`npm run assets:import -- art/production/pyra-painted-preview/manifest.json --install`.
Zachowano oryginalną alfę budynków (także dym), bez usuwania tła ani przemalowania.
Przesłany przykład całej sceny jest jedynie referencją, nie teksturą mapy.
Runtime: `public/game/assets/gpu/pyra-painted-preview/1.0.1-34b54027eca7/`,
10 plików WebP, 10 175 460 bajtów (9,70 MiB). Źródłowe WebP: 2 622 414 bajtów.
Importer normalizuje do bezstratnego WebP. GPU nie używano.

Teren/ściany nawigacyjne zachowują oryginalne maski; w mieście skała zastępuje
plamy biomów wyłącznie wizualnie na komórkach lądu. Ściółka ma skalę 256 j.,
skała 1024 j., cegła 640 j., ornament 768 j. Zdobiony podest 460×300 j. przed
istniejącą salą wodza jest dekoracją pod stopami; nie dodaje kolizji ani ścieżek.
Chunki podglądu 1024² zamiast 512²; streaming pozostaje aktywny. Budynki mają
wysokość 470 j. i szerokość co najmniej 530 j. z zachowaniem proporcji i wiązania
do istniejących drzwi. Pozostaje standardowe przygaszanie przy zasłanianiu aktorów.
Wersja 1.0.0 była lokalną próbą; 1.0.1 poprawia wielkość liści.
[Zrzut i wyniki kontroli](zmiany/2026-11-03/ZMIANY.md#pyra--podgląd-czterech-tekstur-i-sześciu-budynków).
Nie ma publikacji ani odbioru fizycznego telefonu.

## Nexus — pakiet z Dysku właściciela, 03.11.2026

**Korekta po uwadze właściciela:** aktualny pakiet to `nexus-painted-preview@1.1.0`,
`public/game/assets/gpu/nexus-painted-preview/1.1.0-52e306dd144f/`.
Pierwszy podgląd opisany poniżej był zbyt jednolity: pełna skała w centrum
przykrywała zróżnicowanie nawierzchni. Nie stanowił odbioru zgodności ze wzorem.
Wersja 1.1.0 dodaje osobny jasny bruk wygenerowany przez OpenAI image_gen
([prompt, źródła i SHA-256](../art/production/nexus-painted-preview/courtyard-generation.json)).
To pojedynczy kafel gruntu, nie tło całej sceny. Źródłowe pięć tekstur właściciela
pozostaje: skała na zewnątrz, roślinne podłoże i ściółka w ogrodach, panele na
ścieżkach, jasne płyty na podeście centrum. Dodano dekoracyjne pasy do
istniejących drzwi usług z cyjanowo-złotą krawędzią; nie dodają colliderów ani
instrukcji nawigacji. `nexusWalkways` jest wyłącznie rendererem, nie nową drogą
w kanonicznym JSON. Paczka 11 zasobów: 18 124 460 bajtów (17,29 MiB).
Poprzednie wersje i dowody zachowano. [Nowy zrzut i zakres](zmiany/2026-11-03/ZMIANY.md#nexus--korekta-rozdzielenia-nawierzchni).

Pierwsza iteracja, zachowana dla historii:

Osobna gałąź `preview/nexus-painted-world`, opcja `ki-nexus-painted=1`,
pakiet `nexus-painted-preview@1.0.1`. Źródło: [folder Nexus](https://drive.google.com/drive/folders/1xG2Ioa6pac5wAWWmeQ0HLRhMmuOT9pl2).
Pobrano wszystkie 10 PNG: pięć tekstur (trawa z technicznymi fragmentami,
leśne podłoże, spękana skała, ciemne panele drogi, jasne płyty placu),
cztery budynki (centrum/hall, sklep, depozyt, arena) oraz przezroczysty arkusz
1536×1024 z dekoracjami. Brak nowych grafik gospody i kuźni — zachowano ich
wcześniejsze zasoby. Nie deklarujemy sześciu nowych budynków.

[Źródła i skrypt](../art/production/nexus-painted-preview/),
[identyfikatory plików Drive](../art/production/nexus-painted-preview/drive-sources.json),
[SHA-256 i pochodzenie](../art/production/nexus-painted-preview/provenance.json).
Źródłowe PNG są zachowane bez zmian. Budynkom usunięto jedynie biel połączoną
z krawędzią, następnie przycięto przezroczysty margines. Oryginalna alfa arkusza
została zachowana. Atlas ma 15 wydzielonych klatek; część to rezerwa do dalszego
urządzania mapy, nie wszystkie są rozmieszczone. Drzewa, grzyby i cyjanowe rośliny
stoją przy usługach; istniejące pylony, terminal, reaktor, kryształy i ogrody
otrzymują nowe wiązania tylko w rendererze Nexusa. Bez nowych colliderów.

Odtworzenie: `node art/production/nexus-painted-preview/prepare.mjs`, potem
`npm run assets:import -- art/production/nexus-painted-preview/manifest.json --install`.
Runtime `public/game/assets/gpu/nexus-painted-preview/1.0.1-c7886e7013ec/`:
10 zasobów, 16 715 910 bajtów (15,94 MiB), plus JSON atlasu/pakietu. Źródłowe
WebP 5 236 078 bajtów. Importer zapisuje bezstratny WebP. Wersja 1.0.0 była
lokalną próbą; 1.0.1 zawęża ramki, by nie łapać fragmentów sąsiednich dekoracji.

Neutralne światło, światowo zakotwiczona tekstura, streaming 1024² na chunk.
W mieście na komórkach lądu wizualnie dominuje spękana skała, panele rysowane
są po istniejących drogach, a jasny ozdobny podest 460×280 stoi przed drzwiami
centrum. To warstwa pod stopami, nie zmiana danych świata lub nawigacji.
Nowe budynki mają prezentację 540×480 j., z zachowaniem proporcji i punktów drzwi.
Podgląd nie zmienia HUD, statystyk, zapisów, geometrii ani nazw.
Zachowano oryginalne tło referencyjne wyłącznie jako materiał poglądowy.
[Zrzut i kontrole](zmiany/2026-11-03/ZMIANY.md#nexus--podgląd-z-materiałów-drive).
GPU nie używano. Przed produkcją potrzebna optymalizacja i pełna regresja urządzeń.

## Próba Verdantii — 03.11.2026

Pakiet `verdant-painted-preview@1.2.0` jest opcjonalny przez `ki-verdant-painted=1`.
Dwie tekstury pochodzą z przesłanych JPEG właściciela; osobny przezroczysty sklep
wygenerowano narzędziem OpenAI image_gen. RunPod nie był używany. Źródła, master,
manifest i pochodzenie: [katalog produkcyjny](../art/production/verdant-painted-preview/),
[provenance](../art/production/verdant-painted-preview/provenance.json).

Tekstury 1280² mają skalę 768 j. dla trawy i 1024 j. dla ziemi. Sklep 1312×1199
korzysta z kotwicy drzwi `(0.565,0.93)`. Import wykonano istniejącym importerem;
`imported.json` zachowuje wcześniejsze pakiety, podgląd dopisuje własne wiązania.
Teren w podglądzie ma 1024² px na chunk 2048 j. (4 MiB RGBA zamiast 1 MiB);
pozostaje streaming, usuwanie chunków i sortowanie Y. Nie ma odbioru wydajności
fizycznego telefonu ani publikacji. [Zakres i wyniki](zmiany/2026-11-03/ZMIANY.md#próba-malowanej-verdantii--gałąź-podglądowa).

### Sześć budynków Verdantii — osobna gałąź podglądowa

Pakiet `verdant-leaf-buildings@1.0.0` zastępuje w podglądzie sklep, dom zgromadzeń,
gospodę, kuźnię, depozyt i arenę. Wszystkie sześć JPG dostarczył właściciel.
[Źródła, skrypt przygotowania, manifest i SHA-256](../art/production/verdant-leaf-buildings/)
są zachowane w repozytorium. `node art/production/verdant-leaf-buildings/prepare.mjs`
odtwarza WebP; importer: `npm run assets:import -- art/production/verdant-leaf-buildings/manifest.json --install`.
Usunięto tylko biały obszar połączony z brzegiem obrazu. Kotwica `(0.5,0.85)`
wiąże schody z istniejącymi drzwiami. Skala prezentacji 560×520; kolizje i usługi bez zmian.
Włącznik `ki-verdant-painted=1` ładuje oba pakiety, z pierwszeństwem nowego zestawu
budynków. Domyślny widok pozostaje bez zmian. Paczka runtime zajmuje 9 985 190 bajtów
(około 9,52 MiB); sześć źródłowych WebP 2 763 280 bajtów. Importer normalizuje do
bezstratnego WebP. Nie wykonano publikacji ani odbioru na fizycznym telefonie.
[Zrzut i zakres kontroli](zmiany/2026-11-03/ZMIANY.md#sześć-budynków-verdantii).

## Partia 2 i braki do docelowej oprawy — 23.10.2026

Dostawę `8b0a814` z `assets/world-kit-for-codex-20261023` połączono na osobnej
`feature/superior-runtime-20261023` (merge `53a5688`). Dziewięć kolejnych paczek:
bagna, góry, dżungla, loch, wnętrza czterech ras oraz fauna neutralna.
Aktualny katalog zawiera **302 obiekty i 31 powierzchni**; opis partii 1 poniżej
jest zapisem zakresu pierwszego odbioru. Zachowano otrzymany JSON w
[QA partii 2](zmiany/2026-10-23/qa/world-kit-batch2/).
Nie importowano niezwiązanej rozbudowy `feat/continent-worlds`.

[Audyt instalacji](zmiany/2026-10-23/qa/superior-runtime/art-gaps.json): źródłowe
40 paczek `deliveries/enemy-*-1.0.0` były już w repozytorium. Pierwsza kontrola
obejmowała tylko aktywny katalog i wykazała zastępczego dzika; nie stanowiła dowodu
braku źródłowych grafik. Po wskazaniu paczek przez właściciela zainstalowano komplet.
Nie jest potrzebna ponowna generacja tych 40 potworów.

`scripts/worldgen/pack-enemy-atlases.mjs` pakuje puste marginesy do atlasów z `trim`,
zachowując sourceSize 128², nazwy wszystkich 416 klatek, pozycję w pełnej klatce,
FPS, klipy, rozmiar 84×84 i kotwicę `(0.5,0.8)`. Wersja pochodna 1.0.1 przechodzi
zwykły importer; oryginalne paczki 1.0.0 pozostają bez zmian. Bufory RGBA są
kopiowane bez przeskalowania i mieszania koloru. Hashe zrekonstruowanych widocznych
pikseli wszystkich 16 640 klatek są identyczne przed i po pakowaniu.
Łączna pamięć rozkodowanych atlasów biblioteki spadła z 1040 do 418,25 MiB;
**biblioteka nie jest ładowana w całości do sceny**. Zwykłe mapy pobierają tylko
zadeklarowane rodzaje; wyprawa pobiera atlasy aktywnych slotów i ich przywołań.
Dowody: [pakowanie](zmiany/2026-10-23/qa/superior-runtime/enemy-packing.json),
[instalacja](zmiany/2026-10-23/qa/superior-runtime/enemy-install.json).

Otwarte grafiki: aktorzy NPC czterech ras oraz ruch neutralnej fauny. Dwanaście części
fauny to obrazy statyczne. Nie zamknięto odbioru artystycznego potworów ani praw.
Lista: `art/production/enemies/roster.json`; obowiązuje kontrakt z
[rozwoju i walki](ROZWOJ-I-WALKA.md#kontrakt-grafiki-potworów).

Oględziny sosny, brzozy, paproci i grupy grzybów z `biome-forest` wykazały
prostokątne wycinki z uciętymi brzegami/sąsiednimi roślinami. Źródła zachowano;
binder używa obejrzanego dębu dla dwóch drzew i kwitnącego krzewu dla dwóch grup.
Grafika `verdant-city-tree` przedstawia dom na drzewie i nie jest zamiennikiem sosny.
Nie zamknięto odbioru artystycznego pozostałych części ani praw do wykorzystania.

## Partia 1 od Claude'a — zasoby do świata CPU

Przyjęto commit `fd2597e` z gałęzi `assets/world-kit-for-codex-20261023` do
`feature/cpu-game-content-20261023`. Zawiera wyłącznie dostawę na bazie świata CPU;
nie importowano `feat/continent-worlds`, kuźni `pyra-smithy` ani zmian kontynentów.
Dziesięć nowych paczek to 138 części: cztery miasta (Pyra 18, pozostałe po 16),
biomy las/śnieg/pustynia/wulkan/wybrzeże i ruiny (po 12).

Maszynowy katalog [world-asset-kit.json](world-asset-kit.json) zawiera 194 wiązania
obiektów i 31 powierzchni. Wszystkie 138 nowych części mają `placement`; 17 starszych
wiązań, głównie wnętrz i lasu, nie ma zaleceń rozmieszczenia. Nie zgadywać ich kolizji.
`python3 scripts/export_world_asset_kit.py` odtwarza katalog z bieżących importów,
regionów i `deliveries/*/placement.json`. Lista `installedSets` pochodzi z checkoutu;
brak wpisów `pending` nie oznacza zakończenia prac GPU poza tą gałęzią.
Oryginalny [opis dostawy](zmiany/2026-10-23/qa/world-kit-intake/claude-delivery-description.txt)
i [otrzymany JSON](zmiany/2026-10-23/qa/world-kit-intake/delivered-world-asset-kit.json)
zachowano jako dowody. Ich starsze liczby i informacje o kuźni nie opisują tej gałęzi.

W obiekcie regionu `asset` odpowiada `regionAsset`, bez prefiksu `object.`.
`x/y` wskazują punkt oparcia, głębokość wynika z Y; rozmiar i `anchorX/anchorY`
kontrolują wyłącznie prezentację. `solid` i footprint pozostają w danych świata.
Zalecenie z katalogu nie zastępuje istniejącego footprintu ani położenia drzwi.
Nie przesuwać wejść i nie powiększać kolizji dla dopasowania ilustracji.

`scripts/worldgen/bind_world_art.py` eksportuje zweryfikowane wejście przez
`--export-input <plik.json>`, następnie składa osobny zestaw prezentacji przez
`--input <plik.json> --world <katalog-browser> --output <nowy-katalog> --workers 8`.
Sprawdza manifesty przed i po pracy; zapisuje przypisania per chunk, budynki,
zasoby, wejścia do lochów i powierzchnie biomów bez modyfikacji danych źródłowych.
Nie jest to jeszcze renderer sceny Phaser. Drzwi widoczne na ilustracjach wymagają
przeglądu względem zachowanych punktów wejścia. Ta partia nie dostarcza animacji
nowych mieszkańców ani potworów. Deklaracje pochodzenia paczek nie zamykają praw
komercyjnych; obowiązuje [rejestr licencji](LICENCJE.md).

Aktualizacja: 23.10.2026. Cztery malowane rasy, tekstury trzech kontynentów i część
przyrody są zainstalowane. Obowiązuje oddzielne podłoże, obiekty, aktorzy i efekty.
**Cykl życia i konfigurację GPU obsługuje wyłącznie właściciel**, także po renderze.

## Co wymaga GPU, a co można zrobić lokalnie

Lokalnie na CPU: montaż/eksport atlasów, import, skala prezentacji, FPS klipów,
poprawki deformacji z istniejących masterów, kolizje, drogi, UI, questy, spawny,
proceduralne efekty i telegrafy, maski terenu oraz optymalizacje.
GPU może być potrzebne do nowych ilustracji/widoków i ponownych generacji.
Nie uruchamiać go do zwykłej korekty rozmiaru postaci ani walidacji paczki.

## Obecny pipeline malowanych postaci

1. `android_pose_keypoints.py` / `planetary_pose_keypoints.py`: osiem kierunków pozy.
2. `painted_views.py`: ControlNet OpenPose + IP-Adapter SDXL + Animagine XL 3.1;
   wejściem zaakceptowany kandydat, nie nowa postać z każdego promptu.
3. `matte_masters.py`: rembg `isnet-anime`, wspólna skala, stopy `(256,486.4)`, 512² RGBA.
4. `animate_painted.py`: siatka 2D i klipy proceduralne, margines `KI_SAFE`.
5. `assets:pack` i walidowany `assets:import`; mastery pozostają poza paczką klienta.

Tożsamości i wady: [rasy](RASY-I-POSTACIE.md). Nie przenosić licencji modelu
na referencję lub cały output. Prawa i dowody: [licencje](LICENCJE.md).

## Źródła prawdy

| Plik                                                     | Zastosowanie                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/game/assets/schema.ts`                              | Wspólny walidator manifestu; import i runtime                                               |
| `art/pipeline/gpu-pack.schema.json`                      | JSON Schema draft-07 dla systemu generującego paczki                                        |
| `src/game/assets/contract.ts`                            | Wymiary, kierunki, FPS i limity                                                             |
| `art/pipeline/gpu-production-targets.json`               | Wyeksportowane rzeczywiste rozmiary, kotwice, footprinty, współrzędne i klucze czterech map |
| `art/pipeline/examples/hero-production.template.json`    | Kompletny szablon produkcyjnego bohatera: 416 klatek, dwie strony atlasu                    |
| `art/pipeline/examples/technical-delivery/manifest.json` | Gotowa, walidowalna neutralna paczka diagnostyczna                                          |
| `src/game/assets/imported.json`                          | Aktywne wersje zainstalowanych paczek; zmiana podlega code review                           |

JSON Schema sprawdza strukturę. `assets:import` dodatkowo dekoduje obrazy, sprawdza klatki, trim, przezroczystość, powiązania i budżet świata. Sam poprawny JSON nie oznacza poprawnego assetu.

## Skala wynikająca z działającej gry

- Kontrakt importu bohatera/NPC: **96×96 jednostek** (runtime bohatera 160×160), stopy **(0.5, 0.95)**. Przeciwnik: **84×84**, kotwica **(0.5, 0.8)**. Powiększenie dotyczy prezentacji bohaterów, nie colliderów ani źródłowych klatek.
- Rozdzielczość renderera i kamera wymagają pomiaru na docelowym urządzeniu; zoom pozostaje niezależny od rozdzielczości atlasu.
- Obecny ludzki arkusz 1254² jest dzielony na 4×4 klatki po 313 px (2 px niewykorzystanego brzegu). Nowy format nie dziedziczy tego historycznego układu.
- Render źródłowy **512×512 RGBA PNG** przechowujemy jako master. Paczka klienta używa **128×128** pełnego canvasu klatki: więcej niż maksymalny obecny rozmiar ekranowy, bez kosztu 512² na każdą klatkę w przeglądarce.
- 416 nieprzyciętych klatek 128² to 26 MiB RGBA: atlas 2048×2048 i 2048×1280. Klatki 512² zajęłyby 416 MiB przed narzutem, a 256² — 104 MiB. Dlatego nie wysyłamy masterów 512 do gry.
- Zmiana rozdzielczości renderera/DPR lub skali świata wymaga ponownego pomiaru i wersji kontraktu. Master 512 pozwala ponownie zbudować zasoby bez nowych renderów; aktualny importer wymaga klienta 128.

Kamera renderów: ortograficzna, elewacja **60°**, roll 0, widoczna południowa fasada, światło z północnego zachodu. To kontynuacja poprzedniego kontraktu. Najpierw porównać jeden render kontrolny w istniejącej wiosce i zatwierdzić ustawienie przed całą serią. Zakaz osobnego losowania kamery, stroju, twarzy lub światła dla kolejnych klatek.

## Animacje i mechanika

Kierunki według nazw świata: `down`, `down-left`, `left`, `up-left`, `up`, `up-right`, `right`, `down-right`. Dodatnie Y oznacza dół ekranu. Nazwa klatki: `{actor}/{state}/{direction}/{frame:02}`, indeks od `00`.

| Stan    | Klatek / kierunek | FPS | Pętla | Uzasadnienie                                                                          |
| ------- | ----------------: | --: | ----- | ------------------------------------------------------------------------------------- |
| idle    |                 8 |   6 | tak   | spokojny cykl 1.33 s                                                                  |
| walk    |                 8 |  16 | tak   | cykl 0.5 s, taki jak dotychczasowe 4 klatki przy 8 FPS; ruch zależy od rasy i poziomu |
| attack  |                 8 |  16 | nie   | 0.5 s mieści się w 650 ms odnowienia ataku                                            |
| skill   |                 8 |  12 | nie   | 0.67 s, poniżej odnowień wynikających z kitu                                          |
| hit     |                 4 |  16 | nie   | krótka reakcja 0.25 s; nie blokuje mechaniki                                          |
| death   |                 8 |  10 | nie   | 0.8 s, potem ostatnia klatka aż do faktycznego odrodzenia                             |
| respawn |                 8 |  12 | nie   | 0.67 s prezentacji po zdarzeniu odrodzenia                                            |

Bohater i przeciwnik: 52 klatki × 8 kierunków = **416**. Profil `npc` wymaga idle/walk: **128** klatek. `run` jest obsługiwany jako opcjonalny stan metadanych, ale gra nie ma sprintu, więc standardowy eksport go nie produkuje ani nie uruchamia.

Obrażenia i zużycie KI nadal wynikają z `GameSession`, **natychmiast przy poprawnej akcji**. Klatka kontaktu ataku/umiejętności to **0**; dalsze klatki pokazują wykończenie ruchu. Nie renderować długiego wind-upu sugerującego późniejsze naliczenie obrażeń. Pocisk jest prezentacją istniejącej akcji, nie nową symulacją trafienia. Nie zmieniamy cooldownów, zasięgów ani obrażeń dla dopasowania grafiki.

Adapter obsługuje priorytety death → respawn → hit → skill → attack → ruch. Zdarzenia postaci i przeciwników sterują klipami. Pauza dialogu zatrzymuje animacje aktorów. Brak nowego klipu w dotychczasowych zasobach oznacza dotychczasowy efekt proceduralny i uczciwy fallback, nie duplikowane „klatki animacji”. Cztery stare kierunki człowieka pozostają fallbackiem; neutralny rig demonstruje rzeczywiste osiem kierunków i wszystkie stany.

## Geometria niezależna od grafiki

`src/game/geometry.ts` zachowuje promień kolizji stóp **12** i margines świata **16**; siatka A* nadal ma 24 jednostki. Footprinty obiektów są w definicjach map, nie w atlasach.

Walka sprawdza odległość punktów stóp i linię widzenia; zasięg wynika z kitu i zdolności. Nie wyliczamy hurtboxa z pikseli sylwetki. Importer nie zmienia geometrii interakcji.

Włosy, broń, ubranie i aura nie mogą powiększać fizycznego collidera. Stopy muszą pozostać w tej samej znormalizowanej kotwicy we wszystkich klatkach. Osobno renderować aurę i kontaktowy cień; podstawowy cień zapewnia silnik.

## Blender / GPU — gotowe zlecenie

1. Zachować `.blend`, rig, tekstury i identyfikację kanonicznej postaci na trwałym dysku, poza publiczną paczką gry.
2. Jeden rig i jedna tożsamość, kamera/światło zablokowane. Renderować akcje, nie 416 niezależnych promptów ilustracyjnych.
3. Wyeksportować dokładnie wskazane PNG: 512×512, RGBA, 8 bitów/kanał, sRGB, bez tła i napisów. Stopy `(256,486.4)` w canvasie 512; po skalowaniu `(64,121.6)` w 128.
4. Przynajmniej **8 px pustego brzegu w masterze**, odpowiadające **2 px** w paczce klienta. Nie przycinać włosów, stroju, broni ani energii. Jeśli efekt nie mieści się w canvasie ciała — osobny atlas efektu.
5. Układ plików, gdzie `renders/hero-planetary` jest katalogiem wejściowym:

```text
renders/hero-planetary/
  idle/down/00.png ... 07.png
  idle/down-left/00.png ... 07.png
  ... pozostałe kierunki ...
  walk/<direction>/00.png ... 07.png
  attack/<direction>/00.png ... 07.png
  skill/<direction>/00.png ... 07.png
  hit/<direction>/00.png ... 03.png
  death/<direction>/00.png ... 07.png
  respawn/<direction>/00.png ... 07.png
```

6. Uruchomić lokalne narzędzia CPU w checkoutcie repozytorium z Node 22.18+ i `npm ci`:

```sh
npm run assets:pack -- renders/hero-planetary deliveries/hero-planetary-1.0.0 --id=hero-planetary --world=verdant --profile=hero --version=1.0.0
npm run assets:import -- deliveries/hero-planetary-1.0.0/manifest.json
npm run assets:import -- deliveries/hero-planetary-1.0.0/manifest.json --install
npm run assets:check
npm run typecheck
npm run test
npm run build
npm run build:playtest
npm run test:e2e
```

`assets:pack` wymaga dokładnych nazw i liczby klatek, sprawdza master 512 RGBA, skaluje z Lanczos3, odrzuca pustą/uciętą klatkę i tworzy pełne atlasy z metadanymi. Nie nadpisuje istniejącego katalogu dostawy. Wyjście jest walidowane przed atomowym przeniesieniem do docelowego katalogu. Narzędzie przetestowano pełną **neutralną** dostawą 416 klatek; nie wygenerowano docelowego anime.

`assets:import` bez `--install` to walidacja i plan, bez zmiany aktywnego katalogu. Instalacja dodaje pliki pod `public/game/assets/gpu/<id>/<version>-<sha256-prefix>/` i atomowo aktualizuje `imported.json`. Obrazy są normalizowane do bezstratnego WebP, JSON atlasu wskazuje nowy plik. Zmiana istniejącego pakietu wymaga `--replace` i podniesienia wersji; ten sam pakiet jest idempotentny. Starych plików nie kasujemy. Żadne pole zapisu postaci nie jest dotykane.

## Inne formaty i manifest

Importer przyjmuje PNG/WebP z prawdziwymi pikselami 8-bitowymi, image, spritesheet lub Phaser JSON hash. Odrzuca zdalne URL, ścieżki wychodzące poza dostawę, uszkodzone obrazy, brakujące klatki, błędne wymiary, zduplikowane identyfikatory, obrót ramek oraz błędny trim. Atlas maks. **2048 px na bok**, wejście obrazu maks. 32 MiB, zoptymalizowany obraz maks. 8 MiB. Aktywny świat maks. **128 MiB bazowych tekstur RGBA**, z rezerwą **25 165 824 B** na sześć chunków terenu Verdantii; to budżet, nie gwarancja FPS ani pełny pomiar pamięci GPU.

Atlasy mogą być trimowane przy zachowaniu `sourceSize` i `spriteSourceSize` oraz stałej kotwicy; `rotated` musi być false. Pola `pivot`/`anchor` w klatkach są odrzucane: Phaser nadpisuje nimi kotwicę przy każdej zmianie klatki; kotwica pochodzi wyłącznie z konfiguracji aktora/mapy. Repeatable terrain/weather nie może być trimowane. Packer postaci świadomie zachowuje pełne canvasy i przezroczyste brzegi. Ręczny packer obiektów musi zapewnić padding/extrude przeciw przeciekom; obiekt nie może dotykać sąsiedniej ramki.

Spritesheet: `frameWidth`/`frameHeight`, bez zewnętrznego spacingu, pełne komórki; kierunki i kolejność klatek są w `clips.<state>.directions`, bez założeń silnika o układzie rzędów. Jedna animacja odwołuje się do jednej strony atlasu; różne stany mogą używać różnych stron. Packer nie dzieli pojedynczego klipu pomiędzy strony.

Przykład wymiany obiektu i podłoża, bez zmian współrzędnych ani walki:

```json
{
  "renderBindings": {
    "object.sanctum": {
      "asset": "aether-buildings",
      "frame": "sanctum",
      "fit": "contain",
      "layer": "objects"
    },
    "object.aether.sanctum-main": {
      "asset": "aether-buildings",
      "frame": "sanctum-variant",
      "fit": "contain"
    },
    "terrain.aether-ground": { "asset": "aether-terrain", "frame": "grass", "tileSize": [64, 64] },
    "atmosphere.aether": { "asset": "aether-mist", "tileSize": [512, 512] },
    "effect.shield": { "asset": "ki-effects", "frame": "shield" }
  }
}
```

Konkretne identyfikatory instancji pobierać z pliku targets, nie zgadywać z przykładu. `fit=contain` domyślnie chroni proporcje nowej grafiki w istniejącym polu obiektu; dotychczasowe obrazy zachowują zaakceptowany rozmiar. Kotwica i footprint nadal pochodzą z mapy. `tileSize` oznacza jednostki świata, więc zamiana kafla 64 na 128 px nie podwaja wzoru na ziemi.

`actorBindings`: `verdant.hero`, `aether.hero`, `nexus.hero`, `pyra.hero`; NPC np. `aether.npc.guide`; przeciwnik świata `pyra.enemy` albo — dla konkretnego potwora z bestiariusza — `<świat>.enemy.<slug>` (np. `verdant.enemy.cierniowy-wilk`; walidator `gpu-import.ts` przyjmuje `[a-z0-9]+(-[a-z0-9]+)*`, `actorVisual(świat, "enemy", slug)` je odczytuje, a `worldAssets()` ładuje atlasy wszystkich potworów świata). Globalne fallbacki to `hero.human-v2`, `npc`, `enemy`. Paczki `deliveries/enemy-*` wiążą się kluczami z `art/production/enemies/bindings.json`. Docelowa grafika NPC nie dostaje automatycznie starego tintu, chyba że jawnie ustawi `tintable=true`.

`effects`: globalne `attack` (atak podstawowy każdej rasy), identyfikatory węzłów drzewka zdolności (`A1`, `B4`, `C9`, `T`… — te same w każdej rasie, więc wariant świata, np. `pyra.A1`, jest właściwy), `hit`, `shield`, `heal`, `level`, `loot`, `death`, `respawn`, `enemy-attack`. Stare klucze `flame` i `pulse` (zdolności Etapu 2) nie są już wywoływane. Definicja zawiera `asset`, listę `frames`, `fps`, `size` w jednostkach świata i `durationMs`; ładowane są efekty globalne i bieżącego kontynentu. Bez wpisu pozostaje działający efekt proceduralny.

### Szczególny przypadek Verdantii

Zachowujemy zaakceptowany układ lasu. Atlas podłoża **1904×1904**, komórka **64**, margin **2**, spacing **4**, siatka **28×28**. Komórka źródłowa 64 px jest w obecnym lesie skalowana do **32 jednostek świata**; nie pomylić jej z kaflami 64 jednostek w trzech nowych krainach. Indeksy 0–15 to trawa, kolejne grupy po 256 to soil/stone/water zgodnie z `forest.ts` i `build_anime_forest.py`. Cztery warstwy danych pozostają. Domyślnie są składane raz, wraz ze statycznymi cieniami, do sześciu tekstur po 1024²; oryginalny renderer tilemap zachowano jako fallback przez `STATIC_TERRAIN_CACHE_ENABLED=false`. Zamiana `terrain.verdant` wymaga pełnego obrazu w tym układzie, bez atlasowego `frame` ani `tileSize`.

Obiekty lasu mogą być zastępowane osobnymi referencjami atlasowymi `object.forest.oak` itd. oraz konkretnymi instancjami `object.verdant.<id>`. Nie trzeba przerabiać mapy na jednolity obraz.

## Warstwy, ładowanie, rollback

Podłoże i ścieżki → dekoracje pod stopami → obiekty i aktorzy sortowani po Y stóp → overhead → atmosfera → walka → etykiety/sterowanie. Las ma osobne warstwy masek terenu. Chunki podłoża i obiekty poza kamerą są culled; cienie statyczne są wypalone wyłącznie w warstwie pod stopami i nie tworzą osobnych obiektów każdej klatki. Cache nie zawiera budynków, koron, aktorów ani footprintów. Zwolnienie sceny usuwa wygenerowane tekstury; zasłaniająca grafika nadal przygasa do 0.28. Nie wolno wypalać całego miasta ani mapy do jednej tekstury.

Scena ładuje tylko referencje bieżącego świata, aktorów i efektów. Ilustracje pochodzenia nie są sprite'ami. Neutralny rig nie jest ładowany w normalnej grze; podgląd jest dostępny wyłącznie pod lokalnym `/scripts/playtest.html?ki-art=technical`.

Brak zasobu, uszkodzony atlas lub brak klatki daje nazwany błąd ładowania i przycisk ponowienia. Procent pochodzi z loadera Phaser. Błąd nie kasuje zapisu. Sprzątanie obejmuje `SHUTDOWN`, `DESTROY`, komendy, zoom, etykiety, focus, zapis i telemetryczny `postrender`.

Rollback: przywrócić poprzedni commit samego `src/game/assets/imported.json` i przebudować w gałęzi/PR. Stare wersjonowane pliki pozostają; nie usuwać ich automatycznie. Gdy paczka wraca do starszej wersji przez importer, użyć jawnego `--replace`. Każda aktualizacja przechodzi QA i review. Ten etap **nie publikuje** niczego automatycznie.

## Kontrola jakości i pomiary

```sh
npm run assets:targets
npm run assets:schema
npm run assets:check
npm run typecheck
npm run test
npm run lint
npm run build
npm run build:playtest
npm run test:e2e
# W osobnym terminalu, po uruchomieniu lokalnego preview/playtest:
npm run bench:game
KI_BENCH_WEBGL=1 npm run bench:game
```

Lokalny podgląd pełnego artefaktu Cloudflare/Nitro (bez publikacji):

```sh
npm run build
WRANGLER_SEND_METRICS=false npm exec --yes --package=wrangler@4.151.3 -- wrangler dev --config .output/server/wrangler.json --local --port 4186
# W drugim terminalu:
KI_QA_BASE_URL=http://127.0.0.1:4186 npm run test:e2e -- e2e/stage3.spec.ts --grep 'A/B/C'
```

Genericzne `npm run preview` z TanStack szuka `dist/server/server.js` i nie odpowiada układowi tego Cloudflare builda. Nie stosować tego polecenia jako testu gotowego workera. Wrangler uruchamiany z `--local` nie publikuje gry i nie wymaga zmiany targetu hostingu. Dokładną wersję użytego lokalnego runtime przypięto w przykładzie; nie dodano go do zależności aplikacji.

Walidacja struktury/pikseli nie ocenia tożsamości, płynności ruchu, poprawności kończyn, rytmu kroków ani zgodności kamery z ilustracjami. Przed masową generacją potrzebna jest akceptacja jednego wzorca w grze; potem cztery rasy, NPC/fauna, świat i efekty. Wyniki lokalnej/CI regresji oraz rzeczywistych pomiarów znajdują się w `docs/ARCHITEKTURA-I-TESTY.md`. Fizyczny Android i jakość nowej oprawy nie są oznaczane PASS na podstawie headless Chromium.

## Zainstalowane otoczenie

`aether-terrain-v2`, `nexus-terrain-v2`, `pyra-terrain-v2` zastępują podłoża/ścieżki/place/ściany.
`nature-textures-v1` ma 16 tekstur, `nature-objects-v1` 19 obiektów (eksporty maks. 512 px,
aby mieścić się w 128 MiB). Pyra: lawa/wulkany; Aetheria: kryształowa woda, ogrody;
Nexus: energia i lodowe iglice. Nie wszystkie materiały przyrody mają rozmieszczenie.
Verdantia zachowuje zaakceptowany las i pochodny układ miasta.

Eksport lasu: `python3 scripts/build_anime_forest.py SOURCE_DIR scripts/anime-sources.json`.
Prompty i hashe: `docs/ANIME-GENERATION-PROMPTS.json` oraz manifest lasu.
Materiały mają zgodne przeciwległe krawędzie; obiekty oddzielną alfę i footprinty.
Nie wracać do historycznego forest-v3 jako aktualnej grafiki tylko dlatego, że nadal
jest w repo i rejestrze praw. Dane i źródła zachować do weryfikacji pochodzenia.

## Kolejka produkcji — po próbce i akceptacji

| Priorytet | Zakres                           | Rozmiar zamówienia bazowego                                                |
| --------- | -------------------------------- | -------------------------------------------------------------------------- |
| P0        | Unikalne budynki usługowe        | 6 × 4 obecne miasta = 24 obiekty                                           |
| P0        | Wnętrza i rekwizyty              | 6 wnętrz × 4 rasy = 24; 6 typów rekwizytów × 4 = 24                        |
| P0        | Mieszkańcy                       | 8 × 4 = 32 NPC; profil 128 klatek, razem 4096                              |
| P0        | Podłoże i przejścia              | Warianty ground/path/plaza i dekale; dokładny spis po próbce               |
| P1        | Domy, bramy, mostki, ulica       | 24 domy, 12 bram/mostków, 32 obiekty uliczne jako punkt startowy           |
| P1        | Portrety i ikony                 | 32 portrety, 116 ikon węzłów; materiały wg aktualnego katalogu             |
| P1        | Efekty i aury                    | Około 64 pętle zdolności i 4 aury KI; oddzielone od ciała                  |
| P1        | Bossowie                         | 8 nowych projektów z księgi; najpierw decyzja o ich wyglądzie i kontrakcie |
| P2        | Statusy, pociski, ekrany         | 14 statusów, ok. 12 pocisków, 8 ekranów pion/poziom                        |
| Opcja     | Bohaterowie v2 / warstwy sprzętu | Nowa metoda animacji i zakres widocznego wyposażenia do decyzji            |

Usunięto błąd starej listy „6 × 5 miast = 30”: repo ma cztery obecne miasta,
Verdantia jest jednym z nich. Nie sumujemy jej drugi raz. To budżet planowania,
nie stwierdzenie wykonania ani zamówienie uruchomienia GPU.
Próbki: jedna fasada, wnętrze z rekwizytem, pełny NPC i materiał z przejściem.
Po akceptacji w runtime dopiero pełna dostawa. Każda: manifest, provenance, SHA-256,
import, kontrola pamięci, właściwe źródła i raport w dzienniku dnia.

## Odtwarzanie oprogramowania na działającej instancji

Na instancji wybranej i uruchomionej przez właściciela: bootstrap
`scripts/gpu/bootstrap-runtime-v2.sh`, trwała kopia pod `/workspace/ki-legends-gpu/`.
Historyczne aliasy `ki-gpu-check`, `ki-blender-python`, `ki-assets-current` i
`ki-comfy-start` odnoszą się do przygotowanego runtime; ich obecność sprawdzić,
nie zakładać po zmianie obrazu kontenera. ComfyUI: lokalnie 8189, proxy 8188;
nie obiecywać publicznego endpointu ani zmieniać portów bez uprawnienia.
Bootstrap wymaga zgodnego Pythona/runtime. Dane o wcześniejszym `/opt`, archiwach,
checkpointach i przywróceniu są dowodami historycznymi w dziennikach, nie odczytem
aktualnego stanu poda. Hasła/auth nie mogą trafić do kopii ani raportów.

## Potwory w stylu anime — 02.11.2026

Właściciel zaakceptował nowy styl potworów (ręcznie malowane anime, grube kontury) i zastąpił nim
dotychczasowe wizerunki. Powstał bez GPU, z plansz wygenerowanych przez właściciela w zewnętrznym
generatorze (jedna plansza 4:3 na potwora: 4 klatki chodu/lotu, 4 ataku, 4 śmierci, widok z boku w prawo).

- Skrypt: `scripts/gpu/ingest_creature_sheet.py <plansza> <id-potwora> [--no-effects]` wycina 12 klatek
  (siatka 4×3; klatki stykające się rogiem lub ogonem są rozcinane po liniach siatki, a efekt ataku
  przecięty linią siatki wraca do swojej klatki), usuwa jasne tło zachowując jasne futro, blachę i
  białe rdzenie blasku (tło to biel otoczona ciemnym konturem lub ciemnym materiałem), skaluje jedną skalą po ciele (długi język lub wiązka nie zmniejsza
  potwora i zanika łagodnie) i buduje atlas 2048×1024 z lustrzanymi klatkami dla kierunków w lewo.
  `--no-effects` dla latających i szerokich (skrzydła, wąż) — nic nie jest przycinane.
- Pakiety `enemy-v3-<id>` (`public/game/assets/gpu/enemy-v3-*`) mapują wszystkie 8 kierunków na widok w
  prawo lub lewo (góra i dół pokazują bok); `idle` = pierwsza klatka chodu, `hit` = pierwsza klatka
  śmierci, `respawn` = śmierć od końca. Pakiety zastępują `enemy-v2-<id>` tym samym kluczem aktora.
- Włączenie: domyślnie; `?ki-monsters-anime=0` przywraca poprzednie wizerunki (`enemy-v2-*` zostają).
- Gotowe: **40 z 40** potworów. Ostatnie pięć (04.11.2026): verdant-lisciak-skrytobojca, aether-swietlik-pieczeci
  (latający, `--no-effects`), nexus-pajak-spawalniczy, nexus-roj-nanitow (chmura jako jedna zwarta masa, `--no-effects`)
  i pyra-popielny-wilk. Test `monsters-anime-complete` pilnuje, że każdy potwór bestiariusza ma pakiet.

## Generowanie świata z promptów — `gen_from_prompts.py` (04.11.2026)

Bez płatnego API: tekstury, drogi, przejścia, przyroda, budynki i wnętrza powstają na własnym GPU z promptów w
`art/pipeline/prompts/world/*.md` (256 kompletnych promptów: 4 kontynenty × 64). Skrypt `scripts/gpu/gen_from_prompts.py`
używa tego samego silnika co `gen_terrain_textures.py` i `gen_nature_assets.py` (SDXL z
`/workspace/ki-legends-gpu/models/checkpoints`, domyślnie DreamShaper XL Turbo, 8 kroków):

- `tile` (teren, skrzyżowania) i `road` (drogi 2:1): kołowe dopełnienie splotów, bezszwowe krawędzie; `plain` (przejścia):
  bez dopełnienia, bo połówki różnią się celowo.
- `sprite` (drzewa, krzewy, skały, woda, ozdoby, budynki z zewnątrz): na czystej bieli, tło usuwa `rembg` (isnet-anime).
- `room` (wnętrza): cały pokój 960:760, kuźnia Pyry pionowo 540:1100.
- Długie prompty są pisane pod duże generatory; SDXL ma okno 77 tokenów, więc skrypt wycina z każdego opis (`Subject`)
  i paletę, a styl i negatyw dokłada krótki, osobny na tryb.
- Wyjście: `renders/prompts-<tag>/<plik>-v<i>.png`, `metadata.json` (seed, SHA-256, błąd szwu) i arkusz przeglądowy na grupę.
- `--dry-run` pokazuje plan bez GPU. Skala 2× to zwykłe Lanczos; `--refine` (img2img) jest niesprawdzony.
- Skrypt nie startuje ani nie zatrzymuje poda. Licencje modeli: nadal `ASSET-LICENSE-REGISTER.md`.

## Zestaw grafik do układania świata — kontrakt (23.10.2026)

Codex układa świat i questy (współrzędne, obiekty, NPC, spawny). Ten dokument mówi, **z czego** może
układać i **jak**, żeby grafika, kolizje i kolejność rysowania zgadzały się bez zgadywania.
Maszynowy opis: [`world-asset-kit.json`](world-asset-kit.json), generowany przez
`python3 scripts/export_world_asset_kit.py` (po każdym imporcie paczki uruchomić ponownie).

### Co jest w zestawie

- `objects` — 72 wiązania obiektów (`object.*`) z gotowymi **zalecanymi wymiarami, punktem oparcia
  i obrysem kolizji** (mediany z dotychczasowych regionów). Pole `placement` = ściągawka do wpisu w JSON regionu.
- `terrains` — 33 wiązania powierzchni (`terrain.*`): podłoże, ścieżki, place, ściany, strefy.
- `pending` — zestawy wygenerowane na GPU, jeszcze nie zainstalowane (miasto Pyry, 494 tekstury, krajobraz
  i fauna). Nie układać ich w regionach, dopóki nie pojawią się w `objects`/`terrains`.

### Jak układać obiekt (region JSON, `objects[]`)

```json
{
  "id": "fortress-0",
  "kind": "fortress",
  "asset": "fortress",
  "x": 34404,
  "y": 2987,
  "width": 570,
  "height": 390,
  "anchorX": 0.5,
  "anchorY": 0.92,
  "solid": true,
  "footprint": { "width": 470, "height": 160 }
}
```

- `asset` = klucz po `object.` z `world-asset-kit.json` (`regionAsset`). Silnik bierze wiązanie
  `object.<świat>.<id>` przed `object.<asset>`.
- `x, y` to **stopa** obiektu (punkt oparcia na ziemi). Kolejność rysowania = `y`: postać przed pniem
  zasłania go, za koroną jest przez nią zasłaniana. Nie ustawiać ręcznej głębokości.
- Kolizja pochodzi wyłącznie z `solid` + `footprint` w JSON-ie regionu, **nigdy z grafiki**. Obrys ok.
  60 % szerokości i niski (patrz `placement.footprint`). Drzewa mają obrys tylko pnia.
- Cień pod obiektem dodaje silnik sam dla obiektów wyższych niż 56 jednostek na warstwie `objects`
  (nie dla mostów i płaskich elementów). Nie rysować cieni w grafice.
- Drzewa (`kind` zawiera `tree`, `pine`, `bamboo`) nie bledną: postać za koroną jest ukryta. Budynki i
  rekwizyty bledną do 28 %, gdy zasłaniają tułów postaci.
- `layer: below` = płaskie elementy pod postaciami (mosty, kałuże), `overhead` = nad nimi.

### Czego nie ruszać

- Wnętrza sześciu budynków specjalnych (sala, sklep, arena, depozyt, kuźnia, gospoda) we wszystkich czterech
  miastach to **malowane pokoje**: `src/game/city/paintedRooms.ts` (kolizje odczytane z obrazów), obrazy
  `public/game/interiors/<świat>-<budynek>.webp` z `art/production/interiors/` (skrypt
  `scripts/build_painted_rooms.py`). Wszystkie pokoje, także kuźnia Pyry, mają 1920 × 1280. Dawny pionowy obraz kuźni Pyry jest zachowany jako
  `pyra-smithy-interior-portrait-v1.png`.
- Miasto = strefa bezpieczna ~4000 × 2500 (`city.bounds`), poza nią walka. Nowe obiekty w mieście nie mogą
  zasłaniać drzwi budynków usługowych (muszą być osiągalne A* ze startu).
- Nie edytować `imported.json` ręcznie ani plików `*.generated.ts`; paczki wchodzą przez
  `npm run assets:import` z podbiciem wersji.

### Zamawianie nowej grafiki

Wpisz potrzebę do `docs/GPU-BACKLOG-2026-10-23.md` (typ, biom/rasa, rozmiar na ekranie, solid tak/nie).
Każda część przechodzi: generowanie na GPU → wybór wariantu przez właściciela → wycięcie tła →
kontur i paczka (`scripts/prepare_*.py`) → import → pojawia się w `world-asset-kit.json`.
Orientacyjnie: kilkanaście części jednego zestawu to godzina pracy GPU plus przegląd właściciela.

### Stan na 23.10.2026

| Zestaw                                                                                                                            | Stan                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Obiekty regionów (świątynie, wieże, drzewa, góry, wulkany, rekwizyty)                                                             | zainstalowane, w `objects`                                                                                                |
| Kuźnia Pyry (18 części, podłoga, ściana, Goro)                                                                                    | zainstalowane (paczka `pyra-smithy` 1.1.0)                                                                                |
| Partia 1: miasta Pyry, Aetherii, Nexus-9, Verdantii; biomy las, śnieg, pustynia, wulkan, wybrzeże; ruiny i rekwizyty (138 części) | zainstalowane (paczki `pyra-city`, `aether-city`, `nexus-city`, `verdant-city`, `biome-*`, `ruins-props`), wersja robocza |
| 494 tekstury krajobrazu + wersja przemalowana                                                                                     | wygenerowane / w trakcie przemalowania                                                                                    |
| Góry, wulkany, skały, drzewa, 8 zwierząt neutralnych                                                                              | wygenerowane próbki, do wyboru                                                                                            |
| Bohaterowie 4 ras w nowym stylu z animacjami                                                                                      | Legendy: trening modelu; Androidy: wybrany wygląd; reszta: koncepty                                                       |

## Krajobraz planety i neutralna fauna — specyfikacja (23.10.2026)

**Status: SPECYFIKACJA DO ZATWIERDZENIA. Nic z tej listy nie jest wygenerowane ani zaimportowane; liczby i nazwy to propozycje. Uzupełnia GPU-BACKLOG-2026-10-23.md. Pod GPU uruchamia i zatrzymuje wyłącznie właściciel.**

Decyzja właściciela (23.10.2026): cała planeta ma zostać wypełniona. Poprawki animacji i podłoża przy miastach robimy na końcu. Potrzebne jest bardzo zróżnicowane środowisko (skały, góry, wulkany) oraz **neutralne zwierzęta**, które dają pożywienie i inne surowce (osobno od potworów z bestiariusza, które pozostają przeciwnikami).

Zasady wspólne: niezależne zasoby (tekstury `terrain.*`, obiekty `object.*`, aktor `fauna.*`), nigdy gotowa ilustracja świata jako podłoże; kolizje z danych regionów, nie z grafiki; nowe pakiety wchodzą przez `PREVIEW_SWITCHES` (opt-in) do akceptacji właściciela, po której trafiają do `DEFAULT_ON_SWITCHES` (`=0` wyłącza; tak są dziś Verdantia, Pyra, Aetheria, potwory anime i malowane miasta); budżet tekstur 128 MiB na aktywny świat (kontynent ładuje tylko własny zestaw biomów plus wspólne skały); prawa do referencji i checkpointów nadal nierozstrzygnięte (ASSET-LICENSE-REGISTER.md).

### 1. Krajobraz: tekstury podłoża (`terrain.*`)

Kafelkowane, bezszwowe, 512² (kamień i woda 1024²), RGBA tylko dla przejść. Cel: ok. **150 tekstur**, w tym 4 zestawy biomów po ok. 24 plus wspólne.

| Zestaw                       | Zawartość (przykłady)                                                                                                                                                                                                                                                          | Szt.        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Verdantia (las, rzeka, łąka) | 4 trawy, łąka z kwiatami, ściółka sosnowa, ściółka liściasta, mech, błoto, torf, pole uprawne, brzeg rzeki, kamyki dna, płycizna, głębia, bagno, ścieżka ziemna, bruk, zbocze trawiaste, polana grzybowa, paprocie, wrzosowisko, suchy step, piasek rzeczny                    | 24          |
| Aetheria (woda, ogrody, lód) | kryształowy lód, śnieg, zamarznięte jezioro, szczelina lodowca, mokry kamień, ścieżka z płyt, mchy świątynne, płatki wiśni, ziemia bambusowa, pole ryżowe, trzcina, staw koi, basen wodospadu, szron, szklisty szron, granit górski, tundra, wrzosy alpejskie, kamienne tarasy | 24          |
| Nexus-9 (syntetyczna)        | płyta stalowa, obwody, ciecz energetyczna, wydmy, skorupa pustyni, solnisko, zardzewiony stop, szkło, heksagony, żwir pustkowia, pole lodowe, popiół rdzeni, płyta serwisowa, piasek ze szkła, kable i rury, platforma lądowiska, mokre metale                                 | 24          |
| Pyra (wulkaniczna)           | lawa płynąca, zastygła skorupa, popiół, obsydian, czerwona skała kanionu, spalona ziemia, siarka, skorupa gejzeru, piasek żarowy, spękana glina, czarny piasek, tuf, bazaltowe kolumny (płaskie), pumeks, wypalony las (ziemia), żwir wulkaniczny                              | 24          |
| Wspólne skały i góry         | granit, wapień, bazalt, piaskowiec warstwowy, łupek, marmur, skała lodowa, tuf, rumowisko, zwietrzelina, glina czerwona, żwir, głazy w polu, 8 tekstur ścian klifów (pionowe)                                                                                                  | 30          |
| Przejścia (maski krawędzi)   | trawa ↔ skała, trawa ↔ piasek, śnieg ↔ skała, lawa ↔ popiół, woda ↔ brzeg, metal ↔ piasek i inne, 4 warianty krawędzi na parę                                                                                                                                                  | 24          |
| **Razem**                    |                                                                                                                                                                                                                                                                                | **ok. 150** |

### 2. Krajobraz: obiekty (`object.*`, RGBA)

| Rodzaj                          | Opis                                                                                                                                | Szt.        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Góry i szczyty                  | po 6 na kontynent (3 rozmiary × 2 warianty): granitowe, lodowe, bazaltowe, czerwone, skalne iglice, płaskowyże                      | 24          |
| Wulkany                         | czynny z dymem, uśpiony, kaldera z jeziorem lawy, stożek popiołowy, komin gejzeru (po 2 warianty), chmura popiołu (nakładka)        | 12          |
| Formacje skalne                 | łuki, iglice, mesy, grzyby skalne, kolumny bazaltowe, stalaktyty lodu, wysepki skalne                                               | 28          |
| Głazy i klify                   | 3 rozmiary × 8 rodzajów skały, półki klifowe, rozpadliny                                                                            | 40          |
| Drzewa                          | po biomie: iglaste, liściaste, bambus, wiśnia, kryształowe, martwe, spalone, kaktus/sukulent, grzyb olbrzymi, drzewo-antena (Nexus) | 48          |
| Krzewy, kwiaty, trawy, paprocie | wysokie trawy, pola kwiatowe, trzcina, krzaki jagód i ziół (surowce roślinne)                                                       | 36          |
| Woda                            | jeziora i stawy (kształty), wodospady, bystrza, gejzery, kałuże lawy, mostki, kładki, brody                                         | 18          |
| Ruiny Chóru i punkty wiedzy     | filary, bramy, węzły sieci, latarnie wysp, wraki, znaczniki szlaków                                                                 | 30          |
| **Razem**                       |                                                                                                                                     | **ok. 236** |

Rozmiar obiektów: master 1024² (góry i wulkany do 2048 × 1536), klient maks. 512 (góry 1024); cienie wypalane przez silnik.

### 3. Neutralna fauna (`fauna.*`)

Zwierzęta **nie atakują**. Wypasają się lub żerują, uciekają przy zbliżeniu (promień ucieczki 260 j.), wracają po ok. 20 s. Zabicie ich nie daje XP i nie liczy się do zadań z bestiariusza (zasada z Księgi: surowców z obowiązkowych napraw nie wiążemy z losowym łupem). Dają **pożywienie i surowce** używane przez receptury (U-07…U-11, T-03, R-02, R-03). Dopuszczone sposoby zdobycia: polowanie (zwykły atak), zbieranie (jaja, miód, mleko, wełna, pióra bez zabijania) i wędkowanie (ryby, opcjonalnie).

Propozycja **32 gatunków** (po 8 na kontynent, w tym wodne i latające):

| Kontynent | Gatunek (rola)                            | Surowce                            |
| --------- | ----------------------------------------- | ---------------------------------- |
| Verdantia | jeleń szlachetny (stado, ucieka)          | mięso, skóra, poroże               |
| Verdantia | zając, królik (mały, szybki)              | mięso, futerko                     |
| Verdantia | bażant, kaczka (latają)                   | mięso, pióra, jaja                 |
| Verdantia | owca górska/koza (wypas)                  | wełna, mleko, mięso                |
| Verdantia | pszczoła (rój, nie atakuje)               | miód, wosk                         |
| Verdantia | ryba rzeczna (łowisko)                    | ryba                               |
| Verdantia | wiewiórka, lis (żerują, uciekają)         | futerko, orzechy (zbiór)           |
| Verdantia | żuraw leśny (bagno)                       | pióra, jaja                        |
| Aetheria  | karp koi, pstrąg górski (stawy)           | ryba, łuska                        |
| Aetheria  | żuraw biały (latający)                    | pióra                              |
| Aetheria  | jeleń sika, kozica                        | mięso, skóra                       |
| Aetheria  | żółw kamienny (powolny)                   | skorupa, mięso                     |
| Aetheria  | jedwabnik, ćma mgielna                    | jedwab, pył świetlny               |
| Aetheria  | królik kryształowy                        | futerko, odłamek kryształu (zbiór) |
| Aetheria  | kaczka mandarynka                         | mięso, pióra                       |
| Aetheria  | piżmak lodowy (lodowce)                   | futro, mięso                       |
| Nexus-9   | gazela solna                              | mięso, skóra                       |
| Nexus-9   | jaszczurka pustyni, wąż piaskowy (ucieka) | skóra, jad (zbiór)                 |
| Nexus-9   | żuk-sprzątacz (drona biologiczna)         | chitin                             |
| Nexus-9   | zając pustynny                            | mięso, futerko                     |
| Nexus-9   | ćma świetlna, motyl obwodów               | pył świetlny                       |
| Nexus-9   | ryba kolektora (zbiorniki)                | ryba                               |
| Nexus-9   | kozioł skalny                             | mięso, róg                         |
| Nexus-9   | szczur magazynowy (neutralny)             | skóra, części (zbiór)              |
| Pyra      | koza lawowa                               | mięso, róg                         |
| Pyra      | wół popiołowy (powolny, duży)             | mięso, skóra, róg                  |
| Pyra      | zając popiołowy                           | mięso, futerko                     |
| Pyra      | jaszczurka żaru                           | łuska                              |
| Pyra      | ptak ognistopióry (latający)              | pióra żaru                         |
| Pyra      | żółw obsydianowy                          | skorupa, mięso                     |
| Pyra      | ryba gorącego źródła                      | ryba                               |
| Pyra      | gołąb kanionu                             | mięso, pióra                       |

Surowce zwierzęce (propozycja listy, **do zatwierdzenia przez właściciela**): mięso, skóra, futerko, wełna, mleko, jaja, pióra, róg, poroże, ryba, łuska, jedwab, pył świetlny, miód, wosk, chitin, skorupa. Pożywienie przetworzone (ugotowane) jest zwykłym zużywalnym z U-07…U-11; nie powstaje nowy rodzaj waluty.

#### Animacje fauny

Profil `fauna`: 8 kierunków × 24 klatki (bezczynność 6, chód 8, ucieczka 6, trafienie/śmierć 4) = **192 klatki na gatunek**, master 384², klient 96², atlas ≤ 2048. Dla ptaków i ryb profil skrócony: 4 kierunki × 16 klatek. Razem 32 gatunki ≈ **5 400 klatek** (do 6 100 przy pełnym zestawie). Mały ruch dla owadów i wodnych (pętla bez kierunków).

Ikony surowców (17 typów × 2–3 warianty) i ikony przedmiotów z Księgi (broń 32, pancerz 30, biżuteria 12, narzędzia 8, zużywalne 16, półprodukty 6, klucze 12, materiały bestiariusza ok. 80) są w osobnej pozycji backlogu (UI).

### 4. Kolejność dostaw dla krajobrazu i fauny

1. **P0 — próbki** (po jednej): trawa verdantyjska z przejściem do skały, góra (1024²), wulkan, bryła skalna, drzewo, jeleń z kompletem klatek, ikona mięsa.
2. Po akceptacji: **zestawy biomów** (4 × 24 tekstury) → obiekty (góry, skały, drzewa) → przejścia → wulkany i woda → ruiny Chóru.
3. **Fauna**: najpierw 8 gatunków Verdantii (tam startuje większość graczy), potem po 8 na kolejne kontynenty.
4. Import walidowanym importerem (rozmiary, klatki, SHA-256, budżet 128 MiB), opt-in, ocena na telefonie.

### 5. Wymagania kodowe (po stronie repo, bez GPU)

- Silnik fauny: neutralne AI (wypas, ucieczka, powrót), brak obrażeń i XP, zbiór i polowanie, limity aktywnych zwierząt w pobliżu gracza (PERF-01), respawn po opuszczeniu obszaru.
- Rozmieszczenie: generator pokrycia kontynentu (biomy według pozycji na atlasie, tekstury i obiekty z gęstością), kolizje z listy obiektów; **spawny potworów z bestiariusza nadal dopiero po ukończeniu kontynentów** (decyzja właściciela).
- Kamera i minimapa regionu na dużych dystansach, podróż między miastami (osobne zadanie).

### 6. Decyzje do zatwierdzenia

1. Lista 32 gatunków i surowców zwierzęcych (czy dodać lub usunąć, w tym czy ryby i wędkowanie wchodzą od razu).
2. Gęstość świata: pełne pokrycie całego kontynentu od razu czy najpierw pas wokół miasta o promieniu ok. 15 000 j.
3. Styl zwierząt: malowany jak potwory, czy prostszy (mniej klatek).
4. Prawa do referencji i checkpointów oraz moment uruchomienia poda (po stronie właściciela).

## Pyra — archiwum koncepcji 04.11.2026

Na gałęzi `art/pyra-materials-2026-11-04` zachowano [10 plansz PNG, manifest z SHA-256 i dostępne prompty](../art/production/pyra-concepts-2026-11-04/): 52 wzory podłoży, dróg, roślin, form terenu, przejść, dekoracji, rekwizytów oraz statycznych efektów. To archiwum wygenerowanych koncepcji; nie jest paczką runtime. Wymaga wydzielenia elementów, oczyszczenia alfa/poświat, sprawdzenia kafelkowania i przygotowania animacji efektów przed importem do gry.

## Verdantia — dodatkowe koncepcje 04.11.2026

[Archiwum 4 plansz i promptów](../art/production/verdantia-extra-concepts-2026-11-04/) zawiera 26 nowych wzorów: 8 roślin podszytu, 6 drzew i elementów drewna, 6 form terenu oraz 6 rekwizytów eksploracji. Gałąź `art/verdantia-extra-2026-11-04`. To materiały koncepcyjne; przed importem wymagają wydzielenia, oczyszczenia tła/poświat i oceny skali oraz kotwic.

## Verdantia — przygotowane dodatkowe grafiki runtime

Pakiet [verdantia-extra-runtime](../art/production/verdantia-extra-runtime/) zawiera 26 osobnych sprite’ów wyciętych z przygotowanych przez `image_gen` wersji czterech plansz. Pierwotne koncepcje są zachowane. Wycięcia mają przezroczyste tło, puste marginesy i rozmiary 192/256/384/512 px; pełny pakiet ma 10,37 MiB rozkodowanych pikseli i około 3,18 MiB plików. Włącza go istniejąca opcja `ki-verdant-continent=1`, razem z podłożami i drogami. Przypisania mają osobne klucze `object.verdantia-extra.*`; miasta i statystyki nie są nadpisywane.

Odtworzenie: `node art/production/verdantia-extra-runtime/prepare.mjs`, następnie `npm run assets:import -- art/production/verdantia-extra-runtime/manifest.json --install` (przy ponownej instalacji dodać `--replace`). Pochodzenie, źródła i SHA-256 są w tym samym pakiecie. Warianty drzew i podszytu są deterministyczne, a fizyczne footprinty, kotwice i położenia pozostają źródłowe.

## Pyra — pakiet kontynentu runtime 04.11.2026

Pakiet [pyra-continent-v2@1.0.0](../art/production/pyra-continent-v2/)
wydziela 52 obrazy z dziesięciu zachowanych plansz: 14 materiałów powierzchni,
33 obiekty oraz 5 efektów otoczenia. Pięć plansz (rośliny, dwa zestawy terenu,
przejścia, rekwizyty) oczyszczono przez `image_gen`; oryginalne koncepcje
pozostają w osobnym archiwum. `provenance.json` i `sources.sha256.json`
zapisują pochodzenie oraz SHA-256. Importer stosuje osobne wiązania
`terrain.pyra-continent.*` i `object.pyra-continent.*`, opt-in
domyślnie włączone od 05.11.2026 (`ki-pyra-continent=0` wyłącza); nie zastępuje wcześniejszych kluczy katalogu.

Odtworzenie: `node art/production/pyra-continent-v2/prepare.mjs`, następnie
`npm run assets:import -- art/production/pyra-continent-v2/manifest.json --install`
(przy ponownej instalacji dodać `--replace`). Przy wycinaniu usuwane są wyłącznie
małe, odłączone fragmenty sąsiednich elementów dotykające krawędzi komórki.
Sprite’y mają przezroczysty margines. Materiały dróg wycięto ze środkowego pasa,
a brzegi z części stałego gruntu, żeby nie nakładać obrazu cieczy na szlak.

Runtime: 7 773 994 bajty, 26,65 MiB rozkodowanych pikseli; pełny digest
`55660ce18ae52d4d64d648e84920baa448b6923136142f42ed6e6edbcbaadd00`.
Tylko najbliższe fragmenty świata i widoczne obiekty są streamowane.
Koncepcje efektów mają animację transformacji/alfa; nie są pełnymi animacjami
klatkowymi. Odbiór na fizycznym telefonie pozostaje otwarty.

## Aetheria — pakiet kontynentu runtime 04.11.2026

Pakiet [aetheria-continent-v2@1.0.0](../art/production/aetheria-continent-v2/)
zawiera 36 osobnych obrazów: 14 powierzchni i 22 obiekty. Zachowano wszystkie
20 materiałów źródłowych z gałęzi `art/world-verdantia-v2`, ich manifest oraz
prompty; SHA-256 oryginalnych obrazów zweryfikowano przed przygotowaniem.
Do runtime wybrano 10 istniejących materiałów powierzchni. Pozostałe cztery
nawierzchnie i 22 obiekty przygotowano przez `image_gen`, aby zastąpić blade
podłoża i obiekty z wodnymi/kamiennymi podstawkami.

Cztery plansze generacji, trzy oczyszczone plansze obiektów, komplet użytych
promptów i źródłowe SHA-256 są zachowane w `source/`, `provenance.json` oraz
`sources.sha256.json`. Obróbka tła i marginesów korzysta z `image_gen`;
`prepare.mjs` technicznie wydziela komórki, usuwa małe odłączone fragmenty
sąsiednich obiektów przy krawędzi, skaluje i dodaje przezroczysty margines.
Drogi i nurt wykorzystują środkowy pas obrazu, żeby nie namalować pozornej
wody na przechodnim lądzie. Osiem niewykorzystanych starych obiektów oraz dwa
stare podłoża pozostają w archiwum źródłowym.

Odtworzenie: `node art/production/aetheria-continent-v2/prepare.mjs`, potem
`npm run assets:import -- art/production/aetheria-continent-v2/manifest.json --install`
(przy ponownej instalacji dodać `--replace`). Rejestr ma osobne wiązania
`terrain.aetheria-continent.*` i `object.aetheria-continent.*`; istniejące klucze
nie są nadpisywane. Domyślnie włączone od 05.11.2026; `ki-aetheria-continent=0` wyłącza.

Runtime: 5 331 248 bajtów, 16,21 MiB rozkodowanych pikseli. Digest:
`3117f4ea8b96a9ffc9cf799a03f519f78ef8928a4cb91c372127bcce58f4a931`.
Gra korzysta ze streamingu i dotychczasowych budżetów. Odbiór płynności
na fizycznym telefonie pozostaje otwarty; programowy WebGL sprawdza poprawność.

## Nexus — komplet materiałów kontynentu 04.11.2026

[Pakiet nexus-continent-v2](../art/production/nexus-continent-v2/) zawiera
64 osobne obrazy WebP: 8 podłoży, 6 nawierzchni dróg, 8 roślin, 8 form terenu,
10 rekwizytów, 6 struktur, 6 materiałów wody/brzegów, 6 statycznych nakładek
VFX oraz 6 budynków/przejść. Łącznie 20 powierzchni, 38 obiektów i 6 efektów.
Dwa budynki uzupełniają nowszą oprawę warsztatu i gospody/punktu regeneracji;
cztery pozostałe budynki usługowe miasta mają już malowane zasoby. Ich stan
oraz SHA-256 istniejących plików zapisuje `existing-city.json`.

Wygenerowano dziewięć plansz przez `image_gen`, a cztery z nich dodatkowo
oczyszczono edycją alfa i marginesów. Oryginały, oczyszczone wersje, wszystkie
prompty i pochodzenie pozostają w `source/` i `provenance.json`. Przygotowanie:
`node art/production/nexus-continent-v2/prepare.mjs`. Osobne bindingi
`terrain.nexus-continent.*` oraz `object.nexus-continent.*` nie nadpisują miasta.
Wielkość plików: 4 458 920 bajtów, 33,87 MiB rozkodowanych pikseli całego zestawu.

Pakiet jest materiałem do integracji, `previewOnly: true`; nie wpisano go do
aktywnego katalogu i nie włączono w grze. `coverage.json` wymienia grupy i dalsze
prace: przypisania, maski lądu/wody, footprinty, skala/gęstość i odbiór w runtime.
Efekty są pojedynczymi przezroczystymi obrazami do późniejszej animacji,
a nie animowanymi sekwencjami. Ciągłość tekstur, maski brzegów i wydajność
wymagają oceny podczas integracji. Bohaterowie, potwory, HUD i audio pozostają
osobnymi istniejącymi zasobami. [Kontrole i podgląd](zmiany/2026-11-04/ZMIANY.md#nexus--komplet-materiałów-kontynentu).

## Nexus-9 — integracja oprawy kontynentu 05.11.2026

Ten wpis zastępuje akapit „nie wpisano go do aktywnego katalogu" powyżej.

Pakiet [nexus-continent-v2@1.0.0](../art/production/nexus-continent-v2/) jest
zaimportowany do rejestru i podłączony do renderu świata. Rejestr po instalacji:
11 319 728 bajtów, digest `74639393a0f03565c127b81ee164885c9ecd3128e687be49a138c8efb7df06d1`,
katalog zasobów `public/game/assets/gpu/nexus-continent-v2/1.0.0-74639393a0f0/`.
Dekodowane piksele zestawu 33,87 MiB; budżet dekodowany świata Nexus-9 po instalacji
106 541 856 B (101,6 MiB) z limitu 128 MiB. Odtworzenie:
`node art/production/nexus-continent-v2/prepare.mjs`, potem
`npm run assets:import -- art/production/nexus-continent-v2/manifest.json --install`
(przy ponownej instalacji dodać `--replace`).

Wiązania są osobne: `terrain.nexus-continent.*` i `object.nexus-continent.*` nie
nadpisują żadnego istniejącego klucza ni miasta. Blok generyczny renderera żąda pod
prefiksem kontynentu nazw `sand`, `water` i `road1…roadN`, których pakiet nie używał
(`dry-shore`, `ocean`, `road-paved`), dlatego manifest zawiera siedem aliasów na te
same zasoby. Runtime: `src/game/world/generated/nexusContinent.ts` — cztery podłoża
biomów mapowane 1:1 na `biomeNames` ze `world.json`, przepisanie scenerii na realne
identyfikatory autorowane (`nexus-lab`, `nexus-monolith`, `nexus-reactor`,
`nexus-terminal`, obozowiska), roślinność przydrożna, efekty ambientowe i rozrzut
dekoracyjny.

**Włączanie:** `?ki-nexus-continent=1`. Pakiet NIE jest w `DEFAULT_ON_SWITCHES` —
czeka na odbiór właściciela, zgodnie z zasadą, że domyślnie włącza się dopiero
zaakceptowaną oprawę.

**Gęstość dziczy.** Dane autorowane niosą poza miastem 8–16 obiektów na kadr
przeciw 104 w stolicy, więc sama paleta nie usuwa pustki. Rozrzut dokłada obiekty
**nieistotne fizycznie** (bez `footprint`, `solid: false`) z limitem 40 na strumieniowany
chunk; kolizje, nawigacja, spawny i zapisy pozostają bez zmian. Zmierzono w buildzie
playtest na programowym WebGL: 8 → 20, 13 → 23, 12 → 23, 16 → 33 dekoracji, zero
błędów konsoli. Cząstki powietrzne są tylko w biomach ciepłych — gęstsze pole
wymusiło wygasanie zrzutu.

**Testy.** `src/test/nexus-continent.test.ts` (8): opt-in, brak nadpisania istniejących
wiązań, aliasy, odczyt komórek biomu bez zmiany chunka, nienaruszalność miast i
obiektów fizycznych, warianty koron według biomu, nieistotność rozrzutu i limit cząstek.
`e2e/nexus-continent.spec.ts` w projekcie `software-webgl` (rejestracja w
`playwright.config.ts`). **Nie wykonano go pomyślnie w kontenerze agenta**: pada na
budżecie marszu 90 s przy tempie ~10,6 jednostki/s na programowym WebGL — identycznie
jak istniejący `aetheria-continent.spec.ts`, którego nie zmieniano. Odbiór na fizycznym
telefonie pozostaje otwarty.

## Superior — grafiki sześciu wysp, 05.11.2026

`art/production/superior-islands-v1/` zawiera 12 nowych oryginalnych arkuszy PNG
1536×1024, 12 opisów atlasów w formacie ramek Phaser/TexturePacker, pełne prompty,
rejestr sześciu wysp i pochodzenie. To **36 tekstur i 36 dekoracji w arkuszach**,
a nie 72 osobne pliki obrazów. Źródła wygenerowano narzędziem OpenAI image_gen,
bez referencji obrazkowych; dokładny model nie został zwrócony przez narzędzie.
Oryginalne bajty PNG zachowano; nie wycinano ani nie przemalowywano ich skryptem.

Wyspy mają osobne palety i materiały: polarna perła/akwamaryn, jadeit/źródła,
ametyst/stare złoto, ciepły neutralny port, srebrzyste mokradła oraz bazalt/żar/szron.
To propozycja kierunku oprawy zgodna z bieżącymi powinowactwami i koncepcjami wysp,
nie zmiana ich położenia, biomów, nazw kanonicznych ani geometrii. Nazwy z księgi
pozostają nazwami projektowymi.

Podgląd galerii: `art/production/superior-islands-v1/preview.html` (pliki lokalne,
bez CDN). Zestaw nie jest podpięty do gry. Ramki 512×512 są opisem pól arkusza;
przed importem trzeba odebrać krawędzie/matowanie i marginesy dekoracji, rozmiar,
punkt oparcia i footprint zgodny z kolizją. Kanał alfa jest obecny, ale miękkie
piksele tła wymagają oceny na rzeczywistym podłożu. Tekstury nie mają jeszcze
certyfikowanego powtarzania bez szwu. Arkusza nie wolno używać jako kompletnej mapy.
Nie ładować wszystkich wysp jednocześnie: dwa aktywne arkusze to około 12 MiB
surowego RGBA przed mipmapami, bez pomiaru wydajności telefonu.

Kontrola plików: `python3 art/production/superior-islands-v1/validate.py`.
[Wyniki, zakres i instrukcja](zmiany/2026-11-05/ZMIANY.md#grafiki-i-tekstury-sześciu-wysp-superior).

## Wyspy Superiora — integracja własnych materiałów 05.11.2026

Dostawa `art/production/superior-islands-v1/` (12 atlasów PNG 1536 × 1024, 36 klatek
podłoży i 36 rekwizytów, po 6 na wyspę; `status: generated-source-atlases-not-installed`)
została zainstalowana w rejestrze jako sześć pakietów `superior-island-{1..6}-art@1.0.0`,
każdy `previewOnly: true` z dwoma zasobami typu `atlas` i 14 wiązaniami.

Wiązania: `terrain.island-N.biome-{0..3}`, `terrain.island-N.{road,plaza,shore,water}`
(wyspa 6 ma `lava` zamiast `water`) oraz `object.island-N.{tree,flora,rock,landmark,arch,cargo}`.
Poprzednio dane świata prosiły o wiązania kontynentu macierzystego, więc wyspy nie miały
własnego wyglądu. Runtime: `src/game/world/generated/islandArt.ts` — przepisanie `FeatureArt`
i obiektów scenerii oraz składanie kafli toroidalnie, bo dostawa nie certyfikowała
bezszwowości w Phaser.

Odtworzenie: generator manifestów (port z PIL na `sharp`) tworzy
`island-N/runtime-pack.json`, potem sześć razy
`npm run assets:import -- art/production/superior-islands-v1/island-N/runtime-pack.json --install`.
Digesty z instalacji: `ab61814f…`, `29d4cb44…`, `de4c05c6…`, `33fdccb6…`, `2cdf7913…`, `e72bce69…`.

Włączanie: `?ki-islands-art=1`, poza `DEFAULT_ON_SWITCHES` do czasu odbioru właściciela.
Kolizje, footprinty, spawny i zapisy nie są zmieniane; rekwizyty overlayu są nieistotne
fizycznie. Odbiór na fizycznym telefonie pozostaje otwarty.

## Generator dekoracji świata — `?ki-dress=1` (06.11.2026)

Pomiar na danych `public/game/worlds/superior-v2`, okno kadru 1452 × 903 jednostek świata
(900 × 560 px przy domyślnym zoomie 0,62): dzicz kontynentów ma **6–12 obiektów autorskich
w kadrze**, dzicz wysp **30–79**, a 29 % chunków kontynentów nie ma ani jednego. Żadna osada
nie ma dekoracji autorskiej w swoim obszarze, a wyspy nie mają ani jednej pozycji
`acceptedCityScenery` (kontynenty 64–130). Podmiana materiałów tego nie zmienia: własne
tekstury wysp przebudowały 55–69 % pikseli kadra, a liczba dekoracji w kadrze została bez
zmian. Dlatego generator dokładuje **obiekty sceniczne**, nie paletę.

`src/game/world/generated/worldDress.ts`:

- `continentDress` — siatka co 150 j. świata z polem gęstości liczonym w komórkach 700 j.,
  żeby wyszły gaje i polany zamiast kratki. Limit 130 obiektów na chunk. Zmierzone:
  **108 obiektów na chunk, 36 w kadrze** na każdym z czterech kontynentów, czyli z 6–12 do
  ok. 42–48. Miksy są wpisane jako pełne identyfikatory wiązań i filtrowane po
  `catalog.renderBindings`, więc generator nie poprosi o grafikę, której nie ma w katalogu —
  brak wiązania to twardy błąd „Brak grafiki świata", a nie ciche pominięcie.
- `continentAir` — pył, dym i motylki tylko dla Nexusa i Pyry (+11 na chunk), bo tylko te
  pakiety mają wiązania `fx-*`. Dla Verdantii i Aetherii zwraca pustkę; efekt z innego lądu
  wymagałoby dociągnięcia jego pakietu.
- `townDress` — pierścień 380–1700 j. wokół placu osady, omija obrysy budynków (+40 j.),
  trakty (+50 j. od połowy szerokości) i ulice. Limit 320. Zmierzone: **154–172 dekoracje
  na osadę, 25–28 w kadrze przybycia** (baza zero), z motywów `object.island-N.*`.
- Wszystko `solid: false` i bez `footprint`, więc kolizje, nawigacja, questy i zapisy czytają
  nadal świat autorski. Dekoracja nie dokłada ani jednej pozycji katalogu ani bajta budżetu
  tekstur — używa pakietów już zainstalowanych.

Włączanie: `?ki-dress=1`. **Nie włączono domyślnie.** Warstwy kontynentów Verdantia, Pyra i
Aetheria są domyślnie włączone (decyzja właściciela 05.11.2026), więc ta dekoracja zmieniłaby
kadr każdego gracza bez odbioru. Pieczona flora (`?ki-flora-bake=1`) została wycofana po
pomiarze 0,1–0,3 % zmienionych pikseli — patrz dziennik 05.11.

Pomiar efektu: pary kadrów `dress-off` / `dress-on` na czternastu punktach (pusty i typowo
pełny kadr na każdym kontynencie, plac osady na każdej wyspie) oraz różnica pikseli `sharp`.
Scenariusz e2e nie powstał — w kontenerze agenta programowy WebGL nie mieści się w budżetach
czasu speców, więc dowodem są kadry i licznik `data-dress-scenery`, nie zielony test.
