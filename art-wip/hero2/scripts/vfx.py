import sys, json, torch, os
from diffusers import StableDiffusionXLPipeline
M = "/root/km"
race = sys.argv[1]; specs = json.load(open(sys.argv[2]))
out = f"/workspace/hero2/{race}/" + (sys.argv[3] if len(sys.argv) > 3 else "vfx"); os.makedirs(out, exist_ok=True)
pipe = StableDiffusionXLPipeline.from_pretrained(M + "/animagine-diffusers", torch_dtype=torch.float16).to("cuda")
base = ("best quality, single isolated game vfx element texture, centered on pure solid black background, empty black surroundings, "
        "clean edges, glowing, additive light, anime cel shaded, ")
neg = "white lines, speed lines, manga lines, concentric circles, swirl pattern, white background, gray background, clutter, multiple objects, person, character, human, face, body, hands, text, watermark, ground, scenery, frame, border, lowres, blurry, worst quality"
for sid, desc in specs.items():
    for k in range(4):
        g = torch.Generator("cuda").manual_seed(500 + k)
        pipe(prompt=base + desc, negative_prompt=neg, width=1024, height=1024, num_inference_steps=30,
             guidance_scale=7, generator=g).images[0].save(f"{out}/{sid}-{k}.png")
    print("OK", sid, flush=True)
print("VFX_DONE", flush=True)
