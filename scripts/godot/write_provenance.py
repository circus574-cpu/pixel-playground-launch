#!/usr/bin/env python3
"""SHA-256 of every source the Godot port reads and of every data file it writes (evidence of origin): ten lands, four races."""
import hashlib, json, pathlib, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
PORT = ROOT / "ports/godot-pyra"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
LANDS = ["pyra", "verdant", "aether", "nexus"] + [f"island-{i}" for i in range(1, 7)]
SRC = "public/game/worlds/superior-v2"
sources = [f"{SRC}/index.json", f"{SRC}/art/assets.json", "src/game/worlds/v2Places.generated.json",
           "src/components/planet-map/atlasRegions.v2.json", "src/components/planet-map/planetLayout.v2.json", "src/components/planet-map/worldOverlay.v2.json",
           "src/assets/planet-map/atlas-v2-1920.webp", "src/assets/planet-map/v2-globe-color-1920.webp", "src/assets/planet-map/globe-clouds-2048.webp", "src/assets/planet-map/space.jpg",
           "docs/design/data/character-progression-1-20.json", "src/game/kit/base.ts", "src/game/kit/legend.ts", "src/game/kit/planetary.ts", "src/game/kit/sage.ts", "src/game/kit/android.ts",
           "docs/katalog-przedmiotow-v2/KI_LEGENDS_366_PRZEDMIOTOW_V2.json", "src/game/items/loot.ts", "src/game/items/recipes.ts", "src/game/items/recipes.extra.ts", "src/game/items/catalog.ts",
           "ports/godot-pyra/assets/branding/intro-source.png"]
for land in LANDS:
    sources += [f"{SRC}/{land}/{name}" for name in ("world.json", "terrain.json", "navigation.json", "collision.json", "paths.json", "map-hi.webp")]
    sources.append(f"{SRC}/art/{land}/feature.art.json")
sources += [str(p.relative_to(ROOT)) for p in sorted((ROOT / "public/game/assets/gpu").glob("*/*/pack.json"))]
outputs = ["data/hero.json", "data/map.json", "data/economy.json", "data/actors.json", "data/rooms.json"]
outputs += [f"data/races/{r}.json" for r in ("legend", "planetary", "sage", "android")]
for land in LANDS:
    outputs += [f"data/lands/{land}/{name}" for name in ("land.json", "objects.bin", "walk.bin")]
    outputs += [f"assets/lands/{land}/{name}" for name in ("ctrl-biome.png", "ctrl-land.png", "road-mask.png", "road-class.png", "map.webp")]
commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
json.dump({"note": "Presentation data for the native port; geometry, collision and navigation are the published Superior v2 files, not regenerated.",
           "sourceBaseCommit": commit, "sources": {s: sha(ROOT / s) for s in sources if (ROOT / s).is_file()},
           "outputs": {o: sha(PORT / o) for o in outputs if (PORT / o).is_file()}},
          open(PORT / "data/world-provenance.json", "w"), indent=1)
print("provenance written:", len(sources), "sources,", len(outputs), "outputs")
