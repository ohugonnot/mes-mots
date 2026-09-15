import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GrilleCommunication from '../../src/composants/GrilleCommunication.vue'
import { PLANCHE_DEMO } from '../../src/domaine/plancheDemo'
import type { Planche } from '../../src/domaine/planche'

/** Planche à quatre cases, dont on choisit lesquelles sont masquées. */
function plancheDeTest(masquees: string[]): Planche {
  return {
    format: 'open-board-0.1',
    id: 't',
    locale: 'fr',
    name: 'test',
    grid: { rows: 2, columns: 3, order: [['a', 'b', 'c'], ['d', null, null]] },
    buttons: ['a', 'b', 'c', 'd'].map((id) => ({
      id,
      label: id.toUpperCase(),
      vocalization: id,
      hidden: masquees.includes(id),
    })),
  }
}

/** Ce que chaque emplacement de la grille porte, dans l'ordre de la matrice. */
function emplacements(planche: Planche): string[] {
  const grille = mount(GrilleCommunication, { props: { planche } }).get('[data-grille]')
  return Array.from(grille.element.children).map((n) => n.getAttribute('data-case') ?? 'vide')
}

describe('grille de communication', () => {
  it('dessine une case par identifiant posé, un trou par emplacement libre', () => {
    expect(emplacements(plancheDeTest([]))).toEqual(['a', 'b', 'c', 'd', 'vide', 'vide'])
  })

  it('ne dessine pas les cases masquées', () => {
    expect(emplacements(plancheDeTest(['b']))).toEqual(['a', 'vide', 'c', 'd', 'vide', 'vide'])
  })

  it('masquer une case ne déplace aucune autre', () => {
    // l'invariant du projet. L'enfant mémorise l'emplacement autant que l'image :
    // révéler ou masquer un mot ne doit jamais recomposer la grille.
    const avant = emplacements(plancheDeTest([]))
    const apres = emplacements(plancheDeTest(['b']))

    expect(apres).toHaveLength(avant.length)
    avant.forEach((contenu, index) => {
      if (contenu !== 'b') expect(apres[index]).toBe(contenu)
    })
  })

  it('révéler LOKI ne déplace aucune des cases déjà connues', () => {
    // le geste que la famille fera vraiment, sur la planche réelle et pas sur un montage
    const avant = emplacements(PLANCHE_DEMO)
    const revelee: Planche = {
      ...PLANCHE_DEMO,
      buttons: PLANCHE_DEMO.buttons.map((c) => (c.id === 'loki' ? { ...c, hidden: false } : c)),
    }
    const apres = emplacements(revelee)

    expect(apres).toHaveLength(avant.length)
    avant.forEach((contenu, index) => {
      if (contenu !== 'vide') expect(apres[index]).toBe(contenu)
    })
    expect(apres.filter((c) => c !== 'vide')).toHaveLength(14)
  })

  it('donne à chaque case sans photo un repère qui lui est propre', () => {
    // une initiale donnait trois « M » pour MAMAN, MANGER et MOI
    const sansPhoto: Planche = {
      ...PLANCHE_DEMO,
      buttons: PLANCHE_DEMO.buttons.map(({ image_id: _, ...reste }) => reste),
    }
    const reperes = mount(GrilleCommunication, { props: { planche: sansPhoto } })
      .findAll('.mot-repere')
      .map((n) => n.text())

    expect(reperes.length).toBeGreaterThan(0)
    expect(new Set(reperes).size).toBe(reperes.length)
  })
})
