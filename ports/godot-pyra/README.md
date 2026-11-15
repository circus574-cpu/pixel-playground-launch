# KI Legends Android — projekt Godot 4

Dokumentacja natywnej aplikacji **KI Legends na Androida** (Godot 4.6.3, GDScript, renderer Compatibility),
stan 15.11.2026, wersja **0.5.0-world**. Gałąź `ccr-ebbd6459-n7c5eg`, kontynuacja
[PR #170](https://github.com/circus574-cpu/pixel-playground-launch/pull/170) (`feat/godot-pyra-android-20261115`).

Aplikacja nie wymaga React, Phasera ani serwera gry. Obecna gra WWW pozostaje osobnym produktem; zapisy WWW i konta
nie są czytane. **Bez potworów i bez spawnów** (decyzja właściciela na ten etap).

## 1. Co działa

| Obszar | Zakres |
| --- | --- |
| Świat | **Cała planeta Superior:** 4 kontynenty (Pyra 65 600 × 42 304 j., Verdantia 77 504 × 58 560, Aetheria 70 208 × 53 440, Nexus-9 63 168 × 49 728) i **6 wysp** (ok. 13–16 tys. × 8–12 tys. j.), geometria Superior v2; łącznie ok. 197 tys. obiektów scenerii, drogi i ścieżki, ukryte miejsca. Każda kraina ma własne podłoże, tekstury i malowane obiekty |
| Rasy | **Cztery grywalne rasy:** Legendy (Pyra), Planetarni (Verdantia), Mędrcy (Aetheria), Androidy (Nexus-9). Każda z własnym bohaterem (**+15 %** rozmiaru), statystykami z aneksu (poziomy 1–20), drzewkiem 29 węzłów z ikonami, zdolnościami czynnymi i własnym zasobem (Żar / Adaptacja terenu / Kręgi światła / Ładunek Rdzenia); wybór rasy przy pierwszym starcie i w MENU → NOWA POSTAĆ |
| Ruch i dotyk | Joystick 360°, ATAK, 4 sloty zdolności, UNIK, kontekstowe E; niezależne palce; klawiatura: WASD, Spacja, 1–4, Shift, E, M, C |
| Miasta i wnętrza | Cztery miasta na każdym kontynencie (np. Twierdza Popiołu, Zielona Przystań, Sanktuarium Tysiąca Źródeł, Węzeł Świadomości) po 6 usług (Sala, sklep, arena, depozyt, kuźnia, gospoda) = 24 wejścia na kontynent, a na każdej wyspie przystań z 6 usługami; wnętrza i mieszkańcy w stylu świata (Pyra, Verdantia, Aetheria, Nexus-9), przewodnicy i miejsca na szlakach |
| Mapa i podróże | Globus **3D**, atlas **2D** i mapa szczegółowa bieżącej krainy (z miastami, miejscami i znacznikiem gracza); dotknięcie regionu pokazuje opis, a przycisk **PODRÓŻ** przenosi do miejsca przybycia (osada lub brzeg) w dowolnej z 10 krain. Atlas i globus wybierają region z tych samych obrysów |
| Walka | Tylko manekin treningowy na arenach (nie oddaje ciosów, nie płaci nagród); zdolności działają też w świecie jako efekty/buffy. **Brak potworów i spawnów** |
| Miasto na gotowo | Monety, plecak (40 stosów), 8 slotów wyposażenia z wpływem na statystyki, **sklep** (85 słabych przedmiotów, cena 4×, skup za połowę), **kuźnia** (receptury kuźni, alchemii i run z katalogu 265), **depozyt** (przedmioty i monety), **gospoda** (5 monet), mikstura (40 % HP, 6 s) — we wszystkich czterech światach |
| Zapis | Checkpoint v2 (kraina, rasa, pozycja, wnętrze, poziom, drzewko, sloty, ekonomia); import checkpointu v1; ochrona nieznanego formatu |
| Start i ikona | **Wstęp: ilustracja właściciela** (cała, bez zniekształceń), przycisk ZACZNIJ PRZYGODĘ, na dole „Powered by GODOT ENGINE” z oficjalnym logo; boot splash z tą samą ilustracją; ikony Android; licencje silnika w menu |

**Poza zakresem (nie przeniesione):** potwory i spawny (osobna generacja), zdobywanie doświadczenia (nie ma źródła —
poziom ustawia się ręcznie w ekranie POSTAĆ jako „poziom próbny”), questy (Sala Przysięgi), moneta z walki, receptury stacji
Nexusa i Księgi, ulepszanie sprzętu, bonusy zestawów i pasywnych artefaktów, audio, konta i synchronizacja, efekty otoczenia
(dym/para/żar), życie mieszkańców (stoją w miejscu). Obecność sklepu czy skrzyni w tekście nie oznacza wdrożenia usługi.

## 2. Instalacja gotowego APK

APK: `deliveries/godot-pyra-android-20261115-world/ki-legends-godot-debug.apk`, **100789166 bajtów** (96,1 MiB, poniżej
limitu 100 MiB pliku w Git), SHA-256 `45bea2fa321d965af89fd28ca781ee6fc62500dfe7e5f53566f0383550e1eb50`. Wymaga Androida 7.0+ i `arm64-v8a`.

1. Pobierz APK na telefon i otwórz plik (zezwól na instalację z tego źródła; nie wyłączaj Play Protect).
2. Wersje 0.3.0 i 0.4.0 zaktualizują się w miejscu (ten sam klucz debug). **Jeżeli masz 0.2.0, odinstaluj ją najpierw**:
   0.3.0 i nowsze są podpisane innym kluczem debug (poprzedni został poza repozytorium). Checkpoint znika z aplikacją.
3. Uruchom **KI LEGENDS**, obróć telefon poziomo, wybierz **ZACZNIJ PRZYGODĘ**, a potem swoją rasę.

```sh
adb install -r deliveries/godot-pyra-android-20261115-world/ki-legends-godot-debug.apk
```

Pakiet `pl.kilegends.godot.pyra`, wersja `0.5.0-world`, kod 5, min SDK 24 / target 36, `USER_LANDSCAPE`, OpenGL ES 3.
Brak uprawnień internetu i pamięci zewnętrznej. To debug APK, nie wydanie Google Play.
**Instalacja, płynność i pamięć na fizycznym Androidzie są niezweryfikowane** (brak urządzenia w tej sesji).

### Sterowanie

| Czynność | Telefon | Komputer |
| --- | --- | --- |
| Ruch | lewy joystick | WASD / strzałki |
| Atak podstawowy | ATAK (przytrzymaj) | Spacja |
| Zdolność | okrągłe sloty 1–4 (ikona = węzeł drzewka, pod nią koszt KI; ciemna nakładka = odnowienie) | 1–4 |
| Unik | UNIK | Shift |
| Wejście, rozmowa, wyjście | E | E / F |
| Mapa / Postać / Plecak / Powiększenie / Menu | przyciski u góry | M / C / I / — / Esc |
| Mikstura | PLECAK → UŻYJ | H |

Zdolność wymaga celu w zasięgu (~90 j.): w świecie nie ma celów, więc skuteczny test to manekin na arenie
(wejście oznaczone złotym kołem przy Arenie). Kamera domyślnie oddalona (80 %); przycisk ZOOM przełącza 60/80/100 %.

## 3. Uruchomienie w edytorze

Godot **4.6.3 Standard** (bez .NET). Zaimportuj `ports/godot-pyra/project.godot`, poczekaj na import, F5.

```sh
godot --headless --editor --path ports/godot-pyra --import
godot --path ports/godot-pyra            # opcja `-- --fresh` pomija odczyt checkpointu
```

## 4. Architektura i pliki

| Plik w `ports/godot-pyra` | Odpowiedzialność |
| --- | --- |
| `scripts/continent.gd`, `assets/continent/terrain.gdshader` | Dowolna kraina z `data/lands/<id>/`: jeden quad z shaderem terenu (4 biomy, ląd/morze, brzeg, lawa/kryształ, dwie nakładki, drogi z maski 16 j. i klasy materiału, dziedzińce miast; lustrzane kafle bez szwów), strumieniowanie obiektów po chunkach 2048 j., maska kolizji |
| `scripts/city_game.gd` | Scena gry (`PyraGame`): wczytanie krainy (`enter_land`), miasta, wnętrza, interakcje, walka na manekinie, ekrany, podróże (`travel_to`), nowa postać (`start_new_character`), zapis |
| `scripts/player.gd` | Ruch kinematyczny po masce marszu (kraina) lub prostokątach (wnętrza); bez ciał fizycznych |
| `scripts/actor_view.gd` | Animacje: arkusze NPC i przycięte ramki atlasu bohatera; `HERO_SCALE = 1.15` |
| `scripts/race_kit.gd`, `legend_kit.gd`, `planetary_kit.gd`, `sage_kit.gd`, `android_kit.gd`, `race_kits.gd` | Wspólna baza zasad (statystyki 1–20, drzewko, rangi, odnowienia, buffy, tarcze, kręgi, kanały) i cztery rasy (porty `src/game/kit/*.ts` + `base.ts`) |
| `scripts/race_screen.gd` | Wybór rasy: cztery karty z portretami, opisem i statystykami |
| `scripts/foe_dummy.gd`, `scripts/fx.gd` | Manekin treningowy, efekty cięć/wybuchów/aur, liczby obrażeń |
| `scripts/touch_controls.gd`, `scripts/hud.gd` | Joystick, przyciski, paski HP/KI/zasób rasy, dialogi, bezpieczne marginesy ekranu |
| `scripts/map_screen.gd`, `globe_view.gd`, `atlas_view.gd`, `continent_map_view.gd`, `map_math.gd` | Mapa: globus 3D, atlas 2D, mapa bieżącej krainy, przycisk PODRÓŻ; wspólna geometria i obrysy |
| `scripts/character_screen.gd` | Ekran POSTAĆ: statystyki ze źródłami, **drzewko rasy z ilustrowanymi ikonami** (`assets/icons/skills/<rasa>/`), sloty, poziom próbny |
| `scripts/economy.gd`, `scripts/items_screen.gd` | Monety, plecak, wyposażenie, sklep, depozyt, gospoda, kuźnia; jeden ekran usług i plecaka |
| `scripts/markers.gd` | Złote koła na ziemi przy wejściach |
| `data/lands/<id>/` | `land.json` (rozmiary, miejsce przybycia, osady i usługi, NPC, miejsca, tekstury, chunki, domy stolicy Pyry), `objects.bin` (rozmieszczenie), `walk.bin` (maska marszu 16 j.) — dla 10 krain |
| `assets/lands/<id>/` | Siatki biomów i lądu, maska i klasy dróg, kafle terenu, mapa szczegółowa |
| `data/races/<rasa>.json`, `data/actors.json`, `data/rooms.json` | Aneks i drzewko rasy z opisem, arkusze bohaterów i NPC czterech światów, wnętrza usług czterech światów |
| `data/hero.json`, `data/map.json`, `data/economy.json`, `data/world-provenance.json` | Klipy bohatera Legendy, regiony i komórki mapy (10 krain), katalog 366 przedmiotów i 265 receptur, SHA źródeł i wyników |
| `data/city.generated.json` | Stolica Pyry z pierwszej próby (układ, podłoga, pokoje) — nie edytować ręcznie |
| `tests/smoke.gd` | 304 kontrole w prawdziwym silniku |

**Układ współrzędnych:** gra używa współrzędnych świata Superior (jak WWW). Układ stolicy z pierwszej próby jest
przesunięty o `world.json.offset` = (44 564,29; 12 168,47).

**Kolizja:** `walk.bin` = siatka nawigacji ∧ teren suchy ∧ poza kolizjami (powiększonymi o promień stopy 12 j.).
Sąsiedztwo wody blokuje o jedną komórkę 16 j. więcej niż przeglądarka (konserwatywnie). Zapis i kolizje nie zależą od grafiki.

**Pamięć i rozmiar:** malowane tekstury (scenografia, ludzie, wnętrza, kafle terenu, mapy) są importowane jako stratny WebP
(`scripts/godot/tune_imports.py`; sprite'y scenerii są współdzielone, więc ich zdekodowany rozmiar jest mały), dzięki czemu APK
ma ok. 96 MiB. Dane odczytywane dokładnie (siatki biomów/lądu, maska i klasy dróg) pozostają bezstratne. Pamięć tekstur zgłoszona
przez silnik po wczytaniu krainy: 117–138 MiB na kontynentach, ok. 70 MiB na wyspach. To pomiar na desktopie, nie telefonie.

## 5. Odtwarzanie danych i grafiki

Wymaga pełnego repozytorium, Pythona 3, Pillow i numpy. Skrypty czytają opublikowane pliki Superior v2 i **nie
regenerują geometrii**; `world-provenance.json` zapisuje SHA-256 źródeł i wyników.

```sh
npx tsx scripts/godot/export-lands.ts                # obiekty, role tekstur, drogi, domy stolicy dla 10 krain -> /tmp/godot-lands
python3 scripts/godot/prepare_lands.py               # dane i grafika 10 krain (kafle atlasów wysp wycinane z ramek)
npx tsx scripts/godot/export-actors-rooms.ts         # bohaterowie, NPC i wnętrza czterech światów
python3 scripts/godot/prepare_actors.py
python3 scripts/godot/prepare_races.py               # statystyki, drzewka i opisy czterech ras + portrety
python3 scripts/godot/prepare_continent_hero.py      # klipy bohatera Legendy (paczka 3.3.0)
python3 scripts/godot/prepare_continent_maps.py      # atlas, globus, regiony i komórki mapy dla 10 krain
python3 scripts/godot/prepare_icons.py               # ikony zdolności czterech ras (okrągłe) i paski
npx tsx scripts/godot/export-economy.ts              # przedmioty, receptury, ceny sklepu, ikony przedmiotów
python3 scripts/godot/prepare_intro.py               # wstęp i boot splash z ilustracji właściciela (wymaga sharp)
godot --headless --editor --path ports/godot-pyra --import
python3 scripts/godot/tune_imports.py                # malowane tekstury: stratny WebP (rozmiar APK)
godot --headless --editor --path ports/godot-pyra --import
python3 scripts/godot/write_provenance.py
```

Mapowanie obiektów na grafiki to wywołanie funkcji przeglądarki dla każdej krainy (`pyraObjects`, `continentObjects`,
`aetheriaObjects`, `nexusObjects`, `islandObjects`: nazwy, przerzedzanie, mosty/schody). Pominięte: efekty otoczenia (dym, para, żar).

Most TypeScript czyta bieżące kontrakty i grafiki; Python odtwarza marginesy
przyciętych atlasów, origin/mirrored oraz kafle podłoża. Nie generuje nowego świata
ani ilustracji zastępującej scenę. Ponowienie na nowszym commicie może zmienić dane;
sprawdź diff, pochodzenie i testy przed zaakceptowaniem wyniku.
Nie edytuj ręcznie plików `*.generated.json`, aby obejść rozbieżność kontraktów.

`prepare_branding.py` adaptuje istniejący `public/ki-favicon.svg` i konwertuje
repozytoryjny Cinzel z WOFF2 do TTF. Wymaga `fonttools[woff]` (w tym Brotli).
Nie tworzy nowej grafiki świata. `assets/branding/provenance.json` zapisuje SHA
źródeł i wyników. Pełny OFL jest w paczce i dostępny w menu licencji.
Ekran startowy używa „Powered by” i oryginalnego logotypu Godot; boot splash
pokazuje oryginalny logotyp. Plik `godot/logo-large-color-dark.svg` pochodzi
z oficjalnego press kitu, bez zmian liter, kolorów lub proporcji. Jego źródło
i SHA zapisano w `godot/provenance.json`, a atrybucję CC BY 4.0 dołączono do
zasobów i menu licencji. Wstęp używa ilustracji właściciela (`intro-source.png` w repozytorium, poza APK; skrót SHA w `intro-provenance.json`).
Miasto powstaje dopiero po zatwierdzeniu przycisku, z ochroną przed wielokrotnym
uruchomieniem i przejęciem dotyku startowego przez sterowanie gry.

## 6. Budowanie Androida

Godot 4.6.3 + oficjalne Export Templates 4.6.3, JDK 21, Android SDK `platform-tools`, `platforms;android-36`,
`build-tools;36.0.0`. Standardowy eksport nie wymaga Gradle ani NDK.

```sh
python3 scripts/godot/build_android.py --sdk /sciezka/Android/Sdk --java /sciezka/JDK
```

Wynik: `ports/godot-pyra/builds/ki-legends-pyra-debug.apk`. Klucz debug powstaje przy pierwszym eksporcie i zostaje
poza repozytorium (`~/.local/share/ki-legends-godot/debug.keystore`); zachowaj go, aby kolejne APK były aktualizacjami.

## 7. Zapisy

`user://city-checkpoint-v1.json`, format `ki-godot-pyra-save-2` (wersja 2): pozycja, wnętrze, miejsce powrotu,
poziom, XP, drzewko, sloty, HP/KI. Format `ki-godot-pyra-save-1` z wersji 0.2.0 jest importowany (przesunięcie do
współrzędnych świata). Nieznany lub uszkodzony plik blokuje nadpisanie. Zapis jest ręczny (MENU). Backup Androida wyłączony.

## 8. Testy i dowody

```sh
godot --headless --path ports/godot-pyra --script res://tests/smoke.gd -- --fresh --qa-output /tmp/pyra-headless
xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra --rendering-method gl_compatibility --script res://tests/smoke.gd -- --fresh --qa-output /tmp/pyra-native
```

Na kodzie tej gałęzi: **304/304** kontroli w trybie headless i **304/304** z natywnym renderowaniem (Mesa llvmpipe).
Pokrycie: ekonomia (katalog 366/265/85, cena sklepu 4×, skup 50 %, wymagania poziomu, wpływ sprzętu, mikstura, crafting, depozyt,
gospoda, zapis, cztery ekrany usług), rozmiar kontynentu, bezpieczny start, strumieniowanie, **+15 % bohatera**, kolizje,
osiągalność 24 drzwi Pyry i powroty, dotyk, prędkość przy 30/120 FPS, zasady Legendy (statystyki, drzewko, rangi, zdolności na
manekinie), zapis, mapy (miasta wszystkich 10 krain leżą wewnątrz własnych obrysów na atlasie; globus i atlas wybierają ten
sam region), **wczytanie każdej z 10 krain** (stoi na ziemi, ograniczona liczba sprite'ów, drzwi i NPC), **wejście i wyjście
z każdego z ok. 96 wnętrz usług czterech kontynentów**, **cztery rasy** (nowa postać startuje w swoim mieście, statystyki
poziomów 1 i 20 z aneksu, 29 węzłów, +15 % bohatera, podstawowy atak i każda z 6 zdolności czynnych na manekinie bez błędu),
ekran wyboru rasy, **podróż z mapy** (PODRÓŻ na wyspę 3 i z powrotem), układ w trzech rozmiarach ekranu.
Zrzuty: `docs/zmiany/2026-11-15/qa/godot-world/`.

Dodatkowo paczka PCK wyeksportowana z presetu Linux została uruchomiona w osobnym katalogu (`--main-pack`): wszystkie 10 krain,
po jednym wnętrzu sklepu dla czterech ras, 0 błędów (dowodzi, że filtry eksportu dołączają `data/lands/*`). APK sprawdzono:
podpis v2, CRC, pakiet, etykieta, wersja, `arm64-v8a`.
Testy Vitest mostu źródeł (`src/test/godot-pyra-export.test.ts`) nie były uruchamiane w tej sesji (brak `node_modules`);
nie zmieniono źródeł, które czyta.

**Niezweryfikowane:** instalacja i działanie na fizycznym telefonie, FPS, bateria, RAM/VRAM, przycisk Wstecz,
pinch-zoom na mapie (kod jest, test tylko na myszy), czasy ładowania na telefonie.

## 9. Dalsza praca

1. Odbiór na fizycznym Androidzie; pomiary pamięci/FPS (kluczowe: czas wczytania krainy, ok. 120–140 MiB tekstur).
2. Spawny i potwory (osobna generacja na gotowych danych świata, miasta pozostają bezpieczne), zdobywanie doświadczenia i łup.
3. Questy, Sala Przysięgi, stacje craftingu Nexusa i Księgi — przenosić kanoniczne reguły, nie upraszczać balansu.
4. Życie mieszkańców, dźwięk, efekty otoczenia.
5. Jakość grafiki: drobne ślady stratnego WebP przy dużym powiększeniu; rozważyć ASTC, jeśli rozmiar APK nie będzie ograniczeniem.

Pracować na osobnych gałęziach; bez scalenia, publikacji i zmian produkcji bez decyzji właściciela. Nie modyfikować
infrastruktury GPU. Prawa do grafik pozostają według rejestru projektu; eksport do Godot nie nadaje nowych uprawnień.
