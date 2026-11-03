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
