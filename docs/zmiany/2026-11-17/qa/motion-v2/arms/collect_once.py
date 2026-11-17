from pathlib import Path
import subprocess,os,time,json,zipfile,hashlib
r=Path(__file__).resolve().parent
for i in range(60):
 results=list((r/'trial').glob('generated-*/result.json'))
 if results:break
 if not (r/'trial/inference.lock').exists():raise RuntimeError('Inference ended without a valid result')
 time.sleep(2)
assert len(results)==1
env=os.environ.copy();env.update(OMP_NUM_THREADS='4',OPENBLAS_NUM_THREADS='1',NUMBA_NUM_THREADS='4')
subprocess.run(['/tmp/ki-vace-env/bin/python','vace_pack.py','--root','trial','--result',str(results[0]),'--out','candidate','--matte','rembg','--matting-model','/workspace/ki-premium/vace14/matting/isnet-anime.onnx'],cwd=r,env=env,check=True,timeout=120)
files=[p for p in r.rglob('*') if p.is_file() and p.name not in ['inference.lock','collector.log','arms-pilot.zip','transfer.json']]
out=r/'arms-pilot.zip'
with zipfile.ZipFile(out,'x',zipfile.ZIP_DEFLATED) as z:
 for p in files:z.write(p,p.relative_to(r).as_posix())
b=out.read_bytes();d={'archive':out.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
(r/'transfer.json').write_text(json.dumps(d));print(json.dumps(d),flush=True)
