<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  COTE_DE_CASE_MINIMUM_CM,
  coteDeCaseEnCm,
  FERMETES,
  FORME_MAXIMUM,
  FORME_MINIMUM,
  tailleDeCaseEcrite,
  VOLUMES,
  VOLUME_MAXIMUM,
  VOLUME_MINIMUM,
} from '../domaine/reglages'
import {
  consequenceEcrite,
  consequencesDuChangementDeForme,
  formeDeGrille,
  type Configuration,
  type FormeDeGrille,
} from '../domaine/planche'

const props = defineProps<{ configuration: Configuration }>()
const emit = defineEmits<{
  reglerRetourAutomatique: [actif: boolean]
  reglerVolume: [pourcentage: number]
  reglerFermete: [cle: string]
  reglerAnimations: [actif: boolean]
  reglerEnchainement: [actif: boolean]
  reglerCorpsAToucher: [actif: boolean]
  changerForme: [forme: FormeDeGrille]
}>()

const reglages = computed(() => props.configuration.reglages)

const fermeteChoisie = () => FERMETES.find((niveau) => niveau.cle === reglages.value.fermeteAppui) ?? FERMETES[0]!

/**
 * La valeur montrée pendant qu'on fait glisser. L'enregistrement, lui, n'a lieu qu'au
 * relâchement : un glissement de bout en bout réécrivait dix-huit fois la configuration
 * entière. Mais sans ce suivi, le chiffre restait figé et on réglait le volume à l'aveugle.
 */
const volumeEnCours = ref<number | null>(null)
const volumeAffiche = computed(() => volumeEnCours.value ?? reglages.value.volume)

function surGlissement(evenement: Event) {
  volumeEnCours.value = Number((evenement.target as HTMLInputElement).value)
}

function surRelachement(evenement: Event) {
  volumeEnCours.value = null
  emit('reglerVolume', Number((evenement.target as HTMLInputElement).value))
}

/**
 * La forme que la mère est en train d'essayer, tant qu'elle n'a pas confirmé. `null` veut
 * dire « celle d'aujourd'hui » : garder la forme en service dans cette référence l'aurait
 * figée le jour où le changement aboutit vraiment. Ouverte au parent parce que « Garder la
 * grille actuelle » doit ramener les compteurs au présent, comme son libellé le promet.
 */
const formeEssayee = defineModel<FormeDeGrille | null>('formeEssayee', { default: null })
const formeActuelle = computed(() => formeDeGrille(props.configuration))
const forme = computed(() => formeEssayee.value ?? formeActuelle.value)
// sur les deux nombres et non sur l'objet : `formeActuelle` en rend un neuf à chaque
// écriture de configuration, et régler le volume effaçait la forme que la mère essayait
watch(
  () => `${formeActuelle.value.colonnes}x${formeActuelle.value.lignes}`,
  () => (formeEssayee.value = null),
)

const AXES = [
  { cle: 'colonnes', titre: 'Colonnes', unMoins: 'Une colonne de moins', unPlus: 'Une colonne de plus' },
  { cle: 'lignes', titre: 'Lignes', unMoins: 'Une ligne de moins', unPlus: 'Une ligne de plus' },
] as const

function decaler(cle: 'colonnes' | 'lignes', pas: number) {
  const valeur = Math.min(FORME_MAXIMUM, Math.max(FORME_MINIMUM, forme.value[cle] + pas))
  formeEssayee.value = { ...forme.value, [cle]: valeur }
}

const formeChangee = computed(
  () => forme.value.colonnes !== formeActuelle.value.colonnes || forme.value.lignes !== formeActuelle.value.lignes,
)

/** Au présent tant que rien n'a bougé, au futur dès qu'un compteur a changé. */
const lectureEnCm = computed(() => {
  const taille = tailleDeCaseEcrite(forme.value.colonnes, forme.value.lignes)
  if (!formeChangee.value) return `Aujourd'hui, chaque case fait environ ${taille}.`
  return `Avec ${forme.value.colonnes} colonnes et ${forme.value.lignes} lignes, chaque case fera environ ${taille}.`
})

