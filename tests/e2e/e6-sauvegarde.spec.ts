import { statSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { ouvrirEspaceParents, ouvrirGestionContextes, ouvrirOngletSauvegarde } from './verrou'
import { ajouterPhotoPersonnalisee, ajouterSonPersonnalise, imagePersonnaliseeExiste, sonPersonnaliseExiste } from './mediaPersonnalise'
import { compterUrlsObjet, observerUrlsObjet } from './sondeUrls'

/** Les 13 cases révélées du contexte Maison, dans l'ordre de lecture de `grid.order`. */
const IDS_MAISON = [
  'maman', 'papa', 'moi', 'doudou', 'boire', 'manger', 'douche', 'chambre',
  'voiture', 'tablette', 'promenade', 'oui', 'non',
]

type Rectangle = { x: number; y: number; width: number; height: number }

async function rectangleDe(page: Page, selecteur: string): Promise<Rectangle> {
  const boite = await page.locator(selecteur).boundingBox()
  expect(boite, `${selecteur} absent de l'écran`).not.toBeNull()
  return boite!
}

function memeRectangle(apres: Rectangle, avant: Rectangle, quoi: string): void {
  expect(Math.abs(apres.x - avant.x), `${quoi} a changé de colonne`).toBeLessThan(1.5)
  expect(Math.abs(apres.y - avant.y), `${quoi} a changé de ligne`).toBeLessThan(1.5)
  expect(Math.abs(apres.width - avant.width), `${quoi} a changé de largeur`).toBeLessThan(1.5)
  expect(Math.abs(apres.height - avant.height), `${quoi} a changé de hauteur`).toBeLessThan(1.5)
}

/** Un test qui « remet tout à zéro » doit repartir d'un dépôt réellement vide, pas d'un onglet neuf. */
async function effacerDepotEtRecharger(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const requete = indexedDB.deleteDatabase('mes-mots')
        requete.onsuccess = () => resolve()
        requete.onerror = () => resolve()
        requete.onblocked = () => resolve()
      }),
  )
  await page.reload()
}

/**
 * Toute modification lève le drapeau de B4 : fermer l'espace parents fait donc apparaître
 * le rappel de sauvegarde. Ces scénarios ne testent pas le rappel lui-même, on le referme
 * par « Plus tard » pour revenir à l'écran de l'enfant.
 */
async function fermerEspaceParentsSansSauvegarder(page: Page): Promise<void> {
  await page.locator('[data-fermer-parents]').click()
  await page.locator('[data-rappel-sauvegarde], [data-case]').first().waitFor()
  if (await page.locator('[data-rappel-sauvegarde]').count()) {
    await page.locator('[data-plus-tard]').click()
  }
}

async function masquerPromenade(page: Page): Promise<void> {
  await ouvrirEspaceParents(page)
  await page.locator('[data-case-parent="promenade"]').click()
  await fermerEspaceParentsSansSauvegarder(page)
  await expect(page.locator('[data-case="promenade"]')).toHaveCount(0)
}

async function ajouterBallonDansExterieur(page: Page): Promise<void> {
  await ouvrirEspaceParents(page)
  await page.locator('[data-selecteur-planche]').selectOption('exterieur')
  await page.locator('[data-ajouter-case]').first().click()
  await page.locator('[data-champ-label]').fill('BALLON')
  await page.locator('[data-champ-vocalization]').fill('Je veux mon ballon')
  await page.locator('[data-enregistrer-case]').click()
  await page.locator('[data-selecteur-planche]').selectOption('maison')
  await fermerEspaceParentsSansSauvegarder(page)
}

/** Les noms de contextes tels qu'IndexedDB les porte : la seule preuve qu'une modification
 *  est écrite, et non seulement peinte à l'écran. */
async function contextesPersistes(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const base = await new Promise<IDBDatabase>((ok, ko) => {
      const requete = indexedDB.open('mes-mots')
      requete.onsuccess = () => ok(requete.result)
      requete.onerror = () => ko(requete.error)
    })
    return new Promise<string[]>((ok) => {
      const lecture = base.transaction('config').objectStore('config').get('configuration')
      lecture.onsuccess = () => ok(((lecture.result as { contextes: { name: string }[] })?.contextes ?? []).map((c) => c.name))
      lecture.onerror = () => ok([])
    })
  })
}

