import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RappelSauvegarde from '../../src/composants/RappelSauvegarde.vue'
import { CONFIGURATION_DEMO } from '../../src/domaine/plancheDemo'
import { toutesLesPlanches, type Configuration } from '../../src/domaine/planche'

describe('RappelSauvegarde', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('dit combien de mots contient la configuration actuelle', () => {
    const total = toutesLesPlanches(CONFIGURATION_DEMO).flatMap((p) => p.buttons).length
    const ecran = mount(RappelSauvegarde, { props: { configuration: CONFIGURATION_DEMO } })

    expect(ecran.get('[data-rappel-texte]').text()).toContain(String(total))
  })

  it('Plus tard émet plusTard sans avoir rien téléchargé', async () => {
    const ecran = mount(RappelSauvegarde, { props: { configuration: CONFIGURATION_DEMO } })

    await ecran.get('[data-plus-tard]').trigger('click')

    expect(ecran.emitted('plusTard')).toHaveLength(1)
    expect(ecran.emitted('sauvegarder')).toBeUndefined()
  })

  it('Enregistrer une sauvegarde émet sauvegarder avec le drapeau redescendu à false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(2) })),
    )
    const ecran = mount(RappelSauvegarde, { props: { configuration: CONFIGURATION_DEMO } })

    await ecran.get('[data-sauvegarder-rappel]').trigger('click')
    await flushPromises()

    const emise = ecran.emitted('sauvegarder')![0]![0] as Configuration
    expect(emise.reglages.modifieDepuisSauvegarde).toBe(false)
  })
})
