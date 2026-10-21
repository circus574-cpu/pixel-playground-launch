"""Painted 2D Sage puppet rig, Blender/CUDA; NOT a 3D reconstruction.
Eight directional painted masters remain the visual source. No per-frame AI redraw,
mirroring, image slicing, recropping, or invented hidden geometry is used.
"""
import argparse, hashlib, io, json, math, tarfile, time
from pathlib import Path
import bpy
import numpy as np
from PIL import Image
from mathutils import Vector, Quaternion

P=argparse.ArgumentParser()
P.add_argument('--masters',type=Path,required=True)
P.add_argument('--landmarks',type=Path)
P.add_argument('--output',type=Path,default=Path('/opt/ki-legends-gpu/sage-painted-v3-motion'))
P.add_argument('--persistent',type=Path,default=Path('/workspace/ki-legends-gpu/renders/sage-painted-v3-motion'))
P.add_argument('--samples',action='store_true')
P.add_argument('--calibration',action='store_true',help='Eight neutral rest-match renders only; not production frames')
P.add_argument('--validate-only',action='store_true')
P.add_argument('--review-approved',action='store_true')
P.add_argument('--grid',type=int,default=8)
P.add_argument('--samples-per-pixel',type=int,default=16)
A=P.parse_args()
if not (A.samples or A.calibration or A.validate_only or A.review_approved):P.error('Render --samples, visually inspect them, then use --review-approved')
DIRECTIONS=['down','down-left','left','up-left','up','up-right','right','down-right']
VECTORS={'down':(0,1),'down-left':(-.707,.707),'left':(-1,0),'up-left':(-.707,-.707),'up':(0,-1),'up-right':(.707,-.707),'right':(1,0),'down-right':(.707,.707)}
CLIPS={'idle':(8,6,True),'walk':(8,16,True),'attack':(8,16,False),'skill':(8,12,False),'hit':(4,16,False),'death':(8,10,False),'respawn':(8,12,False)}
OUT=A.output;PERSIST=A.persistent;OUT.mkdir(parents=True,exist_ok=True);PERSIST.mkdir(parents=True,exist_ok=True)
SCALE=7/512;X=Vector((1,0,0));V=Vector((0,math.sqrt(.5),math.sqrt(.5)));N=X.cross(V)
def world(pixel):return X*((pixel[0]-256)*SCALE)+V*((384-pixel[1])*SCALE)
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def save_json(path,value):Path(path).write_text(json.dumps(value,indent=2)+'\n')
def atomic(path,data):
    part=Path(str(path)+'.partial');part.write_bytes(data);part.replace(path)
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def polygon_contains(point,polygon):
    x,y=point;inside=False
    for i,a in enumerate(polygon):
        b=polygon[i-1]
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
    return inside

def default_config(direction):
    # Coordinates are editable landmarks, not inferred anatomical ground truth.
    # Left/right are IMAGE sides; per-direction JSON must identify the actual staff hand.
    return {'joints':{'root':[256,384],'pelvis':[256,271],'chest':[256,200],'neck':[256,164],'head':[256,116],
      'shoulder.R':[227,192],'elbow.R':[209,237],'hand.R':[202,273],
      'shoulder.L':[285,192],'elbow.L':[313,226],'hand.L':[331,250],
      'hip.R':[242,278],'knee.R':[237,332],'ankle.R':[230,380],
      'hip.L':[270,278],'knee.L':[276,332],'ankle.L':[282,380],
      'robe.R':[224,289],'robe-end.R':[203,367],'robe.L':[289,289],'robe-end.L':[315,367],
      'hair.R':[240,143],'hair-end.R':[211,249],'hair.L':[273,143],'hair-end.L':[298,249],
      'staff-tip':[349,87]},'staff_hand':'L','masks':[],
      'death':{'angle_degrees':-78,'translate_pixels':[-92,-25]},
      'comment':'Adjust landmarks/masks to actual normalized painted master; masks [{bone,polygon,weight}] use pixel coordinates.'}
