#!/usr/bin/env python3
"""Builds a contact review sheet of all 8 Ki Legends bosses.
Grouped by Continent (Verdant, Aether, Nexus, Pyra) with their names, levels, and stats.
"""

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
MASTERS_DIR = ROOT / "art" / "production" / "bosses" / "masters"
OUT_PATH = ROOT / "art" / "production" / "bosses" / "review_all_8_bosses.png"

BOSSES = [
    # Verdant
    {"id": "ygdrasha", "name": "Ygdrasha, Matka Puszczy", "sub": "Verdant • Lv 15 • HP 4520 • ATK 59 • DEF 37"},
    {"id": "thorgar", "name": "Thorgar, Alfa Kłów", "sub": "Verdant • Lv 20 • HP 7560 • ATK 88 • DEF 45"},
    # Aether
    {"id": "arcykaplan-pustki", "name": "Arcykapłan Pustki", "sub": "Aether • Lv 15 • HP 4520 • ATK 59 • DEF 29"},
    {"id": "aurelith", "name": "Aurelith, Astralny Władca", "sub": "Aether • Lv 20 • HP 8400 • ATK 88 • DEF 51"},
    # Nexus
    {"id": "arbiter-zero", "name": "Arbiter Zero", "sub": "Nexus • Lv 15 • HP 4520 • ATK 64 • DEF 42"},
    {"id": "hydra-rdzen", "name": "Hydra-Rdzeń", "sub": "Nexus • Lv 20 • HP 8400 • ATK 88 • DEF 48"},
    # Pyra
    {"id": "kharzul", "name": "Kharzul, Mistrz Areny", "sub": "Pyra • Lv 15 • HP 4520 • ATK 68 • DEF 34"},
    {"id": "pyrrhax", "name": "Pyrrhax, Smok Wulkanu", "sub": "Pyra • Lv 20 • HP 8400 • ATK 94 • DEF 51"},
]

# Layout: 4 columns x 2 rows (or 8 columns)
# 4 cols x 2 rows: 2200 x 1400
CW, CH = 520, 650
COLS, ROWS = 4, 2
CANVAS_W = COLS * CW + 60
CANVAS_H = ROWS * CH + 160

sheet = Image.new("RGBA", (CANVAS_W, CANVAS_H), (15, 18, 24, 255))
d = ImageDraw.Draw(sheet)

# Header
d.rectangle([0, 0, CANVAS_W, 90], fill=(22, 28, 38, 255))
d.text((40, 25), "KI LEGENDS — KOMPLETNY KATALOG 8 BOSSÓW ŚWIATA (4 KONTYNENTY)", fill=(240, 245, 255, 255))
d.text((40, 55), "Wszystkie unikalne byty fizyczne: Verdant, Aether, Nexus, Pyra • 100% zsynchronizowane z Lore i Modelem Obrażeń", fill=(140, 165, 195, 255))

for idx, b in enumerate(BOSSES):
    col = idx % COLS
    row = idx // COLS
    x0 = 30 + col * CW
    y0 = 120 + row * CH
    
    # Card background
    d.rectangle([x0 + 10, y0 + 10, x0 + CW - 10, y0 + CH - 10], fill=(22, 26, 36, 255), outline=(45, 55, 75, 255))
    
    # Load character
    p = MASTERS_DIR / f"{b['id']}.png"
    if p.exists():
        im = Image.open(p).convert("RGBA")
        # Scale to fit inside 480 x 480
        im.thumbnail((CW - 60, CH - 140), Image.Resampling.LANCZOS)
        cx = x0 + (CW - im.width) // 2
        cy = y0 + 30 + (CH - 150 - im.height) // 2
        
        # Load shadow if exists
        sp = MASTERS_DIR / f"{b['id']}_shadow.png"
        if sp.exists():
            sh = Image.open(sp).convert("RGBA")
            sh.thumbnail((CW - 100, 70), Image.Resampling.BILINEAR)
            sh_x = x0 + (CW - sh.width) // 2
            sh_y = y0 + CH - 140
            sheet.alpha_composite(sh, (sh_x, sh_y))
            
        sheet.alpha_composite(im, (cx, cy))
        
    # Info panel
    d.rectangle([x0 + 10, y0 + CH - 75, x0 + CW - 10, y0 + CH - 10], fill=(18, 22, 30, 255))
    d.text((x0 + 25, y0 + CH - 68), b["name"], fill=(255, 220, 120, 255))
    d.text((x0 + 25, y0 + CH - 42), b["sub"], fill=(150, 180, 210, 255))

sheet.save(OUT_PATH, "PNG")
print(f"Saved 8-boss review sheet: {OUT_PATH}")
