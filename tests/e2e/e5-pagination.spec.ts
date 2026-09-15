import { test, expect, type Page } from '@playwright/test'
import { fermerEspaceParents, repondreALaQuestion } from './verrou'

/** Les 13 cases révélées du contexte Maison, dans l'ordre de lecture de `grid.order`. */
const IDS_MAISON = [
  'maman', 'papa', 'moi', 'doudou', 'boire', 'manger', 'douche', 'chambre',
  'voiture', 'tablette', 'promenade', 'oui', 'non',
]

/** Un point dans le coin protégé, en haut à gauche, dans la bande de phrase inerte. */
const COIN_PARENTS = { x: 28, y: 28 }

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

/**
 * Tient le coin 3 s, répond à la question, et relâche la souris. `avancer` laisse le
 * temps passer, à l'horloge réelle ou à celle que `page.clock` contrôle.
 */
async function ouvrirEspaceParents(page: Page, avancer = (ms: number) => page.waitForTimeout(ms)) {
  await page.mouse.move(COIN_PARENTS.x, COIN_PARENTS.y)
  await page.mouse.down()
  await avancer(3100)
  await expect(page.locator('[data-question-parents]')).toBeVisible()
  await page.mouse.up()
  await repondreALaQuestion(page)
  await expect(page.locator('[data-espace-parents]')).toBeVisible()
}

/**
 * Ajoute une deuxième page à Maison en écrivant dans IndexedDB, comme le fait
 * e2-persistance.spec.ts : c'est le raccourci qui rend la page 2 atteignable sans rejouer
 * tout le parcours parent (qui crée la page à la demande, vérifié dans
 * e4-espace-parents.spec.ts). La page n'existe pas dans la graine : on la construit ici,
 * avec la même géométrie que la première page de Maison.
 */
async function poserUnMotSurLaPage2(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const requete = indexedDB.open('mes-mots')
      requete.onsuccess = () => ok(requete.result)
      requete.onerror = () => ko(requete.error)
    })
    const magasin = db.transaction('config', 'readwrite').objectStore('config')
    type PageStockee = {
      id: string
      grid: { rows: number; columns: number; order: (string | null)[][] }
      buttons: Record<string, unknown>[]
    }
    const config = await new Promise<{ contextes: { pages: PageStockee[] }[] }>((ok) => {
      const lecture = magasin.get('configuration')
      lecture.onsuccess = () => ok(lecture.result)
    })
    const premierePage = config.contextes[0]!.pages[0]!
    const pageDeux: PageStockee = {
      id: 'maison-p2',
      grid: {
        rows: premierePage.grid.rows,
        columns: premierePage.grid.columns,
        order: premierePage.grid.order.map((ligne) => ligne.map(() => null)),
      },
      buttons: [
        {
          id: 'ballon',
          label: 'BALLON',
          vocalization: 'Je veux mon ballon',
          background_color: '#8ecbfa',
          border_color: '#3fa9f5',
          hidden: false,
        },
      ],
    }
    pageDeux.grid.order[0]![0] = 'ballon'
    config.contextes[0]!.pages.push(pageDeux)
    await new Promise<void>((ok) => {
      const ecriture = magasin.put(config, 'configuration')
      ecriture.onsuccess = () => ok()
    })
  })
  await page.reload()
  await expect(page.locator('[data-pagination] button:visible')).toHaveCount(1)
}

/**
 * Glisse le doigt horizontalement en partant d'une case, et le relâche sans avoir quitté
 * cette case : c'est le geste qui doit tourner la page sans faire parler la case.
 */
