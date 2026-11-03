#!/usr/bin/env python3
"""Adds one owner-generated isometric building to the pack `world-beauty-v1` and binds it over an existing
building binding (e.g. object.ki-v2-buildings.verdant-market).

usage: ingest_building.py <image> <binding e.g. object.ki-v2-buildings.verdant-market> <asset-id> [--width 760]
The white background is removed; the outlined diamond ground patch is trimmed so it does not read as a plate:
its lower rim is erased and its inner part fades out softly, the building itself is untouched.
"""
import hashlib, json, os, shutil, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
src, binding, asset_id = sys.argv[1:4]
width = int(sys.argv[sys.argv.index("--width") + 1]) if "--width" in sys.argv else 760
im = Image.open(src).convert("RGB")
a = np.asarray(im).astype(int)
white = a.min(2) >= 238
lab, _ = ndimage.label(white)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
fg = ~np.isin(lab, list(edge))
fg = ndimage.binary_opening(fg, iterations=1)
h, w = fg.shape
ys, xs = np.where(fg)
# Diamond: widest row of the silhouette's lower half gives the left/right vertices; the bottom is the lowest pixel.
bottom = ys.max()
rowwidth = np.array([fg[y].sum() for y in range(h)])
mid = int(np.argmax(np.where(np.arange(h) > h * 0.6, rowwidth, 0)))
cx = (xs.min() + xs.max()) / 2
hw = (xs.max() - xs.min()) / 2
hh = bottom - mid
Y, X = np.mgrid[0:h, 0:w]
d = np.abs(X - cx) / hw + np.abs(Y - mid) / hh  # 1.0 on the diamond edge (below the middle line)
lower = Y >= mid - 4
keep = np.ones((h, w), float)
inner, outer = 0.80, 1.0
fade = np.clip((outer - d) / (outer - inner), 0, 1)
keep = np.where(lower & fg, fade, 1.0)
alpha = (fg * keep * 255).astype(np.uint8)
alpha = np.asarray(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8)))
rgba = im.convert("RGBA")
rgba.putalpha(Image.fromarray(alpha))
ys, xs = np.where(alpha > 8)
rgba = rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
rgba = rgba.resize((width, round(rgba.size[1] * width / rgba.size[0])), Image.LANCZOS)
tmp = os.path.join("/tmp", asset_id + ".webp")
rgba.save(tmp, quality=92, method=6)
digest = hashlib.sha256(open(tmp, "rb").read()).hexdigest()[:12]
out = os.path.join(REPO, "public/game/assets/gpu/world-beauty-v1", f"1.0.0-{digest}")
os.makedirs(out, exist_ok=True)
shutil.copy(tmp, os.path.join(out, asset_id + ".webp"))
shutil.copy(src, os.path.join(out, "source-" + asset_id + os.path.splitext(src)[1]))
url = f"/game/assets/gpu/world-beauty-v1/1.0.0-{digest}/{asset_id}.webp"
path = os.path.join(REPO, "src/game/assets/imported.json")
packs = json.load(open(path))
pack = next((p for p in packs if p["id"] == "world-beauty-v1"), None)
if pack is None:
    pack = {"schemaVersion": 1, "id": "world-beauty-v1", "version": "1.0.0", "technical": False, "previewOnly": False,
            "assets": [], "actors": [], "actorBindings": {}, "renderBindings": {}, "effects": {}}
    packs.append(pack)
pack["assets"] = [x for x in pack["assets"] if x["id"] != asset_id] + [
    {"id": asset_id, "version": "1.0.0", "kind": "image", "url": url, "width": rgba.size[0], "height": rgba.size[1]}]
pack["renderBindings"][binding] = {"asset": asset_id, "fit": "contain"}
open(path, "w").write(json.dumps(packs, ensure_ascii=False, indent=2) + "\n")
print(asset_id, rgba.size, "->", binding)
