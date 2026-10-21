"""Painted 2D Sage puppet rig, Blender/CUDA; NOT a 3D reconstruction.
Eight directional painted masters remain the visual source. No per-frame AI redraw,
mirroring, image slicing, recropping, or invented hidden geometry is used.
"""
import argparse, hashlib, io, itertools, json, math, tarfile, time
from pathlib import Path
import bpy
import numpy as np
from PIL import Image
from mathutils import Vector, Quaternion

P=argparse.ArgumentParser()
P.add_argument('--masters',type=Path,required=True)
P.add_argument('--landmarks',type=Path)
P.add_argument('--output',type=Path,default=Path('/opt/ki-legends-gpu/sage-painted-v3-motion-review7'))
P.add_argument('--persistent',type=Path,default=Path('/workspace/ki-legends-gpu/renders/sage-painted-v3-motion-review7'))
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
BOOT_POLYGONS={'down': {'L': [[277, 329], [295, 329], [298, 346], [300, 363], [278, 363], [274, 346]], 'R': [[217, 341], [235, 341], [238, 358], [234, 385], [212, 385], [214, 358]]}, 'down-left': {'L': [[290, 339], [308, 339], [311, 356], [316, 385], [294, 385], [287, 356]], 'R': [[206, 338], [224, 338], [227, 355], [218, 383], [196, 383], [203, 355]]}, 'down-right': {'L': [[274, 324], [292, 324], [295, 341], [298, 359], [276, 359], [271, 341]], 'R': [[219, 342], [237, 342], [240, 359], [236, 385], [214, 385], [216, 359]]}, 'right': {'L': [[251, 316], [269, 316], [272, 333], [272, 343], [250, 343], [248, 333]], 'R': [[233, 340], [251, 340], [254, 357], [263, 385], [241, 385], [230, 357]]}, 'up': {'L': [[211, 342], [229, 342], [232, 359], [231, 384], [209, 384], [208, 359]], 'R': [[281, 343], [299, 343], [302, 360], [303, 385], [281, 385], [278, 360]]}, 'up-left': {'L': [[212, 340], [230, 340], [233, 357], [234, 385], [212, 385], [209, 357]], 'R': [[275, 333], [293, 333], [296, 350], [299, 373], [277, 373], [272, 350]]}, 'up-right': {'L': [[215, 339], [233, 339], [236, 356], [228, 380], [206, 380], [212, 356]], 'R': [[284, 342], [302, 342], [305, 359], [306, 385], [284, 385], [281, 359]]}, 'left': {'L': [[254, 342], [272, 342], [275, 359], [268, 385], [246, 385], [251, 359]], 'R': [[249, 322], [267, 322], [270, 339], [265, 350], [243, 350], [246, 339]]}}
for direction in DIRECTIONS:
    configs[direction].setdefault('boot_polygons',BOOT_POLYGONS[direction])
    configs[direction]['boot_mask_provenance']='Small candidate boot envelopes derived from manually estimated ankle and foot-contact landmarks, requiring visual review.'
