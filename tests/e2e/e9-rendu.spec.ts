import { test, expect, type Page } from '@playwright/test'
import {
  allumerLeCorpsAToucher,
  ouvrirEspaceParents,
  ouvrirOngletReglages,
  ouvrirOngletSauvegarde,
} from './verrou'

/**
 * La mise en page à trois largeurs. Les autres suites ne regardent que la tablette, et
 * c'est ainsi qu'une grille cassée sur un écran de bureau est partie en ligne sans que
 * rien ne s'en aperçoive : cases de tailles différentes, rangées décalées, écran vide aux
 * trois quarts. Les captures se relisent à l'œil, les mesures ci-dessous ne le demandent
 * pas.
 */
/**
 * Les formats réellement rencontrés : le téléphone de la mère dans les deux sens, un petit
 * téléphone, la tablette de l'enfant dans les deux sens, et un écran de bureau. La tablette
 * en paysage manquait, et c'est précisément là que les cases s'aplatissent le plus.
 */
const ECRANS = [
  { nom: 'mobile', viewport: { width: 390, height: 844 } },
  { nom: 'mobile-paysage', viewport: { width: 844, height: 390 } },
  { nom: 'petit-mobile', viewport: { width: 360, height: 640 } },
  { nom: 'tablette', viewport: { width: 800, height: 1280 } },
  { nom: 'tablette-paysage', viewport: { width: 1280, height: 800 } },
  { nom: 'bureau', viewport: { width: 1440, height: 900 } },
]

async function debordeALHorizontale(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
}

