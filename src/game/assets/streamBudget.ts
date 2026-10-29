/** HD heroes occupy 50 MiB before scenery/creatures. Both supported world revisions use the
 * production-v2 ceiling; the old 128 MiB ceiling silently prevented v1 creature acquisition. */
export const STREAM_TEXTURE_BUDGET_BYTES = 192 * 1024 * 1024;
export const STREAM_RESERVED_BYTES = 20 * 1024 * 1024;
export function streamTextureBytes(
  ids: Iterable<string>,
  assets: ReadonlyMap<string, { width?: number | undefined; height?: number | undefined }>,
): number {
  let bytes = STREAM_RESERVED_BYTES;
  for (const id of new Set(ids)) {
    const asset = assets.get(id);
    bytes += (asset?.width ?? 512) * (asset?.height ?? 512) * 4;
  }
  return bytes;
}
