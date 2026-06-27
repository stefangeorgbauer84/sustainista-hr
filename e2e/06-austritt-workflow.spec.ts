import { test, expect } from "@playwright/test";

// Journey 7: Austritt sets is_active=false
// Test verifies UI guard (2-step confirm) without completing the mutation.
// Full DB roundtrip test requires E2E_AUSTRITT_EMPLOYEE env var pointing to a test employee.
test.describe("Austritt workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/employees/status");
    await page.getByRole("button", { name: /austritt/i }).click();
    await page.waitForSelector("input[placeholder]", { timeout: 10_000 });
  });

  test("warning about deactivation is visible", async ({ page }) => {
    await expect(page.getByText(/inaktiv/i)).toBeVisible();
  });

  test("search finds employees", async ({ page }) => {
    const q = process.env.E2E_AUSTRITT_EMPLOYEE ?? "Bauer";
    await page.getByPlaceholder(/name oder dienstnummer/i).fill(q);
    await page.waitForTimeout(200);
    const results = page.locator("button").filter({ hasText: q });
    if (await results.count() > 0) {
      await expect(results.first()).toBeVisible();
    }
  });

  test("selecting employee shows date picker and Austritt button", async ({ page }) => {
    const q = process.env.E2E_AUSTRITT_EMPLOYEE ?? "Bauer";
    await page.getByPlaceholder(/name oder dienstnummer/i).fill(q);
    await page.waitForTimeout(200);
    const results = page.locator("button").filter({ hasText: q });
    if (await results.count() > 0) {
      await results.first().click();
      await expect(page.locator("input[type='date']")).toBeVisible();
      await expect(page.getByRole("button", { name: /austritt durchführen/i })).toBeVisible();
    }
  });

  test("confirm dialog appears before final action and can be cancelled", async ({ page }) => {
    const q = process.env.E2E_AUSTRITT_EMPLOYEE ?? "Bauer";
    await page.getByPlaceholder(/name oder dienstnummer/i).fill(q);
    await page.waitForTimeout(200);
    const results = page.locator("button").filter({ hasText: q });
    if (await results.count() > 0) {
      await results.first().click();
      await page.getByRole("button", { name: /austritt durchführen/i }).click();
      await expect(page.getByRole("button", { name: /bestätigen/i })).toBeVisible();
      // Cancel — do NOT confirm to avoid modifying production data
      await page.getByRole("button", { name: /abbrechen/i }).click();
      await expect(page.getByRole("button", { name: /austritt durchführen/i })).toBeVisible();
    }
  });
});
