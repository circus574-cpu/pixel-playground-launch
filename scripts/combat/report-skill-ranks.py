"""Aggregate reproducible real-engine trials; no production tuning or gameplay mocks."""
import argparse,csv,gzip,json,statistics,hashlib
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

parser=argparse.ArgumentParser();parser.add_argument('--input',action='append',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
reports=[]
for folder in args.input:
 files=sorted(Path(folder).glob('*.json'))
 for file in files:
  r=json.loads(file.read_text());reports.append(r)
 for stage in {r['stage'] for r in reports if r['shard']==0}:
  chunks=[r for r in reports if r['stage']==stage and r['engineRoot']==reports[-1]['engineRoot']]
  if chunks:assert sorted(r['shard'] for r in chunks)==list(range(chunks[0]['shards'])),stage
rows=[row for report in reports for row in report['rows']]
assert len({(row['stage'],row['key'],row['model']) for row in rows})==len(rows)
assert all(len(r['samples'])==r['trials'] for r in rows)
assert all(r['wins']+r['deaths']+r['timeouts']==r['trials'] for r in rows)
for key in {r['key'] for r in rows}:
 same=[r for r in rows if r['key']==key]
 assert len({json.dumps([r['items'],r['skills'],r['opponents']],sort_keys=True) for r in same})==1,key
summary=[]
for stage,level,gear,model in sorted({(r['stage'],r['level'],r['gear'],r['model']) for r in rows}):
 group=[r for r in rows if (r['stage'],r['level'],r['gear'],r['model'])==(stage,level,gear,model)]
 samples=[s for r in group for s in r['samples']];wins=[s for s in samples if s['outcome']=='win']
 times=sorted(s['seconds'] for s in wins)
 summary.append(dict(stage=stage,level=level,gear=gear,model=model,profiles=len(group),trials=len(samples),wins=len(wins),deaths=sum(s['outcome']=='death' for s in samples),timeouts=sum(s['outcome']=='timeout' for s in samples),winRate=len(wins)/len(samples),ttkMedian=statistics.median(times) if times else None,ttkP10=times[int((len(times)-1)*.1)] if times else None,ttkP90=times[int((len(times)-1)*.9)] if times else None,kiSpentMean=statistics.mean(s['kiSpent'] for s in samples),potionsMean=statistics.mean(s['potions'] for s in samples)))
with (out/'summary.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,list(summary[0]),lineterminator='\n');w.writeheader();w.writerows(summary)
flat=[]
for r in rows:
 flat.append({k:(json.dumps(v,ensure_ascii=False,separators=(',',':')) if isinstance(v,(dict,list)) else v) for k,v in r.items() if k!='samples'})
with (out/'profiles.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,list(flat[0]),lineterminator='\n');w.writeheader();w.writerows(flat)
paired=[]
for row in rows:
 if row['model']!='owner-bonus':continue
 base=next(r for r in rows if r['key']==row['key'] and r['model']=='current')
 pairs=list(zip(base['samples'],row['samples']));assert all(a['seed']==b['seed'] for a,b in pairs)
 both=[b['seconds']-a['seconds'] for a,b in pairs if a['outcome']==b['outcome']=='win']
 paired.append(dict(key=row['key'],trials=len(pairs),winsLost=sum(a['outcome']=='win' and b['outcome']!='win' for a,b in pairs),winsGained=sum(a['outcome']!='win' and b['outcome']=='win' for a,b in pairs),bothWin=len(both),medianTtkDifferenceAmongPairedWins=statistics.median(both) if both else None))
with (out/'paired.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,list(paired[0]),lineterminator='\n');w.writeheader();w.writerows(paired)
curves=next(r['curves'] for r in reports if r['stage']=='screen' and r['shard']==0)
with gzip.open(out/'raw-trials.json.gz','wt',encoding='utf8') as f:json.dump(reports,f,ensure_ascii=False)
with gzip.open(out/'stat-curves.json.gz','wt',encoding='utf8') as f:json.dump(curves,f,ensure_ascii=False)
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False,'svg.fonttype':'none'})
fig,axes=plt.subplots(2,2,figsize=(12,7),layout='constrained')
for ax,race,label in zip(axes.flat,['planetary','sage','android','legend'],['Planetarni · HP','Mędrcy · KI','Androidy · DEF','Legendy · HP']):
 for model,color,title in [('current','#9a3412','Przed zmianą'),('owner-bonus','#047857','Nowa reguła')]:
  c=sorted([c for c in curves if c['race']==race and c['model']==model],key=lambda c:c['level'])
  ax.plot([c['level'] for c in c],[c['value'] for c in c],label=title,color=color,lw=2)
 c=sorted([c for c in curves if c['race']==race and c['model']=='current'],key=lambda c:c['level'])
 ax.plot([c['level'] for c in c],[c['base'] for c in c],label='Bez premii drzewka',color='#64748b',ls='--')
 ax.set(title=label,xlabel='Poziom postaci',ylabel='Wartość w rzeczywistym Kit');ax.grid(alpha=.2)
axes[0,0].legend();fig.suptitle('Koncentracja punktów w jednej pasywce · bez sprzętu i treningu');fig.savefig(out/'stat-curves.svg');plt.close(fig)
fig,axes=plt.subplots(1,2,figsize=(12,4),layout='constrained')
models=[('current','Przed'),('owner-stats','Tylko statystyki'),('owner-bonus','Nowa reguła')]
for offset,(model,title) in enumerate(models):
 for i,gear in enumerate(['bare','reference','catalog']):
  samples=[s for r in rows if r['stage']=='screen' and r['gear']==gear and r['model']==model for s in r['samples']]
  wins=[s for s in samples if s['outcome']=='win'];x=i+(offset-1)*.24
  axes[0].bar(x,100*len(wins)/len(samples),width=.23,color=['#9a3412','#c084fc','#047857'][offset],label=title if i==0 else None)
  axes[1].bar(x,statistics.median(s['seconds'] for s in wins),width=.23,color=['#9a3412','#c084fc','#047857'][offset],label=title if i==0 else None)
for ax in axes:
 ax.set_xticks([0,1,2],['Bez sprzętu','Zestaw referencyjny','Pełny katalog']);ax.grid(axis='y',alpha=.2);ax.legend()
axes[0].set(ylabel='Wygrane w kontrolowanej próbie (%)',ylim=(0,100));axes[1].set(ylabel='Mediana czasu zwycięstwa (s)');fig.suptitle('Te same profile i początkowe ziarna · statystyki bez treningu · automat, nie gracz');fig.savefig(out/'combat-comparison.svg');plt.close(fig)
manifest=dict(format='ki-rank-measurement-report-1',profiles=len(rows),fights=sum(r['trials'] for r in rows),sources=[{k:r[k] for k in ['sourceSha','engineSha','dirty','toolSha256','stage','shard','shards','trials','sourceHashes']} for r in reports],paired=paired,summary=summary,notes=reports[0]['notes'],roundingAtLevel10=[c for c in curves if c['level']==10 and c['model'] in ['current','owner-bonus']])
(out/'measurement.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'profiles':len(rows),'fights':manifest['fights'],'pairedProfiles':len(paired)}))
