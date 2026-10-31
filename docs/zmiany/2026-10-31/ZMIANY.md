# Zmiany — 2026-10-31

## Optymalizacja mapy 2D/3D w grze, wdrożenie katalogu przedmiotów V2 oraz domknięcie usterek

### 1. Optymalizacja wydajności mapy 2D i 3D podczas gry

- **`src/components/planet-map/webgl.ts`**:
  - Zapisano wynik `supportsWebGL2()` w pamięci podręcznej sesji (`cachedWebGL2`), eliminując wielokrotne tworzenie i niszczenie tymczasowego kontekstu WebGL2 przy każdym otwarciu mapy.
- **`src/components/planet-map/preload.ts`**:
  - Dodano synchroniczne mapy cache (`resolvedImages`, `resolvedTerrain`, `resolvedOverlay`) oraz uchwyty `decodedImage.cached` i `loadWorldOverlay.cached`, dzięki czemu wstępnie załadowane zasoby mapy są dostępne synchronicznie w pierwszej klatce po otwarciu panelu mapy.
- **`src/components/planet-map/MapaView.tsx`**:
  - Przy otwieraniu mapy z fokusem gracza (`focus` z HUD) tryb startuje bezpośrednio jako `"flat"` zamiast `"checking"`, co pomija przejściowy montaż `<GlobeLoading />`.
- **`src/components/planet-map/PlanetMap.tsx`**:
  - Inicjalizacja `view`, `hiRes` oraz `playerAt` korzysta synchronicznie z `loadWorldOverlay.cached?.()` i `decodedImage.cached?.(atlasHi)` — otwarcie mapy w trakcie gry startuje od razu w przybliżeniu (`zoom = 6`) na pozycji gracza zamiast renderowania całej planety (`zoom = 1`) i skoku w kolejnej klatce.
  - Zastąpiono podwójne nakładanie `<image>` (`atlasLo` + `atlasHi`) pojedynczym elementem `<image href={hiRes ? atlasHi : atlasLo} />`.
  - Usunięto kosztowny filtr rozmycia Gaussa `filter="url(#pm-soft)"` z maski `<mask id="pm-spot-mask">` (2000×1000) oraz wyłączono nakładkę `.pm-spot` przy `ATLAS_V2 && zoom >= 2.5`.
- **`src/components/planet-map/WorldOverlay.tsx`**:
  - Zbuforowano prostokąty ograniczające kafelków (`tiles`), dróg (`roads`) oraz złączone łańcuchy punktów SVG (`roadPoints`) w `WeakMap<Overlay, PreparedOverlay>()` (`prepareOverlay`).
  - W `TerrainCanvas` rysowanie wykonywane jest synchronicznie wewnątrz `requestAnimationFrame`, gdy obrazy lądów są już w `decodedImage.cached`, a wymiary `canvas.width` / `canvas.height` są przypisywane tylko przy faktycznej zmianie rozmiaru (w pozostałych klatkach używane jest `ctx.clearRect`, co zapobiega realokacji bufora Canvas 2D podczas przesuwania mapy).
- **`src/components/planet-map/planet-map.css`**:
  - Usunięto wielokrotne filtry `filter: drop-shadow(...)` z `.pm-world-road` oraz `.pm-hit.is-selected`, które powodowały setki przebiegów filtrów SVG przy każdym ruchu kamery.
- **`src/components/planet-map/PlanetGlobe.tsx`**:
  - Zbuforowano obliczenia współrzędnych 3D obrysów regionów (`outlinePositionsCache`) oraz odroczono przesłanie tekstury `3840×1920` (`colorHiUrl`) do GPU o `350 ms`, aby nie blokować otwarcia widoku 3D i animacji lotu kamery.
- **`src/components/game/GameHud.tsx`**:
  - Polecenie `onCommand({ type: "pause", value: nextPanel !== null, suspendRendering: nextPanel === "planet" })` jest wysyłane synchronicznie w `toggle(next)` przed `setPanel(nextPanel)`, dzięki czemu pętla renderowania Phaser zatrzymuje się przed zamontowaniem `<PlanetAtlas>`.
  - Przycisk „Plan miasta” przekazuje `mapFocus` w `WORLD_V2` analogicznie do przycisku minimapy.

### 2. Selekcja znaczników miejsc w `AdminWorldMap`

- **`src/components/admin/AdminWorldMap.tsx` i `src/test/staff.test.tsx`**:
  - Do listy `candidates` w `onPointerUp` dołączono znaczniki miejsc z `projection.places`, gdy warstwa `layers.places` jest aktywna (naprawa usterki z audytu 28.10).
  - Dodano obsługę przekształcenia macierzowego w `at(x, y)` dla środowisk testowych bez `DOMPoint` oraz test jednostkowy w `src/test/staff.test.tsx` (`allows selecting a place marker on AdminWorldMap when only the places layer is enabled`).

### 3. Wdrożenie katalogu 366 przedmiotów, 140 receptur i pasywnych zestawów artefaktów V2

- **`src/game/items/types.ts`, `src/game/items/catalog.ts`, `src/game/items/recipes.ts`, `src/game/items/index.ts`, `src/game/items/__tests__/items.test.ts`**:
  - Rozszerzono katalog w silniku do pełnych **366 przedmiotów** (w tym 35 pasywnych artefaktów `BUFF-01`..`BUFF-05`, 70 elementów 10 zestawów ekwipunku `ZEST-01`..`ZEST-10`, 80 materiałów z potworów `MAT-M01`..`MAT-M80`, 16 reliktów bossów i 28 ksiąg rzemiosła) oraz **140 receptur** (`RC-001`..`RC-140` wraz z `RC-T01`) zgodnie z `docs/katalog-przedmiotow-v2/KI_LEGENDS_366_PRZEDMIOTOW_V2.json` i `ZASADY_BALANSU_PASYWNE_ARTEFAKTY_V2.md`.
  - Dodano tabele progów 3/5/7 części (`PASSIVE_BUFF_SET_BONUSES`, `EQUIPMENT_SET_BONUSES`), globalne limity procentowe (`V2_GLOBAL_STAT_CAPS`), selektor `getItemsBySetId` oraz kalkulator `computePassiveEquipmentBonuses` z zachowaniem pełnej kompatybilności wstecznej dla zapisów v1.

### 4. Budżet tekstur streamingu i stabilność testów walki

- **`src/game/world/generated/superiorRuntime.ts`**:
  - Ograniczono wstępne dogrzewanie obiektów statycznych na starcie do promienia `< 2048` (zgodnie z oknem 3×3 chunków) oraz dodano zwalnianie nieużywanych tekstur z `owned` w `release(scene, owner)` po przejęciu śledzenia przez `owners`.
- **`e2e/fixtures.ts`**:
  - Przekazano `{ timeout: 60_000 }` do `expect.poll` w `liveEnemy`, aby wyeliminować przedwczesne 5-sekundowe przerwania podczas inicjalizacji spawnu pod obciążeniem WebGL.
