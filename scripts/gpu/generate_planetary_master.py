"""One hero only, awaiting explicit visual approval before any other race/animation.
Identity reference is the original Ki Legends project artwork, never characters
from the user's city moodboards. This is a newly generated design master, not
an animation made by slicing the reference illustration.
"""
from pathlib import Path
import hashlib,json,time,urllib.request
from PIL import Image,ImageOps
ROOT=Path('/workspace/ki-legends-gpu');OUT=ROOT/'renders/hero-planetary-review-v1';OUT.mkdir(parents=True,exist_ok=True)
reference=Path('/opt/ki-legends-project/public/game/assets/origins-v1/planetary-full.webp')
source=Image.open(reference).convert('RGB');source=ImageOps.contain(source,(768,928),Image.Resampling.LANCZOS);canvas=Image.new('RGB',(1024,1024),'white');canvas.paste(source,((1024-source.width)//2,(1024-source.height)//2));inp=ROOT/'input/hero-review';inp.mkdir(exist_ok=True);canvas.save(inp/'planetary-reference.png')
positive='1boy, solo, adult male, full body, standing, short spiky brown hair, amber brown eyes, strong athletic build, confident calm expression, orange scarf, asymmetrical white sleeveless fantasy tunic, brown leather chest harness, bronze and dark steel armored gauntlets, small turquoise crystal inset in gauntlets, dark olive gray loose trousers, layered white and amber split tabard, brown leather belts and pouches, bronze trimmed armored boots, restrained gold ornaments, both hands visible, complete feet visible, fully clothed, full character design, relaxed ready stance, high angle three quarter view, anime fantasy game protagonist, clean precise linework, beautifully painted materials, readable silhouette, isolated on pure white background, no surrounding scenery, wide white margin on all sides, masterpiece, best quality, very aesthetic'
negative='nsfw, nude, naked, child, girl, woman, worst quality, low quality, blurry, cropped, cut off feet, cut off hair, out of frame, close up, portrait, text, logo, watermark, signature, multiple people, duplicate character, extra limbs, missing hands, malformed hands, landscape, city, street, paving stones, ground texture, aura, flames, floating energy, sword, staff, shield'
workflow={
 '1':{'class_type':'CheckpointLoaderSimple','inputs':{'ckpt_name':'animagine-xl-3.1.safetensors'}},
 '2':{'class_type':'CLIPTextEncode','inputs':{'text':positive,'clip':['1',1]}},
 '3':{'class_type':'CLIPTextEncode','inputs':{'text':negative,'clip':['1',1]}},
 '4':{'class_type':'LoadImage','inputs':{'image':'hero-review/planetary-reference.png'}},
 '5':{'class_type':'VAEEncode','inputs':{'pixels':['4',0],'vae':['1',2]}},
 '6':{'class_type':'KSampler','inputs':{'seed':5741001,'steps':28,'cfg':6.5,'sampler_name':'euler_ancestral','scheduler':'normal','denoise':.62,'model':['1',0],'positive':['2',0],'negative':['3',0],'latent_image':['5',0]}},
 '7':{'class_type':'VAEDecode','inputs':{'samples':['6',0],'vae':['1',2]}},
 '8':{'class_type':'SaveImage','inputs':{'filename_prefix':'heroes/planetary-review-v1','images':['7',0]}}
}
def api(path,data=None):
 request=urllib.request.Request('http://127.0.0.1:8189'+path,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(request,timeout=60) as r:return json.load(r)
start=time.monotonic();pid=api('/prompt',{'prompt':workflow,'client_id':'ki-one-race-approval'})['prompt_id'];print('SUBMITTED Planetarni only',pid,flush=True)
while True:
 history=api('/history/'+pid).get(pid)
 if history:
  if history['status']['status_str']!='success':raise RuntimeError(json.dumps(history['status']))
  break
 time.sleep(1)
im=history['outputs']['8']['images'][0];source=ROOT/'output'/im['subfolder']/im['filename'];target=OUT/'planetary-master.png';target.write_bytes(source.read_bytes())
meta={'id':'planetary-master','race':'planetary','world':'verdant','purpose':'single hero identity approval; not a runtime animation','status':'awaiting-user-approval','reference':'original project origins-v1/planetary-full.webp','reference_sha256':hashlib.sha256(reference.read_bytes()).hexdigest(),'model_revision':'483f0c322568ed13697ed01dd0be07204746d12b','model_sha256':'e3c47aedb06418c6c331443cd89f2b3b3b34b7ed2102a3d4c4408a8d35aad6b0','seed':5741001,'workflow':workflow,'seconds':time.monotonic()-start,'width':1024,'height':1024,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
(OUT/'planetary-master.json').write_text(json.dumps(meta,indent=2)+'\n');print('PLANETARY_MASTER_COMPLETE',round(meta['seconds'],2),flush=True)
