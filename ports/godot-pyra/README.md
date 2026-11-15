# KI Legends Android — projekt Godot 4

Dokumentacja natywnej aplikacji **KI Legends na Androida** (Godot 4.6.3, GDScript, renderer Compatibility),
stan 15.11.2026, wersja **0.3.0-pyra**. Gałąź `ccr-ebbd6459-n7c5eg`, kontynuacja
[PR #170](https://github.com/circus574-cpu/pixel-playground-launch/pull/170) (`feat/godot-pyra-android-20261115`).

Aplikacja nie wymaga React, Phasera ani serwera gry. Obecna gra WWW pozostaje osobnym produktem; zapisy WWW i konta
nie są czytane. **Bez potworów i bez spawnów** (decyzja właściciela na ten etap).

## 1. Co działa

| Obszar | Zakres |
| --- | --- |
| Kontynent | **Cała Pyra** (65 600 × 42 304 j., geometria Superior v2): teren z opublikowanej siatki biomów, jeziora, morze, lawa, drogi, ~34,6 tys. obiektów (grafika `pyra-continent`), cztery miasta |
| Postać | Legenda, animacje z paczki `hero-legend-walk-v3 3.3.0` (chód/bieg/atak/umiejętności/forma KI), **+15 % rozmiaru** względem poprzedniej wersji (133 → 152,95 j.) |
| Ruch i dotyk | Joystick 360°, ATAK, 4 sloty zdolności, UNIK, kontekstowe E; niezależne palce; klawiatura: WASD, Spacja, 1–4, Shift, E, M, C |
| Miasta i wnętrza | Twierdza Popiołu + trzy miasta (Cytadela Kowadeł, Port Czerwonych Żagli, Żarowy Trakt): 24 wejścia, po 6 wnętrz usługowych, rozmowy, odpoczynek w gospodzie |
| Mapa | Globus **3D**, atlas **2D** (zapętlany poziomo, zoom, wybór regionu z tych samych obrysów) i mapa szczegółowa kontynentu z miastami i miejscami; znacznik gracza w każdej z nich |
| Legenda | Statystyki z aneksu właściciela (poziomy 1–20), drzewko 29 węzłów z rangami, Żar, 10 zdolności czynnych, forma KI; ekran POSTAĆ |
| Walka | Tylko manekin treningowy na arenach (nie oddaje ciosów, nie płaci nagród); zdolności działają też w świecie jako efekty/buffy |
| Zapis | Checkpoint v2 (pozycja, wnętrze, poziom, drzewko, sloty); import checkpointu v1 z poprzedniej wersji; ochrona nieznanego formatu |
| Start i ikona | Ekran KI LEGENDS, „Powered by GODOT ENGINE”, ikony Android, licencje silnika w menu |

**Poza zakresem (nie przeniesione):** potwory i spawny, zdobywanie doświadczenia (nie ma źródła — poziom ustawia się
ręcznie w ekranie POSTAĆ jako „poziom próbny”), questy, ekwipunek, sklep, kuźnia, depozyt, crafting, waluta, audio,
konta i synchronizacja, pozostałe trzy kontynenty i wyspy (na mapie są widoczne, ale niegrywalne), efekty otoczenia
(dym/para/żar), ludzie na szlakach poza przewodnikami. Obecność sklepu czy skrzyni w tekście nie oznacza wdrożenia usługi.

## 2. Instalacja gotowego APK

APK: `deliveries/godot-pyra-android-20261115-continent/ki-legends-pyra-debug.apk`, **80 427 215 bajtów**,
SHA-256 `6f88aa384513b6d947dc0cfad686bd56d08dc7b0427604a05a89e92526f39050`. Wymaga Androida 7.0+ i `arm64-v8a`.

1. Pobierz APK na telefon i otwórz plik (zezwól na instalację z tego źródła; nie wyłączaj Play Protect).
2. **Jeżeli masz poprzednią wersję (0.2.0), odinstaluj ją najpierw**: ten APK jest podpisany nowym kluczem debug
   (poprzedni klucz został poza repozytorium), więc Android odmówi aktualizacji w miejscu. Checkpoint poprzedniej
   wersji znika razem z aplikacją.
3. Uruchom **KI LEGENDS**, obróć telefon poziomo, wybierz **WEJDŹ DO PYRY**.

```sh
adb install -r deliveries/godot-pyra-android-20261115-continent/ki-legends-pyra-debug.apk
```

Pakiet `pl.kilegends.godot.pyra`, wersja `0.3.0-pyra`, kod 3, min SDK 24 / target 36, `USER_LANDSCAPE`, OpenGL ES 3.
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
| Mapa / Postać / Powiększenie / Menu | przyciski u góry | M / C / — / Esc |

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
| `scripts/continent.gd`, `assets/continent/terrain.gdshader` | Cały kontynent: jeden quad z shaderem terenu (wagi biomów, ląd/morze, lawa, brzeg, drogi z maski 16 j., dziedzińce miast), strumieniowanie obiektów po chunkach 2048 j., maska kolizji |
| `scripts/city_game.gd` | Scena gry: kontynent, miasta, wnętrza, interakcje, walka na manekinie, ekrany, zapis |
| `scripts/player.gd` | Ruch kinematyczny po masce marszu (kontynent) lub prostokątach (wnętrza); bez ciał fizycznych |
| `scripts/actor_view.gd` | Animacje: arkusze NPC i przycięte ramki atlasu bohatera; `HERO_SCALE = 1.15` |
| `scripts/legend_kit.gd` | Legenda: statystyki, drzewko, rangi, Żar, zdolności (port `src/game/kit/legend.ts` + `base.ts`) |
| `scripts/foe_dummy.gd`, `scripts/fx.gd` | Manekin treningowy, efekty cięć/wybuchów/aur, liczby obrażeń |
| `scripts/touch_controls.gd`, `scripts/hud.gd` | Joystick, przyciski, paski HP/KI/Żar/XP, dialogi, bezpieczne marginesy ekranu |
| `scripts/map_screen.gd`, `globe_view.gd`, `atlas_view.gd`, `continent_map_view.gd`, `map_math.gd` | Mapa: globus 3D, atlas 2D, mapa kontynentu; wspólna geometria i obrysy |
| `scripts/character_screen.gd` | Ekran POSTAĆ: statystyki ze źródłami, drzewko, sloty, poziom próbny |
| `scripts/markers.gd` | Złote koła na ziemi przy wejściach |
| `data/continent/` | `world.json` (miasta, miejsca, przewodnicy, tekstury), `objects.bin` (rozmieszczenie), `walk.bin` (maska marszu 16 j.), `provenance.json` |
| `data/hero.json`, `data/legend.json`, `data/map.json` | Klipy bohatera, aneks Legendy, regiony i afiniczne komórki mapy |
| `data/city.generated.json` | Stolica z pierwszej próby (układ, pokoje, arkusze NPC) — nie edytować ręcznie |
| `tests/smoke.gd` | 158 kontroli w prawdziwym silniku |

**Układ współrzędnych:** gra używa współrzędnych świata Superior (jak WWW). Układ stolicy z pierwszej próby jest
przesunięty o `world.json.offset` = (44 564,29; 12 168,47).

**Kolizja:** `walk.bin` = siatka nawigacji ∧ teren suchy ∧ poza kolizjami (powiększonymi o promień stopy 12 j.).
Sąsiedztwo wody blokuje o jedną komórkę 16 j. więcej niż przeglądarka (konserwatywnie). Zapis i kolizje nie zależą od grafiki.

**Pamięć:** w stolicy w kadrze jest ~300–440 obiektów rysowania i 90–260 wywołań rysowania (pomiar w Godot, 60–100 %
powiększenia); pamięć tekstur zgłoszona przez silnik ~133 MiB (siatki terenu i maska dróg ~42 MiB, sprite'y
skompresowane VRAM). To pomiar na desktopie, nie telefonie.

## 5. Odtwarzanie danych i grafiki

Wymaga pełnego repozytorium, Pythona 3, Pillow i numpy. Skrypty czytają opublikowane pliki Superior v2 i **nie
regenerują geometrii**; `provenance.json` zapisuje SHA-256 źródeł i wyników.

```sh
python3 scripts/godot/prepare_continent_terrain.py   # siatki biomów/lądu, maska marszu
python3 scripts/godot/prepare_continent_world.py     # obiekty, drogi (maska), miasta, miejsca, sprite'y
python3 scripts/godot/prepare_continent_hero.py      # klipy bohatera (paczka 3.3.0)
python3 scripts/godot/prepare_continent_maps.py      # atlas, globus, mapa kontynentu, regiony
python3 scripts/godot/prepare_legend.py              # statystyki i drzewko Legendy z aneksu
godot --headless --editor --path ports/godot-pyra --import
python3 scripts/godot/tune_imports.py                # sprite'y i arkusze bohatera: kompresja VRAM
godot --headless --editor --path ports/godot-pyra --import
python3 scripts/godot/write_provenance.py
```

Mapowanie obiektów na grafiki to port reguł `src/game/world/generated/pyraContinent.ts` (nazwy, przerzedzanie,
mosty/schody na szerokich traktach). Pominięte: dekoracje „dress”/roadside i efekty otoczenia (dym, para, żar).

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

Na kodzie tej gałęzi: **158/158** kontroli w trybie headless i **158/158** z natywnym renderowaniem (Mesa llvmpipe).
Pokrycie: rozmiar kontynentu, bezpieczny start, strumieniowanie, **+15 % bohatera**, woda/brzeg/kolizje stolicy,
osiągalność 24 drzwi, 24 wnętrza i powroty, dotyk (dwa palce), prędkość przy 30/120 FPS, statystyki poziomów 1/8/20 z aneksu,
wymagania i wykluczenia drzewka, skalowanie rang, zdolności na manekinie (obrażenia, koszt KI, odnowienie, Przełamanie,
Eksplozja Żaru, Szał), zapis (v2, import v1, nieznana wersja), mapy (stolica i miasta wewnątrz obrysu Pyry,
globus wybiera region pod środkiem po wycentrowaniu, atlas wybiera ten sam region, zoom), ekran postaci, układ w trzech
rozmiarach ekranu. Zrzuty: `docs/zmiany/2026-11-15/qa/godot-continent/`.

Dodatkowo eksport Linux ze sceną gry jako startową uruchomiono z paczki PCK (dane `.bin`/`.json` i zasoby z paczki,
0 błędów). APK sprawdzono: podpis v2/v3, wyrównanie 16 KiB, pakiet, etykieta, wersja, `arm64-v8a`.
Testy Vitest mostu źródeł (`src/test/godot-pyra-export.test.ts`) nie były uruchamiane w tej sesji (brak `node_modules`);
nie zmieniono źródeł, które czyta.

**Niezweryfikowane:** instalacja i działanie na fizycznym telefonie, FPS, bateria, RAM/VRAM, przycisk Wstecz,
pinch-zoom na mapie (kod jest, test tylko na myszy), czasy ładowania na telefonie.

## 9. Dalsza praca

1. Odbiór na fizycznym Androidzie; pomiary pamięci/FPS (kluczowe: czas wczytania kontynentu, 133 MiB tekstur).
2. Spawny i potwory (osobna generacja, miasta pozostają bezpieczne), zdobywanie doświadczenia i łup.
3. Questy, ekwipunek, sklep/kuźnia/depozyt, crafting — przenosić kanoniczne reguły, nie upraszczać balansu.
4. Pozostałe kontynenty i wyspy (mapa je już pokazuje), podróże między nimi.
5. Dźwięk, efekty otoczenia, życie mieszkańców.

Pracować na osobnych gałęziach; bez scalenia, publikacji i zmian produkcji bez decyzji właściciela. Nie modyfikować
infrastruktury GPU. Prawa do grafik pozostają według rejestru projektu; eksport do Godot nie nadaje nowych uprawnień.
