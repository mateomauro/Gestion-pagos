import { test, expect } from './fixtures'

test.describe('Onboarding (usuario fresh)', () => {
  test('dashboard muestra card 0 de 3 al inicio', async ({ authedPage: page }) => {
    // El test user arranca limpio (SQL resetea data)
    await page.goto('/dashboard')

    // La card de onboarding debe estar visible
    await expect(page.getByText('Empezá en 3 pasos')).toBeVisible()
    await expect(page.getByText(/0 de 3/)).toBeVisible()

    // Los 3 pasos visibles con sus titulos
    await expect(page.getByText('Personalizá tu negocio')).toBeVisible()
    await expect(page.getByText('Creá tu primer servicio')).toBeVisible()
    await expect(page.getByText('Cargá tu primer cliente')).toBeVisible()
  })

  test('paso 1 lleva a Configuracion', async ({ authedPage: page }) => {
    await page.goto('/dashboard')
    // Click en el primer paso ("Configurar")
    await page.getByText('Personalizá tu negocio').click()
    await page.waitForURL('**/configuracion')
    expect(page.url()).toContain('/configuracion')
    // La seccion Mi negocio debe estar
    await expect(page.getByRole('heading', { name: 'Mi negocio' })).toBeVisible()
  })

  test('paso 3 abre el form de nuevo cliente directo', async ({ authedPage: page }) => {
    await page.goto('/dashboard')
    await page.getByText('Cargá tu primer cliente').click()
    // Redirige a /clientes?new=1 y abre el dialog
    await page.waitForURL(/\/clientes/)
    await expect(page.getByRole('dialog', { name: /nuevo cliente/i })).toBeVisible()
  })
})
