# 2026-11-27 — Integracja postaci 3D GameMastera, Lot, Przyspieszenie i Efekty Specjalne

Po decyzji właściciela zintegrowano model 3D i 8 animacji GameMastera z gałęzi
`assets/gamemaster-animation-20261125` (`deliveries/gamemaster/godot/assets/KI-Legends-GameMaster.glb`)
ze światem izometrycznym [`ports/godot-isometric-world/`](../../../ports/godot-isometric-world)
oraz serwerem obecności na żywo [`src/server/godot/live.ts`](../../../src/server/godot/live.ts).

### 1. Postać 3D GameMastera, lot nad obiektami, przyspieszenie `3,5×`, efekty specjalne i multiplayer

| Obszar | Zmiana | Weryfikacja |
| --- | --- | --- |
| Model 3D i 8-kierunkowe arkusze GameMastera (`render_gamemaster_sprites.gd`, `build_gamemaster_sheets.py`, `actors.json`) | Wyrenderowano w Godocie 4.6.3 wszystkie 8 klipów (`idle`, `walk`, `takeoff`, `hover`, `glide`, `land`, `heavy_strike`, `ki_blast`) w 8 kierunkach (`4,45 MB` WebP w `ports/godot-isometric-world/assets/gm/`, bez przebudowy 8 paczek `world-*`) i zarejestrowano `gm.hero` w [`actors.json`](../../../ports/godot-isometric-world/data/actors.json) o rozmiarze `238×238` (~`1,62×` większy niż standardowi bohaterowie). | `audit_gamemaster.gd` potwierdza `8/8` klipów, `8` kierunków oraz przewagę skali `>= 1,5×` (273,7 px vs 152,9 px). |
| Lot nad ziemią i omijanie obiektów (`world.gd`, `actor_view.gd`, `interior_room.gd`) | Dodano `toggle_gm_form` (`[F2]`/`[Y]`), `toggle_gm_flight` (`[L]`) i bezpieczne lądowanie (`_find_safe_land_spot`). W locie postać unosi się płynnie na wysokość `76 px` nad własny cień (`z_index = 12` — leci ponad dachami, drzewami i skałami), przełącza animacje `takeoff → hover/glide → land`, omija wszystkie kolizje terenu i obiektów oraz zachowuje wygląd `gm.hero` także we wnętrzach budynków. | `audit_gamemaster.gd` (`69/69`), regresja `audit_stage1..4.gd` (`235/235`), zrzuty OpenGL3 `1600×720`. |
| Przyspieszenie (`3.5×`) i efekty specjalne (`combat_vfx.gd`, `actor_view.gd`) | Dodano umiejętność `toggle_gm_boost` (`[U]` / kula `TURBO [U]`, prędkość `3,5×` z możliwością łączenia z lotem) oraz pełny zestaw efektów specjalnych: niebiańska pieczęć na ziemi, 3 unoszące się pierścienie prądu wznoszącego między gruntem a lewitującymi butami, świetlista aureola pod stopami, 32-punktowe złoto-błękitne wstęgi, wybuch startu (`spawn_gm_liftoff`) i lądowania (`spawn_gm_land`), rozbłysk przyspieszenia (`spawn_gm_boost_burst`), ciągłe smugi lotu (`spawn_gm_flight_trail`), sejsmiczny `heavy_strike` oraz promień `ki_blast`. | Wizualna weryfikacja 4 zrzutów OpenGL3 `1600×720` (postać obok gracza, lewitacja z pierścieniami, smugi `3.5×`, promień `ki_blast` + fala `heavy_strike`). |
| HUD mobilny i Panel GM (`rpg_hud.gd`, `gm_panel.gd`) | Dodano przyciski wyłącznie dla zweryfikowanych kont `admin`/`gm`: belkę `✦ FORMA GM [F2]` pod `MAPA ŚWIATA`, dwie okrągłe kule umiejętności `LOT [L]` / `LECISZ [L]` i `TURBO [U]` / `3.5× [U]` w strefie prawego kciuka (jedno tapnięcie automatycznie włącza formę GM) oraz sekcję sterowania w [`gm_panel.gd`](../../../ports/godot-isometric-world/scripts/gm_panel.gd). | `audit_gamemaster.gd` weryfikuje brak dostępu zwykłego gracza, poprawne hitboxy dla `staff` i natychmiastowy powrót do zwykłej postaci po odebraniu roli. |
| Multiplayer na żywo z ochroną anty-spoof (`live.ts`, `live_peers.gd`) | Rozszerzono protokół WebSocket `/ws/godot/live` o weryfikację roli `admin`/`gm` po stronie serwera (`isStaff` przy `hello` i cyklicznym `refresh`), listę póz GameMastera oraz rozgłaszanie flag `gm`, `fly`, `boost` wyłącznie dla personelu. [`live_peers.gd`](../../../ports/godot-isometric-world/scripts/live_peers.gd) renderuje zdalnego GameMastera w powiększonej skali ze złotym podpisem `✦ [GM]`, lewitacją, smugami lotu i efektami `heavy_strike`/`ki_blast`. | Test integracyjny PostgreSQL 17 + WebSocket (`src/test/godot-android.test.ts`) potwierdza widoczność `gm/fly/boost` dla `gm1` oraz wycięcie podszywania się zwykłego gracza `gracz2`. |

