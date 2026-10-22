"""Eight painted base views of a race hero (down, down-left, ... down-right) from an owner-accepted identity.
Pose/orientation comes from rig keypoints (OpenPose skeletons), appearance from the accepted candidate via IP-Adapter.
These masters feed the mesh-deformation animation; they are not per-frame redraws.
  python3 painted_views.py android [tag] [seeds comma list]
"""
import hashlib, json, sys, time
from pathlib import Path
import torch
from PIL import Image, ImageDraw
from diffusers import StableDiffusionXLControlNetPipeline, ControlNetModel

race = sys.argv[1]
tag = sys.argv[2] if len(sys.argv) > 2 else "v1"
SEEDS = [int(s) for s in (sys.argv[3] if len(sys.argv) > 3 else "5741102,5741103").split(",")]
IP_SCALE = float(sys.argv[4]) if len(sys.argv) > 4 else 0.7
ROOT = Path("/workspace/ki-legends-gpu"); M = ROOT / "models"
OUT = ROOT / "renders" / ("%s-painted-%s" % (race, tag)); OUT.mkdir(parents=True, exist_ok=True)
IDENT = {"android": ROOT / "renders/android-identity-v1/selected/android-s5741102-d62.png",
         "planetary": ROOT / "renders/planetary-identity-v1/selected/planetary-s5741102-d62.png",
         "legend": ROOT / "renders/legend-identity-v1/selected/legend-s5741102-d62.png",
         "sage": ROOT / "renders/sage-identity-v2/selected/sage-s5741102-d55.png"}[race]
KP = json.loads((ROOT / "renders" / ("%s-painted-v1" % ("android" if race in ("legend", "sage") else race)) / "keypoints.json").read_text())  # one shared humanoid rig skeleton
BASE = ("1boy, solo, adult male, full body, standing, both hands visible, complete feet visible, fully clothed, "
        "relaxed ready stance, high angle three quarter view, anime fantasy game protagonist, clean precise linework, "
        "beautifully painted materials, readable silhouette, isolated on pure white background, plain white background, simple background, no surrounding scenery, "
        "wide white margin on all sides, masterpiece, best quality, very aesthetic")
LOOK = {"android": "short spiky silver white hair, steel blue eyes, stern calm expression, android warrior, "
        "layered silver and black synthetic armor plates, blue gem on chest, blue accents on shoulders and knees, "
        "black bodysuit, long split white and blue coat tails with blue geometric patterns, armored gauntlets, silver armored boots with blue accents, ",
        "planetary": "messy spiky chestnut brown hair with a short orange braid, white headband, amber eyes, tanned skin, calm determined expression, "
        "muscular forest warrior, orange scarf, sleeveless white and green wrap tunic, brown leather straps belts and pouches, "
        "bronze brown armored gauntlets and greaves with cyan crystal gems, dark green trousers, brown pointed leather boots, "
        "orange white and green cloth with geometric patterns, ",
        "legend": "wild spiky crimson red and black hair, intense amber eyes, fierce confident expression, muscular warrior, "
        "black and crimson armor with steel spikes on shoulders and gauntlets, open black vest, flowing red sashes, black trousers, spiked steel armored boots, ",
        "sage": "masculine adult man, strong jaw, angular masculine face, broad shoulders, flat chest, tall lean athletic build, long pale blonde hair tied in a high ponytail "
        "with a gold ornament, pointed elf ears, golden amber eyes, serene calm stern expression, male elf sage, long layered cream white and emerald green robes with gold geometric embroidery, "
        "wide sleeves, jeweled emerald belt with gold ornaments and teal tassels, black inner garment, golden shoulder ornaments, ornate black and gold armored boots and greaves with emerald gems, "}[race]
VIEW = {"down": "front view, facing the viewer", "down-left": "three quarter front view, facing left", "left": "side view, profile, facing left",
        "up-left": "three quarter back view, facing away to the left", "up": "back view, seen from behind, facing away from the viewer",
        "up-right": "three quarter back view, facing away to the right", "right": "side view, profile, facing right",
        "down-right": "three quarter front view, facing right"}
