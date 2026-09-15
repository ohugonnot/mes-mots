import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// happy-dom n'a ni createImageBitmap ni canvas : le redimensionnement se vérifie dans
// image.test.ts, ici seul compte ce que l'espace parents en fait.
const redimensionnerImage = vi.hoisted(() => vi.fn())
vi.mock('../../src/domaine/image', () => ({ redimensionnerImage, COTE_VIGNETTE: 448 }))
import EspaceParents from '../../src/composants/EspaceParents.vue'
import { CONFIGURATION_DEMO } from '../../src/domaine/plancheDemo'
import type { EntreeJournal } from '../../src/domaine/journal'
import {
  ajouterCase,
  ajouterContexte,
  CONTEXTES_MAXIMUM,
  pageVierge,
  supprimerCase,
  supprimerContexte,
  type Configuration,
} from '../../src/domaine/planche'

const monter = (
  stockagePersistant: boolean | null = null,
  configuration = CONFIGURATION_DEMO,
  erreurEnregistrement = '',
  installee = true,
  nouveautes: string[] = [],
  journal: EntreeJournal[] = [],
) =>
  mount(EspaceParents, {
    props: {
      configuration,
      stockagePersistant,
      erreurEnregistrement,
      installee,
      nouvelleVersionPrete: false,
      nouveautes,
      journal,
    },
  })

/**
 * Les pages des opérations rares restent montées quand on les quitte, cachées par `v-show` :
 * leurs panneaux gardent leur état. `isVisible()` ne le voit pas sous happy-dom, on lit donc
 * le style que Vue pose vraiment.
 */
const cache = (ecran: ReturnType<typeof monter>, selecteur: string) =>
  (ecran.get(selecteur).element as HTMLElement).style.display === 'none'

/**
 * L'espace parents ouvert sur « Sauvegarde » : l'inventaire de la tablette, enregistrer,
 * restaurer, imprimer, effacer. Rien de tout ça ne s'affiche à côté des mots.
 */
const monterSurLaSauvegarde = async (...arguments_: Parameters<typeof monter>) => {
  const ecran = monter(...arguments_)
  await ecran.get('[data-onglet="sauvegarde"]').trigger('click')
  return ecran
}

/** L'espace parents ouvert sur « Réglages » : volume, appui, écran, grille, version. */
const monterSurLesReglages = async (...arguments_: Parameters<typeof monter>) => {
  const ecran = monter(...arguments_)
  await ecran.get('[data-onglet="reglages"]').trigger('click')
  return ecran
}

/**
 * Configuration où Maison porte deux pages. Indispensable : avec une seule page par
 * contexte, l'identifiant de la page est celui du contexte, donc lister les pages ou les
 * contextes donne exactement la même liste et aucun test ne peut les distinguer.
 */
const DEUX_PAGES: Configuration = {
  ...CONFIGURATION_DEMO,
  contextes: CONFIGURATION_DEMO.contextes.map((contexte) =>
    contexte.id === 'maison'
      ? { ...contexte, pages: [...contexte.pages, pageVierge(contexte, 'maison-p2')!] }
      : contexte,
  ),
}

