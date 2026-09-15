import { describe, it, expect } from 'vitest'
import { livrerLesNouveautes } from '../../src/domaine/livraison'
import { CONFIGURATION_DEMO } from '../../src/domaine/plancheDemo'
import { supprimerCase, supprimerContexte, type Configuration } from '../../src/domaine/planche'

/** Une tablette d'avant cette version : elle ne tient aucun compte de ce qu'on lui a livré. */
const SANS_MEMOIRE: Configuration = {
  ...supprimerContexte(CONFIGURATION_DEMO, 'douleur'),
  ext_mesmots_livraisons: undefined,
}

const contextes = (configuration: Configuration) => configuration.contextes.map((c) => c.id)
const motsDe = (configuration: Configuration, idPlanche: string) =>
  configuration.contextes
    .flatMap((c) => c.pages)
    .find((p) => p.id === idPlanche)!
    .buttons.map((b) => b.id)

describe('livrer les nouveautés sans rien perdre', () => {
  it('apporte un contexte que la tablette n a jamais reçu', () => {
    const { configuration, ajoutes } = livrerLesNouveautes(SANS_MEMOIRE, CONFIGURATION_DEMO)

    expect(contextes(configuration)).toEqual(['maison', 'exterieur', 'douleur'])
    expect(ajoutes).toEqual(["J'ai mal"])
  })

  it('ne rend jamais un mot que la famille a supprimé', () => {
    // le cœur du problème : sans mémoire des livraisons, chaque lancement ressusciterait
    // ce que le parent a retiré, et il faudrait le supprimer sans fin
    const sansDoudou = supprimerCase(SANS_MEMOIRE, 'maison', 'doudou')

    const premier = livrerLesNouveautes(sansDoudou, CONFIGURATION_DEMO)
    expect(motsDe(premier.configuration, 'maison')).not.toContain('doudou')

    const second = livrerLesNouveautes(premier.configuration, CONFIGURATION_DEMO)
    expect(motsDe(second.configuration, 'maison')).not.toContain('doudou')
    expect(second.ajoutes).toEqual([])
  })

  it('ne livre le même contexte qu une fois, même si on le supprime ensuite', () => {
    const premier = livrerLesNouveautes(SANS_MEMOIRE, CONFIGURATION_DEMO)
    const retire = supprimerContexte(premier.configuration, 'douleur')

    const second = livrerLesNouveautes(retire, CONFIGURATION_DEMO)

    expect(contextes(second.configuration)).toEqual(['maison', 'exterieur'])
    expect(second.ajoutes).toEqual([])
  })

  it('ajoute un mot neuf d une planche que la tablette possède déjà', () => {
    const dejaLivre = livrerLesNouveautes(SANS_MEMOIRE, CONFIGURATION_DEMO).configuration
    // la graine gagne un mot sur une place restée libre
    const graineEnrichie: Configuration = {
      ...CONFIGURATION_DEMO,
      contextes: CONFIGURATION_DEMO.contextes.map((contexte) =>
        contexte.id !== 'exterieur'
          ? contexte
          : {
              ...contexte,
              pages: contexte.pages.map((page) => ({
                ...page,
                grid: {
                  ...page.grid,
                  order: page.grid.order.map((ligne, i) =>
                    ligne.map((id, j) => (i === 3 && j === 3 ? 'plage' : id)),
                  ),
                },
                buttons: [
                  ...page.buttons,
                  {
                    id: 'plage',
                    label: 'LA PLAGE',
                    vocalization: 'Je veux aller à la plage',
                    background_color: '#8ecbfa',
                    border_color: '#3fa9f5',
                  },
                ],
              })),
            },
      ),
    }

    const { configuration, ajoutes } = livrerLesNouveautes(dejaLivre, graineEnrichie)

    expect(motsDe(configuration, 'exterieur')).toContain('plage')
    expect(ajoutes).toEqual(['LA PLAGE'])
  })

  it('ne pose jamais un mot sur une place que la famille occupe', () => {
    // sa disposition prime : un mot livré qui écraserait le sien serait une perte
    const dejaLivre = livrerLesNouveautes(SANS_MEMOIRE, CONFIGURATION_DEMO).configuration
    const graineEnrichie: Configuration = {
      ...CONFIGURATION_DEMO,
      contextes: CONFIGURATION_DEMO.contextes.map((contexte) =>
        contexte.id !== 'maison'
          ? contexte
          : {
              ...contexte,
              pages: contexte.pages.map((page) => ({
                ...page,
                buttons: [
                  ...page.buttons,
                  {
                    id: 'intrus',
                    label: 'INTRUS',
                    vocalization: 'Intrus',
                    background_color: '#8ecbfa',
                    border_color: '#3fa9f5',
                  },
                ],
                // la place de MAMAN, déjà occupée chez la famille
                grid: {
                  ...page.grid,
                  order: page.grid.order.map((ligne, i) =>
                    ligne.map((id, j) => (i === 0 && j === 0 ? 'intrus' : id)),
                  ),
                },
              })),
            },
      ),
    }

    const { configuration } = livrerLesNouveautes(dejaLivre, graineEnrichie)

    expect(motsDe(configuration, 'maison')).not.toContain('intrus')
    expect(motsDe(configuration, 'maison')).toContain('maman')
  })

  it('ne touche ni aux mots modifiés, ni aux réglages, ni à la barre', () => {
    const dejaLivre = livrerLesNouveautes(SANS_MEMOIRE, CONFIGURATION_DEMO).configuration
    const retouchee: Configuration = {
      ...dejaLivre,
      contextes: dejaLivre.contextes.map((contexte) =>
        contexte.id !== 'maison'
          ? contexte
          : {
              ...contexte,
              pages: contexte.pages.map((page) => ({
                ...page,
                buttons: page.buttons.map((b) =>
                  b.id === 'maman' ? { ...b, vocalization: 'Ma maman chérie' } : b,
                ),
              })),
            },
      ),
      reglages: { ...dejaLivre.reglages, volume: 100 },
    }

    const { configuration, ajoutes } = livrerLesNouveautes(retouchee, CONFIGURATION_DEMO)

    const maman = configuration.contextes[0]!.pages[0]!.buttons.find((b) => b.id === 'maman')!
    expect(maman.vocalization).toBe('Ma maman chérie')
    expect(configuration.reglages.volume).toBe(100)
    expect(configuration.barre).toBe(retouchee.barre)
    expect(ajoutes).toEqual([])
  })

  it('rend la configuration telle quelle quand il n y a rien à livrer', () => {
    const aJour = livrerLesNouveautes(SANS_MEMOIRE, CONFIGURATION_DEMO).configuration

    const seconde = livrerLesNouveautes(aJour, CONFIGURATION_DEMO)

    expect(seconde.configuration).toBe(aJour)
    expect(seconde.ajoutes).toEqual([])
  })

  it('sur une tablette neuve, la graine entière compte comme déjà livrée', () => {
    const { configuration, ajoutes } = livrerLesNouveautes(CONFIGURATION_DEMO, CONFIGURATION_DEMO)

    expect(ajoutes).toEqual([])
    expect(configuration.ext_mesmots_livraisons).toContain('maman')
    expect(configuration.ext_mesmots_livraisons).toContain('mal-ventre')
  })

  it('pose l image d un contexte qui n en avait pas, sans jamais remplacer la sienne', () => {
    // « Maison » existait avant les images de contexte : sans cette complétion, elle resterait
    // un mot écrit sur l'écran d'un enfant qui ne lit pas
    const sansImage: Configuration = {
      ...SANS_MEMOIRE,
      contextes: SANS_MEMOIRE.contextes.map((c) =>
        c.id === 'maison' ? { ...c, ext_mesmots_image: undefined } : { ...c, ext_mesmots_image: 'pictos/a-moi.png' },
      ),
    }

    const { configuration } = livrerLesNouveautes(sansImage, CONFIGURATION_DEMO)

    expect(configuration.contextes[0]!.ext_mesmots_image).toBe('pictos/maison-contexte.png')
    // celle que la famille a choisie ne bouge pas
    expect(configuration.contextes[1]!.ext_mesmots_image).toBe('pictos/a-moi.png')
  })
})
