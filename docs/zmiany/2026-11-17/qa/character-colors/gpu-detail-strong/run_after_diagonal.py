from pathlib import Path
import subprocess,time,os
root=Path(__file__).resolve().parent
diag=Path('/workspace/ki-premium/vace14/trials/20261117-diagonal-v2/trial')
for i in range(200):
 if list(diag.glob('generated-*/result.json')) and not (diag/'inference.lock').exists():break
 time.sleep(5)
else:raise RuntimeError('Diagonal job did not complete; no next GPU job started')
for i in range(12):
 value=subprocess.check_output(['nvidia-smi','--query-gpu=memory.used','--format=csv,noheader,nounits'],text=True).strip()
 if int(value)<500:break
 time.sleep(5)
else:raise RuntimeError('GPU is occupied; no next model loaded')
env=os.environ.copy();env.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',PYTHONUNBUFFERED='1')
subprocess.run(['timeout','-k','30s','10m','/tmp/ki-vace-env/bin/python','character_color_trial.py'],cwd=root,env=env,check=True)
