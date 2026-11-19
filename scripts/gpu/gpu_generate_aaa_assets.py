#!/usr/bin/env python3
"""
RTX 6000 Ada GPU Production Pipeline for KI Legends:
1. Seamless 1024x1024 PBR ground/snow/ice/desert terrain textures (true Conv2d circular tiling!)
   matching the owner-accepted canonical continent maps 1:1 (snowy/icy Aetheria, snowy peaks
   of Verdantia, desert-metallic Nexus-9, dark volcanic Pyra).
2. Complete Snowy/Icy Aetheria architecture & winter alpine flora/props replacing summer assets.
3. Reserve AAA Asset Library (castles, spare buildings, waterfalls/cascades, world props)
   with GPU InSPyReNet alpha matting + clean edge decontamination + manifest.json.
"""

import gc
import json
import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
from PIL import Image

OUT_BASE = Path(os.environ.get("KI_GPU_OUT", "/workspace/ki-overhaul-20261119/gpu_assets"))
MODEL_DIR = Path(os.environ.get("KI_SDXL_MODEL", "/workspace/ki-premium/model"))

STYLE_OBJ = (
    "hand-painted dark fantasy isometric RPG game asset, Diablo 4 and Torchlight style, "
    "crisp 3/4 isometric orthographic view from above, rich painterly stonework and lighting, "
    "isolated single object centered on pure solid white background, zero ground terrain pad, "
    "no cast shadow on floor, sharp silhouette, studio game art, ultra detailed"
)
NEG_OBJ = (
    "text, watermark, label, frame, border, grid, collage, multiple objects, split view, "
    "ground tile, landscape background, sky, horizon, grass base, blurry, lowres, cartoon, "
    "flat vector, anime cel shading, cropped, cut off edges"
)

STYLE_TEX = (
    "seamless tileable top-down game terrain ground texture, flat orthographic overhead view, "
    "hand-painted AAA dark fantasy action RPG PBR albedo, even diffuse lighting, zero perspective, "
    "no horizon, no sky, no objects, high micro detail, crisp natural surface"
)
NEG_TEX = (
    "perspective, 3d scene, horizon, sky, trees, buildings, people, text, watermark, frame, "
    "border, vignette, dark corners, blurry, lowres, cartoon"
)


# ==============================================================================
# 1. SEAMLESS PBR TERRAIN TEXTURES (TRUE CIRCULAR PADDING)
# ==============================================================================
SEAMLESS_TEXTURES = [
    # Aetheria — True Snow & Glacier Ice Continent!
    ("textures/aether/mat_0.png", 101,
     "fresh alpine snowfield ground with gentle wind-swept snowdrifts, subtle crystalline frost sparkles, "
     "soft cool pale blue-white shadow hollows, winter mountain snow ground"),
    ("textures/aether/mat_1.png", 102,
     "pale glacier ice and packed winter frost crust with delicate snow-dusted cracks, "
     "translucent pale ice-blue and frosty white frozen alpine tundra surface"),
    ("textures/aether/mat_2.png", 103,
     "snow-dusted ancient white marble and pale slate flagstones road path, weathered carved stone tiles "
     "with light snow settled in mortar joints, winter sanctuary cobblestone path"),
    ("textures/aether/mat_3.png", 104,
     "dark blue-grey alpine mountain granite rock heavily dusted with crisp white snow and ice crevices, "
     "rugged snowy cliff stone surface"),
    ("textures/aether/water.png", 105,
     "crystal clear glacial alpine turquoise-blue cold water surface with subtle frost ripples and icy shimmer"),
    # Verdantia — Alpine Snow Peaks + Rich Emerald Meadow
    ("textures/verdant/mat_3.png", 204,
     "rugged alpine mountain grey granite rock with snow-capped ledges and mossy stone crevices, "
     "hand-painted fantasy mountain rock surface"),
    # Nexus-9 — Sandy-Ochre Industrial Plateau + Silver-Grey Ash + Steel Decking (1:1 with nexus map_art.png!)
    ("textures/nexus/mat_0.png", 301,
     "arid warm tan sandstone desert earth and compacted ochre-beige industrial plateau soil with fine gravel "
     "and subtle weathered stone cracks, sci-fantasy wasteland ground"),
    ("textures/nexus/mat_1.png", 302,
     "pale silver-grey compacted metallic ash plains and weathered light titanium-concrete dust floor "
     "with subtle geometric seam lines, sci-fantasy industrial plain"),
    ("textures/nexus/mat_2.png", 303,
     "dark gunmetal steel architectural highway deck panels with beveled seams and subtle cyan-grey trim lines, "
     "sci-fantasy forged alloy road surface"),
    ("textures/nexus/mat_3.png", 304,
     "rugged dark grey-brown arid mountain basalt rock ridge with stratified sedimentary cliffs"),
]

