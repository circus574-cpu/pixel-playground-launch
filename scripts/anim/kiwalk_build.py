#!/usr/bin/env python3
"""Cut the "walk after transformation" (Tryb KI) frames of one race from the owner's Gemini video.

    python3 scripts/anim/kiwalk_build.py <android|legend|sage|planetary> <work-dir>
    python3 scripts/anim/kiwalk_pack.py  <race> <work-dir>      # then: npm run assets:import -- <work-dir>/pkg/<race>/pack.json --install --replace

The videos (art-wip/gemini-walk-videos/<race>-walk-transformed.mp4) show the hero turning through all views while
walking in place. CFG below picks, per direction, the moment of the best view (seconds) and whether the frames are the
mirror of another direction. Legend and Planetary turn too fast for stable diagonals, so their diagonals reuse the
profile. Each direction is one gait cycle (period detected from the profile), 8 frames, matted with rembg (isnet-anime),
scaled to the height of the race's existing walk, feet on the same baseline, trimmed and shelf-packed into one atlas
(trimmed Phaser frames keep it far below the 128 MiB world texture budget; Verdantia has only ~8 MiB left).
Needs: ffmpeg, rembg (isnet-anime model), opencv-python, numpy, pillow.
Hero packs are stored at a 200 px cell (scripts/assets/downscale_hero_pack.py): this builder measures the installed
walk in 256 px units and writes 256 px cells, so run downscale_hero_pack.py on its pkg/<race> before importing it.
"""
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
WORK = Path(__import__("sys").argv[2]).resolve()
os.makedirs(WORK, exist_ok=True)
os.chdir(WORK)
import json, sys, os, numpy as np, cv2, subprocess
from PIL import Image
from rembg import remove, new_session
R=sys.argv[1]
ACTOR={'android':'hero-android','legend':'hero-legend','sage':'hero-sage-painted','planetary':'hero-planetary-painted'}[R]
PID={'android':'hero-android-walk-v3','legend':'hero-legend-walk-v3','sage':'hero-sage-painted-walk-v3','planetary':'hero-planetary-painted-walk-v3'}[R]
G=str(ROOT/'public/game/assets/gpu')+'/'
import glob
BASE=os.path.relpath(sorted(glob.glob(G+PID+'/*'))[-1]+'/'+PID+'-page-0',G)
VID=str(ROOT/f'art-wip/gemini-walk-videos/{R}-walk-transformed.mp4')
DIRS=['down','down-left','left','up-left','up','up-right','right','down-right']
MIR={'down':'down','up':'up','left':'right','right':'left','down-left':'down-right','down-right':'down-left','up-left':'up-right','up-right':'up-left'}
N=240
os.makedirs(R,exist_ok=True)
if not os.path.exists(f'{R}/raw_001.png'):
    subprocess.run(['ffmpeg','-v','error','-y','-i',VID,'-vf','scale=640:360',f'{R}/raw_%03d.png'],check=True)
CFG={
 'android':{'down':(0.6,None,False),'up':(1.9,None,False),'right':(3.8,None,False),'down-right':(5.8,None,False),'up-right':(8.9,None,False),
            'left':(3.8,'right',True),'down-left':(5.8,'down-right',True),'up-left':(8.9,'up-right',True)},
 'legend':{'left':(7.4,None,False),'down':(9.4,None,False),'up':(5.3,None,False),
           'right':(7.4,'left',True),'down-left':(7.4,'left',False),'up-left':(7.4,'left',False),
           'down-right':(7.4,'left',True),'up-right':(7.4,'left',True)},
 'sage':{'right':(3.6,None,False),'down':(0.6,None,False),'up':(6.8,None,False),'down-right':(1.95,None,False),'up-right':(5.65,None,False),
         'left':(3.6,'right',True),'down-left':(1.95,'down-right',True),'up-left':(5.65,'up-right',True)},
 'planetary':{'right':(3.8,None,False),'left':(9.0,None,False),'down':(0.6,None,False),'up':(6.9,None,False),
              'down-right':(3.8,'right',False),'up-right':(3.8,'right',False),'down-left':(9.0,'left',False),'up-left':(9.0,'left',False)},
}[R]
PROF={'android':'right','legend':'left','sage':'right','planetary':'right'}[R]
gray=[]
for i in range(1,N+1):
    g=cv2.imread(f'{R}/raw_{i:03d}.png',0)[:,160:480].astype(np.float32); gray.append(g)
