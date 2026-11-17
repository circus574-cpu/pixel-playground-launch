#!/usr/bin/env python3
"""Package authored transparent sprite masters, retaining provenance and old art.

No synthesis/retouching: split the four-cell sheet, trim transparent gutters,
and create bounded runtime textures. Camera fit is an artistic approximation.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DELIVERY = ROOT / "deliveries/pyra-buildings-20261117"
PROJECT = ROOT / "ports/godot-isometric-pyra"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--smithy", type=Path, required=True)
    parser.add_argument("--inn", type=Path, required=True)
    parser.add_argument("--sheet", type=Path, required=True)
    args = parser.parse_args()
    masters = DELIVERY / "masters"
    masters.mkdir(parents=True, exist_ok=True)
    output = PROJECT / "assets/buildings-painted"
    output.mkdir(parents=True, exist_ok=True)
    for role in ("smithy", "inn", "sheet"):
        shutil.copyfile(getattr(args, role), masters / f"{role}.png")
    sheet = Image.open(args.sheet).convert("RGBA")
    width, height = sheet.size
    cells = {"hall": (0, 0), "shop": (1, 0), "depot": (0, 1), "arena": (1, 1)}
    buildings = json.loads((PROJECT / "data/buildings.json").read_text())
    result = {"version": 1, "status": "preview; owner visual acceptance pending", "buildings": {}}
    for building in buildings:
        role = building["id"]
        if role in cells:
            x, y = cells[role]
            cell = (x * width // 2, y * height // 2, (x + 1) * width // 2, (y + 1) * height // 2)
            image = sheet.crop(cell)
            master = masters / "sheet.png"
        else:
            cell = None
            master = masters / f"{role}.png"
            image = Image.open(master).convert("RGBA")
        bbox = image.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        if bbox is None:
            raise ValueError(f"Empty asset: {role}")
        image = image.crop(bbox)
        image.thumbnail((736, 736), Image.Resampling.LANCZOS)
        runtime = Image.new("RGBA", (image.width + 32, image.height + 32))
        runtime.paste(image, (16, 16))
        destination = output / f"{role}.png"
        runtime.save(destination, optimize=True)
        # Presentation-only anchor at the center of the projected ground contact.
        # 2:1 footprint is registration guidance, NOT a proof of painted camera fit.
        ground_width = (building["size"][0] + building["size"][1]) * 8
        scale = ground_width / image.width
        origin_y = (16 + image.height - image.width * .25) / runtime.height
        result["buildings"][role] = {
            "texture": f"res://assets/buildings-painted/{role}.png",
            "origin": [.5, round(origin_y, 8)],
            "scale": round(scale, 8),
            "registration": "approximate painted camera; footprint-centered visual registration",
            "source": str(master.relative_to(ROOT)),
            "source_sha256": digest(master),
            "sheet_cell": cell,
            "crop": bbox,
            "runtime_size": runtime.size,
            "sha256": digest(destination),
        }
    (PROJECT / "data/building-art.json").write_text(json.dumps(result, indent=2) + "\n")
    provenance = {
        "generator": "OpenAI image_gen", "model_version": "not exposed by tool",
        "date": "2026-11-17", "commercial_rights_status": "review required; generation record is not legal clearance",
        "references": "Pyra painted forge and inn from this owner's project conversation",
        "style": "red ceramic tiles, basalt, dark timber, gold details; warm left key and cool fill",
        "scope": "isolated buildings only; no world geometry or gameplay changes",
        "runtime_import": "split sheet, alpha trim, Lanczos resize; no repainting",
        "limitations": ["Painted perspective is approximate, not a calibrated 3D render", "Fires/windows/smoke are baked, not animated", "Original assets retained"],
        "masters": {p.name: {"sha256": digest(p), "bytes": p.stat().st_size} for p in masters.glob("*.png")},
    }
    (DELIVERY / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print("Packaged", len(result["buildings"]), "building sprites")


if __name__ == "__main__":
    main()
