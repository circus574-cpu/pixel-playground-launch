"""Build one importer-ready terrain pack per continent from the generated seamless textures.
  python3 build_terrain_packs.py <texture-dir-with-pngs> <selection.json> <out-dir>
selection.json: {"aether-ground": 5741102, ...}  (texture name -> seed). Output: <out-dir>/<world>-terrain-v2-1.0.0/{manifest.json,*.webp}
Same convention as the installed *-start packs: 512x512 images, fit "stretch", tileSize in world units.
Verdantia keeps the accepted forest atlas and is not part of this build.
"""
import hashlib, json, sys
from pathlib import Path
from PIL import Image

src, sel, out = Path(sys.argv[1]), json.loads(Path(sys.argv[2]).read_text()), Path(sys.argv[3])
TILE = {"ground": 320, "path": 208, "plaza": 288, "wall": 256}
for world in ("aether", "nexus", "pyra"):
    pid = "%s-terrain-v2" % world; d = out / (pid + "-1.0.0"); d.mkdir(parents=True, exist_ok=True)
    assets, bindings, files = [], {}, []
    for kind, tile in TILE.items():
        name = "%s-%s" % (world, kind); seed = sel[name]
        im = Image.open(src / ("%s-s%d.png" % (name, seed))).convert("RGB").resize((512, 512), Image.LANCZOS)
        fn = "%s-%s.webp" % (pid, kind); im.save(d / fn, "WEBP", lossless=True, quality=100, method=4)
        assets.append({"id": "%s-%s" % (pid, kind), "version": "1.0.0", "kind": "image", "url": fn, "width": 512, "height": 512})
        bindings["terrain.%s" % name] = {"asset": "%s-%s" % (pid, kind), "fit": "stretch", "tileSize": [tile, tile]}
        files.append({"texture": name, "seed": seed, "source_png_sha256": hashlib.sha256((src / ("%s-s%d.png" % (name, seed))).read_bytes()).hexdigest(), "webp_sha256": hashlib.sha256((d / fn).read_bytes()).hexdigest()})
    pack = {"schemaVersion": 1, "id": pid, "version": "1.0.0", "technical": False, "previewOnly": True, "assets": assets, "actors": [], "actorBindings": {}, "renderBindings": bindings, "effects": {}}
    (d / "manifest.json").write_text(json.dumps(pack, indent=2) + "\n"); (d / "provenance.json").write_text(json.dumps({"pack": pid, "textures": files}, indent=1) + "\n"); print("PACK", pid, len(assets))
