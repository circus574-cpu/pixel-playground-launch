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

## Pyra — podgląd czterech tekstur i sześciu budynków

Gałąź `preview/pyra-painted-world`, od `origin/main@327727e2`.
Pakiet `pyra-painted-preview@1.0.1` zawiera cztery tekstury i sześć budynków
właściciela, zachowane źródła, skrypt odtwarzania oraz provenance SHA-256.
Sześć istniejących usług Twierdzy Popiołu używa nowych budynków. Grafiki nie
zmieniają nazw, mechanik, NPC, HUD-u, ruchu, zapisów, kolizji ani JSON świata.

Kod: `catalog.ts` (opcja `ki-pyra-painted=1`), `imported.json`,
`paintedMeadow.ts` (prezentacja budynków przy drzwiach), `renderSuperior.ts`
(pełna jakość malowanego terenu, neutralne światło dla Pyry, jednolita skała w
centrum na masce lądu i ozdobny podest przed salą wodza). Drogi mają ceglaną
teksturę i miękki brzeg. Na obrzeżach pozostaje ściółka oraz wcześniejsze obiekty;
nie twierdzimy, że wymieniono wszystkie dekoracje kontynentu.
Pierwszy podgląd miał zbyt wielkie liście i plamy biomów — poprawiono skalę
ściółki 768→256 j. i podłoże centrum. Wersja 1.0.0 była wyłącznie lokalną próbą.
Pierwszą próbę zrzutu przerwał reload Vite podczas formatowania; ponowiono po zakończeniu edycji.

Uruchomienie: `npm run playtest -- --port 4174`,
`http://127.0.0.1:4174/scripts/playtest.html?ki-world-v2=1&ki-pyra-painted=1`,
Legendy → Rozpocznij przygodę. [Lokalny zrzut prawdziwego Phasera](qa/pyra-painted/preview.png).
[Załadowane zasoby i błędy przeglądarki](qa/pyra-painted/capture.json).
Pełny TypeScript: `NODE_OPTIONS=--max-old-space-size=3072 npm run typecheck`,
[log](qa/pyra-painted/typecheck.log). Import 10 zasobów: zaliczony.
Kontrola dokumentacji: `python3 scripts/docs/check_documentation.py`.
Baza kontroli: `327727e2` + opisane zmiany gałęzi; nie jest to regresja końcowego SHA produkcji.
Pełna kampania jednostkowa/Playwright/Software WebGL, build i fizyczny telefon:
NIEWYKONANE — dostawa podglądu grafiki bez pełnej kampanii testowej, jak zlecono.
Przed wydaniem: odbiór wizualny, optymalizacja paczki i regresja urządzeń.
Brak scalenia do main i publikacji. Nie uruchamiano GPU.

## Sześć budynków Verdantii

Gałąź `preview/verdantia-leaf-buildings`, baza `origin/main@327727e2`.
Sześć grafik właściciela przypisano do istniejących usług: sklep (11749),
dom zgromadzeń (11752), gospoda (11750), kuźnia (11751), depozyt (11748),
arena/dom treningu (11753). Źródła bez zmian i sumy SHA-256 przechowuje pakiet
`art/production/verdant-leaf-buildings`; runtime `public/game/assets/gpu/verdant-leaf-buildings/1.0.0-247e42302abe/`.
Zmiany kodu: katalog paczek, wiązania importera, `meadowBuildings` (wyłącznie prezentacja).
Zachowano HUD, sterowanie, punkty wejść, geometrię, kolizje i zapisy.
Wszystkie sześć wiązań działa tylko w podglądzie `ki-verdant-painted=1`.

Lokalny podgląd: `npm run playtest -- --port 4174`, następnie
`http://127.0.0.1:4174/scripts/playtest.html?ki-world-v2=1&ki-verdant-painted=1`,
Planetarni → Rozpocznij przygodę. [Rzeczywisty zrzut Phaser Canvas](qa/verdant-buildings/preview.png).
Rejestr załadowanych plików, pozycji postaci i błędów przeglądarki:
[podgląd](qa/verdant-buildings/capture.json).

