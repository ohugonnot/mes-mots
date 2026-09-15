/**
 * Une taille en octets, lisible par un parent : « 217 Ko », « 3,4 Mo », « 5,0 Go ». Un seul
 * endroit pour ce savoir, le compte rendu de sauvegarde et le bloc d'état l'affichent tous
 * deux : le quota d'une tablette sortait en « 5120,9 » sans unité, cinq gigas en mégas.
 */
export function formaterTaille(octets: number): string {
  const Ko = 1024
  const Mo = Ko * 1024
  const Go = Mo * 1024
  const virgule = (n: number) => n.toFixed(1).replace('.', ',')
  if (octets >= Go) return `${virgule(octets / Go)} Go`
  if (octets >= Mo) return `${virgule(octets / Mo)} Mo`
  return `${Math.round(octets / Ko)} Ko`
}
