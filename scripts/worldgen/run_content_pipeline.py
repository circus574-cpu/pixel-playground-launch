#!/usr/bin/env python3
"""Run CPU stages in owner-requested order. No provider lifecycle or production operations."""
import argparse,concurrent.futures,hashlib,json,os,subprocess,time
from pathlib import Path

def main():
 p=argparse.ArgumentParser();p.add_argument('--root',default='/workspace/ki-legends-worldgen');p.add_argument('--run',required=True);a=p.parse_args();root=Path(a.root);app=root/'app';run=root/'outputs'/a.run
 if run.exists():raise FileExistsError(str(run))
 run.mkdir(parents=True);browser=root/'outputs/browser-20261023-v1';node=root/'runtime/node22/bin/node';python=root/'env/bin/python';env=dict(os.environ,OMP_NUM_THREADS='1',OPENBLAS_NUM_THREADS='1',MKL_NUM_THREADS='1');stages=[];started=time.time()
 def command(stage,args):
  log=run/(stage+'.txt');s=time.time()
  with log.open('w')as stream:result=subprocess.run([str(x)for x in args],stdout=stream,stderr=subprocess.STDOUT,env=env)
  if result.returncode:raise RuntimeError(stage+' failed; inspect '+str(log))
  stages.append({'stage':stage,'seconds':round(time.time()-s,3),'passed':True})
  (run/'pipeline-status.json').write_text(json.dumps({'running':True,'completedStages':stages},indent=2))
 # 1. Conversion and 10,000 CPU paths already passed. Recheck final actual TypeScript engine code.
 conversion=json.loads((browser/'conversion-report.json').read_text());assert len(conversion['features'])==10 and all(f['passed']for f in conversion['features'])
 def check(f):
  out=run/('navigation-'+f+'.json');result=subprocess.run([str(node),str(app/'check-navigation-final.mjs'),str(browser),f,str(out)],capture_output=True,text=True,env=env)
  if result.returncode:raise RuntimeError(f+': '+result.stderr)
  return json.loads(result.stdout)
 with concurrent.futures.ThreadPoolExecutor(max_workers=8)as pool:navigation=list(pool.map(check,[f['feature']for f in conversion['features']]))
 (run/'navigation-report.json').write_text(json.dumps({'passed':True,'features':navigation},indent=2));stages.append({'stage':'conversion-and-navigation','passed':True})
 # 2. Actual game-engine balance simulations.
 balance=run/'balance';balance.mkdir();jobs=[]
 for shard in range(8):
  stream=(balance/('shard-'+str(shard)+'.txt')).open('w');task=subprocess.Popen([str(node),str(app/'simulate-balance-final.mjs'),'--trials','16','--shards','8','--shard',str(shard),'--output',str(balance)],stdout=stream,stderr=subprocess.STDOUT,env=env);jobs.append((task,stream))
 for task,stream in jobs:
  code=task.wait();stream.close()
  if code:raise RuntimeError('Balance shard failed')
 command('balance-summary',[python,app/'summarize_balance.py','--input',balance])
 summary=json.loads((balance/'balance-report.json').read_text());assert summary['activeSkillsStarted']>0
 # 3. Dungeon generation and then a separate spawn pass.
 dungeons=run/'dungeons';spawns=run/'dungeon-spawns'
 command('dungeon-generation',[python,app/'expand_dungeons.py','--world',browser,'--output',dungeons,'--workers','8'])
 command('dungeon-spawn-pass',[python,app/'dungeon_spawns.py','--dungeons',dungeons,'--world',browser,'--bestiary',root/'outputs/superior-20261023-v3/bestiary.json','--output',spawns])
 # 4. Settlement life and supply simulation.
 life=run/'settlement-life';command('settlement-life',[python,app/'settlement_life.py','--world',browser,'--output',life,'--workers','8'])
 command('engine-content-check',[node,app/'check-content.mjs',browser,dungeons,life,run/'engine-content-report.json'])
 source_files=['convert_browser.py','expand_dungeons.py','dungeon_spawns.py','settlement_life.py','summarize_balance.py','simulate-balance-final.mjs','check-navigation-final.mjs','check-content.mjs','run_content_pipeline.py']
 receipt={'complete':True,'seconds':round(time.time()-started,3),'stages':stages,'sourceFiles':{name:hashlib.sha256((app/name).read_bytes()).hexdigest()for name in source_files},'balanceFights':summary['fights'],'runtimeSceneInstalled':False}
 (run/'pipeline-status.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
