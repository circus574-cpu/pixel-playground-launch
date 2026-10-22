# Ki Legends — aneks statystyk ras i drzewek umiejętności (poz. 1–20)

**Status: KONCEPCJA 1.0 z 22.10.2026 — niezaimplementowana i niezatwierdzona jako balans produkcyjny.**

**Źródło oryginalne:** [`Ki_Legends_Aneks_Rasy_i_Drzewka_Umiejetnosci.pdf`](./source-annexes/Ki_Legends_Aneks_Rasy_i_Drzewka_Umiejetnosci.pdf) · 11 stron · SHA-256 `0358053e7e467bffd41055f50f765d0f33cbf15c6b0176266c866d493dda5cff`.

## Statystyki ras

Wartość statystyki na poziomie L = wartość bazowa + przyrost × (L − 1). Statystyki całkowite zaokrąglać do najbliższej liczby całkowitej, połówki w górę (wg aneksu).

| Statystyka                            | Planetarni | Mędrcy | Androidy | Legendy |
| ------------------------------------- | ---------: | -----: | -------: | ------: |
| Życie (poz. 1)                        |        125 |    100 |      115 |     140 |
| Życie (przyrost/poz.)                 |        +36 |    +28 |      +34 |     +42 |
| Ki (poz. 1)                           |         50 |     80 |       60 |      40 |
| Ki (przyrost/poz.)                    |         +4 |     +7 |       +5 |      +3 |
| Atak (poz. 1)                         |         12 |     14 |       12 |      14 |
| Atak (przyrost/poz.)                  |         +4 |   +4,6 |     +3,8 |    +4,6 |
| Obrona (poz. 1)                       |          5 |      3 |        7 |       4 |
| Obrona (przyrost/poz.)                |       +2,4 |   +1,6 |       +3 |      +2 |
| Szybkość ruchu (j./s) (poz. 1)        |        185 |    170 |      175 |     170 |
| Szybkość ruchu (j./s) (przyrost/poz.) |          — |      — |        — |       — |
| Regeneracja Ki (na s) (poz. 1)        |        1,0 |    2,0 |      1,2 |     0,8 |
| Regeneracja Ki (na s) (przyrost/poz.) |      +0,05 |   +0,1 |    +0,06 |   +0,04 |
| Szansa krytyku (%) (poz. 1)           |          5 |      5 |        8 |       6 |
| Szansa krytyku (%) (przyrost/poz.)    |      +0,25 |   +0,2 |     +0,4 |    +0,3 |
| Odstęp ataków (ms) (poz. 1)           |        650 |    800 |      700 |     750 |
| Odstęp ataków (ms) (przyrost/poz.)    |          — |      — |        — |       — |

Ruch i odstęp ataków nie rosną z poziomem; zmianę mogą wprowadzić umiejętności. Dane poziomów 10 i 20 oraz kontrolne pojedynki znajdują się w oryginalnym PDF (str. 2).

## Zasady drzewek (str. 3)

- 1 punkt umiejętności na poziom w zakresie 1–20 = 20 punktów; każdy węzeł kosztuje 1 punkt.
- Każda rasa: korzeń (zdolność startowa), 3 gałęzie po 9 węzłów, Tryb KI; łącznie 29 węzłów.
- Wymagany poprzednik i poziom; `A2|A3` oznacza alternatywę.
- Pary wyboru `A7/A8`, `B7/B8`, `C7/C8` wykluczają się.
- Tryb KI: co najmniej 20. poziom i dowolny węzeł A9, B9 lub C9.
- Proponowany darmowy pierwszy reset do poz. 10; późniejsze koszty do ustalenia.
- Aneks zastępuje dawny sztywny harmonogram zdobywania zdolności (poz. 1, 3, 6, 9, 12, 15, 18, 20); treść nagród fabularnych wymaga późniejszej migracji.

## Sprzeczność nazw krain wymagająca rozstrzygnięcia