### 2. Paczka modularna `OTA 1.14.35` i wdrożenie produkcyjne

- Zbudowano przyrostową paczkę `OTA 1.14.35` na bazie `1.14.34` (`deliveries/godot-content-1.14.35/`, `core-c101-29ab31586e8c.pck`, `18,11 MiB`, `441` plików wraz z 8 arkuszami `assets/gm/gm-hero3d-*.webp`), zachowując wszystkie 8 paczek `world-*` bez przebudowy (`reused_world_packs = 8`, `rebuilt_world_packs = 0`, `unchanged_lands = true`, bez zmiany APK i bez migracji bazy danych).
- Weryfikacja: `build_preview_update.py --gemini --version 1.14.35 --base 1.14.34`, `npm run typecheck`, `npm run lint`, `npm run test` (`2234/2234` + `40` testów PG17/WebSocket), `npm run assets:check`, `npm run build`, `python3 scripts/docs/check_documentation.py`.
- **Wdrożenie produkcyjne LIVE (po zgodzie właściciela):**
  - Serwer gry i WebSocket (`aruba-production.yml`): run `46017796584` (commit `dd9843df`) — `Quality gate` ✓ + `ssh-check` ✓.
  - Paczka klienta Android (`godot-content-upload.yml`, `version=1.14.35`, `publish=true`, `activate=true`): run `46021286345` — `packs 38 bad 0 version 1.14.35`, `active_version = 1.14.35` w bazie produkcyjnej.

### 3. Stały dolny pasek ładowania z prędkością i 4-wątkowym strumieniowaniem przy każdym pobieraniu (`OTA 1.14.36` + APK)

- Ujednolicono wygląd i działanie pobierania na **wszystkich ekranach gry** ([`boot.gd`](../../../ports/godot-pyra/scripts/boot.gd), [`service_screen.gd`](../../../ports/godot-pyra/scripts/service_screen.gd), [`content.gd`](../../../ports/godot-pyra/scripts/content.gd), [`gate_screen.gd`](../../../ports/godot-pyra/scripts/gate_screen.gd), [`city_game.gd`](../../../ports/godot-pyra/scripts/city_game.gd)): wszędzie pojawia się identyczny dolny kuty pasek `BottomDownloadDock` z obsługą Android safe-area, prędkością na żywo (`⚡ MB/s`), postępem `MB / MB · %` oraz licznikiem strumieni (`4 wątki równolegle · bez limitu`), bez starej górnej pigułki ani środkowego paska.
- Dodano prawdziwe **4-wątkowe równoległe pobieranie strumieniowe HTTP `Range: bytes=...` (`206 Partial Content`)** dla każdego pliku `>= 2 MB` (zarówno w `boot.gd` dla `core-c101`, jak i przy pojedynczych paczkach w `service_screen.gd` oraz `content.gd`) z automatycznym płynnym fallbackiem dla serwerów bez `Range` (`200 OK`) i weryfikacją SHA-256.
- Dodano `scripts/gate_screen.gd` do `HOST_SCRIPTS` w [`build_preview_update.py`](../../../scripts/godot/build_preview_update.py), aby OTA natychmiast aktualizowało także ekran bramy i pobieranie krain.



