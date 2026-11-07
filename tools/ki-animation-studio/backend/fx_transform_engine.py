#!/usr/bin/env python3
"""
Silnik Modyfikacji Wyglądu, Efektów VFX i Transformacji Postaci (FX & Transform Engine).
Wielordzeniowe przetwarzanie na 16 vCPU.
Obejmuje:
1. Modyfikację wyglądu klatek:
   - Cel-Shading / Anime Toon Shader
   - Gruby kontur tuszem (Anime Ink Outline) lub świetlny obrys KI
   - Korekcję barwną HSL, Kontrast, Gamma oraz Palety 4 Ras KI Legends (Planetarni, Mędrcy, Androidy, Legendy)
   - Kierunkowe oświetlenie Rim Light z Północnego Zachodu (zgodnie z kontraktem KI Legends)
2. Efekty specjalne (VFX):
   - Proceduralna, animowana Aura KI wokół sylwetki (Płomień, Plazma, Wiatr Gai, Astralne Pierścienie)
   - Wyładowania elektryczne / Błyskawice KI na ciele postaci
   - Smugi ruchu / Afterimage Ghost Trail dla szybkich ataków
   - Fala uderzeniowa (Shockwave) u stóp oraz uderzeniowy błysk (Impact Flash)
3. Transformacje geometryczne i szkieletowe postaci:
   - Squash & Stretch zakotwiczony w punkcie stóp (0.5, 0.95)
   - Nachylenie bojowe (Combat Lean / Tilt) bez odrywania stóp od podłoża
   - Falowanie szat i włosów na wietrze (Cloth/Hair Sinusoidal Wave)
   - Progresywna Transformacja Formy (Przebudzenie Mocy KI w trakcie animacji)
"""
from __future__ import annotations

import math
import os
from concurrent.futures import ProcessPoolExecutor
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from scipy import ndimage

CPU_WORKERS = min(16, max(1, (os.cpu_count() or 8)))

RACE_PRESETS = {
    "verdant": {
        "tint_rgb": (79, 122, 69),
        "aura_rgb": (73, 224, 136),
        "aura_core_rgb": (245, 215, 110),
        "ink_rgb": (17, 24, 18),
    },
    "aether": {
        "tint_rgb": (27, 153, 114),
        "aura_rgb": (88, 235, 212),
        "aura_core_rgb": (255, 235, 150),
        "ink_rgb": (18, 26, 36),
    },
    "nexus": {
        "tint_rgb": (0, 216, 255),
        "aura_rgb": (0, 216, 255),
        "aura_core_rgb": (175, 130, 255),
        "ink_rgb": (11, 16, 23),
    },
    "pyra": {
        "tint_rgb": (201, 30, 50),
        "aura_rgb": (255, 62, 48),
        "aura_core_rgb": (255, 200, 50),
        "ink_rgb": (22, 10, 12),
    },
    "golden_ki": {
        "tint_rgb": (255, 200, 40),
        "aura_rgb": (255, 195, 20),
        "aura_core_rgb": (255, 250, 200),
        "ink_rgb": (35, 22, 5),
    },
}


def hex_to_rgb(hex_str: str, default: Tuple[int, int, int] = (0, 216, 255)) -> Tuple[int, int, int]:
    s = hex_str.strip().lstrip("#")
    if len(s) == 6:
        try:
            return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))
        except ValueError:
            pass
    return default


