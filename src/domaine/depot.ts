import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { entreesDuJour, entreesPerimees, type EntreeJournal } from './journal'
import { normaliserVolume } from './reglages'
import { REGLAGES_PAR_DEFAUT, type Configuration, type Contexte, type Planche } from './planche'

/**
 * Forme enregistrée avant que les contextes prennent des pages : un contexte y était une
 * planche unique, et il n'y avait pas de réglages.
 */
export interface ConfigurationV2 {
  format: 'open-board-0.1'
  planches: Planche[]
  barre: Planche
}

/**
 * Dépôt local de la configuration (exigence T1). Rien ne sort de la tablette.
 *
 * Les magasins d'images et de sons (P4, P8) sont clés par identifiant de case : une photo
 * ou un son de la famille, jamais la configuration elle-même, qui ne porte qu'une référence
 * en texte (`perso/<idCase>`, voir `identifiantPersonnalise` dans planche.ts).
 */
interface SchemaMesMots extends DBSchema {
  config: { key: string; value: Configuration | ConfigurationV2 | Planche | number }
  images: { key: string; value: Blob }
  sons: { key: string; value: Blob }
  /** Le journal de la journée, clé par horodatage. Magasin à part et non dans la
   *  configuration : un appui ne doit pas réécrire tous les mots de la tablette. */
  journal: { key: number; value: EntreeJournal }
}

const NOM = 'mes-mots'
/**
 * 4 et non 3 : la forme de la configuration a changé une fois sans que la base ait besoin
 * de bouger, les contextes se reconnaissant au contenu de l'enregistrement. Le numéro suit
 * donc les magasins, pas le modèle. Il ne peut que monter, un retour en arrière ferait
 * échouer l'ouverture chez une famille déjà à jour.
 */
const VERSION = 5
const CLE = 'configuration'
/**
 * Numéro d'écriture de la configuration, monté d'un à chaque enregistrement (D15). Rangé à
 * part et non dans la configuration : il appartient au dépôt, pas au vocabulaire de
 * L'enfant, et il n'a rien à faire dans une sauvegarde `.obz`.
 */
const CLE_VERSION = 'version'
/** Clé de la version 1, quand une seule planche existait et qu'il n'y avait pas de barre. */
const CLE_V1 = 'planche'

/**
 * Connexion gardée : la rouvrir à chaque écriture allongeait la fenêtre pendant laquelle
 * un onglet fermé aussitôt après une modification la perdait sans rien dire.
 */
let connexion: Promise<IDBPDatabase<SchemaMesMots>> | null = null

function ouvrir(): Promise<IDBPDatabase<SchemaMesMots>> {
  // Une promesse rejetée retenue condamnerait toute la session : avant la mise en cache,
  // chaque écriture rouvrait, donc un échec passager ne coûtait qu'une écriture. On oublie
  // donc la connexion dès qu'elle échoue, pour que la tentative suivante reparte à neuf.
  connexion ??= openDB<SchemaMesMots>(NOM, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('config')) db.createObjectStore('config')
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images')
      if (!db.objectStoreNames.contains('sons')) db.createObjectStore('sons')
      if (!db.objectStoreNames.contains('journal')) db.createObjectStore('journal')
    },
  }).catch((cause) => {
    connexion = null
    throw cause
  })
  return connexion
}

/** Une planche seule devient un contexte d'une seule page, sans rien perdre au passage. */
function contexteDUnePage(planche: Planche): Contexte {
  return { id: planche.id, name: planche.name, pages: [planche] }
}

/**
 * Convertit une configuration v2 : chaque planche devient un contexte d'une seule page,
 * la barre est conservée telle quelle, les réglages prennent leur valeur par défaut.
 * Rien n'est réécrit à l'intérieur d'une planche : ni un `hidden`, ni un `sound_id`, ni
 * une position. Une perte de configuration est le seul bug vraiment grave de ce projet.
 */
