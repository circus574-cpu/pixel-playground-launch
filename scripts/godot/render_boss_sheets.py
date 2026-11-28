"""Bake directional boss sprites using Blender Cycles on CPU.

Usage: blender -b -t 4 -P scripts/godot/render_boss_sheets.py -- MODEL.glb FRAMES_DIR
Pack the eight RGBA images in order into a 4×2 WebP atlas with 256 px cells.
"""

import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

DIRECTIONS = ("down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right")
model, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
output.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(model.resolve()))
scene = bpy.context.scene
meshes = [obj for obj in scene.objects if obj.type == "MESH"]
vertices = [obj.matrix_world @ Vector(v) for obj in meshes for v in obj.bound_box]
low = Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
high = Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
size = high - low
center = (low + high) * 0.5
radius = max(size.x, size.y, size.z)
assert radius > 0.001

camera = bpy.data.objects.new("Isometric", bpy.data.cameras.new("Isometric"))
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.type = "ORTHO"
camera.data.clip_end = radius * 32.0
camera.data.ortho_scale = max(math.hypot(size.x, size.y), size.z * 0.87 + math.hypot(size.x, size.y) * 0.5) * 1.38
floor_center = Vector((center.x, center.y, low.z))
camera_target = floor_center + Vector((0, 0, camera.data.ortho_scale * 0.39))

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.render.resolution_x = scene.render.resolution_y = 256
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "AgX"
scene.world = bpy.data.worlds.new("Ambient")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.76, 0.81, 0.89, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.86

for name, direction, power in (
    ("Key", (-3, -4, 6), 500),
    ("Fill", (4, -2, 3), 220),
    ("Rim", (0, 3, 5), 400),
):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power * radius**2
    data.shape, data.size = "DISK", radius * 3
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = center + Vector(direction) * radius
    light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()

for index, direction in enumerate(DIRECTIONS):
    angle = index * math.pi / 4.0
    offset = Vector((math.sin(angle), -math.cos(angle), 0.70)) * radius * 4.0
    camera.location = camera_target + offset
    camera.rotation_euler = (-offset).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str((output / f"{direction}.png").resolve())
    bpy.ops.render.render(write_still=True)