describe('espace parents', () => {
  it('propose un contexte par entrée, plus la barre, jamais une page', () => {
    const options = monter().findAll('option')

    // Extérieur (masqué en entier) est bien proposé : c'est précisément là qu'on révèle.
    // Aucune entrée par page : c'est une notion de développeur, pas de parent.
    expect(options.map((o) => o.element.value)).toEqual(['maison', 'exterieur', 'douleur', 'barre'])
  })

  it('reste une entrée par contexte même quand un contexte a plusieurs pages', () => {
    // Le vrai test de cette règle : sur la configuration livrée, une page par contexte,
    // lister les pages donnerait la même chose et ne prouverait rien.
    const options = monter(null, DEUX_PAGES).findAll('option')

    expect(options.map((o) => o.element.value)).toEqual(['maison', 'exterieur', 'douleur', 'barre'])
    expect(options.map((o) => o.text())).toEqual(['Maison', 'Extérieur', "J'ai mal", 'Mots essentiels'])
  })

  it('nomme les contextes pour un parent, jamais par un numéro de page', () => {
    const libelles = monter()
      .findAll('option')
      .map((o) => o.text())

    expect(libelles).toEqual(['Maison', 'Extérieur', "J'ai mal", 'Mots essentiels'])
  })

  it('range les réglages dans leur onglet, et relaie ce que le parent y change', async () => {
    // Les réglages ne se changent presque jamais : les laisser sous les yeux de celui qui
    // vient arranger les mots, c'est encombrer le geste quotidien avec le geste rare.
    const ecran = monter()
    expect(cache(ecran, '[data-onglet-reglages]')).toBe(true)

    await ecran.get('[data-onglet="reglages"]').trigger('click')
    const bascule = ecran.get('[data-reglage-retour]')
    expect((bascule.element as HTMLInputElement).checked).toBe(true)

    await bascule.setValue(false)
    await ecran.get('[data-volume="fort"]').setValue()
    await ecran.get('[data-fermete="assure"]').setValue()

    expect(ecran.emitted('reglerRetourAutomatique')).toEqual([[false]])
    expect(ecran.emitted('reglerVolume')).toEqual([[100]])
    expect(ecran.emitted('reglerFermete')).toEqual([['assure']])
  })

  it('ouvre sur les mots, et donne une page par question du parent', async () => {
    // Une question par page : ce qu'il peut dire, son travail est-il à l'abri, comment la
    // tablette se comporte. Les trois empilées, le grave était sous le doigt du courant et
    // la sauvegarde tombait sous la ligne de flottaison.
    const ecran = monter()
    expect(ecran.find('[data-grille-parents]').exists()).toBe(true)
    expect(cache(ecran, '[data-onglet-sauvegarde]')).toBe(true)
    expect(cache(ecran, '[data-onglet-reglages]')).toBe(true)

    await ecran.get('[data-onglet="sauvegarde"]').trigger('click')

    expect(ecran.find('[data-grille-parents]').exists()).toBe(false)
    expect(cache(ecran, '[data-onglet-sauvegarde]')).toBe(false)
    expect(ecran.find('[data-etat-tablette]').exists()).toBe(true)
    // les réglages ne suivent pas la sauvegarde : c'est l'autre question, l'autre page
    expect(cache(ecran, '[data-onglet-reglages]')).toBe(true)

    await ecran.get('[data-onglet="reglages"]').trigger('click')

    expect(cache(ecran, '[data-onglet-reglages]')).toBe(false)
    expect(cache(ecran, '[data-onglet-sauvegarde]')).toBe(true)
    expect(ecran.find('[data-reglages-parents]').exists()).toBe(true)
    expect(ecran.find('[data-version]').exists()).toBe(true)

    await ecran.get('[data-onglet="mots"]').trigger('click')

    // caché et non démonté : la sauvegarde et la restauration gardent leur état chez elles,
    // et un aller-retour effaçait le message disant qu'une archive est illisible
    expect(ecran.find('[data-grille-parents]').exists()).toBe(true)
    expect(cache(ecran, '[data-onglet-sauvegarde]')).toBe(true)
    expect(cache(ecran, '[data-onglet-reglages]')).toBe(true)
  })

  it('dit si le travail de la famille est dans un fichier de sauvegarde', async () => {
    // Sur le drapeau qui lève déjà le rappel à la fermeture : sans cette phrase, rien à
    // l'écran ne distinguait une tablette sauvegardée d'une tablette qui ne l'a jamais été.
    const aJour = await monterSurLaSauvegarde(null, {
      ...CONFIGURATION_DEMO,
      reglages: { ...CONFIGURATION_DEMO.reglages, modifieDepuisSauvegarde: false },
    })
    expect(aJour.get('[data-etat-sauvegarde]').text()).toContain("Rien n'a changé")
    expect(aJour.get('[data-etat-sauvegarde]').classes()).not.toContain('alerte')

    const enRetard = await monterSurLaSauvegarde(null, {
      ...CONFIGURATION_DEMO,
      reglages: { ...CONFIGURATION_DEMO.reglages, modifieDepuisSauvegarde: true },
    })
    expect(enRetard.get('[data-etat-sauvegarde]').text()).toContain('pas encore')
    expect(enRetard.get('[data-etat-sauvegarde]').classes()).toContain('alerte')
  })

  it('affiche une case masquée comme telle, et une révélée comme affichée', () => {
    const ecran = monter()

    // Le mot « masqué » reste écrit sur la case cachée : le pointillé ne doit jamais être la
    // seule marque. L'état affiché, lui, ne s'écrit plus sous quatorze cases sur seize, il se
    // lit sur l'attribut, que le test et le lecteur d'écran prennent au même endroit.
    const pipi = ecran.get('[data-case-parent="pipi"]')
    expect(pipi.text()).toContain('masqué')
    expect(pipi.classes()).toContain('masquee')
    expect(pipi.attributes('data-etat')).toBe('masqué')
    expect(pipi.attributes('aria-pressed')).toBe('false')

    const maman = ecran.get('[data-case-parent="maman"]')
    expect(maman.text()).not.toContain('affiché')
    expect(maman.classes()).not.toContain('masquee')
    expect(maman.attributes('data-etat')).toBe('affiché')
    expect(maman.attributes('aria-pressed')).toBe('true')
  })

  it('un emplacement vide devient un bouton pour y ajouter un mot', async () => {
    const ecran = monter()
    await ecran.get('select').setValue('barre')

    expect(ecran.findAll('[data-grille-parents] > *')).toHaveLength(5)
    expect(ecran.findAll('.emplacement-libre')).toHaveLength(2)
    expect(ecran.findAll('[data-case-parent]')).toHaveLength(3)
    expect(ecran.findAll('[data-ajouter-case]')).toHaveLength(2)
  })

  it('annonce ce que la mise à jour a apporté, et rassure sur le reste', async () => {
    // le parent n'a rien demandé : il découvrirait des mots nouveaux sans savoir d'où ils
    // viennent, et croirait que l'application a touché à son travail
    const ecran = await monterSurLesReglages(true, CONFIGURATION_DEMO, '', true, ["J'ai mal"])

    const texte = ecran.get('[data-nouveautes]').text()
    expect(texte).toContain("J'ai mal")
    expect(texte).toContain("n'a été touché")
  })

  it('se tait quand la mise à jour n a rien apporté', async () => {
    const ecran = await monterSurLesReglages()
    expect(ecran.find('[data-nouveautes]').exists()).toBe(false)
  })

  it('dit d installer l application tant qu elle tourne dans le navigateur', async () => {
    // le danger le plus probable pour son travail n'est pas le manque de place : iOS efface
    // les données des sites qu'on n'ouvre pas pendant une semaine, sauf s'ils sont installés
    const ecran = await monterSurLaSauvegarde(true, CONFIGURATION_DEMO, '', false)

    expect(ecran.get('[data-verdict-stockage]').text()).toContain("n'est pas installée")
    expect(ecran.get('[data-verdict-stockage]').text()).toContain('une semaine')
  })

  it('se tait sur l installation une fois l application posée sur l écran d accueil', async () => {
    const ecran = await monterSurLaSauvegarde(true)

    expect(ecran.get('[data-verdict-stockage]').text()).toBe('Le système garde vos réglages.')
  })

  it('chaque case porte Modifier et Déplacer, distincts de la bascule', () => {
    const ecran = monter()

    const carte = ecran.get('[data-case-parent="maman"]').element.closest('.carte')!
    // la bascule est la carte elle-même, plus les deux actions explicites
    expect(carte.querySelectorAll('button')).toHaveLength(3)
    expect(carte.querySelector('[data-modifier-case="maman"]')).not.toBeNull()
    expect(carte.querySelector('[data-deplacer-case="maman"]')).not.toBeNull()
  })

  it('dit qu un mot posé sur une autre page se trouvera en tournant la page', async () => {
    // Elle refermait l'espace parents, ne voyait rien de neuf sur l'écran de l'enfant, et
    // en concluait que son ajout avait échoué.
    const ecran = monter(null, DEUX_PAGES)
    await ecran.get('[data-page-suivante]').trigger('click')

    await ecran.findAll('[data-ajouter-case]')[0]!.trigger('click')
    await ecran.get('[data-champ-label]').setValue('GATEAU')
    await ecran.get('[data-champ-vocalization]').setValue('Je veux du gâteau')
    await ecran.get('[data-enregistrer-case]').trigger('click')

    const message = ecran.get('[data-message-ajout]').text()
    expect(message).toContain('GATEAU')
    expect(message).toContain('page 2')
    expect(message).toContain('en tournant la page')
  })

  it('se tait quand le mot est posé sur la page de départ, qui se voit tout de suite', async () => {
    // la page de départ de Maison est pleine : on passe par la barre, qui a des places libres
    const ecran = monter()
    await ecran.get('select').setValue('barre')

    await ecran.findAll('[data-ajouter-case]')[0]!.trigger('click')
    await ecran.get('[data-champ-label]').setValue('GATEAU')
    await ecran.get('[data-champ-vocalization]').setValue('Je veux du gâteau')
    await ecran.get('[data-enregistrer-case]').trigger('click')

    expect(ecran.find('[data-message-ajout]').exists()).toBe(false)
  })

  it('avertit quand le mot déplacé est déjà affiché, se tait quand il est masqué', async () => {
    // « ne jamais déplacer un mot connu » est la règle la plus importante de la notice, et
    // le bandeau disait exactement le contraire : « personne d'autre ne bouge ».
    const ecran = monter()

    await ecran.get('[data-deplacer-case="maman"]').trigger('click')
    expect(ecran.get('[data-avertissement-deplacement]').text()).toContain('ancienne place')

    await ecran.get('[data-annuler-deplacement]').trigger('click')
    await ecran.get('[data-deplacer-case="loki"]').trigger('click')

    // LOKI est masqué : L'enfant ne l'a jamais vu, le déplacer ne lui coûte rien
    expect(ecran.find('[data-avertissement-deplacement]').exists()).toBe(false)
  })

  it('« Ajouter un mot » demande la place avant d ouvrir l éditeur', async () => {
    // Jamais l'éditeur directement : c'est le parent qui choisit la place, et cette place ne
    // bougera plus. Le « + » sur une case vide reste, ce bouton le rend seulement trouvable.
    const ecran = monter()
    await ecran.get('select').setValue('exterieur')

    await ecran.get('[data-ajouter-mot]').trigger('click')

    expect(ecran.find('[data-editeur-case]').exists()).toBe(false)
    expect(ecran.get('[data-invitation-ajout]').text()).toContain('Touchez la place')
    const libre = ecran.findAll('[data-ajouter-case]')[0]!
    expect(libre.text()).toBe('Poser ici')
    expect(libre.classes()).toContain('cible')

    await libre.trigger('click')

    expect(ecran.find('[data-editeur-case]').exists()).toBe(true)
    expect(ecran.find('[data-bandeau-ajout]').exists()).toBe(false)
  })

  it('amène sur la première page qui a de la place quand celle-ci est pleine, et le dit', async () => {
    // Maison est pleine sur sa première page : sans ce saut, le parent appuyait sur le
    // bouton, ne voyait aucune case libre, et n'avait rien qui lui dise où aller.
    const ecran = monter()
    expect(ecran.get('[data-rang-page]').text()).toBe('Page 1 sur 2')

    await ecran.get('[data-ajouter-mot]').trigger('click')

    expect(ecran.get('[data-rang-page]').text()).toBe('Page 2 sur 2')
    expect(ecran.get('[data-invitation-ajout]').text()).toContain('Voici la page 2')
    expect(ecran.findAll('[data-ajouter-case]').length).toBeGreaterThan(0)
  })

  it('dit qu il n y a plus de place au lieu d ouvrir un mode qui ne mène nulle part', async () => {
    // La barre des mots essentiels a cinq places et pas de page suivante : une fois pleine,
    // le mode « choisir la place » n'aurait désigné aucune cible.
    let pleine = CONFIGURATION_DEMO
    for (const [ligne, colonne] of [
      [0, 3],
      [0, 4],
    ]) {
      pleine = ajouterCase(pleine, 'barre', ligne!, colonne!, {
        label: `Mot ${colonne}`,
        vocalization: `Mot ${colonne}`,
        ext_mesmots_enchaine: '',
        background_color: '#ffd25e',
        border_color: '#ffc93c',
      })
    }
    const ecran = monter(null, pleine)
    await ecran.get('select').setValue('barre')

    await ecran.get('[data-ajouter-mot]').trigger('click')

    expect(ecran.get('[data-plus-de-place]').text()).toContain('plus de place')
    expect(ecran.find('[data-invitation-ajout]').exists()).toBe(false)
    expect(ecran.find('[data-editeur-case]').exists()).toBe(false)
  })

  it('pendant un ajout, « Déplacer » ne reste pas touchable sous le bandeau', async () => {
    // Les deux bandeaux se posent au même endroit : celui de l'ajout recouvrait celui du
    // déplacement. Le parent lisait « touchez la place du nouveau mot » et échangeait deux
    // mots de place, ce que l'enfant paie à la case suivante.
    const ecran = monter()
    await ecran.get('select').setValue('exterieur')

    await ecran.get('[data-ajouter-mot]').trigger('click')

    expect(ecran.get('.actions-carte').classes()).toContain('effacee')
  })

  it('changer de contexte efface « il n y a plus de place »', async () => {
    let pleine = CONFIGURATION_DEMO
    for (const [ligne, colonne] of [
      [0, 3],
      [0, 4],
    ]) {
      pleine = ajouterCase(pleine, 'barre', ligne!, colonne!, {
        label: `Mot ${colonne}`,
        vocalization: `Mot ${colonne}`,
        ext_mesmots_enchaine: '',
        background_color: '#ffd25e',
        border_color: '#ffc93c',
      })
    }
    const ecran = monter(null, pleine)
    await ecran.get('select').setValue('barre')
    await ecran.get('[data-ajouter-mot]').trigger('click')
    expect(ecran.find('[data-plus-de-place]').exists()).toBe(true)

    await ecran.get('select').setValue('exterieur')

    expect(ecran.find('[data-bandeau-ajout]').exists()).toBe(false)
  })

  it('un déplacement en cours désigne les autres mots comme destinations', async () => {
    const ecran = monter()

    await ecran.get('[data-deplacer-case="maman"]').trigger('click')

    expect(ecran.get('[data-case-parent="maman"]').classes()).not.toContain('cible')
    expect(ecran.get('[data-case-parent="papa"]').classes()).toContain('cible')
    // les actions de carte s'effacent : un bouton grisé sous une case touchable faisait
    // croire que plus rien ne répondait
    expect(ecran.get('[data-modifier-case="papa"]').element.closest('.actions-carte')!.className)
      .toContain('effacee')
  })

  it('toucher un autre mot pendant un déplacement échange les deux places', async () => {
    const ecran = monter()

    await ecran.get('[data-deplacer-case="maman"]').trigger('click')
    await ecran.get('[data-case-parent="papa"]').trigger('click')

    // la planche de départ voyage avec le mot : le parent peut changer de page entre les
    // deux gestes, et l'échange se fait alors d'une page à l'autre
    expect(ecran.emitted('echanger')![0]).toEqual(['maison', 'maman', 'maison', 'papa'])
    expect(ecran.emitted('basculer')).toBeUndefined()
  })

  it('ouvrir l édition sur une case, y enregistrer, émet modifier vers le parent', async () => {
    const ecran = monter()

    await ecran.get('[data-modifier-case="maman"]').trigger('click')
    await ecran.get('[data-champ-label]').setValue('MAMAN CHÉRIE')
    await ecran.get('[data-champ-vocalization]').setValue('Je veux ma maman chérie')
    await ecran.get('[data-enregistrer-case]').trigger('click')

    expect(ecran.emitted('modifier')![0]).toEqual([
      'maison',
      'maman',
      expect.objectContaining({ label: 'MAMAN CHÉRIE', vocalization: 'Je veux ma maman chérie' }),
      { statut: 'inchange' },
      { statut: 'inchange' },
    ])
  })

  it('ouvrir l ajout sur un emplacement libre, y enregistrer, émet ajouter à la bonne coordonnée', async () => {
    const ecran = monter()
    await ecran.get('select').setValue('barre')

    // Les emplacements libres de la barre sont grid.order[0][3] et [0][4].
    await ecran.findAll('[data-ajouter-case]')[0]!.trigger('click')
    await ecran.get('[data-champ-label]').setValue('DODO')
    await ecran.get('[data-champ-vocalization]').setValue('Je veux dormir')
    await ecran.get('[data-enregistrer-case]').trigger('click')

    expect(ecran.emitted('ajouter')![0]).toEqual([
      'barre',
      0,
      3,
      expect.objectContaining({ label: 'DODO' }),
      { statut: 'inchange' },
      { statut: 'inchange' },
    ])
  })

  it('supprimer une case affiche un bandeau, émet supprimer et annuler émet restaurer', async () => {
    const ecran = monter()

    await ecran.get('[data-modifier-case="maman"]').trigger('click')
    await ecran.get('[data-demander-suppression]').trigger('click')
    await ecran.get('[data-confirmer-suppression]').trigger('click')

    expect(ecran.emitted('supprimer')).toEqual([['maison', 'maman']])

    // Le composant ne décide pas, il propose : le bandeau ne s'offre qu'une fois la
    // suppression réellement appliquée par le parent, sinon il promettrait une annulation
    // sur un emplacement encore occupé. On joue donc ce que fait App.vue.
    await ecran.setProps({ configuration: supprimerCase(CONFIGURATION_DEMO, 'maison', 'maman') })

    const bandeau = ecran.get('[data-bandeau-suppression]')
    expect(bandeau.text()).toContain('MAMAN a été supprimé')

    await ecran.get('[data-annuler-suppression]').trigger('click')

    expect(ecran.emitted('restaurer')![0]![0]).toBe('maison')
    expect(ecran.emitted('restaurer')![0]![1]).toBe(0)
    expect(ecran.emitted('restaurer')![0]![2]).toBe(0)
    expect((ecran.emitted('restaurer')![0]![3] as { id: string }).id).toBe('maman')
    expect(ecran.find('[data-bandeau-suppression]').exists()).toBe(false)
  })

  it('émet basculer avec la planche et la case sur un clic', async () => {
    const ecran = monter()

    await ecran.get('[data-case-parent="pipi"]').trigger('click')

    expect(ecran.emitted('basculer')).toEqual([['maison', 'pipi']])
  })

  it('émet fermer sur le bouton Terminé', async () => {
    const ecran = monter()

    await ecran.get('[data-fermer-parents]').trigger('click')

    expect(ecran.emitted('fermer')).toHaveLength(1)
  })

  it.each([
    [true, 'Le système garde vos réglages.'],
    [false, "Le système peut effacer vos réglages s'il manque de place. Enregistrez une sauvegarde et gardez le fichier ailleurs que sur la tablette."],
    [null, 'Le système vérifie encore si vos réglages seront gardés.'],
  ])('donne le verdict du stockage pour %s', async (valeur, texte) => {
    const ecran = await monterSurLaSauvegarde(valeur)

    expect(ecran.get('[data-verdict-stockage]').text()).toBe(texte)
  })
})

