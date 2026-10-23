#!/usr/bin/env python3
"""Immutable world → JSON browser chunks and conservative foot-clearance navigation."""
import argparse,concurrent.futures,json,math,time
from pathlib import Path
import numpy as np
from scipy import ndimage,sparse
from scipy.sparse.csgraph import breadth_first_order
from generate import canonical,digest,compress_path
from planet_generate import read,write,cell_of
from spawn_generate import verify_region
VERSION='superior-browser-1'
FOOT=12;NAV_CELL=16;CHUNK=2048

def rle(values):
    flat=np.asarray(values).ravel()
    if not len(flat):return []
    edges=np.r_[0,np.flatnonzero(flat[1:]!=flat[:-1])+1,len(flat)]
    return [[int(flat[a]),int(b-a)]for a,b in zip(edges[:-1],edges[1:])]

def unrle(values,shape):
    flat=np.concatenate([np.full(n,v,dtype='uint8')for v,n in values])
    if len(flat)!=math.prod(shape):raise ValueError('Invalid RLE coverage')
    return flat.reshape(shape)

def clip_rect(r,b):
    x=max(r['x'],b['x']);y=max(r['y'],b['y']);right=min(r['x']+r['width'],b['x']+b['width']);bottom=min(r['y']+r['height'],b['y']+b['height'])
    return {'x':x,'y':y,'width':right-x,'height':bottom-y}if right>x and bottom>y else None

def inside_rect(point,r,radius=FOOT):
    dx=point['x']-max(r['x'],min(point['x'],r['x']+r['width']));dy=point['y']-max(r['y'],min(point['y'],r['y']+r['height']))
    return dx*dx+dy*dy<=radius*radius

