import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config para tests E2E de CobroGest.
 * Apunta al dev server en localhost:5174 (vite --strictPort).
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,             // los tests modifican la DB del test user, mejor secuencial
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,                       // un solo worker para evitar race conditions en DB
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // 30s default por accion; auth y carga inicial pueden tardar
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
