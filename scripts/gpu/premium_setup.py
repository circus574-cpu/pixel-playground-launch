from pathlib import Path
import subprocess,json,hashlib,urllib.request,sys,os
os.environ['HF_HUB_ENABLE_HF_TRANSFER']='0'
os.environ['HF_HUB_DISABLE_XET']='1'
root=Path('/workspace/ki-premium'); root.mkdir(exist_ok=True)
python=Path(sys.executable)
subprocess.run([str(python),'-m','pip','install','diffusers==0.35.2','transformers==4.57.1','accelerate==1.11.0','safetensors','Pillow','scipy'],check=True)
code="""from huggingface_hub import snapshot_download
from pathlib import Path
import hashlib,json
root=Path('/workspace/ki-premium'); rev='f70ad5bce436c640d23fc02cd0a6ccc787280b6e'
p=snapshot_download('Lykon/dreamshaper-xl-v2-turbo',revision=rev,local_dir=str(root/'model'),allow_patterns=['*.json','*.txt','*.md','*/*.json','*/*.txt','*/*.fp16.safetensors'],max_workers=4)
rows=[]
for f in sorted(Path(p).rglob('*')):
 if f.is_file() and '.cache' not in f.parts:
  h=hashlib.sha256()
  with f.open('rb') as stream:
   for b in iter(lambda:stream.read(8*1024*1024),b''):h.update(b)
  rows.append({'file':str(f.relative_to(p)),'bytes':f.stat().st_size,'sha256':h.hexdigest()})
(root/'model-download.json').write_text(json.dumps({'repository':'Lykon/dreamshaper-xl-v2-turbo','revision':rev,'files':rows},indent=2))
print('MODEL_READY',flush=True)
"""
(root/'download_model.py').write_text(code)
subprocess.run([str(python),str(root/'download_model.py')],check=True)
