import type { CaseCommunication } from './planche'

/**
 * La phrase en cours de composition : les cases touchées, dans l'ordre. Elle garde des
 * cases et non du texte, parce que la relire consiste à rejouer la voix de chacune. Une
 * phrase relue par la synthèse perdrait la voix d'enfant enregistrée, qui est la raison
 * d'être du projet.
 */
export type PhraseEnCours = CaseCommunication[]

/**
 * L'adulte modélise au-dessus du niveau de l'enfant, trois à six mots quand il en produit
 * un ou deux : la bande doit tenir plus que ce que l'enfant produit.
 */
export const MOTS_MAXIMUM = 6

/**
 * Au-delà de la borne, le mot est refusé et rien de ce qui est déjà là ne part. Faire
 * glisser la fenêtre effacerait sans le dire un mot que l'enfant a posé, et le silence est
 * ici pire que la limite : il croirait avoir perdu sa phrase.
 */
export function ajouterALaPhrase(phrase: PhraseEnCours, contenu: CaseCommunication): PhraseEnCours {
  if (phrase.length >= MOTS_MAXIMUM) return phrase
  return [...phrase, contenu]
}

/** Retirer le dernier suffit : viser une croix sur un mot du milieu est hors de portée d'un
 *  doigt de cinq ans, et aucune application du domaine ne l'a jamais livré. */
export function retirerLeDernierMot(phrase: PhraseEnCours): PhraseEnCours {
  return phrase.slice(0, -1)
}

/**
 * Le mot écrit sous le pictogramme. `ext_mesmots_enchaine` est saisi par l'adulte pour se
 * combiner (« biberon » plutôt que « Boire ») ; sans lui, le mot de la case fait l'affaire,
 * et une case créée par la famille n'a rien d'autre.
 */
export function motDeLaPhrase(contenu: CaseCommunication): string {
  return contenu.ext_mesmots_enchaine?.trim() || contenu.label
}
