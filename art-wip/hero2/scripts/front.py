import sys, torch, os, io, urllib.request
from PIL import Image
from diffusers import StableDiffusionXLPipeline
race, desc = sys.argv[1], sys.argv[2]
M = "/root/km"
out = f"/workspace/hero2/{race}/front"; os.makedirs(out, exist_ok=True)
ref = Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(f"https://kilegends.pl/game/assets/origins-v1/{race}-full.webp", headers={"User-Agent": "Mozilla/5.0"})).read())).convert("RGB")
ref.save(f"/workspace/hero2/{race}/ref.png")
pipe = StableDiffusionXLPipeline.from_pretrained(M + "/animagine-diffusers", torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter(M + "/ip-adapter", subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors", image_encoder_folder="image_encoder")
scale = float(sys.argv[3]) if len(sys.argv) > 3 else 0.55
pipe.set_ip_adapter_scale(scale)
pos = ("masterpiece, best quality, very aesthetic, absurdres, 1boy, solo, full body, standing, facing viewer, "
       "front view, symmetrical stance, looking at viewer, arms at sides, " + desc +
       ", detailed anime illustration, cel shading, vibrant colors, dramatic rim light, simple dark background")
neg = ("lowres, bad anatomy, bad hands, extra fingers, missing fingers, cropped, out of frame, side view, profile, "
       "from side, three-quarter view, from behind, multiple views, text, watermark, signature, blurry, jpeg artifacts, "
       "worst quality, low quality, deformed, chibi")
for i in range(8):
    g = torch.Generator("cuda").manual_seed(9100 + i)
    im = pipe(prompt=pos, negative_prompt=neg, ip_adapter_image=ref, width=832, height=1216,
              num_inference_steps=32, guidance_scale=6.5, generator=g).images[0]
    im.save(f"{out}/s{scale}-{i}.png"); print("OK", i, flush=True)
print("FRONT_DONE", flush=True)
