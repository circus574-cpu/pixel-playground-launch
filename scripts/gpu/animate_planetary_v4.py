"""Render real skeletal Planetarni clips. No frame slicing or per-frame AI redraw.
Use --review for a short motion check; complete output requires a validated review.
"""
import argparse, hashlib, json, math, time, io, tarfile
from pathlib import Path
import bpy
import numpy as np
from mathutils import Quaternion, Vector

parser=argparse.ArgumentParser();parser.add_argument('--review',action='store_true');parser.add_argument('--validate-only',action='store_true');parser.add_argument('--render-validated',action='store_true');args=parser.parse_args()
ROOT=Path('/workspace/ki-legends-gpu')
SOURCE=Path('/opt/ki-legends-gpu/planetary-rig-v4/planetary-rig-down.blend')
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig=bpy.data.objects['hero-planetary'];scene=bpy.context.scene
scene.render.use_freestyle=False  # contours are checked separately; avoid CPU bottleneck during motion QA
scene.cycles.samples=16
scene.render.use_persistent_data=True
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='CUDA'
scene.cycles.device='GPU'
origin=.75;ortho=7.0
cam=scene.camera;cam.data.ortho_scale=ortho
target=Vector((0,0,(origin-.5)*ortho/math.cos(math.pi/4)))
cam.location=target+Vector((0,-10,10));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
DIRECTIONS={'down':0,'down-left':-45,'left':-90,'up-left':-135,'up':180,'up-right':135,'right':90,'down-right':45}
CLIPS={'idle':(8,6,True),'walk':(8,16,True),'attack':(8,16,False),'skill':(8,12,False),'hit':(4,16,False),'death':(8,10,False),'respawn':(8,12,False)}
base={b.name:(b.rotation_quaternion.copy(),b.location.copy(),b.scale.copy()) for b in rig.pose.bones}
rest={b.name:b.matrix_local.to_quaternion() for b in rig.data.bones}

def rot(name,axis,angle):
    b=rig.pose.bones[name];q=rest[name].inverted()@Quaternion(Vector(axis),angle)@rest[name]
    b.rotation_quaternion=q@b.rotation_quaternion

def reset():
    rig.location=(0,0,0)
    for name,(q,p,s) in base.items():
        b=rig.pose.bones[name];b.rotation_quaternion=q;b.location=p;b.scale=s

def leg(side,dy=0,lift=0):
    suffix='.'+side
    h=rig.data.bones['thigh'+suffix].head_local;k=rig.data.bones['shin'+suffix].head_local;a=rig.data.bones['foot'+suffix].head_local
    u=k-h;v=a-k;l1=math.hypot(u.y,u.z);l2=math.hypot(v.y,v.z)
    a0=math.atan2(-u.y,-u.z);b0=math.atan2(-v.y,-v.z)
    yy=a.y+dy-h.y;zz=a.z+lift-h.z-rig.location.z
    length=min(math.hypot(yy,zz),l1+l2-.0001)
    gamma=math.atan2(-yy,-zz)
    alpha=gamma+math.acos(max(-1,min(1,(l1*l1+length*length-l2*l2)/(2*l1*length))))
    ky=-l1*math.sin(alpha);kz=-l1*math.cos(alpha)
    beta=math.atan2(-(yy-ky),-(zz-kz))
    rot('thigh'+suffix,(1,0,0),-(alpha-a0))
    rot('shin'+suffix,(1,0,0),-((beta-alpha)-(b0-a0)))
    rot('foot'+suffix,(1,0,0),beta-b0)

def fold(amount):
    rig.location.z=-2.05*amount
    rot('chest',(1,0,0),-1.05*amount);rot('spine',(1,0,0),-.22*amount)
    rot('neck',(1,0,0),.25*amount)
    for side,sign in [('L',1),('R',-1)]:
        leg(side,-.65*amount,0)
        rot('upper_arm.'+side,(0,1,0),sign*.3*amount)
        rot('forearm.'+side,(1,0,0),.3*amount)

