#!/usr/bin/env python3
"""Blender Cycles asset batch for the Pyra citadel, using the Godot isometric projection."""
import hashlib
import json
import math
import random
import runpy
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

common_path, contract_path, empty_input, output = map(Path,sys.argv[sys.argv.index('--')+1:])
sys.argv = [str(common_path),'--','--contract',str(contract_path),'--buildings',str(empty_input),'--output',str(output)]
lib=runpy.run_path(str(common_path))
settings=lib['scene_setup'].__globals__
settings['contract']['camera'].update(target_height_m=7,ortho_scale_m=55,resolution=1536)
settings['contract']['render'].update(samples=48)
box,beam,cylinder,material=(lib[f] for f in ('box','beam','cylinder','material'))
rng=random.Random(18112026)
out=output
manifest={'blender':bpy.app.version_string,'projection':'yaw 45, elevation 30','assets':{}}


def tower(x):
    box('Foundation', (x,0,.5),(6,6,1),palette['basalt'])
    for row in range(9):
        for col in range(3):
            dx=(col-1)*1.63+.13*(row%2)
            tone=stone[(row*2+col)%len(stone)]
            box('Hand dressed facade', (x+dx,2.50,1.4+row*.94),(1.61,.63,.93),tone,.08)
            box('Return ashlar',(x+2.53,dx,1.4+row*.94),(.58,1.63,.91),tone,.08)
    box('Tower core',(x,0,4.7),(4.95,4.95,8.7),palette['basalt'],.16)
    box('Cornice',(x,0,9.14),(5.8,5.8,.55),palette['stone_edge'])
    box('Bronze seam',(x,0,9.51),(5.65,5.65,.12),palette['gold'])
    existing = set(bpy.context.scene.objects)
    lib['roof'](5.2,5.2,9.7,3.05)
    for tile in set(bpy.context.scene.objects)-existing:
        tile.location.x += x
    for dx in [-1.55,1.55]:
        box('Copper throat',(x+dx,2.86,5.48),(.9,.19,2.05),palette['gold'],.09)
        box('Arrow slit',(x+dx,2.97,5.48),(.54,.08,1.74),palette['iron'],.07)
    box('Banner roll',(x,3.05,8.33),(2.4,.28,.21),palette['gold'],.07)
    box('Crimson pennant',(x,3.05,6.72),(1.76,.12,3.1),palette['cloth'],.08)
    box('Hem',(x,3.13,5.24),(1.77,.1,.17),palette['gold'],.035)
    lib['lantern'](x,3.02,3.25)


def gate():
    for x in (-7.35,7.35):tower(x)
    # Two offset stone arches, open between them. The shapes frame the passage.
    for y in (1.83,-.88):
        for side in (-1,1):
            for i in range(5):
                box('Arch jamb',(side*4.26,y,.58+i*1.13),(1.32,1.33,1.09),stone[(i+1)%len(stone)],.11)
        for i in range(15):
            angle=(i+.5)*math.pi/15
            x=4.26*math.cos(angle);z=5.61+4.26*math.sin(angle)
            obj=box('Cut voussoir',(x,y,z),(1.50,1.33,.86),stone[i%len(stone)],.09)
            obj.rotation_euler.y=-(angle+math.pi/2)
    box('Keystone gold shield',(0,2.57,10.22),(1.38,.62,1.60),palette['gold'],.17)
    box('Parapet above arch',(0,.25,11.02),(11.6,4.1,1.1),palette['basalt'],.12)
    for x in (-4.5,-2.25,0,2.25,4.5):
        box('Merlon',(x,2.03,11.76),(1.16,.85,.75),palette['stone_edge'],.11)
    box('Red inlay under parapet',(0,2.4,10.78),(10.9,.18,.32),palette['roof_highlight'])


def wall():
    box('Footing',(0,0,.3),(11.7,3.0,.6),palette['basalt'])
    for row in range(4):
        # alternating joints without overhanging the footprint.
        ends=[-5.8]+([-4.45,-1.48,1.48,4.45] if row%2 else [-2.91,0,2.91])+[5.8]
        for i,(a,b) in enumerate(zip(ends,ends[1:])):
            box('Retaining masonry',((a+b)/2,0,.95+row*.73),(b-a-.06,2.24-row*.11,.72),stone[(row+i)%len(stone)],.09)
    for x in (-4.35,-1.45,1.45,4.35):
        box('Cap stone',(x,0,3.93),(2.84,2.66,.48),palette['stone_edge'],.1)
    for x in (-5.0,5.0):
        box('Buttress',(x,1.03,1.6),(1.13,1.17,2.66),palette['basalt'])


def brazier():
    for z,width in ((.2,2.25),(.57,1.72),(.93,1.35)):
        box('Basalt pedestal',(0,0,z),(width,width,.38),palette['basalt'])
    cylinder('Tapered support',(0,0,1.61),.51,1.11,palette['stone_edge'],8)
    cylinder('Bronze fire bowl',(0,0,2.24),1.02,.37,palette['gold'],16)
    cylinder('Glowing coals',(0,0,2.47),.79,.12,palette['embers'],16)
    for i in range(8):
        x,y=(rng.uniform(-.56,.56),rng.uniform(-.55,.55))
        box('Coals, dark edge',(x,y,2.51),(rng.uniform(.12,.24),.16,.14),stone[i%len(stone)],.04)


for name,create in [('gate',gate),('retaining-wall',wall),('brazier',brazier)]:
    scene,gpus=lib['scene_setup']()
    palette={key:material(key,color,.58 if key=='gold' else .07,.5 if key=='gold' else .72,1.65 if key=='embers' else 0)
             for key,color in settings['contract']['palette'].items()}
    settings['mats']=palette
    stone=[material('basalt',shade,roughness=.86) for shade in ('332b34','443643','3a303b','4f3d48','392e35')]
    create()
    target=out/name
    target.mkdir(exist_ok=True)
    png=target/'source.png'
    scene.render.filepath=str(png)
    bpy.ops.wm.save_as_mainfile(filepath='/opt/ki-pyra-citadel/'+name+'.blend')
    bpy.ops.render.render(write_still=True)
    origin=world_to_camera_view(scene,scene.camera,Vector((0,0,0)))
    manifest['assets'][name]={'file':str(png.relative_to(out)),'sha256':hashlib.sha256(png.read_bytes()).hexdigest(),
                             'origin':[origin.x,1-origin.y],'runtime_scale':math.sqrt(128)*55/1536,
                             'gpu':gpus,'mesh_objects':sum(o.type=='MESH' for o in scene.objects)}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('CITADEL_DONE',name,flush=True)
