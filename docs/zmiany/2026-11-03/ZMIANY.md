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


## Audyt kompletności rozwoju postaci — 03.11.2026

### Wniosek i zakres

**Pełne zlecenie rozwoju czterech ras nie jest ukończone.** Zweryfikowano
`main@139834679f4618fdfc343c93060f479b1b98b71d` oraz źródło właściciela
`docs/design/racial-development-owner-2026-10-28.txt`, SHA-256
`03ea87f725815adab2d74cba84da87a52adfc5cd650600c6a3202f68742359ed`.
Raport rozróżnia implementację, definicje w katalogu i rzeczywiście wykonane testy.
Audyt nie zmienia gry, balansu, zapisów graczy, hostingu ani GPU.

### Co powstało wcześniej i co później uzupełniono

Wcześniejsza implementacja rozwoju: `5e4faedc` (trening/egzaminy), `c2dc70f0`
(dziedzictwa/bronie), `a6a68d38` (pomiary/projekty), `56a1fb66` (skaner),
`924ff66f` (spokojne dostawy), `b63e1f51` (odbiorcy obrażeń), `c9360483`
(Unik / szybkość ataku / Technika), integracja `5cea48da` / PR #62.

Późniejsze dostawy innych wykonawców obejmują `43ea5862`, `078dfdba`,
`c7c3e2a0`, `f60dde70`, `492bc2f8`, `f8dff1d8` (grafiki treningu),
`2866499c` (audio), `93d38fc2` / `99dd12e1` (ekwipunek/depozyt) oraz
`4110e52e` / `2b0e4d3a` (panel postaci/statystyki). Prace serwerowe PR #69 oraz
późniejsze PR #76/77/79/86 zapewniają nowszy kontekst kont, zapisów i administracji;
nie dostarczają brakujących prób rasowych. Nie przypisano sobie tych dostaw.
Historia `src/game/development/heritage/runtime.ts` nadal kończy się na implementacji
spokojnych dostaw z 28.10. Nie znaleziono późniejszego wdrożenia kompletnego
systemu rozwoju na końcówkach przejrzanych gałęzi. Gałąź
`origin/docs/development-plan-20261101` (`80bdf119`) zawiera plan dokumentacyjny,
a nie implementację brakującego systemu.

### Wymagania a obecny kod

| Obszar | Potwierdzony stan |
| --- | --- |
| 5 dyscyplin, stopnie 0–30, suma 90 | Koszty, limity, reset i wpływ na statystyki istnieją. Pełna osiągalność 90 stopni ma blokadę ekonomii opisaną poniżej. |
| 30 egzaminów wspólnych | 30 definicji, 5 rodzajów aktywności i izolowane `GameSession`. Nie wykonano świeżego E2E wszystkich 30 progów dla 4 ras. To osobny system od 48 prób rasowych. |
| Unik, szybkość ataku, Technika | Trening, skutki w walce i podgląd parametrów istnieją. Nie rosną automatycznie od poziomu. Integracja bonusów przedmiotów ma potwierdzone błędy. |
| Dziedzictwo | 24 definicje rozdziałów i 24 projektów, transakcje, wybory, efekty lokalne, pierwsze rozdziały i spokojne dostawy. Pełne ścieżki zawierają nieobsługiwane cele. |
| Próby rasowe | Brak kompletu TV/TA/TN/TP01–12, kontrolerów 144 stopni i zapisu ich wyników/nagród. Stan rozwoju ma 30 ID egzaminów, ale nie ma wyników prób rasowych ani stopni dziedzin. |
| 12 mistrzowskich wariantów | Efekty, kompromisy i przełączanie istnieją. Brak normalnej ścieżki odblokowania: `unlockedVariants` jest domyślnie puste, runtime nie dodaje wariantów. |
| 6 modułów Androida | 6 definicji, efekty, limity 3 gniazd / 10 energii. Odblokowywane są tylko skaner (H-N01) i chłodzenie (H-N02 + P-N1). Brakuje odblokowań optyki, osłony, precyzji i przekierowania. |
| 4 bronie osobiste | Jest instancja/właściciel, ATK 8/10/12/14/16/18, nazwanie, wyposażanie i depozyt. Pełna droga do etapu 6 jest zablokowana w każdej rasie. |
| Bestiariusz 40 gatunków | Jest widoczność, obserwacja ataku, ślad, zabójstwo i jednorazowe 50 praktyki. Brak kompletu indywidualnych wyzwań gatunków i późnych wypraw z pierwotnego zakresu. |
| Treść poziomów 21–40 | Brak osobnego zestawu `developmentEncounters` z 32 nowymi wariantami i pełnych późnych wypraw. Istniejący bossowie i labirynty nie zastępują tego wymagania. |
| Narracja i zakończenia | Są dialogi, dokumenty i zapisy wyborów w katalogu. Brak kompletnego systemu 4 biografii po 500–800 słów, odkrywanych kronik, stopni dziedzin i finałowych tytułów zależnych od prób III. |
| Oprawa Etapu 1 | Potwierdzono 46 grafik i 41 plików audio oraz ich sumy SHA-256. Grafiki treningowe nadal wymagają `?ki-dev-art=1`; test oczekuje wyłączenia przy pustym URL. Część podstawowych dźwięków ma starsze odpowiedniki, więc nie oznacza to wyłączenia całego audio. Nie wykonano pełnego odsłuchu i odbioru artystycznego. |