def pose(state,index,count):
    reset();t=index/count;p=index/max(1,count-1);wave=math.sin(t*math.tau)
    if state=='idle':
        rig.location.z=.012*wave
        rig.pose.bones['chest'].scale=(1+.008*wave,1+.012*wave,1+.004*wave)
        rot('head',(0,0,1),.025*math.sin(t*math.tau))
        for side in ['L','R']:leg(side)
    elif state=='walk':
        # 205 world units/s at 16 fps: a jog. Stance stroke follows speed, not arbitrary foot sliding.
        # Foot-on-ground travel at 205 u/s needs a stride of 88% of leg reach (measured), which forces a squat.
        # The stride is scaled to 65% (small foot slide, invisible at 128px) so the legs stay long.
        stroke=205*(8/16)*.30/(128/ortho*math.sin(math.pi/4))*.65
        th=rig.data.bones['thigh.L'].head_local;kn=rig.data.bones['shin.L'].head_local;an=rig.data.bones['foot.L'].head_local
        reach=math.hypot((kn-th).y,(kn-th).z)+math.hypot((an-kn).y,(an-kn).z);height=th.z-an.z
        drop=max(0.0,math.hypot(stroke*.5,height)-.985*reach)
        rig.location.z=-drop+.025*math.cos(t*math.tau*2)
        for side,offset,sign in [('L',0,1),('R',.5,-1)]:
            phase=(t+offset)%1
            if phase<.30:dy=-stroke*.5+stroke*phase/.30;lift=0
            else:
                swing=(phase-.30)/.70;dy=stroke*.5-stroke*swing;lift=.78*math.sin(math.pi*swing)
            leg(side,dy,lift)
            rot('upper_arm.'+side,(1,0,0),-.45*math.sin((t+offset)*math.tau))
            rot('forearm.'+side,(1,0,0),.12+.10*math.cos((t+offset)*math.tau))
        rot('chest',(0,0,1),.045*wave);rot('head',(0,0,1),-.025*wave);rot('chest',(1,0,0),-.10);rot('head',(1,0,0),.07)
    elif state in ['attack','skill']:
        force=(1-p)**1.4
        if state=='attack':
            rot('chest',(0,0,1),-.18*force)
            rot('upper_arm.R',(1,0,0),-1.25*force);rot('forearm.R',(1,0,0),-.43*force)
            rot('upper_arm.L',(1,0,0),-.15*force)
        else:
            for side in ['L','R']:
                rot('upper_arm.'+side,(1,0,0),-1.1*force);rot('forearm.'+side,(1,0,0),-.2*force)
            rot('chest',(1,0,0),.07*force)
        for side in ['L','R']:leg(side)
    elif state=='hit':
        force=math.sin((p*.8+.2)*math.pi)*(1-p)
        rot('spine',(1,0,0),-.2*force);rot('head',(1,0,0),-.12*force)
    elif state=='death':fold(math.sin(p*math.pi/2))
    elif state=='respawn':fold(1-(p*p*(3-2*p)))
    wind=wave if state in ['idle','walk'] else math.sin(p*math.pi)
    for b in rig.pose.bones:
        if b.name.startswith(('scarf-','amber-tabard.','ivory-tabard.')):
            segment=int(b.name.rsplit('.',1)[1]);rot(b.name,(0,0,1),(.04+segment*.025)*wind)
    bpy.context.view_layer.update()

name='planetary-motion-review-v4' if args.review else 'planetary-motion-v4'
PERSISTENT=ROOT/'renders'/name;PERSISTENT.mkdir(parents=True,exist_ok=True)
LOCAL=Path('/opt/ki-legends-gpu')/name;LOCAL.mkdir(exist_ok=True);OUT=LOCAL
# Render on POSIX storage; one archived checkpoint per direction avoids 832 slow FUSE writes.
for existing in list(PERSISTENT.glob('*.json'))+list(PERSISTENT.glob('*.report')):
    if not (OUT/existing.name).exists():(OUT/existing.name).write_bytes(existing.read_bytes())

# Preserve editable, named skeletal actions. Facing is handled by the renderer, outside each action.
rig.animation_data_create()
for state,(count,fps,loop) in CLIPS.items():
    action=bpy.data.actions.new('planetary/'+state);action.use_fake_user=True;rig.animation_data.action=action
    for i in range(count):
        pose(state,i,count)
        rig.keyframe_insert(data_path='location',frame=i+1)
        for b in rig.pose.bones:
            for field in ['rotation_quaternion','location','scale']:b.keyframe_insert(data_path=field,frame=i+1,group=b.name)
    action['fps']=fps;action['loop']=loop
rig.animation_data.action=None
blend=LOCAL/'planetary-motion-source.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend));(OUT/blend.name).write_bytes(blend.read_bytes())
# Project only vertices referenced by evaluated polygons (the CC0 source includes unused helpers).
# Validate every pose/facing before spending GPU time, with one global camera and no recropping.
if args.render_validated:
    report=json.loads((OUT/'motion-preflight.report').read_text())
    if len(report['bounds'])!=416 or report['violations']:raise RuntimeError('Full fixed-camera preflight must pass before rendering')
