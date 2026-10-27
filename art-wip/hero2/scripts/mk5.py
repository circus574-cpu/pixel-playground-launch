import sys
from PIL import Image
r, pre, out = sys.argv[1], sys.argv[2], sys.argv[3]
vs = ["front", "fside", "side", "bside", "back"]
o = Image.new("RGB", (1536 * 3, 1024 * 5), (255, 0, 255))
for j, v in enumerate(vs):
    for i in range(3):
        try: o.paste(Image.open(f"/workspace/hero2/{r}/grid/{pre}{v}w-{i}.png"), (i * 1536, j * 1024))
        except Exception: pass
o.resize((1536, 1707)).save(out, quality=85)
