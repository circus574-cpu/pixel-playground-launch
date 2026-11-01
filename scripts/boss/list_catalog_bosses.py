import re
from pathlib import Path

txt = Path('src/game/bosses/catalog.ts').read_text(encoding='utf-8')
blocks = re.findall(r'id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*title:\s*"([^"]+)",\s*continent:\s*"([^"]+)",\s*race:\s*"([^"]+)",\s*level:\s*(\d+)', txt)
for i, (bid, name, title, cont, race, lvl) in enumerate(blocks):
    print(f"{i+1}. [{cont.upper()}] {bid}: {name} ({title}) - Lv {lvl} {race}")
