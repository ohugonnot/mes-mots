import { test, expect } from '@playwright/test'

test("l'application se charge et affiche quelque chose", async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#app')).toBeVisible()
})

test("l'application déclare un manifeste installable", async ({ page }) => {
  await page.goto('/')
  const manifeste = page.locator('link[rel="manifest"]')
  await expect(manifeste).toHaveCount(1)
})
