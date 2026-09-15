- **Deux runs Playwright en parallèle se détruisent** : ils partagent `test-results/`.
- **Le serveur d'aperçu sert `dist/`, pas les sources** : reconstruire avant de mesurer,
  sinon on juge l'ancien code. Tuer par le port :
  `ss -lptn 'sport = :4173' | grep -oP 'pid=\K[0-9]+' | xargs -r kill`
- **`npm install` se bloque ici** : `npm install --ignore-scripts`.
- **Un proxy réactif Vue n'entre pas dans IndexedDB** : `toRaw()` avant toute écriture,
  l'échec part sinon en rejet silencieux.
- **Recharger la page juste après un clic teste une course**, pas un comportement :
  attendre la persistance (`expect.poll` sur le magasin) avant `page.reload()`.
- **`setPointerCapture` jette sur un pointeur synthétique** (tests) et interrompt le
  gestionnaire : l'entourer d'un `try`.
- **Ne jamais éditer `mutation.sh` pendant qu'il tourne** : bash relit le script au fil de
  l'exécution, une insertion décale tout ce qui suit le point de lecture.
- **`muter` ne remplace que la première occurrence** : un motif qui apparaît deux fois mute
  l'autre endroit en silence. L'ancrer sur une ligne voisine unique.
- **Chercher un `.sauve` oublié avant tout `git add`** : `mutation.sh` restaure par copie,
  et un arrêt en plein vol laisse le fichier de secours sur place.
- **Dans un `<script setup>`, un `watch` évalue sa source tout de suite** : il doit être
  écrit après les refs qu'il lit, sinon l'initialisation jette.
- **Un élément flex passe devant avec le seul `z-index`** : son `z-index` crée un contexte
  d'empilement même en `position: static`. Ajouter `position: relative` ne sert à rien, et le
  motif de mutation qui viserait cette position ne rougirait jamais.
