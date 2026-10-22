"""Androids: one deforming mesh, original synthetic costume and editable animation rig.
Shares the CC0 MakeHuman anatomical source with the Planetarni rig; costume follows the owner-accepted
identity candidate (docs/design/identity/android-v1). No sliced illustration frames or per-frame AI redraws.
"""
import bpy,math,json,hashlib,time,random
from pathlib import Path
from mathutils import Vector,Quaternion
ROOT=Path('/workspace/ki-legends-gpu');BASE=ROOT/'source/planetary-rig-base';OUT=ROOT/'renders/android-rig-review-v4';OUT.mkdir(parents=True,exist_ok=True);LOCAL=Path('/opt/ki-legends-gpu/android-rig-v4');LOCAL.mkdir(exist_ok=True)
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
arm=bpy.data.armatures.new('Android identity rig');rig=bpy.data.objects.new('hero-android',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
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
def glow_material(name,color,strength=4.0):
 srgb=tuple(int(color[i:i+2],16)/255 for i in (0,2,4));c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in srgb);m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*c,1);n=m.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');em.inputs['Color'].default_value=(*c,1);em.inputs['Strength'].default_value=strength;m.node_tree.links.new(em.outputs[0],out.inputs[0]);return m
skin=material('Pale skin','d8c4b4');suit=material('Black synthetic bodysuit','17191e');pants=material('Graphite undersuit','1d1f25');steel=material('Silver synthetic armor','b9c1cc');trim=material('Electric blue trim','3a74e8');plate=material('Black armor plates','24262c');white=material('Coat white','e6e9ef');coatblue=material('Coat blue','2a55c8');hairmat=material('Silver hair','c3ccda');hairlight=material('Hair white highlight','e9eef6');eye_white=material('Eye white','dfe6ee');iris=material('Steel blue iris','4f8fe0');ink=material('Ink and pupil','11151b');core=glow_material('Energy core','4fa8ff')
# Clothing is an opaque, fitted mesh, not a recoloured uncovered base.
positions=[v.copy() for v in vs]
for i,v in enumerate(positions):
 z=v.z;dominant=max(bodyweights[i],key=bodyweights[i].get)
 if dominant.startswith(('thigh','shin')) and 1.15<z<3.1:
  s=1 if v.x>=0 else -1;center=s*(.52+.06*(3-z));v.x=center+(v.x-center)*1.22;v.y*=1.18
# Closed gauntlets/boots replace finger/toe surfaces so no anatomical tips protrude.
faces=[f for f in faces if not any(max(bodyweights[i],key=bodyweights[i].get).startswith(('finger','foot')) for i in f)]
mesh=bpy.data.meshes.new('Fully clothed deforming humanoid');mesh.from_pydata(positions,[],faces);mesh.update();body=bpy.data.objects.new('Android body and synthetic costume',mesh);bpy.context.collection.objects.link(body)
for m in [skin,suit,pants,steel,plate]:mesh.materials.append(m)
for poly in mesh.polygons:
 ids=list(poly.vertices);dominant=max((k for i in ids for k in bodyweights[i]),key=lambda k:sum(bodyweights[i].get(k,0) for i in ids));z=sum(positions[i].z for i in ids)/len(ids)
 poly.material_index=3 if dominant.startswith(('forearm','hand','finger')) or z<1.18 else 2 if dominant.startswith(('thigh','shin','foot','pelvis')) or z<3.12 else 1 if dominant in ['spine','chest'] else 0;poly.use_smooth=True
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
# Original silhouette: black bodysuit, silver synthetic armor plates, blue trim and glowing energy cores.
z_chest=source_point('spine01','head').z;z_waist=pelvis.z+.28
for side in ['L','R']:
 s='.'+side;sign=1 if side=='L' else -1;shoulder=BONES['upper_arm'+s][0]
 ellipsoid('Layered shoulder armor '+side,shoulder+Vector((sign*.05,0,.10)),(.29,.30,.17),steel,'upper_arm'+s)
 ellipsoid('Shoulder trim rim '+side,shoulder+Vector((sign*.055,0,.075)),(.31,.315,.06),trim,'upper_arm'+s)
 elbow,wrist=BONES['forearm'+s];d=wrist-elbow;tube('Forged gauntlet '+side,elbow+d*.18,wrist-d*.10,.21,.17,steel,'forearm'+s);tube('Gauntlet cuff '+side,elbow+d*.18,elbow+d*.25,.235,.225,trim,'forearm'+s)
 knee,ankle=BONES['shin'+s];d=ankle-knee;tube('Armored greave '+side,knee+d*.35,ankle,.23,.18,steel,'shin'+s);tube('Greave trim upper edge '+side,knee+d*.32,knee+d*.39,.245,.24,trim,'shin'+s)
 hand0,hand1=BONES['hand'+s];hand_center=hand0+(hand1-hand0)*1.25;cube('Armored glove '+side,hand_center,(.30,.26,.34),steel,'hand'+s);cube('Glove blue cuff '+side,hand_center+Vector((0,0,.15)),(.32,.28,.05),trim,'hand'+s);ellipsoid('Gauntlet thumb '+side,hand_center+Vector((-sign*.16,-.04,.04)),(.09,.12,.12),plate,'hand'+s)
 for knuckle in range(4):cube('Bronze knuckle plate',hand_center+Vector((-.12+knuckle*.08,-.15,.09)),(.065,.07,.07),trim,'hand'+s)
 foot=BONES['foot'+s][0];bootverts=[]
 for yy,ww,hh in [(.22,.18,.32),(.05,.23,.40),(-.35,.23,.27),(-.60,.14,.17),(-.75,.025,.1)]:
  for j in range(8):
   angle=j/8*math.tau;bootverts.append(foot+Vector((math.cos(angle)*ww,yy,-.28+hh*.5+math.sin(angle)*hh*.5)))
 bootfaces=[(i*8+j,i*8+(j+1)%8,(i+1)*8+(j+1)%8,(i+1)*8+j) for i in range(4) for j in range(8)];bootfaces.extend([tuple(range(7,-1,-1)),tuple(range(32,40))]);bootmesh=bpy.data.meshes.new('Pointed armor boot');bootmesh.from_pydata(bootverts,[],bootfaces);bootobj=bpy.data.objects.new('Closed pointed boot '+side,bootmesh);bpy.context.collection.objects.link(bootobj);bootobj.data.materials.append(steel);bind(bootobj,'foot'+s)
 for yy,zz in [(-.2,.08),(-.42,-.03)]:tube('Boot trim seam',foot+Vector((-.19,yy,zz)),foot+Vector((.19,yy,zz)),.015,.015,trim,'foot'+s,6)
 # Small forged seams provide readable trim detail at delivery resolution.
 tube('Gauntlet trim ridge',elbow+d*.36+Vector((0,-.18,0)),wrist-d*.18+Vector((0,-.14,0)),.018,.012,trim,'forearm'+s,6)
