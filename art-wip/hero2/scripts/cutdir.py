import sys
from rembg import remove, new_session
from PIL import Image
s = new_session("birefnet-general")
for spec in sys.argv[1:]:
    race, view, c = spec.split(":")
    im = Image.open(f"/workspace/hero2/{race}/{view}/{c}.png").convert("RGB")
    cut = remove(im, session=s)
    cut.save(f"/workspace/hero2/{race}/{view}/final.png")
    print("CUT", race, view, cut.getbbox(), flush=True)
