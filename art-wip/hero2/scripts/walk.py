import sys, json, math, os, torch, numpy as np
from PIL import Image
from controlnet_aux.open_pose import util
from controlnet_aux.open_pose.body import Keypoint
from diffusers import StableDiffusionXLControlNetImg2ImgPipeline, ControlNetModel
from rembg import remove, new_session
M = "/root/km"
race, pos = sys.argv[1], sys.argv[2]
strength = float(sys.argv[3]) if len(sys.argv) > 3 else 0.62
base = f"/workspace/hero2/{race}"; out = f"{base}/" + (sys.argv[4] if len(sys.argv) > 4 else "walk-down"); os.makedirs(out, exist_ok=True)
kp = json.load(open(f"{base}/final/kp.json"))
W, H = 832, 1216
master = Image.open(f"{base}/final/{race}-front-hires.png").convert("RGB").resize((W, H))
ref = Image.open(f"{base}/final/cut-birefnet-general.png").convert("RGBA")
bg = Image.new("RGB", ref.size, (255, 255, 255)); bg.paste(ref, mask=ref.split()[3]); ref = bg
def frame_kp(t):
    p = [list(k) if k else None for k in kp]
    s = math.sin(2 * math.pi * t); c = math.cos(2 * math.pi * t)
    bob = -0.010 * abs(math.sin(2 * math.pi * t))
    for k in p:
        if k: k[1] += bob
    cx = (p[8][0] + p[11][0]) / 2
    # narrow the stance for walking: knees/ankles toward hip line
    for hip, knee, ank, side in ((8, 9, 10, -1), (11, 12, 13, 1)):
        p[knee][0] = p[hip][0] + side * 0.01; p[ank][0] = p[hip][0] + side * 0.015
        lift = max(0.0, s if side < 0 else -s)
        p[knee][1] -= 0.07 * lift; p[ank][1] -= 0.13 * lift
        p[knee][0] += side * 0.015 * lift
    for sh, el, wr, side in ((2, 3, 4, -1), (5, 6, 7, 1)):
        sw = s if side > 0 else -s
        p[el][0] = p[sh][0] + side * 0.05; p[wr][0] = p[sh][0] + side * 0.06
        p[el][1] = p[sh][1] + 0.12 - 0.01 * sw; p[wr][1] = p[sh][1] + 0.24 - 0.07 * sw
    return p
def render(p):
    canvas = np.zeros((H, W, 3), np.uint8)
    canvas = util.draw_bodypose(canvas, [Keypoint(x, y) if (x is not None) else None for x, y in [(k[0], k[1]) if k else (None, None) for k in p]])
    return Image.fromarray(canvas)
cn = ControlNetModel.from_pretrained(M + "/controlnet/xinsir-openpose-sdxl", torch_dtype=torch.float16)
pipe = StableDiffusionXLControlNetImg2ImgPipeline.from_pretrained(M + "/animagine-diffusers", controlnet=cn, torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter(M + "/ip-adapter", subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors", image_encoder_folder="image_encoder")
pipe.set_ip_adapter_scale(0.8)
neg = "lowres, bad anatomy, extra limbs, extra arms, bad hands, side view, from behind, text, watermark, blurry, worst quality, deformed"
cut = new_session("birefnet-general"); frames = []
for i in range(8):
    pose = render(frame_kp(i / 8)); pose.save(f"{out}/pose-{i}.png")
    g = torch.Generator("cuda").manual_seed(42)
    im = pipe(prompt=pos, negative_prompt=neg, image=master, control_image=pose, ip_adapter_image=ref,
              strength=strength, controlnet_conditioning_scale=1.0, num_inference_steps=36, guidance_scale=6,
              generator=g).images[0]
    im.save(f"{out}/raw-{i}.png")
    c = remove(im, session=cut); c.save(f"{out}/f-{i}.png"); frames.append(c); print("OK", i, flush=True)
box = None
for f in frames:
    b = f.getbbox(); box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
gif = []
for f in frames:
    g2 = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (70, 90, 60, 255)); c = f.crop(box); g2.paste(c, mask=c.split()[3])
    gif.append(g2.convert("RGB").resize((g2.width // 2, g2.height // 2)))
gif[0].save(f"{out}/walk.gif", save_all=True, append_images=gif[1:], duration=110, loop=0)
print("WALK_DONE", flush=True)
