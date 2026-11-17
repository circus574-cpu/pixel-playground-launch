#!/usr/bin/env python3
"""Install a bounded GPU material palette; never changes heights or navigation."""
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT / 'ports/godot-isometric-pyra'
DELIVERY = 'deliveries/pyra-terrain-gpu-20261117'
FAMILIES = {
    'ash': ['fine-warm-ash', 'fine-dark-ash', 'fine-valley-silt', 'fine-lowland-soil'],
    'basalt': ['ground-basalt-gravel', 'mountain-scree', 'lava-cold-crust', 'lava-ember-cracks'],
    'paving': ['road-basalt-pavers', 'road-broken-cobbles'],
    'cliff': ['mountain-cliff', 'mountain-strata', 'pit-inner-rock', 'pit-rim'],
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_bytes(path):
    local = ROOT / path
    if local.exists():
        return local.read_bytes()
    # Allows a sparse checkout without downloading source archives.
    return subprocess.check_output(['git', 'show', ':' + path], cwd=ROOT)


def main():
    delivery = json.loads(source_bytes(DELIVERY + '/manifest.json'))
    index = {p['path']: p for p in json.loads(source_bytes(DELIVERY + '/file-index.json'))}
    selected = {p['category']: p for p in delivery['selected_for_review']}
    output = PROJECT / 'materials/gpu'
    output.mkdir(parents=True, exist_ok=True)
    contract = {'version': 1, 'delivery_commit': '55323a03a90067dbddf524d0a925ad9f57b8d566',
                'resolution': 512, 'families': {}, 'repeat_m': [8, 7, 3, 12],
                'geometry_changed': False, 'height_sha256': sha((PROJECT/'data/height.r32').read_bytes()),
                'control_sha256': sha((PROJECT/'data/control.r32').read_bytes()),
                'walkable_sha256': sha((PROJECT/'data/walkable.u8').read_bytes())}
    for family, categories in FAMILIES.items():
        contract['families'][family] = []
        for category in categories:
            item = selected[category]
            path = item['lod']
            data = source_bytes(DELIVERY + '/' + path)
            assert sha(data) == index[path]['sha256'], path
            from io import BytesIO
            image = Image.open(BytesIO(data)).convert('RGBA')
            assert image.size == (512, 512)
            target = output / (category + '.png')
            image.save(target, optimize=True)
            contract['families'][family].append({'id': item['id'], 'texture': 'res://materials/gpu/' + target.name,
                                                'source': DELIVERY + '/' + path, 'source_sha256': sha(data),
                                                'sha256': sha(target.read_bytes())})
    path = 'transitions/ash-road-1-weights.png'
    data = source_bytes(DELIVERY + '/' + path)
    assert sha(data) == index[path]['sha256']
    from io import BytesIO
    mask = Image.open(BytesIO(data)).convert('RGBA')
    mask.resize((256, 256), Image.Resampling.LANCZOS).save(PROJECT/'data/material-transition.png')
    contract['transition_source_sha256'] = sha(data)
    contract['transition_sha256'] = sha((PROJECT/'data/material-transition.png').read_bytes())

    # Presentation fields derived from the authoritative height; no terrain edits.
    height = np.frombuffer((PROJECT/'data/height.r32').read_bytes(), '<f4').reshape(512, 512)
    dz, dx = np.gradient(height, 2)
    slope = np.sqrt(dx*dx+dz*dz)
    z, x = np.mgrid[-512:512:2, -512:512:2]
    wet = np.exp(-((height-1.5)/7)**2) * np.clip(1-slope, 0, 1)
    forest = np.exp(-((x+270)/115)**2-((z-5)/180)**2) * np.clip(1-slope/1.2, 0, 1)
    fields = np.stack([np.clip(slope/2, 0, 1), np.clip((height+14)/165, 0, 1), wet, forest], axis=-1)
    target = PROJECT/'data/material-environment.png'
    Image.fromarray((fields*255).round().astype('uint8')).save(target)
    contract['environment_sha256'] = sha(target.read_bytes())
    contract['layers'] = sum(map(len, FAMILIES.values()))
    (PROJECT/'data/terrain-materials.json').write_text(json.dumps(contract, indent=2)+'\n')
    print('Installed', contract['layers'], 'layers; source geometry unchanged')


if __name__ == '__main__':
    main()
