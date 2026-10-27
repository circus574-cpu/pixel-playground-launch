# 27.10.2026 — Combat System V3

## Zakres i baza

Gałąź `feature/combat-diablo-v3`, utworzona od pobranego `main`
`f2575faa62137fbcb4b842b9d3d56ba53b7be35d`. Weryfikacja gałęzi zdalnych nie wykazała
wcześniejszej gałęzi o tej nazwie. Inne worktree i otwarte PR pozostawiono nietknięte.
Nie scalano ani nie publikowano. Nie łączono się z GPU.

Mapa zależności i aktualny kontrakt: [rozwój i walka](../../ROZWOJ-I-WALKA.md#combat-v3--mapa-zależności-i-granice-zmian).
Kod: istniejący `session.ts`, `kit/base.ts`, trzy zestawy zdolności, `monsters/system.ts`,
`monsters/types.ts`, prezentacja w `mountGame.ts` i `actorAnimation.ts`; trzy pomocnicze
moduły w `combat/`. Testy `combat-v3.test.ts`, aktualizacja dwóch dotychczasowych testów
oraz nowe scenariusze Playwright. Nie zmieniono kanonicznych generated, statystyk,
geometrii, generatorów świata, plików graficznych, zapisu, questów, HUD ani prywatnego `/test`.

## Potwierdzone przyczyny i poprawki

1. `Kit.pickFoe` dopuszczał cel o 400 jednostek dalej i fallback o 120 dalej od zasięgu.
   Zastąpiono go wyborem w rzeczywistym zasięgu/LOS ze stabilną asystą kierunkową.
2. Nieudany R potrafił uruchomić automatyczne podejście. Usunięto ten efekt uboczny;
   jawny wybór przeciwnika zachowuje wcześniejsze zachowanie.
3. Pociski rozliczały obrażenia przed prezentowanym lotem. Dodano test segmentu,
   przeszkód, czasu życia oraz anulowanie przy śmierci, bez zmiany mnożników obrażeń.
4. Opóźnione akcje i kanały mogły przeżyć śmierć. Dodano unieważnianie akcji i czyszczenie
   obu stron starcia; callback leczenia nie wskrzesza martwego gracza.
5. Zwykłe ataki AI nie miały rozdzielenia przygotowania i trafienia. Dodano windup,
   zobowiązany kierunek i recovery w istniejącym AI; szarża nie śledzi uniku po zapowiedzi.
6. Knockback mógł przekroczyć przeszkodę. Każdy krok teraz przechodzi walidację nawigacji.
7. Czas walki był obcinany do 100 ms na klatkę. Wprowadzono ograniczone nadrabianie
   symulacji; nie zmieniono obsługi wejścia ani współrzędnych HUD.

## Weryfikacja — kontrola rdzenia i dalsza regresja

Rdzeń: `53ff71842e1d2e68a6df9589dd9bdcd8faf2afd4`, wypchnięty na GitHub.
Powtórzony pełny Vitest na tym SHA: **806 PASS / 0 FAIL / 0 pominiętych**
([wynik](qa/unit-core-sha.json)). Następny commit zawiera testy i dowody, bez zmian
logiki gry. Starsze próby dotyczą roboczych zmian względem bazy i nie są dowodem PASS
na końcowym SHA.

Zachowane informacje o nieudanych próbach:
- Nowy scenariusz dotykowy błędnie odtwarzał sekwencję kontaktów i czekał na gotowy R
  podczas trwającego automatycznego atakowania. Naprawiono scenariusz: oba palce pozostają
  na ekranie podczas asercji, oddzielono serię prawdziwych kliknięć/tapnięć. Nie zmieniano
  sterowania w celu przejścia testu. Nieudane próby nie są zgłaszane jako PASS.
- Jedno uruchomienie przeglądarki zakończyło się `ERR_CONNECTION_REFUSED` po wygaśnięciu
  wcześniejszego procesu preview między turami. Serwer jest teraz zarządzany przez Playwright.
- Jeden pełny przebieg Vitest kolidował z edycją pliku testów (nowy test wywołał metodę
  niedostępną w już zaimportowanej wersji modułu). Wynik odrzucono jako niestabilny snapshot;
  pełna kontrola musi być ponowiona na zakończonych zmianach.

## Ograniczenia

Fizyczne telefony Android/iOS i sprzętowe WebGL: NIEWYKONANE (brak urządzeń).
Brak nowych klipów combo; brak globalnego hit-stopu. Lot bada wybrany hurtbox, bez
przechwytywania przez innego potwora. Nie jest to multiplayer ani symulacja sieciowa.
Ręczny odbiór dynamiki i czytelności przez właściciela pozostaje wymagany przed scaleniem.

### Kontrole przed pierwszym commitem rdzenia

- `npm run typecheck`: PASS (aplikacja, e2e, tools).
- `npx vitest run --reporter=json --outputFile=.../unit8.json`: **806 PASS, 0 FAIL, 0 pominiętych**;
  w tym 33 nowe testy V3. [Podsumowanie](qa/unit-summary.json).
- `npm run lint`: PASS, 0 błędów, 13 wcześniejszych ostrzeżeń React.
- `npm run assets:check`: PASS; `npm run build`: PASS, ostrzeżenia wielkości chunków.
- `python3 scripts/docs/check_documentation.py`: PASS po dodaniu nowego dziennika do indeksu Git.
- Canvas, pierwszy zestaw kontrolny: 11/11 PASS (cztery umiejętności, pięć scenariuszy Argon,
  dwa przebiegi gracza v2). Dalsze pełne przebiegi opisane niżej nie są jeszcze zakończone.

Rozpoznano wcześniejsze usterki testów: na czystej bazie `f2575faa` test importowanego rigu
również nie znajduje `Zmiana rasy` — guzik jest obecnie tylko dla staff. Testy użytkownika
przechodzą przez dostępne `Zapisz i wybierz postać` → `Nowa podróż`, bez zmiany UI gry.
Test mapy/globusa tworzył slot v1, a rzeczywisty link mapy wracał do domyślnego v2;
próba aktualizacji tego testu ujawniła dalsze różnice UI. Zmiany tego pliku wycofano
z zakresu V3; problem mapy pozostaje do osobnej naprawy, bez zmian zapisu i nawigacji gry.
Nowy scenariusz ruchu podczas walki musi prowadzić na zewnątrz miasta (w każdym świecie
w inną stronę); powrót do bezpiecznej strefy prawidłowo blokował atak i unieważniał próbę.


## Wynik dostawy i pozostałe blokady

Nie jest to pełny odbiór wszystkich wymagań V3 ani zgoda na scalanie. Rdzeń jest działającą,
przetestowaną zmianą, a gałąź ma trafić do **Draft PR do audytu**. Produkcja pozostaje nietknięta.

- Nowe scenariusze sprawdzają wszystkie rasy w rzeczywistym Superior v2 oraz interakcję
  ruch/atak, serię naciśnięć, pokonanie przeciwnika i XP po reloadzie w sześciu rozdzielczościach.
  Wersje mobilne używają CDP touch, nie są testem fizycznego Androida/iOS.
- Przed zrzutem test korzysta ze zwykłego polecenia pauzy, aby czas wykonywania screenshotu
  nie był bezczynnym staniem pod ostrzałem. Przed walką i w trakcie używa dostępnych mikstur.
  Nie podnosi HP/levelu/KI, nie dopisuje XP i nie zmienia danych zapisów.
- Nowe scenariusze korzystają z normalnych poleceń ruchu/wyboru celu (zdarzenie używane przez
  kliknięcie świata), prawdziwych przycisków, klawiatury i CDP. Scenariusze v1 wykorzystują
  istniejący playtest-only spawn kanonicznej Salamandry, a scenariusze v2 naturalny streaming.
  Starsze testy umiejętności używają istniejących fixture zapisów odblokowujących zdolności;
  nie przedstawiamy ich jako przejścia poziomów od początku.
- Próba pełnych projektów gameplay/software-webgl zakończyła 79 przypadków przed przerwaniem
  procesu, bez końcowego podsumowania: nie jest pełnym PASS. Zachowany [log](qa/e2e-full.log).
- Dalszy przebieg regresji jest również niepełny; [log](qa/e2e-rest2.log). Cztery mobilne
  przypadki `stage3.spec.ts` tworzyły własny kontekst, pomijając fixture wymuszające v1;
  dodano jawny parametr v1 do ich startu. Zachowano wszystkie asercje.
- Starsze testy wyjścia do wyboru postaci kierują się teraz przez publiczne
  `Zapisz i wybierz postać` → `Nowa podróż`. Roster, brak utraty zapisów i wejście do kolejnej
  rasy nadal podlegają oryginalnym asercjom. Nie przywrócono staffowego guzika zwykłym graczom.
- Testy pełnej aplikacji z bazowego zestawu: 7 PASS / 8 FAIL w uruchomieniu po instalacji
  Chromium ([log](qa/e2e-application2.log)). Są to nieukończone kontrole przekazania z mapy,
  nie zaliczenie pełnej regresji. `/test` pozostaje niezmienione.
- Próby korzystające z wyłączonego preview i próby bez zainstalowanej przeglądarki są błędami
  infrastruktury. Nie zaliczono ich. Nie zmniejszano asercji, nie dodawano skip/expected-fail.

[Rejestr nieudanych prób](qa/failures.json) zawiera dokładne oczekiwania i lokalne ścieżki
trace. Pełne archiwa Playwright mają setki MB z duplikatami tekstur; nie dodano ich do Git.
Są w `/workspace/scratch/combat-v3-audit/` tej sesji (nie jest to trwały backup).
Trwałe screenshoty, logi i podsumowania leżą w tym katalogu `qa/` w Git.
CI po utworzeniu PR ma zebrać własne trace jako artefakty. Nie twierdzimy, że niewysłane
archiwa są zabezpieczone poza workspace.

## Pomiary

`npx tsx scripts/combat/benchmark.ts /workspace/scratch/combat-v3-audit/combat-benchmark.json`:
60 potworów, 1200 kroków po 50 ms, najwyżej 32 aktywne AI i 59 stref.
p50 kroku **0,192 ms**, p95 **3,821 ms**, maksimum **47,669 ms**, heap Node **18 061 520 B**.
[Surowy wynik](qa/combat-benchmark.json). Środowisko Node 24, 3 CPU, około 10 GB RAM;
równolegle działało QA. To pomiar symulacji CPU, **nie FPS gry ani fizycznego telefonu**.
FPS, sprzętowe WebGL, draw calls i długi profil pamięci: NIEWYKONANE w tej dostawie.
Nie deklarujemy 60 FPS ani braku długotrwałych wycieków na podstawie tego benchmarku.

## Kontynuacja audytu

1. Odczytać aktualne AGENTS/INDEX oraz kontrakt V3 w ROZWOJ-I-WALKA.
2. Uruchomić kontrolę CI na końcowym SHA; doprowadzić pełną regresję do końca.
3. Zweryfikować stare scenariusze mapy i v1/v2 bez migracji zapisów lub zmian map.
4. Zrobić ręczny odbiór grupowej walki i czytelności na fizycznym telefonie; istniejące
   drzewa i skały nadal mogą zasłaniać cel — art/geometria nie należały do dozwolonych zmian.
5. Nie scalać ani publikować bez osobnego zatwierdzenia właściciela.


### Powtórki regresji przed commitem QA

- `playwright ... pre-gpu overlay-audit planetary-preview stage3 --project=gameplay
  --grep 'imported eight-direction|persistent options 1280|default painted visual|layout 390x844'`:
  **4 PASS / 0 FAIL**. [Log](qa/e2e-harness-final.log). Potwierdzono naprawę selektorów
  i jawnego wariantu świata w testach; kod HUD/questów nadal nietknięty.
- Desktop `combat-v3.spec.ts --project=gameplay --project=software-webgl
  --grep '1280x720|1920x1080'`: **3 PASS / 1 FAIL**; ostatnia próba Mędrca WebGL zatrzymała
  się przy sprawdzaniu dojścia. [Log](qa/e2e-desktop-final.log).
  Test wymagał dodatkowego marginesu 16 jednostek od miasta, chociaż runtime blokuje walkę
  tylko we właściwym prostokącie. Postać zdalnego ataku prawidłowo zatrzymywała się już
  w zasięgu, przez co asercja pomocnicza oczekiwała ruchu, którego gracz nie zlecał.
  Dodano opcjonalny `margin` do testowego `outsideTowns`, z zachowaniem domyślnej wartości
  16 dla istniejących scenariuszy; nowy test używa 0, zgodnie z `inSafeCity`.
- Naturalne spotkania Superior v2: cztery rasy uzyskały PASS w Canvas i cztery w Software
  WebGL. Cztery rozdzielczości dotykowe uzyskały PASS w obu rendererach. Dotychczasowy
  log pełnych nowych przypadków jest przerwany po 18 wynikach, więc nie zastępuje
  zakończonego przebiegu wszystkich projektów.


### Dalsza weryfikacja ostatniego przypadku

Po korekcie marginesu próba Mędrca 1920×1080 Software WebGL nadal zakończyła się FAIL
przy dojściu, więc sam margines **nie wyjaśnia całej usterki**. Trace pokazuje bohatera
w stanie `walk`, bez celu, przy `(23800, 14133.93)`, a przeciwnika przy
`(23747.21, 13288.46)` (67 HP). Nie jest to dowód błędu naliczania obrażeń.
Zwiększono wyłącznie budżet czasu dojścia dla dużego Software WebGL do 180 s (cały test
360 s), pozostawiając zasięg, wymagane trafienia, zabicie, XP i reload bez zmian.
To wolny renderer CPU; nie wolno utożsamiać jego wyniku z wydajnością fizycznego telefonu.
Ostatni wynik powtórki będzie odnotowany w PR/CI. Do tego momentu brak pełnego odbioru.

Kontrole QA po poprawkach testów: pełny TypeScript PASS, lint 0 błędów / 13 ostrzeżeń,
ukierunkowane Vitest (`combat-v3`, `session`, `monsters`) **86 PASS / 0 FAIL**.


### Końcowy zapis i PR

- Rdzeń: `53ff71842e1d2e68a6df9589dd9bdcd8faf2afd4`.
- QA i dowody: `892c68bff302d40dfb5dfd8e437cd10966282838`.
- [Draft PR #45](https://github.com/circus574-cpu/pixel-playground-launch/pull/45),
  gałąź `feature/combat-diablo-v3`; brak scalenia i publikacji.
- Na SHA QA wykonano ponownie pełny TypeScript (PASS) oraz 86 testów walki/sesji/potworów
  (PASS). Produkcyjna logika jest identyczna z rdzeniem, na którym pełny Vitest miał 806 PASS.
- Ostatni przypadek Mędrca 1920×1080 Software WebGL **PASS**, 4,3 min;
  [log](qa/e2e-sage-budget.log). Wydłużony budżet był potrzebny do rzeczywistego dojścia,
  nie do obniżenia warunków trafienia/zabicia/zapisu.
- **20 nowych scenariuszy ma końcowy wynik PASS w łączonych przebiegach**:
  [indeks wyników](qa/v3-browser-summary.json). Nie jest to jeden nieprzerwany przebieg
  pełnego Playwright. Poprzednie porażki pozostają zapisane, a pełna regresja oraz
  końcowe GitHub Actions wymagają dalszego domknięcia. PR świadomie pozostaje Draft.
- Wyniki CI: sprawdzić zakładkę Checks PR #45; nie deklarowano PASS przed zakończeniem.
  Fizyczne telefony, pomiary FPS i odbiór jakości nadal pozostają niewykonane.


Korekta zestawienia końcowego: wcześniejszy przebieg Androida 390×844 Canvas po PASS miał
późniejszy FAIL (nieukończone zabicie Salamandry). Nie pominięto tej porażki. Powtórka
na `2a5be38b0bcbe21673cd8b6142828475eb4182ca`: **1 PASS, 17,6 s**,
[log](qa/e2e-android-final.log). Indeks 20 scenariuszy uwzględnia teraz ostatnie wyniki
każdego przypadku: **20 PASS / 0 FAIL**, uzyskane w oddzielnych przebiegach.
Stabilność całej długiej regresji nie jest przez to potwierdzona.

Odczyt GitHub przy SHA `2a5be38b`: PR Draft, `statusCheckRollup=[]`, zero Actions runs dla
tej gałęzi. Brak automatycznego uruchomienia nie jest zaliczeniem CI. Końcowy stan ręcznej
próby uruchomienia workflow zostanie wskazany w treści PR; nie scalano zmian.


### Pełny wynik GitHub Actions i domknięcie testów mapy

[CI 40518268782](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40518268782)
na `a8fd1a8425c0bf200e156bdfdffff700413f059f` zakończyło wszystkie 183 testy:
**175 PASS / 8 FAIL**. TypeScript, jednostkowe, assets, lint i build w tym samym jobie PASS.
Wszystkie porażki: cztery kontynenty `globe-handoff.spec.ts` w dwóch rendererach aplikacji.
Surowe trace i screenshoty są w [artefakcie CI](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40518268782/artifacts/12743664875)
(retencja 7 dni); [trwały indeks wyniku](qa/ci-40518268782.json).

Potwierdzono rozbieżność oracle testowego z aktualnym runtime: np. Pyra oczekiwała
`x=36698.286027` z v1, podczas gdy gra poprawnie uruchamiała v2 przy `x=45850.286027`.
Spec mapy teraz od początku korzysta z domyślnego v2 i odczytuje arrival z jego indeksu.
Nie zmieniono statystyk, checkpointów, geometrii, zapisu ani kodu mapy. Na desktopie
sprawdza widoczność legendy przed próbą klikania przycisku rozwijania dostępnego w
układzie kompaktowym. Pozostałe asercje przejść, izolacji zapisów i pozycji pozostają.


Końcowa powtórka ośmiu naprawionych przypadków mapy: **8 PASS / 0 FAIL**, 10,2 min,
Canvas i Software WebGL, [log](qa/e2e-map-complete.log).
Początek i koniec scenariusza gry jawnie używają v2, zaś kontrola historycznego globusa
zachowuje wcześniejszy fixture. Asercja powrotu sprawdza dokładną ścieżkę `/mapa`,
pozostawiając dozwolony parametr QA wersji świata. Pozostałe testy roster/home zachowują
oryginalny wariant v1; nie rozszerzono tej poprawki na zachowanie gry.
Nie usunięto żadnej asercji dotyczącej pozycji, liczby postaci lub nienaruszenia zapisów.

Przed commitem: pełny TypeScript PASS, lint PASS (13 dotychczasowych ostrzeżeń),
86 testów ukierunkowanych PASS; walidacja dokumentacji PASS.
Poprzedni pełny CI miał 175 PASS i osiem opisanych FAIL; te osiem jest teraz lokalnie
zaliczone. Nie utożsamiamy tego z jednym zielonym przebiegiem CI na końcowym SHA.
Pełny workflow zostaje uruchomiony ponownie na końcowej gałęzi; aktualny link i status
są w PR #45. Brak scalenia, publikacji i czynności na GPU.

## Podpięcie gałęzi coder do głównego panelu

Polecenie właściciela: zweryfikować gałąź coder, podpiąć do main bez zastępowania
obecnego panelu i bez zmiany logowania; nie uruchamiać testów, wykonać push.
Baza main: `8e3db1c124888293a4990db9debd37c11d57c6ea`.
Źródło: `coder@fb2abfa52679ecaa1575b58440e548cf91da0b81` (1 commit do przodu, 2 wstecz
w chwili porównania). Zintegrowano selektywnie na gałęzi integration/coder-panel-20261027.

Nowa osobna zakładka Coder, lazy loading i izolacja CSS. Stare zakładki /admin,
account.css, obsługa logowania i stary StaffTools pozostawiono. Rozszerzenia gmEdit oraz
poleceń staff są addytywne. Nadpisania edytora nie są globalnym serwerowym zapisem świata.
Zabezpieczono odczyt localStorage przed wyjątkiem przy zablokowanej pamięci; bez zapisanych
nadpisań runtime nie wykonuje nowego filtrowania oryginalnych spawnów.
Testy jednostkowe i przeglądarkowe: NIEWYKONANE na polecenie właściciela. Nie uruchamiano
manualnych workflow CI ani procesu publikacji. Szczegóły integracji w ARCHITEKTURA-I-TESTY.md.
Kontrola kompilacji `npm run typecheck` (aplikacja, e2e, tools): PASS. To kontrola typów;
nie wykonywano zestawów testowych ani builda produkcyjnego.

## Coder: mapa świata 2D i warstwy

Dodano zakładkę `Mapa świata 2D` w edytorze Coder, obok dotychczasowej mapy/edycji spawnów.
Cała planeta v2, legenda, zoom/przesuwanie myszą/dotykiem/strzałkami, wybór krainy,
kliknięcie punktów, wyszukiwanie zadań i podgląd ich celów. Osobne przełączniki:
drogi/ścieżki, spawny, questy, miasta/lokacje. Źródła: istniejący atlas, 1690 dróg,
10 plików spawnów (8767 bazowych punktów) i lokalne nadpisania oraz katalog questów.
Nie zmieniono starego panelu, logowania, geometrii ani danych zapisów. Brak dokładnego
wiązania NPC jest opisany jako punkt miasta; brakujące cele nie otrzymują zmyślonej pozycji.
Testów nie uruchamiano zgodnie z poprzednią dyspozycją właściciela; wykonywana jest
wyłącznie kontrola TypeScript. Nie deklarować przetestowania w przeglądarce ani publikacji.
Pełne `npm run typecheck` (aplikacja, e2e, tools): PASS. Widok nie był sprawdzany
przeglądarkowo; nie uruchamiano testów ani ręcznej publikacji produkcyjnej.
