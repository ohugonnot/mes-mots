import { test, expect, type Page } from '@playwright/test'

const CASES_REVELEES = 13

declare global {
  interface Window {
    __demandesDePersistance: number
  }
}

/**
 * Lit ou écrit la planche directement dans IndexedDB, en IDB brut : `idb` ne peut pas
 * être importé dans le contexte de la page. C'est le seul moyen de prouver que
 * l'application lit le dépôt et non sa constante.
 */
async function configurationDuDepot(
  page: Page,
): Promise<{
  boutons: number
  masquees: number
  emplacementsBarre: number
  retourAutomatique?: boolean
} | null> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase | null>((ok) => {
      const requete = indexedDB.open('mes-mots')
      requete.onsuccess = () => ok(requete.result)
      requete.onerror = () => ok(null)
    })
    if (!db || !db.objectStoreNames.contains('config')) return null
    type CaseStockee = { hidden?: boolean }
    type ConfigurationStockee = {
      contextes: { pages: { buttons: CaseStockee[] }[] }[]
      barre: { grid: { order: (string | null)[][] } }
      reglages: { retourAutomatique: boolean }
    }
    const config = await new Promise<ConfigurationStockee | undefined>((ok) => {
      const lecture = db.transaction('config').objectStore('config').get('configuration')
      lecture.onsuccess = () => ok(lecture.result)
      lecture.onerror = () => ok(undefined)
    })
    if (!config) return null
    const cases = config.contextes.flatMap((c) => c.pages).flatMap((p) => p.buttons)
    return {
      boutons: cases.length,
      masquees: cases.filter((c) => c.hidden === true).length,
      emplacementsBarre: config.barre.grid.order.flat().length,
      retourAutomatique: config.reglages?.retourAutomatique,
    }
  })
}

async function masquerDansLeDepot(page: Page, id: string): Promise<void> {
  await page.evaluate(async (idCase) => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const requete = indexedDB.open('mes-mots')
      requete.onsuccess = () => ok(requete.result)
      requete.onerror = () => ko(requete.error)
    })
    const magasin = db.transaction('config', 'readwrite').objectStore('config')
    const config = await new Promise<{
      contextes: { pages: { buttons: { id: string; hidden?: boolean }[] }[] }[]
    }>((ok) => {
      const lecture = magasin.get('configuration')
      lecture.onsuccess = () => ok(lecture.result)
    })
    config.contextes[0]!.pages[0]!.buttons.find((c) => c.id === idCase)!.hidden = true
    await new Promise<void>((ok) => {
      const ecriture = magasin.put(config, 'configuration')
      ecriture.onsuccess = () => ok()
    })
  }, id)
}

test.describe('E2 : la configuration vit sur la tablette', () => {
  test.beforeEach(async ({ page }) => {
    // Sonde injectée par le test : en mode sans tête le navigateur refuse la
    // persistance, donc on vérifie que l'application la demande, pas qu'il l'accorde.
    await page.addInitScript(() => {
      window.__demandesDePersistance = 0
      const origine = navigator.storage.persist.bind(navigator.storage)
      Object.defineProperty(navigator.storage, 'persist', {
        value: () => {
          window.__demandesDePersistance += 1
          return origine()
        },
      })
    })
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(CASES_REVELEES)
  })

  test('la configuration est semée dans le dépôt au premier lancement', async ({ page }) => {
    const depose = await configurationDuDepot(page)
    expect(depose, 'aucune configuration dans IndexedDB').not.toBeNull()
    // 18 pour Maison et Extérieur, plus les 19 de la planche de la douleur
    expect(depose!.boutons, 'cases des contextes').toBe(37)
    expect(depose!.masquees, 'cases masquées').toBe(5)
    expect(depose!.emplacementsBarre, 'emplacements de la barre').toBe(5)
    expect(depose!.retourAutomatique, 'réglage du retour automatique semé').toBe(true)
  })

  test('la configuration survit à un rechargement', async ({ page }) => {
    await page.reload()
    await expect(page.locator('[data-case]')).toHaveCount(CASES_REVELEES)
    await expect(page.locator('[data-case="loki"]')).toHaveCount(0)
  })

  test('l application lit le dépôt et non la constante du code', async ({ page }) => {
    // La preuve du lot : on masque OUI dans le dépôt, sans toucher au code, et l'écran
    // doit en tenir compte au rechargement. C'est aussi ce qui rendra l'application
    // générique, la vraie planche entrant par import.
    await masquerDansLeDepot(page, 'oui')
    await page.reload()

    await expect(page.locator('[data-case]')).toHaveCount(CASES_REVELEES - 1)
    await expect(page.locator('[data-case="oui"]')).toHaveCount(0)
    await expect(page.locator('[data-case="non"]')).toHaveCount(1)
  })

  test('masquer une case dans le dépôt ne déplace aucune autre', async ({ page }) => {
    // l'invariant du projet tient aussi quand la configuration change de source
    const position = async (id: string) => (await page.locator(`[data-case="${id}"]`).boundingBox())!
    const avant = await position('non')

    await masquerDansLeDepot(page, 'oui')
    await page.reload()
    const apres = await position('non')

    expect(Math.abs(apres.x - avant.x), 'NON a changé de colonne').toBeLessThan(1.5)
    expect(Math.abs(apres.y - avant.y), 'NON a changé de ligne').toBeLessThan(1.5)
  })

  test('le stockage persistant est demandé au système', async ({ page }) => {
    // sans cette demande, un navigateur à court de place peut purger la configuration
    await expect
      .poll(() => page.evaluate(() => window.__demandesDePersistance))
      .toBeGreaterThan(0)
  })
})
