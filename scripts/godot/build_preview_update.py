#!/usr/bin/env python3
"""Publishable c101 content patch: only the isolated preview, no APK/global code changes.

Preserves the exact 1.13.1 content manifest/pointers used by the existing VPS
workflow, adding one core-c101 payload. An existing core can only be replaced when its
preview-only provenance is recorded in the base release report.
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
    parser.add_argument('--base-ref', default='HEAD')
    parser.add_argument('--citadel', action='store_true')
    parser.add_argument('--gemini', action='store_true')
    args = parser.parse_args()
    assert not (args.gemini and args.citadel)
    from prepare_service_preview import prepare
    source = 'godot-isometric-world' if args.gemini else 'godot-isometric-pyra'
    preview = prepare(ROOT/'ports'/source, ROOT/'ports/godot-pyra', citadel=args.citadel, gemini=args.gemini)
    subprocess.run(['godot', '--headless', '--audio-driver', 'Dummy', '--editor', '--path',
                    str(ROOT/'ports/godot-pyra'), '--import'], check=True)
    spec = importlib.util.spec_from_file_location('builder', ROOT/'scripts/godot/build_packs.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    assert builder.client_code() == 101 or (args.gemini and builder.client_code() == 102), 'Unsupported client for preview pack'
    base_dir = f'deliveries/godot-content-{args.base}'
    def base_file(name):
        return subprocess.check_output(['git', 'show', args.base_ref+':'+base_dir+'/'+name], cwd=ROOT)

    base = json.loads(base_file('manifest.json'))
    assert base['version'] == args.base
    old_core = base['packs'].get('core-c101')
    if old_core:
        prior_report = json.loads(base_file('preview-update.json'))
        assert (args.citadel or args.gemini) and prior_report['changes_only_preview_namespace'] and prior_report['core'] == old_core
        assert all(path.startswith(('res://'+PREFIX, 'res://.godot/imported/')) for path in prior_report['files'])
    out = ROOT/f'deliveries/godot-content-{args.version}'
    out.mkdir(parents=True, exist_ok=True)
    work = ROOT/'ports/godot-pyra/builds/preview-update-work'
    work.mkdir(parents=True, exist_ok=True)
    listing = []
    sources = [builder.PROJECT/PREFIX/entry['path'] for entry in preview['files']]
    sources.append(builder.PROJECT/PREFIX/'manifest.json')
    for source in sorted(sources):
        rel = source.relative_to(builder.PROJECT).as_posix()
        # Raw bytes retain authoring hashes and height data; imports retain runtime resources.
        # Gemini textures can be decoded from WebP directly at runtime.
        paths = {rel} if args.gemini and source.suffix == '.webp' else set([rel] + builder.disk_files(rel))
        for path in sorted(paths):
            listing.append({'pck': 'res://'+path, 'disk': str(builder.PROJECT/path)})
        if source.suffix in ('.gd', '.tscn', '.gdshader', '.gdshaderinc'):
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
    preserved = {name: entry for name, entry in base['packs'].items() if name != 'core-c101'}
    for entry in preserved.values():
        # Reuse already-uploaded immutable LFS objects. No need to download 294 MB locally.
        pointer = base_file(entry['file'])
        expected = f"oid sha256:{entry['sha256']}\nsize {entry['bytes']}".encode()
        assert pointer.startswith(b'version https://git-lfs.github.com/spec/v1') and expected in pointer
        (out/entry['file']).write_bytes(pointer)
    manifest = dict(base, version=args.version, createdAt=datetime.now(timezone.utc).isoformat(timespec='seconds'))
    manifest['packs'] = dict(base['packs'])
    manifest['packs']['core-c101'] = {'file': filename, 'bytes': (out/filename).stat().st_size, 'sha256': digest, 'files': len(listing)}
    (out/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    report = {'base': args.base, 'version': args.version, 'installed_client_code': 101,
              'preserved_packs': len(preserved), 'unchanged_lands': manifest['lands'] == base['lands'],
              'core': manifest['packs']['core-c101'], 'changes_only_preview_namespace': True,
              'changed_apk': False, 'citadel_preview': args.citadel, 'gemini_world': args.gemini, 'files': [item['pck'] for item in listing]}
    (out/'preview-update.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='files'}))


if __name__ == '__main__':
    main()
