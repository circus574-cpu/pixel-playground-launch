import torch,os,json
from PIL import Image
from diffusers import StableDiffusionXLPipeline
R="/workspace/ki-legends-gpu/models/checkpoints/DreamShaperXL_Turbo_v2_1.safetensors"
pipe=StableDiffusionXLPipeline.from_single_file(R,config="/workspace/ki-legends-gpu/models/animagine-diffusers",torch_dtype=torch.float16).to("cuda")
for m in list(pipe.unet.modules())+list(pipe.vae.modules()):
    if isinstance(m,torch.nn.Conv2d): m.padding_mode="circular"
S=("seamless tileable ground texture, flat top-down view from directly above, hand painted cel shaded anime game environment art, "
   "soft painted brush strokes, small scale detail, even lighting, no shadows from objects")
C={
"verdant":{"grass":"lush soft green meadow grass, painted grass clumps, few tiny white and yellow flowers",
  "forest":"forest floor, moss, ferns, fallen green leaves, dark rich soil, dappled",
  "mountain":"grey granite rocky ground with moss patches and pebbles",
  "wetland":"marshy wet grass with small puddles, reeds stubs, dark green",
  "shore":"pale golden beach sand, fine grains, tiny shells",
  "road":"packed brown dirt path, small pebbles, faint wheel ruts",
  "sea":"calm clear ocean water surface, soft turquoise to blue, gentle painted ripples, uniform water"},
"pyra":{"grass":"dry orange-yellow savanna grass, sparse tufts on reddish earth",
  "forest":"scorched forest floor, ash, charred twigs, dark red soil, ember sparks",
  "mountain":"dark basalt volcanic rock ground, cracked, faint glowing orange veins",
  "wetland":"bubbling sulphur mud, ochre and grey, small hot pools",
  "shore":"black volcanic sand beach, fine grains, glints",
  "road":"red clay road, packed earth with dark stones",
  "sea":"deep warm ocean water surface, dark teal with orange sunset reflections, gentle ripples, uniform water"},
"aether":{"grass":"soft pastel mint grass with pink cherry blossom petals scattered",
  "forest":"sacred grove floor, pale moss, pink petals, white pebbles",
  "mountain":"white marble rock ground with gold veins and lavender lichen",
  "wetland":"misty shallow lotus pond water with lily pads, pastel",
  "shore":"white pearl sand beach, fine grains, iridescent",
  "road":"pale stone flagstone path with moss in gaps",
  "sea":"luminous pastel sky-blue ocean water surface, soft glowing ripples, uniform water"},
"nexus":{"grass":"teal alien grass with faint cyan glowing tips on dark soil",
  "forest":"bioluminescent forest floor, dark blue moss, glowing cyan mushrooms tiny",
  "mountain":"dark grey metallic rock ground, angular plates, faint circuit-like crystal lines",
  "wetland":"iridescent oily marsh water, violet and teal, small puddles",
  "shore":"silver grey sand beach with tiny crystal shards",
  "road":"worn dark asphalt-like stone road with faint cyan line markings",
  "sea":"deep indigo ocean water surface with cyan glints, gentle ripples, uniform water"}}
N="building, house, wall, person, character, animal, text, watermark, horizon, sky, perspective, frame, border, photo, tree trunk, large objects"
out="/workspace/tex-world";os.makedirs(out,exist_ok=True)
for c,T in C.items():
  for k,p in T.items():
    for v in range(3):
      f=f"{out}/{c}-{k}-{v}.png"
      if os.path.exists(f): continue
      im=pipe(prompt=p+", "+S,negative_prompt=N,width=1024,height=1024,num_inference_steps=10,guidance_scale=2.5,
              generator=torch.Generator("cuda").manual_seed(900+v)).images[0]
      im.save(f);print("done",c,k,v,flush=True)
  sh=Image.new("RGB",(7*256,3*256))
  for i,k in enumerate(T):
    for v in range(3): sh.paste(Image.open(f"{out}/{c}-{k}-{v}.png").resize((256,256)),(i*256,v*256))
  sh.save(f"{out}/sheet-{c}.jpg",quality=85)
print("ALL DONE",flush=True)
