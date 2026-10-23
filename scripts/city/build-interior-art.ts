import { execFileSync } from "node:child_process";
import sharp from "sharp";
execFileSync("python3", ["scripts/city/build-interior-art.py"]);
for (const name of ["props", "floor", "stone"]) {
  const root = "deliveries/city-interiors-1.0.0/" + name;
  await sharp(root + ".svg")
    .webp({ lossless: true })
    .toFile(root + ".webp");
}
