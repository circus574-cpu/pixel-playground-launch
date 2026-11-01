#!/usr/bin/env python3
"""Painterly High-Fidelity Synthesis for the 6 Ki Legends Bosses.
Applies volumetric shading, surface texturing (fur, bark, basalt, brushed metal),
bevel highlights, and ambient illumination so they match Aurelith & Arcykapłan.
"""

import math
import os
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops

ROOT = Path(__file__).resolve().parents[2]
MASTERS_DIR = ROOT / "art" / "production" / "bosses" / "masters"
PUBLIC_DIR = ROOT / "public" / "game" / "bosses"
MASTERS_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

W, H = 640, 780
CX, CY = W // 2, 380

def create_layer():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))

def draw_shaded_poly(img, pts, base_col, highlight_col, shadow_col, stroke_col=None):
    """Renders a polygon with top-down directional lighting and beveled edge."""
    d = ImageDraw.Draw(img)
    # 1. Base
    d.polygon(pts, fill=base_col)
    
    # 2. Shading layer
    min_x = int(math.floor(min(p[0] for p in pts)))
    max_x = int(math.ceil(max(p[0] for p in pts)))
    min_y = int(math.floor(min(p[1] for p in pts)))
    max_y = int(math.ceil(max(p[1] for p in pts)))
    h = max(1, max_y - min_y)
    
    # Gradient overlay via mask
    mask = Image.new("L", (W, H), 0)
    d_m = ImageDraw.Draw(mask)
    d_m.polygon(pts, fill=255)
    
    grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d_g = ImageDraw.Draw(grad)
    for y in range(min_y, max_y + 1):
        ratio = (y - min_y) / float(h)
        if ratio < 0.35: # Highlight zone
            alpha = int((1.0 - ratio / 0.35) * 110)
            d_g.line([(min_x, y), (max_x, y)], fill=(highlight_col[0], highlight_col[1], highlight_col[2], alpha))
        elif ratio > 0.6: # Shadow zone
            alpha = int(((ratio - 0.6) / 0.4) * 130)
            d_g.line([(min_x, y), (max_x, y)], fill=(shadow_col[0], shadow_col[1], shadow_col[2], alpha))
            
    grad = Image.composite(grad, Image.new("RGBA", (W, H), (0, 0, 0, 0)), mask)
    img = Image.alpha_composite(img, grad)
    
    # 3. Stroke outline
    if stroke_col:
        d_final = ImageDraw.Draw(img)
        d_final.polygon(pts, outline=stroke_col)
    return img

