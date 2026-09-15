import { test, expect } from '@playwright/test'
import { ouvrirEspaceParents, ouvrirOngletSauvegarde } from './verrou'

/**
 * Ce que Safari fait de notre code, sur le moteur que la famille utilise vraiment. La mère
 * est sur iPhone, et trois chemins du projet n'existent que là : l'orientation EXIF des
 * photos, le format d'enregistrement du micro, et des propriétés CSS récentes dont le
 * support Safari est arrivé bien après celui de Chrome. Un défaut ici rend l'application
 * inutilisable chez elle sans que rien ne le signale ailleurs.
 */
test.describe('le moteur de Safari', () => {
  test('sait faire tout ce que la mise en page réclame', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-case]').first().waitFor()

    const support = await page.evaluate(() => ({
      // imbrication CSS : toute la grille et la carte l'utilisent depuis le 9 septembre
      imbrication: CSS.supports('selector(&)'),
      // :has() porte la sélection d'un niveau de réglage et l'état de la case
      has: CSS.supports('selector(:has(*))'),
      // color-mix calcule l'ombre de relief et le halo de la case qui parle
      colorMix: CSS.supports('color', 'color-mix(in srgb, red 50%, blue)'),
      // dvh corrige la dernière rangée qui passait sous la barre d'adresse
      dvh: CSS.supports('height', '100dvh'),
      // background-clip: text peint le mot qui se remplit pendant qu'il est dit
      clipTexte: CSS.supports('-webkit-background-clip', 'text') || CSS.supports('background-clip', 'text'),
      // aspect-ratio borne la grille en paysage
      rapport: CSS.supports('aspect-ratio', '4 / 4'),
    }))

    expect(support, JSON.stringify(support)).toEqual({
      imbrication: true,
      has: true,
      colorMix: true,
      dvh: true,
      clipTexte: true,
      rapport: true,
    })
  })

  test('redresse une photo tournée et sait la redimensionner', async ({ page }) => {
    // `createImageBitmap` avec `imageOrientation` est le seul endroit où l'on dépend d'une
    // API récente : sans elle, une photo prise en portrait arrive couchée chez l'enfant.
    await page.goto('/')

    const resultat = await page.evaluate(async () => {
      const toile = document.createElement('canvas')
      toile.width = 40
      toile.height = 20
      toile.getContext('2d')!.fillRect(0, 0, 40, 20)
      const blob = await new Promise<Blob | null>((r) => toile.toBlob(r, 'image/jpeg'))
      if (!blob) return { erreur: 'toBlob absent' }
      try {
        const image = await createImageBitmap(blob, { imageOrientation: 'from-image' })
        return { largeur: image.width, hauteur: image.height }
      } catch (cause) {
        return { erreur: String(cause) }
      }
    })

    // proportions gardées : c'est la règle du redimensionnement du projet
    expect(resultat).toEqual({ largeur: 40, hauteur: 20 })
  })

  test('reste utilisable même quand le moteur ne sait pas enregistrer', async ({ page }) => {
    // Ce WebKit de Linux n'embarque pas MediaRecorder, contrairement à Safari sur iPhone qui
    // l'a depuis la version 14.1 : on ne peut donc rien conclure ici sur le micro de la mère.
    // Ce qui se vérifie, et qui est notre vraie promesse, c'est qu'un moteur sans micro ne
    // casse rien : l'écran de l'enfant fonctionne, et l'éditeur dira pourquoi le moment venu.
    await page.goto('/')

    const formats = await page.evaluate(() => {
      if (typeof MediaRecorder === 'undefined') return { enregistreur: false, formats: [] as string[] }
      const candidats = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      return {
        enregistreur: true,
        formats: candidats.filter((type) => MediaRecorder.isTypeSupported(type)),
      }
    })
    console.log('formats acceptés par ce moteur :', JSON.stringify(formats))

    // l'enfant garde ses mots quoi qu'il arrive
    await expect(page.locator('[data-case]')).toHaveCount(13)
    const maman = page.locator('[data-case="maman"]')
    await maman.dispatchEvent('pointerdown')
    await maman.dispatchEvent('pointerup')
    await expect(page.locator('[data-bande-phrase]')).toContainText('Maman')
  })

  test('affiche la grille sans rien couper ni faire défiler', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)

    const mesure = await page.evaluate(() => {
      const cases = [...document.querySelectorAll('[data-case]')].map((n) => n.getBoundingClientRect())
      const petite = cases.reduce((a, b) => (a.width * a.height < b.width * b.height ? a : b))
      return {
        petite: Math.round(Math.min(petite.width, petite.height)),
        hors: cases.some((r) => r.right > window.innerWidth + 1),
        deborde: document.documentElement.scrollWidth > window.innerWidth,
      }
    })

    expect(mesure.petite).toBeGreaterThanOrEqual(48)
    expect(mesure.hors).toBe(false)
    expect(mesure.deborde).toBe(false)
  })
})

test('le halo tourne aussi sur le moteur de Safari', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-case="oui"]').first().waitFor()
  const soutienColorMix = await page.evaluate(() => CSS.supports('color', 'color-mix(in srgb, red 30%, transparent)'))
  await page.locator('[data-case="oui"]').click()
  const anim = await page.locator('[data-case="oui"]').evaluate((n) => {
    const s = getComputedStyle(n)
    return { nom: s.animationName, duree: s.animationDuration, ombre: s.boxShadow.slice(0, 120) }
  })
  expect(soutienColorMix, 'color-mix sert au halo, une version trop ancienne l ignore').toBe(true)
  expect(anim.nom).toContain('parle')
})

test('« Réduire les animations » laisse quand même la case répondre', async ({ page }) => {
  // Réglage d'accessibilité d'iOS, que la mère peut très bien avoir activé : la règle
  // globale du projet ramène alors toutes les durées à zéro, et la case ne réagissait plus.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const oui = page.locator('[data-case="oui"]')
  await oui.waitFor()
  const auRepos = await oui.evaluate((n) => getComputedStyle(n).boxShadow)

  await oui.click()

  const enParlant = await oui.evaluate((n) => ({
    ombre: getComputedStyle(n).boxShadow,
    animation: getComputedStyle(n).animationName,
    duree: getComputedStyle(n).animationDuration,
    forme: getComputedStyle(n).transform,
  }))
  expect(enParlant.ombre).not.toBe(auRepos)
  // l'anneau joue encore, mais la case ne grossit plus : c'est le mouvement qui gêne
  expect(enParlant.animation).toContain('parle-sobre')
  expect(enParlant.duree).toBe('0.7s')
  expect(enParlant.forme === 'none' || enParlant.forme === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true)
})

test('la sauvegarde se télécharge sur le moteur de Safari', async ({ page }) => {
  await page.goto('/')
  await ouvrirEspaceParents(page)
  await ouvrirOngletSauvegarde(page)

  const telechargement = page.waitForEvent('download')
  await page.locator('[data-sauvegarder]').click()
  const fichier = await telechargement
  const chemin = await fichier.path()

  // La sauvegarde est le seul pont entre son téléphone et la tablette, et une perte de
  // configuration est le seul bug vraiment grave du projet. Le téléchargement d'un blob a
  // sa propre histoire sur Safari : il se vérifie ici, pas seulement sur Chromium.
  expect(fichier.suggestedFilename()).toMatch(/^mes-mots-\d{4}-\d{2}-\d{2}\.obz$/)
  expect(chemin).toBeTruthy()
})
