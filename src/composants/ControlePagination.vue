<script setup lang="ts">
/**
 * Flèche précédente, pastilles, flèche suivante. Partagé par l'écran de l'enfant et
 * l'espace parents (Lot 3) : c'est l'appelant qui décide, par son propre `v-if`, quand
 * l'afficher, pour garder ce composant muet sur le reste de la mise en page.
 */
defineProps<{ pages: { id: string }[]; indexPage: number }>()
const emit = defineEmits<{ precedente: []; suivante: [] }>()
</script>

<template>
  <!-- aux extrémités la flèche qui ne mène nulle part n'est pas affichée : l'enfant doit
       sentir le bord, et une cible inerte enseigne l'échec -->
  <button
    type="button"
    class="fleche"
    :class="{ inutile: indexPage === 0 }"
    :disabled="indexPage === 0"
    data-page-precedente
    aria-label="Page précédente"
    @click="emit('precedente')"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 4 L7 12 L15 20 Z" />
    </svg>
  </button>
  <!-- des pastilles et aucun chiffre : l'enfant ne lit pas. Elles informent et ne sont pas
       cliquables, une cible de cette taille serait peu fiable -->
  <span class="pastilles" data-pastilles aria-hidden="true">
    <span
      v-for="(candidate, index) in pages"
      :key="candidate.id"
      class="pastille"
      :class="{ courante: index === indexPage }"
      :data-pastille="index"
      :data-courante="index === indexPage"
    ></span>
  </span>
  <button
    type="button"
    class="fleche"
    :class="{ inutile: indexPage === pages.length - 1 }"
    :disabled="indexPage === pages.length - 1"
    data-page-suivante
    aria-label="Page suivante"
    @click="emit('suivante')"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4 L17 12 L9 20 Z" />
    </svg>
  </button>
</template>

<style scoped>
.fleche {
  display: grid;
  place-items: center;
  /* 64 px et non le minimum de 48 : c'est une cible d'enfant, pas un pouce d'adulte.
     Bornés par la hauteur de la rangée, sinon la flèche dépassait la barre sur un écran
     court. Et plafonnés : à 78 % d'une rangée de tablette elle montait à 90 x 80, le quart
     d'une case, une commande de navigation qui pesait autant qu'un mot. */
  min-width: min(64px, 40%);
  min-height: min(56px, 100%);
  height: min(78%, 64px);
  aspect-ratio: 64 / 56;
  padding: 0;
  border: var(--case-anneau) solid var(--encre);
  border-radius: var(--case-rayon);
  background: var(--blanc);
  cursor: pointer;
  touch-action: manipulation;
}

/* Elle garde sa place au lieu de disparaître de la mise en page : sinon les pastilles et
   l'autre flèche se décalaient d'une page à l'autre, et rien ne doit bouger sur cet écran.
   `visibility` la sort aussi du parcours au clavier. */
.fleche.inutile {
  visibility: hidden;
}

.fleche svg {
  width: 55%;
  height: 55%;
  fill: var(--encre);
}

.pastilles {
  display: flex;
  align-items: center;
  gap: 9px;
  /* écarté de la flèche : collés, la pastille pleine se lisait comme une bavure du bouton */
  margin-right: 6px;
  min-width: 0;
  /* trois pastilles au plus : au-delà, la largeur du contrôle suivrait le nombre de pages
     et pousserait les boutons de contexte, que l'enfant repère à leur place */
  max-width: 72px;
  overflow: hidden;
}

.pastille {
  width: 18px;
  height: 18px;
  border: 3px solid var(--encre);
  border-radius: 50%;
}

/* Pleine, et sans ombre : l'ombre dure des cartes ne survit pas à cette taille, elle
   donnait une bavure au lieu d'un autocollant. Un chiffre est exclu, l'enfant ne lit pas. */
.pastille.courante {
  background: var(--encre);
}

/* Sur un téléphone, la place réservée ne tient plus que les deux flèches. Elles priment :
   sans elles l'enfant ne change plus de page, alors que les pastilles ne font qu'informer. */
@container (max-width: 180px) {
  .pastilles {
    display: none;
  }
}
</style>
