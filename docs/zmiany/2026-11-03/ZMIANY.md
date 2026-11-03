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

## Domykanie rozwoju — partia 2: eskorty, obrona i kronika

Kontynuacja na `feature/complete-character-development`, po `b7d41ffe`, PR #90.
**Nie jest to zamknięcie całego systemu mistrzostwa.** Wdrożono brakujące kontrolery
rozdziałów i prywatną kronikę. Próby rasowe, dziedziny, ich odblokowania i późne
warianty starć pozostają oddzielnymi, niezrealizowanymi wymaganiami.
Bez scalenia, publikacji, zmian produkcyjnej bazy ani używania GPU.
Przyszłe wdrożenie musi objąć klienta i proces serwera gry z tego samego wydania;
sam nowy frontend nie doda kontrolerów do starego serwera. Nie potrzeba migracji DDL.

### Rzeczywiste aktywności bojowe

- `HeritageEncounter` tworzy ograniczone spotkanie na istniejącej nawigacji i AI.
  To osobny aktor zadania `ProtectedActor`, a nie zwykły NPC miejski.
  Rejestracja i punkty trasy wymagają terenu poza miastem i aktualnych kolizji.
- `EscortActivity` obsługuje teraz eskortę bojową. Przed kolejnym odcinkiem trzeba
  pokonać rzeczywistą falę, a podopieczny musi zachować minimum zdrowia z definicji.
  Punkt wymaga fizycznej obecności gracza, widoczności i zatwierdzonego wyniku walki.
  Samo czekanie, dojście do celu lub kliknięcie nie zalicza walki.
- `ProtectionActivity` broni kolejnych węzłów. Liczba punktów/fal i próg HP pochodzą
  z katalogu zadań. Każdy ukończony punkt zapisuje się transakcyjnie i można go wznowić
  po ponownym wczytaniu. Nie dodano pola ani numeru wersji zapisu.
- Odebranie nagrody nadal przechodzi przez istniejące jednorazowe receipts rozdziału.
  Tymczasowi przeciwnicy nie dają powtarzalnego XP/łupów ani postępu innych zadań;
  kanoniczne bojowe pasywy `kit.onKill` pozostają aktywne.
- Przeciwnicy i ich przywołane jednostki mają znacznik właściciela spotkania.
  Są usuwani razem z rejestracją celu i efektami przy przerwaniu, śmierci lub zmianie
  świata. Nie trafiają do zapisanych slotów zwykłych spawnów Superior.
- Profile spotkań są stałe dla rozdziału, korzystają z istniejących potworów
  poziomów 1/4/8/12/16/20. Trwałość celu: 4 × HP wybranego profilu, jego DEF.
  To jawny profil techniczny aktywności, bez zmiany bazowych ras/potworów.
  **Nie zastępuje wymaganych 32 nowych wariantów poziomów 22/28/34/40 ani odbioru balansu finałów.**

### Naprawy wykryte podczas przejść

1. Finał Legend H-P06 zaczyna się sprawdzaniem projektów, które nie miało fizycznego
   miejsca przyjęcia. Binding instruktażu wskazuje teraz rzeczywistego przewodnika.
   Zachowano kolejność celów i indeksy już zapisanych postępów.
2. Śmierć przeciwnika zadania czyści trasę pościgu, tak samo jak zwykła walka.
   Postać przestaje odchodzić w stronę poprzedniego celu po jego pokonaniu.
3. Przycisk podejścia do celu działa również podczas walki. Nie umożliwia wtedy
   rzemiosła, odbioru nagrody ani tworzenia dowodu ukończenia.
4. Bezpieczne miasto chroni gracza, lecz nie zamraża AI atakującego chroniony obiekt
   poza miastem. Test sprawdza rzeczywiste obrażenia podopiecznego i bezpieczeństwo bohatera.
5. Ruch podopiecznego uwzględnia kolizje, korzenie/ogłuszenia i spowolnienia.
6. Po zaliczeniu eskorty/obrony znika panel aktywności; zostaje krótki komunikat
   istniejącego systemu powiadomień, zamiast trwałej podpowiedzi nad światem.
