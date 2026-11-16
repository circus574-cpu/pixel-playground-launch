#!/usr/bin/env python3
"""Owner's KI LEGENDS key art (supplied 15.11.2026) -> intro screen image and boot splash.

The original stays in the repository as `assets/branding/intro-source.png` (excluded from the APK by the export filter).
The game runs in landscape, so the intro and the boot splash use a landscape crop of the same art that fills the whole
screen; the boot splash carries the unchanged official Godot logo ("Powered by GODOT ENGINE").
"""
import hashlib, json, pathlib, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "ports/godot-pyra/assets/branding"
import numpy as np
from PIL import ImageFilter

src = Image.open(OUT / "intro-source.png").convert("RGB")

# Landscape composition of the owner's art (the game is landscape-only): the portrait illustration is scaled to the screen
# width and cropped to the band with the four characters; the original "KI LEGENDS" title is lifted from the same art and
# feathered into the top of the band. Nothing is painted over or redrawn; the bottom is darkened for the buttons.
WW, WH = 2560, 1152
scale = WW / src.width
y0 = 372
wide = src.crop((0, y0, src.width, y0 + int(WH / scale) + 1)).resize((WW, WH), Image.LANCZOS)
title = src.crop((150, 40, 990, 310))
tw = 1180
th = int(title.height * tw / title.width)
title = title.resize((tw, th), Image.LANCZOS)
yy, xx = np.mgrid[0:th, 0:tw]
r = np.sqrt(((xx - tw / 2) / (tw * 0.5)) ** 2 + ((yy - th / 2) / (th * 0.5)) ** 2)
mask = Image.fromarray((np.clip((1.0 - r) / 0.38, 0, 1) ** 1.2 * 255).astype("uint8"))
wide.paste(title, ((WW - tw) // 2, -24), mask)
arr = np.array(wide).astype(float)
g = np.linspace(0, 1, WH)[:, None, None]
arr *= 1 - 0.55 * np.clip((g - 0.62) / 0.38, 0, 1) ** 1.5
wide = Image.fromarray(arr.astype("uint8"))
wide.save(OUT / "intro-wide.webp", quality=90, method=6)

W, H = 1280, 720
splash = wide.resize((round(WW * H / WH), H), Image.LANCZOS).crop(((round(WW * H / WH) - W) // 2, 0, (round(WW * H / WH) - W) // 2 + W, H)).convert("RGBA")
shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(shade)
for y in range(H - 150, H):
    d.line([(0, y), (W, y)], fill=(5, 9, 14, int(200 * (y - (H - 150)) / 150)))
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
    "outputs": {"intro-wide.webp": sha(OUT / "intro-wide.webp"), "boot-splash.png": sha(OUT / "boot-splash.png")}, "note": "Artwork re-encoded only; rights remain with the project owner per docs/LICENCJE.md."}, indent=2) + "\n")
print("intro + boot splash written")