c0=int(round(CFG[PROF][0]*24)); s0=max(0,c0-20)
bestP,bd=24,1e9
for P in range(16,31):
    ks=range(0,max(1,40-P))
    dd=np.mean([np.abs(gray[s0+k]-gray[min(N-1,s0+k+P)]).mean() for k in ks])
    if dd<bd: bd,bestP=dd,P
P=bestP; print(R,'gait period',P,'frames')
plan={}; info={}
for d in DIRS:
    c,src,flip=CFG[d]
    src=src or d
    csrc=CFG[src][0]
    st=int(round(csrc*24-P/2)); st=max(0,min(N-1-P,st))
    plan[d]=([st+round(j*P/8) for j in range(8)], flip)
    info[d]=(csrc,P,('from-'+src if src!=d else 'native')+('+flip' if flip else ''))
print(json.dumps({d:(v[0][0],v[0][-1],v[1]) for d,v in plan.items()}))
# base metrics
atl=json.load(open(G+BASE+'.json')); img=np.array(Image.open(G+BASE+'.webp').convert('RGBA'))
hs,bs=[],[]
for name,fr in atl['frames'].items():
    if name.split('/')[1]!='walk': continue
    f=fr['frame']; oy=fr.get('spriteSourceSize',{'y':0})['y']; a=img[f['y']:f['y']+f['h'],f['x']:f['x']+f['w'],3]>128  # frames are trimmed: add their offset
    ys,xs=np.where(a)
    k=256.0/fr.get('sourceSize',{'w':256})['w']  # the installed pack may be stored at a 200 px cell
    if len(ys): hs.append((ys.max()-ys.min()+1)*k); bs.append((ys.max()+oy+1)*k-1)
baseH=float(np.median(hs)); baseBottom=float(np.median(bs))
print('base height',baseH,'bottom',baseBottom)
# full-res frames + matting
os.makedirs(f'{R}/full',exist_ok=True); os.makedirs(f'{R}/mat',exist_ok=True)
need=sorted({i for d in DIRS for i in plan[d][0]})
subprocess.run(['ffmpeg','-v','error','-y','-i',VID,'-vf','select=' + '+'.join(f'eq(n\\,{i})' for i in need),'-vsync','0',f'{R}/full/f_%03d.png'],check=True)
sess=new_session('isnet-anime'); mats={}
for k,i in enumerate(need):
    p=f'{R}/mat/{i:03d}.png'
    if not os.path.exists(p):
        im=Image.open(f'{R}/full/f_{k+1:03d}.png').convert('RGB')
        remove(im,session=sess).save(p)
    mats[i]=np.array(Image.open(p).convert('RGBA'))
def bbox(a,th=128):
    ys,xs=np.where(a[:,:,3]>th)
    return (ys.min(),ys.max(),xs.min(),xs.max()) if len(ys) else (0,0,0,0)
kih=[bbox(m)[1]-bbox(m)[0]+1 for m in mats.values()]
scale=baseH/float(np.median(kih)); print('ki median h',np.median(kih),'scale',scale)
def render(rgba,scale):
    a=rgba.astype(np.float32); a[:,:,:3]*=a[:,:,3:4]/255.0
    h,w=a.shape[:2]; nw,nh=max(1,round(w*scale)),max(1,round(h*scale))
    r=cv2.resize(a,(nw,nh),interpolation=cv2.INTER_AREA if scale<1 else cv2.INTER_CUBIC)
    al=r[:,:,3:4]; rgb=np.where(al>0.5,r[:,:,:3]/np.maximum(al/255.0,1e-3),0)
    return np.clip(np.concatenate([rgb,al],2),0,255).astype(np.uint8)
