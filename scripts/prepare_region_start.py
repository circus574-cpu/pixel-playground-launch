"""Prepare Nexus-9/Pyra independent anime scenery; never modify region geometry.
Usage: python3 scripts/prepare_region_start.py nexus|pyra source-dir output-dir
Then use the existing assets:import validator to install manifest.json.
"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from prepare_aether_sanctuary import seamless

CONFIG = {
    "nexus": {
        "lab": (896, .80), "reactor": (768, .82),
        "terminal": (384, .89), "crystal": (640, .87),
        "pylon": (384, .92), "tech-garden": (512, .92),
    },
    "pyra": {
        "fortress": (1024, .80), "war-shrine": (768, .80),
        "statue": (512, .87), "basalt": (640, .86),
        "volcano": (768, .92), "clan-banner": (384, .92),
    },
}


def main(world: str, src: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    assets, bindings = [], {}
    for key, (side, oy) in CONFIG[world].items():
        im = Image.open(src / f"{key}.png").convert("RGBA")
        alpha = np.asarray(im.getchannel("A"))
        if alpha.min() == 255:
            raise ValueError(f"Missing transparency: {key}")
        im.putalpha(Image.fromarray(np.where(alpha < 12, 0, alpha).astype(np.uint8)))
        im = im.crop(im.getchannel("A").getbbox())
        im.thumbnail((side, side), Image.Resampling.LANCZOS)
        aid = f"{world}-art-{key}"
        im.save(out / f"{aid}.png")
        assets.append(dict(id=aid, version="1.0.0", kind="image", url=f"{aid}.png"))
        bindings[f"object.{key}"] = dict(asset=aid, fit="contain", origin=[.5, oy])
    for key, units in [("ground", 320), ("path", 208), ("plaza", 288), ("wall", 256)]:
        im = Image.open(src / f"{world}-{key}.jpg").convert("RGB")
        im = seamless(im).resize((512, 512), Image.Resampling.LANCZOS)
        aid = f"{world}-art-{key}"
        im.save(out / f"{aid}.png")
        assets.append(dict(id=aid, version="1.0.0", kind="image", url=f"{aid}.png"))
        bindings[f"terrain.{world}-{key}"] = dict(asset=aid, fit="stretch", tileSize=[units, units])
    pack = dict(schemaVersion=1, id=f"{world}-start", version="1.0.0", technical=False,
                previewOnly=True, assets=assets, actors=[], actorBindings={},
                renderBindings=bindings, effects={})
    (out / "manifest.json").write_text(json.dumps(pack, indent=2) + "\n")


if __name__ == "__main__":
    main(sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]))
