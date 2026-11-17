#!/usr/bin/env python3
"""CPU matting, fixed-scale foot alignment and bounded atlases for VACE trials."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import statistics
from vace_motion import output_root, safe_file, sha, validate, verify_result, write_json


def white_matte(image):
    """Only for the Legend trial's white backdrop; keeps enclosed white details."""
    import numpy as np
    from scipy.ndimage import binary_propagation
    from PIL import Image
    rgb = np.asarray(image.convert("RGB"))
    near_white = (rgb.min(axis=2) >= 235) & (rgb.max(axis=2).astype(int) - rgb.min(axis=2) <= 20)
    seed = np.zeros(near_white.shape, dtype=bool)
    seed[0] = near_white[0]
    seed[-1] = near_white[-1]
    seed[:, 0] = near_white[:, 0]
    seed[:, -1] = near_white[:, -1]
    background = binary_propagation(seed, mask=near_white)
    alpha = np.where(background, 0, 255).astype("uint8")
    return Image.fromarray(np.dstack([rgb, alpha]), "RGBA")


def rembg_matter(model_file):
    """The installed rembg preprocessing, with downloads replaced by local hash checks."""
    from unittest.mock import patch
    if model_file is None:
        raise ValueError("Provide a local isnet-anime.onnx; downloads are disabled")
    model_file = Path(model_file)
    if not model_file.is_file():
        raise ValueError("Matting model missing; prepare isnet-anime.onnx before GPU rental")
    if model_file.name != "isnet-anime.onnx":
        raise ValueError("Keep the registered matting filename isnet-anime.onnx")
    import rembg
    def local_retrieve(*args, **kwargs):
        known = kwargs.get("known_hash", args[1] if len(args) > 1 else None)
        if not known:
            raise ValueError("Matting model has no registered checksum")
        algorithm, expected = known.split(":", 1) if ":" in known else ("sha256", known)
        if algorithm not in ["md5", "sha256"]:
            raise ValueError("Unsupported matting checksum")
        with model_file.open("rb") as stream:
            actual = hashlib.file_digest(stream, algorithm).hexdigest()
        if actual != expected:
            raise ValueError("Matting model checksum mismatch")
        return str(model_file.resolve())
    # rembg 2.0.67 ignores pooch's return value and constructs this path itself.
    # Set the cache directory only while creating this session; never copy into
    # a user's default cache or leave process-wide environment changes behind.
    with patch("pooch.retrieve", side_effect=local_retrieve), patch.dict(os.environ, {"U2NET_HOME": str(model_file.parent.resolve())}):
        session = rembg.new_session("isnet-anime", providers=["CPUExecutionProvider"])
    return lambda image: rembg.remove(image.convert("RGB"), session=session)


def normalize(images, target_height, cell=200):
    """One scale for the entire clip, per-frame hip X and ground Y translation."""
    import numpy as np
    from PIL import Image
    boxes = []
    for image in images:
        alpha = image.getchannel("A").point(lambda x: x if x > 4 else 0)
        image.putalpha(alpha)
        box = image.getbbox()
        if box is None:
            raise ValueError("Empty matted character")
        boxes.append(box)
    heights = [b[3] - b[1] for b in boxes]
    widths = [b[2] - b[0] for b in boxes]
    scale = min(target_height / statistics.median(heights), (cell - 12) / max(heights), (cell - 12) / max(widths))
    output, diagnostics = [], []
    for image, box in zip(images, boxes):
        crop = image.crop(box)
        resized = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.LANCZOS)
        alpha = np.asarray(resized.getchannel("A"))
        band = alpha[int(alpha.shape[0] * .4):max(1, int(alpha.shape[0] * .68))].astype(float)
        mass = band.sum(axis=0)
        hip = float((mass * np.arange(len(mass))).sum() / mass.sum()) if mass.sum() else resized.width / 2
        at = (round(cell / 2 - hip), round(cell * .95) - resized.height)
        if at[0] < 2 or at[1] < 2 or at[0] + resized.width > cell - 2:
            raise ValueError("Character would clip; review pose/anchor instead of changing game scale")
        canvas = Image.new("RGBA", (cell, cell))
        canvas.alpha_composite(resized, at)
        output.append(canvas)
        diagnostics.append({"sourceBox": list(box), "offset": list(at), "groundY": at[1] + resized.height})
    return output, {"singleClipScale": scale, "frames": diagnostics}


