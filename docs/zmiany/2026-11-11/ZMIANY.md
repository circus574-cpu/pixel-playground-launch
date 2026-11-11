# Zmiany — 11.11.2026

## Rozwój postaci — wspólna kontynuacja PR #90 i #122

### 1. Skupienie i Pamięć Mędrców na jednej gałęzi

Baza PR #90: `77dfb0e70a3a09729daa87e831af9781f46884fd`.
Włączona gałąź PR #122: `871183693b4d038a5e2d17100ce22200d75660aa`.
Gałąź integracji: `feature/development-focus-memory-20261111`. Oryginalnych gałęzi
nie zmieniono. Praca w osobnym worktree zachowuje robocze zmiany grafiki wysp.

Rozwiązano konflikty katalogu, wskazówek sali, panelu prób i testów serwera,
zachowując kontrolery, trzy stopnie i materiały obu partii. Dodano brakującą
etykietę dziedziny Skupienie w mapie wprowadzonej przez Pamięć. Zachowano obie
historie zmian z 05.11. Nie podmieniano nowszego świata ani grafiki.

30/48 prób, 90/144 stopni: Planetarni 12/12, Mędrcy 12/12, Androidy 3/12,
Legendy 3/12. W teście pełnego obiegu Mędrcy otrzymują teraz 5400 praktyki zamiast
4050, bo dodatkowe trzy próby to dziewięć jednorazowych nagród o sumie 1350.
Zmieniono oczekiwaną sumę testu, bez zmiany nagród produkcyjnych.

### 2. Kontrole i ograniczenia

Pierwszy pełny TypeScript wykrył brak etykiety focus; uzupełniono ją.
Pierwszy zestaw zakresu: 76 PASS / 1 FAIL (stara suma 4050 w teście Mędrców).
Poprawiono sumę na 5400 dla dwunastu prób, bez usunięcia asercji.
Dodano dwa testy łączenia zapisów: najpierw Pamięć, potem Skupienie i odwrotnie,
z rangami II, `ma-focus`, zachowaniem postępu po reloadzie i jednorazową nagrodą.

Pełny TypeScript aplikacji/e2e/tools PASS; Vitest 1501 PASS / 0 FAIL / 10 SKIP
(129 plików PASS / 1 SKIP; osobny PostgreSQL QA). Lint 0 błędów / 15 wcześniejszych
ostrzeżeń, assets:check, build, build:playtest i dokumentacja PASS.
[Raport kontroli](qa/development-integration/verification.json) oraz
[odciski kodu](qa/development-integration/source-sha256.json). Kod integracji: `67b49179290a37ce171d401544f8e4e47aff8a37`.
Końcowy browser: **12 PASS / 0 FAIL**, 6 Canvas + 6 Software WebGL,
TA07–TA12 I, 14,1 minuty. Sprawdzono własne HP/KI/XP, monety, sprzęt, przedmioty,
umiejętności, rasę, kontynent, jednorazową nagrodę i odczyt po reloadzie;
bez pageerror. II/III sprawdzają kontrolery i transakcje, nie przeglądarka.

Emulacja mobilna Canvas: **3 PASS / 0 FAIL**, 1,8 minuty: dotykowe Androidy
(obrót 390×844 -> 852×393, tapy i próba modułów) oraz TA08 I i TA12 I w układzie
852×393. To nie fizyczny telefon ani test równoczesnego sterowania dwoma kciukami.
Zachowano wszystkie asercje i limity istniejących scenariuszy; bez retry i zmian
kodu/testów po commicie mechaniki. Końcowy raport dodaje wyłącznie dokumentację,
konfigurację odtwarzania emulacji i dowody.

[Zrzut Canvas](qa/development-integration/gameplay/TA07/focus-channel-c1.png),
[Software WebGL](qa/development-integration/software-webgl/TA08/focus-ki-budget.png),
[surowy wynik browser](qa/development-integration/browser-results.json).
Pełne CI pozostaje do odbioru przez Claude’a. Workflow quality filtruje PR-y do
main; ten PR jest skierowany do gałęzi #90, więc nie uruchomił się automatycznie.
Nie utożsamiać poprzednich wyników PR #90/#122 z regresją nowej integracji.
Fizyczny telefon, sprzętowe WebGL, opublikowana sesja serwerowa i pełny
Playwright całego projektu nie stanowią części lokalnego odbioru tej partii.

### 3. Dalsza praca

Pozostaje 18 prób / 54 stopnie Androidów i Legend, cztery warianty i trzy moduły,
interakcje dziedzin w świecie, późne starcia, tytuły, pełny graf i balans.
Komplet prób Mędrców nie oznacza ukończonych rozdziałów, projektów i sześciu etapów
broni w pełnej kampanii. Integrację z nowszym main trzeba wykonać oddzielnie;
kontynuacja opiera się na bazie PR #90. Nie wykonano merge do main ani publikacji.

### 4. Zapis i przekazanie

[Draft PR #138](https://github.com/circus574-cpu/pixel-playground-launch/pull/138)
jest skierowany do `feature/complete-character-development`. Zawiera historię
obu partii i rozwiązania konfliktów, bez zmiany gałęzi źródłowych.
Stan docelowego main nie jest wynikiem tych testów. Przed przyszłym wydaniem
trzeba osobno zintegrować nowszy main i wykonać pełną regresję.

Odtwarzanie: `npm run typecheck`, `npm test`, `npm run lint`, `npm run assets:check`,
`npm run build`, `npm run build:playtest`, `python3 scripts/docs/check_documentation.py`.
Browser: `npx playwright test e2e/racial-trials.spec.ts --grep 'real TA(07|08|09|10|11|12),' --project=gameplay --project=software-webgl`.
Emulacja: `npx playwright test --config docs/zmiany/2026-11-11/qa/development-integration/mobile.config.ts --grep 'real TA(08|12),|touch racial trial'`.
Użyto lokalnego preview na 4194 przez `KI_QA_BASE_URL` i pominięto aplikacyjny
serwer QA przez `KI_QA_APP_URL`. JSON emulacji: `/tmp/development-mobile-results.json`.
W odtwarzalnej konfiguracji ujednoznaczniono wyłącznie katalog wyjściowy, aby
kolejne przebiegi nie zapisywały plików roboczych wewnątrz dokumentacji.
