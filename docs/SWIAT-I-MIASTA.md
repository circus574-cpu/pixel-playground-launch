# KI Legends — świat, kontynenty i miasta

Stan: 23.10.2026, `origin/main` na `d0bfc2c`. Wszystkie cztery miasta mają wspólne
wejścia, wnętrza i usługi. Dawne opisy „dane gotowe, mechanik brak” są nieaktualne.

## Planeta Superior i kontynenty

## Matematyka

- Cztery miasta tworzą **czworościan foremny na kuli**. Tylko taki układ daje równą odległość każdej pary. Odległość kątowa to acos(−1/3) = 109,47°, więc promień planety wynosi **R = 80 000 / 1,9106 = 41 870,9 j.**, obwód 263 083 j.
- Przy równiku 1 jednostka atlasu (2000×1000) to 131,54 j. gry.
- Miasta: Aetheria 61°E/35,26°N, Verdantia 119°W/35,26°N, Pyra 29°W/35,26°S, Nexus-9 145°E/35,26°S (czworościan obrócony o 16°, aby żaden kontynent nie przeciął szwu atlasu).
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
Nowego rozmieszczenia 40 potworów nie dodajemy przed ukończeniem kontynentów.

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
Najpierw odbiór układu i wejść, potem grafika i spawny zewnętrzne.
Testy `city`, `aetheria-city`, `nexus-city`, `pyra-city` sprawdzają separację,
osiągalność, brak walki w mieście i zachowaną walkę poza granicą. Wynik testu nie
zastępuje oceny wyglądu i fizycznego telefonu.
