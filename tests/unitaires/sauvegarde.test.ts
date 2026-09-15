import { describe, it, expect, vi, afterEach } from 'vitest'

const depotFactice = vi.hoisted(() => ({
  enregistrerImage: vi.fn(),
  enregistrerSon: vi.fn(),
  lireImage: vi.fn(),
  lireSon: vi.fn(),
}))
vi.mock('../../src/domaine/depot', () => depotFactice)

const { collecterRessources, nomFichierSauvegarde, restaurerRessourcesPersonnalisees } = await import(
  '../../src/domaine/sauvegarde'
)

describe('nomFichierSauvegarde', () => {
  it('tire AAAA-MM-JJ de la date ISO', () => {
    expect(nomFichierSauvegarde('2026-09-07T12:34:56.789Z')).toBe('mes-mots-2026-09-07.obz')
  })

  it('ne dépend pas de la partie horaire', () => {
    expect(nomFichierSauvegarde('2026-01-01T00:00:00.000Z')).toBe('mes-mots-2026-01-01.obz')
  })
})


/** Fabrique une réponse de `fetch` avec son type de contenu, que le vrai serveur renvoie. */
function reponse(octets: ArrayBuffer, type: string, ok = true, statut = 200) {
  return { ok, status: statut, headers: { get: () => type }, arrayBuffer: async () => octets }
}

describe('collecterRessources', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lit chaque chemin par fetch et rend ses octets', async () => {
    const contenu = (chemin: string) => new TextEncoder().encode(`contenu de ${chemin}`)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        reponse(contenu(url.slice(1)).buffer, url.endsWith('.svg') ? 'image/svg+xml' : 'audio/mpeg'),
      ),
    )

    const { ressources, manquantes } = await collecterRessources(['images/pictos/maman.svg', 'sons/maman.mp3'])

    expect(manquantes).toEqual([])
    expect(ressources.size).toBe(2)
    expect(ressources.get('images/pictos/maman.svg')).toEqual(contenu('images/pictos/maman.svg'))
    expect(ressources.get('sons/maman.mp3')).toEqual(contenu('sons/maman.mp3'))
  })

  it('omet une ressource introuvable au lieu de faire échouer la sauvegarde entière', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        reponse(new ArrayBuffer(3), 'audio/mpeg', url !== '/sons/absent.mp3', url === '/sons/absent.mp3' ? 404 : 200),
      ),
    )

    const { ressources, manquantes } = await collecterRessources(['sons/absent.mp3', 'sons/present.mp3'])

    expect(manquantes).toEqual(['sons/absent.mp3'])
    expect(ressources.has('sons/present.mp3')).toBe(true)
    expect(ressources.has('sons/absent.mp3')).toBe(false)
  })

  it('omet une ressource dont le fetch lève une exception', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('réseau indisponible')
      }),
    )

    const { ressources, manquantes } = await collecterRessources(['sons/maman.mp3'])

    expect(manquantes).toEqual(['sons/maman.mp3'])
    expect(ressources.size).toBe(0)
  })
})

describe('collecterRessources, photos et sons de la famille (P4, P8)', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('lit une image personnalisée dans le magasin, jamais par fetch', async () => {
    const image = new Blob(['une photo'])
    depotFactice.lireImage.mockResolvedValue(image)
    const fetchFactice = vi.fn()
    vi.stubGlobal('fetch', fetchFactice)

    const { ressources, manquantes } = await collecterRessources(['images/perso/maman'])

    expect(depotFactice.lireImage).toHaveBeenCalledWith('maman')
    expect(fetchFactice).not.toHaveBeenCalled()
    expect(manquantes).toEqual([])
    expect(ressources.get('images/perso/maman')).toEqual(new Uint8Array(await image.arrayBuffer()))
    vi.unstubAllGlobals()
  })

  it('lit un son personnalisé dans le magasin, jamais par fetch', async () => {
    const son = new Blob(['un son'])
    depotFactice.lireSon.mockResolvedValue(son)
    const fetchFactice = vi.fn()
    vi.stubGlobal('fetch', fetchFactice)

    const { ressources, manquantes } = await collecterRessources(['sons/perso/boire.mp3'])

    expect(depotFactice.lireSon).toHaveBeenCalledWith('boire')
    expect(fetchFactice).not.toHaveBeenCalled()
    expect(manquantes).toEqual([])
    expect(ressources.get('sons/perso/boire.mp3')).toEqual(new Uint8Array(await son.arrayBuffer()))
    vi.unstubAllGlobals()
  })

  it('omet une photo personnalisée absente du magasin, sans faire échouer la sauvegarde', async () => {
    depotFactice.lireImage.mockResolvedValue(undefined)

    const { ressources, manquantes } = await collecterRessources(['images/perso/maman'])

    expect(manquantes).toEqual(['images/perso/maman'])
    expect(ressources.size).toBe(0)
  })
})

