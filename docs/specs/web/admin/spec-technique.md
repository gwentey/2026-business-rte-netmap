# Spec Technique — web/admin

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/admin                       |
| Version| 2.1.0                           |
| Date   | 2026-04-23                      |
| Source | v2.1 — Slice 5d styling         |

---

## Architecture

La page admin regroupe 4 onglets distincts implémentés comme composants indépendants. L'état de l'onglet actif est local (useState). Chaque onglet gère ses propres appels API et son propre état de chargement.

### Composants et fichiers

| Fichier | Rôle |
|---------|------|
| `pages/AdminPage.tsx` | Page principale : titre + AdminTabs + rendu conditionnel du tab actif |
| `components/Admin/AdminTabs.tsx` | Barre d'onglets (imports / composants / entsoe / danger) |
| `components/Admin/ImportsAdminTable.tsx` | Onglet Imports : liste des imports, actions supprimer/éditer |
| `components/Admin/ComponentsAdminTable.tsx` | Onglet Composants : liste avec recherche, filtre "surcharges uniquement", bouton éditer |
| `components/Admin/ComponentOverrideModal.tsx` | Modal d'édition d'un override (tous les champs) |
| `components/Admin/EntsoeAdminTab.tsx` | Onglet ENTSO-E : statut + upload CSV |
| `components/Admin/DangerZoneTab.tsx` | Onglet Zone danger : 3 actions purge avec confirmation typing-to-confirm |

---

## Interfaces

### `AdminTabs`

```typescript
type AdminTabId = 'imports' | 'components' | 'entsoe' | 'danger';
Props = { active: AdminTabId; onChange: (tab: AdminTabId) => void }
```

### `ImportsAdminTable`

- Charge via `api.listImports(env?)` (env = `activeEnv` depuis le store)
- Affiche : label, fileName, dumpType, effectiveDate, uploadedAt, stats (composants/chemins/stats), warnings
- Actions : supprimer (DELETE + reload), éditer label/effectiveDate (PATCH)
- Pas de pagination (liste complète)

### `ComponentsAdminTable`

- Charge via `api.listAdminComponents()`
- Colonnes : EIC, displayName actuel, type actuel, organisation, pays, isDefaultPosition, override (Oui/Non), importsCount
- Filtres : recherche textuelle (EIC, nom, org, pays), checkbox "Surcharges uniquement"
- Action : bouton "Éditer" ouvre `ComponentOverrideModal`

### `ComponentOverrideModal`

- Props : `row: AdminComponentRow`, `onSaved: () => void`, `onClose: () => void`
- Champs éditables : displayName, type (select), organization, country (2 chars), lat (-90..90), lng (-180..180), tagsCsv, notes
- Submit : `api.upsertOverride(eic, patch)` (PUT /api/overrides/:eic)
- Bouton supprimer l'override (si override existant) : `api.deleteOverride(eic)` (DELETE /api/overrides/:eic)

### `EntsoeAdminTab`

- Affiche statut via `api.getEntsoeStatus()` : count + refreshedAt
- Dropzone pour upload CSV ENTSO-E → `api.uploadEntsoe(file)`
- Affiche résultat : `{ count, refreshedAt }`

### `DangerZoneTab`

3 actions configurées via `ACTION_CONFIG`:

| Action | Route | Mot-clé | Résultat |
|--------|-------|---------|---------|
| purge-imports | DELETE /api/admin/purge-imports | `PURGER` | `{ deletedCount }` |
| purge-overrides | DELETE /api/admin/purge-overrides | `PURGER` | `{ deletedCount }` |
| purge-all | DELETE /api/admin/purge-all | `RESET` | `{ imports, overrides, entsoe }` |

Flux de confirmation : bouton -> modal -> saisie mot-clé -> bouton "Confirmer" enabled uniquement si `confirmText === keyword`. L'exécution se fait dans `execute()`.

---

## Dépendances

