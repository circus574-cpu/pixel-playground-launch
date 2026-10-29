# Zmiany — 29.10.2026

## Migracja hostingu Aruba — uzupełnienie gałęzi wdrożeniowej

Właściciel polecił dokończyć migrację; po wskazaniu gałęzi Aruba odpowiedział
„TAK”. Nie scalano gałęzi rozwoju ras z main. Osobny checkout
`/workspace/ki-aruba`, gałąź `migration/aruba-staging-2026-10-28`, punkt wyjścia
`5c2e83e3` (bazowy main `0b5ae9486914962626d8b7bbe5ce09fccbeb35ab`).
Gałąź ras i PR #55 pozostały nietknięte.

Dodano brakujące dwa oryginalne obrazy do `deploy/overlay/public/`:

- cover.png: 2 507 283 B, SHA-256 `d5fada26665d7a34a5ce9a8423681d0c33a2d5a07f9139122b4480e0506aac5c`;
- test-background.png: 2 425 567 B, SHA-256 `efcf1c427bb0ed98341e4f82e950413fcec6bd533a815e321584873f1644bdea`.

Źródło: publiczne oryginały `https://kilegends.pl/` pod dokładnymi ścieżkami
z wcześniej istniejącego `deploy/overlay/SHA256SUMS`. Nie generowano, nie zmieniano
formatu ani jakości; obie sumy MATCH. Nie twierdzimy, że w tej sesji zweryfikowano
cały ZIP eksportu. Historyczny wpis Lovable podaje paczkę `cdbd495f...` na VPS pod
`/home/gh-runner/migracja-archiwa/verified-cdbd495f/KI-LEGENDS-VPS-MIGRACJA`;
**ta ścieżka i kompletność eksportu nie zostały bezpośrednio sprawdzone**.
Nie kopiowano eksportów bazy, hashy haseł ani prywatnych szkiców do publicznego Git.

Skrypt `deploy/scripts/smoke-test.sh`: timeout połączenia 5 s i żądania 20 s,
brak referencji do skryptu aplikacji w HTML stanowi błąd, zamiast pominiętej kontroli.
Dodano CI kontenerów Node 22/Caddy, uruchamiane po pushu na tę gałąź, tylko lokalnie
w runnerze, bez wdrożenia na VPS i bez zmian DNS/backendu.

Środowisko: Docker 28.4.0, Node lokalny 24.19.0. Caddy `2-alpine` pobrany z rejestru,
digest `sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f`.
Procedury Dockera sprawdzono według skill cloud-environment-runtime. Caddy lokalnie
w kontenerze, Node uruchomiony bezpośrednio z prawdziwego `.output/server/index.mjs`.
To nie dowód pełnego docker build ani wdrożenia na Aruba; osobny workflow ma je
sprawdzić w runnerze z większym dyskiem. Lokalnie pozostaje mniej niż 200 MiB.

Pierwszy build/test lokalny po ograniczeniu checkoutu dla oszczędności dysku:
brak `art/pipeline/examples/technical-pack.json` i `art/production/enemies/roster.json`.
Przywrócono te śledzone fixture'y; nie zmieniono kodu gry ani asercji. Pierwszy unit:
801 PASS / 1 FAIL suite (ENOENT), 64/65 plików; nie traktować jako PASS.
Pierwsza próba proxy: środowiskowy HTTP proxy przechwycił połączenie Caddy→lokalny
Node, zwracając „Loopback targets forbidden”. Dla lokalnego upstream dodano
`NO_PROXY=host.docker.internal,localhost,127.0.0.1` wyłącznie w kontenerze QA.
Druga próba wystartowała przed gotowością Caddy (trzy HTTP 000); po gotowości
powtórzono cały smoke. Zewnętrzne połączenia nadal korzystają z proxy środowiska.
W konfiguracji VPS nie dodawano obejść sieci ani wyłączania TLS.

Wyniki końcowe poniżej. Stan Aruba: brak adresu i uwierzytelnienia SSH/Coolify
w tej sesji. Zgłoszono właścicielowi prośbę o adres. Nie wyszukiwano sekretów,
nie uruchamiano GPU, nie zmieniano produkcji, bazy ani DNS. Backend kont i zapisów
pozostaje obecny; migracja samego hostingu nie oznacza eksportu kont ani hasła.


### Wyniki lokalne przed commitem

- `NITRO_PRESET=node-server npm run build`: PASS, `.output/nitro.json` potwierdza
  `preset=node-server` — [log](qa/aruba/node-build.txt).
- `npm run typecheck`: PASS, trzy konfiguracje — [log](qa/aruba/typecheck.txt).
- `npm test` po odtworzeniu fixture: **837/837 PASS, 65/65 plików**, 79,56 s —
  [log](qa/aruba/unit.txt).
