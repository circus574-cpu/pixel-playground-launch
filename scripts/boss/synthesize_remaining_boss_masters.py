#!/usr/bin/env python3
"""High-fidelity procedural synthesis for the 6 remaining Ki Legends bosses:
- ygdrasha (Verdant Lv 15)
- thorgar (Verdant Lv 20)
- arbiter-zero (Nexus Lv 15)
- hydra-rdzen (Nexus Lv 20)
- kharzul (Pyra Lv 15)
- pyrrhax (Pyra Lv 20)

Generates master character sprites (RGBA, transparent background)
and matching soft ground shadows.
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

# Standard canvas
W, H = 640, 780
CX, CY = W // 2, 380

def create_layer():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))

def add_glow(base_img, color, radius=12):
    alpha = base_img.split()[-1]
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_alpha = alpha.filter(ImageFilter.GaussianBlur(radius))
    glow.paste(color, mask=glow_alpha)
    return Image.alpha_composite(glow, base_img)

def draw_tapered_limb(draw, p1, p2, r1, r2, fill, outline=None):
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    dist = math.hypot(dx, dy)
    if dist < 1e-4:
        return
    nx = -dy / dist
    ny = dx / dist
    poly = [
        (p1[0] + nx * r1, p1[1] + ny * r1),
        (p2[0] + nx * r2, p2[1] + ny * r2),
        (p2[0] - nx * r2, p2[1] - ny * r2),
        (p1[0] - nx * r1, p1[1] - ny * r1),
    ]
    draw.polygon(poly, fill=fill, outline=outline)
    draw.ellipse([p1[0] - r1, p1[1] - r1, p1[0] + r1, p1[1] + r1], fill=fill)
    draw.ellipse([p2[0] - r2, p2[1] - r2, p2[0] + r2, p2[1] + r2], fill=fill)

def create_shadow(sw=360, sh=80, alpha=180, color=(15, 20, 30)):
    shadow = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    d.ellipse([10, 8, sw - 10, sh - 8], fill=(color[0], color[1], color[2], alpha))
    return shadow.filter(ImageFilter.GaussianBlur(12))

# =========================================================================
# 1. YGDRASHA, MATKA PUSZCZY (Verdant Lv 15)
# =========================================================================
def render_ygdrasha():
    print("Synthesizing Ygdrasha, Matka Puszczy...")
    img = create_layer()
    d = ImageDraw.Draw(img)

    # Ambient forest aura
    aura = create_layer()
    d_aura = ImageDraw.Draw(aura)
    d_aura.ellipse([CX - 220, CY - 220, CX + 220, CY + 220], fill=(20, 80, 40, 50))
    d_aura.ellipse([CX - 150, CY - 180, CX + 150, CY + 180], fill=(60, 160, 70, 70))
    aura = aura.filter(ImageFilter.GaussianBlur(25))
    img = Image.alpha_composite(img, aura)
    d = ImageDraw.Draw(img)

    # 1. Massive ancient root base & buttress roots
    root_color_dark = (42, 30, 20, 255)
    root_color_mid = (65, 48, 32, 255)
    root_color_light = (95, 75, 48, 255)
    moss_color = (45, 95, 45, 255)
    moss_highlight = (80, 150, 70, 255)

    # Background roots
    for ang, length in [(-0.9, 220), (0.9, 220), (-1.2, 180), (1.2, 180)]:
        bx = CX + int(math.sin(ang) * 90)
        by = CY + 120
        tx = CX + int(math.sin(ang) * length)
        ty = CY + 260
        draw_tapered_limb(d, (bx, by), (tx, ty), 32, 10, root_color_dark)

    # Main hollow trunk
    trunk_poly = [
        (CX - 110, CY + 260),
        (CX - 85, CY + 100),
        (CX - 55, CY - 20),
        (CX + 55, CY - 20),
        (CX + 85, CY + 100),
        (CX + 110, CY + 260),
        (CX + 70, CY + 275),
        (CX, CY + 265),
        (CX - 70, CY + 275),
    ]
    d.polygon(trunk_poly, fill=root_color_mid, outline=(30, 22, 15, 255))

    # Foreground twisting roots
    for start_x, start_y, end_x, end_y, w1, w2 in [
        (CX - 50, CY + 120, CX - 170, CY + 270, 28, 8),
        (CX + 50, CY + 120, CX + 170, CY + 270, 28, 8),
        (CX - 20, CY + 160, CX - 80, CY + 285, 22, 6),
        (CX + 20, CY + 160, CX + 80, CY + 285, 22, 6),
    ]:
        draw_tapered_limb(d, (start_x, start_y), (end_x, end_y), w1, w2, root_color_light, outline=(35, 25, 18, 255))
        # Moss patches on roots
        d.ellipse([start_x - 12, start_y + 10, start_x + 12, start_y + 35], fill=moss_color)
        d.ellipse([end_x - 10, end_y - 25, end_x + 10, end_y - 5], fill=moss_highlight)

    # Bark ridges and texture lines
    for ry in range(CY - 10, CY + 240, 16):
        d.arc([CX - 65, ry, CX + 65, ry + 25], 20, 160, fill=(38, 28, 18, 220), width=3)
        d.arc([CX - 40, ry + 6, CX + 40, ry + 30], 30, 150, fill=root_color_light, width=2)

    # 2. Dryad Archon Torso emerging from tree
    torso_color_base = (70, 115, 75, 255)
    torso_color_ivory = (175, 205, 170, 255)
    torso_highlight = (215, 235, 210, 255)

    # Lower gown / bark dress
    dress_poly = [
        (CX - 45, CY - 20),
        (CX - 60, CY + 80),
        (CX + 60, CY + 80),
        (CX + 45, CY - 20),
    ]
    d.polygon(dress_poly, fill=torso_color_base)

    # Midriff and chest
    d.polygon([
        (CX - 38, CY - 15),
        (CX - 32, CY - 90),
        (CX + 32, CY - 90),
        (CX + 38, CY - 15),
    ], fill=torso_color_ivory, outline=(50, 85, 55, 255))

    # Shoulders and neck
    d.polygon([
        (CX - 55, CY - 90),
        (CX - 18, CY - 130),
        (CX + 18, CY - 130),
        (CX + 55, CY - 90),
    ], fill=torso_color_ivory)

    # 3. Living Branch Arms & Vine Tendrils
    # Left arm (raised in commanding blessing)
    draw_tapered_limb(d, (CX - 50, CY - 90), (CX - 120, CY - 145), 18, 12, root_color_light, outline=(35, 25, 18, 255))
    draw_tapered_limb(d, (CX - 120, CY - 145), (CX - 170, CY - 220), 12, 6, root_color_light, outline=(35, 25, 18, 255))
    # Vine whip coiling from left hand
    d.arc([CX - 210, CY - 270, CX - 130, CY - 180], 40, 310, fill=(90, 180, 80, 255), width=5)
    d.arc([CX - 225, CY - 250, CX - 110, CY - 150], 100, 340, fill=(140, 220, 110, 255), width=3)

    # Right arm (spreading seeds forward)
    draw_tapered_limb(d, (CX + 50, CY - 90), (CX + 125, CY - 135), 18, 12, root_color_light, outline=(35, 25, 18, 255))
    draw_tapered_limb(d, (CX + 125, CY - 135), (CX + 180, CY - 95), 12, 6, root_color_light, outline=(35, 25, 18, 255))
    # Right hand branch fingers
    for fo in [-12, -4, 4, 12]:
        d.line([(CX + 180, CY - 95), (CX + 215, CY - 95 + fo * 2)], fill=(120, 95, 60, 255), width=3)

    # 4. Serene Dryad Head & Foliage Crown
    # Head / Face
    d.polygon([
        (CX - 22, CY - 130),
        (CX - 25, CY - 165),
        (CX, CY - 185),
        (CX + 25, CY - 165),
        (CX + 22, CY - 130),
        (CX, CY - 115),
    ], fill=torso_highlight, outline=(60, 95, 65, 255))

    # Glowing emerald eyes
    d.ellipse([CX - 14, CY - 156, CX - 6, CY - 148], fill=(90, 255, 130, 255))
    d.ellipse([CX + 6, CY - 156, CX + 14, CY - 148], fill=(90, 255, 130, 255))
    d.ellipse([CX - 11, CY - 154, CX - 9, CY - 150], fill=(255, 255, 255, 255))
    d.ellipse([CX + 9, CY - 154, CX + 11, CY - 150], fill=(255, 255, 255, 255))

    # Lush Crown of Foliage & Amber Flowers
    canopy_leaves = [
        # (x_off, y_off, rx, ry, color)
        (-60, -210, 38, 25, (40, 130, 60, 240)),
        (60, -210, 38, 25, (40, 130, 60, 240)),
        (0, -235, 45, 28, (65, 175, 80, 250)),
        (-95, -175, 35, 22, (50, 150, 70, 240)),
        (95, -175, 35, 22, (50, 150, 70, 240)),
        (-35, -250, 32, 20, (230, 190, 50, 255)), # Autumn gold
        (35, -250, 32, 20, (230, 190, 50, 255)),
        (0, -270, 28, 18, (255, 220, 80, 255)),
    ]
    for lx, ly, lrx, lry, lcol in canopy_leaves:
        d.ellipse([CX + lx - lrx, CY + ly - lry, CX + lx + lrx, CY + ly + lry], fill=lcol, outline=(30, 80, 40, 255))
        d.line([(CX + lx, CY + ly - lry), (CX + lx, CY + ly + lry)], fill=(20, 60, 30, 180), width=2)

    # 5. Blooming "Serce Puszczy" (Heart of the Forest) in chest
    heart_x, heart_y = CX, CY - 50
    # Outer petals
    for p_ang in range(0, 360, 45):
        rad = math.radians(p_ang)
        px = heart_x + int(math.cos(rad) * 22)
        py = heart_y + int(math.sin(rad) * 22)
        d.ellipse([px - 14, py - 14, px + 14, py + 14], fill=(255, 160, 40, 220), outline=(210, 110, 20, 255))
    # Inner glowing core
    d.ellipse([heart_x - 16, heart_y - 16, heart_x + 16, heart_y + 16], fill=(255, 220, 70, 255))
    d.ellipse([heart_x - 8, heart_y - 8, heart_x + 8, heart_y + 8], fill=(255, 255, 210, 255))

    # Glow filter on the heart
    heart_glow = create_layer()
    d_hg = ImageDraw.Draw(heart_glow)
    d_hg.ellipse([heart_x - 45, heart_y - 45, heart_x + 45, heart_y + 45], fill=(255, 190, 50, 140))
    d_hg.ellipse([heart_x - 25, heart_y - 25, heart_x + 25, heart_y + 25], fill=(255, 255, 140, 200))
    heart_glow = heart_glow.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, heart_glow)

    # 6. Bioluminescent floating spores and leaves
    spores = create_layer()
    d_sp = ImageDraw.Draw(spores)
    np.random.seed(42)
    for _ in range(45):
        sx = CX + np.random.randint(-220, 220)
        sy = CY + np.random.randint(-260, 220)
        sr = np.random.randint(2, 6)
        scol = (120, 255, 140, 220) if np.random.rand() > 0.4 else (255, 220, 80, 230)
        d_sp.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=scol)
    spores = spores.filter(ImageFilter.GaussianBlur(1))
    img = Image.alpha_composite(img, spores)

    # Save master
    img.save(MASTERS_DIR / "ygdrasha.png", "PNG")
    img.save(PUBLIC_DIR / "ygdrasha_char.png", "PNG")

    # Shadow
    sh = create_shadow(sw=440, sh=95, alpha=210, color=(15, 30, 20))
    sh.save(MASTERS_DIR / "ygdrasha_shadow.png", "PNG")
    print("Ygdrasha completed successfully.")

# =========================================================================
# 2. THORGAR, ALFA KŁÓW (Verdant Lv 20)
# =========================================================================
def render_thorgar():
    print("Synthesizing Thorgar, Alfa Kłów...")
    img = create_layer()
    d = ImageDraw.Draw(img)

    # Feral green predator aura
    aura = create_layer()
    d_aura = ImageDraw.Draw(aura)
    d_aura.ellipse([CX - 220, CY - 180, CX + 220, CY + 180], fill=(25, 75, 35, 60))
    d_aura.ellipse([CX - 150, CY - 130, CX + 150, CY + 130], fill=(60, 170, 70, 75))
    aura = aura.filter(ImageFilter.GaussianBlur(24))
    img = Image.alpha_composite(img, aura)
    d = ImageDraw.Draw(img)

    # Colors
    fur_dark = (28, 38, 30, 255)
    fur_mid = (45, 62, 48, 255)
    fur_light = (72, 98, 75, 255)
    thorn_ivory = (225, 220, 190, 255)
    thorn_shade = (160, 150, 120, 255)
    flesh_mouth = (140, 35, 45, 255)

    # 1. Hind legs & Back paws
    # Left hind
    draw_tapered_limb(d, (CX - 140, CY + 50), (CX - 190, CY + 160), 38, 24, fur_dark)
    draw_tapered_limb(d, (CX - 190, CY + 160), (CX - 180, CY + 250), 24, 20, fur_mid)
    # Right hind
    draw_tapered_limb(d, (CX - 50, CY + 60), (CX - 70, CY + 170), 36, 22, fur_dark)
    draw_tapered_limb(d, (CX - 70, CY + 170), (CX - 60, CY + 255), 22, 18, fur_mid)

    # 2. Main Muscular Wolf Torso & Flank
    body_poly = [
        (CX - 180, CY + 50),
        (CX - 130, CY - 40),
        (CX - 10, CY - 65),
        (CX + 110, CY - 50),
        (CX + 140, CY + 40),
        (CX + 80, CY + 110),
        (CX - 30, CY + 125),
        (CX - 140, CY + 110),
    ]
    d.polygon(body_poly, fill=fur_mid, outline=(20, 28, 22, 255))

    # Fur tufts / texture shading
    for fx in range(CX - 160, CX + 120, 24):
        d.line([(fx, CY - 30), (fx + 15, CY + 20)], fill=fur_light, width=4)
        d.line([(fx - 10, CY + 25), (fx + 8, CY + 80)], fill=fur_dark, width=3)

    # 3. Spiked Tail
    tail_pts = [(CX - 180, CY + 60), (CX - 230, CY + 40), (CX - 275, CY + 10), (CX - 300, CY - 30)]
    for i in range(len(tail_pts) - 1):
        draw_tapered_limb(d, tail_pts[i], tail_pts[i+1], 24 - i*4, 20 - i*5, fur_mid)
        # Tail bone spikes
        d.polygon([
            tail_pts[i],
            (tail_pts[i][0] - 15, tail_pts[i][1] - 25),
            tail_pts[i+1],
        ], fill=thorn_ivory, outline=thorn_shade)

    # 4. Forelegs & Massive Paws
    # Left foreleg
    draw_tapered_limb(d, (CX + 40, CY + 60), (CX + 35, CY + 170), 35, 25, fur_mid)
    draw_tapered_limb(d, (CX + 35, CY + 170), (CX + 25, CY + 265), 25, 22, fur_dark)
    # Left paw & claws
    d.ellipse([CX + 5, CY + 255, CX + 45, CY + 278], fill=fur_dark)
    for c_off in [10, 20, 30]:
        d.polygon([(CX + c_off, CY + 272), (CX + c_off + 4, CY + 288), (CX + c_off + 8, CY + 272)], fill=(15, 18, 15, 255))

    # Right foreleg (stepping aggressively forward)
    draw_tapered_limb(d, (CX + 120, CY + 60), (CX + 145, CY + 165), 40, 28, fur_light)
    draw_tapered_limb(d, (CX + 145, CY + 165), (CX + 165, CY + 265), 28, 24, fur_mid)
    # Right paw & claws
    d.ellipse([CX + 145, CY + 255, CX + 190, CY + 280], fill=fur_dark)
    for c_off in [150, 162, 174, 186]:
        d.polygon([(CX + c_off, CY + 274), (CX + c_off + 4, CY + 292), (CX + c_off + 8, CY + 274)], fill=(15, 18, 15, 255))

    # 5. Calcified Thorn Bone Crests along Spine & Shoulders
    spine_spikes = [
        (CX - 140, CY - 35, 30, -50),
        (CX - 100, CY - 55, 38, -60),
        (CX - 60, CY - 65, 45, -70),
        (CX - 20, CY - 70, 52, -75),
        (CX + 25, CY - 65, 58, -80),
        (CX + 75, CY - 55, 62, -85), # Massive shoulder crest
        (CX + 115, CY - 40, 50, -70),
    ]
    for sx, sy, w_sp, h_sp in spine_spikes:
        # Front face
        d.polygon([
            (sx - w_sp//2, sy),
            (sx + 8, sy + h_sp),
            (sx + w_sp//2, sy),
        ], fill=thorn_ivory, outline=(110, 100, 75, 255))
        # Shadow facet
        d.polygon([
            (sx - w_sp//2, sy),
            (sx + 8, sy + h_sp),
            (sx, sy),
        ], fill=thorn_shade)

    # 6. Predatory Wolf Head & Snarl
    # Neck mane
    mane_poly = [
        (CX + 80, CY - 60),
        (CX + 130, CY - 130),
        (CX + 190, CY - 110),
        (CX + 170, CY - 20),
    ]
    d.polygon(mane_poly, fill=fur_dark)

    # Head structure
    head_poly = [
        (CX + 120, CY - 130),
        (CX + 170, CY - 170), # Crown
        (CX + 230, CY - 130), # Brow
        (CX + 275, CY - 85),  # Muzzle tip
        (CX + 240, CY - 50),  # Lower jaw
        (CX + 180, CY - 65),  # Throat
    ]
    d.polygon(head_poly, fill=fur_mid, outline=(20, 28, 22, 255))

    # Ears
    d.polygon([(CX + 140, CY - 150), (CX + 145, CY - 210), (CX + 175, CY - 165)], fill=fur_dark, outline=thorn_shade)
    d.polygon([(CX + 175, CY - 145), (CX + 195, CY - 205), (CX + 215, CY - 150)], fill=fur_mid, outline=thorn_shade)

    # Snarling Open Jaws & Razor Fangs
    d.polygon([(CX + 220, CY - 85), (CX + 270, CY - 85), (CX + 245, CY - 55)], fill=flesh_mouth)
    # Sabertooth upper fangs
    d.polygon([(CX + 245, CY - 85), (CX + 252, CY - 40), (CX + 258, CY - 85)], fill=thorn_ivory)
    d.polygon([(CX + 260, CY - 85), (CX + 265, CY - 55), (CX + 270, CY - 85)], fill=thorn_ivory)
    # Lower fangs
    d.polygon([(CX + 240, CY - 55), (CX + 246, CY - 75), (CX + 250, CY - 55)], fill=thorn_ivory)

    # Venom drip from fangs
    d.line([(CX + 252, CY - 40), (CX + 252, CY - 15)], fill=(120, 255, 100, 255), width=3)
    d.ellipse([CX + 249, CY - 15, CX + 255, CY - 8], fill=(120, 255, 100, 255))

    # Piercing Emerald Eyes with glowing wisp
    d.polygon([(CX + 205, CY - 135), (CX + 225, CY - 130), (CX + 215, CY - 120)], fill=(90, 255, 130, 255))
    d.line([(CX + 215, CY - 130), (CX + 185, CY - 155)], fill=(140, 255, 170, 200), width=3) # eye flare

    # Head thorn spikes / brow horns
    d.polygon([(CX + 190, CY - 165), (CX + 225, CY - 215), (CX + 215, CY - 155)], fill=thorn_ivory, outline=thorn_shade)

    # Save master
    img.save(MASTERS_DIR / "thorgar.png", "PNG")
    img.save(PUBLIC_DIR / "thorgar_char.png", "PNG")

    # Shadow
    sh = create_shadow(sw=460, sh=90, alpha=220, color=(15, 25, 18))
    sh.save(MASTERS_DIR / "thorgar_shadow.png", "PNG")
    print("Thorgar completed successfully.")

# =========================================================================
# 5. ARBITER ZERO (Nexus Lv 15)
# =========================================================================
def render_arbiter_zero():
    print("Synthesizing Arbiter Zero...")
    img = create_layer()
    d = ImageDraw.Draw(img)

    # High-tech cyan energy field aura
    aura = create_layer()
    d_aura = ImageDraw.Draw(aura)
    d_aura.ellipse([CX - 230, CY - 200, CX + 230, CY + 200], fill=(20, 60, 110, 60))
    d_aura.ellipse([CX - 150, CY - 140, CX + 150, CY + 140], fill=(40, 140, 240, 75))
    aura = aura.filter(ImageFilter.GaussianBlur(25))
    img = Image.alpha_composite(img, aura)
    d = ImageDraw.Draw(img)

    # Armor Palette
    cobalt_dark = (24, 38, 58, 255)
    cobalt_mid = (42, 65, 96, 255)
    cobalt_light = (70, 105, 150, 255)
    metal_dark = (35, 40, 48, 255)
    metal_light = (110, 125, 145, 255)
    cyan_neon = (60, 220, 255, 255)
    hazard_yellow = (245, 205, 45, 255)

    # 1. Bipedal Heavy Mech Legs & Antigravity Thrusters
    # Left Leg
    d.polygon([(CX - 95, CY + 90), (CX - 135, CY + 180), (CX - 90, CY + 180), (CX - 60, CY + 90)], fill=metal_dark)
    d.polygon([(CX - 135, CY + 180), (CX - 125, CY + 270), (CX - 75, CY + 270), (CX - 90, CY + 180)], fill=cobalt_mid)
    # Right Leg
    d.polygon([(CX + 60, CY + 90), (CX + 90, CY + 180), (CX + 135, CY + 180), (CX + 95, CY + 90)], fill=metal_dark)
    d.polygon([(CX + 90, CY + 180), (CX + 75, CY + 270), (CX + 125, CY + 270), (CX + 135, CY + 180)], fill=cobalt_mid)

    # Armored Foot Treads
    d.rectangle([CX - 145, CY + 265, CX - 65, CY + 285], fill=metal_dark, outline=cobalt_light)
    d.rectangle([CX + 65, CY + 265, CX + 145, CY + 285], fill=metal_dark, outline=cobalt_light)
    # Cyan thruster glow under feet
    d.ellipse([CX - 130, CY + 282, CX - 80, CY + 292], fill=cyan_neon)
    d.ellipse([CX + 80, CY + 282, CX + 130, CY + 292], fill=cyan_neon)

    # 2. Heavy Armored Torso / Chassis
    torso_poly = [
        (CX - 110, CY - 100),
        (CX - 135, CY - 30),
        (CX - 75, CY + 95),
        (CX + 75, CY + 95),
        (CX + 135, CY - 30),
        (CX + 110, CY - 100),
    ]
    d.polygon(torso_poly, fill=cobalt_mid, outline=(15, 25, 40, 255))
    d.polygon([
        (CX - 85, CY - 85),
        (CX - 105, CY - 30),
        (CX - 60, CY + 75),
        (CX + 60, CY + 75),
        (CX + 105, CY - 30),
        (CX + 85, CY - 85),
    ], fill=cobalt_light)

    # Hazard chevrons on chest plate
    for hx in range(-50, 50, 20):
        d.polygon([(CX + hx, CY + 55), (CX + hx + 10, CY + 55), (CX + hx + 18, CY + 72), (CX + hx + 8, CY + 72)], fill=hazard_yellow)

    # 3. Hexagonal Arc-Core Power Reactor in chest center
    core_x, core_y = CX, CY - 15
    cr = 38
    hex_pts = []
    for ang_deg in range(0, 360, 60):
        rad = math.radians(ang_deg)
        hex_pts.append((core_x + int(math.cos(rad) * cr), core_y + int(math.sin(rad) * cr)))
    d.polygon(hex_pts, fill=metal_dark, outline=cyan_neon)
    # Inner glowing core
    hex_inner = []
    for ang_deg in range(0, 360, 60):
        rad = math.radians(ang_deg)
        hex_inner.append((core_x + int(math.cos(rad) * (cr - 10)), core_y + int(math.sin(rad) * (cr - 10))))
    d.polygon(hex_inner, fill=(180, 245, 255, 255))
    # Electric lightning arcs
    d.line([(core_x - 22, core_y - 8), (core_x, core_y + 12), (core_x + 24, core_y - 10)], fill=(255, 255, 255, 255), width=3)

    # 4. Massive Shoulder Pauldrons & Exhaust Vents
    # Left pauldron
    d.polygon([(CX - 110, CY - 100), (CX - 185, CY - 120), (CX - 200, CY - 40), (CX - 130, CY - 30)], fill=cobalt_dark, outline=cobalt_light)
    d.rectangle([CX - 185, CY - 110, CX - 145, CY - 85], fill=metal_dark)
    d.line([(CX - 180, CY - 98), (CX - 150, CY - 98)], fill=cyan_neon, width=3) # vent glow
    # Right pauldron
    d.polygon([(CX + 110, CY - 100), (CX + 185, CY - 120), (CX + 200, CY - 40), (CX + 130, CY - 30)], fill=cobalt_dark, outline=cobalt_light)
    d.rectangle([CX + 145, CY - 110, CX + 185, CY - 85], fill=metal_dark)
    d.line([(CX + 150, CY - 98), (CX + 180, CY - 98)], fill=cyan_neon, width=3)

    # 5. Left Arm: Rotary Kinetic Plasma Cannon
    draw_tapered_limb(d, (CX - 165, CY - 40), (CX - 190, CY + 50), 28, 22, metal_dark)
    # Cannon assembly
    d.rectangle([CX - 235, CY + 40, CX - 165, CY + 140], fill=metal_dark, outline=cobalt_light)
    # Rotary barrels
    for b_off in [-25, -10, 5, 20]:
        d.rectangle([CX - 215 + b_off, CY + 140, CX - 205 + b_off, CY + 230], fill=(85, 95, 110, 255), outline=(30, 35, 45, 255))
        d.ellipse([CX - 215 + b_off, CY + 225, CX - 205 + b_off, CY + 235], fill=cyan_neon) # glowing muzzles

    # 6. Right Arm: Hydraulic Siege Power Claw
    draw_tapered_limb(d, (CX + 165, CY - 40), (CX + 195, CY + 50), 28, 22, metal_dark)
    d.rectangle([CX + 170, CY + 40, CX + 225, CY + 120], fill=cobalt_dark, outline=cobalt_light)
    # 3 Heavy Pincer Claws
    for cy_claw, ang in [(120, 20), (150, 0), (180, -20)]:
        d.polygon([(CX + 215, CY + cy_claw - 15), (CX + 270, CY + cy_claw + ang), (CX + 225, CY + cy_claw + 15)], fill=metal_light, outline=(30, 35, 45, 255))
        d.line([(CX + 225, CY + cy_claw), (CX + 265, CY + cy_claw + ang)], fill=cyan_neon, width=2) # energized blade edge

    # 7. Angular Helm & Cycloptic Laser Scanner Visor
    helm_poly = [
        (CX - 45, CY - 100),
        (CX - 55, CY - 150),
        (CX, CY - 180),
        (CX + 55, CY - 150),
        (CX + 45, CY - 100),
        (CX, CY - 90),
    ]
    d.polygon(helm_poly, fill=cobalt_dark, outline=cobalt_light)
    # Visor slit
    d.rectangle([CX - 38, CY - 145, CX + 38, CY - 128], fill=(15, 25, 40, 255))
    d.rectangle([CX - 35, CY - 142, CX + 35, CY - 131], fill=cyan_neon)
    d.rectangle([CX - 12, CY - 141, CX + 12, CY - 132], fill=(255, 255, 255, 255))

    # Scanner beam flare
    beam = create_layer()
    d_bm = ImageDraw.Draw(beam)
    d_bm.polygon([(CX - 15, CY - 136), (CX + 15, CY - 136), (CX + 240, CY - 90), (CX - 240, CY - 90)], fill=(60, 220, 255, 60))
    beam = beam.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, beam)

    # Save master
    img.save(MASTERS_DIR / "arbiter-zero.png", "PNG")
    img.save(PUBLIC_DIR / "arbiter-zero_char.png", "PNG")

    # Shadow
    sh = create_shadow(sw=420, sh=85, alpha=210, color=(15, 25, 45))
    sh.save(MASTERS_DIR / "arbiter-zero_shadow.png", "PNG")
    print("Arbiter Zero completed successfully.")

# =========================================================================
# 6. HYDRA-RDZEŃ (Nexus Lv 20)
# =========================================================================
def render_hydra_rdzen():
    print("Synthesizing Hydra-Rdzeń...")
    img = create_layer()
    d = ImageDraw.Draw(img)

    # Quantum computing matrix aura
    aura = create_layer()
    d_aura = ImageDraw.Draw(aura)
    d_aura.ellipse([CX - 240, CY - 200, CX + 240, CY + 200], fill=(25, 45, 95, 60))
    d_aura.ellipse([CX - 160, CY - 130, CX + 160, CY + 130], fill=(60, 150, 255, 75))
    aura = aura.filter(ImageFilter.GaussianBlur(25))
    img = Image.alpha_composite(img, aura)
    d = ImageDraw.Draw(img)

    # Palette
    carbon_dark = (22, 28, 38, 255)
    carbon_mid = (38, 48, 65, 255)
    carbon_light = (65, 85, 115, 255)
    cyan_glow = (50, 215, 255, 255)
    plasma_orange = (255, 115, 40, 255)
    laser_violet = (195, 70, 255, 255)

    # 1. Floating Base Platform & Quantum Antigravity Ring
    base_y = CY + 190
    # Outer antigravity ring
    d.ellipse([CX - 210, base_y - 45, CX + 210, base_y + 45], outline=carbon_light, width=8)
    d.ellipse([CX - 195, base_y - 38, CX + 195, base_y + 38], outline=cyan_glow, width=3)
    # Energy wash under ring
    d.ellipse([CX - 180, base_y + 10, CX + 180, base_y + 55], fill=(40, 160, 255, 90))

    # Central Core Computing Crystal
    core_pts = [
        (CX, base_y - 120),
        (CX + 60, base_y - 50),
        (CX + 50, base_y + 30),
        (CX, base_y + 60),
        (CX - 50, base_y + 30),
        (CX - 60, base_y - 50),
    ]
    d.polygon(core_pts, fill=carbon_mid, outline=cyan_glow)
    d.polygon([
        (CX, base_y - 90),
        (CX + 40, base_y - 45),
        (CX + 35, base_y + 15),
        (CX, base_y + 40),
        (CX - 35, base_y + 15),
        (CX - 40, base_y - 45),
    ], fill=(160, 235, 255, 240))

    # 2. Left Serpentine Neck & Head: GŁOWICA ALFA (Plasma Cannon)
    # Neck joints
    alpha_joints = [
        (CX - 50, base_y - 40),
        (CX - 110, CY + 70),
        (CX - 160, CY - 10),
        (CX - 195, CY - 105),
    ]
    for i in range(len(alpha_joints) - 1):
        draw_tapered_limb(d, alpha_joints[i], alpha_joints[i+1], 34 - i*4, 28 - i*4, carbon_mid, outline=(15, 20, 28, 255))
        # Fiber optic line (orange plasma conduit)
        d.line([alpha_joints[i], alpha_joints[i+1]], fill=plasma_orange, width=4)

    # Alpha Head (Heavy Plasma Cannon Jaw)
    ah_x, ah_y = alpha_joints[-1]
    d.polygon([
        (ah_x + 20, ah_y + 15),
        (ah_x - 35, ah_y - 40),
        (ah_x - 95, ah_y - 15),
        (ah_x - 65, ah_y + 35),
    ], fill=carbon_dark, outline=carbon_light)
    # Cannon barrel in mouth
    d.rectangle([ah_x - 115, ah_y - 5, ah_x - 70, ah_y + 15], fill=(55, 65, 80, 255), outline=plasma_orange)
    d.ellipse([ah_x - 118, ah_y - 3, ah_x - 108, ah_y + 13], fill=plasma_orange) # glowing plasma muzzle
    # Orange optic eye
    d.ellipse([ah_x - 60, ah_y - 25, ah_x - 45, ah_y - 15], fill=plasma_orange)

    # 3. Right Serpentine Neck & Head: GŁOWICA GAMMA (Hydraulic Ram)
    gamma_joints = [
        (CX + 50, base_y - 40),
        (CX + 110, CY + 70),
        (CX + 160, CY - 10),
        (CX + 195, CY - 105),
    ]
    for i in range(len(gamma_joints) - 1):
        draw_tapered_limb(d, gamma_joints[i], gamma_joints[i+1], 34 - i*4, 28 - i*4, carbon_mid, outline=(15, 20, 28, 255))
        # Fiber optic line (violet laser conduit)
        d.line([gamma_joints[i], gamma_joints[i+1]], fill=laser_violet, width=4)

    # Gamma Head (Crushing Hydraulic Ram)
    gh_x, gh_y = gamma_joints[-1]
    d.polygon([
        (gh_x - 20, gh_y + 15),
        (gh_x + 35, gh_y - 40),
        (gh_x + 95, gh_y - 15),
        (gh_x + 65, gh_y + 35),
    ], fill=carbon_dark, outline=carbon_light)
    # Heavy reinforced ram teeth
    for rt_x in [gh_x + 60, gh_x + 75, gh_x + 90]:
        d.polygon([(rt_x, gh_y + 30), (rt_x + 6, gh_y + 50), (rt_x + 12, gh_y + 30)], fill=(180, 195, 215, 255))
    # Violet optic eye
    d.ellipse([gh_x + 45, gh_y - 25, gh_x + 60, gh_y - 15], fill=laser_violet)

    # 4. Center Serpentine Neck & Head: GŁOWICA BETA PRIME (Laser Master Head)
    beta_joints = [
        (CX, base_y - 60),
        (CX + 10, CY + 40),
        (CX - 10, CY - 60),
        (CX, CY - 180),
    ]
    for i in range(len(beta_joints) - 1):
        draw_tapered_limb(d, beta_joints[i], beta_joints[i+1], 40 - i*5, 34 - i*5, carbon_dark, outline=(15, 20, 28, 255))
        # Triple cyan data conduits
        d.line([(beta_joints[i][0] - 6, beta_joints[i][1]), (beta_joints[i+1][0] - 6, beta_joints[i+1][1])], fill=cyan_glow, width=3)
        d.line([(beta_joints[i][0] + 6, beta_joints[i][1]), (beta_joints[i+1][0] + 6, beta_joints[i+1][1])], fill=cyan_glow, width=3)

    # Beta Prime Head (Crowned Cyber Dragon with Laser Horns)
    bh_x, bh_y = beta_joints[-1]
    d.polygon([
        (bh_x - 45, bh_y + 25),
        (bh_x - 55, bh_y - 35),
        (bh_x, bh_y - 85),
        (bh_x + 55, bh_y - 35),
        (bh_x + 45, bh_y + 25),
        (bh_x, bh_y + 45),
    ], fill=carbon_light, outline=(15, 20, 28, 255))

    # Swept-back antenna horns
    d.polygon([(bh_x - 40, bh_y - 50), (bh_x - 105, bh_y - 110), (bh_x - 30, bh_y - 70)], fill=carbon_dark, outline=cyan_glow)
    d.polygon([(bh_x + 40, bh_y - 50), (bh_x + 105, bh_y - 110), (bh_x + 30, bh_y - 70)], fill=carbon_dark, outline=cyan_glow)

    # Cycloptic Laser Emitter Visor
    d.rectangle([bh_x - 30, bh_y - 25, bh_x + 30, bh_y - 8], fill=(15, 25, 40, 255))
    d.rectangle([bh_x - 26, bh_y - 22, bh_x + 26, bh_y - 11], fill=cyan_glow)
    d.ellipse([bh_x - 8, bh_y - 21, bh_x + 8, bh_y - 12], fill=(255, 255, 255, 255))

    # 5. Orbiting Memory Node Satellites
    for sat_ang, sat_r, sat_col in [(0.4, 210, cyan_glow), (2.5, 220, plasma_orange), (4.5, 205, laser_violet)]:
        sat_x = CX + int(math.cos(sat_ang) * sat_r)
        sat_y = CY + 80 + int(math.sin(sat_ang) * 60)
        d.rectangle([sat_x - 15, sat_y - 15, sat_x + 15, sat_y + 15], fill=carbon_dark, outline=sat_col)
        d.ellipse([sat_x - 6, sat_y - 6, sat_x + 6, sat_y + 6], fill=sat_col)

    # Save master
    img.save(MASTERS_DIR / "hydra-rdzen.png", "PNG")
    img.save(PUBLIC_DIR / "hydra-rdzen_char.png", "PNG")

    # Shadow
    sh = create_shadow(sw=460, sh=95, alpha=220, color=(15, 25, 45))
    sh.save(MASTERS_DIR / "hydra-rdzen_shadow.png", "PNG")
    print("Hydra-Rdzeń completed successfully.")

# =========================================================================
# 7. KHARZUL, MISTRZ ARENY (Pyra Lv 15)
# =========================================================================
def render_kharzul():
    print("Synthesizing Kharzul, Mistrz Areny...")
    img = create_layer()
    d = ImageDraw.Draw(img)

    # Molten crater fire aura
    aura = create_layer()
    d_aura = ImageDraw.Draw(aura)
    d_aura.ellipse([CX - 230, CY - 200, CX + 230, CY + 200], fill=(110, 35, 15, 60))
    d_aura.ellipse([CX - 150, CY - 140, CX + 150, CY + 140], fill=(240, 95, 25, 75))
    aura = aura.filter(ImageFilter.GaussianBlur(25))
    img = Image.alpha_composite(img, aura)
    d = ImageDraw.Draw(img)

    # Palette
    obsidian_dark = (22, 20, 22, 255)
    obsidian_mid = (42, 38, 42, 255)
    obsidian_light = (75, 70, 75, 255)
    molten_orange = (255, 95, 20, 255)
    fire_yellow = (255, 225, 65, 255)
    cloth_crimson = (145, 25, 30, 255)

    # 1. Tattered War Cloak (Billowing in background)
    cloak_poly = [
        (CX - 110, CY - 80),
        (CX - 190, CY + 140),
        (CX - 130, CY + 265),
        (CX - 40, CY + 275),
        (CX + 60, CY + 260),
        (CX + 110, CY - 80),
    ]
    d.polygon(cloak_poly, fill=cloth_crimson, outline=(60, 15, 18, 255))
    # Cloak tattered tears
    for tx in range(CX - 170, CX + 50, 25):
        d.polygon([(tx, CY + 250), (tx + 12, CY + 275), (tx + 24, CY + 250)], fill=(0, 0, 0, 0))

    # 2. Heavy Obsidian Greaves & Armored Legs
    # Left leg
    draw_tapered_limb(d, (CX - 75, CY + 85), (CX - 85, CY + 180), 34, 26, obsidian_dark)
    draw_tapered_limb(d, (CX - 85, CY + 180), (CX - 80, CY + 265), 26, 22, obsidian_mid)
    d.rectangle([CX - 105, CY + 260, CX - 55, CY + 280], fill=obsidian_dark, outline=obsidian_light)
    # Right leg (planted firmly)
    draw_tapered_limb(d, (CX + 75, CY + 85), (CX + 85, CY + 180), 34, 26, obsidian_dark)
    draw_tapered_limb(d, (CX + 85, CY + 180), (CX + 80, CY + 265), 26, 22, obsidian_mid)
    d.rectangle([CX + 55, CY + 260, CX + 105, CY + 280], fill=obsidian_dark, outline=obsidian_light)

    # Glowing molten fissures in leg armor
    d.line([(CX - 85, CY + 120), (CX - 80, CY + 175), (CX - 88, CY + 235)], fill=molten_orange, width=3)
    d.line([(CX + 85, CY + 120), (CX + 80, CY + 175), (CX + 88, CY + 235)], fill=molten_orange, width=3)

    # 3. Torso & Molten Vein Cuirass
    torso_poly = [
        (CX - 105, CY - 90),
        (CX - 125, CY - 20),
        (CX - 65, CY + 90),
        (CX + 65, CY + 90),
        (CX + 125, CY - 20),
        (CX + 105, CY - 90),
    ]
    d.polygon(torso_poly, fill=obsidian_mid, outline=(15, 12, 15, 255))
    # Molten vein fissures across chest
    d.line([(CX - 85, CY - 60), (CX - 25, CY - 10), (CX, CY - 35), (CX + 45, CY - 10), (CX + 85, CY - 60)], fill=molten_orange, width=4)
    d.line([(CX - 20, CY - 10), (CX, CY + 45), (CX + 20, CY - 10)], fill=fire_yellow, width=3)
    # Spiked belt & war skirt
    d.rectangle([CX - 75, CY + 75, CX + 75, CY + 95], fill=(55, 45, 35, 255), outline=molten_orange)

    # 4. Colossal Spiked Pauldrons
    # Left pauldron
    d.polygon([(CX - 105, CY - 90), (CX - 180, CY - 120), (CX - 195, CY - 35), (CX - 120, CY - 25)], fill=obsidian_dark, outline=obsidian_light)
    d.polygon([(CX - 180, CY - 120), (CX - 215, CY - 165), (CX - 155, CY - 110)], fill=obsidian_light) # heavy spike
    # Right pauldron
    d.polygon([(CX + 105, CY - 90), (CX + 180, CY - 120), (CX + 195, CY - 35), (CX + 120, CY - 25)], fill=obsidian_dark, outline=obsidian_light)
    d.polygon([(CX + 180, CY - 120), (CX + 215, CY - 165), (CX + 155, CY - 110)], fill=obsidian_light)

    # 5. Left Arm (Molten Chains wrapped)
    draw_tapered_limb(d, (CX - 150, CY - 30), (CX - 185, CY + 60), 26, 20, obsidian_mid)
    draw_tapered_limb(d, (CX - 185, CY + 60), (CX - 160, CY + 140), 20, 16, obsidian_dark)
    # Molten chain links
    for l_y in range(CY + 10, CY + 120, 18):
        d.ellipse([CX - 185, l_y - 8, CX - 165, l_y + 8], outline=molten_orange, width=3)

    # 6. Right Arm & Colossal Flaming Executioner Greatsword
    draw_tapered_limb(d, (CX + 150, CY - 30), (CX + 195, CY + 50), 26, 20, obsidian_mid)
    draw_tapered_limb(d, (CX + 195, CY + 50), (CX + 175, CY + 130), 20, 18, obsidian_dark)

    # GREATSWORD: Massive jagged obsidian blade angled upwards
    # Blade length ~360px
    hilt_x, hilt_y = CX + 175, CY + 130
    tip_x, tip_y = CX + 250, CY - 230
    # Crossguard
    d.polygon([(hilt_x - 35, hilt_y - 15), (hilt_x + 35, hilt_y + 15), (hilt_x + 25, hilt_y + 35), (hilt_x - 45, hilt_y + 5)], fill=obsidian_dark, outline=molten_orange)
    # Blade polygon
    blade_poly = [
        (hilt_x - 22, hilt_y - 20),
        (tip_x - 30, tip_y + 30),
        (tip_x, tip_y),
        (tip_x + 15, tip_y + 20),
        (hilt_x + 18, hilt_y - 8),
    ]
    d.polygon(blade_poly, fill=obsidian_dark, outline=obsidian_light)
    # Central molten fuller
    d.line([(hilt_x - 2, hilt_y - 14), (tip_x - 8, tip_y + 15)], fill=molten_orange, width=5)
    d.line([(hilt_x - 2, hilt_y - 14), (tip_x - 8, tip_y + 15)], fill=fire_yellow, width=2)

    # Raging Roaring Flames enveloping sword
    flames = create_layer()
    d_fl = ImageDraw.Draw(flames)
    for f_idx in range(18):
        ft = f_idx / 18.0
        fx = int(hilt_x + (tip_x - hilt_x) * ft)
        fy = int(hilt_y + (tip_y - hilt_y) * ft)
        fr = int(22 + math.sin(ft * math.pi) * 20)
        d_fl.ellipse([fx - fr, fy - fr, fx + fr, fy + fr], fill=(255, 110, 20, 160))
        d_fl.ellipse([fx - fr//2, fy - fr//2, fx + fr//2, fy + fr//2], fill=(255, 230, 70, 210))
    flames = flames.filter(ImageFilter.GaussianBlur(6))
    img = Image.alpha_composite(img, flames)
    d = ImageDraw.Draw(img)

    # 7. Horned Gladiator Barbute Helmet & Visor Slit
    helm_poly = [
        (CX - 40, CY - 90),
        (CX - 50, CY - 150),
        (CX, CY - 180),
        (CX + 50, CY - 150),
        (CX + 40, CY - 90),
        (CX, CY - 80),
    ]
    d.polygon(helm_poly, fill=obsidian_dark, outline=obsidian_light)

    # Sweeping Demonic Horns
    d.polygon([(CX - 45, CY - 145), (CX - 125, CY - 205), (CX - 35, CY - 165)], fill=obsidian_mid, outline=molten_orange)
    d.polygon([(CX + 45, CY - 145), (CX + 125, CY - 205), (CX + 35, CY - 165)], fill=obsidian_mid, outline=molten_orange)

    # Visor slit glowing with white-hot furnace fire
    d.rectangle([CX - 30, CY - 135, CX + 30, CY - 122], fill=(20, 15, 15, 255))
    d.rectangle([CX - 26, CY - 132, CX + 26, CY - 125], fill=molten_orange)
    d.ellipse([CX - 10, CY - 131, CX + 10, CY - 126], fill=fire_yellow)

    # Save master
    img.save(MASTERS_DIR / "kharzul.png", "PNG")
    img.save(PUBLIC_DIR / "kharzul_char.png", "PNG")

    # Shadow
    sh = create_shadow(sw=440, sh=85, alpha=220, color=(35, 15, 15))
    sh.save(MASTERS_DIR / "kharzul_shadow.png", "PNG")
    print("Kharzul completed successfully.")

# =========================================================================
# 8. PYRRHAX, SMOK WULKANU (Pyra Lv 20)
# =========================================================================
def render_pyrrhax():
    print("Synthesizing Pyrrhax, Smok Wulkanu...")
    img = create_layer()
    d = ImageDraw.Draw(img)

    # Cataclysmic volcanic eruption aura
    aura = create_layer()
    d_aura = ImageDraw.Draw(aura)
    d_aura.ellipse([CX - 250, CY - 210, CX + 250, CY + 210], fill=(130, 35, 15, 65))
    d_aura.ellipse([CX - 160, CY - 140, CX + 160, CY + 140], fill=(255, 105, 25, 80))
    aura = aura.filter(ImageFilter.GaussianBlur(28))
    img = Image.alpha_composite(img, aura)
    d = ImageDraw.Draw(img)

    # Palette
    basalt_dark = (25, 20, 24, 255)
    basalt_mid = (45, 38, 44, 255)
    basalt_light = (78, 68, 76, 255)
    magma_glow = (255, 90, 15, 255)
    magma_core = (255, 220, 60, 255)

    # 1. Colossal Obsidian Wings with Liquid Magma Webbing
    # Left Wing
    l_wing_bone = [(CX - 60, CY - 40), (CX - 190, CY - 180), (CX - 280, CY - 150)]
    d.polygon([
        l_wing_bone[0],
        l_wing_bone[1],
        l_wing_bone[2],
        (CX - 240, CY - 40),
        (CX - 160, CY + 40),
        (CX - 80, CY + 20),
    ], fill=(95, 28, 18, 230), outline=basalt_dark)
    # Wing bones
    draw_tapered_limb(d, l_wing_bone[0], l_wing_bone[1], 24, 16, basalt_dark)
    draw_tapered_limb(d, l_wing_bone[1], l_wing_bone[2], 16, 8, basalt_dark)
    # Magma veins on left wing
    d.line([l_wing_bone[1], (CX - 240, CY - 40)], fill=magma_glow, width=3)
    d.line([l_wing_bone[1], (CX - 160, CY + 40)], fill=magma_glow, width=3)

    # Right Wing
    r_wing_bone = [(CX + 60, CY - 40), (CX + 190, CY - 180), (CX + 280, CY - 150)]
    d.polygon([
        r_wing_bone[0],
        r_wing_bone[1],
        r_wing_bone[2],
        (CX + 240, CY - 40),
        (CX + 160, CY + 40),
        (CX + 80, CY + 20),
    ], fill=(95, 28, 18, 230), outline=basalt_dark)
    draw_tapered_limb(d, r_wing_bone[0], r_wing_bone[1], 24, 16, basalt_dark)
    draw_tapered_limb(d, r_wing_bone[1], r_wing_bone[2], 16, 8, basalt_dark)
    d.line([r_wing_bone[1], (CX + 240, CY - 40)], fill=magma_glow, width=3)
    d.line([r_wing_bone[1], (CX + 160, CY + 40)], fill=magma_glow, width=3)

    # 2. Muscular Dragon Tail ending in Spiked Volcanic Club
    tail_pts = [(CX - 120, CY + 140), (CX - 180, CY + 190), (CX - 240, CY + 220), (CX - 290, CY + 210)]
    for i in range(len(tail_pts) - 1):
        draw_tapered_limb(d, tail_pts[i], tail_pts[i+1], 35 - i*7, 28 - i*7, basalt_mid)
        d.line([tail_pts[i], tail_pts[i+1]], fill=magma_glow, width=3)
    # Spiked Club
    d.ellipse([tail_pts[-1][0] - 25, tail_pts[-1][1] - 25, tail_pts[-1][0] + 25, tail_pts[-1][1] + 25], fill=basalt_dark, outline=magma_glow)
    for sp_ang in range(0, 360, 60):
        rad = math.radians(sp_ang)
        sp_x = tail_pts[-1][0] + int(math.cos(rad) * 35)
        sp_y = tail_pts[-1][1] + int(math.sin(rad) * 35)
        d.polygon([(tail_pts[-1][0], tail_pts[-1][1]), (sp_x, sp_y), (tail_pts[-1][0] + 5, tail_pts[-1][1] + 5)], fill=basalt_light)

    # 3. Colossal Dragon Body & Caldera Furnace Chest
    body_poly = [
        (CX - 120, CY + 140),
        (CX - 90, CY - 10),
        (CX - 10, CY - 50),
        (CX + 80, CY - 10),
        (CX + 120, CY + 140),
        (CX, CY + 210),
    ]
    d.polygon(body_poly, fill=basalt_dark, outline=(15, 12, 15, 255))

    # Caldera Furnace Chest (Glowing liquid magma inside ribs)
    caldera = create_layer()
    d_cal = ImageDraw.Draw(caldera)
    d_cal.ellipse([CX - 75, CY + 20, CX + 75, CY + 150], fill=(255, 80, 15, 220))
    d_cal.ellipse([CX - 45, CY + 45, CX + 45, CY + 125], fill=(255, 230, 80, 255))
    caldera = caldera.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, caldera)
    d = ImageDraw.Draw(img)

    # Basalt rib cage plates covering furnace
    for ry in range(CY + 30, CY + 150, 24):
        d.polygon([(CX - 85, ry), (CX - 15, ry + 12), (CX - 15, ry - 6), (CX - 85, ry - 14)], fill=basalt_mid)
        d.polygon([(CX + 85, ry), (CX + 15, ry + 12), (CX + 15, ry - 6), (CX + 85, ry - 14)], fill=basalt_mid)

    # 4. Massive Forelegs & Claws
    # Left foreleg
    draw_tapered_limb(d, (CX - 80, CY + 120), (CX - 110, CY + 210), 38, 28, basalt_mid)
    draw_tapered_limb(d, (CX - 110, CY + 210), (CX - 100, CY + 270), 28, 24, basalt_dark)
    for c_x in [-130, -110, -90]:
        d.polygon([(CX + c_x, CY + 265), (CX + c_x + 8, CY + 288), (CX + c_x + 16, CY + 265)], fill=(12, 10, 12, 255))

    # Right foreleg
    draw_tapered_limb(d, (CX + 80, CY + 120), (CX + 110, CY + 210), 38, 28, basalt_mid)
    draw_tapered_limb(d, (CX + 110, CY + 210), (CX + 100, CY + 270), 28, 24, basalt_dark)
    for c_x in [90, 110, 130]:
        d.polygon([(CX + c_x, CY + 265), (CX + c_x + 8, CY + 288), (CX + c_x + 16, CY + 265)], fill=(12, 10, 12, 255))

    # 5. Serpentine Neck & Roaring Draconic Horned Head
    neck_joints = [(CX, CY - 30), (CX + 15, CY - 100), (CX + 45, CY - 170)]
    for i in range(len(neck_joints) - 1):
        draw_tapered_limb(d, neck_joints[i], neck_joints[i+1], 45 - i*6, 38 - i*6, basalt_mid, outline=(15, 12, 15, 255))
        d.line([neck_joints[i], neck_joints[i+1]], fill=magma_glow, width=5)

    # Dragon Skull & Roaring Jaws
    head_x, head_y = neck_joints[-1]
    head_poly = [
        (head_x - 30, head_y - 20),
        (head_x + 10, head_y - 70),
        (head_x + 95, head_y - 35),
        (head_x + 135, head_y),     # Upper snout tip
        (head_x + 85, head_y + 35), # Lower jaw
        (head_x + 20, head_y + 20),
    ]
    d.polygon(head_poly, fill=basalt_dark, outline=basalt_light)

    # Sweeping Volcanic Magma Horns
    d.polygon([(head_x - 20, head_y - 45), (head_x - 110, head_y - 125), (head_x, head_y - 65)], fill=basalt_light, outline=magma_glow)
    d.polygon([(head_x + 15, head_y - 60), (head_x - 65, head_y - 145), (head_x + 35, head_y - 75)], fill=basalt_light, outline=magma_glow)

    # Roaring Jaws with Liquid Fire Breath
    d.polygon([(head_x + 70, head_y - 5), (head_x + 130, head_y), (head_x + 95, head_y + 25)], fill=(160, 30, 20, 255))
    # Razor basalt teeth
    for t_x in range(head_x + 80, head_x + 125, 12):
        d.polygon([(t_x, head_y - 4), (t_x + 4, head_y + 8), (t_x + 8, head_y - 4)], fill=basalt_light)

    # White-hot fire breath cone
    breath = create_layer()
    d_br = ImageDraw.Draw(breath)
    d_br.polygon([(head_x + 115, head_y + 10), (head_x + 230, head_y - 30), (head_x + 250, head_y + 50)], fill=(255, 120, 20, 180))
    d_br.polygon([(head_x + 115, head_y + 10), (head_x + 190, head_y - 10), (head_x + 200, head_y + 30)], fill=(255, 240, 90, 230))
    breath = breath.filter(ImageFilter.GaussianBlur(6))
    img = Image.alpha_composite(img, breath)
    d = ImageDraw.Draw(img)

    # Glowing molten eyes
    d.ellipse([head_x + 45, head_y - 35, head_x + 62, head_y - 20], fill=magma_core)

    # Save master
    img.save(MASTERS_DIR / "pyrrhax.png", "PNG")
    img.save(PUBLIC_DIR / "pyrrhax_char.png", "PNG")

    # Shadow
    sh = create_shadow(sw=480, sh=100, alpha=230, color=(35, 15, 15))
    sh.save(MASTERS_DIR / "pyrrhax_shadow.png", "PNG")
    print("Pyrrhax completed successfully.")

def synthesize_all():
    render_ygdrasha()
    render_thorgar()
    render_arbiter_zero()
    render_hydra_rdzen()
    render_kharzul()
    render_pyrrhax()
    print("\nALL 6 REMAINING BOSS MASTERS SYNTHESIZED SUCCESSFULLY!")

if __name__ == "__main__":
    synthesize_all()
