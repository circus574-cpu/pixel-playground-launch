import type Phaser from "phaser";
/** New art fits its authored canvas; legacy art retains its accepted dimensions. */
export function scenerySize(
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  fit?: "contain" | "stretch",
): [number, number] {
  if (fit !== "contain") return [width, height];
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  return [sourceWidth * scale, sourceHeight * scale];
}
export function sizeScenery(
  image: Phaser.GameObjects.Image,
  width: number,
  height: number,
  fit?: "contain" | "stretch",
) {
  return image.setDisplaySize(...scenerySize(image.width, image.height, width, height, fit));
}
export function sizeTile(image: Phaser.GameObjects.TileSprite, tileSize?: [number, number]) {
  if (tileSize)
    image.setTileScale(tileSize[0] / image.frame.realWidth, tileSize[1] / image.frame.realHeight);
  return image;
}
