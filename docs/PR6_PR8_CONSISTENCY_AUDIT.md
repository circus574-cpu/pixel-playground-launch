# KI Legends — kontrola zgodności dokumentacji PR #6 i #8
Data: 2026-10-21. Tryb tylko dokumentacyjny; żadnej zgody na merge/publikację.

## Wersje odniesienia
- PR #8: `docs/codex-cloud-handoff-20261021`, head `779ad95d041093fb7b2fcb0409562cf0ab1d7cb7`, baza main `86a1e411339bc41fb218d4633ed2a7bd81e1f167`.
- PR #6: `docs/ki-legends-knowledge-reconstruction-20261021`; pierwotny head `d020074dc70761632436e167d3e26d13e8beaf03`, aktualizowany osobno. Należy sprawdzać ruchomy head po każdej aktualizacji.
- CI HUD: GitHub Actions run `39540694141`, status `completed/success`, **head `7a52aaeb0412b671e6d9e0bf0825980b7bc131e9`**, nie head PR #8.
- PR #8 zawiera lokalne logi 97 unit / 54 E2E na `86a1e41`; to dowody wykonawcy zapisane w repo, nie niezależny ponowny test audytora.

## Rozbieżności, niekoniecznie błędy
1. **Nieaktualna baza statusu:** historyczny `8045a0b` w PR #6 to stan z chwili pierwszej rekonstrukcji; nowsza baza kodu po HUD to `86a1e41`. Zachować obie z datą i przeznaczeniem.
2. **Stan grafiki:** dawny opis „w toku/niezweryfikowane” trzeba doprecyzować: wzorzec Planetarnego zaakceptowany, ale **179/416 klatek**, brak 237, nowy rig nie jest zainstalowany ani opublikowany. 181 obiektów LFS / 31 918 089 B sprawdzono według artefaktów #8, nie jest to pełny backup GPU.
3. **Sprzeczne kontrakty, wymagające decyzji przed integracją:** main: aktor 96 jednostek, origin (0.5,0.95), kamera 60°; draft #4: `grounded`, 128 jednostek, origin (0.5,0.75), kamera 45°, `previewOnly`. Nie łączyć parametrów w jedną specyfikację „już wdrożoną”.
4. **Animacja `run`:** pierwotny katalog stanów wymienia run; GPU_PRODUCTION wyjaśnia, że obecna gra nie ma sprintu i produkcyjny Planetarny wymaga 416 klatek bez obowiązkowego run. Dokumenty PR #6 powinny traktować run jako historyczną możliwość adaptera, nie brakujący klip w checkpoint.
5. **Stan testów:** historyczne 58/7, 95/47 i robocze 98 unit z #4 nie zastępują obecnych 97/54 na main. GitHub CI jest na `7a52aae`, a lokalny powtórzony test #8 na `86a1e41`. #4 nie ma równoważnego pełnego PASS.
6. **Produkcja:** HUD opublikowano wcześniej (deployment `ba5606b9-a3d2-40e1-a6ee-8514cdf0c02d`, 7/7 testów domeny według raportu). PR #8 nie wdrażał niczego. Marker `pre-gpu-engine-r1` nie jest dowodem dokładnego produkcyjnego SHA.
7. **Liczba obrazów:** 89 nowych PNG na gałęzi miast obejmuje odrzucone próby i klatki efektów; nie jest to liczba zatwierdzonych obiektów.
8. **GPU:** historycznie naprawiony runtime RunPod nie oznacza, że wyłączony obecnie pod, modele, wolumin i cold restart są sprawdzone. `fuse.geesefs` nie dowodzi produktu Network Volume. Kopie runtime/modeli poza woluminem niepotwierdzone.
9. **Oryginalny PDF i referencje:** niektóre materiały wejściowe nie były dostępne Codexowi przy handoff. Nie wymyślać ich treści ani usuwać zachowanych pochodnych ilustracji.
10. **Dokumentacja PR #6 jest rekonstrukcją kanonu i planów; #8 opisuje techniczne przekazanie.** Nie duplikować pełnych procedur GPU ani nadpisywać oryginału; stosować linki przypięte do SHA.

## Werdykt
Zgodność koncepcji świata, mechaniki lokalnego PvE, rozdziału etapów i ochrony danych: **ZALICZONE na poziomie dokumentacji**. Integracja `grounded` z main, finalny aktor, mobilne QA sprzętowe, cold restore GPU, licencje i potwierdzenie SHA wdrożenia: **NIEZWERYFIKOWANE**. Publikacja nowych zmian GPU: **BLOKADA**. PR #6 i #8 pozostawić niescalone do zatwierdzenia.
