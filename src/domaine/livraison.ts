/**
 * La mise à jour du vocabulaire livré, sans jamais rien perdre.
 *
 * La graine ne s'applique qu'au premier lancement : ensuite la configuration vit dans le
 * dépôt, et une mise à jour de l'application n'y touche pas (garantie EG-10). Conséquence
 * vécue : une planche ajoutée au code n'atteignait jamais une tablette déjà en service.
 *
 * La règle tient en une phrase : **on ajoute ce qui n'a jamais été proposé à cette tablette,
 * on ne modifie ni ne supprime jamais rien.** Ce qui a été proposé une fois est noté dans
 * `ext_mesmots_livraisons` et ne le sera plus, même si la famille l'a supprimé ensuite :
 * voir revenir à chaque lancement un mot qu'on a retiré serait pire que de ne rien recevoir.
 */
import {
  contextePeutEntrer,
  toutesLesPlanches,
  type Configuration,
  type Contexte,
  type Planche,
} from './planche'

/** Identifiants portés par une planche : elle-même et ses mots. */
function identifiantsDePlanche(planche: Planche): string[] {
  return [planche.id, ...planche.buttons.map((contenu) => contenu.id)]
}

function identifiantsDeContexte(contexte: Contexte): string[] {
  return [contexte.id, ...contexte.pages.flatMap(identifiantsDePlanche)]
}

/**
 * Ce qu'on considère comme déjà proposé à une tablette qui n'en a jamais tenu le compte.
 * Grain volontairement grossier : un contexte que la tablette possède est réputé livré en
 * entier, mots compris. Autrement, tout ce que la famille a supprimé depuis son installation
 * lui reviendrait au premier lancement de cette version, et c'est précisément ce qu'il faut
 * éviter. Un contexte absent, lui, n'a jamais été proposé : il arrivera.
 */
function livraisonsSupposees(configuration: Configuration, graine: Configuration): string[] {
  const presents = new Set(configuration.contextes.map((contexte) => contexte.id))
  const deja = graine.contextes
    .filter((contexte) => presents.has(contexte.id))
    .flatMap(identifiantsDeContexte)
  // la barre existe depuis la première version : ce qu'elle porte a forcément été proposé
  return [...deja, ...identifiantsDePlanche(graine.barre)]
}

/** Pose une case de la graine à sa place, si la place et l'identifiant sont libres. */
function avecCaseLivree(planche: Planche, modele: Planche, idCase: string): Planche {
  const contenu = modele.buttons.find((bouton) => bouton.id === idCase)
  if (!contenu || planche.buttons.some((bouton) => bouton.id === idCase)) return planche
  const position = modele.grid.order.flatMap((rangee, ligne) =>
    rangee.map((id, colonne) => (id === idCase ? { ligne, colonne } : null)),
  ).find((place) => place !== null)
  // hors de la grille de la famille, ou place déjà prise : on ne déplace jamais son travail
  if (!position) return planche
  if (planche.grid.order[position.ligne]?.[position.colonne] !== null) return planche

  return {
    ...planche,
    grid: {
      ...planche.grid,
      order: planche.grid.order.map((rangee, ligne) =>
        rangee.map((id, colonne) =>
          ligne === position.ligne && colonne === position.colonne ? idCase : id,
        ),
      ),
    },
    buttons: [...planche.buttons, contenu],
  }
}

export interface Livraison {
  configuration: Configuration
  /** Ce qui vient d'entrer, pour le dire au parent. Vide quand rien n'a changé. */
  ajoutes: string[]
}

/**
 * Applique à une configuration ce que la graine a de nouveau. Rend la configuration
 * inchangée, à l'identique, quand il n'y a rien à livrer : l'appelant peut donc comparer
 * les références pour savoir s'il doit réenregistrer.
 */
export function livrerLesNouveautes(configuration: Configuration, graine: Configuration): Livraison {
  const livrees = new Set(
    configuration.ext_mesmots_livraisons ?? livraisonsSupposees(configuration, graine),
  )
  const ajoutes: string[] = []
  let resultat = configuration

  for (const contexteGraine of graine.contextes) {
    const present = resultat.contextes.find((contexte) => contexte.id === contexteGraine.id)

    if (!present) {
      // jamais proposé : le contexte entier arrive, à la suite des siens
      if (!livrees.has(contexteGraine.id) && contextePeutEntrer(resultat, contexteGraine)) {
        resultat = { ...resultat, contextes: [...resultat.contextes, contexteGraine] }
        ajoutes.push(contexteGraine.name)
      }
      identifiantsDeContexte(contexteGraine).forEach((id) => livrees.add(id))
      continue
    }

    const idsPris = new Set(toutesLesPlanches(resultat).map((planche) => planche.id))
    // Une image ajoutée après coup à un contexte déjà livré : la poser ne retire rien et ne
    // remplace rien, et sans ça « Maison » resterait un mot écrit pour un enfant qui ne lit
    // pas. C'est la seule complétion autorisée : jamais une valeur déjà choisie.
    let contexteAJour =
      !present.ext_mesmots_image && contexteGraine.ext_mesmots_image
        ? { ...present, ext_mesmots_image: contexteGraine.ext_mesmots_image }
        : present
    for (const pageGraine of contexteGraine.pages) {
      const pagePresente = contexteAJour.pages.find((page) => page.id === pageGraine.id)

      if (!pagePresente) {
        if (!livrees.has(pageGraine.id) && !idsPris.has(pageGraine.id)) {
          contexteAJour = { ...contexteAJour, pages: [...contexteAJour.pages, pageGraine] }
          ajoutes.push(pageGraine.name)
        }
        identifiantsDePlanche(pageGraine).forEach((id) => livrees.add(id))
        continue
      }

      let pageAJour = pagePresente
      for (const contenu of pageGraine.buttons) {
        if (!livrees.has(contenu.id)) {
          const avant = pageAJour
          pageAJour = avecCaseLivree(pageAJour, pageGraine, contenu.id)
          if (pageAJour !== avant) ajoutes.push(contenu.label)
        }
        livrees.add(contenu.id)
      }
      if (pageAJour !== pagePresente) {
        contexteAJour = {
          ...contexteAJour,
          pages: contexteAJour.pages.map((page) => (page.id === pageAJour.id ? pageAJour : page)),
        }
      }
    }
    if (contexteAJour !== present) {
      resultat = {
        ...resultat,
        contextes: resultat.contextes.map((contexte) =>
          contexte.id === contexteAJour.id ? contexteAJour : contexte,
        ),
      }
    }
  }

  const memoire = [...livrees].sort()
  const memoireInchangee =
    configuration.ext_mesmots_livraisons?.length === memoire.length &&
    configuration.ext_mesmots_livraisons.every((id, rang) => id === memoire[rang])
  if (resultat === configuration && memoireInchangee) return { configuration, ajoutes: [] }

  return { configuration: { ...resultat, ext_mesmots_livraisons: memoire }, ajoutes }
}
