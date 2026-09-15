import { test, expect, type Page } from '@playwright/test'
import { ouvrirEspaceParents, ouvrirOngletSauvegarde } from './verrou'

/**
 * D20, la grille sur papier. Batterie vide, tablette oubliée ou cassée : la parade classique
 * en communication alternative est une grille imprimée et plastifiée dans le sac. Le papier
 * doit être le miroir exact de l'écran, sinon l'enfant cherche sur la table un mot qu'il ne
 * voit pas sur sa tablette, et la position, qui est tout l'intérêt, ne correspond plus.
 */
async function enModeImpression(page: Page): Promise<void> {
  await page.emulateMedia({ media: 'print' })
}

test.describe('E14 : la grille sur papier', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
  })

  test('à l impression, l écran de l enfant s efface et les planches paraissent', async ({ page }) => {
    await expect(page.locator('[data-planches-papier]')).not.toBeVisible()

    await enModeImpression(page)

    await expect(page.locator('[data-planches-papier]')).toBeVisible()
    await expect(page.locator('[data-ecran]')).not.toBeVisible()
  })

  test('une feuille par page de mots, et aucune feuille vide', async ({ page }) => {
    await enModeImpression(page)

    // Maison, et les deux pages de « J'ai mal ». Extérieur et la barre n'ont aucun mot
    // révélé : imprimer leurs cases vides ne servirait à personne.
    const titres = await page.locator('[data-feuille] h2').allTextContents()
    expect(titres).toEqual(['Maison', "J'ai mal — page 1", "J'ai mal — page 2"])
  })

  test('le papier montre exactement les mots visibles, et pas un de plus', async ({ page }) => {
    const surEcran = await page.locator('[data-case]').evaluateAll((cases) =>
      cases.map((c) => (c as HTMLElement).dataset.case),
    )
    await enModeImpression(page)

    const surPapier = await page
      .locator('[data-grille-papier="maison"] [data-case-papier]')
      .evaluateAll((cases) => cases.map((c) => (c as HTMLElement).dataset.casePapier).filter(Boolean))

    expect(surPapier).toEqual(surEcran)
  })

  test('un mot occupe sur le papier la place qu il a sur l écran', async ({ page }) => {
    // c'est tout l'intérêt du papier : la même position, pour que le geste appris serve
    const position = async (selecteur: string) => {
      const grille = (await page.locator(selecteur === '[data-case]' ? '[data-grille="contexte"]' : '[data-grille-papier="maison"]').boundingBox())!
      const cases = await page.locator(selecteur).all()
      const rangs: Record<string, string> = {}
      for (const cellule of cases) {
        const id = (await cellule.getAttribute('data-case')) ?? (await cellule.getAttribute('data-case-papier'))
        if (!id) continue
        const boite = (await cellule.boundingBox())!
        const colonne = Math.round(((boite.x - grille.x) / grille.width) * 4)
        const ligne = Math.round(((boite.y - grille.y) / grille.height) * 4)
        rangs[id] = `${ligne}-${colonne}`
      }
      return rangs
    }

    const surEcran = await position('[data-case]')
    await enModeImpression(page)
    const surPapier = await position('[data-grille-papier="maison"] [data-case-papier]')

    expect(surPapier).toEqual(surEcran)
  })

  /**
   * Le dessin est ce que l'enfant reconnaît : sur une feuille posée sur la table, un
   * pictogramme réduit à un timbre au milieu du vide ne se lit plus à bout de bras. La
   * vignette est taillée pour les cartes de l'espace parents, où elle fait 44 px de haut,
   * et rien ne la redimensionnait sur le papier.
   */
  test('sur le papier, le dessin remplit sa case', async ({ page }) => {
    await enModeImpression(page)

    const mesures = await page
      .locator('[data-grille-papier="maison"] [data-case-papier]')
      .first()
      .evaluate((cellule) => {
        const dessin = cellule.querySelector('.dessin')!.getBoundingClientRect()
        const image = cellule.querySelector('[data-vignette]')!.getBoundingClientRect()
        return { dessin: dessin.height, image: image.height }
      })

    expect(mesures.image).toBeGreaterThan(mesures.dessin * 0.8)
  })

  test('le bouton d impression vit à côté de la sauvegarde, deux gestes de la même famille', async ({
    page,
  }) => {
    await ouvrirEspaceParents(page)
    await ouvrirOngletSauvegarde(page)

    await expect(page.locator('[data-imprimer-planches]')).toBeVisible()
    await expect(page.locator('[data-imprimer-planches]')).toContainText('Imprimer')
  })
})
