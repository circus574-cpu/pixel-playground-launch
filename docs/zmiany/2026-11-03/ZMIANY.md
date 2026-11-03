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


## Integracja nowszego main z gałęzią domykania rozwoju

Po wysłaniu `f9e1d5b5` sprawdzono zdalny `main`, który w międzyczasie przeszedł
z `13983467` do `e02c87b5ea9ad654f17d450464d13c36083f058b`. Zawiera cudze prace:
35/40 potworów anime i poprawkę `revision/seq` ramek serwera z PR #91 oraz
`fix/frame-order`. Nie przypisujemy ich autorstwa tej gałęzi.

Wykonano `git merge --no-commit --no-ff e02c87b5ea9ad654f17d450464d13c36083f058b`
**do gałęzi `feature/complete-character-development`**, żeby nie utracić tych zmian
przy późniejszym odbiorze PR #90. Nie scalono PR do `main`, nie przepisano historii,
nie zmieniono gałęzi innych wykonawców i nie opublikowano gry.

Jedyny konflikt był w niniejszym dzienniku. Zachowano pełną treść obu wkładów;
47 pozostałych plików nowszego `main` ma identyczne bajty
([wykaz i sumy](qa/main-integration/preserved-upstream.json)). Nie zmieniano nowych
atlasów, skryptu importu ani poprawki ramek. Ponownie wykonywane kontrole
połączonego kodu identyfikuje [manifest](qa/main-integration/verification.json).


Kontrole po integracji: TypeScript (trzy konfiguracje), lint (0 błędów,
15 wcześniejszych ostrzeżeń), build oraz kontrakt zasobów zaliczone. Software
WebGL nowych kronik czterech ras: **4 PASS / 0 FAIL**, bez błędów `pageerror`.
Wcześniejsze rzeczywiste pierwsze rozdziały czterech ras Canvas pozostają dowodem
na `f9e1d5b5`; po integracji nowszych atlasów wykonano osobno powyższy WebGL.
Nie deklarujemy ponownego przejścia wszystkich rozdziałów w przeglądarce po merge.

Kontrola środowiska po `git merge` ujawniła ponowne pominięcie źródeł poza zakresem
lokalnego sparse checkout: pięciu śledzonych plików `deliveries/` (31 077 049 bajtów) oraz
136 plików `art/production/development/v001/` (71 205 040 bajtów).
Pierwsza kontrola dokumentacji miała brak lokalnego archiwum, a pierwsze pełne
jednostkowe: **2 FAIL / 1167 PASS / 10 SKIP** w testach pochodzenia grafik/audio.
To rzeczywiście niezaliczone próby, zachowane w
[logu dokumentacji](qa/main-integration/documentation-before-restore.txt) i
[logu jednostkowych](qa/main-integration/unit-before-restore.txt).

Odtworzono tylko brakujące pliki, bezpośrednio z ich bieżących blobów indeksu Git;
nie nadpisano istniejących plików i nie zmieniono kodu, źródeł ani manifestów.
Nie pobierano modeli ani nie korzystano z GPU. Po przywróceniu: kontrola dokumentacji
PASS, pochodzenie grafik/audio **4/4 PASS**
([log](qa/main-integration/provenance-after-restore.txt)). Pełną regresję powtórzono
oddzielnie; wynik zostaje zapisany poniżej. Baza produkcyjna nie była używana.

CI dla `f9e1d5b5428eab9968622a059e8f98606c913a75`:
[SUCCESS](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/41619749800).
To wynik przed niniejszą integracją, a nie wynik przyszłego commita merge.


