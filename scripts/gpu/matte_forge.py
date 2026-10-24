"""Matte the chosen smithy parts (rembg), trim to the object and downsize for the game.

  python3 matte_forge.py <tag>   -> /workspace/ki-legends-gpu/renders/forge-parts-<tag>/matted/<name>.png (alpha, long side <= 512)
Textures are only resized to 512 (seamless, no matting).
"""
import shutil, sys
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

tag = sys.argv[1] if len(sys.argv) > 1 else "f1"
SRC = Path("/workspace/ki-legends-gpu/renders/forge-parts-%s" % tag)
OUT = SRC / "matted"
OUT.mkdir(exist_ok=True)
LOCAL = Path("/tmp/forge-matted-%s" % tag)
LOCAL.mkdir(exist_ok=True)
S1, S2, S3 = 7410101, 7410102, 7410103
OBJ = {"anvil-stump": S1, "furnace-fire": S2, "chest-iron": S1, "workbench-tools": S1, "weapon-rack": S1, "shelf-ingots": S1,
       "barrels": S1, "crates-stack": S1, "lantern-post": S1, "banner-flame": S1, "grindstone": S1, "coal-bin": S1,
       "stairs-wood": S1, "door-arch": S1, "sign-hanging": S1}
TEX = {"floor-flagstone": S1, "wall-dark-wood": S3}
sess = new_session("isnet-general-use") if False else new_session()


def save(img, name):
    tmp = LOCAL / name
    img.save(tmp)
    for _ in range(5):
        shutil.copyfile(tmp, OUT / name)
        try:
            Image.open(OUT / name).load()
            return
        except OSError:
            pass


for n, s in OBJ.items():
    im = Image.open(SRC / ("obj-%s-s%d.png" % (n, s))).convert("RGB")
    cut = remove(im, session=sess)
    box = cut.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    cut = cut.crop(box)
    k = 512 / max(cut.size)
    cut = cut.resize((max(1, round(cut.width * k)), max(1, round(cut.height * k))), Image.LANCZOS)
    save(cut, n + ".png")
    print(n, cut.size, flush=True)
for n, s in TEX.items():
    im = Image.open(SRC / ("tex-%s-s%d.png" % (n, s))).convert("RGB").resize((512, 512), Image.LANCZOS)
    save(im, "tex-" + n + ".png")
    print("tex", n, flush=True)
print("GOTOWE", flush=True)
