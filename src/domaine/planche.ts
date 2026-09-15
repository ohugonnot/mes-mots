/**
 * Structures conformes au format Open Board Format (openboardformat.org).
 * Le choix du standard est expliqué dans projet/BIBLE.md section 4 : il permet
 * d'exporter vers d'autres applications de CAA si celle-ci n'est plus maintenue.
 */

export interface CaseCommunication {
  id: string
  /** Ce qui est écrit sur la case. */
  label: string
  /** Ce qui est prononcé. Champ OBF natif, distinct du label. */
  vocalization: string
  image_id?: string
  sound_id?: string
  /** Couleur pastel du bandeau d'étiquette. Champ OBF natif. */
  background_color?: string
  /** Couleur saturée de l'anneau. Champ OBF natif. */
  border_color?: string
  /** Case préparée mais pas encore montrée à l'enfant. */
  hidden?: boolean
  /** Mot à empiler en mode phrase. Extension propre au projet. */
  ext_mesmots_enchaine?: string
  /** Région du corps que ce mot occupe sur une planche silhouette (« ventre », « tete »…).
   *  Les contours vivent dans `silhouette.ts` : ils appartiennent au dessin, pas au mot. */
  ext_mesmots_zone?: string
}

export interface Planche {
  format: 'open-board-0.1'
  id: string
  locale: string
  name: string
  /** Positions explicites. Une case ne change jamais de place : c'est l'invariant du projet. */
  grid: {
    rows: number
    columns: number
    /** Matrice d'identifiants de cases. `null` signifie emplacement libre. */
    order: (string | null)[][]
  }
  buttons: CaseCommunication[]
  /** Cette planche se montre comme deux corps à toucher, et non comme une grille. Extension
   *  propre au projet : un lecteur tiers d'Open Board Format l'ignore et voit une planche
   *  ordinaire, ce que le format prévoit. */
  ext_mesmots_silhouette?: boolean
}

export interface Contexte {
  id: string
  name: string
  /** Image du bouton de contexte, en haut de l'écran de l'enfant. Il ne lit pas : sans elle,
   *  ses mondes ne se distinguent que par un mot écrit. Extension propre au projet. */
  ext_mesmots_image?: string
  /**
   * Les pages dans l'ordre du glissement. La première est celle du démarrage.
   * Chaque page est une planche à part entière, avec son propre identifiant : c'est ainsi
   * que toutes les fonctions d'édition continuent d'adresser une planche par son id.
   */
  pages: Planche[]
}

export interface Reglages {
  /** T6. Ramène l'enfant à sa page de départ quand personne ne le fait. */
  retourAutomatique: boolean
  /** B4. Vrai dès qu'une écriture a eu lieu depuis la dernière sauvegarde réussie. */
  modifieDepuisSauvegarde: boolean
  /** P9. Volume de 10 à 100, comme un curseur de tablette. Les trois niveaux nommés de
   *  `VOLUMES` n'en sont que des raccourcis. */
  volume: number
  /** P9. Clé d'un niveau de `FERMETES`, la tolérance aux appuis involontaires. */
  fermeteAppui: string
  /** La case vit-elle pendant que son mot est dit ? Demandé par la mère : sans attrait
   *  sensoriel, l'enfant décroche. Débrayable si un jour le mouvement le gêne. */
  animations: boolean
  /** La bande du haut garde-t-elle les mots les uns après les autres ? Éteint à la
   *  livraison : la combinaison s'enseigne, et rien ne dit qu'elle soit à la portée de
   *  L'enfant aujourd'hui. Voir projet/PLAN-ENCHAINEMENT.md. */
  enchainement: boolean
  /** « J'ai mal » se montre-t-il sur deux corps à toucher, ou en cases comme le reste de la
   *  tablette ? Les deux portent les mêmes mots à la même place : seule la forme change.
   *  Éteint à la livraison depuis le 15 septembre : les corps dessinés faisaient peur à
   *  L'enfant. Voir projet/PLAN-JAI-MAL-DEUX-MODES.md. */
  corpsAToucher: boolean
}

export const REGLAGES_PAR_DEFAUT: Reglages = {
  retourAutomatique: true,
  modifieDepuisSauvegarde: false,
  volume: 70,
  fermeteAppui: 'normal',
  animations: true,
  enchainement: false,
  corpsAToucher: false,
}

export interface Configuration {
  format: 'open-board-0.1'
  /**
   * Tout ce que l'application a déjà proposé à cette tablette : identifiants de contextes,
   * de pages et de mots. Sert à n'offrir un ajout qu'une seule fois. Sans cette mémoire, un
   * mot que la famille a supprimé reviendrait à chaque mise à jour, ce qui est pire que de
   * ne rien livrer. Extension propre au projet.
   */
  ext_mesmots_livraisons?: string[]
  /** Les contextes dans l'ordre de leurs boutons. Le premier est celui du démarrage. */
  contextes: Contexte[]
  /**
   * Barre des mots essentiels, visible dans tous les contextes. Ses cinq emplacements
   * sont figés dès la première version : la convention du domaine veut ces mots toujours
   * visibles, la famille les veut plus tard, et créer les emplacements le jour de la
   * révélation recomposerait la barre et détruirait la mémoire du geste.
   */
  barre: Planche
  reglages: Reglages
}

/** Page dont aucune case n'est révélée : L'enfant n'y trouverait rien, elle est une impasse. */
export function pageAtteignable(planche: Planche): boolean {
  return planche.grid.order.flat().some((id) => {
    if (id === null) return false
    const contenu = caseParIdentifiant(planche, id)
    // `hidden` absent vaut révélée : le confondre avec masquée vidait tous les contextes
    return contenu !== undefined && contenu.hidden !== true
  })
}

