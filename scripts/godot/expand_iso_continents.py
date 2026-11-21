#!/usr/bin/env python3
"""Expand all 4 KI Legends isometric continents 4x linear (1024 -> 4096 m, 16x area)
with compact human-scaled capitals (safe_city_radius = 250 m) and 5 rich,
geographically distinct sub-biomes per continent.

Preserves canonical map_art.png, minimap_hq.png, relief_3d.r32, height.r32,
walkable.u8, weights.png, planet_real_world.png, and globe-real-world.webp untouched.
Updates buildings.json and re-rasterizes ONLY the road (B) channel of surface.png
at 1024x1024 so terrain, minimap, 3D map, 2D atlas, and 3D globe remain 1:1 synced.
"""
import argparse
import io
import json
import math
import random
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
REGIONS_DIR = ROOT / "ports" / "godot-isometric-world" / "regions"
TARGET_WORLD_SIZE = 4096.0
SCALE_FACTOR = 4.0
CAP_OFFSET_SCALE = 1.08
SAFE_CITY_RADIUS = 250.0
SURFACE_RES = 1024


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    t = max(0.0, min(1.0, (x - edge0) / max(edge1 - edge0, 1e-6)))
    return t * t * (3.0 - 2.0 * t)


def remap_radial(x: float, z: float, old_cx: float, old_cz: float, new_cx: float, new_cz: float,
                 r_inner: float = 135.0, r_outer: float = 232.0) -> tuple[float, float]:
    dx = x - old_cx
    dz = z - old_cz
    d = math.hypot(dx, dz)
    s = CAP_OFFSET_SCALE + (SCALE_FACTOR - CAP_OFFSET_SCALE) * smoothstep(r_inner, r_outer, d)
    return new_cx + dx * s, new_cz + dz * s


def load_source_bytes(land: str, filename: str, git_ref: str | None) -> bytes:
    if git_ref:
        rel = f"ports/godot-isometric-world/regions/{land}/{filename}"
        return subprocess.check_output(["git", "show", f"{git_ref}:{rel}"], cwd=ROOT)
    return (REGIONS_DIR / land / filename).read_bytes()


class TerrainSampler:
    def __init__(self, land: str, orig_surface_bytes: bytes):
        rdir = REGIONS_DIR / land
        self.heights = np.fromfile(rdir / "height.r32", dtype=np.float32).reshape(512, 512)
        self.walkable = np.fromfile(rdir / "walkable.u8", dtype=np.uint8).reshape(512, 512)
        self.map_art = np.array(Image.open(rdir / "map_art.png").convert("RGB").resize((512, 512), Image.Resampling.BILINEAR))
        self.orig_surf = np.array(Image.open(io.BytesIO(orig_surface_bytes)).convert("RGBA").resize((512, 512), Image.Resampling.BILINEAR))
        # Precompute eroded dry mask (2-cell margin away from water/lava edges)
        dry = (self.walkable > 0) & (self.orig_surf[:, :, 0] < 35) & (self.orig_surf[:, :, 1] < 35)
        self.dry = dry
        # Distance-like proximity to water / lava
        self.lava_mask = self.orig_surf[:, :, 0] > 40
        self.water_mask = self.orig_surf[:, :, 1] > 40
        # Compute 8-cell dilation for near-water / near-lava detection
        self.near_lava = self._dilate(self.lava_mask, 16)
        self.near_water = self._dilate(self.water_mask, 12)
        self.dry_safe = self._erode(dry, 2)
        self.dry_h_p50 = float(np.percentile(self.heights[dry], 50)) if dry.any() else 16.0
        self.dry_h_p78 = float(np.percentile(self.heights[dry], 78)) if dry.any() else 19.0
        self.dry_h_p88 = float(np.percentile(self.heights[dry], 88)) if dry.any() else 20.5

    @staticmethod
    def _dilate(mask: np.ndarray, r: int) -> np.ndarray:
        im = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
        im = im.filter(ImageFilter.MaxFilter(size=r * 2 + 1))
        return np.array(im) > 127

    @staticmethod
    def _erode(mask: np.ndarray, r: int) -> np.ndarray:
        im = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
        im = im.filter(ImageFilter.MinFilter(size=r * 2 + 1))
        return np.array(im) > 127

    def world_to_grid(self, x: float, z: float) -> tuple[int, int]:
        half = TARGET_WORLD_SIZE * 0.5
        u = (x + half) / TARGET_WORLD_SIZE
        v = (z + half) / TARGET_WORLD_SIZE
        gx = max(0, min(511, int(round(u * 511))))
        gz = max(0, min(511, int(round(v * 511))))
        return gx, gz

    def height_at(self, x: float, z: float) -> float:
        gx, gz = self.world_to_grid(x, z)
        return round(float(self.heights[gz, gx]), 2)

    def is_dry(self, x: float, z: float, safe_margin: bool = False) -> bool:
        half = TARGET_WORLD_SIZE * 0.5
        if abs(x) > half - 60.0 or abs(z) > half - 60.0:
            return False
        gx, gz = self.world_to_grid(x, z)
        return bool(self.dry_safe[gz, gx] if safe_margin else self.dry[gz, gx])

    def snap_dry(self, x: float, z: float, max_r: float = 220.0, safe_margin: bool = False) -> tuple[float, float]:
        if self.is_dry(x, z, safe_margin=safe_margin):
            return x, z
        for rad in range(8, int(max_r) + 1, 8):
            for k in range(24):
                ang = 2.0 * math.pi * k / 24.0
                cx = x + math.cos(ang) * rad
                cz = z + math.sin(ang) * rad
                if self.is_dry(cx, cz, safe_margin=safe_margin):
                    return cx, cz
        return x, z

    def rgb_at(self, x: float, z: float) -> tuple[int, int, int]:
        gx, gz = self.world_to_grid(x, z)
        r, g, b = self.map_art[gz, gx]
        return int(r), int(g), int(b)


