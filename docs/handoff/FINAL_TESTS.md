# Końcowa weryfikacja przekazania — 2026-10-21

Testowany commit kodu: **86a1e411339bc41fb218d4633ed2a7bd81e1f167**. Dokumenty bazowe zapisano w `d824ccc400b2f417e6fef656679b72f9297f7b4f`; kolejne commity tej gałęzi zmieniają wyłącznie dokumentację i dowody. Nie zmieniano kodu gry, testów, instalatorów, konfiguracji Cloud ani grafik runtime dla uzyskania PASS. Różnica względem bazy w `src`, `e2e`, `scripts`, `package.json`, lockfile, `.github` i AGENTS jest pusta.

Środowisko lokalne: Node **24.19.0**, npm **11.9.0**, Chromium headless, Playwright 1 worker, Canvas (`--disable-webgl`). Użyto istniejących `node_modules` przez lokalne dowiązanie do drugiego checkoutu; **nowego czystego npm ci nie wykonywano**. Nowa sesja powinna użyć lockfile i npm ci. Wcześniejsze niezależne CI używało Node 22.

| Faktycznie wykonana komenda | Wynik | Liczba / uwagi | Czas | Log |
| --- | --- | --- | ---: | --- |
| `npm run typecheck` | PASS | aplikacja + e2e + narzędzia | 10.76 s | [1.txt](qa/1.txt) |
| `npm run test` | PASS | 97 PASS, 0 FAIL, 0 SKIP, 16 plików | 26.14 s | [2.txt](qa/2.txt) |
| `npm run assets:check` | PASS | katalog, obrazy i budżety | 0.84 s | [3.txt](qa/3.txt) |
| `npm run lint` | PASS | 0 błędów, 7 zastanych ostrzeżeń | 4.9 s | [4.txt](qa/4.txt) |
| `npm run build` | PASS | produkcyjny Cloudflare/Nitro; istniejące ostrzeżenia chunku Phaser/API validator | 4.53 s | [5.txt](qa/5.txt) |
| `CI=true npm run test:e2e -- --output=/workspace/scratch/handoff-e2e --reporter=list` | PASS | 54 PASS, 0 FAIL, 0 SKIP; wszystkie cztery rasy | 893.33 s | [6.txt](qa/6.txt) |

[Maszynowe komendy/SHA/exit/czasy](qa/results.json). Osobny skrypt integracyjny `test:integration`: **NIEWYKONANY — repo nie definiuje takiego polecenia**. Integracje komponentów/loadera/storage/importera są objęte Vitest i E2E powyżej; nie dopisano fikcyjnej dodatkowej liczby testów.

## Zakres pełnych 54 E2E

- Cztery podglądy i starty/sloty, NPC i lokalne cele, odświeżenie, przełączanie i migracja legacy.
- Prawdziwy dotyk i klawiatura w ośmiu kierunkach, pion/poziom, fokus; 360/390/414 px oraz poziome konfiguracje.
- Kolizje, granice, pościg/powrót, naturalna śmierć/respawn i dalszy ruch na każdym świecie.
- Pełne PvE każdej rasy: rzeczywiste wybieranie przeciwników/ataki/KI, 3 zabicia, XP/łupy, nagrody, wyposażenie, kupiec, kowal i reload; bez wstrzykiwania zabójstw.
- HUD, osobne HP/KI przy różnych wartościach/skalach, zwijane narzędzia, podpowiedzi dismiss/expiry, warning zapisu, komunikaty poza celem walki.
- Oryginalne ilustracje, rzeczywisty postęp Phaser, błąd zasobu i retry, uszkodzony atlas. Kontrolowane błędy pobierania są celowo wywoływane w testach negatywnych; nie oznaczają niewykrytego błędu produkcji.
- Błędy JavaScript/konsoli oraz utrata canvasu po wyjściu kontrolowane w odpowiednich scenariuszach, według aktualnych plików `e2e/`. Brak niezaliczonych scenariuszy. Sam build nie był podstawą zaliczenia gry.

Świeże screenshoty z faktycznego startu w tym przebiegu: [Verdantia](qa/verdant-start.png), [Aetheria](qa/aether-start.png), [Nexus-9](qa/nexus-start.png), [Pyra](qa/pyra-start.png). Przedstawiają obecną grę z tymczasowym człowiekiem, nie nową rasę GPU. Historyczne screenshoty w `docs/qa/*` przywrócono po zabezpieczeniu nowych wyników; nie podmieniono starej dokumentacji wygenerowanymi plikami. Trace są retain-on-failure; w tym przebiegu nie było błędu wymagającego trace.

## GitHub Actions i publikacja — odrębne dowody

Ostatni zweryfikowany CI kodu HUD: [39540694141](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39540694141), head **7a52aaeb0412b671e6d9e0bf0825980b7bc131e9**: 97/97 unit i 54/54 E2E (17,3 min), typecheck/assets/lint/build PASS. Kod przeszedł później przez merge `5e72796`, a `86a1e41` dodaje dokumentację. Nie przypisujemy tego workflow nowemu PR dokumentacyjnemu.

Dla PR przekazania automatyczny Actions **nie został uruchomiony**: zmieniono wyłącznie `docs/**`, poza filtrami workflow. Wykonano świeży pełny przebieg lokalny powyżej, zamiast pomijać scenariusze. Nowej publikacji i nowego testu produkcyjnego **nie wykonywano** w zadaniu przekazania; właściciel zakazał wdrożenia. Wcześniejsza publikacja i 7/7 testów domeny mają osobne dowody w [raporcie HUD](../MOBILE-HUD-LAYOUT-2026-10-20.md). Statyczny build marker nie jest SHA.

## GPU i pozostałe niewykonane kontrole

- **PASS offline**: nowe pobranie LFS i SHA/rozmiary 181 obiektów (31 918 089 B), zgodność 179 PNG z pause.manifest, RGBA 512² i alfa z marginesem ≥8 px bez błędów; source .blend zgodny z paired metadata. [LFS](gpu-lfs-verification.json), [ramki](gpu-frame-integrity.json). Nie jest to odbiór jakości animacji ani komplet 416 klatek.
- **NIEWYKONANE**: nowy inference AI, render i instalacja brakujących klatek — GPU wyłączone, brak zgody na kosztowne uruchomienie; brak kompletnego aktora.
- **NIEWYKONANE**: bieżące nvidia-smi/RAM/dysk/wolumin/model SHA na podzie, odczyt checkpoint.json z serwera, pełny cold restart, nowa kopia modeli/runtime poza wolumin — brak sesji z wyłączonym podem; nie deklarowano zabezpieczenia tych danych ponownie.
- **NIEWYKONANE**: fizyczny Android, sprzętowy WebGL, nowe FPS/draw calls/pamięć sterownika, termika/długa sesja/sieć mobilna — brak odpowiedniego sprzętu/zakresu. Historyczne pomiary nie zastępują tych testów.
- Licencje modeli podano ze źródeł, **nie wykonano nowej pełnej oceny prawnej** komercyjnego użycia.

Sprawdzono również lokalne linki trzech dokumentów, brak wzorców sekretów/prywatnych kluczy w dodanych plikach oraz zgodność remote main i SHA Architekta z początkiem audytu. PR #6, gałęzie GPU oraz dwa wcześniejsze worktree pozostały nietknięte. Nie wykonywano merge, force push ani publikacji.
