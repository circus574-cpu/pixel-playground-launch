# Wdrożenie tekstur kontynentów i przyrody — 2026-10-22

Decyzja właściciela (22.10.2026): wszystkie rasy zaakceptowane; tekstury i przyroda mają trafić do gry publicznie. Źródło dostawy: gałąź `ccr-b63f9ce9-bu75ez` (`docs/CODEX-PAINTED-HEROES-AND-TERRAIN-2026-10-22.md`). Ta zmiana opiera się na PR #23 (czterech bohaterów).

## Zainstalowane paczki (`previewOnly: false`, importer `assets:import --install`)
- `aether-terrain-v2`, `nexus-terrain-v2`, `pyra-terrain-v2` — `terrain.<świat>-ground|path|plaza|wall`; stoją za `*-start`, więc je nadpisują. Verdantia bez zmian (zaakceptowany atlas lasu).
- `nature-textures-v1` — 16 tekstur `terrain.nature-*`.
- `nature-objects-v1` — 19 obiektów `object.nature.*`. Obrazy przeskalowane z 768 do maks. 512 px (lossless WebP), bo pełne 768 przekraczało budżet 128 MiB w Aetherii (137,8 MB).

## Wpięcie w grę
- Wewnętrzne blokady map (indeks ≥ 3) dostają płynną teksturę przyrody: Pyra `nature-lava-flow`, Nexus-9 `nature-energy-liquid`, Aetheria `nature-water-crystal` (`hazardBinding` w `catalog.ts`, `renderWorld.ts`). Prostokąty kolizji bez zmian.
- Dekory niekolizyjne (`solid: false`) w `regions/{aether,nexus,pyra}.json`, rozmieszczone w wolnych miejscach poza ścieżkami, placami, NPC, spawnem i wrogami. Pyra: dwa wulkany zamiast placeholderów, skały lawy, głazy. Aetheria: drzewa kryształowe, wodospad, krzewy, trzcina. Nexus-9: iglice lodu, głazy. Nie zmieniono spawnu, kolizji ani zapisów.
- Fallback SVG `public/game/assets/stage3/nature.*.svg` dla brakującego pakietu.
- Nie wpięto: Verdantii (zaakceptowany las), pozostałych tekstur przyrody (woda, śnieg, piasek itd.) oraz obiektów, dla których zabrakło wolnego miejsca (góry, klify, wzgórze, szkło lodowca).

## Weryfikacja
Pełny typecheck, Vitest 151/151, `assets:check`, lint (0 błędów), build; e2e `world-rendering` 2/2 (Canvas). Cztery e2e (`aether-art-preview`, trzy `region-start-art`) padają także na bazie PR #23 — nie z tej zmiany. Prawa do checkpointów i referencji NIEROZSTRZYGNIĘTE; FPS/pamięć na fizycznym Androidzie NIEZWERYFIKOWANE.
