#!/usr/bin/env python3
"""Supplement missing package legal texts using npm release gitHead and official repository. No installs."""
import concurrent.futures, hashlib, json, pathlib, urllib.parse, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/licenses/dependencies'
def request(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Ki-Legends-license-audit/1.0'}),timeout=25) as r:return r.read(8*1024*1024)
def find(x):
    r={'path':x['path'],'name':x['name'],'version':x['version']}
    try:
        url='https://registry.npmjs.org/'+urllib.parse.quote(x['name'],safe='@')+'/'+x['version'];m=json.loads(request(url));r['metadataUrl']=url
        if m.get('dist',{}).get('integrity')!=x['integrity']:raise ValueError('registry integrity differs from lockfile')
        r['registryIntegrityMatches']=True
        revision=m.get('gitHead');repo=m.get('repository',x.get('packageMetadata',{}).get('repository',{})); repo=repo.get('url','') if isinstance(repo,dict) else repo
        if not revision or 'github.com' not in repo:raise ValueError('no immutable gitHead/GitHub source in version metadata')
        repository=repo.split('github.com',1)[1].lstrip('/:').removesuffix('.git');r.update(sourceRepository=repository,gitHead=revision)
        for p in ['LICENSE','LICENSE.md','LICENSE.txt','LICENSE-MIT','COPYING','UNLICENSE','LICENCE']:
            u='https://raw.githubusercontent.com/'+repository+'/'+revision+'/'+p
            try:b=request(u)
            except Exception:continue
            if b'<html' in b[:200].lower():continue
            sha=hashlib.sha256(b).hexdigest();target=OUT/'texts'/(sha+'.txt');target.write_bytes(b)
            r.update(sourceUrl=u,sha256=sha,file=target.relative_to(ROOT).as_posix(),bytes=len(b),status='UPSTREAM_TEXT_AT_REGISTRY_GITHEAD')
            if x['name'].startswith('@img/sharp-libvips'):
                r['status']='UPSTREAM_BUILD_SCRIPTS_LICENSE_ONLY'
                r['scopeWarning']='Apache-2.0 covers build scripts, not the LGPL binary payload or all bundled libraries. Payload notices/source obligations remain unresolved.'
            break
        if 'file' not in r:r['status']='NO_UPSTREAM_TEXT_FOUND'
    except Exception as e:r.update(status='UNRESOLVED',error=str(e)[:200])
    return r
if __name__=='__main__':
    data=json.loads((OUT/'register.json').read_text());missing=[x for x in data['records'] if not x['legalFiles']]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:rows=sorted(ex.map(find,missing),key=lambda x:x['path'])
    (OUT/'supplemental.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    from collections import Counter
    print(Counter(x['status'] for x in rows))
