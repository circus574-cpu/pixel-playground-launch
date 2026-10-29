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
## Rozwój i dziedzictwa czterech ras — etap wspólny, W TRAKCIE

Gałąź `feature/racial-development-and-heritage`, punkt wyjścia `3ffd46c7e993c310a7b507c8b93c3723b91825bd`.
Nie scalono i nie opublikowano. Wcześniejszy PR #53 Coder/GM pozostał oddzielony;
panel administratora, hosting, logowanie i GPU nie były częścią tej zmiany.

Zachowano całe nowe zlecenie właściciela w `docs/design/racial-development-owner-2026-10-28.txt`.
Wdrożony wspólny moduł obejmuje obliczenia pięciu dyscyplin, zakupy/reset u trenera,
30 parametrów egzaminów, pięć wykonań celów w rzeczywistym Phaser, bezpłatne przygotowanie,
legalne profile wypożyczone bez portu zapisu, kontrolę i jednokrotny zapis wyniku.
Właściwy runtime śpi podczas próby; jego HUD/obsługa klawiatury i obrotu nie mogą
wysyłać poleceń do oryginału. Powrót odtwarza właściwy HUD. Ponowienie porażki tworzy
nową próbę, zachowując postać. Badanie 40 gatunków ma cztery trwałe poziomy wiedzy
oraz jednorazową praktykę za zastosowanie wiedzy w prawdziwej walce po badaniu.

Modyfikatory 12 wariantów technik i modułów Androida są podłączone do kitów.
**Ich pełne odblokowania i ścieżki rasowe nie są jeszcze wdrożone**; skaner pozostaje
zarezerwowanym identyfikatorem. Nie zaliczać tych kart jako ukończonego mistrzostwa.
Pozostałe: 24 rozdziały, 24 projekty, 48 prób / 144 stopnie, bronie z depozytem,
pełne biografie/kroniki, późne spotkania, walidator całego grafu i bilans 17 800 praktyki.
Przygotowany fundament daje obecnie tylko część zaplanowanych źródeł praktyki.

### Wykonane kontrole wspólnego etapu

- Baza `3ffd46c7`: pełny TypeScript, 816 testów jednostkowych, lint, zasoby,
  build i kontrola dokumentów PASS. Pełne komendy/czasy: [baseline](qa/racial-development/baseline-checks.json).
- Po implementacji wspólnego modułu: 857 testów jednostkowych PASS, pełny TypeScript,
  lint (0 błędów / 13 ostrzeżeń), assets:check, build oraz dokumenty PASS.
  [Wyniki sprzed poprawki budżetu](qa/racial-development/checkpoint-checks-before-budget-fix.json).
- [4 rasy × Canvas/Software WebGL: 8 PASS](qa/racial-development/four-races-browser-first-pass.txt).
  Nowa postać → faktyczne dojście do trenera → cztery punkty trasy → wynik →
  powrót z bajtowo niezmienionym zapisem właściciela → reload. Bez wstrzykiwania postępu.
- [Regresja izolacji po Escape: 4 PASS](qa/racial-development/owner-isolation-browser.txt),
  Planetarni i Androidy, oba renderery. To późniejsza migawka kodu ze strażnikiem właściciela.
- [Emulowany dotyk Canvas: 1 PASS](qa/racial-development/touch-canvas.txt): wybór Androida
  w 390 × 844, kontrola obrotu, wejście do trenera w 852 × 393, rzeczywiste dwa
  jednoczesne kontakty dotykowe (joystick + celny atak), zwolnienie i bezpieczny powrót.
  To Chromium/CDP, **nie fizyczny Android/iOS**.
- Nowe testy logiki sprawdzają również prawdziwy obieg kontakt → obserwowany atak →
  badanie → pokonanie → praktyka, błąd zapisu i ponowienie nagrody egzaminu,
  brak powielenia, legalne osłony ras i odrzucenie utraty istniejącego rozwoju.

### Błąd bazowego PvE i trwająca regresja poprawki

Na czystej bazie odtworzono [timeout Mędrca](qa/racial-development/baseline-webgl-sage.txt).
Zachowano [stan tekstur i telemetrię](qa/racial-development/baseline-sage-resident-textures.json).
Docelowy zestaw v1 wymaga 137,963 MiB wraz z rezerwą i potworem, przekraczając 128 MiB;
loader odrzucał jego doładowanie. Ujednolicono limit do istniejących 192 MiB świata v2.
Zmieniono wyłącznie politykę budżetu, nie testy ani definicje przeciwników.
Pełny lokalny trace ma około 47 MiB i nie trafił do zwykłej historii Git:
[identyfikacja i ograniczenie trwałości](qa/racial-development/baseline-trace-location.json).
Kontrola czterech kanonicznych zdolności po poprawce jest ponawiana; nie zaliczać
jej na podstawie samego testu estymatora. Stan kolejnych kontroli będzie dopisany.

