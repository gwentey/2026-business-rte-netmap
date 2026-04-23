# ADR-038 — Couche `components/ui/` (ré-exports DS + 4 composants maison)

> **⚠ SUPERSEDED par ADR-040 (2026-04-24)** — La couche `components/ui/` est
> entièrement supprimée (Table, RangeSlider, ColorField, DateTimeField,
> EmptyState, Skeleton, ré-exports DS). Les classes CSS globales du nouveau
> design suffisent. Voir `docs/adr/ADR-040-refonte-design-carto-rte-custom-dark.md`.


| Champ      | Valeur                           |
|------------|----------------------------------|
| Numéro     | ADR-038                          |
| Statut     | Accepté                          |
| Date       | 2026-04-23                       |
| Auteur(s)  | Anthony + Claude                 |
| Owner      | Anthony                          |
| Décideurs  | Anthony                          |
| Contexte   | Slice 4b — composants de base    |
| Remplace   | —                                |
| Features   | web/*                            |
| App        | web                              |

## Contexte

La Slice 4a (ADR-037) a installé `@design-system-rte/react@^1.8.0` mais sans créer de couche d'abstraction côté projet. Avec la migration progressive prévue (Slices 4c/4d/4e), on a besoin d'une convention cohérente pour importer les composants UI depuis n'importe où dans `apps/web/src/`.

De plus, le DS RTE ne fournit PAS 4 composants dont nous avons besoin :
- **Table** — aucun composant Table dans les 41 composants du DS
- **Slider / Range** — absent, mais `TimelineSlider` en a besoin
- **ColorPicker / ColorField** — absent, mais `ProcessColorsEditor` en a besoin
- **DatePicker / DateTimeField** — absent, mais `ImportsAdminTable` utilise `<input type="datetime-local">` natif

## Options considérées

| Option | Description | Effort | Avantages | Inconvénients |
|--------|-------------|--------|-----------|---------------|
| **A** — Barrel `components/ui/index.ts` + 4 composants maison dans sous-dossiers | Ré-exporte les composants DS + 4 composants custom | S | Import unifié via `@/components/ui`, couplage minimal au DS, marge de manœuvre pour wrappers épais plus tard | Tree-shaking réduit (tous les composants DS sont ré-exportés ensemble) |
| B — Imports directs depuis `@design-system-rte/react` partout | Pas de couche d'abstraction | XS | Tree-shaking optimal, zéro boilerplate | Pas d'endroit pour ajouter defaults projet, refactor coûteux si on change de DS |
| C — Wrappers épais (1 fichier par composant avec forwarding complet) | Chaque composant DS a son propre wrapper dédié | L | Adaptabilité maximale (override props, variantes custom) | Overkill pour une phase initiale — 37 wrappers triviaux à écrire/maintenir |

## Décision retenue

**Option A** : barrel `apps/web/src/components/ui/index.ts` ré-exportant les 37 composants du DS + 4 composants maison dans des sous-dossiers dédiés.

Justifications :
1. **Import unifié** — toutes les pages et composants métier écrivent `import { Button, Modal, Table } from '@/components/ui';` indépendamment de l'origine DS ou maison.
2. **Couplage minimal au DS** — si RTE change son DS (ex: `@design-system-rte/v2`), seul `index.ts` est à modifier.
3. **Place prévue pour les composants maison** — les 4 qui manquent au DS ont leur dossier dédié avec `.tsx` + `.module.scss`, même structure que les futurs wrappers épais éventuels.
4. **Tree-shaking acceptable** — le bundle JS passe de 556 KB (Slice 4a) à 1486 KB (Slice 4b) à cause des ré-exports. Reste acceptable en dev-local ; optimisation via imports sélectifs prévue si besoin en slice future.

## Conséquences

### Positives
- Import cohérent partout : `import { X } from '@/components/ui'`
- 4 composants maison (Table, RangeSlider, ColorField, DateTimeField) prêts à l'emploi pour les slices 4c/4d/4e
- Migration du DS future (ex: v2) localisée à 1 fichier

### Négatives
- Bundle JS augmenté (~1 MB) car tous les composants DS sont ré-exportés
- Les composants maison doivent suivre manuellement les évolutions du DS (tokens, couleurs) — pas de garanties de cohérence visuelle automatique
- Pas de wrappers épais possibles sans refactor si on veut ajouter des defaults projet (mais overkill pour la phase actuelle)

### Ce qu'on s'interdit désormais
- Importer un composant DS directement depuis `@design-system-rte/react` dans `apps/web/src/components/` ou `apps/web/src/pages/` (sauf `EnvSelector` qui peut importer depuis `@/components/ui`).
- Créer de nouveaux composants UI "one-shot" hors de `components/ui/` : si un nouveau composant UI est réutilisable, il doit intégrer la couche `components/ui/`.
- Dupliquer Table, RangeSlider, ColorField, DateTimeField ailleurs : utiliser les 4 exports du barrel.

## Ressources / Références

- **ADR-037** — Adoption du Design System RTE (Slice 4a)
- **Plan d'implémentation Slice 4b** — `docs/superpowers/plans/2026-04-23-ds-rte-slice-4b-components-base.md` *(à créer en Slice 4b.2 si besoin de brainstorm étendu)*
- **Package DS** — `@design-system-rte/react@^1.8.0`, 37 composants ré-exportés
- **Tests désactivés** — 3 tests `.todo` dans `apps/web/src/components/EnvSelector/EnvSelector.test.tsx` (interactions DS Select à adapter en Slice 4b.2)
