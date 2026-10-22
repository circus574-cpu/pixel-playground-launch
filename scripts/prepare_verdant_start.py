"""Prepare the Verdantia start-village anime preview pack; never modify forest-map.json.

Usage: python3 scripts/prepare_verdant_start.py <source-dir> <output-dir>
Then: npm run assets:import -- <output-dir>/manifest.json --install

Objects replace only `object.forest.<kind>` pictures for the village (trees,
bushes and rocks keep the accepted art). The four materials are rebuilt into
the exact accepted autotile layout (1904x1904, tile 64, margin 2, spacing 4),
so map topology, collision rows, bridge opening and saves stay unchanged.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

OBJECTS = {"cottage": 512, "inn": 512, "forge": 512, "market": 384, "fountain": 384,
           "lamp": 256, "fence": 384, "bridge": 768}
TILE, PHASES, PADDING = 64, 4, 2
PITCH = TILE + PADDING * 2


def periodic(source: Image.Image) -> Image.Image:
    """Same periodic (seamless) correction as scripts/build_anime_forest.py."""
    a = np.asarray(source.convert("RGB").resize((256, 256), Image.Resampling.LANCZOS), dtype=float)
    h, w, _ = a.shape
    v = np.zeros_like(a)
    v[0] = a[-1] - a[0]
    v[-1] = a[0] - a[-1]
    v[:, 0] += a[:, -1] - a[:, 0]
    v[:, -1] += a[:, 0] - a[:, -1]
    y, x = np.meshgrid(np.arange(h), np.arange(w), indexing="ij")
    d = 2 * np.cos(2 * np.pi * x / w) + 2 * np.cos(2 * np.pi * y / h) - 4
    d[0, 0] = 1
    smooth = np.fft.fft2(v, axes=(0, 1)) / d[:, :, None]
    smooth[0, 0] = 0
    a = np.clip(a - np.fft.ifft2(smooth, axes=(0, 1)).real, 0, 255).astype("uint8")
    return Image.fromarray(a).convert("RGBA")


def terrain_atlas(src: Path) -> Image.Image:
    materials = {}
    for name in ["grass", "soil", "stone", "water"]:
        im = periodic(Image.open(src / f"verdant-{name}.jpg"))
        materials[name] = [im.crop((x * TILE, y * TILE, (x + 1) * TILE, (y + 1) * TILE))
                           for y in range(PHASES) for x in range(PHASES)]
    u, v = np.linspace(0, 1, TILE)[None, :], np.linspace(0, 1, TILE)[:, None]
    weights = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v]
    masks = []
    for mask in range(16):
        field = sum(weights[i] for i in range(4) if mask & (1 << i)) if mask else np.zeros((TILE, TILE))
        alpha = np.clip((field - .5) * 4 + .5, 0, 1)
        masks.append(Image.fromarray(np.rint(alpha * 255).astype("uint8")))
    frames = materials["grass"].copy()
    for name in ["soil", "stone", "water"]:
        for phase in range(16):
            for mask in range(16):
                im = materials[name][phase].copy()
                im.putalpha(masks[mask])
                frames.append(im)
    assert len(frames) == 784
    atlas = Image.new("RGBA", (28 * PITCH, 28 * PITCH))
    for i, im in enumerate(frames):
        x, y = i % 28 * PITCH + 2, i // 28 * PITCH + 2
        atlas.paste(im, (x, y))
        for dx, dy, box, size in [(-2, 0, (0, 0, 1, 64), (2, 64)), (64, 0, (63, 0, 64, 64), (2, 64)),
                                  (0, -2, (0, 0, 64, 1), (64, 2)), (0, 64, (0, 63, 64, 64), (64, 2))]:
            atlas.paste(im.crop(box).resize(size), (x + dx, y + dy))
        for dx, dy, sx, sy in [(-2, -2, 0, 0), (64, -2, 63, 0), (-2, 64, 0, 63), (64, 64, 63, 63)]:
            atlas.paste(im.getpixel((sx, sy)), (x + dx, y + dy, x + dx + 2, y + dy + 2))
    assert atlas.size == (1904, 1904)
    return atlas


def main(src: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    assets, bindings = [], {}
    for key, side in OBJECTS.items():
        im = Image.open(src / f"{key}.png").convert("RGBA")
        alpha = np.asarray(im.getchannel("A")).copy()
        if alpha.min() == 255:
            raise ValueError(f"Missing transparency: {key}")
        alpha[alpha < 24] = 0
        im.putalpha(Image.fromarray(alpha))
        im = im.crop(im.getchannel("A").getbbox())
        im.thumbnail((side, side), Image.Resampling.LANCZOS)
        aid = f"verdant-art-{key}"
        im.save(out / f"{aid}.png")
        assets.append(dict(id=aid, version="1.0.0", kind="image", url=f"{aid}.png"))
        bindings[f"object.forest.{key}"] = dict(asset=aid, fit="contain")
    terrain_atlas(src).save(out / "verdant-art-terrain.png", optimize=True)
    assets.append(dict(id="verdant-art-terrain", version="1.0.0", kind="image", url="verdant-art-terrain.png"))
    bindings["terrain.verdant"] = dict(asset="verdant-art-terrain")
    pack = dict(schemaVersion=1, id="verdant-start", version="1.0.0", technical=False,
                previewOnly=True, assets=assets, actors=[], actorBindings={},
                renderBindings=bindings, effects={})
    (out / "manifest.json").write_text(json.dumps(pack, indent=2) + "\n")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