Wykonano import sześciu zasobów istniejącym walidatorem (sukces) i lokalny
podgląd z ruchem zwykłym kliknięciem. Pełny TypeScript `npm run typecheck`:
wynik w [logu](qa/verdant-buildings/typecheck.log).
Kontrola dokumentacji: `python3 scripts/docs/check_documentation.py`.
Testy jednostkowe, build produkcyjny, pełna regresja Playwright/Software WebGL
oraz fizyczny telefon: NIEWYKONANE — zakres tej dostawy to podgląd grafiki na życzenie
właściciela, bez pełnej kampanii testowej. Brak scalenia i publikacji produkcyjnej.
Do odbioru pozostaje wygląd, optymalizacja rozmiaru oraz powyższa regresja przed wydaniem.

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

## Jedna flaga dla malowanych miast

Dodano `?ki-painted=1`: włącza naraz paczki Verdantii (teren i budynki z liści), Aetherii, Nexus-9 i Pyry.
Flagi pojedynczych miast (`ki-verdant-painted`, `ki-aether-painted`, `ki-nexus-painted`, `ki-pyra-painted`)
nadal działają. Bez flagi gra wygląda jak dotychczas; paczki pozostają `previewOnly`.
Test: `src/test/painted-flag.test.ts`. Nie mierzono FPS ani pamięci na telefonie.

## Admin: zmiany w panelu nie psują postaci

- Przyczyna zablokowanej postaci: panel zapisywał dowolny zestaw umiejętności (przycisk „Odblokuj wszystkie”,
  29 węzłów przy poziomie 4), a wczytanie postaci odrzuca zestaw przekraczający punkty poziomu, poziom
  minimalny, poprzedniki i wykluczenia (`validLearned`). Błąd trafiał do gracza jako `COMMAND_REJECTED`.
- Serwer panelu odrzuca teraz niedozwolone umiejętności z jasnym komunikatem; ekwipunek przyjmuje tylko
  przedmioty pasujące do slotu (`src/game/items/slots.ts`).
- Przycisk „Odblokuj dozwolone umiejętności” daje największy dozwolony zestaw dla poziomu (`unlockAllowed`).
- Wczytanie postaci z niedozwolonymi umiejętnościami przycina je do dozwolonych (`repairLearned`) zamiast
  odrzucać postać; to naprawia już zablokowane postacie.
- Testy: `item-slots`, `skills-repair`, `skills-load-heal` (ten ostatni odtwarza błąd bez poprawki).
- Nie zmieniono: reguł drzewka, balansu, zapisów graczy bez błędu. Rangi węzłów (punkty bez limitu) to osobna zmiana.

## Poziom i punkty umiejętności bez limitu 20

Limit 20 był tylko punktem startowym pod późniejszy rozwój drzewek (decyzja właściciela 03.11.2026).
Punkty umiejętności = poziom (`skillPointsAt`), bez ograniczenia do 20. Poziom nie zatrzymuje się na 100;
`LEVEL_MAX = 10 000` to techniczny bezpiecznik danych (pole `xp` zostaje poniżej 1 000 000), nie limit gry.
Zdjęto limity 20 w panelu admina (poziom, „+1 poziom”), w migracji questów i w edytorze świata.
Statystyki rosną liniowo z poziomem (`baza + przyrost × (poziom − 1)`), więc wyższe poziomy liczą się poprawnie.
Bez zmian: wzrost szybkości ruchu nadal kończy się na poziomie 20 (decyzja właściciela 22.10.2026), a węzeł
Tryb KI nadal wymaga poziomu 20. Testy: `level-uncapped`, `skills-repair`. Rangi węzłów (efekt ×ranga) to osobna zmiana.

## Mapa 2D ostrzejsza, etykiety bez nakładania, panel ADM w kadrze