save_json(OUT/'landmarks-used.json',configs);save_json(PERSIST/'landmarks-used.json',configs)
source_hashes={d:sha(A.masters/(d+'.png')) for d in DIRECTIONS}
identity=hashlib.sha256(json.dumps({'masters':source_hashes,'configs':configs,'grid':A.grid,'samples':A.samples_per_pixel,'script':sha(__file__)},sort_keys=True).encode()).hexdigest()
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
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='GPU';scene.cycles.samples=A.samples_per_pixel;scene.cycles.use_denoising=False;scene.cycles.seed=0;scene.cycles.use_animated_seed=False
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
    for side in ['L','R']:
        arm.bones['shin.'+side].inherit_scale='NONE'
        arm.bones['foot.'+side].inherit_scale='NONE'
        # Screen-projection changes in thigh/shin length must not resize boots.
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
            neck_y=j['neck'][1];hip_y=max(j['hip.L'][1],j['hip.R'][1])
            if y<neck_y-8:candidates=['head']
            elif y<hip_y+8:candidates=['pelvis','chest','head']
            else:
                boot_sides=[side for side in ['L','R'] if polygon_contains((x,y),config['boot_polygons'][side])]
                if boot_sides:
                    side=min(boot_sides,key=lambda side:math.dist((x,y),j['ankle.'+side]));candidates=['foot.'+side]
                else:candidates=['robe.R','robe.L','pelvis']
            ranked=sorted((segment_distance((x,y),*specs[name]),name) for name in candidates)[:2]
            row={name:1/max(4,dist)**3 for dist,name in ranked};base_total=sum(row.values());row={name:value/base_total for name,value in row.items()}
            # Continuous arm influence, replacing the discontinuous shoulder-X/hip-Y gate.
            # 36px feather exceeds the maximum free-hand displacement; preserve derivatives.
            if y<hip_y+54 and not any(name.startswith('foot.') for name in candidates):
                arms={}
                for side in ['L','R']:
                    names=['upper_arm.'+side,'forearm.'+side,'hand.'+side]
                    distances={name:segment_distance((x,y),*specs[name]) for name in names}
                    strength=math.exp(-(min(distances.values())/36)**2)*smooth((y-min(j['shoulder.L'][1],j['shoulder.R'][1])+18)/34)
                    local={name:1/max(5,dist)**3 for name,dist in distances.items()};denom=sum(local.values())
                    for name,value in local.items():arms[name]=strength*value/denom
                strength=min(.85,sum(arms.values()))
                if strength>1e-8:
                    denominator=sum(arms.values());row={name:value*(1-strength) for name,value in row.items()}
                    for name,value in arms.items():row[name]=row.get(name,0)+strength*value/denominator
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

MOTION_LIMITATIONS={'technique':'bounded painted 2D puppet locomotion','foot_swing_pixels':3,'foot_lift_pixels':1,'pelvis_drop_pixels':0,'death_technique':'rigid planar root fall and reverse','speed_matched_to_engine':False,'footplant_validated':False,'note':'The painted robe cannot reveal new leg surfaces. This safe bounded puppet gait deliberately does not claim biomechanical running or speed-matched foot contact.'}
save_json(OUT/'gait-targets.json',MOTION_LIMITATIONS);atomic(PERSIST/'gait-targets.json',(OUT/'gait-targets.json').read_bytes())
ACTUAL_JOINTS={}


def pose(direction,state,index,count):
    rig=RIGS[direction]
    for b in rig.pose.bones:b.location=(0,0,0);b.rotation_quaternion=(1,0,0,0);b.scale=(1,1,1)
    t=index/count;p=index/max(1,count-1);wave=math.sin(t*math.tau);staff_hand=configs[direction]['staff_hand'];free='R' if staff_hand=='L' else 'L'
    if state=='idle':
        translate(direction,'chest',0,-.7*wave);rotate(direction,'head',.008*wave)
    elif state=='walk':
        vx,vy=VECTORS[direction]
        for side,offset in [('L',0),('R',.5)]:
            phase=(t+offset)%1;swing=math.sin(phase*math.tau)*3;lift=max(0,math.sin(phase*math.tau))*1
            translate(direction,'foot.'+side,vx*swing,vy*swing-lift)
            amp=.006 if side==staff_hand else .025
            rotate(direction,'upper_arm.'+side,amp*math.sin(phase*math.tau))
        translate(direction,'chest',0,-.4*math.cos(t*math.tau*2))
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
        dx,dy=conf['translate_pixels'];translate(direction,'root',dx*fall,dy*fall+conf.get('vertical_arc_pixels',0)*math.sin(math.pi*fall))
        # Root-only painted collapse: internal bends would drag the rigid staff through adjacent robe pixels.
        # This is explicitly a planar rigid fall, not a physically reconstructed lying character.
    wind=0 if state in ['death','respawn'] else wave if state in ['idle','walk'] else math.sin(p*math.pi)
    for side,sign in [('L',1),('R',-1)]:
        rotate(direction,'robe.'+side,sign*.006*wind);rotate(direction,'hair.'+side,sign*.008*wind)
    bpy.context.view_layer.update()


def visible(direction):
    for d,obj in OBJECTS.items():obj.hide_render=d!=direction

