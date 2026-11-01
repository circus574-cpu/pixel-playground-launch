#!/usr/bin/env python3
"""Procedural high-res icon synthesis for 113 Weapons, Armors, Helmets, Gloves, Legs, and Boots.
Completes 100% of the 366 items in the Ki Legends catalog!
Generates master 512x512 PNGs, scales to 128x128 WebP with alpha transparency,
and builds an 11x11 contact review sheet.
"""

import math
import os
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_consumables_tools_jewelry import draw_flask

ROOT = Path(__file__).resolve().parents[2]
MASTERS_DIR = ROOT / "art" / "production" / "items" / "masters"
QA_DIR = ROOT / "art" / "production" / "items" / "qa"
PUBLIC_DIR = ROOT / "public" / "game" / "items"

MASTERS_DIR.mkdir(parents=True, exist_ok=True)
QA_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

S = 512
CX, CY = S // 2, S // 2

def create_canvas():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))

def add_radial_aura(img, color, radius=190, alpha=85):
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
    shifted_shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shifted_shadow.paste(shadow, offset)
    return Image.alpha_composite(shifted_shadow, img)

def add_specular_glint(img, x, y, size=16, color=(255, 255, 255, 230)):
    glint = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glint)
    draw.ellipse([x - size, y - size, x + size, y + size], fill=color)
    draw.ellipse([x - size*2.5, y - size*0.4, x + size*2.5, y + size*0.4], fill=(color[0], color[1], color[2], color[3]//2))
    draw.ellipse([x - size*0.4, y - size*2.5, x + size*0.4, y + size*2.5], fill=(color[0], color[1], color[2], color[3]//2))
    glint = glint.filter(ImageFilter.GaussianBlur(2))
    return Image.alpha_composite(img, glint)

# --- WEAPON RENDERERS ---

def draw_sword(blade_col=(220, 230, 245), hilt_col=(185, 145, 60), grip_col=(95, 60, 35), full_len=True, curved=False, aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Tilted diagonal sword (bottom-left to top-right)
    # 1. Pommel
    draw.ellipse([CX - 125, CY + 125, CX - 95, CY + 155], fill=hilt_col)
    # 2. Grip
    draw.line([(CX - 110, CY + 140), (CX - 50, CY + 80)], fill=grip_col, width=16)
    for off in range(-40, 20, 12):
        draw.line([(CX - 80 + off, CY + 110 - off), (CX - 72 + off, CY + 118 - off)], fill=(min(255, grip_col[0]+40), min(255, grip_col[1]+40), min(255, grip_col[2]+40), 220), width=4)
    # 3. Crossguard
    draw.line([(CX - 85, CY + 45), (CX - 25, CY + 105)], fill=hilt_col, width=20)
    draw.ellipse([CX - 92, CY + 38, CX - 76, CY + 54], fill=hilt_col)
    draw.ellipse([CX - 32, CY + 98, CX - 16, CY + 114], fill=hilt_col)
    # 4. Blade
    br, bg, bb = blade_col[:3]
    if curved:
        # Scimitar curve
        pts = [(CX - 50, CY + 70), (CX + 80, CY - 60), (CX + 140, CY - 145), (CX + 105, CY - 110), (CX - 35, CY + 85)]
        draw.polygon(pts, fill=(br, bg, bb, 255))
        draw.line([(CX - 50, CY + 70), (CX + 140, CY - 145)], fill=(255, 255, 255, 230), width=5)
    else:
        # Straight blade
        pts = [(CX - 55, CY + 65), (CX + 115, CY - 105), (CX + 140, CY - 140), (CX + 105, CY - 115), (CX - 35, CY + 85)]
        draw.polygon(pts, fill=(br, bg, bb, 255))
        # Center fuller ridge
        draw.line([(CX - 45, CY + 75), (CX + 110, CY - 110)], fill=(min(255, br+40), min(255, bg+40), min(255, bb+40), 255), width=4)
        draw.line([(CX - 42, CY + 78), (CX + 113, CY - 107)], fill=(max(0, br-50), max(0, bg-50), max(0, bb-50), 200), width=2)
    img = add_specular_glint(img, CX + 60, CY - 50, size=14)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=190, alpha=90)
    return apply_drop_shadow(img)

def draw_dagger(blade_col=(210, 225, 240), hilt_col=(180, 140, 50), aura_col=None):
    return draw_sword(blade_col=blade_col, hilt_col=hilt_col, grip_col=(60, 45, 40), full_len=False, curved=False, aura_col=aura_col)

def draw_axe(head_col=(190, 205, 220), haft_col=(120, 80, 45), double=False, aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Haft
    draw.line([(CX - 110, CY + 130), (CX + 75, CY - 95)], fill=haft_col, width=20)
    # Axe blade
    ax, ay = CX + 50, CY - 70
    draw.polygon([(ax - 20, ay + 20), (ax + 75, ay - 60), (ax + 95, ay + 15), (ax + 30, ay + 65)], fill=head_col)
    draw.arc([ax - 10, ay - 75, ax + 110, ay + 75], -50, 40, fill=(255, 255, 255, 230), width=6)
    if double:
        draw.polygon([(ax - 20, ay - 20), (ax - 75, ay + 60), (ax - 95, ay - 15), (ax - 30, ay - 65)], fill=head_col)
    img = add_specular_glint(img, ax + 75, ay - 20, size=15)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=190, alpha=90)
    return apply_drop_shadow(img)

def draw_spear(head_col=(220, 235, 250), shaft_col=(115, 75, 40), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Long shaft
    draw.line([(CX - 130, CY + 140), (CX + 80, CY - 100)], fill=shaft_col, width=16)
    # Leaf spearhead
    hx, hy = CX + 105, CY - 130
    draw.polygon([(hx - 35, hy + 35), (hx + 40, hy - 40), (hx + 20, hy + 5), (hx - 5, hy + 45)], fill=head_col)
    draw.line([(hx - 30, hy + 30), (hx + 35, hy - 35)], fill=(255, 255, 255, 240), width=4)
    img = add_specular_glint(img, hx + 10, hy - 10, size=14)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=190, alpha=90)
    return apply_drop_shadow(img)

def draw_plasma_rifle(base_col=(50, 60, 75), glow_col=(0, 230, 255), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Sci-fi techno blaster / rifle
    draw.polygon([(CX - 110, CY + 70), (CX + 90, CY - 75), (CX + 125, CY - 50), (CX - 75, CY + 95)], fill=base_col)
    # Glowing plasma rail
    draw.line([(CX - 50, CY + 20), (CX + 110, CY - 65)], fill=glow_col, width=8)
    draw.line([(CX - 45, CY + 18), (CX + 105, CY - 63)], fill=(230, 250, 255, 255), width=3)
    # Grip & stock
    draw.polygon([(CX - 90, CY + 60), (CX - 125, CY + 115), (CX - 95, CY + 130), (CX - 65, CY + 80)], fill=(35, 40, 50, 255))
    img = add_specular_glint(img, CX + 70, CY - 45, size=14)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=190, alpha=95)
    return apply_drop_shadow(img)

# --- ARMOR & GEAR RENDERERS ---

def draw_chest_armor(plate_col=(185, 195, 210), trim_col=(215, 175, 60), cloak=False, aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Cloak behind if applicable
    if cloak:
        draw.polygon([(CX - 130, CY - 60), (CX + 130, CY - 60), (CX + 150, CY + 140), (CX - 150, CY + 140)], fill=(trim_col[0]//2, trim_col[1]//2, trim_col[2]//2, 255))
    # Cuirass / Breastplate
    draw.polygon([
        (CX - 85, CY - 110), (CX + 85, CY - 110),
        (CX + 115, CY - 20), (CX + 80, CY + 115),
        (CX, CY + 135), (CX - 80, CY + 115),
        (CX - 115, CY - 20)
    ], fill=plate_col)
    # Trim & breastplate ridges
    draw.line([(CX - 85, CY - 105), (CX + 85, CY - 105)], fill=trim_col, width=8)
    draw.line([(CX, CY - 90), (CX, CY + 120)], fill=trim_col, width=6)
    draw.arc([CX - 75, CY - 70, CX + 75, CY + 50], 20, 160, fill=trim_col, width=6)
    img = add_specular_glint(img, CX - 35, CY - 40, size=15)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=190, alpha=90)
    return apply_drop_shadow(img)

def draw_shield(face_col=(180, 140, 65), rim_col=(185, 195, 210), boss_col=(215, 175, 60), round_shape=True, aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    if round_shape:
        draw.ellipse([CX - 130, CY - 130, CX + 130, CY + 130], fill=rim_col)
        draw.ellipse([CX - 115, CY - 115, CX + 115, CY + 115], fill=face_col)
        draw.ellipse([CX - 45, CY - 45, CX + 45, CY + 45], fill=boss_col) # center boss
        draw.ellipse([CX - 25, CY - 25, CX + 25, CY + 25], fill=(min(255, boss_col[0]+40), min(255, boss_col[1]+40), min(255, boss_col[2]+40), 255))
    else:
        # Kite shield
        pts = [(CX - 110, CY - 120), (CX + 110, CY - 120), (CX + 95, CY + 20), (CX, CY + 140), (CX - 95, CY + 20)]
        draw.polygon(pts, fill=rim_col)
        pts_in = [(CX - 95, CY - 108), (CX + 95, CY - 108), (CX + 82, CY + 15), (CX, CY + 124), (CX - 82, CY + 15)]
        draw.polygon(pts_in, fill=face_col)
        draw.line([(CX, CY - 105), (CX, CY + 120)], fill=boss_col, width=8)
    img = add_specular_glint(img, CX - 35, CY - 45, size=15)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=190, alpha=90)
    return apply_drop_shadow(img)

def draw_helmet(tier=1, base_col=(180, 190, 205), trim_col=(215, 175, 60), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    if tier == 1:
        # Cloth hood / band
        draw.ellipse([CX - 90, CY - 100, CX + 90, CY + 80], fill=(130, 105, 75, 255))
        draw.ellipse([CX - 65, CY - 45, CX + 65, CY + 65], fill=(30, 25, 20, 255)) # face opening
    elif tier == 2:
        # Leather cap
        draw.ellipse([CX - 100, CY - 110, CX + 100, CY + 60], fill=(110, 75, 45, 255))
        draw.line([(CX - 95, CY), (CX + 95, CY)], fill=(160, 120, 75, 255), width=12)
    elif tier == 3:
        # Iron bascinet
        draw.polygon([(CX - 95, CY + 40), (CX, CY - 125), (CX + 95, CY + 40), (CX + 75, CY + 85), (CX - 75, CY + 85)], fill=base_col)
        draw.line([(CX - 60, CY), (CX + 60, CY)], fill=(30, 35, 40, 255), width=8) # eye slit
    elif tier == 4:
        # Visored knight helm
        draw.polygon([(CX - 105, CY + 50), (CX, CY - 130), (CX + 105, CY + 50), (CX, CY + 110)], fill=base_col)
        draw.polygon([(CX - 75, CY - 15), (CX + 75, CY - 15), (CX, CY + 50)], fill=trim_col)
    elif tier == 5:
        # Crowned close helm
        draw.polygon([(CX - 110, CY + 60), (CX, CY - 130), (CX + 110, CY + 60), (CX, CY + 120)], fill=base_col)
        # Crown crest
        for cx in [-70, -25, 25, 70]:
            draw.polygon([(CX + cx - 18, CY - 110), (CX + cx, CY - 145), (CX + cx + 18, CY - 110)], fill=trim_col)
    elif tier == 6:
        # Radiant angelic Choir helm with wings
        draw.polygon([(CX - 110, CY + 60), (CX, CY - 130), (CX + 110, CY + 60), (CX, CY + 120)], fill=(245, 245, 250, 255))
        # Golden wings on sides
        draw.polygon([(CX - 100, CY - 40), (CX - 170, CY - 110), (CX - 140, CY + 10), (CX - 90, CY)], fill=trim_col)
        draw.polygon([(CX + 100, CY - 40), (CX + 170, CY - 110), (CX + 140, CY + 10), (CX + 90, CY)], fill=trim_col)
    img = add_specular_glint(img, CX - 30, CY - 50, size=15)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=190, alpha=90)
    return apply_drop_shadow(img)

def draw_gloves(tier=1, base_col=(180, 190, 205), trim_col=(215, 175, 60), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Pair of protective gauntlets
    for ox in [-50, 50]:
        draw.rounded_rectangle([CX + ox - 35, CY - 60, CX + ox + 35, CY + 75], radius=14, fill=base_col)
        draw.rounded_rectangle([CX + ox - 40, CY + 30, CX + ox + 40, CY + 95], radius=10, fill=trim_col) # cuff
        # Finger lines
        for fx in range(-20, 25, 12):
            draw.line([(CX + ox + fx, CY - 60), (CX + ox + fx, CY - 20)], fill=(max(0, base_col[0]-40), max(0, base_col[1]-40), max(0, base_col[2]-40), 180), width=3)
    img = add_specular_glint(img, CX - 40, CY - 20, size=12)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=185, alpha=85)
    return apply_drop_shadow(img)

def draw_legs(tier=1, base_col=(180, 190, 205), trim_col=(215, 175, 60), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Armored greaves / leg armor
    draw.polygon([(CX - 85, CY - 100), (CX + 85, CY - 100), (CX + 55, CY + 90), (CX + 15, CY + 90), (CX, CY - 20), (CX - 15, CY + 90), (CX - 55, CY + 90)], fill=base_col)
    # Knee poleyns
    draw.ellipse([CX - 50, CY - 10, CX - 15, CY + 25], fill=trim_col)
    draw.ellipse([CX + 15, CY - 10, CX + 50, CY + 25], fill=trim_col)
    img = add_specular_glint(img, CX - 30, CY + 10, size=12)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=185, alpha=85)
    return apply_drop_shadow(img)

def draw_boots(tier=1, base_col=(180, 190, 205), trim_col=(215, 175, 60), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Pair of boots / sabatons
    for ox, dir in [(-55, -1), (55, 1)]:
        pts = [
            (CX + ox - 25, CY - 70), (CX + ox + 25, CY - 70),
            (CX + ox + 25, CY + 45), (CX + ox + dir*55, CY + 65),
            (CX + ox + dir*55, CY + 80), (CX + ox - 25, CY + 80)
        ]
        draw.polygon(pts, fill=base_col)
        # Cuff / rim
        draw.rounded_rectangle([CX + ox - 28, CY - 75, CX + ox + 28, CY - 50], radius=8, fill=trim_col)
    img = add_specular_glint(img, CX - 50, CY - 20, size=12)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=185, alpha=85)
    return apply_drop_shadow(img)


# --- 113 WEAPONS, ARMORS & GEAR MAPPING ---

WEAPONS_AND_ARMORS = {
    # Starters & Classics
    "potion": lambda: draw_flask((220, 35, 45), shape="round", stopper_col=(180, 140, 90), aura_col=(235, 50, 60)),
    "sword": lambda: draw_sword(blade_col=(220, 230, 245), hilt_col=(185, 145, 60)),
    "vest": lambda: draw_chest_armor(plate_col=(115, 75, 45), trim_col=(160, 120, 75)),
    "shield": lambda: draw_shield(face_col=(140, 95, 50), rim_col=(175, 185, 200), boss_col=(210, 170, 60)),
    
    # Tiered Armor Progression (1 = Apprentice, 2 = Wanderer, 3 = Guardian, 4 = Liaison, 5 = Confidant, 6 = Choir)
    "A-H1": lambda: draw_helmet(tier=1, base_col=(130, 105, 75)),
    "A-H2": lambda: draw_helmet(tier=2, base_col=(110, 75, 45), trim_col=(160, 120, 75)),
    "A-H3": lambda: draw_helmet(tier=3, base_col=(160, 175, 195), trim_col=(120, 135, 155)),
    "A-H4": lambda: draw_helmet(tier=4, base_col=(190, 205, 225), trim_col=(70, 120, 190)),
    "A-H5": lambda: draw_helmet(tier=5, base_col=(215, 225, 240), trim_col=(215, 175, 60), aura_col=(230, 190, 80)),
    "A-H6": lambda: draw_helmet(tier=6, base_col=(245, 248, 255), trim_col=(245, 215, 80), aura_col=(255, 235, 140)),
    
    "A-G1": lambda: draw_gloves(tier=1, base_col=(130, 105, 75), trim_col=(100, 80, 55)),
    "A-G2": lambda: draw_gloves(tier=2, base_col=(115, 80, 50), trim_col=(155, 115, 70)),
    "A-G3": lambda: draw_gloves(tier=3, base_col=(160, 175, 195), trim_col=(120, 135, 155)),
    "A-G4": lambda: draw_gloves(tier=4, base_col=(190, 205, 225), trim_col=(70, 120, 190)),
    "A-G5": lambda: draw_gloves(tier=5, base_col=(215, 225, 240), trim_col=(215, 175, 60), aura_col=(230, 190, 80)),
    "A-G6": lambda: draw_gloves(tier=6, base_col=(245, 248, 255), trim_col=(245, 215, 80), aura_col=(255, 235, 140)),
    
    "A-L1": lambda: draw_legs(tier=1, base_col=(130, 105, 75), trim_col=(100, 80, 55)),
    "A-L2": lambda: draw_legs(tier=2, base_col=(115, 80, 50), trim_col=(155, 115, 70)),
    "A-L3": lambda: draw_legs(tier=3, base_col=(160, 175, 195), trim_col=(120, 135, 155)),
    "A-L4": lambda: draw_legs(tier=4, base_col=(190, 205, 225), trim_col=(70, 120, 190)),
    "A-L5": lambda: draw_legs(tier=5, base_col=(215, 225, 240), trim_col=(215, 175, 60), aura_col=(230, 190, 80)),
    "A-L6": lambda: draw_legs(tier=6, base_col=(245, 248, 255), trim_col=(245, 215, 80), aura_col=(255, 235, 140)),
    
    "A-B1": lambda: draw_boots(tier=1, base_col=(130, 105, 75), trim_col=(100, 80, 55)),
    "A-B2": lambda: draw_boots(tier=2, base_col=(115, 80, 50), trim_col=(155, 115, 70)),
    "A-B3": lambda: draw_boots(tier=3, base_col=(160, 175, 195), trim_col=(120, 135, 155)),
    "A-B4": lambda: draw_boots(tier=4, base_col=(190, 205, 225), trim_col=(70, 120, 190)),
    "A-B5": lambda: draw_boots(tier=5, base_col=(215, 225, 240), trim_col=(215, 175, 60), aura_col=(230, 190, 80)),
    "A-B6": lambda: draw_boots(tier=6, base_col=(245, 248, 255), trim_col=(245, 215, 80), aura_col=(255, 235, 140)),
    
    # Continent Weapons W-V* (Forest)
    "W-V1": lambda: draw_dagger(blade_col=(110, 195, 125), hilt_col=(95, 65, 35)),
    "W-V2": lambda: draw_sword(blade_col=(85, 165, 100), hilt_col=(115, 85, 45)),
    "W-V3": lambda: draw_sword(blade_col=(140, 215, 130), hilt_col=(185, 145, 60), curved=True),
    "W-V4": lambda: draw_axe(head_col=(75, 185, 110), haft_col=(95, 65, 35), aura_col=(70, 210, 100)),
    "W-V5": lambda: draw_axe(head_col=(45, 145, 80), haft_col=(65, 45, 25), double=True, aura_col=(60, 190, 90)),
    "W-V6": lambda: draw_spear(head_col=(80, 225, 130), shaft_col=(105, 75, 40), aura_col=(90, 235, 140)),
    
    # Continent Weapons W-P* (Desert / Fire)
    "W-P1": lambda: draw_dagger(blade_col=(225, 80, 45), hilt_col=(140, 45, 30)),
    "W-P2": lambda: draw_sword(blade_col=(235, 105, 35), hilt_col=(75, 35, 25)),
    "W-P3": lambda: draw_sword(blade_col=(210, 65, 35), hilt_col=(195, 140, 55), curved=True),
    "W-P4": lambda: draw_axe(head_col=(225, 75, 30), haft_col=(75, 40, 30), aura_col=(245, 90, 40)),
    "W-P5": lambda: draw_axe(head_col=(195, 50, 25), haft_col=(55, 30, 20), double=True, aura_col=(230, 70, 30)),
    "W-P6": lambda: draw_spear(head_col=(245, 95, 35), shaft_col=(85, 45, 35), aura_col=(255, 115, 45)),
    
    # Continent Weapons W-A* (Air / Harmonic)
    "W-A1": lambda: draw_dagger(blade_col=(180, 220, 245), hilt_col=(195, 205, 225)),
    "W-A2": lambda: draw_sword(blade_col=(200, 230, 250), hilt_col=(210, 215, 230)),
    "W-A3": lambda: draw_sword(blade_col=(160, 205, 245), hilt_col=(185, 195, 215), curved=True),
    "W-A4": lambda: draw_axe(head_col=(175, 215, 245), haft_col=(145, 155, 175), aura_col=(150, 205, 245)),
    "W-A5": lambda: draw_axe(head_col=(145, 195, 240), haft_col=(125, 135, 155), double=True, aura_col=(130, 185, 240)),
    "W-A6": lambda: draw_spear(head_col=(210, 240, 255), shaft_col=(185, 195, 215), aura_col=(190, 230, 255)),
    
    # Continent Weapons W-N* (North / Techno)
    "W-N1": lambda: draw_dagger(blade_col=(0, 220, 255), hilt_col=(55, 65, 80)),
    "W-N2": lambda: draw_plasma_rifle(base_col=(45, 55, 70), glow_col=(0, 230, 255)),
    "W-N3": lambda: draw_sword(blade_col=(0, 230, 255), hilt_col=(60, 70, 85)),
    "W-N4": lambda: draw_axe(head_col=(45, 55, 70), haft_col=(35, 45, 55), aura_col=(0, 210, 255)),
    "W-N5": lambda: draw_axe(head_col=(0, 215, 255), haft_col=(40, 50, 65), double=True, aura_col=(0, 230, 255)),
    "W-N6": lambda: draw_plasma_rifle(base_col=(65, 75, 95), glow_col=(255, 80, 200), aura_col=(240, 60, 180)),
    
    # Quest Weapons KS-W-* (24 items)
    "KS-W-V1": lambda: draw_sword(blade_col=(140, 110, 75), hilt_col=(110, 80, 45)), # wooden blade
    "KS-W-V2": lambda: draw_sword(blade_col=(120, 200, 220), hilt_col=(140, 110, 60), curved=True),
    "KS-W-V3": lambda: draw_sword(blade_col=(95, 175, 110), hilt_col=(120, 90, 50)),
    "KS-W-V4": lambda: draw_sword(blade_col=(70, 185, 95), hilt_col=(185, 145, 60)),
    "KS-W-V5": lambda: draw_sword(blade_col=(60, 195, 140), hilt_col=(195, 155, 70), aura_col=(50, 215, 150)),
    "KS-W-V6": lambda: draw_sword(blade_col=(45, 215, 110), hilt_col=(215, 175, 60), aura_col=(60, 235, 120)),
    
    "KS-W-P1": lambda: draw_sword(blade_col=(195, 110, 60), hilt_col=(120, 65, 35)),
    "KS-W-P2": lambda: draw_sword(blade_col=(215, 90, 40), hilt_col=(140, 70, 40)),
    "KS-W-P3": lambda: draw_sword(blade_col=(235, 80, 30), hilt_col=(160, 80, 45), curved=True),
    "KS-W-P4": lambda: draw_sword(blade_col=(245, 95, 35), hilt_col=(185, 100, 50)),
    "KS-W-P5": lambda: draw_sword(blade_col=(255, 110, 40), hilt_col=(205, 120, 60), aura_col=(255, 110, 40)),
    "KS-W-P6": lambda: draw_sword(blade_col=(255, 140, 50), hilt_col=(225, 140, 70), aura_col=(255, 150, 50)),
    
    "KS-W-A1": lambda: draw_sword(blade_col=(190, 210, 230), hilt_col=(160, 175, 195)),
    "KS-W-A2": lambda: draw_sword(blade_col=(170, 215, 245), hilt_col=(180, 195, 215)),
    "KS-W-A3": lambda: draw_sword(blade_col=(150, 210, 255), hilt_col=(195, 210, 230), curved=True),
    "KS-W-A4": lambda: draw_sword(blade_col=(130, 200, 255), hilt_col=(210, 220, 240)),
    "KS-W-A5": lambda: draw_sword(blade_col=(110, 190, 255), hilt_col=(220, 230, 250), aura_col=(120, 195, 255)),
    "KS-W-A6": lambda: draw_sword(blade_col=(90, 180, 255), hilt_col=(235, 240, 255), aura_col=(100, 185, 255)),
    
    "KS-W-N1": lambda: draw_plasma_rifle(base_col=(60, 70, 85), glow_col=(0, 180, 220)),
    "KS-W-N2": lambda: draw_plasma_rifle(base_col=(50, 60, 75), glow_col=(0, 210, 245)),
    "KS-W-N3": lambda: draw_plasma_rifle(base_col=(40, 50, 65), glow_col=(0, 235, 255)),
    "KS-W-N4": lambda: draw_plasma_rifle(base_col=(35, 45, 60), glow_col=(80, 245, 255)),
    "KS-W-N5": lambda: draw_plasma_rifle(base_col=(30, 40, 55), glow_col=(140, 250, 255), aura_col=(0, 220, 255)),
    "KS-W-N6": lambda: draw_plasma_rifle(base_col=(25, 35, 50), glow_col=(220, 255, 255), aura_col=(80, 240, 255)),
    
    # Regional Armors A-V*, A-P*, A-A*, A-N*
    "A-V1": lambda: draw_chest_armor(plate_col=(85, 145, 75), trim_col=(115, 175, 95)),
    "A-V2": lambda: draw_chest_armor(plate_col=(95, 70, 45), trim_col=(65, 145, 75)),
    "A-V3": lambda: draw_chest_armor(plate_col=(65, 135, 75), trim_col=(125, 195, 115), cloak=True),
    "A-V4": lambda: draw_chest_armor(plate_col=(110, 80, 50), trim_col=(75, 185, 90), aura_col=(65, 205, 85)),
    "A-V5": lambda: draw_chest_armor(plate_col=(45, 115, 55), trim_col=(215, 175, 60), cloak=True, aura_col=(70, 220, 95)),
    
    "A-P1": lambda: draw_chest_armor(plate_col=(130, 65, 45), trim_col=(160, 85, 55)),
    "A-P2": lambda: draw_chest_armor(plate_col=(160, 60, 35), trim_col=(195, 85, 45)),
    "A-P3": lambda: draw_chest_armor(plate_col=(185, 55, 30), trim_col=(215, 85, 40), cloak=True),
    "A-P4": lambda: draw_chest_armor(plate_col=(75, 45, 40), trim_col=(235, 75, 30), aura_col=(240, 85, 35)),
    "A-P5": lambda: draw_chest_armor(plate_col=(45, 35, 40), trim_col=(255, 115, 40), cloak=True, aura_col=(255, 120, 45)),
    
    "A-A1": lambda: draw_chest_armor(plate_col=(190, 210, 230), trim_col=(155, 185, 215)),
    "A-A2": lambda: draw_chest_armor(plate_col=(170, 205, 235), trim_col=(140, 180, 220)),
    "A-A3": lambda: draw_chest_armor(plate_col=(150, 195, 240), trim_col=(120, 170, 225), cloak=True),
    "A-A4": lambda: draw_chest_armor(plate_col=(195, 220, 245), trim_col=(95, 160, 235), aura_col=(120, 190, 250)),
    "A-A5": lambda: draw_chest_armor(plate_col=(230, 240, 255), trim_col=(215, 185, 75), cloak=True, aura_col=(160, 215, 255)),
    
    "A-N1": lambda: draw_chest_armor(plate_col=(55, 65, 80), trim_col=(0, 180, 220)),
    "A-N2": lambda: draw_chest_armor(plate_col=(45, 55, 70), trim_col=(0, 210, 245)),
    "A-N3": lambda: draw_chest_armor(plate_col=(35, 45, 60), trim_col=(0, 235, 255)),
    "A-N4": lambda: draw_chest_armor(plate_col=(30, 40, 55), trim_col=(80, 245, 255), aura_col=(0, 220, 255)),
    "A-N5": lambda: draw_chest_armor(plate_col=(25, 35, 50), trim_col=(245, 70, 190), aura_col=(230, 60, 180)),
    
    # Tiered Chest Armors A-C*
    "A-C1": lambda: draw_chest_armor(plate_col=(130, 105, 75), trim_col=(100, 80, 55)),
    "A-C2": lambda: draw_chest_armor(plate_col=(115, 80, 50), trim_col=(155, 115, 70)),
    "A-C3": lambda: draw_chest_armor(plate_col=(160, 175, 195), trim_col=(120, 135, 155)),
    "A-C4": lambda: draw_chest_armor(plate_col=(190, 205, 225), trim_col=(70, 120, 190)),
    "A-C5": lambda: draw_chest_armor(plate_col=(215, 225, 240), trim_col=(215, 175, 60), aura_col=(230, 190, 80)),
    "A-C6": lambda: draw_chest_armor(plate_col=(245, 248, 255), trim_col=(245, 215, 80), cloak=True, aura_col=(255, 235, 140)),
    
    # Unique Armors U-A*
    "U-A05": lambda: draw_chest_armor(plate_col=(40, 110, 180), trim_col=(90, 195, 245), aura_col=(60, 170, 240)),
    "U-A06": lambda: draw_chest_armor(plate_col=(120, 95, 150), trim_col=(215, 185, 75), cloak=True, aura_col=(160, 120, 210)),
    "U-A08": lambda: draw_chest_armor(plate_col=(240, 245, 255), trim_col=(255, 215, 60), cloak=True, aura_col=(255, 230, 120)),
    
    # Quest Unique Weapons KS-U-W*
    "KS-U-W01": lambda: draw_dagger(blade_col=(110, 205, 225), hilt_col=(120, 85, 50), aura_col=(80, 190, 215)),
    "KS-U-W02": lambda: draw_spear(head_col=(245, 235, 210), shaft_col=(130, 95, 55), aura_col=(210, 185, 130)),
    "KS-U-W03": lambda: draw_plasma_rifle(base_col=(65, 75, 90), glow_col=(245, 180, 40), aura_col=(230, 160, 30)),
    "KS-U-W04": lambda: draw_sword(blade_col=(70, 215, 255), hilt_col=(185, 145, 60), aura_col=(50, 205, 250)),
    "KS-U-W05": lambda: draw_axe(head_col=(60, 125, 190), haft_col=(95, 65, 35), aura_col=(70, 150, 220)),
    "KS-U-W06": lambda: draw_dagger(blade_col=(230, 215, 185), hilt_col=(195, 155, 65), aura_col=(215, 195, 140)),
    "KS-U-W07": lambda: draw_sword(blade_col=(220, 45, 55), hilt_col=(65, 45, 40), aura_col=(210, 50, 60)),
    "KS-U-W08": lambda: draw_spear(head_col=(255, 210, 80), shaft_col=(160, 120, 60), aura_col=(255, 220, 100)),
}

def build_all_weapons_and_armors():
    print(f"Generating Batch 3: {len(WEAPONS_AND_ARMORS)} Weapons, Armors & Equipment...")
    
    # 11 columns x 11 rows for contact sheet
    cols, rows = 11, 11
    cell_w, cell_h = 136, 150
    contact = Image.new("RGBA", (cols * cell_w + 40, rows * cell_h + 60), (18, 22, 28, 255))
    draw_c = ImageDraw.Draw(contact)
    draw_c.text((25, 18), "KI LEGENDS — BATCH 3: WEAPONS, ARMORS & GEAR (113 ITEMS - 100% CATALOG)", fill=(240, 220, 160, 255))
    
    idx = 0
    for item_id, gen_fn in WEAPONS_AND_ARMORS.items():
        master = gen_fn()
        
        # Save master 512x512 PNG
        master_path = MASTERS_DIR / f"{item_id}.png"
        master.save(master_path, "PNG")
        
        # Resample Lanczos to 128x128 RGBA WebP
        icon_128 = master.resize((128, 128), Image.Resampling.LANCZOS)
        out_webp = PUBLIC_DIR / f"{item_id}.webp"
        icon_128.save(out_webp, "WEBP", quality=95)
        
        # Contact sheet
        col = idx % cols
        row = idx // cols
        px = 25 + col * cell_w
        py = 55 + row * cell_h
        
        draw_c.rounded_rectangle([px, py, px + 128, py + 128], radius=6, fill=(30, 36, 46, 255), outline=(55, 65, 80, 255), width=1)
        contact.alpha_composite(icon_128, (px, py))
        label = item_id[:16]
        draw_c.text((px + 6, py + 130), label, fill=(200, 215, 230, 255))
        idx += 1
        
    contact_path = QA_DIR / "review_batch3_weapons_and_armors.png"
    contact.save(contact_path, "PNG")
    print(f"\nSUCCESS! 113/113 weapons and armors generated.")
    print(f"QA Contact Sheet: {contact_path}")

if __name__ == "__main__":
    build_all_weapons_and_armors()
