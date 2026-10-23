"""Eight direction masters of an approved character concept (pose-guided, appearance from the concept).

  python3 hero_masters.py <name> <concept png on the volume> [seeds comma list] [clip]
    -> /workspace/ki-legends-gpu/renders/<name>-masters/<direction>-s<seed>.png (1024) + sheet.jpg + metadata.json
OpenPose skeleton of the standing pose (pose3d.py) per direction -> ControlNet (xinsir OpenPose SDXL) + IP-Adapter
(the concept is the appearance reference) + Animagine XL 3.1. These masters become the training/reference set
for the animation pass. Samples for owner review, not game assets.
"""
import hashlib, json, shutil, sys, time
from pathlib import Path
import torch
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pose3d
from diffusers import StableDiffusionXLControlNetPipeline, ControlNetModel

name, concept = sys.argv[1], sys.argv[2]
SEEDS = [int(s) for s in (sys.argv[3] if len(sys.argv) > 3 else "7440101,7440102,7440103").split(",")]
CLIP = sys.argv[4] if len(sys.argv) > 4 else "idle"
ROOT = Path("/workspace/ki-legends-gpu"); M = ROOT / "models"
OUT = ROOT / "renders" / (name + "-masters"); OUT.mkdir(parents=True, exist_ok=True)
LOCAL = Path("/tmp/%s-masters" % name); LOCAL.mkdir(parents=True, exist_ok=True)
LOOK = {"hero-legend": "short spiky black hair with a red streak, intense red eyes, long red scarf, black and crimson light armor with gold trim, "
                       "shoulder pauldrons, armored gauntlets, black trousers, crimson laced boots, sword on his back, "}[name]
BASE = ("1boy, solo, adult male, full body, anime fantasy game protagonist, high angle three quarter view, clean precise linework, thick dark outlines, "
        "beautifully painted materials, cel shaded, isolated on pure white background, plain white background, simple background, wide white margin on all sides, "
        "masterpiece, best quality, very aesthetic")
NEG = ("nsfw, nude, child, girl, woman, worst quality, low quality, blurry, cropped, cut off feet, out of frame, close up, portrait, text, logo, watermark, "
       "multiple people, duplicate character, extra limbs, missing hands, malformed hands, landscape, ground texture, glow, aura, lightning, motion blur, "
       "colored background, gradient background, shadow on ground, character sheet, multiple views")
VIEW = {"down": "front view, facing the viewer", "down-left": "three quarter front view, facing left", "left": "side view, profile, facing left",
        "up-left": "three quarter back view, facing away to the left", "up": "back view, seen from behind, facing away from the viewer",
        "up-right": "three quarter back view, facing away to the right", "right": "side view, profile, facing right",
        "down-right": "three quarter front view, facing right"}
LIMBS = [[1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7], [1, 8], [8, 9], [9, 10], [1, 11], [11, 12], [12, 13], [1, 0], [0, 14], [14, 16], [0, 15], [15, 17]]
COL = [[255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0], [170, 255, 0], [85, 255, 0], [0, 255, 0], [0, 255, 85], [0, 255, 170], [0, 255, 255],
       [0, 170, 255], [0, 85, 255], [0, 0, 255], [85, 0, 255], [170, 0, 255], [255, 0, 255], [255, 0, 170]]


def skeleton(points, size=1024):
    img = Image.new("RGB", (size, size), (0, 0, 0)); d = ImageDraw.Draw(img)
    xy = [(points[k][0] * size, points[k][1] * size) for k in pose3d.ORDER]
    for (a, b), c in zip(LIMBS, COL):
        d.line([xy[a], xy[b]], fill=tuple(int(v * .6) for v in c), width=14)
    for p, c in zip(xy, COL + [[255, 0, 85]]):
        d.ellipse([p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8], fill=tuple(c))
    return img


cn = ControlNetModel.from_pretrained(str(M / "controlnet/xinsir-openpose-sdxl"), torch_dtype=torch.float16)
pipe = StableDiffusionXLControlNetPipeline.from_single_file(str(M / "checkpoints/animagine-xl-3.1.safetensors"), controlnet=cn, torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter(str(M / "ip-adapter"), subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors", image_encoder_folder="sdxl_models/image_encoder")
pipe.set_ip_adapter_scale(0.85)
ref = Image.open(concept).convert("RGB")
meta = {"name": name, "concept": concept, "items": []}
t0 = time.time()
for direction in pose3d.DIRS:
    sk = skeleton(pose3d.frames(CLIP, direction)[0])
    for seed in SEEDS:
        img = pipe(prompt=LOOK + VIEW[direction] + ", standing, relaxed ready stance, " + BASE, negative_prompt=NEG, image=sk, ip_adapter_image=ref,
                   num_inference_steps=30, guidance_scale=6.0, controlnet_conditioning_scale=1.0, generator=torch.Generator("cuda").manual_seed(seed),
                   width=1024, height=1024).images[0]
        fn = "%s-s%d.png" % (direction, seed)
        tmp = LOCAL / fn; img.save(tmp)
        for _ in range(5):
            shutil.copyfile(tmp, OUT / fn)
            try:
                Image.open(OUT / fn).load(); break
            except OSError:
                time.sleep(1)
        meta["items"].append({"file": fn, "direction": direction, "seed": seed, "sha256": hashlib.sha256(tmp.read_bytes()).hexdigest()})
        print(fn, round(time.time() - t0), "s", flush=True)
c = 256
sh = Image.new("RGB", (len(SEEDS) * c, len(pose3d.DIRS) * c), "white")
for r, d in enumerate(pose3d.DIRS):
    for k, sd in enumerate(SEEDS):
        sh.paste(Image.open(LOCAL / ("%s-s%d.png" % (d, sd))).resize((c, c), Image.LANCZOS), (k * c, r * c))
sh.save(OUT / "sheet.jpg", quality=88)
shutil.copyfile(OUT / "sheet.jpg", LOCAL / "sheet.jpg")
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