Istotna rozbieżność specyfikacji: trening siły Legendy 20 daje 114 ATK według
kanonicznej niezaokrąglonej bazy 101,4, choć przykład nowego promptu podaje 113.
Nie zmieniono aneksu; zachowano regułę obliczeń na bazie przed zaokrągleniem.

Potwierdzenie poprawki budżetu: [cztery kanoniczne zdolności w prawdziwym PvE,
Software WebGL — 4 PASS](qa/racial-development/canonical-skills-webgl-fixed.txt),
bez zmian w `e2e/fixtures.ts` ani osłabiania asercji. Rozdzielono też kontroler
próby od `examRuntime.ts`; czysta sesja nie zależy od katalogu grafiki.
Sala ładuje tylko bohatera/UI/efekty (<64 MiB zadeklarowanych tekstur każdej rasy),
nie drugi komplet dekoracji kontynentu. Nowy test zwykłego resetu drzewka potwierdza
wyłączenie wariantu bez utraty jego odkrycia. Nie zmieniano komend administratora.

Checkpoint wspólnego etapu po wydzieleniu renderera: pełny TypeScript, **864/864
testów jednostkowych**, lint 0 błędów / 13 istniejących ostrzeżeń, assets:check,
build produkcyjny, build playtest i kontrola dokumentów PASS.
[Komendy, statusy i czasy](qa/racial-development/foundation-checks.json).
Nowa końcowa migawka przeglądarkowa adaptera będzie sprawdzona na zapisanym commicie.
To checkpoint roboczy, nie ukończenie pełnego zlecenia dziedzictw.

### Korekta scenariusza multitouch, kontynuacja PR #55

Na końcowym kodzie fundamentu `5e4faedc67bccb81142a4ca8deb209ac08b47bc4`
pełny lokalny przebieg nowego scenariusza dał 9 PASS / 1 FAIL: cztery rasy i trasy
w obu rendererach przeszły, zawiódł Software WebGL w teście dotyku.
Przyczyną tego niepowodzenia był gest testowy: CDP `touchEnd` zwalnia wskazany
kontakt, więc scenariusz zwalniał joystick zamiast palca ataku. Poprawiono test,
bez zmiany sterowania gry. Dodano mocniejszą asercję rzeczywistej zmiany pozycji
po zwolnieniu ataku. Kierunek joysticka zmieniono na skośny, ponieważ poprzedni
prowadził w rzeczywistą przeszkodę sali przy (700, 360), która poprawnie blokowała ruch.
[Korekta: 2 PASS, Canvas i Software WebGL](qa/racial-development/touch-corrected-two-renderers.txt).
To nadal emulacja Chromium/CDP, nie test fizycznego telefonu.
Pełny `npm run typecheck`, `npx eslint e2e/development.spec.ts` i 48 testów
`development.test.ts` + `stream-texture-budget.test.ts` przeszły przed commitem korekty.
Nie oznacza to powtórzenia pełnej macierzy w jednym przebiegu ani ukończenia dziedzictw.

### Kontynuacja dziedzictw — runtime celów i osobiste bronie (PR #55, WIP)

Po `54d6abda746758e6cb4cd678d3852e6a22d2a070` dodano jawne definicje 24 rozdziałów
i 24 projektów wszystkich kultur, polskie dialogi/dokumenty/wybory, fizyczne
interakcje i cały transakcyjny kandydat postaci. To nie deklaracja pełnego odbioru:
eskorty/ochrona/pomiary, 48 prób, część skutków projektów/stacji, biografie, późne
spotkania, pełny balans i finały pozostają w realizacji. Zmian na tej gałęzi nie
scalono i nie opublikowano. GPU i panel administratora pozostają nietknięte.

Działające ścieżki kodu: rozmowa z odpowiedzią przy NPC, odrębne ślady, zagadka
z kontrolą kolejności, odzyskanie gwarantowanej części, receptura z agregacją
zużycia, zgody i ich historia, nazwa broni oraz kolejna czynność kowalska.
Polecenie nie może przedstawić wyniku chronionej aktywności zamiast dowodu runtime.
Próba kontroli ciosu ma rzeczywiste trafienia produkcyjnego kita i pociski,
przerwy, błędy, osobny stan poddania i bezpieczne ponowienie; 7 testów obejmuje
cztery rasy, bezczynność, atak po poddaniu, pauzę i usunięcie pocisku/celu.
Nie jest to komplet wypożyczanych prób rasowych.

