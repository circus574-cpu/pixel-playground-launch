# GPU: krajobraz planety i neutralna fauna — specyfikacja zlecenia, 23.10.2026

**Status: SPECYFIKACJA DO ZATWIERDZENIA. Nic z tej listy nie jest wygenerowane ani zaimportowane; liczby i nazwy to propozycje. Uzupełnia [GPU-BACKLOG-2026-10-23.md](GPU-BACKLOG-2026-10-23.md). Pod GPU uruchamia i zatrzymuje wyłącznie właściciel.**

Decyzja właściciela (23.10.2026): cała planeta ma zostać wypełniona. Poprawki animacji i podłoża przy miastach robimy na końcu. Potrzebne jest bardzo zróżnicowane środowisko (skały, góry, wulkany) oraz **neutralne zwierzęta**, które dają pożywienie i inne surowce (osobno od potworów z bestiariusza, które pozostają przeciwnikami).

Zasady wspólne: niezależne zasoby (tekstury `terrain.*`, obiekty `object.*`, aktor `fauna.*`), nigdy gotowa ilustracja świata jako podłoże; kolizje z danych regionów, nie z grafiki; opt-in przez `PREVIEW_SWITCHES` do akceptacji; budżet tekstur 128 MiB na aktywny świat (kontynent ładuje tylko własny zestaw biomów plus wspólne skały); prawa do referencji i checkpointów nadal nierozstrzygnięte ([ASSET-LICENSE-REGISTER.md](ASSET-LICENSE-REGISTER.md)).

## 1. Krajobraz: tekstury podłoża (`terrain.*`)

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

## 2. Krajobraz: obiekty (`object.*`, RGBA)

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

## 3. Neutralna fauna (`fauna.*`)

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

### Animacje fauny

Profil `fauna`: 8 kierunków × 24 klatki (bezczynność 6, chód 8, ucieczka 6, trafienie/śmierć 4) = **192 klatki na gatunek**, master 384², klient 96², atlas ≤ 2048. Dla ptaków i ryb profil skrócony: 4 kierunki × 16 klatek. Razem 32 gatunki ≈ **5 400 klatek** (do 6 100 przy pełnym zestawie). Mały ruch dla owadów i wodnych (pętla bez kierunków).

Ikony surowców (17 typów × 2–3 warianty) i ikony przedmiotów z Księgi (broń 32, pancerz 30, biżuteria 12, narzędzia 8, zużywalne 16, półprodukty 6, klucze 12, materiały bestiariusza ok. 80) są w osobnej pozycji backlogu (UI).

## 4. Kolejność dostaw dla krajobrazu i fauny

1. **P0 — próbki** (po jednej): trawa verdantyjska z przejściem do skały, góra (1024²), wulkan, bryła skalna, drzewo, jeleń z kompletem klatek, ikona mięsa.
2. Po akceptacji: **zestawy biomów** (4 × 24 tekstury) → obiekty (góry, skały, drzewa) → przejścia → wulkany i woda → ruiny Chóru.
3. **Fauna**: najpierw 8 gatunków Verdantii (tam startuje większość graczy), potem po 8 na kolejne kontynenty.
4. Import walidowanym importerem (rozmiary, klatki, SHA-256, budżet 128 MiB), opt-in, ocena na telefonie.

## 5. Wymagania kodowe (po stronie repo, bez GPU)

- Silnik fauny: neutralne AI (wypas, ucieczka, powrót), brak obrażeń i XP, zbiór i polowanie, limity aktywnych zwierząt w pobliżu gracza (PERF-01), respawn po opuszczeniu obszaru.
- Rozmieszczenie: generator pokrycia kontynentu (biomy według pozycji na atlasie, tekstury i obiekty z gęstością), kolizje z listy obiektów; **spawny potworów z bestiariusza nadal dopiero po ukończeniu kontynentów** (decyzja właściciela).
- Kamera i minimapa regionu na dużych dystansach, podróż między miastami (osobne zadanie).

## 6. Decyzje do zatwierdzenia

1. Lista 32 gatunków i surowców zwierzęcych (czy dodać lub usunąć, w tym czy ryby i wędkowanie wchodzą od razu).
2. Gęstość świata: pełne pokrycie całego kontynentu od razu czy najpierw pas wokół miasta o promieniu ok. 15 000 j.
3. Styl zwierząt: malowany jak potwory, czy prostszy (mniej klatek).
4. Prawa do referencji i checkpointów oraz moment uruchomienia poda (po stronie właściciela).
