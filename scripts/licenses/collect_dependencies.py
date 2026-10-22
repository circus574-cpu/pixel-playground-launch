#!/usr/bin/env python3
"""Read-only lockfile audit: verify release tarballs by SRI, retain legal texts; never install/run packages."""
import base64, concurrent.futures, hashlib, io, json, os, pathlib, re, tarfile, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/licenses/dependencies'
CACHE = pathlib.Path(os.environ.get('KI_LICENSE_ARCHIVE_CACHE', '/tmp/ki-license-tarballs'))
LEGAL = re.compile(r'^(licen[sc]es?|copying|notice|authors|copyright|third[ _-]?party)([._ -].*)?$', re.I)

def digest(b): return hashlib.sha256(b).hexdigest()
def audit(item):
    path, entry = item
    name = path.rsplit('node_modules/', 1)[-1]
    result = {'path': path, 'name': name, 'version': entry['version'], 'releaseName': entry.get('name', name), 'lockLicense': entry.get('license'),
              'dev': bool(entry.get('dev')), 'optional': bool(entry.get('optional')),
              'resolved': entry.get('resolved'), 'integrity': entry.get('integrity'), 'legalFiles': [], 'bundleMetadataFiles': []}
    try:
        algorithm, encoded = entry['integrity'].split()[0].split('-', 1)
        expected = base64.b64decode(encoded)
        key = expected.hex()
        cached = CACHE / key
        npmcache = pathlib.Path.home() / '.npm/_cacache/content-v2' / algorithm / key[:2] / key[2:4] / key[4:]
        if cached.exists(): data, origin = cached.read_bytes(), 'verified-audit-cache'
        elif npmcache.exists(): data, origin = npmcache.read_bytes(), 'verified-npm-cache'
        else:
            req = urllib.request.Request(entry['resolved'], headers={'User-Agent': 'Ki-Legends-license-audit/1.0'})
            with urllib.request.urlopen(req, timeout=90) as response: data = response.read(200 * 1024 * 1024)
            origin = 'release-url'
        if hashlib.new(algorithm, data).digest() != expected: raise ValueError('SRI mismatch')
        if not cached.exists(): cached.write_bytes(data)
        result.update(archiveVerified=True, archiveSource=origin, archiveBytes=len(data), archiveSha256=digest(data))
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:*') as archive:
            for member in archive.getmembers():
                if not member.isfile(): continue
                parts = pathlib.PurePosixPath(member.name).parts
                legal = LEGAL.match(parts[-1]) or any(p.lower() in ('licenses','licences') for p in parts[:-1])
                if parts[-1] == 'package.json' and len(parts) <= 2:
                    metadata = json.loads(archive.extractfile(member).read())
                    result['packageMetadata'] = {k: metadata[k] for k in ('name','version','license','author','contributors','homepage','repository') if k in metadata}
                    result['packageJsonSha256'] = digest(archive.extractfile(member).read())
                if parts[-1].lower().startswith('copyright.') and parts[-1].lower().endswith(('.js', '.map')): legal = False
                if name.startswith('@img/') and parts[-1] in ('README.md', 'versions.json'):
                    content = archive.extractfile(member).read(); sha = digest(content)
                    target = OUT / 'texts' / (sha + '.txt'); target.write_bytes(content)
                    result['bundleMetadataFiles'].append({'archivePath':member.name,'sha256':sha,'bytes':len(content),'file':target.relative_to(ROOT).as_posix()})
                if not legal: continue
                if member.size > 4 * 1024 * 1024: raise ValueError('oversize legal file '+member.name)
                content = archive.extractfile(member).read()
                if b'\0' in content: continue
                # Preserve exact bytes. No package payload is extracted or executed.
                sha = digest(content)
                target = OUT / 'texts' / (sha + '.txt')
                target.write_bytes(content)
                result['legalFiles'].append({'archivePath': member.name, 'sha256': sha, 'bytes': len(content), 'file': target.relative_to(ROOT).as_posix()})
        result['status'] = 'SRI_AND_LEGAL_TEXT' if result['legalFiles'] else 'SRI_NO_LEGAL_TEXT'
        metadata = result.get('packageMetadata', {})
        if metadata.get('name') != entry.get('name', name) or metadata.get('version') != entry['version']: result['status'] = 'METADATA_MISMATCH'
        if metadata.get('license') != entry.get('license'): result['licenseDeclarationMismatch'] = True
    except Exception as error:
        result['status'] = 'UNVERIFIED_RELEASE'
        result['error'] = str(error)[:400]
        # Do not silently substitute local files for an integrity-verified release.
    return result

def main():
    lockbytes = (ROOT/'package-lock.json').read_bytes()
    lock = json.loads(lockbytes)
    OUT.mkdir(parents=True, exist_ok=True); (OUT/'texts').mkdir(exist_ok=True); CACHE.mkdir(exist_ok=True)
    entries = [(p,e) for p,e in lock['packages'].items() if p]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor: records = sorted(executor.map(audit, entries), key=lambda r:r['path'])
    output = {'schemaVersion':1, 'lockfileSha256':digest(lockbytes), 'rootPackageLicense':lock['packages'][''].get('license'), 'records':records}
    (OUT/'register.json').write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'entries':len(records), 'statuses':{s:sum(r['status']==s for r in records) for s in sorted({r['status'] for r in records})}, 'legalTexts':len(list((OUT/'texts').glob('*.txt')))}, indent=2))
if __name__ == '__main__': main()
