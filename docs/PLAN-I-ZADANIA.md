# KI Legends — aktualny plan i zadania

## Checkpoint CPU — zapis wszystkich dotychczasowych prac

Na `feature/cpu-game-content-20261023` zapisano kod, kopie danych oraz
[raporty](zmiany/2026-10-23/qa/cpu-game-content/). Zakończone obliczenia obejmują
konwersję i nawigację dziesięciu lądów, 22 272 wstępne walki, 456 pięter lochów,
6384 osobno wygenerowane spawny lochów oraz rutyny 948 mieszkańców i 12 karawan.
To wygenerowane i sprawdzone dane oraz moduły pomocnicze, nie nowa grywalna scena.

Otwarte: osobne pełne raporty balansu 1–20 i 20–40, ukończenie botów wypraw,
budżety telefonu, podłączenie Phaser/streamingu/podróży/zapisów i grafiki od Claude'a.
Narzędzia rozszerzonego balansu i botów zapisano jako prace w toku, wraz z wynikami
prób wstępnych; nie ogłaszać ich ukończenia. Pełna regresja wymaga powtórzenia po
naprawie dostępności serwera aplikacyjnego QA (zachowana próba: 85 PASS / 20 FAIL).
Na polecenie właściciela prace nad grafiką są wstrzymane do dostawy Claude'a.

Aktualizacja: 23.10.2026. Baza kodu `origin/main`: `d0bfc2c`.
To lista otwartych prac; zakończone kroki i dawne blokady są w dziennikach.
Nie wyciągać stanu produkcji ze starego PR ani statusu „niescalone” sprzed integracji.

## Co jest w kodzie

Cztery malowane rasy, drzewka 4×29, statystyki i zasoby rasowe; silnik 40 potworów.
Globus/atlas i cztery kontynenty, tekstury i część przyrody. Cztery miasta z sześcioma
usługami, wspólne wnętrza, handel/kowal, osobista skrzynia, manekin i odpoczynek.
Zapis v5 z wcześniejszymi migracjami. Verdantia jest etapem miejskim;
pozostałe miasta mają `city.bounds` i zachowaną walkę poza granicą.
Nie są ukończone wszystkie kontynenty, nowe spawny, grafiki mieszkańców ani pełna kampania.

Księga przygody: 89 stron, 98 zadań, 177 pozycji przedmiotów, 94 receptury i 8 bossów.
Jest projektem do przeglądu, nie wdrożoną zawartością i nie zatwierdzonym balansem.

## Kolejność i warunki odbioru

| ID       | Priorytet | Pozostała praca                                                                      | Warunek zamknięcia                                                                          |
| -------- | --------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| CITY-01  | P0        | Odbiór czterech miast: drzwi, wnętrza, handel, depozyt, trening, bezpieczna granica. | Przejście użytkowe, fizyczny telefon, regresja końcowego SHA; brak przeciwników w mieście.  |
| QA-01    | P0        | Pełna regresja bieżącego kodu i zachowania zapisów.                                  | TypeScript, Vitest, assets, lint, build i komplet Playwright Canvas/WebGL na wskazanym SHA. |
| REL-01   | P0        | Prawa do PDF/referencji, pochodnych, atlasu, grafik Lovable i checkpointów.          | Sprawdzalne dowody dla konkretnych plików; same deklaracje nie zamykają wpisu.              |
| REL-02   | P0        | Skład wydania i notices zależności.                                                  | Ustalony artefakt, pełne notices i wymagania źródeł/łączenia; uzupełnione luki.             |
| GPU-01   | P1        | Próbki fasady/wnętrza/NPC/podłoża, następnie pełne grafiki czterech miast.           | Decyzje właściciela, importer, budżet i akceptacja w runtime.                               |
| HERO-01  | P1        | Spójność ośmiu widoków i poprawa chodu/ataku, kostur Mędrca.                         | Odbiór sylwetek, brak rozrywania/przycięć, test sprzętowy.                                  |
| WORLD-01 | P1        | Rozbudowa kontynentów, większy obszar lądu, docelowo cztery miasta na kontynent.     | Uzgodniona geometria, osiągalność i migracja współrzędnych, zgodność z atlasem/globusem.    |
| CITY-02  | P1        | Domy mieszkańców, bazary, dodatkowe ulice i NPC.                                     | Akceptacja układu, dostępność wejść i wydajność.                                            |
| PERF-01  | P1        | Budżet aktywnych potworów i efektów przed nowymi spawnami.                           | Limity/uspienie, test gęstej sceny, FPS/pamięć fizycznego Androida.                         |
| GAME-03  | P1        | Rozmieszczenie 40 potworów poza miastami po ukończeniu kontynentów.                  | Zgoda na etap, limity, bezpieczne granice i testy rozgrywki.                                |
| GAME-04  | P1        | Import `deliveries/enemy-*`, efekty zdolności, aury, ikony.                          | Akceptacja paczek, provenance i walidowany import.                                          |
| GAME-02  | P1        | Odbiór ośmiu projektów bossów z księgi.                                              | Decyzja o wyglądzie, roli, statystykach i pierwszej próbie solo.                            |
| STORY-01 | P1        | Przyjęcie fabuły i wdrożenie jednego prologu + Aktu I.                               | Nowy dziennik/flagowanie, jednorazowe nagrody, grywalny odcinek bez debugowania.            |
| ITEM-01  | P1        | Odbiór nowych slotów/przedmiotów i plan migracji.                                    | Brak duplikacji ulepszeń, porównania, receptury i transakcje.                               |
| OPS-01   | P2        | Porządek woluminu GPU i kopie odtwarzalne.                                           | Osobna zgoda właściciela na konkretne pozycje; readback/hash przed usunięciem.              |
| NET-01   | P2        | Multiplayer: serwer autorytatywny, stały krok, pobliskie obiekty i delty.            | Osobny projekt/zgoda i test obciążeniowy. Do tego czasu lokalne PvE.                        |

Zatwierdzone 23.10 nazwy krain i założenia balansu nie są już otwartymi zadaniami
GAME-01/GAME-06. Historyczny błąd PR #15 90/91 nie jest bieżącą blokadą bez
ponownego wyniku na aktualnym SHA; jego przyczyna i naprawa są w dzienniku 21.10.
Stan wdrożonej domeny wymaga osobnego odczytu narzędzia hostingu; nie badano go
przy porządkowaniu dokumentacji. Scalenia i publikacja według [zasad](ZASADY.md).


## Zlecenie CPU — pełna planeta, aktualizacja 23.10

Właściciel zlecił całą planetę według istniejącej geometrii oraz osobną generację
spawnów, także dróg, ścieżek, ukrytych lokacji i labiryntów. Zastępuje to poprzednie
odłożenie spawnów do kolejnego etapu. Narzędzia i pełny zestaw danych są gotowe
na osobnej gałęzi; [zakres i kontrole](ARCHITEKTURA-I-TESTY.md#pełna-planeta-i-osobna-generacja-spawnów).
WORLD-01/GAME-03 pozostają otwarte dla runtime: konieczne są importer/streaming,
format terenu dla TypeScript, wyspy/podróże, migracje, grafika i odbiór rozgrywki.
Nie mylić gotowej generacji danych z działającym w grze światem.
