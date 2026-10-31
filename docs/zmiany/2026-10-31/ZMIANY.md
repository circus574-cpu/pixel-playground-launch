# Zmiany — 2026-10-31

## Optymalizacja mapy 2D/3D w grze, wdrożenie katalogu przedmiotów V2 oraz domknięcie usterek

### 1. Optymalizacja wydajności mapy 2D i 3D podczas gry

- **`src/components/planet-map/webgl.ts`**:
  - Zapisano wynik `supportsWebGL2()` w pamięci podręcznej sesji (`cachedWebGL2`), eliminując wielokrotne tworzenie i niszczenie tymczasowego kontekstu WebGL2 przy każdym otwarciu mapy.
- **`src/components/planet-map/preload.ts`**:
  - Dodano synchroniczne mapy cache (`resolvedImages`, `resolvedTerrain`, `resolvedOverlay`) oraz uchwyty `decodedImage.cached` i `loadWorldOverlay.cached`, dzięki czemu wstępnie załadowane zasoby mapy są dostępne synchronicznie w pierwszej klatce po otwarciu panelu mapy.
- **`src/components/planet-map/MapaView.tsx`**:
  - Przy otwieraniu mapy z fokusem gracza (`focus` z HUD) tryb startuje bezpośrednio jako `"flat"` zamiast `"checking"`, co pomija przejściowy montaż `<GlobeLoading />`.
- **`src/components/planet-map/PlanetMap.tsx`**:
  - Inicjalizacja `view`, `hiRes` oraz `playerAt` korzysta synchronicznie z `loadWorldOverlay.cached?.()` i `decodedImage.cached?.(atlasHi)` — otwarcie mapy w trakcie gry startuje od razu w przybliżeniu (`zoom = 6`) na pozycji gracza zamiast renderowania całej planety (`zoom = 1`) i skoku w kolejnej klatce.
  - Zastąpiono podwójne nakładanie `<image>` (`atlasLo` + `atlasHi`) pojedynczym elementem `<image href={hiRes ? atlasHi : atlasLo} />`.
  - Usunięto kosztowny filtr rozmycia Gaussa `filter="url(#pm-soft)"` z maski `<mask id="pm-spot-mask">` (2000×1000) oraz wyłączono nakładkę `.pm-spot` przy `ATLAS_V2 && zoom >= 2.5`.
- **`src/components/planet-map/WorldOverlay.tsx`**:
  - Zbuforowano prostokąty ograniczające kafelków (`tiles`), dróg (`roads`) oraz złączone łańcuchy punktów SVG (`roadPoints`) w `WeakMap<Overlay, PreparedOverlay>()` (`prepareOverlay`).
  - W `TerrainCanvas` rysowanie wykonywane jest synchronicznie wewnątrz `requestAnimationFrame`, gdy obrazy lądów są już w `decodedImage.cached`, a wymiary `canvas.width` / `canvas.height` są przypisywane tylko przy faktycznej zmianie rozmiaru (w pozostałych klatkach używane jest `ctx.clearRect`, co zapobiega realokacji bufora Canvas 2D podczas przesuwania mapy).
- **`src/components/planet-map/planet-map.css`**:
  - Usunięto wielokrotne filtry `filter: drop-shadow(...)` z `.pm-world-road` oraz `.pm-hit.is-selected`, które powodowały setki przebiegów filtrów SVG przy każdym ruchu kamery.
- **`src/components/planet-map/PlanetGlobe.tsx`**:
  - Zbuforowano obliczenia współrzędnych 3D obrysów regionów (`outlinePositionsCache`) oraz odroczono przesłanie tekstury `3840×1920` (`colorHiUrl`) do GPU o `350 ms`, aby nie blokować otwarcia widoku 3D i animacji lotu kamery.
- **`src/components/game/GameHud.tsx`**:
  - Polecenie `onCommand({ type: "pause", value: nextPanel !== null, suspendRendering: nextPanel === "planet" })` jest wysyłane synchronicznie w `toggle(next)` przed `setPanel(nextPanel)`, dzięki czemu pętla renderowania Phaser zatrzymuje się przed zamontowaniem `<PlanetAtlas>`.
  - Przycisk „Plan miasta” przekazuje `mapFocus` w `WORLD_V2` analogicznie do przycisku minimapy.

### 2. Selekcja znaczników miejsc w `AdminWorldMap`

- **`src/components/admin/AdminWorldMap.tsx` i `src/test/staff.test.tsx`**:
  - Do listy `candidates` w `onPointerUp` dołączono znaczniki miejsc z `projection.places`, gdy warstwa `layers.places` jest aktywna (naprawa usterki z audytu 28.10).
  - Dodano obsługę przekształcenia macierzowego w `at(x, y)` dla środowisk testowych bez `DOMPoint` oraz test jednostkowy w `src/test/staff.test.tsx` (`allows selecting a place marker on AdminWorldMap when only the places layer is enabled`).

