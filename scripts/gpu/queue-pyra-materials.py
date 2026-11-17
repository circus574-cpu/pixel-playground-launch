#!/usr/bin/env python3
"""Submit reproducible ComfyUI texture jobs; no paid API or pod lifecycle operations."""
import argparse, json, time, urllib.request
from pathlib import Path

URL = 'http://127.0.0.1:8188'
TEXTURES = {
    'ash': 'Seamless tileable terrain albedo texture, warm charcoal volcanic ash and fine dark brown gravel, scattered tiny pale mineral grains, high quality natural material for stylized realistic anime action RPG, perfectly top down orthographic, evenly lit diffuse surface, no cast shadows, no perspective, no objects',
    'basalt': 'Seamless tileable terrain albedo texture, fractured dark basalt stone ground, layered charcoal slate and muted rust mineral veins, small worn angular stones, elegant high detail fantasy action RPG volcanic landscape material, perfectly top down orthographic, evenly lit diffuse surface, no cast shadows, no perspective, no objects',
    'paving': 'Seamless tileable terrain albedo texture, ancient dark basalt paving slabs, irregular closely fitted polygonal stones, worn warm copper edges and dark fine mortar, restrained realistic anime fantasy fortress courtyard stone floor, perfectly top down orthographic, evenly lit diffuse surface, no cast shadows, no perspective, no objects',
    'cliff': 'Seamless tileable rock surface albedo texture, jagged layered black volcanic basalt cliff, smoky grey mineral bands and weathered brown stone, beautiful detailed natural weathering, dark fantasy action RPG, front orthographic evenly lit diffuse surface, no shadows, no scenery, no objects',
}
NEGATIVE = 'text, letters, logo, watermark, border, frame, grid, blurry, low resolution, large objects, buildings, landscape, mountains, horizon, perspective, isometric, dramatic lighting, strong shadows, glowing lava, grass, plants'

def api(path, body=None):
    req = urllib.request.Request(URL+path, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=30))

def workflow(name, seed):
    return {
        '1': {'class_type':'CheckpointLoaderSimple','inputs':{'ckpt_name':'ki-sdxl-base.safetensors'}},
        '2': {'class_type':'CLIPTextEncode','inputs':{'clip':['1',1],'text':TEXTURES[name]}},
        '3': {'class_type':'CLIPTextEncode','inputs':{'clip':['1',1],'text':NEGATIVE}},
        '4': {'class_type':'EmptyLatentImage','inputs':{'width':1024,'height':1024,'batch_size':1}},
        '5': {'class_type':'KSampler','inputs':{'model':['1',0],'positive':['2',0],'negative':['3',0],'latent_image':['4',0],'seed':seed,'steps':30,'cfg':6.0,'sampler_name':'dpmpp_2m','scheduler':'karras','denoise':1.0}},
        '6': {'class_type':'VAEDecode','inputs':{'samples':['5',0],'vae':['1',2]}},
        '7': {'class_type':'SaveImage','inputs':{'images':['6',0],'filename_prefix':'KI_Pyra_Terrain3D/'+name}},
    }

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
    registry=a.out/'material-jobs.json'
    if registry.exists():
        print('Existing submissions retained; inspect registry/history instead of submitting again.');raise SystemExit(0)
    jobs={}
    registry.write_text('{}\n')
    for i,name in enumerate(TEXTURES):
        graph=workflow(name,17112026+i)
        reply=api('/prompt',{'prompt':graph,'client_id':'ki-pyra-terrain3d-20261117'})
        assert 'prompt_id' in reply,reply
        jobs[name]={'prompt_id':reply['prompt_id'],'workflow':graph,'submitted_unix':time.time()}
        registry.write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n')
        print(name,reply['prompt_id'],flush=True)
