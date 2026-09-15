import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CONFIGURATION_DEMO } from '../../src/domaine/plancheDemo'
import { openDBFactice } from './idbFactice'

/**
 * Vit à part comme depotConnexion.test.ts et depotMigrationDrapeau.test.ts : il faut
 * remplacer `idb` en entier, ici pour rejouer une vraie montée de version 2 vers 4 sur une
 * base qui porte déjà un magasin `config`, sans passer par `images` ni `sons`.
 */
const etatBase = vi.hoisted(() => ({ version: 0, stores: new Map<string, Map<string, unknown>>(), panne: false }))

vi.mock('idb', () => ({ openDB: openDBFactice(etatBase) }))

/**
 * Un mot renommé par la famille, distinct de la graine : si la montée de version perdait
 * la configuration existante, `chargerConfiguration` retomberait sur la graine, et cette
 * différence est ce qui permet à un test de le voir.
 */
function configurationDeLaFamille() {
  return {
    ...CONFIGURATION_DEMO,
    contextes: [
      { ...CONFIGURATION_DEMO.contextes[0]!, name: "Maison de l'enfant" },
      ...CONFIGURATION_DEMO.contextes.slice(1),
    ],
  }
}

describe('montée de version 2 vers 4 (P4, P8)', () => {
  beforeEach(() => {
    vi.resetModules()
    etatBase.version = 2
    etatBase.panne = false
    etatBase.stores = new Map([['config', new Map([['configuration', configurationDeLaFamille()]])]])
  })

  it('garde une configuration déjà enregistrée et crée les magasins images et sons', async () => {
    const { chargerConfiguration } = await import('../../src/domaine/depot')

    const reprise = await chargerConfiguration(CONFIGURATION_DEMO)

    // reprise depuis la base, pas la graine réinjectée : la preuve que rien n'a été perdu
    expect(reprise.contextes[0]!.name).toBe("Maison de l'enfant")
    expect(etatBase.stores.has('images')).toBe(true)
    expect(etatBase.stores.has('sons')).toBe(true)
    // le magasin déjà présent n'a pas été recréé vide au passage
    expect(etatBase.stores.get('config')!.get('configuration')).toEqual(configurationDeLaFamille())
  })
})