def load_world(root,feature):
    directory=Path(root)/feature;verify_region(directory);plan=read(directory/'world.json');g=plan['geometry'];shape=(g['height']//32,g['width']//32)
    arrays={k:np.zeros(shape,dtype='uint8'if k=='biome'else bool)for k in ['land','water','walkable','safe','roads','bridges','blocked','biome']};objects=[]
    for chunk in read(directory/'chunks.json'):
        x,y=chunk['x']//32,chunk['y']//32
        with np.load(directory/chunk['terrain'])as data:
            for k in arrays:h,w=data[k].shape;arrays[k][y:y+h,x:x+w]=data[k]
        objects+=read(directory/chunk['objects'])
    rectangles=[b['footprint']for b in plan['buildings']]
    rectangles += [o['footprint']for o in objects if o['solid']]
    if plan['acceptedSource']:
        offset=plan['sourceOffset'];bounds=plan['settlements'][0]['bounds']
        for r in plan['acceptedSource']['obstacles']:
            tr={**r,'x':r['x']+offset['x'],'y':r['y']+offset['y']};clipped=clip_rect(tr,bounds)
            if clipped:rectangles.append(clipped)
    return plan,arrays,objects,rectangles

def nav_field(plan,arrays,rectangles):
    # Baked road widths become actual bridge width; never change ocean/coast or accepted city geometry.
    bridge=arrays['bridges'].copy();roads=arrays['roads']
    bridge|=ndimage.binary_dilation(roads,iterations=1)&arrays['water']&arrays['land']&~arrays['blocked']
    raw=arrays['land']&(~arrays['water']|bridge)
    fine=np.repeat(np.repeat(raw,2,axis=0),2,axis=1)
    # Every point of a 16-unit navigation cell must clear a 12-unit foot collider.
    # 12 + half-diagonal(16) = 23.314; a 3x3 erosion exactly excludes the neighbouring solid tiles.
    nav=ndimage.binary_erosion(fine,structure=np.ones((3,3),bool))
    clearance=FOOT+math.sqrt(2)*NAV_CELL/2
    for r in rectangles:
        x0=max(0,int((r['x']-clearance)//16));x1=min(nav.shape[1],math.ceil((r['x']+r['width']+clearance)/16));y0=max(0,int((r['y']-clearance)//16));y1=min(nav.shape[0],math.ceil((r['y']+r['height']+clearance)/16))
        yy,xx=np.ogrid[y0:y1,x0:x1];px=(xx+.5)*16;py=(yy+.5)*16
        dx=px-np.clip(px,r['x'],r['x']+r['width']);dy=py-np.clip(py,r['y'],r['y']+r['height'])
        nav[y0:y1,x0:x1]&=(dx*dx+dy*dy>clearance*clearance)
    return raw,nav,bridge

class Collider:
    def __init__(self,raw,rectangles):
        self.raw=raw;self.index={}
        for r in rectangles:
            for y in range(int(r['y']//256),int((r['y']+r['height'])//256)+1):
                for x in range(int(r['x']//256),int((r['x']+r['width'])//256)+1):self.index.setdefault((x,y),[]).append(r)
    def walkable(self,p,radius=FOOT):
        x,y=p['x'],p['y'];h,w=self.raw.shape
        if x<16 or y<16 or x>w*32-16 or y>h*32-16:return False
        for yy in range(max(0,int((y-radius)//32)),min(h,int((y+radius)//32)+1)):
            for xx in range(max(0,int((x-radius)//32)),min(w,int((x+radius)//32)+1)):
                if not self.raw[yy,xx]and inside_rect(p,{'x':xx*32,'y':yy*32,'width':32,'height':32},radius):return False
        for yy in range(int((y-radius)//256),int((y+radius)//256)+1):
            for xx in range(int((x-radius)//256),int((x+radius)//256)+1):
                if any(inside_rect(p,r,radius)for r in self.index.get((xx,yy),[])):return False
        return True
    def segment(self,a,b):
        n=max(1,math.ceil(math.hypot(a['x']-b['x'],a['y']-b['y'])/4))
        return all(self.walkable({'x':a['x']+(b['x']-a['x'])*i/n,'y':a['y']+(b['y']-a['y'])*i/n})for i in range(n+1))

def accessible(p,nav,collider,labels,component):
    if not collider.walkable(p):return None
    x,y=cell_of(p,16);options=[]
    for yy in range(max(0,y-4),min(nav.shape[0],y+5)):
        for xx in range(max(0,x-4),min(nav.shape[1],x+5)):
            if nav[yy,xx]and labels[yy,xx]==component:
                q={'x':xx*16+8,'y':yy*16+8};options.append((math.hypot(q['x']-p['x'],q['y']-p['y']),q))
    for _,q in sorted(options,key=lambda v:v[0]):
        if collider.segment(p,q):return q
    return None

def test_routes(nav,labels,component,feature,seed,pairs=1000):
    """BFS spanning tree proves paths, then independently checks each sampled edge is navigable."""
    good=labels==component;h,w=good.shape;ids=np.arange(good.size,dtype='int32').reshape(good.shape)
    a=ids[:,:-1][good[:,:-1]&good[:,1:]];b=ids[:,1:][good[:,:-1]&good[:,1:]];c=ids[:-1,:][good[:-1,:]&good[1:,:]];d=ids[1:,:][good[:-1,:]&good[1:,:]]
    rows=np.concatenate([a,b,c,d]);cols=np.concatenate([b,a,d,c]);graph=sparse.csr_matrix((np.ones(len(rows),'uint8'),(rows,cols)),shape=(good.size,good.size))
    candidates=np.flatnonzero(good);order,pred=breadth_first_order(graph,int(candidates[len(candidates)//2]),directed=False,return_predecessors=True)
    rng=np.random.default_rng(seed);errors=[];samples=[];edges_checked=0;max_length=0
    for i in range(pairs):
        start,end=map(int,rng.choice(candidates,2));aa=[];at=start
        while at>=0:aa.append(at);at=int(pred[at])
        lookup={v:j for j,v in enumerate(aa)};bb=[];at=end
        while at not in lookup and at>=0:bb.append(at);at=int(pred[at])
        if at<0:errors.append('Spanning tree has no common root');continue
        path=aa[:lookup[at]+1]+bb[::-1];max_length=max(max_length,len(path));edges_checked+=max(0,len(path)-1)
        for s,t in zip(path,path[1:]):
            if not good.flat[s]or not good.flat[t]or abs(s//w-t//w)+abs(s%w-t%w)!=1:errors.append('Invalid route edge')
        if i<5:samples.append({'from':{'x':start%w*16+8,'y':start//w*16+8},'to':{'x':end%w*16+8,'y':end//w*16+8},'points':compress_path([(v%w,v//w)for v in path],16)})
    return {'feature':feature,'pairs':pairs,'edgesChecked':edges_checked,'longestTreeRouteCells':max_length,'passed':not errors,'errors':errors,'method':'BFS tree routes with independent adjacency/clearance-mask checks; not shortest-path performance','samples':samples}

def convert(root,output,feature,pairs):
    start=time.perf_counter();plan,arrays,objects,rectangles=load_world(root,feature);raw,nav,bridges=nav_field(plan,arrays,rectangles);collider=Collider(raw,rectangles);labels,_=ndimage.label(nav)
    origin=plan['locations'][0];x,y=cell_of(origin,16);candidates=labels[max(0,y-4):y+5,max(0,x-4):x+5];ids,counts=np.unique(candidates[candidates>0],return_counts=True)
    if not len(ids):raise ValueError('No accessible capital navigation')
    component=int(ids[np.argmax(counts)]);targets=plan['locations']+plan['doors']+plan['resources'];errors=[];anchors=[];repairs=[]
    main=labels==component
    def relocate(p,allowed):
        x,y=cell_of(p,16);options=[]
        for yy in range(max(0,y-16),min(nav.shape[0],y+17)):
            for xx in range(max(0,x-16),min(nav.shape[1],x+17)):
                if main[yy,xx] and allowed(xx,yy):options.append((math.hypot(xx*16+8-p['x'],yy*16+8-p['y']),xx,yy))
        if not options:return None
        _,xx,yy=min(options);return {'x':xx*16+8,'y':yy*16+8}
    resource_ids={r['id']for r in plan['resources']}

    for p in targets:
        q=accessible(p,nav,collider,labels,component)
        if not q and p['id'] in resource_ids:
            candidate=relocate(p,lambda xx,yy:not arrays['safe'][yy//2,xx//2] and not arrays['roads'][yy//2,xx//2])
            if candidate:
                repairs.append({'id':p['id'],'kind':'resource','from':{'x':p['x'],'y':p['y']},'to':candidate,'reason':'12-unit foot clearance'});p.update(candidate);q=accessible(p,nav,collider,labels,component)
        if not q:errors.append({'id':p['id'],'x':p['x'],'y':p['y']})
        else:anchors.append({'id':p['id'],'point':{'x':p['x'],'y':p['y']},'navigationPoint':q})
    if errors:raise ValueError(json.dumps({'feature':feature,'unreachable':errors[:50],'totalFailures':len(errors)}))
    routes=test_routes(nav,labels,component,feature,plan['seed'],pairs)
    if not routes['passed']:raise ValueError(json.dumps(routes))
    directory=Path(output)/feature
    if directory.exists():raise FileExistsError(str(directory))
    directory.mkdir(parents=True);chunks=[];flags=raw.astype('uint8')|arrays['safe'].astype('uint8')*2|arrays['roads'].astype('uint8')*4|bridges.astype('uint8')*8|arrays['land'].astype('uint8')*16
    # Exact collision rectangles are partitioned by every intersected chunk; consumers deduplicate IDs.
    collision_chunks={};object_chunks={}
    for i,r in enumerate(rectangles):
        for yy in range(max(0,int(r['y']//CHUNK)),int((r['y']+r['height'])//CHUNK)+1):
            for xx in range(max(0,int(r['x']//CHUNK)),int((r['x']+r['width'])//CHUNK)+1):collision_chunks.setdefault((xx,yy),[]).append({'id':feature+'-collider-'+str(i),**r})
    for o in objects:object_chunks.setdefault((o['x']//CHUNK,o['y']//CHUNK),[]).append(o)
    (directory/'chunks').mkdir()
    for y in range(0,flags.shape[0],64):
        for x in range(0,flags.shape[1],64):
            h,w=flags[y:y+64,x:x+64].shape;cx,cy=x//64,y//64;chunk={'format':VERSION,'id':f'{cx}-{cy}','x':x*32,'y':y*32,'terrain':{'cell':32,'width':w,'height':h,'flags':rle(flags[y:y+h,x:x+w]),'biome':rle(arrays['biome'][y:y+h,x:x+w])},'navigation':{'cell':16,'width':w*2,'height':h*2,'blocked':rle(~nav[y*2:(y+h)*2,x*2:(x+w)*2])},'colliders':collision_chunks.get((cx,cy),[]),'objects':object_chunks.get((cx,cy),[])}
            assert np.array_equal(unrle(chunk['navigation']['blocked'],(h*2,w*2)),~nav[y*2:(y+h)*2,x*2:(x+w)*2]);write(directory/'chunks'/f'{cx}-{cy}.json',chunk);chunks.append({'id':chunk['id'],'x':x*32,'y':y*32,'width':w*32,'height':h*32,'path':f'chunks/{cx}-{cy}.json'})
    write(directory/'navigation.json',{'cell':16,'width':nav.shape[1],'height':nav.shape[0],'blocked':rle(~nav)})
    write(directory/'collision.json',rectangles)
    write(directory/'terrain.json',{'cell':32,'width':raw.shape[1],'height':raw.shape[0],'flags':rle(flags)})
    rng=np.random.default_rng(plan['seed']+77);fixture_points=[{'x':float(rng.uniform(0,plan['geometry']['width'])),'y':float(rng.uniform(0,plan['geometry']['height']))}for _ in range(1000)]
    for r in rectangles[:100]:
        for delta in [11.9,12,12.1,24]:fixture_points.append({'x':r['x']+r['width']+delta,'y':r['y']+r['height']/2})
    write(directory/'collision-fixtures.json',[{**p,'walkable':collider.walkable(p)}for p in fixture_points])
    write(directory/'world.json',plan);write(directory/'navigation-anchors.json',anchors);write(directory/'chunks.json',chunks);write(directory/'route-tests.json',routes)
    spawns=read(Path(root)/'spawns'/feature/'spawns.json');safe_distance=ndimage.distance_transform_edt(~arrays['safe'])*32
    for spawn in spawns['overworld']:
        if not accessible(spawn,nav,collider,labels,component):
            candidate=relocate(spawn,lambda xx,yy:safe_distance[yy//2,xx//2]>spawn['safeExclusion'] and not arrays['roads'][yy//2,xx//2])
            if not candidate:raise ValueError('No foot-clear spawn: '+spawn['id'])
            repairs.append({'id':spawn['id'],'kind':'spawn','from':{'x':spawn['x'],'y':spawn['y']},'to':candidate,'reason':'12-unit foot clearance'});spawn.update(candidate);spawn['streamCell']=[spawn['x']//2048,spawn['y']//2048]
    write(directory/'spawns.json',spawns);write(directory/'clearance-repairs.json',repairs)

    report={'feature':feature,'passed':True,'targets':len(targets),'pairs':pairs,'edgesChecked':routes['edgesChecked'],'footRadius':FOOT,'navigationCell':16,'chunks':len(chunks),'bridgeCellsAdded':int((bridges&~arrays['bridges']).sum()),'exactColliders':len(rectangles),'clearanceRepairs':len(repairs),'overworldSpawnsChecked':len(spawns['overworld']),'seconds':round(time.perf_counter()-start,3),'sourceTerrainManifestSha256':digest((Path(root)/feature/'manifest.json').read_bytes()),'limitation':'No Phaser scene or hardware FPS acceptance; tests target the browser collision/navigation contract.'}
    write(directory/'quality.json',report);write(directory/'manifest.json',{'format':VERSION,'files':{str(p.relative_to(directory)):digest(p.read_bytes())for p in sorted(directory.rglob('*'))if p.is_file()}})
    return report

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--world',required=True);p.add_argument('--output',required=True);p.add_argument('--workers',type=int,default=8);p.add_argument('--pairs',type=int,default=1000);p.add_argument('--features',nargs='*');a=p.parse_args()
    if not 1<=a.workers<=8 or not 1<=a.pairs<=10000:p.error('workers 1..8; route pairs 1..10000')
    root=Path(a.world);report=read(root/'generation-report.json');features=a.features or [r['feature']for r in report['features']];start=time.perf_counter();results=[]
    with concurrent.futures.ProcessPoolExecutor(max_workers=a.workers)as pool:
        for result in pool.map(convert,[str(root)]*len(features),[a.output]*len(features),features,[a.pairs]*len(features)):results.append(result);print(json.dumps(result),flush=True)
    write(Path(a.output)/'planet.json',read(root/'planet.json'));write(Path(a.output)/'travel-links.json',read(root/'travel-links.json'));write(Path(a.output)/'conversion-report.json',{'format':VERSION,'seconds':round(time.perf_counter()-start,3),'features':results,'runtimeInstalled':False})
if __name__=='__main__':main()