async function glisser(page: Page, idCase: string, deplacementPx: number): Promise<void> {
  // pendant la glissade la grille n'écoute plus le doigt : attendre qu'elle soit au repos,
  // sinon le geste suivant se perdrait et le test mentirait sur la cause
  await expect(page.locator('[data-zone-grille="repos"]')).toBeVisible()
  const boite = await rectangleDe(page, `[data-case="${idCase}"]`)
  const depart = {
    x: boite.x + (deplacementPx < 0 ? boite.width - 12 : 12),
    y: boite.y + boite.height / 2,
  }
  await page.mouse.move(depart.x, depart.y)
  await page.mouse.down()
  await page.mouse.move(depart.x + deplacementPx, depart.y, { steps: 12 })
  await page.mouse.up()
}

const pastilleCourante = (page: Page) => page.locator('[data-pastille][data-courante="true"]')

test.describe('E5 : pagination et glissement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(13)
  })

  test('aucun contrôle de page tant qu un contexte n a qu une page atteignable', async ({
    page,
  }) => {
    // Un contrôle qui ne mène nulle part est du bruit : ni pastille solitaire, ni flèche
    // désactivée. La place, elle, est réservée.
    await expect(page.locator('[data-pagination] button:visible')).toHaveCount(0)
    await expect(page.locator('[data-pastille]')).toHaveCount(0)
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(13)
    // la place, elle, est bien réservée dès aujourd'hui
    expect((await rectangleDe(page, '[data-pagination]')).width).toBeGreaterThan(140)
  })

  test('l apparition du contrôle de page ne déplace aucune case ni le bouton Maison', async ({
    page,
  }) => {
    // LE test de la pagination : la promesse du projet, appliquée aux pages. Le contrôle
    // apparaît le jour où un mot est posé page 2, et rien d'autre ne bouge d'un pixel.
    const rectanglesAvant = new Map<string, Rectangle>()
    for (const id of IDS_MAISON) {
      rectanglesAvant.set(id, await rectangleDe(page, `[data-case="${id}"]`))
    }
    const boutonMaisonAvant = await rectangleDe(page, '[data-contexte="maison"]')

    await ouvrirEspaceParents(page)
    // Maison n'a qu'une page réelle : la flèche suivante mène directement à la page
    // d'accueil vide, entièrement faite de boutons « + ». Le premier vise grid.order[0][0].
    await page.locator('[data-page-suivante]').click()
    await page.locator('[data-ajouter-case]').first().click()
    await page.locator('[data-champ-label]').fill('BALLON')
    await page.locator('[data-champ-vocalization]').fill('Je veux mon ballon')
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)

    await expect(page.locator('[data-page-suivante]')).toBeVisible()
    await expect(page.locator('[data-pastille]')).toHaveCount(2)
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(13)

    for (const id of IDS_MAISON) {
      memeRectangle(await rectangleDe(page, `[data-case="${id}"]`), rectanglesAvant.get(id)!, id)
    }
    memeRectangle(
      await rectangleDe(page, '[data-contexte="maison"]'),
      boutonMaisonAvant,
      'le bouton Maison',
    )
  })

  test('les flèches mènent à la page 2 et en reviennent, les pastilles suivent', async ({
    page,
  }) => {
    await poserUnMotSurLaPage2(page)
    await expect(pastilleCourante(page)).toHaveAttribute('data-pastille', '0')

    await page.locator('[data-page-suivante]').click()

    await expect(page.locator('[data-case="ballon"]')).toBeVisible()
    await expect(page.locator('[data-case="maman"]')).toHaveCount(0)
    await expect(pastilleCourante(page)).toHaveAttribute('data-pastille', '1')

    await page.locator('[data-page-precedente]').click()

    await expect(page.locator('[data-case="maman"]')).toBeVisible()
    await expect(page.locator('[data-case="ballon"]')).toHaveCount(0)
    await expect(pastilleCourante(page)).toHaveAttribute('data-pastille', '0')
  })

  test('aux extrémités, la flèche qui ne mène nulle part n est pas affichée', async ({ page }) => {
    // L'enfant doit pouvoir sentir le bord : pas de bouclage circulaire. La flèche est
    // invisible mais garde sa place, sinon les pastilles et l'autre flèche se décaleraient
    // d'une page à l'autre, et rien ne bouge sur cet écran.
    await poserUnMotSurLaPage2(page)
    await expect(page.locator('[data-page-precedente]')).toBeHidden()
    await expect(page.locator('[data-page-suivante]')).toBeVisible()

    const placeSuivante = (await page.locator('[data-page-suivante]').boundingBox())!
    const placePastilles = (await page.locator('[data-pastilles]').boundingBox())!

    await page.locator('[data-page-suivante]').click()

    await expect(page.locator('[data-page-precedente]')).toBeVisible()
    // les mêmes rectangles d'une page à l'autre : le contrôle ne se réorganise pas
    expect((await page.locator('[data-page-suivante]').boundingBox())!.x).toBeCloseTo(placeSuivante.x, 0)
    expect((await page.locator('[data-pastilles]').boundingBox())!.x).toBeCloseTo(placePastilles.x, 0)
    await expect(page.locator('[data-page-suivante]')).toBeHidden()
  })

  test('un glissement change de page sans faire parler la case sous le doigt', async ({ page }) => {
    // Les deux moitiés de T8 : sans le renoncement de la case, chaque page tournée
    // prononcerait un mot au hasard.
    await poserUnMotSurLaPage2(page)

    await glisser(page, 'doudou', -140)

    await expect(page.locator('[data-case="ballon"]')).toBeVisible()
    await expect(page.locator('[data-bande-phrase]')).toHaveText('')

    await glisser(page, 'ballon', 140)

    await expect(page.locator('[data-case="maman"]')).toBeVisible()
    await expect(page.locator('[data-bande-phrase]')).toHaveText('')
  })

  test('un appui franc continue de faire parler la case', async ({ page }) => {
    await poserUnMotSurLaPage2(page)

    await page.locator('[data-case="doudou"]').click()

    await expect(page.locator('[data-bande-phrase]')).toHaveText('Mon doudou')
    await expect(page.locator('[data-case="maman"]')).toBeVisible()
  })

  test('un geste trop court ne tourne pas la page', async ({ page }) => {
    // 15 % de la largeur de la grille : en dessous, l'enfant reste où il est
    await poserUnMotSurLaPage2(page)

    await glisser(page, 'doudou', -60)

    await expect(page.locator('[data-case="maman"]')).toBeVisible()
    await expect(page.locator('[data-case="ballon"]')).toHaveCount(0)
  })
})