# Belt made from separate overlapping pieces rather than skin pigmentation.
for angle in range(0,360,20):
 a=math.radians(angle);center=(math.cos(a)*.55,math.sin(a)*.34,z_waist);o=cube('Layered plate waist belt',center,(.24,.10,.19),plate,'pelvis')
cube('Belt buckle',(0,-.42,z_waist),(.26,.08,.22),trim,'pelvis')
ellipsoid('Chest armor plate',(0,-.22,z_chest+.10),(.50,.22,.40),steel,'chest');ellipsoid('Energy core',(0,-.47,z_chest+.14),(.12,.04,.12),core,'chest');ellipsoid('Energy core socket',(0,-.45,z_chest+.14),(.16,.04,.16),plate,'chest')
for side in ['L','R']:
 s='.'+side;sign=1 if side=='L' else -1;shoulder=BONES['upper_arm'+s][0];knee=BONES['shin'+s][0]
 ellipsoid('Shoulder joint core '+side,shoulder+Vector((sign*.30,-.04,.10)),(.07,.07,.07),core,'upper_arm'+s);tube('Shoulder spike '+side,shoulder+Vector((sign*.12,0,.20)),shoulder+Vector((sign*.24,0,.52)),.07,.006,steel,'upper_arm'+s,6)
 ellipsoid('Knee joint core '+side,knee+Vector((0,-.23,0)),(.08,.04,.08),core,'shin'+s)
for k in range(3):cube('Abdomen plate',(0,-.30,z_waist+.12+k*.17),(.52-.05*k,.10,.14),steel,'spine');cube('Abdomen plate trim',(0,-.355,z_waist+.12+k*.17),(.30-.04*k,.02,.03),trim,'spine')
for side in ['L','R']:
 s='.'+side;sign=1 if side=='L' else -1;shoulder=BONES['upper_arm'+s][0];hip,knee=BONES['thigh'+s];dt=knee-hip;elbow,wrist=BONES['forearm'+s];df=wrist-elbow
 ellipsoid('Pectoral plate '+side,Vector((sign*.22,-.28,z_chest+.20)),(.26,.16,.20),steel,'chest');ellipsoid('Pectoral rim '+side,Vector((sign*.22,-.285,z_chest+.20)),(.275,.15,.045),trim,'chest');ellipsoid('Pauldron layer 2 '+side,shoulder+Vector((sign*.10,0,.02)),(.30,.31,.15),steel,'upper_arm'+s);ellipsoid('Pauldron layer 3 '+side,shoulder+Vector((sign*.15,0,-.07)),(.28,.29,.12),plate,'upper_arm'+s)
 tube('Thigh armor '+side,hip+dt*.26,hip+dt*.76,.35,.30,steel,'thigh'+s);tube('Thigh armor trim '+side,hip+dt*.74,hip+dt*.80,.31,.305,trim,'thigh'+s);ellipsoid('Hip plate '+side,Vector((sign*.55,0,z_waist-.10)),(.22,.30,.25),steel,'pelvis')
 tube('Forearm light strip '+side,elbow+df*.30+Vector((0,-.22,0)),wrist-df*.20+Vector((0,-.20,0)),.018,.014,core,'forearm'+s,6)