Główne źródła kodu:

- [trening i egzaminy](../../../src/game/development/training.ts),
  [aktywny egzamin](../../../src/game/development/exams.ts);
- [stan i walidacja](../../../src/game/development/state.ts),
  [modyfikatory wariantów/modułów](../../../src/game/development/modifiers.ts);
- [katalog rozdziałów i projektów](../../../src/game/development/heritage/catalog.ts),
  [kontroler aktywności](../../../src/game/development/heritage/runtime.ts),
  [wymagane dowody ukończenia](../../../src/game/development/heritage/reducer.ts);
- [statystyki i komendy sesji](../../../src/game/session.ts),
  [kontrakt wyposażenia](../../../src/game/kit/types.ts);
- [przełącznik oprawy](../../../src/game/development/developmentAssets.ts),
  [test plików i sum kontrolnych](../../../src/test/development-etap1-assets.test.ts).

### Konkretne blokady każdej rasy

| Rasa | Pierwszy pewny nieobsługiwany cel | Konsekwencja |
| --- | --- | --- |
| Planetarni | `H-V03:messenger` — eskorta bojowa | Rozdział 3 i kolejne oraz pełna broń na etapie 6 są nieosiągalne zwykłą ścieżką. |
| Mędrcy | `H-A05:handoff` — eskorta bojowa | Rozdział 5 i finał zablokowane; H-A06 ma także cel ochrony. |
| Androidy | `H-N03:escort` — eskorta bojowa | Rozdział 3 i kolejne oraz późne projekty niezamknięte. |
| Legendy | `H-P06:retreat` — ochrona | Finał i broń na etapie 6 zablokowane. |

`HeritageRuntime.command()` tworzy `MeasurementActivity`, `EscortActivity` tylko z
`combat=false` i `RestraintActivity`. Dla pozostałych aktywności zwraca komunikat
o innym rodzaju próby. Reducer wymaga zatwierdzonego wyniku ochrony/eskorty bojowej,
którego runtime nie wytwarza. `ProtectedActor` jest fundamentem odbioru obrażeń;
poza swoim modułem ma użycia jedynie w testach. Brakuje podłączenia kontrolera
fal/ochrony dedykowanych aktorów zadania. Nie oznacza to, że zwykłe miejskie NPC
powinny być celami potworów.

Brak tej konkretnej blokady we wcześniejszym rozdziale nie jest dowodem, że cały
rozdział został ukończony w aktualnej przeglądarce. Tabela wskazuje pewne blokady,
a nie zaliczenie wszystkich wcześniejszych etapów.

### Skutek dla ekonomii praktyki

Zlecenie przewiduje 17 800 praktyki; maksymalizacja trzech dyscyplin kosztuje 17 550.
Brak 12 prób po 3 stopnie usuwa 5400 praktyki z przewidzianej ścieżki jednej rasy.
Nawet suma wszystkich istniejących definicji rozdziałów/projektów, wszystkich
30 egzaminów i 40 badań wynosi tylko 12 400. Nie wszystkie definicje są osiągalne.

Statyczny graf zależności, uwzględniający powyższe blokady, daje optymistyczne
pułapy: Planetarni 10 250, Mędrcy 11 200, Androidy 10 250, Legendy 11 950 praktyki.
To górne granice, zakładające sukces wszystkich pozostałych aktywności;
nie są wynikiem przejścia kampanii. Najtańszy dowolny rozkład 90 stopni
(5 × 18) kosztuje 12 150. Nawet te optymistyczne pułapy nie zapewniają 90 stopni.
Dalsze przeszkody mogą je obniżyć. Nie odnaleziono dodatkowego normalnego źródła
praktyki poza egzaminami, wiedzą i dziedzictwem.
Szczegóły: [graf i liczby](qa/progression-audit/catalogue-and-blockers.json).
Obliczenia można powtórzyć:
`npx tsx docs/zmiany/2026-11-03/qa/progression-audit/audit-catalogue.mjs`
([skrypt](qa/progression-audit/audit-catalogue.mjs)).