7. Osobista broń synchronizuje teraz pole broni, slot ekwipunku i torbę. Zamiana
   zachowuje proporcję HP/KI, a awaria zapisu nie zmienia gracza. Pełna torba blokuje
   zamianę bez utraty przedmiotu; zdjęcie osobistej broni odzyskuje także zwykły
   przedmiot pozostawiony w slocie przez starszy błąd. Usunięto zagnieżdżoną transakcję
   przy powrocie do zwykłej broni, która odłączała aktualne referencje torby/slotu.
   [Odtworzenie: 4 FAIL przed naprawą](qa/heritage-combat/weapon-swap-before.txt),
   [regresja po naprawie](qa/heritage-combat/weapon-swap-after.txt).

### Historia dostępna w grze

Zakładka **Kronika** jest częścią istniejącego okna rozwoju. Czyta zapis postaci,
nie przyznaje nagród. Pokazuje tylko ukończone własne rozdziały, świadectwa rozmówców
oraz faktycznie wybraną decyzję. Fragmenty tła odblokowują się po rozdziałach 2/4/6.
Tło jest niezmienionym tekstem właściciela z sekcji 6.1–9.1 źródła 28.10;
świadectwa i zakończenia pochodzą z kanonicznego katalogu dziedzictwa.
Nie ujawnia się finału nowej postaci ani nie przyznaje tytułu wymagającego prób III.

Łączna odblokowana opowieść (tło + wstępy + świadectwa + zapisane decyzje), bez
liczenia etykiet UI, obejmuje dla każdej kombinacji wyborów:

| Rasa | Liczba słów |
| --- | --- |
| Planetarni | 659–679 |
| Mędrcy | 571–585 |
| Androidy | 570–576 |
| Legendy | 619–632 |

Nie utworzono nowych ilustracji: zachowano istniejące postacie i zasoby.
Towarzysz używa obecnej animacji NPC; węzeł ma tymczasowy symbol KI z paskiem HP.
Renderer odczytuje aktywność serwera, buforuje odczyt przez 100 ms, stosuje culling
900 jednostek i ponownie wykorzystuje obiekty. Nie zmieniono sterowania ani pozycji HUD.
Ukryto jedynie pozorne „0 s” dla aktywności bez timera.

### Dowody, zakres testów i ograniczenia

- Kontrolowane integracje `GameSession`: **24 rozdziały + 24 projekty**, sześć etapów
  broni każdej rasy, 2900 praktyki dziedzictwa, zapis/odczyt kroniki i wznowienia
  eskorty/ochrony po pierwszym zapisanym punkcie.
- Warunki tych testów to jawny profil poziomu 40 i kontrolowana geometria.
  Android odwiedza Verdantię przez kontrolowany adapter ponownego załadowania świata.
  **To nie jest przejście poziomów 1–40 ani test podróży przez rzeczywisty portal w przeglądarce.**
- Cztery integracje z prawdziwymi danymi Superior weryfikują teren, kolizje, trasy,
  możliwość utworzenia fali, odrzucenie podrobionego wyniku i brak zapisu tymczasowych
  przeciwników w trwałych spawnach serwera.
- 12 testów kroniki sprawdza brak spoilerów, zgodność zapisanej decyzji, brak mutacji,
  pochodzenie tekstu i zakres 500–800 słów przy dowolnej kombinacji wyborów.
- Pełne wyniki, polecenia, ograniczenia i sumy testowanych źródeł:
  [metadane](qa/heritage-combat/verification.json).
- [Jednostkowe](qa/heritage-combat/unit-tests.txt),
  [typy](qa/heritage-combat/typecheck.txt), [lint](qa/heritage-combat/lint.txt),
  [build](qa/heritage-combat/build.txt).
- [Dotykowa kronika Canvas](qa/heritage-combat/chronicle-canvas.txt),
  [Software WebGL](qa/heritage-combat/chronicle-webgl.txt): rzeczywisty typ renderera
  sprawdzany przez telemetrię. To emulacja dotyku w Chromium, nie fizyczny Android/iOS.

Przykładowe rzeczywiste zrzuty kroniki nowej postaci:
[Planetarni](qa/heritage-combat/planetary-chronicle.png),
[Mędrcy](qa/heritage-combat/sage-chronicle.png),
[Androidy](qa/heritage-combat/android-chronicle.png),
[Legendy](qa/heritage-combat/legend-chronicle.png).

