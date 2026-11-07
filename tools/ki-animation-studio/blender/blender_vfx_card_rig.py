#!/usr/bin/env python3
"""
Skrypt Blender Python (bpy) — Karta 2.5D VFX (Projekcja klatek MP4 na płaszczyznę 3D z oświetleniem KI).
Pozwala wrzucić wyekstrahowane z MP4 klatki PNG do sceny 3D Blendera, dodać wokół nich
trójwymiarowe pierścienie energii KI, światło punktowe i wyrenderować z powrotem w 512x512 RGBA.
"""
import argparse
import math
import sys
from pathlib import Path

try:
    import bpy
    from mathutils import Vector
except ImportError:
    print("Uruchom wewnątrz Blendera: blender -b -P blender_vfx_card_rig.py")
    sys.exit(0)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="KI Legends 2.5D Card VFX Renderer")
    parser.add_argument("--frames-dir", required=True, help="Katalog z klatkami PNG (00.png, 01.png...)")
    parser.add_argument("--out-dir", required=True, help="Katalog wyjściowy")
    parser.add_argument("--threads", type=int, default=16, help="Liczba wątków CPU (domyślnie 16)")
    return parser.parse_args(argv)


def run_card_vfx(args):
    frames_dir = Path(args.frames_dir).resolve()
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    png_files = sorted(frames_dir.glob("*.png"))
    if not png_files:
        raise FileNotFoundError(f"Brak plików PNG w: {frames_dir}")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    scene = bpy.context.scene
    scene.render.threads_mode = "FIXED"
    scene.render.threads = max(1, args.threads)
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    # Karta postaci 2.5D
    bpy.ops.mesh.primitive_plane_add(size=4.0, location=(0, 0, 2.0), rotation=(math.radians(90), 0, 0))
    card = bpy.context.object
    card.name = "KI_Character_Card"

    mat = bpy.data.materials.new("CardMat")
    mat.use_nodes = True
    mat.blend_method = "CLIP"
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new("ShaderNodeOutputMaterial")
    emit_node = nodes.new("ShaderNodeEmission")
    trans_node = nodes.new("ShaderNodeBsdfTransparent")
    mix_node = nodes.new("ShaderNodeMixShader")
    tex_node = nodes.new("ShaderNodeTexImage")

    links.new(tex_node.outputs["Color"], emit_node.inputs["Color"])
    links.new(tex_node.outputs["Alpha"], mix_node.inputs["Fac"])
    links.new(trans_node.outputs["BSDF"], mix_node.inputs[1])
    links.new(emit_node.outputs["Emission"], mix_node.inputs[2])
    links.new(mix_node.outputs["Shader"], out_node.inputs["Surface"])
    card.data.materials.append(mat)

    # Kamera ortograficzna
    cam_data = bpy.data.cameras.new("OrthoCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 4.2
    cam_obj = bpy.data.objects.new("OrthoCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.location = Vector((0, -8, 2.0))
    cam_obj.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam_obj

    for idx, png_path in enumerate(png_files):
        img = bpy.data.images.load(str(png_path))
        tex_node.image = img
        scene.frame_set(idx + 1)
        scene.render.filepath = str(out_dir / f"{idx:02d}.png")
        bpy.ops.render.render(write_still=True)

    print(f"[KI Legends 2.5D VFX] Wyrenderowano {len(png_files)} klatek do {out_dir}")


if __name__ == "__main__":
    run_card_vfx(parse_args())
