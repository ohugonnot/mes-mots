/**
 * Rapport de contraste WCAG entre deux couleurs hexadécimales.
 * Le projet exige 7:1 (niveau AAA) sur les étiquettes : voir projet/BIBLE.md section 6.
 */
function luminance(hex: string): number {
  const v = hex.replace('#', '')
  const canaux = [0, 2, 4].map((i) => Number.parseInt(v.slice(i, i + 2), 16) / 255)
  const lineaires = canaux.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lineaires[0]! + 0.7152 * lineaires[1]! + 0.0722 * lineaires[2]!
}

export function rapportDeContraste(a: string, b: string): number {
  const [haut, bas] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (haut + 0.05) / (bas + 0.05)
}

/** Couleur du texte des étiquettes, définie dans src/styles/base.css. */
export const ENCRE = '#12304f'
export const CONTRASTE_MINIMAL = 7
