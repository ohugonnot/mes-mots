import { describe, it, expect } from 'vitest'
import { rapportDeContraste, ENCRE, CONTRASTE_MINIMAL } from '../../src/domaine/contraste'
import { TOUTES_LES_CASES } from '../../src/domaine/plancheDemo'
import { PALETTE } from '../../src/domaine/palette'

describe('contraste des étiquettes', () => {
  it('calcule un rapport connu', () => {
    // le noir sur blanc vaut 21:1, la valeur de référence de la spécification
    expect(rapportDeContraste('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })

  it('est indifférent à l ordre des couleurs', () => {
    expect(rapportDeContraste('#12304f', '#ffd25e')).toBeCloseTo(
      rapportDeContraste('#ffd25e', '#12304f'),
      6,
    )
  })

  it.each(TOUTES_LES_CASES.map((c) => [c.label, c.background_color!] as const))(
    'la case %s garde un texte lisible sur son bandeau',
    (_label, fond) => {
      expect(rapportDeContraste(ENCRE, fond)).toBeGreaterThanOrEqual(CONTRASTE_MINIMAL)
    },
  )

  it('donne une couleur de bandeau à chaque case', () => {
    for (const c of TOUTES_LES_CASES) {
      expect(c.background_color, `${c.label} sans couleur de bandeau`).toBeDefined()
      expect(c.border_color, `${c.label} sans couleur d anneau`).toBeDefined()
    }
  })
})

describe('la graine et la palette disent la même chose', () => {
  // Les couleurs étaient écrites deux fois, dans la graine et dans la palette proposée aux
  // parents : une correction sur l'une laissait l'autre en arrière, et une case créée par la
  // famille ne ressemblait plus à ses voisines.
  it.each(TOUTES_LES_CASES.map((c) => [c.label, c.background_color!, c.border_color!] as const))(
    'la case %s porte un couple de couleurs de la palette',
    (_label, fond, anneau) => {
      expect(PALETTE.some((famille) => famille.fond === fond && famille.anneau === anneau)).toBe(true)
    },
  )
})
