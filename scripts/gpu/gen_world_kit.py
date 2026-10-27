"""World kit: city sets for the other three races and object sets for every biome (placeable, isolated on white).

  python3 gen_world_kit.py <tag> <dream|anime> <set> [seeds comma list]
    sets: city-aether|nexus|verdant, biome-forest|snow|desert|volcanic|coast|swamp|mountain|jungle|lava|ocean|glacier, ruins-props, dungeon, interior-pyra|aether|nexus|verdant, fauna-neutral,
          houses-<race> (A2: 6 dwelling variants), rooms-<race> (A5: 6 interior room backgrounds, 1536x960), race = pyra|aether|nexus|verdant
    -> /workspace/ki-legends-gpu/renders/kit-<set>-<tag>-<model>/obj-<name>-s<seed>.png (1024) + sheet.jpg + metadata.json
Same look as the Pyra city parts: high angle three quarter view, thick dark outlines, cel shaded, warm light.
Samples for owner review and for the matting/packing step, not installed in the game.
"""
import hashlib, json, os, shutil, sys, time
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
BIOME.update({
    "biome-swamp": ["a twisted mangrove tree", "a dead swamp tree with hanging moss", "a cluster of lily pads on water", "a cluster of cattails", "a mossy fallen log",
                    "a murky pond rim", "a small swamp hut on stilts", "a cluster of glowing mushrooms", "a bog boulder", "a tree with hanging vines",
                    "a wooden walkway section", "a skull on a pole"],
    "biome-mountain": ["a tall rocky mountain peak", "a cliff outcrop", "a boulder pile", "a mountain pine tree", "a rope bridge section", "a mine entrance",
                       "an ore vein rock", "a stone cairn", "a rock with a small waterfall", "a stone staircase on a slope", "a snowy rock ledge", "a large bird nest on a rock"],
    "biome-jungle": ["a giant jungle tree", "a palm cluster", "a large fern", "a tree with hanging vines", "a ruined jungle pillar", "a mossy idol statue",
                     "a flowering vine bush", "a bamboo cluster", "a rope bridge section", "a treehouse", "a giant leaf plant", "an overgrown stone altar"],
    "dungeon": ["a cave wall chunk", "a stalagmite cluster", "a glowing crystal cluster", "a stone doorway", "a torch on a stand", "a bone pile", "a treasure chest",
                "a floor spike trap", "a cracked stone pillar", "a stone sarcophagus", "a rock with glowing lava cracks", "an iron prison cage"],
})
BIOME.update({
    "biome-lava": ["a lava waterfall pouring from a black cliff", "a glowing lava river bend with dark banks", "a lava lake rim with bubbling magma",
                   "a cooling lava flow with glowing cracks", "an erupting lava vent with sparks", "a black obsidian spire with lava veins",
                   "a crumbling basalt bridge over lava", "a lava stepping stone path", "a burnt tree trunk glowing with embers",
                   "a magma geyser erupting", "a lava rock arch", "a volcanic crater rim with smoke"],
    "biome-ocean": ["a sea rock with crashing waves and foam", "a tall coastal sea stack with birds", "a coral reef cluster in shallow water",
                    "a sandy islet with two palm trees", "a shipwreck half in the water", "a whirlpool in deep blue water",
                    "a rocky reef with tide pools", "a floating driftwood raft", "a sea arch rock formation", "a stone lighthouse on a rock",
                    "a giant clam with a pearl", "a kelp forest patch seen from above"],
    "biome-glacier": ["a huge glacier ice wall with blue crevasses", "a floating iceberg", "a frozen waterfall", "a tall blue ice spire cluster",
                      "an ice cave entrance", "a snow covered ice ridge", "a cracked frozen lake section", "an ice arch",
                      "a glacier crevasse with a snow bridge", "giant icicles hanging from a rock", "a frozen mammoth skeleton in ice", "an ice crystal formation glowing blue"],
})
HUD = {"panel": "an ornate empty rectangular ui panel frame with a hollow plain center",
       "orb": "an ornate round ui orb frame socket with an empty hollow center",
       "slot": "an ornate square ui skill slot frame with an empty hollow center",
       "bar": "a long horizontal ornate ui status bar frame with an empty hollow inside",
       "button": "an ornate rounded ui button plate without text",
       "ring": "an ornate circular minimap ring frame with an empty hollow center",
       "corner": "an ornate ui corner decoration piece",
       "divider": "an ornate horizontal ui divider ornament"}