Osobista broń ma jeden egzemplarz, właściciela slotu, rasę, stopień, nazwę i historię,
działa w istniejącym slocie `weapon=heritage` i przez `gear.attack`. Nie dziedziczy
premii starego miecza `upgrade`. Kowal nie może pobrać za nią opłaty starego ulepszenia.
Założenie i transfer do/z rzeczywistego depozytu używają zapisu CAS. Zmiana konfiguracji
nie leczy ani nie odtwarza kita. Domena rozwoju v2 odczytuje fundament v1; koperta
Superior v3 i historyczny zapis v7 zachowują wcześniejsze kopie i robią nowe kopie
przed zapisem. Cudza broń, nowsze pola i konflikt kart są odrzucane bez nadpisania.

Cele są osadzone w rzeczywistej stolicy Superior. Dojście używa istniejących drzwi
oraz nawigacji i poddaje się ruchowi ręcznemu. Lokalna nakładka projektu wpływa na
A*, LOS i ruch gracza/wrogów, bez mutacji kanonicznej geometrii. Obiekty i zmiany
prac mają proceduralne, **techniczne** odwzorowanie, culling i sprzątanie sceny;
ukończone projekty trafiają na dotychczasową minimapę. Pełny odbiór 24 skutków
nadal pozostaje do wykonania. Zachowano joystick, klawisze i położenie HUD.

#### Faktyczna weryfikacja tego checkpointu

- `npm run typecheck` — PASS, pełne trzy konfiguracje:
  [log](qa/racial-development/heritage-checkpoint-type.txt).
- `npm test` — **904 PASS / 67 plików**:
  [pełny log, także istniejące komunikaty jsdom/audio](qa/racial-development/heritage-checkpoint-unit.txt).
  Integracyjne fixture'y kontrolowanych map nie są dowodem przejścia całej kampanii.
- `npm run lint` — 0 błędów, 13 wcześniejszych ostrzeżeń:
  [log](qa/racial-development/heritage-checkpoint-lint.txt).
- `npm run build` i `npm run assets:check` — PASS:
  [build](qa/racial-development/heritage-checkpoint-build.txt),
  [zasoby](qa/racial-development/heritage-checkpoint-assets.txt).
- Playwright przed poprawką Pyry: **6 PASS / 2 FAIL** w 23,1 minuty, cztery rasy ×
  Canvas/Software WebGL; każdy przebieg zaczął nową postacią i ukończył stary prolog
  przez UI, bez wpisywania flag lub pozycji. Trzy rasy przeszły rozdział, broń i reload
  w obu rendererach. Oba przebiegi Legendów odrzuciły poprawny zapis po reloadzie.
  [Wynik](qa/racial-development/first-chapters-before-pyra-fix.txt),
  [identyfikacja niecommitowanego wówczas artefaktu i dużych lokalnych trace](qa/racial-development/first-chapters-before-pyra-fix.json).
  Zrzuty wyboru/nagrody i ekwipunku wszystkich czterech ras zapisano w tym katalogu;
  zrzut Legendów przed reloadem nie oznacza zaliczenia całego testu.
- Potwierdzona przyczyna Pyry: `SuperiorSaveStore` używał stałego limitu wnętrza
  960 × 760, choć kuźnia Pyry ma 540 × 1100. Teraz sprawdza `cityRoom` konkretnej rasy.
  Regresja y=900 oraz zachowanie błędnego zapisu przeszły w testach jednostkowych.
  Naprawiono też przekazywanie nawigacji zewnętrznej po odczycie postaci we wnętrzu.
  **Ponowny test przeglądarkowy poprawki będzie wykonany na nowym commicie.**
- Zdalny [Four hero WebGL run 40700487454](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40700487454)
  na fundamentowym `5e4faedc` jest czerwony: 49 PASS / 1 FAIL. `city-webgl` po
  powrocie z depozytu porównał 50 tekstur / 91 obiektów / 96 126 880 bajtów
  z 72 / 246 / 118 452 000. Przyczyna różnicy nadal wymaga odtworzenia; sam licznik
  nie dowodzi wycieku. [Log CI](qa/racial-development/ci-four-hero-foundation-failure.txt).
  Nie osłabiono asercji i nie opisano całego CI jako zielonego.
  Pełny run 40700480719 pozostaje osobną kontrolą; jego wynik trzeba odczytać.

