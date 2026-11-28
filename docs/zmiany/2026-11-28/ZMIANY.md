# 2026-11-28 — Premium dźwięki potworów i lochów, przebudowa AAA labiryntów i czytelny mobilny HUD (`OTA 1.14.38`)

Po uwagach właściciela z 28.11.2026 dotyczącym trzech konkretnych obszarów (amatorskie odgłosy ataku potworów, zbyt małe czcionki w HUD i ekranach funkcyjnych na telefonie oraz przestarzały schematyczny widok labiryntów z kółkiem i kwadratami) wykonano pełną przebudowę tych trzech systemów w [`ports/godot-isometric-world/`](../../../ports/godot-isometric-world).

### 1. Premium oprawa dźwiękowa potworów (40 plików) oraz ścieżki i efekty lochów (8 plików)

| Obszar | Zmiana | Weryfikacja |
| --- | --- | --- |
| Generator i mastering audio ([`build_premium_audio.py`](../../../scripts/godot/build_premium_audio.py)) | Zastąpiono stare, płaskie bleepy oscylatorowe (`6–15 KB`, `-22 dB`) zestawem **48 zmasterowanych plików stereo MP3 `44.1 kHz / 160 kbps`** (`1,15 MB` łącznie, bez przebudowy 8 paczek `world-*` — dystrybuowane w `core-c101`): **40 odgłosów potworów** w 10 archetypach (`beast`, `insect_spider`, `serpent_slime`, `stone_golem`, `fire_dragon`, `frost_crystal`, `arcane_spirit`, `mech_cyber`, `plant_druid`, `boss_colossus` × `atk1`, `atk2`, `roar`, `die` — synteza traktów głosowych, sub-bas, chrzęst pancerza, pogłos komorowy, ograniczanie bez przesterów) oraz **8 ścieżek lochów** (4 bezszwowe mroczne ambienty biomów `lab_pyra`, `lab_verdant`, `lab_aether`, `lab_nexus` + `chest_open`, `portal_enter`, `dungeon_step`, `guardian_alert`). | `audit_gamemaster.gd` (`97/97`): `40/40` plików potworów i `8/8` plików lochów ładuje się bez błędów przez `world.audio.load_stream()`. |
| Routing w silniku audio ([`world_audio.gd`](../../../ports/godot-isometric-world/scripts/world_audio.gd)) | Dodano mapowanie `_monster_archetype()` dla wszystkich 41+ potworów i bossów, naprzemienne odtwarzanie `atk1`/`atk2` z subtelną wariacją wysokości tonu, metodę `play_dungeon_music(theme)` przełączającą ścieżkę muzyczną przy wejściu do labiryntu oraz `play_dungeon_sfx(key)` dla kroków z echem, otwierania skrzyń, portalu i alertu strażników. | Automatyczne przełączanie muzyki przy wejściu i wyjściu z labiryntu (`world.gd` -> `on_exit_labyrinth()`). |

### 2. Przebudowa AAA labiryntów — teksturowane komnaty 3D, żywi bohaterowie i strażnicy, światło pochodni i VFX

| Obszar | Zmiana | Weryfikacja |
| --- | --- | --- |
| Prawdziwa architektura lochów zamiast kółka i kwadratów ([`labyrinth_room.gd`](../../../ports/godot-isometric-world/scripts/labyrinth_room.gd)) | Przepisano od zera cały renderer labiryntu na wielowarstwową scenę 2D (`floor_layer` -> `ysort_layer` -> `CombatVFX` -> addytywny `light_layer` -> `hud_overlay`): teksturowane posadzki z płyt kamiennych/mchu/lawy/lodu/cyber-metalu z cieniami kontaktowymi AO i runami podłogowymi, płynnie łączone 3D-ekstrudowane mury z tekstur `mat_3.png` (`512×512`) z rzeźbionymi fugami i świecącymi żyłami run, malowane rekwizyty (`chest.webp`, `firepot.webp`, `lanterns.webp`, `barrels.webp`, `crates.webp`, `weapons.webp`), migoczące pochodnie, 56 unoszących się cząsteczek biomu, wirujący Portal Wyjścia oraz drżenie kamery przy trafieniach. | `audit_gamemaster.gd` (`97/97`), `audit_stage1..4.gd` (`0` błędów) oraz inspekcja wizualna OpenGL3 `1600×720` (`Labirynt Korzeni Druidów` i `Labirynt Wulkanicznej Kaldery`). |
| Prawdziwe animowane modele 3D bohatera i strażników (`IsoWorldActor`) | Zastąpiono niebieskie kółko i czerwone kropki prawdziwym animowanym aktorem bohatera (`world.actors_db`, w tym także formą GameMastera i aurą Ki) oraz prawdziwymi animowanymi strażnikami z `monsters.json` (`verdant-straznik-ruin`, `pyra-golem-ruin`, `aether-lew-swiatyni`, `nexus-straznik-rdzenia` itd.) z pełnym `CombatVFX`, krokami z echem, rykami i efektami ciosów. | Zrzuty OpenGL3 `1600×720` potwierdzają pełną widoczność tekstur podłóg, murów, postaci, strażników, skrzyń, portalu i pasków walki. |

