"""Generate an additive prototype height layer from the existing KI Legends atlas."""

import argparse
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

RELIEF = {"verdant": 0.67, "aether": 1.0, "pyra": 0.90, "nexus": 0.75}
SEED = 20261118
CHUNK = 64


def elevation(mask, rng, amplitude):
    width, height = mask.size
    coast = mask.filter(ImageFilter.GaussianBlur(5))
    layers = [
        Image.frombytes("L", (n, n), rng.randbytes(n * n)).resize(mask.size, Image.Resampling.BICUBIC)
        for n in (5, 12, 25)
    ]
    values = []
    for land, edge, major, ridge, rough in zip(mask.getdata(), coast.getdata(), *(i.getdata() for i in layers)):
        value = (major * .54 + (255 - abs(128 - ridge) * 2) * .31 + rough * .15)
        values.append(round(value * min(1, max(0, edge - 128) / 100) * amplitude) if land else 0)
    result = Image.new("L", (width, height))
    result.putdata(values)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="ports/godot-pyra/data")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    atlas = json.loads((args.source / "map.json").read_text())
    width, height = atlas["mapW"], atlas["mapH"]
    rng = random.Random(SEED)
    args.output.mkdir(parents=True, exist_ok=True)
    occupancy = Image.new("L", (width, height))
    preview = Image.new("RGB", (width, height), "#142a41")
    manifest = {"seed": SEED, "atlasSize": [width, height], "lands": {}, "archipelagos": []}
    for region in atlas["regions"]:
        key = region["id"]
        land = json.loads((args.source / "lands" / key / "land.json").read_text())
        outline = [tuple(p) for p in region["outline"]]
        mask = Image.new("L", (width, height))
        ImageDraw.Draw(mask).polygon(outline, fill=255)
        occupancy.paste(255, mask=mask)
        bounds = mask.getbbox()
        local = mask.crop(bounds)
        terrain = elevation(local, rng, RELIEF.get(key, .52))
        color = {"verdant": (136, 187, 110), "aether": (217, 237, 251),
                 "pyra": (229, 128, 72), "nexus": (201, 171, 123)}.get(key, (153, 179, 145))
        relief = Image.merge("RGB", tuple(terrain.point(lambda h, c=c: int(c * (.32 + .68 * h / 255))) for c in color))
        preview.paste(relief, bounds[:2], local)
        directory = args.output / key
        directory.mkdir(exist_ok=True)
        chunks = []
        for z in range(0, terrain.height, CHUNK):
            for x in range(0, terrain.width, CHUNK):
                box = (x, z, min(x + CHUNK, terrain.width), min(z + CHUNK, terrain.height))
                if local.crop(box).getbbox():
                    name = f"{x // CHUNK}_{z // CHUNK}.png"
                    terrain.crop(box).save(directory / name)
                    chunks.append(name)
        manifest["lands"][key] = {"size": [land["width"], land["height"]], "atlasBounds": bounds,
                                  "outline": region["outline"], "settlements": land["settlements"],
                                  "sampleChunkSize": CHUNK, "chunks": chunks}

    available = occupancy.filter(ImageFilter.MaxFilter(45))
    draw = ImageDraw.Draw(preview)
    for _ in range(3500):
        if len(manifest["archipelagos"]) == 8:
            break
        x, z = rng.randrange(46, width - 46), rng.randrange(46, height - 46)
        if any(math.hypot(x - group[0][0], z - group[0][1]) < 88 for group in manifest["archipelagos"]):
            continue
        candidate = [[x, z, rng.randint(5, 10)]]
        for i in range(rng.randint(4, 8)):
            angle = i * 2.39 + rng.uniform(-.2, .2)
            radius = 12 + i * 3
            candidate.append([round(x + math.cos(angle) * radius),
                              round(z + math.sin(angle) * radius), rng.randint(1, 4)])
        if any(available.crop((ix - r, iz - r, ix + r + 1, iz + r + 1)).getbbox() for ix, iz, r in candidate):
            continue
        manifest["archipelagos"].append(candidate)
        for ix, iz, r in candidate:
            draw.ellipse((ix-r, iz-r, ix+r, iz+r), fill="#98a88a", outline="#ced3a2")
    preview.save(args.output / "atlas-preview.png")
    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(manifest['lands'])} lądów, {len(manifest['archipelagos'])} archipelagów")


if __name__ == "__main__":
    main()
