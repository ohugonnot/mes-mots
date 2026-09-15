import { test, expect } from '@playwright/test'
import {
  allumerLeCorpsAToucher,
  fermerEspaceParents,
  ouvrirEspaceParents,
  ouvrirOngletReglages,
  reglagesPersistes,
} from './verrou'

/**
 * La planche « J'ai mal », demandée par la mère : « un personnage de face et de dos ». Ce que
 * ces tests protègent, c'est que montrer un endroit du corps parle, et que les régions
 * restent posées sur le dessin quelle que soit la taille de l'écran.
 */
test.describe('E11 : la planche de la douleur', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // les corps sont éteints à la livraison : ce bloc entier porte sur ce que voit la famille
    // qui les rallume
    await allumerLeCorpsAToucher(page)
    await page.locator('[data-contexte="douleur"]').click()
    await page.locator('[data-silhouette]').waitFor()
  })

  test('montre les deux corps, et non une grille', async ({ page }) => {
    await expect(page.locator('[data-corps="face"]')).toBeVisible()
    await expect(page.locator('[data-corps="dos"]')).toBeVisible()
    await expect(page.locator('[data-grille="contexte"]')).toHaveCount(0)
  })

  test('toucher le ventre dit la phrase en haut de l écran', async ({ page }) => {
    await page.locator('[data-region="mal-ventre"]').first().click()

    await expect(page.locator('[data-bande-phrase]')).toContainText("J'ai mal au ventre")
  })

  test('viser l entrejambe dit le zizi, et le bas du dos dit les fesses', async ({ page }) => {
    // le pÃ¨re a visé le zizi et touché le ventre, deux fois : le tronc descendait jusque sur
    // l'entrejambe. On touche ici le pixel du dessin, à 54 % de la hauteur du corps, et non
    // le milieu de la région, qui donnerait raison à n'importe quel placement.
    for (const [cote, phrase] of [
      ['face', "J'ai mal au zizi"],
      ['dos', "J'ai mal aux fesses"],
    ] as const) {
      const corps = (await page.locator(`[data-corps="${cote}"]`).boundingBox())!
      await page.mouse.click(corps.x + corps.width / 2, corps.y + corps.height * 0.54)

      await expect(page.locator('[data-bande-phrase]')).toContainText(phrase)
    }
  })

  test('viser le cou dit le cou, et la pointe de l épaule dit le bras', async ({ page }) => {
    // Le cou était posé quatre points trop bas, sur les clavicules, et deux morceaux de
    // ventre bouchaient les épaules : le doigt sur le cou disait « j'ai mal au ventre » et
    // celui sur l'épaule aussi. On touche le pixel du dessin, mesuré ligne par ligne : le
    // cou le plus étroit est à 14 % de la hauteur de face, la pointe de l'épaule à 20 %.
    const corps = (await page.locator('[data-corps="face"]').boundingBox())!

    await page.mouse.click(corps.x + corps.width * 0.48, corps.y + corps.height * 0.145)
    await expect(page.locator('[data-bande-phrase]')).toContainText("J'ai mal au cou")

    await page.mouse.click(corps.x + corps.width * 0.24, corps.y + corps.height * 0.2)
    await expect(page.locator('[data-bande-phrase]')).toContainText("J'ai mal au bras")
  })

  test('aucun des deux corps ne porte de visage, et chacun dit le bon mot', async ({ page }) => {
    // Le visage avait été ajouté le 9 septembre pour séparer le devant du derrière, puis
    // retiré le 12 : il faisait peur à l'enfant. Ce que ce test garde, c'est qu'aucune tête
    // ne se remette à porter d'yeux, et que les régions restent posées sur le bon corps.
    for (const [cote, phraseAttendue] of [
      ['face', "J'ai mal au ventre"],
      ['dos', "J'ai mal au dos"],
    ] as const) {
      const corps = (await page.locator(`img[data-corps="${cote}"]`).boundingBox())!
      await page.mouse.click(corps.x + corps.width / 2, corps.y + corps.height * 0.35)
      await expect(page.locator('[data-bande-phrase]')).toContainText(phraseAttendue)
    }

    // aucun des deux dessins ne porte de pixels sombres à hauteur des yeux
    const traitsDuVisage = await page.evaluate(async () => {
      const compter = async (cote: string) => {
        const balise = document.querySelector(`img[data-corps="${cote}"]`) as HTMLImageElement
        const canevas = document.createElement('canvas')
        canevas.width = 240
        canevas.height = 500
        const dessin = canevas.getContext('2d')!
        const image = new Image()
        image.src = balise.src
        await image.decode()
        dessin.drawImage(image, 0, 0, 240, 500)
        // le cœur du visage : loin du contour de la tête, qui est sombre lui aussi
        const pixels = dessin.getImageData(100, 30, 26, 36).data
        let sombres = 0
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3]! > 200 && pixels[i]! < 100) sombres++
        }
        return sombres
      }
      return { face: await compter('face'), dos: await compter('dos') }
    })

    // Mesuré dans cette fenêtre : 11 pixels sombres de dos, qui sont un bout de contour de
    // tête et non des traits. De face il y en avait 60 avant l'effacement, 248 à la première
    // version. Le seuil dit « pas de visage », il ne mesure pas l'épaisseur d'un trait.
    expect(traitsDuVisage.face, 'le corps de face a retrouvé un visage').toBeLessThan(30)
    expect(traitsDuVisage.dos, 'le corps de dos a un visage').toBeLessThan(30)
  })

  test('un doigt qui ripe hors de la zone dit quand même le bon mot', async ({ page }) => {
    // Les zones épousent le dessin : le cou de dos fait sept millimètres de haut. Un doigt
    // qui glisse de quelques pixels obtenait le silence, sur l'écran fait pour un moment où
    // l'enfant a mal. C'est l'endroit du premier contact qui compte.
    const corps = (await page.locator('img[data-corps="face"]').boundingBox())!
    const ventre = { x: corps.x + corps.width / 2, y: corps.y + corps.height * 0.35 }

    await page.mouse.move(ventre.x, ventre.y)
    await page.mouse.down()
    // il dérive de trente pixels vers le bas, bien au-delà de la zone touchée
    await page.mouse.move(ventre.x, ventre.y + 30, { steps: 5 })
    await page.mouse.up()

    await expect(page.locator('[data-bande-phrase]')).toContainText("J'ai mal au ventre")
  })

  test('les zones se montrent à l ouverture, puis s effacent', async ({ page }) => {
    // Sans ce premier coup d'œil, l'enfant arrive devant deux dessins plats après avoir
    // quitté des cartes en relief : rien ne lui dit que ce corps se touche. C'est le
    // comportement livré par défaut de Snap Scene, l'outil de référence du segment.
    const bordure = () =>
      page.locator('[data-region]').first().evaluate((n) => getComputedStyle(n).borderTopColor)

    const auDebut = await bordure()
    expect(auDebut, 'les zones sont invisibles dès l ouverture').not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/)

    // le dessin doit redevenir lisible : on ne choisit pas entre des cadres, on montre un corps
    await expect.poll(bordure, { timeout: 5000 }).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  })

  test('presque aucun endroit du corps ne reste muet, la poitrine et les cuisses comprises', async ({
    page,
  }) => {
    // Mesuré : 22 % de la peau ne répondait à rien, et pas n'importe où. La poitrine et les
    // cuisses, c'est-à-dire ce qu'un enfant assis se touche en premier, étaient muettes : il
    // tapait, rien ne sortait, et rien ne lui disait que c'était l'endroit et non le geste.
    for (const [cote, plancher] of [
      ['face', 12],
      ['dos', 6],
    ] as const) {
      const boite = (await page.locator(`img[data-corps="${cote}"]`).boundingBox())!
      const mesure = await page.evaluate(
        async ([cote, x, y, largeur, hauteur]) => {
          const balise = document.querySelector(`img[data-corps="${cote}"]`) as HTMLImageElement
          const canevas = document.createElement('canvas')
          canevas.width = 240
          canevas.height = 500
          const dessin = canevas.getContext('2d')!
          const image = new Image()
          image.src = balise.src
          await image.decode()
          dessin.drawImage(image, 0, 0, 240, 500)
          const pixels = dessin.getImageData(0, 0, 240, 500).data
          let peau = 0
          let repondent = 0
          const zonesMuettes: Record<string, number> = {}
          for (let py = 3; py < 500; py += 4) {
            for (let px = 3; px < 240; px += 4) {
              const i = (py * 240 + px) * 4
              // la peau du dessin : opaque, claire, ni le trait noir ni le fond
              if (pixels[i + 3]! < 200 || pixels[i]! < 150 || pixels[i + 1]! < 120) continue
              peau++
              const sous = document.elementFromPoint(
                (x as number) + (px / 240) * (largeur as number),
                (y as number) + (py / 500) * (hauteur as number),
              )
              if (sous?.closest('[data-region]')) repondent++
              else {
                // deux endroits nommés qu'on surveille en particulier
                const hauteurRelative = py / 500
                if (hauteurRelative > 0.18 && hauteurRelative < 0.25) zonesMuettes.epaules = (zonesMuettes.epaules ?? 0) + 1
                if (hauteurRelative > 0.27 && hauteurRelative < 0.45) zonesMuettes.torse = (zonesMuettes.torse ?? 0) + 1
                if (hauteurRelative > 0.6 && hauteurRelative < 0.85) zonesMuettes.cuisses = (zonesMuettes.cuisses ?? 0) + 1
              }
            }
          }
          return { peau, repondent, zonesMuettes }
        },
        [cote, boite.x, boite.y, boite.width, boite.height] as const,
      )

      const partMuette = ((mesure.peau - mesure.repondent) / mesure.peau) * 100
      expect(partMuette, `${cote} : ${partMuette.toFixed(0)} % du corps ne répond à rien`).toBeLessThan(plancher)
      // La ligne des épaules : le trou laissé par le cou mal placé avait fait poser deux
      // morceaux de ventre là, et le banc de mutation remettait l'ancien découpage sans
      // rougir. Mesuré : 1 point sur le code juste, au bord arrondi entre le bras et le
      // tronc, contre 169 si le ventre repart quatre points plus bas.
      expect(mesure.zonesMuettes.epaules ?? 0, `${cote} : l épaule a des points muets`).toBeLessThan(5)
      expect(mesure.zonesMuettes.torse ?? 0, `${cote} : le torse a des points muets`).toBe(0)
      expect(mesure.zonesMuettes.cuisses ?? 0, `${cote} : les cuisses ont des points muets`).toBe(0)
    }
  })

  test('les régions restent sur le corps, à toute taille d écran', async ({ page }) => {
    // elles sont posées en pourcentage du dessin : c'est ce qui remplace ici la promesse
    // qu'une case ne change jamais de place
    for (const taille of [
      { width: 800, height: 1280 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(taille)
      const corps = (await page.locator('[data-corps="face"]').boundingBox())!
      const ventre = (await page.locator('[data-region="mal-ventre"]').first().boundingBox())!

      const gauche = (ventre.x - corps.x) / corps.width
      const haut = (ventre.y - corps.y) / corps.height
      expect(gauche, `gauche en ${taille.width}`).toBeGreaterThan(0.27)
      expect(gauche, `gauche en ${taille.width}`).toBeLessThan(0.32)
      // à la ligne des épaules, mesurée à 15 % sur le dessin, et pas quatre points plus bas
      expect(haut, `haut en ${taille.width}`).toBeGreaterThan(0.155)
      expect(haut, `haut en ${taille.width}`).toBeLessThan(0.19)
    }
  })

  test('la page suivante porte le visage, en grille ordinaire', async ({ page }) => {
    // six régions dans une tête de quarante pixels seraient intouchables : le visage se
    // choisit en images, sur la page que l'enfant connaît déjà
    await page.locator('[data-page-suivante]').click()

    await expect(page.locator('[data-case="mal-dents"]')).toBeVisible()
    await expect(page.locator('[data-silhouette]')).toHaveCount(0)
  })

  test('sans enregistrement, la tablette lit le texte', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { dits: string[] }).dits = []
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          speak: (phrase: SpeechSynthesisUtterance) =>
            (window as unknown as { dits: string[] }).dits.push(phrase.text),
          cancel: () => {},
        },
      })
    })
    await page.reload()
    await page.locator('[data-contexte="douleur"]').click()

    await page.locator('[data-region="mal-tete"]').first().click()

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { dits: string[] }).dits))
      .toEqual(["J'ai mal à la tête"])
  })
})