def draw_shaded_limb(img, p1, p2, r1, r2, base_col, highlight_col, shadow_col):
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    dist = math.hypot(dx, dy)
    if dist < 1e-4:
        return img
    nx = -dy / dist
    ny = dx / dist
    poly = [
        (p1[0] + nx * r1, p1[1] + ny * r1),
        (p2[0] + nx * r2, p2[1] + ny * r2),
        (p2[0] - nx * r2, p2[1] - ny * r2),
        (p1[0] - nx * r1, p1[1] - ny * r1),
    ]
    img = draw_shaded_poly(img, poly, base_col, highlight_col, shadow_col, stroke_col=(shadow_col[0]//2, shadow_col[1]//2, shadow_col[2]//2, 255))
    d = ImageDraw.Draw(img)
    d.ellipse([int(p1[0] - r1), int(p1[1] - r1), int(p1[0] + r1), int(p1[1] + r1)], fill=base_col)
    d.ellipse([int(p2[0] - r2), int(p2[1] - r2), int(p2[0] + r2), int(p2[1] + r2)], fill=base_col)
    return img

def create_shadow(sw=380, sh=85, alpha=200, color=(15, 20, 30)):
    shadow = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    d.ellipse([10, 8, sw - 10, sh - 8], fill=(color[0], color[1], color[2], alpha))
    return shadow.filter(ImageFilter.GaussianBlur(14))

# =========================================================================
# 1. YGDRASHA, MATKA PUSZCZY (Verdant Lv 15)
# =========================================================================
def render_ygdrasha():
    print("Rendering Painterly Ygdrasha, Matka Puszczy...")
    img = create_layer()

    # Forest aura
    aura = create_layer()
    d_aura = ImageDraw.Draw(aura)
    d_aura.ellipse([CX - 240, CY - 240, CX + 240, CY + 240], fill=(20, 80, 45, 60))
    d_aura.ellipse([CX - 160, CY - 200, CX + 160, CY + 200], fill=(70, 180, 85, 80))
    aura = aura.filter(ImageFilter.GaussianBlur(30))
    img = Image.alpha_composite(img, aura)

    # 1. Background Root Buttresses
    root_dark = (35, 25, 18)
    root_mid = (65, 48, 32)
    root_light = (110, 85, 55)
    
    for ang, length in [(-1.0, 230), (1.0, 230), (-1.3, 190), (1.3, 190), (-0.6, 210), (0.6, 210)]:
        bx = CX + int(math.sin(ang) * 90)
        by = CY + 120
        tx = CX + int(math.sin(ang) * length)
        ty = CY + 270
        img = draw_shaded_limb(img, (bx, by), (tx, ty), 36, 12, root_mid, root_light, root_dark)

    # 2. Main Hollow Ancient Ironwood Trunk
    trunk_poly = [
        (CX - 120, CY + 270),
        (CX - 90, CY + 110),
        (CX - 55, CY - 25),
        (CX + 55, CY - 25),
        (CX + 90, CY + 110),
        (CX + 120, CY + 270),
        (CX + 75, CY + 285),
        (CX, CY + 275),
        (CX - 75, CY + 285),
    ]
    img = draw_shaded_poly(img, trunk_poly, root_mid, root_light, root_dark, stroke_col=(25, 18, 12, 255))
    
    # Painted Bark Texture & Ridges
    d = ImageDraw.Draw(img)
    for ry in range(CY - 15, CY + 250, 14):
        # Curving wooden ridges
        d.arc([CX - 80, ry, CX + 80, ry + 28], 15, 165, fill=(35, 25, 16, 230), width=4)
        d.arc([CX - 75, ry + 2, CX + 75, ry + 26], 20, 160, fill=(125, 95, 62, 190), width=2)
        # Moss patches
        if ry % 28 == 0:
            d.ellipse([CX - 45, ry + 10, CX - 20, ry + 24], fill=(55, 125, 55, 220))
            d.ellipse([CX + 25, ry + 8, CX + 50, ry + 22], fill=(75, 155, 65, 220))

    # 3. Dryad Torso merging from heartwood
    skin_dark = (90, 135, 95)
    skin_mid = (165, 205, 165)
    skin_light = (220, 245, 215)

    # Lower gown
    dress_poly = [(CX - 50, CY - 25), (CX - 70, CY + 85), (CX + 70, CY + 85), (CX + 50, CY - 25)]
    img = draw_shaded_poly(img, dress_poly, (50, 95, 55), (95, 165, 95), (28, 55, 30))

    # Upper torso & chest
    torso_poly = [(CX - 40, CY - 20), (CX - 34, CY - 95), (CX + 34, CY - 95), (CX + 40, CY - 20)]
    img = draw_shaded_poly(img, torso_poly, skin_mid, skin_light, skin_dark)

    # Shoulders and neck
    neck_poly = [(CX - 58, CY - 95), (CX - 18, CY - 135), (CX + 18, CY - 135), (CX + 58, CY - 95)]
    img = draw_shaded_poly(img, neck_poly, skin_mid, skin_light, skin_dark)

    # 4. Living Wooden Arms & Serpentine Tendrils
    # Left arm (raised)
    img = draw_shaded_limb(img, (CX - 52, CY - 95), (CX - 125, CY - 150), 20, 14, root_mid, root_light, root_dark)
    img = draw_shaded_limb(img, (CX - 125, CY - 150), (CX - 175, CY - 225), 14, 8, root_mid, root_light, root_dark)
    # Right arm (outstretched)
    img = draw_shaded_limb(img, (CX + 52, CY - 95), (CX + 130, CY - 140), 20, 14, root_mid, root_light, root_dark)
    img = draw_shaded_limb(img, (CX + 130, CY - 140), (CX + 190, CY - 100), 14, 8, root_mid, root_light, root_dark)

    # Coiling vine whips
    d = ImageDraw.Draw(img)
    d.arc([CX - 220, CY - 280, CX - 130, CY - 180], 30, 320, fill=(95, 195, 85, 255), width=6)
    d.arc([CX - 216, CY - 276, CX - 134, CY - 184], 40, 310, fill=(185, 245, 140, 255), width=3)
    d.arc([CX + 140, CY - 150, CX + 230, CY - 60], 110, 350, fill=(95, 195, 85, 255), width=6)

    # 5. Serene Dryad Face & Golden Foliage Crown
    head_poly = [
        (CX - 24, CY - 135),
        (CX - 28, CY - 170),
        (CX, CY - 192),
        (CX + 28, CY - 170),
        (CX + 24, CY - 135),
        (CX, CY - 120),
    ]
    img = draw_shaded_poly(img, head_poly, skin_light, (255, 255, 255), skin_dark, stroke_col=(50, 85, 55, 255))
    
    # Emerald glowing eyes
    d = ImageDraw.Draw(img)
    d.ellipse([CX - 16, CY - 162, CX - 6, CY - 152], fill=(80, 255, 120, 255))
    d.ellipse([CX + 6, CY - 162, CX + 16, CY - 152], fill=(80, 255, 120, 255))
    d.ellipse([CX - 12, CY - 159, CX - 9, CY - 155], fill=(255, 255, 255, 255))
    d.ellipse([CX + 9, CY - 159, CX + 12, CY - 155], fill=(255, 255, 255, 255))

    # Lush Crown of Autumnal Foliage
    leaves = [
        (-70, -215, 45, 30, (45, 140, 65), (95, 205, 105)),
        (70, -215, 45, 30, (45, 140, 65), (95, 205, 105)),
        (0, -245, 52, 34, (70, 185, 85), (145, 245, 135)),
        (-105, -180, 40, 26, (55, 160, 75), (115, 225, 115)),
        (105, -180, 40, 26, (55, 160, 75), (115, 225, 115)),
        (-40, -260, 38, 24, (235, 185, 45), (255, 230, 115)), # Golden
        (40, -260, 38, 24, (235, 185, 45), (255, 230, 115)),
        (0, -280, 32, 20, (255, 215, 75), (255, 250, 175)),
    ]
    for lx, ly, lrx, lry, bcol, hcol in leaves:
        d.ellipse([CX + lx - lrx, CY + ly - lry, CX + lx + lrx, CY + ly + lry], fill=bcol, outline=(30, 70, 35, 255))
        d.ellipse([CX + lx - int(lrx*0.6), CY + ly - int(lry*0.6), CX + lx + int(lrx*0.6), CY + ly + int(lry*0.6)], fill=hcol)
        d.line([(CX + lx, CY + ly - lry), (CX + lx, CY + ly + lry)], fill=(25, 55, 28, 180), width=2)

    # 6. Radiant "Serce Puszczy" (Heart of the Forest)
    heart_x, heart_y = CX, CY - 50
    # Outer blossom petals
    for p_ang in range(0, 360, 30):
        rad = math.radians(p_ang)
        px = heart_x + int(math.cos(rad) * 26)
        py = heart_y + int(math.sin(rad) * 26)
        d.ellipse([px - 16, py - 16, px + 16, py + 16], fill=(255, 155, 35, 230), outline=(210, 100, 15, 255))
    # Glowing center core
    d.ellipse([heart_x - 18, heart_y - 18, heart_x + 18, heart_y + 18], fill=(255, 230, 80, 255))
    d.ellipse([heart_x - 9, heart_y - 9, heart_x + 9, heart_y + 9], fill=(255, 255, 225, 255))

    # Additive glow on heart
    heart_glow = create_layer()
    d_hg = ImageDraw.Draw(heart_glow)
    d_hg.ellipse([heart_x - 55, heart_y - 55, heart_x + 55, heart_y + 55], fill=(255, 180, 45, 140))
    d_hg.ellipse([heart_x - 30, heart_y - 30, heart_x + 30, heart_y + 30], fill=(255, 245, 130, 200))
    heart_glow = heart_glow.filter(ImageFilter.GaussianBlur(10))
    img = Image.alpha_composite(img, heart_glow)

    # 7. Drifting bioluminescent spores
    spores = create_layer()
    d_sp = ImageDraw.Draw(spores)
    np.random.seed(1337)
    for _ in range(55):
        sx = CX + np.random.randint(-240, 240)
        sy = CY + np.random.randint(-270, 240)
        sr = np.random.randint(2, 6)
        scol = (110, 255, 130, 220) if np.random.rand() > 0.4 else (255, 225, 80, 230)
        d_sp.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=scol)
    spores = spores.filter(ImageFilter.GaussianBlur(1))
    img = Image.alpha_composite(img, spores)

    img.save(MASTERS_DIR / "ygdrasha.png", "PNG")
    img.save(PUBLIC_DIR / "ygdrasha_char.png", "PNG")
    sh = create_shadow(sw=460, sh=95, alpha=210, color=(15, 30, 20))
    sh.save(MASTERS_DIR / "ygdrasha_shadow.png", "PNG")
    print("Ygdrasha painterly master saved!")

# =========================================================================
# 2. THORGAR, ALFA KŁÓW (Verdant Lv 20)
# =========================================================================
def render_thorgar():
    print("Rendering Painterly Thorgar, Alfa Kłów...")
    img = create_layer()

    # Emerald aura
    aura = create_layer()
    d_aura = ImageDraw.Draw(aura)
    d_aura.ellipse([CX - 230, CY - 190, CX + 230, CY + 190], fill=(25, 80, 40, 60))
    d_aura.ellipse([CX - 150, CY - 140, CX + 150, CY + 140], fill=(70, 185, 85, 75))
    aura = aura.filter(ImageFilter.GaussianBlur(28))
    img = Image.alpha_composite(img, aura)

    fur_dark = (22, 30, 24)
    fur_mid = (45, 62, 48)
    fur_light = (85, 115, 88)
    thorn_ivory = (235, 230, 205)
    thorn_shade = (145, 135, 110)

    # 1. Hind Legs
    img = draw_shaded_limb(img, (CX - 140, CY + 50), (CX - 195, CY + 160), 40, 26, fur_mid, fur_light, fur_dark)
    img = draw_shaded_limb(img, (CX - 195, CY + 160), (CX - 180, CY + 255), 26, 22, fur_dark, fur_mid, (12, 18, 14))
    img = draw_shaded_limb(img, (CX - 50, CY + 60), (CX - 75, CY + 170), 38, 24, fur_mid, fur_light, fur_dark)
    img = draw_shaded_limb(img, (CX - 75, CY + 170), (CX - 65, CY + 260), 24, 20, fur_dark, fur_mid, (12, 18, 14))

    # 2. Muscular Wolf Body
    body_poly = [
        (CX - 185, CY + 50),
        (CX - 135, CY - 45),
        (CX - 10, CY - 75),
        (CX + 115, CY - 60),
        (CX + 150, CY + 35),
        (CX + 85, CY + 115),
        (CX - 30, CY + 130),
        (CX - 145, CY + 115),
    ]
    img = draw_shaded_poly(img, body_poly, fur_mid, fur_light, fur_dark, stroke_col=(18, 25, 20, 255))

    # Fur Texture Strands
    d = ImageDraw.Draw(img)
    for fx in range(CX - 175, CX + 135, 12):
        d.line([(fx, CY - 35), (fx + 16, CY + 15)], fill=(fur_light[0], fur_light[1], fur_light[2], 160), width=3)
        d.line([(fx - 12, CY + 20), (fx + 10, CY + 75)], fill=(fur_dark[0], fur_dark[1], fur_dark[2], 180), width=3)

    # 3. Spiked Tail
    tail_pts = [(CX - 185, CY + 60), (CX - 235, CY + 40), (CX - 280, CY + 10), (CX - 310, CY - 35)]
    for i in range(len(tail_pts) - 1):
        img = draw_shaded_limb(img, tail_pts[i], tail_pts[i+1], 26 - i*4, 20 - i*5, fur_mid, fur_light, fur_dark)
        # Thorn spikes along tail
        img = draw_shaded_poly(img, [
            tail_pts[i],
            (tail_pts[i][0] - 18, tail_pts[i][1] - 30),
            tail_pts[i+1],
        ], thorn_ivory, (255, 255, 240), thorn_shade)

    # 4. Forelegs & Claws
    img = draw_shaded_limb(img, (CX + 40, CY + 60), (CX + 35, CY + 170), 36, 26, fur_mid, fur_light, fur_dark)
    img = draw_shaded_limb(img, (CX + 35, CY + 170), (CX + 25, CY + 265), 26, 22, fur_dark, fur_mid, (12, 18, 14))
    img = draw_shaded_limb(img, (CX + 125, CY + 60), (CX + 150, CY + 165), 42, 30, fur_mid, fur_light, fur_dark)
    img = draw_shaded_limb(img, (CX + 150, CY + 165), (CX + 170, CY + 265), 30, 24, fur_dark, fur_mid, (12, 18, 14))

    # Paws and razor claws
    d = ImageDraw.Draw(img)
    d.ellipse([CX + 5, CY + 255, CX + 45, CY + 278], fill=fur_dark)
    d.ellipse([CX + 148, CY + 255, CX + 195, CY + 280], fill=fur_dark)
    for c_off in [152, 164, 176, 188]:
        d.polygon([(CX + c_off, CY + 274), (CX + c_off + 4, CY + 294), (CX + c_off + 8, CY + 274)], fill=(12, 15, 12, 255))

    # 5. Massive Calcified Thorn Bone Crests along Spine
    spine_spikes = [
        (CX - 145, CY - 40, 32, -55),
        (CX - 105, CY - 60, 40, -68),
        (CX - 65, CY - 72, 48, -78),
        (CX - 22, CY - 80, 56, -88),
        (CX + 25, CY - 75, 64, -95),
        (CX + 80, CY - 65, 70, -100), # Colossal shoulder crest
        (CX + 125, CY - 48, 54, -78),
    ]
    for sx, sy, w_sp, h_sp in spine_spikes:
        spike_poly = [
            (sx - w_sp//2, sy),
            (sx + 8, sy + h_sp),
            (sx + w_sp//2, sy),
        ]
        img = draw_shaded_poly(img, spike_poly, thorn_ivory, (255, 255, 245), thorn_shade, stroke_col=(95, 85, 65, 255))

    # 6. Snarling Wolf Head & Jaws
    mane_poly = [(CX + 85, CY - 65), (CX + 135, CY - 135), (CX + 200, CY - 115), (CX + 180, CY - 20)]
    img = draw_shaded_poly(img, mane_poly, fur_dark, fur_mid, (12, 18, 14))

    head_poly = [
        (CX + 125, CY - 135),
        (CX + 175, CY - 175),
        (CX + 240, CY - 135),
        (CX + 285, CY - 88),  # Muzzle tip
        (CX + 250, CY - 50),  # Lower jaw
        (CX + 185, CY - 68),
    ]
    img = draw_shaded_poly(img, head_poly, fur_mid, fur_light, fur_dark, stroke_col=(18, 25, 20, 255))

    # Ears & Horns
    d = ImageDraw.Draw(img)
    d.polygon([(CX + 145, CY - 155), (CX + 150, CY - 215), (CX + 180, CY - 170)], fill=fur_dark, outline=thorn_shade)
    d.polygon([(CX + 180, CY - 150), (CX + 205, CY - 210), (CX + 225, CY - 155)], fill=fur_mid, outline=thorn_shade)
    # Head crest bone
    img = draw_shaded_poly(img, [(CX + 195, CY - 170), (CX + 235, CY - 225), (CX + 225, CY - 160)], thorn_ivory, (255, 255, 245), thorn_shade)

    # Snarling Open Jaws & Venomous Sabertooth Fangs
    d = ImageDraw.Draw(img)
    d.polygon([(CX + 225, CY - 88), (CX + 280, CY - 88), (CX + 250, CY - 52)], fill=(145, 32, 42, 255))
    # Upper Sabertooth Fangs
    img = draw_shaded_poly(img, [(CX + 250, CY - 88), (CX + 258, CY - 38), (CX + 266, CY - 88)], thorn_ivory, (255, 255, 255), thorn_shade)
    img = draw_shaded_poly(img, [(CX + 268, CY - 88), (CX + 274, CY - 55), (CX + 280, CY - 88)], thorn_ivory, (255, 255, 255), thorn_shade)
    # Venom drip
    d = ImageDraw.Draw(img)
    d.line([(CX + 258, CY - 38), (CX + 258, CY - 10)], fill=(110, 255, 95, 255), width=3)
    d.ellipse([CX + 254, CY - 10, CX + 262, CY - 2], fill=(110, 255, 95, 255))

    # Piercing Emerald Eyes with flaming ki wisp
    d.polygon([(CX + 210, CY - 140), (CX + 232, CY - 134), (CX + 220, CY - 124)], fill=(80, 255, 120, 255))
    d.line([(CX + 220, CY - 134), (CX + 185, CY - 165)], fill=(130, 255, 165, 220), width=4)

    img.save(MASTERS_DIR / "thorgar.png", "PNG")
    img.save(PUBLIC_DIR / "thorgar_char.png", "PNG")
    sh = create_shadow(sw=480, sh=95, alpha=220, color=(15, 25, 18))
    sh.save(MASTERS_DIR / "thorgar_shadow.png", "PNG")
    print("Thorgar painterly master saved!")

# =========================================================================
# 5. ARBITER ZERO (Nexus Lv 15)
# =========================================================================
def render_arbiter_zero():
    print("Rendering Painterly Arbiter Zero...")
    img = create_layer()

    # Cyan tech aura
    aura = create_layer()
    d_aura = ImageDraw.Draw(aura)
    d_aura.ellipse([CX - 240, CY - 210, CX + 240, CY + 210], fill=(20, 65, 120, 60))
    d_aura.ellipse([CX - 150, CY - 145, CX + 150, CY + 145], fill=(45, 150, 245, 75))
    aura = aura.filter(ImageFilter.GaussianBlur(28))
    img = Image.alpha_composite(img, aura)

    cobalt_dark = (20, 32, 50)
    cobalt_mid = (40, 65, 98)
    cobalt_light = (85, 125, 175)
    metal_dark = (30, 35, 42)
    metal_light = (130, 145, 168)
    cyan_neon = (55, 225, 255)
    hazard_yellow = (250, 210, 40)

    # 1. Bipedal Heavy Mech Legs & Thrusters
    img = draw_shaded_poly(img, [(CX - 100, CY + 90), (CX - 140, CY + 180), (CX - 90, CY + 180), (CX - 60, CY + 90)], metal_dark, metal_light, (15, 18, 22))
    img = draw_shaded_poly(img, [(CX - 140, CY + 180), (CX - 130, CY + 270), (CX - 75, CY + 270), (CX - 90, CY + 180)], cobalt_mid, cobalt_light, cobalt_dark)
    img = draw_shaded_poly(img, [(CX + 60, CY + 90), (CX + 90, CY + 180), (CX + 140, CY + 180), (CX + 100, CY + 90)], metal_dark, metal_light, (15, 18, 22))
    img = draw_shaded_poly(img, [(CX + 90, CY + 180), (CX + 75, CY + 270), (CX + 130, CY + 270), (CX + 140, CY + 180)], cobalt_mid, cobalt_light, cobalt_dark)

    # Armored Foot Treads
    img = draw_shaded_poly(img, [(CX - 150, CY + 265), (CX - 65, CY + 265), (CX - 65, CY + 288), (CX - 150, CY + 288)], metal_dark, metal_light, (15, 18, 22), stroke_col=(60, 100, 140, 255))
    img = draw_shaded_poly(img, [(CX + 65, CY + 265), (CX + 150, CY + 265), (CX + 150, CY + 288), (CX + 65, CY + 288)], metal_dark, metal_light, (15, 18, 22), stroke_col=(60, 100, 140, 255))

    # Repulsor thrust glow under feet
    d = ImageDraw.Draw(img)
    d.ellipse([CX - 135, CY + 284, CX - 80, CY + 295], fill=cyan_neon)
    d.ellipse([CX + 80, CY + 284, CX + 135, CY + 295], fill=cyan_neon)

    # 2. Main Chassis & Chest Armor
    torso_poly = [
        (CX - 115, CY - 105),
        (CX - 140, CY - 30),
        (CX - 78, CY + 98),
        (CX + 78, CY + 98),
        (CX + 140, CY - 30),
        (CX + 115, CY - 105),
    ]
    img = draw_shaded_poly(img, torso_poly, cobalt_mid, cobalt_light, cobalt_dark, stroke_col=(15, 22, 35, 255))
    
    # Inset armor bevel plate
    inset_poly = [
        (CX - 88, CY - 88),
        (CX - 108, CY - 30),
        (CX - 62, CY + 78),
        (CX + 62, CY + 78),
        (CX + 108, CY - 30),
        (CX + 88, CY - 88),
    ]
    img = draw_shaded_poly(img, inset_poly, cobalt_light, (130, 170, 225), cobalt_mid)

    # Hazard stripes
    d = ImageDraw.Draw(img)
    for hx in range(-52, 52, 20):
        d.polygon([(CX + hx, CY + 58), (CX + hx + 10, CY + 58), (CX + hx + 18, CY + 76), (CX + hx + 8, CY + 76)], fill=hazard_yellow)

    # 3. Glowing Hexagonal Arc-Core Power Reactor
    core_x, core_y = CX, CY - 15
    cr = 40
    hex_pts = [(core_x + int(math.cos(math.radians(a)) * cr), core_y + int(math.sin(math.radians(a)) * cr)) for a in range(0, 360, 60)]
    img = draw_shaded_poly(img, hex_pts, metal_dark, metal_light, (15, 18, 22), stroke_col=cyan_neon)

    # Inner core
    hex_inner = [(core_x + int(math.cos(math.radians(a)) * (cr - 10)), core_y + int(math.sin(math.radians(a)) * (cr - 10))) for a in range(0, 360, 60)]
    d = ImageDraw.Draw(img)
    d.polygon(hex_inner, fill=(195, 250, 255, 255))
    d.line([(core_x - 24, core_y - 8), (core_x, core_y + 14), (core_x + 25, core_y - 12)], fill=(255, 255, 255, 255), width=4)

    # Core glow layer
    cglow = create_layer()
    d_cg = ImageDraw.Draw(cglow)
    d_cg.ellipse([core_x - 55, core_y - 55, core_x + 55, core_y + 55], fill=(50, 200, 255, 150))
    d_cg.ellipse([core_x - 28, core_y - 28, core_x + 28, core_y + 28], fill=(220, 255, 255, 220))
    cglow = cglow.filter(ImageFilter.GaussianBlur(10))
    img = Image.alpha_composite(img, cglow)

    # 4. Heavy Shoulder Pauldrons & Exhaust Vents
    l_paul = [(CX - 115, CY - 105), (CX - 192, CY - 125), (CX - 208, CY - 40), (CX - 135, CY - 30)]
    img = draw_shaded_poly(img, l_paul, cobalt_dark, cobalt_light, (12, 18, 28), stroke_col=cobalt_light)
    r_paul = [(CX + 115, CY - 105), (CX + 192, CY - 125), (CX + 208, CY - 40), (CX + 135, CY - 30)]
    img = draw_shaded_poly(img, r_paul, cobalt_dark, cobalt_light, (12, 18, 28), stroke_col=cobalt_light)

    # Vent cooling slits
    d = ImageDraw.Draw(img)
    d.rectangle([CX - 188, CY - 112, CX - 148, CY - 88], fill=metal_dark)
    d.line([(CX - 184, CY - 100), (CX - 152, CY - 100)], fill=cyan_neon, width=4)
    d.rectangle([CX + 148, CY - 112, CX + 188, CY - 88], fill=metal_dark)
    d.line([(CX + 152, CY - 100), (CX + 184, CY - 100)], fill=cyan_neon, width=4)

    # 5. Left Arm: Rotary Plasma Cannon
    img = draw_shaded_limb(img, (CX - 170, CY - 40), (CX - 195, CY + 55), 30, 24, metal_dark, metal_light, (15, 18, 22))
    # Cannon casing
    img = draw_shaded_poly(img, [(CX - 240, CY + 45), (CX - 165, CY + 45), (CX - 165, CY + 145), (CX - 240, CY + 145)], metal_dark, metal_light, (15, 18, 22), stroke_col=cobalt_light)
    # 4 Barrels
    d = ImageDraw.Draw(img)
    for b_off in [-26, -10, 6, 22]:
        d.rectangle([CX - 215 + b_off, CY + 145, CX - 205 + b_off, CY + 235], fill=(95, 108, 125, 255), outline=(30, 35, 45, 255))
        d.ellipse([CX - 215 + b_off, CY + 230, CX - 205 + b_off, CY + 240], fill=cyan_neon)

    # 6. Right Arm: Hydraulic Siege Claw
    img = draw_shaded_limb(img, (CX + 170, CY - 40), (CX + 200, CY + 55), 30, 24, metal_dark, metal_light, (15, 18, 22))
    img = draw_shaded_poly(img, [(CX + 168, CY + 45), (CX + 232, CY + 45), (CX + 232, CY + 125), (CX + 168, CY + 125)], cobalt_dark, cobalt_light, (15, 18, 22), stroke_col=cobalt_light)
    # Pincer Claws
    for cy_claw, ang in [(125, 20), (155, 0), (185, -20)]:
        claw_poly = [(CX + 220, CY + cy_claw - 16), (CX + 280, CY + cy_claw + ang), (CX + 230, CY + cy_claw + 16)]
        img = draw_shaded_poly(img, claw_poly, metal_light, (215, 230, 248), metal_dark, stroke_col=(30, 35, 45, 255))
        d = ImageDraw.Draw(img)
        d.line([(CX + 230, CY + cy_claw), (CX + 275, CY + cy_claw + ang)], fill=cyan_neon, width=3)

    # 7. Angular Helm & Cycloptic Visor Beam
    helm_poly = [
        (CX - 48, CY - 105),
        (CX - 58, CY - 155),
        (CX, CY - 188),
        (CX + 58, CY - 155),
        (CX + 48, CY - 105),
        (CX, CY - 95),
    ]
    img = draw_shaded_poly(img, helm_poly, cobalt_dark, cobalt_light, (12, 18, 28), stroke_col=cobalt_light)

    # Visor slit
    d = ImageDraw.Draw(img)
    d.rectangle([CX - 40, CY - 150, CX + 40, CY - 132], fill=(12, 18, 28, 255))
    d.rectangle([CX - 36, CY - 146, CX + 36, CY - 135], fill=cyan_neon)
    d.rectangle([CX - 14, CY - 145, CX + 14, CY - 136], fill=(255, 255, 255, 255))

    # Scanner beam flare
    beam = create_layer()
    d_bm = ImageDraw.Draw(beam)
    d_bm.polygon([(CX - 15, CY - 140), (CX + 15, CY - 140), (CX + 250, CY - 95), (CX - 250, CY - 95)], fill=(55, 225, 255, 65))
    beam = beam.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, beam)

    img.save(MASTERS_DIR / "arbiter-zero.png", "PNG")
    img.save(PUBLIC_DIR / "arbiter-zero_char.png", "PNG")
    sh = create_shadow(sw=440, sh=90, alpha=210, color=(15, 25, 45))
    sh.save(MASTERS_DIR / "arbiter-zero_shadow.png", "PNG")
    print("Arbiter Zero painterly master saved!")

# =========================================================================
# 6. HYDRA-RDZEŃ (Nexus Lv 20)
# =========================================================================
def render_hydra_rdzen():
    print("Rendering Painterly Hydra-Rdzeń...")
    img = create_layer()

    # Quantum matrix aura
    aura = create_layer()
    d_aura = ImageDraw.Draw(aura)
    d_aura.ellipse([CX - 250, CY - 210, CX + 250, CY + 210], fill=(25, 50, 100, 60))
    d_aura.ellipse([CX - 160, CY - 140, CX + 160, CY + 140], fill=(65, 160, 255, 75))
    aura = aura.filter(ImageFilter.GaussianBlur(28))
    img = Image.alpha_composite(img, aura)

    carbon_dark = (18, 24, 34)
    carbon_mid = (38, 50, 68)
    carbon_light = (75, 98, 130)
    cyan_glow = (50, 220, 255)
    plasma_orange = (255, 120, 35)
    laser_violet = (205, 75, 255)

    base_y = CY + 190

    # 1. Floating Antigravity Platform & Quantum Rings
    d = ImageDraw.Draw(img)
    d.ellipse([CX - 215, base_y - 48, CX + 215, base_y + 48], outline=carbon_light, width=9)
    d.ellipse([CX - 198, base_y - 40, CX + 198, base_y + 40], outline=cyan_glow, width=4)
    # Energy wash
    d.ellipse([CX - 185, base_y + 10, CX + 185, base_y + 58], fill=(35, 155, 255, 95))

    # Central Computing Crystal Matrix
    core_pts = [
        (CX, base_y - 125),
        (CX + 65, base_y - 52),
        (CX + 54, base_y + 32),
        (CX, base_y + 65),
        (CX - 54, base_y + 32),
        (CX - 65, base_y - 52),
    ]
    img = draw_shaded_poly(img, core_pts, carbon_mid, carbon_light, carbon_dark, stroke_col=cyan_glow)
    inner_crystal = [
        (CX, base_y - 95),
        (CX + 44, base_y - 48),
        (CX + 38, base_y + 16),
        (CX, base_y + 44),
        (CX - 38, base_y + 16),
        (CX - 44, base_y - 48),
    ]
    img = draw_shaded_poly(img, inner_crystal, (170, 240, 255), (255, 255, 255), (90, 190, 235))

    # 2. Left Serpentine Neck & GŁOWICA ALFA (Plasma Cannon)
    alpha_joints = [(CX - 52, base_y - 42), (CX - 115, CY + 70), (CX - 165, CY - 10), (CX - 200, CY - 108)]
    for i in range(len(alpha_joints) - 1):
        img = draw_shaded_limb(img, alpha_joints[i], alpha_joints[i+1], 36 - i*4, 30 - i*4, carbon_mid, carbon_light, carbon_dark)
        d = ImageDraw.Draw(img)
        d.line([alpha_joints[i], alpha_joints[i+1]], fill=plasma_orange, width=5)

    # Alpha Head
    ah_x, ah_y = alpha_joints[-1]
    ah_poly = [(ah_x + 22, ah_y + 16), (ah_x - 38, ah_y - 42), (ah_x - 100, ah_y - 16), (ah_x - 70, ah_y + 38)]
    img = draw_shaded_poly(img, ah_poly, carbon_dark, carbon_light, (12, 16, 24), stroke_col=carbon_light)
    d = ImageDraw.Draw(img)
    d.rectangle([ah_x - 120, ah_y - 6, ah_x - 72, ah_y + 16], fill=(55, 68, 85, 255), outline=plasma_orange)
    d.ellipse([ah_x - 122, ah_y - 4, ah_x - 110, ah_y + 14], fill=plasma_orange)
    d.ellipse([ah_x - 62, ah_y - 28, ah_x - 46, ah_y - 16], fill=plasma_orange)

    # 3. Right Serpentine Neck & GŁOWICA GAMMA (Hydraulic Ram)
    gamma_joints = [(CX + 52, base_y - 42), (CX + 115, CY + 70), (CX + 165, CY - 10), (CX + 200, CY - 108)]
    for i in range(len(gamma_joints) - 1):
        img = draw_shaded_limb(img, gamma_joints[i], gamma_joints[i+1], 36 - i*4, 30 - i*4, carbon_mid, carbon_light, carbon_dark)
        d = ImageDraw.Draw(img)
        d.line([gamma_joints[i], gamma_joints[i+1]], fill=laser_violet, width=5)

    # Gamma Head
    gh_x, gh_y = gamma_joints[-1]
    gh_poly = [(gh_x - 22, gh_y + 16), (gh_x + 38, gh_y - 42), (gh_x + 100, gh_y - 16), (gh_x + 70, gh_y + 38)]
    img = draw_shaded_poly(img, gh_poly, carbon_dark, carbon_light, (12, 16, 24), stroke_col=carbon_light)
    d = ImageDraw.Draw(img)
    for rt_x in [gh_x + 62, gh_x + 78, gh_x + 94]:
        d.polygon([(rt_x, gh_y + 32), (rt_x + 6, gh_y + 54), (rt_x + 12, gh_y + 32)], fill=(190, 205, 225, 255))
    d.ellipse([gh_x + 46, gh_y - 28, gh_x + 62, gh_y - 16], fill=laser_violet)

    # 4. Center Serpentine Neck & GŁOWICA BETA PRIME (Laser Dragon King)
    beta_joints = [(CX, base_y - 62), (CX + 12, CY + 40), (CX - 12, CY - 60), (CX, CY - 185)]
    for i in range(len(beta_joints) - 1):
        img = draw_shaded_limb(img, beta_joints[i], beta_joints[i+1], 42 - i*5, 36 - i*5, carbon_dark, carbon_light, (12, 16, 24))
        d = ImageDraw.Draw(img)
        d.line([(beta_joints[i][0] - 7, beta_joints[i][1]), (beta_joints[i+1][0] - 7, beta_joints[i+1][1])], fill=cyan_glow, width=4)
        d.line([(beta_joints[i][0] + 7, beta_joints[i][1]), (beta_joints[i+1][0] + 7, beta_joints[i+1][1])], fill=cyan_glow, width=4)

    # Beta Prime Head
    bh_x, bh_y = beta_joints[-1]
    bh_poly = [
        (bh_x - 48, bh_y + 26),
        (bh_x - 58, bh_y - 38),
        (bh_x, bh_y - 90),
        (bh_x + 58, bh_y - 38),
        (bh_x + 48, bh_y + 26),
        (bh_x, bh_y + 48),
    ]
    img = draw_shaded_poly(img, bh_poly, carbon_light, (135, 175, 225), carbon_dark, stroke_col=(15, 20, 28, 255))

    # Antenna horns
    img = draw_shaded_poly(img, [(bh_x - 42, bh_y - 52), (bh_x - 110, bh_y - 115), (bh_x - 32, bh_y - 74)], carbon_dark, carbon_light, (12, 16, 24), stroke_col=cyan_glow)
    img = draw_shaded_poly(img, [(bh_x + 42, bh_y - 52), (bh_x + 110, bh_y - 115), (bh_x + 32, bh_y - 74)], carbon_dark, carbon_light, (12, 16, 24), stroke_col=cyan_glow)

    # Laser Visor
    d = ImageDraw.Draw(img)
    d.rectangle([bh_x - 32, bh_y - 26, bh_x + 32, bh_y - 8], fill=(12, 18, 28, 255))
    d.rectangle([bh_x - 28, bh_y - 23, bh_x + 28, bh_y - 11], fill=cyan_glow)
    d.ellipse([bh_x - 9, bh_y - 22, bh_x + 9, bh_y - 12], fill=(255, 255, 255, 255))

    # 5. Orbiting Satellites
    for sat_ang, sat_r, sat_col in [(0.4, 215, cyan_glow), (2.5, 225, plasma_orange), (4.5, 210, laser_violet)]:
        sat_x = CX + int(math.cos(sat_ang) * sat_r)
        sat_y = CY + 80 + int(math.sin(sat_ang) * 62)
        d.rectangle([sat_x - 16, sat_y - 16, sat_x + 16, sat_y + 16], fill=carbon_dark, outline=sat_col)
        d.ellipse([sat_x - 7, sat_y - 7, sat_x + 7, sat_y + 7], fill=sat_col)

    img.save(MASTERS_DIR / "hydra-rdzen.png", "PNG")
    img.save(PUBLIC_DIR / "hydra-rdzen_char.png", "PNG")
    sh = create_shadow(sw=480, sh=95, alpha=220, color=(15, 25, 45))
    sh.save(MASTERS_DIR / "hydra-rdzen_shadow.png", "PNG")
    print("Hydra-Rdzeń painterly master saved!")

# =========================================================================
# 7. KHARZUL, MISTRZ ARENY (Pyra Lv 15)
# =========================================================================
def render_kharzul():
    print("Rendering Painterly Kharzul, Mistrz Areny...")
    img = create_layer()

    # Molten fire aura
    aura = create_layer()
    d_aura = ImageDraw.Draw(aura)
    d_aura.ellipse([CX - 240, CY - 210, CX + 240, CY + 210], fill=(115, 35, 15, 60))
    d_aura.ellipse([CX - 150, CY - 145, CX + 150, CY + 145], fill=(245, 95, 25, 75))
    aura = aura.filter(ImageFilter.GaussianBlur(28))
    img = Image.alpha_composite(img, aura)

    obsidian_dark = (18, 16, 18)
    obsidian_mid = (42, 38, 42)
    obsidian_light = (85, 80, 85)
    molten_orange = (255, 95, 20)
    fire_yellow = (255, 230, 70)
    cloth_crimson = (150, 25, 30)

    # 1. Tattered War Cloak (Billowing with dynamic folds)
    cloak_poly = [
        (CX - 115, CY - 85),
        (CX - 195, CY + 140),
        (CX - 135, CY + 270),
        (CX - 40, CY + 280),
        (CX + 60, CY + 265),
        (CX + 115, CY - 85),
    ]
    img = draw_shaded_poly(img, cloak_poly, cloth_crimson, (215, 55, 65), (75, 15, 18), stroke_col=(50, 10, 15, 255))

    # 2. Heavy Obsidian Greaves & Armored Legs
    img = draw_shaded_limb(img, (CX - 78, CY + 85), (CX - 88, CY + 180), 36, 28, obsidian_dark, obsidian_light, (10, 8, 10))
    img = draw_shaded_limb(img, (CX - 88, CY + 180), (CX - 82, CY + 268), 28, 24, obsidian_mid, obsidian_light, obsidian_dark)
    img = draw_shaded_limb(img, (CX + 78, CY + 85), (CX + 88, CY + 180), 36, 28, obsidian_dark, obsidian_light, (10, 8, 10))
    img = draw_shaded_limb(img, (CX + 88, CY + 180), (CX + 82, CY + 268), 28, 24, obsidian_mid, obsidian_light, obsidian_dark)

    # Sabatons
    img = draw_shaded_poly(img, [(CX - 110, CY + 262), (CX - 55, CY + 262), (CX - 55, CY + 284), (CX - 110, CY + 284)], obsidian_dark, obsidian_light, (10, 8, 10))
    img = draw_shaded_poly(img, [(CX + 55, CY + 262), (CX + 110, CY + 262), (CX + 110, CY + 284), (CX + 55, CY + 284)], obsidian_dark, obsidian_light, (10, 8, 10))

    # Molten cracks in armor
    d = ImageDraw.Draw(img)
    d.line([(CX - 88, CY + 120), (CX - 82, CY + 175), (CX - 90, CY + 238)], fill=molten_orange, width=4)
    d.line([(CX + 88, CY + 120), (CX + 82, CY + 175), (CX + 90, CY + 238)], fill=molten_orange, width=4)

    # 3. Torso & Molten Vein Cuirass
    torso_poly = [
        (CX - 110, CY - 95),
        (CX - 130, CY - 22),
        (CX - 68, CY + 92),
        (CX + 68, CY + 92),
        (CX + 130, CY - 22),
        (CX + 110, CY - 95),
    ]
    img = draw_shaded_poly(img, torso_poly, obsidian_mid, obsidian_light, obsidian_dark, stroke_col=(12, 10, 12, 255))

    # Glowing molten fissures across chest
    d = ImageDraw.Draw(img)
    d.line([(CX - 90, CY - 62), (CX - 26, CY - 12), (CX, CY - 38), (CX + 48, CY - 12), (CX + 90, CY - 62)], fill=molten_orange, width=5)
    d.line([(CX - 22, CY - 12), (CX, CY + 48), (CX + 22, CY - 12)], fill=fire_yellow, width=3)
    # War belt
    d.rectangle([CX - 78, CY + 76, CX + 78, CY + 98], fill=(60, 48, 38, 255), outline=molten_orange)

    # 4. Spiked Pauldrons
    l_paul = [(CX - 110, CY - 95), (CX - 185, CY - 125), (CX - 200, CY - 38), (CX - 125, CY - 28)]
    img = draw_shaded_poly(img, l_paul, obsidian_dark, obsidian_light, (10, 8, 10), stroke_col=obsidian_light)
    img = draw_shaded_poly(img, [(CX - 185, CY - 125), (CX - 220, CY - 172), (CX - 158, CY - 115)], obsidian_light, (150, 140, 150), obsidian_dark)

    r_paul = [(CX + 110, CY - 95), (CX + 185, CY - 125), (CX + 200, CY - 38), (CX + 125, CY - 28)]
    img = draw_shaded_poly(img, r_paul, obsidian_dark, obsidian_light, (10, 8, 10), stroke_col=obsidian_light)
    img = draw_shaded_poly(img, [(CX + 185, CY - 125), (CX + 220, CY - 172), (CX + 158, CY - 115)], obsidian_light, (150, 140, 150), obsidian_dark)

    # 5. Left Arm (Molten Chains)
    img = draw_shaded_limb(img, (CX - 155, CY - 32), (CX - 190, CY + 60), 28, 22, obsidian_mid, obsidian_light, obsidian_dark)
    img = draw_shaded_limb(img, (CX - 190, CY + 60), (CX - 165, CY + 145), 22, 18, obsidian_dark, obsidian_mid, (10, 8, 10))
    d = ImageDraw.Draw(img)
    for l_y in range(CY + 12, CY + 125, 18):
        d.ellipse([CX - 190, l_y - 9, CX - 168, l_y + 9], outline=molten_orange, width=4)

    # 6. Right Arm & FLAMING EXECUTIONER GREATSWORD
    img = draw_shaded_limb(img, (CX + 155, CY - 32), (CX + 200, CY + 52), 28, 22, obsidian_mid, obsidian_light, obsidian_dark)
    img = draw_shaded_limb(img, (CX + 200, CY + 52), (CX + 180, CY + 135), 22, 20, obsidian_dark, obsidian_mid, (10, 8, 10))

    hilt_x, hilt_y = CX + 180, CY + 135
    tip_x, tip_y = CX + 255, CY - 240
    # Crossguard
    img = draw_shaded_poly(img, [(hilt_x - 38, hilt_y - 16), (hilt_x + 38, hilt_y + 16), (hilt_x + 26, hilt_y + 36), (hilt_x - 48, hilt_y + 6)], obsidian_dark, obsidian_light, (10, 8, 10), stroke_col=molten_orange)
    # Blade
    blade_poly = [
        (hilt_x - 24, hilt_y - 22),
        (tip_x - 32, tip_y + 32),
        (tip_x, tip_y),
        (tip_x + 16, tip_y + 22),
        (hilt_x + 20, hilt_y - 10),
    ]
    img = draw_shaded_poly(img, blade_poly, obsidian_dark, obsidian_light, (10, 8, 10), stroke_col=obsidian_light)
    d = ImageDraw.Draw(img)
    d.line([(hilt_x - 2, hilt_y - 15), (tip_x - 8, tip_y + 16)], fill=molten_orange, width=6)
    d.line([(hilt_x - 2, hilt_y - 15), (tip_x - 8, tip_y + 16)], fill=fire_yellow, width=3)

    # Volumetric Raging Roaring Flames enveloping sword
    flames = create_layer()
    d_fl = ImageDraw.Draw(flames)
    for f_idx in range(24):
        ft = f_idx / 24.0
        fx = int(hilt_x + (tip_x - hilt_x) * ft)
        fy = int(hilt_y + (tip_y - hilt_y) * ft)
        fr = int(25 + math.sin(ft * math.pi) * 22)
        d_fl.ellipse([fx - fr, fy - fr, fx + fr, fy + fr], fill=(255, 105, 20, 160))
        d_fl.ellipse([fx - fr//2, fy - fr//2, fx + fr//2, fy + fr//2], fill=(255, 235, 75, 220))
    flames = flames.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, flames)

    # 7. Horned Gladiator Helm & Fiery Visor Slit
    helm_poly = [
        (CX - 42, CY - 95),
        (CX - 52, CY - 155),
        (CX, CY - 185),
        (CX + 52, CY - 155),
        (CX + 42, CY - 95),
        (CX, CY - 84),
    ]
    img = draw_shaded_poly(img, helm_poly, obsidian_dark, obsidian_light, (10, 8, 10), stroke_col=obsidian_light)

    # Sweeping Demonic Horns
    img = draw_shaded_poly(img, [(CX - 48, CY - 150), (CX - 130, CY - 210), (CX - 36, CY - 170)], obsidian_mid, obsidian_light, obsidian_dark, stroke_col=molten_orange)
    img = draw_shaded_poly(img, [(CX + 48, CY - 150), (CX + 130, CY - 210), (CX + 36, CY - 170)], obsidian_mid, obsidian_light, obsidian_dark, stroke_col=molten_orange)

    # Visor slit
    d = ImageDraw.Draw(img)
    d.rectangle([CX - 32, CY - 138, CX + 32, CY - 124], fill=(15, 10, 10, 255))
    d.rectangle([CX - 28, CY - 134, CX + 28, CY - 127], fill=molten_orange)
    d.ellipse([CX - 12, CY - 133, CX + 12, CY - 128], fill=fire_yellow)

    img.save(MASTERS_DIR / "kharzul.png", "PNG")
    img.save(PUBLIC_DIR / "kharzul_char.png", "PNG")
    sh = create_shadow(sw=460, sh=90, alpha=220, color=(35, 15, 15))
    sh.save(MASTERS_DIR / "kharzul_shadow.png", "PNG")
    print("Kharzul painterly master saved!")

# =========================================================================
# 8. PYRRHAX, SMOK WULKANU (Pyra Lv 20)
# =========================================================================
def render_pyrrhax():
    print("Rendering Painterly Pyrrhax, Smok Wulkanu...")
    img = create_layer()

    # Volcanic cataclysm aura
    aura = create_layer()
    d_aura = ImageDraw.Draw(aura)
    d_aura.ellipse([CX - 255, CY - 215, CX + 255, CY + 215], fill=(135, 38, 15, 65))
    d_aura.ellipse([CX - 165, CY - 145, CX + 165, CY + 145], fill=(255, 110, 25, 80))
    aura = aura.filter(ImageFilter.GaussianBlur(30))
    img = Image.alpha_composite(img, aura)

    basalt_dark = (22, 18, 22)
    basalt_mid = (45, 38, 44)
    basalt_light = (85, 75, 82)
    magma_glow = (255, 95, 18)
    magma_core = (255, 230, 70)

    # 1. Colossal Obsidian Wings with Liquid Magma Webbing
    l_wing_bone = [(CX - 62, CY - 40), (CX - 195, CY - 185), (CX - 285, CY - 155)]
    img = draw_shaded_poly(img, [
        l_wing_bone[0], l_wing_bone[1], l_wing_bone[2],
        (CX - 245, CY - 42), (CX - 165, CY + 42), (CX - 82, CY + 22),
    ], (105, 30, 20), (185, 65, 35), (45, 12, 10), stroke_col=basalt_dark)
    img = draw_shaded_limb(img, l_wing_bone[0], l_wing_bone[1], 26, 18, basalt_dark, basalt_light, (12, 10, 12))
    img = draw_shaded_limb(img, l_wing_bone[1], l_wing_bone[2], 18, 10, basalt_dark, basalt_light, (12, 10, 12))

    r_wing_bone = [(CX + 62, CY - 40), (CX + 195, CY - 185), (CX + 285, CY - 155)]
    img = draw_shaded_poly(img, [
        r_wing_bone[0], r_wing_bone[1], r_wing_bone[2],
        (CX + 245, CY - 42), (CX + 165, CY + 42), (CX + 82, CY + 22),
    ], (105, 30, 20), (185, 65, 35), (45, 12, 10), stroke_col=basalt_dark)
    img = draw_shaded_limb(img, r_wing_bone[0], r_wing_bone[1], 26, 18, basalt_dark, basalt_light, (12, 10, 12))
    img = draw_shaded_limb(img, r_wing_bone[1], r_wing_bone[2], 18, 10, basalt_dark, basalt_light, (12, 10, 12))

    # Magma veins across wings
    d = ImageDraw.Draw(img)
    d.line([l_wing_bone[1], (CX - 245, CY - 42)], fill=magma_glow, width=4)
    d.line([l_wing_bone[1], (CX - 165, CY + 42)], fill=magma_glow, width=4)
    d.line([r_wing_bone[1], (CX + 245, CY - 42)], fill=magma_glow, width=4)
    d.line([r_wing_bone[1], (CX + 165, CY + 42)], fill=magma_glow, width=4)

    # 2. Spiked Tail & Volcanic Club
    tail_pts = [(CX - 125, CY + 140), (CX - 185, CY + 190), (CX - 245, CY + 220), (CX - 295, CY + 210)]
    for i in range(len(tail_pts) - 1):
        img = draw_shaded_limb(img, tail_pts[i], tail_pts[i+1], 36 - i*7, 28 - i*7, basalt_mid, basalt_light, basalt_dark)
        d = ImageDraw.Draw(img)
        d.line([tail_pts[i], tail_pts[i+1]], fill=magma_glow, width=4)

    # Spiked Club
    d = ImageDraw.Draw(img)
    d.ellipse([tail_pts[-1][0] - 26, tail_pts[-1][1] - 26, tail_pts[-1][0] + 26, tail_pts[-1][1] + 26], fill=basalt_dark, outline=magma_glow)
    for sp_ang in range(0, 360, 60):
        rad = math.radians(sp_ang)
        sp_x = tail_pts[-1][0] + int(math.cos(rad) * 38)
        sp_y = tail_pts[-1][1] + int(math.sin(rad) * 38)
        d.polygon([(tail_pts[-1][0], tail_pts[-1][1]), (sp_x, sp_y), (tail_pts[-1][0] + 5, tail_pts[-1][1] + 5)], fill=basalt_light)

    # 3. Colossal Dragon Body & Caldera Furnace Chest
    body_poly = [
        (CX - 125, CY + 140),
        (CX - 95, CY - 10),
        (CX - 10, CY - 55),
        (CX + 85, CY - 10),
        (CX + 125, CY + 140),
        (CX, CY + 215),
    ]
    img = draw_shaded_poly(img, body_poly, basalt_dark, basalt_light, (12, 10, 12), stroke_col=(10, 8, 10, 255))

    # Caldera Furnace Chest
    caldera = create_layer()
    d_cal = ImageDraw.Draw(caldera)
    d_cal.ellipse([CX - 80, CY + 15, CX + 80, CY + 155], fill=(255, 85, 18, 230))
    d_cal.ellipse([CX - 48, CY + 42, CX + 48, CY + 128], fill=(255, 235, 85, 255))
    caldera = caldera.filter(ImageFilter.GaussianBlur(10))
    img = Image.alpha_composite(img, caldera)

    # Basalt rib cage plates
    for ry in range(CY + 25, CY + 155, 26):
        img = draw_shaded_poly(img, [(CX - 90, ry), (CX - 16, ry + 14), (CX - 16, ry - 6), (CX - 90, ry - 16)], basalt_mid, basalt_light, basalt_dark)
        img = draw_shaded_poly(img, [(CX + 90, ry), (CX + 16, ry + 14), (CX + 16, ry - 6), (CX + 90, ry - 16)], basalt_mid, basalt_light, basalt_dark)

    # 4. Massive Forelegs & Claws
    img = draw_shaded_limb(img, (CX - 85, CY + 120), (CX - 115, CY + 210), 40, 30, basalt_mid, basalt_light, basalt_dark)
    img = draw_shaded_limb(img, (CX - 115, CY + 210), (CX - 105, CY + 272), 30, 24, basalt_dark, basalt_mid, (10, 8, 10))
    img = draw_shaded_limb(img, (CX + 85, CY + 120), (CX + 115, CY + 210), 40, 30, basalt_mid, basalt_light, basalt_dark)
    img = draw_shaded_limb(img, (CX + 115, CY + 210), (CX + 105, CY + 272), 30, 24, basalt_dark, basalt_mid, (10, 8, 10))

    d = ImageDraw.Draw(img)
    for c_x in [-135, -115, -95]:
        d.polygon([(CX + c_x, CY + 268), (CX + c_x + 8, CY + 292), (CX + c_x + 16, CY + 268)], fill=(10, 8, 10, 255))
    for c_x in [95, 115, 135]:
        d.polygon([(CX + c_x, CY + 268), (CX + c_x + 8, CY + 292), (CX + c_x + 16, CY + 268)], fill=(10, 8, 10, 255))

    # 5. Serpentine Neck & Horned Head
    neck_joints = [(CX, CY - 35), (CX + 16, CY - 105), (CX + 48, CY - 175)]
    for i in range(len(neck_joints) - 1):
        img = draw_shaded_limb(img, neck_joints[i], neck_joints[i+1], 48 - i*6, 40 - i*6, basalt_mid, basalt_light, basalt_dark)
        d = ImageDraw.Draw(img)
        d.line([neck_joints[i], neck_joints[i+1]], fill=magma_glow, width=6)

    # Dragon Skull
    head_x, head_y = neck_joints[-1]
    head_poly = [
        (head_x - 32, head_y - 22),
        (head_x + 12, head_y - 75),
        (head_x + 100, head_y - 38),
        (head_x + 140, head_y),
        (head_x + 90, head_y + 38),
        (head_x + 22, head_y + 22),
    ]
    img = draw_shaded_poly(img, head_poly, basalt_dark, basalt_light, (10, 8, 10), stroke_col=basalt_light)

    # Volcanic Horns
    img = draw_shaded_poly(img, [(head_x - 22, head_y - 48), (head_x - 115, head_y - 130), (head_x, head_y - 70)], basalt_light, (135, 125, 130), basalt_dark, stroke_col=magma_glow)
    img = draw_shaded_poly(img, [(head_x + 16, head_y - 64), (head_x - 70, head_y - 150), (head_x + 38, head_y - 80)], basalt_light, (135, 125, 130), basalt_dark, stroke_col=magma_glow)

    # Roaring Jaws & Fire Breath Cone
    d = ImageDraw.Draw(img)
    d.polygon([(head_x + 72, head_y - 6), (head_x + 135, head_y), (head_x + 98, head_y + 28)], fill=(170, 32, 22, 255))
    for t_x in range(head_x + 82, head_x + 130, 12):
        d.polygon([(t_x, head_y - 5), (t_x + 4, head_y + 9), (t_x + 8, head_y - 5)], fill=basalt_light)

    # Volumetric flame cone
    breath = create_layer()
    d_br = ImageDraw.Draw(breath)
    d_br.polygon([(head_x + 120, head_y + 10), (head_x + 235, head_y - 32), (head_x + 255, head_y + 52)], fill=(255, 115, 20, 190))
    d_br.polygon([(head_x + 120, head_y + 10), (head_x + 195, head_y - 10), (head_x + 205, head_y + 32)], fill=(255, 245, 95, 240))
    breath = breath.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, breath)

    d = ImageDraw.Draw(img)
    d.ellipse([head_x + 46, head_y - 36, head_x + 64, head_y - 20], fill=magma_core)

    img.save(MASTERS_DIR / "pyrrhax.png", "PNG")
    img.save(PUBLIC_DIR / "pyrrhax_char.png", "PNG")
    sh = create_shadow(sw=490, sh=100, alpha=230, color=(35, 15, 15))
    sh.save(MASTERS_DIR / "pyrrhax_shadow.png", "PNG")
    print("Pyrrhax painterly master saved!")

def synthesize_all():
    render_ygdrasha()
    render_thorgar()
    render_arbiter_zero()
    render_hydra_rdzen()
    render_kharzul()
    render_pyrrhax()

if __name__ == "__main__":
    synthesize_all()
