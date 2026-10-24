#!/usr/bin/env python3
"""Build a local-only standalone owner atlas; never writes under public/ or deploys."""
import argparse, base64, gzip, hashlib, io, json, subprocess
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
def load(p):return json.loads((ROOT/p).read_text())
def image_url(data,mime):return 'data:'+mime+';base64,'+base64.b64encode(data).decode()
def build(output):
 output.mkdir(parents=True,exist_ok=True)
 root=Path('public/game/worlds/superior-v1');index=load(root/'index.json')
 data={'index':index,'planet':load(Path('src/game/world/planet.json')),'features':{},'monsters':load(Path('art/production/enemies/roster.json'))['monsters'],'campaign':load(Path('docs/design/adventure-20261023/campaign-data.json')),'sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sources':{}}
 for info in index['features']:
  id=info['id'];base=root/id;w=load(base/'world.json');sp=load(base/'spawns.json');terrain=load(base/'terrain.json')
  for file in ['world.json','spawns.json','terrain.json']:
   data['sources'][str(base/file)]=hashlib.sha256((ROOT/base/file).read_bytes()).hexdigest()
  # Compact all authored scenery records, including exact original geometry/bindings.
  scenery=[]
  for p in sorted((ROOT/root/'art'/id/'chunks').glob('*.art.json')):
   scenery.extend(json.loads(p.read_text())['objects'])
  palette=['#214c50','#709677','#507e67','#a59774','#789387','#b8c6c0','#4e7964','#8d705c','#71926b','#9a8867','#658778','#8b9181','#728975','#6f8b7c','#7e8971','#738778']
  pixels=[]
  for value,count in terrain['flags']:
   color=palette[(value>>4)&15] if value&1 else '#153943'
   pixels.extend([tuple(bytes.fromhex(color[1:]))]*count)
  im=Image.new('RGB',(terrain['width'],terrain['height']));im.putdata(pixels);buf=io.BytesIO();im.save(buf,format='PNG',optimize=True)
  originalArt=load(root/'art'/id/'feature.art.json')
  data['features'][id]={'world':w,'spawns':sp,'scenery':scenery,'art':originalArt,'background':image_url(buf.getvalue(),'image/png')}
 data['atlas']=image_url((ROOT/'src/assets/planet-map/atlas-1920.webp').read_bytes(),'image/webp')
 counts={k:sum(len(v['world'][k]) for v in data['features'].values()) for k in ['settlements','doors','locations','npcs','resources','roads','dungeons','buildings']}
 counts.update(overworld=sum(len(v['spawns']['overworld']) for v in data['features'].values()),interiors=sum(len(v['spawns']['interiors']) for v in data['features'].values()),scenery=sum(len(v['scenery']) for v in data['features'].values()),hidden=sum(sum(bool(p['hidden']) for p in v['world']['locations']) for v in data['features'].values()),quests=len(data['campaign']['quests']))
 assert counts['overworld']==6062 and counts['interiors']==2220 and counts['dungeons']==152
 data['counts']=counts
 payload=base64.b64encode(gzip.compress(json.dumps(data,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)).decode()
 template=(ROOT/'scripts/atlas/owner-atlas.html').read_text()
 html=template.replace('__PAYLOAD__',payload)
 (output/'SUPERIOR-ATLAS-WLASCICIELA.html').write_text(html)
 (output/'manifest.json').write_text(json.dumps({'codeSha':data['sha'],'counts':counts,'sources':data['sources'],'privacy':'Local-only export; not published, not copied under public, no analytics or external requests.','limits':['Quest coordinates are shown only for exact unique giver matches; remaining quests are catalogued without invented coordinates.','Dungeon solutions are generated navigation paths, not evidence of secret doors.','Scenery comes from all generated art chunks.']},ensure_ascii=False,indent=2))
 print(json.dumps({'output':str(output),'counts':counts,'htmlBytes':len(html.encode())},ensure_ascii=False))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);build(p.parse_args().output)
