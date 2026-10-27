import sys
from PIL import Image
m = sys.argv[1]
for r in ["legend", "planetary", "sage", "android"]:
    o = Image.new("RGBA", (1024, 640), (92, 120, 70, 255))
    for j, v in enumerate(["front", "fside", "side", "bside", "back"]):
        try: o.alpha_composite(Image.open(f"/workspace/hero2/{r}/game/{m}-{v}/sheet.png").convert("RGBA"), (0, j * 128))
        except Exception as e: print("MISSING", r, v)
    o.convert("RGB").save(f"/tmp/as-{m}-{r}.png")
print("AS_OK")
