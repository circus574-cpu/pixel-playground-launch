"""Create an editable .blend with all imported actions retained and textures packed."""

import math
from pathlib import Path
import sys

import bpy
from mathutils import Euler

root = Path(__file__).resolve().parents[1]
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
model = Path(args[0]) if args else root / "godot/assets/KI-Legends-GameMaster.glb"
output = Path(args[1]) if len(args) >= 2 else root / "blender/GameMaster.blend"
expected = {"walk", "takeoff", "hover", "glide", "land", "flight", "heavy_strike", "ki_blast"}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(model))
actions = {action.name.removesuffix("_Armature"): action for action in bpy.data.actions}
for name, action in actions.items():
    action.name = name
assert expected <= actions.keys(), sorted(actions)
armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
assert len(armatures) == 1
rig = armatures[0]
for action in actions.values():
    action.use_fake_user = True
rig.name = "GameMaster Rig"
rig.animation_data.action = actions["hover"]
for track in rig.animation_data.nla_tracks:
    track.mute = True

scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = round(3.2 * scene.render.fps)
scene.frame_set(37)
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            space = area.spaces.active
            space.shading.type = "MATERIAL"
            space.region_3d.view_rotation = Euler((math.radians(82), 0, math.radians(13)), "XYZ").to_quaternion()
            space.region_3d.view_location = (0.0, 0.0, 4.2)
            space.region_3d.view_distance = 10.5
            space.overlay.show_extras = False
bpy.ops.file.pack_all()
assert all(image.packed_file for image in bpy.data.images if image.source == "FILE")
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
print("GAMEMASTER_BLEND_OK", sorted(actions), len(rig.data.bones))
