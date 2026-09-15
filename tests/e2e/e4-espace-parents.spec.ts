import { test, expect, type Page } from '@playwright/test'
import { rapportDeContraste } from '../../src/domaine/contraste'
import { versHexadecimal } from './couleurs'
import { fermerEspaceParents, ouvrirEspaceParents, ouvrirOngletReglages, ouvrirOngletSauvegarde, presserLeCoin, reglagesPersistes, repondreALaQuestion } from './verrou'

/** Les 13 cases révélées du contexte Maison, dans l'ordre de lecture de `grid.order`. */
const IDS_MAISON = [
  'maman', 'papa', 'moi', 'doudou', 'boire', 'manger', 'douche', 'chambre',
  'voiture', 'tablette', 'promenade', 'oui', 'non',
]



/**
 * Lit `hidden` directement dans IndexedDB, en IDB brut comme e2-persistance.spec.ts :
 * la seule façon de prouver que la bascule a bien été écrite, et non seulement affichée.
 */
async function hiddenPersiste(page: Page, idCase: string): Promise<boolean | undefined> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase | null>((ok) => {
      const requete = indexedDB.open('mes-mots')
      requete.onsuccess = () => ok(requete.result)
      requete.onerror = () => ok(null)
    })
    if (!db || !db.objectStoreNames.contains('config')) return undefined
    type ConfigurationStockee = {
      contextes: { pages: { buttons: { id: string; hidden?: boolean }[] }[] }[]
    }
    const config = await new Promise<ConfigurationStockee | undefined>((ok) => {
      const lecture = db.transaction('config').objectStore('config').get('configuration')
      lecture.onsuccess = () => ok(lecture.result)
      lecture.onerror = () => ok(undefined)
    })
    return config?.contextes
      .flatMap((c) => c.pages)
      .flatMap((p) => p.buttons)
      .find((c) => c.id === id)?.hidden
  }, idCase)
}

/**
 * Lit une case dans IndexedDB, contextes et barre confondus : sert à prouver qu'un ajout
 * ou une modification est bien écrit, et non seulement affiché (P3, P7).
 */
async function casePersistee(
  page: Page,
  idCase: string,
): Promise<{ label: string } | undefined> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase | null>((ok) => {
      const requete = indexedDB.open('mes-mots')
      requete.onsuccess = () => ok(requete.result)
      requete.onerror = () => ok(null)
    })
    if (!db || !db.objectStoreNames.contains('config')) return undefined
    type ConfigurationStockee = {
      contextes: { pages: { buttons: { id: string; label: string }[] }[] }[]
      barre: { buttons: { id: string; label: string }[] }
    }
    const config = await new Promise<ConfigurationStockee | undefined>((ok) => {
      const lecture = db.transaction('config').objectStore('config').get('configuration')
      lecture.onsuccess = () => ok(lecture.result)
      lecture.onerror = () => ok(undefined)
    })
    const toutes = [
      ...(config?.contextes.flatMap((c) => c.pages).flatMap((p) => p.buttons) ?? []),
      ...(config?.barre.buttons ?? []),
    ]
    return toutes.find((c) => c.id === id)
  }, idCase)
}

