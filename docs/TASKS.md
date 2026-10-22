# KI Legends — aktywny rejestr zadań i usterek

Aktualizacja: 2026-10-21. Po każdej zmianie sprawdzić aktualne commity oraz CI i poprawić [STATUS.md](STATUS.md); nie zamykać zgłoszeń deklaracją wykonawcy.

| ID         | Priorytet | Zadanie                                                                                                                                        | Warunek zamknięcia                                                                                                            |
| ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| AUD-015-01 | WYSOKI    | Zweryfikować naprawę testu cyklu życia bohaterów w PR #15.                                                                                     | Niezależny WebGL PASS na końcowym SHA, zachowane asercje.                                                                     |
| AUD-015-02 | WYSOKI    | Dokończyć pełną regresję PR #15. Historyczny run 39665659452: 90/91, `private-sketch.spec.ts:23` -> `net::ERR_ABORTED`.                        | 91/91 lub aktualny kompletny zestaw PASS na końcowym SHA, bez usuwania osłon prywatnego `/test`.                              |
| AUD-015-03 | WYSOKI    | Zweryfikować dane graczy i brak regresji: sloty, migracje, cztery światy, 2D/3D, spawn, nawigacja.                                             | Pełna regresja oraz ręczny odbiór krytycznych ścieżek.                                                                        |
| AUD-015-04 | ŚREDNI    | Odbiór mobilny, sprzętowy WebGL, pamięć/FPS i wizualna jakość 416-klatkowych animacji.                                                         | Udokumentowane testy realnego urządzenia i ocena właściciela.                                                                 |
| DOC-01     | ŚREDNI    | **Wykonane na gałęzi PR #16:** 12 oryginalnych binarnych fragmentów i skrypt rekonstrukcji PDF, commit `fb8940c`; wymagane scalenie do `main`. | Po zatwierdzeniu PR #16 odtworzyć oryginał i potwierdzić SHA-256 `be58d9df4...`; do tego czasu nie oznaczać jako stan `main`. |
| DOC-02     | ŚREDNI    | Przejrzeć PR #13, ustalić bezsprzeczny kanon architektury i multimedia.                                                                        | Audyt plików, brak kolizji decyzji, zatwierdzony PR.                                                                          |
| REL-01     | WYSOKI    | Skontrolować prawa do referencji/assetów i zgodność wdrożonej wersji.                                                                          | Przegląd licencji i zgodność wersji produkcyjnej z zatwierdzonym commitem.                                                    |
| REL-02     | WYSOKI    | Uzyskać osobne decyzje właściciela o scaleniu i publikacji.                                                                                    | Dowód jawnych zezwoleń.                                                                                                       |

Nie działać na instancjach GPU w zakresie start/stop/restart/terminate bez decyzji właściciela. Nie zmieniać produkcji.

## Z sesji 22.10.2026 (szczegóły: SESSION-2026-10-22-HANDOFF.md)

| ID       | Priorytet | Zadanie                                                                            |
| -------- | --------- | ---------------------------------------------------------------------------------- |
| WORLD-01 | WYSOKI    | Sprawdzić CI PR #24 na `7e30566`, scalić po zielonym, osobna decyzja o publikacji. |
| WORLD-02 | WYSOKI    | Powiększyć kontynenty (mniej wody): znaleźć największą skalę z odstępem ≥ 3 000 j. |
| WORLD-03 | WYSOKI    | Rozszerzyć Verdantię (przesunięcie lasu o 1200/900) i zmigrować zapisy.            |
| WORLD-04 | ŚREDNI    | Cztery miasta na kontynent, większe miasta.                                        |
| UI-01    | NISKI     | Obraz menu/loading po dostarczeniu pliku bez napisu „JUŻ WKRÓTCE”.                 |