neck=source_point('neck01','tail');ellipsoid('Armored collar',neck+Vector((0,0,-.1)),(.34,.30,.19),steel,'neck');ellipsoid('Collar blue rim',neck+Vector((0,0,-.04)),(.355,.315,.05),trim,'neck')
# Cloth chains are added before animation: independent, continuous wind motion.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
CLOTH=[]
for label,points,width,mat,parent in [
 ('coat-back-left',[(-.30,.30,z_waist+.05),(-.34,.34,z_waist-.75),(-.40,.40,z_waist-1.55),(-.46,.46,z_waist-2.35)],.52,coatblue,'pelvis'),
 ('coat-back-right',[(.30,.30,z_waist+.05),(.34,.34,z_waist-.75),(.40,.40,z_waist-1.55),(.46,.46,z_waist-2.35)],.52,white,'pelvis'),
 ('coat-front-blue',[(.34,-.34,z_waist+.02),(.40,-.36,z_waist-.65),(.46,-.37,z_waist-1.35),(.52,-.38,z_waist-2.05)],.40,coatblue,'pelvis'),
 ('coat-front-white',[(-.34,-.34,z_waist+.02),(-.40,-.36,z_waist-.65),(-.46,-.37,z_waist-1.35),(-.52,-.38,z_waist-2.05)],.40,white,'pelvis')]:
 chain=[]
 for i in range(3):
  key=label+'.'+str(i);bone(key,points[i],points[i+1],chain[-1] if chain else parent);chain.append(key)
 CLOTH.append((label,points,width,mat,chain))
bpy.ops.object.mode_set(mode='OBJECT')
def chain_ribbon(name,points,width,mat,chain,off=0.0,thickness=.025,rings_per=4):
 # One continuous mesh skinned across the three chain bones: smooth bending and a pointed tip.
 pts=[Vector(p) for p in points];rings=[];
 for seg in range(3):
  for r in range(rings_per):rings.append((seg+r/rings_per,pts[seg].lerp(pts[seg+1],r/rings_per)))
 rings.append((3.0,pts[3]));verts=[];weights=[];n=len(rings);sign=1 if pts[0].x>0 else -1
 for idx,(u,p) in enumerate(rings):
  f=idx/(n-1);w=width*(1-.62*f)*(1-.9*max(0,f-.82)/.18)+.01;shift=Vector((sign*off*w,-.012*(off!=0),0))
  verts.extend([p+shift-Vector((w/2,0,0)),p+shift+Vector((w/2,0,0))]);j0=min(int(u),2);fr=u-j0
  wt={chain[2]:1.0} if j0>=2 else {chain[j0]:1-fr,chain[j0+1]:fr}
  weights.extend([wt,wt])
 faces=[(2*k,2*k+1,2*k+3,2*k+2) for k in range(n-1)];m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
 groups={key:o.vertex_groups.new(name=key) for key in chain}
 for vi,wt in enumerate(weights):
  for key,val in wt.items():
   if val>0:groups[key].add([vi],val,'REPLACE')
 o.parent=rig;mod=o.modifiers.new('Skinned cloth','ARMATURE');mod.object=rig;s=o.modifiers.new('Cloth thickness','SOLIDIFY');s.thickness=thickness;return o
for label,points,width,mat,chain in CLOTH:
 chain_ribbon(label+' panel',points,width,mat,chain);chain_ribbon(label+' trim stripe',points,width*.16,trim,chain,off=.30,thickness=.03)
head0,head1=BONES['head'];hc=(head0+head1)/2;rx=.34;ry=.30;rz=(head1.z-head0.z)*.68
capverts=[];capfaces=[];steps=12;around=24
for i in range(steps+1):
 for j in range(around):
  angle=j/around*math.tau;limit=1.20 if math.sin(angle)<-.2 else 2.0;phi=.01+i/steps*limit;capverts.append(hc+Vector((rx*math.sin(phi)*math.cos(angle),ry*math.sin(phi)*math.sin(angle),rz*math.cos(phi)+.08)))
