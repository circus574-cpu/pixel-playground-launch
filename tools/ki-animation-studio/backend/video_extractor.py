#!/usr/bin/env python3
"""
Wielordzeniowy ekstraktor wideo MP4 / WebM / GIF / Spritesheet dla KI Legends Animation Studio.
Zoptymalizowany pod serwer VPS 16 vCPU (ProcessPoolExecutor).
Obsługuje:
- Rozbijanie plików MP4/MOV/WebM/GIF na klatki RGBA
- Detekcję ruchu (Motion Energy / Optical Delta) dla każdej klatki
- Inteligentne wycinanie tła (Flood-Fill z ochroną konturu anime, Chroma Key, Rembg AI)
- Stabilizację stóp (Foot-Anchor Lock: (0.5, 0.95) dla bohaterów, (0.5, 0.80) dla potworów)
"""
from __future__ import annotations

import base64
import io
import math
import os
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

CPU_WORKERS = min(16, max(1, (os.cpu_count() or 8)))


def remove_background_rgba(
    rgba: np.ndarray,
    mode: str = "none",
    tolerance: int = 38,
    custom_key_rgb: Tuple[int, int, int] = (0, 255, 0),
    feather_radius: float = 0.8,
) -> np.ndarray:
    """
    Usuwa tło z pojedynczej klatki RGBA z zachowaniem wewnętrznych jasnych elementów postaci.
    mode:
      - 'none': zachowaj oryginał
      - 'auto_edge': flood-fill od krawędzi obrazu z ochroną zamkniętych konturów (algorytm KI Legends)
      - 'white_studio': wycinanie białego/jasnego tła studyjnego z ochroną rdzeni blasku
      - 'chroma_green': wycinanie zielonego ekranu (green screen) z tłumieniem zielonego zafarbu
      - 'chroma_custom': wycinanie dowolnego koloru wskazanego przez użytkownika
      - 'luma_dark': wycinanie czarnego tła dla efektów świetlnych / aur
    """
    if mode == "none" or rgba is None:
        return rgba

    out = rgba.copy().astype(np.uint8)
    rgb = out[:, :, :3].astype(np.int32)
    h, w = rgb.shape[:2]

    if mode == "auto_edge":
        # Próbkujemy kolor narożników obrazu
        corners = np.vstack([
            rgb[0:6, 0:6].reshape(-1, 3),
            rgb[0:6, max(0, w - 6):w].reshape(-1, 3),
            rgb[max(0, h - 6):h, 0:6].reshape(-1, 3),
            rgb[max(0, h - 6):h, max(0, w - 6):w].reshape(-1, 3),
        ])
        bg_color = np.median(corners, axis=0)
        dist = np.sqrt(np.sum((rgb - bg_color) ** 2, axis=2))
        candidate = dist <= tolerance

        labeled, _ = ndimage.label(candidate)
        edge_labels = set(
            np.unique(np.concatenate([labeled[0, :], labeled[-1, :], labeled[:, 0], labeled[:, -1]]))
        ) - {0}
        bg_mask = np.isin(labeled, list(edge_labels))

        # Oczyszczanie zamkniętych luk między nogami/ramionami (otoczonych ciemnym konturem)
        inner_cand = candidate & (~bg_mask)
        inner_lab, num_inner = ndimage.label(inner_cand)
        for idx in range(1, num_inner + 1):
            m = inner_lab == idx
            n_px = int(m.sum())
            if n_px < 20 or n_px > (h * w * 0.15):
                continue
            ring = ndimage.binary_dilation(m, iterations=2) & (~m)
            if ring.any():
                around = rgb[ring]
                luma = (0.299 * around[:, 0] + 0.587 * around[:, 1] + 0.114 * around[:, 2]).mean()
                if luma < 125:
                    bg_mask |= m

        fg_mask = ~bg_mask

    elif mode == "white_studio":
        white = rgb.min(axis=2) >= (255 - tolerance)
        labeled, _ = ndimage.label(white)
        edge_labels = set(
            np.unique(np.concatenate([labeled[0, :], labeled[-1, :], labeled[:, 0], labeled[:, -1]]))
        ) - {0}
        bg_mask = np.isin(labeled, list(edge_labels))
        fg_mask = ~bg_mask

    elif mode == "chroma_green":
        hsv = cv2.cvtColor(out[:, :, :3], cv2.COLOR_RGB2HSV)
        lower = np.array([35, max(30, 100 - tolerance), max(30, 80 - tolerance)])
        upper = np.array([88, 255, 255])
        bg_mask = cv2.inRange(hsv, lower, upper) > 0
        fg_mask = ~bg_mask
        # Despill zielonego odbicia na krawędziach
        green_excess = np.maximum(0, rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2]))
        out[:, :, 1] = np.clip(rgb[:, :, 1] - (green_excess * 0.65).astype(np.int32), 0, 255).astype(np.uint8)

    elif mode == "chroma_custom":
        key = np.array(custom_key_rgb, dtype=np.int32)
        dist = np.sqrt(np.sum((rgb - key) ** 2, axis=2))
        fg_mask = dist > tolerance

    elif mode == "luma_dark":
        luma = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
        fg_mask = luma > tolerance

    else:
        return out

    # Morfologiczne wygładzenie maski alfa
    fg_mask = ndimage.binary_opening(fg_mask, iterations=1)
    alpha = (fg_mask.astype(np.float32) * 255.0).astype(np.uint8)
    if feather_radius > 0.1:
        pil_alpha = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(feather_radius))
        alpha = np.asarray(pil_alpha)

    out[:, :, 3] = np.minimum(out[:, :, 3], alpha)
    return out


