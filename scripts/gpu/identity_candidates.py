"""Identity candidates for a race hero from the owner's PDF reference (one approved design before rig/animation).

Usage on an already running GPU pod (does not touch pod lifecycle):
  python3 identity_candidates.py android
  python3 identity_candidates.py legend
  python3 identity_candidates.py planetary
  python3 identity_candidates.py sage
Writes PNG candidates, a contact sheet and metadata with SHA-256 to
/workspace/ki-legends-gpu/renders/<race>-identity-v1/.
"""
import hashlib, json, subprocess, sys, time, urllib.request
from pathlib import Path

race = sys.argv[1] if len(sys.argv) > 1 else "android"
tag = sys.argv[2] if len(sys.argv) > 2 else "v1"  # output folder suffix keeps earlier series intact
SITE = "https://kilegends.pl/game/assets/origins-v1/%s-full.webp" % race
PINNED = {
    "android": "04559d7507f7c3bfa92ebbbf4f1f2b43734546546fd262fa8bfeaaf1afa0eef0",
    "legend": "ba7c4d962595ae469adeaa00939549af2f77597caf175f29fff2122e75a87e80",
    "planetary": "db5caf89604fe974cbf38bd750795f3e362f954c695d8df94ba149e7598ea851",
    "sage": "46801a39930815b6621a8433e5396f25fee22460604cbda4158c617fc5d99147",
}
BASE = ("1boy, solo, adult male, full body, standing, both hands visible, complete feet visible, "
        "fully clothed, relaxed ready stance, high angle three quarter view, anime fantasy game protagonist, "
        "clean precise linework, beautifully painted materials, readable silhouette, isolated on pure white background, "
        "no surrounding scenery, wide white margin on all sides, masterpiece, best quality, very aesthetic")
PROMPTS = {
    "android": "short spiky silver white hair, steel blue eyes, stern calm expression, android warrior, "
               "layered silver and black synthetic armor plates, glowing electric blue energy core on chest, "
               "glowing blue joint cores on shoulders and knees, black bodysuit, long split white and blue coat tails "
               "with blue geometric patterns, armored gauntlets, silver armored boots with blue accents, ",
    "legend": "wild spiky crimson red and black hair, intense amber eyes, fierce confident expression, "
              "muscular warrior, black and crimson armor with steel spikes on shoulders and gauntlets, "
              "open black vest, flowing red sashes, black trousers, spiked steel armored boots, ",
    "planetary": "messy spiky chestnut brown hair with a short orange braid, white headband, amber eyes, tanned skin, "
                 "calm determined expression, muscular forest warrior, orange scarf, sleeveless white and green wrap tunic, "
                 "brown leather straps belts and pouches, bronze brown armored gauntlets and greaves with glowing cyan crystal gems, "
                 "dark green trousers, brown pointed leather boots, orange white and green cloth with geometric patterns, ",
    "sage": "masculine adult man, strong jaw, angular masculine face, broad shoulders, flat chest, tall lean athletic build, "
            "long pale blonde hair tied in a high ponytail with a gold ornament, pointed elf ears, golden amber eyes, "
            "serene calm stern expression, male elf sage, long layered cream white and emerald green robes with gold geometric embroidery, "
            "wide sleeves, jeweled emerald belt with gold ornaments and teal tassels, black inner garment, golden shoulder ornaments, "
            "ornate black and gold armored boots and greaves with emerald gems, holding an ornate golden staff with a glowing emerald orb, ",
}
NEG = ("nsfw, nude, naked, child, girl, woman, worst quality, low quality, blurry, cropped, cut off feet, cut off hair, "
       "out of frame, close up, portrait, text, logo, watermark, signature, multiple people, duplicate character, "
       "extra limbs, missing hands, malformed hands, landscape, ground texture, paving stones, "
       "aura, halo, floating rings, flames, floating energy, glow outside body, weapon, shield")

try:
    import torch, diffusers, transformers, accelerate, PIL  # noqa
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "diffusers", "transformers",
                           "accelerate", "safetensors", "pillow", "peft"])
import torch
from PIL import Image
from diffusers import StableDiffusionXLImg2ImgPipeline

found = subprocess.run(["find", "/workspace", "-iname", "animagine-xl-3.1.safetensors", "-not", "-path", "*/cache/*"],
                       capture_output=True, text=True).stdout.split()
if not found:
    sys.exit("BLAD: nie znaleziono animagine-xl-3.1.safetensors w /workspace")
ckpt = found[0]
if race == "sage":  # the staff is canon; the owner asked for an unambiguously male sage
    NEG = NEG.replace(", weapon, shield", "") + (", girl, woman, female, feminine, androgynous, breasts, cleavage, "
                                                 "character sheet, multiple views, group, crowd, chibi, plants in foreground")
STRENGTHS = {"sage": (0.55, 0.65)}
out = Path("/workspace/ki-legends-gpu/renders/%s-identity-%s" % (race, tag))
out.mkdir(parents=True, exist_ok=True)
ref_path = out / ("reference-%s.webp" % race)
if not ref_path.exists():  # the site rejects the default urllib client with 403
    request = urllib.request.Request(SITE, headers={"User-Agent": "curl/8"})
    ref_path.write_bytes(urllib.request.urlopen(request, timeout=60).read())
ref_sha = hashlib.sha256(ref_path.read_bytes()).hexdigest()
if ref_sha != PINNED[race]:
    sys.exit("BLAD: suma SHA-256 referencji nie zgadza sie: %s" % ref_sha)
ref = Image.open(ref_path).convert("RGB").resize((832, 1024), Image.LANCZOS)

print("checkpoint:", ckpt)
pipe = StableDiffusionXLImg2ImgPipeline.from_single_file(ckpt, torch_dtype=torch.float16).to("cuda")
meta = {"race": race, "reference": SITE, "reference_sha256": ref_sha, "checkpoint": ckpt, "candidates": []}
tiles = []
for seed in (5741101, 5741102, 5741103):
    for strength in STRENGTHS.get(race, (0.62, 0.72)):
        t = time.time()
        img = pipe(prompt=PROMPTS[race] + BASE, negative_prompt=NEG, image=ref, strength=strength,
                   num_inference_steps=30, guidance_scale=6.5,
                   generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        name = "%s-s%d-d%02d.png" % (race, seed, int(strength * 100))
        img.save(out / name)
        sha = hashlib.sha256((out / name).read_bytes()).hexdigest()
        meta["candidates"].append({"file": name, "seed": seed, "strength": strength, "sha256": sha,
                                   "seconds": round(time.time() - t, 1)})
        tiles.append(img)
        print(name, sha[:12], round(time.time() - t, 1), "s")
sheet = Image.new("RGB", (416 * 3, 512 * 2), "white")
for i, im in enumerate(tiles):
    sheet.paste(im.resize((416, 512), Image.LANCZOS), ((i // 2) * 416, (i % 2) * 512))
sheet.save(out / "contact-sheet.jpg", quality=88)
(out / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE:", out)
