import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  construireArchive,
  inventaireActuel,
  lireArchive,
  replierSurLesMediasLivres,
  ressourcesReferencees,
} from '../../src/domaine/archive'
import { changerImageDeContexte, toutesLesPlanches, type Configuration, type Contexte, type Planche } from '../../src/domaine/planche'
import { CONFIGURATION_DEMO } from '../../src/domaine/plancheDemo'

/** Un octet non nul par chemin : suffisant pour vérifier que le bon contenu est transporté. */
function ressourcesPour(configuration: Configuration): Map<string, Uint8Array> {
  const ressources = new Map<string, Uint8Array>()
  for (const chemin of ressourcesReferencees(configuration)) {
    ressources.set(chemin, new TextEncoder().encode(`contenu de ${chemin}`))
  }
  return ressources
}

const BARRE_VIDE: Planche = {
  format: 'open-board-0.1',
  id: 'barre',
  locale: 'fr',
  name: 'Barre',
  grid: { rows: 1, columns: 1, order: [[null]] },
  buttons: [],
}

/**
 * Configuration tordue : plusieurs contextes, un contexte à trois pages, des cases
 * masquées, des trous dans grid.order, une case sans son ni image, des accents et une
 * apostrophe dans un label et une vocalization. C'est ce test qui attrape les vrais défauts.
 */
function construireConfigurationTordue(): Configuration {
  const maisonP1: Planche = {
    format: 'open-board-0.1',
    id: 'maison',
    locale: 'fr',
    name: 'Maison',
    grid: { rows: 2, columns: 2, order: [['creme-brulee', null], [null, 'sans-media']] },
    buttons: [
      {
        id: 'creme-brulee',
        label: 'CRÈME BRÛLÉE',
        vocalization: "J'aime la crème brûlée, s'il te plaît",
        image_id: 'pictos/dessert.svg',
        sound_id: 'dessert',
        background_color: '#ffd25e',
        border_color: '#ffc93c',
        ext_mesmots_enchaine: 'dessert',
      },
      { id: 'sans-media', label: 'SANS MÉDIA', vocalization: 'Sans média', hidden: true },
    ],
  }
  const maisonP2: Planche = {
    format: 'open-board-0.1',
    id: 'maison-p2',
    locale: 'fr',
    name: 'Maison, page 2',
    grid: { rows: 1, columns: 1, order: [['boire']] },
    buttons: [{ id: 'boire', label: 'BOIRE', vocalization: 'Je veux boire', sound_id: 'boire' }],
  }
  const maisonP3: Planche = {
    format: 'open-board-0.1',
    id: 'maison-p3',
    locale: 'fr',
    name: 'Maison, page 3',
    grid: { rows: 1, columns: 2, order: [[null, 'fin']] },
    buttons: [{ id: 'fin', label: 'FIN', vocalization: 'Fin', hidden: true, sound_id: 'fin' }],
  }
  const exterieur: Planche = {
    format: 'open-board-0.1',
    id: 'exterieur',
    locale: 'fr',
    name: 'Extérieur',
    grid: { rows: 1, columns: 1, order: [['ecole']] },
    buttons: [
      {
        id: 'ecole',
        label: 'ÉCOLE',
        vocalization: "Je veux aller à l'école",
        image_id: 'pictos/ecole.svg',
        hidden: false,
      },
    ],
  }
  const barre: Planche = {
    format: 'open-board-0.1',
    id: 'barre',
    locale: 'fr',
    name: 'Mots essentiels',
    grid: { rows: 1, columns: 3, order: [['oui', null, 'non']] },
    buttons: [
      { id: 'oui', label: 'OUI', vocalization: 'Oui', sound_id: 'oui' },
      { id: 'non', label: 'NON', vocalization: 'Non', sound_id: 'non', hidden: true },
    ],
  }
  return {
    format: 'open-board-0.1',
    contextes: [
      { id: 'maison', name: 'Maison', pages: [maisonP1, maisonP2, maisonP3] },
      { id: 'exterieur', name: 'Extérieur', pages: [exterieur] },
    ],
    barre,
    reglages: { retourAutomatique: false, modifieDepuisSauvegarde: true, volume: 70, fermeteAppui: 'normal', animations: true, enchainement: false, corpsAToucher: true },
  }
}