CONFIG=json.loads(A.landmarks.read_text()) if A.landmarks else {}
if 'directions' in CONFIG:
    converted={}
    for direction,c in CONFIG['directions'].items():
        dx,dy=c.get('translation_to_anchor_256_384',[0,0])
        def shifted(point):return [point[0]+dx,point[1]+dy]
        joints={'root':[256,384],'pelvis':shifted(c['belt']),'chest':shifted([(c['belt'][0]+c['neck'][0])/2,(c['belt'][1]+c['neck'][1])/2]),'neck':shifted(c['neck']),'head':shifted(c['head']),'staff-tip':shifted(c['staff_tip'])}
        for side in ['L','R']:
            for singular,plural in [('shoulder','shoulders'),('elbow','elbows'),('hand','hands'),('hip','hips'),('knee','knees'),('ankle','ankles')]:joints[singular+'.'+side]=shifted(c[plural][side])
            hip=joints['hip.'+side];foot=shifted(c['feet'][side]);neck=joints['neck'];shoulder=joints['shoulder.'+side]
            joints['robe.'+side]=[hip[0],hip[1]+12];joints['robe-end.'+side]=[foot[0],foot[1]-14]
            joints['hair.'+side]=[(neck[0]+shoulder[0])/2,neck[1]+12];joints['hair-end.'+side]=[shoulder[0],joints['hand.'+side][1]+12]
        converted[direction]={'joints':joints,'staff_hand':c.get('anatomical_staff_hand','L'),'masks':[{'bone':'staff','polygon':[shifted(q) for q in c['staff_polygon']]}], 'landmark_provenance':CONFIG.get('status'),'staff_mask_caveat':c.get('staff_mask_caveat'),'gait':{'speed_world_per_second':205,'source_pixels_per_world_unit':4,'stance_fraction':.30,'swing_lift_pixels':35}}
    CONFIG=converted
configs={d:{**default_config(d),**CONFIG.get(d,{})} for d in DIRECTIONS}
for d in DIRECTIONS:
    configs[d]['joints']={**default_config(d)['joints'],**CONFIG.get(d,{}).get('joints',{})}
