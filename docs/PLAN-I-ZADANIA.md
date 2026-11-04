# KI Legends — aktualny plan i zadania

## Bieżący checkpoint — 04.11.2026 (`main@1690fb6e`)

**Infrastruktura ukończona:** VPS Aruba/Coolify, prywatny PostgreSQL 17, działający kod serwera gry `Superior` i obowiązkowe serwerowe PvE/postacie (#69), konta i role na VPS (#76–77), publikowane rewizje świata w PostgreSQL (#79). Serwer gry nie jest 'dopiero planowany'; brak dowodu aktywnego tunelu VPN (PR #60: wewnętrzna sieć Docker). Kontenery/sekrety i stan live wydania trzeba odczytać osobno przed działaniami operacyjnymi.

**Zakres gry na `main`:** 4 rasy, Superior, Combat V3, katalog V2 366 przedmiotów i 140 receptur, pasywne bonusy ekwipunku, serwerowy zapis/wykonywanie PvE, panel admina z prawdziwą bazą; 04.11 przez #99 dodano domyślną malowaną oprawę miast i funkcjonalne NPC oraz poprawki dropu, spawnów i prędkości; #100 mobilny HUD/kontrast, #101 skala UI. Testy lokalne raportowane przez autorów PR (ostatnio 1132 w #101) nie są równoznaczne z naszym nowym uruchomieniem ani audytem wydania live.

**Poza `main` (NIE WDROŻONE):** #90 Draft rozwój ras (raportuje 24/48 prób, 72/144 stopni; bez pełnego odbioru); #87 Draft audyt błędów rozwoju; #80 4 grywalne labirynty; #102 test powtarzanych zdarzeń celów questów; #71 Draft kontrole operacyjne po cutoverze; #66 warsztat promptów. Oddzielnie niepotwierdzone: multiplayer MMO ze współdzieloną walką/PvP/party, fizyczny telefon, stres-test 50 graczy, backup poza VPS i aktualny tunel VPN.

### Zadania do wykonania, według aktualnego stanu

| Priorytet | Temat | Warunek odbioru |
| --- | --- | --- |
| P0 | Spójność serwera VPS | Odczyt aktualnego release/health, `GAME_ONLINE_REQUIRED`, sesji `/ws/online`, schematów `game`, `accounts`, `world_admin`; test logowania, restartu i odtworzenia trwałej postaci; żadne hasła w raporcie |
| P0 | Bezpieczeństwo i kopie | Sprawdzić `.env` śledzony przez Git bez wypisywania wartości, usunąć ewentualne sekrety z bieżącej wersji, obrócić wyciekłe klucze; niezależna kopia PostgreSQL poza VPS oraz test odtworzenia |
| P1 | Pełny rozwój ras | Audyt zakresu #90 względem #87; pełne 48 prób/144 stopnie i 4 kampanie wraz z testami gameplay, nie tylko testami danych |
| P1 | Labirynty i questy | Odbiór #80 i #102 po uwzględnieniu aktualnego `main`; osobno QA przejść i idempotencji nagród w online |
| P1 | Ekwipunek i balans | Weryfikacja bonusów HP/KI/ruchu/krytyka w serwerowej sesji i poprawności katalogu 366, receptur oraz dropów |
| P1 | Urządzenia mobilne | Fizyczny Android/iOS: sterowanie, kontrast, skala 72%, obciążenie FPS/pamięci, brak zasłaniania pola gry |
| P2 | Rozgrywka współdzielona | Projekt i test wspólnego świata, wspólnych potworów, PvP/party i obciążenia; nie nazywać obecnej gry pełnym MMO |

**Źródła:** [dziennik 04.11](zmiany/2026-11-04/ZMIANY.md), [dziennik 02.11](zmiany/2026-11-02/ZMIANY.md), [architektura](ARCHITEKTURA-I-TESTY.md). Starsze checkpointy poniżej są wyłącznie archiwalnym śladem decyzji, nie aktywną listą P0.

## Historyczny checkpoint CPU — 23.10.2026

Na `feature/cpu-game-content-20261023` zapisano kod, kopie danych oraz
[raporty](zmiany/2026-10-23/qa/cpu-game-content/). Zakończone obliczenia obejmują
konwersję i nawigację dziesięciu lądów, 22 272 wstępne walki, 456 pięter lochów,
6384 osobno wygenerowane spawny lochów oraz rutyny 948 mieszkańców i 12 karawan.
Dane źródłowe i moduły pomocnicze zachowano w tej gałęzi. Opcjonalny runtime
na `feature/superior-runtime-20261023` opisuje [świat](SWIAT-I-MIASTA.md).

Otwarte: osobne pełne raporty balansu 1–20 i 20–40, ukończenie botów wypraw,
budżety telefonu i zakończenie integracji mechanik. Pierwszy runtime Phaser ma
streaming, podróże, osobny zapis i spawny; pełne lochy/życie osad pozostają otwarte.
Narzędzia rozszerzonego balansu i botów zapisano jako prace w toku, wraz z wynikami
prób wstępnych; nie ogłaszać ich ukończenia. Pełna regresja wymaga powtórzenia po
naprawie dostępności serwera aplikacyjnego QA (zachowana próba: 85 PASS / 20 FAIL).
Otrzymano partię 1 Claude'a (`fd2597e`): 138 nowych części, katalog 194 obiektów
i 31 powierzchni. Otrzymano też partię 2 `8b0a814`: katalog ma obecnie 302 obiekty
i 31 powierzchni. Dostawa jest połączona z osobną gałęzią runtime; przygotowano osobny
generator przypisań prezentacji bez zmiany geometrii. Wstrzymanie do tej dostawy
zakończono; dalszy odbiór grafik, drzwi i podłączenie sceny pozostają otwarte.

Aktualizacja: 23.10.2026. Baza kodu `origin/main`: `d0bfc2c`.
To lista otwartych prac; zakończone kroki i dawne blokady są w dziennikach.
Nie wyciągać stanu produkcji ze starego PR ani statusu „niescalone” sprzed integracji.

## Co jest w kodzie

Cztery malowane rasy, drzewka 4×29, statystyki i zasoby rasowe; silnik 40 potworów.
Globus/atlas i cztery kontynenty, tekstury i część przyrody. Cztery miasta z sześcioma
usługami, wspólne wnętrza, handel/kowal, osobista skrzynia, manekin i odpoczynek.
Zapis klasyczny v9 i Superior v5 z wcześniejszymi migracjami oraz wspólnym rozwojem/treningiem. Verdantia jest etapem miejskim;
pozostałe miasta mają `city.bounds` i zachowaną walkę poza granicą.
Nie są ukończone wszystkie kontynenty, nowe spawny, grafiki mieszkańców ani pełna kampania.

Księga przygody: 89 stron, 98 zadań, 177 pozycji przedmiotów, 94 receptury i 8 bossów.
Jest projektem do przeglądu, nie wdrożoną zawartością i nie zatwierdzonym balansem.

## Kolejność i warunki odbioru

| ID       | Priorytet | Pozostała praca                                                                      | Warunek zamknięcia                                                                          |
| -------- | --------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| CITY-01  | P0        | Odbiór czterech miast: drzwi, wnętrza, handel, depozyt, trening, bezpieczna granica. | Przejście użytkowe, fizyczny telefon, regresja końcowego SHA; brak przeciwników w mieście.  |
| QA-01    | P0        | Pełna regresja bieżącego kodu i zachowania zapisów.                                  | TypeScript, Vitest, assets, lint, build i komplet Playwright Canvas/WebGL na wskazanym SHA. |
| REL-01   | P0        | Prawa do PDF/referencji, pochodnych, atlasu, pierwotnych grafik i checkpointów.          | Sprawdzalne dowody dla konkretnych plików; same deklaracje nie zamykają wpisu.              |
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

## Przekazanie Superior v2 — zatrzymanie na polecenie właściciela 24.10.2026

Prace zatrzymane; nie kontynuować bez nowego zlecenia. Gałąź `feature/superior-geometry-v2`,
baza `main` `96458e3`, zapisany prototyp geometrii `f9e765d`. Nie scalać ani publikować.
Gra nadal używa Superior v1. Nowa geometria i krajobraz NIE są wdrożone w Phaser.

### Co zostało zabezpieczone

- Prototyp i wyniki pomiarów: `public/game/worlds/superior-v2-prototype/`;
  obrys lądów 44,9982828678%, cztery kontynenty i sześć wysp.
- Generator krajobrazu: `scripts/worldgen/v2/landscape.py` — kod roboczy, bez odbioru.
- [Archiwum krajobrazu](../deliveries/superior-v2-checkpoint-20261024/landscape-work-in-progress.tar.gz)
  zawiera komplet lokalnych eksportów dziesięciu lądów i kontekst generatora.
  [Manifest checkpointu](../deliveries/superior-v2-checkpoint-20261024/checkpoint.json)
  zawiera SHA-256, rozmiar, raporty regionów i jawne braki.
- 6702 powierzchniowe sloty spawnów, 319531 obiektów; zachowano 6062 stare sloty,
  dodano 640 slotów i 48000 dekoracji. To dane eksportu, nie dowód grywalności.
- Inwentaryzacja 152 historycznych podziemi i projekt 18 nowych (w tym 4 labirynty)
  są w prototypie. Nowe wejścia w krajobrazie nie mają jeszcze grywalnych wnętrz.

### Odtworzenie bez zależności od poprzedniej maszyny

Pobrać tę gałąź, przeczytać AGENTS.md, INDEX.md oraz SWIAT-I-MIASTA.md.
Zweryfikować SHA-256 archiwum względem checkpoint.json, następnie rozpakować
`tar -xzf deliveries/superior-v2-checkpoint-20261024/landscape-work-in-progress.tar.gz -C /wybrany/katalog`.
Powstaną `superior-v2-runtime/` i `superior-v2-context.json`. Nie rozpakowywać na v1.
Generator wymaga Python, NumPy, SciPy i Pillow oraz plików prototypu z tej gałęzi.
Przykład regeneracji do NOWEGO pustego katalogu:
`python3 scripts/worldgen/v2/landscape.py --output /tmp/superior-v2-regenerated --context /wybrany/katalog/superior-v2-context.json`.
Nie nadpisywać archiwum ani istniejących regionów. Zabezpieczony eksport powstał
w dwóch wywołaniach (--features), dlatego nie ma zbiorczego index.json;
generator zapisuje go tylko przy wygenerowaniu wszystkich dziesięciu lądów naraz.

### Kolejność kontynuacji i znane blokady

1. Sprawdzić generator i eksport. Przygotować zbiorczy indeks runtime i manifest art;
   nie aktywować niekompletnych danych. Zweryfikować drogi, biomy, nowe spawny,
   punkty interakcji i osiągalność na docelowej siatce 16 jednostek.
2. Naprawić limit decodeRuns: obecne 16 mln komórek jest mniejsze niż nawigacja
   Verdantii (4844 × 3660). Zmierzyć pamięć telefonu, nie usuwać limitu bez zastępstwa.
3. Poprawić minimapy: paleta podglądu jest jeszcze wspólna dla ras, a SVG odwołuje
   się do zewnętrznego minimap.webp (może nie działać przy ładowaniu jako obraz).
   Sprawdzić istniejące wiązania roślin z prostokątnym tłem przed użyciem nowych dekoracji.
4. Synchronizować atlas i globus z geometrią: obsłużyć wiele pierścieni i szew
   długości geograficznej w atlasRegions, hitboxach i build_globe_textures.py.
   Sam podgląd audit.html nie jest dowodem działania gry.
5. Przygotować wersjonowany katalog runtime v2, wspólny indeks dla superiorRuntime
   i superiorCharacters. Zachować streaming; nie ładować wszystkich dekoracji.
6. Wdrożyć kontrolowaną migrację SuperiorSaveStore: kopia oryginalnych bajtów,
   ochrona konfliktu kart, translacje z raportów krajobrazu (wielokrotności 32),
   finalna kontrola kolizji/wody i punktów odrodzenia. Nie używać ułamkowych
   translacji wcześniejszego prototypu. Zachować namespace i postacie, ekwipunek,
   poziomy, zadania i identyfikatory spawnów. Nowsza decyzja właściciela o zachowaniu
   zapisów zastępuje historyczną zgodę na reset. Przejrzeć limity współrzędnych 65536.
7. Podziemia: wdrożyć maksymalnie 20 dużych lokacji, maksymalnie 5 labiryntów.
   Projekt ma 18. Instancje logiczne są rekomendacją; fizyczna ciągłość pod oceanem
   nie została zatwierdzona jako kanon. Stare dane pozostają archiwalne.
8. Pełne typecheck, Vitest, lint, build, dokumentacja, testy migracji, nawigacji,
   powierzchni sferycznej, Canvas i Software WebGL desktop/mobile, pomiary pamięci
   i zrzuty z uruchomionej gry. Nie osłabiać testów.

### Wyniki i ograniczenia dowodów

Przed krajobrazem: TypeScript PASS, Vitest 365/365, lint bez błędów (9 ostrzeżeń),
walidator geometrii PASS. Nie są to wyniki końcowej integracji v2. Generacja krajobrazu
ukończyła dziesięć regionów z wbudowanymi asercjami osiągalności, ale nie wykonano
odbioru przeglądarkowego ani pełnej regresji tego eksportu. Brak PR i Actions dla
tego checkpointu. Nie zmieniono produkcji, GPU, /test ani danych graczy.

Osobna wcześniejsza praca ARPG: gałąź `feature/action-combat-stage-a`, ostatni
commit `1b85569`; pozostał czerwony test manualnego ataku touch Software WebGL.
Nie włączać jej przypadkowo do geometrii.

## Nowe zlecenie rozwoju czterech ras — 28.10.2026, w realizacji

Stan na 29.10: gałąź `feature/racial-development-and-heritage` została scalona przez PR #62. Poniższe checkpointy 28.10 opisują historię prac i nadal nieukończony zakres; wcześniejsza baza to `3ffd46c7`.
Pełne wymagania: [niezmienione źródło właściciela](design/racial-development-owner-2026-10-28.txt).
Wspólny trening i izolowane egzaminy są podłączone do istniejącego silnika;
nie oznacza to ukończenia dostawy. Weryfikacja trwa.

Do pełnego odbioru nadal potrzebne są: 24 wieloetapowe rozdziały i ich wybory,
24 widoczne projekty z lokalnymi skutkami, 48 prób rasowych / 144 stopnie,
rzeczywiste odblokowania wariantów i modułów, cztery bronie osobiste z 6 etapami
oraz depozytem, biografie i kroniki, 32 warianty przeciwników 21–40 wraz
z wyprawami, walidator całego grafu i budżetu 17 800 oraz pełne pomiary balansu.
Przygotowany kod modyfikatora nie jest dowodem dostępności jego odblokowania.
Nie scalać ani nie publikować bez osobnej decyzji właściciela.

Checkpoint kontynuacji PR #55: istnieje katalog wszystkich rozdziałów/projektów,
realny obieg interakcji i transakcyjnych nagród, slot i depozyt osobistej broni,
lokalne nakładki projektów oraz kontroler powstrzymania ciosu. W przeglądarce
sprawdzono pierwsze rozdziały; wykryto i naprawiono walidację wnętrza Pyry.
**Nie oznacza to pełnego odbioru 24/24/48.** Najbliższe zależności: dokończyć
chronione obiekty/eskorty i pomiary w realnym runtime, następnie pełne odblokowania
144 stopni prób, późne wyprawy, biografie/kroniki i bilans. Nie dodawać przycisków
zaliczających te cele bez właściwych zdarzeń symulacji. Dokładny status kontroli
oraz problemy CI: bieżący dziennik. Scalanie i publikacja nadal są oddzielną decyzją.

Dalsza aktualizacja PR #55 (28.10): spokojne dostawy mają rzeczywisty ruch NPC i
trwałe punkty wznowienia; H-V02 z bronią stopnia 2 przeszedł integrację GameSession.
Weryfikacja tego rozdziału w przeglądarce pozostaje do wykonania. Eskorty bojowe,
obrona i fale nadal wymagają odbiorcy faktycznych obrażeń w obecnym silniku AI,
a nie zaliczania ich kontrolerem spokojnej dostawy. Pozostały zakres 48 prób,
późnych spotkań, biografii, kronik, tytułów i balansu nie jest ukończony.

### Historyczny stan zamknięcia sesji 28.10 — wówczas PR #55 Draft

Partia odbiorców obrażeń przygotowuje ochronę NPC/obiektów, lecz nie implementuje
kontrolerów fal ani bojowych eskort. Pozostają: 48 prób rasowych i trzy progi
każdej, 32 późne starcia, pełne funkcjonalne rozdziały/projekty i odbiór broni
stopni 3–6, odblokowania mistrzostw II, narracja/kroniki i pomiary legalnego balansu.
Nie należy traktować 24 definicji zadań i 24 projektów jako dowodu ich pełnej grywalności.
Nowy test rzeczywistej walki Canvas/Software WebGL ma niezakończoną diagnozę;
nie osłabiać asercji spadku HP ani zastępować zniknięcia potwora dowodem trafienia.

Stan historyczny 28.10: PR #55 miał konflikt z `main@0b5ae9486914962626d8b7bbe5ce09fccbeb35ab` (rozwiązany przy integracji 29.10).
Przed integracją porównać nowe transformacje, zapis, sterowanie i zmiany GM;
wyniki tej gałęzi nie dowodzą zgodności z nowym main. Nie scalono i nie opublikowano.
Szczegóły i dowody w [dzienniku](zmiany/2026-10-28/ZMIANY.md#zamknięcie-partii--odbiorcy-obrażeń-i-dowody-qa).

### Serwerowa rozgrywka PvE — kandydat PR #69, 01.11.2026

Gałąź `feature/server-owned-characters` rozszerza dwa wcześniejsze commity
`7a4d49a6`/`2cd9560d` o sesję/lease, kolejkę i trwałe ACK, ścisłe intencje, wymagany
online w wejściu gry, mirror Phaser, serwerowy rozwój/zadania/egzaminy i obecność
pobliskich graczy. Stare zapisy pozostają nienaruszone. To stan kandydata, nie
zakończone wdrożenie produkcyjne. Procedura, rozdzielenie instancji PvE oraz
ograniczenia są w [Architekturze](ARCHITEKTURA-I-TESTY.md#kandydat-serwerowej-rozgrywki-pve--trzecia-partia-0111-pr-69).

Warunki przed cutover: odbiór CI/QA, jawne schema003+004 i login runtime, prywatna
sieć app–DB, ustawienia procesu w Coolify, rzeczywiste logowanie i restart na VPS,
oddzielna zgoda na scalenie/zmianę produkcji. Nie usuwać kopii cloud/lokalnych i nie
przekierowywać edytora GM na nieautoryzowany zapis JSON. Wspólne potwory, PvP,
partie, administracja nowymi rekordami i pomiary większej liczby graczy pozostają
osobnymi zakresami; obecny serwer uruchamia instancjonowaną rozgrywkę PvE.