/**
 * Durée résolue de la glissade, en posant la classe soi-même. Guetter l'animation pendant
 * qu'elle se joue était une course perdue : sur une machine chargée les 180 ms passaient
 * avant l'assertion, et le test rougissait au hasard. Ici on lit la règle, pas le transitoire.
 */
async function dureeDeLaGlissade(page: Page): Promise<string> {
  return page.locator('[data-zone-grille]').evaluate((zone) => {
    zone.classList.add('glisse-suivante')
    const duree = getComputedStyle(zone).animationDuration
    zone.classList.remove('glisse-suivante')
    return duree
  })
}

test.describe('E5 : la page glisse visiblement', () => {
  test('la glissade dure 180 ms', async ({ page }) => {
    await page.goto('/')
    await poserUnMotSurLaPage2(page)

    expect(await dureeDeLaGlissade(page)).toBe('0.18s')
  })

  test('la page change bien, glissade ou pas', async ({ page }) => {
    await page.goto('/')
    await poserUnMotSurLaPage2(page)

    await page.locator('[data-page-suivante]').click()
    await expect(page.locator('[data-case="ballon"]')).toBeVisible()
  })

  test.describe('sur un appareil réglé pour limiter les animations', () => {
    test.use({ reducedMotion: 'reduce' })

    test('la page change sans glisser', async ({ page }) => {
      // WCAG 2.3.3 : la règle globale du projet doit valoir aussi pour la glissade
      await page.goto('/')
      await poserUnMotSurLaPage2(page)

      expect(await dureeDeLaGlissade(page)).toBe('0s')

      await page.locator('[data-page-suivante]').click()
      await expect(page.locator('[data-case="ballon"]')).toBeVisible()
    })
  })
})

