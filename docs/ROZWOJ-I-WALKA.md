# KI Legends — rozwój i walka

## Symulacje CPU — checkpoint 23.10.2026

Wstępny przebieg rzeczywistego `GameSession` i AI potworów objął 1392 scenariusze,
po 16 prób: 22 272 walki. Wyniki: 20 346 zwycięstw, 1487 śmierci i 439 timeoutów.
To porównanie czterech ras, trzech wariantów wyposażenia/zdolności i potworów
w pobliżu ich poziomu, nie ukończone dwa raporty rozwoju 1–20 oraz 20–40.
[Macierz i założenia](zmiany/2026-10-23/qa/cpu-game-content/balance.json),
[dane CSV](zmiany/2026-10-23/qa/cpu-game-content/balance-matrix.csv).

Osobne zakresy 1–20/20–40 są pracą w toku. Najwyższy poziom obecnego kanonicznego
potwora to 18. Wariant skalowanych przeciwników 20–40 w narzędziu jest propozycją
wyłącznie do symulacji; nie zmienia katalogu ani statystyk produkcyjnych.
Próba tej propozycji w QA jest wyraźnie oznaczona jako niepełna.
Model XP/h zakłada 30 s podróży i 5 s odpoczynku na walkę, sprzedaż materiałów
oraz koszt gospody; nie jest pomiarem czasu gry człowieka ani pełnej ekonomii.

Aktualizacja: 23.10.2026. Silnik ras i 40 potworów jest w kodzie; nie oznacza to
ukończonego rozmieszczenia potworów ani odbioru balansu. Nowe 98 zadań i rozszerzony
katalog ekwipunku są [projektem fabularnym](FABULA-I-EKWIPUNEK.md), nie obecną kampanią.

## Obowiązujące reguły

- Baza + przyrost × (L−1), zaokrąglenie statystyk całkowitych do najbliższej, połówki w górę.
- Obrażenia `max(1, ATK × mnożnik − DEF/2)`, bez zaokrąglania pojedynczego trafienia.
- Ruch: baza × `(1 + 0.05 × (min(L,20)−1))`; odstęp ataków nie rośnie z poziomem.
- Jeden punkt umiejętności na poziom 1–20, razem 20; korzeń kosztuje punkt.
  29 węzłów na rasę, pary A7/A8, B7/B8, C7/C8 wykluczają się.
  Tryb KI: poziom 20 i dowolna zdolność ostateczna A9/B9/C9.
- Pierwszy reset do poziomu 10 darmowy; kolejne 50 × poziom monet.
- Krytyk ×1,5; mikstura 40% maks. HP, cooldown 6 s; regeneracja poza walką 0,3% maks. HP/s.
- Dzień modelu potworów 8 minut (ostatnie 3 to noc); nie jest to pełny zegar świata.
- Materiały: 30 typów po 99 sztuk, skup `round(2 + 1.5 × poziom źródła)`.
  Założenia spoza aneksu zatwierdzono przez właściciela 23.10.2026.

## Obecny ekwipunek, zadania i zapisy

| ID       | Przedmiot            | ATK | DEF | Kup / sprzedaj |
| -------- | -------------------- | --: | --: | -------------: |
| `potion` | Mikstura życia       |   0 |   0 |          8 / 3 |
| `tusk`   | Kieł dzika           |   0 |   0 |       brak / 5 |
| `sword`  | Ostrze strażnika     |   8 |   0 |        40 / 18 |
| `vest`   | Kamizelka podróżnika |   0 |   3 |        25 / 10 |

Obecne ulepszenie miecza: jednorazowo +4 ATK za 15 monet. Sloty: broń i pancerz.
Nie zastępować tych liczb propozycjami z księgi przygody bez osobnego wdrożenia.
XP do następnego poziomu: `100 + 60 × (L−1)`; dojście do 20: 12 160 XP.

Zapis v5 obejmuje umiejętności, materiały, resety, wnętrze i osobisty depozyt.
Wczytuje v1/v3/v4; surowy wcześniejszy zapis otrzymuje kopię `before-v5`, historyczne
kopie `before-v4` pozostają. Walidacja chroni nieznane/nowsze dane i konflikt kart.
Depozyt jest prywatny dla lokalnego slotu na danej domenie, nie serwerowy.
Przeniesienie ostatniego miecza przenosi również ulepszenie; wyposażona ostatnia
sztuka nie opuszcza plecaka. Limity i ilości sprawdzane przed mutacją.

Verdantia ma etap miejski: wprowadzenie daje jednorazowo 40 XP i 40 monet,
zadanie ekwipunku nie wymaga polowania, nowego zadania zabijania dzików nie przyjmuje
się w mieście. Dawne postępy są zachowane. Aetheria/Nexus/Pyra mają bezpieczne
miasto wewnątrz kontynentu z dotychczasową walką poza nim. Granice: [świat](SWIAT-I-MIASTA.md).

## Źródła i implementacja

`docs/design/data/character-progression-1-20.json` → `scripts/gen-kit-nodes.py` →
`src/game/kit/nodes.generated.ts`. Logika w `kit/base.ts`, czterech kitach,
`progression.ts` i `balance.ts`. `art/production/enemies/roster.json` →
`scripts/gen-monster-base.py` → `monsters/base.generated.ts`; AI w `system.ts`,
statusy w `fx.ts`, materiały w `materials.ts`, integracja w `session.ts`.

## Statystyki ras i drzewka

Źródło: [JSON aneksu](design/data/character-progression-1-20.json). Węzły są w kodzie,
a nazwy krain i szybkość uwzględniają późniejsze decyzje właściciela.

| Parametr  | Planetarni               | Mędrcy                   | Androidy                 | Legendy                  |
| --------- | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| HP        | 125 / +36 na poziom      | 100 / +28 na poziom      | 115 / +34 na poziom      | 140 / +42 na poziom      |
| KI        | 50 / +4 na poziom        | 80 / +7 na poziom        | 60 / +5 na poziom        | 40 / +3 na poziom        |
| ATK       | 12 / +4 na poziom        | 14 / +4.6 na poziom      | 12 / +3.8 na poziom      | 14 / +4.6 na poziom      |
| DEF       | 5 / +2.4 na poziom       | 3 / +1.6 na poziom       | 7 / +3 na poziom         | 4 / +2 na poziom         |
| Ruch j./s | 185 / +5% bazy na poziom | 170 / +5% bazy na poziom | 175 / +5% bazy na poziom | 170 / +5% bazy na poziom |
| KI/s      | 1.0 / +0.05 na poziom    | 2.0 / +0.1 na poziom     | 1.2 / +0.06 na poziom    | 0.8 / +0.04 na poziom    |
| Krytyk %  | 5 / +0.25 na poziom      | 5 / +0.2 na poziom       | 8 / +0.4 na poziom       | 6 / +0.3 na poziom       |
| Odstęp ms | 650 / stały              | 800 / stały              | 700 / stały              | 750 / stały              |

### Planetarni — Verdantia

Mobilny wojownik wręcz. Adaptacja do terenu.

Gałęzie: A — Szlak Wędrowca, B — Żywa Ziemia, C — Pieśń Korzeni.

