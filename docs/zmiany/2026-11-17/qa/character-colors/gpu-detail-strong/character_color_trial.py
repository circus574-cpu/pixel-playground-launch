from pathlib import Path
import json,hashlib,shutil,time
from PIL import Image,ImageEnhance,ImageDraw
import torch
from diffusers import StableDiffusionXLImg2ImgPipeline,DPMSolverMultistepScheduler
root=Path(__file__).resolve().parent
assert not (root/'result.json').exists()
def sha(p):
 with p.open('rb') as s:return hashlib.file_digest(s,'sha256').hexdigest()
receipt=json.loads(Path('/workspace/ki-premium/model-download.json').read_text())
assert receipt['revision']=='f70ad5bce436c640d23fc02cd0a6ccc787280b6e'
cache=Path('/tmp/ki-character-sdxl');cache.mkdir(exist_ok=True)
for e in receipt['files']:
 src=Path('/workspace/ki-premium/model')/e['file'];dst=cache/e['file']
 assert src.resolve().is_relative_to(Path('/workspace/ki-premium/model'))
 dst.parent.mkdir(parents=True,exist_ok=True)
 if not dst.exists():shutil.copyfile(src,dst)
 assert sha(dst)==e['sha256']
print('MODEL_VERIFIED',flush=True)
src=Path('/workspace/ki-premium/vace14/trials/20261117-rtx6000-f0211ba4/trial/source/frame-00.png')
original=Image.open(src).convert('RGBA')
original.save(root/'source.png')
white=Image.new('RGBA',original.size,'white');white.alpha_composite(original)
base=white.convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
pipe=StableDiffusionXLImg2ImgPipeline.from_pretrained(str(cache),torch_dtype=torch.float16,variant='fp16',use_safetensors=True,local_files_only=True).to('cuda')
pipe.scheduler=DPMSolverMultistepScheduler.from_config(pipe.scheduler.config,algorithm_type='sde-dpmsolver++',use_karras_sigmas=True)
prompt='Full body anime game warrior, same pose and proportions as reference, same black spiky hair and face, same crimson red and deep black armor, rich clear crimson colors, crisp clean anime linework, refined painted armor details, strong readable shapes, accurate hands, natural warm skin, white empty background, fixed camera.'
negative='different character, different costume, extra limbs, extra fingers, weapons, scenery, text, watermark, gray veil, faded colors, blurry, washed out, cropped feet, neon, overexposed skin'
records=[];cells=[]
for name,strength,vivid in [('detail-high',0.48,True),('detail-highest',0.58,True)]:
 image=ImageEnhance.Color(base).enhance(1.22) if vivid else base
 started=time.monotonic();torch.cuda.reset_peak_memory_stats()
 result=pipe(prompt=prompt,negative_prompt=negative,image=image,strength=strength,num_inference_steps=20,guidance_scale=2.5,generator=torch.Generator('cuda').manual_seed(5741117)).images[0]
 result.save(root/(name+'.png'))
 native=result.resize(original.size,Image.Resampling.LANCZOS).convert('RGBA');native.putalpha(original.getchannel('A'));native.save(root/(name+'.webp'),lossless=True,exact=True)
 assert native.getchannel('A').tobytes()==original.getchannel('A').tobytes()
 records.append({'id':name,'strength':strength,'inputSaturation':1.22 if vivid else 1.0,'seconds':time.monotonic()-started,'peakAllocatedBytes':torch.cuda.max_memory_allocated(),'sourceSha256':sha(src),'rawSha256':sha(root/(name+'.png')),'nativeSha256':sha(root/(name+'.webp')),'alphaIdentical':True})
 cells.append((name,result,native));print('CHARACTER_READY',name,flush=True)
sheet=Image.new('RGB',(1024,820),'#30343a');d=ImageDraw.Draw(sheet)
for i,(name,image,native) in enumerate(cells):
 x=i*256+256;d.text((x+8,5),name,fill='white');sheet.paste(image.resize((256,256)),(x,28));sheet.paste(native.resize((256,256)),(x,300),native.getchannel('A').resize((256,256)))
sheet.paste(base.resize((256,256)),(0,28));d.text((8,5),'SOURCE / no install',fill='white')
sheet.save(root/'comparison.jpg',quality=94)
out={'kind':'character-detail-color-pilot','status':'candidates-review-required','modelRevision':receipt['revision'],'gpu':torch.cuda.get_device_name(0),'source':'Installed Legend walk:right frame 0','scope':'Static candidates only. Not new animation frames or production assets. Alpha unchanged does not prove pose unchanged.','items':records}
(root/'result.json').write_text(json.dumps(out,indent=2));print('CHARACTER_PILOT_DONE',flush=True)
