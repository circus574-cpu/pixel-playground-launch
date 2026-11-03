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


## Nexus — podgląd z materiałów Drive

Baza `origin/main@327727e2`, osobna gałąź `preview/nexus-painted-world`.
Przez połączenie Google Drive pobrano 10 plików z folderu właściciela; oryginały,
numery Drive, SHA-256, skrypt, manifest i runtime zapisano w repozytorium.
Pięć tekstur, cztery nowe budynki (hall, shop, depot, arena), jeden atlas dekoracji.
Gospoda i kuźnia pozostają dotychczasowe — brak ich nowych grafik w folderze.

Zmodyfikowano katalog, wiązania importera i renderer. `nexusPainted.ts`
przypisuje nowe grafiki istniejącym dekoracjom oraz dodaje niekolizyjne
fioletowe drzewa, grzyby i cyjanowe rośliny przy usługach. Woda, kolizje,
ścieżki nawigacyjne, NPC, save i sterowanie pozostają bez zmian.
Płyty przed centrum są prezentacją, nie nową geometrią. Nie użyto obrazu
referencyjnego jako tła całej mapy. Po sprawdzeniu klatek zawężono kadry
reaktora/terminala/roślin — wersja 1.0.1. Pierwszy zrzut nie powstał, bo lokalny
Vite nie działał (`ERR_CONNECTION_REFUSED`); uruchomiono go ponownie.

Podgląd: `npm run playtest -- --port 4174`,
`http://127.0.0.1:4174/scripts/playtest.html?ki-world-v2=1&ki-nexus-painted=1`,
Androidy → Rozpocznij przygodę. [Rzeczywisty lokalny zrzut](qa/nexus-painted/preview.png).
[Zasoby, pozycja gracza i błędy przeglądarki](qa/nexus-painted/capture.json).
`npm run assets:import -- art/production/nexus-painted-preview/manifest.json --install --replace`:
10 zasobów, sukces. `NODE_OPTIONS=--max-old-space-size=3072 npm run typecheck`:
[log pełnego TypeScript](qa/nexus-painted/typecheck.log).
`python3 scripts/docs/check_documentation.py`: kontrola dokumentacji.
Baza kontroli: `327727e2` plus opisany zakres gałęzi. Nie jest to odbiór produkcji.
Pełne testy jednostkowe, regresja Playwright/Software WebGL, build produkcyjny
oraz fizyczny telefon: NIEWYKONANE — zakres to zamówiony podgląd wizualny.
Do odbioru: wygląd, dwie brakujące grafiki usług, redukcja rozmiaru i regresja
przed publikacją. Nie scalano do main, nie publikowano i nie używano GPU.


## Nexus — korekta rozdzielenia nawierzchni

Właściciel odrzucił pierwszy podgląd jako zbyt jednolity wobec wzoru. Diagnoza:
renderer nakładał `ground[2]` na całe centrum. Pięć zaimportowanych tekstur nie
stanowiło dowodu ich czytelnego wykorzystania. Usunięto tę dominację skały.
Aktualizacja tej samej gałęzi `preview/nexus-painted-world` od `c23f648c`.

Pakiet 1.1.0 dodaje pojedynczy jasny kafel bruku z OpenAI image_gen (oryginał,
pełny prompt i SHA w katalogu produkcyjnym). RunPod nie był używany.
Ogrody mają roślinny grunt oraz ściółkę właściciela, ścieżki panele i krawędzie
cyjan/złoto wypiekane w chunkach, plac jasne technologiczne płyty. Skalna tekstura
pozostaje poza centrum. Nowe pasy między istniejącymi drzwiami usług są
prezentacją; kanoniczna geometria, nawigacja, collidery i HUD nie zostały zmienione.
Nie twierdzimy, że jest to odwzorowanie referencji 1:1; budynki zachowują obecny
układ mapy i dwa starsze zasoby usług (gospoda, kuźnia).

[Lokalny zrzut po korekcie](qa/nexus-painted/corrected.png),
[rejestr przeglądarki](qa/nexus-painted/corrected-capture.json),
[pełny TypeScript](qa/nexus-painted/corrected-typecheck.log).
Komendy: `npm run assets:import -- art/production/nexus-painted-preview/manifest.json --install --replace`
(11 zasobów, sukces), `NODE_OPTIONS=--max-old-space-size=3072 npm run typecheck`,
`python3 scripts/docs/check_documentation.py`. Podgląd jak poprzednio przez
`ki-nexus-painted=1`, race Androidy, ruch normalnym kliknięciem.
Przeglądarka Canvas służy do realnego zrzutu, nie jest potwierdzeniem fizycznego
telefonu ani pełnej regresji. Testy jednostkowe/Software WebGL i build produkcyjny:
NIEWYKONANE w tej korekcie podglądu. Brak scalenia i publikacji.
