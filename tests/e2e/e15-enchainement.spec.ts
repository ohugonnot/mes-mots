import { test, expect, type Page } from '@playwright/test'
import {
  allumerLeCorpsAToucher,
  fermerEspaceParents,
  ouvrirEspaceParents,
  ouvrirOngletReglages,
  reglagesPersistes,
} from './verrou'

/**
 * POC de l'enchaînement (projet/PLAN-ENCHAINEMENT.md). Deux exigences se tiennent ici :
 * éteint, rien ne change pour la famille qui utilise la tablette tous les jours ; allumé,
 * la bande du haut garde les mots sans qu'une seule case de la grille bouge.
 */

interface SonJoue {
  src: string
}

declare global {
  interface Window {
    __sonsEnchaines: SonJoue[]
  }
}

/** Sonde d'observation des sons, injectée par le test et jamais livrée sur la tablette. */
async function observerLesSons(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const Origine = window.Audio
    const journal: SonJoue[] = []
    Object.defineProperty(window, '__sonsEnchaines', { value: journal })
    Object.defineProperty(window, 'Audio', {
      value: function (src?: string) {
        journal.push({ src: src ?? '' })
        return new Origine(src)
      },
    })
  })
}

const sonsJoues = (page: Page) => page.evaluate(() => window.__sonsEnchaines.map((son) => son.src))

/**
 * Allume le réglage en écrivant dans IndexedDB, comme e5-pagination pose sa deuxième page :
 * le parcours parent complet est vérifié une fois, dans son propre test, et les autres
 * n'ont pas à payer trois secondes d'appui long chacun.
 */
async function allumerLEnchainement(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const requete = indexedDB.open('mes-mots')
      requete.onsuccess = () => ok(requete.result)
      requete.onerror = () => ko(requete.error)
    })
    const magasin = db.transaction('config', 'readwrite').objectStore('config')
    const config = await new Promise<{ reglages: Record<string, unknown> }>((ok) => {
      const lecture = magasin.get('configuration')
      lecture.onsuccess = () => ok(lecture.result)
    })
    config.reglages.enchainement = true
    await new Promise<void>((ok) => {
      const ecriture = magasin.put(config, 'configuration')
      ecriture.onsuccess = () => ok()
    })
  })
  await page.reload()
  await expect(page.locator('[data-mots-poses]')).toBeVisible()
}

/**
 * Maison n'a qu'une page dans la graine : sans seconde page, il n'y a pas de changement de
 * page à éprouver. Même raccourci que e5-pagination, qui écrit la page dans IndexedDB.
 */
async function poserUneSecondePage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok) => {
      const requete = indexedDB.open('mes-mots')
      requete.onsuccess = () => ok(requete.result)
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
    const premiere = config.contextes[0]!.pages[0]!
    const deuxieme: PageStockee = {
      id: 'maison-p2',
      grid: {
        rows: premiere.grid.rows,
        columns: premiere.grid.columns,
        order: premiere.grid.order.map((ligne) => ligne.map(() => null)),
      },
      buttons: [
        {
          id: 'ballon',
          label: 'BALLON',
          vocalization: 'Le ballon',
          ext_mesmots_enchaine: 'ballon',
          background_color: '#8ecbfa',
          border_color: '#3fa9f5',
          hidden: false,
        },
      ],
    }
    deuxieme.grid.order[0]![0] = 'ballon'
    config.contextes[0]!.pages.push(deuxieme)
    await new Promise<void>((ok) => {
      const ecriture = magasin.put(config, 'configuration')
      ecriture.onsuccess = () => ok()
    })
  })
  await page.reload()
  await expect(page.locator('[data-pagination] button:visible')).toHaveCount(1)
}

const motsPoses = (page: Page) => page.locator('[data-mot-pose]')

async function rectangleDe(page: Page, selecteur: string) {
  const boite = await page.locator(selecteur).boundingBox()
  expect(boite, `${selecteur} absent de l'écran`).not.toBeNull()
  return boite!
}

test.describe('E15 : le réglage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(13)
  })

  test('est éteint à la livraison, et la bande reste celle d aujourd hui', async ({ page }) => {
    await expect(page.locator('[data-mots-poses]')).toHaveCount(0)
    await page.locator('[data-case="boire"]').click()
    await expect(page.locator('[data-bande-phrase]')).toHaveText('Boire')

    await page.locator('[data-case="maman"]').click()
    // sans enchaînement la bande remplace, elle n'empile pas
    await expect(page.locator('[data-bande-phrase]')).toHaveText('Maman')
  })

  test('s allume depuis l espace parents et tient au rechargement', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await ouvrirOngletReglages(page)
    await page.locator('[data-reglage-enchainement]').check()
    await expect.poll(async () => (await reglagesPersistes(page)).enchainement).toBe(true)
    await fermerEspaceParents(page)

    await expect(page.locator('[data-mots-poses]')).toBeVisible()
    await page.reload()
    await expect(page.locator('[data-mots-poses]')).toBeVisible()
  })
})

