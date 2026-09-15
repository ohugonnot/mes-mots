import { describe, it, expect, vi, beforeEach } from 'vitest'
import { openDBFactice } from './idbFactice'

/**
 * Photos et sons ajoutés par la famille (P4, P8). Vit à part de depot.test.ts pour la même
 * raison que depotConnexion.test.ts : il faut remplacer `idb` en entier.
 */
const etatBase = vi.hoisted(() => ({ version: 0, stores: new Map<string, Map<string, unknown>>(), panne: false }))

vi.mock('idb', () => ({ openDB: openDBFactice(etatBase) }))

describe('images et sons ajoutés par la famille', () => {
  beforeEach(() => {
    vi.resetModules()
    etatBase.version = 0
    etatBase.stores = new Map()
    etatBase.panne = false
  })

  it('enregistre puis relit une image par identifiant de case', async () => {
    const { enregistrerImage, lireImage } = await import('../../src/domaine/depot')
    const image = new Blob(['une photo'], { type: 'image/png' })

    await enregistrerImage('maman', image)
    const relue = await lireImage('maman')

    expect(relue).toBe(image)
  })

  it('rend undefined pour une image jamais enregistrée', async () => {
    const { lireImage } = await import('../../src/domaine/depot')

    expect(await lireImage('jamais-enregistree')).toBeUndefined()
  })

  it('efface une image enregistrée', async () => {
    const { enregistrerImage, effacerImage, lireImage } = await import('../../src/domaine/depot')

    await enregistrerImage('papa', new Blob(['photo de papa']))
    await effacerImage('papa')

    expect(await lireImage('papa')).toBeUndefined()
  })

  it('enregistre puis relit un son par identifiant de case', async () => {
    const { enregistrerSon, lireSon } = await import('../../src/domaine/depot')
    const son = new Blob(['un son'], { type: 'audio/webm' })

    await enregistrerSon('boire', son)

    expect(await lireSon('boire')).toBe(son)
  })

  it('rend undefined pour un son jamais enregistré', async () => {
    const { lireSon } = await import('../../src/domaine/depot')

    expect(await lireSon('jamais-enregistre')).toBeUndefined()
  })

  it('efface un son enregistré', async () => {
    const { enregistrerSon, effacerSon, lireSon } = await import('../../src/domaine/depot')

    await enregistrerSon('manger', new Blob(['son de manger']))
    await effacerSon('manger')

    expect(await lireSon('manger')).toBeUndefined()
  })

  it('image et son du même identifiant de case vivent dans deux magasins distincts', async () => {
    const { enregistrerImage, enregistrerSon, lireImage, lireSon } = await import('../../src/domaine/depot')
    const image = new Blob(['photo doudou'])
    const son = new Blob(['son doudou'])

    await enregistrerImage('doudou', image)
    await enregistrerSon('doudou', son)

    expect(await lireImage('doudou')).toBe(image)
    expect(await lireSon('doudou')).toBe(son)
  })

  it("un dépôt indisponible prive l enfant de sa photo sans faire planter l'écran", async () => {
    etatBase.panne = true
    const { lireImage, effacerImage } = await import('../../src/domaine/depot')
    const trace = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(await lireImage('maman')).toBeUndefined()
    await expect(effacerImage('maman')).resolves.toBeUndefined()
    expect(trace).toHaveBeenCalledTimes(2)
  })

  it("refuse d'affirmer qu'une photo est gardée quand le dépôt la rejette", async () => {
    // La lecture reste tolérante, l'écriture non : elle avalait son erreur, et le parent
    // repartait en croyant la voix de son enfant enregistrée alors qu'elle n'existait pas.
    etatBase.panne = true
    const { enregistrerImage, enregistrerSon } = await import('../../src/domaine/depot')

    await expect(enregistrerImage('maman', new Blob(['photo']))).rejects.toThrow()
    await expect(enregistrerSon('maman', new Blob(['voix']))).rejects.toThrow()
  })
})

describe('purgerRessourcesOrphelines, le seul rempart contre l accumulation après restauration', () => {
  // même remise à neuf que la section du dessus : sans elle, la panne simulée par un test
  // précédent rendait la purge muette, et zéro effacé se lisait comme un échec de la purge
  beforeEach(() => {
    vi.resetModules()
    etatBase.version = 0
    etatBase.stores = new Map()
    etatBase.panne = false
  })

  it('efface ce que personne ne garde et compte ce qu il efface, magasin par magasin', async () => {
    const { enregistrerImage, enregistrerSon, lireImage, lireSon, purgerRessourcesOrphelines } =
      await import('../../src/domaine/depot')
    await enregistrerImage('maman', new Blob(['a']))
    await enregistrerImage('papa', new Blob(['b']))
    await enregistrerSon('maman', new Blob(['c']))
    await enregistrerSon('loki', new Blob(['d']))

    const effaces = await purgerRessourcesOrphelines(['maman'], ['loki'])

    expect(effaces).toBe(2)
    expect(await lireImage('maman')).toBeDefined()
    expect(await lireImage('papa')).toBeUndefined()
    expect(await lireSon('loki')).toBeDefined()
    expect(await lireSon('maman')).toBeUndefined()
  })
})
