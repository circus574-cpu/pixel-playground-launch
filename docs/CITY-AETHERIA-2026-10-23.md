# Aetheria — miasto Mędrców (Sanktuarium Tysiąca Źródeł), 23.10.2026

**Status: UKŁAD I DANE GOTOWE W REPO, PRZETESTOWANE JEDNOSTKOWO. Wnętrza, handel, kowal, depozyt i trening to wspólne mechaniki rozwijane na gałęzi Codexa (zob. [CITY-INTEGRATION-CONTRACT-2026-10-23.md](https://github.com/circus574-cpu/pixel-playground-launch/blob/feature/verdantia-functional-city-20261023/docs/CITY-INTEGRATION-CONTRACT-2026-10-23.md)) — tu ich NIE ma. Niezweryfikowane na telefonie i nieocenione wizualnie przez właściciela. Nie scalone z `main`, nie opublikowane.**

> **Aktualizacja 23.10.2026 (skala kontynentów):** miasto ma teraz strefę bezpieczną 4000 × 2500 j. na kontynencie o rozmiarze prawdziwego kontynentu; współrzędne drzwi w tabeli poniżej są aktualne, a opisy rozmiarów i odstępów poniżej dotyczą pierwszego układu. Szczegóły: [CITY-CONTINENT-SCALE-2026-10-23.md](CITY-CONTINENT-SCALE-2026-10-23.md).

Zakres tej gałęzi (`feat/aetheria-city`): dane, układ, wygląd i dokumentacja miasta Mędrców. Nie zmieniano `session.ts`, `mountGame.ts`, paneli HUD, schematu zapisu ani importera.

## 1. Co powstało

Miasto zajmuje dolinę wokół sanktuarium (obszar bezpieczny `1400–4700 × 1150–3300`, mapa 6000×4360 bez powiększania). Sześć usług leży w **osobnych dzielnicach**, każda ≥ 700 jednostek od pozostałych (test). Żaden budynek nie stoi w skupisku z innym.

| Id usługi | Budynek                  | Dzielnica                       | Drzwi (x, y) | Odstęp do najbliższej usługi |
| --------- | ------------------------ | ------------------------------- | ------------ | ---------------------------- |
| `hall`    | Sala Rady Źródeł         | Wzgórze Źródła (północ)         | 23166, 12871 | > 800                        |
| `shop`    | Pawilon Wymiany          | Targ Wymiany (północny wschód)  | 24483, 13388 | > 700                        |
| `arena`   | Dziedziniec Skupienia    | Ogród Pagód (wschód)            | 25614, 13268 | > 700                        |
| `depot`   | Skarbiec Zwojów          | Zachodnie Tarasy                | 22314, 13873 | > 700                        |
| `smithy`  | Warsztat Pieczęci        | Dziedziniec Pieczęci (południe) | 24653, 14762 | > 1000                       |
| `inn`     | Herbaciarnia Cichych Wód | Staw Koi (południowy zachód)    | 22314, 14751 | > 700                        |

Drzwi leżą na drożnym gruncie przed wejściem; z miejsca startu i między sobą są osiągalne algorytmem nawigacji gry (test).

**Mieszkańcy** (`city.npcs`, role ze wspólnego słownika, imiona i dialogi lokalne dla Mędrców): `steward` Hoshi (sala), `merchant` Mei (pawilon), `trainer` Raku (dziedziniec), `keeper` Kaede (skarbiec), `smith` Enso (warsztat), `innkeeper` Yuna (herbaciarnia). Na ulicy zostają `guide` Sora (rynek) i `hunter` Ishin. Do czasu wejścia wspólnych wnętrz Mei i Enso czekają przy drzwiach swoich budynków, więc obecny handel i wzmocnienie ostrza działają jak dotąd.

**Obszar bezpieczny:** z miasta usunięto 8 punktów, w których chodziły dziki (28 → 20 w całej Aetherii). W mieście nie ma spawnów bojowych ani potworów; po opuszczeniu miasta spawny dopiero powstaną (po ukończeniu kontynentów).

**Wygląd:** istniejące sprite'y (sanktuarium, archiwa, pagody) przeniesiono w osobne dzielnice, dodano drogi dojazdowe do drzwi, latarnie i ogrody wzdłuż ulic, przesunięto sadzawki koi z dala od budynków, usunięto dwa dekoracyjne mury kolidujące z wejściami. Źródło Pamięci (punkt samouczka) pozostało na miejscu.

## 2. Dane i narzędzia

- Dane: `src/game/world/regions/aether.json`: klucz `city` (nazwa, `bounds` strefy bezpiecznej, budynki z `id`, `name`, `district`, `description`, `objectId`, `door`) oraz mieszkańcy w `npcs` z polem `building`. Miasto jest bezpieczną strefą w kontynencie z walką (decyzja właściciela 23.10.2026): w `bounds` i we wnętrzach nic nie atakuje, poza nimi działają dziki i zadania jak dotąd. Mieszkańcy usług stoją we wnętrzach budynków.
- Skrypt odtwarzalny i idempotentny: `python3 scripts/build_aetheria_city.py` (zaczyna od zapisanego pliku regionu).
- Testy: `src/test/aetheria-city.test.ts` (sześć usług, odstępy ≥ 700, drzwi na drożnym gruncie i osiągalne z miejsca startu, rozłączne budynki, mieszkańcy, brak wrogów w mieście) oraz poprawiony `aether-expansion.test.ts`.

## 3. Czego brakuje (nie jest zrobione)

1. **Wnętrza i mechaniki** (wejście do budynku, rozmowa wewnątrz, handel, kowal, skrzynia depozytu, manekin treningowy, odpoczynek): gałąź Codexa. Po jej scaleniu trzeba podłączyć dane `city` Aetherii do `WorldDefinition.city`.
2. **Grafika budynków:** dziś pawilon, warsztat i skarbiec wyglądają jak archiwa, a herbaciarnia i dziedziniec jak pagody (powtarzające się sprite'y). Do zlecenia na GPU (decyzja właściciela o uruchomieniu poda), osobne obiekty w stylu Aetherii, ok. 380–470 j. szerokości, obiekty niezależne (bez tła), z bazą kolizji:
   - Pawilon Wymiany: otwarty pawilon targowy z półkami zwojów i kryształów.
   - Warsztat Pieczęci: kuźnia pieczęci z kamiennym kowadłem i paleniskiem, bez dymu w sprite'cie.
   - Skarbiec Zwojów: masywne archiwum z kratą i pieczęciami.
   - Herbaciarnia Cichych Wód: niski pawilon z werandą nad wodą.
   - Dziedziniec Skupienia: brama i podest treningowy z manekinem (manekin jako osobny obiekt).
   - Dodatkowo domy mieszkalne, mostki i kładki między dzielnicami.
3. **Dalsze rozbudowanie miasta:** domy mieszkańców, bazar uliczny, dodatkowe NPC uliczni (po zatwierdzeniu układu przez właściciela).
4. **Test na telefonie** i ocena właściciela.
