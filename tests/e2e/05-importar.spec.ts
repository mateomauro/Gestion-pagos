import { test, expect } from './fixtures'

test.describe('Importar lista de clientes', () => {
  test('camino pegar: parsea tab-separated y muestra preview', async ({ authedPage: page }) => {
    await page.goto('/clientes')

    // Abrir dialog
    await page.getByRole('button', { name: 'Importar' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Elegir el camino "Pegar"
    await page.getByRole('button', { name: /pegar/i }).first().click()

    // El textarea debe aparecer
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible()

    // Pegar datos tab-separated (como copy de Excel/Sheets)
    const futureDate = (() => {
      const d = new Date(); d.setDate(d.getDate() + 10)
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    })()
    const tsv = [
      ['Nombre', 'Telefono', 'Servicio', 'Monto', 'Vencimiento'].join('\t'),
      ['Pedro Test', '5491100000000', 'Cuota mensual', '12000', futureDate].join('\t'),
      ['Ana Test',   '5491200000000', 'Cuota mensual', '12000', futureDate].join('\t'),
    ].join('\n')

    await textarea.fill(tsv)

    // Esperar a que aparezca el preview con "2 listos para cargar"
    await expect(page.getByText(/2 listos/i)).toBeVisible({ timeout: 5000 })

    // Boton "Importar 2" debe estar habilitado
    const importBtn = page.getByRole('button', { name: /^Importar 2/i })
    await expect(importBtn).toBeEnabled()

    // Importar
    await importBtn.click()

    // Toast de success
    await expect(page.getByText(/2 clientes cargados/i)).toBeVisible({ timeout: 5000 })

    // Los clientes deben aparecer en la lista
    await expect(page.getByText('Pedro Test')).toBeVisible()
    await expect(page.getByText('Ana Test')).toBeVisible()
  })

  test('camino plantilla: boton descargar disponible', async ({ authedPage: page }) => {
    await page.goto('/clientes')
    await page.getByRole('button', { name: 'Importar' }).click()
    await page.getByRole('button', { name: /plantilla/i }).first().click()

    // Los 2 botones del camino plantilla
    await expect(page.getByRole('button', { name: /^Descargar$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Subir$/ })).toBeVisible()
  })
})