| Kod / nazwa                | Typ      | Poz. min. | Wymaga (jedno z) | Efekt źródłowy                                                                                  |
| -------------------------- | -------- | --------: | ---------------- | ----------------------------------------------------------------------------------------------- |
| R / Cios Szlaku            | starting |         1 | —                | Atak wręcz ×1,0 co 650 ms; trzeci cios serii ×1,3. Bez kosztu Ki.                               |
| A1 / Szybki Unik           | active   |         2 | R                | Zryw w wybranym kierunku (160 j.), 0,4 s nietykalności; 8 Ki; odn. 6 s.                         |
| A2 / Lekki Krok            | passive  |         4 | A1               | +6% szybkości ruchu.                                                                            |
| A3 / Pęd Szlaku            | passive  |         4 | A1               | Po uniku następny atak zadaje +25% obrażeń (5 s).                                               |
| A4 / Wir Energii           | active   |         7 | A2 lub A3        | Wirujący atak wokół postaci ×1,8, promień 140 j.; 18 Ki; odn. 10 s.                             |
| A5 / Wiatr w Plecy         | passive  |        10 | A4               | Po pokonaniu wroga +15% szybkości ruchu przez 4 s.                                              |
| A6 / Oko Zwiadowcy         | passive  |        10 | A4               | +5% szansy krytyku.                                                                             |
| A7 / Cios z Cienia         | choice   |        13 | A5               | Pierwszy atak po uniku zawsze jest krytyczny. Wyklucza A8.                                      |
| A8 / Nieuchwytny           | choice   |        13 | A6               | Odnowienie Uniku −30%, po uniku +20% obrony przez 1 s. Wyklucza A7.                             |
| A9 / Burza Wędrowca        | ultimate |        16 | A7 lub A8        | Seria 5 szybkich uderzeń w pobliskich wrogów, łącznie ×4,0; 35 Ki; odn. 30 s.                   |
| B1 / Impuls Ziemi          | active   |         2 | R                | Uderzenie w ziemię ×1,4, promień 120 j., spowolnienie 30% na 2 s; 10 Ki; odn. 6 s.              |
| B2 / Adaptacja             | passive  |         4 | B1               | Bonus zależny od terenu: las +30% regeneracji Ki, skały +10% obrony, woda +8% szybkości.        |
| B3 / Kamienna Skóra        | passive  |         4 | B1               | +8% obrony.                                                                                     |
| B4 / Kruszący Stąp         | active   |         7 | B2 lub B3        | Skok i uderzenie ×2,0, ogłuszenie 1 s; 18 Ki; odn. 10 s.                                        |
| B5 / Rezonans              | passive  |        10 | B4               | Impuls Ziemi uderza drugi raz po 0,5 s za 60% obrażeń.                                          |
| B6 / Żyła Ziemi            | passive  |        10 | B4               | Impuls Ziemi zwraca 5 Ki za każdego trafionego wroga (maks. 15).                                |
| B7 / Głaz Strażnik         | choice   |        13 | B5               | Kruszący Stąp tworzy osłonę pochłaniającą 15% maks. życia przez 5 s. Wyklucza B8.               |
| B8 / Trzęsienie            | choice   |        13 | B6               | Impuls Ziemi: promień +40% i ogłuszenie 0,5 s. Wyklucza B7.                                     |
| B9 / Gniew Doliny          | ultimate |        16 | B7 lub B8        | Ogromne uderzenie obszarowe ×4,0, ogłuszenie 1,5 s; 35 Ki; odn. 30 s.                           |
| C1 / Korzenny Oddech       | active   |         2 | R                | Leczy 12% maks. życia w ciągu 4 s; 12 Ki; odn. 12 s.                                            |
| C2 / Zielona Krew          | passive  |         4 | C1               | +10% maks. życia.                                                                               |
| C3 / Leśna Cierpliwość     | passive  |         4 | C1               | Poza walką regeneracja życia 1% maks. na sekundę.                                               |
| C4 / Tarcza Liści          | active   |         7 | C2 lub C3        | Tarcza pochłaniająca 18% maks. życia przez 5 s; 18 Ki; odn. 12 s.                               |
| C5 / Korzenie Odporności   | passive  |        10 | C4               | Czas trwania efektów kontroli na postaci −25%.                                                  |
| C6 / Ziarno Życia          | passive  |        10 | C4               | Leczenie z Korzennego Oddechu +30%.                                                             |
| C7 / Strażnik Gaju         | choice   |        13 | C5               | Tarcza Liści odbija 20% obrażeń wręcz. Wyklucza C8.                                             |
| C8 / Dar Lasu              | choice   |        13 | C6               | Korzenny Oddech zwraca 15 Ki. Wyklucza C7.                                                      |
| C9 / Pieśń Korzeni         | ultimate |        16 | C7 lub C8        | Leczy 40% maks. życia i daje tarczę 20% na 6 s; 35 Ki; odn. 45 s.                               |
| T / Forma Rezonansu Świata | ki-mode  |        20 | A9 lub B9 lub C9 | 20 s: +20% Ataku, +15% Obrony, +10% szybkości ruchu; aura jako osobny efekt; 50 Ki; odn. 120 s. |

### Mędrcy — Aetheria

Mag dystansowy i wsparcie. Kręgi światła.

Gałęzie: A — Pieczęcie, B — Kręgi i Bariery, C — Skupienie.

| Kod / nazwa             | Typ      | Poz. min. | Wymaga (jedno z) | Efekt źródłowy                                                                                       |
| ----------------------- | -------- | --------: | ---------------- | ---------------------------------------------------------------------------------------------------- |
| R / Pocisk Ki           | starting |         1 | —                | Pocisk dystansowy ×1,0 co 800 ms, zasięg 420 j. Bez kosztu Ki.                                       |
| A1 / Pieczęć Energii    | active   |         2 | R                | Znak na celu; po 3 s wybucha za ×2,0; 12 Ki; odn. 8 s.                                               |
| A2 / Znak Wiedzy        | passive  |         4 | A1               | Wrogowie z pieczęcią przyjmują +10% obrażeń.                                                         |
| A3 / Szybka Pieczęć     | passive  |         4 | A1               | Odnowienie Pieczęci Energii −20%.                                                                    |
| A4 / Strumień Ki        | active   |         7 | A2 lub A3        | Kanałowany promień 3 s, łącznie ×2,4 (co 0,5 s); 20 Ki; odn. 12 s.                                   |
| A5 / Echo Pieczęci      | passive  |        10 | A4               | Wybuch Pieczęci rani też pobliskich wrogów za 50% obrażeń.                                           |
| A6 / Precyzja Mędrca    | passive  |        10 | A4               | +8% szansy krytyku.                                                                                  |
| A7 / Złoty Krąg         | choice   |        13 | A5               | Wybuch Pieczęci tworzy krąg obrażeń o promieniu 120 j. Wyklucza A8.                                  |
| A8 / Pieczęć Skupienia  | choice   |        13 | A6               | Wybuch Pieczęci zwraca 15 Ki. Wyklucza A7.                                                           |
| A9 / Sąd Światła        | ultimate |        16 | A7 lub A8        | Po 1,5 s słup światła w dużym obszarze ×4,2; 35 Ki; odn. 30 s.                                       |
| B1 / Świetlista Bariera | active   |         2 | R                | Tarcza pochłaniająca 15% maks. życia przez 4 s; 12 Ki; odn. 10 s.                                    |
| B2 / Kontrola Kręgu     | passive  |         4 | B1               | Zdolności zostawiają krąg światła (5 s): +10% obrony postaci w jego obrębie.                         |
| B3 / Gęste Światło      | passive  |         4 | B1               | Bariera trwa o 2 s dłużej.                                                                           |
| B4 / Krąg Spowolnienia  | active   |         7 | B2 lub B3        | Krąg na 5 s: wrogowie w nim −40% szybkości; 18 Ki; odn. 12 s.                                        |
| B5 / Odbicie            | passive  |        10 | B4               | Bariera odbija 15% obrażeń z pocisków.                                                               |
| B6 / Strażnik Kręgu     | passive  |        10 | B4               | Wrogowie w kręgach zadają −10% obrażeń.                                                              |
| B7 / Kopuła             | choice   |        13 | B5               | Pojemność Bariery +30%. Wyklucza B8.                                                                 |
| B8 / Lustro             | choice   |        13 | B6               | Bariera odbija pierwszy atak wroga w całości. Wyklucza B7.                                           |
| B9 / Świątynia Światła  | ultimate |        16 | B7 lub B8        | Wielki krąg na 8 s: +30% obrony postaci, wrogowie −30% szybkości; 35 Ki; odn. 40 s.                  |
| C1 / Skupienie KI       | active   |         2 | R                | Kanałowanie 3 s: odnawia 30% maks. Ki (przerywane ruchem lub trafieniem); odn. 15 s.                 |
| C2 / Głęboki Oddech     | passive  |         4 | C1               | +15% maks. Ki.                                                                                       |
| C3 / Mądrość Strażników | passive  |         4 | C1               | Koszty Ki zdolności −8%.                                                                             |
| C4 / Medytacja Bojowa   | active   |         7 | C2 lub C3        | Kanałowanie 3 s: leczy 20% maks. życia; 10 Ki; odn. 15 s.                                            |
| C5 / Czysty Umysł       | passive  |        10 | C4               | Czas trwania efektów kontroli na postaci −25%.                                                       |
| C6 / Strumień Wiedzy    | passive  |        10 | C4               | Po Skupieniu KI następna zdolność zadaje +25% obrażeń (6 s).                                         |
| C7 / Dar Mędrca         | choice   |        13 | C5               | Medytacja Bojowa leczy o 50% więcej. Wyklucza C8.                                                    |
| C8 / Skupienie Mistrza  | choice   |        13 | C6               | Skupienie KI nie jest przerywane ruchem. Wyklucza C7.                                                |
| C9 / Pełnia Skupienia   | ultimate |        16 | C7 lub C8        | 8 s: zdolności nie kosztują Ki i zadają +30% obrażeń; 20 Ki; odn. 60 s.                              |
| T / Forma Oświecenia    | ki-mode  |        20 | A9 lub B9 lub C9 | 20 s: +25% Ataku, odnowienia zdolności −30%, +15% Obrony; aura jako osobny efekt; 50 Ki; odn. 120 s. |

### Androidy — Nexus-9

Precyzyjny strzelec z tarczami. Ładunek Rdzenia.

Gałęzie: A — Systemy Celownicze, B — Pancerz i Tarcze, C — Rdzeń.