test.describe('E4 : espace parents', () => {
  test.beforeEach(async ({ page }) => {
    // Chaque test Playwright reçoit son propre contexte, donc son propre IndexedDB :
    // un test qui révèle PIPI ne fait jamais démarrer le suivant avec 14 cases.
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
  })

  test('un appui court sur le coin ne fait rien', async ({ page }) => {
    await presserLeCoin(page, 200)
    await page.mouse.up()
    await page.waitForTimeout(500)

    await expect(page.locator('[data-question-parents]')).toHaveCount(0)
    await expect(page.locator('[data-case]')).toHaveCount(13)
  })

  test('une mauvaise réponse referme la question et revient à l écran enfant', async ({
    page,
  }) => {
    await presserLeCoin(page, 3100)
    await expect(page.locator('[data-question-parents]')).toBeVisible()
    await page.mouse.up()

    // une mauvaise réponse quelconque : l'addition et l'ordre des boutons sont tirés au
    // hasard à chaque ouverture, viser une valeur en dur testerait l'ancienne version
    const enonce = (await page.locator('[data-enonce]').textContent())!
    const [gauche, droite] = enonce.match(/\d+/g)!.map(Number)
    const valeurs = await page.locator('[data-reponse]').allTextContents()
    const fausse = valeurs.map(Number).find((v) => v !== gauche! + droite!)!
    await page.locator(`[data-reponse="${fausse}"]`).click()

    await expect(page.locator('[data-question-parents]')).toHaveCount(0)
    await expect(page.locator('[data-espace-parents]')).toHaveCount(0)
    await expect(page.locator('[data-case]')).toHaveCount(13)
  })

  test('une bonne réponse ouvre l espace parents', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await expect(page.locator('h1')).toHaveText('Espace parents')
  })

  test('un appui normal sur une case continue de faire parler l enfant', async ({ page }) => {
    // aucune régression pour l'enfant : le geste protégé du parent ne doit rien changer ici
    await page.locator('[data-case="boire"]').click()
    await expect(page.locator('[data-bande-phrase]')).toHaveText('Boire')
  })

  test('le verdict du stockage persistant est visible dans l espace parents', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await ouvrirOngletSauvegarde(page)
    await expect(page.locator('[data-verdict-stockage]')).not.toBeEmpty()

    // La pastille « masqué » des cartes est posée hors du flux ; son sélecteur, nu,
    // attrapait aussi cette ligne, qui partait se coller tout en haut de la fenêtre,
    // par-dessus le titre. Le test mesure la place, la classe ne prouverait rien.
    const inventaire = (await page.locator('[data-etat-tablette]').boundingBox())!
    const entete = (await page.locator('[data-fermer-parents]').boundingBox())!
    expect(inventaire.y, "l'inventaire est passé au-dessus de l'en-tête").toBeGreaterThan(
      entete.y + entete.height,
    )
  })

  test('une carte garde la même taille quel que soit le nombre de rangées', async ({ page }) => {
    // La barre des mots essentiels n'a qu'une rangée : la grille l'étirait sur toute la
    // hauteur libre et donnait trois cartes hautes de tout l'écran.
    await ouvrirEspaceParents(page)
    const hauteurDe = async (id: string) =>
      (await page.locator(`[data-case-parent="${id}"]`).boundingBox())!.height

    const surQuatreRangees = await hauteurDe('maman')
    await page.locator('[data-selecteur-planche]').selectOption('barre')
    const surUneRangee = await hauteurDe('aide')

    expect(surUneRangee, 'carte étirée sur la hauteur libre').toBeLessThan(200)
    expect(
      Math.abs(surUneRangee - surQuatreRangees),
      'la taille d une carte dépend du nombre de rangées',
    ).toBeLessThan(2)
  })

  test('une case masquée reste lisible, c est là qu on vient la chercher', async ({ page }) => {
    // Un premier jet atténuait la case masquée à 45 % d'opacité : le mot tombait à 2,61:1,
    // sous les 4,5:1 de WCAG, sur l'écran même où le parent doit lire ce qui est caché.
    await ouvrirEspaceParents(page)
    const couleurs = await page.locator('[data-case-parent="pipi"]').evaluate((noeud) => {
      const style = getComputedStyle(noeud)
      return { texte: style.color, fond: style.backgroundColor, opacite: style.opacity }
    })

    expect(Number.parseFloat(couleurs.opacite), 'une opacité fausse la mesure').toBe(1)
    expect(
      rapportDeContraste(versHexadecimal(couleurs.texte), versHexadecimal(couleurs.fond)),
      'mot de la case masquée',
    ).toBeGreaterThanOrEqual(4.5)
  })

  test('révéler PIPI ne déplace aucune des 13 cases et occupe son emplacement réservé', async ({
    page,
  }) => {
    // LE test critique du projet : une case ne change jamais de position, même quand une
    // autre case, ailleurs sur la même planche, passe de masquée à révélée.
    const rectangleDe = async (selecteur: string) => {
      const boite = await page.locator(selecteur).boundingBox()
      expect(boite, `${selecteur} absent de l'écran`).not.toBeNull()
      return boite!
    }

    const rectanglesAvant = new Map<string, { x: number; y: number; width: number; height: number }>()
    for (const id of IDS_MAISON) rectanglesAvant.set(id, await rectangleDe(`[data-case="${id}"]`))

    // PIPI est masquée : son emplacement réservé est le dernier trou de la grille
    // (grid.order[3][3] dans plancheDemo.ts), rendu comme un `.emplacement-libre`.
    const emplacementReserve = await rectangleDe('[data-grille="contexte"] > *:last-child')

    await ouvrirEspaceParents(page)
    const pipi = page.locator('[data-case-parent="pipi"]')
    await expect(pipi, 'PIPI absente du sélecteur de la planche Maison').toBeVisible()
    await expect(pipi, 'PIPI devrait être proposée comme masquée').toHaveText(/masqué/)
    await pipi.click()
    await expect(pipi, 'PIPI devrait passer à affichée après le clic').toHaveAttribute(
      'data-etat',
      'affiché',
    )
    await fermerEspaceParents(page)

    await expect(page.locator('[data-case]')).toHaveCount(14)
    for (const id of IDS_MAISON) {
      const apres = await rectangleDe(`[data-case="${id}"]`)
      const avant = rectanglesAvant.get(id)!
      expect(Math.abs(apres.x - avant.x), `${id} a changé de colonne`).toBeLessThan(1.5)
      expect(Math.abs(apres.y - avant.y), `${id} a changé de ligne`).toBeLessThan(1.5)
      expect(Math.abs(apres.width - avant.width), `${id} a changé de largeur`).toBeLessThan(1.5)
      expect(Math.abs(apres.height - avant.height), `${id} a changé de hauteur`).toBeLessThan(1.5)
    }

    const rectPipi = await rectangleDe('[data-case="pipi"]')
    expect(Math.abs(rectPipi.x - emplacementReserve.x), 'PIPI hors de sa colonne réservée').toBeLessThan(1.5)
    expect(Math.abs(rectPipi.y - emplacementReserve.y), 'PIPI hors de sa ligne réservée').toBeLessThan(1.5)
    expect(Math.abs(rectPipi.width - emplacementReserve.width), 'PIPI a une largeur différente de son emplacement réservé').toBeLessThan(1.5)
    expect(Math.abs(rectPipi.height - emplacementReserve.height), 'PIPI a une hauteur différente de son emplacement réservé').toBeLessThan(1.5)
  })

  test('la révélation de PIPI survit à un rechargement', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await page.locator('[data-case-parent="pipi"]').click()
    await fermerEspaceParents(page)
    await expect(page.locator('[data-case]')).toHaveCount(14)

    // l'écriture dans IndexedDB est asynchrone : attendre qu'elle soit vraiment posée
    // avant de recharger, sinon le test rejoue une course qui n'a rien à voir avec le bug
    await expect.poll(() => hiddenPersiste(page, 'pipi')).toBe(false)

    await page.reload()

    await expect(page.locator('[data-case]')).toHaveCount(14)
    await expect(page.locator('[data-case="pipi"]')).toHaveCount(1)
  })

  test('ajouter puis supprimer un mot dans Extérieur ne déplace aucune des 13 cases de Maison', async ({
    page,
  }) => {
    // Maison n'a plus un seul emplacement libre (16 cases pour 16 emplacements) : le test
    // du vrai enjeu de P3 se joue donc dans Extérieur, qui en a, tout en vérifiant que
    // Maison n'en sait rien. Extérieur partage exactement la géométrie de Maison (BIBLE
    // §5), donc son [0][2] doit tomber pile sur le rectangle de MOI, Maison [0][2].
    const rectangleDe = async (selecteur: string) => {
      const boite = await page.locator(selecteur).boundingBox()
      expect(boite, `${selecteur} absent de l'écran`).not.toBeNull()
      return boite!
    }

    const rectanglesAvant = new Map<string, { x: number; y: number; width: number; height: number }>()
    for (const id of IDS_MAISON) rectanglesAvant.set(id, await rectangleDe(`[data-case="${id}"]`))
    const rectAncrage = await rectangleDe('[data-case="moi"]')

    await ouvrirEspaceParents(page)
    await page.locator('[data-selecteur-planche]').selectOption('exterieur')
    // Extérieur : ['magasin', 'frere', null, null] en première ligne, le premier « + »
    // vise donc exactement grid.order[0][2].
    await page.locator('[data-ajouter-case]').first().click()
    await page.locator('[data-champ-label]').fill('BALLON')
    await page.locator('[data-champ-vocalization]').fill('Je veux mon ballon')
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)

    for (const id of IDS_MAISON) {
      const apres = await rectangleDe(`[data-case="${id}"]`)
      const avant = rectanglesAvant.get(id)!
      expect(Math.abs(apres.x - avant.x), `${id} a changé de colonne après l'ajout`).toBeLessThan(1.5)
      expect(Math.abs(apres.y - avant.y), `${id} a changé de ligne après l'ajout`).toBeLessThan(1.5)
    }

    await page.locator('[data-contexte="exterieur"]').click()
    const rectBallon = await rectangleDe('[data-case="ballon"]')
    expect(Math.abs(rectBallon.x - rectAncrage.x), 'BALLON hors de l emplacement choisi').toBeLessThan(1.5)
    expect(Math.abs(rectBallon.y - rectAncrage.y), 'BALLON hors de l emplacement choisi').toBeLessThan(1.5)
    expect(Math.abs(rectBallon.width - rectAncrage.width), 'BALLON a une largeur différente').toBeLessThan(1.5)
    expect(Math.abs(rectBallon.height - rectAncrage.height), 'BALLON a une hauteur différente').toBeLessThan(1.5)

    await page.locator('[data-contexte="maison"]').click()
    await ouvrirEspaceParents(page)
    await page.locator('[data-selecteur-planche]').selectOption('exterieur')
    await page.locator('[data-modifier-case="ballon"]').click()
    await page.locator('[data-demander-suppression]').click()
    await page.locator('[data-confirmer-suppression]').click()
    await fermerEspaceParents(page)

    // Extérieur redevient entièrement masqué : son bouton de contexte redisparaît (T5)
    await expect(page.locator('[data-contexte="exterieur"]')).toHaveCount(0)
    for (const id of IDS_MAISON) {
      const apres = await rectangleDe(`[data-case="${id}"]`)
      const avant = rectanglesAvant.get(id)!
      expect(Math.abs(apres.x - avant.x), `${id} a changé de colonne après la suppression`).toBeLessThan(1.5)
      expect(Math.abs(apres.y - avant.y), `${id} a changé de ligne après la suppression`).toBeLessThan(1.5)
    }
  })

  test('modifier le mot et la phrase d une case existante se voit sur l écran de l enfant', async ({
    page,
  }) => {
    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="promenade"]').click()
    await page.locator('[data-champ-label]').fill('BALADE')
    await page.locator('[data-champ-vocalization]').fill('Je veux faire une balade')
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)

    await expect(page.locator('[data-case="promenade"]')).toContainText('BALADE')
    await page.locator('[data-case="promenade"]').click()
    await expect(page.locator('[data-bande-phrase]')).toHaveText('Je veux faire une balade')
  })

  test('une suppression annulée survit au rechargement, pas seulement à l écran', async ({
    page,
  }) => {
    // Le pire défaut trouvé par le radar, reproduit deux fois sur deux : l'écran montrait
    // la case revenue, la console crachait un DataCloneError, et au rechargement suivant
    // le mot avait disparu pour de bon. Le parent croyait avoir rattrapé son erreur.
    const erreurs: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') erreurs.push(message.text())
    })

    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="chambre"]').click()
    await page.locator('[data-demander-suppression]').click()
    await page.locator('[data-confirmer-suppression]').click()
    await page.locator('[data-annuler-suppression]').click()
    await fermerEspaceParents(page)
    await expect(page.locator('[data-case="chambre"]')).toHaveCount(1)

    // le seul juge qui compte : ce qui est réellement écrit en base
    await expect.poll(() => casePersistee(page, 'chambre')).toBeDefined()
    await page.reload()

    await expect(page.locator('[data-case="chambre"]')).toHaveCount(1)
    await expect(page.locator('[data-case]')).toHaveCount(13)
    expect(erreurs, "l'écriture ne doit produire aucune erreur silencieuse").toEqual([])
  })

  test('l annulation d une suppression remet la case exactement à sa place', async ({ page }) => {
    const rectAvant = (await page.locator('[data-case="chambre"]').boundingBox())!

    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="chambre"]').click()
    await page.locator('[data-demander-suppression]').click()
    await page.locator('[data-confirmer-suppression]').click()
    await expect(page.locator('[data-bandeau-suppression]')).toContainText('CHAMBRE a été supprimé')

    await page.locator('[data-annuler-suppression]').click()
    await expect(page.locator('[data-bandeau-suppression]')).toHaveCount(0)
    await fermerEspaceParents(page)

    const rectApres = (await page.locator('[data-case="chambre"]').boundingBox())!
    expect(Math.abs(rectApres.x - rectAvant.x)).toBeLessThan(1.5)
    expect(Math.abs(rectApres.y - rectAvant.y)).toBeLessThan(1.5)
    await expect(page.locator('[data-case]')).toHaveCount(13)
  })

  test('la validation bloque un mot vide, avec un message à côté du champ', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="promenade"]').click()
    await page.locator('[data-champ-label]').fill('')
    await page.locator('[data-enregistrer-case]').click()

    await expect(page.locator('[data-erreur-label]')).toContainText('obligatoire')
    // toujours ouvert : l'enregistrement a été bloqué, pas seulement le message affiché
    await expect(page.locator('[data-editeur-case]')).toBeVisible()

    // le mot a été vidé : fermer demande confirmation avant de perdre la saisie
    await page.locator('[data-fermer-editeur]').click()
    await page.locator('[data-confirmer-fermeture]').click()
    await fermerEspaceParents(page)
    await expect(page.locator('[data-case="promenade"]')).toContainText('PROMENADE')
  })

  test('un ajout et une modification survivent à un rechargement', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await page.locator('[data-selecteur-planche]').selectOption('exterieur')
    await page.locator('[data-ajouter-case]').first().click()
    await page.locator('[data-champ-label]').fill('BALLON')
    await page.locator('[data-champ-vocalization]').fill('Je veux mon ballon')
    await page.locator('[data-enregistrer-case]').click()

    await page.locator('[data-selecteur-planche]').selectOption('maison')
    await page.locator('[data-modifier-case="doudou"]').click()
    await page.locator('[data-champ-label]').fill('NOUNOURS')
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)

    await expect.poll(() => casePersistee(page, 'ballon')).toMatchObject({ label: 'BALLON' })
    await expect.poll(() => casePersistee(page, 'doudou')).toMatchObject({ label: 'NOUNOURS' })

    await page.reload()

    await expect(page.locator('[data-case="doudou"]')).toContainText('NOUNOURS')
    await page.locator('[data-contexte="exterieur"]').click()
    await expect(page.locator('[data-case="ballon"]')).toHaveCount(1)
  })

  test('le sélecteur ne liste que les contextes, jamais une page', async ({ page }) => {
    await ouvrirEspaceParents(page)
    // Maison gagne une deuxième page : si le sélecteur listait les pages une par une, il
    // gagnerait une entrée avec elle. Il ne doit toujours en avoir qu'une pour Maison.
    await page.locator('[data-page-suivante]').click()
    await page.locator('[data-ajouter-case]').first().click()
    await page.locator('[data-champ-label]').fill('BALLON')
    await page.locator('[data-champ-vocalization]').fill('Je veux mon ballon')
    await page.locator('[data-enregistrer-case]').click()

    const libelles = await page.locator('[data-selecteur-planche] option').allTextContents()
    expect(libelles).toEqual(['Maison', 'Extérieur', "J'ai mal", 'Mots essentiels'])
    for (const libelle of libelles) {
      expect(libelle.toLowerCase(), `${libelle} contient « page »`).not.toContain('page')
    }
  })

  test('un contrôle de page apparaît dès qu il y a plus d une page à montrer, et mène à la page d accueil vide', async ({
    page,
  }) => {
    await ouvrirEspaceParents(page)
    // Maison n'a qu'une page réelle, mais la page d'accueil vide compte comme une
    // deuxième : le contrôle apparaît dès l'ouverture.
    await expect(page.locator('[data-page-suivante]')).toBeVisible()
    await expect(page.locator('[data-rang-page]')).toHaveText('Page 1 sur 2')

    await page.locator('[data-page-suivante]').click()
    await expect(page.locator('[data-rang-page]')).toHaveText('Page 2 sur 2')

    // page d'accueil vide : géométrie de la première page de Maison, seize boutons « + »
    await expect(page.locator('[data-grille-parents] [data-ajouter-case]')).toHaveCount(16)
    await expect(page.locator('[data-grille-parents] [data-case-parent]')).toHaveCount(0)
  })

  test('« Ajouter un mot » amène sur une page qui a de la place, puis pose le mot où on touche', async ({
    page,
  }) => {
    // Le bouton manquait : le seul chemin vers un mot neuf était le « + » d'une case vide,
    // et la première page de Maison est pleine, donc il n'y en avait aucun sous les yeux.
    await ouvrirEspaceParents(page)
    await expect(page.locator('[data-rang-page]')).toHaveText('Page 1 sur 2')

    await page.locator('[data-ajouter-mot]').click()

    await expect(page.locator('[data-rang-page]')).toHaveText('Page 2 sur 2')
    await expect(page.locator('[data-invitation-ajout]')).toContainText('Voici la page 2')
    // l'éditeur ne s'ouvre pas tout seul : c'est le parent qui choisit la place
    await expect(page.locator('[data-editeur-case]')).toHaveCount(0)

    await page.locator('[data-ajouter-case]').first().click()
    await expect(page.locator('[data-bandeau-ajout]')).toHaveCount(0)
    await page.locator('[data-champ-label]').fill('BALLON')
    await page.locator('[data-champ-vocalization]').fill('Je veux mon ballon')
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)

    await page.locator('[data-page-suivante]').click()
    await expect(page.locator('[data-case="ballon"]')).toBeVisible()
  })

  test('pendant un deplacement toutes les cellules ont la meme hauteur', async ({ page }) => {
    // Les deux boutons sous chaque carte sont voilés pendant un déplacement. Tant qu'ils
    // gardaient leur place, la carte montrait une bande vide de 48 px et une case faisait
    // 102 px là où l'emplacement libre d'à côté en faisait 150. Or les deux sont des cibles :
    // on pose sur une place vide, et on échange avec un mot déjà posé.
    await ouvrirEspaceParents(page)
    // une colonne de plus, pour avoir des places libres et des mots sur la même page
    await ouvrirOngletReglages(page)
    await page.locator('[data-forme-plus="colonnes"]').click()
    await page.locator('[data-forme-changer]').click()
    await page.locator('[data-onglet="mots"]').click()

    await page.locator('[data-deplacer-case]').first().click()
    await expect(page.locator('[data-bandeau-deplacement]')).toBeVisible()

    const hauteurs = await page.evaluate(() =>
      [...document.querySelectorAll('.case-parent, .emplacement-libre')].map((n) =>
        Math.round(n.getBoundingClientRect().height),
      ),
    )
    expect(hauteurs.length).toBeGreaterThan(16)
    expect(new Set(hauteurs), 'les cellules n ont pas toutes la même hauteur').toEqual(
      new Set([hauteurs[0]]),
    )
  })

  test('la barre d onglets reste atteignable au bas des reglages', async ({ page }) => {
    // Sur le téléphone de la mère, les réglages font 1 378 px pour une fenêtre de 844 : arrivée
    // en bas, elle n'avait plus ni les onglets ni « Terminé », et devait remonter à l'aveugle.
    await page.setViewportSize({ width: 390, height: 844 })
    await ouvrirEspaceParents(page)
    await ouvrirOngletReglages(page)
    await page.locator('[data-espace-parents]').evaluate((n) => n.scrollTo(0, n.scrollHeight))

    for (const nom of ['mots', 'sauvegarde', 'reglages']) {
      const atteint = await page.evaluate((cible) => {
        const boite = document.querySelector(`[data-onglet="${cible}"]`)!.getBoundingClientRect()
        if (boite.bottom > window.innerHeight) return 'hors de l écran'
        const sous = document.elementFromPoint(boite.x + boite.width / 2, boite.y + boite.height / 2)
        return sous?.closest('[data-onglet]')?.getAttribute('data-onglet') ?? 'rien'
      }, nom)
      expect(atteint, `l'onglet ${nom} n'est pas touchable en bas des réglages`).toBe(nom)
    }
  })

  test('le bandeau d un mode ne recouvre ni le titre ni la barre d onglets', async ({ page }) => {
    // Flottant en haut de la fenêtre, il se posait par-dessus les trois onglets : un doigt
    // qui visait « Réglages » tombait sur le « Annuler » du bandeau, et rien ne disait
    // pourquoi l'onglet ne répondait pas.
    for (const largeur of [800, 390]) {
      await page.setViewportSize({ width: largeur, height: 1280 })
      await ouvrirEspaceParents(page)
      await page.locator('[data-ajouter-mot]').click()

      const bandeau = (await page.locator('[data-bandeau-ajout]').boundingBox())!
      const onglets = (await page.locator('[data-onglets-parents]').boundingBox())!
      expect(bandeau.y, `le bandeau chevauche les onglets à ${largeur} px`).toBeGreaterThanOrEqual(
        onglets.y + onglets.height,
      )

      const sousLOnglet = await page.evaluate(() => {
        const b = document.querySelector('[data-onglet="reglages"]')!.getBoundingClientRect()
        const sous = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
        return sous?.closest('[data-onglet]')?.getAttribute('data-onglet') ?? null
      })
      expect(sousLOnglet, `l'appui sur « Réglages » est intercepté à ${largeur} px`).toBe('reglages')

      await fermerEspaceParents(page)
    }
  })

  test('poser un mot sur la page d accueil vide la crée sans déplacer les treize cases de la page 1', async ({
    page,
  }) => {
    // LE test qui compte : la promesse du projet, appliquée à la création d'une page.
    const rectangleDe = async (selecteur: string) => {
      const boite = await page.locator(selecteur).boundingBox()
      expect(boite, `${selecteur} absent de l'écran`).not.toBeNull()
      return boite!
    }
    const rectanglesAvant = new Map<string, { x: number; y: number; width: number; height: number }>()
    for (const id of IDS_MAISON) rectanglesAvant.set(id, await rectangleDe(`[data-case="${id}"]`))

    await ouvrirEspaceParents(page)
    await page.locator('[data-page-suivante]').click()
    await page.locator('[data-ajouter-case]').first().click()
    await page.locator('[data-champ-label]').fill('BALLON')
    await page.locator('[data-champ-vocalization]').fill('Je veux mon ballon')
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)

    // de retour sur l'écran de l'enfant : le contrôle de page est apparu, le mot est là
    await expect(page.locator('[data-page-suivante]')).toBeVisible()
    await page.locator('[data-page-suivante]').click()
    await expect(page.locator('[data-case="ballon"]')).toBeVisible()
    await page.locator('[data-page-precedente]').click()
    // la page glisse à l'écran (T8) : attendre le repos avant de mesurer, sinon on
    // capture les rectangles en pleine translation
    await expect(page.locator('[data-zone-grille="repos"]')).toBeVisible()

    for (const id of IDS_MAISON) {
      const apres = await rectangleDe(`[data-case="${id}"]`)
      const avant = rectanglesAvant.get(id)!
      expect(Math.abs(apres.x - avant.x), `${id} a changé de colonne`).toBeLessThan(1.5)
      expect(Math.abs(apres.y - avant.y), `${id} a changé de ligne`).toBeLessThan(1.5)
      expect(Math.abs(apres.width - avant.width), `${id} a changé de largeur`).toBeLessThan(1.5)
      expect(Math.abs(apres.height - avant.height), `${id} a changé de hauteur`).toBeLessThan(1.5)
    }
  })

  test('le repère « pas encore visible » s affiche sur une page sans case révélée et disparaît quand un mot y est révélé', async ({
    page,
  }) => {
    await ouvrirEspaceParents(page)
    await page.locator('[data-selecteur-planche]').selectOption('exterieur')
    // Extérieur : magasin et frère sont tous deux masqués, aucune case n'y est révélée
    await expect(page.locator('[data-repere-invisible]')).toBeVisible()

    await page.locator('[data-case-parent="magasin"]').click()

    await expect(page.locator('[data-repere-invisible]')).toHaveCount(0)
  })

  test('la barre des mots essentiels n affiche aucun contrôle de page', async ({ page }) => {
    await ouvrirEspaceParents(page)
    await page.locator('[data-selecteur-planche]').selectOption('barre')

    await expect(page.locator('[data-pagination] button')).toHaveCount(0)
    await expect(page.locator('[data-pastille]')).toHaveCount(0)
  })

  test('on ne peut pas enchaîner deux pages vides : la flèche suivante disparaît depuis une page réelle sans case', async ({
    page,
  }) => {
    await ouvrirEspaceParents(page)
    await page.locator('[data-page-suivante]').click()
    await page.locator('[data-ajouter-case]').first().click()
    await page.locator('[data-champ-label]').fill('BALLON')
    await page.locator('[data-champ-vocalization]').fill('Je veux mon ballon')
    await page.locator('[data-enregistrer-case]').click()

    // BALLON supprimé : la page 2 existe toujours mais ne porte plus aucune case révélée
    await page.locator('[data-modifier-case="ballon"]').click()
    await page.locator('[data-demander-suppression]').click()
    await page.locator('[data-confirmer-suppression]').click()

    await expect(page.locator('[data-page-suivante]')).toBeHidden()
    // la page 2 existe toujours, on y est resté, et c'est le rang écrit qui le dit depuis que
    // la grille des parents a son propre contrôle : les pastilles sont le repère de l'enfant,
    // qui ne lit pas
    await expect(page.locator('[data-rang-page]')).toHaveText('Page 2 sur 2')
    await expect(page.locator('[data-repere-invisible]')).toBeVisible()
  })
})