describe('purge des photos et sons supprimés (P4, P8)', () => {
  it('démonter sans avoir annulé une suppression émet purgerSuppressions avec la case perdue', async () => {
    // La pile d'annulation vit et meurt avec ce composant : au démontage, ce qui reste
    // dedans n'est plus rattrapable, c'est le signal pour App.vue d'effacer les blobs.
    const ecran = monter()

    await ecran.get('[data-modifier-case="maman"]').trigger('click')
    await ecran.get('[data-demander-suppression]').trigger('click')
    await ecran.get('[data-confirmer-suppression]').trigger('click')
    await ecran.setProps({ configuration: supprimerCase(CONFIGURATION_DEMO, 'maison', 'maman') })

    ecran.unmount()

    expect(ecran.emitted('purgerSuppressions')).toHaveLength(1)
    expect((ecran.emitted('purgerSuppressions')![0]![0] as { id: string }[]).map((c) => c.id)).toEqual(['maman'])
  })

  it('démonter après une annulation n émet aucune purge', async () => {
    const ecran = monter()

    await ecran.get('[data-modifier-case="maman"]').trigger('click')
    await ecran.get('[data-demander-suppression]').trigger('click')
    await ecran.get('[data-confirmer-suppression]').trigger('click')
    await ecran.setProps({ configuration: supprimerCase(CONFIGURATION_DEMO, 'maison', 'maman') })
    await ecran.get('[data-annuler-suppression]').trigger('click')

    ecran.unmount()

    expect(ecran.emitted('purgerSuppressions')).toBeUndefined()
  })
})

