# ADR-035 — `dumpType` immutable post-ingest

| Champ      | Valeur                                     |
|------------|------------------------------------------|
| Numéro     | ADR-035                                   |
| Statut     | Accepté                                   |
| Date       | 2026-04-19                                |
| Auteur(s)  | Anthony + Claude                          |
| Owner      | Anthony                                   |
| Décideurs  | Anthony                                   |
| Contexte   | Slice v2.0-2c-1 Admin imports             |
| Remplace   | —                                         |
| Features   | *                                         |
| App        | api                                       |

## Contexte

La slice 2c-1 introduit l'édition admin des imports (`PATCH /api/imports/:id`). Se pose la question : doit-on permettre de réassigner le `dumpType` d'un import existant ? Les `components` et `paths` persistés ont été extraits selon la pipeline du type d'origine (ENDPOINT lit le blob XML, CD lit `message_path.csv`). Modifier seulement la metadata `Import.dumpType` crée une incohérence : la table prétend que c'est un CD mais les paths ont été extraits comme si c'était un ENDPOINT.

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — Immutable post-ingest | Le `dumpType` est gelé après création. Pour le changer : delete + re-upload (avec override manuel supporté en 2b) | XS | Cohérence DB garantie, simple | 1 delete + 1 re-upload au lieu d'un PATCH |
| B — Re-parse atomique | Nouvel endpoint `POST /api/imports/:id/reingest` qui lit le zip stocké, supprime components/paths, relance la pipeline avec le nouveau type | M | Propre côté UX | Nouveau endpoint + logique atomique (delete puis reparse), le stored zip peut avoir été supprimé si cleanup bug |
| C — Metadata only | Update juste `Import.dumpType` en DB sans toucher aux components/paths | XS | Trivial | Incohérence garantie — **NON RECOMMANDÉ** |

## Décision retenue

**Option retenue : A** — `dumpType` immutable post-ingest. Pour 2c-1 le scope est UI-only, ajouter un reingest (B) double le scope backend. L'alternative delete + re-upload est parfaitement acceptable avec le flow 2b (preview table + dumpType override manuel).

## Conséquences

### Positives

- **Cohérence DB garantie** : `Import.dumpType` correspond toujours à ce qui a été extrait en ingestion. Aucun risque de desynchronisation entre la métadonnée et les données sous-jacentes (`components` et `paths`).
- **Scope restreint pour 2c-1** : Endpoint `PATCH /api/imports/:id` accepte strictement `{ label?, effectiveDate? }`, refuse tout extra (`dumpType`, `envName`, etc.). Zod strict appliqué.
- **Implémentation simple** : Pas de logique de re-parse, pas de handling d'erreurs atomiques complexes.

### Négatives

- **Corriger un type mal détecté** nécessite delete + re-upload (2 clics admin) au lieu d'un PATCH.
- **En cas de big batch mal classé**, admin doit supprimer N imports avant de re-uploader (mais scenario rare en pratique).

### Ce qu'on s'interdit désormais

- Ajouter `dumpType` à la liste des champs éditables dans `UpdateImportSchema`.
- Faire un PATCH de `dumpType` en metadata only sans re-parse (crée une incohérence garantie).
- Modifier `Import.dumpType` sans recalculer les `components` et `paths` associés.

## Ressources / Références

- `docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2c-1-design.md` §B (endpoint PATCH strict), §I (ADR note)
- Slice 2b design §H pour le flow delete + re-upload
