#!/usr/bin/env python3
"""Offline CPU world proposals. Never edits the game, atlas, player saves or active spawns.
Usage: python generate.py --context context.json --output OUTPUT --seed 5741200
"""
from __future__ import annotations
import argparse, concurrent.futures, hashlib, heapq, html, json, math, os, platform, time
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

VERSION = 'cpu-worldgen-0.1.0'
BIOMES = ['water', 'meadow', 'forest', 'rock', 'wetland']
PALETTE = np.array([[54,112,139],[143,164,104],[68,113,82],[136,140,132],[83,139,124]],dtype=np.uint8)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def canonical(value):
    return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()

def smooth_noise(rng, shape, spacing):
    coarse=rng.random((max(2,math.ceil(shape[0]/spacing)+1),max(2,math.ceil(shape[1]/spacing)+1)))
    yy=np.linspace(0,coarse.shape[0]-1,shape[0]);xx=np.linspace(0,coarse.shape[1]-1,shape[1])
    return ndimage.map_coordinates(coarse,np.meshgrid(yy,xx,indexing='ij'),order=1,mode='nearest')

def xy_cell(point,cell):
    return int(point['x']//cell),int(point['y']//cell)

def obstacle_mask(shape, rect, cell):
    """Use cell centres for geometric rasterization; exact source geometry is also exported."""
    yy,xx=np.ogrid[:shape[0],:shape[1]]
    return ((xx+.5)*cell>=rect['x'])&((xx+.5)*cell<rect['x']+rect['width'])&((yy+.5)*cell>=rect['y'])&((yy+.5)*cell<rect['y']+rect['height'])

def astar(cost,start,end):
    h,w=cost.shape
    if not (0<=start[0]<w and 0<=start[1]<h and 0<=end[0]<w and 0<=end[1]<h):
        raise ValueError('Route endpoint outside grid')
    if not np.isfinite(cost[start[1],start[0]]) or not np.isfinite(cost[end[1],end[0]]):
        raise ValueError('Blocked route endpoint')
    distances={start:0.};previous={};queue=[(0.,0.,start)];closed=set()
    while queue:
        _,g,current=heapq.heappop(queue)
        if current in closed:continue
        if current==end:
            path=[current]
            while current in previous:current=previous[current];path.append(current)
            return path[::-1]
        closed.add(current)
        for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            nxt=(current[0]+dx,current[1]+dy)
            if not(0<=nxt[0]<w and 0<=nxt[1]<h) or nxt in closed:continue
            c=float(cost[nxt[1],nxt[0]])
            if not math.isfinite(c):continue
            ng=g+c
            if ng<distances.get(nxt,math.inf):
                distances[nxt]=ng;previous[nxt]=current
                heuristic=abs(nxt[0]-end[0])+abs(nxt[1]-end[1])
                heapq.heappush(queue,(ng+heuristic,ng,nxt))
    raise ValueError('No route between settlement nodes')

def compress_path(path,cell):
    if len(path)<=2:return [[int((x+.5)*cell),int((y+.5)*cell)] for x,y in path]
    result=[path[0]]
    for i in range(1,len(path)-1):
        a,b,c=path[i-1],path[i],path[i+1]
        if (b[0]-a[0],b[1]-a[1])!=(c[0]-b[0],c[1]-b[1]):result.append(b)
    result.append(path[-1])
    return [[int((x+.5)*cell),int((y+.5)*cell)] for x,y in result]

def build(context,seed,width=16384,height=12288,cell=32):
    if width%cell or height%cell or width<12288 or height<10240:
        raise ValueError('World must be aligned to cells and at least 12288 × 10240')
    source=context['worlds']['verdant']
    if not source.get('city'):raise ValueError('Context must include the accepted Verdantia city')
    if width<=source['width']+cell*4 or height<=source['height']+cell*4:raise ValueError('World too small for source city')
    rng=np.random.Generator(np.random.PCG64(seed))
    shape=(height//cell,width//cell)
    elevation=(.48*smooth_noise(rng,shape,48)+.3*smooth_noise(rng,shape,18)+.16*smooth_noise(rng,shape,7)+.06*smooth_noise(rng,shape,2)).astype(np.float32)
    humidity=smooth_noise(rng,shape,24)
    offset={'x':int((width-source['width'])//(2*cell)*cell),'y':int((height-source['height'])//(2*cell)*cell)}
    cityrect=dict(x=offset['x'],y=offset['y'],width=source['width'],height=source['height'])
    protected=obstacle_mask(shape,cityrect,cell)
    centres=[{'id':'capital','name':source['settlement'],'x':width//2,'y':height//2,'accepted':True},
             {'id':'river-port','name':'Przystań Trzech Mostów','x':int(width*.2)//cell*cell,'y':int(height*.19)//cell*cell,'accepted':False},
             {'id':'stone-garden','name':'Kamienny Sad','x':int(width*.81)//cell*cell,'y':int(height*.24)//cell*cell,'accepted':False},
             {'id':'root-lighthouse','name':'Latarnia Korzeni','x':int(width*.72)//cell*cell,'y':int(height*.81)//cell*cell,'accepted':False}]
    yy,xx=np.indices(shape)
    water=elevation<.31
    # Meandering external river. The accepted city owns its original water/bridge geometry.
    river_y=shape[0]*(.32+.07*np.sin(np.arange(shape[1])/shape[1]*math.tau*1.4+seed%100*.02))
    water|=abs(yy-river_y[None,:])<=1.4
    safe=protected.copy();settlement_masks=[]
    for centre in centres[1:]:
        rect=dict(x=centre['x']-1408,y=centre['y']-1152,width=2816,height=2304)
        mask=obstacle_mask(shape,rect,cell)
        if np.any(mask&safe):raise ValueError('Settlement buffer overlaps accepted city or another settlement')
        safe|=mask;settlement_masks.append(mask)
    elevation[safe]=.51;water[safe]=False
    biomes=np.full(shape,1,dtype=np.uint8)
    biomes[humidity>.56]=2;biomes[elevation>.7]=3;biomes[(humidity>.65)&(elevation<.43)]=4;biomes[water]=0
    exact_obstacles=[];blocked=np.zeros(shape,dtype=bool)
    for obstacle in source['obstacles']:
        translated={**obstacle,'x':obstacle['x']+offset['x'],'y':obstacle['y']+offset['y']}
        exact_obstacles.append(translated);blocked|=obstacle_mask(shape,translated,cell)
    cost=(1+np.hypot(*np.gradient(elevation))*15).astype(np.float64)
    cost[water]=18.;cost[blocked]=np.inf
    buildings=[];npcs=[]
    # Exact source structures and NPC identity are retained in a separate accepted source block.
    for centre in centres[1:]:
        positions=[(-960,-640),(0,-896),(960,-640),(-960,640),(0,896),(960,640)]
        for (dx,dy),kind in zip(positions,['shop','hall','inn','smithy','depot','arena']):
            x,y=centre['x']+dx,centre['y']+dy
            door={'x':x,'y':y+128}
            rect={'x':x-192,'y':y-128,'width':384,'height':160}
            mask=obstacle_mask(shape,rect,cell);blocked|=mask;cost[mask]=np.inf
            b={'id':centre['id']+'-'+kind,'service':kind,'settlement':centre['id'],'x':x,'y':y,'footprint':rect,'door':door,'accepted':False}
            buildings.append(b)
            npcs.append({'id':b['id']+'-npc','building':b['id'],'role':kind,'proposalOnly':True})

    roads=[];roadmask=np.zeros(shape,dtype=bool)
    # Regional network: deterministic MST plus a loop for alternative travel.
    connected={0};edges=[]
    while len(connected)<len(centres):
        _,a,b=min((math.hypot(centres[a]['x']-centres[b]['x'],centres[a]['y']-centres[b]['y']),a,b) for a in connected for b in range(len(centres)) if b not in connected)
        edges.append((a,b));connected.add(b)
    extra=next((a,b) for a in range(1,len(centres)) for b in range(a+1,len(centres)) if (a,b) not in edges and (b,a) not in edges)
    edges.append(extra)
    source_spawn={k:source['spawn'][k]+offset[k] for k in ['x','y']}
    centres[0]['x']=source_spawn['x'];centres[0]['y']=source_spawn['y']
    for a,b in edges:
        path=astar(cost,xy_cell(centres[a],cell),xy_cell(centres[b],cell))
        for x,y in path:roadmask[y,x]=True
        roads.append({'id':f'road-{a}-{b}','from':centres[a]['id'],'to':centres[b]['id'],'width':64,'points':compress_path(path,cell)})
    for centre in centres[1:]:
        for b in [b for b in buildings if b['settlement']==centre['id']]:
            path=astar(cost,xy_cell(centre,cell),xy_cell(b['door'],cell))
            for x,y in path:roadmask[y,x]=True
            roads.append({'id':'access-'+b['id'],'from':centre['id'],'to':b['id'],'width':64,'points':compress_path(path,cell)})
    for b in source['city']['buildings']:
        door={k:b['door'][k]+offset[k] for k in ['x','y']}
        path=astar(cost,xy_cell(source_spawn,cell),xy_cell(door,cell))
        for x,y in path:roadmask[y,x]=True
    bridges=roadmask&water
    walkable=~(blocked|water);walkable[bridges]=True
    roadbuffer=ndimage.binary_dilation(roadmask,iterations=5)
    available=walkable&~safe&~roadbuffer
    candidates=np.argwhere(available)
    chosen=rng.choice(len(candidates),size=min(len(candidates),2500),replace=False)
    props=[]
    for y,x in candidates[chosen]:
        props.append({'x':int((x+.5)*cell),'y':int((y+.5)*cell),'kind':'tree' if biomes[y,x]==2 else 'rock' if biomes[y,x]==3 else 'bush','solid':False})
    resource_indices=rng.choice(len(candidates),size=min(len(candidates),180),replace=False)
    resources=[{'id':f'resource-{i}','x':int((candidates[v][1]+.5)*cell),'y':int((candidates[v][0]+.5)*cell),'kind':['herb','wood','ore'][i%3],'proposalOnly':True} for i,v in enumerate(resource_indices)]
    # Exact source remains immutable; offset is explicit and requires migration before runtime adoption.
    plan={'version':1,'generator':VERSION,'seed':seed,'status':'OFFLINE_PROPOSAL_NOT_INSTALLED','world':'verdant','width':width,'height':height,'cellSize':cell,'sourceSha':context['sourceSha'],'sourceWorldSha256':digest(canonical(source)),'sourceOffset':offset,'protectedSourceRect':cityrect,'acceptedSource':source,'settlements':centres,'buildings':buildings,'npcs':npcs,'roads':roads,'resources':resources,'props':props,'enemies':[],'monsters':[],'encounterCandidates':[],'notes':['No active spawns. New settlements are layout proposals, not approved city art.','Existing source geometry is preserved in acceptedSource; coordinate migration is not installed.']}
    arrays={'elevation':elevation,'biomes':biomes,'walkable':walkable,'roads':roadmask,'bridges':bridges,'safe':safe,'blocked':blocked}
    report=validate(plan,arrays)
    return plan,arrays,report

def validate(plan,arrays):
    cell=plan['cellSize'];walk=arrays['walkable']
    labels,_=ndimage.label(walk,structure=np.array([[0,1,0],[1,1,1],[0,1,0]]))
    start=plan['acceptedSource']['spawn'];offset=plan['sourceOffset']
    sx,sy=xy_cell({'x':start['x']+offset['x'],'y':start['y']+offset['y']},cell)
    component=int(labels[sy,sx]);errors=[]
    if not component:errors.append('Source spawn is blocked')
    points=[(b['id'],b['door']) for b in plan['buildings']]
    for b in plan['acceptedSource']['city']['buildings']:points.append(('accepted-'+b['id'],{k:b['door'][k]+offset[k] for k in ['x','y']}))
    for name,point in points:
        x,y=xy_cell(point,cell)
        if not component or labels[y,x]!=component:errors.append('Unreachable door: '+name)
    for r in plan['resources']:
        x,y=xy_cell(r,cell)
        if arrays['safe'][y,x]:errors.append('Resource inside protected settlement')
    if np.any(arrays['roads']&arrays['blocked']):errors.append('Road intersects a building or source obstacle')
    for i,a in enumerate(plan['buildings']):
        ra=a['footprint']
        for b in plan['buildings'][i+1:]:
            rb=b['footprint']
            if ra['x']<rb['x']+rb['width'] and ra['x']+ra['width']>rb['x'] and ra['y']<rb['y']+rb['height'] and ra['y']+ra['height']>rb['y']:errors.append('Overlapping proposed buildings')
            if a['settlement']==b['settlement'] and math.hypot(a['door']['x']-b['door']['x'],a['door']['y']-b['door']['y'])<700:errors.append('Service doors less than 700 units apart')
    for road in plan['roads']:
        if not road['points']:errors.append('Empty road')
    if plan['enemies'] or plan['monsters'] or plan['encounterCandidates']:errors.append('Active or proposed combat spawns unexpectedly enabled')
    if digest(canonical(plan['acceptedSource']))!=plan['sourceWorldSha256']:errors.append('Accepted source modified')
    counts=np.bincount(arrays['biomes'].ravel(),minlength=5)
    return {'passed':not errors,'errors':errors,'doorsChecked':len(points),'settlements':len(plan['settlements']),'proposedBuildings':len(plan['buildings']),'roads':len(plan['roads']),'resources':len(plan['resources']),'decorations':len(plan['props']),'walkableCells':int(walk.sum()),'reachableWalkablePercent':round(float((labels==component).sum()/max(1,walk.sum())*100),2) if component else 0,'biomePercent':{name:round(float(counts[i]/counts.sum()*100),2) for i,name in enumerate(BIOMES)},'activeSpawns':0,'sourceUnchanged':True,'validationResolutionWorldUnits':cell,'limitations':['Grid connectivity is not full Phaser navigation or visual acceptance.','Existing city is preserved as exact source data; final integration requires coordinate migration.']}

def draw_preview(plan,arrays,path):
    biome=arrays['biomes'];elevation=arrays['elevation']
    rgb=PALETTE[biome].astype(np.float32)*(0.8+elevation[:,:,None]*.3)
    rgb=np.clip(rgb,0,255).astype(np.uint8);rgb[arrays['roads']]=[205,180,130];rgb[arrays['bridges']]=[225,193,143]
    im=Image.fromarray(rgb).resize((1600,int(1600*plan['height']/plan['width'])),Image.Resampling.NEAREST)
    dr=ImageDraw.Draw(im);scale=im.width/plan['width'];off=plan['sourceOffset']
    for b in plan['acceptedSource']['city']['buildings']:
        x,y=(b['door']['x']+off['x'])*scale,(b['door']['y']+off['y'])*scale
        dr.rectangle((x-12,y-19,x+12,y),fill='#ead8a2',outline='#192c32',width=2)
    for b in plan['buildings']:
        r=b['footprint'];dr.rectangle((r['x']*scale,r['y']*scale,(r['x']+r['width'])*scale,(r['y']+r['height'])*scale),fill='#d4bea0',outline='#263d40',width=1)
    for s in plan['settlements']:
        x,y=s['x']*scale,s['y']*scale;dr.ellipse((x-5,y-5,x+5,y+5),fill='#f7e9a2',outline='#193139')
        dr.text((x+9,y+7),s['id'],fill='#fff4c4',stroke_width=2,stroke_fill='#183835')
    im.save(path)

def generate_one(context,seed,output,width,height,cell,resume=False):
    started=time.perf_counter();directory=Path(output)/f'verdant-{seed}';context_hash=digest(canonical(context));algorithm_hash=digest(Path(__file__).read_bytes())
    if directory.exists():
        manifest_path=directory/'manifest.json'
        if resume and manifest_path.is_file():
            manifest=json.loads(manifest_path.read_text())
            if manifest.get('generator')==VERSION and manifest.get('algorithmSha256')==algorithm_hash and manifest['contextSha256']==context_hash and manifest['config']=={'width':width,'height':height,'cell':cell} and all((directory/f).is_file() and digest((directory/f).read_bytes())==sha for f,sha in manifest['files'].items()):
                return {'seed':seed,'resumed':True,'directory':str(directory),'seconds':0,'passed':True}
        raise FileExistsError('Refusing to overwrite unverified output: '+str(directory))
    plan,arrays,report=build(context,seed,width,height,cell)
    if not report['passed']:raise ValueError('Validation failed: '+', '.join(report['errors']))
    directory.mkdir(parents=True)
    (directory/'world-plan.json').write_bytes(canonical(plan))
    (directory/'quality-report.json').write_bytes(canonical(report))
    draw_preview(plan,arrays,directory/'minimap.png')
    # Chunk export: only the nearby cells need loading; each fragment is independently readable.
    chunks=[];chunk_cells=64
    (directory/'chunks').mkdir()
    for y in range(0,arrays['biomes'].shape[0],chunk_cells):
        for x in range(0,arrays['biomes'].shape[1],chunk_cells):
            name=f'chunks/{x//chunk_cells}-{y//chunk_cells}.npz'
            np.savez_compressed(directory/name,**{key:value[y:y+chunk_cells,x:x+chunk_cells] for key,value in arrays.items()})
            chunks.append({'path':name,'x':x*cell,'y':y*cell,'width':min(chunk_cells,arrays['biomes'].shape[1]-x)*cell,'height':min(chunk_cells,arrays['biomes'].shape[0]-y)*cell})
    (directory/'chunks.json').write_bytes(canonical(chunks))
    facts=f"Seed {seed} · {width} × {height} · {report['doorsChecked']} doors verified · zero combat spawns"
    (directory/'index.html').write_text('<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>KI Legends · CPU world proposal</title><style>body{background:#102a32;color:#e5eadb;font:16px system-ui;margin:24px}img{max-width:100%;border:1px solid #8d9c79}a{color:#ecd29b}</style><h1>Verdantia — propozycja układu</h1><p>'+html.escape(facts)+'</p><p>Plan proceduralny; grafika schematyczna. Nie zainstalowano w grze.</p><img src="minimap.png" alt="Mapa proceduralnego terenu, miast i dróg"><p><a href="quality-report.json">Raport jakości</a> · <a href="world-plan.json">Dane układu</a></p></html>')
    files={str(p.relative_to(directory)):digest(p.read_bytes()) for p in sorted(directory.rglob('*')) if p.is_file()}
    manifest={'generator':VERSION,'algorithmSha256':algorithm_hash,'seed':seed,'contextSha256':context_hash,'config':{'width':width,'height':height,'cell':cell},'layoutSha256':digest(canonical(plan)),'files':files,'status':plan['status']}
    (directory/'manifest.json').write_bytes(canonical(manifest))
    return {'seed':seed,'resumed':False,'directory':str(directory),'seconds':round(time.perf_counter()-started,3),'passed':True,'layoutSha256':manifest['layoutSha256'],'report':report}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--context',required=True);parser.add_argument('--output',required=True)
    parser.add_argument('--seed',type=int,default=5741200);parser.add_argument('--variants',type=int,default=1)
    parser.add_argument('--workers',type=int,default=1);parser.add_argument('--width',type=int,default=16384);parser.add_argument('--height',type=int,default=12288);parser.add_argument('--cell',type=int,default=32);parser.add_argument('--resume',action='store_true')
    args=parser.parse_args()
    if not 0<=args.seed<2**63:parser.error('Seed must be in 0..2^63-1')
    cpu_budget=min(os.cpu_count() or 1,int(os.environ.get('KI_WORLDGEN_CPU_BUDGET',8)))
    if not(1<=args.variants<=1000 and 1<=args.workers<=min(16,cpu_budget)):parser.error('Variants 1–1000; workers up to available CPU, capped at 16')
    if args.cell<16 or args.width*args.height//args.cell**2>4_000_000:parser.error('Maximum four million cells; minimum 16 world units per cell')
    context=json.loads(Path(args.context).read_text());output=Path(args.output);output.mkdir(parents=True,exist_ok=True)
    started=time.perf_counter();results=[]
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
        jobs={pool.submit(generate_one,context,args.seed+i,str(output),args.width,args.height,args.cell,args.resume):args.seed+i for i in range(args.variants)}
        for job in concurrent.futures.as_completed(jobs):
            result=job.result();results.append(result);print(json.dumps(result,ensure_ascii=False),flush=True)
    summary={'generator':VERSION,'environment':{'python':platform.python_version(),'numpy':np.__version__,'hostCpuThreads':os.cpu_count(),'cpuBudget':cpu_budget},'wallSeconds':round(time.perf_counter()-started,3),'workers':args.workers,'variants':sorted(results,key=lambda r:r['seed'])}
    (output/'batch-report.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    links=''.join('<article><h2>Seed '+str(row['seed'])+'</h2><a href="verdant-'+str(row['seed'])+'/index.html"><img loading="lazy" src="verdant-'+str(row['seed'])+'/minimap.png" alt="Mapa wariantu '+str(row['seed'])+'"></a></article>' for row in sorted(results,key=lambda r:r['seed']))
    (output/'index.html').write_text('<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>KI Legends — warianty CPU</title><style>body{background:#102a32;color:#e6ebdb;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}img{max-width:100%}a{color:#ecd29b}</style><h1>KI Legends — warianty świata</h1><p>Propozycje układu. Bez instalacji w grze i bez aktywnych spawnów.</p><main>'+links+'</main></html>')
    print('Batch complete:',len(results),'variants in',summary['wallSeconds'],'seconds')

if __name__=='__main__':main()
