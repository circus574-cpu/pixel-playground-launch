#!/usr/bin/env python3
"""Bind installed art to immutable browser-world data. Presentation only; no scene activation."""
import argparse
import concurrent.futures
import gzip
import hashlib
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    path.write_bytes(gzip.compress(payload, mtime=0) if path.suffix == '.gz' else payload)


def export_input(repo, target):
    kit_path = repo / 'docs/world-asset-kit.json'
    imported_path = repo / 'src/game/assets/imported.json'
    kit = json.loads(kit_path.read_text())
    packs = json.loads(imported_path.read_text())
    assets, bindings = {}, {}
    for pack in packs:
        assets.update({a['id']: a for a in pack['assets']})
        bindings.update(pack.get('renderBindings', {}))
    resolved = {}
    for entry in kit['objects'] + kit['terrains']:
        key = entry['binding']
        assert bindings[key]['asset'] == entry['asset'], key
        asset = assets[entry['asset']]
        path = (repo / 'public' / asset['url'].lstrip('/')).resolve()
        assert path.is_relative_to((repo / 'public/game/assets').resolve()), key
        assert path.is_file(), path
        assert [asset['width'], asset['height']] == entry['pixels'], key
        if key.startswith('object.') and entry.get('placement'):
            p = entry['placement']
            assert p and p['width'] > 0 and p['height'] > 0, key
            assert 0 <= p['anchorX'] <= 1 and 0 <= p['anchorY'] <= 1, key
        resolved[key] = {**entry, 'url': asset['url'], 'sha256': digest(path)}
    save(target, {'format': 'superior-art-input-1', 'kitSha256': digest(kit_path),
                  'importedSha256': digest(imported_path), 'entries': resolved})


PALETTES = {
    'swamp': {
        'tree': ['biome-swamp.twisted-mangrove-tree', 'biome-swamp.dead-swamp-tree-with-hanging-moss', 'biome-swamp.tree-with-hanging-vines'],
        'bush': ['biome-swamp.cluster-of-cattails', 'biome-swamp.cluster-of-glowing-mushrooms'],
        'rock': ['biome-swamp.bog-boulder'], 'crystal': ['crystal']},
    'mountain': {
        'tree': ['biome-mountain.mountain-pine-tree'],
        'bush': ['biome-mountain.stone-cairn'],
        'rock': ['biome-mountain.boulder-pile', 'biome-mountain.cliff-outcrop', 'biome-mountain.snowy-rock-ledge'],
        'crystal': ['biome-mountain.an-ore-vein-rock']},
    'forest': {
        'tree': ['biome-forest.tall-broadleaf-oak-tree', 'biome-forest.birch-tree-with-white-bark', 'biome-forest.tall-pine-tree'],
        'bush': ['biome-forest.flowering-bush', 'biome-forest.tall-fern-cluster', 'biome-forest.cluster-of-mushrooms'],
        'rock': ['biome-forest.mossy-boulder'], 'crystal': ['crystal']},
    'snow': {
        'tree': ['biome-snow.snow-covered-pine-tree', 'biome-snow.frozen-dead-tree'],
        'bush': ['biome-snow.snow-mound-with-a-lantern'],
        'rock': ['biome-snow.snowy-boulder', 'biome-snow.glacier-ice-block'],
        'crystal': ['biome-snow.an-ice-crystal-cluster', 'biome-snow.tall-ice-spire-cluster']},
    'desert': {
        'tree': ['biome-desert.tall-saguaro-cactus', 'biome-desert.dry-dead-tree'],
        'bush': ['biome-desert.sun-bleached-skull-and-ribs'],
        'rock': ['biome-desert.sandstone-spires', 'biome-desert.sand-dune-with-a-bone'],
        'crystal': ['biome-desert.salt-crystal-formation']},
    'volcanic': {
        'tree': ['biome-volcanic.dead-charred-tree'], 'bush': ['biome-volcanic.bone-pile'],
        'rock': ['biome-volcanic.lava-rock-cluster-with-glowing-cracks', 'biome-volcanic.basalt-column-cluster'],
        'crystal': ['biome-volcanic.an-obsidian-shard-formation']},
    'tech': {
        'tree': ['nexus-city.tree'], 'bush': ['tech-garden'],
        'rock': ['basalt'], 'crystal': ['crystal']},
}
BIOMES = {'verdant': ['forest', 'forest', 'mountain', 'swamp'], 'aether': ['forest', 'forest', 'mountain', 'snow'],
          'nexus': ['tech', 'tech', 'desert', 'desert'], 'pyra': ['volcanic'] * 4}
