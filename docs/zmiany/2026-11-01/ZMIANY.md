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

### 6. Produkcja Zasobów Rozwoju — Etap 1 (Krok 0 Reuse, Partia 1 Test Stylu, Fundamenty P0, gałąź `feat/development-assets-etap1`)

- **Krok 0 — Audyt Reuse i podpięcie 7 efektów dźwiękowych P0 (`src/game/sfx.ts`, `src/components/game/DevelopmentExam.tsx`)**:
  - Zgodnie z wytycznymi katalogu (`START-TUTAJ.txt`) przeprowadzono audyt 56 istniejących plików MP3 ElevenLabs w `public/game/sfx/` i podpięto brakujące zdarzenia rozwoju w `cuesFor` oraz `DEVELOPMENT_SFX_REUSE`:
    - `audio.development.dummy-hit` → `/game/sfx/common/hit.mp3` (uderzenie w manekin treningowy `training-dummy`),
    - `audio.development.target-hit` → `/game/sfx/common/hit-armor.mp3` (trafienie w cel pomiarowy `practice-*`),
    - `audio.development.checkpoint` → `/game/sfx/common/loot.mp3` (zaliczenie punktu trasy próby wytrzymałości),
    - `audio.development.exam-start` → `/game/sfx/sage/A1.mp3` (otwarcie próby w sali egzaminacyjnej),
    - `audio.development.exam-success` → `/game/sfx/common/quest-complete.mp3` (zaliczenie próby / ukończenie projektu),
    - `audio.development.exam-fail` → `/game/sfx/common/no-energy.mp3` (niepowodzenie próby bez dramatyzmu śmierci),
    - `audio.development.ki-charge` → `/game/sfx/sage/C1.mp3` (ładowanie węzła KI),
    - awans stopnia treningu → `/game/sfx/common/level-up.mp3`.
- **Wygenerowanie i post-processing 11 zasobów graficznych `v001` (`scripts/development/process-etap1-assets.ts`, `art/production/development/v001/manifest.json`)**:
  - **Partia 1 (Test Stylu Verdantii — komplet 3 obiektów P0)**: `training.planetary.dummy`, `training.planetary.target`, `training.planetary.ki-node` + czwarty obiekt P0 `training.planetary.defense` (mastery `1024×1024` RGBA PNG z wycięciem tła flood-fill i de-haloingiem 2px, stopy wyrównane do `origin: [0.5, 0.88]`, eksport kliencki `512×512` bezstratny WebP).
  - **Partia 2 (P0 UI)**: dedykowana ikona `ui.training.strength` + mapa reuse dla pozostałych 7 dyscyplin z `public/game/icons-v3/`, oraz komplet 6 emblematów stopni prób `ui.exam.tier-1` .. `ui.exam.tier-6` (od 1 do 6 symetrycznych nacięć geometrycznych wokół klejnotu, bez cyfr rzymskich; mastery `512×512` RGBA PNG z 12% marginesem → klient `128×128` WebP).
  - Zachowano oryginalne odpowiedzi modelu `gemini-3.1-flash-image` w `art/production/development/v001/originals/` oraz arkusz kontrolny czytelności `128×128` i `32×32` w `art/production/development/v001/qa/etap1-review-sheet.png`.
  - Pozostałe pozycje Partii 2 wstrzymano po osiągnięciu limitu okna modelu `gemini-3.1-flash-image` (`429 RESOURCE_EXHAUSTED`, reset po ~4h 57m) — zgodnie z regułą katalogu oczekują na odbiór właściciela dla Partii 1.
- **Bezpieczna integracja opt-in (`?ki-dev-art=1`)**:
  - Nowe zasoby są zgrupowane w `src/game/development/developmentAssets.ts` i zarejestrowane pod przełącznikiem `PREVIEW_SWITCHES["ki-dev-art"]` w `src/game/assets/catalog.ts`, dzięki czemu domyślna gra zachowuje dotychczasową prezentację do czasu akceptacji właściciela.


