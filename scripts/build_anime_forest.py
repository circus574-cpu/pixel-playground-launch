"""Export independent OpenAI anime sources: python scripts/build_anime_forest.py SOURCE_DIR SOURCES_JSON.

Requires Pillow and numpy. No model requests, secrets or network. The source JSON
maps material/object names to generated source filenames; every input is hashed.
Keeps the existing world topology and mechanics, replaces only its visual data.
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1])
SOURCES = json.loads(Path(sys.argv[2]).read_text())
OUT = ROOT / 'public/game/assets/anime-forest-v1'
OUT.mkdir(parents=True, exist_ok=True)
TILE, PHASES, PADDING = 64, 4, 2
PITCH = TILE + PADDING * 2


def periodic(source):
    a = np.asarray(source.convert('RGB').resize((256, 256), Image.Resampling.LANCZOS), dtype=float)
    h, w, _ = a.shape
    v = np.zeros_like(a)
    v[0] = a[-1] - a[0]
    v[-1] = a[0] - a[-1]
    v[:, 0] += a[:, -1] - a[:, 0]
    v[:, -1] += a[:, 0] - a[:, -1]
    y, x = np.meshgrid(np.arange(h), np.arange(w), indexing='ij')
    d = 2 * np.cos(2 * np.pi * x / w) + 2 * np.cos(2 * np.pi * y / h) - 4
    d[0, 0] = 1
    smooth = np.fft.fft2(v, axes=(0, 1)) / d[:, :, None]
    smooth[0, 0] = 0
    a = np.clip(a - np.fft.ifft2(smooth, axes=(0, 1)).real, 0, 255).astype('uint8')
    a[:, 0] = a[:, -1] = ((a[:, 0].astype(float) + a[:, -1]) / 2).astype('uint8')
    a[0] = a[-1] = ((a[0].astype(float) + a[-1]) / 2).astype('uint8')
    assert np.array_equal(a[0], a[-1]) and np.array_equal(a[:, 0], a[:, -1])
    return Image.fromarray(a).convert('RGBA')


materials = {}
for name in ['grass', 'soil', 'stone', 'water']:
    im = periodic(Image.open(SRC / SOURCES[name]))
    im.save(OUT / (name + '.png'))
    materials[name] = [im.crop((x * TILE, y * TILE, (x + 1) * TILE, (y + 1) * TILE))
                       for y in range(PHASES) for x in range(PHASES)]

# Four corners share the same alpha value at every adjoining cell boundary.
u, v = np.linspace(0, 1, TILE)[None, :], np.linspace(0, 1, TILE)[:, None]
weights = [(1-u)*(1-v), u*(1-v), u*v, (1-u)*v]
masks = []
for mask in range(16):
    field = sum(weights[i] for i in range(4) if mask & (1 << i)) if mask else np.zeros((TILE, TILE))
    alpha = np.clip((field - .5) * 4 + .5, 0, 1)
    masks.append(Image.fromarray(np.rint(alpha * 255).astype('uint8')))
frames = materials['grass'].copy()
for name in ['soil', 'stone', 'water']:
    for phase in range(16):
        for mask in range(16):
            im = materials[name][phase].copy()
            im.putalpha(masks[mask])
            frames.append(im)
assert len(frames) == 784
atlas = Image.new('RGBA', (28 * PITCH, 28 * PITCH))
for i, im in enumerate(frames):
    x, y = i % 28 * PITCH + 2, i // 28 * PITCH + 2
    atlas.paste(im, (x, y))
    for dx, dy, box, size in [(-2, 0, (0, 0, 1, 64), (2, 64)),
                             (64, 0, (63, 0, 64, 64), (2, 64)),
                             (0, -2, (0, 0, 64, 1), (64, 2)),
                             (0, 64, (0, 63, 64, 64), (64, 2))]:
        atlas.paste(im.crop(box).resize(size), (x + dx, y + dy))
    for dx, dy, sx, sy in [(-2, -2, 0, 0), (64, -2, 63, 0), (-2, 64, 0, 63), (64, 64, 63, 63)]:
        atlas.paste(im.getpixel((sx, sy)), (x + dx, y + dy, x + dx + 2, y + dy + 2))
atlas.save(OUT / 'terrain.png', optimize=True)

names = ['oak', 'fir', 'bush', 'rock', 'cottage', 'inn', 'forge', 'market', 'fountain', 'lamp', 'bridge', 'fence']
sprites, object_info = {}, []
objects_atlas = Image.new('RGBA', (2048, 1536))
atlas_json = {'frames': {}, 'meta': {'image': 'objects.webp', 'size': {'w': 2048, 'h': 1536}, 'scale': '1'}}
for i, name in enumerate(names):
    im = Image.open(SRC / SOURCES[name]).convert('RGBA')
    alpha = np.asarray(im.getchannel('A')).copy()
    assert alpha.min() == 0 and alpha.max() > 240, 'Missing real alpha: ' + name
    # Discard faint generation fringes before tight bounds; preserve antialiased edges.
    alpha[alpha < (240 if name in ['rock', 'lamp'] else 24)] = 0
    im.putalpha(Image.fromarray(alpha))
    bounds = im.getbbox()
    if not bounds:
        raise ValueError('Empty object ' + name)
    im = im.crop(bounds)
    im.thumbnail((496, 496), Image.Resampling.LANCZOS)
    im.save(OUT / (name + '.webp'), lossless=True, method=4)
    with Image.open(OUT / (name + '.webp')) as exported:
        exported.load()
    sprites[name] = im
    x, y = i % 4 * 512 + 8, i // 4 * 512 + 8
    objects_atlas.paste(im, (x, y))
    atlas_json['frames'][name] = {'frame': {'x': x, 'y': y, 'w': im.width, 'h': im.height},
        'rotated': False, 'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': im.width, 'h': im.height},
        'sourceSize': {'w': im.width, 'h': im.height}}
    object_info.append({'name': name, 'width': im.width, 'height': im.height, 'source': SOURCES[name], 'sourceBounds': bounds})
objects_atlas.save(OUT / 'objects.webp', lossless=True, method=4)
with Image.open(OUT / 'objects.webp') as exported:
    exported.load()
(OUT / 'objects.json').write_text(json.dumps(atlas_json, separators=(',', ':')))

# Normalize the purpose-generated nine UI cells into an exact square atlas.
ui_source = Image.open(SRC / SOURCES['ui']).convert('RGBA')
ui_atlas = Image.new('RGBA', (768, 768))
for i in range(9):
    col, row = i % 3, i // 3
    cuts = [0, .355, .68, 1]
    im = ui_source.crop((round(col*ui_source.width/3), round(cuts[row]*ui_source.height),
                         round((col+1)*ui_source.width/3), round(cuts[row+1]*ui_source.height)))
    alpha = np.asarray(im.getchannel('A')).copy()
    alpha[alpha < 24] = 0
    im.putalpha(Image.fromarray(alpha))
    bounds = im.getbbox()
    if not bounds:
        raise ValueError('Empty UI icon ' + str(i))
    im = im.crop(bounds)
    im.thumbnail((224, 224), Image.Resampling.LANCZOS)
    ui_atlas.paste(im, (col*256+(256-im.width)//2, row*256+(256-im.height)//2))
ui_atlas.save(OUT/'ui.webp', lossless=True, method=4)
with Image.open(OUT/'ui.webp') as exported:
    exported.load()

world_path = ROOT / 'src/game/world/forest-map.json'
world = json.loads(world_path.read_text())
# A bank must be wider than one logical cell; the old 24-unit strip vanished
# between vertices and produced disconnected shoreline dashes.
for y in range(world['rows'] + 1):
    center = 2500 + np.sin(y*32/270)*70
    for x in range(world['cols'] + 1):
        distance = abs(x*32-center)
        if distance < 124:
            world['vertices'][y][x] = 3
        elif distance < 180:
            world['vertices'][y][x] = 1
for y in range(world['rows']):
    for x in range(world['cols']):
        phase = y % 4 * 4 + x % 4
        corners = [world['vertices'][y][x], world['vertices'][y][x+1],
                   world['vertices'][y+1][x+1], world['vertices'][y+1][x]]
        world['layers'][0][y][x] = phase
        for material in [1, 2, 3]:
            mask = sum(1 << i for i, m in enumerate(corners) if (m in [1, 2] if material == 1 else m == material))
            world['layers'][material][y][x] = 16 + (material-1)*256 + phase*16 + mask if mask else -1

widths = {'cottage': 500, 'inn': 570, 'forge': 520, 'market': 210, 'fountain': 145,
          'lamp': 40, 'bridge': 420, 'fence': 145, 'rock': 74, 'bush': 68}
for o in world['objects']:
    name = o['kind']
    width = widths.get(name, 245 + int(hashlib.sha256(o['id'].encode()).hexdigest()[:4], 16) % 75)
    o['width'], o['height'] = width, round(width * sprites[name].height / sprites[name].width)
    o['anchorX'], o['anchorY'] = .5, .94 if name in ['oak', 'fir', 'lamp', 'cottage', 'inn', 'forge', 'market'] else .5
    h = o['height']
    if name in ['cottage', 'inn', 'forge', 'market']:
        o['footprint'] = {'width': round(width*.72), 'height': round(h*.24), 'offsetY': round(-h*.06)}
    elif name in ['oak', 'fir']:
        o['footprint'] = {'width': 24, 'height': 24, 'offsetY': 0}
    elif name == 'lamp':
        o['footprint'] = {'width': 12, 'height': 12, 'offsetY': 0}

# Keep the water collision opening within the real bridge deck, excluding rails.
bridge = next(o for o in world['objects'] if o['kind'] == 'bridge')
half_deck = max(28, bridge['height'] / 2 - 10)
world['bridge']['halfHeight'] = half_deck
world['riverRows'] = []
opening_top, opening_bottom = bridge['y'] - half_deck, bridge['y'] + half_deck
for y in range(0, world['height'], 32):
    river_x = round(2500 + np.sin(y/270)*70 - 124)
    # Clip obstacle rectangles at the deck, rather than rounding the opening
    # to full terrain rows (which can close a narrow bridge for the actor).
    intervals = [(y, min(y+32, opening_top)), (max(y, opening_bottom), y+32)]
    for top, bottom in intervals:
        if bottom > top:
            world['riverRows'].append({'x': river_x, 'y': top, 'width': 248, 'height': bottom-top})

def blocked(x, y):
    obstacles = list(world['riverRows'])
    for o in world['objects']:
        f = o.get('footprint')
        if o['solid'] and f:
            obstacles.append({'x': o['x']-f['width']/2, 'y': o['y']+f.get('offsetY', 0)-f['height']/2,
                              'width': f['width'], 'height': f['height']})
    return any(r['x']-14 < x < r['x']+r['width']+14 and r['y']-14 < y < r['y']+r['height']+14 for r in obstacles)

assert not blocked(world['spawn']['x'], world['spawn']['y']), 'Player spawn blocked'
for e in world['enemies']:
    if not blocked(e['x'], e['y']):
        continue
    origin = e.copy()
    found = False
    for radius in range(20, 401, 20):
        for dx, dy in [(radius, 0), (-radius, 0), (0, radius), (0, -radius)]:
            x, y = origin['x']+dx, origin['y']+dy
            if 40 < x < world['width']-40 and 40 < y < world['height']-40 and not blocked(x, y):
                e.update(x=x, y=y)
                found = True
                break
        if found:
            break
    assert found, 'Cannot place enemy'
world['version'] = 4
world['terrainFrameCount'] = len(frames)
world_path.write_text(json.dumps(world, separators=(',', ':')))

preview = Image.new('RGBA', (world['width'], world['height']))
for y in range(world['rows']):
    for x in range(world['cols']):
        tile = frames[world['layers'][0][y][x]].copy()
        for layer in range(1, 4):
            idx = world['layers'][layer][y][x]
            if idx >= 0:
                tile.alpha_composite(frames[idx])
        preview.paste(tile.resize((32, 32), Image.Resampling.LANCZOS), (x*32, y*32))
for o in sorted(world['objects'], key=lambda o: -20 if o['kind'] == 'bridge' else o['y']):
    im = sprites[o['kind']].resize((o['width'], o['height']), Image.Resampling.LANCZOS)
    preview.alpha_composite(im, (round(o['x']-o['width']*o['anchorX']), round(o['y']-o['height']*o['anchorY'])))
preview.resize((768, 512), Image.Resampling.LANCZOS).convert('RGB').save(OUT/'minimap.webp', quality=92)
preview.resize((1536, 1024), Image.Resampling.LANCZOS).convert('RGB').save(OUT/'map-qa.webp', quality=94)
manifest = {'version': 1, 'style': 'original illustrated anime fantasy 2D', 'generator': 'OpenAI built-in imagegen',
            'model': 'not disclosed', 'tileSize': 32, 'sourceMaterialSize': 256, 'textureTileSize': 64,
            'terrainFrameCount': len(frames), 'terrainAtlasSize': list(atlas.size), 'objectAtlasSize': list(objects_atlas.size),
            'objects': object_info, 'sourceSha256': {k: hashlib.sha256((SRC/v).read_bytes()).hexdigest() for k, v in SOURCES.items()}}
(OUT/'manifest.json').write_text(json.dumps(manifest, indent=2))
print(json.dumps({'frames': len(frames), 'objects': len(world['objects']), 'output': str(OUT)}))
