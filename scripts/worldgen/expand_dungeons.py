#!/usr/bin/env python3
"""Build explorable multi-floor dungeons; monster placement is a separate command."""
import argparse,json,math,concurrent.futures,time
from pathlib import Path
import numpy as np
from scipy import ndimage
from generate import astar,canonical,digest
from planet_generate import read,write,maze,point,cell_of

def cavern(seed):
    rng=np.random.default_rng(seed);g=rng.random((35,41))>.43
    for _ in range(5):g=ndimage.convolve(g.astype(int),np.ones((3,3),int),mode='constant')>=5;g[[0,-1],:]=False;g[:,[0,-1]]=False
    labels,n=ndimage.label(g)
    if not n:return cavern(seed+1)
    sizes=np.bincount(labels.ravel());sizes[0]=0;g=labels==np.argmax(sizes)
    if g.sum()<100:return cavern(seed+1)
    points=np.argwhere(g);a=points[np.argmin(points.sum(axis=1))];b=points[np.argmax(((points-a)**2).sum(axis=1))]
    return g,(int(a[1]),int(a[0])),(int(b[1]),int(b[0]))

def rooms(seed):
    rng=np.random.default_rng(seed);g=np.zeros((37,43),bool);centres=[]
    for cy in [6,18,30]:
        for cx in [6,16,26,36]:
            w=int(rng.integers(4,8));h=int(rng.integers(4,8));x=cx-w//2;y=cy-h//2;g[y:y+h,x:x+w]=True;centres.append((cx,cy))
    for a,b in zip(centres,centres[1:]):
        x,y=a;nx,ny=b;g[y,min(x,nx):max(x,nx)+1]=True;g[min(y,ny):max(y,ny)+1,nx]=True
    # A side loop makes abandoned halls different from a perfect maze.
    g[6:31,6]=True
    return g,centres[0],centres[-1]

def reach(grid,start):
    labels,_=ndimage.label(grid);component=labels[start[1],start[0]]
    return labels==component if component else np.zeros_like(grid)