GROUND = {'forest': 'terrain.nature-meadow-grass', 'snow': 'terrain.nature-snow',
          'swamp': 'terrain.nature-forest-floor', 'mountain': 'terrain.nature-cliff-rock',
          'desert': 'terrain.nature-sand-beach', 'volcanic': 'terrain.nature-ash-ground',
          'tech': 'terrain.nexus-ground'}
SERVICES = {'shop': 'market', 'hall': 'hall', 'inn': 'inn', 'smithy': 'smithy',
            'depot': 'depot', 'arena': 'arena', 'house': 'house', 'residence': 'house'}
PYRA = {'market': 'market-stall', 'hall': 'hall-council', 'inn': 'inn-tavern',
        'smithy': 'smithy-forge', 'depot': 'depot-warehouse', 'arena': 'arena-dojo', 'house': 'house-small'}


# Opt-in art set "ki-v2" (packs ki-v2-terrain / ki-v2-objects, switch ?ki-world-v2=1):
# per-continent painted ground per biome index and the matching freestanding props.
KI_V2_GROUND = ['grass', 'forest', 'mountain', 'wetland']
KI_V2_OVERRIDE = {('pyra', 3): 'terrain.nature-lava-crust'}  # Pyra's low wet ground is a crusted lava field
KI_V2_KINDS = {'tree': ['oak', 'tree2', 'pine'], 'bush': ['bush', 'fern', 'flowerbush', 'mushrooms', 'reeds'],
               'rock': ['boulder', 'rocks', 'stump', 'log']}


def ki_v2_art(affinity, entries):
    ground = [KI_V2_OVERRIDE.get((affinity, i), 'terrain.ki-v2-%s-%s-0' % (affinity, g)) for i, g in enumerate(KI_V2_GROUND)]
    props = {}
    for kind, names in KI_V2_KINDS.items():
        props[kind] = sorted(k[len('object.'):] for k in entries if k.startswith('object.ki-v2-objects.%s-' % affinity)
                             and k.rsplit('.', 1)[1][len(affinity) + 1:].rsplit('-', 1)[0] in names)
        assert props[kind], (affinity, kind)
    return ground, 'terrain.ki-v2-%s-sea-0' % affinity, props


KI_V2_LANDMARKS = {'verdant': ['fountain', 'bridge', 'cottage', 'forge'], 'pyra': ['fortress', 'war-shrine', 'altar', 'statue'],
                   'aether': ['sanctum', 'archive', 'observatory', 'spring'], 'nexus': ['lab', 'reactor', 'terminal', 'monolith']}


def ki_v2_landmarks(feature, affinity, entries):
    """Famous places of Argon's quests as standing landmarks at their v2 spots (presentation only)."""
    places = json.loads((ROOT / 'src/game/worlds/v2Places.generated.json').read_text()).get(feature)
    out = []
    for (fid, f), name in zip((places or {}).get('famous', {}).items(), KI_V2_LANDMARKS.get(affinity, [])):
        key = 'object.ki-v2-landmarks.%s-%s' % (affinity, name)
        if key not in entries: continue
        e = entries[key]
        out.append({'id': 'landmark-' + fid, 'kind': 'landmark', 'asset': key[len('object.'):], 'binding': key,
                    'x': f['x'], 'y': f['y'], 'width': 760, 'height': round(760 * e['pixels'][1] / e['pixels'][0]),
                    'anchorX': 0.5, 'anchorY': 0.9, 'layer': 'objects', 'solid': False, 'footprint': None,
                    'collisionPolicy': 'presentation-only'})
    return out


