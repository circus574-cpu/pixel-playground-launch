# Nexus-9 — miasto Androidów (Węzeł Świadomości), 23.10.2026

**Status: UKŁAD I DANE GOTOWE W REPO, PRZETESTOWANE JEDNOSTKOWO. Wnętrza, handel, kowal, depozyt i trening to wspólne mechaniki rozwijane na gałęzi Codexa (zob. kontrakt `docs/CITY-INTEGRATION-CONTRACT-2026-10-23.md` na gałęzi `feature/verdantia-functional-city-20261023`) — tu ich NIE ma. Niezweryfikowane na telefonie i nieocenione wizualnie przez właściciela. Nie scalone z `main`, nie opublikowane.**

Zakres gałęzi `feat/nexus-city`: dane, układ, wygląd i dokumentacja miasta Androidów. Nie zmieniano `session.ts`, `mountGame.ts`, paneli HUD, schematu zapisu ani importera. Analogiczne miasto Mędrców: [CITY-AETHERIA-2026-10-23.md](CITY-AETHERIA-2026-10-23.md) (gałąź `feat/aetheria-city`).

## 1. Co powstało

Rdzeń Nexus-9 jest ciaśniejszy niż doliny pozostałych kontynentów (ok. 2350 × 1750 j.), więc sześć usług ustawiono na **pierścieniu wokół centralnych dróg i placów**, każda w osobnej dzielnicy i ≥ 700 jednostek od pozostałych (test). Mapy nie powiększano. Obszar bezpieczny: `1350–3400 × 950–2700`, wąski wokół doliny, żeby budynki nie stały przy pustyni ani lodowej strefie.

| Id usługi | Budynek                   | Dzielnica          | Drzwi (x, y) |
| --------- | ------------------------- | ------------------ | ------------ |
| `hall`    | Centrum Synchronizacji    | Rdzeń Sieci        | 2400, 1275   |
| `shop`    | Węzeł Wymiany             | Targ Węzłów        | 3100, 1577   |
| `arena`   | Komora Kalibracji Bojowej | Pole Kalibracji    | 3100, 2327   |
| `smithy`  | Warsztat Uzbrojenia       | Kuźnia Obwodów     | 2400, 2570   |
| `depot`   | Magazyn Rdzeni            | Archiwum Danych    | 1650, 2517   |
| `inn`     | Moduł Regeneracji         | Strefa Regeneracji | 1700, 1577   |

Drzwi leżą na drożnym gruncie, są osiągalne z miejsca startu i między sobą (nawigacja gry, test).

**Mieszkańcy** (`city.npcs`; imiona i dialogi lokalne dla Androidów): `steward` VEGA-3, `merchant` MIRA-2, `trainer` KRON-9, `keeper` ARCH-5, `smith` HEF-4, `innkeeper` SOLA-6. Na ulicy: `guide` LYRA-7 (rynek) i `hunter` AXON. Do czasu wejścia wspólnych wnętrz MIRA-2 i HEF-4 czekają przy drzwiach swoich budynków.

**Obszar bezpieczny:** z miasta usunięto 4 punkty dzików (24 → 20 w całym Nexus-9). Marker „Perymetr” przeniesiono tuż za granicę miasta (jego miejsce zajęła arena).

**Wygląd:** budynki to laboratoria z istniejącej grafiki (trzy oryginalne i trzy kopie tego samego sprite'a jako zastępniki), reaktor i Rdzeń Świadomości (punkt samouczka) zostały na miejscu. Dodano drogi dojazdowe do drzwi i 12 elementów ulicznych (pylony, ogrody techniczne), usunięto dwa dekoracyjne mury i trzy obiekty kolidujące z wejściami.

## 2. Dane i narzędzia

- Dane: `src/game/world/regions/nexus.json`, klucz `cityPlan` (format zgodny z kontraktem; klucz `cityPlan` jest celowo inny niż `city`: `WorldDefinition.city` Codexa oznacza dziś cały kontynent jako miasto bez walki (jak Verdantia), więc podłączenie wymaga decyzji właściciela).
- Skrypt odtwarzalny i idempotentny: `python3 scripts/build_nexus_city.py`.
- Test: `src/test/nexus-city.test.ts` (sześć usług, odstępy ≥ 700, drzwi i osiągalność, rozłączne budynki, mieszkańcy, brak wrogów w mieście).

## 3. Czego brakuje (nie jest zrobione)

1. **Wnętrza i mechaniki** (wejście, rozmowa, handel, kowal, skrzynia depozytu, manekin, odpoczynek): gałąź Codexa. Po jej scaleniu podłączyć dane `city` do `WorldDefinition.city`.
2. **Grafika budynków:** sześć usług wygląda jak to samo laboratorium. Do zlecenia na GPU (decyzja właściciela), osobne obiekty w stylu Nexus-9: centrum synchronizacji, hala wymiany, komora kalibracji z manekinem, warsztat uzbrojenia, magazyn rdzeni, kapsuła regeneracji, a także domy i kładki.
3. **Dalsze rozbudowanie:** domy mieszkańców, bazar, dodatkowi NPC uliczni.
4. **Test na telefonie** i ocena właściciela.