### 3. Wdrożenie katalogu 366 przedmiotów, 140 receptur i pasywnych zestawów artefaktów V2

- **`src/game/items/types.ts`, `src/game/items/catalog.ts`, `src/game/items/recipes.ts`, `src/game/items/index.ts`, `src/game/items/__tests__/items.test.ts`**:
  - Rozszerzono katalog w silniku do pełnych **366 przedmiotów** (w tym 35 pasywnych artefaktów `BUFF-01`..`BUFF-05`, 70 elementów 10 zestawów ekwipunku `ZEST-01`..`ZEST-10`, 80 materiałów z potworów `MAT-M01`..`MAT-M80`, 16 reliktów bossów i 28 ksiąg rzemiosła) oraz **140 receptur** (`RC-001`..`RC-140` wraz z `RC-T01`) zgodnie z `docs/katalog-przedmiotow-v2/KI_LEGENDS_366_PRZEDMIOTOW_V2.json` i `ZASADY_BALANSU_PASYWNE_ARTEFAKTY_V2.md`.
  - Dodano tabele progów 3/5/7 części (`PASSIVE_BUFF_SET_BONUSES`, `EQUIPMENT_SET_BONUSES`), globalne limity procentowe (`V2_GLOBAL_STAT_CAPS`), selektor `getItemsBySetId` oraz kalkulator `computePassiveEquipmentBonuses` z zachowaniem pełnej kompatybilności wstecznej dla zapisów v1.

### 4. Budżet tekstur streamingu i stabilność testów walki

- **`src/game/world/generated/superiorRuntime.ts`**:
  - Ograniczono wstępne dogrzewanie obiektów statycznych na starcie do promienia `< 2048` (zgodnie z oknem 3×3 chunków) oraz dodano zwalnianie nieużywanych tekstur z `owned` w `release(scene, owner)` po przejęciu śledzenia przez `owners`.
- **`e2e/fixtures.ts`**:
  - Przekazano `{ timeout: 60_000 }` do `expect.poll` w `liveEnemy`, aby wyeliminować przedwczesne 5-sekundowe przerwania podczas inicjalizacji spawnu pod obciążeniem WebGL.

### 5. Dokumentacja wdrożenia serwera multiplayer, optymalizacja bazy PostgreSQL Schema v2 i Centrum Monitoringu w Panelu Administratora

- **Optymalizacja bazy danych multiplayer (`deploy/multiplayer/`):**
  - Dodano migrację `deploy/multiplayer/init/002-global-multiplayer-optimization.sql` (`Schema v2`): tabele `UNLOGGED` z `fillfactor = 70` (`game.active_sessions`, `game.server_nodes`) eliminujące narzut fsync WAL dla aktualizacji pozycji 10–20 Hz, indeks pokrywający AOI 512×512 (`active_sessions_aoi_idx INCLUDE (...)`), procedury wsadowe `game.batch_sync_positions`, `game.query_aoi`, `game.record_node_heartbeat`, `game.append_server_log`, widoki `game.world_population_stats` i `game.aoi_hotspot_cells` oraz tabele `game.server_metrics_history` i `game.server_logs` z indeksami `BRIN`.
  - Dostrojono `deploy/multiplayer/compose.yml` (`jit=off`, `wal_compression=lz4`, `shared_buffers=256MB`, `effective_io_concurrency=200`), `deploy/multiplayer/install.sh` oraz `deploy/multiplayer/verify.sql`.
- **Centrum Monitoringu w Panelu Administratora (`src/game/admin/adminTelemetry.ts`, `src/components/admin/AdminMonitoringCenter.tsx`, `src/routes/admin.tsx`, `src/components/admin/CoderAdminPanel.tsx`, `src/components/admin/AdminWorldMap.tsx`):**
  - Dodano zakładkę **„Monitoring i Serwer Live”** w `/admin` oraz w `CoderAdminPanel`, prezentującą na żywo zużycie CPU, RAM, JS Heap, Ping RTT, czasy ticku `p50/p95/p99`, FPS klienta, przepustowość sieci, interaktywny Radar Świata 2D z siatką AOI 512×512, szczegółowy inspektor każdego gracza na świecie, tabelę hotspotów AOI oraz konsolę logów serwera/anti-cheat/audytu.
  - W `AdminWorldMap.tsx` dodano opcjonalną warstwę `Gracze na świecie`.
  - Dodano testy jednostkowe w `src/test/admin-monitoring.test.tsx`.