Pierwsza próba starszego E2E dziedzictwa została przerwana po HMR zamykającym okno
lokalnego podglądu. Nie uznano jej za PASS ani dowód błędu gry. Zachowano
[wyciąg zdarzeń](qa/heritage-combat/interrupted-call-log.json) i
[zrzut](qa/heritage-combat/interrupted-browser.png). Surowe zasoby trace zajęły
1,1 GiB i wyczerpały dysk; usunięto wyłącznie własne wygenerowane trace oraz build
po zapisaniu wyników. Ponowna próba używa logów i screenshotów, bez pełnego trace.
Pierwsza powtórka wykryła błąd nowego selektora testu: dokładny tekst decyzji
pomijał widoczny prefiks „Twój zapis:”. Na zrzucie gra pokazywała właściwą decyzję.
Selektor sprawdza teraz pełny dokładny tekst wraz z prefiksem; nie osłabiono
sprawdzania treści. [Log](qa/heritage-combat/browser-selector-failure.txt),
[zrzut](qa/heritage-combat/earned-chronicle-selector-failure.png).

Końcowe kontrole tej partii: **1143 PASS / 0 FAIL / 10 SKIP** w `npm test`.
Dziesięć pominiętych testów wymaga osobnej testowej bazy PostgreSQL
(`KI_ACCOUNTS_TEST_DATABASE_URL`); nie uruchamiano dodatkowej infrastruktury.
Pełny TypeScript (trzy konfiguracje), build i lint zaliczone; lint zachowuje
15 wcześniejszych ostrzeżeń, bez błędów. Ostatnie zmiany testu/configu przeszły
dodatkowo osobne wywołanie ESLint.

W przeglądarce zaliczono **9 scenariuszy**: cztery kroniki nowych postaci Canvas,
cztery Software WebGL oraz rzeczywisty pierwszy rozdział/projekt/założenie broni,
odkrytą decyzję w kronice i odświeżenie Planetarnego
([log](qa/heritage-combat/earned-chronicle-canvas.txt),
[odkryta kronika](qa/heritage-combat/planetary-earned-chronicle.png),
[wyposażenie](qa/heritage-combat/planetary-equipped-heritage.png)).
Wszystkie te scenariusze sprawdzają również brak `pageerror`.
Pełny Playwright repozytorium nie został wykonany. Testy źródeł sprzed commita
identyfikują sumy SHA-256 w metadanych, zamiast nieistniejącego SHA przyszłego commita.

Powtórka standardowego projektu `software-webgl` ujawniła też błędne oczekiwanie
testu (Canvas przy rzeczywistym WebGL). Poprawiono sprawdzanie nazwy projektu,
zachowując asercję rzeczywistego renderera
([niezaliczony log](qa/heritage-combat/renderer-expectation-failure.txt)).
Kolejna próba po wznowieniu sesji miała niedostępny lokalny Vite
([log](qa/heritage-combat/preview-connection-failure.txt)); uruchomienie lokalnego
podglądu przywróciło testy. Końcowy standardowy przebieg Software WebGL: **4/4 PASS**.
Nie zmieniano w tych powtórkach logiki gry i nie zaliczano awarii środowiska jako PASS.

### Co dalej

Kontrolery usuwają wskazane blokady H-V03/H-A05/H-N03/H-P06. Ukończenie wszystkich
zdefiniowanych rozdziałów/projektów dostarcza 2900 praktyki. Przy założeniu wszystkich
30 egzaminów i 40 badań katalogowy budżet bez prób rasowych wynosi 12 400;
brakuje 5400 do wymaganych 17 800. Nie obowiązują już wcześniejsze pułapy wynikające
z braku kontrolerów. Nadal brakuje 48 prób / 144 stopni, stopni dziedzin,
normalnych odblokowań 12 wariantów i 4 modułów, tytułów za próby III oraz późnych
wariantów starć. Pełna kampania na produkcyjnym koncie, balanse/czas rozwoju,
fizyczne telefony i odbiór wszystkich finałów w Phaserze pozostają do sprawdzenia.


## Korekta zasobów wyposażenia — zgodność z zleceniem

Kontrola po `a547cc8b` wykryła błąd mojej wcześniejszej implementacji: zachowanie
**procentu** HP/KI zapobiegało powtarzalnemu odzyskiwaniu po pełnym cyklu zmiany,
lecz samo założenie przedmiotu podnosiło bieżący zasób wraz z maksimum. To było
niezgodne z §3.1 niezmienionego zlecenia właściciela:

> Przy spadku maksimum jedynie ogranicz aktualny zasób do nowego maksimum;
> wzrost maksimum nie podnosi aktualnego zasobu.

