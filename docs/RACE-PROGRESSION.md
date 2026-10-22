# KI Legends — rozwój czterech ras i drzewka 1–20

Data: 22.10.2026. Gałąź `feat/race-progression-skill-trees-20261022`, baza `66a615dec1d4259e1bf668956ec1cb09e9aa177e`. Praca zlecona przez właściciela: „Wykonaj ten prompt osobiście. Na osobnej gałęzi. Interfejs zrób ładny i przejrzysty. Codex będzie zajmował się zmianą grafiki postaci”. To autoryzacja implementacji na gałęzi, nie zgoda na merge lub publikację. Bez Lovable, kredytów, operacji GPU i zmian assetów postaci.

## Źródła i hierarchia

Oryginały, zachowane bez zmiany bajtów w `docs/design/annexes/`:

| Źródło                                           | Strony | SHA-256                                                          |
| ------------------------------------------------ | ------ | ---------------------------------------------------------------- |
| Ki_Legends_Aneks_Rasy_i_Drzewka_Umiejetnosci.pdf | 11     | 0358053e7e467bffd41055f50f765d0f33cbf15c6b0176266c866d493dda5cff |
| Ki_Legends_Aneks_Bestiariusz_Poz_1-20.pdf        | 2      | 8d5fdb75780d1adb834ac76c74bd6cfd0d9c1b1b4bbf9517617ff3404f708960 |

Tekst źródłowy: `annexes/race-skill-trees-source.txt`. Nazwy źródłowe w historycznym PDF nie są nowym kanonem. Właściciel jednoznacznie zatwierdził: **Planetarni/Verdantia, Mędrcy/Aetheria, Androidy/Nexus-9, Legendy/Pyra**. W kodzie zachowano ID `planetary/verdant`, `sage/aether`, `android/nexus`, `legend/pyra`.

Przeczytano bieżące AGENTS, INDEX, ARCHITECTURE, STATUS, TASKS, ROADMAP, DECISIONS, PRODUCTION, dokument etapu 3, kanon RASY_I_ETAPY, kontrakt GPU oraz raport integracji. Te dokumenty zawierają historyczne statusy. GitHub w tej sesji potwierdził scalenie PR #15 i #16; obecność ich plików potwierdza checkout bazy. Nie potwierdza to odbioru produkcji. Nie odnaleziono przez wyszukiwanie pełnego osobnego dokumentu scenariuszy ras; zastąpienie jego harmonogramu wynika z aneksu str. 3. Nie odtwarzano brakujących scenariuszy z pamięci.

## Zakres dostawy

- `src/game/progression/catalog.ts`: 116 węzłów (29 na rasę), nazwy, opisy, koszty, cooldowny, progi i zależności OR oraz pary wykluczeń.
- `model.ts`: walidacja punktów i slotów, 80 bazowych wierszy statystyk poziomów 1–20, wzrost, obliczenia obrażeń i kosztów.
- `combat.ts`: zegar symulacji, zdolności aktywne, zasoby, serie, kanałowanie, oznaczanie, leczenie, tarcze, formy, slow/stun, odbicia, kręgi i Adaptacja.
- GameSession: komendy rozwoju, integracja walki, ruchu i zapisów. Renderer otrzymuje istniejące zdarzenia attack/skill/hit i rysuje osobne kręgi/aurę; nie zmieniono sprite'ów, atlasów, rigów ani kontraktu grafiki.
- `SkillTree`: ekran „Rozwój postaci” z menu gry; cztery rasy, trzy gałęzie, stan węzłów, szczegóły, wymagania, nauka, zestaw i reset, podgląd poziomów 1–20. Na telefonie zakładki gałęzi i przejście do szczegółów po dotknięciu węzła.
- `RaceSkillBar`: cztery dowolne poznane zdolności (w tym kilka ostatecznych), osobny atak, Tryb KI i mikstura. Klawisze 1–4, Spacja, T, Q. Nabycie i wyposażenie to osobne operacje.

## Bezpieczne włączanie i zapis

Nowy rozwój jest dostępny jako jawna aktywacja w panelu postaci. Samo oglądanie kart, przesuwanie poziomu podglądu lub wybór innej rasy **niczego nie zmienia** w postaci. Zarówno stare, jak i nowe sloty zachowują dotychczasowe zasady do kliknięcia „Włącz rozwój rasy”. To świadome wdrożenie opt-in na gałęzi, aby nie wymusić nowego balansu na istniejących postaciach przed odbiorem. Po aktywacji działają rzeczywiste reguły rasy, a nie sam planer.

