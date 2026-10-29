# KI Legends — zasady przedmiotów v2.0

Data przeglądu: 2026-10-29. Zakres: 366 ID przedmiotów, 140 receptur, 10 zwykłych kompletów i dokładnie 5 specjalnych kompletów artefaktów (35 przedmiotów). To **specyfikacja projektowa**, a nie już wdrożona aktualizacja silnika.

## Nadrzędna decyzja właściciela

**Każdy artefakt daje ciągły, bezterminowy buff pasywny wyłącznie przez sam fakt noszenia.** Nie ma aktywacji, skilli aktywnych, losowych proców, warunków walki, limitów czasu, okresu odnowienia ani cooldownu. Premia przelicza się automatycznie po założeniu, zdjęciu, zmianie slotu, zmianie poziomu i po odtworzeniu zapisu. Działa w mieście, poza miastem i podczas walki.

**Wszystkie nowe premie maksymalnego HP, KI, ATK i DEF w docelowym modelu wyposażenia wyrażamy procentowo** (np. `maxHpPercent: 8`, a nie `hpBonus: 100`). Wyjątek: liczba punktów procentowych szansy krytycznej (`critChancePoints`) i odrębne działanie aktualnego, niezmodyfikowanego silnika.

Artefakt ma `stats: {}`. Jego jedyne premie są w obiekcie `buff` z `mode: passive`, `activation: on_equip`, `duration: while_equipped`, `trigger: null`, `cooldown_s: null`. Brak `active_ability_id` i brak osobnego przycisku. Bonus 2/4/7 części jest równie pasywny i naliczany tylko przy rzeczywiście założonych unikalnych elementach danego kompletu.

## Jednostki statystyk

- `maxHpPercent`, `maxKiPercent`, `atkPercent`, `defPercent`: premia % od wartości z rasy, poziomu i drzewka, a nie stałe punkty.
- `hpRegenPercent`, `kiRegenPercent`: premia % do bieżącego bazowego tempa regeneracji. Nie oznacza dodatkowych X% pełnego zasobu na sekundę.
- `moveSpeedPercent`, `kiCostReductionPercent`, `damageReductionPercent`: procentowe modyfikatory, z globalnym limitem.
- `critChancePoints`: punkty procentowe szansy na krytyka, np. 2 pp zmienia 10% na 12%, a nie na 10,2%.
- `source_stats`: niezmienione parametry historyczne z pliku `items/catalog.ts`, starszej Księgi Przygody albo wcześniejszej propozycji wizualnej; **nie należy ich doliczać drugi raz**.
- `stats`: proponowane nowe premie procentowe, przeznaczone do zatwierdzenia, testów i przyszłej migracji.
- `source_description`: historyczny opis — służy do audytu, nie zastępuje docelowego `description`.

## Liczenie i limity

1. Obliczyć bazę postaci na aktualnym poziomie po rasie i drzewku (bez premii z przedmiotów).
2. Zsumować premie procentowe danej statystyki ze sprzętu, artefaktów i bonusów kompletów **addytywnie**. Nie łączyć procentów multiplikatywnie, by uniknąć lawinowego wzrostu.
3. Zastosować globalny limit danej statystyki i obliczyć finalną wartość na podstawie bazy.
4. Jeżeli zmienia się maksymalne HP/KI, zachować proporcję dotychczasowego zasobu; wielokrotna wymiana sprzętu nie może leczyć ani regenerować KI.
5. Nie sumować tego samego egzemplarza, ID ani efektu setowego kilkukrotnie. Każdy artefakt zajmuje jeden unikalny slot `artifact_1` do `artifact_7` (docelowe, nieobecne w obecnym runtime).

Proponowane globalne limity na sumę premii z wyposażenia i artefaktów:

| Statystyka | Maksymalna premia |
|---|---:|
| Maks. HP | +55% |
| Maks. KI | +45% |
| ATK | +32% |
| DEF | +50% |
| Regeneracja HP | +25% bazowego tempa |
| Regeneracja KI | +25% bazowego tempa |
| Szybkość ruchu | +10% |
| Redukcja kosztu KI | +15% |
| Redukcja otrzymywanych obrażeń | +15% |
| Krytyk | +6 pp |

