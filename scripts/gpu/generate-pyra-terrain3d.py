#!/usr/bin/env python3
"""Deterministic CPU terrain for an isolated Terrain3D Pyra study; no production world edits."""
import argparse, hashlib, json
from pathlib import Path
import numpy as np
from scipy.ndimage import zoom, gaussian_filter, label
from PIL import Image


def generate(out: Path, seed: int = 17112026):
    out.mkdir(parents=True, exist_ok=True)
    n, spacing = 512, 2.0
    rng = np.random.default_rng(seed)
    z, x = np.mgrid[:n, :n].astype(np.float32)
    x, z = (x - n / 2) * spacing, (z - n / 2) * spacing
    noise = np.zeros((n, n), np.float32)
    for cells, weight in [(5, 1), (11, .45), (25, .18), (65, .065)]:
        grid = rng.random((cells, cells)).astype(np.float32) * 2 - 1
        expanded = zoom(grid, n / cells, order=3)[:n, :n]
        noise += expanded * weight
    h = 24 + noise * 22
    h += 74 * np.exp(-((x + 345) / 100) ** 2) * (.68 + .32 * np.cos(z / 100))
    volcanic_r = np.hypot(x - 245, z + 215)
    h += 135 * np.exp(-(volcanic_r / 100) ** 2) - 75 * np.exp(-(volcanic_r / 28) ** 2)
    canyon_axis = 165 + 26 * np.sin(z / 85)
    canyon_distance = abs(x - canyon_axis)
    canyon = np.exp(-(canyon_distance / 17) ** 4) * (1 - np.exp(-((z - 45) / 90) ** 2))
    h = h * (1 - canyon) + (-8 + 2 * np.sin(z / 40)) * canyon
    plaza_d = np.sqrt((x / 115) ** 2 + ((z - 35) / 100) ** 2)
    plaza = np.clip((1.45 - plaza_d) / .35, 0, 1)
    h = h * (1 - plaza) + 12 * plaza
    paths = [
        [[-40, 50], [-55, -100], [-160, -195], [-235, -285]],
        [[-40, 50], [80, 60], [145, 85]],
        [[-40, 50], [-90, 165], [-185, 245]],
    ]
    paths += [
        [[-40, 50], [-40, 5], [-20, -40]],
        [[-40, 50], [15, 10], [60, -25]],
        [[-40, 50], [20, 50], [65, 55]],
        [[-40, 50], [-65, 80], [-80, 125]],
        [[-40, 50], [15, 85], [45, 115]],
        [[-40, 50], [-55, 20], [-75, -5]],
    ]
    road_distance = np.full_like(h, 1e6)
    for path in paths:
        for a, b in zip(path, path[1:]):
            a, b = np.array(a), np.array(b)
            d = b - a
            t = np.clip(((x - a[0]) * d[0] + (z - a[1]) * d[1]) / np.dot(d, d), 0, 1)
            distance = np.hypot(x - (a[0] + t * d[0]), z - (a[1] + t * d[1]))
            road_distance = np.minimum(road_distance, distance)
    # Smooth a broad envelope, retaining elevation along the route rather than cutting arbitrary stairs.
    route_h = gaussian_filter(h, 10)
    blend = np.clip((13 - road_distance) / 7, 0, 1) * (1 - plaza)
    h = h * (1 - blend) + route_h * blend
    h = gaussian_filter(h, .55).astype('<f4')
    dz, dx = np.gradient(h, spacing)
    slope = np.rad2deg(np.arctan(np.hypot(dx, dz)))
    lava = (canyon > .75) & (h < 2)
    texture_id = np.where(slope > 27, 1, 0).astype(np.uint32)
    market = ((x+40)/32)**2+((z-50)/26)**2 < 1
    texture_id[(road_distance < 5) | market] = 2
    texture_id[h > 80] = 3
    weights=np.stack([gaussian_filter((texture_id==i).astype(np.float32),1.0) for i in range(4)],axis=-1)
    weights/=np.maximum(weights.sum(axis=-1,keepdims=True),1e-6)
    Image.fromarray(np.clip(weights*255,0,255).astype(np.uint8),'RGBA').save(out/'weights.png')
    surface=np.zeros((n,n,3),np.uint8)
    surface[...,0]=lava.astype(np.uint8)*255
    Image.fromarray(surface,'RGB').save(out/'surface.png')
    control = (texture_id << 27).astype('<u4')
    # Terrain3D control maps store uint bitfields in float32 pixels; these bytes are not numeric floats.
    h.tofile(out / 'height.r32')
    control.tofile(out / 'control.r32')
    walkable = (slope < 35) & ~lava
    walkable.astype(np.uint8).tofile(out / "walkable.u8")
    components, count = label(walkable)
    def at(point):
        return tuple(int(np.clip(v / spacing + n / 2, 0, n - 1)) for v in point[::-1])
    spawn = [-40, 50]
    landmarks = [
        {'id': 'plaza', 'name': 'Dziedziniec Popiołu', 'xz': spawn},
        {'id': 'overlook', 'name': 'Szlak zachodniej grani', 'xz': [-235, -285]},
        {'id': 'lava-edge', 'name': 'Krawędź rozpadliny', 'xz': [145, 85]},
        {'id': 'ruins', 'name': 'Ruiny przy starym trakcie', 'xz': [-185, 245]},
    ]
    origin_component = int(components[at(spawn)])
    reachable = []
    for place in landmarks:
        rz, rx = at(place['xz'])
        place['height'] = float(h[rz, rx])
        place['reachable'] = bool(origin_component and components[rz, rx] == origin_component)
        reachable.append(place['reachable'])
    assert all(reachable), 'A named destination is not reachable from spawn'
    assert np.isfinite(h).all()
    assert float(slope[at(spawn)]) < 2
    metadata = {
        'prototype': True, 'canonical_world_changed': False, 'seed': seed,
        'samples': n, 'spacing_m': spacing, 'size_m': n * spacing, 'origin': [-512, 0, -512],
        'height_range': [float(h.min()), float(h.max())], 'spawn': spawn,
        'landmarks': landmarks, 'paths': paths,
        'walkable_percent': round(float(walkable.mean() * 100), 2),
        'texture_assets': ['ash', 'basalt', 'paving', 'cliff'],
        'checks': {'finite_height': True, 'spawn_slope_below_2_degrees': True,
                   'all_four_landmarks_connected': True, 'navigation_is_grid_analysis_not_runtime_proof': True},
        'files': {name: hashlib.sha256((out / name).read_bytes()).hexdigest() for name in ['height.r32', 'control.r32', 'walkable.u8', 'weights.png', 'surface.png']},
    }
    (out / 'terrain.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(metadata, ensure_ascii=False))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--seed', type=int, default=17112026)
    args = parser.parse_args()
    generate(args.out, args.seed)
