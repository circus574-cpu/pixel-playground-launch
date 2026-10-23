"""Nature kit: seamless terrain textures (water, ocean, ice, lava, rock, ground) and isolated object sprites
(volcanoes, glaciers, icebergs, mountains, hills, cliffs, waterfall, trees, bushes, boulders) on pure white for matting.
  python3 gen_nature_assets.py [tag] [seeds comma list]   ->  renders/nature-<tag>/{tex,spr}-<name>-s<seed>.png (1024x1024) + contact sheets
DreamShaper XL Turbo (SDXL); textures use circular padding (seamless), sprites do not.
"""
import hashlib, json, sys, time
from pathlib import Path
import numpy as np, torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline

tag = sys.argv[1] if len(sys.argv) > 1 else "v1"
SEEDS = [int(s) for s in (sys.argv[2] if len(sys.argv) > 2 else "5741102,5741103,5741104").split(",")]
ROOT = Path("/workspace/ki-legends-gpu"); OUT = ROOT / "renders" / ("nature-%s" % tag); OUT.mkdir(parents=True, exist_ok=True)
TSTYLE = ("seamless tileable game texture, flat top-down orthographic view, stylized hand painted fantasy game environment art, clean painted surface, "
          "even lighting, no perspective, no objects, no characters, no text, full frame uniform pattern, high quality")
TNEG = ("perspective, 3d render, vignette, border, frame, shadow gradient, single large object, person, character, creature, text, logo, watermark, blurry, low quality, cropped")
TEX = {
 "water-ocean-deep": "deep blue ocean water surface with soft wave highlights and darker troughs",
 "water-ocean-shallow": "turquoise shallow sea water with pale sandy bottom visible and gentle ripples",
 "water-river": "clear teal river water surface with flowing ripples and light streaks",
 "water-lake-calm": "calm dark blue lake water with subtle reflections and tiny ripples",
 "water-crystal": "luminous pale emerald crystal spring water with golden sparkles and soft light caustics",
 "energy-liquid": "glowing electric blue liquid energy with flowing circuit-like light lines on dark glass",
 "ice-glacier": "blue white glacier ice surface with deep cracks and frozen bubbles",
 "snow": "fresh white snow ground with soft drifts and faint blue shadows",
 "sand-beach": "warm golden beach sand with fine wind ripples",
 "meadow-grass": "lush green meadow grass with tiny wildflowers",
 "forest-floor": "dark forest floor with fallen leaves, roots and moss",
 "cliff-rock": "grey rocky cliff face with horizontal strata and cracks",
 "lava-flow": "molten lava flow with glowing orange cracks and dark cooling crust",
 "lava-crust": "black cooling lava crust with red glowing veins",
 "ash-ground": "grey volcanic ash ground with small dark pebbles",
 "basalt-columns": "dark basalt hexagonal column tops seen from above",
}
SSTYLE = ("single object, three quarter top-down view, stylized hand painted fantasy game asset, clean outlines, isolated on pure white background, plain white background, "
          "centered, full object visible, no ground shadow, no text, high quality")
SNEG = "multiple objects, scene, landscape background, sky, text, watermark, frame, cropped, blurry, low quality, people, characters"
SPR = {
 "volcano-active": "a large active volcano with a smoking crater and glowing lava streams running down dark rock slopes",
 "volcano-dormant": "a dormant volcano mountain with a wide crater, rocky slopes and a little snow on the rim",
 "glacier-block": "a huge blue white glacier ice mass with sharp ice ridges and crevasses",
 "iceberg": "a floating iceberg with a pale blue underwater part and white top",
 "ice-spires": "a cluster of tall sharp ice crystal spires",
 "sea-stacks": "tall dark rock sea stacks rising from the water with white foam at the base",
 "waterfall": "a cliff with a tall waterfall falling into a misty pool",
 "lava-rocks": "a cluster of black volcanic rocks with glowing lava cracks",
 "basalt-columns": "a group of dark hexagonal basalt columns of different heights",
 "mountain-peak": "a rugged grey mountain peak with snow on the summit",
 "grassy-hill": "a rounded green grassy hill with a few rocks and flowers",
 "cliff-outcrop": "a rocky cliff outcrop with layered stone and moss on top",
 "pine-tree": "a tall green pine tree",
 "broadleaf-tree": "a large broadleaf tree with a thick trunk and full green crown",
 "crystal-tree": "a magical tree with pale trunk, golden leaves and glowing emerald crystals",
 "flower-bush": "a green bush with colorful flowers",
 "boulder-group": "a group of mossy grey boulders",
 "reed-clump": "a clump of tall water reeds and cattails",
 "small-island": "a small island with white sand beach, a few palm trees and rocks, surrounded by a ring of turquoise water",
}
pipe = StableDiffusionXLPipeline.from_single_file(str(ROOT / "models/checkpoints/DreamShaperXL_Turbo_v2_1.safetensors"), torch_dtype=torch.float16).to("cuda")
convs = [m for m in list(pipe.unet.modules()) + list(pipe.vae.modules()) if isinstance(m, torch.nn.Conv2d)]
def circular(on):
    for m in convs: m.padding_mode = "circular" if on else "zeros"
def seam(img):
    a = np.asarray(img.convert("RGB"), dtype=np.float32); return round(float((np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0] - a[-1]).mean()) / 2), 2)
meta = {"tag": tag, "textures": [], "sprites": []}; t0 = time.time()
circular(True)
for name, desc in TEX.items():
    for seed in SEEDS:
        img = pipe(prompt=desc + ", " + TSTYLE, negative_prompt=TNEG, num_inference_steps=8, guidance_scale=2.5, width=1024, height=1024, generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        fn = "tex-%s-s%d.png" % (name, seed); img.save(OUT / fn); meta["textures"].append({"file": fn, "name": name, "seed": seed, "sha256": hashlib.sha256((OUT / fn).read_bytes()).hexdigest(), "seam_error": seam(img)}); print(fn, flush=True)
circular(False)
for name, desc in SPR.items():
    for seed in SEEDS:
        img = pipe(prompt=desc + ", " + SSTYLE, negative_prompt=SNEG, num_inference_steps=8, guidance_scale=2.5, width=1024, height=1024, generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        fn = "spr-%s-s%d.png" % (name, seed); img.save(OUT / fn); meta["sprites"].append({"file": fn, "name": name, "seed": seed, "sha256": hashlib.sha256((OUT / fn).read_bytes()).hexdigest()}); print(fn, flush=True)
for kind, names, cols in (("tex", list(TEX), 8), ("spr", list(SPR), 10)):
    c = 150; rows = (len(names) + cols - 1) // cols
    for sd in SEEDS:
        sh = Image.new("RGB", (cols * c, rows * c), "white")
        for i, n in enumerate(names): sh.paste(Image.open(OUT / ("%s-%s-s%d.png" % (kind, n, sd))).resize((c, c), Image.LANCZOS), ((i % cols) * c, (i // cols) * c))
        sh.save(OUT / ("sheet-%s-%d.jpg" % (kind, sd)), quality=85)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1)); print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
