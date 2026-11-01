# Zmiany — 2026-11-01

## Audyt kodu i dokumentacji: całkowita eliminacja adnotacji oraz komentarzy powiązanych z Lovable; bezterminalowe sterowanie serwerem gier z panelu admina; integracja klienta Phaser z WebSocket i stabilizacja testów E2E

### 1. Eliminacja odniesień i komentarzy powiązanych z platformą Lovable

- **Kod źródłowy aplikacji (`src/`):**
  - **`src/routes/__root.tsx`**: Usunięto import i wywołanie `reportLovableError`, usunięto metatagi `<meta name="author" content="Lovable">` oraz `<meta name="twitter:site" content="@Lovable">`, zaktualizowano pole autora na `"Ki Legends"`.
  - **`src/lib/lovable-error-reporting.ts`**: Plik raportowania błędów do telemetrycznego hooka edytora został całkowicie usunięty z projektu.
  - **`src/integrations/supabase/auth-middleware.ts`**, **`src/integrations/supabase/client.server.ts`**, **`src/integrations/supabase/client.ts`**: Zastąpiono komunikaty brakujących zmiennych środowiskowych sugerujące konfigurację w chmurze zewnętrznej neutralnym komunikatem błędu konfiguracji środowiska Supabase.
  - **`src/integrations/supabase/cron-auth.ts`**: Usunięto odwołania do `LOVABLE_CRON_SECRET` na rzecz standardowych zmiennych środowiskowych `CRON_SECRET` i `CRON_SECRET_PREVIOUS`.
  - **`src/integrations/supabase/previewAuthStorage.ts`**: Usunięto kod pośrednika sesji opartego na iframe/postMessage oraz powiązane komentarze; funkcja `brokeredPreviewStorage` korzysta bezpośrednio ze standardowego `localStorage` w środowisku przeglądarki.

- **Konfiguracja repozytorium i pliki środowiskowe:**
  - **`AGENTS.md`**: Usunięto blok adnotacji `<!-- LOVABLE:BEGIN --> ... <!-- LOVABLE:END -->`. Zastąpiono instrukcję ogólną regułą nieprzepisywania opublikowanej historii Gita.
  - **`README.md`**: Usunięto sekcję „Build with Lovable”, linki do edytora zewnętrznego oraz link do domeny tymczasowej; dodano opis uruchamiania i skryptów weryfikacji projektu (`typecheck`, `test`).
  - **`vite.config.ts`**: Usunięto komentarz odnoszący się do pakietu konfiguracyjnego.
  - **`Dockerfile`**: Usunięto historyczną adnotację dotyczącą hostingu okładki.
  - **`docker-compose.staging.yml`**, **`.env.staging.example`**: Zastąpiono wzmianki o chmurze zewnętrznej odniesieniem do Supabase.
  - **`deploy/scripts/push-to-new-github.sh`**: Usunięto komentarze i wzorce referencji powiązane z chmurą zewnętrzną.
  - **`art/candidates/anime-v1/README.md`**: Zneutralizowano frazę o braku publikacji na chmurze zewnętrznej.
  - **`ARUBA_STAGING.md`**: Wyczyszczono odniesienia do eksportów i hostingu zewnętrznego.
  - **`roadmap.md`**: Wyczyszczono odwołanie w punkcie dotyczącym bazy danych.
  - **`bunfig.toml`**: Usunięto nieużywane wpisy zewnętrznych pakietów SDK z wykluczeń.

- **Dokumentacja projektu (`docs/`):**
  - **`docs/ARCHITEKTURA-I-TESTY.md`**: Zastąpiono wzmiankę o zewnętrznej bazie opisem bazy kont Supabase.
  - **`docs/ZASADY.md`**: Usunięto adnotację o synchronizacji repozytorium z zewnętrzną platformą.
  - **`docs/PLAN-I-ZADANIA.md`**: Zneutralizowano określenie w zadaniu `REL-01`.
  - **`docs/LICENCJE.md`**: Zaktualizowano tytuł sekcji 4 i opis pochodzenia tekstur kosmosu i chmur.
  - **`docs/db/2026-10-26-accounts.sql`**: Wyczyszczono nagłówek SQL.

### 2. Bezterminalowe zarządzanie procesem fizycznym serwera gier (`f61dbc96`)

