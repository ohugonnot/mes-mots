import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Quatre navigateurs au lieu d'un par cœur : au-delà, une pointe mémoire fait tuer la
  // porte en plein vol, ce qui coûte plus cher que ce que la parallélisation fait gagner.
  workers: 4,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // on teste sur un format tablette, pas sur un écran de bureau :
      // la taille des cases est une exigence, elle doit être vérifiée à la bonne échelle
      name: 'tablette',
      use: { ...devices['Galaxy Tab S4'], viewport: { width: 800, height: 1280 } },
      testIgnore: /e8-safari/,
    },
    {
      // Le moteur de Safari, celui de la mère : trois chemins du projet n'existent que là,
      // l'orientation des photos, le format d'enregistrement et des propriétés CSS récentes.
      // Une seule suite y tourne, le reste des exigences se vérifie à la taille de la tablette.
      name: 'safari',
      use: { ...devices['iPhone 13'] },
      testMatch: /e8-safari/,
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
})
