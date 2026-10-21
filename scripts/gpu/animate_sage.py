"""Render real skeletal Mędrcy clips. No frame slicing or per-frame AI redraw.
Use --review for a short motion check; complete output requires a validated review.
"""
import argparse, hashlib, json, math, time, io, tarfile
from pathlib import Path
import bpy
import numpy as np
from mathutils import Quaternion, Vector

parser=argparse.ArgumentParser()
parser.add_argument('--review',action='store_true',help='Four full clips in two directions')
parser.add_argument('--samples',action='store_true',help='Three poses of every state in down/right: 42 actual frames')
parser.add_argument('--validate-only',action='store_true')
parser.add_argument('--render-validated',action='store_true',help='Reuse matching, clean 416-pose preflight')
parser.add_argument('--review-approved',action='store_true',help='Operator has visually checked sample renders')
args=parser.parse_args()
if not (args.review or args.samples or args.validate_only or args.review_approved):
    parser.error('Inspect samples first, then use --review-approved for complete production')
ROOT=Path('/workspace/ki-legends-gpu')
SOURCE=Path('/opt/ki-legends-gpu/sage-rig-v1/sage-rig-down.blend')
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig=bpy.data.objects['hero-sage'];scene=bpy.context.scene
scene.render.use_freestyle=False  # contours are checked separately; avoid CPU bottleneck during motion QA
scene.cycles.samples=16
scene.render.use_persistent_data=True
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='CUDA'
scene.cycles.device='GPU'
origin=.75;ortho=8.0
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
    rig.rotation_euler.x=0
    rig.rotation_euler.y=0
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

def smooth(value):
    value=max(0,min(1,value));return value*value*(3-2*value)

def fold(amount):
    # First lose stance, then fall onto the side; the final pose is not a living crouch.
    kneel=smooth(amount/.60)
    fall=smooth((amount-.35)/.65)
    rig.location.z=-1.70*kneel*(1-fall)
    rot('spine',(1,0,0),-.20*kneel)
    rot('chest',(1,0,0),-.48*kneel)
    rot('neck',(1,0,0),-.22*kneel)
    rot('head',(1,0,0),-.18*kneel)
    for side in ['L','R']:leg(side,-.50*kneel,0)
    rig.rotation_euler.y=math.radians(82)*fall
    rig.location.x=-2.60*fall*math.cos(rig.rotation_euler.z)
    rig.location.y=-2.60*fall*math.sin(rig.rotation_euler.z)
    # Counter-rotate the wrist to keep the staff forward during the side fall.
    rot('hand.L',(1,0,0),1.25*kneel)
    rot('upper_arm.R',(0,1,0),-.16*kneel)
    rot('forearm.R',(1,0,0),.18*kneel)

def seat_fallen_geometry_on_ground():
    # Shared vertical translation only: body, cloth and staff stay on the same rig.
    bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get()
    lowest=float('inf')
    for obj in scene.objects:
        if obj.type!='MESH' or obj.hide_render:continue
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
        xyz=np.empty(len(mesh.vertices)*3,dtype=np.float64);mesh.vertices.foreach_get('co',xyz)
        ids=np.empty(len(mesh.loops),dtype=np.int32);mesh.loops.foreach_get('vertex_index',ids)
        if len(ids):
            points=xyz.reshape((-1,3))[np.unique(ids)]
            matrix=np.array(evaluated.matrix_world)
            zz=points@matrix[2,:3]+matrix[2,3]
            lowest=min(lowest,float(zz.min()))
        evaluated.to_mesh_clear()
    if not math.isfinite(lowest):raise RuntimeError('Cannot find fallen geometry contact')
    rig.location.z+=.025-lowest


