# KI Legends — aktywny rejestr zadań i usterek

Aktualizacja: 2026-10-21. Po każdej zmianie sprawdzić aktualne commity oraz CI i poprawić [STATUS.md](STATUS.md); nie zamykać zgłoszeń deklaracją wykonawcy.

| ID | Priorytet | Zadanie | Warunek zamknięcia |
|---|---|---|---|
| AUD-015-01 | WYSOKI | Zweryfikować naprawę testu cyklu życia bohaterów w PR #15. | Niezależny WebGL PASS na końcowym SHA, zachowane asercje. |
| AUD-015-02 | WYSOKI | Dokończyć pełną regresję PR #15. Historyczny run 39665659452: 90/91, `private-sketch.spec.ts:23` -> `net::ERR_ABORTED`. | 91/91 lub aktualny kompletny zestaw PASS na końcowym SHA, bez usuwania osłon prywatnego `/test`. |
| AUD-015-03 | WYSOKI | Zweryfikować dane graczy i brak regresji: sloty, migracje, cztery światy, 2D/3D, spawn, nawigacja. | Pełna regresja oraz ręczny odbiór krytycznych ścieżek. |
| AUD-015-04 | ŚREDNI | Odbiór mobilny, sprzętowy WebGL, pamięć/FPS i wizualna jakość 416-klatkowych animacji. | Udokumentowane testy realnego urządzenia i ocena właściciela. |
| DOC-01 | ŚREDNI | **Wykonane na gałęzi PR #16:** 12 oryginalnych binarnych fragmentów i skrypt rekonstrukcji PDF, commit `fb8940c`; wymagane scalenie do `main`. | Po zatwierdzeniu PR #16 odtworzyć oryginał i potwierdzić SHA-256 `be58d9df4...`; do tego czasu nie oznaczać jako stan `main`. |
| DOC-02 | ŚREDNI | Przejrzeć PR #13, ustalić bezsprzeczny kanon architektury i multimedia. | Audyt plików, brak kolizji decyzji, zatwierdzony PR. |
| REL-01 | WYSOKI | Skontrolować prawa do referencji/assetów i zgodność wdrożonej wersji. | Przegląd licencji i zgodność wersji produkcyjnej z zatwierdzonym commitem. |
| REL-02 | WYSOKI | Uzyskać osobne decyzje właściciela o scaleniu i publikacji. | Dowód jawnych zezwoleń. |

Nie działać na instancjach GPU w zakresie start/stop/restart/terminate bez decyzji właściciela. Nie zmieniać produkcji.

## Nowy zakres koncepcyjny — 22.10.2026

| ID | Priorytet | Zadanie | Warunek zamknięcia |
|---|---|---|---|
| DES-SKILL-01 | ŚREDNI | Zweryfikować 116 węzłów z aneksu i reguły punktów, korzenia, Trybu KI oraz par wykluczających. | Decyzja właściciela + testy specyfikacji, bez sprzeczności punktacji. |
| DES-SKILL-02 | WYSOKI przy implementacji | Implementacja rozwoju ras 1–20: statystyki, cooldowny, Ki, zasoby, aury, odblokowania, UI drzewek i migracja zapisów. | Oddzielny PR; testy 4 ras, zapisu, poziomowania i regresji wszystkich zdolności. |
| DES-ENEMY-01 | ŚREDNI | Review 20 wpisów bestiariusza i propozycji obrażeń oraz niejawnych profili mnożników. | Zatwierdzona specyfikacja balansu, bez wymyślonych danych. |
| DES-ENEMY-02 | WYSOKI przy implementacji | Wdrożyć bestiariusz 1–20 bez utraty istniejących wrogów, dropów i questów. | Testy AI, walki, bossów poz. 5/10/15/20, zapisów i mobilne QA. |
| DES-NAMES-01 | ŚREDNI | Rozróżnić historyczne nazwy krain w aneksach od istniejących nazw i ID światów. | Utrzymane `Verdantia/Aetheria/Nexus-9/Pyra` i `verdant/aether/nexus/pyra`; brak niezatwierdzonej migracji. |

Materiały: [drzewka](design/CHARACTER-PROGRESSION-LEVELS-1-20.md), [wrogowie](design/BESTIARY-LEVELS-1-20.md), [oryginały](design/source-annexes/MANIFEST.json). **Status: NIEWDROŻONE do rozgrywki.**