- **`src/server/managedServer.ts`**:
  - Moduł `managedGameServer` z bezpośrednim sterowaniem fizycznym procesem WebSocket (`gameServer.ts`) w środowisku Node.js (`child_process.spawn`).
  - Bezpieczne startowanie, zatrzymywanie (`SIGTERM` / `SIGKILL` z timeoutem), restart oraz zmiana konfiguracji w locie (port, maksymalny limit graczy, nazwa serwera, interwał tick rate, limit AOI).
- **`src/lib/serverControl.functions.ts`**:
  - Zabezpieczone endpointy API `/api/admin/server-control` z weryfikacją roli administratora (`role === "admin"`).
- **`src/components/admin/AdminMonitoringCenter.tsx`**:
  - Kompletny interfejs graficzny w panelu administratora: wskaźnik statusu serwera (Online/Offline/Uruchamianie/Zatrzymywanie), przełączniki start/stop/restart, edycja parametrów w czasie rzeczywistym oraz zintegrowany terminal logów procesowych.

### 3. Integracja klienta Phaser z pętlą WebSocket serwera gry (Multiplayer Live)

- **`src/game/multiplayer/networkClient.ts`**:
  - Implementacja klienta sieciowego WebSocket z throttlingiem aktualizacji pozycji (10 Hz), mechanizmem heartbeat (ping co 15s), graceful offline fail-safe oraz buforowaniem i powiadamianiem o zdarzeniach (`onSnapshot`, `onPlayerJoined`, `onPlayerLeft`, `onPlayerAction`, `onChat`).
  - Metoda `isMultiplayerEnabled()` określająca aktywność trybu wieloosobowego (w playteście aktywowana jawnie parametrem `?ki-multiplayer=1`, co chroni testy PvE przed błędami sieciowymi).
- **`src/game/mountGame.ts`**:
  - Połączenie klienta `NetworkClient` w scenie Phaser (`initializeWorld`): rejestracja aktora i wysyłanie pakietu autoryzacyjnego gracza.
  - Rejestracja i renderowanie pozostałych graczy na serwerze za pomocą `this.actor(p, visual, label, "hero")` z atrybutem dataset `parent.dataset["networkPlayers"]`.
  - Płynna interpolacja pozycji (`lerp`) i synchronizacja animacji kierunkowej w pętli `update()` sceny gry.
  - Czyszczenie zasobów multiplayerowych w procedurze `releaseScene` i zdarzeniu wyłączenia sceny.
- **`src/game/multiplayer/protocol.ts`**:
  - Zapewnienie pełnej zgodności z regułą `exactOptionalPropertyTypes: true` w `tsconfig.json` poprzez jawne typowanie opcjonalnych pól uniami `| undefined`.
- **`src/server/gameServer.ts`**:
  - Poprawka mechanizmu reconnectu — serwer zamyka stare połączenie danego `characterId` tylko wtedy, gdy nowe żądanie autoryzacji pochodzi z innego gniazda socket (`old.socket !== socket`).
- **`src/test/multiplayer-network-client.test.ts`**:
  - Pakiet testów jednostkowych weryfikujący: tryb offline/fail-safe bez rzucania błędów, poprawny handshake uwierzytelniania z serwerem oraz wzajemną synchronizację pozycji i snapshotów AOI dwóch graczy (3/3 PASS).

### 4. Ustabilizowanie testów Playwright i pełna zielona regresja CI walki oraz cyklu życia (P0)

- **`playwright.config.ts`**:
  - Dodano automatyczne wykrywanie przeglądarki `msedge.exe` na systemach Windows w przypadku braku pobranych binarek Chromium w AppData.
  - Zwiększono timeout webserwerów do 180s.
- **Diagnoza i rozwiązanie błędu timeoutu `liveEnemy` i asercji konsoli**:
  - Główną przyczyną przerywania testów `e2e/combat-skills.spec.ts` i `e2e/hero-lifecycle.spec.ts` było zgłaszanie przez przeglądarkę błędu `net::ERR_CONNECTION_REFUSED` do konsoli (`page.on("console", (e) => errors.push(e.text()))`), wywoływane przez próbę nawiązania połączenia WebSocket pod nieuruchomiony serwer gry podczas ładowania `/scripts/playtest.html`.
  - Dzięki zabezpieczeniu `NetworkClient.isMultiplayerEnabled()` playtesty ładują się w czystym środowisku offline bez generowania błędów w konsoli.
