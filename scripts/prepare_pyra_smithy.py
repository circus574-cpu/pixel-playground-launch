"""Build the delivery package of the Pyra smithy parts (matted PNGs from scripts/gpu/matte_forge.py).

  python3 scripts/prepare_pyra_smithy.py <matted dir>
Writes deliveries/pyra-smithy-1.0.0/{*.webp,manifest.json,provenance.json}; install with
`npm run assets:import -- deliveries/pyra-smithy-1.0.0/manifest.json --install`.
Only the Pyra smithy uses it (portrait room), so it is a regular pack; the room is not published.
"""
import hashlib, json, sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

REPO = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1])
OUT = REPO / "deliveries" / "pyra-smithy-1.0.0"
OUT.mkdir(parents=True, exist_ok=True)
OBJ = ["anvil-stump", "furnace-fire", "chest-iron", "workbench-tools", "weapon-rack", "shelf-ingots", "barrels", "crates-stack",
       "lantern-post", "banner-flame", "grindstone", "coal-bin", "stairs-wood", "door-arch", "sign-hanging"]
TEX = {"floor": "tex-floor-flagstone", "wall": "tex-wall-dark-wood"}
assets, binds, prov = [], {}, []


def outline(im, px=5):
    """Thick dark painted outline (the mockup look) plus a little more contrast and warmth in the part itself."""
    rgb = ImageEnhance.Contrast(im.convert("RGB")).enhance(1.12)
    rgb = ImageEnhance.Color(rgb).enhance(1.08)
    a = im.getchannel("A")
    pad = px + 2
    canvas = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    big = Image.new("L", canvas.size, 0)
    big.paste(a, (pad, pad))
    grown = big.filter(ImageFilter.MaxFilter(2 * px + 1)).filter(ImageFilter.GaussianBlur(0.8))
    dark = Image.new("RGBA", canvas.size, (24, 13, 8, 255))
    canvas.paste(dark, (0, 0), grown)
    body = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    body.paste(Image.merge("RGBA", (*rgb.split(), a)), (pad, pad))
    canvas.alpha_composite(body)
    return canvas

for name in OBJ:
    src = SRC / (name + ".png")
    im = outline(Image.open(src).convert("RGBA"))
    f = OUT / ("pyra-smithy-%s.webp" % name)
    im.save(f, quality=90, method=6)
    assets.append({"id": "pyra-smithy-" + name, "version": "1.0.0", "kind": "image", "url": f.name, "width": im.width, "height": im.height})
    binds["object.pyra.smithy." + name] = {"asset": "pyra-smithy-" + name, "fit": "contain"}
    prov.append({"part": name, "source_png_sha256": hashlib.sha256(src.read_bytes()).hexdigest(), "webp_sha256": hashlib.sha256(f.read_bytes()).hexdigest()})
for key, name in TEX.items():
    src = SRC / (name + ".png")
    im = Image.open(src).convert("RGB")
    f = OUT / ("pyra-smithy-%s.webp" % key)
    im.save(f, quality=88, method=6)
    assets.append({"id": "pyra-smithy-" + key, "version": "1.0.0", "kind": "image", "url": f.name, "width": im.width, "height": im.height})
    binds["terrain.pyra.smithy-" + key] = {"asset": "pyra-smithy-" + key, "fit": "stretch", "tileSize": [256, 256]}
    prov.append({"part": key, "source_png_sha256": hashlib.sha256(src.read_bytes()).hexdigest(), "webp_sha256": hashlib.sha256(f.read_bytes()).hexdigest()})
manifest = {"schemaVersion": 1, "id": "pyra-smithy", "version": "1.0.0", "technical": False, "previewOnly": False, "assets": assets,
            "actors": [], "actorBindings": {}, "renderBindings": binds, "effects": {}}
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
(OUT / "provenance.json").write_text(json.dumps({"pack": "pyra-smithy", "generator": "DreamShaper XL Turbo v2.1 (scripts/gpu/gen_forge_parts.py), rembg matting",
                                                  "licenseStatus": "unresolved (see docs/ASSET-LICENSE-REGISTER.md)", "parts": prov}, indent=2) + "\n")
print("OK", len(assets), "assets")
