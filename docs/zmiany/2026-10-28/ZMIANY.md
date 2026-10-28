# 28.10.2026 — historia zmian

## Mapa świata w grze — przygotowanie zasobów i koszt renderowania

Baza: `954dd3ee8b2fcb4ee255dad892e92a53dac7d775` (aktualny `origin/main`
sprawdzony przez fetch). Gałąź: `fix/game-map-preload-performance`.
Właściciel zgłosił poważne spadki FPS mapy 2D/globusa i zaakceptował dłuższy start
w zamian za wcześniejsze przygotowanie mapy. Zakres dotyczy mapy w grze, nie Coder.

Potwierdzenia z kodu: dane nakładki zawierają 1883 fragmenty terenu i 1690 dróg;
wcześniej widoczne fragmenty renderowano jako osobne zagnieżdżone SVG/image.
Pauza sesji nie zatrzymywała renderowania Phaser ani wywołań adaptera runtime
pod pełnoekranową mapą. Obrazy i moduły mapy/globusa przygotowywano przy jej otwarciu.
To potwierdzone źródła dodatkowej pracy; nie jest to pomiar FPS urządzenia właściciela.

Zmiany i sposób działania opisuje [architektura](../../ARCHITEKTURA-I-TESTY.md#przygotowanie-i-renderowanie-mapy-w-grze--28102026).
Nie zmieniono map, źródeł generated, assetów artystycznych, zasad walki, zapisu,
sterowania, układu HUD, logowania, panelu administratora ani konfiguracji produkcji.
GPU nie używano.

### Kontrole

Wyniki wykonanych kontroli (zapis roboczy oparty na bazowym SHA powyżej;
manifest SHA-256 źródeł w QA pozwala przypisać wyniki do implementacji):

| Polecenie | Wynik |
| --- | --- |
| `npm run typecheck` | PASS: wszystkie trzy konfiguracje TypeScript |
| `npm test` | 816 PASS / 0 FAIL, 61 plików; powtórzony pełny przebieg |
| `npx vitest run src/test/map-preload.test.ts src/test/map-terrain-canvas.test.tsx src/test/mapa-view.test.tsx src/test/planet-map.test.ts src/test/planet-globe.test.ts src/test/planet-game-link.test.ts` | 32 PASS / 0 FAIL; również po ostatniej zmianie przygotowania obrazów globusa |
| `npm run build` | PASS, finalny build klienta i Nitro; niczego nie opublikowano |
| `npx eslint` na zmienionych modułach kodu/testów i konfiguracji Playwright | 0 błędów, 2 ostrzeżenia: eksport helpera obok komponentu globusa i wcześniejsza zależność `slot.id` efektu startowego |
| `KI_QA_APP_URL=http://127.0.0.1:4176 KI_QA_BASE_URL=http://127.0.0.1:4176 npx playwright test e2e/map-performance.spec.ts --project=application-canvas --project=application-webgl` | 4 PASS / 0 FAIL / 0 SKIP, 1280×720 i 390×844 |
| `... npx playwright test e2e/map-performance.spec.ts e2e/globe-rendering.spec.ts --project=application-canvas --project=application-webgl` | pomocniczy przebieg przerwany po 4 PASS; w tym 2 PASS istniejących testów zwalniania kontekstów i awaryjnego powrotu do 2D; nie zaliczano niewykonanych przypadków |

Ostatni przebieg z gry sprawdza rzeczywisty wybór postaci, pobranie atlasu i obrazu
lądu przed otwarciem mapy, otwarcie z minimapy, istnienie pojedynczej warstwy Canvas,
brak szczegółowych obrazów SVG, przesunięcie mapy, zamknięcie oraz ruch postaci.
W projekcie WebGL obejmuje także przełączenie do globusa i z powrotem. Nie zmienia
zapisów ani stanu sesji, żeby sztucznie przejść scenariusz. Rejestruje błędy JS.
Przeglądarkę uruchomiono lokalnym `npx vite --config scripts/application-qa.vite.ts
--host 127.0.0.1 --port 4176`. Surowe pełne trace pozostają w ignorowanym lokalnym
`test-results/`; Git zachowuje logi, pomiary i cztery screenshoty w
[katalogu QA](qa/map-performance/).

Pomiary 30 kolejnych odstępów `requestAnimationFrame` po przesunięciu mapy:

| Renderer i viewport | Mediana | P95 |
| --- | ---: | ---: |
| Canvas, 1280×720 | 33,4 ms | 66,7 ms |
| Canvas, 390×844 | 16,7 ms | 16,8 ms |
| Software WebGL, 1280×720 | 16,7 ms | 716,7 ms |
| Software WebGL, 390×844 | 16,7 ms | 50,0 ms |

To lokalna próbka rAF z równolegle uruchomionymi kontrolami CPU, nie pomiar FPS
renderera i nie porównanie z wersją bazową na urządzeniu właściciela. W szczególności
wynik P95 716,7 ms pokazuje, że nie ma podstaw do deklarowania braku wszystkich
zacięć. Przygotowanie zasobów i redukcja pracy są wdrożone, ale odbiór wydajności
na docelowym telefonie pozostaje otwarty. Pole `scenarioElapsedMs` w JSON obejmuje
przesunięcie i próbkę 30 klatek; nie jest czasem samego otwarcia.

Screenshoty: [Canvas desktop](qa/map-performance/application-canvas-1280.png),
[Canvas mobile](qa/map-performance/application-canvas-390.png),
[WebGL desktop](qa/map-performance/application-webgl-1280.png),
[WebGL mobile](qa/map-performance/application-webgl-390.png).
Obejrzano screenshot mobilnej mapy 2D: teren, drogi, znaczniki i napisy są widoczne.
Stare ostrzeżenia jsdom o braku odtwarzania audio i deprecjacji CJS Three nie
spowodowały niezaliczenia testów; build zgłasza istniejące ostrzeżenia narzędzi.

Pierwszy przebieg nowego testu przeglądarkowego ujawnił błąd instrumentacji testu:
standardowy bufor 250 wpisów Resource Timing zapełnił się importami środowiska dev,
więc asercja nie widziała późniejszych pobrań atlasu. Trace potwierdził odpowiedzi
HTTP 200 dla atlasu i map-hi. Zwiększono wyłącznie bufor pomiarowy w teście do 5000;
nie usunięto asercji pobrania przed otwarciem mapy i nie zmieniono stanu gracza.
Wcześniej przerwano przebieg z nieprawidłową nazwą przycisku w nowym scenariuszu;
poprawiono go na istniejące „Otwórz mapę świata”.

### Ograniczenia i publikacja

Pierwsza kompilacja shaderów i upload tekstur do kontekstu WebGL następują nadal
przy tworzeniu globusa. Przy zmianie kontynentu lub wyparciu obrazu z ograniczonego
cache może wystąpić doczytanie. Nie obiecywano 60 FPS i całkowitego wyeliminowania
przycięć na każdym urządzeniu. Fizyczny Android/iOS: NIEWYKONANE, brak urządzenia.
Pomiary lokalnej przeglądarki i SwiftShader nie zastępują odbioru na telefonie.
Brak automatycznego scalenia do main i brak publikacji produkcyjnej tej poprawki.

Dodatkowa potwierdzona usterka z rzeczywistego testu gry: automatyczne przybliżenie
kontynentu uruchamiało animację, która nadpisywała dokładny widok pozycji postaci
z `focus`. Po przygotowaniu danych wcześniej ta kolejność była powtarzalna
(192% zamiast zakładanego 600%, bez warstwy szczegółowej). Wyłączono konkurencyjne
przybliżenie kontynentu, gdy przekazano dokładną pozycję. Dodano też ochronę przed
spóźnionym wynikiem po demontażu i obsługę błędu danych bez odrzucenia całej mapy.

## Publikacja optymalizacji mapy — polecenie właściciela

Po powyższym checkpointcie właściciel zlecił: „Wprowadź zmiany i publikuj zweryfikuj
czy działa”. To nowe upoważnienie do scalenia PR #52 i publikacji istniejącego
projektu Lovable `e81106fd-0dd8-47e7-95cc-df4e97e3d071` na kilegends.pl.
Przed publikacją sprawdzono aktualny main: `ddd7723bd7db8c037420bf7864577dda47307c64`,
zawierający scalony PR #51 z nowymi animacjami i zasobami innych wykonawców.
Uwzględniono main przez zwykłe scalenie historii na gałęzi #52, bez rebase/force-push.

### Regresja wykryta w CI i poprawka

Pierwsze CI na `1cf7ac29` nie było zielone:
[pełny przebieg 40642904336](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40642904336)
miał 185 PASS / 2 FAIL, a
[WebGL 40642904309](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40642904309)
44 PASS / 1 FAIL. Wszystkie niezaliczone przypadki dotyczyły tego samego scenariusza
podróży po dziesięciu lądach: w `.ki-canvas` pozostawały dwa płótna Phaser.

Potwierdzona przyczyna w Phaser 4.2.1: `game.destroy(true)` ustawia `pendingDestroy`,
a właściwe `runDestroy` jest wykonywane na początku kolejnej klatki. Silnik uśpiony
pod mapą nie wykonywał kolejnej klatki, więc stara scena/Canvas nie były usuwane
przed utworzeniem następnej. W cleanup po żądaniu `destroy` budzimy wyłącznie
uśpioną pętlę: jej następny krok wykonuje oczekujące zniszczenie, nie symulację.
Nie osłabiono testu: dodano jawne wymaganie dokładnie jednego Canvas po każdej
podróży, zachowując wszystkie wcześniejsze kontrole pozycji, chunków, zapisu i XP.

Wyniki końcowej weryfikacji i publikacji dopisano po wykonaniu poniżej.

Kontrole po dołączeniu main i poprawce teardown: `npm run typecheck` PASS,
`npm test` 816 PASS / 0 FAIL (61 plików), `npm run build` PASS,
`npm run lint` 0 błędów / 13 ostrzeżeń, `npm run assets:check` PASS.

Ponowny `e2e/map-performance.spec.ts` na połączonym kodzie: 4 PASS / 0 FAIL,
Canvas i Software WebGL przy 1280×720 oraz 390×844; WebGL sprawdził także globus
oraz powrót do ruchu. Testy korzystały z aktualnych zasobów bohaterów z main.

Pierwszy lokalny przebieg podróży po poprawce: Canvas PASS, Software WebGL FAIL
na zamykaniu kontekstu testowego (`browserContext.close: ENOENT ... .trace`).
Przyczyną błędu organizacji QA były dwa równoległe uruchomienia Playwright we
wspólnym domyślnym katalogu `test-results`; start drugiego usunął aktywne pliki
pierwszego. Nie zaliczano tego przebiegu WebGL. Ponowienie otrzymało osobny katalog
`/tmp/ki-map-travel-webgl-results` i reporter list, bez współdzielonego JSON.

Odizolowane ponowienie WebGL zakończone: `KI_QA_APP_URL=http://127.0.0.1:4176
KI_QA_BASE_URL=http://127.0.0.1:4174 npx playwright test e2e/superior-world.spec.ts
--grep 'Superior: ten lands, race and inventory survive travel and reload'
--project=software-webgl --output=/tmp/ki-map-travel-webgl-results --reporter=list`:
1 PASS / 0 FAIL, pełne 10 lądów, kontrola jednego Canvas, zapis i odświeżenie.
Wcześniejszy Canvas tego samego scenariusza również PASS.

Commit poprawki i połączenia aktualnego main: `a4ee855e191be4154ab0b832b4da0af282fb9a5d`.
PR #52 scalono 28.10.2026 o 08:03:40 UTC jako
`9b9649cc5321263e7cf23f2141bbac96b2abf932`, zgodnie z nowym poleceniem właściciela.
Nowe pełne CI na a4ee855e: przebiegi
[40653403311](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40653403311)
i [40653403301](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40653403301),
w chwili scalania nadal w toku; nie deklarowano ich zaliczenia.

### Potwierdzona publikacja i testy domeny produkcyjnej

Lovable zsynchronizowało commit `9b9649cc5321263e7cf23f2141bbac96b2abf932`.
Wywołano `Lovable.deploy_project` dla istniejącego projektu, bez zmiany domen,
widoczności, bazy ani konfiguracji hostingu. API przyjęło wdrożenie
`2274aa97-26c2-4230-b006-7449cf7f4c0b` jako `pending`; nie utożsamiano tego
komunikatu z ukończeniem publikacji. Następnie sprawdzono faktyczne publiczne pliki.

Nowy plik aplikacji: `/assets/index-Cm77U70d.js`; zawiera przygotowanie mapy przy
starcie. Publiczny `/assets/mountGame-kDsHhFD7.js` zawiera także poprawkę
`destroy` → `loop.wake`. SHA-256 i metadane zapisano w
[deployment.json](qa/map-release/deployment.json). Stary plik wejściowy miał nazwę
`index-0Vp63pgD.js`. Początkowo część odpowiedzi `/` pozostawała starsza, podczas
gdy unikalny parametr i `?ki-world-v2=1` zwracały już nowy build. Nie ustalono
warstwy cache. O 08:16:23 UTC także zwykły adres `/` zwrócił nowy plik aplikacji.

Rzeczywista produkcja `https://kilegends.pl/`, po publikacji:

```sh
npx playwright test --config docs/zmiany/2026-10-28/qa/map-release/production.config.ts --grep '390'
```

**2 PASS / 0 FAIL / 0 SKIP** — 390×844, Canvas i Software WebGL. Przejście przez
wybór Planetarnych i start gry, pobranie danych mapy przed jej otwarciem, mapa 2D,
przesuwanie, globus w WebGL, powrót do 2D, zamknięcie i rzeczywisty ruch postaci.
Brak nieobsłużonych błędów JS w tych scenariuszach. Nie wstrzykiwano stanu gry,
nie zmieniano zapisów innych graczy i nie używano kont administracyjnych.

[Wyniki produkcyjne](qa/map-release/production-results.json),
[screenshot Canvas](qa/map-release/application-canvas-production-390.png),
[screenshot WebGL](qa/map-release/application-webgl-production-390.png).
Oba screenshoty przedstawiają mapę 2D; przełączenie globusa jest osobną asercją
scenariusza WebGL. To test Chromium na mobilnym viewportcie, nie fizycznego telefonu.
Pełne CI na a4ee855e pozostawało w toku; nie deklarowano zielonego pełnego CI.
GPU nie dotykano. Kod produkcyjny pochodzi z merge commita 9b9649cc; późniejszy
commit dowodów zmienia wyłącznie dokumentację i pliki QA, nie kod aplikacji.

## Audyt niezależny 28.10.2026 — stan po PR #52

**Repo:** `circus574-cpu/pixel-playground-launch`. **Odczytany HEAD main:** `30f7b8d5a7d15ffe73380322ca383c280dacdba8`. Poprzedni audyt bazował na `954dd3ee`; od tamtej chwili scalono [PR #51](https://github.com/circus574-cpu/pixel-playground-launch/pull/51) (postacie HD czterech ras, ich dźwięki i muzyka) oraz [PR #52](https://github.com/circus574-cpu/pixel-playground-launch/pull/52) (przygotowanie mapy, ograniczenie kosztu renderowania, obsługa usypiania scen). Commit `30f7b8d5` dodał dokumentację weryfikacji wydania; nie jest zmianą silnika.

| Kontrolowany element | Status | Dowód / zakres |
| --- | --- | --- |
| Scalenie #51 i #52 | **ZALICZONE** jako obecność zmian | SHA merge `ddd7723b`, `9b9649cc`, PR #51/#52 |
| Produkcyjna mapa po #52 | **ZALICZONE** tylko w wąskim teście | Dziennik wydania: dwa testy Playwright 390×844, Canvas / Software WebGL, 2 PASS; nie jest to test telefonu fizycznego |
| Pełna regresja Software WebGL #52 | **ODRZUCONE** | [Run 40653403301](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40653403301), **7 FAIL** — brak znalezionego żywego przeciwnika w 60 s, `e2e/fixtures.ts:223` |
| Pełny Playwright #52 | **NIEZWERYFIKOWANE** | [Run 40653403311](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40653403311) w chwili audytu `in_progress`; nie liczyć jako PASS |
| Pełny Playwright #49 | **ODRZUCONE** | [Run 40595421144](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40595421144): 182 PASS, 1 FAIL Planetarnego (2/3 zabójstw) |
| Mapa Coder: białe miejsca | **ODRZUCONE** (statyczna ścieżka kodu) | `src/components/admin/AdminWorldMap.tsx` rysuje `projection.places`, lecz nie dodaje ich do kandydatów wyboru `onPointerUp` |
| RLS/admin/GM i zapisy | **NIEZWERYFIKOWANE** | Brak niezależnego testu end-to-end kont i lokalnych override'ów na bieżącym main |
| Docelowe 45% ląd / 55% woda i podziemia | **NIEZWERYFIKOWANE** | Parametry kanoniczne, brak końcowego pomiaru i grywalnych przejść |
| Pełne QA i fizyczny telefon dla HEAD main | **NIEZWERYFIKOWANE** | Częściowe próby na innych SHA nie zastępują końcowej regresji |

### Usterki i działania dla Codexa

- **KL-2026-10-28-05, WYSOKI:** w [WebGL #52](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40653403301) nie powiodło się siedem przypadków: `combat-skills` (Mędrcy, Androidzi), `combat-v3` (Mędrcy, Androidzi), trzy `hero-lifecycle`. Wspólny błąd: `liveEnemy()` nie znajduje aktywnego przeciwnika przez 60 s. **Odtworzenie:** uruchomić odpowiednie Playwright Software WebGL z artefaktami i sprawdzić spawny, pozycję postaci, nawigację i fixture. **Oczekiwane:** żywy przeciwnik pojawia się w przewidywalnym czasie, a pełny scenariusz kończy się PASS. Przyczyna NIE jest jeszcze udowodniona.
- **KL-2026-10-28-01, WYSOKI:** test Planetarnego z #49 — 2/3 zabójstw w 60 s. Trace dostępny w artefakcie CI; diagnostyka na finalnym SHA, bez skip/relaksowania asercji.
- **KL-2026-10-28-02, ŚREDNI:** białe znaczniki lokacji i miast mapy Coder nieobsługiwane przez `onPointerUp` (wykluczone z `candidates`). **Odtworzenie:** `/admin` → Coder → Mapa świata 2D → wyłączyć pozostałe warstwy → kliknąć biały znacznik; brak panelu szczegółów. **Oczekiwane:** nazwa, ID i kraina. Potwierdzenie kodowe, bez wykonania przeglądarkowego.
- **KL-2026-10-28-03, WYSOKI (bramka wydania):** brak pełnej zielonej regresji dokładnego końcowego SHA i testów realnego Androida/hardware WebGL. **Oczekiwane:** wszystkie wymagane CI, sprawdzony wdrożony SHA i odbiór wizualny.
- **KL-2026-10-28-04, ŚREDNI:** starszy PR #50 może nadpisać równolegle dopisane opisy Coder/QA; porównać z main, nie scalać bez aktualizacji i kontroli konfliktów.

**Werdykt końcowy: NIEZWERYFIKOWANE** dla całego najnowszego wydania; **ODRZUCONE** dla konkretnego przebiegu WebGL i interakcji miejsc w Coder. Zaliczono wyłącznie obecność zmian i wąski test mapy na produkcji. Odczyty GitHub Actions i statyczna inspekcja nie są testem wykonanym przez audytora na fizycznym telefonie. Ten commit dokumentacyjny nie naprawia kodu, nie wznawia CI ani nie publikuje gry.

## Coder — indywidualne parametry i teleport GM

Polecenie: rozszerzyć edytor Coder o parametry postaci, w tym szybkość, i dodać
wybieranie punktu teleportu palcem na mapie 2D specjalnej postaci GM.
Baza: aktualny `main@3ffd46c7` (sprawdzony fetch przed pracą).
Gałąź: `feature/coder-character-stats-gm-map`. Dotychczasowy panel i logowanie zachowano.

### Obsługa

- `/admin` → Coder → „Gracze (Chmura)” lub „Postacie lokalne (Urządzenie)” → edytor
  wybranej postaci → „Indywidualne parametry postaci”. Po wpisaniu wartości użyć
  „Zapisz zmiany” i ponownie wejść daną postacią do gry. Puste pole/reset przywraca
  domyślne obliczenia; nie resetuje poziomu, ekwipunku ani zadań.
- Specjalna postać admin/GM (rola zweryfikowana istniejącą ścieżką konta), na zewnątrz
  i żywa → mapa 2D → „Teleportuj” → tap/klik w dostępny punkt. Można wskazać także
  inny kontynent/wyspę. Ziemia/przeszkody weryfikowane są przez rzeczywistą nawigację.
  Zwykła postać nie ma przycisku. Przesuwanie i szczypanie nadal obsługują atlas.
- Zamknięcie mapy podczas sprawdzania anuluje operację; brak roli, zgon, wnętrze,
  błędna pozycja, przeszkoda, anulowanie lub konflikt zapisu nie wykonują teleportu.

Architektura i semantyka stałych wartości: [opis](../../ARCHITEKTURA-I-TESTY.md#coder-parametry-postaci-i-teleport-gm-z-atlasu--28102026).
Nie zmieniono tabel/RLS, kanonicznych danych generowanych, sterowania, HUD walki, grafiki ani geometrii.
Nie używano GPU. Nie modyfikowano istniejących zapisów użytkowników podczas QA.

### Weryfikacja

| Kontrola | Wynik |
| --- | --- |
| `npm run typecheck` | PASS, komplet trzech konfiguracji; poprawiono początkowe typy helperów testowych |
| `npm test` | 837 PASS / 0 FAIL w 65 plikach |
| `npx vitest run src/test/coder-stats-teleport.test.ts src/test/coder-stats-ui.test.tsx src/test/map-teleport-ui.test.tsx src/test/staff-map-runtime.test.ts src/test/staff.test.tsx` | 26 PASS / 0 FAIL po końcowych zmianach |
| `npm run build` | PASS, finalny build klienta i Nitro |
| `npm run lint` | 0 błędów, 14 ostrzeżeń (13 wcześniejszych i ostrzeżenie Fast Refresh fixture QA) |
| `npx playwright test --config docs/zmiany/2026-10-28/qa/coder-gm/browser.config.ts` | 2 PASS / 0 FAIL, prawdziwe zdarzenia dotykowe Chromium przy 390×844 i 852×393 |
| `KI_QA_APP_URL=http://127.0.0.1:4176 KI_QA_BASE_URL=http://127.0.0.1:4185 npx playwright test e2e/coder-gm-regression.spec.ts --project=gameplay --output=/tmp/ki-gm-gameplay-results --reporter=list` | 1 PASS / 0 FAIL, prawdziwy Phaser: zwykła postać nie ma teleportu GM, powrót z mapy i ruch joystickiem działają |

Serwer QA: `npx vite --config scripts/playtest.vite.ts --host 127.0.0.1 --port 4185`.
Test komponentów używa produkcyjnych formularza i mapy, ale podstawionego zapisu
oraz callbacku teleportu; **nie jest testem zalogowanego GM w Phaser** ani dowodem
RLS. Fixture nie nadaje uprawnień, nie uruchamia sesji staff i nie jest wejściem
produkcyjnego buildu. Test runtime uruchamia rzeczywistą nawigację, loader z sumami,
serializację oraz przejścia między lądami; rola GM jest tam jawną daną testu
jednostkowego. Sprawdzono także odebranie roli i anulowanie podczas oczekiwania.

Testy pokrywają wszystkie cztery kity, trwałość i reset parametrów, błędne liczby,
rzeczywistą zmianę prędkości ruchu bez przechodzenia przez przeszkody, odwrócenie
projekcji wszystkich 10 lądów, uprawnienia, ocean/kolizje, podróż i odczyt zapisu,
obsługę tap/drag/pinch/cancel. Odczytano changelog i dokumentację update Supabase;
ścieżka bazy pozostała bez zmian, nie wykonywano zapisu produkcyjnej postaci.

NIEWYKONANE: logowanie rzeczywistym kontem GM w produkcji, test fizycznego telefonu,
produkcyjny zapis cudzej postaci i pomiary wydajności na sprzęcie docelowym.
Nie deklarowano takich wyników. Logi i obrazy: [QA](qa/coder-gm/).
Te nowe funkcje przygotowano na osobnej gałęzi do przeglądu; nie scalono ich i nie
opublikowano w ramach tego polecenia. Wcześniejsza publikacja PR #52 dotyczyła
optymalizacji mapy, a nie tych nowych narzędzi.
