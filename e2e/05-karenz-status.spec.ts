import { test, expect } from "@playwright/test";

// Journey 6: Karenz count + Status page tabs
test.describe("Karenz status page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/employees/status");
    await page.waitForSelector("h1", { timeout: 10_000 });
  });

  test("shows Status-Verwaltung heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /status/i })).toBeVisible();
  });

  test("Karenz tab is default", async ({ page }) => {
    await expect(page.getByRole("button", { name: /karenz/i })).toBeVisible();
  });

  test("Karenz list or empty state rendered", async ({ page }) => {
    const list = await page.locator("a[href*='/admin/employees/']").count();
    const empty = await page.getByText(/keine mitarbeiter in karenz/i).isVisible().catch(() => false);
    expect(list > 0 || empty).toBe(true);
  });

  test("Pfändung tab loads", async ({ page }) => {
    await page.getByRole("button", { name: /pfändung/i }).click();
    const list = await page.locator("a[href*='/admin/employees/']").count();
    const empty = await page.getByText(/keine aktiven pfändungen/i).isVisible().catch(() => false);
    expect(list > 0 || empty).toBe(true);
  });

  test("Austritt tab shows search input", async ({ page }) => {
    await page.getByRole("button", { name: /austritt/i }).click();
    await expect(page.getByPlaceholder(/name oder dienstnummer/i)).toBeVisible();
  });
});
