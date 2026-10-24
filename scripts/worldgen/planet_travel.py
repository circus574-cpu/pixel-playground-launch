"""Travel graph between canonical continent/island features; preserves polar geometry."""
import math
from pathlib import Path
from planet_generate import read

def lonlat(planet,plan,p):
    g=plan['geometry'];f=g['planetFeature'];x=(p['x']-g['anchor']['x'])/planet['radius'];y=-(p['y']-g['anchor']['y'])/planet['radius'];rho=math.hypot(x,y);lat0=math.radians(f['lat']);lon0=math.radians(f['lon'])
    if rho<1e-12:return [f['lon'],f['lat']]
    lat=math.asin(math.cos(rho)*math.sin(lat0)+y*math.sin(rho)*math.cos(lat0)/rho)
    lon=lon0+math.atan2(x*math.sin(rho),rho*math.cos(lat0)*math.cos(rho)-y*math.sin(lat0)*math.sin(rho))
    return [((math.degrees(lon)+180)%360)-180,math.degrees(lat)]

def vector(p):
    lon,lat=map(math.radians,p);return [math.cos(lat)*math.cos(lon),math.cos(lat)*math.sin(lon),math.sin(lat)]
def arc(a,b,radius):
    u,v=vector(a),vector(b);omega=math.acos(max(-1,min(1,sum(x*y for x,y in zip(u,v)))))
    points=[]
    for i in range(65):
        t=i/64;w=[(math.sin((1-t)*omega)*x+math.sin(t*omega)*y)/math.sin(omega)for x,y in zip(u,v)]
        points.append([math.degrees(math.atan2(w[1],w[0])),math.degrees(math.asin(max(-1,min(1,w[2]))))])
    return points,omega*radius

def build_links(context,root,reports):
    planet=context['planet'];available={r['feature']for r in reports};worlds={f:read(Path(root)/f/'world.json')for f in available};links=[]
    for island,cities in planet['islandEdges'].items():
        for city in cities:
            if city not in available or island not in available:continue
            a,b=worlds[city],worlds[island];ports_a=[p for p in a['locations']if p['kind']=='port'];ports_b=[p for p in b['locations']if p['kind']=='port']
            distance,pa,pb=min((arc(lonlat(planet,a,pa),lonlat(planet,b,pb),planet['radius'])[1],pa,pb)for pa in ports_a for pb in ports_b)
            path,_=arc(lonlat(planet,a,pa),lonlat(planet,b,pb),planet['radius'])
            links.append({'id':city+'--'+island,'from':{'feature':city,'location':pa['id'],'arrival':{'x':pa['x'],'y':pa['y']}},'to':{'feature':island,'location':pb['id'],'arrival':{'x':pb['x'],'y':pb['y']}},'bidirectional':True,'mode':'ferry-transfer','surfaceDistance':round(distance,3),'greatCirclePreviewLonLat':path,'navigation':'transfer between safe port arrivals; arc is an atlas preview, not a boat collision path'})
    return {'planetRadius':planet['radius'],'links':links,'expectedLinksForFullPlanet':12,'runtimeInstalled':False}
