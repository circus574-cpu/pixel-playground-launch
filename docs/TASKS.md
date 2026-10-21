# KI Legends — zadania i otwarte kontrole
Stan: 2026-10-21, rekonstrukcja; nie modyfikuje istniejących zadań Codexa.

## Priorytet P0: po zakończeniu bieżących prac Codexa
- [ ] Ustalić zamknięty commit SHA PR #4 i pozostałych istotnych gałęzi; sprawdzić rzeczywisty diff.
- [ ] Zweryfikować wymagane GitHub Actions, pełny TypeScript, build, unit i Playwright na tym samym SHA.
- [ ] Otworzyć produkcję `kilegends.pl`, ustalić wdrożony SHA i porównać z zatwierdzonym.
- [ ] Sprawdzić wszystkie cztery regiony: start, sterowanie, PvE, questy, handel, zapis/migrację, przełączanie postaci i brak regresji.
- [ ] Przetestować bohatera Planetarnych w rzeczywistej animacji i w docelowej skali; 8 kierunków, kolizja, stopy, alpha, płynność.
- [ ] Zweryfikować fizyczne urządzenie mobilne (viewport emulowany nie wystarcza).
- [ ] Zweryfikować dostępność obiektów Git LFS, nie tylko pointerów.
- [ ] Sprawdzić licencje modeli i zasobów GPU przed komercyjnym użyciem.
- [ ] Zamknąć rozbieżności między dokumentacją a kodem i zapisać wynik w STATUS/CHANGELOG na konkretnym SHA.

## Priorytet P1: jakość i zawartość
- [ ] Zatwierdzić jedną kompletną grywalną lokację Verdantii z bohaterem, zamiast oceniać liczbę surowych PNG.
- [ ] Ujednolicić anime styl, kamerę, kierunki i przezroczystość wszystkich obiektów.
- [ ] Dokończyć rasowych bohaterów Mędrców, Androidów i Legendów bez podmiany kanonu.
- [ ] Uzupełnić NPC, przeciwników, animacje, efekty KI i optymalizację assetów.
- [ ] Przygotować niezależne testy wydajności i stabilności produkcyjnej.

## Priorytet P2: wymagające osobnych decyzji
- [ ] Zatwierdzić fabułę, biografie, relacje ras i świat poza startowymi regionami.
- [ ] Ustalić projekt areny/PvP i multiplayera.
- [ ] Ustalić docelową architekturę trwałego konta i serwera, dopiero po decyzji właściciela.

## Zasady
Żaden checkbox nie jest zamykany na podstawie samego raportu Codexa. Dopisać dowód (commit, test run, screenshot/trace lub produkcyjny wynik) i audytora. Nie kasować wcześniejszych niezamkniętych usterek.
