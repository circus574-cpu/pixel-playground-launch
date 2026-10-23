"""World kit: city sets for the other three races and object sets for every biome (placeable, isolated on white).

  python3 gen_world_kit.py <tag> <dream|anime> <set> [seeds comma list]
    sets: city-aether | city-nexus | city-verdant | biome-forest | biome-snow | biome-desert | biome-volcanic | biome-coast | ruins-props
    -> /workspace/ki-legends-gpu/renders/kit-<set>-<tag>-<model>/obj-<name>-s<seed>.png (1024) + sheet.jpg + metadata.json
Same look as the Pyra city parts: high angle three quarter view, thick dark outlines, cel shaded, warm light.
Samples for owner review and for the matting/packing step, not installed in the game.
"""
import hashlib, json, shutil, sys, time
from pathlib import Path
import torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline

tag, model, setname = sys.argv[1], sys.argv[2], sys.argv[3]
SEEDS = [int(s) for s in (sys.argv[4] if len(sys.argv) > 4 else "7510101,7510102,7510103,7510104").split(",")]
ROOT = Path("/workspace/ki-legends-gpu")
OUT = ROOT / "renders" / ("kit-%s-%s-%s" % (setname, tag, model)); OUT.mkdir(parents=True, exist_ok=True)
LOCAL = Path("/tmp/kit-%s-%s-%s" % (setname, tag, model)); LOCAL.mkdir(parents=True, exist_ok=True)
COMMON = ("high angle three quarter view, hand painted anime fantasy game asset, very thick black outlines, cel shaded, rich painted detail, "
          "isolated on pure white background, plain white background, centered, full object visible, wide white margin, no ground, no shadow, no text, "
          "masterpiece, best quality")
NEG = ("multiple objects, village, scene, landscape, sky, ground, character, person, text, letters, watermark, frame, cropped, blurry, low quality, photo, "
       "photorealistic, 3d render, flat vector, thin lines")
BUILD = {"hall": "a large two story council hall with a wide stair", "market": "a covered market building with open front and hanging goods",
         "inn": "a two story tavern with a hanging sign and a balcony", "smithy": "a blacksmith forge building with a chimney and glowing furnace",
         "depot": "a warehouse with big double doors and stacked crates", "arena": "a training hall with open front and weapon racks",
         "gate": "a huge city gate with two watchtowers", "wall": "a straight section of city wall with a walkway", "tower": "a tall watchtower",
         "house": "a small dwelling house", "bridge": "a short arched bridge with railings", "fountain": "a round plaza fountain centerpiece",
         "lamp": "a tall street lamp", "banner": "a tall banner pole with a large banner", "steps": "a wide staircase going up",
         "tree": "a large decorative tree typical of the city"}
CITY = {"city-aether": "white marble and pale jade, curved green glazed roofs with gold trim, flowing water, cherry blossom, serene shrine architecture",
        "city-nexus": "brushed steel and glass, cyan glowing light strips, round domes and antenna masts, clean futuristic android city architecture",
        "city-verdant": "warm timber and stone, mossy green shingle roofs, flower boxes, lanterns, cozy forest village architecture"}
BIOME = {
    "biome-forest": ["a tall broadleaf oak tree", "a tall pine tree", "a birch tree with white bark", "a mossy boulder", "a fallen mossy log", "a flowering bush",
                     "a cluster of mushrooms", "a small wooden hunter hut", "a campfire with logs", "a tall fern cluster", "a tree stump with an axe", "a wooden signpost"],
    "biome-snow": ["a snow covered pine tree", "a tall ice spire cluster", "a frozen waterfall cliff", "a snowy boulder", "an igloo style stone hut", "a frozen dead tree",
                   "a snow mound with a lantern", "a glacier ice block", "a snowy mountain peak", "an ice crystal cluster", "a wooden sled", "a snowy cabin"],
    "biome-desert": ["a tall saguaro cactus", "a sandstone arch", "sandstone spires", "a dry dead tree", "a nomad tent", "a sand dune with a bone", "a small oasis with palms",
                     "a salt crystal formation", "a rusted metal wreck", "a sun bleached skull and ribs", "a clay hut", "a stone obelisk"],
    "biome-volcanic": ["a smoking volcano", "a lava rock cluster with glowing cracks", "a basalt column cluster", "a dead charred tree", "an obsidian shard formation",
                       "a lava geyser vent", "a stone brazier with fire", "a ruined dark stone pillar", "a sulfur vent with yellow crust", "a magma pool rim", "a bone pile", "a dark rock bridge"],
    "biome-coast": ["a palm tree", "a rocky sea stack", "a wooden pier section", "a fishing boat", "a coral rock cluster", "a lighthouse", "a reed clump", "a driftwood log",
                    "a seashell cluster", "a small fishing hut", "a net drying rack", "a whale skeleton arch"],
    "ruins-props": ["a broken stone pillar", "an ancient stone gate ruin", "a toppled statue", "a ruined wall segment", "a stone altar with glowing runes", "a treasure chest",
                    "a wooden crate stack", "a barrel group", "a stone well", "a signpost with arrows", "a campfire with a tent", "a weapon rack"],
}
if setname in CITY:
    items = {k: "%s, %s" % (v, CITY[setname]) for k, v in BUILD.items()}
else:
    items = {d.replace("a ", "", 1).replace(" ", "-")[:40]: d for d in BIOME[setname]}
ckpt = ROOT / "models/checkpoints" / ("DreamShaperXL_Turbo_v2_1.safetensors" if model == "dream" else "animagine-xl-3.1.safetensors")
pipe = StableDiffusionXLPipeline.from_single_file(str(ckpt), torch_dtype=torch.float16).to("cuda")
steps, cfg = (8, 2.5) if model == "dream" else (24, 6.5)
pre = "" if model == "dream" else "no humans, "
meta = {"set": setname, "model": model, "objects": []}
t0 = time.time()
for name, desc in items.items():
    for seed in SEEDS:
        img = pipe(prompt=pre + "single " + desc + ", " + COMMON, negative_prompt=NEG, num_inference_steps=steps, guidance_scale=cfg, width=1024, height=1024,
                   generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        fn = "obj-%s-s%d.png" % (name, seed)
        tmp = LOCAL / fn; img.save(tmp)
        for _ in range(5):
            shutil.copyfile(tmp, OUT / fn)
            try:
                Image.open(OUT / fn).load(); break
            except OSError:
                time.sleep(1)
        meta["objects"].append({"file": fn, "name": name, "seed": seed, "prompt": desc, "sha256": hashlib.sha256(tmp.read_bytes()).hexdigest()})
        print(fn, round(time.time() - t0), "s", flush=True)
names = list(items)
c = 200
sh = Image.new("RGB", (len(SEEDS) * c, len(names) * c), "white")
for i, n in enumerate(names):
    for j, sd in enumerate(SEEDS):
        p = LOCAL / ("obj-%s-s%d.png" % (n, sd))
        if p.exists():
            sh.paste(Image.open(p).resize((c, c), Image.LANCZOS), (j * c, i * c))
sh.save(OUT / "sheet.jpg", quality=86)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
