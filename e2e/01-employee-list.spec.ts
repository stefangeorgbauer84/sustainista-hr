import { test, expect } from "@playwright/test";

test.describe("Employee list — search + filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/employees");
    await page.waitForSelector("table, [data-testid='employee-card']", { timeout: 10_000 });
  });

  test("shows employees after login", async ({ page }) => {
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("search filters list", async ({ page }) => {
    await page.getByPlaceholder(/suche/i).fill("Bauer");
    await page.waitForTimeout(400);
    const rows = page.locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
    const text = await page.locator("tbody").textContent();
    expect(text?.toLowerCase()).toContain("bauer");
  });

  test("seed employees EMP001/EMP002 not visible", async ({ page }) => {
    const allText = await page.locator("tbody").textContent();
    expect(allText).not.toContain("EMP001");
    expect(allText).not.toContain("EMP002");
  });

  test("pagination loads next page", async ({ page }) => {
    const nextBtn = page.getByRole("button").filter({ hasText: /›|>/ }).first();
    const hasPagination = await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasPagination && await nextBtn.isEnabled()) {
      await nextBtn.click();
      await expect(page.getByRole("button").filter({ hasText: /‹|</ }).first()).toBeEnabled();
    }
  });
});
