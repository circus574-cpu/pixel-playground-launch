from pathlib import Path
import re,json,hashlib
root=Path('/workspace/.ki-migration-private')
s=(root/'full-data.sql').read_text()
tables={}
def unescape(raw):
 if raw==r'\N':return None
 b=raw.encode();out=bytearray();i=0;esc={98:8,102:12,110:10,114:13,116:9,118:11}
 while i<len(b):
  if b[i]!=92:out.append(b[i]);i+=1;continue
  i+=1;c=b[i]
  if 48<=c<=55:
   j=i+1
   while j<len(b) and j<i+3 and 48<=b[j]<=55:j+=1
   out.append(int(b[i:j],8));i=j
  elif c==120:
   j=i+1
   while j<len(b) and j<i+3 and chr(b[j]) in '0123456789abcdefABCDEF':j+=1
   out.append(int(b[i+1:j],16));i=j
  else:out.append(esc.get(c,c));i+=1
 return out.decode()
for m in re.finditer(r'^COPY ([\w.]+) \(([^\n]+)\) FROM stdin;\n(.*?)^\\\.$',s,re.M|re.S):
 name,cols,raw=m.groups();columns=[c.strip() for c in cols.split(',')]
 rows=[[unescape(v) for v in line.split('\t')] for line in raw.splitlines()]
 assert all(len(r)==len(columns) for r in rows)
 tables[name]=(columns,rows)
order=['auth.users','auth.identities','public.profiles','public.sketch_api_tokens','public.sketch_api_log','public.characters','public.user_roles','public.admin_audit']
users=tables['auth.users'];ids={r[users[0].index('id')] for r in users[1]}
for table,column in [('auth.identities','user_id'),('public.profiles','id'),('public.characters','user_id'),('public.user_roles','user_id')]:
 cols,rows=tables[table];assert all(r[cols.index(column)] in ids for r in rows)
for row in tables['public.characters'][1]:json.loads(row[tables['public.characters'][0].index('data')])
def lit(x):return 'NULL' if x is None else "E'"+x.replace('\\','\\\\').replace("'","''")+"'"
sql=['BEGIN;',"DO $$ BEGIN IF EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM public.characters) OR EXISTS(SELECT 1 FROM public.profiles) THEN RAISE EXCEPTION 'Target is no longer empty; import refused'; END IF; END $$;",'ALTER TABLE public.characters DISABLE TRIGGER characters_touch;','ALTER TABLE public.user_roles DISABLE TRIGGER roles_audit;']
for name in order:
 cols,rows=tables[name]
 if not rows:continue
 q='INSERT INTO '+name+' ('+','.join('"'+c+'"' for c in cols)+') VALUES '+','.join('('+','.join(lit(v) for v in row)+')' for row in rows)
 if name=='public.profiles':q+=' ON CONFLICT(id) DO UPDATE SET '+','.join('"'+c+'"=EXCLUDED."'+c+'"' for c in cols if c!='id')
 sql.append(q+';')
sql+=['ALTER TABLE public.characters ENABLE TRIGGER characters_touch;','ALTER TABLE public.user_roles ENABLE TRIGGER roles_audit;',"SELECT setval('public.admin_audit_id_seq',greatest(coalesce((select max(id) from public.admin_audit),1),1));",'COMMIT;',"SELECT (select count(*) from auth.users) as users,(select count(*) from auth.identities) as identities,(select count(*) from public.characters) as saves,(select count(*) from public.user_roles) as roles;"]
p=root/'import.sql';p.write_text('\n'.join(sql));p.chmod(0o600)
manifest={'source_sha256':hashlib.sha256((root/'full-261029.backup').read_bytes()).hexdigest(),'counts':{n:len(tables[n][1]) for n in order},'bytes':p.stat().st_size,'excluded':'Sessions/refresh tokens and provider-internal migration history are not imported. Storage objects require separate binary transfer.'}
(root/'import-counts.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest))