def apply_character_deformation(
    rgba: np.ndarray,
    frame_idx: int,
    total_frames: int,
    params: Dict[str, Any],
) -> np.ndarray:
    """
    Stosuje transformacje geometryczne i deformacje postaci z zablokowaną kotwicą stóp:
    - scale_x, scale_y, progressive_scale (powiększenie przy transformacji mocy)
    - lean_deg (pochylenie postaci w przód/tył wokół punktu stóp)
    - squash_stretch (dynamiczne ugięcie i rozciągnięcie w rytmie animacji)
    - cloth_sway_amp (falowanie płaszcza/szarfy/włosów)
    - breath_amp (cykl oddechowy klatki piersiowej)
    """
    h, w = rgba.shape[:2]
    anchor_x = float(params.get("anchor_x", 0.5)) * w
    anchor_y = float(params.get("anchor_y", 0.95)) * h

    phase = (frame_idx / max(1, total_frames)) * math.tau
    progress = frame_idx / max(1, total_frames - 1) if total_frames > 1 else 0.0

    scale_base = float(params.get("scale", 1.0))
    trans_grow = float(params.get("transformation_scale_boost", 0.0)) * progress
    squash_amp = float(params.get("squash_stretch", 0.0))
    breath_amp = float(params.get("breath_amp", 0.0))
    lean_deg = float(params.get("lean_deg", 0.0))
    cloth_sway = float(params.get("cloth_sway", 0.0))

    sx = (scale_base + trans_grow) * (1.0 - squash_amp * math.sin(phase))
    sy = (scale_base + trans_grow) * (1.0 + squash_amp * math.sin(phase) + breath_amp * math.sin(phase))

    if (
        abs(sx - 1.0) < 1e-3
        and abs(sy - 1.0) < 1e-3
        and abs(lean_deg) < 1e-2
        and abs(cloth_sway) < 1e-2
    ):
        return rgba

    grid_x, grid_y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))

    # Współrzędne względem kotwicy stóp (stopy stoją w miejscu!)
    dx = grid_x - anchor_x
    dy = grid_y - anchor_y

    # Obrót / pochylenie bojowe wokół stóp
    rad = math.radians(-lean_deg)
    cos_t, sin_t = math.cos(rad), math.sin(rad)
    rx = dx * cos_t - dy * sin_t
    ry = dx * sin_t + dy * cos_t

    # Skalowanie względem kotwicy stóp
    src_x = rx / max(0.2, sx) + anchor_x
    src_y = ry / max(0.2, sy) + anchor_y

    # Falowanie szat i włosów (silniejsze w dolnej i bocznej strefie sylwetki)
    if abs(cloth_sway) > 0.1:
        wave = cloth_sway * np.sin(phase + grid_y / 38.0) * np.clip((grid_y - h * 0.25) / (h * 0.6), 0.0, 1.0)
        src_x = src_x - wave.astype(np.float32)

    deformed = cv2.remap(
        rgba,
        src_x.astype(np.float32),
        src_y.astype(np.float32),
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )
    return deformed


