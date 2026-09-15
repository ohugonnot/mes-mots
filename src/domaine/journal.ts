/**
 * Le journal de la journée, demandé par la mère : « la liste de ce qu'il a demandé dans la
 * journée, avec l'heure ». Sa condition, et c'est elle qui l'a posée, était l'effacement
 * automatique à minuit : rien ne s'accumule, et il ne se constitue aucun dossier sur
 * L'enfant. Pas de statistiques, pas de comptage, pas de score : une liste, et rien d'autre.
 */
export interface EntreeJournal {
  /** Millisecondes depuis l'époque, au moment de l'appui. */
  horodatage: number
  /** Le mot tel qu'il est écrit sur la case, pas la phrase dite : c'est ce que le parent
   *  reconnaît d'un coup d'œil sur la grille. */
  mot: string
}

const unJour = (horodatage: number): string => new Date(horodatage).toDateString()

/**
 * Les entrées du jour de `maintenant`, **de la plus récente à la plus ancienne**. C'est ce
 * qu'il vient de demander qu'un parent cherche en premier ; dans l'autre sens, il fallait
 * dérouler toute la journée pour l'atteindre. Le tri est fait ici et non à la lecture : une
 * entrée peut arriver dans le désordre si l'horloge de la tablette recule.
 */
export function entreesDuJour(entrees: EntreeJournal[], maintenant: number): EntreeJournal[] {
  const jour = unJour(maintenant)
  return entrees.filter((entree) => unJour(entree.horodatage) === jour).sort((a, b) => b.horodatage - a.horodatage)
}

/** Ce qui n'est pas du jour de `maintenant` : ce que le démarrage doit effacer. */
export function entreesPerimees(entrees: EntreeJournal[], maintenant: number): EntreeJournal[] {
  const jour = unJour(maintenant)
  return entrees.filter((entree) => unJour(entree.horodatage) !== jour)
}

/** « 08:12 ». L'heure locale de la tablette, celle que le parent lit sur son horloge. */
export function heureDe(horodatage: number): string {
  const date = new Date(horodatage)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export interface HeureDuJour {
  /** « Vers 8 h », tel qu'un parent le dit en racontant sa journée. */
  libelle: string
  entrees: EntreeJournal[]
}

/**
 * La journée découpée par heure, dans l'ordre où `entreesDuJour` l'a rendue. Une liste plate
 * de vingt lignes toutes identiques ne se traverse pas : l'heure est le seul repère que ces
 * données portent vraiment. Ce n'est pas un comptage, condition posée par la mère : aucun
 * groupe ne dit combien il contient, il dit quand.
 */
export function entreesParHeure(entrees: EntreeJournal[]): HeureDuJour[] {
  const heures: HeureDuJour[] = []
  let heurePrecedente: number | null = null
  for (const entree of entrees) {
    const heure = new Date(entree.horodatage).getHours()
    if (heure !== heurePrecedente) {
      heures.push({ libelle: libelleHeure(heure), entrees: [] })
      heurePrecedente = heure
    }
    heures[heures.length - 1]!.entrees.push(entree)
  }
  return heures
}

/** Midi et minuit se disent, ils ne se chiffrent pas : « Vers 0 h » n'est pas du français. */
function libelleHeure(heure: number): string {
  if (heure === 0) return 'Vers minuit'
  if (heure === 12) return 'Vers midi'
  return `Vers ${heure} h`
}
