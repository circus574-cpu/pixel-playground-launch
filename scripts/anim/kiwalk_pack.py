#!/usr/bin/env python3
"""Add the built kiwalk atlas to the race's installed hero pack (see kiwalk_build.py) as an import-ready package.
Writes <work-dir>/pkg/<race>/pack.json; install it with npm run assets:import -- ... --install --replace
(the importer needs a version bump, set KIWALK_VERSION when re-running)."""
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
os.chdir(Path(__import__("sys").argv[2]).resolve())
import json, shutil, os, sys, glob
R=sys.argv[1]
PID={'android':'hero-android-walk-v3','legend':'hero-legend-walk-v3','sage':'hero-sage-painted-walk-v3','planetary':'hero-planetary-painted-walk-v3'}[R]
G=str(ROOT/'public/game/assets/gpu')+'/'
src=sorted(glob.glob(G+PID+'/*'))[-1]
dst=f'pkg/{R}'; shutil.rmtree(dst,ignore_errors=True); os.makedirs(dst)
for f in os.listdir(src):
    if f!='pack.json': shutil.copy(os.path.join(src,f),dst)
pack=json.load(open(src+'/pack.json'))
VER=os.environ.get('KIWALK_VERSION','2.1.0'); pack['version']=VER
for a in pack['assets']:
    a['version']=VER
    a['url']=os.path.basename(a['url'])
    if a.get('atlasUrl'): a['atlasUrl']=os.path.basename(a['atlasUrl'])
aid=f'{PID}-kiwalk-0'
shutil.copy(f'{R}/out/atlas.webp',f'{dst}/{aid}.webp')
at=json.load(open(f'{R}/out/atlas.json')); clip=json.load(open(f'{R}/out/clip.json')); W,H=clip['size']; at['meta']={'image':aid+'.webp','size':{'w':W,'h':H},'scale':'1'}
json.dump(at,open(f'{dst}/{aid}.json','w'))
pack['assets'].append({'id':aid,'version':VER,'kind':'atlas','url':aid+'.webp','atlasUrl':aid+'.json','width':W,'height':H})
actor=pack['actors'][0]
DIRS=['down','down-left','left','up-left','up','up-right','right','down-right']
actor['clips']['kiwalk']={'asset':aid,'fps':16,'loop':True,'directions':{d:clip['names'][d] for d in DIRS}}
json.dump(pack,open(f'{dst}/pack.json','w'),indent=2)
print(R,'pack ready',actor['id'],list(actor['clips']))