save_json(OUT/'landmarks-used.json',configs);save_json(PERSIST/'landmarks-used.json',configs)
source_hashes={d:sha(A.masters/(d+'.png')) for d in DIRECTIONS}
identity=hashlib.sha256(json.dumps({'masters':source_hashes,'configs':configs,'grid':A.grid,'script':sha(__file__)},sort_keys=True).encode()).hexdigest()
# Preserve old attempts; refusing mixed-source resume is intentional.
marker=OUT/'source-identity.json'
if marker.exists() and json.loads(marker.read_text())['identity']!=identity:raise RuntimeError('Output belongs to a different source/config; use a new versioned output path')
save_json(marker,{'identity':identity,'masters':source_hashes});atomic(PERSIST/marker.name,marker.read_bytes())
for arc in PERSIST.glob('*.tar.gz'):
    with tarfile.open(arc,'r:gz') as tf:
        for m in tf.getmembers():
            if not m.isfile() or Path(m.name).name!=m.name or not m.name.endswith(('.png','.json')):raise RuntimeError('Unsafe checkpoint member')
            target=OUT/m.name
            if not target.exists():target.write_bytes(tf.extractfile(m).read())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='GPU';scene.cycles.samples=A.samples_per_pixel;scene.cycles.use_denoising=False
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
for dev in prefs.devices:dev.use=dev.type=='CUDA'
scene.render.resolution_x=scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.render.use_persistent_data=True
camera_target=V*(128*SCALE)
bpy.ops.object.camera_add(location=camera_target+N*10);cam=bpy.context.object;cam.rotation_euler=(camera_target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=7;scene.camera=cam
RIGS={};OBJECTS={};REST={};GEOMETRY={}

def segment_distance(point,a,b):
    p=np.array(point,dtype=float);a=np.array(a,dtype=float);b=np.array(b,dtype=float);delta=b-a
    t=max(0,min(1,float(np.dot(p-a,delta)/max(.0001,np.dot(delta,delta)))))
    return float(np.linalg.norm(p-(a+t*delta)))

def build(direction):
    config=configs[direction];j=config['joints'];staff_hand=config['staff_hand']
    imagepath=A.masters/(direction+'.png');im=Image.open(imagepath)
    if im.mode!='RGBA' or im.size!=(512,512):raise RuntimeError('Master must be normalized 512 RGBA: '+direction)
    alpha=np.asarray(im.getchannel('A'));box=im.getchannel('A').getbbox()
    if not box or min(box[:2])<8 or max(box[2:])>504:raise RuntimeError('Master alpha margins fail: '+direction+str(box))
    arm=bpy.data.armatures.new('Sage painted '+direction);rig=bpy.data.objects.new('sage-painted-rig-'+direction,arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    specs={}
    def bone(name,a,b,parent=None):
        a=j[a] if isinstance(a,str) else a;b=j[b] if isinstance(b,str) else b
        eb=arm.edit_bones.new(name);eb.head=world(a);eb.tail=world(b)
        if (eb.tail-eb.head).length<.001:eb.tail+=V*.01
        eb.align_roll(N)
        if parent:eb.parent=arm.edit_bones[parent]
        specs[name]=(a,b)
    bone('root','root',[256,350]);bone('pelvis','pelvis','chest','root');bone('chest','chest','neck','pelvis');bone('head','neck','head','chest')
    for side in ['L','R']:
        bone('upper_arm.'+side,'shoulder.'+side,'elbow.'+side,'chest');bone('forearm.'+side,'elbow.'+side,'hand.'+side,'upper_arm.'+side)
        h=j['hand.'+side];bone('hand.'+side,h,[h[0],h[1]+12],'forearm.'+side)
        bone('thigh.'+side,'hip.'+side,'knee.'+side,'pelvis');bone('shin.'+side,'knee.'+side,'ankle.'+side,'thigh.'+side)
        a=j['ankle.'+side];bone('foot.'+side,a,[a[0],a[1]+8],'shin.'+side)
        bone('robe.'+side,'robe.'+side,'robe-end.'+side,'pelvis');bone('hair.'+side,'hair.'+side,'hair-end.'+side,'head')
    bone('staff','hand.'+staff_hand,'staff-tip','hand.'+staff_hand)
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
    for b in rig.pose.bones:b.rotation_mode='QUATERNION'
    vertices=[];uv=[];faces=[];lookup={}
    def vertex(x,y):
        key=x,y
        if key not in lookup:lookup[key]=len(vertices);vertices.append(world(key));uv.append((x/512,1-y/512))
        return lookup[key]
    grid=A.grid
    for y in range(0,512,grid):
        for x in range(0,512,grid):
            y2=min(512,y+grid);x2=min(512,x+grid)
            if not alpha[y:y2,x:x2].any():continue
            a,b,c,d=vertex(x,y),vertex(x2,y),vertex(x2,y2),vertex(x,y2)
            faces.extend([(a,b,c),(a,c,d)])
    mesh=bpy.data.meshes.new('Alpha occupied painted grid '+direction);mesh.from_pydata(vertices,[],faces);mesh.update()
    layer=mesh.uv_layers.new(name='Exact master UV')
    for poly in mesh.polygons:
        for loopid in poly.loop_indices:layer.data[loopid].uv=uv[mesh.loops[loopid].vertex_index]
    obj=bpy.data.objects.new('Painted sage mesh '+direction,mesh);bpy.context.collection.objects.link(obj)
    mat=bpy.data.materials.new('Painted source emission '+direction);mat.use_nodes=True;n=mat.node_tree.nodes;n.clear();links=mat.node_tree.links
    out=n.new('ShaderNodeOutputMaterial');mix=n.new('ShaderNodeMixShader');trans=n.new('ShaderNodeBsdfTransparent');em=n.new('ShaderNodeEmission');tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(imagepath));tex.image.pack();tex.interpolation='Linear';tex.extension='CLIP'
    links.new(tex.outputs['Color'],em.inputs['Color']);links.new(tex.outputs['Alpha'],mix.inputs[0]);links.new(trans.outputs[0],mix.inputs[1]);links.new(em.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],out.inputs['Surface']);obj.data.materials.append(mat)
    groups={name:obj.vertex_groups.new(name=name) for name in specs}
    for (x,y),index in lookup.items():
        row=None
        for mask in config.get('masks',[]):
            if polygon_contains((x,y),mask['polygon']):
                row={mask['bone']:float(mask.get('weight',1))};break
        if row is None:
            candidates=['pelvis','chest','head']
            left_side=min(['L','R'],key=lambda side:j['shoulder.'+side][0]);right_side='R' if left_side=='L' else 'L'
            belt_y=j['pelvis'][1];hip_y=max(j['hip.L'][1],j['hip.R'][1]);neck_y=j['neck'][1]
            if y<neck_y-8:candidates=['head']
            elif y<hip_y+8:
                side=left_side if x<j['shoulder.'+left_side][0]-5 else right_side if x>j['shoulder.'+right_side][0]+5 else None
                if side:
                    candidates=['upper_arm.'+side,'forearm.'+side,'hand.'+side,'hair.'+side]
                    if side==staff_hand:candidates.append('staff')
            else:
                close_boot=[side for side in ['L','R'] if y>j['ankle.'+side][1]-12 and abs(x-j['ankle.'+side][0])<19]
                if close_boot:
                    side=min(close_boot,key=lambda q:abs(x-j['ankle.'+q][0]));candidates=['shin.'+side,'foot.'+side]
                else:candidates=['robe.R','robe.L','thigh.R','thigh.L']
            ranked=sorted((segment_distance((x,y),*specs[name]),name) for name in candidates)[:2]
            row={name:1/max(4,dist)**3 for dist,name in ranked}
        total=sum(row.values())
        if total<=0:raise RuntimeError('Invalid zero mask weight')
        for name,weight in row.items():groups[name].add([index],weight/total,'REPLACE')
    obj.parent=rig;mod=obj.modifiers.new('Painted puppet deformation','ARMATURE');mod.object=rig
    RIGS[direction]=rig;OBJECTS[direction]=obj;REST[direction]={b.name:b.matrix_local.to_quaternion() for b in rig.data.bones};GEOMETRY[direction]=specs
    return {'vertices':len(vertices),'triangles':len(faces),'alpha_bounds':box,'master_sha256':source_hashes[direction]}
