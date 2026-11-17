#!/usr/bin/env python3
"""GPU detail variations guided by the existing fine Pyra material, not rock illustrations."""
import hashlib
import json
import runpy
import time
from pathlib import Path

import torch
from PIL import Image, ImageEnhance, ImageDraw
from diffusers import StableDiffusionXLImg2ImgPipeline, DPMSolverMultistepScheduler

ROOT = Path('/workspace/ki-iso-art2')
OUT = ROOT / 'terrain-fine-ground'
OUT.mkdir(exist_ok=True)
functions = runpy.run_path(str(ROOT / 'generate-pyra-terrain.py'))
source = Path('/opt/ki-iso-art2/repo/ports/godot-isometric-pyra/materials/ash.webp')
# Validate the source before the expensive model load; LFS pointers are not images.
guide = Image.open(source).convert('RGB').resize((1024, 1024), Image.Resampling.LANCZOS)
guide = ImageEnhance.Color(guide).enhance(1.3)
guide.save(OUT / 'source-guide.png')
torch.set_num_threads(4)
pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained('/workspace/ki-premium/model', torch_dtype=torch.float16, variant='fp16', local_files_only=True, use_safetensors=True)
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, algorithm_type='sde-dpmsolver++', use_karras_sigmas=True)
pipe.to('cuda')
pipe.enable_vae_slicing()
for module in pipe.unet.modules():
    if isinstance(module, torch.nn.Conv2d) and module.padding != (0, 0):
        module.padding_mode = 'circular'
variants = {
    'fine-warm-ash': 'warm russet volcanic ash powder, tiny ochre mineral grains, subtle natural fine soil detail',
    'fine-dark-ash': 'fine dark charcoal volcanic ash powder, restrained warm grey mineral grains, subtle detail',
    'fine-packed-road': 'compacted fine reddish ash dirt road surface, smooth worn packed grit, subtle irregular erosion',
    'fine-valley-silt': 'fine warm grey volcanic silt, subtle natural sediment ripples, tiny fine sand grains',
    'fine-lowland-soil': 'rich muted brown volcanic loam soil, tiny fine natural mineral grains, soft soil detail',
    'fine-ochre-earth': 'warm ochre volcanic earth, very fine natural soil grain, delicate weathered mineral variation',
}
negative = 'rocks, stones, pebbles, boulders, objects, buildings, trees, grass, grid, tiles, horizon, shadows, text, vignette'
report = {'model': 'Lykon/dreamshaper-xl-v2-turbo', 'revision': 'f70ad5bce436c640d23fc02cd0a6ccc787280b6e', 'source': str(source), 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'steps': 24, 'guidance': 3.0, 'strength': .40, 'status': 'fine material candidates; visual acceptance pending', 'items': []}
for index, (name, detail) in enumerate(variants.items()):
    prompt = f'Top down seamless flat material texture, {detail}, even neutral diffuse lighting, edge to edge natural surface, fine scale, no objects.'
    for variant in range(2):
        identifier = f'{name}-{variant + 1}'
        directory = OUT / identifier
        directory.mkdir(exist_ok=True)
        seed = 1711202900 + index * 10 + variant
        start = time.monotonic()
        image = pipe(prompt=prompt, negative_prompt=negative, image=guide, num_inference_steps=24, strength=.40, guidance_scale=3.0, generator=torch.Generator('cuda').manual_seed(seed)).images[0].convert('RGB')
        image.save(directory / 'source.png')
        tensor, metrics = functions['periodicize'](image)
        albedo = functions['pil'](tensor)
        albedo.save(directory / 'albedo.png')
        albedo.save(directory / 'albedo.webp', quality=94, method=6)
        albedo.resize((512, 512), Image.Resampling.LANCZOS).save(directory / 'albedo-512.webp', quality=92, method=6)
        for role, data in functions['derived_maps'](tensor).items():
            functions['pil'](data).save(directory / f'{role}.png')
        tile = albedo.resize((256, 256))
        preview = Image.new('RGB', (768, 768))
        for y in range(3):
            for x in range(3):
                preview.paste(tile, (x * 256, y * 256))
        preview.save(directory / 'repeat-3x3.jpg', quality=90)
        report['items'].append({'id': identifier, 'category': name, 'seed': seed, 'prompt': prompt, 'negative': negative, 'seconds': round(time.monotonic() - start, 3), 'seams': metrics, 'files': {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in directory.iterdir()}})
        (OUT / 'manifest.json').write_text(json.dumps(report, indent=2)+'\n')
        print('FINE_DONE', identifier, flush=True)
print('COMPLETE', len(report['items']), flush=True)
