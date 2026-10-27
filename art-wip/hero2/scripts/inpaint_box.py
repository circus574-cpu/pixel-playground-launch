import sys, json, torch
from PIL import Image, ImageDraw, ImageFilter
from diffusers import StableDiffusionXLInpaintPipeline
M = "/root/km"
src = Image.open(sys.argv[1]).convert("RGB").resize((832, 1216)); out = sys.argv[2]
boxes = json.loads(sys.argv[3]); pos, neg = sys.argv[4], sys.argv[5]
mask = Image.new("L", src.size, 0); d = ImageDraw.Draw(mask)
for b in boxes: d.ellipse(tuple(b), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(12)); mask.save(out + "-mask.png")
pipe = StableDiffusionXLInpaintPipeline.from_pretrained(M + "/animagine-diffusers", torch_dtype=torch.float16).to("cuda")
i = 0
for st in (0.7, 0.85):
    for seed in (11, 12, 13):
        g = torch.Generator("cuda").manual_seed(seed)
        pipe(prompt=pos, negative_prompt=neg, image=src, mask_image=mask, strength=st, num_inference_steps=40,
             guidance_scale=7, generator=g, width=832, height=1216).images[0].save(f"{out}-{i}.png"); print("OK", i, flush=True); i += 1
print("INPAINT_DONE", flush=True)