Formaty v1/v3 pozostają czytelne. Pierwszy zapis rozwiniętej postaci ma `version:4`. Przed zastąpieniem istniejących bajtów tworzona jest kopia `ki-legends:recovery:before-v4:<oryginalny-klucz>`, poza prefiksem listy slotów. Błąd utworzenia kopii blokuje writeback. Kopii nie nadpisujemy. Starszy klient odrzuci wersję 4 zamiast usunąć nieznane pola. Ochrona oczekiwanej rewizji każdej karty jest zachowana. Brak rozwoju lub nieprawidłowy v4 nie jest cichym resetem poprawnego slotu.

Zachowujemy identyfikatory, poziom, XP, przedmioty, zadania, pozycję i niezależność slotów. Aktywacja, nauka pasywki i reset nie leczą: HP/Ki są ograniczane do dotychczasowej wartości oraz nowych limitów/proporcji. Cooldowny są związane z ID umiejętności i przetrwają zmianę slotu, reset i reload. Tymczasowe buffy, pozostała osłona, przegrzanie i kara wyłączenia Androida są zapisywane. Kanały i opóźnione zdarzenia dotyczące wrogów są anulowane przy odtworzeniu bez refundowania kosztu; wrogowie, tak jak wcześniej, są odtwarzani od początku.

20 punktów obejmuje automatycznie poznany korzeń (1 punkt). Poziom nie przyznaje mutowalnej puli ponownie: wolne punkty = min(poziom,20) − liczba poznanych węzłów. Reset pozostawia korzeń i zwraca resztę; w prototypie jest bezpłatny. Blokada nauki/resetu/zmiany zestawu obejmuje walkę i aktywne efekty. Panel zatrzymuje symulację, więc po wejściu prosto z walki należy wrócić do gry i poczekać na zakończenie walki/efektów.

Nie obcinamy dawnych postaci powyżej poziomu 20. Istniejący limit poziomu 100 pozostaje, ale nowy aneks definiuje statystyki/punkty tylko do 20, więc na poziomie >20 parametry rasowe są utrzymane na wartości poziomu 20. To brak dalszej progresji w tej dostawie, nie wymyślona specyfikacja poziomów 21–100.

## Reguły wykonawcze prototypu — rozstrzygnięte luki

Poniższe liczby i zasady wykraczające poza jednoznaczną treść aneksu są **roboczymi decyzjami implementacyjnymi na osobnej gałęzi**. Wymagają odbioru balansu przed merge. Nie zmieniają treści oryginałów.

1. Bazowe całkowite statystyki liczone są od wartości bazowej + przyrost × (L−1), zaokrąglone po sumie. Ekwipunek dodawany po bazie, pasywki procentowe po ekwipunku. Buffów nie zapisujemy jako stale podwyższonych baz.
2. Obrażenia: `max(udział_trafienia, Atak × mnożnik_trafienia − Obrona × 0,5 × udział_trafienia)`, krytyk ×1,5 po obronie; losowanie osobno dla trafień, szansa ograniczona do 100%. HP może być ułamkowe, tekst obrażeń jest zaokrąglony. Wagi serii sumują się do 1. Osiem ciosów ×4,2 nie odejmuje ośmiokrotnie pełnego pancerza. DoT nie krytykuje i nie generuje dodatkowego zasobu (do sprawdzenia w odbiorze implementacji).
3. Obecne dziki pozostają dotychczasowymi przeciwnikami z 66 HP; do obliczeń rasowych przyjęto roboczą obronę 3. Bestiariusz nie został podmieniony na mapach, grafika i rozstawienie fauny bez zmian. Pełna progresja przeciwników i balans 1–20 są osobnym etapem.
4. Android: wygaszanie Ładunku zaczyna się po 1,2 s bez podstawowego strzału. Przegrzanie blokuje podstawowe strzały, nie awaryjne rozładowanie; po odliczeniu zeruje Ładunek. C7 daje limit 150, C8 limit 70 bez przegrzania. Forma wyłącza przegrzanie przy zachowaniu wybranego limitu. Przeciążenie ma zapisany ośmiosekundowy licznik: sześć sekund premii, następnie dwie sekundy blokady akcji.
5. Legendy: bezpośrednie trafienia generują Żar; DoT i odbicia nie generują. Trzeci cios kombinacji dotyczy podstawowego ataku. Nowe 20 Żaru z C5 nie jest powtarzane przy natychmiastowym odczepieniu celu: wymagane pięć sekund przerwy. Forma utrzymuje 100 także po Eksplozji.
6. Zwroty Ki: Planetarni C8 po zakończeniu leczenia; Planetarni B6 raz za unikatowe cele pierwszego impulsu (max 15); Mędrcy A8 po rzeczywistym wybuchu w żywy cel. Echo i krąg nie powtarzają zwrotu. Dodatnia ekonomia Ki jest dopuszczona przez źródło, nie została arbitralnie usunięta. Darmowy koszt nie daje ujemnej ceny. Forma nadal kosztuje Ki.
7. Kanał: czas liczy symulacja; pauza zatrzymuje czas. Ruch przerywa z wyjątkiem ulepszonego Skupienia Mistrza; trafienie przerywa. Koszt i cooldown naliczane na początku, nie refundowane. Strumień Ki ma sześć ticków co 0,5 s i kontrolę zasięgu/LOS.
8. Kręgi pozostają w miejscu rzucenia. Premie obrony i slow z kręgów wybierają najsilniejszy efekt, nie sumę. Złoty Krąg: roboczo 3 s, 3 ticki po ×0,2, promień 120. Kataklizm: roboczo podpalenie łącznie ×0,5 przez 5 s. Wymiary „dużych obszarów” są jawne w kodzie i wymagają oceny właściciela.
9. DoT tego samego źródła na celu odświeża token, nie tworzy nieskończonych stosów. Slow i stun nie sumują czasu bez końca. Bieżący dzik nie ma efektów kontroli gracza ani osłony, więc odpowiednie odporności postaci i niszczenie osłon nie są dowodem przetestowania nowych typów wrogów.
10. Tarcze pochłaniają po obronie, nadwyżka trafia w HP. Zachowujemy większą pozostałą pojemność, nie sumujemy osłon. Odbicie omija kolejne proce/odbicia. Lustro działa raz, Ostatni Płomień raz na aktywację. Brak autorytatywnego serwera lub zabezpieczenia przed lokalną edycją zapisu.
11. Uniki i szarże sprawdzają drogę małymi krokami; nie teleportują przez ścianę. Adaptacja korzysta z metadanych stref, nie koloru tekstur. Verdantia domyślnie las, kamienny plac i strefy rzeki; pozostałe krainy domyślnie skały. Rzeka nadal ma dotychczasowe kolizje, więc wodny bonus nie upoważnia do przechodzenia przez wodę.
12. Można poznać trzy ultimate'y (19 punktów z korzeniem) i formę (20), a dowolne cztery poznane zdolności aktywne/ostateczne wyposażyć na pasku. Nie narzucamy niezatwierdzonego limitu jednej ostatecznej. Hybryda może korzystać z trzech ultimate’ów; jej rzeczywista opłacalność wymaga pełnego balansu.