# ---------------------------------------------------------------------------
# Sub-biome definitions & sprite palettes per continent
# Each palette entry: (sprite_path, w_min, w_max, aspect_h_over_w, weight, kind)
# ---------------------------------------------------------------------------

BIOME_PALETTES: dict[str, dict[str, list[tuple[str, int, int, float, float, str]]]] = {
    "pyra": {
        "kaldera": [
            ("res://assets/biomes/pyra_magma_geyser.webp", 360, 470, 1.05, 2.4, "landmark"),
            ("res://assets/biomes/pyra_fire_arch.webp", 420, 540, 1.08, 1.8, "landmark"),
            ("res://assets/biomes/pyra_obsidian_monolith.webp", 340, 460, 1.18, 2.2, "landmark"),
            ("res://assets/biomes/pyra_obsidian_bridge_arch.webp", 400, 510, 0.96, 1.3, "landmark"),
            ("res://assets/library/waterfalls/waterfall_lava_pyra.webp", 430, 510, 1.06, 0.7, "waterfall"),
            ("res://assets/objects/c3f1e31a-pyra-continent-fissure.webp", 260, 350, 0.78, 2.0, "terrain"),
            ("res://assets/objects/61486b9a-pyra-continent-obsidian-spire.webp", 280, 380, 1.25, 2.0, "rock"),
            ("res://assets/objects/49b51ecf-pyra-continent-crystals.webp", 220, 300, 1.05, 1.8, "crystal"),
        ],
        "ironwood": [
            ("res://assets/biomes/pyra_charred_ironwood.webp", 390, 500, 1.06, 3.0, "tree"),
            ("res://assets/objects/1cedcd5a-pyra-continent-maple.webp", 340, 440, 1.08, 2.5, "tree"),
            ("res://assets/objects/13373662-ki-v2-objects-pyra-oak-0.webp", 350, 450, 1.08, 2.2, "tree"),
            ("res://assets/objects/32e0d269-pyra-continent-lantern-bush.webp", 190, 260, 0.90, 2.0, "bush"),
            ("res://assets/objects/39416c5c-pyra-continent-copper-bush.webp", 180, 250, 0.90, 1.8, "bush"),
            ("res://assets/objects/0185c62b-pyra-continent-berry-bush.webp", 180, 245, 0.88, 1.5, "bush"),
            ("res://assets/library/props/prop_bonfire_pit.webp", 220, 270, 0.92, 0.7, "camp"),
        ],
        "sulfur": [
            ("res://assets/biomes/pyra_dragon_ribcage.webp", 430, 560, 0.92, 2.4, "landmark"),
            ("res://assets/biomes/pyra_sulfur_boulders.webp", 330, 440, 0.94, 3.0, "rock"),
            ("res://assets/objects/3d90558c-pyra-continent-rocks.webp", 240, 330, 0.85, 2.4, "rock"),
            ("res://assets/objects/9902b9c8-pyra-continent-dry-grass.webp", 180, 250, 0.82, 2.2, "grass"),
            ("res://assets/objects/5aa5d3c0-pyra-continent-rock-arch.webp", 360, 460, 0.96, 1.5, "landmark"),
            ("res://assets/objects/b6d73268-pyra-continent-cliff.webp", 360, 470, 0.92, 1.4, "cliff"),
        ],
        "fjords": [
            ("res://assets/biomes/pyra_war_totem.webp", 360, 470, 1.10, 2.4, "landmark"),
            ("res://assets/biomes/pyra_obsidian_monolith.webp", 330, 430, 1.15, 1.8, "landmark"),
            ("res://assets/objects/ae37503e-pyra-continent-pine.webp", 320, 420, 1.24, 2.6, "tree"),
            ("res://assets/objects/46e0b432-ki-v2-objects-pyra-pine-0.webp", 320, 415, 1.24, 2.2, "tree"),
            ("res://assets/library/fortifications/pyra-fort-ruined_wall.webp", 340, 420, 0.88, 1.2, "ruin"),
            ("res://assets/library/props/prop_waystone_pillar.webp", 210, 270, 1.20, 1.1, "ruin"),
            ("res://assets/library/props/prop_camp_tent.webp", 260, 320, 0.95, 0.7, "camp"),
        ],
        "coast": [
            ("res://assets/biomes/pyra_obsidian_bridge_arch.webp", 390, 480, 0.96, 1.4, "landmark"),
            ("res://assets/biomes/pyra_sulfur_boulders.webp", 300, 390, 0.92, 2.0, "rock"),
            ("res://assets/library/props/prop_harbor_boat.webp", 260, 320, 0.85, 1.4, "camp"),
            ("res://assets/library/props/prop_merchant_wagon.webp", 260, 320, 0.90, 1.2, "camp"),
            ("res://assets/library/props/prop_camp_tent.webp", 250, 310, 0.95, 1.2, "camp"),
            ("res://assets/objects/3d90558c-pyra-continent-rocks.webp", 220, 310, 0.85, 2.0, "rock"),
            ("res://assets/objects/0185c62b-pyra-continent-berry-bush.webp", 180, 240, 0.88, 1.8, "bush"),
        ],
    },
    "verdant": {
        "alpine": [
            ("res://assets/biomes/verdant_alpine_pines.webp", 380, 490, 1.12, 3.2, "tree"),
            ("res://assets/objects/aether-snow-pine2.webp", 320, 420, 1.25, 2.4, "tree"),
            ("res://assets/objects/aether-snow-rock.webp", 250, 340, 0.88, 2.2, "rock"),
            ("res://assets/objects/df63f301-verdantia-continent-pine.webp", 330, 425, 1.22, 2.2, "tree"),
            ("res://assets/objects/98845042-verdantia-extra-cliff.webp", 360, 460, 0.92, 1.4, "cliff"),
            ("res://assets/library/props/prop_waystone_pillar.webp", 210, 270, 1.20, 1.0, "ruin"),
        ],
        "druid": [
            ("res://assets/biomes/verdant_druid_dolmen.webp", 400, 520, 1.02, 2.5, "landmark"),
            ("res://assets/biomes/verdant_moss_shrine.webp", 390, 500, 1.04, 2.3, "landmark"),
            ("res://assets/biomes/verdant_hollow_stump.webp", 360, 460, 1.02, 2.4, "landmark"),
            ("res://assets/objects/74b2bb88-verdantia-extra-ancient-oak.webp", 390, 495, 1.06, 2.6, "tree"),
            ("res://assets/objects/8c447433-ki-v2-objects-verdant-oak-0.webp", 340, 430, 1.08, 2.0, "tree"),
            ("res://assets/objects/5b60f067-verdantia-extra-fern.webp", 170, 235, 0.86, 2.0, "bush"),
            ("res://assets/objects/fa6d3bf2-verdantia-extra-shrine.webp", 280, 350, 1.15, 1.1, "ruin"),
        ],
        "marsh": [
            ("res://assets/biomes/verdant_lotus_pond.webp", 360, 460, 0.88, 2.8, "landmark"),
            ("res://assets/biomes/verdant_glow_mushrooms.webp", 320, 420, 0.98, 2.6, "landmark"),
            ("res://assets/biomes/verdant_spring_waterfall.webp", 400, 500, 1.05, 1.4, "waterfall"),
            ("res://assets/library/waterfalls/waterfall_emerald_cascade.webp", 420, 500, 1.06, 1.0, "waterfall"),
            ("res://assets/objects/ce21ffe1-verdantia-extra-willow.webp", 350, 450, 1.06, 2.5, "tree"),
            ("res://assets/objects/68b9d6ee-verdantia-extra-mushrooms.webp", 175, 240, 0.90, 2.0, "bush"),
            ("res://assets/library/props/prop_harbor_boat.webp", 250, 310, 0.85, 0.9, "camp"),
        ],
        "sakura": [
            ("res://assets/biomes/verdant_sakura_lantern.webp", 390, 500, 1.05, 3.0, "landmark"),
            ("res://assets/objects/711c3cbc-verdantia-extra-birch.webp", 330, 425, 1.14, 2.4, "tree"),
            ("res://assets/objects/21caeb8f-ki-v2-objects-verdant-oak-1.webp", 340, 430, 1.08, 2.0, "tree"),
            ("res://assets/objects/48c51d4d-verdantia-extra-flowers.webp", 175, 240, 0.82, 2.2, "bush"),
            ("res://assets/objects/e70f7fe7-verdantia-extra-rose.webp", 175, 240, 0.86, 2.0, "bush"),
            ("res://assets/objects/27399570-verdantia-extra-blueberry.webp", 175, 235, 0.86, 1.6, "bush"),
            ("res://assets/library/props/prop_merchant_wagon.webp", 260, 320, 0.90, 0.8, "camp"),
        ],
        "cliffs": [
            ("res://assets/biomes/verdant_spring_waterfall.webp", 410, 510, 1.06, 2.2, "waterfall"),
            ("res://assets/library/waterfalls/waterfall_cliff_spring.webp", 420, 500, 1.06, 1.4, "waterfall"),
            ("res://assets/library/waterfalls/waterfall_forest_tall.webp", 420, 500, 1.08, 1.2, "waterfall"),
            ("res://assets/biomes/verdant_moss_shrine.webp", 380, 480, 1.04, 1.8, "landmark"),
            ("res://assets/objects/98845042-verdantia-extra-cliff.webp", 350, 450, 0.92, 2.2, "cliff"),
            ("res://assets/objects/701b11e2-verdantia-continent-rocks.webp", 240, 320, 0.86, 2.2, "rock"),
            ("res://assets/library/props/prop_ruined_archway.webp", 300, 380, 1.05, 1.2, "ruin"),
        ],
    },
    "aether": {
        "oasis": [
            ("res://assets/biomes/aether_hot_spring.webp", 390, 500, 0.94, 3.0, "landmark"),
            ("res://assets/objects/021d8442-aether-x-cherry-tree.webp", 350, 450, 1.08, 2.6, "tree"),
            ("res://assets/objects/ac1ecb7c-aetheria-continent-bamboo.webp", 310, 400, 1.18, 2.4, "tree"),
            ("res://assets/objects/dc095c5f-aetheria-continent-ginkgo.webp", 340, 430, 1.10, 2.2, "tree"),
            ("res://assets/objects/0e381537-aetheria-continent-flowers.webp", 180, 245, 0.84, 2.0, "bush"),
            ("res://assets/objects/5ac42fa2-aetheria-continent-lavender.webp", 180, 245, 0.88, 1.8, "bush"),
        ],
        "glacier": [
            ("res://assets/biomes/aether_glacier_arch.webp", 420, 540, 1.00, 2.8, "landmark"),
            ("res://assets/biomes/aether_ice_crystals.webp", 340, 440, 1.08, 2.8, "crystal"),
            ("res://assets/library/waterfalls/waterfall_frozen_aether.webp", 420, 500, 1.06, 1.3, "waterfall"),
            ("res://assets/library/props/prop_ice_glacier_arch.webp", 370, 460, 0.96, 1.6, "landmark"),
            ("res://assets/objects/6c34a261-aetheria-continent-glacier-ridge.webp", 340, 440, 0.95, 2.0, "cliff"),
            ("res://assets/objects/83749d6d-aetheria-continent-peak.webp", 350, 450, 1.05, 1.8, "cliff"),
            ("res://assets/objects/aether-ice-crystal.webp", 220, 300, 1.15, 2.0, "crystal"),
        ],
        "sanctuary": [
            ("res://assets/biomes/aether_marble_aqueduct.webp", 420, 540, 0.98, 2.5, "landmark"),
            ("res://assets/biomes/aether_astrolabe.webp", 380, 490, 1.06, 2.5, "landmark"),
            ("res://assets/biomes/aether_snow_gazebo.webp", 380, 480, 1.05, 2.2, "landmark"),
            ("res://assets/objects/aether-snow-shrine.webp", 270, 350, 1.24, 1.8, "ruin"),
            ("res://assets/objects/aether-ice-ruin.webp", 300, 385, 1.02, 1.6, "ruin"),
            ("res://assets/library/props/prop_guardian_statue.webp", 260, 340, 1.22, 1.4, "ruin"),
            ("res://assets/library/props/prop_runic_obelisk.webp", 240, 310, 1.26, 1.4, "ruin"),
        ],
        "taiga": [
            ("res://assets/biomes/aether_snow_pines.webp", 380, 490, 1.12, 3.2, "tree"),
            ("res://assets/biomes/aether_snow_obelisk.webp", 330, 430, 1.16, 2.2, "landmark"),
            ("res://assets/objects/3587a851-aetheria-continent-snow-pine.webp", 320, 420, 1.24, 2.4, "tree"),
            ("res://assets/objects/aether-snow-pine1.webp", 310, 400, 1.24, 2.2, "tree"),
            ("res://assets/objects/aether-snow-pine2.webp", 310, 405, 1.24, 2.0, "tree"),
            ("res://assets/library/props/prop_waystone_pillar.webp", 210, 270, 1.20, 1.1, "ruin"),
            ("res://assets/library/props/prop_bonfire_pit.webp", 220, 270, 0.92, 0.8, "camp"),
        ],
        "south_frost": [
            ("res://assets/biomes/aether_snow_gazebo.webp", 380, 470, 1.04, 2.0, "landmark"),
            ("res://assets/biomes/aether_astrolabe.webp", 360, 460, 1.06, 1.8, "landmark"),
            ("res://assets/biomes/aether_hot_spring.webp", 360, 450, 0.94, 1.4, "landmark"),
            ("res://assets/biomes/aether_ice_crystals.webp", 310, 400, 1.08, 2.0, "crystal"),
            ("res://assets/library/props/prop_camp_tent.webp", 260, 320, 0.95, 1.3, "camp"),
            ("res://assets/library/props/prop_harbor_boat.webp", 250, 310, 0.85, 1.0, "camp"),
            ("res://assets/objects/3587a851-aetheria-continent-snow-pine.webp", 310, 400, 1.24, 2.0, "tree"),
        ],
    },
    "nexus": {
        "scrapyard": [
            ("res://assets/biomes/nexus_mech_wreck.webp", 420, 540, 0.96, 2.8, "landmark"),
            ("res://assets/biomes/nexus_hover_wreck.webp", 400, 510, 0.92, 2.6, "landmark"),
            ("res://assets/biomes/nexus_cargo_stack.webp", 340, 440, 0.96, 2.2, "landmark"),
            ("res://assets/objects/fcf607db-nexus-continent-rocks.webp", 240, 330, 0.85, 2.2, "rock"),
            ("res://assets/library/fortifications/nexus-fort-ruined_wall.webp", 340, 420, 0.88, 1.4, "ruin"),
            ("res://assets/library/props/prop_ruined_archway.webp", 300, 380, 1.05, 1.0, "ruin"),
        ],
        "plasma": [
            ("res://assets/biomes/nexus_plasma_spire.webp", 370, 480, 1.18, 2.8, "landmark"),
            ("res://assets/biomes/nexus_plasma_pylon.webp", 340, 440, 1.16, 2.6, "landmark"),
            ("res://assets/biomes/nexus_reactor_ruin.webp", 390, 500, 0.98, 2.2, "landmark"),
            ("res://assets/library/waterfalls/waterfall_plasma_nexus.webp", 420, 500, 1.06, 1.2, "waterfall"),
            ("res://assets/objects/54c3c2b2-nexus-continent-monolith.webp", 280, 360, 1.32, 1.8, "ruin"),
            ("res://assets/objects/4c52045f-nexus-continent-crystal-outcrop.webp", 240, 320, 1.06, 2.0, "crystal"),
        ],
        "biolum": [
            ("res://assets/biomes/nexus_holo_monolith.webp", 370, 480, 1.14, 2.4, "landmark"),
            ("res://assets/objects/1cf54e0a-nexus-continent-cyan-tree.webp", 360, 465, 1.10, 2.6, "tree"),
            ("res://assets/objects/b2924462-nexus-continent-crystal-tree.webp", 360, 465, 1.10, 2.6, "tree"),
            ("res://assets/objects/f42c644b-nexus-continent-violet-tree.webp", 350, 450, 1.10, 2.0, "tree"),
            ("res://assets/objects/9b396bb1-nexus-continent-luminous-grass.webp", 180, 240, 0.86, 2.2, "bush"),
            ("res://assets/objects/fce0ef4d-nexus-continent-mushrooms.webp", 175, 235, 0.94, 2.0, "bush"),
            ("res://assets/objects/caef9d12-nexus-continent-fern.webp", 175, 235, 0.86, 1.8, "bush"),
        ],
        "solar": [
            ("res://assets/biomes/nexus_solar_dish.webp", 390, 500, 1.04, 3.0, "landmark"),
            ("res://assets/biomes/nexus_cargo_stack.webp", 340, 440, 0.96, 2.4, "landmark"),
            ("res://assets/biomes/nexus_plasma_pylon.webp", 330, 430, 1.15, 2.2, "landmark"),
            ("res://assets/objects/24d5db1c-nexus-continent-silver-cypress.webp", 310, 405, 1.42, 2.2, "tree"),
            ("res://assets/library/props/prop_ancient_portal.webp", 330, 420, 1.12, 1.0, "ruin"),
            ("res://assets/library/props/prop_waystone_pillar.webp", 210, 270, 1.20, 1.2, "ruin"),
        ],
        "silicon": [
            ("res://assets/biomes/nexus_reactor_ruin.webp", 390, 500, 0.98, 2.4, "landmark"),
            ("res://assets/biomes/nexus_holo_monolith.webp", 360, 470, 1.14, 2.2, "landmark"),
            ("res://assets/objects/f42c644b-nexus-continent-violet-tree.webp", 350, 450, 1.10, 2.6, "tree"),
            ("res://assets/objects/dca04e0f-nexus-continent-violet-bush.webp", 185, 250, 0.89, 2.4, "bush"),
            ("res://assets/objects/4c52045f-nexus-continent-crystal-outcrop.webp", 240, 320, 1.06, 2.2, "crystal"),
            ("res://assets/library/props/prop_camp_tent.webp", 260, 320, 0.95, 1.0, "camp"),
        ],
    },
}

