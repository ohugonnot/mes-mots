import { test, expect, type Page } from '@playwright/test'
import {
  configurationPersistee,
  fermerEspaceParents,
  ouvrirEspaceParents,
  ouvrirOngletReglages,
} from './verrou'

/**
 * La forme de la grille (projet/PLAN-FORME-GRILLE.md). C'est le seul réglage qui déroge à
 * l'invariant du projet, et ce qui se vérifie ici est précisément la part qu'il garde :
 * un mot dont la ligne et la colonne existent encore ne bouge pas d'un rang, et aucun mot
 * n'est perdu, même masqué.
 */

/**
 * Le rang de chaque mot visible, colonne et ligne, mesuré à l'écran de l'enfant. Chaque
 * emplacement de la grille a son élément, occupé ou libre : les abscisses distinctes donnent
 * donc les vraies colonnes, et non seulement celles où un mot est révélé.
 */
async function rangsDesMots(page: Page): Promise<Record<string, { colonne: number; ligne: number }>> {
  return page.locator('[data-grille="contexte"] > *').evaluateAll((cellules) => {
    const boites = cellules.map((cellule) => {
      const boite = cellule.getBoundingClientRect()
      return {
        id: (cellule as HTMLElement).dataset.case ?? null,
        x: Math.round(boite.x),
        y: Math.round(boite.y),
      }
    })
    const abscisses = [...new Set(boites.map((boite) => boite.x))].sort((a, b) => a - b)
    const ordonnees = [...new Set(boites.map((boite) => boite.y))].sort((a, b) => a - b)
    return Object.fromEntries(
      boites
        .filter((boite) => boite.id !== null)
        .map((boite) => [
          boite.id,
          { colonne: abscisses.indexOf(boite.x), ligne: ordonnees.indexOf(boite.y) },
        ]),
    )
  })
}

const colonnesAffichees = (page: Page) =>
  page
    .locator('[data-grille="contexte"] > *')
    .evaluateAll((cellules) => new Set(cellules.map((c) => Math.round(c.getBoundingClientRect().x))).size)

/** Les pages de grille de la configuration enregistrée, à plat, avec leur forme et leurs mots. */
async function pagesEnregistrees(page: Page) {
  const configuration = await configurationPersistee(page)
  const contextes = configuration.contextes as {
    id: string
    pages: {
      id: string
      grid: { rows: number; columns: number; order: (string | null)[][] }
      buttons: { id: string; hidden?: boolean }[]
      ext_mesmots_silhouette?: boolean
    }[]
  }[]
  return contextes.flatMap((contexte) =>
    contexte.pages.map((planche) => ({ idContexte: contexte.id, ...planche })),
  )
}

async function reglerColonnes(page: Page, pas: number) {
  const bouton = pas < 0 ? '[data-forme-moins="colonnes"]' : '[data-forme-plus="colonnes"]'
  for (let reste = Math.abs(pas); reste > 0; reste--) await page.locator(bouton).click()
}

test.describe('la forme de la grille', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-case]').first()).toBeVisible()
  })

  test('rétrécir garde chaque mot qui tient encore à son rang, et ne perd personne', async ({ page }) => {
    const avant = await rangsDesMots(page)
    expect(await colonnesAffichees(page)).toBe(4)

    await ouvrirEspaceParents(page)
    await ouvrirOngletReglages(page)
    await reglerColonnes(page, -1)

    // les comptes viennent des mots réellement posés dans la graine, masqués compris
    await expect(page.locator('[data-forme-consequence]')).toContainText('22 mots garderont leur place')
    await page.locator('[data-forme-changer]').click()
    await expect(page.locator('[data-confirmation-forme]')).toBeVisible()
    await expect(page.locator('[data-consequence-confirmation]')).toContainText(
      '5 mots passeront sur 2 pages nouvelles',
    )
    await page.locator('[data-confirmer-forme]').click()
    await expect(page.locator('[data-confirmation-forme]')).toHaveCount(0)
    await fermerEspaceParents(page)

    expect(await colonnesAffichees(page)).toBe(3)
    const apres = await rangsDesMots(page)
    for (const [id, rang] of Object.entries(avant)) {
      if (rang.colonne >= 3) continue
      expect(apres[id], `${id} a changé de place`).toEqual(rang)
    }

    // les mots de la colonne coupée sont sur une page nouvelle, et aucun n'a disparu
    // l'écriture au dépôt ne bloque pas le clic : lire le magasin sans l'attendre teste une course
    await expect
      .poll(async () => (await pagesEnregistrees(page)).filter((p) => p.idContexte === 'maison').length)
      .toBe(2)
    const pages = await pagesEnregistrees(page)
    const maison = pages.filter((planche) => planche.idContexte === 'maison')
    expect(maison.map((planche) => planche.id)).toEqual(['maison', 'maison-p2'])
    expect(maison[1]!.grid.order[0]).toEqual(['doudou', 'chambre', 'loki'])
    expect(maison[1]!.grid.order[1]).toEqual(['pipi', null, null])
    expect(pages.filter((planche) => !planche.ext_mesmots_silhouette).every((p) => p.grid.columns === 3)).toBe(true)
  })

  test('la forme survit au rechargement de la tablette', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await ouvrirOngletReglages(page)
    await reglerColonnes(page, -1)
    await page.locator('[data-forme-changer]').click()
    await page.locator('[data-confirmer-forme]').click()

    // l'écriture est asynchrone : recharger tout de suite testerait une course
    await expect
      .poll(async () => (await pagesEnregistrees(page)).find((p) => p.id === 'maison')?.grid.columns)
      .toBe(3)
    await page.reload()
    await expect(page.locator('[data-case]').first()).toBeVisible()

    expect(await colonnesAffichees(page)).toBe(3)
    const pages = await pagesEnregistrees(page)
    expect(pages.filter((planche) => planche.idContexte === 'maison')).toHaveLength(2)
  })

  test('garder la grille actuelle ne change rien', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await ouvrirOngletReglages(page)
    await reglerColonnes(page, -1)
    await page.locator('[data-forme-changer]').click()
    await page.locator('[data-garder-forme]').click()

    await expect(page.locator('[data-confirmation-forme]')).toHaveCount(0)
    // le compteur retombe sur la forme en service : rien n'est resté en suspens
    await expect(page.locator('[data-forme-lecture]')).toContainText("Aujourd'hui")
    await fermerEspaceParents(page)

    expect(await colonnesAffichees(page)).toBe(4)
  })

  test('agrandir ne demande rien et ne déplace aucun mot', async ({ page }) => {
    const avant = await rangsDesMots(page)

    await ouvrirEspaceParents(page)
    await ouvrirOngletReglages(page)
    await reglerColonnes(page, 1)

    await expect(page.locator('[data-forme-consequence]')).toContainText('Aucun mot ne changera de place')
    await page.locator('[data-forme-changer]').click()

    // aucun mot ne bouge : le geste s'applique au premier appui, sans bloc à confirmer
    await expect(page.locator('[data-confirmation-forme]')).toHaveCount(0)
    await fermerEspaceParents(page)

    expect(await colonnesAffichees(page)).toBe(5)
    const apres = await rangsDesMots(page)
    for (const [id, rang] of Object.entries(avant)) {
      expect(apres[id], `${id} a changé de place`).toEqual(rang)
    }
  })
})
