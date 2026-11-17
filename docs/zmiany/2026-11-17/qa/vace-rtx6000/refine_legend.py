"""CPU-only alpha refinement of this black/red Legend trial, not a general matte.

Uses the approved source's largest white highlight as a conservative size limit.
Only removes large near-white areas retained as opaque backdrop by segmentation.
Does not rescale, redraw, synthesize poses or change any installed game asset.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import label

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "scripts/gpu"))
from vace_motion import output_root, sha, validate, write_json
from vace_pack import validate_pack


def components(image):
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3]
    # Segmentation/resize also leaves partially transparent gray backdrop.
    # Calibrate the same neutral-color predicate on every canonical source.
    white = (rgb.min(axis=2) >= 160) & (rgb.max(axis=2).astype(int) - rgb.min(axis=2) <= 20) & (rgba[:, :, 3] > 4)
    groups, count = label(white)
    sizes = np.bincount(groups.ravel())
    return rgba, white, groups, sizes, max(sizes[1:], default=0)


def refine(reference, candidate, out):
    reference, candidate = Path(reference), Path(candidate)
    plan, pack = validate(reference), validate_pack(candidate)
    if pack["kind"] != "vace-candidate" or pack["sourceActorSha256"] != plan["source"]["actorSha256"]:
        raise ValueError("Expected a generated candidate from this exact Legend")
    largest = 0
    for entry in plan["source"]["frames"]:
        with Image.open(reference / entry["file"]) as image:
            largest = max(largest, int(components(image)[4]))
    limit = max(12, largest * 2)
    out = output_root(out)
    if out == candidate.parent.resolve():
        raise ValueError("Keep the unmodified segmentation candidate")
    updated = copy.deepcopy(pack)
    removed = []
    with Image.open(candidate.parent / pack["atlas"]) as source:
        atlas = source.convert("RGBA")
    for frame in updated["frames"]:
        x, y, w, h = frame["rect"]
        image = atlas.crop((x, y, x + w, y + h))
        rgba, white, groups, sizes, _ = components(image)
        cut = white & (sizes[groups] > limit)
        previous = rgba.copy()
        rgba[:, :, 3][cut] = 0
        assert np.array_equal(rgba[:, :, :3], previous[:, :, :3]), "RGB must be unchanged"
        assert np.array_equal(rgba[~cut], previous[~cut]), "No other pixel may change"
        cleaned = Image.fromarray(rgba, "RGBA")
        assert cleaned.getbbox() == image.getbbox(), "Review changed silhouette bounds instead of hiding it"
        atlas.paste(cleaned, (x, y))
        frame["rgbaSha256"] = hashlib.sha256(cleaned.tobytes()).hexdigest()
        removed.append(int(cut.sum()))
    atlas.save(out / "atlas.webp", lossless=True, exact=True)
    updated["atlasSha256"] = sha(out / "atlas.webp")
    updated["refinedFromPackSha256"] = sha(candidate)
    updated["matteRefinement"] = {"scope": "black-red Legend trial only", "neutralMinChannel": 160, "maxChroma": 20,
                                   "largestCanonicalWhiteComponent": largest,
                                   "whiteComponentAreaLimit": limit, "removedPixelsPerFrame": removed,
                                   "rgbAndBoundsUnchanged": True}
    write_json(out / "animation-pack.json", updated)
    preview = Image.new("RGB", (800, 830), "#30343a")
    preview.paste(atlas, (0, 30), atlas.getchannel("A"))
    ImageDraw.Draw(preview).text((12, 8), "VACE CANDIDATE / CPU ALPHA REFINEMENT", fill="white")
    preview.save(out / "contact.jpg", quality=92)
    validate_pack(out / "animation-pack.json")
    return updated["matteRefinement"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(refine(args.reference, args.candidate, args.out)))
