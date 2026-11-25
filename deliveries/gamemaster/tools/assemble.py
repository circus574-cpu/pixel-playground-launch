import os
from io import BytesIO
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.interpolate import PchipInterpolator
from scipy.spatial.transform import Rotation, Slerp

from eye_projection import base_texture
from glb_utils import add_array, add_track, add_view, array, node_indices, read, tracks, write

JOB = Path(os.environ["GAMEMASTER_BUILD_DIR"])
SOURCE_TO_METERS = .01
HERO_SCALE = 2.0
FRAME_RATE = 30

def add_eye_emission(model, data):
    mapping = np.load(JOB/'eye-mapping.npy')
    reference = np.asarray(Image.open(JOB/'face-1.png').convert('RGB'), dtype=float)
    texture = base_texture(model, data)
    selection = Image.new('L', (mapping.shape[1], mapping.shape[0]))
    draw = ImageDraw.Draw(selection)
    draw.polygon([(287,181),(306,184),(329,194),(344,210),(321,208),(293,199)], fill=255)
    draw.polygon([(378,209),(391,192),(414,180),(433,180),(431,198),(404,209)], fill=255)
    red,green,blue = reference.transpose(2,0,1)
    mask = (np.asarray(selection) > 0) & (blue > red + 4) & (green > red + 2) & (blue > 127)
    assert mask.sum() > 500, "eye projection or color threshold changed"
    uv = mapping[mask & np.isfinite(mapping[:,:,0])]
    width,height = texture.size
    x = np.minimum(width-1,(uv[:,0]*width).astype(int))
    y = np.minimum(height-1,(uv[:,1]*height).astype(int))
    atlas_mask = np.zeros((height,width),dtype=np.uint8)
    atlas_mask[y,x] = 255
    assert (atlas_mask > 0).sum() > 60, 'insufficient UV coverage at eyes'
    mask_image=Image.fromarray(atlas_mask).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(.65))
    image = Image.new('RGB', (width,height))
    image.paste((17,144,255), (0,0,width,height), mask_image)
    buffer=BytesIO()
    image.save(buffer, format='PNG', optimize=True)
    view=add_view(model,data,buffer.getvalue())
    model['images'].append({'name':'GameMaster_EyeEmission','mimeType':'image/png','bufferView':view})
    model['textures'].append({'source':len(model['images'])-1,'name':'Eye_Emission'})
    material=model['materials'][0]
    material['emissiveTexture']={'index':len(model['textures'])-1}
    material['emissiveFactor']=[1,1,1]
    material.setdefault('extensions',{})['KHR_materials_emissive_strength']={'emissiveStrength':4.8}
    if 'KHR_materials_emissive_strength' not in model.setdefault('extensionsUsed',[]):
        model['extensionsUsed'].append('KHR_materials_emissive_strength')
    (JOB/'eye-emission.png').write_bytes(buffer.getvalue())
    return int(mask.sum())

def normalize_rig(model, data):
    joints=node_indices(model)
    armature=model['nodes'][joints['Armature']]
    assert np.allclose(armature['scale'],[SOURCE_TO_METERS]*3)
    armature.pop('scale')
    for skin in model['skins']:
        for index in skin['joints']:
            joint=model['nodes'][index]
            assert 'matrix' not in joint
            if 'translation' in joint:
                joint['translation']=(np.asarray(joint['translation'])*SOURCE_TO_METERS).tolist()
        matrices=array(model,data,skin['inverseBindMatrices']).reshape(-1,4,4)
        matrices[:,:,:3] *= SOURCE_TO_METERS
        accessor=add_array(model,data,matrices.reshape(-1,16))
        model['accessors'][accessor].pop('min')
        model['accessors'][accessor].pop('max')
        skin['inverseBindMatrices']=accessor
    main_scene=model['scenes'][model.get('scene',0)]
    root={'name':'GameMaster_Scale2x','children':main_scene['nodes'],'scale':[HERO_SCALE]*3}
    main_scene['nodes']=[len(model['nodes'])]
    model['nodes'].append(root)

def sample(values_t,values,query,path):
    if len(values_t)==1:
        return np.repeat(values[:1],len(query),axis=0)
    query=np.clip(query,values_t[0],values_t[-1])
    if path=='rotation':
        return Slerp(values_t,Rotation.from_quat(values))(query).as_quat()
    return np.stack([PchipInterpolator(values_t,v)(query) for v in values.T],axis=-1)

