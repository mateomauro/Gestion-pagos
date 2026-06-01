import { test, expect } from './fixtures'

test.describe('Configuracion', () => {
  test('guardar Mi negocio persiste tras recargar', async ({ authedPage: page }) => {
    await page.goto('/configuracion')

    const nombreInput = page.getByLabel('Nombre del negocio')
    const contactoInput = page.getByLabel('Contacto')

    // Esperar a que cargue el form (puede estar mostrando placeholder loading)
    await expect(nombreInput).toBeVisible()

    await nombreInput.fill('Gym Olimpia Test')
    await contactoInput.fill('IG @gymtest · 11-1234-5678')

    // Click "Guardar" del Mi negocio (es el primer Guardar de la pagina)
    await page.getByRole('button', { name: 'Guardar' }).first().click()

    // Toast de success
    await expect(page.getByText(/guardados/i).first()).toBeVisible({ timeout: 5000 })

    // Reload y esperar a que el form se hidrate con los datos guardados
    await page.reload()
    await page.waitForLoadState('networkidle')

    // El input puede tardar en hidratarse hasta que useNegocio carge de DB
    await expect(nombreInput).toHaveValue('Gym Olimpia Test', { timeout: 15000 })
    await expect(contactoInput).toHaveValue('IG @gymtest · 11-1234-5678', { timeout: 5000 })
  })

  test('preview del recibo PDF se genera (iframe presente)', async ({ authedPage: page }) => {
    await page.goto('/configuracion')

    // Espera ~1s para que el debounce + build del PDF termine
    await page.waitForTimeout(2000)

    // El iframe del recibo debe estar
    const iframe = page.locator('iframe[title="Previa del recibo"]')
    await expect(iframe).toBeVisible()

    // Y debe tener un src con blob:
    const src = await iframe.getAttribute('src')
    expect(src).toMatch(/^blob:/)
    // Con los params anti-toolbar
    expect(src).toContain('#toolbar=0')
  })

  test('preview WhatsApp muestra burbuja', async ({ authedPage: page }) => {
    await page.goto('/configuracion')

    // Scroll hasta la seccion plantillas
    await page.getByRole('heading', { name: 'Plantillas de WhatsApp' }).scrollIntoViewIfNeeded()

    // El toggle Pendiente/Vencido debe estar
    await expect(page.getByRole('button', { name: 'Pendiente', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Vencido', exact: true })).toBeVisible()

    // La burbuja con el nombre del cliente sample
    await expect(page.getByText('Mateo Mauro').first()).toBeVisible()
  })
})
