"""Validate exact RGBA renders and copy byte-identical frames to the Phaser packer layout."""
import argparse, hashlib, json, shutil
from pathlib import Path
from PIL import Image

p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('output',type=Path);args=p.parse_args()
if args.output.exists():raise SystemExit('Choose a new immutable output directory')
directions=['down','down-left','left','up-left','up','up-right','right','down-right']
states={'idle':8,'walk':8,'attack':8,'skill':8,'hit':4,'death':8,'respawn':8}
frames=[]
for state,count in states.items():
 for direction in directions:
  clip=[]
  for i in range(count):
   source=args.source/f'{state}-{direction}-{i:02}.png';meta=json.loads(source.with_suffix('.json').read_text())
   sha=hashlib.sha256(source.read_bytes()).hexdigest()
   if sha!=meta['sha256']:raise ValueError(f'Checksum mismatch: {source}')
   with Image.open(source) as image:
    if image.mode!='RGBA' or image.size!=(512,512):raise ValueError(f'Expected 8-bit RGBA 512: {source}')
    bounds=image.getchannel('A').getbbox()
    if not bounds or min(bounds[:2])<8 or max(bounds[2:])>504:raise ValueError(f'Empty/clipped frame: {source} {bounds}')
   if meta['origin']!=[.5,.75] or meta['world_canvas']!=[128,128]:raise ValueError(f'Wrong fixed ground reference: {source}')
   clip.append(sha)
   frames.append({'source':source.name,'path':f'{state}/{direction}/{i:02}.png','sha256':sha,'bounds':bounds})
  if len(set(clip))<2:raise ValueError(f'Frozen clip: {state}/{direction}')
if len(frames)!=416:raise ValueError('Incomplete actor')
args.output.mkdir(parents=True)
for frame in frames:
 target=args.output/frame['path'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(args.source/frame['source'],target)
# Keep manifest outside the image tree so it cannot be mistaken for an atlas input.
args.output.with_suffix('.manifest.json').write_text(json.dumps({'frames':frames,'count':416,'status':'pixel-validation-pass-not-visual-approval'},indent=2)+'\n')
print('Validated and prepared 416 real frames; visual/game review remains required')
