#!/usr/bin/env python3
"""Prepare the optional Royal Square prototype and register calibrated Blender sprites."""
import argparse
import hashlib
import json
import runpy
import shutil
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, label

ROOT=Path(__file__).resolve().parents[2]
PROJECT=ROOT/'ports/godot-isometric-pyra'
BASE=PROJECT/'data'
OUT=PROJECT/'studies/pyra-citadel'
LEVEL=16.5
GATE=[-45,-194]
ROAD=[[-54,-106],[-69,-122],[-85,-142],[-88,-160],[-71,-174],[-56,-176],[-45,-183],GATE,[-45,-209]]
PLAZA=[[-68,-181],[-62,-191],[-52,-194],[-38,-192],[-28,-184],[-30,-168],[-42,-162],[-60,-166]]

# Placed models share explicit obstruction boxes. The gate's central span stays open.
PLACEMENTS=[
    ('gate',GATE),
    ('retaining-wall',[-61,-194]),('retaining-wall',[-72,-194]),
    ('retaining-wall',[-29,-194]),('retaining-wall',[-18,-194]),
    ('brazier',[-54,-186]),('brazier',[-36,-186]),
    ('brazier',[-61,-165]),('brazier',[-30,-164]),
]
OBSTACLES=[{'xz':[GATE[0]+side*7.35,GATE[1]],'size':[6,6]} for side in (-1,1)]
OBSTACLES.extend({'xz':point,'size':[11.7,3.2] if role=='retaining-wall' else [2.25,2.25]}
                 for role,point in PLACEMENTS if role!='gate')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fit_terrace():
    for name in ('terrain.json','control.r32','surface.png','weights.png','buildings.json','actors.json'):
        shutil.copyfile(BASE/name,OUT/name)
    config=json.loads((OUT/'terrain.json').read_text())
    h=np.fromfile(BASE/'height.r32','<f4').reshape(512,512)
    walk=np.fromfile(BASE/'walkable.u8','u1').reshape(512,512)!=0
    z,x=np.mgrid[-512:512:2,-512:512:2]
    envelope=np.hypot((x+46)/28,(z+179)/24)
    plaza=np.clip((1.75-envelope)/.75,0,1)
    changed=plaza>0
    height=h*(1-plaza)+LEVEL*plaza
    distance=np.full_like(height,2500)
    axis_height=height.copy()
    levels=[float(h[(ROAD[0][1]+512)//2,(ROAD[0][0]+512)//2]),19,20,19,17,LEVEL,LEVEL,LEVEL,LEVEL]
    for a,b,za,zb in zip(ROAD[:-1],ROAD[1:],levels[:-1],levels[1:],strict=True):
        dx,dz=np.subtract(b,a)
        t=np.clip(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1)
        d=np.hypot(x-a[0]-t*dx,z-a[1]-t*dz)
        axis_height=np.where(d<distance,za+(zb-za)*t,axis_height)
        distance=np.minimum(d,distance)
    # Start the grade gradually from the existing road.
    taper=np.clip(np.hypot(x-ROAD[0][0],z-ROAD[0][1])/16,0,1)
    blend=np.clip((22-distance)/15,0,1)*taper
    height=height*(1-blend)+axis_height*blend
    changed|=blend>0
    height=np.where(changed,gaussian_filter(height,.45),h).astype('<f4')
    walk=np.where(changed,np.hypot(*np.gradient(height,2))<.70,walk)
    height.tofile(OUT/'height.r32')
    walk.astype('u1').tofile(OUT/'walkable.u8')
    open_area=walk.copy()
    for o in OBSTACLES:
        cx,cz=o['xz']; w,d=o['size']
        open_area &= ~((abs(x-cx)<w/2+.8)&(abs(z-cz)<d/2+.8))
    components,_=label(open_area)
    assert components[(50+512)//2,(-40+512)//2]==components[(-209+512)//2,(-45+512)//2]>0
    config['height_range'] = [float(height.min()), float(height.max())]
    config['walkable_percent'] = round(100 * float(walk.mean()), 2)
    config['files'] = {name: digest(OUT / name) for name in config['files']}
    config['citadel']={'plaza':[-45,-178],'gate':GATE,'plaza_height':LEVEL,'ground_patch_samples':int(changed.sum())}
    (OUT/'terrain.json').write_text(json.dumps(config,indent=2,ensure_ascii=False)+'\n')
    layout=runpy.run_path(str(ROOT/'scripts/gpu/design-city-streets.py'))
    layout['bake']('pyra',OUT,{'streets':[('Zakręty Cytadeli',11,ROAD)],'plazas':[('Plac Koronny',PLAZA)],'obstacles':OBSTACLES})
    # A bronze compass rose in the paved surface, aligned in world coordinates.
    from PIL import ImageDraw
    size=1024
    emblem=Image.new('L',(size,size))
    draw=ImageDraw.Draw(emblem)
    cx,cz=467,334
    for radius,width in [(10,2),(8,1)]:
        draw.ellipse((cx-radius,cz-radius,cx+radius,cz+radius),outline=218,width=width)
    for points in [
        [(cx,cz-7),(cx+2,cz-2),(cx,cz+7),(cx-2,cz+2)],
        [(cx-7,cz),(cx-2,cz-2),(cx+7,cz),(cx+2,cz+2)],
    ]:
        draw.polygon(points,fill=225)
    accent_path=OUT/'city-plazas.png'
    mask=Image.open(accent_path).convert('RGB')
    r,g,b=mask.split()
    b=emblem.resize(mask.size,Image.Resampling.LANCZOS)
    Image.merge('RGB',(r,g,b)).save(accent_path)
    manifest_path=OUT/'city-layout.json'
    manifest=json.loads(manifest_path.read_text())
    manifest['plazas_sha256']=digest(accent_path)
    manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')



def bind_models(source, painted_gate):
    pack=json.loads((source/'manifest.json').read_text())
    art=OUT/'art'
    art.mkdir(exist_ok=True)
    bindings={}
    for role,entry in pack['assets'].items():
        image=source/entry['file']
        assert digest(image)==entry['sha256'], role
        image=Image.open(image).convert('RGBA')
        origin=[a*s for a,s in zip(entry['origin'],image.size)]
        crop=image.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox()
        left,top,right,bottom=crop
        cropped=Image.new('RGBA',(right-left+32,bottom-top+32))
        cropped.paste(image.crop(crop),(16,16))
        scale=entry['runtime_scale']
        painted_hash=None
        if role=='gate' and painted_gate is not None:
            painted_hash=digest(painted_gate)
            painted=Image.open(painted_gate).convert('RGBA')
            # Foot measurements are from the painting. Match the existing pier
            # separation in the two screen axes without touching collisions.
            contact_left=np.array([336.,1095.])
            contact_right=np.array([986.,820.])
            center=(contact_left+contact_right)/2
            scale=14.7*8/(contact_right[0]-contact_left[0])
            y_factor=(14.7*4/scale)/abs(contact_right[1]-contact_left[1])
            painted=painted.resize((painted.width,round(painted.height*y_factor)),Image.Resampling.LANCZOS)
            center[1]*=y_factor
            left,top,right,bottom=painted.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox()
            cropped=Image.new('RGBA',(right-left+32,bottom-top+32))
            cropped.paste(painted.crop((left,top,right,bottom)),(16,16))
            origin=center
        path=art/f'{role}.png'
        cropped.save(path,optimize=True)
        bindings[role]={'texture':f'res://studies/pyra-citadel/art/{role}.png',
                        'origin':[(origin[0]-left+16)/cropped.width,(origin[1]-top+16)/cropped.height],
                        'scale':scale,'sha256':digest(path),'source_sha256':entry['sha256'],
                        'painted_source_sha256':painted_hash}
    data={'assets':bindings,'props':[{'role':role,'xz':point} for role,point in PLACEMENTS],'obstacles':OBSTACLES}
    (OUT/'architecture.json').write_text(json.dumps(data,indent=2)+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--renders',required=True,type=Path)
    parser.add_argument('--painted-gate',type=Path)
    args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    fit_terrace()
    bind_models(args.renders,args.painted_gate)
