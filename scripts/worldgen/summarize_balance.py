"""Aggregate seeded engine runs; findings never modify canonical stats or economy."""
import argparse,csv,json,statistics
from pathlib import Path

def main():
 p=argparse.ArgumentParser();p.add_argument('--input',required=True);a=p.parse_args();root=Path(a.input);shards=[json.loads(f.read_text())for f in sorted(root.glob('shard-*.json'))]
 if not shards or len(shards)!=shards[0]['shards']or len({s['shard']for s in shards})!=len(shards):raise RuntimeError('Incomplete balance shards')
 rows=[r for s in shards for r in s['results']];keys=[(r['monster'],r['race'],r['playerLevel'],r['profile'])for r in rows]
 if len(set(keys))!=len(keys):raise RuntimeError('Duplicated scenarios')
 if any(r['wins']+r['deaths']+r['timeouts']!=r['trials']for r in rows):raise RuntimeError('Invalid outcome accounting')
 groups=[]
 for race in sorted({r['race']for r in rows}):
  for profile in sorted({r['profile']for r in rows}):
   same=[r for r in rows if r['race']==race and r['profile']==profile and r['playerLevel']==r['monsterLevel']]
   total=sum(r['trials']for r in same);groups.append({'race':race,'profile':profile,'sameLevelScenarios':len(same),'winRate':sum(r['wins']for r in same)/total if total else None,'deathRate':sum(r['deaths']for r in same)/total if total else None,'timeoutRate':sum(r['timeouts']for r in same)/total if total else None,'medianOfSuccessfulKillMedians':statistics.median([r['medianKillSeconds']for r in same if r['medianKillSeconds']is not None])if any(r['medianKillSeconds']is not None for r in same)else None,'warning':'Kill medians omit losses; do not infer overall difficulty from them alone.'})
 findings=[{k:r[k]for k in ['monster','race','playerLevel','profile','winRate','medianKillSeconds','flags']}for r in rows if r['flags']]
 report={'engine':shards[0]['engine'],'complete':True,'levelRange':shards[0].get('levelRange'),'opponentMode':shards[0].get('opponentMode'),'scenarios':len(rows),'fights':sum(r['trials']for r in rows),'wins':sum(r['wins']for r in rows),'deaths':sum(r['deaths']for r in rows),'timeouts':sum(r['timeouts']for r in rows),'groups':groups,'reviewFindings':findings,'activeSkillsStarted':sum(r.get('activeSkillsStarted',0)for r in rows),'canonicalBalanceChanged':False,'assumptions':shards[0]['assumptions'],'limitations':['Exploratory 16 seeded trials per scenario; confidence intervals retained in raw shards.','Fixed arena, automatic play and one A-branch strategy do not replace skilled-player tests.','Economy estimates assume material sale and travel/recovery time; no live market simulation.']}
 (root/'balance-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 columns=['monster','monsterLevel','race','playerLevel','profile','trials','wins','deaths','timeouts','winRate','medianKillSeconds','meanFightSeconds','meanRemainingHp','potionsConsumed','activeSkillsStarted','goldDropped','materialSellValue','netGoldAfterPotionsAndInn','xpEarned','estimatedXpPerHour']
 with (root/'balance-matrix.csv').open('w',newline='')as stream:
  writer=csv.DictWriter(stream,fieldnames=columns,extrasaction='ignore');writer.writeheader();writer.writerows(rows)
 print(json.dumps({'complete':True,'levelRange':shards[0].get('levelRange'),'opponentMode':shards[0].get('opponentMode'),'scenarios':report['scenarios'],'fights':report['fights'],'reviewFindings':len(findings)}))
if __name__=='__main__':main()
