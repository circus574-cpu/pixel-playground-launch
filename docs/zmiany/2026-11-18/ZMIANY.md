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

## 3. Pakiet Graficzny i Kartograficzny Klasy Premium (CPU + `generate_image` + Godot 4.6.3)

Bez użycia instancji GPU wdrożono i zweryfikowano w Godot 4.6.3 cztery ulepszenia klasy premium:

- **Nowe ręcznie malowane budowle-symbole AAA (`assets/objects/*-premium-*.webp`):**
  - Wygenerowano i wycięto z pełną przezroczystością RGBA `.webp` 4 kluczowe budowle: `pyra-premium-citadel.webp` (obsydianowa Cytadela Pyry z wieżami i żarem), `pyra-premium-bridge.webp` (wulkaniczny most kamienny), `verdant-premium-treehall.webp` (Sanktuarium Drzewa Świata w Verdantii) oraz `aether-premium-pagoda.webp` (Niebiańska Pagoda Aetherii) i podpięto je w `scripts/gpu/gen_world_topography.py`.
- **Naturalne shadery wody, lawy i dróg + miękkie cienie kontaktowe (`shaders/terrain.gdshader`, `shaders/map_3d.gdshader`, `scripts/world.gd`):**
  - Zastąpiono ostre neonowe obrysy brzegów wielooktawowym domenowo-falowanym brzegiem FBM: ciemne, wilgotne skarpy nad wodą, dwuwarstwowa kaustyka podwodna, naturalny batymetryczny gradient głębi i poszarpana piana brzegowa; przy lawie dodano przypaloną bazaltową krawędź i pływające płyty stygnącej skorupy bazaltowej nad żarzącymi się żyłami magmy; na terenie dodano miękkie plamy światła słonecznego oraz radialne, eliptyczne cienie kontaktowe pod wszystkimi budynkami i drzewami (`make_shadow_tex()`, `add_contact_shadow()`).
- **Okrągła Minimapa Klasy Premium (`scripts/premium_minimap.gd`, `shaders/minimap_circle.gdshader`):**
  - Zastąpiono dawną uproszczoną makietę `256×256` kartograficznym radarem opartym o renderowany z góry, rzeczywisty obraz kontynentu `regions/<land>/minimap_hq.png` (`1024×1024` z teksturami terenu, cieniowaniem 3D, poziomicami, drogami, rzekami/lawą, obrysami dachów i koronami drzew).
  - Dodano antyaliasowaną maskę kołową ze szklanym połyskiem i winietą, podwójny pierścień z antycznego złota z podziałką kompasową i oznaczeniami **N / E / S / W**, przełącznik zbliżenia taktycznego `[Z]` (`2.1×` / `1.0×`), kierunkową strzałkę bohatera, wektorowe romby usług stolicy, odznaki expowisk, żywe punkty patrolujących NPC, potworów i dzikiej fauny oraz tabliczkę lokacji ze współrzędnymi `(X, Z)` i przyciskami szybkiego dostępu (`2.1×`, `3D`, `Globus`).
- **Rzeczywisty Atlas 2D i Globus 3D Planety Superior (`atlas/planet_real_world.png`, `assets/map/globe-real-world.webp`, `scripts/atlas_overlay.gd`, `scripts/globe_view.gd`):**
  - Funkcja `composite_real_planet_atlas()` w `scripts/gpu/gen_world_topography.py` wkomponowuje wszystkie 4 wygenerowane kontynenty (`minimap_hq.png`) dokładnie wewnątrz ich linii brzegowych z `data/map.json` na mapie `2048×1024`, dzięki czemu zarówno **Atlas 2D (`[Tab]`)**, jak i **Globus 3D (`[G]`)** pokazują prawdziwy układ dróg, rzek, lawy, miast i expowisk z gry.
  - Dodano mapowanie pozycji bohatera na żywo (`hero_atlas_pos()` + `globe.set_player_atlas()`) na obu widokach, kartograficzną siatkę współrzędnych, różę wiatrów, spójne obrysy linii brzegowych z `data/map.json` oraz kartę telemetrii aktywnego kontynentu.
  - Weryfikacja Godot 4.6.3 (`--qa`, 11 zrzutów ekranu): `0` błędów, `0` ostrzeżeń silnika, `ISO_WORLD_QA_OK`.

## 4. Kanoniczne Mapy 2D/3D zgodne ze wzorcem + Etap 3 (Atmosfera i Pogoda) + Etap 4 (HUD Action-RPG i Drzewko 29 Węzłów)

Po przeglądzie wzorca kartograficznego właściciela (`1794997646341.jpg`) całkowicie przebudowano wszystkie mapy 2D/3D oraz wdrożono Etap 3 i Etap 4:

