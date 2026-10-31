#!/usr/bin/env python3
"""Check ten thematic manuals, daily logs, links, sources and byte-preserving evidence moves."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[2]
D = ROOT / 'docs'
TRACKED = set(subprocess.check_output(['git', 'ls-files', '--cached'], cwd=ROOT, text=True).splitlines())
EXPECTED = {
    'INDEX.md', 'ZASADY.md', 'RASY-I-POSTACIE.md', 'ROZWOJ-I-WALKA.md',
    'SWIAT-I-MIASTA.md', 'GPU-I-ZASOBY.md', 'ARCHITEKTURA-I-TESTY.md',
    'FABULA-I-EKWIPUNEK.md', 'LICENCJE.md', 'PLAN-I-ZADANIA.md',
}
assert {p.name for p in D.glob('*.md')} == EXPECTED
all_md = list(D.rglob('*.md'))
daily_journals = 0
for path in all_md:
    rel = path.relative_to(D)
    rel_posix = rel.as_posix()
    if len(rel.parts) > 1:
        assert re.fullmatch(
            r'zmiany/\d{4}-\d{2}-\d{2}/ZMIANY\.md|zmiany/2026-10-29/GEMINI-VFX-(DOSTAWA-2|SELEKCJA)\.md|katalog-przedmiotow-v2/(README|MANIFEST_BINARNY|ZASADY_BALANSU_PASYWNE_ARTEFAKTY_V2)\.md',
            rel_posix,
        ), rel_posix
        if rel_posix.endswith('/ZMIANY.md'):
            daily_journals += 1
    text = path.read_text(encoding='utf-8')
    for target in re.findall(r'\]\(([^)]+)\)', text):
        target = target.strip('<>')
        if re.match(r'[a-z]+://|mailto:|#', target):
            continue
        target = unquote(target.split('#', 1)[0])
        linked = (path.parent / target).resolve()
        assert linked.exists(), (rel_posix, target)
        if linked.is_file():
            linked_posix = linked.relative_to(ROOT).as_posix()
            assert linked_posix in TRACKED or re.fullmatch(r'docs/zmiany/\d{4}-\d{2}-\d{2}/ZMIANY\.md', linked_posix), (rel_posix, target, 'linked file is not tracked by Git')
    for start, end in [('<!-- BESTIARY:START -->', '<!-- BESTIARY:END -->'), ('<!-- LICENSE-SUMMARY:START -->', '<!-- LICENSE-SUMMARY:END -->')]:
        assert text.count(start) == text.count(end)
relocation = json.loads((D / 'zmiany/2026-10-23/segregacja.json').read_text(encoding='utf-8'))
base = relocation['baseCommit']
for entry in relocation['relocatedEvidence']:
    payload = (ROOT / entry['current']).read_bytes()
    original = subprocess.check_output(['git', 'show', base + ':' + entry['previous']], cwd=ROOT)
    if payload != original and payload.replace(b'\r\n', b'\n') == original:
        payload = payload.replace(b'\r\n', b'\n')
    assert hashlib.sha256(payload).hexdigest() == entry['sha256'] == hashlib.sha256(original).hexdigest(), entry['current']
for entry in relocation['documents']:
    assert (ROOT / entry['current']).exists(), entry
    original = subprocess.check_output(['git', 'show', base + ':' + entry['previous']], cwd=ROOT)
    assert hashlib.sha256(original).hexdigest() == entry['previousSha256'], entry['previous']
# Canonical inputs, originals and rights evidence stay intact. Only the book's location manifest and QA report may change.
protected = ['docs/design/data/', 'docs/design/identity/', 'docs/design/original-pdf-parts/', 'docs/design/source-annexes/', 'docs/licenses/dependencies/', 'docs/licenses/evidence/']
files = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', base], cwd=ROOT, text=True).splitlines()
checked = 0
for name in files:
    if not any(name.startswith(prefix) for prefix in protected) or name.endswith('.md'):
        continue
    original = subprocess.check_output(['git', 'show', base + ':' + name], cwd=ROOT)
    payload = (ROOT / name).read_bytes()
    assert payload == original or payload.replace(b'\r\n', b'\n') == original, name
    checked += 1
for name in ['docs/design/Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf', 'KI-LEGENDS-KSIEGA-PRZYGODY-v1.0.pdf']:
    assert (ROOT / name).read_bytes() == subprocess.check_output(['git', 'show', base + ':' + name], cwd=ROOT), name
print(f'PASS: 10 thematic manuals, {daily_journals} daily journals, local links, {len(relocation["relocatedEvidence"])} unchanged evidence files and {checked} protected source/evidence files.')

for name in ['AGENTS.md', 'README.md', 'src/game/README.md']:
    path = ROOT / name
    for target in re.findall(r'\]\(([^)]+)\)', path.read_text(encoding='utf-8')):
        if re.match(r'[a-z]+://|mailto:|#', target):
            continue
        assert (path.parent / unquote(target.split('#', 1)[0])).exists(), (name, target)
