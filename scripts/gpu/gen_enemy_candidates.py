"""Design candidates for the bestiary monsters (Animagine XL 3.1). Reads roster.json (same folder or argv[2]).
  python3 gen_enemy_candidates.py [tag] [roster.json] [ids comma list or all] [seeds]   ->  renders/enemies-cand-<tag>/<id>-s<seed>.png (1024) + per-world contact sheets
"""
import hashlib, json, sys, time
from pathlib import Path
import torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline

tag = sys.argv[1] if len(sys.argv) > 1 else "v1"
roster = json.loads(Path(sys.argv[2] if len(sys.argv) > 2 else "roster.json").read_text())["monsters"]
want = sys.argv[3] if len(sys.argv) > 3 else "all"; ids = None if want == "all" else set(want.split(","))
SEEDS = [int(s) for s in (sys.argv[4] if len(sys.argv) > 4 else "5741102,5741103,5741104").split(",")]
ROOT = Path("/workspace/ki-legends-gpu"); OUT = ROOT / "renders" / ("enemies-cand-%s" % tag); OUT.mkdir(parents=True, exist_ok=True)
BASE = ("no humans, monster, creature, solo, full body, game enemy design, anime fantasy, clean lineart, beautifully painted, three quarter view from above, "
        "isolated on pure white background, simple background, masterpiece, best quality, very aesthetic")
NEG = ("human, person, girl, boy, text, multiple creatures, scenery, landscape, ground shadow, cropped, out of frame, lowres, worst quality, low quality, blurry, watermark, nsfw")
pipe = StableDiffusionXLPipeline.from_single_file(str(ROOT / "models/checkpoints/animagine-xl-3.1.safetensors"), torch_dtype=torch.float16).to("cuda")
meta = []; t0 = time.time()
for m in roster:
    if ids and m["id"] not in ids: continue
    for seed in SEEDS:
        fly = ", flying in the air" if m["archetype"] in ("fly", "hover") else ", standing on the ground"
        img = pipe(prompt="%s%s, %s, %s" % (m["design"], fly, m["palette"], BASE), negative_prompt=NEG, num_inference_steps=28, guidance_scale=6.0, width=1024, height=1024,
                   generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        fn = "%s-s%d.png" % (m["id"], seed); img.save(OUT / fn); meta.append({"id": m["id"], "seed": seed, "file": fn, "sha256": hashlib.sha256((OUT / fn).read_bytes()).hexdigest()}); print(fn, flush=True)
for world in ("verdant", "aether", "nexus", "pyra"):
    ms = [m for m in roster if m["world"] == world and (not ids or m["id"] in ids)]
    if not ms: continue
    c = 200; sh = Image.new("RGB", (len(ms) * c, len(SEEDS) * c), "white")
    for i, m in enumerate(ms):
        for j, sd in enumerate(SEEDS): sh.paste(Image.open(OUT / ("%s-s%d.png" % (m["id"], sd))).resize((c, c), Image.LANCZOS), (i * c, j * c))
    sh.save(OUT / ("sheet-%s.jpg" % world), quality=86)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1)); print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
