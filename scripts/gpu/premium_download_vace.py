import os,json,hashlib,subprocess,sys,urllib.request,shutil,time
from pathlib import Path
os.environ['HF_HUB_ENABLE_HF_TRANSFER']='0';os.environ['HF_HUB_DISABLE_XET']='1'
from huggingface_hub import snapshot_download
repo='Wan-AI/Wan2.1-VACE-14B-diffusers';rev='db79b90c60bbb45ceec9e41b9d5a4df934538ac4'
root=Path('/workspace/ki-premium/vace14');root.mkdir(exist_ok=True)
local=Path('/tmp/ki-vace14')
api=json.load(urllib.request.urlopen('https://huggingface.co/api/models/'+repo+'/revision/'+rev+'?blobs=true'))
(root/'upstream.json').write_text(json.dumps(api,indent=2))
p=snapshot_download(repo,revision=rev,local_dir=str(local),allow_patterns=['*.json','*.safetensors','*.md','*.txt','*.model','LICENSE*'],max_workers=4)
rows=[]
for entry in api['siblings']:
 f=local/entry['rfilename']
 if not f.is_file():continue
 h=hashlib.sha256()
 with f.open('rb') as stream:
  for b in iter(lambda:stream.read(16*1024*1024),b''):h.update(b)
 sha=h.hexdigest();lfs=entry.get('lfs',{})
 if lfs:assert sha==lfs['sha256'],f.name
 rows.append({'file':entry['rfilename'],'bytes':f.stat().st_size,'sha256':sha,'upstreamLfsMatch':bool(lfs)})
receipt={'repository':repo,'revision':rev,'license':api.get('cardData',{}).get('license'),'files':rows}
(root/'model-ready.json').write_text(json.dumps(receipt,indent=2))
print('VACE_LOCAL_READY',flush=True)
for row in rows:
 src=local/row['file'];dst=root/'model'/row['file'];dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
 print('PERSISTED',row['file'],flush=True)
(root/'model-persisted.json').write_text(json.dumps(receipt,indent=2))
print('VACE_PERSISTENT_READY',flush=True)
