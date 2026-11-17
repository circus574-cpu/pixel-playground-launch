#!/usr/bin/env python3
"""Publishable c101 content patch: only the isolated preview, no APK/global code changes.

Preserves the exact 1.13.1 content manifest/pointers used by the existing VPS
workflow, adding one core-c101 payload. Refuses an existing c101 core rather
than silently discarding a previously published code update.
"""
import argparse
import hashlib
import importlib.util
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'service_preview/pyra/'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', default='1.14.1')
    parser.add_argument('--base', default='1.13.1')
    args = parser.parse_args()
    subprocess.run(['python3', str(ROOT/'scripts/godot/prepare_service_preview.py')], check=True)
    spec = importlib.util.spec_from_file_location('builder', ROOT/'scripts/godot/build_packs.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    assert builder.client_code() == 101, 'Must target the installed 1.14 app, not a new APK'
    base_dir = f'deliveries/godot-content-{args.base}'
    base = json.loads(subprocess.check_output(['git', 'show', 'HEAD:'+base_dir+'/manifest.json'], cwd=ROOT))
    assert base['version'] == args.base and 'core-c101' not in base['packs'], 'Existing c101 core must be explicitly preserved/merged'
    out = ROOT/f'deliveries/godot-content-{args.version}'
    out.mkdir(parents=True, exist_ok=True)
    work = ROOT/'ports/godot-pyra/builds/preview-update-work'
    work.mkdir(parents=True, exist_ok=True)
    listing = []
    for source in sorted((builder.PROJECT/PREFIX).rglob('*')):
        if not source.is_file() or source.suffix in ('.import', '.uid'):
            continue
        rel = source.relative_to(builder.PROJECT).as_posix()
        # Raw bytes retain authoring hashes and height data; imports retain runtime resources.
        paths = set([rel] + builder.disk_files(rel))
        for path in sorted(paths):
            listing.append({'pck': 'res://'+path, 'disk': str(builder.PROJECT/path)})
        if source.suffix in ('.gd', '.tscn', '.gdshader'):
            remap = work/(rel.replace('/', '__')+'.remap')
            remap.write_text(f'[remap]\n\npath="res://{rel}"\n')
            listing.append({'pck': 'res://'+rel+'.remap', 'disk': str(remap)})
    by_path = {item['pck']: item for item in listing}
    listing = list(by_path.values())
    assert all(item['pck'].startswith(('res://'+PREFIX, 'res://.godot/imported/')) for item in listing)
    listing_file = work/'files.json'
    listing_file.write_text(json.dumps(listing))
    target = out/'preview.pck'
    subprocess.run(['godot', '--headless', '--audio-driver', 'Dummy', '--path', str(builder.PROJECT),
                    '--script', 'res://tools/pack_builder.gd', '--', str(listing_file), str(target)], check=True)
    digest = builder.sha256(target)
    filename = 'core-c101-'+digest[:12]+'.pck'
    target.replace(out/filename)
    for entry in base['packs'].values():
        # Reuse already-uploaded immutable LFS objects. No need to download 294 MB locally.
        pointer = subprocess.check_output(['git', 'show', 'HEAD:'+base_dir+'/'+entry['file']], cwd=ROOT)
        expected = f"oid sha256:{entry['sha256']}\nsize {entry['bytes']}".encode()
        assert pointer.startswith(b'version https://git-lfs.github.com/spec/v1') and expected in pointer
        (out/entry['file']).write_bytes(pointer)
    manifest = dict(base, version=args.version, createdAt=datetime.now(timezone.utc).isoformat(timespec='seconds'))
    manifest['packs'] = dict(base['packs'])
    manifest['packs']['core-c101'] = {'file': filename, 'bytes': (out/filename).stat().st_size, 'sha256': digest, 'files': len(listing)}
    (out/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    report = {'base': args.base, 'version': args.version, 'installed_client_code': 101,
              'preserved_packs': len(base['packs']), 'unchanged_lands': manifest['lands'] == base['lands'],
              'core': manifest['packs']['core-c101'], 'changes_only_preview_namespace': True,
              'changed_apk': False, 'files': [item['pck'] for item in listing]}
    (out/'preview-update.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='files'}))


if __name__ == '__main__':
    main()
