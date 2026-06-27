import { test, expect } from "@playwright/test";

test.describe("Employee detail — inline edit", () => {
  test("opens detail and shows heading", async ({ page }) => {
    await page.goto("/admin/employees");
    await page.waitForSelector("tbody tr");
    await page.locator("tbody tr").first().getByText("Details →").click();
    await page.waitForURL(/\/admin\/employees\/.+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("edit toggle shows save+cancel", async ({ page }) => {
    await page.goto("/admin/employees");
    await page.waitForSelector("tbody tr");
    await page.locator("tbody tr").first().getByText("Details →").click();
    await page.waitForURL(/\/admin\/employees\/.+/);
    await page.getByRole("button", { name: /bearbeiten/i }).click();
    await expect(page.getByRole("button", { name: /speichern/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /abbrechen/i })).toBeVisible();
  });

  test("cancel restores read mode", async ({ page }) => {
    await page.goto("/admin/employees");
    await page.waitForSelector("tbody tr");
    await page.locator("tbody tr").first().getByText("Details →").click();
    await page.waitForURL(/\/admin\/employees\/.+/);
    await page.getByRole("button", { name: /bearbeiten/i }).click();
    await page.getByRole("button", { name: /abbrechen/i }).click();
    await expect(page.getByRole("button", { name: /bearbeiten/i })).toBeVisible();
  });

  test("breadcrumb navigates back to list", async ({ page }) => {
    await page.goto("/admin/employees");
    await page.waitForSelector("tbody tr");
    await page.locator("tbody tr").first().getByText("Details →").click();
    await page.waitForURL(/\/admin\/employees\/.+/);
    await page.getByText("Mitarbeiter").click();
    await expect(page).toHaveURL(/\/admin\/employees$/);
  });
});
