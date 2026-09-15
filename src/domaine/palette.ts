/**
 * Palette de couleurs proposée aux parents dans l'éditeur de case (P7). Extraite des
 * couleurs déjà en usage dans plancheDemo.ts : huit familles, dont OUI et NON qui gardent
 * leur anneau franc propre. Aucune saisie libre, pour garantir le 7:1 sur toute case créée.
 */
export interface FamilleCouleur {
  nom: string
  fond: string
  anneau: string
}

export const PALETTE: FamilleCouleur[] = [
  { nom: 'Personnes', fond: '#ffb8aa', anneau: '#ff7a6b' },
  { nom: 'Boissons et nourriture', fond: '#ffd25e', anneau: '#ffc93c' },
  { nom: 'Hygiène', fond: '#84d8d0', anneau: '#34c4b8' },
  { nom: 'Déplacements', fond: '#8ecbfa', anneau: '#3fa9f5' },
  { nom: 'Actions', fond: '#a9e18e', anneau: '#6fcf4c' },
  { nom: 'Objets doux', fond: '#cfbdfc', anneau: '#a78bfa' },
  { nom: 'Oui', fond: '#a9e18e', anneau: '#4caf50' },
  { nom: 'Non', fond: '#ffb8aa', anneau: '#e5533d' },
]

/** Les deux champs OBF de couleur d'une famille. La graine les prend ici plutôt que de
 *  recopier les valeurs : une couleur corrigée doit l'être à un seul endroit. */
export function couleursDe(nom: string): { background_color: string; border_color: string } {
  const famille = PALETTE.find((f) => f.nom === nom) ?? PALETTE[0]!
  return { background_color: famille.fond, border_color: famille.anneau }
}
