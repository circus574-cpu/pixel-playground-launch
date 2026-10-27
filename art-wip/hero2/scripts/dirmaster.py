"""Side and back masters per race: SDXL + OpenPose (mannequin pose) + IP-Adapter (accepted front master)."""
import sys, os, glob, json, torch, numpy as np
from PIL import Image
from controlnet_aux.open_pose import OpenposeDetector
from diffusers import StableDiffusionXLControlNetPipeline, ControlNetModel
M = "/root/km"
DESC = json.load(open("/workspace/hero2/race_desc.json"))
races = sys.argv[1].split(","); views = {"side": ("r-walk-side", "side view, profile, facing right"), "back": ("r-walk-up", "from behind, back view, facing away")}
det = OpenposeDetector.from_pretrained("lllyasviel/Annotators")
cn = ControlNetModel.from_pretrained(M + "/controlnet/xinsir-openpose-sdxl", torch_dtype=torch.float16)
pipe = StableDiffusionXLControlNetPipeline.from_pretrained(M + "/animagine-diffusers", controlnet=cn, torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter(M + "/ip-adapter", subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors", image_encoder_folder="image_encoder")
pipe.set_ip_adapter_scale(0.65)
neg = "lowres, bad anatomy, bad hands, extra limbs, cropped, text, watermark, blurry, worst quality, deformed, multiple views, frontal view"
for view, (rdir, words) in views.items():
    src = sorted(glob.glob(f"/root/mocap/{rdir}/*.png"))[0]
    m = Image.open(src).convert("RGB")
    pose = det(np.array(m), include_hand=False, include_face=False)
    pose = Image.fromarray(np.array(pose)) if not isinstance(pose, Image.Image) else pose
    pose = pose.resize((832, 1216)); pose.save(f"/workspace/hero2/pose-{view}.png")
    for race in races:
        ref = Image.open(f"/workspace/hero2/{race}/final/cut-birefnet-general.png").convert("RGBA")
        bg = Image.new("RGB", ref.size, (255, 255, 255)); bg.paste(ref, mask=ref.split()[3])
        out = f"/workspace/hero2/{race}/{view}"; os.makedirs(out, exist_ok=True)
        prompt = ("masterpiece, best quality, very aesthetic, full body, " + words + ", " + DESC[race] +
                  ", detailed anime illustration, cel shading, sharp lineart, plain white background")
        for i in range(6):
            g = torch.Generator("cuda").manual_seed(700 + i)
            pipe(prompt=prompt, negative_prompt=neg, image=pose, ip_adapter_image=bg, controlnet_conditioning_scale=0.85,
                 width=832, height=1216, num_inference_steps=30, guidance_scale=6.5, generator=g).images[0].save(f"{out}/c-{i}.png")
        print("DIR_DONE", race, view, flush=True)
