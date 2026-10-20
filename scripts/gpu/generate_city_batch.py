"""Pinned ComfyUI workflow for isolated city sprites, never whole-map paintings."""
from pathlib import Path
import hashlib,json,time,urllib.request
ROOT=Path('/workspace/ki-legends-gpu')
OUT=ROOT/'renders/city-v1'
OUT.mkdir(parents=True,exist_ok=True)
MODEL=ROOT/'models/checkpoints/animagine-xl-3.1.safetensors'
JOBS=[
 ('verdant-cottage','verdant',741110,'a single exquisite woodland fantasy guild house, timber framing and cream stone walls, elaborate moss green shingled roof, carved oak pillars, amber glass lanterns, leafy ivy vines, small wooden front porch, arched entrance facing viewer, hand-painted botanical details, one standalone building'),
 ('aether-sanctum','aether',741111,'a single magnificent wizard academy temple building, ivory limestone, intricate golden filigree, layered violet indigo roof spires, hovering amethyst crystal above roof, tall arched stained glass windows, turquoise magical lamps, symmetrical central entrance facing viewer, one standalone building'),
 ('nexus-lab','nexus',741112,'a single elegant futuristic science fantasy laboratory building, white ceramic and dark blue metal architecture, tall luminous cyan crystal reactor spire, fine gold circuit inlays, blue glass windows, angular roofs and curved buttresses, ornate entrance facing viewer, one standalone building'),
 ('pyra-fortress','pyra',741113,'a single monumental volcanic fantasy fortress gatehouse, dark charcoal basalt stone walls, red tiled roofs and golden trims, glowing orange furnace gate facing viewer, two fortified towers with crimson banners, intricate metal ornaments, restrained ember light, one standalone building'),
]
STYLE='masterpiece, best quality, very aesthetic, anime fantasy MMORPG game asset, professional hand-painted 2D environment sprite, high angle top down view, orthographic projection, camera elevation 60 degrees, front facing south facade, entire object fully visible, centered isolated object on pure white background, generous white margin on all sides, coherent geometry, crisp readable silhouette, beautiful detailed materials, soft directional light from upper left, no ground plane, no landscape, no people'
NEG='worst quality, low quality, blurry, text, watermark, logo, signature, letters, people, person, character, girl, boy, portrait, crowd, landscape, scenery, cityscape, multiple buildings, horizon, sky, ground, grass field, cropped, cut off, out of frame, tilted camera, fisheye, photorealistic, 3d render, wireframe, lowpoly'
def api(path,data=None):
 req=urllib.request.Request('http://127.0.0.1:8189'+path,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
def graph(prompt,seed,prefix):
 return {
 '1':{'class_type':'CheckpointLoaderSimple','inputs':{'ckpt_name':MODEL.name}},
 '2':{'class_type':'CLIPTextEncode','inputs':{'text':STYLE+', '+prompt,'clip':['1',1]}},
 '3':{'class_type':'CLIPTextEncode','inputs':{'text':NEG,'clip':['1',1]}},
 '4':{'class_type':'EmptyLatentImage','inputs':{'width':1024,'height':1024,'batch_size':1}},
 '5':{'class_type':'KSampler','inputs':{'seed':seed,'steps':28,'cfg':7.0,'sampler_name':'euler_ancestral','scheduler':'normal','denoise':1.0,'model':['1',0],'positive':['2',0],'negative':['3',0],'latent_image':['4',0]}},
 '6':{'class_type':'VAEDecode','inputs':{'samples':['5',0],'vae':['1',2]}},
 '7':{'class_type':'SaveImage','inputs':{'filename_prefix':'city-v1/'+prefix,'images':['6',0]}}
 }
while not MODEL.exists():time.sleep(5)
for name,world,seed,prompt in JOBS:
 meta=OUT/(name+'.json')
 if meta.exists():print('Already completed',name,flush=True);continue
 workflow=graph(prompt,seed,name);start=time.monotonic()
 response=api('/prompt',{'prompt':workflow,'client_id':'ki-city-production-v1'})
 pid=response['prompt_id'];print('Submitted',name,pid,flush=True)
 while True:
  history=api('/history/'+pid).get(pid)
  if history:
   if history['status']['status_str']!='success':raise RuntimeError(json.dumps(history['status']))
   break
  time.sleep(2)
 image=history['outputs']['7']['images'][0]
 source=ROOT/'output'/image['subfolder']/image['filename']
 target=OUT/(name+'.png');target.write_bytes(source.read_bytes())
 metadata={'id':name,'world':world,'seed':seed,'model_revision':'483f0c322568ed13697ed01dd0be07204746d12b','model_sha256':'e3c47aedb06418c6c331443cd89f2b3b3b34b7ed2102a3d4c4408a8d35aad6b0','workflow':workflow,'seconds':time.monotonic()-start,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'status':'generated-pending-visual-review'}
 meta.write_text(json.dumps(metadata,indent=2)+'\n');print('COMPLETED',name,round(metadata['seconds'],2),metadata['sha256'],flush=True)
print('BATCH_COMPLETE',flush=True)
