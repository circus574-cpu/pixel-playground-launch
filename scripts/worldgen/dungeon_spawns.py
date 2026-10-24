"""Independent canonical-bestiary placement on verified dungeon floors."""
import argparse,json,math
from pathlib import Path
import numpy as np
from generate import digest,canonical
from planet_generate import read,write,point,cell_of

def main():
 p=argparse.ArgumentParser();p.add_argument('--dungeons',required=True);p.add_argument('--bestiary',required=True);p.add_argument('--world',required=True);p.add_argument('--output',required=True);a=p.parse_args();root=Path(a.dungeons);catalog=read(a.bestiary);reports=[]
 output=Path(a.output)
 if output.exists():raise FileExistsError(str(output))
 output.mkdir(parents=True)
 for region in read(root/'dungeon-report.json')['features']:
  feature=region['feature'];directory=root/feature;manifest=read(directory/'manifest.json')
  for name,sha in manifest['files'].items():
   if digest((directory/name).read_bytes())!=sha:raise ValueError('Dungeon source modified: '+name)
  affinity=read(Path(a.world)/feature/'world.json')['affinity'];pool=[m for m in catalog if m['world']==affinity];count=0
  (output/feature).mkdir()
  for reference in read(directory/'index.json'):
   floor=read(directory/reference['path']);seed=int.from_bytes(bytes.fromhex(digest(floor['id'].encode()))[:4],'little');rng=np.random.default_rng(seed)
   excluded=[floor['entrance'],floor['exit'],*floor['keys'],*floor['gates'],*floor['chests']];cells=[]
   for y,row in enumerate(floor['floor']):
    for x,v in enumerate(row):
     q=point(64,x,y)
     if v=='1'and all(math.hypot(q['x']-t['x'],q['y']-t['y'])>192 for t in excluded):cells.append(q)
   rng.shuffle(cells);spawns=[];wanted=8+floor['depth']*3
   for q in cells:
    if any(math.hypot(q['x']-s['x'],q['y']-s['y'])<128 for s in spawns):continue
    m=pool[(count+len(spawns))%len(pool)];spawns.append({'id':floor['id']+'-enemy-'+str(len(spawns)),'kind':m['id'],**q,'level':m['level'],'respawnMs':m['respawn'],'homeLeash':min(256,m['traits']['leash']),'packExpansion':False,'instance':floor['id']})
    if len(spawns)>=wanted:break
   if not spawns:raise ValueError('Empty dungeon spawn layout')
   write(output/feature/(floor['id']+'.json'),{'floor':floor['id'],'floorSha256':digest((directory/reference['path']).read_bytes()),'spawns':spawns,'activation':{'maximumActive':16,'sleepBeyond':1200},'runtimeInstalled':False});count+=len(spawns)
  reports.append({'feature':feature,'floors':region['floors'],'spawns':count,'passed':True})
 write(output/'dungeon-spawn-report.json',{'features':reports,'spawns':sum(r['spawns']for r in reports),'bestiarySha256':digest(canonical(catalog)),'geometryChanged':False,'runtimeInstalled':False});print(json.dumps({'passed':True,'spawns':sum(r['spawns']for r in reports)}))
if __name__=='__main__':main()
