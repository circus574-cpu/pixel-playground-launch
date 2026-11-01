#!/usr/bin/env python3
"""Batch multi-layer 60 FPS animation renderer for all Ki Legends bosses:
1. ygdrasha
2. thorgar
3. arcykaplan-pustki
4. aurelith (already rendered, standardized)
5. arbiter-zero
6. hydra-rdzen
7. kharzul
8. pyrrhax

Generates:
- public/game/bosses/<id>_idle.webp (Full 32-frame alpha loop)
- public/game/bosses/<id>_idle.gif (Optimized animated GIF)
- art/production/bosses/<id>_spritesheet.png (4x8 grid sprite sheet)
"""

import math
import os
import shutil
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
MASTERS_DIR = ROOT / "art" / "production" / "bosses" / "masters"
PUB_DIR = ROOT / "public" / "game" / "bosses"
ART_DIR = ROOT / "art" / "production" / "bosses"

PUB_DIR.mkdir(parents=True, exist_ok=True)
ART_DIR.mkdir(parents=True, exist_ok=True)

FW, FH = 512, 580
CX, CY = FW // 2, 260
SHADOW_Y = 515
NUM_FRAMES = 32

def save_formats(boss_id, frames):
    print(f"  Encoding {boss_id} (WebP & GIF & Spritesheet)...")
    
    # 1. Animated WebP (Full resolution with alpha)
    webp_pub = PUB_DIR / f"{boss_id}_idle.webp"
    webp_art = ART_DIR / f"{boss_id}_idle.webp"
    frames[0].save(
        webp_pub,
        "WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=33, # ~30 FPS
        loop=0,
        quality=92,
        method=4
    )
    shutil.copyfile(webp_pub, webp_art)
    
    # 2. Animated GIF (Scaled to 384x435 for lightweight web)
    gif_frames = [f.resize((384, 435), Image.Resampling.BILINEAR) for f in frames]
    gif_pub = PUB_DIR / f"{boss_id}_idle.gif"
    gif_art = ART_DIR / f"{boss_id}_idle.gif"
    gif_frames[0].save(
        gif_pub,
        "GIF",
        save_all=True,
        append_images=gif_frames[1:],
        duration=33,
        loop=0,
        disposal=2
    )
    shutil.copyfile(gif_pub, gif_art)
    
    # 3. Spritesheet (8 columns x 4 rows)
    # 8 cols * 128 = 1024, 4 rows * 145 = 580
    thumb_w, thumb_h = 128, 145
    sheet = Image.new("RGBA", (thumb_w * 8, thumb_h * 4), (0, 0, 0, 0))
    for idx, fr in enumerate(frames):
        c = idx % 8
        r = idx // 8
        thumb = fr.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.alpha_composite(thumb, (c * thumb_w, r * thumb_h))
    sheet.save(ART_DIR / f"{boss_id}_spritesheet.png", "PNG")
    sheet.save(PUB_DIR / f"{boss_id}_spritesheet.png", "PNG")
    print(f"  Done {boss_id}!")

