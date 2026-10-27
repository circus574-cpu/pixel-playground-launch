import sys, os, torch
from PIL import Image
from diffusers import StableDiffusionXLImg2ImgPipeline
from rembg import remove, new_session
M = "/root/km"
src, out, pos = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert("RGB").resize((1248, 1824), Image.LANCZOS)
pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(M + "/animagine-diffusers", torch_dtype=torch.float16).to("cuda")
pipe.enable_vae_tiling()
neg = "lowres, blurry, bad anatomy, extra fingers, worst quality, jpeg artifacts, large spikes"
im = pipe(prompt=pos, negative_prompt=neg, image=im, strength=float(os.environ.get("STR","0.28")), num_inference_steps=40, guidance_scale=6,
          generator=torch.Generator("cuda").manual_seed(7)).images[0]
im.save(out + "-hires.png")
cut = remove(im, session=new_session("birefnet-general"))
cut.save(out.rsplit("/",1)[0] + "/cut-birefnet-general.png"); cut = cut.crop(cut.getbbox()); cut.save(out + "-cut.png"); print("FINAL_DONE", cut.size, flush=True)
