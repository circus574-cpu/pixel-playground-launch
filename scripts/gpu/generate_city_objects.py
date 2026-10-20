"""Resumable GPU production queue. Outputs masters and reproducible JSON per asset."""
from pathlib import Path
import json,time,hashlib
from PIL import Image
from generate_city_batch import api,graph
ROOT=Path('/workspace/ki-legends-gpu');OUT=ROOT/'renders/city-objects-v1';OUT.mkdir(parents=True,exist_ok=True)
JOBS=json.loads(Path('/opt/ki-legends-gpu/scripts/city-environment-jobs.json').read_text())
for i,job in enumerate(JOBS):
 name=job['id'];meta=OUT/(name+'.json')
 if meta.exists():continue
 tile=job.get('kind')=='tile';seed=5742026+i
 g=graph(job['prompt'],seed,'objects/'+name);g['1']['inputs']['ckpt_name']='DreamShaperXL_Turbo_v2_1.safetensors'
 style='professional hand-painted 2D fantasy game asset, intricate clear materials, vibrant but harmonious colors, fine ink details, masterpiece'
 object_view='(single isolated object:1.3), (pure white background:1.4), full object entirely visible with wide empty margin, high angle orthographic view, entire roof and foundation visible, no crop, soft northwest lighting'
 g['2']['inputs']['text']=job['prompt']+', '+style+(', '+object_view if not tile else ', orthographic overhead texture, fills entire canvas, no white background, no perspective')
 g['3']['inputs']['text']='people, characters, person, girl, boy, face, portrait, armor, weapon character, photograph, photorealism, lowpoly, clay, basic shapes, cropped, cut off, out of frame, text, logo, watermark, UI, interface, sky, horizon'+(', background landscape, cityscape, street, ground plane' if not tile else ', object, building, person, perspective, shadows, vignette, border')
 g['5']['inputs'].update({'steps':10,'cfg':2.0,'sampler_name':'dpmpp_sde','scheduler':'sgm_uniform'})
 if job.get('guide'):
  source_guide=Image.open(ROOT/'input/city-guides'/(job['world']+'-guide.png')).convert('RGB').resize((800,800),Image.Resampling.LANCZOS)
  guide_canvas=Image.new('RGB',(1024,1024),'white');guide_canvas.paste(source_guide,(112,112));guide_dir=ROOT/'input/city-staged';guide_dir.mkdir(exist_ok=True);guide_canvas.save(guide_dir/(job['world']+'-guide.png'))
  g['4']={'class_type':'LoadImage','inputs':{'image':'city-staged/'+job['world']+'-guide.png'}};g['8']={'class_type':'VAEEncode','inputs':{'pixels':['4',0],'vae':['1',2]}};g['5']['inputs'].update({'latent_image':['8',0],'denoise':.76})
 start=time.monotonic();pid=api('/prompt',{'prompt':g,'client_id':'ki-city-objects-v1'})['prompt_id'];print('SUBMITTED',i+1,len(JOBS),name,pid,flush=True)
 while True:
  h=api('/history/'+pid).get(pid)
  if h:
   if h['status']['status_str']!='success':raise RuntimeError(json.dumps(h['status']))
   break
  time.sleep(1)
 im=h['outputs']['7']['images'][0];source=ROOT/'output'/im['subfolder']/im['filename'];target=OUT/(name+'.png');target.write_bytes(source.read_bytes())
 m={**job,'seed':seed,'workflow':g,'seconds':time.monotonic()-start,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'model_revision':'f70ad5bce436c640d23fc02cd0a6ccc787280b6e','model_sha256':'4496b36d48bfd7cfe4e5dbce3485db567bcefa2bef7238d290dbd45612125083','status':'generated-pending-visual-review'}
 meta.write_text(json.dumps(m,indent=2)+'\n');print('COMPLETE',name,round(m['seconds'],2),flush=True)
print('CITY_OBJECTS_COMPLETE',flush=True)
