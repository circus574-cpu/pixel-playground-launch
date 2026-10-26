"""CPU spherical coastline prototype; never imports or overwrites the v1 runtime.
Canonical geometry is a labelled lon/lat cell complex, NOT a scaled texture.
Each cell has exact spherical area R²*dLon*(sin(north)-sin(south)).
"""
from __future__ import annotations
import json, math
from functools import lru_cache
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree
from scipy import ndimage

IDS = ['verdant', 'aether', 'nexus', 'pyra'] + [f'island-{i}' for i in range(1, 7)]

def read(path): return json.loads(Path(path).read_text())
def write(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False))

def basis(feature):
    lon, lat = np.radians([feature['lon'], feature['lat']])
    c = np.array([np.cos(lat)*np.cos(lon), np.cos(lat)*np.sin(lon), np.sin(lat)])
    e = np.array([-np.sin(lon), np.cos(lon), 0.])
    return c, e, np.cross(c, e)

def forward(xy, feature):
    """AEQD radians -> unit sphere, for arbitrary array leading dimensions."""
    c,e,n = basis(feature); rho = np.linalg.norm(xy, axis=-1)
    return np.cos(rho)[...,None]*c + np.sinc(rho/np.pi)[...,None]*(xy[...,0,None]*e + xy[...,1,None]*n)

def inverse(v, feature):
    c,e,n = basis(feature); dot = np.clip(v@c, -1, 1)
    rho = np.arccos(dot); length = np.sqrt(np.maximum(0., 1-dot*dot))
    k = np.divide(rho, length, out=np.ones_like(rho), where=length>1e-12)
    return np.stack([v@e*k, v@n*k], axis=-1)

def sphere_grid(width, y0, y1):
    height = width//2
    lon = ((np.arange(width)+.5)/width*2*np.pi-np.pi)[None,:]
    lat = (np.pi/2-(np.arange(y0,y1)+.5)/height*np.pi)[:,None]
    return np.stack(np.broadcast_arrays(np.cos(lat)*np.cos(lon), np.cos(lat)*np.sin(lon), np.sin(lat)), axis=-1)

def weights(width):
    edges = np.linspace(np.pi/2,-np.pi/2,width//2+1)
    return (np.sin(edges[:-1])-np.sin(edges[1:]))[:,None]*(2*np.pi/width)

def area_percent(labels, width):
    w = weights(width)
    return [float(np.sum(np.count_nonzero(labels==i,axis=1)[:,None]*w)/(4*np.pi)*100) for i in range(11)]

def source_xy(planet, outlines, key):
    f=planet['features'][key]
    xy=(np.array(outlines[key],dtype=float)-np.array([f['source']['x'],f['source']['y']]))
    xy*=planet['unitsPerMapUnit']*planet['scale']/planet['radius'];xy[:,1]*=-1
    return xy

def dense_boundary(xy, spacing=.0005):
    parts=[]
    for a,b in zip(xy,np.roll(xy,-1,axis=0)):
        n=max(1,math.ceil(np.linalg.norm(b-a)/spacing))
        parts.append(a+(b-a)*np.arange(n)[:,None]/n)
    return np.concatenate(parts)

def analytic_area(xy, feature):
    """Independent signed spherical triangle sum on densely sampled source edges."""
    v=forward(dense_boundary(xy),feature);w=np.roll(v,-1,axis=0);c=basis(feature)[0]
    return abs(float(np.sum(2*np.arctan2(np.cross(v,w)@c,1+v@c+w@c+np.sum(v*w,axis=1)))))/(4*np.pi)*100

def inside_polygon(xy, polygon):
    # Vectorised even/odd ray crossing. Bbox culling makes this much cheaper than global rays.
    x,y=xy[...,0],xy[...,1];inside=np.zeros(x.shape,bool)
    for a,b in zip(polygon,np.roll(polygon,-1,axis=0)):
        if abs(b[1]-a[1])<1e-15: continue
        inside ^= ((a[1]>y)!=(b[1]>y)) & (x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])
    return inside