To checkpoint do kontynuacji i przeglądu w Draft PR #55, nie zamknięcie zlecenia.
Fizycznego Androida/iOS ani stabilnego 60 FPS nie zweryfikowano.


### Kontynuacja PR #55 — pomiary, projekty i weryfikacja Pyry

Poprawka kuźni Pyry została ponownie sprawdzona na dokładnym `c2dc70f0146ae4190682e27e7d15a5fed759c425`:
**2/2 PASS**, Canvas i Software WebGL, 5,6 minuty. Scenariusz obejmował legalny
prolog, H-P01, odbiór/założenie osobistej broni i reload; nie obejmował jeszcze
rozszerzenia o P-P1. Komenda: `KI_QA_BASE_URL=http://127.0.0.1:4190 KI_QA_APP_URL=http://127.0.0.1:4190 npx playwright test e2e/development-heritage.spec.ts --grep 'legend' --workers=1 --reporter=list --output=/tmp/ki-heritage-committed-pyra-browser`.
[Log](qa/racial-development/pyra-reload-c2dc70f0.txt),
[zrzut Canvas](qa/racial-development/pyra-c2dc70f0-canvas-legend-equipped-heritage.png),
[zrzut WebGL](qa/racial-development/pyra-c2dc70f0-webgl-legend-equipped-heritage.png).
Nie łączymy tych wyników ze starszymi sześcioma PASS w jedną matrycę na wspólnym SHA.

Kolejna partia dodaje rzeczywisty kontroler pomiaru trzech celów, obserwacje bieżącego
zestawu i testy pierwszego projektu każdej kultury. Test integracyjny wykrył utratę
wybranego celu po istniejącym poleceniu ruchu; przywrócono jawnie wybrany cel próby,
bez zmiany sterowania. Wyjście oraz zatwierdzenie naprawdę zaliczonej próby nie
blokują się przez ostatni znacznik walki podczas pauzy panelu. Dodano regresję
limitu XP na poziomie 100: [uruchomienie z dawną logiką](qa/racial-development/level100-before-fix.txt)
ma 1 FAIL / 14 celowo odfiltrowanych przypadków; po eksperymencie przywrócono
identyczne bajty poprawionej implementacji. Nie jest to pominięcie w pełnej regresji.

Kontrole całego kandydata tej partii (rodzic `c2dc70f0`, przed commitem partii):
- `npm run typecheck`: PASS, [log](qa/racial-development/measurement-project-type.txt).
- `npm test`: **915 PASS / 68 plików**, [log](qa/racial-development/measurement-project-unit.txt).
- `npm run lint`: 0 błędów / 13 wcześniejszych ostrzeżeń, [log](qa/racial-development/measurement-project-lint.txt).
- `npm run build`: PASS, [log](qa/racial-development/measurement-project-build.txt).
- Rozszerzony Playwright H1 + P1 + broń + reload: **NIEWYKONANY na tym checkpointcie**,
  uruchomienie jest następnym krokiem. Testy kontrolowanych map nie dowodzą przejścia
  późnego P-N5 przez całą fabułę Androida.

Zdalny pełny run [40700480719](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40700480719)
ma wynik **cancelled**, nie PASS. Wcześniejszy run Four hero nadal ma 49 PASS / 1 FAIL
z nierozstrzygniętym licznikiem zasobów. Gałąź pozostaje Draft; bez scalenia,
publikacji, zmian panelu administratora i bez operacji na GPU.


### Zapis `a6a68d38` i kolejne rozszerzenie skanera/optyki

Partię pomiarów i pierwszych projektów wypchnięto jako
`a6a68d3800765f574655b15b044bd94e9daf1ee6`. Rozszerzony scenariusz H1 → broń → P1
→ odbiór 200 praktyki → reload przeszedł dla **4/4 ras w Canvas (7,5 minuty)**.
Komenda: `KI_QA_BASE_URL=http://127.0.0.1:4190 KI_QA_APP_URL=http://127.0.0.1:4190 npx playwright test e2e/development-heritage.spec.ts --project=gameplay --workers=1 --reporter=list --output=/tmp/ki-heritage-projects-a6a68d38`.
Testowano artefakt zbudowany z identycznych źródeł gry tej rewizji, przed jej
zapisaniem w Git; po zbudowaniu nie zmieniano plików artefaktu. Nie modyfikowano
stanu postaci w przeglądarce. [Log](qa/racial-development/first-projects-canvas-a6a68d38.txt).
Zrzuty rezultatu projektu: [Planetarni](qa/racial-development/a6a68d38-canvas-planetary-rebuilt-first-project.png),
[Mędrcy](qa/racial-development/a6a68d38-canvas-sage-rebuilt-first-project.png),
[Androidy](qa/racial-development/a6a68d38-canvas-android-rebuilt-first-project.png),
[Legendy](qa/racial-development/a6a68d38-canvas-legend-rebuilt-first-project.png),
[rzeczywista próba powstrzymania](qa/racial-development/a6a68d38-canvas-legend-real-restraint-result.png).
Software WebGL dla rozszerzonego projektu nadal wymaga osobnego przebiegu.