# =========================================================================
# 1. YGDRASHA (Verdant Lv 15)
# =========================================================================
def animate_ygdrasha():
    print("Rendering animation: Ygdrasha, Matka Puszczy...")
    char_img = Image.open(MASTERS_DIR / "ygdrasha.png").convert("RGBA")
    shadow_img = Image.open(MASTERS_DIR / "ygdrasha_shadow.png").convert("RGBA")
    char_img.thumbnail((440, 480), Image.Resampling.LANCZOS)
    cw, ch = char_img.size
    sw, sh = shadow_img.size
    
    frames = []
    for f_idx in range(NUM_FRAMES):
        t = f_idx / float(NUM_FRAMES)
        w = 2.0 * math.pi * t
        
        frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        
        # Ground Shadow
        sw_curr = max(10, int(sw * 0.9 + 0.05 * math.cos(w) * sw))
        sh_curr = max(4, int(sh * 0.9 + 0.05 * math.cos(w) * sh))
        sh_sc = shadow_img.resize((sw_curr, sh_curr), Image.Resampling.BILINEAR)
        frame.alpha_composite(sh_sc, (CX - sw_curr // 2, SHADOW_Y - sh_curr // 2))
        
        # Breathing scale
        scale_x = 1.0 + 0.015 * math.cos(w)
        scale_y = 1.0 + 0.02 * math.sin(w)
        cur_w = int(cw * scale_x)
        cur_h = int(ch * scale_y)
        char_sc = char_img.resize((cur_w, cur_h), Image.Resampling.LANCZOS)
        
        # Anchor base at root level
        top_y = SHADOW_Y - 30 - cur_h
        frame.alpha_composite(char_sc, (CX - cur_w // 2, top_y))
        
        # Heart pulse in chest
        heart_x = CX
        heart_y = top_y + int(cur_h * 0.52)
        h_pulse = 1.0 + 0.25 * math.sin(w * 2)
        hr = int(24 * h_pulse)
        
        h_glow = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        d_hg = ImageDraw.Draw(h_glow)
        d_hg.ellipse([heart_x - hr*2, heart_y - hr*2, heart_x + hr*2, heart_y + hr*2], fill=(255, 180, 50, int(110 * h_pulse)))
        d_hg.ellipse([heart_x - hr, heart_y - hr, heart_x + hr, heart_y + hr], fill=(255, 240, 120, int(210 * h_pulse)))
        h_glow = h_glow.filter(ImageFilter.GaussianBlur(6))
        frame = Image.alpha_composite(frame, h_glow)
        
        # Drifting spores
        spores = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        d_sp = ImageDraw.Draw(spores)
        for p_i in range(16):
            phase = (t + p_i / 16.0) % 1.0
            p_x = CX + int(math.sin(p_i * 1.5 + phase * 3) * (90 + p_i * 6))
            p_y = int(SHADOW_Y - 40 - phase * 360)
            p_alpha = int(math.sin(phase * math.pi) * 220)
            p_col = (120, 255, 130, p_alpha) if p_i % 2 == 0 else (255, 220, 80, p_alpha)
            d_sp.ellipse([p_x - 3, p_y - 3, p_x + 3, p_y + 3], fill=p_col)
        spores = spores.filter(ImageFilter.GaussianBlur(1))
        frame = Image.alpha_composite(frame, spores)
        
        frames.append(frame)
    save_formats("ygdrasha", frames)

# =========================================================================
# 2. THORGAR (Verdant Lv 20)
# =========================================================================
def animate_thorgar():
    print("Rendering animation: Thorgar, Alfa Kłów...")
    char_img = Image.open(MASTERS_DIR / "thorgar.png").convert("RGBA")
    shadow_img = Image.open(MASTERS_DIR / "thorgar_shadow.png").convert("RGBA")
    char_img.thumbnail((450, 440), Image.Resampling.LANCZOS)
    cw, ch = char_img.size
    sw, sh = shadow_img.size
    
    frames = []
    for f_idx in range(NUM_FRAMES):
        t = f_idx / float(NUM_FRAMES)
        w = 2.0 * math.pi * t
        
        frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        
        # Ground Shadow
        sw_curr = max(10, int(sw * 0.95 + 0.05 * math.sin(w) * sw))
        sh_curr = max(4, int(sh * 0.95 + 0.05 * math.sin(w) * sh))
        sh_sc = shadow_img.resize((sw_curr, sh_curr), Image.Resampling.BILINEAR)
        frame.alpha_composite(sh_sc, (CX - sw_curr // 2, SHADOW_Y - sh_curr // 2))
        
        # Heavy predatory breathing heave
        heave_y = -7.0 * math.sin(w)
        scale_x = 1.0 + 0.02 * math.cos(w)
        scale_y = 1.0 - 0.015 * math.cos(w)
        cur_w = int(cw * scale_x)
        cur_h = int(ch * scale_y)
        char_sc = char_img.resize((cur_w, cur_h), Image.Resampling.LANCZOS)
        
        top_y = int(SHADOW_Y - 20 - cur_h + heave_y)
        frame.alpha_composite(char_sc, (CX - cur_w // 2, top_y))
        
        # Glowing eye trails
        eye_x = CX - cur_w // 2 + int(cur_w * 0.77)
        eye_y = top_y + int(cur_h * 0.35)
        eye_trail = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        d_et = ImageDraw.Draw(eye_trail)
        flare_len = int(22 + 8 * math.sin(w * 2))
        d_et.line([(eye_x, eye_y), (eye_x - flare_len, eye_y - 12)], fill=(120, 255, 140, 220), width=4)
        d_et.ellipse([eye_x - 4, eye_y - 4, eye_x + 4, eye_y + 4], fill=(220, 255, 230, 255))
        
        # Dripping venom drop
        venom_phase = (t * 2.0) % 1.0
        vy = top_y + int(cur_h * 0.52) + int(venom_phase * 35)
        vx = CX - cur_w // 2 + int(cur_w * 0.84)
        v_alpha = int((1.0 - venom_phase) * 240)
        d_et.ellipse([vx - 3, vy - 4, vx + 3, vy + 4], fill=(110, 255, 90, v_alpha))
        
        eye_trail = eye_trail.filter(ImageFilter.GaussianBlur(1))
        frame = Image.alpha_composite(frame, eye_trail)
        
        frames.append(frame)
    save_formats("thorgar", frames)

# =========================================================================
# 3. ARCYKAPŁAN PUSTKI (Aether Lv 15)
# =========================================================================
def animate_arcykaplan():
    print("Rendering animation: Arcykapłan Pustki...")
    char_img = Image.open(MASTERS_DIR / "arcykaplan-pustki.png").convert("RGBA")
    shadow_img = Image.open(MASTERS_DIR / "arcykaplan-pustki_shadow.png").convert("RGBA")
    char_img.thumbnail((380, 460), Image.Resampling.LANCZOS)
    cw, ch = char_img.size
    sw, sh = shadow_img.size
    
    frames = []
    for f_idx in range(NUM_FRAMES):
        t = f_idx / float(NUM_FRAMES)
        w = 2.0 * math.pi * t
        
        frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        
        # Vertical hover float
        hover_y = -15.0 * math.sin(w)
        
        # Responsive ground shadow
        shadow_sc = 1.0 - (hover_y / 15.0) * 0.15
        sw_curr = max(10, int(sw * shadow_sc))
        sh_curr = max(4, int(sh * shadow_sc))
        sh_sc = shadow_img.resize((sw_curr, sh_curr), Image.Resampling.BILINEAR)
        frame.alpha_composite(sh_sc, (CX - sw_curr // 2, SHADOW_Y - sh_curr // 2))
        
        # Floating ethereal archpriest body
        cur_w = int(cw * (1.0 - 0.012 * math.cos(w)))
        cur_h = int(ch * (1.0 + 0.015 * math.cos(w)))
        char_sc = char_img.resize((cur_w, cur_h), Image.Resampling.LANCZOS)
        char_y = int(CY - 30 + hover_y)
        frame.alpha_composite(char_sc, (CX - cur_w // 2, char_y - cur_h // 2))
        
        # Orbiting Void Singularity Sphere (above left hand)
        orb_x = CX - cur_w // 2 + int(cur_w * 0.18)
        orb_y = int(char_y - cur_h // 2 + cur_h * 0.35 + math.sin(w * 1.5) * 6)
        
        orb_layer = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        d_ol = ImageDraw.Draw(orb_layer)
        # Singularity core
        orb_r = int(22 + 4 * math.sin(w * 2))
        d_ol.ellipse([orb_x - orb_r*2, orb_y - orb_r*2, orb_x + orb_r*2, orb_y + orb_r*2], fill=(50, 140, 255, 90))
        d_ol.ellipse([orb_x - orb_r, orb_y - orb_r, orb_x + orb_r, orb_y + orb_r], fill=(130, 220, 255, 180))
        d_ol.ellipse([orb_x - orb_r//2, orb_y - orb_r//2, orb_x + orb_r//2, orb_y + orb_r//2], fill=(255, 255, 255, 255))
        
        # 3 Orbiting Świetliki Pieczęci (Phase 2 reference from catalog!)
        for n in range(3):
            rot_ang = w + n * (2.0 * math.pi / 3.0)
            sx = orb_x + int(math.cos(rot_ang) * 45)
            sy = orb_y + int(math.sin(rot_ang) * 18)
            d_ol.ellipse([sx - 6, sy - 6, sx + 6, sy + 6], fill=(200, 245, 255, 255))
            d_ol.ellipse([sx - 10, sy - 10, sx + 10, sy + 10], fill=(0, 190, 255, 120))
            
        orb_layer = orb_layer.filter(ImageFilter.GaussianBlur(2))
        frame = Image.alpha_composite(frame, orb_layer)
        
        frames.append(frame)
    save_formats("arcykaplan-pustki", frames)

# =========================================================================
# 4. AURELITH (Aether Lv 20) - Standardize existing
# =========================================================================
def copy_aurelith():
    print("Standardizing Aurelith assets...")
    for ext in ["idle.webp", "idle.gif", "spritesheet.png"]:
        src = ART_DIR / f"boss_astral_{ext}"
        if src.exists():
            shutil.copyfile(src, PUB_DIR / f"aurelith_{ext}")
            shutil.copyfile(src, ART_DIR / f"aurelith_{ext}")
    print("Aurelith standardized successfully.")

# =========================================================================
# 5. ARBITER ZERO (Nexus Lv 15)
# =========================================================================
def animate_arbiter_zero():
    print("Rendering animation: Arbiter Zero...")
    char_img = Image.open(MASTERS_DIR / "arbiter-zero.png").convert("RGBA")
    shadow_img = Image.open(MASTERS_DIR / "arbiter-zero_shadow.png").convert("RGBA")
    char_img.thumbnail((450, 480), Image.Resampling.LANCZOS)
    cw, ch = char_img.size
    sw, sh = shadow_img.size
    
    frames = []
    for f_idx in range(NUM_FRAMES):
        t = f_idx / float(NUM_FRAMES)
        w = 2.0 * math.pi * t
        
        frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        
        # Ground Shadow
        sw_curr = max(10, int(sw * 0.95 + 0.05 * math.cos(w) * sw))
        sh_curr = max(4, int(sh * 0.95 + 0.05 * math.cos(w) * sh))
        sh_sc = shadow_img.resize((sw_curr, sh_curr), Image.Resampling.BILINEAR)
        frame.alpha_composite(sh_sc, (CX - sw_curr // 2, SHADOW_Y - sh_curr // 2))
        
        # Heavy hydraulic stance breathing
        piston_y = -6.0 * math.sin(w)
        scale_x = 1.0 + 0.015 * math.cos(w)
        scale_y = 1.0 - 0.012 * math.cos(w)
        cur_w = int(cw * scale_x)
        cur_h = int(ch * scale_y)
        char_sc = char_img.resize((cur_w, cur_h), Image.Resampling.LANCZOS)
        
        top_y = int(SHADOW_Y - 25 - cur_h + piston_y)
        frame.alpha_composite(char_sc, (CX - cur_w // 2, top_y))
        
        # Arc-Core Reactor Pulse
        core_x = CX
        core_y = top_y + int(cur_h * 0.48)
        cr_pulse = 1.0 + 0.3 * math.sin(w * 3)
        cr = int(30 * cr_pulse)
        
        cg = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        d_cg = ImageDraw.Draw(cg)
        d_cg.ellipse([core_x - cr*2, core_y - cr*2, core_x + cr*2, core_y + cr*2], fill=(40, 180, 255, int(90 * cr_pulse)))
        d_cg.ellipse([core_x - cr, core_y - cr, core_x + cr, core_y + cr], fill=(160, 240, 255, int(200 * cr_pulse)))
        d_cg.ellipse([core_x - cr//2, core_y - cr//2, core_x + cr//2, core_y + cr//2], fill=(255, 255, 255, 255))
        
        # Sweeping horizontal cyan laser scanner across visor
        visor_y = top_y + int(cur_h * 0.28)
        scan_x = CX + int(math.sin(w * 2) * 28)
        d_cg.line([(scan_x - 40, visor_y), (scan_x + 40, visor_y)], fill=(60, 235, 255, 255), width=4)
        d_cg.ellipse([scan_x - 6, visor_y - 6, scan_x + 6, visor_y + 6], fill=(255, 255, 255, 255))
        
        cg = cg.filter(ImageFilter.GaussianBlur(3))
        frame = Image.alpha_composite(frame, cg)
        
        frames.append(frame)
    save_formats("arbiter-zero", frames)

# =========================================================================
# 6. HYDRA-RDZEŃ (Nexus Lv 20)
# =========================================================================
def animate_hydra_rdzen():
    print("Rendering animation: Hydra-Rdzeń...")
    char_img = Image.open(MASTERS_DIR / "hydra-rdzen.png").convert("RGBA")
    shadow_img = Image.open(MASTERS_DIR / "hydra-rdzen_shadow.png").convert("RGBA")
    char_img.thumbnail((470, 480), Image.Resampling.LANCZOS)
    cw, ch = char_img.size
    sw, sh = shadow_img.size
    
    frames = []
    for f_idx in range(NUM_FRAMES):
        t = f_idx / float(NUM_FRAMES)
        w = 2.0 * math.pi * t
        
        frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        
        # Antigravity hover
        hover_y = -12.0 * math.sin(w)
        
        # Shadow
        sh_sc = shadow_img.resize((sw, sh), Image.Resampling.BILINEAR)
        frame.alpha_composite(sh_sc, (CX - sw // 2, SHADOW_Y - sh // 2))
        
        # Hydra body
        cur_w = int(cw * (1.0 + 0.015 * math.cos(w)))
        cur_h = int(ch * (1.0 - 0.012 * math.cos(w)))
        char_sc = char_img.resize((cur_w, cur_h), Image.Resampling.LANCZOS)
        char_y = int(CY - 35 + hover_y)
        frame.alpha_composite(char_sc, (CX - cur_w // 2, char_y - cur_h // 2))
        
        # Head optics and laser charging flares
        flares = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        d_fl = ImageDraw.Draw(flares)
        
        # Beta Prime (center) cyan laser pulse
        beta_pulse = 1.0 + 0.3 * math.sin(w * 2)
        bx = CX
        by = int(char_y - cur_h // 2 + cur_h * 0.16)
        d_fl.ellipse([bx - int(15*beta_pulse), by - int(15*beta_pulse), bx + int(15*beta_pulse), by + int(15*beta_pulse)], fill=(50, 220, 255, 180))
        
        # Alpha (left) orange plasma muzzle pulse
        alpha_pulse = 1.0 + 0.3 * math.sin(w * 2 + 2.09)
        ax = CX - int(cur_w * 0.32)
        ay = int(char_y - cur_h // 2 + cur_h * 0.34)
        d_fl.ellipse([ax - int(12*alpha_pulse), ay - int(12*alpha_pulse), ax + int(12*alpha_pulse), ay + int(12*alpha_pulse)], fill=(255, 120, 40, 180))
        
        # Gamma (right) violet laser pulse
        gamma_pulse = 1.0 + 0.3 * math.sin(w * 2 + 4.18)
        gx = CX + int(cur_w * 0.32)
        gy = int(char_y - cur_h // 2 + cur_h * 0.34)
        d_fl.ellipse([gx - int(12*gamma_pulse), gy - int(12*gamma_pulse), gx + int(12*gamma_pulse), gy + int(12*gamma_pulse)], fill=(205, 75, 255, 180))
        
        flares = flares.filter(ImageFilter.GaussianBlur(3))
        frame = Image.alpha_composite(frame, flares)
        
        frames.append(frame)
    save_formats("hydra-rdzen", frames)

# =========================================================================
# 7. KHARZUL (Pyra Lv 15)
# =========================================================================
def animate_kharzul():
    print("Rendering animation: Kharzul, Mistrz Areny...")
    char_img = Image.open(MASTERS_DIR / "kharzul.png").convert("RGBA")
    shadow_img = Image.open(MASTERS_DIR / "kharzul_shadow.png").convert("RGBA")
    char_img.thumbnail((450, 480), Image.Resampling.LANCZOS)
    cw, ch = char_img.size
    sw, sh = shadow_img.size
    
    frames = []
    for f_idx in range(NUM_FRAMES):
        t = f_idx / float(NUM_FRAMES)
        w = 2.0 * math.pi * t
        
        frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        
        # Ground Shadow
        sw_curr = max(10, int(sw * 0.95 + 0.05 * math.cos(w) * sw))
        sh_curr = max(4, int(sh * 0.95 + 0.05 * math.cos(w) * sh))
        sh_sc = shadow_img.resize((sw_curr, sh_curr), Image.Resampling.BILINEAR)
        frame.alpha_composite(sh_sc, (CX - sw_curr // 2, SHADOW_Y - sh_curr // 2))
        
        # Imposing gladiator combat breathing
        scale_x = 1.0 + 0.015 * math.cos(w)
        scale_y = 1.0 + 0.018 * math.sin(w)
        cur_w = int(cw * scale_x)
        cur_h = int(ch * scale_y)
        char_sc = char_img.resize((cur_w, cur_h), Image.Resampling.LANCZOS)
        
        top_y = SHADOW_Y - 25 - cur_h
        frame.alpha_composite(char_sc, (CX - cur_w // 2, top_y))
        
        # Crackling Greatsword Fire Storm
        sword_x1 = CX - cur_w // 2 + int(cur_w * 0.72)
        sword_y1 = top_y + int(cur_h * 0.65)
        sword_x2 = CX - cur_w // 2 + int(cur_w * 0.88)
        sword_y2 = top_y + int(cur_h * 0.08)
        
        sword_fx = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        d_sfx = ImageDraw.Draw(sword_fx)
        
        # Rising flame tongues along blade
        for i in range(14):
            ft = (i / 14.0 + t) % 1.0
            bx = int(sword_x1 + (sword_x2 - sword_x1) * ft)
            by = int(sword_y1 + (sword_y2 - sword_y1) * ft)
            fr = int(14 + math.sin(ft * math.pi) * 12)
            d_sfx.ellipse([bx - fr, by - fr, bx + fr, by + fr], fill=(255, 110, 20, 160))
            d_sfx.ellipse([bx - fr//2, by - fr//2, bx + fr//2, by + fr//2], fill=(255, 230, 80, 220))
            
        # Rising cinders & black smoke
        for p_i in range(12):
            phase = (t + p_i / 12.0) % 1.0
            px = sword_x2 + int(math.sin(p_i * 1.7 + phase * 4) * 35) - 20
            py = int(sword_y2 - phase * 140)
            pa = int((1.0 - phase) * 200)
            d_sfx.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 180, 50, pa))
            
        sword_fx = sword_fx.filter(ImageFilter.GaussianBlur(3))
        frame = Image.alpha_composite(frame, sword_fx)
        
        frames.append(frame)
    save_formats("kharzul", frames)

# =========================================================================
# 8. PYRRHAX (Pyra Lv 20)
# =========================================================================
def animate_pyrrhax():
    print("Rendering animation: Pyrrhax, Smok Wulkanu...")
    char_img = Image.open(MASTERS_DIR / "pyrrhax.png").convert("RGBA")
    shadow_img = Image.open(MASTERS_DIR / "pyrrhax_shadow.png").convert("RGBA")
    char_img.thumbnail((470, 480), Image.Resampling.LANCZOS)
    cw, ch = char_img.size
    sw, sh = shadow_img.size
    
    frames = []
    for f_idx in range(NUM_FRAMES):
        t = f_idx / float(NUM_FRAMES)
        w = 2.0 * math.pi * t
        
        frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        
        # Airborne / stance hover
        hover_y = -10.0 * math.sin(w)
        
        # Shadow responds to wing beat and hover
        sw_curr = max(10, int(sw * 0.92 + 0.08 * math.cos(w) * sw))
        sh_curr = max(4, int(sh * 0.92 + 0.08 * math.cos(w) * sh))
        sh_sc = shadow_img.resize((sw_curr, sh_curr), Image.Resampling.BILINEAR)
        frame.alpha_composite(sh_sc, (CX - sw_curr // 2, SHADOW_Y - sh_curr // 2))
        
        # Basalt wing beat breathing
        scale_x = 1.0 + 0.025 * math.cos(w)
        scale_y = 1.0 - 0.02 * math.cos(w)
        cur_w = int(cw * scale_x)
        cur_h = int(ch * scale_y)
        char_sc = char_img.resize((cur_w, cur_h), Image.Resampling.LANCZOS)
        
        top_y = int(SHADOW_Y - 20 - cur_h + hover_y)
        frame.alpha_composite(char_sc, (CX - cur_w // 2, top_y))
        
        # Caldera Chest Furnace Glow Surge
        chest_x = CX
        chest_y = top_y + int(cur_h * 0.52)
        c_pulse = 1.0 + 0.3 * math.sin(w * 2)
        cr = int(35 * c_pulse)
        
        fg = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        d_fg = ImageDraw.Draw(fg)
        d_fg.ellipse([chest_x - cr*2, chest_y - cr*2, chest_x + cr*2, chest_y + cr*2], fill=(255, 90, 20, int(100 * c_pulse)))
        d_fg.ellipse([chest_x - cr, chest_y - cr, chest_x + cr, chest_y + cr], fill=(255, 220, 70, int(210 * c_pulse)))
        
        # Roaring Flame Breath Flare from jaws
        mouth_x = CX - cur_w // 2 + int(cur_w * 0.78)
        mouth_y = top_y + int(cur_h * 0.26)
        b_len = int(35 + 15 * math.sin(w * 3))
        d_fg.polygon([(mouth_x, mouth_y), (mouth_x + b_len, mouth_y - 15), (mouth_x + b_len + 15, mouth_y + 15)], fill=(255, 120, 25, 200))
        d_fg.polygon([(mouth_x, mouth_y), (mouth_x + b_len - 10, mouth_y - 8), (mouth_x + b_len, mouth_y + 8)], fill=(255, 240, 95, 240))
        
        # Volcanic floating magma sparks
        for p_i in range(16):
            phase = (t + p_i / 16.0) % 1.0
            px = CX + int(math.sin(p_i * 1.9 + phase * 3) * (110 + p_i * 6))
            py = int(SHADOW_Y - 40 - phase * 370)
            pa = int((1.0 - phase) * 220)
            d_fg.ellipse([px - 3, py - 3, px + 3, py + 3], fill=(255, 160, 40, pa))
            
        fg = fg.filter(ImageFilter.GaussianBlur(4))
        frame = Image.alpha_composite(frame, fg)
        
        frames.append(frame)
    save_formats("pyrrhax", frames)

def render_all():
    print("="*60)
    print("STARTING BATCH 60 FPS ANIMATION GENERATION FOR ALL BOSSES")
    print("="*60)
    animate_ygdrasha()
    animate_thorgar()
    animate_arcykaplan()
    copy_aurelith()
    animate_arbiter_zero()
    animate_hydra_rdzen()
    animate_kharzul()
    animate_pyrrhax()
    print("="*60)
    print("ALL 8 BOSSES ANIMATED & EXPORTED SUCCESSFULLY!")
    print("="*60)

if __name__ == "__main__":
    render_all()
