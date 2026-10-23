"""Landscape + neutral fauna kit, sample batch P0 (docs/GPU-LANDSCAPE-AND-FAUNA-2026-10-23.md).

  python3 gen_landscape_v2.py <tag> [seeds comma list] [filter substring]
    -> /workspace/ki-legends-gpu/renders/landscape-v2-<tag>/{tex,spr,fau}-<name>-s<seed>.png (1024x1024)
       + contact sheets + metadata.json (SHA-256, seam error for textures)

DreamShaper XL Turbo (SDXL, pinned by SHA-256 on the volume). Textures use circular padding (seamless),
sprites and animal masters do not and are rendered on pure white for matting. These are samples for the
owner's visual review, not production assets and not installed in the game.
"""
import hashlib, json, sys, time
from pathlib import Path
import numpy as np, torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline

tag = sys.argv[1] if len(sys.argv) > 1 else "p0"
SEEDS = [int(s) for s in (sys.argv[2] if len(sys.argv) > 2 else "6110201,6110202").split(",")]
ONLY = sys.argv[3] if len(sys.argv) > 3 else ""
ROOT = Path("/workspace/ki-legends-gpu")
OUT = ROOT / "renders" / ("landscape-v2-%s" % tag)
OUT.mkdir(parents=True, exist_ok=True)

TSTYLE = ("seamless tileable game texture, flat top-down orthographic view, stylized hand painted anime fantasy game environment art, "
          "clean painted surface, even lighting, no perspective, no objects, no characters, no text, full frame uniform pattern, high quality")
TNEG = ("perspective, 3d render, vignette, border, frame, shadow gradient, single large object, person, character, creature, text, logo, watermark, blurry, low quality, cropped")
TEX = {
    # Verdantia
    "verdant-meadow-grass": "lush bright green meadow grass with clover and tiny white flowers",
    "verdant-forest-floor-pine": "forest floor covered with brown pine needles, small twigs and green moss patches",
    "verdant-riverbank-mud": "wet brown riverbank mud with pebbles and a few reed roots",
    "verdant-moss-stone": "mossy grey stones half buried in green moss and short grass",
    "verdant-farmland": "plowed dark brown farmland soil with neat furrows",
    # Aetheria
    "aether-snow-powder": "powdery white mountain snow with soft wind ripples and pale blue shadows",
    "aether-frozen-lake": "frozen lake surface, pale turquoise ice with white cracks and trapped bubbles",
    "aether-wet-stone-path": "wet pale stone shrine paving with thin green moss in the joints",
    "aether-cherry-petals": "dark soil covered with fallen pink cherry blossom petals and tiny grass",
    "aether-bamboo-floor": "bamboo grove floor with fallen yellow green bamboo leaves and short stems",
    # Nexus-9
    "nexus-steel-plate": "dark brushed steel floor plates with rivets and faint cyan light seams",
    "nexus-circuit-ground": "dark ground with glowing cyan circuit traces and small nodes",
    "nexus-desert-crust": "dry cracked tan desert crust with fine sand drifts",
    "nexus-salt-flat": "white salt flat with hexagonal cracked pattern and faint pink tint",
    "nexus-glass-sand": "shimmering sand mixed with tiny fused glass shards in teal and amber",
    # Pyra
    "pyra-red-canyon-rock": "red orange canyon rock surface with strata and fine cracks",
    "pyra-ash-fields": "grey volcanic ash fields with dark pebbles and faint wind streaks",
    "pyra-obsidian": "black glossy obsidian rock with deep blue reflections and sharp fracture lines",
    "pyra-sulfur-flat": "yellow sulfur crust ground with orange stains and tiny vents",
    "pyra-cracked-clay": "dry cracked red clay ground with deep fissures",
    # shared rocks
    "rock-granite": "grey granite rock surface with speckles and weathering",
    "rock-limestone-strata": "pale limestone with horizontal strata and small fossils",
    "rock-basalt": "dark grey basalt rock with fine pits and cracks",
    "rock-sandstone-layers": "warm sandstone layers in orange and cream bands",
    "rock-marble": "white marble with grey veins and polished look",
}
SSTYLE = ("single object, three quarter top-down view, stylized hand painted anime fantasy game asset, clean outlines, isolated on pure white background, "
          "plain white background, centered, full object visible, no ground shadow, no text, high quality")
