import { packFrames } from "./lib/pack-frames.ts";
const [source, output, ...args] = process.argv.slice(2),
  options = Object.fromEntries(args.map((a) => a.replace(/^--/, "").split("=")));
if (!source || !output) {
  console.error(
    "Usage: npm run assets:pack -- renders/hero output/hero --id=hero-planetary --world=verdant [--profile=hero|enemy|npc] [--version=1.0.0]",
  );
  process.exitCode = 1;
} else
  try {
    const profile = options["profile"] ?? "hero";
    if (!["hero", "enemy", "npc"].includes(profile)) throw Error("Invalid actor profile");
    console.log(
      JSON.stringify(
        await packFrames(
          source,
          output,
          options["id"] ?? "hero-planetary",
          options["world"] ?? "verdant",
          profile as "hero" | "enemy" | "npc",
          options["version"] ?? "1.0.0",
        ),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
