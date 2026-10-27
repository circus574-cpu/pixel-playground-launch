"""F1: skill tree icons, 4 races x 29 nodes (ids from src/game/kit/nodes.generated.ts).

  python3 gen_skill_icons.py <tag> [seeds comma list]
    -> /workspace/ki-legends-gpu/renders/icons-f1-<tag>/<race>-<node>-s<seed>.png (1024) + sheet.jpg + metadata.json
Square painted ability icons on a dark backdrop (the HUD frames them); export to 128 px is a separate step.
"""
import hashlib, json, shutil, sys, time
from pathlib import Path
import torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline

tag = sys.argv[1]
SEEDS = [int(s) for s in (sys.argv[2] if len(sys.argv) > 2 else "8820101,8820102").split(",")]
ROOT = Path("/workspace/ki-legends-gpu")
OUT = ROOT / "renders" / ("icons-f1-%s" % tag); OUT.mkdir(parents=True, exist_ok=True)
COMMON = ("rpg skill ability icon, square composition, a single bold symbolic image filling the square, hand painted anime fantasy game art, "
          "thick dark outline, cel shaded, glowing magical energy, high contrast, dark vignette background, no text, no letters, no frame, "
          "masterpiece, best quality")
NEG = "text, letters, numbers, watermark, frame, border, multiple icons, grid, character portrait, person, face, blurry, low quality, photo, 3d render"
RACE = {"planetary": "earthy green and orange nature energy, stone and leaves",
        "sage": "golden light and jade energy, glowing seals and runes",
        "android": "cyan plasma and brushed steel technology, holographic lines",
        "legend": "crimson fire and burning embers, red flames"}
