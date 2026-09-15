import { describe, it, expect } from 'vitest'
import {
  pageVierge,
  ajouterContexte,
  renommerContexte,
  changerImageDeContexte,
  imagePersonnaliseeDeContexte,
  supprimerContexte,
  restaurerContexte,
  fusionnerContextes,
  CONTEXTES_MAXIMUM,
  voixDeCase,
  deplacerCase,
  echangerCases,
  ajouterCase,
  imagePictogrammeLivre,
  sonLivre,
  ajouterCaseSurNouvellePage,
  appliquerMediaChoisi,
  basculerVisibilite,
  caseParIdentifiant,
  changerFormeDeGrille,
  consequenceEcrite,
  consequencesDuChangementDeForme,
  contextePorteBouton,
  identifiantDepuisMot,
  identifiantsPersonnalises,
  identifiantPersonnalise,
  marquerModifiee,
  marquerSauvegardee,
  modifierCase,
  nouvellePageAtteignable,
  pageAtteignable,
  pagesAtteignables,
  REGLAGES_PAR_DEFAUT,
  restaurerCase,
  silhouetteEnGrille,
  supprimerCase,
  toutesLesPlanches,
  type ChampsModifiables,
  type Configuration,
  type Contexte,
  type Planche,
} from '../../src/domaine/planche'
import {
  CONFIGURATION_DEMO,
  PLANCHE_DEMO,
  PLANCHE_EXTERIEUR,
  TOUTES_LES_CASES,
} from '../../src/domaine/plancheDemo'

const planche: Planche = {
  format: 'open-board-0.1',
  id: 't',
  locale: 'fr',
  name: 'test',
  grid: { rows: 2, columns: 2, order: [['a', 'b'], ['c', null]] },
  buttons: [
    { id: 'a', label: 'A', vocalization: 'a' },
    { id: 'b', label: 'B', vocalization: 'b', hidden: true },
    { id: 'c', label: 'C', vocalization: 'c' },
  ],
}

const posees = PLANCHE_DEMO.grid.order.flat().filter((id): id is string => id !== null)

describe('planche', () => {
  it('retrouve une case par son identifiant', () => {
    expect(caseParIdentifiant(planche, 'b')?.label).toBe('B')
  })

  it('ne retrouve rien pour un identifiant inconnu', () => {
    expect(caseParIdentifiant(planche, 'z')).toBeUndefined()
  })
})

/** Page à un emplacement, dont on choisit ce qui l'occupe. */
function pageDe(id: string, occupant: 'revelee' | 'masquee' | 'vide' | 'fantome'): Planche {
  return {
    format: 'open-board-0.1',
    id,
    locale: 'fr',
    name: id,
    grid: { rows: 1, columns: 1, order: [[occupant === 'vide' ? null : 'a']] },
    buttons:
      occupant === 'revelee'
        ? [{ id: 'a', label: 'A', vocalization: 'a' }]
        : occupant === 'masquee'
          ? [{ id: 'a', label: 'A', vocalization: 'a', hidden: true }]
          : [],
  }
}

describe('atteignabilité', () => {
  it('une page dont au moins une case est révélée est atteignable', () => {
    expect(pageAtteignable(pageDe('p', 'revelee'))).toBe(true)
    expect(pageAtteignable(PLANCHE_DEMO)).toBe(true)
  })

  it('une page sans case révélée est une impasse', () => {
    expect(pageAtteignable(pageDe('p', 'masquee'))).toBe(false)
    expect(pageAtteignable(pageDe('p', 'vide'))).toBe(false)
    expect(pageAtteignable(PLANCHE_EXTERIEUR)).toBe(false)
  })

  it('un identifiant posé sans case correspondante ne rend pas la page atteignable', () => {
    // le trou de données ne doit pas se lire comme un mot disponible
    expect(pageAtteignable(pageDe('p', 'fantome'))).toBe(false)
  })

  it('un contexte porte un bouton dès qu une seule de ses pages est atteignable', () => {
    const surLaSeconde: Contexte = {
      id: 'c',
      name: 'C',
      pages: [pageDe('p1', 'masquee'), pageDe('p2', 'revelee')],
    }
    expect(contextePorteBouton(surLaSeconde)).toBe(true)
    expect(contextePorteBouton({ id: 'c', name: 'C', pages: [pageDe('p1', 'masquee')] })).toBe(false)
    expect(contextePorteBouton({ id: 'c', name: 'C', pages: [] })).toBe(false)
  })

  it('sur la configuration livrée, Extérieur seul reste sans bouton', () => {
    // Extérieur n'a que des mots masqués, la famille les révélera. Maison et la douleur sont
    // servies prêtes à l'emploi.
    expect(CONFIGURATION_DEMO.contextes.filter(contextePorteBouton).map((c) => c.id)).toEqual([
      'maison',
      'douleur',
    ])
  })

  it('l enfant ne parcourt que les pages atteignables, dans l ordre', () => {
    const contexte: Contexte = {
      id: 'c',
      name: 'C',
      pages: [pageDe('p1', 'revelee'), pageDe('p2', 'vide'), pageDe('p3', 'revelee')],
    }
    expect(pagesAtteignables(contexte).map((p) => p.id)).toEqual(['p1', 'p3'])
  })

  it('aujourd hui Maison n offre qu une page, donc rien à paginer', () => {
    expect(pagesAtteignables(CONFIGURATION_DEMO.contextes[0]!).map((p) => p.id)).toEqual(['maison'])
  })
})