describe('aller-retour construireArchive puis lireArchive', () => {
  it('rend la configuration livrée profondément égale', () => {
    const ressources = ressourcesPour(CONFIGURATION_DEMO)
    const { octets } = construireArchive(CONFIGURATION_DEMO, ressources)
    const { configuration } = lireArchive(octets)
    expect(configuration).toEqual(CONFIGURATION_DEMO)
  })

  it('rend une configuration tordue profondément égale, hidden, trous et accents compris', () => {
    const tordue = construireConfigurationTordue()
    const ressources = ressourcesPour(tordue)
    const { octets } = construireArchive(tordue, ressources)
    const { configuration } = lireArchive(octets)
    expect(configuration).toEqual(tordue)
  })

  it('reprend le volume nommé d une sauvegarde faite avant la réglette', () => {
    // une famille restaure une archive de la semaine dernière : son volume y est écrit
    // « fort », et doit revenir à 100, pas au défaut
    const { octets } = construireArchive(CONFIGURATION_DEMO, ressourcesPour(CONFIGURATION_DEMO))
    const entrees = unzipSync(octets)
    const manifeste = JSON.parse(strFromU8(entrees['manifest.json']!))
    manifeste.ext_mesmots_reglages.volume = 'fort'
    entrees['manifest.json'] = strToU8(JSON.stringify(manifeste))

    const { configuration } = lireArchive(zipSync(entrees))

    expect(configuration.reglages.volume).toBe(100)
  })

  it('donne son défaut à un réglage absent d une archive plus ancienne', () => {
    // une archive faite avant l'enchaînement n'a pas le champ : il doit revenir éteint, et
    // non `undefined`, l'écran de l'enfant se décidant sur ce booléen
    const { octets } = construireArchive(CONFIGURATION_DEMO, ressourcesPour(CONFIGURATION_DEMO))
    const entrees = unzipSync(octets)
    const manifeste = JSON.parse(strFromU8(entrees['manifest.json']!))
    delete manifeste.ext_mesmots_reglages.enchainement
    entrees['manifest.json'] = strToU8(JSON.stringify(manifeste))

    const { configuration } = lireArchive(zipSync(entrees))

    expect(configuration.reglages.enchainement).toBe(false)
  })

  it('rend les ressources fournies telles quelles', () => {
    const ressources = ressourcesPour(CONFIGURATION_DEMO)
    const { octets } = construireArchive(CONFIGURATION_DEMO, ressources)
    const { ressources: relues } = lireArchive(octets)
    expect(relues.size).toBe(ressources.size)
    for (const [chemin, contenu] of ressources) {
      expect(relues.get(chemin)).toEqual(contenu)
    }
  })
})

describe('construireArchive produit un zip valide', () => {
  const ressources = ressourcesPour(CONFIGURATION_DEMO)
  const { octets } = construireArchive(CONFIGURATION_DEMO, ressources)
  const entrees = unzipSync(octets)

  it('se liste comme une archive zip normale', () => {
    expect(Object.keys(entrees).length).toBeGreaterThan(0)
  })

  it('contient un manifest.json', () => {
    expect(entrees['manifest.json']).toBeDefined()
  })

  it('contient une entrée boards/ par page, toutes pages de tous contextes, plus la barre', () => {
    const pagesAttendues = CONFIGURATION_DEMO.contextes.flatMap((c) => c.pages.map((p) => p.id))
    for (const id of [...pagesAttendues, CONFIGURATION_DEMO.barre.id]) {
      expect(entrees[`boards/${id}.obf`], `boards/${id}.obf manquant`).toBeDefined()
    }
  })

  it('contient les ressources fournies', () => {
    for (const chemin of ressources.keys()) {
      const cheminArchive = chemin.startsWith('sons/') ? `sounds/${chemin.slice(5)}` : chemin
      expect(entrees[cheminArchive], `${cheminArchive} manquant`).toBeDefined()
    }
  })
})