FOLDOVERS=[]
def bounds(direction,state,index):
    obj=OBJECTS[direction];graph=bpy.context.evaluated_depsgraph_get();ev=obj.evaluated_get(graph);mesh=ev.to_mesh();xyz=np.empty(len(mesh.vertices)*3);mesh.vertices.foreach_get('co',xyz)
    matrix=np.array(cam.matrix_world.inverted()@ev.matrix_world);p=xyz.reshape((-1,3))@matrix[:3,:3].T+matrix[:3,3]
    triangles=np.array([tuple(poly.vertices) for poly in mesh.polygons],dtype=int);screen=p[triangles,:2]
    area=(screen[:,1,0]-screen[:,0,0])*(screen[:,2,1]-screen[:,0,1])-(screen[:,1,1]-screen[:,0,1])*(screen[:,2,0]-screen[:,0,0])
    # Image-grid triangles have negative signed area in the camera-up plane.
    bad=np.where(area>=-1e-8)[0]
    if len(bad):
        details=[]
        for faceid in bad[:30]:
            ids=triangles[faceid].tolist();details.append({'triangle':int(faceid),'signed_area_pixels':float(area[faceid]/SCALE**2),'vertices':[{'id':vid,'source_pixel':[256+obj.data.vertices[vid].co.dot(X)/SCALE,384-obj.data.vertices[vid].co.dot(V)/SCALE],'posed_pixel':[float(256+p[vid,0]/SCALE),float(256-p[vid,1]/SCALE)],'weights':{obj.vertex_groups[g.group].name:g.weight for g in obj.data.vertices[vid].groups}} for vid in ids]})
        save_json(OUT/'foldover-failure.json',{'direction':direction,'state':state,'index':index,'bad_triangle_count':len(bad),'triangles':bad[:100].tolist(),'details':details})
        FOLDOVERS.append({'direction':direction,'state':state,'index':index,'bad_triangle_count':len(bad),'details':details})
    ev.to_mesh_clear();xx=(.5+p[:,0]/7)*512;yy=(.5-p[:,1]/7)*512
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
save_json(OUT/'gait-actual-joints.json',ACTUAL_JOINTS);atomic(PERSIST/'gait-actual-joints.json',(OUT/'gait-actual-joints.json').read_bytes())
records=[]
for direction in DIRECTIONS:
    for state,(count,fps,loop) in CLIPS.items():
        for i in range(count):
            pose(direction,state,i,count);b=bounds(direction,state,i);records.append({'state':state,'direction':direction,'index':i,'bounds':b})
violations=[r for r in records if min(r['bounds'][:2])<8 or max(r['bounds'][2:])>504]
report={'identity':identity,'bounds':records,'violations':violations,'fixed_camera':True,'expected_count':416,'triangle_foldover_check':'FAIL' if FOLDOVERS else 'PASS','foldovers':FOLDOVERS,'motion_limitations':MOTION_LIMITATIONS}
save_json(OUT/'motion-preflight.report',report);atomic(PERSIST/'motion-preflight.report',(OUT/'motion-preflight.report').read_bytes())
print('GEOMETRY_PREFLIGHT',len(records),'poses;',len(violations),'violations',flush=True)
if FOLDOVERS:raise RuntimeError('Painted triangle foldovers in '+str(len(FOLDOVERS))+' poses; see complete preflight report')
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
manifest={'source':blend.name,'source_sha256':sha(blend),'source_identity':identity,'frames':completed,'expected_full_count':416,'sample_mode':A.samples,'status':'review-required','technique':'painted-2D-deforming-puppet','not_3d_reconstruction':True,'masters':source_hashes,'motion_limitations':MOTION_LIMITATIONS}
save_json(OUT/'motion.manifest',manifest);atomic(PERSIST/'motion.manifest',(OUT/'motion.manifest').read_bytes())
for file in ['rig-build.json','landmarks-used.json','gait-targets.json','gait-actual-joints.json']:atomic(PERSIST/file,(OUT/file).read_bytes())
first=OUT/(completed[0]['id']+'.png');atomic(OUT/'sage-painted-source.png',first.read_bytes());save_json(OUT/'sage-painted-source.json',{'sha256':sha(first),'blend_sha256':sha(blend),'status':'editable-painted-2D-source'})
for suffix in ['.png','.json']:atomic(PERSIST/('sage-painted-source'+suffix),(OUT/('sage-painted-source'+suffix)).read_bytes())
print('MOTION_BATCH_COMPLETE',len(completed),flush=True)