test.describe('E15 : la bande garde les mots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(13)
    await allumerLEnchainement(page)
  })

  test('trois appuis posent trois pictogrammes, avec leur mot', async ({ page }) => {
    await page.locator('[data-case="maman"]').click()
    await page.locator('[data-case="boire"]').click()
    await page.locator('[data-case="voiture"]').click()

    await expect(motsPoses(page)).toHaveCount(3)
    // le mot d'enchaînement saisi par l'adulte, pas l'étiquette de la case : BOIRE dit
    // « biberon » pour se combiner
    await expect(motsPoses(page)).toHaveText(['maman', 'biberon', 'voiture'])
    await expect(motsPoses(page).first().locator('[data-vignette]')).toBeVisible()
  })

  test('la même case peut se poser deux fois', async ({ page }) => {
    await page.locator('[data-case="maman"]').click()
    await page.locator('[data-case="maman"]').click()
    await expect(motsPoses(page)).toHaveCount(2)
  })

  test('la septième case est refusée sans faire partir la première', async ({ page }) => {
    for (const id of ['maman', 'papa', 'moi', 'doudou', 'boire', 'manger', 'douche']) {
      await page.locator(`[data-case="${id}"]`).click()
    }
    await expect(motsPoses(page)).toHaveCount(6)
    await expect(motsPoses(page).first()).toHaveText('maman')
  })

  test('la flèche retire le dernier mot, la croix vide tout', async ({ page }) => {
    await page.locator('[data-case="maman"]').click()
    await page.locator('[data-case="boire"]').click()

    await page.locator('[data-retirer-mot]').click()
    await expect(motsPoses(page)).toHaveText(['maman'])

    await page.locator('[data-vider-phrase]').click()
    await expect(motsPoses(page)).toHaveCount(0)
  })

  test('les deux gestes sont éteints quand il n y a rien à effacer', async ({ page }) => {
    await expect(page.locator('[data-retirer-mot]')).toBeDisabled()
    await expect(page.locator('[data-vider-phrase]')).toBeDisabled()
    await expect(page.locator('[data-mots-poses]')).toBeDisabled()
  })

  test('aucune case de la grille n a bougé entre les deux modes', async ({ page }) => {
    const allume = await rectangleDe(page, '[data-case="maman"]')
    const bandeAllumee = await rectangleDe(page, '[data-bande-phrase]')

    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((ok) => {
        const requete = indexedDB.open('mes-mots')
        requete.onsuccess = () => ok(requete.result)
      })
      const magasin = db.transaction('config', 'readwrite').objectStore('config')
      const config = await new Promise<{ reglages: Record<string, unknown> }>((ok) => {
        const lecture = magasin.get('configuration')
        lecture.onsuccess = () => ok(lecture.result)
      })
      config.reglages.enchainement = false
      await new Promise<void>((ok) => {
        const ecriture = magasin.put(config, 'configuration')
        ecriture.onsuccess = () => ok()
      })
    })
    await page.reload()
    await expect(page.locator('[data-mots-poses]')).toHaveCount(0)

    const eteint = await rectangleDe(page, '[data-case="maman"]')
    const bandeEteinte = await rectangleDe(page, '[data-bande-phrase]')
    expect(Math.abs(eteint.x - allume.x), 'la case a changé de colonne').toBeLessThan(1.5)
    expect(Math.abs(eteint.y - allume.y), 'la case a changé de ligne').toBeLessThan(1.5)
    expect(Math.abs(eteint.width - allume.width), 'la case a changé de largeur').toBeLessThan(1.5)
    expect(Math.abs(eteint.height - allume.height), 'la case a changé de hauteur').toBeLessThan(1.5)
    expect(Math.abs(bandeEteinte.height - bandeAllumee.height), 'la bande a changé de hauteur').toBeLessThan(1.5)
  })
})