for i in range(steps):
 for j in range(around):capfaces.append((i*around+j,i*around+(j+1)%around,(i+1)*around+(j+1)%around,(i+1)*around+j))
capmesh=bpy.data.meshes.new('Open face hair cap');capmesh.from_pydata(capverts,[],capfaces);capobj=bpy.data.objects.new('Open face chestnut cap',capmesh);bpy.context.collection.objects.link(capobj);capobj.data.materials.append(hairmat);bind(capobj,'head')
def lock(name,p0,p1,p2,width,mat):
 verts=[];rings=7;sides=6
 for i in range(rings):
  t=i/(rings-1);center=(1-t)**2*Vector(p0)+2*(1-t)*t*Vector(p1)+t*t*Vector(p2);tangent=(2*(1-t)*(Vector(p1)-Vector(p0))+2*t*(Vector(p2)-Vector(p1))).normalized();u=tangent.cross(Vector((0,1,0))).normalized()
  if u.length<.1:u=Vector((1,0,0))
  v=tangent.cross(u).normalized();w=width*(1-t)**.7+.003
  for j in range(sides):a=j/sides*math.tau;verts.append(center+u*math.cos(a)*w+v*math.sin(a)*w*.45)
 faces=[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j) for i in range(rings-1) for j in range(sides)];mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mat);return bind(o,'head')
random.seed(574)
for i in range(21):
 a=i/21*math.tau;p0=hc+Vector((math.cos(a)*rx*.65,math.sin(a)*ry*.65,rz*.55));p1=hc+Vector((math.cos(a)*rx,math.sin(a)*ry,rz*.95));p2=hc+Vector((math.cos(a)*(rx+.12)+.10,math.sin(a)*(ry+.10)+.06,rz+random.uniform(-.10,.30)));lock('Layered crown spike',p0,p1,p2,.11,hairlight if i%4==0 else hairmat)
for i in range(5):
 x=-.26+i*.12;p0=hc+Vector((x,-.10,rz*.8));p1=hc+Vector((x-.10,-.35,rz*.45));p2=hc+Vector((x-.12,-.34,.17+(i%3)*.04));lock('Side swept fringe',p0,p1,p2,.10,hairmat)
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
# Fixed orthographic calibration, feet reference is the physical rig origin.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.cycles.device='GPU';prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
for d in prefs.devices:d.use=d.type=='CUDA'
scene.render.resolution_x=scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True;scene.world.color=(.18,.18,.18);scene.view_settings.view_transform='Standard'
if bpy.app.build_options.freestyle:
 scene.render.use_freestyle=True;settings=scene.view_layers[0].freestyle_settings
 if not settings.linesets:settings.linesets.new('Anime contours')
 line=settings.linesets[0];line.select_crease=False;line.linestyle.color=(.025,.018,.015);line.linestyle.thickness=1.2
for loc,energy,size in [((-4,-6,9),1000,5),((4,-3,5),350,4),((2,4,7),800,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=energy;o.data.size=size;o.rotation_euler=(-o.location+Vector((0,0,3))).to_track_quat('-Z','Y').to_euler()
origin=.78;ortho=5.65;target=Vector((0,0,(origin-.5)*ortho/math.cos(math.pi/4)));bpy.ops.object.camera_add(location=target+Vector((0,-10,10)));cam=bpy.context.object;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=ortho;scene.camera=cam
# Original blend is editable; no screenshot illustration acts as a character surface.
for direction,angle in [('down',0),('down-left',-45),('left',-90),('up-left',-135),('up',180),('up-right',135),('right',90),('down-right',45)]:
 rig.rotation_euler.z=math.radians(angle);name='android-rig-'+direction;targetfile=LOCAL/(name+'.png');scene.render.filepath=str(targetfile);start=time.monotonic();bpy.ops.render.render(write_still=True);(OUT/targetfile.name).write_bytes(targetfile.read_bytes());meta={'id':name,'direction':direction,'width':512,'height':512,'origin':[.5,origin],'camera_elevation':45,'orthographic_scale':ortho,'sha256':hashlib.sha256(targetfile.read_bytes()).hexdigest(),'seconds':time.monotonic()-start,'status':'rig-visual-calibration-not-installed'};(OUT/(name+'.json')).write_text(json.dumps(meta,indent=2)+'\n');print('RIG_VIEW_COMPLETE',direction,flush=True)
rig.rotation_euler.z=0;blend=LOCAL/'android-rig-down.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend));(OUT/blend.name).write_bytes(blend.read_bytes());print('ANDROID_RIG_REVIEW_COMPLETE',flush=True)
