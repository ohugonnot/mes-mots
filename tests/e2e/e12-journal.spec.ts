import { test, expect, type Page } from '@playwright/test'
import { ouvrirEspaceParents, deplierLeJournal, ouvrirOngletSauvegarde } from './verrou'

/**
 * Le journal de la journée, demandé par la mère : « la liste de ce qu'il a demandé dans la
 * journée, avec l'heure », effacée à minuit. Sa condition compte autant que sa demande, et
 * c'est celle-là qui se teste le plus mal : il faut poser une entrée d'hier à la main.
 */

/** Pose une entrée directement dans le magasin, pour simuler un autre jour. */
async function poserAuJournal(page: Page, horodatage: number, mot: string): Promise<void> {
  await page.evaluate(
    async ({ horodatage, mot }) => {
      const base = await new Promise<IDBDatabase>((ok, ko) => {
        const requete = indexedDB.open('mes-mots')
        requete.onsuccess = () => ok(requete.result)
        requete.onerror = () => ko(requete.error)
      })
      await new Promise<void>((ok, ko) => {
        const transaction = base.transaction('journal', 'readwrite')
        transaction.objectStore('journal').put({ horodatage, mot }, horodatage)
        transaction.oncomplete = () => ok()
        transaction.onerror = () => ko(transaction.error)
      })
    },
    { horodatage, mot },
  )
}

async function motsDuJournal(page: Page): Promise<string[]> {
  return page.locator('[data-entree-journal]').allTextContents()
}

test.describe('E12 : le journal de la journée', () => {
  test('ce que l enfant demande apparaît avec son heure, le plus récent en haut', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)

    await page.locator('[data-case="maman"]').click()
    await page.locator('[data-case="boire"]').click()

    await ouvrirEspaceParents(page)
    await deplierLeJournal(page)

    await expect(page.locator('[data-entree-journal]')).toHaveCount(2)
    // BOIRE a été demandé après MAMAN : c'est lui qu'on lit en premier, sans dérouler
    const lignes = await motsDuJournal(page)
    expect(lignes[0]).toContain('BOIRE')
    expect(lignes[1]).toContain('MAMAN')
    // l'heure, pas un compteur : la mère a demandé une liste, pas des statistiques
    expect(lignes[0]).toMatch(/\d{2}:\d{2}/)
  })

  test('la liste se vide toute seule au premier démarrage du lendemain', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await page.locator('[data-case="maman"]').click()

    // une entrée d'hier, comme si la tablette avait été éteinte pendant la nuit
    const hier = Date.now() - 24 * 60 * 60 * 1000
    await poserAuJournal(page, hier, 'DOUDOU')
    await page.reload()
    await expect(page.locator('[data-case]')).toHaveCount(13)

    await ouvrirEspaceParents(page)
    await deplierLeJournal(page)

    const lignes = await motsDuJournal(page)
    expect(lignes.join(' '), "l'entrée d'hier survit").not.toContain('DOUDOU')
    expect(lignes.join(' ')).toContain('MAMAN')
  })

  test('une journée sans rien dit ce qu il en est, au lieu de laisser un blanc', async ({ page }) => {
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await deplierLeJournal(page)

    await expect(page.locator('[data-journal-vide]')).toContainText('chaque nuit')
    await expect(page.locator('[data-entree-journal]')).toHaveCount(0)
  })

  test('effacer toute la configuration emporte aussi le journal', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-case="maman"]').click()
    await ouvrirEspaceParents(page)
    await deplierLeJournal(page)
    await expect(page.locator('[data-entree-journal]')).toHaveCount(1)

    await ouvrirOngletSauvegarde(page)
    await page.locator('[data-demander-effacement]').click()
    await page.locator('[data-confirmer-effacement]').click()

    // on reste dans l'espace parents : le geste suivant est presque toujours « restaurer »,
    // et refermer obligeait à refaire l'appui long puis l'addition
    await expect(page.locator('[data-espace-parents]')).toBeVisible()
    await page.locator('[data-onglet="mots"]').click()
    await deplierLeJournal(page)
    await expect(page.locator('[data-entree-journal]')).toHaveCount(0)
  })

  test('le journal ne retarde pas le mot que l enfant demande', async ({ page }) => {
    // il s'écrit sans qu'on l'attende : la latence de la parole est une exigence du projet
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)

    const debut = await page.evaluate(() => performance.now())
    await page.locator('[data-case="maman"]').click()
    await expect(page.locator('[data-bande-phrase]')).toContainText('Maman')
    const ecoule = await page.evaluate((d) => performance.now() - d, debut)

    expect(ecoule, 'le mot met trop longtemps à s afficher').toBeLessThan(500)
  })
})

test.describe('E12 : le journal se traverse', () => {
  test('une journée bavarde ne crée pas un défilement dans le défilement', async ({ page }) => {
    // Il y en avait un dès dix entrées, haut de 40vh, sans rien pour marquer sa frontière :
    // un doigt faisait défiler la liste ou la page selon dix pixels d'écart.
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
    const maintenant = Date.now()
    for (let rang = 0; rang < 18; rang += 1) {
      // trois heures distinctes, pour que le découpage ait quelque chose à découper
      await poserAuJournal(page, maintenant - rang * 20 * 60 * 1000, `MOT${rang}`)
    }
    await page.reload()
    await expect(page.locator('[data-case]')).toHaveCount(13)

    await ouvrirEspaceParents(page)
    await deplierLeJournal(page)
    await expect(page.locator('[data-entree-journal]')).toHaveCount(18)

    const defilements = await page.evaluate(() =>
      [...document.querySelectorAll('[data-onglet-historique] *')]
        .filter((n) => n.scrollHeight > n.clientHeight + 1)
        .map((n) => `${n.tagName}.${(n as HTMLElement).className}`),
    )
    expect(defilements, 'la liste défile à part de la page').toEqual([])

    // les heures sont le repère qui remplace le mur de lignes identiques
    const heures = await page.locator('[data-heure-journal]').allTextContents()
    expect(heures.length).toBeGreaterThan(1)
    expect(heures[0]).toMatch(/Vers /)
  })

  test('replié, il annonce le dernier mot dit', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await page.locator('[data-case="maman"]').click()
    await page.locator('[data-case="boire"]').click()

    await ouvrirEspaceParents(page)
    // sans déplier : c'est justement ce que la ligne fermée doit dire
    await expect(page.locator('[data-dernier-dit]')).toContainText('BOIRE')
    await expect(page.locator('[data-dernier-dit]')).toHaveText(/\d{2}:\d{2}/)
  })
})
