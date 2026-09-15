import { describe, it, expect } from 'vitest'
import { formaterTaille } from '../../src/domaine/taille'

describe('formaterTaille, une taille lisible par un parent', () => {
  it('parle en Ko sous le méga, sans décimale', () => {
    expect(formaterTaille(217 * 1024)).toBe('217 Ko')
    expect(formaterTaille(0)).toBe('0 Ko')
  })

  it('parle en Mo puis en Go, avec une décimale et une virgule', () => {
    // le quota d'une tablette sortait en « 5120,9 » sans unité : cinq gigas comptés en mégas
    expect(formaterTaille(3.4 * 1024 * 1024)).toBe('3,4 Mo')
    expect(formaterTaille(5 * 1024 * 1024 * 1024)).toBe('5,0 Go')
  })
})