describe('purge des médias d un contexte supprimé', () => {
  it('démonter sans avoir annulé émet les mots du contexte perdu', async () => {
    const ecran = monter()

    await ecran.get('[data-supprimer-contexte]').trigger('click')
    await ecran.get('[data-confirmer-suppression-contexte]').trigger('click')
    await ecran.setProps({ configuration: supprimerContexte(CONFIGURATION_DEMO, 'maison') })

    ecran.unmount()

    const purgees = ecran.emitted('purgerSuppressions')![0]![0] as { id: string }[]
    // les seize mots de Maison, masqués compris : leurs photos et leurs voix n'ont plus
    // personne pour les réclamer
    expect(purgees).toHaveLength(16)
    expect(purgees.map((c) => c.id)).toContain('maman')
  })

  it('démonter après une annulation n émet aucune purge', async () => {
    const ecran = monter()

    await ecran.get('[data-supprimer-contexte]').trigger('click')
    await ecran.get('[data-confirmer-suppression-contexte]').trigger('click')
    await ecran.setProps({ configuration: supprimerContexte(CONFIGURATION_DEMO, 'maison') })
    await ecran.get('[data-annuler-contexte]').trigger('click')
    await ecran.setProps({ configuration: CONFIGURATION_DEMO })

    ecran.unmount()

    expect(ecran.emitted('purgerSuppressions')).toBeUndefined()
  })

  it('le bandeau ne promet plus l annulation quand la place a été reprise', async () => {
    const ecran = monter()
    await ecran.get('[data-supprimer-contexte]').trigger('click')
    await ecran.get('[data-confirmer-suppression-contexte]').trigger('click')
    const sansMaison = supprimerContexte(CONFIGURATION_DEMO, 'maison')
    await ecran.setProps({ configuration: sansMaison })
    expect(ecran.find('[data-bandeau-contexte-supprime]').exists()).toBe(true)

    // un contexte recréé reprend l'identifiant « maison » : le retour est devenu impossible
    await ecran.setProps({ configuration: ajouterContexte(sansMaison, 'Maison') })

    expect(ecran.find('[data-bandeau-contexte-supprime]').exists()).toBe(false)
  })
})

