/**
 * Orchestration de la sauvegarde (B2) : réunit les octets des ressources, construit
 * l'archive et déclenche son téléchargement. Contrairement à `archive.ts`, ce module
 * touche le réseau (via le cache du service worker) et le DOM : c'est la frontière qui
 * les sépare.
 */
import {
  cheminAvecVraieExtension,
  construireArchive,
  identifiantPersonnaliseDuChemin,
  ressourcesReferencees,
  typeDesOctets,
  type Inventaire,
} from './archive'
import { marquerSauvegardee, type Configuration } from './planche'
import { enregistrerImage, enregistrerSon, lireImage, lireSon } from './depot'

/** Tire AAAA-MM-JJ de la date ISO de l'inventaire : le nom de fichier ne peut jamais
 *  contredire la date affichée dans le compte rendu, ils viennent de la même valeur. */
export function nomFichierSauvegarde(dateIso: string): string {
  return `mes-mots-${dateIso.slice(0, 10)}.obz`
}

/** Identifiant personnalisé porté par un chemin d'archive `images/<réf>` ou `sons/<réf>.mp3`. */

/**
 * Lit une ressource référencée par la configuration : une photo ou un son de la famille
 * (`perso/`) vient des magasins IndexedDB, qui n'ont jamais eu d'URL à servir ; le reste
 * vient de `fetch`, servi hors ligne par le cache du service worker.
 */
async function lireRessource(chemin: string): Promise<Uint8Array> {
  const idPerso = identifiantPersonnaliseDuChemin(chemin)
  if (idPerso) {
    const blob = chemin.startsWith('images/') ? await lireImage(idPerso) : await lireSon(idPerso)
    if (!blob) throw new Error(`ressource personnalisée absente du magasin : ${idPerso}`)
    return new Uint8Array(await blob.arrayBuffer())
  }
  const reponse = await fetch(`/${chemin}`)
  if (!reponse.ok) throw new Error(`statut ${reponse.status}`)
  // Un serveur d'application à page unique rend 200 et sa page d'accueil pour n'importe
  // quel chemin inconnu : sans ce contrôle, un pictogramme disparu d'une mise à jour se
  // sauvegardait comme du HTML, et le compte rendu annonçait fièrement une image de plus.
  const type = reponse.headers.get('content-type') ?? ''
  const attendu = chemin.startsWith('images/') ? 'image/' : 'audio/'
  if (!type.startsWith(attendu)) throw new Error(`ce n'est pas ${attendu.slice(0, -1)} : ${type}`)
  return new Uint8Array(await reponse.arrayBuffer())
}

/**
 * Va chercher chaque ressource référencée, magasins ou réseau selon sa nature. Une
 * ressource introuvable est omise et signalée, jamais fatale : une sauvegarde partielle
 * vaut mieux que pas de sauvegarde du tout.
 */
export async function collecterRessources(
  chemins: string[],
): Promise<{ ressources: Map<string, Uint8Array>; manquantes: string[] }> {
  const ressources = new Map<string, Uint8Array>()
  const manquantes: string[] = []
  await Promise.all(
    chemins.map(async (chemin) => {
      try {
        const octets = await lireRessource(chemin)
        // le nom d'un enregistrement de la famille se décide sur son contenu, pas sur une
        // convention : un WebM appelé .mp3 ne s'ouvre pas chez le parent qui l'extrait
        ressources.set(cheminAvecVraieExtension(chemin, octets), octets)
      } catch (cause) {
        console.error(`ressource absente de la sauvegarde : ${chemin}`, cause)
        manquantes.push(chemin)
      }
    }),
  )
  return { ressources, manquantes }
}

/**
 * Réécrit dans leurs magasins les photos et sons de la famille rendus par `lireArchive` :
 * sans ça, restaurer une sauvegarde sur une tablette neuve laisserait les mots muets et
 * sans visage, exactement ce que la sauvegarde existe pour éviter.
 */
export async function restaurerRessourcesPersonnalisees(ressources: Map<string, Uint8Array>): Promise<void> {
  await Promise.all(
    [...ressources].map(([chemin, octets]) => {
      const idPerso = identifiantPersonnaliseDuChemin(chemin)
      if (!idPerso) return undefined
      // même élargissement que declencherTelechargement : l'octet produit par lireArchive
      // tient toujours sur un ArrayBuffer classique
      const blob = new Blob([octets as Uint8Array<ArrayBuffer>], { type: typeDesOctets(octets) })
      return chemin.startsWith('images/') ? enregistrerImage(idPerso, blob) : enregistrerSon(idPerso, blob)
    }),
  )
}

/** Fait cliquer un lien invisible sur une URL d'objet, puis la libère aussitôt après. */
export function declencherTelechargement(octets: Uint8Array, nom: string): void {
  // fflate rend un Uint8Array<ArrayBufferLike>, un cran plus large que le BlobPart attendu
  // par le DOM ; l'octet réellement produit tient toujours sur un ArrayBuffer classique.
  const url = URL.createObjectURL(
    new Blob([octets as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }),
  )
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(url)
}

/**
 * La seule porte d'entrée pour sauvegarder : utilisée à la fois par le bouton de
 * l'espace parents et par le rappel de sortie (B4), pour qu'il n'existe qu'un seul
 * enchaînement fetch → archive → téléchargement → drapeau à maintenir.
 */
export async function effectuerSauvegarde(configuration: Configuration): Promise<{
  configurationSauvegardee: Configuration
  inventaire: Inventaire
  ressourcesManquantes: string[]
  /** Le nom sous lequel le fichier vient de partir. Sans lui, le parent ne sait pas quoi
   *  chercher dans ses téléchargements, et c'est la seule chose qui protège son travail. */
  nomFichier: string
}> {
  const { ressources, manquantes } = await collecterRessources(ressourcesReferencees(configuration))
  const configurationSauvegardee = marquerSauvegardee(configuration)
  const { octets, inventaire } = construireArchive(configurationSauvegardee, ressources)
  const nomFichier = nomFichierSauvegarde(inventaire.date)
  declencherTelechargement(octets, nomFichier)
  return { configurationSauvegardee, inventaire, ressourcesManquantes: manquantes, nomFichier }
}