| Kod / nazwa                | Typ      | Poz. min. | Wymaga (jedno z) | Efekt źródłowy                                                                                                                                                   |
| -------------------------- | -------- | --------: | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R / Strzał Impulsowy       | starting |         1 | —                | Strzał ×1,0 co 700 ms, zasięg 360 j.; każdy strzał +4 Ładunku Rdzenia (maks. 100). Przy 100 przegrzanie: 2 s bez strzałów. Ładunek opada o 6/s poza strzelaniem. |
| A1 / Namierzanie           | active   |         2 | R                | Oznacza cel na 6 s: +15% szansy krytyku przeciw niemu; 8 Ki; odn. 8 s.                                                                                           |
| A2 / Kalibracja            | passive  |         4 | A1               | +6% szansy krytyku.                                                                                                                                              |
| A3 / Stabilizatory         | passive  |         4 | A1               | Zasięg strzałów +15%.                                                                                                                                            |
| A4 / Salwa Precyzyjna      | active   |         7 | A2 lub A3        | Trzy strzały w oznaczony cel, łącznie ×2,2; 18 Ki; odn. 10 s.                                                                                                    |
| A5 / Analiza Słabości      | passive  |        10 | A4               | Oznaczeni wrogowie mają −10% obrony.                                                                                                                             |
| A6 / Szybkie Przeładowanie | passive  |        10 | A4               | Odstęp strzałów −8%.                                                                                                                                             |
| A7 / Snajper               | choice   |        13 | A5               | +40% obrażeń przeciw oznaczonym, odstęp strzałów +10%. Wyklucza A8.                                                                                              |
| A8 / Rój                   | choice   |        13 | A6               | Strzał rozdziela się na 2 dodatkowe pobliskie cele (po 40% obrażeń). Wyklucza A7.                                                                                |
| A9 / Protokół Egzekucji    | ultimate |        16 | A7 lub A8        | Strzał ×4,0 w oznaczony cel, ×6,0 gdy cel ma poniżej 30% życia; 35 Ki; odn. 30 s.                                                                                |
| B1 / Tarcza Plazmowa       | active   |         2 | R                | Tarcza pochłaniająca 18% maks. życia przez 5 s; 12 Ki; odn. 10 s.                                                                                                |
| B2 / Płyty Pancerne        | passive  |         4 | B1               | +8% obrony.                                                                                                                                                      |
| B3 / Generator Tarczy      | passive  |         4 | B1               | Pojemność Tarczy +25%.                                                                                                                                           |
| B4 / Impuls Odpychający    | active   |         7 | B2 lub B3        | Fala ×1,2 odpycha pobliskich wrogów i ogłusza na 0,5 s; 18 Ki; odn. 12 s.                                                                                        |
| B5 / Protokół Adaptacji    | passive  |        10 | B4               | Tarcza Plazmowa odbija 25% obrażeń z pocisków.                                                                                                                   |
| B6 / Samonaprawa           | passive  |        10 | B4               | Regeneracja życia 0,5% maks. na sekundę.                                                                                                                         |
| B7 / Tarcza Kolcowa        | choice   |        13 | B5               | Tarcza odbija 30% obrażeń wręcz. Wyklucza B8.                                                                                                                    |
| B8 / Tarcza Modułowa       | choice   |        13 | B6               | Odnowienie Tarczy −35%. Wyklucza B7.                                                                                                                             |
| B9 / Fortyfikacja          | ultimate |        16 | B7 lub B8        | 6 s: +60% obrony i odporność na efekty kontroli; 35 Ki; odn. 40 s.                                                                                               |
| C1 / Wyładowanie Rdzenia   | active   |         2 | R                | Zużywa cały Ładunek: obrażenia ×(1,0 + Ładunek/50), do ×3,0 przy 100, w linii przed postacią; 15 Ki; odn. 8 s.                                                   |
| C2 / Zarządzanie Rdzeniem  | passive  |         4 | C1               | Przegrzanie trwa 1 s zamiast 2 s; Ładunek opada o 50% szybciej.                                                                                                  |
| C3 / Radiatory             | passive  |         4 | C1               | Każdy strzał dodaje o 15% mniej Ładunku.                                                                                                                         |
| C4 / Rozładowanie Awaryjne | active   |         7 | C2 lub C3        | Zeruje Ładunek i leczy 10% maks. życia; 0 Ki; odn. 20 s.                                                                                                         |
| C5 / Rezerwowy Akumulator  | passive  |        10 | C4               | +12% maks. Ki.                                                                                                                                                   |
| C6 / Optymalizacja         | passive  |        10 | C4               | Koszt Ki Wyładowania Rdzenia −20%.                                                                                                                               |
| C7 / Przeciążony Rdzeń     | choice   |        13 | C5               | Maks. Ładunek 150 (Wyładowanie do ×4,0); przegrzanie przy 150. Wyklucza C8.                                                                                      |
| C8 / Stabilny Rdzeń        | choice   |        13 | C6               | Przegrzanie nigdy nie następuje; maks. Ładunek 70. Wyklucza C7.                                                                                                  |
| C9 / Przeciążenie Systemu  | ultimate |        16 | C7 lub C8        | 6 s: zdolności nie kosztują Ki, +40% obrażeń; potem 2 s wyłączenia (brak akcji); 35 Ki; odn. 45 s.                                                               |
| T / Forma Pełnego Rdzenia  | ki-mode  |        20 | A9 lub B9 lub C9 | 20 s: +25% Ataku, +15% Obrony, przegrzanie wyłączone; aura jako osobny efekt; 50 Ki; odn. 120 s.                                                                 |

### Legendy — Pyra

Wojownik w zwarciu i burst. Żar.

Gałęzie: A — Ogień Walki, B — Żelazna Wola, C — Wybuch KI.

| Kod / nazwa                   | Typ      | Poz. min. | Wymaga (jedno z) | Efekt źródłowy                                                                                                                         |
| ----------------------------- | -------- | --------: | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| R / Uderzenie Żaru            | starting |         1 | —                | Cios wręcz ×1,0 co 750 ms; każde trafienie +4 Żaru (maks. 100). Żar daje +0,1% obrażeń za punkt (maks. +10%) i opada o 5/s poza walką. |
| A1 / Ogniste Cięcie           | active   |         2 | R                | Kombinacja 3 cięć, łącznie ×1,8; 10 Ki; odn. 6 s.                                                                                      |
| A2 / Rozgrzane Ostrza         | passive  |         4 | A1               | Cięcia podpalają na 3 s (łącznie 30% Ataku).                                                                                           |
| A3 / Łańcuch Ciosów           | passive  |         4 | A1               | Po 3 trafieniach z rzędu odstęp ataków −10% na 4 s.                                                                                    |
| A4 / Szarża Płomienia         | active   |         7 | A2 lub A3        | Doskok (200 j.) i cięcie ×2,2; 18 Ki; odn. 10 s.                                                                                       |
| A5 / Rozżarzone Pięści        | passive  |        10 | A4               | +8% Ataku.                                                                                                                             |
| A6 / Okrucieństwo             | passive  |        10 | A4               | +6% szansy krytyku.                                                                                                                    |
| A7 / Taniec Płomieni          | choice   |        13 | A5               | Ogniste Cięcie ma 5 cięć (łącznie ×2,6). Wyklucza A8.                                                                                  |
| A8 / Pojedynkowicz            | choice   |        13 | A6               | +25% obrażeń, gdy w zasięgu 200 j. jest tylko jeden wróg. Wyklucza A7.                                                                 |
| A9 / Tysiąc Cięć              | ultimate |        16 | A7 lub A8        | Seria 8 cięć, łącznie ×4,2; 35 Ki; odn. 30 s.                                                                                          |
| B1 / Przełamanie              | active   |         2 | R                | Cios kruszący ×1,5, ogłuszenie 1,2 s i zniszczenie osłon wroga; 12 Ki; odn. 8 s.                                                       |
| B2 / Hartowana Skóra          | passive  |         4 | B1               | +8% obrony.                                                                                                                            |
| B3 / Honor Wojownika          | passive  |         4 | B1               | +10% maks. życia.                                                                                                                      |
| B4 / Płomienny Szał           | active   |         7 | B2 lub B3        | 8 s: +30% Ataku, −20% obrony; 18 Ki; odn. 25 s.                                                                                        |
| B5 / Żelazna Wola             | passive  |        10 | B4               | W Szale odporność na ogłuszenie.                                                                                                       |
| B6 / Krew Legendy             | passive  |        10 | B4               | Po pokonaniu wroga leczy 3% maks. życia.                                                                                               |
| B7 / Wściekłość               | choice   |        13 | B5               | Szał trwa o 4 s dłużej i daje dodatkowe +10% Ataku. Wyklucza B8.                                                                       |
| B8 / Kontrolowany Żar         | choice   |        13 | B6               | Szał nie obniża obrony. Wyklucza B7.                                                                                                   |
| B9 / Ostatni Płomień          | ultimate |        16 | B7 lub B8        | 5 s: pierwszy śmiertelny cios zostawia 1 punkt życia i leczy 30% maks. życia; 35 Ki; odn. 90 s.                                        |
| C1 / Wybuch Ki                | active   |         2 | R                | Eksplozja wokół postaci ×1,8, promień 150 j.; 15 Ki; odn. 8 s.                                                                         |
| C2 / Żar                      | passive  |         4 | C1               | Żar rośnie o 50% szybciej i opada 2× wolniej.                                                                                          |
| C3 / Ognisty Oddech           | passive  |         4 | C1               | Wybuch Ki podpala na 4 s (łącznie 40% Ataku).                                                                                          |
| C4 / Eksplozja Żaru           | active   |         7 | C2 lub C3        | Zużywa cały Żar: obszarowo ×(1,0 + Żar/50), do ×3,0 przy 100; 20 Ki; odn. 12 s.                                                        |
| C5 / Szybkie Rozżarzenie      | passive  |        10 | C4               | Walka zaczyna się z 20 Żaru.                                                                                                           |
| C6 / Nieugaszony              | passive  |        10 | C4               | Przy 100 Żaru regeneracja Ki +50%.                                                                                                     |
| C7 / Wulkan                   | choice   |        13 | C5               | Eksplozja Żaru: promień +50%. Wyklucza C8.                                                                                             |
| C8 / Detonator                | choice   |        13 | C6               | Eksplozja Żaru: +25% obrażeń, promień −20%. Wyklucza C7.                                                                               |
| C9 / Ognisty Kataklizm        | ultimate |        16 | C7 lub C8        | Kolumna ognia w dużym obszarze ×4,5 i podpalenie na 5 s; 35 Ki; odn. 30 s.                                                             |
| T / Forma Płomiennego Legendy | ki-mode  |        20 | A9 lub B9 lub C9 | 20 s: +30% Ataku, Żar utrzymuje się na 100; aura jako osobny efekt; 50 Ki; odn. 120 s.                                                 |

