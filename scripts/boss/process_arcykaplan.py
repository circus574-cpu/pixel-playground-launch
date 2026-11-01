#!/usr/bin/env python3
"""Processes Arcykapłan Pustki from raw OpenAI Playground image.
Performs high-quality chroma-key extraction, magenta edge de-spill,
generates a detached ground shadow, and saves transparent master PNG.
"""

import math
import os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
RAW_PATH = ROOT / "art" / "production" / "bosses" / "raw" / "OpenAI Playground 2026-11-01 at 20.04.40 (5).png"
OUT_ART = ROOT / "art" / "production" / "bosses" / "masters"
OUT_PUB = ROOT / "public" / "game" / "bosses"
OUT_ART.mkdir(parents=True, exist_ok=True)
OUT_PUB.mkdir(parents=True, exist_ok=True)

def process_arcykaplan():
    print(f"Loading {RAW_PATH}...")
    im = Image.open(RAW_PATH).convert("RGBA")
    arr = np.array(im, dtype=float)
    
    r = arr[:, :, 0]
    g = arr[:, :, 1]
    b = arr[:, :, 2]
    
    # Chroma-key magenta detector
    # Magenta has high R, high B, low G
    # Excess magenta: min(r - g, b - g)
    rb_min = np.minimum(r - g, b - g)
    
    # Soft alpha mask
    # Transparent when rb_min > 40
    # Solid when rb_min < 15
    alpha = np.clip(1.0 - (rb_min - 15.0) / 35.0, 0.0, 1.0)
    
    # Corner check for pure background
    is_bg = (r > 100) & (b > 90) & (g < 90) & (rb_min > 25)
    alpha[is_bg] = 0.0
    
    # Magenta De-spill on foreground pixels
    # Neutralize excessive R and B relative to G
    spill = np.maximum(0.0, rb_min)
    arr[:, :, 0] = np.clip(r - spill * 0.75, 0, 255)
    arr[:, :, 2] = np.clip(b - spill * 0.45, 0, 255)
    
    # Set final alpha channel
    arr[:, :, 3] = (alpha * 255.0).astype(np.uint8)
    
    clean_im = Image.fromarray(arr.astype(np.uint8), mode="RGBA")
    
    # Find bounding box of foreground
    bbox = clean_im.split()[-1].getbbox()
    if bbox:
        cropped = clean_im.crop(bbox)
        # Pad slightly
        pad = 20
        w, h = cropped.size
        master = Image.new("RGBA", (w + pad*2, h + pad*2), (0, 0, 0, 0))
        master.paste(cropped, (pad, pad))
    else:
        master = clean_im

    # Resize to standard height around 700px
    target_h = 700
    ratio = target_h / float(master.height)
    target_w = int(master.width * ratio)
    master_scaled = master.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    # Save character master
    char_path = OUT_ART / "arcykaplan-pustki.png"
    master_scaled.save(char_path, "PNG")
    master_scaled.save(OUT_PUB / "arcykaplan-pustki_char.png", "PNG")
    print(f"Saved {char_path} (size {master_scaled.size})")

    # Generate synthetic ground shadow for floating archpriest
    sw, sh = int(target_w * 0.8), int(target_w * 0.22)
    shadow = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    d_sh = ImageDraw.Draw(shadow)
    d_sh.ellipse([0, 0, sw, sh], fill=(15, 20, 35, 180))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    shadow.save(OUT_ART / "arcykaplan-pustki_shadow.png", "PNG")
    print("Saved arcykaplan shadow.")

if __name__ == "__main__":
    process_arcykaplan()
