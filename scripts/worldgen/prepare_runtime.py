#!/usr/bin/env python3
"""Export only verified browser/runtime data; retain diagnostic evidence in deliveries."""
import argparse
import hashlib
import json
import shutil
import html
import gzip
from pathlib import Path


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--world', type=Path, required=True)
    p.add_argument('--art', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    assert not a.output.exists(), 'Use a new immutable version directory'
    a.output.mkdir(parents=True)
    features = []
    for file in sorted(a.world.glob('*/world.json')):
        name = file.parent.name
        root = a.output / name
        root.mkdir()
        manifest = json.loads((file.parent / 'manifest.json').read_text())
        selected = {}
        for path, expected in manifest['files'].items():
            if Path(path).name in ['collision-fixtures.json', 'engine-navigation.json', 'route-tests.json', 'quality.json', 'clearance-repairs.json', 'navigation-anchors.json']:
                continue
            source = (file.parent / path).resolve()
            assert source.is_relative_to(file.parent.resolve()) and sha(source) == expected
            target = root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            selected[path] = expected
        (root / 'manifest.json').write_text(json.dumps({'format': 'superior-browser-1', 'files': selected}, separators=(',', ':')))
        world = json.loads(file.read_text())
        width, height = world['geometry']['width'], world['geometry']['height']
        points = ' '.join(str(x) + ',' + str(y) for x, y in world['geometry']['outline'])
        svg = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="' + str(round(512 * height / width)) + '" viewBox="0 0 ' + str(width) + ' ' + str(height) + '"><title>' + html.escape(world['name']) + '</title><rect width="100%" height="100%" fill="#243e57"/><polygon points="' + points + '" fill="#637e54" stroke="#bcbb8c" stroke-width="64"/>'
        for town in world['settlements']:
            svg += '<circle cx="' + str(town['x']) + '" cy="' + str(town['y']) + '" r="150" fill="#efd28a"/>'
        (root / 'minimap.svg').write_text(svg + '</svg>')
        features.append({'id': name, 'name': world['name'], 'affinity': world['affinity'],
                         'width': world['geometry']['width'], 'height': world['geometry']['height'],
                         'arrival': world['geometry']['anchor'], 'worldSha256': sha(file)})
    assert len(features) == 10
    art_manifest = json.loads((a.art / 'manifest.json').read_text())
    (a.output / 'art').mkdir(exist_ok=True)
    runtime_art_manifest = {}
    for path, expected in art_manifest.items():
        source = (a.art / path).resolve()
        assert source.is_relative_to(a.art.resolve()) and sha(source) == expected
        relative = path[:-3] if path.endswith('.json.gz') else path
        target = a.output / 'art' / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = gzip.decompress(source.read_bytes()) if path.endswith('.json.gz') else source.read_bytes()
        if path.endswith('feature.art.json'):
            value = json.loads(payload)
            value['chunks'] = [name.removesuffix('.gz') for name in value['chunks']]
            payload = json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()
        target.write_bytes(payload)
        runtime_art_manifest[relative] = hashlib.sha256(payload).hexdigest()
    (a.output / 'art/manifest.json').write_text(json.dumps(runtime_art_manifest, separators=(',', ':')))
    revision = hashlib.sha256(json.dumps(features, sort_keys=True).encode()).hexdigest()
    (a.output / 'index.json').write_text(json.dumps({'format': 'superior-runtime-1', 'revision': revision, 'features': features}, ensure_ascii=False, separators=(',', ':')))
    print(json.dumps({'features': len(features), 'runtimeFiles': sum(1 for p in a.output.rglob('*') if p.is_file()), 'revision': revision}))


if __name__ == '__main__':
    main()
