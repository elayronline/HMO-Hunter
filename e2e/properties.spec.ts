import { test, expect } from "@playwright/test"

test.describe("Properties Page", () => {
  test("should load homepage with map", async ({ page }) => {
    await page.goto("/")

    // Should have main elements
    await expect(page.locator('[class*="map"]')).toBeVisible({ timeout: 10000 })
  })

  test("should show login button when not authenticated", async ({ page }) => {
    await page.goto("/")

    // Look for sign in / login button
    await expect(page.getByRole("button", { name: /sign in|login/i })).toBeVisible()
  })

  test("should have search functionality", async ({ page }) => {
    await page.goto("/")

    // Should have a search input
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]')
    await expect(searchInput.first()).toBeVisible()
  })

  test("should have filter controls", async ({ page }) => {
    await page.goto("/")

    // Should have filter tabs or buttons
    const filterElements = page.locator('button:has-text("All"), button:has-text("Licensed"), [role="tab"]')
    await expect(filterElements.first()).toBeVisible()
  })

  test("help page loads correctly", async ({ page }) => {
    await page.goto("/help")

    await expect(page.getByRole("heading", { name: /help/i })).toBeVisible()
    await expect(page.locator("text=/getting started/i")).toBeVisible()
  })

  test("privacy page loads correctly", async ({ page }) => {
    await page.goto("/privacy")

    await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible()
  })
})