- **Kanoniczna kartografia 2D i 3D zgodna ze wzorcem właściciela (`scripts/gpu/build_canonical_maps.py`):**
  - Usunięto wcześniejszy proceduralny schemat koncentrycznych pierścieni z map kontynentów; zastąpiono go malowanymi, wolnymi od etykiet mapami reliefowymi wszystkich 4 kontynentów (`Verdantia`, `Aetheria`, `Nexus-9`, `Pyra`) wiernie odwzorowującymi pasma górskie, Wielkie Jezioro, kanały chłodzące, fiordy i rzeki lawy.
  - Wygenerowano spójny zestaw dla każdego regionu: `regions/<land>/map_art.png` (`1024×1024`), `regions/<land>/minimap_hq.png` (`1024×1024`) oraz rzeźbioną siatkę wysokości 3D `regions/<land>/relief_3d.r32` (`256×256`), a także bezszwowy atlas całej planety `atlas/planet_real_world.png` + `assets/map/globe-real-world.webp` (`2048×1024`) z oczyszczonymi krawędziami oceanu, 6 wyspami questowymi i turkusowymi szelfami.
  - **Atlas 2D (`scripts/atlas_overlay.gd`, `[Tab]`):** przejrzysty widok kartograficzny z czcionką Cinzel, zoomem i przesuwaniem (`+ / - / ◎`), różą wiatrów (`MapStyle.compass()`), niekolizyjnym znacznikiem pozycji bohatera (`Ty`) i dolnym paskiem lore/telemetrii.
  - **Globus 3D (`scripts/globe_view.gd`, `[G]`):** żywe, nieprzygaszone barwy wulkanicznej Pyry i pozostałych kontynentów na obracanej kuli 3D z atmosferą, chmurami i pozycją bohatera na żywo.
  - **Mapa Reliefowa 3D (`scripts/map_3d.gd`, `shaders/map_3d.gdshader`, `[M]`):** rzeźbiona wyspa 3D z `relief_3d.r32` w bezkrawędziowym oceanie, z połyskiem wody, żarzącymi się żyłami lawy, złotą iglicą Stolicy i 6 pinezkami expowisk dociągniętymi na ląd.
- **Etap 3 — Atmosfera, Cykl Dnia i Pogoda Biomów (`shaders/cloud_shadows.gdshader`, `scripts/world_atmosphere.gd`):**
  - Wdrożono płynące cienie chmur FBM z subtelną winietą kinową oraz 4-etapowy cykl pory dnia przełączany klawiszem `[T]` (*Dzień*, *Złota Godzina*, *Zmierzch*, *Noc*).
  - Dodano 48 aktywnych cząsteczek pogodowych dopasowanych do biomu (iskry wulkaniczne na Pyrze, świetliki i pyłek w Verdantii, płatki sakury i śnieg alpejski w Aetherii, cyjanowe drobiny danych w Nexus-9).
- **Etap 4 — Interfejs Action-RPG, Pasek Umiejętności i Drzewko Rozwoju (`scripts/rpg_hud.gd`):**
  - Zastąpiono stary debugowy panel pełnym HUD-em RPG: ozdobna ramka bohatera w lewym górnym rogu (medalion poziomu, `HP`, `KI`, zasób rasowy *Żar / Nurt / Skupienie / Ładunek*, monety, status *Bezpieczna Stolica / Expowisko*), dolny pasek akcji z paskiem `XP` (i premią `+5%` prędkości na poziom) oraz 6 klikalnymi umiejętnościami rasowymi z czasem odnowienia.
  - Wdrożono interaktywne okno **Drzewka Rozwoju Ki (`[K]`)** z 4 szlakami i 29 węzłami (*Szlak Walki*, *Szlak Energii Ki*, *Szlak Ochrony*, *Szlak Podróży*) oraz **Kartę Postaci i Ekwipunku (`[I]`)**.
- **Weryfikacja QA (`Godot 4.6.3 --qa`, 13 zrzutów ekranu):**
  - Wygenerowano i zweryfikowano wizualnie wszystkie zrzuty w `docs/zmiany/2026-11-18/qa/isometric-world/` (w tym `planet-atlas.jpg`, `globe-3d.jpg`, `map-3d.jpg`, `map-3d-verdant.jpg`, `talent-tree.jpg` oraz widoki wszystkich 4 stolic i expowisk): `ISO_WORLD_QA_OK`, `0` błędów.

## 5. Przebudowa AAA: Spójna Architektura 4 Stolic, Ozdobny HUD Action-RPG + Konstelacja 29 Węzłów (`[K]`) + Karta Postaci (`[I]`) oraz Rozbudowane Trakty Dzikich Kontynentów

Zgodnie z bezpośrednią uwagą właściciela (bez uruchamiania i bez jakiejkolwiek ingerencji w instancję GPU, przy pełnym zachowaniu zaakceptowanych kanonicznych map `minimap_hq.png`, `planet_real_world.png` i `globe-real-world.webp`) wykonano 3-częściową przebudowę wizualną `ports/godot-isometric-world`:

