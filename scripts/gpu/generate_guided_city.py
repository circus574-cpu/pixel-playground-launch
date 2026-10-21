"""Constrained image-to-image; no generation of characters or whole-map backgrounds."""
from pathlib import Path
import hashlib,json,time
from PIL import Image
from generate_city_batch import api,graph,JOBS
ROOT=Path('/workspace/ki-legends-gpu');OUT=ROOT/'renders/city-guided-v1';OUT.mkdir(parents=True,exist_ok=True)
for name,world,seed,prompt in JOBS:
 guide=ROOT/'renders/city-guides-v1'/(world+'-guide.png')
 while not guide.exists():time.sleep(2)
 inp=ROOT/'input/city-guides';inp.mkdir(exist_ok=True)
 image=Image.open(guide).convert('RGBA');white=Image.new('RGBA',image.size,'white');white.alpha_composite(image);white.convert('RGB').save(inp/guide.name)
 for strength in [.45,.60]:
  key=name+'-'+str(round(strength*100));meta=OUT/(key+'.json')
  if meta.exists():continue
  g=graph(prompt,seed,'guided/'+key)
  g['2']['inputs']['text']='isometric building, no humans, scenery, game asset, full building, white background, '+prompt+', orthographic elevated view, fully visible roof and foundations, highly detailed hand-painted anime fantasy architecture, centered, no crop, single building'
  g['3']['inputs']['text']='people, person, character, face, girl, boy, armor, weapon, dress, portrait, text, watermark, scenery background, cityscape, cropped, out of frame, photograph'
  g['4']={'class_type':'LoadImage','inputs':{'image':'city-guides/'+guide.name}}
  g['8']={'class_type':'VAEEncode','inputs':{'pixels':['4',0],'vae':['1',2]}}
  g['5']['inputs'].update({'latent_image':['8',0],'denoise':strength})
  start=time.monotonic();pid=api('/prompt',{'prompt':g,'client_id':'ki-city-guided-v1'})['prompt_id'];print('SUBMITTED',key,pid,flush=True)
  while True:
   h=api('/history/'+pid).get(pid)
   if h:
    if h['status']['status_str']!='success':raise RuntimeError(json.dumps(h['status']))
    break
   time.sleep(1)
  im=h['outputs']['7']['images'][0];source=ROOT/'output'/im['subfolder']/im['filename'];target=OUT/(key+'.png');target.write_bytes(source.read_bytes())
  m={'id':key,'world':world,'seed':seed,'denoise':strength,'workflow':g,'seconds':time.monotonic()-start,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'guide_sha256':hashlib.sha256(guide.read_bytes()).hexdigest(),'status':'generated-pending-visual-review'}
  meta.write_text(json.dumps(m,indent=2)+'\n');print('COMPLETE',key,round(m['seconds'],2),flush=True)
print('GUIDED_BATCH_COMPLETE',flush=True)
