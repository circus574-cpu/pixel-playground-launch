# Zmiany — 05.11.2026

## Skupienie Mędrców — TA07/TA08/TA09

### 1. Grywalne próby Skupienia i zapis mistrzostwa

Gałąź `feature/racial-focus-trials-20261105`, baza PR #90 `a9e44175946fc11f85f823879da535de2deb3e83`.
Aktualny main sprawdzony przy rozpoczęciu: `555da1ea61f988d114d449c93c8287164d7ff6d1`.
PR #90 pozostaje nienaruszony; kontynuacja jest osobną gałęzią. Nie zmieniono świata,
grafik, prywatnego /test, hostingu, GPU ani chronionych modułów HUD v2/questów.

[Mechanika i jawne parametry sali](../../ROZWOJ-I-WALKA.md#skupienie-mędrców--kontynuacja-rozwoju-0511).
Dodano trzy próby / dziewięć stopni, odblokowanie ma-focus, podgląd stref i węzłów
w rzeczywistym Phaserze. KI/cooldown C1 i kanoniczne parametry wariantu pozostają.
Wyniki przechodzą istniejące serwerowe intencje i transakcje zapisu; nie dodano backendu.

Baza: pełny TypeScript PASS, 42/42 testów barier/transakcji/serwera/adaptacji PASS.
Pierwsze testy Skupienia: 21 PASS / 2 FAIL. Jeden fixture przekazywał ruch bez
wymaganego dt; poprawiono wejście. Drugi ujawnił kanał przerwany przed odczytem
kontrolera. Dodano sprawdzanie negatywnego potwierdzenia także poza fazą channel.
Nie usuwano ani nie osłabiano asercji. Po poprawce: 24/24 testów zachowań PASS;
287/287 testów serwera/adaptacji/kitów PASS.
Pierwszy pełny zestaw: 1352 PASS / 1 FAIL / 10 SKIP. Nowy dziennik miał tylko
nagłówek ##, a czytnik publikacji wymaga pozycji ###. Poprawiono dokument,
bez zmian w panelu administracyjnym ani asercjach. Testy pominięte wymagają
oddzielnego PostgreSQL QA. Powtórka pełnego zestawu: 1353 PASS / 0 FAIL / 10 SKIP, 110 plików PASS / 1 SKIP.
Pełny TypeScript aplikacji/e2e/tools, lint (0 błędów, 15 wcześniejszych ostrzeżeń),
assets:check, build, build:playtest i dokumentacja PASS.

Kod mechaniki wypchnięty: `ac3a79e96d455264a986a28ef3cd7534a2b72a31`.
Pierwszy browser: 3 PASS / 1 FAIL / 1 przerwana / 1 niewykonana. TA09 zaliczyła
45 s w grze, ale sterownik oczekiwał dojścia do kolejnego punktu już po zatrzymaniu
zakończonej próby. Dowód: initial-ta09-success-with-driver-failure.png oraz log.
Poprawka `85e0ab67` dotyczy tylko sterownika tej nowej próby: wysyła normalny
ruch do kolejnych punktów, nie czeka na dojście po zwycięstwie. Pełny czas, wszystkie
węzły, wynik, nagroda i odczyt po reloadzie pozostają sprawdzane. Zachowano domyślne
zachowanie/asercje helpera dla pozostałych testów. Po poprawce ponownie przeszły
pełny TypeScript i lint. Ponowiono komplet sześciu przypadków Canvas/WebGL;
końcowy wynik: **6/6 PASS** (3 Canvas, 3 Software WebGL), 6,2 minuty.
Zaliczono TA07/TA08/TA09 I rzeczywistym sterowaniem Phaser, z kontrolą renderera,
nagrody, własnych zasobów, odczytu po reloadzie i bez pageerror. Stopnie II/III
sprawdzono kontrolerami i transakcjami, nie w przeglądarce. Nie jest to pełny Playwright.
[Manifest kontroli](qa/focus-trials/verification.json), [log browser](qa/focus-trials/browser.txt).
Wyniki są przypisane do drzew ac3a79e9/85e0ab67; późniejszy commit dotyczy wyłącznie
dokumentacji i dowodów. Linki do PR i GitHub Actions znajdują się w opisie PR.

Dalszy zakres: 21 prób / 63 stopnie, cztery warianty i trzy moduły, dziedziny
w świecie, późne starcia, tytuły i pełny odbiór kampanii. Pamięć Mędrców jest następna.
Fizyczny Android/iOS i sprzętowe WebGL niezweryfikowane. Brak scalenia/publikacji.

### 2. Odtworzenie i przekazanie

Sprawdzenia: `npm run typecheck`, `npm test`, `npm run lint`, `npm run assets:check`,
`npm run build`, `npm run build:playtest`, `python3 scripts/docs/check_documentation.py`.
Nowe przypadki browser: `npx playwright test e2e/racial-trials.spec.ts --grep 'real TA0[789],' --project=gameplay --project=software-webgl`.
Logi i sumy źródeł: [QA](qa/focus-trials/source-sha256.json).

Dla kontynuującego/Claude'a: pełny Playwright/CI całego projektu i fizyczny telefon
pozostają do odbioru. Dalej wykonać Pamięć TA10–TA12 zgodnie z §7.5 oryginalnego
zlecenia. Nie zmieniać kanonicznych liczb; nie scalać/publikować automatycznie.
Przy późniejszej integracji z main połączyć ten dziennik z istniejącym dziennikiem
05.11 na main, zachowując obie historie zmian. Gałąź nie zawiera ostatnich zmian
świata/grafik z main i nie jest samodzielnym kandydatem do publikacji.
