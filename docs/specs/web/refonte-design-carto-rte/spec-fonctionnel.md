# Spec fonctionnelle — Refonte totale du design "carto-rte" (dark)

| Champ | Valeur |
|---|---|
| Module | `web/refonte-design-carto-rte` |
| Statut | Implémenté |
| Date | 2026-04-24 |
| ADR | ADR-040 (supersede 037/038/039) |
| Slice | post-Slice 5e (refonte hors-cycle) |

## Pourquoi

L'admin RTE a fourni le 2026-04-23 un nouveau bundle de design Anthropic
nommé "carto-rte" qui définit un langage visuel **radicalement différent** de
la skin issue de la migration DS RTE (slices 4a–5e) :

- Mode **dark intégral** au lieu d'un mode clair sur fond `--c-surface: #ffffff`
- Système **CSS pur** (classes globales) au lieu de composants React DS pré-stylés
- Polices **Nunito Sans** + **JetBrains Mono** au lieu de Nunito seul
- Tile layer Leaflet **CartoDB Dark Matter** au lieu d'OpenStreetMap clair
- Shell à 2 bandes (`AppHeader` 56px + `SubHeader` 48px par page) au lieu d'un seul header

Tenter d'adapter la skin actuelle (DS RTE + ds-override) à ce nouveau langage
n'est pas viable : trop d'écart entre le markup imposé par le DS et le markup
attendu par le design.

## Quoi

Refonte **totale** de la couche présentation de `apps/web/`, en préservant
intégralement la couche métier (store Zustand, calls API, ingestion backend,
schéma Prisma — aucun changement) :

- **Fondations CSS dark** : 4 fichiers SCSS globaux (`brand.scss`,
  `reset.scss`, `components.scss`, `pages.scss`) qui exposent l'intégralité
  du langage visuel
- **Shell global** : nouveaux composants `AppHeader` (brand cyan + nav +
  EnvSelector + bloc utilisateur) et `SubHeader` (breadcrumb + actions),
  utilisés par chaque page
- **MapPage** : refonte complète de la mise en page (header + sub-header +
  TimelineSlider + canvas full-bleed + overlays top-right + DetailPanel +
  legend footer + states empty/loading/error)
- **UploadPage** : refonte complète (dropzone animé, batch table dense,
  banners contextuels, summary stats à la complétion)
- **AdminPage** : refonte complète des 6 onglets (Imports, Composants,
  Organisations, Annuaire ENTSO-E, Registry RTE, Zone danger) + 3 modales
- **Palette process** réalignée sur la nouvelle palette (TP cyan, UK-CC-IN
  orange, CORE violet, MARI vert, PICASSO jaune, VP rose, MIXTE+UNKNOWN gris)
- **Suppression** : `@design-system-rte/{react,core}`, dossier
  `apps/web/src/components/ui/` (Table, RangeSlider, ColorField,
  DateTimeField, EmptyState, Skeleton + barrel `index.ts`),
  `ds-override.scss`, `tokens.scss`, `App.module.scss` et tous les
  `.module.scss` des composants applicatifs

## Hors scope

- Backend (`apps/api/`) : aucun changement. DTO, Prisma, ingestion pipeline,
  registry, fixtures restent identiques
- Storybook / catalogue de composants
- Refonte de la stratégie d'authentification (toujours hors scope global)
- Migration Storybook ou autre catalogue
- Tests visuels (Percy, Chromatic) : aucun n'existe dans le projet
