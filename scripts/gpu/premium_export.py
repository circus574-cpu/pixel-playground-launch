#!/usr/bin/env python3
"""Build a native-size Godot preview pack from explicitly selected candidates.

No installed assets are changed. The binding paths are for isolated runtime
previews; each exported image must retain the existing dimensions and alpha.
"""
import argparse
import hashlib
import json
from pathlib import Path
import math
from premium_pilot import read_queue


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def export_candidate(source, candidate, target, quality=92):
    import numpy as np
    from PIL import Image
    original = Image.open(source).convert("RGBA")
    image = Image.open(candidate).convert("RGBA").resize(original.size, Image.Resampling.LANCZOS)
    image.putalpha(original.getchannel("A"))
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, lossless=False, quality=quality, alpha_quality=100, exact=True, method=6)
    decoded = Image.open(target).convert("RGBA")
    a, b = np.asarray(image), np.asarray(decoded)
    if decoded.size != original.size or not np.array_equal(a[:, :, 3], b[:, :, 3]):
        raise ValueError("Mobile encoding changed native dimensions or alpha")
    mask = a[:, :, 3] > 250
    error = float(np.mean((a[:, :, :3][mask].astype(float) - b[:, :, :3][mask]) ** 2)) if mask.any() else 0.0
    return {"width": decoded.width, "height": decoded.height, "alphaIdentical": True,
            "bytes": target.stat().st_size, "originalBytes": Path(source).stat().st_size,
            "opaquePsnrDb": None if error == 0 else 10 * math.log10(255 ** 2 / error), "sha256": sha(target)}


def build(selection_path, output):
    selection = json.loads(Path(selection_path).read_text())
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    bindings = []
    seen = set()
    for chosen in selection["assets"]:
        root = Path(chosen["root"])
        queue = read_queue(root)
        job = next(j for j in queue["jobs"] if j["id"] == chosen["id"])
        record = next(x for x in json.loads((root / "candidates/results.json").read_text())["items"] if x["id"] == job["id"])
        source, candidate = root / job["input"], root / "candidates" / (job["id"] + ".webp")
        if sha(source) != job["inputSha256"] or sha(candidate) != record["runtimeSha256"]:
            raise ValueError("Reference or generated image changed after review")
        asset_path = job["sourcePath"].removeprefix("ports/godot-pyra/")
        if not asset_path.startswith("assets/") or ".." in Path(asset_path).parts:
            raise ValueError("Preview binding must refer to an existing Godot asset")
        target_path = "res://" + asset_path
        if target_path in seen:
            raise ValueError("Duplicate preview binding")
        seen.add(target_path)
        file = "textures/" + job["id"] + ".webp"
        metrics = export_candidate(source, candidate, output / file)
        bindings.append({"path": target_path, "file": file, "jobId": job["id"],
                         "sourceSha256": job["inputSha256"], "candidateSha256": record["runtimeSha256"], **metrics})
    manifest = {"schema": 1, "status": "isolated-preview-only", "assets": bindings,
                "selectionSha256": sha(selection_path),
                "scope": "Native-size compressed art. No production, geometry, saves or character statistics changed."}
    (output / "bindings.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps({"assets": len(bindings), "bytes": sum(x["bytes"] for x in bindings),
                      "referenceBytes": sum(x["originalBytes"] for x in bindings)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selection", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    build(args.selection, args.out)
