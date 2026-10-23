"""Animation frames drawn by the trained character LoRA, guided by the 3D pose skeleton (no IP-Adapter).

  python3 lora_frames.py <name> <tag> <clips comma list|all> <directions comma list|all> [frames comma list]
    -> /workspace/ki-legends-gpu/renders/<name>-lora-<tag>/<clip>-<direction>-<NN>.png (1024) + sheet-<clip>-<direction>.jpg
Animagine XL 3.1 + ControlNet OpenPose (xinsir) + the character LoRA from /workspace/ki-legends-gpu/lora/<name>.
One fixed seed per direction keeps the costume stable. Samples for owner review, not game assets.
"""
import hashlib, json, shutil, sys, time
from pathlib import Path
import torch
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pose3d
from diffusers import StableDiffusionXLControlNetPipeline, ControlNetModel

name, tag = sys.argv[1], sys.argv[2]
CLIPS = (sys.argv[3] if sys.argv[3] != "all" else ",".join(pose3d.CLIPS)).split(",")
DIRS = (sys.argv[4] if sys.argv[4] != "all" else ",".join(pose3d.DIRS)).split(",")
ONLY = [int(x) for x in sys.argv[5].split(",")] if len(sys.argv) > 5 else None
ROOT = Path("/workspace/ki-legends-gpu"); M = ROOT / "models"
OUT = ROOT / "renders" / ("%s-lora-%s" % (name, tag)); OUT.mkdir(parents=True, exist_ok=True)
LOCAL = Path("/tmp/%s-lora-%s" % (name, tag)); LOCAL.mkdir(parents=True, exist_ok=True)
TRIGGER = {"hero-legend": "ki_legend, 1boy, full body, anime game character", "hero-android": "ki_android, 1boy, full body, anime game character"}[name]
BASE = ("high angle three quarter view, clean precise linework, thick dark outlines, beautifully painted materials, cel shaded, isolated on pure white background, "
        "plain white background, simple background, wide white margin on all sides, masterpiece, best quality, very aesthetic")
NEG = ("nsfw, nude, child, girl, woman, worst quality, low quality, blurry, cropped, cut off feet, out of frame, close up, portrait, text, logo, watermark, multiple people, "
       "duplicate character, extra limbs, missing hands, malformed hands, landscape, glow, aura, lightning, motion blur, speed lines, colored background, gradient background, "
       "shadow on ground, character sheet, multiple views")
STATE = {"idle": "relaxed ready stance, standing", "walk": "walking, mid stride", "attack": "throwing a powerful slash, arm fully extended forward",
         "skill": "releasing energy, both palms thrust forward, hands open", "hit": "recoiling from a hit, leaning back, pained",
         "death": "falling down, collapsing", "respawn": "getting up from the ground, rising"}
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
pipe.load_lora_weights(str(ROOT / "lora" / name), weight_name="pytorch_lora_weights.safetensors")
SEEDS = [int(x) for x in __import__("os").environ.get("SEEDS", "7470101").split(",")]
meta = {"name": name, "frames": []}
t0 = time.time()
for direction in DIRS:
    for clip in CLIPS:
        fr = pose3d.frames(clip, direction)
        tiles, idx = [], []
        for i, kp in enumerate(fr):
            if ONLY is not None and i not in ONLY:
                continue
            for seed in SEEDS:
                fn = "%s-%s-%02d-s%d.png" % (clip, direction, i, seed)
                if (OUT / fn).exists():
                    continue
                img = pipe(prompt=TRIGGER + ", " + VIEW[direction] + ", " + STATE[clip] + ", " + BASE, negative_prompt=NEG, image=skeleton(kp), num_inference_steps=30,
                           guidance_scale=6.0, controlnet_conditioning_scale=1.0, generator=torch.Generator("cuda").manual_seed(seed), width=1024, height=1024).images[0]
                tmp = LOCAL / fn; img.save(tmp)
                for _ in range(5):
                    shutil.copyfile(tmp, OUT / fn)
                    try:
                        Image.open(OUT / fn).load(); break
                    except OSError:
                        time.sleep(1)
                meta["frames"].append({"file": fn, "sha256": hashlib.sha256(tmp.read_bytes()).hexdigest()})
                if seed == SEEDS[0]:
                    tiles.append(img); idx.append(i)
                print(fn, round(time.time() - t0), "s", flush=True)
        if tiles:
            c = 256
            sh = Image.new("RGB", (c * len(tiles), c * 2), "white")
            for k, im in enumerate(tiles):
                sh.paste(im.resize((c, c), Image.LANCZOS), (k * c, 0))
                sh.paste(skeleton(fr[idx[k]]).resize((c, c), Image.LANCZOS), (k * c, c))
            sh.save(OUT / ("sheet-%s-%s.jpg" % (clip, direction)), quality=88)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