Następna partia dodaje fizyczną inspekcję znanej instalacji skanerem Androida
oraz naprawia rozbieżność zasięgu optyki pomiędzy strzałem a HUD/rozpoczęciem ataku.
Testy integracyjne obu poprawek: 60 PASS w 2 plikach. Pełny zestaw uruchomiony
równolegle z buildem, walidacją zasobów i Canvas zakończył się **917 PASS / 1 FAIL**:
`gpu-pipeline` przekroczył niezmieniony limit 5000 ms. Wynik pozostaje odnotowany;
powtórzenie bez równoległych ciężkich kontroli nie zmienia limitu ani asercji.


Powtórzenie bez obciążenia buildem/walidacją/Phaserem: `npm test` — **918 PASS / 68
plików, 76,44 s**. Nie zmieniono timeoutu importera. Kontrole kandydata skanera/optyki,
rodzic `a6a68d38`: [pełny zestaw PASS](qa/racial-development/scanner-optics-unit.txt),
[wcześniejsze 917/1](qa/racial-development/scanner-optics-unit-contended.txt),
[pełny TypeScript po rozszerzeniu e2e](qa/racial-development/scanner-optics-type.txt),
[lint 0 błędów / 13 ostrzeżeń](qa/racial-development/scanner-optics-lint.txt),
[build](qa/racial-development/scanner-optics-build.txt),
[assets:check](qa/racial-development/scanner-optics-assets.txt) — pozostałe PASS.
Rozszerzono Androidowy scenariusz przeglądarkowy o legalne podłączenie skanera
odblokowanego H-N01 i odczyt ukończonego P-N1; jego wynik pozostaje do wykonania.

Ponowny odczyt zdalnego `main`: `0b5ae9486914962626d8b7bbe5ce09fccbeb35ab`.
Doszły PR #53 (GM), #54 (transformacje KI), #56 (sterowanie/muzyka). Wspólne
pliki obejmują kit/base, session, HUD oraz SuperiorSaveStore; PR #55 ma aktualnie
`mergeable=CONFLICTING`, `mergeStateStatus=DIRTY`. Nie cofnięto żadnego z tych
commitów i nie modyfikowano main. Dzisiejsze testy gałęzi nie są dowodem zgodności
z nowym main; po uzgodnieniu integracji trzeba zachować nowe opcjonalne pola
statystyk GM, kontrakt transformacji i ponownie sprawdzić migracje oraz regresję.


### Spokojne dostawy — rzeczywisty ruch i trwałe punkty, PR #55

Rodzic partii `56a1fb66`. Dodano kontroler `combat=false`: NPC porusza się po
sprawdzonych ścieżkach istniejącej nawigacji, czeka na gracza, zapisuje kolejny
wspólnie osiągnięty punkt jednym CAS i wznawia od niego po reloadzie. Odcinek
przerwany śmiercią/opuszczeniem/porzuceniem nie usuwa zatwierdzonych punktów.
Źródło wyniku jest prywatne dla runtime; UI nie może dostarczyć własnego dowodu.
Nie udajemy w tym kontrolerze obrażeń eskort bojowych ani fal ochrony.

Kontrole kandydata:
- `npm test`: **928 PASS / 69 plików**, [log](qa/racial-development/delivery-unit.txt).
- `npx vitest run src/test/heritage-escort.test.ts src/test/heritage-content.test.ts src/test/heritage-runtime.test.ts src/test/heritage-restraint.test.ts src/test/heritage-measurement.test.ts`:
  **58 PASS / 5 plików** przed samą optymalizacją cache trasy;
  [log](qa/racial-development/delivery-targeted.txt). Pełne 928 PASS obejmuje cache.
- `npm run typecheck` po dodaniu scenariusza e2e: PASS,
  [log](qa/racial-development/delivery-type.txt).
- `npm run lint`: 0 błędów / 13 wcześniejszych ostrzeżeń,
  [log](qa/racial-development/delivery-lint.txt).
- `npm run build`: PASS, [log](qa/racial-development/delivery-build.txt).
- Brak zmian plików zasobów; ostatnia walidacja zasobów jest w partii `56a1fb66`.

