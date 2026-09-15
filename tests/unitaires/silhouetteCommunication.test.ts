import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SilhouetteCommunication from '../../src/composants/SilhouetteCommunication.vue'
import { CONFIGURATION_DEMO } from '../../src/domaine/plancheDemo'
import type { Planche } from '../../src/domaine/planche'

const CORPS = CONFIGURATION_DEMO.contextes.find((c) => c.id === 'douleur')!.pages[0]! as Planche

describe('les deux corps de la planche « J\'ai mal »', () => {
  it('montre les deux côtés, jamais un seul', () => {
    const ecran = mount(SilhouetteCommunication, { props: { planche: CORPS } })

    expect(ecran.get('[data-corps="face"]').attributes('src')).toContain('face')
    expect(ecran.get('[data-corps="dos"]').attributes('src')).toContain('dos')
  })

  it('pose le ventre sur le corps de face et le dos sur celui de dos', () => {
    const ecran = mount(SilhouetteCommunication, { props: { planche: CORPS } })

    const parCorps = ecran.findAll('figure').map((figure) =>
      figure.findAll('[data-region]').map((region) => region.attributes('data-region')),
    )
    expect(parCorps[0]).toContain('mal-ventre')
    expect(parCorps[0]).not.toContain('mal-dos')
    expect(parCorps[1]).toContain('mal-dos')
    expect(parCorps[1]).not.toContain('mal-ventre')
  })

  it('donne deux régions à la main, une seule à la tête, sur chaque corps', () => {
    const ecran = mount(SilhouetteCommunication, { props: { planche: CORPS } })

    expect(ecran.findAll('[data-region="mal-main"]')).toHaveLength(4)
    expect(ecran.findAll('[data-region="mal-tete"]')).toHaveLength(2)
  })

  it('ne montre pas un mot masqué, comme la grille', async () => {
    const masquee: Planche = {
      ...CORPS,
      buttons: CORPS.buttons.map((c) => (c.id === 'mal-ventre' ? { ...c, hidden: true } : c)),
    }

    const ecran = mount(SilhouetteCommunication, { props: { planche: masquee } })

    expect(ecran.findAll('[data-region="mal-ventre"]')).toHaveLength(0)
    expect(ecran.findAll('[data-region="mal-tete"]')).toHaveLength(2)
  })

  it('dit le mot de la région touchée, avec la durée de l appui', async () => {
    const ecran = mount(SilhouetteCommunication, { props: { planche: CORPS } })
    const ventre = ecran.get('[data-region="mal-ventre"]')

    await ventre.trigger('pointerdown')
    await ventre.trigger('pointerup')

    const [id, debut, fin] = ecran.emitted('appuiSurCase')![0] as [string, number, number]
    expect(id).toBe('mal-ventre')
    // la durée sert aux protections d'appui : sans elle, un frôlement parlerait
    expect(fin).toBeGreaterThanOrEqual(debut)
  })

  it('garde le mot de la zone touchée, même si le doigt en sort avant de se lever', async () => {
    // Les régions épousent le dessin, donc certaines sont petites : le cou fait sept
    // millimètres de haut. Un doigt qui ripe de trois pixels obtenait le silence, sur
    // l'écran fait pour un moment où l'enfant a mal et où sa main est la moins sûre.
    const ecran = mount(SilhouetteCommunication, { props: { planche: CORPS } })
    const ventre = ecran.get('[data-region="mal-ventre"]')

    await ventre.trigger('pointerdown')
    await ventre.trigger('pointerleave')
    await ventre.trigger('pointerup')

    expect(ecran.emitted('appuiSurCase')?.[0]?.[0]).toBe('mal-ventre')
  })

  it('un geste annulé par le système ne fait rien dire', async () => {
    // un appel qui arrive, une notification : le navigateur reprend le pointeur
    const ecran = mount(SilhouetteCommunication, { props: { planche: CORPS } })
    const ventre = ecran.get('[data-region="mal-ventre"]')

    await ventre.trigger('pointerdown')
    await ventre.trigger('pointercancel')
    await ventre.trigger('pointerup')

    expect(ecran.emitted('appuiSurCase')).toBeUndefined()
  })
})
