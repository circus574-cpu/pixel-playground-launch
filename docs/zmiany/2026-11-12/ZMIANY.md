# KI Legends — zmiany 12.11.2026

## 1. Rozwój czterech ras — funkcje świata i późne wyprawy (PR #145)

Gałąź: `feature/development-remaining-trials-20261111`.
[PR do audytu](https://github.com/circus574-cpu/pixel-playground-launch/pull/145).
Badany kod mechaniki i macierzy: `02cf8bb9ceb0e478e6a189a032f305b5f1f6079c`.
Późniejsza korekta obejmuje wyłącznie CSS celu i mocniejszą asercję układu;
sumy źródeł końcowej prezentacji zawiera manifest QA. Baza mechaniki: `main@f0c5b4c8`; dodatkowo zachowano zmianę globusa
z `main@6105d450` (bez zmian plików mechaniki względem badanego kodu).
Nie scalono do main i nie opublikowano gry.

### Zakres wykonany

| Funkcja | Stan przed dostawą | Zmiana | Dowód działania |
| --- | --- | --- | --- |
| Próby czterech ras | Niepełny katalog | 48 prób, 144 stopnie, legalne odblokowania 12 wariantów i 6 modułów | Test każdego stopnia i transakcji właściciela; wcześniejsze materiały w dzienniku 11.11 |
| Dziedziny w świecie | Brak zastosowań poza salą | 48 fizycznych aktywności przy istniejących obiektach; checkpointy, kanały, pomiary, rozgałęzienia, eskorty i obrona | 48 pozytywnych przypadków jednostkowych; rzeczywiste punkty v2 na czterech kontynentach; przeglądarka |
| Księga Zrozumienia | Brak systemu fragmentów | 12 fragmentów z poznanych źródeł i zapisanych decyzji, bez ujawniania przyszłych rozdziałów | Test odblokowania, źródeł i odczytu |
| Przeciwnicy 21–40 | Brak aktywnych wariantów | 32 instancje wariantów 8 istniejących gatunków, oddzielna wiedza, oryginalne atlasy | Test wszystkich definicji/wzorów; zachowane kanoniczne definicje bestiariusza |
| Wyprawy | Brak układów | 48 wypraw: samotny ciężki, para, trzy fale obrony; własny ekwipunek i rzeczywista walka | 48 ukończeń w GameSession oraz wejścia do wszystkich formacji na rzeczywistej geometrii |
| Bezpieczeństwo wejścia | Odmowa startu w walce bez wyjaśnienia | Widoczny komunikat i wyłączony start, dopóki trwa starcie | Test prawdziwego trafienia i odblokowania po walce; Nexus Software WebGL |
| Zapis | Rozwój v3, klasyczny v10, Superior v6 | Rozwój v4, klasyczny v11, Superior v7; puste nowe pola, kopie przed migracją, CAS i odmowa przyszłych danych | Migracje, round-trip, awaria storage, drugi pisarz i reload w przeglądarce |
| Streaming i HUD | Tymczasowe atlasy mogły być niegotowe; brak celu nowych aktywności | Ograniczone dzierżawy atlasów, oczekiwanie na gotowe klatki; cel między obszarami sterowania i zakładki Świat/Wyprawy | Test cyklu życia zasobów, Canvas/WebGL, pomiar położenia i zrzuty 852×393 |

Kontakty wymagają faktycznie zdobytej rangi i wcześniejszego etapu. Przycisk
„Podejdź” używa zwykłej nawigacji/drzwi; nie teleportuje do zaliczenia.
Wynik aktywności pochodzi z kontrolera i rzeczywistych wejść, nie przycisku
administracyjnego. Rozwój postaci korzysta z dotychczasowych statystyk i jednego
silnika walki. Nie zmieniono kanonicznych węzłów, liczb bestiariusza, geometrii,
produkcji, GPU ani prywatnego `/test`.

Cel wyprawy nie daje dodatkowej praktyki ani powtarzalnej nagrody. Zwykły XP
za pokonanie jest zapisywany atomowo z poznaniem wariantu; przy błędzie zapisu
pozostaje kolejka ponowienia. Usunięcie wyprawy sprząta wyłącznie własnych
aktorów. Nawigacja bojowa i eskorty wykluczają bezpieczne miasta.

### Wyniki kontroli

- Pełny TypeScript aplikacji/e2e/tools: **PASS**; źródła TS mechaniki po korekcie układu bez zmian.
- Pełny Vitest: **1878 PASS / 0 FAIL / 10 SKIP**. Pominięte przypadki wymagają
  osobnego PostgreSQL (`KI_ACCOUNTS_TEST_DATABASE_URL`); nie zaliczono ich jako PASS.
- Lint: **0 błędów / 15 istniejących ostrzeżeń**. Zasoby i produkcyjny build: **PASS**.
- Dokumentacja: **10 podręczników, 21 dzienników**, linki i chronione źródła: **PASS**.
- Przeglądarka na bazowym kodzie `02cf8bb9`: **Canvas 4/4, Software WebGL 4/4**,
  cztery rasy, 852×393, rzeczywiste aktywności i wyprawy, zachowanie wyniku po reload,
  zero `pageerror`. Testy używają jawnie przygotowanych warunków późnej fazy gry.
- Przegląd zrzutów po tym przebiegu wykrył nakładanie paska przeciwników na cel.
  Finalny pasek celu przeniesiono na dół pomiędzy obszary sterowania. **Dodatkowa
  regresja końcowego CSS: Canvas 1/1, Software WebGL 1/1**, z mocniejszą asercją
  odstępu od menu i paska przeciwników; pełna aktywność, walka i reload nadal działają.
  Nie liczymy tej powtórki jako dwóch kolejnych unikalnych scenariuszy czterech ras.
- Oryginalny, nieosłabiony scenariusz **TP03 Legend w Software WebGL: 1/1 PASS**:
  prawdziwa próba, jednorazowa nagroda i reload. Dawny problem wejścia do menu
  w tym scenariuszu nie odtworzył się na nowszej bazie.

Aktualny układ: [Canvas](qa/development-world/planetary-canvas.png),
[Software WebGL](qa/development-world/planetary-webgl.png).
Oryginalne nagrania końcowej regresji: [Canvas WebM](qa/development-world/planetary-canvas.webm),
[WebGL WebM](qa/development-world/planetary-webgl.webm).
Pliki `baseline-*` przedstawiają wcześniejszy, uczciwie oznaczony przebieg 8/8
sprzed korekty CSS. Nie są zrzutami aktualnego położenia paska celu.

Bramka GitHub Actions jest uruchamiana po wypchnięciu gałęzi; stan i właściwy SHA
należy sprawdzić w [Checks PR #145](https://github.com/circus574-cpu/pixel-playground-launch/pull/145/checks).
Nie przypisujemy lokalnym testom wyniku z zewnętrznego CI.

Surowe wyniki i mapowania: [manifest QA](qa/development-world/acceptance.json),
[48 aktywności](qa/development-world/fieldwork.csv),
[48 wypraw](qa/development-world/expeditions.csv),
[144 stopnie prób](qa/development-world/trial-grades.csv).

### Balans — obliczenia, nie zmiana kanonu

Rzeczywisty GameSession/Kit/MonsterSystem, stały krok 50 ms, 1944 profile × 8
ziaren = 15 552 walki. Rasy × poziomy 1/10/20/30/40 × trening 0/40/90 stopni
× legalne gałęzie A/B/C × wyposażenie brak/start/katalog × bliscy poziomem
przeciwnicy, w tym wszystkie 32 późne warianty.
[Założenia i podsumowanie](qa/development-world/balance-summary.json),
[macierz](qa/development-world/balance.csv).

Punkty drzewka, trening i sprzęt są zadeklarowanymi warunkami izolowanego
porównania. Nie są dowodem ich zdobycia przez naturalnie rozwijaną postać.
Każda walka zaczyna z trzema miksturami; nie jest to model ich trwałego zaopatrzenia.
Podróż 15/30/60 s, interakcja 5 s oraz regeneracja 0,3% HP/s są osobną analizą
wrażliwości, a nie zmierzonym czasem czytania i kampanii.

| Poziomy postaci w próbce | Sprzęt | Profile | Średni udział wygranych | Mediana czasu zwycięskiej walki |
| --- | --- | ---: | ---: | ---: |
| 1 / 10 / 20 | brak | 288 | 81.6% | 4.90 s |
| 1 / 10 / 20 | startowy | 288 | 85.4% | 3.35 s |
| 1 / 10 / 20 | katalogowy | 288 | 100.0% | 1.00 s |
| 30 / 40 | brak | 360 | 98.6% | 1.60 s |
| 30 / 40 | startowy | 360 | 99.4% | 1.20 s |
| 30 / 40 | katalogowy | 360 | 100.0% | 0.35 s |

Przejście 1→20 wymaga 12 160 XP, a 20→40 — 36 200 XP według obecnej krzywej.
Grupy tabeli dzielą pięć poziomów próbnych po poziomie 20; nie są testem każdego
poziomu ani pomiarem godzin przejścia.

Dane wykrywają przewagę legalnie wielokrotnie rozwiniętych węzłów i silnego
sprzętu. Właściciel powinien rozstrzygnąć, czy zachować obecne limity rang/sprzętu,
czy zlecić odrębne strojenie nowych wypraw. Nie zmieniono samodzielnie produkcyjnych
liczb. Sam średni/medianowy wynik nie dowodzi równego poziomu trudności ras.

### Co pozostaje do odbioru

- Niezależna pełna regresja projektu i odbiór końcowego Actions na SHA gałęzi.
- Fizyczny Android/iPhone, sprzętowe WebGL i rzeczywisty jednoczesny multitouch.
- Przejście kampanii od poziomu 1 z naturalnie zdobytym ekwipunkiem i praktyką;
  pomiar ludzkiego czasu oraz docelowych zakresów 25–35 / 40–60 / 60–90 godzin.
- Decyzja właściciela o balansie mocnych konfiguracji i parametrach chronionego
  punktu nowej aktywności (prototyp: HP ciężkiego wariantu ×4, wymagane 50%).
- Osobna zgoda na scalenie i publikację po odbiorze.

Testy przeglądarkowe nowych treści używają jawnego fixture'a poziomu 40 i rang
jako warunków wejściowych. Nowe aktywności i wyprawy zaczynają puste; ich wyniki
muszą pochodzić z rzeczywistej gry i przetrwać reload. Nie przedstawiamy tego jako
pełnego przejścia kampanii ani jako testu fizycznego telefonu.

## 2. Nowe skalowanie premii drzewka — decyzja i pomiar

Osobna gałąź `feat/skill-rank-balance-20261112`, od `ad646c75` (PR #145).
Właściciel 12.11 zmienił regułę: połowa dotychczasowej premii za pierwszy punkt,
następne punkty po 10% wartości tej nowej bazy. [Zapis decyzji](../../design/data/rank-scaling-owner-2026-11-12.json).
Wymaganiem jest większa rola sprzętu; definicji, liczb i interfejsu ekwipunku nie zmieniano,
ponieważ pracuje nad nimi inny autor. Nie przyjęto docelowego czasu walki — właściciel chce
najpierw zobaczyć pomiar.

Wspólna reguła obsługuje cztery kity, bonusy statystyk, krytyka, regeneracji, kosztów,
tarcz, leczenia i zdolności. Dla obrażeń zachowano odniesienie do zwykłego ataku:
×1,8 staje się ×1,4, a serie dzielą nową sumę pomiędzy te same trafienia. Jest to
jawna interpretacja premii ponad podstawowy atak, przyjęta po odpowiedzi o roli sprzętu;
właściciel nie wybrał literalnie jednego z dwóch zaproponowanych mnożników.
Nie przepisano historycznego aneksu/generowanych danych. Nie ma resetu ani migracji
punktów; zapis nadal przechowuje te same całkowite rangi i ten sam ekwipunek.

Egzamin obrony zachowuje wcześniejszy stosunek siły ogłoszonego ciosu do tarczy
pierwszej rangi. Nie zmieniono jego okien, liczby sukcesów ani zasad przyznawania wyniku.
Testowy pilot walki wykonuje podstawowy atak i zwykły dash przez normalne polecenia;
nie zmienia HP, cooldownów, wyników ani przeciwników. Test wypraw wybiera słabszego
wroga jako pierwszy cel i utrzymuje dystans dla ras dystansowych. Wszystkie asercje
ukończenia, liczby pokonań, nagród i zapisu pozostają.

Pomiar używa prawdziwych `GameSession`, kitów, AI, kolizji i efektów, ze stałym krokiem
50 ms. Zestawy, punkty i początkowe ziarna są jednakowe między porównywanymi regułami.
Postacie 30–40 nie są porównywane ze starymi przeciwnikami poziomu 18; używa się
najbliższych poziomem późnych wariantów. Oddzielono scenę otwartą i próbę grupową
z przeszkodą. Rozkłady czasów, porażki, KI, mikstury i zaokrąglenia punktów są liczone
osobno; wynik automatu nie jest deklaracją czasu ludzkiej kampanii ani testem telefonu.

### Wyniki końcowego pomiaru i kontroli

[PR #151](https://github.com/circus574-cpu/pixel-playground-launch/pull/151), Draft,
zależny od #145 (baza `feature/development-remaining-trials-20261111`).
Kod gry: `7732199f3aa602fb8625d0ba1396b1c9ff577413`.
Końcowy pomiar: czyste drzewo `2378c3948c34a8d3ac7a8ade770cd4f58e0a7756`;
drugi commit zmienia wyłącznie pilota pomiarowego, bez zmiany gry.
Pierwotną próbę grupową unieważniono: pilot ponawiał A* co 50 ms i resetował pierwszy
punkt trasy. Cały końcowy pomiar wykonano ponownie, ze zlecaniem pościgu co 300 ms.

**21 888 walk**, 2304 profile: 17 280 pojedynczych starć (poziomy 10/20/28/34/40,
6 porównywanych reguł, 8 ziaren) oraz 4608 prób grupowych z przeszkodą
(poziomy 20/40, 3 reguły, 32 ziarna). Wszystkie cztery rasy i gałęzie A/B/C.
Dodatkowo 216 par prób potwierdziło identyczne wyniki adaptera starej reguły
oraz niezależnego oryginalnego silnika `ad646c75`: wynik, czas, HP, KI, mikstury i casty.

Tabela pokazuje liczbę wygranych, ich udział i medianę czasu **wygranych prób**.
Nie wolno interpretować krótszego czasu jako poprawy, pomijając porażki.
Zestawy nie są optymalne ani naturalnie zdobyte; każdy izolowany pojedynek zaczyna
z trzema miksturami. Trening, specjalizacje i moduły są wyłączone; nie używa się T.
Grupa zmienia jednocześnie liczbę przeciwników i geometrię, więc nie izoluje samej przeszkody.

| Próba | Sprzęt | Stara reguła: wygrane, mediana | Nowa reguła: wygrane, mediana |
| --- | --- | --- | --- |
| Pojedynczy | Brak | 900/960 (93.75%), 2.70 s | 840/960 (87.50%), 7.50 s |
| Pojedynczy | Referencyjny | 928/960 (96.67%), 2.00 s | 912/960 (95.00%), 6.30 s |
| Pojedynczy | Katalogowy | 924/960 (96.25%), 2.00 s | 912/960 (95.00%), 6.00 s |
| Grupa + przeszkoda | Referencyjny | 721/768 (93.88%), 6.95 s | 544/768 (70.83%), 13.25 s |
| Grupa + przeszkoda | Katalogowy | 736/768 (95.83%), 6.45 s | 610/768 (79.43%), 12.72 s |

Rola sprzętu w przeżyciu jest widoczna, ale nie przyjęto docelowego czasu ani nie
uznano bilansu całej gry za zaakceptowany. Po zmianach katalogu przez drugiego autora
należy ponowić pomiar; przedmioty i zasady ich przyznawania nie były tu modyfikowane.

| Funkcja | Stan przed | Zmiana | Dowód |
| --- | --- | --- | --- |
| Premie czterech ras | Dotychczasowa premia × ranga | Połowa pierwszej, dalej +10% nowej bazy | Audyt węzłów i testy reguły w pełnym Vitest |
| Obrażenia aktywne | Cały mnożnik × ranga | Premia ponad zwykły atak; serie zachowują liczbę trafień | Audyt faktycznych trafień wszystkich kitów |
| Opisy i rangi | Opis pierwszej wartości i mnożnik rangi | Faktyczny procent i przyrost wybranego węzła | 8/8 testów nowej reguły Canvas/Software WebGL |
| Zapisy | Całkowite rangi i ten sam sprzęt | Bez resetu, refundu i zmiany formatu | Round-trip czterech ras i reload po 8 zakupach |
| Próby obrony | Cios 10% HP przy dawnych tarczach | Cios 5% HP zachowuje dawny stosunek do nowej tarczy | Pełne testy prób, te same kryteria sukcesu |

Przykład poziomu 10, osiem punktów w jednej pasywce, bez sprzętu/treningu:
Planetarni C2: +8,5%, HP 487; Mędrcy C2: +12,75%, KI 161;
Androidy B2: +6,8%, DEF 36; Legendy B3: +8,5%, HP 562.
Wartości podstawowe bez tej pasywki to odpowiednio 449/143/34/518.
Zaokrąglenia mogą dawać zerowy przyrost widocznego DEF po pojedynczym punkcie;
premia procentowa nadal narasta. [Krzywe poziomów 1–40](qa/skill-ranks/stat-curves.svg).

**Kontrole:** pełny TypeScript aplikacji/e2e/tools, lint 0 błędów / 15 istniejących
ostrzeżeń, assets, dokumentacja i produkcyjny build — PASS; Vitest **1916 PASS,
0 FAIL, 10 pominiętych testów PostgreSQL**.
[Zielone Actions kodu gry](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/43178802277).
Po korekcie wyłącznie narzędzia powtórzono pełny TypeScript, lint i 38 testów reguły/modeli — PASS.

Playwright na kodzie gry: **14 PASS / 2 FAIL**. Nowa reguła, zakupy ośmiu rang,
zgodność statystyk HUD i reload: **8/8**, cztery rasy × Canvas/Software WebGL,
dotykowy viewport 852×393. Dodatkowe umiejętności w starym świecie: 6/8.
Obie porażki dotyczą Planetarnych: po odczycie fixture'a w Superior v1 pojawia się
„Nie udało się wczytać fragmentu świata”. Ten sam scenariusz Canvas odtworzono
na oryginalnej wersji `ad646c75` — identyczny błąd ładowania, przed zmianą balansu.
Nie oznaczamy całego Playwright jako zielonego. Dokładna przyczyna w streamerze
pozostaje do ustalenia przez autora świata; jego plików nie edytowano.
Fizyczny telefon, sprzętowe WebGL i ludzka kampania pozostają niezweryfikowane.

Dowody: [manifest pomiaru](qa/skill-ranks/measurement.json),
[surowe walki](qa/skill-ranks/raw-trials.json.gz),
[tabela wyników](qa/skill-ranks/summary.csv), [pełne profile](qa/skill-ranks/profiles.csv),
[porównanie sparowanych ziaren](qa/skill-ranks/paired.csv),
[wykres walk](qa/skill-ranks/combat-comparison.svg),
[weryfikacja oryginalnego silnika](qa/skill-ranks/legacy-verification.json),
[Vitest](qa/skill-ranks/unit-tests.json.gz),
[Playwright](qa/skill-ranks/browser-regression.json.gz),
[odtworzenie starej usterki](qa/skill-ranks/browser-original-baseline.txt),
[zrzut Planetarnego](qa/skill-ranks/canvas-planetary-rank-eight.png),
[nagranie Canvas](qa/skill-ranks/planetary-gameplay.webm),
[nagranie Software WebGL](qa/skill-ranks/planetary-software-webgl.webm).
Zrzuty i nagrania pochodzą z rzeczywistej aplikacji, wykresy z zapisanych prób silnika.

Nie scalano do main i nie publikowano gry. Błąd starej sceny pozostaje otwarty;
nie zmieniano świata, assetów, sprzętu, zadań ani infrastruktury GPU.