# Standing relief for the painted set: (asset, display width) per land; the first entry marks the
# biggest ranges (peaks, volcanoes), the rest fill slopes. Presentation only, collision unchanged.
KI_V2_RELIEF = {
    'verdant': [('biome-mountain.tall-rocky-mountain-peak', 1300), ('nature.mountain-peak', 1100),
                ('biome-mountain.cliff-outcrop', 520), ('biome-mountain.rock-with-a-small-waterfall', 460),
                ('biome-mountain.boulder-pile', 320), ('biome-mountain.mountain-pine-tree', 300)],
    'aether': [('biome-snow.snowy-mountain-peak', 1300), ('nature.mountain-peak', 1100),
               ('biome-mountain.snowy-rock-ledge', 520), ('biome-mountain.rock-with-a-small-waterfall', 460),
               ('biome-snow.snow-covered-pine-tree', 300), ('biome-mountain.stone-cairn', 220)],
    'nexus': [('nature.mountain-peak', 1200), ('biome-mountain.tall-rocky-mountain-peak', 1100),
              ('biome-mountain.cliff-outcrop', 520), ('biome-mountain.an-ore-vein-rock', 340),
              ('biome-mountain.boulder-pile', 320), ('biome-volcanic.basalt-column-cluster', 360)],
    'pyra': [('biome-volcanic.smoking-volcano', 1500), ('biome-volcanic.smoking-volcano', 1200),
             ('biome-volcanic.basalt-column-cluster', 480), ('biome-volcanic.magma-pool-rim', 420),
             ('biome-volcanic.sulfur-vent-with-yellow-crust', 300), ('biome-mountain.cliff-outcrop', 480)],
}
KI_V2_LAVA = ['biome-volcanic.magma-pool-rim', 'biome-volcanic.sulfur-vent-with-yellow-crust', 'biome-volcanic.basalt-column-cluster']