SUB_BIOME_LABELS: dict[str, dict[str, str]] = {
    "pyra": {
        "kaldera": "Wulkaniczna Kaldera",
        "ironwood": "Spalony Las Żelazodrzewu",
        "sulfur": "Cmentarzysko Smoków i Siarkowe Pustkowia",
        "fjords": "Północne Fiordy Bazaltowe",
        "coast": "Szlak Kupiecki i Wybrzeże Popiołu",
    },
    "verdant": {
        "alpine": "Ośnieżone Szczyty Północy",
        "druid": "Pradawna Puszcza Druidów",
        "marsh": "Świetliste Mokradła Lotosowe",
        "sakura": "Kwitnące Doliny Sakury",
        "cliffs": "Kaskadowe Klify i Ruiny",
    },
    "aether": {
        "oasis": "Szmaragdowa Oaza Gorących Źródeł",
        "glacier": "Kryształowe Lodowce Zachodu",
        "sanctuary": "Tarasowe Sanktuaria i Akwedukty",
        "taiga": "Śnieżna Tajga Obelisków",
        "south_frost": "Południowe Krańce Mrozu",
    },
    "nexus": {
        "scrapyard": "Cmentarzysko Mechów i Wraków",
        "plasma": "Pola Plazmowe Kanału Chłodzącego",
        "biolum": "Bioluminescencyjne Ogrody Kryształowe",
        "solar": "Sektor Solarny i Przekaźniki",
        "silicon": "Dolina Fioletowego Krzemu",
    },
}


