import { test, expect, type Page } from '@playwright/test'
import {
  deplierLeJournal,
  fermerEspaceParents,
  ouvrirEspaceParents,
  ouvrirGestionContextes,
  ouvrirOngletReglages,
  ouvrirOngletSauvegarde,
} from './verrou'

/**
 * Le balayage de tous les écrans sur les trois supports réels : le téléphone de la mère
 * (390 px), la tablette de l'enfant (800 px) et l'écran où le père configure (1600 px).
 * Aucun jugement à l'œil ici, seulement ce qui se mesure : rien ne déborde en largeur, rien
 * ne recouvre une commande, et aucune liste ne défile à part de sa page.
 */

const SUPPORTS = [
  { nom: 'téléphone', largeur: 390, hauteur: 844 },
  { nom: 'tablette', largeur: 800, hauteur: 1280 },
  { nom: 'bureau', largeur: 1600, hauteur: 1000 },
]

interface Defauts {
  deborde: string[]
  recouvertes: string[]
  defilementsImbriques: string[]
}

/**
 * Ce qui ne va pas sur l'écran affiché. Le point milieu d'une commande doit la toucher
 * elle-même : c'est ainsi qu'on attrape un bandeau posé par-dessus, qu'aucune mesure de
 * position ne révèle. Les commandes hors de l'écran visible sont ignorées, elles sont
 * simplement plus bas dans la page.
 */
