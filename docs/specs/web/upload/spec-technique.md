# Spec Technique — web/upload

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/upload                      |
| Version| 2.0.1                           |
| Date   | 2026-04-23                      |
| Source | v2.0.1 — refonte styling 5c     |

---

## Architecture

Le module `upload` est la page de dépôt de fichiers ZIP. En v2.0, elle supporte le multi-upload batch avec inspection préalable (dry-run) et gestion des doublons. La logique d'état du batch est entièrement dans le store Zustand (`uploadBatch`, `uploadInProgress`, `addBatchFiles`, `submitBatch`, `clearBatch`).

### Composants et fichiers

| Fichier | Rôle |
|---------|------|
| `pages/UploadPage.tsx` | Page principale : dropzone, champ env, boutons submit/clear, résumé final |
| `components/UploadBatchTable/UploadBatchTable.tsx` | Table du batch (voir [web/upload-batch-table](../upload-batch-table/spec-technique.md)) |
| `store/app-store.ts` | État `uploadBatch`, `uploadInProgress` + actions `addBatchFiles`, `submitBatch`, `clearBatch`, `removeBatchItem`, `updateBatchItem` |
| `lib/api.ts` | `api.inspectBatch(files, envName)` et `api.createImport(file, envName, label, dumpType?, replaceImportId?)` |

---

## Interfaces

### `UploadPage`

Props : aucune.

Sources de données Zustand :
- `uploadBatch: UploadBatchItem[]`
- `uploadInProgress: boolean`
- Actions : `addBatchFiles`, `submitBatch`, `clearBatch`

Champs UI :
- Champ `envName` (string) — initialisé depuis `?env=` en query param si présent, sinon `'OPF'`
- Dropzone react-dropzone : accept `.zip`, multiple=true, maxFiles=20, maxSize=50 MB
- Bouton "Importer tout (N prêts)" — disabled si `uploadInProgress || actionable === 0 || !envName.trim()`
- Bouton "Vider le batch" — disabled si `uploadInProgress || batch.length === 0`
- Résumé final affiché quand batch terminé (done + skipped + errors + lien "Voir sur la carte")

### Flux d'upload

```
1. Utilisateur dépose N fichiers ZIP
2. addBatchFiles(files) :
   a. Crée des items 'pending-inspect' dans uploadBatch
   b. Appelle api.inspectBatch(files, activeEnv)
   c. Met à jour chaque item avec les résultats inspect (dumpType, confidence, duplicateOf, label auto-généré)
   d. Items passent à l'état 'inspected'
3. Utilisateur ajuste labels/types, coche "Remplacer" pour les doublons
4. submitBatch(envName) :
   a. Pour chaque item 'inspected' :
      - Si doublon et forceReplace=false -> état 'skipped'
      - Sinon -> état 'uploading'
      - Appelle api.createImport(file, envName, label, overrideDumpType ?? dumpType, replaceImportId?)
      - Succès -> état 'done', createdImportId stocké
      - Erreur -> état 'error', errorCode + errorMessage extraits
   b. Best-effort : un échec n'annule pas les fichiers suivants (ADR-033)
   c. loadEnvs() appelé en fin de batch pour rafraîchir la liste des envs
```

### Type `UploadBatchItem` (store interne)

```typescript
{
  id: string;                 // UUID local (non persisté)
  file: File;
  fileName: string;
  fileSize: number;
  fileHash?: string;
  sourceComponentEic?: string | null;
  sourceDumpTimestamp?: string | null;
  dumpType?: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
  confidence?: 'HIGH' | 'FALLBACK';
  label: string;
  overrideDumpType?: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
  duplicateOf?: { importId: string; label: string } | null;
  forceReplace: boolean;
  state: 'pending-inspect' | 'inspected' | 'uploading' | 'done' | 'skipped' | 'error';
  errorCode?: string;
  errorMessage?: string;
  createdImportId?: string;
}
```

### Libellé auto-généré

Si `result.sourceComponentEic` est présent : `"{EIC} · {sourceDumpTimestamp.slice(0,10)}"`.
Sinon : `"{fileName sans .zip}"`.

---

## Dépendances

- `react-dropzone` — dropzone multi-fichiers
- `react-router-dom` — navigation post-upload + lecture `?env=` query param
- `@carto-ecp/shared` — types `ImportDetail`, `InspectResult`
- Zustand store — état du batch
- `lib/api.ts` — appels HTTP
- `UploadBatchTable` — affichage du tableau

---

## Invariants

1. L'inspection est déclenchée automatiquement dès que des fichiers sont déposés. Elle ne requiert pas d'action utilisateur explicite.
2. `submitBatch` est best-effort par fichier (ADR-033) : une erreur sur un fichier ne bloque pas les suivants.
3. Les fichiers dont l'état est `'error'`, `'done'` ou `'skipped'` sont ignorés par `submitBatch`.
4. Le batch (uploadBatch) est conservé dans le store même après navigation. `clearBatch` réinitialise explicitement.
5. Le `file: File` (référence navigateur) n'est pas sérialisable et n'est pas persisté dans localStorage.
6. La limite est 20 fichiers par batch et 50 MB par fichier (cohérent avec le backend).

---

## Tests

| Fichier spec | Couverture |
|-------------|-----------|
| `UploadPage.test.tsx` | Dropzone, submit avec envName, état disabled, navigation post-submit |

Ref. croisées : [web/upload-batch-table](../upload-batch-table/spec-technique.md), [api/imports](../../api/imports/spec-technique.md).

---

## Styling — Slice 5c (v2.0.1)

`UploadPage.module.scss` a été refondu intégralement en Slice 5c (286 lignes). Tous les hex codés en dur ont été remplacés par les tokens `--c-*` / `--r-*` / `--shadow-*` / `--motion-*` de `apps/web/src/styles/brand.scss`, importé via `@use "@/styles/brand" as *;`.

Points notables :
- Dropzone : border dashed cyan (`--c-primary`) animée par `@keyframes` pulse, fond idle `--c-surface-dark`, fond hover/drag `--c-surface-deep`.
- Bouton primaire "Importer tout" : `--c-primary` + `--c-primary-hover` + `--shadow-1`/`--shadow-2` pour l'élévation.
- Alertes : tokens sémantiques `--c-error-bg`/`--c-error-border`/`--c-primary-soft` selon le type.
- Lien "Voir sur la carte" : fond `--c-surface-dark`, flèche et accent en `--c-primary`, transition `--motion-fast`.

Voir `docs/specs/web/charte-visuelle/spec-technique.md §12` pour le détail complet des tokens consommés.
