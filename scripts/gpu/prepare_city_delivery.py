"""CPU delivery stage: matte isolated GPU props, preserve source provenance.
Use only after inspecting the original image. No map/collision data is edited.
Dependencies: rembg[cpu]==2.0.76, Pillow. Set U2NET_HOME explicitly.
"""
import argparse,hashlib,json,math
from pathlib import Path
from PIL import Image
from rembg import new_session,remove
p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('delivery',type=Path);p.add_argument('--targets',type=Path,required=True);args=p.parse_args()
targets=json.loads(args.targets.read_text())['worlds']
BINDINGS={'verdant-cottage':'object.forest.cottage','aether-sanctum':'object.sanctum','nexus-lab':'object.lab','pyra-fortress':'object.fortress'}
session=new_session('u2net',providers=['CPUExecutionProvider'])
args.delivery.mkdir(parents=True,exist_ok=True)
records=[]
for meta in sorted(args.source.glob('*.json')):
 info=json.loads(meta.read_text());name=info['id'].removesuffix('-guided').removesuffix('-free')
 if name not in BINDINGS or not info['id'].endswith('-guided'):continue
 raw=meta.with_suffix('.png')
 assert hashlib.sha256(raw.read_bytes()).hexdigest()==info['sha256']
 ref=next(o for o in targets[info['world']]['scenery'] if o['sharedBinding']==BINDINGS[name])
 rgba=remove(Image.open(raw).convert('RGB'),session=session)
 # Eliminate numerical model haze; retain antialiasing at the actual silhouette.
 alpha=rgba.getchannel('A');alpha=alpha.point(lambda a:0 if a<10 else a);rgba.putalpha(alpha)
 box=alpha.getbbox();assert box,'Empty foreground'
 crop=rgba.crop(box)
 width=768 if max(ref['worldSize'])>=400 else 512
 height=round(width*ref['worldSize'][1]/ref['worldSize'][0])
 bottom=round(height*ref['origin'][1]);margin=12
 scale=min((width-2*margin)/crop.width,(bottom-margin)/crop.height)
 crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
 canvas=Image.new('RGBA',(width,height));canvas.alpha_composite(crop,((width-crop.width)//2,bottom-crop.height))
 target=args.delivery/(name+'.png');canvas.save(target,optimize=True)
 records.append({'id':name,'world':info['world'],'binding':BINDINGS[name],'width':width,'height':height,'source_sha256':info['sha256'],'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'source_bbox':box,'origin':ref['origin'],'bytes':target.stat().st_size})
 manifest={'schemaVersion':1,'id':'city-foundations-v1','version':'1.0.0','technical':False,'assets':[{'id':v['id'],'version':'1.0.0','kind':'image','url':v['id']+'.png','width':v['width'],'height':v['height']} for v in records],'renderBindings':{v['binding']:{'asset':v['id'],'fit':'contain'} for v in records}}
(args.delivery/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(args.delivery/'provenance.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps(records,indent=2))
