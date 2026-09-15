import { test, expect, type Page } from '@playwright/test'
import { fermerEspaceParents, ouvrirEspaceParents, ouvrirGestionContextes } from './verrou'

type Rectangle = { x: number; y: number; width: number; height: number }

/** Un pixel PNG, comme dans e7 : de quoi traverser createImageBitmap pour de vrai. */
const PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

async function rectangleDe(page: Page, selecteur: string): Promise<Rectangle> {
  const boite = await page.locator(selecteur).boundingBox()
  expect(boite, `${selecteur} absent de l'écran`).not.toBeNull()
  return boite!
}

/** Libellés du sélecteur de contexte, dans leur ordre d'affichage. */
async function libellesDuSelecteur(page: Page): Promise<string[]> {
  return page.locator('[data-selecteur-planche] option').allTextContents()
}

async function creerContexte(page: Page, nom: string): Promise<void> {
  await ouvrirGestionContextes(page)
  await page.locator('[data-nouveau-contexte]').click()
  await page.locator('[data-champ-nom-contexte]').fill(nom)
  await page.locator('[data-valider-contexte]').click()
}

/**
 * Lit les noms de contextes directement dans IndexedDB, comme e4-espace-parents.spec.ts :
 * la seule preuve qu'une création est écrite, et non seulement affichée.
 */
async function nomsDeContextesPersistes(page: Page): Promise<string[] | undefined> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase | null>((ok) => {
      const requete = indexedDB.open('mes-mots')
      requete.onsuccess = () => ok(requete.result)
      requete.onerror = () => ok(null)
    })
    if (!db || !db.objectStoreNames.contains('config')) return undefined
    type ConfigurationStockee = { contextes: { name: string }[] }
    const config = await new Promise<ConfigurationStockee | undefined>((ok) => {
      const lecture = db.transaction('config').objectStore('config').get('configuration')
      lecture.onsuccess = () => ok(lecture.result)
      lecture.onerror = () => ok(undefined)
    })
    return config?.contextes.map((c) => c.name)
  })
}