/** Contexte sans une seule page atteignable : son bouton ne s'affiche pas (T5). */
export function contextePorteBouton(contexte: Contexte): boolean {
  return contexte.pages.some(pageAtteignable)
}

/** Ce que l'enfant peut parcourir dans ce contexte, dans l'ordre du glissement (T7, T8). */
export function pagesAtteignables(contexte: Contexte): Planche[] {
  return contexte.pages.filter(pageAtteignable)
}

export function caseParIdentifiant(planche: Planche, id: string): CaseCommunication | undefined {
  return planche.buttons.find((c) => c.id === id)
}

const PREFIXE_PERSO = 'perso/'

/**
 * Rend l'identifiant de case si `reference` est une photo ou un son ajouté par la famille
 * (`perso/<idCase>`, P4 et P8), undefined si elle pointe une ressource livrée avec
 * l'application (`/images/` ou `/sons/`). Seul point de ce discernement dans tout le code.
 */
export function identifiantPersonnalise(reference: string | undefined): string | undefined {
  return reference?.startsWith(PREFIXE_PERSO) ? reference.slice(PREFIXE_PERSO.length) : undefined
}

/**
 * Les identifiants des photos et des sons que la famille a fournis, séparés par magasin.
 * Sert à repérer ce qui n'est plus référencé après une restauration : sans ça les blobs de
 * l'ancienne configuration restent pour toujours, sur un appareil où la place manque.
 */
export function identifiantsPersonnalises(configuration: Configuration): {
  images: string[]
  sons: string[]
} {
  const cases = toutesLesPlanches(configuration).flatMap((planche) => planche.buttons)
  const retenir = (references: (string | undefined)[]) => [
    ...new Set(references.map(identifiantPersonnalise).filter((id): id is string => !!id)),
  ]
  return {
    // l'image d'un contexte compte comme celle d'une case : sans elle dans cette liste, le
    // balayage des orphelins effacerait au démarrage suivant la photo que le parent vient
    // de choisir pour un bouton
    images: retenir([
      ...cases.map((c) => c.image_id),
      ...configuration.contextes.map((contexte) => contexte.ext_mesmots_image),
    ]),
    sons: retenir(cases.map((c) => c.sound_id)),
  }
}

/**
 * Inverse `hidden` sur une case, sans jamais toucher `grid.order` ni l'ordre de `buttons` :
 * c'est LA promesse du projet (P5). Planche ou case inconnue : configuration inchangée,
 * la famille ne doit jamais voir un écran mort.
 */
export function basculerVisibilite(
  configuration: Configuration,
  idPlanche: string,
  idCase: string,
): Configuration {
  const planche = trouverPlanche(configuration, idPlanche)
  if (!planche || !caseParIdentifiant(planche, idCase)) return configuration

  const plancheBasculee: Planche = {
    ...planche,
    buttons: planche.buttons.map((c) =>
      // `hidden` absent vaut révélée : toujours écrire true/false, jamais laisser le champ ambigu
      c.id === idCase ? { ...c, hidden: !(c.hidden ?? false) } : c,
    ),
  }

  return remplacerPlanche(configuration, plancheBasculee)
}

/** B4 : toute écriture de configuration doit passer par ici pour lever le rappel de sauvegarde. */
export function marquerModifiee(configuration: Configuration): Configuration {
  return { ...configuration, reglages: { ...configuration.reglages, modifieDepuisSauvegarde: true } }
}

/** B4 : seules une sauvegarde ou une restauration réussies redescendent le drapeau. */
export function marquerSauvegardee(configuration: Configuration): Configuration {
  return { ...configuration, reglages: { ...configuration.reglages, modifieDepuisSauvegarde: false } }
}

/** Toutes les planches de la configuration : les pages de chaque contexte, puis la barre. */
/**
 * Déplace une case vers un emplacement libre de la même planche (P6). Un mot ne change
 * jamais de page, c'est l'invariant du projet : on ne déplace donc qu'à l'intérieur d'une
 * planche. Et aucune autre case ne bouge, parce que `grid.order` est une matrice de
 * positions et non une liste qu'on réordonne, ce qui est exactement le reproche fait à
 * Cboard, où déplacer un bouton décale toute la ligne.
 */
/** Position d'une case dans une planche, ou rien si elle n'y est pas. */
function positionDe(planche: Planche, idCase: string): { ligne: number; colonne: number } | undefined {
  return planche.grid.order
    .flatMap((rangee, ligne) => rangee.map((id, colonne) => (id === idCase ? { ligne, colonne } : null)))
    .find((position) => position !== null) ?? undefined
}

function sansIdentifiant(order: (string | null)[][], idCase: string): (string | null)[][] {
  return order.map((rangee) => rangee.map((id) => (id === idCase ? null : id)))
}

function avecIdentifiant(
  order: (string | null)[][],
  ligne: number,
  colonne: number,
  idCase: string,
): (string | null)[][] {
  return order.map((rangee, indexLigne) =>
    rangee.map((id, indexColonne) => (indexLigne === ligne && indexColonne === colonne ? idCase : id)),
  )
}