def apply_color_and_style(rgba: np.ndarray, params: Dict[str, Any]) -> np.ndarray:
    """
    Modyfikuje wygląd klatki:
    - Korekcja barwna HSL (Hue, Saturation, Brightness, Contrast)
    - Paleta rasowa KI Legends
    - Cel-Shading (kwantyzacja tonów anime)
    - Oświetlenie Rim Light z Północnego Zachodu
    - Obrys tuszem (Anime Ink Outline)
    """
    out = rgba.copy()
    alpha = out[:, :, 3]
    fg_mask = alpha > 12
    if not fg_mask.any():
        return out

    rgb = out[:, :, :3].astype(np.float32)

    # 1. Korekcja HSL
    hue_shift = float(params.get("hue_shift", 0.0))
    saturation = float(params.get("saturation", 1.0))
    brightness = float(params.get("brightness", 1.0))
    contrast = float(params.get("contrast", 1.0))

    if abs(hue_shift) > 0.5 or abs(saturation - 1.0) > 0.01 or abs(brightness - 1.0) > 0.01:
        hsv = cv2.cvtColor(out[:, :, :3], cv2.COLOR_RGB2HSV).astype(np.float32)
        hsv[:, :, 0] = (hsv[:, :, 0] + (hue_shift / 2.0)) % 180.0
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * saturation, 0, 255)
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * brightness, 0, 255)
        rgb = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32)

    if abs(contrast - 1.0) > 0.01:
        rgb = np.clip((rgb - 128.0) * contrast + 128.0, 0, 255)

    # 2. Paleta rasowa / Tint
    race = params.get("race_preset", "none")
    tint_strength = float(params.get("tint_strength", 0.0))
    if race in RACE_PRESETS and tint_strength > 0.01:
        t_rgb = np.array(RACE_PRESETS[race]["tint_rgb"], dtype=np.float32)
        luma = (0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2])[:, :, None] / 255.0
        tinted = t_rgb * (0.35 + 0.95 * luma)
        rgb = rgb * (1.0 - tint_strength) + np.clip(tinted, 0, 255) * tint_strength

    # 3. Cel-Shading (Anime Toon Posterization)
    cel_levels = int(params.get("cel_shading_levels", 0))
    if 2 <= cel_levels <= 12:
        step = 255.0 / cel_levels
        rgb = np.floor(rgb / step) * step + (step * 0.5)
        rgb = np.clip(rgb, 0, 255)

    # 4. Oświetlenie Rim Light z Północnego Zachodu (NW Key Light wg kontraktu KI Legends)
    rim_strength = float(params.get("nw_rim_light", 0.0))
    if rim_strength > 0.01:
        shifted = np.zeros_like(alpha)
        shifted[3:, 3:] = alpha[:-3, :-3]
        nw_edge = np.clip((alpha.astype(np.float32) - shifted.astype(np.float32)) / 255.0, 0.0, 1.0)
        nw_edge = cv2.GaussianBlur(nw_edge, (5, 5), 1.2)[:, :, None]
        rim_color = np.array([255.0, 248.0, 225.0], dtype=np.float32)
        rgb = np.clip(rgb + nw_edge * rim_color * rim_strength * 0.75, 0, 255)

    out[:, :, :3] = rgb.astype(np.uint8)

    # 5. Kontur Anime (Ink Outline)
    outline_px = int(params.get("ink_outline_px", 0))
    if outline_px > 0:
        ink_hex = params.get("ink_color", "#11151b")
        ink_rgb = hex_to_rgb(ink_hex, (17, 21, 27))
        bin_mask = (alpha > 32).astype(np.uint8)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (outline_px * 2 + 1, outline_px * 2 + 1))
        dilated = cv2.dilate(bin_mask, kernel, iterations=1)
        ring = (dilated > 0) & (bin_mask == 0)
        out[ring, 0] = ink_rgb[0]
        out[ring, 1] = ink_rgb[1]
        out[ring, 2] = ink_rgb[2]
        out[ring, 3] = 255

    return out


