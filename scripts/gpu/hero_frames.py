"""Per-frame hero redraw from a procedural 3D pose (replaces 2D mesh deformation of one picture).

  python3 hero_frames.py <race> <tag> [clips comma list] [directions comma list] [mode i2i|t2i] [frames comma list]

For each clip/direction/frame: OpenPose skeleton from pose3d.py -> ControlNet (xinsir OpenPose SDXL) + IP-Adapter
(the accepted painted view of that direction is the appearance reference) + Animagine XL 3.1. Mode `i2i` starts
from that painted view (strength grows with the pose change), `t2i` starts from noise. The seed is fixed per
direction so the costume stays stable across frames.
Output: /workspace/ki-legends-gpu/renders/<race>-frames-<tag>/<clip>-<direction>-<NN>.png (1024, white background)
+ sheet-<clip>-<direction>.jpg + metadata.json. Samples for review; matting/packing is a later step.
"""
import hashlib, json, shutil, sys, time
from pathlib import Path
import numpy as np, torch
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pose3d
from diffusers import StableDiffusionXLControlNetPipeline, StableDiffusionXLControlNetImg2ImgPipeline, ControlNetModel

race, tag = sys.argv[1], sys.argv[2]
CLIPS = (sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != "all" else ",".join(pose3d.CLIPS)).split(",")
DIRS = (sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "all" else ",".join(pose3d.DIRS)).split(",")
MODE = sys.argv[5] if len(sys.argv) > 5 else "i2i"
ONLY = [int(x) for x in sys.argv[6].split(",")] if len(sys.argv) > 6 else None
ROOT = Path("/workspace/ki-legends-gpu"); M = ROOT / "models"
OUT = ROOT / "renders" / ("%s-frames-%s" % (race, tag)); OUT.mkdir(parents=True, exist_ok=True)
LOCAL = Path("/tmp/%s-frames-%s" % (race, tag)); LOCAL.mkdir(parents=True, exist_ok=True)
SRC = {"planetary": ("planetary-painted-v1", "s5741103"), "android": ("android-painted-v3", "s5741102"),
       "legend": ("legend-painted-v1", "s5741102"), "sage": ("sage-painted-v1", "s5741102")}[race]
SEED = {"planetary": 5741103, "android": 5741102, "legend": 5741102, "sage": 5741102}[race]

LOOK = {"android": "short spiky silver white hair, steel blue eyes, android warrior, layered silver and black synthetic armor plates, blue gem on chest, black bodysuit, long split white and blue coat tails, armored gauntlets, silver armored boots, ",
        "planetary": "messy spiky chestnut brown hair with a short orange braid, white headband, amber eyes, tanned skin, muscular forest warrior, orange scarf, sleeveless white and green wrap tunic, brown leather straps belts and pouches, bronze brown armored gauntlets and greaves with cyan crystal gems, dark green trousers, brown pointed leather boots, ",
        "legend": "wild spiky crimson red and black hair, intense amber eyes, muscular warrior, black and crimson armor with steel spikes on shoulders and gauntlets, open black vest, flowing red sashes, black trousers, spiked steel armored boots, ",
        "sage": "masculine adult man, strong jaw, long pale blonde hair tied in a high ponytail with a gold ornament, pointed elf ears, golden amber eyes, male elf sage, long layered cream white and emerald green robes with gold embroidery, wide sleeves, jeweled emerald belt, ornate black and gold boots, "}[race]
BASE = ("1boy, solo, adult male, full body, anime fantasy game protagonist, high angle three quarter view, clean precise linework, beautifully painted materials, "
        "isolated on pure white background, plain white background, simple background, wide white margin on all sides, masterpiece, best quality, very aesthetic")
NEG = ("nsfw, nude, child, girl, woman, worst quality, low quality, blurry, cropped, cut off feet, out of frame, close up, portrait, text, logo, watermark, multiple people, "
       "duplicate character, extra limbs, missing hands, malformed hands, landscape, ground texture, blue energy, glow, aura, lightning, motion blur, speed lines, "
       "colored background, gradient background, shadow on ground, character sheet, multiple views")
STATE = {"idle": "relaxed ready stance, standing", "walk": "walking, mid stride", "attack": "throwing a powerful straight punch, arm fully extended forward",
         "skill": "releasing energy, both palms thrust forward, hands open", "hit": "recoiling from a hit, leaning back, pained",
         "death": "falling down, collapsing", "respawn": "getting up from the ground, rising"}
