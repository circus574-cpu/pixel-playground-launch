"""Project OpenPose-style keypoints of the Planetarni rig for the 8 world directions.
The rig is only a pose/orientation guide for the painted base views; it never appears in the result.
Run with ki-blender-python; writes /workspace/ki-legends-gpu/renders/planetary-painted-v1/keypoints.json
"""
import bpy, json, math
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from pathlib import Path
SRC='/opt/ki-legends-gpu/planetary-rig-v4/planetary-rig-down.blend'
OUT=Path('/workspace/ki-legends-gpu/renders/planetary-painted-v1');OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=SRC)
rig=bpy.data.objects['hero-planetary'];scene=bpy.context.scene;cam=scene.camera
DIRS={'down':0,'down-left':-45,'left':-90,'up-left':-135,'up':180,'up-right':135,'right':90,'down-right':45}
def head(name):return rig.matrix_world@rig.pose.bones[name].head
result={}
for name,angle in DIRS.items():
    rig.rotation_euler.z=math.radians(angle);bpy.context.view_layer.update()
    m3=rig.matrix_world.to_3x3();fwd=(m3@Vector((0,-1,0))).normalized();left=(m3@Vector((1,0,0))).normalized();up=Vector((0,0,1))
    hb=rig.pose.bones['head'];hc=rig.matrix_world@((hb.head+hb.tail)/2)
    P={'nose':hc+fwd*.30-up*.02,'neck':head('neck'),
       'r_sho':head('upper_arm.R'),'r_elb':head('forearm.R'),'r_wri':head('hand.R'),
       'l_sho':head('upper_arm.L'),'l_elb':head('forearm.L'),'l_wri':head('hand.L'),
       'r_hip':head('thigh.R'),'r_kne':head('shin.R'),'r_ank':head('foot.R'),
       'l_hip':head('thigh.L'),'l_kne':head('shin.L'),'l_ank':head('foot.L'),
       'r_eye':hc+fwd*.27-left*.11+up*.05,'l_eye':hc+fwd*.27+left*.11+up*.05,
       'r_ear':hc-left*.31-fwd*.02,'l_ear':hc+left*.31-fwd*.02}
    pts={}
    for k,v in P.items():
        c=world_to_camera_view(scene,cam,v);pts[k]=[c.x,1-c.y]
    result[name]=pts;print('KP',name,flush=True)
(OUT/'keypoints.json').write_text(json.dumps(result,indent=1));print('KEYPOINTS_DONE',flush=True)
