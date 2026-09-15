import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { utiliserSonDeCase } from '../../src/composables/sonDeCase'

const lireSon = vi.fn()
vi.mock('../../src/domaine/depot', () => ({ lireSon: (id: string) => lireSon(id) }))

/** Composant minimal qui consomme le composable, pour le monter et le démonter à volonté. */
function porteur(reference: string | undefined) {
  return defineComponent({
    setup() {
      const { source } = utiliserSonDeCase(ref({ sound_id: reference }))
      return () => h('audio', { src: source.value ?? '' })
    },
  })
}

describe('utiliserSonDeCase', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sert le MP3 livré depuis le dossier public', () => {
    const ecran = mount(porteur('chambre'))

    expect(ecran.get('audio').attributes('src')).toBe('/sons/chambre.mp3')
  })

  it('lit la voix de la famille dans le dépôt et n en fait pas une URL de fichier', async () => {
    lireSon.mockResolvedValue(new Blob(['voix']))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:voix')

    const ecran = mount(porteur('perso/chambre'))
    await flushPromises()

    expect(lireSon).toHaveBeenCalledWith('chambre')
    expect(ecran.get('audio').attributes('src')).toBe('blob:voix')
  })

  it('libère l URL au démontage', async () => {
    lireSon.mockResolvedValue(new Blob(['voix']))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:voix')
    const liberer = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const ecran = mount(porteur('perso/chambre'))
    await flushPromises()
    ecran.unmount()

    expect(liberer).toHaveBeenCalledWith('blob:voix')
  })

  it('ne sert rien pour un mot sans voix', () => {
    const ecran = mount(porteur(undefined))

    expect(ecran.get('audio').attributes('src')).toBe('')
  })
})