## Bestiariusz i ograniczenia

Kanoniczne są 40 potworów właściciela z HTML i `roster.json`. Dawna alternatywna
lista 20 przeciwników została usunięta. Osiem bossów z księgi jest nowym projektem.
Paczki `deliveries/enemy-*` nie są zainstalowane; nowe spawny dopiero po ukończeniu
kontynentów. Istniejące dziki poza miastami nie oznaczają ukończenia nowego bestiariusza.
Nie wszystkie słabości mają wykonalny typ ataku (np. woda/zimno).

<!-- BESTIARY:START -->

### Kontrakt grafiki potworów

Paczka: 8 kierunków × 52 klatki = 416; master 512² RGBA, klient 128²,
profil `enemy` 84×84, origin `(0.5,0.8)`. Ruch/stan nie zmienia statystyk.
Kierunki lewe są odbiciami prawych; asymetria projektu też jest odbijana.
Punkt stóp w masterze `(256,409.6)`, latające unoszą się o 36 px i lądują przy śmierci.
Animacja jest deformacją obrazu, nie pełnym ruchem ręcznie animowanych kończyn.
Kontrola raportu: 416 klatek, brak violations i pustej alfy, zgodne hashe/marginesy.
Skala S/M/L: 0.62/0.80/0.98; shrink w raporcie przy zbyt małym marginesie.
Wiązanie `<świat>.enemy.<slug>`; pełna mapa `art/production/enemies/bindings.json`.
Silnik danych/AI jest zaimplementowany. Wszystkie 40 istniejących dostaw
zainstalowano na `feature/superior-runtime-20261023` po bezstratnym pakowaniu
pustych marginesów do wersji 1.0.1. Wyprawa aktywuje osobno wygenerowane spawny
i pobiera potrzebne atlasy; zwykłe mapy nie ładują pełnej biblioteki. Nie zmieniono
statystyk ani oryginalnych paczek 1.0.0. Bossowie nie należą do tej czterdziestki.

| Archetyp  | Ruch                                                         | Śmierć                                      |
| --------- | ------------------------------------------------------------ | ------------------------------------------- |
| `blob`    | podskok: ściska się i wyciąga w pionie, odbija się od ziemi  | rozpłaszcza się i ciemnieje                 |
| `quad`    | kłus: unoszą się naprzemiennie łapy, lekki przechył korpusu  | przewraca się na bok (z boku) lub do przodu |
| `crawl`   | drobne kroki: szybkie drżenie odnóży, korpus ledwo się unosi | przewraca się na grzbiet, odnóża w górze    |
| `slither` | fala: fala biegnąca wzdłuż ciała                             | opada i spłaszcza się                       |
| `plant`   | kołysanie: kołysze się od podstawy, korzeń nieruchomy        | wygina się i opada                          |
| `turret`  | prawie bez ruchu: drżenie górnej części, korpus stoi         | przechyla się i ciemnieje (wygaszenie)      |
| `fly`     | trzepot: unosi się i opada, skrzydła na zmianę               | spada na ziemię przechylony                 |
| `hover`   | unoszenie: pływa w górę i w dół, lekkie pulsowanie           | gaśnie i opada na ziemię                    |
| `stomp`   | ciężki krok: podskok i nacisk kolejnych łap                  | opada na ziemię, spłaszcza się              |

### Pełne dane 40 potworów

#### Verdantia

**Mchowy Szlamak** (`verdant-mchowy-szlamak`, poz. 1) — archetyp `blob` (podskok), rozmiar mały (0,62).

- Wygląd: a round moss covered slime with translucent green jelly body, tufts of moss and tiny mushrooms on top, two big glossy dull eyes.
- Statystyki: HP 73, ATK 5, DEF 4, XP 16; prędkość 0.5, zasięg 90, agro 250.
- Zachowanie: Błąka się w promieniu 300 j. od gniazda. Nie atakuje pierwszy; po zaczepieniu goni powoli, a po 6 s bez trafienia wraca i regeneruje HP.
- Umiejętności: Oblepienie (zwarcie, CD 5 s): −20% szybkości gracza przez 3 s
- Słabość: Ogień +30% obrażeń. Łup: Mchowa galaretka, Zielone ziele.
- Animacja: chód — ściska się i wyciąga w pionie, odbija się od ziemi; śmierć — rozpłaszcza się i ciemnieje.

**Cierniowy Wilk** (`verdant-cierniowy-wilk`, poz. 2) — archetyp `quad` (kłus), rozmiar średni (0,80).

- Wygląd: a lean dark green wolf with long sharp thorns along its spine and tail, vines wrapped around its legs, glowing amber eyes, snarling.
- Statystyki: HP 67, ATK 12, DEF 4, XP 24; prędkość 1.2, zasięg 90, agro 400.
- Zachowanie: Poluje w grupach po 2–3. Okrąża cel i atakuje z flanki; przy HP poniżej 25% wycofuje się na 4 s.
- Umiejętności: Skok na cel (CD 6 s): 120% ATK; Wycie (1× na walkę): wzywa 1 sojusznika z okolicy
- Słabość: Obrażenia obszarowe (grupa). Łup: Cierń wilka, Skóra wilcza.
- Animacja: chód — unoszą się naprzemiennie łapy, lekki przechył korpusu; śmierć — przewraca się na bok (z boku) lub do przodu.

**Liściak Skrytobójca** (`verdant-lisciak-skrytobojca`, poz. 4) — archetyp `crawl` (drobne kroki), rozmiar średni (0,80).

- Wygląd: a mantis like leaf assassin insect with two leaf shaped blade arms, leaf shaped wings, camouflage green body, sharp glowing eyes.
- Statystyki: HP 95, ATK 23, DEF 4, XP 42; prędkość 1.1, zasięg 90, agro 200.
- Zachowanie: Nieruchomy i niewidoczny w krzakach. Wyskakuje, gdy gracz wejdzie w 200 j.; po pierwszym ciosie ucieka i chowa się na 8 s.
- Umiejętności: Cios z ukrycia (×2 obrażeń, tylko pierwszy atak); Krwawienie (3 s)
- Słabość: Ujawnia się po trafieniu obszarowym. Łup: Zielone ostrze, Sok liściaka.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

**Korzeniowy Pełzacz** (`verdant-korzeniowy-pelzacz`, poz. 6) — archetyp `slither` (fala), rozmiar duży (0,98).

- Wygląd: a long writhing serpent made of twisted brown tree roots, a bulb shaped head with small yellow flowers and a lamprey mouth.
- Statystyki: HP 255, ATK 20, DEF 13, XP 60; prędkość 0.4, zasięg 160, agro 300.
- Zachowanie: Ukryty pod ziemią. Wynurza się pod graczem, unieruchamia go i wraca pod ziemię na 4 s (nietykalny).
- Umiejętności: Oplątanie (CD 10 s): unieruchomienie 2 s; Wybuch korzeni (obszar 120 j.)
- Słabość: Ogień; w chwili wynurzenia +25% obrażeń. Łup: Żywy korzeń, Nasiona.
- Animacja: chód — fala biegnąca wzdłuż ciała; śmierć — opada i spłaszcza się.

**Grzybowy Zarodnik** (`verdant-grzybowy-zarodnik`, poz. 8) — archetyp `plant` (kołysanie), rozmiar średni (0,80).

- Wygląd: a giant red capped mushroom creature with white spots, a small angry face on its stalk, clouds of spores puffing from the cap, short root legs.
- Statystyki: HP 370, ATK 23, DEF 11, XP 76; prędkość 0, zasięg 350, agro 350.
- Zachowanie: Stacjonarny. Rzuca chmury zarodników w stronę gracza, nigdy się nie przemieszcza. Po śmierci wybucha chmurą.
- Umiejętności: Chmura zarodników (CD 7 s): obszar 150 j., trucizna 5 s; Wybuch po śmierci
- Słabość: Ogień +40%; szybkie zabicie z daleka. Łup: Zarodniki, Czerwony grzyb.
- Animacja: chód — kołysze się od podstawy, korzeń nieruchomy; śmierć — wygina się i opada.