test.describe('E6 : sauvegarder', () => {
  test('le compte rendu affiche des chiffres justes, vérifiés contre la configuration réelle', async ({
    page,
  }) => {
    await page.goto('/')
    await masquerPromenade(page)

    await ouvrirEspaceParents(page)
    await ouvrirOngletSauvegarde(page)
    const telechargement = page.waitForEvent('download')
    await page.locator('[data-sauvegarder]').click()
    const sauvegarde = await telechargement
    const chemin = await sauvegarde.path()

    // 40 cases au total (16 Maison + 2 Extérieur + 19 douleur + 3 barre), 31 révélées :
    // promenade masquée, et tout ce qui attend encore d'être montré à l'enfant
    await expect(page.locator('[data-cr-contextes]')).toContainText('3')
    await expect(page.locator('[data-cr-pages]')).toContainText('4')
    await expect(page.locator('[data-cr-mots-visibles]')).toHaveText('31')
    await expect(page.locator('[data-cr-mots-total]')).toHaveText('40')
    // 39 : les mots livrés, plus l'image des trois boutons de contexte (« J'ai mal »
    // partage la sienne avec MAL AU VENTRE), plus la coche et la croix de OUI et NON
    await expect(page.locator('[data-cr-images]')).toContainText('39')

    // le nom du fichier et la consigne qui compte : sans eux, elle referme en croyant avoir
    // mis son fils à l'abri, avec l'unique copie posée sur l'appareil qu'on risque de perdre
    await expect(page.locator('[data-cr-nom-fichier]')).toHaveText(/mes-mots-\d{4}-\d{2}-\d{2}\.obz/)
    await expect(page.locator('[data-cr-consigne]')).toContainText('ailleurs que sur la tablette')
    const nomAffiche = await page.locator('[data-cr-nom-fichier]').textContent()
    expect(sauvegarde.suggestedFilename(), 'le nom affiché n est pas celui du fichier').toBe(nomAffiche)
    await expect(page.locator('[data-cr-sons]')).toContainText('21')
    // toutes les ressources référencées existent réellement sous public/ : aucune manquante
    await expect(page.locator('[data-ressources-manquantes]')).toHaveCount(0)
    // la taille affichée est celle du fichier réellement téléchargé, pas une valeur inventée
    const octetsReels = statSync(chemin!).size
    await expect(page.locator('[data-cr-taille]')).toHaveText(`${Math.round(octetsReels / 1024)} Ko`)
  })
})

test.describe('E6 : restaurer', () => {
  test("l aperçu montre les deux côtés, et Annuler ne touche à rien", async ({ page }) => {
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await ouvrirOngletSauvegarde(page)

    const telechargement = page.waitForEvent('download')
    await page.locator('[data-sauvegarder]').click()
    const sauvegarde = await telechargement
    const chemin = await sauvegarde.path()
    await page.locator('[data-fermer-compte-rendu]').click()

    await page.setInputFiles('[data-fichier-restauration]', chemin!)
    await expect(page.locator('[data-apercu-restauration]')).toBeVisible()
    // les deux côtés de la comparaison sont bien affichés, avant tout remplacement
    await expect(page.locator('[data-apercu-sauvegarde-contextes]')).toContainText('3')
    await expect(page.locator('[data-apercu-actuel-contextes]')).toContainText('3')
    await expect(page.locator('[data-apercu-sauvegarde-mots-visibles]')).toHaveText('32')
    await expect(page.locator('[data-apercu-actuel-mots-visibles]')).toHaveText('32')

    await page.locator('[data-annuler-restauration]').click()
    await expect(page.locator('[data-apercu-restauration]')).toHaveCount(0)
    await page.locator('[data-fermer-parents]').click()

    // rien n'a été touché : ni l'écran, ni le dépôt une fois rechargé
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await page.reload()
    await expect(page.locator('[data-case]')).toHaveCount(13)
  })

  test("un fichier qui n est pas une archive affiche un message d erreur et laisse la configuration intacte", async ({
    page,
  }) => {
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await ouvrirOngletSauvegarde(page)

    await page.setInputFiles('[data-fichier-restauration]', {
      name: 'pas-une-sauvegarde.obz',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('ceci n est pas une archive zip'),
    })

    await expect(page.locator('[data-erreur-restauration]')).toBeVisible()
    await expect(page.locator('[data-erreur-restauration]')).toContainText(/pas.*sauvegarde/i)

    // le parent va vérifier un mot entre-temps : le message doit être encore là au retour,
    // il ne disparaît que quand il le ferme ou qu'il choisit un autre fichier
    await page.locator('[data-onglet="mots"]').click()
    await ouvrirOngletSauvegarde(page)
    await expect(page.locator('[data-erreur-restauration]')).toBeVisible()
    await expect(page.locator('[data-apercu-restauration]')).toHaveCount(0)
    // l'écran n'est pas cassé : l'espace parents répond toujours
    await expect(page.locator('[data-espace-parents]')).toBeVisible()

    await page.locator('[data-fermer-parents]').click()
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await page.reload()
    await expect(page.locator('[data-case]')).toHaveCount(13)
  })
})