test.describe('E5 : retour automatique après 30 secondes (T6)', () => {
  test.beforeEach(async ({ page }) => {
    // l'horloge est posée avant la navigation, sinon les minuteurs du chargement
    // resteraient hors de son contrôle
    await page.clock.install()
    await page.goto('/')
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(13)
    await poserUnMotSurLaPage2(page)
  })

  test('30 secondes sans appui ramènent l enfant à sa page de départ', async ({ page }) => {
    await page.locator('[data-page-suivante]').click()
    await expect(page.locator('[data-case="ballon"]')).toBeVisible()

    await page.clock.fastForward('00:31')

    await expect(page.locator('[data-case="maman"]')).toBeVisible()
    await expect(page.locator('[data-case="ballon"]')).toHaveCount(0)
    await expect(pastilleCourante(page)).toHaveAttribute('data-pastille', '0')
  })

  test('un appui repart le compteur', async ({ page }) => {
    await page.locator('[data-page-suivante]').click()

    await page.clock.fastForward('00:20')
    await page.locator('[data-case="ballon"]').click()
    await page.clock.fastForward('00:20')

    // 40 s se sont écoulées, mais jamais 30 sans appui
    await expect(page.locator('[data-case="ballon"]')).toBeVisible()
  })

  test('le retour au départ efface aussi la phrase, pas seulement la page', async ({ page }) => {
    // sans ça, l'enfant retrouvait le lendemain matin le dernier mot de la veille écrit en
    // haut de son écran, comme s'il venait de le dire
    await page.goto('/')
    await page.locator('[data-case="maman"]').click()
    await expect(page.locator('[data-bande-phrase]')).toContainText('Maman')

    await page.clock.fastForward('00:31')

    await expect(page.locator('[data-bande-phrase]')).toHaveText('')
  })

  test('le réglage décoché laisse l enfant où il est', async ({ page }) => {
    await ouvrirEspaceParents(page, (ms) => page.clock.runFor(ms))
    // le réglage vit dans l'onglet des réglages, avec les autres opérations rares
    await page.locator('[data-onglet="reglages"]').click()
    await page.locator('[data-reglage-retour]').uncheck()
    await fermerEspaceParents(page)

    await page.locator('[data-page-suivante]').click()
    await page.clock.fastForward('00:31')

    await expect(page.locator('[data-case="ballon"]')).toBeVisible()
    await expect(page.locator('[data-case="maman"]')).toHaveCount(0)
  })
})

test.describe('déplacer un mot d une page à l autre', () => {
  test('le mot quitte la première page et se pose sur la seconde', async ({ page }) => {
    // Vécu par le père : le déplacement ne marchait qu'à l'intérieur d'une page, alors qu'un
    // contexte peut en avoir plusieurs, et rien ne le disait.
    await page.goto('/')
    await ouvrirEspaceParents(page)

    // une seconde page naît en posant un mot sur la page d'accueil vide
    await page.locator('[data-pagination] [data-page-suivante]').click()
    await page.locator('[data-ajouter-case]').first().click()
    await page.locator('[data-champ-label]').fill('BALLON')
    await page.locator('[data-champ-vocalization]').fill('Je veux mon ballon')
    await page.locator('[data-enregistrer-case]').click()

    // retour à la première page, on prend MAMAN et on va la poser sur la seconde
    await page.locator('[data-pagination] [data-page-precedente]').click()
    await page.locator('[data-deplacer-case="maman"]').click()
    await page.locator('[data-pagination] [data-page-suivante]').click()
    await page.locator('[data-poser-ici]').first().click()

    await expect(page.locator('[data-case-parent="maman"]')).toBeVisible()
    await page.locator('[data-pagination] [data-page-precedente]').click()
    await expect(page.locator('[data-case-parent="maman"]')).toHaveCount(0)
  })
})
