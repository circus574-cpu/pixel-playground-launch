# KI Legends — aktywny rejestr zadań i usterek

## Gałąź rozwoju — 22.10.2026
- RPG-01: odbiór katalogu 116 węzłów, wzrostu, alokacji i migracji v4. Dowody: testy i [specyfikacja](RACE-PROGRESSION.md).
- RPG-02: odbiór interfejsu, zestawu bojowego i efektów w Canvas/Software WebGL. Stan: [walidacja](qa/race-progression/VALIDATION.md).
- RPG-03: zatwierdzenie roboczych parametrów kręgów, DoT, form i zestawu czterech zdolności.
- RPG-04: kampanie 1–20, bestiariusz na czterech mapach, nagrody/XP i pełne symulacje buildów — następny etap, niewdrożone.
- RPG-05: fizyczny Android i sprzętowy WebGL — niewykonane.

Historyczna tabela poniżej opisuje stan 21.10.2026. PR #15/#16 są już scalone; nie zamyka to automatycznie nierozwiązanych odbiorów mobilnych i produkcyjnych.


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