Przykład: 10% premii maksymalnego HP przy bazie 300 HP daje +30 HP, a przy bazie 3000 HP daje +300 HP. Zmiana procentów nie powoduje samoczynnego leczenia.

## Pięć specjalnych kompletów artefaktów

Każdy komplet zawiera **7 artefaktów** w tych samych pozycjach: amulet, pierścień, koraliki KI, kryształ KI, talizman, relikwiarz, sfera KI. Każda część daje własny bierny efekt. Aktywacja nie istnieje.

| Jakość | Komplet | HP | KI | Regen HP | Redukcja obrażeń | Ruch | Redukcja kosztu KI | Krytyk |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Zwykła | Iskra Początku | +2% | +3% | +2% | +1% | +1% | +2% | +0,5 pp |
| Niezwykła | Krąg Spokojnego Przepływu | +3% | +4% | +3% | +2% | +1,5% | +3% | +0,8 pp |
| Rzadka | Splot Szmaragdowego Życia | +4% | +6% | +4% | +2,5% | +2% | +4% | +1 pp |
| Epicka | Pryzmat Harmonii | +6% | +8% | +6% | +3,5% | +3% | +5% | +1,5 pp |
| Legendarna | Pieczęć Serca Płomieni | +8% | +10% | +8% | +5% | +4% | +6% | +2 pp |

Każda wartość w wierszu pochodzi z **innego** założonego artefaktu, a nie jest sumą gwarantowaną z samego posiadania całego zestawu.

Bonusy progowe za 2/4/7 unikalnych założonych części dotyczą odpowiednio: regeneracji HP / redukcji obrażeń / redukcji kosztów KI. Liczby są ujęte w `buff_set_bonuses` w JSON. Wszystkie progi są pasywne i znikają po zdjęciu elementu, jeśli próg przestaje być spełniony.

## Ochrona istniejącej gry

Aktualny `GameSession` używa tylko podstawowych identyfikatorów `potion`, `tusk`, `sword`, `vest`: mikstura odnawia 40% maks. HP, miecz daje +8 ATK, kamizelka +3 DEF. Te liczby w działającym kodzie **nie zostały zmienione**. Starszy katalog miał rozbieżności (np. stałe 60 HP z potion); dokument je ujawnia zamiast wprowadzać pozorną zgodność.

Nie importować nowego JSON wprost do obecnego `session.ts`: wymagane są rozszerzenie schematu i walidacji, nowa obsługa slotów, przeliczenie efektów, deterministyczne liczenie progów i bezstratna migracja lokalnych i chmurowych zapisów postaci.

## Kryteria odbioru dla Codexa

1. Założenie artefaktu automatycznie daje buff bez kliknięcia i bez rozpoczęcia walki. Zdjęcie natychmiast usuwa dokładnie tę premię.
2. Brak `duration_s`, aktywnych przycisków, okresu odnowienia lub wyzwalaczy od zdarzenia dla wszystkich 35 artefaktów i 15 premii zestawowych.
3. Efekty wyliczają się prawidłowo przy poziomach 1, 5, 10, 15, 20 i wyższych, dla wszystkich czterech ras.
4. Nie da się uzyskać leczenia lub darmowej KI przez zdejmowanie i zakładanie ekwipunku.
5. Odpowiednio wyliczają się progi 2/4/7, także po wylogowaniu i ponownym wczytaniu gry.
6. Sumowanie przestrzega limitów; żaden powtórzony ID nie jest liczony kilkakrotnie.
7. Wdrożenie nie zmienia ceny i działania podstawowego sklepu bez osobnego zatwierdzenia.
8. Stare zapisy postaci odtwarzają się bez utraty broni dziedzictwa, ekwipunku, depozytu i punktów umiejętności.
9. Kontrola na urządzeniu mobilnym: tooltip dokładnie odzwierciedla nowy procent, a strona z buffami nie prezentuje przycisku aktywacji.
10. Przed wydaniem: testy jednostkowe, rzeczywiste testy E2E na Android WebGL, porównanie builda z wdrożonym SHA i pomiar balansu PvE.

**Status:** KATALOG I SPECYFIKACJA DO WDROŻENIA. **Nie wykonano commitów ani wdrożenia.**
