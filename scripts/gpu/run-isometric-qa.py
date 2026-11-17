#!/usr/bin/env python3
"""Run real Godot, retain exit code and reject engine/script errors in addition to numerical checks."""
import json,os,subprocess,time
from pathlib import Path
root=Path('/workspace/ki-terrain3d');log=root/'qa/isometric-native.txt'
env=dict(os.environ,DISPLAY=':99',XDG_RUNTIME_DIR='/tmp/ki-runtime')
start=time.time()
with log.open('w') as output:
 result=subprocess.run([str(root/'tools/godot-bin'),'--audio-driver','Dummy','--rendering-method','mobile','--rendering-driver','vulkan','--path','/workspace/ki-isometric-pyra','--','--qa'],stdout=output,stderr=subprocess.STDOUT,env=env,timeout=180)
errors=[s for s in log.read_text().splitlines() if 'ERROR:' in s or 'SCRIPT ERROR' in s]
report={'exit_code':result.returncode,'engine_errors':errors,'seconds':time.time()-start,'passed':result.returncode==0 and not errors}
(root/'qa/isometric-process.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report));raise SystemExit(0 if report['passed'] else 1)
