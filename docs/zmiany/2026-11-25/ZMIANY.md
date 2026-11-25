# Zmiany — 2026-11-25

### Przebudowa systemów po teście 4 ras (OTA 1.14.27 → gałąź `feat/isometric-world-2d-terrain3d-20261118`)

Wdrożono zatwierdzony przez właściciela plan przebudowy (5 filarów + 27 napraw QA) oraz dodatkowe wymagania zgłoszone podczas odbioru:

1. **Interaktywny System Treningowy w Mieście (0 PD — trwałe statystyki bez awansu poziomu):**
   - Arena (`ATK`, `HP`, `DEF`, `SPD`) i Sala/Sanktuarium (`KI` + regeneracja, `KRYT`): limit `3 + (poziom − 1) × 2` na statystykę, pierwsze 3 sesje każdej dyscypliny darmowe, potem `15 + (ranga − 2) × 10 zł`, cooldown `8 s`, Rangi Mistrzostwa Miasta (`Rekrut → Adept → Wojownik Miasta → Weteran → Mistrz Ki`) z bonusem regeneracji poza walką.
   - Zamiast suchego klikania wdrożono w `ports/godot-isometric-world/scripts/interior_room.gd` **interaktywną 3-uderzeniową Próbę Rytmu i Skupienia KI** (animowany pasek ze Złotą Strefą `★ IDEALNIE`, żywe animacje bohatera na sali, dźwięki trafień, paski postępu dyscyplin oraz premię **Perfekcyjnej Serii +20% HP/KI**).
   - Zastąpiono lokalny exploit w Ratuszu trzema serwerowymi 15-minutowymi Błogosławieństwami Miasta (`city_blessing`: `march`/`might`/`focus`).
   - Mentorzy/Przewodnicy startowi wszystkich 4 stolic (`Kaena`, `Aira`, `Sora`, `LYRA-7`) oraz Mistrzowie Treningu (`Kenzo`, `Iwo`, `Raku`, `KRON-9`) w `ports/godot-isometric-world/scripts/dialogue_strip.gd` aktywnie przygotowują gracza do gry (wyjaśniają trening 0 PD, crafting vs sklep, podróż i Formę KI od Poz. 20).

2. **Ekonomia Ekwipunku V2 (Sklep vs Kuźnia vs Elity/Questy/Labirynty):**
   - Sklep: wyłącznie 4 zapasy + 6 podstawowych przedmiotów Tier 1 (`common`); `pouch_gold` usunięty; pełny interfejs sprzedaży (`shop_sell`) z poprawnym kontraktem `slotIndex`/`sellAll`.
   - Kuźnia (`craft`): receptury Tier 2–4 wymagające `minLevel`, surowców ze zbieractwa (`gather_node` serwerowy), trofeów potworów, Rdzeni Elit (`mat_elite_core`) i złota, z czytelnym wyświetlaniem `posiadane/wymagane`.
   - Plecak i Bank ujednolicone do **24 slotów** (z migracją starych zapisów 12/15-slotowych). Katalog spójny klient↔serwer: `ports/godot-isometric-world/data/items_catalog.json` (`scripts/godot/export_android_catalog.ts`).

3. **Mniej biegania bez psucia naturalnej prędkości na Poz. 1 + gęste expowiska (4 kontynenty):**
   - Zachowano naturalną prędkość bazową **`SPEED = 22.0`** na Poz. 1 (usunięto zawyżone `38.0 × 1.30` w OTA `1.14.29`); prędkość rośnie naturalnie z poziomem (`+5%`/poz. do 20), treningiem `SPD` na Arenie, butami z Kuźni, Błogosławieństwem Marszu (`+15%`) i delikatnym bonusem `+10%` na traktach poza stolicą. Czas biegania skracają pasywna regeneracja HP/KI po 5 s poza walką, krótsze respawny (`11 s` / `45 s` Elity), darmowy **Kamień Powrotu** `[C]` (kanał `2,5 s`, CD `45 s`) oraz **4 odkrywane Kamienie Szlaku (Waystones)** na kontynent (`discover_waystone`) z szybką podróżą `[M]` do Stolic i odkrytych szlaków.
   - `197` potworów na kontynent (`0` w bezpiecznych stolicach, `0` luk poziomów 1–18), Laboratorium I obniżone do Poz. 5 (spójnie z celem `A-*03`), przywrócona `hall` na Verdantii, przebalansowane Poz. 1–4 i ciaśniejszy aggro (`72 m` + `0,5 s` zamachu).

