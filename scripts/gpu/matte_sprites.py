"""Cut generated nature sprites out of the white background (rembg isnet-general-use), crop to content with padding.
  /opt/rembg-venv/bin/python matte_sprites.py <nature-dir> <out-dir>      reads spr-<name>-s<seed>.png, writes <name>-s<seed>.png (RGBA, longest side <= 1024)
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from rembg import new_session, remove

src, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
session = new_session("isnet-general-use")
for f in sorted(src.glob("spr-*-s*.png")):
    rgba = remove(Image.open(f).convert("RGB"), session=session); a = np.array(rgba)[:, :, 3]; a[a < 20] = 0; rgba.putalpha(Image.fromarray(a))
    bb = rgba.getchannel("A").getbbox()
    if not bb: print("EMPTY", f.name); continue
    pad = 12; c = rgba.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(1024, bb[2] + pad), min(1024, bb[3] + pad)))
    c.save(out / f.name.replace("spr-", ""), "PNG"); print("CUT", f.name, c.size, flush=True)
print("SPRITES_DONE", flush=True)