VIEW = {"down": "front view, facing the viewer", "down-left": "three quarter front view, facing left", "left": "side view, profile, facing left",
        "up-left": "three quarter back view, facing away to the left", "up": "back view, seen from behind, facing away from the viewer",
        "up-right": "three quarter back view, facing away to the right", "right": "side view, profile, facing right",
        "down-right": "three quarter front view, facing right"}
LIMBS = [[1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7], [1, 8], [8, 9], [9, 10], [1, 11], [11, 12], [12, 13], [1, 0], [0, 14], [14, 16], [0, 15], [15, 17]]
COL = [[255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0], [170, 255, 0], [85, 255, 0], [0, 255, 0], [0, 255, 85], [0, 255, 170], [0, 255, 255], [0, 170, 255], [0, 85, 255], [0, 0, 255], [85, 0, 255], [170, 0, 255], [255, 0, 255], [255, 0, 170]]


def skeleton(points, size=1024):
    img = Image.new("RGB", (size, size), (0, 0, 0)); d = ImageDraw.Draw(img)
    xy = [(points[k][0] * size, points[k][1] * size) for k in pose3d.ORDER]
    for (a, b), c in zip(LIMBS, COL):
        d.line([xy[a], xy[b]], fill=tuple(int(v * .6) for v in c), width=14)
    for p, c in zip(xy, COL + [[255, 0, 85]]):
        d.ellipse([p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8], fill=tuple(c))
    return img


def diff(kp, rest):
    return float(np.mean([np.hypot(kp[k][0] - rest[k][0], kp[k][1] - rest[k][1]) for k in pose3d.ORDER]))


cn = ControlNetModel.from_pretrained(str(M / "controlnet/xinsir-openpose-sdxl"), torch_dtype=torch.float16)
ckpt = str(M / "checkpoints/animagine-xl-3.1.safetensors")
if MODE == "i2i":
    pipe = StableDiffusionXLControlNetImg2ImgPipeline.from_single_file(ckpt, controlnet=cn, torch_dtype=torch.float16).to("cuda")
else:
    pipe = StableDiffusionXLControlNetPipeline.from_single_file(ckpt, controlnet=cn, torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter(str(M / "ip-adapter"), subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors", image_encoder_folder="sdxl_models/image_encoder")
pipe.set_ip_adapter_scale(0.75)
meta = {"race": race, "mode": MODE, "seed": SEED, "frames": []}
t0 = time.time()
for direction in DIRS:
    ref = Image.open(ROOT / "renders" / SRC[0] / ("%s-%s-%s.png" % (race, direction, SRC[1]))).convert("RGB")
    rest = pose3d.frames("idle", direction)[0]
    for clip in CLIPS:
        fr = pose3d.frames(clip, direction)
        tiles, idx = [], []
        for i, kp in enumerate(fr):
            if ONLY is not None and i not in ONLY:
                continue
            fn = "%s-%s-%02d.png" % (clip, direction, i)
            sk = skeleton(kp)
            gen = torch.Generator("cuda").manual_seed(SEED)
            args = dict(prompt=LOOK + VIEW[direction] + ", " + STATE[clip] + ", " + BASE, negative_prompt=NEG, ip_adapter_image=ref,
                        num_inference_steps=30, guidance_scale=6.0, generator=gen, controlnet_conditioning_scale=1.0)
            if MODE == "i2i":
                strength = float(np.clip(0.55 + 7.0 * diff(kp, rest), 0.55, 0.92))
                img = pipe(image=ref, control_image=sk, strength=strength, **args).images[0]
            else:
                strength = 1.0
                img = pipe(image=sk, width=1024, height=1024, **args).images[0]
            tmp = LOCAL / fn; img.save(tmp); shutil.copyfile(tmp, OUT / fn)
            meta["frames"].append({"file": fn, "clip": clip, "direction": direction, "index": i, "strength": round(strength, 2),
                                   "sha256": hashlib.sha256(tmp.read_bytes()).hexdigest()})
            tiles.append(img); idx.append(i)
            print(fn, round(strength, 2), round(time.time() - t0), "s", flush=True)
        if tiles:
            c = 256
            sh = Image.new("RGB", (c * len(tiles), c * 2), "white")
            for k, im in enumerate(tiles):
                sh.paste(im.resize((c, c), Image.LANCZOS), (k * c, 0))
                sh.paste(skeleton(fr[idx[k]]).resize((c, c), Image.LANCZOS), (k * c, c))
            sh.save(OUT / ("sheet-%s-%s.jpg" % (clip, direction)), quality=88)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
