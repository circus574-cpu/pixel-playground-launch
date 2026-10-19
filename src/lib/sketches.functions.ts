import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { sketchSession, requireSketchAccess, passwordMatches, checkSketchOrigin } from './sketches.server';
import { uploadSketchSchema, sketchPathSchema } from './sketches.validation';

export const unlockSketches = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({ password: z.string().min(1).max(256) }).parse(input))
  .handler(async ({ data }) => {
    checkSketchOrigin();
    const session = await sketchSession();
    if ((session.data.retryAt ?? 0) > Date.now()) return { ok: false, error: 'Odczekaj minutę przed kolejną próbą.' };
    const expected = process.env['SITE_PASSWORD'];
    if (!expected) throw new Error('Brak konfiguracji dostępu.');
    if (!passwordMatches(data.password, expected)) {
      const attempts = (session.data.attempts ?? 0) + 1;
      await session.update({ attempts, retryAt: attempts >= 5 ? Date.now() + 60000 : 0 });
      return { ok: false, error: 'Nieprawidłowe hasło.' };
    }
    await session.update({ unlocked: true, attempts: 0, retryAt: 0 });
    return { ok: true, error: '' };
  });

export const getSketches = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await sketchSession();
  if (!session.data.unlocked) return { unlocked: false, files: [] };
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.storage.from('project-sketches').list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) throw new Error('Nie udało się pobrać plików.');
  return { unlocked: true, files: (data ?? []).filter(file => file.id).map(file => ({
    path: file.name, name: Buffer.from(file.name.split('--')[1] ?? '', 'base64url').toString('utf8'),
    size: Number(file.metadata?.['size'] ?? 0), createdAt: file.created_at,
  })) };
});

export const prepareSketchUpload = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => uploadSketchSchema.parse(input))
  .handler(async ({ data }) => {
    checkSketchOrigin();
    await requireSketchAccess();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const path = `${crypto.randomUUID()}--${Buffer.from(data.name).toString('base64url')}`;
    const { data: signed, error } = await supabaseAdmin.storage.from('project-sketches').createSignedUploadUrl(path);
    if (error || !signed) throw new Error('Nie udało się rozpocząć przesyłania.');
    return { path, token: signed.token };
  });

export const downloadSketch = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => sketchPathSchema.parse(input))
  .handler(async ({ data }) => {
    checkSketchOrigin();
    await requireSketchAccess();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const name = Buffer.from(data.path.split('--')[1] ?? '', 'base64url').toString('utf8');
    const { data: signed, error } = await supabaseAdmin.storage.from('project-sketches').createSignedUrl(data.path, 60, { download: name });
    if (error || !signed) throw new Error('Nie udało się pobrać pliku.');
    const url = new URL(signed.signedUrl);
    const browserUrl = new URL(import.meta.env['VITE_SUPABASE_URL']);
    url.protocol = browserUrl.protocol; url.host = browserUrl.host;
    return { url: url.toString() };
  });

export const previewSketch = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => sketchPathSchema.parse(input))
  .handler(async ({ data }) => {
    checkSketchOrigin();
    await requireSketchAccess();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: signed, error } = await supabaseAdmin.storage.from('project-sketches').createSignedUrl(data.path, 60);
    if (error || !signed) throw new Error('Nie udało się otworzyć podglądu.');
    const url = new URL(signed.signedUrl);
    const browserUrl = new URL(import.meta.env['VITE_SUPABASE_URL']);
    url.protocol = browserUrl.protocol; url.host = browserUrl.host;
    return { url: url.toString() };
  });

export const lockSketches = createServerFn({ method: 'POST' }).handler(async () => {
  checkSketchOrigin();
  const session = await sketchSession();
  await session.clear();
  return { ok: true };
});