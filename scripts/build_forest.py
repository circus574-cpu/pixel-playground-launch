"""Offline production export: python3 scripts/build_forest.py SOURCE_DIR.
Source filenames and prompts are documented in docs/FOREST-ASSETS.md.
No network, model calls or secrets. Requires Pillow and numpy.
"""
import json, math, sys, hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ROOT=Path(__file__).resolve().parents[1]
SRC=Path(sys.argv[1])
OUT=ROOT/'public/game/assets/forest-v3';OUT.mkdir(parents=True,exist_ok=True)
SOURCE={'terrain':'exec-b4d198ac-ef08-4632-af61-e1b29d94d8fb.png','nature':'exec-8615d23d-a85b-4495-abc0-f1772917f379.png','buildings':'exec-0c73c94c-bbdb-4e50-b42e-76716c98c9f7.png','props':'exec-76748ebd-0160-48e5-8777-0e16383d1482.png'}
TILE=64;WORLD_TILE=32;COLS=96;ROWS=64;W=COLS*WORLD_TILE;H=ROWS*WORLD_TILE

def periodic(im):
 a=np.array(im.resize((128,128),Image.Resampling.LANCZOS).convert('RGB'),dtype=np.float32)
 # Equal opposite edges, blending the correction gradually over eight texels.
 for axis in [0,1]:
  for i in range(8):
   j=127-i; weight=(1-i/8)/2
   if axis==0:
    aa=a[i].copy();bb=a[j].copy();a[i]=aa*(1-weight)+bb*weight;a[j]=bb*(1-weight)+aa*weight
   else:
    aa=a[:,i].copy();bb=a[:,j].copy();a[:,i]=aa*(1-weight)+bb*weight;a[:,j]=bb*(1-weight)+aa*weight
 return Image.fromarray(a.clip(0,255).astype('uint8'))
