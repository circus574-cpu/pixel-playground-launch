#!/usr/bin/env python3
"""Verify coverage and byte identities of audit evidence; no tests of gameplay or production."""
import csv, hashlib, json, pathlib, re, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2];L=ROOT/'docs/licenses'
def load(p):return json.loads(p.read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
    assets=load(L/'asset-inventory.json');deps=load(L/'dependencies/register.json');supp=load(L/'dependencies/supplemental.json');rows=assets['assets']
    lock=load(ROOT/'package-lock.json');expected={p for p in lock['packages'] if p}
    assert {r['path'] for r in deps['records']}==expected
    assert len(deps['records'])==len(expected)
    assert deps['lockfileSha256']==sha((ROOT/'package-lock.json').read_bytes())
    assert all(r.get('archiveVerified') for r in deps['records'])
    for r in deps['records']:
        entry=lock['packages'][r['path']]
        assert r['version']==entry['version'] and r['integrity']==entry['integrity'] and r['resolved']==entry['resolved']
        assert r['packageMetadata']['version']==r['version']
        assert r['packageMetadata']['name']==entry.get('name',r['name'])
        for e in r['legalFiles']+r.get('bundleMetadataFiles',[]):
            b=(ROOT/e['file']).read_bytes();assert sha(b)==e['sha256'] and len(b)==e['bytes']
    for r in supp:
        if r.get('file'):assert sha((ROOT/r['file']).read_bytes())==r['sha256']
    for r in load(L/'evidence/source-receipts.json'):
        if r.get('file'):assert sha((ROOT/r['file']).read_bytes())==r['sha256']
        if r.get('expectedSha256'):assert r['hashMatches']
    tracked=[]
    for r in rows:
        p=ROOT/r['path']
        if not r['path'].startswith('/') and '#' not in r['path'] and p.is_file():
            tracked.append(r['path']);b=p.read_bytes()
            if r.get('pointerSha256'):
                assert sha(b)==r['pointerSha256'];assert ('oid sha256:'+r['sha256']).encode() in b
            else:assert sha(b)==r['sha256'] and len(b)==r['bytes']
    assert len(tracked)==assets['trackedFileCount']
    assert len(rows)==len({r['path'] for r in rows})
    for r in rows:
        assert all(r.get(k) for k in ['path','authorOrGenerator','source','license','commercialBasis','evidence','status'])
    with (L/'asset-inventory.csv').open() as f:assert len(list(csv.DictReader(f)))==len(rows)
    pdf=load(L/'evidence/pdf-images.json');assert pdf['imagePlacements']==11 and pdf['uniqueImages']==10
    assert all(any(r['matchesTrackedReference']==f'public/game/assets/stage3/references/{race}.jpg' for r in pdf['images']) for race in ['planetary','sage','android','legend'])
    assert sha((ROOT/'docs/design/Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf').read_bytes())==pdf['pdfSha256']
    # Every document row must be present exactly once in the individual table.
    text=(ROOT/'docs/ASSET-LICENSE-REGISTER.md').read_text().split('<!-- GENERATED-ASSET-TABLE -->')[1]
    assert sum(l.startswith('| ') for l in text.splitlines())==len(rows)+2
    for r in rows:assert '| '+r['path']+' |' in text
    # Changes to preexisting files must stay in audit documentation; no asset, app, lockfile or production changes.
    changed=subprocess.check_output(['git','diff','--name-only',assets['auditedBase']],cwd=ROOT,text=True).splitlines()
    assert all(p.startswith(('docs/','scripts/licenses/')) for p in changed),changed
    print(f'PASS: {len(rows)} asset records, {len(expected)} exact lockfile paths; evidence hashes, PDF mapping, full Markdown/CSV coverage, and change scope verified.')
if __name__=='__main__':main()
