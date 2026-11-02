# Zmiany — 2026-11-02

## Jeden serwer gry „Superior” w panelu administratora

### 1. Usunięcie fikcyjnych węzłów serwera

Decyzja właściciela 02.11: na VPS Aruba działa jeden serwer gry, „Superior” na 50 graczy;
pozostałe wpisy mają zniknąć.

- Panel `/admin` (centrum monitoringu) pokazywał trzy węzły z kodu (`adminTelemetry.ts`, commit
  `0165752` z 31.10): prawdziwy EU-Central (85.235.150.189) oraz nieistniejące „EU-West
  (Amsterdam)” 10.24.10.12 i „US-East (Virginia)” 10.24.20.15 oznaczone jako „online”.
  Lista żyła tylko w `localStorage` przeglądarki.
- Teraz jest jeden węzeł `eu-central-1` „Superior”, limit 50, host VPS, port 7420.
  `normalizeServerNodes` czyści zapisane listy: usuwa fikcyjne węzły, przenosi nazwę, limit i
  tick z wpisu właściciela „Superior”, a port i host zawsze ustawia na VPS.
- Usunięto tworzenie i usuwanie węzłów; port i host są tylko do odczytu, bo Caddy kieruje `/ws`
  wyłącznie na port 7420 — serwer uruchomiony na innym porcie odcinał graczy.
- Proces gry (`gameServer.ts`, `managedServer.ts`): domyślnie „Superior” i 50 graczy; wartości
  ustawione w panelu mają pierwszeństwo przed zmiennymi środowiska kontenera.
  `deploy/multiplayer/compose.yml`: `GAME_SERVER_NAME=Superior`, `GAME_SERVER_MAX_PLAYERS=50`.
  Zmiennych środowiska usługi Coolify na VPS nie weryfikowano z repozytorium.
- Testy: `single-superior-server.test.ts`, zaktualizowany `admin-monitoring.test.tsx`.
  Pełny zestaw 1063/1063, typecheck i lint bez błędów.

### 2. Czytelny panel administratora: bossowie, okno przedmiotu, spawny, dziennik publikacji

Zgłoszenie właściciela 02.11: brak podglądu bossów, podgląd przedmiotu ucięty w połowie, brak
szczegółowej listy spawnów, chaos w układzie, dziennik bez informacji o publikacjach.

- `/admin`: jedna nawigacja — Postacie (live), Konta i role, Serwer, Świat i zawartość, Dziennik,
  Postacie lokalne. Usunięto zagnieżdżony drugi panel („Coder”), który powtarzał wszystkie zakładki;
  zostały w nim tylko postacie zapisane na urządzeniu. Szerokie tabele przewijają się wewnątrz
  panelu, a zakładki na telefonie w jednym rzędzie.
- Edytor świata: krótsze nazwy zakładek w kolejności użycia; nowa zakładka „Spawny (lista)”.
- Bossowie: karty z animacją (`public/game/bosses/*_idle.webp`), statystykami w opisanej siatce,
  atakami, fazami, słabością i łupem z edycją szans.
- Przedmiot: kliknięcie ikony lub nazwy otwiera okno na środku ekranu (zamknięcie: ×, tło, Esc) —
  premie, efekt, zestaw, cena oraz źródła w tabeli (potwór, kraina, poziom, szansa, rodzaj).
  Karty katalogu pokazują krótkie podsumowanie źródeł zamiast długiej listy.
- Spawny: dane z `superior-v2/<ląd>/spawns.json` — podsumowanie per potwór (punkty, grupy,
  odrodzenie, smycz) i stronicowana lista punktów (ID, X, Y, odrodzenie, smycz, grupa).
- Dziennik: „Publikacje na produkcji” z pliku `publications.json`, generowanego przy każdym
  wdrożeniu przez `scripts/build_publications.mjs` (historia `main` i wpisy dzienników zmian), oraz
  dotychczasowe zmiany wykonane w panelu.
- QA: `scripts/qa-admin-catalog.mjs` zaktualizowany do nowego układu (1280 i 390 px, okno w
  granicach ekranu, animacje bossów, lista spawnów, 0 błędów JS); `admin-readability.test.tsx`.

### 3. Konta graczy na VPS (PostgreSQL) z aktywacją e-mail przez Resend — etap 1: serwer

Decyzja właściciela 02.11: wszystko na VPS. Do tej pory logowanie, nicki i role były w Supabase
Lovable Cloud (`istakaetceprpnbafdgu`), a na VPS tylko gra i postacie.

- Baza: `deploy/multiplayer/init/005-accounts.sql` — schemat `accounts` (użytkownicy, role,
  jednorazowe linki, sesje, dziennik). `install.sh` robi kopię bazy i stosuje migrację raz.
- API pod `/ws/auth/*` (serwer gry, ta sama trasa Caddy co `/ws`): rejestracja, aktywacja linkiem,
  ponowne wysłanie linku, logowanie, odświeżanie i wylogowanie, zapomniane hasło, nowe hasło,
  `me`, a dla administratora lista kont, role i dziennik. Hasła: scrypt; tokeny dostępu HS256 na
  15 min; sesje i linki przechowywane tylko jako SHA-256; limity prób na IP i e-mail.
- E-mail: Resend HTTP API (`RESEND_API_KEY`, `EMAIL_FROM`). Bez klucza rejestracja zwraca
  „Wysyłka e-maili nie jest jeszcze skonfigurowana”.
- Przeniesienie kont: przy pierwszym logowaniu gracza z dotychczasowej bazy serwer jednorazowo
  sprawdza e-mail i hasło u poprzedniego dostawcy i zakłada konto na VPS z tym samym ID, nickiem
  i rolami — postacie zostają przypisane bez zmian w danych gry.
- Serwer gry i panel admina przyjmują nowe tokeny; tokeny Supabase działają w okresie przejściowym.
- Etap 2 (osobny PR): `/konto` i panel admina przełączone na nowe API.
- Testy: `accounts-crypto.test.ts`, `accounts-service.test.ts` (PostgreSQL, w workflow QA online).
