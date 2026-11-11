import { test, expect, openHudTool, type Page } from "./fixtures";

test.use({ actionTimeout: 15_000 });

async function owner(page: Page) {
  return page.evaluate(() => {
    for (const [key, value] of Object.entries(localStorage)) {
      if (key.includes("recovery")) continue;
      try {
        const save = JSON.parse(value);
        if (save.format === "superior-character") return save.player;
      } catch {
        /* A different browser preference. */
      }
    }
    throw new Error("No active Superior character save");
  });
}

test.describe("touch racial trial", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("Androidy: portrait guard, touch navigation and module construction", async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/scripts/playtest.html?ki-world-v2=1");
    await page.getByRole("button", { name: "Wybierz: Androidy", exact: true }).tap();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).tap();
    await expect(page.getByText("Obróć telefon poziomo", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 852, height: 393 });
    const canvas = page.locator(".ki-canvas").first();
    await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
    await openHudTool(page, "Umiejętności", "touch");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).tap();
    await page.getByRole("button", { name: "Podejdź do trenera", exact: true }).tap();
    await expect(canvas).toHaveAttribute("data-interior", "arena");
    await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).tap();
    const before = await owner(page);
    await openHudTool(page, "Umiejętności", "touch");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).tap();
    await page.getByRole("tab", { name: "Próby", exact: true }).tap();
    const card = page.locator(".ki-development-card").filter({
      has: page.getByRole("heading", { name: /^TN08 ·/ }),
    });
    await card.getByRole("button", { name: "Instrukcja · 1", exact: true }).tap();
    await page.getByRole("button", { name: "Rozpocznij próbę rasową", exact: true }).tap();
    const stage = page.locator(".ki-trial-stage");
    await expect(stage.locator(".ki-canvas")).toHaveAttribute("data-player-x", /^\d/);
    await expect(stage.locator('[data-ability="R"]')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(stage.getByText("Obróć telefon poziomo", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("touch-portrait-trial-guard.png") });
    await page.setViewportSize({ width: 852, height: 393 });
    await expect(stage.getByText("Obróć telefon poziomo", { exact: true })).not.toBeVisible();
    await walkToStation(page, true);
    await stage.getByRole("button", { name: "Zbadaj stanowisko", exact: true }).tap();
    const materials = page.getByRole("dialog", { name: "Materiały próby", exact: true });
    await materials.getByRole("checkbox", { name: "Skaner · 2 energii", exact: true }).tap();
    await materials.getByRole("checkbox", { name: "Precyzja · 3 energii", exact: true }).tap();
    await page.screenshot({ path: info.outputPath("touch-modules.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await materials.getByRole("button", { name: "Sprawdź konstrukcję", exact: true }).tap();
    const result = page.getByRole("dialog", { name: "Wynik próby rasowej", exact: true });
    await expect(result).toContainText("Próba ukończona");
    await page.screenshot({ path: info.outputPath("touch-trial-passed.png") });
    await result.getByRole("button", { name: "Zatwierdź wynik i wróć", exact: true }).tap();
    await expect(stage).toHaveCount(0);
    const after = await owner(page);
    expect(after.development.trials.TN08).toBe(1);
    expect(after.development.practiceEarned - (before.development?.practiceEarned ?? 0)).toBe(100);
    await page.reload();
    await expect(canvas).toHaveAttribute("data-interior", "arena");
    expect((await owner(page)).development.trials.TN08).toBe(1);
    expect(errors).toEqual([]);
  });
});

