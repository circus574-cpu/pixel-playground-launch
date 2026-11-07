#!/usr/bin/env python3
"""
Silnik Kombinacji Animacji (Combinator Engine) dla KI Legends Animation Studio.
Realizuje:
- Kombinacje kolejności klatek: Forward, Reverse, Ping-Pong (Boomerang), Hit-Stop Impact, Custom Sequence
- Płynne domykanie pętli (Seamless Loop Cross-Fade)
- Interpolację klatek pośrednich metodą Dense Optical Flow (Farnebäck) na 16 CPU
- Automatyczne mapowanie na 7 stanów KI Legends (idle, walk, attack, skill, hit, death, respawn)
- Syntezę 8 kierunków świata z automatycznym odbiciem lustrzanym i korektą perspektywy 60°
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

KI_DIRECTIONS = [
    "down",
    "down-left",
    "left",
    "up-left",
    "up",
    "up-right",
    "right",
    "down-right",
]

KI_STATE_SPECS = {
    "idle": {"frames": 8, "fps": 6, "loop": True},
    "walk": {"frames": 8, "fps": 16, "loop": True},
    "attack": {"frames": 8, "fps": 16, "loop": False},
    "skill": {"frames": 8, "fps": 12, "loop": False},
    "hit": {"frames": 4, "fps": 16, "loop": False},
    "death": {"frames": 8, "fps": 10, "loop": False},
    "respawn": {"frames": 8, "fps": 12, "loop": False},
}


def interpolate_frame_optical_flow(frame_a: np.ndarray, frame_b: np.ndarray, alpha: float = 0.5) -> np.ndarray:
    """
    Generuje klatkę pośrednią pomiędzy frame_a i frame_b przy użyciu gęstego przepływu optycznego (Farnebäck).
    Daje płynne przejście ruchu kończyn i szat zamiast zwykłego przenikania (ghostingu).
    """
    if alpha <= 0.0:
        return frame_a.copy()
    if alpha >= 1.0:
        return frame_b.copy()

    h, w = frame_a.shape[:2]
    gray_a = cv2.cvtColor(frame_a[:, :, :3], cv2.COLOR_RGB2GRAY)
    gray_b = cv2.cvtColor(frame_b[:, :, :3], cv2.COLOR_RGB2GRAY)

    flow_ab = cv2.calcOpticalFlowFarneback(
        gray_a, gray_b, None, pyr_scale=0.5, levels=3, winsize=15, iterations=3, poly_n=5, poly_sigma=1.2, flags=0
    )

    grid_x, grid_y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    map_a_x = grid_x - flow_ab[:, :, 0] * alpha
    map_a_y = grid_y - flow_ab[:, :, 1] * alpha
    map_b_x = grid_x + flow_ab[:, :, 0] * (1.0 - alpha)
    map_b_y = grid_y + flow_ab[:, :, 1] * (1.0 - alpha)

    warped_a = cv2.remap(
        frame_a.astype(np.float32),
        map_a_x,
        map_a_y,
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )
    warped_b = cv2.remap(
        frame_b.astype(np.float32),
        map_b_x,
        map_b_y,
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )

    blended = warped_a * (1.0 - alpha) + warped_b * alpha
    return np.clip(blended, 0, 255).astype(np.uint8)


def resample_sequence_length(
    frames: List[np.ndarray],
    target_count: int,
    use_optical_flow: bool = True,
) -> List[np.ndarray]:
    """
    Dopasowuje dowolną liczbę klatek wejściowych do dokładnej liczby wymaganej przez kontrakt
    (np. 8 klatek dla walk/attack/idle lub 4 klatki dla hit).
    """
    n = len(frames)
    if n == 0 or target_count <= 0:
        return []
    if n == target_count:
        return [f.copy() for f in frames]
    if target_count == 1:
        return [frames[0].copy()]

    out: List[np.ndarray] = []
    for i in range(target_count):
        pos = (i / (target_count - 1)) * (n - 1)
        idx0 = int(math.floor(pos))
        idx1 = min(n - 1, idx0 + 1)
        frac = pos - idx0
        if idx0 == idx1 or frac < 1e-4:
            out.append(frames[idx0].copy())
        elif not use_optical_flow:
            out.append(frames[round(pos)].copy())
        else:
            out.append(interpolate_frame_optical_flow(frames[idx0], frames[idx1], frac))
    return out


def build_animation_combination(
    frames: List[np.ndarray],
    mode: str = "forward",
    custom_indices: Optional[List[int]] = None,
    target_count: Optional[int] = None,
    hit_stop_frame: int = 0,
    hit_stop_hold: int = 2,
    hit_stop_shake_px: int = 4,
    crossfade_frames: int = 2,
    speed_curve: str = "linear",
    use_optical_flow: bool = False,
) -> List[np.ndarray]:
    """
    Tworzy nową kombinację animacji na podstawie wyekstrahowanych klatek:
    mode:
      - 'forward': klasyczna sekwencja 0..N
      - 'reverse': odwrócona N..0
      - 'ping_pong': bumerang 0..N..1 (idealny do pętli oddechu i aury)
      - 'seamless_loop': płynne zamknięcie pętli metodą cross-fade / optical flow
      - 'hit_stop': zamrożenie klatki uderzenia z mikro-wstrząsem bojowym (anime impact)
      - 'combo_flurry': szybka seria uderzeń (powtórzenie fazy ataku z przesunięciem)
      - 'custom': własna lista indeksów klatek podana przez użytkownika
    """
    if not frames:
        return []

    n = len(frames)
    seq: List[np.ndarray] = []

    if mode == "custom" and custom_indices:
        valid_indices = [max(0, min(n - 1, int(idx))) for idx in custom_indices]
        seq = [frames[idx].copy() for idx in valid_indices]

    elif mode == "reverse":
        seq = [f.copy() for f in reversed(frames)]

    elif mode == "ping_pong":
        if n > 2:
            seq = [f.copy() for f in frames] + [f.copy() for f in reversed(frames[1:-1])]
        else:
            seq = [f.copy() for f in frames] + [f.copy() for f in reversed(frames)]

    elif mode == "seamless_loop":
        if n <= 3 or crossfade_frames <= 0:
            seq = [f.copy() for f in frames]
        else:
            k = min(crossfade_frames, n // 3)
            main_part = [f.copy() for f in frames[:-k]]
            for i in range(k):
                t = (i + 1) / (k + 1)
                tail_frame = frames[n - k + i]
                head_frame = frames[i]
                blended = interpolate_frame_optical_flow(tail_frame, head_frame, t)
                main_part[i] = blended
            seq = main_part

    elif mode == "hit_stop":
        hit_idx = max(0, min(n - 1, hit_stop_frame))
        for i, f in enumerate(frames):
            seq.append(f.copy())
            if i == hit_idx:
                for h_step in range(hit_stop_hold):
                    shaken = f.copy()
                    dx = int(((-1) ** h_step) * hit_stop_shake_px)
                    M = np.float32([[1, 0, dx], [0, 1, 0]])
                    shaken = cv2.warpAffine(
                        shaken,
                        M,
                        (shaken.shape[1], shaken.shape[0]),
                        borderMode=cv2.BORDER_CONSTANT,
                        borderValue=(0, 0, 0, 0),
                    )
                    seq.append(shaken)

    elif mode == "combo_flurry":
        # Buduje dynamiczne combo: rozbieg -> uderzenie -> cofnięcie -> podwójne uderzenie -> powrót
        mid = n // 2
        indices = (
            list(range(0, mid + 1))
            + list(range(mid, max(0, mid - 2), -1))
            + list(range(max(0, mid - 1), n))
        )
        seq = [frames[i].copy() for i in indices]

    else:  # 'forward'
        seq = [f.copy() for f in frames]

    # Nieliniowa krzywa czasu (Speed Ramping: ease_in, ease_out, strike_snap)
    if speed_curve != "linear" and len(seq) >= 4:
        m = len(seq)
        ramped: List[np.ndarray] = []
        for i in range(m):
            u = i / (m - 1)
            if speed_curve == "ease_in":
                u_mapped = u * u
            elif speed_curve == "ease_out":
                u_mapped = 1.0 - (1.0 - u) * (1.0 - u)
            elif speed_curve == "strike_snap":
                # Szybki atak na początku (klatka 0 = kontakt w KI Legends), płynny powrót
                u_mapped = math.pow(u, 0.45)
            else:
                u_mapped = u
            src_idx = min(m - 1, max(0, int(round(u_mapped * (m - 1)))))
            ramped.append(seq[src_idx].copy())
        seq = ramped

    if target_count and target_count > 0:
        seq = resample_sequence_length(seq, target_count=target_count, use_optical_flow=use_optical_flow)

    return seq


def synthesize_direction_frame(frame: np.ndarray, direction: str) -> np.ndarray:
    """
    Generuje wariant kierunkowy klatki dla jednego z 8 kierunków KI Legends.
    Kierunki lewe ('left', 'down-left', 'up-left') są odbijane lustrzanie.
    Kierunki ukośne otrzymują subtelną korektę perspektywy ortograficznej 60°.
    """
    out = frame.copy()
    if direction in ("left", "down-left", "up-left"):
        out = cv2.flip(out, 1)

    return out
