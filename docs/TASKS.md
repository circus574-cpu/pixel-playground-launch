# KI Legends — aktywny rejestr zadań i usterek

Aktualizacja: 2026-10-21. Po każdej zmianie sprawdzić aktualne commity oraz CI i poprawić [STATUS.md](STATUS.md); nie zamykać zgłoszeń deklaracją wykonawcy.

| ID | Priorytet | Zadanie | Warunek zamknięcia |
|---|---|---|---|
| AUD-015-01 | WYSOKI | Zweryfikować naprawę testu cyklu życia bohaterów w PR #15. | Niezależny WebGL PASS na końcowym SHA, zachowane asercje. |
| AUD-015-02 | WYSOKI | Dokończyć pełną regresję PR #15. Historyczny run 39665659452: 90/91, `private-sketch.spec.ts:23` -> `net::ERR_ABORTED`. | 91/91 lub aktualny kompletny zestaw PASS na końcowym SHA, bez usuwania osłon prywatnego `/test`. |
| AUD-015-03 | WYSOKI | Zweryfikować dane graczy i brak regresji: sloty, migracje, cztery światy, 2D/3D, spawn, nawigacja. | Pełna regresja oraz ręczny odbiór krytycznych ścieżek. |
| AUD-015-04 | ŚREDNI | Odbiór mobilny, sprzętowy WebGL, pamięć/FPS i wizualna jakość 416-klatkowych animacji. | Udokumentowane testy realnego urządzenia i ocena właściciela. |
| DOC-01 | ŚREDNI | Zachować oryginalny projektowy PDF 12 stron w `docs/design/` oraz zweryfikować SHA-256. | Plik binarny i jego faktyczna suma w commicie, brak zastąpienia indeksem tekstowym. |
| DOC-02 | ŚREDNI | Przejrzeć PR #13, ustalić bezsprzeczny kanon architektury i multimedia. | Audyt plików, brak kolizji decyzji, zatwierdzony PR. |
| REL-01 | WYSOKI | Skontrolować prawa do referencji/assetów i zgodność wdrożonej wersji. | Przegląd licencji i zgodność wersji produkcyjnej z zatwierdzonym commitem. |
| REL-02 | WYSOKI | Uzyskać osobne decyzje właściciela o scaleniu i publikacji. | Dowód jawnych zezwoleń. |

Nie działać na instancjach GPU w zakresie start/stop/restart/terminate bez decyzji właściciela. Nie zmieniać produkcji.
