import os
import json
import time
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np
from collections import deque

BOARD_SETS = [
    ("1793193909901.jpg", "ZEST-01"),
    ("1793196850383.jpg", "ZEST-02"),
    ("1793196932507.jpg", "ZEST-03"),
    ("1793196969995.jpg", "ZEST-04"),
    ("1793197009148.jpg", "ZEST-05"),
    ("1793197056456.jpg", "ZEST-06"),
    ("1793197088889.jpg", "ZEST-07"),
    ("1793197204505.jpg", "ZEST-08"),
    ("1793197219539.jpg", "ZEST-09"),
    ("1793197254654.jpg", "ZEST-10"),
    ("1793197603356.jpg", "BUFF-01"),
    ("1793197702883.jpg", "BUFF-02"),
    ("1793197717213.jpg", "BUFF-03"),
    ("1793197778187.jpg", "BUFF-04"),
    ("1793197797330.jpg", "BUFF-05"),
]

def extract_clean_icon(cell_img, target_size=128):
    arr = np.array(cell_img.convert("RGBA"))
    h, w = arr.shape[:2]
    
    # Text removal: detect text lines at bottom of cell
    mask_y = np.any(arr[:, :, :3] < 240, axis=2)
    row_counts = np.sum(mask_y, axis=1)
    active = (row_counts >= 5).astype(int)
    diff = np.diff(active)
    starts = list(np.where(diff == 1)[0] + 1)
    if active[0]:
        starts.insert(0, 0)
    ends = list(np.where(diff == -1)[0] + 1)
    if active[-1]:
        ends.append(h)
    
    segments = [s for s in zip(starts, ends) if s[1] - s[0] >= 3]
    y_cut = h
    while len(segments) > 1:
        last = segments[-1]
        prev = segments[-2]
        gap = last[0] - prev[1]
        last_h = last[1] - last[0]
        if last_h < 75 and gap >= 12 and last[0] > (h * 0.55):
            y_cut = min(y_cut, last[0] - 2)
            segments.pop()
        else:
            break
            
    if y_cut < h:
        arr[y_cut:, :] = [255, 255, 255, 255]
        
    # Half-res mask generation for speed
    sh, sw = h // 2, w // 2
    small = cell_img.resize((sw, sh), Image.Resampling.BOX)
    small_arr = np.array(small.convert("RGB"))
    
    fg_raw = np.any(small_arr < 245, axis=2)
    fg_img = Image.fromarray(fg_raw.astype(np.uint8) * 255)
    fg_closed = np.array(fg_img.filter(ImageFilter.MaxFilter(size=5))) > 0
    
    visited = np.zeros((sh, sw), dtype=bool)
    bg_mask = np.zeros((sh, sw), dtype=bool)
    q = deque()
    
    for x in range(sw):
        for y in (0, sh - 1):
            if not fg_closed[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(sh):
        for x in (0, sw - 1):
            if not fg_closed[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
                
    while q:
        cy, cx = q.popleft()
        bg_mask[cy, cx] = True
        for ny, nx in ((cy-1, cx), (cy+1, cx), (cy, cx-1), (cy, cx+1)):
            if 0 <= ny < sh and 0 <= nx < sw:
                if not visited[ny, nx] and not fg_closed[ny, nx]:
                    visited[ny, nx] = True
                    q.append((ny, nx))
                    
    bg_mask_img = Image.fromarray(bg_mask.astype(np.uint8) * 255).resize((w, h), Image.Resampling.NEAREST)
    full_bg = np.array(bg_mask_img) > 0
    
    arr_bright = np.all(arr[:, :, :3] >= 245, axis=2)
    full_bg_dilated = np.array(bg_mask_img.filter(ImageFilter.MaxFilter(size=7))) > 0
    final_bg = full_bg | (full_bg_dilated & arr_bright)
    
    alpha = np.ones((h, w), dtype=np.uint8) * 255
    alpha[final_bg] = 0
    arr[:, :, 3] = alpha
    
    fg_y, fg_x = np.where(alpha > 0)
    if len(fg_y) == 0 or len(fg_x) == 0:
        return None
        
    y1, y2 = fg_y.min(), fg_y.max()
    x1, x2 = fg_x.min(), fg_x.max()
    
    pad = 6
    y1 = max(0, y1 - pad)
    y2 = min(h, y2 + pad)
    x1 = max(0, x1 - pad)
    x2 = min(w, x2 + pad)
    
    cropped = Image.fromarray(arr[y1:y2, x1:x2], mode="RGBA")
    
    scale = (target_size - 16) / max(cropped.size)
    nw = max(1, int(cropped.size[0] * scale))
    nh = max(1, int(cropped.size[1] * scale))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    
    canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    canvas.paste(resized, ((target_size - nw) // 2, (target_size - nh) // 2), resized)
    return canvas

def build_all_assets(out_dir="public/game/items"):
    os.makedirs(out_dir, exist_ok=True)
    t0 = time.time()
    
    sliced_count = 0
    # 1. Slice all 105 items from the 15 boards
    for board_file, set_id in BOARD_SETS:
        board_path = f"docs/katalog-przedmiotow-v2/plansze/{board_file}"
        im = Image.open(board_path)
        bw, bh = im.size
        
        # Row 1 (4 items: pos 1, 2, 3, 4)
        for c in range(4):
            x1 = 10 + c * 512
            x2 = (c + 1) * 512 - 10
            cell = im.crop((x1, 10, x2, 1015))
            icon = extract_clean_icon(cell)
            item_id = f"{set_id}-0{c+1}"
            if icon:
                icon.save(os.path.join(out_dir, f"{item_id}.webp"), "WEBP")
                sliced_count += 1
            else:
                print(f"ERROR slicing {item_id}")
                
        # Row 2 (3 items: pos 5, 6, 7)
        for c in range(3):
            if set_id == "ZEST-01":
                x1 = int(10 + c * bw / 3)
                x2 = int((c + 1) * bw / 3 - 10)
            else:
                x1 = 10 + c * 512
                x2 = (c + 1) * 512 - 10
            cell = im.crop((x1, 1035, x2, 2038))
            icon = extract_clean_icon(cell)
            item_id = f"{set_id}-0{c+5}"
            if icon:
                icon.save(os.path.join(out_dir, f"{item_id}.webp"), "WEBP")
                sliced_count += 1
            else:
                print(f"ERROR slicing {item_id}")
                
        print(f"Board {set_id} ({board_file}) sliced successfully.")
        
    print(f"\nPhase 1 Complete: {sliced_count}/105 board items sliced in {time.time()-t0:.1f}s.")
    
    # 2. Process all remaining catalog items
    with open("docs/katalog-przedmiotow-v2/KI_LEGENDS_366_PRZEDMIOTOW_V2.json", "r", encoding="utf-8") as f:
        catalog_data = json.load(f)
        
    items = catalog_data.get("items", [])
    print(f"Total catalog items to ensure: {len(items)}")
    
    # Base icon templates
    base_icons = {}
    base_dir = "public/game/icons-v2"
    for base_name in ["potion", "sword", "vest", "shield", "boots", "helmet", "gloves", "ring", "amulet", "tusk", "coin"]:
        p = os.path.join(base_dir, f"{base_name}.webp")
        if os.path.exists(p):
            base_icons[base_name] = Image.open(p).convert("RGBA").resize((128, 128), Image.Resampling.LANCZOS)
            
    # Color tint maps for rarities and item types
    rarity_tints = {
        "common": (1.0, 1.0, 1.0),
        "uncommon": (0.85, 1.15, 0.9),    # greenish
        "rare": (0.8, 0.95, 1.25),          # blueish
        "epic": (1.15, 0.8, 1.25),          # purple
        "legendary": (1.3, 1.1, 0.7),       # gold/amber
    }
    
    category_templates = {
        "weapon": "sword",
        "armor": "vest",
        "helmet": "helmet",
        "gloves": "gloves",
        "boots": "boots",
        "legs": "boots",
        "shield": "shield",
        "ring": "ring",
        "amulet": "amulet",
        "artifact": "amulet",
        "accessory": "amulet",
        "buff": "amulet",
        "consumable": "potion",
        "material": "tusk",
        "quest": "coin",
        "tool": "sword",
    }
    
    # Custom material specific tints
    material_tints = {
        "zielone-ziele": (0.6, 1.4, 0.6),
        "mchowa-galaretka": (0.7, 1.3, 0.8),
        "sok-lisciaka": (0.5, 1.4, 0.7),
        "zielone-ostrze": (0.8, 1.3, 0.8),
        "zywy-korzen": (0.9, 1.1, 0.7),
        "skora-wilcza": (0.9, 0.85, 0.8),
        "ciern-wilka": (0.8, 0.8, 0.85),
        "tusk": (1.1, 1.05, 0.95),
        "nasiona": (1.0, 1.2, 0.7),
        "skrzydlo-krysztalowe": (0.7, 1.1, 1.4),
        "zloty-pancerz": (1.4, 1.2, 0.6),
    }

    generated_count = 0
    for it in items:
        item_id = it.get("id")
        out_file = os.path.join(out_dir, f"{item_id}.webp")
        if os.path.exists(out_file):
            continue
            
        cat = it.get("category", "material")
        rarity = it.get("rarity", "common")
        template_key = category_templates.get(cat, "tusk")
        base = base_icons.get(template_key)
        
        if not base:
            base = base_icons.get("tusk")
            
        img = base.copy()
        
        # Apply tint
        tint = material_tints.get(item_id, rarity_tints.get(rarity, (1.0, 1.0, 1.0)))
        if tint != (1.0, 1.0, 1.0):
            arr = np.array(img).astype(float)
            arr[:, :, 0] = np.clip(arr[:, :, 0] * tint[0], 0, 255)
            arr[:, :, 1] = np.clip(arr[:, :, 1] * tint[1], 0, 255)
            arr[:, :, 2] = np.clip(arr[:, :, 2] * tint[2], 0, 255)
            img = Image.fromarray(arr.astype(np.uint8), mode="RGBA")
            
        img.save(out_file, "WEBP")
        generated_count += 1
        
    print(f"Phase 2 Complete: {generated_count} additional catalog items prepared.")
    
    # 3. Final verification
    total_files = len([f for f in os.listdir(out_dir) if f.endswith(".webp")])
    print(f"\nFinal Verification: {total_files} / {len(items)} physical items deployed in {out_dir}!")
    assert total_files >= len(items), f"Expected at least {len(items)} items, got {total_files}"

if __name__ == "__main__":
    build_all_assets()
