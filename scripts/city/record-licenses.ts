import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import imported from "../../src/game/assets/imported.json" with { type: "json" };
const pack = imported.find((p) => p.id === "city-interiors")!;
const dir = "deliveries/city-interiors-1.0.0";
const runtime = pack.assets.map((a) => "public" + a.url);
const files = [
  ...(await readdir(dir)).map((n) => dir + "/" + n),
  ...runtime,
  "public/game/assets/city-verdant-v1/minimap.svg",
  ...["build-interior-art.py", "build-interior-art.ts", "build-minimap.ts"].map(
    (n) => "scripts/city/" + n,
  ),
];
const records = [];
for (const path of files) {
  const bytes = await readFile(path);
  records.push({
    path,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    author: "Codex / OpenAI; original programmatic vector drawing and cartography",
    generator: path.includes("minimap")
      ? "scripts/city/build-minimap.ts"
      : "scripts/city/build-interior-art.py; Sharp rasterization/export; validated GPU asset importer",
    source:
      "Original source code in this branch; no reference image or external checkpoint used for these new illustrations.",
    license: "No separate asset license or independent legal clearance asserted.",
    commercialUseBasis:
      "Original programmatic contribution documented by source and reproducible export; owner must confirm applicable rights/terms. This record does not declare blanket commercial clearance.",
    evidence: [
      "source code and committed history",
      "SHA-256 of this file",
      "docs/zmiany/2026-10-23/qa/verdantia-city-20261023/asset-import.txt",
    ],
    status: "SOURCE_AND_PROCESS_DOCUMENTED; LEGAL_REVIEW_NOT_PERFORMED",
  });
}
await writeFile(
  "docs/licenses/city-assets-20261023.json",
  JSON.stringify(
    {
      date: "2026-10-23",
      scope:
        "New city utility illustrations only. Existing forest, exterior building and character artwork retains unresolved rights recorded in LICENCJE.md.",
      renderer:
        "SVG authored as code; Sharp exports lossless WebP; no image-generation model or rented GPU used.",
      records,
    },
    null,
    2,
  ) + "\n",
);
