#!/usr/bin/env python3
"""Stage A + B geography prototype only. New immutable output; no runtime installation."""
from __future__ import annotations
import argparse, hashlib, math, shutil, time, resource, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage
from geometry import *
from audit import inventory, propose, sha, NAMES, world_to_sphere, lonlat
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from generate import smooth_noise, astar, compress_path

COLORS=['#102a40','#4d996a','#87bac9','#7683b4','#cc7453','#d7edf5','#d2ae72','#a6c0c0','#8eafa2','#bca5c4','#ccaf9b']
RGB=np.array([tuple(bytes.fromhex(c[1:]))for c in COLORS],dtype=np.uint8)

def atlas(labels, path, old=None):
    im=Image.fromarray(RGB[labels]);draw=ImageDraw.Draw(im);h,w=labels.shape
    for lon in range(-150,180,30):
        x=(lon+180)/360*w;draw.line((x,0,x,h),fill='#29475a',width=1)
    for lat in range(-60,90,30):
        y=(90-lat)/180*h;draw.line((0,y,w,y),fill='#29475a',width=1)
    # Coastline overlay, never used as simulation input.
    edge=(labels!=np.roll(labels,1,0))|(labels!=np.roll(labels,1,1))
    pix=np.asarray(im).copy();pix[edge& (labels!=0)]=[224,224,195]
    if old is not None:
        oldedge=(old!=0)&((old!=np.roll(old,1,0))|(old!=np.roll(old,1,1)))
        pix[oldedge]=[247,208,109]
    Image.fromarray(pix).save(path)

