import pathlib,time,subprocess,sys
root=pathlib.Path('/workspace/ki-premium')
for _ in range(300):
 if (root/'model-download.json').is_file():break
 time.sleep(2)
else:raise RuntimeError('Model preparation did not finish within ten minutes')
subprocess.run([sys.executable,str(root/'premium_pilot.py'),'--validate','--root',str(root)],check=True)
subprocess.run([sys.executable,str(root/'premium_pilot.py'),'--root',str(root)],check=True)