const tropPetite = computed(
  () => coteDeCaseEnCm(forme.value.colonnes, forme.value.lignes) < COTE_DE_CASE_MINIMUM_CM,
)

const consequence = computed(() =>
  consequenceEcrite(consequencesDuChangementDeForme(props.configuration, forme.value)),
)
</script>

<template>
  <!-- Pas de titre « Réglages » : l'onglet le dit déjà, et les quatre légendes portent la
       structure. Répété, il faisait lire deux fois le même mot avant le premier réglage. -->
  <section class="reglages" data-reglages-parents>
    <!-- Trois groupes nommés par ce que le parent observe, et rangés du plus anodin au
         plus lourd de conséquences : le dangereux n'est jamais le premier sous le doigt. -->
    <fieldset>
      <legend>Le volume</legend>
      <div class="niveaux">
        <label v-for="niveau in VOLUMES" :key="niveau.cle" class="niveau">
          <input
            type="radio"
            name="volume"
            :value="niveau.cle"
            :checked="reglages.volume === niveau.pourcentage"
            :data-volume="niveau.cle"
            @change="emit('reglerVolume', niveau.pourcentage)"
          />
          <span>{{ niveau.libelle }}</span>
        </label>
      </div>
      <!-- au relâchement et non à chaque cran : un glissement de bout en bout réécrivait
           dix-huit fois la configuration entière dans IndexedDB -->
      <label class="reglette">
        <span class="reglette-titre">Réglage fin</span>
        <input
          type="range"
          :min="VOLUME_MINIMUM"
          :max="VOLUME_MAXIMUM"
          step="5"
          :value="volumeAffiche"
          data-volume-reglette
          @input="surGlissement"
          @change="surRelachement"
        />
        <output data-volume-valeur>{{ volumeAffiche }} %</output>
      </label>
    </fieldset>

    <fieldset>
      <legend>L'appui</legend>
      <div class="niveaux">
        <label v-for="niveau in FERMETES" :key="niveau.cle" class="niveau">
          <input
            type="radio"
            name="fermete"
            :value="niveau.cle"
            :checked="reglages.fermeteAppui === niveau.cle"
            :data-fermete="niveau.cle"
            @change="emit('reglerFermete', niveau.cle)"
          />
          <span>{{ niveau.libelle }}</span>
        </label>
      </div>
      <p class="aide" data-aide-fermete>{{ fermeteChoisie().aide }}</p>
    </fieldset>

    <fieldset>
      <legend>L'écran de l'enfant</legend>
      <label class="interrupteur">
        <input
          type="checkbox"
          :checked="reglages.retourAutomatique"
          data-reglage-retour
          @change="emit('reglerRetourAutomatique', ($event.target as HTMLInputElement).checked)"
        />
        Revenir à l'écran de départ après 30 secondes sans appui
      </label>
      <label class="interrupteur">
        <input
          type="checkbox"
          :checked="reglages.animations"
          data-reglage-animations
          @change="emit('reglerAnimations', ($event.target as HTMLInputElement).checked)"
        />
        Animer la case pendant que son mot est dit
      </label>
      <label class="interrupteur">
        <input
          type="checkbox"
          :checked="reglages.enchainement"
          data-reglage-enchainement
          @change="emit('reglerEnchainement', ($event.target as HTMLInputElement).checked)"
        />
        Garder les mots les uns après les autres
      </label>
      <p class="aide" data-aide-enchainement>
        L'enfant touche plusieurs cases, elles s'affichent en haut, et il peut se faire
        relire toute la phrase.
      </p>
      <label class="interrupteur">
        <input
          type="checkbox"
          :checked="reglages.corpsAToucher"
          data-reglage-corps
          @change="emit('reglerCorpsAToucher', ($event.target as HTMLInputElement).checked)"
        />
        Montrer la douleur sur un corps
      </label>
      <p class="aide" data-aide-corps>
        Coché, « J'ai mal » montre deux corps dessinés, de face et de dos, et le doigt se pose
        sur l'endroit. Décoché, ce sont des cases comme partout ailleurs, une par partie du
        corps. Les mêmes mots, les mêmes voix : seule la forme change.
      </p>
    </fieldset>

    <!-- Le dernier groupe de l'écran, parce que c'est le seul réglage qui déplace des mots :
         l'enfant repère les siens à leur place, et il devra en réapprendre certains. -->
    <fieldset>
      <legend>La forme de la grille</legend>
      <!-- Les compteurs à côté de l'aperçu dès qu'il y a la place : empilés, ils poussaient
           la conséquence et le bouton sous la ligne de flottaison. -->
      <div class="forme-reglage">
        <div class="compteurs">
          <div v-for="axe in AXES" :key="axe.cle" class="compteur">
            <span class="compteur-titre">{{ axe.titre }}</span>
            <div class="compteur-boutons">
              <button
                type="button"
                :aria-label="axe.unMoins"
                :disabled="forme[axe.cle] <= FORME_MINIMUM"
                :data-forme-moins="axe.cle"
                @click="decaler(axe.cle, -1)"
              >
                −
              </button>
              <output :data-forme-valeur="axe.cle">{{ forme[axe.cle] }}</output>
              <button
                type="button"
                :aria-label="axe.unPlus"
                :disabled="forme[axe.cle] >= FORME_MAXIMUM"
                :data-forme-plus="axe.cle"
                @click="decaler(axe.cle, 1)"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <!-- La tablette debout, avec ses cases vides : la mère lit des positions, pas des
             listes, et aucun autre outil ne lui montre ce que le chiffre donnera. Les bandes
             du haut et du bas sont là aux proportions de l'écran de l'enfant : sans elles la
             grille remplissait toute la tablette et donnait des cases hautes et étroites,
             alors que quatre colonnes sur quatre lignes tombent presque carrées. -->
        <div class="tablette" aria-hidden="true">
          <div class="tablette-bande tablette-haut"></div>
          <div
            class="tablette-grille"
            :style="{ '--colonnes': forme.colonnes, '--lignes': forme.lignes }"
            data-forme-apercu
          >
            <span v-for="rang in forme.colonnes * forme.lignes" :key="rang" class="tablette-case" />
          </div>
          <div class="tablette-bande tablette-bas"></div>
        </div>
      </div>

      <p class="aide" data-forme-lecture>{{ lectureEnCm }}</p>
      <p v-if="tropPetite" class="alerte" data-forme-alerte>
        En dessous de 2,5 cm, une case devient difficile à viser pour un doigt d'enfant.
      </p>
      <p v-if="formeChangee" class="aide" data-forme-consequence>{{ consequence }}</p>

      <!-- Le bouton n'apparaît qu'une fois un compteur bougé : gris et désactivé, il refusait
           l'appui sans jamais dire ce qui manquait. Au repos, c'est la phrase qui parle. -->
      <p v-if="!formeChangee" class="aide" data-forme-invite>
        Changez les chiffres pour voir ce que donnerait une autre forme. Rien ne bouge sur la
        tablette avant votre confirmation.
      </p>
      <div v-else class="actions-forme">
        <button type="button" class="changer-forme" data-forme-changer @click="emit('changerForme', forme)">
          Changer la forme de la grille
        </button>
        <button type="button" class="annuler-forme" data-forme-annuler @click="formeEssayee = null">
          Annuler
        </button>
      </div>
    </fieldset>
  </section>
