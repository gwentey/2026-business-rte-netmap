# RETRO-005 — Direction IN/OUT basée sur le set EIC RTE autoritatif (overlay), pas sur le préfixe 17V

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | RETRO-005                      |
| Statut     | Documenté (rétro)              |
| Date       | 2026-04-17                     |
| Source     | Rétro-ingénierie               |
| Features   | ingestion                      |
| App        | api                            |

## Contexte

La direction d'un chemin de message (`IN` : le composant RTE reçoit, `OUT` : le composant RTE envoie) est une donnée métier clé pour la visualisation. Une heuristique évidente serait de tester si l'EIC du receiver commence par `17V` (préfixe EIC français/RTE). Mais cette heuristique est fragile : d'autres opérateurs peuvent avoir des EIC en `17V`, et les EIC RTE ne sont pas tous préfixés de façon uniforme.

## Décision identifiée

Le set des EIC RTE autoritatif est construit en mémoire à chaque appel de `build()` depuis l'overlay : `overlay.rteEndpoints[*].eic` ∪ `{overlay.rteComponentDirectory.eic}`. Ce `rteEicSet` est utilisé pour tester l'appartenance du `receiverEic` (pour les chemins XML) et du `r.receiver` (pour les chemins CSV locaux). La direction est `IN` si l'EIC est dans ce set, `OUT` sinon.

Cette logique s'applique de façon identique aux deux sources de chemins (`XML_CD_PATHS` et `LOCAL_CSV_PATHS`).

## Conséquences observées

### Positives
- La liste des EIC RTE est explicite, auditée et versionnable dans `packages/registry/eic-rte-overlay.json`. Toute modification est visible dans git.
- Indépendant du format ou du préfixe des EIC — applicable à tout opérateur.
- Cohérence : le même fichier overlay est source de vérité pour les coordonnées, les processus associés aux endpoints RTE, et la liste des EIC autoritatifs.

### Négatives / Dette
- Le `rteEicSet` est reconstruit à chaque appel de `build()` (boucle sur `overlay.rteEndpoints`). Pour un volume actuel (6 endpoints + 1 CD), la performance est négligeable. Si l'overlay grossit significativement, pré-calculer le set à l'initialisation de `RegistryService` serait plus efficace.
- L'ajout d'un nouvel EIC RTE nécessite une mise à jour de l'overlay JSON et un redémarrage du backend (rechargement à chaud hors scope slice #1).

## Recommandation

Garder. La clarté et l'auditabilité de l'overlay sont plus importantes que la performance à ce volume. Le calcul du set pourrait être optimisé en le pré-calculant dans `RegistryService.onModuleInit()` si le volume augmente.
