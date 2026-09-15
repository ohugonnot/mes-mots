import { defineConfig, devices } from '@playwright/test'

/**
 * Configuration à part pour les captures de la notice : ce ne sont pas des tests, elles ne
 * doivent pas tourner dans la porte. Un seul ouvrier, parce que les captures se suivent et
 * qu'un écran de moitié rempli ne se rattrape pas.
 */
export default defineConfig({
  testDir: '.',
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Galaxy Tab S4'],
    viewport: { width: 800, height: 1280 },
    deviceScaleFactor: 2,
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    cwd: '..',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180000,
  },
})
