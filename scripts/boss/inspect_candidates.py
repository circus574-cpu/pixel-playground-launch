import os
from PIL import Image

raw_dir = r"art\production\bosses\raw"
for idx in [2, 5]:
    fn = f"OpenAI Playground 2026-11-01 at 20.04.40 ({idx}).png"
    p = os.path.join(raw_dir, fn)
    im = Image.open(p)
    # Thumbnail 512x768
    thumb = im.resize((512, 768), Image.Resampling.LANCZOS)
    thumb.save(rf"art\production\bosses\inspect_{idx}.png")
    print(f"Saved inspect_{idx}.png size {im.size}")