- `npm run lint`: 0 błędów / 15 ostrzeżeń — [log](qa/aruba/lint.txt).
- `docker compose --env-file .env.staging.example -f docker-compose.staging.yml config --quiet`: PASS.
- `bash -n deploy/scripts/*.sh`: PASS.
- `caddy validate --config /etc/caddy/Caddyfile` w obrazie Caddy z przełącznikami
  stagingu: PASS — [log](qa/aruba/caddy-validate.txt).
- `bash deploy/scripts/smoke-test.sh http://127.0.0.1:4311 --staging`:
  **19/19 kontroli PASS** — [log](qa/aruba/http-smoke.txt). SSR, 404, zasoby,
  oryginalne obrazy, audio Range/206, immutable JS, no-cache HTML i noindex.
- `node /tmp/ki-aruba-browser.cjs`: pięć prawdziwych nawigacji przez Caddy do
  `/`, `/mapa`, `/konto`, `/admin`, `/test`, **0 pageerror** —
  [log](qa/aruba/browser.txt), [driver](qa/aruba/browser-driver.cjs).
  Screenshoty `page-*.png` obok. Widoczny formularz logowania i odmowa dostępu admina
  bez sesji; **nie logowano na konto produkcyjne, nie testowano zapisu konta ani
  pełnej gry czterech ras**. Test strony nie oznacza odbioru rozgrywki.

Kod gry i jego mechaniki nie zostały zmodyfikowane. Wyniki dotyczą kandydata na
bazie `5c2e83e3` z dodanymi oryginalnymi overlayami i poprawionym skryptem smoke.
Node lokalny 24; pełny Docker/Node 22 sprawdza osobny CI po pushu, wynik musi być
odczytany osobno. Wdrożenie na Aruba, certyfikat domeny testowej, logowanie na
prawdziwe konto, zapis oraz akceptacja rozgrywki pozostają NIEWYKONANE bez dostępu.

## Automatyczne wydania istniejącej usługi Coolify

Właściciel upoważnił bezpośrednią konfigurację produkcji i automatycznych wydań
z main. SSH przez sekret Actions `COOLIFY_SSH_KEY` działa; po dodaniu użytkownika
codex do grupy docker potwierdzono Docker 29.9.2. Nie ma potrzeby przekazywania
prywatnego klucza do tego środowiska ani używania tokenu API po HTTP.

Odczyt serwera wykazał istniejący stos `xh4qbckykxsq1iofxdoe5t3h`, kontenery
`web-...` i `app-...`, konfigurację `/data/coolify/services/<UUID>/docker-compose.yml`
oraz domeny web: `ki-staging.85.235.150.189.sslip.io`, `staging.kilegends.pl`.
Usługa jest ręcznym Compose, bez Git Source. Automatyzacja działa przez Actions,
nie przez nieistniejący przełącznik Auto Deploy w jej panelu.

`aruba-production.yml` serializuje wydania, dostarcza dwa skrypty przez SSH,
buduje dokładny SHA w oddzielnym stosie loopback i wykonuje smoke. Dopiero potem
`promote-coolify-release.sh` zachowuje identyfikatory starych obrazów, podmienia
lokalne tagi używane przez obecną usługę i odtwarza kontenery z jej istniejącym
Compose. Zachowuje routing i środowisko Coolify. Błąd uruchomienia lub smoke
uruchamia przywrócenie starych obrazów. Nie usuwa innych aplikacji i nie dotyka bazy.
Weryfikacja po aktualizacji używa prawdziwego HTTPS `staging.kilegends.pl`.
Przełączenie DNS głównej domeny nie zostało przez te skrypty wykonane.

Pierwszy przebieg automatyzacji: Actions 40825461459 na `3b595be5`.
Wynik wymaga odczytania; sam zapis workflow nie jest zaliczonym wdrożeniem.

Pierwsza promocja istniejącej usługi Coolify: **SUCCESS** na `3b595be5`,
Actions 40825461459. Dwa obrazy odtworzone, 19/19 kontroli HTTPS PASS,
`COOLIFY RELEASE VERIFIED`. [Log](qa/aruba/first-automatic-deployment.txt).
Docelowy trigger ograniczono do main. Głównego DNS nadal nie zmieniano.
Właściciel rozszerzył automatyzację na wszystkie projekty. Tigmig i Balustrador AI
mają osobne prywatne repozytoria; PHU Krenc i Balustrador.pl korzystają z jednego
prywatnego repozytorium na różnych gałęziach migracyjnych — nie zmieniać ich
obu bezmyślnie na main. API GitHub webhooks zwraca 403 dla integracji tej sesji;
nie deklarować skonfigurowanych hooków dla tych repozytoriów.

### Ikona i automatyzacja pozostałych czterech stron

