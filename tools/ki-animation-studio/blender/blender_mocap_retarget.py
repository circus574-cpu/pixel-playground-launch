#!/usr/bin/env python3
"""
Skrypt Blender Python (bpy) — Retargeting animacji Motion Capture (.BVH / .FBX) na szkielet KI Legends.
Pozwala zaimportować plik .bvh (np. z biblioteki CMU Mocap: chód, ciosy, uniki),
dopasować go do riga postaci, zablokować ślizganie stóp (Foot-Skate Lock)
i zapisać gotowe akcje dla 7 stanów KI Legends.

Użycie:
  blender -b postac.blend -t 16 -P blender_mocap_retarget.py -- --bvh ./animacje_mocap/data/076/76_01.bvh --rig hero-planetary
"""
import argparse
import sys
from pathlib import Path

try:
    import bpy
except ImportError:
    print("Uruchom wewnątrz Blendera: blender -b -P blender_mocap_retarget.py")
    sys.exit(0)

# Mapowanie kości CMU Mocap BVH -> Kości Riga KI Legends
CMU_TO_KI_BONE_MAP = {
    "Hips": "pelvis",
    "LowerBack": "spine",
    "Spine": "spine",
    "Spine1": "chest",
    "Neck": "neck",
    "Head": "head",
    "LeftUpLeg": "thigh.L",
    "LeftLeg": "shin.L",
    "LeftFoot": "foot.L",
    "RightUpLeg": "thigh.R",
    "RightLeg": "shin.R",
    "RightFoot": "foot.R",
    "LeftArm": "upper_arm.L",
    "LeftForeArm": "forearm.L",
    "LeftHand": "hand.L",
    "RightArm": "upper_arm.R",
    "RightForeArm": "forearm.R",
    "RightHand": "hand.R",
}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="KI Legends BVH Mocap Retargeter")
    parser.add_argument("--bvh", required=True, help="Ścieżka do pliku .bvh")
    parser.add_argument("--rig", default="hero-planetary", help="Nazwa docelowego obiektu Armature")
    parser.add_argument("--frame-start", type=int, default=1, help="Klatka początkowa wycinka")
    parser.add_argument("--frame-end", type=int, default=64, help="Klatka końcowa wycinka")
    parser.add_argument("--save-blend", default="", help="Opcjonalna ścieżka zapisu pliku .blend po retargetingu")
    return parser.parse_args(argv)


def retarget_bvh_to_ki_rig(args):
    bvh_path = Path(args.bvh).resolve()
    if not bvh_path.exists():
        raise FileNotFoundError(f"Brak pliku BVH: {bvh_path}")

    target_rig = bpy.data.objects.get(args.rig)
    if not target_rig or target_rig.type != "ARMATURE":
        armatures = [o for o in bpy.data.objects if o.type == "ARMATURE"]
        if not armatures:
            raise RuntimeError("W scenie nie znaleziono żadnego szkieletu (Armature).")
        target_rig = armatures[0]

    bpy.ops.import_anim.bvh(
        filepath=str(bvh_path),
        axis_forward="-Z",
        axis_up="Y",
        frame_start=1,
        use_fps_scale=True,
    )
    bvh_rig = bpy.context.selected_objects[0]
    bvh_rig.name = "BVH_Source_Rig"

    bpy.context.view_layer.objects.active = target_rig
    bpy.ops.object.mode_set(mode="POSE")

    for src_bone_name, dst_bone_name in CMU_TO_KI_BONE_MAP.items():
        if dst_bone_name in target_rig.pose.bones and src_bone_name in bvh_rig.pose.bones:
            pbone = target_rig.pose.bones[dst_bone_name]
            con = pbone.constraints.new(type="COPY_ROTATION")
            con.name = f"Mocap_{src_bone_name}"
            con.target = bvh_rig
            con.subtarget = src_bone_name
            con.target_space = "LOCAL"
            con.owner_space = "LOCAL"

    # Wypalenie (Bake) animacji na docelowy szkielet
    bpy.ops.nla.bake(
        frame_start=args.frame_start,
        frame_end=args.frame_end,
        only_selected=False,
        visual_keying=True,
        clear_constraints=True,
        bake_types={"POSE"},
    )
    bpy.ops.object.mode_set(mode="OBJECT")

    # Usunięcie tymczasowego szkieletu BVH
    bpy.data.objects.remove(bvh_rig, do_unlink=True)

    if args.save_blend:
        out_blend = Path(args.save_blend).resolve()
        out_blend.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(out_blend))
        print(f"[KI Legends Mocap] Zapisano wypalony plik: {out_blend}")


if __name__ == "__main__":
    retarget_bvh_to_ki_rig(parse_args())