4. **Blokada Formy KI do Poz. 20 + Dwuwarstwowa Addytywna Aura KI:**
   - Zamknięto lukę z `1.14.27` (brak sprawdzania odblokowania w `trigger_skill`): Forma KI `[T]` wymaga teraz jednocześnie odblokowanego węzła `T` i `hero_level >= 20` (koszt `50 KI`, CD `120 s`, czas trwania `20 s`, `+25% ATK`, `+15% DEF`, `+10% SPD`), z wyraźną plakietką `Poz.20` na zablokowanym przycisku i osobnym przyciskiem podglądu w Panelu GM.
   - Przebudowano aurę po transformacji w `ports/godot-isometric-world/scripts/actor_view.gd` na **dwuwarstwową addytywną Aurę KI (`BLEND_MODE_ADD` za i przed postacią)**: wirujący krąg runiczny pod stopami, 16 płomieni KI, 2 wstęgi spiralne, 5 łuków błyskawic, 20 iskier i płynne wejście/wygasanie przez całe 20 s transformacji (w kolorach rasy bohatera).

5. **Wykaz FPS i Ping w Menu + Muzyka ładowania od 1. sekundy:**
   - Dodano w Menu Gry (`⚔ GRA` → `WYDAJNOŚĆ I SIEĆ`) przełącznik **`WYKAZ FPS I PING`** zapisywany w układzie HUD, z realnym pomiarem RTT (`dispatch_server_action` + lekki ping `/ws/godot/status` w `ports/godot-pyra/scripts/service_screen.gd`) wyświetlanym w kompaktowej plakietce pod minimapą.
   - Wgrano utwór właściciela `Warrior_Loading_Theme.mp3` jako `assets/audio/music/loading_theme.mp3` w `ports/godot-pyra` oraz `ports/godot-isometric-world`, podpięto go w `ports/godot-pyra/scripts/boot.gd` (gra od 1. sekundy uruchamiania/aktualizacji OTA), `title_screen.gd`, `service_screen.gd`, `audio.gd`, `world_audio.gd` i `world.gd` (płynny crossfade w motyw kontynentu po załadowaniu świata).

6. **Czystość silnika, optymalizacja i kontrakty:**
   - Naprawiono wycieki `ObjectDB` (`2× Node3D` w `ports/godot-isometric-world/scripts/globe_view.gd`: `town_labels_3d` i `bldg_labels_3d` podpięte pod `pivot` → `0` wycieków na wyjściu!), błędy `.ctex` w loaderze tekstur, kontrakty `shop_sell` / `unequip_item` / `discover_waystone`, limit zabójstw AoE (okno 1 s / 14 zabójstw) oraz indeksowanie `questEntries()` i `normalized()` w `src/components/admin/world-overview/model.ts`.

7. **Błyskawiczne modularne aktualizacje OTA (1.14.30) + dolny pasek ładowania z prędkością:**
   - Rozbito monolityczne `core-c101` (`348 MB`) w `scripts/godot/build_preview_update.py` na lekki rdzeń kodu/UI/JSON/muzyki menu **`core-c101` (`~12.7 MB`)** oraz **8 osobnych, niezmiennych paczek zasobów świata (`world-actors-a/b/c`, `world-objects`, `world-monsters`, `world-regions`, `world-audio`, `world-interiors`)** rejestrowanych w `manifest.lands.world` i automatycznie reużywanych przez wskaźniki Git LFS przy kolejnych aktualizacjach kodu.
   - Usunięto ok. `57 MB` duplikatów (`.mp3str`/`.ctex` zbędne przy dekodowaniu surowych bajtów w runtime oraz zduplikowane `intro.ogv` obecne już w APK).
   - Dodano w `ports/godot-pyra/scripts/service_screen.gd` **równoległy pobieracz 4-wątkowy bez limitu** (`download_chunk_size = 1 MB`, `body_size_limit = -1`), natychmiastowy cache SHA-256 (`user://content/world_packs_ok.json`) oraz **dolny pasek postępu z prędkością na żywo (`MB/s` / `KB/s`, `MB / MB`, `%`)**; ten sam dolny pasek z prędkością i buforem `1 MB` wdrożono w `ports/godot-pyra/scripts/boot.gd` i `content.gd`.
   - Zwiększono bufor strumieniowania paczek po stronie serwera (`highWaterMark: 1 MB` w `src/server/godot/contentFiles.ts`) i wyłączono buforowanie proxy w `deploy/Caddyfile` (`flush_interval -1`).