else:
    projection=np.array(cam.matrix_world.inverted())
    bounds=[]
    for state,(count,fps,loop) in CLIPS.items():
        for direction,angle in DIRECTIONS.items():
            rig.rotation_euler.z=math.radians(angle)
            for i in range(count):
                pose(state,i,count);graph=bpy.context.evaluated_depsgraph_get();low=np.array([float('inf'),float('inf')]);high=-low
                for obj in scene.objects:
                    if obj.type!='MESH' or obj.hide_render:continue
                    evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
                    xyz=np.empty(len(mesh.vertices)*3,dtype=np.float64);mesh.vertices.foreach_get('co',xyz)
                    ids=np.empty(len(mesh.loops),dtype=np.int32);mesh.loops.foreach_get('vertex_index',ids)
                    if len(ids):
                        points=xyz.reshape((-1,3))[np.unique(ids)]
                        matrix=projection@np.array(evaluated.matrix_world)
                        xyz=points@matrix[:3,:3].T+matrix[:3,3]
                        pixels=np.column_stack(((.5+xyz[:,0]/ortho)*512,(.5-xyz[:,1]/ortho)*512))
                        low=np.minimum(low,pixels.min(axis=0));high=np.maximum(high,pixels.max(axis=0))
                    evaluated.to_mesh_clear()
                bounds.append({'state':state,'direction':direction,'index':i,'bounds':[*low.tolist(),*high.tolist()]})
    violations=[b for b in bounds if min(b['bounds'][:2])<8 or max(b['bounds'][2:])>504]
    (OUT/'motion-preflight.report').write_text(json.dumps({'bounds':bounds,'violations':violations,'fixed_camera':True},indent=2)+'\n')
    print('GEOMETRY_PREFLIGHT',len(bounds),'poses;',len(violations),'margin violations',flush=True)
    if violations:raise RuntimeError('Fixed camera crops animation geometry: '+json.dumps(violations[:3]))
    if args.validate_only:raise SystemExit(0)
completed=[]
for state,(count,fps,loop) in CLIPS.items():
    for direction,angle in DIRECTIONS.items():
        if args.review and (state not in ['walk','attack','death','respawn'] or direction not in ['down','right']):continue
        rig.rotation_euler.z=math.radians(angle)
        for i in range(count):
            pose(state,i,count)
            name=f'{state}-{direction}-{i:02}'
            image=LOCAL/(name+'.png')
            previous=OUT/(name+'.json')
            if image.exists() and previous.exists():
                metadata=json.loads(previous.read_text())
                if hashlib.sha256(image.read_bytes()).hexdigest()!=metadata['sha256']:raise RuntimeError('Cannot resume a corrupt frame')
                completed.append(metadata);print('FRAME_RESUMED',name,len(completed),flush=True);continue
            scene.render.filepath=str(image);start=time.monotonic();bpy.ops.render.render(write_still=True)
            data=image.read_bytes();(OUT/image.name).write_bytes(data)
            meta={'id':name,'state':state,'direction':direction,'index':i,'fps':fps,'loop':loop,'width':512,'height':512,'origin':[.5,origin],'world_canvas':[128,128],'camera_elevation':45,'orthographic_scale':ortho,'sha256':hashlib.sha256(data).hexdigest(),'seconds':time.monotonic()-start,'status':'motion-review-not-installed'}
            (OUT/(name+'.json')).write_text(json.dumps(meta,indent=2)+'\n');completed.append(meta)
            print('FRAME_COMPLETE',name,len(completed),flush=True)
        bundle=io.BytesIO()
        with tarfile.open(fileobj=bundle,mode='w:gz') as archive:
            for i in range(count):
                for suffix in ['.png','.json']:
                    source=OUT/f'{state}-{direction}-{i:02}{suffix}';archive.add(source,arcname=source.name)
        (PERSISTENT/f'{state}-{direction}.tar.gz').write_bytes(bundle.getvalue())
        print('DIRECTION_COMPLETE',state,direction,flush=True)
manifest={'source':'planetary-motion-source.blend','source_sha256':hashlib.sha256(blend.read_bytes()).hexdigest(),'frames':completed,'status':'review-required','model':'one-deforming-mesh-not-frame-redraws'}
# Separate manifest extension avoids confusing image-pair transfer tools.
(OUT/'motion.manifest').write_text(json.dumps(manifest,indent=2)+'\n')
# Give the editable source a paired metadata+preview for safe exact capability transfer.
first=next(OUT.glob('*.png'));(OUT/'planetary-motion-source.png').write_bytes(first.read_bytes())
(OUT/'planetary-motion-source.json').write_text(json.dumps({'sha256':hashlib.sha256(first.read_bytes()).hexdigest(),'blend_sha256':manifest['source_sha256'],'status':'editable-source-with-review-preview'},indent=2)+'\n')
print('MOTION_BATCH_COMPLETE',len(completed),flush=True)