def classify_sub_biome(land: str, x: float, z: float, ts: TerrainSampler, cap_x: float, cap_z: float) -> str:
    gx, gz = ts.world_to_grid(x, z)
    r, g, b = ts.rgb_at(x, z)
    h = float(ts.heights[gz, gx])
    near_lava = bool(ts.near_lava[gz, gx])
    near_water = bool(ts.near_water[gz, gx])
    dx = x - cap_x
    dz = z - cap_z

    if land == "pyra":
        if near_lava:
            return "kaldera"
        if dz < -340:
            return "fjords"
        if dx < -260:
            return "ironwood"
        if dx > 240 and dz > -340:
            return "sulfur"
        if near_water or dz > 520:
            return "coast"
        return "kaldera" if (r > 150 and g < 105) else "ironwood"

    if land == "verdant":
        # Bright snow in canonical map_art.png (NE mountains — NEVER spawn snow props on emerald grass!)
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        sat = max(r, g, b) - min(r, g, b)
        if lum > 152 and sat < 48 and g <= r + 18:
            return "alpine"
        if near_water and z > -150:
            return "marsh"
        if h >= ts.dry_h_p78:
            return "cliffs"
        if x < -120:
            return "druid"
        return "sakura"

    if land == "aether":
        # NW emerald oasis in canonical map_art.png!
        if (g > r + 14 and g > b + 6) or (x < -420 and z < -320):
            return "oasis"
        if x < -180 and z >= -320:
            return "glacier"
        if z > 420:
            return "south_frost"
        if x > 260 and z < 350:
            return "sanctuary"
        return "taiga"

    # nexus
    if near_water:
        return "plasma"
    if x < -260 and z > -260:
        return "scrapyard"
    if z < -280:
        return "biolum"
    if x > 360 and z < 320:
        return "solar"
    return "silicon"