test.describe('E6 : aller-retour complet', () => {
  test("sauvegarder puis restaurer redonne l écran de l enfant identique, au pixel près", async ({
    page,
  }) => {
    // LE test le plus important de ce lot : ce que la famille vivrait si elle changeait de
    // tablette, ou si le navigateur purgeait le stockage.
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)

    const rectanglesAvant = new Map<string, Rectangle>()
    for (const id of IDS_MAISON.filter((id) => id !== 'promenade')) {
      rectanglesAvant.set(id, await rectangleDe(page, `[data-case="${id}"]`))
    }

    await masquerPromenade(page)
    await ajouterBallonDansExterieur(page)
    await expect(page.locator('[data-case]')).toHaveCount(12)

    const rectBallonAvant = await (async () => {
      await page.locator('[data-contexte="exterieur"]').click()
      const rect = await rectangleDe(page, '[data-case="ballon"]')
      await page.locator('[data-contexte="maison"]').click()
      return rect
    })()

    await ouvrirEspaceParents(page)
    await ouvrirOngletSauvegarde(page)
    const telechargement = page.waitForEvent('download')
    await page.locator('[data-sauvegarder]').click()
    const sauvegarde = await telechargement
    const chemin = await sauvegarde.path()
    await page.locator('[data-fermer-compte-rendu]').click()
    await page.locator('[data-fermer-parents]').click()

    await effacerDepotEtRecharger(page)
    // la graine reprend sa place tant que rien n'a été restauré : promenade est de retour
    await expect(page.locator('[data-case]')).toHaveCount(13)

    await ouvrirEspaceParents(page)
    await ouvrirOngletSauvegarde(page)
    await page.setInputFiles('[data-fichier-restauration]', chemin!)
    await expect(page.locator('[data-apercu-restauration]')).toBeVisible()
    await page.locator('[data-confirmer-restauration]').click()

    // la restauration referme l'espace parents et recompose l'écran de l'enfant
    await expect(page.locator('[data-espace-parents]')).toHaveCount(0)
    await expect(page.locator('[data-case]')).toHaveCount(12)
    await expect(page.locator('[data-case="promenade"]')).toHaveCount(0)

    for (const [id, avant] of rectanglesAvant) {
      const apres = await rectangleDe(page, `[data-case="${id}"]`)
      memeRectangle(apres, avant, id)
    }

    await page.locator('[data-contexte="exterieur"]').click()
    const rectBallonApres = await rectangleDe(page, '[data-case="ballon"]')
    memeRectangle(rectBallonApres, rectBallonAvant, 'ballon')
  })
})

test.describe('E6 : photos et sons de la famille (P4, P8)', () => {
  test("l aller-retour complet de sauvegarde emporte une photo et un son de famille", async ({
    page,
  }) => {
    // LE scénario que ce lot doit couvrir : changer de tablette ne doit pas rendre MAMAN
    // muette et sans visage.
    await page.goto('/')
    // attendre que le dépôt ait fini de semer la configuration avant d'y écrire à la main,
    // sinon l'ouverture du test court-circuite la montée de version de l'application
    await expect(page.locator('[data-case]')).toHaveCount(13)
    // MOI n'a pas de pictogramme livré : un img sur cette case ne peut venir que de la photo
    // de famille, aucune ambiguïté avec un pictogramme déjà là avant toute personnalisation
    await ajouterPhotoPersonnalisee(page, 'moi')
    await ajouterSonPersonnalise(page, 'moi')
    await page.reload()
    await expect(page.locator('[data-case="moi"] img')).toBeVisible()

    await ouvrirEspaceParents(page)
    await ouvrirOngletSauvegarde(page)
    const telechargement = page.waitForEvent('download')
    await page.locator('[data-sauvegarder]').click()
    const sauvegarde = await telechargement
    const chemin = await sauvegarde.path()
    await page.locator('[data-fermer-compte-rendu]').click()
    await page.locator('[data-fermer-parents]').click()

    await effacerDepotEtRecharger(page)
    await expect(page.locator('[data-case="moi"] img')).toHaveCount(0)
    expect(await sonPersonnaliseExiste(page, 'moi')).toBe(false)

    await ouvrirEspaceParents(page)
    await ouvrirOngletSauvegarde(page)
    await page.setInputFiles('[data-fichier-restauration]', chemin!)
    await expect(page.locator('[data-apercu-restauration]')).toBeVisible()
    await page.locator('[data-confirmer-restauration]').click()

    await expect(page.locator('[data-case="moi"] img')).toBeVisible()
    expect(await sonPersonnaliseExiste(page, 'moi')).toBe(true)
  })
})