**Bursztynowa Osa** (`verdant-bursztynowa-osa`, poz. 10) — archetyp `fly` (trzepot), rozmiar średni (0,80).

- Wygląd: a big amber colored wasp with translucent veined wings and a glowing amber stinger, black and gold stripes, flying.
- Statystyki: HP 238, ATK 39, DEF 10, XP 80; prędkość 1.4, zasięg 300, agro 450.
- Zachowanie: Lata nad celem, nurkuje i dystansuje się. Po 3 atakach odlatuje na 3 s. Poniżej 40% HP przyzywa 2 małe osy.
- Umiejętności: Żądło (CD 3 s): lekka trucizna; Rój (1× na walkę): 2 małe osy
- Słabość: Obrażenia obszarowe. Łup: Bursztyn, Żądło osy.
- Animacja: chód — unosi się i opada, skrzydła na zmianę; śmierć — spada na ziemię przechylony.

**Skalny Jeleń** (`verdant-skalny-jelen`, poz. 12) — archetyp `quad` (kłus), rozmiar duży (0,98).

- Wygląd: a powerful stag with stone plated hide, grey rock antlers, moss on its back and glowing green eyes.
- Statystyki: HP 594, ATK 39, DEF 28, XP 118; prędkość 1, zasięg 100, agro 300.
- Zachowanie: Pasie się i jest nieagresywny do czasu ataku. Po zaczepieniu szarżuje w linii prostej.
- Umiejętności: Szarża (CD 8 s): 150% ATK + ogłuszenie 1 s; Tupnięcie (obszar)
- Słabość: Po chybionej szarży odsłonięty 2 s (−30% DEF). Łup: Poroże, Skalna skóra.
- Animacja: chód — unoszą się naprzemiennie łapy, lekki przechył korpusu; śmierć — przewraca się na bok (z boku) lub do przodu.

**Leśny Pająk** (`verdant-lesny-pajak`, poz. 14) — archetyp `crawl` (drobne kroki), rozmiar średni (0,80).

- Wygląd: a forest spider with dark green carapace marked with leaf patterns, long spindly legs and silk strands.
- Statystyki: HP 516, ATK 48, DEF 21, XP 119; prędkość 0.9, zasięg 280, agro 400.
- Zachowanie: Zastawia do 3 sieci w promieniu 300 j., wabi gracza i atakuje z dystansu. Poza siecią porusza się wolniej.
- Umiejętności: Sieć: spowolnienie 40% przez 4 s; Plwocina (CD 6 s): trucizna
- Słabość: Ogień niszczy sieci i zadaje +30%. Łup: Jedwab pająka, Jad.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

**Puchacz Pyłowy** (`verdant-puchacz-pylowy`, poz. 16) — archetyp `fly` (trzepot), rozmiar średni (0,80).

- Wygląd: a large horned owl with dusty grey brown feathers, glowing yellow eyes, wings spread and trailing a cloud of dust.
- Statystyki: HP 554, ATK 63, DEF 18, XP 140; prędkość 1.3, zasięg 120, agro 500.
- Zachowanie: Aktywny nocą; w dzień ma 50% promienia agro. Krąży i nurkuje na cele z HP poniżej 60%.
- Umiejętności: Nurkowanie (CD 5 s): 130% ATK; Pył w oczy: −25% celności na 4 s
- Słabość: Po nurkowaniu wolniejszy przez 1 s. Łup: Pióro puchacza, Pył.
- Animacja: chód — unosi się i opada, skrzydła na zmianę; śmierć — spada na ziemię przechylony.

**Strażnik Ruin** (`verdant-straznik-ruin`, poz. 18) — archetyp `stomp` (ciężki krok), rozmiar duży (0,98).

- Wygląd: an ancient overgrown stone golem with moss and vines on its shoulders, glowing green runes and a heavy stone hammer fist.
- Statystyki: HP 1448, ATK 60, DEF 58, XP 218; prędkość 0.6, zasięg 100, agro 300.
- Zachowanie: Patroluje stałą trasę w ruinach. Po wykryciu blokuje ścieżkę; nie opuszcza obszaru (leash 500 j.).
- Umiejętności: Cios młotem (CD 6 s, telegraf 1 s): 180% ATK; Kamienna skóra (CD 20 s): −40% obrażeń przez 4 s
- Słabość: Obrażenia KI +25%. Łup: Kamień runiczny, Fragment ruin.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.

#### Aetheria

**Świetlik Pieczęci** (`aether-swietlik-pieczeci`, poz. 1) — archetyp `hover` (unoszenie), rozmiar mały (0,62).

- Wygląd: a floating glowing orb spirit of gold and emerald light with a small ring of runes orbiting it.
- Statystyki: HP 43, ATK 6, DEF 2, XP 13; prędkość 0.7, zasięg 250, agro 300.
- Zachowanie: Dryfuje wokół wyznaczonej pieczęci. Strzela iskrą z dystansu i utrzymuje odległość, nie opuszcza strefy pieczęci.
- Umiejętności: Iskra (CD 2,5 s): obrażenia KI
- Słabość: Obrażenia fizyczne +20%. Łup: Pył światła.
- Animacja: chód — pływa w górę i w dół, lekkie pulsowanie; śmierć — gaśnie i opada na ziemię.

**Pergaminowy Strażnik** (`aether-pergaminowy-straznik`, poz. 2) — archetyp `stomp` (ciężki krok), rozmiar średni (0,80).

- Wygląd: a tall robed guardian made of folded parchment scrolls with glowing gold runes written on it and a blank mask for a face.
- Statystyki: HP 84, ATK 10, DEF 4, XP 24; prędkość 0.8, zasięg 300, agro 300.
- Zachowanie: Stoi w bibliotece. Po wykryciu rzuca runami z dystansu i przesuwa się za osłony.
- Umiejętności: Runa (CD 4 s); Zapieczętowanie (CD 15 s): blokada umiejętności gracza na 2 s
- Słabość: Ogień +30%. Łup: Karta pergaminu.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.

**Kryształowy Motyl** (`aether-krysztalowy-motyl`, poz. 4) — archetyp `fly` (trzepot), rozmiar średni (0,80).

- Wygląd: a large butterfly with prism crystal wings that refract emerald and pale gold light, delicate crystal antennae.
- Statystyki: HP 82, ATK 12, DEF 10, XP 27; prędkość 1.2, zasięg 90, agro 250.
- Zachowanie: Łopocze po okolicy i nie atakuje pierwszy. Po trafieniu odbija część obrażeń w napastnika.
- Umiejętności: Odbicie (pasywne): 15% obrażeń wraca; Pyłek: oślepienie 2 s
- Słabość: Obrażenia obszarowe i KI omijają odbicie. Łup: Skrzydło kryształowe.
- Animacja: chód — unosi się i opada, skrzydła na zmianę; śmierć — spada na ziemię przechylony.

**Szmaragdowy Wąż** (`aether-szmaragdowy-waz`, poz. 6) — archetyp `slither` (fala), rozmiar średni (0,80).

- Wygląd: an emerald green serpent with gold markings, a jewel on its forehead and a raised hooded neck.
- Statystyki: HP 196, ATK 24, DEF 10, XP 57; prędkość 1, zasięg 100, agro 350.
- Zachowanie: Czai się w trawie. Atakuje dwukrotnie i wycofuje się; nie ściga dalej niż 400 j.
- Umiejętności: Ukąszenie: trucizna 5 s (do 3 stacków); Syk: −20% szybkości gracza
- Słabość: Obrażenia KI +20%. Łup: Szmaragdowa łuska.
- Animacja: chód — fala biegnąca wzdłuż ciała; śmierć — opada i spłaszcza się.

**Duch Bibliotekarza** (`aether-duch-bibliotekarza`, poz. 8) — archetyp `hover` (unoszenie), rozmiar średni (0,80).

- Wygląd: a translucent ghost of an old librarian with round spectacles, a floating robe trailing into wisps, pale blue white glow, holding a book.
- Statystyki: HP 211, ATK 25, DEF 4, XP 59; prędkość 0.9, zasięg 250, agro 300.
- Zachowanie: Przenika przez regały (ignoruje kolizje) i dryfuje do gracza. Po pierwszej śmierci powraca raz z 30% HP.
- Umiejętności: Uciszenie (CD 12 s): blokada umiejętności 3 s; Szept: −15% obrażeń gracza przez 4 s
- Słabość: Obrażenia KI +50%, fizyczne −40%. Łup: Eter bibliotekarza.
- Animacja: chód — pływa w górę i w dół, lekkie pulsowanie; śmierć — gaśnie i opada na ziemię.

**Złoty Skarabeusz** (`aether-zloty-skarabeusz`, poz. 10) — archetyp `crawl` (drobne kroki), rozmiar mały (0,62).

