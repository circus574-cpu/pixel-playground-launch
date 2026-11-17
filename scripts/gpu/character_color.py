#!/usr/bin/env python3
"""Consistent, reversible color previews for the four installed Godot heroes.

One fixed transform for every atlas, no per-frame auto exposure or invented poses.
Installed files, alpha, geometry, frame rectangles and animation timing stay intact.
"""
import argparse
import hashlib
import json
from pathlib import Path

from vace_motion import output_root, safe_file, sha, write_json

PROFILE = {"saturation": 1.22, "skinSaturation": 1.08, "contrast": 0.12, "lift": 0.012}
HEROES = {"legend": "pyra.hero", "planetary": "verdant.hero", "sage": "aether.hero", "android": "nexus.hero"}


def grade(image):
    import numpy as np
    from PIL import Image
    original = np.array(image.convert("RGBA"))
    rgb = original[:, :, :3].astype(np.float32) / 255
    y = rgb @ np.array([.2126, .7152, .0722], dtype=np.float32)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    skin = (r > g * 1.12) & (r < g * 1.9) & (g > b * 1.04) & (g < b * 1.8) & (y > .2) & (y < .9)
    saturation = np.where(skin, PROFILE["skinSaturation"], PROFILE["saturation"])
    saturation = 1 + (saturation - 1) * np.clip((1 - y) / .15, 0, 1)
    target_y = np.clip(y + (PROFILE["contrast"] * (y - .5) + PROFILE["lift"]) * 4 * y * (1 - y), 0, 1)
    chroma = (rgb - y[:, :, None]) * saturation[:, :, None]
    high, low = chroma.max(axis=2), chroma.min(axis=2)
    # Compress chroma into the gamut, rather than clipping individual channels.
    amount = np.minimum(1, np.minimum((1 - target_y) / np.maximum(high, 1e-8), target_y / np.maximum(-low, 1e-8)))
    transformed = np.rint(np.clip(target_y[:, :, None] + chroma * amount[:, :, None], 0, 1) * 255).astype("uint8")
    original[:, :, :3] = np.where((original[:, :, 3] > 0)[:, :, None], transformed, original[:, :, :3])
    return Image.fromarray(original, "RGBA")


def validate(root, repo):
    from PIL import Image
    root, repo = Path(root), Path(repo)
    plan = json.loads((root / "color-pack.json").read_text())
    if plan.get("kind") != "character-color-preview" or plan["profile"] != PROFILE or plan["heroes"] != HEROES:
        raise ValueError("Unknown color profile/hero contract")
    if sha(repo / "ports/godot-pyra/data/actors.json") != plan["actorSourceSha256"]:
        raise ValueError("Installed actor definitions changed")
    for entry in plan["sheets"]:
        src = safe_file(repo / "ports/godot-pyra", entry["source"].removeprefix("res://"))
        dst = safe_file(root, entry["file"])
        if sha(src) != entry["sourceSha256"] or sha(dst) != entry["sha256"]:
            raise ValueError("Changed source/candidate atlas")
        with Image.open(src) as a, Image.open(dst) as b:
            if a.size != b.size or a.size != tuple(entry["size"]) or a.convert("RGBA").getchannel("A").tobytes() != b.convert("RGBA").getchannel("A").tobytes():
                raise ValueError("Color correction must preserve size and every alpha byte")
    return plan


def build(repo, root):
    from PIL import Image
    repo, root = Path(repo).resolve(), output_root(root)
    if (root / "color-pack.json").exists():
        raise ValueError("Keep previous candidates; use a new output directory")
    data_path = repo / "ports/godot-pyra/data/actors.json"
    data = json.loads(data_path.read_text())
    sources = set()
    clip_count = 0
    for key in HEROES.values():
        actor = data[key]
        clip_count += len(actor["clips"])
        for clip in actor["clips"].values():
            if "sheet" in clip:
                sources.add(clip["sheet"])
            for frames in clip["directions"].values():
                for frame in frames:
                    if isinstance(frame, dict):
                        sources.add(frame["sheet"])
    (root / "atlases").mkdir(exist_ok=True)
    entries = []
    for i, source in enumerate(sorted(sources)):
        if not source.startswith("res://assets/actors/"):
            raise ValueError("Expected an installed hero atlas")
        path = safe_file(repo / "ports/godot-pyra", source.removeprefix("res://"))
        file = "atlases/%03d.webp" % i
        with Image.open(path) as image:
            colored = grade(image)
            colored.save(root / file, lossless=True, exact=True, method=1)
            alpha = image.convert("RGBA").getchannel("A").tobytes()
            entries.append({"source": source, "sourceSha256": sha(path), "file": file, "sha256": sha(root / file),
                            "size": list(image.size), "alphaSha256": hashlib.sha256(alpha).hexdigest(),
                            "decodedBytes": image.width * image.height * 4, "bytes": (root / file).stat().st_size})
        print("COLOR_ATLAS", i + 1, len(sources), flush=True)
    plan = {"schema": 1, "kind": "character-color-preview", "profile": PROFILE, "heroes": HEROES,
            "actorSourceSha256": sha(data_path), "clipsCovered": clip_count, "sheets": entries,
            "installed": False, "qualityStatus": "COLOR_REVIEW_REQUIRED", "gpuGenerated": False}
    write_json(root / "color-pack.json", plan)
    return validate(root, repo)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()
    plan = validate(args.out, args.repo) if args.validate else build(args.repo, args.out)
    print(json.dumps({"kind": plan["kind"], "sheets": len(plan["sheets"]), "clips": plan["clipsCovered"], "alphaUnchanged": True}))
