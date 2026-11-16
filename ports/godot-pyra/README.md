# KI Legends Android — projekt Godot 4

Dokumentacja natywnej aplikacji **KI Legends na Androida** (Godot 4.6.3, GDScript, renderer Compatibility),
stan 16.11.2026. Kod w repozytorium to **pełna gra: potwory, questy, dźwięk, ekwipunek, bossowie, jaskinie, wydarzenia świata, dzień i noc**
(sekcja 1); ostatni zbudowany APK (`0.7.0-bestiary`, sekcja 2) jest starszy niż kod: **nie ma w nim questów, dźwięku, zasad
ekwipunku, rzadkich cech potworów, bossów, jaskiń, wydarzeń świata, dnia i nocy ani życia mieszkańców**. Zgodnie z decyzją właściciela APK końcowy powstaje dopiero po przeniesieniu całości, w pełnej jakości grafiki.
Gałąź `ccr-ebbd6459-n7c5eg`, kontynuacja
[PR #170](https://github.com/circus574-cpu/pixel-playground-launch/pull/170) (`feat/godot-pyra-android-20261115`).

Aplikacja nie wymaga React, Phasera ani serwera gry. Obecna gra WWW pozostaje osobnym produktem; zapisy WWW i konta
nie są czytane. Miasta są bezpieczne (brak przeciwników); wieloosobowość nie istnieje i niczego takiego nie obiecujemy.

## 1. Co działa

| Obszar | Zakres |
| --- | --- |
| Świat | **Cała planeta Superior:** 4 kontynenty (Pyra 65 600 × 42 304 j., Verdantia 77 504 × 58 560, Aetheria 70 208 × 53 440, Nexus-9 63 168 × 49 728) i **6 wysp** (ok. 13–16 tys. × 8–12 tys. j.), geometria Superior v2; łącznie ok. 197 tys. obiektów scenerii, drogi i ścieżki, ukryte miejsca. Każda kraina ma własne podłoże, tekstury i malowane obiekty |
| Rasy | **Cztery grywalne rasy:** Legendy (Pyra), Planetarni (Verdantia), Mędrcy (Aetheria), Androidy (Nexus-9). Każda z własnym bohaterem (**+15 %** rozmiaru), statystykami z aneksu (poziomy 1–20), drzewkiem 29 węzłów z ikonami, zdolnościami czynnymi i własnym zasobem (Żar / Adaptacja terenu / Kręgi światła / Ładunek Rdzenia); wybór rasy przy pierwszym starcie i w MENU → NOWA POSTAĆ |
| Ruch i dotyk | Joystick 360°, ATAK, 4 sloty zdolności, UNIK, kontekstowe E; niezależne palce; klawiatura: WASD, Spacja, 1–4, Shift, E, M, C |
| Miasta i wnętrza | Cztery miasta na każdym kontynencie (np. Twierdza Popiołu, Zielona Przystań, Sanktuarium Tysiąca Źródeł, Węzeł Świadomości) po 6 usług (Sala, sklep, arena, depozyt, kuźnia, gospoda) = 24 wejścia na kontynent, a na każdej wyspie przystań z 6 usługami; wnętrza i mieszkańcy w stylu świata (Pyra, Verdantia, Aetheria, Nexus-9), przewodnicy i miejsca na szlakach |
| Mapa i podróże | Globus **3D**, atlas **2D** i mapa szczegółowa bieżącej krainy (z miastami, miejscami i znacznikiem gracza); dotknięcie regionu pokazuje opis, a przycisk **PODRÓŻ** przenosi do miejsca przybycia (osada lub brzeg) w dowolnej z 10 krain. Atlas i globus wybierają region z tych samych obrysów |
| Potwory | **41 definicji** (40 potworów bestiariusza + osa-pomocnik przywoływana przez Osę Bursztynową) na opublikowanych rejestrach spawnów 10 krain (8 752 miejsc, maks. 24 aktywnych): błądzą (lub patrolują trasę), atakują, gonią, używają umiejętności z ostrzeżeniem na ziemi, nakładają statusy; zabicie daje XP (poziomy 1–20), monety, łup i 2 % słabego przedmiotu; śmierć = powrót do stolicy krainy; miasta są bezpieczne. **Rzadkie cechy zaimplementowane** (sekcja 1a). Słabości na klasy obrażeń zdolności (ogień, ki, elektryczność, woda, ogłuszenie, obszar, fizyczne) |
| Questy | **102 grywalne zadania z 106** (główne, poboczne, ukryte, międzykontynentalne): przyjmowanie u NPC (!, ? nad głową), cele rozmowy/walki/odkrycia/odwiedzin/dostawy, nagrody (XP, monety, przedmiot, reputacja), odkrywanie 16 sławnych i 17 ukrytych miejsc, tracker w HUD, dziennik w MENU, zapis; **28 postaci ma autorskie dialogi** (powitania, plotki, kwestie zależne od stanu zadania) |
| Walka | Wszystkie zdolności czterech ras działają na potworach i na manekinie areny (nie oddaje ciosów); każda zdolność niesie klasy obrażeń (`TAGS` w `race_kit.gd`) liczone ze słabościami potwora; unik daje nietykalność na czas animacji |
| Bossowie | **8 bossów** z katalogu przeglądarki (Ygdrasha, Thorgar, Arcykapłan Pustki, Aurelith, Arbiter Zero, Hydra-Rdzeń, Kharzul, Pyrrhax) — po dwóch na kontynent, z fazami, atakami z ostrzeżeniem, łupem do plecaka i mechanikami z opisów katalogu; wejście przez **Strażnika leża** w stolicy kontynentu (przycisk WEJDŹ DO LEŻA) |
| Jaskinie | **22 wejścia** zarezerwowane w świecie Superior (4 na kontynent, 1 na wyspę, kamienne bramy na mapie) prowadzą do jaskiń: labirynt korytarzy i komnat, klucz, krata na jedynej drodze do skarbca, skrzynie, strażnicy z potworów krainy (elitarni przy skarbcu), kolce w korytarzach, ciemność z latarnią bohatera |
| Wydarzenia świata | **14 wydarzeń** katalogu (zasadzki, zagrożenia obszarowe, zlecenia odnawialne, konwój) rozgrywane na drogach między miastami: budzą się, gdy bohater podejdzie, płacą XP, monety i przedmiot, potem odpoczywają (300/600 s; „once” nie wraca) |
| Żywy świat | Dzień (480 s: wieczór od 270 s, noc 300–450 s, świt do 480 s) z barwieniem sceny i cechą `night` potworów; mieszkańcy ulic spacerują wokół posterunku i zatrzymują się przy bohaterze; płomienie, dym, para, żar i iskry nad ogniskami, źródłami, lawą i kryształami |
| Dźwięk | Muzyka właściciela (5 pętli: ekran startowy i cztery kontynenty, crossfade), tło miasta i światów, 271 efektów ElevenLabs (trafienia, zdolności czterech ras, potwory, statusy, interfejs, drzwi, łup), kroki według podłoża; głośność w MENU (muzyka 30 %, efekty 60 %) |
| Miasto na gotowo | Monety, plecak (40 stosów), 8 slotów wyposażenia z wpływem na statystyki, **sklep** (85 słabych przedmiotów, cena 4×, skup za połowę), **kuźnia i pięć stacji craftingu** (kuźnia, alchemia, runy, fabrykator Nexusa, Księgi — receptury z katalogu 265), **ulepszanie u kowala** (broń do +3: +2 ATK za poziom; elementy pancerza do +2: +1 DEF), **bonusy pasywne i zestawowe** z globalnymi limitami V2, **depozyt** (przedmioty i monety), **gospoda** (5 monet), mikstura (leczy `hpBonus`, domyślnie 50 HP) — we wszystkich czterech światach |
| HUD | Medalion z portretem rasy i pierścieniem XP, ozdobne paski HP/KI/zasób, buffy z licznikami, monety, baner lokacji, ramka celu, okrągła minimapa z mapy krainy, okrągłe przyciski menu, tracker zadań (do trzech aktywnych zadań), pasek XP, szybki slot mikstury, ikony zdolności; rysunek w pamięci podręcznej (odświeżany tylko przy zmianie); MENU → FPS I DIAGNOSTYKA |
| Płynność | Podłoże wypalane do tekstur 512 j., strumieniowanie scenerii w porcjach na wątkach, prefetch wnętrz, symulacja na klatkę (bez skoków na ekranach 90/120 Hz) |
| Zapis | Checkpoint v2 (kraina, rasa, pozycja, wnętrze, poziom, drzewko, sloty, ekonomia z ulepszeniami, dziennik zadań); import checkpointu v1; stary zapis bez zadań wczytuje się z pustym dziennikiem; ochrona nieznanego formatu |
| Start i ikona | **Wstęp: ilustracja właściciela** (cała, bez zniekształceń), przycisk ZACZNIJ PRZYGODĘ, na dole „Powered by GODOT ENGINE” z oficjalnym logo; boot splash z tą samą ilustracją; ikony Android; licencje silnika w menu |

**Poza zakresem (nie ma w kodzie):** konta i synchronizacja, wieloosobowość, kolejne piętra jaskiń, bossowie w jaskiniach. Obecność sklepu czy
skrzyni w tekście nie oznacza wdrożenia usługi. **Co z poniższego istnieje w przeglądarce, a co jest dorobione dla portu**, mówi sekcja 1b.

### 1b. Co jest z przeglądarki, a co dorobione

| Element | Z przeglądarki (`src/game`) | Dorobione dla portu (autorskie, do akceptacji właściciela) |
| --- | --- | --- |
| Bossowie | Katalog (`bosses/catalog.ts`): statystyki, fazy z mnożnikami i listami ataków, ataki, tabele łupu, wygląd (strażnik kontynentu w 180 px), dźwięki, wejście przez Strażnika | Łup trafia do plecaka (przeglądarka trzyma go w podglądzie bez zapisu); zasięg ataków wręcz = zasięg ciała (przeglądarka: cały promień agresji); dystans ranged bosses; odporność na ogłuszenie (¼) i spowolnienie (½), brak odepchnięcia; mechaniki z opisów katalogu (niżej); Strażnicy Aether (Ilvara), Nexus (K-7), Pyra (Draven) — w przeglądarce jest tylko Kaelen z Verdantii |
| Jaskinie | Rezerwacja 22 wejść (`world.json`: „entrance reserved; interior integration pending”), obiekty bram na mapie, paczka grafik `dungeon-kit`, model postępu z kluczami, kratami i skrzyniami (`dungeonProgress.ts`) | Cały wnętrze: generator labiryntu zależny od id wejścia, rozmieszczenie klucza/kraty/skrzyń/strażników/kolców, nagrody skrzyń, ciemność i światło bohatera, podłoga proceduralna |
| Wydarzenia | 14 definicji (nazwa, poziom, promień, powtarzalność, nagroda) | Miejsca, stwory, zadania do wykonania (uwolnić posłańca, odnowić znaki, zabezpieczyć lustra, skalibrować pylony, zneutralizować źródło), chmury zagrożeń, odnowa |
| Dzień i noc | Cecha `night` potworów i `host.isNight()` | Zegar 480 s, barwienie sceny, napis „noc” w banerze |
| Mieszkańcy, efekty | — | Spacery NPC, efekty otoczenia (`ambient_fx.gd`) |

**Mechaniki bossów z opisów katalogu** (`scripts/boss_script.gd`): Ygdrasha regeneruje 1 % HP/s w fazach 1–2, w fazie 3 kielich jest odsłonięty
(+25 % obrażeń) i trujące zarodniki zostają na ziemi; Thorgar w fazie 3 ponownie wyje (bez wilków, oślepienie 3 s); Arcykapłan w fazie 2 wzywa
trzy Świetliki i do ich zniszczenia przyjmuje tylko 30 % obrażeń, jego pieczęcie zostawiają strefy na 5 s, w fazie 3 kurczy się pierścień areny;
Aurelith w fazach 2–3 lata, w fazie 3 stawia trzy filary i Oddech Eteru (promień) mija schowanego za filarem; Arbiter w fazie 2 wzywa dwa drony, a w
fazie 3 co 30 s przez 10 s jest przegrzany (+40 % obrażeń); Hydra przełącza się między trzema głowami (listy ataków faz); Kharzul w fazie 3 podpala
arenę (strefy z ostrzeżeniem) i blokuje leczenie miksturami; Pyrrhax w fazie 2 lata, w fazie 3 erupcja wymaga schronienia w jednym z trzech
bezpiecznych kręgów. Liczby stref (obrażenia, czasy, promienie) są autorskie.

### 1a. Zasady potworów (`scripts/monster.gd`, `scripts/monster_manager.gd`)

Dane (`data/monsters.json`) pochodzą z bestiariusza; port nie zmienia balansu. Szkic modelu obrażeń bohatera na potworze:
`max(1, surowe × mnożniki − DEF/2)`, gdzie mnożniki to słabość klasy obrażeń zdolności (`weak`: największa z pasujących, wartość
< 1 oznacza odporność), pieczęć, pancerz z przodu (`frontArmor`) i bonus z tyłu (`backBonus`) liczone względem kierunku, w którym
potwór patrzy na bohatera, bonusy odsłonięcia (`exposedBonus`: po chybionej szarży, przegrzana wieżyczka, odwrót nurkującego),
wynurzony zakopywacz (`burrow.bonus`), zwinięcie (`curl`, nie dotyczy ki), redukcja z umiejętności; tarcza (`guard`) pochłania
obrażenia przed HP.

| Cecha | Działanie w porcie |
| --- | --- |
| `still`, `fly`, `ghost`, `keep`, `flank`, `leash`, `wander`, `route` | stoi / lata (omija maskę marszu) / przenika / trzyma dystans / okrąża / uwiąź na gnieździe / promień błądzenia / patrol po punktach |
| `provoked` + `giveUp`, `opportunist`, `night`, `retreat`, `rage`, `slowBelow`, `ramp` | atakuje dopiero po trafieniu i odpuszcza po czasie / tylko gdy HP bohatera poniżej progu / w dzień zmniejszony zasięg wykrycia (zegar dnia 480 s, noc od 300 s licząc od wejścia do krainy) / odwrót poniżej progu HP / szał (obrażenia i tempo) / spowolnienie przy niskim HP / narastanie obrażeń z kolejnymi atakami |
| `pack` | wilki i nietoperze budzą się w watahach (2–3 sztuki wokół miejsca spawnu; członkowie bez własnego miejsca respawnu) |
| `explode`, `deathZone`, `trail`, `webs` + `webSlow` | wybuch przy śmierci / strefa po śmierci / ślad pod stopami / pajęczyny w promieniu gniazda (maks. 3, 120 s); pająk poza własną siecią jest wolniejszy |
| Strefy (`zone` w umiejętnościach, ślady, sieci, chmury) | kolorowy krąg na ziemi; co 0,5 s zadaje ułamek ATK właściciela i nakłada statusy (np. spowolnienie sieci) |
| `burrow`, `ambush`, `dive`, `fleeAfterHits`, `curl`, `reflect`, `interrupt`, `brittleTail` | zakopywanie (nietykalny pod ziemią, wynurza się przy bohaterze) / zasadzka (ukryty do podejścia, cios z mnożnikiem `opener`, potem chowa się) / nurkowanie po serii ataków / ucieczka po liczbie trafień / zwijanie co kilka trafień / odbicie części obrażeń nie-ki / ogłuszenie przy dużym trafieniu w trakcie rzucania / po liczbie trafień traci ogon (bez ataków wręcz) |
| `split`, `revive`, `medic`, `turret`, `summon` | rozdzielenie na dwie części o 40 % HP (klon bez nagrody, łączą się po czasie) / odrodzenie z częścią HP (raz) / leczy rannych sojuszników / wieżyczka obraca się, strzela salwami, przegrzewa się i jest wtedy podatna / przywołuje pomocników bez własnego miejsca spawnu |

Statusy nakładane na bohatera: spowolnienie, unieruchomienie/ogłuszenie/strach (blokada ruchu), wyciszenie, DoT, osłabienie,
obniżony pancerz, oznaczenie, ślepota/mgła, zdjęcie tarczy, przyciągnięcie. Nietykalny bohater (unik) nie otrzymuje obrażeń ani statusów.

## 2. Instalacja gotowego APK

APK: `deliveries/godot-pyra-android-20261116-complete/ki-legends-godot-debug.apk`, **148234924 bajtów** (141,4 MiB, plik w Git LFS —
bez limitu 100 MiB zwykłego pliku), SHA-256 `8071893d82fa242dc0b4d59db6823103513fdbeb49e5d318312a71007a311701`, wersja **0.8.0-complete** (kod 8).
Zawiera całą grę z sekcji 1. Wymaga Androida 7.0+ i `arm64-v8a`. Starsze dostawy (0.7.0-bestiary i wcześniejsze) nie mają questów, dźwięku,
bossów, jaskiń ani wydarzeń świata.

1. Pobierz APK na telefon i otwórz plik (zezwól na instalację z tego źródła; nie wyłączaj Play Protect).
2. Wersje 0.3.0 i 0.4.0 zaktualizują się w miejscu (ten sam klucz debug). **Jeżeli masz 0.2.0, odinstaluj ją najpierw**:
   0.3.0 i nowsze są podpisane innym kluczem debug (poprzedni został poza repozytorium). Checkpoint znika z aplikacją.
3. Uruchom **KI LEGENDS**, obróć telefon poziomo, wybierz **ZACZNIJ PRZYGODĘ**, a potem swoją rasę.

```sh
adb install -r deliveries/godot-pyra-android-20261116-complete/ki-legends-godot-debug.apk
```

Pakiet `pl.kilegends.godot.pyra`, wersja `0.8.0-complete`, kod 8, min SDK 24 / target 36, `USER_LANDSCAPE`, OpenGL ES 3.
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
| `scripts/continent.gd`, `assets/continent/terrain.gdshader` | Dowolna kraina z `data/lands/<id>/`: shader terenu (4 biomy, ląd/morze, brzeg, lawa/kryształ, dwie nakładki, drogi z maski 16 j. i klasy materiału, dziedzińce miast; lustrzane kafle bez szwów) wypalany do tekstur kwadratów 512 j., strumieniowanie obiektów po chunkach 2048 j. w porcjach czasowych z ładowaniem tekstur na wątkach, maska kolizji |
| `scripts/cached_layer.gd`, `scripts/hud.gd`, `scripts/touch_controls.gd` | HUD i przyciski dotykowe rysowane do przezroczystego SubViewport w rozdzielczości urządzenia, odświeżane tylko po zmianie stanu (2 quady w spoczynku) |
| `scripts/quest_engine.gd` | Silnik questów (port `src/game/quests`): stan, cele, nagrody, znaczniki NPC, rozmowy, tracker, zapis |
| `scripts/boss_script.gd`, `data/bosses.json` | Mechaniki ośmiu bossów (filary, pierścień areny, bezpieczne kręgi, przegrzanie, bariera, regeneracja) i dane katalogu |
| `scripts/dungeon.gd`, `data/dungeons.json`, `assets/dungeon/` | Jaskinie: generator labiryntu i zawartości (klucz, krata, skrzynie, strażnicy, kolce), dane wejść, 12 grafik `dungeon-kit` |
| `scripts/world_events.gd` | 14 wydarzeń świata: miejsca, stwory, rekwizyty, nagrody, odnowa, zapis |
| `scripts/ambient_fx.gd` | Płomienie, dym, para, żar i iskry nad scenerią (wyłączane poza ekranem) |
| `scripts/audio.gd` | Muzyka (crossfade), tła, efekty (pula 14 odtwarzaczy, minimalne odstępy), kroki, głośności w `user://audio.json` |
| `scripts/monster.gd`, `scripts/monster_manager.gd` | Potwór (AI, atak, umiejętności, statusy, wszystkie rzadkie cechy z sekcji 1a) i zarządca spawnów krainy (budzenie, usypianie, respawn, pociski, strefy, pajęczyny, przywołania, klony, zegar dnia i nocy, nagrody). Zarządca żyje przez całą grę; zwolnienie go w trakcie rozgrywki wywala silnik, dlatego `setup` tylko go resetuje |
| `scripts/map_style.gd` | Wspólny styl map i globusa: plakietki Cinzel, znaczniki rodzajów miejsc, kompas, winieta, ramka |
| `scripts/city_game.gd` | Scena gry (`PyraGame`): wczytanie krainy (`enter_land`), miasta, wnętrza, interakcje, walka na manekinie, ekrany, podróże (`travel_to`), nowa postać (`start_new_character`), zapis |
| `scripts/player.gd` | Ruch kinematyczny po masce marszu (kraina) lub prostokątach (wnętrza); bez ciał fizycznych |
| `scripts/actor_view.gd` | Animacje: arkusze NPC i przycięte ramki atlasu bohatera; `HERO_SCALE = 1.15` |
| `scripts/race_kit.gd`, `legend_kit.gd`, `planetary_kit.gd`, `sage_kit.gd`, `android_kit.gd`, `race_kits.gd` | Wspólna baza zasad (statystyki 1–20, drzewko, rangi, odnowienia, buffy, tarcze, kręgi, kanały) i cztery rasy (porty `src/game/kit/*.ts` + `base.ts`) |
| `scripts/race_screen.gd` | Wybór rasy: cztery karty z portretami, opisem i statystykami |
| `scripts/foe_dummy.gd`, `scripts/fx.gd` | Manekin treningowy, efekty cięć/wybuchów/aur, liczby obrażeń |
| `scripts/touch_controls.gd`, `scripts/hud.gd` | Joystick, przyciski, paski HP/KI/zasób rasy, dialogi, bezpieczne marginesy ekranu |
| `scripts/map_screen.gd`, `globe_view.gd`, `atlas_view.gd`, `continent_map_view.gd`, `map_math.gd` | Mapa: globus 3D, atlas 2D, mapa bieżącej krainy, przycisk PODRÓŻ; wspólna geometria i obrysy |
| `scripts/character_screen.gd` | Ekran POSTAĆ: statystyki ze źródłami, **drzewko rasy z ilustrowanymi ikonami** (`assets/icons/skills/<rasa>/`), sloty, poziom próbny |
| `scripts/economy.gd`, `scripts/items_screen.gd` | Monety, plecak, wyposażenie (bonusy pasywne, zestawy, limity V2), sklep, depozyt, gospoda, pięć stacji craftingu, ulepszanie u kowala; jeden ekran usług i plecaka (6 zakładek kuźni) |
| `scripts/markers.gd` | Złote koła na ziemi przy wejściach |
| `data/lands/<id>/` | `land.json` (rozmiary, miejsce przybycia, osady i usługi, NPC, miejsca, tekstury, chunki, domy stolicy Pyry), `objects.bin` (rozmieszczenie), `walk.bin` (maska marszu 16 j.) — dla 10 krain |
| `assets/lands/<id>/` | Siatki biomów i lądu, maska i klasy dróg, kafle terenu, mapa szczegółowa |
| `data/races/<rasa>.json`, `data/actors.json`, `data/rooms.json` | Aneks i drzewko rasy z opisem, arkusze bohaterów i NPC czterech światów, wnętrza usług czterech światów |
| `data/hero.json`, `data/map.json`, `data/economy.json`, `data/world-provenance.json` | Klipy bohatera Legendy, regiony i komórki mapy (10 krain), katalog 366 przedmiotów i 265 receptur, SHA źródeł i wyników |
| `data/city.generated.json` | Stolica Pyry z pierwszej próby (układ, podłoga, pokoje) — nie edytować ręcznie |
| `data/monsters.json`, `data/quests.json`, `data/lands/<id>/spawns.json` | Bestiariusz (statystyki, umiejętności, cechy, łup, klatki), katalog zadań z dialogami i miejscami, rejestr spawnów krainy |
| `assets/audio/` | Muzyka (`music/`) i efekty (`sfx/`) skopiowane bez zmian (24 MB) |
| `tests/smoke.gd` | 420 kontroli w prawdziwym silniku; `tests/qa_shots.gd` robi zrzuty jaskini, bossa, nocy i wydarzenia |

**Układ współrzędnych:** gra używa współrzędnych świata Superior (jak WWW). Układ stolicy z pierwszej próby jest
przesunięty o `world.json.offset` = (44 564,29; 12 168,47).

**Kolizja:** `walk.bin` = siatka nawigacji ∧ teren suchy ∧ poza kolizjami (powiększonymi o promień stopy 12 j.).
Sąsiedztwo wody blokuje o jedną komórkę 16 j. więcej niż przeglądarka (konserwatywnie). Zapis i kolizje nie zależą od grafiki.

**Pamięć i rozmiar:** malowane tekstury (scenografia, ludzie, wnętrza, kafle terenu, mapy) są importowane jako stratny WebP
(`scripts/godot/tune_imports.py`; sprite'y scenerii są współdzielone, więc ich zdekodowany rozmiar jest mały), (wysoka jakość; APK idzie przez Git LFS, więc rozmiar nie jest ograniczony do 100 MiB). APK ma ok. 118 MiB. Dane odczytywane dokładnie (siatki biomów/lądu, maska i klasy dróg) pozostają bezstratne. Pamięć tekstur zgłoszona
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
npx tsx scripts/godot/export-monsters.ts            # 40 potworów + pomocnik: zasady, cechy, łup, rozmiary
npx tsx scripts/godot/export-bosses.ts               # 8 bossów: katalog, fazy, łup, tłumaczenie na walkę
python3 scripts/godot/prepare_bosses.py              # -> data/bosses.json (sprawdza łup, strażników i przywołania)
python3 scripts/godot/prepare_dungeons.py            # 22 wejścia jaskiń i grafiki dungeon-kit -> data/dungeons.json, assets/dungeon
python3 scripts/godot/prepare_monsters.py            # arkusze potworów i rejestry spawnów krain
npx tsx scripts/godot/export-economy.ts              # przedmioty, receptury, ceny sklepu, limity i zestawy, ulepszenia, ikony
npx tsx scripts/godot/export-quests.ts               # 106 zadań, dialogi NPC, sławne i ukryte miejsca -> data/quests.json
python3 scripts/godot/prepare_audio.py               # muzyka i efekty (kopia bez zmian) -> assets/audio
python3 scripts/godot/prepare_land_maps.py          # mapy szczegółowe krain malowane z siatek terenu
python3 scripts/godot/prepare_intro.py               # pozioma kompozycja wstępu i boot splash z ilustracji właściciela (wymaga sharp)
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
poziom, XP, drzewko, sloty, HP/KI, ekonomia (plecak, wyposażenie, monety, depozyt, ulepszenia kowala), dziennik zadań i odkryte miejsca; głośność osobno w `user://audio.json`. Format `ki-godot-pyra-save-1` z wersji 0.2.0 jest importowany (przesunięcie do
współrzędnych świata). Nieznany lub uszkodzony plik blokuje nadpisanie. Zapis jest ręczny (MENU). Backup Androida wyłączony.

## 8. Testy i dowody

```sh
godot --headless --path ports/godot-pyra --script res://tests/smoke.gd -- --fresh --qa-output /tmp/pyra-headless
xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra --rendering-method gl_compatibility --script res://tests/smoke.gd -- --fresh --qa-output /tmp/pyra-native
```

Na kodzie tej gałęzi: **420/420** kontroli w trybie headless (16.11.2026). Przebieg z natywnym renderowaniem (Mesa llvmpipe) był
ostatnio wykonany przy 340 kontrolach i nie został powtórzony dla 420; zrzuty jaskini, bossa, nocy i wydarzenia powstały natywnie
(`docs/zmiany/2026-11-16/qa/godot-late/`).
Pokrycie: ekonomia (katalog 366/265/85, cena sklepu 4×, skup 50 %, wymagania poziomu, wpływ sprzętu, mikstura, crafting, depozyt,
gospoda, zapis, cztery ekrany usług), rozmiar kontynentu, bezpieczny start, strumieniowanie, **+15 % bohatera**, kolizje,
osiągalność 24 drzwi Pyry i powroty, dotyk, prędkość przy 30/120 FPS, zasady Legendy (statystyki, drzewko, rangi, zdolności na
manekinie), zapis, mapy (miasta wszystkich 10 krain leżą wewnątrz własnych obrysów na atlasie; globus i atlas wybierają ten
sam region), **wczytanie każdej z 10 krain** (stoi na ziemi, ograniczona liczba sprite'ów, drzwi i NPC), **wejście i wyjście
z każdego z ok. 96 wnętrz usług czterech kontynentów**, **cztery rasy** (nowa postać startuje w swoim mieście, statystyki
poziomów 1 i 20 z aneksu, 29 węzłów, +15 % bohatera, podstawowy atak i każda z 6 zdolności czynnych na manekinie bez błędu),
ekran wyboru rasy, **podróż z mapy** (PODRÓŻ na wyspę 3 i z powrotem), układ w trzech rozmiarach ekranu, **potwory** (41
definicji, 8 752 miejsc, budzenie, walka, nagrody, statusy, śmierć i powrót), **rzadkie cechy** (słabość na ogień, pancerz z przodu
kraba, bonus z tyłu lwa, przywołanie os, podział roju, odrodzenie ducha, strefa sieci spowalnia bohatera, dzień i noc), **questy**
(106/102/16/17, przyjęcie, etapy, odkrycia, nagroda raz, zapis), **dźwięk** (pliki w paczce, muzyka podąża za światem),
**zasady ekwipunku** (limity V2, ulepszenia kowala, pięć stacji, mikstura), **bossowie** (osiem, fazy, mechaniki, strażnik, nagrody), **jaskinie** (22 wejścia, labirynt, klucz, krata, skrzynie, kolce, zapis), **wydarzenia świata**, **żywy świat** (dzień i noc, spacery mieszkańców, efekty otoczenia).
Zrzuty: `docs/zmiany/2026-11-15/qa/godot-world/`.

Dodatkowo paczka PCK wyeksportowana z presetu Linux została uruchomiona w osobnym katalogu (`--main-pack`): wszystkie 10 krain,
po jednym wnętrzu sklepu dla czterech ras, 0 błędów (dowodzi, że filtry eksportu dołączają `data/lands/*`). APK sprawdzono:
podpis v2, CRC, pakiet, etykieta, wersja, `arm64-v8a`.
Testy Vitest mostu źródeł (`src/test/godot-pyra-export.test.ts`) nie były uruchamiane w tej sesji (brak `node_modules`);
nie zmieniono źródeł, które czyta.

**Niezweryfikowane:** instalacja i działanie na fizycznym telefonie, FPS, bateria, RAM/VRAM, przycisk Wstecz,
pinch-zoom na mapie (kod jest, test tylko na myszy), czasy ładowania na telefonie.

## 9a. Kontynuacja pracy w nowej sesji (instrukcja dla Claude)

**Stan na 16.11.2026:** ostatni APK to 0.7.0-bestiary (kod 7), kod jest dalej i zawiera całą grę: 10 krain, 4 rasy, miasta z usługami,
mapy 2D/3D, HUD, 41 potworów ze wszystkimi cechami, XP/monety/łup, questy z dialogami, dźwięk, zasady ekwipunku, 8 bossów, 22 jaskinie,
14 wydarzeń świata, dzień i noc, spacery mieszkańców, efekty otoczenia, wstęp na cały ekran. **Następne:** końcowy APK w pełnej jakości
(patrz niżej), pomiary na telefonie i balans liczb autorskich (sekcja 1b). Zasady: `AGENTS.md` (m.in. brak PR i merge bez
zgody, nie przepisywać opublikowanej historii, **nie sterować instancjami GPU**, jedna dokumentacja tematyczna + dziennik
dnia), `docs/INDEX.md`.

**Kolejność pracy (decyzja właściciela):** najpierw przenieść całą grę, dopiero potem zbudować APK; nigdy nie obniżać jakości
grafiki dla rozmiaru (limit 100 MiB nie obowiązuje, gra ma być docelowo większa). Użytkownik nie buduje aplikacji — buduje asystent
i podaje link.

**Zasada dostawy APK:** APK nie jest commitowany domyślnie — kod i dokumentacja wystarczą, żeby go zbudować. Commituj APK
(Git LFS, `deliveries/<data>-<nazwa>/`, plus `manifest.json` z SHA-256) tylko gdy właściciel o to poprosi. Narzędzie Dysku
Google w sesji nie wgra APK (parametr `base64Content` przechodzi przez model; 120 MB nie przejdzie) — do wgrania na Dysk
właściciel pobiera plik z repozytorium albo buduje go lokalnie.

**Środowisko (świeży kontener nie ma niczego):**
```sh
# Godot 4.6.3 (Standard) + szablony eksportu 4.6.3
curl -LO https://github.com/godotengine/godot-builds/releases/download/4.6.3-stable/Godot_v4.6.3-stable_linux.x86_64.zip
curl -LO https://github.com/godotengine/godot-builds/releases/download/4.6.3-stable/Godot_v4.6.3-stable_export_templates.tpz
#  zip -> /usr/local/bin/godot ; tpz (zip) -> ~/.local/share/godot/export_templates/4.6.3.stable/ (zawartość katalogu templates/)
# JDK 21 oraz Android SDK (cmdline-tools): sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
pip install pillow numpy fonttools brotli        # skrypty scripts/godot/*.py
npm ci                                           # tsx i eksportery TypeScript (scripts/godot/export-*.ts)
apt-get install -y xvfb                          # testy z natywnym renderowaniem
```
`prepare_intro.py` wymaga modułu `sharp` (`npm i sharp` poza repozytorium i `NODE_PATH`).

**Klucz podpisu.** Debug keystore powstaje przy pierwszym eksporcie w `~/.local/share/ki-legends-godot/debug.keystore` i zostaje
poza repozytorium. Nowy kontener = nowy klucz = telefon nie zaktualizuje aplikacji w miejscu (trzeba odinstalować starą, zapis
zniknie). Chcąc ciągłości, właściciel przechowuje ten plik (hasło debug: `android`, alias `androiddebugkey`) i podaje go nowej
sesji do `~/.local/share/ki-legends-godot/`.

**Pętla pracy:**
1. `git pull` gałęzi `ccr-ebbd6459-n7c5eg` (lub nowej gałęzi od niej); przeczytaj `docs/INDEX.md`, ten README i dziennik 16.11.
2. Dane z TS/Pythona (sekcja 5), `godot --headless --editor --path ports/godot-pyra --import`, `python3 scripts/godot/tune_imports.py`,
   ponowny import.
3. Testy: `godot --headless --path ports/godot-pyra --script res://tests/smoke.gd -- --fresh` (oczekuj samych PASS; ok. 3 min);
   z natywnym renderowaniem w sekcji 8. Zrzuty do kontroli wzrokowej: skrypt na `RenderingServer.frame_post_draw`.
4. Paczka: eksport PCK (`--export-pack "Linux"`) i uruchomienie poza projektem przez `--main-pack` (sprawdza filtry eksportu).
5. APK: `python3 scripts/godot/build_android.py --sdk /opt/android-sdk` (tylko gdy potrzebny), podpis v2 i CRC.
6. Dokumentacja: ten README, dziennik `docs/zmiany/<data>/ZMIANY.md`, `docs/INDEX.md`, `python3 scripts/docs/check_documentation.py`.
7. `npx tsc -b --noEmit`, `npx eslint` dla zmienionych `scripts/godot/*.ts`; cofnij `tsconfig.tsbuildinfo`.
8. Commit i `git push -u origin <gałąź>`; bez PR i merge, jeśli właściciel nie poprosił.

**Pułapki zmierzone w tej pracy:** nowa klasa `class_name` wymaga `godot --headless --import`; zwalnianie obiektu
`PyraMonsters` w trakcie gry wywołuje crash silnika (zarządca żyje przez całą grę, `setup` go resetuje); `$ANDROID_HOME`
= `/opt/android-sdk`; wywołania rysowania HUD kosztują, dlatego rysunek idzie przez `CachedLayer`.

**Prompt do wklejenia w nowej sesji:**
> Kontynuujemy port KI LEGENDS na Androida (Godot 4). Repozytorium `circus574-cpu/pixel-playground-launch`, gałąź
> `ccr-ebbd6459-n7c5eg`. Przeczytaj `AGENTS.md`, `docs/INDEX.md`, `ports/godot-pyra/README.md` (sekcja 9a) i
> `docs/zmiany/2026-11-16/ZMIANY.md`, postaw środowisko według sekcji 9a, uruchom testy `tests/smoke.gd` i sprawdź w sekcji 1
> „Poza zakresem”, co zostało do przeniesienia, i po zatwierdzeniu przez właściciela zrób to; APK buduj dopiero po przeniesieniu
> całości, w pełnej jakości. Nie commituj APK, chyba że poproszę; aktualizuj dokumentację i dziennik.
> Mów konkretnie, pracuj precyzyjnie i bezbłędnie, nie ruszaj instancji GPU.

## 9. Dalsza praca

1. Odbiór na fizycznym Androidzie; pomiary pamięci/FPS (kluczowe: czas wczytania krainy, ok. 120–140 MiB tekstur, walka z 24 potworami,
   jaskinie ze światłem i `CanvasModulate`, wiele efektów otoczenia naraz) i balans liczb autorskich (sekcja 1b).
2. Kolejne piętra jaskiń i bossowie w jaskiniach (nie istnieją w przeglądarce ani w porcie; po decyzji właściciela).
3. Końcowy APK w pełnej jakości (Git LFS tylko na prośbę właściciela), z podpisem v2 i sprawdzeniem CRC.
4. Jakość grafiki: drobne ślady stratnego WebP przy dużym powiększeniu; rozważyć ASTC, jeśli rozmiar APK nie będzie ograniczeniem.

Pracować na osobnych gałęziach; bez scalenia, publikacji i zmian produkcji bez decyzji właściciela. Nie modyfikować
infrastruktury GPU. Prawa do grafik pozostają według rejestru projektu; eksport do Godot nie nadaje nowych uprawnień.
