import sys, json, math, os, torch, numpy as np
from PIL import Image
from controlnet_aux.open_pose import util
from controlnet_aux.open_pose.body import Keypoint
from diffusers import StableDiffusionXLControlNetImg2ImgPipeline, StableDiffusionXLImg2ImgPipeline, ControlNetModel
from rembg import remove, new_session
M = "/root/km"
race, pos, tag = sys.argv[1], sys.argv[2], sys.argv[3]
base = f"/workspace/hero2/{race}"; out = f"{base}/{tag}"; os.makedirs(out, exist_ok=True)
kp = json.load(open(f"{base}/final/kp.json"))
TW, TH, N = 416, 608, 4        # tile; 4 tiles -> 1664x608 per row, 2 rows = 8 frames
master = Image.open(f"{base}/final/cut-birefnet-general.png").convert("RGBA")
def on_bg(im, col=(40, 40, 46)):
    b = Image.new("RGB", im.size, col); b.paste(im, mask=im.split()[3]); return b
ref = on_bg(master, (255, 255, 255))
m_rgb = on_bg(master).resize((TW, TH))
def frame_kp(t):
    p = [list(k) if k else None for k in kp]
    s = math.sin(2 * math.pi * t)
    bob = -0.012 * abs(s)
    for k in p:
        if k: k[1] += bob
    for hip, knee, ank, side in ((8, 9, 10, -1), (11, 12, 13, 1)):
        p[knee][0] = p[hip][0]; p[ank][0] = p[hip][0]
        lift = max(0.0, s if side < 0 else -s)
        p[knee][1] -= 0.07 * lift; p[ank][1] -= 0.13 * lift  # straight under the hip, no sideways drift
    for sh, el, wr, side in ((2, 3, 4, -1), (5, 6, 7, 1)):
        sw = s if side > 0 else -s
        p[el][0] = p[sh][0] + side * 0.05; p[wr][0] = p[sh][0] + side * 0.06
        p[el][1] = p[sh][1] + 0.12 - 0.01 * sw; p[wr][1] = p[sh][1] + 0.24 - 0.07 * sw
    return p
def render(p, w, h):
    c = np.zeros((h, w, 3), np.uint8)
    return Image.fromarray(util.draw_bodypose(c, [Keypoint(k[0], k[1]) if k else None for k in p]))
cn = ControlNetModel.from_pretrained(M + "/controlnet/xinsir-openpose-sdxl", torch_dtype=torch.float16)
pipe = StableDiffusionXLControlNetImg2ImgPipeline.from_pretrained(M + "/animagine-diffusers", controlnet=cn, torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter(M + "/ip-adapter", subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors", image_encoder_folder="image_encoder")
pipe.set_ip_adapter_scale(0.75)
neg = "lowres, bad anatomy, extra limbs, side view, from behind, text, watermark, blurry, worst quality, deformed, different outfits, inconsistent"
gpos = "character sheet, same character repeated four times in a row, identical outfit and colors, walk cycle animation frames, " + pos
tiles = []
for row in range(2):
    init = Image.new("RGB", (TW * N, TH)); ctrl = Image.new("RGB", (TW * N, TH))
    for j in range(N):
        t = (row * N + j) / 8
        init.paste(m_rgb, (j * TW, 0)); ctrl.paste(render(frame_kp(t), TW, TH), (j * TW, 0))
    ctrl.save(f"{out}/ctrl-{row}.png")
    g = torch.Generator("cuda").manual_seed(77)
    im = pipe(prompt=gpos, negative_prompt=neg, image=init, control_image=ctrl, ip_adapter_image=ref, strength=0.8,
              controlnet_conditioning_scale=1.0, num_inference_steps=36, guidance_scale=6, generator=g,
              width=TW * N, height=TH).images[0]
    im.save(f"{out}/row-{row}.png")
    tiles += [im.crop((j * TW, 0, (j + 1) * TW, TH)) for j in range(N)]
    print("ROW", row, flush=True)
del pipe; torch.cuda.empty_cache()
up = StableDiffusionXLImg2ImgPipeline.from_pretrained(M + "/animagine-diffusers", torch_dtype=torch.float16).to("cuda")
cut = new_session("birefnet-general"); frames = []
for i, t in enumerate(tiles):
    g = torch.Generator("cuda").manual_seed(5)
    hi = up(prompt=pos, negative_prompt=neg, image=t.resize((832, 1216), Image.LANCZOS), strength=0.3,
            num_inference_steps=30, guidance_scale=5.5, generator=g).images[0]
    hi.save(f"{out}/hi-{i}.png"); c = remove(hi, session=cut); c.save(f"{out}/f-{i}.png"); frames.append(c); print("OK", i, flush=True)
box = None
for f in frames:
    b = f.getbbox(); box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
gif = []
for f in frames:
    g2 = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (70, 90, 60, 255)); c = f.crop(box); g2.paste(c, mask=c.split()[3])
    gif.append(g2.convert("RGB").resize((g2.width // 2, g2.height // 2)))
gif[0].save(f"{out}/walk.gif", save_all=True, append_images=gif[1:], duration=110, loop=0)
print("WALK_DONE", flush=True)
