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
    - `pyra-citadel.jpg`
    - `verdant-harbor.jpg`
    - `aether-sanctuary.jpg`
    - `nexus-core.jpg`
    - `map-3d.jpg`
    - `planet-atlas.jpg`
