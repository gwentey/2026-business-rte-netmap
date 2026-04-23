# Spec technique — Refonte totale du design "carto-rte" (dark)

## Source du design

Bundle Anthropic récupéré le 2026-04-23 via l'URL
`https://api.anthropic.com/v1/design/h/SyULU2LnicyCMU8It5bboQ` (archive tar
nommée `carto-rte`). Décompressé localement dans
`C:\Users\ANTHONY\AppData\Local\Temp\anthropic-design\carto-rte\`.

Contenu utilisé comme référence :
- `project/index.html` — wiring HTML + fonts
- `project/tokens.css` — tokens CSS + primitives globales (.btn, .badge, …)
- `project/pages.css` — sections page-spécifiques (timeline, detail-panel, …)
- `project/chrome.jsx` — markup AppHeader + SubHeader
- `project/map-page.jsx` — markup MapPage + TimelineSlider + DetailPanel
- `project/upload-page.jsx` — markup UploadPage (5 états)
- `project/admin-page.jsx` — markup AdminPage (6 onglets)
- `project/app.jsx` — orchestration + wrappedMapPage avec 4 états

## Stack résultante

```
apps/web/
  index.html                     ← Google Fonts CDN (Nunito Sans + JetBrains Mono)
  vite.config.ts                 ← simplifié (plus d'auto-injection SCSS)
  package.json                   ← @design-system-rte/{react,core} retirés

  src/
    main.tsx                     ← imports : leaflet + fonts + globals
    App.tsx                      ← <div className="app"> + AppHeader + Routes
    styles/
      brand.scss                 ← tokens dark (--dark-*, --cyan-*, --ink-*, --proc-*, --radius-*, --shadow-*)
      reset.scss                 ← reset minimal compatible dark
      components.scss            ← primitives globales (.app, .app-header, .sub-header, .btn, .badge, .input, .select, .check, .field, .icon-btn, .card, .tbl, .banner, .modal, .scroll, .mono, .page-title)
      pages.scss                 ← sections (.timeline*, .detail-panel*, .map-overlay*, .map-legend*, .map-overlay-state, .state-card, .dropzone*, .file-row*, .progress*, .dup-diff*, .summary-grid, .summary-stat*, .admin-tabs*, .admin-toolbar, .danger-card*, .org-row*, .modal-backdrop, .modal*)
      globals.scss               ← orchestre brand → reset → components → pages
      fonts.scss                 ← Nunito local fallback (4 weights)
      brand.test.ts              ← contrastes WCAG AA des tokens dark

    components/
      AppHeader/AppHeader.tsx    ← .app-header markup, brand + nav (NavLink) + EnvSelector + user
      SubHeader/SubHeader.tsx    ← .sub-header markup, breadcrumb + right slot
      EnvSelector/EnvSelector.tsx ← .env-selector chip + listbox dropdown
      Map/
        NetworkMap.tsx           ← MapContainer + TileLayer CartoDB Dark Matter
        EdgePath.tsx             ← Polyline bezier, couleur depuis PROCESS_COLORS
        NodeMarker.tsx           ← Marker + Tooltip
        node-icon.tsx            ← Lucide SVG dans divIcon, palette dark RTE
        HomeCdOverlay.tsx        ← lignes pointillées endpoint→CD, focus cyan
        BaFilter.tsx             ← .map-overlay avec checkboxes BAs
        MapOverlaysTopRight.tsx  ← cluster top-right (hierarchy + BA filter + actions)
        MapLegend.tsx            ← .map-legend footer (process + nodes + counter)
        MapStates.tsx            ← Empty/Loading/Error sur .state-card
        useMapData.ts            ← (inchangé)
      DetailPanel/
        DetailPanel.tsx          ← <aside className="detail-panel"> + DetailSection + Kv
        NodeDetails.tsx          ← sections Identité, Coordonnées, Connexions, …
        EdgeDetails.tsx          ← sections Processus, Extrémités, Activité
      TimelineSlider/
        TimelineSlider.tsx       ← .timeline* (track + ticks + thumb glowy)
      UploadBatchTable/
        UploadBatchTable.tsx     ← grid 6 cols .file-row
      Admin/
        AdminTabs.tsx            ← .admin-tabs__trigger
        ImportsAdminTable.tsx    ← .admin-toolbar + .tbl + delete confirm modal
        ComponentsAdminTable.tsx ← .admin-toolbar + .tbl + edit/config buttons
        OrganizationsAdminTab.tsx ← grid .org-row + import/export JSON
        EntsoeAdminTab.tsx       ← banner info + statut + form upload
        RegistryAdminTab.tsx     ← banner info + ProcessColorsEditor + RteEndpointsTable
        DangerZoneTab.tsx        ← banner err + 3 .danger-card + confirm modal
        ProcessColorsEditor.tsx  ← .tbl + color picker
        RteEndpointsTable.tsx    ← .tbl + edit
        ComponentConfigModal.tsx ← .modal--lg, kicker cyan
        ComponentOverrideModal.tsx ← .modal--lg + grid 2 cols formulaire
        OrganizationEditModal.tsx ← .modal--lg + grid 2 cols formulaire

    pages/
      MapPage.tsx                ← orchestre SubHeader + TimelineSlider + canvas + overlays + DetailPanel + Legend (+ states)
      UploadPage.tsx             ← orchestre SubHeader + form + dropzone + UploadBatchTable + summary
      AdminPage.tsx              ← orchestre SubHeader + AdminTabs + tab content

    lib/
      process-colors.ts          ← palette remappée (cyan/orange/violet/vert/jaune/rose/gris/gris)
      api.ts, format.ts, debounce.ts ← (inchangés)

    store/
      app-store.ts               ← (inchangé — toute la logique métier préservée)

  scripts/
    check-no-hex.mjs             ← exceptions étendues à components.scss + pages.scss
```

## Tile layer Leaflet

URL par défaut :
`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` avec
`subdomains="abcd"`.

Override possible via variable d'env : `VITE_TILE_URL=https://...` (utile si
le firewall RTE bloque `basemaps.cartocdn.com` — fallback OSM dark
self-hosted ou tile alternative à configurer côté infra).

