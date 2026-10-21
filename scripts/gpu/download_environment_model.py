"""Download one pinned environment-art checkpoint, verify before activation.
Never touches other models, services, CUDA or PyTorch.
"""
from pathlib import Path
import hashlib, json, time, urllib.request
ROOT = Path('/workspace/ki-legends-gpu')
TARGET = Path('/opt/ComfyUI/models/checkpoints/DreamShaperXL_Turbo_v2_1.safetensors')
REVISION = 'f70ad5bce436c640d23fc02cd0a6ccc787280b6e'
SHA256 = '4496b36d48bfd7cfe4e5dbce3485db567bcefa2bef7238d290dbd45612125083'
URL = 'https://huggingface.co/Lykon/dreamshaper-xl-v2-turbo/resolve/f70ad5bce436c640d23fc02cd0a6ccc787280b6e/DreamShaperXL_Turbo_v2_1.safetensors'
TARGET.parent.mkdir(parents=True, exist_ok=True)
part = TARGET.with_suffix('.partial')
def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(8*1024*1024), b''):h.update(block)
    return h.hexdigest()
if TARGET.exists():
    if digest(TARGET) != SHA256:raise RuntimeError('Existing target differs; preserving it')
else:
    req=urllib.request.Request(URL,headers={'User-Agent':'KiLegends-AssetProduction/1.0'})
    with urllib.request.urlopen(req,timeout=90) as response,part.open('wb') as out:
        total=0;last=time.monotonic()
        while True:
            block=response.read(8*1024*1024)
            if not block:break
            out.write(block);total+=len(block)
            if time.monotonic()-last>15:print(f'Downloaded {total} bytes',flush=True);last=time.monotonic()
    actual=digest(part)
    if actual!=SHA256:raise RuntimeError(f'Checksum mismatch {actual}; not activated')
    part.rename(TARGET)
report={'path':str(TARGET),'bytes':TARGET.stat().st_size,'sha256':SHA256,'revision':REVISION,'license':'CreativeML Open RAIL++-M','status':'verified'}
(ROOT/'technical/environment-model.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)

import shutil
backup=ROOT/'models/checkpoints'/TARGET.name
if not backup.exists():shutil.copyfile(TARGET,backup)
print('Persistent model copy complete',flush=True)
