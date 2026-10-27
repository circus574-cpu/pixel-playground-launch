# blender -b -P mannequin.py -- <bvh> <out_dir> <yaw_deg> <start> <frames>
import bpy, sys, math, mathutils, os
argv = sys.argv[sys.argv.index("--") + 1:]
bvh, out, yaw, start, nfr = argv[0], argv[1], float(argv[2]), int(argv[3]), int(argv[4])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_anim.bvh(filepath=bvh, global_scale=0.056, frame_start=1, use_fps_scale=True, update_scene_fps=True, rotate_mode='NATIVE', axis_forward='-Z', axis_up='Y')
arm = bpy.context.selected_objects[0]
sc = bpy.context.scene
def mat(name, rgb):
    m = bpy.data.materials.new(name); m.diffuse_color = (*rgb, 1); return m
skin, cloth, shoe = mat("skin", (0.85, 0.66, 0.55)), mat("cloth", (0.15, 0.2, 0.35)), mat("shoe", (0.08, 0.08, 0.08))
for b in arm.data.bones:
    n = b.name.lower(); L = b.length
    if L < 0.02: continue
    K = float(__import__('os').environ.get('BULK', '1.0'))
    r = (0.16 if ("spine" in n or "chest" in n) else 0.13 if "hips" in n else (0.11 if "head" in n else (0.085 if ("upleg" in n or "thigh" in n) else 0.07 if "leg" in n else 0.075 if ("arm" in n and "fore" not in n) else 0.06)))
    if "head" not in n: r *= K
    if "head" in n:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12)
    else:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=L, vertices=16)
    o = bpy.context.active_object
    o.data.materials.append(skin if ("head" in n or "hand" in n or "neck" in n) else (shoe if ("foot" in n or "toe" in n) else cloth))
    o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = b.name
    o.location = (0, -L / 2 if "head" not in n else -0.0, 0)
    o.rotation_euler = (math.pi / 2, 0, 0)
    if "shoulder" in n or "collar" in n or "clavicle" in n:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11 * K); sh = bpy.context.active_object
        sh.data.materials.append(cloth); sh.parent = arm; sh.parent_type = 'BONE'; sh.parent_bone = b.name; sh.location = (0, 0, 0)
# widen stance: rotate up-legs outward about world forward axis (Y), baked per frame
import os
ABD = float(os.environ.get('ABD', '0'))
if ABD:
    W = arm.matrix_world; Wi = W.inverted()
    legs = [pb for pb in arm.pose.bones if ("upleg" in pb.name.lower() or "thigh" in pb.name.lower())]
    frames = list(range(start, start + nfr, int(os.environ.get('STEP', '1'))))
    cache = {}
    for f in frames:
        sc.frame_set(f)
        for pb in legs:
            s = 1 if pb.name.lower().startswith("left") else -1
            head = W @ pb.head
            R = mathutils.Matrix.Translation(head) @ mathutils.Matrix.Rotation(math.radians(-s * ABD), 4, 'Y') @ mathutils.Matrix.Translation(-head)
            cache[(f, pb.name)] = Wi @ R @ W @ pb.matrix
    act = arm.animation_data.action
    for pb in legs:
        for fc in [fc for fc in act.fcurves if fc.data_path.startswith(f'pose.bones["{pb.name}"].rotation')]:
            act.fcurves.remove(fc)
        pb.rotation_mode = 'QUATERNION'
    for f in frames:
        sc.frame_set(f)
        for pb in legs:
            pb.matrix = cache[(f, pb.name)]
            bpy.context.view_layer.update()
            pb.keyframe_insert("rotation_quaternion", frame=f)
    print("ABD_OK", [pb.name for pb in legs])

# camera follows hips horizontally, faces the character
hips = [b for b in arm.pose.bones if "hip" in b.name.lower()][0]
empty = bpy.data.objects.new("follow", None); sc.collection.objects.link(empty)
c = empty.constraints.new('COPY_LOCATION'); c.target = arm; c.subtarget = hips.name; c.use_z = False
cam_d = bpy.data.cameras.new("cam"); cam_d.type = 'ORTHO'; cam_d.ortho_scale = float(__import__('os').environ.get('ORTHO','2.9'))
cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.parent = empty
a = math.radians(yaw)
cam.location = (6 * math.sin(a), -6 * math.cos(a), 0.95)
cam.rotation_euler = (math.pi / 2, 0, a)
sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
sc.world = bpy.data.worlds.new("w"); sc.world.color = (1, 1, 1)
sc.render.resolution_x, sc.render.resolution_y = int(__import__('os').environ.get('RX','720')), int(__import__('os').environ.get('RY','1280'))
sc.frame_step = int(__import__('os').environ.get('STEP','1'))
sc.render.film_transparent = False
sc.frame_start, sc.frame_end = start, start + nfr - 1
sc.render.fps = 30
sc.render.image_settings.file_format = 'PNG'
sc.render.filepath = out
# dump OpenPose COCO-18 2D joints per rendered frame (JOINTS=<json path>)
JP = os.environ.get('JOINTS')
if JP:
    import json
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()
    PB = {b.name: b for b in arm.pose.bones}
    def P(name, tail=False):
        b = PB[name]; return arm.matrix_world @ (b.tail if tail else b.head)
    res = (sc.render.resolution_x, sc.render.resolution_y)
    data = {}
    for f in range(sc.frame_start, sc.frame_end + 1, sc.frame_step):
        sc.frame_set(f)
        hc = P('Head', True); ls, rs = P('LeftArm'), P('RightArm'); lh, rh = P('LeftUpLeg'), P('RightUpLeg')
        up = mathutils.Vector((0, 0, 1)); left = (lh - rh).normalized(); fwd = left.cross(up).normalized()
        tocam = (cam.matrix_world.translation - hc).normalized()
        pts = {0: hc + fwd * 0.11, 1: (ls + rs) / 2, 2: rs, 3: P('RightForeArm'), 4: P('RightHand'), 5: ls, 6: P('LeftForeArm'), 7: P('LeftHand'),
               8: rh, 9: P('RightLeg'), 10: P('RightFoot'), 11: lh, 12: P('LeftLeg'), 13: P('LeftFoot'),
               14: hc + fwd * 0.09 - left * 0.04 + up * 0.03, 15: hc + fwd * 0.09 + left * 0.04 + up * 0.03,
               16: hc - left * 0.09, 17: hc + left * 0.09}
        vis = {0: fwd.dot(tocam) > -0.3, 14: (fwd - left * 0.6).dot(tocam) > -0.1, 15: (fwd + left * 0.6).dot(tocam) > -0.1,
               16: (-left + fwd * 0.3).dot(tocam) > -0.2, 17: (left + fwd * 0.3).dot(tocam) > -0.2}
        fr = []
        for k in range(18):
            c = world_to_camera_view(sc, cam, pts[k])
            fr.append([c.x * res[0], (1 - c.y) * res[1], 1 if vis.get(k, True) else 0])
        data[f] = fr
    json.dump({"res": res, "frames": data}, open(JP, "w")); print("JOINTS_OK", len(data))

if os.environ.get("NORENDER"): sys.exit(0)
bpy.ops.render.render(animation=True)
print("RENDER_OK", out)
