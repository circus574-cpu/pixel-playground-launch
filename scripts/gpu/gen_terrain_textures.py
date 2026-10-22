"""Seamless anime-fantasy terrain textures for the three new continents (ground, path, plaza, wall).
Circular convolution padding in UNet and VAE makes every output tile on all four edges.
  python3 gen_terrain_textures.py [tag] [seeds comma list]      -> renders/terrain-<tag>/<world>-<name>-s<seed>.png (1024x1024)
Verdantia keeps the accepted forest atlas and is intentionally not generated here.
"""
import hashlib, json, sys, time
from pathlib import Path
import numpy as np, torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline

tag = sys.argv[1] if len(sys.argv) > 1 else "v1"
SEEDS = [int(s) for s in (sys.argv[2] if len(sys.argv) > 2 else "5741102,5741103,5741104").split(",")]
CKPT = sys.argv[3] if len(sys.argv) > 3 else "animagine-xl-3.1.safetensors"
STEPS = int(sys.argv[4]) if len(sys.argv) > 4 else 30
GUIDE = float(sys.argv[5]) if len(sys.argv) > 5 else 5.5
CIRC = sys.argv[6] if len(sys.argv) > 6 else "both"  # both | unet | none
ROOT = Path("/workspace/ki-legends-gpu"); OUT = ROOT / "renders" / ("terrain-%s" % tag); OUT.mkdir(parents=True, exist_ok=True)
STYLE = ("seamless tileable game texture, flat top-down orthographic view, stylized hand painted fantasy game environment art, clean painted surface, "
         "even lighting, no perspective, no objects, no characters, no text, full frame uniform pattern, high quality")
NEG = ("perspective, 3d render, vignette, border, frame, shadow gradient, strong lighting gradient, single large object, person, character, creature, "
       "text, logo, watermark, blurry, low quality, worst quality, tiles with visible seams, cropped")
TEX = {
 "aether-ground": "pale cream limestone terrace paving with fine soft emerald moss in the cracks and tiny golden flower specks, serene temple garden floor",
 "aether-path": "smooth pale limestone path slabs laid in a row with thin gold inlay lines and faint emerald edge tint, temple walkway",
 "aether-plaza": "cream white marble plaza floor with a repeating emerald and gold geometric inlay pattern, ornate sanctuary courtyard",
 "aether-wall": "pale carved stone wall blocks with gold ornament bands and emerald vine relief, sanctuary terrace wall, straight front view",
 "nexus-ground": "dark graphite metal floor plates with subtle electric blue circuit lines and tiny blue light dots, futuristic android city street",
 "nexus-path": "brushed silver metal walkway plates with thin glowing electric blue light strips along the seams, sci fi corridor floor",
 "nexus-plaza": "black glass and silver hexagonal floor tiles with repeating electric blue energy pattern, futuristic plaza",
 "nexus-wall": "graphite and silver sci fi wall panels with electric blue light seams and rivets, android city building wall, straight front view",
 "pyra-ground": "black volcanic basalt rock ground with fine red ash and faint glowing ember cracks, fortress highlands terrain",
 "pyra-path": "worn red sandstone path slabs with dark mortar lines and scattered ash, clan fortress road",
 "pyra-plaza": "carved black basalt and crimson tile floor with a repeating steel inlay pattern, arena courtyard",
 "pyra-wall": "dark basalt fortress wall blocks with steel bands and crimson accents, volcanic stronghold wall, straight front view",
}
pipe = StableDiffusionXLPipeline.from_single_file(str(ROOT / "models/checkpoints" / CKPT), torch_dtype=torch.float16).to("cuda")
mods = ([] if CIRC == "none" else list(pipe.unet.modules()) + (list(pipe.vae.modules()) if CIRC == "both" else []))
for m in mods:
    if isinstance(m, torch.nn.Conv2d): m.padding_mode = "circular"  # seamless on all edges
def seam_error(img):
    a = np.asarray(img.convert("RGB"), dtype=np.float32); h = np.abs(a[:, 0] - a[:, -1]).mean(); v = np.abs(a[0] - a[-1]).mean()
    inner = np.abs(a[:, 1:] - a[:, :-1]).mean(); return round(float((h + v) / 2), 2), round(float(inner), 2)
meta = {"tag": tag, "style": STYLE, "negative": NEG, "textures": []}; t0 = time.time()
for name, desc in TEX.items():
    for seed in SEEDS:
        img = pipe(prompt=desc + ", " + STYLE, negative_prompt=NEG, num_inference_steps=STEPS, guidance_scale=GUIDE, width=1024, height=1024, generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        fn = "%s-s%d.png" % (name, seed); img.save(OUT / fn); sha = hashlib.sha256((OUT / fn).read_bytes()).hexdigest(); se, inner = seam_error(img)
        meta["textures"].append({"file": fn, "name": name, "seed": seed, "sha256": sha, "seam_error": se, "neighbour_pixel_error": inner}); print(fn, sha[:12], "seam", se, "neighbour", inner, flush=True)
# review sheets: 2x2 tiling of the first seed of each texture exposes seams
sheet = Image.new("RGB", (4 * 512, 3 * 512), "white")
for i, name in enumerate(TEX):
    t = Image.open(OUT / ("%s-s%d.png" % (name, SEEDS[0]))).resize((256, 256), Image.LANCZOS); tile = Image.new("RGB", (512, 512))
    for dx in (0, 256):
        for dy in (0, 256): tile.paste(t, (dx, dy))
    sheet.paste(tile, ((i % 4) * 512, (i // 4) * 512))
sheet.save(OUT / "tiling-sheet.jpg", quality=88)
for s_i, seed in enumerate(SEEDS):
    cs = Image.new("RGB", (4 * 256, 3 * 256), "white")
    for i, name in enumerate(TEX): cs.paste(Image.open(OUT / ("%s-s%d.png" % (name, seed))).resize((256, 256), Image.LANCZOS), ((i % 4) * 256, (i // 4) * 256))
    cs.save(OUT / ("contact-seed-%d.jpg" % seed), quality=88)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1)); print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