info={direction:build(direction) for direction in DIRECTIONS}
save_json(OUT/'rig-build.json',{'identity':identity,'technique':'painted-2D-deforming-puppet','directions':info})


def rotate(direction,name,angle):
    b=RIGS[direction].pose.bones[name];rest=REST[direction][name];b.rotation_quaternion=rest.inverted()@Quaternion(N,angle)@rest

def translate(direction,name,dx,dy):
    # Pixel deltas: positive Y is down, same as landmark JSON.
    rest=REST[direction][name];RIGS[direction].pose.bones[name].location=rest.inverted()@(X*(dx*SCALE)-V*(dy*SCALE))

def gait_target(direction,index,side):
    g=configs[direction].get('gait',{});count,fps,_=CLIPS['walk'];cycle=count/fps;duty=g.get('stance_fraction',.30)
    velocity=g.get('speed_world_per_second',205)*g.get('source_pixels_per_world_unit',4)
    stroke=velocity*cycle*duty;phase=(index/count+(0 if side=='L' else .5))%1
    if phase<duty:step=stroke*.5-velocity*cycle*phase;lift=0
    else:
        swing=(phase-duty)/(1-duty);step=-stroke*.5+stroke*swing
        lift=g.get('swing_lift_pixels',35)*math.sin(math.pi*swing)
    vx,vy=VECTORS[direction]
    return vx*step,vy*step-lift,phase<duty

GAIT={}
for direction in DIRECTIONS:
    j=configs[direction]['joints'];required=0;targets=[]
    for i in range(CLIPS['walk'][0]):
        for side in ['L','R']:
            dx,dy,contact=gait_target(direction,i,side);h=np.array(j['hip.'+side],float);k=np.array(j['knee.'+side],float);a=np.array(j['ankle.'+side],float)
            length=float(np.linalg.norm(k-h)+np.linalg.norm(a-k));xx=a[0]+dx-h[0];yy=a[1]+dy-h[1]
            if abs(xx)>=length:raise RuntimeError('Stride cannot fit painted limb lengths in '+direction+' '+side)
            required=max(required,yy-math.sqrt(max(.001,length*length-xx*xx)))
            targets.append({'index':i,'side':side,'dx':dx,'dy':dy,'stance':contact,'limb_length':length})
    for target in targets:
        side=target['side'];index=target['index'];drop=required+1.0+1.5*(1-math.cos(index/8*math.tau*2))
        h=np.array(j['hip.'+side],float)+[0,drop];a=np.array(j['ankle.'+side],float)+[target['dx'],target['dy']]
        reach=float(np.linalg.norm(a-h));target['required_distance']=reach;target['reach_excess_pixels']=max(0,reach-target['limb_length']);target['pelvis_drop_pixels']=drop
    GAIT[direction]={'pelvis_drop_pixels':required+1.0,'max_reach_excess_pixels':max(t['reach_excess_pixels'] for t in targets),'stance_source_pixels_per_second':configs[direction].get('gait',{}).get('speed_world_per_second',205)*configs[direction].get('gait',{}).get('source_pixels_per_world_unit',4),'targets':targets,'note':'Exact source-space stance speed; large body drop is a known limitation of single-plane painted limbs and requires visual review.'}
