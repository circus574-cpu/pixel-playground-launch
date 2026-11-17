#!/usr/bin/env python3
"""Adapt the existing KI mark to native icons and a boot splash; no world edits."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "ports/godot-pyra/assets/branding"
OUT.mkdir(parents=True, exist_ok=True)
font_source = ROOT / "art/source-fonts/cinzel-variable.ttf"
font = TTFont(font_source, recalcTimestamp=False)
font = instantiateVariableFont(font, {"wght": 700}, inplace=False)
font.recalcTimestamp = False
assert all(ord(c) in font.getBestCmap() for c in "ĄĆĘŁŃÓŚŹŻąćęłńóśźż")
font.save(OUT / "cinzel-bold.ttf")
shutil.copyfile(ROOT / "art/source-fonts/OFL-Cinzel.txt", OUT / "OFL-Cinzel.txt")

def write_provenance():
    official_logo = OUT / "godot/logo-large-color-dark.svg"
    inputs = ["public/ki-favicon.svg", str(font_source.relative_to(ROOT)), "art/source-fonts/OFL-Cinzel.txt", str(official_logo.relative_to(ROOT))]
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    outputs = {str(p.relative_to(ROOT)):sha(p) for p in sorted(OUT.iterdir()) if p.suffix in {".png", ".ttf", ".txt"}}
    (OUT / "provenance.json").write_text(json.dumps({"method":"Existing KI favicon adapted for Android masks; complete Cinzel variable font instantiated at weight 700, including Polish glyphs; boot splash uses proportionally scaled original Godot press-kit logo, with no retyped or redrawn lettering.","sourceFiles":{p:sha(ROOT/p) for p in inputs},"outputFiles":outputs,"fontLicense":"SIL Open Font License 1.1; full text in OFL-Cinzel.txt","logoLicense":"CC BY 4.0; attribution and source in GODOT-LOGO-NOTICE.txt and godot/provenance.json"},indent=2)+"\n")
    print(json.dumps({"brandingFiles":len(outputs),"sourceFiles":len(inputs)}))

if "--font-only" in sys.argv:
    write_provenance()
    sys.exit(0)

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

official_logo = OUT / "godot/logo-large-color-dark.svg"
subprocess.run(["node", "--input-type=module", "-e", "import sharp from 'sharp'; const logo=await sharp(process.argv[1]).resize(512,207,{fit:'contain'}).png().toBuffer(); await sharp({create:{width:1280,height:720,channels:4,background:'#0d1520'}}).composite([{input:logo,left:384,top:256}]).png().toFile(process.argv[2]);", str(official_logo), str(OUT / "boot-splash.png")], cwd=ROOT, check=True)

write_provenance()