test.describe('E6 : aucune URL d objet ne fuit (P4)', () => {
  test('plusieurs allers-retours sur une case avec photo libèrent toutes les URL créées', async ({
    page,
  }) => {
    await observerUrlsObjet(page)
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await ajouterPhotoPersonnalisee(page, 'maman')
    await page.reload()
    await expect(page.locator('[data-case="maman"] img')).toBeVisible()

    // trois bascules : la case démarre affichée, un nombre impair de bascules la laisse
    // masquée, donc démontée, à la fin, et referme la dernière URL en cours
    for (let i = 0; i < 3; i++) {
      await ouvrirEspaceParents(page)
      await page.locator('[data-case-parent="maman"]').click()
      await fermerEspaceParentsSansSauvegarder(page)
    }
    await expect(page.locator('[data-case="maman"]')).toHaveCount(0)

    const compte = await compterUrlsObjet(page)
    expect(compte.creees, 'au moins une URL créée pour la photo').toBeGreaterThan(0)
    expect(compte.revoquees, 'chaque URL créée doit être libérée, aucune fuite').toBe(compte.creees)
  })
})

test.describe('E6 : rappel de sauvegarde (B4)', () => {
  test("n apparaît pas au premier lancement, quand rien n a été modifié", async ({ page }) => {
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await page.locator('[data-fermer-parents]').click()

    await expect(page.locator('[data-rappel-sauvegarde]')).toHaveCount(0)
    await expect(page.locator('[data-case]')).toHaveCount(13)
  })

  test("apparaît à la sortie de l espace parents après une modification, et Plus tard referme sans sauvegarder", async ({
    page,
  }) => {
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await page.locator('[data-case-parent="promenade"]').click()
    await page.locator('[data-fermer-parents]').click()

    await expect(page.locator('[data-rappel-sauvegarde]')).toBeVisible()
    // 40 cases au total, masquées comprises : le compte porte sur toute la configuration
    await expect(page.locator('[data-rappel-texte]')).toContainText('40')

    let telechargementDeclenche = false
    page.on('download', () => {
      telechargementDeclenche = true
    })
    await page.locator('[data-plus-tard]').click()

    await expect(page.locator('[data-rappel-sauvegarde]')).toHaveCount(0)
    await expect(page.locator('[data-case]')).toHaveCount(12)
    expect(telechargementDeclenche, "Plus tard n'a pas dû déclencher de sauvegarde").toBe(false)

    // le rappel n'a rien réglé : il réapparaît à la prochaine sortie, il n'est pas contournable
    await ouvrirEspaceParents(page)
    await page.locator('[data-fermer-parents]').click()
    await expect(page.locator('[data-rappel-sauvegarde]')).toBeVisible()
  })

  test("se ferme après une sauvegarde effectuée depuis le rappel lui-même", async ({ page }) => {
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await page.locator('[data-case-parent="promenade"]').click()
    await page.locator('[data-fermer-parents]').click()
    await expect(page.locator('[data-rappel-sauvegarde]')).toBeVisible()

    const telechargement = page.waitForEvent('download')
    await page.locator('[data-sauvegarder-rappel]').click()
    await telechargement

    await expect(page.locator('[data-rappel-sauvegarde]')).toHaveCount(0)
    await expect(page.locator('[data-case]')).toHaveCount(12)

    // sauvegardé : le rappel ne réapparaît plus tant que rien d'autre n'a changé
    await ouvrirEspaceParents(page)
    await page.locator('[data-fermer-parents]').click()
    await expect(page.locator('[data-rappel-sauvegarde]')).toHaveCount(0)
  })
})