### Nowe potwierdzone błędy bonusów wyposażenia

Odtworzono przez produkcyjną klasę `GameSession` i polecenie `equip`, z jawnymi
warunkami izolowanego testu: przedmiot w torbie i wymagany poziom postaci.
Nie manipulowano kontem ani zapisem produkcyjnym; to test naliczania bonusu,
nie zdobycia przedmiotu.

- **A-V1 Kamizelka Leśnego Pąka:** deklaruje `hpBonus: 40` i `maxHpPercent: 8`;
  rzeczywista zmiana maksymalnego HP wynosi **0**.
- **A-A1 Szata Ucznia Chmur:** `kiBonus: 50` / `maxKiPercent: 7`;
  rzeczywista zmiana maksymalnego KI wynosi **0**.
- **A-V3 Płaszcz Zielonego Wędrowca:** `moveSpeedPercent: 2`; ruch bez zmiany,
  `attackSpeedPct` wzrasta o **4** (bonus dodany wprost i ponownie z kalkulatora).
- **U-W03 Pryzmat Archiwum Wiatru:** pola krytyka trafiają do Techniki (**+12**),
  wzrost szansy krytyka wynosi **0,6 p.p.** Dodatkowo uruchamia to skutki Techniki
  dla obrażeń KI i ponowienia umiejętności bez cooldownu.

Przyczyna: `session.ts/equipmentStats()` i ograniczony kontrakt `KitPort.gear`.
HP/KI i inne bonusy katalogu nie docierają do obliczeń; ruch i krytyk trafiają do
innych parametrów. W audycie nie zmieniano wzorów ani balansu.

Reprodukcja:
`npx tsx docs/zmiany/2026-11-03/qa/progression-audit/reproduce-item-statistics.mjs`.
[Skrypt](qa/progression-audit/reproduce-item-statistics.mjs) i
[wynik](qa/progression-audit/item-stats-observation.json).

### Weryfikacja wykonana 03.11

- `npm run typecheck`: **PASS**, wszystkie 3 konfiguracje na `13983467`.
- `npm test`: **1088 PASS / 0 FAIL / 10 SKIP**,
  96 plików zaliczonych / 1 pominięty. 10 testów kont wymaga
  `KI_ACCOUNTS_TEST_DATABASE_URL`; nie uruchamiano dodatkowej bazy.
  Log zawiera istniejące komunikaty jsdom o nieobsługiwanym `HTMLMediaElement.play`;
  testy jednostkowe nie są potwierdzeniem poprawnego audio w przeglądarce.
- Celowane testy rozwoju/dziedzictwa/serwera/statystyk: **136 PASS w 11 plikach**,
  na pierwszej bazie `c2ff3202`; nowszy `13983467` nie zmienił kodu rozwoju i został
  objęty powyższym pełnym testem.
- `npx vitest run src/test/development-etap1-assets.test.ts`:
  **4 PASS** na `13983467` (pliki, pochodzenie, sumy SHA-256).
- Cztery odtwarzalne przypadki błędnego bonusu: potwierdzone, pozostają otwarte.
- **NIEWYKONANE:** pełna kampania, 48 prób / 144 stopnie, finały 4 ras w Playwright,
  fizyczny Android/iOS, pomiary czasu rozwoju 1–40 i pełnego balansu.
  Brakujące kontrolery nie pozwalają potwierdzić ukończenia tych ścieżek.
- Build i lint całej gry nie były powtarzane dla tej zmiany dokumentacyjnej;
  nie zmieniono kodu runtime. Kontrola dokumentacji jest zapisana w dowodach audytu.

[Metadane kontroli](qa/progression-audit/verification.json),
[log jednostkowych](qa/progression-audit/unit-tests.log),
[log typów](qa/progression-audit/typecheck.log).

### Kolejność domknięcia

1. Naprawić przekazywanie bonusów przedmiotów do prawdziwych statystyk;
   dodać regresje HP/KI/ruch/krytyk, bez cichej zmiany kanonu ras.
2. Podłączyć eskorty bojowe, ochronę i fale do istniejących odbiorców obrażeń;
   wykonać zwykłymi komendami przejścia blokowanych rozdziałów każdej rasy.
3. Wdrożyć 48 prób ze 144 ocenami, zapis wyników i jednorazowych nagród,
   odblokowania dziedzin, wszystkich 12 wariantów i brakujących 4 modułów;
   zamknąć budżet 17 800 praktyki.
4. Zakończyć bronie na etapie 6, projekty, biografie/kroniki/tytuły
   i 32 późne warianty starć.
5. Wykonać E2E początku i finału 4 ras bez obchodzenia rozgrywki, pełny graf
   osiągalności i pomiary balansu/czasu. Dopiero te wyniki mogą zamknąć zlecenie.