save_json(OUT/'gait-targets.json',GAIT);atomic(PERSIST/'gait-targets.json',(OUT/'gait-targets.json').read_bytes())

def leg(direction,side,dx,dy,pelvis_drop=0):
    j=configs[direction]['joints'];original_hip=np.array(j['hip.'+side],float);h=original_hip+np.array([0,pelvis_drop]);k=np.array(j['knee.'+side],float);a=np.array(j['ankle.'+side],float)
    target=a+np.array([dx,dy]);u=k-original_hip;v=a-k;l1=float(np.linalg.norm(u));l2=float(np.linalg.norm(v));delta=target-h
    actual=float(np.linalg.norm(delta));length=min(actual,l1+l2-.001)
    if actual>l1+l2+.05:raise RuntimeError('Unreachable gait target '+direction+' '+side+' '+str(actual-(l1+l2)))
    gamma=math.atan2(-delta[1],delta[0]);alpha=math.acos(max(-1,min(1,(l1*l1+length*length-l2*l2)/(2*l1*length))))
    cross=u[0]*v[1]-u[1]*v[0];bend=1 if cross>=0 else -1
    first=gamma+bend*alpha;knee=h+np.array([math.cos(first),-math.sin(first)])*l1
    second=math.atan2(-(target-knee)[1],(target-knee)[0]);rest1=math.atan2(-u[1],u[0]);rest2=math.atan2(-v[1],v[0]);d1=first-rest1;d2=(second-first)-(rest2-rest1)
    rotate(direction,'thigh.'+side,d1);rotate(direction,'shin.'+side,d2);rotate(direction,'foot.'+side,-d1-d2)

def pose(direction,state,index,count):
    rig=RIGS[direction]
    for b in rig.pose.bones:b.location=(0,0,0);b.rotation_quaternion=(1,0,0,0);b.scale=(1,1,1)
    t=index/count;p=index/max(1,count-1);wave=math.sin(t*math.tau);staff_hand=configs[direction]['staff_hand'];free='R' if staff_hand=='L' else 'L'
    if state=='idle':
        translate(direction,'chest',0,-.7*wave);rotate(direction,'head',.008*wave)
    elif state=='walk':
        drop=GAIT[direction]['pelvis_drop_pixels']+1.5*(1-math.cos(t*math.tau*2))
        translate(direction,'pelvis',0,drop)
        for side,offset in [('L',0),('R',.5)]:
            dx,dy,stance=gait_target(direction,index,side);leg(direction,side,dx,dy,drop)
            phase=(t+offset)%1;amp=.02 if side==staff_hand else .12
            rotate(direction,'upper_arm.'+side,amp*math.sin(phase*math.tau))
            # Keep long cloth hems from dragging simply because the pelvis lowered.
            bone=RIGS[direction].pose.bones['robe.'+side];a,b=GEOMETRY[direction]['robe.'+side];length=math.dist(a,b)
            bone.scale.y=max(.35,(length-drop)/max(1,length))
        translate(direction,'chest',0,-1.0*math.cos(t*math.tau*2))
    elif state=='attack':
        strength=math.sin(math.pi*p)**1.25
        rotate(direction,'upper_arm.'+free,-.20*strength);rotate(direction,'forearm.'+free,.22*strength);rotate(direction,'hand.'+free,-.12*strength)
        translate(direction,'chest',0,-.6*strength)
    elif state=='skill':
        gather=math.sin(math.pi*p)**.8;release=max(0,math.sin((p-.3)/.7*math.pi)) if p>.3 else 0
        rotate(direction,'upper_arm.'+free,.23*gather);rotate(direction,'forearm.'+free,-.32*gather+.18*release);rotate(direction,'hand.'+free,.18*gather)
        rotate(direction,'upper_arm.'+staff_hand,.025*gather);rotate(direction,'staff',-.02*gather);translate(direction,'chest',0,-1.6*gather)
    elif state=='hit':
        strength=math.sin((p*.8+.2)*math.pi)*(1-p);rotate(direction,'chest',.055*strength);rotate(direction,'head',-.07*strength);translate(direction,'pelvis',-2*strength,0)
    elif state in ['death','respawn']:
        amount=smooth(p) if state=='death' else 1-smooth(p);fall=smooth((amount-.2)/.8);conf=configs[direction]['death']
        rotate(direction,'root',math.radians(conf['angle_degrees'])*fall)
        dx,dy=conf['translate_pixels'];translate(direction,'root',dx*fall,dy*fall)
        rotate(direction,'chest',-.10*amount);rotate(direction,'head',-.08*amount);rotate(direction,'forearm.'+free,.18*amount)
    wind=wave if state in ['idle','walk'] else math.sin(p*math.pi)
    for side,sign in [('L',1),('R',-1)]:
        rotate(direction,'robe.'+side,sign*.018*wind);rotate(direction,'hair.'+side,sign*.012*wind)
    bpy.context.view_layer.update()

