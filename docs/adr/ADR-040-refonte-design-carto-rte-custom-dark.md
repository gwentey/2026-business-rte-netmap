# ADR-040 — Refonte totale de la skin web vers un design system custom dark "carto-rte"

- **Statut** : Accepté
- **Date** : 2026-04-24
- **Décideurs** : Anthony (lead), assisté par Claude Opus 4.7
- **Contexte projet** : Bundle de design Anthropic « carto-rte » fourni par l'admin
  RTE le 2026-04-23 (récupéré via l'URL `https://api.anthropic.com/v1/design/h/SyULU2LnicyCMU8It5bboQ`,
  archive tar décompressée localement). Nouvelle direction visuelle radicalement
  différente : dark theme intégral, typographie Nunito Sans + JetBrains Mono,
  système CSS pur sans framework de composants.

## Contexte

Les ADRs **037** (adoption `@design-system-rte/react`), **038** (couche
`components/ui/` ré-exports DS), et **039** (surcharge palette DS via
`ds-override.scss`) avaient mis en place une chaîne complexe :

```
DS RTE (rouge corporate) → ds-override.scss (cyan) → composants DS wrappés → pages
```

Le bundle de design fourni par RTE en avril 2026 utilise un langage visuel
**radicalement différent** du DS RTE :

- **Mode dark intégral** : background `#0a1114`, chrome `#10181d`, panels `#15222a`
- **Système CSS pur** : classes globales (`.btn`, `.badge`, `.card`, `.tbl`,
  `.modal`, `.dropzone`, `.timeline`, `.detail-panel`, `.admin-tabs`, `.banner`,
  `.dup-diff`, `.summary-stat`, `.danger-card`, `.org-row`, `.map-overlay`,
  `.map-legend`, `.state-card`, …) — n'utilise **aucun** composant DS
- **Polices** : Nunito **Sans** (corps) + **JetBrains Mono** (data : EIC,
  dates, tailles)
- **Carto** : Leaflet + tile layer **CartoDB Dark Matter**
- **Shell** : `AppHeader` 56px (brand + nav + EnvSelector + bloc utilisateur) +
  `SubHeader` 48px par page (breadcrumb + actions)

Tenter d'adapter le DS RTE à ce nouveau langage via `ds-override.scss` n'est
plus viable : trop d'écart entre le markup imposé par les composants DS et le
markup attendu par le nouveau design.

## Décision

**Désinstaller totalement** `@design-system-rte/{react,core}` et adopter un
design system custom à base de classes CSS globales, organisé en 4 fichiers
SCSS qui n'exposent **aucun composant React** :

```
brand.scss      → tokens (CSS vars --dark-*, --cyan-*, --ink-*, --proc-*, …)
reset.scss      → reset minimal compatible dark
components.scss → primitives globales (.app, .app-header, .sub-header, .btn,
                  .badge, .input, .select, .check, .field, .icon-btn, .card,
                  .tbl, .banner, .modal, .scroll, .mono, .page-title)
pages.scss      → sections page-spécifiques (.timeline*, .detail-panel*,
                  .map-overlay*, .map-legend*, .map-overlay-state, .state-card,
                  .dropzone*, .file-row*, .progress*, .dup-diff*, .summary-grid,
                  .summary-stat*, .admin-tabs*, .admin-toolbar, .danger-card*,
                  .org-row*, .modal-backdrop, .modal*)
```

Les composants React deviennent des conteneurs sans styles propres : ils
posent le markup et les classes globales du design. Aucun `.module.scss` n'est
conservé pour les composants applicatifs (suppression sèche de tous les
modules SCSS de `apps/web/src/components/**` et `apps/web/src/pages/**`).

**ADR-037, ADR-038 et ADR-039 sont marqués SUPERSEDED par cet ADR-040.**

## Conséquences

### Positives

- Architecture CSS bien plus simple : 4 fichiers SCSS globaux au lieu de
  ~30 `.module.scss` disséminés
- Cohérence visuelle parfaite avec le bundle de design fourni (pixel-perfect
  reproductible)
- Zéro friction entre le markup attendu par le design et le markup généré (le
  DS RTE imposait sa propre structure DOM)
- `pnpm install` plus léger (2 deps en moins, plus les éventuelles transitives)
- Le script `check:no-hex` reste pertinent : tous les hex applicatifs vivent
  dans `brand.scss`, `components.scss`, `pages.scss` (3 fichiers source de
  vérité), plus les exceptions data métier (`process-colors.ts`, `node-icon`,
  `EdgePath`, `HomeCdOverlay`)

### Négatives / Compromis

- Perte de l'accessibilité « gratuite » du DS RTE (focus, ARIA) — il faut la
  reconstruire localement (les classes `.check`, `.input`, `.btn` ont été
  designées avec WCAG AA en tête, voir `brand.test.ts` pour les contrastes)
- Plus de typing TS sur les composants UI (les `Button`, `Modal`, `TextInput`
  du DS RTE sont remplacés par des `<button className="btn btn--primary">`)
- Suppression de toute la couche `apps/web/src/components/ui/` (Table,
  RangeSlider, ColorField, DateTimeField, EmptyState, Skeleton) — devenue
  redondante avec les classes globales

### Migration

- 5 fichiers SCSS globaux créés/réécrits (`brand.scss`, `components.scss`,
  `pages.scss`, `reset.scss`, `globals.scss`)
- 3 composants Map nouveaux (`MapOverlaysTopRight`, `MapLegend`, `MapStates`)
- 2 composants shell nouveaux (`AppHeader`, `SubHeader`)
- 1 composant refonte (`EnvSelector` markup `.env-selector`)
- 3 pages réécrites (`MapPage`, `UploadPage`, `AdminPage`) — logique métier
  intacte (Zustand store, calls API, hooks, useEffect)
- 11 composants Admin migrés vers les classes globales — logique métier intacte
- Palette process remappée dans `lib/process-colors.ts` et
  `packages/registry/eic-rte-overlay.json` (cyan/orange/violet/vert/jaune/rose)
- Tile layer Leaflet : `https://{s}.basemaps.cartocdn.com/dark_all/...` (avec
  variable d'env `VITE_TILE_URL` pour fallback en cas de blocage firewall)
- 159/159 tests Vitest passent
- `pnpm typecheck`, `pnpm build`, `node scripts/check-no-hex.mjs` passent tous

## Liens

- Spec : `docs/specs/web/refonte-design-carto-rte/`
- Plan d'implémentation : `C:\Users\ANTHONY\.claude\plans\nous-allons-totalement-retravailler-playful-dragon.md`
- Bundle source : `C:\Users\ANTHONY\AppData\Local\Temp\anthropic-design\carto-rte\`
- ADRs supersédés : ADR-037, ADR-038, ADR-039