async function walkToStation(
  page: Page,
  touch: boolean,
  target?: { x: number; y: number },
  waitForArrival = true,
) {
  const stage = page.locator(".ki-trial-stage");
  const x = target?.x ?? Number(await stage.getAttribute("data-trial-x"));
  const y = target?.y ?? Number(await stage.getAttribute("data-trial-y"));
  const canvas = stage.locator(".ki-canvas");
  const point = await canvas.evaluate(
    (el, target) => {
      const node = el as HTMLElement,
        b = node.getBoundingClientRect();
      const zoom = Number(node.dataset["cameraZoom"]);
      return {
        x: b.x + (target.x - Number(node.dataset["cameraX"]) - b.width / 2) * zoom + b.width / 2,
        y: b.y + (target.y - Number(node.dataset["cameraY"]) - b.height / 2) * zoom + b.height / 2,
      };
    },
    { x, y },
  );
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  if (!waitForArrival) return;
  await expect
    .poll(async () =>
      Math.hypot(
        Number(await canvas.getAttribute("data-player-x")) - x,
        Number(await canvas.getAttribute("data-player-y")) - y,
      ),
    )
    .toBeLessThan(65);
}

for (const [race, id, land] of [
  ["Planetarni", "TV07", "verdant"],
  ["Planetarni", "TV08", "verdant"],
  ["Planetarni", "TV09", "verdant"],
  ["Planetarni", "TV10", "verdant"],
  ["Planetarni", "TV01", "verdant"],
  ["Planetarni", "TV02", "verdant"],
  ["Planetarni", "TV03", "verdant"],
  ["Planetarni", "TV04", "verdant"],
  ["Planetarni", "TV05", "verdant"],
  ["Planetarni", "TV06", "verdant"],
  ["Mędrcy", "TA07", "aether"],
  ["Mędrcy", "TA08", "aether"],
  ["Mędrcy", "TA09", "aether"],
  ["Mędrcy", "TA04", "aether"],
  ["Mędrcy", "TA05", "aether"],
  ["Mędrcy", "TA06", "aether"],
  ["Mędrcy", "TA10", "aether"],
  ["Mędrcy", "TA11", "aether"],
  ["Mędrcy", "TA12", "aether"],
  ["Mędrcy", "TA01", "aether"],
  ["Androidy", "TN08", "nexus"],
  ["Legendy", "TP08", "pyra"],
] as const) {
  test(`${race}: real ${id}, one-time reward and reload`, async ({ page }, info) => {
    // A complete new-memory scenario includes two real continent loads plus the loan room.
    // SwiftShader uploads are slow on CPU-only runners; keep all state/renderer assertions.
    if (["TA10", "TA11", "TA12"].includes(id)) test.setTimeout(300000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/scripts/playtest.html?ki-world-v2=1");
    await page.getByRole("button", { name: `Wybierz: ${race}`, exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij przygodę", exact: true }).click();
    const canvas = page.locator(".ki-canvas").first();
    await expect(canvas).toHaveAttribute("data-player-x", /^\d/);
    await expect(page.locator(".ki-loading-screen")).toHaveCount(0);
    if (info.project.name === "software-webgl")
      await expect(page.getByRole("button", { name: "Umiejętności", exact: true })).toBeVisible();
    await openHudTool(page, "Umiejętności");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).click();
    await page.getByRole("button", { name: "Podejdź do trenera", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-interior", "arena");
    await page.getByRole("button", { name: "Zamknij rozmowę", exact: true }).click();
    const before = await owner(page);
    await openHudTool(page, "Umiejętności");
    await page.getByRole("button", { name: "Rozwój · trening i wiedza", exact: true }).click();
    await page.getByRole("tab", { name: "Próby", exact: true }).click();
    const card = page.locator(".ki-development-card").filter({
      has: page.getByRole("heading", { name: new RegExp(`^${id} ·`) }),
    });
    await card.getByRole("button", { name: "Instrukcja · 1", exact: true }).click();
    await page.getByRole("button", { name: "Rozpocznij próbę rasową", exact: true }).click();
    const stage = page.locator(".ki-trial-stage");
    await expect(stage.locator(".ki-canvas")).toHaveAttribute("data-player-x", /^\d/);
    await expect(stage.locator('[data-ability="R"]')).toBeVisible();
    await expect
      .poll(async () => {
        const metrics = await stage.locator(".ki-canvas").getAttribute("data-metrics");
        return metrics ? JSON.parse(metrics).renderer : null;
      })
      .toBe(info.project.name === "software-webgl" ? "WebGL" : "Canvas");
    if (id === "TA07") {
      for (let i = 0; i < 2; i++) {
        await walkToStation(page, false);
        await expect(stage).toHaveAttribute("data-focus-phase", "ready");
        const skill = stage.locator('[data-ability="C1"]');
        await expect(skill).toBeEnabled();
        await skill.click();
        await expect(stage).toHaveAttribute("data-focus-phase", "channel");
        if (i === 0) await page.screenshot({ path: info.outputPath("focus-channel-c1.png") });
        await expect(stage).toHaveAttribute("data-trial-successes", String(i + 1));
      }
    } else if (id === "TA08") {
      for (let i = 0; i < 3; i++) {
        await walkToStation(page, false);
        await stage.getByRole("button", { name: "Zbadaj stanowisko", exact: true }).click();
        const materials = page.getByRole("dialog", { name: "Materiały próby", exact: true });
        await expect(materials).toContainText("Regeneracja nie odnawia");
        if (i === 0) await page.screenshot({ path: info.outputPath("focus-ki-budget.png") });
        await materials.getByRole("button", { name: /^Precyzyjny przepływ/ }).click();
        await expect(stage).toHaveAttribute("data-trial-successes", String(i + 1));
      }
      expect(Number(await stage.getAttribute("data-focus-spent"))).toBeLessThanOrEqual(
        Number(await stage.getAttribute("data-focus-budget")),
      );
    } else if (id === "TA09") {
      const result = page.getByRole("dialog", { name: "Wynik próby rasowej", exact: true });
      let previous = "";
      for (let i = 0; i < 1000 && !(await result.count()); i++) {
        const d = await stage.evaluate((el) => ({ ...el.dataset }));
        if (d["trialX"] !== undefined && d["trialY"] !== undefined) {
          const key = `${d["trialX"]},${d["trialY"]}`;
          if (key !== previous) {
            previous = key;
            // Timed success can stop the actor between nodes. Do not require arrival after victory.
            // The controller and final assertions still require all nodes and the full duration.
            await walkToStation(page, false, undefined, false);
            if (i === 0) await page.screenshot({ path: info.outputPath("focus-active-nodes.png") });
          }
        }
        await page.waitForTimeout(100);
      }
      expect(Number(await stage.getAttribute("data-focus-remaining"))).toBe(0);
    } else if (id === "TA04" || id === "TA06") {
      const result = page.getByRole("dialog", { name: "Wynik próby rasowej", exact: true });
      let previous = "";
      for (let i = 0; i < 1500 && !(await result.count()); i++) {
        const d = await stage.evaluate((el) => ({ ...el.dataset }));
        if (
          d["barrierPhase"] === "warning" &&
          d["trialX"] !== undefined &&
          d["trialY"] !== undefined
        ) {
          const point = { x: Number(d["trialX"]), y: Number(d["trialY"]) };
          const key = `${point.x},${point.y}`;
          if (previous !== key) {
            previous = key;
            await walkToStation(page, false, point);
            if (id === "TA04") {
              await stage.locator('[data-ability="B1"]').click();
              await page.screenshot({ path: info.outputPath("aether-barrier-active.png") });
            }
          }
        }
        await page.waitForTimeout(50);
      }
      if (id === "TA04")
        expect(Number(await stage.getAttribute("data-object-hp"))).toBeGreaterThanOrEqual(50);
    } else if (id === "TV09") {
      let previous = "";
      const result = page.getByRole("dialog", { name: "Wynik próby rasowej", exact: true });
      for (let i = 0; i < 800 && !(await result.count()); i++) {
        const point = await stage.evaluate((el) => {
          const trialX = el.dataset["trialX"],
            trialY = el.dataset["trialY"];
          return trialX === undefined || trialY === undefined
            ? null
            : { x: Number(trialX), y: Number(trialY) };
        });
        // The result removes the objective. Do not turn absent coordinates into (0, 0).
        if (!point) break;
        const key = `${point.x},${point.y}`;
        if (key !== previous) {
          previous = key;
          await walkToStation(page, false, point);
          await expect(stage).toHaveAttribute("data-camp-guarded", "true");
        }
        await page.waitForTimeout(100);
      }
      expect(Number(await stage.getAttribute("data-camp-remaining"))).toBe(0);
      expect(Number(await stage.getAttribute("data-trial-successes"))).toBe(2);
    } else if (id === "TV01") {
      for (let i = 0; i < 4; i++) {
        await walkToStation(page, false);
        await expect
          .poll(async () => Number(await stage.getAttribute("data-trial-successes")))
          .toBe(i + 1);
      }
    } else if (id === "TV03") {
      let last = -1,
        leading = true;
      for (
        let i = 0;
        i < 500 &&
        !(await page.getByRole("dialog", { name: "Wynik próby rasowej", exact: true }).count());
        i++
      ) {
        const d = await stage.evaluate((el) => ({ ...el.dataset }));
        const canvas = stage.locator(".ki-canvas");
        const p = await canvas.evaluate((el) => ({ ...el.dataset }));
        const npc = { x: Number(d["companionX"]), y: Number(d["companionY"]) },
          player = { x: Number(p["playerX"]), y: Number(p["playerY"]) };
        const progress = Number(d["trialSuccesses"]);
        let target: { x: number; y: number } | null = null;
        if (progress !== last) {
          last = progress;
          leading = true;
          target = { x: Number(d["trialX"]), y: Number(d["trialY"]) };
        }
        const gap = Math.hypot(npc.x - player.x, npc.y - player.y);
        if (leading && gap > 190) {
          leading = false;
          target = npc;
        } else if (!leading && gap < 90) {
          leading = true;
          target = { x: Number(d["trialX"]), y: Number(d["trialY"]) };
        }
        if (target) {
          const at = await canvas.evaluate((el, t) => {
            const d = (el as HTMLElement).dataset,
              b = el.getBoundingClientRect(),
              z = Number(d["cameraZoom"]);
            return {
              x: b.x + (t.x - Number(d["cameraX"]) - b.width / 2) * z + b.width / 2,
              y: b.y + (t.y - Number(d["cameraY"]) - b.height / 2) * z + b.height / 2,
            };
          }, target);
          await page.mouse.click(at.x, at.y);
        }
        await page.waitForTimeout(100);
      }
      expect(Number(await stage.getAttribute("data-companion-hp"))).toBeGreaterThanOrEqual(50);
    } else if (id === "TV05") {
      const result = page.getByRole("dialog", { name: "Wynik próby rasowej", exact: true });
      for (let cycle = 0; cycle < 8 && !(await result.count()); cycle++) {
        await expect.poll(async () => await stage.getAttribute("data-trial-phase")).toBe("warning");
        const canvas = stage.locator(".ki-canvas");
        const point = await canvas.evaluate((el) => {
          const d = (el as HTMLElement).dataset,
            b = el.getBoundingClientRect(),
            z = Number(d["cameraZoom"]);
          const x = Number(d["playerX"]),
            y = Number(d["playerY"]);
          const targetY = y + (y > 400 ? -155 : 155);
          return {
            x: b.x + (x - Number(d["cameraX"]) - b.width / 2) * z + b.width / 2,
            y: b.y + (targetY - Number(d["cameraY"]) - b.height / 2) * z + b.height / 2,
          };
        });
        await page.mouse.click(point.x, point.y);
        await expect
          .poll(async () => await stage.getAttribute("data-trial-phase"))
          .not.toBe("warning");
        if ((await stage.getAttribute("data-trial-phase")) === "counter") {
          // Click reachable ground outside the dummy's 45-unit selection circle.
          const approach = await canvas.evaluate((el) => {
            const d = (el as HTMLElement).dataset,
              b = el.getBoundingClientRect(),
              z = Number(d["cameraZoom"]);
            return {
              x: b.x + (600 - Number(d["cameraX"]) - b.width / 2) * z + b.width / 2,
              y: b.y + (390 - Number(d["cameraY"]) - b.height / 2) * z + b.height / 2,
            };
          });
          await page.mouse.click(approach.x, approach.y);
          await expect
            .poll(async () =>
              Math.hypot(
                Number(await canvas.getAttribute("data-player-x")) - 600,
                Number(await canvas.getAttribute("data-player-y")) - 390,
              ),
            )
            .toBeLessThan(20);
          await stage.locator('[data-ability="R"]').click();
          await expect
            .poll(async () => await stage.getAttribute("data-trial-phase"))
            .not.toBe("counter");
        }
      }
    } else if (id === "TP08") {
      await page.screenshot({ path: info.outputPath("pyra-trial-before-attack.png") });
      await info.attach("attack-preflight", {
        contentType: "application/json",
        body: JSON.stringify(
          await stage.locator('[data-ability="R"]').evaluate((button) => {
            const b = button.getBoundingClientRect();
            return {
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
              blockedBy: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
                ?.outerHTML,
              canvas: {
                ...(document.querySelector<HTMLElement>(".ki-trial-stage .ki-canvas")?.dataset ??
                  {}),
              },
            };
          }),
        ),
      });
      for (let i = 0; i < 3; i++) {
        await expect(stage).toHaveAttribute("data-trial-phase", "strike");
        await stage.locator('[data-ability="R"]').click();
        await expect(stage).toHaveAttribute("data-trial-phase", "hold");
      }
    } else {
      const rounds = ["TN08", "TV07", "TV08", "TA05"].includes(id)
        ? 1
        : id === "TA11"
          ? 2
          : id === "TV04"
            ? 2
            : id === "TV06"
              ? 6
              : 3;
      for (let i = 0; i < rounds; i++) {
        await walkToStation(page, false);
        await stage.getByRole("button", { name: "Zbadaj stanowisko", exact: true }).click();
        const materials = page.getByRole("dialog", { name: "Materiały próby", exact: true });
        await expect(materials).toBeVisible();
        if (i === 0)
          await page.screenshot({ path: info.outputPath(`${land}-trial-materials.png`) });
        const text = await materials.locator(".ki-trial-document").allTextContents();
        if (id === "TA05") {
          await expect(
            materials.getByRole("img", { name: "Układ zwierciadeł i promienia" }),
          ).toBeVisible();
          await expect(materials).toContainText("Lustro /");
          await materials.getByRole("button", { name: "Obróć zwierciadło 2", exact: true }).click();
          await expect(materials).toContainText("Podgląd: odbiornik.");
          await page.screenshot({ path: info.outputPath("aether-mirror-route.png") });
          await materials.getByRole("button", { name: "Uruchom promień", exact: true }).click();
        } else if (id === "TV07") {
          const heading = await materials.getByRole("heading", { level: 2 }).innerText();
          const roles = heading.split("Potrzeby: ")[1]!.replace(/\.$/, "").split(", ");
          const rows = text.join(" ").split(". Wybierz")[0]!.split("; ");
          for (const role of roles) {
            const name = rows.find((row) => row.endsWith(": " + role))!.split(": ")[0]!;
            await materials.getByRole("checkbox", { name, exact: true }).check();
          }
          await page.screenshot({ path: info.outputPath("care-supplies-selected.png") });
          await materials.getByRole("button", { name: "Przygotuj zestaw", exact: true }).click();
        } else if (id === "TV08") {
          const demands = [...text.join(" ").matchAll(/co najmniej (\d+) jednostek/g)].map(
            (m) => m[1]!,
          );
          await materials
            .getByRole("spinbutton", { name: "Osada nad Brzegiem", exact: true })
            .fill(demands[0]!);
          await materials
            .getByRole("spinbutton", { name: "Osada pod Lasem", exact: true })
            .fill(demands[1]!);
          await page.screenshot({ path: info.outputPath("care-water-allocated.png") });
          await materials.getByRole("button", { name: "Zatwierdź przepływ", exact: true }).click();
        } else if (id === "TN08") {
          await materials
            .getByRole("checkbox", { name: "Skaner · 2 energii", exact: true })
            .check();
          await materials
            .getByRole("checkbox", { name: "Precyzja · 3 energii", exact: true })
            .check();
          await materials.getByRole("button", { name: "Sprawdź konstrukcję", exact: true }).click();
        } else {
          // Read only the clues actually shown to the player, never internal answer IDs.
          const heading = await materials.getByRole("heading", { level: 2 }).innerText();
          let answer: string;
          if (id === "TA10") {
            const fragment = heading.match(/„(.+)”/)![1]!;
            answer = text
              .join("\n")
              .split("\n")
              .find((line) => line.endsWith(`„${fragment}”`))!
              .split(": „")[0]!
              .trim();
          } else if (id === "TA11") {
            const sources = text.join(" ");
            answer =
              i === 0
                ? "W obu skrzyniach były identyczne dokumenty"
                : "Obie kopie sporządziła ta sama osoba";
            expect(sources).toContain(i === 0 ? "dwie skrzynie" : "nie ustalono autora");
          } else if (id === "TA12") {
            const sources = text.join(" ");
            if (i === 0) {
              expect(sources).toContain("Pierwsze było odnalezienie pustej karty");
              answer = "Odnalezienie pustej karty";
            } else if (i === 1) {
              expect(sources).toContain("Wykonanie kopii nastąpiło po: Odnalezienie pustej karty");
              answer = "Wykonanie kopii";
            } else {
              expect(sources).toContain("autora nie ustalono");
              answer = "Otwarcie rejestru — autor dopisku: nieustalony";
            }
          } else if (id === "TV02") {
            const sign = heading.split(": ")[1]!.split(". Którym")[0]!;
            answer = text
              .join(" ")
              .split("Karta tropiciela: ")[1]!
              .split(". Przy")[0]!
              .split("; ")
              .find((row) => row.endsWith(": " + sign))!
              .split(": ")[0]!
              .trim();
          } else if (id === "TV04") {
            answer = text.join(" ").split("strzałki: ")[1]!.split(".")[0]!.split(" → ")[i]!.trim();
          } else if (id === "TV06") {
            const location = text.join(" ").match(/(Północ|Brzeg|Polana): 82/)![1]!;
            answer = `${i % 2 === 0 ? "Oznacz" : "Oczyść"} ${location}`;
          } else if (id === "TV10") {
            answer = text
              .join(" ")
              .match(new RegExp(`${i + 1}\\.\\s*([^→.]+)`))![1]!
              .trim();
          } else {
            const glyph = heading.match(/symbol: (.+)\./)![1]!;
            answer = text
              .join(" ")
              .split("; ")
              .find((v) => v.includes(`${glyph} = `))!
              .split(" = ")[1]!
              .replace(/\.$/, "")
              .trim();
          }
          await materials.getByRole("button", { name: answer, exact: true }).click();
        }
        await expect(materials).toHaveCount(0);
      }
    }
    const result = page.getByRole("dialog", { name: "Wynik próby rasowej", exact: true });
    await expect(result).toContainText("Próba ukończona");
    await page.screenshot({ path: info.outputPath(`${land}-trial-passed.png`) });
    await result.getByRole("button", { name: "Zatwierdź wynik i wróć", exact: true }).click();
    await expect(stage).toHaveCount(0);
    await expect.poll(async () => (await owner(page)).development?.trials?.[id]).toBe(1);
    const after = await owner(page);
    expect(after.development.practiceEarned - (before.development?.practiceEarned ?? 0)).toBe(100);
    for (const field of [
      "hp",
      "ki",
      "xp",
      "gold",
      "equipment",
      "bagItems",
      "items",
      "materials",
      "depot",
      "skills",
      "level",
      "race",
      "continent",
    ])
      expect(after[field], field).toEqual(before[field]);
    await page.reload();
    await expect(canvas).toHaveAttribute("data-interior", "arena");
    const reloaded = await owner(page);
    expect(reloaded.development.trials[id]).toBe(1);
    expect(reloaded.development.practiceEarned).toBe(after.development.practiceEarned);
    expect(errors).toEqual([]);
  });
}