describe('restaurerRessourcesPersonnalisees (P4, P8)', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('réécrit une image personnalisée dans son magasin', async () => {
    const octets = new Uint8Array([1, 2, 3])

    await restaurerRessourcesPersonnalisees(new Map([['images/perso/maman', octets]]))

    expect(depotFactice.enregistrerImage).toHaveBeenCalledWith('maman', expect.any(Blob))
    const blob = depotFactice.enregistrerImage.mock.calls[0]![1] as Blob
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(octets)
  })

  it('réécrit un son personnalisé dans son magasin', async () => {
    const octets = new Uint8Array([4, 5, 6])

    await restaurerRessourcesPersonnalisees(new Map([['sons/perso/boire.mp3', octets]]))

    expect(depotFactice.enregistrerSon).toHaveBeenCalledWith('boire', expect.any(Blob))
  })

  it('ignore les ressources livrées avec l application, jamais dans les magasins', async () => {
    await restaurerRessourcesPersonnalisees(new Map([['images/pictos/maman.svg', new Uint8Array([1])]]))

    expect(depotFactice.enregistrerImage).not.toHaveBeenCalled()
    expect(depotFactice.enregistrerSon).not.toHaveBeenCalled()
  })
})

describe('une page HTML n est pas une image', () => {
  it('refuse une ressource dont le type ne correspond pas, et la signale comme manquante', async () => {
    // Un serveur d'application à page unique rend 200 et sa page d'accueil pour tout chemin
    // inconnu. Sans ce contrôle, un pictogramme disparu d'une mise à jour partait dans
    // l'archive sous forme de HTML, et le compte rendu annonçait une image de plus.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/images/pictos/disparu.svg'
          ? reponse(new TextEncoder().encode('<!doctype html>').buffer, 'text/html')
          : reponse(new ArrayBuffer(4), 'image/svg+xml'),
      ),
    )

    const { ressources, manquantes } = await collecterRessources([
      'images/pictos/disparu.svg',
      'images/pictos/maman.svg',
    ])

    expect(manquantes).toEqual(['images/pictos/disparu.svg'])
    expect(ressources.has('images/pictos/disparu.svg')).toBe(false)
    expect(ressources.size).toBe(1)
  })
})

describe('le nom du fichier dit ce qu il contient (D16, D18)', () => {
  const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4])
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])

  afterEach(() => vi.unstubAllGlobals())

  it("nomme un enregistrement de la famille d'après son contenu, pas .mp3 par convention", async () => {
    depotFactice.lireSon.mockResolvedValue(new Blob([WEBM]))
    depotFactice.lireImage.mockResolvedValue(new Blob([JPEG]))

    const { ressources } = await collecterRessources(['sons/perso/moi.mp3', 'images/perso/moi'])

    expect([...ressources.keys()].sort()).toEqual(['images/perso/moi.jpg', 'sons/perso/moi.webm'])
  })

  it('rend au blob restauré son type réel, lu dans ses octets', async () => {
    await restaurerRessourcesPersonnalisees(
      new Map([
        ['sons/perso/moi.webm', WEBM],
        ['images/perso/moi.jpg', JPEG],
      ]),
    )

    expect(depotFactice.enregistrerSon.mock.calls[0]![1].type).toBe('audio/webm')
    expect(depotFactice.enregistrerImage.mock.calls[0]![1].type).toBe('image/jpeg')
  })

  it('restaure encore une archive faite avant, dont les noms mentaient', async () => {
    // `sons/perso/moi.mp3` contenant du WebM, `images/perso/moi` sans extension du tout :
    // ces fichiers existent déjà chez la famille, ils doivent continuer à se restaurer.
    await restaurerRessourcesPersonnalisees(
      new Map([
        ['sons/perso/moi.mp3', WEBM],
        ['images/perso/moi', JPEG],
      ]),
    )

    expect(depotFactice.enregistrerSon).toHaveBeenCalledWith('moi', expect.any(Blob))
    expect(depotFactice.enregistrerSon.mock.calls[0]![1].type).toBe('audio/webm')
    expect(depotFactice.enregistrerImage).toHaveBeenCalledWith('moi', expect.any(Blob))
  })
})
