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
## Parametry trenowane i statystyki gracza

Polecenie właściciela: Unik, szybkość ataku i Technika wyłącznie przez trening lub
premie, bez przyrostu za poziom. Doprecyzowanie: Technika zwiększa krytyk, obrażenia
KI i szansę ponowienia zdolności bez cooldownu. Baza implementacji:
`main@ba73d0780a8432aa7f6e92ed8b884f0c3ac45db3`, gałąź
`feature/character-statistics-training`. Bez scalenia i publikacji.

- `combatTraining.ts`: walidowany postęp trzech dyscyplin, limity i współczynniki.
- `kit/base.ts`: wspólne obliczenia treningu/przedmiotów/buffów, rozbicie wartości,
  obrażenia KI i kontrolowany jednorazowy reset. Nie zmieniono kanonicznych danych.
- `session.ts`: pasywny unik, trening przez rzeczywiste akcje w sali, zatwierdzanie
  dopiero po kosztach zdolności. Konflikt zapisu lub brak miejsca nie przyznaje rangi.
- `CharacterStatsPanel.tsx`, `GameHud.tsx`: kliknięcie/tapnięcie portretu otwiera
  statystyki, baza + trening + przedmioty + zdolności + efekty + GM. Okno zamykane,
  przewijane; bez zmiany joysticka, klawiszy czy pozycji HUD-u.
- Klasyczny zapis8 i Superior4: czytniki wcześniejszych formatów oraz kopia surowego
  payloadu przed migracją. Stary runtime nie usuwa nowych parametrów po downgrade.