export function deplacerCase(
  configuration: Configuration,
  idPlancheDepart: string,
  idCase: string,
  idPlancheArrivee: string,
  ligne: number,
  colonne: number,
): Configuration {
  const depart = trouverPlanche(configuration, idPlancheDepart)
  const arrivee = trouverPlanche(configuration, idPlancheArrivee)
  if (!depart || !arrivee) return configuration
  if (arrivee.grid.order[ligne]?.[colonne] !== null) return configuration
  const contenu = caseParIdentifiant(depart, idCase)
  const origine = positionDe(depart, idCase)
  if (!contenu || !origine) return configuration

  if (depart.id === arrivee.id) {
    const order = depart.grid.order.map((rangee, indexLigne) =>
      rangee.map((id, indexColonne) => {
        if (indexLigne === origine.ligne && indexColonne === origine.colonne) return null
        if (indexLigne === ligne && indexColonne === colonne) return idCase
        return id
      }),
    )
    return remplacerPlanche(configuration, { ...depart, grid: { ...depart.grid, order } })
  }

  // D'une page à l'autre, le mot change de planche : il quitte aussi `buttons`, sinon il
  // resterait déclaré dans la page de départ, sans emplacement, invisible et inatteignable.
  const departModifie: Planche = {
    ...depart,
    grid: { ...depart.grid, order: sansIdentifiant(depart.grid.order, idCase) },
    buttons: depart.buttons.filter((autre) => autre.id !== idCase),
  }
  const arriveeModifiee: Planche = {
    ...arrivee,
    grid: { ...arrivee.grid, order: avecIdentifiant(arrivee.grid.order, ligne, colonne, idCase) },
    buttons: [...arrivee.buttons, contenu],
  }
  return remplacerPlanche(remplacerPlanche(configuration, departModifie), arriveeModifiee)
}

export function echangerCases(
  configuration: Configuration,
  idPlancheA: string,
  idA: string,
  idPlancheB: string,
  idB: string,
): Configuration {
  if (idA === idB) return configuration
  const plancheA = trouverPlanche(configuration, idPlancheA)
  const plancheB = trouverPlanche(configuration, idPlancheB)
  if (!plancheA || !plancheB) return configuration
  const a = positionDe(plancheA, idA)
  const b = positionDe(plancheB, idB)
  const contenuA = caseParIdentifiant(plancheA, idA)
  const contenuB = caseParIdentifiant(plancheB, idB)
  if (!a || !b || !contenuA || !contenuB) return configuration

  if (plancheA.id === plancheB.id) {
    const order = plancheA.grid.order.map((rangee, ligne) =>
      rangee.map((id, colonne) => {
        if (ligne === a.ligne && colonne === a.colonne) return idB
        if (ligne === b.ligne && colonne === b.colonne) return idA
        return id
      }),
    )
    return remplacerPlanche(configuration, { ...plancheA, grid: { ...plancheA.grid, order } })
  }

  // Deux pages différentes : les mots échangent aussi de planche, donc de `buttons`.
  const aModifiee: Planche = {
    ...plancheA,
    grid: { ...plancheA.grid, order: avecIdentifiant(plancheA.grid.order, a.ligne, a.colonne, idB) },
    buttons: [...plancheA.buttons.filter((contenu) => contenu.id !== idA), contenuB],
  }
  const bModifiee: Planche = {
    ...plancheB,
    grid: { ...plancheB.grid, order: avecIdentifiant(plancheB.grid.order, b.ligne, b.colonne, idA) },
    buttons: [...plancheB.buttons.filter((contenu) => contenu.id !== idB), contenuA],
  }
  return remplacerPlanche(remplacerPlanche(configuration, aModifiee), bModifiee)
}

export function toutesLesPlanches(configuration: Configuration): Planche[] {
  return [...configuration.contextes.flatMap((contexte) => contexte.pages), configuration.barre]
}

/** Cherche une planche par id, pages des contextes puis barre : toutes les éditions en ont besoin. */
function trouverPlanche(configuration: Configuration, idPlanche: string): Planche | undefined {
  return toutesLesPlanches(configuration).find((planche) => planche.id === idPlanche)
}

function remplacerPlanche(configuration: Configuration, planche: Planche): Configuration {
  if (configuration.barre.id === planche.id) return { ...configuration, barre: planche }
  return {
    ...configuration,
    contextes: configuration.contextes.map((contexte) => ({
      ...contexte,
      pages: contexte.pages.map((page) => (page.id === planche.id ? planche : page)),
    })),
  }
}

/** Tous les identifiants de la configuration, pages et barre confondues. */
function tousLesIdentifiants(configuration: Configuration): Set<string> {
  return new Set(toutesLesPlanches(configuration).flatMap((planche) => planche.buttons.map((c) => c.id)))
}

