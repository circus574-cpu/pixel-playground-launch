"""Blender CUDA geometry guides for controlled orthographic city sprites.
These guides are source art, not final shipped buildings. No character references.
"""
import bpy,math,json,time,hashlib,random
from pathlib import Path
from mathutils import Vector
ROOT=Path('/workspace/ki-legends-gpu');OUT=ROOT/'renders/city-guides-v1';OUT.mkdir(parents=True,exist_ok=True)
LOCAL=Path('/opt/ki-legends-gpu/city-guides');LOCAL.mkdir(exist_ok=True)
random.seed(574)
def mat(name,hexcol,metal=0,glow=0):
 c=tuple(int(hexcol[i:i+2],16)/255 for i in (0,2,4));m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.65;p.inputs['Metallic'].default_value=metal
 if glow:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=glow
 return m
def bevel(o,v=.035):
 m=o.modifiers.new('Soft crafted edges','BEVEL');m.width=v;m.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
def cube(name,loc,scale,m,edge=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if edge:bevel(o,edge)
 return o
def cyl(name,loc,r,depth,m,vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(m);bevel(o,.018);return o
def cone(name,loc,r,depth,m,vertices=8):
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=.03,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(m);return o
def ball(name,loc,scale,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(m);return o
def line(name,a,b,r,m):
 d=Vector(b)-Vector(a);o=cyl(name,(Vector(a)+Vector(b))/2,r,d.length,m,8);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def crystal(loc,r,height,m):
 x,y,z=loc
 cyl('Crystal body',(x,y,z+height*.37),r,height*.64,m,6)
 cone('Crystal tip',(x,y,z+height*.83),r,height*.32,m,6)
def roof(x,y,z,w,d,h,m,gold):
 # Gable along Y. Individual overlapping shingles remain readable after img2img.
 for side in [-1,1]:
  slope=(w/2)**2+h*h
  angle=math.atan2(h,w/2)
  for row in range(7):
   u=(row+.5)/7;xx=x+side*w*.5*u;zz=z+h*(1-u)
   for col in range(9):
    yy=y-d/2+(col+.5)*d/9
    tile=cube('Handcrafted roof tile',(xx,yy,zz),((slope**.5)/7+.05,d/9-.015,.06),m,.015);tile.rotation_euler[1]=side*angle
 line('Roof ridge',(x,y-d*.52,z+h+.06),(x,y+d*.52,z+h+.06),.065,gold)
def window(x,y,z,w,h,frame,glass):
 cube('Window surround',(x,y,z),(w+.13,.09,h+.15),frame)
 cube('Luminous inset',(x,y-.06,z),(w,.045,h),glass,.01)
 cube('Window mullion',(x,y-.09,z),(.04,.035,h),frame,.008)
def house(x,y,w,d,h,wall,timber,roofmat,glass,gold):
 cube('Stone foundation',(x,y,.13),(w+.2,d+.18,.26),timber)
 cube('Plastered walls',(x,y,h/2+.2),(w,d,h),wall)
 for xx in [-.48,.48]:cube('Carved timber pillar',(x+xx*w,y-d*.51,h/2+.2),(.12,.13,h),timber)
 cube('Front oak lintel',(x,y-d*.51,h+.14),(w,.12,.12),timber)
 # Triangle fills the visible roof gable.
 verts=[(x-w/2,y-d/2,h+.2),(x+w/2,y-d/2,h+.2),(x,y-d/2,h+1.15)]
 mesh=bpy.data.meshes.new('Gable');mesh.from_pydata(verts,[],[(0,1,2)]);o=bpy.data.objects.new('Front stone gable',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(wall)
 roof(x,y,h+.22,w+.45,d+.45,.95,roofmat,gold)
 cube('Recessed front door',(x,y-d*.51-.03,.78),(.6,.12,1.15),timber)
 for zz in [.35,.8,1.2]:cube('Door bands',(x,y-d*.51-.1,zz),(.6,.035,.035),gold,.01)
 for xx in [-w*.29,w*.29]:window(x+xx,y-d*.51-.06,1.15,.36,.7,timber,glass)
 for i in range(3):cube('Front step',(x,y-d/2-.22-i*.12,.13-i*.035),(1.05,.3,.14),wall)
def setup():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=True
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='CUDA';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='CUDA'
 s.cycles.device='GPU';s.render.resolution_x=s.render.resolution_y=1024;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.film_transparent=True
 s.world.color=(.35,.35,.35);s.view_settings.view_transform='AgX'
 bpy.ops.object.light_add(type='AREA',location=(-4,-6,10));bpy.context.object.data.energy=1400;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=6
 return s
def render(name):
 s=bpy.context.scene
 mesh=[o for o in s.objects if o.type=='MESH'];points=[o.matrix_world@Vector(v) for o in mesh for v in o.bound_box]
 lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
 center=(lo+hi)/2
 bpy.ops.object.camera_add(location=center+Vector((0,-10,math.sqrt(3)*10)))
 cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';s.camera=cam
 inv=cam.matrix_world.inverted();q=[inv@v for v in points];extent=max(max(v.x for v in q)-min(v.x for v in q),max(v.y for v in q)-min(v.y for v in q));cam.data.ortho_scale=extent*1.22
 target=LOCAL/(name+'.png');s.render.filepath=str(target);start=time.monotonic();bpy.ops.render.render(write_still=True)
 blend=LOCAL/(name+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(blend))
 for p in [target,blend]:(OUT/p.name).write_bytes(p.read_bytes())
 data={'id':name,'width':1024,'height':1024,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'blender':bpy.app.version_string,'camera_elevation':60,'engine':'Cycles CUDA','seconds':time.monotonic()-start,'status':'geometry-guide'}
 (OUT/(name+'.json')).write_text(json.dumps(data,indent=2)+'\n');print('GUIDE_COMPLETE',name,flush=True)
if __name__ == '__main__':
    for world in ['verdant','aether','nexus','pyra']:
     s=setup();stone=mat('Warm stone','d5ccb4');gold=mat('Aged brass','cba34f',.5);dark=mat('Structural dark','29313b',.25);wood=mat('Walnut','563821');leaf=mat('Jade foliage','3e7843');blue=mat('Cyan light','48d9ff',.2,2);amber=mat('Amber windows','ffb849',0,1);purple=mat('Amethyst','8250b3',.3);red=mat('Crimson','932735');basalt=mat('Basalt','34313a');fire=mat('Furnace','ff5820',.1,2)
     if world=='verdant':
      house(0,0,3.6,2.5,1.7,stone,wood,leaf,amber,gold)
      for side in [-1,1]:
       for j in range(7):ball('Ivy leaves',(side*1.8,-1.35,.35+j*.24),(.19,.10,.23),leaf)
      for xx in [-1.3,1.3]:line('Lantern support',(xx,-1.5,1.7),(xx,-1.9,1.7),.035,wood);ball('Amber lantern',(xx,-1.9,1.45),(.14,.14,.22),amber)
     elif world=='aether':
      house(0,0,3.5,2.7,1.8,stone,gold,purple,blue,gold)
      for xx in [-2.0,2.0]:
       cyl('Academy tower',(xx,.6,1.55),.55,3.1,stone)
       for zz in [.3,1.3,2.5,3.0]:cyl('Golden tower ring',(xx,.6,zz),.59,.12,gold)
       cone('Violet roof',(xx,.6,3.75),.75,1.3,purple)
       crystal((xx,.6,4.4),.12,.6,blue)
      crystal((0,.4,3.2),.24,.9,purple)
     elif world=='nexus':
      cube('Laboratory base',(0,0,.15),(4.2,3.0,.3),dark)
      cube('Main white laboratory',(0,0,1.05),(3.7,2.6,1.8),stone,.16)
      for xx in [-1.5,-.75,0,.75,1.5]:window(xx,-1.35,1.1,.43,.8,dark,blue)
      cube('Central entrance',(0,-1.5,.7),(.7,.14,1.3),dark)
      for xx in [-2,2]:
       cube('White fin',(xx,0,1.2),(.25,2.4,2.2),stone)
       cube('Cyan conduit',(xx,-1.26,1.2),(.07,.07,2),blue)
      cyl('Reactor drum',(0,.25,2.2),1,.55,dark)
      cyl('Reactor platform',(0,.25,2.5),1.1,.12,gold)
      crystal((0,.25,2.55),.45,1.7,blue)
      for xx in [-.9,.9]:line('Reactor rails',(xx,.25,2.5),(xx,.25,3.8),.06,stone)
     else:
      cube('Fortress base',(0,0,.16),(5.4,2.9,.32),basalt)
      house(0,0,3.1,2.5,1.8,basalt,gold,red,fire,gold)
      for xx in [-2.0,2.0]:
       cube('Fortress tower',(xx,.1,1.6),(1.2,2.6,3.2),basalt)
       for z in [.35,1.1,2,2.9]:cube('Tower belt',(xx,.1,z),(1.3,2.7,.13),gold)
       roof(xx,.1,3.2,1.6,2.9,.8,red,gold)
       for z in [1.25,2.25]:window(xx,-1.25,z,.25,.5,gold,fire)
       cube('Crimson banner',(xx+.4,-1.35,2.1),(.23,.035,1.25),red)
      cube('Furnace gate',(0,-1.35,.85),(1.05,.1,1.6),fire)
      for xx in [-.44,-.22,0,.22,.44]:cube('Iron portcullis',(xx,-1.43,.85),(.045,.06,1.6),dark)
     render(world+'-guide')
    print('ALL_GUIDES_COMPLETE',flush=True)
