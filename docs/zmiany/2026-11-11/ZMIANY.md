# Dziennik zmian — 11 listopada 2026

## Wydajność: audyt FPS i narzędzia pomiarowe

### 1. Pomiar zamiast oceny: co naprawdę kosztuje klatkę

- Właściciel polecił pełny audyt kodu pod kątem spadków FPS na komputerze i telefonach. Wnioski
  pochodzą z pomiaru prawdziwego kodu, nie z lektury: `scripts/perf/audyt-cpu.ts` importuje
  `GameSession` i kit, `scripts/perf/audyt-swiata.ts` liczy pliki świata i limity dekoracji,
  a `scripts/measure-game.ts` mierzy FPS w Chromium na czterech światach i dwóch viewportach.
- **Symulacja nie jest wąskim gardłem:** `session.tick(16,7 ms)` kosztuje 0,082 ms bez wrogów
  i 0,794 ms przy 32 potworach, czyli 4,8 % budżetu klatki 60 fps.
- **Wąskim gardłem jest pamięć tekstur:** 198,2–240,5 MiB w czterech światach przy stałej
  `STREAM_TEXTURE_BUDGET_BYTES = 192 MiB`. Stała jest sprawdzana wyłącznie przy nabywaniu
  atlasów z katalogu (`superiorRuntime.ts:546`); upieczone canvasy podłoża (12 × 1024² × 4 B
  = 48 MiB) i cienie żyją poza tym licznikiem.
- **Pętla widoczności chodzi po całej scenie co klatkę** (`renderSuperior.ts:1002-1010`), bez
  indeksu przestrzennego. Limity dekoracji to 130/chunk w dziczy i 320/chunk w mieście
  (`worldDress.ts:35,37`), więc przy 12 chunkach miasta to 3840 sprawdzeń na klatkę.
  Zmierzone: **1,394 ms/klatkę, 0,363 µs na obiekt, 230 tys. sprawdzeń/s**.
- **HUD:** `report()` odpala się 10×/s (`mountGame.ts:1636`) i woła `snapshot()` za **1,10 ms**,
  w tym `statBreakdown` liczący **sześć pełnych `deriveStats()`** (0,25 ms). Snapshot ma 19 445 B,
  czyli 190 KB alokacji na sekundę. `GameHud.tsx` (1536 linii) ma **zero** `memo`/`useMemo`/`useCallback`.
- **Pieczenie chunku blokuje wątek:** `load()` po `await` piecze synchronicznie canvas 1024²
  w sześciu pełnych przebiegach. W pomiarze pierwsza klatka trwała **18 760 ms** (Nexus-9, desktop),
  13 818 ms (Pyra, mobile) i 12 863 ms (Verdantia, mobile).
- **Ładowanie:** superior-v2 to **3872 pliki i 51,6 MB**; sama Verdantia **1111 plików JSON, 13,9 MB**.
  Zimne wejście 15,4–26,9 s, wybór postaci interaktywny po 9,0–11,4 s.

### 2. Wyniki pomiaru w przeglądarce

Renderer Canvas (kontener bez GPU), 10 s próbkowania na świat, mediana z próbek.

| świat     | desktop FPS | desktop p50 | mobile FPS | mobile p50 | tekstury        |
| --------- | ----------- | ----------- | ---------- | ---------- | --------------- |
| Verdantia | 9,86        | 86,9 ms     | 21,68      | 28,1 ms    | 210,8 MiB       |
| Aetheria  | 13,24       | 75,3 ms     | 26,05      | 23,1 ms    | 233,1 MiB       |
| Nexus-9   | 13,76       | 72,8 ms     | 28,96      | 18,9 ms    | 240,5 MiB       |
| Pyra      | 11,48       | 82,4 ms     | 17,77      | 59,5 ms    | 198,2–202,3 MiB |

- **Koszt rysowania skaluje się z pikselami** (3,5× mniejszy kadr → FPS 9,9 → 29,0), ale
  **pamięć tekstur jest identyczna na telefonie i na desktopie**. Mniejszy ekran nie zmniejsza
  ani jednej tekstury — to najważniejszy wniosek dla urządzeń mobilnych.
- Liczby FPS są pesymistyczne względem telefonu z GPU, bo pomiar szedł na software'owym
  rasteryzerze. Pamięć, liczby obiektów i czasy wejścia są od renderera niezależne.

### 3. Trzy usterki samego harnessu, naprawione przy okazji

- `expect(.ki-hud).toBeVisible()` czekał domyślne **5 s**, krócej niż zimne wejście do świata,
  więc pomiar padał zanim cokolwiek zmierzył. Podniesione do 180 s, sterowane
  `KI_BENCH_HUD_TIMEOUT_MS`; ten sam limit dostali `data-world` i poll na `data-metrics`.
- Harness emulował telefon w **portrait 390×844**, a gra blokuje portrait nakładką
  `RotateNotice` (`pointer: coarse`), która przechwytuje kliknięcia — pomiar nie dochodził do HUD.
  Zmienione na **844×390 landscape**, a `isMobile`/`hasTouch` przestały zależeć od szerokości.
- Dodany filtr `KI_BENCH_VIEWPORT=desktop|mobile`, żeby dało się mierzyć jeden układ bez
  powtarzania całego przebiegu.

### 4. Czego audyt świadomie nie zgłasza

Zweryfikowane w źródle jako poprawne, więc nie są usterkami: `Text.setText` w Phaser sam pilnuje
zmiany (`Text.js:651`), więc etykiety NPC co klatkę są tanie; `sendPosition` ma throttling przez
`sendRateHz` (`networkClient.ts:382`); kontenery aktorów są już przycinane do kadru z zapasem 220 px;
`update()` wychodzi przy `document.hidden`. Rozdzielanie potworów jest O(n²), ale przy limicie 32
to ~1000 porównań i nie boli — zostawione, z adnotacją co zrobić przy podniesieniu limitu.

### 5. Narzędzia i artefakt

- `scripts/perf/audyt-cpu.ts` — koszt `snapshot`, `statBreakdown`, `structuredClone`, `abilities`
  i `tick` przy 0/8/16/32 potworach, na prawdziwej sesji.
- `scripts/perf/audyt-swiata.ts` — pliki i bajty na ląd oraz liczba obiektów iterowanych co klatkę.
- Interaktywny raport z modelem budżetu klatki (9 parametrów na stałych z pomiaru, przełącznik
  desktop/mobile, 15 znalezisk z miejscem w kodzie i plan w pięciu fazach) — artefakt sesji.
- Audyt **nie zmienia kodu gry**. Zmiany dotyczą wyłącznie narzędzi pomiarowych i harnessu.
- Bramka: `eslint` na nowych i zmienionych plikach exit 0; `npm run typecheck` exit 0
  (limit cgroup wrócił do 4 GiB, więc bez flagi kopca).
