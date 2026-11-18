#!/usr/bin/env python3
"""Prepare the optional Royal Square prototype and register calibrated Blender sprites."""
import argparse
import hashlib
import json
import runpy
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
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


# A watch post by the bend, a market terrace and homes off the main approach.
DISTRICT = [
    ('west-watch', 'Wartownia Zakrętu', 'watch', [-91, -177], [12, 10], 18),
    ('west-home', 'Dom Miedziarza', 'home', [-128, -124], [11, 10], 19),
    ('outer-home', 'Dom przy Trakcie', 'home', [-102, -120], [13, 11], 19),
    ('guild', 'Hala Kupców', 'guild', [-43, -147], [22, 16], 17),
    ('market', 'Podcienia Targowe', 'arcade', [-24, -164], [17, 9], 16.5),
    ('market-home', 'Dom Tkaczy', 'home', [-18, -137], [12, 10], 17),
    ('north-watch', 'Straż przed Cytadelą', 'watch', [-65, -213], [12, 10], 16.5),
]
DISTRICT_STREETS = [
    ('Łuk Kupców', 8, [[-85,-142],[-72,-144],[-63,-155],[-52,-162],[-40,-162],[-38,-171],[-45,-183]]),
    ('Zaułek Miedziarza', 7, [[-69,-122],[-82,-125],[-90,-134],[-91,-146],[-88,-160]]),
]
STREET_LAMPS = [[-78,-136],[-81,-163],[-64,-162],[-34,-171],[-50,-206]]
MARKET_COURT = [[-63,-154],[-54,-160],[-52,-163],[-36,-164],[-34,-159],[-38,-157],[-55,-156]]
GROVES = [[-124,-111],[-118,-102],[-138,-134],[-108,-173],[-104,-180],[-13,-187],[-8,-185],[-6,-147]]

OBSTACLES.extend({'xz': point, 'size': size} for _, _, _, point, size, _ in DISTRICT)
OBSTACLES.extend({'xz': point, 'size': [2.2, 2.2]} for point in STREET_LAMPS)


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
    for _, _, _, (px, pz), (width, depth), level in DISTRICT:
        distance_to_wall = np.maximum(abs(x - px) - width / 2, abs(z - pz) - depth / 2)
        pad = np.clip((12 - distance_to_wall) / 10, 0, 1)
        height = height * (1 - pad) + level * pad
        changed |= pad > 0
    for (_, _, points), levels in zip(DISTRICT_STREETS, [[20,19,18,17,17,16.5,16.5], [19,19,19,19,19]], strict=True):
        distance = np.full_like(height, 2500)
        grade = height.copy()
        for a,b,za,zb in zip(points[:-1],points[1:],levels[:-1],levels[1:],strict=True):
            dx,dz=np.subtract(b,a)
            t=np.clip(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1)
            d=np.hypot(x-a[0]-t*dx,z-a[1]-t*dz)
            grade=np.where(d<distance,za+(zb-za)*t,grade)
            distance=np.minimum(d,distance)
        branch = np.clip((9 - distance) / 5, 0, 1)
        height = height * (1 - branch) + grade * branch
        changed |= branch > 0
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
    for name, _, _, (px, pz), (w, d), _ in DISTRICT:
        apron = (abs(x-px) < w/2+9) & (abs(z-pz) < d/2+9)
        assert np.any(apron & (components == components[(50+512)//2,(-40+512)//2])), name
    config['height_range'] = [float(height.min()), float(height.max())]
    config['walkable_percent'] = round(100 * float(walk.mean()), 2)
    config['files'] = {name: digest(OUT / name) for name in config['files']}
    config['citadel']={'plaza':[-45,-178],'gate':GATE,'plaza_height':LEVEL,'ground_patch_samples':int(changed.sum())}
    (OUT/'terrain.json').write_text(json.dumps(config,indent=2,ensure_ascii=False)+'\n')
    layout=runpy.run_path(str(ROOT/'scripts/gpu/design-city-streets.py'))
    layout['bake']('pyra',OUT,{'streets':[('Zakręty Cytadeli',11,ROAD)]+DISTRICT_STREETS,'plazas':[('Plac Koronny',PLAZA),('Dziedziniec Kupców', MARKET_COURT)],'obstacles':OBSTACLES})
    # A bronze compass rose in the paved surface, aligned in world coordinates.
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



def bind_district(sheet_path, art, bindings):
    sheet = Image.open(sheet_path).convert('RGBA')
    source_sha = digest(sheet_path)
    # Crop bounds and manually identified ground contacts in the source sheet.
    sprites = {
        'watch': ((0, 0, 600, 635), (330, 562), (12, 10)),
        'guild': ((610, 0, 1254, 635), (929, 483), (22, 16)),
        'home': ((0, 635, 600, 1254), (324, 1135), (12, 10)),
        'arcade': ((610, 635, 1254, 1254), (931, 1120), (17, 9)),
    }
    for role, (rect, (x, y), size) in sprites.items():
        piece = sheet.crop(rect)
        box = piece.getchannel('A').point(lambda a: 255 if a > 20 else 0).getbbox()
        left, top = rect[0] + box[0], rect[1] + box[1]
        piece = piece.crop(box)
        width, height = piece.size
        path = art / f'{role}.webp'
        piece.save(path, lossless=True)
        binding = {
            'texture': f'res://studies/pyra-citadel/art/{path.name}',
            'origin': [(x - left) / width, (y - top) / height],
            'scale': 8 * sum(size) / width,
            'sha256': digest(path),
            'source_sha256': source_sha,
        }
        if role == 'home':
            binding['chimney_uv'] = [(443 - left) / width, (662 - top) / height]
        bindings[role] = binding


def bind_models(source, painted_gate, streets, district_sheet):
    pack=json.loads((source/'manifest.json').read_text())['assets']
    street_asset=json.loads((streets/'manifest.json').read_text())['assets']
    pack.update({role: {**entry, 'file': streets / entry['file']} for role, entry in street_asset.items()})
    art=OUT/'art'
    art.mkdir(exist_ok=True)
    bindings={}
    for role,entry in pack.items():
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
    props = [{'role':role,'xz':point} for role,point in PLACEMENTS]
    props.extend({'role': 'street-lantern', 'xz': point, 'size': [2.2, 2.2], 'flame_m': 6.0}
                 for point in STREET_LAMPS)
    bind_district(district_sheet, art, bindings)
    props.extend({'id': key, 'name': name, 'role': role, 'xz': point, 'size': size, 'entry': 'closed'}
                 for key, name, role, point, size, _ in DISTRICT)
    data={'assets':bindings,'props':props,'obstacles':OBSTACLES,
          'groves': GROVES, 'camera_bounds': {'center': [-65, -159], 'radii': [89, 82]}}
    (OUT/'architecture.json').write_text(json.dumps(data,indent=2)+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--renders',required=True,type=Path)
    parser.add_argument('--painted-gate',type=Path)
    parser.add_argument('--street-renders',required=True,type=Path)
    parser.add_argument('--district-sheet',required=True,type=Path)
    args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    fit_terrace()
    bind_models(args.renders,args.painted_gate,args.street_renders.resolve(),args.district_sheet)
