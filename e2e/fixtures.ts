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

/** Mobile tools are deliberately folded; follow the same taps as a player. */
export async function openHudTool(
  page: import("@playwright/test").Page,
  name: string,
  input: "mouse" | "touch" = "mouse",
) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.isVisible())) {
    const menu = page.getByRole("button", { name: "Menu gry", exact: true });
    if (input === "touch") await menu.tap();
    else await menu.click();
  }
  if (input === "touch") await button.tap();
  else await button.click();
  const toggle = page.getByRole("button", { name: "Menu gry", exact: true });
  if (
    (name === "Oddal mapę" || name === "Przybliż mapę") &&
    (await toggle.isVisible()) &&
    (await toggle.getAttribute("aria-expanded")) === "true"
  )
    await toggle.click();
}
