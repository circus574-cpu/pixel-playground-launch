"""Aetheria sage: one deforming mesh, original costume and editable animation rig.
CC0 anatomical source; no sliced illustration frames or per-frame AI redraws.
"""
import bpy,math,json,hashlib,time,random
from pathlib import Path
from mathutils import Vector,Quaternion
ROOT=Path('/workspace/ki-legends-gpu');BASE=ROOT/'source/planetary-rig-base';OUT=ROOT/'renders/sage-rig-review-v1';OUT.mkdir(parents=True,exist_ok=True);LOCAL=Path('/opt/ki-legends-gpu/sage-rig-v1');LOCAL.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
vertices=[];faces=[];group=''
for line in (BASE/'base.obj').read_text().splitlines():
 p=line.split()
 if not p:continue
 if p[0]=='v':vertices.append(Vector(tuple(map(float,p[1:4]))))
 elif p[0]=='g':group=p[1]
 elif p[0]=='f' and group=='body':faces.append([int(v.split('/')[0])-1 for v in p[1:]])
for name,weight in [('caucasian-male-young.target',.55),('asian-male-young.target',.45),('universal-male-young-maxmuscle-averageweight.target',.8)]:
 for line in (BASE/name).read_text().splitlines():
  if not line or line.startswith('#'):continue
  p=line.split();vertices[int(p[0])]+=Vector(tuple(map(float,p[1:4])))*weight
# A modest anime head proportion; no change of identity between frames.
for v in vertices:
 if v.y>6.25:
  v.x*=1.08;v.y=6.25+(v.y-6.25)*1.10
used={i for f in faces for i in f};floor=min(vertices[i].y for i in used);top=max(vertices[i].y for i in used);scale=5.6/(top-floor)
vs=[Vector((v.x*scale,-v.z*scale,(v.y-floor)*scale)) for v in vertices]
r=json.loads((BASE/'default.mhskel').read_text());weights=json.loads((BASE/'default_weights.mhw').read_text())['weights']
def joint(key):return sum((vs[i] for i in r['joints'][key]),Vector())/len(r['joints'][key])
def source_point(bone,part):return joint(r['bones'][bone][part])
def map_bone(name):
 side='.'+name.rsplit('.',1)[-1] if name.endswith(('.L','.R')) else ''
 if name.startswith('upperleg'):return 'thigh'+side
 if name.startswith('lowerleg'):return 'shin'+side
 if name.startswith(('foot','toe')):return 'foot'+side
 if name.startswith('upperarm'):return 'upper_arm'+side
 if name.startswith('lowerarm'):return 'forearm'+side
 if name.startswith(('wrist','metacarpal')):return 'hand'+side
 if name.startswith('finger'):return name
 if name.startswith(('pelvis','root')):return 'pelvis'
 if name in ['spine05','spine04','spine03']:return 'spine'
 if name.startswith(('spine','breast','clavicle','shoulder','scapula')):return 'chest'
 if name.startswith('neck'):return 'neck'
 return 'head'
bodyweights=[{} for _ in vs]
for original,values in weights.items():
 key=map_bone(original)
 for i,w in values:
  if i<len(vs):bodyweights[i][key]=bodyweights[i].get(key,0)+w
for row in bodyweights:
 total=sum(row.values())
 if total:
  for k in row:row[k]/=total
 else:row['pelvis']=1