def validate_pack(path):
    from PIL import Image
    path = Path(path)
    pack = json.loads(path.read_text())
    if pack.get("schema") != 1 or pack.get("kind") not in ["reference-fixture-only", "vace-candidate"]:
        raise ValueError("Unknown animation pack")
    if pack["cell"] != 200 or pack["origin"] != [0.5, 0.95] or pack["size"] != [133, 133]:
        raise ValueError("Presentation contract changed")
    if (pack["actor"], pack["clip"], pack["direction"]) != ("pyra.hero", "walk", "right"):
        raise ValueError("Unexpected trial target")
    if pack.get("orientation") != "displayed":
        raise ValueError("Packed frames must already face the displayed direction")
    fps = pack["fps"]
    if not isinstance(fps, (int, float)) or not math.isfinite(fps) or fps <= 0 or len(pack["frames"]) != 16:
        raise ValueError("Invalid clip timing")
    if not math.isclose(len(pack["frames"]) / fps, pack["sourceDuration"], rel_tol=0, abs_tol=1e-9):
        raise ValueError("Animation duration drift")
    if not pack["loop"]:
        raise ValueError("Walking must retain its loop")
    atlas_path = safe_file(path.parent, pack["atlas"])
    if sha(atlas_path) != pack["atlasSha256"]:
        raise ValueError("Atlas checksum mismatch")
    with Image.open(atlas_path) as atlas:
        if max(atlas.size) > 2048 or atlas.width * atlas.height * 4 * 4 / 3 > 4 * 1024 * 1024:
            raise ValueError("Trial atlas exceeds its mobile budget")
        atlas = atlas.convert("RGBA")
        for frame in pack["frames"]:
            x, y, w, h = frame["rect"]
            if w != 200 or h != 200 or min(x, y) < 0 or x + w > atlas.width or y + h > atlas.height:
                raise ValueError("Invalid atlas region")
            image = atlas.crop((x, y, x + w, y + h))
            if not image.getbbox() or hashlib.sha256(image.tobytes()).hexdigest() != frame["rgbaSha256"]:
                raise ValueError("Empty or changed packed frame")
    return pack


def build(root, result_path, out, allow_fixture=False, matte="white", matting_model=None):
    from PIL import Image, ImageDraw
    root, result_path = Path(root).resolve(), Path(result_path).resolve()
    plan = validate(root)
    result = verify_result(root, result_path, allow_fixture)
    is_fixture = result["kind"] == "reference-fixture-only"
    out = output_root(out)
    selected = []
    for index in plan["export"]["indices"]:
        with Image.open(safe_file(result_path.parent, result["frames"][index]["file"])) as image:
            selected.append(image.convert("RGBA"))
    alignment = {"mode": "unchanged-source-cells"}
    if not is_fixture:
        remove = rembg_matter(matting_model) if matte == "rembg" else white_matte
        selected = [remove(image) for image in selected]
        height = statistics.median(f["bodyHeight"] for f in plan["source"]["frames"])
        selected, alignment = normalize(selected, height)
    atlas = Image.new("RGBA", (800, 800))
    frames = []
    for i, image in enumerate(selected):
        x, y = (i % 4) * 200, (i // 4) * 200
        atlas.alpha_composite(image, (x, y))
        frames.append({"rect": [x, y, 200, 200], "rgbaSha256": hashlib.sha256(image.tobytes()).hexdigest()})
    atlas.save(out / "atlas.webp", lossless=True, exact=True)
    label = "REFERENCE FIXTURE / CPU ONLY" if is_fixture else "VACE CANDIDATE / REVIEW REQUIRED"
    preview = Image.new("RGB", (800, 830), "#30343a")
    preview.paste(atlas, (0, 30), atlas.getchannel("A"))
    ImageDraw.Draw(preview).text((12, 8), label, fill="white")
    preview.save(out / "contact.jpg", quality=92)
    pack = {"schema": 1, "kind": "reference-fixture-only" if is_fixture else "vace-candidate",
            "actor": plan["actor"], "clip": plan["clip"], "direction": plan["direction"],
            "sourceActorSha256": plan["source"]["actorSha256"],
            "cell": 200, "origin": [0.5, .95], "size": [133, 133], "fps": plan["export"]["fps"],
            "sourceDuration": plan["export"]["duration"], "loop": True,
            "orientation": "displayed",
            "atlas": "atlas.webp", "atlasSha256": sha(out / "atlas.webp"), "frames": frames,
            "alignment": alignment, "resultSha256": sha(result_path),
            "qualityStatus": "REFERENCE_TRANSPORT_ONLY" if is_fixture else "ARTISTIC_AND_RUNTIME_REVIEW_REQUIRED",
            "decodedBytesWithMips": math.ceil(800 * 800 * 4 * 4 / 3)}
    write_json(out / "animation-pack.json", pack)
    return validate_pack(out / "animation-pack.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--result", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--reference-fixture", action="store_true")
    parser.add_argument("--matte", choices=["white", "rembg"], default="white")
    parser.add_argument("--matting-model", type=Path)
    args = parser.parse_args()
    result = build(args.root, args.result, args.out, args.reference_fixture, args.matte, args.matting_model)
    print(json.dumps({"kind": result["kind"], "frames": len(result["frames"]), "fps": result["fps"],
                      "sourceDuration": result["sourceDuration"], "gpuInferenceVerified": False}))
