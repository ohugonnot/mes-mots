import { test, expect, type Page, type Locator } from '@playwright/test'
import { allumerLeCorpsAToucher, ouvrirEspaceParents } from '../tests/e2e/verrou'

/**
 * Les images de la notice, prises dans l'application réelle et non dessinées à la main :
 * une notice illustrée par des maquettes vieillit sans qu'on le voie, celle-ci se casse
 * comme un test si un écran change. Ce ne sont pas des tests, d'où la configuration à part.
 */

const DOSSIER = 'notice/captures'

async function ecran(page: Page, nom: string) {
  await page.screenshot({ path: `${DOSSIER}/${nom}.png` })
}

async function detail(cible: Locator, nom: string) {
  await cible.scrollIntoViewIfNeeded()
  await cible.screenshot({ path: `${DOSSIER}/${nom}.png` })
}

/** Le cadre qui entoure un réglage, désigné par ce qu'il contient plutôt que par sa place. */
const bloc = (page: Page, dedans: string) =>
  page.locator('fieldset, section, .bloc-reglage').filter({ has: page.locator(dedans) }).last()

/** Une fenêtre posée sur un voile : c'est la fenêtre qu'on veut, pas l'écran assombri. */
const panneau = (page: Page, racine: string) => page.locator(`${racine} .panneau`)

/**
 * Une image qui ressemble à une photo de famille, fabriquée par le navigateur lui-même : le
 * pixel unique des tests ne montrerait rien, et aucune photo d'une personne réelle n'entre
 * au dépôt. Elle illustre « voici ce que vous verrez après avoir choisi une photo ».
 */
async function photoDExemple(page: Page): Promise<Buffer> {
  const atelier = await page.context().newPage()
  await atelier.setViewportSize({ width: 600, height: 600 })
  await atelier.setContent(`
    <style>html,body{margin:0}</style>
    <svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fond" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f6d9a8"/><stop offset="1" stop-color="#e4a76b"/>
        </linearGradient>
      </defs>
      <rect width="600" height="600" fill="url(#fond)"/>
      <circle cx="300" cy="235" r="118" fill="#7d4a2e"/>
      <circle cx="300" cy="250" r="98" fill="#f0c49a"/>
      <circle cx="268" cy="242" r="11" fill="#3b2418"/>
      <circle cx="332" cy="242" r="11" fill="#3b2418"/>
      <path d="M262 292 q38 34 76 0" stroke="#3b2418" stroke-width="10"
            fill="none" stroke-linecap="round"/>
      <path d="M140 600 q0 -180 160 -180 q160 0 160 180 z" fill="#4b7fb5"/>
    </svg>`)
  const octets = await atelier.screenshot()
  await atelier.close()
  return octets
}

test('A. écran de l enfant', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-case]').first()).toBeVisible()
  await ecran(page, 'a1-ecran-enfant')

  await detail(page.locator('[data-contextes]'), 'a2-contextes')
  await detail(page.locator('[data-case="maman"]'), 'a3-une-case')

  // La case vit le temps que son mot est dit : 700 ms, donc on tire tout de suite.
  await page.locator('[data-case="boire"]').click({ noWaitAfter: true })
  await ecran(page, 'a4-case-qui-parle')
  await expect(page.locator('[data-bande-phrase]')).toContainText('Boire')
  await detail(page.locator('[data-bande-phrase]'), 'a5-bande-phrase')
})

test('B. entrer dans l espace parents', async ({ page }) => {
  await page.goto('/')
  const coin = (await page.locator('[data-coin-parents]').boundingBox())!
  await page.mouse.move(coin.x + 8, coin.y + 8)
  await page.mouse.down()
  await page.waitForTimeout(1700)
  // Le haut de l'écran seulement : la barre qui se remplit fait quelques pixels dans l'angle
  // et se perdrait sur une capture de la tablette entière.
  await page.screenshot({
    path: `${DOSSIER}/b1-appui-en-cours.png`,
    clip: { x: 0, y: 0, width: 800, height: 170 },
  })
  await page.waitForTimeout(1600)
  await expect(page.locator('[data-question-parents]')).toBeVisible()
  await page.mouse.up()
  // La question seule : elle est posée sur un voile qui couvre tout l'écran, et sur une capture
  // de la tablette entière l'addition n'est plus lisible une fois l'image réduite à la largeur
  // d'une colonne de texte. On découpe donc la bande où elle se trouve.
  const enonce = (await page.locator('[data-enonce]').boundingBox())!
  const annuler = (await page.locator('[data-abandonner-question]').boundingBox())!
  await page.screenshot({
    path: `${DOSSIER}/b2-question.png`,
    clip: {
      x: 0,
      y: enonce.y - 30,
      width: 800,
      height: annuler.y + annuler.height + 30 - (enonce.y - 30),
    },
  })
})