def source_fields(planet, outlines, width):
    """Signed geodesic distances to original coast; chunks bound peak RAM."""
    height=width//2; labels=np.zeros((height,width),np.uint8)
    distances=np.empty((10,height,width),np.float32)
    exact={}; overlap=0
    for i,key in enumerate(IDS):
        f=planet['features'][key]; xy=source_xy(planet,outlines,key)
        tree=cKDTree(forward(dense_boundary(xy),f)); exact[key]=analytic_area(xy,f)
        low=xy.min(axis=0);high=xy.max(axis=0)
        for y0 in range(0,height,64):
            y1=min(height,y0+64);v=sphere_grid(width,y0,y1);local=inverse(v,f)
            box=((local>=low)&(local<=high)).all(axis=-1)
            inside=np.zeros(box.shape,bool)
            inside[box]=inside_polygon(local[box],xy)
            chord=tree.query(v.reshape(-1,3),distance_upper_bound=2*math.sin(.65/2),workers=1)[0].reshape(box.shape)
            chord=np.minimum(chord,2*math.sin(.65/2))
            d=2*np.arcsin(np.clip(chord/2,0,1)); d[inside]*=-1
            distances[i,y0:y1]=d
            patch=labels[y0:y1];overlap+=int(np.count_nonzero(inside&(patch!=0)));patch[inside]=i+1
    if overlap: raise ValueError(f'Original spherical coasts overlap in {overlap} cells')
    return labels,distances,exact