def pose(state,index,count):
    reset();t=index/count;p=index/max(1,count-1);wave=math.sin(t*math.tau)
    if state=='idle':
        rig.location.z=.010*wave
        rig.pose.bones['chest'].scale=(1+.004*wave,1+.006*wave,1+.003*wave)
        rot('head',(0,0,1),.018*wave)
        for side in ['L','R']:leg(side)
    elif state=='walk':
        # Same engine speed and temporal stride as the delivered Planetarni standard.
        rig.location.z=-.32+.020*math.cos(t*math.tau*2)
        stroke=205*(8/16)*.30/(128/ortho*math.sin(math.pi/4))
        for side,offset in [('L',0),('R',.5)]:
            phase=(t+offset)%1
            if phase<.30:dy=-stroke*.5+stroke*phase/.30;lift=0
            else:
                swing=(phase-.30)/.70;dy=stroke*.5-stroke*swing;lift=.58*math.sin(math.pi*swing)
            leg(side,dy,lift)
            if side=='R':
                rot('upper_arm.R',(1,0,0),-.30*math.sin((t+offset)*math.tau))
                rot('forearm.R',(1,0,0),.08+.07*math.cos((t+offset)*math.tau))
            else:
                rot('upper_arm.L',(1,0,0),.025*wave)
                rot('forearm.L',(1,0,0),-.018*wave)
        rot('chest',(0,0,1),.022*wave);rot('head',(0,0,1),-.018*wave)
    elif state=='attack':
        # Focused open-hand KI release: gather, extend, recover. Staff remains the support.
        strength=math.sin(math.pi*p)**1.25
        rot('chest',(0,0,1),-.10*strength)
        rot('upper_arm.R',(1,0,0),-.80*strength)
        rot('forearm.R',(1,0,0),-.24*strength)
        rot('hand.R',(0,1,0),-.18*strength)
        for side in ['L','R']:leg(side)
    elif state=='skill':
        # A longer meditative gathering gesture and release, distinct from the attack.
        strength=math.sin(math.pi*p)**.80
        release=max(0,math.sin((p-.30)/.70*math.pi)) if p>=.30 else 0
        rot('chest',(1,0,0),.045*strength)
        rot('upper_arm.R',(1,0,0),-.68*strength)
        rot('upper_arm.R',(0,1,0),-.28*strength)
        rot('forearm.R',(1,0,0),.34*strength-.40*release)
        rot('hand.R',(0,0,1),.20*strength)
        rot('upper_arm.L',(1,0,0),-.035*strength)
        for side in ['L','R']:leg(side)
    elif state=='hit':
        strength=math.sin((p*.8+.2)*math.pi)*(1-p)
        rot('spine',(1,0,0),-.14*strength);rot('head',(1,0,0),-.12*strength)
        rot('upper_arm.R',(1,0,0),.12*strength)
    elif state=='death':fold(p*p*(3-2*p))
    elif state=='respawn':fold(1-(p*p*(3-2*p)))
    wind=wave if state in ['idle','walk'] else math.sin(p*math.pi)
    for b in rig.pose.bones:
        if b.name.startswith(('sage-robe-','sage-hair-','sage-tabard-')):
            try:segment=int(b.name.rsplit('.',1)[1])
            except ValueError:continue
            rot(b.name,(0,0,1),(.022+segment*.012)*wind)
    if state in ['death','respawn']:
        amount=(p*p*(3-2*p)) if state=='death' else 1-(p*p*(3-2*p))
        if amount>0:seat_fallen_geometry_on_ground()
    bpy.context.view_layer.update()

name='sage-motion-v1'
PERSISTENT=ROOT/'renders'/name;PERSISTENT.mkdir(parents=True,exist_ok=True)
LOCAL=Path('/opt/ki-legends-gpu')/name;LOCAL.mkdir(exist_ok=True);OUT=LOCAL
# Render on POSIX storage; one archived checkpoint per direction avoids 832 slow FUSE writes.
# Restore only immutable, known leaf entries if the local container was replaced.
for archived in sorted(PERSISTENT.glob('*.tar.gz')):
    with tarfile.open(archived,mode='r:gz') as checkpoint:
        for member in checkpoint.getmembers():
            if not member.isfile() or Path(member.name).name!=member.name or not member.name.endswith(('.png','.json')):
                raise RuntimeError('Unsafe checkpoint entry: '+member.name)
            target=LOCAL/member.name
            if not target.exists():
                stream=checkpoint.extractfile(member)
                if stream is None:raise RuntimeError('Unreadable checkpoint entry')
                target.write_bytes(stream.read())
for existing in list(PERSISTENT.glob('*.json'))+list(PERSISTENT.glob('*.report')):
    if not (OUT/existing.name).exists():(OUT/existing.name).write_bytes(existing.read_bytes())

# Preserve editable, named skeletal actions. Facing is handled by the renderer, outside each action.
rig.animation_data_create()
rig.rotation_euler.z=0  # Skeletal source actions are authored in canonical facing.
for state,(count,fps,loop) in CLIPS.items():
    action=bpy.data.actions.new('sage/'+state);action.use_fake_user=True;rig.animation_data.action=action
    for i in range(count):
        pose(state,i,count)
        rig.keyframe_insert(data_path='location',frame=i+1)
        rig.keyframe_insert(data_path='rotation_euler',frame=i+1)
        for b in rig.pose.bones:
            for field in ['rotation_quaternion','location','scale']:b.keyframe_insert(data_path=field,frame=i+1,group=b.name)
    action['fps']=fps;action['loop']=loop
rig.animation_data.action=None
blend=LOCAL/'sage-motion-source.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend));(PERSISTENT/blend.name).write_bytes(blend.read_bytes())
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
script_hash=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
# Project only vertices referenced by evaluated polygons (the CC0 source includes unused helpers).
# Validate every pose/facing before spending GPU time, with one global camera and no recropping.
if args.render_validated:
    report=json.loads((OUT/'motion-preflight.report').read_text())
    if len(report['bounds'])!=416 or report['violations'] or report.get('source_sha256')!=source_hash or report.get('script_sha256')!=script_hash:raise RuntimeError('Matching full fixed-camera preflight must pass before rendering')
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
    (OUT/'motion-preflight.report').write_text(json.dumps({'bounds':bounds,'violations':violations,'fixed_camera':True,'source_sha256':source_hash,'script_sha256':script_hash},indent=2)+'\n')
    (PERSISTENT/'motion-preflight.report').write_bytes((OUT/'motion-preflight.report').read_bytes())
    print('GEOMETRY_PREFLIGHT',len(bounds),'poses;',len(violations),'margin violations',flush=True)
    if violations:raise RuntimeError('Fixed camera crops animation geometry: '+json.dumps(violations[:3]))
    if args.validate_only:raise SystemExit(0)