## Domykanie rozwoju — partia 1: statystyki wyposażenia

Gałąź `feature/complete-character-development`, baza kodu `main@13983467`
i audyt `c7e08168`. Właściciel zlecił domknięcie całego systemu rozwoju, fabuł
oraz oprawy. Ta partia naprawia naliczanie wyposażenia; **nie jest ukończeniem
całego zlecenia**. Pozostałe blokady z audytu nadal wymagają implementacji.
Nie opublikowano gry ani nie scalono gałęzi.

### Implementacja

- Rozszerzono `KitPort.gear` o istniejący kontrakt `ItemStats`. HP, KI,
  regeneracja, ruch, koszty KI i redukcja obrażeń docierają do prawdziwego kitu.
- Capped procenty ATK/DEF są liczone od rasy/poziomu/drzewka/treningu,
  nie tylko od wartości samej broni/pancerza. Kanoniczne pliki ras nie zmieniają się.
- Prędkość ruchu nie zmienia szybkości ataku. Krytyk daje punkty procentowe,
  nie Techniki; nie przyznaje przy okazji obrażeń KI ani ponowienia umiejętności.
- Obowiązują procenty i limity istniejącego kalkulatora pasywnego. Dla HP/KI,
  ruchu i krytyka obecność nowego pola zastępuje historyczną reprezentację tej
  samej premii, zapobiegając podwójnemu doliczeniu. Historyczne płaskie HP/KI
  i mnożnik ruchu pozostają fallbackiem, gdy nowego pola nie ma.
- Unikalne ID wyposażenia są liczone raz. Bonus regeneracji HP zwiększa tempo
  regeneracji, a nie dodaje procentu pełnego zdrowia na sekundę.
- Zakładanie, zmiana i zdejmowanie sprzętu zachowują proporcję HP/KI.
  Nie można odzyskiwać zasobów przez powtarzanie zmiany pancerza/szaty.
- Podgląd statystyk korzysta z tych samych obliczeń: premia przedmiotu jest
  osobną różnicą pomiędzy warstwami, zgodnie z dotychczasowym układem panelu.
- Bez zmiany formatu zapisów, sterowania, geometrii, cen, plików generated i GPU.

### Dowody i ograniczenia

Dodano 20 regresji (5 scenariuszy dla każdej rasy): HP, KI/regeneracja,
ruch/szybkość ataku, krytyk/Technika oraz 12 cykli zmiany wyposażenia bez leczenia.
Jawne warunki jednostkowe zapewniają przedmiot i wymagany poziom; testy nie są
przejściem kampanii ani dowodem zdobycia przedmiotu przez gracza.

- [Wyniki po naprawie](qa/progression-equipment/item-statistics-after.json).
- [TypeScript](qa/progression-equipment/typecheck.txt): PASS, wszystkie 3 konfiguracje.
- [Testy celowane](qa/progression-equipment/targeted-tests.txt): 76 PASS.
- [Pełny zestaw jednostkowy](qa/progression-equipment/unit-tests.txt):
  1108 PASS / 0 FAIL / 10 SKIP (testowa baza PostgreSQL niedostępna).
  [Metadane i SHA-256 testowanych źródeł](qa/progression-equipment/verification.json).
- [Lint całego projektu](qa/progression-equipment/lint.txt): 0 błędów / 15 istniejących ostrzeżeń.
- [Build produkcyjny](qa/progression-equipment/build.txt): PASS.
- [Canvas — okno statystyk](qa/progression-equipment/browser-canvas.txt): 4 PASS,
  wszystkie rasy, otwarcie/zamknięcie i odświeżenie, emulacja dotyku;
  widoki 1280×720, 390×844, 360×800 i 852×393 (z obecną wymaganą rotacją pionu).
- [Software WebGL — okno statystyk](qa/progression-equipment/browser-webgl.txt):
  4 PASS dla tych samych ras i widoków, SwiftShader.
- To nie jest test na fizycznym telefonie ani odbiór całej kampanii.

### Dalsza realizacja

Następna partia musi usunąć blokady eskort bojowych i ochrony H-V03/H-A05/H-N03/H-P06,
korzystając z `ProtectedActor`, faktycznych obrażeń, nawigacji poza miastami,
punktów wznowienia i czyszczenia aktorów/przeciwników przy śmierci/zmianie świata.
Nie zastępować tych celów kliknięciem „zalicz”. Dalej: 48 prób / 144 stopnie,
zapis dowodów i jednorazowych nagród, odblokowania, budżet praktyki, zakończenia,
biografie i kronika. Zamówienie pozostaje otwarte do pełnego odbioru tych ścieżek.
