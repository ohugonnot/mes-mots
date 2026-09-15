import { describe, it, expect, vi, afterEach } from 'vitest'
import { redimensionnerImage, COTE_VIGNETTE } from '../../src/domaine/image'

/** happy-dom ne décode aucune vraie image : createImageBitmap et le canevas sont fabriqués. */
function fabriquerBitmap(width = 3000, height = 4000) {
  return { width, height, close: vi.fn() }
}

function preparerCanevas() {
  const dessiner = vi.fn()
  const vignette = new Blob(['vignette'], { type: 'image/jpeg' })
  const tailles: { largeur: number; hauteur: number }[] = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: dessiner,
    imageSmoothingQuality: 'low',
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
  ) {
    tailles.push({ largeur: this.width, hauteur: this.height })
    callback(vignette)
  })
  return { dessiner, vignette, tailles }
}

describe('redimensionnement d une photo (P4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('applique l orientation EXIF, piège classique des photos de téléphone', async () => {
    // Sans imageOrientation, drawImage seul pose la photo couchée (BIBLE.md).
    const creerBitmap = vi.fn().mockResolvedValue(fabriquerBitmap())
    vi.stubGlobal('createImageBitmap', creerBitmap)
    preparerCanevas()

    await redimensionnerImage(new Blob(['photo'], { type: 'image/jpeg' }))

    expect(creerBitmap).toHaveBeenCalledWith(expect.anything(), { imageOrientation: 'from-image' })
  })

  it('garde les proportions de la photo, jamais un visage écrasé', async () => {
    // Vérifié dans un vrai navigateur : contraindre les deux côtés faisait sortir une
    // source de 400 sur 200 en 448 sur 448. Toute photo non carrée était étirée.
    // source deux fois plus large que haute, et plus grande que la vignette
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fabriquerBitmap(900, 450)))
    const { tailles } = preparerCanevas()

    await redimensionnerImage(new Blob(['photo']))

    expect(tailles).toEqual([{ largeur: COTE_VIGNETTE, hauteur: COTE_VIGNETTE / 2 }])
  })

  it('borne le plus grand côté à la taille de la vignette', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fabriquerBitmap(3000, 4000)))
    const { tailles } = preparerCanevas()

    await redimensionnerImage(new Blob(['photo']))

    expect(tailles[0]!.hauteur).toBe(COTE_VIGNETTE)
    expect(tailles[0]!.largeur).toBe(Math.round((3000 / 4000) * COTE_VIGNETTE))
  })

  it('n agrandit jamais une petite photo, ça n ajouterait aucun détail', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fabriquerBitmap(120, 90)))
    const { tailles } = preparerCanevas()

    await redimensionnerImage(new Blob(['photo']))

    expect(tailles).toEqual([{ largeur: 120, hauteur: 90 }])
  })

  it('rend le blob JPEG produit par le canevas', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(fabriquerBitmap()))
    const { vignette } = preparerCanevas()

    const resultat = await redimensionnerImage(new Blob(['photo']))

    expect(resultat).toBe(vignette)
  })

  it('rejette un fichier qui n est pas une image lisible, sans rien casser', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockRejectedValue(new DOMException('image invalide', 'InvalidStateError')),
    )

    await expect(redimensionnerImage(new Blob(['ceci n est pas une image']))).rejects.toThrow()
  })
})
