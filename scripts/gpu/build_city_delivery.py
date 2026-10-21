"""CPU-only, reviewed selection -> periodic tiles and anchored RGBA sprites.
Raw masters remain immutable. New game visuals are preview-only until rollout QA.
"""
from pathlib import Path
import argparse,hashlib,json
import numpy as np
from PIL import Image
from scipy import ndimage
from rembg import new_session,remove
p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,default=Path.cwd());p.add_argument('--selection',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
assert not a.out.exists(),'Use a new delivery directory'
a.out.mkdir(parents=True)
targets=json.loads((a.repo/'art/pipeline/gpu-production-targets.json').read_text())['worlds'];selection=json.loads(a.selection.read_text());session=None;records=[];assets=[];bindings={}
def periodic(im):
 data=np.asarray(im.convert('RGB').resize((256,256),Image.Resampling.LANCZOS)).astype(float)
 for axis in [0,1]:
  data=np.swapaxes(data,0,axis);original=data.copy();band=24
  for i in range(band):
   t=(i/(band-1))**2*(3-2*i/(band-1));average=(original[i]+original[-1-i])/2
   data[i]=original[i]*t+average*(1-t);data[-1-i]=original[-1-i]*t+average*(1-t)
  data=np.swapaxes(data,0,axis)
 data=np.clip(data,0,255).astype('uint8');data[-1]=data[0];data[:,-1]=data[:,0]
 return Image.fromarray(data)
for item in selection:
 source=(a.repo/item['source']).resolve();assert source.is_relative_to(a.repo.resolve())
 im=Image.open(source);source_digest=hashlib.sha256(source.read_bytes()).hexdigest();name=item['id'];tile=item.get('kind')=='tile'
 record={'id':name,'world':item['world'],'binding':item['binding'],'source':item['source'],'source_sha256':source_digest}
 if tile:
  canvas=periodic(im);bindings[item['binding']]={'asset':name,'tileSize':[256,256]};record['edge_processing']='24px periodic crossfade; opposing boundary pixels identical'
 else:
  if im.mode=='RGBA' and im.getchannel('A').getextrema()[0]==0:rgba=im.copy()
  else:
   if session is None:session=new_session('u2net',providers=['CPUExecutionProvider'])
   rgba=remove(im.convert('RGB'),session=session)
  alpha=np.asarray(rgba.getchannel('A')).copy();alpha[alpha<10]=0
  if item.get('largestComponent'):
   labels,n=ndimage.label(alpha>96);counts=np.bincount(labels.ravel());counts[0]=0;primary=np.argmax(counts);region=ndimage.binary_dilation(labels==primary,iterations=3);alpha[~region]=0
  rgba.putalpha(Image.fromarray(alpha));box=rgba.getchannel('A').getbbox();assert box,'Empty foreground: '+name
  # Foreground framing is recorded for visual QA; recanvas never reconstructs a clipped object.
  record['source_bbox']=list(box);crop=rgba.crop(box)
  obj=next(o for o in targets[item['world']]['scenery'] if o['sharedBinding']==item['binding'])
  width=768 if max(obj['worldSize'])>=350 else 512;height=round(width*obj['worldSize'][1]/obj['worldSize'][0]);origin=obj['origin'];margin=12
  # Every current selected city prop is foot anchored. Center-anchored future props need explicit review.
  assert origin[1]>=.9
  bottom=round(height*origin[1]);scale=min((width-2*margin)/crop.width,(bottom-margin)/crop.height);crop=crop.resize((max(1,round(crop.width*scale)),max(1,round(crop.height*scale))),Image.Resampling.LANCZOS)
  canvas=Image.new('RGBA',(width,height));canvas.alpha_composite(crop,((width-crop.width)//2,bottom-crop.height));bindings[item['binding']]={'asset':name,'fit':'contain'};record['origin']=origin
  # Full transparent padding is mandatory after delivery normalization.
  alpha=canvas.getchannel('A');assert not alpha.crop((0,0,width,8)).getbbox();assert not alpha.crop((0,height-8,width,height)).getbbox()
 output=a.out/(name+'.png');canvas.save(output,optimize=True);width,height=canvas.size
 assets.append({'id':name,'version':'1.0.0','kind':'image','url':output.name,'width':width,'height':height});record.update({'width':width,'height':height,'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()});records.append(record);print('PREPARED',name,flush=True)
manifest={'schemaVersion':1,'id':'city-environments','version':'1.0.0','previewOnly':True,'assets':assets,'renderBindings':bindings}
(a.out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(a.out/'provenance.json').write_text(json.dumps(records,indent=2)+'\n');print('DELIVERY_READY',len(assets),flush=True)
