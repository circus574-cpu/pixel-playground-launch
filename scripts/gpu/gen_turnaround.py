"""Character turnaround sheets: one image shows front, side and back of the same character (consistent outfit by construction).

  python3 gen_turnaround.py <name> <concept png> [seeds comma list]
    -> /workspace/ki-legends-gpu/renders/<name>-turnaround/s<seed>.png (1536x1024) + sheet.jpg
Animagine XL 3.1 + IP-Adapter (the approved concept). The views are cropped later and used as the training set
for a character LoRA. Samples for owner review, not game assets.
"""
import shutil, sys, time
from pathlib import Path
import torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline

name, concept = sys.argv[1], sys.argv[2]
SEEDS = [int(s) for s in (sys.argv[3] if len(sys.argv) > 3 else "7450101,7450102,7450103,7450104,7450105,7450106,7450107,7450108").split(",")]
ROOT = Path("/workspace/ki-legends-gpu"); M = ROOT / "models"
OUT = ROOT / "renders" / (name + "-turnaround"); OUT.mkdir(parents=True, exist_ok=True)
LOCAL = Path("/tmp/%s-turnaround" % name); LOCAL.mkdir(parents=True, exist_ok=True)
LOOK = {"hero-legend": "1boy, young adult man, spiky black hair with a red streak, red eyes, long red scarf, black and crimson light armor with gold trim, "
                       "shoulder pauldrons, armored gauntlets, black trousers, crimson laced boots, sword on his back",
        "hero-android": "1boy, young adult man, short spiky silver white hair, steel blue eyes, layered silver and black armor plates, blue gem on chest, "
                        "black bodysuit, long split white and blue coat tails, armored gauntlets, silver armored boots"}[name]
P = (LOOK + ", character turnaround sheet, model sheet, reference sheet, same character shown four times: front view, three quarter view, side view, "
     "back view, standing in a row, full body, high angle, anime game character design, clean linework, thick dark outlines, cel shaded, "
     "plain white background, simple background, masterpiece, best quality")
NEG = ("nsfw, worst quality, low quality, blurry, cropped, text, logo, watermark, different outfits, different characters, colored background, "
       "gradient background, glow, aura, fire, sparks, extra limbs, malformed hands")
pipe = StableDiffusionXLPipeline.from_single_file(str(M / "checkpoints/animagine-xl-3.1.safetensors"), torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter(str(M / "ip-adapter"), subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors", image_encoder_folder="sdxl_models/image_encoder")
pipe.set_ip_adapter_scale(0.7)
ref = Image.open(concept).convert("RGB")
t0 = time.time(); tiles = []
for seed in SEEDS:
    img = pipe(prompt=P, negative_prompt=NEG, ip_adapter_image=ref, num_inference_steps=30, guidance_scale=6.0, width=1536, height=1024,
               generator=torch.Generator("cuda").manual_seed(seed)).images[0]
    fn = "s%d.png" % seed
    img.save(LOCAL / fn)
    for _ in range(5):
        shutil.copyfile(LOCAL / fn, OUT / fn)
        try:
            Image.open(OUT / fn).load(); break
        except OSError:
            time.sleep(1)
    tiles.append(img); print(fn, round(time.time() - t0), "s", flush=True)
w, h = 768, 512
sh = Image.new("RGB", (2 * w, ((len(tiles) + 1) // 2) * h), "white")
for i, im in enumerate(tiles):
    sh.paste(im.resize((w, h), Image.LANCZOS), ((i % 2) * w, (i // 2) * h))
sh.save(OUT / "sheet.jpg", quality=88)
shutil.copyfile(OUT / "sheet.jpg", LOCAL / "sheet.jpg")
print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
