"""Matte (rembg) and trim given images; keeps the original aspect, long side <= MAXSIDE (env, default 1024).

  python3 matte_files.py <out dir> <png> [<png> ...]   -> <out dir>/<stem>.png with alpha
"""
import os, sys
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
sess = new_session()
for f in sys.argv[2:]:
    cut = remove(Image.open(f).convert("RGB"), session=sess)
    box = cut.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    cut = cut.crop(box)
    k = min(1.0, int(os.environ.get("MAXSIDE", "1024")) / max(cut.size))
    cut = cut.resize((max(1, round(cut.width * k)), max(1, round(cut.height * k))), Image.LANCZOS)
    cut.save(out / (Path(f).stem + ".png"))
    print(Path(f).stem, cut.size, flush=True)