def local_feature(key,index,labels,rings,planet,world,output):
    points=np.concatenate([np.array(r)for r in rings]);v=grid_vertices_sphere(points,labels.shape[1])
    xy=inverse(v,planet['features'][key])*planet['radius'];xy[:,1]*=-1
    cell=128;low=np.floor(xy.min(axis=0)/cell)*cell-cell*2;high=np.ceil(xy.max(axis=0)/cell)*cell+cell*2
    width,height=np.ceil((high-low)/cell).astype(int);anchor={'x':float(-low[0]),'y':float(-low[1])}
    yy,xx=np.mgrid[:height,:width];plane=np.stack([(xx+.5)*cell+low[0],-((yy+.5)*cell+low[1])],axis=-1)/planet['radius']
    vv=forward(plane,planet['features'][key]);lon=np.arctan2(vv[...,1],vv[...,0]);lat=np.arcsin(np.clip(vv[...,2],-1,1))
    gx=np.floor((lon+np.pi)/(2*np.pi)*labels.shape[1]).astype(int)%labels.shape[1]
    gy=np.clip(np.floor((np.pi/2-lat)/np.pi*labels.shape[0]).astype(int),0,labels.shape[0]-1)
    land=labels[gy,gx]==index
    rng=np.random.default_rng(5746200+index);elevation=smooth_noise(rng,land.shape,24);humidity=smooth_noise(rng,land.shape,17)
    biomes=np.zeros(land.shape,np.uint8);biomes[humidity>.55]=1;biomes[elevation>.66]=2;biomes[(elevation<.43)&(humidity>.58)]=3;biomes[~land]=255
    nav=ndimage.binary_erosion(land,iterations=1)
    nav_labels,_=ndimage.label(nav);ax,ay=int(anchor['x']//cell),int(anchor['y']//cell);component=int(nav_labels[ay,ax]);assert component>0
    reachable=nav_labels==component
    delta={k:anchor[k]-world['geometry']['anchor'][k]for k in ['x','y']}
    def shifted(p):return {'x':p['x']+delta['x'],'y':p['y']+delta['y']}
    towns=[{**s,**shifted(s),'bounds':{**s['bounds'],**shifted(s['bounds'])}}for s in world['settlements']]
    targets=[];routes=[]
    for town in towns:targets.append({'id':town['id'],**town})
    # A few new regional exploration anchors, NOT an automatic multiplication of spawns/decoration.
    candidates=np.argwhere(reachable);old=world['geometry'];old_bounds=[delta['x'],delta['y'],delta['x']+old['width'],delta['y']+old['height']]
    for i,angle in enumerate([0,np.pi/2,np.pi,3*np.pi/2]):
        score=(candidates[:,1]-ax)*math.cos(angle)+(candidates[:,0]-ay)*math.sin(angle)
        y,x=candidates[np.argmax(score)];targets.append({'id':f'{key}-exploration-{i+1}','kind':'design-anchor','x':float((x+.5)*cell),'y':float((y+.5)*cell)})
    terrain=np.where(reachable,1+elevation*1.5,np.inf)
    route_errors=[]
    for target in targets:
        x,y=int(target['x']//cell),int(target['y']//cell)
        if not reachable[y,x]:route_errors.append(target['id']);continue
        path=astar(terrain,(ax,ay),(x,y))
        if not path:route_errors.append(target['id']);continue
        routes.append({'to':target['id'],'width':384,'points':compress_path(path,cell),'status':'coarse land-only route; city obstacle/bridge overlay pending'})
    path=output/key;path.mkdir()
    geometry={'feature':key,'projection':'azimuthal-equidistant','width':int(width*cell),'height':int(height*cell),'cellSize':cell,'anchor':anchor,'oldToNewTranslation':delta,'coastlineAuthority':'../sphere-chunks.json','status':'prototype; not compatible with runtime-1 navigation contract'}
    write(path/'geometry.json',geometry)
    write(path/'terrain.json',{'cell':cell,'width':int(width),'height':int(height),'land':rle(land),'biome':rle(biomes),'elevation':rle(np.round(elevation*255).astype(np.uint8)),'hydrology':'not regenerated; coast domains include inland waters'})
    write(path/'navigation.json',{'cell':cell,'width':int(width),'height':int(height),'blocked':rle(~reachable),'precision':'geography audit only, not 12-unit collision acceptance'})
    write(path/'content-plan.json',{'settlements':towns,'npcs':[dict(n,**shifted(n))for n in world['npcs']],
        'roads':routes,'landmarks':targets,'activeDungeons':[],'activeSpawns':[],
        'densityPolicy':{'keepSettlements':len(towns),'newSettlementCount':0,'quietExplorationFractionTarget':.6,'encounterPocketsFractionTarget':.25,'landmarkApproachesFractionTarget':.15,'countsAreBudgetsNotGeneratedContent':True},
        'v1ResourcesPreserveCandidateCount':len(world['resources']),'status':'design + coarse routes; runtime installation pending'})
    palette=np.array([[92,137,88],[47,101,67],[145,148,132],[72,128,130]],np.uint8)
    if key=='aether':palette=np.array([[130,176,190],[70,124,143],[210,227,236],[150,199,215]],np.uint8)
    if key=='nexus':palette=np.array([[82,105,130],[50,125,135],[143,143,162],[107,95,132]],np.uint8)
    if key=='pyra':palette=np.array([[151,94,67],[92,74,82],[191,91,52],[132,101,86]],np.uint8)
    pixels=palette[np.minimum(biomes,3)];pixels[~land]=RGB[0]
    im=Image.fromarray(pixels).resize((int(width*2),int(height*2)),Image.Resampling.NEAREST);draw=ImageDraw.Draw(im)
    for r in routes:draw.line([(x/cell*2,y/cell*2)for x,y in r['points']],fill='#ddcda0',width=2)
    for t in towns:
        x,y=t['x']/cell*2,t['y']/cell*2;draw.ellipse((x-5,y-5,x+5,y+5),fill='#ffe1a0',outline='#302b2b');draw.text((x+8,y-6),t['name'],fill='#ffffff')
    im.save(path/'map.png')
    return geometry,{'feature':key,'settlements':len(towns),'coarseRouteTargets':len(targets),'routeFailures':route_errors,'landComponents':int(ndimage.label(land)[1]),'coarseNavigableFraction':float(reachable.sum()/max(1,land.sum())),'size':[int(width*cell),int(height*cell)],'migrationTranslation':delta}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);parser.add_argument('--width',type=int,default=4096);parser.add_argument('--cache',type=Path)
    args=parser.parse_args();repo=Path(__file__).resolve().parents[3];output=args.output.resolve()
    if output.exists():raise FileExistsError('Use a NEW immutable directory; v1 may never be overwritten')
    if args.width<1024 or args.width%512:raise ValueError('width must be >=1024 and a multiple of 512')
    start=time.perf_counter();planet=read(repo/'src/game/world/planet.json');outlines=read(repo/'art/production/planet/atlasRegions.source.json')
    if args.cache:
        with np.load(args.cache)as cache:old=cache['before'];new=cache['after'];radii=cache['radii']
        if old.shape!=(args.width//2,args.width):raise ValueError('cache resolution mismatch')
    else:
        coarse,dist,_=source_fields(planet,outlines,1024);radii,_=fit(coarse,dist)
        old,dist,_=source_fields(planet,outlines,args.width);new=expand(old,dist,radii)
    before=area_percent(old,args.width);after=area_percent(new,args.width)
    assert abs(100-after[0]-45)<.5 and np.all(new[old>0]==old[old>0])
    assert all(connected(new,i)==1 for i in range(1,11))
    output.mkdir(parents=True)
    worlds,history=inventory(repo,planet);proposal=propose(worlds,planet)
    write(output/'historical-dungeons.json',history);write(output/'dungeon-proposal.json',proposal)
    rings={key:boundary_rings(new==i+1)for i,key in enumerate(IDS)}
    edge_area={key:rings_area(rings[key],args.width)for key in IDS}
    assert all(abs(edge_area[key]-after[i+1])<1e-7 for i,key in enumerate(IDS))
    write(output/'coastlines.json',{'projection':'equirectangular','width':args.width,'height':args.width//2,'edgeSemantics':'meridians and parallels, NOT great-circle chords','rings':rings})
    chunks=[]
    for y in range(0,args.width//2,256):
        for x in range(0,args.width,256):
            name=f'sphere/{x//256}-{y//256}.json';write(output/name,{'x':x,'y':y,'width':256,'height':256,'labels':rle(new[y:y+256,x:x+256])});chunks.append(name)
    write(output/'sphere-chunks.json',{'width':args.width,'height':args.width//2,'chunkSize':256,'labels':['ocean']+IDS,'chunks':chunks})
    # Tiny overview is presentation only; canonical cells remain in chunk JSON.
    atlas(old,output/'before.png');atlas(new,output/'after.png',old)
    write(output/'overview.json',{'width':1024,'height':512,'before':rle(old[::args.width//1024,::args.width//1024]),'after':rle(new[::args.width//1024,::args.width//1024]),'colors':COLORS})
    features=[];local_reports=[]
    for i,key in enumerate(IDS):
        g,r=local_feature(key,i+1,new,rings[key],planet,worlds[key],output);features.append(g);local_reports.append(r)
    exact={key:analytic_area(source_xy(planet,outlines,key),planet['features'][key])for key in IDS}
    source_files=['src/game/world/planet.json','art/production/planet/atlasRegions.source.json','src/components/planet-map/atlasRegions.json','public/game/worlds/superior-v1/index.json']
    report={'status':'STAGE_A_AND_B_PROTOTYPE_NOT_INSTALLED','measurement':'spherical coastline domains; inland lakes belong to land domains, not ocean. Dry-soil/hydrology budget remains Stage B/D work.',
        'landBeforePercent':100-before[0],'landAfterPercent':100-after[0],'oceanAfterPercent':after[0],'targetPercent':45,'tolerancePercentagePoints':.5,
        'method':'exact lat-band area R²Δlon(sin north − sin south); independent oriented coastline integral',
        'independentBoundaryIntegralPercent':sum(edge_area.values()),'analyticV1SourcePercent':sum(exact.values()),
        'resolution':[args.width,args.width//2],'radius':planet['radius'],'beforeByFeature':dict(zip(IDS,before[1:])),
        'afterByFeature':dict(zip(IDS,after[1:])),'growthRadiiRadians':radii.tolist(),
        'landRetentionPercent':100.,'featureConnectedComponents':{key:connected(new,i+1)for i,key in enumerate(IDS)},
        'uniqueCellOwnership':True,'maritimeCostSeparationRadians':.012,'citiesAndIslandsCentersChanged':False,
        'dungeons':{'historical':history['count'],'proposed':proposal['count'],'proposedLabyrinths':proposal['labyrinthCount'],'activeV2':0,'runtimeTransition':'pending audit and stages C/D'},
        'sourceFiles':{f:sha(repo/f)for f in source_files},'localGeometry':local_reports,
        'generationSeconds':round(time.perf_counter()-start,3),'cacheUsed':bool(args.cache),'peakRssMiB':round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,1),
        'limitations':['Not installed in Phaser; no gameplay completion claim','128-unit prototype navigation is not final 16-unit foot navigation','No new active spawns or decoration multiplication','Instanced vs physically continuous underground canon awaits owner','Need old save migration and rollback implementation before activation']}
    write(output/'audit.json',report)
    write(output/'index.json',{'format':'superior-geometry-prototype-2','status':'inactive-awaiting-independent-audit','planet':planet,'features':features,'runtimeInstalled':False,'activeDungeonIds':[],'dungeonProposal':'dungeon-proposal.json','history':'historical-dungeons.json'})
    print(json.dumps({'landPercent':report['landAfterPercent'],'dungeons':proposal['count'],'seconds':report['generationSeconds'],'routeFailures':[r for r in local_reports if r['routeFailures']]}),flush=True)

if __name__=='__main__':main()