| Rasa       | Nazwa startowej krainy w aneksie | Bieżąca nazwa w grze | Id świata |
| ---------- | -------------------------------- | -------------------- | --------- |
| Planetarni | Terranova                        | Verdantia            | `verdant` |
| Mędrcy     | Eldoria                          | Aetheria             | `aether`  |
| Androidy   | Nexaris                          | Nexus-9              | `nexus`   |
| Legendy    | Valthera                         | Pyra                 | `pyra`    |

Nie zmieniać nazw krain ani zapisów graczy na podstawie tego aneksu bez osobnej decyzji właściciela.

## Planetarni — drzewko (schemat i pełna tabela; str. 4–5)

**Rola:** Mobilny wojownik wręcz. **Mechanika rasowa:** Adaptacja do terenu. **Zdolność startowa:** Cios Szlaku.

**Gałęzie:** A — Szlak Wędrowca; B — Żywa Ziemia; C — Pieśń Korzeni.

| Kod | Nazwa                  | Typ      | Wymagane (jedno z) | Poz. min. | Efekt projektowy                                                                                |
| --- | ---------------------- | -------- | ------------------ | --------: | ----------------------------------------------------------------------------------------------- |
| R   | Cios Szlaku            | starting | —                  |         1 | Atak wręcz ×1,0 co 650 ms; trzeci cios serii ×1,3. Bez kosztu Ki.                               |
| A1  | Szybki Unik            | active   | korzeń             |         2 | Zryw w wybranym kierunku (160 j.), 0,4 s nietykalności; 8 Ki; odn. 6 s.                         |
| A2  | Lekki Krok             | passive  | A1                 |         4 | +6% szybkości ruchu.                                                                            |
| A3  | Pęd Szlaku             | passive  | A1                 |         4 | Po uniku następny atak zadaje +25% obrażeń (5 s).                                               |
| A4  | Wir Energii            | active   | A2                 |        A3 | 7                                                                                               | Wirujący atak wokół postaci ×1,8, promień 140 j.; 18 Ki; odn. 10 s.           |
| A5  | Wiatr w Plecy          | passive  | A4                 |        10 | Po pokonaniu wroga +15% szybkości ruchu przez 4 s.                                              |
| A6  | Oko Zwiadowcy          | passive  | A4                 |        10 | +5% szansy krytyku.                                                                             |
| A7  | Cios z Cienia          | choice   | A5                 |        13 | Pierwszy atak po uniku zawsze jest krytyczny. Wyklucza A8.                                      |
| A8  | Nieuchwytny            | choice   | A6                 |        13 | Odnowienie Uniku −30%, po uniku +20% obrony przez 1 s. Wyklucza A7.                             |
| A9  | Burza Wędrowca         | ultimate | A7                 |        A8 | 16                                                                                              | Seria 5 szybkich uderzeń w pobliskich wrogów, łącznie ×4,0; 35 Ki; odn. 30 s. |
| B1  | Impuls Ziemi           | active   | korzeń             |         2 | Uderzenie w ziemię ×1,4, promień 120 j., spowolnienie 30% na 2 s; 10 Ki; odn. 6 s.              |
| B2  | Adaptacja              | passive  | B1                 |         4 | Bonus zależny od terenu: las +30% regeneracji Ki, skały +10% obrony, woda +8% szybkości.        |
| B3  | Kamienna Skóra         | passive  | B1                 |         4 | +8% obrony.                                                                                     |
| B4  | Kruszący Stąp          | active   | B2                 |        B3 | 7                                                                                               | Skok i uderzenie ×2,0, ogłuszenie 1 s; 18 Ki; odn. 10 s.                      |
| B5  | Rezonans               | passive  | B4                 |        10 | Impuls Ziemi uderza drugi raz po 0,5 s za 60% obrażeń.                                          |
| B6  | Żyła Ziemi             | passive  | B4                 |        10 | Impuls Ziemi zwraca 5 Ki za każdego trafionego wroga (maks. 15).                                |
| B7  | Głaz Strażnik          | choice   | B5                 |        13 | Kruszący Stąp tworzy osłonę pochłaniającą 15% maks. życia przez 5 s. Wyklucza B8.               |
| B8  | Trzęsienie             | choice   | B6                 |        13 | Impuls Ziemi: promień +40% i ogłuszenie 0,5 s. Wyklucza B7.                                     |
| B9  | Gniew Doliny           | ultimate | B7                 |        B8 | 16                                                                                              | Ogromne uderzenie obszarowe ×4,0, ogłuszenie 1,5 s; 35 Ki; odn. 30 s.         |
| C1  | Korzenny Oddech        | active   | korzeń             |         2 | Leczy 12% maks. życia w ciągu 4 s; 12 Ki; odn. 12 s.                                            |
| C2  | Zielona Krew           | passive  | C1                 |         4 | +10% maks. życia.                                                                               |
| C3  | Leśna Cierpliwość      | passive  | C1                 |         4 | Poza walką regeneracja życia 1% maks. na sekundę.                                               |
| C4  | Tarcza Liści           | active   | C2                 |        C3 | 7                                                                                               | Tarcza pochłaniająca 18% maks. życia przez 5 s; 18 Ki; odn. 12 s.             |
| C5  | Korzenie Odporności    | passive  | C4                 |        10 | Czas trwania efektów kontroli na postaci −25%.                                                  |
| C6  | Ziarno Życia           | passive  | C4                 |        10 | Leczenie z Korzennego Oddechu +30%.                                                             |
| C7  | Strażnik Gaju          | choice   | C5                 |        13 | Tarcza Liści odbija 20% obrażeń wręcz. Wyklucza C8.                                             |
| C8  | Dar Lasu               | choice   | C6                 |        13 | Korzenny Oddech zwraca 15 Ki. Wyklucza C7.                                                      |
| C9  | Pieśń Korzeni          | ultimate | C7                 |        C8 | 16                                                                                              | Leczy 40% maks. życia i daje tarczę 20% na 6 s; 35 Ki; odn. 45 s.             |
| T   | Forma Rezonansu Świata | ki-mode  | A9, B9 lub C9      |        20 | 20 s: +20% Ataku, +15% Obrony, +10% szybkości ruchu; aura jako osobny efekt; 50 Ki; odn. 120 s. |