- **Przebudowa 1 — Spójna architektura dark-fantasy klasy AAA dla wszystkich 4 stolic (`scripts/gpu/extract_aaa_pack.py`, `ports/godot-isometric-world/assets/objects/*-aaa-*.webp`):**
  - Całkowicie usunięto ze wszystkich 4 regionów stare, jasne i kreskówkowe sprite'y budynków `*-painted-*` oraz `*-leaf-*` (`0` pozostałych instancji w `regions/*/buildings.json`).
  - Wyekstrahowano i zintegrowano **30 nowych zasobów architektonicznych `.webp` klasy AAA** (20 nowo wygenerowanych budynków z arkuszy architektonicznych + 10 oczyszczonych, ciemnych, realistycznych budowli `ki-v2-buildings`, dopełniających 4 zaakceptowane budowle-symbole `*-premium-*.webp`), zachowując dokładne kolizje i rozkład dzielnic w **Pyrze** (`78` budynków), **Verdantii** (`73`), **Aetherii** (`67`) i **Nexus-9** (`69`).
- **Przebudowa 2 — Ozdobny HUD Action-RPG, Konstelacja 29 Węzłów (`[K]`) i Karta Postaci (`[I]`) (`scripts/rpg_hud.gd`, `shaders/rpg_bar.gdshader`, `shaders/circle_icon.gdshader`, `scripts/stick.gd`, `data/progression.json`):**
  - Zastąpiono płaskie prostokąty i surowy tekst kompletną, rzeźbioną oprawą Action-RPG: dedykowanym shaderem ciekłej energii i żaru (`shaders/rpg_bar.gdshader`), shaderem kołowego kadrowania (`shaders/circle_icon.gdshader`), prawdziwymi malowanymi portretami bohaterów (`assets/ui/portrait_{pyra,verdant,aether,nexus}.webp`), złotymi pierścieniami i zwieńczeniem fleur-de-lis (`assets/ui/hud_crest_top.png`, `hud_portrait_ring.png`, `hud_skill_slot.png`), 6 gniazdami umiejętności z kanonicznymi ikonami `icons-v3` (`200` zasobów w `assets/ui/icons/`), 6 okrągłymi medalionami funkcji z emblematami `ui-v2` oraz responsywną górną wstęgą krain (`_nav_ribbon_rect()`) wyśrodkowaną bez kolizji zarówno w `1280×720`, jak i `1600×960`.
  - Przebudowano **Drzewko Rozwoju Ki (`[K]`)** w pełnoekranową konstelację 4 szlaków × 29 węzłów ładowaną bezpośrednio z kanonicznego `data/progression.json` (z 4 rasowymi nazwami i opisami, diamentowymi pierścieniami stanów `locked`/`avail`/`unlocked`/`keystone`, świecącymi liniami połączeń i malowanym tłem `assets/ui/talent_backdrop.webp` z obsydianową plakietą nagłówka `_draw_modal_header_plaque()`).
  - Przebudowano **Kartę Postaci i Ekwipunku (`[I]`)** z 8 gniazdami ekwipunku (`gear-*.webp`), księgą statystyk, statusem premii prędkości ruchu (`+5%`/poziom do poz. 20) i plecakiem `2×5`.
  - Ukryto minimapę, bazowy HUD i drążek dotykowy w trakcie otwartych okien `[K]`/`[I]` (`_sync_modal_visibility()` + `world.layout_minimap()`) oraz ograniczono rysowanie wirtualnego drążka (`scripts/stick.gd`) wyłącznie do aktywnego dotyku (`world.move_pointer >= 0`), eliminując również 4 wycieki `CanvasItem` RID.
- **Przebudowa 3 — Rozbudowana sieć traktów dzikich kontynentów, rozdroża, punkty POI i gaje ekologiczne (`scripts/gpu/gen_world_topography.py`):**
  - Rozbudowano sieć dróg `Catmull-Rom Spline` o dwupoziomową hierarchię: **Poziom 1** (szerokie brukowane trakty z 4 bram stolicy przez 4 rozdroża przydrożne do wszystkich 6 Expowisk z bramami wejściowymi) oraz **Poziom 2** (kręte, malownicze ścieżki leśne i górskie łączące `16` punktów POI i pętlę obwodową kontynentu) z przydrożnymi latarniami, koksownikami, pylonami i `32` naturalnymi gajami ekologicznymi na kontynent (`310..337` obiektów scenerii na region).
  - Usunięto sztuczne kałuże w kształcie litery `C`, odsunięto alpejskie jeziora Verdantii i Aetherii na skraj polan bojowych (likwidując koliste fosy wokół expowisk) oraz dociągnięto wszystkie **24/24 Expowiska** na zweryfikowany suchy ląd względem kanonicznego `minimap_hq.png` (`EXP_ZONES_ON_OCEAN: 0 / 24`, w tym przesunięcie expowisk SW/NE Pyry).
- **Weryfikacja QA (`Godot 4.6.3 --qa`, 15 zrzutów ekranu):**
  - Zaktualizowano `scripts/world.gd` o automatyczne zrzuty `wilderness-road.jpg` i `character-sheet.jpg`.
  - Końcowy przebieg `Godot_v4.6.3-stable_linux.x86_64 -- --qa`: `ISO_WORLD_QA_OK`, kod wyjścia `0`, `0` błędów GDScript i shaderów, `0` ostrzeżeń o wyciekach RID/obiektów; wizualnie zweryfikowano wszystkie 15 zrzutów w `docs/zmiany/2026-11-18/qa/isometric-world/` oraz spójność zasobów (`0` brakujących sprite'ów i ikon).

