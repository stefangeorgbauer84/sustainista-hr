import { test, expect } from "@playwright/test";

// Journey 6: Historische Zeiterfassung 2025 + Lohnzettel-Druckansicht
test.describe("Zeiterfassung 2025 & Lohnzettel", () => {
  test("admin time page: year selector switches to 2025 and shows PACE-DPP entries", async ({ page }) => {
    await page.goto("/admin/time");
    await page.waitForSelector("h1", { timeout: 10_000 });

    const yearSelect = page.locator("select", { has: page.locator('option[value="2025"]') }).last();
    await yearSelect.selectOption("2025");
    await page.getByRole("button", { name: "Okt", exact: true }).click();

    await expect(page.getByText("PACE-DPP").first()).toBeVisible({ timeout: 15_000 });
  });

  test("Lohnzettel page renders statement with Ist/Soll and PDF button", async ({ page }) => {
    await page.goto("/admin/reports/payroll");
    await page.waitForSelector("tbody tr", { timeout: 15_000 });

    await page.locator("tr", { hasText: "SUS-001" }).getByRole("link", { name: /lohnzettel/i }).click();
    await page.waitForSelector("#lohnzettel", { timeout: 10_000 });

    await expect(page.getByText(/Arbeitszeitaufzeichnung/)).toBeVisible();
    await expect(page.getByRole("button", { name: /pdf herunterladen/i })).toBeVisible();

    // Zeitraum mit Daten wählen: Oktober 2025
    const monthSelect = page.locator("select", { has: page.locator("option", { hasText: "Oktober" }) }).first();
    await monthSelect.selectOption("10");
    const yearSelect = page.locator("select", { has: page.locator('option[value="2025"]') }).last();
    await yearSelect.selectOption("2025");

    await expect(page.getByText("Summe Ist / Soll")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#lohnzettel").getByText("PACE-DPP").first()).toBeVisible({ timeout: 15_000 });
  });
});