test.describe('la grille des parents occupe la largeur disponible', () => {
  // hauteur serrée : c'est là que la grille cherche à déborder sous le pied
  test.use({ viewport: { width: 1280, height: 700 } })

  test('sur un écran large, elle ne se recroqueville pas', async ({ page }) => {
    // Vécu : le conteneur de glissement, un flex en ligne, faisait dimensionner la grille
    // sur son contenu, et les colonnes en 1fr cessaient de s'étirer. Sur 1590 px la grille
    // n'en occupait que 526. Aucune capture ne l'avait vu, toutes étant en portrait étroit.
    await page.goto('/')
    // par le helper et non par un point écrit en dur : sur un écran large l'application se
    // centre, et la zone d'entrée suit la bande de phrase au lieu de rester dans l'angle
    await ouvrirEspaceParents(page)

    const grille = (await page.locator('[data-grille-parents]').boundingBox())!
    const carte = (await page.locator('[data-case-parent="maman"]').boundingBox())!

    // elle ne se recroqueville pas : au moins la largeur plafonnée d'une grille à 4 colonnes
    expect(grille.width, `grille de ${grille.width.toFixed(0)} px`).toBeGreaterThan(800)
    // et elle ne s'étale pas non plus : une carte garde une proportion de case, pas de barre
    const proportion = carte.width / carte.height
    expect(proportion, `carte de ${carte.width.toFixed(0)} sur ${carte.height.toFixed(0)}`).toBeLessThan(2)
  })

  test('et elle ne déborde pas de sa zone, les rangées du bas se dessinaient par-dessus', async ({
    page,
  }) => {
    // Vécu : `min-height: 0` sur la zone de glissement la laissait rétrécir sous son contenu,
    // la grille tombait de 630 à 314 px et débordait de sa boîte. La mesure qui l'attrapait
    // comparait le pied à la dernière rangée ; les onglets ont séparé les deux et l'ont rendue
    // muette, alors que le débordement, lui, existe toujours.
    await page.goto('/')
    await ouvrirEspaceParents(page)

    const debord = await page
      .locator('[data-grille-parents]')
      .evaluate((grille) => grille.scrollHeight - grille.clientHeight)
    expect(debord, `la grille déborde de ${debord} px hors de sa zone`).toBeLessThan(20)
  })
})

