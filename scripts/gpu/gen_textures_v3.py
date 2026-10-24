"""Large seamless terrain texture library (docs/GPU-LANDSCAPE-AND-FAUNA-2026-10-23.md, owner: "too few").

  python3 gen_textures_v3.py <tag> [seeds comma list] [group prefix filter]
    -> /workspace/ki-legends-gpu/renders/textures-v3-<tag>/tex-<group>-<name>-s<seed>.png (1024x1024)
       + sheet-<group>-<seed>.jpg (one per group) + metadata.json (prompt, SHA-256, seam error)

DreamShaper XL Turbo, circular padding (seamless). PNGs are encoded on the local disk, copied to the network
volume and read back (a PNG on the volume must decode). Samples for visual review, not installed in the game.
"""
import hashlib, json, shutil, sys, time
from pathlib import Path
import numpy as np, torch
from PIL import Image, ImageDraw
from diffusers import StableDiffusionXLPipeline

tag = sys.argv[1] if len(sys.argv) > 1 else "v1"
SEEDS = [int(s) for s in (sys.argv[2] if len(sys.argv) > 2 else "6120301,6120302").split(",")]
ONLY = sys.argv[3] if len(sys.argv) > 3 else ""
ROOT = Path("/workspace/ki-legends-gpu")
OUT = ROOT / "renders" / ("textures-v3-%s" % tag)
OUT.mkdir(parents=True, exist_ok=True)
LOCAL = Path("/tmp/textures-v3-%s" % tag)
LOCAL.mkdir(parents=True, exist_ok=True)

STYLE = ("seamless tileable game texture, flat top-down orthographic view, stylized hand painted anime fantasy game environment art, "
         "clean painted surface, even lighting, no perspective, no objects, no characters, no text, full frame uniform pattern, high quality")
NEG = ("perspective, 3d render, vignette, border, frame, shadow gradient, single large object, person, character, creature, text, logo, "
       "watermark, blurry, low quality, cropped")