</template>

<style scoped>
/* Section de l'onglet « Réglages », et non plus un panneau par-dessus l'écran : ces
   réglages se changent rarement, ils vivent avec les autres opérations rares. */
.reglages {
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: var(--encre);
  font-family: system-ui, sans-serif;
}

fieldset {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #c7ccd1;
  border-radius: 8px;
}

legend {
  padding: 0 4px;
  font-size: 0.95rem;
  font-weight: 600;
}

.niveaux {
  display: flex;
  gap: 8px;
}

/* Le choix se fait sur des pavés larges, pas sur des puces de quelques pixels : ce panneau
   se règle au doigt, souvent debout, une tablette dans l'autre main. */
.niveau {
  flex: 1;
  display: grid;
  place-items: center;
  min-height: 52px;
  padding: 8px;
  border: 2px solid #c7ccd1;
  border-radius: 8px;
  background: var(--blanc);
  font-size: 0.95rem;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  touch-action: manipulation;
}

.niveau input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.niveau:has(input:checked) {
  border-color: var(--encre);
  background: var(--encre);
  color: var(--blanc);
}

.niveau:has(input:focus-visible) {
  outline: 3px dashed var(--encre);
  outline-offset: 3px;
}

/* La réglette porte son titre à gauche et sa valeur à droite : le pourcentage se lit
   quand on l'a sous le doigt, le mot du raccourci reste ce qui se dit à distance. */
