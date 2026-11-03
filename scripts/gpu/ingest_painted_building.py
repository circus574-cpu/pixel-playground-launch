#!/usr/bin/env python3
"""Cut a generated building out of its background and write a trimmed webp.

usage: ingest_painted_building.py <in.png> <out.webp> [max_width]
White-background renders are flood-filled from the border; RGBA renders keep their
alpha but the soft glow halo is thresholded away. Prints the trim box and the
door-anchor guess (bottom-centre of the opaque area) as JSON.
"""
import json, sys
import cv2, numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
max_w = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
im = Image.open(src)
if im.mode == "RGBA" and im.getchannel("A").getextrema()[0] < 255:
    rgba = np.array(im)
    a = rgba[..., 3].astype(np.float32)
    # glow halo is low alpha; the building itself is (almost) opaque
    a = np.clip((a - 200) / 55, 0, 1)
else:
    rgb = np.array(im.convert("RGB"))
    h, w = rgb.shape[:2]
    near = (rgb.min(axis=2) >= 236).astype(np.uint8)
    mask = np.zeros((h + 2, w + 2), np.uint8)
    bg = np.zeros((h, w), np.uint8)
    work = near.copy()
    for pt in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if work[pt[1], pt[0]] == 1:
            cv2.floodFill(work, mask, pt, 2)
    bg = (work == 2).astype(np.uint8)
    bg = cv2.dilate(bg, np.ones((3, 3), np.uint8))  # eat the white fringe
    a = 1 - cv2.GaussianBlur(bg.astype(np.float32), (0, 0), 0.9)
    rgba = np.dstack([rgb, np.zeros((h, w), np.uint8)])
# keep only the largest connected component (removes stray specks)
bin_ = (a > 0.5).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(bin_)
keep = np.zeros_like(bin_)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] > 0.002 * bin_.size:
        keep[lab == i] = 1
keep = cv2.dilate(keep, np.ones((5, 5), np.uint8))
a = a * keep
rgba[..., 3] = np.round(a * 255).astype(np.uint8)
ys, xs = np.where(rgba[..., 3] > 8)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
out = Image.fromarray(rgba).crop((x0, y0, x1, y1))
if out.width > max_w:
    out = out.resize((max_w, round(out.height * max_w / out.width)), Image.LANCZOS)
out.save(dst, "WEBP", quality=90, method=6)
print(json.dumps({"size": out.size, "box": [int(x0), int(y0), int(x1), int(y1)]}))
