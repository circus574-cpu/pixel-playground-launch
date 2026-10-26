import torch,os,json
from diffusers import StableDiffusionXLPipeline
from PIL import Image
R="/workspace/ki-legends-gpu/models/checkpoints/DreamShaperXL_Turbo_v2_1.safetensors"
pipe=StableDiffusionXLPipeline.from_single_file(R,config="/workspace/ki-legends-gpu/models/animagine-diffusers",torch_dtype=torch.float16).to("cuda")
M=json.load(open("/workspace/roster.json"))["monsters"]
S=("single fantasy creature game sprite, full body fully visible, centered with empty space around, three-quarter top-down view from above, "
   "hand painted cel shaded anime fantasy rpg art, crisp clean silhouette, plain solid light grey background")
N="forest, trees, foliage background, multiple creatures, text, watermark, frame, border, ground, scenery, landscape, background scene, person, human, rider, cropped, cut off, blurry, photo"
out="/workspace/mon2";os.makedirs(out,exist_ok=True)
for m in [x for x in M if x["world"]=="verdant"]:
  for v in range(3):
    f=f"{out}/{m['id']}-{v}.png"
    if os.path.exists(f): continue
    p=f"(isolated on plain flat light grey studio background:1.3), {m['design']}, green and brown colors, {S}"
    im=pipe(prompt=p,negative_prompt=N,width=1024,height=1024,num_inference_steps=10,guidance_scale=2.5,
            generator=torch.Generator("cuda").manual_seed(3100+v)).images[0]
    im.save(f);print("done",f,flush=True)
print("ALL DONE",flush=True)
