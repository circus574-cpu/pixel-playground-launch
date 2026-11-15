#!/usr/bin/env python3
"""Make the painted equirectangular atlas continuous where x = 0 meets x = W.

The flat map repeats the atlas sideways (wrap copies), so a tone step or a cut coastline along the seam shows as a
straight vertical line. Two corrections, both confined to the edges:

  1. the low-frequency step between the two edge columns is spread over a wide band (a smooth ramp, per row);
  2. a narrow band is mirror-blended so the outermost pixels of both edges are identical.

  python3 scripts/worldgen/v2/seam.py src/assets/planet-map/atlas-v2-3840.webp src/assets/planet-map/atlas-v2-1920.webp

build_v2_atlas.py calls seal() before it saves, so a regenerated atlas keeps the fix. Running it twice changes
almost nothing: the second run finds no step left.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter1d

# Quality the atlas generator uses for each size.
QUALITY = {3840: 88, 1920: 86}


def seal(img: Image.Image) -> Image.Image:
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    wide = max(32, round(w * 260 / 3840))
    narrow = max(6, round(w * 24 / 3840))
    # 1. low-frequency step per row, spread over the wide band
    left = a[:, :12].mean(axis=1)
    right = a[:, -12:].mean(axis=1)
    step = gaussian_filter1d(left - right, 24 * h / 1920, axis=0)[:, None, :]
    ramp = np.linspace(0.0, 1.0, wide, dtype=np.float32)[None, :, None]
    a[:, -wide:] += step * ramp * 0.5
    a[:, :wide] -= step * ramp[:, ::-1] * 0.5
    # 2. mirror blend: both outermost columns become the average of the pair, fading out over `narrow` pixels
    t = np.arange(narrow, dtype=np.float32)
    mix = (0.5 * (1.0 - t / narrow))[None, :, None]
    left_band = a[:, :narrow].copy()
    right_band = a[:, ::-1][:, :narrow].copy()  # column W-1-t
    a[:, :narrow] = left_band * (1 - mix) + right_band * mix
    a[:, ::-1][:, :narrow] = right_band * (1 - mix) + left_band * mix
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8))


def edge_step(img: Image.Image) -> float:
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    return float(np.abs(a[:, :2].mean(axis=1) - a[:, -2:].mean(axis=1)).mean())


if __name__ == '__main__':
    for name in sys.argv[1:]:
        path = Path(name)
        before = Image.open(path)
        step0 = edge_step(before)
        out = seal(before)
        out.save(path, 'WEBP', quality=QUALITY.get(out.width, 86), method=6)
        print(f'{path.name}: edge step {step0:.1f} -> {edge_step(Image.open(path)):.1f}')
