#!/usr/bin/env python3
"""
Blender 4.0+ Python API script for KI Legends:
1. Models 3D .glb meshes for Terrain3D + ProtonScatter (cliffs, rocks, 4 biome trees, ruins, bridges)
   and 20 capital city architectural landmarks across Pyra, Verdantia, Aetheria, and Nexus-9.
2. Renders orthographic isometric 2D sprites (yaw 45 deg, elevation 30 deg) with transparent background.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

OUT_ROOT = "/workspace/ki-world-iso-20261118"
MODELS_DIR = os.path.join(OUT_ROOT, "models")
RAW_SPRITES_DIR = os.path.join(OUT_ROOT, "sprites_raw")
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(RAW_SPRITES_DIR, exist_ok=True)


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for cam in list(bpy.data.cameras):
        if cam.users == 0:
            bpy.data.cameras.remove(cam)
    for lgt in list(bpy.data.lights):
        if lgt.users == 0:
            bpy.data.lights.remove(lgt)


def make_mat(name, color, roughness=0.65, metallic=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission is not None and emission_strength > 0.0:
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
                bsdf.inputs["Emission Strength"].default_value = emission_strength
            elif "Emission" in bsdf.inputs:
                bsdf.inputs["Emission"].default_value = (*emission, 1.0)
    return mat


def assign_mat(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def add_box(name, loc, scale, mat, rot=(0, 0, 0), bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    assign_mat(obj, mat)
    return obj


def add_cyl(name, loc, radius, depth, mat, vertices=16, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign_mat(obj, mat)
    return obj


def add_cone(name, loc, r1, r2, depth, mat, vertices=8, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign_mat(obj, mat)
    return obj


def add_ico(name, loc, radius, mat, subdivisions=2, scale=(1, 1, 1), displace_seed=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if displace_seed is not None:
        for i, v in enumerate(obj.data.vertices):
            h = math.sin(i * 12.9898 + displace_seed * 78.233) * 43758.5453
            frac = h - math.floor(h)
            factor = 0.78 + 0.42 * frac
            v.co.x *= factor
            v.co.y *= factor
            v.co.z *= (0.85 + 0.30 * frac)
    assign_mat(obj, mat)
    return obj


def export_glb(filename):
    path = os.path.join(MODELS_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
    )
    print(f"EXPORTED_GLB {path}")


def setup_isometric_render(ortho_scale=14.0, target_z=3.0, sun_color=(1.0, 0.96, 0.88), sun_energy=4.2):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    if hasattr(scene.eevee, "use_gtao"):
        scene.eevee.use_gtao = True
        scene.eevee.gtao_distance = 2.5
    if hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 32

    # Isometric orthographic camera: yaw 45 deg, elevation 30 deg
    # In Blender coordinates (Z up): rotation_euler = (60 deg, 0, 45 deg)
    dist = 45.0
    yaw = math.radians(45.0)
    elev = math.radians(30.0)
    cam_x = dist * math.cos(elev) * math.sin(yaw)
    cam_y = -dist * math.cos(elev) * math.cos(yaw)
    cam_z = target_z + dist * math.sin(elev)

    cam_data = bpy.data.cameras.new("IsoCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam_data.clip_start = 0.1
    cam_data.clip_end = 200.0
    cam_obj = bpy.data.objects.new("IsoCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.location = (cam_x, cam_y, cam_z)
    cam_obj.rotation_euler = Euler((math.radians(60.0), 0.0, math.radians(45.0)), "XYZ")
    scene.camera = cam_obj

    # Key sun light
    key_data = bpy.data.lights.new(name="KeySun", type="SUN")
    key_data.energy = sun_energy
    key_data.color = sun_color
    key_data.angle = math.radians(8.0)
    key_obj = bpy.data.objects.new(name="KeySun", object_data=key_data)
    bpy.context.collection.objects.link(key_obj)
    key_obj.rotation_euler = Euler((math.radians(42.0), math.radians(-18.0), math.radians(-35.0)), "XYZ")

    # Fill sun light (cool sky fill)
    fill_data = bpy.data.lights.new(name="FillSun", type="SUN")
    fill_data.energy = 1.65
    fill_data.color = (0.72, 0.84, 1.0)
    fill_data.use_shadow = False
    fill_obj = bpy.data.objects.new(name="FillSun", object_data=fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = Euler((math.radians(55.0), math.radians(20.0), math.radians(135.0)), "XYZ")

    # Back rim light
    rim_data = bpy.data.lights.new(name="RimSun", type="SUN")
    rim_data.energy = 1.25
    rim_data.color = (1.0, 0.92, 0.80)
    rim_data.use_shadow = False
    rim_obj = bpy.data.objects.new(name="RimSun", object_data=rim_data)
    bpy.context.collection.objects.link(rim_obj)
    rim_obj.rotation_euler = Euler((math.radians(65.0), 0.0, math.radians(-145.0)), "XYZ")


def render_sprite(sprite_name, ortho_scale=14.0, target_z=3.0, sun_color=(1.0, 0.96, 0.88), sun_energy=4.2):
    setup_isometric_render(ortho_scale=ortho_scale, target_z=target_z, sun_color=sun_color, sun_energy=sun_energy)
    out_path = os.path.join(RAW_SPRITES_DIR, f"{sprite_name}.png")
    bpy.context.scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED_SPRITE {out_path}")


# ==============================================================================
# 1. NATURAL SCATTER MODELS (.glb + sprite)
# ==============================================================================
def build_natural_assets():
    # 1. cliff_basalt
    clear_scene()
    m_basalt = make_mat("Basalt", (0.20, 0.18, 0.19), roughness=0.82)
    m_highlight = make_mat("BasaltRim", (0.31, 0.27, 0.25), roughness=0.75)
    for i, (x, y, z, r, h) in enumerate([
        (0.0, 0.0, 2.2, 1.8, 4.4),
        (1.4, -0.7, 1.6, 1.3, 3.2),
        (-1.3, 0.8, 1.8, 1.4, 3.6),
        (0.4, 1.3, 1.2, 1.1, 2.4),
        (-0.8, -1.1, 1.0, 1.0, 2.0),
    ]):
        add_cyl(f"Column_{i}", (x, y, z), r, h, m_basalt if i % 2 == 0 else m_highlight, vertices=6)
    export_glb("cliff_basalt.glb")
    render_sprite("cliff_basalt", ortho_scale=9.5, target_z=2.0)

    # 2. rock_cluster
    clear_scene()
    m_rock = make_mat("Granite", (0.42, 0.41, 0.39), roughness=0.78)
    m_moss = make_mat("MossRock", (0.34, 0.38, 0.31), roughness=0.80)
    add_ico("RockMain", (0.0, 0.0, 1.0), 1.45, m_rock, subdivisions=2, scale=(1.2, 1.0, 0.85), displace_seed=1)
    add_ico("RockLeft", (-1.1, 0.5, 0.65), 0.95, m_moss, subdivisions=2, scale=(1.0, 1.1, 0.75), displace_seed=2)
    add_ico("RockRight", (1.0, -0.6, 0.55), 0.80, m_rock, subdivisions=2, scale=(1.1, 0.9, 0.70), displace_seed=3)
    export_glb("rock_cluster.glb")
    render_sprite("rock_cluster", ortho_scale=7.5, target_z=0.9)

    # 3. tree_pine (Alpine conifer for Aetheria & Verdantia highlands)
    clear_scene()
    m_trunk = make_mat("PineTrunk", (0.32, 0.21, 0.13), roughness=0.85)
    m_needle1 = make_mat("PineDark", (0.14, 0.33, 0.20), roughness=0.72)
    m_needle2 = make_mat("PineLight", (0.20, 0.42, 0.25), roughness=0.70)
    add_cyl("Trunk", (0, 0, 1.4), 0.32, 2.8, m_trunk, vertices=8)
    add_cone("Tier1", (0, 0, 2.5), 1.75, 0.2, 2.2, m_needle1, vertices=10)
    add_cone("Tier2", (0, 0, 3.8), 1.40, 0.15, 2.0, m_needle2, vertices=10)
    add_cone("Tier3", (0, 0, 4.9), 0.95, 0.05, 1.7, m_needle1, vertices=10)
    export_glb("tree_pine.glb")
    render_sprite("tree_pine", ortho_scale=9.5, target_z=2.8)

    # 4. tree_oak (Lush deciduous tree for Verdantia)
    clear_scene()
    m_oak_trunk = make_mat("OakTrunk", (0.36, 0.24, 0.14), roughness=0.82)
    m_leaf1 = make_mat("LeafMain", (0.22, 0.48, 0.18), roughness=0.68)
    m_leaf2 = make_mat("LeafSun", (0.32, 0.58, 0.22), roughness=0.65)
    add_cyl("Trunk", (0, 0, 1.3), 0.38, 2.6, m_oak_trunk, vertices=8)
    add_ico("CrownMain", (0, 0, 3.3), 1.75, m_leaf1, subdivisions=2, scale=(1.15, 1.15, 0.92), displace_seed=5)
    add_ico("CrownTop", (0.3, -0.2, 4.3), 1.25, m_leaf2, subdivisions=2, scale=(1.1, 1.0, 0.85), displace_seed=6)
    add_ico("CrownSide1", (-1.0, 0.5, 2.9), 1.15, m_leaf2, subdivisions=2, displace_seed=7)
    add_ico("CrownSide2", (0.9, 0.7, 3.0), 1.10, m_leaf1, subdivisions=2, displace_seed=8)
    export_glb("tree_oak.glb")
    render_sprite("tree_oak", ortho_scale=9.5, target_z=2.7)

    # 5. tree_sakura (Alpine blossom tree for Aetheria Sanctuary)
    clear_scene()
    m_sak_trunk = make_mat("SakuraTrunk", (0.28, 0.20, 0.22), roughness=0.80)
    m_blossom1 = make_mat("BlossomPink", (0.92, 0.62, 0.74), roughness=0.60)
    m_blossom2 = make_mat("BlossomLight", (0.98, 0.80, 0.88), roughness=0.55)
    add_cyl("Trunk", (0, 0, 1.3), 0.34, 2.6, m_sak_trunk, vertices=8)
    add_ico("BlossomMain", (0, 0, 3.2), 1.70, m_blossom1, subdivisions=2, scale=(1.25, 1.20, 0.82), displace_seed=11)
    add_ico("BlossomTop", (0.2, -0.3, 4.1), 1.25, m_blossom2, subdivisions=2, scale=(1.15, 1.10, 0.78), displace_seed=12)
    add_ico("BlossomLeft", (-1.1, 0.4, 2.9), 1.10, m_blossom2, subdivisions=2, displace_seed=13)
    export_glb("tree_sakura.glb")
    render_sprite("tree_sakura", ortho_scale=9.5, target_z=2.7)

    # 6. tree_charred (Volcanic ember snag for Pyra)
    clear_scene()
    m_char = make_mat("CharredWood", (0.14, 0.11, 0.10), roughness=0.88)
    m_ember = make_mat("EmberCore", (1.0, 0.35, 0.05), roughness=0.4, emission=(1.0, 0.38, 0.06), emission_strength=3.2)
    add_cone("MainTrunk", (0, 0, 1.8), 0.55, 0.18, 3.6, m_char, vertices=7)
    add_cone("Branch1", (0.55, 0.2, 2.4), 0.26, 0.06, 1.8, m_char, vertices=6, rot=(0.2, 0.55, 0.1))
    add_cone("Branch2", (-0.5, -0.3, 2.1), 0.24, 0.05, 1.6, m_char, vertices=6, rot=(-0.3, -0.5, 0.2))
    add_ico("EmberNode", (0.0, -0.25, 1.2), 0.32, m_ember, subdivisions=1)
    export_glb("tree_charred.glb")
    render_sprite("tree_charred", ortho_scale=8.5, target_z=1.9)

    # 7. ruin_pillar
    clear_scene()
    m_stone = make_mat("AncientStone", (0.68, 0.66, 0.60), roughness=0.72)
    m_trim = make_mat("GoldTrim", (0.78, 0.64, 0.30), roughness=0.42, metallic=0.55)
    add_box("Base", (0, 0, 0.35), (2.8, 1.4, 0.7), m_stone)
    add_cyl("PillarL", (-0.9, 0, 2.1), 0.36, 3.0, m_stone, vertices=12)
    add_cyl("PillarR", (0.9, 0, 1.6), 0.36, 2.0, m_stone, vertices=12)
    add_box("Architrave", (-0.3, 0, 3.75), (1.9, 0.95, 0.55), m_trim)
    export_glb("ruin_pillar.glb")
    render_sprite("ruin_pillar", ortho_scale=8.5, target_z=2.0)

    # 8. bridge_arch
    clear_scene()
    m_bstone = make_mat("BridgeStone", (0.52, 0.49, 0.44), roughness=0.75)
    m_bdeck = make_mat("BridgeDeck", (0.62, 0.56, 0.46), roughness=0.70)
    add_box("Deck", (0, 0, 1.4), (6.4, 2.8, 0.45), m_bdeck)
    add_box("ParapetN", (0, 1.25, 1.9), (6.4, 0.30, 0.65), m_bstone)
    add_box("ParapetS", (0, -1.25, 1.9), (6.4, 0.30, 0.65), m_bstone)
    add_box("PierL", (-2.4, 0, 0.7), (1.1, 2.8, 1.4), m_bstone)
    add_box("PierR", (2.4, 0, 0.7), (1.1, 2.8, 1.4), m_bstone)
    export_glb("bridge_arch.glb")
    render_sprite("bridge_arch", ortho_scale=11.5, target_z=1.5)


# ==============================================================================
# 2. PYRA CAPITAL ("TWIERDZA POPIOŁU") ARCHITECTURE
# ==============================================================================
def build_pyra_assets():
    m_obsidian = make_mat("PyraObsidian", (0.18, 0.16, 0.17), roughness=0.72)
    m_basalt = make_mat("PyraBasalt", (0.28, 0.23, 0.22), roughness=0.78)
    m_crimson = make_mat("PyraCrimson", (0.58, 0.16, 0.11), roughness=0.62)
    m_bronze = make_mat("PyraBronze", (0.72, 0.48, 0.22), roughness=0.38, metallic=0.70)
    m_lava = make_mat("PyraLava", (1.0, 0.38, 0.05), roughness=0.25, emission=(1.0, 0.42, 0.08), emission_strength=4.5)

    # 1. pyra_citadel (Wysoka Cytadela & Plac Korony)
    clear_scene()
    add_box("Plinth", (0, 0, 0.8), (8.4, 7.6, 1.6), m_basalt)
    add_box("KeepLower", (0, 0, 3.2), (6.2, 5.6, 3.4), m_obsidian)
    add_box("KeepUpper", (0, 0, 6.0), (4.2, 3.8, 2.8), m_obsidian)
    add_cone("CrownSpire", (0, 0, 8.8), 2.3, 0.3, 3.0, m_crimson, vertices=8)
    for idx, (cx, cy) in enumerate([(-2.8, -2.5), (2.8, -2.5), (-2.8, 2.5), (2.8, 2.5)]):
        add_cyl(f"CornerTower_{idx}", (cx, cy, 3.6), 1.1, 5.6, m_basalt, vertices=8)
        add_cone(f"CornerRoof_{idx}", (cx, cy, 7.1), 1.25, 0.1, 1.6, m_crimson, vertices=8)
        add_box(f"LavaSlit_{idx}", (cx * 1.05, cy * 1.05, 4.0), (0.35, 0.35, 1.8), m_lava)
    add_box("FrontSteps", (0, -4.3, 0.6), (3.2, 1.8, 1.2), m_basalt)
    add_box("PortalGlow", (0, -2.85, 2.4), (1.6, 0.3, 2.2), m_lava)
    add_cyl("CrownRing", (0, 0, 7.5), 1.9, 0.35, m_bronze, vertices=12)
    export_glb("pyra_citadel.glb")
    render_sprite("pyra_citadel", ortho_scale=17.5, target_z=4.2, sun_color=(1.0, 0.90, 0.78), sun_energy=4.4)

    # 2. pyra_gate (Brama Główna — twin-towered fortress gate)
    clear_scene()
    add_box("GateBaseL", (-2.6, 0, 2.4), (2.4, 2.6, 4.8), m_obsidian)
    add_box("GateBaseR", (2.6, 0, 2.4), (2.4, 2.6, 4.8), m_obsidian)
    add_box("GateBridge", (0, 0, 3.9), (3.2, 2.0, 1.6), m_basalt)
    add_cone("SpireL", (-2.6, 0, 5.7), 1.5, 0.15, 1.9, m_crimson, vertices=8)
    add_cone("SpireR", (2.6, 0, 5.7), 1.5, 0.15, 1.9, m_crimson, vertices=8)
    add_box("BrazierL", (-2.6, -1.5, 2.2), (0.7, 0.7, 0.7), m_lava)
    add_box("BrazierR", (2.6, -1.5, 2.2), (0.7, 0.7, 0.7), m_lava)
    export_glb("pyra_gate.glb")
    render_sprite("pyra_gate", ortho_scale=13.5, target_z=3.0, sun_color=(1.0, 0.90, 0.78))

    # 3. pyra_forge (Dolne Kuźnie & Plac Węglowy)
    clear_scene()
    add_box("ForgeBase", (0, 0, 0.6), (6.8, 5.4, 1.2), m_basalt)
    add_box("Hall", (-0.8, 0.4, 2.3), (4.4, 3.6, 2.4), m_obsidian)
    add_box("Roof", (-0.8, 0.4, 3.9), (4.8, 4.0, 0.8), m_crimson)
    add_cyl("Chimney1", (-1.8, 1.2, 4.6), 0.65, 3.6, m_basalt, vertices=8)
    add_cyl("Chimney2", (0.2, 1.2, 4.2), 0.55, 2.8, m_basalt, vertices=8)
    add_cyl("ChimneyGlow1", (-1.8, 1.2, 6.45), 0.50, 0.25, m_lava, vertices=8)
    add_box("MoltenVat", (1.9, -0.7, 1.4), (2.0, 2.2, 0.9), m_obsidian)
    add_box("MoltenPool", (1.9, -0.7, 1.9), (1.5, 1.7, 0.2), m_lava)
    export_glb("pyra_forge.glb")
    render_sprite("pyra_forge", ortho_scale=13.5, target_z=2.8, sun_color=(1.0, 0.90, 0.78))

    # 4. pyra_market (Targ przy Bramie)
    clear_scene()
    add_box("Platform", (0, 0, 0.35), (5.6, 4.4, 0.7), m_basalt)
    for px, py in [(-2.2, -1.6), (2.2, -1.6), (-2.2, 1.6), (2.2, 1.6)]:
        add_box(f"Post_{px}_{py}", (px, py, 1.8), (0.45, 0.45, 2.4), m_obsidian)
    add_cone("Canopy", (0, 0, 3.6), 3.6, 0.4, 1.5, m_crimson, vertices=4, rot=(0, 0, math.radians(45)))
    add_box("Brazier", (0, -1.4, 1.1), (0.8, 0.8, 0.8), m_lava)
    export_glb("pyra_market.glb")
    render_sprite("pyra_market", ortho_scale=11.5, target_z=2.0, sun_color=(1.0, 0.90, 0.78))

    # 5. pyra_watchtower (Baszta Popiołu)
    clear_scene()
    add_box("Base", (0, 0, 0.8), (3.2, 3.2, 1.6), m_basalt)
    add_cyl("Shaft", (0, 0, 3.6), 1.35, 4.4, m_obsidian, vertices=8)
    add_box("Crown", (0, 0, 6.0), (3.1, 3.1, 0.9), m_basalt)
    add_ico("Beacon", (0, 0, 6.8), 0.75, m_lava, subdivisions=1)
    export_glb("pyra_watchtower.glb")
    render_sprite("pyra_watchtower", ortho_scale=12.5, target_z=3.4, sun_color=(1.0, 0.90, 0.78))


# ==============================================================================
# 3. VERDANTIA CAPITAL ("ZIELONA PRZYSTAŃ") ARCHITECTURE
# ==============================================================================
def build_verdant_assets():
    m_stone = make_mat("VerdantStone", (0.64, 0.61, 0.54), roughness=0.75)
    m_timber = make_mat("VerdantTimber", (0.38, 0.25, 0.14), roughness=0.78)
    m_plaster = make_mat("VerdantPlaster", (0.91, 0.86, 0.74), roughness=0.68)
    m_roof_green = make_mat("VerdantRoofG", (0.20, 0.48, 0.26), roughness=0.58)
    m_roof_terra = make_mat("VerdantRoofT", (0.68, 0.34, 0.18), roughness=0.62)
    m_gold = make_mat("VerdantLantern", (1.0, 0.82, 0.38), roughness=0.3, emission=(1.0, 0.80, 0.35), emission_strength=2.5)

    # 1. verdant_bridge (Most Główny nad Rzeką Przełomu)
    clear_scene()
    add_box("PierW", (-3.2, 0, 1.1), (1.6, 3.6, 2.2), m_stone)
    add_box("PierE", (3.2, 0, 1.1), (1.6, 3.6, 2.2), m_stone)
    add_box("ArchDeck", (0, 0, 2.3), (8.6, 3.4, 0.6), m_stone)
    for px in [-2.8, -0.9, 0.9, 2.8]:
        add_box(f"PostN_{px}", (px, 1.35, 3.5), (0.35, 0.35, 2.0), m_timber)
        add_box(f"PostS_{px}", (px, -1.35, 3.5), (0.35, 0.35, 2.0), m_timber)
    add_box("RoofBeam", (0, 0, 4.7), (8.2, 3.8, 0.5), m_roof_terra)
    add_cone("CenterGable", (0, 0, 5.6), 2.6, 0.2, 1.5, m_roof_green, vertices=4, rot=(0, 0, math.radians(45)))
    export_glb("verdant_bridge.glb")
    render_sprite("verdant_bridge", ortho_scale=15.0, target_z=2.8)

    # 2. verdant_guildhall (Dzielnica Rzemieślnicza — Main Guildhall & Waterwheel)
    clear_scene()
    add_box("StoneFoundation", (0, 0, 0.7), (7.2, 5.8, 1.4), m_stone)
    add_box("MainHall", (-0.6, 0, 2.6), (5.4, 4.6, 2.6), m_plaster)
    add_box("TimberFrame", (-0.6, 0, 2.6), (5.55, 4.75, 0.35), m_timber)
    add_cone("MainRoof", (-0.6, 0, 4.9), 4.4, 0.5, 2.4, m_roof_green, vertices=4, rot=(0, 0, math.radians(45)))
    add_box("SideWing", (2.2, -0.6, 2.2), (2.8, 3.2, 2.0), m_plaster)
    add_cone("SideRoof", (2.2, -0.6, 3.9), 2.4, 0.3, 1.6, m_roof_terra, vertices=4, rot=(0, 0, math.radians(45)))
    add_cyl("WaterWheel", (-3.5, -0.5, 1.8), 1.45, 0.45, m_timber, vertices=12, rot=(0, math.radians(90), 0))
    add_box("Lantern", (0.5, -2.45, 2.3), (0.5, 0.3, 0.7), m_gold)
    export_glb("verdant_guildhall.glb")
    render_sprite("verdant_guildhall", ortho_scale=15.0, target_z=3.0)

    # 3. verdant_market (Targ)
    clear_scene()
    add_box("CobbleBase", (0, 0, 0.3), (5.8, 4.6, 0.6), m_stone)
    add_box("StallL", (-1.4, 0.3, 1.5), (2.4, 3.0, 1.8), m_timber)
    add_box("StallR", (1.5, -0.3, 1.5), (2.2, 2.8, 1.8), m_plaster)
    add_cone("RoofL", (-1.4, 0.3, 2.9), 2.1, 0.2, 1.3, m_roof_terra, vertices=4, rot=(0, 0, math.radians(45)))
    add_cone("RoofR", (1.5, -0.3, 2.9), 2.0, 0.2, 1.3, m_roof_green, vertices=4, rot=(0, 0, math.radians(45)))
    export_glb("verdant_market.glb")
    render_sprite("verdant_market", ortho_scale=12.0, target_z=1.9)

    # 4. verdant_dockhouse (Przystań i Nabrzeże)
    clear_scene()
    add_box("StoneQuay", (0, 0.6, 0.6), (5.6, 3.8, 1.2), m_stone)
    add_box("WoodenPier", (0, -2.2, 0.7), (2.6, 3.2, 0.35), m_timber)
    add_box("HarborHouse", (-0.8, 0.7, 2.3), (3.6, 2.8, 2.2), m_plaster)
    add_cone("HarborRoof", (-0.8, 0.7, 4.0), 2.8, 0.3, 1.5, m_roof_terra, vertices=4, rot=(0, 0, math.radians(45)))
    add_cyl("LighthouseTower", (1.8, 0.8, 2.9), 0.85, 3.6, m_stone, vertices=10)
    add_box("Beacon", (1.8, 0.8, 5.0), (0.8, 0.8, 0.8), m_gold)
    export_glb("verdant_dockhouse.glb")
    render_sprite("verdant_dockhouse", ortho_scale=14.0, target_z=2.6)

    # 5. verdant_gardenhouse (Domy Ogrodowe i Sady)
    clear_scene()
    add_box("TerraceWall", (0, 0, 0.6), (6.0, 5.0, 1.2), m_stone)
    add_box("Villa", (0, 0.5, 2.2), (4.2, 3.0, 2.0), m_plaster)
    add_cone("VillaRoof", (0, 0.5, 3.8), 3.3, 0.3, 1.5, m_roof_green, vertices=4, rot=(0, 0, math.radians(45)))
    add_ico("GardenTreeL", (-2.0, -1.3, 2.1), 1.0, m_roof_green, subdivisions=2, displace_seed=21)
    add_ico("GardenTreeR", (2.0, -1.3, 2.1), 1.0, m_roof_green, subdivisions=2, displace_seed=22)
    export_glb("verdant_gardenhouse.glb")
    render_sprite("verdant_gardenhouse", ortho_scale=12.5, target_z=2.2)


# ==============================================================================
# 4. AETHERIA CAPITAL ("SANKTUARIUM TYSIĄCA ŹRÓDEŁ") ARCHITECTURE
# ==============================================================================
def build_aether_assets():
    m_marble = make_mat("AetherMarble", (0.93, 0.94, 0.96), roughness=0.45)
    m_stone = make_mat("AetherStone", (0.72, 0.76, 0.82), roughness=0.65)
    m_roof_azure = make_mat("AetherRoof", (0.16, 0.46, 0.64), roughness=0.38, metallic=0.15)
    m_gold = make_mat("AetherGold", (0.92, 0.74, 0.28), roughness=0.28, metallic=0.80)
    m_spring = make_mat("AetherSpring", (0.20, 0.85, 0.92), roughness=0.20, emission=(0.22, 0.82, 0.95), emission_strength=2.2)

    # 1. aether_pagoda (Górne Sanktuarium & Źródlany Dziedziniec — 3-Tier Sanctuary Pagoda)
    clear_scene()
    add_cyl("LagoonBase", (0, 0, 0.35), 4.2, 0.7, m_stone, vertices=16)
    add_cyl("SpringPool", (0, 0, 0.72), 3.7, 0.12, m_spring, vertices=16)
    add_box("Plinth", (0, 0, 1.25), (4.8, 4.8, 1.0), m_marble)
    # Tier 1
    add_box("Tier1Body", (0, 0, 2.6), (3.8, 3.8, 1.8), m_marble)
    add_cone("Tier1Roof", (0, 0, 4.0), 3.6, 2.1, 1.1, m_roof_azure, vertices=8)
    # Tier 2
    add_box("Tier2Body", (0, 0, 5.1), (2.7, 2.7, 1.5), m_marble)
    add_cone("Tier2Roof", (0, 0, 6.2), 2.6, 1.3, 1.0, m_roof_azure, vertices=8)
    # Tier 3
    add_box("Tier3Body", (0, 0, 7.1), (1.8, 1.8, 1.2), m_marble)
    add_cone("Tier3Roof", (0, 0, 8.2), 1.8, 0.2, 1.2, m_roof_azure, vertices=8)
    add_cone("GoldFinial", (0, 0, 9.4), 0.35, 0.04, 1.4, m_gold, vertices=8)
    export_glb("aether_pagoda.glb")
    render_sprite("aether_pagoda", ortho_scale=16.5, target_z=4.5)

    # 2. aether_aqueduct (Tarasy Nauki — Monumental Stone Aqueduct with Waterfall Channels)
    clear_scene()
    add_box("LowerBase", (0, 0, 0.5), (8.4, 2.6, 1.0), m_stone)
    for px in [-3.0, -1.0, 1.0, 3.0]:
        add_box(f"Pier_{px}", (px, 0, 2.3), (1.1, 2.2, 2.8), m_marble)
    add_box("UpperChannel", (0, 0, 4.1), (8.4, 2.4, 0.9), m_marble)
    add_box("WaterStream", (0, 0, 4.58), (8.2, 1.4, 0.15), m_spring)
    add_box("CascadeL", (-2.0, -1.15, 2.3), (0.85, 0.22, 3.4), m_spring)
    add_box("CascadeR", (2.0, -1.15, 2.3), (0.85, 0.22, 3.4), m_spring)
    add_box("GoldCrest", (0, -1.25, 4.2), (1.8, 0.25, 0.5), m_gold)
    export_glb("aether_aqueduct.glb")
    render_sprite("aether_aqueduct", ortho_scale=14.5, target_z=2.6)

    # 3. aether_hall (Pawilon Nauki na Tarasach)
    clear_scene()
    add_box("Steps", (0, 0, 0.5), (6.4, 5.2, 1.0), m_stone)
    add_box("Colonnade", (0, 0, 2.2), (5.2, 4.0, 2.4), m_marble)
    add_cone("AzureRoof", (0, 0, 4.1), 4.2, 1.2, 1.5, m_roof_azure, vertices=8)
    add_ico("GoldDome", (0, 0, 5.1), 1.15, m_gold, subdivisions=2)
    export_glb("aether_hall.glb")
    render_sprite("aether_hall", ortho_scale=13.0, target_z=2.6)

    # 4. aether_gate (Brama Dolnego Miasta Gościnnego)
    clear_scene()
    add_box("PillarL", (-2.2, 0, 2.1), (1.6, 1.8, 4.2), m_marble)
    add_box("PillarR", (2.2, 0, 2.1), (1.6, 1.8, 4.2), m_marble)
    add_box("CrossBeam", (0, 0, 3.8), (6.4, 1.6, 0.8), m_gold)
    add_cone("GateRoof", (0, 0, 4.9), 4.4, 0.6, 1.4, m_roof_azure, vertices=4, rot=(0, 0, math.radians(45)))
    export_glb("aether_gate.glb")
    render_sprite("aether_gate", ortho_scale=12.5, target_z=2.6)

    # 5. aether_shrine (Kaplica Źródlana)
    clear_scene()
    add_cyl("Basin", (0, 0, 0.4), 2.4, 0.8, m_stone, vertices=12)
    add_cyl("Water", (0, 0, 0.82), 2.0, 0.1, m_spring, vertices=12)
    add_cyl("Sanctum", (0, 0, 2.0), 1.2, 2.4, m_marble, vertices=8)
    add_cone("Roof", (0, 0, 3.7), 1.75, 0.1, 1.3, m_roof_azure, vertices=8)
    export_glb("aether_shrine.glb")
    render_sprite("aether_shrine", ortho_scale=10.5, target_z=2.1)


# ==============================================================================
# 5. NEXUS-9 CAPITAL ("WĘZEŁ ŚWIADOMOŚCI") ARCHITECTURE
# ==============================================================================
def build_nexus_assets():
    m_steel = make_mat("NexusSteel", (0.24, 0.28, 0.34), roughness=0.42, metallic=0.72)
    m_armor = make_mat("NexusArmor", (0.38, 0.43, 0.50), roughness=0.48, metallic=0.58)
    m_dark = make_mat("NexusDark", (0.14, 0.16, 0.20), roughness=0.55, metallic=0.65)
    m_cyan = make_mat("NexusCyan", (0.08, 0.88, 1.0), roughness=0.20, emission=(0.10, 0.90, 1.0), emission_strength=4.5)
    m_amber = make_mat("NexusAmber", (1.0, 0.68, 0.12), roughness=0.25, emission=(1.0, 0.65, 0.10), emission_strength=3.2)

    # 1. nexus_core (Rdzeń Energetyczny na Górnym Tarasie Administracyjnym)
    clear_scene()
    add_cyl("BaseOct", (0, 0, 0.8), 4.4, 1.6, m_dark, vertices=8)
    add_cyl("CyanRing1", (0, 0, 1.65), 4.1, 0.22, m_cyan, vertices=16)
    add_cyl("ReactorBody", (0, 0, 3.4), 3.1, 3.4, m_steel, vertices=8)
    add_cyl("CyanCoreBand", (0, 0, 3.6), 3.18, 0.75, m_cyan, vertices=16)
    add_ico("ReactorDome", (0, 0, 5.2), 2.55, m_armor, subdivisions=2, scale=(1.0, 1.0, 0.72))
    add_cyl("TopSpire", (0, 0, 6.8), 0.55, 2.2, m_cyan, vertices=8)
    for idx, angle in enumerate([0, 90, 180, 270]):
        rad = math.radians(angle + 45)
        px = 3.6 * math.cos(rad)
        py = 3.6 * math.sin(rad)
        add_box(f"Pylon_{idx}", (px, py, 3.0), (0.95, 0.95, 4.4), m_armor, rot=(0, 0, rad))
        add_box(f"PylonGlow_{idx}", (px * 1.05, py * 1.05, 3.4), (0.35, 0.35, 2.8), m_cyan, rot=(0, 0, rad))
    export_glb("nexus_core.glb")
    render_sprite("nexus_core", ortho_scale=16.5, target_z=3.6, sun_color=(0.92, 0.96, 1.0), sun_energy=4.0)

    # 2. nexus_hangar (Hala Transportowa)
    clear_scene()
    add_box("Pad", (0, 0, 0.4), (7.6, 5.8, 0.8), m_dark)
    add_box("Hull", (0, 0, 2.2), (6.4, 4.6, 2.8), m_steel)
    add_box("UpperDeck", (0, 0.2, 3.9), (4.8, 3.4, 0.9), m_armor)
    add_box("BayDoorL", (-1.5, -2.35, 1.8), (1.8, 0.2, 2.0), m_cyan)
    add_box("BayDoorR", (1.5, -2.35, 1.8), (1.8, 0.2, 2.0), m_cyan)
    add_box("RoofStrip", (0, 0.2, 4.4), (4.2, 0.45, 0.15), m_cyan)
    export_glb("nexus_hangar.glb")
    render_sprite("nexus_hangar", ortho_scale=14.5, target_z=2.4, sun_color=(0.92, 0.96, 1.0))

    # 3. nexus_workshop (Dolne Warsztaty i Doki)
    clear_scene()
    add_box("Base", (0, 0, 0.5), (6.6, 5.2, 1.0), m_dark)
    add_box("Factory", (-1.0, 0.4, 2.2), (4.0, 3.4, 2.4), m_steel)
    add_cyl("Silo1", (1.9, 1.0, 2.4), 0.95, 3.0, m_armor, vertices=12)
    add_cyl("Silo2", (1.9, -1.0, 2.4), 0.95, 3.0, m_armor, vertices=12)
    add_cyl("SiloRing1", (1.9, 1.0, 3.2), 1.0, 0.25, m_cyan, vertices=12)
    add_cyl("SiloRing2", (1.9, -1.0, 3.2), 1.0, 0.25, m_amber, vertices=12)
    export_glb("nexus_workshop.glb")
    render_sprite("nexus_workshop", ortho_scale=13.5, target_z=2.3, sun_color=(0.92, 0.96, 1.0))

    # 4. nexus_conduit (Trakty Łączące — Energy Conduit Relay Pylon)
    clear_scene()
    add_cyl("Base", (0, 0, 0.5), 1.8, 1.0, m_dark, vertices=8)
    add_cyl("CoreColumn", (0, 0, 3.0), 0.85, 4.4, m_steel, vertices=8)
    for idx, z in enumerate([1.8, 3.0, 4.2]):
        add_cyl(f"Coil_{idx}", (0, 0, z), 1.25, 0.32, m_cyan, vertices=12)
    add_ico("TopNode", (0, 0, 5.6), 0.70, m_cyan, subdivisions=2)
    export_glb("nexus_conduit.glb")
    render_sprite("nexus_conduit", ortho_scale=11.0, target_z=2.8, sun_color=(0.92, 0.96, 1.0))

    # 5. nexus_dock (Place Przeładunkowe)
    clear_scene()
    add_box("Platform", (0, 0, 0.4), (6.0, 4.6, 0.8), m_dark)
    add_box("Container1", (-1.4, 0.6, 1.3), (2.2, 1.2, 1.1), m_armor)
    add_box("Container2", (-1.4, -0.8, 1.3), (2.2, 1.2, 1.1), m_steel)
    add_box("CranePillar", (1.8, 0, 2.4), (0.8, 0.8, 3.4), m_steel)
    add_box("CraneBoom", (0.6, 0, 4.0), (3.4, 0.5, 0.5), m_amber)
    add_box("HoloPad", (0.6, -0.5, 0.85), (1.5, 1.5, 0.12), m_cyan)
    export_glb("nexus_dock.glb")
    render_sprite("nexus_dock", ortho_scale=12.0, target_z=2.2, sun_color=(0.92, 0.96, 1.0))


def main():
    build_natural_assets()
    build_pyra_assets()
    build_verdant_assets()
    build_aether_assets()
    build_nexus_assets()
    print("BLENDER_ALL_ASSETS_DONE")


if __name__ == "__main__":
    main()
