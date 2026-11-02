// Drives the real /konto page: register → activation e-mail link → signed in → logout → login.
import { chromium } from "playwright";
import assert from "node:assert/strict";
const app = process.env.QA_APP ?? "http://127.0.0.1:5190";
const qa = "http://127.0.0.1:7457";
const out = process.env.KI_QA_OUTPUT ?? "test-results/accounts";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(app + "/konto");
  await page.getByRole("tab", { name: "Rejestracja" }).click();
  await page.getByLabel("Nick w grze").fill("Tester");
  await page.getByLabel("E-mail").fill("tester@example.com");
  await page.getByLabel("Hasło").fill("haslo-12345");
  await page.getByRole("button", { name: "Załóż konto" }).click();
  await page.getByText("Sprawdź skrzynkę e-mail").waitFor();
  await page.screenshot({ path: `${out}/1-registered.png` });
  // Login before activation is refused with a resend option.
  await page.getByLabel("E-mail").fill("tester@example.com");
  await page.getByLabel("Hasło").fill("haslo-12345");
  await page.getByRole("button", { name: "Zaloguj" }).click();
  await page.getByText("Konto nie jest aktywne").waitFor();
  await page.getByRole("button", { name: "Wyślij ponownie link aktywacyjny" }).waitFor();
  const { link } = await (await fetch(qa + "/qa/last-mail")).json();
  assert.ok(link && link.includes("aktywacja="), "activation link captured");
  await page.goto(link);
  await page.getByText("Konto aktywne").waitFor();
  await page.getByText("Nick: Tester").waitFor();
  await page.screenshot({ path: `${out}/2-activated.png` });
  // Session survives a reload (refresh token), then logout and login again.
  await page.reload();
  await page.getByRole("heading", { name: "Twoje konto" }).waitFor();
  await page.getByRole("button", { name: "Wyloguj" }).click();
  await page.getByRole("heading", { name: "Zaloguj się" }).waitFor();
  await page.getByLabel("E-mail").fill("tester@example.com");
  await page.getByLabel("Hasło").fill("haslo-12345");
  await page.getByRole("button", { name: "Zaloguj" }).click();
  await page.getByRole("heading", { name: "Twoje konto" }).waitFor();
  await page.screenshot({ path: `${out}/3-login.png` });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      register: true,
      refusedBeforeActivation: true,
      activated: true,
      reload: true,
      logoutLogin: true,
      jsErrors: 0,
    }),
  );
} finally {
  await browser.close();
}
