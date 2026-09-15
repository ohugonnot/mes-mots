/**
 * Sauvegarde et restauration au format `.obz` (zip conforme Open Board Format).
 * Le choix du standard est expliqué dans projet/BIBLE.md section 4 : un lecteur tiers
 * doit pouvoir ouvrir l'archive même s'il ignore nos extensions `ext_mesmots_*`.
 *
 * Ce module ne touche jamais le système de fichiers ni le réseau : il reçoit les
 * ressources déjà lues (images, sons) et rend des octets, ce qui le rend testable
 * sans navigateur.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped, type Zippable } from 'fflate'
import {
  identifiantPersonnalise,
  imagePictogrammeLivre,
  REGLAGES_PAR_DEFAUT,
  sonLivre,
  toutesLesPlanches,
  type CaseCommunication,
  type Configuration,
  type Contexte,
  type Planche,
  type Reglages,
} from './planche'
import { normaliserVolume } from './reglages'

/** Ce qu'une archive contient, pour le dire à la famille avant et après. */
export interface Inventaire {
  date: string
  contextes: number
  pages: number
  cases: number
  casesRevelees: number
  images: number
  sons: number
  octets: number
}

/** Chemins des fichiers réellement référencés par la configuration, sans doublon. */
/**
 * Identifiant de la photo ou du son de la famille désigné par un chemin de ressource, ou
 * rien pour une ressource livrée. Un seul endroit pour cette lecture : elle était réécrite
 * dans la sauvegarde et dans le manifeste, et aurait divergé au premier changement.
 */
export function identifiantPersonnaliseDuChemin(chemin: string): string | undefined {
  if (chemin.startsWith('images/')) return identifiantPersonnalise(sansExtension(chemin.slice('images/'.length)))
  if (chemin.startsWith('sons/')) return identifiantPersonnalise(sansExtension(chemin.slice('sons/'.length)))
  return undefined
}

function sansExtension(chemin: string): string {
  return chemin.replace(/\.[a-z0-9]+$/i, '')
}

/**
 * Type réel d'un fichier, lu dans ses premiers octets. Le nom ment : le navigateur
 * enregistre en WebM ou en MP4 selon l'appareil, et l'archive nommait tout `.mp3`. Un
 * lecteur tiers, ou le parent qui ouvre le fichier, s'y trompait.
 */
