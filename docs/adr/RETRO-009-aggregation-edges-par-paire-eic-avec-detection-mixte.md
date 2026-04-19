# RETRO-009 — Agrégation des MessagePath en edges par paire (fromEic, toEic) avec détection MIXTE

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | RETRO-009                      |
| Statut     | Documenté (rétro)              |
| Date       | 2026-04-17                     |
| Source     | Rétro-ingénierie               |
| Features   | graph                          |
| App        | api                            |

## Contexte

La table `MessagePath` stocke les chemins de messages bruts tels qu'ils apparaissent
dans le backup ECP : un couple (sender, receiver) peut apparaître de nombreuses fois
pour des `messageType` différents (`RSMD`, `CAPVP`, `CGM`...) ou pour des processus
métier distincts (`VP`, `CORE`...). Afficher un edge Leaflet par `MessagePath` brut
produirait une superposition illisible — potentiellement des dizaines d'arêtes entre
deux mêmes nœuds.

La carte doit afficher au maximum **un seul edge visuel par paire de composants**,
coloré par processus. Deux problèmes se posent alors :
1. Comment consolider les `messageType` multiples ?
2. Que faire si des processus métier différents coexistent sur une même paire ?

## Décision identifiée

`GraphService.buildGraph` agrège les `MessagePath` par clé composite `"fromEic::toEic"`
(string key dans une `Map<string, Group>`). Les `messageTypes`, `transportPatterns`
et `processes` sont accumulés dans des `Set<>`. À la sortie de l'agrégation :

- Si le `Set<ProcessKey>` du groupe contient **≥ 2 valeurs distinctes** →
  `process = 'MIXTE'`.
- Si le `Set` contient **1 seule valeur** → ce process est assigné à l'edge.

Les paths dont `fromEic` ou `toEic` vaut `'*'` (wildcard ECP) sont silencieusement
ignorés avant agrégation — ils ne correspondent à aucun composant identifiable.

## Conséquences observées

### Positives
- Un seul edge Leaflet par paire de composants, quel que soit le nombre de
  `MessagePath` bruts en base. La carte reste lisible même pour des snapshots
  complexes.
- La couleur MIXTE (gris neutre `#4b5563`) signale visuellement au métier qu'une
  paire transporte plusieurs processus, sans masquer cette information.
- Les `messageTypes` et `transportPatterns` agrégés restent accessibles dans le
  DetailPanel via leurs tableaux respectifs.
- Skip des wildcards cohérent avec la sémantique ECP : `*` désigne une règle
  d'acceptation globale, pas un partenaire.

### Négatives / Dette
- **Perte de la granularité process par edge** : un edge MIXTE ne permet pas de
  distinguer visuellement les processus individuels. Le frontend doit ouvrir le
  DetailPanel pour voir les `messageTypes` et déduire les processus.
- **Direction potentiellement ambiguë** : la direction (IN/OUT) du groupe est
  celle du premier `MessagePath` rencontré. Si une paire pouvait théoriquement
  avoir des paths IN et OUT simultanément, la direction serait arbitraire.
  En pratique, la direction est cohérente au sein d'une paire car elle est calculée
  relativement au composant source du backup.
- **Pas de déduplication inter-sources** : un même chemin logique présent à la fois
  dans `XML_CD_PATHS` et `LOCAL_CSV_PATHS` générerait deux paths distincts en base.
  L'agrégation par paire absorbe cette duplication visuellement, mais les compteurs
  `messageTypes` pourraient être gonflés.

## Recommandation

Garder. L'agrégation 1-edge-par-paire est un choix de visualisation fondamental
et validé fonctionnellement. La détection MIXTE est la seule représentation honnête
d'une paire multi-processus sans inventer une hiérarchie de priorité arbitraire.