- Wygląd: a golden scarab beetle with an ornate engraved shell set with emerald gems and strong front legs.
- Statystyki: HP 510, ATK 30, DEF 31, XP 100; prędkość 0.7, zasięg 90, agro 300.
- Zachowanie: Maszeruje powoli w zwarciu. Po 3 otrzymanych trafieniach zwija się na 3 s (−70% obrażeń).
- Umiejętności: Rozbicie bariery: usuwa osłonę gracza; Taran (CD 9 s)
- Słabość: Obrażenia KI +30%; po zwinięciu odkryty. Łup: Złoty pancerz, Skarabeusz.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

**Lew Świątyni** (`aether-lew-swiatyni`, poz. 12) — archetyp `quad` (kłus), rozmiar duży (0,98).

- Wygląd: a living cream marble temple lion statue with gold ornament, emerald eyes and a carved mane.
- Statystyki: HP 678, ATK 46, DEF 30, XP 136; prędkość 1, zasięg 100, agro 350.
- Zachowanie: Posąg aktywowany wejściem w strefę. Walczy do końca; nie goni dalej niż 450 j. i wraca na postument.
- Umiejętności: Ryk (CD 14 s): strach 1,5 s; Pazur: 150% ATK
- Słabość: Runa na karku: trafienie w plecy +25%. Łup: Kamień świątynny.
- Animacja: chód — unoszą się naprzemiennie łapy, lekki przechył korpusu; śmierć — przewraca się na bok (z boku) lub do przodu.

**Oko Wiedzy** (`aether-oko-wiedzy`, poz. 14) — archetyp `hover` (unoszenie), rozmiar średni (0,80).

- Wygląd: a floating giant eye in an ornate golden frame with a ring of glowing runes and an emerald iris.
- Statystyki: HP 464, ATK 40, DEF 18, XP 103; prędkość 0.5, zasięg 400, agro 450.
- Zachowanie: Lewituje i prawie nie atakuje. Oznacza gracza i wzmacnia sojuszników; po 2 trafieniach ucieka.
- Umiejętności: Znak (CD 10 s): +20% obrażeń od sojuszników; Promień skupienia (CD 6 s); Wzmocnienie: +15% obrażeń sojusznika
- Słabość: Priorytetowy cel do zabicia. Łup: Soczewka wiedzy.
- Animacja: chód — pływa w górę i w dół, lekkie pulsowanie; śmierć — gaśnie i opada na ziemię.

**Marionetka Rytuału** (`aether-marionetka-rytualu`, poz. 16) — archetyp `stomp` (ciężki krok), rozmiar średni (0,80).

- Wygląd: a ritual puppet with wooden jointed limbs held by glowing strings, a white mask with gold lines and an ornate ceremonial robe.
- Statystyki: HP 739, ATK 59, DEF 26, XP 153; prędkość 0.9, zasięg 100, agro 350.
- Zachowanie: Agresywna, nigdy się nie wycofuje. Po zniszczeniu nici (poniżej 30% HP) traci część szybkości.
- Umiejętności: Combo 3 ciosów; Nić energii (CD 12 s): przyciąga cel
- Słabość: Obrażenia fizyczne +15%. Łup: Nić eteru, Maska rytuału.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.

**Mgielny Żuraw** (`aether-mgielny-zuraw`, poz. 18) — archetyp `fly` (trzepot), rozmiar duży (0,98).

- Wygląd: a tall crane made of mist and pale feathers with a long beak and long legs, fog trailing from its wings.
- Statystyki: HP 724, ATK 65, DEF 26, XP 156; prędkość 1.1, zasięg 350, agro 500.
- Zachowanie: Krąży nad sanktuarium, rzuca mgłę i zniża się do ataku. Ucieka poniżej 20% HP.
- Umiejętności: Mgła: widoczność −50% przez 5 s; Szpon z powietrza (CD 5 s)
- Słabość: Ataki dystansowe. Łup: Pióro mgły.
- Animacja: chód — unosi się i opada, skrzydła na zmianę; śmierć — spada na ziemię przechylony.

#### Nexus-9

**Dron Zwiadowca** (`nexus-dron-zwiadowca`, poz. 1) — archetyp `hover` (unoszenie), rozmiar mały (0,62).

- Wygląd: a small scout drone with a silver body, a single blue glowing lens and two spinning rotors.
- Statystyki: HP 37, ATK 6, DEF 2, XP 12; prędkość 1.1, zasięg 250, agro 450.
- Zachowanie: Patroluje stałą trasę. Po wykryciu gracza piszczy i wzywa 1 sojusznika, następnie strzela krótkimi seriami.
- Umiejętności: Wiązka (CD 3 s); Alarm (1× na walkę)
- Słabość: Obrażenia elektryczne +30%. Łup: Złom, Moduł optyczny.
- Animacja: chód — pływa w górę i w dół, lekkie pulsowanie; śmierć — gaśnie i opada na ziemię.

**Pełzacz Serwisowy** (`nexus-pelzacz-serwisowy`, poz. 2) — archetyp `crawl` (drobne kroki), rozmiar mały (0,62).

- Wygląd: a six legged maintenance crawler robot with small repair arms, a welding tool and orange service lights on a silver body.
- Statystyki: HP 76, ATK 7, DEF 5, XP 19; prędkość 0.7, zasięg 90, agro 250.
- Zachowanie: Trzyma się innych maszyn i naprawia je. Sam atakuje tylko wtedy, gdy nie ma kogo naprawiać.
- Umiejętności: Naprawa (CD 6 s): 5% HP/s sojusznikom w 200 j.; Kleszcze
- Słabość: Priorytetowy cel; elektryczne +30%. Łup: Zestaw naprawczy.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

**Skaner Gąsienicowy** (`nexus-skaner-gasienicowy`, poz. 4) — archetyp `stomp` (ciężki krok), rozmiar duży (0,98).

- Wygląd: a slow tracked scanner robot with a big lens turret on caterpillar treads and a sensor dish.
- Statystyki: HP 177, ATK 15, DEF 10, XP 44; prędkość 0.5, zasięg 400, agro 450.
- Zachowanie: Wolny. Utrzymuje dystans 300 j. i cofa się, gdy gracz podejdzie.
- Umiejętności: Wiązka skanująca (CD 5 s): rosnące obrażenia przy kolejnych trafieniach; Namierzenie: +20% obrażeń następnego ataku
- Słabość: Martwy kąt z tyłu +25%. Łup: Gąsienica, Soczewka.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.

**Pająk Spawalniczy** (`nexus-pajak-spawalniczy`, poz. 6) — archetyp `crawl` (drobne kroki), rozmiar średni (0,80).

- Wygląd: a robotic welding spider with a plasma torch on its abdomen, sparks, and graphite legs with blue joints.
- Statystyki: HP 196, ATK 26, DEF 10, XP 60; prędkość 1, zasięg 150, agro 350.
- Zachowanie: Wspina się po konstrukcjach i spada na cel. Zostawia strefy gorącego metalu.
- Umiejętności: Łuk spawalniczy (CD 5 s); Strefa żaru: obrażenia przez 4 s
- Słabość: Obrażenia elektryczne +20%. Łup: Elektroda, Złom.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

**Wieżyczka Autonomiczna** (`nexus-wiezyczka-autonomiczna`, poz. 8) — archetyp `turret` (prawie bez ruchu), rozmiar średni (0,80).

- Wygląd: a stationary autonomous turret on a wide base with twin rotating gun barrels and a blue targeting light.
- Statystyki: HP 396, ATK 35, DEF 21, XP 96; prędkość 0, zasięg 450, agro 500.
- Zachowanie: Nieruchoma. Obraca się 90°/s, więc można ją obejść z flanki. Strzela seriami; po 12 strzałach przegrzewa się.
- Umiejętności: Seria 3 pocisków (CD 4 s); Przegrzanie: wyłączona na 3 s
- Słabość: Flankowanie i przegrzanie. Łup: Cewka, Lufa.
- Animacja: chód — drżenie górnej części, korpus stoi; śmierć — przechyla się i ciemnieje (wygaszenie).

**Rój Nanitów** (`nexus-roj-nanitow`, poz. 10) — archetyp `blob` (podskok), rozmiar średni (0,80).

- Wygląd: a shifting blob of liquid silver nanites with glowing blue particles swirling inside it.
- Statystyki: HP 272, ATK 30, DEF 10, XP 72; prędkość 1.2, zasięg 90, agro 350.
- Zachowanie: Po otrzymaniu obrażeń rozdziela się na 2 części po 40% HP (maks. 1×). Jeśli obie żyją po 6 s, łączą się z powrotem.
- Umiejętności: Nanoprzeżarcie: −10% DEF gracza (do 3 stacków)
- Słabość: Obrażenia obszarowe, EMP. Łup: Nanopył.
- Animacja: chód — ściska się i wyciąga w pionie, odbija się od ziemi; śmierć — rozpłaszcza się i ciemnieje.

**Pies Łowca** (`nexus-pies-lowca`, poz. 12) — archetyp `quad` (kłus), rozmiar średni (0,80).

