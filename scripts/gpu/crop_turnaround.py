"""Cut the character views out of turnaround sheets into a LoRA training set.

  python3 crop_turnaround.py <turnaround dir> <out dir> <seed list>   (e.g. s7450104,s7450106)
Matting (rembg) of the whole sheet, split by empty alpha columns, keep only tall full-body figures (>= 55 % of the
sheet height), paste each on a white 1024 square keeping the aspect. Loose parts (sleeves, capes) are skipped.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from rembg import remove, new_session

src, out, seeds = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3].split(",")
out.mkdir(parents=True, exist_ok=True)
sess = new_session()
n = 0
for sd in seeds:
    sheet = Image.open(src / (sd + ".png")).convert("RGB")
    a = np.asarray(remove(sheet, session=sess).getchannel("A")) > 40
    # A column counts as occupied only with enough mask pixels, so thin capes and swords do not bridge two figures.
    cols = a.sum(axis=0) > 0.06 * sheet.height
    segs, start = [], None
    for x, v in enumerate(cols):
        if v and start is None:
            start = x
        if (not v or x == len(cols) - 1) and start is not None:
            segs.append((start, x)); start = None
    for (x0, x1) in segs:
        if x1 - x0 < 90 or x1 - x0 > 0.45 * sheet.width:
            continue
        ys = np.where(a[:, x0:x1].any(axis=1))[0]
        if ys.size == 0 or (ys[-1] - ys[0]) < 0.55 * sheet.height:
            continue
        crop = sheet.crop((max(0, x0 - 12), max(0, ys[0] - 12), min(sheet.width, x1 + 12), min(sheet.height, ys[-1] + 12)))
        k = 1000 / max(crop.size)
        crop = crop.resize((round(crop.width * k), round(crop.height * k)), Image.LANCZOS)
        canvas = Image.new("RGB", (1024, 1024), (255, 255, 255))
        canvas.paste(crop, ((1024 - crop.width) // 2, (1024 - crop.height) // 2))
        canvas.save(out / ("%s-%d.png" % (sd, n)))
        n += 1
print("crops", n)
