"""Rebuilds metadata.json and contact sheets for a landscape-v2 render folder from the PNG files on disk.

  python3 sheets_landscape_v2.py <tag>
Verifies every PNG decodes (the network volume can lag right after a write) and records SHA-256 and the
seam error of textures.
"""
import hashlib, json, sys, time
from pathlib import Path
import numpy as np
from PIL import Image

tag = sys.argv[1] if len(sys.argv) > 1 else "p0"
OUT = Path("/workspace/ki-legends-gpu/renders/landscape-v2-%s" % tag)
KINDS = {"tex": "textures", "spr": "sprites", "fau": "fauna"}
BAD = []
meta = {"tag": tag, "model": "DreamShaperXL_Turbo_v2_1", **{v: [] for v in KINDS.values()}}


def load(p):
    for _ in range(10):
        try:
            im = Image.open(p)
            im.load()
            return im
        except OSError:
            time.sleep(1)
    BAD.append(p.name)
    return None


def seam(img):
    a = np.asarray(img.convert("RGB"), dtype=np.float32)
    return round(float((np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0] - a[-1]).mean()) / 2), 2)


for p in sorted(OUT.glob("*.png")):
    kind, rest = p.stem.split("-", 1)
    name, seed = rest.rsplit("-s", 1)
    im = load(p)
    if im is None:
        continue
    row = {"file": p.name, "name": name, "seed": int(seed), "size": list(im.size),
           "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
    if kind == "tex":
        row["seam_error"] = seam(im)
    meta[KINDS[kind]].append(row)
for kind, key, cols in (("tex", "textures", 5), ("spr", "sprites", 6), ("fau", "fauna", 4)):
    names = sorted({r["name"] for r in meta[key]})
    seeds = sorted({r["seed"] for r in meta[key]})
    c = 256
    rows = (len(names) + cols - 1) // cols
    for sd in seeds:
        sh = Image.new("RGB", (cols * c, rows * c), "white")
        for i, n in enumerate(names):
            p = OUT / ("%s-%s-s%d.png" % (kind, n, sd))
            if p.exists():
                im = load(p)
                if im is not None:
                    sh.paste(im.convert("RGB").resize((c, c), Image.LANCZOS), ((i % cols) * c, (i // cols) * c))
        sh.save(OUT / ("sheet-%s-%d.jpg" % (kind, sd)), quality=86)
        print("sheet", kind, sd, len(names))
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE", {k: len(v) for k, v in meta.items() if isinstance(v, list)}, "BAD", sorted(set(BAD)))
