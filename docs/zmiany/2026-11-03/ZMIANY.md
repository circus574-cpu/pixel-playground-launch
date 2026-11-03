# Zmiany — 2026-11-03

## Postacie edytowane w panelu admina znowu wchodzą do gry

### 1. Przyczyna odrzucania postaci

Logi serwera po wdrożeniu diagnostyki (PR #82) pokazały przyczynę komunikatu „Nie można uruchomić
silnika gry (COMMAND_REJECTED)”: `Checkpoint/player mismatch`. Serwer przy wejściu porównuje gracza
zapisanego w stanie postaci z jego kopią w punkcie zapisu symulacji (`runtime.superior.player`) i
odrzuca postać, gdy się różnią. Edycje i szybkie akcje z panelu `/admin` (lecz, teleport, złoto,
poziom, ekwipunek) zmieniały tylko pierwszą kopię, więc każda tak zmieniona postać przestawała się
otwierać. Postacie bez edycji z panelu działały.

### 2. Poprawka

- `updateServerCharacter` zapisuje teraz zmienionego gracza także w punkcie zapisu symulacji.
- Postacie już rozjechane (z poprzednich edycji) naprawiają się przy wejściu: serwer przyjmuje gracza
  z bazy do punktu zapisu, zapisuje ostrzeżenie w logu i nadal wymaga pełnej walidacji punktu zapisu.
  Zapis, który jej nie przejdzie, jest odrzucany jak dotąd.
- Test `server-superior-simulation` odtwarza rozjazd i sprawdza, że postać się otwiera.

## Chodzenie przestało się przycinać na serwerze

### 3. Zapis postaci przy każdym ticku

Na nagraniu z telefonu i w panelu `/admin` (pętla ticka: p95 109 ms przy budżecie 50 ms przy jednym
graczu) widać, że serwer nie wyrabiał 20 Hz. Przyczyna: każdy tick (co 50 ms) kończył się pełną
transakcją PostgreSQL (`SELECT … FOR UPDATE`, dwie walidacje całego stanu, `UPDATE` z całym JSON-em), a
ramka trafiała do gracza dopiero po jej zatwierdzeniu. Ruch przychodził więc co ok. 110 ms.

- Tiki są zapisywane co 2 s (`OnlineSession.checkpointEveryMs`), ramki idą od razu.
- Komendy gracza nadal zapisują natychmiast, a zamknięcie sesji zapisuje postęp od ostatniego zapisu
  przed zwolnieniem dzierżawy. Nieudany zapis nadal zatrzymuje sesję (wykrywany najpóźniej po 2 s).
- Przy awarii serwera można stracić najwyżej ostatnie 2 s ruchu i walki.
- Test sprawdza: jeden zapis na 11 ticków i dopisek przy zamknięciu.

## Panel admina czyta prawdziwą bazę

### 4. Baza danych w `/admin`

Kafel „Baza danych" i zakładka „Baza danych" czytały starą chmurę Supabase, której gra już nie używa
(pokazywały „OFFLINE/LOKALNY" i błąd „Przekroczono limit czasu odpowiedzi chmury"), a obok stały opisy
optymalizacji tabel, które nie istnieją w schemacie.

- Nowa funkcja serwerowa `getDatabaseStatusFn` (tylko dla administratora) odpytuje PostgreSQL na VPS:
  czas odpowiedzi, liczba kont (`accounts.users`), ról, postaci (`game.characters`), wpisów audytu
  (`accounts.audit`) i połączeń z limitem bazy. Adres bazy bez danych logowania.
- Kafel, zakładka i dziennik sondy pokazują te liczby; brak odpowiedzi serwera jest raportowany jako
  błąd, a nie dane z martwej chmury.
- Usunięto panel „Status optymalizacji bazy" (opisywał tabele, których nie ma).

## Potwory anime: 30 z 40

### 5. Kolejne pięć potworów

Z plansz właściciela: duch bibliotekarza, marionetka rytuału, oko wiedzy, pergaminowy strażnik (Aetheria)
i latarnia plazmowa (Nexus). Pakiety `enemy-v3-*`, domyślnie włączone (`?ki-monsters-anime=0` przywraca
stare). Zostaje 10 potworów, w tym pięć z już wysłanymi promptami.

Skrypt `ingest_creature_sheet.py` poprawiony po tych planszach:

- Efekt ataku przecięty linią siatki (wiązka, ostrza, rzucony talizman) wracał do sąsiedniej klatki jako
  osierocony ułamek, a własna klatka miała płasko ucięty efekt. Teraz mniejszy kawałek ciągły z większym
  trafia do klatki większego, a drobne resztki przy linii siatki są odrzucane.
- Białe rdzenie blasku (środek wiązki, rdzeń plazmy) były brane za tło i miały dziury. Wnętrze jest tłem
  tylko wtedy, gdy jest obrysowane czernią.
- Znane ograniczenie: biały rdzeń wiązki połączony z białym tłem przez zanikający koniec nadal może mieć
  drobne prześwity w jednej klatce ataku (oko wiedzy).

## Poprawka: postać skakała zamiast chodzić

### 6. Ramki z serwera między zapisami

Po przejściu na zapis postaci co 2 s (sekcja 3) klient odrzucał prawie wszystkie ramki: uznawał za
nieaktualną każdą ramkę, której `revision` nie jest większy od poprzedniej, a `revision` rośnie dopiero
przy zapisie do bazy. Do gracza docierała jedna ramka na 2 s, więc postać teleportowała się.

- Ramka ma teraz własny numer `seq` rosnący z każdą ramką; klient porównuje `revision`, a w jego obrębie
  `seq` (`isStaleFrame` w `src/game/online/client.ts`).
- Testy: 10 kolejnych ticków w jednej wersji zapisu daje 10 przyjętych ramek oraz tabela przypadków
  nieaktualnej, powtórzonej i nowszej ramki.

## Potwory anime: 35 z 40

### 7. Kolejne pięć potworów

Kolejne pięć z plansz właściciela: strażnik rdzenia, wieżyczka autonomiczna (Nexus), płomień-duch,
węgielek (Pyra) i korzeniowy pełzacz (Verdantia). Skrypt wycinania dostał jeszcze regułę dla małych
białych szczelin przy obrysie postaci (między korzeniami, kończynami), obramowanych ciemnym materiałem;
błyski w oczach i kwiaty zostają. Pięć wcześniejszych pakietów przeliczono ponownie (zmiana poniżej 1%
pikseli). Zostaje 5 potworów: świetlik pieczęci, pająk spawalniczy, rój nanitów, popielny wilk i liściak
skrytobójca.


## Próba malowanej Verdantii — gałąź podglądowa

Gałąź: `preview/verdantia-painted-terrain`, baza `e02c87b5ea9ad654f17d450464d13c36083f058b`.
To osobna próba wyglądu na aktualnym main, nie część PR #90 rozwoju postaci.
Właściciel zlecił użycie dwóch tekstur i pokazanie rzeczywistego screenshotu gry,
a następnie zapisanie tej próby na gałęzi GitHub. Bez scalenia i publikacji.

### Gdzie jest kod i jak otworzyć

- `src/game/world/generated/paintedMeadow.ts`: maska dróg, światło, dekoracje i prezentacja sklepu.
- `renderSuperior.ts`: ten sam renderer świata, tryb o wyższej rozdzielczości po włączeniu pakietu.
- `src/game/assets/catalog.ts`, `imported.json`: opt-in i zainstalowane wiązania.
- [Źródła, grafiki i manifest](../../../art/production/verdant-painted-preview/).
- [Pokazany właścicielowi zrzut](qa/verdant-painted/painted-full-scene.png).
- [Ten sam obszar bez flagi](qa/verdant-painted/default-full-scene.png),
  [dotyk 852×393](qa/verdant-painted/painted-touch-landscape.png).

Na buildzie tej gałęzi uruchom `npm run playtest`, a następnie otwórz
`/scripts/playtest.html?ki-world-v2=1&ki-verdant-painted=1`.
W zwykłej aplikacji tej gałęzi wystarcza parametr `?ki-verdant-painted=1`.
Wybierz Planetarnych. Zrzut wykonano przy sklepie w Zielonej Przystani;
flaga sama nie teleportuje gracza i nie zmienia zapisu. Adres produkcji nie ma tego
kodu, dopóki osobno nie zatwierdzono i nie wykonano wdrożenia.

### Wykonana prezentacja

Dwie tekstury właściciela połączono z oryginalnymi flagami terenu i drogami.
Maska łączy przecięcia, ma nieregularny miękki brzeg i zapas poza chunkiem, aby
nie tworzyć sztucznej szczeliny na granicy. Współrzędne wzoru i światła są globalne.
Wyższa rozdzielczość chunku 1024² zachowuje detale; normalny wariant pozostaje 512².
Korekta nasycenia/jasności ogranicza jaskrawość trawy. Koło sklepu ten sam wzór
łąki przykrywa lokalne prostokątne różnice biomów; nie zmienia flag wody/lądu.

Sklep jest osobnym wygenerowanym sprite'em RGBA; nie ma na nim UI ani bohaterów.
Jego stopnie są osadzone przy dotychczasowych drzwiach. Dodatkowe krzewy, kwiaty,
paprocie i drzewa używają istniejącego streamingu/sortowania/fadingu, bez colliderów.
Wzorcowe zdjęcie nie jest tłem gry. Nie dotykano RunPod, joysticka, HUD-u,
reguł walki, geometrii ani bazy/postaci. To próbka oprawy, nie ukończenie wszystkich miast/biomów.

### Faktyczne kontrole i ograniczenia

- Import paczki 1.2.0 przeszedł istniejący walidator/importer: [log](qa/verdant-painted/import.log).
- Canvas: wariant zwykły i podglądowy przeszły dojście, zoom, sklep i powrót;
  podgląd dodatkowo zmianę viewportu i ruch dotykowy w poziomie. Brak pageerror i brakujących zasobów.
- Pełna seria e2e: **3 PASS / 1 FAIL**. Zwykły wariant Software WebGL przeszedł;
  podglądowy zatrzymał się na 15-sekundowym timeout odczytu metrics przez locator.
  Nie uznano tego za dowód błędu mechaniki, ale odbiór Software WebGL podglądu pozostaje otwarty.
- Ponowienie WebGL podglądu **PRZERWANO** na żądanie właściciela „POKAŻ MI ZDJĘCIE BEZ TESTÓW”.
  Nie oznaczono go PASS. [Pełny log](qa/verdant-painted/browser-final.log),
  [przerwane ponowienie](qa/verdant-painted/webgl-interrupted.log).
- Pierwsze dwie próby automatu używały błędnego selektora `Wejdź · Sklep`, podczas gdy
  rzeczywista nazwa to `Dom Handlowy Mio`; po poprawieniu selektora Canvas przeszedł.
  Zachowano [pierwszy log](qa/verdant-painted/initial-selectors.log).
- Przy zapisie gałęzi uruchomiono tylko statyczny pełny TypeScript (aplikacja/e2e/tools)
  i kontrolę dokumentacji. Bez ponawiania testów, bez nowego buildu, bez ręcznego wyzwalania CI.
- Fizyczny Android/iOS, sprzętowe WebGL i benchmark FPS: **NIEWYKONANE**.
  Większe tekstury zwiększają pamięć; flagi nie włączono domyślnie.

[Sumy źródeł i screenshotów](qa/verdant-painted/manifest.json).
Źródła tekstur i master budynku są zachowane w katalogu produkcyjnym, runtime w
`public/game/assets/gpu/verdant-painted-preview/1.2.0-a7df8b58b053/`.
Cudzy nieśledzony `docs/zmiany/2026-11-01/qa/online-cutover/` i pozostałe artefakty
innych gałęzi pozostały poza commitem. Nie utworzono nowego aktywnego dokumentu QA.

Przygotowanie commita: pełny statyczny TypeScript **PASS** (trzy konfiguracje),
[kontrola dokumentacji](qa/verdant-painted/documentation.log) **PASS**. Pierwsze
wywołanie wykazało brak historycznych archiwów wyłączonych przez sparse checkout;
odtworzono wyłącznie brakujące pliki z bieżącego HEAD, bez zmiany ich zawartości.
Nie ponawiano testów rozgrywki ani Software WebGL po żądaniu właściciela.


## Aetheria — oprawa z materiałów właściciela

Gałąź `preview/aetheria-painted-world` od aktualnego `main@327727e2`.
Zasoby odczytano z `Grafika/`: sześć budynków, cztery tekstury i plansza dekoracji.
Nie modyfikowano oryginałów. Przezroczystość i atlas przygotowano na CPU;
nie korzystano z RunPod, generacji nowych ilustracji ani usług zewnętrznych.

- Flaga `ki-aether-painted=1`; lokalnie `npm run playtest`, następnie
  `/scripts/playtest.html?ki-world-v2=1&ki-aether-painted=1`, wybór Mędrców.
- Podgląd używa tego samego renderera Superior co gra. Reużywa maski dróg,
  światła i streamingu z próby Verdantii. Dodano wiązania budynków Aetherii,
  prawdziwą alfę, latarnie, bramę, kwiaty, sakury, bonsai, bambus i dekoracyjne oczko wodne.
- Dekoracje są prezentacyjne i niesolidne, brama nie jest nowym teleportem.
  Nie zmieniano kolizji, geometrii, NPC, questów, kont ani zapisów.
- [Zrzut przed Salą Rady Źródeł](qa/aether-painted/front.png) oraz
  [szerszy podgląd](qa/aether-painted/overview.png) pochodzą z rzeczywistej gry lokalnej.
  Uruchomiono Mędrca od początku i przesunięto go zwykłymi kliknięciami;
  nie podstawiano tła sceny ani stanu gry. Podgląd: Canvas, 1280×900.
- Importer waliduje manifest, obrazy, alfę i klatki: [wynik](qa/aether-painted/import.log).
  Pełny statyczny TypeScript aplikacji/e2e/tools: PASS, [log](qa/aether-painted/typecheck.log).
- Testy jednostkowe, pełny Playwright, WebGL, fizyczny telefon i benchmark FPS:
  NIEWYKONANE dla tej partii. Priorytetem był zażądany lokalny podgląd.
- Pakiet wymaga optymalizacji rozmiaru i dalszego odbioru: starsze drzewa,
  kryształowe skały i landmarki pozostają ze wcześniejszego zestawu. Nie jest
  to ukończenie wymiany wszystkich grafik świata.
- Nie scalano do main i nie publikowano. To osobna gałąź do oceny właściciela.

Źródła i mapowanie: [manifest](../../../art/production/aether-painted-preview/manifest.json),
[pochodzenie](../../../art/production/aether-painted-preview/provenance.json).


### Aetheria — poprawka zaznaczonej fontanny i niebieskich płatów

Po uwadze właściciela sprawdzono dotychczasową fontannę `object.ki-source`,
podwójne stare ogrody i mieszanie biomów na lądzie w centrum.
Wyłącznie w podglądzie Aetherii fontanna ma teraz niski sprite oczka wodnego
z dostarczonego atlasu na warstwie poniżej aktorów. Zachowano jej współrzędne
oraz oryginalny collider. Stare ogrody zastąpiono kwiatami z nowej planszy,
a zdublowane wizualizacje w tych samych punktach pominięto w rendererze.
Ląd w granicach centrum ma wspólną teksturę trawy; woda poza flagą lądu pozostaje.
Nie zmieniano danych geometrii ani nawigacji.

[Poprawiony zrzut lokalnej gry](qa/aether-painted/corrected.png): postać doszła
zwykłym kliknięciem w tę samą okolicę, Canvas 1280×900, bez pageerror.
Pełny statyczny TypeScript: PASS, [log](qa/aether-painted/corrected-typecheck.log).
Nie uruchamiano pełnego Playwright ani odbioru fizycznego telefonu.