def visible(direction):
    for d,obj in OBJECTS.items():obj.hide_render=d!=direction

def bounds(direction):
    obj=OBJECTS[direction];graph=bpy.context.evaluated_depsgraph_get();ev=obj.evaluated_get(graph);mesh=ev.to_mesh();xyz=np.empty(len(mesh.vertices)*3);mesh.vertices.foreach_get('co',xyz)
    matrix=np.array(cam.matrix_world.inverted()@ev.matrix_world);p=xyz.reshape((-1,3))@matrix[:3,:3].T+matrix[:3,3];ev.to_mesh_clear();xx=(.5+p[:,0]/7)*512;yy=(.5-p[:,1]/7)*512
    return [float(xx.min()),float(yy.min()),float(xx.max()),float(yy.max())]
# Editable actions for each directional painted rig, authored from the same pose evaluator.
for direction,rig in RIGS.items():
    rig.animation_data_create()
    for state,(count,fps,loop) in CLIPS.items():
        action=bpy.data.actions.new('sage-painted/'+direction+'/'+state);action.use_fake_user=True;rig.animation_data.action=action
        for i in range(count):
            pose(direction,state,i,count)
            for b in rig.pose.bones:
                for field in ['rotation_quaternion','location','scale']:b.keyframe_insert(data_path=field,frame=i+1,group=b.name)
        action['fps']=fps;action['loop']=loop
    rig.animation_data.action=None
    pose(direction,'idle',0,8)
visible('down')
blend=OUT/'sage-painted-source.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend));atomic(PERSIST/blend.name,blend.read_bytes())
if A.calibration:
    calibration=[];folder=OUT/'calibration';folder.mkdir(exist_ok=True)
    for direction in DIRECTIONS:
        visible(direction);pose(direction,'idle',0,8);target=folder/(direction+'.png');scene.render.filepath=str(target);bpy.ops.render.render(write_still=True)
        master=np.asarray(Image.open(A.masters/(direction+'.png')).convert('RGBA'),dtype=np.float64);rendered=np.asarray(Image.open(target).convert('RGBA'),dtype=np.float64);opaque=(master[:,:,3]>250)&(rendered[:,:,3]>250)
        mae=float(np.abs(master[:,:,:3][opaque]-rendered[:,:,:3][opaque]).mean()) if opaque.any() else None
        calibration.append({'direction':direction,'opaque_rgb_mean_absolute_error':mae,'sha256':sha(target),'pixels_compared':int(opaque.sum())})
        print('REST_MATCH',direction,mae,flush=True)
    save_json(OUT/'rest-match.json',calibration);atomic(PERSIST/'rest-match.json',(OUT/'rest-match.json').read_bytes());raise SystemExit(0)
records=[]
for direction in DIRECTIONS:
    for state,(count,fps,loop) in CLIPS.items():
        for i in range(count):
            pose(direction,state,i,count);b=bounds(direction);records.append({'state':state,'direction':direction,'index':i,'bounds':b})