Pełna regresja po przywróceniu źródeł: **1169 PASS / 0 FAIL / 10 SKIP**,
100 plików zaliczonych / 1 pominięty. Przyrost dwóch testów pochodzi z przejętej
poprawki ramek, a nie z nowej mechaniki rozwoju. Brakująca testowa baza PostgreSQL
jest powodem 10 SKIP. [Końcowy log](qa/main-integration/unit-tests.txt).
Pozostałe logi: [typy](qa/main-integration/typecheck.txt),
[lint](qa/main-integration/lint.txt), [build](qa/main-integration/build.txt),
[zasoby](qa/main-integration/assets.txt), [dokumentacja](qa/main-integration/documentation.txt),
[Software WebGL](qa/main-integration/chronicle-webgl.txt).
Wyniki odnoszą się do źródeł o sumach w manifeście połączonych rodziców
`f9e1d5b5` + `e02c87b5`; commit merge powstaje dopiero po tych kontrolach.
Stan niewdrożonych prób, dziedzin, odblokowań i późnych starć pozostaje otwarty.


## Próby rasowe — pierwsze 12 kontrolerów i 36 stopni

Kontynuacja `feature/complete-character-development`, PR #90, po `c19207a9`.
Zakres to trzy próby w każdej z czterech dziedzin, nie komplet całego zlecenia:

| Rasa / dziedzina | Próby | Działanie |
| --- | --- | --- |
| Planetarni / Pamięć Korzeni | TV10–12 | Kolejność motywów, dopasowanie śladów do osad i rozpoznanie sprzeczności w jawnych materiałach ćwiczebnych |
| Mędrcy / Pieczęcie | TA01–03 | Klucz symboli, zmienione elementy kopii, zależności aktywacji; TA03 dopuszcza jedną pomyłkę |
| Androidy / Konstrukcja | TN07–09 | Obwód, diagnoza pomiarów oraz dobór unikalnych modułów do 2/3/3 gniazd i budżetów 6/8/10 |
| Legendy / Pojedynek | TP07–09 | Faktyczny unik zapowiedzi i cios w oknie kontry, powstrzymanie ciosu i poddanie, pozycja → trafienie → odwrót |

### Mechanika i trwałość

- Każda próba ma trzy stopnie z wymaganym niższym stopniem i jednorazową praktyką
  100/150/200. Powtórka zaliczonego stopnia nie dodaje nagrody ani nie obniża wyniku.
- Trzy próby na tym samym stopniu dają stopień dziedziny. II Pieczęci odblokowuje
  `ma-seal`, II Konstrukcji `mn-barrier` i `mn-shield`, II Pojedynku `mp-cuts`.
  Odkrycie nie uczy kanonicznego węzła i nie zakłada wariantu automatycznie.
- Wspólna sala `loanSession` zachowuje dotychczasową geometrię egzaminów.
  Używa rzeczywistego GameSession, nawigacji, hitów kitów i istniejącego RestraintActivity.
  Wypożyczony profil poziomu 20 ma tylko R, bez sprzętu/mikstur; nie ma writer portu,
  XP ani łupów. Oryginalna postać, jej pozycja i cooldowny są zachowane.
- Przeglądarka wysyła intencje. Gotowość, pauza, odpowiedź, ruch i zatwierdzenie są
  przypisane do konkretnej instancji. Nie przyjmuje się wyniku, postępu ani czasu od klienta.
  Ready blokuje zegar podczas pobierania zasobów; suspend/resume blokuje czas sali.
  Interfejs rozróżnia pauzę HUD, obrotu telefonu, fokusu, ukrytej karty i ładowania.
- Sala ma obecny ekran ładowania Phaser, obsługę błędu/powtórki i ręczne wyjście.
  Dotychczasowe globalne sterowanie, HUD, geometria i kanoniczne statystyki nie zmieniły się.
  Wykorzystano istniejące zasoby; nie generowano nowych grafik i nie używano GPU.
- Development v3 dodaje wyniki i kontrolę receipts. Migracje v1/v2 zachowują postęp.
  Writer klasyczny 10 i Superior 6 chronią nowy zapis przed starszym klientem,
  zachowując kopie przed migracją, CAS i odrzucanie nieznanych przyszłych pól/wersji.
  Nie ma migracji SQL ani zmian produkcyjnej konfiguracji.
