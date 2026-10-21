"""Static image-derived sage candidate: editable texture-packed BLEND and 3 fixed-camera RGBA views.
No imports requiring glTF/OBJ Blender addons. Does not claim rigging or animation readiness.
Run with the isolated Blender venv Python. Does not install packages or affect pod lifecycle.
"""
import argparse,hashlib,json,math,time
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

p=argparse.ArgumentParser();p.add_argument('--source',default='/workspace/ki-legends-gpu/renders/sage-triposr-pilot-v1/sage-pilot.obj');p.add_argument('--texture',default='/workspace/ki-legends-gpu/renders/sage-triposr-pilot-v1/texture.png');p.add_argument('--output',default='/workspace/ki-legends-gpu/renders/sage-triposr-pilot-v1/enhanced-review');p.add_argument('--reference',required=True);p.add_argument('--padding-square',type=int,default=1707);p.add_argument('--padding-left',type=int,default=341);p.add_argument('--padding-top',type=int,default=85);p.add_argument('--front-yaw',type=float,default=-90,help='Source-to-game rotation around Z; provisional until reference comparison');args=p.parse_args()
source=Path(args.source);texture=Path(args.texture);out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
verts=[];uvs=[];faces=[];face_uv=[]
for line in source.read_text().splitlines():
 fields=line.split()
 if not fields:continue
 if fields[0]=='v':verts.append(Vector(tuple(map(float,fields[1:4]))))
 elif fields[0]=='vt':uvs.append(tuple(map(float,fields[1:3])))
 elif fields[0]=='f':
  vind=[];tind=[]
  for corner in fields[1:]:
   values=corner.split('/');vi=int(values[0]);vind.append(vi-1 if vi>0 else len(verts)+vi)
   if len(values)<2 or not values[1]:raise RuntimeError('OBJ face missing UV coordinates')
   ti=int(values[1]);tind.append(ti-1 if ti>0 else len(uvs)+ti)
  faces.append(vind);face_uv.append(tind)
assert verts and faces and uvs,'Missing OBJ mesh/UV data'
rawverts=[v.copy() for v in verts]
used=set(v for f in faces for v in f)
mins=[min(verts[i][axis] for i in used) for axis in range(3)];maxs=[max(verts[i][axis] for i in used) for axis in range(3)]
span=[maxs[i]-mins[i] for i in range(3)]
# TripoSR's camera code documents right-handed X-back,Y-right,Z-up.
# Only infer Y-up if the input is unequivocally taller in Y; record this decision.
axis='Z';converted=False
if span[1]>span[2]*1.5:
 verts=[Vector((v.x,-v.z,v.y)) for v in verts];axis='Y';converted=True
