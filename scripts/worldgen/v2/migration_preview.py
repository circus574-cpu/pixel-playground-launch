"""Pure dry-run coordinate migration. No storage API; cannot write a player's save."""
from __future__ import annotations
import copy, json, math
import numpy as np

def decode(runs,width,height):
    values=np.concatenate([np.full(n,v,np.uint8)for v,n in runs])
    if len(values)!=width*height:raise ValueError('Invalid grid coverage')
    return values.reshape(height,width)

def preview(raw, old_revision, new_revision, geometry, navigation):
    value=json.loads(raw)
    if value.get('format')!='superior-character' or value.get('version')!=1 or value.get('geometry')!=old_revision:
        raise ValueError('Unknown save/geometry: retain original, refuse migration')
    if value.get('feature')!=geometry['feature']:raise ValueError('Feature mismatch')
    result=copy.deepcopy(value);p=result['player'];before={k:p[k]for k in ['x','y']}
    if not all(isinstance(v,(int,float)) and math.isfinite(v)for v in before.values()):raise ValueError('Invalid position')
    fallback=False
    if not p.get('interior'):
        p['x']+=geometry['oldToNewTranslation']['x'];p['y']+=geometry['oldToNewTranslation']['y']
        blocked=decode(navigation['blocked'],navigation['width'],navigation['height']);cell=navigation['cell']
        x,y=math.floor(p['x']/cell),math.floor(p['y']/cell)
        if x<0 or y<0 or x>=blocked.shape[1] or y>=blocked.shape[0] or blocked[y,x]:
            yy,xx=np.nonzero(blocked==0)
            if not len(xx):raise ValueError('No safe destination; retain original')
            i=np.argmin(((xx+.5)*cell-p['x'])**2+((yy+.5)*cell-p['y'])**2)
            p['x']=float((xx[i]+.5)*cell);p['y']=float((yy[i]+.5)*cell);fallback=True
    result['geometry']=new_revision
    return {'candidate':result,'originalBytes':raw,'before':before,'after':{k:p[k]for k in ['x','y']},
        'coarseFallbackRequired':fallback,'status':'dry-run only; final collision validation and CAS required before commit'}
