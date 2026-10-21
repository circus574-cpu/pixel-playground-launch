"""Environment model comparison against fixed Blender guides, one seed/world."""
from pathlib import Path
import hashlib,json,time
from generate_city_batch import api,graph,JOBS
ROOT=Path('/workspace/ki-legends-gpu');OUT=ROOT/'renders/city-environment-v1';OUT.mkdir(parents=True,exist_ok=True)
MODEL=Path('/opt/ComfyUI/models/checkpoints/DreamShaperXL_Turbo_v2_1.safetensors')
while not MODEL.exists():time.sleep(2)
for name,world,seed,prompt in JOBS:
 for variant in ['guided','free']:
  key=name+'-'+variant;meta=OUT/(key+'.json')
  if meta.exists():continue
  g=graph(prompt,seed,'environment/'+key)
  g['1']['inputs']['ckpt_name']=MODEL.name
  g['2']['inputs']['text']='(isolated full building:1.3), (plain white background:1.3), orthographic high angle game view, whole building fits in frame with wide empty margin, '+prompt+', exquisite hand painted 2D fantasy game sprite, rich ornamental architecture, beautifully painted stone and wood materials, delicate ink line accents, intricate details, vibrant colors, professional Japanese fantasy environment art, soft northwest light, no people'
  g['3']['inputs']['text']='people, characters, girl, boy, person, face, portrait, dress, armor, weapons, photograph, photorealism, low poly, basic shapes, clay, flat shading, close up, cropped, cut off, out of frame, text, logo, watermark, city background, landscape, street, sky, ground plane'
  g['5']['inputs'].update({'steps':10,'cfg':2.0,'sampler_name':'dpmpp_sde','scheduler':'sgm_uniform'})
  if variant=='guided':
   g['4']={'class_type':'LoadImage','inputs':{'image':'city-guides/'+world+'-guide.png'}}
   g['8']={'class_type':'VAEEncode','inputs':{'pixels':['4',0],'vae':['1',2]}}
   g['5']['inputs'].update({'latent_image':['8',0],'denoise':.82})
  start=time.monotonic();pid=api('/prompt',{'prompt':g,'client_id':'ki-city-environment-v1'})['prompt_id'];print('SUBMITTED',key,pid,flush=True)
  while True:
   h=api('/history/'+pid).get(pid)
   if h:
    if h['status']['status_str']!='success':raise RuntimeError(json.dumps(h['status']))
    break
   time.sleep(1)
  im=h['outputs']['7']['images'][0];source=ROOT/'output'/im['subfolder']/im['filename'];target=OUT/(key+'.png');target.write_bytes(source.read_bytes())
  m={'id':key,'world':world,'seed':seed,'workflow':g,'seconds':time.monotonic()-start,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'model_revision':'f70ad5bce436c640d23fc02cd0a6ccc787280b6e','model_sha256':'4496b36d48bfd7cfe4e5dbce3485db567bcefa2bef7238d290dbd45612125083','status':'generated-pending-visual-review'}
  meta.write_text(json.dumps(m,indent=2)+'\n');print('COMPLETE',key,round(m['seconds'],2),flush=True)
print('ENVIRONMENT_BATCH_COMPLETE',flush=True)