- **Wyniki weryfikacji Playwright (silnik Chromium / Edge, port 4174)**:
  - **`e2e/combat-skills.spec.ts`**: 4/4 PASS (Planetarni: 28.6s, Mędrcy: 22.7s, Androidy: 22.0s, Legendy: 28.2s).
  - **`e2e/combat-v3.spec.ts`**: 6/6 PASS (Planetarni 320x568: 27.0s, Mędrcy 360x640: 26.1s, Androidy 390x844: 23.5s, Legendy 852x393: 19.6s, Planetarni 1280x720: 24.7s, Mędrcy 1920x1080: 38.6s).
  - **`e2e/hero-lifecycle.spec.ts`**: 4/4 PASS (wszystkie cztery rasy, pełne animacje, walka, śmierć i respawn w bezpiecznym mieście).
  - **`npm run typecheck`**: 0 błędów w `tsconfig.json`, `tsconfig.e2e.json` oraz `tsconfig.tools.json`.

### 5. Przebudowa Centrum Monitoringu: rzeczywista liczba graczy online, wydzielona sekcja BAZA DANYCH, Fizyczna Mapa Świata i Panel Zarządzania Serwerem

- **Rzeczywista liczba graczy Online (eliminacja fałszywych `19 online` przy braku graczy)**:
  - **`src/game/admin/adminTelemetry.ts`**:
    - Zmieniono domyślne `includeClusterSimulation` na `false`, dzięki czemu symulowane boty (`mp-sim-1`..`8`) nie są doliczane domyślnie.
    - Zapisane postacie w `localStorage` (`collectLocalCharactersPresence`) oraz w tabeli `characters` Supabase (`cloudPlayers`) są traktowane jako zapisane postacie w bazie (`online: false`, `activity: "offline"`), chyba że dany `characterId` ma aktywną sesję WebSocket w działającym procesie `GameServer` (`liveDaemonStatus.players`).
    - Węzły serwerów gry (`configuredNodes`) są zwracane zawsze (niezależnie od przełącznika symulacji), z rzeczywistą liczbą połączonych graczy (`0` gdy nikt nie gra, bez sztucznego wpisywania `3` graczy).
- **Wydzielenie zarządzania Supabase i PostgreSQL do dedykowanej sekcji `BAZA DANYCH`**:
  - Usunięto węzeł `cloud-supabase` z tablicy serwerów gry `snapshot.nodes` i wydzielono pełną diagnostykę bazy do struktury `snapshot.dbStats` (`DatabaseTelemetryStats`).
  - W **`src/components/admin/AdminMonitoringCenter.tsx`** utworzono dedykowaną zakładkę **`🗄️ BAZA DANYCH (Supabase i PostgreSQL)`** prezentującą status połączenia, ping RTT, liczbę kont (`profiles`), ról (`user_roles`), zapisanych postaci (`characters`), wpisów audytu (`admin_audit`), pulę połączeń oraz optymalizacje `UNLOGGED` PostgreSQL 17.
- **Fizyczna Mapa Świata pod siatką graczy (`PhysicalWorldPlayerMapSvg`)**:
  - Zastąpiono pustą czarną siatkę SVG prawdziwą teksturą fizycznej mapy planety Superior (`atlas-v2-3840.webp`) z projekcją `worldOverlay.v2.json` i transformacją `worldToAtlas`.
  - Dodano wybór widoku całej planety (`🌍 Cała Planeta Superior`) lub automatycznego kadrowania na wybrany kontynent/wyspę (`verdant`, `aether`, `nexus`, `pyra`, `island-1`..`6`) oraz przełączniki warstw: siatka sektorów AOI, drogi i szlaki, miasta i lokacje.
- **Pełny Panel Zarządzania Wybranym / Nowo Utworzonym Serwerem Gry**:
  - W zakładce **`🖥️ Serwery Gry i Zarządzanie`** dodano rozbudowany **Panel Zarządzania Aktywnym Serwerem**, który otwiera się automatycznie dla wybranego lub nowo utworzonego serwera (`handleCreateServer`).
  - Panel umożliwia bezpośrednie uruchamianie (`▶ Uruchom ten serwer`), zatrzymywanie (`⏹ Wyłącz ten serwer`), restartowanie (`🔄 Restartuj`), przełączanie w tryb konserwacji (`⏳ Tryb konserwacji`), usuwanie serwera oraz edycję na żywo nazwy, limitu slotów graczy, hosta/IP, portu, regionu i częstotliwości pętli tick (Hz).

## Serwer jako właściciel postaci — partia trwałości (w realizacji)