def ki_v2_relief(region, affinity, entries):
    import numpy as np
    from scipy import ndimage
    world = json.loads((region / 'world.json').read_text())
    cw, ch = world['geometry']['width'] // 32, world['geometry']['height'] // 32
    biome = np.full((ch, cw), 255, np.uint8); flags = np.zeros((ch, cw), np.uint8)
    def unrle(runs, w, h):
        return np.concatenate([np.full(n, v, np.uint8) for v, n in runs]).reshape(h, w)
    for path in (region / 'chunks').glob('*.json'):
        c = json.loads(path.read_text()); t = c['terrain']; x, y = c['x'] // 32, c['y'] // 32
        biome[y:y + t['height'], x:x + t['width']] = unrle(t['biome'], t['width'], t['height'])
        flags[y:y + t['height'], x:x + t['width']] = unrle(t['flags'], t['width'], t['height'])
    walk = (flags & 1) > 0; safe = ndimage.binary_dilation((flags & 2) > 0, iterations=40)
    rng = random.Random(sum(map(ord, region.name)))
    out = []
    def place(asset, width, cy, cx, n):
        key = 'object.' + asset
        if key not in entries: return
        px = entries[key]['pixels']
        out.append({'id': '%s-relief-%d' % (region.name, n), 'kind': 'relief', 'asset': asset, 'binding': key,
                    'x': int(cx * 32 + 16), 'y': int(cy * 32 + 16), 'width': width, 'height': round(width * px[1] / px[0]),
                    'anchorX': 0.5, 'anchorY': 0.9, 'layer': 'objects', 'solid': False, 'footprint': None,
                    'collisionPolicy': 'presentation-only'})
    kit = KI_V2_RELIEF.get(affinity, [])
    mount = (biome == 2) & walk & ~safe
    lab, n = ndimage.label(mount); n_obj = 0
    for comp in range(1, n + 1):
        cells = np.argwhere(lab == comp)
        if len(cells) < 300: continue
        inner = ndimage.distance_transform_edt(lab == comp)
        cy, cx = np.unravel_index(np.argmax(np.where(lab == comp, inner, 0)), inner.shape)
        big = kit[0] if len(cells) > 4000 else kit[1]
        place(big[0], big[1], cy, cx, n_obj); n_obj += 1
        for _ in range(min(40, len(cells) // 500)):
            y, x = cells[rng.randrange(len(cells))]
            a, w = kit[rng.randrange(2, len(kit))]
            place(a, w, y, x, n_obj); n_obj += 1
    if affinity == 'pyra':
        lava = (biome == 3) & walk & ~safe; cells = np.argwhere(lava)
        for _ in range(min(120, len(cells) // 800)):
            y, x = cells[rng.randrange(len(cells))]
            place(KI_V2_LAVA[rng.randrange(len(KI_V2_LAVA))], 360, y, x, n_obj); n_obj += 1
    return out


# Monster camps (landscape.py 'camps'): props around each camp centre, offsets in world units.
KI_V2_CAMP = [('bonfire', 0, 0, 220), ('tent', -320, -180, 420), ('tent', 300, -220, 420), ('totem', -60, -360, 260),
              ('crates', 180, 140, 260), ('banner', -220, 120, 220)]


def ki_v2_camps(region, affinity, entries):
    world = json.loads((region / 'world.json').read_text()); out = []
    for camp in world.get('camps', []):
        for i, (prop, dx, dy, width) in enumerate(KI_V2_CAMP):
            key = 'object.ki-v2-camps.%s-%s' % (affinity, prop)
            if key not in entries: continue
            px = entries[key]['pixels']
            out.append({'id': '%s-%d' % (camp['id'], i), 'kind': 'camp', 'asset': key[len('object.'):], 'binding': key,
                        'x': camp['x'] + dx, 'y': camp['y'] + dy, 'width': width, 'height': round(width * px[1] / px[0]),
                        'anchorX': 0.5, 'anchorY': 0.9, 'layer': 'objects', 'solid': False, 'footprint': None,
                        'collisionPolicy': 'presentation-only'})
    return out


def build_feature(browser, output, feature, source, art_set='default'):
    region = browser / feature
    manifest = json.loads((region / 'manifest.json').read_text())
    for name, sha in manifest['files'].items():
        path = (region / name).resolve()
        assert path.is_relative_to(region.resolve()), name
        assert digest(path) == sha, name
    world = json.loads((region / 'world.json').read_text())
    entries = source['entries']
    used, counts = set(), {'props': 0, 'buildings': 0, 'resources': 0, 'dungeonEntrances': 0, 'acceptedScenery': 0}
    affinity = world['affinity']
    if art_set == 'ki-v2':
        ki_ground, ki_water, ki_props = ki_v2_art(affinity, source['entries'])

    def instance(obj, asset, category, preserve_display=False):
        # The delivered pine includes neighbouring trees and a rectangular frame.
        # Keep its source, but use the inspected freestanding oak for this preview.
        replacements = {
            'biome-forest.tall-pine-tree': 'biome-forest.tall-broadleaf-oak-tree',
            'biome-forest.birch-tree-with-white-bark': 'biome-forest.tall-broadleaf-oak-tree',
            'biome-forest.tall-fern-cluster': 'biome-forest.flowering-bush',
            'biome-forest.cluster-of-mushrooms': 'biome-forest.flowering-bush',
        }
        asset = replacements.get(asset, asset)
        key = 'object.' + asset
        entry = entries[key]  # Missing art fails the pass, never silently substitutes a collider.
        p = entry.get('placement') or {k: obj[k] for k in ['width', 'height', 'anchorX', 'anchorY']}
        used.add(key)
        counts[category] += 1
        display = {k: p[k] for k in ['width', 'height', 'anchorX', 'anchorY']}
        if preserve_display:
            display.update({k: obj[k] for k in display if k in obj})
        elif obj.get('solid') and obj.get('footprint') and p.get('footprint'):
            fp, suggested = obj['footprint'], p['footprint']
            scale = min(1, fp['width'] / suggested['width'], fp['height'] / suggested['height'])
            display['width'] = round(display['width'] * scale, 3)
            display['height'] = round(display['height'] * scale, 3)
        return {'id': obj['id'], 'kind': obj.get('kind', asset), 'asset': asset, 'binding': key, 'x': obj['x'], 'y': obj['y'],
                **display, 'layer': entry.get('layer', 'objects'),
                'solid': bool(obj.get('solid')), 'footprint': obj.get('footprint'),
                'collisionPolicy': 'read-original-world-only'}

    def service_asset(service):
        # ki-v2: realistic painted buildings (pack ki-v2-buildings) on the same footprints and doors.
        if art_set == 'ki-v2' and 'object.ki-v2-buildings.%s-%s' % (affinity, SERVICES[service]) in entries:
            return 'ki-v2-buildings.%s-%s' % (affinity, SERVICES[service])
        return affinity + '-city.' + (PYRA[SERVICES[service]] if affinity == 'pyra' else SERVICES[service])
    chunk_files = []
    for path in sorted((region / 'chunks').glob('*.json')):
        chunk = json.loads(path.read_text())
        objects = []
        for obj in chunk['objects']:
            palette = PALETTES[BIOMES[affinity][obj['biome']]]
            choices = palette[obj['kind']]
            if art_set == 'ki-v2' and obj['kind'] in ki_props:
                choices = ki_props[obj['kind']]
            variant = int(hashlib.sha256(obj['id'].encode()).hexdigest()[:8], 16) % len(choices)
            objects.append(instance(obj, choices[variant], 'props'))
        target = output / feature / 'chunks' / (path.stem + '.art.json.gz')
        save(target, {'format': 'superior-art-overlay-1', 'sourceChunkSha256': digest(path), 'objects': objects})
        chunk_files.append(str(target.relative_to(output)))
    building_art = []
    for b in world['buildings']:
        fp = b['footprint']
        obj = {'id': b['id'], 'x': fp['x'] + fp['width'] / 2,
               'y': fp['y'] + fp['height'], 'solid': True, 'footprint': fp}
        building_art.append({**instance(obj, service_asset(b['service']), 'buildings'), 'door': b['door']})
    accepted_art = []
    accepted_scenery = []
    accepted = world.get('acceptedSource')
    if accepted:
        objects = {o['id']: o for o in accepted['objects']}
        offset = world['sourceOffset']
        for b in accepted['city']['buildings']:
            original = objects[b['objectId']]
            obj = {**original, 'id': 'accepted-' + original['id'],
                   'x': original['x'] + offset['x'], 'y': original['y'] + offset['y']}
            accepted_art.append({**instance(obj, service_asset(b['id']), 'buildings', True),
                                 'door': {'x': b['door']['x'] + offset['x'], 'y': b['door']['y'] + offset['y']}})
        building_ids = {b['objectId'] for b in accepted['city']['buildings']}
        aliases = {'oak': 'biome-forest.tall-broadleaf-oak-tree', 'fir': 'biome-forest.tall-pine-tree',
                   'tree': affinity + '-city.' + ('tree-maple-red' if affinity == 'pyra' else 'tree'),
                   'bush': 'biome-forest.flowering-bush', 'rock': 'biome-forest.mossy-boulder',
                   'bridge': affinity + '-city.' + ('bridge-stone' if affinity == 'pyra' else 'bridge'),
                   'fountain': affinity + '-city.' + ('fountain-fire' if affinity == 'pyra' else 'fountain'),
                   'lamp': affinity + '-city.' + ('lantern-stone' if affinity == 'pyra' else 'lamp')}
        for original in accepted['objects']:
            if original['id'] in building_ids: continue
            candidate = original.get('asset') or original['kind']
            if 'object.' + candidate not in entries:
                candidate = aliases.get(original['kind'], 'biome-forest.mossy-boulder')
            obj = {**original, 'id': 'accepted-' + original['id'],
                   'x': original['x'] + offset['x'], 'y': original['y'] + offset['y']}
            accepted_scenery.append(instance(obj, candidate, 'acceptedScenery', True))
    resources = [instance(r, {'ki-crystal': 'crystal', 'wood': 'biome-forest.fallen-mossy-log', 'ore': 'biome-forest.mossy-boulder',
                              'herb': 'biome-forest.cluster-of-mushrooms'}[r['kind']], 'resources') for r in world['resources']]
    entrances = [instance({'id': d['id'], **d['overworldEntrance']}, 'ruins-props.an-ancient-stone-gate-ruin',
                          'dungeonEntrances') for d in world['dungeons']]
    terrain = [GROUND[p] for p in BIOMES[affinity]]
    water = 'terrain.nature-water-ocean-deep'
    extra = {}
    if art_set == 'ki-v2':
        terrain, water = ki_ground, ki_water
        extra = {'road': 'terrain.ki-v2-%s-road-0' % affinity}
        plaza = 'terrain.ki-v2-city-%s-plaza-0' % affinity
        extra['plaza'] = plaza if plaza in entries else extra['road']
        marks = (ki_v2_landmarks(feature, affinity, entries) + ki_v2_relief(region, affinity, entries)
                 + ki_v2_camps(region, affinity, entries))
        used.update(m['binding'] for m in marks)
    for key in terrain + [water] + [v for v in extra.values() if isinstance(v, str)]:
        assert key in entries, key
        used.add(key)
    save(output / feature / 'feature.art.json', {'format': 'superior-art-overlay-1', 'feature': feature,
         'sourceWorldSha256': digest(region / 'world.json'), 'sourceManifestSha256': digest(region / 'manifest.json'),
         'groundByBiome': terrain, 'water': water, **extra, **({'landmarks': marks} if art_set == 'ki-v2' else {}), 'buildings': building_art,
         'acceptedCityBuildings': accepted_art, 'acceptedCityScenery': accepted_scenery, 'resources': resources, 'dungeonEntrances': entrances,
         'chunks': chunk_files, 'geometryChanged': False, 'runtimeInstalled': False})
    # Read back all source checksums after assembly. Input directory is never an output destination.
    assert all(digest(region / n) == sha for n, sha in manifest['files'].items())
    return {'feature': feature, **counts, 'chunks': len(chunk_files), 'bindingsUsed': sorted(used),
            'sourceFilesVerified': len(manifest['files']), 'sourceUnchanged': True}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--repo', type=Path, default=ROOT)
    p.add_argument('--export-input', type=Path)
    p.add_argument('--input', type=Path)
    p.add_argument('--world', type=Path)
    p.add_argument('--output', type=Path)
    p.add_argument('--workers', type=int, default=8)
    p.add_argument('--art-set', choices=['default', 'ki-v2'], default='default')
    a = p.parse_args()
    if a.export_input:
        export_input(a.repo, a.export_input)
        return
    if not a.input or not a.world or not a.output or not 1 <= a.workers <= 8:
        p.error('Provide --input --world --output and 1..8 workers')
    assert not a.output.exists(), 'Output must be a new directory'
    assert not a.output.resolve().is_relative_to(a.world.resolve()), 'Keep source world immutable'
    a.output.mkdir(parents=True)
    source = json.loads(a.input.read_text())
    assert source['format'] == 'superior-art-input-1'
    features = sorted(p.parent.name for p in a.world.glob('*/world.json'))
    assert len(features) == 10
    with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
        reports = list(pool.map(lambda f: build_feature(a.world, a.output, f, source, a.art_set), features))
    used = sorted({b for r in reports for b in r['bindingsUsed']})
    save(a.output / 'assets.json', {b: source['entries'][b] for b in used})
    save(a.output / 'report.json', {'format': 'superior-art-overlay-1', 'features': reports,
         'inputSha256': digest(a.input), 'kitSha256': source['kitSha256'], 'bindingsUsed': len(used),
         'geometryChanged': False, 'runtimeInstalled': False,
         'limitations': ['Presentation bindings only; Phaser scene integration remains open.',
                        'No new NPC, monster or hero animations are supplied by this object kit.',
                        'Building visual door alignment requires review; physical doors remain unchanged.',
                        'Source provenance declarations do not resolve commercial rights.']})
    save(a.output / 'manifest.json', {str(p.relative_to(a.output)): digest(p)
         for p in sorted(a.output.rglob('*')) if p.is_file()})
    print(json.dumps({'features': len(reports), 'bindingsUsed': len(used),
                      'props': sum(r['props'] for r in reports), 'geometryChanged': False}))


if __name__ == '__main__':
    main()
