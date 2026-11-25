import os
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

from glb_utils import array, read, view_bytes

def project(model, blob, rect, size, forward=1):
    primitive = model['meshes'][0]['primitives'][0]
    points = array(model, blob, primitive['attributes']['POSITION'])
    uv = array(model, blob, primitive['attributes']['TEXCOORD_0'])
    index = array(model, blob, primitive['indices']).reshape((-1, 3))
    x0, x1, y0, y1 = rect
    w,h = size
    points = points.copy()
    points[:,0] = (points[:,0]*forward - x0)/(x1-x0)*(w-1)
    points[:,1] = (y1 - points[:,1])/(y1-y0)*(h-1)
    points[:,2] *= forward
    depth = np.full((h,w), -np.inf)
    mapping = np.full((h,w,2), np.nan)
    for face in index:
        pos = points[face]
        xmin,ymin = np.maximum(0, np.floor(pos[:,:2].min(0))).astype(int)
        xmax,ymax = np.minimum([w-1,h-1], np.ceil(pos[:,:2].max(0))).astype(int)
        if xmin > xmax or ymin > ymax:
            continue
        mat = (pos[1:,:2]-pos[0,:2]).T
        if abs(np.linalg.det(mat)) < 1e-9:
            continue
        yi,xi = np.mgrid[ymin:ymax+1,xmin:xmax+1]
        beta, gamma = (np.stack([xi-pos[0,0], yi-pos[0,1]],axis=-1) @ np.linalg.inv(mat).T).transpose(2,0,1)
        alpha = 1-beta-gamma
        z = alpha*pos[0,2]+beta*pos[1,2]+gamma*pos[2,2]
        selected = (alpha>=-1e-6)&(beta>=-1e-6)&(gamma>=-1e-6)&(z>depth[yi,xi])
        depth[yi[selected],xi[selected]] = z[selected]
        mapping[yi[selected],xi[selected]] = np.stack([alpha[selected],beta[selected],gamma[selected]],axis=-1) @ uv[face]
    return mapping,depth

def base_texture(model, blob):
    im = model['images'][0]
    return Image.open(BytesIO(view_bytes(model, blob, im['bufferView']))).convert('RGB')

def render(tex, mapping):
    result = np.full((*mapping.shape[:2],3), (26,31,42), dtype=np.uint8)
    found = np.isfinite(mapping[:,:,0])
    uv = mapping[found]
    ww,hh = tex.size
    xx = np.minimum(ww-1, (np.clip(uv[:,0],0,1)*ww).astype(int))
    yy = np.minimum(hh-1, (np.clip(uv[:,1],0,1)*hh).astype(int))
    result[found] = np.asarray(tex)[yy,xx]
    return Image.fromarray(result)

if __name__=='__main__':
    root = Path(os.environ["GAMEMASTER_BUILD_DIR"])
    model,blob = read(root/'rig.glb')
    tex = base_texture(model,blob)
    for axis in (1,-1):
        mapping, depth = project(model,blob,(-.23,.23,1.74,2.15),(720,640),axis)
        render(tex,mapping).save(root/f'face-{axis}.png')
        if axis == 1:
            np.save(root/'eye-mapping.npy',mapping)
            np.save(root/'eye-depth.npy',depth)
