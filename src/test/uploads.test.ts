// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiUploadSchema, directorySchema, safeImportUrl, withinDirectory } from '@/lib/uploads.validation';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), log: vi.fn(), sign: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mock.rpc, from: () => ({ insert: mock.log }), storage: { from: () => ({ upload: mock.upload, createSignedUrl: mock.sign }) } } }));
import { handleUpload, boundedBody, fetchImport } from '@/lib/uploads.server';
const headers = { Authorization: `Bearer ki_${'a'.repeat(43)}` };
function request(name: string, dir = 'game-assets', overwrite = false) { const f = new FormData(); f.append('file',new Blob(['asset']),name); f.append('directory',dir); f.append('overwrite', String(overwrite)); return new Request('https://kilegends.pl/api/public/uploads',{method:'POST',headers,body:f}); }
beforeEach(() => { vi.restoreAllMocks(); mock.rpc.mockResolvedValue({data:[{id:'test',directory:'game-assets',allowed:true}]}); mock.upload.mockResolvedValue({error:null}); mock.log.mockResolvedValue({error:null}); mock.sign.mockResolvedValue({data:{signedUrl:'https://example.com/file'},error:null}); });
describe('Upload rules',()=> {
 it('accepts exactly 50 MiB, rejects one byte over',()=> { expect(apiUploadSchema.safeParse({name:'f.bin',size:52428800}).success).toBe(true); expect(apiUploadSchema.safeParse({name:'f.bin',size:52428801}).success).toBe(false); });
 it.each(['game-assets/../secret','/tmp','game-assets2','game-assets/%2e%2e'])('rejects unsafe directory %s',v=>expect(directorySchema.safeParse(v).success).toBe(false));
 it('scopes token to directory boundary',()=>{expect(withinDirectory('game-assets/races/orc','game-assets/races')).toBe(true);expect(withinDirectory('game-assets/races2','game-assets/races')).toBe(false);});
 it.each(['https://127.0.0.1/a','https://169.254.169.254/latest','https://localhost/a','https://10.0.0.1/a','https://[::1]/a','http://github.com/a','https://github.com.evil.test/a','https://user:pass@github.com/a','https://example.com/a'])('blocks SSRF URL %s',v=>expect(()=>safeImportUrl(v)).toThrow());
 it('accepts HTTPS public GitHub asset',()=>expect(safeImportUrl('https://raw.githubusercontent.com/a/b/main/file').hostname).toBe('raw.githubusercontent.com'));
});
describe('Endpoint behavior',()=>{
 it.each(['texture.png','assets.zip','data.json'])('uploads %s privately',async name=>{const r=await handleUpload(request(name));expect(r.status).toBe(201);expect((await r.json()).name).toBe(name);expect(mock.upload.mock.calls.at(-1)?.[2].upsert).toBe(false);});
 it('supports different directories',async()=>{await handleUpload(request('a.png','game-assets/worlds/forest'));await handleUpload(request('b.zip','game-assets/archives'));expect(mock.upload.mock.calls.at(-2)?.[0]).toContain('worlds/forest/');expect(mock.upload.mock.calls.at(-1)?.[0]).toContain('archives/');});
 it('rejects unauthenticated request',async()=>{const r=await handleUpload(new Request('https://kilegends.pl/api/uploads',{method:'POST'}));expect(r.status).toBe(401);});
 it('rejects revoked token',async()=>{mock.rpc.mockResolvedValue({data:[]});expect((await handleUpload(request('x'))).status).toBe(401);});
 it('enforces 20 requests per minute via atomic gate',async()=>{mock.rpc.mockResolvedValue({data:[{id:'test',directory:'game-assets',allowed:false}]});expect((await handleUpload(request('x'))).status).toBe(429);});
 it('rejects file over limit before consuming body',async()=>{const req=new Request('https://kilegends.pl/api/uploads',{method:'POST',headers:{...headers,'content-type':'multipart/form-data; boundary=x','content-length':'52494337'},body:'x'});expect((await handleUpload(req)).status).toBe(413);});
 it('rejects duplicate unless overwrite explicitly true',async()=>{mock.upload.mockResolvedValueOnce({error:{statusCode:'409',message:'already exists'}});expect((await handleUpload(request('x'))).status).toBe(409);expect((await handleUpload(request('x','game-assets',true))).status).toBe(201);expect(mock.upload.mock.calls.at(-1)?.[2].upsert).toBe(true);});
 it('blocks directory outside token scope',async()=>{mock.rpc.mockResolvedValue({data:[{id:'test',directory:'game-assets/ui',allowed:true}]});expect((await handleUpload(request('x','game-assets/races'))).status).toBe(403);});
 it('imports public URL with bounded fetch',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('public asset'));const req=new Request('https://kilegends.pl/api/uploads/from-url',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({url:'https://raw.githubusercontent.com/a/b/main/file',name:'file.txt'})});expect((await handleUpload(req,true)).status).toBe(201);});
 it('rejects oversized streamed remote body',async()=>{await expect(boundedBody(new Response('12345'),4)).rejects.toThrow('FILE_TOO_LARGE');});
 it('rejects forbidden redirects',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:302,headers:{location:'https://127.0.0.1/file'}}));await expect(fetchImport('https://github.com/a/b/releases/download/v1/file')).rejects.toThrow();});
});