- `scripts/playtest-entry.tsx` importuje rzeczywisty LegacyIndex: nowa integracja
  jest wspólna z trasą aplikacji, nie została dodana wyłącznie do demonstratora.

### Przerwanie środowiska i wyniki wznowienia

Dwie awarie exec-server przerwały poprzednie próby. Lokalny WIP odzyskano w całości;
notatkę wznowienia wcześniej zapisano w opisie PR #90. Nie ogłoszono pushu ani PASS
niewykonanych kontroli. Tymczasowe logi `/tmp` utracono; ponowione logi są teraz
zachowywane w `/workspace`, a wyniki po kontroli trafiają do QA w tym dzienniku.
Nie ustalono przyczyny awarii. Po odzyskaniu cgroup miał limit 8 GiB i liczniki OOM 0.
Ciężkie kontrole wznowiono z limitem sterty Node 3 GiB, bez równoległego serwera podglądu.

Potwierdzone przed przygotowaniem checkpointu:

- Pełny TypeScript (trzy konfiguracje) PASS po poprawieniu opcjonalnego onRetry.
- Celowany zestaw rozwoju, dziedzictw i prób: 120/120 PASS.
- Kontrolery, transakcje, intencje serwera czterech ras i mirror: 57/57 PASS.
  Te zestawy się pokrywają; nie sumujemy ich jako unikalnej liczby przypadków.
- Nowe testy obejmują 36 stopni, ruch/trafienia, błędne/stare/zdalne odpowiedzi,
  budżety modułów, brak zaliczenia AFK, stopnie w kolejności, receipts,
  powtórki, fałszywy wynik i instancję, awarię zapisu i konflikt dwóch kart,
  migrację, pauzę serwera, reload i brak przenoszenia zasobów profilu.
- Screenshoty i odbiór przeglądarkowy tej nowej partii nie są jeszcze zaliczone
  w pierwszym checkpoincie; pozostają obowiązkowe przed uznaniem partii za odebraną.

### Pozostały zakres

Pozostało 36 prób / 108 stopni, dziewięć odblokowań wariantów, trzech modułów,
interakcje dziedzin w świecie poza próbami i końcowe tytuły. Nie dodano 32 późnych
wariantów starć. Ta część daje 1350 praktyki na rasę: przy hipotetycznym wykonaniu
wszystkich 30 egzaminów i 40 badań budżet katalogowy wynosi 13 750, wciąż o 4050
mniej niż wymagane 17 800. Nie ogłasza się pełnej osiągalności/balansu kampanii.
Nie scalono PR i nie opublikowano gry.

### Kontrole checkpointu prób

- `NODE_OPTIONS=--max-old-space-size=3072 npm test`: **1226 PASS / 0 FAIL / 10 SKIP**,
  104 pliki zaliczone, jeden pominięty. Dziesięć przypadków PostgreSQL wymaga
  osobnej bazy QA (`accounts-service`, `world-overrides`); nie uruchamiano produkcyjnej bazy.
- Pierwsze pełne uruchomienie miało 11 FAIL: stare asercje nadal oczekiwały writerów
  9/5 zamiast nowych 10/6. Zaktualizowano wyłącznie kontrakt wersji, zachowując
  kontrole danych i kopii. Fixture integracyjny dawnych zapisów używa teraz
  rzeczywistego development v2 bez pola trials. Ponowienie całego zestawu jest zielone.
- `NODE_OPTIONS=--max-old-space-size=3072 npm run typecheck`: **PASS**, aplikacja/e2e/tools.
- `NODE_OPTIONS=--max-old-space-size=3072 npm run build`: **PASS**.
- [Pełne wyniki](qa/racial-trials/unit-final.log),
  [pierwotne niezgodne asercje](qa/racial-trials/unit-full.log),
  [TypeScript](qa/racial-trials/types-checkpoint.log),
  [build](qa/racial-trials/build.log).
