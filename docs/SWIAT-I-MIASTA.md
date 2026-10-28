# KI Legends — świat, kontynenty i miasta

> **Stan obowiązujący 28.10.2026 (`main@30f7b8d5`):** od PR #44 domyślny jest Superior v2, PR #49 włączył malowane tekstury Gemini, `954dd3ee` dodał mapę 2D w Coder, a PR #52 zoptymalizował preloading i renderowanie mapy w grze. Niżej zachowano historyczne opisy gałęzi z 23–24.10; sformułowania „v1 aktywny” i „bez scalenia” są datowanymi checkpointami, **nie opisem obecnej produkcji**.
>
> **Kanon nie jest tożsamy z odbiorem:** 45% lądu / 55% wody na sferze (4 kontynenty i 6 wysp), maks. 20 rozległych podziemi (4–5 labiryntów), przejścia między kontynentami oraz bezstratne migracje nadal wymagają niezależnego sprawdzenia aktywnej geometrii, nawigacji, questów i zapisów. Historyczne 152 podziemia nie są 152 gotowymi grywalnymi lokacjami. Mapa Coder ma dodatkowo niezaliczoną interakcję wyboru miast/lokacji; patrz [audyt 28.10](zmiany/2026-10-28/ZMIANY.md#audyt-niezależny-28102026--stan-po-pr-52).



## Superior — jedyny świat gry

Decyzja właściciela 24.10.2026: Superior zastępuje cztery stare mapy gry.
Na `feature/superior-runtime-20261023` zwykłe wejście uruchamia wygenerowany
kontynent pochodzenia postaci. Flaga `ki-superior` nie jest potrzebna.
Zmiana pozostaje na gałęzi, bez scalenia do main i publikacji.
Dziesięć lądów ma własny teren, minimapę z obrysu, kolizje i przypisania grafik.
Nowy renderer tworzy tekstury 512² dla chunków 2048 jednostek oraz sprite'y dekoracji
przy widoku; typowy limit to 12 chunków. Wyjątek zachowuje wszystkie widoczne chunki
przy szerszym widoku. Widoczne obiekty nie są zastępowane pełną ilustracją mapy.

Miasta usługowe przełączają własne drzwi, NPC i rynek; sześć istniejących mechanik
wnętrz pozostaje w `GameSession`. Cztery dekoracje wnętrz mają grafiki z partii 2,
pozostałe używają wcześniejszych zasobów. Domy, wejścia do lochów, zasoby i skrytki
są obecnie przedstawione w świecie; nie wszystkie mają jeszcze interakcje.
Podróże wybiera się na istniejącej mapie planety (2D lub 3D), przy punkcie
przybycia głównej osady. Osobna nakładka podróży została usunięta. Transfer nie
jest jeszcze symulacją żeglugi ani końcowym grafem rozkładów portów.

Spawny są czytane z osobnego przebiegu. Aktywacja do 1400 jednostek, usypianie
powyżej 1900, do dwóch nowych slotów na klatkę, do 16 korzeni i 24 przeciwników
łącznie z przywołaniami/rozszczepieniem. Jeden wpis oznacza jednego przeciwnika;
nie rozwija się automatycznie niesprawdzonych offsetów watahy. Budżet atlasów
może odłożyć dalszy rodzaj przeciwnika; pierwszeństwo mają bliższe sloty, a zranieni
przeciwnicy nie są usuwani dla zwolnienia pamięci. Potwory mają osobną
nawigację wykluczającą osady; ograniczenie dotyczy również ruchu latających istot.
Zranione/zaangażowane instancje zachowują stan w pamięci. Zdrowie i czas odrodzenia
są zapisywane razem z graczem; odrodzenie używa czasu ściennego przeglądarki,
więc upływa także po zamknięciu lokalnej gry. To lokalne PvE, nie ochrona serwerowa.

Jeden zapis postaci zawiera ląd, pozycję, ekwipunek, depozyt oraz stany spawnów.
Właściciel wybrał reset: nowa przestrzeń `:superior-world-v1:character:<id>`
nie importuje starych postaci ani osobnych wypraw `:superior-v1`. Stare bajty
pozostają archiwalne w pamięci przeglądarki, ale nie pojawiają się na liście gry.
Nowe postacie zaczynają od poziomu 1. Lista postaci czyta ten sam zapis co silnik.
Podróż zachowuje rasę i postęp. Walidacja geometrii i blokada konfliktu kart
pozostają aktywne; nowsze/uszkodzone dane nie są nadpisywane.

Widok roboczy po usunięciu prostokątnych wycinków:
[telefon — walka](zmiany/2026-10-23/qa/superior-runtime/world-review-mobile.png),
[stolica](zmiany/2026-10-23/qa/superior-runtime/world-review-capital.png).
Nie oznacza to końcowego odbioru wyglądu.

Otwarte: pełne wnętrza lochów z nagrodami, zbieranie zasobów, ukryte miejsca,
życie mieszkańców/karawany, grafiki NPC oraz odbiór wyglądu zainstalowanych 40 potworów,
limity i pomiary fizycznego telefonu. Poniższy opis generacji dotyczy danych źródłowych;
znaczniki `runtimeInstalled: false` zachowano w ich niezmienionych oryginałach.


Stan: 23.10.2026, `origin/main` na `d0bfc2c`. Wszystkie cztery miasta mają wspólne
wejścia, wnętrza i usługi. Dawne opisy „dane gotowe, mechanik brak” są nieaktualne.

## Planeta Superior i kontynenty

## Matematyka

- Cztery miasta tworzą **czworościan foremny na kuli**. Tylko taki układ daje równą odległość każdej pary. Odległość kątowa to acos(−1/3) = 109,47°, więc promień planety wynosi **R = 80 000 / 1,9106 = 41 870,9 j.**, obwód 263 083 j.
- Przy równiku 1 jednostka atlasu (2000×1000) to 131,54 j. gry.
- Miasta: Aetheria 61°E/35,26°N, Verdantia 119°W/35,26°N, Pyra 29°W/35,26°S, Nexus-9 151°E/35,26°S (czworościan obrócony o 16°, aby żaden kontynent nie przeciął szwu atlasu).
- Sześć wysp questowych leży w środkach sześciu krawędzi czworościanu, po 40 000 j. od dwóch miast: I biegun północny, VI biegun południowy, II 16°E/0°, III 106°E/0°, IV 164°W/0°, V 74°W/0°.
- Kontynenty i wyspy są zmniejszone do **0,5** oryginału i rzutowane azymutalnie równoodległościowo wokół swojego centrum (rozmiary i odległości od centrum są prawdziwe). Przy 0,5 kontynenty mają około 40–48 tys. × 23–30 tys. j. i mieszczą się między miastami.

## Pliki

- `src/game/world/planet.json` (generowany) i `planet.ts`: stałe, odległości, `sourceToPlanet`.
- `scripts/relayout_planet.py`: buduje nowy atlas, obrysy (`atlasRegions.json`) i `planetLayout.json` z `art/production/planet/atlas-source-3840.webp` oraz `atlasRegions.source.json`. Następnie `scripts/build_globe_textures.py` odtwarza tekstury globusa. Wymaga numpy, Pillow, opencv-python-headless, scipy.
- Minimapy i podglądy w menu (`scripts/build_atlas_minimaps.py`) pochodzą nadal z oryginalnego atlasu (bez zniekształcenia biegunowego); pozycje stref na mapie i globusie przelicza `sourceToPlanet`.
- Testy: `src/test/planet.test.ts` (80 000 między każdą parą, 40 000 wysp, rozmiary, brak nakładania), `open-world.test.ts`, `planet-globe.test.ts`.

## Mapa i podróże

`/mapa` i mapa w grze korzystają z jednego `MapaView`, `planetLayout`, obrysów i atlasu.
Globus WebGL ładowany leniwie; wersja 2D i brak WebGL zachowują te same hitboxy i wybór.
Nie zmieniać atlasu bez odtworzenia obrysów, minimap i tekstur globusa.
Plan czterech miast na kontynent jest dalszym rozwojem; dziś jest jedna lokalna
stolica na rasę z rozdzielonymi usługami. Podróże i sześć wysp z księgi są projektem.

## Wspólne mechanizmy miasta

`WorldDefinition.city?: CityDefinition`. Usługi: `shop`, `hall`, `inn`, `smithy`,
`depot`, `arena`; każda ma własny obiekt, nazwę, dzielnicę i osiągalny punkt `door`.
Odstęp między drzwiami usług co najmniej 700 jednostek; budynki mają osobne parcele.
NPC z `building` przebywa we wnętrzu; bez pola jest mieszkańcem ulicy.
Wnętrza mają lokalną nawigację, ściany i meble; wyjście wraca pod konkretne drzwi.
Wybór innej usługi prowadzi przez wyjście i jej drzwi, nie teleportuje między rozmówcami.

`city.bounds` jest bezpiecznym obszarem w świecie z walką; `inSafeCity()` chroni
postać i blokuje ściganie/atak przez granicę. Brak `bounds` oznacza cały etap miejski
(`isCityStage`), jak w Verdantii. Aetheria/Nexus/Pyra zachowują dziki poza miastem.
Właściciel 23.10 zlecił teraz generację całej planety i osobny przebieg spawnów
na gotowej geometrii; zastępuje to wcześniejsze odłożenie rozmieszczania potworów.
Generacja danych i podłączenie ich do runtime są odrębnymi stanami.

Sklep: kupno/skup. Kowal: ulepszenie i zadanie sprzętu. Gospoda: HP/KI za 5 monet,
bez resetu cooldownów i opłaty przy pełnych zasobach. Depozyt: osobista skrzynia,
sprawdzenie bliskości/ilości/własności. Arena: manekin bez walki i nagród.
Szczegóły zapisu i ekonomii: [rozwój](ROZWOJ-I-WALKA.md).

Komendy: `enter`, `exit`, `interact`, `chest`, `storage-close`, `depot`, `rest`,
`training(start|reset|stop)`. Wspólne pliki: `city/types.ts`, `room.ts`,
`renderCity.ts`, `session.ts`, `mountGame.ts`, `CityPanels.tsx` i `GameHud.tsx`.
Przy równoległej pracy jeden wykonawca utrzymuje silnik, pozostali własne dane i art;
nie zmieniać równocześnie schematu zapisu i wspólnych paneli bez uzgodnienia.

## Układy i mieszkańcy

### Verdantia — Zielona Przystań

Dane: `src/game/city/verdantia.ts`. Układ pochodny z lasu, bez edycji źródłowego `forest-map.json`.

| Usługa          | Drzwi      | Rozmówca |
| --------------- | ---------- | -------- |
| Sklep           | 500, 725   | Mio      |
| Dom Wspólnoty   | 1400, 495  | Oren     |
| Gospoda         | 2100, 695  | Lina     |
| Kuźnia          | 500, 1605  | Taro     |
| Depozyt Korzeni | 1380, 1795 | Nela     |
| Dom Treningu    | 2080, 1655 | Iwo      |

Na ulicach: Aira i Ren. Cała mapa to obecnie bezpieczny etap miasta. Zachowano
rzekę, most i fontannę; odsunięto drzewa blokujące parcele i szerokie ulice.
Minimapa: `scripts/city/build-minimap.ts`, dane zgodne z układem runtime.

### Aetheria — Sanktuarium Tysiąca Źródeł

Dane: `src/game/world/regions/aether.json`. Odtworzenie: `python3 scripts/build_aetheria_city.py`.

Granica miasta: `{"x": 1400, "y": 1150, "width": 3300, "height": 2150}`.

| Usługa   | Budynek / dzielnica                      | Drzwi      | Rozmówca |
| -------- | ---------------------------------------- | ---------- | -------- |
| `hall`   | Sala Rady Źródeł / Wzgórze Źródła        | 2400, 1460 | Hoshi    |
| `shop`   | Pawilon Wymiany / Targ Wymiany           | 3250, 1880 | Mei      |
| `arena`  | Dziedziniec Skupienia / Ogród Pagód      | 3980, 1780 | Raku     |
| `depot`  | Skarbiec Zwojów / Zachodnie Tarasy       | 1850, 2277 | Kaede    |
| `smithy` | Warsztat Pieczęci / Dziedziniec Pieczęci | 3360, 3002 | Enso     |
| `inn`    | Herbaciarnia Cichych Wód / Staw Koi      | 1850, 2990 | Yuna     |

Na ulicach: Sora, Ishin.

### Nexus-9 — Węzeł Świadomości

Dane: `src/game/world/regions/nexus.json`. Odtworzenie: `python3 scripts/build_nexus_city.py`.

Granica miasta: `{"x": 1350, "y": 950, "width": 2050, "height": 1750}`.

| Usługa   | Budynek / dzielnica                         | Drzwi      | Rozmówca |
| -------- | ------------------------------------------- | ---------- | -------- |
| `hall`   | Centrum Synchronizacji / Rdzeń Sieci        | 2400, 1275 | VEGA-3   |
| `shop`   | Węzeł Wymiany / Targ Węzłów                 | 3100, 1577 | MIRA-2   |
| `arena`  | Komora Kalibracji Bojowej / Pole Kalibracji | 3100, 2327 | KRON-9   |
| `smithy` | Warsztat Uzbrojenia / Kuźnia Obwodów        | 2400, 2570 | HEF-4    |
| `depot`  | Magazyn Rdzeni / Archiwum Danych            | 1650, 2517 | ARCH-5   |
| `inn`    | Moduł Regeneracji / Strefa Regeneracji      | 1700, 1577 | SOLA-6   |

Na ulicach: LYRA-7, AXON.

### Pyra — Twierdza Popiołu

Dane: `src/game/world/regions/pyra.json`. Odtworzenie: `python3 scripts/build_pyra_city.py`.

Granica miasta: `{"x": 1350, "y": 950, "width": 2050, "height": 1750}`.

| Usługa   | Budynek / dzielnica                   | Drzwi      | Rozmówca |
| -------- | ------------------------------------- | ---------- | -------- |
| `hall`   | Sala Przysięgi / Bramy Twierdzy       | 2400, 1285 | Tsubasa  |
| `shop`   | Targ Klanów / Targ Klanowy            | 3100, 1572 | Yumi     |
| `arena`  | Plac Ćwiczeń Klanów / Pole Treningowe | 3100, 2325 | Kenzo    |
| `smithy` | Kuźnia Żaru / Palenisko               | 2400, 2582 | Goro     |
| `depot`  | Skarbiec Klanu / Skarbce              | 1650, 2512 | Mitsu    |
| `inn`    | Gospoda Pod Żarem / Ostoja            | 1700, 1572 | Akane    |

Na ulicach: Kaena, Rokan.

## Grafika i dalsza rozbudowa

Aetheria używa archiwów/pagód jako kilku różnych usług; Nexus powtarza laboratoria,
Pyra święte miejsca wojny. To zastępniki, nie gotowe indywidualne fasady.
Wspólne podłogi/meble `city-interiors` powstały programowo; dostawy GPU mają nadać
wnętrzom osobny wygląd ras. Paleta `CityDefinition.palette` i wiązania per świat:
`terrain.<worldId>.city-road`, `terrain.<worldId>.interior-floor|interior-stone`,
`object.<worldId>.interior.<chest|anvil|dummy|shelf|bed|desk>`; brak lokalnego wiązania
używa wspólnego fallbacku.

Dalsze prace: domy mieszkańców, bazary, dodatkowi NPC, porty i kolejne miasta.
Generacja pełnej geometrii poprzedza osobny przebieg spawnów; odbiór układu, grafiki
i integracja runtime pozostają wymagane przed wdrożeniem.
Testy `city`, `aetheria-city`, `nexus-city`, `pyra-city` sprawdzają separację,
osiągalność, brak walki w mieście i zachowaną walkę poza granicą. Wynik testu nie
zastępuje oceny wyglądu i fizycznego telefonu.


## Pełna generacja Superior na CPU — 23.10.2026

Polecenie właściciela obejmuje wszystkie 10 lądów, drogi, ścieżki, ukryte miejsca,
labirynty oraz **osobną generację spawnów**. `scripts/worldgen/planet_generate.py`
korzysta z `planet.json`, oryginalnych obrysów atlasu i nazw z `zones.json`.
Nie powiększa lądów arbitralnymi prostokątami i nie przenosi stolic ani wysp.
Wymiar pliku zawiera dwie komórki marginesu morza z każdej strony; rozmiar lądu
wynika z obrysu × `131.541422 × 0.5`, nie z rozmiaru otaczającego prostokąta.
Korekta opisu Nexus-9 z 145°E na 151°E odzwierciedla istniejące `planet.json`;
nie zmienia pozycji planety. Układ czworościanu i odległości pozostają obowiązujące.

Każdy kontynent ma zachowaną stolicę i trzy wygenerowane miasta, cztery strefy,
10 wiosek, 3 porty, 8 strażnic, 10 ruin, 8 jaskiń, 8 sanktuariów,
16 ukrytych skrytek i 8 labiryntów. Każda wyspa ma przystań usługową,
cztery sektory, 3 obozowiska, 2 porty, 3 ruiny, 2 jaskinie, 2 sanktuaria,
6 skrytek i 3 labirynty. Nowe nazwy osad/stref bez źródła są propozycjami;
zatwierdzone 12 nazw krain Aetherii, Nexusa i Pyry pozostaje bez zmian.

Nowe miasta mają sześć rozdzielonych usług, drzwi, NPC i referencje szablonów wnętrz;
wioski i porty mają osobne domy z footprintami i wejściami. Poza miastami są
rozgałęzione drogi z alternatywnymi połączeniami, ścieżki odkrywania, strumienie,
mosty, zasoby i dekoracje. Ruiny/jaskinie/labirynty mają oddzielne siatki wnętrz,
wejście, wyjście i zweryfikowane rozwiązanie. Są to dane do implementacji usług,
zbiorów, skrytek i wnętrz, nie nowy działający system nagród czy questów.

Każdy teren ma maskę zgodną z prawdziwym obrysem, chunkowanie 2048 jednostek,
raport osiągalności oraz manifest sum plików. Źródłowe mapy pozostają zapisane
bez zmian w `acceptedSource`; stolica jest osadzona pod kanonicznym punktem atlasu.
Do nowego terenu przenoszone są kolizje w bezpiecznej granicy miasta; sztuczne
zewnętrzne ściany starych map testowych nie otaczają całego kontynentu.
Nie jest to zainstalowana migracja zapisów ani nowy `WorldDefinition` runtime.
Dwanaście połączeń port–wyspa daje graf podróży całej planety. Łuki na globusie
są podglądem trasy transferu promowego, nie sprawdzoną nawigacją fizycznej łodzi.

`spawn_generate.py` czyta i weryfikuje manifest terenu, nie zmienia jego plików.
Rozmieszcza 40 istniejących rodzajów bestiariusza, w tym spawny wnętrz, z oryginalnymi
statystykami i respawnami. Wyspy korzystają z bestiariuszy dwóch sąsiednich kultur.
Dom potwora wyklucza drogę i bezpieczną osadę z marginesem większym niż maksimum
pościgu, wędrówki i aggro + 256. Siatka aktywacji i limit 24 to **kontrakt do podłączenia**,
nie zmierzona wydajność Androida ani już zaimplementowany streaming potworów.

Instrukcja uruchomienia i odbioru: [architektura](ARCHITEKTURA-I-TESTY.md#pełna-planeta-i-osobna-generacja-spawnów).


## Kontynenty w skali planety i miasta 4000 × 2500 (23.10.2026)

**Status: zaimplementowane w repo na gałęzi `feat/continent-worlds`, przetestowane jednostkowo (326 testów). Niezweryfikowane na telefonie i nieocenione wizualnie przez właściciela. Nie scalone z `main`, nie opublikowane.**

Decyzja właściciela: mapa to cała planeta; każdy lokalny kontynent ma rozmiar prawdziwego kontynentu z atlasu (PLANET-GEOMETRY-2026-10-22.md), a lokalne miasto to bezpieczna strefa około **4000 × 2500 j.** z budynkami rozmieszczonymi bez skupisk. Poza miastem jest pusty, ale dostępny teren; w miastach nie ma walki (NPC, handel, trening, rozmowy), poza nimi działa walka.

### Rozmiary

| Kraina    | Kontynent (świat gry) | Miasto (strefa bezpieczna) | Środek miasta (x, y) |
| --------- | --------------------- | -------------------------- | -------------------- |
| Verdantia | 49 000 × 31 400       | 4000 × 2500                | 34 176, 22 400       |
| Aetheria  | 44 300 × 27 400       | 4000 × 2500                | 23 964, 13 691       |
| Nexus-9   | 39 700 × 26 600       | 4000 × 2500                | 26 037, 11 533       |
| Pyra      | 42 000 × 25 300       | 4000 × 2500                | 34 347, 3 937        |

Wymiary kontynentów to prostokąty opisane na obrysach z `atlasRegions.json` przy skali planety (1 jednostka atlasu = 131,54 j.). Kontynenty nie są prostokątami: teren poza obrysem (ocean) nie jest jeszcze ograniczony. Położenie miasta w kontynencie wynika z jego punktu na atlasie (`zones.json`, `atlas.settle` względem `atlas.bbox`), więc minimapa i mapa świata zgadzają się z grą w prawdziwej skali.

### Co zrobiono

- **Dane trzech kontynentów** (`src/game/world/regions/{aether,nexus,pyra}.json`): skrypt `scripts/expand_continents.py` powiększa świat do rozmiaru kontynentu i przesuwa dotychczasową scenę (miasto, drogi, obiekty, dziki, strefy N/S/E/W razem z podłożem) tak, by jej punkt odniesienia leżał w miejscu miasta na atlasie. Nic nie jest skalowane. Zewnętrzne ściany są rysowane od nowa na krawędziach kontynentu. Zapisy z układu 2 przesuwa `layoutShifts["3"]` (`migrateLayout` w `session.ts` obsługuje kolejne układy).
- **Miasta 4000 × 2500**: skrypty `scripts/build_{aetheria,nexus,pyra}_city.py` rozkładają sześć usług z zachowaniem układu dzielnic na obszarze 3300 × 1900 w środku strefy, dobudowują drogi dojazdowe z drzwi do sieci dróg, latarnie i ogrody przy drzwiach, a dziki z wnętrza przenoszą na pierścień tuż za granicą miasta.
- **Verdantia** (`src/game/city/verdantia.ts`, `src/game/world/forest.ts`): malowana dolina 3072 × 2048 leży w świecie w punkcie `FOREST_ORIGIN` (32 640, 21 376); reszta kontynentu to to samo podłoże powtarzane dalej (kafelki 0–15 warstwy bazowej, strumieniowane kawałkami). Miasto Codexa zostało rozłożone na 4000 × 2500 (zachodni brzeg: handel i kuźnia; środek: sala i depozyt; za rzeką: gospoda i trening), drogi biegną przez most. Verdantia przestała być etapem „cała mapa to miasto”: ma bounds, dziki za miastem i standardowy przebieg zadań. Zapisy z etapu miejskiego (polowanie zablokowane, wprowadzenie ukończone) pozostają ważne.
- **Silnik**: nawigacja wypełnia siatkę leniwie i używa kopca (A* zachowuje wydajność na 49 000 × 31 400; heurystyka ważona 1,4, limit 120 000 komórek); podłoże regionów strumieniuje tylko kawałki wokół kamery; ozdoby powierzchni Aetherii i Nexus-9 są ograniczone do okolicy miasta; limit współrzędnych w zapisie podniesiony do 65 536; budżet tekstur importera liczy bufor terenu doliny, nie całego świata.
- **Mapa**: `zones.json` ma teraz wpis Verdantii (strefy N/S/E/W jeszcze nie nazwane, lista pusta), minimapa Verdantii to wycinek atlasu (`public/game/assets/stage3/verdant-minimap.webp`, `scripts/build_atlas_minimaps.py`).

### Drzwi usług

| Kraina    | hall           | shop           | inn            | smithy         | depot          | arena          |
| --------- | -------------- | -------------- | -------------- | -------------- | -------------- | -------------- |
| Verdantia | 33 890, 21 781 | 32 990, 22 011 | 35 790, 22 101 | 32 990, 23 151 | 33 940, 23 351 | 35 790, 23 201 |
| Aetheria  | 23 166, 12 871 | 24 483, 13 388 | 22 314, 14 751 | 24 653, 14 762 | 22 314, 13 873 | 25 614, 13 268 |
| Nexus-9   | 26 094, 10 708 | 27 687, 11 148 | 24 501, 11 148 | 26 094, 12 603 | 24 387, 12 522 | 27 687, 12 245 |
| Pyra      | 34 404, 3 122  | 35 997, 3 544  | 32 811, 3 544  | 34 404, 5 009  | 32 697, 4 907  | 35 997, 4 635  |

### Testy

`src/test/continent-scale.test.ts` (rozmiar kontynentu, strefa 4000 × 2500, drzwi ≥ 700 j. od siebie i rozrzucone po mieście, dojście do czterech narożników kontynentu, dziki poza miastem), `open-world.test.ts`, `city.test.ts`, `aetheria-city.test.ts`, `nexus-city.test.ts`, `pyra-city.test.ts`; e2e: `continent-scale.spec.ts` (spacer za miasto), `city.spec.ts`, `three-races-pve.spec.ts` (teraz także Planetarni).

### Czego nie ma (świadomie)

1. Treści poza miastami: kontynenty są puste, jeśli nie liczyć dotychczasowej sceny wokół miasta, dzików na pierścieniu i podłoża. Spawny potworów z bestiariusza i zadania to osobny etap (GAME-03).
2. Granice kontynentu według obrysu (wybrzeża, ocean), ściany z grafiką poza ramką prostokąta.
3. Nazwy i treść stref N/S/E/W Verdantii oraz wyspy questowe.
4. Dłuższe trasy: kamera, minimapa i mapa świata nie mają jeszcze przybliżenia na całą krainę; podróż po 40-tysięcznym kontynencie pieszo trwa kilka minut.
5. Pomiar FPS i pamięci na telefonie.

## Superior v2 — decyzja właściciela 24.10.2026

Nowy cel zastępuje ograniczenie skali 0,5: 45% lądu / 55% oceanów na sferze
(tolerancja ±0,5 pp), cztery istniejące kontynenty i sześć wysp. Rejestr projektu
obejmuje 18 podziemi, w tym cztery labirynty i cztery dwustronne połączenia
kontynentów. Nie oznacza to zatwierdzenia fizycznych tuneli pod oceanami.

Prototyp `public/game/worlds/superior-v2-prototype/` zachowuje nienaruszony v1.
Pomiar obrysu: 44,9982828678% lądu, 55,0017171322% oceanu; niezależna całka po
wybrzeżu daje ten sam wynik. Zachowane wody śródlądowe v1 to około 0,03166%
planety, więc suchy ląd również mieści się w tolerancji. Wszystkie dziesięć
lądów jest spójne; sprawdzono 827 położeń miast/NPC/drzwi. Szczegóły i mapy:
`audit.html`, `audit.json`, `validation.json`, `historical-dungeons.json`,
`dungeon-proposal.json`, `migration-report.json` w katalogu prototypu.
Generator: `scripts/worldgen/v2/build.py`; walidator: `validate.py` obok niego.

Najnowsze polecenie właściciela pomija osobną bramkę niezależnego audytu i
zezwala od razu tworzyć krajobraz oraz integrować nowy świat przy użyciu
istniejących grafik. Testy i ochrona zapisów pozostają wymagane. Nie wolno
scalać, publikować, usuwać v1 ani zmieniać infrastruktury GPU. Grafiki muszą
mieć osobne wiązania, aby późniejsze podmiany Claude'a nie zmieniały geometrii.

## Sale prób rozwoju — gałąź robocza 28.10.2026

Egzaminy mają osobną, logiczną salę 960 × 760 z dwiema przeszkodami i punktami
celów. Wejście prowadzi od istniejącego trenera; oryginalny runtime pozostaje
w pamięci i śpi. Nie zmienia się atlas, geometria kontynentów, położenie miast,
wysp ani rejestr podziemi. To nie nowy tunel ani nowy duży loch.
24 trwałe projekty świata z nowego zlecenia nadal wymagają realizacji i odbioru;
sama sala egzaminacyjna nie stanowi ich wdrożenia.
