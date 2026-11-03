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

## Poprawka: postać skakała zamiast chodzić

### 6. Ramki z serwera między zapisami

Po przejściu na zapis postaci co 2 s (sekcja 3) klient odrzucał prawie wszystkie ramki: uznawał za
nieaktualną każdą ramkę, której `revision` nie jest większy od poprzedniej, a `revision` rośnie dopiero
przy zapisie do bazy. Do gracza docierała jedna ramka na 2 s, więc postać teleportowała się.

- Ramka ma teraz własny numer `seq` rosnący z każdą ramką; klient porównuje `revision`, a w jego obrębie
  `seq` (`isStaleFrame` w `src/game/online/client.ts`).
- Testy: 10 kolejnych ticków w jednej wersji zapisu daje 10 przyjętych ramek oraz tabela przypadków
  nieaktualnej, powtórzonej i nowszej ramki.
