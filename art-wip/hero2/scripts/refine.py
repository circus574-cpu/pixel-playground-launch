import sys, torch
from PIL import Image
from diffusers import StableDiffusionXLImg2ImgPipeline
M = "/root/km"
src = Image.open(sys.argv[1]).convert("RGB").resize((832, 1216))
out = sys.argv[2]; pos = sys.argv[3]
pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(M + "/animagine-diffusers", torch_dtype=torch.float16).to("cuda")
neg = ("lowres, bad anatomy, bad hands, extra fingers, cropped, side view, profile, text, watermark, blurry, "
       "worst quality, low quality, deformed, " + (sys.argv[4] if len(sys.argv) > 4 else "red hair, pink hair, large spikes, oversized shoulder armor"))
i = 0
for st in (0.42, 0.5, 0.58):
    for seed in (1, 2):
        g = torch.Generator("cuda").manual_seed(seed)
        pipe(prompt=pos, negative_prompt=neg, image=src, strength=st, num_inference_steps=40,
             guidance_scale=6.5, generator=g).images[0].save(f"{out}-{i}.png"); print("OK", i, flush=True); i += 1
print("REFINE_DONE", flush=True)
