"""Prepare directional SOURCE sprites, never animation frames, from generated turnaround sheets.
Retains all raw sheets; deterministic alpha noise cleanup and fixed per-master calibration only.
"""
import argparse,json,hashlib,shutil
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import label
p=argparse.ArgumentParser();p.add_argument('input',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
if a.output.exists():raise SystemExit('Immutable output exists')
a.output.mkdir(parents=True)
registry={'down':('directions-a.png',(0,0,2,2)),'down-right':('directions-b.png',(1,1,2,2)),'left':('directions-a.png',(0,1,2,2)),'up-left':('directions-a.png',(1,1,2,2)),'up':('directions-b.png',(0,0,2,2)),'right':('directions-b.png',(0,1,2,2)),'down-left':('directions-c.png',(0,0,2,1)),'up-right':('directions-c.png',(1,0,2,1))}
records=[]
for direction,(name,(col,row,cols,rows)) in registry.items():
 raw=a.input/name;im=Image.open(raw).convert('RGBA');w,h=im.size;box=(col*w//cols,row*h//rows,(col+1)*w//cols,(row+1)*h//rows);cell=im.crop(box);pixels=np.array(cell);rgb=pixels[:,:,:3].astype(np.int16)
 red=(rgb[:,:,0]>180)&(rgb[:,:,0]-rgb[:,:,1]>100)&(rgb[:,:,0]-rgb[:,:,2]>100)
 red_count=int(((pixels[:,:,3]>0)&red).sum());pixels[red,3]=0
 labels,n=label(pixels[:,:,3]>8);sizes=np.bincount(labels.ravel());keep=sizes>=24;keep[0]=False;valid=keep[labels];removed=int(((pixels[:,:,3]>0)&~valid).sum());pixels[~valid,3]=0
 clean=Image.fromarray(pixels,'RGBA');bounds=clean.getchannel('A').getbbox();assert bounds
 height=bounds[3]-bounds[1];scale=336/height;content=clean.crop(bounds);size=(round(content.width*scale),336);content=content.resize(size,Image.Resampling.LANCZOS)
 canvas=Image.new('RGBA',(512,512));x=round(256+(bounds[0]-cell.width/2)*scale);y=384-336;canvas.alpha_composite(content,(x,y));target=a.output/(direction+'.png');canvas.save(target)
 b=canvas.getchannel('A').getbbox();assert b and min(b[:2])>=8 and max(b[2:])<=504
 records.append({'direction':direction,'raw_sheet':name,'raw_sha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'cell':box,'source_bounds':bounds,'scale':scale,'paste':[x,y],'alpha_bounds':b,'removed_red_artifact_pixels':red_count,'removed_small_alpha_component_pixels':removed,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'status':'directional-source-master-not-animation-frame'})
(a.output/'masters.manifest.json').write_text(json.dumps({'technique':'painted directional source sprites for deforming2D rig','canvas':[512,512],'fixed_origin':[.5,.75],'target_alpha_height':336,'directions':records},indent=2)+'\n')
print('PREPARED_DIRECTIONAL_MASTERS',len(records))