export function typeDesOctets(octets: Uint8Array): string | undefined {
  const debutePar = (...valeurs: number[]) => valeurs.every((valeur, rang) => octets[rang] === valeur)
  if (debutePar(0x1a, 0x45, 0xdf, 0xa3)) return 'audio/webm'
  if (debutePar(0x4f, 0x67, 0x67, 0x53)) return 'audio/ogg'
  if (octets[4] === 0x66 && octets[5] === 0x74 && octets[6] === 0x79 && octets[7] === 0x70) return 'audio/mp4'
  if (debutePar(0x49, 0x44, 0x33) || (octets[0] === 0xff && (octets[1]! & 0xe0) === 0xe0)) return 'audio/mpeg'
  if (debutePar(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (debutePar(0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  return undefined
}

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

/** Nomme une ressource de la famille d'après son contenu réel. Les fichiers livrés avec
 *  l'application gardent leur nom, qui est déjà juste. */
export function cheminAvecVraieExtension(chemin: string, octets: Uint8Array): string {
  if (!identifiantPersonnaliseDuChemin(chemin)) return chemin
  const extension = EXTENSIONS[typeDesOctets(octets) ?? '']
  return extension ? `${sansExtension(chemin)}.${extension}` : chemin
}

export function ressourcesReferencees(configuration: Configuration): string[] {
  const chemins = new Set<string>()
  for (const planche of toutesLesPlanches(configuration)) {
    for (const contenu of planche.buttons) {
      if (contenu.image_id) chemins.add(`images/${contenu.image_id}`)
      if (contenu.sound_id) chemins.add(`sons/${contenu.sound_id}.mp3`)
    }
  }
  // l'image des boutons de contexte voyage avec le reste : sans elle, une sauvegarde
  // restaurée rendrait à l'enfant des mondes qu'il ne reconnaît plus
  for (const contexte of configuration.contextes) {
    if (contexte.ext_mesmots_image) chemins.add(`images/${contexte.ext_mesmots_image}`)
  }
  return [...chemins]
}

// Le zip suit la convention anglaise d'Open Board Format (lisibilité par un lecteur tiers),
// l'application sert ses sons en français : seule cette frontière traduit entre les deux.
function versCheminArchive(chemin: string): string {
  return chemin.startsWith('sons/') ? `sounds/${chemin.slice('sons/'.length)}` : chemin
}

function versCheminApplication(chemin: string): string {
  return chemin.startsWith('sounds/') ? `sons/${chemin.slice('sounds/'.length)}` : chemin
}

interface Manifeste {
  format: 'open-board-0.1'
  root: string
  paths: {
    boards: Record<string, string>
    images: Record<string, string>
    sounds: Record<string, string>
  }
  ext_mesmots_contextes: { id: string; name: string; pages: string[]; image?: string }[]
  ext_mesmots_barre: string
  ext_mesmots_reglages: Reglages
  ext_mesmots_date: string
}

function construireManifeste(
  configuration: Configuration,
  planches: Planche[],
  ressources: Map<string, Uint8Array>,
  date: string,
): Manifeste {
  const boards: Record<string, string> = {}
  for (const planche of planches) boards[planche.id] = `boards/${planche.id}.obf`

  const images: Record<string, string> = {}
  const sounds: Record<string, string> = {}
  for (const chemin of ressources.keys()) {
    if (chemin.startsWith('images/')) {
      images[chemin.slice('images/'.length)] = chemin
    } else if (chemin.startsWith('sons/')) {
      const idSon = sansExtension(chemin.slice('sons/'.length))
      sounds[idSon] = versCheminArchive(chemin)
    }
  }

  return {
    format: 'open-board-0.1',
    // La page de démarrage du premier contexte, à défaut la barre : toujours une planche réelle.
    root: `boards/${configuration.contextes[0]?.pages[0]?.id ?? configuration.barre.id}.obf`,
    paths: { boards, images, sounds },
    ext_mesmots_contextes: configuration.contextes.map((contexte) => ({
      id: contexte.id,
      name: contexte.name,
      pages: contexte.pages.map((page) => page.id),
      // sans elle, un contexte revient d'une sauvegarde sans son image, et l'enfant ne
      // reconnaît plus le bouton qui mène à ses mots
      ...(contexte.ext_mesmots_image ? { image: contexte.ext_mesmots_image } : {}),
    })),
    ext_mesmots_barre: configuration.barre.id,
    ext_mesmots_reglages: configuration.reglages,
    ext_mesmots_date: date,
  }
}

/** Contextes, pages et cases : le seul décompte identique qu'une archive existe ou non. */
function compterCases(configuration: Configuration) {
  const cases = toutesLesPlanches(configuration).flatMap((planche) => planche.buttons)
  return {
    contextes: configuration.contextes.length,
    pages: configuration.contextes.reduce((total, contexte) => total + contexte.pages.length, 0),
    cases: cases.length,
    casesRevelees: cases.filter((contenu) => contenu.hidden !== true).length,
  }
}

/** Toujours recompté depuis le contenu réel (planches, ressources) : jamais recopié d'un champ du manifeste. */
function calculerInventaire(
  configuration: Configuration,
  ressources: Map<string, Uint8Array>,
  date: string,
  octets: number,
): Inventaire {
  const chemins = [...ressources.keys()]
  return {
    ...compterCases(configuration),
    date,
    images: chemins.filter((chemin) => chemin.startsWith('images/')).length,
    sons: chemins.filter((chemin) => chemin.startsWith('sons/')).length,
    octets,
  }
}

/**
 * Les mêmes chiffres qu'un inventaire, sans date ni octets : pour comparer à la volée ce
 * qu'il y a sur la tablette à ce qu'une sauvegarde contient, sans construire d'archive
 * (B3, aperçu avant remplacement). Compte les ressources référencées, pas des octets lus :
 * contrairement à `calculerInventaire`, rien n'a encore pu manquer à l'appel.
 */
/**
 * Photos et voix de la famille que la configuration réclame mais que l'archive n'apporte
 * pas. La restauration ne garde que ce que le fichier contient : sans cet avertissement, le
 * parent remplace tout et découvre après coup des mots redevenus muets ou sans visage.
 */
export function mediasPersonnalisesManquants(
  configuration: Configuration,
  ressources: Map<string, Uint8Array>,
): { images: number; sons: number } {
  const cle = (chemin: string) => {
    const idPerso = identifiantPersonnaliseDuChemin(chemin)
    return idPerso ? `${chemin.startsWith('images/') ? 'images' : 'sons'}/${idPerso}` : undefined
  }
  const apportes = new Set([...ressources.keys()].map(cle))
  const manquants = ressourcesReferencees(configuration)
    .map(cle)
    .filter((reference): reference is string => !!reference && !apportes.has(reference))
  return {
    images: manquants.filter((reference) => reference.startsWith('images/')).length,
    sons: manquants.filter((reference) => reference.startsWith('sons/')).length,
  }
}

/**
 * Fait retomber sur le média livré avec l'application les références `perso/` que le
 * fichier n'apporte pas. Sans ce repli, un mot restauré gardait une référence vers une
 * photo et une voix effacées par la purge : il revenait muet et sans visage, alors que
 * l'aperçu de restauration promettait justement le contraire.
 */
export function replierSurLesMediasLivres(
  configuration: Configuration,
  ressources: Map<string, Uint8Array>,
): Configuration {
  const apportes = new Set(
    [...ressources.keys()].map((chemin) => {
      const idPerso = identifiantPersonnaliseDuChemin(chemin)
      return idPerso ? `${chemin.startsWith('images/') ? 'images' : 'sons'}/${idPerso}` : undefined
    }),
  )
  const replier = (reference: string | undefined, magasin: 'images' | 'sons', livre: (id: string) => string | undefined) => {
    const idPerso = identifiantPersonnalise(reference)
    if (!idPerso || apportes.has(`${magasin}/${idPerso}`)) return reference
    return livre(idPerso)
  }
  const replierPlanche = (planche: Planche): Planche => ({
    ...planche,
    buttons: planche.buttons.map((bouton) => ({
      ...bouton,
      image_id: replier(bouton.image_id, 'images', imagePictogrammeLivre),
      sound_id: replier(bouton.sound_id, 'sons', sonLivre),
    })),
  })
  return {
    ...configuration,
    contextes: configuration.contextes.map((contexte) => ({
      ...contexte,
      // Une image de bouton que le fichier n'apporte pas laisse le contexte sans dessin, et
      // non avec une référence morte : il n'existe aucun pictogramme livré à viser pour un
      // contexte, et `livrerLesNouveautes` repose celui des contextes livrés au démarrage.
      ext_mesmots_image: replier(contexte.ext_mesmots_image, 'images', () => undefined),
      pages: contexte.pages.map(replierPlanche),
    })),
    barre: replierPlanche(configuration.barre),
  }
}

export function inventaireActuel(configuration: Configuration): Omit<Inventaire, 'date' | 'octets'> {
  const chemins = ressourcesReferencees(configuration)
  return {
    ...compterCases(configuration),
    images: chemins.filter((chemin) => chemin.startsWith('images/')).length,
    sons: chemins.filter((chemin) => chemin.startsWith('sons/')).length,
  }
}

export function construireArchive(
  configuration: Configuration,
  ressources: Map<string, Uint8Array>,
): { octets: Uint8Array; inventaire: Inventaire } {
  const planches = toutesLesPlanches(configuration)
  const date = new Date().toISOString()

  const fichiers: Zippable = {}
  for (const planche of planches) {
    fichiers[`boards/${planche.id}.obf`] = strToU8(JSON.stringify(planche))
  }
  for (const [chemin, contenu] of ressources) {
    fichiers[versCheminArchive(chemin)] = contenu
  }
  fichiers['manifest.json'] = strToU8(
    JSON.stringify(construireManifeste(configuration, planches, ressources, date)),
  )

  const octets = zipSync(fichiers)
  return { octets, inventaire: calculerInventaire(configuration, ressources, date, octets.length) }
}

// --- Lecture ---
// Une archive illisible ne doit jamais casser l'application : chaque étape lève une
// erreur explicite en français, compréhensible par un parent, pas par un développeur.

/**
 * Cinquante mégaoctets une fois décompressé. Mesuré plutôt que choisi : les sons livrés
 * font 8 Ko pièce et les pictogrammes 6 Ko, donc une configuration complète de cinquante
 * mots avec photos de famille et voix enregistrées pèse de l'ordre de trois à quatre Mo.
 * La borne laisse dix fois cette marge, et arrête une archive piégée avant de figer la
 * tablette : un zip de 82 Ko peut contenir 80 Mo, et la décompression alloue tout d'un coup.
 */
/** Le seul format que ce lecteur sait interpréter. */
const FORMAT_OBF = 'open-board-0.1'

const TAILLE_DECOMPRESSEE_MAXIMALE = 50 * 1024 * 1024

function ouvrirZip(octets: Uint8Array): Unzipped {
  let cumul = 0
  try {
    return unzipSync(octets, {
      filter: (fichier) => {
        cumul += fichier.originalSize ?? 0
        if (cumul > TAILLE_DECOMPRESSEE_MAXIMALE) throw new Error('archive trop volumineuse')
        return true
      },
    })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'archive trop volumineuse') {
      throw new Error(
        'Cette sauvegarde est bien trop volumineuse pour être une sauvegarde de mots. ' +
          "Elle n'a pas été ouverte, pour ne pas bloquer la tablette.",
        { cause },
      )
    }
    throw new Error("Ce fichier n'est pas reconnu comme une sauvegarde : ce n'est pas une archive zip.", {
      cause,
    })
  }
}

function lireManifeste(fichiers: Unzipped): Manifeste {
  const brut = fichiers['manifest.json']
  if (!brut) {
    throw new Error("Ce fichier n'est pas reconnu comme une sauvegarde : il manque le manifeste.")
  }
  let manifeste: Partial<Manifeste>
  try {
    manifeste = JSON.parse(strFromU8(brut))
  } catch (cause) {
    throw new Error("Ce fichier n'est pas reconnu comme une sauvegarde : son manifeste est illisible.", {
      cause,
    })
  }
  if (!Array.isArray(manifeste.ext_mesmots_contextes) || typeof manifeste.ext_mesmots_barre !== 'string') {
    throw new Error(
      "Ce fichier n'est pas une sauvegarde de Mes mots : il lui manque les informations attendues.",
    )
  }
  // Un format inconnu était accepté en silence, constat du radar E5. Le lire quand même
  // reviendrait à deviner ce qu'il contient ; on refuse, et on dit quoi faire.
  if (manifeste.format !== FORMAT_OBF) {
    throw new Error(
      "Cette sauvegarde vient d'une version de l'application que celle-ci ne connaît pas. " +
        "Mettez l'application à jour, puis réessayez.",
    )
  }
  return manifeste as Manifeste
}

/** Reconstruit une case champ par champ depuis un JSON externe non fiable, plutôt que de le croire sur parole. */
function reconstruireCase(brut: Record<string, unknown>): CaseCommunication {
  const contenu: CaseCommunication = {
    id: brut.id as string,
    label: brut.label as string,
    vocalization: brut.vocalization as string,
  }
  if (brut.image_id !== undefined) contenu.image_id = brut.image_id as string
  if (brut.sound_id !== undefined) contenu.sound_id = brut.sound_id as string
  if (brut.background_color !== undefined) contenu.background_color = brut.background_color as string
  if (brut.border_color !== undefined) contenu.border_color = brut.border_color as string
  if (brut.hidden !== undefined) contenu.hidden = brut.hidden as boolean
  if (brut.ext_mesmots_enchaine !== undefined) {
    contenu.ext_mesmots_enchaine = brut.ext_mesmots_enchaine as string
  }
  // sans lui, un mot de la planche de la douleur revient d'une sauvegarde sans sa région et
  // disparaît du corps : il existe encore, mais plus rien ne le montre
  if (brut.ext_mesmots_zone !== undefined) contenu.ext_mesmots_zone = brut.ext_mesmots_zone as string
  return contenu
}

function ressembleAUnePlanche(valeur: unknown): valeur is Record<string, unknown> {
  if (typeof valeur !== 'object' || valeur === null) return false
  const p = valeur as Record<string, unknown>
  return (
    typeof p.id === 'string' &&
    typeof p.locale === 'string' &&
    typeof p.name === 'string' &&
    typeof p.grid === 'object' &&
    p.grid !== null &&
    Array.isArray((p.grid as Record<string, unknown>).order) &&
    Array.isArray(p.buttons)
  )
}

function lirePlanche(fichiers: Unzipped, id: string): Planche {
  const brut = fichiers[`boards/${id}.obf`]
  if (!brut) {
    throw new Error(`Cette sauvegarde est incomplète : la page « ${id} » est absente de l'archive.`)
  }
  let contenu: unknown
  try {
    contenu = JSON.parse(strFromU8(brut))
  } catch (cause) {
    throw new Error(`Cette sauvegarde est abîmée : la page « ${id} » n'est pas lisible.`, { cause })
  }
  if (!ressembleAUnePlanche(contenu)) {
    throw new Error(`Cette sauvegarde est abîmée : la page « ${id} » n'a pas la forme d'une planche.`)
  }
  const grille = contenu.grid as { rows: number; columns: number; order: (string | null)[][] }
  return {
    format: 'open-board-0.1',
    id: contenu.id as string,
    locale: contenu.locale as string,
    name: contenu.name as string,
    grid: { rows: grille.rows, columns: grille.columns, order: grille.order },
    buttons: (contenu.buttons as Record<string, unknown>[]).map(reconstruireCase),
    // la planche de la douleur se montre comme deux corps : sans ce drapeau elle revient
    // d'une sauvegarde en grille ordinaire, et les régions du dessin sont perdues
    ...(contenu.ext_mesmots_silhouette === true ? { ext_mesmots_silhouette: true } : {}),
  }
}

function lireRessources(fichiers: Unzipped): Map<string, Uint8Array> {
  const ressources = new Map<string, Uint8Array>()
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    if (chemin.startsWith('images/') || chemin.startsWith('sounds/')) {
      ressources.set(versCheminApplication(chemin), contenu)
    }
  }
  return ressources
}

export function lireArchive(
  octets: Uint8Array,
): { configuration: Configuration; inventaire: Inventaire; ressources: Map<string, Uint8Array> } {
  const fichiers = ouvrirZip(octets)
  const manifeste = lireManifeste(fichiers)

  const planchesParId = new Map<string, Planche>()
  const contextes: Contexte[] = manifeste.ext_mesmots_contextes.map((contexte) => ({
    id: contexte.id,
    name: contexte.name,
    ...(typeof contexte.image === 'string' ? { ext_mesmots_image: contexte.image } : {}),
    pages: contexte.pages.map((idPage) => {
      const planche = planchesParId.get(idPage) ?? lirePlanche(fichiers, idPage)
      planchesParId.set(idPage, planche)
      return planche
    }),
  }))
  const barre = lirePlanche(fichiers, manifeste.ext_mesmots_barre)

  const configuration: Configuration = {
    format: 'open-board-0.1',
    contextes,
    barre,
    // les défauts d'abord : une archive d'avant un réglage doit le recevoir éteint plutôt
    // que `undefined`, l'écran de l'enfant se décide sur ces booléens
    reglages: {
      ...REGLAGES_PAR_DEFAUT,
      ...manifeste.ext_mesmots_reglages,
      volume: normaliserVolume(manifeste.ext_mesmots_reglages?.volume),
    },
  }
  const ressources = lireRessources(fichiers)

  return {
    configuration,
    ressources,
    inventaire: calculerInventaire(configuration, ressources, manifeste.ext_mesmots_date ?? '', octets.length),
  }
}
