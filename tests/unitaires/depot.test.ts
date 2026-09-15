import { describe, it, expect } from 'vitest'
import { migrerV2VersV3, type ConfigurationV2 } from '../../src/domaine/depot'
import { REGLAGES_PAR_DEFAUT, type Planche } from '../../src/domaine/planche'

/**
 * Configuration v2 réaliste : celle qu'une famille a déjà sur sa tablette, avec ses
 * révélations, ses ajouts et ses trous. Une perte de configuration est le seul bug
 * vraiment grave de ce projet, donc la conversion se vérifie case par case.
 */
const MAISON_V2: Planche = {
  format: 'open-board-0.1',
  id: 'maison',
  locale: 'fr',
  name: 'Maison',
  grid: {
    rows: 4,
    columns: 4,
    order: [
      ['maman', 'papa', null, 'doudou'],
      ['boire', 'manger', 'douche', 'chambre'],
      ['voiture', 'tablette', 'promenade', 'loki'],
      ['oui', 'non', 'venum', 'pipi'],
    ],
  },
  buttons: [
    { id: 'maman', label: 'MAMAN', vocalization: 'Je veux maman', image_id: 'pictos/maman.svg', sound_id: 'maman', background_color: '#ffb8aa', border_color: '#ff7a6b', ext_mesmots_enchaine: 'maman' },
    { id: 'papa', label: 'PAPA', vocalization: 'Je veux papa', sound_id: 'papa', hidden: false },
    { id: 'doudou', label: 'NOUNOURS', vocalization: 'Je veux ma couverture', sound_id: 'doudou' },
    { id: 'boire', label: 'BOIRE', vocalization: 'Je veux un biberon', sound_id: 'boire' },
    { id: 'manger', label: 'MANGER', vocalization: 'Je veux un gâteau', sound_id: 'manger' },
    { id: 'douche', label: 'DOUCHE', vocalization: 'Je veux la douche', sound_id: 'douche' },
    { id: 'chambre', label: 'CHAMBRE', vocalization: 'Je veux monter', sound_id: 'chambre' },
    { id: 'voiture', label: 'VOITURE', vocalization: 'Je veux la voiture', sound_id: 'voiture' },
    { id: 'tablette', label: 'TABLETTE', vocalization: 'Je veux la tablette', sound_id: 'tablette' },
    { id: 'promenade', label: 'PROMENADE', vocalization: 'Je veux me promener', sound_id: 'promenade' },
    { id: 'loki', label: 'LOKI', vocalization: 'Je veux Loki', sound_id: 'loki', hidden: true },
    { id: 'oui', label: 'OUI', vocalization: 'Oui', sound_id: 'oui' },
    { id: 'non', label: 'NON', vocalization: 'Non', sound_id: 'non' },
    { id: 'venum', label: 'VENUM', vocalization: 'Je veux Venum', sound_id: 'venum', hidden: true },
    { id: 'pipi', label: 'PIPI', vocalization: "J'ai fait pipi", sound_id: 'pipi', hidden: false },
  ],
}

