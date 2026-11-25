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

Uwaga: prace wykonano wyłącznie na gałęzi roboczej; nic nie scalono do `main`, nie wypchnięto ani nie opublikowano (OTA), nie dotykano instancji GPU.