def _process_single_frame_worker(args: Tuple[int, np.ndarray, Dict[str, Any]]) -> Dict[str, Any]:
    """Funkcja robocza dla pojedynczego rdzenia CPU w ProcessPoolExecutor."""
    idx, bgr_frame, opts = args
    rgb = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    alpha = np.full((h, w, 1), 255, dtype=np.uint8)
    rgba = np.concatenate([rgb, alpha], axis=2)

    bg_mode = opts.get("bg_mode", "none")
    tolerance = int(opts.get("tolerance", 38))
    custom_rgb = tuple(opts.get("custom_key_rgb", [0, 255, 0]))
    feather = float(opts.get("feather", 0.8))

    if bg_mode != "none":
        rgba = remove_background_rgba(rgba, bg_mode, tolerance, custom_rgb, feather)

    # Obliczenie obwiedni sylwetki (bounding box) i środka ciężkości
    fg = rgba[:, :, 3] > 20
    if fg.any():
        ys, xs = np.where(fg)
        bbox = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
        foot_x = int(np.median(xs[ys >= max(ys.min(), ys.max() - 12)]))
        foot_y = int(ys.max())
    else:
        bbox = [0, 0, w, h]
        foot_x, foot_y = w // 2, h - 1

    return {
        "index": idx,
        "rgba": rgba,
        "bbox": bbox,
        "foot_point": [foot_x, foot_y],
    }


def normalize_frames_to_canvas(
    processed_frames: List[Dict[str, Any]],
    canvas_size: int = 512,
    anchor_x: float = 0.5,
    anchor_y: float = 0.95,
    safe_margin: int = 14,
    lock_feet: bool = True,
) -> List[np.ndarray]:
    """
    Normalizuje sekwencję klatek do docelowego rozmiaru KI Legends (np. 512x512 lub 256x256)
    z zachowaniem wspólnej skali ciała oraz zablokowanym punktem oparcia stóp (Anchor Lock).
    """
    if not processed_frames:
        return []

    widths = [max(1, f["bbox"][2] - f["bbox"][0]) for f in processed_frames]
    heights = [max(1, f["bbox"][3] - f["bbox"][1]) for f in processed_frames]

    med_w = sorted(widths)[len(widths) // 2]
    med_h = sorted(heights)[len(heights) // 2]

    # Ignorujemy klatki z ekstremalnie szerokimi efektami przy ustalaniu skali postaci
    body_widths = [w for w in widths if w <= med_w * 1.45] or widths
    body_heights = [h for h in heights if h <= med_h * 1.35] or heights

    max_w = max(body_widths)
    max_h = max(body_heights)

    target_foot_y = int(canvas_size * anchor_y)
    target_foot_x = int(canvas_size * anchor_x)
    avail_w = canvas_size - 2 * safe_margin
    avail_h = target_foot_y - safe_margin

    scale = min(avail_w / max(1, max_w), avail_h / max(1, max_h))

    normalized: List[np.ndarray] = []
    for item in processed_frames:
        rgba = item["rgba"]
        x0, y0, x1, y1 = item["bbox"]
        crop = rgba[y0:y1, x0:x1]
        ch, cw = crop.shape[:2]
        if ch <= 0 or cw <= 0:
            normalized.append(np.zeros((canvas_size, canvas_size, 4), dtype=np.uint8))
            continue

        nw = max(1, int(round(cw * scale)))
        nh = max(1, int(round(ch * scale)))
        resized = cv2.resize(crop, (nw, nh), interpolation=cv2.INTER_LANCZOS4)

        canvas = np.zeros((canvas_size, canvas_size, 4), dtype=np.uint8)
        if lock_feet:
            rel_foot_x = int(round((item["foot_point"][0] - x0) * scale))
            px = target_foot_x - rel_foot_x
            py = target_foot_y - nh
        else:
            px = (canvas_size - nw) // 2
            py = (canvas_size - nh) // 2

        # Bezpieczne wklejenie w granice canvasu
        src_x0 = max(0, -px)
        src_y0 = max(0, -py)
        dst_x0 = max(0, px)
        dst_y0 = max(0, py)
        copy_w = min(nw - src_x0, canvas_size - dst_x0)
        copy_h = min(nh - src_y0, canvas_size - dst_y0)

        if copy_w > 0 and copy_h > 0:
            canvas[dst_y0 : dst_y0 + copy_h, dst_x0 : dst_x0 + copy_w] = resized[
                src_y0 : src_y0 + copy_h, src_x0 : src_x0 + copy_w
            ]
        normalized.append(canvas)

    return normalized


def rgba_to_base64_png(rgba: np.ndarray) -> str:
    """Konwertuje macierz RGBA NumPy do Data URL PNG (base64)."""
    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=False)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def base64_to_rgba(data_url: str) -> np.ndarray:
    """Dekoduje Data URL PNG/WebP z powrotem do macierzy RGBA NumPy."""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url)
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    return np.asarray(img, dtype=np.uint8).copy()


