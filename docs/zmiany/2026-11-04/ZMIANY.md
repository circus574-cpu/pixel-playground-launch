# Zmiany — 04.11.2026

## Aktualizacja kolejki promptów na stagingu

Osobna gałąź `feature/prompt-board-current-materials` od istniejącego panelu,
bez scalania rozwoju gry z PR #90 i bez publikacji głównej gry. Właściciel
zlecił aktualizację staging.kilegends.pl: tylko brakujące materiały do rozwoju.

Read-only workflow inwentaryzacyjny 41805063800 potwierdził katalog 665 i 7 plików
przy 7 promptach, bez poprawek. Audyt repo na `a9e44175` potwierdził 46 grafik
Etapu 1 oraz 41 dźwięków. Z katalogu roboczego wyłączono 91 unikalnych pozycji
(gotowe 87 + cztery dodatkowe dostawy P-V3/P-V4). Oryginalnego katalogu nie zmieniano.
Dodano 10 brakujących tekstur wnętrz, zachowując 48 już dostępnych mebli i części
oraz gotowy kamień/ścianę kuźni Pyry. Do zamówienia pozostaje 584 pozycji,
w tym 400 klipów animacji. Plan i SHA źródeł w `deploy/prompt-board/materials-plan.json`.

Kolejka API i UI automatycznie ukrywa kompletne dostawy, zachowuje częściowe
animacje oraz materiały oznaczone do poprawy. Eksport, rekordy i prywatne pobieranie
historycznych plików pozostają dostępne. Testy HTTP obejmują restart procesu,
przycięcie katalogu i brak utraty danych. Supabase Auth i uprawnienia admina bez zmian.
Nie kasowano dostaw, nie modyfikowano bazy, gry, DNS ani instancji GPU.

Kontrole: 15 testów HTTP PASS; 6 scenariuszy przeglądarkowych PASS (rzeczywisty
katalog, schowanie po uploadzie/reloadzie, częściowa i pełna animacja, eksport,
brak zamówień gotowego audio, rozmiary 390×844 / 852×393 / 1280×720, zero pageerror).
Pierwszy TypeScript wskazał pominięte dane JSON w sparse checkout; przywrócono
pliki referencyjne z tej samej gałęzi, bez zmian źródeł. Końcowy wynik poniżej.
[Dowody](qa/prompt-board-refresh/).

Pełny TypeScript aplikacji/e2e/tools: PASS. Lint: 0 błędów / 15 istniejących ostrzeżeń.