test.describe('E4 : annuler plusieurs suppressions', () => {
  test('deux suppressions de suite se rattrapent toutes les deux', async ({ page }) => {
    // Le radar : seul le bandeau de la dernière suppression était visible, et la case
    // supprimée juste avant était perdue sans qu'aucun avertissement n'ait prévenu.
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await page.mouse.move(28, 28)
    await page.mouse.down()
    await page.waitForTimeout(3100)
    await page.mouse.up()
    await repondreALaQuestion(page)

    for (const mot of ['oui', 'non']) {
      await page.locator(`[data-modifier-case="${mot}"]`).click()
      await page.locator('[data-demander-suppression]').click()
      await page.locator('[data-confirmer-suppression]').click()
    }
    await expect(page.locator('[data-bandeau-suppression]')).toContainText('NON a été supprimé')

    await page.locator('[data-annuler-suppression]').click()
    await expect(page.locator('[data-bandeau-suppression]')).toContainText('OUI a été supprimé')
    await page.locator('[data-annuler-suppression]').click()
    await expect(page.locator('[data-bandeau-suppression]')).toHaveCount(0)

    await fermerEspaceParents(page)
    await expect(page.locator('[data-case]')).toHaveCount(13)
  })
})

test.describe('E4 : une annulation ne promet jamais ce qu elle ne peut pas tenir', () => {
  test('l emplacement réutilisé retire la suppression des rattrapables', async ({ page }) => {
    // Trouvé au deuxième tour du radar : supprimer PIPI, poser un autre mot sur la place
    // libérée, puis cliquer Annuler faisait disparaître le bandeau comme si ça avait marché
    // alors que rien n'était restauré. Le mot était perdu sans recours, faute d'export.
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
    await page.mouse.move(28, 28)
    await page.mouse.down()
    await page.waitForTimeout(3100)
    await page.mouse.up()
    await repondreALaQuestion(page)

    await page.locator('[data-modifier-case="pipi"]').click()
    await page.locator('[data-demander-suppression]').click()
    await page.locator('[data-confirmer-suppression]').click()
    await expect(page.locator('[data-bandeau-suppression]')).toContainText('PIPI a été supprimé')

    // le parent remplit tout de suite la place libérée : « je remplace PIPI par autre chose »
    await page.locator('[data-ajouter-case]').last().click()
    await page.locator('[data-champ-label]').fill('BALLON')
    await page.locator('[data-champ-vocalization]').fill('Je veux le ballon')
    await page.locator('[data-enregistrer-case]').click()

    // le bandeau ne doit plus promettre une annulation devenue impossible
    await expect(page.locator('[data-bandeau-suppression]')).toHaveCount(0)
    await expect(page.locator('[data-case-parent="ballon"]')).toBeVisible()
  })
})