describe('la version affichée', () => {
  it('montre la version construite, pour que le déploiement se vérifie de l œil', async () => {
    // Un cache de service worker a déjà servi une version périmée sans que rien ne le
    // signale : « quelle version tourne ? » doit se répondre en regardant l'écran.
    const ecran = await monterSurLesReglages()

    expect(ecran.get('[data-version]').text()).toMatch(/Version du \d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
  })
})

describe('le bloc d état, à lire au téléphone', () => {
  it('compte les mots, les visibles, et les photos et voix de la famille depuis la configuration', async () => {
    // Pas de cloud, donc aucune visibilité à distance : quand la mère appelle, ce bloc est
    // ce qu'elle lit à le père. Les chiffres viennent de l'inventaire, jamais recomptés à l'écran.
    const avecMedias: Configuration = {
      ...CONFIGURATION_DEMO,
      contextes: CONFIGURATION_DEMO.contextes.map((contexte) => ({
        ...contexte,
        pages: contexte.pages.map((page) => ({
          ...page,
          buttons: page.buttons.map((c) =>
            c.id === 'maman' ? { ...c, image_id: 'perso/maman', sound_id: 'perso/maman' } : c,
          ),
        })),
      })),
    }
    const ecran = await monterSurLaSauvegarde(null, avecMedias)

    expect(ecran.get('[data-etat-mots]').text()).toBe('40 mots')
    expect(ecran.get('[data-etat-visibles]').text()).toBe('32 visibles')
    expect(ecran.get('[data-etat-photos]').text()).toBe('1 photo')
    expect(ecran.get('[data-etat-voix]').text()).toBe('1 voix')
  })

  it('ne promet pas de place occupée quand le navigateur ne sait pas la donner', async () => {
    // happy-dom n'a pas navigator.storage : la ligne doit simplement manquer, pas mentir
    const ecran = await monterSurLaSauvegarde()
    expect(ecran.find('[data-etat-stockage]').exists()).toBe(false)
  })
})


describe('une annulation ne promet pas une case dont l identifiant a été repris', () => {
  it('retire la suppression des rattrapables dès qu un mot recréé porte le même identifiant', async () => {
    const ecran = monter()
    await ecran.get('[data-modifier-case="boire"]').trigger('click')
    await ecran.get('[data-demander-suppression]').trigger('click')
    await ecran.get('[data-confirmer-suppression]').trigger('click')
    const sansBoire = supprimerCase(CONFIGURATION_DEMO, 'maison', 'boire')
    await ecran.setProps({ configuration: sansBoire })
    expect(ecran.find('[data-bandeau-suppression]').exists()).toBe(true)

    // le parent recrée « Boire » ailleurs, sous le même identifiant
    const recreee = ajouterCase(sansBoire, 'exterieur', 1, 0, {
      label: 'Boire', vocalization: 'Je veux boire', ext_mesmots_enchaine: 'boire',
      background_color: '#ffd25e', border_color: '#ffc93c',
    })
    await ecran.setProps({ configuration: recreee })

    expect(ecran.find('[data-bandeau-suppression]').exists()).toBe(false)
  })
})

describe('un enregistrement qui échoue se voit (D13)', () => {
  it('ne dit rien tant que tout passe', () => {
    expect(monter().find('[data-erreur-enregistrement]').exists()).toBe(false)
  })

  it('affiche le message et dit quoi faire', () => {
    const ecran = monter(null, CONFIGURATION_DEMO, "Le dernier changement n'a pas pu être enregistré.")
    expect(ecran.get('[data-erreur-enregistrement]').text()).toContain("n'a pas pu être enregistré")
  })

  it('se voit depuis les deux onglets : un réglage aussi peut ne pas s enregistrer', async () => {
    const ecran = await monterSurLesReglages(null, CONFIGURATION_DEMO, "Le dernier changement n'a pas pu être enregistré.")

    expect(ecran.get('[data-erreur-enregistrement]').text()).toContain("n'a pas pu être enregistré")
  })
})

describe('effacer toute la configuration (P10)', () => {
  it('ne propose l effacement qu une fois, et demande confirmation avant d émettre', async () => {
    const ecran = await monterSurLaSauvegarde()

    await ecran.get('[data-demander-effacement]').trigger('click')

    // le premier appui ouvre la confirmation, il n'efface rien
    expect(ecran.find('[data-confirmation-effacement]').exists()).toBe(true)
    expect(ecran.find('[data-demander-effacement]').exists()).toBe(false)
    expect(ecran.emitted('toutEffacer')).toBeUndefined()
  })

  it('dit ce qui sera perdu et conseille une sauvegarde avant', async () => {
    const ecran = await monterSurLaSauvegarde()

    await ecran.get('[data-demander-effacement]').trigger('click')

    const texte = ecran.get('[data-confirmation-effacement]').text()
    expect(texte).toContain('photos')
    expect(texte).toContain('voix')
    expect(texte).toContain('sauvegarde')
  })

  it('annuler referme sans rien émettre', async () => {
    const ecran = await monterSurLaSauvegarde()
    await ecran.get('[data-demander-effacement]').trigger('click')

    await ecran.get('[data-annuler-effacement]').trigger('click')

    expect(ecran.find('[data-confirmation-effacement]').exists()).toBe(false)
    expect(ecran.emitted('toutEffacer')).toBeUndefined()
  })

  it('le second appui émet l effacement', async () => {
    const ecran = await monterSurLaSauvegarde()
    await ecran.get('[data-demander-effacement]').trigger('click')

    await ecran.get('[data-confirmer-effacement]').trigger('click')

    expect(ecran.emitted('toutEffacer')).toHaveLength(1)
  })
})

describe('vérifier les mises à jour', () => {
  it('dit quoi faire quand la tablette est hors ligne, au lieu d un bouton sans effet', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const ecran = await monterSurLesReglages()

    await ecran.get('[data-verifier-maj]').trigger('click')

    expect(ecran.get('[data-etat-maj]').text()).toContain('Pas de connexion')
  })

  it('annonce qu une nouvelle version arrive quand le service worker en installe une', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    const enregistrement = { update: () => Promise.resolve(), installing: {} }
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: () => Promise.resolve(enregistrement) },
      configurable: true,
    })
    const ecran = await monterSurLesReglages()

    await ecran.get('[data-verifier-maj]').trigger('click')
    await new Promise((resoudre) => setTimeout(resoudre))

    expect(ecran.get('[data-etat-maj]').text()).toContain('Nouvelle version')
  })

  it('rassure quand la tablette est déjà à jour', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: () => Promise.resolve({ update: () => Promise.resolve(), installing: null }) },
      configurable: true,
    })
    const ecran = await monterSurLesReglages()

    await ecran.get('[data-verifier-maj]').trigger('click')
    await new Promise((resoudre) => setTimeout(resoudre))

    expect(ecran.get('[data-etat-maj]').text()).toContain('déjà la dernière version')
    expect(ecran.find('[data-redemarrer-maj]').exists()).toBe(false)
  })

  it('offre de redémarrer dès que la nouvelle version prend la main', async () => {
    // Vécu : la mère avait vidé le cache à la main pour voir le réglage neuf. La version
    // installée n'arrive qu'au lancement suivant, et rien ne le lui proposait. C'est
    // l'application entière qui écoute le changement, l'espace parents n'en lit que l'état.
    const ecran = await monterSurLesReglages()
    expect(ecran.find('[data-redemarrer-maj]').exists()).toBe(false)

    await ecran.setProps({ nouvelleVersionPrete: true })

    expect(ecran.get('[data-etat-maj]').text()).toContain('Nouvelle version prête')
    expect(ecran.find('[data-redemarrer-maj]').exists()).toBe(true)
  })

  it('ne rétrograde pas « prête » en « déjà à jour » quand la version arrive pendant la recherche', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    const ecran = await monterSurLesReglages()
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: {},
        // elle prend la main pendant la recherche, et `installing` est déjà retombé à rien :
        // le test d'après la recherche ne verrait plus qu'une tablette « déjà à jour »
        getRegistration: () =>
          Promise.resolve({
            update: async () => {
              await ecran.setProps({ nouvelleVersionPrete: true })
            },
            installing: null,
          }),
      },
      configurable: true,
    })

    await ecran.get('[data-verifier-maj]').trigger('click')
    await new Promise((resoudre) => setTimeout(resoudre))

    expect(ecran.get('[data-etat-maj]').text()).toContain('Nouvelle version prête')
    expect(ecran.find('[data-redemarrer-maj]').exists()).toBe(true)
  })

  it('n offre rien à la première installation, qui prend un contrôleur elle aussi', async () => {
    const auditeurs: Record<string, () => void> = {}
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: null,
        addEventListener: (nom: string, auditeur: () => void) => (auditeurs[nom] = auditeur),
      },
      configurable: true,
    })
    const ecran = await monterSurLesReglages()

    expect(auditeurs.controllerchange).toBeUndefined()
    expect(ecran.find('[data-redemarrer-maj]').exists()).toBe(false)
  })
})


