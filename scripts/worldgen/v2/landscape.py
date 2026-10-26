#!/usr/bin/env python3
"""Build a new browser-native landscape with retained v1 cities, saves and art bindings.
Never edits v1. Stable old spawn IDs survive; fresh encounters use a v2 namespace.
"""
from __future__ import annotations
import argparse, copy, hashlib, json, math, sys, time
from pathlib import Path
import numpy as np
from scipy import ndimage
from PIL import Image
from geometry import read, write, IDS, forward, rle, boundary_rings
from migration_preview import decode
from audit import sha
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from generate import smooth_noise, astar, compress_path
from convert_browser import nav_field, Collider, accessible
from bind_world_art import BIOMES, PALETTES

ROOT=Path(__file__).resolve().parents[3]
V1=ROOT/'public/game/worlds/superior-v1'
PROTO=ROOT/'public/game/worlds/superior-v2-prototype'
GEOGRAPHY='astra'

def ki_relief(rng,shape,land,new):
    """Ridged mountain chains inland, gentle lowland near the coast (geography 'ki')."""
    def octaves(spacing,ridge=False):
        acc=np.zeros(shape);amp=1.;total=0.
        for o in range(4):
            n=smooth_noise(rng,shape,max(2,spacing/2**o))
            if ridge:n=1-np.abs(n*2-1)
            acc+=n*amp;total+=amp;amp*=.5
        return acc/total
    coast=ndimage.distance_transform_edt(land);dn=np.clip(coast/max(1.,coast.max()),0,1)
    chain=np.clip((octaves(160,True)**2.2-.3)*2.2,0,1)*(.35+.65*np.clip(dn*1.8,0,1))
    e=.18+.45*np.sqrt(dn)+.12*(octaves(70)-.5)+.55*chain*(.6+.4*octaves(60))
    e=ndimage.gaussian_filter(e,1.2);e[~land]=0;e=e/max(1e-6,e[land].max())
    # Rank-normalise the added land so every continent gets ranges (~14%) regardless of its size.
    if new.any():
        r=np.zeros(shape);order=np.argsort(e[new]);v=np.empty(len(order));v[order]=np.linspace(0,1,len(order));r[new]=v;e=np.where(new,r,e)
    return e

def ki_rivers(rng,elevation,land,allowed,count=10):
    """Rivers start high and walk downhill to the sea; they widen downstream."""
    height=elevation+(smooth_noise(rng,elevation.shape,14)-.5)*.09;river=np.zeros(elevation.shape,np.uint8)
    starts=np.argwhere(allowed&(elevation>.88));rng.shuffle(starts);made=0;h,w=elevation.shape
    for y,x in starts[:600]:
        if made>=count:break
        if river[max(0,y-12):y+12,max(0,x-12):x+12].any():continue
        path=[(y,x)];seen={(y,x)};ok=False
        for _ in range(4000):
            best=None;bh=height[y,x]+.02
            for dy,dx in((-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,1),(-1,1),(1,-1)):
                ny,nx=y+dy,x+dx
                if 0<=ny<h and 0<=nx<w and(ny,nx)not in seen and height[ny,nx]<bh:bh=height[ny,nx];best=(ny,nx)
            if best is None:break
            y,x=best;seen.add(best);path.append(best)
            if not land[y,x]or river[y,x]:ok=True;break
            if not allowed[y,x]:break
        if ok and len(path)>60:
            made+=1
            for i,(py,px)in enumerate(path):river[py,px]=max(river[py,px],1+int(i/len(path)*2.99))
    water=np.zeros(river.shape,bool)
    for width in(1,2,3):water|=ndimage.binary_dilation(river>=width,iterations=width)
    return water&land&allowed,made