8. **Optymalizacja FPS na Androida (`12 → 50–60 FPS`), trwałe usuwanie postaci, Aura KI wokoło, łup jak w Diablo i klasyczny RPG Ekwipunek (OTA `1.14.31`):**
   - **Optymalizacja GPU/CPU:** zastąpiono jednolity teren `131 072` trójkątów przez **64 indeksowane chunki `8×8` z cullingiem kamery** (`STEP = 4`, widoczne tylko ~4 chunki ≈ `2048` trójkątów), zastąpiono ukryty pełnoekranowy `ocean_skirt` **4 zewnętrznymi pasami ramki** (`0%` marnowanego overdraw na lądzie), odchudzono `terrain.gdshader` (`40 → 4–8` haszy/piksel + pomijanie nieużywanych tekstur materiałów), `ocean_skirt.gdshader` i `cloud_shadows.gdshader`, dodano spatial chunk culling dla budynków/surowców/skarbów/waystones, wyeliminowano jałowe przerysowania `rpg_hud.sync_status()`, ograniczono `world_atmosphere.gd` (28 cząsteczek @ 24 Hz), `ambient_fx.gd` (20 Hz), `premium_minimap.gd` i `sync_hero()` (~8 Hz dla skanów bliskości).
   - **Trwałe usuwanie postaci (gra + panel admina):** `deleteCharacter()` i `adminDeleteCharacter()` w `src/server/godot/store.ts` oznaczają teraz również powiązaną postać przeglądarkową (`game.characters.retired_at = now()`), dzięki czemu `bridgeBrowserCharacters()` nigdy nie wskrzesza usuniętej postaci; w `ports/godot-pyra/scripts/service_screen.gd` dodano także czyszczenie lokalnego cache i `DELETE /ws/characters/:id`.
   - **Aura Formy KI wyłącznie wokoło bohatera:** w `ports/godot-isometric-world/scripts/actor_view.gd` przeniesiono płomienie, wstęgi i błyskawice na warstwę tylną (`ki_aura_back`) wokół sylwetki, pozostawiając warstwę przednią tylko dla zewnętrznych iskier (`|x| >= 38`) i dolnego łuku pod stopami — postać i twarz są w 100% widoczne.
   - **Łup jak w Diablo (`world.gd`):** zabite potwory wyrzucają na ziemię fizyczne stosy złota i przedmioty ze słupem światła rzadkości, ikoną i tabliczką (`spawn_ground_loot`); podejście/wejście na łup (`<= 34 m`) automatycznie przyciąga i podnosi go z dźwiękiem i komunikatem.
   - **Duży, czytelny HUD Postaci i Plecaka jak w klasycznym RPG (`rpg_hud.gd`):** okno niemal na cały ekran (`96% × 94%`), sylwetka bohatera z 8 dużymi slotami wokół niej (Hełm u góry, Buty u dołu, Broń/Pancerz/Rękawice po lewej, Amulet/Tarcza/Pierścień po prawej), 2× większe komórki plecaka (`62–68 px`), szczegółowy inspektor z porównaniem statystyk po 1× kliknięciu, duży przycisk **`⚔ ZAŁÓŻ` / `🧪 UŻYJ` / `↩ ZDEJMIJ`** obok opisu oraz szybkie **2× kliknięcie**.

Uwaga: wszystkie wydania OTA (`1.14.28`–`1.14.31`) i wdrożenia na Arubie wykonano za wyraźną zgodą właściciela wyłącznie na gałęzi `feat/isometric-world-2d-terrain3d-20261118`; nie scalano do `main` i nie dotykano instancji GPU.