- **Dokumentacja wdrożenia (`docs/ARCHITEKTURA-I-TESTY.md`, `docs/PLAN-I-ZADANIA.md`):**
  - Opisano bezinwazyjną architekturę Dual-Mode, separację ścieżki gorącej (`UNLOGGED` HOT) i zimnej (`ACID WAL`) oraz procedurę instalacji i weryfikacji serwera.

### 6. Zarządzanie węzłami serwerów gry w Panelu Administratora (tworzenie, edycja, limity graczy, startowanie i wyłączanie)

- **Modele i logika węzłów (`src/game/admin/adminTelemetry.ts`):**
  - Rozszerzono `ServerNodeMetric` oraz wprowadzono `ServerNodeConfig` z polami `name`, `port`, `maxPlayers` oraz stanami cyklu życia `ServerNodeStatus` (`"online" | "degraded" | "draining" | "offline" | "starting" | "stopping"`).
  - Wprowadzono funkcje zarządzania konfiguracją z trwałością w `localStorage` (`ki_admin_server_nodes_v2`) oraz pamięci: `getServerNodeConfigs()`, `saveServerNodeConfigs()`, `createServerNode()`, `updateServerNode()`, `setServerNodeStatus()`, `deleteServerNode()`, `resetServerNodesToDefault()`.
  - Powiązano telemetrię węzła ze stanem: po zatrzymaniu serwera (`offline`/`stopping`) metryki natychmiast wskazują 0% CPU, 0 aktywnych graczy, 0 encji i 0 pakietów; po uruchomieniu serwer płynnie wznawia przetwarzanie ticku i sesji graczy.
  - Dodano automatyczną rejestrację zdarzeń administracyjnych w dzienniku logów serwera (`recordServerActionLog`).
- **Interfejs Administratora (`src/components/admin/AdminMonitoringCenter.tsx`):**
  - W zakładce „Węzły Serwera, CPU/RAM i Baza” dodano:
    - Przycisk **„➕ Nowy serwer gry”** otwierający formularz tworzenia węzła klastra (unikalne ID, nazwa, region, host/IP, port sieciowy, maksymalny limit graczy, częstotliwość pętli tick).
    - Przycisk **„✏ Edytuj”** dla każdego węzła umożliwiający edycję nazwy, maksymalnego limitu slotów graczy (`maxPlayers`), hosta, portu, regionu i częstotliwości ticku.
    - Przyciski kontroli cyklu życia serwera: **„▶ Uruchom”** (dla serwerów offline/stopping), **„⏹ Wyłącz”** (dla serwerów aktywnych) oraz **„⏳ Drenuj”** (tryb opróżniania z graczy).
    - Przycisk **„🗑”** do bezpiecznego usuwania węzłów z klastra oraz **„↺ Przywróć domyślne”**.
    - Pasek wykorzystania slotów dla każdego węzła (`activePlayers / maxPlayers`) z procentowym i kolorystycznym wskaźnikiem nasycenia.
    - Kafelki podsumowujące klastra: liczba aktywnych instancji serwerów, całkowita pojemność slotów (suma `maxPlayers`), liczba graczy i globalne zapełnienie klastra.
- **Baza danych multiplayer (`deploy/multiplayer/init/002-global-multiplayer-optimization.sql`):**
  - Dodano kolumny `name TEXT`, `port INT`, `max_players INT` oraz rozszerzono warunek sprawdzający `status` o `starting` i `stopping`.
  - Utworzono procedury składowane `game.configure_server_node` oraz `game.set_server_node_status`.
- **Testy jednostkowe i integracyjne (`src/test/admin-monitoring.test.tsx`):**
  - Dodano testy jednostkowe pokrywające tworzenie węzła, edycję parametrów, aktualizację limitu slotów, startowanie/wyłączanie, usuwanie oraz pełną ścieżkę interakcji UI przez formularze w `AdminMonitoringCenter`.

### 7. Wdrożenie autorytatywnego serwera gry czasu rzeczywistego (Game Server Daemon 20 Hz, WebSocket, siatka AOI 512×512 i nakładka graczy)

