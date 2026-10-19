import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { KeyRound, Ban, Copy, Download, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getUploadIntegration, rotateUploadToken, revokeUploadTokens } from '@/lib/uploads.functions';
import { GAME_FOLDERS, IMPORT_HOSTS } from '@/lib/uploads.validation';
import { uploadOpenApi } from '@/lib/uploads.openapi';
export function UploadIntegrations() {
 const read = useServerFn(getUploadIntegration); const rotate = useServerFn(rotateUploadToken); const revoke = useServerFn(revokeUploadTokens);
 const [info, setInfo] = useState<Awaited<ReturnType<typeof getUploadIntegration>> | null>(null);
 const [token, setToken] = useState(''); const [directory, setDirectory] = useState('game-assets'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
 const [url,setUrl] = useState(''); const [name,setName] = useState(''); const [overwrite,setOverwrite] = useState(false); const [status,setStatus] = useState('');
 const [origin,setOrigin] = useState('');
 useEffect(() => { setOrigin('https://kilegends.pl'); let mounted = true; read().then(v => { if(mounted) setInfo(v); }).catch(() => { if(mounted) setError('Nie udało się odczytać integracji.'); }); return () => { mounted = false; }; }, [read]);
 async function action(fn: () => Promise<unknown>) { setBusy(true); setError(''); try { await fn(); setInfo(await read()); } catch(e) { setError(e instanceof Error ? e.message : 'Operacja nie powiodła się.'); } finally { setBusy(false); } }
 const curl = `curl -X POST '${origin}/api/public/uploads' \\\n  -H 'Authorization: Bearer YOUR_API_TOKEN' \\\n  -F 'file=@texture.png' \\\n  -F 'directory=${directory}' \\\n  -F 'overwrite=false'`;
 function schemaDownload() { const blob = new Blob([JSON.stringify(uploadOpenApi(origin),null,2)], { type: 'application/json' }); const objectUrl = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=objectUrl; a.download='ki-legends-openapi.json'; a.click(); setTimeout(() => URL.revokeObjectURL(objectUrl),1000); }
 return <div className="space-y-8">
  <section className="space-y-4 border-b border-border pb-8"><h2 className="text-xl font-semibold">Token API</h2>
   <label className="block text-sm">Katalog dostępu<select aria-label="Katalog tokenu" className="mt-2 block h-11 w-full rounded-md border border-border bg-background px-3" value={directory} onChange={e=>setDirectory(e.target.value)}>{GAME_FOLDERS.map(p=><option key={p}>{p}</option>)}</select></label>
   <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={()=>void action(async()=> { const result=await rotate({data:{directory}}); setToken(result.token); })}>{busy?<LoaderCircle className="animate-spin"/>:<KeyRound/>}{info?.tokens.length ? 'Zmień token' : 'Wygeneruj token'}</Button><Button variant="outline" disabled={busy || !info?.tokens.length} onClick={()=>void action(async()=> { await revoke(); setToken(''); })}><Ban/>Unieważnij</Button></div>
   {token && <div className="space-y-2"><p className="text-sm text-muted-foreground">Token widoczny tylko teraz. Zapisz go w bezpiecznych ustawieniach integracji, nie w rozmowie.</p><div className="flex gap-2"><Input aria-label="Nowy token API" type="password" readOnly value={token}/><Button size="icon" variant="outline" title="Kopiuj token" aria-label="Kopiuj token" onClick={()=>void navigator.clipboard.writeText(token).catch(()=>setError('Nie udało się skopiować tokenu.'))}><Copy/></Button></div></div>}
   <p className="break-all text-sm text-muted-foreground">{info?.tokens[0] ? `Aktywny token · ${info.tokens[0].directory}` : 'Brak aktywnego tokenu'} · 20 żądań/min · 50 MiB/plik · jeden plik/żądanie</p>
  </section>
  <section className="space-y-4 border-b border-border pb-8"><h2 className="text-xl font-semibold">Import z GitHub</h2><p className="break-words text-sm text-muted-foreground">Dozwolone HTTPS: {IMPORT_HOSTS.join(', ')}. Link GitHub Releases może przekierować wyłącznie do serwisu plików GitHub.</p>
   <form className="space-y-3" onSubmit={e=>{e.preventDefault();void action(async()=> { if(!token) throw new Error('Wygeneruj nowy token lub użyj importu przez API ze swoim zapisanym tokenem.'); const r=await fetch('/api/public/uploads/from-url',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({url,name,directory,overwrite})}); const result=await r.json(); if(!r.ok) throw new Error(`Import: ${result.error}`); setStatus(`Zapisano: ${result.path}. Odśwież listę plików.`); });}}>
    <Input aria-label="Publiczny adres HTTPS" type="url" placeholder="https://github.com/…/releases/download/…" value={url} required onChange={e=>setUrl(e.target.value)}/><Input aria-label="Nazwa importowanego pliku" placeholder="texture.png" value={name} required maxLength={200} onChange={e=>setName(e.target.value)}/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overwrite} onChange={e=>setOverwrite(e.target.checked)}/>Nadpisz istniejący plik</label><Button disabled={busy || !token} type="submit"><Download/>Importuj</Button>
   </form>{status && <p role="status" className="break-all text-sm">{status}</p>}
  </section>
  <section className="space-y-4"><h2 className="text-xl font-semibold">Dokumentacja API</h2><p className="break-all text-sm">POST {origin}/api/public/uploads<br/>POST {origin}/api/public/uploads/from-url</p><p className="text-sm text-muted-foreground">Aliasy /api/uploads i /api/uploads/from-url działają w podglądzie; dla automatyzacji użyj /api/public/, które nie wymagają dostępu do edytora. Pliki pozostają prywatne. Adres pobrania wygasa po 60 sekundach.</p>
   <pre className="overflow-x-auto rounded-md border border-border bg-background/80 p-4 text-xs">{curl}</pre><Button variant="outline" onClick={schemaDownload}><Download/>OpenAPI 3.1</Button><p className="break-all text-sm text-muted-foreground">Schemat po publikacji: {origin}/api/public/uploads/openapi</p>
   <p className="text-sm text-muted-foreground">400 — dane lub URL · 401 — token · 403 — katalog · 409 — plik istnieje · 413 — rozmiar · 415 — format żądania · 429 — limit · 503 — usługa niedostępna</p>
   <h3 className="font-semibold">ChatGPT / Automatyzacja</h3><ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground"><li>Pobierz schemat OpenAPI i dodaj go do konfiguracji Actions swojego GPT.</li><li>Ustaw uwierzytelnianie API Key → Bearer i wklej token wyłącznie w polu uwierzytelniania.</li><li>Importuj publiczny plik z GitHub przez importGameAsset. Generowane pliki binarne wymagają narzędzia obsługującego multipart; zwykły czat nie przesyła ich automatycznie.</li><li>Po testach opublikuj zmiany, aby adresy działały na kilegends.pl. Zmiana tokenu natychmiast unieważnia poprzedni.</li></ol>
  </section>
  <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Dziennik operacji</h2><Button variant="ghost" size="icon" title="Odśwież dziennik" aria-label="Odśwież dziennik" disabled={busy} onClick={()=>void action(async()=>{})}><RefreshCw/></Button></div>{info?.logs.map(log=><div key={log.id} className="border-b border-border py-3 text-xs"><p>{log.created_at.slice(0,19).replace('T',' ')} · {log.operation} · {log.status}</p>{log.path&&<p className="mt-1 break-all text-muted-foreground">{log.path}</p>}</div>)}</section>
  {error&&<p role="alert" className="break-words text-sm text-destructive">{error}</p>}
 </div>;
}
