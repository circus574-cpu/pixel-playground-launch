#!/usr/bin/env python3
"""Shrink chosen images of an installed GPU pack to the size the game actually draws them.

    python3 scripts/assets/downscale_pack_images.py <pack-id> <new-version> <work-dir> <asset-id>=<longest-side-px> ...
    npm run assets:import -- <work-dir>/<pack-id>/pack.json --install --replace     (then remove the old version directory)

Decoded GPU memory is width x height x 4 bytes whatever the file size, so an image drawn far smaller than its
resolution wastes memory. Images are scaled proportionally (Lanczos, lossless WebP, no trimming: `fit: contain`
bindings depend on the aspect ratio). Other assets of the pack are copied unchanged. Needs: pillow.
"""
import glob, json, os, shutil, sys
from PIL import Image

pid, version, work = sys.argv[1], sys.argv[2], sys.argv[3]
targets = dict((a.split('=')[0], int(a.split('=')[1])) for a in sys.argv[4:])
src = sorted(glob.glob(f'public/game/assets/gpu/{pid}/*/'))[-1]
dst = os.path.join(work, pid)
shutil.rmtree(dst, ignore_errors=True)
os.makedirs(dst)
pack = json.load(open(src + 'pack.json'))
pack['version'] = version
for f in os.listdir(src):
    if f != 'pack.json': shutil.copy(src + f, dst)
for a in pack['assets']:
    a['version'] = version
    a['url'] = os.path.basename(a['url'])
    if a.get('atlasUrl'): a['atlasUrl'] = os.path.basename(a['atlasUrl'])
    if a['id'] not in targets: continue
    assert a['kind'] == 'image', a['id']
    im = Image.open(os.path.join(dst, a['url'])).convert('RGBA')
    w, h = im.size
    k = targets.pop(a['id']) / max(w, h)
    if k >= 1: continue
    nw, nh = round(w * k), round(h * k)
    im.resize((nw, nh), Image.LANCZOS).save(os.path.join(dst, a['url']), 'WEBP', lossless=True, quality=100, method=6)
    a['width'], a['height'] = nw, nh
    print(a['id'], (w, h), '->', (nw, nh), f'{w*h*4/1048576:.1f} -> {nw*nh*4/1048576:.1f} MiB')
assert not targets, f'not found in pack: {sorted(targets)}'
json.dump(pack, open(os.path.join(dst, 'pack.json'), 'w'), indent=2)
