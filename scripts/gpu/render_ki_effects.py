"""32 real Cycles CUDA frames: four coherent KI projectile/impact animations.
No AI interpolation, frame duplication or changes to combat timing.
"""
from pathlib import Path
import bpy,math,json,time,hashlib
from mathutils import Vector
ROOT=Path('/workspace/ki-legends-gpu');OUT=ROOT/'renders/ki-effects-v1';OUT.mkdir(parents=True,exist_ok=True)
LOCAL=Path('/opt/ki-legends-gpu/ki-effects');LOCAL.mkdir(exist_ok=True)
COLORS={'verdant':(.15,.9,.38),'aether':(.65,.28,1),'nexus':(.04,.65,1),'pyra':(1,.12,.015)}
for world,color in COLORS.items():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.cycles.device='GPU'
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='CUDA'
 scene.render.resolution_x=scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True;scene.world.color=(0,0,0)
 scene.view_settings.view_transform='Standard'
 def emission(name,c,power):
  m=bpy.data.materials.new(name);m.use_nodes=True;nodes=m.node_tree.nodes;nodes.clear();e=nodes.new('ShaderNodeEmission');e.inputs['Color'].default_value=(*c,1);e.inputs['Strength'].default_value=power;o=nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(e.outputs[0],o.inputs[0]);return m
 energy=emission('KI energy',color,2);white=emission('Bright core',tuple(.6+.4*c for c in color),2)
 bpy.ops.object.empty_add();root=bpy.context.object;root.name='KI phase controller'
 objects=[]
 for ring in range(3):
  curve=bpy.data.curves.new('Energy crescent','CURVE');curve.dimensions='3D';curve.bevel_depth=.035 if ring<2 else .018;curve.bevel_resolution=3;spline=curve.splines.new('POLY');spline.points.add(39)
  for i,p in enumerate(spline.points):
   a=i/39*math.pi*(1.5 if ring<2 else 1.85);r=1+ring*.23;p.co=(math.cos(a)*r,math.sin(a)*r,math.sin(a*3)*.12,1)
  o=bpy.data.objects.new('Swirling energy '+str(ring),curve);scene.collection.objects.link(o);o.parent=root;o.rotation_euler=(ring*.6,ring*.35,ring*2.1);o.data.materials.append(energy);objects.append(o)
 for i in range(12):
  a=i/12*math.tau;bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.055+(i%3)*.02,location=(math.cos(a)*1.35,math.sin(a)*1.35,math.sin(a*3)*.35));o=bpy.context.object;o.name='KI spark';o.data.materials.append(white);o.parent=root
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.28);core=bpy.context.object;core.data.materials.append(white);core.parent=root
 for frame in range(8):
  phase=frame/7;scene.frame_set(frame);root.rotation_euler=(phase*.3,phase*.2,phase*math.tau*.65);root.scale=(.2+1.0*math.sin(phase*math.pi),)*3;root.keyframe_insert(data_path='rotation_euler');root.keyframe_insert(data_path='scale');core.scale=(1-.6*phase,)*3;core.keyframe_insert(data_path='scale')
 bpy.ops.object.camera_add(location=(0,-5,math.sqrt(3)*5));cam=bpy.context.object;cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=4.6;scene.camera=cam
 # Preserve emission bloom in the alpha channel as well as RGB.
 scene.use_nodes=True;tree=scene.node_tree;tree.nodes.clear();layer=tree.nodes.new('CompositorNodeRLayers');glare=tree.nodes.new('CompositorNodeGlare');glare.glare_type='FOG_GLOW';glare.quality='HIGH';glare.threshold=.8;glare.size=6;tree.links.new(layer.outputs['Image'],glare.inputs['Image']);bw=tree.nodes.new('CompositorNodeRGBToBW');tree.links.new(glare.outputs['Image'],bw.inputs[0]);maximum=tree.nodes.new('CompositorNodeMath');maximum.operation='MAXIMUM';tree.links.new(bw.outputs[0],maximum.inputs[0]);tree.links.new(layer.outputs['Alpha'],maximum.inputs[1]);alpha=tree.nodes.new('CompositorNodeSetAlpha');tree.links.new(glare.outputs['Image'],alpha.inputs['Image']);tree.links.new(maximum.outputs[0],alpha.inputs['Alpha']);out=tree.nodes.new('CompositorNodeComposite');tree.links.new(alpha.outputs[0],out.inputs[0])
 for frame in range(8):
  scene.frame_set(frame);name=f'{world}-pulse-{frame:02}';target=LOCAL/(name+'.png');scene.render.filepath=str(target);start=time.monotonic();bpy.ops.render.render(write_still=True);(OUT/target.name).write_bytes(target.read_bytes())
  if frame==0:
   blend=LOCAL/(name+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(blend));(OUT/blend.name).write_bytes(blend.read_bytes())
  meta={'id':name,'world':world,'frame':frame,'frames':8,'fps':16,'durationMs':500,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'width':512,'height':512,'engine':'Cycles CUDA','blender':bpy.app.version_string,'seconds':time.monotonic()-start,'status':'generated-pending-review'};(OUT/(name+'.json')).write_text(json.dumps(meta,indent=2)+'\n');print('EFFECT_COMPLETE',name,flush=True)
print('KI_EFFECTS_COMPLETE',flush=True)
