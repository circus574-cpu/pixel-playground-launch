# 8-frame sprite grid in one SDXL image: openpose grid + IP-Adapter identity
import sys, os, glob, json, torch, numpy as np
from PIL import Image
from controlnet_aux.open_pose import OpenposeDetector
from diffusers import StableDiffusionXLControlNetPipeline, StableDiffusionXLControlNetImg2ImgPipeline, ControlNetModel
M = "/root/km"; DESC = json.load(open("/workspace/hero2/race_desc.json"))
race, view, drv = sys.argv[1], sys.argv[2], sys.argv[3]          # drv = joints json from mannequin.py JOINTS=
start, cyc = int(os.environ.get("START", "4")), int(os.environ.get("CYC", "34"))
CW, CH = 384, 512; COLS, ROWS = 4, 2
words = {"side": "side view, profile, facing right, walking", "back": "from behind, back view, walking away", "front": "front view, facing viewer, walking", "fside": "three-quarter view from the front, body turned to the right, walking", "bside": "three-quarter back view, seen from behind, turned to the right, walking away"}[view]
from controlnet_aux.open_pose.util import draw_bodypose
from controlnet_aux.open_pose.body import Keypoint
J = json.load(open(drv)); FR = J["frames"]; keys = sorted(FR, key=int)
idx = [start + round(i * cyc / 8) for i in range(8)]
sel = [FR[keys[i]] for i in idx]
ys = [p[1] for f in sel for p in f]; top, bot = min(ys), max(ys); h = bot - top
top -= 0.16 * h; bot += 0.05 * h; SC = float(os.environ.get("SCALE", "1")); s = CH * 0.98 * SC / (bot - top)
top -= (bot - top) * (1 - SC) / SC  # keep feet near the bottom when shrinking
grid = np.zeros((CH * ROWS, CW * COLS, 3), np.uint8)
place = []
for k, f in enumerate(sel):
    cx = (f[8][0] + f[11][0]) / 2
    fy = max(p[1] for p in f if p[2]); hy = min(p[1] for p in f if p[2])
    place.append(((k % COLS) * CW + CW / 2, (k // COLS) * CH + (fy - top) * s, (fy - hy) * s))
    ox, oy = (k % COLS) * CW, (k // COLS) * CH
    kps = [Keypoint(((p[0] - cx) * s + CW / 2 + ox) / (CW * COLS), ((p[1] - top) * s + oy) / (CH * ROWS)) if p[2] else None for p in f]
    grid = draw_bodypose(grid, kps)
grid = Image.fromarray(grid)
out = f"/workspace/hero2/{race}/grid"; os.makedirs(out, exist_ok=True)
grid.save(f"{out}/pose-{os.environ.get('MOTION', '')}{view}.png")
cn = ControlNetModel.from_pretrained(M + "/controlnet/xinsir-openpose-sdxl", torch_dtype=torch.float16)
STR = float(os.environ.get("STR", "0"))
PIPE = StableDiffusionXLControlNetImg2ImgPipeline if STR > 0 else StableDiffusionXLControlNetPipeline
pipe = PIPE.from_pretrained(M + "/animagine-diffusers", controlnet=cn, torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter(M + "/ip-adapter", subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors", image_encoder_folder="image_encoder")
pipe.set_ip_adapter_scale(float(os.environ.get("IPS", "0.6")))
refp = f"/workspace/hero2/{race}/{ {'side':'side','back':'back','front':'final','fside':'final','bside':'back'}[view] }/" + ("cut-birefnet-general.png" if view in ("front", "fside") else "final.png")
ref = Image.open(refp).convert("RGBA"); bg = Image.new("RGB", ref.size, (255, 255, 255)); bg.paste(ref, mask=ref.split()[3])
init = None
if STR > 0:
    rc = ref.crop(ref.getbbox()); bbg = Image.new("RGB", (CW * COLS, CH * ROWS), tuple(int(x) for x in os.environ.get("BG", "235,235,235").split(",")))
    for (cx, fy, ph) in place:
        hh = ph * 1.10; ww = rc.width * hh / rc.height
        t = rc.resize((max(1, int(ww)), max(1, int(hh))), Image.LANCZOS)
        bbg.paste(t, (int(cx - ww / 2), int(fy - hh * 0.97)), t)
    init = bbg; init.save(f"{out}/init-{os.environ.get('MOTION', '')}{view}.png")
prompt = ("masterpiece, best quality, sprite sheet, 8 frames of the same character, walk cycle animation frames, character turnaround consistency, "
          "identical character in every frame, full body, " + (words.replace("walking away", os.environ.get("ACT", "walking away")).replace("walking", os.environ.get("ACT", "walking"))) + ", " + DESC[race] + os.environ.get("EXTRA", "") + ", detailed anime illustration, cel shading, sharp lineart, bright lighting, pure white background, simple white background")
neg = "lowres, bad anatomy, extra limbs, fused legs, different characters, inconsistent outfit, text, watermark, blurry, cropped, background scenery, frame borders, dark background, black background, gray background, silhouette, barefoot" + os.environ.get("NEGX", "")
for sd in range(int(os.environ.get("N", "3"))):
    g = torch.Generator("cuda").manual_seed(int(os.environ.get("SEED0", "900")) + sd)
    kw = dict(image=init, control_image=grid, strength=STR) if STR > 0 else dict(image=grid)
    img = pipe(prompt=prompt, negative_prompt=neg, ip_adapter_image=bg, **kw, controlnet_conditioning_scale=float(os.environ.get("CNS", "0.9")),
               width=CW * COLS, height=CH * ROWS, num_inference_steps=30, guidance_scale=float(os.environ.get("CFG", "7")), generator=g).images[0]
    img.save(f"{out}/{os.environ.get('MOTION', '')}{view}{os.environ.get('TAG', '')}-{sd}.png"); print("GRID", race, view, sd, flush=True)
