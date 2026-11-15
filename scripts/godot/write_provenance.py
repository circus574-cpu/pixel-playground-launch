#!/usr/bin/env python3
"""SHA-256 of every source the continent port reads and of every data file it writes (evidence of origin)."""
import hashlib, json, pathlib, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
PORT = ROOT / "ports/godot-pyra"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
sources = ["public/game/worlds/superior-v2/pyra/world.json", "public/game/worlds/superior-v2/pyra/terrain.json", "public/game/worlds/superior-v2/pyra/navigation.json",
           "public/game/worlds/superior-v2/pyra/collision.json", "public/game/worlds/superior-v2/pyra/paths.json", "public/game/worlds/superior-v2/pyra/map-hi.webp",
           "public/game/worlds/superior-v2/art/pyra/feature.art.json", "public/game/worlds/superior-v2/art/assets.json", "src/game/worlds/v2Places.generated.json",
           "src/components/planet-map/atlasRegions.v2.json", "src/components/planet-map/planetLayout.v2.json", "src/components/planet-map/worldOverlay.v2.json",
           "src/assets/planet-map/atlas-v2-1920.webp", "src/assets/planet-map/v2-globe-color-1920.webp", "src/assets/planet-map/globe-clouds-2048.webp", "src/assets/planet-map/space.jpg",
           "docs/design/data/character-progression-1-20.json", "src/game/kit/legend.ts", "src/game/kit/base.ts"]
sources += [str(p.relative_to(ROOT)) for p in sorted((ROOT / "public/game/assets/gpu/pyra-continent-v2").glob("*/pack.json"))]
sources += [str(p.relative_to(ROOT)) for p in sorted((ROOT / "public/game/assets/gpu/hero-legend-walk-v3").glob("*/pack.json"))]
outputs = ["data/continent.terrain.json", "data/continent/world.json", "data/continent/objects.bin", "data/continent/walk.bin", "data/hero.json", "data/legend.json", "data/map.json",
           "assets/continent/ctrl-biome.png", "assets/continent/ctrl-land.png", "assets/continent/road-mask.png", "assets/continent/road-class.png"]
commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
json.dump({"note": "Presentation data for the native port; geometry, collision and navigation are the published Superior v2 files, not regenerated.",
           "sourceBaseCommit": commit, "sources": {s: sha(ROOT / s) for s in sources if (ROOT / s).is_file()},
           "outputs": {o: sha(PORT / o) for o in outputs}},
          open(PORT / "data/continent/provenance.json", "w"), indent=1)
print("provenance written:", len(sources), "sources,", len(outputs), "outputs")
