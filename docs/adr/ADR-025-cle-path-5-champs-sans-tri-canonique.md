# ADR-025 — Clé d'identité d'un path : 5 champs sans tri canonique

| Champ      | Valeur                                                                      |
|------------|-----------------------------------------------------------------------------|
| Numéro     | ADR-025                                                                     |
| Statut     | Accepté                                                                     |
| Date       | 2026-04-19                                                                  |
| Auteur(s)  | Anthony + Claude                                                            |
| Owner      | Anthony                                                                     |
| Décideurs  | Anthony                                                                     |
| Contexte   | Refonte v2.0 — slice 2a fondations                                          |
| Remplace   | —                                                                           |
| Features   | *                                                                           |
| App        | api                                                                         |

## Contexte

Un `ImportedPath` représente une relation de communication déclarée entre deux composants ECP. La même relation physique peut apparaître dans plusieurs dumps : un dump ENDPOINT décrit la relation du point de vue du receiver, un dump COMPONENT_DIRECTORY peut la décrire du point de vue du sender. Pour éviter que la carte affiche deux edges visuels pour une même liaison, il faut dédupliquer les paths entre imports.

La question est de définir la **clé d'identité** d'un path (les champs qui, ensemble, identifient une relation unique) et de décider si cette clé inclut un tri canonique du pair `(receiver, sender)` (ex. : toujours l'EIC alphanumérique le plus petit en position receiver) pour garantir que `A → B` et `B → A` partagent la même clé.

En 2a, seuls des dumps ENDPOINT sont disponibles en fixtures ; le format exact des dumps CD et Broker n'est pas encore connu.

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — 5 champs sans tri canonique | Clé = `(receiverEic, senderEic, messageType, transportPattern, intermediateBrokerEic)`, sans normalisation de l'ordre receiver/sender | XS | Évite les bugs de normalisation tant que le format des dumps CD/Broker est inconnu ; duplication croisée collapsée au rendu par agrégation `(fromEic, toEic)` | Deux imports décrivant `A → B` et `B → A` créent deux entrées distinctes |
| B — 5 champs avec tri canonique | Même clé mais `min(receiver, sender)` toujours en première position | S | Déduplication cross-dumps garantie sans doublon visuel | Requiert une hypothèse sur la symétrie sémantique de `receiver` et `sender` — non vérifiable sans sample de dump CD/Broker ; risque de merger des paths qui sont sémantiquement distincts |
| C — Clé à 2 champs | Clé = `(fromEic, toEic)` uniquement, sans `messageType` | XS | Très simple | Sur-déduplication : deux chemins distincts (processus différents) collapsés en un seul ; perte d'information |

## Décision retenue

**Option choisie : A** — Clé à 5 champs `(receiverEic, senderEic, messageType, transportPattern, intermediateBrokerEic)` sans tri canonique. La déduplication croisée éventuelle (path `A → B` vs `B → A`) est gérée au rendu par l'agrégation des edges par paire `(fromEic, toEic)`, ce qui collapsera les deux entrées sur le même edge visuel. Ce choix pragmatique sera reconsidéré en slice 2b quand des samples de dumps CD/Broker seront disponibles.

## Conséquences

### Positives
- Aucune hypothèse fragile sur la sémantique des dumps CD/Broker dont le format exact est inconnu.
- La déduplication est assurée pour les imports du même type (ENDPOINT vs ENDPOINT) : deux uploads du même dump ENDPOINT ne créent pas de doublon visuel.
- L'agrégation par `(fromEic, toEic)` dans `buildEdges` absorbe naturellement la duplication croisée.

### Négatives
- Si un dump ENDPOINT décrit `A → B` et un dump CD décrit `B → A` pour la même relation physique, deux entrées `ImportedPath` distinctes existent en base. Elles seront collapsées visuellement mais les métadonnées (validFrom, isExpired) peuvent diverger légèrement.
- Un éventuel ajout du tri canonique en 2b constituera un changement de clé qui nécessitera une migration ou un reset.

### Ce qu'on s'interdit désormais
- Classifier `process` à l'ingestion et le stocker dans `ImportedPath` — la classification `messageType → process` est appliquée par `GraphService` à la lecture via `registry.classifyMessageType`, garantissant la rétroactivité sur changement du registry de classification.
- Utiliser une contrainte `@@unique` SQL sur la clé 5-champs dans `ImportedPath` — la déduplication est faite en compute-on-read, pas en contrainte base (plusieurs imports du même env peuvent légitimement partager la même clé).

## Ressources / Références

- Chapeau v2.0 §5 — Règles d'agrégation des paths, clé d'identité, pas de tri canonique.
- Chapeau v2.0 §9 — Point ouvert « Canonical pair sorting pour dédup paths », décision reportée en 2b+.
- Slice 2a §A — Schéma `ImportedPath` : pas de `@@unique` sur la clé 5-champs.
- Slice 2a §C — `mergePathsLatestWins` et `buildEdges` dans `GraphService`.