- `lib/api.ts` — tous les appels HTTP admin
- `@carto-ecp/shared` — types `ImportDetail`, `AdminComponentRow`, `EntsoeStatus`, `PurgeResult`, `ResetAllResult`
- Zustand store — `activeEnv` pour ImportsAdminTable
- React useState local — état de chaque onglet
- `react-router-dom` — navigation (AdminPage accessible depuis `/admin`)

---

## Invariants

1. Chaque onglet gère son propre état de chargement et d'erreur.
2. Les actions destructives (purges) sont irréversibles — la confirmation typing-to-confirm est côté client uniquement. Aucune validation côté backend du mot-clé saisi.
3. `ComponentOverrideModal` est un formulaire contrôlé (tous les champs initialisés depuis `row.override` si existant, sinon vides).
4. La suppression d'un import depuis `ImportsAdminTable` recharge la liste après succès.
5. L'upload ENTSO-E recharge le statut après succès.

---

## Tests

| Fichier spec | Couverture |
|-------------|-----------|
| `AdminTabs.test.tsx` | Rendu des onglets, changement actif |
| `ImportsAdminTable.test.tsx` | Chargement liste, action supprimer, action éditer |
| `ComponentsAdminTable.test.tsx` | Chargement, filtres recherche/surcharges, ouverture modal |
| `ComponentOverrideModal.test.tsx` | Formulaire contrôlé, upsert, delete override |
| `EntsoeAdminTab.test.tsx` | Statut, upload CSV |
| `DangerZoneTab.test.tsx` | 3 actions, modal typing-to-confirm, disabled si mot-clé incorrect |
| `AdminPage.test.tsx` | Navigation entre onglets |

Ref. croisées : [api/admin](../../api/admin/spec-technique.md), [api/overrides](../../api/overrides/spec-technique.md), [api/imports](../../api/imports/spec-technique.md).

---

## Styling — Slice 5d

Tous les fichiers `.module.scss` du module Admin ont été refondus en Slice 5d. Chaque fichier consomme `@use "@/styles/brand" as *` et s'appuie sur les mixins composites introduits dans `brand.scss` (Slice 5d). Aucun hex codé en dur.

| Fichier | Mixins utilisés |
|---------|----------------|
| `pages/AdminPage.module.scss` | — (tokens directs : `surface-sunken`, `t-display`, `layout-page-px`) |
| `Admin/AdminTabs.module.scss` | — (border-bottom cyan 3px sur onglet actif, `primary-soft` hover) |
| `ui/Table/Table.module.scss` | `table-base` |
| `Admin/ComponentsAdminTable.module.scss` | `input-base`, `button-primary`, `button-ghost` |
| `Admin/RteEndpointsTable.module.scss` | `table-base` (badge override `primary-soft`, remplace ambre) |
| `Admin/OrganizationsAdminTab.module.scss` | `button-primary`, `button-ghost` |
| `Admin/ImportsAdminTable.module.scss` | `modal-backdrop`, `modal-box`, `button-danger` |
| `Admin/ComponentConfigModal.module.scss` | `modal-backdrop`, `modal-box`, `input-base` |
| `Admin/ComponentOverrideModal.module.scss` | `modal-backdrop`, `modal-box`, `input-base`, `button-primary`, `button-danger-outline` |
| `Admin/OrganizationEditModal.module.scss` | `modal-backdrop`, `modal-box`, `input-base`, `button-primary`, `button-ghost` |
| `Admin/DangerZoneTab.module.scss` | `input-base`, `button-danger` (seule zone rouge de l'app — ADR-039) |
| `Admin/EntsoeAdminTab.module.scss` | `button-primary`, `alert-error`, `alert-success` |
| `Admin/ProcessColorsEditor.module.scss` | `button-primary`, `button-ghost` |
| `Admin/RegistryAdminTab.module.scss` | — (sections h2 charte, `surface-sunken`) |

Voir `docs/specs/web/charte-visuelle/spec-technique.md §13` pour le détail complet des mixins et leur sémantique.
