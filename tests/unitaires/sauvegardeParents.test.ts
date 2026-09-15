import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SauvegardeParents from '../../src/composants/SauvegardeParents.vue'
import type { Configuration } from '../../src/domaine/planche'

/** Chiffres connus à la main : 1 contexte, 1 page, 2 cases dont 1 masquée, 1 image, 1 son. */
const CONFIGURATION_TEST: Configuration = {
  format: 'open-board-0.1',
  contextes: [
    {
      id: 'maison',
      name: 'Maison',
      pages: [
        {
          format: 'open-board-0.1',
          id: 'maison',
          locale: 'fr',
          name: 'Maison',
          grid: { rows: 1, columns: 2, order: [['a', 'b']] },
          buttons: [
            { id: 'a', label: 'A', vocalization: 'a', image_id: 'pictos/a.svg', sound_id: 'a' },
            { id: 'b', label: 'B', vocalization: 'b', hidden: true },
          ],
        },
      ],
    },
  ],
  barre: {
    format: 'open-board-0.1',
    id: 'barre',
    locale: 'fr',
    name: 'Barre',
    grid: { rows: 1, columns: 1, order: [[null]] },
    buttons: [],
  },
  reglages: { retourAutomatique: true, modifieDepuisSauvegarde: true, volume: 70, fermeteAppui: 'normal', animations: true, enchainement: false, corpsAToucher: true },
}

/** Le vrai serveur annonce toujours un type : sans lui la ressource est refusée, à dessein. */
function reponse(url: string, ok = true, statut = 200) {
  return {
    ok,
    status: statut,
    headers: { get: () => (url.includes('/sons/') ? 'audio/mpeg' : 'image/svg+xml') },
    arrayBuffer: async () => new ArrayBuffer(4),
  }
}

function stubFetchReussi() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => reponse(url)))
}

describe('SauvegardeParents', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('affiche des chiffres exacts, tirés de l inventaire réel et non recomptés à l écran', async () => {
    stubFetchReussi()
    const ecran = mount(SauvegardeParents, { props: { configuration: CONFIGURATION_TEST } })

    await ecran.get('[data-sauvegarder]').trigger('click')
    await flushPromises()

    expect(ecran.get('[data-cr-contextes]').text()).toContain('1')
    expect(ecran.get('[data-cr-pages]').text()).toContain('1')
    expect(ecran.get('[data-cr-mots-visibles]').text()).toBe('1')
    expect(ecran.get('[data-cr-mots-total]').text()).toBe('2')
    expect(ecran.get('[data-cr-images]').text()).toContain('1')
    expect(ecran.get('[data-cr-sons]').text()).toContain('1')
  })

  it('émet sauvegarder avec le drapeau modifieDepuisSauvegarde redescendu à false', async () => {
    stubFetchReussi()
    const ecran = mount(SauvegardeParents, { props: { configuration: CONFIGURATION_TEST } })

    await ecran.get('[data-sauvegarder]').trigger('click')
    await flushPromises()

    const emise = ecran.emitted('sauvegarder')![0]![0] as Configuration
    expect(emise.reglages.modifieDepuisSauvegarde).toBe(false)
  })

  it('signale une ressource manquante sans empêcher la sauvegarde du reste', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        reponse(url, !url.includes('pictos/a.svg'), url.includes('pictos/a.svg') ? 404 : 200),
      ),
    )
    const ecran = mount(SauvegardeParents, { props: { configuration: CONFIGURATION_TEST } })

    await ecran.get('[data-sauvegarder]').trigger('click')
    await flushPromises()

    expect(ecran.get('[data-ressources-manquantes]').text()).toContain('1')
    expect(ecran.emitted('sauvegarder')).toHaveLength(1)
  })
})