**Uwaga:** tabela opisuje projekt; efekty, czasy odnowienia i koszt Ki nie są jeszcze przypięte do silnika gry.

## Mędrcy — drzewko (schemat i pełna tabela; str. 6–7)

**Rola:** Mag dystansowy i wsparcie. **Mechanika rasowa:** Kręgi światła. **Zdolność startowa:** Pocisk Ki.

**Gałęzie:** A — Pieczęcie; B — Kręgi i Bariery; C — Skupienie.

| Kod | Nazwa              | Typ      | Wymagane (jedno z) | Poz. min. | Efekt projektowy                                                                                     |
| --- | ------------------ | -------- | ------------------ | --------: | ---------------------------------------------------------------------------------------------------- |
| R   | Pocisk Ki          | starting | —                  |         1 | Pocisk dystansowy ×1,0 co 800 ms, zasięg 420 j. Bez kosztu Ki.                                       |
| A1  | Pieczęć Energii    | active   | korzeń             |         2 | Znak na celu; po 3 s wybucha za ×2,0; 12 Ki; odn. 8 s.                                               |
| A2  | Znak Wiedzy        | passive  | A1                 |         4 | Wrogowie z pieczęcią przyjmują +10% obrażeń.                                                         |
| A3  | Szybka Pieczęć     | passive  | A1                 |         4 | Odnowienie Pieczęci Energii −20%.                                                                    |
| A4  | Strumień Ki        | active   | A2                 |        A3 | 7                                                                                                    | Kanałowany promień 3 s, łącznie ×2,4 (co 0,5 s); 20 Ki; odn. 12 s.                  |
| A5  | Echo Pieczęci      | passive  | A4                 |        10 | Wybuch Pieczęci rani też pobliskich wrogów za 50% obrażeń.                                           |
| A6  | Precyzja Mędrca    | passive  | A4                 |        10 | +8% szansy krytyku.                                                                                  |
| A7  | Złoty Krąg         | choice   | A5                 |        13 | Wybuch Pieczęci tworzy krąg obrażeń o promieniu 120 j. Wyklucza A8.                                  |
| A8  | Pieczęć Skupienia  | choice   | A6                 |        13 | Wybuch Pieczęci zwraca 15 Ki. Wyklucza A7.                                                           |
| A9  | Sąd Światła        | ultimate | A7                 |        A8 | 16                                                                                                   | Po 1,5 s słup światła w dużym obszarze ×4,2; 35 Ki; odn. 30 s.                      |
| B1  | Świetlista Bariera | active   | korzeń             |         2 | Tarcza pochłaniająca 15% maks. życia przez 4 s; 12 Ki; odn. 10 s.                                    |
| B2  | Kontrola Kręgu     | passive  | B1                 |         4 | Zdolności zostawiają krąg światła (5 s): +10% obrony postaci w jego obrębie.                         |
| B3  | Gęste Światło      | passive  | B1                 |         4 | Bariera trwa o 2 s dłużej.                                                                           |
| B4  | Krąg Spowolnienia  | active   | B2                 |        B3 | 7                                                                                                    | Krąg na 5 s: wrogowie w nim −40% szybkości; 18 Ki; odn. 12 s.                       |
| B5  | Odbicie            | passive  | B4                 |        10 | Bariera odbija 15% obrażeń z pocisków.                                                               |
| B6  | Strażnik Kręgu     | passive  | B4                 |        10 | Wrogowie w kręgach zadają −10% obrażeń.                                                              |
| B7  | Kopuła             | choice   | B5                 |        13 | Pojemność Bariery +30%. Wyklucza B8.                                                                 |
| B8  | Lustro             | choice   | B6                 |        13 | Bariera odbija pierwszy atak wroga w całości. Wyklucza B7.                                           |
| B9  | Świątynia Światła  | ultimate | B7                 |        B8 | 16                                                                                                   | Wielki krąg na 8 s: +30% obrony postaci, wrogowie −30% szybkości; 35 Ki; odn. 40 s. |
| C1  | Skupienie KI       | active   | korzeń             |         2 | Kanałowanie 3 s: odnawia 30% maks. Ki (przerywane ruchem lub trafieniem); odn. 15 s.                 |
| C2  | Głęboki Oddech     | passive  | C1                 |         4 | +15% maks. Ki.                                                                                       |
| C3  | Mądrość Strażników | passive  | C1                 |         4 | Koszty Ki zdolności −8%.                                                                             |
| C4  | Medytacja Bojowa   | active   | C2                 |        C3 | 7                                                                                                    | Kanałowanie 3 s: leczy 20% maks. życia; 10 Ki; odn. 15 s.                           |
| C5  | Czysty Umysł       | passive  | C4                 |        10 | Czas trwania efektów kontroli na postaci −25%.                                                       |
| C6  | Strumień Wiedzy    | passive  | C4                 |        10 | Po Skupieniu KI następna zdolność zadaje +25% obrażeń (6 s).                                         |
| C7  | Dar Mędrca         | choice   | C5                 |        13 | Medytacja Bojowa leczy o 50% więcej. Wyklucza C8.                                                    |
| C8  | Skupienie Mistrza  | choice   | C6                 |        13 | Skupienie KI nie jest przerywane ruchem. Wyklucza C7.                                                |
| C9  | Pełnia Skupienia   | ultimate | C7                 |        C8 | 16                                                                                                   | 8 s: zdolności nie kosztują Ki i zadają +30% obrażeń; 20 Ki; odn. 60 s.             |
| T   | Forma Oświecenia   | ki-mode  | A9, B9 lub C9      |        20 | 20 s: +25% Ataku, odnowienia zdolności −30%, +15% Obrony; aura jako osobny efekt; 50 Ki; odn. 120 s. |

