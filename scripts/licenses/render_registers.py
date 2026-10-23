#!/usr/bin/env python3
"""Refresh the licensing topic's numeric block and notices; never create extra manuals."""
import collections
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
L = ROOT / 'docs/licenses'

def load(path):
    return json.loads(path.read_text())

def cell(value):
    return str(value).replace('|', '\\|').replace('\n', ' ')

def main():
    assets = load(L / 'asset-inventory.json')
    deps = load(L / 'dependencies/register.json')
    supp = load(L / 'dependencies/supplemental.json')
    by = {row['path']: row for row in supp}
    records = deps['records']
    combined, gaps = {}, []
    for row in records:
        evidence = list(row['legalFiles'])
        extra = by.get(row['path'])
        if extra and extra.get('file'):
            evidence.append(extra)
        for entry in evidence:
            group = combined.setdefault(entry['sha256'], {'file': entry['file'], 'packages': set(), 'sources': set()})
            group['packages'].add(row['name'] + '@' + row['version'])
            group['sources'].add(entry.get('archivePath', entry.get('sourceUrl', '')))
        if not row['legalFiles'] and (not extra or extra.get('status') != 'UPSTREAM_TEXT_AT_REGISTRY_GITHEAD'):
            gaps.append(row)
    for receipt in load(L / 'evidence/source-receipts.json'):
        if receipt['id'] in ('terms-gnu-lgpl3', 'terms-gnu-gpl3') and receipt.get('file'):
            combined[receipt['sha256']] = {
                'file': receipt['file'],
                'packages': {'REFERENCE LICENSE TEXT for LGPL components; source/compliance obligations remain open'},
                'sources': {receipt['url']},
            }
    text = 'KI LEGENDS — THIRD-PARTY NOTICES (AUDIT SUPPLEMENT; NOT A COMPLETE RELEASE COMPLIANCE CERTIFICATE)\n'
    text += 'Lockfile SHA-256: ' + deps['lockfileSha256'] + '\nAudited base: ' + assets['auditedBase'] + '\n'
    text += 'Includes development/optional platforms as a conservative superset. Missing or insufficient legal texts remain for ' + str(len(gaps)) + ' lockfile paths; see docs/LICENCJE.md.\n'
    text += 'LGPL/MPL source and relinking obligations, native bundled-component notices, and artwork clearances are separate outstanding requirements.\n'
    for digest, entry in sorted(combined.items()):
        text += '\n' + '=' * 78 + '\nPackages: ' + ', '.join(sorted(entry['packages'])) + '\nEvidence: ' + '; '.join(sorted(entry['sources'])) + '\nSHA-256: ' + digest + '\n' + '=' * 78 + '\n'
        text += (ROOT / entry['file']).read_bytes().decode('utf-8', errors='replace') + '\n'
    (L / 'THIRD-PARTY-NOTICES.txt').write_text(text)
    summary = f"\n## Liczby historycznego audytu — blok generowany\n\nBaza `{assets['auditedBase']}`, data {assets['date']}.\n{len(assets['assets'])} rekordów zasobów; {assets['trackedFileCount']} plików w ówczesnym zakresie.\n{len(records)} ścieżek lockfile; {len(gaps)} nierozstrzygniętych tekstów/zakresów.\nPełne rekordy w JSON/CSV wskazanym na początku tego dokumentu.\n\n"
    summary += '| SPDX według lockfile | Ścieżki |\n| --- | ---: |\n'
    counts = collections.Counter(row['lockLicense'] for row in records)
    summary += ''.join(f'| {cell(name)} | {count} |\n' for name, count in sorted(counts.items()))
    summary += '\n### Nierozstrzygnięte legal text / zakres\n\n| Ścieżka | Wersja | Deklaracja | Powód |\n| --- | --- | --- | --- |\n'
    for row in gaps:
        extra = by.get(row['path'], {})
        reason = extra.get('scopeWarning', extra.get('error', extra.get('status', 'brak tekstu')))
        summary += '| ' + ' | '.join(map(cell, [row['path'], row['version'], row['lockLicense'], reason])) + ' |\n'
    target = ROOT / 'docs/LICENCJE.md'
    existing = target.read_text()
    start, end = '<!-- LICENSE-SUMMARY:START -->', '<!-- LICENSE-SUMMARY:END -->'
    assert existing.count(start) == existing.count(end) == 1
    before, rest = existing.split(start)
    _, after = rest.split(end)
    target.write_text(before + start + '\n' + summary + '\n' + end + after)
    print(f'Updated LICENCJE.md and notices; {len(records)} lock paths, {len(gaps)} unresolved scopes. No new manuals.')

if __name__ == '__main__':
    main()
