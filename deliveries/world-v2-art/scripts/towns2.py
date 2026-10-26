import torch,os
from diffusers import StableDiffusionXLImg2ImgPipeline
from PIL import Image
pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained("/workspace/ki-legends-gpu/models/animagine-diffusers", torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter("/workspace/ki-legends-gpu/models/ip-adapter", subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors")
pipe.set_ip_adapter_scale(0.4)
base = "(top-down 3/4 view:1.3), (bright sunny daytime:1.3), vivid colors, detailed anime rpg game map of a small town, crisp clean outlines, rich detailed props, high detail, masterpiece, best quality, "
T = {
 "pyra":    ["obsidian mining town at a cliff, mine entrance with rails and carts, dark basalt houses, glowing furnaces",
             "hot springs bath town, steaming pools between basalt rocks, red roofed bathhouses, lanterns",
             "desert caravan outpost, sandstone walls, market tents, camels pens, wells, red banners"],
 "nexus":   ["white and silver sci-fi farming outpost on green fields, rows of solar panels, small white domes, greenhouses",
             "mining station in a grey rocky canyon, giant cyan crystals, yellow drilling rigs, metal walkways",
             "bright seaside tech harbor, turquoise sea, white metal docks with hover boats, warehouses, cranes"]}
neg = "user interface, hud, text, letters, watermark, people, person, character, crowd, animal, statue of creature, blurry, smudged, lowres, photo, frame, border"
out="/workspace/towns2";os.makedirs(out,exist_ok=True)
for land, ds in T.items():
    ref = Image.open(f"/workspace/paint/up-{land}.png").convert("RGB").resize((1024,1024))
    src = Image.open(f"/workspace/paint/src-verdant.jpg").convert("RGB").resize((1152, 960))
    for i, d in enumerate(ds):
        for v in range(3):
            f=f"{out}/{land}-town-{i+1}-{v}.png"
            if os.path.exists(f): continue
            g = torch.Generator("cuda").manual_seed(900+v*17+i)
            im = pipe(prompt=base + d, negative_prompt=neg, image=src, ip_adapter_image=ref, strength=0.93,
                      guidance_scale=6.5, num_inference_steps=36, generator=g).images[0]
            im.save(f); print("done", f, flush=True)
print("ALL DONE",flush=True)
