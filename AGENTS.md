# AGENTS.md — KI Legends (stan: 04.11.2026)

## Źródła prawdy i procedura agenta
- Zanim zmienisz kod, przeczytaj `docs/INDEX.md`, `docs/ZASADY.md`, odpowiedni dokument tematyczny i najnowszy dziennik `docs/zmiany/YYYY-MM-DD/ZMIANY.md`. Sprawdź aktualne `main`, powiązane PR-y i rzeczywiste pliki. Dzienniki z poprzednich dat są historią, nie obowiązującym stanem.
- Rozróżniaj: pomysł, dane/asset, kod w gałęzi, otwarty PR, merge do `main`, test lokalny, wdrożenie na VPS i test produkcyjny. Nie przypisuj ukończenia funkcji na podstawie samego opisu PR ani liczby plików.
- Każdą zmianę opisuj w istniejącym dzienniku danego dnia; aktualizuj adekwatne podręczniki. Dokumentacja ma dokładnie 10 tematycznych plików `docs/*.md` wymienionych w indeksie, plus dzienniki i dane źródłowe.
- Nie nadpisuj zatwierdzonej historii Gita; bez force push, rebase/amend opublikowanych commitów. Nie scalaj PR, nie publikuj produkcji i nie zmieniaj konfiguracji serwera produkcyjnego bez odrębnej zgody właściciela. Do prac dokumentacyjnych stosuj osobną gałąź i PR.

