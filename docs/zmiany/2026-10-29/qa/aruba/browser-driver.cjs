const { createRequire } = require("node:module");
const req = createRequire("/workspace/ki-aruba/package.json");
const { chromium } = req("@playwright/test");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of ["/", "/mapa", "/konto", "/admin", "/test"]) {
    const r = await page.goto("http://127.0.0.1:4311" + route, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    console.log(
      JSON.stringify({
        route,
        status: r.status(),
        title: await page.title(),
        text: (await page.locator("body").innerText()).slice(0, 120),
      }),
    );
    await page.screenshot({
      path:
        "/workspace/ki-aruba/docs/zmiany/2026-10-29/qa/aruba/page-" +
        (route.slice(1) || "home") +
        ".png",
    });
  }
  console.log(JSON.stringify({ pageErrors: errors }));
  await browser.close();
  if (errors.length) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
