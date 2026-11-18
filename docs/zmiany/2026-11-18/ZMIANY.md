# Zmiany — 2026-11-18

## 1. Świat Izometryczny 2D, 4 Stolice Kontynentów i Atlas Planety Superior (`ports/godot-isometric-world`)

Zbudowano i zweryfikowano na podzie GPU właściciela (**RunPod NVIDIA A40 48 GB VRAM, 50 GB RAM**) kompletny, wieloregionowy świat izometryczny 2D w **Godot 4.6.3 + GDScript** wraz z potokiem **Terrain3D + ProtonScatter + Blender 4.0.2 Python API + FastNoiseLite + NumPy/SciPy + Pillow/OpenCV**:

- **Proceduralna topografia (`FastNoiseLite + NumPy + SciPy`):**
  - Wygenerowano w Godot 4.6.3 3-kanałowe pola szumu `FastNoiseLite` (`FBM`, `Ridged`, `Cellular`) dla wszystkich 4 kontynentów oraz atlasu planety.
  - Wygenerowano 32-bitowe mapy wysokości `height.r32`/`height.f32` (`512×512`), mapy kontrolne materiałów `control.r32`/`control.f32` (format bitowy `Terrain3D`), maski przechodniości `walkable.u8`, 8 warstw tekstur PBR (`albedo` + `normal`) oraz maski `weights.png` i `surface.png` dla 4 wielopoziomowych stolic:
    1. **Pyra — Twierdza Popiołu** (`65600 × 42304`, wysokość `-4.67 .. 103.83 m`, `93.28%` przechodniości): *Brama Główna*, *Targ przy Bramie*, *Schody do Popiołu*, *Plac Korony*, *Wysoka Cytadela* oraz *Dolne Kuźnie i Plac Węglowy* nad rzeką lawy.
    2. **Verdantia — Zielona Przystań** (`77504 × 58560`, wysokość `-4.00 .. 58.83 m`, `89.75%` przechodniości): dolina rzeczna przecięta *Rzeką Przełomu* z krytym *Mostem Głównym*, *Dzielnicą Rzemieślniczą*, *Targiem*, *Przystanią i Nabrzeżem* oraz tarasowymi *Domami Ogrodowymi i Sadami*.
    3. **Aetheria — Sanktuarium Tysiąca Źródeł** (`70208 × 53440`, wysokość `9.86 .. 86.20 m`, `97.06%` przechodniości): 3-poziomowy amfiteatr alpejski (*Dolne Miasto Gościnne*, *Tarasy Nauki* z kamiennymi akweduktami, *Górne Sanktuarium* i *Źródlany Dziedziniec* z 3-kondygnacyjną pagodą w turkusowej lagunie).
    4. **Nexus-9 — Węzeł Świadomości** (`63168 × 49728`, wysokość `-4.50 .. 36.12 m`, `72.11%` przechodniości): *Górny Taras Administracyjny* z *Rdzeniem Energetycznym* i *Halą Transportową*, ukośne *Trakty Łączące* z pylonami cyjanowej energii oraz *Dolne Warsztaty i Doki* i *Place Przeładunkowe*.
  - Wygenerowano izometryczny **Atlas Planety Superior** (`2048×1024`) obejmujący 4 kontynenty, 6 wysp questowych (`island-1..6`) oraz 8 archipelagów oceanicznych.

- **Modelowanie 3D i sprite'y izometryczne (`Blender 4.0.2 + Python API` + `Pillow + OpenCV`):**
  - Wymodelowano i wyeksportowano **28 modeli 3D `.glb`** (8 obiektów naturalnych do rozrzutu 3D: `cliff_basalt`, `rock_cluster`, `tree_pine`, `tree_oak`, `tree_sakura`, `tree_charred`, `ruin_pillar`, `bridge_arch` oraz 20 budynków-symboli 4 stolic).
  - Wyrenderowano z kamery ortograficznej (`yaw = 45°`, `elevation = 30°`) 28 sprite'ów izometrycznych 2D i poddano je obróbce `OpenCV + Pillow` (filtr bilateralny zachowujący krawędzie, wyostrzanie, ciemny kontur sylwetki `1.5 px`, elipsa cienia kontaktowego) oraz wygenerowano rejestry `buildings.json` z dokładnymi współrzędnymi i wysokością na siatce `height.r32`.

