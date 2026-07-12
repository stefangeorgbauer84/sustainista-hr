import { test, expect } from "@playwright/test";

test.describe("HR Dashboard — KPIs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    await page.waitForSelector("h1", { timeout: 10_000 });
  });

  test("shows HR Dashboard heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /hr dashboard/i })).toBeVisible();
  });

  test("Aktive Mitarbeiter KPI card visible with positive count", async ({ page }) => {
    await expect(page.getByText("Aktive Mitarbeiter", { exact: true })).toBeVisible();
    await expect
      .poll(async () => {
        const text = await page.locator("main").innerText();
        return Number((text.match(/Aktive Mitarbeiter\s*\n\s*(\d+)/) ?? [])[1] ?? NaN);
      }, { timeout: 15_000 })
      .toBeGreaterThan(0);
  });

  test("In Karenz KPI links to /admin/employees/status", async ({ page }) => {
    await page.getByText("In Karenz").click();
    await expect(page).toHaveURL(/\/admin\/employees\/status/);
  });

  test("Pfändungen KPI card visible", async ({ page }) => {
    await expect(page.getByText("Pfändungen")).toBeVisible();
  });

  test("Stand timestamp shown in header", async ({ page }) => {
    await expect(page.getByText(/stand.*uhr/i)).toBeVisible();
  });
});
