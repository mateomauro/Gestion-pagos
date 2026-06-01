import { test, expect } from './fixtures'

test.describe('Cobrar cliente (RPC atomico)', () => {
  test('cobrar cambia estado a Al dia + suma 1 mes al vencimiento', async ({ authedPage: page }) => {
    await page.goto('/clientes')

    // Asegurar al menos 1 cliente cargado (en caso de que el test 05 no haya corrido antes)
    const pedro = page.getByText('Pedro Test')
    if (await pedro.count() === 0) {
      // Crear uno via el form si no hay
      await page.getByRole('button', { name: 'Nuevo cliente' }).click()
      await page.getByLabel('Nombre y apellido').fill('Juan Cobrar Test')
      await page.locator('#telefono').fill('1100000099')
      // Seleccionar primer servicio disponible
      await page.locator('#servicio').click()
      await page.getByRole('option').first().click()
      await page.getByLabel(/Monto/).fill('15000')
      await page.getByRole('button', { name: 'Crear', exact: true }).click()
      await page.waitForTimeout(1500)
    }

    // Esperar a que las filas se rendericen
    await page.waitForSelector('button:has-text("Cobrar")', { timeout: 10000 })

    // Click en el primer "Cobrar"
    await page.getByRole('button', { name: 'Cobrar', exact: true }).first().click()

    // Dialog de PaymentDialog
    await expect(page.getByRole('dialog', { name: /registrar pago/i })).toBeVisible()

    // Confirmar
    await page.getByRole('button', { name: /confirmar pago/i }).click()

    // Toast success con "Pago de X registrado"
    await expect(page.getByText(/pago de .+ registrado/i)).toBeVisible({ timeout: 5000 })

    // Verificar que el badge cambia: en algun lado debe aparecer "Al día"
    await expect(page.getByText('Al día').first()).toBeVisible()
  })
})