arm=bpy.data.armatures.new('Aetheria sage approved identity rig');rig=bpy.data.objects.new('hero-sage',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
BONES={}
def bone(name,head,tail,parent=None):
 b=arm.edit_bones.new(name);b.head=head;b.tail=tail
 if (Vector(tail)-Vector(head)).length<.001:b.tail.z+=.05
 if parent:b.parent=arm.edit_bones[parent]
 b.align_roll(Vector((0,-1,0)));BONES[name]=(Vector(head),Vector(tail));return b
pelvis=(source_point('upperleg01.L','head')+source_point('upperleg01.R','head'))/2
bone('pelvis',pelvis,pelvis+Vector((0,0,.25)))
bone('spine',pelvis,source_point('spine02','head'),'pelvis');bone('chest',source_point('spine02','head'),source_point('neck01','head'),'spine');bone('neck',source_point('neck01','head'),source_point('head','head'),'chest');bone('head',source_point('head','head'),source_point('head','tail'),'neck')
for side in ['L','R']:
 s='.'+side
 bone('thigh'+s,source_point('upperleg01'+s,'head'),source_point('lowerleg01'+s,'head'),'pelvis');bone('shin'+s,source_point('lowerleg01'+s,'head'),source_point('foot'+s,'head'),'thigh'+s);bone('foot'+s,source_point('foot'+s,'head'),source_point('foot'+s,'tail'),'shin'+s)
 bone('upper_arm'+s,source_point('upperarm01'+s,'head'),source_point('lowerarm01'+s,'head'),'chest');bone('forearm'+s,source_point('lowerarm01'+s,'head'),source_point('wrist'+s,'head'),'upper_arm'+s);bone('hand'+s,source_point('wrist'+s,'head'),source_point('wrist'+s,'tail'),'forearm'+s)
 for finger in range(1,6):
  for seg in range(1,4):
   name=f'finger{finger}-{seg}'+s
   if name in r['bones']:bone(name,source_point(name,'head'),source_point(name,'tail'),f'finger{finger}-{seg-1}'+s if seg>1 else 'hand'+s)
bpy.ops.object.mode_set(mode='OBJECT')
def material(name,color,metal=False):
 srgb=tuple(int(color[i:i+2],16)/255 for i in (0,2,4));c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in srgb);m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*c,1);n=m.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');toon=n.new('ShaderNodeBsdfToon');toon.inputs['Color'].default_value=(*c,1);toon.inputs['Size'].default_value=.7;toon.inputs['Smooth'].default_value=.12;m.node_tree.links.new(toon.outputs[0],out.inputs[0]);return m
skin=material('Warm pale skin','d5b394');white=material('Ivory ritual fabric','efe4c7');pants=material('Charcoal under robe','242c2a');steel=material('Blackened steel','343235');bronze=material('Polished antique gold','d4ab50');leather=material('Leather belts','563723');orange=material('Emerald ritual silk','165b50');hairmat=material('Ivory hair','ded4b8');hairlight=material('Pale hair highlights','f0e5cc');eye_white=material('Eye white','dfdbcb');iris=material('Amber iris','bc913a');ink=material('Ink and pupil','11151b')
# Clothing is an opaque, fitted mesh, not a recoloured uncovered base.
positions=[v.copy() for v in vs]
for i,v in enumerate(positions):
 z=v.z;dominant=max(bodyweights[i],key=bodyweights[i].get)
 if dominant.startswith(('thigh','shin')) and 1.15<z<3.1:
  s=1 if v.x>=0 else -1;center=s*(.52+.06*(3-z));v.x=center+(v.x-center)*1.22;v.y*=1.18
# Closed gauntlets/boots replace finger/toe surfaces so no anatomical tips protrude.
faces=[f for f in faces if not any(max(bodyweights[i],key=bodyweights[i].get).startswith(('finger','foot')) for i in f)]
mesh=bpy.data.meshes.new('Fully clothed deforming humanoid');mesh.from_pydata(positions,[],faces);mesh.update();body=bpy.data.objects.new('Aetheria sage body and fitted costume',mesh);bpy.context.collection.objects.link(body)
for m in [skin,white,pants,steel,leather]:mesh.materials.append(m)
for poly in mesh.polygons:
 ids=list(poly.vertices);dominant=max((k for i in ids for k in bodyweights[i]),key=lambda k:sum(bodyweights[i].get(k,0) for i in ids));z=sum(positions[i].z for i in ids)/len(ids)
 poly.material_index=3 if dominant.startswith(('forearm',)) or z<1.18 else 2 if dominant.startswith(('thigh','shin','foot','pelvis')) or z<3.12 else 1 if dominant in ['spine','chest'] else 0;poly.use_smooth=True
for key in BONES:
 vg=body.vertex_groups.new(name=key)
 for i,row in enumerate(bodyweights):
  if row.get(key,0)>.0001:vg.add([i],row[key],'REPLACE')
body.parent=rig;mod=body.modifiers.new('Shared skeletal deformation','ARMATURE');mod.object=rig;sub=body.modifiers.new('Smooth anatomical silhouette','SUBSURF');sub.levels=1;sub.render_levels=1

def bind(obj,key):
 vg=obj.vertex_groups.new(name=key);vg.add(list(range(len(obj.data.vertices))),1,'REPLACE');obj.parent=rig;m=obj.modifiers.new('Bound costume part','ARMATURE');m.object=rig;return obj
def ellipsoid(name,center,size,mat,key):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=center);o=bpy.context.object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
 return bind(o,key)
def cube(name,center,size,mat,key):
 bpy.ops.mesh.primitive_cube_add(size=1,location=center);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.append(mat);b=o.modifiers.new('Crafted bevel','BEVEL');b.width=.025;b.segments=2;return bind(o,key)