# group -> "name: description" lines
GROUPS = {
    "verdant": """
grass-bright: bright green meadow grass, short and even
grass-lush: lush deep green grass with dense blades
grass-dry: dry yellow green grass with straw colored tufts
grass-tall: tall wild grass seen from above with wind streaks
grass-clover: green meadow with clover leaves and tiny white flowers
grass-flowers-yellow: meadow grass full of yellow buttercups
grass-flowers-purple: meadow grass with purple wildflowers
grass-flowers-red: green grass with red poppies
grass-mossy: grass mixed with patches of green moss
grass-worn: trampled grass with patches of bare brown soil
forest-floor-pine: forest floor of brown pine needles with green moss
forest-floor-leaves: forest floor covered with fallen orange and brown leaves
forest-floor-roots: dark forest floor with thick tree roots and moss
forest-floor-ferns: forest floor with green ferns and dark soil
forest-floor-mushrooms: damp forest floor with small mushrooms and moss
forest-floor-twigs: forest floor with fallen twigs and small branches
forest-floor-dark: very dark shaded forest soil with sparse grass
forest-floor-moss-thick: thick green moss carpet with tiny ferns
soil-brown: plain brown garden soil with small stones
soil-dark: dark rich fertile soil
soil-farmland-furrows: plowed farmland with neat furrows
soil-farmland-wheat: golden wheat field seen from above
soil-farmland-cabbage: vegetable field with green cabbages in rows
soil-farmland-sprouts: freshly planted field with small green sprouts
soil-mud-wet: wet brown mud with puddles
soil-mud-cracked: dried cracked mud
riverbank-pebbles: river bank with smooth wet pebbles and sand
riverbank-reeds: muddy river bank with short reeds
riverbed-stones: shallow river bed with round stones under clear water
riverbed-sand: clear shallow water over sandy bed with ripples
water-river-teal: flowing teal river water with light streaks
water-pond-green: green pond water with lily pads
swamp-bog: dark bog water with floating moss and algae
swamp-peat: black peat ground with moss tufts
path-dirt: packed dirt path with wheel ruts
path-gravel: light gravel path with small stones
path-cobble-green: old cobblestone with moss between the stones
path-flagstone: irregular flagstones with grass in the gaps
path-wood-planks: wooden plank walkway weathered brown
hill-grass-slope: grassy hillside with rocks sticking out
hill-heather: purple heather moorland ground
hill-scrub: dry scrubland with low bushes and gravel
orchard-fallen-petals: orchard ground with white blossom petals on grass
village-yard: packed earth village yard with straw and pebbles
""",
    "aether": """
snow-powder: powdery white mountain snow with soft wind ripples
snow-deep-drift: deep snow drifts with smooth curves and blue shadows
snow-crust: hard snow crust with fine cracks and sparkle
snow-footprints: fresh snow with scattered small animal tracks
snow-patchy-grass: thin snow over brown grass with patches showing
ice-crystal: crystalline blue ice with sharp facets and inner glow
ice-frozen-lake: frozen lake surface, pale turquoise ice with white cracks
ice-cracked-blue: deep blue glacier ice with big cracks
ice-frost-white: white frost crystals over dark stone
ice-sheet-clear: clear smooth ice over dark water with bubbles
glacier-crevasse: glacier surface with deep blue crevasse lines
tundra-moss: pale tundra moss and lichen with tiny pebbles
tundra-gravel: cold gravel plain with sparse tufts of grass
alpine-meadow: high mountain meadow with short grass and tiny blue flowers
alpine-rock-grass: grey rock with short mountain grass
shrine-stone-wet: wet pale stone shrine paving with green moss in the joints
shrine-stone-dry: dry pale carved stone paving with fine patterns
shrine-stone-gold-inlay: white stone floor with thin gold inlay lines
shrine-tiles-jade: jade green glazed floor tiles with gold edges
shrine-tiles-white: white ceramic floor tiles with blue pattern
shrine-courtyard-gravel: raked white gravel zen garden with wave patterns
shrine-moss-steps: stone steps covered with moss
garden-cherry-petals: dark soil covered with pink cherry blossom petals
garden-petals-white: grass covered with white blossom petals
garden-bamboo-floor: bamboo grove floor with fallen leaves
garden-bamboo-stalks: dense green bamboo stalks seen from above
garden-pond-koi: calm pond water with golden koi shadows and ripples
garden-pond-lotus: pond water with pink lotus flowers and pads
garden-rice-paddy: flooded rice paddy with young green rice
garden-rice-terrace: green rice terrace pattern seen from above
garden-moss-stone: smooth river stones in thick moss
garden-fern: ground covered with lush ferns in a shaded garden
garden-lantern-path: dark stone path with scattered warm light spots
wetland-reeds: marsh with green reeds and shallow water
wetland-mist-water: still water with pale mist and green algae
waterfall-pool: turquoise water of a waterfall pool with white foam
stream-crystal: crystal clear mountain stream over colorful pebbles
highland-heath: windy highland heath with pale grass and rocks
cloud-mist-floor: soft white clouds seen from above with blue gaps
library-floor-wood: polished dark wood library floor with fine lines
library-carpet-blue: blue carpet with gold ornament pattern
sanctuary-glow-stone: dark blue stone with soft glowing teal veins
""",
    "nexus": """
metal-plate-steel: dark brushed steel floor plates with rivets
metal-plate-clean: clean light grey metal plates with thin seams
metal-plate-worn: scratched worn metal plates with scorch marks
metal-plate-rust: rusty orange metal plates with peeling paint
metal-grate: metal floor grating over dark depth with faint light
metal-hex: hexagonal metal plates with cyan edge lights
metal-diamond: diamond tread plate metal floor
metal-copper: oxidized copper plates with green patina
circuit-ground-cyan: dark ground with glowing cyan circuit traces
circuit-ground-amber: dark ground with glowing amber circuit traces
circuit-ground-magenta: dark ground with glowing magenta circuit traces
circuit-board-green: green circuit board with gold traces and chips
energy-liquid-blue: glowing electric blue liquid energy with light lines
energy-liquid-green: glowing green plasma liquid with currents
energy-core-floor: concentric glowing rings floor around a power core
cable-floor: floor covered with thick cables and cyan lights
pipe-floor: floor of tubes and pipes with steam vents
glass-floor-teal: translucent teal glass floor with light beneath
glass-sand: shimmering sand mixed with fused glass shards
desert-crust: dry cracked tan desert crust
desert-dunes: smooth golden dunes with wind ripples
desert-gravel: desert gravel pavement with dark stones
desert-red-sand: red orange sand with ripples
desert-dust-dark: dark dusty ground with scattered metal scraps
desert-bones: bleached sand with scattered small bones and rocks
salt-flat-white: white salt flat with hexagonal cracks
salt-flat-pink: pink salt crust with crystals
wasteland-gravel: grey wasteland gravel with rusty debris
wasteland-ash: grey ash covered ground with burned metal pieces
wasteland-slag: dark slag ground with melted metal veins
lab-floor-white: white laboratory floor tiles with thin cyan lines
lab-floor-dark: dark laboratory floor tiles with soft reflections
lab-floor-hazard: floor with yellow black hazard stripes worn
landing-pad: landing pad concrete with painted markings worn
concrete-clean: smooth grey concrete with fine cracks
concrete-stained: concrete floor with oil stains and puddles
sensor-grid: dark floor with fine glowing grid lines
data-stream-floor: dark floor with flowing streams of tiny light dots
reactor-crystal-floor: dark floor with embedded glowing blue crystals
ice-field-synthetic: pale blue frozen field with metal dust
scrapyard-ground: ground covered with tiny scrap metal parts and gears
oasis-water-synthetic: turquoise water pond reflecting cyan light
oasis-grass-glow: dark green grass with small glowing blue flowers
""",
    "pyra": """
lava-flow-orange: molten lava flow with glowing orange cracks and dark crust
lava-flow-bright: bright yellow orange molten lava with swirling flow
lava-crust-black: black cooling lava crust with red glowing veins
lava-crust-thin: thin broken dark crust over bright lava
lava-pool-calm: calm glowing lava lake with subtle ripples
magma-cracks: dark rock with branching glowing magma cracks
ember-ground: dark ground with scattered glowing embers
ash-fields: grey volcanic ash with dark pebbles and wind streaks
ash-deep: deep soft grey ash drifts
ash-black: black volcanic ash with fine texture
ash-pumice: pale pumice stones and ash mix
obsidian-black: black glossy obsidian with deep blue reflections
obsidian-shards: broken obsidian shards on dark ground
basalt-columns-top: dark hexagonal basalt column tops from above
basalt-rough: rough dark basalt rock with pits
tuff-grey: grey volcanic tuff rock with fine layers
canyon-red-rock: red orange canyon rock with strata and cracks
canyon-orange-layers: orange and cream layered sandstone bands
canyon-dark-red: dark red rock with deep fissures
clay-red-cracked: dry cracked red clay with deep fissures
clay-orange-dry: dry orange clay plates curling at the edges
sand-black: black volcanic sand with ripples
sand-red: red sand with fine ripples
sand-ember: dark sand with faint glowing orange grains
sulfur-yellow: yellow sulfur crust with orange stains
sulfur-green: pale green yellow sulfur deposits with vents
geyser-crust: white and orange mineral crust around hot springs
hot-spring-water: milky turquoise hot spring water with steam
scorched-earth: burnt black ground with white ash patches
scorched-grass: burnt grass with black stems and ash
burnt-forest-floor: charred forest floor with burnt twigs and ash
cooled-lava-ropy: cooled ropy lava with smooth folds
cooled-lava-blocks: cooled lava broken into dark blocks
war-camp-dirt: trampled red dirt with ash and boot marks
arena-sand-red: arena sand red brown with raked patterns
fortress-stone-dark: dark volcanic stone bricks with red mortar
fortress-stone-black: black polished stone paving with fine gold lines
fortress-courtyard-slate: dark slate tiles with orange glow in the joints
clan-banner-red-cloth: red woven cloth with gold embroidery pattern
forge-floor-iron: iron floor plates with glowing seams and soot
coal-ground: black coal pieces ground with orange glints
rubble-red: red stone rubble and gravel
dry-riverbed-red: dry cracked riverbed with red pebbles
steam-vent-field: grey ground with many small steam vents and yellow stains
""",
    "rock": """
granite-grey: grey granite rock surface with speckles
granite-pink: pink granite with black speckles
granite-weathered: weathered granite with cracks and lichen
limestone-pale: pale limestone with horizontal strata
limestone-fossil: limestone slab with small fossils
limestone-karst: pitted karst limestone with holes
basalt-dark: dark grey basalt with fine pits
basalt-blue: blue grey basalt with fine veins
sandstone-warm: warm sandstone layers in orange and cream
sandstone-red: deep red sandstone bands
sandstone-yellow: yellow ochre sandstone with wind erosion
slate-grey: grey slate with thin layers
slate-blue: blue grey slate plates
marble-white: white marble with grey veins
marble-black: black marble with white veins
quartzite-white: white quartzite with sparkles
shale-brown: brown shale with thin flakes
conglomerate: rounded pebbles cemented in rock
gneiss-banded: banded gneiss with wavy light and dark layers
tuff-pale: pale tuff rock with small holes
volcanic-scoria: red black scoria rock with bubbles
lava-rock-vesicular: dark vesicular lava rock
crystal-quartz-geode: rock face with clusters of purple crystals
crystal-teal: dark rock with teal crystals
mineral-copper-green: rock with green copper mineral stains
mineral-iron-red: rock with rust red iron stains
cliff-face-strata: vertical looking cliff rock with horizontal strata
cliff-face-cracked: cracked grey cliff rock with vertical fissures
cliff-face-mossy: cliff rock covered with moss and ivy
cliff-face-ice: cliff rock with frozen icicles and snow
scree-grey: grey scree of small broken stones
scree-red: red scree of small sharp stones
boulder-field-grey: field of large grey boulders seen from above
boulder-field-mossy: mossy boulders packed together seen from above
pebbles-river: smooth river pebbles of many colors
pebbles-beach: beach pebbles in grey and white
gravel-fine: fine grey gravel
gravel-coarse: coarse brown gravel with sand
rubble-stone: broken stone rubble and dust
mountain-top-rock: bare mountain summit rock with snow in cracks
mountain-slope-grass: steep mountain slope with rock and grass tufts
mountain-slope-snow: snowy mountain slope with rock outcrops
mountain-ridge-dark: dark rugged ridge rock seen from above
volcano-slope-ash: volcano slope with ash and dark rock
volcano-rim-glow: volcano crater rim with glowing cracks
cave-floor-stone: cave floor of grey stone with puddles
cave-floor-crystal: cave floor with glowing crystals in dark rock
cave-wall-damp: damp dark cave wall with moss and drips
ruins-stone-old: old weathered stone paving with cracks and weeds
ruins-stone-carved: carved ancient stone with faint glowing runes
ruins-brick-red: old red brick floor with worn edges
ruins-choir-node: dark stone with thin glowing concentric lines
""",
    "water": """
ocean-deep: deep blue ocean water with soft wave highlights
ocean-shallow: turquoise shallow sea water with pale sand visible
ocean-foam: sea water with white foam streaks and waves
ocean-stormy: dark grey green stormy sea with whitecaps
lake-calm: calm dark blue lake water with subtle reflections
lake-green: green lake water with algae and light rays
lake-clear: very clear lake water over pebbles
river-fast: fast flowing river with white rapids streaks
river-slow: slow wide river with gentle ripples
river-muddy: brown muddy river water with swirls
shore-sand-wet: wet sand at the waterline with small waves
shore-sand-dry: dry golden beach sand with ripples
shore-pebble: pebble shore with wet stones
shore-rock: dark wet rocks with sea foam
shore-mud: tidal mud flat with shiny puddles
marsh-reeds: shallow marsh water with reed shadows
marsh-lilies: marsh with water lilies and duckweed
swamp-dark: dark swamp water with floating leaves
ice-water-edge: icy water with floating ice plates
crystal-water: luminous pale emerald crystal water with sparkles
lava-water-steam: dark water with orange glow and steam
energy-water: glowing blue energy water with circuit-like lines
""",
}


