import { test as setup, expect } from "@playwright/test";
import path from "path";

const AUTH_FILE = path.join(__dirname, ".auth/session.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error("E2E_EMAIL and E2E_PASSWORD must be set");

  await page.goto("/login");
  await page.getByLabel(/e-mail/i).fill(email);
  await page.getByLabel(/passwort/i).fill(password);
  await page.getByRole("button", { name: /anmeld/i }).click();
  await page.waitForURL(/\/admin/);
  await expect(page).toHaveURL(/\/admin/);
  await page.context().storageState({ path: AUTH_FILE });
});
