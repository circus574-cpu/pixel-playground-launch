import numpy as np
from PIL import Image
from pathlib import Path

raw_dir = Path('art/production/bosses/raw')
files = sorted(raw_dir.glob("*.png"))

contact = Image.new("RGBA", (len(files) * 200, 300), (20, 24, 32, 255))

for i, f in enumerate(files):
    img = Image.open(f).convert("RGBA")
    arr = np.array(img).astype(float)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    
    # Chroma key magenta
    # Check corner color
    c_r, c_g, c_b = arr[5, 5, :3]
    # Excess magenta
    excess = np.maximum(0.0, np.minimum(r - g, b - g))
    alpha = np.clip(1.0 - (excess - 30.0) / (70.0 - 30.0), 0.0, 1.0)
    
    # De-spill
    arr_clean = arr.copy()
    arr_clean[:, :, 0] = np.maximum(0.0, arr_clean[:, :, 0] - excess * (1.0 - alpha))
    arr_clean[:, :, 2] = np.maximum(0.0, arr_clean[:, :, 2] - excess * (1.0 - alpha))
    arr_clean[:, :, 3] = alpha * 255.0
    
    cutout = Image.fromarray(arr_clean.astype(np.uint8), mode="RGBA")
    # Resize to fit in 180x280
    cutout.thumbnail((180, 280), Image.Resampling.LANCZOS)
    
    # Paste onto contact
    cx = i * 200 + (200 - cutout.width) // 2
    cy = (300 - cutout.height) // 2
    contact.alpha_composite(cutout, (cx, cy))
    
    print(f"[{i}] {f.name}: cutout size {cutout.size}")

contact.save("art/production/bosses/review_raw_bosses_thumbs.png", "PNG")
print("Saved art/production/bosses/review_raw_bosses_thumbs.png")
