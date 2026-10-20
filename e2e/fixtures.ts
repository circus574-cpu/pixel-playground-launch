import { test as base } from "@playwright/test";
export { expect } from "@playwright/test";
export type { Page, CDPSession } from "@playwright/test";
/** Attach failures without modifying the game or assuming a browser failure proves a game bug. */
export const test = base.extend<{ diagnostics: void }>({
  diagnostics: [
    async ({ page }, use, info) => {
      const logs: string[] = [];
      page.on("console", (m) => {
        if (["error", "warning"].includes(m.type())) logs.push(m.type() + ": " + m.text());
      });
      page.on("pageerror", (error) => logs.push("pageerror: " + error.message));
      await use();
      if (info.status !== info.expectedStatus) {
        const observed = await page
          .evaluate(() => {
            const el = document.querySelector<HTMLElement>(".ki-canvas");
            return {
              url: location.href,
              viewport: [innerWidth, innerHeight],
              canvas: el ? { ...el.dataset } : null,
            };
          })
          .catch(() => null);
        await info.attach("game-failure-context", {
          body: JSON.stringify(
            {
              test: info.title,
              expected: info.expectedStatus,
              actual: info.status,
              errors: info.errors,
              observed,
              logs,
            },
            null,
            2,
          ),
          contentType: "application/json",
        });
        if (!page.isClosed())
          await info.attach("game-failure-screenshot", {
            body: await page.screenshot().catch(() => Buffer.alloc(0)),
            contentType: "image/png",
          });
      }
    },
    { auto: true },
  ],
});