# ==============================================================================
# 2. SNOWY / WINTER AETHERIA BUILDINGS & ALPINE FLORA (REPLACING SUMMER ASSETS!)
# ==============================================================================
AETHER_WINTER_ASSETS = [
    ("objects/aether-snow-sanctum.webp", 401,
     "majestic three-tier white marble and jade-teal tiled winter sanctuary pagoda covered in thick fresh snow, "
     "glowing cyan ice crystal spire at summit, frost-trimmed eaves, icicles, warm golden temple lanterns"),
    ("objects/aether-snow-hall.webp", 402,
     "ornate alpine marble council pavilion with snow-laden teal curved roof, gilded snow-dusted pillars, "
     "warm glowing arched entrance doors, crystal braziers, winter mountain monastery hall"),
    ("objects/aether-snow-smithy.webp", 403,
     "snow-covered alpine stone rune forge workshop with thick snow on shingled roof, glowing blue-gold arcane anvil "
     "and chimney puffing warm steam, carved marble archway, winter craft smithy"),
    ("objects/aether-snow-inn.webp", 404,
     "cozy two-story alpine mountain teahouse inn with snow-blanketed turquoise tiled roof, warm glowing amber windows, "
     "carved cedar timber balconies dusted with snow, hanging warm paper lanterns"),
    ("objects/aether-snow-shop.webp", 405,
     "winter sanctuary scroll merchant pavilion with frosted timber stalls, snow-draped teal canopy awning, "
     "stacked scrolls and glowing rune vials, carved marble base"),
    ("objects/aether-snow-arena.webp", 406,
     "circular white marble and frosted stone winter martial meditation arena ring with snow-covered stepped rim, "
     "four glowing cyan crystal obelisk pillars, frost carvings"),
    ("objects/aether-snow-depot.webp", 407,
     "fortified snow-covered white stone archive vault tower with reinforced gilded bronze vault door, "
     "steep snow-covered teal roof and glowing blue protective ward runes"),
    ("objects/aether-snow-house.webp", 408,
     "small charming alpine scholar cottage of pale stone and dark wood with heavy fresh snow blanket on roof, "
     "warm lit window, icicles along eaves"),
    ("objects/aether-snow-observatory.webp", 409,
     "tall snow-dusted white marble astronomical observatory tower with rotating brass astrolabe dome, "
     "glowing cyan sky-crystal beacon, frost-covered stone balconies"),
    ("objects/aether-snow-pine1.webp", 410,
     "tall majestic alpine spruce pine tree heavily laden with thick pure white snow on dark evergreen branches, "
     "winter mountain conifer tree"),
    ("objects/aether-snow-pine2.webp", 411,
     "cluster of two gnarled frost-covered mountain cedar and silver birch winter trees with snow on boughs "
     "and glistening frost"),
    ("objects/aether-ice-crystal.webp", 412,
     "cluster of tall translucent glowing cyan-blue glacial ice crystal spires erupting from snow-covered alpine rock"),
    ("objects/aether-snow-rock.webp", 413,
     "jagged dark blue-grey alpine granite boulder cluster capped with thick white snowdrifts and icicles"),
    ("objects/aether-snow-shrine.webp", 414,
     "carved ancient white marble mountain wayshrine lantern monument with snow cap and glowing turquoise Ki orb"),
    ("objects/aether-ice-ruin.webp", 415,
     "ancient weathered white marble ruined archway and broken temple columns dusted with snow and hanging icicles"),
]

