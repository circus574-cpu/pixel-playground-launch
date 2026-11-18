#!/usr/bin/env python3
"""
Blender 4.5.3 Geometry Nodes + Hand-Dressed Masonry Fortification Generator for KI Legends.
Uses /workspace/ki-superior-iso/pyra-citadel/common.py and Blender GeometryNodeTree modifiers
to generate high-detail isometric perimeter walls, bastion towers, and terrace balustrades
for Pyra, Verdantia, Aetheria, and Nexus-9.
"""
import json
import math
import os
import random
import runpy
import sys
from pathlib import Path

import bpy
from mathutils import Vector

COMMON_DIR = Path("/workspace/ki-superior-iso/pyra-citadel")
OUT_DIR = Path("/workspace/ki-world-iso-20261118/fortifications_raw")
OUT_DIR.mkdir(parents=True, exist_ok=True)

sys.argv = [
    str(COMMON_DIR / "common.py"),
    "--",
    "--contract", str(COMMON_DIR / "contract.json"),
    "--buildings", str(COMMON_DIR / "empty.json"),
    "--output", str(OUT_DIR),
]
lib = runpy.run_path(str(COMMON_DIR / "common.py"))
settings = lib["scene_setup"].__globals__
settings["contract"]["camera"].update(target_height_m=5.0, ortho_scale_m=38.0, resolution=1024)
settings["contract"]["render"].update(samples=40)

box, beam, cylinder, material = (lib[f] for f in ("box", "beam", "cylinder", "material"))
rng = random.Random(20261118)


