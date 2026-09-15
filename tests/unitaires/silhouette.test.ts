import { describe, it, expect } from 'vitest'
import { COTES, estDansLaRegion, regionsDe, type RegionSilhouette } from '../../src/domaine/silhouette'

const ZONES = ['tete', 'cou', 'ventre', 'dos', 'bras', 'main', 'jambe', 'pied', 'zizi', 'fesses']

const contient = (zone: RegionSilhouette, y: number) => zone.haut <= y && y <= zone.haut + zone.hauteur

describe('les régions des deux corps', () => {
  it('donne le ventre de face et le dos de dos, jamais l inverse', () => {
    expect(regionsDe('face', 'ventre')).toHaveLength(1)
    expect(regionsDe('dos', 'ventre')).toHaveLength(0)
    expect(regionsDe('dos', 'dos')).toHaveLength(1)
    expect(regionsDe('face', 'dos')).toHaveLength(0)
  })

  it('pose le cou sur le cou du dessin, et non sur les clavicules', () => {
    // Le cou était à 18,5 % de face et 19,3 % de dos, quatre points sous le cou réel :
    // mesuré ligne par ligne, l'endroit le plus étroit est à 14 % de face, 15,2 % de dos.
    // Le doigt posé sur le cou disait « j'ai mal au ventre », et deux morceaux de ventre
    // avaient été posés sur les épaules pour boucher le trou laissé par ce décalage.
    expect(contient(regionsDe('face', 'cou')[0]!, 14), 'le cou de face rate le cou').toBe(true)
    expect(contient(regionsDe('dos', 'cou')[0]!, 15.2), 'le cou de dos rate le cou').toBe(true)

    // et le tronc commence à la ligne des épaules, jamais au-dessus d'elle
    expect(regionsDe('face', 'ventre')[0]!.haut, 'le ventre remonte sur l épaule').toBeGreaterThan(17)
    expect(regionsDe('dos', 'dos')[0]!.haut, 'le dos remonte sur l épaule').toBeGreaterThan(17)
  })

  it('double les membres, parce que l enfant montre le sien et non celui du dessin', () => {
    for (const cote of COTES) {
      expect(regionsDe(cote, 'main'), `mains de ${cote}`).toHaveLength(2)
      expect(regionsDe(cote, 'jambe'), `jambes de ${cote}`).toHaveLength(2)
      expect(regionsDe(cote, 'pied'), `pieds de ${cote}`).toHaveLength(2)
      expect(regionsDe(cote, 'tete'), `tête de ${cote}`).toHaveLength(1)
    }
  })

  it('ne rend rien pour un mot sans région, plutôt que de le poser au hasard', () => {
    expect(regionsDe('face', undefined)).toEqual([])
    expect(regionsDe('face', 'coude')).toEqual([])
  })

  it('garde chaque région dans le cadre du dessin', () => {
    for (const cote of COTES) {
      for (const zone of ZONES) {
        for (const region of regionsDe(cote, zone)) {
          expect(region.gauche, `${cote} ${zone}`).toBeGreaterThanOrEqual(0)
          expect(region.haut, `${cote} ${zone}`).toBeGreaterThanOrEqual(0)
          expect(region.gauche + region.largeur, `${cote} ${zone}`).toBeLessThanOrEqual(100)
          expect(region.haut + region.hauteur, `${cote} ${zone}`).toBeLessThanOrEqual(100)
        }
      }
    }
  })

  it('pose les zones intimes sur l entrejambe du dessin, pas sous lui', () => {
    // le pÃ¨re a visé le zizi et touché le ventre, deux fois : le tronc descendait jusque
    // sur l'entrejambe. L'entrejambe du dessin de face est mesuré à 54,4 % de la hauteur,
    // le pli des fesses de dos entre 54 et 56 %. Chaque zone intime doit les contenir.
    expect(contient(regionsDe('face', 'zizi')[0]!, 54.4), 'le zizi rate l entrejambe').toBe(true)
    expect(contient(regionsDe('dos', 'fesses')[0]!, 55), 'les fesses ratent le pli').toBe(true)

    // et le tronc s'arrête au-dessus, sinon c'est lui qui reçoit le doigt
    const ventre = regionsDe('face', 'ventre')[0]!
    const dos = regionsDe('dos', 'dos')[0]!
    expect(ventre.haut + ventre.hauteur).toBeLessThan(50)
    expect(dos.haut + dos.hauteur).toBeLessThan(50)
  })

  it('ne laisse aucun point du dessin appartenir à deux zones à la fois', () => {
    // deux régions superposées feraient dire un mot pour un autre selon le pixel touché.
    // On échantillonne le dessin plutôt que de comparer des rectangles : une région ronde
    // est une ellipse, et deux rectangles qui se touchent aux coins ne se disputent rien.
    for (const cote of COTES) {
      const toutes = ZONES.flatMap((zone) => regionsDe(cote, zone).map((region) => ({ zone, region })))
      for (let y = 0; y <= 100; y += 0.5) {
        for (let x = 0; x <= 100; x += 0.5) {
          const dessus = toutes.filter(({ region }) => estDansLaRegion(region, x, y)).map(({ zone }) => zone)
          const distinctes = [...new Set(dessus)]
          expect(distinctes.length, `${cote} en ${x},${y} : ${distinctes.join(' et ')}`).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})
