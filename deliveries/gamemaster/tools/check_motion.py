import os
from pathlib import Path
import json
import numpy as np
from scipy.spatial.transform import Rotation

from assemble import sample
from glb_utils import array, read, tracks

def local(node, keyed):
    translation=keyed.get('translation',node.get('translation',[0,0,0]))
    rotation=keyed.get('rotation',node.get('rotation',[0,0,0,1]))
    scale=keyed.get('scale',node.get('scale',[1,1,1]))
    pose=np.eye(4)
    pose[:3,:3]=Rotation.from_quat(rotation).as_matrix()*np.asarray(scale)
    pose[:3,3]=translation
    return pose

def check(path, exact_frames=False):
    model,blob=read(path)
    data=model['meshes'][0]['primitives'][0]['attributes']
    mesh_pos=array(model,blob,data['POSITION'])
    mesh_pos=np.column_stack([mesh_pos,np.ones(len(mesh_pos))])
    joints=array(model,blob,data['JOINTS_0'])
    weights=array(model,blob,data['WEIGHTS_0'])
    skin=model['skins'][0]
    inverse_bind=array(model,blob,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    scene=model['scenes'][0]['nodes']
    min_rest=max_rest=None
    out={}
    for anim in [None,*model['animations']]:
        name=anim['name'] if anim else 'rest'
        source=list(tracks(model,blob,anim)) if anim else []
        duration=max((t[-1] for _,_,t,_ in source), default=0.)
        moments=(source[0][2] if exact_frames else np.linspace(0,float(duration),max(1,int(duration*8)+1))) if source else np.zeros(1)
        keyed={}
        for node,path,t,values in source:
            keyed.setdefault(node,{})[path]=sample(t,values,moments,path)
        results=[]
        for i,t in enumerate(moments):
            world={}
            def visit(index,parent):
                node=model['nodes'][index]
                transforms={key:val[i] for key,val in keyed.get(node.get('name'),{}).items()}
                mat=parent@local(node,transforms)
                world[index]=mat
                for child in node.get('children',[]):
                    visit(child,mat)
            for node in scene:
                visit(node,np.eye(4))
            joint=np.stack([world[n] for n in skin['joints']])@inverse_bind
            pos=np.einsum('vkij,vj,vk->vi',joint[joints],mesh_pos,weights)
            assert np.isfinite(pos).all(),name
            values=[float(t),float(pos[:,1].min()),float(pos[:,1].max())]
            results.append(values if exact_frames else [round(v,3) for v in values])
        out[name]=results
    return out

if __name__=='__main__':
    job=Path(os.environ["GAMEMASTER_BUILD_DIR"])
    out=check(job/'KI-Legends-GameMaster.glb')
    (job/'kontrola-ruchu.json').write_text(json.dumps(out,indent=2))
    for name,pts in out.items():
        minimum=min(pts,key=lambda p:p[1]); max_ground=max(pts,key=lambda p:p[1])
        print(name,'start ymin/max',pts[0][1:],'end',pts[-1][1:],'min',minimum,'highest clearance',max_ground)
