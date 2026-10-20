import { checkActiveAssets } from "./lib/gpu-import.ts";
try {
  console.log(JSON.stringify(await checkActiveAssets(), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
