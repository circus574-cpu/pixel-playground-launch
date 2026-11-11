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

## Domykanie rozwoju — kolejne próby

### 5. Checkpoint Kalibracji, Termiki, Tożsamości i Kontroli Żaru

Nowa gałąź od zapisanego `32ed1b9f`; nie zmieniono gałęzi PR #90 ani #138.
Dodano TN01–TN06, TN10–TN12 i TP04–TP06, każdy w trzech stopniach.
42/48 prób, 126/144 stopni. To nie koniec zadania; pozostało sześć prób Legend
oraz pozostały zakres kampanii z planu.

Kalibracja ma rzeczywiste cele/pociski/LOS, ruch 40/55/70 j./s i zakaz trafiania
chronionych celów. Profil sali jest legalny i nie przechodzi do zapisu właściciela.
Pierwszy sterownik testu nie przechodził narożnika: co tick nadpisywał trasę.
Poprawiono wyłącznie planowanie ruchu sterownika, bez zmiany geometrii i warunków.
Po poprawce Kalibracja i obieg transakcji: 25 PASS. Kontrola zasobów i transakcje:
35 PASS. Tożsamość i transakcje: 23 PASS. Zestawy współdzielą 13 testów transakcji;
nie należy sumować tych liczb jako liczby unikalnych testów.

W sali nie dodaje się Ładunku, Żaru, darmowego KI ani resetów cooldownów.
Zakresy i liczby z owner spec pozostają. Własne zasoby i statystyki nie są
profilami sali. Porównanie podpisów ma jawny rejestr ćwiczebny, nie fikcyjną
kryptografię. Ratunek jednostki przechodzi przez izolację obwodu, kopię i zasilanie
z zachowaniem pamięci. Nie dodano premii bojowej za wybór tożsamości.

Pełna regresja/browser tego checkpointu pozostaje do końca partii; wcześniejszych
wyników 1501/15 nie przypisujemy nowemu kodowi. Nowe kontrole w folderze QA tej
partii. Nie scalono do main, nie publikowano i nie zmieniono GPU ani danych świata.

Checkpoint 42: pełny TypeScript app/e2e/tools PASS, zestaw prób i transakcji
**187 PASS / 0 FAIL**, lint 0 błędów / 15 wcześniejszych ostrzeżeń.
[Stan i ograniczenia](qa/remaining-trials/checkpoint42.json),
[odciski źródeł](qa/remaining-trials/checkpoint42-source-sha256.json).
W lincie nazwa lokalnego sterownika `use` była rozpoznana jako hook React;
przemianowano ją na `performAction`, bez zmiany logiki ani asercji.

### 6. Komplet prób i warunki tytułów

Dodano TP01–TP03 oraz TP10–TP12. Katalog: **48/48 prób, 144 stopnie**.
TP01 zmniejsza prędkość wypożyczonego profilu i mierzy rzeczywistą trasę/HP.
TP02 wymaga trafienia B1 oraz wywołania prawdziwego portu niszczenia tarczy.
TP03 to 2/3/4 fale z przerwami 5 s. Próby ratunkowe korzystają z istniejącego
AI, eskorty i odbiorców obrażeń. TP12 wymaga wyboru odwrotu, fizycznego powrotu
za przeszkodę i braku LOS od pościgu; sam przycisk nie zalicza zadania.
Profil przeciwników sali 8/12/16 i limit 480 s są jawne, nie skalują świata.
Jedna standardowa mikstura nie przechodzi do własnej postaci. Miejska ochrona
pozostaje; tylko odrębna kopia świata sali bojowej nie jest miastem.

Do istniejącego mirroru online dodano aktualne ciała przeciwników próby, aby
Phaser wyświetlał serwerową walkę, nie uruchamiając lokalnego AI. Klient wysyła
wyłącznie intencje przypisane do instancji. Zapis nie zawiera obiektów sali.
Nagrody i wymagania zapisu mają wspólną politykę odblokowań. Test pełnego obiegu
wykrył pominięte przyznanie `mp-break`; usunięto rozbieżność zamiast osłabiać
walidację. Wszystkie rasy mają z prób 5400 praktyki, trzy warianty i właściwe moduły.

Dodano pochodne warunki czterech kanonicznych tytułów, odznaczenie w panelu,
wpis kroniki i powitanie przewodnika/trenera. Wymagają sześciu ukończonych
rozdziałów, sześciu projektów i wszystkich 12 prób III. Tytuł nie ma osobnego
flaga zapisu, nagrody ani premii bojowej. Budżet obliczany z katalogów:
1700+1200+5400+7500+2000 = 17 800; najdroższe dozwolone 90 stopni kosztuje 17 550.
Test warunków tytułu używa jawnej fixture logiki, nie udaje ukończenia kampanii.

Kontrole kontrolerów/transakcji/mirroru/serwera: **355 PASS / 0 FAIL**.
Pełny zestaw przed dodatkiem interfejsu tytułów: **1639 PASS / 0 FAIL / 10 SKIP**,
134 pliki PASS i 1 SKIP (PostgreSQL). Po tytułach uruchomiono osobne kontrole.
Pierwszy browser ma błędy sterownika: oczekiwanie na trafienie mimo nieaktywnego
przycisku R oraz odczyt materiałów przed renderem dialogu. Poprawiono sterownik;
nie zmieniono warunków sukcesu, liczby trafień ani asercji ochrony postaci.
Browser i integracja z nowszym main nie są jeszcze odebrane w tym checkpointcie.
[Stan](qa/remaining-trials/checkpoint48.json).

Nadal otwarte: realne interakcje dziedzin poza salą, późne warianty 21–40,
pełny przebieg kampanii i balans oraz końcowy Canvas/Software WebGL/mobile.
Zachowano development v3 i formaty 10/6, stare zapisy i CAS. Bez publikacji.
