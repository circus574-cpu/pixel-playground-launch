#!/usr/bin/env python3
"""
Blender 4.5.3 Cycles GPU (OptiX on RTX 6000 Ada) Exact 2:1 Isometric Generator:
1. 16 Directional Bridges (4 biomes x 4 road axes: x, z, ew, ns) mathematically matched to
   world.gd iso(x, z, h) projection (yaw=45 deg, elevation=30 deg -> exact 2:1 ratio 5.6:2.8!).
   When a road crosses water or lava, the bridge aligns 100% along the road tangent!
2. 28 Reserve Modular Fortification Pieces (4 biomes x wall_x, wall_z, corner, gate_x, gate_z,
   tower, ruined_wall) stored in assets/library/fortifications/ for immediate & future use.
"""

import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector

OUT_BASE = Path(os.environ.get("KI_BLENDER_OUT", "/workspace/ki-overhaul-20261119/blender_assets"))
OUT_BASE.mkdir(parents=True, exist_ok=True)


def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_cycles_optix(res: int = 768, samples: int = 32, ortho_scale: float = 28.0) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 3

    prefs = bpy.context.preferences.addons["cycles"].preferences
    for dev_type in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = dev_type
            prefs.get_devices()
            gpu_found = False
            for d in prefs.devices:
                if d.type in ("OPTIX", "CUDA"):
                    d.use = True
                    gpu_found = True
                else:
                    d.use = False
            if gpu_found:
                break
        except Exception:
            continue

    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    scene.view_settings.exposure = 0.25

    # Exact 2:1 isometric camera matching world.gd iso(x, z, h):
    # Camera at (+D, +D, +D*sqrt(2)*tan(30 deg)) looking at (0, 0, 1.8)
    cam_data = bpy.data.cameras.new("IsoCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam_obj = bpy.data.objects.new("IsoCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    dist = 50.0
    el = math.radians(30.0)
    az = math.radians(45.0)
    target = Vector((0.0, 0.0, 1.8))
    cam_pos = target + Vector((
        dist * math.cos(el) * math.cos(az),
        dist * math.cos(el) * math.sin(az),
        dist * math.sin(el),
    ))
    cam_obj.location = cam_pos
    direction = target - cam_pos
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    # Three-point sunlit fantasy studio lighting + soft ambient sky
    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.36, 0.42, 0.52, 1.0)
        bg.inputs["Strength"].default_value = 0.65

    def add_sun(name: str, energy: float, color, rot_deg):
        ld = bpy.data.lights.new(name, type="SUN")
        ld.energy = energy
        ld.color = color
        ld.angle = math.radians(4.5)
        lo = bpy.data.objects.new(name, ld)
        lo.rotation_euler = tuple(math.radians(a) for a in rot_deg)
        bpy.context.collection.objects.link(lo)

    add_sun("KeySun", 3.6, (1.0, 0.94, 0.84), (48, 12, -32))
    add_sun("FillRim", 1.2, (0.68, 0.84, 1.0), (55, -25, 138))