def tube(name,a,b,r1,r2,mat,key,segments=10):
 d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=segments,radius1=r1,radius2=r2,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.append(mat);bevel=o.modifiers.new('Forged edge','BEVEL');bevel.width=.018;bevel.segments=2;return bind(o,key)
def ribbon(name,points,width,mat,key):
 verts=[]
 for i,p in enumerate(points):
  v=Vector(p);direction=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)]);side=direction.cross(Vector((0,-1,0))).normalized()*width/2;verts.extend([v-side,v+side])
 faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(points)-1)];m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);o.data.materials.append(mat);s=o.modifiers.new('Cloth thickness','SOLIDIFY');s.thickness=.025;return bind(o,key)

# Layered ceremonial silhouette follows the checked sage illustration, not Planetarni's costume.
z_waist=pelvis.z+.28
neck=source_point('neck01','tail')
for side,sgn in [('L',1),('R',-1)]:
 s='.'+side;shoulder=BONES['upper_arm'+s][0]
 ellipsoid('Emerald shoulder mantle '+side,shoulder+Vector((0,0,.06)),(.34,.34,.20),orange,'upper_arm'+s)
 ellipsoid('Gold shoulder rim '+side,shoulder+Vector((0,0,.04)),(.37,.36,.07),bronze,'upper_arm'+s)
 elbow,wrist=BONES['forearm'+s];d=wrist-elbow
 tube('Ivory sleeve '+side,elbow-d*.1,wrist,.29,.25,white,'forearm'+s)
 tube('Gold sleeve cuff '+side,wrist-d*.12,wrist,.29,.27,bronze,'forearm'+s)
 hand0,hand1=BONES['hand'+s];ellipsoid('Hand '+side,hand0+(hand1-hand0)*1.25,(.16,.16,.21),skin,'hand'+s)
 knee,ankle=BONES['shin'+s];d=ankle-knee
 tube('Gold greave '+side,knee+d*.35,ankle,.21,.17,bronze,'shin'+s)
 foot=BONES['foot'+s][0];ellipsoid('Armored charcoal boot '+side,foot+Vector((0,-.22,-.10)),(.22,.42,.23),steel,'foot'+s)
 tube('Boot gold seam '+side,foot+Vector((-.2,-.3,.03)),foot+Vector((.2,-.3,.03)),.025,.025,bronze,'foot'+s)
# Lapels, belt and central green gemstone.
for sgn in [-1,1]:
 ribbon('Gold edged robe lapel',[(sgn*.39,-.24,neck.z-.05),(sgn*.24,-.44,neck.z-.6),(sgn*.15,-.46,z_waist+.08)],.25,bronze,'chest')
 ribbon('Ivory robe lapel',[(sgn*.38,-.27,neck.z-.05),(sgn*.23,-.47,neck.z-.6),(sgn*.14,-.49,z_waist+.08)],.18,white,'chest')
for angle in range(0,360,20):
 a=math.radians(angle);o=cube('Emerald waist sash',(math.cos(a)*.56,math.sin(a)*.36,z_waist),(.25,.12,.24),orange,'pelvis')
ellipsoid('Gold waist jewel setting',(0,-.47,z_waist),(.22,.09,.25),bronze,'pelvis')
ellipsoid('Emerald waist jewel',(0,-.55,z_waist),(.14,.07,.17),orange,'pelvis')
# Independent cloth bones ensure the multi-layer robe can move with each animation.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
CLOTH=[]
for j in range(10):
 a=j/10*math.tau;front=math.sin(a)<-.15
 radius=.57
 points=[(math.cos(a)*radius,math.sin(a)*.39,z_waist-.10),
 (math.cos(a)*.68,math.sin(a)*.48,z_waist-.85),
 (math.cos(a)*.86,math.sin(a)*.59,z_waist-1.6),
 (math.cos(a)*1.02,math.sin(a)*.70,.22+(j%2)*.16)]
 label='sage-robe-'+str(j);chain=[]
 for i in range(3):
  key=label+'.'+str(i);bone(key,points[i],points[i+1],chain[-1] if chain else 'pelvis');chain.append(key)
 CLOTH.append((label,points,.46,white if j%3 else orange,chain))
