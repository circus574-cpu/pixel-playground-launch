#!/usr/bin/env python3
"""Archive all GPU sources and prepare review/import candidates, not world geometry."""
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path('/workspace/ki-iso-art2')
OUT = ROOT / 'terrain-delivery'
OUT.mkdir(exist_ok=True)
for folder in ('archives', 'previews', 'qa'):
    (OUT / folder).mkdir(exist_ok=True)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


items = []
sources = []
for batch, expected in [('terrain-production', 60), ('terrain-fine-ground', 12)]:
    root = ROOT / batch
    manifest = json.loads((root / 'manifest.json').read_text())
    assert len(manifest['items']) == expected, (batch, len(manifest['items']))
    shutil.copyfile(root / 'manifest.json', OUT / f'{batch}.json')
    for item in manifest['items']:
        directory = root / item['id']
        for name, entry in item['files'].items():
            assert digest(directory / name) == entry['sha256'], (directory, name)
        image = Image.open(directory / 'albedo.png')
        data = np.asarray(image)
        assert image.size == (1024, 1024)
        assert float(data.astype(np.float32).std(axis=(0, 1)).mean()) > 2, item['id']
        assert float((data == 0).all(axis=-1).mean()) < .10, item['id']
        assert item['seams']['after']['seam_ratio'] < 2, item['id']
        item = dict(item, batch=batch)
        items.append(item)
        sources.extend((path, f'{batch}/{item["id"]}/{path.name}') for path in sorted(directory.iterdir()) if path.is_file())
    preview = Image.new('RGB', (6 * 256, ((expected + 5) // 6) * 280), (27, 22, 24))
    draw = ImageDraw.Draw(preview)
    for index, item in enumerate(manifest['items']):
        x, y = index % 6 * 256, index // 6 * 280
        preview.paste(Image.open(root / item['id'] / 'albedo.png').resize((256, 256)), (x, y))
        draw.text((x + 3, y + 258), item['id'], fill=(248, 222, 175))
    preview.save(OUT / f'{batch}-sheet.jpg', quality=92)

# Keep every result, including rejected/misclassified candidates, in immutable parts.
archives = []
archive = None
used = 0
part = 0
for path, name in sources:
    size = path.stat().st_size
    if archive is None or used + size > 48 * 1024 * 1024:
        if archive is not None:
            archive.close()
        part += 1
        target = OUT / 'archives' / f'gpu-sources-{part:02d}.zip'
        archives.append(target)
        archive = zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_STORED)
        used = 0
    archive.write(path, name)
    used += size
if archive is not None:
    archive.close()

selected = []
for category in dict.fromkeys(item['category'] for item in items):
    choices = [item for item in items if item['category'] == category]
    best = min(choices, key=lambda item: item['seams']['after']['seam_ratio'])
    source = ROOT / best['batch'] / best['id']
    for filename, suffix in [('albedo.webp', '.webp'), ('albedo-512.webp', '-512.webp'), ('repeat-3x3.jpg', '-repeat.jpg')]:
        shutil.copyfile(source / filename, OUT / 'previews' / f'{best["id"]}{suffix}')
    selected.append({'id': best['id'], 'category': category, 'path': f'previews/{best["id"]}.webp', 'lod': f'previews/{best["id"]}-512.webp', 'selection': 'lowest measured seam ratio; artistic review pending'})

for name in ['BASE-LICENSE.md', 'license-provenance.json', 'upstream-model-metadata.json', 'MODEL-README.txt', 'model-download.json', 'pipeline-tests.json']:
    path = ROOT / 'terrain-production' / name
    if path.exists():
        shutil.copyfile(path, OUT / name)
report = {
    'generated': len(items), 'technical_validation_passed': len(items), 'failed': 0,
    'max_seam_ratio': max(item['seams']['after']['seam_ratio'] for item in items),
    'mean_seam_ratio': sum(item['seams']['after']['seam_ratio'] for item in items) / len(items),
    'checks': ['file hashes', '1024 dimensions', 'nonconstant pixels', 'no black generation failure', 'periodic seam ratio < 2'],
    'visual_review': 'pending; fine ground batch corrects rocky results of initial prompts',
    'derived_maps': 'first batch: luminance estimates; fine batch: authored granular microrelief; neither is measured PBR',
    'game_installed': False, 'geometry_changed': False, 'phone_tested': False,
}
(OUT / 'qa/report.json').write_text(json.dumps(report, indent=2) + '\n')
manifest = {
    'format': 'ki-pyra-gpu-terrain-review-1', 'date': '2026-11-17',
    'status': 'GPU asset production; no game installation', 'generated': len(items),
    'model': 'Lykon/dreamshaper-xl-v2-turbo', 'revision': 'f70ad5bce436c640d23fc02cd0a6ccc787280b6e',
    'selected_for_review': selected,
    'archives': [{'path': str(p.relative_to(OUT)), 'size': p.stat().st_size, 'sha256': digest(p)} for p in archives],
    'limitations': ['First ash/packed-road candidates are coarse aggregate, not fine ground', 'Columnar prompt produced angular rock swatches, not column geometry', 'Mountains/holes/valleys need separate actual geometry', 'Normal/height/roughness are inferred approximations', 'Artistic and licensing acceptance pending'],
}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
files = [{'path': str(p.relative_to(OUT)), 'size': p.stat().st_size, 'sha256': digest(p)} for p in sorted(OUT.rglob('*')) if p.is_file()]
(OUT / 'file-index.json').write_text(json.dumps(files, indent=2) + '\n')
print(json.dumps({'generated': len(items), 'archives': len(archives), 'archive_bytes': sum(p.stat().st_size for p in archives), 'review_materials': len(selected)}), flush=True)
