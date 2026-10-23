# Kontynenty w skali planety i miasta 4000 × 2500 — 23.10.2026

**Status: zaimplementowane w repo na gałęzi `feat/continent-worlds`, przetestowane jednostkowo (326 testów). Niezweryfikowane na telefonie i nieocenione wizualnie przez właściciela. Nie scalone z `main`, nie opublikowane.**

Decyzja właściciela: mapa to cała planeta; każdy lokalny kontynent ma rozmiar prawdziwego kontynentu z atlasu ([PLANET-GEOMETRY-2026-10-22.md](PLANET-GEOMETRY-2026-10-22.md)), a lokalne miasto to bezpieczna strefa około **4000 × 2500 j.** z budynkami rozmieszczonymi bez skupisk. Poza miastem jest pusty, ale dostępny teren; w miastach nie ma walki (NPC, handel, trening, rozmowy), poza nimi działa walka.

## Rozmiary

| Kraina    | Kontynent (świat gry) | Miasto (strefa bezpieczna) | Środek miasta (x, y) |
| --------- | --------------------- | -------------------------- | -------------------- |
| Verdantia | 49 000 × 31 400       | 4000 × 2500                | 34 176, 22 400       |
| Aetheria  | 44 300 × 27 400       | 4000 × 2500                | 23 964, 13 691       |
| Nexus-9   | 39 700 × 26 600       | 4000 × 2500                | 26 037, 11 533       |
| Pyra      | 42 000 × 25 300       | 4000 × 2500                | 34 347, 3 937        |

Wymiary kontynentów to prostokąty opisane na obrysach z `atlasRegions.json` przy skali planety (1 jednostka atlasu = 131,54 j.). Kontynenty nie są prostokątami: teren poza obrysem (ocean) nie jest jeszcze ograniczony. Położenie miasta w kontynencie wynika z jego punktu na atlasie (`zones.json`, `atlas.settle` względem `atlas.bbox`), więc minimapa i mapa świata zgadzają się z grą w prawdziwej skali.

## Co zrobiono

- **Dane trzech kontynentów** (`src/game/world/regions/{aether,nexus,pyra}.json`): skrypt `scripts/expand_continents.py` powiększa świat do rozmiaru kontynentu i przesuwa dotychczasową scenę (miasto, drogi, obiekty, dziki, strefy N/S/E/W razem z podłożem) tak, by jej punkt odniesienia leżał w miejscu miasta na atlasie. Nic nie jest skalowane. Zewnętrzne ściany są rysowane od nowa na krawędziach kontynentu. Zapisy z układu 2 przesuwa `layoutShifts["3"]` (`migrateLayout` w `session.ts` obsługuje kolejne układy).
- **Miasta 4000 × 2500**: skrypty `scripts/build_{aetheria,nexus,pyra}_city.py` rozkładają sześć usług z zachowaniem układu dzielnic na obszarze 3300 × 1900 w środku strefy, dobudowują drogi dojazdowe z drzwi do sieci dróg, latarnie i ogrody przy drzwiach, a dziki z wnętrza przenoszą na pierścień tuż za granicą miasta.
- **Verdantia** (`src/game/city/verdantia.ts`, `src/game/world/forest.ts`): malowana dolina 3072 × 2048 leży w świecie w punkcie `FOREST_ORIGIN` (32 640, 21 376); reszta kontynentu to to samo podłoże powtarzane dalej (kafelki 0–15 warstwy bazowej, strumieniowane kawałkami). Miasto Codexa zostało rozłożone na 4000 × 2500 (zachodni brzeg: handel i kuźnia; środek: sala i depozyt; za rzeką: gospoda i trening), drogi biegną przez most. Verdantia przestała być etapem „cała mapa to miasto”: ma bounds, dziki za miastem i standardowy przebieg zadań. Zapisy z etapu miejskiego (polowanie zablokowane, wprowadzenie ukończone) pozostają ważne.
- **Silnik**: nawigacja wypełnia siatkę leniwie i używa kopca (A* zachowuje wydajność na 49 000 × 31 400; heurystyka ważona 1,4, limit 120 000 komórek); podłoże regionów strumieniuje tylko kawałki wokół kamery; ozdoby powierzchni Aetherii i Nexus-9 są ograniczone do okolicy miasta; limit współrzędnych w zapisie podniesiony do 65 536; budżet tekstur importera liczy bufor terenu doliny, nie całego świata.
- **Mapa**: `zones.json` ma teraz wpis Verdantii (strefy N/S/E/W jeszcze nie nazwane, lista pusta), minimapa Verdantii to wycinek atlasu (`public/game/assets/stage3/verdant-minimap.webp`, `scripts/build_atlas_minimaps.py`).

## Drzwi usług

| Kraina    | hall           | shop           | inn            | smithy         | depot          | arena          |
| --------- | -------------- | -------------- | -------------- | -------------- | -------------- | -------------- |
| Verdantia | 33 890, 21 781 | 32 990, 22 011 | 35 790, 22 101 | 32 990, 23 151 | 33 940, 23 351 | 35 790, 23 201 |
| Aetheria  | 23 166, 12 871 | 24 483, 13 388 | 22 314, 14 751 | 24 653, 14 762 | 22 314, 13 873 | 25 614, 13 268 |
| Nexus-9   | 26 094, 10 708 | 27 687, 11 148 | 24 501, 11 148 | 26 094, 12 603 | 24 387, 12 522 | 27 687, 12 245 |
| Pyra      | 34 404, 3 122  | 35 997, 3 544  | 32 811, 3 544  | 34 404, 5 009  | 32 697, 4 907  | 35 997, 4 635  |

## Testy

`src/test/continent-scale.test.ts` (rozmiar kontynentu, strefa 4000 × 2500, drzwi ≥ 700 j. od siebie i rozrzucone po mieście, dojście do czterech narożników kontynentu, dziki poza miastem), `open-world.test.ts`, `city.test.ts`, `aetheria-city.test.ts`, `nexus-city.test.ts`, `pyra-city.test.ts`; e2e: `continent-scale.spec.ts` (spacer za miasto), `city.spec.ts`, `three-races-pve.spec.ts` (teraz także Planetarni).

## Czego nie ma (świadomie)

1. Treści poza miastami: kontynenty są puste, jeśli nie liczyć dotychczasowej sceny wokół miasta, dzików na pierścieniu i podłoża. Spawny potworów z bestiariusza i zadania to osobny etap (GAME-03).
2. Granice kontynentu według obrysu (wybrzeża, ocean), ściany z grafiką poza ramką prostokąta.
3. Nazwy i treść stref N/S/E/W Verdantii oraz wyspy questowe.
4. Dłuższe trasy: kamera, minimapa i mapa świata nie mają jeszcze przybliżenia na całą krainę; podróż po 40-tysięcznym kontynencie pieszo trwa kilka minut.
5. Pomiar FPS i pamięci na telefonie.