/** Un mot réduit à ce qui peut servir d'identifiant, sans accent ni ponctuation. */
function enIdentifiant(mot: string): string {
  return mot
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Déduit un identifiant de case à partir de son mot. Un suffixe numérique règle une
 * collision, où qu'elle soit dans la configuration : un identifiant dupliqué casserait
 * `caseParIdentifiant` et ferait parler la mauvaise case.
 */
export function identifiantDepuisMot(mot: string, configuration: Configuration): string {
  // un mot fait de ponctuation ne laisse rien : un identifiant vide rendrait la case
  // inadressable, et les futurs noms de fichiers de P4 et P8 avec elle
  const base = enIdentifiant(mot) || 'case'

  const existants = tousLesIdentifiants(configuration)
  if (!existants.has(base)) return base
  let suffixe = 2
  while (existants.has(`${base}-${suffixe}`)) suffixe++
  return `${base}-${suffixe}`
}

export interface ChampsModifiables {
  label: string
  vocalization: string
  ext_mesmots_enchaine: string
  background_color: string
  border_color: string
}

/**
 * Ne touche que les champs listés : jamais `id`, `sound_id`, `image_id`, `hidden`,
 * `grid.order` ni l'ordre de `buttons`. Planche ou case inconnue : configuration inchangée.
 */
export function modifierCase(
  configuration: Configuration,
  idPlanche: string,
  idCase: string,
  champs: ChampsModifiables,
): Configuration {
  const planche = trouverPlanche(configuration, idPlanche)
  if (!planche || !caseParIdentifiant(planche, idCase)) return configuration

  const plancheModifiee: Planche = {
    ...planche,
    buttons: planche.buttons.map((c) => (c.id === idCase ? { ...c, ...champs } : c)),
  }
  return remplacerPlanche(configuration, plancheModifiee)
}

/**
 * Ce qu'un parent a fait d'une photo ou d'un son dans l'éditeur (P4, P8) : rien choisi,
 * une nouvelle capture à stocker, ou un retrait explicite. Protocole entre l'éditeur et
 * App.vue, pas un champ OBF : l'éditeur ne connaît ni le dépôt ni, à la création, l'identifiant
 * qui portera la ressource.
 */
export type MediaChoisi =
  | { statut: 'inchange' }
  | { statut: 'nouveau'; blob: Blob }
  | { statut: 'aucun' }

/**
 * Ce qui parlera pour cette case. La voix de la tablette n'intervient que faute de son :
 * on ne peut pas savoir si un enregistrement dit encore le texte affiché, donc on ne le
 * devine pas. Un mot sans son se lit, au lieu de rester muet.
 */
export type VoixDeCase =
  | { genre: 'perso'; idSon: string }
  | { genre: 'livre'; idSon: string }
  | { genre: 'synthese'; texte: string }

export function voixDeCase(contenu: CaseCommunication): VoixDeCase {
  const idPerso = identifiantPersonnalise(contenu.sound_id)
  if (idPerso) return { genre: 'perso', idSon: idPerso }
  if (contenu.sound_id) return { genre: 'livre', idSon: contenu.sound_id }
  return { genre: 'synthese', texte: contenu.vocalization }
}

/**
 * Pictogramme livré pour cette case, ou rien : MOI, OUI, NON n'en ont jamais eu, et un mot
 * créé par la famille non plus. Fabriquer `pictos/<id>.svg` par convention écrivait une
 * référence vers un fichier absent, et « Retirer la photo » laissait une case sans rien.
 * Sans référence, la case retombe sur son mot en grand, le repli conçu pour ça.
 */
export function imagePictogrammeLivre(idCase: string): string | undefined {
  return mediasLivres.get(idCase)?.image_id
}

/**
 * Les identifiants dont un MP3 est livré avec l'application. La graine se déclare ici au
 * chargement, dans le sens d'import qui existe déjà : importer la graine depuis le domaine
 * créerait un cycle dont l'initialisation dépendrait de l'ordre des imports.
 */
let mediasLivres: ReadonlyMap<string, { image_id?: string; sound_id?: string }> = new Map()
export function declarerVocabulaireLivre(
  cases: Iterable<Pick<CaseCommunication, 'id' | 'image_id' | 'sound_id'>>,
): void {
  mediasLivres = new Map([...cases].map((c) => [c.id, { image_id: c.image_id, sound_id: c.sound_id }]))
}

/**
 * MP3 livré pour cette case, ou rien. Un mot créé par la famille n'a aucun son livré :
 * lui fabriquer une référence vers un fichier absent le rendait muet en silence, et le
 * rappel « ce mot n'a pas de voix » ne se déclenchait pas, puisqu'un `sound_id` existait.
 */
export function sonLivre(idCase: string): string | undefined {
  return mediasLivres.get(idCase)?.sound_id
}

/**
 * Applique le choix du parent pour `image_id` ou `sound_id` (P4, P8). Séparé de
 * `modifierCase`, qui ne doit jamais toucher ces deux champs : corriger un mot ne doit
 * jamais effacer une photo ou un son en cours d'enregistrement.
 */
export function appliquerMediaChoisi(
  configuration: Configuration,
  idPlanche: string,
  idCase: string,
  champ: 'image_id' | 'sound_id',
  choix: MediaChoisi,
): Configuration {
  if (choix.statut === 'inchange') return configuration
  const planche = trouverPlanche(configuration, idPlanche)
  if (!planche || !caseParIdentifiant(planche, idCase)) return configuration

  // Les fichiers livrés avec l'application ne sont pas un état par défaut où l'on
  // reviendrait : ce sont des médias posés d'avance. Remplacer, c'est remplacer.
  const reference = choix.statut === 'nouveau' ? `${PREFIXE_PERSO}${idCase}` : undefined

  const plancheModifiee: Planche = {
    ...planche,
    buttons: planche.buttons.map((c) => (c.id === idCase ? { ...c, [champ]: reference } : c)),
  }
  return remplacerPlanche(configuration, plancheModifiee)
}

/** Pose une case déjà construite à une position donnée. Partagé par ajouterCase et sa restauration. */
function placerCaseALaPosition(
  configuration: Configuration,
  idPlanche: string,
  ligne: number,
  colonne: number,
  caseAPlacer: CaseCommunication,
): Configuration {
  const planche = trouverPlanche(configuration, idPlanche)
  if (!planche || planche.grid.order[ligne]?.[colonne] !== null) return configuration
  // Supprimer un mot, en recréer un au même libellé ailleurs, puis annuler la suppression
  // reposait l'ancien à côté du nouveau : deux cases sous le même identifiant, donc le même
  // blob de photo et de son pour deux mots sans rapport. Vérifier la position ne suffit pas.
  if (tousLesIdentifiants(configuration).has(caseAPlacer.id)) return configuration

  const grille = planche.grid.order.map((l, i) =>
    i === ligne ? l.map((id, j) => (j === colonne ? caseAPlacer.id : id)) : l,
  )
  const plancheModifiee: Planche = {
    ...planche,
    grid: { ...planche.grid, order: grille },
    buttons: [...planche.buttons, caseAPlacer],
  }
  return remplacerPlanche(configuration, plancheModifiee)
}

/**
 * Écrit la nouvelle case à `grid.order[ligne][colonne]` et l'ajoute en fin de `buttons`.
 * Refuse et rend la configuration inchangée si l'emplacement visé n'est pas `null` :
 * écraser une case existante serait la pire chose que ce logiciel puisse faire. La case
 * naît révélée, sans `sound_id` ni `image_id` (P4 et P8 les apporteront).
 */
export function ajouterCase(
  configuration: Configuration,
  idPlanche: string,
  ligne: number,
  colonne: number,
  champs: ChampsModifiables,
): Configuration {
  const id = identifiantDepuisMot(champs.label, configuration)
  return placerCaseALaPosition(configuration, idPlanche, ligne, colonne, {
    id,
    ...champs,
    hidden: false,
  })
}

/**
 * Remet une case complète à une position libre, avec `sound_id` et `image_id` d'origine.
 * C'est le mécanisme de l'annulation de suppression (P3) : contrairement à `ajouterCase`,
 * elle ne reconstruit pas la case depuis un formulaire, elle repose l'objet tel qu'il était.
 */
export function restaurerCase(
  configuration: Configuration,
  idPlanche: string,
  ligne: number,
  colonne: number,
  caseARestaurer: CaseCommunication,
): Configuration {
  return placerCaseALaPosition(configuration, idPlanche, ligne, colonne, caseARestaurer)
}

/**
 * Retire la case de `buttons` et remet son emplacement à `null` dans `grid.order`, sans
 * toucher aucun autre emplacement. Planche ou case inconnue : configuration inchangée.
 */
export function supprimerCase(
  configuration: Configuration,
  idPlanche: string,
  idCase: string,
): Configuration {
  const planche = trouverPlanche(configuration, idPlanche)
  if (!planche || !caseParIdentifiant(planche, idCase)) return configuration

  const plancheModifiee: Planche = {
    ...planche,
    grid: {
      ...planche.grid,
      order: planche.grid.order.map((ligne) => ligne.map((id) => (id === idCase ? null : id))),
    },
    buttons: planche.buttons.filter((c) => c.id !== idCase),
  }
  return remplacerPlanche(configuration, plancheModifiee)
}

/**
 * Cinq contextes au plus. Mesuré sur la tablette de 800 px : un bouton de six lettres occupe
 * 113 px et l'écart en vaut 14, donc un sixième nom un peu long sort de la barre, et l'écran
 * de l'enfant s'interdit le défilement.
 */
export const CONTEXTES_MAXIMUM = 5

/** Planche vide à la géométrie d'un modèle. Une seule source pour cette règle : la page
 *  fantôme montrée au parent, la page réellement créée et le premier écran d'un contexte
 *  neuf doivent avoir la même forme. */
function plancheVierge(modele: Planche, id: string, nom: string): Planche {
  const { rows, columns } = modele.grid
  return {
    format: 'open-board-0.1',
    id,
    locale: modele.locale,
    name: nom,
    grid: {
      rows,
      columns,
      order: Array.from({ length: rows }, () => Array<string | null>(columns).fill(null)),
    },
    buttons: [],
  }
}

/** Identifiant de contexte libre. Il sert aussi d'identifiant à sa première page, donc il
 *  doit éviter les deux familles à la fois. */
function identifiantDeContexte(nom: string, configuration: Configuration): string {
  const pris = new Set([
    ...configuration.contextes.map((contexte) => contexte.id),
    ...toutesLesPlanches(configuration).map((planche) => planche.id),
  ])
  const base = enIdentifiant(nom) || 'contexte'
  if (!pris.has(base)) return base
  let suffixe = 2
  while (pris.has(`${base}-${suffixe}`)) suffixe++
  return `${base}-${suffixe}`
}

/**
 * Le nom d'un contexte n'est pas décoratif : L'enfant ne lit pas, et deux boutons du même
 * nom ouvrent pour lui deux mondes qu'il ne peut pas distinguer. Comparé réduit, donc
 * « École » et « Ecole » sont un seul nom : c'est déjà cette égalité-là qui fait sortir le
 * suffixe `-2` de `identifiantDeContexte`. `idAExclure` laisse un contexte garder le sien.
 */
export function contexteDuMemeNom(
  configuration: Configuration,
  nom: string,
  idAExclure?: string,
): Contexte | undefined {
  const reduit = enIdentifiant(nom)
  return configuration.contextes.find(
    (contexte) => contexte.id !== idAExclure && enIdentifiant(contexte.name) === reduit,
  )
}

/**
 * Ajoute un contexte **en fin de liste**, jamais entre deux autres : L'enfant apprend la
 * place de « Maison » comme celle de « BOIRE », et rien ne se réordonne jamais. Il naît avec
 * une page vide et ne montrera son bouton qu'une fois un mot révélé, comme toute page.
 * Nom vide, nom déjà pris ou sixième contexte : configuration inchangée.
 */
export function ajouterContexte(configuration: Configuration, nom: string): Configuration {
  const propre = nom.trim()
  const modele = configuration.contextes[0]?.pages[0]
  if (!propre || !modele || configuration.contextes.length >= CONTEXTES_MAXIMUM) return configuration
  if (contexteDuMemeNom(configuration, propre)) return configuration

  const id = identifiantDeContexte(propre, configuration)
  return {
    ...configuration,
    contextes: [...configuration.contextes, { id, name: propre, pages: [plancheVierge(modele, id, propre)] }],
  }
}

/**
 * Change le nom, jamais l'identifiant : celui-ci adresse les planches, et les photos comme
 * les voix s'y rattachent. Les pages suivent le nom, qui n'en est qu'une copie.
 * Corriger « maison » en « Maison » reste permis : c'est son propre nom, pas un doublon.
 */
export function renommerContexte(configuration: Configuration, id: string, nom: string): Configuration {
  const propre = nom.trim()
  if (!propre || !configuration.contextes.some((contexte) => contexte.id === id)) return configuration
  if (contexteDuMemeNom(configuration, propre, id)) return configuration
  return {
    ...configuration,
    contextes: configuration.contextes.map((contexte) =>
      contexte.id === id
        ? { ...contexte, name: propre, pages: contexte.pages.map((page) => ({ ...page, name: propre })) }
        : contexte,
    ),
  }
}

/**
 * Pose l'image du bouton d'un contexte, celle que l'enfant reconnaît en haut de son écran.
 * Rien d'autre ne bouge : ni le nom, ni les pages, ni un seul mot.
 */
export function changerImageDeContexte(
  configuration: Configuration,
  id: string,
  image: string,
): Configuration {
  if (!configuration.contextes.some((contexte) => contexte.id === id)) return configuration
  return {
    ...configuration,
    contextes: configuration.contextes.map((contexte) =>
      contexte.id === id ? { ...contexte, ext_mesmots_image: image } : contexte,
    ),
  }
}

/** La clé du magasin d'images pour la photo d'un contexte, distincte de celle d'une case. */
export const imagePersonnaliseeDeContexte = (idContexte: string): string =>
  `${PREFIXE_PERSO}contexte-${idContexte}`

/**
 * Retire un contexte et tout ce qu'il porte. Refuse le dernier restant : L'enfant se
 * retrouverait sans aucun mot, et rien ne permettrait d'en recréer un, faute de modèle de
 * géométrie.
 */
export function supprimerContexte(configuration: Configuration, id: string): Configuration {
  if (configuration.contextes.length <= 1) return configuration
  if (!configuration.contextes.some((contexte) => contexte.id === id)) return configuration
  return { ...configuration, contextes: configuration.contextes.filter((contexte) => contexte.id !== id) }
}

/**
 * Ce contexte a-t-il sa place ici ? La même question se pose pour une suppression qu'on
 * annule et pour une planche qui arrive d'un fichier : la place a pu être prise par un
 * contexte, par une page ou par un mot du même identifiant. Sans cette vérité, trois clics
 * suffisaient à fabriquer six contextes ou deux cases de même identifiant, ce que
 * `caseParIdentifiant` ne sait pas départager.
 */
export function contextePeutEntrer(configuration: Configuration, contexte: Contexte): boolean {
  if (configuration.contextes.length >= CONTEXTES_MAXIMUM) return false
  const identifiantsPris = new Set([
    ...configuration.contextes.map((existant) => existant.id),
    ...toutesLesPlanches(configuration).map((planche) => planche.id),
  ])
  if (identifiantsPris.has(contexte.id)) return false
  if (contexte.pages.some((page) => identifiantsPris.has(page.id))) return false
  const casesPrises = tousLesIdentifiants(configuration)
  return !contexte.pages.some((page) => page.buttons.some((contenu) => casesPrises.has(contenu.id)))
}

/**
 * Ajoute à la configuration les contextes d'une autre, sans toucher à ce qui existe. C'est
 * la seule façon de livrer une planche toute faite à une famille déjà installée : la graine
 * ne s'applique qu'au premier lancement, et restaurer une sauvegarde remplacerait son
 * travail. Ce qui ne peut pas entrer est nommé plutôt que fondu en silence.
 */
export function fusionnerContextes(
  courante: Configuration,
  apportee: Configuration,
): { configuration: Configuration; ajoutes: Contexte[]; refuses: string[] } {
  let resultat = courante
  const ajoutes: Contexte[] = []
  const refuses: string[] = []
  for (const contexte of apportee.contextes) {
    if (!contextePeutEntrer(resultat, contexte)) {
      refuses.push(contexte.name)
      continue
    }
    resultat = { ...resultat, contextes: [...resultat.contextes, contexte] }
    ajoutes.push(contexte)
  }
  return { configuration: resultat, ajoutes, refuses }
}

/** Remet un contexte supprimé à sa place d'origine, pour que l'annulation ne déplace pas les
 *  boutons une seconde fois. */
export function restaurerContexte(
  configuration: Configuration,
  contexte: Contexte,
  rang: number,
): Configuration {
  if (!contextePeutEntrer(configuration, contexte)) return configuration
  const contextes = [...configuration.contextes]
  contextes.splice(Math.min(Math.max(rang, 0), contextes.length), 0, contexte)
  return { ...configuration, contextes }
}

/**
 * Page entièrement vide, calquée sur la première page du contexte. Une seule source pour
 * cette règle : la page fantôme montrée au parent et la page réellement créée doivent être
 * la même, sinon poser un mot changerait la géométrie sous ses yeux.
 */
export function pageVierge(contexte: Contexte, idPage: string): Planche | undefined {
  const modele = contexte.pages[0]
  return modele && plancheVierge(modele, idPage, contexte.name)
}

/**
 * Une page d'accueil vide n'est proposée que si la dernière page réelle du contexte a déjà
 * au moins une case révélée, sinon deux pages vides s'enchaîneraient sans que personne ne
 * les remplisse jamais (Lot 3, espace parents).
 */
export function nouvellePageAtteignable(contexte: Contexte): boolean {
  const derniere = contexte.pages.at(-1)
  return derniere !== undefined && pageAtteignable(derniere)
}

/** Identifiant de page dérivé de celui du contexte, jamais un déjà pris (maison-p2, maison-p3...). */
function identifiantNouvellePage(idContexte: string, configuration: Configuration): string {
  return identifiantHorsDe(idContexte, new Set(toutesLesPlanches(configuration).map((p) => p.id)))
}

/** Un changement de forme crée plusieurs pages d'un coup : les identifiants qu'il vient de
 *  donner ne sont dans aucune configuration, il faut les tenir dans le même ensemble. */
function identifiantHorsDe(idContexte: string, pris: Set<string>): string {
  let suffixe = 2
  while (pris.has(`${idContexte}-p${suffixe}`)) suffixe++
  return `${idContexte}-p${suffixe}`
}

/**
 * Ajoute une page en fin de liste du contexte, avec la géométrie de sa première page et une
 * matrice entièrement vide, puis y pose la case à la position demandée : une seule opération
 * crée la page et son premier mot, sinon des pages vides s'empileraient sans que personne ne
 * les remplisse (Lot 3). Contexte inconnu ou position hors grille : configuration inchangée.
 * Aucune page existante n'est touchée.
 */
export function ajouterCaseSurNouvellePage(
  configuration: Configuration,
  idContexte: string,
  ligne: number,
  colonne: number,
  champs: ChampsModifiables,
): Configuration {
  const contexte = configuration.contextes.find((c) => c.id === idContexte)
  const vierge = contexte && pageVierge(contexte, identifiantNouvellePage(idContexte, configuration))
  if (!contexte || !vierge) return configuration
  if (ligne < 0 || ligne >= vierge.grid.rows || colonne < 0 || colonne >= vierge.grid.columns) {
    return configuration
  }

  const idCase = identifiantDepuisMot(champs.label, configuration)
  const nouvellePage: Planche = {
    ...vierge,
    grid: {
      ...vierge.grid,
      order: vierge.grid.order.map((l, i) => l.map((v, j) => (i === ligne && j === colonne ? idCase : v))),
    },
    buttons: [{ id: idCase, ...champs, hidden: false }],
  }

  return {
    ...configuration,
    contextes: configuration.contextes.map((c) =>
      c.id === idContexte ? { ...c, pages: [...c.pages, nouvellePage] } : c,
    ),
  }
}

export interface FormeDeGrille {
  colonnes: number
  lignes: number
}

export interface ConsequencesDeForme {
  /** Mots qui gardent leur ligne et leur colonne : L'enfant n'a rien à réapprendre d'eux. */
  gardes: number
  /** Mots dont la ligne ou la colonne disparaît, et qui partent sur une page nouvelle. */
  deplaces: number
  pagesCreees: number
}

/**
 * Le coût du changement, en français. Une seule source pour la ligne de l'écran et pour la
 * confirmation : elles annonçaient le même chiffre dans deux phrases écrites à la main, et
 * la seconde disait « 1 mots ». `avecReapprentissage` ajoute ce que la confirmation seule
 * doit dire, parce qu'à cet endroit la mère décide.
 */
export function consequenceEcrite(
  { gardes, deplaces, pagesCreees }: ConsequencesDeForme,
  avecReapprentissage = false,
): string {
  if (deplaces === 0) return 'Aucun mot ne changera de place.'
  const garderont =
    gardes === 0
      ? 'Aucun mot ne gardera sa place.'
      : gardes === 1
        ? '1 mot gardera sa place.'
        : `${gardes} mots garderont leur place.`
  // le compte de pages vient du même calcul que le déplacement lui-même : annoncer « une page »
  // pendant que la mère en reçoit trois lui ferait chercher ses mots là où ils ne sont pas
  const pages = pagesCreees === 1 ? 'une page nouvelle' : `${pagesCreees} pages nouvelles`
  const partiront =
    deplaces === 1
      ? `1 mot passera sur ${pages}, à la fin de son contexte`
      : `${deplaces} mots passeront sur ${pages}, à la fin de leur contexte`
  const reapprentissage = avecReapprentissage
    ? deplaces === 1
      ? ", et l'enfant devra en réapprendre l'emplacement"
      : ", et l'enfant devra en réapprendre les emplacements"
    : ''
  return `${garderont} ${partiront}${reapprentissage}.`
}

/** La forme en service, lue sur la première page de grille : la vérité vit dans les planches
 *  et non dans `Reglages`, sinon deux sources diraient un jour deux choses. */
export function formeDeGrille(configuration: Configuration): FormeDeGrille {
  const page = configuration.contextes.flatMap(planchesDeGrille)[0]
  return { colonnes: page?.grid.columns ?? 4, lignes: page?.grid.rows ?? 4 }
}

/** Les planches qui suivent la forme de la grille. La silhouette est un dessin de corps, pas
 *  une grille, et la barre a ses cinq emplacements figés depuis la première version. */
function planchesDeGrille(contexte: Contexte): Planche[] {
  return contexte.pages.filter((page) => page.ext_mesmots_silhouette !== true)
}

/**
 * Quatre colonnes, et non la forme réglée par la famille. La forme se change depuis l'espace
 * parents, et les planches ordinaires y gardent chaque mot à sa ligne et à sa colonne : les
 * replier d'après l'ordre de lecture ferait sauter « au ventre » d'une rangée à l'autre le
 * jour où la mère élargit la grille, sur l'écran que l'enfant touche quand il a mal, et le
 * message qui lui promet que rien ne bougera dit vrai pour tout le reste.
 */
const COLONNES_DOULEUR = 4

/**
 * La planche des corps rendue en cases, quand le parent a éteint le corps à toucher. Sa
 * matrice n'est pas une disposition : sur un dessin, c'est le dessin qui place les mots, et
 * `grid.order` ne dit que lesquels existent. Elle est rangée en deux rangées de cinq, ce qui
 * donnerait sur la tablette des cases de 143 px de large sur 375 de haut. On la replie donc,
 * sans rien réordonner : les mots gardent leur ordre de lecture, la ligne se replie plus tôt.
 *
 * Le repli ne s'enregistre pas. Une matrice corrigée dans la graine n'atteindrait jamais une
 * tablette en service, `livraison.ts` ajoutant sans jamais remodeler.
 */
export function silhouetteEnGrille(planche: Planche): Planche {
  const ids = planche.grid.order.flat().filter((id): id is string => id !== null)
  // jamais zéro rangée : une planche vide rendrait une grille sans ligne, et c'est ce qui
  // gelait la tablette sur une sauvegarde abîmée
  const lignes = Math.max(1, Math.ceil(ids.length / COLONNES_DOULEUR))
  const { ext_mesmots_silhouette: _corps, ...reste } = planche
  return {
    ...reste,
    grid: {
      rows: lignes,
      columns: COLONNES_DOULEUR,
      order: Array.from({ length: lignes }, (_, ligne) =>
        Array.from({ length: COLONNES_DOULEUR }, (_, colonne) => ids[ligne * COLONNES_DOULEUR + colonne] ?? null),
      ),
    },
  }
}

/** Les identifiants d'une page, dans l'ordre de lecture, séparés selon que leur emplacement
 *  existe encore à la nouvelle forme. Les mots masqués comptent comme les autres : ils
 *  occupent une place, et c'est cette place qui décide. */
function trierSelonLaNouvelleForme(planche: Planche, forme: FormeDeGrille) {
  const gardes: string[] = []
  const deplaces: string[] = []
  planche.grid.order.forEach((ligne, indexLigne) => {
    ligne.forEach((id, indexColonne) => {
      if (id === null) return
      const tientEncore = indexLigne < forme.lignes && indexColonne < forme.colonnes
      ;(tientEncore ? gardes : deplaces).push(id)
    })
  })
  return { gardes, deplaces }
}

/**
 * Ce que le changement de forme coûtera, avant qu'il soit fait : c'est ce que la mère lit
 * dans la ligne de conséquence et dans la confirmation. `changerFormeDeGrille` s'appuie sur
 * le même tri, pour que ce qu'on annonce et ce qu'on fait ne puissent pas diverger.
 */
export function consequencesDuChangementDeForme(
  configuration: Configuration,
  forme: FormeDeGrille,
): ConsequencesDeForme {
  const parPage = forme.lignes * forme.colonnes
  return configuration.contextes.reduce<ConsequencesDeForme>(
    (total, contexte) => {
      const tris = planchesDeGrille(contexte).map((page) => trierSelonLaNouvelleForme(page, forme))
      const deplaces = tris.reduce((somme, tri) => somme + tri.deplaces.length, 0)
      return {
        gardes: total.gardes + tris.reduce((somme, tri) => somme + tri.gardes.length, 0),
        deplaces: total.deplaces + deplaces,
        pagesCreees: total.pagesCreees + Math.ceil(deplaces / parPage),
      }
    },
    { gardes: 0, deplaces: 0, pagesCreees: 0 },
  )
}

/** La matrice d'une page retaillée : un identifiant dont la ligne et la colonne existent
 *  encore ne bouge pas, les emplacements nouveaux sont libres. */
function orderRetaille(ancien: (string | null)[][], forme: FormeDeGrille): (string | null)[][] {
  return Array.from({ length: forme.lignes }, (_, ligne) =>
    Array.from({ length: forme.colonnes }, (_, colonne) => ancien[ligne]?.[colonne] ?? null),
  )
}

/**
 * Réécrit toutes les pages de grille à la nouvelle forme. Les mots dont l'emplacement
 * disparaît vont sur des pages ajoutées en fin de contexte, dans l'ordre de lecture : aucun
 * n'est perdu, et la mère les redispose ensuite avec le déplacement de page à page. Ce que
 * cette fonction ne touche pas : la barre, la silhouette, les réglages, les médias.
 */
export function changerFormeDeGrille(
  configuration: Configuration,
  forme: FormeDeGrille,
): Configuration {
  // Une sauvegarde abîmée peut porter `rows: 0` : `ressembleAUnePlanche` ne regarde pas les
  // deux nombres, et une page sans ligne rend `parPage` nul, donc une boucle sans fin qui
  // gèle la tablette. Ne rien faire vaut mieux que ne plus rendre la main.
  if (forme.lignes < 1 || forme.colonnes < 1) return configuration
  const idsPris = new Set(toutesLesPlanches(configuration).map((planche) => planche.id))
  const parPage = forme.lignes * forme.colonnes

  return {
    ...configuration,
    contextes: configuration.contextes.map((contexte) => {
      const ramasses: CaseCommunication[] = []
      const pages = contexte.pages.map((page) => {
        if (page.ext_mesmots_silhouette === true) return page
        const { deplaces } = trierSelonLaNouvelleForme(page, forme)
        for (const id of deplaces) {
          const contenu = caseParIdentifiant(page, id)
          if (contenu) ramasses.push(contenu)
        }
        return {
          ...page,
          grid: { rows: forme.lignes, columns: forme.colonnes, order: orderRetaille(page.grid.order, forme) },
          buttons: page.buttons.filter((contenu) => !deplaces.includes(contenu.id)),
        }
      })

      const modele = pages.find((page) => page.ext_mesmots_silhouette !== true)
      const nouvelles: Planche[] = []
      for (let debut = 0; modele && debut < ramasses.length; debut += parPage) {
        const lot = ramasses.slice(debut, debut + parPage)
        const id = identifiantHorsDe(contexte.id, idsPris)
        idsPris.add(id)
        const vierge = plancheVierge(modele, id, contexte.name)
        nouvelles.push({
          ...vierge,
          grid: {
            ...vierge.grid,
            order: vierge.grid.order.map((ligne, indexLigne) =>
              ligne.map((_, indexColonne) => lot[indexLigne * forme.colonnes + indexColonne]?.id ?? null),
            ),
          },
          buttons: lot,
        })
      }

      return { ...contexte, pages: [...pages, ...nouvelles] }
    }),
  }
}
