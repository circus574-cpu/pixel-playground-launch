import torch,os,numpy as np
from PIL import Image,ImageFilter
from scipy import ndimage
from diffusers import StableDiffusionXLPipeline
R="/workspace/ki-legends-gpu/models/checkpoints/DreamShaperXL_Turbo_v2_1.safetensors"
pipe=StableDiffusionXLPipeline.from_single_file(R,config="/workspace/ki-legends-gpu/models/animagine-diffusers",torch_dtype=torch.float16).to("cuda")
S=("one single small isolated game sprite in the middle, lots of empty space around it, fully visible, top-down three-quarter view from above, hand painted cel shaded anime fantasy game art, "
   "soft painted brush strokes, crisp clean silhouette, plain solid light grey background, nothing else")
O={
"verdant":{"oak":"big round leafy green oak tree with lush canopy","tree2":"slender tree with light green round canopy and white bark",
  "pine":"tall dark green pine tree","bush":"round lush green bush","flowerbush":"green bush with white and yellow flowers",
  "boulder":"mossy grey boulder","rocks":"cluster of small grey rocks with moss","reeds":"clump of tall green reeds and cattails",
  "log":"fallen mossy log","stump":"old tree stump with moss","mushrooms":"cluster of red and brown mushrooms","fern":"lush green fern plant"},
"pyra":{"oak":"charred black dead tree with glowing ember cracks","tree2":"flat-topped acacia tree with orange-red leaves",
  "pine":"tall red-leaved cypress tree","bush":"dry thorny orange bush","flowerbush":"fire flower shrub with glowing orange blossoms",
  "boulder":"dark basalt boulder with glowing orange cracks","rocks":"cluster of black volcanic rocks","reeds":"clump of dry golden grass tufts",
  "log":"burnt fallen log with embers","stump":"charred tree stump","mushrooms":"cluster of glowing orange fire mushrooms","fern":"red spiky desert plant"},
"aether":{"oak":"big pink cherry blossom tree in full bloom","tree2":"elegant willow tree with pale lavender leaves",
  "pine":"tall slender white-bark tree with pale gold leaves","bush":"round pastel mint bush","flowerbush":"bush with pink and white blossoms",
  "boulder":"white marble boulder with gold veins","rocks":"cluster of lavender crystal shards","reeds":"clump of lotus flowers and reeds",
  "log":"fallen white birch log with petals","stump":"ancient stone lantern with moss","mushrooms":"cluster of pale glowing blue flowers","fern":"bamboo clump"},
"nexus":{"oak":"giant bioluminescent mushroom tree with cyan glowing cap","tree2":"alien tree with teal crystal leaves",
  "pine":"tall spiral alien tree with violet glowing tips","bush":"dark teal alien shrub with glowing cyan buds","flowerbush":"alien flower bush with violet glowing petals",
  "boulder":"dark metallic boulder with cyan circuit lines","rocks":"cluster of glowing cyan crystals","reeds":"clump of dark reeds with glowing tips",
  "log":"fallen broken metal pipe overgrown with moss","stump":"rusted robot head half buried, overgrown with moss","mushrooms":"cluster of glowing blue mushrooms","fern":"alien fern with luminous veins"}}
N="pattern, tiled, repeating, many, field, forest, crowd, multiple objects, sheet, grid, collage, text, watermark, frame, border, ground plane, landscape, scenery, background scene, horizon, person, character, animal, building, cropped, cut off"
out="/workspace/obj-world2";os.makedirs(out,exist_ok=True)
def cut(im):
    hsv=np.asarray(im.convert("HSV")).astype(np.float32)/255
    bg=(hsv[...,1]<.16)&(hsv[...,2]>.55)
    lab,_=ndimage.label(bg);edge=set(np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]]))-{0}
    m=~np.isin(lab,list(edge))
    m=ndimage.binary_opening(m,iterations=2)
    lab2,n=ndimage.label(m)
    if n==0: return None,0
    sizes=ndimage.sum(m,lab2,range(1,n+1));keep=np.argmax(sizes)+1;m=lab2==keep
    m=ndimage.binary_fill_holes(m)
    touch=m[0].any() or m[-1].any() or m[:,0].any() or m[:,-1].any() or not (.06<m.mean()<.6)
    al=Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    rgba=im.convert("RGBA");rgba.putalpha(al);bb=al.getbbox()
    return rgba.crop(bb),(0 if touch else 1)
for c,T in O.items():
  for k,p in T.items():
    for v in range(6):
      f=f"{out}/{c}-{k}-{v}.png"
      if os.path.exists(f): continue
      im=pipe(prompt=p+", "+S,negative_prompt=N,width=1024,height=1024,num_inference_steps=10,guidance_scale=2.5,
              generator=torch.Generator("cuda").manual_seed(1300+v)).images[0]
      r,ok=cut(im)
      if r is None: continue
      r.save(f if ok else f.replace(".png","-edge.png"));print("done",c,k,v,ok,flush=True)
  sh=Image.new("RGB",(6*256,12*256),(120,150,110))
  for i,k in enumerate(T):
    for v in range(6):
      f=f"{out}/{c}-{k}-{v}.png"
      if not os.path.exists(f): f=f.replace(".png","-edge.png")
      if os.path.exists(f):
        t=Image.open(f);t.thumbnail((250,250));sh.paste(t,(v*256,i*256),t)
  sh.save(f"{out}/sheet-{c}.jpg",quality=82)
print("ALL DONE",flush=True)