def extract_video_to_frames(
    video_path: str | Path,
    max_frames: int = 64,
    sample_fps: Optional[float] = None,
    bg_mode: str = "none",
    tolerance: int = 38,
    custom_key_rgb: Tuple[int, int, int] = (0, 255, 0),
    canvas_size: int = 512,
    lock_feet: bool = True,
    anchor_y: float = 0.95,
) -> Dict[str, Any]:
    """
    Rozbija plik MP4/WebM/MOV/GIF na klatki przy użyciu puli 16 procesów CPU.
    Zwraca metadane wideo, wykres energii ruchu (motion delta) oraz listę klatek RGBA.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Nie można otworzyć pliku wideo: {video_path}")

    native_fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 512)
    orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 512)

    raw_frames: List[Tuple[int, np.ndarray]] = []
    step = 1
    if sample_fps and sample_fps > 0 and native_fps > sample_fps:
        step = max(1, int(round(native_fps / sample_fps)))
    elif total_video_frames > max_frames and max_frames > 0:
        step = max(1, total_video_frames // max_frames)

    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % step == 0:
            raw_frames.append((len(raw_frames), frame))
            if len(raw_frames) >= max_frames:
                break
        frame_idx += 1
    cap.release()

    if not raw_frames:
        raise ValueError("Plik wideo nie zawiera czytelnych klatek obrazu.")

    opts = {
        "bg_mode": bg_mode,
        "tolerance": tolerance,
        "custom_key_rgb": list(custom_key_rgb),
        "feather": 0.8,
    }
    tasks = [(i, frame, opts) for i, frame in raw_frames]

    with ProcessPoolExecutor(max_workers=CPU_WORKERS) as pool:
        results = list(pool.map(_process_single_frame_worker, tasks))

    results.sort(key=lambda x: x["index"])

    if canvas_size > 0:
        rgba_list = normalize_frames_to_canvas(
            results,
            canvas_size=canvas_size,
            anchor_x=0.5,
            anchor_y=anchor_y,
            lock_feet=lock_feet,
        )
    else:
        rgba_list = [r["rgba"] for r in results]

    # Obliczenie energii ruchu między kolejnymi klatkami (do automatycznego wykrywania kulminacji ataku)
    motion_scores: List[float] = [0.0]
    for i in range(1, len(rgba_list)):
        prev_g = cv2.cvtColor(rgba_list[i - 1][:, :, :3], cv2.COLOR_RGB2GRAY).astype(np.float32)
        curr_g = cv2.cvtColor(rgba_list[i][:, :, :3], cv2.COLOR_RGB2GRAY).astype(np.float32)
        diff = float(np.mean(np.abs(curr_g - prev_g)))
        motion_scores.append(round(diff, 2))

    frames_payload = []
    for i, rgba in enumerate(rgba_list):
        frames_payload.append({
            "index": i,
            "timestamp_ms": int(round((i * step / max(1.0, native_fps)) * 1000)),
            "motion_score": motion_scores[i],
            "bbox": results[i]["bbox"],
            "foot_point": results[i]["foot_point"],
            "data_url": rgba_to_base64_png(rgba),
        })

    return {
        "native_fps": round(native_fps, 2),
        "original_size": [orig_w, orig_h],
        "canvas_size": canvas_size,
        "total_extracted": len(frames_payload),
        "cpu_workers_used": CPU_WORKERS,
        "frames": frames_payload,
    }
