import torch,os
from diffusers import StableDiffusionXLPipeline
R="/workspace/ki-legends-gpu/models/checkpoints/DreamShaperXL_Turbo_v2_1.safetensors"
pipe=StableDiffusionXLPipeline.from_single_file(R,config="/workspace/ki-legends-gpu/models/animagine-diffusers",torch_dtype=torch.float16).to("cuda")
B="top-down three-quarter view game map of a single landmark in a lush green forest, hand painted cel shaded anime fantasy rpg art, bright daylight, vivid, "
L={"verdant-1":"ancient mossy stone fountain on giant twisted tree roots, round clear water basin, ivy, wild flowers",
 "verdant-2":"old arched stone bridge over the meeting of three streams, glowing carved runestones, small waterfalls",
 "verdant-3":"one small abandoned overgrown wooden hut in a misty forest clearing, broken fence, fog",
 "verdant-4":"open-air ancient forge carved into roots of a colossal tree, glowing green runes, stone anvil, moss"}
N="village, town, many houses, red roofs, people, character, text, watermark, frame, border, photo, night"
out="/workspace/famous4";os.makedirs(out,exist_ok=True)
for k,p in L.items():
  for v in range(4):
    f=f"{out}/{k}-{v}.png"
    if os.path.exists(f): continue
    pipe(prompt=B+p,negative_prompt=N,width=1024,height=1024,num_inference_steps=10,guidance_scale=2.5,generator=torch.Generator("cuda").manual_seed(4100+v)).images[0].save(f);print("done",f,flush=True)
