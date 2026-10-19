import { z } from 'zod';
import { uploadSketchSchema } from './sketches.validation';
export const GAME_FOLDERS = ['game-assets', ...['worlds/forest','worlds/volcano','worlds/ice','worlds/desert','races','enemies','buildings','props','ui','concepts','archives'].map(p => `game-assets/${p}`)];
export const directorySchema = z.string().max(200).regex(/^game-assets(?:\/[a-zA-Z0-9_-]{1,60})*$/);
export const apiUploadSchema = uploadSketchSchema.extend({ directory: directorySchema.default('game-assets'), overwrite: z.boolean().default(false) });
export const urlImportSchema = z.object({ url: z.string().url().max(2048), name: uploadSketchSchema.shape.name, directory: directorySchema.default('game-assets'), overwrite: z.boolean().default(false) });
export const IMPORT_HOSTS = ['github.com', 'release-assets.githubusercontent.com', 'raw.githubusercontent.com', 'objects.githubusercontent.com'];
export function safeImportUrl(value: string) {
 const url = new URL(value);
 if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !IMPORT_HOSTS.includes(url.hostname)) throw new Error('URL_NOT_ALLOWED');
 return url;
}
export function withinDirectory(path: string, scope: string) { return path === scope || path.startsWith(`${scope}/`); }