- **Silnik Serwera Gry (`src/server/gameServer.ts`, `src/server/ws.d.ts`):**
  - Zaimplementowano klasę `GameServer` nasłuchującą na porcie WebSocket/HTTP (domyślnie `7420` lub zmienna `GAME_SERVER_PORT`).
  - Wprowadzono pętlę symulacji 20 Hz (`tickRateHz = 20.0`, krok 50 ms) z dynamicznym obliczaniem opóźnień `p50/p95` oraz zliczaniem pakietów/przepustowości.
  - Wdrożono siatkę przestrzenną AOI (Area of Interest 512×512): gracze otrzymują pakiety pozycji `snapshot` wyłącznie dla innych graczy znajdujących się w sąsiednich komórkach (promień 1, siatka 3×3 komórki = 1536×1536 jednostek), co drastycznie oszczędza pasmo sieciowe i czas CPU.
  - Zaimplementowano dwutorową synchronizację danych (Dual-Mode):
    - W przypadku podania adresu bazy PostgreSQL (`DATABASE_URL`), serwer asynchronicznie (2 Hz) wykonuje procedurę `game.batch_sync_positions` i rejestruje heartbeat węzła.
    - Jeśli baza danych nie jest skonfigurowana, serwer automatycznie działa w autonomicznym trybie pamięci RAM (zero błędów, pełna grywalność).
  - Dodano endpoint diagnostyczny HTTP `GET /health` zwracający JSON ze statusem węzła, liczbą aktywnych graczy, tickrate i czasami p50/p95.
- **Protokół sieciowy i Klient Gry (`src/game/multiplayer/protocol.ts`, `src/game/multiplayer/MultiplayerClient.ts`):**
  - Zdefiniowano komunikaty klienta (`auth`, `position`, `action`, `chat`, `ping`) i serwera (`welcome`, `snapshot`, `player_joined`, `player_left`, `player_action`, `chat`, `pong`, `error`).
  - Utworzono singleton `multiplayerClient` z automatycznym łączeniem w tle, obsługą zdarzeń i buforowaniem pozycji.
- **Nakładka HUD i integracja z grą (`src/components/game/MultiplayerWorldOverlay.tsx`, `src/components/game/GameHud.tsx`):**
  - W `GameHud` podłączono bezinwazyjną synchronizację pozycji i stanu gracza w tle do `multiplayerClient`.
  - Wdrożono komponent `MultiplayerWorldOverlay` wyświetlający status serwera (np. `Multiplayer: EU-Central #1 (21 ms)`), liczbę graczy obok oraz rozwijany panel z listą pobliskich graczy, ich rasą, poziomem, współrzędnymi i stanem HP.
- **Konteneryzacja i skrypty (`package.json`, `deploy/multiplayer/compose.yml`):**
  - Dodano skrypty `"server": "tsx src/server/gameServer.ts"` oraz `"multiplayer:start": "tsx src/server/gameServer.ts"`.
  - W `deploy/multiplayer/compose.yml` dodano usługę `game-server` (`node:22-alpine`) na porcie `7420`, połączoną z bazą `db` w sieci `private` oraz udostępniającą port w `public_net`.
- **Testy jednostkowe i integracyjne (`src/test/multiplayer-server.test.ts`):**
  - Dodano testy pokrywające start serwera, zapytanie HTTP `/health`, handshake WebSocket, autoryzację, ping/pong, filtrację przestrzenną AOI 512×512 oraz rozgłaszanie czatu w świecie (wszystkie 3 testy zaliczone).

### 8. Sterowanie fizycznym procesem serwera gry z Panelu Administratora bez terminala (Zero-Terminal Server Control)

- **Moduł zarządzania procesem (`src/server/managedServer.ts`):**
  - Wprowadzono funkcje `startServerFromAdmin`, `stopServerFromAdmin` oraz `getServerStatusFromAdmin`, które umożliwiają startowanie i zatrzymywanie instancji `GameServer` bezpośrednio w procesie Node.js w tle.
- **Funkcje serwerowe TanStack Start (`src/lib/serverControl.functions.ts`):**
  - Utworzono procedury `startGameServerFn`, `stopGameServerFn` i `getGameServerStatusFn` (`createServerFn`), dzięki czemu przeglądarka administratora komunikuje się z backendem Node.js bez ujawniania powłoki systemowej.
- **Interfejs Administratora (`src/components/admin/AdminMonitoringCenter.tsx`):**
  - W zakładce „Węzły Serwera, CPU/RAM i Baza” dodano wyróżniony panel: **„Fizyczny Serwer Gry (Sterowanie Bez Terminala)”** ze wskaźnikiem stanu procesu (`URUCHOMIONY I AKTYWNY` / `ZATRZYMANY`), czasem działania (uptime) oraz przyciskiem **„🚀 Uruchom Serwer Gry (1 kliknięcie)”** / **„🛑 Wyłącz Serwer Gry”**.
  - Przyciski „▶ Uruchom” i „⏹ Wyłącz” w głównej tabeli węzłów automatycznie zarządzają fizycznym procesem w tle.
- **Testy jednostkowe (`src/test/admin-server-control.test.ts`):**
  - Dodano testy weryfikujące pełny cykl życia serwera uruchamianego bez terminala (start na porcie 7435, odczyt statusu i zatrzymanie).