export function migrerV2VersV3(ancienne: ConfigurationV2): Configuration {
  return {
    format: ancienne.format,
    contextes: ancienne.planches.map(contexteDUnePage),
    barre: ancienne.barre,
    reglages: REGLAGES_PAR_DEFAUT,
  }
}

/**
 * Une configuration enregistrée avant le lot 4 n'a pas ce réglage : on part de false,
 * comme une installation neuve, plutôt que de planter sur un champ absent.
 */
/**
 * Les réglages arrivés après coup reçoivent leur valeur par défaut, sans toucher à ceux que
 * la famille a déjà choisis. Une configuration enregistrée avant P9 n'a ni volume ni
 * fermeté : sans ce complément, l'écran de l'enfant partirait sur `undefined`.
 */
function completerReglages(configuration: Configuration): Configuration {
  // Le volume s'écrivait « normal » avant la réglette : `normaliserVolume` rend le
  // pourcentage du niveau, la famille retrouve donc exactement ce qu'elle avait réglé.
  const reglages = {
    ...REGLAGES_PAR_DEFAUT,
    ...configuration.reglages,
    volume: normaliserVolume(configuration.reglages?.volume),
  }
  const identique = (Object.keys(reglages) as (keyof typeof reglages)[]).every(
    (champ) => reglages[champ] === configuration.reglages[champ],
  )
  return identique ? configuration : { ...configuration, reglages }
}

/**
 * La forme est déduite du contenu et jamais du numéro de version de la base : monter la
 * version d'IndexedDB ne réécrit pas l'enregistrement déjà posé.
 */
function reprendre(enregistree: Configuration | ConfigurationV2): Configuration {
  return completerReglages('contextes' in enregistree ? enregistree : migrerV2VersV3(enregistree))
}

/**
 * Rend la configuration enregistrée, ou sème la graine au premier lancement.
 *
 * Une configuration plus ancienne est reprise au lieu d'être écrasée : la planche unique
 * de la v1 comme les planches de la v2 deviennent des contextes d'une seule page.
 *
 * Un dépôt indisponible ne doit jamais laisser l'enfant sans ses mots : on retombe sur
 * la graine et on le dit en console. Il perd la persistance, pas sa voix.
 */
export async function chargerConfiguration(graine: Configuration): Promise<Configuration> {
  try {
    const db = await ouvrir()
    versionConnue = ((await db.get('config', CLE_VERSION)) as number | undefined) ?? 0
    const enregistree = (await db.get('config', CLE)) as Configuration | ConfigurationV2 | undefined
    if (enregistree) return reprendre(enregistree)

    const ancienne = (await db.get('config', CLE_V1)) as Planche | undefined
    const reprise: Configuration = ancienne
      ? { ...graine, contextes: [contexteDUnePage(ancienne), ...graine.contextes.slice(1)] }
      : graine
    // la graine du premier lancement compte comme une écriture : sans ça, deux onglets
    // ouverts sur une tablette neuve repartaient tous les deux de la version zéro
    await db.put('config', reprise, CLE)
    versionConnue = 1
    await db.put('config', versionConnue, CLE_VERSION)
    return reprise
  } catch (cause) {
    console.error('dépôt local indisponible, configuration non persistée', cause)
    return graine
  }
}

/**
 * IndexedDB refuse de cloner un proxy réactif de Vue, et l'échec part en rejet silencieux.
 * Le piège s'est refermé deux fois sur ce projet, la dernière en faisant croire à un parent
 * qu'il avait rattrapé une suppression alors que le mot était perdu. On absorbe donc ici,
 * une fois pour toutes, au lieu de demander à chaque appelant de penser à `toRaw`.
 *
 * Le passage par JSON tient tant que la configuration ne porte que des valeurs JSON, ce
 * qui est le cas : images et sons sont des chemins. Les vraies photos de P4 et les sons
 * de P8 seront des Blob et devront prendre un autre chemin, pas celui-ci.
 */
function normaliser(configuration: Configuration): Configuration {
  return JSON.parse(JSON.stringify(configuration)) as Configuration
}

