/**
 * Chrome sérialise `color-mix` et les couleurs modernes en `color(srgb 0.55 0.43 0.13)` et
 * non en `rgb()`, et ses canaux vont de 0 à 1. Tout test qui lit une couleur résolue par le
 * navigateur passe par ici, sinon ce piège se réapprend une fois par fichier de test.
 */
export function versHexadecimal(valeurCalculee: string): string {
  const enSrgb = valeurCalculee.match(/color\(srgb ([^)/]+)/)
  const enRgb = valeurCalculee.match(/rgba?\(([^)]+)\)/)
  const canaux = enSrgb
    ? enSrgb[1]!.trim().split(/\s+/).slice(0, 3).map((n) => Number.parseFloat(n) * 255)
    : enRgb![1]!.split(',').slice(0, 3).map((n) => Number.parseFloat(n))
  return '#' + canaux.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}