- Nowy `e2e/racial-trials.spec.ts` przechodzi przez rzeczywisty ekran rozwoju
  i wypożyczoną salę oraz czyta widoczne wskazówki. W chwili checkpointu pozostaje
  **NIEWYKONANY**; nie stanowi jeszcze dowodu odbioru przeglądarkowego.

- `npm run lint`: **PASS**, 0 błędów / 15 wcześniejszych ostrzeżeń;
  `npm run assets:check`: **PASS**. [Lint](qa/racial-trials/lint-final.log),
  [zasoby](qa/racial-trials/assets.log), [sumy źródeł checkpointu](qa/racial-trials/checkpoint-sources.json).

### Odbiór przeglądarkowy — odtworzona przeszkoda interfejsu

Checkpoint implementacyjny `653116d71f2b731b7f2baf488088728353c0039e` jest na GitHubie.
[GitHub Actions 41634475944](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/41634475944)
ma **SUCCESS** na tym SHA (typecheck, jednostkowe/integracje, lint, zasoby, docs, build).

Pierwszą próbę Planetarnych przerwano po wykryciu błędnego selektora testu:
zakładka ma rolę `tab`, a scenariusz szukał `button`. Nie uznano tego za błąd gry.
Poprawiono także odczyt testowy na rzeczywisty `practiceEarned` i pola wyposażenia.
[Zapis przerwania](qa/racial-trials/canvas-first.log).

Następna seria Canvas: **3 PASS / 1 FAIL**. Planetarni TV10, Mędrcy TA01 i Androidy
TN08 rzeczywiście ukończyli próbę I, dostali +100 praktyki i zachowali wynik po reload.
Legendy TP08: brak ciosu w pierwszym oknie 4 s. Odtworzenie z ograniczeniem czasu
kliknięcia pokazało przyczynę: `.ki-exam-toolbar` przechwytywał pointer events nad
przyciskiem R. Screenshot sprzed ataku oraz log zawierają ten fakt — nie omijano
interfejsu przez force-click ani sterowanie stanem.
[Seria](qa/racial-trials/canvas-2.log), [diagnoza kliknięcia](qa/racial-trials/legend-diag.log).

Poprawka dotyczy tylko nowego paska sali prób: nad środkową częścią świata, z osobnym
wariantem niskiego ekranu; tekst przepuszcza dotyk/kliknięcia, aktywne pozostają jego
przyciski. Nie przesunięto HUD-u, joysticka ani przycisków walki. Nie osłabiono czasu
okien, limitów błędów, wymaganych trafień ani asercji zaliczenia.

Celowane ponowienie: **2 PASS / 0 FAIL**, Legendy TP08 oraz Androidy z prawdziwymi
zdarzeniami dotykowymi Chromium: wybór w pionie 390×844, gra 852×393, ponowny obrót
podczas próby, nawigacja dotykiem, moduły, +100 praktyki i reload.
[Log ponowienia](qa/racial-trials/fixed-smoke.log). To emulacja, nie fizyczny Android/iOS.
Końcowa pełna seria nowego pliku w Canvas i Software WebGL trwa; jej wyniku nie
zastępują powyższe częściowe rezultaty. Pełnego zestawu wszystkich e2e nie wykonano.

### Końcowa seria nowych prób — 10/10

`KI_QA_BASE_URL=http://127.0.0.1:4174 KI_QA_APP_URL=http://127.0.0.1:4174 npx playwright test e2e/racial-trials.spec.ts --project=gameplay --project=software-webgl --output=/workspace/ki-trials-final --reporter=list --trace=off`