def rasterize_roads_into_surface(land: str, orig_surface_bytes: bytes, roads: list[dict]) -> Image.Image:
    """Keep R (lava), G (water), A (energy) intact; re-rasterize B (roads) cleanly at 1024x1024."""
    orig = Image.open(io.BytesIO(orig_surface_bytes)).convert("RGBA")
    upscaled = orig.resize((SURFACE_RES, SURFACE_RES), Image.Resampling.BILINEAR)
    arr = np.array(upscaled)
    # Clear old blue (road) channel completely
    road_img = Image.new("L", (SURFACE_RES, SURFACE_RES), 0)
    draw = ImageDraw.Draw(road_img)
    half = TARGET_WORLD_SIZE * 0.5

    tier_widths = {
        "highway": 5,
        "city": 4,
        "regional": 4,
        "footpath": 3,
    }
    for rd in roads:
        pts = rd.get("pts", [])
        if len(pts) < 2:
            continue
        w = tier_widths.get(rd.get("tier", "footpath"), 3)
        px_pts = [
            ((float(p[0]) + half) / TARGET_WORLD_SIZE * (SURFACE_RES - 1),
             (float(p[1]) + half) / TARGET_WORLD_SIZE * (SURFACE_RES - 1))
            for p in pts
        ]
        draw.line(px_pts, fill=245, width=w, joint="curve")

    # Slight gaussian soften for organic cobblestone edges in terrain.gdshader
    road_img = road_img.filter(ImageFilter.GaussianBlur(radius=0.8))
    road_arr = np.array(road_img)
    # Suppress road painting over deep water/lava (bridges sit visually over water)
    wet = (arr[:, :, 0] > 90) | (arr[:, :, 1] > 90)
    road_arr[wet] = np.minimum(road_arr[wet], 40)
    arr[:, :, 2] = road_arr
    return Image.fromarray(arr, mode="RGBA")