- Wygląd: a sleek robotic hunting hound with silver armor plates, a blue visor for eyes and hydraulic legs.
- Statystyki: HP 424, ATK 49, DEF 18, XP 113; prędkość 1.4, zasięg 90, agro 600.
- Zachowanie: Wybiera cel z najniższym HP w grupie i goni go do końca; ignoruje innych.
- Umiejętności: Skok (CD 6 s); Szarpnięcie: 120% ATK
- Słabość: Ogłuszenia i spowolnienia. Łup: Siłownik, Czujnik.
- Animacja: chód — unoszą się naprzemiennie łapy, lekki przechył korpusu; śmierć — przewraca się na bok (z boku) lub do przodu.

**Strażnik Rdzenia** (`nexus-straznik-rdzenia`, poz. 14) — archetyp `stomp` (ciężki krok), rozmiar duży (0,98).

- Wygląd: a heavy armored android guard with a glowing energy core on its chest and a plasma shield on its arm.
- Statystyki: HP 877, ATK 52, DEF 41, XP 162; prędkość 0.8, zasięg 120, agro 350.
- Zachowanie: Chroni wyznaczony obiekt; nie goni dalej niż 500 j. Poniżej 50% HP aktywuje tarczę plazmową.
- Umiejętności: Tarcza plazmowa (CD 25 s): absorbuje 25% max HP; Cios impulsowy (CD 6 s)
- Słabość: Obrażenia elektryczne zdejmują tarczę 2× szybciej. Łup: Rdzeń energii, Płyta pancerna.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.

**Latarnia Plazmowa** (`nexus-latarnia-plazmowa`, poz. 16) — archetyp `hover` (unoszenie), rozmiar średni (0,80).

- Wygląd: a floating lantern drone with a glowing plasma core inside a cage of rings and crackling sparks.
- Statystyki: HP 616, ATK 72, DEF 21, XP 159; prędkość 0.3, zasięg 450, agro 500.
- Zachowanie: Wolno dryfuje. Ładuje wyładowanie przez 2,5 s (widoczne ostrzeżenie), które trzeba przerwać lub uniknąć.
- Umiejętności: Wyładowanie plazmy (CD 9 s): 250% ATK, obszar; Iskra
- Słabość: Przerwanie ładowania ogłusza ją na 2 s. Łup: Rdzeń plazmy.
- Animacja: chód — pływa w górę i w dół, lekkie pulsowanie; śmierć — gaśnie i opada na ziemię.

**Kruk Danych** (`nexus-kruk-danych`, poz. 18) — archetyp `fly` (trzepot), rozmiar średni (0,80).

- Wygląd: a robotic raven with wing feathers made of glowing blue data lines and a silver beak.
- Statystyki: HP 579, ATK 60, DEF 23, XP 136; prędkość 1.3, zasięg 300, agro 500.
- Zachowanie: Lata wysoko. Zakłóca interfejs i oznacza gracza maszynom; ucieka poniżej 30% HP.
- Umiejętności: Zakłócenie (CD 14 s): ukrywa minimapę na 4 s; Znak łowcy: +15% obrażeń maszyn
- Słabość: Obrażenia elektryczne +30%. Łup: Pamięć danych.
- Animacja: chód — unosi się i opada, skrzydła na zmianę; śmierć — spada na ziemię przechylony.

#### Pyra

**Węgielek** (`pyra-wegielek`, poz. 1) — archetyp `blob` (podskok), rozmiar mały (0,62).

- Wygląd: a small rolling lump of glowing coal with ember cracks, sparks and a cute angry face.
- Statystyki: HP 61, ATK 7, DEF 3, XP 16; prędkość 0.6, zasięg 90, agro 250.
- Zachowanie: Powoli toczy się do celu. Po śmierci eksploduje (40% ATK w 120 j.).
- Umiejętności: Kontakt ognia: palenie 3 s; Wybuch po śmierci
- Słabość: Woda/zimno +30%. Łup: Węgiel.
- Animacja: chód — ściska się i wyciąga w pionie, odbija się od ziemi; śmierć — rozpłaszcza się i ciemnieje.

**Ognista Salamandra** (`pyra-ognista-salamandra`, poz. 2) — archetyp `slither` (fala), rozmiar średni (0,80).

- Wygląd: a fire salamander with red orange skin, flames licking along its back and a long tail.
- Statystyki: HP 67, ATK 12, DEF 3, XP 24; prędkość 1.2, zasięg 100, agro 400.
- Zachowanie: Szybko biega i zostawia płonący ślad na 3 s. Unika walki z grupami.
- Umiejętności: Ugryzienie: palenie 3 s; Ślad ognia
- Słabość: Woda/zimno +30%. Łup: Łuska salamandry.
- Animacja: chód — fala biegnąca wzdłuż ciała; śmierć — opada i spłaszcza się.

**Popielny Wilk** (`pyra-popielny-wilk`, poz. 4) — archetyp `quad` (kłus), rozmiar średni (0,80).

- Wygląd: a grey ash wolf with cinder like fur crumbling into ash and glowing ember eyes.
- Statystyki: HP 122, ATK 18, DEF 6, XP 40; prędkość 1.2, zasięg 90, agro 450.
- Zachowanie: Stado po 3. Wyłania się z popiołu i atakuje z flanki; poniżej 30% HP chowa się w popiele i regeneruje przez 5 s.
- Umiejętności: Skok (CD 6 s); Obłok popiołu: widoczność −30% przez 4 s
- Słabość: Obrażenia obszarowe. Łup: Popielne futro.
- Animacja: chód — unoszą się naprzemiennie łapy, lekki przechył korpusu; śmierć — przewraca się na bok (z boku) lub do przodu.

**Skalny Berserker** (`pyra-skalny-berserker`, poz. 6) — archetyp `stomp` (ciężki krok), rozmiar duży (0,98).

- Wygląd: a hulking rock berserker with basalt armor plates, crimson war paint and huge stone fists.
- Statystyki: HP 255, ATK 28, DEF 11, XP 70; prędkość 1, zasięg 100, agro 350.
- Zachowanie: Atakuje bez wycofania. Im mniej HP, tym więcej obrażeń (do +40% poniżej 30% HP).
- Umiejętności: Młot (CD 5 s); Wściekłość (poniżej 50% HP): +20% szybkości ataku
- Słabość: Ogłuszenia; zabić szybko. Łup: Skalny kastet.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.

**Magmowy Krab** (`pyra-magmowy-krab`, poz. 8) — archetyp `crawl` (drobne kroki), rozmiar średni (0,80).

- Wygląd: a giant lava crab with an obsidian shell split by glowing magma cracks and two huge claws.
- Statystyki: HP 396, ATK 25, DEF 28, XP 83; prędkość 0.6, zasięg 100, agro 300.
- Zachowanie: Ustawia się bokiem. Od frontu przyjmuje −60% obrażeń, z tyłu i boków jest podatny.
- Umiejętności: Kleszcze (CD 5 s); Zalew magmą: strefa 4 s
- Słabość: Atak z tyłu +40%; woda. Łup: Magmowy pancerz.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

**Żarowy Nietoperz** (`pyra-zarowy-nietoperz`, poz. 10) — archetyp `fly` (trzepot), rozmiar średni (0,80).

- Wygląd: a fiery bat with ember glowing wing membranes, orange veins and sharp fangs.
- Statystyki: HP 238, ATK 36, DEF 10, XP 76; prędkość 1.4, zasięg 100, agro 500.
- Zachowanie: Roje po 3. Krążą nad kraterami i atakują nurkując, po czym unikają kontrataku.
- Umiejętności: Nurkowanie (CD 4 s); Iskry: palenie 2 s
- Słabość: Obrażenia obszarowe. Łup: Skrzydło żaru.
- Animacja: chód — unosi się i opada, skrzydła na zmianę; śmierć — spada na ziemię przechylony.

**Golem Ruin** (`pyra-golem-ruin`, poz. 12) — archetyp `stomp` (ciężki krok), rozmiar duży (0,98).

- Wygląd: an obsidian rubble golem with glowing lava seams, jagged shoulders and a stone head.
- Statystyki: HP 848, ATK 53, DEF 40, XP 165; prędkość 0.5, zasięg 120, agro 300.
- Zachowanie: Powolny, ciosy telegrafowane 1,5 s. Poniżej 50% HP odrzuca odłamki w obszarze.
- Umiejętności: Miażdżenie (CD 7 s): 220% ATK; Odłamki (obszar)
- Słabość: Obrażenia KI +20%. Łup: Obsydian.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.

**Płomień-Duch** (`pyra-plomien-duch`, poz. 14) — archetyp `hover` (unoszenie), rozmiar średni (0,80).

- Wygląd: a floating flame spirit with a skull like face, swirling fire and two burning eyes.
- Statystyki: HP 413, ATK 60, DEF 12, XP 124; prędkość 0.8, zasięg 400, agro 450.
- Zachowanie: Unosi się nad areną, trzyma dystans i rzuca kule. Po śmierci zostawia strefę ognia na 5 s.
- Umiejętności: Kula ognia (CD 3,5 s); Pierścień ognia (CD 12 s)
- Słabość: Woda/zimno +40%. Łup: Esencja płomienia.
- Animacja: chód — pływa w górę i w dół, lekkie pulsowanie; śmierć — gaśnie i opada na ziemię.

