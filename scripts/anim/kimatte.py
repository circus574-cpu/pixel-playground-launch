import os
import numpy as np, cv2
from PIL import Image

def estimate_bg(rgb):
    h, w = rgb.shape[:2]; s = 24
    patches = [rgb[:s, :s], rgb[:s, -s:], rgb[-s:, :s], rgb[-s:, -s:]]
    return np.median(np.concatenate([p.reshape(-1, 3) for p in patches]), 0).astype(np.float32)

def fx_alpha(rgb, body_a, gate_lo=0.10, gate_hi=0.35):
    """Colour-to-alpha against the (grey/white) video background: coloured glow, flames and beams survive, neutral shadows do not."""
    f = rgb.astype(np.float32) / 255.0
    bg = np.maximum(estimate_bg(rgb) / 255.0, 0.3)
    c = np.clip(f / bg, 0, 1)
    a = 1.0 - c.min(2)
    col = np.clip((c - (1 - a)[..., None]) / np.maximum(a, 1e-3)[..., None], 0, 1)
    chroma = col.max(2) - col.min(2)
    gate = np.clip((chroma - gate_lo) / (gate_hi - gate_lo), 0, 1)
    # a real colour deviation from the background, not the amplified noise of a grey vignette
    gate *= np.clip((c.max(2) - c.min(2) - 0.03) / 0.05, 0, 1)
    a = a * gate
    a[a < float(os.environ.get('KIMATTE_MIN_A', '0.07'))] = 0
    a = cv2.GaussianBlur(a, (0, 0), 0.7)
    return a, col

def solid_body(ba):
    """rembg gives the figure partial alpha when a bright effect overlaps it: threshold, keep the large pieces, fill holes."""
    hard = (ba > 0.3).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(hard, 8)
    keep = np.zeros_like(hard)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 400: keep[lab == i] = 1
    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    inv = (1 - keep).astype(np.uint8); n, lab, st, _ = cv2.connectedComponentsWithStats(inv, 4)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 3000: keep[lab == i] = 1
    return np.maximum(ba, cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 1.0))

def body_from_general(rgb, anime_a, gen_a):
    """Parts of the figure rembg-anime lost behind a bright effect: take the general model's mask where the pixel is not effect-coloured
    (strongly saturated, or cyan/green/red hues), and keep only pieces connected to the anime body."""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    H, S = hsv[..., 0], hsv[..., 1] / 255.0
    fxlike = (S > 0.58) | ((H >= 45) & (H <= 105) & (S > 0.2)) | (((H >= 165) | (H <= 6)) & (S > 0.35))
    cand = ((gen_a > 0.5) & ~fxlike).astype(np.uint8)
    cand = cv2.morphologyEx(cand, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    seed = cv2.dilate((anime_a > 0.5).astype(np.uint8), np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(cand, 8)
    keep = np.zeros_like(cand)
    for i in range(1, n):
        m = lab == i
        if st[i, cv2.CC_STAT_AREA] >= 150 and seed[m].any(): keep[m] = 1
    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    return cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 0.8)

def composite(rgb, body_rgba, gen_alpha=None):
    """Union of the rembg body and the colour-to-alpha effects. Returns RGBA uint8."""
    ba0 = body_rgba[..., 3].astype(np.float32) / 255.0
    ba = solid_body(ba0)
    if gen_alpha is not None: ba = np.maximum(ba, body_from_general(rgb, ba0, gen_alpha.astype(np.float32) / 255.0))
    ba = ba[..., None]
    a, col = fx_alpha(rgb, ba[..., 0])
    a = a[..., None]
    alpha = ba + (1 - ba) * a
    base = rgb.astype(np.float32) / 255.0
    prem = ba * base + (1 - ba) * a * col
    out = np.where(alpha > 1e-3, prem / np.maximum(alpha, 1e-3), 0)
    return np.clip(np.concatenate([out, alpha], 2) * 255, 0, 255).astype(np.uint8)