Test kontrolera obejmuje wszystkie cztery rasy, rzeczywisty ruch przy przeszkodzie,
pauzę, porzucenie, brak nagród za punkty i odrzucenie prób bojowych. Integracja
H-V02 wykonuje faktyczne H-V01/P-V1 i dalsze czynności, brak miejsca na zapis
punktu → ponowienie → reload przy punkcie 1 → dalsza dostawa → osobista broń
stopnia 2 i odczyt. Kontrolowane fixture'y nie są dowodem pełnej rozgrywki Superior.
Nowy Playwright `heritage-delivery.spec.ts` na tym checkpointcie **NIEWYKONANY**;
ma przejść tę samą drogę przez UI od nowej postaci, z reloadem w połowie dostawy.

Bieżący, osobny przebieg ośmiu H1/P1 na dokładnym `56a1fb66` nadal trwa. Potwierdzone
cztery Canvas (także skaner Androida) i Planetarny Software WebGL; nie wpisano
wyniku pozostałych trzech z góry. [Faktyczny ekran odczytu skanera Canvas](qa/racial-development/56a1fb66-canvas-android-real-local-scanner.png).
Nie przebudowywano artefaktu tego uruchomienia podczas implementowania dostaw.


### Zamknięte przebiegi checkpointów `56a1fb66` / `924ff66f`

- Na dokładnym `56a1fb66`: **8/8 PASS**, cztery H1/P1/broń/reload w Canvas i
  Software WebGL, także podłączenie i fizyczny odczyt skanera Androida.
  Komenda: `KI_QA_BASE_URL=http://127.0.0.1:4190 KI_QA_APP_URL=http://127.0.0.1:4190 npx playwright test e2e/development-heritage.spec.ts --workers=2 --reporter=list --output=/tmp/ki-heritage-56a1fb66-browsers`.
  [Log 39,2 min](qa/racial-development/first-projects-both-56a1fb66.txt).
  Screenshoty `56a1fb66-webgl-*-rebuilt-first-project.png` w tym samym katalogu.
- Dostawy zapisano w `924ff66f89111e192c0667f9d6a13fb5f421a3f3`.
  **Pierwszy Canvas: 1 FAIL**. Trace wykazał, że wielofazowy helper nawigacji
  podążył za zmieniającymi się celami: przeszedł oba checkpointy, a następnie
  dotarł do kowala. Odczytano `step=5, sequence=0` rozmowy z kowalem, zamiast
  `step=4, sequence=1` eskorty. Nie była to utrata zapisu i nie zmieniono kodu gry.
  [Wynik](qa/racial-development/delivery-before-single-leg.txt),
  [ekran innego etapu](qa/racial-development/delivery-before-single-leg-wrong-objective.png),
  [proweniencja i SHA-256 lokalnego trace](qa/racial-development/delivery-test-provenance.json).
  Trace 314 MiB pozostaje tylko lokalny — **nie zabezpieczono go poza workspace**;
  nie dodano dużego pliku binarnego do zwykłego Git.
- Helper zatrzymuje się teraz po jednym odcinku; dodano mocniejsze sprawdzenie
  numeru etapu i checkpointu przed reloadem. Powtórzenie Canvas: **1 PASS / 4,4 min**,
  [log](qa/racial-development/delivery-single-leg-canvas.txt),
  [pierwszy punkt](qa/racial-development/924ff66f-canvas-verdantia-delivery-checkpoint-1.png),
  [drugi punkt](qa/racial-development/924ff66f-canvas-verdantia-delivery-checkpoint-2.png),
  [odebrany H-V02](qa/racial-development/924ff66f-canvas-verdantia-second-chapter-claimed.png).
  Kod gry w osobnym statycznym buildzie pochodzi z `924ff66f`; SHA-256 poprawionego
  drivera w powyższym JSON. Nie przebudowywano aktywnego artefaktu `56a1fb66`.
  Software WebGL dla dostawy na tym checkpointcie pozostaje NIEWYKONANY.
- Nowy zestaw dotykowy początkowo nie uwzględnił istniejącej blokady orientacji:
  1 FAIL / 7 NIEWYKONANYCH; przerwano dalsze przypadki po odczytaniu trace z
  `ki-rotate` przechwytującym tap. [Log](qa/racial-development/mobile-before-rotation.txt).
  Poprawiony test najpierw sprawdza ekran „Obróć telefon poziomo”, robi zrzut,
  obraca viewport i dopiero obsługuje panel. Nie wyłączono tej reguły w grze.
  Wynik: **8/8 PASS Canvas / 1,8 min**, cztery rasy × start 360×800 z obrotem do
  800×360 oraz start 852×393. Rzeczywiste tapy w cztery zakładki, brak poziomego
  overflow, zamknięcie modalu i rzeczywisty ruch CDP joystickiem bez zmiany stanu
  w JS. [Log](qa/racial-development/mobile-rotation-and-touch.txt).
  Screenshoty `924ff66f-touch-*` są w katalogu QA. To emulacja, nie fizyczny Android/iOS.