**10 PASS / 0 FAIL / 0 SKIP**, 9,2 min. Po pięć scenariuszy Canvas i Software WebGL:
cztery rasy TV10/TA01/TN08/TP08 oraz Androidy dotykiem. Cztery scenariusze rasowe
w każdym projekcie jawnie sprawdzają rzeczywisty renderer przez metrics; sama nazwa
projektu nie jest dowodem. Testy czytają jedynie widoczne wskazówki i zapis;
nie zmieniają localStorage ani stanu sesji, nie używają force-click.

- Wszystkie rasy: wejście u trenera, instrukcja, uruchomienie sali, wykonanie próby I,
  +100 praktyki, grade=1, zachowane HP/KI/XP/złoto, osiem slotów, torba, przedmioty,
  materiały, depozyt, umiejętności, rasa i kontynent, potem reload z tym samym wynikiem.
- TV10/TA01: fizyczne stanowiska i odpowiedzi z jawnych materiałów.
  TN08: prawdziwe kontrolki modułów i budżet. TP08: trzy rzeczywiste ciosy w kolejnych
  dozwolonych oknach, brak ciosów w STOP i po poddaniu, bez zmiany reguł próby.
- Dotyk: pion 390×844, poziom 852×393, osłona obrotu również w sali,
  nawigacja dotykowa, kontrolki modułów, nagroda i odświeżenie. Brak poziomego overflow.
- Wszystkie scenariusze: **0 pageerror**. To nie jest odsłuch audio, test fizycznego
  telefonu, sprzętowego WebGL ani benchmark FPS. Czas całego e2e obejmuje start i reload,
  więc nie jest pomiarem czasu ładowania. Software WebGL jest tu renderowane na CPU.
- Stopnie II/III i pozostałe osiem prób są sprawdzone kontrolerami/symulacją serwera,
  nie pełnym przejściem UI wszystkich 36 stopni. Powtórki bez nagrody i awarie zapisu
  sprawdzają testy transakcyjne. Przeglądarka używa lokalnego harnessu rzeczywistej trasy;
  nie testowano wdrożenia tej partii ani sesji produkcyjnego WebSocket/PostgreSQL.

[Log całej serii](qa/racial-trials/browser-final.log),
[sumy przetestowanych źródeł](qa/racial-trials/browser-sources.json),
[indeks screenshotów z SHA-256](qa/racial-trials/screenshots.json).
Przykłady: [Planetarni — materiały](qa/racial-trials/browser-final/racial-trials-Planetarni-r-b46e5--one-time-reward-and-reload-gameplay/verdant-trial-materials.png),
[Legendy — dostępny atak po poprawce](qa/racial-trials/browser-final/racial-trials-Legendy-real-TP08-one-time-reward-and-reload-gameplay/pyra-trial-before-attack.png),
[Legendy — zaliczenie](qa/racial-trials/browser-final/racial-trials-Legendy-real-TP08-one-time-reward-and-reload-gameplay/pyra-trial-passed.png).
Trace był jawnie wyłączony (`--trace=off`) ze względu na ograniczony dysk;
pozostają logi i screenshoty, w tym odtworzone niepowodzenie.

### Regresja wcześniejszego egzaminu i sterowania

`KI_QA_BASE_URL=http://127.0.0.1:4174 KI_QA_APP_URL=http://127.0.0.1:4174 npx playwright test e2e/development.spec.ts --project=gameplay --grep 'endurance route: Planetarni|portrait selection, landscape training and simultaneous' --output=/workspace/ki-trials-exam-regression --reporter=list --trace=off`

**2 PASS / 0 FAIL / 0 SKIP**, Canvas, 40,9 s. Starszy egzamin wytrzymałości
Planetarnych wymaga rzeczywistego przejścia czterech punktów; zatwierdzenie ćwiczebne
nie zmienia bajtów zapisu właściciela. Drugi przypadek używa równoczesnych dwóch
palców CDP na joysticku i ataku, wykrywa realny ruch i trafienie zwykłym atakiem, wraca do postaci.
Po dodaniu współdzielonej `loanSession` i nowego paska sala starego egzaminu działa.
Nie zmieniano tego scenariusza, jego asercji ani sterowania, aby uzyskać PASS.
[Log regresji](qa/racial-trials/exam-regression.log).