**Byk Areny** (`pyra-byk-areny`, poz. 16) — archetyp `quad` (kłus), rozmiar duży (0,98).

- Wygląd: an arena bull with armored horns, a black and crimson plate harness, steam from its nostrils.
- Statystyki: HP 1109, ATK 68, DEF 36, XP 201; prędkość 1, zasięg 100, agro 400.
- Zachowanie: Tupie przez 1 s, potem szarżuje w linii prostej. Po chybieniu uderza w ścianę i ogłusza się na 2,5 s.
- Umiejętności: Szarża (CD 9 s): 200% ATK + ogłuszenie; Tupnięcie
- Słabość: Unik szarży = okno na atak. Łup: Róg areny.
- Animacja: chód — unoszą się naprzemiennie łapy, lekki przechył korpusu; śmierć — przewraca się na bok (z boku) lub do przodu.

**Skorpion Obsydianowy** (`pyra-skorpion-obsydianowy`, poz. 18) — archetyp `crawl` (drobne kroki), rozmiar średni (0,80).

- Wygląd: an obsidian scorpion with glass black shell, big pincers and a glowing red stinger on a curled tail.
- Statystyki: HP 869, ATK 75, DEF 44, XP 184; prędkość 1, zasięg 150, agro 400.
- Zachowanie: Zakopuje się w piasku i wynurza tuż obok gracza. Trucizna kumuluje się.
- Umiejętności: Żądło: trucizna (do 5 stacków); Pułapka piaskowa
- Słabość: Woda/zimno +20%; ogon pęka po 3 trafieniach. Łup: Szkło obsydianowe.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

Prawa do referencji i checkpointów: [licencje](LICENCJE.md). Kontrola grafiki nie jest odbiorem praw.

<!-- BESTIARY:END -->

## Umiejętności — uzupełnienia implementacyjne

Złoty Krąg: 0,4 ATK/s przez 3 s; Kataklizm podpala łącznie 50% ATK przez 5 s.
Strumień KI nie przerywa się ruchem/trafieniem; Skupienie i Medytacja mają własne
warunki przerwania. Salwa Precyzyjna i Protokół Egzekucji wymagają oznaczenia celu.
Zdolności i efekty pozostają proceduralne, dopóki nie zostaną zaimportowane paczki.
Manekin używa realnych kosztów KI i cooldownów, liczy bezpośrednie trafienia przy
0 obrony, bez XP/złota/łupu; nie jest pełnym symulatorem DOT i kontroli.


## Osobna generacja spawnów całej planety

Decyzja właściciela 23.10.2026: generować spawny jako osobny etap po danych
geometrii, dróg, osad i wnętrz. Generator `scripts/worldgen/spawn_generate.py`
wiąże wynik z sumą manifestu terenu i katalogu bestiariusza. Nie modyfikuje
statystyk 40 potworów, źródłowych map ani zapisów gracza. Zasady bezpieczeństwa,
streamingu i ograniczenia integracji: [świat](SWIAT-I-MIASTA.md#pełna-generacja-superior-na-cpu--23102026).
Wygenerowany spawn nie jest aktywnym przeciwnikiem w aktualnie opublikowanej grze.

## Integracja sterowania Argona — 26.10.2026

Baza audytu: main `062b57b73600264ab354018a624c2b132f8bc08c`, po scalonym PR #29.
Gałąź: `feature/argon-combat-mobile-integration`. Oryginalny ZIP właściciela
zabezpieczono w `deliveries/argon-20261026/` wraz z SHA-256 każdego źródła.
Przeanalizowano także `deliveries/argon-20261024/quests-v2-src-only.patch`.

### Audyt i decyzje

CombatSandbox jest osobną symulacją Canvas/React: pociski poruszają się o wartości
na klatkę, koszty i cooldowny żyją w React, XP używa `level * 60`, a śmierć nie
korzysta z kontraktu sesji Phaser. Nie włączamy tego silnika. Aktualny GameSession
i cztery kity już obsługują ataki, combo Planetarnego, dash A1, kanały, tarcze,
statusy, reakcje, śmierć/odrodzenie i progresję według aneksu właściciela.

`skillTrees.ts` ma 29 alternatywnych węzłów na rasę, lecz zero wspólnych ID
z kanonem, cztery gałęzie zamiast trzech i inne statystyki (np. HP Planetarnego
165 zamiast 125). Brak równoważnych wymagań poziomów i kosztów nauki.
Nie przenosimy nazw, zależności, premii ani nowych mechanik rasowych tego pliku.
Natomiast `progression.ts`, używany przez HudShowcaseModal, zgadza się z kanonem
w ID, nazwach, wymaganiach poziomów, rodzicach i wykluczeniach wszystkich 116 węzłów.
Dowód: [porównanie drzewek](zmiany/2026-10-26/qa/argon-combat/tree-comparison.json).
Istniejący GraphicSkillTree już czyta kanoniczne węzły, więc nie dodano drugiego.

### Faktyczne zmiany runtime

| Funkcja | Stan przed | Zmiana | Dowód działania |
| --- | --- | --- | --- |
| Ruch i atak/skill dwoma kciukami | każda komenda HUD zerowała joystick | komendy ability zachowują wskaźnik ruchu | argon-mobile.spec.ts: cztery rasy i cztery rozdzielczości |
| Naciśnięcie akcji | click po zwolnieniu palca | pointerdown, jeden właściciel wskaźnika, bez podwójnego click; klawiatura zachowana | combat-action.test.tsx i testy CDP |
| Anulowanie dotyku | anulowany krótki dotyk mógł wykonać akcję mapy | wasCanceled nie wywołuje interactAt; pointercancel zwalnia ruch | argon-mobile.spec.ts |
| Menu i okna | niejednolite zwalnianie wejścia | otwarcie menu zwalnia joystick; dialog/depozyt/pauza/śmierć czyszczą ruch | argon-mobile.spec.ts i regresja stage3 |
| KI i cooldowny | koszt w tytule, czas w ikonie | widoczny koszt KI w każdej technice, wartości z AbilityInfo | argon-mobile.spec.ts, argon-combat.test.ts |
| Zadanie v2 w HUD | pasek pokazywał stare zadania | krótki tytuł aktywnego zadania/stadium z istniejącego questsV2 | test dziennika i reload w argon-mobile.spec.ts |
| Drzewka i zapisy | kanoniczne kity i walidowane zapisy | bez zmiany formatu; dodatkowe testy v4→v5, umiejętności i konfliktu kart | argon-combat.test.ts: cztery rasy |

HUD zachowuje obecną oprawę manga i strony technik; dostęp do HP/KI/XP/celu,
ekwipunku, drzewek, dziennika i mapy pozostaje w dotychczasowych komponentach.
Nowe małe komponenty CombatAction i CombatQuestSummary ograniczają zakres
wspólnego GameHud.tsx. Nie zmieniono DiabloInventory, GraphicSkillTree ani
QuestsV2Journal, generatorów świata, geometrii i plików *.generated.ts.

### Świadomie nieprzeniesione rozwiązania

- Alternatywny balans skillTrees oraz projectile/AI/XP sandboxa: sprzeczne
  z kanonem lub dublujące działający silnik; cooldowny i obrażenia zostają w kitach.
- Udawane zasoby, tarcze i ultimate z makiet: HUD pokazuje realny stan sesji.
- D-pad: działający analogowy joystick Phaser pozostaje podstawowym sterowaniem.
- Nowe deformacje sprite'ów i czyszczenie tła: istnieją już atlasy i kontrakty
  siedmiu stanów w ośmiu kierunkach, ich zastąpienie zmieniłoby oprawę poza zadaniem.
- Dane sprzętu i nowych baz ras z Argona: nie zastępują zatwierdzonego ekwipunku.

Zapis v5 i starsze v1/v3/v4, zapis Superior oraz oddzielny dziennik questsV2
nie otrzymały nowej migracji ani resetu; testy sprawdzają istniejące ścieżki odczytu
i kopię bajtów przed migracją. Nie przenosi się save z sandboxa do gry.
Fizyczny Android/iPhone pozostaje niezweryfikowany w tym środowisku.
Wyniki końcowe i SHA należy odczytać z dziennika 26.10 i PR.

### Zastąpiony dokument QUESTS-V2

Dostarczony wcześniej osobny dokument miał opisy makiet jako wdrożeń i stare
rozmiary map. Jego niezmienione bajty zachowano w
[źródle historycznym](zmiany/2026-10-26/qa/argon-combat/quests-v2-source.txt),
aby przywrócić wymagane 10 aktywnych dokumentów bez utraty materiału.
Aktualnie questsV2 jest podłączony w superiorRuntime wyłącznie dla
`?ki-world-v2=1`: rozmowy, odkrycia, wejścia do miast i zabójstwa zasilają tracker,
a QuestsV2Journal czyta jego oddzielny zapis `ki_legends_save_v5`.
Nie wszystkie zadania mają wsparcie runtime; oznaczenia ograniczeń są w dzienniku.
