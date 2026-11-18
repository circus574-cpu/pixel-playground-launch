import json,sys,numpy as np
from PIL import Image, ImageDraw
def crop(land):
    c=json.load(open(f"real_{land}.json")); im=Image.open(f"real_{land}.png").convert("RGB")
    W,H=im.size; s=W/c["ortho"]; hw,hh=c["cap"][2]/2,c["cap"][3]/2
    pts=[]
    for gx,gz in [(-hw,-hh),(hw,-hh),(hw,hh),(-hw,hh)]:
        pts.append((W/2+(gx-gz)*.7071*s, H/2+(gx+gz)*.7071*.5*s))
    m=Image.new("L",im.size,0); ImageDraw.Draw(m).polygon(pts,fill=255)
    out=Image.new("RGBA",im.size,(0,0,0,0)); out.paste(im,mask=m)
    out=out.crop(out.getbbox()); out.save(f"cap_{land}.png"); print(land,out.size)
for l in ["pyra","nexus","aether","verdant"]: crop(l)