test.describe('E15 : relire la phrase', () => {
  test.beforeEach(async ({ page }) => {
    await observerLesSons(page)
    await page.goto('/')
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(13)
    await allumerLEnchainement(page)
  })

  test('toucher la bande rejoue les voix dans l ordre', async ({ page }) => {
    await page.locator('[data-case="maman"]').click()
    await page.locator('[data-case="papa"]').click()
    expect(await sonsJoues(page)).toEqual(['/sons/maman.mp3', '/sons/papa.mp3'])

    await page.locator('[data-mots-poses]').click()
    await expect
      .poll(() => sonsJoues(page), { timeout: 15_000 })
      .toEqual(['/sons/maman.mp3', '/sons/papa.mp3', '/sons/maman.mp3', '/sons/papa.mp3'])
  })

  test('un second appui coupe la relecture et ne la relance pas', async ({ page }) => {
    await page.locator('[data-case="maman"]').click()
    await page.locator('[data-case="papa"]').click()

    await page.locator('[data-mots-poses]').click()
    await expect.poll(() => sonsJoues(page)).toHaveLength(3)
    await page.locator('[data-mots-poses]').click()

    // le second mot ne part jamais : la chaîne s'arrête sur la coupure
    await page.waitForTimeout(2000)
    expect(await sonsJoues(page)).toHaveLength(3)
  })

  test('un mot demandé pendant la relecture ne coûte pas l appui suivant', async ({ page }) => {
    // le mot touché interrompt la relecture : sans ça, la bande se croyait encore en train
    // de lire, et le geste suivant de l'enfant coupait au lieu de relire
    await page.locator('[data-case="maman"]').click()
    await page.locator('[data-case="papa"]').click()
    await page.locator('[data-mots-poses]').click()
    await expect.poll(() => sonsJoues(page)).toHaveLength(3)

    await page.locator('[data-case="doudou"]').click()
    await expect.poll(() => sonsJoues(page)).toHaveLength(4)

    await page.locator('[data-mots-poses]').click()
    await expect.poll(() => sonsJoues(page)).toHaveLength(5)
  })

  test('la phrase reste, la relecture peut repartir du début', async ({ page }) => {
    await page.locator('[data-case="maman"]').click()
    await page.locator('[data-mots-poses]').click()
    await page.locator('[data-mots-poses]').click()

    await expect(motsPoses(page)).toHaveCount(1)
    await page.locator('[data-mots-poses]').click()
    await expect.poll(() => sonsJoues(page)).toHaveLength(3)
  })
})

test.describe('E15 : ce que la bande montre vraiment', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(13)
    await allumerLEnchainement(page)
  })

  /** Les images posées, et le cadre dans lequel elles doivent tenir. */
  async function imagesPosees(page: Page) {
    return page.locator('[data-mot-pose]').evaluateAll((mots) =>
      mots.map((mot) => {
        const image = mot.querySelector('.vignette')!.getBoundingClientRect()
        const cadre = mot.getBoundingClientRect()
        return {
          gauche: image.left,
          droite: image.right,
          largeur: image.width,
          depasseEnBas: image.bottom - cadre.bottom,
        }
      }),
    )
  }

  test('les images rétrécissent quand les mots s accumulent, sans se chevaucher ni se couper', async ({ page }) => {
    // le défaut d'origine : la taille se déduisait de la hauteur de la bande, qui ne bouge
    // pas. À cinq mots, 109 px d'image dans une case de 85, et les visages se recouvraient
    await page.locator('[data-case="maman"]').click()
    await page.locator('[data-case="papa"]').click()
    const [deuxMots] = await imagesPosees(page)

    for (const id of ['doudou', 'boire', 'manger', 'douche']) {
      await page.locator(`[data-case="${id}"]`).click()
    }
    const sixMots = await imagesPosees(page)
    expect(sixMots).toHaveLength(6)
    expect(sixMots[0]!.largeur, 'l image n a pas rétréci en se serrant').toBeLessThan(deuxMots!.largeur)

    for (let rang = 1; rang < sixMots.length; rang++) {
      expect(sixMots[rang]!.gauche, `l image ${rang} recouvre la précédente`).toBeGreaterThanOrEqual(
        sixMots[rang - 1]!.droite - 1,
      )
    }
    const fleche = (await page.locator('[data-retirer-mot]').boundingBox())!
    expect(sixMots.at(-1)!.droite, 'la dernière image passe sous la flèche').toBeLessThanOrEqual(fleche.x)
    for (const image of sixMots) {
      expect(image.depasseEnBas, 'l image est coupée par le bas de la bande').toBeLessThanOrEqual(1)
    }
  })

  test('couper la relecture éteint la case qui parlait', async ({ page }) => {
    // `couper()` détache ses rappels, donc le signal de fin ne part jamais : sans remise à
    // zéro, la case gardait son halo et l'enfant lisait « je parle » sur une case muette
    await page.locator('[data-case="maman"]').click()
    await page.locator('[data-case="papa"]').click()

    await page.locator('[data-mots-poses]').click()
    await expect(page.locator('.case.parle')).toHaveCount(1)

    await page.locator('[data-mots-poses]').click()
    await expect(page.locator('.case.parle')).toHaveCount(0)
  })
})