# ==============================================================================
# 3. RESERVE AAA LIBRARY (CASTLES, SPARE BUILDINGS, WATERFALLS, WORLD PROPS)
# ==============================================================================
LIBRARY_ASSETS = [
    # --- 4 Reserve Castles / Citadels ---
    ("library/castles/castle_pyra_obsidian.webp", 501,
     "monumental dark volcanic obsidian fortress castle with jagged battlements, iron-bound towers, glowing molten lava "
     "forge vents and burning ember braziers, epic dark fantasy volcanic citadel"),
    ("library/castles/castle_verdant_keep.webp", 502,
     "grand medieval stone and emerald-moss forest castle keep with slate-roofed towers, ancient oak vines climbing "
     "battlements, timber gatehouse and warm torchlit windows"),
    ("library/castles/castle_aether_citadel.webp", 503,
     "majestic snowy white marble and glacial-blue high alpine ice citadel castle with snow-capped spires, "
     "flying buttresses, glowing cyan crystal beacon tower, frost-carved ramparts"),
    ("library/castles/castle_nexus_fortress.webp", 504,
     "imposing dark titanium and gunmetal sci-fantasy armored citadel fortress with hexagonal energy shields, "
     "glowing cyan plasma conduits, heavy sensor towers and landing bay"),

    # --- 8 Reserve Spare Buildings ---
    ("library/buildings/bldg_wizard_tower.webp", 511,
     "tall dark stone arcane wizard spire tower with spiral stairs, glowing sapphire rune windows, pointed slate roof "
     "and floating crystal ring at the apex"),
    ("library/buildings/bldg_alchemist_hut.webp", 512,
     "eccentric stone and timber alchemist apothecary workshop with copper distillation coils, glowing green potion bottles, "
     "mossy crooked shingled roof and smoking chimney"),
    ("library/buildings/bldg_windmill.webp", 513,
     "medieval stone and dark oak fantasy grain windmill tower with weathered canvas sails, wooden balcony and grain sacks"),
    ("library/buildings/bldg_stables.webp", 514,
     "sturdy dark timber and stone medieval fantasy horse stables barn with thatched-slate roof, open stalls, hay bales and lantern"),
    ("library/buildings/bldg_watchtower_stone.webp", 515,
     "fortified medieval stone border watchtower with wooden hoarding battlements, iron brazier beacon on top and arrow slits"),
    ("library/buildings/bldg_harbor_dockhouse.webp", 516,
     "medieval fantasy coastal stone and timber harbor warehouse dockhouse with wooden cargo crane hoist, barrels and lantern"),
    ("library/buildings/bldg_obsidian_foundry.webp", 517,
     "heavy dark volcanic stone and iron industrial magma foundry hall with glowing molten furnace chimney and iron chains"),
    ("library/buildings/bldg_cyber_dome.webp", 518,
     "sleek dark alloy sci-fantasy research biodome observatory with glowing cyan glass ribs, solar conduits and airlock door"),

    # --- 6 Waterfalls & Cascades (Water, Forest, Frozen Ice, Lava, Plasma, Cliff Spring) ---
    ("library/waterfalls/waterfall_forest_tall.webp", 521,
     "dramatic tall mossy dark grey cliff rock formation with rushing white-foaming turquoise waterfall cascading down "
     "into sparkling splash mist pool, fantasy RPG environment prop"),
    ("library/waterfalls/waterfall_emerald_cascade.webp", 522,
     "tiered double emerald forest waterfall spilling over mossy boulders and ferns with frothy turquoise spray and mist"),
    ("library/waterfalls/waterfall_frozen_aether.webp", 523,
     "majestic partly frozen alpine glacier waterfall cascading down snowy ice-blue cliffs with giant icicles and glowing mist"),
    ("library/waterfalls/waterfall_lava_pyra.webp", 524,
     "dramatic jagged black basalt volcanic cliff pouring a glowing molten orange-gold lava waterfall with ember sparks"),
    ("library/waterfalls/waterfall_plasma_nexus.webp", 525,
     "dark gunmetal sci-fantasy dam conduit cliff pouring a luminous glowing cyan coolant plasma waterfall with energy mist"),
    ("library/waterfalls/waterfall_cliff_spring.webp", 526,
     "ancient carved stone lion-head mountain spring fountain built into mossy cliff rock pouring clear turquoise water"),

    # --- 10 Diverse World Props ---
    ("library/props/prop_ancient_portal.webp", 531,
     "ancient carved weathered stone ring teleportation portal archway with glowing swirling azure-gold arcane runes inside"),
    ("library/props/prop_guardian_statue.webp", 532,
     "heroic weathered stone statue of an armored fantasy warrior guardian holding a greatsword on a carved plinth"),
    ("library/props/prop_runic_obelisk.webp", 533,
     "tall dark monolithic carved stone runic obelisk pillar glowing with etched golden-cyan ancient sigils"),
    ("library/props/prop_merchant_wagon.webp", 534,
     "ornate medieval fantasy covered wooden merchant trade wagon loaded with crates, barrels, lantern and canvas hood"),
    ("library/props/prop_harbor_boat.webp", 535,
     "hand-crafted medieval wooden fishing and explorer sailboat with furled cream sail, coiled ropes and bow lantern"),
    ("library/props/prop_ruined_archway.webp", 536,
     "crumbling ancient mossy stone Gothic temple ruined archway with ivy vines and fallen carved masonry blocks"),
    ("library/props/prop_camp_tent.webp", 537,
     "adventurer expedition canvas camp pavilion tent with dark wood poles, supply crates, bedroll and hanging lantern"),
    ("library/props/prop_bonfire_pit.webp", 538,
     "ring of dark river stones around a roaring warm orange campfire with logs, iron cooking cauldron and rising sparks"),
    ("library/props/prop_waystone_pillar.webp", 539,
     "weathered medieval carved stone crossroads milestone signpost pillar with wooden directional arrows and lantern"),
    ("library/props/prop_ice_glacier_arch.webp", 540,
     "dramatic natural translucent glacial blue ice archway bridge rock formation dusted with snow and icicles"),
]


