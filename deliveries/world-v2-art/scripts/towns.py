import torch,os
from diffusers import StableDiffusionXLImg2ImgPipeline
from PIL import Image
pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained("/workspace/ki-legends-gpu/models/animagine-diffusers", torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter("/workspace/ki-legends-gpu/models/ip-adapter", subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors")
pipe.set_ip_adapter_scale(0.55)
base = "(top-down 3/4 view:1.3), detailed anime rpg game map of a small town, crisp clean outlines, rich detailed props, high detail, masterpiece, best quality, "
T = {
 "verdant": ["riverside village with a wooden watermill, stone bridge over a stream, half-timbered cottages, flower gardens",
             "farming hamlet with orchards, vegetable fields, barns, haystacks, windmill, fenced paddocks",
             "forest lumber village, log cabins, sawmill, stacked timber, tall trees around, mossy paths"],
 "pyra":    ["obsidian mining town at a cliff, mine entrance with rails and carts, dark basalt houses, glowing furnaces",
             "hot springs bath town, steaming pools between basalt rocks, red roofed bathhouses, lanterns",
             "desert caravan outpost, sandstone walls, market tents, camels pens, wells, red banners"],
 "aether":  ["lakeside lotus monastery, wooden walkways over water, pagoda, lotus ponds, cherry trees",
             "mountain terrace tea village, terraced green tea fields, small pagoda houses, stone stairs, mist",
             "bamboo grove shrine town, torii gates, stone lanterns, bamboo forest, quiet courtyards"],
 "nexus":   ["solar farm outpost, rows of glowing solar panels, small metal domes, cyan light paths",
             "crystal mining station, giant cyan crystals, drilling rigs, metal walkways, neon signs",
             "tech harbor town, metal docks with small hover boats, warehouses, cranes, glowing water edge"]}
neg = "user interface, hud, text, letters, watermark, people, person, character, crowd, animal, statue of creature, blurry, smudged, lowres, photo, frame, border"
out="/workspace/towns";os.makedirs(out,exist_ok=True)
for land, ds in T.items():
    ref = Image.open(f"/workspace/paint/up-{land}.png").convert("RGB").resize((1024,1024))
    src = Image.open(f"/workspace/paint/src-{land}.jpg").convert("RGB").resize((1152, 960))
    for i, d in enumerate(ds):
        for v in range(3):
            f=f"{out}/{land}-town-{i+1}-{v}.png"
            if os.path.exists(f): continue
            g = torch.Generator("cuda").manual_seed(500+v*17+i)
            im = pipe(prompt=base + d, negative_prompt=neg, image=src, ip_adapter_image=ref, strength=0.86,
                      guidance_scale=6.5, num_inference_steps=36, generator=g).images[0]
            im.save(f); print("done", f, flush=True)
print("ALL DONE",flush=True)
