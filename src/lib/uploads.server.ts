import { createHash } from 'node:crypto';
import { apiUploadSchema, urlImportSchema, safeImportUrl, withinDirectory } from './uploads.validation';
import { MAX_SKETCH_BYTES } from './sketches.validation';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
export class UploadError extends Error { constructor(public status: number, public code: string) { super(code); } }
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export function namedPath(directory: string, name: string) {
 const h = hashToken(name).slice(0,32); const id = `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
 return `${directory ? `${directory}/` : ''}${id}--${Buffer.from(name).toString('base64url')}`;
}
export async function boundedBody(response: Response, limit: number) {
 if (Number(response.headers.get('content-length') ?? 0) > limit) throw new UploadError(413, 'FILE_TOO_LARGE');
 const reader = response.body?.getReader(); if (!reader) throw new UploadError(400, 'EMPTY_BODY');
 const parts: Uint8Array[] = []; let length = 0;
 try { while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > limit) throw new UploadError(413, 'FILE_TOO_LARGE'); parts.push(value); } }
 finally { await reader.cancel().catch(() => {}); }
 const result = new Uint8Array(length); let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; } return result;
}
async function audit(tokenId: string | null, operation: string, status: number, path?: string, size?: number) {
 const { error } = await supabaseAdmin.from('sketch_api_log').insert({ token_id: tokenId, operation, status, path: path ?? null, size: size ?? null });
 if (error) throw new UploadError(503, 'AUDIT_UNAVAILABLE');
}
async function authorize(request: Request) {
 const auth = request.headers.get('authorization') ?? '';
 if (!/^Bearer ki_[A-Za-z0-9_-]{43}$/.test(auth)) throw new UploadError(401, 'UNAUTHORIZED');
 const { data, error } = await supabaseAdmin.rpc('consume_sketch_api_token', { p_hash: hashToken(auth.slice(7)) });
 if (error) throw new UploadError(503, 'AUTH_UNAVAILABLE');
 const token = data?.[0]; if (!token) throw new UploadError(401, 'UNAUTHORIZED');
 if (!token.allowed) { await audit(token.id, 'rate_limit', 429); throw new UploadError(429, 'RATE_LIMITED'); } return token;
}
export async function fetchImport(value: string) {
 let url = safeImportUrl(value);
 // Only GitHub Releases may redirect, and only to the exact GitHub asset host.
 const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30000), headers: { Accept: 'application/octet-stream' } });
 if (response.status >= 300 && response.status < 400) {
  const location = response.headers.get('location'); if (url.hostname !== 'github.com' || !url.pathname.includes('/releases/download/') || !location) throw new UploadError(400, 'REDIRECT_NOT_ALLOWED');
  url = safeImportUrl(new URL(location, url).href); if (url.hostname !== 'release-assets.githubusercontent.com') throw new UploadError(400, 'REDIRECT_NOT_ALLOWED');
  const asset = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  if (!asset.ok) throw new UploadError(400, 'IMPORT_FAILED'); return boundedBody(asset, MAX_SKETCH_BYTES);
 }
 if (!response.ok) throw new UploadError(400, 'IMPORT_FAILED'); return boundedBody(response, MAX_SKETCH_BYTES);
}
export async function handleUpload(request: Request, fromUrl = false) {
 let tokenId: string | null = null; const operation = fromUrl ? 'from-url' : 'upload';
 try {
  const token = await authorize(request); tokenId = token.id;
  let bytes: Uint8Array; let input;
  if (fromUrl) {
   const body = await boundedBody(new Response(request.body, { headers: request.headers }), 8192);
   const parsed = urlImportSchema.parse(JSON.parse(new TextDecoder().decode(body))); input = apiUploadSchema.parse({ ...parsed, size: 0 });
   if (!withinDirectory(input.directory, token.directory)) throw new UploadError(403, 'DIRECTORY_FORBIDDEN');
   bytes = await fetchImport(parsed.url); input = apiUploadSchema.parse({ ...input, size: bytes.length });
  } else {
   const contentType = request.headers.get('content-type') ?? ''; if (!contentType.startsWith('multipart/form-data;')) throw new UploadError(415, 'MULTIPART_REQUIRED');
   const body = await boundedBody(new Response(request.body, { headers: request.headers }), MAX_SKETCH_BYTES + 65536);
   const form = await new Response(body as BodyInit, { headers: { 'content-type': contentType } }).formData();
   const files = form.getAll('file'); const file = files[0]; if (files.length !== 1 || !file || typeof file === 'string') throw new UploadError(400, 'ONE_FILE_REQUIRED');
   if (file.size > MAX_SKETCH_BYTES) throw new UploadError(413, 'FILE_TOO_LARGE');
   const overwrite = form.get('overwrite'); if (overwrite !== null && overwrite !== 'true' && overwrite !== 'false') throw new UploadError(400, 'INVALID_OVERWRITE');
   input = apiUploadSchema.parse({ name: file.name, size: file.size, directory: form.get('directory') ?? 'game-assets', overwrite: overwrite === 'true' });
   if (!withinDirectory(input.directory, token.directory)) throw new UploadError(403, 'DIRECTORY_FORBIDDEN'); bytes = new Uint8Array(await file.arrayBuffer());
  }
  const path = namedPath(input.directory, input.name);
  await audit(tokenId, `${operation}:attempt`, 100, path, bytes.length);
  // octet-stream prevents uploaded HTML/SVG from executing on the storage origin.
  const { error } = await supabaseAdmin.storage.from('project-sketches').upload(path, bytes, { contentType: 'application/octet-stream', upsert: input.overwrite });
  if (error) throw new UploadError(String(error.statusCode) === '409' || error.message.includes('already exists') ? 409 : 503, 'UPLOAD_FAILED_OR_EXISTS');
  const { data: signed, error: signError } = await supabaseAdmin.storage.from('project-sketches').createSignedUrl(path, 60, { download: input.name });
  if (signError || !signed) throw new UploadError(503, 'DOWNLOAD_UNAVAILABLE');
  const url = new URL(signed.signedUrl); const browser = new URL(import.meta.env['VITE_SUPABASE_URL']); url.protocol = browser.protocol; url.host = browser.host;
  await audit(tokenId, operation, 201, path, bytes.length);
  return Response.json({ name: input.name, size: bytes.length, path, downloadUrl: url.href, expiresIn: 60 }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
 } catch (e) {
  const status = e instanceof UploadError ? e.status : 400;
  const code = e instanceof UploadError ? e.code : 'INVALID_REQUEST_OR_URL';
  try { await audit(tokenId, operation, status); } catch { return Response.json({ error: 'AUDIT_UNAVAILABLE' }, { status: 503 }); }
  return Response.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
 }
}