### 3. Czytelny mobilny HUD i ekrany funkcyjne (koniec z mikroskopijnymi czcionkami)

| Obszar | Zmiana | Weryfikacja |
| --- | --- | --- |
| Postać i Ekwipunek, Drzewko Talentów oraz HUD w świecie ([`rpg_hud.gd`](../../../ports/godot-isometric-world/scripts/rpg_hud.gd)) | Powiększono wszystkie napisy w oknie `POSTAĆ I EKWIPUNEK` (etykiety 8 slotów ekwipunku `13 → 17 px` z grubym obrysem i czystym odstępem bez nachodzenia, atrybuty `15–16 → 19–20 px`, przyciski `+` `34×32`, plecak `20 px` i liczniki stosów `18 px`, szczegóły przedmiotu `18–23 px`, przycisk akcji `220×56 / 21 px`), w `DRZEWKU TALENTÓW` (`16–22 px`) oraz na HUD w świecie (pasek bossa, podgląd celu, kule `POWRÓT`/`UNIK`/`KI+`/`LOT`/`TURBO`, śledzenie zadań i pasek zdarzeń `16–18 px`). | Inspekcja wizualna OpenGL3 `1600×720` (`qa_v3_03_character_sheet_big_ui.png`). |
| Kuźnia, Sklep, Bank, Karczma, Arena i Dojo ([`interior_room.gd`](../../../ports/godot-isometric-world/scripts/interior_room.gd)) | Poszerzono okno usług na `95%` ekranu (`1520×696`), powiększono nagłówek do `27 px`, pasek zasobów do `20 px`, główne zakładki (`CRAFTING`, `ULEPSZ`, `DZIEDZICTWO`) do `19 px / 54 px`, filtry kategorii do `17 px / 48 px`, a każdą pozycję receptury, sklepu, ulepszeń i treningów oprawiono w osobną ciemną kartę obsydianową z ikoną `52×52`, nazwą `20 px`, składnikami `17 px` i przyciskiem akcji `19 px / 56 px`. | Inspekcja wizualna OpenGL3 `1600×720` (`qa_v3_04_smithy_crafting_big_ui.png`). |
| Dziennik Zadań, Menu Gry, Panel GM i wspólny nagłówek ([`forged_ui.gd`](../../../ports/godot-isometric-world/scripts/forged_ui.gd), [`quest_journal.gd`](../../../ports/godot-isometric-world/scripts/quest_journal.gd), [`game_menu.gd`](../../../ports/godot-isometric-world/scripts/game_menu.gd), [`gm_panel.gd`](../../../ports/godot-isometric-world/scripts/gm_panel.gd)) | Ujednolicono czytelność wszystkich pozostałych okien funkcyjnych: nagłówek `26 px` + podtytuł `17 px` + `← WSTECZ` `20 px / 56 px`, zero tekstów poniżej `16 px` w oknach funkcyjnych. | `npm run typecheck`, `npm run assets:check`, `npx vitest run src/test/admin-readability.test.tsx`, `python3 scripts/docs/check_documentation.py`. |

## Przygody na rubieżach Superior — Android

Rozmieszczono osiem nowych lokacji na obrzeżach czterech kontynentów, 665–1740 m od stolic. Dobór sprawdza połączenie z terenem dostępnym ze stolicy, zapas miejsca na grupę oraz odległość od istniejącego miasta, spawnu i areny bossa. Na potrzeby tej dostawy zaprojektowano misje na poziomy 3–6 i użyto aktualnej grafiki oraz archetypów AI Androida.

