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

## Serwer online — usunięcie blokad lint w istniejącym transporcie

Przed integracją trzeciej partii uporządkowano wcześniejsze błędy CI w modułach
multiplayera i monitoringu: formatowanie, blok `case` dla lokalnego `const`,
typowane zdarzenia oraz jawny konstruktor adaptera WebSocket zamiast `any`.
Nie zmieniono wiadomości starego protokołu, sterowania ani układu monitoringu.
Pełny TypeScript (3 konfiguracje), build oraz 9 testów istniejących klientów,
GameServer i Start/Stop przeszły. Globalny lint po tych poprawkach: 0 błędów,
14 wcześniejszych ostrzeżeń. Te moduły są zachowane dla oddzielnego playtestu;
nowy klient online ich nie używa.

## PR #69 — trzecia partia: wymagany serwer i rzeczywisty klient Phaser

Właściciel ponowił zlecenie dokończenia serwera. Dodano `/ws/online`, wyłączną
sesję postaci, transakcyjne potwierdzenia i zatrzymanie po błędzie DB; klient gry
odczytuje nowe postacie z PostgreSQL zamiast przechodzić na lokalny zapis.
Nie usuwano wcześniejszych postaci, zapisów cloud ani danych produkcyjnych.
Dokładny kontrakt, ograniczenia instancjonowanego PvE i procedura cutoveru:
[Architektura](../../ARCHITEKTURA-I-TESTY.md#kandydat-serwerowej-rozgrywki-pve--trzecia-partia-0111-pr-69).

Zachowane: sterowanie, mapy/kolizje, dotychczasowy GameSession, balans i assety.
Przeniesiono autorytet poleceń, rozwoju, zadań V2, egzaminów i podróży na serwer;
Phaser wyświetla zatwierdzony stan. Dochodzi kontrola ról RPC/admin/GM, presence
pobliskich graczy, soft-retire i limit postaci, autostart opt-in i osobny skrypt
migracji/loginu runtime. Stary lokalny dokument Playwright pozostał izolowany.

### Faktycznie wykonane kontrole tej partii

Kontrole wykonywano na drzewie roboczym gałęzi od `2cd9560d`, następnie z poprawką
lint `3c00ec88`. Końcowy SHA ma otrzymać osobny wynik CI; te wyniki **nie są
potwierdzeniem stanu produkcji**.

| Komenda / scenariusz | Wynik / dowód |
| --- | --- |
| `npm test` | **1023 PASS, 0 FAIL**, 85 plików; [log](qa/online-runtime/unit.txt). Ostrzeżenia jsdom audio nie są błędami konsoli prawdziwej przeglądarki. |
| `npm run typecheck` | 3 konfiguracje PASS; [log](qa/online-runtime/typecheck.txt). |
| `KI_ONLINE_TEST_DATABASE_URL=<lokalny-fixture> npx tsx scripts/qa-online-characters.ts` | **25/25**, PostgreSQL17 i rola `ki_game_server`: ownership, CAS, receipts, lease/wygaśnięcie, ochrona starego właściciela lease, soft-retire, quota; [log](qa/online-runtime/postgres.txt). |
| `... npx tsx scripts/qa-online-game-server.ts` | **6/6** kontroli produkcyjnego GameServer: gotowość, dwie sesje, peers/AOI, brak uprawnień staff, blokada starego relay; [log](qa/online-runtime/server-wrapper.txt). |
| `node scripts/qa-online-browser.mjs` przy uruchomionych `qa-online-runtime.ts` i `online-playtest.vite.ts` | **4/4 rasy PASS**: właściwy ląd, rozmowa i przyjęcie zadania, rzeczywisty ruch klawiszem, zapis SQL, odświeżenie, brak zapisu lokalnego, wymuszone zerwanie socketu blokuje ruch, brak pakietów starego relay. [Wyniki](qa/online-runtime/browser-results.json). Autorytet Auth jest jawnym fixture; GameServer/symulacja/DB/Phaser są rzeczywiste. |
| Chromium CDP `Input.dispatchTouchEvent`, 852×393 | Joystick przesunął postać 49031.06→49309.76, **0 pageerror**; [wynik](qa/online-runtime/mobile.json), [zrzut](qa/online-runtime/mobile-touch.png). To emulacja dotyku, nie test fizycznego Androida/iOS. |
| `bash deploy/multiplayer/prepare-online.sh` z override do osobnego kontenera fixture | Dwukrotna migracja bez kasowania danych, dumpy/checksum, login `ki_runtime`, rzeczywiste logowanie hasłem i odczyt tabel; pliki sekretów0600. [Log bez sekretów](qa/online-runtime/provision.txt). **Nie uruchamiano tego na VPS.** |
| `npm run lint` | Usunięto wcześniejsze blokady starego transportu/monitoringu; 0 błędów, pozostają wcześniejsze ostrzeżenia. [Log](qa/online-runtime/lint.txt). |
| Build i smoke Node | Domyślny build i `NITRO_PRESET=node-server npm run build` PASS; `node .output/server/index.mjs`, HTTP `/`200. [Build](qa/online-runtime/build.txt), [smoke](qa/online-runtime/node-smoke.txt). |

Zrzuty rzeczywistej gry online: [Planetarni](qa/online-runtime/planetary.png),
[Mędrcy](qa/online-runtime/sage.png), [Androidy](qa/online-runtime/android.png),
[Legendy](qa/online-runtime/legend.png). Duże trace pozostają poza historią Git;
dedykowany workflow zapisuje je jako artefakty CI na14dni.

Naprawiono problemy odtworzone podczas QA: próbę serializacji callbacków obiektu
pocisków, reset transientów przy reconnect, niepełne typy NPC w fixture egzaminu
oraz zegar/suspend rodzica podczas serwerowej próby. Początkowy test przerwy sieci
przez samą emulację offline nie zamykał istniejącego WS; zmieniono go na prawdziwe
zerwanie transportu w izolowanym kontrolerze QA, bez modyfikacji postaci.

**Otwarte / niewykonane:** publikacja i migracja VPS, rzeczywiste produkcyjne Auth,
restart procesu na VPS, pełny odbiór wszystkich późnych treści rozwoju, fizyczne
telefony, load test. Potwory/AI pozostają instancją PvE per postać, nie wspólną
walką MMO. Stary edytor cloud GM nie zarządza nowymi rekordami PostgreSQL;
nie wolno udawać, że zmiana starej kopii jest zmianą żywej postaci serwerowej.
GPU, inne aplikacje, domeny, `/test` i produkcja nie zostały zmienione.

Dodatkowa kontrola po zamrożeniu źródeł: 26/26 testów w7plikach (sesje,
cztery rasy/cooldowny/egzaminy, Auth/role, stare transporty i Start/Stop);
[log](qa/online-runtime/regressions.txt). Kompresja WS jest negocjowana bez
wspólnego kontekstu; nie zadeklarowano docelowej liczby graczy bez load testu.

Końcowa kontrola po podłączeniu metryk online:17/17 w4plikach,
[log](qa/online-runtime/metrics-tests.txt). Metryki czasu kroku obejmują symulację
sesji i zapis; liczniki pakietów uwzględniają nowy protokół, nie tylko stary relay.
Zbudowany artefakt Node, niezalogowane wejście: login wymagany, 0 canvas gry,
0 pageerror — [wynik](qa/online-runtime/built-login.json),
[zrzut](qa/online-runtime/login-required.png).
Manifest źródeł tej dostawy: [SHA256](qa/online-runtime/source-sha256.txt).

### Weryfikacja VPS i pierwsza próba CI na ece835d3

Read-only SSH przez [Actions41318199321](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/41318199321)
przeszedł. [Wynik](qa/online-runtime/live-preflight.json): app nie ma DATABASE_URL,
nie ma autostartu ani wymagania online; demon w app jest nieosiągalny. DB działa
bez opublikowanego portu, lecz nie ma tabel003/kolumn004/loginu runtime. App iDB
nie współdzielą sieci. Osobny stary kontener działa z mapowaniem portu7420.
Nic nie zmieniono na VPS. Tag obrazu nie jest identyfikatorem źródłowego commita.

Pierwszy [CI41318163536](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/41318163536)
zaliczył TS/unit/build/PostgreSQL/GameServer, lecz część przeglądarkowa nie
zakończyła żadnej rasy: proces dev Vite przestał odpowiadać. To **FAIL CI**, nie
PASS przeniesiony z lokalnego testu. [Rejestr](qa/online-runtime/ci-first-attempt.json).
Szczegółowy log tła nie był dostępny z pobrania artefaktu w tym środowisku;
nie przypisywać niepotwierdzonej przyczyny silnikowi, pamięci ani grafice.

Harness ma teraz osobny build i statyczny Vite preview, bramkę gotowości,
kontrolowane sprzątanie procesów oraz wypisywanie logów na porażce. Asercje
rozgrywki nie zostały osłabione. Build harnessu i podgląd wyboru ras lokalnie
przeszły ([build](qa/online-runtime/harness-build.txt),
[podgląd](qa/online-runtime/preview-selector.txt)); to nie zastępuje ponownego E2E
z bazą w CI. Checkout wskazuje teraz dokładny head PR zamiast merge-ref.

### Druga próba online CI — a0971d48

[Actions41319447687](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/41319447687)
przeszedł TS, unit, build, SQL i wrapper oraz3/4 ras. Planetarni nie wykonali ruchu
w oknie900ms po kliknięciu zamknięcia dialogu; pozostałe kontynenty przeszły pełny
scenariusz. Nie oznaczono tego jako PASS. Kod wejścia świadomie ignoruje klawisze,
gdy fokus nadal jest na przycisku/modalnym dialogu. Test nie czekał na jego
potwierdzone zniknięcie po odpowiedzi serwera. Dodano oczekiwanie na zamknięcie
modalu, a klawisz jest teraz przytrzymywany do rzeczywistej zmiany pozycji z limitem8s.
Wymagany ruch, zapis SQL i odczyt nie zostały zmienione. Do porażek dochodzi
rejestr fokusu i typów pakietów. Przyczyny tej pojedynczej próby nie wolno uznawać
za ostatecznie rozstrzygniętą wyłącznie na podstawie tego opisu — wynik ponownego
CI pozostaje rozstrzygający.

Właściciel zatwierdził konfigurację, kopię/migrację, wyłączenie starego demona,
scalenie i publikację **po zaliczeniu testów**. Zgoda nie oznacza, że cutover już
wykonano. Do bezpiecznego przygotowania używana jest osobna gałąź
`ops/online-cutover-20261101`; commit `35a191d9` sprawdza strukturę Coolify bez
modyfikowania konfiguracji lub wypisywania wartości sekretów. Potwierdzony bieżący
release VPS to `2e1f54383ba8298060fbabc0c4e12cc8e0047fe3`.

### Zatwierdzone przygotowanie przełączenia na serwerowe PvE

Właściciel zatwierdził kopię i migrację PostgreSQL, prywatne połączenie aplikacji,
wyłączenie starego relay po weryfikacji, scalenie PR69 i publikację po testach.
Zakres zaakceptowany: osobne instancje PvE postaci, nie wspólne potwory/PvP.

- Kod `a32ba3ed68a2164c43965dd7b969678df988173c`: [Server-owned gameplay QA](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/41320574187) PASS:1023 testy,25 kontroli repozytorium,6 GameServer,4 rasy Phaser.
- Operacje oddzielnej gałęzi `ops/online-cutover-20261101`: migracje003/004, LOGIN ki_runtime, zachowane prywatne hasło, konfiguracja ORM Coolify i prywatna sieć DB wyłącznie aplikacji. Bez restartu aplikacji.
- [Konfiguracja](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/41322583649) PASS; [odtworzenie kopii](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/41322763195) PASS do nowej tymczasowej bazy, bez nadpisywania produkcji.
- Kopie na VPS: `/home/codex/ki-multiplayer-db/backups/`; wskaźnik poprzedniej konfiguracji `/home/codex/ki-multiplayer-db/last-online-config-backup`. Sekrety w `secrets/`, tryb0600, nie w Git ani logach.
- Pierwsza próba workflow nie miała plików migracji w sparse checkout: przerwana przed zmianą bazy. Druga wykonała kopię/migracje, lecz PHP nie mogło odczytać pliku skopiowanego jako root: konfiguracja jeszcze nie zmieniona. Poprawiono checkout i własność prywatnych plików; kolejna próba zakończona sukcesem.
- Uwzględniono nowy main `2bca62ab522976ffbb3ec15c33085e9b62fd27e7`: zachowana pauza automatycznych Actions; nowy workflow serwera również wyłącznie ręczny. Publikacja wymaga ręcznego uruchomienia, zgoda na nią została udzielona.
- Status w tym checkpointcie: konfiguracja i kopia gotowe; scalenie i produkcyjna weryfikacja pozostają do wykonania. Szersze stare regresje przeglądarkowe jeszcze trwają, nie wpisano PASS.
