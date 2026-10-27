import sys, os, torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline
race, desc, ref_path, tag = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
scale = float(sys.argv[5]) if len(sys.argv) > 5 else 0.6
M = "/root/km"; out = f"/workspace/hero2/{race}/{tag}"; os.makedirs(out, exist_ok=True)
ref = Image.open(ref_path).convert("RGB")
pipe = StableDiffusionXLPipeline.from_pretrained(M + "/animagine-diffusers", torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter(M + "/ip-adapter", subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors", image_encoder_folder="image_encoder")
pipe.set_ip_adapter_scale(scale)
pos = ("masterpiece, best quality, very aesthetic, absurdres, 1boy, solo, full body, standing, facing viewer, front view, symmetrical stance, "
       "looking at viewer, arms at sides, " + desc + ", detailed anime illustration, cel shading, vibrant colors, dramatic rim light, simple dark background")
neg = ("lowres, bad anatomy, bad hands, extra fingers, cropped, side view, profile, three-quarter view, from behind, multiple views, "
       "text, watermark, blurry, worst quality, low quality, deformed, chibi, female, woman, skinny")
for i in range(8):
    g = torch.Generator("cuda").manual_seed(3300 + i)
    pipe(prompt=pos, negative_prompt=neg, ip_adapter_image=ref, width=832, height=1216, num_inference_steps=32,
         guidance_scale=6.5, generator=g).images[0].save(f"{out}/c-{i}.png"); print("OK", i, flush=True)
print("FRONT_DONE", flush=True)