frames={}
for d in DIRS:
    idx,mirror=plan[d]
    dh=float(np.median([bbox(mats[i])[1]-bbox(mats[i])[0]+1 for i in idx])); sc=baseH/dh
    print(d,'scale',round(sc,3))
    rs=[render(mats[i],sc) for i in idx]
    bbs=[bbox(r) for r in rs]
    bot=float(np.median([b[1] for b in bbs])); cx=float(np.mean([(b[2]+b[3])/2 for b in bbs]))
    dy=int(round(baseBottom-bot)); dx=int(round(128-cx))
    out=[]
    for r in rs:
        c=np.zeros((256,256,4),np.uint8)
        h,w=r.shape[:2]
        y0,x0=dy,dx
        sy0,sx0=max(0,-y0),max(0,-x0); dy0,dx0=max(0,y0),max(0,x0)
        hh=min(h-sy0,256-dy0); ww=min(w-sx0,256-dx0)
        if hh>0 and ww>0: c[dy0:dy0+hh,dx0:dx0+ww]=r[sy0:sy0+hh,sx0:sx0+ww]
        if mirror: c=c[:,::-1].copy()
        out.append(c)
    frames[d]=out
# clipping check
clip=0
for d in DIRS:
    for c in frames[d]:
        a=c[:,:,3]; 
        if a[0].max()>10 or a[-1].max()>10 or a[:,0].max()>10 or a[:,-1].max()>10: clip+=1
print('clipped frames',clip)
os.makedirs(f'{R}/out',exist_ok=True)
# unique frame sets: a direction that only aliases another (no flip) reuses its frame names
names={}      # dir -> list of 8 frame names
unique=[]     # (name, rgba256)
byKey={}      # (source dir, flip) -> frame names; same pixels are stored once
for d in DIRS:
    c,src,flip=CFG[d]
    key=((src or d),bool(flip))
    if key in byKey: names[d]=byKey[key]; continue
    names[d]=[f'{ACTOR}/kiwalk/{d}/{j:02d}' for j in range(8)]
    byKey[key]=names[d]
    for j,fr in enumerate(frames[d]): unique.append((names[d][j],fr))
# trim each frame to its alpha bbox (+2 px) and shelf-pack into a 2048 px wide atlas
items=[]
for name,fr in unique:
    ys,xs=np.where(fr[:,:,3]>0)
    y0,y1,x0,x1=int(max(0,ys.min()-2)),int(min(255,ys.max()+2)),int(max(0,xs.min()-2)),int(min(255,xs.max()+2))
    items.append((name,fr[y0:y1+1,x0:x1+1].copy(),x0,y0))
items.sort(key=lambda t:-t[1].shape[0])
W=2048; pad=2; x=pad; y=pad; shelf=0; place={}
for name,crop,ox,oy in items:
    h,w=crop.shape[:2]
    if x+w+pad>W: x=pad; y+=shelf+pad; shelf=0
    place[name]=(x,y,w,h,ox,oy); x+=w+pad; shelf=max(shelf,h)
H=y+shelf+pad; H=(H+3)//4*4
atlas=np.zeros((H,W,4),np.uint8); meta={}
for name,crop,ox,oy in items:
    px,py,w,h,_,_=place[name]; atlas[py:py+h,px:px+w]=crop
    meta[name]={'frame':{'x':px,'y':py,'w':w,'h':h},'rotated':False,'trimmed':True,'sourceSize':{'w':256,'h':256},'spriteSourceSize':{'x':ox,'y':oy,'w':w,'h':h}}
Image.fromarray(atlas).save(f'{R}/out/atlas.png')
Image.fromarray(atlas).save(f'{R}/out/atlas.webp',quality=90,method=6,alpha_quality=100)
base_meta=atl.get('meta',{})
json.dump({'frames':meta,'meta':{'image':'atlas.webp','size':{'w':W,'h':H},'scale':'1'}},open(f'{R}/out/atlas.json','w'))
json.dump({'names':names,'size':[W,H]},open(f'{R}/out/clip.json','w'))
json.dump({d:{'frames':plan[d][0],'mirror':plan[d][1],'info':info[d]} for d in DIRS},open(f'{R}/out/plan.json','w'),indent=1)
print('built',R,'unique frames',len(unique),'atlas',W,H,'bytes',W*H*4,'webp',os.path.getsize(f'{R}/out/atlas.webp'))