test.describe('les cartes des parents ne se chevauchent pas', () => {
  test.use({ viewport: { width: 1600, height: 1000 } })

  test('le bouton Modifier d une rangée reste au-dessus de la carte suivante', async ({ page }) => {
    // Vu sur une capture à 1600 px : la vignette avait grandi les cartes, et « Modifier »
    // de MAMAN passait sous la carte BOIRE, inatteignable. Une rangée de 120 px ne suffisait plus.
    await page.goto('/')
    await ouvrirEspaceParents(page)

    const modifier = (await page.locator('[data-modifier-case="maman"]').boundingBox())!
    const suivante = (await page.locator('[data-case-parent="boire"]').boundingBox())!

    expect(
      modifier.y + modifier.height,
      `Modifier finit à ${(modifier.y + modifier.height).toFixed(0)}, BOIRE commence à ${suivante.y.toFixed(0)}`,
    ).toBeLessThanOrEqual(suivante.y)
  })
})

test.describe('les messages d action se voient sans avoir à descendre', () => {
  test('le bandeau d annulation flotte au bas de la fenêtre, pas au bas de la page', async ({ page }) => {
    // Posé dans le flux, on ne le voyait qu'en ayant déjà descendu jusqu'à lui, alors qu'il
    // porte une annulation qui ne dure que le temps de la session parents.
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="maman"]').click()
    await page.locator('[data-demander-suppression]').click()
    await page.locator('[data-confirmer-suppression]').click()

    const fenetre = page.viewportSize()!
    const bandeau = (await page.locator('[data-bandeau-suppression]').boundingBox())!
    expect(bandeau.y, 'le bandeau commence hors de la fenêtre').toBeGreaterThanOrEqual(0)
    expect(bandeau.y + bandeau.height, 'le bandeau finit hors de la fenêtre').toBeLessThanOrEqual(
      fenetre.height + 1,
    )

    // et il y reste après avoir fait défiler la page jusqu'en haut
    await page.evaluate(() => document.querySelector('[data-espace-parents]')?.scrollTo(0, 0))
    const apres = (await page.locator('[data-bandeau-suppression]').boundingBox())!
    expect(Math.round(apres.y)).toBe(Math.round(bandeau.y))
    await expect(page.locator('[data-annuler-suppression]')).toBeVisible()
  })
})

