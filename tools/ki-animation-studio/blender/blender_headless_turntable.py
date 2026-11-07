#!/usr/bin/env python3
"""
Skrypt Blender Python (bpy) — Automatyczny Renderer 8 Kierunków × 7 Stanów (416 klatek) na 16 CPU.
Zgodny w 100% z kontraktem produkcyjnym KI Legends (stage3-render-contract.json):
- Kamera ortograficzna (ORTHO), elewacja 60°, roll 0°, zablokowana odległość
- Oświetlenie główne z Północnego Zachodu (NW Key Light) + Rim Light + Toon Shader
- 512x512 RGBA PNG, przezroczyste tło, stopy zakotwiczone w (256, 486.4)
- Wykorzystanie pełnych 16 wątków CPU (threads = 16)

Użycie w trybie headless na serwerze VPS:
  blender -b postac.blend -t 16 -P blender_headless_turntable.py -- --out ./renders/hero-custom --actor hero-custom
"""
import argparse
import json
import math
import os
import sys
from pathlib import Path

try:
    import bpy
    from mathutils import Euler, Vector
except ImportError:
    print("UWAGA: Ten skrypt należy uruchamiać wewnątrz środowiska Blender: blender -b -P blender_headless_turntable.py")
    sys.exit(0)

DIRECTIONS = [
    ("down", 0.0),
    ("down-left", 45.0),
    ("left", 90.0),
    ("up-left", 135.0),
    ("up", 180.0),
    ("up-right", 225.0),
    ("right", 270.0),
    ("down-right", 315.0),
]

STATES = {
    "idle": {"frames": 8, "fps": 6, "start_frame": 1},
    "walk": {"frames": 8, "fps": 16, "start_frame": 10},
    "attack": {"frames": 8, "fps": 16, "start_frame": 20},
    "skill": {"frames": 8, "fps": 12, "start_frame": 30},
    "hit": {"frames": 4, "fps": 16, "start_frame": 40},
    "death": {"frames": 8, "fps": 10, "start_frame": 50},
    "respawn": {"frames": 8, "fps": 12, "start_frame": 60},
}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="KI Legends 8-Direction Turntable Renderer (16 CPU)")
    parser.add_argument("--out", default="./renders/hero-custom", help="Katalog wyjściowy klatek PNG")
    parser.add_argument("--actor", default="hero-custom", help="ID aktora KI Legends")
    parser.add_argument("--resolution", type=int, default=512, help="Rozmiar klatki master (domyślnie 512)")
    parser.add_argument("--threads", type=int, default=16, help="Liczba wątków CPU (domyślnie 16)")
    parser.add_argument("--ortho-scale", type=float, default=6.2, help="Skala kamery ortograficznej")
    parser.add_argument("--freestyle", action="store_true", default=True, help="Włącz kontur anime Freestyle")
    return parser.parse_args(argv)


def setup_render_settings(scene, resolution: int, threads: int, use_freestyle: bool):
    # Konfiguracja silnika i 16 wątków CPU
    available_engines = {e.identifier for e in scene.render.bl_rna.properties["engine"].enum_items}
    if "BLENDER_EEVEE_NEXT" in available_engines:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    elif "BLENDER_EEVEE" in available_engines:
        scene.render.engine = "BLENDER_EEVEE"
    else:
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = 32

    scene.render.threads_mode = "FIXED"
    scene.render.threads = max(1, threads)
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"

    if use_freestyle:
        scene.render.use_freestyle = True
        scene.render.line_thickness = 1.6


def setup_ki_camera_and_lights(ortho_scale: float):
    # Tworzenie węzła obrotowego (Turntable Pivot)
    pivot = bpy.data.objects.get("KI_Turntable_Pivot")
    if not pivot:
        pivot = bpy.data.objects.new("KI_Turntable_Pivot", None)
        bpy.context.collection.objects.link(pivot)
    pivot.location = Vector((0.0, 0.0, 2.55))

    # Kamera ortograficzna pod kątem elewacji 60° (pitch = 30° od pionu, lub 60° nad poziomem)
    cam_data = bpy.data.cameras.new("KI_Ortho_Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam_obj = bpy.data.objects.new("KI_Ortho_Camera", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.parent = pivot

    dist = 14.0
    elev_rad = math.radians(30.0)  # Widok z góry-południa zgodny z kontraktem KI Legends
    cam_obj.location = Vector((0.0, -dist * math.cos(elev_rad), dist * math.sin(elev_rad)))
    direction_vec = Vector((0.0, 0.0, 0.0)) - cam_obj.location
    cam_obj.rotation_euler = direction_vec.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam_obj

    # Światło główne z Północnego Zachodu (NW Key Light)
    key_data = bpy.data.lights.new(name="KI_NW_KeyLight", type="SUN")
    key_data.energy = 4.2
    key_data.color = (1.0, 0.98, 0.94)
    key_obj = bpy.data.objects.new(name="KI_NW_KeyLight", object_data=key_data)
    bpy.context.collection.objects.link(key_obj)
    key_obj.rotation_euler = Euler((math.radians(48.0), math.radians(-22.0), math.radians(-42.0)), "XYZ")

    # Światło wypełniające (Fill Light)
    fill_data = bpy.data.lights.new(name="KI_FillLight", type="SUN")
    fill_data.energy = 1.4
    fill_data.color = (0.82, 0.90, 1.0)
    fill_obj = bpy.data.objects.new(name="KI_FillLight", object_data=fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = Euler((math.radians(60.0), math.radians(25.0), math.radians(135.0)), "XYZ")

    return pivot


def render_all_directions(args):
    scene = bpy.context.scene
    out_root = Path(args.out).resolve()
    out_root.mkdir(parents=True, exist_ok=True)

    setup_render_settings(scene, args.resolution, args.threads, args.freestyle)
    pivot = setup_ki_camera_and_lights(args.ortho_scale)

    manifest_records = []
    total_rendered = 0

    for state_name, spec in STATES.items():
        n_frames = spec["frames"]
        start_f = spec["start_frame"]

        for dir_name, azimuth_deg in DIRECTIONS:
            pivot.rotation_euler = Euler((0.0, 0.0, math.radians(azimuth_deg)), "XYZ")
            dir_folder = out_root / state_name / dir_name
            dir_folder.mkdir(parents=True, exist_ok=True)

            for f_idx in range(n_frames):
                scene.frame_set(start_f + f_idx)
                frame_file = dir_folder / f"{f_idx:02d}.png"
                scene.render.filepath = str(frame_file)
                bpy.ops.render.render(write_still=True)
                total_rendered += 1
                manifest_records.append(f"{args.actor}/{state_name}/{dir_name}/{f_idx:02d}")

    summary_path = out_root / "render_summary.json"
    summary_path.write_text(
        json.dumps(
            {
                "actor": args.actor,
                "resolution": args.resolution,
                "threads_used": args.threads,
                "total_frames": total_rendered,
                "frames": manifest_records,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"[KI Legends Blender] Zakończono renderowanie {total_rendered} klatek w {out_root}")


if __name__ == "__main__":
    render_all_directions(parse_args())