Rozszerzono testy GameSession: po H1/P1 każda rasa przechodzi własny H2, dostaje
broń stopnia 2 z zachowaniem UUID i księgi; Android odblokowuje cooling. W teście
wykorzystano istniejące odzyskiwanie części receptury, rzeczywiste ciosy prób i
ruch, bez dopisywania ukończonych rozdziałów. Pełny zestaw po tych asercjach:
**928/928 PASS**, [log](qa/racial-development/second-chapters-unit.txt).
Pełny TypeScript i lint po poprawce drivera i dodaniu testów mobilnych:
[TypeScript](qa/racial-development/regression-tests-type.txt),
[lint 0 błędów / 13 wcześniejszych ostrzeżeń](qa/racial-development/regression-tests-lint.txt).
To kolejna partia testów/dowodów, bez dalszej zmiany kodu gry po `924ff66f`.

GitHub Actions na dokładnym `924ff66f`: [run 40750159853](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40750159853)
**SUCCESS**, pełny TS + **928 unit PASS** + walidacja zasobów + lint + build oraz
**10/10 browser smoke PASS (2,4 min)**. [Log odpowiednich etapów](qa/racial-development/ci-924ff66f-smoke.txt).
Tryb `suite=smoke` celowo nie uruchamiał pełnego Playwright. Nie zastępuje starego
czerwonego Four hero ani pełnej regresji na nowym main. Nie scalono i nie opublikowano.


### Zamknięcie partii — odbiorcy obrażeń i dowody QA

