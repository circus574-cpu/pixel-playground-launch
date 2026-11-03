#!/usr/bin/env python3
"""Makes a generated ground texture tile without a visible seam (cross-fade with the half-rolled copy) and
saves it as <out>.webp at the given size.   usage: make_seamless.py <in> <out.webp> [size=1024]"""
import sys
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
im = Image.open(src).convert("RGB").resize((size, size), Image.LANCZOS)
a = np.asarray(im).astype(float)
h, w, _ = a.shape


def fix(img, axis):
    n = img.shape[axis]
    t = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (n / 2)
    wgt = np.clip(t * 1.6, 0, 1)  # full weight over the middle, fading near the edges
    wgt = wgt * wgt * (3 - 2 * wgt)
    shape = [1, 1, 1]
    shape[axis] = n
    wgt = wgt.reshape(shape)
    return img * wgt + np.roll(img, n // 2, axis=axis) * (1 - wgt)


a = fix(fix(a, 1), 0)
seam = np.abs(a[:, 0] - a[:, -1]).mean(), np.abs(a[0] - a[-1]).mean()
Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(out, quality=92, method=6)
print("seam after", [round(float(s), 1) for s in seam])