| Kraina | Przygody | Rozgrywka |
| --- | --- | --- |
| Verdantia | Listy, które nie odpłynęły · Drzewo rośnie w dół | Odzyskanie niedoręczonej poczty na porzuconej przeprawie oraz śledzenie podziemnych korzeni w dawnym sadzie |
| Aetheria | Godzina wyjęta z nieba · Ciepło pod śniegiem | Śledztwo przy Czarnej Igle i starcie z Lustrzanym Motylem oraz odnalezienie nieszczelnego przewodu grzewczego |
| Pyra | Uderzenie po Ciszy · Cena jednego dzbana | Badanie starego sygnału lawowego i walka przy dzwonnicy oraz odtworzenie losów zaginionej karawany |
| Nexus-9 | Numer, którego brakowało · Odprawa po awarii | Odzyskanie kopii dziennika z martwego obwodu oraz starcie ze skanerem i odczyt odprawy w nieczynnej stacji |

Każda lokacja ma własne dialogi i skrytkę. Łącznie dodano 14 punktów spawnów, w tym cztery nazwane elity. Zlecenia korzystają ze wspólnego dziennika, zapisów i świata Androida. Serwer zalicza wskazane pokonanie strażnika i potwierdzone otwarcie skrytki. Nagrody questów i skrytek są jednorazowe. Zmiana nie wymaga migracji formatu zapisów.

Źródłem jest `scripts/godot/wilderness_adventures.json`. Regeneracja przebiega przez `python scripts/godot/add_wilderness_adventures.py` oraz `python scripts/godot/export_android_world_data.py`. Test rozmieszczenia i danych wykonuje tryb `--check` pierwszego skryptu. Weryfikacja na Godocie 4.6.3 objęła 237/237 sprawdzeń rozmów, tras, celów i nagród oraz 96/96 w audycie etapu 4. Testy ekonomii i zapisów serwera zaliczyły 21/21. Telefon fizyczny pozostaje niezweryfikowany.

## Kandydat do wydania Android 1.14.39

Wydanie łączy przygody na rubieżach, nowe grafiki ośmiu aktywnych bossów i atlas administratora. Zmieniono trzy paczki OTA (kod, regiony i potwory), a 35 wcześniejszych zachowuje identyczne sumy kontrolne. Dane atlasu są generowane z tych samych paczek i umieszczane w prywatnym katalogu woluminu serwera. Endpoint wybiera atlas według aktualnie aktywnej wersji OTA. Plik atlasu nie jest częścią plików statycznych ani commita.

### Publikacja 1.14.39 na produkcji

- Kod serwera z SHA `3fadb73e5dc31f0bd4d81ba17033a522512158cd` przeszedł pełną bramkę i testy wdrożenia Aruba. [Przebieg wdrożenia](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/46153394825)
- Zapisano atlas administratora na prywatnym woluminie i aktywowano OTA 1.14.39. Weryfikacja na serwerze objęła 38 paczek i zakończyła się bez różnic. [Przebieg publikacji OTA](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/46163287032)
- Po publikacji odczytano dokładnie manifest 1.14.39 i pobrano trzy zmienione paczki z domeny produkcyjnej. Ich rozmiary i SHA-256 zgadzają się z manifestem. Żądanie do atlasu bez sesji administratora otrzymało HTTP 403. [Manifest Androida](https://kilegends.pl/ws/godot/manifest?client=101)

## Android 1.14.40 — widoczność przycisków walki

- HUD pokazuje atak podstawowy oraz odblokowane umiejętności przypisane do paska. Ikona, obwódka, oznaczenie klawisza i pole dotyku pojawiają się po odblokowaniu. Czas odnowienia i niski poziom KI zachowują widoczność przycisku.
- Przycisk „Lot” na HUD-zie i w panelu GM pojawia się po aktywowaniu formy GameMastera. Zamknięcie formy usuwa przycisk i możliwość użycia jego wcześniejszego pola dotyku.
- Test widoczności uruchomiony na paczce wydania w Godot 4.6.3 z rendererem OpenGL sprawdził cztery rasy, zapisane przypisania umiejętności oraz wejście i wyjście z formy GM. Zaliczono 60 z 60 asercji. Audyt GM zaliczył 98 z 98 asercji. Fizyczny telefon nie brał udziału w tych testach.
- Do aktualizacji OTA przebudowano paczkę `core-c101` na bazie 1.14.39. Porównanie plików potwierdziło zmiany w trzech skryptach i wewnętrznym manifeście. Pozostałe 37 paczek zachowało identyczne hashe. Prywatny atlas administratora wygenerował się z paczek wydania.
