"""Prepare presentation derivatives of the supplied PDF illustrations, without generation.

Run from the repository with Python 3 and Pillow. Original embedded JPEGs remain
unchanged. Full WebP crops are checked pixel-for-pixel against the source crop.
"""

import hashlib
import json
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "public/game/assets/stage3/references"
OUTPUT = REPO / "public/game/assets/origins-v1"
OUTPUT.mkdir(parents=True, exist_ok=True)
manifest = {}

for race in ["planetary", "sage", "android", "legend"]:
    source = SOURCE / (race + ".jpg")
    image = Image.open(source).convert("RGB")
    assert image.size == (1152, 1536)
    # Remove only the lower caption, retaining every column and the whole figure.
    crop = image.crop((0, 0, 1152, 1392))
    full = OUTPUT / (race + "-full.webp")
    crop.save(full, lossless=True, method=6)
    assert Image.open(full).convert("RGB").tobytes() == crop.tobytes()
    for width in [480, 960]:
        preview = crop.resize(
            (width, round(width * 1392 / 1152)), Image.Resampling.LANCZOS
        )
        preview.save(OUTPUT / f"{race}-{width}.webp", quality=92, method=6)
    manifest[race] = {
        "card": f"/game/assets/origins-v1/{race}-480.webp",
        "preview": f"/game/assets/origins-v1/{race}-960.webp",
        "full": f"/game/assets/origins-v1/{race}-full.webp",
        "width": 1152,
        "height": 1392,
        "original": f"/game/assets/stage3/references/{race}.jpg",
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "crop": [0, 0, 1152, 1392],
    }

# Existing concept art is a loading backdrop only, never a gameplay map.
scene = REPO / "art/candidates/anime-v1/scene-reference.webp"
Image.open(scene).resize((1280, 853), Image.Resampling.LANCZOS).save(
    OUTPUT / "loading-world.webp", quality=88, method=6
)
(REPO / "src/game/world/origin-art.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print("Prepared original-art derivatives; all four full crops preserve source pixels.")
for asset in sorted(OUTPUT.glob("*.webp")):
    print(asset.name, asset.stat().st_size)