NEG = ("nsfw, nude, child, girl, woman, worst quality, low quality, blurry, cropped, cut off feet, out of frame, close up, portrait, text, logo, "
       "watermark, multiple people, duplicate character, extra limbs, missing hands, malformed hands, landscape, ground texture, weapon, shield, "
       "blue energy, energy effects, glow, glowing aura, swirls, lightning, crystal shards, motion blur, speed lines, blue background, grey background, forest background, "
       "aura, halo, floating rings, flames, floating energy, glow outside body, sparks, particles, background scenery, gradient background, shadow on ground")
LIMBS = [[1,2],[1,5],[2,3],[3,4],[5,6],[6,7],[1,8],[8,9],[9,10],[1,11],[11,12],[12,13],[1,0],[0,14],[14,16],[0,15],[15,17]]
COL = [[255,0,0],[255,85,0],[255,170,0],[255,255,0],[170,255,0],[85,255,0],[0,255,0],[0,255,85],[0,255,170],[0,255,255],[0,170,255],[0,85,255],[0,0,255],[85,0,255],[170,0,255],[255,0,255],[255,0,170]]
ORDER = ["nose","neck","r_sho","r_elb","r_wri","l_sho","l_elb","l_wri","r_hip","r_kne","r_ank","l_hip","l_kne","l_ank","r_eye","l_eye","r_ear","l_ear"]

def skeleton(points, size=1024):
    img = Image.new("RGB", (size, size), (0, 0, 0)); d = ImageDraw.Draw(img)
    xy = [(points[k][0] * size, points[k][1] * size) for k in ORDER]
    for (a, b), c in zip(LIMBS, COL):
        d.line([xy[a], xy[b]], fill=tuple(int(v * .6) for v in c), width=14)
    for p, c in zip(xy, COL + [[255, 0, 85]]):
        d.ellipse([p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8], fill=tuple(c))
    return img

cn = ControlNetModel.from_pretrained(str(M / "controlnet/xinsir-openpose-sdxl"), torch_dtype=torch.float16)
if race == "sage":  # staff and robes are canon; keep the figure unambiguously male
    NEG = NEG.replace(" weapon, shield,", "") + ", girl, woman, female, feminine, androgynous, breasts, cleavage, character sheet, multiple views, group, crowd, chibi"
pipe = StableDiffusionXLControlNetPipeline.from_single_file(str(M / "checkpoints/animagine-xl-3.1.safetensors"), controlnet=cn, torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter(str(M / "ip-adapter"), subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors", image_encoder_folder="sdxl_models/image_encoder")
pipe.set_ip_adapter_scale(IP_SCALE)
ref = Image.open(IDENT).convert("RGB")
meta = {"ip_adapter_scale": IP_SCALE, "race": race, "identity": str(IDENT), "identity_sha256": hashlib.sha256(IDENT.read_bytes()).hexdigest(), "views": []}
tiles = []
for direction in ["down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right"]:
    sk = skeleton(KP[direction]); sk.save(OUT / ("skeleton-%s.png" % direction))
    for seed in SEEDS:
        t = time.time()
        img = pipe(prompt=LOOK + VIEW[direction] + ", " + BASE, negative_prompt=NEG, image=sk, ip_adapter_image=ref, controlnet_conditioning_scale=0.9,
                   num_inference_steps=30, guidance_scale=6.0, width=1024, height=1024, generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        name = "%s-%s-s%d.png" % (race, direction, seed); img.save(OUT / name)
        sha = hashlib.sha256((OUT / name).read_bytes()).hexdigest()
        meta["views"].append({"file": name, "direction": direction, "seed": seed, "sha256": sha, "seconds": round(time.time() - t, 1)})
        tiles.append(img); print(name, sha[:12], round(time.time() - t, 1), "s", flush=True)
sheet = Image.new("RGB", (320 * 8, 320 * len(SEEDS)), "white")
for i, im in enumerate(tiles):
    sheet.paste(im.resize((320, 320), Image.LANCZOS), ((i // len(SEEDS)) * 320, (i % len(SEEDS)) * 320))
sheet.save(OUT / "contact-sheet.jpg", quality=88)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1)); print("GOTOWE:", OUT, flush=True)
