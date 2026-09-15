/**
 * Les valeurs proposées aux parents pour les réglages de P9. Nommées par ce qu'un parent
 * observe chez son enfant, jamais par ce que le code mesure : « appuis assurés » se décide
 * en regardant une main, « 150 ms » ne se décide pas.
 */
export interface NiveauVolume {
  cle: 'bas' | 'normal' | 'fort'
  libelle: string
  pourcentage: number
}

/**
 * Trois repères nommés, qui se disent au téléphone : la mère est dyslexique et un
 * pourcentage ne se transmet pas de vive voix. Ils posent un niveau exact, que la
 * réglette permet ensuite d'affiner quand la pièce le demande.
 */
export const VOLUMES: NiveauVolume[] = [
  { cle: 'bas', libelle: 'Bas', pourcentage: 40 },
  { cle: 'normal', libelle: 'Normal', pourcentage: 70 },
  { cle: 'fort', libelle: 'Fort', pourcentage: 100 },
]

/** Plancher de la réglette : une tablette muette passe pour cassée, jamais pour réglée. */
export const VOLUME_MINIMUM = 10
export const VOLUME_MAXIMUM = 100

export interface NiveauFermete {
  cle: 'normal' | 'assure' | 'tres-assure'
  libelle: string
  aide: string
  dureeAppuiMinimaleMs: number
  delaiEntreActivationsMs: number
}

/**
 * Trois niveaux, du plus permissif au plus exigeant. Le premier est le comportement livré :
 * un enfant qui vise bien ne doit rien avoir à régler.
 */
export const FERMETES: NiveauFermete[] = [
  {
    cle: 'normal',
    libelle: 'Normal',
    aide: 'Le mot part dès que le doigt quitte la case, sans attente.',
    dureeAppuiMinimaleMs: 0,
    delaiEntreActivationsMs: 300,
  },
  {
    cle: 'assure',
    libelle: 'Appuis assurés',
    aide: "Il faut poser le doigt un court instant. Pour une main qui frôle l'écran en passant.",
    dureeAppuiMinimaleMs: 150,
    delaiEntreActivationsMs: 500,
  },
  {
    cle: 'tres-assure',
    libelle: 'Appuis très assurés',
    aide: 'Il faut vraiment appuyer. Pour des gestes involontaires marqués.',
    dureeAppuiMinimaleMs: 300,
    delaiEntreActivationsMs: 800,
  },
]

/** Le volume du lecteur, de 0 à 1, à partir du pourcentage réglé par le parent. */
export const volumeDe = (pourcentage: number): number => normaliserVolume(pourcentage) / 100

/**
 * Ramène à un pourcentage sûr tout ce qui peut arriver dans le champ : le nom d'un niveau
 * venu d'une configuration d'avant la réglette, une valeur hors bornes, un champ absent.
 * Point de conversion unique, appelé à la reprise du dépôt comme à la lecture d'une archive.
 */
export function normaliserVolume(valeur: unknown): number {
  const ancienNiveau = VOLUMES.find((niveau) => niveau.cle === valeur)
  if (ancienNiveau) return ancienNiveau.pourcentage
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return VOLUMES[1]!.pourcentage
  return Math.round(Math.min(VOLUME_MAXIMUM, Math.max(VOLUME_MINIMUM, valeur)))
}

export const fermeteDe = (cle: string): NiveauFermete =>
  FERMETES.find((niveau) => niveau.cle === cle) ?? FERMETES[0]!

/**
 * La tablette de l'enfant, en dur : le navigateur ne connaît pas la taille physique d'un
 * écran, et la forme de la grille se choisit pour son appareil, jamais pour la fenêtre d'où
 * la mère règle. Calibré sur la mesure à la règle de la BIBLE, 4,8 cm pour quatre colonnes.
 * Une autre tablette un jour, c'est ici que ça se change.
 */
const TABLETTE = { largeur: 800, hauteur: 1280, partGrille: 0.62, espacement: 14, pxParCm: 37.8 }

/** En dessous, une case devient difficile à viser pour un doigt d'enfant (cahier des charges). */
export const COTE_DE_CASE_MINIMUM_CM = 2.5

export const FORME_MINIMUM = 2
export const FORME_MAXIMUM = 8

/** Les deux côtés d'une case. Les espacements encadrent la grille autant qu'ils séparent
 *  les cases, d'où le `+ 1`. */
export function cotesDeCaseEnCm(colonnes: number, lignes: number): { largeur: number; hauteur: number } {
  const { largeur, hauteur, partGrille, espacement, pxParCm } = TABLETTE
  return {
    largeur: (largeur - espacement * (colonnes + 1)) / colonnes / pxParCm,
    hauteur: (hauteur * partGrille - espacement * (lignes + 1)) / lignes / pxParCm,
  }
}

/** Le côté que le doigt doit viser, donc le plus court des deux : c'est lui que le seuil borne. */
export function coteDeCaseEnCm(colonnes: number, lignes: number): number {
  const { largeur, hauteur } = cotesDeCaseEnCm(colonnes, lignes)
  return Math.min(largeur, hauteur)
}

/** Le chiffre tel qu'il se lit à l'écran des parents : une décimale, virgule française. */
export const coteDeCaseEcrit = (colonnes: number, lignes: number): string =>
  enCentimetres(coteDeCaseEnCm(colonnes, lignes))

const enCentimetres = (valeur: number) => valeur.toFixed(1).replace('.', ',')

/**
 * La taille d'une case, en un chiffre ou en deux. Retirer une colonne élargit les cases sans
 * les grandir en hauteur : n'afficher que le plus petit côté laissait le chiffre immobile
 * pendant que la mère touchait le compteur, et le réglage avait l'air cassé.
 */
export function tailleDeCaseEcrite(colonnes: number, lignes: number): string {
  const { largeur, hauteur } = cotesDeCaseEnCm(colonnes, lignes)
  const [enLargeur, enHauteur] = [enCentimetres(largeur), enCentimetres(hauteur)]
  if (enLargeur === enHauteur) return `${enLargeur} cm`
  return `${enLargeur} cm de large et ${enHauteur} cm de haut`
}
