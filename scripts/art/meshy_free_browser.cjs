/* Export only the anonymous free seamless PNG utility. No paid Meshy API.
 * Usage: node scripts/art/meshy_free_browser.cjs <pack directory>
 * Run free_materials.py inventory first. Resumable; checks source hashes.
 */
const { chromium } = require("playwright");
const sharp = require("sharp");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

async function main() {
  const out = path.resolve(process.argv[2]);
  const repo = path.resolve(__dirname, "../..");
  const manifest = JSON.parse(await fs.readFile(path.join(out, "manifest.json")));
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  let page;
  async function open() {
    if (page) await page.close();
    page = await browser.newPage({
      viewport: { width: 1200, height: 1000 },
      acceptDownloads: true,
    });
    await page.route("https://api.meshy.ai/**", (route) => route.abort());
    await page.goto("https://www.meshy.ai/3d-tools/seamless-texture-generator", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page
      .getByText("Drag and drop file here or click to upload", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(10000); // Public page renders the uploader before React hydration.
  }
  try {
    for (const entry of manifest.materials.filter((e) => e.tileCandidate)) {
      const folder = path.join(out, entry.id);
      await fs.mkdir(folder, { recursive: true });
      const target = path.join(folder, "base-color.webp");
      const proof = path.join(folder, "browser-export.json");
      const input = path.join(repo, entry.sources[0]);
      if (
        crypto
          .createHash("sha256")
          .update(await fs.readFile(input))
          .digest("hex") !== entry.sourceSha256
      )
        throw new Error("Source hash changed: " + input);
      try {
        const metadata = JSON.parse(await fs.readFile(proof));
        const digest = crypto
          .createHash("sha256")
          .update(await fs.readFile(target))
          .digest("hex");
        if (metadata.sourceSha256 === entry.sourceSha256 && metadata.outputSha256 === digest) {
          console.log("CACHED", entry.id);
          continue;
        }
      } catch {}
      let completed = false;
      for (let attempt = 0; attempt < 3 && !completed; attempt++) {
        try {
          if (!page || attempt) await open();
          const reset = page.getByRole("button", { name: "Use another image", exact: true });
          if (await reset.count()) await reset.click();
          await page.locator("input[type=file]").setInputFiles(input);
          const button = page.getByRole("button", { name: "Download seamless PNG", exact: true });
          await button.waitFor({ timeout: 20000 });
          const pending = page.waitForEvent("download", { timeout: 20000 });
          await button.click();
          const download = await pending;
          const downloaded = await download.path();
          const bytes = await fs.readFile(downloaded);
          const metadata = await sharp(bytes).metadata();
          if (metadata.width !== entry.width || metadata.height !== entry.height)
            throw new Error("Unexpected download dimensions");
          await sharp(bytes).removeAlpha().webp({ lossless: true, effort: 6 }).toFile(target);
          await fs.writeFile(
            proof,
            JSON.stringify(
              {
                url: page.url(),
                sourceSha256: entry.sourceSha256,
                pngSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
                outputSha256: crypto
                  .createHash("sha256")
                  .update(await fs.readFile(target))
                  .digest("hex"),
                downloadName: download.suggestedFilename(),
                method: "Free anonymous PNG export; 50% default blend; lossless WebP transcode",
                date: new Date().toISOString(),
                paidApiUsed: false,
              },
              null,
              2,
            ) + "\n",
          );
          await download.delete();
          console.log("EXPORTED", entry.id, metadata.width, metadata.height);
          completed = true;
        } catch (error) {
          console.log("RETRY", entry.id, attempt + 1, error.message.slice(0, 160));
        }
      }
      if (!completed) throw new Error("Export failed: " + entry.id);
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
