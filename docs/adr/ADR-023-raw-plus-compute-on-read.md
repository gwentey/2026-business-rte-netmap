# ADR-023 — Raw tables + compute on read vs matérialisation

| Champ      | Valeur                                                                      |
|------------|-----------------------------------------------------------------------------|
| Numéro     | ADR-023                                                                     |
| Statut     | Accepté                                                                     |
| Date       | 2026-04-19                                                                  |
| Auteur(s)  | Anthony + Claude                                                            |
| Owner      | Anthony                                                                     |
| Décideurs  | Anthony                                                                     |
| Contexte   | Slice v2.0-2a Fondations                                                    |
| Remplace   | —                                                                           |
| Features   | *                                                                           |
| App        | api, web                                                                    |

## Contexte

En v1.2, le pipeline d'ingestion effectuait un collapse complet à l'écriture : chaque `Snapshot` était une vue agrégée et résolue du réseau, incluant la résolution du registry et les coordonnées géographiques par défaut (Bruxelles). Cette approche s'est révélée incompatible avec la vision v2.0 : un réseau reconstructible à partir de plusieurs dumps cumulatifs.

La v2.0 introduit une séparation nette entre la **donnée brute importée** (`ImportedComponent`, `ImportedPath`) et la **vue calculée** (`GlobalComponent`, `GlobalEdge`). La question est de savoir si les vues calculées doivent être matérialisées en base ou calculées à chaque requête.

L'ordre de grandeur est estimé à ~10 imports × ~500 composants par env, soit ~5 000 lignes `ImportedComponent` et ~20 000 lignes `ImportedPath` par env — volumes SQLite triviaux. Toute modification du registry ou des overrides doit se refléter immédiatement sur la carte sans déclencher de recalcul ou d'invalidation de cache.

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — Raw + compute on read | Stocker uniquement les données brutes des imports ; calculer `GlobalComponent`/`GlobalEdge` à chaque requête `GET /api/graph` | S | Zéro cache à invalider, rétroactivité immédiate sur changement registry/overrides, suppression d'un import sans recalcul, timeline triviale via `refDate` | Recalcul à chaque requête (acceptable aux volumes estimés) |
| B — Raw + matérialisation | Stocker les données brutes ET pré-calculer des tables `GlobalComponent`/`GlobalEdge` matérialisées | L | Requêtes carte très rapides | Invalidation cache complexe sur changement registry/overrides, double écriture, complexité accrue, pas justifiable aux volumes estimés |
| C — Upsert collapse (v1.2) | Collapse à l'ingestion dans une table unique, pas de données brutes préservées | M | Simple à requêter | Timeline impossible, suppression d'un import impossible, registry non-rétroactif, incompatible avec la vision v2.0 |

## Décision retenue

**Option choisie : A** — Stocker uniquement les données brutes et calculer les vues à la lecture. Les volumes impliqués (~10 imports × ~500 composants) sont négligeables pour SQLite. L'absence de cache à invalider est un avantage structurel qui justifie le choix pour toute la durée des slices 2a–2e, avec une réévaluation si un bench montre des latences > 500 ms sur ≥ 5 imports.

## Conséquences

### Positives
- Tout changement du registry RTE ou d'un `ComponentOverride` est immédiatement reflété sur la carte sans action supplémentaire.
- La suppression d'un import (`DELETE /api/imports/:id`) est triviale : cascade SQL suffit, aucune table dérivée à nettoyer.
- La fonctionnalité de timeline historique (slice 2d) est déjà prête côté backend dès 2a : il suffit de passer un `refDate` dans la requête.
- Le code d'ingestion est allégé : `ImportBuilder` produit des données brutes, sans résolution registry.

### Négatives
- `GraphService.getGraph` est potentiellement plus lent que v1.2 sur des envs avec de nombreux imports. Un bench est prévu en fin de 2a.
- Si les volumes croissent significativement (> 50 imports × 5 000 composants), une couche de cache LRU ou une matérialisation partielle sera nécessaire.

### Ce qu'on s'interdit désormais
- Écrire des tables `GlobalComponent` ou `GlobalEdge` en base de données — ces vues sont calculées, jamais persistées.
- Résoudre la cascade de priorité (registry, overrides, ENTSO-E) pendant le pipeline d'ingestion.
- Écrire des coordonnées géographiques de fallback (ex. : Bruxelles) dans `ImportedComponent` — le fallback appartient à la couche compute-on-read (niveau 5 de la cascade).

## Ressources / Références

- Chapeau v2.0 §3 — Modèle conceptuel, invariant clé `GlobalComponent` et `GlobalEdge` jamais persistés.
- Chapeau v2.0 §4 — Cascade de priorité 5 niveaux (calculée à la lecture).
- Slice 2a §A — Schéma Prisma `ImportedComponent.lat/lng` nullable.
- Slice 2a §C — `GraphService` compute-on-read, sous-fonctions `mergeComponentsLatestWins`, `applyCascade`.
- Slice 2a §I — Risque performance, seuil 500 ms, stratégie cache LRU si nécessaire.
