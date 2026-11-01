#!/usr/bin/env python3
"""Procedural high-res icon synthesis for 42 Consumables, Tools, and Jewelry items.
Batch 1:
- Consumables: U-01 to U-16, P-KI-01, P-ELX-V, P-ELX-P, P-ELX-A, P-ELX-N, P-BUFF-DEF (22 items)
- Tools: T-01 to T-08 (8 items)
- Jewelry: J-01 to J-12 (12 items)
"""

import math
import os
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops

ROOT = Path(__file__).resolve().parents[2]
MASTERS_DIR = ROOT / "art" / "production" / "items" / "masters"
QA_DIR = ROOT / "art" / "production" / "items" / "qa"
PUBLIC_DIR = ROOT / "public" / "game" / "items"

MASTERS_DIR.mkdir(parents=True, exist_ok=True)
QA_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

S = 512  # Master canvas size
CX, CY = S // 2, S // 2

# Helper drawing routines
def create_canvas():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))

def add_radial_aura(img, color, radius=180, alpha=80):
    aura = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(aura)
    r, g, b = color[:3]
    for rad in range(radius, 0, -8):
        factor = 1.0 - (rad / radius)
        a = int(alpha * (factor ** 1.8))
        draw.ellipse([CX - rad, CY - rad, CX + rad, CY + rad], fill=(r, g, b, a))
    aura = aura.filter(ImageFilter.GaussianBlur(radius=15))
    return Image.alpha_composite(aura, img)

def apply_drop_shadow(img, offset=(6, 12), blur=14, shadow_alpha=120):
    alpha = img.split()[-1]
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    s_alpha = alpha.filter(ImageFilter.GaussianBlur(blur))
    s_alpha = s_alpha.point(lambda p: int(p * (shadow_alpha / 255.0)))
    shadow.paste((15, 20, 25, 255), mask=s_alpha)
    # shift
    shifted_shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shifted_shadow.paste(shadow, offset)
    return Image.alpha_composite(shifted_shadow, img)