test.describe('les opérations rares ne recouvrent pas les mots', () => {
  test.use({ viewport: { width: 1600, height: 1000 } })

  test('rien de l onglet de la tablette ne se dessine sur la grille des mots', async ({ page }) => {
    // Vu sur une capture à 1600 par 1000, quand ces deux écrans n'en faisaient qu'un :
    // « Revenir à l'écran de départ » se dessinait sur les boutons Modifier d'OUI et NON,
    // inatteignables. Les onglets l'empêchent par construction, ce test le tient.
    await page.goto('/')
    await ouvrirEspaceParents(page)

    await expect(page.locator('[data-onglet-reglages]')).not.toBeVisible()
    await expect(page.locator('[data-modifier-case="oui"]')).toBeVisible()

    await ouvrirOngletReglages(page)

    await expect(page.locator('[data-grille-parents]')).toHaveCount(0)
  })
})

test.describe('D13 : un changement non enregistré ne passe pas inaperçu', () => {
  test('le parent est prévenu quand la tablette ne peut plus écrire', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-case]')).toHaveCount(13)
    // après le chargement seulement : la graine du premier lancement doit pouvoir s'écrire
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = function () {
        throw new DOMException('stockage plein', 'QuotaExceededError')
      }
    })

    await ouvrirEspaceParents(page)
    await page.locator('[data-case-parent="pipi"]').click()

    await expect(page.locator('[data-erreur-enregistrement]')).toBeVisible()
  })
})

test.describe('les lignes d aide de l éditeur', () => {
  test('aucune ne se pose sur le champ au-dessus', async ({ page }) => {
    // une marge négative les remontait de six pixels, ce qui passait tant qu'elles suivaient
    // un champ isolé et les collait à la bordure partout ailleurs
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="moi"]').click()
    await page.locator('.repli summary').click()

    const chevauchements = await page.evaluate(() =>
      [...document.querySelectorAll('[data-editeur-case] .aide')]
        .map((aide) => {
          const precedent = aide.previousElementSibling
          if (!precedent) return 0
          return aide.getBoundingClientRect().top - precedent.getBoundingClientRect().bottom
        })
        .filter((ecart) => ecart < 0).length,
    )

    expect(chevauchements).toBe(0)
  })
})

