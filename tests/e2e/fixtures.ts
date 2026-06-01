import { test as base, expect, Page } from '@playwright/test'

export const TEST_USER = {
  email: 'test-e2e@cobrogest.test',
  password: 'TestE2E2026!',
}

/**
 * Helper: loguea al test user via el formulario UI.
 * Espera a estar en /dashboard despues del login.
 */
export async function loginAsTestUser(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(TEST_USER.email)
  await page.getByLabel('Contraseña').fill(TEST_USER.password)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  // Esperar a que llegue al dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 })
}

/**
 * Fixture que ya viene logueado (la mayoría de tests requieren auth).
 */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await loginAsTestUser(page)
    await use(page)
  },
})

export { expect }
