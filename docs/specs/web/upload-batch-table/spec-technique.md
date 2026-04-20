# Spec Technique — web/upload-batch-table

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/upload-batch-table          |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## Architecture

Composant de tableau affichant les fichiers en attente d'import dans le batch. Chaque ligne représente un `UploadBatchItem`. Le composant est purement présentatif : il lit l'état depuis le store Zustand et délègue les actions au store.

### Fichiers

| Fichier | Rôle |
|---------|------|
| `components/UploadBatchTable/UploadBatchTable.tsx` | Table + `LabelInput` (composant interne non exporté) |
| `store/app-store.ts` | `uploadBatch`, `removeBatchItem`, `updateBatchItem` |

---

## Interfaces

### `UploadBatchTable`

Props : aucune (lit depuis le store Zustand).

Sources :
- `uploadBatch: UploadBatchItem[]`
- `removeBatchItem(id: string)`
- `updateBatchItem(id: string, patch: Partial<UploadBatchItem>)`

Si `batch.length === 0` : affiche un message vide.

### Colonnes du tableau

| Colonne | Contenu |
|---------|---------|
| Fichier | `fileName` + taille en KB |
| EIC | `sourceComponentEic` ou `—` si absent |
| Type | `<select>` avec ENDPOINT/CD/BROKER ; valeur = `overrideDumpType ?? dumpType ?? 'COMPONENT_DIRECTORY'` ; icône `⚠` orange si `confidence === 'FALLBACK'` |
| Label | `LabelInput` (input contrôlé local, synchronise via `updateBatchItem`) |
| Statut | Label d'état (STATE_LABELS) + info doublon + erreur si applicable |
| Action | Bouton supprimer (disabled si `state === 'uploading'`) |

### Libellés d'état (`STATE_LABELS`)

| State | Libellé |
|-------|---------|
| `pending-inspect` | Inspection... |
| `inspected` | Prêt |
| `uploading` | Envoi... |
| `done` | Créé |
| `skipped` | Ignoré |
| `error` | Erreur |

### Gestion des doublons

Si `item.duplicateOf` est présent : affiche "Doublon (import : {label})" + checkbox "Remplacer" liée à `item.forceReplace`.

### `LabelInput`

Composant interne avec état local (`useState`) pour le label en cours de saisie. La synchronisation vers le store se fait via `updateBatchItem` sur chaque `onChange`. Ceci évite un re-render du tableau entier à chaque frappe.

Disabled si `state === 'uploading' || state === 'done'`.

---

## Dépendances

- Zustand store — `uploadBatch`, `removeBatchItem`, `updateBatchItem`
- React `useState` local — état du LabelInput

---

## Invariants

1. Le tableau est lecture seule pour les items en état `'uploading'` ou `'done'` (champs disabled).
2. Le sélecteur de type est toujours éditable jusqu'à 'uploading' ou 'done'.
3. La suppression d'un item en cours d'upload (`state === 'uploading'`) est désactivée.
4. `overrideDumpType` prend la priorité sur `dumpType` (détection automatique). Si l'utilisateur change le sélecteur, `overrideDumpType` est mis à jour via `updateBatchItem`.

---

## Tests

| Fichier spec | Couverture |
|-------------|-----------|
| `UploadBatchTable.test.tsx` | Message vide si batch vide, colonnes, états, checkbox doublon, input label, bouton supprimer |

Ref. croisées : [web/upload](../upload/spec-technique.md) — UploadBatchTable est intégré dans UploadPage.