Właściciel wskazał starą ikonę Lovable w karcie. Jawny favicon wskazuje teraz nowy
`/ki-favicon.svg?v=20261029` (własny znak KI); zastąpiono również ICO awaryjne.
Nowy adres ogranicza wpływ starej pamięci przeglądarki, ale otwarta karta telefonu
może wymagać zamknięcia/ponownego otwarcia. Nie zmieniano grafiki ani mechanik gry.

Zainstalowano `ki-project-auto-deploy` na Aruba (restart unless-stopped, 64 MiB).
Co 120 s odczytuje HEAD właściwych czterech prywatnych repozytoriów/gałęzi przez
istniejącą integrację GitHub App Coolify. Nie eksportuje tokenów. Nowy commit
kieruje do natywnej kolejki Coolify; maksymalnie jeden nowy build w przebiegu,
bez ponawiania tej samej nieudanej rewizji w nieskończoność. Obecne gałęzie:
PHU `migration/phu-krenc-aruba-2026-10-29`, Tigmig i AI
`migration/aruba-staging-2026-10-28`, Balustrador.pl `migration/coolify-vps-2026-10-28`.
Nie deklarować, że push do main tych czterech repozytoriów wdraża stronę: śledzone
są wskazane gałęzie wdrożeniowe. Ki Legends ma osobny workflow push main.
Instalacja i odczyt repozytoriów: Actions **40826181680 SUCCESS**. Pierwsze trzy
rewizje miały już zakończone deploymenty; nowszy Balustrador.pl wymaga kolejki.
To nie dowód testowego nowego pushu i pełnej funkcjonalności każdej strony.

Lint początkowo wykazał 15 błędów formatowania starego drivera QA dodanego podczas
migracji; poprawiono format tego jednego pliku. Powtórzenie: 0 błędów/15 ostrzeżeń.
Nie osłabiono kontroli i nie zmieniono asercji.


## Prywatna baza PostgreSQL pod multiplayer

Właściciel zlecił bazę „na VPN”. Zadano pytanie VPS/VPN; do czasu zamknięcia tej
partii nie uzyskano odpowiedzi. Na podstawie kontekstu jawnie przyjęto VPS Aruba,
z najbardziej restrykcyjnym dostępem: wyłącznie wewnętrzna sieć Docker, żadnego
portu publicznego. Nie skonfigurowano ani nie deklarujemy istniejącego VPN.

Oddzielna gałąź `infra/multiplayer-db-vps` od main
`ba73d0780a8432aa7f6e92ed8b884f0c3ac45db3`. Istniejące aplikacje i Supabase są
nietknięte. Nowe pliki: compose.yml, init/001-foundation.sql, verify.sql, install.sh
w deploy/multiplayer oraz workflow multiplayer-database.yml. Obraz przypięty do
zweryfikowanego digestu PostgreSQL 17; sekret wygenerowany na VPS bez logowania.

- `48498402`: pierwszy start, Actions 40850326654 FAIL. Kontener niegotowy.
  [Log](qa/multiplayer-db/first-start-failed.txt).
- `cf36a478`: uprawnienia SQL i diagnostyka, Actions 40850502824 FAIL.
  Odczyt logów potwierdził `ls: can't open /docker-entrypoint-initdb.d/: Permission denied`.
  [Log](qa/multiplayer-db/init-permissions-failed.txt).
- `19ad2c2e`: usunięto zależność od hostowego mountu init; schemat podawany przez
  stdin po starcie i tylko przy braku schematu game. Nieznany schemat powoduje
  odmowę, nie nadpisanie. Sekret pozostaje w katalogu hosta 0700, a plik montowany
  jest czytelny dla procesu DB. Wolumenu nie kasowano.

Końcowy [Actions 40850750063](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40850750063)
**SUCCESS** na `19ad2c2e`; [log](qa/multiplayer-db/private-db-verified.txt).
Kontener healthy; rzeczywiste SQL: zapis warunkowy rewizji przyjęty raz, zapis
przeterminowany odrzucony, duplikat operation UUID odrzucony, ilość 0 i NaN
odrzucone, brak CREATE/TRUNCATE roli runtime. Fixture'y cofnięte ROLLBACK.
pg_dump oraz pg_restore do oddzielnej bazy kontrolnej PASS, wersja schematu=1.
PortBindings=null lub {}, potwierdzony brak wystawienia DB na hosta/internet.
`bash -n deploy/multiplayer/install.sh` PASS; źródła TS i klient niezmienione,
pełnych testów gry/Playwright nie wykonywano dla tej zmiany infrastruktury.

Baza ma 7 tabel (w tym schema_version), ale nie ma procesu serwera gry, sieciowej
walki ani synchronizacji graczy. Nie wgrywano danych kont/postaci ze starej gry.
Nie kopiowano klucza service_role Supabase i nie uruchamiano GPU. Kopia lokalna
nie zastępuje przyszłego backupu zewnętrznego. Nie scalono gałęzi do main.