async function defautsDeLEcran(page: Page): Promise<Defauts> {
  return page.evaluate(() => {
    const nommer = (n: Element) => {
      const donnees = Object.keys((n as HTMLElement).dataset)
        .map((cle) => `[data-${cle.replace(/[A-Z]/g, (l) => '-' + l.toLowerCase())}]`)
        .join('')
      return (
        `${n.tagName.toLowerCase()}${n.className && typeof n.className === 'string' ? '.' + n.className.split(' ')[0] : ''}` +
        `${n.getAttribute('type') ? `[type=${n.getAttribute('type')}]` : ''}${donnees}` +
        `${(n as HTMLElement).innerText ? ' « ' + (n as HTMLElement).innerText.slice(0, 24).replace(/\n/g, ' ') + ' »' : ''}`
      )
    }

    const deborde: string[] = []
    if (document.documentElement.scrollWidth > window.innerWidth + 1)
      deborde.push(`la page fait ${document.documentElement.scrollWidth} px de large`)
    document.querySelectorAll('*').forEach((n) => {
      const boite = n.getBoundingClientRect()
      if (boite.width > 0 && boite.right > window.innerWidth + 1) deborde.push(nommer(n))
    })

    // Un panneau posé par-dessus la page recouvre tout ce qui est derrière, et c'est son
    // travail : on ne vérifie alors que ce qu'il contient lui-même.
    const panneaux = [...document.querySelectorAll('.panneau')].filter(
      (n) => n.getBoundingClientRect().width > 0,
    )
    const dessous = panneaux[panneaux.length - 1] ?? document

    const recouvertes: string[] = []
    dessous
      .querySelectorAll('button, select, summary, input, a[href], [role=button]')
      .forEach((commande) => {
        // Un champ de fichier est volontairement caché derrière son bouton, et une commande
        // voilée pendant un déplacement est hors du jeu : ni l'un ni l'autre n'est un défaut.
        if (commande.matches('input[type=file]')) return
        if (!(commande as HTMLElement).checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return
        const quiEstDessus = () => {
          const boite = commande.getBoundingClientRect()
          if (boite.width === 0 || boite.height === 0) return null
          if (boite.top < 0 || boite.bottom > window.innerHeight) return null
          const dessus = document.elementFromPoint(
            boite.x + boite.width / 2,
            boite.y + boite.height / 2,
          )
          return dessus && !commande.contains(dessus) && !dessus.contains(commande) ? dessus : null
        }

        // Une barre d'action collante recouvre au repos ce qu'on atteint en faisant défiler,
        // et ce n'est pas un défaut. On ne retient donc que ce qui reste couvert une fois la
        // commande amenée au milieu de l'écran, c'est-à-dire ce qu'aucun geste ne dégage.
        if (!quiEstDessus()) return
        commande.scrollIntoView({ block: 'center' })
        const dessus = quiEstDessus()
        if (dessus) recouvertes.push(`${nommer(commande)} est sous ${nommer(dessus)}`)
      })

    // La page défile, c'est normal. Une liste qui défile dedans, sans rien pour marquer sa
    // frontière, fait partir le doigt sur l'une ou sur l'autre selon dix pixels d'écart.
    const defilementsImbriques: string[] = []
    const page = document.querySelector('[data-espace-parents]')
    page
      ?.querySelectorAll('*')
      .forEach((n) => {
        // Un panneau posé par-dessus défile pour lui-même, et c'est voulu : sans ça sa barre
        // d'action se collait au bas de la fenêtre et traversait le formulaire en son milieu.
        if (n.closest('.panneau')) return
        const defilant = ['auto', 'scroll'].includes(getComputedStyle(n).overflowY)
        if (defilant && n.scrollHeight > n.clientHeight + 1) defilementsImbriques.push(nommer(n))
      })

    return { deborde, recouvertes, defilementsImbriques }
  })
}

async function verifier(page: Page, ecran: string, support: string): Promise<void> {
  // Une page qui glisse est mesurée à mi-course : elle est alors hors de l'écran par
  // construction, et tout déborderait. On attend qu'elle soit posée.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
  const defauts = await defautsDeLEcran(page)
  expect(defauts.deborde, `${ecran} déborde en largeur sur ${support}`).toEqual([])
  expect(defauts.recouvertes, `une commande est recouverte sur ${ecran}, ${support}`).toEqual([])
  expect(
    defauts.defilementsImbriques,
    `${ecran} défile à part de sa page sur ${support}`,
  ).toEqual([])
}

/** Une journée bavarde, posée directement dans le magasin : c'est elle qui charge les écrans. */
async function poserUneJournee(page: Page): Promise<void> {
  await page.evaluate(async (maintenant) => {
    const base = await new Promise<IDBDatabase>((ok, ko) => {
      const requete = indexedDB.open('mes-mots')
      requete.onsuccess = () => ok(requete.result)
      requete.onerror = () => ko(requete.error)
    })
    await new Promise<void>((ok, ko) => {
      const transaction = base.transaction('journal', 'readwrite')
      for (let rang = 0; rang < 15; rang += 1) {
        const horodatage = maintenant - rang * 25 * 60 * 1000
        transaction.objectStore('journal').put({ horodatage, mot: `MOT${rang}` }, horodatage)
      }
      transaction.oncomplete = () => ok()
      transaction.onerror = () => ko(transaction.error)
    })
    base.close()
  }, Date.now())
}

for (const { nom, largeur, hauteur } of SUPPORTS) {
  test.describe(`E17 : tous les écrans sur ${nom} (${largeur} px)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur })
    })

    test("l'écran de l'enfant, chaque contexte et chaque page", async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('[data-case]')).toHaveCount(13)
      await verifier(page, 'la maison', nom)

      // Extérieur n'a pas de bouton tant qu'aucun de ses mots n'est révélé : on parcourt donc
      // ceux qui existent vraiment, et chacune de leurs pages.
      const contextes = page.locator('[data-contexte]')
      for (let rang = 0; rang < (await contextes.count()); rang += 1) {
        const id = await contextes.nth(rang).getAttribute('data-contexte')
        await contextes.nth(rang).click()
        await verifier(page, `le contexte ${id}`, nom)

        const suivante = page.locator('[data-pagination] [data-page-suivante]')
        for (let numero = 2; numero <= 4; numero += 1) {
          if (!(await suivante.count()) || !(await suivante.isEnabled())) break
          await suivante.click()
          await verifier(page, `le contexte ${id}, page ${numero}`, nom)
        }
      }
    })

    test("la phrase en cours ne recouvre pas la grille", async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('[data-case]')).toHaveCount(13)
      await ouvrirEspaceParents(page)
      await ouvrirOngletReglages(page)
      await page.locator('[data-reglage-enchainement]').check()
      // changer un réglage lève le rappel de sauvegarde, qui prend la place de l'enfant
      await fermerEspaceParents(page)

      await page.locator('[data-case="maman"]').click()
      await page.locator('[data-case="boire"]').click()
      await expect(page.locator('[data-bande-phrase]')).toBeVisible()
      await verifier(page, 'la bande de phrase', nom)
    })

    test("l'espace parents, ses trois pages et ses modes", async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('[data-case]')).toHaveCount(13)
      await page.locator('[data-case="maman"]').click()
      await poserUneJournee(page)
      await page.reload()
      await expect(page.locator('[data-case]')).toHaveCount(13)
      await ouvrirEspaceParents(page)
      await verifier(page, 'les mots', nom)

      await deplierLeJournal(page)
      await expect(page.locator('[data-entree-journal]')).toHaveCount(16)
      await verifier(page, 'les mots, journal ouvert', nom)

      await ouvrirGestionContextes(page)
      await verifier(page, 'les mots, gestion des contextes', nom)
      await page.locator('[data-actions-contexte] summary').click()

      await page.locator('[data-deplacer-case]').first().click()
      await expect(page.locator('[data-bandeau-deplacement]')).toBeVisible()
      await verifier(page, 'les mots, en cours de déplacement', nom)
      await page.locator('[data-annuler-deplacement]').click()

      await page.locator('[data-modifier-case]').first().click()
      await verifier(page, "les mots, l'éditeur d'un mot", nom)
      await page.locator('[data-fermer-editeur]').click()

      // en dernier : l'ajout saute sur la page qui a de la place, et cette page est vide
      await page.locator('[data-ajouter-mot]').click()
      await expect(page.locator('[data-bandeau-ajout]')).toBeVisible()
      await verifier(page, "les mots, en cours d'ajout", nom)
      await page.locator('[data-annuler-ajout]').click()

      await ouvrirOngletSauvegarde(page)
      await verifier(page, 'la sauvegarde', nom)

      await ouvrirOngletReglages(page)
      await verifier(page, 'les réglages', nom)
    })

    test('chaque contexte se modifie sans rien casser', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('[data-case]')).toHaveCount(13)
      await ouvrirEspaceParents(page)

      for (const contexte of ['maison', 'exterieur', 'douleur']) {
        await page.locator('[data-selecteur-planche]').selectOption(contexte)
        await verifier(page, `les mots du contexte ${contexte}`, nom)
      }
    })
  })
}
