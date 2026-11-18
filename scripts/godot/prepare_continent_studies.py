#!/usr/bin/env python3
"""Attach approved existing art and selected GPU materials to the local terrain studies."""
import argparse
import hashlib
import json
import subprocess
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = 'ports/godot-pyra'
REV = 'c1930e5cabf9bfa2cd43519c59aabef8b9f06e3e'
MEDIA = 'https://media.githubusercontent.com/media/circus574-cpu/pixel-playground-launch'
ROLES = ('hall', 'inn', 'shop', 'arena', 'smithy', 'depot')
SIZE = [(28,22),(20,16),(18,15),(21,20),(22,18),(20,16)]
STUDIES = {
    'verdantia': {
        'race': 'verdant', 'guide': 'Aira',
        'layout': [(-60,-29),(-6,79),(-99,17),(-75,103),(-122,67),(-8,1)],
        'buildings': ['f1c31d72-verdant-leaf-hall','8f5e282c-verdant-leaf-inn','5a272efe-verdant-leaf-shop','a5819767-verdant-leaf-arena','b71a5ab2-verdant-leaf-smithy','959575c7-verdant-leaf-depot'],
        'prop': 'fe9b1faa-ki-v2-objects-verdant-tree2-0',
        'material': ['ground','waterbank','road','rock'],
    },
    'aetheria': {
        'race': 'aether', 'guide': 'Sora',
        'layout': [(-44,-48),(-114,79),(18,19),(36,-26),(-99,-7),(8,85)],
        'buildings': ['2b002168-aether-painted-hall','ac6ae586-aether-painted-inn','866fc0e8-aether-painted-shop','6d7c1c83-aether-painted-arena','ff1310ee-aether-painted-smithy','806ab11b-aether-painted-depot'],
        'prop': '3587a851-aetheria-continent-snow-pine',
        'material': ['ground','terrace','road','rock'],
    },
    'nexus': {
        'race': 'nexus', 'guide': 'LYRA-7',
        'layout': [(-22,-35),(-105,44),(21,16),(50,61),(-81,99),(-3,108)],
        'buildings': ['cbfb678c-nexus-painted-hall','39d82fa9-ki-v2-buildings-nexus-inn','a5145228-nexus-painted-shop','a0860314-nexus-painted-arena','fc0f86ab-ki-v2-buildings-nexus-smithy','ee32c98c-nexus-painted-depot'],
        'prop': 'fcf607db-nexus-continent-rocks',
        'material': ['ground','waste','road','rock'],
    },
}


def tracked(path):
    content = subprocess.check_output(['git','show',f'{REV}:{SOURCE}/{path}'], cwd=ROOT)
    if content.startswith(b'version https://git-lfs.github.com/spec/v1'):
        oid = content.decode().split('oid sha256:',1)[1].splitlines()[0]
        with urlopen(f'{MEDIA}/{REV}/{SOURCE}/{path}',timeout=30) as response:
            content = response.read()
        if hashlib.sha256(content).hexdigest()!=oid:
            raise ValueError(f'Incorrect source checksum: {path}')
    return content


def attach(folder, key, spec, actor_catalog, wave, halls):
    prefix = f'res://studies/{key}'
    art = folder/'art'
    art.mkdir(exist_ok=True)
    def copy(path):
        data = tracked(path)
        name = Path(path).name
        (art/name).write_bytes(data)
        return f'{prefix}/art/{name}'

    building_data = [
        {'id': role, 'xz': pos, 'size': size, 'texture': copy('assets/objects/'+name+'.webp')}
        for role,pos,size,name in zip(ROLES,spec['layout'],SIZE,spec['buildings'],strict=True)
    ]
    if halls is not None:
        index = tuple(STUDIES).index(key)
        sheet = Image.open(halls).convert('RGBA')
        # Wide transparent gutters in the source separate the three silhouettes.
        sprite = sheet.crop((index*sheet.width//3,0,(index+1)*sheet.width//3,sheet.height))
        sprite = sprite.crop(sprite.getchannel('A').getbbox())
        sprite.thumbnail((736,736),Image.Resampling.LANCZOS)
        texture = Image.new('RGBA',(sprite.width+32,sprite.height+32))
        texture.paste(sprite,(16,16))
        texture.save(art/'new-hall.png',optimize=True)
        hall = building_data[0]
        hall['art'] = {
            'texture':f'{prefix}/art/new-hall.png',
            'origin':[.5,(16+sprite.height-sprite.width*.25)/texture.height],
            'scale':sum(hall['size'])*8/sprite.width,
            'source_sha256':hashlib.sha256(halls.read_bytes()).hexdigest(),
        }
    (folder/'buildings.json').write_text(json.dumps(building_data,indent=2)+'\n')
    definitions = {}
    for role, key_suffix, size in [('hero','hero',112), ('guide','npc.guide',92)]:
        original = actor_catalog[f"{spec['race']}.{key_suffix}"]
        data = dict(original, size=[size,size], clips={})
        for animation in ('idle','walk') if role == 'hero' else ('idle',):
            clip = dict(original['clips'][animation])
            clip['sheet'] = copy(clip['sheet'].removeprefix('res://'))
            data['clips'][animation] = clip
        definitions[role]=data
    (folder/'actors.json').write_text(json.dumps(definitions,indent=2)+'\n')

    config = json.loads((folder/'terrain.json').read_text())
    config.update(guide_name=spec['guide'], decoration=copy('assets/objects/'+spec['prop']+'.webp'))
    if wave is not None:
        (folder/'materials').mkdir(exist_ok=True)
        choices = {}
        by_id = {item['id']:item for item in json.loads((wave/'manifest.json').read_text())['items']}
        for family, suffix in zip(('ash','basalt','paving','cliff'),spec['material'],strict=True):
            material = f'{key}-{suffix}-fine' if suffix=='ground' else f'{key}-{suffix}-1'
            name = 'albedo-512.webp'
            source = (wave/material/name).read_bytes()
            if hashlib.sha256(source).hexdigest()!=by_id[material]['files'][name]['sha256']:
                raise ValueError(f'Incorrect GPU material checksum: {material}')
            with Image.open(BytesIO(source)) as image:
                image.convert('RGB').save(folder/'materials'/f'{family}.png',optimize=True)
            choices[family] = {'id': material, 'sha256': hashlib.sha256(source).hexdigest()}
        config['gpu_sources']=choices
    config['art_revision']=REV
    for path in sorted(folder.rglob('*')):
        if path.is_file() and path.suffix not in ('.import','.uid') and path.name!='terrain.json':
            config['files'][path.relative_to(folder).as_posix()]=hashlib.sha256(path.read_bytes()).hexdigest()
    (folder/'terrain.json').write_text(json.dumps(config,indent=2)+'\n')


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--wave',type=Path,help='Attach verified albedo files from the GPU batch')
    parser.add_argument('--out',required=True,type=Path)
    parser.add_argument('--study',choices=tuple(STUDIES))
    parser.add_argument('--halls',type=Path,help='Original left-to-right transparent hall sheet')
    options=parser.parse_args()
    catalog=json.loads(tracked('data/actors.json'))
    for key,spec in STUDIES.items():
        if options.study and key!=options.study:
            continue
        attach(options.out/key,key,spec,catalog,options.wave,options.halls)
        print('Material and art binding ready:',key)