violations=[r for r in records if min(r['bounds'][:2])<8 or max(r['bounds'][2:])>504]
report={'identity':identity,'bounds':records,'violations':violations,'fixed_camera':True,'expected_count':416}
save_json(OUT/'motion-preflight.report',report);atomic(PERSIST/'motion-preflight.report',(OUT/'motion-preflight.report').read_bytes())
print('GEOMETRY_PREFLIGHT',len(records),'poses;',len(violations),'violations',flush=True)
if violations:raise RuntimeError('Fixed painted rig exceeds8px margin: '+json.dumps(violations[:8]))
if A.validate_only:raise SystemExit(0)
completed=[]
for direction in DIRECTIONS:
    if A.samples and direction not in ['down','right']:continue
    visible(direction)
    for state,(count,fps,loop) in CLIPS.items():
        indices=sorted({0,count//2,count-1}) if A.samples else range(count)
        for i in indices:
            pose(direction,state,i,count);name=f'{state}-{direction}-{i:02}';image=OUT/(name+'.png');meta_path=OUT/(name+'.json')
            if image.exists() and meta_path.exists():
                meta=json.loads(meta_path.read_text())
                if meta.get('source_identity')!=identity or sha(image)!=meta['sha256']:raise RuntimeError('Stale/corrupt resume '+name)
                completed.append(meta);print('FRAME_RESUMED',name,len(completed),flush=True);continue
            scene.render.filepath=str(image);start=time.monotonic();bpy.ops.render.render(write_still=True)
            with Image.open(image) as frame:
                alpha_box=frame.getchannel('A').getbbox()
                if frame.mode!='RGBA' or frame.size!=(512,512) or not alpha_box or min(alpha_box[:2])<8 or max(alpha_box[2:])>504:raise RuntimeError('Actual RGBA/margin validation failed '+name+' '+str(alpha_box))
            meta={'id':name,'state':state,'direction':direction,'index':i,'fps':fps,'loop':loop,'width':512,'height':512,'origin':[.5,.75],'world_canvas':[128,128],'camera_elevation':45,'orthographic_scale':7,'alpha_bounds':alpha_box,'sha256':sha(image),'source_identity':identity,'seconds':time.monotonic()-start,'status':'review-required','technique':'painted-2D-deforming-puppet'}
            save_json(meta_path,meta);completed.append(meta);print('FRAME_COMPLETE',name,len(completed),flush=True)
        buffer=io.BytesIO()
        with tarfile.open(fileobj=buffer,mode='w:gz') as tf:
            for i in indices:
                for suffix in ['.png','.json']:
                    file=OUT/f'{state}-{direction}-{i:02}{suffix}';tf.add(file,arcname=file.name)
        archive=f'{state}-{direction}'+('-samples' if A.samples else '')+'.tar.gz';atomic(PERSIST/archive,buffer.getvalue())
        progress={'source_identity':identity,'completed_in_batch':len(completed),'sample_mode':A.samples,'last_state':state,'last_direction':direction};save_json(PERSIST/'progress.json',progress)
        print('DIRECTION_COMPLETE',state,direction,flush=True)
manifest={'source':blend.name,'source_sha256':sha(blend),'source_identity':identity,'frames':completed,'expected_full_count':416,'sample_mode':A.samples,'status':'review-required','technique':'painted-2D-deforming-puppet','not_3d_reconstruction':True,'masters':source_hashes}
save_json(OUT/'motion.manifest',manifest);atomic(PERSIST/'motion.manifest',(OUT/'motion.manifest').read_bytes())
for file in ['rig-build.json','landmarks-used.json']:atomic(PERSIST/file,(OUT/file).read_bytes())
first=OUT/(completed[0]['id']+'.png');atomic(OUT/'sage-painted-source.png',first.read_bytes());save_json(OUT/'sage-painted-source.json',{'sha256':sha(first),'blend_sha256':sha(blend),'status':'editable-painted-2D-source'})
for suffix in ['.png','.json']:atomic(PERSIST/('sage-painted-source'+suffix),(OUT/('sage-painted-source'+suffix)).read_bytes())
print('MOTION_BATCH_COMPLETE',len(completed),flush=True)
