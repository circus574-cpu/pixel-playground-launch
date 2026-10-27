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