completed=[]
for state,(count,fps,loop) in CLIPS.items():
    for direction,angle in DIRECTIONS.items():
        if args.review and (state not in ['walk','attack','death','respawn'] or direction not in ['down','right']):continue
        if args.samples and direction not in ['down','right']:continue
        rig.rotation_euler.z=math.radians(angle)
        indices=sorted({0,count//2,count-1}) if args.samples else range(count)
        for i in indices:
            pose(state,i,count)
            name=f'{state}-{direction}-{i:02}'
            image=LOCAL/(name+'.png')
            previous=OUT/(name+'.json')
            if image.exists() and previous.exists():
                metadata=json.loads(previous.read_text())
                if hashlib.sha256(image.read_bytes()).hexdigest()!=metadata['sha256'] or metadata.get('source_sha256')!=source_hash or metadata.get('script_sha256')!=script_hash:raise RuntimeError('Cannot resume a corrupt or stale frame: '+name)
                completed.append(metadata);print('FRAME_RESUMED',name,len(completed),flush=True);continue
            scene.render.filepath=str(image);start=time.monotonic();bpy.ops.render.render(write_still=True)
            data=image.read_bytes()
            from PIL import Image
            with Image.open(image) as rendered:
                if rendered.mode!='RGBA' or rendered.size!=(512,512):raise RuntimeError('Frame is not 512² RGBA: '+name)
                alpha_bounds=rendered.getchannel('A').getbbox()
                if not alpha_bounds or min(alpha_bounds[:2])<8 or max(alpha_bounds[2:])>504:raise RuntimeError('Alpha margin failed: '+name+': '+str(alpha_bounds))
            meta={'id':name,'state':state,'direction':direction,'index':i,'fps':fps,'loop':loop,'width':512,'height':512,'origin':[.5,origin],'world_canvas':[128,128],'camera_elevation':45,'orthographic_scale':ortho,'sha256':hashlib.sha256(data).hexdigest(),'seconds':time.monotonic()-start,'alpha_bounds':alpha_bounds,'status':'review-required','source_sha256':source_hash,'script_sha256':script_hash}
            (OUT/(name+'.json')).write_text(json.dumps(meta,indent=2)+'\n');completed.append(meta)
            print('FRAME_COMPLETE',name,len(completed),flush=True)
        bundle=io.BytesIO()
        with tarfile.open(fileobj=bundle,mode='w:gz') as archive:
            for i in indices:
                for suffix in ['.png','.json']:
                    source=OUT/f'{state}-{direction}-{i:02}{suffix}';archive.add(source,arcname=source.name)
        archive_name=f'{state}-{direction}'+('-samples' if args.samples else '')+'.tar.gz'
        temporary=PERSISTENT/(archive_name+'.partial')
        temporary.write_bytes(bundle.getvalue());temporary.replace(PERSISTENT/archive_name)
        (PERSISTENT/'progress.json').write_text(json.dumps({'completed_in_batch':len(completed),'last_state':state,'last_direction':direction,'sample_mode':args.samples,'source_sha256':source_hash,'script_sha256':script_hash},indent=2)+'\n')
        print('DIRECTION_COMPLETE',state,direction,flush=True)
manifest={'source':'sage-motion-source.blend','source_sha256':hashlib.sha256(blend.read_bytes()).hexdigest(),'frames':completed,'status':'review-required','model':'one-deforming-mesh-not-frame-redraws','rig_source_sha256':source_hash,'script_sha256':script_hash,'expected_full_count':416,'sample_mode':args.samples,'review_mode':args.review}
# Separate manifest extension avoids confusing image-pair transfer tools.
(OUT/'motion.manifest').write_text(json.dumps(manifest,indent=2)+'\n')
(PERSISTENT/'motion.manifest').write_bytes((OUT/'motion.manifest').read_bytes())
# Give the editable source a paired metadata+preview for safe exact capability transfer.
first=next(OUT.glob('*.png'));(OUT/'sage-motion-source.png').write_bytes(first.read_bytes())
(OUT/'sage-motion-source.json').write_text(json.dumps({'sha256':hashlib.sha256(first.read_bytes()).hexdigest(),'blend_sha256':manifest['source_sha256'],'status':'editable-source-with-review-preview'},indent=2)+'\n')
for suffix in ['.png','.json']:(PERSISTENT/('sage-motion-source'+suffix)).write_bytes((OUT/('sage-motion-source'+suffix)).read_bytes())
print('MOTION_BATCH_COMPLETE',len(completed),flush=True)