.reglette {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  font-size: 0.9rem;
  font-weight: 600;
}

.reglette input {
  /* la piste par défaut fait quelques pixels de haut : impossible à saisir au doigt */
  height: 44px;
  accent-color: var(--encre);
  touch-action: manipulation;
}

.reglette output {
  min-width: 3.5ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.aide {
  margin: 8px 0 0;
  color: #4b5563;
  font-size: 0.85rem;
}

.interrupteur {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  font-size: 0.95rem;
  font-weight: 600;
}

.interrupteur input {
  width: 24px;
  height: 24px;
}

/* Les deux compteurs restent côte à côte au centre : étalés sur toute la largeur, ils se
   retrouvaient à quarante centimètres l'un de l'autre sur un écran de bureau, et la mère
   lisait deux réglages sans rapport au lieu d'une forme. */
.compteurs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px 28px;
}

.compteur {
  display: grid;
  gap: 6px;
  justify-items: center;
  font-size: 0.95rem;
  font-weight: 600;
}

.compteur-boutons {
  display: grid;
  grid-template-columns: 52px 3ch 52px;
  align-items: center;
  gap: 8px;
}

.compteur-boutons button {
  min-height: 52px;
  border: 2px solid #c7ccd1;
  border-radius: 8px;
  background: var(--blanc);
  color: var(--encre);
  font-size: 1.4rem;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
}

.compteur-boutons button:disabled {
  opacity: 0.4;
  cursor: default;
}

.compteur-boutons output {
  text-align: center;
  font-size: 1.3rem;
  font-variant-numeric: tabular-nums;
}

/* Proportions de l'écran de l'enfant, debout, et ses quatre bandes dans les mêmes parts que
   l'écran réel : phrase et contextes en haut, grille au milieu, mots essentiels en bas. La
   hauteur commande, parce que sur un téléphone en portrait une miniature réglée en largeur
   mangeait la moitié de la page des réglages. */
.tablette {
  display: grid;
  /* les mêmes parts que `grid-template-rows` de l'écran de l'enfant : 12 % + 8 %, 62 %, 18 % */
  grid-template-rows: 20% 62% 18%;
  gap: 2px;
  width: fit-content;
  aspect-ratio: 800 / 1280;
  height: 190px;
  margin: 12px auto 0;
  padding: 4px;
  border: 2px solid #c7ccd1;
  border-radius: 10px;
  background: var(--blanc);
}

.tablette-bande {
  border-radius: 2px;
  background: #eef1f4;
}

.tablette-grille {
  display: grid;
  grid-template-columns: repeat(var(--colonnes), 1fr);
  grid-template-rows: repeat(var(--lignes), 1fr);
  gap: 2px;
  min-height: 0;
}

.tablette-case {
  border-radius: 2px;
  background: #dde3e9;
}

.alerte {
  margin: 8px 0 0;
  color: #9a3412;
  font-size: 0.85rem;
  font-weight: 600;
}

@media (min-width: 561px) {
  .forme-reglage {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 32px;
  }

  .forme-reglage .tablette {
    margin-top: 0;
  }
}

.actions-forme {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.changer-forme {
  flex: 1;
  min-height: 52px;
  border: 2px solid var(--encre);
  border-radius: 8px;
  background: var(--blanc);
  color: var(--encre);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
}

/* Lien et non bouton : il ne fait que remettre les compteurs là où ils étaient. */
.annuler-forme {
  min-height: 48px;
  padding: 10px 4px;
  border: none;
  background: none;
  color: var(--encre);
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
}
</style>
