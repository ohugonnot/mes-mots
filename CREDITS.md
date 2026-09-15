# Crédits

## Pictogrammes

Les images de `public/images/pictos/` viennent du **jeu de symboles Mulberry**.

- Auteur : Steve Lee, copyright 2018-2026
- Source : https://mulberrysymbols.org, dépôt https://github.com/mulberrysymbols/mulberry-symbols
- Licence : **Creative Commons Attribution-Share Alike 4.0** (CC BY-SA 4.0),
  https://creativecommons.org/licenses/by-sa/4.0/

Modification apportée : les fichiers ont été renommés d'après le mot français de la case
qu'ils illustrent. Leur contenu est intact.

Le partage à l'identique de la licence porte sur ces images, pas sur le code de
l'application. Elles restent sous CC BY-SA même si le code est distribué sous une autre
licence libre, ce qui est l'usage courant des applications de CAA libres.

## Deux symboles dessinés pour l'application

`pictos/oui.svg` et `pictos/non.svg` ne viennent pas de Mulberry : ce sont une coche verte
et une croix rouge dessinées ici, comme l'annonce l'annexe A du cahier des charges. Elles
suivent la même licence que le code de l'application, et non CC BY-SA.

Correspondance entre les cases et les symboles d'origine :

| Case | Symbole Mulberry |
|---|---|
| BOIRE | `drink` |
| MANGER | `eat_,_to` |
| DOUDOU | `blanket` |
| DOUCHE | `shower` |
| CHAMBRE | `bed_time` |
| VOITURE | `car` |
| TABLETTE | `touch_screen` |
| PROMENADE | `walk_,_to` |
| AIDE-MOI | `help_,_to` |
| ENCORE | `more` |
| FINI | `finish` |
| PIPI | `toilet` |
| MAGASIN | `shop` |
| MAMAN | `lady_-_face` |
| PAPA | `man_-_face` |
| FRÈRE | `brother` |

Mulberry ne propose aucun symbole pour OUI ni pour NON, ni rien de convaincant pour MOI :
ces trois cases affichent leur mot en attendant une photo. LOKI et VENUM désignent des
êtres précis, un pictogramme générique n'aurait rien dit de juste.

**ARASAAC n'est pas utilisé ici**, malgré ses 25 000 pictogrammes en français, parce que
sa licence CC BY-NC-SA interdit l'usage commercial : elle contredirait la promesse d'une
application libre et redistribuable. ARASAAC reste parfaitement utilisable pour la planche
privée d'un enfant, qui n'est pas un usage commercial.

## Voix

Les 21 fichiers de `public/sons/` sont ceux de `voix/rendu/suno/` du dépôt de travail
privé, empreintes md5 identiques. Ils viennent donc de **Suno**, et non de la voix Azure
`fr-FR-EloiseNeural` que la recherche avait retenue.

**Point à trancher avant toute publication.** Sur le palier gratuit de Suno, la société
reste propriétaire des sons produits et n'en autorise que l'usage non commercial ; sur les
paliers Pro et Premier, elle cède ses droits à l'utilisateur. Le palier utilisé ici n'est
pas établi. Pour l'usage privé de l'enfant la question ne se pose pas. Pour un dépôt
public sous licence copyleft, elle se pose entièrement : distribuer des fichiers dont un
tiers reste propriétaire contredirait la licence annoncée.

Le chemin propre existe déjà et ne coûte que du temps machine : regénérer les 21 phrases
avec Piper `fr_FR-siwis-medium` et `voix/enfantiser.sh`, entièrement local et libre. Le
rendu Suno peut rester sur la tablette de l'enfant si la famille le préfère, c'est un
usage privé.

## Police

Fredoka, copyright Milena Brandao, sous **SIL Open Font License 1.1**.
Vérifié dans `google/fonts`, dossier `ofl/fredoka`.

## Pictogrammes de la douleur

Les vingt-sept images de la planche « J'ai mal » viennent d'**ARASAAC**, portail aragonais de la
communication augmentative et alternative.

- Auteur : Sergio Palao, pour ARASAAC, propriété du Gouvernement d'Aragon
- Source : https://arasaac.org
- Licence : **Creative Commons Attribution-NonCommercial-ShareAlike 4.0**
  (CC BY-NC-SA 4.0), https://creativecommons.org/licenses/by-nc-sa/4.0/

**La clause non commerciale s'applique à ces seize images.** L'application est à usage non
commercial, donc elle n'y change rien ; c'est inscrit ici pour que le prochain lecteur le
sache sans avoir à le redécouvrir, notamment le jour où le code deviendra public.

Le choix d'ARASAAC pour la douleur, plutôt que Mulberry, tient à une étude menée auprès
d'enfants de 6 à 9 ans sur vingt-six mots de la douleur : ils préfèrent nettement les
symboles ARASAAC, pour leur couleur, leur réalisme, et les marques ajoutées au dessin,
éclairs et croix, qui disent où et combien
(https://pmc.ncbi.nlm.nih.gov/articles/PMC11645971/).

| Fichier | Identifiant ARASAAC | Mot-clé d'origine |
|---|---|---|
| `mal-tete.png` | 28651 | mal de tête |
| `mal-ventre.png` | 28765 | mal de ventre |
| `mal-gorge.png` | 28761 | mal de gorge |
| `mal-dents.png` | 28757 | mal de dent |
| `mal-oreille.png` | 28777 | mal à l'oreille |
| `mal-dos.png` | 28785 | mal de dos |
| `mal-poitrine.png` | 28781 | douleur de poitrine |
| `main.png` | 2928 | main |
| `bras.png` | 2669 | bras |
| `jambe.png` | 8666 | jambe |
| `pied.png` | 25327 | pied |
| `oeil.png` | 6573 | oeil |
| `aide-moi.png` | 32648 | aider |
| `calin.png` | 6023 | serrer dans les bras |
| `docteur.png` | 6561 | médecin |
| `medicament.png` | 30116 | médicament |
| `bouche.png` | 2663 | bouche |
| `doigt.png` | 3298 | doigt |
| `cogne.png` | 5427 | bosse sur la tête |
| `yeux.png` | 2876 | yeux |
| `corps/face.png` | 17022 | corps de face |
| `corps/dos.png` | 17018 | corps de dos |
| `cou.png` | 2727 | cou |
| `mal-fesses.png` | 28789 | mal aux fesses |
| `zizi.png` | 3362 | pénis |
| `maison-contexte.png` | 6964 | maison |
| `exterieur-contexte.png` | 2859 | parc |