/**
 * Un corps dessiné effraie certains enfants. Le parent peut ramener
 * « J'ai mal » à ce que l'enfant connaît : des cases, une par partie du corps, avec leur
 * dessin. Ce sont les mêmes mots, à la même place.
 */
test.describe('E11 : « J ai mal » en cases plutôt qu en corps', () => {
  test('à la livraison, la planche est une grille dont les mots parlent', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-contexte="douleur"]').click()

    await expect(page.locator('[data-silhouette]')).toHaveCount(0)
    // les dix mêmes parties du corps, chacune avec son pictogramme
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(10)
    await expect(page.locator('[data-case="mal-ventre"] img')).toBeVisible()

    // repliée à la forme réglée par la famille, et non à sa matrice de rangement : celle-ci
    // est de deux rangées sur cinq, ce qui donnerait ici des cases hautes et étroites
    const colonnes = await page
      .locator('[data-grille="contexte"]')
      .evaluate((grille) => getComputedStyle(grille).gridTemplateColumns.split(' ').length)
    expect(colonnes).toBe(4)
    const boite = (await page.locator('[data-case="mal-tete"]').boundingBox())!
    expect(boite.height, 'une case de douleur plus haute que large du double').toBeLessThan(boite.width * 2)

    await page.locator('[data-case="mal-tete"]').click()
    await expect(page.locator('[data-bande-phrase]')).toContainText("J'ai mal à la tête")
  })

  test('rallumé puis réteint, la planche fait l aller et le retour', async ({ page }) => {
    await page.goto('/')
    await allumerLeCorpsAToucher(page)
    await page.locator('[data-contexte="douleur"]').click()
    await expect(page.locator('[data-silhouette]')).toBeVisible()

    await ouvrirEspaceParents(page)
    await ouvrirOngletReglages(page)
    await page.locator('[data-reglage-corps]').uncheck()
    await expect.poll(async () => (await reglagesPersistes(page)).corpsAToucher).toBe(false)
    await fermerEspaceParents(page)

    await page.locator('[data-contexte="douleur"]').click()

    await expect(page.locator('[data-silhouette]')).toHaveCount(0)
    await expect(page.locator('[data-grille="contexte"] [data-case]')).toHaveCount(10)
  })
})