bpy.ops.object.mode_set(mode='OBJECT')
# Radial width direction gives a true enclosing robe rather than flat front-only ribbons.
for label,points,width,mat,chain in CLOTH:
 for i in range(3):
  center=(Vector(points[i])+Vector(points[i+1]))*.5
  radial=Vector((center.x,center.y,0)).normalized();tangent=Vector((-radial.y,radial.x,0))
  pts=[Vector(points[i]),Vector(points[i+1])];ww=width*(1+i*.15)
  verts=[pts[0]-tangent*ww/2,pts[0]+tangent*ww/2,pts[1]+tangent*ww/2,pts[1]-tangent*ww/2]
  m=bpy.data.meshes.new(label);m.from_pydata(verts,[],[(0,1,2,3)]);o=bpy.data.objects.new(label+' fabric '+str(i),m);bpy.context.collection.objects.link(o);m.materials.append(mat);bind(o,chain[i]);sol=o.modifiers.new('Woven thickness','SOLIDIFY');sol.thickness=.025
  for sign in [-1,1]:
   tube(label+' gold woven border',pts[0]+tangent*ww*.45*sign,pts[1]+tangent*ww*.45*sign,.018,.016,bronze,chain[i],6)
# Long ivory hair with swept framing locks, high tied knot and pointed ears.
head0,head1=BONES['head'];hc=(head0+head1)/2;rx=.34;ry=.30;rz=(head1.z-head0.z)*.68
ellipsoid('Ivory hair crown',hc+Vector((0,.04,.11)),(.36,.31,rz*.95),hairmat,'head')
# Keep face uncovered: hair forms rear curtain plus separate side locks.
def lock(name,points,width,key='head',mat=hairmat):
 for i in range(len(points)-1):
  tube(name+' '+str(i),points[i],points[i+1],width*(1-i/len(points)),width*(1-(i+1)/len(points))+.008,mat,key,8)
for i in range(9):
 a=.12+i/8*(math.pi-.24);x=math.cos(a)*.30;y=math.sin(a)*.24
 lock('Long ivory back hair', [hc+Vector((x,y,rz*.6)),hc+Vector((x*1.2,y+.10,-.20)),hc+Vector((x*1.5,y+.20,-.8)),hc+Vector((x*1.7,y+.26,-1.35))],.105)
for sgn in [-1,1]:
 lock('Swept face framing lock',[hc+Vector((sgn*.12,-.12,rz*.85)),hc+Vector((sgn*.31,-.31,.10)),hc+Vector((sgn*.37,-.25,-.45)),hc+Vector((sgn*.46,-.12,-.95))],.085)
 tube('Pointed ear',hc+Vector((sgn*.29,.01,-.02)),hc+Vector((sgn*.68,.01,.20)),.105,.015,skin,'head',10)
ellipsoid('High ivory top knot',hc+Vector((0,.07,rz+.18)),(.21,.22,.26),hairlight,'head')
tube('Emerald hair tie',hc+Vector((-.19,-.02,rz+.04)),hc+Vector((.19,-.02,rz+.04)),.06,.06,orange,'head')
lock('Flowing topknot tail',[hc+Vector((0,.13,rz+.30)),hc+Vector((.10,.42,rz+.22)),hc+Vector((.20,.57,rz-.08)),hc+Vector((.30,.62,rz-.37))],.13)
# Brow circlet and gemstone retain the illustration's gold/emerald focal accent.
tube('Gold brow circlet',hc+Vector((-.27,-.29,.17)),hc+Vector((.27,-.29,.17)),.025,.025,bronze,'head',8)
ellipsoid('Forehead emerald',(hc.x,hc.y-.32,hc.z+.16),(.06,.025,.08),orange,'head')
# Physical eye geometry is attached to the same head; no painted billboard face.
for side in ['L','R']:
 center=source_point('eye.'+side,'head');center.y-=.015
 ellipsoid('Eye white '+side,center,(.105,.075,.065),eye_white,'head');ellipsoid('Brown iris '+side,center+Vector((0,-.069,0)),(.047,.016,.049),iris,'head');ellipsoid('Dark pupil '+side,center+Vector((0,-.084,0)),(.020,.009,.037),ink,'head');ellipsoid('Eye glint '+side,center+Vector((-.015,-.09,.018)),(.012,.006,.013),eye_white,'head')
 sign=1 if side=='L' else -1;tube('Focused eyebrow '+side,center+Vector((-sign*.09,-.075,.105)),center+Vector((sign*.09,-.062,.12)),.018,.022,hairmat,'head',6)
for b in rig.pose.bones:b.rotation_mode='QUATERNION'
def rotate(name,axis,angle):
 b=rig.pose.bones[name];rest=arm.bones[name].matrix_local.to_quaternion();q=rest.inverted()@Quaternion(Vector(axis),angle)@rest;b.rotation_quaternion=q@b.rotation_quaternion
