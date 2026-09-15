import type { Page } from '@playwright/test'

declare global {
  interface Window {
    __urlsObjet: { creees: number; revoquees: number }
  }
}

/**
 * Sonde de fuite d'URL d'objet, injectée par le test et jamais livrée : compte les appels à
 * `URL.createObjectURL` et `URL.revokeObjectURL`, comme `observerLesSons` compte les sons
 * dans e1-grille-qui-parle.spec.ts.
 */
export async function observerUrlsObjet(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const compte = { creees: 0, revoquees: 0 }
    Object.defineProperty(window, '__urlsObjet', { value: compte })
    const creerOrigine = URL.createObjectURL.bind(URL)
    const revoquerOrigine = URL.revokeObjectURL.bind(URL)
    Object.defineProperty(URL, 'createObjectURL', {
      value: (objet: Blob) => {
        compte.creees += 1
        return creerOrigine(objet)
      },
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: (url: string) => {
        compte.revoquees += 1
        revoquerOrigine(url)
      },
    })
  })
}

export const compterUrlsObjet = (page: Page) => page.evaluate(() => window.__urlsObjet)