- **Projekt Godot 4.6.3 (`ports/godot-isometric-world`) i weryfikacja QA:**
  - Zbudowano projekt `ports/godot-isometric-world` współdzielący dane wysokości, przechodniości i materiałów między rzutem izometrycznym 2D (`iso(x, z, h)`), sortowaniem `Y-sort` budynków/drzew/postaci, minimapą 2D, obrotową mapą 3D regionu (`scripts/map_3d.gd`) oraz pełnoekranowym Atlasem Planety (`scripts/atlas_overlay.gd`).
  - Przeprowadzono automatyczny test `--qa` na karcie **NVIDIA A40 (Vulkan 1.4.329)**:
    - `0` błędów silnika i skryptów GDScript
    - błąd odwracalności rzutu `projection_roundtrip_error_m = 0.0 m`
    - `all_landmarks_walkable = true` (wszystkie 20 dzielnic i punktów orientacyjnych w 4 stolicach przechodnie)
    - wejście po schodach między poziomami: `stair_climb_height_m = 22.91 m`
    - zgodność ruchu 30 FPS vs 120 FPS: `fps_30_120_position_delta_m = 0.0 m`
    - obsługa dotyku dwoma kciukami (lewy drążek + prawy pinch zoom `0.92 -> 1.47`)
  - Dowody QA i zrzuty ekranu zapisano w `docs/zmiany/2026-11-18/qa/isometric-world/`:
    - `results.json`
    - `pyra-citadel.jpg`, `pyra-expzone.jpg`
    - `verdant-harbor.jpg`, `verdant-expzone.jpg`
    - `aether-sanctuary.jpg`, `aether-expzone.jpg`
    - `nexus-core.jpg`, `nexus-expzone.jpg`
    - `globe-3d.jpg`
    - `planet-atlas.jpg`
    - `map-3d.jpg`

## 2. Faza A + Faza C — Pełne Kontynenty `1024 × 1024 m`, Generator Dróg Spline, 24 Expowiska, Żywa Woda/Jeziora/Oceany/Lawa, 99 Animowanych Bytów i Rzeczywisty Globus 3D (`ports/godot-isometric-world`)

Zgodnie z wytycznymi właściciela przebudowano wszystkie 4 kontynenty w `ports/godot-isometric-world` oraz generator `scripts/gpu/gen_world_topography.py`:

- **Pełne kontynenty `1024 × 1024 m` (Stolica + Dziki Kontynent) oraz ręcznie malowane tekstury podłoża:**
  - Rozszerzono każdy region (`pyra`, `verdant`, `aether`, `nexus`) z `256 × 256 m` do `1024 × 1024 m` (`grid_size = 512`, `safe_city_radius = 180.0 m`), łącząc ufortyfikowaną bezpieczną stolicę w centrum z otaczającym dzikim kontynentem, górami, kraterami, jeziorami i zatokami oceanicznymi.
  - Zastosowano zatwierdzone, ręcznie malowane tekstury biomów i wody (`b0.webp`, `b2.webp`, `road0.webp`, `b3.webp`, `special.webp`/`water.webp`) jako `mat_0..3.png` i `water.png` w `ports/godot-isometric-world/regions/*/`.
- **Generator Dróg `Catmull-Rom Spline` i 24 Polany Bojowe (`Expowiska Lv. 1–18`):**
  - W `scripts/gpu/gen_world_topography.py` wdrożono generator krzywych `Catmull-Rom Spline` (`samples_per_seg = 140`) budujący brukowane aleje miejskie, pierścienie stolicy, 4 główne trakty wychodzące z 4 bram miejskich, obwodnicę kontynentu oraz 6 odnóg prowadzących do **6 szerokich, płaskich i wolnych od przeszkód polan bojowych (`Expowisk`, `radius = 52..58 m`) na każdy kontynent (`24` expowiska łącznie)**.
  - Na przecięciach dróg z rzekami i kanałami lawy generator automatycznie podnosi płaski pomost i ustawia malowane mosty kamienne/drewniane/technologiczne.
