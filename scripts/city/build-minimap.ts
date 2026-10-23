import { mkdir, writeFile } from "node:fs/promises";
import { CITY_OBJECTS, VERDANT_CITY } from "../../src/game/city/verdantia";
import { FOREST } from "../../src/game/world/forest";
// Original geometric cartography from runtime geometry. No raster source/reference images.
let body = '<rect width="3072" height="2048" fill="#3d6743"/>';
for (const r of FOREST.riverRows)
  body += `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="#67a9a7"/>`;
for (const r of VERDANT_CITY.roads)
  body += `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="28" fill="#c0b287" stroke="#a6976a" stroke-width="8"/>`;
for (const o of CITY_OBJECTS) {
  if (["oak", "fir", "bush"].includes(o.kind))
    body += `<ellipse cx="${o.x}" cy="${o.y - o.height * 0.28}" rx="${o.width * 0.34}" ry="${o.height * 0.31}" fill="${o.kind === "fir" ? "#264c3a" : "#547c48"}" stroke="#264f39" stroke-width="5"/>`;
  else if (o.id.startsWith("city-")) {
    const x = o.x - o.width * 0.4,
      y = o.y - o.height * 0.65,
      w = o.width * 0.8,
      h = o.height * 0.6;
    body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="15" fill="#d0c492" stroke="#3b4432" stroke-width="16"/><path d="M${x - 15} ${y + 50}L${o.x} ${y - 55}L${x + w + 15} ${y + 50}Z" fill="#82704b" stroke="#3b4432" stroke-width="12"/>`;
  } else if (o.kind === "fountain")
    body += `<ellipse cx="${o.x}" cy="${o.y}" rx="85" ry="62" fill="#79beb5" stroke="#d0c492" stroke-width="24"/>`;
  else if (o.kind === "bridge")
    body += `<rect x="${o.x - o.width / 2}" y="${o.y - o.height / 2}" width="${o.width}" height="${o.height}" fill="#a99e81"/>`;
}
for (const b of VERDANT_CITY.buildings)
  body += `<circle cx="${b.door.x}" cy="${b.door.y}" r="25" fill="#f1d783" stroke="#243f2c" stroke-width="8"/>`;
await mkdir("public/game/assets/city-verdant-v1", { recursive: true });
await writeFile(
  "public/game/assets/city-verdant-v1/minimap.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="512" viewBox="0 0 3072 2048">${body}</svg>\n`,
);
