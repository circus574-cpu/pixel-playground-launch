"""Three deterministic, transparent GPU props replacing failed diffusion outputs."""
from pathlib import Path
import bpy,random,json,math
import render_city_guides as a
ROOT=Path('/workspace/ki-legends-gpu');a.OUT=ROOT/'renders/city-details-v1';a.LOCAL=Path('/opt/ki-legends-gpu/city-details');a.OUT.mkdir(exist_ok=True);a.LOCAL.mkdir(exist_ok=True)
JOBS=[('aether-source','aether','object.ki-source'),('aether-garden','aether','object.garden'),('pyra-basalt','pyra','object.basalt')]
for name,world,binding in JOBS:
 a.setup();stone=a.mat('Ivory stone','c6c1c7');gold=a.mat('Golden details','c49d48',.55);water=a.mat('Turquoise water','27c4cc',.35,.4);purple=a.mat('Amethyst','8944d5',.25,.35);green=a.mat('Jade leaves','296d43');light=a.mat('Flower tips','c4a1ff',0,.15);dark=a.mat('Volcanic basalt','28232a');fire=a.mat('Ember seams','ee5722',0,1.1)
 def torus(loc,radius,thick,mat):
  bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=thick,major_segments=64,minor_segments=8,location=loc);o=bpy.context.object;o.data.materials.append(mat);return o
 if name=='aether-source':
  a.cyl('Stepped foundation',(0,0,.1),1.3,.2,stone,32);a.cyl('Carved basin',(0,0,.25),1.18,.28,stone,32);a.cyl('Magic water',(0,0,.405),1.06,.03,water,64);torus((0,0,.43),1.12,.075,gold)
  a.cyl('Crystal pedestal',(0,0,.55),.27,.3,gold,12);a.crystal((0,0,.85),.22,.75,purple)
  for i in range(12):
   angle=i/12*math.tau;x,y=math.cos(angle)*1.13,math.sin(angle)*1.13;a.cyl('Runic rim pillar',(x,y,.48),.065,.3,stone,8);a.ball('Rune gem',(x,y,.65),(.045,.045,.055),purple)
 elif name=='aether-garden':
  a.cube('Ivory planter',(0,0,.16),(3.2,1.6,.32),stone,.12);a.cube('Inset earth',(0,0,.34),(2.94,1.34,.1),dark,.08)
  for x in [-1.55,1.55]:a.cube('Gold end cap',(x,0,.35),(.055,1.55,.08),gold)
  for i in range(13):
   x=-1.28+(i%7)*.43;y=-.35+(i//7)*.65
   a.line('Flower stem',(x,y,.35),(x,y,.65),.025,green)
   for p in range(5):
    angle=p/5*math.tau;a.ball('Violet petal',(x+math.cos(angle)*.1,y+math.sin(angle)*.1,.68),(.13,.1,.07),purple if i%2 else light)
   a.ball('Golden flower center',(x,y,.7),(.055,.055,.035),gold)
   for side in [-1,1]:o=a.ball('Garden leaf',(x+side*.13,y,.48),(.22,.08,.055),green);o.rotation_euler[1]=side*.6
 else:
  # Layered, imperfect boulders with fine mineral variation and real glowing fractures.
  random.seed(574)
  nodes=dark.node_tree.nodes;links=dark.node_tree.links;p=nodes.get('Principled BSDF');noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=13;noise.inputs['Detail'].default_value=3;ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.008,.006,.01,1);ramp.color_ramp.elements[1].color=(.10,.075,.09,1);links.new(noise.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs[0],p.inputs['Base Color']);bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.3;bump.inputs['Distance'].default_value=.08;links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],p.inputs['Normal'])
  for i,(x,y,z,scale) in enumerate([(-.6,0,.7,(.85,.8,1)),(.35,.3,1,(.8,.8,1.4)),(.8,-.45,.45,(.6,.7,.65)),(-.45,-.65,.32,(.65,.5,.45))]):
   bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,z));o=bpy.context.object;o.name='Carved basalt boulder';o.scale=scale;o.data.materials.append(dark)
   for v in o.data.vertices:v.co*=random.uniform(.91,1.06)
   if i<2:
    a.line('Ember crack',(x-.22,y-.72*scale[1],z-.2),(x+.02,y-.75*scale[1],z+.25),.018,fire);a.line('Ember crack fork',(x+.02,y-.75*scale[1],z+.25),(x+.27,y-.64*scale[1],z+.4),.015,fire)
 a.render(name)
 meta=a.OUT/(name+'.json');data=json.loads(meta.read_text());data.update({'world':world,'binding':binding,'status':'procedural-prop-pending-review'});meta.write_text(json.dumps(data,indent=2)+'\n')
print('CITY_DETAILS_COMPLETE',flush=True)
