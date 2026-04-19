# RETRO-004 — Classification messageType résolue à l'ingestion pour reproductibilité historique

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | RETRO-004                      |
| Statut     | Documenté (rétro)              |
| Date       | 2026-04-17                     |
| Source     | Rétro-ingénierie               |
| Features   | ingestion                      |
| App        | api                            |

## Contexte

La carte affiche les edges colorés par processus métier (VP, CORE, OPDE, etc.). Ce processus est dérivé du `messageType` de chaque chemin de message. Si la classification était recalculée à l'affichage à partir du registry courant, une mise à jour du registry changerait rétroactivement la couleur des edges sur des snapshots historiques, rendant l'historique incohérent et non reproductible.

## Décision identifiée

La classification `messageType → ProcessKey` est effectuée une seule fois dans `NetworkModelBuilderService.build()` via `RegistryService.classifyMessageType()`, et le résultat (`ProcessKey`) est stocké dans chaque `MessagePath` en base. La colonne `process` de la table `MessagePath` contient la valeur résolue au moment de l'ingestion. Le service de graphe (`GraphService`) lit directement cette colonne — il n'appelle jamais le registry.

La même logique s'applique aux `Component` : le champ `process` de la table `Component` est résolu à l'ingestion via l'overlay RTE et stocké en base.

## Conséquences observées

### Positives
- Un snapshot historique affiché après une mise à jour du registry montre exactement le même processus qu'au moment de l'ingestion. La reproductibilité historique est garantie par le modèle de données.
- Les performances de lecture du graphe sont meilleures — pas de jointure avec le registry à chaque requête GET.

### Négatives / Dette
- Si le registry est mis à jour (nouveau processus, renommage), les anciens snapshots conservent l'ancienne classification. Une action explicite "re-classifier les snapshots existants" est nécessaire — elle est hors scope slice #1 et explicitement identifiée comme feature future dans CLAUDE.md.
- Le processus `UNKNOWN` stocké en base pour les messageTypes non reconnus ne sera pas automatiquement corrigé si le registry est enrichi après coup.

## Recommandation

Garder. La reproductibilité historique est une exigence fonctionnelle explicite. Prévoir et documenter l'action de re-classification pour les slices futurs.