def move(value,delta):
    """Translate explicit world positions, not widths, local interior coordinates or art metadata."""
    out=copy.deepcopy(value)
    if isinstance(out,dict):
        if isinstance(out.get('x'),(float,int))and isinstance(out.get('y'),(float,int)):
            out['x']+=delta['x'];out['y']+=delta['y']
        for key in ['door','footprint','bounds','overworldEntrance']:
            if isinstance(out.get(key),dict):out[key]=move(out[key],delta)
        if 'points'in out:out['points']=[[x+delta['x'],y+delta['y']]for x,y in out['points']]
    return out

def read_labels():
    m=read(PROTO/'sphere-chunks.json');a=np.zeros((m['height'],m['width']),np.uint8)
    for name in m['chunks']:
        c=read(PROTO/name);a[c['y']:c['y']+c['height'],c['x']:c['x']+c['width']]=decode(c['labels'],c['width'],c['height'])
    return a

def ki_spawns(key,plan,spawns,room,safe_distance,monsters,rng,nav,collider,nav_labels,component,anchor,shape):
    """Wilderness for levelling: camps of 3-6 monsters and lone ones across the added land; the
    monster level grows with the distance from the arrival town (1 near it, the bestiary's top far away)."""
    cells=np.argwhere(room&(safe_distance>1600))
    if not len(cells):return
    ay,ax=anchor['y']/32,anchor['x']/32;dist=np.hypot(cells[:,0]-ay,cells[:,1]-ax);far=dist.max()
    by_level=sorted(monsters,key=lambda m:m['level']);top=by_level[-1]['level']
    def pick(y,x):
        want=1+(top-1)*min(1.,np.hypot(y-ay,x-ax)/far*1.15)
        near=[m for m in by_level if abs(m['level']-want)<=2] or [min(by_level,key=lambda m:abs(m['level']-want))]
        return near[int(rng.integers(len(near)))]
    plan['camps']=[];n=0
    def add(y,x,m,tag):
        nonlocal n
        p={'x':int(x*32+16),'y':int(y*32+16)};margin=max(m['traits']['leash'],m['traits'].get('wander',0),m['agro'])+256
        if not(0<=y<shape[0]and 0<=x<shape[1])or not room[y,x]or safe_distance[y,x]<=margin or not accessible(p,nav,collider,nav_labels,component):return False
        spawns['overworld'].append({'id':f'{key}-v2-{tag}-{n}','kind':m['id'],**p,'level':m['level'],'respawnMs':m['respawn'],'homeLeash':m['traits']['leash'],'safeExclusion':margin,'streamCell':[p['x']//2048,p['y']//2048],'packSizePolicy':'one authored slot'});n+=1;return True
    for c in range(min(40,len(cells)//4000)):
        y,x=cells[int(rng.integers(len(cells)))];m=pick(y,x)
        placed=sum(add(int(y+rng.integers(-9,10)),int(x+rng.integers(-9,10)),m,'camp') for _ in range(int(rng.integers(3,7))))
        if placed:plan['camps'].append({'id':f'{key}-camp-{c}','x':int(x*32+16),'y':int(y*32+16),'level':m['level'],'monster':m['id']})
    for _ in range(min(500,len(cells)//400)):
        y,x=cells[int(rng.integers(len(cells)))];add(int(y),int(x),pick(y,x),'wild')

def region(key,output,context,labels):
    started=time.perf_counter();old=read(V1/key/'world.json');g=read(PROTO/key/'geometry.json');planet=context['planet'];idx=IDS.index(key)+1;island=key.startswith('island')
    if island:delta={'x':0,'y':0};width=old['geometry']['width'];height=old['geometry']['height'];anchor=old['geometry']['anchor']
    else:
        delta={k:math.ceil(g['oldToNewTranslation'][k]/32)*32 for k in ['x','y']};anchor={k:old['geometry']['anchor'][k]+delta[k]for k in ['x','y']}
        width=int(math.ceil((g['width']+64)/32)*32);height=int(math.ceil((g['height']+64)/32)*32)
    shape=(height//32,width//32);rng=np.random.default_rng(5746300+idx)
    land=np.zeros(shape,bool)
    for y0 in range(0,shape[0],64):
        yy,xx=np.mgrid[y0:min(y0+64,shape[0]),:shape[1]]
        xy=np.stack([((xx+.5)*32-anchor['x'])/planet['radius'],(anchor['y']-(yy+.5)*32)/planet['radius']],axis=-1);v=forward(xy,planet['features'][key])
        lon=np.arctan2(v[...,1],v[...,0]);lat=np.arcsin(np.clip(v[...,2],-1,1));cx=np.floor((lon+np.pi)/(2*np.pi)*labels.shape[1]).astype(int)%labels.shape[1];cy=np.clip(np.floor((np.pi/2-lat)/np.pi*labels.shape[0]).astype(int),0,labels.shape[0]-1);land[y0:y0+len(yy)]=labels[cy,cx]==idx
    elevation=smooth_noise(rng,shape,35);humidity=smooth_noise(rng,shape,23);biome=np.zeros(shape,np.uint8);biome[humidity>.56]=1;biome[elevation>.65]=2;biome[(elevation<.44)&(humidity>.56)]=3
    prior=np.zeros(shape,bool);raw=land.copy();safe=np.zeros(shape,bool);roads=np.zeros(shape,bool);bridges=np.zeros(shape,bool)
    objects=[];art_objects=[];dx,dy=int(delta['x']//32),int(delta['y']//32)
    for entry in read(V1/key/'chunks.json'):
        c=read(V1/key/entry['path']);t=c['terrain'];flags=decode(t['flags'],t['width'],t['height']);b=decode(t['biome'],t['width'],t['height']);x=int(c['x']//32)+dx;y=int(c['y']//32)+dy;h,w=flags.shape;slice_=np.s_[y:y+h,x:x+w];mask=(flags&16)>0
        prior[slice_]|=mask;land[slice_]|=mask;raw[slice_][mask]=(flags[mask]&1)>0;safe[slice_]|=(flags&2)>0;roads[slice_]|=(flags&4)>0;bridges[slice_]|=(flags&8)>0;biome[slice_][mask]=b[mask]
        objects.extend(move(o,delta)for o in c['objects'])
        ap=V1/'art'/key/'chunks'/(c['id']+'.art.json')
        if ap.exists():art_objects.extend(move(o,delta)for o in read(ap)['objects'])
    if island:land=prior.copy();raw&=land
    new=land&~prior;water=land&~raw
    if GEOGRAPHY=='ki':
        elevation=ki_relief(rng,shape,land,new);wet0=ndimage.gaussian_filter((~land).astype(float),10)*1.2+smooth_noise(rng,shape,40)*.9
        forest=.5*wet0+.5*smooth_noise(rng,shape,22);kb=np.zeros(shape,np.uint8)
        kb[forest>np.quantile(forest[new],.6)if new.any()else 1]=1;kb[elevation>.86]=2;kb[(elevation>.74)&(elevation<=.86)]=1
        biome[new]=kb[new]
    plan=copy.deepcopy(old);plan['generator']='superior-landscape-2';plan['geometry']={**old['geometry'],'width':width,'height':height,'anchor':anchor,'cellSize':32,'projection':'azimuthal-equidistant; spherical v2 coastline','geometryVersion':2}
    for field in ['settlements','buildings','npcs','zones','resources','roads','doors']:
        plan[field]=[move(p,delta)for p in old[field]]
    plan['sourceOffset']=None if old['sourceOffset']is None else {k:old['sourceOffset'][k]+delta[k]for k in ['x','y']}
    retired={d['id']for d in old['dungeons']};plan['locations']=[move(p,delta)for p in old['locations']if p['id']not in retired]
    plan['dungeons']=[];proposal=read(PROTO/'dungeon-proposal.json')
    for d in proposal['entries']:
        for entry in d['entrances']:
            if entry['feature']!=key:continue
            p=move(entry['v1'],delta);identity=d['id']+'-'+key
            plan['dungeons'].append({'id':identity,'instanceId':d['id'],'kind':'maze'if d['labyrinth']else'cave','overworldEntrance':p,'status':'entrance reserved; interior integration pending'})
            plan['locations'].append({'id':identity,'kind':'maze'if d['labyrinth']else'cave','hidden':False,**p})
    # Protect all existing interactions, not just the capital.
    protected=ndimage.binary_dilation(safe,iterations=10)
    for p in plan['locations']+plan['doors']+plan['resources']:
        x,y=int(p['x']//32),int(p['y']//32);protected[max(0,y-8):y+9,max(0,x-8):x+9]=True
    # New lakes only in added geography; original terrain and saved positions stay intact.
    for _ in range(4 if not island and GEOGRAPHY!='ki' else 0):
        candidates=np.argwhere(new&~protected&(elevation<.44))
        if not len(candidates):break
        y,x=candidates[int(rng.integers(len(candidates)))];ry,rx=int(rng.integers(7,14)),int(rng.integers(10,20))
        yy,xx=np.ogrid[max(0,y-ry):min(shape[0],y+ry+1),max(0,x-rx):min(shape[1],x+rx+1)];patch=((xx-x)/rx)**2+((yy-y)/ry)**2<=1
        sl=np.s_[max(0,y-ry):min(shape[0],y+ry+1),max(0,x-rx):min(shape[1],x+rx+1)];water[sl]|=patch&new[sl]&~protected[sl]
    rectangles=[move(r,delta)for r in read(V1/key/'collision.json')]
    blocked=np.zeros(shape,bool)
    for r in rectangles:
        x0=max(0,int(r['x']//32));y0=max(0,int(r['y']//32));x1=min(shape[1],math.ceil((r['x']+r['width'])/32));y1=min(shape[0],math.ceil((r['y']+r['height'])/32));blocked[y0:y1,x0:x1]=True
    # Three broad exploration routes connect fresh landscape to existing towns.
    coast=ndimage.distance_transform_edt(land)*32
    candidates=np.argwhere(new&(coast>500)&~protected&~blocked&~water)
    for number,angle in enumerate([0,np.pi/2,np.pi,3*np.pi/2]if not island else[]):
        if not len(candidates):break
        score=(candidates[:,1]*32-anchor['x'])*math.cos(angle)+(candidates[:,0]*32-anchor['y'])*math.sin(angle);yy,xx=candidates[np.argmax(score)];target={'id':key+'-v2-landmark-'+str(number),'kind':'wilderness','hidden':False,'x':int(xx*32+16),'y':int(yy*32+16)}
        town=min(plan['settlements'],key=lambda p:math.hypot(p['x']-target['x'],p['y']-target['y']))
        relief=1+elevation*2 if GEOGRAPHY!='ki' else 1+(elevation*4)**2+(biome==2)*30+water*40+smooth_noise(rng,shape,6)*3
        cost=np.where(land[2::4,2::4]&~ndimage.maximum_filter(blocked,size=3)[2::4,2::4],relief[2::4,2::4],np.inf)
        start=(int(town['x']//128),int(town['y']//128));end=(int(target['x']//128),int(target['y']//128))
        try:path=astar(cost,start,end)
        except ValueError:continue
        # Coarse routes are refined on the exact existing collision field.
        fine=np.where(land&~blocked,1.,np.inf);nodes=[]
        for a,b in zip(path,path[1:]):
            segment=astar(fine,(a[0]*4+2,a[1]*4+2),(b[0]*4+2,b[1]*4+2));nodes.extend(segment[:-1])
        if not nodes:continue
        for x,y in nodes:roads[y,x]=True
        plan['roads'].append({'id':target['id']+'-route','kind':'road','width':192,'points':compress_path(nodes,32)});plan['locations'].append(target)
    roads_wide=ndimage.binary_dilation(roads,iterations=2)&land&~blocked
    bridges|=roads_wide&water
    # Stream channels crossing the added region terminate at the actual ocean shore.
    if GEOGRAPHY=='ki' and not island:
        rivers,made=ki_rivers(rng,elevation,land,new&~protected&~blocked);water|=rivers
        # Lakes fill the lowest basins of the added land (each 0.5-2% of it), away from towns and paths.
        free=new&~protected&~blocked&~ndimage.binary_dilation(roads,iterations=8)&(coast>2500/32)
        # Depressions relative to their surroundings, so lakes sit in inland hollows rather than on the coast.
        basin=ndimage.gaussian_filter(elevation,6)-ndimage.gaussian_filter(elevation,60)
        for _ in range(7):
            cand=np.argwhere(free&~ndimage.binary_dilation(water,iterations=40))
            if not len(cand):break
            y,x=cand[np.argmin(basin[cand[:,0],cand[:,1]])]
            target=int(new.sum()*rng.uniform(.004,.012));level=basin[y,x];lake=np.zeros(shape,bool)
            for step in range(60):
                level+=.004;lab,_=ndimage.label(free&(basin<=level));lake=lab==lab[y,x]
                if lake.sum()>=target:break
            lake=ndimage.binary_opening(ndimage.binary_closing(lake,iterations=3),iterations=2)&free
            water|=lake;free&=~ndimage.binary_dilation(lake,iterations=30)
        near=ndimage.binary_dilation(rivers,iterations=5)&new&~water&(elevation<.7)&(biome!=2);biome[near&(smooth_noise(rng,shape,9)>.45)]=3
    for _ in range(2 if not island and GEOGRAPHY!='ki' else 0):
        candidates=np.argwhere(new&~protected&~blocked&(coast>1200))
        ends=np.argwhere(new&(coast<96)&~blocked)
        if not len(candidates)or not len(ends):continue
        y,x=candidates[np.argmax(elevation[candidates[:,0],candidates[:,1]])];ey,ex=ends[np.argmin((ends[:,0]-y)**2+(ends[:,1]-x)**2)]
        try:path=astar(np.where(new&~protected&~blocked,1+elevation*4,np.inf),(int(x),int(y)),(int(ex),int(ey)))
        except ValueError:continue
        channel=np.zeros(shape,bool)
        for xx,yy in path:channel[yy,xx]=True
        water|=ndimage.binary_dilation(channel,iterations=1)&new&~protected&~blocked
    bridges|=roads_wide&water
    # Clustered, bounded content: expanding land does not multiply old spawn/decor counts.
    room=new&~protected&~water&~blocked&~ndimage.binary_dilation(roads,iterations=6)
    patch=smooth_noise(rng,shape,13);candidates=np.argwhere(room&(patch>.48))
    count=min(12000,len(candidates)//20)
    chosen=candidates[rng.choice(len(candidates),count,replace=False)]if count else []
    kit={x['binding']:x for x in read(ROOT/'docs/world-asset-kit.json')['objects']}
    for n,(y,x)in enumerate(chosen):
        b=int(biome[y,x]);kind=['tree','tree','rock','bush'][b]if n%4 else'bush';identity=f'{key}-v2-object-{n}';o={'id':identity,'x':int(x*32+16),'y':int(y*32+16),'kind':kind,'biome':b,'solid':False};objects.append(o)
        options=PALETTES[BIOMES[old['affinity']][b]][kind];binding='object.'+options[n%len(options)]
        if binding=='object.biome-forest.tall-pine-tree':binding='object.biome-forest.tall-broadleaf-oak-tree'
        if binding=='object.crystal'and old['affinity']!='nexus':binding='object.dungeon-kit.glowing-crystal-cluster'
        entry=kit[binding];placement=entry['placement'];art_objects.append({**o,'asset':entry['asset'],'binding':binding,**{k:placement[k]for k in ['width','height','anchorX','anchorY']},'layer':entry.get('layer','objects'),'footprint':None,'collisionPolicy':'geometry-owned; swappable appearance'})
    arrays={'land':land,'water':water,'roads':roads_wide,'bridges':bridges,'blocked':blocked,'safe':safe,'biome':biome}
    raw,nav,bridges=nav_field(plan,arrays,rectangles);nav_labels,_=ndimage.label(nav);cx,cy=int(anchor['x']//16),int(anchor['y']//16);component=int(nav_labels[cy,cx]);assert component>0
    collider=Collider(raw,rectangles);checks=[]
    for p in plan['settlements']+plan['doors']+plan['resources']:
        assert accessible(p,nav,collider,nav_labels,component),(key,p['id'],'unreachable preserved interaction')
    spawns=read(V1/key/'spawns.json');spawns['overworld']=[move(s,delta)for s in spawns['overworld']];spawns['interiors']=[]
    for s in spawns['overworld']:
        assert accessible(s,nav,collider,nav_labels,component),(key,s['id'],'preserved spawn unreachable');s['streamCell']=[int(s['x']//2048),int(s['y']//2048)]
    safe_distance=ndimage.distance_transform_edt(~safe)*32;new_homes=np.argwhere(new&raw&~roads_wide&(safe_distance>1600)&(patch>.6))
    monsters=[m for m in context['bestiary']if m['world']==old['affinity']]
    if GEOGRAPHY=='ki':
        ki_spawns(key,plan,spawns,new&raw&~roads_wide&~water,safe_distance,monsters,rng,nav,collider,nav_labels,component,anchor,shape)
    for n in range(min(160,len(new_homes)//200) if GEOGRAPHY!='ki' else 0):
        y,x=new_homes[int(rng.integers(len(new_homes)))];p={'x':int(x*32+16),'y':int(y*32+16)};m=monsters[n%len(monsters)];margin=max(m['traits']['leash'],m['traits'].get('wander',0),m['agro'])+256
        if safe_distance[y,x]<=margin or not accessible(p,nav,collider,nav_labels,component):continue
        spawns['overworld'].append({'id':f'{key}-v2-spawn-{n}','kind':m['id'],**p,'level':m['level'],'respawnMs':m['respawn'],'homeLeash':m['traits']['leash'],'safeExclusion':margin,'streamCell':[p['x']//2048,p['y']//2048],'packSizePolicy':'one authored slot'})
    biome[~land]=255;flags=raw.astype(np.uint8)|safe.astype(np.uint8)*2|roads_wide.astype(np.uint8)*4|bridges.astype(np.uint8)*8|land.astype(np.uint8)*16
    rings=boundary_rings(land);outline=max(rings,key=len);plan['geometry']['outline']=[[x*32,y*32]for x,y in outline];plan['geometry']['sourceUnitsToGame']=old['geometry']['sourceUnitsToGame'];plan['geometry']['sourceOrigin']={k:old['geometry']['sourceOrigin'][k]-delta[k]/old['geometry']['sourceUnitsToGame']for k in ['x','y']}
    directory=output/key;directory.mkdir(parents=True);artdir=output/'art'/key;artdir.mkdir(parents=True);chunks=[];groups={};arts={};rects={}
    for o in objects:groups.setdefault((int(o['x']//2048),int(o['y']//2048)),[]).append(o)
    for o in art_objects:arts.setdefault((int(o['x']//2048),int(o['y']//2048)),[]).append(o)
    for i,r in enumerate(rectangles):
        for y in range(int(r['y']//2048),int((r['y']+r['height'])//2048)+1):
            for x in range(int(r['x']//2048),int((r['x']+r['width'])//2048)+1):rects.setdefault((x,y),[]).append({'id':key+'-collider-'+str(i),**r})
    for y in range(0,shape[0],64):
        for x in range(0,shape[1],64):
            h,w=flags[y:y+64,x:x+64].shape;cx,cy=x//64,y//64;cid=f'{cx}-{cy}';chunk={'format':'superior-browser-1','id':cid,'x':x*32,'y':y*32,'terrain':{'cell':32,'width':w,'height':h,'flags':rle(flags[y:y+h,x:x+w]),'biome':rle(biome[y:y+h,x:x+w])},'navigation':{'cell':16,'width':w*2,'height':h*2,'blocked':rle(~nav[y*2:(y+h)*2,x*2:(x+w)*2])},'colliders':rects.get((cx,cy),[]),'objects':groups.get((cx,cy),[])};write(directory/'chunks'/f'{cid}.json',chunk);chunks.append({'id':cid,'x':x*32,'y':y*32,'width':w*32,'height':h*32,'path':f'chunks/{cid}.json'});write(artdir/'chunks'/f'{cid}.art.json',{'objects':arts.get((cx,cy),[])})
    write(directory/'world.json',plan);write(directory/'terrain.json',{'cell':32,'width':shape[1],'height':shape[0],'flags':rle(flags)});write(directory/'navigation.json',{'cell':16,'width':nav.shape[1],'height':nav.shape[0],'blocked':rle(~nav)});write(directory/'collision.json',rectangles);write(directory/'chunks.json',chunks);write(directory/'spawns.json',spawns)
    art=read(V1/'art'/key/'feature.art.json')
    for field in ['buildings','acceptedCityBuildings','acceptedCityScenery','resources']:art[field]=[move(o,delta)for o in art.get(field,[])]
    gate=copy.deepcopy(art['dungeonEntrances'][0]);art['dungeonEntrances']=[{**gate,'id':d['id'],**d['overworldEntrance']}for d in plan['dungeons']];art['chunks']=[f'{key}/chunks/{c["id"]}.art.json'for c in chunks];art['sourceWorldSha256']=sha(directory/'world.json');write(artdir/'feature.art.json',art)
    colors=np.array([[83,133,82],[44,94,65],[142,145,133],[73,125,130]],np.uint8);rgb=colors[np.minimum(biome,3)];rgb[~land]=[16,42,64];rgb[water]=[49,112,145];rgb[roads_wide]=[182,166,123];rgb[safe]=np.clip(rgb[safe].astype(int)+25,0,255);im=Image.fromarray(rgb);im.thumbnail((1600,1200));im.save(directory/'landscape.png');im.save(directory/'minimap.webp')
    # Keep the loader's SVG path while using the generated terrain minimap image.
    (directory/'minimap.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {im.width} {im.height}"><image width="{im.width}" height="{im.height}" href="minimap.webp"/></svg>')
    write(directory/'manifest.json',{'format':'superior-browser-1','files':{str(p.relative_to(directory)):sha(p)for p in sorted(directory.rglob('*.json'))}})
    report={'feature':key,'width':width,'height':height,'arrival':anchor,'affinity':old['affinity'],'name':old['name'],'worldSha256':sha(directory/'world.json'),'translation':delta,'retainedSpawns':len(read(V1/key/'spawns.json')['overworld']),'spawns':len(spawns['overworld']),'objects':len(objects),'newObjects':count,'settlements':len(plan['settlements']),'newAreaCells':int(new.sum()),'seconds':round(time.perf_counter()-started,3)}
    write(directory/'landscape-report.json',report);print(report,flush=True);return report

def main():
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--context',type=Path,required=True);p.add_argument('--features',nargs='*',default=IDS);p.add_argument('--geography',choices=['astra','ki'],default='astra');a=p.parse_args();global GEOGRAPHY;GEOGRAPHY=a.geography;a.output.mkdir(parents=True,exist_ok=True);context=read(a.context);labels=read_labels();results=[]
    for key in a.features:
        if (a.output/key).exists():raise FileExistsError('Refusing to overwrite existing generated region '+key)
        results.append(region(key,a.output,context,labels))
    if set(a.features)==set(IDS):
        features=[{k:r[k]for k in ['feature','name','affinity','width','height','arrival','worldSha256']}for r in results]
        for f in features:f['id']=f.pop('feature')
        revision=hashlib.sha256(json.dumps(features,sort_keys=True).encode()).hexdigest();write(a.output/'index.json',{'format':'superior-runtime-1','revision':revision,'geometryVersion':2,'features':features,'migration':{'fromRevision':read(V1/'index.json')['revision'],'translations':{r['feature']:r['translation']for r in results}}});write(a.output/'landscape-report.json',results)
if __name__=='__main__':main()
