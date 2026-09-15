/**
 * Les régions touchables des deux corps de la planche « J'ai mal ». Elles vivent ici et non
 * dans les données : elles appartiennent au dessin, pas au vocabulaire, et les recopier dans
 * chaque sauvegarde obligerait à les maintenir à deux endroits.
 *
 * Tout est en pourcentage du dessin, jamais en pixels : les deux images ont le même
 * recadrage et gardent leurs proportions, donc une région reste posée au même endroit du
 * corps quelle que soit la taille de l'écran. C'est ce qui permet à l'enfant d'apprendre où
 * toucher, comme il apprend la place d'une case.
 *
 * Les valeurs viennent d'une mesure des deux images ligne par ligne, pas d'un coup d'œil, et
 * du recadrage commun (130 à 370 sur les 500 d'origine) qui a chassé les marges vides.
 *
 * Le ventre et le dos s'arrêtent nettement plus haut que le bas du tronc : sinon ils
 * couvrent l'endroit où le doigt vise le zizi ou les fesses, et l'enfant dit « mal au
 * ventre » en montrant son entrejambe. L'entrejambe du dessin de face est à 54,4 %, le pli
 * des fesses de dos entre 54 et 56 % : les deux zones intimes sont posées juste au-dessus.
 *
 * Le haut du corps a été remesuré après coup : de face, la tête s'arrête à 14 %, le cou le
 * plus étroit y est aussi, et les épaules s'écartent à partir de 15 % ; de dos, 13,5 %,
 * 15,2 % et 18 %. Les zones étaient posées quatre points trop bas, le cou tombait sur les
 * clavicules, et deux morceaux de ventre bouchaient les épaules faute d'avoir corrigé la
 * mesure. Le cou prend maintenant la bande du menton à la ligne des épaules sur toute la
 * largeur du tronc, parce que le haut de l'épaule près du cou est du cou pour qui montre sa
 * douleur, et les bras montent prendre la pointe des épaules.
 *
 * Aucun pixel du corps ne doit rester muet. La poitrine et les cuisses ne répondaient à
 * rien, alors que ce sont les premiers endroits qu'un enfant assis se touche : il tapait,
 * rien ne sortait, et rien ne lui disait que c'était l'endroit et non le geste. Le ventre
 * couvre donc tout le tronc jusqu'au cou, et la jambe part de l'entrejambe. Un mot approché
 * vaut mieux qu'un silence : « j'ai mal au ventre » pour un torse montré est ce qu'un
 * adulte comprendra le mieux.
 */
import { urlLivree } from './planche'

export interface RegionSilhouette {
  gauche: number
  haut: number
  largeur: number
  hauteur: number
  /** Une main, une tête et un pied se cernent mieux par une ellipse que par un rectangle. */
  ronde?: boolean
}

export type CoteSilhouette = 'face' | 'dos'

/**
 * Un même mot occupe souvent deux régions : l'enfant montre la main qui lui fait mal, pas
 * celle que le dessin désigne. Les deux disent la même phrase.
 */
const REGIONS: Record<CoteSilhouette, Record<string, RegionSilhouette[]>> = {
  face: {
    tete: [{ gauche: 29.2, haut: 0.8, largeur: 40, hauteur: 12.1, ronde: true }],
    cou: [{ gauche: 29.2, haut: 13, largeur: 41.6, hauteur: 4.4 }],
    ventre: [{ gauche: 29.2, haut: 17.5, largeur: 41.6, hauteur: 29.5 }],
    // depuis la pointe de l'épaule et non depuis l'aisselle : le haut du bras ne répondait à rien
    bras: [
      { gauche: 12.5, haut: 16.5, largeur: 16.6, hauteur: 33.1 },
      { gauche: 70.9, haut: 16.5, largeur: 16.6, hauteur: 33.1 },
    ],
    zizi: [{ gauche: 40.8, haut: 47.5, largeur: 18.3, hauteur: 7.5, ronde: true }],
    main: [
      { gauche: 4.2, haut: 50, largeur: 22.8, hauteur: 13.6, ronde: true },
      { gauche: 73, haut: 50, largeur: 22.8, hauteur: 13.6, ronde: true },
    ],
    jambe: [
      { gauche: 27.5, haut: 55.1, largeur: 20.8, hauteur: 33.9 },
      { gauche: 50.8, haut: 55.1, largeur: 20.8, hauteur: 33.9 },
    ],
    pied: [
      { gauche: 20.8, haut: 89.6, largeur: 24.2, hauteur: 9.4, ronde: true },
      { gauche: 45.8, haut: 89.6, largeur: 24.2, hauteur: 9.4, ronde: true },
    ],
  },
  dos: {
    tete: [{ gauche: 30, haut: 1.6, largeur: 40, hauteur: 11.3, ronde: true }],
    cou: [{ gauche: 29.4, haut: 13, largeur: 41.2, hauteur: 4.4 }],
    dos: [{ gauche: 29.4, haut: 17.5, largeur: 41.2, hauteur: 28.5 }],
    bras: [
      { gauche: 10.4, haut: 16.5, largeur: 18.9, hauteur: 33.1 },
      { gauche: 70.7, haut: 16.5, largeur: 18.9, hauteur: 33.1 },
    ],
    fesses: [{ gauche: 30, haut: 46.5, largeur: 40, hauteur: 12.5 }],
    main: [
      { gauche: 2.5, haut: 50, largeur: 24.5, hauteur: 13.6, ronde: true },
      { gauche: 73, haut: 50, largeur: 24.5, hauteur: 13.6, ronde: true },
    ],
    jambe: [
      { gauche: 31.2, haut: 59.1, largeur: 18.8, hauteur: 29.9 },
      { gauche: 50.8, haut: 59.1, largeur: 18.8, hauteur: 29.9 },
    ],
    pied: [
      { gauche: 27.1, haut: 89.6, largeur: 22.9, hauteur: 9.4, ronde: true },
      { gauche: 50.8, haut: 89.6, largeur: 22.1, hauteur: 9.4, ronde: true },
    ],
  },
}

/** Les régions d'un mot sur un côté donné, ou rien s'il n'y figure pas : « ventre » n'existe
 *  que de face, « dos » que de dos, « tête » sur les deux. */
export function regionsDe(cote: CoteSilhouette, zone: string | undefined): RegionSilhouette[] {
  return (zone && REGIONS[cote][zone]) || []
}

/**
 * Le point (x, y), en pourcentage du dessin, tombe-t-il dans cette région ? Une région
 * ronde est une ellipse et non son rectangle : le navigateur en tient compte pour savoir
 * quel bouton reçoit le doigt, et deux régions dont les rectangles se recouvrent aux coins
 * ne se disputent en réalité aucun pixel.
 */
export function estDansLaRegion(region: RegionSilhouette, x: number, y: number): boolean {
  const dansLeRectangle =
    x >= region.gauche &&
    x <= region.gauche + region.largeur &&
    y >= region.haut &&
    y <= region.haut + region.hauteur
  if (!region.ronde || !dansLeRectangle) return dansLeRectangle
  const demiLargeur = region.largeur / 2
  const demiHauteur = region.hauteur / 2
  const ecartX = (x - (region.gauche + demiLargeur)) / demiLargeur
  const ecartY = (y - (region.haut + demiHauteur)) / demiHauteur
  return ecartX * ecartX + ecartY * ecartY <= 1
}

export const COTES: CoteSilhouette[] = ['face', 'dos']

export const IMAGE_DU_COTE: Record<CoteSilhouette, string> = {
  face: urlLivree('images/corps/face.png'),
  dos: urlLivree('images/corps/dos.png'),
}