/**
 * Le numéro d'écriture que cet onglet a lu la dernière fois. Deux onglets ouverts sur la
 * même tablette partaient chacun de leur copie en mémoire : le second écrasait le travail
 * du premier sans que rien ne le dise. Ici, on refuse d'écrire par-dessus plus récent que soi.
 */
let versionConnue = 0

/** Levée quand un autre onglet a écrit entre-temps : le parent doit recharger, pas insister. */
export class ConfigurationDepassee extends Error {
  constructor() {
    super(
      "Cette page n'est plus à jour : l'application est ouverte ailleurs et y a été modifiée. " +
        'Rechargez la page avant de continuer, sinon vous effaceriez ces changements.',
    )
    this.name = 'ConfigurationDepassee'
  }
}

export async function enregistrerConfiguration(configuration: Configuration): Promise<void> {
  const db = await ouvrir()
  // lecture et écriture dans la même transaction : entre les deux, un autre onglet ne peut
  // pas se glisser, c'est la garantie que donne IndexedDB
  const transaction = db.transaction('config', 'readwrite')
  const magasin = transaction.objectStore('config')
  const enBase = ((await magasin.get(CLE_VERSION)) as number | undefined) ?? 0
  if (enBase > versionConnue) {
    transaction.abort()
    throw new ConfigurationDepassee()
  }
  versionConnue = enBase + 1
  await magasin.put(normaliser(configuration), CLE)
  await magasin.put(versionConnue, CLE_VERSION)
  await transaction.done
}

/**
 * Place occupée et quota, pour que la mère puisse les lire au téléphone à le père : sans
 * cloud, c'est le seul moyen de voir l'état de la tablette à distance. Absent sur certains
 * navigateurs, d'où le `null` plutôt qu'une erreur.
 */
export async function estimerStockage(): Promise<{ utilise: number; quota: number } | null> {
  try {
    const estimation = await navigator.storage?.estimate?.()
    if (!estimation?.usage || !estimation.quota) return null
    return { utilise: estimation.usage, quota: estimation.quota }
  } catch {
    return null
  }
}

/**
 * Demande au système de ne pas purger le stockage (exigence T2). Sans ça un navigateur
 * qui manque de place peut effacer la configuration sans avertir.
 * L'affichage du verdict attend l'espace parents (E4) ; ici on le journalise.
 */
/**
 * Vrai quand l'application tourne posée sur l'écran d'accueil, faux dans un onglet. La
 * distinction n'est pas cosmétique : iPhone et iPad effacent les données des sites qu'on
 * n'ouvre pas pendant sept jours, et exemptent les applications installées. Tant que la
 * famille reste dans le navigateur, son travail peut disparaître tout seul.
 */
