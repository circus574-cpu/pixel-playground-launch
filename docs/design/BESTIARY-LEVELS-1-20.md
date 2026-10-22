# Ki Legends — bestiariusz (poz. 1–20)

**Status: KONCEPCJA 1.0 z 22.10.2026 — nieimplementowana jako przeciwnicy produkcyjni.**

**Źródło oryginalne:** [`Ki_Legends_Aneks_Bestiariusz_Poz_1-20.pdf`](./source-annexes/Ki_Legends_Aneks_Bestiariusz_Poz_1-20.pdf) · 2 strony · SHA-256 `8d5fdb75780d1adb834ac76c74bd6cfd0d9c1b1b4bbf9517617ff3404f708960`.

## Lista 20 przeciwników — wartości źródłowe (str. 1)

|  Nr | Nazwa                       | Typ    | Poziom | Życie | Atak | Obrona |
| --: | --------------------------- | ------ | -----: | ----: | ---: | -----: |
|   1 | Ki-Pijawka                  | Zwykły |      1 |    27 |    6 |      1 |
|   2 | Szary Dzik Szlaku           | Zwykły |      2 |    54 |    9 |      3 |
|   3 | Siewka Pustki               | Zwykły |      3 |    41 |   17 |      2 |
|   4 | Goblin Łowca Ki             | Zwykły |      4 |    75 |   16 |      5 |
|   5 | Stary Kieł                  | Boss   |      5 |   450 |   23 |     11 |
|   6 | Totemowy Golemik            | Zwykły |      6 |   180 |   15 |     14 |
|   7 | Ork Banita z Wyżyn          | Zwykły |      7 |   193 |   25 |     11 |
|   8 | Salamandra Żaru             | Zwykły |      8 |   179 |   33 |     10 |
|   9 | Zgaszony Adept              | Elita  |      9 |   350 |   41 |     19 |
|  10 | Pętla Strażnicza            | Boss   |     10 |  1080 |   45 |     27 |
|  11 | Szept Pustych Stron         | Zwykły |     11 |   217 |   44 |     11 |
|  12 | Kitsune Pustki              | Zwykły |     12 |   299 |   51 |     18 |
|  13 | Zgaszony Gladiator          | Elita  |     13 |   683 |   59 |     29 |
|  14 | Pajęczy Łowca Nici          | Zwykły |     14 |   421 |   56 |     22 |
|  15 | Strażnik Zakazanej Czytelni | Boss   |     15 |  1970 |   78 |     41 |
|  16 | Oni Popiołu                 | Zwykły |     16 |   708 |   68 |     32 |
|  17 | Mistrz Pustej Pięści        | Elita  |     17 |   855 |   95 |     38 |
|  18 | Konstrukt Przeciążony       | Zwykły |     18 |   789 |   63 |     51 |
|  19 | Wielka Małpa Pełni          | Elita  |     19 |  1614 |   97 |     39 |
|  20 | Kaldor, Zgaszony Czempion   | Boss   |     20 |  3120 |  121 |     60 |

## Skalowanie i balans (str. 2)

- Życie podstawowe: `20 + 12*L + 1,3*L²`.
- Atak podstawowy: `4 + 2,2*L + 0,06*L²`.
- Obrona podstawowa: `1 + 1,1*L + 0,04*L²`.
- Zwykły: ×1 dla życia/ataku/obrony; Elita: ×1,5 / ×1,2 / ×1,2; Boss: ×4 / ×1,4 / ×1,4.
- Dodatkowo każdy przeciwnik ma indywidualny mnożnik profilu w zakresie ×0,5–×1,6; aneks nie ujawnia dokładnego mnożnika każdej pozycji. **Nie odtwarzać lub wymyślać go z tabeli.**
- Zaokrąglenie: do najbliższej liczby całkowitej, połówki w górę.
- Bossowie przypisani do scenariuszy ras: Stary Kieł (Planetarni 5), Pętla Strażnicza (Androidy 10), Strażnik Zakazanej Czytelni (Mędrcy 15), Kaldor, Zgaszony Czempion (Legendy 20).
- Motyw Pustki i Zgaszonych jest powiązany z osią fabularną Rozłamu Źródła.

## Integracja z obecną grą

- Dane źródłowe do importu: [enemies-1-20.json](./data/enemies-1-20.json) — 20 rekordów.
- Tabela nie zastępuje jeszcze istniejących `FOREST.enemies` ani przeciwników regionów (`src/game/world/regions/`); nie wolno migracji wykonywać bez testów walki, łupów, zadań i zapisu.
- Wartości liczbowe z aneksu są koncepcyjne i mogą wymagać balansu razem z nowymi statystykami ras oraz modelem obrażeń.