def make_pbr_mat(name: str, base_rgb, roughness: float = 0.62, metallic: float = 0.0,
                 noise_scale: float = 8.0, bump_strength: float = 0.28,
                 emit_rgb=None, emit_strength: float = 0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    texcoord = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = noise_scale
    noise.inputs["Detail"].default_value = 8.0
    noise.inputs["Roughness"].default_value = 0.65

    mix_col = nt.nodes.new("ShaderNodeMix")
    mix_col.data_type = "RGBA"
    dark = tuple(max(0.0, c * 0.66) for c in base_rgb) + (1.0,)
    light = tuple(min(1.0, c * 1.18) for c in base_rgb) + (1.0,)
    mix_col.inputs["A"].default_value = dark
    mix_col.inputs["B"].default_value = light

    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = 0.12

    nt.links.new(texcoord.outputs["Object"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], mix_col.inputs["Factor"])
    nt.links.new(mix_col.outputs["Result"], bsdf.inputs["Base Color"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    if emit_rgb is not None and emit_strength > 0.0:
        bsdf.inputs["Emission Color"].default_value = tuple(emit_rgb) + (1.0,)
        bsdf.inputs["Emission Strength"].default_value = emit_strength

    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def add_box(parent, name, loc, size, mat, bevel_w=0.06):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel_w > 0.0:
        bev = o.modifiers.new("Bevel", "BEVEL")
        bev.width = bevel_w
        bev.segments = 2
    o.data.materials.append(mat)
    o.parent = parent
    return o


def add_cyl(parent, name, loc, rad, depth, mat, verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=rad, depth=depth, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(mat)
    o.parent = parent
    return o


def biome_materials(biome: str) -> dict:
    if biome == "pyra":
        return {
            "stone": make_pbr_mat("PyraBasalt", (0.14, 0.12, 0.13), 0.72, 0.08, 9.0, 0.35),
            "deck": make_pbr_mat("PyraDeck", (0.20, 0.17, 0.16), 0.68, 0.05, 14.0, 0.30),
            "trim": make_pbr_mat("PyraBronze", (0.58, 0.38, 0.16), 0.35, 0.78, 12.0, 0.12),
            "accent": make_pbr_mat("PyraStoneLight", (0.28, 0.22, 0.20), 0.65, 0.05, 10.0, 0.25),
            "glow": make_pbr_mat("PyraEmber", (1.0, 0.36, 0.04), 0.2, 0.0, 6.0, 0.0, (1.0, 0.40, 0.06), 7.5),
            "cap": make_pbr_mat("PyraIron", (0.10, 0.09, 0.10), 0.42, 0.75, 16.0, 0.15),
        }
    elif biome == "verdant":
        return {
            "stone": make_pbr_mat("VerdStone", (0.36, 0.35, 0.30), 0.78, 0.0, 10.0, 0.36),
            "deck": make_pbr_mat("VerdOak", (0.32, 0.22, 0.12), 0.70, 0.0, 16.0, 0.26),
            "trim": make_pbr_mat("VerdMoss", (0.16, 0.34, 0.14), 0.85, 0.0, 12.0, 0.30),
            "accent": make_pbr_mat("VerdTimber", (0.24, 0.16, 0.09), 0.68, 0.0, 14.0, 0.22),
            "glow": make_pbr_mat("VerdLantern", (1.0, 0.78, 0.32), 0.2, 0.0, 5.0, 0.0, (1.0, 0.76, 0.30), 6.0),
            "cap": make_pbr_mat("VerdSlate", (0.22, 0.28, 0.24), 0.66, 0.05, 12.0, 0.24),
        }
    elif biome == "aether":
        return {
            "stone": make_pbr_mat("AethMarble", (0.76, 0.80, 0.86), 0.36, 0.04, 8.0, 0.16),
            "deck": make_pbr_mat("AethFrostStone", (0.64, 0.72, 0.82), 0.42, 0.04, 14.0, 0.18),
            "trim": make_pbr_mat("AethGold", (0.78, 0.62, 0.26), 0.28, 0.84, 10.0, 0.08),
            "accent": make_pbr_mat("AethSnow", (0.92, 0.96, 1.00), 0.62, 0.0, 18.0, 0.20),
            "glow": make_pbr_mat("AethCrystal", (0.26, 0.88, 1.0), 0.12, 0.0, 4.0, 0.0, (0.32, 0.90, 1.0), 6.5),
            "cap": make_pbr_mat("AethTeal", (0.14, 0.46, 0.48), 0.40, 0.18, 12.0, 0.16),
        }
    else:  # nexus
        return {
            "stone": make_pbr_mat("NexAlloy", (0.18, 0.21, 0.25), 0.36, 0.78, 12.0, 0.14),
            "deck": make_pbr_mat("NexDeck", (0.24, 0.27, 0.31), 0.42, 0.65, 18.0, 0.16),
            "trim": make_pbr_mat("NexSteel", (0.46, 0.50, 0.54), 0.28, 0.88, 10.0, 0.08),
            "accent": make_pbr_mat("NexDark", (0.10, 0.12, 0.15), 0.44, 0.70, 14.0, 0.12),
            "glow": make_pbr_mat("NexPlasma", (0.12, 0.92, 1.0), 0.1, 0.0, 5.0, 0.0, (0.15, 0.95, 1.0), 8.0),
            "cap": make_pbr_mat("NexArmor", (0.28, 0.32, 0.37), 0.32, 0.82, 12.0, 0.14),
        }


def build_bridge(biome: str, rot_deg: float) -> None:
    """Builds a high-detail arched isometric bridge aligned along local +X, rotated by rot_deg around Z."""
    mats = biome_materials(biome)
    root = bpy.data.objects.new("BridgeRoot", None)
    bpy.context.collection.objects.link(root)

    span = 16.4
    width = 6.2
    segs = 11

    # Arched deck planks / flagstones
    for i in range(segs):
        t = (i + 0.5) / segs  # 0..1
        u = (t - 0.5) * span
        arch_z = 1.45 + math.sin(t * math.pi) * 1.45
        tilt = math.cos(t * math.pi) * 0.16
        plank = add_box(root, f"Deck_{i}", (u, 0.0, arch_z), (span / segs + 0.18, width - 0.7, 0.55), mats["deck"], 0.05)
        plank.rotation_euler.y = -tilt
        # Side curb stones / steel rails
        for side in (-1.0, 1.0):
            curb = add_box(root, f"Curb_{i}_{side}", (u, side * (width * 0.46), arch_z + 0.28),
                           (span / segs + 0.12, 0.62, 0.42), mats["stone"], 0.05)
            curb.rotation_euler.y = -tilt

    # Two massive masonry / alloy piers plunging deep below water/lava level
    for px in (-4.8, 4.8):
        add_box(root, f"Pier_{px}", (px, 0.0, 0.2), (2.2, width + 0.8, 3.6), mats["stone"], 0.10)
        for side in (-1.0, 1.0):
            add_box(root, f"Cutwater_{px}_{side}", (px, side * (width * 0.56), 0.1), (1.4, 1.1, 3.0), mats["accent"], 0.08)

    # Abutment approach ramps at both ends
    for ex in (-span * 0.52, span * 0.52):
        add_box(root, f"Abutment_{ex}", (ex, 0.0, 0.72), (2.4, width + 0.6, 1.55), mats["stone"], 0.08)

    # Side arch ribs underneath
    for side in (-1.0, 1.0):
        for i in range(9):
            t = (i + 0.5) / 9.0
            u = (t - 0.5) * (span - 2.2)
            az = 0.85 + math.sin(t * math.pi) * 1.45
            rib = add_box(root, f"ArchRib_{side}_{i}", (u, side * (width * 0.44), az), (1.75, 0.68, 0.75), mats["stone"], 0.06)
            rib.rotation_euler.y = -math.cos(t * math.pi) * 0.20

    # Ornate railings + 4 corner lantern/brazier/crystal posts + snow cap on Aetheria
    for side in (-1.0, 1.0):
        py = side * (width * 0.46)
        for p_idx, px in enumerate((-7.4, -3.7, 0.0, 3.7, 7.4)):
            t = (px + span * 0.5) / span
            bz = 1.45 + math.sin(max(0.0, min(1.0, t)) * math.pi) * 1.45
            is_end = p_idx in (0, 2, 4)
            ph = 2.45 if is_end else 1.55
            pw = 0.78 if is_end else 0.52
            add_box(root, f"Post_{side}_{p_idx}", (px, py, bz + ph * 0.5), (pw, pw, ph), mats["stone"], 0.05)
            add_box(root, f"PostCap_{side}_{p_idx}", (px, py, bz + ph + 0.14), (pw + 0.20, pw + 0.20, 0.24), mats["trim"], 0.04)
            if is_end:
                add_box(root, f"Glow_{side}_{p_idx}", (px, py, bz + ph + 0.52), (0.38, 0.38, 0.52), mats["glow"], 0.03)
                add_box(root, f"RoofCap_{side}_{p_idx}", (px, py, bz + ph + 0.90), (0.68, 0.68, 0.22), mats["cap"], 0.04)
            if biome == "aether":
                add_box(root, f"SnowCap_{side}_{p_idx}", (px, py, bz + ph + (1.06 if is_end else 0.32)),
                        (pw + 0.14, pw + 0.14, 0.16), mats["accent"], 0.05)
        # Rail beams between posts
        for rx0, rx1 in ((-7.4, -3.7), (-3.7, 0.0), (0.0, 3.7), (3.7, 7.4)):
            mx = 0.5 * (rx0 + rx1)
            t0 = max(0.0, min(1.0, (rx0 + span * 0.5) / span))
            t1 = max(0.0, min(1.0, (rx1 + span * 0.5) / span))
            z0 = 1.45 + math.sin(t0 * math.pi) * 1.45
            z1 = 1.45 + math.sin(t1 * math.pi) * 1.45
            mz = 0.5 * (z0 + z1) + 1.22
            ang = math.atan2(z1 - z0, rx1 - rx0)
            rail = add_box(root, f"Rail_{side}_{rx0}", (mx, py, mz), (3.8, 0.36, 0.30), mats["trim"], 0.04)
            rail.rotation_euler.y = -ang
            if biome == "nexus":
                strip = add_box(root, f"GlowRail_{side}_{rx0}", (mx, py + side * 0.20, mz - 0.32), (3.6, 0.10, 0.16), mats["glow"], 0.01)
                strip.rotation_euler.y = -ang
            elif biome == "aether":
                snow_r = add_box(root, f"SnowRail_{side}_{rx0}", (mx, py, mz + 0.20), (3.5, 0.34, 0.14), mats["accent"], 0.05)
                snow_r.rotation_euler.y = -ang

    root.rotation_euler.z = math.radians(rot_deg)


def build_fortification(biome: str, kind: str) -> None:
    """Builds modular fortification walls, corners, gates, bastion towers, and ruined walls."""
    mats = biome_materials(biome)
    root = bpy.data.objects.new("FortRoot", None)
    bpy.context.collection.objects.link(root)

    if kind in ("wall_x", "wall_z", "ruined_wall"):
        broken = (kind == "ruined_wall")
        add_box(root, "Footing", (0, 0, 0.45), (12.4, 3.2, 0.9), mats["stone"], 0.08)
        for row in range(4):
            xs = [-4.4, -1.5, 1.5, 4.4] if row % 2 == 0 else [-3.0, 0.0, 3.0]
            for i, x in enumerate(xs):
                if broken and row >= 2 and x > -1.0:
                    continue
                if broken and row == 1 and x > 2.0:
                    continue
                add_box(root, f"Block_{row}_{i}", (x, 0, 1.2 + row * 0.88), (2.75, 2.35 - row * 0.08, 0.84),
                        mats["stone"] if (row + i) % 2 == 0 else mats["accent"], 0.07)
        if not broken:
            add_box(root, "Walkway", (0, 0, 4.45), (12.2, 2.75, 0.45), mats["deck"], 0.06)
            for mx in (-4.8, -1.6, 1.6, 4.8):
                add_box(root, f"Merlon_{mx}", (mx, 0.85, 5.15), (1.55, 0.95, 1.05), mats["cap"], 0.06)
            add_box(root, "GlowBand", (0, 1.28, 3.1), (11.6, 0.18, 0.24), mats["glow"], 0.02)
            if biome == "aether":
                add_box(root, "SnowCrest", (0, 0.0, 4.78), (11.8, 2.4, 0.22), mats["accent"], 0.06)
        else:
            # Fallen rubble blocks beside ruined wall
            for rx, ry, rz in ((2.6, 1.6, 0.45), (4.1, -0.8, 0.35), (1.2, 2.1, 0.30)):
                r = add_box(root, f"Rubble_{rx}", (rx, ry, rz), (1.5, 1.2, 0.8), mats["stone"], 0.08)
                r.rotation_euler = (0.18, -0.25, rx)
        if kind == "wall_z":
            root.rotation_euler.z = math.radians(90.0)

    elif kind == "corner":
        # L-shaped fortified corner bastion
        add_box(root, "CornerTower", (0, 0, 3.2), (5.2, 5.2, 6.4), mats["stone"], 0.10)
        add_box(root, "CornerCap", (0, 0, 6.6), (5.8, 5.8, 0.55), mats["trim"], 0.06)
        for wx, wy, sx, sy in ((5.0, 0, 5.2, 2.6), (0, 5.0, 2.6, 5.2)):
            add_box(root, f"Wing_{wx}_{wy}", (wx, wy, 2.3), (sx, sy, 4.6), mats["stone"], 0.08)
        add_box(root, "Beacon", (0, 0, 7.3), (1.4, 1.4, 1.0), mats["glow"], 0.05)

    elif kind in ("gate_x", "gate_z"):
        # Twin flanking gatehouse towers + grand arched portal + portcullis/energy gate
        for side in (-1.0, 1.0):
            add_box(root, f"Pylon_{side}", (side * 4.6, 0, 3.6), (3.6, 4.2, 7.2), mats["stone"], 0.10)
            add_box(root, f"Cap_{side}", (side * 4.6, 0, 7.5), (4.2, 4.8, 0.6), mats["cap"], 0.06)
            add_box(root, f"Glow_{side}", (side * 4.6, 2.18, 4.8), (0.65, 0.25, 2.2), mats["glow"], 0.03)
        add_box(root, "Lintel", (0, 0, 5.9), (6.4, 3.4, 1.5), mats["stone"], 0.08)
        add_box(root, "LintelTrim", (0, 1.72, 5.9), (5.8, 0.28, 0.42), mats["trim"], 0.04)
        add_box(root, "Crest", (0, 0, 7.2), (3.8, 2.4, 1.2), mats["cap"], 0.06)
        if biome == "aether":
            add_box(root, "SnowGate", (0, 0, 7.9), (4.0, 2.5, 0.28), mats["accent"], 0.06)
        if kind == "gate_z":
            root.rotation_euler.z = math.radians(90.0)

    elif kind == "tower":
        add_box(root, "Base", (0, 0, 0.8), (6.8, 6.8, 1.6), mats["stone"], 0.12)
        add_cyl(root, "Shaft", (0, 0, 5.2), 2.9, 8.2, mats["stone"], 8)
        add_cyl(root, "Gallery", (0, 0, 9.5), 3.55, 1.2, mats["cap"], 8)
        add_cyl(root, "TrimRing", (0, 0, 8.85), 3.25, 0.32, mats["trim"], 8)
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=3.9, radius2=0.18, depth=4.0, location=(0, 0, 12.0))
        roof = bpy.context.active_object
        roof.data.materials.append(mats["cap"] if biome != "aether" else mats["accent"])
        roof.parent = root
        for ang_deg in (0, 90, 180, 270):
            a = math.radians(ang_deg)
            add_box(root, f"Slit_{ang_deg}", (math.cos(a) * 2.85, math.sin(a) * 2.85, 5.8),
                    (0.55, 0.55, 1.9), mats["glow"], 0.03)


def crop_and_webp(png_path: Path, webp_path: Path, max_dim: int = 640) -> None:
    from PIL import Image
    import numpy as np

    im = Image.open(png_path).convert("RGBA")
    arr = np.asarray(im)
    ys, xs = np.where(arr[..., 3] > 12)
    if len(xs) > 10 and len(ys) > 10:
        x0 = max(0, int(xs.min()) - 10)
        y0 = max(0, int(ys.min()) - 10)
        x1 = min(arr.shape[1], int(xs.max()) + 11)
        y1 = min(arr.shape[0], int(ys.max()) + 11)
        im = Image.fromarray(arr[y0:y1, x0:x1], mode="RGBA")
    if max(im.size) > max_dim:
        im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    webp_path.parent.mkdir(parents=True, exist_ok=True)
    im.save(webp_path, format="WEBP", quality=92, method=5)
    png_path.unlink(missing_ok=True)


def render_item(out_webp: Path, build_fn, ortho_scale: float = 24.0, res: int = 768) -> None:
    clear_scene()
    setup_cycles_optix(res=res, samples=28, ortho_scale=ortho_scale)
    build_fn()
    tmp_png = out_webp.with_suffix(".tmp.png")
    tmp_png.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(tmp_png)
    bpy.ops.render.render(write_still=True)
    crop_and_webp(tmp_png, out_webp)
    print(f"  [BLENDER OK] {out_webp.relative_to(OUT_BASE)}")


def main() -> None:
    biomes = ["pyra", "verdant", "aether", "nexus"]
    # 1. 16 Exact Directional Bridges (4 biomes x 4 road axes matching iso(x,z))
    #    x  (rot 0°):   road along world +X (screen down-right ↘)
    #    z  (rot 90°):  road along world +Z (screen down-left ↙)
    #    ns (rot 45°):  road along world X+Z (screen vertical ↓)
    #    ew (rot -45°): road along world X-Z (screen horizontal →)
    bridge_dirs = [("x", 0.0), ("z", 90.0), ("ns", 45.0), ("ew", -45.0)]
    for b in biomes:
        for d_name, rot in bridge_dirs:
            out_w = OUT_BASE / "bridges" / f"{b}-bridge-{d_name}.webp"
            render_item(out_w, lambda bb=b, rr=rot: build_bridge(bb, rr), ortho_scale=23.5, res=768)

    # 2. 28 Reserve Modular Fortifications (walls, corners, gates, towers, ruined walls)
    fort_kinds = ["wall_x", "wall_z", "corner", "gate_x", "gate_z", "tower", "ruined_wall"]
    for b in biomes:
        for fk in fort_kinds:
            scale = 24.0 if fk == "tower" else 21.0
            out_w = OUT_BASE / "fortifications" / f"{b}-fort-{fk}.webp"
            render_item(out_w, lambda bb=b, kk=fk: build_fortification(bb, kk), ortho_scale=scale, res=768)

    print(f"BLENDER_BRIDGES_AND_FORTS_DONE -> {OUT_BASE}")


if __name__ == "__main__":
    main()
