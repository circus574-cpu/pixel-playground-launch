from pathlib import Path
import time,subprocess,sys
root=Path('/workspace/ki-premium')
for _ in range(180):
 if 'LOCAL_MODEL_READY' in (root/'cache.log').read_text():break
 time.sleep(2)
else:raise RuntimeError('Local model staging timeout')
subprocess.run([sys.executable,str(root/'premium_pilot.py'),'--root',str(root),'--model-root','/tmp/ki-premium-model'],check=True)