SNEG = "multiple objects, scene, landscape background, sky, text, watermark, frame, cropped, blurry, low quality, people, characters"
SPR = {
    "mountain-granite-snow": "a huge rugged grey granite mountain with snow on the peaks and pine forest at the foot",
    "mountain-ice-spires": "a huge blue white glacier mountain with sharp ice spires and frozen waterfalls",
    "mountain-red-mesa": "a red orange sandstone mesa mountain with steep layered cliffs and a flat top",
    "volcano-active-smoking": "a large active volcano with a smoking crater and glowing lava streams on dark rock slopes",
    "volcano-caldera-lake": "a wide volcano caldera with a glowing lava lake inside and steep dark rim",
    "rock-arch": "a natural stone arch made of layered red rock",
    "sandstone-spires": "a cluster of tall thin sandstone spires and hoodoos",
    "boulder-field": "a field of large mossy grey boulders of different sizes",
    "basalt-cliff-ridge": "a long dark basalt cliff ridge with columnar rock faces",
    "pine-tree-tall": "a tall green pine tree with detailed needles",
    "bamboo-grove": "a dense bamboo grove with tall green stalks and leaves",
    "crystal-outcrop": "a cluster of glowing teal crystals growing from dark rock",
}
FSTYLE = ("single animal, full body visible, standing in side view facing right, stylized hand painted anime fantasy game creature art, clean outlines, "
          "isolated on pure white background, plain white background, centered, no ground shadow, no text, high quality")
FNEG = SNEG + ", aggressive, monster, fangs, blood, human"
FAU = {
    "deer-red": "a graceful red deer stag with antlers, calm and alert",
    "hare-field": "a brown field hare sitting upright with long ears",
    "crane-white": "a tall elegant white crane bird with long neck and legs, wings folded",
    "gazelle-salt": "a slender tan desert gazelle with curved horns",
    "ox-ash": "a large grey ash ox with heavy curved horns and dusty hide, peaceful",
    "koi-gold": "a large golden orange koi fish seen from above with flowing fins",
    "goat-lava": "a sturdy dark mountain goat with glowing orange horn tips, peaceful",
    "tortoise-stone": "a big stone tortoise with a mossy rocky shell, calm",
}

pipe = StableDiffusionXLPipeline.from_single_file(
    str(ROOT / "models/checkpoints/DreamShaperXL_Turbo_v2_1.safetensors"), torch_dtype=torch.float16).to("cuda")
convs = [m for m in list(pipe.unet.modules()) + list(pipe.vae.modules()) if isinstance(m, torch.nn.Conv2d)]


def circular(on):
    for m in convs:
        m.padding_mode = "circular" if on else "zeros"


def seam(img):
    a = np.asarray(img.convert("RGB"), dtype=np.float32)
    return round(float((np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0] - a[-1]).mean()) / 2), 2)


meta = {"tag": tag, "model": "DreamShaperXL_Turbo_v2_1", "textures": [], "sprites": [], "fauna": []}
t0 = time.time()


def run(kind, key, table, style, neg, tiled):
    circular(tiled)
    for name, desc in table.items():
        if ONLY and ONLY not in name:
            continue
        for seed in SEEDS:
            img = pipe(prompt=desc + ", " + style, negative_prompt=neg, num_inference_steps=8, guidance_scale=2.5,
                       width=1024, height=1024, generator=torch.Generator("cuda").manual_seed(seed)).images[0]
            fn = "%s-%s-s%d.png" % (kind, name, seed)
            img.save(OUT / fn)
            row = {"file": fn, "name": name, "seed": seed, "prompt": desc,
                   "sha256": hashlib.sha256((OUT / fn).read_bytes()).hexdigest()}
            if tiled:
                row["seam_error"] = seam(img)
            meta[key].append(row)
            print(fn, flush=True)


run("tex", "textures", TEX, TSTYLE, TNEG, True)
run("spr", "sprites", SPR, SSTYLE, SNEG, False)
run("fau", "fauna", FAU, FSTYLE, FNEG, False)
for kind, key, cols in (("tex", "textures", 6), ("spr", "sprites", 6), ("fau", "fauna", 4)):
    names = sorted({r["name"] for r in meta[key]})
    if not names:
        continue
    c = 220
    rows = (len(names) + cols - 1) // cols
    for sd in SEEDS[:1]:
        sh = Image.new("RGB", (cols * c, rows * c), "white")
        for i, n in enumerate(names):
            p = OUT / ("%s-%s-s%d.png" % (kind, n, sd))
            if p.exists():
                sh.paste(Image.open(p).resize((c, c), Image.LANCZOS), ((i % cols) * c, (i // cols) * c))
        sh.save(OUT / ("sheet-%s-%d.jpg" % (kind, sd)), quality=86)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE:", OUT, round(time.time() - t0), "s", flush=True)