## Poziomowanie i wymagające dalszej rozbudowy treści

Zachowano istniejący wzór XP `100 + (L−1)×60`, łącznie 12 160 XP do poziomu 20. Bieżące trzy zadania i dziki nie stanowią kompletnej kampanii 1–20. Aneks bestiariusza zawiera 20 archetypów i czterech bossów, ale nie określa czterech pełnych krzywych regionów, cooldownów wrogów, nagród XP/łupów ani ekonomii. Nie twierdzimy, że to zostało wdrożone.

Proponowana kolejność dalszych PR:

1. Odbiór tej warstwy rozwoju, UI i migracji; rozstrzygnięcie roboczych parametrów oraz pełne CI.
2. Wspólne statusy przeciwników dla ataków z kontrolą, pocisków, tarcz i bossów z odporną, czytelną mechaniką.
3. Katalog bestiariusza i mapa rozmieszczenia/nagród dla każdej krainy; cztery ścieżki 1–20 bez zakładania niewdrożonych portali.
4. Scenariusze i nagrody zgodne z wyborem zdolności w drzewku; nowe treści między progami 2/4/7/10/13/16/20.
5. Dłuższe testy rotacji, ekonomii i tempa progresji z realnymi profilami wrogów, pomiary fizycznego Androida i odbiór estetyczny.
6. Dopiero osobna decyzja o domyślnym włączeniu nowego balansu i publikacji. Multiplayer pozostaje osobnym projektem.

## Obliczenia i ograniczenia dowodów

`node --import tsx scripts/analyze-race-progression.ts` odtwarza pełny katalog, 80 wierszy wzrostu i 16 porównań samych podstawowych ciosów z bossami w `docs/qa/race-progression/`. Założenia są częścią JSON. To model arytmetyczny bez krytyków, pasywek, form, ruchu, mikstur i czasu ataku wrogów; nie jest symulacją pełnych buildów ani werdyktem balansu. Brak danych o bossach wyklucza uczciwe ogłoszenie pełnej równowagi klas.

Stan weryfikacji oraz dokładny commit wyników: `docs/qa/race-progression/VALIDATION.md`. Testy przeglądarkowe level-20 używają jawnego izolowanego fixture zapisu do sprawdzania migracji i progów, nie udają osiągnięcia poziomu 20 przez rozgrywkę. Wybór nowej postaci, eksploracja i dotychczasowa pętla mają odrębne regresje.
