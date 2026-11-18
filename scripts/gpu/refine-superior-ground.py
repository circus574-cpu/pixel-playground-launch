#!/usr/bin/env python3
"""Create subdued periodic ground from the high frequency detail of the SDXL wave."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
import torch


STUDIES = {
    'verdantia': ([.17,.20,.11],[.48,.49,.24]),
    'aetheria': ([.42,.53,.61],[.82,.89,.91]),
    'nexus': ([.14,.15,.18],[.37,.38,.41]),
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('wave', type=Path)
    wave = parser.parse_args().wave
    manifest = wave/'manifest.json'
    doc = json.loads(manifest.read_text())
    n = 1024
    f = torch.fft.fftfreq(n,device='cuda')
    radial = f[:,None].square()+f[None,:].square()

    def blur(tile,sigma):
        return torch.fft.ifft2(torch.fft.fft2(tile)*torch.exp(-2 * np.pi**2 * sigma**2 * radial)).real

    def noise(sigma,generator):
        values = blur(torch.randn((n,n),device='cuda',generator=generator),sigma)
        return values/values.std().clamp_min(1e-6)

    for i,(name,(shadow,light)) in enumerate(STUDIES.items()):
        original = wave/f'{name}-ground-1'/'albedo.png'
        pixels = torch.tensor(np.asarray(Image.open(original)).copy(),device='cuda',dtype=torch.float32)/255
        luminance = pixels.mean(dim=2)
        detail = (luminance-blur(luminance,2)).clamp(-.11,.11)
        seed = 1811209900+i
        rng = torch.Generator('cuda').manual_seed(seed)
        amount = (.5 + .06*noise(69,rng)+.065*noise(11,rng)+.04*noise(2,rng)+.035*noise(.5,rng)+.14*detail).clamp(.1,.9)
        colors = [torch.tensor(value,device='cuda') for value in (shadow,light)]
        palette = colors[0]+amount[:,:,None]*(colors[1]-colors[0])
        out = wave/f'{name}-ground-fine'
        out.mkdir(exist_ok=True)
        image = Image.fromarray((palette.clamp(0,1)*255).round().byte().cpu().numpy())
        image.save(out/'albedo.png')
        image.resize((512,512),Image.Resampling.LANCZOS).save(out/'albedo-512.webp',quality=92)
        record = {'id':out.name,'seed':seed,'method':'GPU periodic granular ground with SDXL high-frequency detail',
                  'source':original.parent.name,
                  'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in out.iterdir()}}
        doc['items']=[item for item in doc['items'] if item['id']!=out.name]+[record]
        print('REFINED',out.name,flush=True)
    refined = wave/'refinement-manifest.json'
    refined.write_text(json.dumps({'items':[i for i in doc['items'] if i['id'].endswith('-fine')]},indent=2)+'\n')


if __name__=='__main__':
    main()
