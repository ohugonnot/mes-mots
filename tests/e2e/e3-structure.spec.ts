import { test, expect, type Page } from '@playwright/test'

/** Hauteurs arrêtées dans BIBLE.md §5, en part de l'écran. */
const BANDES = { phrase: 0.12, contextes: 0.08, grille: 0.62, barre: 0.18 }

const hauteur = async (page: Page, selecteur: string) =>
  (await page.locator(selecteur).boundingBox())!.height

test.describe('E3 : la structure de l écran', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(13)
  })

  test('les quatre bandes occupent les hauteurs décidées', async ({ page }) => {
    // Réserver ces hauteurs dès maintenant est l'idée centrale du projet : le jour où la
    // famille révèle un mot essentiel, aucune case de la grille ne bouge.
    const ecran = (await page.locator('.ecran').boundingBox())!
    const proche = (mesure: number, part: number, quoi: string) =>
      expect(Math.abs(mesure - ecran.height * part), `${quoi} : ${mesure} px`).toBeLessThan(2)

    proche(await hauteur(page, '[data-contextes]'), BANDES.contextes, 'bande des contextes')
    proche(await hauteur(page, '[data-grille="contexte"]'), BANDES.grille, 'grille')
    proche(await hauteur(page, '[data-grille="barre"]'), BANDES.barre, 'barre des mots essentiels')
  })

  test('la bande du haut existe avant le premier appui', async ({ page }) => {
    // vide mais présente : sa hauteur est réservée, pas conditionnée à son contenu
    const bande = page.locator('[data-bande-phrase]')
    await expect(bande).toBeVisible()
    await expect(bande).toHaveText('')
    expect(await hauteur(page, '[data-bande-phrase]')).toBeGreaterThan(60)
  })

  test('la bande du haut montre la dernière phrase prononcée', async ({ page }) => {
    await page.locator('[data-case="boire"]').click()
    await expect(page.locator('[data-bande-phrase]')).toHaveText('Boire')

    await page.locator('[data-case="maman"]').click()
    await expect(page.locator('[data-bande-phrase]')).toHaveText('Maman')
  })

  test('la barre des mots essentiels réserve cinq emplacements et n en montre aucun', async ({
    page,
  }) => {
    // La convention du domaine veut ces mots toujours visibles, la mère les reporte.
    // Les emplacements existent quand même : les créer plus tard recomposerait la barre.
    const barre = page.locator('[data-grille="barre"]')
    await expect(barre).toBeVisible()
    expect(await barre.evaluate((n) => n.children.length)).toBe(5)
    await expect(barre.locator('[data-case]')).toHaveCount(0)
  })

  test('seul un contexte non vide porte un bouton', async ({ page }) => {
    // Extérieur existe dans la configuration mais ses deux cases sont masquées :
    // un bouton qui mène à un écran vide est une impasse pour l'enfant.
    await expect(page.locator('[data-contexte]')).toHaveCount(2)
    await expect(page.locator('[data-contexte="maison"]')).toBeVisible()
    await expect(page.locator('[data-contexte="exterieur"]')).toHaveCount(0)
  })
})
