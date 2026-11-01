import os
from pathlib import Path
from PIL import Image
import numpy as np

raw_dir = Path('art/production/bosses/raw')
files = sorted(raw_dir.glob("*.png"))

for f in files:
    img = Image.open(f).convert('RGB')
    arr = np.array(img).astype(float)
    h, w = arr.shape[:2]
    
    # Identify non-magenta foreground
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    # Background has high R and high B, low G
    is_bg = (r > 150) & (b > 80) & (g < 60)
    fg = ~is_bg
    
    fg_pixels = arr[fg]
    if len(fg_pixels) > 0:
        mean_rgb = fg_pixels.mean(axis=0).astype(int)
        # Check dominant hue in foreground
        # Red dominant? Green dominant? Blue/Cyan dominant? Gold dominant?
        f_r, f_g, f_b = mean_rgb
        dom = "Unknown"
        if f_r > f_g + 20 and f_r > f_b + 20:
            dom = "Red / Fiery (Magma/Pyra)"
        elif f_g > f_r + 10 and f_g > f_b + 10:
            dom = "Green / Flora (Verdant)"
        elif f_b > f_r + 10:
            dom = "Blue / Cyber / Ethereal (Nexus / Aether)"
        elif f_r > 130 and f_g > 110 and f_b < 100:
            dom = "Gold / Desert / Sand"
        else:
            dom = f"Mixed (R={f_r}, G={f_g}, B={f_b})"
            
        print(f"{f.name} ({w}x{h}):")
        print(f"  Foreground pixels: {np.sum(fg)} ({np.sum(fg)/fg.size*100:.1f}%)")
        print(f"  Mean FG color: R={f_r}, G={f_g}, B={f_b} -> Dominant: {dom}")
