"""Texture refiner ("poprawiacz"): img2img over the game's existing ground textures.

  python3 refine_textures.py <tag> [strength] [name filter]
    in : /workspace/ki-legends-gpu/refine-in/<name>.jpg   (the textures currently used in the game)
    out: /workspace/ki-legends-gpu/renders/refine-<tag>/<name>.png (1024, seamless) + before-after sheet

Keeps the layout and material of each input (low strength), repaints it as hand-painted cel-shaded art
in a warm, low-contrast, limited palette so the ground stays a calm backdrop for characters.
DreamShaper XL Turbo, circular padding (tileable). Samples for owner review, not installed in the game.
"""
import json, shutil, sys, time
from pathlib import Path
import torch
from PIL import Image
from diffusers import StableDiffusionXLImg2ImgPipeline

tag = sys.argv[1] if len(sys.argv) > 1 else "r1"
STRENGTH = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
ONLY = sys.argv[3] if len(sys.argv) > 3 else ""
ROOT = Path("/workspace/ki-legends-gpu")
SRC = ROOT / "refine-in"
OUT = ROOT / "renders" / ("refine-%s" % tag)
OUT.mkdir(parents=True, exist_ok=True)
LOCAL = Path("/tmp/refine-%s" % tag)
LOCAL.mkdir(parents=True, exist_ok=True)

STYLE = ("seamless tileable ground texture, flat top-down view, hand painted cel shaded anime game environment art, soft painted brush strokes, "
         "simple clean shapes, drawn outlines, warm muted limited color palette, low contrast, low saturation, gentle even lighting, "
         "calm background surface, no perspective, no objects, no text")
NEG = ("photorealistic, photo, 3d render, high contrast, harsh black cracks, deep shadows, strong highlights, glossy, noisy, gritty, "
       "sci-fi circuits, neon, text, logo, watermark, border, frame, vignette, perspective, objects, characters")
MATERIAL = {"ground": "ground", "path": "worn path stones", "plaza": "decorative plaza paving", "wall": "rock wall surface"}
WORLD = {"aether": "pale warm cream stone with soft sage green moss, gentle white and gold tones",
         "nexus": "warm grey blue steel plates with soft teal accents, muted metallic paint",
         "pyra": "warm terracotta and ash brown stone with faint ember orange accents"}


def describe(name):
    for w, d in WORLD.items():
        if name.startswith(w):
            kind = next((v for k, v in MATERIAL.items() if name.endswith(k) or ("-" + k) in name), "ground")
            return "%s, %s" % (kind, d)
    return name.replace("nature-tex-", "").replace("-", " ") + ", warm muted painted tones"


pipe = StableDiffusionXLImg2ImgPipeline.from_single_file(
    str(ROOT / "models/checkpoints/DreamShaperXL_Turbo_v2_1.safetensors"), torch_dtype=torch.float16).to("cuda")
for m in list(pipe.unet.modules()) + list(pipe.vae.modules()):
    if isinstance(m, torch.nn.Conv2d):
        m.padding_mode = "circular"

meta = {"tag": tag, "strength": STRENGTH, "items": []}
t0 = time.time()
files = sorted(p for p in SRC.glob("*.jpg") if ONLY in p.name)
rows = []
for p in files:
    src = Image.open(p).convert("RGB").resize((1024, 1024), Image.LANCZOS)
    desc = describe(p.stem)
    img = pipe(prompt=desc + ", " + STYLE, negative_prompt=NEG, image=src, strength=STRENGTH, num_inference_steps=12,
               guidance_scale=2.5, generator=torch.Generator("cuda").manual_seed(7310201)).images[0]
    name = p.stem + ".png"
    tmp = LOCAL / name
    img.save(tmp)
    for _ in range(5):
        shutil.copyfile(tmp, OUT / name)
        try:
            Image.open(OUT / name).load(); break
        except OSError:
            time.sleep(1)
    meta["items"].append({"file": name, "prompt": desc})
    rows.append((src, img))
    print(p.name, round(time.time() - t0), "s", flush=True)
c = 256
sh = Image.new("RGB", (c * 2 * 3, c * ((len(rows) + 2) // 3)), "white")
for i, (a, b) in enumerate(rows):
    x, y = (i % 3) * c * 2, (i // 3) * c
    sh.paste(a.resize((c, c), Image.LANCZOS), (x, y)); sh.paste(b.resize((c, c), Image.LANCZOS), (x + c, y))
sh.save(OUT / "sheet-before-after.jpg", quality=88)
shutil.copyfile(OUT / "sheet-before-after.jpg", LOCAL / "sheet-before-after.jpg")
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
