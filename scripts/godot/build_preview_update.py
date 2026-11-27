#!/usr/bin/env python3
"""Publishable c101 content patch: lightweight core-c101 (~11 MB) + cached modular world-* asset packs.

Preserves all legacy 1.13.1 content manifest/pointers used by the existing VPS workflow, while splitting
the isometric world into a fast-updating core-c101 (scripts, shaders, JSON, UI, menu music) and 8
immutable world-* asset packs cached permanently on the client and reused via Git LFS pointers whenever
their inputs have not changed.
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
# 1.14.13+: host entry/character/race/title/content/gate scripts ship in core-c101 so OTA updates UI, parallel downloader & menu music.
HOST_SCRIPTS = (
    'scripts/service_screen.gd',
    'scripts/character_select.gd',
    'scripts/race_screen.gd',
    'scripts/title_screen.gd',
    'scripts/content.gd',
    'scripts/gate_screen.gd',
)
ALLOWED = ('res://' + PREFIX, 'res://.godot/imported/') + tuple('res://' + h for h in HOST_SCRIPTS)
RAW_RUNTIME_EXTS = {'.webp', '.png', '.jpg', '.jpeg', '.mp3'}
CORE_MUSIC_REL = {
    PREFIX + 'assets/audio/music/loading_theme.mp3',
    PREFIX + 'assets/audio/music/menu.mp3',
}
WORLD_PACK_ORDER = (
    'world-actors-a',
    'world-actors-b',
    'world-actors-c',
    'world-objects',
    'world-monsters',
    'world-regions',
    'world-audio',
    'world-interiors',
)


def _assign_world_bucket(rel: str, actor_bucket_map: dict[str, str]) -> str:
    """Return 'core-c101' or one of WORLD_PACK_ORDER for a file under service_preview/pyra/."""
    if not rel.startswith(PREFIX):
        return 'core-c101'
    sub = rel[len(PREFIX):]
    if sub == 'assets/branding/intro.ogv':
        return ''  # Already bundled inside the APK at res://assets/branding/intro.ogv
    if sub.startswith('assets/actors/'):
        return actor_bucket_map[rel]
    if sub.startswith('assets/objects/') or sub.startswith('assets/library/'):
        return 'world-objects'
    if sub.startswith('assets/monsters/'):
        return 'world-monsters'
    if sub.startswith('regions/') or sub.startswith('assets/map/') or sub.startswith('atlas/'):
        return 'world-regions'
    if sub.startswith('assets/audio/'):
        return 'core-c101' if rel in CORE_MUSIC_REL else 'world-audio'
    if sub.startswith('assets/interiors/'):
        return 'world-interiors'
    return 'core-c101'


def _build_actor_bucket_map(sources: list[Path], project: Path) -> dict[str, str]:
    """Deterministically split assets/actors/** into 3 size-balanced packs for max parallel throughput."""
    actor_rels = []
    for src in sorted(sources):
        rel = src.relative_to(project).as_posix()
        if rel.startswith(PREFIX + 'assets/actors/'):
            actor_rels.append((rel, src.stat().st_size))
    buckets = ['world-actors-a', 'world-actors-b', 'world-actors-c']
    totals = [0, 0, 0]
    mapping: dict[str, str] = {}
    # Assign in sorted path order into the currently lightest bucket for deterministic ~40 MB splits.
    for rel, sz in actor_rels:
        idx = min(range(3), key=lambda i: (totals[i], i))
        mapping[rel] = buckets[idx]
        totals[idx] += sz
    return mapping


def _bucket_input_digest(items: list[dict]) -> str:
    h = hashlib.sha256()
    for item in sorted(items, key=lambda x: x['pck']):
        h.update(item['pck'].encode('utf-8'))
        h.update(b'\0')
        h.update(hashlib.sha256(Path(item['disk']).read_bytes()).digest())
        h.update(b'\n')
    return h.hexdigest()


def _pack_items(builder, work: Path, out: Path, pack_id: str, items: list[dict]) -> tuple[dict, str]:
    by_path = {item['pck']: item for item in items}
    deduped = list(by_path.values())
    assert all(item['pck'].startswith(ALLOWED) for item in deduped), f'Disallowed path in {pack_id}'
    listing_file = work / f'{pack_id}.files.json'
    listing_file.write_text(json.dumps(deduped))
    tmp_pck = out / f'{pack_id}.tmp.pck'
    subprocess.run(
        ['godot', '--headless', '--audio-driver', 'Dummy', '--path', str(builder.PROJECT),
         '--script', 'res://tools/pack_builder.gd', '--', str(listing_file), str(tmp_pck)],
        check=True,
    )
    digest = builder.sha256(tmp_pck)
    filename = f'{pack_id}-{digest[:12]}.pck'
    final_path = out / filename
    tmp_pck.replace(final_path)
    return {'file': filename, 'bytes': final_path.stat().st_size, 'sha256': digest, 'files': len(deduped)}, filename


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
    source_name = 'godot-isometric-world' if args.gemini else 'godot-isometric-pyra'
    preview = prepare(ROOT / 'ports' / source_name, ROOT / 'ports/godot-pyra', citadel=args.citadel, gemini=args.gemini)
    subprocess.run(
        ['godot', '--headless', '--audio-driver', 'Dummy', '--editor', '--path',
         str(ROOT / 'ports/godot-pyra'), '--import'],
        check=True,
    )
    spec = importlib.util.spec_from_file_location('builder', ROOT / 'scripts/godot/build_packs.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    assert builder.client_code() == 101 or (args.gemini and builder.client_code() == 102), 'Unsupported client for preview pack'
    base_dir = f'deliveries/godot-content-{args.base}'

    def base_file(name: str) -> bytes:
        return subprocess.check_output(['git', 'show', args.base_ref + ':' + base_dir + '/' + name], cwd=ROOT)

    base = json.loads(base_file('manifest.json'))
    assert base['version'] == args.base
    old_core = base['packs'].get('core-c101')
    prior_report = {}
    if old_core:
        prior_report = json.loads(base_file('preview-update.json'))
        assert (args.citadel or args.gemini) and prior_report['core'] == old_core
        assert all(path.startswith(ALLOWED) for path in prior_report['files'])
    out = ROOT / f'deliveries/godot-content-{args.version}'
    out.mkdir(parents=True, exist_ok=True)
    work = ROOT / 'ports/godot-pyra/builds/preview-update-work'
    work.mkdir(parents=True, exist_ok=True)

    sources = [builder.PROJECT / PREFIX / entry['path'] for entry in preview['files']]
    sources.append(builder.PROJECT / PREFIX / 'manifest.json')
    sources.extend(builder.PROJECT / h for h in HOST_SCRIPTS if args.gemini)
    actor_map = _build_actor_bucket_map(sources, builder.PROJECT) if args.gemini else {}

    buckets: dict[str, list[dict]] = {'core-c101': []}
    if args.gemini:
        for wid in WORLD_PACK_ORDER:
            buckets[wid] = []

    for src in sorted(sources):
        rel = src.relative_to(builder.PROJECT).as_posix()
        bucket = _assign_world_bucket(rel, actor_map) if args.gemini else 'core-c101'
        if not bucket:
            continue
        # Gemini textures & audio are decoded directly from raw WebP/PNG/JPG/MP3 bytes at runtime,
        # avoiding ~50 MB of duplicated .ctex/.mp3str imports.
        if args.gemini and src.suffix.lower() in RAW_RUNTIME_EXTS:
            paths = {rel}
        else:
            paths = set([rel] + builder.disk_files(rel))
        for path in sorted(paths):
            buckets[bucket].append({'pck': 'res://' + path, 'disk': str(builder.PROJECT / path)})
        if src.suffix in ('.gd', '.tscn', '.gdshader', '.gdshaderinc'):
            remap = work / (rel.replace('/', '__') + '.remap')
            remap.write_text(f'[remap]\n\npath="res://{rel}"\n')
            buckets[bucket].append({'pck': 'res://' + rel + '.remap', 'disk': str(remap)})

    new_packs: dict[str, dict] = {}
    world_pack_inputs: dict[str, str] = {}
    prior_inputs: dict = prior_report.get('world_pack_inputs', {}) if isinstance(prior_report, dict) else {}

    # Always build lightweight core-c101
    core_meta, _ = _pack_items(builder, work, out, 'core-c101', buckets['core-c101'])
    new_packs['core-c101'] = core_meta

    reused_world = 0
    rebuilt_world = 0
    if args.gemini:
        for wid in WORLD_PACK_ORDER:
            items = buckets[wid]
            if not items:
                continue
            inp_digest = _bucket_input_digest(items)
            world_pack_inputs[wid] = inp_digest
            if prior_inputs.get(wid) == inp_digest and wid in base['packs']:
                entry = base['packs'][wid]
                pointer = base_file(entry['file'])
                expected = f"oid sha256:{entry['sha256']}\nsize {entry['bytes']}".encode()
                assert pointer.startswith(b'version https://git-lfs.github.com/spec/v1') and expected in pointer
                (out / entry['file']).write_bytes(pointer)
                new_packs[wid] = entry
                reused_world += 1
            else:
                meta, _ = _pack_items(builder, work, out, wid, items)
                new_packs[wid] = meta
                rebuilt_world += 1

    managed_ids = set(new_packs.keys())
    preserved = {name: entry for name, entry in base['packs'].items() if name not in managed_ids}
    for entry in preserved.values():
        # Reuse already-uploaded immutable LFS objects. No need to download legacy packs locally.
        pointer = base_file(entry['file'])
        expected = f"oid sha256:{entry['sha256']}\nsize {entry['bytes']}".encode()
        assert pointer.startswith(b'version https://git-lfs.github.com/spec/v1') and expected in pointer
        (out / entry['file']).write_bytes(pointer)

    manifest = dict(base, version=args.version, createdAt=datetime.now(timezone.utc).isoformat(timespec='seconds'))
    manifest['packs'] = dict(preserved)
    manifest['packs'].update(new_packs)
    manifest['lands'] = dict(base['lands'])
    if args.gemini:
        manifest['lands']['world'] = [wid for wid in WORLD_PACK_ORDER if wid in new_packs]
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

    core_files = [item['pck'] for item in buckets['core-c101']]
    report = {
        'base': args.base,
        'version': args.version,
        'installed_client_code': 101,
        'preserved_packs': len(preserved),
        'reused_world_packs': reused_world,
        'rebuilt_world_packs': rebuilt_world,
        'unchanged_lands': manifest['lands'] == base['lands'],
        'core': manifest['packs']['core-c101'],
        'world_packs': {wid: manifest['packs'][wid] for wid in WORLD_PACK_ORDER if wid in manifest['packs']},
        'world_pack_inputs': world_pack_inputs,
        'changes_only_preview_namespace': not args.gemini,
        'host_scripts': list(HOST_SCRIPTS) if args.gemini else [],
        'changed_apk': False,
        'citadel_preview': args.citadel,
        'gemini_world': args.gemini,
        'files': core_files,
    }
    (out / 'preview-update.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ('files', 'world_pack_inputs')}, indent=2))


if __name__ == '__main__':
    main()

