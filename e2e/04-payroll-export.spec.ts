import { test, expect } from "@playwright/test";

// Journey 5: XLSX export download
test.describe("Payroll export", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/reports/payroll");
    await page.waitForSelector("h1", { timeout: 10_000 });
  });

  test("shows Lohnexport heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /lohnexport/i })).toBeVisible();
  });

  test("preview table loads employees", async ({ page }) => {
    await page.waitForSelector("tbody tr", { timeout: 15_000 });
    expect(await page.locator("tbody tr").count()).toBeGreaterThan(0);
  });

  test("XLSX export triggers .xlsx download", async ({ page }) => {
    await page.waitForSelector("tbody tr", { timeout: 15_000 });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /xlsx/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/Lohnliste_.+\.xlsx/);
  });

  test("CSV export triggers .csv download", async ({ page }) => {
    await page.waitForSelector("tbody tr", { timeout: 15_000 });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /^csv$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/Lohnliste_.+\.csv/);
  });
});
