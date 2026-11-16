from pathlib import Path
import json,shutil,time
root=Path('/workspace/ki-premium'); out=Path('/tmp/ki-premium-model'); out.mkdir(exist_ok=True); manifest=json.loads((root/'model-download.json').read_text()); t=time.monotonic()
for f in manifest['files']:
 src=root/'model'/f['file']; dst=out/f['file']; dst.parent.mkdir(parents=True,exist_ok=True)
 if not dst.exists() or dst.stat().st_size!=f['bytes']:shutil.copyfile(src,dst)
 print('CACHED',f['file'],round(time.monotonic()-t,1),flush=True)
print('LOCAL_MODEL_READY',flush=True)
