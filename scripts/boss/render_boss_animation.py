#!/usr/bin/env python3
"""Renders an animated loop (GIF & animated WebP) of the Celestial Astral Boss.
Generates 30 smooth loop frames featuring:
- Vertical sinusoidal hover float
- Chest star core pulsation with glowing light rays
- Rotating holographic orbital sigil ring
- Dynamic breathing scale
- Responsive ground shadow
- Rising cosmic particle embers
"""

import math
import os
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT_PUBLIC = ROOT / "public" / "game" / "bosses"
OUT_ART = ROOT / "art" / "production" / "bosses"
OUT_PUBLIC.mkdir(parents=True, exist_ok=True)
OUT_ART.mkdir(parents=True, exist_ok=True)

# 1. Load clean character and shadow
CHAR_IMG = Image.open(ROOT / "art" / "production" / "boss_preview_char.png").convert("RGBA")
SHADOW_IMG = Image.open(ROOT / "art" / "production" / "boss_preview_shadow.png").convert("RGBA")

CW, CH = CHAR_IMG.size
SW, SH = SHADOW_IMG.size

# Frame dimensions
FW, FH = 512, 580
CX, CY = FW // 2, 250  # Character center anchor
SHADOW_Y = 510         # Ground shadow center Y

CORE_X = CX - CW // 2 + 194
CORE_Y_BASE = CY - CH // 2 + 155
RING_Y_BASE = CY - CH // 2 + 225

NUM_FRAMES = 32

