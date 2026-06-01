import { test, expect } from '@playwright/test'
import { TEST_USER, loginAsTestUser } from './fixtures'

test.describe('Auth', () => {
  test('login con creds validas -> dashboard', async ({ page }) => {
    await loginAsTestUser(page)
    expect(page.url()).toContain('/dashboard')
  })

  test('login con pass invalida -> error visible', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(TEST_USER.email)
    await page.getByLabel('Contraseña').fill('passwordIncorrecta123')
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    // Mensaje de error visible
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
    expect(page.url()).toContain('/login')
  })

  test('logout funciona', async ({ page }) => {
    await loginAsTestUser(page)
    // Buscar el boton de cerrar sesion (puede estar en sidebar o bottom nav)
    const logoutBtn = page.getByRole('button', { name: /cerrar sesi/i }).first()
    await logoutBtn.click()
    // Volver al login o landing
    await page.waitForURL(/\/(login|$)/, { timeout: 10000 })
  })
})