test.describe('le coin des parents sur une vraie tablette', () => {
  test("l'appui long n'ouvre pas le menu du système par-dessus", async ({ page }) => {
    // Vécu sur la tablette installée : les trois secondes d'appui ouvraient le menu du
    // navigateur, reculer, avancer, actualiser, et le parent ne pouvait plus entrer chez lui.
    await page.goto('/')

    const empeche = await page.locator('[data-coin-parents]').evaluate((coin) => {
      const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      coin.dispatchEvent(menu)
      return menu.defaultPrevented
    })

    expect(empeche).toBe(true)
  })

  test('le doigt qui tombe à côté du coin ne réveille pas le menu non plus', async ({ page }) => {
    // Vécu aussi : la zone était trop petite, le doigt touchait la bande de phrase, et
    // c'était le navigateur qui répondait au lieu du verrou.
    await page.goto('/')

    const empeche = await page.locator('[data-bande-phrase]').evaluate((bande) => {
      const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      bande.dispatchEvent(menu)
      return menu.defaultPrevented
    })

    expect(empeche).toBe(true)
  })

  test('la zone d entrée couvre une vraie cible du doigt, sans mordre sur une case', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-case]').first().waitFor()

    const coin = (await page.locator('[data-coin-parents]').boundingBox())!
    const premiereCase = (await page.locator('[data-case]').first().boundingBox())!

    // toute la première rangée, et sur toute la largeur de la fenêtre : sur un écran large
    // l'application se centre, et un doigt posé dans la marge ne trouvait rien
    const fenetre = page.viewportSize()!
    expect(coin.x).toBe(0)
    expect(coin.y).toBe(0)
    expect(coin.width).toBe(fenetre.width)
    expect(coin.height).toBeGreaterThanOrEqual(120)
    expect(coin.y + coin.height).toBeLessThanOrEqual(premiereCase.y)
  })

  test('l appui se voit pendant qu il dure, et les échecs se disent', async ({ page }) => {
    // Deux échecs muets d'affilée : la mère lâchait à deux secondes et demie sans savoir si
    // elle appuyait au bon endroit, puis se trompait de compte et l'écran revenait sans un
    // mot, l'entrée restant sourde vingt secondes de plus. Elle en concluait que c'est cassé.
    await page.goto('/')
    await page.locator('[data-case]').first().waitFor()

    await expect(page.locator('[data-progression-appui]')).toHaveCount(0)
    await presserLeCoin(page, 600)
    await expect(page.locator('[data-progression-appui]')).toBeVisible()
    await page.mouse.up()
    await expect(page.locator('[data-progression-appui]')).toHaveCount(0)

    // une mauvaise réponse le dit, et l'attente qui suit le dit aussi
    await presserLeCoin(page, 3100)
    await page.mouse.up()
    const enonce = await page.locator('[data-enonce]').textContent()
    const [gauche, droite] = enonce!.match(/\d+/g)!.map(Number)
    const proposees = await page.locator('[data-reponse]').evaluateAll((boutons) =>
      boutons.map((bouton) => Number((bouton as HTMLElement).dataset.reponse)),
    )
    await page.locator(`[data-reponse="${proposees.find((v) => v !== gauche! + droite!)}"]`).click()

    await expect(page.locator('[data-message-verrou]')).toContainText('20 secondes')

    // et l'entrée reste sourde : elle le dit au lieu de ne rien faire
    await presserLeCoin(page, 200)
    await page.mouse.up()
    await expect(page.locator('[data-message-verrou]')).toContainText('avant de réessayer')
  })

  test('elle répond partout sur sa rangée, bleu compris, pas seulement sur la bande blanche', async ({
    page,
  }) => {
    // le pÃ¨re n'ouvrait son espace qu'en visant le blanc : le bleu autour ne répondait pas
    // sur la moitié droite, et à gauche il n'y en a que quelques pixels.
    await page.goto('/')
    await page.locator('[data-case]').first().waitFor()
    // les points se prennent sur la fenêtre et sur la bande, jamais sur la boîte de la zone
    // elle-même : mesurés sur elle, ils tomberaient dedans quelle que soit sa taille
    const fenetre = page.viewportSize()!
    const ecran = (await page.locator('[data-ecran]').boundingBox())!
    const bande = (await page.locator('[data-bande-phrase]').boundingBox())!

    for (const [nom, x, y] of [
      ['angle haut gauche de la fenêtre', 6, 6],
      ['angle haut droit de la fenêtre', fenetre.width - 6, 6],
      ['bleu au-dessus de la bande', bande.x + 10, 3],
      ['bleu à droite de la bande', ecran.x + ecran.width - 6, bande.y + bande.height / 2],
      ['moitié droite de la bande', ecran.x + ecran.width * 0.75, bande.y + bande.height / 2],
    ] as const) {
      const atteint = await page.evaluate(
        ([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('[data-coin-parents]'),
        [x, y],
      )
      expect(atteint, `${nom} ne mène pas à la zone d'entrée`).toBe(true)
    }
  })

  test('elle s arrête avant les boutons de contexte, qui appartiennent à l enfant', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-case]').first().waitFor()

    const coin = (await page.locator('[data-coin-parents]').boundingBox())!
    const contexte = (await page.locator('[data-contexte]').first().boundingBox())!

    expect(coin.y + coin.height).toBeLessThanOrEqual(contexte.y)
    // et le bouton répond bien au doigt, il n'est pas recouvert
    const dessus = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.closest('[data-contexte]')?.getAttribute('data-contexte'),
      [contexte.x + 20, contexte.y + 20],
    )
    expect(dessus).toBe('maison')
  })
})

test.describe('le verrou parents sur un petit téléphone', () => {
  test('toutes les réponses restent dans l écran, même les plus larges', async ({ page }) => {
    // Six réponses d'au moins 64 px, plus leurs écarts : la rangée ne tient pas dans 320 px.
    // Sans retour à la ligne elle restait centrée et débordait des deux côtés, si bien qu'un
    // parent ne pouvait plus ouvrir son espace dès que la bonne réponse tombait au bord.
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/')

    await presserLeCoin(page, 3100)
    await page.mouse.up()

    const reponses = await page.locator('[data-reponse]').all()
    expect(reponses.length).toBeGreaterThan(1)
    for (const reponse of reponses) await expect(reponse).toBeInViewport()
  })
})

test.describe('un mot long ne casse pas la grille', () => {
  test('la grille reste dans l écran même avec le mot le plus long autorisé', async ({ page }) => {
    // La garantie tient sans rien de particulier : un bouton n'impose pas la largeur de son
    // texte à sa piste. Vérifié en retirant la parade `min-width: 0` que j'avais ajoutée par
    // précaution, le test restait vert : elle ne servait à rien, elle est partie.
    // le pire cas réel : le plus petit écran plausible et un mot à la longueur maximale
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="moi"]').click()
    await page.locator('[data-champ-label]').fill('CIRCONFERENCES')
    await page.locator('[data-enregistrer-case]').click()
    await fermerEspaceParents(page)

    const deborde = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(deborde, 'la grille dépasse la largeur de l écran').toBe(false)
  })
})