**Uwaga:** tabela opisuje projekt; efekty, czasy odnowienia i koszt Ki nie są jeszcze przypięte do silnika gry.

## Androidy — drzewko (schemat i pełna tabela; str. 8–9)

**Rola:** Precyzyjny strzelec z tarczami. **Mechanika rasowa:** Ładunek Rdzenia. **Zdolność startowa:** Strzał Impulsowy.

**Gałęzie:** A — Systemy Celownicze; B — Pancerz i Tarcze; C — Rdzeń.

| Kod | Nazwa                 | Typ      | Wymagane (jedno z) | Poz. min. | Efekt projektowy                                                                                                                                                 |
| --- | --------------------- | -------- | ------------------ | --------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R   | Strzał Impulsowy      | starting | —                  |         1 | Strzał ×1,0 co 700 ms, zasięg 360 j.; każdy strzał +4 Ładunku Rdzenia (maks. 100). Przy 100 przegrzanie: 2 s bez strzałów. Ładunek opada o 6/s poza strzelaniem. |
| A1  | Namierzanie           | active   | korzeń             |         2 | Oznacza cel na 6 s: +15% szansy krytyku przeciw niemu; 8 Ki; odn. 8 s.                                                                                           |
| A2  | Kalibracja            | passive  | A1                 |         4 | +6% szansy krytyku.                                                                                                                                              |
| A3  | Stabilizatory         | passive  | A1                 |         4 | Zasięg strzałów +15%.                                                                                                                                            |
| A4  | Salwa Precyzyjna      | active   | A2                 |        A3 | 7                                                                                                                                                                | Trzy strzały w oznaczony cel, łącznie ×2,2; 18 Ki; odn. 10 s.                                      |
| A5  | Analiza Słabości      | passive  | A4                 |        10 | Oznaczeni wrogowie mają −10% obrony.                                                                                                                             |
| A6  | Szybkie Przeładowanie | passive  | A4                 |        10 | Odstęp strzałów −8%.                                                                                                                                             |
| A7  | Snajper               | choice   | A5                 |        13 | +40% obrażeń przeciw oznaczonym, odstęp strzałów +10%. Wyklucza A8.                                                                                              |
| A8  | Rój                   | choice   | A6                 |        13 | Strzał rozdziela się na 2 dodatkowe pobliskie cele (po 40% obrażeń). Wyklucza A7.                                                                                |
| A9  | Protokół Egzekucji    | ultimate | A7                 |        A8 | 16                                                                                                                                                               | Strzał ×4,0 w oznaczony cel, ×6,0 gdy cel ma poniżej 30% życia; 35 Ki; odn. 30 s.                  |
| B1  | Tarcza Plazmowa       | active   | korzeń             |         2 | Tarcza pochłaniająca 18% maks. życia przez 5 s; 12 Ki; odn. 10 s.                                                                                                |
| B2  | Płyty Pancerne        | passive  | B1                 |         4 | +8% obrony.                                                                                                                                                      |
| B3  | Generator Tarczy      | passive  | B1                 |         4 | Pojemność Tarczy +25%.                                                                                                                                           |
| B4  | Impuls Odpychający    | active   | B2                 |        B3 | 7                                                                                                                                                                | Fala ×1,2 odpycha pobliskich wrogów i ogłusza na 0,5 s; 18 Ki; odn. 12 s.                          |
| B5  | Protokół Adaptacji    | passive  | B4                 |        10 | Tarcza Plazmowa odbija 25% obrażeń z pocisków.                                                                                                                   |
| B6  | Samonaprawa           | passive  | B4                 |        10 | Regeneracja życia 0,5% maks. na sekundę.                                                                                                                         |
| B7  | Tarcza Kolcowa        | choice   | B5                 |        13 | Tarcza odbija 30% obrażeń wręcz. Wyklucza B8.                                                                                                                    |
| B8  | Tarcza Modułowa       | choice   | B6                 |        13 | Odnowienie Tarczy −35%. Wyklucza B7.                                                                                                                             |
| B9  | Fortyfikacja          | ultimate | B7                 |        B8 | 16                                                                                                                                                               | 6 s: +60% obrony i odporność na efekty kontroli; 35 Ki; odn. 40 s.                                 |
| C1  | Wyładowanie Rdzenia   | active   | korzeń             |         2 | Zużywa cały Ładunek: obrażenia ×(1,0 + Ładunek/50), do ×3,0 przy 100, w linii przed postacią; 15 Ki; odn. 8 s.                                                   |
| C2  | Zarządzanie Rdzeniem  | passive  | C1                 |         4 | Przegrzanie trwa 1 s zamiast 2 s; Ładunek opada o 50% szybciej.                                                                                                  |
| C3  | Radiatory             | passive  | C1                 |         4 | Każdy strzał dodaje o 15% mniej Ładunku.                                                                                                                         |
| C4  | Rozładowanie Awaryjne | active   | C2                 |        C3 | 7                                                                                                                                                                | Zeruje Ładunek i leczy 10% maks. życia; 0 Ki; odn. 20 s.                                           |
| C5  | Rezerwowy Akumulator  | passive  | C4                 |        10 | +12% maks. Ki.                                                                                                                                                   |
| C6  | Optymalizacja         | passive  | C4                 |        10 | Koszt Ki Wyładowania Rdzenia −20%.                                                                                                                               |
| C7  | Przeciążony Rdzeń     | choice   | C5                 |        13 | Maks. Ładunek 150 (Wyładowanie do ×4,0); przegrzanie przy 150. Wyklucza C8.                                                                                      |
| C8  | Stabilny Rdzeń        | choice   | C6                 |        13 | Przegrzanie nigdy nie następuje; maks. Ładunek 70. Wyklucza C7.                                                                                                  |
| C9  | Przeciążenie Systemu  | ultimate | C7                 |        C8 | 16                                                                                                                                                               | 6 s: zdolności nie kosztują Ki, +40% obrażeń; potem 2 s wyłączenia (brak akcji); 35 Ki; odn. 45 s. |
| T   | Forma Pełnego Rdzenia | ki-mode  | A9, B9 lub C9      |        20 | 20 s: +25% Ataku, +15% Obrony, przegrzanie wyłączone; aura jako osobny efekt; 50 Ki; odn. 120 s.                                                                 |