for (const ecran of ECRANS) {
  test.describe(`rendu en ${ecran.nom}`, () => {
    test.use({ viewport: ecran.viewport })

    test("la grille de l'enfant", async ({ page }) => {
      await page.goto('/')
      await page.locator('[data-case]').first().waitFor()
      await page.screenshot({ path: `captures/${ecran.nom}-grille.png` })

      expect(await debordeALHorizontale(page)).toBe(false)

      const cases = await page.locator('[data-case]').all()
      const boites = await Promise.all(cases.map((c) => c.boundingBox()))
      for (const boite of boites) {
        // une case aplatie en barre est le symptôme qui a fait écrire la mère : le mot
        // finit par recouvrir l'image, et l'enfant ne reconnaît plus son picto
        expect(boite!.width / boite!.height).toBeGreaterThan(0.55)
        expect(boite!.width / boite!.height).toBeLessThan(1.9)
        // une rangée qui sort de l'écran est perdue pour l'enfant : il ne sait pas défiler
        expect(boite!.y + boite!.height).toBeLessThanOrEqual(ecran.viewport.height + 1)
      }

      // le nom d'un contexte tient sur une ligne, et la pagination reste dans la barre :
      // avec une image, le nom passait à la ligne et le bouton chassait la flèche dehors
        const rangeeContextes = (await page.locator('[data-contextes]').boundingBox())!
      for (const bouton of await page.locator('[data-contexte]').all()) {
        const boite = (await bouton.boundingBox())!
        expect(boite.height, 'nom de contexte sur deux lignes').toBeLessThanOrEqual(rangeeContextes.height)
        const rogne = await bouton.evaluate((n) => n.scrollWidth - n.clientWidth)
        expect(rogne, 'nom de contexte tronqué').toBeLessThanOrEqual(1)
      }
      // le contexte de départ n'a qu'une page : la pagination n'existe pas toujours
      const flechesuivante = page.locator('[data-page-suivante]')
      const suivante = (await flechesuivante.count()) ? await flechesuivante.boundingBox() : null
      if (suivante) {
        expect(suivante.x + suivante.width, 'flèche hors de la barre').toBeLessThanOrEqual(
          rangeeContextes.x + rangeeContextes.width + 1,
        )
      }

      // la barre des mots essentiels et la grille sont deux planches distinctes : sans
      // cadre commun elles prennent chacune leur largeur, et l'écran part de travers
      const grille = (await page.locator('[data-grille="contexte"]').boundingBox())!
      const barre = (await page.locator('[data-grille="barre"]').boundingBox())!
      expect(Math.abs(grille.x - barre.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(grille.width - barre.width)).toBeLessThanOrEqual(1)
    })

    test('aucun mot ne se fait couper dans sa case', async ({ page }) => {
      // « PROMENADE » et « TABLETTE » sortaient de leur bande et se faisaient rogner net :
      // un mot coupé ne se reconnaît plus, et c'est l'adulte qui accompagne qui le lit.
      await page.goto('/')
      await page.locator('[data-case]').first().waitFor()

      const mesures = await page.evaluate(() =>
        [...document.querySelectorAll('[data-case]')].flatMap((carte) => {
          const largeurCase = carte.getBoundingClientRect().width
          // deux endroits portent un mot : la bande sous l'image, et le mot en grand qui
          // remplace l'image quand la case n'en a pas. MOI, OUI et NON n'affichaient plus
          // que leur initiale en paysage sur un téléphone.
          const bande = carte.querySelector('.etiquette') ?? carte.lastElementChild
          const repere = carte.querySelector('.mot-repere')
          const mesuresDeLaCarte = []
          if (bande?.textContent?.trim()) {
            mesuresDeLaCarte.push({
              mot: bande.textContent.trim(),
              rogne: bande.scrollWidth - bande.clientWidth,
              police: parseFloat(getComputedStyle(bande).fontSize),
              largeurCase,
            })
          }
          if (repere?.textContent?.trim()) {
            const cadre = repere.parentElement!
            mesuresDeLaCarte.push({
              mot: repere.textContent.trim(),
              rogne: Math.max(cadre.scrollWidth - cadre.clientWidth, cadre.scrollHeight - cadre.clientHeight),
              police: parseFloat(getComputedStyle(repere).fontSize),
              largeurCase,
            })
          }
          return mesuresDeLaCarte
        }),
      )
      expect(mesures.length, 'aucun mot mesuré').toBeGreaterThan(0)

      for (const { mot, rogne, police, largeurCase } of mesures) {
        // sous 70 px de case, le plancher de lisibilité l'emporte : mieux vaut un mot un
        // peu rogné qu'une police de cinq pixels, et cette taille n'arrive qu'en paysage
        // sur un téléphone, qui n'est pas l'appareil de l'enfant
        if (largeurCase >= 70) expect(rogne, `${mot} est coupé`).toBeLessThanOrEqual(1)
        expect(police, `${mot} est écrit trop petit`).toBeGreaterThanOrEqual(8)
      }
    })

    test('le contrôle de page ne pousse aucun bouton de contexte', async ({ page }) => {
      // La place du contrôle est promise réservée : c'est ce qui permet à l'enfant de
      // retrouver ses mondes au même endroit, qu'un contexte ait une ou plusieurs pages.
      // Elle se faisait écraser dès que la barre se remplissait, et le contrôle en sortait.
      await page.goto('/')
      await page.locator('[data-case]').first().waitFor()
      const barre = (await page.locator('[data-contextes]').boundingBox())!
      const positions = async () =>
        Promise.all(
          (await page.locator('[data-contexte]').all()).map(async (n) => Math.round((await n.boundingBox())!.x)),
        )
      const avant = await positions()

      // « J'ai mal » porte deux pages : le contrôle apparaît, et on va sur la seconde pour
      // que la flèche « précédente » se montre elle aussi
      await page.locator('[data-contexte="douleur"]').click()
      await page.locator('[data-page-suivante]').click()

      expect(await positions(), 'les boutons de contexte ont bougé').toEqual(avant)
      const zone = (await page.locator('[data-pagination]').boundingBox())!
      const precedente = (await page.locator('[data-page-precedente]').boundingBox())!
      const suivante = (await page.locator('[data-page-suivante]').boundingBox())!
      expect(precedente.x, 'la flèche précédente est rognée').toBeGreaterThanOrEqual(zone.x - 0.5)
      expect(suivante.x + suivante.width, 'la flèche suivante sort de la barre').toBeLessThanOrEqual(
        barre.x + barre.width + 0.5,
      )

      // Plafond des commandes de navigation : à 78 % d'une rangée de tablette, la flèche
      // montait à 90 x 80 et le bouton de contexte à 106 x 80, le quart d'une case de mots.
      // Ce sont des commandes, elles ne doivent pas peser autant que le vocabulaire.
      const contexte = (await page.locator('[data-contexte]').first().boundingBox())!
      for (const [quoi, boite] of [
        ['la flèche de page', suivante],
        ['le bouton de contexte', contexte],
      ] as const) {
        expect(boite.height, `${quoi} dépasse sa cible de 64 px`).toBeLessThanOrEqual(64.5)
      }
    })

    test('la planche « J\'ai mal » et l\'éditeur d\'un mot', async ({ page }) => {
      // Deux écrans que rien ne regardait à ces tailles : les corps à toucher, et le
      // panneau où la mère écrit ses mots, qui est le plus dense de l'application.
      await page.goto('/')
      await allumerLeCorpsAToucher(page)
      await page.locator('[data-contexte="douleur"]').click()
      await page.locator('[data-silhouette]').waitFor()
      await page.screenshot({ path: `captures/${ecran.nom}-douleur.png` })
      expect(await debordeALHorizontale(page)).toBe(false)

      // les deux corps tiennent dans l'écran : l'enfant ne sait pas faire défiler
      for (const cote of ['face', 'dos']) {
        const corps = (await page.locator(`[data-corps="${cote}"]`).boundingBox())!
        expect(corps.y + corps.height, `le corps de ${cote} sort de l'écran`).toBeLessThanOrEqual(
          ecran.viewport.height + 1,
        )
      }

      await ouvrirEspaceParents(page)
      await page.locator('[data-modifier-case]').first().click()
      await page.locator('[data-champ-label]').waitFor()
      await page.screenshot({ path: `captures/${ecran.nom}-editeur.png`, fullPage: true })

      expect(await debordeALHorizontale(page)).toBe(false)

      // « Enregistrer » se voit sans dérouler : sur un téléphone il était à trois cents
      // pixels sous le pli, et on arrivait en butée juste au-dessus du bouton de suppression
      const valider = (await page.locator('[data-enregistrer-case]').boundingBox())!
      expect(valider.y + valider.height, 'Enregistrer est sous le pli').toBeLessThanOrEqual(
        ecran.viewport.height + 1,
      )

      // le panneau reste dans la fenêtre : ailleurs, un parent ne peut plus l'atteindre
      const panneau = (await page.locator('[data-editeur-case]').boundingBox())!
      expect(panneau.x, "l'éditeur sort à gauche").toBeGreaterThanOrEqual(-1)
      expect(panneau.x + panneau.width, "l'éditeur sort à droite").toBeLessThanOrEqual(
        ecran.viewport.width + 1,
      )
    })

    test("l'espace parents", async ({ page }) => {
      await page.goto('/')
      await ouvrirEspaceParents(page)
      await page.screenshot({ path: `captures/${ecran.nom}-admin.png`, fullPage: true })

      expect(await debordeALHorizontale(page)).toBe(false)

      // les deux autres pages portent tout ce qui est rare et grave : elles se regardent
      // aussi, sinon les deux tiers de cet écran ne seraient plus vus à aucune largeur
      for (const page2 of [
        { nom: 'sauvegarde', ouvrir: ouvrirOngletSauvegarde, racine: '[data-onglet-sauvegarde]' },
        { nom: 'reglages', ouvrir: ouvrirOngletReglages, racine: '[data-onglet-reglages]' },
      ]) {
        await page2.ouvrir(page)
        await page.screenshot({ path: `captures/${ecran.nom}-admin-${page2.nom}.png`, fullPage: true })

        expect(await debordeALHorizontale(page)).toBe(false)

        // chaque cible se touche au doigt : la piste d'une réglette fait quatre pixels de
        // haut par défaut. Les boutons radio sont exclus, masqués derrière leur pavé.
        const cibles = `${page2.racine} button, ${page2.racine} label, ${page2.racine} input[type="range"]`
        for (const cible of await page.locator(cibles).all()) {
          const boite = await cible.boundingBox()
          if (!boite) continue
          expect(boite.height, `cible tactile trop basse : ${await cible.evaluate((n) => n.outerHTML.slice(0, 60))}`)
            .toBeGreaterThanOrEqual(40)
        }
      }
    })
  })
}
