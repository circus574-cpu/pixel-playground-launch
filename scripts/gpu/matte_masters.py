"""Cut the painted base views out of their backgrounds and place them on the fixed 512 production canvas.
Feet anchor (256, 486.4), >= 8 px margin, one scale for all eight views of a hero (keeps proportions consistent).
  /opt/rembg-venv/bin/python matte_masters.py <race> <painted-dir> <seed> <out-tag>
"""
import hashlib, json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from rembg import new_session, remove

race, src, seed, tag = sys.argv[1], Path(sys.argv[2]), sys.argv[3], sys.argv[4]
OUT = Path("/workspace/ki-legends-gpu/renders") / ("%s-masters-%s" % (race, tag)); OUT.mkdir(parents=True, exist_ok=True)
DIRS = ["down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right"]
session = new_session("isnet-anime")
cut = {}
for d in DIRS:
    im = Image.open(src / ("%s-%s-s%s.png" % (race, d, seed))).convert("RGB")
    rgba = remove(im, session=session, alpha_matting=False)
    a = np.array(rgba)[:, :, 3]; a[a < 24] = 0; rgba.putalpha(Image.fromarray(a))
    bbox = rgba.getchannel("A").getbbox(); cut[d] = (rgba.crop(bbox), bbox)
    print("CUT", d, bbox, flush=True)
scale = min(478 / max(c.size[1] for c, _ in cut.values()), 496 / max(c.size[0] for c, _ in cut.values()))
meta = {"race": race, "seed": seed, "scale": scale, "source": str(src), "views": []}
for d, (c, bbox) in cut.items():
    w, h = max(1, round(c.size[0] * scale)), max(1, round(c.size[1] * scale)); r = c.resize((w, h), Image.LANCZOS)
    arr = np.array(r.getchannel("A")); low = arr[int(h * .85):]; cols = np.where(low.max(axis=0) > 0)[0]; fx = (cols.min() + cols.max()) / 2 if len(cols) else w / 2
    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0)); x = round(256 - fx); y = round(486.4 - h)
    canvas.alpha_composite(r, (max(0, x), max(0, y))) if x >= 0 and y >= 0 else canvas.paste(r, (x, y), r)
    bb = canvas.getchannel("A").getbbox(); name = "%s-master-%s.png" % (race, d); canvas.save(OUT / name)
    sha = hashlib.sha256((OUT / name).read_bytes()).hexdigest()
    meta["views"].append({"file": name, "direction": d, "bounds": bb, "sha256": sha, "origin": [.5, .95]}); print("MASTER", d, bb, sha[:12], flush=True)
sheet = Image.new("RGB", (256 * 4, 256 * 2), (70, 70, 70))
for i, d in enumerate(DIRS):
    im = Image.open(OUT / ("%s-master-%s.png" % (race, d))).resize((256, 256), Image.LANCZOS); bg = Image.new("RGBA", (256, 256), (70, 70, 70, 255)); bg.alpha_composite(im); sheet.paste(bg.convert("RGB"), ((i % 4) * 256, (i // 4) * 256))
sheet.save(OUT / "masters-sheet.jpg", quality=90); (OUT / "metadata.json").write_text(json.dumps(meta, indent=1)); print("MASTERS_DONE", OUT, flush=True)
