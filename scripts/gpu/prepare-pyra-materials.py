#!/usr/bin/env python3
"""Preserve ComfyUI originals; periodic-plus-smooth seam correction and compact runtime exports."""
import hashlib, json, shutil, urllib.request, zipfile
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path('/workspace/ki-terrain3d')

def periodic(a):
    # Moisan periodic-plus-smooth decomposition: remove the broad edge discontinuity, retain detail.
    h,w,_=a.shape
    boundary=np.zeros_like(a)
    boundary[0]=a[-1]-a[0];boundary[-1]=a[0]-a[-1]
    boundary[:,0]+=a[:,-1]-a[:,0];boundary[:,-1]+=a[:,0]-a[:,-1]
    ky=np.arange(h)[:,None];kx=np.arange(w)[None,:]
    denom=2*np.cos(2*np.pi*ky/h)+2*np.cos(2*np.pi*kx/w)-4
    denom[0,0]=1
    spectrum=np.fft.fft2(boundary,axes=(0,1))/denom[...,None]
    spectrum[0,0]=0
    smooth=np.fft.ifft2(spectrum,axes=(0,1)).real
    return np.clip(a-smooth,0,255).astype(np.uint8)

def main():
    jobs=json.loads((ROOT/'qa/material-jobs.json').read_text())
    accepted={'ash':'ash_r2','basalt':'basalt','paving':'paving','cliff':'cliff'}
    proof={};sources=[]
    out=ROOT/'project/materials';out.mkdir(exist_ok=True)
    for name,key in accepted.items():
        job=jobs[key]
        hist=json.load(urllib.request.urlopen('http://127.0.0.1:8188/history/'+job['prompt_id']))[job['prompt_id']]
        assert hist['status']['status_str']=='success',key
        im=hist['outputs']['7']['images'][0]
        source=Path('/workspace/runpod-slim/ComfyUI/output')/im['subfolder']/im['filename']
        raw=np.asarray(Image.open(source).convert('RGB'),np.float32)
        corrected=periodic(raw)
        dest=out/(name+'.webp');Image.fromarray(corrected).save(dest,quality=95,method=6)
        def mismatch(a):return float((np.abs(a[0].astype(float)-a[-1])+np.abs(a[:,0].astype(float)-a[:,-1])).mean())
        proof[name]={'source':str(source),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'runtime':dest.name,'runtime_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'prompt_id':job['prompt_id'],'processing':'periodic-plus-smooth, WebP quality 95; albedo only, not measured physical PBR','edge_error_before':mismatch(raw),'edge_error_after':mismatch(corrected),'workflow':job['workflow'],'execution':hist['status']}
        sources.append(source)
    # Retain rejected first ash too, so visual decisions and spent work are traceable.
    sources.append(Path('/workspace/runpod-slim/ComfyUI/output/KI_Pyra_Terrain3D/ash_00001_.png'))
    with zipfile.ZipFile(ROOT/'qa/comfy-material-sources.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for source in sources:archive.write(source,source.name)
        archive.write(ROOT/'qa/material-jobs.json','material-jobs.json')
    (ROOT/'qa/materials-provenance.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:{x:v[x] for x in ['edge_error_before','edge_error_after']} for k,v in proof.items()}))

if __name__=='__main__':main()
