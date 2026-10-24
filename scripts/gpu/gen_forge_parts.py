"""Vertical slice: parts for the Pyra smithy "Kuznia Zaru" (owner mockup 2026-10-23).

  python3 gen_forge_parts.py <tag> [seeds comma list] [name filter]
    -> /workspace/ki-legends-gpu/renders/forge-parts-<tag>/{obj,tex}-<name>-s<seed>.png (1024)
       + sheet-obj.jpg / sheet-tex.jpg + metadata.json

Objects are single props on pure white (matted later), textures are seamless (circular padding).
Style from the mockup: high-angle three-quarter view, thick dark outline, hand painted anime game asset,
dark wood + warm stone, warm firelight. Samples for owner review, not installed in the game.
"""
import hashlib, json, shutil, sys, time
from pathlib import Path
import torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline

tag = sys.argv[1] if len(sys.argv) > 1 else "f1"
SEEDS = [int(s) for s in (sys.argv[2] if len(sys.argv) > 2 else "7410101,7410102,7410103").split(",")]
ONLY = sys.argv[3] if len(sys.argv) > 3 else ""
ROOT = Path("/workspace/ki-legends-gpu")
OUT = ROOT / "renders" / ("forge-parts-%s" % tag)
OUT.mkdir(parents=True, exist_ok=True)
LOCAL = Path("/tmp/forge-parts-%s" % tag)
LOCAL.mkdir(parents=True, exist_ok=True)

OSTYLE = ("single game prop, high angle three quarter view, hand painted anime fantasy game asset, thick dark outlines, rich detailed painted shading, "
          "warm firelight from one side, dark brown wood and warm grey stone, isolated on pure white background, plain white background, "
          "centered, full object visible, wide white margin, no ground, no shadow, no text, masterpiece, best quality")
ONEG = ("multiple objects, scene, room, interior background, floor, wall behind, character, person, text, letters, watermark, frame, cropped, "
        "blurry, low quality, photo, photorealistic, 3d render, flat vector")
OBJ = {
    "anvil-stump": "a heavy black iron blacksmith anvil standing on a thick wooden stump with a hammer leaning against it",
    "furnace-fire": "a big stone brick forge furnace with a chimney, a wide arched opening full of glowing orange coals and bright flames, iron chains hanging",
    "chest-iron": "a sturdy wooden treasure chest with brass corners, iron bands and a lock",
    "workbench-tools": "a wooden blacksmith workbench covered with tools, small anvils, metal ingots and a candle",
    "weapon-rack": "a wooden weapon rack holding swords, axes and spears",
    "shelf-ingots": "a tall wooden shelf with iron ingots, tools and small jars",
    "barrels": "a group of three dark wooden barrels with iron hoops, one with a lid",
    "crates-stack": "a stack of wooden crates with iron bands and a coil of rope",
    "lantern-post": "a standing iron lantern post with a warm glowing paper lantern",
    "banner-flame": "a hanging red cloth banner with a black flame emblem on a wooden pole, torn ends",
    "grindstone": "a wooden grindstone wheel on a stand with a foot pedal and water bucket",
    "coal-bin": "a wooden bin full of black coal with a shovel",
    "stairs-wood": "a short wooden staircase with a wooden railing, dark planks",
    "door-arch": "a dark wooden double door in a stone arch frame with iron hinges and two lanterns, front view",
    "sign-hanging": "a hanging wooden shop sign on two chains with a blank carved anvil emblem",
}
TSTYLE = ("seamless tileable game texture, flat top-down view, hand painted anime fantasy environment art, thick dark outlines, "
          "warm lit, clean painted surface, no perspective, no objects, no characters, no text, full frame uniform pattern")
TNEG = ("perspective, 3d render, photo, vignette, border, frame, single large object, person, character, text, logo, watermark, blurry, low quality")
TEX = {
    "floor-flagstone": "warm sandstone flagstone floor with rectangular stone slabs, dark mortar lines, subtle wear, warm amber light",
    "floor-planks": "dark brown wooden plank floor with nails and wear",
    "wall-timber-stone": "stone brick wall with dark timber beams and warm lantern glow, front view",
    "wall-dark-wood": "dark brown vertical wooden plank wall with iron nails, front view",
}

pipe = StableDiffusionXLPipeline.from_single_file(
    str(ROOT / "models/checkpoints/DreamShaperXL_Turbo_v2_1.safetensors"), torch_dtype=torch.float16).to("cuda")
convs = [m for m in list(pipe.unet.modules()) + list(pipe.vae.modules()) if isinstance(m, torch.nn.Conv2d)]


def circular(on):
    for m in convs:
        m.padding_mode = "circular" if on else "zeros"


def save_verified(img, name):
    tmp = LOCAL / name
    img.save(tmp)
    for _ in range(5):
        shutil.copyfile(tmp, OUT / name)
        try:
            Image.open(OUT / name).load()
            return
        except OSError:
            time.sleep(1)
    raise SystemExit("cannot write %s" % name)


meta = {"tag": tag, "objects": [], "textures": []}
t0 = time.time()
for kind, key, table, style, neg, tiled in (("obj", "objects", OBJ, OSTYLE, ONEG, False), ("tex", "textures", TEX, TSTYLE, TNEG, True)):
    circular(tiled)
    for name, desc in table.items():
        if ONLY and ONLY not in name:
            continue
        for seed in SEEDS:
            img = pipe(prompt=desc + ", " + style, negative_prompt=neg, num_inference_steps=8, guidance_scale=2.5, width=1024,
                       height=1024, generator=torch.Generator("cuda").manual_seed(seed)).images[0]
            fn = "%s-%s-s%d.png" % (kind, name, seed)
            save_verified(img, fn)
            meta[key].append({"file": fn, "name": name, "seed": seed, "prompt": desc,
                              "sha256": hashlib.sha256((LOCAL / fn).read_bytes()).hexdigest()})
            print(fn, round(time.time() - t0), "s", flush=True)
    names = sorted({r["name"] for r in meta[key]})
    if names:
        c, cols = 256, len(SEEDS)
        sh = Image.new("RGB", (cols * c, len(names) * c), "white")
        for i, n in enumerate(names):
            for j, sd in enumerate(SEEDS):
                p = LOCAL / ("%s-%s-s%d.png" % (kind, n, sd))
                if p.exists():
                    sh.paste(Image.open(p).resize((c, c), Image.LANCZOS), (j * c, i * c))
        sh.save(OUT / ("sheet-%s.jpg" % kind), quality=86)
        shutil.copyfile(OUT / ("sheet-%s.jpg" % kind), LOCAL / ("sheet-%s.jpg" % kind))
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
