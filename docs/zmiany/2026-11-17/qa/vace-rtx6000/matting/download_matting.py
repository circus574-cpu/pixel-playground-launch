from pathlib import Path
import urllib.request,hashlib,json
root=Path('/workspace/ki-premium/vace14/matting');root.mkdir(exist_ok=True)
file=root/'isnet-anime.onnx'
url='https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx'
if not file.exists():
 partial=root/'isnet-anime.onnx.partial-20261117'
 assert not partial.exists()
 with urllib.request.urlopen(url,timeout=60) as source,partial.open('xb') as dst:
  while True:
   block=source.read(4*1024*1024)
   if not block:break
   dst.write(block)
 assert hashlib.md5(partial.read_bytes()).hexdigest()=='6f184e756bb3bd901c8849220a83e38e'
 partial.rename(file)
data=file.read_bytes()
assert hashlib.md5(data).hexdigest()=='6f184e756bb3bd901c8849220a83e38e'
receipt={'source':url,'bytes':len(data),'md5':hashlib.md5(data).hexdigest(),'sha256':hashlib.sha256(data).hexdigest(),'reference':'rembg 2.0.67 sessions/dis_anime.py','purpose':'CPU matte review only','licenseStatus':'Weight license not verified by this download receipt'}
(root/'model-receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)
