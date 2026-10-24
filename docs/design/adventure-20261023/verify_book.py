#!/usr/bin/env python3
"""Checks the delivered PDF and content references; does not test game balance."""
from pathlib import Path
import hashlib
import json
import fitz

base = Path(__file__).resolve().parent
manifest = json.loads((base / 'manifest.json').read_text())
data = json.loads((base / 'campaign-data.json').read_text())
for entry in manifest['outputs']:
    payload = (base / entry['path']).read_bytes()
    assert hashlib.sha256(payload).hexdigest() == entry['sha256'], entry['path']
assert len(data['quests']) == len({q['id'] for q in data['quests']}) == 98
assert len(data['items']) == len({i['id'] for i in data['items']}) == 177
pdf = fitz.open(base / 'KI-LEGENDS-KSIEGA-PRZYGODY-v1.0.pdf')
issues = []
for number, page in enumerate(pdf, 1):
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                x0, y0, x1, y1 = span['bbox']
                if x0 < 40 or x1 > page.rect.width - 40 or y0 < 0 or y1 > page.rect.height:
                    issues.append([number, span['text'], list(span['bbox'])])
    assert '\ufffd' not in page.get_text(), number
text = '\n'.join(page.get_text() for page in pdf)
assert all(word in text for word in ['Mędrcy', 'Żar', 'ŹRÓDŁO', 'Wyłącznik', 'Świadka'])
assert all(q['id'] + ' · ' + q['title'] in text for q in data['quests'])
assert not issues, issues
assert len(pdf.get_toc()) > 200
report = {
    'pages': len(pdf),
    'characters': len(text),
    'words': len(text.split()),
    'bookmarks': len(pdf.get_toc()),
    'linkAnnotations': sum(len(page.get_links()) for page in pdf),
    'unicodeSampleAllPresent': True,
    'all98QuestHeadingsPresent': True,
    'manifestHashesMatch': True,
    'textBoundsIssues': issues,
    'dataChecksDuringBuild': [
        'Unique item and quest IDs; all recipe inputs/outputs exist',
        'No recipe dependency cycles; quest prerequisite references exist',
        'Positive quantities; no simple buy/sell or crafting/resale arbitrage',
        'Example XP route walked in unlock/level order; level 20 reachable before M23',
    ],
    'visualReview': 'Cover, TOC, quest cards, equipment, recipes and bestiary sampled at page resolution',
    'limitations': [
        'No gameplay implementation or playtest of the proposed campaign',
        'Visual review sampled pages, not every page',
        'Economy and combat are initial design values, not measured gameplay balance',
    ],
}
(base / 'PDF-QA.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
