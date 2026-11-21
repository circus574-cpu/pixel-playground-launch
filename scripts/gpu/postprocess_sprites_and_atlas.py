#!/usr/bin/env python3
"""
Post-processes Blender Cycles GPU + Geometry Nodes fortification renders (auto-cropping transparent margins
to tight grounded isometric .webp sprites) and assembles the high-resolution SDXL terrain material sets
for Pyra, Verdantia, Aetheria, and Nexus-9.
"""
import json
import os
import shutil
from pathlib import Path
from PIL import Image

OUT_ROOT = Path("/workspace/ki-world-iso-20261118")
FORT_RAW = OUT_ROOT / "fortifications_raw"
FORT_WEBP = OUT_ROOT / "fortifications_webp"
REGIONS_DIR = OUT_ROOT / "regions"
CITADEL_DIR = Path("/workspace/ki-superior-iso/pyra-citadel")
WAVE1_DIR = Path("/workspace/ki-superior-iso/terrain-wave1")
PROD_DIR = Path("/workspace/ki-iso-art2/terrain-production")

FORT_WEBP.mkdir(parents=True, exist_ok=True)


def crop_and_save_webp(src_png: Path, dst_webp: Path, pad: int = 8) -> tuple[int, int]:
    img = Image.open(src_png).convert("RGBA")
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        x0 = max(0, bbox[0] - pad)
        y0 = max(0, bbox[1] - pad)
        x1 = min(img.width, bbox[2] + pad)
        y1 = min(img.height, bbox[3] + pad)
        img = img.crop((x0, y0, x1, y1))
    img.save(dst_webp, "WEBP", quality=92, method=4)
    return img.size


def process_fortifications() -> dict:
    sources = {
        "pyra-citadel-gate.webp": CITADEL_DIR / "renders-final/gate/source.png",
        "pyra-citadel-wall-ne.webp": CITADEL_DIR / "renders-final/retaining-wall/source.png",
        "pyra-citadel-brazier.webp": CITADEL_DIR / "renders-final/brazier/source.png",
        "pyra-street-lantern.webp": CITADEL_DIR / "streets/street-lantern/source.png",
        "pyra-tower.webp": FORT_RAW / "pyra-tower.png",
        "pyra-citadel-wall-nw.webp": FORT_RAW / "pyra-wall-nw.png",
        "verdant-wall-ne.webp": FORT_RAW / "verdant-wall-ne.png",
        "verdant-wall-nw.webp": FORT_RAW / "verdant-wall-nw.png",
        "aether-wall-ne.webp": FORT_RAW / "aether-wall-ne.png",
        "aether-wall-nw.webp": FORT_RAW / "aether-wall-nw.png",
        "nexus-wall-ne.webp": FORT_RAW / "nexus-wall-ne.png",
        "nexus-wall-nw.webp": FORT_RAW / "nexus-wall-nw.png",
    }
    sizes = {}
    for out_name, src_path in sources.items():
        if src_path.exists():
            w, h = crop_and_save_webp(src_path, FORT_WEBP / out_name)
            sizes[out_name] = [w, h]
            print(f"Cropped {out_name}: {w}x{h}")
        else:
            print(f"WARNING: Missing fortification source {src_path}")
    return sizes


def copy_terrain_materials() -> None:
    # Map SDXL 512x512 seamless terrain textures to mat_0 (base), mat_1 (accent), mat_2 (road), mat_3 (cliff)
    mapping = {
        "pyra": {
            "mat_0.png": PROD_DIR / "ash-fine-1/albedo.png",
            "mat_1.png": PROD_DIR / "lava-crust-1/albedo.png",
            "mat_2.png": PROD_DIR / "road-basalt-pavers-1/albedo.png",
            "mat_3.png": PROD_DIR / "mountain-columnar-1/albedo.png",
            "water.png": PROD_DIR / "lava-crust-2/albedo.png",
        },
        "verdant": {
            "mat_0.png": WAVE1_DIR / "verdantia-meadow-1/albedo.png",
            "mat_1.png": WAVE1_DIR / "verdantia-ground-1/albedo.png",
            "mat_2.png": WAVE1_DIR / "verdantia-road-1/albedo.png",
            "mat_3.png": WAVE1_DIR / "verdantia-rock-1/albedo.png",
            "water.png": WAVE1_DIR / "verdantia-waterbank-1/albedo.png",
        },
        "aether": {
            "mat_0.png": WAVE1_DIR / "aetheria-terrace-1/albedo.png",
            "mat_1.png": WAVE1_DIR / "aetheria-ground-1/albedo.png",
            "mat_2.png": WAVE1_DIR / "aetheria-road-1/albedo.png",
            "mat_3.png": WAVE1_DIR / "aetheria-rock-1/albedo.png",
            "water.png": WAVE1_DIR / "aetheria-ice-1/albedo.png",
        },
        "nexus": {
            "mat_0.png": WAVE1_DIR / "nexus-ground-1/albedo.png",
            "mat_1.png": WAVE1_DIR / "nexus-yard-1/albedo.png",
            "mat_2.png": WAVE1_DIR / "nexus-road-1/albedo.png",
            "mat_3.png": WAVE1_DIR / "nexus-rock-1/albedo.png",
            "water.png": WAVE1_DIR / "nexus-waste-1/albedo.png",
        },
    }
    for land_id, files in mapping.items():
        rdir = REGIONS_DIR / land_id
        rdir.mkdir(parents=True, exist_ok=True)
        for dst_name, src_path in files.items():
            if src_path.exists():
                img = Image.open(src_path).convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
                img.save(rdir / dst_name, "PNG")


if __name__ == "__main__":
    sizes = process_fortifications()
    copy_terrain_materials()
    print("POSTPROCESS_DONE:", json.dumps(sizes))
