"""Read-only inventory, proposed dungeon network and coordinate migration analysis."""
from __future__ import annotations
import hashlib, json, math, tarfile
from collections import Counter
from pathlib import Path
import numpy as np
from scipy import ndimage
from geometry import IDS, read, write, forward, inverse

NAMES = {'verdant':'Verdantia','aether':'Aetheria','nexus':'Nexus-9','pyra':'Pyra'}

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def world_to_sphere(point, world, planet):
    g=world['geometry'];xy=np.array([point['x']-g['anchor']['x'],g['anchor']['y']-point['y']])/planet['radius']
    return forward(xy,planet['features'][world['feature']])

def lonlat(v): return {'lon':float(np.degrees(np.arctan2(v[1],v[0]))),'lat':float(np.degrees(np.arcsin(np.clip(v[2],-1,1))))}

def inventory(repo, planet):
    root=repo/'public/game/worlds/superior-v1';items=[];dangling=[];worlds={}
    for key in IDS:
        path=root/key/'world.json';w=read(path);worlds[key]=w;spawns=read(root/key/'spawns.json');art=read(root/'art'/key/'feature.art.json')
        known={d['id'] for d in w['dungeons']}
        for spawn in spawns['interiors']:
            if spawn['dungeon'] not in known: dangling.append(spawn['id'])
        for entry in art['dungeonEntrances']:
            if entry['id'] not in known:dangling.append(entry['id'])
        for d in w['dungeons']:
            floor=np.array([[v=='1' for v in row]for row in d['floor']]);clearance=ndimage.distance_transform_edt(floor)*d['cellSize']*2
            items.append({'id':d['id'],'feature':key,'declaredKind':d['kind'],
                'sourceFile':str(path.relative_to(repo)),'sourceFileSha256':sha(path),
                'originalAlgorithm':'planet_generate.maze for all three declared kinds',
                'size':[d['width'],d['height']],'cellSize':d['cellSize'],
                'floorArea':int(floor.sum())*d['cellSize']**2,
                'floorWithClearanceBelow192Percent':round(float(np.mean(clearance[floor]<192)*100),2),
                'overworldEntranceV1':d['overworldEntrance'],
                'planetEntrance':lonlat(world_to_sphere(d['overworldEntrance'],w,planet)),
                'interiorSpawnReferences':sum(s['dungeon']==d['id'] for s in spawns['interiors']),
                'artEntranceReferences':sum(s['id']==d['id']for s in art['dungeonEntrances']),
                'locationReferences':sum(s['id']==d['id']for s in w['locations']),
                'disposition':'historical in v2; keep original v1 bytes and archive',
                'reuse':['entrance provenance','biome affinity','art bindings','loot/monster catalogue references'] + (['puzzle motif; widen/rebuild geometry'] if d['kind']=='maze' else ['chamber motif from later archive, not original narrow grid'])})
    # The later archive already diversified caves/ruins. Do not falsely call all archived floors mazes.
    archive=repo/'deliveries/cpu-game-content-20261023/cpu-game-content.tar.gz'
    with tarfile.open(archive)as t:
        floors=[m.name for m in t if m.isfile()and m.name.startswith('content/dungeons/')and '-floor-'in m.name and m.name.endswith('.json')]
        kinds=Counter()
        for name in floors:
            d=json.load(t.extractfile(name));kinds[d['kind']]+=1
    campaign=repo/'docs/design/adventure-20261023/campaign-data.json';text=campaign.read_text()
    quest_refs=[x['id']for x in items if x['id']in text]
    return worlds,{'format':'superior-dungeon-history-1','sourceRevision':read(root/'index.json')['revision'],
        'count':len(items),'declaredKinds':dict(Counter(d['declaredKind']for d in items)),
        'interiorSpawnReferences':sum(d['interiorSpawnReferences']for d in items),'danglingReferences':dangling,
        'campaignSource':str(campaign.relative_to(repo)),'campaignSha256':sha(campaign),'literalDungeonIdReferencesInCampaign':quest_refs,
        'campaignCaveat':'No literal ID does not prove narrative quests independent of geography; semantic review remains required.',
        'laterArchive':{'path':str(archive.relative_to(repo)),'sha256':sha(archive),'floors':len(floors),'kinds':dict(kinds),
            'note':'expand_dungeons uses cellular caverns / room grids / mazes. Archive is not the active Phaser dungeon runtime.'},'items':items}

