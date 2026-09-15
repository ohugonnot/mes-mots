import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { utiliserPhotoDeCase } from '../../src/composables/photoDeCase'

const lireImage = vi.fn()
vi.mock('../../src/domaine/depot', () => ({ lireImage: (id: string) => lireImage(id) }))

/** Composant minimal qui consomme le composable, pour le monter et le démonter à volonté. */
function porteur(reference: string) {
  return defineComponent({
    setup() {
      const { source } = utiliserPhotoDeCase(ref({ image_id: reference }))
      return () => h('img', { src: source.value ?? '' })
    },
  })
}

describe('utiliserPhotoDeCase ne fuit pas une URL d objet', () => {
  afterEach(() => vi.restoreAllMocks())

  it('ne crée aucune URL si le composant est démonté pendant la lecture', async () => {
    // Trouvé par les deux relecteurs : une lecture encore en vol au démontage créait une URL
    // que plus rien ne libérait, onUnmounted étant déjà passé et le watcher arrêté.
    let resoudre!: (image: Blob) => void
    lireImage.mockReturnValue(new Promise<Blob>((r) => (resoudre = r)))
    const creer = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fantome')
    const liberer = vi.spyOn(URL, 'revokeObjectURL')

    const ecran = mount(porteur('perso/maman'))
    ecran.unmount()
    resoudre(new Blob(['image']))
    await Promise.resolve()
    await Promise.resolve()

    expect(creer).not.toHaveBeenCalled()
    expect(liberer).not.toHaveBeenCalled()
  })

  it('libère l URL créée quand le composant se démonte après la lecture', async () => {
    lireImage.mockResolvedValue(new Blob(['image']))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:vivante')
    const liberer = vi.spyOn(URL, 'revokeObjectURL')

    const ecran = mount(porteur('perso/maman'))
    await Promise.resolve()
    await Promise.resolve()
    ecran.unmount()

    expect(liberer).toHaveBeenCalledWith('blob:vivante')
  })
})