NODES = {
    "planetary": {
        "R": "a fist strike with a trail of dust", "A1": "a quick dodging silhouette with motion lines", "A2": "a light winged boot",
        "A3": "a running path arrow with wind", "A4": "a spinning vortex of green energy", "A5": "wind gusts pushing forward",
        "A6": "a scout's sharp eye", "A7": "a strike from shadows", "A8": "a fading elusive silhouette", "A9": "a storm of whirling energy blades",
        "B1": "an earth pulse shockwave from the ground", "B2": "a chameleon shifting colors", "B3": "stone skin armor plates",
        "B4": "a crushing stomp cracking the ground", "B5": "resonating sound rings in stone", "B6": "a glowing vein of earth in rock",
        "B7": "a guardian boulder golem", "B8": "an earthquake split in the ground", "B9": "the wrath of a valley, mountains erupting",
        "C1": "a breath of roots and leaves", "C2": "green blood drop with a leaf", "C3": "a calm ancient tree",
        "C4": "a shield made of leaves", "C5": "deep protective roots", "C6": "a glowing seed of life", "C7": "a forest grove guardian spirit",
        "C8": "a gift of the forest, glowing fruit", "C9": "singing roots glowing with light", "T": "the world resonating, a glowing planet with energy rings",
    },
    "sage": {
        "R": "a glowing ki energy orb projectile", "A1": "a golden energy seal circle", "A2": "a sign of knowledge, an open glowing book",
        "A3": "a quick seal with motion sparks", "A4": "a beam stream of ki energy", "A5": "echoing seal circles", "A6": "a precise golden crosshair rune",
        "A7": "a golden ring of light", "A8": "a focusing seal over an eye", "A9": "judgment of light, a pillar of holy light from the sky",
        "B1": "a radiant light barrier wall", "B2": "a controlled magic circle", "B3": "dense condensed light crystal", "B4": "a slowing circle with an hourglass",
        "B5": "a reflection of light bouncing", "B6": "a circle guardian sigil", "B7": "a protective dome of light", "B8": "a magic mirror",
        "B9": "a temple of light shining", "C1": "ki focus, a glowing third eye", "C2": "a deep breath of flowing air", "C3": "wisdom of the guardians, ancient scrolls",
        "C4": "battle meditation, lotus with energy", "C5": "a clear calm mind, still water", "C6": "a stream of glowing knowledge",
        "C7": "a sage's gift, glowing jade pendant", "C8": "a master's focus, concentric rings", "C9": "full focus, a radiant lotus burst",
        "T": "enlightenment, a radiant golden lotus halo",
    },
    "android": {
        "R": "an impulse energy shot from a cannon", "A1": "a targeting reticle lock on", "A2": "calibration gears and gauges",
        "A3": "stabilizer thrusters", "A4": "a precise volley of laser shots", "A5": "a weakness scan of a target", "A6": "a fast reload magazine",
        "A7": "a sniper scope", "A8": "a swarm of small drones", "A9": "an execution protocol, a red targeting skull",
        "B1": "a plasma energy shield", "B2": "riveted armor plates", "B3": "a shield generator device", "B4": "a repelling energy pulse wave",
        "B5": "an adaptive protocol chip", "B6": "self repair nanobots fixing metal", "B7": "a spiked energy shield", "B8": "a modular hexagon shield",
        "B9": "a fortification wall of metal", "C1": "a core discharge lightning burst", "C2": "a core management circuit", "C3": "cooling radiator fins",
        "C4": "an emergency discharge warning burst", "C5": "a reserve battery", "C6": "an optimization chip with arrows", "C7": "an overloaded glowing core",
        "C8": "a stable glowing core", "C9": "a system overload explosion", "T": "a full power glowing crystal core form",
    },
    "legend": {
        "R": "a burning ember punch", "A1": "a fiery slash", "A2": "heated glowing blades", "A3": "a chain of rapid strikes",
        "A4": "a charging flame dash", "A5": "glowing burning fists", "A6": "a cruel flaming claw", "A7": "a dance of flames",
        "A8": "crossed dueling swords", "A9": "a thousand fiery cuts", "B1": "a breaking strike shattering a shield", "B2": "tempered hardened skin",
        "B3": "a warrior's honor emblem", "B4": "a flame frenzy rage", "B5": "an iron will heart", "B6": "the blood of a legend, a burning drop",
        "B7": "a furious roaring flame", "B8": "a controlled flame in a palm", "B9": "the last flame, a lone fire in darkness",
        "C1": "a ki explosion", "C2": "glowing embers", "C3": "fire breath", "C4": "an ember explosion", "C5": "quick ignition spark",
        "C6": "an unquenchable flame", "C7": "an erupting volcano", "C8": "a fiery detonator", "C9": "a fiery cataclysm",
        "T": "a flaming legend form, a burning phoenix aura",
    },
}
pipe = StableDiffusionXLPipeline.from_single_file(str(ROOT / "models/checkpoints/DreamShaperXL_Turbo_v2_1.safetensors"), torch_dtype=torch.float16).to("cuda")
meta = {"set": "icons-f1", "model": "DreamShaperXL_Turbo_v2_1", "icons": []}
t0 = time.time(); files = []
for race, nodes in NODES.items():
    for node, desc in nodes.items():
        for seed in SEEDS:
            fn = "%s-%s-s%d.png" % (race, node, seed); files.append(fn)
            if (OUT / fn).exists():
                continue
            img = pipe(prompt=desc + ", " + RACE[race] + ", " + COMMON, negative_prompt=NEG, num_inference_steps=8, guidance_scale=2.5,
                       width=1024, height=1024, generator=torch.Generator("cuda").manual_seed(seed)).images[0]
            tmp = Path("/tmp") / fn; img.save(tmp); shutil.copyfile(tmp, OUT / fn)
            meta["icons"].append({"file": fn, "race": race, "node": node, "seed": seed, "prompt": desc, "sha256": hashlib.sha256(tmp.read_bytes()).hexdigest()})
    print(race, round(time.time() - t0), "s", flush=True)
c = 128; per = len(SEEDS) * 6
rows = (len(files) + per - 1) // per
sh = Image.new("RGB", (per * c, rows * c), "black")
for i, fn in enumerate(files):
    im = Image.open(OUT / fn); im.thumbnail((c, c)); sh.paste(im, ((i % per) * c, (i // per) * c))
sh.save(OUT / "sheet.jpg", quality=86)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
print("GOTOWE:", OUT, len(files), "files", round(time.time() - t0), "s", flush=True)
