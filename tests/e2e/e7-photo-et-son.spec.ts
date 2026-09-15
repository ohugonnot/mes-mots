import { test, expect, type Page } from '@playwright/test'
import { fermerEspaceParents, ouvrirEspaceParents } from './verrou'
import {
  ajouterPhotoPersonnalisee,
  ajouterSonPersonnalise,
  imagePersonnaliseeExiste,
  sonPersonnaliseExiste,
} from './mediaPersonnalise'

/** Le même pixel PNG que mediaPersonnalise.ts : suffisant pour un aller-retour réel dans
 *  createImageBitmap, sans dépendre d'un fichier externe au dépôt. */
const PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

/** Un second PNG, différent du premier : deux photos identiques ne prouveraient rien. */
const AUTRE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8DwHwAFAgIB1p5ZfwAAAABJRU5ErkJggg=='

function autreFichierPhotoTest() {
  return { name: 'autre.png', mimeType: 'image/png', buffer: Buffer.from(AUTRE_PIXEL_PNG_BASE64, 'base64') }
}

function fichierPhotoTest() {
  return { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(PIXEL_PNG_BASE64, 'base64') }
}

type Rectangle = { x: number; y: number; width: number; height: number }

async function rectangleDe(page: Page, selecteur: string): Promise<Rectangle> {
  const boite = await page.locator(selecteur).boundingBox()
  expect(boite, `${selecteur} absent de l'écran`).not.toBeNull()
  return boite!
}

test.describe('E7 : capture d une photo (P4)', () => {
  test('une photo choisie apparaît sur la case de l enfant, et la case n a pas bougé d un pixel', async ({
    page,
  }) => {
    // MOI n'a pas de pictogramme livré : la case montre le mot-repère avant la photo.
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
    const avant = await rectangleDe(page, '[data-case="moi"]')
    await expect(page.locator('[data-case="moi"] .mot-repere')).toBeVisible()

    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="moi"]').click()
    await page.setInputFiles('[data-champ-photo-galerie]', fichierPhotoTest())
    await expect(page.locator('[data-apercu-photo]')).toBeVisible()
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)

    await expect(page.locator('[data-case="moi"] img')).toBeVisible()
    const apres = await rectangleDe(page, '[data-case="moi"]')
    expect(Math.abs(apres.x - avant.x), 'a changé de colonne').toBeLessThan(1.5)
    expect(Math.abs(apres.y - avant.y), 'a changé de ligne').toBeLessThan(1.5)
    expect(Math.abs(apres.width - avant.width), 'a changé de largeur').toBeLessThan(1.5)
    expect(Math.abs(apres.height - avant.height), 'a changé de hauteur').toBeLessThan(1.5)
  })

  test('choisir le mot en grand efface la photo, sans rappeler le pictogramme livré', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await expect(page.locator('[data-case="chambre"] img')).toHaveAttribute(
      'src',
      '/images/pictos/chambre.svg',
    )

    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="chambre"]').click()
    await page.setInputFiles('[data-champ-photo-galerie]', fichierPhotoTest())
    await expect(page.locator('[data-apercu-photo]')).toBeVisible()
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)
    await expect(page.locator('[data-case="chambre"] img')).toHaveAttribute('src', /^blob:/)

    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="chambre"]').click()
    await page.locator('[data-image="aucune"]').check()
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)

    // le fichier livré avec l'application n'est pas un état par défaut où l'on reviendrait :
    // la case retombe sur son mot en grand, comme le panneau l'annonçait
    await expect(page.locator('[data-case="chambre"] img')).toHaveCount(0)
    await expect(page.locator('[data-case="chambre"]')).toContainText('CHAMBRE')
  })

  test('une photo qui n est pas une image lisible affiche un message et laisse l éditeur utilisable', async ({
    page,
  }) => {
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="chambre"]').click()

    await page.setInputFiles('[data-champ-photo-galerie]', {
      name: 'pas-une-photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('ceci n est pas une image'),
    })

    await expect(page.locator('[data-erreur-photo]')).toBeVisible()
    await expect(page.locator('[data-editeur-case]')).toBeVisible()
    await expect(page.locator('[data-apercu-photo]')).toHaveCount(0)
  })

  test('une case créée avec une photo la garde après un rechargement', async ({ page }) => {
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await page.locator('[data-selecteur-planche]').selectOption('exterieur')
    await page.locator('[data-ajouter-case]').first().click()
    await page.locator('[data-champ-label]').fill('BALLON')
    await page.locator('[data-champ-vocalization]').fill('Je veux mon ballon')
    await page.setInputFiles('[data-champ-photo-galerie]', fichierPhotoTest())
    await expect(page.locator('[data-apercu-photo]')).toBeVisible()
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)

    await page.locator('[data-contexte="exterieur"]').click()
    await expect(page.locator('[data-case="ballon"] img')).toBeVisible()

    await page.reload()

    await page.locator('[data-contexte="exterieur"]').click()
    await expect(page.locator('[data-case="ballon"] img')).toBeVisible()
  })
})