def build_floor(dungeon,depth,seed):
    kind=dungeon['kind'];cell=64
    if kind=='cave':grid,start,end=cavern(seed)
    elif kind=='ruins':grid,start,end=rooms(seed)
    else:
        m=maze(seed,31 if depth<2 else 41);grid=np.array([[v=='1'for v in row]for row in m['floor']]);start=cell_of(m['entrance'],64);end=cell_of(m['exit'],64)
    route=astar(np.where(grid,1.,np.inf),start,end);floor_id=dungeon['id']+'-floor-'+str(depth+1)
    gates=[];keys=[];forbidden={start,end}
    gates_count=min(3,max(1,len(route)//35))
    for i in range(gates_count):
        at=max(4,int((i+1)*len(route)/(gates_count+1)));before=max(1,at-max(3,len(route)//(gates_count+1)//2));gate=route[at];key=route[before];key_id=floor_id+'-key-'+str(i)
        gates.append({'id':floor_id+'-gate-'+str(i),'key':key_id,**point(cell,*gate)});keys.append({'id':key_id,**point(cell,*key)});forbidden|={gate,key}
    rng=np.random.default_rng(seed+11);candidates=[(int(x),int(y))for y,x in np.argwhere(grid)if (int(x),int(y))not in forbidden and math.hypot(x-start[0],y-start[1])>5 and math.hypot(x-end[0],y-end[1])>3]
    rng.shuffle(candidates);traps=[];chests=[]
    for i,(x,y)in enumerate(candidates[:6]):traps.append({'id':floor_id+'-trap-'+str(i),**point(cell,x,y),'kind':'ki-pulse','visibleRadius':256,'triggerRadius':32,'maxHpDamageFraction':.08,'cooldownMs':3000,'avoidable':True})
    for i,(x,y)in enumerate(candidates[6:9]):chests.append({'id':floor_id+'-chest-'+str(i),**point(cell,x,y),'reward':{'gold':5+depth*4,'potion':1 if i==0 else 0},'claimPolicy':'once-per-character; persistent chest ID; atomic grant+claim'})
    reward=point(cell,*route[-2]);return {'id':floor_id,'dungeon':dungeon['id'],'depth':depth+1,'kind':kind,'width':grid.shape[1]*cell,'height':grid.shape[0]*cell,'cellSize':cell,'floor':[''.join('1'if v else'0'for v in row)for row in grid],'entrance':point(cell,*start),'exit':point(cell,*end),'keys':keys,'gates':gates,'traps':traps,'chests':chests,'reward':reward,'previous':None if depth==0 else dungeon['id']+'-floor-'+str(depth),'next':None if depth==2 else dungeon['id']+'-floor-'+str(depth+2),'returnToOverworld':dungeon['overworldEntrance'],'theme':dungeon['theme'],'artBindings':{'floor':'terrain.'+dungeon['theme']+'.dungeon-floor','wall':'object.'+dungeon['theme']+'.dungeon-wall','gate':'object.dungeon-gate','chest':'object.dungeon-chest','trap':'effect.ki-pulse'},'monsters':'separate generation','runtimeInstalled':False}

def validate(floor):
    grid=np.array([[v=='1'for v in row]for row in floor['floor']]);start=cell_of(floor['entrance'],64);end=cell_of(floor['exit'],64);working=grid.copy();errors=[]
    for gate in floor['gates']:x,y=cell_of(gate,64);working[y,x]=False
    for key,gate in zip(floor['keys'],floor['gates']):
        reachable=reach(working,start);x,y=cell_of(key,64)
        if not reachable[y,x]:errors.append('Key behind its own locked gate: '+key['id'])
        x,y=cell_of(gate,64);working[y,x]=True
    reachable=reach(working,start)
    for target in [floor['exit'],*floor['chests'],floor['reward']]:
        x,y=cell_of(target,64)
        if not reachable[y,x]:errors.append('Unreachable dungeon target')
    # A 64-wide floor has >=32 j. centre clearance; navigation samples and exact 12 j. circle fit.
    return {'floor':floor['id'],'passed':not errors,'errors':errors,'keys':len(floor['keys']),'gates':len(floor['gates']),'chests':len(floor['chests']),'traps':len(floor['traps']),'floorCells':int(grid.sum())}

def generate(root,output,feature):
    plan=read(Path(root)/feature/'world.json');directory=Path(output)/feature
    if directory.exists():raise FileExistsError(str(directory))
    directory.mkdir(parents=True);reports=[];floors=[]
    for index,d in enumerate(plan['dungeons']):
        for depth in range(3):
            floor=build_floor(d,depth,plan['seed']+index*1009+depth*97);r=validate(floor)
            if not r['passed']:raise ValueError(json.dumps(r))
            write(directory/(floor['id']+'.json'),floor);reports.append(r);floors.append({'id':floor['id'],'path':floor['id']+'.json','dungeon':d['id'],'depth':depth+1})
    write(directory/'index.json',floors);write(directory/'manifest.json',{'files':{p.name:digest(p.read_bytes())for p in directory.iterdir()if p.is_file()}})
    return {'feature':feature,'passed':True,'dungeons':len(plan['dungeons']),'floors':len(floors),'keys':sum(r['keys']for r in reports),'chests':sum(r['chests']for r in reports),'traps':sum(r['traps']for r in reports),'reports':reports}

def main():
    p=argparse.ArgumentParser();p.add_argument('--world',required=True);p.add_argument('--output',required=True);p.add_argument('--workers',type=int,default=8);a=p.parse_args();features=[r['feature']for r in read(Path(a.world)/'conversion-report.json')['features']];start=time.perf_counter()
    if not 1<=a.workers<=8:p.error('workers 1..8')
    with concurrent.futures.ProcessPoolExecutor(max_workers=a.workers)as pool:results=list(pool.map(generate,[a.world]*len(features),[a.output]*len(features),features))
    write(Path(a.output)/'dungeon-report.json',{'features':results,'seconds':round(time.perf_counter()-start,3),'runtimeInstalled':False,'spawnPass':'not yet run'})
    print(json.dumps({'passed':True,'dungeons':sum(r['dungeons']for r in results),'floors':sum(r['floors']for r in results),'seconds':round(time.perf_counter()-start,3)}))
if __name__=='__main__':main()
