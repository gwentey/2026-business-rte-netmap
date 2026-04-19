# ADR-028 — Suppression des endpoints `/api/snapshots*` sans compat

| Champ      | Valeur                                                                      |
|------------|-----------------------------------------------------------------------------|
| Numéro     | ADR-028                                                                     |
| Statut     | Accepté                                                                     |
| Date       | 2026-04-19                                                                  |
| Auteur(s)  | Anthony + Claude                                                            |
| Owner      | Anthony                                                                     |
| Décideurs  | Anthony                                                                     |
| Contexte   | Refonte v2.0 — slice 2a fondations                                          |
| Remplace   | —                                                                           |
| Features   | *                                                                           |
| App        | api, web                                                                    |

## Contexte

L'API v1.2 expose les endpoints suivants : `POST /api/snapshots`, `GET /api/snapshots`, `GET /api/snapshots/:id`, `GET /api/graph/:snapshotId`. Ces routes sont totalement remplacées en v2.0 par : `POST /api/imports`, `GET /api/imports`, `DELETE /api/imports/:id`, `GET /api/graph?env&refDate`, `GET /api/envs`. Les deux modèles sont incompatibles (le concept de `Snapshot` est remplacé par `Import`, le graph n'est plus scopé par un ID de snapshot mais par un `env` + `refDate`).

L'application est en **dev-local uniquement** : aucun consommateur tiers de l'API, pas d'intégration CI externe qui appellerait les anciennes routes, et la base de données sera réinitialisée complètement (`prisma migrate reset`) lors de la migration vers v2.0. Le contexte est donc idéal pour une rupture nette sans couche de compatibilité.

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — Suppression immédiate | Retirer tous les controllers/routes v1.2 dès la slice 2a, sans redirect ni alias | XS | Code mort éliminé, aucune ambiguïté, aucun double-test à maintenir | Appels directs v1.2 (scripts manuels, Postman) cessent de fonctionner — acceptable car dev-local |
| B — Période de compat avec double écriture | Garder les anciens endpoints actifs qui délèguent aux nouveaux services v2.0 | L | Migration progressive | Coût élevé, maintenance d'une couche morte, confusion dans le code, gaspillage sans utilisateur réel |
| C — Alias redirects HTTP 301 | Les anciennes routes répondent 301 vers les nouvelles | S | Transparent pour les clients qui suivent les redirects | Le mapping `GET /api/graph/:snapshotId → GET /api/graph?env=?` est non-trivial (l'ID snapshot ne correspond pas à un env), techniquement impossible proprement |

## Décision retenue

**Option choisie : A** — Suppression immédiate et totale des endpoints v1.2. Le contexte dev-local, le reset complet de la base de données, et l'absence de consommateur tiers rendent la couche de compatibilité inutile. Le coût de la double maintenance l'emporterait largement sur un bénéfice inexistant.

## Conséquences

### Positives
- Le codebase est plus lisible : un seul contrat API, cohérent avec le modèle de données v2.0.
- Les tests n'ont pas à couvrir des routes obsolètes.
- Le `SnapshotsController` et `SnapshotsModule` sont supprimés, ainsi que les DTOs associés dans `packages/shared` (`SnapshotSummary`, `SnapshotDetail`).

### Négatives
- Tout script Postman ou appel curl écrit pour v1.2 doit être mis à jour manuellement.
- Les tests E2E Playwright qui ciblaient les anciennes routes (`upload.spec.ts`, etc.) doivent être réécrits.

### Ce qu'on s'interdit désormais
- Ajouter un alias ou une route de redirection rétrocompatible vers les endpoints v1.2 — si une compat est un jour nécessaire (déploiement réel, CI externe), elle sera traitée dans une ADR dédiée.
- Conserver le module `SnapshotsModule`, le `SnapshotsController`, ou les DTOs `SnapshotSummary`/`SnapshotDetail` dans le codebase après la slice 2a.

## Ressources / Références

- Chapeau v2.0 §10 — Tableau de compatibilité v1.2 → v2.0, colonne endpoints.
- Slice 2a §D — Nouveaux endpoints v2.0 et liste des endpoints supprimés.
- Slice 2a §G — Migration data : `prisma migrate reset --force` + reset complet de la DB.
