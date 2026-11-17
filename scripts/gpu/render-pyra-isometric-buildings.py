#!/usr/bin/env python3
"""Blender batch: six original Pyra models, one orthographic camera and shared lighting.

blender --background --factory-startup --python script.py -- --contract art-contract.json --buildings buildings.json --output DIR
No pod control, paid generation, character redesign, collision changes or production installation.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument("--contract", type=Path, required=True)
parser.add_argument("--buildings", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--only", default="")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
contract = json.loads(args.contract.read_text())
buildings = json.loads(args.buildings.read_text())
args.output.mkdir(parents=True, exist_ok=True)


def rgb(value):
    def linear(c):
        return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
    return tuple(linear(int(value[i:i+2], 16) / 255) for i in (0, 2, 4))


def material(name, color, metallic=0, roughness=.65, emission=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    c = rgb(color)
    bsdf.inputs['Base Color'].default_value = (*c, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if name in ('basalt','stone_edge','wood','roof','roof_highlight'):
        nodes=m.node_tree.nodes;links=m.node_tree.links
        noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=2.5 if name!='wood' else 5
        noise.inputs['Detail'].default_value=4
        ramp=nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color=(*(v*.42 for v in c),1)
        ramp.color_ramp.elements[1].color=(*(min(1,v*1.5+.012) for v in c),1)
        links.new(noise.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs['Color'],bsdf.inputs['Base Color'])
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.3;bump.inputs['Distance'].default_value=.07
        links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*c, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    return m


def finish(obj, name, mat, bevel=0):
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Soft dressed edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        normal = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
    return obj


def box(name, location, dimensions, mat, bevel=.10):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel)


def cylinder(name, location, radius, depth, mat, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    return finish(bpy.context.object, name, mat, .06)


def beam(name, a, b, radius, mat):
    a, b = Vector(a), Vector(b)
    obj = cylinder(name, (a+b)/2, radius, (b-a).length, mat)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def lantern(x, y, z):
    cylinder('Lantern brass cage', (x,y,z), .38, 1.0, mats['gold'])
    cylinder('Lantern warm glass', (x,y,z), .31, .76, mats['embers'])
    for dx, dy in [(-.28,0),(.28,0),(0,-.28),(0,.28)]:
        beam('Lantern rib', (x+dx,y+dy,z-.5), (x+dx,y+dy,z+.5), .035, mats['iron'])


def stairs(width, front, height=1.5):
    for i in range(4):
        box('Entrance step', (0,front+1.8-i*.45,.15+i*.18), (width,3.6-i*.75,.3+i*.36), mats['stone_edge'])


def roof(width, depth, z, rise=3.6):
    # Curved eaves on a hipped roof, with overlapping courses rather than one flat pyramid.
    for course in range(10):
        t0, t1 = course/10, (course+1)/10
        def ring(t):
            w = width * (1-t*.82)/2
            d = depth * (1-t*.82)/2
            h = z + rise*(t**1.5) + .55*(1-t)**5
            return [(-w,-d,h),(w,-d,h),(w,d,h),(-w,d,h)]
        verts = ring(t0) + ring(t1)
        faces = [(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)]
        mesh=bpy.data.meshes.new('Roof course mesh');mesh.from_pydata(verts,[],faces);mesh.update()
        obj=bpy.data.objects.new('Overlapping terracotta roof course',mesh);bpy.context.collection.objects.link(obj)
        finish(obj,'Roof tile course %02d'%course,mats['roof_highlight'] if course%3==0 else mats['roof'],.035)
        # Tile seams follow the pitch; their rhythm is shared across all buildings.
        if course in (0,3,6,9):
            lower=ring(t0)
            for i in range(4):beam('Brass roof edge',lower[i],lower[(i+1)%4],.055,mats['gold'])
    ridge_z=z+rise
    beam('Roof ridge',(-width*.1,0,ridge_z),(width*.1,0,ridge_z),.18,mats['gold'])
    for sign in [-1,1]:
        beam('Upswept ridge finial',(sign*width*.1,0,ridge_z),(sign*(width*.1+.75),0,ridge_z+.7),.11,mats['gold'])


def shell(width, depth, height, role):
    box('Basalt foundation',(0,0,.6),(width,depth,1.2),mats['basalt'],.22)
    box('Carved foundation rim',(0,0,1.18),(width+.25,depth+.25,.22),mats['gold'],.05)
    box('Warm stone walls',(0,0,height/2+1),(width*.90,depth*.90,height),mats['plaster'],.18)
    for x in [-width*.44,width*.44]:
        for y in [-depth*.44,depth*.44]:
            box('Basalt corner pier',(x,y,height/2+1),(.85,.85,height+.5),mats['basalt'])
            box('Pier capital',(x,y,height+.7),(1.35,1.35,.5),mats['gold'])
    for y in [-depth*.455,depth*.455]:
        for x in [-width*.28,0,width*.28]:
            if y>0 and x==0:continue
            box('Window dark recess',(x,y,height*.63),(2.3,.15,2.5),mats['wood'],.08)
            box('Amber window',(x,y+.03,height*.63),(1.9,.18,2.1),mats['embers'],.04)
            beam('Window crossbar',(x-1.1,y+.15,height*.63),(x+1.1,y+.15,height*.63),.07,mats['gold'])
            beam('Window mullion',(x,y+.15,height*.63-1.15),(x,y+.15,height*.63+1.15),.07,mats['gold'])
    front=depth*.46
    box('Door frame',(0,front+.1,3.1),(4.7,.55,4.7),mats['basalt'],.15)
    box('Door',(0,front+.41,2.9),(3.6,.3,4.0),mats['iron'] if role=='depot' else mats['wood'],.1)
    for x in [-1.6,1.6]:beam('Door bronze band',(x,front+.6,1.2),(x,front+.6,4.6),.08,mats['gold'])
    for x in [-3.4,3.4]:lantern(x,front+.8,5)
    stairs(6,front)
    roof(width+2,depth+2,height+1.1)


def crate(x,y,z=1,scale=1):
    box('Supply crate',(x,y,z),(2*scale,1.7*scale,1.8*scale),mats['wood'])
    for dx in [-.8,.8]:box('Crate iron band',(x+dx*scale,y,z),(.13,1.85*scale,1.9*scale),mats['iron'],.02)


def forge(width,depth):
    # An open working forge, not a closed house with a furnace hidden behind its wall.
    box('Workshop stone foundation',(0,0,.38),(width*.94,depth*.90,.76),mats['basalt'],.16)
    for row in range(11):
        for col in range(14):
            x=(col-6.5)*1.52+(row%2)*.30
            box('Dressed rear basalt block',(x,-depth*.38,.9+row*.65),(1.45,1.05,.59),mats['basalt'],.08)
    for x in [-width*.41,width*.41]:
        for y in [-depth*.34,depth*.35]:
            box('Timber workshop column',(x,y,4.5),(.85,.85,8.0),mats['wood'],.12)
            for z in [1.2,7.6]:box('Bronze column collar',(x,y,z),(1.08,1.08,.38),mats['gold'],.05)
    for y in [-depth*.35,depth*.35]:
        box('Carved cross beam',(0,y,8.0),(width*.87,.75,.85),mats['wood'])
        for x in [-width*.37,width*.37]:
            beam('Braced joinery',(x,y,6.5),(x-math.copysign(2,x),y,7.8),.16,mats['gold'])
    roof(width+1.5,depth+1.5,8.6,4.8)
    # Voussoirs form a genuine open arch; the coals and warm bounce are visible from the camera.
    for side in [-1,1]:
        for row in range(4):box('Furnace arch pier',(side*3.15,-2.0,1.1+row*.7),(1.05,2.8,.64),mats['basalt'],.1)
    for i in range(13):
        a=math.pi*(i+.5)/13
        obj=box('Radial furnace arch stone',(3.15*math.cos(a),-2.0,3.1+3.15*math.sin(a)),(.85,2.8,1.0),mats['stone_edge'],.1)
        obj.rotation_euler.y=math.pi/2-a
    box('Dark furnace back',(0,-3.3,2.5),(5.8,.6,4.0),mats['iron'])
    box('Ember bed',(0,-1.4,1.1),(5.3,3.2,.4),mats['embers'])
    for i in range(11):
        a=i*2.39996
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=.48,location=(1.8*math.cos(a),-1.2+math.sin(a)*.7,1.4+(i%3)*.32))
        obj=finish(bpy.context.object,'Glowing coal',mats['embers']);obj.scale=(1,.7,.7)
    fire_data=bpy.data.lights.new('Forge fire bounce','AREA');fire_data.energy=1800;fire_data.color=(1,.18,.025);fire_data.shape='DISK';fire_data.size=4
    fire=bpy.data.objects.new('Forge fire bounce',fire_data);bpy.context.collection.objects.link(fire);fire.location=(0,-.8,2.3);fire.rotation_euler=(Vector((0,8,1))-fire.location).to_track_quat('-Z','Y').to_euler()
    box('Basalt chimney',(-7,-4,10.7),(3.0,3.0,19.5),mats['basalt'],.22)
    for z in [3,7,11,15,20.2]:box('Chimney carved collar',(-7,-4,z),(3.55,3.55,.45),mats['gold'],.07)
    cylinder('Anvil stone foot',(0,depth*.34,1.15),1.8,1.4,mats['basalt'],8)
    box('Anvil broad foot',(0,depth*.34,2.1),(3.6,2.4,.6),mats['iron'])
    box('Anvil waist',(0,depth*.34,2.75),(2.0,1.4,.9),mats['iron'])
    box('Anvil crown',(0,depth*.34,3.4),(4.3,1.85,.55),mats['iron'])
    bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.6,radius2=.08,depth=1.8,location=(2.9,depth*.34,3.4))
    horn=finish(bpy.context.object,'Forged anvil horn',mats['iron']);horn.rotation_euler.y=math.pi/2
    for x in [-8,8]:
        y=depth*.34
        cylinder('Coopered work barrel',(x,y,1.9),1.35,2.7,mats['wood'],20)
        for z in [.7,1.9,3.1]:cylinder('Barrel iron hoop',(x,y,z),1.4,.18,mats['iron'],24)
        cylinder('Barrel rim',(x,y,3.25),1.42,.12,mats['gold'],24)
        if x>0:
            water=material('Quench water','167789',.4,.12)
            cylinder('Quenching water',(x,y,3.25),1.25,.10,water,32)
    for x in [6.0,7.4,8.8]:
        beam('Tool handle',(x,depth*.12,3.2),(x,depth*.12,6.5),.10,mats['wood'])
        box('Polished hammer head',(x,depth*.12,6.5),(.9,.5,.55),mats['iron'],.10)
    box('Tool rack',(7.4,depth*.12,6.9),(4.6,.6,.55),mats['wood'])
    for x in [-4.8,4.8]:lantern(x,depth*.35,6.5)
    box('Hanging forge sign',(-4,depth*.36,5.7),(2.5,.35,2.8),mats['iron'],.2)
    for x in [-5.4,-2.6]:beam('Sign gilded frame',(x,depth*.39,4.3),(x,depth*.39,7.1),.08,mats['gold'])


def building(role,width,depth):
    if role=='smithy':forge(width,depth);return
    if role=='arena':
        cylinder('Octagonal arena',(0,0,.65),min(width,depth)*.47,1.3,mats['basalt'],8)
        for i in range(8):
            a=i*math.tau/8;x=math.cos(a)*8;y=math.sin(a)*8
            cylinder('Arena rim pillar',(x,y,1.7),.4,2.4,mats['stone_edge'])
            if i%2==0:
                beam('Banner mast',(x,y,1),(x,y,8),.12,mats['gold'])
                box('Red arena banner',(x+.85,y,6),(1.7,.07,2.9),mats['cloth'],.02)
        for x in [-4,4]:
            cylinder('Training dummy foot',(x,0,1.8),.8,2.0,mats['wood'])
            beam('Training dummy arms',(x-1.5,0,3.3),(x+1.5,0,3.3),.2,mats['wood'])
            cylinder('Training dummy head',(x,0,4.2),.6,.9,mats['plaster'])
        stairs(6,8);return
    height={'hall':11,'inn':9,'shop':7,'depot':8}[role]
    shell(width*.86,depth*.83,height,role)
    if role=='hall':
        box('Upper sanctuary',(0,-1,14.4),(width*.49,depth*.46,4.8),mats['basalt'],.2)
        roof(width*.62,depth*.62,17,4.8)
        for x in [-width*.29,width*.29]:
            beam('Ceremonial banner mast',(x,depth*.40,1),(x,depth*.40,12),.16,mats['gold'])
            box('Ceremonial red banner',(x+.95,depth*.40,8.7),(1.9,.12,4.5),mats['cloth'])
    elif role=='inn':
        box('Balcony deck',(0,depth*.31,7.0),(width*.8,depth*.22,.5),mats['wood'])
        for x in range(-7,8,2):beam('Balcony baluster',(x,depth*.43,7.1),(x,depth*.43,8.6),.09,mats['gold'])
        beam('Balcony handrail',(-8,depth*.43,8.6),(8,depth*.43,8.6),.12,mats['wood'])
        crate(-width*.38,-depth*.26)
    elif role=='shop':
        for x in [-width*.27,width*.27]:
            box('Merchant stall',(x,depth*.38,2),(4.5,2.8,2.0),mats['wood'])
            for dx in [-2,2]:beam('Awning post',(x+dx,depth*.48,1),(x+dx,depth*.48,5.3),.09,mats['gold'])
            box('Woven red awning',(x,depth*.42,5.3),(4.8,3.6,.16),mats['cloth'])
            for i in range(5):cylinder('Merchandise jar',(x-1.6+i*.8,depth*.37,3.3),.28,.6,mats['plaster'])
    elif role=='depot':
        for x,y in [(-width*.32,depth*.25),(-width*.32,0),(-width*.32,-depth*.25)]:crate(x,y)
        for x in [-width*.28,width*.28]:box('Vault buttress',(x,0,4.3),(1.2,depth*.88,7),mats['basalt'],.16)


def scene_setup():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=contract['render']['samples'];scene.cycles.use_denoising=True
    preferences=bpy.context.preferences.addons['cycles'].preferences
    preferences.compute_device_type=contract['render']['device'];preferences.get_devices()
    gpus=[]
    for device in preferences.devices:
        device.use=device.type==contract['render']['device']
        if device.use:gpus.append(device.name)
    if not gpus:raise RuntimeError('No requested GPU device available; do not silently burn render time on CPU')
    scene.cycles.device='GPU'
    scene.render.resolution_x=scene.render.resolution_y=contract['camera']['resolution'];scene.render.resolution_percentage=100
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    scene.world.use_nodes=True
    background=scene.world.node_tree.nodes.get('Background');background.inputs['Color'].default_value=(.34,.40,.55,1);background.inputs['Strength'].default_value=.45
    camera_data=bpy.data.cameras.new('Fixed 2 to 1 isometric camera');camera=bpy.data.objects.new('Camera',camera_data);scene.collection.objects.link(camera)
    target=Vector((0,0,contract['camera']['target_height_m']))
    camera.location=target+Vector((100,100,math.sqrt(20000)*math.tan(math.radians(30))))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=contract['camera']['ortho_scale_m'];scene.camera=camera
    light_data=bpy.data.lights.new('Shared warm key','SUN');light=bpy.data.objects.new('Shared warm key',light_data);scene.collection.objects.link(light)
    light.location=Vector(contract['light']['direction'])*10;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
    light_data.energy=contract['light']['strength'];light_data.angle=math.radians(contract['light']['angular_size_degrees']);light_data.color=contract['light']['color']
    fill_data=bpy.data.lights.new('Broad cool workshop fill','AREA');fill_data.energy=32000;fill_data.shape='DISK';fill_data.size=45
    fill=bpy.data.objects.new('Broad cool workshop fill',fill_data);scene.collection.objects.link(fill);fill.location=(30,35,55);fill.rotation_euler=(Vector((0,0,4))-fill.location).to_track_quat('-Z','Y').to_euler();fill_data.color=(.68,.78,1)
    return scene,gpus


manifest={'format':'ki-isometric-buildings-1','contract_sha256':hashlib.sha256(args.contract.read_bytes()).hexdigest(),'blender':bpy.app.version_string,'assets':{}}
existing=args.output/'manifest.json'
if existing.exists():manifest['assets']=json.loads(existing.read_text()).get('assets',{})
for b in buildings:
    role=b['id']
    if args.only and role!=args.only:continue
    scene,gpus=scene_setup()
    mats={name:material(name,color,.65 if name in ['gold','iron'] else 0,.4 if name=='gold' else .7,2.5 if name=='embers' else 0) for name,color in contract['palette'].items()}
    building(role,*b['size'])
    meshes=[o for o in scene.objects if o.type=='MESH']
    ground=box('Shadow catcher',(0,0,-.16),(150,150,.2),mats['stone_edge']);ground.is_shadow_catcher=True;ground.hide_render=True
    target=args.output/role;target.mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(target/'source.blend'))
    scene.render.filepath=str(target/'beauty.png');bpy.ops.render.render(write_still=True)
    ground.hide_render=False
    for obj in meshes:obj.visible_camera=False
    scene.render.filepath=str(target/'shadow.png');bpy.ops.render.render(write_still=True)
    resolution=contract['camera']['resolution'];ppm=resolution/contract['camera']['ortho_scale_m']
    manifest['assets'][role]={'name':b['name'],'beauty':role+'/beauty.png','shadow':role+'/shadow.png','footprint_m':b['size'],'position_m':b['xz'],'origin':[.5,.5+contract['camera']['target_height_m']*math.cos(math.radians(30))/contract['camera']['ortho_scale_m']],'pixels_per_meter':ppm,'runtime_scale':math.sqrt(128)/ppm,'gpu':gpus,'mesh_objects':len(meshes),'beauty_sha256':hashlib.sha256((target/'beauty.png').read_bytes()).hexdigest(),'shadow_sha256':hashlib.sha256((target/'shadow.png').read_bytes()).hexdigest()}
    existing.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print('PYRA_ART_RENDERED',role,flush=True)