@lru_cache(maxsize=1)
def coast_variation(width):
    """Deterministic spherical multi-scale coast relief, seamless at date line/poles.
    Low amplitude keeps the old land intact while avoiding rounded offset blobs.
    This is geometry, not texture noise; identical seeds and resolution reproduce it.
    """
    result=np.empty((4,width//2,width),np.float32)
    for y0 in range(0,width//2,64):
        y1=min(width//2,y0+64);v=sphere_grid(width,y0,y1)
        for i in range(4):
            a=v@np.array([1.7,.6,-.8]);b=v@np.array([-.4,1.3,1.1]);c=v@np.array([.8,-1.1,.9])
            result[i,y0:y1]=.035*np.sin(5*a+i*1.7)*np.cos(4*b-i)+.024*np.sin(17*b+i)*np.cos(13*c)+.012*np.sin(43*c+i*2)*np.cos(37*a)
    return result

def expand(labels, distances, radii, gap=.012):
    """Additive spherical coastline growth, with a maritime separation band.
    Preserve every old land cell, never shrink islands, never grow into another
    original coastline's protected band. Growth changes geography, not map scale.
    """
    costs=distances[:4]-np.array(radii)[:,None,None]-coast_variation(labels.shape[1])
    winner=np.argmin(costs,axis=0)
    first=np.take_along_axis(costs,winner[None,:,:],axis=0)[0]
    second=np.partition(costs,1,axis=0)[1]
    allowed=(first<=0)&(second-first>=gap)&(distances[4:].min(axis=0)>=gap)
    # Protect other original continents even when their own growth radius is smaller.
    for i in range(4):
        other=np.min(distances[np.array([j for j in range(4) if j!=i])],axis=0)
        allowed&=(winner!=i)|(other>=gap)
    out=np.where(allowed,winner+1,0).astype(np.uint8)
    out[labels!=0]=labels[labels!=0]
    return out

def connected(labels, index):
    """4-neighbour topology with periodic longitude; polar rows joined at the pole."""
    mask=labels==index;l,n=ndimage.label(mask)
    parent=list(range(n+1))
    def find(i):
        while parent[i]!=i: parent[i]=parent[parent[i]];i=parent[i]
        return i
    def union(a,b):
        if a and b: parent[find(int(a))]=find(int(b))
    for a,b in zip(l[:,0],l[:,-1]): union(a,b)
    for row in [l[0],l[-1]]:
        ids=np.unique(row[row>0])
        for i in ids[1:]: union(ids[0],i)
    return len({find(i) for i in range(1,n+1)})

def fit(labels, distances, target=45., gap=.012):
    before=area_percent(labels,labels.shape[1]); total=sum(before[1:5]);islands=sum(before[5:])
    goals=np.array(before[1:5])*(target-islands)/total
    radii=np.full(4,.12)
    # Coordinate bisection on each desired area, resolving all competing coastlines every pass.
    for sweep in range(14):
        for i in range(4):
            lo,hi=0.,.6
            for _ in range(14):
                radii[i]=(lo+hi)/2
                a=area_percent(expand(labels,distances,radii,gap),labels.shape[1])[i+1]
                if a<goals[i]:lo=radii[i]
                else:hi=radii[i]
        areas=np.array(area_percent(expand(labels,distances,radii,gap),labels.shape[1])[1:5])
        if np.max(np.abs(areas-goals))<.015:break
    return radii,goals

def rle(array):
    flat=array.ravel();edges=np.r_[0,np.flatnonzero(flat[1:]!=flat[:-1])+1,len(flat)]
    return [[int(flat[a]),int(b-a)] for a,b in zip(edges[:-1],edges[1:])]

def boundary_rings(mask):
    """Exact oriented edges of the canonical cell complex, split at atlas seam.
    Right turns separate diagonal cell contacts rather than crossing coastlines.
    Coordinates are grid vertices, not smoothed raster decoration.
    """
    edges={}
    def add(xs,ys,dx,dy):
        for x,y in zip(xs.tolist(),ys.tolist()):edges.setdefault((x,y),[]).append((x+dx,y+dy))
    up=np.zeros_like(mask);up[1:]=mask[:-1]
    down=np.zeros_like(mask);down[:-1]=mask[1:]
    left=np.zeros_like(mask);left[:,1:]=mask[:,:-1]
    right=np.zeros_like(mask);right[:,:-1]=mask[:,1:]
    y,x=np.nonzero(mask&~up);add(x,y,1,0)
    y,x=np.nonzero(mask&~right);add(x+1,y,0,1)
    y,x=np.nonzero(mask&~down);add(x+1,y+1,-1,0)
    y,x=np.nonzero(mask&~left);add(x,y+1,0,-1)
    rings=[];dirs={(1,0):0,(0,1):1,(-1,0):2,(0,-1):3}
    while edges:
        start=next(iter(edges));at=start;ring=[start];direction=0
        while True:
            choices=edges[at]
            def score(b):
                d=dirs[(b[0]-at[0],b[1]-at[1])];turn=(d-direction)%4
                return {1:0,0:1,3:2,2:3}[turn]
            dest=min(choices,key=score);choices.remove(dest)
            if not choices:del edges[at]
            direction=dirs[(dest[0]-at[0],dest[1]-at[1])];at=dest;ring.append(at)
            if at==start:break
        # Remove only collinear vertices; the spherical parallel/meridian geometry is unchanged.
        simple=[]
        for i,a in enumerate(ring[:-1]):
            b=ring[i-1] if i else ring[-2];c=ring[i+1]
            if (a[0]-b[0])*(c[1]-a[1])!=(a[1]-b[1])*(c[0]-a[0]):simple.append(a)
        rings.append(simple+[simple[0]])
    return rings

def rings_area(rings,width):
    total=0.
    for ring in rings:
        for a,b in zip(ring,ring[1:]):
            total+=(b[0]-a[0])*2*np.pi/width*np.sin(np.pi/2-a[1]*2*np.pi/width)
    return abs(total)/(4*np.pi)*100

def grid_vertices_sphere(points,width):
    a=np.asarray(points);lon=a[:,0]/width*2*np.pi-np.pi;lat=np.pi/2-a[:,1]/(width//2)*np.pi
    return np.stack([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)],axis=-1)