## Polices

Chargées depuis Google Fonts CDN dans `apps/web/index.html` :
`Nunito Sans` (300–900) + `JetBrains Mono` (400/500/700).

Fallback local conservé : 4 fichiers `nunito-*.woff2` dans
`apps/web/public/fonts/`, déclarés dans `apps/web/src/styles/fonts.scss`. Si la
CDN Google est inaccessible, le navigateur tombera sur Nunito local puis sur
`-apple-system, BlinkMacSystemFont, Segoe UI, …`.

## Contrats préservés

- Aucun changement de DTO `@carto-ecp/shared`
- Aucun changement de schéma Prisma
- `ProcessColorMap` : 8 clés inchangées (TP, UK-CC-IN, CORE, MARI, PICASSO,
  VP, MIXTE, UNKNOWN), seules les valeurs hex sont remappées
- Logique d'ingestion (zip → CSV → XML → Prisma) inchangée
- Store Zustand `app-store.ts` inchangé (mêmes signatures, mêmes effets)
- Sélecteurs E2E préservés : `.leaflet-container`, `.leaflet-interactive`,
  `aside h2` (le h2 est désormais dans NodeDetails/EdgeDetails à l'intérieur
  de l'aside), pattern EIC `/17V|10X|26X/`

## Tests

- 159 tests Vitest passent (27 fichiers)
- `pnpm typecheck` passe (workspace complet)
- `pnpm --filter @carto-ecp/web build` passe
- `node apps/web/scripts/check-no-hex.mjs` passe (exceptions :
  `lib/process-colors.ts`, `components/Map/{node-icon,EdgePath,HomeCdOverlay}.tsx`,
  `styles/{brand,components,pages}.scss`, `styles/brand.test.ts`,
  `*.test.ts{,x}`)

## Build artifacts

- `apps/web/dist/index.html` — 0.86 kB (gzip 0.49 kB)
- `apps/web/dist/assets/index-*.css` — 44 kB (gzip 13 kB)
- `apps/web/dist/assets/index-*.js` — 564 kB (gzip 169 kB)