def propose(worlds, planet):
    entries=[];used=set()
    def entrance(key,kind,toward=None):
        candidates=[d for d in worlds[key]['dungeons']if d['id']not in used and d['kind']==kind]
        if not candidates:candidates=[d for d in worlds[key]['dungeons']if d['id']not in used]
        if toward:
            other=world_to_sphere(worlds[toward]['geometry']['anchor'],worlds[toward],planet)
            candidates.sort(key=lambda d:-float(world_to_sphere(d['overworldEntrance'],worlds[key],planet)@other))
        else:candidates.sort(key=lambda d:d['id'])
        d=candidates[0];used.add(d['id'])
        return {'feature':key,'reuseCandidate':d['id'],'v1':d['overworldEntrance'],
                'planet':lonlat(world_to_sphere(d['overworldEntrance'],worlds[key],planet)),
                'status':'approximate existing reachable entrance; new terrain clearance pending Stage D'}
    links=[('verdant','aether','groty i tarasy kryształowe'),('aether','nexus','ruiny sanktuarium i kompleks technologiczny'),('nexus','pyra','kopalnie i komory geotermalne'),('pyra','verdant','bazaltowe pieczary z podziemnym jeziorem')]
    for i,(a,b,theme)in enumerate(links):
        entries.append({'id':f'v2-transit-{i+1}','type':'transit','labyrinth':False,'theme':theme,
            'entrances':[entrance(a,'cave',b),entrance(b,'cave',a)],'sizeProposal':[5400+i*640,3600+i*384],
            'passageWidthMin':384,'arenaDiameterMin':1152,'openSpaceTargetPercent':65,
            'alternateRoutesMin':2,'transportModel':'pending Architect decision: linked instances recommended',
            'access':{'default':'proposed open access; no unapproved quest gate','futureConditionId':None,
                'blockedMessage':'Przejście niedostępne: {approvedConditionDescription}'}})
    themes={'verdant':('grota korzeni i podziemne jezioro','ruiny w lesie'),
        'aether':('świątynia pod lodowcem','sanktuarium KI'),
        'nexus':('opuszczone podziemne miasto','kompleks obwodów'),
        'pyra':('komory wulkaniczne i arena','bazaltowe ruiny')}
    for i,key in enumerate(IDS[:4]):
        for maze in [False,True]:
            entries.append({'id':f'v2-{key}-'+('labyrinth'if maze else 'chambers'),
                'type':'labyrinth'if maze else 'open-complex','labyrinth':maze,'theme':themes[key][int(maze)],
                'entrances':[entrance(key,'maze'if maze else'ruins')],
                'sizeProposal':[3072+i*512 if maze else 6144+i*512,2560+i*384 if maze else 4096+i*384],
                'passageWidthMin':256 if maze else 384,'arenaDiameterMin':768 if maze else 1280,
                'openSpaceTargetPercent':40 if maze else 70,'alternateRoutesMin':2})
    island_themes=['lodowa pieczara','zatopione ruiny','kryształowe komory','podziemny ogród','kopalnia skalna','obsydianowa arena']
    for i,key in enumerate(IDS[4:]):
        entries.append({'id':f'v2-{key}-chambers','type':'open-complex','labyrinth':False,'theme':island_themes[i],
            'entrances':[entrance(key,'cave')],'sizeProposal':[3584+i*256,2560+(i%3)*512],
            'passageWidthMin':320,'arenaDiameterMin':1024,'openSpaceTargetPercent':65,'alternateRoutesMin':2})
    for e in entries:e['status']='design proposal, not playable or canonical name'
    return {'format':'superior-dungeon-proposal-2','status':'awaiting audit; inactive','count':len(entries),
        'labyrinthCount':sum(x['labyrinth']for x in entries),'maximumCount':20,'maximumLabyrinths':5,
        'links':[{'dungeon':f'v2-transit-{i+1}','from':a,'to':b,'bidirectional':True}for i,(a,b,_)in enumerate(links)],
        'portals':{'identity':['characterId','instanceId','entryPortalId','returnFeature','returnPosition','geometryVersion'],
            'rules':['return portal restores entry side','far exit uses destination feature and safe navigation anchor',
                'validate target before committing travel','same character/inventory/quest state','no storage write until migration/CAS validation']},'entries':entries}
