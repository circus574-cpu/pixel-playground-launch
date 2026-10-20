import { importPackage } from "./lib/gpu-import.ts";
const args = process.argv.slice(2),
  manifest = args.find((a) => !a.startsWith("--"));
if (!manifest) {
  console.error("Usage: npm run assets:import -- package/manifest.json [--install] [--replace]");
  process.exitCode = 1;
} else
  try {
    console.log(
      JSON.stringify(
        await importPackage(manifest, {
          install: args.includes("--install"),
          replace: args.includes("--replace"),
        }),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
