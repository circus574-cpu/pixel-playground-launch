#!/usr/bin/env python3
"""Owner's KI LEGENDS key art (supplied 15.11.2026) -> intro screen image and boot splash.

The illustration is used unchanged (only re-encoded); the original stays in the repository as
`assets/branding/intro-source.png` (excluded from the APK by the export filter). The boot splash shows the art fitted by
height with the unchanged official Godot logo under it ("Powered by GODOT ENGINE").
"""
import hashlib, json, pathlib, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "ports/godot-pyra/assets/branding"
src = Image.open(OUT / "intro-source.png").convert("RGB")
src.save(OUT / "intro.webp", quality=92, method=6)

W, H = 1280, 720
splash = Image.new("RGBA", (W, H), (13, 21, 32, 255))
art_h = H
art_w = round(src.width * art_h / src.height)
splash.paste(src.resize((art_w, art_h), Image.LANCZOS), ((W - art_w) // 2, 0))
shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(shade)
for y in range(H - 150, H):
    d.line([(0, y), (W, y)], fill=(5, 9, 14, int(235 * (y - (H - 150)) / 150)))
splash.alpha_composite(shade)
logo = OUT / "godot/logo-large-color-dark.svg"
with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
    subprocess.run(["node", "--input-type=module", "-e", "import sharp from 'sharp'; await sharp(process.argv[1],{density:384}).resize(300,121,{fit:'contain'}).png().toFile(process.argv[2]);", str(logo), tmp.name], cwd=ROOT, check=True)
    mark = Image.open(tmp.name).convert("RGBA")
splash.alpha_composite(mark, ((W - mark.width) // 2, H - mark.height - 14))
font = ImageFont.truetype(str(OUT / "cinzel-bold.ttf"), 20)
label = "POWERED BY"
splash_draw = ImageDraw.Draw(splash)
tw = splash_draw.textlength(label, font=font)
splash_draw.text(((W - tw) / 2, H - mark.height - 44), label, font=font, fill=(214, 224, 220, 255))
splash.save(OUT / "boot-splash.png", optimize=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
(OUT / "intro-provenance.json").write_text(json.dumps({"source": "owner illustration supplied in chat on 15.11.2026 (1121x1403 PNG)", "sourceSha256": sha(OUT / "intro-source.png"),
    "outputs": {"intro.webp": sha(OUT / "intro.webp"), "boot-splash.png": sha(OUT / "boot-splash.png")}, "note": "Artwork re-encoded only; rights remain with the project owner per docs/LICENCJE.md."}, indent=2) + "\n")
print("intro + boot splash written")
