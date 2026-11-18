#!/usr/bin/env python3
"""Run the original installed APK against the actual preview PCK over local HTTP."""
import argparse
import http.server
import importlib.util
import json
import os
import subprocess
import threading
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--apk',required=True)
parser.add_argument('--release',default=str(ROOT/'deliveries/godot-content-1.14.1'))
parser.add_argument('--output',default='/tmp/ki-preview-update-e2e')
args=parser.parse_args()
work=Path(args.output);work.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('core_test',ROOT/'scripts/godot/e2e_core.py')
core_test=importlib.util.module_from_spec(spec);spec.loader.exec_module(core_test)
with zipfile.ZipFile(args.apk) as apk:
    apk.extractall(work/'apk',[n for n in apk.namelist() if n.startswith('assets/')])
base=work/'apk/assets'
listing=[{'pck':'res://'+str(p.relative_to(base)),'disk':str(p)} for p in base.rglob('*') if p.is_file() and p.name!='assets.sparsepck' and '_cl_' not in p.parts]
listing.append({'pck':'res://e2e_preview_update.gd','disk':str(ROOT/'ports/godot-pyra/tests/e2e_preview_update.gd')})
(work/'base.json').write_text(json.dumps(listing))
subprocess.run(['godot','--headless','--audio-driver','Dummy','--path',str(core_test.PROJECT),'--script','res://tools/pack_builder.gd','--',str(work/'base.json'),str(work/'base.pck')],check=True)
manifest=json.loads((Path(args.release)/'manifest.json').read_text())
entry=manifest['packs']['core-c101']
report_file=Path(args.release)/'preview-update.json'
citadel=report_file.exists() and json.loads(report_file.read_text()).get('citadel_preview')
extra=['--qa-citadel'] if citadel else []
if report_file.exists() and json.loads(report_file.read_text()).get('gemini_world'):
    extra.append('--qa-gemini')
core_test.Fake.key='core-c101';core_test.Fake.offer=entry
core_test.Fake.files={entry['file']:Path(args.release)/entry['file']}
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),core_test.Fake)
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    run=subprocess.run(['godot','--audio-driver','Dummy','--rendering-method','gl_compatibility','--main-pack',str(work/'base.pck'),'--script','res://e2e_preview_update.gd','--',f'--server=http://127.0.0.1:{server.server_address[1]}',f'--qa-output={work}',*extra],env={**os.environ,'XDG_DATA_HOME':str(work/'user')},capture_output=True,text=True,timeout=240)
finally:server.shutdown()
(work/'runtime.txt').write_text(run.stdout+'\n'+run.stderr)
result=json.loads((work/'results.json').read_text())
assert run.returncode==0 and result['failed']==0,result
assert 'SCRIPT ERROR:' not in run.stdout+run.stderr and '\nERROR:' not in run.stdout+run.stderr
print('INSTALLED APK SERVER UPDATE PASS',result['passed'])
