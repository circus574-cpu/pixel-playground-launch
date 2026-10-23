"""Concept masters in the owner's mockup style (2026-10-23): the Legend hero and the smithy NPC Goro.

  python3 gen_chars_concept.py <tag> [seeds comma list]
    -> /workspace/ki-legends-gpu/renders/chars-concept-<tag>/<char>-<view>-s<seed>.png (1024) + sheet-<char>.jpg + metadata.json
Animagine XL 3.1, white background for matting. Concepts for owner approval, not game assets.
"""
import hashlib, json, shutil, sys, time
from pathlib import Path
import torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline

tag = sys.argv[1] if len(sys.argv) > 1 else "c1"
SEEDS = [int(s) for s in (sys.argv[2] if len(sys.argv) > 2 else "7430101,7430102,7430103,7430104,7430105,7430106").split(",")]
ONLY = sys.argv[3].split(",") if len(sys.argv) > 3 else None
ROOT = Path("/workspace/ki-legends-gpu")
OUT = ROOT / "renders" / ("chars-concept-%s" % tag)
OUT.mkdir(parents=True, exist_ok=True)
LOCAL = Path("/tmp/chars-concept-%s" % tag)
LOCAL.mkdir(parents=True, exist_ok=True)

BASE = ("solo, full body, standing, anime fantasy game character, high angle three quarter view, clean precise linework, thick dark outlines, "
        "beautifully painted materials, cel shaded, warm firelight, isolated on pure white background, plain white background, simple background, "
        "wide white margin on all sides, masterpiece, best quality, very aesthetic")
NEG = ("nsfw, nude, child, girl, woman, worst quality, low quality, blurry, cropped, cut off feet, out of frame, close up, portrait, text, logo, "
       "watermark, multiple people, duplicate, extra limbs, malformed hands, landscape, colored background, gradient background, shadow on ground, "
       "character sheet, multiple views, energy aura, glow, fire, sparks, scenery, forest, trees, ornate frame, decorative border, monster, dragon, "
       "second character, background figure, wings, mandala, pattern background")
CHARS = {
    "hero-legend": ("1boy, young adult man, spiky black hair with a red streak, intense red eyes, long red scarf, black and crimson light armor "
                    "with gold trim, shoulder pauldrons, armored gauntlets, black trousers, crimson laced boots, sword on his back, confident calm stance"),
    "hero-planetary": ("1boy, young adult man, messy spiky chestnut brown hair with a short orange braid, white headband, amber eyes, tanned skin, "
                       "orange scarf, sleeveless white and green wrap tunic, brown leather straps and pouches, bronze armored gauntlets and greaves with cyan crystal gems, "
                       "dark green trousers, brown pointed leather boots, forest warrior, confident calm stance"),
    "hero-android": ("1boy, young adult man, short spiky silver white hair, steel blue eyes, layered silver and black synthetic armor plates, blue gem on chest, "
                     "black bodysuit, long split white and blue coat tails, armored gauntlets, silver armored boots, android warrior, confident calm stance"),
    "hero-sage": ("1boy, masculine adult man, strong jaw, long pale blonde hair tied in a high ponytail with a gold ornament, pointed elf ears, golden amber eyes, "
                  "long layered cream white and emerald green robes with small gold trim, wide sleeves, jeweled emerald belt, ornate black and gold boots, calm stance"),
    "goro-smith": ("1boy, middle aged muscular blacksmith, black hair in a topknot, short black beard, scar on cheek, friendly stern face, "
                   "arms crossed, white shirt with rolled sleeves, brown leather apron, leather straps and pouches, brown trousers, heavy boots, strong build"),
}
VIEWS = {"front": "front view, facing the viewer", "left": "three quarter front view, facing left"}
pipe = StableDiffusionXLPipeline.from_single_file(str(ROOT / "models/checkpoints/animagine-xl-3.1.safetensors"), torch_dtype=torch.float16).to("cuda")
meta = {"tag": tag, "items": []}
t0 = time.time()
for char, look in CHARS.items():
    if ONLY and char not in ONLY:
        continue
    for view, vtxt in VIEWS.items():
        for seed in SEEDS:
            img = pipe(prompt="1boy, " + look + ", " + vtxt + ", " + BASE, negative_prompt=NEG, num_inference_steps=28, guidance_scale=6.0,
                       width=832, height=1216, generator=torch.Generator("cuda").manual_seed(seed)).images[0]
            fn = "%s-%s-s%d.png" % (char, view, seed)
            tmp = LOCAL / fn
            img.save(tmp)
            for _ in range(5):
                shutil.copyfile(tmp, OUT / fn)
                try:
                    Image.open(OUT / fn).load(); break
                except OSError:
                    time.sleep(1)
            meta["items"].append({"file": fn, "char": char, "view": view, "seed": seed, "sha256": hashlib.sha256(tmp.read_bytes()).hexdigest()})
            print(fn, round(time.time() - t0), "s", flush=True)
    w, h = 208, 304
    sh = Image.new("RGB", (len(SEEDS) * w, len(VIEWS) * h), "white")
    for r, view in enumerate(VIEWS):
        for c, seed in enumerate(SEEDS):
            sh.paste(Image.open(LOCAL / ("%s-%s-s%d.png" % (char, view, seed))).resize((w, h), Image.LANCZOS), (c * w, r * h))
    sh.save(OUT / ("sheet-%s.jpg" % char), quality=88)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
