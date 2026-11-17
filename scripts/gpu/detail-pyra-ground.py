"""GPU granular refinement: periodic material fields plus SDXL microdetail.

Preserves the raw AI source. Height is an authored microrelief, not planet height.
"""
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import torch
from PIL import Image

ROOT = Path('/workspace/ki-iso-art2/terrain-fine-ground')
manifest = json.loads((ROOT / 'manifest.json').read_text())
assert len(manifest['items']) == 12
torch.set_num_threads(4)
N = 1024
fy = torch.fft.fftfreq(N, device='cuda')[:, None]
fx = torch.fft.fftfreq(N, device='cuda')[None, :]
frequency = fx.square() + fy.square()
palettes = {
    'fine-warm-ash': ([.18,.12,.09],[.48,.33,.21]),
    'fine-dark-ash': ([.10,.09,.09],[.34,.29,.25]),
    'fine-packed-road': ([.19,.14,.10],[.43,.32,.21]),
    'fine-valley-silt': ([.24,.21,.17],[.50,.44,.35]),
    'fine-lowland-soil': ([.13,.11,.07],[.35,.28,.16]),
    'fine-ochre-earth': ([.26,.14,.07],[.61,.38,.17]),
}


def blur(t, sigma):
    return torch.fft.ifft2(torch.fft.fft2(t) * torch.exp(-2 * math.pi**2 * sigma**2 * frequency)).real


def noise(sigma):
    x = blur(torch.randn((N,N), device='cuda'), sigma)
    return (x-x.mean()) / x.std().clamp_min(1e-6)


def save(t, path):
    data=(t.clamp(0,1).permute(1,2,0).cpu().numpy()*255).round().astype('uint8')
    return Image.fromarray(data)


for item in manifest['items']:
    torch.manual_seed(item['seed'] + 14000)
    directory = ROOT / item['id']
    raw = torch.tensor(np.asarray(Image.open(directory/'source.png').convert('RGB')).copy(),device='cuda',dtype=torch.float32).permute(2,0,1)/255
    luminance=raw[0]*.2126+raw[1]*.7152+raw[2]*.0722
    detail=luminance-blur(luminance,16)
    detail=detail/detail.std().clamp_min(.01)
    broad=noise(70)
    medium=noise(10)
    grains=noise(.6)
    fine=noise(2)
    field=(.50+broad*.045+medium*.055+fine*.065+grains*.055+detail*.018).clamp(.05,.95)
    dark=torch.tensor(palettes[item['category']][0],device='cuda')[:,None,None]
    light=torch.tensor(palettes[item['category']][1],device='cuda')[:,None,None]
    color=dark+(light-dark)*field
    # Sparse tiny aggregates remain sub-centimetre material detail, not boulders.
    grain_mask=(fine-1.6).clamp(0,1)*.035
    color=(color+grain_mask).clamp(0,1)
    image=save(color,None)
    image.save(directory/'albedo.png')
    image.save(directory/'albedo.webp',quality=94,method=6)
    image.resize((512,512),Image.Resampling.LANCZOS).save(directory/'albedo-512.webp',quality=92,method=6)
    height=(.5+fine*.035+grains*.018+medium*.02).clamp(.1,.9)
    dx=(torch.roll(height,-1,1)-torch.roll(height,1,1))*3
    dy=(torch.roll(height,-1,0)-torch.roll(height,1,0))*3
    normal=torch.stack((-dx,dy,torch.ones_like(height)))
    normal=normal/torch.linalg.vector_norm(normal,dim=0)
    save(normal*.5+.5,None).save(directory/'normal.png')
    save(height.expand(3,-1,-1),None).save(directory/'height.png')
    rough=(.90-fine*.025-grains*.018).clamp(.72,.99)
    save(rough.expand(3,-1,-1),None).save(directory/'roughness.png')
    preview=Image.new('RGB',(768,768));tile=image.resize((256,256))
    for y in range(3):
        for x in range(3):preview.paste(tile,(x*256,y*256))
    preview.save(directory/'repeat-3x3.jpg',quality=90)
    edge=((color[:,0,:]-color[:,-1,:]).abs().mean()+(color[:,:,0]-color[:,:,-1]).abs().mean())/2
    interior=((color[:,1:,:]-color[:,:-1,:]).abs().mean()+(color[:,:,1:]-color[:,:,:-1]).abs().mean())/2
    item['seams']['before_granular_refinement']=item['seams']['after']
    item['seams']['after']={'edge_mean_255':float(edge*255),'interior_mean_255':float(interior*255),'seam_ratio':float(edge/interior)}
    item['refinement']={'method':'GPU periodic FFT multiscale granular material, SDXL high-frequency detail, authored microrelief','seed':item['seed']+14000,'raw_ai_source_preserved':True,'scope':'material only; no planet geometry'}
    item['files']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in directory.iterdir()}
    print('GRAIN_DONE',item['id'],round(float(edge/interior),3),flush=True)
manifest['granular_refinement']='detail-pyra-ground.py; raw AI images retained; height now authored microrelief, not luminance reconstruction'
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('COMPLETE',len(manifest['items']),flush=True)