Łącznie bieżący odbiór przeglądarkowy: **12 PASS / 0 FAIL / 0 SKIP** (10 nowych + 2 regresje).
Pełny katalog e2e projektu pozostaje **NIEWYKONANY**; zakres filtrowania jest jawny.
Nie sprawdzono fizycznego telefonu, sprzętowego WebGL, audio ani produkcyjnego wdrożenia.

### Końcowe kontrole przed zapisem poprawki i dowodów

Po zakończeniu przeglądarek zatrzymano wyłącznie lokalny Vite (bez kontaktu z GPU).
Na niezmienionych od odbioru przeglądarkowego źródłach ponowiono kolejno:

| Kontrola | Wynik |
| --- | --- |
| `NODE_OPTIONS=--max-old-space-size=3072 npm run typecheck` | PASS, wszystkie trzy konfiguracje |
| `NODE_OPTIONS=--max-old-space-size=3072 npm test` | 1226 PASS / 0 FAIL / 10 SKIP |
| `NODE_OPTIONS=--max-old-space-size=3072 npm run lint` | PASS, 0 błędów / 15 wcześniejszych ostrzeżeń |
| `NODE_OPTIONS=--max-old-space-size=3072 npm run assets:check` | PASS |
| `NODE_OPTIONS=--max-old-space-size=3072 npm run build` | PASS |

[Polecenia, kody wyjścia i czasy](qa/racial-trials/release-checks.json),
[pełny końcowy zestaw jednostkowy](qa/racial-trials/release-unit.log),
[końcowy TypeScript](qa/racial-trials/release-typecheck.log),
[końcowy build](qa/racial-trials/release-build.log).
JSDOM nadal loguje brak implementacji HTMLMediaElement.play; nie jest to test odsłuchu.
Dziesięć przypadków PostgreSQL pozostaje pominiętych bez bazy QA.
Kontrola dokumentów była zielona po dodaniu screenshotów; uruchamiana ponownie po tej adnotacji.
Bieżący `main` sprawdzony przez GitHub pozostaje `e02c87b5ea9ad654f17d450464d13c36083f058b`.
Nie scalano i nie publikowano. Dalsze wdrożenie wymaga zgodnego wydania klienta i serwera.

Nowa uwaga właściciela „Jest zadanie na próbę” wymaga wskazania konkretnego zadania/NPC:
w katalogu jest kilka różnych prób fabularnych, które nie muszą być próbami rasowymi.
Nie podpinano ich automatycznie ani nie zmieniano warunków questów na podstawie niejednoznacznego opisu.
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

## Wznowienie rozwoju — integracja main

Na polecenie właściciela wznowiono PR #90. Do gałęzi rozwoju połączono
`origin/main@4ecba945`; zachowano integrację wszystkich miast i flagę `ki-painted`.
Konflikty INDEX/dziennika rozwiązano zachowując obie treści, w Playwright zachowano
obie listy prób rasowych, kroniki i testów grafiki. Nie scalano do main ani nie publikowano.
`npm run typecheck`: PASS. Pełne `npm test`: 1227 PASS, 2 FAIL, 10 SKIP;
oba błędy dotyczyły niewypakowanego przez sparse checkout `art/production/development`.
Po odtworzeniu źródeł z Git `npx vitest run src/test/development-etap1-assets.test.ts`:
4 PASS. Kontrola dokumentacji PASS. To rozliczenie pełnej serii i celowanej powtórki,
nie deklaracja drugiego pełnego zielonego uruchomienia.
Logi: [pełna seria](qa/development-continuation/development-merge-tests.log),
[typy](qa/development-continuation/development-merge-types.log),
[ponowienie zasobów](qa/development-continuation/development-merge-assets-retry.log).
