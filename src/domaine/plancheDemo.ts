import { couleursDe } from './palette'
import {
  declarerVocabulaireLivre,
  REGLAGES_PAR_DEFAUT,
  type CaseCommunication,
  type Configuration,
  type Planche,
} from './planche'

const CASES_MAISON: CaseCommunication[] = [
  { id: 'maman', ...couleursDe('Personnes'), label: 'MAMAN', vocalization: 'Maman', image_id: 'pictos/maman.svg', sound_id: 'maman', ext_mesmots_enchaine: 'maman' },
  { id: 'papa', ...couleursDe('Personnes'), label: 'PAPA', vocalization: 'Papa', image_id: 'pictos/papa.svg', sound_id: 'papa', ext_mesmots_enchaine: 'papa' },
  { id: 'moi', ...couleursDe('Personnes'), label: 'MOI', vocalization: 'Moi', sound_id: 'moi', ext_mesmots_enchaine: 'moi' },
  { id: 'doudou', ...couleursDe('Objets doux'), label: 'DOUDOU', vocalization: 'Mon doudou', image_id: 'pictos/doudou.svg', sound_id: 'doudou', ext_mesmots_enchaine: 'doudou' },
  { id: 'boire', ...couleursDe('Boissons et nourriture'), label: 'BOIRE', vocalization: 'Boire', image_id: 'pictos/boire.svg', sound_id: 'boire', ext_mesmots_enchaine: 'biberon' },
  { id: 'manger', ...couleursDe('Boissons et nourriture'), label: 'MANGER', vocalization: 'Manger', image_id: 'pictos/manger.svg', sound_id: 'manger', ext_mesmots_enchaine: 'manger' },
  { id: 'douche', ...couleursDe('Hygiène'), label: 'DOUCHE', vocalization: 'La douche', image_id: 'pictos/douche.svg', sound_id: 'douche', ext_mesmots_enchaine: 'douche' },
  { id: 'chambre', ...couleursDe('Hygiène'), label: 'CHAMBRE', vocalization: 'Ma chambre', image_id: 'pictos/chambre.svg', sound_id: 'chambre', ext_mesmots_enchaine: 'chambre' },
  { id: 'voiture', ...couleursDe('Déplacements'), label: 'VOITURE', vocalization: 'La voiture', image_id: 'pictos/voiture.svg', sound_id: 'voiture', ext_mesmots_enchaine: 'voiture' },
  { id: 'tablette', ...couleursDe('Déplacements'), label: 'TABLETTE', vocalization: 'La tablette', image_id: 'pictos/tablette.svg', sound_id: 'tablette', ext_mesmots_enchaine: 'tablette' },
  { id: 'promenade', ...couleursDe('Actions'), label: 'PROMENADE', vocalization: 'La promenade', image_id: 'pictos/promenade.svg', sound_id: 'promenade', ext_mesmots_enchaine: 'promener' },
  { id: 'oui', ...couleursDe('Oui'), label: 'OUI', vocalization: 'Oui', image_id: 'pictos/oui.svg', sound_id: 'oui', ext_mesmots_enchaine: 'oui' },
  { id: 'non', ...couleursDe('Non'), label: 'NON', vocalization: 'Non', image_id: 'pictos/non.svg', sound_id: 'non', ext_mesmots_enchaine: 'non' },

  // Préparées et masquées : la famille les révélera quand elle le jugera utile.
  { id: 'loki', ...couleursDe('Objets doux'), label: 'LOKI', vocalization: 'Loki', sound_id: 'loki', ext_mesmots_enchaine: 'Loki', hidden: true },
  { id: 'venum', ...couleursDe('Objets doux'), label: 'VENUM', vocalization: 'Venum', sound_id: 'venum', ext_mesmots_enchaine: 'Venum', hidden: true },
  { id: 'pipi', ...couleursDe('Hygiène'), label: 'PIPI', vocalization: 'Je veux faire pipi', image_id: 'pictos/pipi.svg', sound_id: 'pipi', ext_mesmots_enchaine: 'pipi', hidden: true },
]

/**
 * Contexte Maison, celui du démarrage.
 * 16 emplacements pour 13 cases révélées et 3 réservées : cette géométrie tient les
 * 3,5 cm exigés même avec les trois bandes de l'étape E3 autour de la grille.
 */
export const PLANCHE_DEMO: Planche = {
  format: 'open-board-0.1',
  id: 'maison',
  locale: 'fr',
  name: 'Maison',
  grid: {
    rows: 4,
    columns: 4,
    // Positions figées. Les emplacements de LOKI, VENUM et PIPI sont réservés dès
    // maintenant : les créer le jour de la révélation recomposerait la grille.
    order: [
      ['maman', 'papa', 'moi', 'doudou'],
      ['boire', 'manger', 'douche', 'chambre'],
      ['voiture', 'tablette', 'promenade', 'loki'],
      ['oui', 'non', 'venum', 'pipi'],
    ],
  },
  buttons: CASES_MAISON,
}