test.describe('E15 : la phrase survit', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install()
    await page.goto('/')
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(13)
    await allumerLEnchainement(page)
  })

  test('au changement de page', async ({ page }) => {
    // le réglage est déjà allumé, et il survit au rechargement du semoir
    await poserUneSecondePage(page)
    await page.locator('[data-case="maman"]').click()
    await expect(motsPoses(page)).toHaveCount(1)

    await page.locator('[data-page-suivante]').click()
    await expect(page.locator('[data-case="ballon"]')).toBeVisible()
    await expect(motsPoses(page)).toHaveText(['maman'])

    await page.locator('[data-case="ballon"]').click()
    await expect(motsPoses(page)).toHaveCount(2)
  })

  test('au changement de contexte', async ({ page }) => {
    await page.locator('[data-case="maman"]').click()
    await expect(motsPoses(page)).toHaveCount(1)

    await page.locator('[data-contextes] button').nth(1).click()
    await expect(motsPoses(page)).toHaveCount(1)

    await page.locator('[data-contextes] button').first().click()
    await expect(motsPoses(page)).toHaveText(['maman'])
  })

  test('au retour automatique de 30 secondes', async ({ page }) => {
    // trente secondes d'hésitation, c'est peu pour un enfant qui cherche son deuxième mot,
    // et aucune application du domaine ne fait disparaître un message sur un délai
    await page.locator('[data-case="maman"]').click()
    await page.locator('[data-contextes] button').nth(1).click()

    await page.clock.fastForward('00:31')

    await expect(page.locator('[data-contexte="maison"]')).toHaveClass(/actif/)
    await expect(motsPoses(page)).toHaveText(['maman'])
  })
})

test.describe('E15 : la planche « J ai mal »', () => {
  test('pose son mot dans la bande comme les autres', async ({ page }) => {
    // on avait prévu de l'en exclure, ses cases disant déjà des phrases entières. Sans
    // écho, l'enfant touchait son ventre et la bande restait vide : le parent perdait le
    // seul endroit où relire ce qui vient d'être dit.
    await page.goto('/')
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(13)
    await allumerLEnchainement(page)
    await allumerLeCorpsAToucher(page)

    await page.locator('[data-contexte="douleur"]').click()
    await expect(page.locator('[data-silhouette]')).toBeVisible()
    await page.locator('[data-region="mal-ventre"]').first().click()

    await expect(motsPoses(page)).toHaveText(['au ventre'])
  })
})

test.describe('E15 : la zone d entrée des parents', () => {
  test('garde toute la rangee et passe derriere ce que l enfant touche', async ({ page }) => {
    // Réduite à l'angle droit, elle laissait le parent dehors : il appuyait là où il avait
    // toujours appuyé, et plus rien ne répondait. Elle couvre de nouveau toute la rangée, et
    // ce sont les commandes de l'enfant qui passent devant, pas la zone qui recule.
    await page.goto('/')
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(13)
    const pleineLargeur = await rectangleDe(page, '[data-coin-parents]')

    await allumerLEnchainement(page)
    const apres = await rectangleDe(page, '[data-coin-parents]')
    expect(apres.width, 'la zone a reculé au lieu de passer dessous').toBe(pleineLargeur.width)

    await page.locator('[data-case="maman"]').click()
    const dessus = await page.evaluate(() => {
      const cibles = ['data-coin-parents', 'data-vider-phrase', 'data-mots-poses']
      const qui = (x: number, y: number) => {
        const trouve = document.elementFromPoint(x, y)?.closest(cibles.map((c) => `[${c}]`).join(','))
        return cibles.find((c) => trouve?.hasAttribute(c)) ?? 'rien'
      }
      const bande = document.querySelector('[data-bande-phrase]')!.getBoundingClientRect()
      const croix = document.querySelector('[data-vider-phrase]')!.getBoundingClientRect()
      const mots = document.querySelector('[data-mots-poses]')!.getBoundingClientRect()
      return {
        blancGauche: qui(bande.x + 8, bande.y + bande.height / 2),
        blancDroit: qui(bande.right - 8, bande.y + bande.height / 2),
        croix: qui(croix.x + croix.width / 2, croix.y + croix.height / 2),
        mots: qui(mots.x + mots.width / 2, mots.y + mots.height / 2),
      }
    })
    expect(dessus.blancGauche, 'le blanc de gauche n ouvre pas chez les parents').toBe('data-coin-parents')
    expect(dessus.blancDroit, 'le blanc de droite n ouvre pas chez les parents').toBe('data-coin-parents')
    expect(dessus.croix, 'la croix de l enfant est recouverte').toBe('data-vider-phrase')
    expect(dessus.mots, 'la relecture de la phrase est recouverte').toBe('data-mots-poses')

    // et le parent entre toujours
    await ouvrirEspaceParents(page)
    await expect(page.locator('[data-espace-parents]')).toBeVisible()
  })
})