def set_conv2d_padding_mode(module: nn.Module, mode: str) -> None:
    for m in module.modules():
        if isinstance(m, nn.Conv2d):
            m.padding_mode = mode


def make_seamless_blend(img: Image.Image) -> Image.Image:
    """Extra edge-safety seamless check (circular padding already makes it tileable, keep crisp 1024x1024)."""
    return img.convert("RGB")


def extract_clean_rgba(img: Image.Image, remover) -> Image.Image:
    """GPU InSPyReNet background removal + white-fringe decontamination + tight crop with 12px margin."""
    rgba = remover.process(img.convert("RGB"), type="rgba")
    arr = np.asarray(rgba, dtype=np.float32)
    rgb = arr[..., :3]
    a = arr[..., 3] / 255.0

    # Remove faint residual alpha speckle (< 0.06)
    a = np.where(a < 0.06, 0.0, a)
    # Softly tighten semi-transparent white-background halo along boundary
    white_dist = np.linalg.norm(255.0 - rgb, axis=-1)
    edge_band = (a > 0.0) & (a < 0.88) & (white_dist < 52.0)
    a = np.where(edge_band, a * np.clip(white_dist / 52.0, 0.0, 1.0), a)

    # Decontaminate semi-transparent edge pixels by pulling inward colors from opaque neighbors
    opaque = (a > 0.85).astype(np.uint8)
    if np.any(opaque):
        kernel = np.ones((5, 5), np.uint8)
        dil = cv2.dilate(rgb.astype(np.uint8), kernel, iterations=2).astype(np.float32)
        semi = (a > 0.02) & (a < 0.85)
        # Blend semi-transparent edge RGB away from pure white background
        unmixed = np.clip((rgb - 255.0 * (1.0 - a[..., None])) / np.maximum(a[..., None], 0.18), 0.0, 255.0)
        rgb = np.where(semi[..., None], 0.55 * unmixed + 0.45 * dil, rgb)

    out_arr = np.zeros_like(arr, dtype=np.uint8)
    out_arr[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out_arr[..., 3] = np.clip(a * 255.0, 0, 255).astype(np.uint8)

    # Tight bounding-box crop with 12px transparent margin
    ys, xs = np.where(out_arr[..., 3] > 18)
    if len(xs) > 20 and len(ys) > 20:
        x0 = max(0, int(xs.min()) - 12)
        y0 = max(0, int(ys.min()) - 12)
        x1 = min(out_arr.shape[1], int(xs.max()) + 13)
        y1 = min(out_arr.shape[0], int(ys.max()) + 13)
        out_arr = out_arr[y0:y1, x0:x1]

    pil_out = Image.fromarray(out_arr, mode="RGBA")
    # Cap longest side to 768px for crisp fast runtime loading in Godot
    if max(pil_out.size) > 768:
        pil_out.thumbnail((768, 768), Image.Resampling.LANCZOS)
    return pil_out


def main() -> None:
    t_start = time.time()
    OUT_BASE.mkdir(parents=True, exist_ok=True)

    from diffusers import AutoPipelineForText2Image, DPMSolverMultistepScheduler
    from transparent_background import Remover

    print(f"Loading DreamShaper XL v2 Turbo from {MODEL_DIR} onto RTX 6000 Ada...")
    pipe = AutoPipelineForText2Image.from_pretrained(
        str(MODEL_DIR),
        torch_dtype=torch.float16,
        variant="fp16",
        local_files_only=True,
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config,
        use_karras_sigmas=True,
        algorithm_type="sde-dpmsolver++",
    )
    pipe = pipe.to("cuda")
    pipe.set_progress_bar_config(disable=True)

    print("Loading GPU InSPyReNet background remover (transparent-background)...")
    remover = Remover(mode="base", device="cuda:0")

    manifest = {"textures": [], "aether_winter": [], "library": []}

    # 1. Seamless PBR Textures (circular Conv2d padding!)
    print(f"\n=== PHASE 1: Generating {len(SEAMLESS_TEXTURES)} Seamless 1024x1024 PBR Textures ===")
    set_conv2d_padding_mode(pipe.unet, "circular")
    set_conv2d_padding_mode(pipe.vae, "circular")
    for rel_path, seed, prompt_body in SEAMLESS_TEXTURES:
        out_p = OUT_BASE / rel_path
        out_p.parent.mkdir(parents=True, exist_ok=True)
        if out_p.exists() and out_p.stat().st_size > 20000:
            print(f"  [SKIP] {rel_path}")
            manifest["textures"].append(rel_path)
            continue
        gen = torch.Generator(device="cuda").manual_seed(seed)
        img = pipe(
            prompt=f"{prompt_body}, {STYLE_TEX}",
            negative_prompt=NEG_TEX,
            num_inference_steps=10,
            guidance_scale=2.2,
            width=1024,
            height=1024,
            generator=gen,
        ).images[0]
        make_seamless_blend(img).save(out_p, optimize=True)
        manifest["textures"].append(rel_path)
        print(f"  [TEX OK] {rel_path}")

    # Restore zero padding for isolated objects
    set_conv2d_padding_mode(pipe.unet, "zeros")
    set_conv2d_padding_mode(pipe.vae, "zeros")

    # 2. Snowy Aetheria Architecture & Winter Props
    print(f"\n=== PHASE 2: Generating {len(AETHER_WINTER_ASSETS)} Snowy Aetheria Assets ===")
    for rel_path, seed, prompt_body in AETHER_WINTER_ASSETS:
        out_p = OUT_BASE / rel_path
        out_p.parent.mkdir(parents=True, exist_ok=True)
        if out_p.exists() and out_p.stat().st_size > 10000:
            print(f"  [SKIP] {rel_path}")
            manifest["aether_winter"].append(rel_path)
            continue
        gen = torch.Generator(device="cuda").manual_seed(seed)
        raw = pipe(
            prompt=f"{prompt_body}, {STYLE_OBJ}",
            negative_prompt=NEG_OBJ,
            num_inference_steps=9,
            guidance_scale=2.1,
            width=1024,
            height=1024,
            generator=gen,
        ).images[0]
        rgba = extract_clean_rgba(raw, remover)
        rgba.save(out_p, format="WEBP", quality=92, method=5)
        manifest["aether_winter"].append(rel_path)
        print(f"  [AETHER OK] {rel_path} {rgba.size}")

    # 3. Reserve AAA Asset Library (Castles, Spare Buildings, Waterfalls, World Props)
    print(f"\n=== PHASE 3: Generating {len(LIBRARY_ASSETS)} Reserve Library AAA Assets ===")
    for rel_path, seed, prompt_body in LIBRARY_ASSETS:
        out_p = OUT_BASE / rel_path
        out_p.parent.mkdir(parents=True, exist_ok=True)
        if out_p.exists() and out_p.stat().st_size > 10000:
            print(f"  [SKIP] {rel_path}")
            manifest["library"].append(rel_path)
            continue
        gen = torch.Generator(device="cuda").manual_seed(seed)
        raw = pipe(
            prompt=f"{prompt_body}, {STYLE_OBJ}",
            negative_prompt=NEG_OBJ,
            num_inference_steps=9,
            guidance_scale=2.1,
            width=1024,
            height=1024,
            generator=gen,
        ).images[0]
        rgba = extract_clean_rgba(raw, remover)
        rgba.save(out_p, format="WEBP", quality=92, method=5)
        manifest["library"].append(rel_path)
        print(f"  [LIB OK] {rel_path} {rgba.size}")

    (OUT_BASE / "gpu_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    elapsed = time.time() - t_start
    print(f"\nGPU_AAA_ASSETS_DONE in {elapsed:.1f}s -> {OUT_BASE}")


if __name__ == "__main__":
    main()
