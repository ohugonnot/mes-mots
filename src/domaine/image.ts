/**
 * Réduit une photo en vignette avant stockage (P4), exactement le chemin prescrit
 * par projet/BIBLE.md : `imageOrientation: 'from-image'` applique l'orientation EXIF, que
 * `drawImage` seul ignore et qui pose sinon la photo couchée, piège classique des photos
 * de téléphone. L'original n'est jamais conservé, une case n'a besoin que de la vignette.
 */
export const COTE_VIGNETTE = 448

export async function redimensionnerImage(fichier: Blob): Promise<Blob> {
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' })
  // Contraindre les deux côtés à 448 déformait toute photo non carrée : une source de
  // 400 sur 200 ressortait en 448 sur 448, donc un visage écrasé. On borne le plus grand
  // côté et on garde les proportions. `min(1, …)` évite d'agrandir une petite image.
  const facteur = Math.min(1, COTE_VIGNETTE / Math.max(image.width, image.height))
  const largeur = Math.max(1, Math.round(image.width * facteur))
  const hauteur = Math.max(1, Math.round(image.height * facteur))

  const canevas = document.createElement('canvas')
  canevas.width = largeur
  canevas.height = hauteur
  const contexte = canevas.getContext('2d')
  if (!contexte) throw new Error('contexte de dessin indisponible')
  contexte.imageSmoothingQuality = 'high'
  contexte.drawImage(image, 0, 0, largeur, hauteur)
  image.close()

  return new Promise((resoudre, rejeter) => {
    canevas.toBlob(
      (vignette) => (vignette ? resoudre(vignette) : rejeter(new Error('export de la vignette impossible'))),
      'image/jpeg',
      0.85,
    )
  })
}