def guarded_animations(model, data, walk, attacks, flight):
    model['animations']=[]
    target=node_indices(model)
    specs=[
        ('walk',walk,0,0.0333333,1.0666666,1.17,'walking'),
        ('heavy_strike',attacks,0,0,None,1.0,None),
        ('ki_blast',attacks,1,0,None,1.0,None),
        ('flight',flight,0,0,None,1.0,None),
        ('takeoff',flight,0,0,2.63,1.0,None),
        ('hover',flight,0,2.64,3.41,1.0,'hover'),
        ('glide',flight,0,3.83,4.75,1.0,'glide'),
        ('land',flight,0,5.02,None,1.0,None),
    ]
    result=[]
    for name,source,source_clip,start,end,factor,loop in specs:
        asset,binary=source
        src=asset['animations'][source_clip]
        track_list=list(tracks(asset,binary,src))
        if end is None:
            end=max(float(t[-1]) for _,_,t,_ in track_list)
        duration=(end-start)*factor
        if loop in ('hover','glide'):
            duration=3.2 if loop=='hover' else 2.35
        n=int(np.ceil(duration*FRAME_RATE))+1
        timeline=np.linspace(0,duration,n)
        if loop in ('hover','glide'):
            oscillation=.5-.5*np.cos(2*np.pi*timeline/duration)
            query=start+(end-start)*oscillation
        else:
            query=np.linspace(start,end,n)
        anim={'name':name,'channels':[],'samplers':[]}
        for node,path,t,values in track_list:
            if node not in target:
                raise ValueError(f"Unknown animation target {node}")
            values=sample(t,values,query,path)
            if path=='translation':
                values *= SOURCE_TO_METERS
            if source is flight and path=='rotation':
                weight = {
                    'Hips':.94, 'Spine02':.95, 'Spine01':.94, 'Spine':.93,
                    'neck':.90, 'Head':.89,
                    'LeftShoulder':.60, 'RightShoulder':.60,
                    'LeftArm':.53, 'RightArm':.53, 'LeftForeArm':.49, 'RightForeArm':.49,
                    'LeftHand':.53, 'RightHand':.53,
                    'LeftUpLeg':.49,'RightUpLeg':.49,'LeftLeg':.43,'RightLeg':.43,
                    'LeftFoot':.55,'RightFoot':.55,'LeftToeBase':.68,'RightToeBase':.68,
                }.get(node,0.)
                if weight:
                    rest_pose=np.asarray(model['nodes'][target[node]].get('rotation',[0,0,0,1]))
                    airborne=np.clip(np.minimum(query/.65,(6.967-query)/.75),0.,1.)
                    airborne=airborne*airborne*(3.-2.*airborne)
                    emphasis=weight*(.72+.28*airborne)
                    toward_rest=rest_pose*np.where(values@rest_pose<0,-1.,1.)[:,None]
                    mixed=values+emphasis[:,None]*(toward_rest-values)
                    values=mixed/np.linalg.norm(mixed,axis=1,keepdims=True)
            if node=='Hips' and path=='translation':
                if source is flight:
                    values[:,0] = np.median(values[:,0]) + .32*(values[:,0]-np.median(values[:,0]))
                    values[:,2] = .105 + .18*(values[:,2]-.105)
                    if name=='flight':
                        glide=np.clip((timeline-2.85)/2.75,0.,1.)
                        values[:,2] += .38*glide**2*(3.-2.*glide)
                    if loop in ('hover','glide'):
                        values[:,[0,2]] = np.median(values[:,[0,2]],axis=0)
                if name=='walk':
                    values[:,-1] -= np.linspace(0,values[-1,-1]-values[0,-1],n)
            if loop:
                if path=='rotation':
                    sign=np.sign(np.sum(values[0]*values[-1]))
                    values[-1]=values[0] if sign >= 0 else -values[0]
                else:
                    values[-1]=values[0]
            if path=='rotation':
                for k in range(1,len(values)):
                    if np.dot(values[k-1],values[k])<0:
                        values[k]*=-1
            assert np.isfinite(values).all()
            add_track(model,data,anim,target[node],path,timeline,values)
        model['animations'].append(anim)
        result.append({'name':name,'duration':round(duration,3),'loop':bool(loop),'tracks':len(anim['channels'])})
    return result

def main():
    model,data=read(JOB/'rig.glb')
    eye_pixels=add_eye_emission(model,data)
    normalize_rig(model,data)
    clips=guarded_animations(model,data,read(JOB/'walk-meshy.glb'),read(JOB/'attacks-meshy.glb'),read(JOB/'flight-meshy.glb'))
    metadata={'model_height_m':4.5,'relative_scale':2.,'reference_size_m':2.25,
              'eye_emissive_strength':4.8,'projected_emission_pixels':eye_pixels,'clips':clips}
    model['extras']={'ki_legends':metadata}
    write(JOB/'GameMaster-before-contact.glb',model,data)
    (JOB/'animacje.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    print(json.dumps(metadata,indent=2))

if __name__=='__main__':
    main()
