#!/usr/bin/env python3
"""Generate Superior's ten canonical landmasses; combat is a separate spawn_generate pass."""
from __future__ import annotations
import argparse, concurrent.futures, hashlib, json, math, os, time
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import cKDTree
from generate import astar, canonical, digest, smooth_noise, obstacle_mask, compress_path

VERSION='superior-world-1.0'
SERVICES=['shop','hall','inn','smithy','depot','arena']
NAMES={'verdant':'Verdantia','aether':'Aetheria','nexus':'Nexus-9','pyra':'Pyra'}
THEMES={'verdant':['łąki','las','kamienne wzgórza','mokradła'], 'aether':['tarasy źródeł','święty gaj','lodowe szczyty','lodowce'], 'nexus':['równiny obwodów','ogrody syntetyczne','płaskowyż','pustkowia rdzeni'], 'pyra':['popielne pola','bazalt','wulkany','kaniony']}
PALETTES={'verdant':['#829f65','#3e7754','#959282','#568d82'], 'aether':['#8cbbc0','#598c96','#cbdde0','#8ab3cd'], 'nexus':['#536c7c','#397e86','#8b8895','#695a72'], 'pyra':['#9c7358','#67545b','#b85c44','#b58263']}

def read(path):return json.loads(Path(path).read_text())
def write(path,value):Path(path).write_bytes(canonical(value))
def mask_polygon(points,shape,cell):
    """Even-odd scanline at cell centres, using exact source polygon coordinates."""
    result=np.zeros(shape,bool)
    for row in range(shape[0]):
        y=(row+.5)*cell;cuts=[]
        for a,b in zip(points,points[1:]+points[:1]):
            if (a[1]>y)!=(b[1]>y):cuts.append(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]))
        cuts.sort()
        for a,b in zip(cuts[::2],cuts[1::2]):
            lo=max(0,math.ceil(a/cell-.5));hi=min(shape[1],math.ceil(b/cell-.5))
            result[row,lo:hi]=True
    return result

