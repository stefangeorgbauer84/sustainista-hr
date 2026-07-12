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
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  // Login leitet immer auf /dashboard; Admin-Zugriff danach explizit prüfen
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });
  // Guided Tour beim Erstlogin schließen — sonst fängt das Overlay alle Klicks
  // in den Folgetests ab. Der localStorage-Marker landet im storageState.
  const skipTour = page.getByText("Tour überspringen");
  if (await skipTour.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await skipTour.click();
  }
  await page.context().storageState({ path: AUTH_FILE });
});
