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


## Aktualizacja operacyjna po PR #8 (2026-10-21)
- [x] **HUD #5/#7:** naprawy geometrii, mobilnych narzędzi, statusów, przycisku rozmowy i regresji testów scalone do main; dowody #8/FINAL_TESTS.
- [x] **Kod main 86a1e41 — dowody testów Codexa:** 97/97 unit, 54/54 E2E, typecheck, assets:check, lint, build; osobno GitHub Actions success na 7a52aae. To nie są niezależnie ponowione lokalnie testy audytora.
- [x] **Wybrany checkpoint Planetarnych:** 181 obiektów LFS (31 918 089 B) zhashowanych według raportu #8; 179 PNG z poprawnymi metadanymi/alpha.
- [ ] **GPU:** po zgodzie właściciela sprawdzić wyłączony pod, ID woluminu, modele, kopie runtime, cold restart, brakujące dane; nic nie nadpisywać.
- [ ] **Planetarni:** dokończyć 237 klatek (attack 13, skill 64, hit 32, death 64, respawn 64); sprawdzić animacje, 416/416 i opt-in.
- [ ] **Kontrakt:** uzgodnić legacy 96/0.95/60° vs grounded 128/0.75/45° z #4, walidację, importer i brak regresji.
- [ ] **Niezależna kontrola:** zweryfikować wszystkie logi i artefakty #8, fizyczny Android, sprzętowy WebGL, produkcję/commit, prawa licencyjne; nie utożsamiać 7/7 historycznych testów domeny z testem nowego GPU.
- [ ] **Po akceptacji Planetarnych:** pozostałe rasy, NPC/fauna, środowisko i efekty KI; kontrola stylistyki i rzeczywistej sceny.
- [ ] **Utrzymać dokumenty:** #6 i #8 na osobnych gałęziach do zatwierdzenia; nie scalać ani nie publikować.


## Aktualizacja z PR #8 — stan wykonania i blokady
- [x] **Raportowo wykonane, z dowodami:** HUD PR #5 i QA PR #7, merge na main `86a1e41`; CI `39540694141` success; świeże lokalne 97 unit / 54 E2E według FINAL_TESTS #8. Oznaczenie dotyczy bazowej gry, nie GPU.
- [x] **Raportowo wykonane:** pobranie i hash 181 obiektów LFS, 179 PNG i .blend w PR #8; zakres ograniczony do `motion-v2`.
- [ ] Dokończyć Planetarnego: attack 13, skill 64, hit 32, death 64, respawn 64 = **237** brakujących klatek; następnie odbiór jakości, import opt-in, test w rzeczywistym Phaserze.
- [ ] Uzgodnić main (96 / origin .95 / kamera 60°) z #4 grounded (128 / .75 / 45°), w tym importer/packer/manifest i kolizję; nie przenosić 98 testów unit #4 jako wynik main.
- [ ] Wznowienie GPU tylko po zgodzie: sprawdzić tożsamość woluminu, kompletność modeli Animagine/DreamShaper, runtime, kopie, cold restart i ryzyko FUSE; nie wykonywać automatycznej reinstalacji.
- [ ] Weryfikacja produkcji na obecnym SHA: deployment, statyczny marker nie wystarcza; nie utożsamiać wcześniejszego 7/7 domeny z bieżącym deploy.
- [ ] Fizyczny Android, sprzętowy WebGL, długie sesje, termika, sieć mobilna, pomiary pamięci/tekstur.
- [ ] Pełny przegląd licencji modeli/assetów, zwłaszcza CreativeML Open RAIL++-M, U²-Net, referencje wizualne.
- [ ] Zweryfikować i uporządkować stare sprzeczne zapisy (np. cztery rasy kontra Human/Orc/Dwarf/Elf, techniczny rig kontra finalny bohater), bez usuwania historii.
- [ ] Po akceptacji Planetarnego kontynuować NPC/przeciwników, potem miasta i pozostałe rasy zgodnie z nowym poleceniem właściciela.