Zlecenie właściciela: pełna gra serwerowa, bez cichego fallbacku lokalnego;
zaakceptował nowe postacie testowe. Gałąź `feature/server-owned-characters`,
baza `2e1f5438`. Przygotowano repozytorium PostgreSQL z własnością, CAS i
idempotencją checkpointów, verifier Auth oraz prywatne GET/POST/ws/characters
(wyłącznie tworzenie i odczyt). Brak endpointu importującego XP/złoto/stany od klienta.
SQL003 zachowuje istniejące dane. Nie wykonano migracji ani wdrożenia na VPS.

Weryfikacja: osobny lokalny PostgreSQL17, schema001 i003, operacje jako grupa
ki_game_server,16 sprawdzeń PASS:4rasy, odczyt nową instancją repozytorium,
konflikty, duplikaty, zmieniony digest, brak dostępu do cudzej postaci i HTTP.
Początkowo fixture natrafił na brak miejsca; bazę testową uruchomiono na tmpfs.
Odtworzenie testu znalazło podwójną serializację parametru JSONB — poprawiono
przez typowany JSON drivera. Następnie sprawdzono minimalne przywileje: usunięto
zbędne DO UPDATE podczas wyszukiwania konta. Końcowy test16/16 PASS na realnym DB.
Trzy testy verifiera i dziewięć wcześniejszych multiplayer/processów PASS.
Lokalny kontener i pobrany do niego obraz usunięto po testach; nie dotykano VPS/GPU.

NIE UKOŃCZONO pełnego zadania. Klient nadal korzysta ze starego zapisu i starych
wiadomości WS. Pozostają adapter Superior/GameSession, serwerowe wykonywanie
komend i nagród, pełny runtime checkpoint, bezpieczny WS, selektor online,
zatrzymywanie przy disconnect, konfiguracja VPS i odbiór end-to-end.
[Dokładna kolejność](../../ARCHITEKTURA-I-TESTY.md#kontynuacja--wymagane-przed-przełączeniem-graczy).
Nie przedstawiać tej partii ani nowego health pola jako gotowej gry online.

Końcowe kontrole tej partii: pełny TypeScript3konfiguracje PASS, produkcyjny build
PASS, celowany lint nowych/zmienionych modułów PASS; testy Vitest12/12 PASS.
Globalny lint aktualnej bazy ma45błędów/15ostrzeżeń głównie formatowania innych
modułów z ostatnich zmian; nie poprawiano cudzych plików. Pełnego Playwright,
fizycznego telefonu i testu produkcyjnego właściciela NIE WYKONANO dla tej partii.
Dowody: [PostgreSQL16](qa/server-owned-characters/postgres.txt),
[Vitest12](qa/server-owned-characters/tests.txt), [build](qa/server-owned-characters/build.txt).
Kontrola dokumentacji PASS po odtworzeniu pięciu śledzonych referencji pominiętych
przez sparse checkout; źródłowych archiwów i checkera nie modyfikowano.

## Kontynuacja PR69 — adapter rzeczywistego świata Superior

Kontynuowano na tej samej gałęzi, bez zmian na main. Wydzielono czystą wspólną
konfigurację miasta/świata z superiorRuntime i użyto jej w nowym adapterze Node.
Adapter wczytuje jawnie Superior v2 z manifestami/checksum/nav, uruchamia istniejący
GameSession, streamuje spawny, zapisuje i odtwarza checkpoint Superior5 oraz zegar.
Nie używa przeglądarki/localStorage, nie zastępuje map uproszczonymi regionami.
Dodano ścisłą walidację bazowych poleceń, odrzucając dane statystyk i komendy GM.
Nie jest to jednak pełny runtime online: cooldowny/efekty, protokół, klient,
zadania V2 i podróże są nadal otwarte. Szczegóły: sekcja drugiej partii architektury.

Końcowe wykonane kontrole: `npm run typecheck` PASS3konfiguracje; build produkcyjny
PASS; lint zmienionych plików PASS. Vitest:31/31 w6plikach (server-superior-simulation,
superior-save, superior-spawns, superior-characters, online-account-verification,
multiplayer-server). Test adaptera obejmuje wszystkie4rasy, ruch na autentycznej
mapie, replay checkpointu oraz odrzucenie fałszywych nagród/GM/Infinity.
Podczas parametryzacji fixture znaleziono literówkę zmiennej race — poprawiono
przed końcowym przebiegiem, nie pomijano testu. Nie zmieniono progów grywalności.
[Logi](qa/server-superior-adapter/tests.txt), [build](qa/server-superior-adapter/build.txt).
Nowego E2E online nie wykonano, ponieważ klient nie jest podłączony. Nie wdrażano
niekompletnej funkcji, nie kasowano postaci i nie zmieniano konfiguracji VPS/GPU.
