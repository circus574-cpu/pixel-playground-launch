import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useRef, useState, type FormEvent } from 'react';
import { LockKeyhole, Upload, Download, File, LoaderCircle, LogOut, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import background from '@/assets/test-background.png.asset.json';
import { supabase } from '@/integrations/supabase/client';
import { getSketches, unlockSketches, prepareSketchUpload, downloadSketch, lockSketches } from '@/lib/sketches.functions';
import { uploadSketchSchema } from '@/lib/sketches.validation';

export const Route = createFileRoute('/test')({
  loader: () => getSketches(),
  head: () => ({ meta: [
    { title: 'Ki Legends — Szkice projektu' },
    { name: 'description', content: 'Prywatna przestrzeń szkiców projektu Ki Legends.' },
    { property: 'og:title', content: 'Ki Legends — Szkice projektu' },
    { property: 'og:description', content: 'Prywatna przestrzeń projektu Ki Legends.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'robots', content: 'noindex, nofollow' },
  ] }),
  component: SketchSpace,
});

function SketchSpace() {
  const { unlocked, files } = Route.useLoaderData();
  const router = useRouter();
  const unlock = useServerFn(unlockSketches);
  const prepare = useServerFn(prepareSketchUpload);
  const download = useServerFn(downloadSketch);
  const lock = useServerFn(lockSketches);
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  async function enter(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await unlock({ data: { password } });
      setPassword('');
      if (!result.ok) setError(result.error);
      else await router.invalidate();
    } catch { setError('Nie udało się otworzyć strony. Spróbuj ponownie.'); }
    finally { setBusy(false); }
  }

  async function uploadFiles(selected: FileList | null) {
    if (!selected?.length || busy) return;
    setBusy(true); setError(''); setStatus(''); setProgress(0);
    const list = Array.from(selected);
    let count = 0;
    try {
      for (const file of list) {
        const parsed = uploadSketchSchema.safeParse({ name: file.name, size: file.size });
        if (!parsed.success) throw new Error(`${file.name}: nieprawidłowa nazwa lub plik przekracza 50 MB.`);
        setStatus(`Przesyłanie: ${file.name}`);
        const signed = await prepare({ data: parsed.data });
        const { error: uploadError } = await supabase.storage.from('project-sketches').uploadToSignedUrl(signed.path, signed.token, file, { contentType: 'application/octet-stream' });
        if (uploadError) throw new Error(`Nie udało się przesłać: ${file.name}`);
        count += 1; setProgress(Math.round(count / list.length * 100));
      }
      setStatus(`Zapisano pliki: ${count}.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Przesyłanie nie powiodło się.'); setStatus(''); }
    finally {
      await router.invalidate(); setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function getFile(path: string) {
    setError('');
    try {
      const result = await download({ data: { path } });
      const anchor = document.createElement('a'); anchor.href = result.url; anchor.download = ''; anchor.click();
    } catch { setError('Nie udało się pobrać pliku.'); }
  }

  return (
    <main className="sketch-space relative isolate min-h-screen text-foreground">
      <img src={background.url} alt="" className="fixed inset-0 -z-20 h-full w-full object-cover" />
      <div className="fixed inset-0 -z-10 bg-background/70" />
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-5 sm:px-10">
        <div className="text-xl font-semibold">KI LEGENDS <span className="ml-2 text-xs font-normal text-muted-foreground">/ TEST</span></div>
        {unlocked && <Button variant="ghost" disabled={busy} onClick={async () => { await lock(); setStatus(''); setError(''); await router.invalidate(); }}><LogOut />Zablokuj</Button>}
      </header>
      {!unlocked ? (
        <section className="mx-auto flex min-h-[75vh] max-w-sm flex-col justify-center px-6 py-16">
          <LockKeyhole className="mb-5 size-7 text-primary" />
          <h1 className="text-3xl font-semibold">Szkice projektu</h1>
          <form onSubmit={enter} className="mt-8 space-y-4">
            <label htmlFor="sketch-password" className="text-sm text-muted-foreground">Hasło dostępu</label>
            <Input id="sketch-password" type="password" autoComplete="current-password" maxLength={256} required value={password} onChange={event => setPassword(event.target.value)} className="h-12 bg-background/80" />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="h-12 w-full">{busy ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />}Otwórz</Button>
          </form>
        </section>
      ) : (
        <section className="mx-auto max-w-5xl px-6 py-12 sm:px-10 sm:py-16">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
            <div><h1 className="text-3xl font-semibold">Szkice projektu</h1><p className="mt-2 text-sm text-muted-foreground">KI LEGENDS · {files.length} plików</p></div>
            <Button disabled={busy} size="lg" onClick={() => inputRef.current?.click()}>{busy ? <LoaderCircle className="animate-spin" /> : <Upload />}Dodaj pliki</Button>
          </div>
          <input ref={inputRef} type="file" multiple className="hidden" aria-label="Dodaj szkice" onChange={event => void uploadFiles(event.target.files)} />
          <div className={`flex min-h-40 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 transition-colors ${dragging ? 'border-primary bg-primary/10' : 'border-border bg-background/60'}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void uploadFiles(event.dataTransfer.files); }}>
            <Upload className="size-7 text-primary" />
            <p className="text-sm">Przeciągnij pliki tutaj</p>
            <p className="text-xs text-muted-foreground">Każde rozszerzenie · do 50 MB na plik</p>
            {busy && <progress value={progress} max={100} aria-label="Postęp przesyłania" className="h-2 w-48 accent-primary" />}
          </div>
          {status && <p role="status" className="mt-4 break-all text-sm text-muted-foreground">{status}</p>}
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          <div className="mt-10 border-t border-border">
            {!files.length ? <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground"><FolderOpen className="size-8" /><p className="text-sm">Jeszcze bez szkiców</p></div> : files.map(file => <div key={file.path} className="flex items-center gap-4 border-b border-border bg-background/60 px-4 py-4">
              <File className="size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{file.name}</p><p className="mt-1 text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB · {file.createdAt?.slice(0, 10)}</p></div>
              <Button variant="ghost" size="icon" title={`Pobierz ${file.name}`} aria-label={`Pobierz ${file.name}`} onClick={() => void getFile(file.path)}><Download /></Button>
            </div>)}
          </div>
        </section>
      )}
    </main>
  );
}