### 7. Dokończenie pełnej puli assetów Etapu 1 (P0 Development, commit `f8dff1d8`, gałąź `feat/development-assets-etap1`)

- **Komplet 46/46 grafik i 41/41 audio w `manifest.json`**:
  - **Obiekty treningowe 4 ras (32 obiekty)**:
    - Verdantia: `training.planetary.*` (dummy, target, ki-node, defense, ki-source, checkpoint, obstacle, surrender).
    - Aetheria: `training.sage.*` (wszystkie 8 obiektów).
    - Nexus-9: `training.android.*` (wszystkie 8 obiektów).
    - Pyra: `training.legend.*` (wszystkie 8 obiektów zaimportowane z paczki właściciela `pyra.zip`, wyczyszczone z magenty do przezroczystych WebP).
  - **Ikony dyscyplin treningowych (8 ikon)**:
    - `ui.training.strength`, `endurance`, `agility`, `discipline`, `ki-control`, `ki-capacity`, `technique`, `attack-speed`.
  - **Emblematy egzaminacyjne (6 emblematów rang)**:
    - `ui.exam.tier-1` .. `tier-6`.
  - **Efekty dźwiękowe (41 audio)**:
    - Wygenerowane i podpięte zoptymalizowane pliki SFX i pętle ambience ElevenLabs v2.
  - Wszystkie zasoby zintegrowane w `manifest.json`, `public/game/manifest.json` oraz `developmentAssets.ts`.

### 8. System ekwipunku postaci, torba oraz depozyt miejski (commit `93d38fc2`, gałąź `feat/inventory-bag-and-city-depot`)

- **Pełny 8-slotowy ekwipunek (`DiabloInventory.tsx`, `session.ts`)**:
  - Odblokowano wszystkie 8 slotów w HUD postaci: `head` (Hełm), `weapon` (Broń), `armor` (Pancerz), `offhand` (Tarcza), `hands` (Rękawice), `ring` (Pierścień), `amulet` (Amulet), `feet` (Buty).
  - Obsługa ubierania i zdejmowania przedmiotów z katalogu V2 (oraz klasycznych).
  - Automatyczna zamiana miejsc (swap) w przypadku zajętego slotu.
  - Dynamiczne zasilanie statystyk bojowych postaci (atak, obrona, szansa na trafienie krytyczne, szybkość) z uwzględnieniem pasywnych bonusów zestawowych (`computePassiveEquipmentBonuses`).
- **Torba postaci (Siatka 40 slotów)**:
  - Dodano pole `bagItems` w `PlayerSchema` z automatyczną migracją starszych zapisów gry.
  - Prezentacja przedmiotów z katalogu, klasycznych oraz materiałów w siatce 40 komórek.
  - Szczegółowe podpowiedzi (tooltip) prezentujące poziom, statystyki, efekty pasywne oraz przynależność do zestawu.
  - Obsługa przedmiotów użytkowych (jedzenie / mikstury leczące).
- **Depozyt miejski na pieniądze i ekwipunek (`CityPanels.tsx` – `DepotPanel`)**:
  - **Skarbiec miejski (Złoto)**:
    - Rozszerzono `depot` o pole `gold` z domyślną wartością 0 dla zachowania zgodności wstecznej.
    - Dodano komendę `depot-gold` do wpłacania i wypłacania monet ze skarbca w bezpiecznym mieście.
    - Szybkie przyciski kwotowe oraz przycisk „Wpłać wszystko” / „Wypłać wszystko”.
  - **Skrzynia na ekwipunek**:
    - Możliwość odkładania do depozytu dowolnych przedmiotów z torby oraz odbierania ich ze skrzyni (stosy do 99 sztuk).
    - Ochrona przed odłożeniem aktualnie założonego na postać ekwipunku bez wcześniejszego zdjęcia.
- **Weryfikacja**:
  - Test jednostkowy `src/test/inventory-and-depot.test.ts` (4/4 PASS).
  - Test katalogu `src/game/items/__tests__/items.test.ts` (8/8 PASS).
  - Pełny typecheck (`tsc --noEmit` dla 3 tsconfigów): 0 błędów.