test.describe("ajouter une planche sans effacer ce qui existe", () => {
  test('les contextes du fichier viennent à la suite, et les miens ne bougent pas', async ({ page }) => {
    // le seul chemin pour livrer une planche à une tablette déjà en service : la graine ne
    // s'applique qu'au premier lancement, et remplacer effacerait le travail de la famille
    await page.goto('/')
    await ouvrirEspaceParents(page)

    // on fabrique un fichier qui porte un contexte de plus que la tablette
    await ouvrirGestionContextes(page)
    await page.locator('[data-nouveau-contexte]').click()
    await page.locator('[data-champ-nom-contexte]').fill('École')
    await page.locator('[data-valider-contexte]').click()
    // avec son image : L'enfant ne lit pas, un contexte qui arrive sans elle n'est qu'un
    // mot écrit de plus en haut de son écran
    await page.setInputFiles('[data-champ-image-contexte]', {
      name: 'ecole.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    })
    await expect(page.locator('[data-champ-image-contexte]').locator('..').locator('img')).toBeVisible()
    await ouvrirOngletSauvegarde(page)
    const telechargement = page.waitForEvent('download')
    await page.locator('[data-sauvegarder]').click()
    const fichier = await (await telechargement).path()
    await page.locator('[data-fermer-compte-rendu]').click()

    // puis on retire École de la tablette, pour que le fichier ait quelque chose à apporter
    await page.locator('[data-onglet="mots"]').click()
    await ouvrirGestionContextes(page)
    await page.locator('[data-supprimer-contexte]').click()
    await page.locator('[data-confirmer-suppression-contexte]').click()

    // rechargement avant d'importer : le balayage du démarrage emporte l'image d'École,
    // que plus aucun contexte ne réclame. Sans lui, le blob resterait de la première
    // écriture et le test dirait vrai quoi qu'il arrive. On attend que la suppression soit
    // vraiment écrite : rechargée trop tôt, la page relit une configuration où École est
    // encore là, et le balayage n'a rien à emporter.
    await expect.poll(() => contextesPersistes(page)).not.toContain('École')
    await page.reload()
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await expect.poll(() => imagePersonnaliseeExiste(page, 'contexte-ecole')).toBe(false)
    await ouvrirEspaceParents(page)

    await ouvrirOngletSauvegarde(page)
    await page.setInputFiles('[data-fichier-restauration]', fichier!)
    await expect(page.locator('[data-ajout-possible]')).toContainText('École')
    await page.locator('[data-confirmer-ajout]').click()

    await page.locator('[data-onglet="mots"]').click()
    const libelles = await page.locator('[data-selecteur-planche] option').allTextContents()
    expect(libelles).toEqual(['Maison', 'Extérieur', "J'ai mal", 'École', 'Mots essentiels'])

    // l'image du bouton est revenue avec lui, blob compris : la référence seule donnerait
    // un bouton sans dessin
    await page.locator('[data-selecteur-planche]').selectOption({ label: 'École' })
    await ouvrirGestionContextes(page)
    await expect(page.locator('[data-champ-image-contexte]').locator('..').locator('img')).toBeVisible()
    expect(await imagePersonnaliseeExiste(page, 'contexte-ecole')).toBe(true)
  })
})

test.describe('E6 : les trois gestes de mise à l abri se distinguent', () => {
  for (const largeur of [800, 390]) {
    test(`aucun bouton n en touche un autre à ${largeur} px`, async ({ page }) => {
      // Le bord haut d'« Imprimer les planches » tombait exactement sur le bord bas du bouton
      // du dessus : deux contours qui se touchent se lisent comme un seul bloc mal dessiné, et
      // un doigt qui vise l'un prend l'autre.
      await page.setViewportSize({ width: largeur, height: 900 })
      await page.goto('/')
      await ouvrirEspaceParents(page)
      await ouvrirOngletSauvegarde(page)

      const gestes = await page.evaluate(() =>
        ['[data-sauvegarder]', '[data-restaurer]', '[data-imprimer-planches]'].map((selecteur) => {
          const boite = document.querySelector(selecteur)!.getBoundingClientRect()
          return { haut: boite.top, bas: boite.bottom, gauche: boite.left, droite: boite.right }
        }),
      )
      for (const [premier, second] of [
        [gestes[0]!, gestes[1]!],
        [gestes[1]!, gestes[2]!],
        [gestes[0]!, gestes[2]!],
      ] as const) {
        const ecarteEnHauteur = second.haut - premier.bas >= 8 || premier.haut - second.bas >= 8
        const ecarteEnLargeur =
          second.gauche - premier.droite >= 8 || premier.gauche - second.droite >= 8
        expect(ecarteEnHauteur || ecarteEnLargeur, `deux boutons se touchent à ${largeur} px`).toBe(
          true,
        )
      }
    })
  }
})
