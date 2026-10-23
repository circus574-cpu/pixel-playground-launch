#!/usr/bin/env python3
"""Separate deterministic combat placement over verified, immutable planet terrain."""
import argparse,concurrent.futures,json,math,time
from pathlib import Path
import numpy as np
from scipy import ndimage
from generate import canonical,digest
from planet_generate import read,write,cell_of,point,take
VERSION='superior-spawns-1.0'

def verify_region(directory):
    manifest=read(directory/'manifest.json')
    for name,expected in manifest['files'].items():
        p=(directory/name).resolve()
        if not p.is_relative_to(directory.resolve())or not p.is_file()or digest(p.read_bytes())!=expected:raise ValueError('Invalid terrain manifest: '+name)
    return manifest

def load_arrays(directory):
    plan=read(directory/'world.json');cell=plan['geometry']['cellSize'];shape=(plan['geometry']['height']//cell,plan['geometry']['width']//cell);arrays={k:np.zeros(shape,bool)for k in ['walkable','safe','roads','land']}
    for chunk in read(directory/'chunks.json'):
        x,y=chunk['x']//cell,chunk['y']//cell
        with np.load(directory/chunk['terrain'])as data:
            for k in arrays:h,w=data[k].shape;arrays[k][y:y+h,x:x+w]=data[k]
    return plan,arrays

def placement(plan,arrays,catalog,seed):
    rng=np.random.default_rng(seed);cell=plan['geometry']['cellSize'];safe=arrays['safe'];walk=arrays['walkable'];road=arrays['roads'];distance_safe=ndimage.distance_transform_edt(~safe)*cell;distance_road=ndimage.distance_transform_edt(~road)*cell
    labels,_=ndimage.label(walk);x,y=cell_of(plan['locations'][0],cell);reachable=labels==labels[y,x]
    # A chase must remain outside a city even at maximum home leash, wander and aggro radius.
    # Per-kind exclusion includes all three, plus 256 j. margin; no monster can start on a road.
    masks={};overworld=[];occupied=np.zeros_like(walk)
    sources=[m for m in catalog if m['world']in plan['spawnAffinities']]
    if not sources:raise ValueError('Missing canonical bestiary')
    area=int(arrays['land'].sum())*cell*cell;count=max(len(sources)*3,int(area/550000))
    for i in range(count):
        m=sources[i%len(sources)];traits=m['traits'];margin=max(traits['leash'],traits.get('wander',0),m['agro'])+256
        if m['id']not in masks:masks[m['id']]=walk&reachable&(distance_safe>margin)&(distance_road>160)
        available=masks[m['id']]&~occupied;options=take(rng,available,300)
        if not len(options):continue
        # Difficulty rises away from a safe settlement; statistics remain untouched bestiary values.
        distances=np.array([distance_safe[yy,xx] for yy,xx in options]);wanted=(m['level']/20)*max(2000,float(distance_safe.max()))
        yy,xx=options[np.argmin(np.abs(distances-wanted))];p=point(cell,xx,yy)
        spawn={'id':plan['feature']+'-spawn-'+str(i),'kind':m['id'],**p,'level':m['level'],'respawnMs':m['respawn'],'homeLeash':traits['leash'],'safeExclusion':margin,'streamCell':[p['x']//2048,p['y']//2048],'groupId':plan['feature']+'-group-'+str(i),'packSizePolicy':'one authored slot; runtime must not auto-expand unvalidated pack offsets'}
        overworld.append(spawn);r=8;y0=max(0,yy-r);x0=max(0,xx-r);occupied[y0:yy+r+1,x0:xx+r+1]=True
    interiors=[]
    for d in plan['dungeons']:
        size=d['cellSize'];floor=np.array([[v=='1'for v in row]for row in d['floor']]);candidates=np.argwhere(floor)
        # Keep the entire entrance and exit neighbourhood peaceful; patrols remain in this instance.
        candidates=[(yy,xx)for yy,xx in candidates if math.hypot((xx+.5)*size-d['entrance']['x'],(yy+.5)*size-d['entrance']['y'])>320 and math.hypot((xx+.5)*size-d['exit']['x'],(yy+.5)*size-d['exit']['y'])>320]
        for i in range(0,len(candidates),18):
            yy,xx=candidates[i];m=sources[(i//18)%len(sources)];interiors.append({'id':d['id']+'-spawn-'+str(i//18),'dungeon':d['id'],'kind':m['id'],**point(size,xx,yy),'level':m['level'],'respawnMs':m['respawn'],'homeLeash':min(192,m['traits']['leash']),'navigation':'dungeon-floor-only; do not cross walls or portal','instance':d['id']})
    report=validate(plan,arrays,catalog,overworld,interiors)
    return {'version':1,'generator':VERSION,'feature':plan['feature'],'seed':seed,'overworld':overworld,'interiors':interiors,'activation':{'cellSize':2048,'radius':1400,'sleepBeyond':1900,'maximumActive':24,'maximumPerFrameActivations':2,'stateRetention':'retain killed/respawn state when unloading; no respawn farming by crossing chunks','runtimeInstalled':False}},report

def validate(plan,arrays,catalog,overworld,interiors):
    errors=[];defs={m['id']:m for m in catalog};cell=plan['geometry']['cellSize'];distance_safe=ndimage.distance_transform_edt(~arrays['safe'])*cell
    for p in overworld:
        x,y=cell_of(p,cell);m=defs.get(p['kind']);margin=max(m['traits']['leash'],m['traits'].get('wander',0),m['agro'])+256 if m else math.inf
        if not m:errors.append('Unknown monster')
        if not arrays['walkable'][y,x]or arrays['safe'][y,x]or arrays['roads'][y,x]or distance_safe[y,x]<=margin:errors.append('Unsafe home '+p['id'])
    dungeons={d['id']:d for d in plan['dungeons']}
    for p in interiors:
        d=dungeons[p['dungeon']];x,y=cell_of(p,d['cellSize'])
        if p['kind']not in defs or d['floor'][y][x]!='1':errors.append('Invalid interior '+p['id'])
    if not overworld:errors.append('No exterior spawns')
    return {'passed':not errors,'errors':errors,'feature':plan['feature'],'overworld':len(overworld),'interiors':len(interiors),'monsterKinds':sorted({p['kind']for p in overworld+interiors}),'safeCities':True,'statsSource':'canonical bestiary; no stat rerolls','runtimeInstalled':False}

def generate(root,feature,catalog,seed):
    directory=Path(root)/feature;manifest=verify_region(directory);before=digest((directory/'manifest.json').read_bytes());plan,arrays=load_arrays(directory);planet=read(Path(root)/'planet.json');plan['spawnAffinities']=[feature]if plan['kind']=='continent'else planet['islandEdges'][feature]
    data,report=placement(plan,arrays,catalog,seed)
    if not report['passed']:raise ValueError(json.dumps(report))
    if digest((directory/'manifest.json').read_bytes())!=before:raise ValueError('Terrain changed during spawn pass')
    output=Path(root)/'spawns'/feature
    if output.exists():raise FileExistsError(str(output))
    output.mkdir(parents=True);data['terrainManifestSha256']=before;data['catalogSha256']=digest(canonical(catalog));write(output/'spawns.json',data);write(output/'quality.json',report)
    groups={}
    for p in data['overworld']:groups.setdefault(tuple(p['streamCell']),[]).append(p)
    for (x,y),values in groups.items():write(output/f'{x}-{y}.json',values)
    write(output/'manifest.json',{'generator':VERSION,'algorithmSha256':digest(Path(__file__).read_bytes()),'terrainManifestSha256':before,'catalogSha256':data['catalogSha256'],'files':{p.name:digest(p.read_bytes())for p in output.iterdir()if p.is_file()}})
    return report

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--world',required=True);p.add_argument('--seed',type=int,default=5749000);p.add_argument('--workers',type=int,default=8);a=p.parse_args()
    if not 1<=a.workers<=8:p.error('CPU budget: 1..8')
    root=Path(a.world);report=read(root/'generation-report.json');catalog=read(root/'bestiary.json');features=[r['feature']for r in report['features']];start=time.perf_counter();results=[]
    with concurrent.futures.ProcessPoolExecutor(max_workers=a.workers)as pool:
        futures=[pool.submit(generate,str(root),f,catalog,a.seed+sorted(features).index(f)*1009)for f in features]
        for job in concurrent.futures.as_completed(futures):r=job.result();results.append(r);print(json.dumps(r),flush=True)
    kinds={k for r in results for k in r['monsterKinds']}
    write(root/'spawn-report.json',{'generator':VERSION,'wallSeconds':round(time.perf_counter()-start,3),'features':results,'allCanonicalKindsCovered':set(m['id']for m in catalog)<=kinds,'totalOverworld':sum(r['overworld']for r in results),'totalInteriors':sum(r['interiors']for r in results),'terrainPassUnchanged':True,'runtimeInstalled':False})
    from planet_viewer import write_viewer
    write_viewer(root,report['features'],standalone=True)
    print('SPAWNS COMPLETE',round(time.perf_counter()-start,3),flush=True)
if __name__=='__main__':main()
