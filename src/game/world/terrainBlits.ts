/** Read-only projection of the four indexed layers into world-aligned cached chunks. */
export type TerrainBounds = { x: number; y: number; width: number; height: number };
export const TERRAIN_CHUNK_SIDE = 1024;
export function terrainCacheBytes(width: number, height: number) {
  return width * height * 4;
}
export function* terrainBlits(
  layers: readonly (readonly (readonly number[])[])[],
  tileSize: number,
  bounds: TerrainBounds,
  atlasWidth: number,
) {
  const columns = Math.floor(atlasWidth / 68);
  for (const [layer, data] of layers.entries())
    for (
      let row = Math.floor(bounds.y / tileSize);
      row < Math.ceil((bounds.y + bounds.height) / tileSize);
      row++
    )
      for (
        let col = Math.floor(bounds.x / tileSize);
        col < Math.ceil((bounds.x + bounds.width) / tileSize);
        col++
      ) {
        const tile = data[row]?.[col];
        if (tile === undefined || tile < 0) continue;
        yield {
          layer,
          tile,
          sx: 2 + (tile % columns) * 68,
          sy: 2 + Math.floor(tile / columns) * 68,
          dx: col * tileSize - bounds.x,
          dy: row * tileSize - bounds.y,
        };
      }
}
