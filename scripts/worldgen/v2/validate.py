#!/usr/bin/env python3
"""Independent artifact checks and dry-run migrations. Exits nonzero on any failure."""
import argparse, hashlib, json, math
from pathlib import Path
import numpy as np
from geometry import read, write, IDS, connected, rings_area, inverse, grid_vertices_sphere
from audit import world_to_sphere, sha
from migration_preview import decode, preview

def validate(root, repo):
    manifest=read(root/'sphere-chunks.json');w=manifest['width'];h=manifest['height'];labels=np.zeros((h,w),np.uint8);coverage=np.zeros((h,w),np.uint8)
    for name in manifest['chunks']:
        c=read(root/name);x,y=c['x'],c['y'];a=decode(c['labels'],c['width'],c['height']);labels[y:y+c['height'],x:x+c['width']]=a;coverage[y:y+c['height'],x:x+c['width']]+=1
    assert (coverage==1).all(), 'Every spherical cell must have exactly one chunk owner'
    assert labels.min()==0 and labels.max()==10
    # Independent exact area calculation from explicit row boundaries, not geometry.weights().
    north=90-np.arange(h)*180/h;south=north-180/h
    strip=2*np.pi*(np.sin(np.deg2rad(north))-np.sin(np.deg2rad(south)))
    land=float(np.sum(strip*np.mean(labels>0,axis=1))/(4*np.pi)*100)
    assert abs(land-45)<=.5
    coasts=read(root/'coastlines.json');edge_area=sum(rings_area(coasts['rings'][key],w)for key in IDS)
    assert abs(land-edge_area)<1e-7
    assert all(connected(labels,i)==1 for i in range(1,11))
    adjacent=0
    for dx,dy in [(1,0),(0,1),(1,1),(-1,1)]:
        a=labels[:-dy]if dy else labels;b=np.roll(labels,-dx,axis=1)[dy:]if dy else np.roll(labels,-dx,axis=1)
        adjacent+=int(np.count_nonzero((a>0)&(b>0)&(a!=b)))
    assert adjacent==0,'Different lands must have ocean separation including diagonals and atlas seam'
    assert len(set(labels[0].tolist())-{0})<=1 and len(set(labels[-1].tolist())-{0})<=1
    report=read(root/'audit.json');planet=read(repo/'src/game/world/planet.json');index=read(root/'index.json')
    assert index['format']=='superior-geometry-prototype-2' and index['runtimeInstalled']is False and index['activeDungeonIds']==[]
    for file,expected in report['sourceFiles'].items():assert sha(repo/file)==expected,file
    history=read(root/'historical-dungeons.json');proposal=read(root/'dungeon-proposal.json')
    assert len(history['items'])==152 and history['interiorSpawnReferences']==2220 and history['danglingReferences']==[]
    assert len(proposal['entries'])<=20 and sum(x['labyrinth']for x in proposal['entries'])<=5
    ids={x['id']for x in proposal['entries']};oldids={x['id']for x in history['items']};assert not ids&oldids
    graph={key:set()for key in IDS[:4]}
    for link in proposal['links']:
        assert link['dungeon']in ids and link['bidirectional'];graph[link['from']].add(link['to']);graph[link['to']].add(link['from'])
    reached={'verdant'}
    while True:
        more=reached|set().union(*(graph[k]for k in reached))
        if more==reached:break
        reached=more
    assert reached==set(IDS[:4])
    checks=[];retained=0;water_percent=0.;migration_cases=[]
    oldrev=read(repo/'public/game/worlds/superior-v1/index.json')['revision'];newrev=hashlib.sha256((root/'coastlines.json').read_bytes()).hexdigest()
    for i,key in enumerate(IDS):
        world=read(repo/f'public/game/worlds/superior-v1/{key}/world.json');g=read(root/key/'geometry.json');nav=read(root/key/'navigation.json');content=read(root/key/'content-plan.json')
        assert content['activeDungeons']==[] and content['activeSpawns']==[]
        assert len(content['settlements'])==len(world['settlements']) and len(content['npcs'])==len(world['npcs'])
        # Stable spherical positions, no scaling of city buildings/NPC/doors.
        points=world['settlements']+world['npcs']+world['doors']
        for point in points:
            vec=world_to_sphere(point,world,planet);lon=np.arctan2(vec[1],vec[0]);lat=np.arcsin(vec[2]);x=int((lon+np.pi)/(2*np.pi)*w)%w;y=min(h-1,max(0,int((np.pi/2-lat)/np.pi*h)))
            assert labels[y,x]==i+1,(key,point.get('id'),'city/NPC/door lost from land')
            expected=np.array([point['x']+g['oldToNewTranslation']['x'],point['y']+g['oldToNewTranslation']['y']])
            actual=inverse(vec,planet['features'][key])*planet['radius'];actual[1]*=-1;actual+=[g['anchor']['x'],g['anchor']['y']]
            assert np.max(np.abs(expected-actual))<1e-5;retained+=1
        t=read(repo/f'public/game/worlds/superior-v1/{key}/terrain.json');flags=decode(t['flags'],t['width'],t['height']);yy,xx=np.nonzero(((flags&16)>0)&((flags&1)==0));radius=np.hypot((xx+.5)*32-world['geometry']['anchor']['x'],(yy+.5)*32-world['geometry']['anchor']['y'])/planet['radius'];water_percent+=float(np.sum(np.sinc(radius/np.pi))*32**2/(4*np.pi*planet['radius']**2)*100)
        for entry in [p for d in proposal['entries']for p in d['entrances']if p['feature']==key]:
            lon,lat=entry['planet']['lon'],entry['planet']['lat'];x=int((lon+180)/360*w)%w;y=min(h-1,int((90-lat)/180*h));assert labels[y,x]==i+1
        for interior in [None]+(['depot']if key in IDS[:4]else[]):
            p={'race':world['affinity'],'level':17,'xp':432,'gold':1234,'hp':75,'ki':21,'skills':['R','A1'],'items':{'potion':3,'sword':1},'weapon':'sword','quests':{'boars':'done'},'depot':{'items':{'vest':1}},'interior':interior,'x':400 if interior else world['geometry']['anchor']['x'],'y':300 if interior else world['geometry']['anchor']['y']}
            value={'format':'superior-character','version':1,'geometry':oldrev,'revision':'fixture-cas-revision','feature':key,'town':world['settlements'][0]['id'],'player':p,'spawns':{'legacy-spawn':{'hp':23,'deadUntil':0,'kind':'boar'}}};raw=json.dumps(value,ensure_ascii=False)
            result=preview(raw,oldrev,newrev,g,nav);candidate=result['candidate'];assert result['originalBytes']==raw
            for field in p:
                if field not in ['x','y']:assert candidate['player'][field]==p[field],field
            assert candidate['spawns']==value['spawns']and candidate['revision']==value['revision']
            if interior:assert result['before']==result['after']
            migration_cases.append({'feature':key,'interior':interior,'before':result['before'],'after':result['after'],'fallback':result['coarseFallbackRequired'],'characterFieldsPreserved':True,'originalBytesUnchanged':True})
        checks.append({'feature':key,'components':connected(labels,i+1),'cities':len(world['settlements']),'npc':len(world['npcs']),'doors':len(world['doors'])})
    # Seeded uniform-sphere Monte Carlo check, independent of pixel and boundary sums.
    rng=np.random.default_rng(574624);lon=rng.uniform(-np.pi,np.pi,1000000);z=rng.uniform(-1,1,1000000);lat=np.arcsin(z)
    xx=((lon+np.pi)/(2*np.pi)*w).astype(int)%w;yy=np.clip(((np.pi/2-lat)/np.pi*h).astype(int),0,h-1)
    mc=float(np.mean(labels[yy,xx]>0)*100);assert abs(mc-land)<.25
    assert abs((land-water_percent)-45)<.5,'Preserved inland water must not hide a dry-land target failure'
    result={'passed':True,'scope':'geometry prototype, not gameplay acceptance','landDomainPercent':land,'oceanPercent':100-land,'coastlineIntegralPercent':edge_area,'uniformSphereMonteCarloPercent':mc,'monteCarloSamples':1000000,'preservedV1InlandWaterEstimatePercent':water_percent,'dryLandWithPreservedInlandWaterEstimatePercent':land-water_percent,'inlandWaterMethod':'32-unit source tiles with AEQD sin(rho)/rho Jacobian at tile centres; excludes bridge surface','differentFeatureAdjacentPairs':adjacent,'stableCityNpcDoorPositionsChecked':retained,'features':checks,'dungeonGraphConnected':True,'historicalDungeonCount':152,'proposedDungeonCount':len(ids),'proposedLabyrinthCount':sum(x['labyrinth']for x in proposal['entries']),'v1SourceHashesUnchanged':True}
    migration={'status':'geometry-only dry-run; no storage writes','sourceGeometry':oldrev,'candidateGeometry':newrev,'cases':migration_cases,'rollback':'originalBytes retained verbatim; runtime rollback not implemented','remaining':['validate full PlayerSchema/character envelope before migration','retain original snapshot in backup key; CAS current bytes before commit','map/retire spawn IDs without losing progression before v2 activation','16-unit navigation and exact collision safe point; 128-unit fallback here is provisional','preserve building interior coordinates and source town','handle unknown/newer/corrupt saves by refusal; never reset','verify base PlayerSchema 65536 vs Superior extended 131072 (new Verdantia/Aetheria exceed 65536)','future dungeon save stores instanceId, entryPortalId and return anchor; v1 has no playable dungeon instances']}
    write(root/'migration-report.json',migration);write(root/'validation.json',result)
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('output',type=Path);a=p.parse_args();r=validate(a.output,Path(__file__).resolve().parents[3]);print(json.dumps(r,ensure_ascii=False))
