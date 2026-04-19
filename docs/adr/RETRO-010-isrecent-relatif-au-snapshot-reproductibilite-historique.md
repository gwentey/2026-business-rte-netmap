# RETRO-010 — isRecent calculé relativement à uploadedAt du snapshot pour reproductibilité historique

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | RETRO-010                      |
| Statut     | Documenté (rétro)              |
| Date       | 2026-04-17                     |
| Source     | Rétro-ingénierie               |
| Features   | graph                          |
| App        | api                            |

## Contexte

Chaque edge du graphe expose un flag `isRecent` indiquant si le dernier message
échangé sur cette connexion est récent. Ce flag informe l'utilisateur sur l'activité
réelle du lien ECP.

Une implémentation naïve comparerait `lastMessageUp` à `Date.now()` : "le dernier
message date de moins de 24h par rapport à maintenant". Mais cette approche rend
le flag dynamique : le même snapshot affiché aujourd'hui et dans 6 mois donnerait
des valeurs `isRecent` différentes pour les mêmes données. Un snapshot historique
deviendrait systématiquement "tout inactif", perdant toute valeur analytique.

La même problématique existe pour la classification `process` (voir RETRO-004),
mais `isRecent` concerne les statistiques de messaging qui sont propres à chaque
snapshot et ne dépendent pas du registry.

## Décision identifiée

Le calcul dans `GraphService.buildGraph` est :

```ts
const snapshotTime = snapshot.uploadedAt.getTime();
const isRecent =
  stat?.lastMessageUp != null &&
  snapshotTime - stat.lastMessageUp.getTime() < 24 * 60 * 60 * 1000 &&
  snapshotTime - stat.lastMessageUp.getTime() >= 0;
```

La référence temporelle est `snapshot.uploadedAt`, non `Date.now()`. La contrainte
`>= 0` exclut les cas où `lastMessageUp` serait postérieur à l'upload (données
incohérentes). Le seuil de 24 heures est codé en dur (pas de configuration).

## Conséquences observées

### Positives
- **Reproductibilité historique totale** : un snapshot affiché 6 mois après son
  ingestion donne exactement les mêmes indicateurs d'activité qu'au moment de l'upload.
  Cohérent avec le principe général de l'application (les snapshots sont des
  "photographies" immuables du réseau).
- **Cohérence avec le contexte métier** : `isRecent` répond à la question "au moment
  où ce backup a été produit, cette connexion était-elle active récemment ?", ce
  qui est la question métier pertinente.
- **Guard contre les données incohérentes** : la condition `>= 0` protège contre
  les `lastMessageUp` futurs.

### Négatives / Dette
- **Seuil 24h non configurable** : la valeur est hardcodée. Si le métier souhaite
  ajuster ce seuil (ex. 48h pour certains processus peu fréquents), cela nécessite
  une modification du code. Un paramètre de configuration ou une valeur dans l'overlay
  registry serait plus flexible.
- **Pas de distinction par process** : toutes les connexions utilisent le même seuil
  de 24h, qu'elles échangent des messages à haute fréquence (VP) ou basse fréquence
  (TP, UK-CC-IN).

## Recommandation

Garder le principe (relatif à `uploadedAt`). Documenter le seuil de 24h comme
paramètre candidat à la configuration dans un slice ultérieur si le métier identifie
des processus avec des fréquences d'échange très différentes.