def generate_ki_aura_and_vfx(
    rgba: np.ndarray,
    frame_idx: int,
    total_frames: int,
    params: Dict[str, Any],
) -> np.ndarray:
    """
    Generuje proceduralną, animowaną Aurę KI, błyskawice, falę uderzeniową u stóp
    oraz cień kontaktowy wokół postaci.
    """
    h, w = rgba.shape[:2]
    aura_intensity = float(params.get("aura_intensity", 0.0))
    shadow_enabled = bool(params.get("contact_shadow", False))
    shockwave_enabled = bool(params.get("shockwave", False))
    lightning_enabled = bool(params.get("lightning_sparks", False))

    if aura_intensity <= 0.01 and not shadow_enabled and not shockwave_enabled and not lightning_enabled:
        return rgba

    canvas = np.zeros((h, w, 4), dtype=np.float32)
    alpha = rgba[:, :, 3].astype(np.float32) / 255.0
    phase = (frame_idx / max(1, total_frames)) * math.tau
    progress = frame_idx / max(1, total_frames - 1) if total_frames > 1 else 0.5

    anchor_x = int(float(params.get("anchor_x", 0.5)) * w)
    anchor_y = int(float(params.get("anchor_y", 0.95)) * h)

    race = params.get("race_preset", "nexus")
    preset = RACE_PRESETS.get(race, RACE_PRESETS["nexus"])
    aura_rgb = hex_to_rgb(params.get("aura_color", ""), preset["aura_rgb"])
    core_rgb = preset["aura_core_rgb"]

    # 1. Cień kontaktowy pod stopami
    if shadow_enabled:
        shadow_layer = np.zeros((h, w), dtype=np.float32)
        rx = max(16, int(w * 0.14))
        ry = max(6, int(h * 0.035))
        cv2.ellipse(shadow_layer, (anchor_x, anchor_y), (rx, ry), 0, 0, 360, 0.48, -1)
        shadow_layer = cv2.GaussianBlur(shadow_layer, (21, 21), 6.0)
        canvas[:, :, 3] = np.maximum(canvas[:, :, 3], shadow_layer * 255.0)

    # 2. Fala uderzeniowa KI (Shockwave Ring u stóp)
    if shockwave_enabled:
        ring_layer = np.zeros((h, w), dtype=np.float32)
        rx = int(w * (0.08 + 0.28 * progress))
        ry = max(4, int(rx * 0.32))
        thickness = max(2, int(6 * (1.0 - progress * 0.6)))
        cv2.ellipse(ring_layer, (anchor_x, anchor_y), (rx, ry), 0, 0, 360, 1.0, thickness)
        ring_layer = cv2.GaussianBlur(ring_layer, (9, 9), 2.2) * (1.0 - 0.7 * progress)
        for c in range(3):
            canvas[:, :, c] = np.clip(canvas[:, :, c] + ring_layer * aura_rgb[c], 0, 255)
        canvas[:, :, 3] = np.clip(canvas[:, :, 3] + ring_layer * 230.0, 0, 255)

    # 3. Wielowarstwowa płomienna/plazmowa Aura KI wokół sylwetki
    if aura_intensity > 0.01 and (alpha > 0.05).any():
        dist_out = cv2.distanceTransform((alpha < 0.15).astype(np.uint8), cv2.DIST_L2, 5)
        grid_x, grid_y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))

        # Turbulencja płomieni unoszących się w górę
        flame_wave = (
            np.sin(grid_y / 14.0 + phase * 2.0 + np.cos(grid_x / 18.0)) * 6.5
            + np.cos(grid_x / 11.0 - phase * 3.0) * 4.5
        )
        upward_boost = np.clip((anchor_y - grid_y) / max(1.0, h * 0.75), 0.2, 1.35)
        reach = (18.0 + 26.0 * aura_intensity) * upward_boost + flame_wave

        outer_glow = np.clip(1.0 - (dist_out / np.maximum(4.0, reach)), 0.0, 1.0) ** 1.6
        inner_core = np.clip(1.0 - (dist_out / np.maximum(2.0, reach * 0.38)), 0.0, 1.0) ** 2.2

        # Wycinamy wnętrze postaci, zostawiając poświatę na obrzeżach
        aura_alpha = np.clip((outer_glow * 0.78 + inner_core * 0.45) * aura_intensity, 0.0, 1.0)

        for c in range(3):
            col = outer_glow * aura_rgb[c] + inner_core * (core_rgb[c] - aura_rgb[c])
            canvas[:, :, c] = np.clip(canvas[:, :, c] * (1.0 - aura_alpha) + col * aura_alpha, 0, 255)
        canvas[:, :, 3] = np.clip(canvas[:, :, 3] + aura_alpha * 255.0, 0, 255)

    # 4. Nałożenie postaci na warstwę tła/aury (Alpha Over)
    fg_a = alpha[:, :, None]
    bg_a = (canvas[:, :, 3:4] / 255.0) * (1.0 - fg_a)
    out_a = fg_a + bg_a
    out_rgb = np.where(
        out_a > 1e-4,
        (rgba[:, :, :3].astype(np.float32) * fg_a + canvas[:, :, :3] * bg_a) / np.maximum(out_a, 1e-4),
        0.0,
    )
    composed = np.concatenate([np.clip(out_rgb, 0, 255), np.clip(out_a * 255.0, 0, 255)], axis=2).astype(np.uint8)

    # 5. Wyładowania elektryczne / Błyskawice KI na pierwszym planie
    if lightning_enabled and (alpha > 0.2).any():
        ys, xs = np.where(alpha > 0.2)
        rng = np.random.default_rng(seed=1000 + frame_idx * 97)
        bolt_layer = np.zeros((h, w, 4), dtype=np.uint8)
        for _ in range(3):
            pick = int(rng.integers(0, len(xs)))
            bx, by = int(xs[pick]), int(ys[pick])
            pts = [(bx, by)]
            for _step in range(5):
                bx += int(rng.integers(-18, 19))
                by += int(rng.integers(-22, 14))
                pts.append((max(0, min(w - 1, bx)), max(0, min(h - 1, by))))
            for j in range(len(pts) - 1):
                cv2.line(bolt_layer, pts[j], pts[j + 1], (*core_rgb, 235), 2, cv2.LINE_AA)
                cv2.line(bolt_layer, pts[j], pts[j + 1], (255, 255, 255, 255), 1, cv2.LINE_AA)

        b_a = (bolt_layer[:, :, 3:4].astype(np.float32)) / 255.0
        composed[:, :, :3] = np.clip(
            composed[:, :, :3].astype(np.float32) * (1.0 - b_a) + bolt_layer[:, :, :3].astype(np.float32) * b_a,
            0,
            255,
        ).astype(np.uint8)
        composed[:, :, 3] = np.maximum(composed[:, :, 3], bolt_layer[:, :, 3])

    return composed