- **Mapa kontynentów (`map-hi.webp`):** dotąd 1 piksel na komórkę terenu 32×32 j., więc przy zoomie widać siatkę
  i schodki. Nowy tryb `MAP_UPSAMPLE=2` w `scripts/worldgen/v2/render_v2_maps.py`: gładkie granice lądu i
  biomów (interpolacja), drogi rysowane z polilinii `world.json` z wygładzonymi narożnikami (bez tajnych
  szlaków), budżet `MAP_MAX_MEGAPIXELS=12` (ok. 48 MB po zdekodowaniu, bo mapa jest dekodowana podczas gry).
  Odświeżono `worldOverlay.v2.json` (`build_v2_atlas_overlay.py`): drogi i miejsca bez zmian, nowe transformacje kafli.
  Polecenie: `MAP_WIDTH=8192 MAP_SUFFIX=-hi MAP_UPSAMPLE=2 MAP_LANDS=aether,nexus,pyra,verdant python3 scripts/worldgen/v2/render_v2_maps.py`.
- **Etykiety „Obóz · poz. X”:** `src/components/planet-map/labelLayout.ts`: priorytety (stolica > miasto > słynne >
  wioska > obóz) i pomijanie etykiet nachodzących na już ustawione. Test `map-labels`.
- **Przycisk „Teleportuj”** przeniesiony do lewego dolnego rogu mapy.
- **Panel ADM na komputerze** rozwijał się w lewo poza ekran (`right: 0` przy przycisku przypiętym do lewej krawędzi);
  teraz otwiera się w prawo i mieści w kadrze.
- **Filtr slotów** w panelu używa tej samej funkcji co gra (`getSlotForItem`), więc artefakty pasują do amuletu.
- **Zbadane i odrzucone:** mipmapy Phasera (`?ki-mipmap=1`) rozmywały drzewa i gubiły obrys, więc ich nie wprowadzono.
- **Ustalone, nie zmienione:** gra rysuje w rozdzielczości CSS i ignoruje `devicePixelRatio`; przy skalowaniu ekranu
  150% lub 200% przeglądarka rozciąga obraz (np. 1280×720 na 1920×1080). Poprawka zmienia rozmiar gry i współrzędne
  wskaźnika, a koszt GPU rośnie z kwadratem skali, więc wymaga pomiaru na telefonie.

## Rangi węzłów drzewka umiejętności (efekt wprost proporcjonalny)

- Punkt można wkładać w ten sam węzeł wielokrotnie; powtórzone id w `skills` oznacza rangę, a każda ranga
  kosztuje punkt (korzeń `R` zawsze jedna). Klasa `Kit` ma `rank(id)`; zapis, serwer panelu, naprawa przy
  wczytaniu (`repairLearned` zachowuje rangi) i `validLearned` rozumieją rangi.
- Wszystkie cztery rasy (`planetary`, `sage`, `android`, `legend`): liczbowe efekty węzłów pasywnych rosną
  z rangą, a obrażenia/leczenie/tarcze zdolności aktywnych z rangą zdolności. Koszty Ki, czasy odnowienia i
  mechaniki przełączające bez zmian; bezpieczniki zakresu opisano w `docs/ROZWOJ-I-WALKA.md`.
- Interfejs: lista i graficzne drzewko pokazują rangę i przycisk „Zwiększ rangę”; panel admina ma pole rangi.
- Przy randze 1 wszystkie dotychczasowe wartości są identyczne (istniejące testy walki bez zmian).
- Testy: `kit-ranks` (proporcjonalność efektów w czterech rasach, uczenie i reset rang, reguły korzenia),
  `skills-repair`, `monsters` (zapis z rangą 2).
- Nie zmierzono balansu walki przy wysokich rangach ani na telefonie; wartości rosną liniowo bez sufitu.

## Nazwy nad budynkiem i nad graczem

- Nazwa budynku jest wyśrodkowana nad dachem (pozycja z `staticItems` dopasowana po współrzędnych drzwi, z awaryjnym
  przesunięciem nad drzwi). Nazwa gracza wraz z poziomem jest nad postacią i skaluje się odwrotnie do zoomu kamery.
- Sprawdzone wizualnie w Aetherii i Pyrze; typecheck, lint, testy i kontrola dokumentacji przechodzą.