def point(cell,x,y):return {'x':int((x+.5)*cell),'y':int((y+.5)*cell)}
def cell_of(p,cell):return int(p['x']//cell),int(p['y']//cell)
def near(mask,p,cell):
    candidates=np.argwhere(mask)
    if not len(candidates):raise ValueError('No navigable point')
    target=np.array([p['y']/cell-.5,p['x']/cell-.5]);i=np.argmin(((candidates-target)**2).sum(axis=1));y,x=candidates[i]
    return point(cell,x,y)
def take(rng,mask,count):
    candidates=np.argwhere(mask)
    if not len(candidates):return np.empty((0,2),dtype=int)
    return candidates[rng.choice(len(candidates),min(count,len(candidates)),replace=False)]

def maze(seed,size=25,cell=64):
    """Depth-first maze with an optional loop, explicit entrance, exit and solved route."""
    rng=np.random.default_rng(seed);grid=np.zeros((size,size),bool);grid[1,1]=True;stack=[(1,1)]
    while stack:
        x,y=stack[-1];options=[(x+dx,y+dy)for dx,dy in [(2,0),(-2,0),(0,2),(0,-2)] if 0<x+dx<size-1 and 0<y+dy<size-1 and not grid[y+dy,x+dx]]
        if not options:stack.pop();continue
        nx,ny=options[int(rng.integers(len(options)))];grid[(y+ny)//2,(x+nx)//2]=True;grid[ny,nx]=True;stack.append((nx,ny))
    grid[0,1]=True;grid[-1,-2]=True
    path=astar(np.where(grid,1.,np.inf),(1,0),(size-2,size-1))
    return {'width':size*cell,'height':size*cell,'cellSize':cell,'floor':[''.join('1' if v else '0' for v in row)for row in grid], 'entrance':point(cell,1,0),'exit':point(cell,size-2,size-1),'solution':compress_path(path,cell),'reward':point(cell,size-2,size-2),'rewardPolicy':'once-per-character; runtime integration required'}

def geometry(context,feature,cell):
    factor=context['planet']['unitsPerMapUnit']*context['planet']['scale'];source=context['coastlines'][feature]
    x0=min(p[0]for p in source)*factor-cell*2;y0=min(p[1]for p in source)*factor-cell*2
    outline=[[(p[0]*factor-x0),(p[1]*factor-y0)] for p in source]
    width=math.ceil((max(p[0]for p in outline)+cell*2)/cell)*cell;height=math.ceil((max(p[1]for p in outline)+cell*2)/cell)*cell
    f=context['planet']['features'][feature];anchor={'x':f['source']['x']*factor-x0,'y':f['source']['y']*factor-y0}
    return {'width':width,'height':height,'cellSize':cell,'outline':outline,'sourceOrigin':{'x':x0/factor,'y':y0/factor},'sourceUnitsToGame':factor,'planetFeature':f,'anchor':anchor,'projection':'azimuthal-equidistant; source offsets * canonical scale; planet.json sourceToPlanet'},mask_polygon(outline,(height//cell,width//cell),cell)

def build(context,feature,seed,cell=32):
    geom,land=geometry(context,feature,cell);rng=np.random.default_rng(seed);shape=land.shape
    continent=context['planet']['features'][feature]['kind']=='continent'
    affinity=feature if continent else context['planet']['islandEdges'][feature][0]
    elevation=(.5*smooth_noise(rng,shape,48)+.3*smooth_noise(rng,shape,17)+.2*smooth_noise(rng,shape,5)).astype('float32')
    humidity=smooth_noise(rng,shape,24);biome=np.zeros(shape,'uint8');biome[humidity>.55]=1;biome[elevation>.66]=2;biome[(elevation<.43)&(humidity>.58)]=3;biome[~land]=255
    coast_distance=ndimage.distance_transform_edt(land)*cell
    safe=np.zeros(shape,bool);blocked=np.zeros(shape,bool);reserved=np.zeros(shape,bool)
    settlements=[];buildings=[];npcs=[];pois=[];doors=[];accepted=None;offset=None
    mainlabels,_=ndimage.label(land);anchor=near(land,geom['anchor'],cell);ax,ay=cell_of(anchor,cell);main=mainlabels==mainlabels[ay,ax]
    def add_settlement(sid,name,centre,capital=False):
        nonlocal safe,reserved
        r={'x':centre['x']-1536,'y':centre['y']-1280,'width':3072,'height':2560};m=obstacle_mask(shape,r,cell)
        if np.any(m&~land):raise ValueError('Settlement would change canonical coast: '+sid)
        safe|=m;reserved|=m
        s={'id':sid,'name':name,**centre,'bounds':r,'kind':'capital' if capital else 'town','services':SERVICES};settlements.append(s);pois.append({'id':sid,'kind':'settlement',**centre,'hidden':False})
        if not capital:
            for (dx,dy),service in zip([(-960,-640),(0,-896),(960,-640),(-960,640),(0,896),(960,640)],SERVICES):
                d={'x':centre['x']+dx,'y':centre['y']+dy+128};b={'id':sid+'-'+service,'service':service,'settlement':sid,'door':d,'footprint':{'x':d['x']-192,'y':d['y']-256,'width':384,'height':160},'interior':{'template':affinity+'-'+service,'entryPolicy':'enter-at-door; exit-to-same-door'}}
                buildings.append(b);blocked[:]|=obstacle_mask(shape,b['footprint'],cell);doors.append((b['id'],d));npcs.append({'id':b['id']+'-npc','building':b['id'],'role':service,'name':name+' — '+service,**d})
    if continent:
        accepted=context['worlds'][feature];oldanchor=accepted['spawn'];offset={k:geom['anchor'][k]-oldanchor[k]for k in ['x','y']}
        bounds=accepted['city'].get('bounds',{'x':0,'y':0,'width':accepted['width'],'height':accepted['height']})
        rect={**bounds,'x':bounds['x']+offset['x'],'y':bounds['y']+offset['y']};citymask=obstacle_mask(shape,rect,cell)
        if np.any(citymask&~land):raise ValueError('Accepted capital does not fit canonical coastline')
        safe|=citymask;reserved|=ndimage.binary_dilation(citymask,iterations=20)
        settlements.append({'id':feature+'-capital','name':accepted['settlement'],**geom['anchor'],'bounds':rect,'kind':'capital','services':SERVICES})
        pois.append({'id':feature+'-capital','kind':'settlement',**geom['anchor'],'hidden':False})
        # Preserve exact city geometry. Old test-map borders outside its bounds are not planetary walls.
        for r in accepted['obstacles']:
            tr={**r,'x':r['x']+offset['x'],'y':r['y']+offset['y']};blocked|=obstacle_mask(shape,tr,cell)&citymask
        for b in accepted['city']['buildings']:
            d={k:b['door'][k]+offset[k]for k in ['x','y']};doors.append(('accepted-'+b['id'],d))
        for n in accepted['npcs']:npcs.append({**n,'id':'accepted-'+n['id'],'x':n['x']+offset['x'],'y':n['y']+offset['y']})
    else:
        anchor=near(main&(coast_distance>2100),anchor,cell)
        add_settlement(feature+'-harbour','Przystań '+feature,anchor)
    for number in range(3 if continent else 0):
        eligible=main&(coast_distance>2300)&~ndimage.binary_dilation(reserved,iterations=70)
        samples=take(rng,eligible,2000)
        if not len(samples):raise ValueError('No room for separated towns')
        centres=np.array([[s['y']/cell,s['x']/cell]for s in settlements]);dist=((samples[:,None,:]-centres[None,:,:])**2).sum(axis=2).min(axis=1)
        y,x=samples[np.argmax(dist)];centre=point(cell,x,y)
        add_settlement(feature+'-town-'+str(number+1),NAMES[feature]+' — miasto '+str(number+2),centre)
    # Named existing cardinal regions are retained. Verdantia receives explicit provisional names.
    zone_source=context['zones'].get(feature,{}).get('zones',[])
    defaults=['Północne Ostępy','Południowe Rozlewiska','Wschodnie Wzgórza','Zachodnie Gaje']
    zones=[]
    for i,direction in enumerate(['north','south','east','west']):
        known=next((z for z in zone_source if z['id']==direction),None)
        target={'x':geom['anchor']['x']+(1 if direction=='east' else -1 if direction=='west' else 0)*geom['width']*.28,'y':geom['anchor']['y']+(1 if direction=='south' else -1 if direction=='north' else 0)*geom['height']*.28}
        p=near(main&~blocked,target,cell);zones.append({'id':feature+'-'+direction,'name':known['name']if known else (defaults[i]if continent else 'Sektor '+direction),'nameSource':'zones.json'if known else 'procedural proposal',**p,'levelBand':[1+i*3,min(20,5+i*4)]})
    for zone in zones:
        pois.append({**zone,'kind':'wilderness','hidden':False})
        reserved|=obstacle_mask(shape,{'x':zone['x']-256,'y':zone['y']-256,'width':512,'height':512},cell)
    # Contents per landmass, with isolation and spacing constraints rather than repeated fixed coordinates.
    kinds=(['village']*10+['port']*3+['watchtower']*8+['ruins']*10+['cave']*8+['shrine']*8+['hidden-cache']*16+['maze']*8) if continent else (['camp']*3+['port']*2+['ruins']*3+['cave']*2+['shrine']*2+['hidden-cache']*6+['maze']*3)
    for i,kind in enumerate(kinds):
        eligible=main&~blocked&~ndimage.binary_dilation(reserved,iterations=12)
        if kind=='port':eligible&=(coast_distance<900)&(coast_distance>160)
        else:eligible&=coast_distance>400
        options=take(rng,eligible,1200)
        if not len(options):raise ValueError('Cannot place '+kind+' on '+feature)
        y,x=options[int(rng.integers(len(options)))];p=point(cell,x,y);sid=feature+'-'+kind+'-'+str(i)
        pois.append({'id':sid,'kind':kind,**p,'hidden':kind in ['hidden-cache','cave','maze'],'discoveryRadius':192 if kind in ['hidden-cache','cave','maze']else 600})
        r={'x':p['x']-384,'y':p['y']-384,'width':768,'height':768};reserved|=obstacle_mask(shape,r,cell)
        if kind in ['village','camp','port']:
            safe|=obstacle_mask(shape,{'x':p['x']-384,'y':p['y']-384,'width':768,'height':768},cell)&land
            npcs.append({'id':sid+'-guide','role':'guide','name':'Opiekun szlaku',**p,'dialogue':'Szlaki prowadzą do osad, ale ruiny i jaskinie kryją boczne przejścia.'})
    # Villages and ports have actual separate footprints and entrance coordinates, not only map pins.
    for location in [p for p in pois if p['kind'] in ['village','camp','port','watchtower']]:
        for j,(dx,dy) in enumerate([(-224,-224),(224,-224),(-224,224),(224,224)]):
            rect={'x':location['x']+dx-64,'y':location['y']+dy-64,'width':128,'height':96}
            mask=obstacle_mask(shape,rect,cell)
            if np.any(mask&(~land|blocked)):continue
            bid=location['id']+'-house-'+str(j);door={'x':location['x']+dx,'y':location['y']+dy+96}
            if not land[cell_of(door,cell)[1],cell_of(door,cell)[0]]:continue
            buildings.append({'id':bid,'service':'residence','settlement':location['id'],'footprint':rect,'door':door,'interior':{'template':affinity+'-residence','entryPolicy':'door; return-to-same-door'}})
            blocked|=mask;doors.append((bid,door))
    # Route on a 128-unit graph, strictly within the traced land. Exact door access uses 32-unit grid.
    stride=4;coarse_shape=(math.ceil(shape[0]/stride),math.ceil(shape[1]/stride))
    coarse_land=land[stride//2::stride,stride//2::stride];cost=(1+np.abs(elevation[stride//2::stride,stride//2::stride]-.5)*3).astype(float);cost[~coarse_land]=np.inf
    coarse_blocked=ndimage.maximum_filter(blocked,size=3)[stride//2::stride,stride//2::stride];cost[coarse_blocked]=np.inf
    coarse_cell=cell*stride;roads=[];roadmask=np.zeros(shape,bool);coarse_open=np.isfinite(cost)
    nodepoints=[near(coarse_open,p,coarse_cell)for p in pois];coarse_nodes=[cell_of(p,coarse_cell)for p in nodepoints]
    connected={0};edges=[]
    while len(connected)<len(pois):
        _,a,b=min((math.hypot(nodepoints[a]['x']-nodepoints[b]['x'],nodepoints[a]['y']-nodepoints[b]['y']),a,b)for a in connected for b in range(len(pois))if b not in connected)
        edges.append((a,b));connected.add(b)
    # Extra links between nearby non-tree neighbours create loops and alternate routes.
    tree=cKDTree([[p['x'],p['y']]for p in nodepoints]);_,neighbours=tree.query([[p['x'],p['y']]for p in nodepoints],k=3)
    for a,ns in enumerate(neighbours):
        b=int(ns[-1]);pair=(min(a,b),max(a,b))
        if pair not in [(min(x,y),max(x,y))for x,y in edges]:edges.append(pair)
    finecost=np.where(land&~blocked,1.,np.inf)
    def paint_route(path,rid,kind,width):
        pts=compress_path(path,cell)
        for x,y in path:roadmask[y,x]=True
        roads.append({'id':rid,'kind':kind,'width':width,'points':pts})
    for a,b in edges:
        cp=astar(cost,coarse_nodes[a],coarse_nodes[b]);fp=[]
        # Expand the coarse polyline with fine A*; never cut a coast or an exact city obstacle.
        for start,end in zip(cp,cp[1:]):
            aa=(start[0]*stride+stride//2,start[1]*stride+stride//2);bb=(end[0]*stride+stride//2,end[1]*stride+stride//2)
            route=astar(finecost,aa,bb);fp.extend(route[:-1])
        fp.append((cp[-1][0]*stride+stride//2,cp[-1][1]*stride+stride//2))
        paint_route(fp,feature+'-route-'+str(len(roads)),'trail'if pois[b]['hidden']else 'road',48 if pois[b]['hidden']else 96)
    for i,(poi,node) in enumerate(zip(pois,nodepoints)):
        p=cell_of(poi,cell);n=cell_of(node,cell);route=astar(finecost,p,n);paint_route(route,'access-'+poi['id'],'secret-trail'if poi['hidden']else 'path',32 if poi['hidden']else 64)
    # Doors are exact points, not shifted to nearest free cells.
    for bid,door in doors:
        closest=min(pois,key=lambda p:math.hypot(p['x']-door['x'],p['y']-door['y']))
        route=astar(finecost,cell_of(door,cell),cell_of(closest,cell));paint_route(route,'door-'+bid,'city-path',64)
    # Procedural streams end at the real coast; bridges are explicit where routes cross.
    water=np.zeros(shape,bool)
    for i in range(3 if continent else 1):
        valid=main&~ndimage.binary_dilation(safe,iterations=12)&~blocked
        options=take(rng,valid&(coast_distance>1500),800)
        y,x=max(options,key=lambda p:float(elevation[p[0],p[1]]));start=(int(x),int(y))
        ends=take(rng,main&(coast_distance<cell*2)&~blocked,400)
        ey,ex=min(ends,key=lambda p:(p[0]-y)**2+(p[1]-x)**2)
        rivercost=np.where(valid,1+elevation*4,np.inf)
        try:
            route=astar(rivercost,start,(int(ex),int(ey)))
        except ValueError:continue
        for rx,ry in route:water[ry,rx]=True
    water=ndimage.binary_dilation(water,iterations=1)&land&~safe&~blocked
    bridges=water&roadmask;walkable=land&~blocked&(~water|bridges)
    labels,_=ndimage.label(walkable);sx,sy=cell_of(pois[0],cell);connected_land=labels==labels[sy,sx]
    available=walkable&~safe&~ndimage.binary_dilation(roadmask,iterations=3)&connected_land
    # Solid scenery respects roads, city boundaries and all discovery/entrance approach areas.
    approaches=np.zeros(shape,bool)
    for location in pois:
        x,y=cell_of(location,cell);approaches[max(0,y-8):y+9,max(0,x-8):x+9]=True
    objects=[];occupied_props=np.zeros(shape,bool)
    for i,(y,x)in enumerate(take(rng,available,int(land.sum()/12))):
        solid=bool(biome[y,x] in [1,2] and i%3==0 and not approaches[y,x])
        obj={'id':feature+'-object-'+str(i),**point(cell,x,y),'kind':['tree','bush','rock','crystal'][int(biome[y,x])],'biome':int(biome[y,x]),'solid':solid}
        occupied_props[y,x]=True
        if solid:
            obj['footprint']={'x':int(x*cell),'y':int(y*cell),'width':cell,'height':cell};blocked[y,x]=True;walkable[y,x]=False
        objects.append(obj)
    labels,_=ndimage.label(walkable);connected_land=labels==labels[sy,sx]
    available=walkable&~safe&~ndimage.binary_dilation(roadmask,iterations=3)&connected_land&~occupied_props
    resources=[{'id':feature+'-resource-'+str(i),**point(cell,x,y),'kind':['wood','herb','ore','ki-crystal'][i%4],'respawnMs':180000} for i,(y,x)in enumerate(take(rng,available,int(land.sum()/500)))]
    dungeons=[]
    for i,p in enumerate(p for p in pois if p['kind']in ['maze','cave','ruins']):
        d=maze(seed+i*97,31 if p['kind']=='maze'else 21);d.update({'id':p['id'],'overworldEntrance':{'x':p['x'],'y':p['y']},'theme':affinity,'kind':p['kind'],'instance':'local-interior','exitPolicy':'return-to-overworldEntrance'});dungeons.append(d)
    plan={'version':1,'generator':VERSION,'feature':feature,'name':NAMES.get(feature,'Wyspa '+feature.split('-')[-1]),'kind':'continent'if continent else 'island','seed':seed,'geometry':geom,'sourceSha':context['sourceSha'],'coastlineSha256':digest(canonical(context['coastlines'][feature])),'acceptedSource':accepted,'acceptedSourceSha256':digest(canonical(accepted)),'sourceOffset':offset,'biomeNames':THEMES[affinity],'affinity':affinity,'settlements':settlements,'buildings':buildings,'npcs':npcs,'zones':zones,'locations':pois,'roads':roads,'resources':resources,'dungeons':dungeons,'doors':[{'id':bid,**d}for bid,d in doors],'spawnGeneration':'separate; spawn_generate.py','runtimeInstalled':False}
    arrays={'land':land,'biome':biome,'elevation':elevation,'water':water,'walkable':walkable,'safe':safe,'roads':roadmask,'bridges':bridges,'blocked':blocked}
    report=validate(plan,arrays)
    return plan,arrays,objects,report

def validate(plan,arrays):
    errors=[];cell=plan['geometry']['cellSize'];walk=arrays['walkable'];labels,_=ndimage.label(walk)
    sx,sy=cell_of(plan['locations'][0],cell);component=int(labels[sy,sx]);targets=plan['locations']+plan['doors']+plan['resources']
    for p in targets:
        x,y=cell_of(p,cell)
        if not component or labels[y,x]!=component:errors.append('Unreachable '+p['id'])
    if np.any(arrays['roads']&(~arrays['land']|arrays['blocked'])):errors.append('Road crosses sea or footprint')
    if np.any(arrays['safe']&~arrays['land']):errors.append('City changes canonical coast')
    if digest(canonical(plan['acceptedSource']))!=plan['acceptedSourceSha256']:errors.append('Accepted source changed')
    for d in plan['dungeons']:
        floor=np.array([[c=='1'for c in row]for row in d['floor']]);l,_=ndimage.label(floor);a=cell_of(d['entrance'],d['cellSize']);b=cell_of(d['exit'],d['cellSize'])
        if not l[a[1],a[0]]or l[a[1],a[0]]!=l[b[1],b[0]]:errors.append('Unsolvable '+d['id'])
    return {'passed':not errors,'errors':errors,'feature':plan['feature'],'size':[plan['geometry']['width'],plan['geometry']['height']],'landCells':int(arrays['land'].sum()),'cellSize':cell,'settlements':len(plan['settlements']),'entrances':len(plan['doors']),'serviceDoors':sum(b.get('service')in SERVICES for b in plan['buildings'])+(6 if plan['acceptedSource'] else 0),'locations':len(plan['locations']),'hiddenLocations':sum(p['hidden']for p in plan['locations']),'roads':len(plan['roads']),'dungeons':len(plan['dungeons']),'resources':len(plan['resources']),'targetsChecked':len(targets),'reachableWalkablePercent':round(float((labels==component).sum()/max(1,walk.sum())*100),3),'limitations':['Generated data, not installed in Phaser.','32-unit topology needs runtime collision, art, save migration and hardware acceptance.','Solid scenery uses 32-unit footprints; exact Phaser clearance requires runtime acceptance.']}

def preview(plan,arrays,output):
    from PIL import ImageColor
    palette=np.array([ImageColor.getrgb(c)for c in PALETTES[plan['affinity']]],'uint8');rgb=palette[np.minimum(arrays['biome'],3)];rgb[~arrays['land']]=[20,52,73];rgb[arrays['water']]=[57,128,166];rgb[arrays['roads']]=[210,186,137];rgb[arrays['safe']]=np.clip(rgb[arrays['safe']].astype(int)+25,0,255)
    im=Image.fromarray(rgb);im.thumbnail((1800,1300));dr=ImageDraw.Draw(im);scale=im.width/plan['geometry']['width']
    for p in plan['locations']:
        if p['hidden']:continue
        x,y=p['x']*scale,p['y']*scale;r=5 if p['kind']=='settlement'else 2;dr.ellipse((x-r,y-r,x+r,y+r),fill='#fff0ae'if not p['hidden']else '#d09eea')
    im.save(output)

def generate(context,feature,seed,output,cell):
    start=time.perf_counter();directory=Path(output)/feature
    if directory.exists():raise FileExistsError('Refusing overwrite: '+str(directory))
    plan,arrays,objects,report=build(context,feature,seed,cell)
    if not report['passed']:raise ValueError(json.dumps(report))
    directory.mkdir(parents=True);write(directory/'world.json',plan);write(directory/'quality.json',report);preview(plan,arrays,directory/'minimap.png');chunks=[]
    groups={}
    for o in objects:groups.setdefault((o['x']//2048,o['y']//2048),[]).append(o)
    (directory/'chunks').mkdir()
    for y in range(0,arrays['land'].shape[0],64):
        for x in range(0,arrays['land'].shape[1],64):
            cid=f'{x//64}-{y//64}';np.savez_compressed(directory/'chunks'/f'{cid}.npz',**{k:v[y:y+64,x:x+64]for k,v in arrays.items()});write(directory/'chunks'/f'{cid}.objects.json',groups.get((x//64,y//64),[]));chunks.append({'id':cid,'x':x*cell,'y':y*cell,'width':min(64,arrays['land'].shape[1]-x)*cell,'height':min(64,arrays['land'].shape[0]-y)*cell,'terrain':f'chunks/{cid}.npz','objects':f'chunks/{cid}.objects.json'})
    write(directory/'chunks.json',chunks)
    files={str(p.relative_to(directory)):digest(p.read_bytes())for p in sorted(directory.rglob('*'))if p.is_file()};write(directory/'manifest.json',{'generator':VERSION,'algorithmSha256':digest(Path(__file__).read_bytes()),'helperSha256':digest(Path(__file__).with_name('generate.py').read_bytes()),'contextSha256':digest(canonical(context)),'seed':seed,'files':files})
    return {**report,'objects':len(objects),'solidObjects':sum(o['solid']for o in objects),'seconds':round(time.perf_counter()-start,3)}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--context',required=True);p.add_argument('--output',required=True);p.add_argument('--seed',type=int,default=5742000);p.add_argument('--workers',type=int,default=8);p.add_argument('--features',nargs='*');p.add_argument('--cell',type=int,choices=[32],default=32);a=p.parse_args()
    if not 1<=a.workers<=int(os.environ.get('KI_WORLDGEN_CPU_BUDGET',8)):p.error('Workers exceed allocated CPU budget')
    c=read(a.context);features=a.features or list(c['planet']['features']);output=Path(a.output)
    if len(set(features))!=len(features)or any(f not in c['planet']['features']for f in features):p.error('Unknown or duplicate landmass')
    output.mkdir(parents=True,exist_ok=True);start=time.perf_counter();reports=[]
    with concurrent.futures.ProcessPoolExecutor(max_workers=a.workers)as pool:
        jobs=[pool.submit(generate,c,f,a.seed+list(c['planet']['features']).index(f)*1009,str(output),a.cell)for f in features]
        for job in concurrent.futures.as_completed(jobs):r=job.result();reports.append(r);print(json.dumps(r),flush=True)
    # The planet geometry remains byte-equivalent JSON data, including polar islands and tetrahedron anchors.
    write(output/'planet.json',c['planet']);write(output/'bestiary.json',c['bestiary']);write(output/'generation-report.json',{'generator':VERSION,'sourceSha':c['sourceSha'],'workers':a.workers,'wallSeconds':round(time.perf_counter()-start,3),'features':reports,'spawnGeneration':'not run; separate stage','runtimeInstalled':False})
    from planet_travel import build_links
    write(output/'travel-links.json',build_links(c,output,reports))
    from planet_viewer import write_viewer
    write_viewer(output,reports)
    print('COMPLETE',round(time.perf_counter()-start,3),flush=True)
if __name__=='__main__':main()