def build_road_clearance_mask(roads: list[dict], res: int = 512) -> np.ndarray:
    im = Image.new("L", (res, res), 0)
    draw = ImageDraw.Draw(im)
    half = TARGET_WORLD_SIZE * 0.5
    for rd in roads:
        pts = rd.get("pts", [])
        if len(pts) < 2:
            continue
        px_pts = [
            ((float(p[0]) + half) / TARGET_WORLD_SIZE * (res - 1),
             (float(p[1]) + half) / TARGET_WORLD_SIZE * (res - 1))
            for p in pts
        ]
        draw.line(px_pts, fill=255, width=7)
    return np.array(im) > 127


def expand_continent(land: str, git_ref: str | None) -> dict:
    raw_json = load_source_bytes(land, "buildings.json", git_ref)
    orig_surf_bytes = load_source_bytes(land, "surface.png", git_ref)
    data = json.loads(raw_json.decode("utf-8"))
    if abs(float(data.get("world_size", 1024.0)) - 1024.0) > 1.0:
        raise RuntimeError(
            f"{land}/buildings.json already has world_size={data.get('world_size')}; "
            f"re-run with --from-git HEAD (or original 1024 ref) to avoid double-scaling."
        )

    ts = TerrainSampler(land, orig_surf_bytes)
    old_cx, old_cz = float(data["capital_center"][0]), float(data["capital_center"][1])
    new_cx, new_cz = old_cx * SCALE_FACTOR, old_cz * SCALE_FACTOR
    new_cx, new_cz = ts.snap_dry(new_cx, new_cz, max_r=120.0, safe_margin=True)

    # 1. Buildings: capital cluster stays compact (1.08x), outer towns/bridges stay at exact 4.0x canonical UV
    new_buildings = []
    for b in data.get("buildings", []):
        bc = dict(b)
        bx, bz = float(b["x"]), float(b["z"])
        mk = str(b.get("map_kind", ""))
        role = str(b.get("role", ""))
        dist_old = math.hypot(bx - old_cx, bz - old_cz)
        ent_off = None
        if "entrance" in b and isinstance(b["entrance"], list) and len(b["entrance"]) >= 2:
            ent_off = (float(b["entrance"][0]) - bx, float(b["entrance"][1]) - bz)

        is_capital_cluster = (mk in ("capital", "service", "house", "prop")) or (mk == "fort" and dist_old < 210.0)
        if is_capital_cluster:
            nx = new_cx + (bx - old_cx) * CAP_OFFSET_SCALE
            nz = new_cz + (bz - old_cz) * CAP_OFFSET_SCALE
            nx, nz = ts.snap_dry(nx, nz, max_r=140.0)
        elif role == "bridge":
            nx = bx * SCALE_FACTOR
            nz = bz * SCALE_FACTOR
        else:
            nx = bx * SCALE_FACTOR
            nz = bz * SCALE_FACTOR
            nx, nz = ts.snap_dry(nx, nz, max_r=180.0, safe_margin=True)

        bc["x"] = round(nx, 2)
        bc["z"] = round(nz, 2)
        bc["y"] = ts.height_at(nx, nz)
        if ent_off is not None:
            ex, ez = nx + ent_off[0], nz + ent_off[1]
            ex, ez = ts.snap_dry(ex, ez, max_r=60.0)
            bc["entrance"] = [round(ex, 2), round(ez, 2)]
        new_buildings.append(bc)

    # 2. Roads: smooth C1 radial transition from compact capital (1.08x) out to exact 4.0x canonical UV
    new_roads = []
    for rd in data.get("roads", []):
        tier = str(rd.get("tier", "footpath"))
        pts = rd.get("pts", [])
        out_pts = []
        for p in pts:
            px, pz = float(p[0]), float(p[1])
            if tier == "city":
                nx = new_cx + (px - old_cx) * CAP_OFFSET_SCALE
                nz = new_cz + (pz - old_cz) * CAP_OFFSET_SCALE
            else:
                nx, nz = remap_radial(px, pz, old_cx, old_cz, new_cx, new_cz)
            out_pts.append([round(nx, 2), round(nz, 2)])
        new_roads.append({"tier": tier, "pts": out_pts})

    # 3. Capital NPCs: stay right inside the compact capital
    new_npcs = []
    for n in data.get("npcs", []):
        nc = dict(n)
        nx = new_cx + (float(n["x"]) - old_cx) * CAP_OFFSET_SCALE
        nz = new_cz + (float(n["z"]) - old_cz) * CAP_OFFSET_SCALE
        nx, nz = ts.snap_dry(nx, nz, max_r=90.0)
        nc["x"] = round(nx, 2)
        nc["z"] = round(nz, 2)
        nc["y"] = ts.height_at(nx, nz)
        new_npcs.append(nc)

    # 4. Fauna: scale existing 18 to 4.0x + add 14 roaming wilderness animals across the 16x area
    rng = random.Random(hash(("ki-expand-v2", land)) & 0xFFFFFFFF)
    new_fauna = []
    fauna_templates = []
    for fa in data.get("fauna", []):
        fc = dict(fa)
        fx, fz = float(fa["x"]) * SCALE_FACTOR, float(fa["z"]) * SCALE_FACTOR
        fx, fz = ts.snap_dry(fx, fz, max_r=200.0, safe_margin=True)
        fc["x"] = round(fx, 2)
        fc["z"] = round(fz, 2)
        fc["y"] = ts.height_at(fx, fz)
        fc["patrol_radius"] = round(float(fa.get("patrol_radius", 14.0)) * 1.4, 1)
        new_fauna.append(fc)
        fauna_templates.append((fc["actor_id"], fc["name"]))

    if fauna_templates:
        added_f = 0
        for _ in range(400):
            if added_f >= 14:
                break
            fx = rng.uniform(-1750.0, 1750.0)
            fz = rng.uniform(-1750.0, 1750.0)
            if math.hypot(fx - new_cx, fz - new_cz) < SAFE_CITY_RADIUS + 140.0:
                continue
            if not ts.is_dry(fx, fz, safe_margin=True):
                continue
            aid, aname = fauna_templates[added_f % len(fauna_templates)]
            new_fauna.append({
                "actor_id": aid,
                "name": aname,
                "x": round(fx, 2),
                "z": round(fz, 2),
                "y": ts.height_at(fx, fz),
                "patrol_radius": 22.0,
            })
            added_f += 1

    # 5. Diverse Sub-Biome Landscape Props (720-780 curated landmarks, clusters & flora!)
    road_mask = build_road_clearance_mask(new_roads, res=512)
    bldg_pts = [(float(b["x"]), float(b["z"]), float(b.get("footprint_r", 28.0)) + 52.0) for b in new_buildings]

    def clears_buildings_and_roads(px: float, pz: float, pad: float = 0.0) -> bool:
        gx, gz = ts.world_to_grid(px, pz)
        if road_mask[gz, gx]:
            return False
        for bx, bz, br in bldg_pts:
            if math.hypot(px - bx, pz - bz) < br + pad:
                return False
        return True

    new_props: list[dict] = []
    placed_xy: list[tuple[float, float, float]] = []
    sub_biome_counts: dict[str, int] = {}
    sub_biome_sums: dict[str, list[float]] = {}

    def can_place_prop(px: float, pz: float, min_sep: float) -> bool:
        if not ts.is_dry(px, pz, safe_margin=True):
            return False
        if not clears_buildings_and_roads(px, pz):
            return False
        # Keep tight spatial hash check fast
        for ox, oz, orad in placed_xy:
            if abs(px - ox) < min_sep + orad and abs(pz - oz) < min_sep + orad:
                if math.hypot(px - ox, pz - oz) < max(min_sep, orad):
                    return False
        return True

    # 5a) Keep a small curated ring of tasteful capital trees/bushes right around the outer capital rim
    palettes = BIOME_PALETTES[land]
    all_dry_coords = np.argwhere(ts.dry_safe)
    # Shuffle dry cells deterministically for even continent-wide coverage
    idxs = list(range(len(all_dry_coords)))
    rng.shuffle(idxs)

    # First pass: 110 hero POI clusters (landmark centerpiece + 2-3 companion trees/rocks in same sub-biome!)
    cluster_count = 0
    for idx in idxs:
        if cluster_count >= 125:
            break
        gz, gx = int(all_dry_coords[idx][0]), int(all_dry_coords[idx][1])
        px = (gx / 511.0 - 0.5) * TARGET_WORLD_SIZE + rng.uniform(-3.0, 3.0)
        pz = (gz / 511.0 - 0.5) * TARGET_WORLD_SIZE + rng.uniform(-3.0, 3.0)
        if math.hypot(px - new_cx, pz - new_cz) < SAFE_CITY_RADIUS + 40.0:
            continue
        if not can_place_prop(px, pz, 118.0):
            continue

        sb = classify_sub_biome(land, px, pz, ts, new_cx, new_cz)
        pal = palettes[sb]
        # Prefer centerpiece landmarks / waterfalls / ruins
        landmarks_only = [item for item in pal if item[5] in ("landmark", "waterfall", "cliff", "ruin")]
        pool = landmarks_only if landmarks_only else pal
        weights = [item[4] for item in pool]
        chosen = rng.choices(pool, weights=weights, k=1)[0]
        sp, wmin, wmax, asp, _wt, kind = chosen
        w = int(rng.uniform(wmin, wmax))
        h = int(w * asp)

        new_props.append({
            "id": f"{land}-sb-{sb}-{len(new_props)}",
            "kind": kind,
            "sub_biome": sb,
            "sprite": sp,
            "w": w,
            "h": h,
            "x": round(px, 2),
            "z": round(pz, 2),
            "y": ts.height_at(px, pz),
        })
        placed_xy.append((px, pz, 56.0))
        sub_biome_counts[sb] = sub_biome_counts.get(sb, 0) + 1
        s = sub_biome_sums.setdefault(sb, [0.0, 0.0, 0.0])
        s[0] += px
        s[1] += pz
        s[2] += 1.0
        cluster_count += 1

        # Add 2-3 natural companion props around the centerpiece (trees, bushes, crystals, rocks)
        companions = [item for item in pal if item[5] in ("tree", "bush", "rock", "crystal", "grass", "terrain")]
        if not companions:
            companions = pal
        comp_w = [item[4] for item in companions]
        n_comp = rng.randint(2, 3)
        for _ in range(n_comp):
            ang = rng.uniform(0.0, math.tau)
            dist = rng.uniform(52.0, 115.0)
            cx_p = px + math.cos(ang) * dist
            cz_p = pz + math.sin(ang) * dist
            if math.hypot(cx_p - new_cx, cz_p - new_cz) < SAFE_CITY_RADIUS + 20.0:
                continue
            if not can_place_prop(cx_p, cz_p, 38.0):
                continue
            c_sp, cwmin, cwmax, casp, _cwt, ckind = rng.choices(companions, weights=comp_w, k=1)[0]
            cw = int(rng.uniform(cwmin, cwmax))
            ch = int(cw * casp)
            new_props.append({
                "id": f"{land}-sb-{sb}-{len(new_props)}",
                "kind": ckind,
                "sub_biome": sb,
                "sprite": c_sp,
                "w": cw,
                "h": ch,
                "x": round(cx_p, 2),
                "z": round(cz_p, 2),
                "y": ts.height_at(cx_p, cz_p),
            })
            placed_xy.append((cx_p, cz_p, 34.0))
            sub_biome_counts[sb] = sub_biome_counts.get(sb, 0) + 1

    # Second pass: fill remaining open wilderness smoothly up to ~740 total landscape props
    target_total = 740
    for idx in idxs:
        if len(new_props) >= target_total:
            break
        gz, gx = int(all_dry_coords[idx][0]), int(all_dry_coords[idx][1])
        px = (gx / 511.0 - 0.5) * TARGET_WORLD_SIZE + rng.uniform(-4.0, 4.0)
        pz = (gz / 511.0 - 0.5) * TARGET_WORLD_SIZE + rng.uniform(-4.0, 4.0)
        dist_cap = math.hypot(px - new_cx, pz - new_cz)
        if dist_cap < SAFE_CITY_RADIUS - 35.0:
            # Sparse decorative trees/bushes only in outer capital park margins
            if dist_cap < 155.0:
                continue
        if not can_place_prop(px, pz, 66.0):
            continue

        sb = classify_sub_biome(land, px, pz, ts, new_cx, new_cz)
        pal = palettes[sb]
        weights = [item[4] for item in pal]
        sp, wmin, wmax, asp, _wt, kind = rng.choices(pal, weights=weights, k=1)[0]
        w = int(rng.uniform(wmin, wmax))
        h = int(w * asp)
        new_props.append({
            "id": f"{land}-sb-{sb}-{len(new_props)}",
            "kind": kind,
            "sub_biome": sb,
            "sprite": sp,
            "w": w,
            "h": h,
            "x": round(px, 2),
            "z": round(pz, 2),
            "y": ts.height_at(px, pz),
        })
        placed_xy.append((px, pz, 46.0))
        sub_biome_counts[sb] = sub_biome_counts.get(sb, 0) + 1
        s = sub_biome_sums.setdefault(sb, [0.0, 0.0, 0.0])
        s[0] += px
        s[1] += pz
        s[2] += 1.0

    # Build sub_biomes region list for HUD / minimap region announcements & spawn sketch labels
    sub_biomes = []
    for sb_key, sb_name in SUB_BIOME_LABELS[land].items():
        if sb_key in sub_biome_sums and sub_biome_sums[sb_key][2] > 0:
            sx, sz, cnt = sub_biome_sums[sb_key]
            sub_biomes.append({
                "id": sb_key,
                "name": sb_name,
                "x": round(sx / cnt, 1),
                "z": round(sz / cnt, 1),
                "props_count": sub_biome_counts.get(sb_key, 0),
            })

    # Re-rasterize crisp 1024x1024 road channel in surface.png (keeping R/G/A untouched!)
    new_surface = rasterize_roads_into_surface(land, orig_surf_bytes, new_roads)
    new_surface.save(REGIONS_DIR / land / "surface.png", optimize=True)

    out_data = {
        "land_id": land,
        "world_size": TARGET_WORLD_SIZE,
        "grid_size": int(data.get("grid_size", 512)),
        "safe_city_radius": SAFE_CITY_RADIUS,
        "capital_center": [round(new_cx, 2), round(new_cz, 2)],
        "sub_biomes": sub_biomes,
        "roads": new_roads,
        "buildings": new_buildings,
        "npcs": new_npcs,
        "exp_zones": [],
        "monsters": [],
        "fauna": new_fauna,
        "props": new_props,
    }
    (REGIONS_DIR / land / "buildings.json").write_text(
        json.dumps(out_data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    return {
        "land": land,
        "world_size": TARGET_WORLD_SIZE,
        "safe_city_radius": SAFE_CITY_RADIUS,
        "capital_center": out_data["capital_center"],
        "buildings": len(new_buildings),
        "roads": len(new_roads),
        "npcs": len(new_npcs),
        "fauna": len(new_fauna),
        "props": len(new_props),
        "sub_biomes": sub_biome_counts,
        "surface_kb": round((REGIONS_DIR / land / "surface.png").stat().st_size / 1024.0, 1),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-git", default=None, help="Git ref to read original 1024m buildings.json & surface.png from (e.g. HEAD)")
    args = parser.parse_args()
    summary = []
    for land in ("pyra", "verdant", "aether", "nexus"):
        summary.append(expand_continent(land, args.from_git))
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
