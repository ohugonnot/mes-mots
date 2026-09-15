import { describe, it, expect } from 'vitest'
import { rapportDeContraste, ENCRE, CONTRASTE_MINIMAL } from '../../src/domaine/contraste'
import { PALETTE } from '../../src/domaine/palette'

describe('palette de l éditeur de case', () => {
  it('propose huit familles', () => {
    expect(PALETTE).toHaveLength(8)
  })

  it.each(PALETTE.map((f) => [f.nom, f.fond] as const))(
    'la famille %s tient le 7:1 exigé entre l encre et son fond d étiquette',
    (_nom, fond) => {
      expect(rapportDeContraste(ENCRE, fond)).toBeGreaterThanOrEqual(CONTRASTE_MINIMAL)
    },
  )
})
