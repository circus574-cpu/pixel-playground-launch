"""Five painted views (down, down-right, right, up-right, up) of every selected monster candidate; the other three directions are mirrors.
Identity comes from the chosen candidate via IP-Adapter; the best seed per view is picked by CLIP image-embedding similarity to the candidate.
  python3 gen_enemy_views.py <tag> <roster.json> <selection.json {id: seed}> [ids comma list or all] [ip_scale] [seeds]
-> renders/enemies-views-<tag>/<id>-<view>-s<seed>.png (1024) + best.json {id: {view: file}} + sheet-<id>.jpg
"""
import hashlib, json, sys, time
from pathlib import Path
import torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline

tag = sys.argv[1]; roster = {m["id"]: m for m in json.loads(Path(sys.argv[2]).read_text())["monsters"]}; sel = json.loads(Path(sys.argv[3]).read_text())
want = sys.argv[4] if len(sys.argv) > 4 else "all"; ids = list(sel) if want == "all" else want.split(",")
IP = float(sys.argv[5]) if len(sys.argv) > 5 else 0.7
SEEDS = [int(s) for s in (sys.argv[6] if len(sys.argv) > 6 else "5741102,5741103").split(",")]
ROOT = Path("/workspace/ki-legends-gpu"); M = ROOT / "models"; CAND = ROOT / "renders/enemies-cand-v1"; OUT = ROOT / "renders" / ("enemies-views-%s" % tag); OUT.mkdir(parents=True, exist_ok=True)
VIEWS = {"down": "front view, facing the viewer, seen from slightly above", "down-right": "three quarter front view, facing right, seen from above", "right": "side view, profile, facing right",
         "up-right": "three quarter back view, facing away to the right, seen from above", "up": "back view, seen from behind, facing away from the viewer"}
BASE = ("no humans, monster, creature, solo, full body, game enemy design, anime fantasy, clean lineart, beautifully painted, isolated on pure white background, "
        "simple background, masterpiece, best quality, very aesthetic")
NEG = ("human, person, girl, boy, text, multiple creatures, scenery, landscape, ground shadow, cropped, out of frame, lowres, worst quality, low quality, blurry, watermark, nsfw")
pipe = StableDiffusionXLPipeline.from_single_file(str(M / "checkpoints/animagine-xl-3.1.safetensors"), torch_dtype=torch.float16).to("cuda")
pipe.load_ip_adapter(str(M / "ip-adapter"), subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors", image_encoder_folder="sdxl_models/image_encoder"); pipe.set_ip_adapter_scale(IP)
def embed(img):
    px = pipe.feature_extractor(images=img, return_tensors="pt").pixel_values.to("cuda", torch.float16)
    with torch.no_grad(): e = pipe.image_encoder(px).image_embeds
    return torch.nn.functional.normalize(e.float(), dim=-1)
best = {}; t0 = time.time()
for mid in ids:
    m = roster[mid]; ref = Image.open(CAND / ("%s-s%d.png" % (mid, sel[mid]))).convert("RGB"); er = embed(ref); best[mid] = {}
    fly = ", flying in the air" if m["archetype"] in ("fly", "hover") else ", standing on the ground"; tiles = []
    for view, vtxt in VIEWS.items():
        cand = []
        for seed in SEEDS:
            img = pipe(prompt="%s%s, %s, %s, %s" % (m["design"], fly, m["palette"], vtxt, BASE), negative_prompt=NEG, ip_adapter_image=ref, num_inference_steps=28, guidance_scale=6.0, width=1024, height=1024,
                       generator=torch.Generator("cuda").manual_seed(seed)).images[0]
            fn = "%s-%s-s%d.png" % (mid, view, seed); img.save(OUT / fn); cand.append((float((embed(img) * er).sum()), fn, img))
        cand.sort(key=lambda c: -c[0]); best[mid][view] = {"file": cand[0][1], "similarity": round(cand[0][0], 3), "sha256": hashlib.sha256((OUT / cand[0][1]).read_bytes()).hexdigest()}; tiles.append(cand[0][2]); print(mid, view, cand[0][1], round(cand[0][0], 3), flush=True)
    sh = Image.new("RGB", (6 * 220, 220), "white"); sh.paste(ref.resize((220, 220), Image.LANCZOS), (0, 0))
    for i, t in enumerate(tiles): sh.paste(t.resize((220, 220), Image.LANCZOS), ((i + 1) * 220, 0))
    sh.save(OUT / ("sheet-%s.jpg" % mid), quality=86)
(OUT / "best.json").write_text(json.dumps(best, indent=1)); print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