- **Żywa woda, jeziora, zatoki oceaniczne, wodospady i płynna lawa (`shaders/terrain.gdshader`, `shaders/map_3d.gdshader`):**
  - Przebudowano shadery terenu 2D i mapy 3D tak, aby kanały `surface.png` (`R` = płynna lawa i kaldery magmy, `G` = turkusowo-szafirowe rzeki, jeziora i zatoki oceaniczne z białą pianą przybrzeżną, `B` = drogi spline z krawężnikami, `A` = cyjanowe kanały plazmowe i piana wodospadów) były renderowane z animacją fal i czystą emisją (nieprzyciemnianą przez cieniowanie wierzchołków).
  - W **Pyrze** dodano wewnętrzną fosę lawową wokół cytadeli (`r ~ 104 m`), baseny magmy na placu, krater wulkanu NE, morze magmy SW oraz strumienie lawy obramowujące wszystkie 6 expowisk.
  - W **Verdantii** dodano *Lagunę Źródła Pierwszego Oddechu*, *Kanał Przystani*, *Rzekę Przełomu*, *Wielkie Szmaragdowe Jezioro NW*, *Południową i Wschodnią Zatokę Oceaniczną* oraz zakola rzeczne przy wszystkich 6 expowiskach.
  - W **Aetherii** odsłonięto *Świętą Lagunę Pierścieniową* wokół *Pawilonu Tysiąca Źródeł*, bliźniacze jeziora alpejskie NW/NE, strumienie kaskadowe, południowy fiord oceaniczny oraz górskie potoki przy wszystkich 6 expowiskach.
  - W **Nexus-9** dodano geometryczny zbiornik chłodzący NE, *Port Zerowy* nad głębokim oceanem S/W oraz świecące cyjanowe kanały plazmowe wokół rdzenia i wszystkich 6 poligonów bojowych.
- **338 autentycznych, ręcznie malowanych obiektów `.webp` + 12 murów, bram i baszt z `Blender Cycles GPU + Geometry Nodes`:**
  - Wyeliminowano wszystkie prymitywne bloki zastępcze oraz sprite'y z nieprzezroczystym tłem lub komiksowym czarnym obrysem.
  - Zintegrowano ręcznie malowane budynki stolic (kuźnie, karczmy, targi, areny, skarbce, hale, sanktuaria, obserwatoria, reaktory, stawy koi, źródła, mosty), mury oporowe i bramy wygenerowane w `scripts/gpu/blender_geonodes_fortifications.py` oraz `263..288` różnorodnych drzew, krzewów, kwiatów, wodospadów, skał, ruin, jaskiń i obozowisk na każdy kontynent.
- **Żyjący świat — 99 animowanych bytów (`IsoWorldActor`) + efekty cząsteczkowe i świetlne (`PyraAmbient`):**
  - Zintegrowano **4 bohaterów grywalnych**, **40 mieszkańców stolic (NPC)** (`10` na stolicę z polskimi rolami, znacznikami `!`/`?` i ruchem patrolowym), **41 gatunków potworów** (`30` instancji na kontynent w 6 expowiskach z odznakami `Lv. 1..18` i paskami HP) oraz **10 gatunków dzikiej fauny (`A-01..A-10`)** (`16` zwierząt na kontynent).
  - Dodano warstwę `scripts/ambient_fx.gd` (`PyraAmbient`) generującą żywy ogień, dym, parę wodną nad źródłami i wodospadami, iskry żaru nad lawą, ciepłe aureole latarni oraz cyjanowe wyładowania plazmy.
- **Rzeczywisty Globus 3D Planety Superior (`scripts/globe_view.gd` + `scripts/atlas_overlay.gd`):**
  - Pod klawiszem `[G]` zintegrowano prawdziwą kulę 3D (`globe-color.webp`) z animowaną warstwą chmur (`globe-clouds.webp`), odblaskiem słońca na oceanach, niebieską atmosferą Fresnela, tłem kosmosu (`space.jpg`), obrysami poligonowymi kontynentów i wysp (`data/map.json`), napisami 3D Cinzel oraz obrotem `360°` i wyborem kontynentu promieniem 3D (`raycast`). Pod klawiszem `[Tab]` udostępniono malowany Atlas 2D (`assets/map/atlas.webp`), a pod `[M]` obrotową Mapę 3D całego kontynentu `1024 × 1024 m`.