describe('planche de démonstration', () => {
  it('porte les 21 cases du vocabulaire validé, plus les 19 de la douleur', () => {
    expect(TOUTES_LES_CASES).toHaveLength(40)
  })

  it('range chaque case dans le lieu auquel elle appartient', () => {
    // MAGASIN et FRÈRE au contexte Extérieur, AIDE-MOI, ENCORE et FINI à la barre :
    // leur donner une place dans Maison les obligerait à déménager plus tard.
    expect(PLANCHE_DEMO.buttons).toHaveLength(16)
    expect(CONFIGURATION_DEMO.contextes.map((c) => c.id)).toEqual(['maison', 'exterieur', 'douleur'])
    // les pages se créent désormais à la demande (ajouterCaseSurNouvellePage) : la
    // configuration livrée n'en porte plus qu'une par contexte
    expect(CONFIGURATION_DEMO.contextes[0]!.pages.map((p) => p.id)).toEqual(['maison'])
    expect(CONFIGURATION_DEMO.barre.grid.order.flat()).toEqual([
      'aide',
      'encore',
      'fini',
      null,
      null,
    ])
  })

  it('en montre 13 et en garde 8 masquées, tous lieux confondus', () => {
    // Révélation progressive : la famille ouvre le vocabulaire à son rythme, sans
    // qu'une seule case déjà connue change de place.
    expect(TOUTES_LES_CASES.filter((c) => c.hidden)).toHaveLength(8)
    expect(posees.filter((id) => !caseParIdentifiant(PLANCHE_DEMO, id)!.hidden)).toHaveLength(13)
  })

  it('réserve dès maintenant l emplacement des cases masquées de cette planche', () => {
    // Les créer au moment de la révélation recomposerait la grille et détruirait la
    // mémoire du geste. Les cinq autres masquées relèvent de la barre des mots
    // essentiels et du contexte Extérieur : leur place n'est pas ici.
    expect(posees.filter((id) => caseParIdentifiant(PLANCHE_DEMO, id)!.hidden)).toEqual([
      'loki',
      'venum',
      'pipi',
    ])
    // les coordonnées elles-mêmes : groupées en fin de matrice pour que le vide tombe en bas
    expect(PLANCHE_DEMO.grid.order[2]).toEqual(['voiture', 'tablette', 'promenade', 'loki'])
    expect(PLANCHE_DEMO.grid.order[3]).toEqual(['oui', 'non', 'venum', 'pipi'])
  })

  it('ne place que des identifiants qui existent', () => {
    const identifiants = new Set(PLANCHE_DEMO.buttons.map((c) => c.id))
    for (const id of posees) expect(identifiants.has(id)).toBe(true)
  })

  it('ne place jamais deux fois la même case', () => {
    expect(new Set(posees).size).toBe(posees.length)
  })

  it('déclare une grille cohérente avec sa matrice', () => {
    expect(PLANCHE_DEMO.grid.order).toHaveLength(PLANCHE_DEMO.grid.rows)
    for (const ligne of PLANCHE_DEMO.grid.order) {
      expect(ligne).toHaveLength(PLANCHE_DEMO.grid.columns)
    }
  })

  it('aucun libellé ne commence par un article, qui ne dit rien à qui ne lit pas', () => {
    // « LE DOCTEUR » se lisait « LE » dans la bande, le mot utile étant coupé. L'article
    // coûte de la place et n'apporte rien à l'enfant.
    for (const c of TOUTES_LES_CASES) {
      expect(c.label, `${c.label} commence par un article`).not.toMatch(/^(LE|LA|LES|UN|UNE|L')\b/)
    }
  })

  it('aucun libellé ne dépasse ce que l éditeur autorise, ni ce que la bande affiche', () => {
    // « JE ME SUIS COGNÉ » sortait de sa bande, tronqué net : la graine doit tenir la même
    // limite que celle imposée au parent dans l'éditeur
    for (const c of TOUTES_LES_CASES) {
      expect(c.label.length, `${c.label} trop long`).toBeLessThanOrEqual(14)
    }
  })

  it('donne à chaque case une phrase à prononcer, et un son sauf pour la douleur', () => {
    for (const c of TOUTES_LES_CASES) {
      expect(c.vocalization.length, `${c.label} sans phrase`).toBeGreaterThan(0)
      // les mots de la douleur attendent leurs enregistrements : d'ici là la tablette lit
      // leur texte, et la case n'est donc jamais muette
      if (c.id.startsWith('mal-')) continue
      expect(c.sound_id, `${c.label} sans son`).toBeDefined()
    }
  })

  it('donne à chaque case un mot d enchaînement, pour ne pas tout ressaisir plus tard', () => {
    for (const c of TOUTES_LES_CASES) {
      expect(c.ext_mesmots_enchaine, `${c.label} sans mot d enchaînement`).toBeDefined()
    }
  })
})

/** Une planche de la configuration par son identifiant, pages et barre confondues. */
function plancheDe(configuration: Configuration, idPlanche: string): Planche {
  return toutesLesPlanches(configuration).find((p) => p.id === idPlanche)!
}

describe('basculerVisibilite', () => {
  const premierePage: Planche = {
    format: 'open-board-0.1',
    id: 'maison',
    locale: 'fr',
    name: 'Maison',
    grid: { rows: 1, columns: 2, order: [['a', 'b']] },
    buttons: [
      { id: 'a', label: 'A', vocalization: 'a' },
      { id: 'b', label: 'B', vocalization: 'b', hidden: true },
    ],
  }
  const secondePage: Planche = {
    format: 'open-board-0.1',
    id: 'maison-p2',
    locale: 'fr',
    name: 'Maison, page 2',
    grid: { rows: 1, columns: 1, order: [['c']] },
    buttons: [{ id: 'c', label: 'C', vocalization: 'c', hidden: true }],
  }
  const barre: Planche = {
    format: 'open-board-0.1',
    id: 'barre',
    locale: 'fr',
    name: 'Barre',
    grid: { rows: 1, columns: 1, order: [['x']] },
    buttons: [{ id: 'x', label: 'X', vocalization: 'x', hidden: true }],
  }
  const configuration: Configuration = {
    format: 'open-board-0.1',
    contextes: [{ id: 'maison', name: 'Maison', pages: [premierePage, secondePage] }],
    barre,
    reglages: { retourAutomatique: true, modifieDepuisSauvegarde: false, volume: 70, fermeteAppui: 'normal', animations: true, enchainement: false, corpsAToucher: true },
  }

  it('inverse hidden sur une case masquée', () => {
    const apres = basculerVisibilite(configuration, 'maison', 'b')
    expect(caseParIdentifiant(plancheDe(apres, 'maison'), 'b')?.hidden).toBe(false)
  })

  it('écrit hidden: true quand il était absent, jamais un champ ambigu', () => {
    const apres = basculerVisibilite(configuration, 'maison', 'a')
    expect(caseParIdentifiant(plancheDe(apres, 'maison'), 'a')?.hidden).toBe(true)
  })

  it('trouve une case sur la deuxième page d un contexte', () => {
    const apres = basculerVisibilite(configuration, 'maison-p2', 'c')
    expect(caseParIdentifiant(plancheDe(apres, 'maison-p2'), 'c')?.hidden).toBe(false)
    // la première page n'a pas bougé pour autant
    expect(plancheDe(apres, 'maison').buttons).toEqual(premierePage.buttons)
  })

  it('fonctionne sur la barre des mots essentiels', () => {
    const apres = basculerVisibilite(configuration, 'barre', 'x')
    expect(caseParIdentifiant(apres.barre, 'x')?.hidden).toBe(false)
  })

  it('rend la configuration inchangée sur un identifiant de planche inconnu', () => {
    expect(basculerVisibilite(configuration, 'inconnue', 'a')).toBe(configuration)
  })

  it('rend la configuration inchangée sur un identifiant de case inconnu', () => {
    expect(basculerVisibilite(configuration, 'maison', 'inconnue')).toBe(configuration)
  })

  it('ne touche jamais grid.order ni l ordre de buttons, sur toute la configuration réelle', () => {
    // l'invariant du projet, vérifié case par case sur les 21 cases de la planche livrée
    for (const source of toutesLesPlanches(CONFIGURATION_DEMO)) {
      for (const id of source.buttons.map((c) => c.id)) {
        const apres = basculerVisibilite(CONFIGURATION_DEMO, source.id, id)
        const memePlanche = plancheDe(apres, source.id)

        expect(memePlanche.grid.order, `${source.id}/${id} a recomposé grid.order`).toEqual(
          source.grid.order,
        )
        expect(
          memePlanche.buttons.map((c) => c.id),
          `${source.id}/${id} a réordonné buttons`,
        ).toEqual(source.buttons.map((c) => c.id))
      }
    }
  })
})

const CHAMPS_TEST: ChampsModifiables = {
  label: 'JOUER',
  vocalization: 'Je veux jouer',
  ext_mesmots_enchaine: 'jouer',
  background_color: '#ffd25e',
  border_color: '#ffc93c',
}

describe('modifierCase', () => {
  it('change les champs visés', () => {
    const apres = modifierCase(CONFIGURATION_DEMO, 'maison', 'maman', CHAMPS_TEST)
    expect(caseParIdentifiant(plancheDe(apres, 'maison'), 'maman')).toMatchObject(CHAMPS_TEST)
  })

  it('ne touche ni id, ni sound_id, ni image_id, ni hidden', () => {
    const avant = caseParIdentifiant(PLANCHE_DEMO, 'douche')!
    const apres = caseParIdentifiant(
      plancheDe(modifierCase(CONFIGURATION_DEMO, 'maison', 'douche', CHAMPS_TEST), 'maison'),
      'douche',
    )!
    expect(apres.id).toBe(avant.id)
    expect(apres.sound_id).toBe(avant.sound_id)
    expect(apres.image_id).toBe(avant.image_id)
    expect(apres.hidden).toBe(avant.hidden)
  })

  it('ne recompose grid.order sur aucune planche, sur toute la configuration réelle', () => {
    for (const source of toutesLesPlanches(CONFIGURATION_DEMO)) {
      if (source.buttons.length === 0) continue
      const apres = modifierCase(CONFIGURATION_DEMO, source.id, source.buttons[0]!.id, CHAMPS_TEST)
      const memePlanche = plancheDe(apres, source.id)
      expect(memePlanche.grid.order, `${source.id} a recomposé grid.order`).toEqual(
        source.grid.order,
      )
      expect(
        memePlanche.buttons.map((c) => c.id),
        `${source.id} a réordonné buttons`,
      ).toEqual(source.buttons.map((c) => c.id))
    }
  })

  it('rend la configuration inchangée sur une planche inconnue', () => {
    expect(modifierCase(CONFIGURATION_DEMO, 'inconnue', 'maman', CHAMPS_TEST)).toBe(
      CONFIGURATION_DEMO,
    )
  })

  it('rend la configuration inchangée sur une case inconnue', () => {
    expect(modifierCase(CONFIGURATION_DEMO, 'maison', 'inconnue', CHAMPS_TEST)).toBe(
      CONFIGURATION_DEMO,
    )
  })
})

describe('appliquerMediaChoisi (P4, P8)', () => {
  it('inchange rend la configuration telle quelle', () => {
    expect(appliquerMediaChoisi(CONFIGURATION_DEMO, 'maison', 'maman', 'image_id', { statut: 'inchange' })).toBe(
      CONFIGURATION_DEMO,
    )
  })

  it('nouveau pose la référence personnalisée perso/<idCase>', () => {
    const apres = appliquerMediaChoisi(CONFIGURATION_DEMO, 'maison', 'maman', 'image_id', {
      statut: 'nouveau',
      blob: new Blob(['photo']),
    })
    expect(caseParIdentifiant(plancheDe(apres, 'maison'), 'maman')?.image_id).toBe('perso/maman')
  })

  it('aucun ne rappelle pas le fichier livré, même sur un mot de la graine', () => {
    // Un fichier livré avec l'application n'est pas un état par défaut où l'on reviendrait :
    // c'est un média posé d'avance, que le parent remplace comme n'importe quel autre.
    const apres = appliquerMediaChoisi(CONFIGURATION_DEMO, 'maison', 'maman', 'image_id', { statut: 'aucun' })
    expect(caseParIdentifiant(plancheDe(apres, 'maison'), 'maman')?.image_id).toBeUndefined()
  })

  it('aucun laisse la case sans son, pour que la tablette lise le texte', () => {
    // distinct de `retire`, qui rendrait la parole au MP3 livré : c'est ainsi qu'un parent
    // remplace la voix d'origine par le texte qu'il vient d'écrire
    const apres = appliquerMediaChoisi(CONFIGURATION_DEMO, 'maison', 'maman', 'sound_id', { statut: 'aucun' })
    expect(caseParIdentifiant(plancheDe(apres, 'maison'), 'maman')?.sound_id).toBeUndefined()
  })

  it('ne touche jamais les autres champs de la case', () => {
    const avant = caseParIdentifiant(PLANCHE_DEMO, 'maman')!
    const apres = caseParIdentifiant(
      plancheDe(
        appliquerMediaChoisi(CONFIGURATION_DEMO, 'maison', 'maman', 'image_id', {
          statut: 'nouveau',
          blob: new Blob(['photo']),
        }),
        'maison',
      ),
      'maman',
    )!
    expect(apres.label).toBe(avant.label)
    expect(apres.vocalization).toBe(avant.vocalization)
    expect(apres.sound_id).toBe(avant.sound_id)
    expect(apres.hidden).toBe(avant.hidden)
  })

  it('rend la configuration inchangée sur une planche ou une case inconnue', () => {
    const choix = { statut: 'nouveau', blob: new Blob(['photo']) } as const
    expect(appliquerMediaChoisi(CONFIGURATION_DEMO, 'inconnue', 'maman', 'image_id', choix)).toBe(CONFIGURATION_DEMO)
    expect(appliquerMediaChoisi(CONFIGURATION_DEMO, 'maison', 'inconnue', 'image_id', choix)).toBe(CONFIGURATION_DEMO)
  })
})

describe('voixDeCase', () => {
  const MAMAN = caseParIdentifiant(PLANCHE_DEMO, 'maman')!

  it('joue le MP3 livré quand la case le porte', () => {
    expect(voixDeCase(MAMAN)).toEqual({ genre: 'livre', idSon: 'maman' })
  })

  it('joue la voix de la famille quand elle a été enregistrée', () => {
    expect(voixDeCase({ ...MAMAN, sound_id: 'perso/maman' })).toEqual({ genre: 'perso', idSon: 'maman' })
  })

  it('lit le texte quand la case n a aucun son', () => {
    expect(voixDeCase({ ...MAMAN, sound_id: undefined, vocalization: "C'est moi l'enfant" })).toEqual({
      genre: 'synthese',
      texte: "C'est moi l'enfant",
    })
  })

  it('ne devine jamais qu un enregistrement ne dit plus le texte affiché', () => {
    // on ne sait pas ce que dit un MP3 : changer le texte ne fait pas taire la voix, et
    // l'éditeur prévient le parent plutôt que l'application ne décide à sa place
    expect(voixDeCase({ ...MAMAN, vocalization: 'Je veux ma maman chérie' })).toEqual({
      genre: 'livre',
      idSon: 'maman',
    })
  })
})

describe('ajouterCase', () => {
  it('place le nouvel identifiant à la coordonnée visée et l ajoute en fin de buttons', () => {
    const apres = ajouterCase(CONFIGURATION_DEMO, 'exterieur', 0, 2, CHAMPS_TEST)
    const exterieur = plancheDe(apres, 'exterieur')
    expect(exterieur.grid.order[0]![2]).toBe('jouer')
    expect(exterieur.buttons.at(-1)).toMatchObject({ id: 'jouer', ...CHAMPS_TEST, hidden: false })
  })

  it('crée une case révélée, sans sound_id ni image_id', () => {
    const exterieur = plancheDe(ajouterCase(CONFIGURATION_DEMO, 'exterieur', 0, 2, CHAMPS_TEST), 'exterieur')
    const nouvelle = caseParIdentifiant(exterieur, 'jouer')!
    expect(nouvelle.hidden).toBe(false)
    expect(nouvelle.sound_id).toBeUndefined()
    expect(nouvelle.image_id).toBeUndefined()
  })

  it('refuse un emplacement déjà occupé et rend la configuration inchangée', () => {
    expect(ajouterCase(CONFIGURATION_DEMO, 'exterieur', 0, 0, CHAMPS_TEST)).toBe(CONFIGURATION_DEMO)
  })

  it('ne change aucun autre emplacement de grid.order', () => {
    const exterieur = plancheDe(ajouterCase(CONFIGURATION_DEMO, 'exterieur', 0, 2, CHAMPS_TEST), 'exterieur')
    const attendu = PLANCHE_EXTERIEUR.grid.order.map((ligne) => [...ligne])
    attendu[0]![2] = 'jouer'
    expect(exterieur.grid.order).toEqual(attendu)
  })

  it('rend la configuration inchangée sur une planche inconnue', () => {
    expect(ajouterCase(CONFIGURATION_DEMO, 'inconnue', 0, 0, CHAMPS_TEST)).toBe(CONFIGURATION_DEMO)
  })
})

describe('supprimerCase', () => {
  it('retire la case de buttons et remet null à sa coordonnée', () => {
    const maison = plancheDe(supprimerCase(CONFIGURATION_DEMO, 'maison', 'chambre'), 'maison')
    expect(caseParIdentifiant(maison, 'chambre')).toBeUndefined()
    expect(maison.grid.order[1]![3]).toBeNull()
  })

  it('ne change aucun autre emplacement', () => {
    const maison = plancheDe(supprimerCase(CONFIGURATION_DEMO, 'maison', 'chambre'), 'maison')
    const attendu = PLANCHE_DEMO.grid.order.map((ligne) => [...ligne])
    attendu[1]![3] = null
    expect(maison.grid.order).toEqual(attendu)
  })

  it('rend la configuration inchangée sur une planche inconnue', () => {
    expect(supprimerCase(CONFIGURATION_DEMO, 'inconnue', 'chambre')).toBe(CONFIGURATION_DEMO)
  })

  it('rend la configuration inchangée sur une case inconnue', () => {
    expect(supprimerCase(CONFIGURATION_DEMO, 'maison', 'inconnue')).toBe(CONFIGURATION_DEMO)
  })
})

describe('restaurerCase', () => {
  it('remet la case complète, sound_id et image_id compris, à sa position d origine', () => {
    const chambre = caseParIdentifiant(PLANCHE_DEMO, 'chambre')!
    const apresSuppression = supprimerCase(CONFIGURATION_DEMO, 'maison', 'chambre')
    const restauree = restaurerCase(apresSuppression, 'maison', 1, 3, chambre)
    const maison = plancheDe(restauree, 'maison')
    expect(maison.grid.order[1]![3]).toBe('chambre')
    expect(caseParIdentifiant(maison, 'chambre')).toEqual(chambre)
  })

  it('refuse un emplacement occupé', () => {
    const chambre = caseParIdentifiant(PLANCHE_DEMO, 'chambre')!
    expect(restaurerCase(CONFIGURATION_DEMO, 'maison', 1, 3, chambre)).toBe(CONFIGURATION_DEMO)
  })
})

describe('les éditions adressent une planche par son identifiant, où qu elle vive', () => {
  // Ce qui limite l'onde de choc du passage aux pages : la signature publique n'a pas
  // changé, mais la recherche doit désormais descendre dans les pages de chaque contexte.
  // La seed ne porte plus de deuxième page depuis que les pages se créent à la demande
  // (ajouterCaseSurNouvellePage) : ces tests construisent donc leur propre page 2.
  const pageDeux: Planche = {
    format: 'open-board-0.1',
    id: 'maison-p2',
    locale: 'fr',
    name: 'Maison',
    grid: { rows: 4, columns: 4, order: [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]] },
    buttons: [],
  }
  const configurationDeuxPages: Configuration = {
    ...CONFIGURATION_DEMO,
    contextes: CONFIGURATION_DEMO.contextes.map((c) =>
      c.id === 'maison' ? { ...c, pages: [...c.pages, pageDeux] } : c,
    ),
  }

  it('ajoute un mot sur la deuxième page de Maison, sans toucher la première', () => {
    const apres = ajouterCase(configurationDeuxPages, 'maison-p2', 0, 0, CHAMPS_TEST)
    expect(plancheDe(apres, 'maison-p2').grid.order[0]![0]).toBe('jouer')
    expect(plancheDe(apres, 'maison').grid.order).toEqual(PLANCHE_DEMO.grid.order)
  })

  it('modifie un mot de la barre des mots essentiels', () => {
    const apres = modifierCase(CONFIGURATION_DEMO, 'barre', 'aide', CHAMPS_TEST)
    expect(caseParIdentifiant(apres.barre, 'aide')).toMatchObject(CHAMPS_TEST)
  })

  it('supprime puis restaure un mot de la barre à sa position', () => {
    const aide = caseParIdentifiant(CONFIGURATION_DEMO.barre, 'aide')!
    const apresSuppression = supprimerCase(CONFIGURATION_DEMO, 'barre', 'aide')
    expect(apresSuppression.barre.grid.order[0]![0]).toBeNull()

    const restauree = restaurerCase(apresSuppression, 'barre', 0, 0, aide)
    expect(restauree.barre.grid.order[0]![0]).toBe('aide')
    expect(caseParIdentifiant(restauree.barre, 'aide')).toEqual(aide)
  })

  it('supprime un mot sur la deuxième page sans rien changer ailleurs', () => {
    const avecJouer = ajouterCase(configurationDeuxPages, 'maison-p2', 1, 2, CHAMPS_TEST)
    const apres = supprimerCase(avecJouer, 'maison-p2', 'jouer')
    expect(plancheDe(apres, 'maison-p2').grid.order).toEqual(pageDeux.grid.order)
    expect(plancheDe(apres, 'maison').grid.order).toEqual(PLANCHE_DEMO.grid.order)
    expect(apres.barre.grid.order).toEqual(CONFIGURATION_DEMO.barre.grid.order)
  })

  it('garde les réglages intacts au passage', () => {
    const apres = ajouterCase(configurationDeuxPages, 'maison-p2', 0, 0, CHAMPS_TEST)
    expect(apres.reglages).toEqual(CONFIGURATION_DEMO.reglages)
  })

  it('voit une collision d identifiant sur n importe quelle page', () => {
    const avecJouer = ajouterCase(configurationDeuxPages, 'maison-p2', 0, 0, CHAMPS_TEST)
    expect(identifiantDepuisMot('Jouer', avecJouer)).toBe('jouer-2')
  })
})

describe('ajouterCaseSurNouvellePage', () => {
  it('ajoute une page en fin de liste, avec la géométrie de la première page du contexte', () => {
    const apres = ajouterCaseSurNouvellePage(CONFIGURATION_DEMO, 'maison', 0, 0, CHAMPS_TEST)
    const maison = apres.contextes.find((c) => c.id === 'maison')!
    expect(maison.pages.map((p) => p.id)).toEqual(['maison', 'maison-p2'])
    const nouvelle = maison.pages[1]!
    expect(nouvelle.grid.rows).toBe(PLANCHE_DEMO.grid.rows)
    expect(nouvelle.grid.columns).toBe(PLANCHE_DEMO.grid.columns)
  })

  it('y pose la case à la position demandée, seule case de la nouvelle page', () => {
    const apres = ajouterCaseSurNouvellePage(CONFIGURATION_DEMO, 'maison', 1, 2, CHAMPS_TEST)
    const nouvelle = apres.contextes.find((c) => c.id === 'maison')!.pages[1]!
    expect(nouvelle.grid.order[1]![2]).toBe('jouer')
    expect(nouvelle.buttons).toEqual([{ id: 'jouer', ...CHAMPS_TEST, hidden: false }])
  })

  it('donne un identifiant qui n est jamais déjà pris', () => {
    const uneFois = ajouterCaseSurNouvellePage(CONFIGURATION_DEMO, 'maison', 0, 0, CHAMPS_TEST)
    const deuxFois = ajouterCaseSurNouvellePage(uneFois, 'maison', 0, 1, {
      ...CHAMPS_TEST,
      label: 'REJOUER',
    })
    expect(deuxFois.contextes.find((c) => c.id === 'maison')!.pages.map((p) => p.id)).toEqual([
      'maison',
      'maison-p2',
      'maison-p3',
    ])
  })

  it('ne modifie aucune page existante, grid.order compris', () => {
    const avant = toutesLesPlanches(CONFIGURATION_DEMO).map((p) => ({ id: p.id, order: p.grid.order }))
    const apres = ajouterCaseSurNouvellePage(CONFIGURATION_DEMO, 'maison', 0, 0, CHAMPS_TEST)
    for (const { id, order } of avant) {
      expect(plancheDe(apres, id).grid.order, `${id} a changé`).toEqual(order)
    }
  })

  it('rend la configuration inchangée sur un contexte inconnu', () => {
    expect(ajouterCaseSurNouvellePage(CONFIGURATION_DEMO, 'inconnu', 0, 0, CHAMPS_TEST)).toBe(
      CONFIGURATION_DEMO,
    )
  })

  it('rend la configuration inchangée hors de la grille', () => {
    expect(ajouterCaseSurNouvellePage(CONFIGURATION_DEMO, 'maison', -1, 0, CHAMPS_TEST)).toBe(
      CONFIGURATION_DEMO,
    )
    expect(ajouterCaseSurNouvellePage(CONFIGURATION_DEMO, 'maison', 0, 4, CHAMPS_TEST)).toBe(
      CONFIGURATION_DEMO,
    )
  })
})

describe('nouvellePageAtteignable', () => {
  it('offre une nouvelle page quand la dernière page réelle porte une case révélée', () => {
    const contexte: Contexte = { id: 'c', name: 'C', pages: [pageDe('p', 'revelee')] }
    expect(nouvellePageAtteignable(contexte)).toBe(true)
  })

  it('refuse d enchaîner deux pages vides', () => {
    const contexte: Contexte = {
      id: 'c',
      name: 'C',
      pages: [pageDe('p1', 'revelee'), pageDe('p2', 'vide')],
    }
    expect(nouvellePageAtteignable(contexte)).toBe(false)
  })
})

describe('identifiantDepuisMot', () => {
  it('met en minuscules et retire les accents', () => {
    expect(identifiantDepuisMot('Crème brûlée', CONFIGURATION_DEMO)).toBe('creme-brulee')
  })

  it('remplace espaces et ponctuation par un tiret', () => {
    expect(identifiantDepuisMot("Aide-moi, s'il te plaît !", CONFIGURATION_DEMO)).toBe(
      'aide-moi-s-il-te-plait',
    )
  })

  it('ajoute un suffixe numérique en cas de collision avec une case de la grille', () => {
    expect(identifiantDepuisMot('Maman', CONFIGURATION_DEMO)).toBe('maman-2')
  })

  it('détecte une collision avec une case de la barre des mots essentiels', () => {
    expect(identifiantDepuisMot('Aide', CONFIGURATION_DEMO)).toBe('aide-2')
  })

  it('ne rend jamais un identifiant vide, même sur un mot de pure ponctuation', () => {
    // un identifiant vide rendrait la case inadressable, et les noms de fichiers de P4 et
    // P8 avec elle. Le formulaire laisse passer « !!! » : non vide et sous 14 caractères.
    expect(identifiantDepuisMot('!!!', CONFIGURATION_DEMO)).toBe('case')
    expect(identifiantDepuisMot('???', CONFIGURATION_DEMO)).toBe('case')
  })
})

describe('marquerModifiee et marquerSauvegardee (B4)', () => {
  it('lève le drapeau sans toucher au reste de la configuration', () => {
    const apres = marquerModifiee(CONFIGURATION_DEMO)

    expect(apres.reglages.modifieDepuisSauvegarde).toBe(true)
    expect(apres.contextes).toBe(CONFIGURATION_DEMO.contextes)
    expect(apres.reglages.retourAutomatique).toBe(CONFIGURATION_DEMO.reglages.retourAutomatique)
  })

  it('baisse le drapeau sans toucher au reste de la configuration', () => {
    const modifiee = marquerModifiee(CONFIGURATION_DEMO)

    const apres = marquerSauvegardee(modifiee)

    expect(apres.reglages.modifieDepuisSauvegarde).toBe(false)
    expect(apres.contextes).toBe(modifiee.contextes)
  })
})

describe('identifiantPersonnalise (P4, P8)', () => {
  it("rend l identifiant de case porté par une référence perso/", () => {
    expect(identifiantPersonnalise('perso/maman')).toBe('maman')
  })

  it("rend undefined pour une ressource livrée avec l application", () => {
    expect(identifiantPersonnalise('pictos/maman.svg')).toBeUndefined()
    expect(identifiantPersonnalise('maman')).toBeUndefined()
  })

  it('rend undefined quand il n y a pas de référence du tout', () => {
    expect(identifiantPersonnalise(undefined)).toBeUndefined()
  })
})

describe('identifiantsPersonnalises', () => {
  it('ne retient que les références de la famille, sans doublon, par magasin', () => {
    // Sert à repérer ce qui n'est plus référencé après une restauration : sans ça les
    // photos et sons de l'ancienne configuration restaient pour toujours dans la base.
    const avecMedias: Configuration = {
      ...CONFIGURATION_DEMO,
      contextes: CONFIGURATION_DEMO.contextes.map((contexte) =>
        contexte.id !== 'maison'
          ? contexte
          : {
              ...contexte,
              pages: contexte.pages.map((page) => ({
                ...page,
                buttons: page.buttons.map((c) =>
                  c.id === 'maman'
                    ? { ...c, image_id: 'perso/maman', sound_id: 'perso/maman' }
                    : c.id === 'papa'
                      ? { ...c, image_id: 'perso/papa' }
                      : c,
                ),
              })),
            },
      ),
    }

    const { images, sons } = identifiantsPersonnalises(avecMedias)

    expect([...images].sort()).toEqual(['maman', 'papa'])
    expect(sons).toEqual(['maman'])
  })

  it('ne retient rien sur la configuration livrée, qui n a aucun média de famille', () => {
    expect(identifiantsPersonnalises(CONFIGURATION_DEMO)).toEqual({ images: [], sons: [] })
  })

  it('compte l image d un bouton de contexte, sinon le balayage l effacerait', () => {
    // Le balayage des orphelins efface au démarrage tout blob que cette liste ne nomme pas :
    // sans les contextes, la photo choisie pour un bouton disparaissait au redémarrage.
    const avecImage = changerImageDeContexte(CONFIGURATION_DEMO, 'maison', 'perso/contexte-maison')

    expect(identifiantsPersonnalises(avecImage).images).toEqual(['contexte-maison'])
  })
})

describe('aucun mot livré ne laisse l enfant devant un mot écrit', () => {
  it('OUI et NON portent enfin leur coche et leur croix', () => {
    // le cahier des charges les promet en annexe A. Sans image, deux des cases les plus
    // utilisées ne montraient qu'un mot écrit à un enfant qui ne lit pas.
    const cases = toutesLesPlanches(CONFIGURATION_DEMO).flatMap((planche) => planche.buttons)
    const parId = (id: string) => cases.find((contenu) => contenu.id === id)!

    expect(parId('oui').image_id).toBe('pictos/oui.svg')
    expect(parId('non').image_id).toBe('pictos/non.svg')
  })

  it('dit lesquels attendent encore une image, pour que le compte se voie', () => {
    // MOI, LOKI et VENUM attendent une photo de la famille : un pictogramme générique
    // servirait moins bien qu'un visage connu. Ce test tombe le jour où elles arrivent.
    const sansImage = toutesLesPlanches(CONFIGURATION_DEMO)
      .flatMap((planche) => planche.buttons)
      .filter((contenu) => !contenu.image_id)
      .map((contenu) => contenu.id)

    expect(sansImage.sort()).toEqual(['loki', 'moi', 'venum'])
  })
})

describe('changerImageDeContexte', () => {
  it('pose l image du bouton sans toucher au nom, aux pages ni à un seul mot', () => {
    const apres = changerImageDeContexte(CONFIGURATION_DEMO, 'maison', 'perso/contexte-maison')

    const maison = apres.contextes.find((c) => c.id === 'maison')!
    expect(maison.ext_mesmots_image).toBe('perso/contexte-maison')
    expect(maison.name).toBe('Maison')
    expect(maison.pages).toEqual(CONFIGURATION_DEMO.contextes.find((c) => c.id === 'maison')!.pages)
    expect(apres.contextes.filter((c) => c.id !== 'maison')).toEqual(
      CONFIGURATION_DEMO.contextes.filter((c) => c.id !== 'maison'),
    )
  })

  it('remplace une image déjà posée, celle des contextes livrés comprise', () => {
    const livree = CONFIGURATION_DEMO.contextes.find((c) => c.id === 'maison')!.ext_mesmots_image
    expect(livree).toBeTruthy()

    const apres = changerImageDeContexte(CONFIGURATION_DEMO, 'maison', 'perso/contexte-maison')

    expect(apres.contextes.find((c) => c.id === 'maison')!.ext_mesmots_image).toBe('perso/contexte-maison')
  })

  it('ne touche à rien pour un contexte inconnu', () => {
    expect(changerImageDeContexte(CONFIGURATION_DEMO, 'jardin', 'perso/x')).toBe(CONFIGURATION_DEMO)
  })

  it('donne une clé de magasin distincte de celle d une case', () => {
    // les deux vivent dans le même magasin d'images : une collision écraserait une photo
    expect(imagePersonnaliseeDeContexte('maison')).toBe('perso/contexte-maison')
  })
})


describe('placerCaseALaPosition refuse un identifiant déjà pris, où qu il soit', () => {
  it('ne restaure pas une case dont l identifiant a été repris par un mot recréé ailleurs', () => {
    // Supprimer BOIRE, recréer « Boire » sur une autre planche, puis annuler la suppression
    // donnait deux cases sous le même identifiant, donc la même photo et la même voix pour
    // deux mots sans rapport. Trouvé par la revue en aveugle, reproduit ici.
    const ancienne = caseParIdentifiant(PLANCHE_DEMO, 'boire')!
    const sansBoire = supprimerCase(CONFIGURATION_DEMO, 'maison', 'boire')
    const recreee = ajouterCase(sansBoire, 'exterieur', 1, 0, {
      label: 'Boire', vocalization: 'Je veux boire', ext_mesmots_enchaine: 'boire',
      background_color: '#ffd25e', border_color: '#ffc93c',
    })
    expect(caseParIdentifiant(plancheDe(recreee, 'exterieur'), 'boire')).toBeDefined()

    const tentative = restaurerCase(recreee, 'maison', 1, 0, ancienne)

    expect(tentative).toBe(recreee)
    const occurrences = toutesLesPlanches(tentative).flatMap((p) => p.buttons).filter((c) => c.id === 'boire')
    expect(occurrences).toHaveLength(1)
  })
})

describe('sonLivre ne désigne que le vocabulaire livré', () => {
  it('rend l identifiant pour un mot de la graine, rien pour un mot de la famille', () => {
    // Un mot créé par la famille n'a aucun MP3 livré : lui fabriquer une référence vers un
    // fichier absent le rendait muet sans que le rappel « pas de voix » se déclenche.
    expect(sonLivre('maman')).toBe('maman')
    expect(sonLivre('ballon-de-la-famille')).toBeUndefined()
  })

  it('retirer la voix d un mot de la famille ne laisse aucune référence derrière', () => {
    const avecVoix: Configuration = ajouterCase(CONFIGURATION_DEMO, 'exterieur', 1, 0, {
      label: 'Ballon', vocalization: 'Je veux le ballon', ext_mesmots_enchaine: 'ballon',
      background_color: '#a9e18e', border_color: '#6fcf4c',
    })
    const enregistree = appliquerMediaChoisi(avecVoix, 'exterieur', 'ballon', 'sound_id', { statut: 'nouveau', blob: new Blob(['s']) })
    expect(caseParIdentifiant(plancheDe(enregistree, 'exterieur'), 'ballon')!.sound_id).toBe('perso/ballon')

    const retiree = appliquerMediaChoisi(enregistree, 'exterieur', 'ballon', 'sound_id', { statut: 'aucun' })
    expect(caseParIdentifiant(plancheDe(retiree, 'exterieur'), 'ballon')!.sound_id).toBeUndefined()
  })
})


describe('imagePictogrammeLivre ne désigne que les pictogrammes livrés', () => {
  it('rend le pictogramme de la graine, rien pour un mot sans pictogramme ni pour la famille', () => {
    // Sert au repli d'une restauration : une archive dont la photo manque retombe sur le
    // pictogramme livré plutôt que sur une case vide.
    expect(imagePictogrammeLivre('maman')).toBe('pictos/maman.svg')
    expect(imagePictogrammeLivre('moi')).toBeUndefined()
    expect(imagePictogrammeLivre('ballon-de-la-famille')).toBeUndefined()
  })

  it('retirer la photo d un mot de la famille ne laisse aucune référence derrière', () => {
    const avecMot: Configuration = ajouterCase(CONFIGURATION_DEMO, 'exterieur', 1, 0, {
      label: 'Ballon', vocalization: 'Je veux le ballon', ext_mesmots_enchaine: 'ballon',
      background_color: '#a9e18e', border_color: '#6fcf4c',
    })
    const avecPhoto = appliquerMediaChoisi(avecMot, 'exterieur', 'ballon', 'image_id', { statut: 'nouveau', blob: new Blob(['p']) })
    const retiree = appliquerMediaChoisi(avecPhoto, 'exterieur', 'ballon', 'image_id', { statut: 'aucun' })

    expect(caseParIdentifiant(plancheDe(retiree, 'exterieur'), 'ballon')!.image_id).toBeUndefined()
  })
})

describe('deplacerCase (P6)', () => {
  // La planche de démonstration est pleine : on libère une place comme le parent le ferait,
  // en supprimant un mot, sinon il n'y a nulle part où déplacer quoi que ce soit.
  const PLANCHE = CONFIGURATION_DEMO.contextes[0]!.pages[0]!
  const BASE = supprimerCase(CONFIGURATION_DEMO, PLANCHE.id, 'pipi')
  const grilleDe = (configuration: Configuration) => configuration.contextes[0]!.pages[0]!.grid.order
  const position = (configuration: Configuration, idCase: string) => {
    for (const [ligne, rangee] of grilleDe(configuration).entries()) {
      const colonne = rangee.indexOf(idCase)
      if (colonne !== -1) return { ligne, colonne }
    }
    return null
  }
  const LIBRE = (() => {
    for (const [ligne, rangee] of grilleDe(BASE).entries()) {
      const colonne = rangee.indexOf(null)
      if (colonne !== -1) return { ligne, colonne }
    }
    throw new Error('aucun emplacement libre après suppression')
  })()

  it('pose la case à sa nouvelle place et libère l ancienne', () => {
    const avant = position(BASE, 'maman')!

    const apres = deplacerCase(BASE, PLANCHE.id, 'maman', PLANCHE.id, LIBRE.ligne, LIBRE.colonne)

    expect(position(apres, 'maman')).toEqual(LIBRE)
    expect(grilleDe(apres)[avant.ligne]![avant.colonne]).toBeNull()
  })

  it('ne déplace aucune autre case, c est tout l intérêt d une matrice de positions', () => {
    const apres = deplacerCase(BASE, PLANCHE.id, 'maman', PLANCHE.id, LIBRE.ligne, LIBRE.colonne)

    for (const bouton of PLANCHE.buttons) {
      if (bouton.id === 'maman') continue
      expect(position(apres, bouton.id), bouton.id).toEqual(position(BASE, bouton.id))
    }
  })

  it('refuse un emplacement déjà occupé plutôt que d écraser un mot', () => {
    const cible = position(BASE, 'papa')!

    expect(deplacerCase(BASE, PLANCHE.id, 'maman', PLANCHE.id, cible.ligne, cible.colonne)).toBe(BASE)
  })

  it('ne fait rien pour une case ou une planche inconnue', () => {
    expect(deplacerCase(BASE, PLANCHE.id, 'inconnue', PLANCHE.id, LIBRE.ligne, LIBRE.colonne)).toBe(BASE)
    expect(deplacerCase(BASE, 'planche-inconnue', 'maman', PLANCHE.id, LIBRE.ligne, LIBRE.colonne)).toBe(BASE)
  })

  it('garde la case et son contenu intacts', () => {
    const apres = deplacerCase(BASE, PLANCHE.id, 'maman', PLANCHE.id, LIBRE.ligne, LIBRE.colonne)

    const deplacee = apres.contextes[0]!.pages[0]!.buttons.find((b) => b.id === 'maman')
    expect(deplacee).toEqual(PLANCHE.buttons.find((b) => b.id === 'maman'))
  })
})

describe('echangerCases (P6)', () => {
  const PLANCHE = CONFIGURATION_DEMO.contextes[0]!.pages[0]!
  const grille = (configuration: Configuration) => configuration.contextes[0]!.pages[0]!.grid.order
  const position = (configuration: Configuration, idCase: string) => {
    for (const [ligne, rangee] of grille(configuration).entries()) {
      const colonne = rangee.indexOf(idCase)
      if (colonne !== -1) return { ligne, colonne }
    }
    return null
  }

  it('met chacun à la place de l autre', () => {
    const avantMaman = position(CONFIGURATION_DEMO, 'maman')
    const avantPapa = position(CONFIGURATION_DEMO, 'papa')

    const apres = echangerCases(CONFIGURATION_DEMO, PLANCHE.id, 'maman', PLANCHE.id, 'papa')

    expect(position(apres, 'maman')).toEqual(avantPapa)
    expect(position(apres, 'papa')).toEqual(avantMaman)
  })

  it('ne bouge personne d autre', () => {
    const apres = echangerCases(CONFIGURATION_DEMO, PLANCHE.id, 'maman', PLANCHE.id, 'papa')

    for (const bouton of PLANCHE.buttons) {
      if (bouton.id === 'maman' || bouton.id === 'papa') continue
      expect(position(apres, bouton.id), bouton.id).toEqual(position(CONFIGURATION_DEMO, bouton.id))
    }
  })

  it('ne fait rien quand une case est inconnue, ou quand c est la même deux fois', () => {
    expect(echangerCases(CONFIGURATION_DEMO, PLANCHE.id, 'maman', PLANCHE.id, 'inconnue')).toBe(CONFIGURATION_DEMO)
    expect(echangerCases(CONFIGURATION_DEMO, PLANCHE.id, 'maman', PLANCHE.id, 'maman')).toBe(CONFIGURATION_DEMO)
    expect(echangerCases(CONFIGURATION_DEMO, 'planche-inconnue', 'maman', 'planche-inconnue', 'papa')).toBe(CONFIGURATION_DEMO)
  })

  it('garde les deux cases et leur contenu intacts', () => {
    const apres = echangerCases(CONFIGURATION_DEMO, PLANCHE.id, 'maman', PLANCHE.id, 'papa')

    const boutons = apres.contextes[0]!.pages[0]!.buttons
    expect(boutons.find((b) => b.id === 'maman')).toEqual(PLANCHE.buttons.find((b) => b.id === 'maman'))
    expect(boutons.find((b) => b.id === 'papa')).toEqual(PLANCHE.buttons.find((b) => b.id === 'papa'))
  })
})


describe('créer, renommer et supprimer un contexte', () => {
  const nomsDe = (configuration: Configuration) => configuration.contextes.map((c) => c.name)

  it('ajoute le contexte en queue, sans déplacer ceux qui existent', () => {
    const apres = ajouterContexte(CONFIGURATION_DEMO, 'École')

    expect(nomsDe(apres)).toEqual(['Maison', 'Extérieur', "J'ai mal", 'École'])
    expect(apres.contextes.at(-1)!.id).toBe('ecole')
  })

  it('le contexte naît avec une page vide à la géométrie des autres', () => {
    const page = ajouterContexte(CONFIGURATION_DEMO, 'École').contextes.at(-1)!.pages[0]!
    const modele = CONFIGURATION_DEMO.contextes[0]!.pages[0]!

    expect(page.grid.rows).toBe(modele.grid.rows)
    expect(page.grid.columns).toBe(modele.grid.columns)
    expect(page.buttons).toEqual([])
    expect(page.grid.order.flat().every((emplacement) => emplacement === null)).toBe(true)
  })

  it("l'identifiant ne heurte jamais celui d'une planche existante", () => {
    // le contexte et sa première page portent le même identifiant : deux planches sous le
    // même nom rendraient l'une des deux inatteignable. « Barre » est un nom libre pour un
    // contexte, mais `barre` est déjà l'identifiant de la barre des mots essentiels.
    const apres = ajouterContexte(CONFIGURATION_DEMO, 'Barre')

    expect(apres.contextes.at(-1)!.id).toBe('barre-2')
    expect(apres.contextes.at(-1)!.pages[0]!.id).toBe('barre-2')
  })

  it('refuse un nom déjà porté, accent et casse compris (D21)', () => {
    // l'enfant ne lit pas : deux boutons du même nom ouvrent pour lui deux mondes qu'il ne
    // peut pas distinguer, et la mère voit deux lignes identiques dans son sélecteur
    expect(ajouterContexte(CONFIGURATION_DEMO, 'Maison')).toBe(CONFIGURATION_DEMO)
    expect(ajouterContexte(CONFIGURATION_DEMO, '  maison  ')).toBe(CONFIGURATION_DEMO)
    expect(ajouterContexte(CONFIGURATION_DEMO, 'EXTERIEUR')).toBe(CONFIGURATION_DEMO)
  })

  it('renommer refuse le nom d un autre contexte, mais accepte le sien', () => {
    expect(renommerContexte(CONFIGURATION_DEMO, 'maison', 'Extérieur')).toBe(CONFIGURATION_DEMO)
    // corriger sa propre casse est une correction, pas un doublon
    expect(renommerContexte(CONFIGURATION_DEMO, 'maison', 'MAISON').contextes[0]!.name).toBe('MAISON')
  })

  it('refuse un nom vide et le contexte de trop', () => {
    expect(ajouterContexte(CONFIGURATION_DEMO, '   ')).toBe(CONFIGURATION_DEMO)

    let pleine = CONFIGURATION_DEMO
    for (let rang = CONFIGURATION_DEMO.contextes.length; rang < CONTEXTES_MAXIMUM; rang++) {
      pleine = ajouterContexte(pleine, `Contexte ${rang}`)
    }
    expect(pleine.contextes).toHaveLength(CONTEXTES_MAXIMUM)
    // la barre du haut ne tient pas un sixième bouton, et l'écran de l'enfant ne défile pas
    expect(ajouterContexte(pleine, 'De trop')).toBe(pleine)
  })

  it('renommer ne touche ni l identifiant ni les mots', () => {
    const apres = renommerContexte(CONFIGURATION_DEMO, 'maison', 'À la maison')
    const contexte = apres.contextes[0]!

    expect(contexte.name).toBe('À la maison')
    expect(contexte.id).toBe('maison')
    expect(contexte.pages[0]!.buttons).toEqual(CONFIGURATION_DEMO.contextes[0]!.pages[0]!.buttons)
    // le nom de la page n'est qu'une copie du nom du contexte : il suit, sinon la sauvegarde
    // exporte deux noms différents pour la même chose
    expect(contexte.pages[0]!.name).toBe('À la maison')
  })

  it('renommer refuse un nom vide et un contexte inconnu', () => {
    expect(renommerContexte(CONFIGURATION_DEMO, 'maison', '  ')).toBe(CONFIGURATION_DEMO)
    expect(renommerContexte(CONFIGURATION_DEMO, 'inconnu', 'Peu importe')).toBe(CONFIGURATION_DEMO)
  })

  it('supprimer retire le contexte et tout ce qu il porte', () => {
    const apres = supprimerContexte(CONFIGURATION_DEMO, 'exterieur')

    expect(nomsDe(apres)).toEqual(['Maison', "J'ai mal"])
    expect(toutesLesPlanches(apres).some((planche) => planche.id === 'exterieur')).toBe(false)
  })

  it('refuse de supprimer le dernier contexte restant', () => {
    // l'enfant se retrouverait sans un mot, et plus aucune géométrie ne servirait de modèle
    let seule = supprimerContexte(CONFIGURATION_DEMO, 'exterieur')
    seule = supprimerContexte(seule, 'douleur')

    expect(supprimerContexte(seule, 'maison')).toBe(seule)
  })

  it('annuler une suppression remet le contexte à son rang, pas en queue', () => {
    const contexte = CONFIGURATION_DEMO.contextes[0]!
    const sans = supprimerContexte(CONFIGURATION_DEMO, 'maison')

    const apres = restaurerContexte(sans, contexte, 0)

    // en queue, les boutons du haut se seraient déplacés une seconde fois
    expect(nomsDe(apres)).toEqual(['Maison', 'Extérieur', "J'ai mal"])
  })

  it('annuler deux fois ne duplique pas le contexte', () => {
    const contexte = CONFIGURATION_DEMO.contextes[0]!
    const rendu = restaurerContexte(supprimerContexte(CONFIGURATION_DEMO, 'maison'), contexte, 0)

    expect(restaurerContexte(rendu, contexte, 0)).toBe(rendu)
  })

  it('remet le contexte au rang demandé, pas seulement en tête', () => {
    const exterieur = CONFIGURATION_DEMO.contextes[1]!
    const avecJardin = ajouterContexte(supprimerContexte(CONFIGURATION_DEMO, 'exterieur'), 'Jardin')

    const apres = restaurerContexte(avecJardin, exterieur, 1)

    expect(nomsDe(apres)).toEqual(['Maison', 'Extérieur', "J'ai mal", 'Jardin'])
  })

  it('refuse le retour qui ferait un sixième contexte', () => {
    // supprimer puis créer libère la place, et l'annulation la reprenait par-derrière :
    // trois clics suffisaient à dépasser la borne que tout le reste du code défend
    let pleine = CONFIGURATION_DEMO
    while (pleine.contextes.length < CONTEXTES_MAXIMUM) {
      pleine = ajouterContexte(pleine, `Contexte ${pleine.contextes.length}`)
    }
    const contexte = pleine.contextes[0]!
    const remplacee = ajouterContexte(supprimerContexte(pleine, contexte.id), 'Le suivant')

    expect(restaurerContexte(remplacee, contexte, 0)).toBe(remplacee)
  })

  it('refuse le retour quand un mot du contexte a été recréé ailleurs', () => {
    // deux cases sous le même identifiant partageraient la même photo et la même voix, et
    // `caseParIdentifiant` ne rendrait que la première
    const maison = CONFIGURATION_DEMO.contextes[0]!
    const sansMaison = supprimerContexte(CONFIGURATION_DEMO, 'maison')
    const avecMamanAilleurs = ajouterCase(sansMaison, 'exterieur', 0, 2, {
      label: 'MAMAN',
      vocalization: 'Maman',
      ext_mesmots_enchaine: 'maman',
      background_color: '#f7c8c3',
      border_color: '#e8837a',
    })

    expect(restaurerContexte(avecMamanAilleurs, maison, 0)).toBe(avecMamanAilleurs)
  })

  it('refuse le retour quand une page a repris son identifiant', () => {
    const maison = CONFIGURATION_DEMO.contextes[0]!
    const remplacee = ajouterContexte(supprimerContexte(CONFIGURATION_DEMO, 'maison'), 'Maison')

    expect(restaurerContexte(remplacee, maison, 0)).toBe(remplacee)
  })
})


describe('déplacer et échanger d une page à l autre', () => {
  /** Maison à deux pages : la seconde n'existe qu'ici, la graine n'en a qu'une par contexte. */
  const DEUX_PAGES: Configuration = {
    ...CONFIGURATION_DEMO,
    contextes: CONFIGURATION_DEMO.contextes.map((contexte) =>
      contexte.id === 'maison'
        ? { ...contexte, pages: [...contexte.pages, pageVierge(contexte, 'maison-p2')!] }
        : contexte,
    ),
  }
  const pageDe = (configuration: Configuration, id: string) =>
    toutesLesPlanches(configuration).find((planche) => planche.id === id)!

  it('le mot quitte sa page et arrive sur l autre, avec son contenu', () => {
    const apres = deplacerCase(DEUX_PAGES, 'maison', 'maman', 'maison-p2', 0, 0)

    const depart = pageDe(apres, 'maison')
    const arrivee = pageDe(apres, 'maison-p2')
    // il quitte aussi `buttons` : déclaré sans emplacement, il serait invisible et perdu
    expect(depart.buttons.some((c) => c.id === 'maman')).toBe(false)
    expect(depart.grid.order.flat()).not.toContain('maman')
    expect(arrivee.grid.order[0]![0]).toBe('maman')
    expect(caseParIdentifiant(arrivee, 'maman')?.label).toBe('MAMAN')
  })

  it('aucune autre case ne bouge, sur l une comme sur l autre page', () => {
    const apres = deplacerCase(DEUX_PAGES, 'maison', 'maman', 'maison-p2', 0, 0)

    for (const bouton of pageDe(DEUX_PAGES, 'maison').buttons) {
      if (bouton.id === 'maman') continue
      const avant = pageDe(DEUX_PAGES, 'maison').grid.order.flat().indexOf(bouton.id)
      expect(pageDe(apres, 'maison').grid.order.flat().indexOf(bouton.id), bouton.id).toBe(avant)
    }
  })

  it('refuse un emplacement déjà pris sur la page d arrivée', () => {
    const occupe = deplacerCase(DEUX_PAGES, 'maison', 'maman', 'maison-p2', 0, 0)

    expect(deplacerCase(occupe, 'maison', 'papa', 'maison-p2', 0, 0)).toBe(occupe)
  })

  it('deux mots de pages différentes échangent leur place et leur page', () => {
    const avecMaman = deplacerCase(DEUX_PAGES, 'maison', 'maman', 'maison-p2', 0, 0)

    const apres = echangerCases(avecMaman, 'maison', 'papa', 'maison-p2', 'maman')

    expect(pageDe(apres, 'maison-p2').grid.order[0]![0]).toBe('papa')
    expect(caseParIdentifiant(pageDe(apres, 'maison-p2'), 'papa')?.label).toBe('PAPA')
    expect(caseParIdentifiant(pageDe(apres, 'maison'), 'maman')?.label).toBe('MAMAN')
    // et personne ne se retrouve déclaré sur deux planches à la fois
    expect(pageDe(apres, 'maison').buttons.filter((c) => c.id === 'papa')).toHaveLength(0)
    expect(pageDe(apres, 'maison-p2').buttons.filter((c) => c.id === 'maman')).toHaveLength(0)
  })

  it('un mot déplacé entre deux contextes emporte sa photo et sa voix', () => {
    const apres = deplacerCase(DEUX_PAGES, 'maison', 'maman', 'exterieur', 1, 3)

    const arrivee = caseParIdentifiant(pageDe(apres, 'exterieur'), 'maman')
    expect(arrivee?.image_id).toBe('pictos/maman.svg')
    expect(arrivee?.sound_id).toBe('maman')
  })
})


describe('ajouter les planches d un fichier sans écraser', () => {
  const APPORTEE: Configuration = {
    ...CONFIGURATION_DEMO,
    contextes: [ajouterContexte(CONFIGURATION_DEMO, 'École').contextes.at(-1)!],
  }

  it('pose les contextes apportés à la suite, sans toucher aux miens', () => {
    const { configuration, ajoutes, refuses } = fusionnerContextes(CONFIGURATION_DEMO, APPORTEE)

    expect(ajoutes.map((c) => c.name)).toEqual(['École'])
    expect(refuses).toEqual([])
    expect(configuration.contextes.map((c) => c.id)).toEqual([
      'maison',
      'exterieur',
      'douleur',
      'ecole',
    ])
    // les miens sont intacts, mots compris : c'est toute la raison d'être de cette pièce
    expect(configuration.contextes[0]).toBe(CONFIGURATION_DEMO.contextes[0])
  })

  it('refuse un contexte dont l identifiant est déjà pris, et le nomme', () => {
    const { configuration, ajoutes, refuses } = fusionnerContextes(
      CONFIGURATION_DEMO,
      CONFIGURATION_DEMO,
    )

    expect(ajoutes).toEqual([])
    expect(refuses).toEqual(['Maison', 'Extérieur', "J'ai mal"])
    expect(configuration.contextes).toHaveLength(3)
  })

  it('refuse ce qui ne tient plus, une fois les cinq contextes atteints', () => {
    let pleine = CONFIGURATION_DEMO
    while (pleine.contextes.length < CONTEXTES_MAXIMUM) {
      pleine = ajouterContexte(pleine, `Contexte ${pleine.contextes.length}`)
    }

    const { ajoutes, refuses } = fusionnerContextes(pleine, APPORTEE)

    expect(ajoutes).toEqual([])
    expect(refuses).toEqual(['École'])
  })

  it('n emporte ni la barre ni les réglages du fichier', () => {
    const autreBarre: Configuration = {
      ...APPORTEE,
      barre: { ...CONFIGURATION_DEMO.barre, id: 'barre-etrangere' },
      reglages: { ...CONFIGURATION_DEMO.reglages, volume: 100 },
    }

    const { configuration } = fusionnerContextes(CONFIGURATION_DEMO, autreBarre)

    // la barre et les réglages appartiennent à la tablette, pas au fichier qu'on y verse
    expect(configuration.barre).toBe(CONFIGURATION_DEMO.barre)
    expect(configuration.reglages).toBe(CONFIGURATION_DEMO.reglages)
  })
})

const BARRE_ESSENTIELS: Planche = {
  format: 'open-board-0.1',
  id: 'barre',
  locale: 'fr',
  name: 'Barre',
  grid: { rows: 1, columns: 5, order: [['oui', null, null, null, null]] },
  buttons: [{ id: 'oui', label: 'OUI', vocalization: 'oui' }],
}

const SILHOUETTE: Planche = {
  format: 'open-board-0.1',
  id: 'corps',
  locale: 'fr',
  name: "J'ai mal",
  ext_mesmots_silhouette: true,
  grid: { rows: 2, columns: 5, order: [['mal-tete', null, null, null, null], [null, null, null, null, null]] },
  buttons: [{ id: 'mal-tete', label: 'TÊTE', vocalization: "J'ai mal à la tête" }],
}

/** Une grille pleine de mots numérotés dans l'ordre de lecture, `m0` en haut à gauche : les
 *  numéros disent l'emplacement d'origine, ce qui rend lisible ce qui a bougé. */
function grilleDe(colonnes: number, lignes: number, masques: string[] = []): Configuration {
  const ids = Array.from({ length: colonnes * lignes }, (_, rang) => `m${rang}`)
  const page: Planche = {
    format: 'open-board-0.1',
    id: 'maison',
    locale: 'fr',
    name: 'Maison',
    grid: {
      rows: lignes,
      columns: colonnes,
      order: Array.from({ length: lignes }, (_, ligne) => ids.slice(ligne * colonnes, (ligne + 1) * colonnes)),
    },
    // photo et voix sur chaque mot : un mot déplacé qui les perdrait resterait une case
    // touchable, et rien ne le dirait à la mère
    buttons: ids.map((id) => ({
      id,
      label: id.toUpperCase(),
      vocalization: id,
      image_id: `img-${id}`,
      sound_id: `son-${id}`,
      ...(masques.includes(id) ? { hidden: true } : {}),
    })),
  }
  return {
    format: 'open-board-0.1',
    contextes: [{ id: 'maison', name: 'Maison', pages: [page] }],
    barre: BARRE_ESSENTIELS,
    reglages: REGLAGES_PAR_DEFAUT,
  }
}

describe('la forme de la grille, ce qu elle coûtera avant de la changer', () => {
  it('rétrécir ne déplace que les mots de la colonne qui disparaît', () => {
    expect(consequencesDuChangementDeForme(grilleDe(4, 4), { colonnes: 3, lignes: 4 })).toEqual({
      gardes: 12,
      deplaces: 4,
      pagesCreees: 1,
    })
  })

  it('agrandir ne déplace aucun mot', () => {
    expect(consequencesDuChangementDeForme(grilleDe(4, 4), { colonnes: 5, lignes: 4 })).toEqual({
      gardes: 16,
      deplaces: 0,
      pagesCreees: 0,
    })
  })

  it('un mot masqué de la colonne coupée se déplace comme les autres', () => {
    // la mère le retrouvera sur la page nouvelle le jour où elle voudra le révéler : le
    // compter parmi les gardés lui promettrait une place qu'il n'a plus
    expect(consequencesDuChangementDeForme(grilleDe(4, 4, ['m3']), { colonnes: 3, lignes: 4 })).toEqual(
      consequencesDuChangementDeForme(grilleDe(4, 4), { colonnes: 3, lignes: 4 }),
    )
  })

  it('compte une page nouvelle par tranche de la nouvelle forme', () => {
    // douze mots ramassés vers une grille de 2 × 2 : trois pages, pas une
    expect(consequencesDuChangementDeForme(grilleDe(4, 4), { colonnes: 2, lignes: 2 })).toEqual({
      gardes: 4,
      deplaces: 12,
      pagesCreees: 3,
    })
  })

  it('écrit le coût au singulier quand un seul mot bouge', () => {
    // même phrase pour la ligne de l'écran et pour la confirmation : écrites à la main aux
    // deux endroits, l'une des deux annonçait « 1 mots »
    const unSeul = { gardes: 1, deplaces: 1, pagesCreees: 1 }
    expect(consequenceEcrite(unSeul)).toBe(
      '1 mot gardera sa place. 1 mot passera sur une page nouvelle, à la fin de son contexte.',
    )
    expect(consequenceEcrite(unSeul, true)).toContain("devra en réapprendre l'emplacement")
    // et sans promettre des cases neuves : rétrécir en n'en coupant que des vides n'en crée aucune
    expect(consequenceEcrite({ gardes: 16, deplaces: 0, pagesCreees: 0 })).toBe(
      'Aucun mot ne changera de place.',
    )
  })

  it('accorde le nombre de pages sur ce qui sera vraiment créé', () => {
    // douze mots vers 2 × 2 tiennent sur trois pages : annoncer « une page » enverrait la
    // mère chercher ses mots sur une page où les deux tiers ne sont pas
    expect(consequenceEcrite({ gardes: 4, deplaces: 12, pagesCreees: 3 }, true)).toBe(
      '4 mots garderont leur place. 12 mots passeront sur 3 pages nouvelles, à la fin de leur' +
        " contexte, et l'enfant devra en réapprendre les emplacements.",
    )
    expect(consequenceEcrite(consequencesDuChangementDeForme(grilleDe(4, 4), { colonnes: 2, lignes: 2 }))).toContain(
      '3 pages nouvelles',
    )
  })

  it('ignore la barre des mots essentiels et la silhouette', () => {
    const avecSilhouette = grilleDe(4, 4)
    avecSilhouette.contextes.push({ id: 'douleur', name: "J'ai mal", pages: [SILHOUETTE] })
    expect(consequencesDuChangementDeForme(avecSilhouette, { colonnes: 3, lignes: 4 })).toEqual({
      gardes: 12,
      deplaces: 4,
      pagesCreees: 1,
    })
  })
})

describe('changer la forme de la grille', () => {
  function emplacementDe(planche: Planche, id: string) {
    for (const [ligne, cases] of planche.grid.order.entries()) {
      const colonne = cases.indexOf(id)
      if (colonne !== -1) return { ligne, colonne }
    }
    return undefined
  }

  const tousLesMots = (configuration: Configuration) =>
    toutesLesPlanches(configuration)
      .flatMap((planche) => planche.buttons.map((contenu) => contenu.id))
      .sort()

  it('les mots qui tiennent encore gardent leur ligne et leur colonne', () => {
    const avant = grilleDe(4, 4)
    const apres = changerFormeDeGrille(avant, { colonnes: 3, lignes: 4 })
    const page = apres.contextes[0]!.pages[0]!
    expect(page.grid).toMatchObject({ rows: 4, columns: 3 })
    for (const id of ['m0', 'm1', 'm2', 'm4', 'm6', 'm9', 'm12', 'm14']) {
      expect(emplacementDe(page, id)).toEqual(emplacementDe(avant.contextes[0]!.pages[0]!, id))
    }
  })

  it('les mots de la colonne coupée passent sur une page ajoutée en fin de contexte', () => {
    const apres = changerFormeDeGrille(grilleDe(4, 4, ['m7']), { colonnes: 3, lignes: 4 })
    const pages = apres.contextes[0]!.pages
    expect(pages.map((page) => page.id)).toEqual(['maison', 'maison-p2'])
    // dans l'ordre de lecture de l'ancienne matrice, en haut à gauche de la page nouvelle
    expect(pages[1]!.grid.order[0]).toEqual(['m3', 'm7', 'm11'])
    expect(pages[1]!.grid.order[1]).toEqual(['m15', null, null])
    expect(pages[1]!.name).toBe('Maison')
    // masqué avant, masqué après : la page nouvelle ne révèle rien toute seule
    expect(caseParIdentifiant(pages[1]!, 'm7')?.hidden).toBe(true)
    expect(caseParIdentifiant(pages[0]!, 'm3')).toBeUndefined()
    // et le mot arrive entier, photo et voix comprises : un mot déplacé qui les perd en route
    // reste une case touchable, muette et sans image, sans que rien ne le signale
    expect(caseParIdentifiant(pages[1]!, 'm3')).toEqual(
      caseParIdentifiant(grilleDe(4, 4, ['m7']).contextes[0]!.pages[0]!, 'm3'),
    )
  })

  it('ne perd jamais un mot, dans un sens comme dans l autre', () => {
    const avant = grilleDe(4, 4)
    expect(tousLesMots(changerFormeDeGrille(avant, { colonnes: 3, lignes: 4 }))).toEqual(tousLesMots(avant))
    expect(tousLesMots(changerFormeDeGrille(avant, { colonnes: 2, lignes: 2 }))).toEqual(tousLesMots(avant))
    expect(tousLesMots(changerFormeDeGrille(avant, { colonnes: 6, lignes: 6 }))).toEqual(tousLesMots(avant))
  })

  it('ouvre autant de pages que le ramassage en demande', () => {
    // trente-six mots en 6 × 6 vers 3 × 3 : neuf gardent leur place, vingt-sept partent
    const apres = changerFormeDeGrille(grilleDe(6, 6), { colonnes: 3, lignes: 3 })
    expect(apres.contextes[0]!.pages.map((page) => page.id)).toEqual([
      'maison',
      'maison-p2',
      'maison-p3',
      'maison-p4',
    ])
    expect(apres.contextes[0]!.pages.at(-1)!.buttons).toHaveLength(9)
  })

  it('agrandir laisse chaque mot où il est et n ouvre que des cases libres', () => {
    const avant = grilleDe(4, 4)
    const apres = changerFormeDeGrille(avant, { colonnes: 5, lignes: 5 })
    const page = apres.contextes[0]!.pages[0]!
    expect(apres.contextes[0]!.pages).toHaveLength(1)
    expect(page.grid.order.slice(0, 4).map((ligne) => ligne.slice(0, 4))).toEqual(
      avant.contextes[0]!.pages[0]!.grid.order,
    )
    expect(page.grid.order[4]).toEqual([null, null, null, null, null])
    expect(page.grid.order.map((ligne) => ligne[4])).toEqual([null, null, null, null, null])
  })

  it('ne fait rien plutôt que de geler sur une sauvegarde abîmée', () => {
    // une planche restaurée avec `rows: 0` passe la validation de l'archive, et une page sans
    // ligne faisait tourner le découpage en pages sans jamais rendre la main
    const avant = grilleDe(4, 4)
    expect(changerFormeDeGrille(avant, { colonnes: 2, lignes: 0 })).toBe(avant)
    expect(changerFormeDeGrille(avant, { colonnes: 0, lignes: 2 })).toBe(avant)
  })

  it('ne touche ni la barre des mots essentiels, ni la silhouette, ni les réglages', () => {
    const avant = grilleDe(4, 4)
    avant.contextes.push({ id: 'douleur', name: "J'ai mal", pages: [SILHOUETTE] })
    const apres = changerFormeDeGrille(avant, { colonnes: 3, lignes: 4 })
    expect(apres.barre).toBe(avant.barre)
    expect(apres.contextes[1]!.pages).toEqual([SILHOUETTE])
    expect(apres.reglages).toBe(avant.reglages)
  })
})

describe('« J ai mal » rendu en cases plutôt qu en corps', () => {
  /** Les dix mots de la douleur, rangés comme dans la graine : deux rangées de cinq, ce qui
   *  est un rangement et non une disposition, puisque c'est le dessin qui les place. */
  const CORPS: Planche = {
    format: 'open-board-0.1',
    id: 'corps',
    locale: 'fr',
    name: "J'ai mal",
    ext_mesmots_silhouette: true,
    grid: {
      rows: 2,
      columns: 5,
      order: [
        ['tete', 'cou', 'ventre', 'bras', 'main'],
        ['dos', 'fesses', 'zizi', 'jambe', 'pied'],
      ],
    },
    buttons: [
      { id: 'tete', label: 'TÊTE', vocalization: "J'ai mal à la tête" },
      { id: 'cou', label: 'COU', vocalization: "J'ai mal au cou" },
      { id: 'ventre', label: 'VENTRE', vocalization: "J'ai mal au ventre" },
      { id: 'bras', label: 'BRAS', vocalization: "J'ai mal au bras" },
      { id: 'main', label: 'MAIN', vocalization: "J'ai mal à la main" },
      { id: 'dos', label: 'DOS', vocalization: "J'ai mal au dos" },
      { id: 'fesses', label: 'FESSES', vocalization: "J'ai mal aux fesses" },
      { id: 'zizi', label: 'ZIZI', vocalization: "J'ai mal au zizi" },
      { id: 'jambe', label: 'JAMBE', vocalization: "J'ai mal à la jambe" },
      { id: 'pied', label: 'PIED', vocalization: "J'ai mal au pied" },
    ],
  }

  /** La tablette entière : une grille ordinaire que la mère peut remodeler, puis la douleur. */
  const GRILLE = grilleDe(4, 4)
  const AVEC_DOULEUR: Configuration = {
    ...GRILLE,
    contextes: [...GRILLE.contextes, { id: 'douleur', name: "J'ai mal", pages: [CORPS] }],
  }

  it('se replie en quatre colonnes, sans rien réordonner ni perdre un mot', () => {
    const page = silhouetteEnGrille(CORPS)
    expect(page.grid.columns).toBe(4)
    expect(page.grid.rows).toBe(3)
    expect(page.grid.order).toEqual([
      ['tete', 'cou', 'ventre', 'bras'],
      ['main', 'dos', 'fesses', 'zizi'],
      ['jambe', 'pied', null, null],
    ])
  })

  it('garde sa disposition quelle que soit la forme réglée par la famille', () => {
    // la forme se change depuis l'espace parents, et le message promet alors qu'aucun mot ne
    // changera de place. Les mots de la douleur ne doivent pas être l'exception muette.
    const large = changerFormeDeGrille(AVEC_DOULEUR, { colonnes: 5, lignes: 4 })
    const etroite = changerFormeDeGrille(AVEC_DOULEUR, { colonnes: 2, lignes: 6 })
    const disposition = (configuration: Configuration) =>
      silhouetteEnGrille(configuration.contextes[1]!.pages[0]!).grid

    expect(disposition(large)).toEqual(disposition(AVEC_DOULEUR))
    expect(disposition(etroite)).toEqual(disposition(AVEC_DOULEUR))
  })

  it('ne se montre plus comme un corps, et garde ses mots intacts', () => {
    const page = silhouetteEnGrille(CORPS)
    expect(page.ext_mesmots_silhouette).toBeUndefined()
    expect(page.buttons).toBe(CORPS.buttons)
    expect(page.id).toBe('corps')
  })

  it('ne touche pas la planche enregistrée : le repli ne vit que le temps de l affichage', () => {
    silhouetteEnGrille(CORPS)
    expect(CORPS.grid.rows).toBe(2)
    expect(CORPS.grid.columns).toBe(5)
    expect(CORPS.ext_mesmots_silhouette).toBe(true)
  })
})
