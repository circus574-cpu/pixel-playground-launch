"""F2: item, material, status and race emblem icons (owner order 27.10.2026).

  python3 gen_item_icons.py <tag> [seeds comma list]
    -> /workspace/ki-legends-gpu/renders/icons-f2-<tag>/<group>-<id>-s<seed>.png (1024) + sheet.jpg + metadata.json
Ids follow the game: ITEMS keys in src/game/session.ts, material slugs from src/game/monsters/materials.ts
(slug of the loot name), status names from the GPU backlog (D3 list), race ids.
Samples for owner review; matting and 128 px export are a separate step.
"""
import hashlib, json, shutil, sys, time
from pathlib import Path
import torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline

tag = sys.argv[1]
SEEDS = [int(s) for s in (sys.argv[2] if len(sys.argv) > 2 else "8810101,8810102,8810103").split(",")]
ROOT = Path("/workspace/ki-legends-gpu")
OUT = ROOT / "renders" / ("icons-f2-%s" % tag); OUT.mkdir(parents=True, exist_ok=True)
COMMON = ("game inventory icon, a single object centered, hand painted anime fantasy rpg item art, very thick dark outline, cel shaded, vivid colors, "
          "soft rim light, isolated on pure white background, wide white margin, no text, no frame, masterpiece, best quality")
NEG = "multiple objects, scene, background, character, person, hands, text, letters, watermark, frame, border, cropped, blurry, low quality, photo, 3d render"
ITEMS = {
    "potion": "a round glass bottle of glowing red healing potion with a cork",
    "tusk": "a curved wild boar tusk",
    "sword": "a guard's steel short sword with a leather grip",
    "vest": "a traveler's leather vest with buckles",
}
MATERIALS = {  # slug: (Polish name in the game, English prompt)
    "bursztyn": ("Bursztyn", "a chunk of golden amber with a trapped insect"),
    "cewka": ("Cewka", "a copper wire coil component"),
    "ciern-wilka": ("Cierń wilka", "a sharp thorn spike from a thorn wolf"),
    "czerwony-grzyb": ("Czerwony grzyb", "a red spotted mushroom"),
    "czujnik": ("Czujnik", "a small metal sensor module with a blue light"),
    "elektroda": ("Elektroda", "a glowing metal electrode rod"),
    "esencja-plomienia": ("Esencja płomienia", "a small vial with swirling flame essence"),
    "eter-bibliotekarza": ("Eter bibliotekarza", "a floating wisp of blue ether over an open book page"),
    "fragment-ruin": ("Fragment ruin", "a carved ancient stone fragment"),
    "gasienica": ("Gąsienica", "a fat green caterpillar"),
    "jad": ("Jad", "a small flask of green venom"),
    "jedwab-pajaka": ("Jedwab pająka", "a spool of shimmering spider silk"),
    "kamien-runiczny": ("Kamień runiczny", "a stone with a glowing rune"),
    "kamien-swiatynny": ("Kamień świątynny", "a polished temple stone tile with gold inlay"),
    "karta-pergaminu": ("Karta pergaminu", "a rolled parchment page"),
    "lufa": ("Lufa", "a futuristic metal gun barrel part"),
    "magmowy-pancerz": ("Magmowy pancerz", "a cracked armor plate of black rock with glowing magma"),
    "maska-rytualu": ("Maska rytuału", "a carved tribal ritual mask"),
    "mchowa-galaretka": ("Mchowa galaretka", "a wobbly blob of green moss jelly"),
    "modul-optyczny": ("Moduł optyczny", "a robotic optical eye module"),
    "nanopyl": ("Nanopył", "a small capsule of glittering silver nano dust"),
    "nasiona": ("Nasiona", "a small cloth pouch of seeds"),
    "nic-eteru": ("Nić eteru", "a glowing thread of ether wound on a spindle"),
    "obsydian": ("Obsydian", "a sharp black obsidian shard"),
    "pamiec-danych": ("Pamięć danych", "a glowing data memory chip"),
    "pioro-mgly": ("Pióro mgły", "a pale misty translucent feather"),
    "pioro-puchacza": ("Pióro puchacza", "a brown eagle owl feather"),
    "popielne-futro": ("Popielne futro", "a folded grey ash fur pelt"),
    "poroze": ("Poroże", "a deer antler"),
    "pyl": ("Pył", "a small pile of fine dust in a leather pouch"),
    "pyl-swiatla": ("Pył światła", "a small jar of glowing golden light dust"),
    "plyta-pancerna": ("Płyta pancerna", "a riveted steel armor plate"),
    "rdzen-energii": ("Rdzeń energii", "a glowing cyan energy core cylinder"),
    "rdzen-plazmy": ("Rdzeń plazmy", "a sphere containing purple plasma"),
    "rog-areny": ("Róg areny", "a large curved horn of an arena beast"),
    "silownik": ("Siłownik", "a hydraulic piston actuator part"),
    "skalna-skora": ("Skalna skóra", "a piece of stony rock skin hide"),
    "skalny-kastet": ("Skalny kastet", "a brass knuckle made of stone"),
    "skarabeusz": ("Skarabeusz", "a golden scarab beetle"),
    "skrzydlo-krysztalowe": ("Skrzydło kryształowe", "a translucent crystal insect wing"),
    "skrzydlo-zaru": ("Skrzydło żaru", "a fiery ember bat wing"),
    "skora-wilcza": ("Skóra wilcza", "a folded grey wolf pelt"),
    "soczewka": ("Soczewka", "a round glass lens in a brass ring"),
    "soczewka-wiedzy": ("Soczewka wiedzy", "a magic monocle lens with glowing runes"),
    "sok-lisciaka": ("Sok liściaka", "a bottle of green leaf sap"),
    "szklo-obsydianowe": ("Szkło obsydianowe", "a smooth pane of dark volcanic glass"),
    "szmaragdowa-luska": ("Szmaragdowa łuska", "a shiny emerald green scale"),
    "wegiel": ("Węgiel", "a few lumps of black coal"),
    "zarodniki": ("Zarodniki", "a cluster of glowing fungal spores"),
    "zestaw-naprawczy": ("Zestaw naprawczy", "a small repair kit box with tools"),
    "zielone-ostrze": ("Zielone ostrze", "a green leaf shaped blade"),
    "zielone-ziele": ("Zielone ziele", "a bundle of green healing herbs"),
    "zlom": ("Złom", "a pile of scrap metal pieces"),
    "zloty-pancerz": ("Złoty pancerz", "a golden armor plate fragment"),
    "luska-salamandry": ("Łuska salamandry", "an orange red salamander scale"),
    "zywy-korzen": ("Żywy korzeń", "a twisting living root with small leaves"),
    "zadlo-osy": ("Żądło osy", "a large wasp stinger"),
}
STATUS = {
    "poison": "a green poison drop with a skull", "burn": "a burning flame", "bleed": "dripping red blood drops",
    "slow": "a snail shell with a clock", "root": "tangled roots binding a foot", "stun": "spinning yellow stars",
    "fear": "a frightened ghostly face", "silence": "a sealed mouth with a cross", "blind": "a crossed out eye",
    "fog": "a swirl of grey fog", "disrupt": "a broken electric spark", "mark": "a red target mark",
    "armor": "a glowing blue shield", "weaken": "a cracked broken sword",
}
RACE = {
    "legend": "a red flame emblem crest with a black spiked frame", "planetary": "a green and orange planet emblem with a tribal pattern",
    "sage": "a jade lotus emblem with gold trim", "android": "a cyan glowing crystal core emblem in silver armor frame",
}
groups = [("item", ITEMS), ("material", {k: v[1] for k, v in MATERIALS.items()}), ("status", {k: "status effect symbol of " + v for k, v in STATUS.items()}),
          ("race", {k: "race emblem, " + v for k, v in RACE.items()})]