describe('le manifeste reste lisible par un tiers', () => {
  const ressources = ressourcesPour(CONFIGURATION_DEMO)
  const { octets } = construireArchive(CONFIGURATION_DEMO, ressources)
  const entrees = unzipSync(octets)
  const manifeste = JSON.parse(strFromU8(entrees['manifest.json']!))

  it('porte format, root et paths.boards', () => {
    expect(manifeste.format).toBe('open-board-0.1')
    expect(typeof manifeste.root).toBe('string')
    expect(manifeste.paths.boards).toBeDefined()
  })

  it('root pointe sur une planche qui existe dans l archive', () => {
    expect(entrees[manifeste.root]).toBeDefined()
  })
})

describe('lireArchive refuse une archive illisible, message compris par un parent', () => {
  it("refuse ce qui n'est pas un zip", () => {
    const octets = new TextEncoder().encode('ceci n est pas une archive')
    expect(() => lireArchive(octets)).toThrow(/pas.*sauvegarde.*zip/i)
  })

  it('refuse un zip sans manifest.json', () => {
    const { octets: valides } = construireArchive(CONFIGURATION_DEMO, ressourcesPour(CONFIGURATION_DEMO))
    const entrees = unzipSync(valides)
    delete entrees['manifest.json']
    const octets = zipSync(entrees)
    expect(() => lireArchive(octets)).toThrow(/manifeste/i)
  })

  it('refuse un manifeste sans nos extensions', () => {
    const octets = zipSync({
      'manifest.json': strToU8(
        JSON.stringify({ format: 'open-board-0.1', root: 'boards/x.obf', paths: {} }),
      ),
    })
    expect(() => lireArchive(octets)).toThrow(/sauvegarde de Mes mots/i)
  })

  it("refuse un format qu'elle ne connaît pas, en disant de mettre à jour", () => {
    const { octets: valides } = construireArchive(CONFIGURATION_DEMO, ressourcesPour(CONFIGURATION_DEMO))
    const entrees = unzipSync(valides)
    const manifeste = JSON.parse(strFromU8(entrees['manifest.json']!))
    manifeste.format = 'open-board-9.9-future'
    entrees['manifest.json'] = strToU8(JSON.stringify(manifeste))
    expect(() => lireArchive(zipSync(entrees))).toThrow(/mettez l'application à jour/i)
  })

  it('refuse une page référencée par un contexte mais absente de l archive', () => {
    const { octets: valides } = construireArchive(CONFIGURATION_DEMO, ressourcesPour(CONFIGURATION_DEMO))
    const entrees = unzipSync(valides)
    delete entrees[`boards/${CONFIGURATION_DEMO.contextes[0]!.pages[0]!.id}.obf`]
    const octets = zipSync(entrees)
    expect(() => lireArchive(octets)).toThrow(/incomplète/i)
  })

  it("refuse une planche dont le JSON ne ressemble pas à une Planche", () => {
    const { octets: valides } = construireArchive(CONFIGURATION_DEMO, ressourcesPour(CONFIGURATION_DEMO))
    const entrees = unzipSync(valides)
    const idPremierePage = CONFIGURATION_DEMO.contextes[0]!.pages[0]!.id
    entrees[`boards/${idPremierePage}.obf`] = strToU8(JSON.stringify({ quelconque: 'valeur' }))
    const octets = zipSync(entrees)
    expect(() => lireArchive(octets)).toThrow(/abîmée/i)
  })
})

describe('inventaire', () => {
  it('compte juste sur une configuration dont les nombres sont connus à la main', () => {
    const tordue = construireConfigurationTordue()
    // 2 contextes ; 3 pages (maison) + 1 (extérieur) = 4 ; 7 cases dont 3 masquées
    // (sans-media, fin, non) ; 2 images (dessert, école) ; 5 sons (dessert, boire, fin, oui, non)
    const ressources = ressourcesPour(tordue)
    const { inventaire } = construireArchive(tordue, ressources)
    expect(inventaire.contextes).toBe(2)
    expect(inventaire.pages).toBe(4)
    expect(inventaire.cases).toBe(7)
    expect(inventaire.casesRevelees).toBe(4)
    expect(inventaire.images).toBe(2)
    expect(inventaire.sons).toBe(5)
    expect(inventaire.octets).toBeGreaterThan(0)
  })

  it('ne compte pas les cases masquées comme révélées, sur la configuration livrée', () => {
    const ressources = ressourcesPour(CONFIGURATION_DEMO)
    const { inventaire } = construireArchive(CONFIGURATION_DEMO, ressources)
    const cases = CONFIGURATION_DEMO.contextes
      .flatMap((c) => c.pages.flatMap((p) => p.buttons))
      .concat(CONFIGURATION_DEMO.barre.buttons)
    expect(inventaire.cases).toBe(cases.length)
    expect(inventaire.casesRevelees).toBe(cases.filter((c) => c.hidden !== true).length)
    expect(inventaire.casesRevelees).toBeLessThan(inventaire.cases)
  })
})

describe('ressourcesReferencees', () => {
  it("déduit les chemins d'images et de sons depuis image_id et sound_id, sans doublon", () => {
    const planche: Planche = {
      format: 'open-board-0.1',
      id: 'p',
      locale: 'fr',
      name: 'p',
      grid: { rows: 1, columns: 2, order: [['a', 'b']] },
      buttons: [
        { id: 'a', label: 'A', vocalization: 'a', image_id: 'pictos/a.svg', sound_id: 'a' },
        { id: 'b', label: 'B', vocalization: 'b', sound_id: 'a' },
      ],
    }
    const configuration: Configuration = {
      format: 'open-board-0.1',
      contextes: [{ id: 'c', name: 'C', pages: [planche] }],
      barre: BARRE_VIDE,
      reglages: { retourAutomatique: true, modifieDepuisSauvegarde: false, volume: 70, fermeteAppui: 'normal', animations: true, enchainement: false, corpsAToucher: true },
    }
    expect(ressourcesReferencees(configuration).sort()).toEqual(['images/pictos/a.svg', 'sons/a.mp3'])
  })

  it("emporte l'image des boutons de contexte, pas seulement celle des cases", () => {
    // sans elle dans l'archive, une sauvegarde restaurée rend à l'enfant des mondes dont il
    // ne reconnaît plus les boutons
    const avecImage = changerImageDeContexte(CONFIGURATION_DEMO, 'maison', 'perso/contexte-maison')

    expect(ressourcesReferencees(avecImage)).toContain('images/perso/contexte-maison')
  })

  it("n'ajoute rien pour une case sans image ni son", () => {
    const contexte: Contexte = {
      id: 'c',
      name: 'C',
      pages: [
        {
          format: 'open-board-0.1',
          id: 'p',
          locale: 'fr',
          name: 'p',
          grid: { rows: 1, columns: 1, order: [['a']] },
          buttons: [{ id: 'a', label: 'A', vocalization: 'a' }],
        },
      ],
    }
    const configuration: Configuration = {
      format: 'open-board-0.1',
      contextes: [contexte],
      barre: BARRE_VIDE,
      reglages: { retourAutomatique: true, modifieDepuisSauvegarde: false, volume: 70, fermeteAppui: 'normal', animations: true, enchainement: false, corpsAToucher: true },
    }
    expect(ressourcesReferencees(configuration)).toEqual([])
  })
})

describe('inventaireActuel (B3, aperçu avant remplacement)', () => {
  it('donne les mêmes chiffres qu un inventaire de sauvegarde, hors date et octets', () => {
    const tordue = construireConfigurationTordue()
    const { inventaire } = construireArchive(tordue, ressourcesPour(tordue))

    expect(inventaireActuel(tordue)).toEqual({
      contextes: inventaire.contextes,
      pages: inventaire.pages,
      cases: inventaire.cases,
      casesRevelees: inventaire.casesRevelees,
      images: inventaire.images,
      sons: inventaire.sons,
    })
  })

  it('compte juste sans qu aucune ressource n ait été lue', () => {
    // mêmes chiffres à la main que le test « inventaire » ci-dessus, sans construire d'archive
    const tordue = construireConfigurationTordue()
    expect(inventaireActuel(tordue)).toEqual({
      contextes: 2,
      pages: 4,
      cases: 7,
      casesRevelees: 4,
      images: 2,
      sons: 5,
    })
  })
})

describe('une archive piégée ne fige pas la tablette', () => {
  it('refuse avant de tout décompresser une archive de plus de cinquante mégaoctets', () => {
    // Un zip de quelques dizaines de Ko peut contenir 80 Mo de zéros, et unzipSync alloue
    // tout d'un coup. Une configuration complète pèse trois à quatre Mo : la borne laisse
    // dix fois la marge et arrête le reste avant que la tablette ne manque de mémoire.
    const gros = zipSync({ 'boards/gros.obf': new Uint8Array(51 * 1024 * 1024) })

    expect(gros.length, 'le zip lui-même doit rester petit pour que le test soit parlant').toBeLessThan(
      200 * 1024,
    )
    expect(() => lireArchive(gros)).toThrow(/trop volumineuse/i)
  })

  it('laisse passer une configuration complète bien en dessous de la borne', () => {
    const { octets } = construireArchive(CONFIGURATION_DEMO, ressourcesPour(CONFIGURATION_DEMO))
    expect(() => lireArchive(octets)).not.toThrow()
  })
})

describe('replierSurLesMediasLivres, la promesse faite au parent avant de remplacer', () => {
  const avecPerso = (configuration: Configuration): Configuration => ({
    ...configuration,
    contextes: configuration.contextes.map((contexte) => ({
      ...contexte,
      pages: contexte.pages.map((page) => ({
        ...page,
        buttons: page.buttons.map((bouton) =>
          bouton.id === 'maman'
            ? { ...bouton, image_id: 'perso/maman', sound_id: 'perso/maman' }
            : bouton,
        ),
      })),
    })),
  })
  const maman = (configuration: Configuration) =>
    toutesLesPlanches(configuration)
      .flatMap((planche) => planche.buttons)
      .find((bouton) => bouton.id === 'maman')!

  it('rend au mot son pictogramme et son MP3 livrés quand le fichier ne les apporte pas', () => {
    // sans ce repli le mot gardait sa référence perso/, dont la purge venait d'effacer le
    // blob : il revenait muet et sans visage, l'inverse de ce que l'aperçu promet
    const repliee = replierSurLesMediasLivres(avecPerso(CONFIGURATION_DEMO), new Map())

    expect(maman(repliee).image_id).toBe('pictos/maman.svg')
    expect(maman(repliee).sound_id).toBe('maman')
  })

  it('ne touche à rien quand le fichier apporte bien la photo et la voix', () => {
    const ressources = new Map([
      ['images/perso/maman.jpg', new Uint8Array([1])],
      ['sons/perso/maman.webm', new Uint8Array([1])],
    ])

    const repliee = replierSurLesMediasLivres(avecPerso(CONFIGURATION_DEMO), ressources)

    expect(maman(repliee).image_id).toBe('perso/maman')
    expect(maman(repliee).sound_id).toBe('perso/maman')
  })

  it("laisse le bouton d un contexte sans dessin plutôt qu avec une référence morte", () => {
    // la purge qui suit la restauration ne garde que ce que l'archive apporte : garder la
    // référence donnerait un bouton dont l'image n'existe nulle part, et pour toujours
    const avecImage = changerImageDeContexte(CONFIGURATION_DEMO, 'maison', 'perso/contexte-maison')

    const replie = replierSurLesMediasLivres(avecImage, new Map())

    expect(replie.contextes.find((c) => c.id === 'maison')!.ext_mesmots_image).toBeUndefined()
  })

  it("garde l image du bouton quand le fichier l apporte", () => {
    const avecImage = changerImageDeContexte(CONFIGURATION_DEMO, 'maison', 'perso/contexte-maison')

    const replie = replierSurLesMediasLivres(avecImage, new Map([['images/perso/contexte-maison', new Uint8Array([1])]]))

    expect(replie.contextes.find((c) => c.id === 'maison')!.ext_mesmots_image).toBe('perso/contexte-maison')
  })

  it('laisse un mot créé par la famille sans média plutôt que d en inventer un', () => {
    const inventee: Configuration = {
      ...CONFIGURATION_DEMO,
      barre: {
        ...CONFIGURATION_DEMO.barre,
        buttons: [
          {
            id: 'gateau',
            label: 'GÂTEAU',
            vocalization: 'Je veux du gâteau',
            image_id: 'perso/gateau',
            sound_id: 'perso/gateau',
          },
        ],
      },
    }

    const repliee = replierSurLesMediasLivres(inventee, new Map())

    expect(repliee.barre.buttons[0]!.image_id).toBeUndefined()
    expect(repliee.barre.buttons[0]!.sound_id).toBeUndefined()
  })
})
