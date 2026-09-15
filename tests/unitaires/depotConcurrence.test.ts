import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * D15 : deux onglets ouverts sur la même tablette partaient chacun de leur copie en
 * mémoire, et le second écrasait le travail du premier sans que rien ne le dise. Le magasin
 * est simulé ici, avec sa transaction : c'est elle qui garantit qu'aucun autre onglet ne se
 * glisse entre la lecture du numéro et l'écriture.
 */
const magasin = vi.hoisted(() => new Map<string, unknown>())

vi.mock('idb', () => ({
  openDB: () =>
    Promise.resolve({
      get: (_m: string, cle: string) => Promise.resolve(magasin.get(cle)),
      put: (_m: string, valeur: unknown, cle: string) => {
        magasin.set(cle, valeur)
        return Promise.resolve()
      },
      transaction: () => ({
        objectStore: () => ({
          get: (cle: string) => Promise.resolve(magasin.get(cle)),
          put: (valeur: unknown, cle: string) => {
            magasin.set(cle, valeur)
            return Promise.resolve()
          },
        }),
        abort: () => {},
        done: Promise.resolve(),
      }),
    }),
}))

describe('deux onglets qui écrivent la même configuration', () => {
  beforeEach(() => {
    magasin.clear()
    vi.resetModules()
  })

  it('laisse écrire tant que personne d autre n a touché au dépôt', async () => {
    const { chargerConfiguration, enregistrerConfiguration } = await import('../../src/domaine/depot')
    const { CONFIGURATION_DEMO } = await import('../../src/domaine/plancheDemo')

    const config = await chargerConfiguration(CONFIGURATION_DEMO)
    await enregistrerConfiguration(config)
    await enregistrerConfiguration(config)

    expect(magasin.get('version')).toBe(3)
  })

  it('refuse d écrire par-dessus un onglet plus récent, au lieu de l effacer', async () => {
    const { chargerConfiguration, enregistrerConfiguration, ConfigurationDepassee } = await import(
      '../../src/domaine/depot'
    )
    const { CONFIGURATION_DEMO } = await import('../../src/domaine/plancheDemo')

    const config = await chargerConfiguration(CONFIGURATION_DEMO)
    // l'autre onglet a enregistré entre-temps : le numéro en base a dépassé celui d'ici
    magasin.set('version', 7)

    await expect(enregistrerConfiguration(config)).rejects.toBeInstanceOf(ConfigurationDepassee)
    // et rien n'a été écrit : le travail de l'autre onglet est intact
    expect(magasin.get('version')).toBe(7)
  })

  it('dit au parent quoi faire, sans jargon', async () => {
    const { ConfigurationDepassee } = await import('../../src/domaine/depot')

    const message = new ConfigurationDepassee().message
    expect(message).toContain('Rechargez la page')
    expect(message).toContain('ouverte ailleurs')
  })

  it('repart proprement après un rechargement, qui relit le numéro en base', async () => {
    const { chargerConfiguration, enregistrerConfiguration } = await import('../../src/domaine/depot')
    const { CONFIGURATION_DEMO } = await import('../../src/domaine/plancheDemo')

    await chargerConfiguration(CONFIGURATION_DEMO)
    magasin.set('version', 7)
    // le parent recharge : la page relit le numéro et se remet au niveau
    const config = await chargerConfiguration(CONFIGURATION_DEMO)

    await expect(enregistrerConfiguration(config)).resolves.toBeUndefined()
    expect(magasin.get('version')).toBe(8)
  })
})