- Współczynniki i ograniczenia: [rozwój i walka](../../ROZWOJ-I-WALKA.md#parametry-trenowane-i-podgląd-postaci--29102026).

Dowody: katalog [qa/character-statistics](qa/character-statistics/).
Pierwszy zestaw przeglądarkowy bez emulacji touch:4/4. Próba touch w pionie została
zatrzymana przez istniejący obowiązkowy ekran obrotu, a kolejne próby przez zabite
procesy Chromium/Vite (cgroup `oom_kill=9`, `Target crashed`, następnie połączenie
odrzucone). Nie jest to dowód błędu nowych statystyk. Zachowano logi niepowodzeń.
Scenariusz dotykowy następnie obraca viewport jak gracz, bez ukrywania nakładek lub
manipulacji stanem. Po przejściu na statyczny build lokalnego playtestu Canvas4/4,
bez błędów JavaScript, z ponownym wczytaniem każdej rasy.

Pierwszy build aplikacji przerwany: `No space left on device`. Usunięto wyłącznie
lokalne własne katalogi buildów `.playtest-dist`/`.output`, nie assety źródłowe;
powtórzenie `npm run build` zakończone sukcesem. Zmniejszony techniczny build
playtestu bez kopiowania `public`, z symlinkami do tych samych źródeł, ograniczył
powielanie plików i zużycie pamięci serwera dev. Tymczasowa konfiguracja usunięta.

Pozostaje odbiór na fizycznym Androidzie/iOS i ocena tempa treningu przez właściciela.
Współczynniki nowych statystyk to decyzja implementacyjna, nie wartości z aneksu.
Nie podłączono niescalonego rozwoju ras PR55 ani niezależnego backendu PR59.

Końcowa kontrola identycznego drzewa źródeł przed commitem:

| Komenda | Wynik |
| --- | --- |
| `npm run typecheck` | PASS, wszystkie3 konfiguracje |
| `npm run lint` | PASS, 0błędów, 15 istniejących ostrzeżeń |
| `npm run build` | PASS, pełny build produkcyjny |
| `npm test` | PASS, 854/854, 66 plików, 0pominiętych |
| Playwright `character-statistics.spec.ts --project=gameplay` Canvas | 4/4 PASS |
| Ta sama specyfikacja z `KI_QA_WEBGL=1` | 4/4 PASS, Software WebGL |
| `python3 scripts/docs/check_documentation.py` | PASS po odtworzeniu5 pominiętych przez sparse checkout, śledzonych referencji |

Komplet poleceń i SHA-256 testowanych źródeł: [verification.json](qa/character-statistics/verification.json).
Logi, raporty JSON i8 zrzutów są obok. Testy przeglądarkowe to nowa funkcja
statystyk, nie deklaracja wykonania całej istniejącej macierzy E2E gry. Testy walki,
questów, ekonomii i zapisów objęto zestawem jednostkowym/integracyjnym GameSession.
Ostrzeżenia JSDOM o audio/canvas pozostają w logach; testy nie zostały pominięte.

Implementacja: `c9360483` · [PR61](https://github.com/circus574-cpu/pixel-playground-launch/pull/61).
Dodatkowy commit dowodowy zapisuje logi jako `.txt`, ponieważ `.gitignore` pomija
`.log`. SHA-256 plików w `verification.json` pozwala potwierdzić identyczność
przetestowanych źródeł z commitem implementacji. PR pozostaje do przeglądu;
`main` i produkcja niezmienione przez tę gałąź.

GitHub uruchomił pełne kontrole PR: [Browser QA](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40860896479)
i [WebGL](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40860896427).
Na moment zapisu dowodów są w toku, nie oznaczono ich jako PASS. Logi tekstowe mają
usunięte końcowe białe znaki; treść komunikatów zachowana.
## Pełne odcięcie od Lovable — nowy backend Ki Legends

Właściciel wyraźnie wybrał osobny projekt na własnym Supabase, bez Lovable Cloud.
Potwierdzono organizację `circus574-cpu's Org`, plan Free; utworzono aktywny projekt
`ki-legends`, ref `ekqljyldtzbpytqrtaer`, region `eu-central-1`. Nie zmieniono planu.
**Projekt nie ma jeszcze odtworzonych danych; aplikacja NIE została przełączona.**
Dotychczasowy backend Ki Legends: `istakaetceprpnbafdgu.supabase.co`.
Własny backend Tigmig i Balustrador.pl: `drpesmyumjhncnleiity.supabase.co`, widoczny
na połączonym koncie właściciela. Nie nadpisywać jego tabel ani kont migracją gry.
Dla PHU/AI w sprawdzonych zasobach nie wykryto hosta Supabase; nie jest to dowód
braku innych zależności serwerowych od Lovable.

Na Aruba istnieje kopia eksportu: `/home/gh-runner/migracja-archiwa/verified-cdbd495f/KI-LEGENDS-VPS-MIGRACJA/database/schema.sql`.
Potwierdzono lokalizację, nie potwierdzono kompletności auth.users/auth.identities.
Workflow `migration-transfer.yml` w gałęzi `fix/tigmig-domain-routing` tworzy
szyfrowaną CMS kopię katalogu database i BRAKI-I-OGRANICZENIA.md. Actions
40830244873 SUCCESS. W Git jest WYŁĄCZNIE publiczny certyfikat odbiorcy, nigdy
prywatny klucz ani odszyfrowany eksport. Prywatny klucz sesji pozostaje lokalnie
`/workspace/.ki-migration-private/key.pem` (nie zabezpieczono go poza workspace).
Oryginalne dane VPS są niezmienione. Artefakt zaszyfrowany ma retencję jeden dzień.

Pobranie artefaktu do tej sesji dwukrotnie zwróciło Forbidden z magazynu Actions.
Nie odszyfrowano ani nie importowano bazy. Nie deklarować migracji kont, haseł,
Storage, polityk czy danych jako ukończonej. Dalsze kroki: przywrócić bezpieczny
dostęp do eksportu, zweryfikować auth i metadane prywatnych plików, odtworzyć
nowy projekt, sprawdzić RLS i logowanie oraz dopiero wtedy przełączyć konfigurację
serwera/przeglądarki. Nie wpisywać nowych URL/kluczy przed odtworzeniem danych.
Brak kluczy źródłowego Lovable Cloud nie uzasadnia publicznych bucketów ani resetu kont.

### Odszyfrowany eksport i odtworzona struktura nowego Supabase

Właściciel przesłał zaszyfrowany artefakt ZIP; lokalnie odszyfrowano go istniejącym
kluczem sesji. Prywatne pliki są pod `/workspace/.ki-migration-private/export`,
poza Git, z prawami 0600. Paczka zawiera schema.sql, restore.sh, sześć CSV oraz
README/braki. Liczby: characters 22, profiles 1, user_roles 1, admin_audit 1,
sketch_api_log 34, unieważnione sketch_api_tokens bez hashy 3.
**Brak auth.users, auth.identities i hashy haseł, brak zawartości Storage w tej paczce.**
Nie importowano osieroconych zapisów z pominięciem kluczy obcych i nie resetowano kont.
Eksport jest snapshotem 28.10 — przed cutoverem potrzebny aktualny pełny eksport.

Potwierdzono pusty schemat public nowego `ekqljyldtzbpytqrtaer`; zastosowano migracje:
`restore_ki_legends_structure_with_restricted_client_grants` i
`restrict_sketch_token_rpcs_to_server_role`. Wersje SQL bez danych użytkowników
zapisano pod `deploy/database/`. Źródłowy eksport dawał authenticated TRUNCATE
(omija RLS), więc w nowym projekcie ograniczono granty do wymaganych operacji
SELECT/INSERT/UPDATE/DELETE i UPDATE(nick). Nie zmieniano źródłowej produkcji.
Domyślne granty funkcji Supabase wymagały osobnego odebrania uprawnień anon i
client do consume/rotate tokenów, mimo wcześniejszego REVOKE PUBLIC.

Test SQL po poprawkach: sześć tabel z RLS=true, 10 polityk, anon SELECT=false,
authenticated TRUNCATE=false na wszystkich sześciu; prywatny bucket project-sketches;
rotate RPC anon=false, authenticated=false, service_role=true. Auth users=0,
character saves=0 — dane czekają na pełny eksport kont. Doradca bezpieczeństwa
przed poprawką wykrył nadmierne uprawnienia RPC; po poprawce należy ponowić audit.
Role helpers has_role/is_staff są celowo SECURITY DEFINER dla polityk bez
rekurencji; dostęp anon/Public cofnięto. Tabele tokenów/logów nie mają polityk
klienta celowo: dostęp tylko serwerowy.
Aplikacja nadal używa starego backendu; nie deklarować ukończonego odcięcia Lovable.

### Pełny backup z kontem — import danych wykonany

Właściciel dostarczył `pixel-playground-launch_261029.backup.zip`. W środku jest
PGDMP 1.16 (zstd), 411948 B, SHA-256
`53bd271b526a0a4d1e7aae0c45198347dbf9378fce99f0b61d369b0079b57d9b`.
TOC podaje źródło PostgreSQL 17.11, pg_dump 18.6; pg_restore 17-alpine poprawnie
odczytał format. Dane pozostają poza Git w `/workspace/.ki-migration-private/`.
Do zwolnienia miejsca usunięto wyłącznie własne odtwarzalne buildy .output i
.playtest-dist; nie usuwano źródeł, backupów, danych VPS ani GPU.

Import w transakcji do własnego `ekqljyldtzbpytqrtaer` zakończył się sukcesem:
1 auth.users z zachowanym hashem hasła i potwierdzonym e-mailem, 1 identity,
1 profil, 1 rola, 22 characters, 1 admin_audit, 34 sketch_api_log i 3 historyczne
unieważnione tokeny. Brak osieroconych zapisów. Nie resetowano hasła/UUID.
Nie przeniesiono starych sesji, refresh tokenów ani wewnętrznych migracji providera;
po przełączeniu będzie wymagane ponowne zalogowanie.
Przed importem kontrola odmawiała wykonania na niepustym celu. Rzeczywisty import
najpierw został zatrzymany przez kontrolę kompletności lokalnego tekstu (brak
końcowego newline); poprawiono kontrolę końca, nie dane. SQL nie opublikowano.

Test pod rolą authenticated: właściciel widzi 22 zapisy i profil; TRUNCATE oraz
RPC rotacji tokenów odmówione. Wszystkie wyłączone na czas odtwarzania wyzwalacze
ponownie aktywne; active_tokens=0. Dane źródłowe i docelowe liczbowo zgodne.
[Manifest bez danych osobowych](qa/independent-supabase/source-counts.json).
Skrypt przygotowania prywatnego importu w deploy/database nie zawiera rekordów
ani hashy; generowane import.sql pozostaje prywatne i nie wolno go commitować.

Backup zawiera metadane 19 storage.objects i 2 bucketów, ale nie binarne pliki.
Nowy Storage pozostaje pusty (project-sketches jest prywatny). Przed cutoverem
potrzebne są binarne obiekty z archiwum VPS oraz serwerowy klucz nowego projektu
w bezpiecznej konfiguracji. MCP udostępnia wyłącznie klucze publiczne, nie
service_role. Nie wyciągać sekretów z bazy i nie publikować bucketu jako obejścia.
Aplikacja nadal korzysta ze źródłowego backendu — nie deklarować pełnej migracji.

## Integracja oczekujących gałęzi na polecenie właściciela

Odczytano96 gałęzi remote i20 otwartych PR. Stan bazowy main:
`ba73d0780a8432aa7f6e92ed8b884f0c3ac45db3`. 57 końcówek gałęzi było już przodkami
main. Pełny wykaz SHA, liczników rozbieżności, zmienionych plików i decyzji:
[branches-before.json](qa/branch-integration/branches-before.json).

PR60 scalony przez GitHub do `0234c2ca3661e09f7a1e8f94082c8cf71c4188d4`.
Na `integration/pending-branches-20261029` połączono następnie PR55,61,59 oraz
ręczny workflow diagnostyczny `ops/coolify-ssh-access`. Gałąź migracji59 zawiera
również wcześniejsze komendy diagnostyczne `fix/tigmig-domain-routing`.

Konflikty rozwiązano łącząc obie implementacje, nie przez nadpisanie całych plików:
- rozwój/trening/broń dziedzictwa i indywidualne statystyki GM;
- rozdzielone okna Rozwój oraz Statystyki, bez zmiany sterowania;
- wspólny zapis9/Superior5, czytniki obu gałęzi i blokada utraty istniejących danych;
- zachowane obie historie dzienników i aktualnych dokumentów.

Pierwsza integracja PR55:960/960 testów. Integracja PR55+61 po poprawieniu historycznej
fixture migracyjnej:985/985 testów w76 plikach. Fixture tworzy teraz jawnie zapis
Superior1, ponieważ nowy writer tworzy już5; zachowano asercję kopii bajtowej i
odrzucania nieznanych pól. Dodatkowe testy migracji obejmują klasyczne5–8 iSuperior1–4.

PR10/12/14 mają `git cherry` bez unikalnych patchy względem main. Zamknięto stare PR,
zachowując gałęzie. Pozostałych prototypów i starych grafik nie nałożono na nowszą
grafikę, atlas i kanon. Brak scalania nie jest równoznaczny z usunięciem ich pracy.
W szczególności Draft6 Architekta pozostaje nienadpisany.

Wynik pełnego CI PR61: Software WebGL38 PASS/7 FAIL, run40861053178. Main już przed
PR61 dokumentował analogiczny problem `liveEnemy` w CI52: run40653403301,
KL-2026-10-28-05. Przyczyna nie została tu dowiedziona i nie ogłaszamy pełnej zielonej
regresji. Kontrole tej integracji i rzeczywiste wąskie scenariusze mają osobne logi.

Scalenie narzędzi Supabase nie przełącza klienta na nową bazę i nie wykonuje importu
prywatnych danych. Zachowano status brakujących plików Storage i klucza serwerowego.
Korzystano z instrukcji skill Supabase do oceny granic tej zmiany; bez nowej migracji
wykonywanej na zewnętrznej bazie. GPU nie dotykano.

Końcowe kontrole integracji:
- pełny TypeScript (3konfiguracje):PASS;
- lint:0błędów/15 istniejących ostrzeżeń;
- jednostkowe/integracyjne:985/985,76 plików;
- build produkcyjny:PASS;
- Canvas: statystyki4/4 i dziedzictwo Planetarnych/Androidów/Legend3/3 w pierwszej
  partii. Mędrcy dotarli do gotowego rozdziału, lecz screenshot przerwał `ENOSPC`.
  Po usunięciu lokalnego buildu `.output` powtórka Mędrców1/1 PASS. Nie zmieniano
  asercji ani kodu gry dla obejścia tego problemu.

Autodeploy po PR60 (run40868266802) przeszedł build i wszystkie testy kandydata,
lecz po zamianie kontenerów pierwsze żądania `/healthz` i `/` zwróciły503, a kolejne
trasy200. Nastąpił istniejący rollback. Dodano ograniczoną do30 prób bramkę rzeczywistej
gotowości HTTP przed pełnym, niezmienionym smoke testem; trwały błąd nadal powoduje
rollback. Mock wykonujący tę samą funkcję shell: przejściowe503→200 PASS oraz
stałe503→odmowa po30 próbach PASS. Nie ogłaszamy nowego wdrożenia na podstawie push.

Software WebGL statystyk po integracji:4/4 PASS. Łącznie12 unikalnych wąskich
scenariuszy zaliczonych po jednej powtórce środowiskowej. Logi i screenshoty:
[qa/branch-integration](qa/branch-integration/); manifest poleceń/wyników i sum
źródeł: [verification.json](qa/branch-integration/verification.json).
Pełna macierz E2E nadal nie ma zielonego odbioru; nie zaliczono fizycznych telefonów.

Audyt PR20 odzyskał rzeczywiście brakujący oryginalny PDF aneksu ras i drzewek
(103455 bajtów, SHA `0358053e7e467bffd41055f50f765d0f33cbf15c6b0176266c866d493dda5cff`).
Suma zgadza się z metadanymi aktualnego kanonicznego JSON; źródło zachowano bez
zmiany bajtów w `docs/design/source-annexes/`, poprawiając nieaktualny komunikat INDEX.
Nie przywrócono starego JSON/CSV ani listy20 potworów — obowiązuje bestiariusz40.
PR20 i gałąź historyczna zachowane do porównania pozostałych historycznych różnic.

## Stan po scaleniu i publikacji — aktualizacja dokumentacji

Bieżący punkt odniesienia kodu: `main@5cea48dae81171b5e3bea1eeff124a0d8857ad76`.
To potwierdzone wydanie, a nie tylko wypchnięta gałąź. [PR #62](https://github.com/circus574-cpu/pixel-playground-launch/pull/62)
połączył #55 (częściowy rozwój ras), #59 (narzędzia migracji Supabase) i #61
(nowe parametry treningu/statystyki). #60 (prywatna baza multiplayer VPS) scalono
wcześniej. Wszystkie cztery źródłowe PR-y mają stan MERGED; aktualne drzewo kodu
wydania było identyczne z lokalnie sprawdzoną integracją.

### Gałęzie i pozostałe PR-y

Audyt objął 96 pierwotnych końcówek gałęzi: 57 było już przodkami main, po
integracji jest ich 63. Pozostałe 33 rozbieżne gałęzie nie zostały automatycznie
nałożone na nowszy kod. Nie usuwano gałęzi i nie przepisywano opublikowanej historii.

Zamknięte jako historyczne, zastąpione lub patch-equivalent:
#3, #8, #10, #12, #13, #14, #18, #19, #20, #21, #22, #27 i #50.
Zamknięcie nie oznacza scalenia wszystkich ich dawnych plików; oryginały
pozostają dostępne w gałęziach. Z #20 odzyskano zweryfikowany aneks ras/drzewek,
bez przywracania starego bestiariusza 20 potworów. Otwarte pozostały tylko:

| PR | Stan | Powód pozostawienia |
| --- | --- | --- |
| #4 | Draft | Historyczny checkpoint produkcji Planetarnych; wymaga odbioru zamiast podmiany aktualnej grafiki |
| #6 | Draft | Dokumentacja Architekta do zatwierdzenia; nie została nadpisana ani scalona |
| #11 | Draft | Historyczna integracja Mędrca z konfliktami/odbiorem; nie zastępuje obecnych paczek HD |

[Snapshot stanów PR](qa/post-integration-documentation/pull-requests.json),
[pełny audyt gałęzi sprzed integracji](qa/branch-integration/branches-before.json).

### Publikacja zweryfikowana

[Aruba deployment 40871582683](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40871582683)
zakończył się **SUCCESS** dla `5cea48da`. Log potwierdził pełne kontrole kandydata,
kontrole po promocji i `COOLIFY RELEASE VERIFIED` z pełnym SHA. Publiczne `/`,
`/healthz`, `/mapa` oraz staging odpowiadały HTTP 200 po zakończeniu promocji.
Wcześniejszy rollback po #60 i bramka gotowości HTTP są opisane wyżej;
nie uznano tamtej nieudanej próby za publikację.

W rzeczywistym Chromium na `https://kilegends.pl/` wykonano:
wybór Planetarnych → rozpoczęcie przygody → wejście do świata → kliknięcie portretu
→ odczyt Techniki, Uniku i szybkości ataku → zamknięcie okna. Wynik PASS,
zero zdarzeń `pageerror`. Jest to wąski test produkcji, bez logowania na konto
właściciela i bez zmiany prywatnych danych.

Dowody utrwalone z wykonanego wcześniej testu, bez ponownego deklarowania jego
wykonania podczas tej aktualizacji:
[log](qa/post-integration-documentation/production-smoke.txt),
[źródło skryptu](qa/post-integration-documentation/production-smoke.mjs.txt),
[zrzut produkcji](qa/post-integration-documentation/production-statistics.png),
[status wdrożenia](qa/post-integration-documentation/deployment.json),
[proweniencja i SHA-256](qa/post-integration-documentation/provenance.json).
Skrypt dowodowy zawiera ścieżki ówczesnego workspace; nie jest nowym narzędziem
instalacyjnym ani gotową uniwersalną komendą dla innego środowiska.

### Wyniki a ograniczenia

| Zakres | Rzeczywisty wynik | Punkt odniesienia |
| --- | --- | --- |
| Integracja lokalna | 985/985 testów, 76 plików, TypeScript PASS, lint 0 błędów / 15 ostrzeżeń, build PASS | Kod integracji prowadzący do `5cea48da`; logi i sumy źródeł w `qa/branch-integration/` |
| Wąskie scenariusze przeglądarkowe | 12 unikalnych przypadków zaliczonych: Canvas 8 i Software WebGL 4 | Jedna powtórka Mędrców po ENOSPC podczas zapisu screenshotu; pierwotna próba zachowana |
| Pełne CI PR #61 | WebGL 38 PASS / 7 FAIL | Run 40861053178; problem `liveEnemy`, analogiczny do wcześniejszego audytu #52, przyczyna niezamknięta |
| Pełne CI PR #62 | W toku w utrwalonym odczycie | [Snapshot](qa/post-integration-documentation/ci-observed.json); nie przypisano mu lokalnego PASS |
| Publikacja | SUCCESS i wąski smoke Chromium PASS | Wdrożony `5cea48da`, run 40871582683 |
| Fizyczny Android/iOS, pomiary FPS i pamięci urządzeń | NIEWYKONANE w tej integracji | Emulacja Chromium nie stanowi takiego odbioru |

Rozwój #55 jest scalony, lecz **nie ukończony w pełnym zakresie właściciela**.
Pozostają późne rozdziały/projekty, bronie 3–6, próby/progi, ochrony i eskorty
bojowe, mistrzostwa, narracja i odbiór balansu. Samo istnienie definicji nie zamyka
tych zadań. Nie włączono walki zwykłych NPC ani serwera autorytatywnego.

Scalenie #59 nie przełączyło aktywnego backendu: pliki Storage, bezpieczny klucz
serwerowy, Auth/SMTP, końcowa zgodność danych i cutover pozostają do wykonania.
Prywatny PostgreSQL z #60 jest oddzielnym fundamentem pod przyszły serwer,
a nie działającym multiplayerem. W tej aktualizacji dokumentacji nie wykonywano
zapytań do bazy, migracji danych, operacji Storage ani działań na GPU.

### Zakres tej aktualizacji dokumentacji

Uaktualniono INDEX, plan, architekturę, rozwój/walkę i rasy. Bieżące formaty
klasyczny 9 / Superior 5 zastępują stare aktywne opisy v5. Datowane checkpointy
zachowano jako historię. Z kodu/manifestu sprawdzono aktualne paczki bohaterów
`*-walk-v3` w wersji 2.0.0, klatki 256 px i prezentację 133×133 zamiast dawnego
opisu 128 px / 160×160. Nie zmieniono samych grafik ani ustawień renderowania.

Nie uruchamiano ponownie gry, pełnego Vitest, Playwright ani buildu wyłącznie dla
zmian tekstowych. Wyniki 985/12 odnoszą się do wcześniejszej integracji i jej
zachowanych dowodów. Kontrole tej partii obejmują pełny TypeScript, walidację
struktury dokumentacji/odnośników, sumy zapisanych dowodów i brak zmian runtime.

## Korekta czytelności statystyk postaci

Właściciel doprecyzował format: `Atak: X`, a przy przedmiocie czerwone `+ Y`.
Zmieniono wyłącznie prezentację `CharacterStatsPanel`: jedna linia, bez „Baza”
i widocznych warstw treningu/zdolności/buffów/GM, premia wyposażenia tylko niezerowa.
Wartość główna nie zawiera drugi raz osobno pokazywanej premii; nadpisanie GM
pozostaje końcową liczbą. Nie zmieniono walki, statystyk, treningu ani formatu zapisu.

Regresja UI sprawdza brak dodatkowej etykiety, czerwone +8 z rzeczywistego ostrza,
brak podwójnego zliczenia, parametr wytrenowany i końcową wartość GM.
Polecenie `npx vitest run src/test/character-statistics-ui.test.tsx src/test/combat-training.test.ts src/test/game-hud.test.tsx src/test/kit.test.ts src/test/branch-integration.test.ts`:
54/54 PASS w 5 plikach. Pełny TypeScript PASS, lint 0 błędów / 15 wcześniejszych
ostrzeżeń. To kontrole tej korekty, nie ponowna pełna regresja 985 testów.

Lokalny build playtestu PASS. W rzeczywistym Phaser/Chromium: otwarcie okna,
wyświetlenie statystyk, zamknięcie i reload wszystkich czterech ras — 4/4 PASS.
Dowody: [qa/compact-statistics](qa/compact-statistics/), w tym desktop i emulowany
telefon po wymaganym obrocie. Nie wykonano nowego testu fizycznego telefonu.


## Selekcja grafik KI Combat VFX z Gemini

29.10.2026: udokumentowano przegląd sześciu plansz VFX (36 kafli) z publicznego
udostępnienia Gemini. **20 kandydatów, 4 rezerwy, 12 duplikatów**, bez wdrażania
i bez zmian w rozgrywce. Najbardziej przydatne: unikatowe efekty Planetarnych
i Mędrców. Oryginalne pliki z publicznej strony nie są dostępne do bezpośredniego
pobrania; udokumentowano odrębnie 6 lokalnych roboczych wycinków JPEG→RGBA.

- [Szczegółowa ocena, ograniczenia i mapowanie umiejętności](GEMINI-VFX-SELEKCJA.md)
- [Katalog 36 decyzji](qa/gemini-vfx-selekcja.csv)
- Status: **dokumentacja w repozytorium**, brak importu binariów i brak certyfikacji
  licencji/alpha/animacji; środowiska produkcyjne pozostawione bez zmian.