Ta sekcja koryguje wcześniejsze deklaracje o proporcjach w partiach 1 i 2; nie
zmienia historii tych commitów. Nowe testy odtwarzają **24 FAIL** w czterech rasach:
HP i KI zranione/pełne, spadek maksimum i ponowne założenie. Poszerzony zestaw
z wcześniej istniejącymi testami: **36 FAIL / 33 PASS** przed korektą.
[24 przypadki](qa/resource-policy/before-24.txt),
[pełna reprodukcja](qa/resource-policy/before-expanded.txt).

Implementacja stosuje wyłącznie `min(bieżący zasób, nowe maksimum)` zarówno przy
zwykłej zmianie sprzętu, jak i transakcyjnej zmianie osobistej broni. Nie skaluje
bieżącego zasobu, nie odnawia HP/KI ani nie resetuje kitu i jego cooldownów.
Istniejące testy sprawdzają teraz dokładną bieżącą wartość z wymagania, zamiast
niewłaściwie przyjętej proporcji. Nie zmieniono kanonicznych statystyk ani procentów
przedmiotów. Wyników tej korekty nie należy utożsamiać z odbiorem całego rozwoju.

Dla wcześniejszego commita `a547cc8bc4dee279d05d3004b42d0012e6463894` pełna
[bramka GitHub Actions](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/41617618111)
zakończyła się sukcesem. Nie jest to dowód zgodności z wymaganiem, którego wtedy
nie sprawdzał test — dlatego dodano powyższe regresje.


Po korekcie celowany zestaw: **69 PASS / 0 FAIL**
([wynik](qa/resource-policy/targeted-after.txt)). Pełne `npm test`:
**1167 PASS / 0 FAIL / 10 SKIP**, 100 plików zaliczonych, jeden pominięty.
Pominięcia dotyczą testowej bazy PostgreSQL, bez dodatkowej infrastruktury.
[Log jednostkowych](qa/resource-policy/unit-tests.txt),
[TypeScript — trzy konfiguracje](qa/resource-policy/typecheck.txt),
[lint — 0 błędów / 15 wcześniejszych ostrzeżeń](qa/resource-policy/lint.txt),
[build](qa/resource-policy/build.txt). Nie zmieniono zasobów względem zaliczonej
kontroli `assets:check` z partii 2. Metadane testowanego kodu:
[sumy źródeł i polecenia](qa/resource-policy/verification.json).


Końcowy Playwright na kodzie z korektą zasobów: **8 PASS / 0 FAIL**:

- Cztery pełne pierwsze rozdziały/projekty osobistych dziedzictw Canvas, po jednym
  na rasę, z prawdziwym prologiem, odbiorem nagród, założeniem osobistej broni,
  odczytem wybranej decyzji w kronice i reloadem. Bez wstrzykiwania postępu.
  [Log](qa/resource-policy/first-chapters-canvas.txt).
- Cztery dotykowe wejścia do kroniki nowych postaci Software WebGL z rzeczywistym
  sprawdzeniem renderera oraz braku nieodkrytej historii.
  [Log](qa/resource-policy/chronicle-webgl.txt).
- Brak `pageerror` w tych scenariuszach. To lokalny Phaser i emulacja dotyku,
  nie fizyczny Android/iOS ani odbiór całej kampanii lub kont produkcyjnych.

Oryginalne screenshoty odkrytej kroniki:
[Planetarni](qa/resource-policy/planetary-earned-chronicle.png),
[Mędrcy](qa/resource-policy/sage-earned-chronicle.png),
[Androidy](qa/resource-policy/android-earned-chronicle.png),
[Legendy](qa/resource-policy/legend-earned-chronicle.png).
W tym samym katalogu są obrazy założonej broni i nowych kronik w WebGL.
Starszy dodatkowy przebieg Mędrca/Androida/Legendy, sprzed korekty HP/KI,
miał 3 PASS i pozostaje [oddzielnym dowodem](qa/resource-policy/other-first-chapters-before-correction.txt).
Nie doliczamy go do ośmiu końcowych scenariuszy.

Pozostały zakres pełnego zlecenia jest niezmieniony: próby rasowe i stopnie dziedzin,
odblokowania, tytuły, późne warianty starć, pełny graf i odbiór legalnego balansu.
Ta partia nie scala PR #90 i nie zmienia produkcji.