describe('créer, renommer et supprimer un contexte (P11)', () => {
  it('crée le contexte saisi, et refuse un nom vide', async () => {
    const ecran = monter()

    await ecran.get('[data-nouveau-contexte]').trigger('click')
    await ecran.get('[data-valider-contexte]').trigger('click')
    expect(ecran.get('[data-erreur-contexte]').text()).toContain('nom')
    expect(ecran.emitted('ajouterContexte')).toBeUndefined()

    await ecran.get('[data-champ-nom-contexte]').setValue('École')
    await ecran.get('[data-valider-contexte]').trigger('click')

    expect(ecran.emitted('ajouterContexte')![0]).toEqual(['École'])
    expect(ecran.find('[data-formulaire-contexte]').exists()).toBe(false)
  })

  it('dit quel contexte porte déjà ce nom, et garde la saisie (D21)', async () => {
    const ecran = monter()

    await ecran.get('[data-nouveau-contexte]').trigger('click')
    // la mère tape sans accent, comme sur un clavier de tablette
    await ecran.get('[data-champ-nom-contexte]').setValue('exterieur')
    await ecran.get('[data-valider-contexte]').trigger('click')

    expect(ecran.get('[data-erreur-contexte]').text()).toContain('Extérieur')
    expect(ecran.emitted('ajouterContexte')).toBeUndefined()
    // le formulaire reste ouvert : elle corrige le nom, elle ne le retape pas
    expect(ecran.get<HTMLInputElement>('[data-champ-nom-contexte]').element.value).toBe('exterieur')
  })

  it('renommer un contexte avec son propre nom n est pas un doublon', async () => {
    const ecran = monter()

    await ecran.get('[data-renommer-contexte]').trigger('click')
    await ecran.get('[data-champ-nom-contexte]').setValue('MAISON')
    await ecran.get('[data-valider-contexte]').trigger('click')

    expect(ecran.emitted('renommerContexte')![0]).toEqual(['maison', 'MAISON'])
  })

  it('la liste se place sur le contexte qui vient d être créé', async () => {
    const ecran = monter()
    await ecran.get('[data-nouveau-contexte]').trigger('click')
    await ecran.get('[data-champ-nom-contexte]').setValue('Jardin')
    await ecran.get('[data-valider-contexte]').trigger('click')

    // on crée un contexte pour le remplir : rester sur l'ancien ferait poser les premiers
    // mots au mauvais endroit
    await ecran.setProps({ configuration: ajouterContexte(CONFIGURATION_DEMO, 'Jardin') })

    expect((ecran.get('[data-selecteur-planche]').element as HTMLSelectElement).value).toBe('jardin')
  })

  it('le renommage part du nom actuel, pour corriger plutôt que tout retaper', async () => {
    const ecran = monter()

    await ecran.get('[data-renommer-contexte]').trigger('click')

    expect((ecran.get('[data-champ-nom-contexte]').element as HTMLInputElement).value).toBe('Maison')
  })

  it('le renommage vise le contexte sur lequel il a été ouvert, pas celui affiché après', async () => {
    // le sélecteur reste actif sous le formulaire : le toucher par mégarde renommait le
    // contexte d'à côté, sans que rien à l'écran ne nomme la cible
    const ecran = monter()
    await ecran.get('[data-renommer-contexte]').trigger('click')
    await ecran.get('[data-champ-nom-contexte]').setValue('Chalet')

    await ecran.get('select').setValue('exterieur')

    // changer de contexte referme un formulaire qui ne le concerne plus
    expect(ecran.find('[data-formulaire-contexte]').exists()).toBe(false)
    expect(ecran.emitted('renommerContexte')).toBeUndefined()
  })

  it('l image choisie pour un bouton part redimensionnée, avec le contexte affiché', async () => {
    // l'enfant ne lit pas : un contexte créé par la famille n'a aucune image tant qu'elle
    // n'en choisit pas, et son bouton ne se distingue alors que par un mot écrit
    const vignette = new Blob(['vignette'], { type: 'image/jpeg' })
    redimensionnerImage.mockResolvedValue(vignette)
    const ecran = monter()
    await ecran.get('[data-selecteur-planche]').setValue('exterieur')

    const fichier = new File(['photo'], 'jardin.png', { type: 'image/png' })
    const entree = ecran.get('[data-champ-image-contexte]')
    Object.defineProperty(entree.element, 'files', { value: [fichier], configurable: true })
    await entree.trigger('change')
    await new Promise((resoudre) => setTimeout(resoudre))

    expect(redimensionnerImage).toHaveBeenCalledWith(fichier)
    expect(ecran.emitted('imageDeContexte')).toEqual([['exterieur', vignette]])
  })

  it('dit qu une image est illisible au lieu de ne rien faire', async () => {
    redimensionnerImage.mockRejectedValue(new Error('illisible'))
    const ecran = monter()

    const entree = ecran.get('[data-champ-image-contexte]')
    Object.defineProperty(entree.element, 'files', {
      value: [new File(['x'], 'x.txt', { type: 'text/plain' })],
      configurable: true,
    })
    await entree.trigger('change')
    await new Promise((resoudre) => setTimeout(resoudre))

    expect(ecran.get('[data-erreur-image-contexte]').text()).toContain('pas pu être lue')
    expect(ecran.emitted('imageDeContexte')).toBeUndefined()
  })

  it('montre ce que l enfant a dit aujourd hui, avec l heure, sans rien compter', async () => {
    // demandé par la mère, à sa condition : effacé à minuit, « pas de statistiques, pas de
    // comptage, pas de score ». Une liste, et rien d'autre.
    const journal: EntreeJournal[] = [
      { horodatage: new Date(2026, 8, 9, 8, 5).getTime(), mot: 'MAMAN' },
      { horodatage: new Date(2026, 8, 9, 12, 30).getTime(), mot: 'MANGER' },
    ]
    const ecran = monter(null, CONFIGURATION_DEMO, '', true, [], journal)

    // le composant affiche ce qu'on lui donne : le tri est au domaine, éprouvé par
    // journal.test.ts, et le plus récent arrive en tête
    const lignes = ecran.findAll('[data-entree-journal]')
    expect(lignes).toHaveLength(2)
    expect(lignes[0]!.text()).toContain('08:05')
    expect(lignes[0]!.text()).toContain('MAMAN')
    expect(lignes[1]!.text()).toContain('12:30')
    expect(ecran.find('[data-journal-vide]').exists()).toBe(false)
  })

  it('découpe la journée par heure plutôt qu en un mur de lignes identiques', () => {
    const journal: EntreeJournal[] = [
      { horodatage: new Date(2026, 8, 9, 17, 12).getTime(), mot: 'MANGER' },
      { horodatage: new Date(2026, 8, 9, 17, 3).getTime(), mot: 'MANGER' },
      { horodatage: new Date(2026, 8, 9, 8, 5).getTime(), mot: 'MAMAN' },
    ]
    const ecran = monter(null, CONFIGURATION_DEMO, '', true, [], journal)

    const heures = ecran.findAll('[data-heure-journal]').map((h) => h.text())
    expect(heures).toEqual(['Vers 17\u00a0h', 'Vers 8\u00a0h'])
  })

  it('replié, il porte le dernier mot dit : sinon il ne dit pas s il contient quelque chose', () => {
    const journal: EntreeJournal[] = [
      { horodatage: new Date(2026, 8, 9, 17, 12).getTime(), mot: 'MANGER' },
      { horodatage: new Date(2026, 8, 9, 8, 5).getTime(), mot: 'MAMAN' },
    ]
    const ecran = monter(null, CONFIGURATION_DEMO, '', true, [], journal)

    const replie = ecran.get('[data-dernier-dit]').text()
    expect(replie).toContain('MANGER')
    expect(replie).toContain('17:12')
    // la mère a posé « pas de comptage » comme condition : la ligne repliée ne la contourne pas
    expect(replie).not.toMatch(/\d+\s*(fois|mots)/)
  })

  it('sans rien dit aujourd hui, la ligne repliée ne promet pas de contenu', () => {
    const ecran = monter()

    expect(ecran.find('[data-dernier-dit]').exists()).toBe(false)
  })

  it('dit que la liste se vide chaque nuit plutôt que de laisser un blanc', () => {
    const ecran = monter()

    expect(ecran.get('[data-journal-vide]').text()).toContain('vide toute seule chaque nuit')
  })

  it('la confirmation de suppression nomme le contexte, ses mots, et le décalage des boutons', async () => {
    const ecran = monter()

    await ecran.get('[data-supprimer-contexte]').trigger('click')

    const texte = ecran.get('[data-confirmation-contexte]').text()
    expect(texte).toContain('Maison')
    expect(texte).toContain('16 mots')
    // seule opération du projet qui déplace des repères appris : elle se dit
    expect(texte).toContain('avanceront')
  })

  /** Sans Maison, comme la configuration reviendra du parent après la suppression. */
  const SANS_MAISON: Configuration = {
    ...CONFIGURATION_DEMO,
    contextes: CONFIGURATION_DEMO.contextes.filter((c) => c.id !== 'maison'),
  }

  it('supprime après confirmation, et propose de revenir en arrière', async () => {
    const ecran = monter()

    await ecran.get('[data-supprimer-contexte]').trigger('click')
    await ecran.get('[data-confirmer-suppression-contexte]').trigger('click')
    // la promesse d'annulation se calcule sur l'état réel : tant que le contexte est encore
    // là, le bandeau ne s'affiche pas, exactement comme pour une case supprimée
    await ecran.setProps({ configuration: SANS_MAISON })

    expect(ecran.emitted('supprimerContexte')![0]).toEqual(['maison'])
    expect(ecran.get('[data-bandeau-contexte-supprime]').text()).toContain('Maison')
  })

  it("l'annulation rend le contexte à son rang d'origine", async () => {
    const ecran = monter()
    await ecran.get('[data-supprimer-contexte]').trigger('click')
    await ecran.get('[data-confirmer-suppression-contexte]').trigger('click')
    await ecran.setProps({ configuration: SANS_MAISON })

    await ecran.get('[data-annuler-contexte]').trigger('click')

    // le rang, pas la queue : remettre Maison après Extérieur déplacerait les boutons du
    // haut une seconde fois, et l'enfant chercherait un monde à la place d'un autre
    expect(ecran.emitted('restaurerContexte')![0]![1]).toBe(0)
  })

  it('ne propose pas de supprimer le dernier contexte restant', () => {
    const seule: Configuration = { ...CONFIGURATION_DEMO, contextes: [CONFIGURATION_DEMO.contextes[0]!] }

    const ecran = monter(null, seule)

    expect(ecran.find('[data-supprimer-contexte]').exists()).toBe(false)
  })

  it('dit pourquoi il n y a plus de place au-delà de cinq contextes', () => {
    // fabriquée par le domaine, pas à la main : deux contextes qui partageraient une planche
    // ne pourraient jamais exister, et le test mentirait le jour où il touchera aux pages
    let cinq = CONFIGURATION_DEMO
    while (cinq.contextes.length < CONTEXTES_MAXIMUM) {
      cinq = ajouterContexte(cinq, `Contexte ${cinq.contextes.length}`)
    }

    const ecran = monter(null, cinq)

    expect(ecran.find('[data-nouveau-contexte]').exists()).toBe(false)
    expect(ecran.get('[data-contextes-au-max]').text()).toContain("l'écran de l'enfant")
  })
})
