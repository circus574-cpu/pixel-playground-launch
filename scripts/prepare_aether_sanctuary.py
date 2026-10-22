"""Prepare the Aetheria start-point (Sanktuarium Tysiąca Źródeł) anime art package.

Input: generated source PNGs in a directory (objects with alpha, terrain RGB).
Output: a GPU-pipeline delivery directory (PNG + manifest.json) that is then
validated and installed by `npm run assets:import -- <dir>/manifest.json --install`.

Only presentation is produced. Collision footprints, map layout, navigation and
saves stay defined by src/game/world/regions/aether.json.

Usage: python3 scripts/prepare_aether_sanctuary.py <source-dir> <output-dir>
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

VERSION = "1.0.0"
# Object source key -> longest side of the packaged texture (px).
OBJECTS = {
    "sanctum": 1024,
    "archive": 768,
    "ki-source": 512,
    "ki-tree": 640,
    "cloud-peak": 768,
    "garden": 384,
}
# Terrain key -> (packaged px, world units per repeat).
TERRAIN = {
    "aether-ground": (512, 320),
    "aether-path": (512, 208),
    "aether-plaza": (512, 288),
    "aether-wall": (512, 256),
}


def seamless(img: Image.Image, blend: float = 0.28) -> Image.Image:
    """Make a texture wrap: cross-fade its edges with a half-offset copy."""
    a = np.asarray(img.convert("RGB"), dtype=np.float32)
    h, w = a.shape[:2]
    shifted = np.roll(a, (h // 2, w // 2), axis=(0, 1))

    def ramp(n: int) -> np.ndarray:
        d = np.minimum(np.arange(n), np.arange(n)[::-1]) / (n * blend)
        return np.clip(d, 0, 1)

    m = np.minimum.outer(ramp(h), ramp(w))
    m = m * m * (3 - 2 * m)  # smoothstep
    out = a * m[..., None] + shifted * (1 - m[..., None])
    return Image.fromarray(out.round().astype(np.uint8), "RGB")


def plaza_grid(img: Image.Image) -> Image.Image:
    """Crop the marble slab texture between two grid-line centres so it repeats."""
    a = np.asarray(img.convert("L"), dtype=np.float32)
    h, w = a.shape

    def lines(profile: np.ndarray) -> list[int]:
        # Grid joints are darker (teal/gold) than the white marble.
        p = profile - np.convolve(profile, np.ones(31) / 31, mode="same")
        idx = [i for i in range(8, len(p) - 8) if p[i] == p[i - 8 : i + 9].min() and p[i] < -6]
        merged: list[int] = []
        for i in idx:
            if not merged or i - merged[-1] > 40:
                merged.append(i)
        return merged

    cols, rows = lines(a.mean(axis=0)), lines(a.mean(axis=1))
    if len(cols) >= 2 and len(rows) >= 2:
        return img.crop((cols[0], rows[0], cols[-1], rows[-1]))
    return seamless(img)


def main(src: Path, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    assets, bindings = [], {}
    for key, side in OBJECTS.items():
        im = Image.open(src / f"{key}.png").convert("RGBA")
        alpha = np.asarray(im.getchannel("A"))
        # Drop faint generator haze so trimming hugs the painted silhouette.
        clean = np.where(alpha < 12, 0, alpha).astype(np.uint8)
        im.putalpha(Image.fromarray(clean, "L"))
        im = im.crop(im.getchannel("A").getbbox())
        im.thumbnail((side, side), Image.LANCZOS)
        asset_id = f"aether-art-{key}"
        im.save(out / f"{asset_id}.png", optimize=True)
        assets.append({"id": asset_id, "version": VERSION, "kind": "image", "url": f"{asset_id}.png"})
        bindings[f"object.{key}"] = {"asset": asset_id, "fit": "contain"}
    for key, (px, units) in TERRAIN.items():
        im = Image.open(src / f"{key}.png").convert("RGB")
        im = plaza_grid(im) if key == "aether-plaza" else seamless(im)
        im = im.resize((px, px), Image.LANCZOS)
        asset_id = f"aether-art-{key}"
        im.save(out / f"{asset_id}.png", optimize=True)
        assets.append({"id": asset_id, "version": VERSION, "kind": "image", "url": f"{asset_id}.png"})
        bindings[f"terrain.{key}"] = {"asset": asset_id, "fit": "stretch", "tileSize": [units, units]}
    manifest = {
        "schemaVersion": 1,
        "id": "aether-sanctuary",
        "version": VERSION,
        "technical": False,
        "previewOnly": True,
        "assets": assets,
        "actors": [],
        "actorBindings": {},
        "renderBindings": bindings,
        "effects": {},
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
