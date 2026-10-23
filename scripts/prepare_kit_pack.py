"""Turn a matted kit set (scripts/gpu/matte_files.py output) into an installable pack for world builders.

  python3 scripts/prepare_kit_pack.py <pack id> <version> <matted dir> [<matted dir> ...]
Writes deliveries/<pack>-<version>/ (webp parts with a dark painted outline, manifest.json, provenance.json,
placement.json) and registers bindings `object.<pack>.<name>`. Region JSON then uses `"asset": "<pack>.<name>"`.
placement.json carries a recommended display size, anchor, solid flag and collision footprint for every part, so a
world builder can place it without guessing (rules: docs/WORLD-ASSET-KIT-2026-10-23.md).
Install: npm run assets:import -- deliveries/<pack>-<version>/manifest.json --install
"""
import hashlib, json, re, sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

REPO = Path(__file__).resolve().parents[1]
pack, version = sys.argv[1], sys.argv[2]
dirs = [Path(d) for d in sys.argv[3:]]
OUT = REPO / "deliveries" / ("%s-%s" % (pack, version))
OUT.mkdir(parents=True, exist_ok=True)
# category -> (display width, solid, footprint width ratio, footprint height ratio of display height)
CATS = [
    (r"gate|hall|arena|inn|market|smithy|depot|castle|fortress", (520, True, 0.78, 0.22)),
    (r"wall", (420, True, 0.95, 0.14)),
    (r"tower|lighthouse|volcano|obelisk|pillar|spire", (240, True, 0.5, 0.2)),
    (r"house|hut|cabin|tent|igloo|boat|stall", (320, True, 0.75, 0.25)),
    (r"tree|palm|pine|oak|birch|cactus|log|stump", (240, True, 0.22, 0.12)),
    (r"rock|boulder|crystal|stack|dune|arch|geyser|vent|statue|altar|well", (200, True, 0.6, 0.22)),
    (r"bridge|steps|rug|pier", (360, False, 0, 0)),
    (r"fountain|brazier|campfire|fire|lamp|banner|sign|post|rack|chest|crate|barrel|net|shell|bush|fern|mushroom|reed|skull|bone", (130, False, 0.5, 0.2)),
]
DEFAULT = (240, True, 0.6, 0.22)


def category(name):
    for pat, v in CATS:
        if re.search(pat, name):
            return v
    return DEFAULT


def outline(im, px=4):
    rgb = ImageEnhance.Color(ImageEnhance.Contrast(im.convert("RGB")).enhance(1.1)).enhance(1.06)
    a = im.getchannel("A")
    pad = px + 2
    canvas = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    big = Image.new("L", canvas.size, 0)
    big.paste(a, (pad, pad))
    grown = big.filter(ImageFilter.MaxFilter(2 * px + 1)).filter(ImageFilter.GaussianBlur(0.8))
    canvas.paste(Image.new("RGBA", canvas.size, (24, 13, 8, 255)), (0, 0), grown)
    body = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    body.paste(Image.merge("RGBA", (*rgb.split(), a)), (pad, pad))
    canvas.alpha_composite(body)
    return canvas


assets, binds, prov, place = [], {}, [], {}
for d in dirs:
    for src in sorted(d.glob("*.png")):
        name = re.sub(r"^obj-", "", src.stem)
        name = re.sub(r"-s\d+$", "", name)
        key = "%s.%s" % (d.name.replace("kit-", "").split("-k1")[0].split("-g")[0], name) if False else name
        asset_id = "%s-%s" % (pack, re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"))
        if asset_id in {a["id"] for a in assets}:
            continue
        im = outline(Image.open(src).convert("RGBA"))
        f = OUT / (asset_id + ".webp")
        im.save(f, quality=88, method=6)
        assets.append({"id": asset_id, "version": version, "kind": "image", "url": f.name, "width": im.width, "height": im.height})
        slug = asset_id[len(pack) + 1:]
        binds["object.%s.%s" % (pack, slug)] = {"asset": asset_id, "fit": "contain"}
        w, solid, fw, fh = category(name)
        h = round(w * im.height / im.width)
        place["%s.%s" % (pack, slug)] = {"width": w, "height": h, "anchorX": 0.5, "anchorY": 0.92, "solid": solid,
                                         "footprint": {"width": round(w * fw), "height": round(h * fh)} if solid else None}
        prov.append({"part": slug, "source": src.name, "sha256": hashlib.sha256(src.read_bytes()).hexdigest()})
manifest = {"schemaVersion": 1, "id": pack, "version": version, "technical": False, "previewOnly": False, "assets": assets,
            "actors": [], "actorBindings": {}, "renderBindings": binds, "effects": {}}
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
(OUT / "provenance.json").write_text(json.dumps({"pack": pack, "generator": "DreamShaper XL Turbo v2.1, rembg matting, painted outline",
                                                  "licenseStatus": "unresolved (docs/ASSET-LICENSE-REGISTER.md)", "parts": prov}, indent=2) + "\n")
(OUT / "placement.json").write_text(json.dumps(place, indent=1) + "\n")
print("OK", len(assets), "parts in", OUT)