test.describe('E10 : contextes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
  })

  test('créer un contexte l ajoute en dernière position sans toucher les autres', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await expect(libellesDuSelecteur(page)).resolves.toEqual(['Maison', 'Extérieur', "J'ai mal", 'Mots essentiels'])

    await creerContexte(page, 'Jardin')

    // la barre des mots essentiels n'est pas un contexte : elle reste après le nouveau venu
    await expect(libellesDuSelecteur(page)).resolves.toEqual(['Maison', 'Extérieur', "J'ai mal", 'Jardin', 'Mots essentiels'])
  })

  test('un contexte neuf reste invisible chez l enfant tant qu aucun mot n y est révélé, puis se pose à droite', async ({
    page,
  }) => {
    await ouvrirEspaceParents(page)
    await creerContexte(page, 'Jardin')
    await fermerEspaceParents(page)

    // pas de bouton pour un contexte sans aucune case révélée (même règle que Extérieur)
    // Maison et « J'ai mal » sont servis prêts à l'emploi, Extérieur attend d'être révélé
    await expect(page.locator('[data-contexte]')).toHaveCount(2)
    const boutonMaison = await rectangleDe(page, '[data-contexte="maison"]')

    await ouvrirEspaceParents(page)
    await page.locator('[data-selecteur-planche]').selectOption({ label: 'Jardin' })
    await page.locator('[data-ajouter-case]').first().click()
    await page.locator('[data-champ-label]').fill('BALLON')
    await page.locator('[data-champ-vocalization]').fill('Je veux mon ballon')
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)

    await expect(page.locator('[data-contexte]')).toHaveCount(3)
    const boutons = page.locator('[data-contexte]')
    await expect(boutons.nth(0)).toHaveAttribute('data-contexte', 'maison')
    // Jardin n'a pas d'image : son nom s'affiche, c'est le seul repère qu'il ait
    await expect(boutons.nth(2)).toHaveText('Jardin')
    const boutonJardin = (await boutons.nth(2).boundingBox())!
    expect(boutonJardin.x, 'Jardin devrait se poser à droite de Maison').toBeGreaterThan(
      boutonMaison.x + boutonMaison.width,
    )
  })

  test('un nom vide affiche une erreur et ne crée rien', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await ouvrirGestionContextes(page)
    await page.locator('[data-nouveau-contexte]').click()
    await page.locator('[data-valider-contexte]').click()

    await expect(page.locator('[data-erreur-contexte]')).toContainText('nom')
    // le formulaire reste ouvert : rien n'a été validé en silence
    await expect(page.locator('[data-formulaire-contexte]')).toBeVisible()
    await expect(libellesDuSelecteur(page)).resolves.toEqual(['Maison', 'Extérieur', "J'ai mal", 'Mots essentiels'])
  })

  test('un nom déjà porté est refusé, et rien ne part au dépôt', async ({ page }) => {
    // l'enfant ne lit pas : deux boutons du même nom lui ouvrent deux mondes qu'il ne peut
    // pas distinguer. Et sa mère, dyslexique, tape le nom sans son accent (D21).
    await ouvrirEspaceParents(page)
    await creerContexte(page, 'exterieur')

    await expect(page.locator('[data-erreur-contexte]')).toContainText('Extérieur')
    await expect(page.locator('[data-formulaire-contexte]')).toBeVisible()
    await expect(libellesDuSelecteur(page)).resolves.toEqual(['Maison', 'Extérieur', "J'ai mal", 'Mots essentiels'])
    await expect(nomsDeContextesPersistes(page)).resolves.toEqual(['Maison', 'Extérieur', "J'ai mal"])
  })

  test('renommer un contexte change son libellé partout, ses mots restent en place', async ({ page }) => {
    await ouvrirEspaceParents(page)
    // Maison est déjà le contexte choisi par défaut : premier de la liste
    await ouvrirGestionContextes(page)
    await page.locator('[data-renommer-contexte]').click()
    await page.locator('[data-champ-nom-contexte]').fill('Chalet')
    await page.locator('[data-valider-contexte]').click()

    await expect(libellesDuSelecteur(page)).resolves.toEqual(['Chalet', 'Extérieur', "J'ai mal", 'Mots essentiels'])
    await fermerEspaceParents(page)

    // même id, seul le nom a changé : Maison reste adressable comme 'maison'. Le bouton
    // porte une image, donc le nom vit dans son étiquette d'accessibilité, pas à l'écran.
    await expect(page.locator('[data-contexte="maison"]')).toHaveAttribute('aria-label', 'Chalet')
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await expect(page.locator('[data-case="maman"]')).toContainText('MAMAN')
  })

  test('la confirmation de suppression nomme le contexte, ses mots, et prévient du décalage', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await ouvrirGestionContextes(page)
    await page.locator('[data-supprimer-contexte]').click()

    // 16 boutons dans Maison : 13 révélés, LOKI, VENUM et PIPI encore masqués
    const confirmation = page.locator('[data-confirmation-contexte]')
    await expect(confirmation).toContainText('Maison')
    await expect(confirmation).toContainText('16 mots')
    await expect(confirmation).toContainText('avanceront')

    await page.locator('[data-confirmer-suppression-contexte]').click()

    await expect(libellesDuSelecteur(page)).resolves.toEqual(['Extérieur', "J'ai mal", 'Mots essentiels'])
  })

  test('annuler une suppression remet le contexte à sa place d origine, pas en queue', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await creerContexte(page, 'Jardin')
    await expect(libellesDuSelecteur(page)).resolves.toEqual(['Maison', 'Extérieur', "J'ai mal", 'Jardin', 'Mots essentiels'])

    // la liste s'est placée sur Jardin en le créant : on revient sur Maison pour la supprimer
    await page.locator('[data-selecteur-planche]').selectOption({ label: 'Maison' })
    await ouvrirGestionContextes(page)
    await page.locator('[data-supprimer-contexte]').click()
    await page.locator('[data-confirmer-suppression-contexte]').click()
    await expect(libellesDuSelecteur(page)).resolves.toEqual(['Extérieur', "J'ai mal", 'Jardin', 'Mots essentiels'])

    await page.locator('[data-annuler-contexte]').click()

    await expect(libellesDuSelecteur(page)).resolves.toEqual(['Maison', 'Extérieur', "J'ai mal", 'Jardin', 'Mots essentiels'])
  })

  test('l image choisie pour un bouton se voit chez l enfant, et survit au redémarrage', async ({
    page,
  }) => {
    // L'enfant ne lit pas : sans image, un contexte créé par la famille n'est qu'un mot
    // écrit en haut de son écran. Le redémarrage compte double : c'est là que le balayage
    // des orphelins efface les blobs qu'aucune référence ne réclame plus.
    await ouvrirEspaceParents(page)
    await creerContexte(page, 'Jardin')
    await page.locator('[data-ajouter-case]').first().click()
    await page.locator('[data-champ-label]').fill('BALLON')
    await page.locator('[data-champ-vocalization]').fill('Je veux mon ballon')
    await page.locator('[data-enregistrer-case]').click()

    await ouvrirGestionContextes(page)
    await page.setInputFiles('[data-champ-image-contexte]', {
      name: 'jardin.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PIXEL_PNG_BASE64, 'base64'),
    })
    await expect(page.locator('[data-champ-image-contexte]').locator('..').locator('img')).toBeVisible()
    await fermerEspaceParents(page)

    const bouton = page.locator('[data-contexte="jardin"]')
    await expect(bouton.locator('img')).toBeVisible()

    await page.reload()
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await expect(bouton.locator('img')).toBeVisible()
  })

  test('cinq contextes et la pagination tiennent dans la barre, sans rien rogner', async ({ page }) => {
    // D22 : le maximum de cinq vient d'un calcul sur les boutons seuls, alors que la barre
    // réserve aussi la place de la pagination. Personne ne l'avait mesuré sur la vraie barre,
    // et un débordement y est invisible : elle est en overflow caché.
    await ouvrirEspaceParents(page)
    // Extérieur est livré tout masqué : un mot révélé lui donne son bouton
    await page.locator('[data-selecteur-planche]').selectOption({ label: 'Extérieur' })
    await page.locator('[data-case-parent="magasin"]').click()
    for (const nom of ['Chez papi', 'À l école']) {
      await creerContexte(page, nom)
      await page.locator('[data-ajouter-case]').first().click()
      await page.locator('[data-champ-label]').fill('BALLON')
      await page.locator('[data-champ-vocalization]').fill('Je veux mon ballon')
      await page.locator('[data-enregistrer-case]').click()
    }
    await fermerEspaceParents(page)

    // La place de la pagination est promise réservée : elle ne doit pas se laisser écraser
    // par cinq boutons, sinon ceux-ci reculent dès qu'un contexte à deux pages est ouvert,
    // et l'enfant ne retrouve plus ses mondes au même endroit.
    const positions = async () =>
      Object.fromEntries(
        await Promise.all(
          (await page.locator('[data-contexte]').all()).map(async (bouton) => [
            await bouton.getAttribute('data-contexte'),
            Math.round((await bouton.boundingBox())!.x),
          ]),
        ),
      )
    const largeurPagination = async () => Math.round((await page.locator('[data-pagination]').boundingBox())!.width)

    const avant = await positions()
    const placeReservee = await largeurPagination()
    // « J'ai mal » a deux pages : c'est là que le contrôle de pagination apparaît vraiment
    await page.locator('[data-contexte="douleur"]').click()
    await expect(page.locator('[data-page-suivante]')).toBeVisible()

    expect(await largeurPagination(), 'la place réservée à la pagination a été écrasée').toBe(placeReservee)
    expect(await positions(), 'les boutons de contexte ont bougé').toEqual(avant)

    // le téléphone de la mère autant que la tablette : c'est là que la barre est la plus
    // courte, et les deux contextes qu'on vient de créer n'ont pas encore d'image, donc
    // gardent leur nom écrit
    for (const taille of [
      { width: 800, height: 1280 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(taille)
      const barre = (await page.locator('[data-contextes]').boundingBox())!
      const boutons = await page.locator('[data-contexte]').all()
      expect(boutons, 'cinq contextes, donc cinq boutons').toHaveLength(5)
      for (const bouton of boutons) {
        const boite = (await bouton.boundingBox())!
        const nom = `${await bouton.textContent()} en ${taille.width}`
        expect(boite.x, `${nom} commence hors de la barre`).toBeGreaterThanOrEqual(barre.x - 1)
        expect(boite.x + boite.width, `${nom} finit hors de la barre`).toBeLessThanOrEqual(
          barre.x + barre.width + 1,
        )
        expect(boite.width, `${nom} écrasé à rien`).toBeGreaterThan(30)
      }
    }
  })

  test('un contexte créé survit à un rechargement de la page', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await creerContexte(page, 'Jardin')
    await fermerEspaceParents(page)

    // l'écriture dans IndexedDB est asynchrone : attendre qu'elle soit vraiment posée
    // avant de recharger, sinon le test rejoue une course qui n'a rien à voir avec le bug
    await expect.poll(() => nomsDeContextesPersistes(page)).toContain('Jardin')

    await page.reload()
    await expect(page.locator('[data-case]')).toHaveCount(13)

    await ouvrirEspaceParents(page)
    await expect(libellesDuSelecteur(page)).resolves.toEqual(['Maison', 'Extérieur', "J'ai mal", 'Jardin', 'Mots essentiels'])
  })
})
