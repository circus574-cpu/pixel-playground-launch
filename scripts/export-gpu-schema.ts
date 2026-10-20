import { frameLayout } from "./lib/frame-layout.ts";
import { writeFile } from "node:fs/promises";
import { zodToJsonSchema } from "zod-to-json-schema";
import { PackSchema } from "../src/game/assets/schema.ts";
const schema = zodToJsonSchema(PackSchema, { name: "KiLegendsGpuPack", target: "jsonSchema7" });
await writeFile("art/pipeline/gpu-pack.schema.json", JSON.stringify(schema, null, 2) + "\n");
console.log("Exported JSON schema from the same validator used by the importer.");

await writeFile(
  "art/pipeline/examples/hero-production.template.json",
  JSON.stringify(frameLayout("hero-planetary", "verdant").pack, null, 2) + "\n",
);
