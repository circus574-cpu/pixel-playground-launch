import { checkActiveAssets } from "./lib/gpu-import.ts";
try {
  console.log(
    JSON.stringify(
      {
        production: await checkActiveAssets(),
        preview: await checkActiveAssets(process.cwd(), true),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