test.describe('E7 : enregistrement d un son (P8)', () => {
  test('la permission micro refusée affiche un message et laisse l éditeur utilisable', async ({ page }) => {
    // Aucune permission accordée : Chromium sans device réel refuse la demande.
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="chambre"]').click()

    await page.locator('[data-bouton-enregistrer-son]').click()

    await expect(page.locator('[data-erreur-son]')).toBeVisible()
    await expect(page.locator('[data-editeur-case]')).toBeVisible()
    // l'éditeur reste utilisable : les autres champs répondent toujours
    await page.locator('[data-champ-label]').fill('CHAMBRE')
    await page.locator('[data-enregistrer-case]').click()
    await expect(page.locator('[data-editeur-case]')).toHaveCount(0)
  })
})

test.describe('E7 : l annulation d une suppression garde la photo et le son (P4, P8)', () => {
  test('annuler restaure aussi le blob, pas seulement la référence', async ({ page }) => {
    // LE scénario que la mutation « effacer les blobs tout de suite » doit faire rougir :
    // si le blob disparaît avant l'annulation, CHAMBRE revient sans visage ni voix.
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await ajouterPhotoPersonnalisee(page, 'chambre')
    await ajouterSonPersonnalise(page, 'chambre')
    await page.reload()
    await expect(page.locator('[data-case="chambre"] img')).toBeVisible()

    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="chambre"]').click()
    await page.locator('[data-demander-suppression]').click()
    await page.locator('[data-confirmer-suppression]').click()
    await page.locator('[data-annuler-suppression]').click()
    await fermerEspaceParents(page)

    await expect(page.locator('[data-case="chambre"] img')).toBeVisible()
    expect(await imagePersonnaliseeExiste(page, 'chambre')).toBe(true)
    expect(await sonPersonnaliseExiste(page, 'chambre')).toBe(true)
  })

  test('fermer l espace parents sans annuler purge la photo et le son devenus orphelins', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await ajouterPhotoPersonnalisee(page, 'chambre')
    await ajouterSonPersonnalise(page, 'chambre')
    await page.reload()

    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="chambre"]').click()
    await page.locator('[data-demander-suppression]').click()
    await page.locator('[data-confirmer-suppression]').click()
    await fermerEspaceParents(page)

    await expect.poll(() => imagePersonnaliseeExiste(page, 'chambre')).toBe(false)
    await expect.poll(() => sonPersonnaliseExiste(page, 'chambre')).toBe(false)
  })
})