/**
 * Contexte Extérieur, aux mêmes dimensions que Maison pour qu'une case ne change ni de
 * taille ni de forme en changeant de contexte. Ses deux cases sont encore masquées, donc
 * son bouton ne s'affiche pas. Une seule page : il a déjà quatorze emplacements libres.
 */
export const PLANCHE_EXTERIEUR: Planche = {
  format: 'open-board-0.1',
  id: 'exterieur',
  locale: 'fr',
  name: 'Extérieur',
  grid: {
    rows: 4,
    columns: 4,
    order: [
      ['magasin', 'frere', null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
  },
  buttons: [
    { id: 'magasin', ...couleursDe('Déplacements'), label: 'MAGASIN', vocalization: 'Le magasin', image_id: 'pictos/magasin.svg', sound_id: 'magasin', ext_mesmots_enchaine: 'magasin', hidden: true },
    { id: 'frere', ...couleursDe('Personnes'), label: 'FRÈRE', vocalization: 'Mon frère', image_id: 'pictos/frere.svg', sound_id: 'frere', ext_mesmots_enchaine: 'frère', hidden: true },
  ],
}

/**
 * Barre des mots essentiels : cinq emplacements figés, aucun révélé aujourd'hui.
 * La convention du domaine veut ces mots toujours visibles ; la mère les reporte parce
 * que l'enfant ne réagit pas encore quand on lui parle. Les emplacements existent quand
 * même, pour qu'une révélation ne déplace jamais rien. Les deux derniers restent libres.
 */
export const BARRE_DEMO: Planche = {
  format: 'open-board-0.1',
  id: 'barre',
  locale: 'fr',
  name: 'Mots essentiels',
  grid: {
    rows: 1,
    columns: 5,
    order: [['aide', 'encore', 'fini', null, null]],
  },
  buttons: [
    { id: 'aide', ...couleursDe('Objets doux'), label: 'AIDE-MOI', vocalization: 'Aide-moi', image_id: 'pictos/aide.svg', sound_id: 'aide', ext_mesmots_enchaine: 'aide', hidden: true },
    { id: 'encore', ...couleursDe('Actions'), label: 'ENCORE', vocalization: 'Encore', image_id: 'pictos/encore.svg', sound_id: 'encore', ext_mesmots_enchaine: 'encore', hidden: true },
    { id: 'fini', ...couleursDe('Actions'), label: 'FINI', vocalization: 'Fini', image_id: 'pictos/fini.svg', sound_id: 'fini', ext_mesmots_enchaine: 'fini', hidden: true },
  ],
}

/**
 * La planche de la douleur, demandée par la mère : « un personnage de face et de dos »,
 * avec les endroits qu'elle a listés. Ce qui est grand se montre sur le corps ; ce qui tient
 * dans un visage se choisit en images sur la page suivante, parce que six régions dans une
 * tête de quarante pixels seraient intouchables.
 *
 * Aucun `sound_id` pour l'instant : la tablette lit les phrases avec sa propre voix, et les
 * enregistrements prendront leur place sans que rien d'autre ne change.
 */
const CORPS_DOULEUR: Planche = {
  format: 'open-board-0.1',
  id: 'douleur',
  locale: 'fr',
  name: 'J\'ai mal',
  ext_mesmots_silhouette: true,
  grid: {
    rows: 2,
    columns: 5,
    order: [
      ['mal-tete', 'mal-cou', 'mal-ventre', 'mal-dos', 'mal-bras'],
      ['mal-main', 'mal-jambe', 'mal-pied', 'mal-fesses', 'mal-zizi'],
    ],
  },
  buttons: [
    { id: 'mal-tete', ...couleursDe('Non'), label: 'TÊTE', vocalization: "J'ai mal à la tête", image_id: 'pictos/mal-tete.png', ext_mesmots_zone: 'tete', ext_mesmots_enchaine: 'à la tête' },
    { id: 'mal-ventre', ...couleursDe('Non'), label: 'VENTRE', vocalization: "J'ai mal au ventre", image_id: 'pictos/mal-ventre.png', ext_mesmots_zone: 'ventre', ext_mesmots_enchaine: 'au ventre' },
    { id: 'mal-dos', ...couleursDe('Non'), label: 'DOS', vocalization: "J'ai mal au dos", image_id: 'pictos/mal-dos.png', ext_mesmots_zone: 'dos', ext_mesmots_enchaine: 'au dos' },
    { id: 'mal-main', ...couleursDe('Non'), label: 'MAIN', vocalization: "J'ai mal à la main", image_id: 'pictos/main.png', ext_mesmots_zone: 'main', ext_mesmots_enchaine: 'à la main' },
    { id: 'mal-jambe', ...couleursDe('Non'), label: 'JAMBE', vocalization: "J'ai mal à la jambe", image_id: 'pictos/jambe.png', ext_mesmots_zone: 'jambe', ext_mesmots_enchaine: 'à la jambe' },
    { id: 'mal-pied', ...couleursDe('Non'), label: 'PIED', vocalization: "J'ai mal au pied", image_id: 'pictos/pied.png', ext_mesmots_zone: 'pied', ext_mesmots_enchaine: 'au pied' },
    { id: 'mal-cou', ...couleursDe('Non'), label: 'COU', vocalization: "J'ai mal au cou", image_id: 'pictos/cou.png', ext_mesmots_zone: 'cou', ext_mesmots_enchaine: 'au cou' },
    { id: 'mal-bras', ...couleursDe('Non'), label: 'BRAS', vocalization: "J'ai mal au bras", image_id: 'pictos/bras.png', ext_mesmots_zone: 'bras', ext_mesmots_enchaine: 'au bras' },
    { id: 'mal-fesses', ...couleursDe('Non'), label: 'FESSES', vocalization: "J'ai mal aux fesses", image_id: 'pictos/mal-fesses.png', ext_mesmots_zone: 'fesses', ext_mesmots_enchaine: 'aux fesses' },
    { id: 'mal-zizi', ...couleursDe('Non'), label: 'ZIZI', vocalization: "J'ai mal au zizi", image_id: 'pictos/zizi.png', ext_mesmots_zone: 'zizi', ext_mesmots_enchaine: 'au zizi' },
  ],
}

/** Le visage et l'appel à l'aide, en grille ordinaire : celle qu'il connaît déjà. */
const VISAGE_DOULEUR: Planche = {
  format: 'open-board-0.1',
  id: 'douleur-p2',
  locale: 'fr',
  name: 'J\'ai mal',
  grid: {
    rows: 4,
    columns: 4,
    order: [
      ['mal-yeux', 'mal-oreille', 'mal-bouche', 'mal-dents'],
      ['mal-doigt', 'mal-cogne', null, null],
      ['mal-aide', 'mal-calin', 'mal-docteur', null],
      [null, null, null, null],
    ],
  },
  buttons: [
    { id: 'mal-yeux', ...couleursDe('Non'), label: 'YEUX', vocalization: "J'ai mal aux yeux", image_id: 'pictos/yeux.png', ext_mesmots_enchaine: 'aux yeux' },
    { id: 'mal-oreille', ...couleursDe('Non'), label: "OREILLE", vocalization: "J'ai mal à l'oreille", image_id: 'pictos/mal-oreille.png', ext_mesmots_enchaine: "à l'oreille" },
    { id: 'mal-bouche', ...couleursDe('Non'), label: 'BOUCHE', vocalization: "J'ai mal à la bouche", image_id: 'pictos/bouche.png', ext_mesmots_enchaine: 'à la bouche' },
    { id: 'mal-dents', ...couleursDe('Non'), label: 'DENTS', vocalization: "J'ai mal aux dents", image_id: 'pictos/mal-dents.png', ext_mesmots_enchaine: 'aux dents' },
    { id: 'mal-doigt', ...couleursDe('Non'), label: 'DOIGT', vocalization: "J'ai mal au doigt", image_id: 'pictos/doigt.png', ext_mesmots_enchaine: 'au doigt' },
    { id: 'mal-cogne', ...couleursDe('Non'), label: 'BOSSE', vocalization: 'Je me suis cogné la tête', image_id: 'pictos/cogne.png', ext_mesmots_enchaine: 'cogné' },
    { id: 'mal-aide', ...couleursDe('Actions'), label: 'AIDE-MOI', vocalization: 'Aide-moi', image_id: 'pictos/aide-moi.png', ext_mesmots_enchaine: 'aide' },
    { id: 'mal-calin', ...couleursDe('Actions'), label: 'CÂLIN', vocalization: 'Je veux un câlin', image_id: 'pictos/calin.png', ext_mesmots_enchaine: 'câlin' },
    { id: 'mal-docteur', ...couleursDe('Actions'), label: 'DOCTEUR', vocalization: 'Je veux voir le docteur', image_id: 'pictos/docteur.png', ext_mesmots_enchaine: 'docteur' },
  ],
}

/** Configuration livrée avec l'application, semée au premier lancement. */
export const CONFIGURATION_DEMO: Configuration = {
  format: 'open-board-0.1',
  contextes: [
    { id: 'maison', name: 'Maison', ext_mesmots_image: 'pictos/maison-contexte.png', pages: [PLANCHE_DEMO] },
    { id: 'exterieur', name: 'Extérieur', ext_mesmots_image: 'pictos/exterieur-contexte.png', pages: [PLANCHE_EXTERIEUR] },
    { id: 'douleur', name: "J'ai mal", ext_mesmots_image: 'pictos/mal-ventre.png', pages: [CORPS_DOULEUR, VISAGE_DOULEUR] },
  ],
  barre: BARRE_DEMO,
  reglages: REGLAGES_PAR_DEFAUT,
}

/** Toutes les cases de la configuration, pages et barre confondues. Le test de contraste s'en sert. */
export const TOUTES_LES_CASES: CaseCommunication[] = [
  ...CONFIGURATION_DEMO.contextes.flatMap((contexte) =>
    contexte.pages.flatMap((page) => page.buttons),
  ),
  ...BARRE_DEMO.buttons,
]

// la graine déclare au domaine quelles cases ont un pictogramme et un son livrés
declarerVocabulaireLivre(TOUTES_LES_CASES)
