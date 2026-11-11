import { expect, type Page } from "@playwright/test";
import type { TrialAttempt } from "../../src/game/development/trials/attempt";

type Point = { x: number; y: number };
type State = Pick<
  ReturnType<TrialAttempt["snapshot"]>,
  "body" | "combat" | "resourceControl" | "calibration"
>;
/** Uses read-only diagnostics and the same canvas/button input as the player. No outcome/state injection. */
export async function completeNewTrial(
  page: Page,
  id: string,
  navigate: (point: Point | undefined, wait: boolean) => Promise<void>,
) {
  const stage = page.locator(".ki-trial-stage"),
    canvas = stage.locator(".ki-canvas");
  const result = page.getByRole("dialog", { name: "Wynik próby rasowej", exact: true });
  const cast = async (ability: string) => {
    const button = stage.locator(`[data-ability="${ability}"]`);
    if (!(await button.isEnabled())) return false;
    await button.click();
    return true;
  };
  const position = async () => ({
    x: Number(await canvas.getAttribute("data-player-x")),
    y: Number(await canvas.getAttribute("data-player-y")),
  });
  const walk = async (point: Point | undefined, wait: boolean) => {
    const goal = point ?? {
      x: Number(await stage.getAttribute("data-trial-x")),
      y: Number(await stage.getAttribute("data-trial-y")),
    };
    for (let n = 0; n < 25; n++) {
      const canvasHit = await canvas.evaluate((el, target) => {
        const b = el.getBoundingClientRect(),
          d = (el as HTMLElement).dataset;
        const z = Number(d["cameraZoom"]);
        const x = b.x + (target.x - Number(d["cameraX"]) - b.width / 2) * z + b.width / 2;
        const y = b.y + (target.y - Number(d["cameraY"]) - b.height / 2) * z + b.height / 2;
        return !!document.elementFromPoint(x, y)?.closest(".ki-canvas");
      }, goal);
      if (canvasHit) return navigate(point, wait);
      // A destination under HUD is approached with ordinary WASD, never by clicking an exit/menu.
      const p = await position();
      const keys = [
        Math.abs(goal.x - p.x) > 15 ? (goal.x > p.x ? "d" : "a") : "",
        Math.abs(goal.y - p.y) > 15 ? (goal.y > p.y ? "s" : "w") : "",
      ].filter(Boolean);
      if (!keys.length) throw Error("Trial destination is covered by HUD at the player's feet");
      for (const key of keys) await page.keyboard.down(key);
      await page.waitForTimeout(150);
      for (const key of keys) await page.keyboard.up(key);
    }
    throw Error(
      "Trial destination stayed covered by HUD after walking: " +
        JSON.stringify(
          await canvas.evaluate((el) => ({
            ...(el as HTMLElement).dataset,
            active: document.activeElement?.tagName,
          })),
        ),
    );
  };
  const near = (a: Point, b: Point, radius: number) => Math.hypot(a.x - b.x, a.y - b.y) <= radius;
  let route = "",
    selected = "",
    marked = "";
  for (let n = 0; n < 2000 && !(await result.count()); n++) {
    const state: State = JSON.parse((await stage.getAttribute("data-controller-state"))!);
    const p = await position();
    const move = async (point: Point, key: string) => {
      if (route !== key) {
        route = key;
        await walk(point, false);
      }
    };
    if (state.combat) {
      const c = state.combat;
      if (c.phase === "decision") {
        await walk(c.point, true);
        await stage.getByRole("button", { name: "Zbadaj stanowisko", exact: true }).click();
        await page
          .getByRole("dialog", { name: "Materiały próby", exact: true })
          .getByRole("button", { name: /Przerwij pościg/ })
          .click();
        route = "";
        selected = "";
      } else if (c.phase === "return") {
        if (route !== "return") await page.keyboard.press("Escape");
        await move(c.point, "return");
      } else {
        const enemy = c.enemies[0];
        if (enemy) {
          route = "";
          if (selected !== enemy.id) {
            selected = enemy.id;
            await walk(enemy, false);
          }
          if (near(p, enemy, 100)) {
            await cast("B4");
            await cast("B1");
            await cast("C1");
            await cast("A1");
          }
          const potion = stage.locator('[data-ability="potion"]');
          // A borrowed potion still uses its real HUD activation and cooldown.
          const hp = await stage
            .getByRole("meter", { name: "Zdrowie", exact: true })
            .textContent()
            .catch(() => "");
          if (hp?.includes("/")) {
            const values = hp.match(/[\d.]+/g)?.map(Number);
            if (values && values[0]! < values[1]! * 0.5 && (await potion.isEnabled()))
              await potion.click();
          }
        } else {
          selected = "";
          const point = c.companion && !near(p, c.companion, 190) ? c.companion : c.point;
          const key = `${Math.floor(point.x / 40)},${Math.floor(point.y / 40)}`;
          if (route !== key) await page.keyboard.press("Escape");
          await move(point, key);
        }
      }
    } else if (state.body) {
      const b = state.body;
      if (b.kind === "burden-route") {
        if (b.point) await move(b.point, `${b.point.x},${b.point.y}`);
      } else if (!near(p, b.point, 20)) await move(b.point, "body-position");
      else if (b.phase === "window") {
        await walk({ x: 600, y: 300 }, false);
        await cast("B1");
      }
    } else if (state.resourceControl) {
      const c = state.resourceControl;
      if (!near(p, c.point, 20)) await move(c.point, "resource-position");
      else {
        if (selected !== c.targetId) {
          await walk({ x: 600, y: 300 }, false);
          selected = c.targetId;
        }
        if (c.kind === "ki-budget") await cast("A1");
        else if (c.kind.endsWith("windows")) {
          if (c.phase === "window") await cast(c.kind === "core-windows" ? "C1" : "C4");
          else if (c.phase === "build" && c.value / c.max < 0.35) await cast("R");
        } else if (c.kind === "core-sequence") {
          if (
            c.discharges < c.dischargeTarget &&
            c.value / c.max >= 0.3 &&
            (await stage.locator('[data-ability="C1"]').isEnabled())
          )
            await cast("C1");
          else if (
            (c.shots < c.shotTarget || c.discharges < c.dischargeTarget) &&
            c.value / c.max < 0.6
          )
            await cast("R");
        } else if (c.value / c.max < (c.kind === "core-band" ? 0.45 : 0.5)) await cast("R");
      }
    } else if (state.calibration) {
      const c = state.calibration;
      if (c.point) {
        if (!near(p, c.point, 95))
          await move(
            { x: c.point.x, y: c.point.y + 55 },
            `${c.targetId}:${Math.floor(c.point.x / 75)}`,
          );
        else {
          route = "";
          if (selected !== c.targetId || c.kind === "moving-shots") {
            await walk(c.point, false);
            selected = c.targetId!;
          }
          if (c.kind === "marked-shots" && marked !== c.targetId) {
            if (await cast("A1")) marked = c.targetId!;
          } else if (selected === c.targetId) {
            if (!(await cast("R"))) {
              await page.waitForTimeout(100);
              continue;
            }
            // Wait for the actual projectile/contact before firing another shot into a completed target.
            await expect
              .poll(async () => stage.getAttribute("data-calibration-target"), { timeout: 5000 })
              .not.toBe(c.targetId);
            marked = "";
          }
        }
      }
    } else {
      await walk(undefined, true);
      await stage.getByRole("button", { name: "Zbadaj stanowisko", exact: true }).click();
      const materials = page.getByRole("dialog", { name: "Materiały próby", exact: true });
      await expect(materials).toBeVisible();
      const text = (await materials.locator(".ki-trial-document").allTextContents()).join(" ");
      const round = Number(await stage.getAttribute("data-trial-round"));
      let answer: string;
      if (id === "TN10") {
        const ref = text.match(/Rejestr kontrolny: .+?: (znak-\d+)/)?.[1],
          actual = text.match(/log ma podpis: (znak-\d+)/)![1]!;
        answer = !ref
          ? "Brak wzorca — nie można potwierdzić autora"
          : ref === actual
            ? "Podpis zgodny z niezależnym rejestrem"
            : "Podpis niezgodny z rejestrem";
      } else if (id === "TN11") {
        const entries = [...text.matchAll(/(\d+):00: ([^;.]+)/g)].sort(
          (a, b) => Number(a[1]) - Number(b[1]),
        );
        answer =
          entries[round]![2]!.trim() +
          (round === entries.length - 1 ? " — autor dopisku nieustalony" : " — wpis potwierdzony");
      } else
        answer = text.split("Kolejność serwisowa: ")[1]!.split(". Wynik")[0]!.split(" → ")[round]!;
      await materials.getByRole("button", { name: answer, exact: true }).click();
    }
    await page.waitForTimeout(100);
  }
  await expect(result).toContainText("Próba ukończona");
}