test.describe('E7 : le parent voit la photo, il ne la devine pas', () => {
  test('la photo de famille apparaît sur la carte des parents et dans l éditeur', async ({
    page,
  }) => {
    // L'espace parents est le miroir de l'écran de l'enfant : un parent qui ne voit pas la
    // photo qu'il a posée la reprend pour rien. Elle n'était annoncée que par un texte.
    await page.goto('/')
    await expect(page.locator('[data-case="maman"]')).toBeVisible()
    await ajouterPhotoPersonnalisee(page, 'maman')
    await page.reload()
    await expect(page.locator('[data-case="maman"]')).toBeVisible()

    await ouvrirEspaceParents(page)
    const carte = page.locator('[data-case-parent="maman"]')
    await expect(carte.locator('[data-vignette]')).toBeVisible()

    await page.locator('[data-modifier-case="maman"]').click()
    await expect(page.locator('[data-image-actuelle] [data-vignette]')).toBeVisible()
  })

  test('la photo posée apparaît sur la carte sans quitter l espace parents', async ({ page }) => {
    // MOI n'a pas de pictogramme livré : sa carte n'a aucune image avant la photo, donc
    // l'image qui apparaît ne peut venir que de ce qu'on vient de poser. Le blob s'écrivait
    // après la référence, la carte lisait un dépôt encore vide et restait sur le mot jusqu'au
    // rechargement suivant.
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)

    await ouvrirEspaceParents(page)
    await expect(page.locator('[data-case-parent="moi"] [data-vignette]')).toHaveCount(0)
    await page.locator('[data-modifier-case="moi"]').click()
    await page.setInputFiles('[data-champ-photo-galerie]', fichierPhotoTest())
    await expect(page.locator('[data-apercu-photo]')).toBeVisible()
    await page.locator('[data-enregistrer-case]').click()

    await expect(page.locator('[data-case-parent="moi"] [data-vignette]')).toBeVisible()
  })

  test('remplacer la photo d un mot montre la nouvelle, pas l ancienne', async ({ page }) => {
    // La référence reste `perso/moi` d'une photo à l'autre : rien ne change dans la
    // configuration, et la vignette gardait l'image lue la première fois.
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)

    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="moi"]').click()
    await page.setInputFiles('[data-champ-photo-galerie]', fichierPhotoTest())
    await page.locator('[data-enregistrer-case]').click()
    const vignette = page.locator('[data-case-parent="moi"] [data-vignette]')
    await expect(vignette).toBeVisible()
    const premiere = await vignette.getAttribute('src')

    await page.locator('[data-modifier-case="moi"]').click()
    await page.setInputFiles('[data-champ-photo-galerie]', autreFichierPhotoTest())
    await page.locator('[data-enregistrer-case]').click()

    await expect(vignette).not.toHaveAttribute('src', premiere!)
  })
})

test.describe('les blobs que plus aucun mot ne réclame', () => {
  test('un orphelin est balayé au démarrage suivant', async ({ page }) => {
    // Un effacement qui échoue, ou un onglet fermé avant la fin d'une session parents,
    // laissait un blob pour toujours : plus rien ne repassait derrière.
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await page.evaluate(async () => {
      const base = await new Promise<IDBDatabase>((resoudre) => {
        const requete = indexedDB.open('mes-mots')
        requete.onsuccess = () => resoudre(requete.result)
      })
      await new Promise<void>((resoudre) => {
        const transaction = base.transaction('images', 'readwrite')
        transaction.objectStore('images').put(new Blob(['fantôme']), 'fantome')
        transaction.oncomplete = () => resoudre()
      })
    })
    expect(await imagePersonnaliseeExiste(page, 'fantome')).toBe(true)

    await page.reload()
    await expect(page.locator('[data-case]')).toHaveCount(13)

    await expect.poll(() => imagePersonnaliseeExiste(page, 'fantome')).toBe(false)
  })
})

test.describe('effacer toute la configuration (P10)', () => {
  test('la tablette repart de son état d origine, photos comprises', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)

    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="moi"]').click()
    await page.setInputFiles('[data-champ-photo-galerie]', fichierPhotoTest())
    await page.locator('[data-enregistrer-case]').click()
    await expect(page.locator('[data-case-parent="moi"] [data-vignette]')).toBeVisible()
    expect(await imagePersonnaliseeExiste(page, 'moi')).toBe(true)
    // et un mot révélé, pour vérifier que les réglages partent aussi
    await page.locator('[data-case-parent="pipi"]').click()

    await page.locator('[data-onglet="sauvegarde"]').click()
    await page.locator('[data-demander-effacement]').click()
    await page.locator('[data-confirmer-effacement]').click()

    // l'espace parents reste ouvert, la sauvegarde étant à portée juste en dessous
    await expect(page.locator('[data-espace-parents]')).toBeVisible()
    await page.locator('[data-onglet="mots"]').click()
    await expect(page.locator('[data-case-parent="pipi"]')).toContainText('masqué')
    await expect.poll(() => imagePersonnaliseeExiste(page, 'moi')).toBe(false)
    await page.locator('[data-fermer-parents]').click()
    await expect(page.locator('[data-case]')).toHaveCount(13)
    // et après un redémarrage, rien ne revient
    await page.reload()
    await expect(page.locator('[data-case]')).toHaveCount(13)
  })
})