Na prośbę „Kończ” zamknięto bieżącą partię bez rozpoczynania następnych dużych
kontrolerów. Baza: `1eda73940d8e5cbd7bf8d191b0134ff51ade1c2b`, osobna gałąź
`feature/racial-development-and-heritage`, [Draft PR #55](https://github.com/circus574-cpu/pixel-playground-launch/pull/55).
SHA-256 testowanego kandydata (kod, testy i konfiguracja):
[proweniencja](qa/racial-development/protected-candidate-provenance.json).
Commit zamykający obejmuje tę dokumentację i wskazane pliki; dokładny SHA widoczny
w historii PR. Nie przypisujemy nowym zmianom wyników CI starszego commita.

Dodano port odbiorców istniejącego MonsterSystem i `ProtectedActor` z rzeczywistym
HP/FX. To fundament, **nie ukończone cele ochrony/bojowej eskorty**. Jedenaście
nowych testów sprawdza kontakt wręcz, windup, pociski i ich unieważnienie, AoE,
pulsy stref, unikalność odbiorców, geometrię, cleanup, DOT i śmierć.
Próba zegara na granicy miasta najpierw wykazała oczekiwane 400 ms wobec -100 ms:
[1 FAIL / 10 odfiltrowanych](qa/racial-development/protected-city-clock-before.txt).
Poprawiono adapter gracza, przywracając dotychczasową semantykę pulsu; ochronione
ciała nadal nie mogą być rejestrowane w bezpiecznych miastach.

Końcowe lokalne kontrole tego kandydata:

- `npm run typecheck`: PASS, wszystkie konfiguracje — [log](qa/racial-development/protected-type.txt).
- `npm test`: **939/939 PASS, 70 plików, 67,90 s** — [log](qa/racial-development/protected-unit.txt).
- `npm run lint`: 0 błędów / 13 wcześniejszych ostrzeżeń — [log](qa/racial-development/protected-lint.txt).
- `npm run build`: PASS — [log](qa/racial-development/protected-build.txt).
- `npm run build:playtest`: PASS — [log](qa/racial-development/protected-playtest-build.txt).

Uzupełniono dowody wcześniej zakończonych przebiegów na dokładnym `1eda7394`:

- Prawdziwa dostawa H-V02 od nowej postaci, checkpoint/reload i broń stopnia 2:
  **1 PASS Software WebGL / 13,6 min** — [log](qa/racial-development/delivery-1eda7394-webgl.txt).
  Polecenie: `KI_QA_BASE_URL=http://127.0.0.1:4190 KI_QA_APP_URL=http://127.0.0.1:4190 npx playwright test e2e/heritage-delivery.spec.ts --project=software-webgl --workers=1 --reporter=list --output=/tmp/ki-delivery-1eda7394-webgl`.
  Zrzuty `1eda7394-webgl-*.png` w katalogu QA.
- Obsługa dotykowa panelu i ruchu wszystkich ras: **8 PASS Canvas / 2,3 min** —
  [log](qa/racial-development/mobile-1eda7394.txt). Ta sama konfiguracja adresów,
  `npx playwright test e2e/development-mobile.spec.ts --project=gameplay --workers=1 --reporter=list --output=/tmp/ki-mobile-1eda7394-canvas`.
  To emulacja dotyku, nie fizyczny Android/iOS.
- [GitHub Actions 40753633093](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40753633093):
  SUCCESS dla core i smoke; [obserwacja JSON](qa/racial-development/ci-1eda7394-observed.json).
  Pełny Playwright był pominięty przez tryb smoke. `gh run view --log` zwrócił pusty
  plik, więc nie deklarujemy nieodczytanej liczby przypadków. Nie jest to CI nowego kandydata.

Nowy `e2e/development-combat-smoke.spec.ts` wybiera każdą rasę, idzie prawdziwym
A* do rzeczywistego spawnu, klika przeciwnika i atak, wymaga spadku jego HP oraz
obrażeń gracza; brak zapisu/XP/pozycji dopisywanych przez test. Pierwszy driver
omyłkowo czytał v1 zamiast aktywnego v2 (1 FAIL / 1 przerwany / 6 niewykonanych):
[log](qa/racial-development/combat-driver-v1-before.txt). Poprawiono tylko źródło
fixture do rzeczywistych v2 arrival/navigation/spawns. Następnie Node odrzucił
import JSON bez atrybutu — 0 wykonanych testów:
[log](qa/racial-development/combat-driver-node-import-before.txt); driver używa
`readFileSync` i `JSON.parse`. Kolejny przebieg: 8 FAIL przy `goto`, ponieważ po
odtworzeniu środowiska lokalny preview był wyłączony:
[log](qa/racial-development/combat-preview-offline-before.txt).
Po ponownym uruchomieniu preview i odpowiedzi HTTP 200 wykonano nowy przebieg.
Wynik poniżej. Żadnego z tych niezaliczonych przebiegów nie oznaczono PASS.

Pełne zlecenie pozostaje **NIEUKOŃCZONE**: próby rasowe, bojowe ochrony/eskorty,
późne starcia, pozostałe rozdziały/projekty, narracja i bilans nadal wymagają pracy.
Zewnętrzne GPU jest poza zakresem tej partii; nie uruchamiano i nie modyfikowano go.
PR nadal Draft/CONFLICTING z nowszym main; nie scalono, nie opublikowano.


Końcowy przebieg kandydata: **4 PASS Software WebGL / 4 FAIL Canvas / 0 pominiętych,
9,0 min**, exit 1. [Log](qa/racial-development/protected-real-combat-browsers.txt).
Komenda: `KI_QA_BASE_URL=http://127.0.0.1:4190 KI_QA_APP_URL=http://127.0.0.1:4190 npx playwright test e2e/development-combat-smoke.spec.ts --workers=2 --reporter=list --output=/tmp/ki-protected-close-live-browsers`.
Wszystkie cztery rasy przeszły rzeczywiste wyjście z miasta, trafienie i obrażenia
bohatera w Software WebGL. Canvas zatrzymał się na asercji spadku HP potwora:
73→73, 43→43, 37→37, 61→61. Na sprawdzonym zrzucie Planetarnych żywy wybrany cel
jest dalej od postaci, a HUD pokazuje „Podejdź bliżej”. Driver idzie do punktu
spawnu, który nie musi już odpowiadać pozycji wędrującej jednostki. To obserwacja,
nie potwierdzenie przyczyny wszystkich czterech niepowodzeń. Nie dodano autochodzenia,
nie zmieniono zasięgu i nie osłabiono sprawdzenia obrażeń. Diagnostyka Canvas i
porównanie z bazowym buildem pozostają OTWARTE, nie deklarujemy braku regresji.
Screenshoty PASS/FAIL i konteksty błędów `protected-*` zapisano w katalogu QA.
[Indeks lokalnych trace z SHA-256](qa/racial-development/protected-browser-traces.json):
ZIP-y pozostają wyłącznie w workspace, bez potwierdzonej kopii zewnętrznej.
Na zamykającym commicie nie uruchomiono ponownie zdalnego CI; ostatni SUCCESS
odnosi się wyłącznie do `1eda7394`. Warunki odbioru pełnego zlecenia nie są spełnione.