## Aktualna infrastruktura — OBOWIĄZUJĄCE
- **KI Legends już działa w architekturze serwerowej na VPS Aruba/Coolify. PostgreSQL 17 jest działającą prywatną bazą projektu; NIE jest tylko planem ani 'bazą pod przyszły multiplayer'.** Serwer gry to proces Node `src/server/gameServer.ts`, zarządzany przez `src/server/managedServer.ts`; domyślnie pojedynczy węzeł `Superior`, port 7420, 20 ticków/s, limit konfiguracji 50 graczy (nie udowodniona wydajność dla 50 połączeń).
- Produkcyjna ścieżka postaci i PvE jest serwerowa: PR #69, `src/server/characters/{repository,onlineSession,socket,superiorSimulation}.ts`, klient `src/game/online/client.ts`, endpoint `/ws/online`. GameSession i obliczenia rozwoju/walki działają po stronie serwera; klient Phaser wysyła intencje i prezentuje snapshoty. Postać i operacje mają trwałość w PostgreSQL, lease, walidację właściciela i obsługę powtórzeń. Błąd serwera/bazy blokuje online PvE; **nie uruchamiaj lokalnego fallbacku zapisu**.
- Konta, tokeny, role, aktywacja i reset hasła zostały przeniesione na VPS/PostgreSQL (PR #76 i #77): `src/server/accounts/`, schemat `deploy/multiplayer/init/005-accounts.sql`, `/ws/auth/*`, `/konto` i `/admin`. Resend służy do e-maili aktywacyjnych, jeśli usługa jest skonfigurowana. Historyczny Supabase służy przejściu/legacy oraz osobnym funkcjom; NIE przedstawiaj go jako głównej bazy aktywnych kont i postaci.
- Zmiany świata z `/admin` mają rewizje w PostgreSQL `world_admin.revisions` i publikację live na serwerze (PR #79; `src/server/world/overrides.ts`; migracja `006-world-overrides.sql`). Panel zarządza istniejącymi postaciami i kontami VPS.
- PostgreSQL działa w wewnętrznej sieci prywatnej Dockera i nie ma publicznego portu bazy. W historii PR #60 wyraźnie wskazano, że **tunel VPN nie był skonfigurowany**. Nie wymyślaj WireGuard/VPN; jeśli konfiguracja się zmieniła, potwierdź to w bieżącym runtime przed oznaczeniem jako aktywne. VPS i VPN to różne rzeczy.
- Serwerowy PvE, trwałe konta/postacie i obecność innych postaci NIE oznaczają kompletnego MMO: wspólne potwory/stan walki, PvP, drużyny, handel między graczami i testy obciążenia wymagają osobnego wdrożenia i odbioru.

## Integracja i ograniczenia
- `docker-compose.yml`, `docker-compose.online.yml`, `deploy/multiplayer/`, `deploy/Caddyfile` i `.github/workflows/aruba-production.yml` są istotnymi elementami deploymentu. Część compose i historycznych instrukcji nadal ma zależności Supabase: przed ich zmianą sprawdź faktyczną konfigurację Coolify, sieć, backup i migracje; nie wycinaj sekretów ani kontenerów w ciemno.
- **Nie używaj Lovable do publikowania lub zmieniania KI Legends.** Utrzymuj GitHub + VPS/Coolify i istniejący przepływ deploymentu. Unikaj płatnego AI/API w runtime i w implementacji walki.
- GPU i instancje wynajmu: wyłącznie właściciel decyduje o Start/Stop/Restart/Terminate, skali i rozliczeniach, również po renderze i w bezczynności. Nie usuwaj danych/volume/modeli. Dozwolony jest odczyt stanu i autoryzowane zadania na działającym GPU.
- Zachowaj zatwierdzone rasy: Planetarni/Verdantia, Mędrcy/Aetheria, Androidy/Nexus-9, Legendy/Pyra; styl anime/manga, świat Superior i wspólną geometrię mapy 2D/3D. Grafika prezentacyjna nie może samowolnie zmieniać kolizji, statystyk ani architektury zapisu.
- Nie modyfikuj ręcznie plików generowanych `nodes.generated.ts`, `base.generated.ts`; popraw źródło i generator. Zachowaj oryginalny PDF, aneks ras i bestiariusz 40 potworów oraz ich SHA/ewidencję licencji.
- `/test` to oddzielna chroniona przestrzeń szkiców ze wspólnym hasłem/sesją i prywatnymi plikami; nie łącz jej uprawnień z kontami graczy. Sprawdzaj sesję przed każdą operacją, wydawaj krótkie uprawnienia upload/download, nie używaj zewnętrznych viewerów. Nie ujawniaj sekretów i nie formatuj generowanych `src/integrations/supabase/types.ts` i `previewAuthStorage.ts`.

## Stan zmian na dzień 04.11.2026
- W `main` po PR #99 działają malowane miasta domyślnie (`?ki-painted=0` wyłącza), profesje NPC i poprawki dropów/spawnów; po #100 poprawiono kontrast i mobilny HUD; po #101 dodano skalę interfejsu 50–120%. Świeży kod i testy mają pierwszeństwo przed wcześniejszymi założeniami o flagach i wyglądzie.
- Otwarte i **niescalone** w chwili audytu: #90 rozwój ras (Draft; postęp częściowy), #87 audyt rozwoju (Draft), #80 labirynty, #102 test idempotencji questów, #71 ops/cutover (Draft), #66 warsztat promptów. Nie traktuj ich zawartości jako produkcji.
- Szczegóły, źródłowe commity i nierozstrzygnięte kontrole: `docs/zmiany/2026-11-04/ZMIANY.md` oraz `docs/PLAN-I-ZADANIA.md`.

## Weryfikacja zmian
- Minimum przed PR: `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run assets:check` i `python3 scripts/docs/check_documentation.py` (gdy pełne repo i zależności są dostępne). Zapisuj wynik, SHA, środowisko oraz pominięcia; nigdy nie wpisuj PASS bez wykonania.
- Dla serwera: osobne testy PostgreSQL, auth, lease/receipts, online tick, `/ws/online`, dostęp na VPS i regresja po restarcie; dla UI mobile: Playwright + test na fizycznym telefonie. Nie utożsamiaj testu jednostkowego z weryfikacją produkcji.
- Nowe funkcje na `main` nie muszą być jeszcze potwierdzone na produkcyjnym VPS: dopóki nie sprawdzono runu i zdrowia aplikacji, pisz 'scalone do main', a nie 'wdrożone i sprawdzone'.
