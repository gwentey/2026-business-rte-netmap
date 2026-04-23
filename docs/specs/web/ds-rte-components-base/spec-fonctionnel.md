# Spec Fonctionnelle — web/ds-rte-components-base

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/ds-rte-components-base      |
| Version| 3.0-alpha.7                     |
| Date   | 2026-04-23                      |
| Source | Slice 4b — composants de base   |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-037](../../../adr/ADR-037-adoption-design-system-rte.md) | Adoption du Design System RTE | Actif |
| [ADR-038](../../../adr/ADR-038-components-ui-layer-wrappers-ds.md) | Couche components/ui/ (ré-exports DS + 4 composants maison) | Actif |

---

## Contexte et objectif

Deuxième des cinq slices de migration vers le DS RTE. Crée la **couche projet `apps/web/src/components/ui/`** qui expose les composants UI réutilisables de carto-ecp :
- 37 composants ré-exportés depuis `@design-system-rte/react`
- 4 composants maison (Table, RangeSlider, ColorField, DateTimeField) pour les besoins non couverts par le DS

Migre **EnvSelector** comme premier consommateur — preuve que la couche est utilisable en pratique.

**Aucune page métier n'est touchée dans cette slice** : les Slices 4c/4d/4e migreront Admin, Upload, Map avec les composants de la couche `ui/`.

---

## Règles métier

1. **Import unifié** — tout composant UI utilisé dans `apps/web/src/` s'importe via `@/components/ui` (jamais directement depuis `@design-system-rte/react`).

2. **Exception `react-router-dom`** — les `Link` de navigation routing utilisent `react-router-dom`. Le Link du DS est exporté sous alias `DsLink` (typographie + styles, pas de navigation).

3. **4 composants maison** — Table, RangeSlider, ColorField, DateTimeField sont placés sous `components/ui/<Name>/` avec `.tsx` + `.module.scss`. Pas de dépendance entre eux.

4. **EnvSelector** — migré vers `Select` DS. L'API DS attend `id`, `label`, `onChange(value)`, `options[{value, label}]`. `showLabel={false}` masque visuellement le label (accessibilité préservée via `aria-label` implicite).

---

## Cas d'usage

### CU-001 — Utiliser un composant DS dans un composant métier

**Acteur** : développeur carto-ecp

**Flux** : le développeur écrit un nouveau composant admin ou migre un existant. Il importe le composant UI nécessaire depuis la couche projet :
```tsx
import { Button, Modal, TextInput } from '@/components/ui';
```
Aucun autre import DS requis.

### CU-002 — Utiliser un composant maison

**Acteur** : développeur carto-ecp

**Flux** : le développeur a besoin d'une Table, d'un slider, d'un color picker ou d'un datetime picker. Il importe depuis la même couche :
```tsx
import { Table, RangeSlider, ColorField, DateTimeField } from '@/components/ui';
```
Les composants maison ont une API minimale documentée dans leur fichier `.tsx`.

### CU-003 — Migrer un composant existant

**Acteur** : développeur carto-ecp (Slices 4c, 4d, 4e)

**Flux** : le développeur remplace les classes Tailwind + primitives DOM natifs par les composants de `@/components/ui`. Exemple : `<button className="bg-rte ...">` → `<Button variant="primary">`.

---

## Dépendances

Aucune nouvelle dépendance npm par rapport à la Slice 4a.
Toujours : `@design-system-rte/react@^1.8.0`, `@design-system-rte/core@^1.7.0`, `sass`.

---

## Critères d'acceptation

### Machine green (bloquant)

- `pnpm --filter @carto-ecp/web typecheck` → exit 0 ✅
- `pnpm --filter @carto-ecp/web test` → 143 verts + 3 `.todo` ✅
- `pnpm --filter @carto-ecp/web build` → exit 0, bundle produit ✅
- `pnpm --filter @carto-ecp/api test` → exit 0 (sanity) ✅

### Smoke fonctionnel

- L'app démarre (`pnpm dev`).
- Le header affiche l'EnvSelector (Select DS RTE) fonctionnel : l'utilisateur peut changer d'environnement actif.
- Aucune régression visuelle supplémentaire par rapport à la Slice 4a (les pages Admin/Upload/Map restent inchangées).

### Anti-scope-creep

- `git diff main --name-only` ne liste **aucun** fichier dans `apps/web/src/components/{Admin,Map,DetailPanel,TimelineSlider,UploadBatchTable}/`.
- Les pages `pages/AdminPage.tsx`, `pages/MapPage.tsx`, `pages/UploadPage.tsx` sont inchangées (leur migration est pour les slices suivantes).

---

## Transition vers Slice 4c

La Slice 4c (`feat/ds-rte-admin-*`) migrera les 6 onglets admin un par un (EntsoeAdminTab, DangerZoneTab, RegistryAdminTab + ProcessColorsEditor + RteEndpointsTable, OrganizationsAdminTab + OrganizationEditModal, ComponentsAdminTable + ComponentOverrideModal + ComponentConfigModal, ImportsAdminTable + AdminImportRow + badges) en consommant les composants de la couche `@/components/ui` mise en place ici.

Les tests `.todo` d'EnvSelector seront adaptés en Slice 4b.2 (ou intégrés à la première slice admin) une fois l'API DOM du DS Select documentée.
