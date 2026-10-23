"""Smithy parts, second pass: more parts, stronger drawn outlines, two models to compare.

  python3 gen_forge_parts2.py <tag> <dream|anime> [seeds comma list] [name filter]
    -> /workspace/ki-legends-gpu/renders/forge-parts-<tag>-<model>/obj-<name>-s<seed>.png (1024) + sheet-obj.jpg + metadata.json
dream = DreamShaper XL Turbo (8 steps); anime = Animagine XL 3.1 (24 steps, booru-style prompt).
Samples for owner review, not installed in the game.
"""
import hashlib, json, shutil, sys, time
from pathlib import Path
import torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline

tag, model = sys.argv[1], sys.argv[2]
SEEDS = [int(s) for s in (sys.argv[3] if len(sys.argv) > 3 else "7420101,7420102,7420103").split(",")]
ONLY = sys.argv[4] if len(sys.argv) > 4 else ""
ROOT = Path("/workspace/ki-legends-gpu")
OUT = ROOT / "renders" / ("forge-parts-%s-%s" % (tag, model))
OUT.mkdir(parents=True, exist_ok=True)
LOCAL = Path("/tmp/forge-parts-%s-%s" % (tag, model))
LOCAL.mkdir(parents=True, exist_ok=True)

STYLE = ("single game prop, high angle three quarter view, hand painted anime fantasy game asset, very thick black outlines, cel shaded, "
         "rich warm painted shading, orange firelight rim light, dark brown wood and warm grey stone, isolated on pure white background, "
         "plain white background, centered, full object visible, wide white margin, no ground, no shadow, no text, masterpiece, best quality")
NEG = ("multiple objects, scene, room, interior background, floor, wall behind, character, person, text, letters, watermark, frame, cropped, "
       "blurry, low quality, photo, photorealistic, 3d render, flat vector, thin lines")
OBJ = {
    "anvil-stump": "a heavy black iron blacksmith anvil on a thick wooden stump with a hammer leaning on it",
    "furnace-fire": "a big stone brick forge furnace with a tall chimney, wide arched opening full of glowing orange coals and bright flames, hanging iron chains",
    "chest-iron": "a sturdy wooden treasure chest with brass corners and iron bands",
    "workbench-tools": "a long wooden blacksmith workbench covered with tools, hammers, tongs, metal ingots and a candle",
    "weapon-rack": "a wooden weapon rack holding swords, axes and spears",
    "shelf-ingots": "a tall wooden shelf with iron ingots, tools and small jars",
    "barrels": "a group of three dark wooden barrels with iron hoops",
    "crates-stack": "a stack of wooden crates with iron bands and a coil of rope",
    "lantern-post": "a standing iron lantern post with a warm glowing lantern",
    "banner-flame": "a hanging red cloth banner with a black flame emblem, torn ends",
    "grindstone": "a wooden grindstone wheel on a stand with a water bucket",
    "coal-bin": "a wooden bin full of black coal with a shovel",
    "stairs-wood": "a wooden staircase with railing leading up to a wooden balcony",
    "door-arch": "a dark wooden double door in a stone arch with iron hinges and two hanging lanterns, front view",
    "sign-hanging": "a hanging wooden sign on two chains with a carved anvil emblem, blank board",
    "barrel-single": "a single dark wooden barrel with iron hoops and a lid",
    "crate-single": "a single wooden crate with iron corner bands",
    "sack-pile": "a pile of grain sacks tied with rope",
    "bellows": "a big leather forge bellows with wooden handles",
    "water-trough": "a stone water trough for quenching hot metal with a hot sword in it",
    "weapon-wall-rack": "a wall mounted wooden board with hanging swords, hammers and tongs, front view",
    "hanging-chandelier": "a round iron chandelier with many lit candles hanging on a chain",
    "rug-red": "a worn red rug with a black flame pattern, top-down view",
    "wall-window": "a small arched wooden window with iron bars and warm light, front view",
    "anvil-small": "a small iron anvil on a wooden block with metal tongs",
}
ckpt = ROOT / "models/checkpoints" / ("DreamShaperXL_Turbo_v2_1.safetensors" if model == "dream" else "animagine-xl-3.1.safetensors")
pipe = StableDiffusionXLPipeline.from_single_file(str(ckpt), torch_dtype=torch.float16).to("cuda")
steps, cfg = (8, 2.5) if model == "dream" else (24, 6.5)
pre = "" if model == "dream" else "no humans, "
meta = {"tag": tag, "model": model, "objects": []}
t0 = time.time()
for name, desc in OBJ.items():
    if ONLY and ONLY not in name:
        continue
    for seed in SEEDS:
        img = pipe(prompt=pre + desc + ", " + STYLE, negative_prompt=NEG, num_inference_steps=steps, guidance_scale=cfg, width=1024,
                   height=1024, generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        fn = "obj-%s-s%d.png" % (name, seed)
        tmp = LOCAL / fn
        img.save(tmp)
        for _ in range(5):
            shutil.copyfile(tmp, OUT / fn)
            try:
                Image.open(OUT / fn).load(); break
            except OSError:
                time.sleep(1)
        meta["objects"].append({"file": fn, "name": name, "seed": seed, "prompt": desc,
                                "sha256": hashlib.sha256(tmp.read_bytes()).hexdigest()})
        print(fn, round(time.time() - t0), "s", flush=True)
names = sorted({r["name"] for r in meta["objects"]})
c = 200
sh = Image.new("RGB", (len(SEEDS) * c * 1, len(names) * c), "white")
for i, n in enumerate(names):
    for j, sd in enumerate(SEEDS):
        p = LOCAL / ("obj-%s-s%d.png" % (n, sd))
        if p.exists():
            sh.paste(Image.open(p).resize((c, c), Image.LANCZOS), (j * c, i * c))
sh.save(OUT / "sheet-obj.jpg", quality=86)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
