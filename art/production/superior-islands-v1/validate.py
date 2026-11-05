"""Validate unchanged source images and atlas descriptors; never edit image pixels."""
from pathlib import Path
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text())
assert len(manifest['islands']) == 6
ids, hashes, atlas_count = set(), set(), 0
for island in manifest['islands']:
    assert island['id'] not in ids
    ids.add(island['id'])
    assert len(island['atlases']) == 2
    for atlas in island['atlases']:
        path = root / atlas['image']
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        assert digest == atlas['sha256'] and digest not in hashes
        hashes.add(digest)
        with Image.open(path) as im:
            im.load()
            assert im.size == (1536, 1024)
            if atlas['kind'] == 'props':
                assert im.mode == 'RGBA'
                low, high = im.getchannel('A').getextrema()
                assert low == 0 and high > 240
        descriptor = json.loads((root / atlas['descriptor']).read_text())
        assert len(descriptor['frames']) == 6
        assert set(descriptor['frames']) == set(atlas['frames'])
        rectangles = []
        for frame in descriptor['frames'].values():
            r = frame['frame']
            assert r['w'] == r['h'] == 512
            assert 0 <= r['x'] <= 1024 and 0 <= r['y'] <= 512
            assert r['x'] % 512 == 0 and r['y'] % 512 == 0
            rectangles.append((r['x'], r['y']))
        assert len(set(rectangles)) == 6
        assert (root / atlas['prompt']).is_file()
        atlas_count += 1
assert atlas_count == 12
print('PASS: 6 islands, 12 unique decodable PNG atlases, 36 terrain + 36 prop frames, dimensions, alpha, hashes and frame bounds.')
print('Not certified: seamless tiling, sprite matte/padding/anchors, Phaser import, gameplay or mobile performance.')