test.describe('déplacer une case (P6)', () => {
  test('la consigne reste sous les yeux, même en bas d une planche pleine', async ({ page }) => {
    // le bandeau vivait sous la grille : sur une planche haute il partait hors de l'écran,
    // et le parent ne voyait plus ni la consigne ni le bouton d'annulation
    await page.goto('/')
    await ouvrirEspaceParents(page)

    await page.locator('[data-deplacer-case="maman"]').click()

    await expect(page.locator('[data-bandeau-deplacement]')).toBeInViewport()
    await page.mouse.wheel(0, 2000)
    await expect(page.locator('[data-bandeau-deplacement]')).toBeInViewport()
  })

  test('le mot change de place et aucun autre ne bouge', async ({ page }) => {
    // Le reproche fait à Cboard : y déplacer un bouton décale toute la ligne. Ici les
    // positions sont une matrice, donc seule la case déplacée change de place.
    await page.goto('/')
    await ouvrirEspaceParents(page)

    // libérer une place : la planche de démonstration est pleine
    await page.locator('[data-modifier-case="pipi"]').click()
    await page.locator('[data-demander-suppression]').click()
    await page.locator('[data-confirmer-suppression]').click()

    const voisins = ['maman', 'papa', 'doudou', 'boire', 'oui', 'non']
    const avant = new Map<string, string>()
    for (const id of voisins) {
      const boite = (await page.locator(`[data-case-parent="${id}"]`).boundingBox())!
      avant.set(id, `${Math.round(boite.x)},${Math.round(boite.y)}`)
    }
    const placeDeMoi = (await page.locator('[data-case-parent="moi"]').boundingBox())!

    await page.locator('[data-deplacer-case="moi"]').click()
    await expect(page.locator('[data-bandeau-deplacement]')).toContainText('MOI')
    await page.locator('[data-poser-ici]').first().click()

    await expect(page.locator('[data-bandeau-deplacement]')).toHaveCount(0)
    const apres = (await page.locator('[data-case-parent="moi"]').boundingBox())!
    expect(Math.round(apres.x) !== Math.round(placeDeMoi.x) || Math.round(apres.y) !== Math.round(placeDeMoi.y)).toBe(true)
    for (const id of voisins) {
      const boite = (await page.locator(`[data-case-parent="${id}"]`).boundingBox())!
      expect(`${Math.round(boite.x)},${Math.round(boite.y)}`, `${id} a bougé`).toBe(avant.get(id))
    }
  })

  test('le déplacement survit au rechargement', async ({ page }) => {
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await page.locator('[data-modifier-case="pipi"]').click()
    await page.locator('[data-demander-suppression]').click()
    await page.locator('[data-confirmer-suppression]').click()
    await page.locator('[data-deplacer-case="moi"]').click()
    await page.locator('[data-poser-ici]').first().click()
    const place = (await page.locator('[data-case-parent="moi"]').boundingBox())!

    await page.reload()
    await ouvrirEspaceParents(page)

    const apres = (await page.locator('[data-case-parent="moi"]').boundingBox())!
    expect(Math.round(apres.x)).toBe(Math.round(place.x))
    expect(Math.round(apres.y)).toBe(Math.round(place.y))
  })

  test('deux mots échangent leur place sur une planche pleine', async ({ page }) => {
    // La mère ne pouvait pas réorganiser : sa planche est pleine, et seul un emplacement
    // vide acceptait le mot déplacé.
    await page.goto('/')
    await ouvrirEspaceParents(page)
    const avantMaman = (await page.locator('[data-case-parent="maman"]').boundingBox())!
    const avantPapa = (await page.locator('[data-case-parent="papa"]').boundingBox())!
    const avantBoire = (await page.locator('[data-case-parent="boire"]').boundingBox())!

    await page.locator('[data-deplacer-case="maman"]').click()
    await page.locator('[data-case-parent="papa"]').click()

    await expect(page.locator('[data-bandeau-deplacement]')).toHaveCount(0)
    const apresMaman = (await page.locator('[data-case-parent="maman"]').boundingBox())!
    const apresPapa = (await page.locator('[data-case-parent="papa"]').boundingBox())!
    expect(Math.round(apresMaman.x)).toBe(Math.round(avantPapa.x))
    expect(Math.round(apresPapa.x)).toBe(Math.round(avantMaman.x))
    // et personne d'autre n'a bougé
    const apresBoire = (await page.locator('[data-case-parent="boire"]').boundingBox())!
    expect(Math.round(apresBoire.x)).toBe(Math.round(avantBoire.x))
    expect(Math.round(apresBoire.y)).toBe(Math.round(avantBoire.y))
  })

  test('annuler laisse tout en place', async ({ page }) => {
    await page.goto('/')
    await ouvrirEspaceParents(page)
    const avant = (await page.locator('[data-case-parent="moi"]').boundingBox())!

    await page.locator('[data-deplacer-case="moi"]').click()
    await page.locator('[data-annuler-deplacement]').click()

    await expect(page.locator('[data-bandeau-deplacement]')).toHaveCount(0)
    const apres = (await page.locator('[data-case-parent="moi"]').boundingBox())!
    expect(Math.round(apres.x)).toBe(Math.round(avant.x))
    expect(Math.round(apres.y)).toBe(Math.round(avant.y))
  })
})

test.describe('les réglages (P9)', () => {
  test('le volume et la fermeté se règlent et survivent au rechargement', async ({ page }) => {
    await page.goto('/')
    await ouvrirEspaceParents(page)

    await ouvrirOngletReglages(page)
    await page.locator('[data-volume="bas"]').check()
    await page.locator('[data-fermete="tres-assure"]').check()
    await expect(page.locator('[data-aide-fermete]')).toContainText('vraiment appuyer')

    // rechargée dans la foulée du clic, la page relirait la configuration d'avant : ce
    // n'est pas le réglage qu'on testerait, mais la vitesse d'écriture d'IndexedDB
    await expect.poll(() => reglagesPersistes(page)).toMatchObject({ volume: 40, fermeteAppui: 'tres-assure' })
    await page.reload()
    await ouvrirEspaceParents(page)
    await ouvrirOngletReglages(page)

    await expect(page.locator('[data-volume="bas"]')).toBeChecked()
    await expect(page.locator('[data-fermete="tres-assure"]')).toBeChecked()
  })

  test('la reglette affine le volume entre les repères, et le réglage survit au rechargement', async ({
    page,
  }) => {
    await page.goto('/')
    await ouvrirEspaceParents(page)

    await ouvrirOngletReglages(page)
    await page.locator('[data-volume-reglette]').fill('85')
    await expect(page.locator('[data-volume-valeur]')).toHaveText('85 %')
    // 85 n'est aucun des trois repères : aucun ne doit prétendre être le niveau en cours
    await expect(page.locator('[data-volume="fort"]')).not.toBeChecked()

    await expect.poll(() => reglagesPersistes(page)).toMatchObject({ volume: 85 })
    await page.reload()
    await ouvrirEspaceParents(page)
    await ouvrirOngletReglages(page)

    await expect(page.locator('[data-volume-valeur]')).toHaveText('85 %')
  })

  test('la famille peut éteindre l animation de la case', async ({ page }) => {
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await ouvrirOngletReglages(page)
    await page.locator('[data-reglage-animations]').uncheck()
    await page.locator('[data-fermer-parents]').click()
    await page.locator('[data-plus-tard]').click()

    const maman = page.locator('[data-case="maman"]')
    await maman.dispatchEvent('pointerdown')
    await maman.dispatchEvent('pointerup')

    // lecture unique et non `expect(...).not.toHaveClass`, qui réessaie : l'assertion
    // deviendrait vraie toute seule dès la fin du son, réglage éteint ou non
    expect(await maman.getAttribute('class')).not.toContain('parle')
  })

  test('un appui trop bref ne fait plus parler la tablette au niveau très assuré', async ({ page }) => {
    // C'est tout l'objet du réglage : une main qui frôle l'écran ne déclenche plus de mot.
    await page.goto('/')
    await ouvrirEspaceParents(page)
    await ouvrirOngletReglages(page)
    await page.locator('[data-fermete="tres-assure"]').check()
    await page.locator('[data-fermer-parents]').click()
    // changer un réglage compte comme une modification : le rappel de sauvegarde s'ouvre
    await page.locator('[data-plus-tard]').click()

    const boire = page.locator('[data-case="boire"]')
    await boire.dispatchEvent('pointerdown')
    await boire.dispatchEvent('pointerup')

    await expect(page.locator('[data-bande-phrase]')).toHaveText('')
  })
})