**Uwaga:** tabela opisuje projekt; efekty, czasy odnowienia i koszt Ki nie są jeszcze przypięte do silnika gry.

## Legendy — drzewko (schemat i pełna tabela; str. 10–11)

**Rola:** Wojownik w zwarciu i burst. **Mechanika rasowa:** Żar. **Zdolność startowa:** Uderzenie Żaru.

**Gałęzie:** A — Ogień Walki; B — Żelazna Wola; C — Wybuch KI.

| Kod | Nazwa                     | Typ      | Wymagane (jedno z) | Poz. min. | Efekt projektowy                                                                                                                       |
| --- | ------------------------- | -------- | ------------------ | --------: | -------------------------------------------------------------------------------------------------------------------------------------- |
| R   | Uderzenie Żaru            | starting | —                  |         1 | Cios wręcz ×1,0 co 750 ms; każde trafienie +4 Żaru (maks. 100). Żar daje +0,1% obrażeń za punkt (maks. +10%) i opada o 5/s poza walką. |
| A1  | Ogniste Cięcie            | active   | korzeń             |         2 | Kombinacja 3 cięć, łącznie ×1,8; 10 Ki; odn. 6 s.                                                                                      |
| A2  | Rozgrzane Ostrza          | passive  | A1                 |         4 | Cięcia podpalają na 3 s (łącznie 30% Ataku).                                                                                           |
| A3  | Łańcuch Ciosów            | passive  | A1                 |         4 | Po 3 trafieniach z rzędu odstęp ataków −10% na 4 s.                                                                                    |
| A4  | Szarża Płomienia          | active   | A2                 |        A3 | 7                                                                                                                                      | Doskok (200 j.) i cięcie ×2,2; 18 Ki; odn. 10 s.                                                |
| A5  | Rozżarzone Pięści         | passive  | A4                 |        10 | +8% Ataku.                                                                                                                             |
| A6  | Okrucieństwo              | passive  | A4                 |        10 | +6% szansy krytyku.                                                                                                                    |
| A7  | Taniec Płomieni           | choice   | A5                 |        13 | Ogniste Cięcie ma 5 cięć (łącznie ×2,6). Wyklucza A8.                                                                                  |
| A8  | Pojedynkowicz             | choice   | A6                 |        13 | +25% obrażeń, gdy w zasięgu 200 j. jest tylko jeden wróg. Wyklucza A7.                                                                 |
| A9  | Tysiąc Cięć               | ultimate | A7                 |        A8 | 16                                                                                                                                     | Seria 8 cięć, łącznie ×4,2; 35 Ki; odn. 30 s.                                                   |
| B1  | Przełamanie               | active   | korzeń             |         2 | Cios kruszący ×1,5, ogłuszenie 1,2 s i zniszczenie osłon wroga; 12 Ki; odn. 8 s.                                                       |
| B2  | Hartowana Skóra           | passive  | B1                 |         4 | +8% obrony.                                                                                                                            |
| B3  | Honor Wojownika           | passive  | B1                 |         4 | +10% maks. życia.                                                                                                                      |
| B4  | Płomienny Szał            | active   | B2                 |        B3 | 7                                                                                                                                      | 8 s: +30% Ataku, −20% obrony; 18 Ki; odn. 25 s.                                                 |
| B5  | Żelazna Wola              | passive  | B4                 |        10 | W Szale odporność na ogłuszenie.                                                                                                       |
| B6  | Krew Legendy              | passive  | B4                 |        10 | Po pokonaniu wroga leczy 3% maks. życia.                                                                                               |
| B7  | Wściekłość                | choice   | B5                 |        13 | Szał trwa o 4 s dłużej i daje dodatkowe +10% Ataku. Wyklucza B8.                                                                       |
| B8  | Kontrolowany Żar          | choice   | B6                 |        13 | Szał nie obniża obrony. Wyklucza B7.                                                                                                   |
| B9  | Ostatni Płomień           | ultimate | B7                 |        B8 | 16                                                                                                                                     | 5 s: pierwszy śmiertelny cios zostawia 1 punkt życia i leczy 30% maks. życia; 35 Ki; odn. 90 s. |
| C1  | Wybuch Ki                 | active   | korzeń             |         2 | Eksplozja wokół postaci ×1,8, promień 150 j.; 15 Ki; odn. 8 s.                                                                         |
| C2  | Żar                       | passive  | C1                 |         4 | Żar rośnie o 50% szybciej i opada 2× wolniej.                                                                                          |
| C3  | Ognisty Oddech            | passive  | C1                 |         4 | Wybuch Ki podpala na 4 s (łącznie 40% Ataku).                                                                                          |
| C4  | Eksplozja Żaru            | active   | C2                 |        C3 | 7                                                                                                                                      | Zużywa cały Żar: obszarowo ×(1,0 + Żar/50), do ×3,0 przy 100; 20 Ki; odn. 12 s.                 |
| C5  | Szybkie Rozżarzenie       | passive  | C4                 |        10 | Walka zaczyna się z 20 Żaru.                                                                                                           |
| C6  | Nieugaszony               | passive  | C4                 |        10 | Przy 100 Żaru regeneracja Ki +50%.                                                                                                     |
| C7  | Wulkan                    | choice   | C5                 |        13 | Eksplozja Żaru: promień +50%. Wyklucza C8.                                                                                             |
| C8  | Detonator                 | choice   | C6                 |        13 | Eksplozja Żaru: +25% obrażeń, promień −20%. Wyklucza C7.                                                                               |
| C9  | Ognisty Kataklizm         | ultimate | C7                 |        C8 | 16                                                                                                                                     | Kolumna ognia w dużym obszarze ×4,5 i podpalenie na 5 s; 35 Ki; odn. 30 s.                      |
| T   | Forma Płomiennego Legendy | ki-mode  | A9, B9 lub C9      |        20 | 20 s: +30% Ataku, Żar utrzymuje się na 100; aura jako osobny efekt; 50 Ki; odn. 120 s.                                                 |

**Uwaga:** tabela opisuje projekt; efekty, czasy odnowienia i koszt Ki nie są jeszcze przypięte do silnika gry.

## Pliki danych do implementacji

[Wersja ustrukturyzowana JSON](./data/character-progression-1-20.json) zawiera wszystkie 116 węzłów wraz z wymogami, efektami i wartościami ras. **Nie jest podłączona do runtime**, dopóki oddzielne zadanie implementacyjne nie przejdzie testów regresyjnych.
