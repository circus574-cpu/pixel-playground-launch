"""Painterly finish (OpenCV/Pillow/NumPy): flattens colour into brush-like areas, keeps edges, adds paper grain and a soft vignette.
  python3 paint.py terrain IN.png OUT.png     |     python3 paint.py sprite IN.png OUT.png"""
import sys, cv2, numpy as np
mode, src, dst = sys.argv[1:4]
im = cv2.imread(src, cv2.IMREAD_UNCHANGED)
a = im[:, :, 3:4] if im.shape[2] == 4 else None
bgr = im[:, :, :3]
def finish(bgr, strong):
    f = cv2.edgePreservingFilter(bgr, flags=1, sigma_s=22 if strong else 10, sigma_r=0.22 if strong else 0.18)
    f = cv2.addWeighted(f, 1.0, cv2.GaussianBlur(f, (0, 0), 2.2), -0.0, 0)
    blur = cv2.GaussianBlur(f, (0, 0), 1.2); f = cv2.addWeighted(f, 1.55, blur, -0.55, 0)           # unsharp: crisp brush edges
    lab = cv2.cvtColor(f, cv2.COLOR_BGR2LAB).astype(np.float32); lab[:, :, 0] = np.clip((lab[:, :, 0] - 128) * 1.08 + 128, 0, 255)
    lab[:, :, 1:] = (lab[:, :, 1:] - 128) * 0.96 + 128; f = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)
    rng = np.random.default_rng(3); grain = rng.normal(0, 4.5 if strong else 2.5, f.shape[:2]).astype(np.float32); grain = cv2.GaussianBlur(grain, (0, 0), 0.9)
    return np.clip(f.astype(np.float32) + grain[:, :, None], 0, 255).astype(np.uint8)
if mode == "terrain":
    out = finish(bgr, True)
    h, w = out.shape[:2]; yy, xx = np.mgrid[0:h, 0:w]; v = 1 - 0.22 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) ** 1.2
    out = np.clip(out.astype(np.float32) * v[:, :, None], 0, 255).astype(np.uint8)
else:
    # sprites: keep the dark outline pixels, paint the inside; work on premultiplied colour to avoid halos
    pm = (bgr.astype(np.float32) * (a.astype(np.float32) / 255)).astype(np.uint8)
    out = finish(pm, False); out = np.where(a > 0, np.minimum(out, 255), 0).astype(np.uint8)
res = np.concatenate([out, a], axis=2) if a is not None else out
cv2.imwrite(dst, res)