mins=[min(verts[i][axis] for i in used) for axis in range(3)];maxs=[max(verts[i][axis] for i in used) for axis in range(3)]
center=Vector(((mins[0]+maxs[0])/2,(mins[1]+maxs[1])/2,mins[2]));height=maxs[2]-mins[2];scale=5.6/height
angle=math.radians(args.front_yaw);c=math.cos(angle);s=math.sin(angle)
normalized=[]
for v in verts:
 v=(v-center)*scale;normalized.append(Vector((c*v.x-s*v.y,s*v.x+c*v.y,v.z)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mesh=bpy.data.meshes.new('Image-derived textured sage mesh');mesh.from_pydata(normalized,[],faces);mesh.update();obj=bpy.data.objects.new('sage-triposr-static-candidate',mesh);bpy.context.collection.objects.link(obj)
layer=mesh.uv_layers.new(name='TripoSR baked UV')
for poly,tindices in zip(mesh.polygons,face_uv):
 for loopidx,uvindex in zip(poly.loop_indices,tindices):layer.data[loopidx].uv=uvs[uvindex]
 poly.use_smooth=True
assert not converted,'Expected original TripoSR Z-up geometry'
mat=bpy.data.materials.new('Preserved painted color — unlit');mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear();output=nodes.new('ShaderNodeOutputMaterial');emission=nodes.new('ShaderNodeEmission');emission.inputs['Strength'].default_value=1.0;image=nodes.new('ShaderNodeTexImage');image.image=bpy.data.images.load(str(texture.resolve()),check_existing=False);image.image.colorspace_settings.name='sRGB';image.interpolation='Linear';image.image.pack();mat.node_tree.links.new(image.outputs['Color'],emission.inputs['Color']);mat.node_tree.links.new(emission.outputs['Emission'],output.inputs['Surface']);mesh.materials.append(mat)

# Proper UV projection onto the existing geometry, fixed in rest space for every view.
# Original high-resolution reference is sampled directly; no changes to source pixels.
reference_image=bpy.data.images.load(str(Path(args.reference).resolve()),check_existing=False);reference_image.pack();rw,rh=reference_image.size
projection=mesh.uv_layers.new(name='High resolution source projection')
valid=[];camera_source=Vector((1.9,0,0));half=math.tan(math.radians(20))
for v in rawverts:
 depth=1.9-v.x
 if depth<=0:valid.append((False,(0,0)));continue
 u=.5+v.y/(2*depth*half);vtop=.5-v.z/(2*depth*half)
 ru=(u*args.padding_square-args.padding_left)/rw
 rv=1-(vtop*args.padding_square-args.padding_top)/rh
 valid.append((0<=ru<=1 and 0<=rv<=1,(ru,rv)))
for loop in mesh.loops:projection.data[loop.index].uv=valid[loop.vertex_index][1]
bvh=BVHTree.FromPolygons(rawverts,faces,all_triangles=False);weight=mesh.attributes.new(name='FixedReferenceVisibility',type='FLOAT',domain='POINT');vertexweights=[0.0]*len(verts)
for index,face in enumerate(faces):
 center_raw=sum((rawverts[i] for i in face),Vector())/len(face);direction=(center_raw-camera_source).normalized();normal=(rawverts[face[1]]-rawverts[face[0]]).cross(rawverts[face[2]]-rawverts[face[0]]).normalized();front=max(0,normal.dot(-direction));blend=max(0,min(1,(front-.20)/.55));blend=blend*blend*(3-2*blend)
 if blend<=0:continue
 hit,hitnormal,hitindex,distance=bvh.ray_cast(camera_source,direction)
 if hit is None or (hitindex!=index and abs(distance-(center_raw-camera_source).length)>.01):continue
 for i in face:
  if valid[i][0]:vertexweights[i]=max(vertexweights[i],blend)
for i,value in enumerate(vertexweights):weight.data[i].value=value
original_uv=nodes.new('ShaderNodeUVMap');original_uv.uv_map='TripoSR baked UV';mat.node_tree.links.new(original_uv.outputs['UV'],image.inputs['Vector'])
reference=nodes.new('ShaderNodeTexImage');reference.image=reference_image;reference.extension='CLIP';reference.interpolation='Linear';project_uv=nodes.new('ShaderNodeUVMap');project_uv.uv_map=projection.name;mat.node_tree.links.new(project_uv.outputs['UV'],reference.inputs['Vector'])
visibility=nodes.new('ShaderNodeAttribute');visibility.attribute_name=weight.name;alpha=nodes.new('ShaderNodeMath');alpha.operation='MULTIPLY';mat.node_tree.links.new(visibility.outputs['Fac'],alpha.inputs[0]);mat.node_tree.links.new(reference.outputs['Alpha'],alpha.inputs[1]);mix=nodes.new('ShaderNodeMixRGB');mat.node_tree.links.new(alpha.outputs[0],mix.inputs[0]);mat.node_tree.links.new(image.outputs['Color'],mix.inputs[1]);mat.node_tree.links.new(reference.outputs['Color'],mix.inputs[2]);mat.node_tree.links.new(mix.outputs['Color'],emission.inputs['Color'])
mesh.uv_layers.active=mesh.uv_layers['TripoSR baked UV'];mesh.uv_layers['TripoSR baked UV'].active_render=True

scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=False;scene.cycles.use_persistent_data=True;scene.cycles.device='GPU'
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='CUDA'
if not any(d.type=='CUDA' for d in prefs.devices):raise RuntimeError('No CUDA render device available; no silent CPU fallback')
scene.render.resolution_x=scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8';scene.render.film_transparent=True;scene.render.use_freestyle=False
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
DIRECTIONS={'down':0,'right':90,'up':180}
# One scale/camera for every direction; no per-view recropping or silhouette normalization.
origin=.75;margin=12/512;ortho=7.0
for deg in DIRECTIONS.values():
 ca=math.cos(math.radians(deg));sa=math.sin(math.radians(deg))
 for i in used:
  v=normalized[i];x=ca*v.x-sa*v.y;y=sa*v.x+ca*v.y;up=(y+v.z)/math.sqrt(2)
  ortho=max(ortho,abs(x)/(.5-margin),up/(origin-margin),-up/(1-origin-margin))
ortho=math.ceil(ortho*100)/100
point=Vector((0,0,(origin-.5)*ortho/math.cos(math.pi/4)));bpy.ops.object.camera_add(location=point+Vector((0,-10,10)));camera=bpy.context.object;camera.name='Fixed grounded 45 degree camera';camera.rotation_euler=(point-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=ortho;scene.camera=camera
obj['status']='static reconstruction candidate — not rigged, not visually accepted';obj['input_obj_sha256']=hashlib.sha256(source.read_bytes()).hexdigest();obj['input_texture_sha256']=hashlib.sha256(texture.read_bytes()).hexdigest()
report={'status':'static-front-projection-three-views-not-rig-ready','source':str(source),'source_sha256':obj['input_obj_sha256'],'texture_sha256':obj['input_texture_sha256'],'source_up_axis':axis,'converted_y_up':converted,'source_to_game_yaw':args.front_yaw,'direction_labels':'provisional until face orientation comparison','normalization':{'height':5.6,'scale':scale,'source_floor_center':list(center)},'camera':{'elevation':45,'orthographic_scale':ortho,'origin':[.5,origin],'resolution':[512,512],'margin_target_px':12},'material':'packed original bake plus fixed 3D UV reference projection, emission strength 1; no billboard','projection':{'reference':args.reference,'reference_size':[rw,rh],'padding_square':args.padding_square,'left':args.padding_left,'top':args.padding_top,'distance':1.9,'fov':40,'ray_tolerance':.01,'weighted_vertices':sum(v>0 for v in vertexweights),'registration':'unvalidated; potential stretching or mismatched landmarks'},'vertices':len(verts),'faces':len(faces),'views':[],'limitations':['Static mesh only; no skeleton or motion acceptance','Unseen surfaces reconstructed by model','Body/robe/staff may be fused; inspect before rigging','Camera framing may exceed production ortho7; integrate only after review']}
# Save before rendering so source survives any interrupted render worker.
bpy.context.view_layer.objects.active=obj;obj.select_set(True);obj.rotation_euler.z=0;bpy.ops.wm.save_as_mainfile(filepath=str(out/'sage-front-projected-static-candidate.blend'))
for direction,deg in DIRECTIONS.items():
 obj.rotation_euler.z=math.radians(deg);scene.render.filepath=str(out/('sage-'+direction+'.png'));start=time.monotonic();bpy.ops.render.render(write_still=True);target=Path(scene.render.filepath)
 entry={'direction':direction,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'seconds':time.monotonic()-start};report['views'].append(entry);(out/'review-report.json').write_text(json.dumps(report,indent=2)+'\n');print('SAGE_FRONT_PROJECTED_STATIC_VIEW_COMPLETE',json.dumps(entry),flush=True)
obj.rotation_euler.z=0;bpy.ops.wm.save_as_mainfile(filepath=str(out/'sage-front-projected-static-candidate.blend'));print('SAGE_FRONT_PROJECTED_STATIC_REVIEW_COMPLETE',flush=True)