def add_specular_glint(img, x, y, size=18, color=(255, 255, 255, 230)):
    glint = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glint)
    # Cross flare
    draw.ellipse([x - size, y - size, x + size, y + size], fill=color)
    draw.ellipse([x - size*2.5, y - size*0.4, x + size*2.5, y + size*0.4], fill=(color[0], color[1], color[2], color[3]//2))
    draw.ellipse([x - size*0.4, y - size*2.5, x + size*0.4, y + size*2.5], fill=(color[0], color[1], color[2], color[3]//2))
    glint = glint.filter(ImageFilter.GaussianBlur(2))
    return Image.alpha_composite(img, glint)

def draw_flask(liquid_col, glass_tint=(220, 240, 255), shape="round", stopper_col=(180, 140, 90), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # 1. Base bottle shape mask
    mask = Image.new("L", (S, S), 0)
    d_mask = ImageDraw.Draw(mask)
    
    neck_w, neck_top, neck_bot = 48, 140, 220
    d_mask.rectangle([CX - neck_w, neck_top, CX + neck_w, neck_bot], fill=255)
    d_mask.rectangle([CX - neck_w - 10, neck_top - 12, CX + neck_w + 10, neck_top + 6], fill=255) # rim
    
    if shape == "round":
        d_mask.ellipse([CX - 150, 180, CX + 150, 440], fill=255)
    elif shape == "triangle":
        d_mask.polygon([(CX - neck_w, neck_bot), (CX + neck_w, neck_bot), (CX + 170, 440), (CX - 170, 440)], fill=255)
    elif shape == "vial":
        d_mask.rounded_rectangle([CX - 80, neck_bot, CX + 80, 440], radius=45, fill=255)
    elif shape == "square":
        d_mask.rounded_rectangle([CX - 130, neck_bot - 10, CX + 130, 430], radius=30, fill=255)

    # 2. Liquid inside
    liq_mask = Image.new("L", (S, S), 0)
    d_liq = ImageDraw.Draw(liq_mask)
    if shape == "round":
        d_liq.ellipse([CX - 142, 190, CX + 142, 432], fill=255)
        d_liq.rectangle([0, 0, S, 250], fill=0) # liquid level
        d_liq.ellipse([CX - 120, 240, CX + 120, 265], fill=255) # meniscus
    elif shape == "triangle":
        d_liq.polygon([(CX - 40, neck_bot + 40), (CX + 40, neck_bot + 40), (CX + 160, 432), (CX - 160, 432)], fill=255)
        d_liq.rectangle([0, 0, S, 270], fill=0)
        d_liq.ellipse([CX - 100, 260, CX + 100, 280], fill=255)
    elif shape == "vial":
        d_liq.rounded_rectangle([CX - 72, neck_bot + 10, CX + 72, 432], radius=38, fill=255)
        d_liq.rectangle([0, 0, S, 240], fill=0)
        d_liq.ellipse([CX - 70, 230, CX + 70, 250], fill=255)
    elif shape == "square":
        d_liq.rounded_rectangle([CX - 120, neck_bot + 10, CX + 120, 420], radius=22, fill=255)
        d_liq.rectangle([0, 0, S, 250], fill=0)
        d_liq.ellipse([CX - 110, 240, CX + 110, 260], fill=255)
        
    liq_mask = ImageChops.multiply(liq_mask, mask)
    
    # Liquid layer with vertical gradient and core radiance
    liq_img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d_liq_img = ImageDraw.Draw(liq_img)
    lr, lg, lb = liquid_col[:3]
    for y in range(230, 450):
        t = (y - 230) / 220.0
        # Darker and richer towards bottom
        col = (int(lr * (1.2 - 0.5 * t)), int(lg * (1.2 - 0.5 * t)), int(lb * (1.2 - 0.5 * t)), 245)
        d_liq_img.line([(0, y), (S, y)], fill=col)
    # Inner glowing sphere
    d_liq_img.ellipse([CX - 70, 290, CX + 70, 390], fill=(min(255, lr + 60), min(255, lg + 60), min(255, lb + 60), 180))
    liq_img = liq_img.filter(ImageFilter.GaussianBlur(6))
    
    # Add bubbles
    b_draw = ImageDraw.Draw(liq_img)
    for bx, by, br in [(CX - 30, 340, 8), (CX + 45, 320, 11), (CX - 10, 280, 6), (CX + 20, 380, 10), (CX - 50, 390, 7)]:
        b_draw.ellipse([bx - br, by - br, bx + br, by + br], fill=(255, 255, 255, 140))
        b_draw.ellipse([bx - br//2, by - br//2, bx, by], fill=(255, 255, 255, 220))
        
    liq_final = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    liq_final.paste(liq_img, mask=liq_mask)
    
    # 3. Glass vessel shading and rim
    glass = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d_glass = ImageDraw.Draw(glass)
    gr, gg, gb = glass_tint[:3]
    # Outlines
    d_glass.bitmap((0, 0), mask, fill=(gr, gg, gb, 45))
    glass_edge = mask.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(2))
    glass.paste((gr, gg, gb, 160), mask=glass_edge)
    
    # Glass sheen / highlights (left and right curved highlights)
    sheen = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d_sheen = ImageDraw.Draw(sheen)
    if shape == "round":
        d_sheen.arc([CX - 135, 205, CX + 135, 415], 110, 240, fill=(255, 255, 255, 200), width=16)
        d_sheen.arc([CX - 120, 220, CX + 120, 400], 120, 220, fill=(255, 255, 255, 130), width=8)
        d_sheen.arc([CX - 135, 205, CX + 135, 415], -60, 40, fill=(255, 255, 255, 90), width=10)
    elif shape == "triangle":
        d_sheen.line([(CX - 40, neck_bot + 10), (CX - 150, 425)], fill=(255, 255, 255, 190), width=14)
        d_sheen.line([(CX + 40, neck_bot + 10), (CX + 150, 425)], fill=(255, 255, 255, 90), width=8)
    elif shape in ("vial", "square"):
        d_sheen.line([(CX - 65, neck_bot + 10), (CX - 65, 410)], fill=(255, 255, 255, 190), width=14)
        d_sheen.line([(CX + 65, neck_bot + 10), (CX + 65, 410)], fill=(255, 255, 255, 80), width=8)
    sheen = sheen.filter(ImageFilter.GaussianBlur(3))
    
    # 4. Stopper / cork
    stopper = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d_stop = ImageDraw.Draw(stopper)
    sr, sg, sb = stopper_col[:3]
    d_stop.polygon([
        (CX - neck_w + 6, neck_top + 10),
        (CX + neck_w - 6, neck_top + 10),
        (CX + neck_w + 4, neck_top - 45),
        (CX - neck_w - 4, neck_top - 45)
    ], fill=(sr, sg, sb, 255))
    d_stop.ellipse([CX - neck_w - 6, neck_top - 58, CX + neck_w + 6, neck_top - 32], fill=(min(255, sr + 30), min(255, sg + 30), min(255, sb + 30), 255))
    # Stopper texture lines
    for ly in [neck_top - 35, neck_top - 20, neck_top - 5]:
        d_stop.line([(CX - neck_w + 4, ly), (CX + neck_w - 4, ly)], fill=(max(0, sr - 50), max(0, sg - 50), max(0, sb - 50), 160), width=3)
        
    # Gold neck ring
    d_stop.rounded_rectangle([CX - neck_w - 8, neck_top + 2, CX + neck_w + 8, neck_top + 16], radius=6, fill=(230, 190, 80, 255))
    d_stop.rounded_rectangle([CX - neck_w - 8, neck_top + 2, CX + neck_w + 8, neck_top + 16], radius=6, outline=(140, 100, 30, 255), width=2)
    
    # Composite all parts
    img = Image.alpha_composite(img, liq_final)
    img = Image.alpha_composite(img, glass)
    img = Image.alpha_composite(img, sheen)
    img = Image.alpha_composite(img, stopper)
    
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=190, alpha=95)
    return apply_drop_shadow(img)


# --- FOOD RENDERING ---

def draw_bread():
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Golden crust loaf
    draw.ellipse([CX - 150, CY - 75, CX + 150, CY + 85], fill=(70, 35, 10, 255))
    draw.ellipse([CX - 142, CY - 70, CX + 142, CY + 75], fill=(185, 115, 45, 255))
    draw.ellipse([CX - 130, CY - 85, CX + 130, CY + 55], fill=(215, 145, 65, 255))
    draw.ellipse([CX - 110, CY - 75, CX + 110, CY + 35], fill=(235, 175, 95, 255))
    
    # Diagonal cuts / scoring
    for x_off in [-70, -20, 30, 80]:
        draw.line([(CX + x_off - 15, CY - 60), (CX + x_off + 20, CY + 20)], fill=(245, 220, 160, 255), width=10)
        draw.line([(CX + x_off - 12, CY - 55), (CX + x_off + 17, CY + 15)], fill=(130, 70, 20, 255), width=4)
        
    # Sesame seeds / flour dust
    np.random.seed(42)
    for _ in range(40):
        sx = CX + np.random.randint(-100, 100)
        sy = CY + np.random.randint(-55, 30)
        draw.ellipse([sx - 2, sy - 1, sx + 2, sy + 1], fill=(255, 245, 220, 220))
        
    img = add_specular_glint(img, CX - 40, CY - 35, size=12)
    return apply_drop_shadow(img)

def draw_bowl_soup(soup_col, steam_col=(220, 240, 255, 140), spoon=True, veg_dots=True):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Steam
    steam = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d_steam = ImageDraw.Draw(steam)
    for sx in [CX - 40, CX, CX + 45]:
        d_steam.arc([sx - 25, 100, sx + 25, 240], 210, 330, fill=steam_col, width=12)
        d_steam.arc([sx - 25, 160, sx + 25, 300], 30, 150, fill=steam_col, width=8)
    steam = steam.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, steam)
    
    # Clay bowl exterior
    draw = ImageDraw.Draw(img)
    draw.ellipse([CX - 160, 220, CX + 160, 420], fill=(135, 75, 45, 255))
    draw.ellipse([CX - 154, 224, CX + 154, 414], fill=(170, 95, 60, 255))
    draw.ellipse([CX - 146, 215, CX + 146, 320], fill=(90, 45, 25, 255))
    
    # Soup surface
    sr, sg, sb = soup_col[:3]
    draw.ellipse([CX - 138, 225, CX + 138, 310], fill=(sr, sg, sb, 255))
    draw.ellipse([CX - 110, 240, CX + 110, 295], fill=(min(255, sr + 40), min(255, sg + 40), min(255, sb + 40), 220))
    
    if veg_dots:
        for vx, vy, vc in [(CX - 60, 260, (70, 180, 70)), (CX + 40, 250, (60, 190, 60)), (CX - 10, 275, (220, 80, 50)), (CX + 80, 270, (230, 200, 60)), (CX - 40, 280, (80, 200, 80))]:
            draw.ellipse([vx - 7, vy - 5, vx + 7, vy + 5], fill=vc)
            
    if spoon:
        spoon_img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d_spoon = ImageDraw.Draw(spoon_img)
        d_spoon.line([(CX + 40, 260), (CX + 140, 160)], fill=(240, 240, 235, 255), width=18)
        d_spoon.ellipse([CX + 15, 245, CX + 65, 285], fill=(240, 240, 235, 255))
        d_spoon.ellipse([CX + 22, 250, CX + 58, 280], fill=(sr, sg, sb, 230))
        spoon_img = spoon_img.filter(ImageFilter.GaussianBlur(1))
        img = Image.alpha_composite(img, spoon_img)
        
    draw = ImageDraw.Draw(img)
    draw.arc([CX - 145, 260, CX + 145, 410], 40, 140, fill=(255, 255, 255, 120), width=8)
    return apply_drop_shadow(img)

def draw_tea_cup():
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Steam
    steam = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d_steam = ImageDraw.Draw(steam)
    d_steam.arc([CX - 25, 90, CX + 25, 220], 210, 330, fill=(220, 255, 230, 130), width=10)
    d_steam.arc([CX - 15, 140, CX + 35, 270], 30, 150, fill=(220, 255, 230, 100), width=6)
    steam = steam.filter(ImageFilter.GaussianBlur(6))
    img = Image.alpha_composite(img, steam)
    draw = ImageDraw.Draw(img)
    
    # Porcelain saucer
    draw.ellipse([CX - 165, 340, CX + 165, 420], fill=(210, 225, 230, 255))
    draw.ellipse([CX - 155, 345, CX + 155, 412], fill=(245, 250, 252, 255))
    draw.ellipse([CX - 100, 360, CX + 100, 395], fill=(190, 210, 215, 255))
    
    # Cup handle
    draw.arc([CX + 95, 240, CX + 175, 330], -70, 70, fill=(245, 250, 252, 255), width=20)
    draw.arc([CX + 95, 240, CX + 175, 330], -70, 70, fill=(180, 200, 210, 255), width=4)
    
    # Cup body
    draw.ellipse([CX - 120, 200, CX + 120, 380], fill=(240, 245, 248, 255))
    draw.ellipse([CX - 110, 195, CX + 110, 275], fill=(200, 220, 225, 255))
    
    # Green tea surface
    draw.ellipse([CX - 100, 205, CX + 100, 265], fill=(75, 160, 85, 255))
    draw.ellipse([CX - 80, 215, CX + 80, 255], fill=(115, 200, 110, 230))
    # Floating tea leaf
    draw.ellipse([CX - 25, 230, CX + 15, 245], fill=(35, 105, 40, 255))
    
    draw.arc([CX - 110, 220, CX + 110, 370], 90, 190, fill=(255, 255, 255, 200), width=10)
    return apply_drop_shadow(img)

def draw_service_ration():
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Olive-drab metallic ration tin
    draw.rounded_rectangle([CX - 140, CY - 100, CX + 140, CY + 110], radius=24, fill=(55, 70, 50, 255))
    draw.rounded_rectangle([CX - 132, CY - 92, CX + 132, CY + 102], radius=20, fill=(85, 105, 75, 255))
    
    for ry in [CY - 50, CY, CY + 50]:
        draw.line([(CX - 120, ry), (CX + 120, ry)], fill=(50, 65, 45, 255), width=6)
        draw.line([(CX - 120, ry - 3), (CX + 120, ry - 3)], fill=(125, 145, 115, 255), width=3)
        
    draw.ellipse([CX + 75, CY - 85, CX + 115, CY - 45], fill=(210, 180, 80, 255))
    draw.ellipse([CX + 83, CY - 77, CX + 107, CY - 53], fill=(85, 105, 75, 255))
    
    draw.rectangle([CX - 60, CY - 35, CX + 60, CY + 35], fill=(230, 225, 210, 255))
    draw.rectangle([CX - 56, CY - 31, CX + 56, CY + 31], outline=(160, 50, 40, 255), width=3)
    draw.polygon([(CX, CY - 20), (CX + 6, CY - 5), (CX + 22, CY - 5), (CX + 9, CY + 5), (CX + 14, CY + 20), (CX, CY + 10), (CX - 14, CY + 20), (CX - 9, CY + 5), (CX - 22, CY - 5), (CX - 6, CY - 5)], fill=(180, 45, 35, 255))
    
    img = add_specular_glint(img, CX - 100, CY - 70, size=10)
    return apply_drop_shadow(img)


# --- REMEDIES & SURVIVAL RENDERING ---

def draw_bandage():
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Rolled linen bandage
    # Shadow
    draw.ellipse([CX - 120, CY - 60, CX + 120, CY + 80], fill=(60, 55, 50, 255))
    # Outer roll
    draw.ellipse([CX - 110, CY - 50, CX + 110, CY + 70], fill=(235, 230, 215, 255))
    draw.ellipse([CX - 90, CY - 40, CX + 90, CY + 55], fill=(215, 210, 195, 255))
    
    # Fabric folds / wrap lines
    for off in [-60, -20, 20, 60]:
        draw.arc([CX + off - 30, CY - 45, CX + off + 30, CY + 60], 40, 140, fill=(185, 175, 160, 255), width=4)
        
    # Herbal tie string (green twine)
    draw.arc([CX - 85, CY - 35, CX + 85, CY + 45], 20, 160, fill=(90, 140, 70, 255), width=8)
    draw.arc([CX - 85, CY - 35, CX + 85, CY + 45], 20, 160, fill=(130, 190, 95, 255), width=3)
    
    # Red/Green medicinal cross in center
    draw.rectangle([CX - 8, CY - 25, CX + 8, CY + 25], fill=(70, 170, 90, 255))
    draw.rectangle([CX - 25, CY - 8, CX + 25, CY + 8], fill=(70, 170, 90, 255))
    draw.rectangle([CX - 6, CY - 23, CX + 6, CY + 23], fill=(110, 215, 130, 255))
    draw.rectangle([CX - 23, CY - 6, CX + 23, CY + 6], fill=(110, 215, 130, 255))
    
    return apply_drop_shadow(img)

def draw_ointment_jar():
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Jar base (frosted crystal/glass with cooling cyan balm)
    draw.rounded_rectangle([CX - 120, CY - 50, CX + 120, CY + 130], radius=35, fill=(180, 225, 245, 255))
    # Inner balm glow
    draw.rounded_rectangle([CX - 105, CY - 35, CX + 105, CY + 115], radius=25, fill=(80, 190, 235, 255))
    draw.ellipse([CX - 80, CY - 20, CX + 80, CY + 70], fill=(150, 230, 255, 240)) # swirl
    
    # Silver lid with threaded rim
    draw.rounded_rectangle([CX - 135, CY - 95, CX + 135, CY - 40], radius=18, fill=(215, 225, 235, 255))
    draw.rounded_rectangle([CX - 130, CY - 90, CX + 130, CY - 45], radius=15, fill=(240, 248, 255, 255))
    # Lid knurling
    for lx in range(CX - 110, CX + 120, 18):
        draw.line([(lx, CY - 85), (lx, CY - 50)], fill=(160, 175, 190, 255), width=3)
        
    # Snowflake / frost emblem on front
    draw.line([(CX, CY + 10), (CX, CY + 70)], fill=(255, 255, 255, 220), width=5)
    draw.line([(CX - 30, CY + 40), (CX + 30, CY + 40)], fill=(255, 255, 255, 220), width=5)
    draw.line([(CX - 20, CY + 20), (CX + 20, CY + 60)], fill=(255, 255, 255, 180), width=3)
    draw.line([(CX - 20, CY + 60), (CX + 20, CY + 20)], fill=(255, 255, 255, 180), width=3)
    
    img = add_specular_glint(img, CX - 70, CY - 65, size=14)
    img = add_radial_aura(img, (90, 200, 255), radius=180, alpha=85)
    return apply_drop_shadow(img)

def draw_teleport_scroll():
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Aura
    img = add_radial_aura(img, (70, 200, 240), radius=190, alpha=90)
    draw = ImageDraw.Draw(img)
    
    # Diagonal rolled parchment scroll
    # End cylinders
    draw.ellipse([CX - 110, CY - 130, CX - 60, CY - 80], fill=(210, 180, 120, 255))
    draw.ellipse([CX + 60, CY + 80, CX + 110, CY + 130], fill=(210, 180, 120, 255))
    
    # Main parchment body
    draw.polygon([(CX - 90, CY - 120), (CX + 100, CY + 70), (CX + 70, CY + 120), (CX - 120, CY - 70)], fill=(240, 225, 195, 255))
    # Inner curl shadow
    draw.line([(CX - 88, CY - 118), (CX + 102, CY + 72)], fill=(185, 160, 125, 255), width=6)
    draw.line([(CX - 118, CY - 68), (CX + 72, CY + 122)], fill=(185, 160, 125, 255), width=6)
    
    # Glowing cyan ribbon wrap
    draw.polygon([(CX - 25, CY - 40), (CX + 35, CY + 20), (CX + 15, CY + 45), (CX - 45, CY - 15)], fill=(50, 210, 255, 255))
    # Glowing rune in center
    draw.ellipse([CX - 18, CY - 12, CX + 14, CY + 20], fill=(255, 255, 255, 240))
    # Warp energy particles
    for px, py in [(CX - 60, CY - 70), (CX + 70, CY - 50), (CX - 40, CY + 80), (CX + 50, CY + 70)]:
        draw.ellipse([px - 6, py - 6, px + 6, py + 6], fill=(120, 240, 255, 200))
        
    return apply_drop_shadow(img)

def draw_scent_mask():
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Vintage atomizing perfume / mist bottle
    # Scent mist cloud (greenish herbal)
    mist = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d_mist = ImageDraw.Draw(mist)
    for mx, my, mr in [(CX + 80, CY - 140, 45), (CX + 130, CY - 120, 35), (CX + 100, CY - 90, 50), (CX + 150, CY - 70, 30)]:
        d_mist.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=(110, 210, 120, 130))
    mist = mist.filter(ImageFilter.GaussianBlur(12))
    img = Image.alpha_composite(img, mist)
    draw = ImageDraw.Draw(img)
    
    # Leather bottle body
    draw.ellipse([CX - 120, CY - 40, CX + 70, CY + 150], fill=(95, 60, 35, 255))
    draw.ellipse([CX - 110, CY - 30, CX + 60, CY + 140], fill=(145, 95, 55, 255))
    
    # Brass neck & nozzle
    draw.rectangle([CX - 45, CY - 90, CX - 5, CY - 40], fill=(225, 185, 75, 255))
    draw.line([(CX - 25, CY - 90), (CX + 60, CY - 115)], fill=(225, 185, 75, 255), width=12) # spray tube
    
    # Rubber squeeze bulb (maroon/black)
    draw.ellipse([CX - 130, CY - 130, CX - 60, CY - 60], fill=(120, 35, 45, 255))
    draw.ellipse([CX - 120, CY - 120, CX - 70, CY - 70], fill=(175, 55, 65, 255))
    draw.line([(CX - 65, CY - 95), (CX - 40, CY - 75)], fill=(200, 165, 60, 255), width=8) # brass connector
    
    # Leaf sprig decoration
    draw.polygon([(CX - 40, CY + 30), (CX - 10, CY), (CX + 20, CY + 30), (CX - 10, CY + 60)], fill=(65, 160, 75, 255))
    draw.line([(CX - 40, CY + 30), (CX + 20, CY + 30)], fill=(120, 220, 130, 255), width=3)
    
    return apply_drop_shadow(img)

def draw_flare():
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Flare casing (cylinder tilted slightly)
    # Sparks / smoke from top
    sparks = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d_sp = ImageDraw.Draw(sparks)
    for _ in range(15):
        ang = np.random.uniform(-0.8, 0.8)
        dist = np.random.uniform(40, 110)
        sx = CX - 30 + int(math.sin(ang) * dist)
        sy = 140 - int(math.cos(ang) * dist)
        d_sp.ellipse([sx - 4, sy - 4, sx + 4, sy + 4], fill=(255, np.random.randint(180, 255), 50, 230))
    d_sp.ellipse([CX - 50, 100, CX - 10, 140], fill=(255, 100, 50, 220))
    sparks = sparks.filter(ImageFilter.GaussianBlur(3))
    img = Image.alpha_composite(img, sparks)
    draw = ImageDraw.Draw(img)
    
    # Main red casing
    draw.polygon([(CX - 75, 150), (CX + 5, 150), (CX + 45, 400), (CX - 35, 400)], fill=(190, 35, 45, 255))
    # Brass base
    draw.polygon([(CX - 35, 360), (CX + 45, 360), (CX + 45, 405), (CX - 35, 405)], fill=(215, 175, 65, 255))
    # White warning stripes
    for off in [200, 260, 320]:
        draw.polygon([(CX - 65 + (off-150)*0.16, off), (CX + 15 + (off-150)*0.16, off),
                      (CX + 15 + (off-130)*0.16, off + 20), (CX - 65 + (off-130)*0.16, off + 20)], fill=(245, 245, 245, 255))
        
    # Flare head glow
    img = add_radial_aura(img, (255, 60, 60), radius=170, alpha=80)
    return apply_drop_shadow(img)


# --- SPECIALIZED ELIXIRS (P-*) ---

def draw_ki_essence():
    # P-KI-01: Neon cyan/blue core in gyro rings
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Outer gyro ring (silver/chrome)
    draw.ellipse([CX - 160, CY - 160, CX + 160, CY + 160], outline=(180, 205, 230, 255), width=18)
    draw.ellipse([CX - 150, CY - 150, CX + 150, CY + 150], outline=(235, 245, 255, 255), width=6)
    
    # Tilted inner gyro ring
    draw.arc([CX - 130, CY - 90, CX + 130, CY + 90], 0, 360, fill=(160, 190, 220, 255), width=14)
    
    # Glowing plasma core sphere
    core = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d_c = ImageDraw.Draw(core)
    d_c.ellipse([CX - 90, CY - 90, CX + 90, CY + 90], fill=(20, 140, 255, 240))
    d_c.ellipse([CX - 70, CY - 70, CX + 70, CY + 70], fill=(80, 210, 255, 255))
    d_c.ellipse([CX - 40, CY - 40, CX + 40, CY + 40], fill=(220, 250, 255, 255))
    core = core.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, core)
    
    # Ki energy arcs / sparks
    draw = ImageDraw.Draw(img)
    for ang in [0.4, 1.8, 3.2, 4.7]:
        x1 = CX + int(math.cos(ang) * 90)
        y1 = CY + int(math.sin(ang) * 90)
        x2 = CX + int(math.cos(ang + 0.3) * 145)
        y2 = CY + int(math.sin(ang + 0.3) * 145)
        draw.line([(x1, y1), (x2, y2)], fill=(220, 255, 255, 220), width=4)
        
    img = add_radial_aura(img, (40, 170, 255), radius=210, alpha=110)
    img = add_specular_glint(img, CX - 35, CY - 35, size=16)
    return apply_drop_shadow(img)

def draw_plasma_injector():
    # P-ELX-N: High-tech plasma injector syringe
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Tilted cylinder
    # Plunger thumb ring
    draw.ellipse([CX - 110, 100, CX - 50, 160], outline=(170, 185, 200, 255), width=12)
    # Plunger rod
    draw.line([(CX - 70, 150), (CX - 15, 205)], fill=(200, 215, 230, 255), width=16)
    
    # Syringe barrel (transparent cylinder with glowing cyan plasma)
    draw.polygon([(CX - 50, 210), (CX + 20, 140), (CX + 140, 260), (CX + 70, 330)], fill=(30, 45, 60, 255))
    # Glowing plasma window
    draw.polygon([(CX - 35, 225), (CX + 10, 180), (CX + 115, 285), (CX + 70, 330)], fill=(0, 230, 255, 240))
    draw.polygon([(CX - 25, 235), (CX + 5, 200), (CX + 95, 290), (CX + 65, 325)], fill=(210, 250, 255, 255))
    
    # Metallic needle collar
    draw.polygon([(CX + 130, 250), (CX + 155, 275), (CX + 140, 290), (CX + 115, 265)], fill=(210, 220, 235, 255))
    # Titanium needle tip
    draw.line([(CX + 145, 280), (CX + 215, 350)], fill=(240, 245, 255, 255), width=6)
    
    # Plasma glow
    img = add_radial_aura(img, (0, 220, 255), radius=180, alpha=90)
    img = add_specular_glint(img, CX + 40, 240, size=14)
    return apply_drop_shadow(img)

# --- TOOLS (T-*) ---

def draw_hammer():
    # T-01: Blacksmith / Apprentice Hammer
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Diagonal wooden handle
    draw.line([(CX - 110, CY + 140), (CX + 60, CY - 50)], fill=(145, 95, 50, 255), width=24)
    # Grip wrap (leather)
    for off in range(-100, -20, 16):
        draw.line([(CX + off, CY - off + 30), (CX + off + 14, CY - off + 44)], fill=(80, 50, 25, 255), width=26)
        
    # Steel hammer head (rectangular block with beveled faces)
    hx, hy = CX + 55, CY - 65
    draw.polygon([
        (hx - 80, hy - 40), (hx + 40, hy - 110),
        (hx + 80, hy - 65), (hx - 40, hy + 5)
    ], fill=(135, 145, 155, 255))
    # Beveled highlight face
    draw.polygon([
        (hx - 75, hy - 38), (hx + 35, hy - 105),
        (hx + 45, hy - 95), (hx - 65, hy - 28)
    ], fill=(215, 225, 235, 255))
    # Striking face (chamfered)
    draw.polygon([
        (hx - 95, hy - 25), (hx - 75, hy - 50),
        (hx - 65, hy - 30), (hx - 85, hy - 5)
    ], fill=(95, 105, 115, 255))
    
    img = add_specular_glint(img, hx - 5, hy - 60, size=14)
    return apply_drop_shadow(img)

def draw_cartographer_set():
    # T-02: Rolled chart map + golden compass divider + quill
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Rolled aged map sheet
    draw.polygon([(CX - 120, CY + 40), (CX + 70, CY + 120), (CX + 120, CY - 40), (CX - 70, CY - 120)], fill=(235, 220, 185, 255))
    draw.polygon([(CX - 115, CY + 38), (CX + 65, CY + 115), (CX + 115, CY - 38), (CX - 65, CY - 115)], fill=(245, 235, 205, 255))
    # Map contour lines & compass rose
    draw.arc([CX - 20, CY - 40, CX + 60, CY + 40], 30, 240, fill=(185, 160, 125, 255), width=3)
    draw.line([(CX + 10, CY - 30), (CX + 30, CY + 30)], fill=(185, 160, 125, 255), width=2)
    
    # Golden compass drafting dividers (V-shape)
    draw.line([(CX - 10, CY - 90), (CX - 65, CY + 60)], fill=(225, 185, 60, 255), width=10)
    draw.line([(CX - 10, CY - 90), (CX + 45, CY + 55)], fill=(225, 185, 60, 255), width=10)
    # Hinge circle & tips
    draw.ellipse([CX - 22, CY - 102, CX + 2, CY - 78], fill=(245, 210, 90, 255))
    draw.ellipse([CX - 17, CY - 97, CX - 3, CY - 83], fill=(140, 100, 30, 255))
    draw.line([(CX - 65, CY + 55), (CX - 75, CY + 80)], fill=(200, 215, 230, 255), width=4) # steel point
    draw.line([(CX + 45, CY + 50), (CX + 55, CY + 75)], fill=(200, 215, 230, 255), width=4)
    
    img = add_specular_glint(img, CX - 10, CY - 90, size=12)
    return apply_drop_shadow(img)

def draw_sickle():
    # T-03: Harvesting crescent sickle
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Wooden handle at bottom right
    draw.line([(CX + 30, CY + 40), (CX + 90, CY + 140)], fill=(110, 70, 35, 255), width=22)
    draw.ellipse([CX + 80, CY + 130, CX + 100, CY + 150], fill=(180, 140, 60, 255)) # brass pommel
    draw.line([(CX + 25, CY + 35), (CX + 38, CY + 50)], fill=(200, 160, 70, 255), width=26) # bolster
    
    # Crescent curved blade
    draw.arc([CX - 140, CY - 140, CX + 80, CY + 80], 45, 230, fill=(215, 225, 235, 255), width=28)
    draw.arc([CX - 140, CY - 140, CX + 80, CY + 80], 45, 230, fill=(245, 250, 255, 255), width=8) # sharp inner bevel
    
    # Druidic leaf engraving on blade
    draw.arc([CX - 110, CY - 100, CX + 20, CY + 30], 80, 190, fill=(90, 160, 100, 255), width=4)
    
    img = add_specular_glint(img, CX - 120, CY - 70, size=14)
    return apply_drop_shadow(img)

def draw_analog_probe():
    # T-04: Brass analog diagnostic probe with dial gauge
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Grounding spike / needle at bottom
    draw.polygon([(CX - 8, CY + 30), (CX + 8, CY + 30), (CX, CY + 170)], fill=(200, 215, 230, 255))
    
    # Circular dial gauge
    draw.ellipse([CX - 90, CY - 110, CX + 90, CY + 70], fill=(210, 175, 70, 255)) # brass bezel
    draw.ellipse([CX - 78, CY - 98, CX + 78, CY + 58], fill=(245, 240, 225, 255)) # parchment face
    
    # Gauge ticks & needle
    for ang in np.linspace(-2.2, 0.6, 7):
        tx = CX + int(math.cos(ang) * 55)
        ty = CY - 20 + int(math.sin(ang) * 55)
        draw.line([(CX + int(math.cos(ang)*45), CY - 20 + int(math.sin(ang)*45)), (tx, ty)], fill=(60, 50, 40, 255), width=3)
    # Red indicator needle
    draw.line([(CX, CY - 20), (CX + 35, CY - 55)], fill=(215, 40, 30, 255), width=4)
    draw.ellipse([CX - 8, CY - 28, CX + 8, CY - 12], fill=(120, 80, 20, 255))
    
    # Top helical antenna
    for ay in range(CY - 145, CY - 110, 8):
        draw.ellipse([CX - 16, ay, CX + 16, ay + 6], outline=(225, 140, 50, 255), width=3) # copper coil
        
    img = add_specular_glint(img, CX - 45, CY - 65, size=12)
    return apply_drop_shadow(img)

def draw_trail_lantern():
    # T-05: Heavy bronze trail storm lantern with flame
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Top hanging loop
    draw.ellipse([CX - 40, 80, CX + 40, 150], outline=(170, 125, 55, 255), width=12)
    # Metal canopy cap
    draw.polygon([(CX - 85, 180), (CX + 85, 180), (CX + 40, 140), (CX - 40, 140)], fill=(190, 140, 65, 255))
    
    # Glass chamber with glowing amber flame
    draw.rounded_rectangle([CX - 70, 180, CX + 70, 340], radius=18, fill=(255, 230, 160, 140))
    # Flame core
    flame = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d_f = ImageDraw.Draw(flame)
    d_f.ellipse([CX - 45, 220, CX + 45, 310], fill=(255, 150, 30, 240))
    d_f.ellipse([CX - 25, 235, CX + 25, 295], fill=(255, 245, 140, 255))
    flame = flame.filter(ImageFilter.GaussianBlur(6))
    img = Image.alpha_composite(img, flame)
    draw = ImageDraw.Draw(img)
    
    # Protective wire cage bars
    for bx in [CX - 40, CX, CX + 40]:
        draw.line([(bx, 180), (bx, 340)], fill=(140, 95, 45, 255), width=7)
    draw.line([(CX - 70, 260), (CX + 70, 260)], fill=(140, 95, 45, 255), width=6)
    
    # Heavy base
    draw.rounded_rectangle([CX - 90, 340, CX + 90, 395], radius=10, fill=(180, 130, 60, 255))
    draw.line([(CX - 85, 350), (CX + 85, 350)], fill=(225, 175, 80, 255), width=4)
    
    img = add_radial_aura(img, (255, 160, 40), radius=190, alpha=95)
    return apply_drop_shadow(img)

def draw_rescuer_kit():
    # T-06: Field medic canvas satchel
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Satchel bag body (crimson red canvas)
    draw.rounded_rectangle([CX - 130, CY - 80, CX + 130, CY + 120], radius=24, fill=(160, 35, 45, 255))
    # Flap cover
    draw.rounded_rectangle([CX - 135, CY - 85, CX + 135, CY + 30], radius=20, fill=(195, 45, 55, 255))
    
    # Leather straps & brass buckles
    for sx in [CX - 75, CX + 75]:
        draw.line([(sx, CY - 85), (sx, CY + 80)], fill=(95, 55, 30, 255), width=14)
        draw.rectangle([sx - 10, CY + 20, sx + 10, CY + 45], fill=(225, 185, 75, 255))
        draw.rectangle([sx - 6, CY + 25, sx + 6, CY + 40], fill=(95, 55, 30, 255))
        
    # White medical cross emblem on flap center
    draw.rectangle([CX - 12, CY - 55, CX + 12, CY - 5], fill=(250, 250, 250, 255))
    draw.rectangle([CX - 35, CY - 38, CX + 35, CY - 22], fill=(250, 250, 250, 255))
    
    # Top carry handle
    draw.arc([CX - 50, CY - 135, CX + 50, CY - 75], 180, 360, fill=(95, 55, 30, 255), width=16)
    
    return apply_drop_shadow(img)

def draw_seal_press():
    # T-07: Heavy screw press mechanism
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Heavy base platen
    draw.rounded_rectangle([CX - 120, CY + 90, CX + 120, CY + 140], radius=12, fill=(80, 85, 95, 255))
    # Dual support pillars
    draw.rectangle([CX - 95, CY - 60, CX - 70, CY + 90], fill=(130, 135, 145, 255))
    draw.rectangle([CX + 70, CY - 60, CX + 95, CY + 90], fill=(130, 135, 145, 255))
    # Top arch yoke
    draw.rounded_rectangle([CX - 110, CY - 90, CX + 110, CY - 40], radius=10, fill=(90, 95, 105, 255))
    
    # Central screw spindle (brass thread)
    for sy in range(CY - 50, CY + 40, 10):
        draw.line([(CX - 22, sy), (CX + 22, sy + 5)], fill=(215, 180, 75, 255), width=6)
    # Embossing die plate
    draw.ellipse([CX - 50, CY + 40, CX + 50, CY + 75], fill=(235, 195, 80, 255))
    
    # Double-ball turn handle at top
    draw.line([(CX - 120, CY - 115), (CX + 120, CY - 115)], fill=(200, 210, 220, 255), width=14)
    draw.ellipse([CX - 145, CY - 130, CX - 115, CY - 100], fill=(215, 175, 65, 255))
    draw.ellipse([CX + 115, CY - 130, CX + 145, CY - 100], fill=(215, 175, 65, 255))
    
    return apply_drop_shadow(img)

def draw_master_seal():
    # T-08: Master Guild Wax Stamp
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # Lathe-turned polished mahogany wood handle
    draw.polygon([(CX - 30, CY - 30), (CX + 30, CY - 30), (CX + 45, CY - 120), (CX - 45, CY - 120)], fill=(125, 45, 30, 255))
    draw.ellipse([CX - 55, CY - 150, CX + 55, CY - 95], fill=(160, 60, 40, 255)) # ergonomic pommel ball
    draw.ellipse([CX - 40, CY - 140, CX + 40, CY - 105], fill=(195, 80, 55, 255))
    
    # Massive golden seal matrix base
    draw.polygon([(CX - 45, CY - 30), (CX + 45, CY - 30), (CX + 85, CY + 40), (CX - 85, CY + 40)], fill=(215, 175, 60, 255))
    # Engraved stamp face (circular die)
    draw.ellipse([CX - 95, CY + 30, CX + 95, CY + 105], fill=(245, 205, 80, 255))
    draw.ellipse([CX - 82, CY + 38, CX + 82, CY + 97], outline=(140, 95, 25, 255), width=4)
    # Master guild star / crest engraved
    draw.polygon([(CX, CY + 48), (CX + 15, CY + 80), (CX - 15, CY + 80)], fill=(160, 105, 30, 255))
    draw.polygon([(CX, CY + 87), (CX + 15, CY + 55), (CX - 15, CY + 55)], fill=(160, 105, 30, 255))
    
    img = add_radial_aura(img, (255, 200, 60), radius=190, alpha=95)
    img = add_specular_glint(img, CX - 30, CY + 45, size=16)
    return apply_drop_shadow(img)


# --- JEWELRY (J-*) ---

def draw_amulet(chain_col, gem_col, gem_shape="drop", frame_col=(215, 175, 60), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # 1. Hanging braided chain / cord (V-curve)
    for off in [-3, 0, 3]:
        draw.arc([CX - 130 + off, 60, CX + 130 + off, 300], 20, 160, fill=chain_col, width=4)
        
    # 2. Bail / loop connection
    draw.ellipse([CX - 18, 235, CX + 18, 270], outline=frame_col, width=6)
    
    # 3. Outer filigree metal setting
    fx, fy = CX, 340
    if gem_shape == "drop":
        draw.polygon([(fx, fy - 75), (fx + 65, fy + 15), (fx, fy + 75), (fx - 65, fy + 15)], fill=frame_col)
        # Inner gem
        gr, gg, gb = gem_col[:3]
        draw.polygon([(fx, fy - 60), (fx + 50, fy + 15), (fx, fy + 60), (fx - 50, fy + 15)], fill=(gr, gg, gb, 255))
        # Facet highlights
        draw.polygon([(fx, fy - 60), (fx, fy + 60), (fx - 50, fy + 15)], fill=(min(255, gr + 40), min(255, gg + 40), min(255, gb + 40), 220))
        draw.polygon([(fx - 30, fy - 20), (fx, fy - 60), (fx + 10, fy - 15)], fill=(255, 255, 255, 180))
    elif gem_shape == "oval":
        draw.ellipse([fx - 70, fy - 65, fx + 70, fy + 65], fill=frame_col)
        gr, gg, gb = gem_col[:3]
        draw.ellipse([fx - 55, fy - 50, fx + 55, fy + 50], fill=(gr, gg, gb, 255))
        draw.ellipse([fx - 40, fy - 35, fx + 40, fy + 35], fill=(min(255, gr + 45), min(255, gg + 45), min(255, gb + 45), 230))
        draw.arc([fx - 45, fy - 40, fx + 45, fy + 40], 110, 230, fill=(255, 255, 255, 190), width=6)
    elif gem_shape == "heart":
        draw.ellipse([fx - 65, fy - 55, fx + 65, fy + 55], fill=frame_col)
        gr, gg, gb = gem_col[:3]
        draw.polygon([(fx, fy + 50), (fx - 50, fy - 25), (fx, fy - 10), (fx + 50, fy - 25)], fill=(gr, gg, gb, 255))
        draw.ellipse([fx - 45, fy - 45, fx - 5, fy - 10], fill=(gr, gg, gb, 255))
        draw.ellipse([fx + 5, fy - 45, fx + 45, fy - 10], fill=(gr, gg, gb, 255))
    elif gem_shape == "sunburst":
        # Multi-ray starburst
        for i in range(12):
            ang = i * (math.pi / 6)
            sx = fx + int(math.cos(ang) * 75)
            sy = fy + int(math.sin(ang) * 75)
            draw.line([(fx, fy), (sx, sy)], fill=frame_col, width=8)
        draw.ellipse([fx - 45, fy - 45, fx + 45, fy + 45], fill=(frame_col[0]//2, frame_col[1]//2, frame_col[2]//2, 255))
        gr, gg, gb = gem_col[:3]
        draw.ellipse([fx - 36, fy - 36, fx + 36, fy + 36], fill=(gr, gg, gb, 255))
        draw.ellipse([fx - 24, fy - 24, fx + 24, fy + 24], fill=(min(255, gr + 50), min(255, gg + 50), min(255, gb + 50), 240))
        
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=185, alpha=90)
    img = add_specular_glint(img, fx - 20, fy - 20, size=15)
    return apply_drop_shadow(img)

def draw_ring(band_col, gem_col=None, style="solitaire", aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    # 3D tilted ring perspective (outer & inner ellipses)
    rx, ry = CX, CY + 30
    rw, rh = 115, 80
    
    # Back half of band
    draw.ellipse([rx - rw, ry - rh, rx + rw, ry + rh], outline=(band_col[0]//2, band_col[1]//2, band_col[2]//2, 255), width=22)
    
    # Front half of band with metallic shading
    draw.arc([rx - rw, ry - rh, rx + rw, ry + rh], 0, 180, fill=band_col, width=22)
    draw.arc([rx - rw + 3, ry - rh + 3, rx + rw - 3, ry + rh - 3], 15, 165, fill=(min(255, band_col[0] + 50), min(255, band_col[1] + 50), min(255, band_col[2] + 50), 255), width=6)
    
    # Gemstone mount / setting at top of ring
    gx, gy = rx, ry - rh + 6
    if gem_col:
        gr, gg, gb = gem_col[:3]
        if style == "solitaire":
            # 4 prongs
            for px in [-25, -10, 10, 25]:
                draw.line([(gx + px, gy + 15), (gx + px*0.6, gy - 25)], fill=(band_col[0], band_col[1], band_col[2], 255), width=5)
            # Brilliant faceted diamond/gem
            draw.polygon([(gx - 35, gy - 10), (gx, gy - 45), (gx + 35, gy - 10), (gx, gy + 20)], fill=(gr, gg, gb, 255))
            draw.polygon([(gx - 25, gy - 10), (gx, gy - 40), (gx + 25, gy - 10)], fill=(min(255, gr + 60), min(255, gg + 60), min(255, gb + 60), 240))
            draw.polygon([(gx - 35, gy - 10), (gx, gy - 10), (gx, gy + 20)], fill=(max(0, gr - 40), max(0, gg - 40), max(0, gb - 40), 220))
        elif style == "cabochon":
            draw.ellipse([gx - 45, gy - 25, gx + 45, gy + 25], fill=band_col)
            draw.ellipse([gx - 35, gy - 20, gx + 35, gy + 20], fill=(gr, gg, gb, 255))
            draw.ellipse([gx - 25, gy - 15, gx + 25, gy + 15], fill=(min(255, gr + 50), min(255, gg + 50), min(255, gb + 50), 240))
        elif style == "four_voices":
            # 4 cardinal gems around bezel
            draw.ellipse([gx - 55, gy - 30, gx + 55, gy + 30], fill=band_col)
            colors = [(60, 200, 70), (225, 45, 45), (45, 125, 235), (245, 205, 50)] # earth, fire, water, wind
            offsets = [(-32, 0), (0, -18), (32, 0), (0, 18)]
            for (cx, cy), c in zip(offsets, colors):
                draw.ellipse([gx + cx - 11, gy + cy - 11, gx + cx + 11, gy + cy + 11], fill=c)
        elif style == "eye":
            # Pupil eye of witnesses
            draw.ellipse([gx - 50, gy - 25, gx + 50, gy + 25], fill=band_col)
            draw.polygon([(gx - 40, gy), (gx, gy - 18), (gx + 40, gy), (gx, gy + 18)], fill=(240, 245, 250, 255))
            draw.ellipse([gx - 14, gy - 14, gx + 14, gy + 14], fill=(30, 45, 120, 255)) # iris
            draw.ellipse([gx - 5, gy - 5, gx + 5, gy + 5], fill=(10, 15, 30, 255)) # pupil
    else:
        # Band ring with inscriptions
        draw.ellipse([gx - 35, gy - 18, gx + 35, gy + 18], fill=band_col)
        
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=180, alpha=85)
    img = add_specular_glint(img, gx - 15, gy - 15, size=15)
    return apply_drop_shadow(img)

# --- BATCH 1 MASTER BUILDER DICTIONARY ---

GENERATORS = {
    # Consumables
    "U-01": lambda: draw_bandage(),
    "U-02": lambda: draw_flask((45, 200, 90), shape="vial", stopper_col=(140, 100, 60), aura_col=(50, 210, 100)),
    "U-03": lambda: draw_flask((35, 140, 235), shape="round", stopper_col=(180, 140, 90), aura_col=(40, 160, 255)),
    "U-04": lambda: draw_flask((245, 215, 60), shape="square", stopper_col=(215, 175, 60), aura_col=(255, 230, 80)),
    "U-05": lambda: draw_flask((210, 35, 45), shape="round", stopper_col=(120, 35, 45), aura_col=(230, 40, 50)),
    "U-06": lambda: draw_flask((255, 140, 30), shape="triangle", stopper_col=(235, 195, 70), aura_col=(255, 180, 40)),
    "U-07": lambda: draw_bread(),
    "U-08": lambda: draw_bowl_soup((45, 135, 180), steam_col=(180, 230, 250, 140), spoon=True, veg_dots=True),
    "U-09": lambda: draw_bowl_soup((215, 65, 30), steam_col=(255, 170, 110, 150), spoon=False, veg_dots=True),
    "U-10": lambda: draw_tea_cup(),
    "U-11": lambda: draw_service_ration(),
    "U-12": lambda: draw_flask((140, 230, 50), shape="vial", stopper_col=(195, 215, 230), aura_col=(150, 240, 60)),
    "U-13": lambda: draw_ointment_jar(),
    "U-14": lambda: draw_teleport_scroll(),
    "U-15": lambda: draw_scent_mask(),
    "U-16": lambda: draw_flare(),
    
    # Specialized Elixirs
    "P-KI-01": lambda: draw_ki_essence(),
    "P-ELX-V": lambda: draw_flask((75, 180, 65), shape="round", stopper_col=(95, 60, 30), aura_col=(80, 210, 70)),
    "P-ELX-P": lambda: draw_flask((235, 75, 25), shape="triangle", stopper_col=(60, 30, 20), aura_col=(255, 100, 30)),
    "P-ELX-A": lambda: draw_flask((175, 120, 235), shape="square", stopper_col=(205, 215, 235), aura_col=(190, 130, 255)),
    "P-ELX-N": lambda: draw_plasma_injector(),
    "P-BUFF-DEF": lambda: draw_flask((120, 130, 140), shape="square", stopper_col=(80, 90, 100), aura_col=(150, 165, 180)),
    
    # Tools
    "T-01": lambda: draw_hammer(),
    "T-02": lambda: draw_cartographer_set(),
    "T-03": lambda: draw_sickle(),
    "T-04": lambda: draw_analog_probe(),
    "T-05": lambda: draw_trail_lantern(),
    "T-06": lambda: draw_rescuer_kit(),
    "T-07": lambda: draw_seal_press(),
    "T-08": lambda: draw_master_seal(),
    
    # Jewelry
    "J-01": lambda: draw_amulet((190, 200, 215), (45, 145, 215), gem_shape="drop", frame_col=(195, 205, 220), aura_col=(60, 160, 235)),
    "J-02": lambda: draw_ring((75, 160, 85), (50, 205, 100), style="cabochon", aura_col=(80, 210, 110)),
    "J-03": lambda: draw_amulet((215, 225, 240), (80, 210, 245), gem_shape="drop", frame_col=(220, 230, 245), aura_col=(90, 220, 255)),
    "J-04": lambda: draw_ring((220, 230, 240), (240, 248, 255), style="solitaire", aura_col=(190, 220, 255)),
    "J-05": lambda: draw_amulet((195, 145, 60), (235, 165, 45), gem_shape="oval", frame_col=(210, 155, 65), aura_col=(245, 180, 50)),
    "J-06": lambda: draw_ring((130, 135, 145), (215, 40, 50), style="cabochon", aura_col=(235, 50, 60)),
    "J-07": lambda: draw_amulet((225, 185, 65), (220, 35, 45), gem_shape="heart", frame_col=(245, 205, 80), aura_col=(255, 80, 90)),
    "J-08": lambda: draw_ring((215, 180, 70), style="solitaire", aura_col=(245, 200, 80)),
    "J-09": lambda: draw_amulet((225, 210, 160), (45, 65, 180), gem_shape="sunburst", frame_col=(235, 220, 175), aura_col=(70, 100, 230)),
    "J-10": lambda: draw_ring((65, 75, 90), style="eye", aura_col=(100, 140, 220)),
    "J-11": lambda: draw_amulet((240, 205, 75), (180, 130, 235), gem_shape="oval", frame_col=(250, 215, 85), aura_col=(200, 140, 255)),
    "J-12": lambda: draw_ring((235, 195, 70), style="four_voices", aura_col=(245, 210, 80)),
}

def build_all():
    print(f"Generating Batch 1: {len(GENERATORS)} items (Consumables, Tools, Jewelry)...")
    
    # 7 columns x 6 rows for contact sheet
    cols, rows = 7, 6
    cell_w, cell_h = 140, 160
    contact = Image.new("RGBA", (cols * cell_w + 40, rows * cell_h + 60), (18, 22, 28, 255))
    draw_c = ImageDraw.Draw(contact)
    draw_c.text((25, 18), "KI LEGENDS — BATCH 1: CONSUMABLES, TOOLS & JEWELRY (42 ITEMS)", fill=(240, 220, 160, 255))
    
    idx = 0
    for item_id, gen_fn in GENERATORS.items():
        print(f"  Rendering [{idx+1}/{len(GENERATORS)}] {item_id}...")
        master = gen_fn()
        
        # 1. Save master 512x512 PNG
        master_path = MASTERS_DIR / f"{item_id}.png"
        master.save(master_path, "PNG")
        
        # 2. Resample Lanczos to 128x128 RGBA WebP
        icon_128 = master.resize((128, 128), Image.Resampling.LANCZOS)
        out_webp = PUBLIC_DIR / f"{item_id}.webp"
        icon_128.save(out_webp, "WEBP", quality=95)
        
        # 3. Paste onto contact sheet
        col = idx % cols
        row = idx // cols
        px = 25 + col * cell_w
        py = 55 + row * cell_h
        
        # Cell border & background
        draw_c.rounded_rectangle([px, py, px + 128, py + 128], radius=8, fill=(30, 36, 46, 255), outline=(60, 72, 90, 255), width=1)
        contact.alpha_composite(icon_128, (px, py))
        draw_c.text((px + 10, py + 132), item_id, fill=(210, 225, 240, 255))
        idx += 1
        
    contact_path = QA_DIR / "review_batch1_consumables_tools_jewelry.png"
    contact.save(contact_path, "PNG")
    print(f"\nSUCCESS! 42/42 items generated.")
    print(f"Masters: {MASTERS_DIR}")
    print(f"Public WebP: {PUBLIC_DIR}")
    print(f"QA Contact Sheet: {contact_path}")

if __name__ == "__main__":
    build_all()