def _fx_worker(args: Tuple[int, int, np.ndarray, Dict[str, Any]]) -> Tuple[int, np.ndarray]:
    idx, total, frame, params = args
    deformed = apply_character_deformation(frame, idx, total, params)
    styled = apply_color_and_style(deformed, params)
    final_frame = generate_ki_aura_and_vfx(styled, idx, total, params)
    return idx, final_frame


def process_sequence_fx_parallel(
    frames: List[np.ndarray],
    params: Dict[str, Any],
) -> List[np.ndarray]:
    """
    Przetwarza wszystkie klatki animacji równolegle na 16 procesorach (CPU Pool)
    oraz opcjonalnie nakłada smugi ruchu (Afterimage Motion Trail) między klatkami.
    """
    if not frames:
        return []

    total = len(frames)
    tasks = [(i, total, f, params) for i, f in enumerate(frames)]

    with ProcessPoolExecutor(max_workers=CPU_WORKERS) as pool:
        results = list(pool.map(_fx_worker, tasks))

    results.sort(key=lambda x: x[0])
    out_frames = [r[1] for r in results]

    # Smugi ruchu (Afterimage / Ghost Trail)
    trail_strength = float(params.get("motion_trail", 0.0))
    if trail_strength > 0.05 and len(out_frames) >= 2:
        trailed: List[np.ndarray] = []
        race = params.get("race_preset", "nexus")
        trail_rgb = RACE_PRESETS.get(race, RACE_PRESETS["nexus"])["aura_rgb"]

        for i in range(len(out_frames)):
            curr = out_frames[i].astype(np.float32)
            if i > 0:
                prev = out_frames[i - 1].astype(np.float32)
                ghost_a = (prev[:, :, 3:4] / 255.0) * trail_strength * 0.45
                curr_a = curr[:, :, 3:4] / 255.0
                only_ghost = ghost_a * (1.0 - curr_a)
                for c in range(3):
                    curr[:, :, c] = np.clip(curr[:, :, c] + only_ghost[:, :, 0] * trail_rgb[c], 0, 255)
                curr[:, :, 3:4] = np.clip(curr[:, :, 3:4] + only_ghost * 255.0, 0, 255)
            trailed.append(curr.astype(np.uint8))
        out_frames = trailed

    return out_frames
