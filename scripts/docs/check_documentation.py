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
for path in all_md:
    rel = path.relative_to(D)
    if len(rel.parts) > 1:
        assert re.fullmatch(r'zmiany/\d{4}-\d{2}-\d{2}/ZMIANY\.md', str(rel)), rel
    text = path.read_text()
    for target in re.findall(r'\]\(([^)]+)\)', text):
        target = target.strip('<>')
        if re.match(r'[a-z]+://|mailto:|#', target):
            continue
        target = unquote(target.split('#', 1)[0])
        linked = (path.parent / target).resolve()
        assert linked.exists(), (str(rel), target)
        if linked.is_file():
            assert str(linked.relative_to(ROOT)) in TRACKED, (str(rel), target, 'linked file is not tracked by Git')
    for start, end in [('<!-- BESTIARY:START -->', '<!-- BESTIARY:END -->'), ('<!-- LICENSE-SUMMARY:START -->', '<!-- LICENSE-SUMMARY:END -->')]:
        assert text.count(start) == text.count(end)
relocation = json.loads((D / 'zmiany/2026-10-23/segregacja.json').read_text())
base = relocation['baseCommit']
for entry in relocation['relocatedEvidence']:
    payload = (ROOT / entry['current']).read_bytes()
    original = subprocess.check_output(['git', 'show', base + ':' + entry['previous']], cwd=ROOT)
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
    assert (ROOT / name).read_bytes() == original, name
    checked += 1
for name in ['docs/design/Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf', 'KI-LEGENDS-KSIEGA-PRZYGODY-v1.0.pdf']:
    assert (ROOT / name).read_bytes() == subprocess.check_output(['git', 'show', base + ':' + name], cwd=ROOT), name
print(f'PASS: 10 thematic manuals, {len(all_md)-10} daily journals, local links, {len(relocation["relocatedEvidence"])} unchanged evidence files and {checked} protected source/evidence files.')

for name in ['AGENTS.md', 'README.md', 'src/game/README.md']:
    path = ROOT / name
    for target in re.findall(r'\]\(([^)]+)\)', path.read_text()):
        if re.match(r'[a-z]+://|mailto:|#', target):
            continue
        assert (path.parent / unquote(target.split('#', 1)[0])).exists(), (name, target)