export function estInstallee(): boolean {
  const iOS = (navigator as Navigator & { standalone?: boolean }).standalone
  return iOS === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

export async function demanderStockagePersistant(): Promise<boolean> {
  try {
    const accorde = (await navigator.storage?.persist?.()) ?? false
    console.info(`stockage persistant : ${accorde ? 'accordé' : 'refusé'}`)
    return accorde
  } catch (cause) {
    console.error('stockage persistant indisponible', cause)
    return false
  }
}

/**
 * Écrit une photo ou un son de la famille (P4, P8). L'erreur remonte, contrairement à la
 * lecture : un parent qui vient d'enregistrer la voix de son enfant doit apprendre que la
 * tablette n'a pas pu la garder, sinon il la croit là et elle a disparu au rechargement.
 */
async function enregistrerBlob(magasin: 'images' | 'sons', idCase: string, blob: Blob): Promise<void> {
  const db = await ouvrir()
  await db.put(magasin, blob, idCase)
}

async function lireBlob(magasin: 'images' | 'sons', idCase: string): Promise<Blob | undefined> {
  try {
    const db = await ouvrir()
    return await db.get(magasin, idCase)
  } catch (cause) {
    console.error(`${magasin} indisponible : ${idCase}`, cause)
    return undefined
  }
}

async function effacerBlob(magasin: 'images' | 'sons', idCase: string): Promise<void> {
  try {
    const db = await ouvrir()
    await db.delete(magasin, idCase)
  } catch (cause) {
    console.error(`${magasin} non effacé : ${idCase}`, cause)
  }
}

export function enregistrerImage(idCase: string, image: Blob): Promise<void> {
  return enregistrerBlob('images', idCase, image)
}

export function lireImage(idCase: string): Promise<Blob | undefined> {
  return lireBlob('images', idCase)
}

export function effacerImage(idCase: string): Promise<void> {
  return effacerBlob('images', idCase)
}

export function enregistrerSon(idCase: string, son: Blob): Promise<void> {
  return enregistrerBlob('sons', idCase, son)
}

export function lireSon(idCase: string): Promise<Blob | undefined> {
  return lireBlob('sons', idCase)
}

export function effacerSon(idCase: string): Promise<void> {
  return effacerBlob('sons', idCase)
}

/**
 * Efface les photos et les sons que plus aucune case ne référence. Une restauration
 * remplace toute la configuration mais laissait les blobs de l'ancienne derrière elle,
 * pour toujours, sur un appareil où l'application avertit elle-même du manque de place.
 * Rend le nombre de blobs effacés, pour pouvoir le dire et le tester.
 */
export async function purgerRessourcesOrphelines(
  imagesGardees: string[],
  sonsGardes: string[],
): Promise<number> {
  try {
    const db = await ouvrir()
    let effaces = 0
    for (const [magasin, gardes] of [
      ['images', new Set(imagesGardees)],
      ['sons', new Set(sonsGardes)],
    ] as const) {
      for (const cle of await db.getAllKeys(magasin)) {
        if (gardes.has(String(cle))) continue
        await db.delete(magasin, cle)
        effaces += 1
      }
    }
    return effaces
  } catch (cause) {
    console.error('purge des ressources orphelines impossible', cause)
    return 0
  }
}

/**
 * Ajoute un mot au journal de la journée. L'erreur est avalée : perdre une ligne de journal
 * ne vaut pas d'interrompre l'enfant qui parle, et rien d'autre n'en dépend.
 */
export async function ajouterAuJournal(mot: string, horodatage = Date.now()): Promise<void> {
  try {
    const db = await ouvrir()
    // l'horodatage sert de clé : deux appuis dans la même milliseconde sont un double
    // enregistrement du même geste, pas deux mots
    await db.put('journal', { horodatage, mot }, horodatage)
  } catch (cause) {
    console.error('journal non écrit', cause)
  }
}

/** Le journal du jour, dans l'ordre des heures. Vide plutôt qu'en erreur si rien ne répond. */
export async function lireLeJournalDuJour(maintenant = Date.now()): Promise<EntreeJournal[]> {
  try {
    const db = await ouvrir()
    return entreesDuJour(await db.getAll('journal'), maintenant)
  } catch (cause) {
    console.error('journal illisible', cause)
    return []
  }
}

/**
 * Efface tout ce qui n'est pas du jour. C'est la condition que la mère a posée en demandant
 * ce journal : il ne se constitue aucun dossier sur l'enfant. Appelé au démarrage, faute de
 * pouvoir se réveiller à minuit sur une tablette éteinte.
 */
export async function purgerLeJournal(maintenant = Date.now()): Promise<number> {
  try {
    const db = await ouvrir()
    const perimees = entreesPerimees(await db.getAll('journal'), maintenant)
    for (const entree of perimees) await db.delete('journal', entree.horodatage)
    return perimees.length
  } catch (cause) {
    console.error('journal non purgé', cause)
    return 0
  }
}

/**
 * Vide tous les magasins (P10). Le parent le demande deux fois avant d'en arriver là :
 * c'est la seule porte de sortie quand une tablette part à quelqu'un d'autre, ou quand une
 * configuration devient trop embrouillée pour être démêlée mot par mot.
 */
export async function effacerToutLeDepot(): Promise<void> {
  const db = await ouvrir()
  await Promise.all([db.clear('config'), db.clear('images'), db.clear('sons'), db.clear('journal')])
}