def apply_geonodes_battlement_studs(target_obj, stud_mat, count_x=7, span_x=10.5, z_top=4.25, radius=0.18):
    """Creates a Blender GeometryNodeTree that instances decorative masonry/rivet studs along the wall crest."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=(0, 0, -50))
    stud_proto = bpy.context.object
    stud_proto.name = f"{target_obj.name}_StudProto"
    stud_proto.data.materials.append(stud_mat)

    mod = target_obj.modifiers.new(name="GeoNodesBattlement", type="NODES")
    node_group = bpy.data.node_groups.new(name=f"GN_{target_obj.name}", type="GeometryNodeTree")
    mod.node_group = node_group

    # Interface sockets (Blender 4.0+)
    node_group.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    node_group.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")

    nodes = node_group.nodes
    links = node_group.links
    nodes.clear()

    n_in = nodes.new("NodeGroupInput")
    n_out = nodes.new("NodeGroupOutput")
    n_join = nodes.new("GeometryNodeJoinGeometry")
    n_line = nodes.new("GeometryNodeMeshLine")
    n_line.mode = "END_POINTS"
    n_line.inputs["Count"].default_value = count_x
    n_line.inputs["Start Location"].default_value = (-span_x * 0.5, 0.0, z_top)
    n_line.inputs["Offset"].default_value = (span_x * 0.5, 0.0, z_top)

    n_obj = nodes.new("GeometryNodeObjectInfo")
    n_obj.inputs["Object"].default_value = stud_proto
    n_obj.transform_space = "ORIGINAL"

    n_inst = nodes.new("GeometryNodeInstanceOnPoints")
    n_real = nodes.new("GeometryNodeRealizeInstances")

    links.new(n_in.outputs["Geometry"], n_join.inputs["Geometry"])
    links.new(n_line.outputs["Mesh"], n_inst.inputs["Points"])
    links.new(n_obj.outputs["Geometry"], n_inst.inputs["Instance"])
    links.new(n_inst.outputs["Instances"], n_real.inputs["Geometry"])
    links.new(n_real.outputs["Geometry"], n_join.inputs["Geometry"])
    links.new(n_join.outputs["Geometry"], n_out.inputs["Geometry"])


def build_masonry_wall( tones, cap_mat, accent_mat, glow_mat, rotate_nw=False, style="pyra"):
    root = bpy.data.objects.new("WallRoot", None)
    bpy.context.collection.objects.link(root)

    def parent(o):
        o.parent = root
        return o

    foot = parent(box("Footing", (0, 0, 0.35), (11.8, 3.1, 0.7), tones[0], 0.10))
    rows = 4
    for row in range(rows):
        ends = [-5.8] + ([-4.45, -1.48, 1.48, 4.45] if row % 2 else [-2.91, 0, 2.91]) + [5.8]
        for i, (a, b) in enumerate(zip(ends, ends[1:])):
            tone = tones[(row + i) % len(tones)]
            parent(box(
                f"Ashlar_{row}_{i}",
                ((a + b) / 2, 0, 0.98 + row * 0.74),
                (b - a - 0.06, 2.30 - row * 0.10, 0.72),
                tone,
                0.09,
            ))

    for x in (-4.35, -1.45, 1.45, 4.35):
        parent(box("CapStone", (x, 0, 3.98), (2.84, 2.72, 0.48), cap_mat, 0.10))

    # Merlons & buttresses
    for x in (-4.8, -1.6, 1.6, 4.8):
        parent(box("Merlon", (x, 0.65, 4.55), (1.35, 1.15, 0.72), cap_mat, 0.09))
    for x in (-5.0, 0.0, 5.0):
        parent(box("Buttress", (x, 1.08, 1.85), (1.18, 1.24, 3.10), tones[0], 0.09))
        parent(box("AccentTrim", (x, 1.68, 2.15), (0.45, 0.18, 2.10), accent_mat, 0.04))

    # Glowing inlay strip along the wall face
    parent(box("GlowInlay", (0, 1.22, 2.55), (11.2, 0.16, 0.24), glow_mat, 0.03))
    parent(box("AccentBand", (0, 1.20, 3.68), (11.4, 0.22, 0.20), accent_mat, 0.04))

    if style == "verdant":
        # Timber beams & mossy coping
        for x in (-3.2, 3.2):
            parent(beam("TimberPost", (x, 1.28, 0.4), (x, 1.28, 4.3), 0.22, accent_mat))
    elif style == "aether":
        # Marble pillars & gold floating orbs
        for x in (-3.2, 0.0, 3.2):
            parent(cylinder("MarblePillar", (x, 1.18, 2.4), 0.28, 3.8, cap_mat, 16))
    elif style == "nexus":
        # Cyber pylons & plasma conduits
        for x in (-3.4, 3.4):
            parent(box("CyberPylon", (x, 1.24, 2.6), (0.65, 0.55, 4.4), cap_mat, 0.06))
            parent(box("PlasmaCore", (x, 1.52, 2.6), (0.24, 0.14, 3.8), glow_mat, 0.02))

    # Apply Geometry Nodes stud/crystal array along the top
    apply_geonodes_battlement_studs(foot, glow_mat if style in ("aether", "nexus") else accent_mat)

    if rotate_nw:
        root.rotation_euler.z = math.radians(90.0)


def build_pyra_tower(palette, stone):
    x = 0.0
    box("Foundation", (x, 0, 0.5), (6.2, 6.2, 1.0), palette["basalt"])
    for row in range(9):
        for col in range(3):
            dx = (col - 1) * 1.63 + 0.13 * (row % 2)
            tone = stone[(row * 2 + col) % len(stone)]
            box("FacadeAshlar", (x + dx, 2.50, 1.4 + row * 0.94), (1.61, 0.63, 0.93), tone, 0.08)
            box("ReturnAshlar", (x + 2.53, dx, 1.4 + row * 0.94), (0.58, 1.63, 0.91), tone, 0.08)
    core = box("TowerCore", (x, 0, 4.7), (4.95, 4.95, 8.7), palette["basalt"], 0.16)
    box("Cornice", (x, 0, 9.14), (5.8, 5.8, 0.55), palette["stone_edge"])
    box("BronzeSeam", (x, 0, 9.51), (5.65, 5.65, 0.14), palette["gold"])
    lib["roof"](5.3, 5.3, 9.7, 3.15)
    for dx in (-1.55, 1.55):
        box("CopperThroat", (x + dx, 2.86, 5.48), (0.9, 0.19, 2.05), palette["gold"], 0.09)
        box("ArrowSlit", (x + dx, 2.97, 5.48), (0.54, 0.08, 1.74), palette["embers"], 0.07)
    box("BannerRoll", (x, 3.05, 8.33), (2.4, 0.28, 0.21), palette["gold"], 0.07)
    box("CrimsonPennant", (x, 3.05, 6.72), (1.76, 0.12, 3.1), palette["cloth"], 0.08)
    lib["lantern"](x, 3.02, 3.25)
    apply_geonodes_battlement_studs(core, palette["gold"], count_x=5, span_x=4.8, z_top=9.45, radius=0.16)


JOBS = [
    ("pyra-tower", "tower", False),
    ("pyra-wall-nw", "pyra", True),
    ("verdant-wall-ne", "verdant", False),
    ("verdant-wall-nw", "verdant", True),
    ("aether-wall-ne", "aether", False),
    ("aether-wall-nw", "aether", True),
    ("nexus-wall-ne", "nexus", False),
    ("nexus-wall-nw", "nexus", True),
]

for name, style, rot_nw in JOBS:
    scene, gpus = lib["scene_setup"]()
    scene.cycles.use_denoising = False
    palette = {
        key: material(
            key,
            color,
            0.58 if key == "gold" else 0.07,
            0.5 if key == "gold" else 0.72,
            1.85 if key == "embers" else 0,
        )
        for key, color in settings["contract"]["palette"].items()
    }
    settings["mats"] = palette

    if style == "tower":
        stone = [material("basalt", shade, roughness=0.86) for shade in ("332b34", "443643", "3a303b", "4f3d48", "392e35")]
        build_pyra_tower(palette, stone)
    elif style == "pyra":
        stone = [material("basalt", shade, roughness=0.86) for shade in ("332b34", "443643", "3a303b", "4f3d48", "392e35")]
        build_masonry_wall(stone, palette["stone_edge"], palette["gold"], palette["embers"], rotate_nw=rot_nw, style="pyra")
    elif style == "verdant":
        stone = [material("limestone", shade, roughness=0.82) for shade in ("586452", "6b7862", "4d5947", "78856d", "5f6e56")]
        cap = material("moss_cap", "3d6b37", roughness=0.78)
        timber = material("oak_timber", "6b482b", roughness=0.75)
        glow = material("emerald_rune", "4dff98", metallic=0.1, roughness=0.3, emission=1.6)
        build_masonry_wall(stone, cap, timber, glow, rotate_nw=rot_nw, style="verdant")
    elif style == "aether":
        stone = [material("marble", shade, roughness=0.45) for shade in ("d8e2eb", "e8eff5", "c5d2de", "f0f5fa", "cfdbe6")]
        cap = material("marble_cap", "f5f8fc", roughness=0.38)
        gold = material("aether_gold", "e6b85c", metallic=0.72, roughness=0.35)
        glow = material("cyan_ki", "63f2ff", metallic=0.1, roughness=0.25, emission=1.9)
        build_masonry_wall(stone, cap, gold, glow, rotate_nw=rot_nw, style="aether")
    elif style == "nexus":
        stone = [material("alloy", shade, metallic=0.65, roughness=0.38) for shade in ("1d2430", "263040", "171d26", "2e3b4e", "212a38")]
        cap = material("titanium_cap", "39495e", metallic=0.75, roughness=0.32)
        trim = material("chrome_trim", "7a93b0", metallic=0.82, roughness=0.28)
        glow = material("plasma_cyan", "00f0ff", metallic=0.1, roughness=0.2, emission=2.4)
        build_masonry_wall(stone, cap, trim, glow, rotate_nw=rot_nw, style="nexus")

    out_png = OUT_DIR / f"{name}.png"
    scene.render.filepath = str(out_png)
    bpy.ops.render.render(write_still=True)
    print(f"GEONODES_FORT_DONE {name} -> {out_png}", flush=True)
