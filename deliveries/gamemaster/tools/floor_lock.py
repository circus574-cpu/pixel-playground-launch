import os
from pathlib import Path
import numpy as np
from scipy.interpolate import PchipInterpolator

from check_motion import check
from glb_utils import add_array, array, node_indices, read, write

def contact(block, points):
    t,ground,_=np.asarray(points).T
    if block in ('walk','heavy_strike','ki_blast'):
        return .005-ground
    if block in ('hover','glide'):
        center=2.075 if block=='hover' else 2.12
        bob=.045 if block=='hover' else .028
        return center+bob*np.sin(2.*np.pi*t/t[-1])-ground
    if block in ('flight','takeoff','land'):
        authored_path=PchipInterpolator(
            [0.,.23,.66,1.28,1.94,2.63,3.4,4.18,5.02,5.42,6.02,6.48,6.967],
            [.005,.005,.21,.81,1.57,2.075,2.11,2.09,2.12,1.81,.87,.05,.005],
        )
        elapsed = t+5.02 if block=='land' else t
        return authored_path(elapsed)-ground
    raise ValueError(block)

def main():
    job=Path(os.environ["GAMEMASTER_BUILD_DIR"])
    source=job/'GameMaster-before-contact.glb'
    output=job/'KI-Legends-GameMaster.glb'
    model,blob=read(source)
    reports=check(source, exact_frames=True)
    hips=node_indices(model)['Hips']
    for clip in model['animations']:
        channel=next(channel for channel in clip['channels'] if channel['target']=={'node':hips,'path':'translation'})
        sampler=clip['samplers'][channel['sampler']]
        t=array(model,blob,sampler['input']).ravel()
        offsets=contact(clip['name'],reports[clip['name']])
        assert len(offsets)==len(t)
        positions=array(model,blob,sampler['output'])
        positions[:,1] += offsets/2.0
        sampler['output']=add_array(model,blob,positions)
    write(output,model,blob)

if __name__ == '__main__':
    main()
