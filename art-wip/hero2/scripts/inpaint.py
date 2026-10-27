import sys, torch
from PIL import Image, ImageDraw, ImageFilter
from diffusers import StableDiffusionXLInpaintPipeline
M = "/root/km"
src = Image.open(sys.argv[1]).convert("RGB").resize((832, 1216)); out = sys.argv[2]
mask = Image.new("L", src.size, 0); d = ImageDraw.Draw(mask)
d.ellipse((20, 90, 340, 420), fill=255); d.ellipse((492, 90, 812, 420), fill=255)
d.rectangle((300, 0, 532, 330), fill=0)  # keep head
mask = mask.filter(ImageFilter.GaussianBlur(14)); mask.save(out + "-mask.png")
pipe = StableDiffusionXLInpaintPipeline.from_pretrained(M + "/animagine-diffusers", torch_dtype=torch.float16).to("cuda")
pos = ("masterpiece, best quality, 1boy, muscular, front view, small round crimson shoulder pads, compact red armor plates, "
       "short small spikes, black martial arts outfit, red sash, anime illustration, cel shading, dramatic rim light")
neg = "large spikes, long spikes, oversized shoulder armor, huge pauldrons, bad anatomy, extra arms, lowres, blurry, worst quality"
i = 0
for st in (0.75, 0.88):
    for seed in (3, 4, 5):
        g = torch.Generator("cuda").manual_seed(seed)
        pipe(prompt=pos, negative_prompt=neg, image=src, mask_image=mask, strength=st, num_inference_steps=40,
             guidance_scale=7, generator=g, width=832, height=1216).images[0].save(f"{out}-{i}.png"); print("OK", i, flush=True); i += 1
print("INPAINT_DONE", flush=True)