pipe = StableDiffusionXLPipeline.from_single_file(str(ROOT / "models/checkpoints/DreamShaperXL_Turbo_v2_1.safetensors"), torch_dtype=torch.float16).to("cuda")
meta = {"set": "icons-f2", "model": "DreamShaperXL_Turbo_v2_1", "icons": []}
t0 = time.time(); files = []
for g, items in groups:
    for name, desc in items.items():
        for seed in SEEDS:
            fn = "%s-%s-s%d.png" % (g, name, seed); files.append(fn)
            if (OUT / fn).exists():
                continue
            img = pipe(prompt="single " + desc + ", " + COMMON, negative_prompt=NEG, num_inference_steps=8, guidance_scale=2.5, width=1024, height=1024,
                       generator=torch.Generator("cuda").manual_seed(seed)).images[0]
            tmp = Path("/tmp") / fn; img.save(tmp); shutil.copyfile(tmp, OUT / fn)
            meta["icons"].append({"file": fn, "group": g, "id": name, "seed": seed, "prompt": desc, "sha256": hashlib.sha256(tmp.read_bytes()).hexdigest()})
        print(g, name, round(time.time() - t0), "s", flush=True)
c = 160; per = len(SEEDS) * 3
rows = (len(files) + per - 1) // per
sh = Image.new("RGB", (per * c, rows * c), "white")
for i, fn in enumerate(files):
    im = Image.open(OUT / fn); im.thumbnail((c, c)); sh.paste(im, ((i % per) * c, (i // per) * c))
sh.save(OUT / "sheet.jpg", quality=86)
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
print("GOTOWE:", OUT, len(files), "files", round(time.time() - t0), "s", flush=True)
