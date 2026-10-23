"""City parts for the Pyra fortress "Twierdza Popiolu" (owner mockup 2026-10-23: dark timber and stone fortress, red flame banners).

  python3 gen_city_parts.py <tag> <dream|anime> [seeds comma list] [name filter]
    -> /workspace/ki-legends-gpu/renders/city-pyra-<tag>-<model>/{obj,tex}-<name>-s<seed>.png (1024) + sheet-obj.jpg + sheet-tex.jpg
Buildings are single isolated pieces on white (matted later); textures are seamless. Samples for owner review,
not installed in the game.
"""
import hashlib, json, shutil, sys, time
from pathlib import Path
import torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline

tag, model = sys.argv[1], sys.argv[2]
SEEDS = [int(s) for s in (sys.argv[3] if len(sys.argv) > 3 else "7480101,7480102,7480103,7480104").split(",")]
ONLY = sys.argv[4] if len(sys.argv) > 4 else ""
ROOT = Path("/workspace/ki-legends-gpu")
OUT = ROOT / "renders" / ("city-pyra-%s-%s" % (tag, model)); OUT.mkdir(parents=True, exist_ok=True)
LOCAL = Path("/tmp/city-pyra-%s-%s" % (tag, model)); LOCAL.mkdir(parents=True, exist_ok=True)
OSTYLE = ("single building, high angle three quarter view, hand painted anime fantasy game asset, very thick black outlines, cel shaded, rich painted detail, "
          "dark timber and grey stone, curved dark tile roof, red flame banners, warm glowing lantern windows, isolated on pure white background, plain white background, "
          "centered, full object visible, wide white margin, no ground, no shadow, no text, masterpiece, best quality")
ONEG = ("multiple buildings, village, scene, landscape, sky, ground, character, person, text, letters, watermark, frame, cropped, blurry, low quality, photo, "
        "photorealistic, 3d render, flat vector, thin lines")
OBJ = {
    "hall-council": "a large two story council hall with a wide stair, red banners and a stone base",
    "market-stall": "a covered market building with open front, hanging goods, crates and a striped red awning",
    "inn-tavern": "a two story tavern with a hanging beer mug sign, warm lit windows and a wooden balcony",
    "smithy-forge": "a blacksmith forge building with a big chimney with smoke, glowing furnace opening and an anvil by the door",
    "depot-warehouse": "a stone warehouse with big wooden double doors, stacked crates and barrels at the side",
    "arena-dojo": "a training hall dojo with wide open front, weapon racks and a round sparring ring in front",
    "gate-fortress": "a huge fortress gate with two watchtowers, large wooden doors and red banners",
    "wall-segment": "a straight section of dark stone fortress wall with a wooden walkway and small banners",
    "tower-watch": "a tall stone watchtower with a tiled roof and a brazier on top",
    "fountain-fire": "a round stone fire pit plaza centerpiece with a big burning flame and carved stone ring",
    "house-small": "a small dark timber house with a dark tile roof and a red door",
    "bridge-stone": "a short arched stone bridge with railings seen from a high angle",
    "tree-maple-red": "a red maple tree with a twisted dark trunk and dense red leaves",
    "tree-pine-dark": "a dark green pine tree with layered branches",
    "rocks-cluster": "a cluster of dark volcanic rocks with a few glowing orange cracks",
    "banner-pole": "a tall wooden pole with a large red flame banner",
    "lantern-stone": "a tall stone lantern with a warm glowing flame",
    "steps-stone": "a wide stone staircase going up, seen from a high angle",
}
TSTYLE = ("seamless tileable game texture, flat top-down view, hand painted anime fantasy environment art, thick dark outlines, warm lit, clean painted surface, "
          "no perspective, no objects, no characters, no text, full frame uniform pattern")
TNEG = "perspective, 3d render, photo, vignette, border, frame, single large object, person, character, text, logo, watermark, blurry, low quality"
TEX = {
    "road-cobble": "warm grey cobblestone road with dark mortar, regular rounded stones",
    "plaza-flagstone": "large warm sandstone plaza flagstones with dark joints and a faint red tint",
    "ground-ash": "dark grey ash and cinder ground with small stones and faint ember specks",
    "ground-volcanic-rock": "dark volcanic rock ground with thin glowing orange cracks",
}
ckpt = ROOT / "models/checkpoints" / ("DreamShaperXL_Turbo_v2_1.safetensors" if model == "dream" else "animagine-xl-3.1.safetensors")
pipe = StableDiffusionXLPipeline.from_single_file(str(ckpt), torch_dtype=torch.float16).to("cuda")
convs = [m for m in list(pipe.unet.modules()) + list(pipe.vae.modules()) if isinstance(m, torch.nn.Conv2d)]
steps, cfg = (8, 2.5) if model == "dream" else (24, 6.5)
pre = "" if model == "dream" else "no humans, "
meta = {"tag": tag, "model": model, "objects": [], "textures": []}
t0 = time.time()
for kind, key, table, style, neg, tiled in (("obj", "objects", OBJ, OSTYLE, ONEG, False), ("tex", "textures", TEX, TSTYLE, TNEG, True)):
    for m in convs:
        m.padding_mode = "circular" if tiled else "zeros"
    for name, desc in table.items():
        if ONLY and ONLY not in name:
            continue
        for seed in SEEDS:
            img = pipe(prompt=pre + desc + ", " + style, negative_prompt=neg, num_inference_steps=steps, guidance_scale=cfg, width=1024, height=1024,
                       generator=torch.Generator("cuda").manual_seed(seed)).images[0]
            fn = "%s-%s-s%d.png" % (kind, name, seed)
            tmp = LOCAL / fn; img.save(tmp)
            for _ in range(5):
                shutil.copyfile(tmp, OUT / fn)
                try:
                    Image.open(OUT / fn).load(); break
                except OSError:
                    time.sleep(1)
            meta[key].append({"file": fn, "name": name, "seed": seed, "prompt": desc, "sha256": hashlib.sha256(tmp.read_bytes()).hexdigest()})
            print(fn, round(time.time() - t0), "s", flush=True)
    names = sorted({r["name"] for r in meta[key]})
    if names:
        c = 200
        sh = Image.new("RGB", (len(SEEDS) * c, len(names) * c), "white")
        for i, n in enumerate(names):
            for j, sd in enumerate(SEEDS):
                p = LOCAL / ("%s-%s-s%d.png" % (kind, n, sd))
                if p.exists():
                    sh.paste(Image.open(p).resize((c, c), Image.LANCZOS), (j * c, i * c))
        sh.save(OUT / ("sheet-%s.jpg" % kind), quality=86)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
