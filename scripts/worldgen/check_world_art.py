#!/usr/bin/env python3
"""Verify assembled presentation against actual source geometry, not recommended art footprints."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path


def read(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--world', required=True, type=Path)
    p.add_argument('--art', required=True, type=Path)
    a = p.parse_args()
    files = read(a.art / 'manifest.json')
    for name, sha in files.items():
        path = (a.art / name).resolve()
        assert path.is_relative_to(a.art.resolve()), name
        assert hashlib.sha256(path.read_bytes()).hexdigest() == sha, name
    catalog = read(a.art / 'assets.json')
    checked = 0
    doors = 0
    for source in sorted(a.world.glob('*/world.json')):
        world = read(source)
        feature = world['feature']
        art = read(a.art / feature / 'feature.art.json')
        assert art['sourceWorldSha256'] == hashlib.sha256(source.read_bytes()).hexdigest()
        for chunk in (source.parent / 'chunks').glob('*.json'):
            projection = read(a.art / feature / 'chunks' / (chunk.stem + '.art.json.gz'))
            assert projection['sourceChunkSha256'] == hashlib.sha256(chunk.read_bytes()).hexdigest()
            original = {o['id']: o for o in read(chunk)['objects']}
            assert len(original) == len(projection['objects'])
            assert set(original) == {o['id'] for o in projection['objects']}
            for o in projection['objects']:
                old = original[o['id']]
                assert all(o[k] == old[k] for k in ['x', 'y', 'solid']), o['id']
                assert o['footprint'] == old.get('footprint'), o['id']
                assert o['binding'] in catalog and o['width'] > 0 and o['height'] > 0, o['id']
                assert o['collisionPolicy'] == 'read-original-world-only'
                checked += 1
        originals = {b['id']: b for b in world['buildings']}
        assert set(originals) == {b['id'] for b in art['buildings']}
        for b in art['buildings']:
            assert b['door'] == originals[b['id']]['door']
            assert b['footprint'] == originals[b['id']]['footprint']
            doors += 1
        accepted = world['acceptedSource']
        if accepted:
            old = {b['objectId']: b for b in accepted['city']['buildings']}
            assert set(old) == {b['id'].removeprefix('accepted-') for b in art['acceptedCityBuildings']}
            for b in art['acceptedCityBuildings']:
                original = old[b['id'].removeprefix('accepted-')]
                assert b['door'] == {axis: original['door'][axis] + world['sourceOffset'][axis] for axis in ['x', 'y']}
                doors += 1
    print(json.dumps({'passed': True, 'sourcePropPositionsAndColliders': checked,
                      'buildingDoors': doors, 'verifiedArtFiles': len(files)}))


if __name__ == '__main__':
    main()
