import torch,os
from diffusers import StableDiffusionXLImg2ImgPipeline
from PIL import Image
pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained("/workspace/ki-legends-gpu/models/animagine-diffusers", torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter("/workspace/ki-legends-gpu/models/ip-adapter", subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors")
pipe.set_ip_adapter_scale(0.4)
base = "(top-down 3/4 view:1.3), (bright sunny daytime:1.2), vivid colors, detailed anime rpg game map of one landmark site, crisp clean outlines, high detail, masterpiece, best quality, "
L = {
 "verdant-1":"ancient mossy stone fountain over giant tree roots in a small plaza, clear water basin, ivy, flowers",
 "verdant-2":"old stone bridge joining three streams, carved runestones on the bridge, waterfalls, green banks",
 "verdant-3":"abandoned overgrown wooden cottage in a misty valley clearing, broken fence, wild garden",
 "verdant-4":"ancient forge built into huge tree roots, glowing carved runes, anvil, moss covered stones",
 "pyra-1":"ruined basalt fortress bastion on a cliff, broken walls, red torn banners, lava below",
 "pyra-2":"small ash-covered stone chapel sanctuary, braziers, abandoned weapons, ember glow",
 "pyra-3":"circular fire duel altar of black stone, glowing rune ring, broken swords around",
 "pyra-4":"giant ancient warrior statue colossus beside a ruined arena, red rock desert",
 "aether-1":"white marble temple on a mountain top, floating stone pages, golden glyphs, cherry trees",
 "aether-2":"ancient library archive ruin, stone shelves of scrolls, jade roof, lanterns, pond",
 "aether-3":"marble observatory with big mirrors and brass telescope, terraces, clouds",
 "aether-4":"sacred spring of memory in a lotus garden, glowing water, stone arch, petals",
 "nexus-1":"white sci-fi laboratory complex, calibration pylons, glowing cyan rings, green ground",
 "nexus-2":"large reactor core facility, glowing blue core dome, cables, metal platforms",
 "nexus-3":"lonely console terminal tower in grey rocks, holographic screens, cyan lights",
 "nexus-4":"tall black monolith prism emitting cyan signal beam, crystals around, canyon"}
neg = "user interface, hud, text, letters, watermark, people, person, character, crowd, animal, blurry, smudged, lowres, photo, frame, border, dark night"
out="/workspace/famous";os.makedirs(out,exist_ok=True)
for k, d in L.items():
    land=k.split("-")[0]
    ref = Image.open(f"/workspace/paint/up-{land}.png").convert("RGB").resize((1024,1024))
    src = Image.open("/workspace/paint/src-verdant.jpg").convert("RGB").resize((1024, 1024))
    for v in range(3):
        f=f"{out}/{k}-{v}.png"
        if os.path.exists(f): continue
        im = pipe(prompt=base + d, negative_prompt=neg, image=src, ip_adapter_image=ref, strength=0.95,
                  guidance_scale=6.5, num_inference_steps=36, generator=torch.Generator("cuda").manual_seed(1500+v)).images[0]
        im.save(f); print("done", f, flush=True)
print("ALL DONE",flush=True)
