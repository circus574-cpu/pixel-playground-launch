#!/usr/bin/env python3
"""Adapt the existing KI mark to native icons and a boot splash; no world edits."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "ports/godot-pyra/assets/branding"
OUT.mkdir(parents=True, exist_ok=True)
font_source = ROOT / "public/game/fonts/cinzel-latin-700-normal.woff2"
font = TTFont(font_source)
font.flavor = None
font.save(OUT / "cinzel-bold.ttf")
shutil.copyfile(ROOT / "public/game/fonts/OFL-Cinzel.txt", OUT / "OFL-Cinzel.txt")

svg = (ROOT / "public/ki-favicon.svg").read_text()
# The monogram and ring are unchanged; the launcher owns the background/mask.
mark = svg[svg.index("<circle"):svg.index("</svg>")]
variants = {
    "icon": svg,
    "icon-foreground": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g transform="translate(192 192) scale(5)">' + mark + '</g></svg>',
    "icon-background": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#0d1520"/></svg>',
    "icon-monochrome": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g transform="translate(192 192) scale(5)">' + mark.replace('#49c9c5', '#ffffff').replace('#f5c542', '#ffffff') + '</g></svg>',
}
for name, source in variants.items():
    with tempfile.NamedTemporaryFile(suffix=".svg") as temp:
        temp.write(source.encode())
        temp.flush()
        subprocess.run(["node", "--input-type=module", "-e", "import sharp from 'sharp'; await sharp(process.argv[1],{density:768}).resize(1024,1024).png().toFile(process.argv[2]);", temp.name, str(OUT / (name + ".png"))], cwd=ROOT, check=True)

canvas = Image.new("RGB", (1280, 720), "#0d1520")
crest = Image.open(OUT / "icon.png").convert("RGBA").resize((150,150),Image.Resampling.LANCZOS)
canvas.paste(crest,(565,125),crest)
draw = ImageDraw.Draw(canvas)
for text, y, size, color in [("KI LEGENDS",325,82,"#e5c98c"),("Powered by",505,23,"#a6b9b4"),("GODOT ENGINE",545,31,"#e9eee9")]:
    draw.text((640,y),text,font=ImageFont.truetype(str(OUT / "cinzel-bold.ttf"),size),fill=color,anchor="mt")
draw.line((420,451,860,451),fill="#665539",width=1)
canvas.save(OUT / "boot-splash.png")

inputs = ["public/ki-favicon.svg", "public/game/fonts/cinzel-latin-700-normal.woff2", "public/game/fonts/OFL-Cinzel.txt"]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
outputs = {str(p.relative_to(ROOT)):sha(p) for p in sorted(OUT.iterdir()) if p.suffix in {".png", ".ttf", ".txt"}}
(OUT / "provenance.json").write_text(json.dumps({"method":"Existing KI favicon adapted for Android masks; Cinzel WOFF2 converted to TTF without glyph changes; boot splash composed from same mark and live title text.","sourceFiles":{p:sha(ROOT/p) for p in inputs},"outputFiles":outputs,"fontLicense":"SIL Open Font License 1.1; full text in OFL-Cinzel.txt"},indent=2)+"\n")
print(json.dumps({"brandingFiles":len(outputs),"sourceFiles":len(inputs)}))