def seam(img):
    a = np.asarray(img.convert("RGB"), dtype=np.float32)
    return round(float((np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0] - a[-1]).mean()) / 2), 2)


def save_verified(img, name):
    tmp = LOCAL / name
    img.save(tmp)
    dst = OUT / name
    for _ in range(5):
        shutil.copyfile(tmp, dst)
        try:
            with Image.open(dst) as check:
                check.load()
            return
        except OSError:
            time.sleep(1)
    raise SystemExit("cannot write a readable file: %s" % dst)


table = []
for group, block in GROUPS.items():
    if ONLY and not group.startswith(ONLY):
        continue
    for line in block.strip().splitlines():
        name, desc = line.split(": ", 1)
        table.append((group, name.strip(), desc.strip()))
print("TEXTURES:", len(table), "x", len(SEEDS), flush=True)

pipe = StableDiffusionXLPipeline.from_single_file(
    str(ROOT / "models/checkpoints/DreamShaperXL_Turbo_v2_1.safetensors"), torch_dtype=torch.float16).to("cuda")
for m in list(pipe.unet.modules()) + list(pipe.vae.modules()):
    if isinstance(m, torch.nn.Conv2d):
        m.padding_mode = "circular"

meta = {"tag": tag, "model": "DreamShaperXL_Turbo_v2_1", "style": STYLE, "negative": NEG, "textures": []}
t0 = time.time()
for i, (group, name, desc) in enumerate(table):
    for seed in SEEDS:
        fn = "tex-%s-%s-s%d.png" % (group, name, seed)
        if (LOCAL / fn).exists():
            continue
        img = pipe(prompt=desc + ", " + STYLE, negative_prompt=NEG, num_inference_steps=8, guidance_scale=2.5,
                   width=1024, height=1024, generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        save_verified(img, fn)
    if i % 10 == 0:
        print("%d/%d %s %ds" % (i + 1, len(table), name, time.time() - t0), flush=True)
for group, name, desc in table:
    for seed in SEEDS:
        fn = "tex-%s-%s-s%d.png" % (group, name, seed)
        img = Image.open(LOCAL / fn)
        meta["textures"].append({"file": fn, "group": group, "name": name, "seed": seed, "prompt": desc,
                                 "sha256": hashlib.sha256((LOCAL / fn).read_bytes()).hexdigest(), "seam_error": seam(img)})
# contact sheets: 8 columns of 192 px, labelled, per group and first seed
c, cols = 192, 8
for group in GROUPS:
    items = [r for r in meta["textures"] if r["group"] == group and r["seed"] == SEEDS[0]]
    if not items:
        continue
    rows = (len(items) + cols - 1) // cols
    sh = Image.new("RGB", (cols * c, rows * c), "white")
    d = ImageDraw.Draw(sh)
    for k, r in enumerate(items):
        x, y = (k % cols) * c, (k // cols) * c
        sh.paste(Image.open(LOCAL / r["file"]).convert("RGB").resize((c, c), Image.LANCZOS), (x, y))
        d.rectangle((x, y + c - 14, x + c, y + c), fill=(0, 0, 0))
        d.text((x + 3, y + c - 12), r["name"][:30], fill=(255, 255, 255))
    sh.save(OUT / ("sheet-%s-%d.jpg" % (group, SEEDS[0])), quality=86)
    shutil.copyfile(OUT / ("sheet-%s-%d.jpg" % (group, SEEDS[0])), LOCAL / ("sheet-%s.jpg" % group))
(OUT / "metadata.json").write_text(json.dumps(meta, indent=1))
print("GOTOWE:", OUT, len(meta["textures"]), "plikow", round(time.time() - t0), "s", flush=True)