def render_frame(frame_idx, num_frames):
    t = frame_idx / float(num_frames)
    w = 2.0 * math.pi * t
    
    # 1. Physics / Hover
    hover_y = -14.0 * math.sin(w)
    char_y = CY + hover_y
    scale_y = 1.0 + 0.015 * math.cos(w)
    scale_x = 1.0 - 0.012 * math.cos(w)
    
    frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    
    # 2. Ground Shadow (responsive to hover height)
    # Higher = smaller and softer
    shadow_scale = 1.0 - (hover_y / 14.0) * 0.12
    sw_curr = max(10, int(SW * shadow_scale))
    sh_curr = max(4, int(SH * shadow_scale))
    s_alpha = int(210 - (hover_y / 14.0) * 45)
    
    shadow_scaled = SHADOW_IMG.resize((sw_curr, sh_curr), Image.Resampling.BILINEAR)
    # Adjust shadow alpha
    s_arr = np.array(shadow_scaled)
    s_arr[:, :, 3] = np.clip(s_arr[:, :, 3].astype(float) * (s_alpha / 255.0), 0, 255).astype(np.uint8)
    shadow_final = Image.fromarray(s_arr, mode="RGBA")
    
    frame.alpha_composite(shadow_final, (CX - sw_curr // 2, SHADOW_Y - sh_curr // 2))
    
    # 3. Behind-boss Aura & Halo Glow
    aura = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    d_aura = ImageDraw.Draw(aura)
    halo_y = char_y - CH // 2 + 130
    pulse_halo = 1.0 + 0.08 * math.sin(w * 2)
    hr = int(140 * pulse_halo)
    d_aura.ellipse([CX - hr, halo_y - hr, CX + hr, halo_y + hr], fill=(30, 110, 240, 55))
    d_aura.ellipse([CX - int(hr*0.7), halo_y - int(hr*0.7), CX + int(hr*0.7), halo_y + int(hr*0.7)], fill=(80, 200, 255, 75))
    aura = aura.filter(ImageFilter.GaussianBlur(14))
    frame = Image.alpha_composite(frame, aura)
    
    # 4. Back half of 3D Orbital Sigil Ring (Z-behind character)
    ring_back = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    d_rb = ImageDraw.Draw(ring_back)
    ring_y = RING_Y_BASE + hover_y
    rx, ry_r = 175, 45
    ring_rot = w
    
    # Draw back arc (180 to 360 deg)
    d_rb.arc([CX - rx, ring_y - ry_r, CX + rx, ring_y + ry_r], 180, 360, fill=(70, 190, 255, 140), width=6)
    # Orbiting energy nodes in back
    for n_idx in range(4):
        ang = ring_rot + n_idx * (math.pi / 2)
        if math.sin(ang) < 0: # back half
            nx = CX + int(math.cos(ang) * rx)
            ny = ring_y + int(math.sin(ang) * ry_r)
            d_rb.ellipse([nx - 6, ny - 6, nx + 6, ny + 6], fill=(160, 235, 255, 160))
    ring_back = ring_back.filter(ImageFilter.GaussianBlur(1))
    frame = Image.alpha_composite(frame, ring_back)
    
    # 5. Character Sprite with Breathing Scale
    cur_w = int(CW * scale_x)
    cur_h = int(CH * scale_y)
    char_scaled = CHAR_IMG.resize((cur_w, cur_h), Image.Resampling.LANCZOS)
    top_left_x = CX - cur_w // 2
    top_left_y = int(char_y - cur_h // 2)
    frame.alpha_composite(char_scaled, (top_left_x, top_left_y))
    
    # 6. Front half of 3D Orbital Sigil Ring (Z-in-front of character)
    ring_front = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    d_rf = ImageDraw.Draw(ring_front)
    # Draw front arc (0 to 180 deg)
    d_rf.arc([CX - rx, ring_y - ry_r, CX + rx, ring_y + ry_r], 0, 180, fill=(120, 230, 255, 230), width=8)
    d_rf.arc([CX - rx + 2, ring_y - ry_r + 2, CX + rx - 2, ring_y + ry_r - 2], 10, 170, fill=(230, 250, 255, 255), width=3)
    # Orbiting energy nodes in front
    for n_idx in range(4):
        ang = ring_rot + n_idx * (math.pi / 2)
        if math.sin(ang) >= 0: # front half
            nx = CX + int(math.cos(ang) * rx)
            ny = ring_y + int(math.sin(ang) * ry_r)
            d_rf.ellipse([nx - 9, ny - 9, nx + 9, ny + 9], fill=(240, 250, 255, 255))
            d_rf.ellipse([nx - 14, ny - 14, nx + 14, ny + 14], fill=(0, 210, 255, 120))
    ring_front = ring_front.filter(ImageFilter.GaussianBlur(1))
    frame = Image.alpha_composite(frame, ring_front)
    
    # 7. Chest Core Radiant Star Flare (Additive Glow)
    core_pulse = 1.0 + 0.22 * math.sin(w * 3) # faster heartbeat
    cr = int(22 * core_pulse)
    core_x = CX - cur_w // 2 + int(194 * scale_x)
    core_y = int(char_y - cur_h // 2 + 155 * scale_y)
    
    flare = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    d_flare = ImageDraw.Draw(flare)
    # Starburst rays
    for ray_ang in [0.0, math.pi / 4, math.pi / 2, 3 * math.pi / 4]:
        ang_off = ray_ang + 0.1 * math.sin(w)
        rl = int(45 * core_pulse)
        rx1 = core_x - int(math.cos(ang_off) * rl)
        ry1 = core_y - int(math.sin(ang_off) * rl)
        rx2 = core_x + int(math.cos(ang_off) * rl)
        ry2 = core_y + int(math.sin(ang_off) * rl)
        d_flare.line([(rx1, ry1), (rx2, ry2)], fill=(255, 240, 180, int(200 * core_pulse)), width=int(5 * core_pulse))
    # Core spheres
    d_flare.ellipse([core_x - cr, core_y - cr, core_x + cr, core_y + cr], fill=(255, 220, 120, 220))
    d_flare.ellipse([core_x - cr//2, core_y - cr//2, core_x + cr//2, core_y + cr//2], fill=(255, 255, 255, 255))
    flare = flare.filter(ImageFilter.GaussianBlur(2))
    frame = Image.alpha_composite(frame, flare)
    
    # 8. Rising Cosmic Particle Embers
    sparks = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    d_sp = ImageDraw.Draw(sparks)
    for p_i in range(16):
        # deterministic seeded pseudo-particles based on time
        p_seed = p_i * 137.5
        phase = (t + p_i / 16.0) % 1.0
        p_x = CX + int(math.sin(p_seed + phase * 4) * (80 + p_i * 4))
        p_y = int(SHADOW_Y - 40 - phase * 380)
        p_alpha = int(math.sin(phase * math.pi) * 220)
        p_r = int(2 + math.sin(phase * math.pi) * 3)
        p_col = (100, 220, 255, p_alpha) if p_i % 2 == 0 else (255, 220, 130, p_alpha)
        d_sp.ellipse([p_x - p_r, p_y - p_r, p_x + p_r, p_y + p_r], fill=p_col)
    sparks = sparks.filter(ImageFilter.GaussianBlur(1))
    frame = Image.alpha_composite(frame, sparks)
    
    return frame

def generate_animation():
    print(f"Generating {NUM_FRAMES} animation frames for Celestial Astral Boss...")
    frames = []
    for f_idx in range(NUM_FRAMES):
        sys.stdout.write(f"\r  Frame [{f_idx+1}/{NUM_FRAMES}]...")
        sys.stdout.flush()
        fr = render_frame(f_idx, NUM_FRAMES)
        frames.append(fr)
    print("\n  Frames completed! Encoding animated formats...")
    
    # 1. Save Animated WebP (Full resolution with alpha)
    webp_path = OUT_PUBLIC / "boss_astral_idle.webp"
    webp_art = OUT_ART / "boss_astral_idle.webp"
    frames[0].save(
        webp_path,
        "WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=33,  # ~30 FPS
        loop=0,
        quality=95,
        method=4
    )
    frames[0].save(webp_art, "WEBP", save_all=True, append_images=frames[1:], duration=33, loop=0, quality=95)
    print(f"  Saved WebP: {webp_path}")
    
    # 2. Save Animated GIF (scaled down slightly for universal playback)
    gif_frames = []
    for fr in frames:
        # Scale to 384x435 for lightweight GIF
        small = fr.resize((384, 435), Image.Resampling.BILINEAR)
        # Convert to palette with transparency
        gif_frames.append(small)
        
    gif_path = OUT_PUBLIC / "boss_astral_idle.gif"
    gif_art = OUT_ART / "boss_astral_idle.gif"
    gif_frames[0].save(
        gif_path,
        "GIF",
        save_all=True,
        append_images=gif_frames[1:],
        duration=33,
        loop=0,
        disposal=2
    )
    gif_frames[0].save(gif_art, "GIF", save_all=True, append_images=gif_frames[1:], duration=33, loop=0, disposal=2)
    print(f"  Saved GIF: {gif_path}")
    
    # 3. Save Sprite Sheet (8 frames horizontal sample)
    sample_indices = [0, 4, 8, 12, 16, 20, 24, 28]
    sample_w, sample_h = 180, 204
    sheet = Image.new("RGBA", (sample_w * len(sample_indices), sample_h), (0, 0, 0, 0))
    for s_i, idx in enumerate(sample_indices):
        thumb = frames[idx].resize((sample_w, sample_h), Image.Resampling.LANCZOS)
        sheet.alpha_composite(thumb, (s_i * sample_w, 0))
    sheet_path = OUT_ART / "boss_astral_spritesheet.png"
    sheet.save(sheet_path, "PNG")
    print(f"  Saved Sprite Sheet: {sheet_path}")
    
    print("\nANIMATION RENDER COMPLETE!")

if __name__ == "__main__":
    generate_animation()
