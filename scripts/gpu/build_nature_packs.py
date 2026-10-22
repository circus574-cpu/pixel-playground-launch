"""Build the importer-ready nature packs from selected textures and matted sprites.
  python3 build_nature_packs.py <textures-dir (tex-<name>-s<seed>.png)> <sprites-dir (<name>-s<seed>.png RGBA)> <selection.json> <out-dir>
selection.json: {"textures": {name: seed}, "sprites": {name: seed}, "patches": [names that are opaque top-down patches, not cut-outs]}
Outputs <out-dir>/nature-textures-v1-1.0.0 (terrain.nature-<name>, 512px, tileSize 256) and nature-objects-v1-1.0.0 (object.nature.<name>, longest side <= 768).
Both packs are previewOnly. They add NEW binding keys; wiring them into maps is the integrator's task.
"""
import hashlib, json, sys
from pathlib import Path
from PIL import Image

tdir, sdir, sel, out = Path(sys.argv[1]), Path(sys.argv[2]), json.loads(Path(sys.argv[3]).read_text()), Path(sys.argv[4])
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def pack(pid, assets, bindings, prov):
    d = out / (pid + "-1.0.0"); (d / "manifest.json").write_text(json.dumps({"schemaVersion": 1, "id": pid, "version": "1.0.0", "technical": False, "previewOnly": True, "assets": assets, "actors": [], "actorBindings": {}, "renderBindings": bindings, "effects": {}}, indent=2) + "\n")
    (d / "provenance.json").write_text(json.dumps({"pack": pid, "items": prov}, indent=1) + "\n"); print("PACK", pid, len(assets))
d1 = out / "nature-textures-v1-1.0.0"; d1.mkdir(parents=True, exist_ok=True); a, b, p = [], {}, []
for name, seed in sel["textures"].items():
    src = tdir / ("tex-%s-s%d.png" % (name, seed)); fn = "nature-textures-v1-%s.webp" % name
    Image.open(src).convert("RGB").resize((512, 512), Image.LANCZOS).save(d1 / fn, "WEBP", lossless=True, quality=100, method=4)
    a.append({"id": "nature-tex-" + name, "version": "1.0.0", "kind": "image", "url": fn, "width": 512, "height": 512}); b["terrain.nature-" + name] = {"asset": "nature-tex-" + name, "fit": "stretch", "tileSize": [256, 256]}
    p.append({"name": name, "seed": seed, "source_sha256": sha(src), "webp_sha256": sha(d1 / fn)})
pack("nature-textures-v1", a, b, p)
d2 = out / "nature-objects-v1-1.0.0"; d2.mkdir(parents=True, exist_ok=True); a, b, p = [], {}, []
for name, seed in sel["sprites"].items():
    src = sdir / ("%s-s%d.png" % (name, seed)); fn = "nature-objects-v1-%s.webp" % name; im = Image.open(src).convert("RGBA"); k = min(1.0, 768 / max(im.size))
    if k < 1: im = im.resize((round(im.size[0] * k), round(im.size[1] * k)), Image.LANCZOS)
    im.save(d2 / fn, "WEBP", lossless=True, quality=100, method=4)
    a.append({"id": "nature-obj-" + name, "version": "1.0.0", "kind": "image", "url": fn, "width": im.size[0], "height": im.size[1]}); b[("object.nature.patch-" if name in sel.get("patches", []) else "object.nature.") + name] = ({"asset": "nature-obj-" + name, "fit": "contain"} if name in sel.get("patches", []) else {"asset": "nature-obj-" + name, "fit": "contain", "origin": [0.5, 0.92]})
    p.append({"name": name, "seed": seed, "opaque_patch": name in sel.get("patches", []), "source_sha256": sha(src), "webp_sha256": sha(d2 / fn)})
pack("nature-objects-v1", a, b, p)