test.describe('poser un fichier son fait ailleurs (A8)', () => {
  test('le son importé est gardé et remplace la voix livrée', async ({ page }) => {
    // le pÃ¨re corrige la sauvegarde de la mère depuis son ordinateur : pas de micro devant
    // la bouche de quelqu'un, mais un fichier de synthèse sous la main.
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)

    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="moi"]').click()
    await page.setInputFiles('[data-champ-son-fichier]', {
      name: 'voix.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0]),
    })
    await expect(page.locator('[data-lecture-son]')).toBeVisible()
    await page.locator('[data-enregistrer-case]').click()

    await expect.poll(() => sonPersonnaliseExiste(page, 'moi')).toBe(true)
    await page.locator('[data-modifier-case="moi"]').click()
    // le panneau dit laquelle des trois voix parle, sans qu'on ait à toucher quoi que ce soit
    await expect(page.locator('[data-voix="enregistree"]')).toBeChecked()
    // et on peut réécouter ce qu'on vient de poser, sans quitter l'éditeur
    await expect(page.locator('[data-lecture-son-actuel]')).toHaveAttribute('src', /^blob:/)
  })
})

test.describe('la voix de la tablette quand aucun son ne parle', () => {
  /** Chromium n'a aucune voix installée : on écoute ce qu'on lui demande de dire. */
  async function espionnerLaSynthese(page: Page): Promise<void> {
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
  }

  const dits = (page: Page) => page.evaluate(() => (window as unknown as { dits: string[] }).dits)

  test('la mère écrit sa phrase, choisit la voix de la tablette, et la case la dit', async ({ page }) => {
    // le retour de la mère du 9 septembre : elle a écrit « C'est moi l'enfant » et la
    // tablette a continué de dire « Moi », faute d'un moyen de renoncer au MP3 livré
    await espionnerLaSynthese(page)
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)

    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="moi"]').click()
    await page.locator('[data-champ-vocalization]').fill("C'est moi l'enfant")
    await page.locator('[data-voix="texte"]').check()
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)

    await page.locator('[data-case="moi"]').click()

    await expect.poll(() => dits(page)).toEqual(["C'est moi l'enfant"])
  })

  test('un mot dont le MP3 livré parle encore ne passe pas par la tablette', async ({ page }) => {
    await espionnerLaSynthese(page)
    await page.goto('/')

    await page.locator('[data-case="maman"]').click()

    await expect(page.locator('[data-bande-phrase]')).toContainText('Maman')
    expect(await dits(page)).toEqual([])
  })
})

test.describe('les images occupent toute leur case', () => {
  test('une photo de la famille remplit le cadre, quitte a perdre ses bords', async ({ page }) => {
    // Une photo arrive au format de l'appareil : gardée entière, elle laissait deux bandes
    // blanches dans la case. Le sujet d'une photo de famille est au milieu, pas au bord.
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)

    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="moi"]').click()
    await page.setInputFiles('[data-champ-photo-galerie]', fichierPhotoTest())
    await expect(page.locator('[data-apercu-photo]')).toBeVisible()
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)

    await expect(page.locator('[data-case="moi"] img')).toHaveCSS('object-fit', 'cover')

    // et son emplacement occupe tout ce que l'étiquette laisse
    const part = await page.locator('[data-case="moi"]').evaluate((n) => {
      const illustration = n.querySelector('.illustration')!.getBoundingClientRect()
      return illustration.height / n.clientHeight
    })
    expect(Math.abs(part - 0.78)).toBeLessThan(0.01)
  })

  test('un pictogramme livre reste entier', async ({ page }) => {
    // Un dessin ARASAAC porte sa marge dans son trait : rogné, il perd un bout du dessin
    // et non du blanc. Il se lit en entier, c'est tout son propos.
    await page.goto('/')
    await expect(page.locator('[data-case="maman"] img')).toHaveCSS('object-fit', 'contain')
  })
})