HUDSTYLE = {"neutral": "dark iron and gold filigree", "aether": "white jade and gold with lotus motifs",
            "nexus": "brushed steel with cyan glowing circuit lines", "pyra": "black iron with red flame motifs and embers",
            "verdant": "carved wood with green leaves and vines"}
FX = {"orb": "a glowing energy ball projectile with a bright core",
      "comet": "a glowing energy projectile flying to the right with a long tapering tail",
      "beam": "a straight horizontal energy beam blast",
      "impact": "a radial energy impact burst explosion",
      "ring": "a round expanding energy shockwave ring seen from above",
      "aura": "a tall vertical flame aura shape rising upward, empty in the middle, no character inside",
      "sparks": "a burst of small energy sparks and particles",
      "charge": "swirling energy particles converging into a bright point"}
FXSTYLE = {"planetary": "green and orange nature energy with leaves", "sage": "golden white holy light energy",
           "android": "cyan blue plasma electric energy", "legend": "crimson red and orange fire energy"}
FURN = ["a long wooden table with benches", "a counter with a shelf", "a bed with blankets", "a tall bookshelf", "a group of barrels", "a stack of crates",
        "a hanging lantern cluster", "a woven rug seen from above", "a cooking pot over a fire", "a weapon stand", "a locked chest", "a potion shelf"]
FAUNA = ["a red deer", "a field hare", "a mountain goat", "a woolly sheep", "a heavy ox", "a white crane", "a desert gazelle", "a red fox", "a stone tortoise",
         "a wild duck", "a sturdy pony", "a wild boar piglet"]
HOUSES = ["a small one story cottage with a porch", "a two story family house with a balcony", "a narrow tall townhouse",
          "a house with a small shop front on the ground floor", "a house with a walled garden and a gate", "a long row house with three doors"]
ROOMS = {"hall": "a council hall interior with a raised dais, long carpet and pillars", "shop": "a shop interior with counters, shelves and goods",
         "arena": "a training hall interior with a sparring floor, weapon racks and practice dummies", "smithy": "a blacksmith workshop interior with an anvil, forge and tools",
         "depot": "a storage warehouse interior with crates, barrels and a deposit chest", "inn": "a tavern interior with tables, a bar counter and a fireplace"}
W = H = 1024
if setname.startswith("fx-"):
    st = FXSTYLE[setname.split("-", 1)[1]]
    items = {k: "%s, %s" % (v, st) for k, v in FX.items()}
    COMMON = ("game vfx sprite, anime style energy effect, glowing, luminous, high contrast, isolated on pure black background, centered, "
              "wide black margin, no character, no text, masterpiece, best quality")
    NEG = "character, person, hand, body, text, watermark, frame, white background, ground, scenery, blurry, low quality"
elif setname.startswith("hud-"):
    st = HUDSTYLE[setname.split("-", 1)[1]]
    items = {k: "%s, %s, fantasy rpg game interface element, flat front view" % (v, st) for k, v in HUD.items()}
    COMMON = ("game ui asset, hand painted anime fantasy rpg interface art, clean thick dark outline, cel shaded, crisp detail, symmetrical, "
              "isolated on pure white background, centered, wide white margin, no text, no letters, masterpiece, best quality")
