"""Resize a world-v2 kit pack to the size it is actually drawn at, as a new pack version.

  python3 scripts/worldgen/v2/downscale_kit_pack.py <delivery dir> <new version>

Kit parts were painted at ~1000 px but are drawn 130-1250 world units wide (camera zoom <= 1), so
every texture held 3-7x the pixels the screen can show and the world art alone exceeded the
runtime texture budget, which then refused every monster spawn. Each part is resized so its
longer side is 1.5x (sharp on high-DPI phones) the largest size any placement in
public/game/worlds/superior-v2 draws it at, never below 256 px and never upscaled.
Aspect ratio, ids, bindings, placement and provenance are kept; the new delivery is written to
deliveries/<pack>-<version>/ for `npm run assets:import -- <dir>/manifest.json --install --replace`.
"""
import json, math, shutil, sys
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parents[3]
SCALE, MIN_SIDE = 1.5, 256
src, version = Path(sys.argv[1]), sys.argv[2]
manifest = json.loads((src / "manifest.json").read_text())
pack = manifest["id"]
out = REPO / "deliveries" / ("%s-%s" % (pack, version))
out.mkdir(parents=True, exist_ok=True)

# Largest drawn size per binding key "<pack>.<part>" over every runtime art file.
drawn: dict[str, float] = {}


def walk(node):
    if isinstance(node, dict):
        asset = node.get("asset")
        if isinstance(asset, str) and isinstance(node.get("width"), (int, float)):
            size = max(node["width"], node.get("height") or 0)
            drawn[asset] = max(drawn.get(asset, 0), size)
        for v in node.values():
            walk(v)
    elif isinstance(node, list):
        for v in node:
            walk(v)


for f in (REPO / "public/game/worlds/superior-v2/art").rglob("*.art.json"):
    walk(json.loads(f.read_text()))
placement = json.loads((src / "placement.json").read_text())

before = after = 0
for asset in manifest["assets"]:
    part = asset["id"][len(pack) + 1 :]
    key = pack + "." + part
    shown = drawn.get(key) or max(placement[key]["width"], placement[key]["height"])
    im = Image.open(src / asset["url"])
    side = max(im.size)
    target = min(side, max(MIN_SIDE, math.ceil(shown * SCALE)))
    if target < side:
        k = target / side
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    im.save(out / asset["url"], "WEBP", quality=90, method=6)
    before += asset["width"] * asset["height"]
    after += im.width * im.height
    asset.update(version=version, width=im.width, height=im.height)
manifest["version"] = version
(out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
for name in ("placement.json", "provenance.json"):
    shutil.copy(src / name, out / name)
print(json.dumps({"pack": pack, "version": version, "parts": len(manifest["assets"]),
                  "rgbaMiB": [round(before * 4 / 2**20), round(after * 4 / 2**20)]}))