test('C. onglet « Les mots »', async ({ page }) => {
  await page.goto('/')
  // Trois mots dits avant d'entrer, sinon le journal est vide et ne montre rien.
  for (const mot of ['maman', 'boire', 'doudou']) {
    await page.locator(`[data-case="${mot}"]`).click()
    await page.waitForTimeout(150)
  }
  await ouvrirEspaceParents(page)
  await ecran(page, 'c1-onglet-mots')
  await detail(page.locator('[data-onglets-parents]'), 'c2-onglets')

  await page.locator('[data-onglet-historique] summary').click()
  await expect(page.locator('[data-entree-journal]').first()).toBeVisible()
  await detail(page.locator('[data-onglet-historique]'), 'c3-journal')
  await page.locator('[data-onglet-historique] summary').click()

  await detail(page.locator('[data-case-parent="maman"]'), 'c4-carte-affichee')
  await detail(page.locator('[data-case-parent="pipi"]'), 'c5-carte-masquee')

  await page.locator('[data-actions-contexte] summary').click()
  await detail(page.locator('[data-actions-contexte]'), 'c6-gerer-contextes')
})

test('C bis. déplacer, ajouter, supprimer', async ({ page }) => {
  await page.goto('/')
  await ouvrirEspaceParents(page)

  await page.locator('[data-deplacer-case="doudou"]').click()
  await expect(page.locator('[data-bandeau-deplacement]')).toBeVisible()
  await ecran(page, 'c7-deplacement')
  await detail(page.locator('[data-bandeau-deplacement]'), 'c8-bandeau-deplacement')
  await page.locator('[data-annuler-deplacement]').click()

  // La page Maison est pleine : les emplacements libres sont ailleurs.
  await page.locator('[data-selecteur-planche]').selectOption('exterieur')
  await detail(page.locator('[data-ajouter-case]').first(), 'c9-emplacement-libre')
  await page.locator('[data-selecteur-planche]').selectOption('maison')

  await page.locator('[data-modifier-case="doudou"]').click()
  await page.locator('[data-demander-suppression]').click()
  await expect(page.locator('[data-confirmation-suppression]')).toBeVisible()
  await detail(page.locator('[data-confirmation-suppression]'), 'c10-confirmer-suppression')
  await page.locator('[data-confirmer-suppression]').click()
  await expect(page.locator('[data-bandeau-suppression]')).toBeVisible()
  await detail(page.locator('[data-bandeau-suppression]'), 'c11-rattraper-suppression')
})

test('D. l éditeur d une case', async ({ page }) => {
  await page.goto('/')
  await ouvrirEspaceParents(page)
  await page.locator('[data-modifier-case="maman"]').click()
  const editeur = page.locator('[data-editeur-case]')
  await expect(editeur).toBeVisible()
  await detail(panneau(page, '[data-editeur-case]'), 'd1-editeur-entier')
  await detail(bloc(page, '[data-image="aucune"]'), 'd2-que-montre-la-case')
  await detail(bloc(page, '[data-famille-choisie]'), 'd3-couleur')

  await page.setInputFiles('[data-champ-photo-galerie]', {
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: await photoDExemple(page),
  })
  await expect(page.locator('[data-apercu-photo]')).toBeVisible()
  await detail(bloc(page, '[data-apercu-photo]'), 'd4-photo-choisie')

  await detail(bloc(page, '[data-voix="texte"]'), 'd5-qui-parle')
  await page.locator('[data-voix="texte"]').click()
  await expect(page.locator('[data-voix-tablette]')).toBeVisible()
  await detail(bloc(page, '[data-voix="texte"]'), 'd6-voix-de-la-tablette')

  await page.locator('[data-enregistrer-case]').click()
  await expect(editeur).toBeHidden()
  await detail(page.locator('[data-case-parent="maman"]'), 'd7-carte-avec-photo')
})

