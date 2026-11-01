#!/usr/bin/env python3
"""Procedural high-res icon synthesis for 86 Monster & Crafting Materials.
Generates master 512x512 PNGs, scales to 128x128 WebP with alpha transparency,
and builds an 8x11 contact review sheet.
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

S = 512
CX, CY = S // 2, S // 2

def create_canvas():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))

def add_radial_aura(img, color, radius=185, alpha=85):
    aura = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(aura)
    r, g, b = color[:3]
    for rad in range(radius, 0, -8):
        factor = 1.0 - (rad / radius)
        a = int(alpha * (factor ** 1.8))
        draw.ellipse([CX - rad, CY - rad, CX + rad, CY + rad], fill=(r, g, b, a))
    aura = aura.filter(ImageFilter.GaussianBlur(radius=14))
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

# --- PARAMETRIC GENERATORS ---

def draw_tusk(bone_col=(245, 235, 215), blood_tip=False, aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Curved tusk / horn silhouette
    pts = []
    # Outer curve
    for t in np.linspace(0, 1, 25):
        ang = 0.6 + t * 1.5
        r = 170 - t * 140
        pts.append((CX - int(math.cos(ang) * r) - 40, CY + int(math.sin(ang) * r) + 50))
    # Inner curve
    for t in np.linspace(1, 0, 25):
        ang = 0.6 + t * 1.3
        r = 135 - t * 135
        pts.append((CX - int(math.cos(ang) * r) - 40, CY + int(math.sin(ang) * r) + 40))
        
    draw.polygon(pts, fill=bone_col)
    # Shading ridges
    draw.line([(CX + 50, CY - 90), (CX - 70, CY + 140)], fill=(bone_col[0]-35, bone_col[1]-35, bone_col[2]-35, 180), width=6)
    if blood_tip:
        draw.polygon(pts[-8:] + pts[:3], fill=(185, 30, 40, 220))
    img = add_specular_glint(img, CX + 35, CY - 80, size=12)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=180, alpha=85)
    return apply_drop_shadow(img)

def draw_claws(claw_col=(45, 45, 55), gold_trim=False, aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # 3 predatory curved talons
    for ox, oy, scale in [(-50, 20, 0.85), (0, -20, 1.0), (50, 30, 0.85)]:
        pts = [
            (CX + ox - 20*scale, CY + oy + 90*scale),
            (CX + ox + 20*scale, CY + oy + 90*scale),
            (CX + ox + 30*scale, CY + oy),
            (CX + ox - 10*scale, CY + oy - 80*scale),
            (CX + ox - 25*scale, CY + oy)
        ]
        draw.polygon(pts, fill=claw_col)
        # Highlight edge
        draw.line([(CX + ox - 25*scale, CY + oy), (CX + ox - 10*scale, CY + oy - 80*scale)], fill=(min(255, claw_col[0]+80), min(255, claw_col[1]+80), min(255, claw_col[2]+80), 240), width=4)
        if gold_trim:
            draw.line([(CX + ox - 18*scale, CY + oy + 80*scale), (CX + ox + 18*scale, CY + oy + 80*scale)], fill=(225, 185, 60, 255), width=8)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=190, alpha=90)
    return apply_drop_shadow(img)

def draw_pelt(pelt_col=(135, 90, 55), pattern_col=None, folded=True, aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Rolled/folded pelt bundle
    draw.rounded_rectangle([CX - 130, CY - 75, CX + 130, CY + 85], radius=28, fill=pelt_col)
    draw.rounded_rectangle([CX - 120, CY - 65, CX + 120, CY + 75], radius=24, fill=(min(255, pelt_col[0]+30), min(255, pelt_col[1]+30), min(255, pelt_col[2]+30), 255))
    # Fur fringe on edges
    for fx in range(CX - 125, CX + 125, 12):
        draw.line([(fx, CY + 75), (fx + np.random.randint(-4, 4), CY + 95)], fill=(max(0, pelt_col[0]-30), max(0, pelt_col[1]-30), max(0, pelt_col[2]-30), 220), width=4)
    # Straps tying bundle
    for sx in [CX - 60, CX + 60]:
        draw.line([(sx, CY - 75), (sx, CY + 85)], fill=(65, 45, 25, 255), width=14)
        draw.line([(sx - 2, CY - 75), (sx - 2, CY + 85)], fill=(120, 85, 45, 255), width=4)
    if pattern_col:
        for px in [-30, 0, 30]:
            draw.ellipse([CX + px - 10, CY - 15, CX + px + 10, CY + 15], fill=pattern_col)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=180, alpha=85)
    return apply_drop_shadow(img)

def draw_scale(scale_col=(60, 160, 100), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Shield-like reptilian scale with iridescent ridge
    pts = [(CX, CY - 130), (CX + 110, CY - 40), (CX + 70, CY + 120), (CX, CY + 140), (CX - 70, CY + 120), (CX - 110, CY - 40)]
    draw.polygon(pts, fill=scale_col)
    # Center ridge
    draw.line([(CX, CY - 125), (CX, CY + 135)], fill=(min(255, scale_col[0]+60), min(255, scale_col[1]+60), min(255, scale_col[2]+60), 255), width=8)
    # Lateral ridges
    for off in [-60, -20, 20, 60]:
        draw.line([(CX, CY + off), (CX + 75, CY + off + 30)], fill=(min(255, scale_col[0]+40), min(255, scale_col[1]+40), min(255, scale_col[2]+40), 200), width=4)
        draw.line([(CX, CY + off), (CX - 75, CY + off + 30)], fill=(max(0, scale_col[0]-40), max(0, scale_col[1]-40), max(0, scale_col[2]-40), 200), width=4)
    img = add_specular_glint(img, CX - 25, CY - 60, size=14)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=185, alpha=90)
    return apply_drop_shadow(img)

def draw_feather(feather_col=(225, 235, 245), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Diagonal feather quill & vane
    draw.line([(CX - 110, CY + 130), (CX + 110, CY - 130)], fill=(240, 240, 230, 255), width=6) # shaft
    # Vanes (left and right)
    for t in np.linspace(0.1, 0.9, 35):
        qx = CX - 110 + int(t * 220)
        qy = CY + 130 - int(t * 260)
        w = int(math.sin(t * math.pi) * 75)
        draw.line([(qx, qy), (qx - w, qy + int(w*0.5))], fill=feather_col, width=4)
        draw.line([(qx, qy), (qx + int(w*0.7), qy - int(w*0.4))], fill=(min(255, feather_col[0]+30), min(255, feather_col[1]+30), min(255, feather_col[2]+30), 240), width=4)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=180, alpha=85)
    return apply_drop_shadow(img)

def draw_wing(membrane_col=(210, 65, 45), bone_col=(60, 45, 35), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Bat/Dragon wing structure
    pts = [(CX - 110, CY + 90), (CX - 30, CY - 110), (CX + 80, CY - 80), (CX + 130, CY - 20), (CX + 90, CY + 60), (CX + 20, CY + 40), (CX - 40, CY + 80)]
    draw.polygon(pts, fill=membrane_col)
    # Bone struts
    draw.line([(CX - 110, CY + 90), (CX - 30, CY - 110)], fill=bone_col, width=14)
    draw.line([(CX - 30, CY - 110), (CX + 80, CY - 80)], fill=bone_col, width=10)
    draw.line([(CX - 30, CY - 110), (CX + 130, CY - 20)], fill=bone_col, width=8)
    draw.line([(CX - 30, CY - 110), (CX + 20, CY + 40)], fill=bone_col, width=8)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=185, alpha=90)
    return apply_drop_shadow(img)

def draw_crystal(gem_col=(65, 175, 235), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Faceted crystal cluster
    gr, gg, gb = gem_col[:3]
    # Main upright obelisk
    draw.polygon([(CX, CY - 140), (CX + 60, CY - 50), (CX + 50, CY + 110), (CX - 50, CY + 110), (CX - 60, CY - 50)], fill=(gr, gg, gb, 255))
    # Facets
    draw.polygon([(CX, CY - 140), (CX, CY + 110), (CX - 50, CY + 110), (CX - 60, CY - 50)], fill=(min(255, gr+50), min(255, gg+50), min(255, gb+50), 230))
    draw.polygon([(CX, CY - 140), (CX + 60, CY - 50), (CX, CY - 50)], fill=(255, 255, 255, 180))
    # Secondary smaller crystal
    draw.polygon([(CX - 40, CY - 10), (CX - 85, CY + 40), (CX - 75, CY + 120), (CX - 35, CY + 120)], fill=(max(0, gr-40), max(0, gg-40), max(0, gb-40), 255))
    img = add_specular_glint(img, CX - 15, CY - 80, size=15)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=190, alpha=95)
    return apply_drop_shadow(img)

def draw_orb_essence(inner_col=(255, 140, 30), outer_col=(255, 60, 20), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    # Swirling magical core sphere
    orb = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d_o = ImageDraw.Draw(orb)
    d_o.ellipse([CX - 120, CY - 120, CX + 120, CY + 120], fill=outer_col)
    d_o.ellipse([CX - 90, CY - 90, CX + 90, CY + 90], fill=inner_col)
    d_o.ellipse([CX - 55, CY - 55, CX + 55, CY + 55], fill=(255, 255, 255, 230))
    orb = orb.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, orb)
    
    # Swirling tendrils
    draw = ImageDraw.Draw(img)
    for ang in [0.5, 2.1, 3.8, 5.2]:
        draw.arc([CX - 130, CY - 130, CX + 130, CY + 130], int(ang*57), int((ang+1.4)*57), fill=(255, 255, 255, 210), width=6)
    img = add_specular_glint(img, CX - 40, CY - 40, size=16)
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=200, alpha=100)
    return apply_drop_shadow(img)

def draw_tech_gear(gear_type="circuit", base_col=(60, 75, 90), glow_col=(0, 220, 255), aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    
    if gear_type == "circuit":
        # Green/Black PCB wafer with gold traces & microchip
        draw.rounded_rectangle([CX - 110, CY - 110, CX + 110, CY + 110], radius=16, fill=(35, 65, 45, 255))
        # Gold traces
        for off in [-70, -30, 30, 70]:
            draw.line([(CX + off, CY - 95), (CX + off, CY - 50), (CX + off + 15, CY - 35)], fill=(215, 175, 60, 255), width=4)
            draw.line([(CX + off, CY + 95), (CX + off, CY + 50), (CX + off - 15, CY + 35)], fill=(215, 175, 60, 255), width=4)
        # Center square processor
        draw.rounded_rectangle([CX - 45, CY - 45, CX + 45, CY + 45], radius=6, fill=(25, 30, 35, 255))
        draw.ellipse([CX - 12, CY - 12, CX + 12, CY + 12], fill=glow_col)
    elif gear_type == "coil":
        # Copper induction coil around iron spool
        draw.rectangle([CX - 80, CY - 40, CX + 80, CY + 40], fill=(70, 75, 85, 255)) # core
        for cx in range(CX - 70, CX + 75, 14):
            draw.ellipse([cx - 6, CY - 65, cx + 6, CY + 65], outline=(225, 125, 45, 255), width=8) # copper wire
    elif gear_type == "core":
        # Glowing reactor core cylinder with magnetic rings
        draw.rounded_rectangle([CX - 75, CY - 110, CX + 75, CY + 110], radius=24, fill=(45, 55, 70, 255))
        draw.ellipse([CX - 60, CY - 50, CX + 60, CY + 50], fill=glow_col)
        # Containment rings
        for ry in [CY - 70, CY, CY + 70]:
            draw.line([(CX - 85, ry), (CX + 85, ry)], fill=(180, 195, 215, 255), width=8)
    elif gear_type == "plate":
        # Heavy titanium armor plate with bevels & bolt holes
        draw.polygon([(CX - 120, CY - 80), (CX + 120, CY - 80), (CX + 90, CY + 100), (CX - 90, CY + 100)], fill=(95, 105, 120, 255))
        draw.polygon([(CX - 110, CY - 70), (CX + 110, CY - 70), (CX + 82, CY + 90), (CX - 82, CY + 90)], fill=(130, 145, 165, 255))
        for bx, by in [(-85, -55), (85, -55), (-65, 70), (65, 70)]:
            draw.ellipse([CX + bx - 6, CY + by - 6, CX + bx + 6, CY + by + 6], fill=(50, 55, 65, 255))
    elif gear_type == "piston":
        # Hydraulic piston actuator
        draw.rectangle([CX - 35, CY - 110, CX + 35, CY + 20], fill=(225, 235, 245, 255)) # chrome rod
        draw.rounded_rectangle([CX - 55, CY + 10, CX + 55, CY + 120], radius=14, fill=(55, 65, 75, 255)) # casing
        draw.ellipse([CX - 20, CY + 110, CX + 20, CY + 140], outline=(180, 190, 205, 255), width=8) # mount eye
        
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=185, alpha=90)
    img = add_specular_glint(img, CX - 30, CY - 40, size=14)
    return apply_drop_shadow(img)

def draw_plant_herb(stem_col=(65, 150, 75), flower_col=None, mushroom=False, aura_col=None):
    img = create_canvas()
    draw = ImageDraw.Draw(img)
    if mushroom:
        # Red spotted forest mushroom
        # Stem
        draw.rounded_rectangle([CX - 30, CY - 10, CX + 30, CY + 120], radius=15, fill=(235, 230, 215, 255))
        # Cap
        draw.ellipse([CX - 110, CY - 100, CX + 110, CY + 20], fill=(215, 45, 45, 255))
        draw.ellipse([CX - 90, CY - 90, CX + 90, CY], fill=(235, 65, 65, 255))
        # White spots
        for sx, sy, sr in [(-45, -45, 14), (0, -65, 18), (55, -40, 15), (-15, -20, 11), (35, -20, 12)]:
            draw.ellipse([CX + sx - sr, CY + sy - sr, CX + sx + sr, CY + sy + sr], fill=(255, 250, 245, 240))
    else:
        # Triple leaf herbal sprig
        draw.line([(CX, CY + 110), (CX, CY - 20)], fill=stem_col, width=12)
        # Left leaf
        draw.polygon([(CX, CY + 40), (CX - 75, CY + 20), (CX - 100, CY - 30), (CX - 30, CY - 20)], fill=(stem_col[0]+20, stem_col[1]+30, stem_col[2]+20, 255))
        # Right leaf
        draw.polygon([(CX, CY + 20), (CX + 75, CY), (CX + 100, CY - 50), (CX + 30, CY - 40)], fill=(stem_col[0]+30, stem_col[1]+40, stem_col[2]+30, 255))
        # Center top leaf
        draw.polygon([(CX - 30, CY - 20), (CX, CY - 110), (CX + 30, CY - 20), (CX, CY + 10)], fill=(stem_col[0]+40, stem_col[1]+50, stem_col[2]+40, 255))
        if flower_col:
            # Blossom
            draw.ellipse([CX - 35, CY - 120, CX + 35, CY - 50], fill=flower_col)
            draw.ellipse([CX - 15, CY - 95, CX + 15, CY - 65], fill=(255, 240, 120, 255))
            
    if aura_col:
        img = add_radial_aura(img, aura_col, radius=180, alpha=85)
    return apply_drop_shadow(img)


# --- 86 MATERIALS MAPPING ---

MATERIALS = {
    "tusk": lambda: draw_tusk(bone_col=(240, 230, 210)),
    "mchowa-galaretka": lambda: draw_orb_essence(inner_col=(90, 210, 110), outer_col=(40, 140, 60), aura_col=(60, 200, 80)),
    "zielone-ziele": lambda: draw_plant_herb(stem_col=(50, 140, 60)),
    "ciern-wilka": lambda: draw_tusk(bone_col=(180, 175, 170)),
    "skora-wilcza": lambda: draw_pelt(pelt_col=(110, 100, 90)),
    "sok-lisciaka": lambda: draw_orb_essence(inner_col=(120, 230, 90), outer_col=(45, 150, 45)),
    "zielone-ostrze": lambda: draw_plant_herb(stem_col=(60, 180, 80)),
    "zywy-korzen": lambda: draw_plant_herb(stem_col=(115, 80, 40)),
    "czerwony-grzyb": lambda: draw_plant_herb(mushroom=True),
    "zarodniki": lambda: draw_orb_essence(inner_col=(235, 180, 70), outer_col=(160, 110, 30)),
    "bursztyn": lambda: draw_crystal(gem_col=(235, 155, 30), aura_col=(255, 175, 40)),
    "zadlo-osy": lambda: draw_tusk(bone_col=(210, 170, 30), blood_tip=True),
    "poroze": lambda: draw_tusk(bone_col=(160, 125, 75)),
    "skalna-skora": lambda: draw_pelt(pelt_col=(110, 115, 125)),
    "jedwab-pajaka": lambda: draw_orb_essence(inner_col=(245, 245, 250), outer_col=(180, 190, 205)),
    "jad": lambda: draw_orb_essence(inner_col=(140, 240, 50), outer_col=(60, 160, 30), aura_col=(120, 230, 40)),
    "pioro-puchacza": lambda: draw_feather(feather_col=(145, 125, 100)),
    "pyl": lambda: draw_orb_essence(inner_col=(210, 215, 220), outer_col=(140, 145, 155)),
    "fragment-ruin": lambda: draw_tech_gear(gear_type='plate', base_col=(120, 110, 100)),
    "kamien-runiczny": lambda: draw_crystal(gem_col=(70, 160, 225), aura_col=(50, 150, 240)),
    "serce-puszczy": lambda: draw_orb_essence(inner_col=(75, 235, 120), outer_col=(25, 140, 50), aura_col=(60, 225, 90)),
    "zielona-esencja": lambda: draw_orb_essence(inner_col=(95, 240, 115), outer_col=(40, 160, 60), aura_col=(70, 230, 80)),
    "kwiat-ygdrashy": lambda: draw_plant_herb(stem_col=(70, 170, 80), flower_col=(255, 130, 200), aura_col=(255, 150, 220)),
    "kiel-alfy": lambda: draw_tusk(bone_col=(245, 240, 230), blood_tip=True, aura_col=(200, 40, 50)),
    "skora-thorgara": lambda: draw_pelt(pelt_col=(65, 45, 40), aura_col=(180, 50, 40)),
    "pazury-alfy": lambda: draw_claws(claw_col=(35, 30, 35), gold_trim=True, aura_col=(220, 50, 50)),
    "wegiel": lambda: draw_crystal(gem_col=(45, 45, 50)),
    "esencja-plomienia": lambda: draw_orb_essence(inner_col=(255, 150, 40), outer_col=(220, 50, 20), aura_col=(255, 90, 30)),
    "luska-salamandry": lambda: draw_scale(scale_col=(210, 75, 35)),
    "popielne-futro": lambda: draw_pelt(pelt_col=(140, 140, 145)),
    "skalny-kastet": lambda: draw_claws(claw_col=(115, 120, 125)),
    "magmowy-pancerz": lambda: draw_scale(scale_col=(180, 60, 30), aura_col=(240, 80, 30)),
    "skrzydlo-zaru": lambda: draw_wing(membrane_col=(220, 75, 35), bone_col=(75, 45, 35), aura_col=(245, 90, 30)),
    "golem-ruin": lambda: draw_tech_gear(gear_type='core', glow_col=(255, 120, 30), aura_col=(240, 100, 30)),
    "plomien-duch": lambda: draw_orb_essence(inner_col=(140, 200, 255), outer_col=(60, 100, 220), aura_col=(90, 140, 255)),
    "rog-areny": lambda: draw_tusk(bone_col=(195, 140, 65), aura_col=(220, 150, 50)),
    "szklo-obsydianowe": lambda: draw_crystal(gem_col=(55, 50, 70)),
    "obsydian": lambda: draw_crystal(gem_col=(35, 35, 45), aura_col=(110, 70, 150)),
    "pancerz-kharzula": lambda: draw_tech_gear(gear_type='plate', base_col=(150, 50, 40), aura_col=(210, 60, 40)),
    "plomien-areny": lambda: draw_orb_essence(inner_col=(255, 175, 50), outer_col=(235, 60, 20), aura_col=(255, 110, 30)),
    "serce-wulkanu": lambda: draw_orb_essence(inner_col=(255, 230, 100), outer_col=(240, 40, 20), aura_col=(255, 140, 40)),
    "luska-pyrrhaxa": lambda: draw_scale(scale_col=(225, 45, 35), aura_col=(255, 60, 40)),
    "pyl-swiatla": lambda: draw_orb_essence(inner_col=(255, 250, 220), outer_col=(235, 215, 130), aura_col=(255, 230, 120)),
    "karta-pergaminu": lambda: draw_tech_gear(gear_type='plate', base_col=(230, 215, 185)),
    "eter-bibliotekarza": lambda: draw_orb_essence(inner_col=(160, 215, 255), outer_col=(70, 120, 210), aura_col=(110, 160, 240)),
    "kamien-swiatynny": lambda: draw_crystal(gem_col=(215, 205, 175)),
    "nic-eteru": lambda: draw_tech_gear(gear_type='coil', glow_col=(140, 210, 255)),
    "szmaragdowa-luska": lambda: draw_scale(scale_col=(45, 175, 95), aura_col=(60, 215, 110)),
    "skarabeusz": lambda: draw_tech_gear(gear_type='circuit', base_col=(215, 175, 60), glow_col=(255, 220, 70), aura_col=(245, 195, 60)),
    "soczewka-wiedzy": lambda: draw_orb_essence(inner_col=(110, 205, 245), outer_col=(45, 110, 195), aura_col=(70, 160, 235)),
    "maska-rytualu": lambda: draw_pelt(pelt_col=(195, 160, 95), aura_col=(215, 175, 80)),
    "pioro-mgly": lambda: draw_feather(feather_col=(190, 220, 240), aura_col=(150, 205, 235)),
    "szaty-arcykaplana": lambda: draw_pelt(pelt_col=(230, 220, 200), aura_col=(215, 185, 75)),
    "eter-pustki": lambda: draw_orb_essence(inner_col=(190, 110, 245), outer_col=(85, 35, 160), aura_col=(160, 75, 235)),
    "pieczec-arcykaplana": lambda: draw_tech_gear(gear_type='core', glow_col=(245, 205, 65), aura_col=(245, 190, 50)),
    "luska-aurelitha": lambda: draw_scale(scale_col=(235, 195, 70), aura_col=(255, 215, 80)),
    "serce-sanktuarium": lambda: draw_orb_essence(inner_col=(255, 245, 180), outer_col=(215, 175, 55), aura_col=(255, 220, 80)),
    "zlom": lambda: draw_tech_gear(gear_type='plate', base_col=(115, 125, 135)),
    "cewka": lambda: draw_tech_gear(gear_type='coil'),
    "nanopyl": lambda: draw_orb_essence(inner_col=(90, 225, 245), outer_col=(35, 115, 175), aura_col=(60, 190, 220)),
    "czujnik": lambda: draw_tech_gear(gear_type='circuit', glow_col=(240, 50, 50)),
    "silownik": lambda: draw_tech_gear(gear_type='piston'),
    "elektroda": lambda: draw_tech_gear(gear_type='piston', glow_col=(220, 240, 255)),
    "lufa": lambda: draw_tech_gear(gear_type='piston', glow_col=(90, 100, 115)),
    "plyta-pancerna": lambda: draw_tech_gear(gear_type='plate'),
    "rdzen-energii": lambda: draw_tech_gear(gear_type='core', glow_col=(0, 225, 255), aura_col=(0, 190, 245)),
    "pamiec-danych": lambda: draw_tech_gear(gear_type='circuit', glow_col=(120, 180, 255)),
    "rdzen-plazmy": lambda: draw_tech_gear(gear_type='core', glow_col=(245, 75, 215), aura_col=(220, 50, 190)),
    "modul-optyczny": lambda: draw_orb_essence(inner_col=(100, 235, 255), outer_col=(40, 130, 210)),
    "kruk-danych": lambda: draw_tech_gear(gear_type='circuit', glow_col=(245, 190, 50), aura_col=(230, 175, 40)),
    "kod-arbitra": lambda: draw_tech_gear(gear_type='circuit', glow_col=(255, 80, 70), aura_col=(240, 50, 40)),
    "plyta-egzekutora": lambda: draw_tech_gear(gear_type='plate', base_col=(45, 50, 60), aura_col=(210, 45, 45)),
    "rdzen-hydry": lambda: draw_tech_gear(gear_type='core', glow_col=(140, 75, 245), aura_col=(125, 50, 230)),
    "modul-prime": lambda: draw_tech_gear(gear_type='circuit', glow_col=(255, 215, 60), aura_col=(240, 195, 40)),
    "R-01": lambda: draw_tech_gear(gear_type='plate', base_col=(145, 110, 75)),
    "R-02": lambda: draw_plant_herb(stem_col=(110, 75, 35), aura_col=(90, 160, 65)),
    "R-03": lambda: draw_orb_essence(inner_col=(215, 60, 50), outer_col=(140, 30, 25)),
    "R-04": lambda: draw_tech_gear(gear_type='coil', glow_col=(240, 195, 60)),
    "R-05": lambda: draw_tech_gear(gear_type='plate', base_col=(170, 185, 205), aura_col=(160, 180, 220)),
    "R-06": lambda: draw_orb_essence(inner_col=(255, 230, 120), outer_col=(215, 165, 45), aura_col=(255, 210, 70)),
    "nasiona": lambda: draw_plant_herb(stem_col=(130, 95, 45)),
    "skrzydlo-krysztalowe": lambda: draw_wing(membrane_col=(120, 215, 255), bone_col=(180, 230, 255), aura_col=(100, 200, 255)),
    "zloty-pancerz": lambda: draw_scale(scale_col=(225, 185, 60), aura_col=(245, 200, 70)),
    "zestaw-naprawczy": lambda: draw_tech_gear(gear_type='plate', base_col=(95, 115, 135)),
    "gasienica": lambda: draw_tech_gear(gear_type='coil', glow_col=(110, 125, 140)),
    "soczewka": lambda: draw_orb_essence(inner_col=(130, 220, 245), outer_col=(50, 120, 185)),
}

def build_all_materials():
    print(f"Generating Batch 2: {len(MATERIALS)} Monster & Crafting Materials...")
    
    # 10 columns x 9 rows for contact sheet
    cols, rows = 10, 9
    cell_w, cell_h = 136, 150
    contact = Image.new("RGBA", (cols * cell_w + 40, rows * cell_h + 60), (18, 22, 28, 255))
    draw_c = ImageDraw.Draw(contact)
    draw_c.text((25, 18), "KI LEGENDS — BATCH 2: MONSTER & CRAFTING MATERIALS (86 ITEMS)", fill=(240, 220, 160, 255))
    
    idx = 0
    for item_id, gen_fn in MATERIALS.items():
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
        
    contact_path = QA_DIR / "review_batch2_materials.png"
    contact.save(contact_path, "PNG")
    print(f"\nSUCCESS! 86/86 materials generated.")
    print(f"QA Contact Sheet: {contact_path}")

if __name__ == "__main__":
    build_all_materials()