for side,sign in [('L',1),('R',-1)]:
 rotate('upper_arm.'+side,(0,1,0),sign*.48);rotate('forearm.'+side,(1,0,0),.45)
 for finger in range(1,6):
  for seg in range(1,4):
   key=f'finger{finger}-{seg}.'+side
   if key in rig.pose.bones:rig.pose.bones[key].rotation_quaternion=Quaternion((0,0,1),(-1 if side=='L' else 1)*(.55 if finger==1 else .9))

bpy.context.view_layer.update()
hand=rig.pose.bones['hand.L'];resthand=rig.data.bones['hand.L'];deform=hand.matrix@resthand.matrix_local.inverted();inv=deform.inverted()
handcenter=deform@(BONES['hand.L'][0]+(BONES['hand.L'][1]-BONES['hand.L'][0])*1.25)
# Staff remains editable and attached to the left hand for all action clips.
def staff_tube(name,a,b,r1,r2,mat):
 return tube(name,inv@Vector(a),inv@Vector(b),r1,r2,mat,'hand.L',12)
shaft_low=handcenter+Vector((0,0,-1.65));shaft_high=handcenter+Vector((0,0,1.85))
staff_tube('Gold ritual staff shaft',shaft_low,shaft_high,.065,.065,bronze)
for dz in [-.30,-.15,0,.15,.30]:
 staff_tube('Staff dark grip band',handcenter+Vector((0,0,dz-.03)),handcenter+Vector((0,0,dz+.03)),.08,.08,steel)
orb=shaft_high+Vector((0,0,.32));ellipsoid('Staff emerald sphere',inv@orb,(.25,.25,.25),orange,'hand.L')
# Golden orbit cage around the orb, three perpendicular rings.
for axis in range(3):
 for j in range(24):
  a=j/24*math.tau;b=(j+1)/24*math.tau
  def point(t):
   v=Vector((math.cos(t)*.43,math.sin(t)*.43,0))
   if axis==1:v=Vector((v.x,0,v.y))
   if axis==2:v=Vector((0,v.x,v.y))
   return orb+v
  staff_tube('Golden astrolabe orbit',point(a),point(b),.022,.022,bronze)
staff_tube('Staff crown point',orb+Vector((0,0,.43)),orb+Vector((0,0,.72)),.10,.005,bronze)
# Fixed orthographic calibration, feet reference is the physical rig origin.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.cycles.device='GPU';prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='CUDA'
scene.render.resolution_x=scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True;scene.world.color=(.18,.18,.18);scene.view_settings.view_transform='Standard'
if bpy.app.build_options.freestyle:
 scene.render.use_freestyle=True;settings=scene.view_layers[0].freestyle_settings
 if not settings.linesets:settings.linesets.new('Anime contours')
 line=settings.linesets[0];line.select_crease=False;line.linestyle.color=(.025,.018,.015);line.linestyle.thickness=1.2
for loc,energy,size in [((-4,-6,9),1000,5),((4,-3,5),350,4),((2,4,7),800,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=energy;o.data.size=size;o.rotation_euler=(-o.location+Vector((0,0,3))).to_track_quat('-Z','Y').to_euler()
origin=.75;ortho=7.0;target=Vector((0,0,(origin-.5)*ortho/math.cos(math.pi/4)));bpy.ops.object.camera_add(location=target+Vector((0,-10,10)));cam=bpy.context.object;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=ortho;scene.camera=cam
# Original blend is editable; no screenshot illustration acts as a character surface.
for direction,angle in [('down',0),('down-right',45),('right',90),('up',180)]:
 rig.rotation_euler.z=math.radians(angle);name='sage-rig-'+direction;targetfile=LOCAL/(name+'.png');scene.render.filepath=str(targetfile);start=time.monotonic();bpy.ops.render.render(write_still=True);(OUT/targetfile.name).write_bytes(targetfile.read_bytes());meta={'id':name,'direction':direction,'width':512,'height':512,'origin':[.5,origin],'camera_elevation':45,'orthographic_scale':ortho,'sha256':hashlib.sha256(targetfile.read_bytes()).hexdigest(),'seconds':time.monotonic()-start,'status':'rig-visual-calibration-not-installed'};(OUT/(name+'.json')).write_text(json.dumps(meta,indent=2)+'\n');print('RIG_VIEW_COMPLETE',direction,flush=True)
rig.rotation_euler.z=0;blend=LOCAL/'sage-rig-down.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend));(OUT/blend.name).write_bytes(blend.read_bytes());print('SAGE_RIG_REVIEW_COMPLETE',flush=True)