test('E. onglet « Réglages »', async ({ page }) => {
  await page.goto('/')
  await ouvrirEspaceParents(page)
  await page.locator('[data-onglet="reglages"]').click()
  await expect(page.locator('[data-reglages-parents]')).toBeVisible()
  await ecran(page, 'e1-reglages')
  await detail(bloc(page, '[data-volume-reglette]'), 'e2-volume')
  await detail(bloc(page, '[data-fermete="assure"]'), 'e3-appui')
  await detail(bloc(page, '[data-reglage-animations]'), 'e4-ecran-enfant')
  await detail(bloc(page, '[data-forme-apercu]'), 'e5-forme-grille')
  await detail(bloc(page, '[data-version]'), 'e6-application')

  await page.locator('[data-forme-moins="colonnes"]').click()
  await detail(bloc(page, '[data-forme-apercu]'), 'e7-forme-modifiee')
  await page.locator('[data-forme-changer]').click()
  await expect(page.locator('[data-confirmation-forme]')).toBeVisible()
  await detail(page.locator('[data-confirmation-forme]'), 'e8-confirmer-forme')
  await page.locator('[data-garder-forme]').click()
})

test('F. onglet « Sauvegarde »', async ({ page }) => {
  await page.goto('/')
  await ouvrirEspaceParents(page)
  await page.locator('[data-onglet="sauvegarde"]').click()
  await expect(page.locator('[data-onglet-sauvegarde]')).toBeVisible()
  await ecran(page, 'f1-sauvegarde')
  await detail(page.locator('[data-etat-tablette]'), 'f2-etat-tablette')

  const telechargement = page.waitForEvent('download')
  await page.locator('[data-sauvegarder]').click()
  const fichier = await telechargement
  await expect(page.locator('[data-compte-rendu-sauvegarde]')).toBeVisible()
  await detail(panneau(page, '[data-compte-rendu-sauvegarde]'), 'f3-compte-rendu')
  await page.locator('[data-fermer-compte-rendu]').click()

  await page.setInputFiles('[data-fichier-restauration]', (await fichier.path())!)
  await expect(page.locator('[data-apercu-restauration]')).toBeVisible()
  await detail(panneau(page, '[data-apercu-restauration]'), 'f4-apercu-restauration')
  await page.locator('[data-annuler-restauration]').click()

  await page.locator('[data-demander-effacement]').click()
  await expect(page.locator('[data-confirmation-effacement]')).toBeVisible()
  await detail(page.locator('[data-confirmation-effacement]'), 'f5-effacement')
})

test('G. le rappel de sauvegarde', async ({ page }) => {
  await page.goto('/')
  await ouvrirEspaceParents(page)
  await page.locator('[data-case-parent="pipi"]').click()
  await page.locator('[data-fermer-parents]').click()
  await expect(page.locator('[data-rappel-sauvegarde]')).toBeVisible()
  await detail(panneau(page, '[data-rappel-sauvegarde]'), 'g1-rappel-sauvegarde')
})

test('H. les planches sur papier', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-case]').first()).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await detail(page.locator('[data-feuille]').first(), 'h1-feuille-papier')
  await page.emulateMedia({ media: 'screen' })
})

test('I. « J ai mal »', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-contexte="douleur"]').click()
  await expect(page.locator('[data-case="mal-ventre"]')).toBeVisible()
  await ecran(page, 'i1-douleur')
  await page.locator('[data-page-suivante]').click()
  await expect(page.locator('[data-case="mal-yeux"]')).toBeVisible()
  await ecran(page, 'i2-visage')

  // les corps sont éteints à la livraison, mais la notice les montre : c'est l'autre moitié
  // du chapitre, et le parent doit reconnaître l'écran avant de l'allumer
  await allumerLeCorpsAToucher(page)
  await page.locator('[data-contexte="douleur"]').click()
  await expect(page.locator('[data-silhouette]')).toBeVisible()
  // Les contours des zones ne se montrent que 2,6 s à l'ouverture : on tire pendant.
  await ecran(page, 'i3-corps')
})

test('J. changer de page', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-contexte="douleur"]').click()
  await expect(page.locator('[data-pagination]')).toBeVisible()
  await detail(page.locator('[data-pagination]'), 'j1-pagination')
})

test('K. enchaîner des mots', async ({ page }) => {
  await page.goto('/')
  await ouvrirEspaceParents(page)
  await page.locator('[data-onglet="reglages"]').click()
  await detail(bloc(page, '[data-reglage-enchainement]'), 'k1-reglage')
  await page.locator('[data-reglage-enchainement]').check()
  await page.locator('[data-fermer-parents]').click()
  const plusTard = page.locator('[data-plus-tard]')
  if (await plusTard.isVisible()) await plusTard.click()

  for (const mot of ['maman', 'boire', 'promenade']) {
    await page.locator(`[data-case="${mot}"]`).click()
    await page.waitForTimeout(150)
  }
  await ecran(page, 'k2-mots-enchaines')
  await detail(page.locator('[data-bande-phrase]'), 'k3-bande-enchainement')
})