terrain=Image.open(SRC/SOURCE['terrain']);tw,th=terrain.size
materials=[]
for index,name in enumerate(['grass','soil','stone','water']):
 col=index%2;row=index//2
 im=periodic(terrain.crop((col*tw//2+tw//4-128,row*th//2+th//4-128,col*tw//2+tw//4+128,row*th//2+th//4+128)))
 im.save(OUT/(name+'.png'));materials.append(im.resize((TILE,TILE),Image.Resampling.LANCZOS).convert('RGBA'))
# A 16-corner dual-grid transition mask. Shared edges have identical weights.
u=np.linspace(0,1,TILE)[None,:];v=np.linspace(0,1,TILE)[:,None]
weights=[(1-u)*(1-v),u*(1-v),u*v,(1-u)*v]
masks=[]
for mask in range(16):
 field=sum(weights[i] for i in range(4) if mask&(1<<i)) if mask else np.zeros((TILE,TILE))
 alpha=np.clip((field-0.5)*4+0.5,0,1)
 masks.append(Image.fromarray(np.rint(alpha*255).astype('uint8')))
frames=[materials[0]]
for material in materials[1:]:
 for mask in range(16):
  im=material.copy();im.putalpha(masks[mask]);frames.append(im)
# Two-pixel extrusion protects the linear-filtered tile edges at fractional zoom.
PITCH=68;atlas=Image.new('RGBA',(8*PITCH,7*PITCH))
for i,im in enumerate(frames):
 x=(i%8)*PITCH+2;y=(i//8)*PITCH+2
 atlas.paste(im,(x,y));atlas.paste(im.crop((0,0,1,TILE)).resize((2,TILE)),(x-2,y));atlas.paste(im.crop((63,0,64,TILE)).resize((2,TILE)),(x+64,y))
 atlas.paste(im.crop((0,0,TILE,1)).resize((TILE,2)),(x,y-2));atlas.paste(im.crop((0,63,TILE,64)).resize((TILE,2)),(x,y+64))
 for dx,dy,sx,sy in [(-2,-2,0,0),(64,-2,63,0),(-2,64,0,63),(64,64,63,63)]:atlas.paste(im.getpixel((sx,sy)),(x+dx,y+dy,x+dx+2,y+dy+2))
atlas.save(OUT/'terrain.png')
# Fitted source bounds avoid clipping at approximate generated sheet divisions.
boxes={
 'nature':[('oak',(0,0,.52,.52)),('fir',(.53,0,1,.52)),('bush',(0,.53,.5,1)),('rock',(.52,.53,1,1))],
 'buildings':[('cottage',(0,0,.47,.5)),('inn',(.48,0,1,.5)),('forge',(0,.51,.54,1)),('market',(.55,.51,1,1))],
 'props':[('fountain',(0,0,.5,.55)),('lamp',(.52,0,1,.55)),('bridge',(0,.56,.5,1)),('fence',(.51,.56,1,1))]
}
objects_atlas=Image.new('RGBA',(1536,1152));atlas_json={'frames':{},'meta':{'image':'objects.webp','size':{'w':1536,'h':1152},'scale':'1'}};sprites={};asset_info=[]
for group,items in boxes.items():
 source=Image.open(SRC/SOURCE[group]).convert('RGBA');sw,sh=source.size
 for name,box in items:
  im=source.crop(tuple(round(value*(sw if i%2==0 else sh)) for i,value in enumerate(box)))
  alpha=np.array(im.getchannel('A'))
  if group=='props':alpha=np.where(alpha>=240,alpha,0).astype('uint8')
  else:alpha=np.where(alpha>=24,alpha,0).astype('uint8')
  im.putalpha(Image.fromarray(alpha));bounds=im.getbbox()
  if bounds is None:raise ValueError('Empty sprite '+name)
  im=im.crop(bounds);im.thumbnail((360,360),Image.Resampling.LANCZOS)
  # One independent file per production object plus one packed runtime atlas.
  im.save(OUT/(name+'.webp'),quality=94,method=4)
  i=len(sprites);px=(i%4)*384+12;py=(i//4)*384+12
  objects_atlas.paste(im,(px,py));sprites[name]=im
  atlas_json['frames'][name]={'frame':{'x':px,'y':py,'w':im.width,'h':im.height},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':im.width,'h':im.height},'sourceSize':{'w':im.width,'h':im.height}}
  asset_info.append({'name':name,'width':im.width,'height':im.height,'alpha':True,'source':SOURCE[group],'crop':box})
objects_atlas.save(OUT/'objects.webp',quality=94,method=4)
(OUT/'objects.json').write_text(json.dumps(atlas_json,separators=(',',':')))

def river(y):return 2500+math.sin(y/270)*70

def road_y(x):
 if x<1480:return 1000+130*math.sin((1480-x)/750)
 t=min(1,(x-1480)/(river(1000)-1480))
 return 1000+95*math.sin(math.pi*t)
def material(x,y):
 d=abs(x-river(y))
 if d<124:return 3
 if d<148:return 1
 vertical=abs(x-(1480+math.sin((y-1000)/280)*70))
 horizontal=abs(y-road_y(x))
 plaza=((x-1480)/255)**2+((y-1000)/190)**2
 if plaza<1 or vertical<49 or horizontal<46:return 2
 if plaza<1.25 or vertical<72 or horizontal<70:return 1
 for hx,hy in [(1040,790),(1940,760),(1050,1340),(1960,1350)]:
  if abs(x-hx)<40 and min(hy,road_y(hx))<y<max(hy,road_y(hx)):return 1
 return 0
vertices=[[material(x*WORLD_TILE,y*WORLD_TILE) for x in range(COLS+1)]for y in range(ROWS+1)]
layers=[[],[],[],[]]
for y in range(ROWS):
 for layer in layers:layer.append([])
 for x in range(COLS):
  corners=[vertices[y][x],vertices[y][x+1],vertices[y+1][x+1],vertices[y+1][x]]
  layers[0][y].append(0)
  for layer in [1,2,3]:
   mask=sum(1<<i for i,m in enumerate(corners) if (m in [1,2] if layer==1 else m==layer))
   layers[layer][y].append(1+(layer-1)*16+mask if mask else -1)
objects=[]
def add(kind,x,y,width,solid=True):
 im=sprites[kind];height=round(width*im.height/im.width)
 obj={'id':kind+'-'+str(len(objects)),'kind':kind,'x':round(x),'y':round(y),'width':round(width),'height':height,'anchorX':.5,'anchorY':.5,'solid':solid}
 if kind in ['cottage','inn','forge','market']:obj['footprint']={'width':round(width*.88),'height':round(height*.85)}
 elif kind=='fountain':obj['footprint']={'width':round(width*.84),'height':round(height*.7)}
 elif kind=='rock':obj['footprint']={'width':round(width*.68),'height':round(height*.6)}
 elif kind in ['oak','fir']:obj['footprint']={'width':24,'height':24}
 elif kind=='lamp':obj['footprint']={'width':12,'height':12}
 elif kind=='fence':obj['footprint']={'width':round(width*.9),'height':12}
 objects.append(obj)
for kind,x,y,w in [('cottage',1040,610,260),('inn',1940,570,350),('forge',1050,1510,330),('cottage',1950,1500,260),('market',1190,1020,155),('fountain',1480,1000,175)]:add(kind,x,y,w)
add('bridge',river(1000),1000,420,False)
for x,y in [(1340,750),(1640,750),(1340,1240),(1640,1240),(900,1040),(2070,1040),(2260,890),(2250,1120)]:add('lamp',x,y,36)
# Deterministic, naturally jittered forest distribution, with open roads and clearing.
for iy,y0 in enumerate(range(45,H,128)):
 for ix,x0 in enumerate(range(45,W,130)):
  x=x0+((ix*73+iy*41)%75)-37;y=y0+((ix*43+iy*79)%67)-33
  clearing=((x-1490)/880)**2+((y-1030)/710)**2
  if material(x,y)!=0 or clearing<1 or x>river(y)-185:continue
  add('fir' if (ix+iy)%4==0 else 'oak',x,y,170+(ix*13+iy*7)%80)
# Tree groups and garden accents inside the village, never on the main path.
for x,y in [(740,600),(820,1350),(2110,1300),(1720,670),(1200,710),(1760,1380),(1250,1390),(2100,940),(1020,1090),(2160,650),(1850,1080),(750,1150),(2240,1480),(710,1550),(920,450),(2100,425)]:
 if material(x,y)==0:add('oak',x,y,185)
for i in range(160):
 x=170+(i*337)%2660;y=200+(i*263)%1660
 if material(x,y)!=0 or abs(x-river(y))<190:continue
 if any(abs(x-o['x'])<o['width']*.55 and abs(y-o['y'])<o['height']*.55 for o in objects if o['kind'] in ['cottage','inn','forge','market','fountain']):continue
 add('rock' if i%7==0 else 'bush',x,y,70 if i%7==0 else 50+(i%4)*10,i%7==0)
for x,y in [(840,1490),(850,1580),(1180,1670),(1860,1700),(2090,1550)]:add('fence',x,y,145)
world={'version':3,'width':W,'height':H,'tileSize':WORLD_TILE,'textureTileSize':64,'cols':COLS,'rows':ROWS,'vertices':vertices,'layers':layers,'objects':objects,'spawn':{'x':1495,'y':1260},'enemies':[{'x':2050,'y':1030},{'x':2100,'y':1600},{'x':1850,'y':1800},{'x':750,'y':1000}],'bridge':{'x':river(1000),'y':1000,'halfHeight':76},'riverRows':[{'x':round(river(y)-124),'y':y,'width':248,'height':32}for y in range(0,H,32)if not 905<=y<=1095]}
# Resolve any spawn intersecting an object footprint; retain deterministic positions.
def blocked(x,y):
 for o in objects:
  f=o.get('footprint')
  if o['solid'] and f and abs(x-o['x'])<f['width']/2+14 and abs(y-o['y'])<f['height']/2+14:return True
 return abs(x-river(y))<140 and not 914<y<1090
for enemy in world['enemies']:
 if blocked(enemy['x'],enemy['y']):
  found=False
  for radius in range(20,301,20):
   for dx,dy in [(radius,0),(-radius,0),(0,radius),(0,-radius)]:
    x=enemy['x']+dx;y=enemy['y']+dy
    if 40<x<W-40 and 40<y<H-40 and not blocked(x,y):enemy.update(x=x,y=y);found=True;break
   if found:break
  if not found:raise ValueError('No valid spawn')
(ROOT/'src/game/world/forest-map.json').write_text(json.dumps(world,separators=(',',':')))
# Thumbnail assembled from the same tile layers and object placements; not concept art.
preview=Image.new('RGBA',(W,H))
for y in range(ROWS):
 for x in range(COLS):
  tile=frames[0].copy()
  for layer in range(1,4):
   idx=layers[layer][y][x]
   if idx>=0:tile.alpha_composite(frames[idx])
  preview.paste(tile.resize((WORLD_TILE,WORLD_TILE),Image.Resampling.LANCZOS),(x*WORLD_TILE,y*WORLD_TILE))
for o in sorted(objects,key=lambda o: -10 if o['kind']=='bridge' else o['y']):
 im=sprites[o['kind']].resize((o['width'],o['height']),Image.Resampling.LANCZOS)
 if o['kind']!='bridge':
  shadow=Image.new('RGBA',im.size,(0,8,2,0));shadow.putalpha(im.getchannel('A').point(lambda a:round(a*.2)));shadow=shadow.filter(ImageFilter.GaussianBlur(4))
  preview.alpha_composite(shadow,(round(o['x']-o['width']*.5+10),round(o['y']-o['height']*.5+14)))
 preview.alpha_composite(im,(round(o['x']-o['width']*.5),round(o['y']-o['height']*.5)))
preview.resize((768,512),Image.Resampling.LANCZOS).convert('RGB').save(OUT/'minimap.webp',quality=90,method=4)
manifest={'version':3,'tileSize':32,'textureTileSize':64,'tileMargin':2,'tileSpacing':4,'terrainTileCount':49,'objects':asset_info,'sourceSha256':{name:hashlib.sha256((SRC/file).read_bytes()).hexdigest()for name,file in SOURCE.items()},'world':{'width':W,'height':H,'objects':len(objects)},'generation':'OpenAI ImageGen; model version not exposed','processing':'quadrant extraction, alpha cleanup, trim, scale, atlas packing, periodic edges, dual-grid masks, extrusion'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'objects':len(objects),'terrainTiles':49,'runtimeFiles':['terrain.png','objects.webp','objects.json','minimap.webp','manifest.json']}))
