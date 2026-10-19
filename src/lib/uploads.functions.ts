import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { checkSketchOrigin, requireSketchAccess } from './sketches.server';
import { directorySchema } from './uploads.validation';
export const getUploadIntegration = createServerFn({ method: 'GET' }).handler(async () => {
 await requireSketchAccess(); const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
 const [tokens, logs] = await Promise.all([supabaseAdmin.from('sketch_api_tokens').select('id,directory,created_at,revoked_at').is('revoked_at', null), supabaseAdmin.from('sketch_api_log').select('id,operation,status,path,size,created_at').order('created_at', { ascending: false }).limit(30)]);
 if (tokens.error || logs.error) throw new Error('Nie udało się odczytać integracji.'); return { tokens: tokens.data, logs: logs.data };
});
export const rotateUploadToken = createServerFn({ method: 'POST' }).inputValidator((v: unknown) => z.object({ directory: directorySchema }).parse(v)).handler(async ({ data }) => {
 checkSketchOrigin(); await requireSketchAccess(); const { randomBytes } = await import('node:crypto'); const { hashToken } = await import('./uploads.server'); const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
 const token = `ki_${randomBytes(32).toString('base64url')}`;
 const { error } = await supabaseAdmin.rpc('rotate_sketch_api_token', { p_hash: hashToken(token), p_directory: data.directory }); if (error) throw new Error('Nie udało się wygenerować tokenu.');
 return { token };
});
export const revokeUploadTokens = createServerFn({ method: 'POST' }).handler(async () => {
 checkSketchOrigin(); await requireSketchAccess(); const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
 const { error } = await supabaseAdmin.from('sketch_api_tokens').update({ revoked_at: new Date().toISOString() }).is('revoked_at', null); if (error) throw new Error('Nie udało się unieważnić tokenu.'); return { ok: true };
});
