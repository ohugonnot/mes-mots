import { describe, it, expect } from 'vitest'
import {
  COTE_DE_CASE_MINIMUM_CM,
  FERMETES,
  VOLUMES,
  VOLUME_MINIMUM,
  coteDeCaseEcrit,
  coteDeCaseEnCm,
  fermeteDe,
  normaliserVolume,
  tailleDeCaseEcrite,
  volumeDe,
} from '../../src/domaine/reglages'

describe('les valeurs proposées aux parents', () => {
  it('parle en mots, jamais en millisecondes', () => {
    // un parent règle ce qu'il observe : une main qui frôle, un geste involontaire
    expect(FERMETES.map((f) => f.libelle)).toEqual(['Normal', 'Appuis assurés', 'Appuis très assurés'])
    expect(VOLUMES.map((v) => v.libelle)).toEqual(['Bas', 'Normal', 'Fort'])
  })

  it('exige un appui de plus en plus franc à mesure qu on monte les niveaux', () => {
    const durees = FERMETES.map((f) => f.dureeAppuiMinimaleMs)
    const delais = FERMETES.map((f) => f.delaiEntreActivationsMs)

    expect(durees).toEqual([...durees].sort((a, b) => a - b))
    expect(delais).toEqual([...delais].sort((a, b) => a - b))
  })

  it('le premier niveau est exactement le comportement livré, pour n avoir rien à régler', () => {
    expect(FERMETES[0]).toMatchObject({ dureeAppuiMinimaleMs: 0, delaiEntreActivationsMs: 300 })
  })

  it('retombe sur une valeur sûre quand la clé est inconnue', () => {
    // une configuration venant d'une version future, ou abîmée, ne doit pas rendre muet
    expect(fermeteDe('inconnu')).toEqual(FERMETES[0])
  })

  it('ne descend jamais le volume à zéro : une tablette muette passe pour cassée', () => {
    expect(Math.min(...VOLUMES.map((v) => v.pourcentage))).toBeGreaterThan(0)
    expect(VOLUME_MINIMUM).toBeGreaterThan(0)
    expect(volumeDe(0)).toBeGreaterThan(0)
    expect(volumeDe(-40)).toBeGreaterThan(0)
  })
})

describe('le volume réglé au pourcentage', () => {
  it('rend au lecteur une valeur de 0 à 1', () => {
    expect(volumeDe(100)).toBe(1)
    expect(volumeDe(70)).toBeCloseTo(0.7)
  })

  it('reprend le niveau nommé des configurations d avant la réglette', () => {
    // la tablette de la famille porte « bas », « normal » ou « fort » : elle doit
    // retrouver exactement le volume qu'elle entendait, pas un défaut
    expect(normaliserVolume('bas')).toBe(40)
    expect(normaliserVolume('normal')).toBe(70)
    expect(normaliserVolume('fort')).toBe(100)
  })

  it('borne, arrondit, et retombe sur normal quand le champ n a aucun sens', () => {
    expect(normaliserVolume(200)).toBe(100)
    expect(normaliserVolume(3)).toBe(VOLUME_MINIMUM)
    expect(normaliserVolume(62.4)).toBe(62)
    expect(normaliserVolume(undefined)).toBe(70)
    expect(normaliserVolume(Number.NaN)).toBe(70)
    expect(normaliserVolume('inconnu')).toBe(70)
  })
})

describe('la taille d une case, telle que la mère la lira', () => {
  it('rend la grille livrée à la mesure prise à la règle sur la tablette', () => {
    // la BIBLE a mesuré 4,8 cm sur l'écran de l'enfant : le calcul doit retomber dessus,
    // sinon la lecture affichée ment sur la seule chose qu'un parent peut vérifier
    expect(coteDeCaseEcrit(4, 4)).toBe('4,8')
  })

  it('annonce le côté que le doigt doit viser, donc le plus court', () => {
    // trois colonnes donnent des cases larges de 6,6 cm, six lignes les écrasent en hauteur
    expect(coteDeCaseEcrit(3, 6)).toBe('3,1')
    expect(coteDeCaseEnCm(3, 6)).toBeLessThan(coteDeCaseEnCm(3, 3))
  })

  it('écrit les deux côtés quand ils diffèrent, et un seul quand la case est carrée', () => {
    expect(tailleDeCaseEcrite(4, 4)).toBe('4,8 cm')
    expect(tailleDeCaseEcrite(3, 4)).toBe('6,6 cm de large et 4,8 cm de haut')
  })

  it('mesure vraiment les deux côtés, chacun sur une grille qui penche de son bord', () => {
    // l'écran de l'enfant est debout : à formes égales la hauteur gagne toujours de peu, et
    // chaque côté ne se vérifie que sur une grille franchement plate ou franchement étroite
    expect(coteDeCaseEcrit(7, 3)).toBe('2,6')
    expect(coteDeCaseEcrit(2, 4)).toBe('4,8')
  })

  it('passe sous le seuil du cahier des charges à huit, pas à sept', () => {
    // le seuil en littéral : le borner par la constante qu'il défend rendrait l'attente vraie
    // quelle que soit sa valeur
    expect(COTE_DE_CASE_MINIMUM_CM).toBe(2.5)
    expect(coteDeCaseEcrit(7, 7)).toBe('2,6')
    expect(coteDeCaseEnCm(7, 7)).toBeGreaterThan(COTE_DE_CASE_MINIMUM_CM)
    expect(coteDeCaseEcrit(8, 8)).toBe('2,2')
    expect(coteDeCaseEnCm(8, 8)).toBeLessThan(COTE_DE_CASE_MINIMUM_CM)
  })
})
