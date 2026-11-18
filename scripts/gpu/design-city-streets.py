#!/usr/bin/env python3
"""Bake authored city streets and plazas onto the existing terrain material masks."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_erosion, gaussian_filter, label

ROOT = Path(__file__).resolve().parents[2]/'ports/godot-isometric-pyra'

# Width is full street width. Plazas are intentionally individual polygons.
DESIGNS = {
    'pyra': {
        'streets': [
            ('Trakt Popiołu',13,[(-54,-106),(-61,-72),(-58,-51),(-44,-30),(-50,-3),(-43,23),(-40,50),(-35,79),(-54,95),(-62,116),(-64,135),(-90,165)]),
            ('Droga Żaru',10,[(-40,50),(-5,46),(17,32),(30,12),(44,-6),(50,-22),(62,-22)]),
            ('Obejście Areny',9,[(17,32),(31,49),(50,57),(74,53),(91,53),(118,69),(145,85)]),
            ('Droga Kuźni',10,[(-35,79),(-9,81),(15,78),(31,80),(45,83),(74,76),(91,53)]),
            ('Aleja Przysiąg',9,[(-44,-30),(-28,-35),(-13,-43)]),
            ('Zaułek Gospody',7,[(-43,23),(-57,13),(-70,-3),(-78,-7)]),
        ],
        'plazas': [
            ('Dziedziniec Popiołu',[(-58,42),(-47,34),(-32,35),(-21,43),(-19,54),(-27,64),(-42,67),(-57,59)]),
            ('Plac Żaru',[(25,73),(42,72),(57,76),(61,85),(52,89),(34,86),(25,82)]),
            ('Przedpole Sali Przysiąg',[(-36,-41),(-29,-47),(-11,-47),(-9,-40),(-23,-34),(-38,-35)]),
        ],
    },
    'verdantia': {
        'keep': {0:9,1:7,2:7,3:11,4:7,5:7,6:8,7:8,8:6,9:7},
        'streets': [
            ('Aleja Wierzb',8,[(-40,50),(-57,63),(-60,79),(-49,98)]),
            ('Wschodni Brzeg',7,[(132,38),(153,52),(176,51),(193,44),(221,39)]),
        ],
        'plazas': [
            ('Targ pod Wierzbami',[(-59,43),(-45,36),(-26,37),(-12,47),(-15,60),(-27,66),(-49,62),(-61,56)]),
            ('Plac Przewoźników',[(119,37),(133,39),(143,47),(145,58),(137,66),(124,64),(118,52)]),
            ('Przedpole Domu Wspólnoty',[(-101,-21),(-92,-24),(-80,-21),(-79,-11),(-95,-9),(-105,-13)]),
        ],
    },
    'aetheria': {
        'keep': {0:8,1:8,2:10,3:9,4:8,5:9,6:8,7:7},
        'streets': [
            ('Pasaż Źródeł',9,[(-5,50),(11,58),(25,64),(36,78),(29,91),(14,91),(1,107)]),
            ('Zakręt Tarasów',6,[(-54,-62),(-70,-64),(-77,-77),(-73,-102)]),
        ],
        'plazas': [
            ('Dziedziniec Tysiąca Źródeł',[(-13,48),(-3,42),(9,42),(23,49),(24,62),(16,76),(0,78),(-11,71)]),
            ('Przedpole Rady',[(-122,-34),(-110,-35),(-101,-29),(-100,-16),(-110,-10),(-122,-12)]),
            ('Półka Skupienia',[(-72,-91),(-63,-97),(-49,-94),(-46,-85),(-52,-79),(-68,-81)]),
        ],
    },
    'nexus': {
        'keep': {0:10,1:9,2:12,3:9,4:12,5:9,6:7,7:9,8:8,9:8},
        'streets': [
            ('Łącznik Wymiany',8,[(-40,50),(-18,39),(-6,23),(10,10),(22,13),(23,30),(32,46),(46,57),(61,80)]),
            ('Pętla Regeneracji',8,[(-106,80),(-91,72),(-71,73),(-59,80),(-40,80)]),
        ],
        'plazas': [
            ('Plac Synchronizacji',[(-110,-42),(-93,-44),(-81,-38),(-81,-25),(-96,-14),(-107,-16),(-113,-26)]),
            ('Plac Przeładunku',[(-25,69),(-12,60),(10,58),(25,69),(27,82),(17,93),(-5,94),(-23,84)]),
            ('Pole Kalibracji',[(49,91),(64,89),(74,96),(73,110),(60,119),(48,112)]),
        ],
    },
}


def round_corners(points, amount):
    points = np.asarray(points, dtype=float)
    result = [points[0]]
    for a,b in zip(points,points[1:]):
        result.extend((a+(b-a)*amount,b+(a-b)*amount))
    result.append(points[-1])
    curve = np.asarray(result)
    return curve[np.r_[True,np.linalg.norm(np.diff(curve,axis=0),axis=1)>.001]]


def sample(points):
    return np.concatenate([np.linspace(a,b,max(2,int(np.linalg.norm(b-a))*2))
                           for a,b in zip(points,points[1:])])


def sha(data):
    return hashlib.sha256(data).hexdigest()


def bake(region, destination=None, extension=None):
    path = destination or ROOT/('data' if region=='pyra' else 'studies/'+region)
    base = json.loads((path/'terrain.json').read_text())
    buildings = json.loads((path/'buildings.json').read_text())
    z,x = np.mgrid[-512:512:2,-512:512:2]
    terrain = np.fromfile(path/'walkable.u8',dtype='u1').reshape(512,512)!=0
    open_area = terrain.copy()
    for building in buildings + (extension or {}).get('obstacles',[]):
        px,pz = building['xz']
        w,d = building['size']
        open_area &= ~((abs(x-px)<w/2+.8)&(abs(z-pz)<d/2+.8))
    design = DESIGNS[region]
    streets = [(f'Droga {index+1}', width, base['paths'][index])
               for index,width in design.get('keep',{}).items()]
    streets.extend(design['streets'])
    streets.extend((extension or {}).get('streets',[]))
    if region == 'pyra':
        # Keep the distant branches of the existing paths outside the new streets.
        streets.extend([('Szlak Grani',8,base['paths'][0][1:]),
                        ('Stary Trakt',8,base['paths'][2][1:])])
    pixel = lambda point: ((np.asarray(point)+512)//2).astype(int)
    road_mask = np.zeros((512,512),bool)
    layouts = []
    for name,width,points in streets:
        for amount in (.23,.15,.08):
            curve = round_corners(round_corners(points,amount),amount)
            ix,iz = pixel(sample(curve)).T
            if open_area[iz,ix].all():break
        else:
            bad = sample(curve)[~open_area[iz,ix]][0]
            raise ValueError(f'{region}: {name} is blocked near {bad.round(1).tolist()}')
        img = Image.new('L',(512,512))
        ImageDraw.Draw(img).line([tuple(pt/2+256) for pt in curve],fill=255,width=max(2,round(width/2)),joint='curve')
        road_mask |= np.asarray(img)>0
        layouts.append({'name':name,'width_m':width,'centerline':curve.round(3).tolist()})
    plaza_mask = np.zeros_like(road_mask)
    plazas = design['plazas'] + (extension or {}).get('plazas',[])
    for name,points in plazas:
        img = Image.new('L',(512,512))
        ImageDraw.Draw(img).polygon([tuple(pt) for pt in pixel(points)],fill=255)
        plaza = np.asarray(img)>0
        assert np.any(plaza&road_mask), f'{region}: disconnected plaza {name}'
        assert (plaza&open_area).sum()/plaza.sum() >= .80, f'{region}: plaza blocked {name}'
        plaza_mask |= plaza
    paving = (plaza_mask|road_mask)&open_area
    components,_=label(paving)
    sx,sz=pixel(base['spawn'])
    # Both the footprint check and connectivity use the game's terrain mask.
    assert components[sz,sx]>0,f'{region}: spawn outside public paving'
    main = components==components[sz,sx]
    for street in layouts:
        cx,cz = pixel(sample(np.asarray(street['centerline']))).T
        # Raster edges may round to an adjacent pixel. Every street still has a
        # centerline point in the main connected paving component.
        assert main[cz,cx].any(),f"{region}: isolated street {street['name']}"
    reached=0
    for building in buildings:
        px,pz=building['xz']; w,d=building['size']
        adjacent=(abs(x-px)<w/2+16)&(abs(z-pz)<d/2+16)&open_area
        assert np.any(main&adjacent),f"{region}: no public street near {building['id']}"
        reached+=1
    # Keep surface geology and remove only the old visual street layer.
    original = np.asarray(Image.open(path/'weights.png')).astype(np.float32)/255
    original[:,:,0] += original[:,:,2]
    original[:,:,2] = 0
    cover = gaussian_filter(paving.astype(np.float32),.66)[:,:,None]
    weights = original*(1-cover)+np.array([0,0,1,0])*cover
    Image.fromarray((weights*255).round().astype('uint8')).save(path/'city-weights.png')
    plaza_floor = plaza_mask & open_area
    rim = plaza_floor & ~binary_erosion(plaza_floor, iterations=2)
    accent = np.stack((rim,plaza_floor,np.zeros_like(rim)),axis=-1).astype('uint8')*255
    Image.fromarray(accent).save(path/'city-plazas.png')
    manifest = {'region':region,'streets':layouts,'plazas':[{'name':n,'polygon':p} for n,p in plazas],
                'buildings_with_street_access':reached,'weights_sha256':sha((path/'city-weights.png').read_bytes()),
                'plazas_sha256':sha((path/'city-plazas.png').read_bytes()),
                'geometry_sha256':{n:sha((path/n).read_bytes()) for n in ('height.r32','walkable.u8','control.r32','buildings.json')}}
    (path/'city-layout.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
    print(region,len(streets),'streets',len(plazas),'plazas',reached,'connected building approaches')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--city',choices=DESIGNS)
    args=parser.parse_args()
    for city in (args.city,) if args.city else DESIGNS:
        bake(city)
