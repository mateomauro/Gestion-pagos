import { test, expect } from '@playwright/test'

test.describe('Public routes (no auth)', () => {
  test('landing loads + no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // No errores criticos en consola
    expect(errors.filter(e => !e.includes('favicon')), `Errores en consola: ${errors.join(', ')}`).toEqual([])
  })

  test('login form renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Contraseña')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible()
  })

  test('terms + privacy load', async ({ page }) => {
    await page.goto('/terminos')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.goto('/privacidad')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
