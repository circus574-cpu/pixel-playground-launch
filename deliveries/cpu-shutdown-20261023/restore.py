#!/usr/bin/env python3
"""Verify split CPU backup, restore regular project files and check every source checksum."""
import argparse
import hashlib
import json
from pathlib import Path
import tarfile
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path, help='New destination directory')
    args = parser.parse_args()
    folder = Path(__file__).resolve().parent
    index = json.loads((folder / 'backup-index.json').read_text())
    if index['format'] != 'ki-cpu-project-backup-1':
        raise ValueError('Unsupported backup format')
    if args.output.exists():
        raise FileExistsError('Output must not exist: ' + str(args.output))
    whole = hashlib.sha256()
    with tempfile.TemporaryFile() as stream:
        for part in index['parts']:
            name = part['name']
            if Path(name).name != name:
                raise ValueError('Unsafe part path')
            raw = (folder / name).read_bytes()
            if len(raw) != part['bytes'] or hashlib.sha256(raw).hexdigest() != part['sha256']:
                raise ValueError('Backup part checksum mismatch: ' + name)
            whole.update(raw)
            stream.write(raw)
        if stream.tell() != index['archiveBytes'] or whole.hexdigest() != index['archiveSha256']:
            raise ValueError('Assembled archive checksum mismatch')
        stream.seek(0)
        with tarfile.open(fileobj=stream, mode='r:gz') as archive:
            members = archive.getmembers()
            if any(not m.isfile() or Path(m.name).is_absolute() or '..' in Path(m.name).parts for m in members):
                raise ValueError('Archive must contain safe regular files only')
            manifest = json.load(archive.extractfile('restore-manifest.json'))
            if len(manifest) != index['files']:
                raise ValueError('Source manifest count mismatch')
            expected = {'ki-legends-worldgen/' + n for n in manifest} | {'restore-manifest.json', 'restore-environment.json'}
            if len(members) != len(expected) or {m.name for m in members} != expected:
                raise ValueError('Unexpected or missing archive entries')
            args.output.mkdir(parents=True)
            archive.extractall(args.output, filter='data')
    for name, record in manifest.items():
        path = (args.output / 'ki-legends-worldgen' / name).resolve()
        if not path.is_relative_to(args.output.resolve()):
            raise ValueError('Unsafe source manifest path')
        payload = path.read_bytes()
        if len(payload) != record['bytes'] or hashlib.sha256(payload).hexdigest() != record['sha256']:
            raise ValueError('Restored file checksum mismatch: ' + name)
    print(json.dumps({'passed': True, 'verifiedFiles': len(manifest),
                      'archiveSha256': whole.hexdigest(), 'output': str(args.output)}))


if __name__ == '__main__':
    main()
