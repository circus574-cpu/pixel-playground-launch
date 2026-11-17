"""GPU-generated periodic blend masks; authoring assets, not world placement."""
from pathlib import Path
import hashlib,json,math,time
import numpy as np
import torch
from PIL import Image,ImageDraw

ROOT=Path('/workspace/ki-iso-art2')
OUT=ROOT/'terrain-transitions'
OUT.mkdir(exist_ok=True)
N=1024
torch.set_num_threads(4)
f=torch.fft.fftfreq(N,device='cuda')
radius=f[:,None].square()+f[None,:].square()
definitions=[
 ('ash-road','terrain-fine-ground/fine-warm-ash-1','terrain-production/road-basalt-pavers-2'),
 ('soil-rock','terrain-fine-ground/fine-dark-ash-1','terrain-production/mountain-scree-2'),
 ('dust-crust','terrain-fine-ground/fine-ochre-earth-1','terrain-production/lava-cold-crust-1'),
 ('silt-pebbles','terrain-fine-ground/fine-valley-silt-1','terrain-production/valley-creek-bed-2'),
 ('earth-broken-paving','terrain-fine-ground/fine-packed-road-1','terrain-production/road-broken-cobbles-2'),
 ('loam-aggregate','terrain-fine-ground/fine-lowland-soil-1','terrain-production/ground-basalt-gravel-2'),
]
report={'status':'GPU material-blend authoring masks; not world or gameplay screenshots','encoding':'R=material A weight, G=material B weight, B=0, A=255; R+G=255 per pixel','items':[]}
for index,(name,a_path,b_path) in enumerate(definitions):
 a=torch.tensor(np.asarray(Image.open(ROOT/a_path/'albedo.png')).copy(),device='cuda',dtype=torch.float32)/255
 b=torch.tensor(np.asarray(Image.open(ROOT/b_path/'albedo.png')).copy(),device='cuda',dtype=torch.float32)/255
 for variant in range(2):
  seed=1711204100+index*10+variant
  torch.manual_seed(seed)
  fields=[]
  for sigma in [60,18,4]:
   z=torch.fft.ifft2(torch.fft.fft2(torch.randn((N,N),device='cuda'))*torch.exp(-2*math.pi**2*sigma**2*radius)).real
   fields.append(z/z.std())
  field=fields[0]*.75+fields[1]*.23+fields[2]*.10
  weight=torch.sigmoid(field*5+.3*(variant*2-1))
  channel=(weight*255).round().to(torch.uint8)
  mask=torch.stack([channel,255-channel,torch.zeros_like(channel),torch.full_like(channel,255)],dim=2)
  identifier=f'{name}-{variant+1}'
  path=OUT/f'{identifier}-weights.png'
  Image.fromarray(mask.cpu().numpy()).save(path)
  blended=a*weight[:,:,None]+b*(1-weight[:,:,None])
  image=Image.fromarray((blended.clamp(0,1).cpu().numpy()*255).round().astype('uint8'))
  image.save(OUT/f'{identifier}-example.jpg',quality=92)
  assert bool(((mask[:,:,0].to(torch.int16)+mask[:,:,1].to(torch.int16))==255).all())
  report['items'].append({'id':identifier,'seed':seed,'material_a':a_path,'material_b':b_path,'mask':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sum_weights_exact_255':True})
(OUT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
sheet=Image.new('RGB',(4*256,3*280),(24,20,22));draw=ImageDraw.Draw(sheet)
for i,item in enumerate(report['items']):
 x=i%4*256;y=i//4*280
 sheet.paste(Image.open(OUT/f'{item["id"]}-example.jpg').resize((256,256)),(x,y))
 draw.text((x+4,y+258),item['id'],fill='white')
sheet.save(OUT/'sheet.jpg',quality=92)
print('GPU_TRANSITIONS_COMPLETE',len(report['items']),flush=True)
