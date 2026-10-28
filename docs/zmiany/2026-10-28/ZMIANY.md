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