elif setname.startswith(("houses-", "rooms-")):
    race = setname.split("-", 1)[1]
    style = dict(CITY, **{"city-pyra": "dark timber and grey stone, red flame banners, warm lantern light"})["city-" + race]
    if setname.startswith("houses-"):
        items = {d.replace("a ", "", 1).replace(" ", "-")[:40]: "%s, %s" % (d, style) for d in HOUSES}
    else:
        RSTYLE = {"aether": "white marble walls with jade green and gold trim, paper sliding screens, tatami and polished wood floor, calligraphy scrolls, bonsai pots",
                  "nexus": "brushed steel walls, cyan glowing light strips, holographic screens, metal floor panels, sleek futuristic furniture",
                  "pyra": "dark timber beams and grey stone walls, red flame banners, glowing braziers, warm lantern light, iron fittings",
                  "verdant": "warm timber walls and stone floor, mossy green accents, flower pots, hanging lanterns, cozy forest village furniture"}[race]
        items = {k: "%s, %s" % (v, RSTYLE) for k, v in ROOMS.items() if k in os.environ.get("ROOMS", ",".join(ROOMS)).split(",")}
        W, H = 1536, 960
        COMMON = ("indoors, scenery, no humans, cozy rpg game interior room seen from a high angle three quarter view, the whole room visible, "
                  "spacious open walkable floor in the middle, large clearly readable furniture along the walls, hand painted anime illustration, "
                  "clean thick dark outlines, cel shading, vibrant colors, detailed, warm lighting, masterpiece, best quality, very aesthetic")
        NEG = ("1girl, 1boy, character, person, people, text, letters, watermark, frame, cropped, blurry, low quality, worst quality, photo, photorealistic, 3d render, "
               "outdoors, sky, tree, trees, cherry blossom, water, close up, fisheye, cluttered, messy, tiny objects")
elif setname.startswith("interior-"):
    race = setname.split("-", 1)[1]
    style = dict(CITY, **{"city-pyra": "dark timber and grey stone, red flame banners, warm lantern light"})["city-" + race]
    items = {d.replace("a ", "", 1).replace(" ", "-")[:40]: "%s, %s" % (d, style) for d in FURN}
elif setname == "fauna-neutral":
    items = {d.replace("a ", "", 1).replace(" ", "-")[:40]: d + ", calm and peaceful" for d in FAUNA}
    COMMON = ("single animal, full body, side view facing right, hand painted anime fantasy game creature, very thick black outlines, cel shaded, "
              "isolated on pure white background, plain white background, centered, wide white margin, no ground, no shadow, no text, masterpiece, best quality")
elif setname in CITY:
    items = {k: "%s, %s" % (v, CITY[setname]) for k, v in BUILD.items()}
elif setname in BIOME:
    items = {d.replace("a ", "", 1).replace(" ", "-")[:40]: d for d in BIOME[setname]}
ckpt = ROOT / "models/checkpoints" / ("DreamShaperXL_Turbo_v2_1.safetensors" if model == "dream" else "animagine-xl-3.1.safetensors")
pipe = StableDiffusionXLPipeline.from_single_file(str(ckpt), torch_dtype=torch.float16).to("cuda")
steps, cfg = (8, 2.5) if model == "dream" else (24, 6.5)
pre = "" if model == "dream" else "no humans, "
meta = {"set": setname, "model": model, "objects": []}
t0 = time.time()
for name, desc in items.items():
    for seed in SEEDS:
        fn = "obj-%s-s%d.png" % (name, seed)
        if (OUT / fn).exists():  # resumable after a pod change
            try:
                Image.open(OUT / fn).load(); shutil.copyfile(OUT / fn, LOCAL / fn); continue
            except OSError:
                pass
        img = pipe(prompt=pre + "single " + desc + ", " + COMMON, negative_prompt=NEG, num_inference_steps=steps, guidance_scale=cfg, width=W, height=H,
                   generator=torch.Generator("cuda").manual_seed(seed)).images[0]
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
            im = Image.open(p); im.thumbnail((c, c)); sh.paste(im, (j * c, i * c))
sh.save(OUT / "sheet.jpg", quality=86)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
