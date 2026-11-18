#!/usr/bin/env python3
"""Create three distinct navigable terrain studies for the existing isometric renderer."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, label, zoom


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
        crossing = np.abs(z - 38) < 10
        forbidden = (bank < 16) & ~crossing
        height = np.where(crossing & (bank < 27), 13, height)
        routes = [[spawn, [1, 38], [132, 38], [224, -30]], [spawn, [-99, 110], [-224, 255]], [spawn, [-115, -55], [-210, -175]]]
        places = [('Most Zielonej Przystani', [132, 38]), ('Łąka przy starym lesie', [-224, 255]), ('Leśny grzbiet', [-210, -175])]
        title = 'Verdantia'
    elif continent == 'aetheria':
        ridge = np.exp(-((x + 238 + 42 * np.sin(z / 135)) / 116)**2)
        heights = 77 * ridge + 24 * np.exp(-((z + 250) / 115)**2)
        height = 23 + .65 * noise + heights
        basin = ((x - 280) / 91)**2 + ((z + 97) / 134)**2
        height -= 28 * np.exp(-basin * 2)
        forbidden = basin < .29
        routes = [[spawn, [-95, 35], [-160, -15], [-208, -137]], [spawn, [110, 80], [216, 93]], [spawn, [-32, -107], [50, -236]]]
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
        routes = [[spawn, [89, 67], [252, 67], [311, 85]], [spawn, [-86, -27], [-126, -207]], [spawn, [-54, 161], [-113, 249]]]
        places = [('Przeprawa serwisowa', [252, 67]), ('Stare złącze magistrali', [-126, -207]), ('Skraj zwałowiska', [-113, 249])]
        title = 'Nexus-9'

    # A compact city plateau, distinct routes beyond it and gentle grades beside paths.
    city_radii = [117, 105]
    city_height = {'verdantia': 15, 'aetheria': 26, 'nexus': 19}[continent]
    city_norm = np.hypot((x + 45) / city_radii[0], (z - 35) / city_radii[1])
    plateau = np.clip((1.36 - city_norm) / .43, 0, 1)
    if continent == 'verdantia':
        plateau *= 1 - np.clip((28 - bank) / 16, 0, 1)
    height = height * (1 - plateau) + city_height * plateau
    road_dist = np.full_like(height, 2500)
    for path in routes:
        for a, b in zip(path, path[1:]):
            dx, dz = np.subtract(b, a)
            along = np.clip(((x - a[0]) * dx + (z - a[1]) * dz) / (dx*dx + dz*dz), 0, 1)
            road_dist = np.minimum(road_dist, np.hypot(x - a[0] - along*dx, z - a[1] - along*dz))
    route_blend = np.clip((15 - road_dist) / 9, 0, 1) * (1 - plateau)
    height = gaussian_filter(height * (1 - route_blend) + gaussian_filter(height, 4) * route_blend, .55).astype('<f4')
    if continent == 'aetheria':
        # A graded trail climbs to the terraces, crossing the sharp slope diagonally.
        terrace_route = routes[0]
        length = sum(np.linalg.norm(np.subtract(b,a)) for a,b in zip(terrace_route,terrace_route[1:]))
        end_x, end_z = terrace_route[-1]
        end_height = height[(end_z+512)//2,(end_x+512)//2]
        distance = np.full_like(height, 2500)
        trail_height = np.full_like(height, city_height)
        traversed = 0.0
        for a,b in zip(terrace_route,terrace_route[1:]):
            dx,dz = np.subtract(b,a)
            segment = np.hypot(dx,dz)
            along = np.clip(((x-a[0])*dx+(z-a[1])*dz)/(segment*segment),0,1)
            offset = np.hypot(x-a[0]-along*dx,z-a[1]-along*dz)
            trail_height = np.where(offset<distance, city_height+(end_height-city_height)*(traversed+along*segment)/length,trail_height)
            distance = np.minimum(distance,offset)
            traversed += segment
        blend = np.clip((25-distance)/17,0,1)
        height = (height*(1-blend)+trail_height*blend).astype('<f4')
    grade = np.hypot(*np.gradient(height, 2))
    walk = (grade < .70) & ~forbidden
    for route in routes:
        for a,b in zip(route,route[1:]):
            samples = np.linspace(a,b,1+int(np.linalg.norm(np.subtract(b,a))))
            ix,iz = ((samples+512)//2).astype(int).T
            assert walk[iz,ix].all(), f'{continent}: blocked route {a} → {b}'
    material = np.where(grade > .42, 1, 0)
    material[height > np.quantile(height, .92)] = 3
    plaza = ((x - spawn[0])/27)**2 + ((z - spawn[1])/21)**2 < 1
    material[((road_dist < 6) | plaza) & ~forbidden] = 2
    def cell(point):
        return tuple(int((v + 512) / 2) for v in point[::-1])
    components, _ = label(walk)
    main_component = components[cell(spawn)]
    assert main_component > 0 and all(components[cell(p)] == main_component for _, p in places), continent
    weights = np.stack([gaussian_filter((material == i).astype(np.float32), 1) for i in range(4)], axis=-1)
    Image.fromarray((weights * 255).round().astype(np.uint8)).save(folder/'weights.png')
    Image.fromarray(forbidden.astype(np.uint8) * 255).save(folder/'hazards.png')
    height.tofile(folder/'height.r32')
    (material.astype('<u4') << 27).tofile(folder/'control.r32')
    walk.astype(np.uint8).tofile(folder/'walkable.u8')
    config = {'continent': title, 'seed': seed, 'spawn': spawn, 'paths': routes,
              'city_center': [-45, 35], 'city_radii': city_radii, 'city_height': city_height,
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
