#!/usr/bin/env python3
"""Create three distinct navigable terrain studies for the existing isometric renderer."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, label, zoom


PARCEL_SIZES = [(28,22),(20,16),(18,15),(21,20),(22,18),(20,16)]

# (x, z, foundation height) in hall, inn, shop, arena, smithy, depot order.
PARCELS = {
    'verdantia': [(-110,-35,24),(155,85,15),(-9,76,15),(196,9,20),(-125,119,17),(72,-66,15)],
    'aetheria': [(-140,-10,54),(24,107,26),(14,33,26),(-90,-102,41),(-104,107,39),(-34,-95,40)],
    'nexus': [(-128,-34,32),(-83,108,19),(39,24,22),(78,108,14),(-125,120,18),(101,-27,24)],
}


def road_segment(x, z, a, b):
    dx, dz = np.subtract(b, a)
    fraction = np.clip(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1)
    distance = np.hypot(x-a[0]-fraction*dx,z-a[1]-fraction*dz)
    return distance, fraction


def make(root, continent, seed):
    folder = root / continent
    folder.mkdir(parents=True, exist_ok=True)
    z, x = np.mgrid[-512:512:2, -512:512:2].astype(np.float32)
    rng = np.random.default_rng(seed)
    noise = sum(zoom(rng.normal(size=(n, n)), 512 / n, order=3)[:512, :512] * a
                for n, a in [(9, 3.0), (23, 1.0), (65, .25)])
    spawn = [-40, 50]
    if continent == 'verdantia':
        river = 48 + 59 * np.sin(z / 94)
        bank = np.abs(x - river)
        height = 15 + noise + 48 * np.exp(-((x + 330) / 105)**2)
        height -= 13 * np.exp(-(bank / 30)**4)
        crossing = (np.abs(z - 38) < 10) | (np.abs(z + 53) < 10)
        forbidden = (bank < 16) & ~crossing
        height = np.where(crossing & (bank < 27), 13, height)
        routes = [[spawn, [1, 38], [132, 38], [221, 39], [224, -30]], [spawn, [-84, 130], [-123, 153], [-224, 255]], [spawn, [-83, -62], [-98, -74], [-210, -175]]]
        places = [('Most Zielonej Przystani', [132, 38]), ('Łąka przy starym lesie', [-224, 255]), ('Leśny grzbiet', [-210, -175])]
        title = 'Verdantia'
    elif continent == 'aetheria':
        ridge = np.exp(-((x + 238 + 42 * np.sin(z / 135)) / 116)**2)
        heights = 77 * ridge + 24 * np.exp(-((z + 250) / 115)**2)
        height = 23 + .65 * noise + heights
        basin = ((x - 280) / 91)**2 + ((z + 97) / 134)**2
        height -= 28 * np.exp(-basin * 2)
        forbidden = basin < .29
        routes = [[spawn, [110, 80], [216, 93]], [spawn, [-12, -102], [50, -236]]]
        places = [('Białe Tarasy', [-208, -137]), ('Brzeg lodowca', [216, 93]), ('Przełęcz źródeł', [50, -236])]
        title = 'Aetheria'
    else:
        corridor = 170 + 10 * np.sin(z / 90)
        trench = np.abs(x - corridor)
        height = 19 + .55 * noise + 42 * np.exp(-((z - 322) / 77)**2)
        height -= 23 * np.exp(-(trench / 22)**4)
        bridge = np.abs(z - 67) < 12
        height = np.where(bridge & (trench < 30), 18, height)
        forbidden = (trench < 12) & ~bridge
        routes = [[spawn, [89, 67], [252, 67], [311, 85]], [spawn, [-54, 161], [-113, 249]]]
        places = [('Przeprawa serwisowa', [252, 67]), ('Stare złącze magistrali', [-126, -207]), ('Skraj zwałowiska', [-113, 249])]
        title = 'Nexus-9'

    parcels = PARCELS[continent]
    city_radii = {'verdantia': [196,135], 'aetheria': [125,127], 'nexus': [143,122]}[continent]
    city_centers = {'verdantia': [32,30], 'aetheria': [-47,21], 'nexus': [-22,39]}
    city_height = {'verdantia': 15, 'aetheria': 26, 'nexus': 19}[continent]
    if continent == 'verdantia':
        # Two riverfront lanes share two crossings. The western hall sits on a bluff.
        height += 11*np.exp(-((x+110)/68)**2-((z+35)/75)**2)
        city_roads = [
            [[-40,50,15],[-35,-10,17],[-10,-53,15],[100,-53,15],[132,-20,16],[132,38,13],[0,38,14],[-40,50,15]],
            [[-35,-10,17],[-79,-27,23],[-94,-22,24]],
            [[-40,50,15],[-49,98,16],[-108,119,17]],
            [[132,38,13],[140,63,15],[140,85,15]],
            [[132,-20,16],[166,-2,19],[179,9,20]],
            [[100,-53,15],[83,-49,15]],
            [[-40,50,15],[-11,59,15]],
        ]
        plazas = [(-43,53,22,13),(139,52,20,11)]
    elif continent == 'aetheria':
        # Distinct shelf elevations. Long diagonal climbs connect the three terraces.
        for cx, cz, level, rx, rz in [(4,61,26,65,72),(-61,-73,40,58,58),(-136,16,54,45,58)]:
            shelf = np.clip((1.45-np.maximum(abs(x-cx)/rx,abs(z-cz)/rz))/.6,0,1)
            height = height*(1-shelf)+level*shelf
        city_roads = [
            [[-40,50,26],[-60,18,30],[-58,-28,35],[-54,-62,40],[-54,-105,41],[-73,-102,41]],
            [[-58,-28,35],[-93,-42,43],[-125,-42,50],[-121,-24,54],[-121,-10,54]],
            [[-125,-42,50],[-144,-82,57],[-177,-112,65],[-208,-137,76]],
            [[-40,50,26],[-5,50,26],[1,33,26],[1,107,26],[11,107,26]],
            [[-40,50,26],[-49,108,32],[-75,109,36],[-86,107,39]],
            [[-54,-62,40],[-37,-77,40]],
        ]
        plazas = [(0,55,27,17),(-117,-28,15,17)]
    else:
        # Rectilinear industrial blocks are on two elevations with a sloped service lane.
        for cx,cz,level,rx,rz in [(-105,-27,32,51,34),(52,63,21,75,75),(72,128,14,47,29)]:
            pad = np.clip((1.44-np.maximum(abs(x-cx)/rx,abs(z-cz)/rz))/.59,0,1)
            height = height*(1-pad)+level*pad
        city_roads = [
            [[-40,50,19],[-40,-6,24],[-40,-39,28],[-106,-39,32],[-112,-34,32]],
            [[-40,-39,28],[-49,-93,23],[-83,-148,21],[-126,-207,19]],
            [[-40,50,19],[-40,80,19],[61,80,20],[61,-10,23],[92,-10,24]],
            [[-40,80,19],[-106,80,19],[-106,115,18],[-99,120,18]],
            [[-106,80,19],[-95,97,19]],
            [[61,80,20],[61,110,14]],
            [[-40,80,19],[-13,96,20]],
            [[61,39,22],[51,24,22]],
        ]
        plazas = [(-28,67,27,13),(57,75,15,22)]

    heights_at = lambda point: float(height[(point[1]+512)//2,(point[0]+512)//2])
    # Local foundations follow the neighbourhood elevation and avoid a map-wide pad.
    for px,pz,level in parcels:
        footprint = np.hypot((x-px)/19,(z-pz)/16)
        foundation = np.clip((1.9-footprint)/.9,0,1)
        foundation *= ~forbidden
        height = height*(1-foundation)+level*foundation

    road_dist = np.full_like(height, 2500)
    road_height = height.copy()
    for route in city_roads:
        for a,b in zip(route,route[1:]):
            d,t = road_segment(x,z,a[:2],b[:2])
            road_height = np.where(d < road_dist,a[2]+(b[2]-a[2])*t,road_height)
            road_dist = np.minimum(d,road_dist)
    outside_dist = np.full_like(height,2500)
    outside_height = height.copy()
    for route in routes:
        lengths = [np.linalg.norm(np.subtract(b,a)) for a,b in zip(route,route[1:])]
        before = 0.0
        end_height = heights_at(route[-1])
        start_height = city_height
        for a,b,length in zip(route,route[1:],lengths):
            d,t = road_segment(x,z,a,b)
            target = start_height+(end_height-start_height)*(before+t*length)/sum(lengths)
            outside_height = np.where(d<outside_dist,target,outside_height)
            outside_dist = np.minimum(d,outside_dist)
            before += length
    # Local lanes take precedence where exterior paths meet the city.
    exterior_blend = np.clip((24-outside_dist)/16,0,1)
    height = height*(1-exterior_blend)+outside_height*exterior_blend
    lane_blend = np.clip((22-road_dist)/14,0,1)
    height = gaussian_filter(height*(1-lane_blend)+road_height*lane_blend,.55).astype('<f4')
    road_dist = np.minimum(road_dist,outside_dist)
    grade = np.hypot(*np.gradient(height, 2))
    walk = (grade < .70) & ~forbidden
    city_paths = routes + [[p[:2] for p in road] for road in city_roads]
    walk_with_parcels = walk.copy()
    parcel_masks = []
    for (px,pz,_), (width,depth) in zip(parcels,PARCEL_SIZES,strict=True):
        footprint = (abs(x-px)<width/2+.8)&(abs(z-pz)<depth/2+.8)
        walk_with_parcels &= ~footprint
        parcel_masks.append((abs(x-px)<width/2+6)&(abs(z-pz)<depth/2+6)&~footprint)
    for route in city_paths:
        for a,b in zip(route,route[1:]):
            samples = np.linspace(a,b,1+int(np.linalg.norm(np.subtract(b,a))))
            ix,iz = ((samples+512)//2).astype(int).T
            assert walk_with_parcels[iz,ix].all(), f'{continent}: blocked route {a} → {b}'
    material = np.where(grade > .42, 1, 0)
    material[height > np.quantile(height, .92)] = 3
    plaza = np.logical_or.reduce([((x-cx)/rx)**2 + ((z-cz)/rz)**2 < 1 for cx,cz,rx,rz in plazas])
    material[((road_dist < 6) | plaza) & ~forbidden] = 2
    def cell(point):
        return tuple(int((v + 512) / 2) for v in point[::-1])
    components, _ = label(walk_with_parcels)
    main_component = components[cell(spawn)]
    assert main_component > 0 and all(components[cell(p)] == main_component for _, p in places), continent
    assert all(np.any((components==main_component)&edge) for edge in parcel_masks), 'Unreachable building parcel'
    weights = np.stack([gaussian_filter((material == i).astype(np.float32), 1) for i in range(4)], axis=-1)
    Image.fromarray((weights * 255).round().astype(np.uint8)).save(folder/'weights.png')
    Image.fromarray(forbidden.astype(np.uint8) * 255).save(folder/'hazards.png')
    height.tofile(folder/'height.r32')
    (material.astype('<u4') << 27).tofile(folder/'control.r32')
    walk.astype(np.uint8).tofile(folder/'walkable.u8')
    config = {'continent': title, 'seed': seed, 'spawn': spawn, 'paths': city_paths, 'parcel_sizes': PARCEL_SIZES,
              'parcels': [point[:2] for point in parcels], 'city_center': city_centers[continent], 'city_radii': city_radii, 'city_height': city_height,
              'landmarks': [{'name': name, 'xz': point} for name, point in places],
              'walkable_percent': round(float(walk.mean()) * 100, 2),
              'files': {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                        for p in sorted(folder.iterdir()) if p.name != 'terrain.json'}}
    (folder/'terrain.json').write_text(json.dumps(config, ensure_ascii=False, indent=2)+'\n')
    print(title, len(places), 'landmarks reachable', config['walkable_percent'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True, type=Path)
    options = parser.parse_args()
    for index, continent in enumerate(('verdantia', 'aetheria', 'nexus')):
        make(options.out, continent, 18112026 + index)