const EXTERIEUR_V2: Planche = {
  format: 'open-board-0.1',
  id: 'exterieur',
  locale: 'fr',
  name: 'Extérieur',
  grid: {
    rows: 4,
    columns: 4,
    order: [
      ['magasin', 'frere', 'ballon', null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
  },
  buttons: [
    { id: 'magasin', label: 'MAGASIN', vocalization: 'Je veux aller au magasin', sound_id: 'magasin', hidden: true },
    { id: 'frere', label: 'FRÈRE', vocalization: 'Je veux voir mon frère', sound_id: 'frere', hidden: true },
    { id: 'ballon', label: 'BALLON', vocalization: 'Je veux mon ballon', hidden: false },
  ],
}

const BARRE_V2: Planche = {
  format: 'open-board-0.1',
  id: 'barre',
  locale: 'fr',
  name: 'Mots essentiels',
  grid: { rows: 1, columns: 5, order: [['aide', 'encore', 'fini', null, null]] },
  buttons: [
    { id: 'aide', label: 'AIDE-MOI', vocalization: "Aide-moi s'il te plaît", sound_id: 'aide', hidden: false },
    { id: 'encore', label: 'ENCORE', vocalization: 'Je veux encore', sound_id: 'encore', hidden: true },
    { id: 'fini', label: 'FINI', vocalization: "J'ai fini", sound_id: 'fini', hidden: true },
  ],
}

const CONFIGURATION_V2: ConfigurationV2 = {
  format: 'open-board-0.1',
  planches: [MAISON_V2, EXTERIEUR_V2],
  barre: BARRE_V2,
}

describe('migration v2 vers v3', () => {
  const migree = migrerV2VersV3(CONFIGURATION_V2)

  it('fait de chaque planche un contexte d une seule page', () => {
    expect(migree.contextes.map((c) => c.id)).toEqual(['maison', 'exterieur'])
    expect(migree.contextes.map((c) => c.name)).toEqual(['Maison', 'Extérieur'])
    expect(migree.contextes.map((c) => c.pages.length)).toEqual([1, 1])
  })

  it('rend la planche elle-même comme première page, sans rien réécrire', () => {
    expect(migree.contextes[0]!.pages[0]).toEqual(MAISON_V2)
    expect(migree.contextes[1]!.pages[0]).toEqual(EXTERIEUR_V2)
  })

  it('garde chaque case de chaque planche, une par une', () => {
    const casesV2 = CONFIGURATION_V2.planches.flatMap((p) => p.buttons)
    const casesV3 = migree.contextes.flatMap((c) => c.pages.flatMap((p) => p.buttons))

    expect(casesV3).toHaveLength(casesV2.length)
    for (const attendue of casesV2) {
      expect(casesV3.find((c) => c.id === attendue.id), `${attendue.label} perdue`).toEqual(attendue)
    }
  })

  it('garde les cases masquées masquées, et les révélées révélées', () => {
    const cases = migree.contextes.flatMap((c) => c.pages.flatMap((p) => p.buttons))
    expect(cases.filter((c) => c.hidden === true).map((c) => c.id)).toEqual([
      'loki',
      'venum',
      'magasin',
      'frere',
    ])
    // `hidden` absent ou faux ne doit jamais devenir `true` au passage
    expect(cases.find((c) => c.id === 'pipi')!.hidden).toBe(false)
    expect(cases.find((c) => c.id === 'maman')!.hidden).toBeUndefined()
  })

  it('garde chaque son et chaque image', () => {
    const maison = migree.contextes[0]!.pages[0]!
    expect(maison.buttons.find((c) => c.id === 'maman')).toMatchObject({
      sound_id: 'maman',
      image_id: 'pictos/maman.svg',
    })
    for (const attendue of MAISON_V2.buttons) {
      const apres = maison.buttons.find((c) => c.id === attendue.id)!
      expect(apres.sound_id, `${attendue.label} a perdu son son`).toBe(attendue.sound_id)
      expect(apres.image_id, `${attendue.label} a perdu son image`).toBe(attendue.image_id)
    }
  })

  it('garde chaque position, trous compris', () => {
    expect(migree.contextes[0]!.pages[0]!.grid.order).toEqual(MAISON_V2.grid.order)
    expect(migree.contextes[1]!.pages[0]!.grid.order).toEqual(EXTERIEUR_V2.grid.order)
  })

  it('garde le mot personnalisé par la famille', () => {
    // DOUDOU renommé NOUNOURS par la mère : une migration qui reprendrait la graine
    // remettrait DOUDOU et effacerait son travail
    const doudou = migree.contextes[0]!.pages[0]!.buttons.find((c) => c.id === 'doudou')!
    expect(doudou.label).toBe('NOUNOURS')
  })

  it('garde la barre des mots essentiels telle quelle', () => {
    expect(migree.barre).toEqual(BARRE_V2)
  })

  it('ajoute les réglages à leur valeur par défaut', () => {
    expect(migree.reglages).toEqual(REGLAGES_PAR_DEFAUT)
    expect(migree.reglages.retourAutomatique).toBe(true)
  })

  it('garde le format annoncé', () => {
    expect(migree.format).toBe('open-board-0.1')
  })

  it('ne laisse aucune trace de l ancienne forme', () => {
    // un champ `planches` résiduel ferait redétecter la v2 au chargement suivant
    expect('planches' in migree).toBe(false)
  })
})
