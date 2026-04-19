# ADR-026 — `effectiveDate` pilotante, découplée de `uploadedAt`

| Champ      | Valeur                                                                      |
|------------|-----------------------------------------------------------------------------|
| Numéro     | ADR-026                                                                     |
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

Un admin peut uploader tardivement un dump produit plusieurs semaines plus tôt (backup retrouvé, import en rattrapage historique). Si la date de référence pour le tri latest-wins et le filtre `refDate` est la date serveur d'upload (`uploadedAt`), ce dump rétroactif serait vu comme « plus récent » que tous les imports effectués entre la date du dump et la date d'upload, ce qui fausserait la reconstruction historique du réseau.

Il faut donc distinguer trois dates de nature différente : la date d'upload (fait serveur immutable, usage audit), l'horodatage extrait du nom de fichier ECP (`sourceDumpTimestamp`, nullable si le pattern de nom n'est pas reconnu), et une date pilotante éditable par l'admin qui gouverne toutes les décisions métier.

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — 3 dates distinctes (`uploadedAt`, `sourceDumpTimestamp`, `effectiveDate`) | `uploadedAt` : audit immuable. `sourceDumpTimestamp` : parsé du filename, nullable. `effectiveDate` : pilotante, éditable admin, default = `sourceDumpTimestamp ?? uploadedAt` | S | Gère le cas rétro sans contrainte de nommage de fichier, audit préservé, flexibilité admin | Trois champs à maintenir, risque de confusion si mal documenté |
| B — `uploadedAt` pilotante | Utiliser uniquement la date serveur comme référence timeline | XS | Trivial | Casse le cas d'import rétroactif ; un dump antérieur uploadé tardivement écrase des imports plus récents |
| C — `sourceDumpTimestamp` obligatoire et pilotante | Imposer le pattern de nom de fichier ECP ; refuser les ZIPs sans timestamp dans le nom | S | Un seul champ à gérer | Bloque les uploads de fichiers renommés ou exportés sans ce pattern ; friction inutile |

## Décision retenue

**Option choisie : A** — Trois dates coexistent dans `Import`. `uploadedAt` est immutable et réservé à l'audit. `sourceDumpTimestamp` est parsé du nom de fichier ECP (`{EIC}_YYYY-MM-DDTHH_MM_SSZ.zip`) et peut être null. `effectiveDate` est la date pilotante pour toute décision métier (latest-wins, filtre `refDate`, timeline) ; sa valeur par défaut à la création est `sourceDumpTimestamp ?? uploadedAt`, et l'admin peut la modifier en slice 2c.

## Conséquences

### Positives
- Un import rétroactif (dump ancien uploadé tardivement) se positionne correctement dans la timeline si l'admin corrige son `effectiveDate`.
- L'`uploadedAt` conserve sa valeur d'audit sans jamais influencer les calculs métier.
- Sans intervention admin, le comportement par défaut (prendre `sourceDumpTimestamp` si disponible) est déjà correct pour la majorité des imports ECP dont le nom de fichier suit le pattern officiel.

### Négatives
- L'admin doit manuellement corriger `effectiveDate` pour les imports dont le fichier a été renommé et dont la date extraite est absente ou incorrecte.
- Sans slice 2c (panneau admin), `effectiveDate` n'est pas éditable depuis l'UI en 2a — correction uniquement possible via API directe.

### Ce qu'on s'interdit désormais
- Utiliser `uploadedAt` pour toute décision métier : timeline, conflits latest-wins, filtre `refDate`, tri des imports.
- Mélanger `uploadedAt` et `effectiveDate` dans les requêtes `GraphService` ou les index de tri.

## Ressources / Références

- Chapeau v2.0 §2 — Lexique : définitions de `uploadedAt`, `sourceDumpTimestamp`, `effectiveDate`, `refDate`.
- Chapeau v2.0 §3 — Modèle conceptuel : `import.effectiveDate ≤ refDate` dans la condition de filtre.
- Slice 2a §A — Schéma `Import` : `uploadedAt @default(now())`, `sourceDumpTimestamp DateTime?`, `effectiveDate DateTime`.
- Slice 2a §C — `getGraph(env, refDate?)` filtre via `effectiveDate: { lte: effectiveRefDate }`.
