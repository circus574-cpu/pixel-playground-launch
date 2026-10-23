#!/usr/bin/env python3
"""Schedules, walkable resident routes and supply simulation, separate from hostile spawns."""
import argparse,concurrent.futures,json,math,time
from pathlib import Path
import numpy as np
from scipy import ndimage
from generate import astar,compress_path,digest,canonical
from planet_generate import read,write,cell_of
from convert_browser import unrle
DAY_MS=480000

def length(route):return sum(math.hypot(b['x']-a['x'],b['y']-a['y'])for a,b in zip(route,route[1:]))
def path_between(a,b,nav,anchors,cost):
    aa=anchors[a['id']]['navigationPoint'];bb=anchors[b['id']]['navigationPoint'];route=astar(cost,cell_of(aa,16),cell_of(bb,16));points=[a]+[{'x':x,'y':y}for x,y in compress_path(route,16)]+[b]
    return [{'x':p['x'],'y':p['y']}for i,p in enumerate(points)if not i or p['x']!=points[i-1]['x']or p['y']!=points[i-1]['y']]

def generate(root,output,feature):
    directory=Path(root)/feature;plan=read(directory/'world.json');n=read(directory/'navigation.json');nav=~unrle(n['blocked'],(n['height'],n['width'])).astype(bool);t=read(directory/'terrain.json');flags=unrle(t['flags'],(t['height'],t['width']));safe=np.repeat(np.repeat((flags&2)>0,2,axis=0),2,axis=1);road=np.repeat(np.repeat((flags&4)>0,2,axis=0),2,axis=1)
    anchors={a['id']:a for a in read(directory/'navigation-anchors.json')};doors={p['id']:p for p in plan['doors']};residents=[];routines=[];settlements=[];routes={};route_cache={};skipped=[]
    areas=[{**s,'population':24 if plan['kind']=='continent'else 12}for s in plan['settlements']]
    for p in plan['locations']:
        if p['kind']in ['village','port','camp']:areas.append({**p,'name':p['id'],'bounds':{'x':p['x']-384,'y':p['y']-384,'width':768,'height':768},'population':6})
    for area in areas:
        if area['id'].endswith('-capital'):
            venues=[doors['accepted-'+service]for service in ['inn','smithy','shop','hall']]
        elif area.get('services'):
            choices={b['service']:doors[b['id']]for b in plan['buildings']if b['settlement']==area['id']and b['service']!='residence'}
            venues=[choices[s]for s in ['inn','smithy','shop','hall']]
        else:
            venues=[doors[b['id']]for b in plan['buildings']if b['settlement']==area['id']]
            if not venues:skipped.append({'area':area['id'],'reason':'no authored residence entrance'});continue
            venues=(venues*4)[:4]
        bounds=area['bounds'];yy,xx=np.ogrid[:nav.shape[0],:nav.shape[1]];inside=((xx+.5)*16>=bounds['x'])&((xx+.5)*16<=bounds['x']+bounds['width'])&((yy+.5)*16>=bounds['y'])&((yy+.5)*16<=bounds['y']+bounds['height']);cost=np.where(nav&safe&inside,np.where(road,1.,3.),np.inf)
        area_routes=[]
        for a,b in zip(venues,[*venues[1:],venues[0]]):
            key=(a['id'],b['id'])
            if key not in route_cache:
                route=path_between(a,b,nav,anchors,cost);rid=feature+'-routine-route-'+str(len(routes));routes[rid]={'id':rid,'area':area['id'],'points':route,'length':round(length(route),3),'safeOnly':True};route_cache[key]=rid
            area_routes.append(route_cache[key])
        population=area['population'];settlements.append({'id':area['id'],'name':area['name'],'residents':population,'essentialServices':'always available; original staff not controlled by these ambient routines'})
        for i in range(population):
            rid=area['id']+'-resident-'+str(i);role=['artisan','market-assistant','guard','farmer','courier','scholar'][i%6];segments=[];at=0;home={'x':venues[0]['x'],'y':venues[0]['y']};durations=[routes[r]['length']/80*1000 for r in area_routes];scale=max(1,sum(durations)/(DAY_MS*.45));durations=[max(1000,d/scale)for d in durations]
            def stop(activity,duration,position,indoors):
                nonlocal at
                duration=int(duration);segments.append({'fromMs':at,'toMs':at+duration,'activity':activity,'position':position,'indoors':indoors});at+=duration
            stop('sleep',DAY_MS*.2,home,True)
            for j,route_id in enumerate(area_routes):
                duration=int(durations[j]);segments.append({'fromMs':at,'toMs':at+duration,'activity':'walk','route':route_id,'indoors':False});at+=duration
                if j<3:stop(['work','trade','social'][j],DAY_MS*[.15,.05,.1][j],{'x':venues[(j+1)%4]['x'],'y':venues[(j+1)%4]['y']},j!=2 or role!='guard')
            if at>=DAY_MS:raise ValueError('Schedule exceeds day: '+rid)
            stop('sleep',DAY_MS-at,home,True)
            for a,b in zip(segments,segments[1:]):
                if a['toMs']!=b['fromMs']:raise ValueError('Schedule gap')
                end=routes[a['route']]['points'][-1]if 'route'in a else a['position'];begin=routes[b['route']]['points'][0]if 'route'in b else b['position']
                if math.hypot(end['x']-begin['x'],end['y']-begin['y'])>.01:raise ValueError('Routine teleports between venues')
            residents.append({'id':rid,'name':'Mieszkaniec '+str(i+1),'settlement':area['id'],'role':role,'homeEntrance':venues[0]['id'],'homeKind':'boarding at inn'if area.get('services')else 'residence','routine':rid,'artBinding':'npc.'+plan['affinity']+'.'+role,'collision':'nonblocking resident; never MonsterSystem','speed':round(80*scale,3)})
            routines.append({'id':rid,'dayMs':DAY_MS,'phaseOffsetMs':(i%6)*8000,'segments':segments})
    # Independent caravan delivery proposals between the four main settlements / island harbour.
    caravans=[];whole_cost=np.where(nav,np.where(road,1.,3.),np.inf)
    for target in plan['settlements'][1:]:
        source=plan['settlements'][0];a=next(p for p in plan['locations']if p['id']==source['id']);b=next(p for p in plan['locations']if p['id']==target['id']);route=path_between(a,b,nav,anchors,whole_cost)
        caravans.append({'id':feature+'-caravan-'+str(len(caravans)),'from':source['id'],'to':target['id'],'points':route,'length':round(length(route),3),'speed':100,'dayMs':DAY_MS,'cargo':{'wood':5,'ore':3,'herb':3},'combat':False,'bidirectional':True,'minimumReserve':12,'targetStock':24,'binding':'npc.'+plan['affinity']+'.caravan','activation':'near player only; position derived from world clock'})
    rng=np.random.default_rng(plan['seed']+99);stocks={s['id']:{g:30 for g in ['wood','ore','herb']}for s in settlements};shortages=0;deliveries=0;history=[]
    for day in range(30):
        for stock in stocks.values():
            for good in stock:
                production=int(rng.integers(1,5));stock[good]=min(100,stock[good]+production);consume=min(2,stock[good]);shortages+=consume<2;stock[good]-=consume
        for caravan in caravans:
            for good,wanted in caravan['cargo'].items():
                a=stocks[caravan['from']];b=stocks[caravan['to']]
                if a[good]<b[good]:a,b=b,a
                quantity=max(0,min(wanted,a[good]-12,24-b[good]));a[good]-=quantity;b[good]+=quantity;deliveries+=quantity
        if any(v<0 or v>100 for s in stocks.values()for v in s.values()):raise ValueError('Negative or overflowing supply')
        history.append({'day':day+1,'stock':sum(sum(s.values())for s in stocks.values())})
    out=Path(output)/feature
    if out.exists():raise FileExistsError(str(out))
    out.mkdir(parents=True);write(out/'residents.json',residents);write(out/'routines.json',routines);write(out/'routes.json',list(routes.values()));write(out/'caravans.json',caravans);write(out/'settlements.json',settlements);write(out/'supply-simulation.json',{'days':30,'stock':stocks,'deliveredUnits':deliveries,'shortageEvents':int(shortages),'history':history,'assumptions':'Ambient wood/ore/herb stock model; does not alter player prices, recipes or essential services.','playerEconomyChanged':False})
    result={'feature':feature,'passed':True,'residents':len(residents),'routines':len(routines),'routes':len(routes),'caravans':len(caravans),'settlements':len(settlements),'scheduleSegments':sum(len(r['segments'])for r in routines),'supplyDays':30,'supplyShortages':int(shortages),'skipped':skipped,'runtimeInstalled':False};write(out/'quality.json',result);write(out/'manifest.json',{'files':{p.name:digest(p.read_bytes())for p in out.iterdir()if p.is_file()}});return result

def main():
 p=argparse.ArgumentParser();p.add_argument('--world',required=True);p.add_argument('--output',required=True);p.add_argument('--workers',type=int,default=8);a=p.parse_args();features=[f['feature']for f in read(Path(a.world)/'conversion-report.json')['features']];started=time.perf_counter()
 if not 1<=a.workers<=8:p.error('workers 1..8')
 with concurrent.futures.ProcessPoolExecutor(max_workers=a.workers)as pool:
  results=list(pool.map(generate,[a.world]*len(features),[a.output]*len(features),features))
 write(Path(a.output)/'life-report.json',{'features':results,'dayMs':DAY_MS,'seconds':round(time.perf_counter()-started,3),'runtimeInstalled':False,'essentialServicesAlwaysAvailable':True});print(json.dumps({'passed':True,'residents':sum(r['residents']for r in results),'caravans':sum(r['caravans']for r in results),'seconds':round(time.perf_counter()-started,3)}))
if __name__=='__main__':main()
