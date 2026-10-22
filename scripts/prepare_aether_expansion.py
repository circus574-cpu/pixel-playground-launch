"""Prepare the Aetheria expansion objects (pagoda, koi pond, spirit gate, lantern, sakura).

Usage: python3 scripts/prepare_aether_expansion.py <source-dir> <output-dir>
Then: npm run assets:import -- <output-dir>/manifest.json --install
Presentation only: collision footprints live in src/game/world/regions/aether.json.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# key -> (longest packaged side, image origin placing the painted base on the anchor)
OBJECTS = {
    "pagoda": (768, [0.5, 0.9]),
    "koi-pond": (768, [0.5, 0.62]),
    "spirit-gate": (640, [0.5, 0.95]),
    "stone-lantern": (384, [0.5, 0.94]),
    "cherry-tree": (640, [0.5, 0.93]),
}


def main(src: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    assets, bindings = [], {}
    for key, (side, origin) in OBJECTS.items():
        im = Image.open(src / f"{key}.png").convert("RGBA")
        alpha = np.asarray(im.getchannel("A")).copy()
        if alpha.min() == 255:
            raise ValueError(f"Missing transparency: {key}")
        alpha[alpha < 16] = 0
        im.putalpha(Image.fromarray(alpha))
        im = im.crop(im.getchannel("A").getbbox())
        im.thumbnail((side, side), Image.Resampling.LANCZOS)
        aid = f"aether-x-{key}"
        im.save(out / f"{aid}.png")
        assets.append(dict(id=aid, version="1.0.0", kind="image", url=f"{aid}.png"))
        bindings[f"object.{key}"] = dict(asset=aid, fit="contain", origin=origin)
    pack = dict(schemaVersion=1, id="aether-expansion", version="1.0.0", technical=False,
                previewOnly=False, assets=assets, actors=[], actorBindings={},
                renderBindings=bindings, effects={})
    (out / "manifest.json").write_text(json.dumps(pack, indent=2) + "\n")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
