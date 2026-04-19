# ADR-024 — Cascade de priorité 5 niveaux par champ

| Champ      | Valeur                                                                      |
|------------|-----------------------------------------------------------------------------|
| Numéro     | ADR-024                                                                     |
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

En v2.0, plusieurs sources de données peuvent fournir des informations pour le même EIC : un `ComponentOverride` posé par un admin, l'annuaire ENTSO-E embarqué, le registry RTE overlay, les données brutes importées depuis les dumps, et un fallback par défaut. Ces sources ont des niveaux d'autorité différents : une correction manuelle d'un admin doit toujours primer, tandis que les données brutes d'un import sont de moindre priorité que l'annuaire officiel.

La question est de savoir si la priorité s'applique **par enregistrement complet** (une source l'emporte pour tous les champs) ou **champ par champ** (chaque champ est résolu indépendamment depuis la source disponible la plus haute dans la hiérarchie). Le cas typique est un EIC présent dans ENTSO-E (qui fournit `displayName` et `country`) mais absent du registry, et dont un import fournit des coordonnées géographiques : avec une priorité par record, il faudrait choisir entre ENTSO-E et l'import ; champ par champ, les deux contributions se complètent.

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — 5 niveaux par champ | Pour chaque champ d'un composant, appliquer l'ordre : override > ENTSO-E > registry > import latest-wins > default | S | Merge complémentaire entre sources, aucune information non-null perdue, extensible | Implémentation plus complexe que par record |
| B — 5 niveaux par record | La source la plus haute dans la hiérarchie qui a une entrée complète pour l'EIC l'emporte pour tous les champs | XS | Simple à implémenter | Bloque le merge complémentaire : une source de rang 2 peut masquer des champs utiles de rang 3-4 ; incompatible avec le cas typique ENTSO-E + import géocode |
| C — 2 niveaux (override + import) | Uniquement override admin + données import, pas d'ENTSO-E ni registry | XS | Trivial | Ignore les sources de référence officielles, régression vs v1.2 |

## Décision retenue

**Option choisie : A** — Cascade de priorité 5 niveaux, appliquée champ par champ. L'ordre de résolution est : `ComponentOverride` (niveau 1, absolu) > `EntsoeEntry` (niveau 2) > `Registry RTE overlay` (niveau 3) > `ImportedComponent` avec `effectiveDate` max parmi les imports éligibles (niveau 4) > Default centre Europe + `isDefaultPosition=true` (niveau 5).

## Conséquences

### Positives
- Les sources se **complètent** plutôt que de se masquer : un EIC peut avoir son `displayName` depuis ENTSO-E, ses coordonnées depuis un import, et ses `notes` depuis un override admin.
- Un changement de registry ou d'override est rétroactif sur tous les imports sans ré-ingestion.
- Le flag `isDefaultPosition` est déclenché uniquement si le niveau 5 est atteint pour `lat/lng`, permettant un badge UI précis en 2f.

### Négatives
- L'implémentation de `applyCascade` dans `GraphService` est plus complexe qu'un simple lookup par record.
- Le comportement peut surprendre un utilisateur qui s'attendrait à ce qu'un override partiel (avec certains champs null) réinitialise les autres champs — ce n'est pas le cas : les champs null d'un override ne masquent pas les niveaux inférieurs.

### Ce qu'on s'interdit désormais
- Écraser un champ non-null avec un champ null issu d'une source de priorité plus haute — un champ null signifie « pas d'information à ce niveau », pas « effacer ».
- Appliquer une priorité par enregistrement complet (winner-takes-all) sur les EICs dans `GraphService`.

## Ressources / Références

- Chapeau v2.0 §4 — Cascade de priorité 5 niveaux, exemple EIC `10XAT-APG------Z`.
- Slice 2a §C — `applyCascade(componentsByEic, overrides, entsoe, registry)` dans `GraphService`.
- Slice 2a §C — `mergeComponentsLatestWins` : merge champ-par-champ au sein des imports (niveau 4 interne).
