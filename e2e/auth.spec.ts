import { test, expect } from "@playwright/test"

test.describe("Authentication", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/auth/login")
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test("should show signup page", async ({ page }) => {
    await page.goto("/auth/signup")
    await expect(page.getByRole("heading", { name: /sign up|create account/i })).toBeVisible()
  })

  test("should show validation errors on empty login", async ({ page }) => {
    await page.goto("/auth/login")
    await page.getByRole("button", { name: /sign in/i }).click()
    // Should show some form of validation
    await expect(page.locator("text=/email|required/i")).toBeVisible()
  })

  test("should navigate to forgot password", async ({ page }) => {
    await page.goto("/auth/login")
    await page.getByRole("link", { name: /forgot/i }).click()
    await expect(page).toHaveURL(/forgot-password/)
  })

  test("should redirect unauthenticated users from protected routes", async ({ page }) => {
    await page.goto("/properties")
    await expect(page).toHaveURL(/auth\/login/)
  })
})
