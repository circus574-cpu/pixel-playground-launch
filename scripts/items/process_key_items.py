"""
Process and slice key RPG items for Ki Legends.
Converts raw generated item images (from white background) to transparent 128x128 RGBA WebP
and deploys them into public/game/items/<itemId>.webp.
"""
import os
import sys
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

RAW_DIR = Path("art/production/items/raw")
MASTERS_DIR = Path("art/production/items/masters")
PUBLIC_ITEMS_DIR = Path("public/game/items")
QA_DIR = Path("art/production/items/qa")

def remove_white_background(img: Image.Image, threshold: int = 240) -> Image.Image:
    """
    Flood-fill corner matte and isolate item with clean alpha channel.
    Keeps interior highlights 100% opaque.
    """
    img = img.convert("RGBA")
    w, h = img.size
    arr = np.array(img)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    
    # White background detection: all channels high and low saturation
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    sat = max_c - min_c
    is_white = (r > threshold) & (g > threshold) & (b > threshold) & (sat < 25)
    
    # Start boundary BFS mask
    bg_mask = np.zeros((h, w), dtype=bool)
    from collections import deque
    q = deque()
    
    for x in range(w):
        if is_white[0, x]:
            bg_mask[0, x] = True
            q.append((0, x))
        if is_white[h - 1, x]:
            bg_mask[h - 1, x] = True
            q.append((h - 1, x))
    for y in range(h):
        if is_white[y, 0]:
            bg_mask[y, 0] = True
            q.append((y, 0))
        if is_white[y, w - 1]:
            bg_mask[y, w - 1] = True
            q.append((y, w - 1))
            
    while q:
        cy, cx = q.popleft()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not bg_mask[ny, nx] and is_white[ny, nx]:
                bg_mask[ny, nx] = True
                q.append((ny, nx))
                
    # Invert to get foreground
    fg = ~bg_mask
    
    # Smooth edges with slight dilation of foreground
    fg_img = Image.fromarray((fg * 255).astype(np.uint8), mode="L")
    fg_smooth = fg_img.filter(ImageFilter.GaussianBlur(radius=0.7))
    alpha_arr = np.array(fg_smooth)
    
    arr[:, :, 3] = alpha_arr
    return Image.fromarray(arr, mode="RGBA")

def process_item_image(src_path: Path, item_id: str) -> bool:
    if not src_path.exists():
        print(f"Source not found: {src_path}")
        return False
        
    raw = Image.open(src_path)
    cut = remove_white_background(raw)
    
    # Crop to non-transparent bbox
    bbox = cut.getbbox()
    if not bbox:
        print(f"Warning: image is completely transparent: {src_path}")
        return False
        
    cropped = cut.crop(bbox)
    cw, ch = cropped.size
    
    # Fit inside 112x112 (leaving 8px margin in 128x128 canvas)
    target_canvas = 128
    safe_size = 110
    scale = min(safe_size / cw, safe_size / ch)
    new_w = max(1, int(round(cw * scale)))
    new_h = max(1, int(round(ch * scale)))
    
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Place on 128x128 RGBA canvas
    canvas = Image.new("RGBA", (target_canvas, target_canvas), (0, 0, 0, 0))
    paste_x = (target_canvas - new_w) // 2
    paste_y = (target_canvas - new_h) // 2
    canvas.paste(resized, (paste_x, paste_y), resized)
    
    # Save master 512x512
    MASTERS_DIR.mkdir(parents=True, exist_ok=True)
    master_canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    m_scale = min(440 / cw, 440 / ch)
    mw, mh = int(round(cw * m_scale)), int(round(ch * m_scale))
    m_resized = cropped.resize((mw, mh), Image.Resampling.LANCZOS)
    master_canvas.paste(m_resized, ((512 - mw) // 2, (512 - mh) // 2), m_resized)
    master_canvas.save(MASTERS_DIR / f"{item_id}.png")
    
    # Save production client WebP
    PUBLIC_ITEMS_DIR.mkdir(parents=True, exist_ok=True)
    dest_path = PUBLIC_ITEMS_DIR / f"{item_id}.webp"
    canvas.save(dest_path, "WEBP", lossless=True)
    print(f"Saved {item_id} -> {dest_path} (128x128 WebP)")
    return True

if __name__ == "__main__":
    count = 0
    for file in sorted(RAW_DIR.glob("*.*")):
        if file.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]:
            item_id = file.stem
            if process_item_image(file, item_id):
                count += 1
    print(f"Processed {count} items.")
