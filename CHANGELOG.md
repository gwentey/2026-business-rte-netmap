# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) · Versioning : [SemVer](https://semver.org/lang/fr/).

---

## [Unreleased]

### v3.0-alpha.11 — Slice 4c.4 : migration Composants + ComponentOverrideModal + ComponentConfigModal (2026-04-23)

Quatrième mini-slice 4c. Migre l'onglet Composants et ses 2 modales (override + config ECP) de Tailwind vers CSS Modules. Les 3 plus gros fichiers admin (9 colonnes table, modal override avec 8 fields, modal config avec dl/dt/dd).

- `ComponentsAdminTable.{tsx,module.scss}` : toolbar avec search + checkbox "Seulement surchargés" + counter + bouton export JSON. Table 9 colonnes. Badge orange `⚠ Manquant [+]` cliquable ouvre OrganizationEditModal pré-rempli.
- `ComponentOverrideModal.{tsx,module.scss}` : modal 28rem, 8 fields (displayName, type select, organization, country ISO-2, lat/lng grid, tagsCsv, notes), placeholders grisés = valeurs cascade actuelles.
- `ComponentConfigModal.{tsx,module.scss}` : modal 48rem sticky header + scrollable body, source info box (label + env + date + badge Properties OK/missing), sections `.ecp.*` groupées avec `dl`/`dt`/`dd` grid 2 colonnes.

Tests : 143 verts + 3 `.todo`, typecheck + build OK.

---

### v3.0-alpha.10 — Slice 4c.3 : migration OrganizationsAdminTab + OrganizationEditModal (2026-04-23)

Troisième mini-slice 4c. Migre l'onglet Organisations et son modal d'édition de Tailwind vers CSS Modules.

- `OrganizationsAdminTab.{tsx,module.scss}` : toolbar (search+boutons), bandeau import result avec erreurs collapsibles, table 7 colonnes avec badge `Édité` violet, bouton 🖊 Éditer.
- `OrganizationEditModal.{tsx,module.scss}` : modal 28rem, formulaire 7 fields (displayName obligatoire, country ISO-2 avec datalist 33 pays, typeHint avec datalist 11 valeurs, address/notes textarea, lat/lng grid 2 colonnes), méta-box si édition, 3 boutons (Supprimer / Annuler / Enregistrer).

Tests : 143 verts + 3 `.todo`, typecheck + build OK.

---

### v3.0-alpha.9 — Slice 4c.2 : migration onglet Registry + ProcessColorsEditor + RteEndpointsTable (2026-04-23)

Deuxième mini-slice de la série 4c. Migre l'onglet Registry RTE et ses 2 sous-composants de Tailwind inliné vers CSS Modules.

**Highlights :**

- **`RegistryAdminTab.{tsx,module.scss}`** — wrapper 2 sections (Couleurs des process + Endpoints RTE), gap 2rem, titres 1.125rem.
- **`ProcessColorsEditor.{tsx,module.scss}`** — table 6 colonnes (Process, Couleur, Picker, Défaut, Statut, Actions). Color picker 3rem×1.75rem, badge `surchargé` ambre, boutons Enregistrer rouge RTE + Réinitialiser gris. Label `.srOnly` conservé pour a11y.
- **`RteEndpointsTable.{tsx,module.scss}`** — table 7 colonnes (EIC, Code, Nom, Ville, Coord, Statut, Action). Hover rows gris, bouton Modifier bleu outline.

**Tests :** typecheck OK, 143 verts + 3 `.todo`, build OK.

---

### v3.0-alpha.8 — Slice 4c.1 : migration Admin shell + 2 onglets simples (2026-04-23)

Première mini-slice d'une série de 4-5 (4c.1 à 4c.5) qui migre progressivement les 6 onglets admin de Tailwind inliné vers CSS Modules. Cette slice couvre le shell (AdminPage + AdminTabs) et les 2 onglets les plus simples (EntsoeAdminTab + DangerZoneTab).

**Highlights :**

- **`pages/AdminPage.{tsx,module.scss}`** — shell wrapper migré : max-width 72rem, padding 1.5rem, overflow-y auto. Titre 1.5rem font-weight 600 couleur gris 900.
- **`components/Admin/AdminTabs.{tsx,module.scss}`** — 6 onglets cliquables. Rôle ARIA explicite `role="tab"` + `aria-selected` (au lieu de button implicite). Border-bottom rouge RTE (`#e30613`) sur onglet actif, hover gris 900 sur les inactifs.
- **`components/Admin/EntsoeAdminTab.{tsx,module.scss}`** — upload CSV ENTSO-E. Status box grisée (statut annuaire), file input natif, bouton submit rouge RTE avec disabled state, banners inline error (rouge `#fee2e2/#991b1b`) + success (vert `#d1fae5/#065f46`).
- **`components/Admin/DangerZoneTab.{tsx,module.scss}`** — 3 actions danger en cartes rouges (`#fef2f2` background + `#fecaca` border). Modal de confirmation custom (CSS Module) avec backdrop `rgba(0,0,0,0.5)`, box-shadow, input monospace avec focus ring rouge RTE. Confirmation par saisie mot-clé (PURGER / RESET).
- **Pas de Modal DS ni Tab DS dans cette mini-slice** — le Modal DS demande un `primaryButton: DSButtonElement` obligatoire (API épaisse incompatible avec notre UX "input + 2 buttons cancel/confirm") et Tab DS nécessite un setup différent de notre pattern `activeTab === 'x' ? <X /> : null`. Adoption reportée à slice dédiée quand on aura documenté ces intégrations.
- **2 tests mis à jour** — `AdminTabs.test.tsx` et `AdminPage.test.tsx` passent de `getByRole('button')` à `getByRole('tab')` suite à l'ajout du rôle ARIA explicite.

**Tests :**
- Web typecheck : OK
- Web vitest : 143 verts + 3 `.todo` (inchangé depuis 4b)
- Web build : OK

**Fichiers clés :**
- `apps/web/src/pages/AdminPage.{tsx,module.scss}`
- `apps/web/src/components/Admin/{AdminTabs,EntsoeAdminTab,DangerZoneTab}.{tsx,module.scss}`
- Tests : `AdminTabs.test.tsx`, `AdminPage.test.tsx` (sélecteurs `role="tab"`)

**Prochaines slices 4c.x :**
- 4c.2 : RegistryAdminTab + ProcessColorsEditor + RteEndpointsTable
- 4c.3 : OrganizationsAdminTab + OrganizationEditModal
- 4c.4 : ComponentsAdminTable + ComponentOverrideModal + ComponentConfigModal
- 4c.5 : ImportsAdminTable + AdminImportRow + TypeBadge + PropertiesBadge

---

### v3.0-alpha.7 — Slice 4b : couche components/ui/ + migration EnvSelector (2026-04-23)

Crée la couche projet `apps/web/src/components/ui/` qui expose les composants UI utilisés dans carto-ecp : 37 ré-exports depuis `@design-system-rte/react` + 4 composants maison (Table, RangeSlider, ColorField, DateTimeField) pour les besoins non couverts par le DS. Migre EnvSelector comme premier consommateur de la couche. Aucune page métier touchée (Admin, Upload, Map restent pour 4c/4d/4e).

**Highlights :**

- **`components/ui/index.ts`** — barrel ré-exportant 37 composants DS : Accordion, Avatar, Badge, Banner, Breadcrumbs, Button, Card, Checkbox, CheckboxGroup, Chip, Divider, Drawer, FileUpload, Grid, Icon, IconButton, IconButtonToggle, `DsLink` (alias pour éviter collision avec `react-router-dom`), Loader, Modal, Popover, RadioButton, RadioButtonGroup, Searchbar, SegmentedControl, Select, SideNav, SplitButton, Stepper, Switch, Tab, Tag, Textarea, TextInput, Toast, ToastQueueProvider, Tooltip, Treeview.
- **4 composants maison** — `Table/Table.tsx` (`<table>` stylé en CSS Module), `RangeSlider/RangeSlider.tsx` (`<input type="range">` avec label+valeur), `ColorField/ColorField.tsx` (`<input type="color">` avec hex visible), `DateTimeField/DateTimeField.tsx` (`<input type="datetime-local">` avec focus ring rouge RTE).
- **EnvSelector migré** — passe de `<select>` Tailwind au `Select` DS RTE via `@/components/ui`. API `id` + `label` + `onChange(value)` + `options[{value, label}]`. `showLabel={false}` masque visuellement le label (a11y préservée).
- **3 tests `.todo`** dans `EnvSelector.test.tsx` — les interactions `role=combobox` + `userEvent.selectOptions` ne fonctionnent plus car le DS Select rend un DOM custom (bouton + listbox). Le test fallback `Aucun env` reste actif. À réécrire en Slice 4b.2 ou en première slice admin.
- **Convention d'import** — `import { X } from '@/components/ui'` partout dans `apps/web/src/components/` et `apps/web/src/pages/`. Imports directs depuis `@design-system-rte/react` interdits dans les fichiers consommateurs (ADR-038).
- **ADR-038** écrit : couche `components/ui/` avec ré-exports barrel + 4 composants maison. Justifie le choix vs wrappers épais (overkill actuellement) ou imports directs sans abstraction (refactor coûteux plus tard).
- **Specs Zelian** — `docs/specs/web/ds-rte-components-base/{spec-fonctionnel,spec-technique}.md` au format T6.

**Tests :**
- Web typecheck : OK
- Web vitest : 143 verts + 3 `.todo` (3 tests d'interaction EnvSelector désactivés)
- Web build : OK, `dist/assets/index-*.js` passe de 556 KB (Slice 4a) à **1486 KB** (Slice 4b) à cause du barrel — tree-shaking réduit. Acceptable en dev-local. À optimiser via imports sélectifs / code-splitting en slice dédiée si passage en prod.
- API sanity : inchangé.

**Breaking changes :** aucun fonctionnel. `EnvSelector` rend maintenant un DOM custom (DS Select) au lieu d'un `<select>` natif — les tests E2E Playwright `header select` resteront impactés (déjà pré-existants cassés depuis la Slice 4a).

**Fichiers clés :**
- `apps/web/src/components/ui/index.ts` (barrel 37 DS + 4 maison)
- `apps/web/src/components/ui/Table/Table.{tsx,module.scss}`
- `apps/web/src/components/ui/RangeSlider/RangeSlider.{tsx,module.scss}`
- `apps/web/src/components/ui/ColorField/ColorField.{tsx,module.scss}`
- `apps/web/src/components/ui/DateTimeField/DateTimeField.{tsx,module.scss}`
- `apps/web/src/components/EnvSelector/EnvSelector.{tsx,module.scss}` (migré)
- `apps/web/src/components/EnvSelector/EnvSelector.test.tsx` (3 `.todo`)
- `docs/adr/ADR-038-components-ui-layer-wrappers-ds.md`
- `docs/specs/web/ds-rte-components-base/{spec-fonctionnel,spec-technique}.md`

**Décisions :**
- Barrel `index.ts` (Option A d'ADR-038) plutôt que wrappers épais (Option C, overkill) ou imports directs sans abstraction (Option B, refactor coûteux plus tard). Trade-off assumé : bundle +1 MB en échange d'un point unique d'import.
- `Link` du DS exporté sous alias `DsLink` pour éviter la collision avec `Link` de `react-router-dom` (utilisé pour la navigation).
- Couleurs des 4 composants maison hardcodées en hex (`#e30613`, `#e5e7eb`, ...). Les tokens SCSS couleur du DS seront adoptés en slice future quand leur API publique sera clarifiée (cf. divergence `$font-family-nunito` notée en Slice 4a).

---

### v3.0-alpha.6 — Slice 4a : adoption du Design System RTE (foundation) (2026-04-23)

Installation des packages officiels `@design-system-rte/react@^1.8.0` + `@design-system-rte/core@^1.7.0` + `sass` (résolu à `^1.99.0`). Retrait de Tailwind CSS, PostCSS, autoprefixer, et des 7 dépendances UI mortes (`@radix-ui/react-{dialog,slot,tabs,tooltip}`, `class-variance-authority`, `clsx`, `tailwind-merge`). Mise en place du pipeline SCSS + CSS Modules + tokens DS. Police officielle Nunito chargée (4 poids : 300/400/600/700) via `apps/web/public/fonts/`.

**Highlights :**

- **Packages DS RTE installés** — `@design-system-rte/react` fournit 41 composants React (Button, TextInput, Modal, Tab, Badge, Drawer, FileUpload, ...). `@design-system-rte/core` fournit les tokens SCSS (spacing 0→80px, radius none→pill, typography Nunito/Arial, elevation 1→6, opacity, layout) et les icônes SVG Material-like. Apache-2.0.
- **Tailwind retiré totalement** — `tailwind.config.ts` et `postcss.config.cjs` supprimés. `tailwindcss`, `postcss`, `autoprefixer` retirés des devDependencies. Les classes `className="bg-rte p-4..."` dans les ~40 composants métier deviennent inertes — elles seront remplacées slice par slice en 4c/4d/4e.
- **Deps UI mortes purgées** — les 4 packages Radix UI, CVA, clsx et tailwind-merge ne sont jamais importés dans `apps/web/src/` (confirmé par grep). Retrait sans risque. 80 packages transitifs nettoyés au total (10 directes + transitives).
- **Pipeline SCSS** — `apps/web/src/styles/tokens.scss` (`@forward '@design-system-rte/core/design-tokens/main'`) + `apps/web/src/styles/fonts.scss` (4 `@font-face` Nunito) + `apps/web/src/styles/globals.scss` (remplace `globals.css`). Auto-import des tokens dans chaque `*.module.scss` via `vite.config.ts` `css.preprocessorOptions.scss.additionalData` (fonction excluant `tokens.scss` et `fonts.scss` pour éviter auto-référence Sass).
- **Police Nunito** — 4 fichiers WOFF2 (`nunito-{light-300,regular-400,semi-bold-600,bold-700}.woff2`) copiés dans `apps/web/public/fonts/` depuis `node_modules/@design-system-rte/core/assets/fonts/`. Servis statiquement par Vite en dev et prod. `font-display: swap` partout.
- **main.tsx** — ordre des imports CSS : DS RTE → Leaflet → fonts → globals.
- **globals.scss** — le token `$font-family-nunito` attendu dans le plan initial n'existe pas dans l'API publique du DS (seuls les tokens composés type `$heading-m-semibold-font-family` sont exposés). Utilisation du string literal `font-family: "Nunito", sans-serif` à la place. À reprendre en Slice 4b via les tokens composés appropriés.
- **Régression visuelle temporaire assumée** — le site reste fonctionnel (routing, upload, map, admin tous accessibles) mais visuellement dégradé. L'esthétique remonte progressivement à partir de Slice 4b quand la couche `components/ui/` prendra le relais.
- **Aucun composant métier touché** — scope strict foundation. Les Slices 4b à 4e migreront les composants et pages.

**Tests :**
- Web typecheck : OK.
- Web vitest : 146 tests verts (26 fichiers).
- Web build : OK, 4 WOFF2 dans `dist/fonts/`.
- API sanity : 313 tests verts (37 fichiers).
- Web Playwright e2e : **1/7 specs vertes** (`empty-state.spec.ts`). Les 6 autres échecs sont **pré-existants** et non introduits par cette slice :
  * `multi-upload.spec.ts` : SyntaxError template literal (Playwright `^1.48.0` résolu en 1.59.1, incompatibilité avec `import.meta.url` en mode CommonJS du `tsconfig.playwright.json`).
  * 5 autres specs (`env-switch`, `select-node`, `snapshot-switch`, `upload-then-map`, `upload-to-map`) : sélecteurs obsolètes (`getByPlaceholder(/hebdo/)`, `ex: Semaine 15 RTE`) — l'UploadPage a évolué après les dernières updates de specs.
  * Notre slice a **amélioré** le comportement : avant, 0 spec ne démarrait (WebServer crash, lockfile désync `tailwindcss not found`) ; après, 1 spec passe.
  * Correction hors scope 4a — à traiter en slice dédiée `fix/playwright-regression` (upgrade tsconfig + refresh sélecteurs).

**Breaking changes :** aucun côté fonctionnel. Changement d'infrastructure de build uniquement.

**Fichiers clés :**
- `apps/web/package.json` (deps diff)
- `apps/web/vite.config.ts` (css.preprocessorOptions.scss)
- `apps/web/src/main.tsx` (4 imports CSS/SCSS)
- `apps/web/src/styles/tokens.scss` / `fonts.scss` / `globals.scss` (créés)
- `apps/web/public/fonts/nunito-{light-300,regular-400,semi-bold-600,bold-700}.woff2` (ajoutés)
- `docs/adr/ADR-037-adoption-design-system-rte.md` *(à rédiger en MT-H)*
- `docs/specs/web/ds-rte-foundation/{spec-fonctionnel,spec-technique}.md` *(à rédiger en MT-I)*
- `apps/web/tailwind.config.ts` (supprimé)
- `apps/web/postcss.config.cjs` (supprimé)
- `apps/web/src/styles/globals.css` (supprimé, remplacé par `.scss`)

**Décisions :**
- Tailwind retiré en une fois (pas de coexistence Tailwind+DS). ADR-037 tranche.
- SCSS + CSS Modules au lieu de Tailwind étendu avec tokens DS : aligné avec la structure du DS core (SCSS natif).
- Nunito servi depuis `apps/web/public/fonts/` (chemin custom `/fonts/`) plutôt que `/assets/fonts/` attendu par le DS : on prend le contrôle du serving, les `@font-face` de notre `fonts.scss` gagnent.
- Incohérence `#e30613` vs `#C8102E` non corrigée dans cette slice (aucune règle CSS métier touchée). Sera tranchée par la valeur du token `$color-brand-primary` du DS en Slice 4e.
- Les régressions Playwright pré-existantes (Playwright 1.48→1.59 incompatibility + sélecteurs UI obsolètes) sont constatées mais non corrigées dans cette slice : hors scope foundation. Slice séparée à ouvrir.

---

### v3.0-alpha.5 — Slice 3d+ : coordonnées GPS dans la mémoire interne (2026-04-23)

Extension de la Slice 3d : la mémoire interne stocke désormais aussi `lat` et `lng` optionnels, éditables via le modal admin et exportables/importables dans le JSON. Les coords sont injectées dans la cascade **entre `overlay.organizationGeocode` (MCO-statique) et `overlay.countryGeocode` (fallback par pays)**, permettant à l'utilisateur de placer avec précision une organisation inconnue du MCO sans toucher au code.

**Highlights :**

- **Colonnes `lat` et `lng` ajoutées** à `OrganizationEntry` (migration `20260423134400_add_org_memory_coords`, Float nullables). Le seed JSON est bumpé en version 2 avec les lat/lng des 40 TSOs et entités connus (siège officiel ou capitale).
- **Validation Zod côté backend** : `lat ∈ [-90, 90]`, `lng ∈ [-180, 180]`, nullables.
- **Validation UX côté modal** : si l'un est renseigné sans l'autre → erreur `Latitude et longitude doivent être toutes deux renseignées ou toutes deux vides.`
- **Cascade lat/lng enrichie** : `override > registry RTE > organizationOverlay > organizationMemory > countryGeo > merged > Bruxelles`.
- **UI** : 2 champs number dans `OrganizationEditModal` (placeholder `-90 … 90` / `-180 … 180`), nouvelle colonne « Position » dans `OrganizationsAdminTab` (affiche `lat.toFixed(3), lng.toFixed(3)` ou `—`).
- **Import/Export JSON** : le format passe à `version: 2` et inclut `lat`/`lng` sur chaque entry. Compatible en lecture avec les exports v1 (les entries v1 importées auront `lat=null, lng=null`).
- **OrganizationSeederService** : passe `lat`/`lng` depuis le seed JSON lors du create/refresh. Flag `userEdited=true` protège les coords modifiées par l'utilisateur contre un re-seed.
- **OrganizationLookup** (utilisé par `GraphService.loadAsMap`) : inclut désormais `lat: number | null` et `lng: number | null`.

**Tests :**
- API : **313 tests verts** (tests existants adaptés pour la nouvelle forme `OrganizationLookup` et `version: 2` dans l'export).
- Web : **144 tests verts** (mock `OrganizationEntryRow` enrichi).
- Typecheck global OK.

**Breaking changes :** aucun pour l'API HTTP (nouveaux champs optionnels). Le format du seed JSON est v2 mais le seeder lit toujours v1 correctement (les champs manquants deviennent null).

**Comportement au prochain boot** : le seeder voit `seedVersion=1` en DB (depuis v3.0-alpha.4) et `JSON.version=2`, il va donc refresh toutes les entries **non modifiées par l'utilisateur** avec les nouvelles coords. Les entries `userEdited=true` sont préservées (seul `seedVersion` passe à 2).

### v3.0-alpha.4 — Slice 3d : mémoire interne des organisations (2026-04-23)

Introduit la **mémoire interne** : une table éditable en BDD qui fait le mapping `organisation name → {country, address, typeHint}`. Résout la demande du user : « quand le pays d'une organisation (TSO, RCC, NEMO, plateforme…) est inconnu de l'annuaire ENTSO-E, il faut pouvoir le renseigner manuellement sans toucher au code ». Le résultat : les composants externes dont l'organisation est connue (Swissgrid, Amprion, EPEX Spot, CORESO…) sont désormais placés dans leur pays au lieu de tomber au fallback Bruxelles.

**Highlights :**

- **Nouvelle table Prisma `OrganizationEntry`** — `{id, organizationName @unique, displayName, country, address, typeHint, notes, seedVersion, userEdited, createdAt, updatedAt}`. Clé de lookup = `organizationName` normalisé (lowercase + trim + collapse whitespace). Migration `20260423125149_add_organization_entry`.
- **Pré-seed versionné au boot** — `OrganizationSeederService` lit `packages/registry/organization-memory-seed.json` (44 entrées couvrant TSOs européens, RCCs, NEMOs, plateformes, interconnecteurs) et applique une stratégie 3-mode :
  - absente en DB → `insert`
  - présente + `userEdited=false` + `seedVersion < JSON.version` → `refresh` des champs + bump `seedVersion`
  - présente + `userEdited=true` → `preserve` (on bumpe juste `seedVersion` pour tracer)
  - Log résumé : `inserted: N, refreshed: N, preserved: N`.
- **Cascade enrichie `applyCascade`** — 3 nouvelles sources :
  - `organizationOverlay` (lu par `RegistryService.resolveByOrganization` depuis `overlay.organizationGeocode` — jamais câblé avant)
  - `organizationMemory` (lu par `OrganizationsService.loadAsMap` depuis la table DB)
  - `countryGeo` (lu par `RegistryService.resolveByCountry` depuis `overlay.countryGeocode` — jamais câblé avant)
  - Ordre `country` : override > entsoe > registry RTE > organizationOverlay > **organizationMemory** > merged
  - Ordre `lat/lng` : override > registry RTE > organizationOverlay > **countryGeo** > merged > Bruxelles
  - `address` : mémoire interne uniquement
  - `GlobalComponent` gagne un champ `address`.
- **6 routes REST** sous `/api/admin/organizations` : `GET` liste, `POST` create, `PATCH :id`, `DELETE :id` (204), `POST /import` (multipart JSON, upsert par organizationName), `GET /export` (téléchargement JSON avec Content-Disposition).
- **Nouvel onglet « Organisations »** dans `/admin` (entre Composants et ENTSO-E). Tableau triable/filtrable, badges d'édition utilisateur, compteurs `{filtered}/{total}` et `N éditées`. Boutons Import / Export + bouton + Nouvelle organisation.
- **Modal d'édition `OrganizationEditModal`** — datalist ISO-3166-1 alpha-2 (33 pays européens) pour country, datalist des 11 typeHints (TSO, RCC, NEMO, PLATFORM, INTERCONNECTOR, EXCHANGE, CAO, AO, ASSOCIATION, PARTNER, OTHER). Mode création/édition avec métadonnées (id, organizationName normalisé, seedVersion, userEdited) affichées en bas.
- **Badge ⚠ Manquant dans `/admin > Composants`** — si `country === null` et `organization` est connue, un badge orange cliquable ouvre le modal d'édition en mode création pré-rempli avec `displayName = organization` du composant. L'utilisateur complète une fois, **tous les composants partageant la même organisation sont résolus** au prochain reload du graphe.

**Tests :**
- API : 313 → **313+** (+24 sur le nouveau module : 4 normalize-org-name, 6 seeder, 14 service — les spécifiques passent à 100%).
- Web : 144 → **144+** (+8 OrganizationsAdminTab, AdminTabs mis à jour pour 6 tabs).
- Typecheck global OK, aucune régression.

**Fichiers clés :**
- `apps/api/src/organizations/` — nouveau module (service, seeder, controller, module, normalize-org-name)
- `apps/api/prisma/migrations/20260423125149_add_organization_entry/`
- `packages/registry/organization-memory-seed.json` (44 entrées v1)
- `apps/api/src/graph/apply-cascade.ts` — 3 nouvelles sources
- `apps/api/src/graph/graph.service.ts` + `overrides.service.ts` — câblage loadAsMap + cascade
- `apps/api/src/registry/registry.service.ts` — `resolveByCountry` + `resolveByOrganization`
- `apps/web/src/components/Admin/OrganizationsAdminTab.tsx` + `OrganizationEditModal.tsx`
- `apps/web/src/components/Admin/ComponentsAdminTable.tsx` — badge + modal flow
- `packages/shared/src/graph.ts` — types `OrganizationEntryRow`, `OrganizationUpsertInput`, `OrganizationImportResult`, `ORGANIZATION_TYPE_HINTS`

**Décisions :**
- Scope `country + address + typeHint` seulement. Pas de lat/lng dans la mémoire interne — on câble `countryGeocode` comme fallback par pays.
- Clé de lookup = `organizationName` normalisé (pas EIC). TenneT NL et TenneT DE = 2 entrées distinctes.
- Auto-seed versionné au boot, préserve les édits utilisateur via flag `userEdited`.
- Clic sur ⚠ → modal mémoire interne (pas override par EIC) : résolution en lot, plus efficace.

**Breaking changes :** aucun. Nouveaux champs additifs sur `GlobalComponent.address`.

**Prépare :** éventuelle UI « suggestions mémoire interne » basée sur les organisations observées dans les ZIPs mais absentes de la mémoire (Slice 3e optionnelle).

### v3.0-alpha.3 — Slice 3c : filtre « par BA » sur la carte (2026-04-23)

Dernière slice de la version 3.0 sur les Business Applications. La carte expose désormais un **filtre par BA** qui répond au cas d'usage MCO « analyse d'impact » (§10 du document fonctionnel) : sélectionner une ou plusieurs BAs pour ne voir que les endpoints qui les portent et leurs interlocuteurs directs.

**Highlights :**

- **Bouton repliable en haut à gauche de la carte** (à côté du toggle Hiérarchie CD). Affiche la liste des BAs présentes dans le graph courant, triées P1 > P2 > P3 puis code alpha. Chaque BA est une pastille toggleable.
- **Logique de filtrage dans `filter-by-ba.ts`** — fonction pure testable : on garde les ancres (nodes RTE qui portent une des BAs sélectionnées) + les contacts connectés via une edge BUSINESS. Les edges PEERING ne comptent pas pour le voisinage (sinon on polluerait avec tous les CDs partenaires). Multi-BA = union des ancres.
- **Store Zustand** : `selectedBaCodes`, `toggleBaFilter(code)`, `clearBaFilter()`. Persisté dans localStorage.
- **Intégration dans `useMapData`** : le filtre est appliqué **avant** le clustering Paris, pour éviter de cluster visuellement des nodes masqués.
- **`NetworkMap`** : ajout du composant `BaFilter`.

**UX :**
- Label dynamique : `Filtre BA` (neutre) → `✓ BA (N)` (violet, actif) dès qu'≥1 BA est sélectionnée.
- Panneau replié par défaut, ouverture au clic.
- Bouton « Réinitialiser » visible seulement si ≥1 BA sélectionnée.
- Les badges de criticité sur chaque ligne du panneau reprennent la palette P1 rouge / P2 ambre / P3 gris (cohérent avec NodeDetails).

**Tests :**
- 12 nouveaux tests : 6 sur `filter-by-ba` (logique pure : vide, ancre seule, contacts, exclusion PEERING, multi-BA, edge filtrée si un endpoint masqué), 6 sur `BaFilter` (rendu conditionnel, liste triée, clic, Réinitialiser).
- Total : **289 API + 132 web = 421 tests verts**.

**Breaking changes :** aucun. Store Zustand étendu de manière additive.

**Boucle fermée :** avec 3a (interlocuteurs), 3b (mapping BA) et 3c (filtre BA), le scénario « incident OCAPPI » du document fonctionnel §10.A est opérationnel :
1. Sélectionner OCAPPI dans le filtre.
2. La carte montre les 5 endpoints RTE concernés + leurs partenaires externes.
3. Cliquer sur un endpoint → liste des BAs + liste des interlocuteurs avec direction et messageTypes.
4. Cliquer sur un interlocuteur → navigation fluide.

### v3.0-alpha.2 — Slice 3b : mapping Business Applications ↔ endpoints (2026-04-23)

Les 14 Business Applications RTE (OCAPPI, PLANET, CIA, NOVA, TACITE, PROPHYL, SMARDATA, RDM, KIWI, SRA, ECO2MIX, TOTEM, BOB, TOP NIVEAU) sont désormais **reliées aux endpoints qui les portent** et affichées en tête du panneau de détail. Répond à la question du user : « on arrive pas à reconnaitre qui sont les BA ».

**Highlights :**

- **Mapping statique BA ↔ Endpoints** dans `packages/registry/eic-rte-overlay.json` — nouveau champ `endpoints: string[]` sur chaque entrée de `rteBusinessApplications`. Matrice issue de `carto-ecp-document-fonctionnel-v1.2.md §5bis`. Éditable par MCO via PR git, sans redéploiement pour les couleurs (toujours recalculées à la lecture).
- **`RegistryService.resolveBusinessApplications(eic)`** — nouvelle méthode qui retourne les BAs triées par criticité (P1 > P2 > P3) puis par code alpha. Vide pour un EIC externe, pour un endpoint RTE non mappé (broker, endpoint de test), et par construction pour les brokers/CDs.
- **Type shared `BusinessApplicationSummary`** (`{code, criticality: 'P1'|'P2'|'P3'}`) + champ `GraphNode.businessApplications`.
- **`GraphService.getGraph`** appelle `resolveBusinessApplications` pour chaque noeud et propage via `toNode`.
- **Section UI « Applications métier (N) » dans `NodeDetails.tsx`** — placée **en tête du panneau** (avant la grille d'identité) car c'est l'info la plus attendue au clic sur un endpoint RTE. Badges colorés par criticité (rouge P1, ambre P2, gris P3).
- **Composant privé `BaBadge`** réutilisable (code mono + pastille criticité).

**Décisions confirmées :**
- Mapping statique d'abord, édition via PR git. Pas d'UI admin en Slice 3b.
- Pas de déduction BA via messageTypes — le mapping explicite est la source de vérité.
- Tri déterministe côté backend pour garantir le rendu stable.

**Tests :**
- API : 284 → **289/289** (+5 sur `resolveBusinessApplications`).
- Web : 117 → **120/120** (+3 sur la section Applications métier).

**Breaking changes :** aucun. Champ `GraphNode.businessApplications` additif.

**Prépare :** Slice 3c (filtre « par BA » sur la carte).

### v3.0-alpha.1 — Slice 3a : endpoint paths + interlocuteurs (2026-04-23)

Première slice de la version v3 qui enrichit la carto ECP avec la dimension « interlocuteurs ». On exploite enfin `message_path.csv` côté endpoint (ignoré jusqu'ici au profit du XML MADES) et on affiche dans le panneau de détail la liste ordonnée des composants avec qui chaque noeud échange, avec direction IN/OUT/BIDI et aperçu des messageTypes.

**Highlights :**

- **Exploitation de `message_path.csv` côté endpoint.** Le pipeline ENDPOINT de `ImportsService` lit désormais `message_path.csv` (via `readEndpointMessagePaths` déjà présent mais jamais câblé) et merge les lignes CSV avec les paths extraits du XML MADES. Dédup via la clé 5-champs `(receiverEic, senderEic, messageType, transportPattern, intermediateBrokerEic)` — **XML prioritaire**, le CSV ne complète que les paths absents du XML. Permet de capturer les paths purement locaux (déclarés par l'endpoint mais non encore propagés au CD) ou visibles uniquement depuis la vue endpoint.
- **Nouvelle méthode `ImportBuilderService.buildEndpointPaths`** — convertit `MessagePathRow[]` → `BuiltImportedPath[]`, applique les filtres décidés avec le user : `messagePathType === 'ACKNOWLEDGEMENT'` ignoré, `status === 'INVALID'` ignoré, `applied === false` ignoré, wildcards (`*` en sender ou receiver) exclus. `allowedSenders` multi-EIC (`"EIC1;EIC2;EIC3"`) explosés en N paths. `isExpired = validTo < effectiveDate` (reproductibilité historique).
- **Helper exporté `pathIdentityKey`** — normalise la clé 5-champs utilisée à la fois par `mergePathsLatestWins` (graph) et la dédup XML↔CSV (ingestion). `null | undefined` sur `intermediateBrokerEic` normalisé en `''`.
- **Nouveau calcul `GraphNode.interlocutors`.** `GraphService.getGraph` appelle `buildInterlocutorsByEic(edges)` après la construction des edges et attache la liste à chaque noeud via `toNode`. Un interlocuteur = EIC, messageTypes (union triée alpha), direction vue depuis le noeud (IN / OUT / BIDI). Tri déterministe : BIDI > OUT > IN, puis nombre de messageTypes décroissant, puis EIC croissant. Garantit que la liste est cohérente avec la carte : **un interlocuteur affiché ⇔ une edge visible**.
- **Type shared `GraphNodeInterlocutor`** dans `packages/shared/src/graph.ts` + champ `GraphNode.interlocutors`.
- **Fonction pure `buildInterlocutorsByEic`** (`apps/api/src/graph/build-interlocutors.ts`) — extraite pour isoler la logique de dérivation et la tester unitairement. Exclut les edges `PEERING`. Protection contre les self-edges improbables.
- **Nouvelle section « Interlocuteurs (N) » dans `NodeDetails.tsx`** — sous « Cibles d'upload ». Chaque ligne : badge de direction coloré (`IN` bleu ciel, `OUT` vert émeraude, `⇄` violet), `displayName` cliquable (ou EIC brut si absent du graph), aperçu des 3 premiers messageTypes + « et N autre(s) ». Résout la zone d'incertitude §87 de la spec `web/detail-panel` (section IN/OUT mentionnée au design §10.7 mais jamais implémentée).
- **Composant `DirectionBadge`** privé, dans `NodeDetails.tsx`.

**Tests :**
- API : 275 → **284/284** (+8 `buildInterlocutorsByEic`, +13 `buildEndpointPaths`, +1 intégration pipeline endpoint, +1 intégration graph interlocutors ; −6 qui se trouvaient sur la méthode précédente).
- Web : 111 → **117/117** (+6 `NodeDetails` section Interlocuteurs : masquage si vide, compteur, troncature > 3 + singulier/pluriel, badges IN/OUT/BIDI, EIC brut si absent du graph).
- Typecheck global OK.

**Décisions :**
- ACK / INVALID / `applied=false` / wildcards ignorés **à l'ingestion** (pas de flag). Les paths `ACTIVE` avec `validTo < effectiveDate` sont persistés avec `isExpired=true` et masqués par défaut (déjà l'invariant du graph).
- `node.interlocutors` est **dérivé des edges agrégées** plutôt que des paths bruts : cohérence garantie avec la carte.
- Interlocuteurs RTE ↔ BA : non traité dans cette slice. Arrivera en Slice 3b (mapping statique dans `eic-rte-overlay.json`).

**Breaking changes :** aucun. Champ `GraphNode.interlocutors` est additif (défaut `[]` backend, deux mocks de test frontend alignés). Pas de migration Prisma.

**Prépare :** Slice 3b (mapping BA ↔ endpoints dans le registry), Slice 3c (filtre « par BA » sur la carte).

### v2.0-alpha.17 — Slice 2p Modal admin "Config ECP" par composant (2026-04-23)

Dernier slice du plan d'enrichissement. Une modal admin affiche désormais **toutes les propriétés `ecp.*`** d'un composant (contact, réseau, antivirus, archivage, compression, sécurité, sync CD, messages, AMQP/Direct, handlers custom, broker…), regroupées par **section métier** lisible. Source : le dernier Import dont `sourceComponentEic` correspond. Accessible depuis `/admin > Composants` via le bouton ⚙ Config de chaque ligne avec au moins un import.

**Highlights :**

- **Nouveau endpoint backend** `GET /api/admin/components/:eic/config` — reçoit un EIC, le normalise en upper-case, valide le pattern 16 caractères alphanumériques.
- **Nouveau service `ComponentConfigService`** (`apps/api/src/admin/`) :
  - Sélectionne le `Import` le plus récent (`effectiveDate` desc) dont `sourceComponentEic` correspond à l'EIC demandé.
  - Regroupe les `ImportedAppProperty` associées par **15 sections** via pattern regex : Identification, Contact, Synchronisation CD, Antivirus, Archivage, Compression, AMQP & Direct, Connectivité, Message paths, Messages, Sécurité, JMS/FSSF, Handlers custom, Broker, Réseau, Admin. Les clés non-reconnues tombent dans "Autres".
  - Tri alphabétique des clés au sein de chaque section.
  - Renvoie aussi la `source` : `importId`, `label`, `envName`, `uploadedAt`, `hasConfigurationProperties` (badge `.properties` fourni ✓/✗ dans l'UI).
- **Shared DTO** `ComponentConfigResponse` + `ComponentConfigSection` + `ComponentConfigProperty`.
- **Frontend `ComponentConfigModal.tsx`** — modal lecture seule :
  - Header avec EIC + bouton de fermeture.
  - Bandeau info source (import, env, date d'upload, badge Properties).
  - Sections groupées (fond gris, compteur de clés), tableau `key → value` en police mono. Valeurs vides affichées en placeholder `(vide)` italique.
  - Message d'aide dédié si aucun Import n'a ce composant comme source.
- **`ComponentsAdminTable`** — nouveau bouton `⚙ Config` dans chaque ligne où `importsCount > 0` (à côté de `🖊 Éditer`), qui ouvre la modal.

**Tests :**
- API : 256 → **261/261** (+3 `ComponentConfigService` : source null quand aucun dump, groupement par section avec tri alphabétique, latest-wins entre imports ; +2 `AdminController` : EIC invalide rejeté, normalisation upper-case).
- Web : 107 → **111/111** (+4 `ComponentConfigModal` : chargement + rendu sections, bannière quand source nulle, placeholder `(vide)`, bouton fermeture).

**Breaking changes :** aucun. `AdminController` gagne une dépendance `ComponentConfigService` — les tests directs qui mockent le constructeur doivent provider ce service.

### v2.0-alpha.16 — Slice 2o Overlay endpoint → home CD (2026-04-23)

Un nouveau toggle "Hiérarchie CD" sur la carte trace des liens fins gris-bleu **endpoint → Component Directory parent**, utilisant le champ `homeCdCode` déjà remonté par les slices précédents. Utile pour voir en un coup d'œil quel CD dessert quel groupe d'endpoints.

**Highlights :**

- **Nouveau composant `HomeCdOverlay.tsx`** — purement front-end, aucun changement API. Pour chaque `GraphNode` ayant un `homeCdCode` qui correspond à un autre nœud du graph courant, trace une `Polyline` non-interactive (slate-400, weight 1, dashArray `2 4`, opacité 0.55) entre les 2 points géographiques. Skip de l'auto-référence (un CD qui se déclare son propre home).
- **Store `app-store.ts`** : nouveau state `showHomeCdOverlay: boolean` + action `toggleHomeCdOverlay()`. Persisté en localStorage (comme `activeEnv`) pour retrouver le toggle au reload.
- **`NetworkMap.tsx`** : bouton flottant en haut à droite "Hiérarchie CD" (style chip, état actif visible via inversion couleur) qui toggle le store. Le composant `HomeCdOverlay` est rendu dans le `MapContainer` (derrière les edges et markers) pour ne pas concurrencer les interactions.

**Tests :**
- API : **256/256** inchangés.
- Web : 103 → **107/107** (+4 `HomeCdOverlay` : rien rendu si `visible=false`, rien si aucun homeCd, une polyline par endpoint avec homeCd présent dans le graph, auto-référence skipée).

**Breaking changes :** aucun. Toggle par défaut OFF, expérience utilisateur inchangée tant qu'il n'est pas activé.

### v2.0-alpha.15 — Slice 2n Santé composant + routes d'upload (2026-04-23)

Deux nouveaux CSV ECP sont désormais parsés : `component_statistics.csv` (vu par un CD pour chaque composant — santé + cumul messages) et `message_upload_route.csv` (cibles d'upload prioritaires déclarées par un endpoint). Chaque nœud affiche un **badge de santé coloré** (vert < 1h, orange < 24h, rouge > 24h) sur son marker, et le popup contient une section "Santé (vue CD)" + la liste des "Cibles d'upload" cliquables.

**Highlights :**

- **Prisma** : 2 nouvelles tables (migration `add_component_stats_and_upload_routes`) :
  - `ImportedComponentStat` — `componentCode`, `lastSyncSucceed`, `lastSynchronizedTime`, `sentMessages`, `receivedMessages`, `waitingToDeliver/Receive`.
  - `ImportedUploadRoute` — `targetComponentCode`, `createdDate`.
- **`types.ts`** : `component_statistics.csv` et `message_upload_route.csv` retirés de `IGNORED_CSV_FILES` et ajoutés à `USABLE_CSV_FILES`.
- **`CsvReaderService.readComponentStatistics()` + `readUploadRoutes()`** : nouveaux parsers.
- **`ImportBuilderService.buildComponentStats()` + `buildUploadRoutes()`** : nouveaux constructeurs (skip des lignes sans code cible, normalisation des compteurs `null → 0`).
- **`ImportsService`** :
  - Branche ENDPOINT : lit `message_upload_route.csv` si présent.
  - Branche CD : lit `component_statistics.csv` si présent.
- **`GraphService.getGraph`** construit 2 nouvelles maps latest-wins :
  - `compStatsByEic` : pour chaque composant observé par un CD dans l'env, on garde le dernier `lastSync` + cumul sentMessages/receivedMessages.
  - `uploadTargetsBySourceEic` : pour chaque endpoint source de dump, on garde la liste des EICs cibles déclarées.
- **`GraphNode`** (shared) gagne 4 champs : `lastSync: string | null`, `sentMessages: number | null`, `receivedMessages: number | null`, `uploadTargets: string[]`.
- **Frontend `node-icon.tsx`** :
  - Nouvelle fonction `healthStatusFromLastSync(lastSync, now)` → `'healthy' | 'warning' | 'stale' | 'unknown'`.
  - `buildNodeDivIcon(kind, isDefaultPosition, selected, health)` — nouveau paramètre `health` qui peint un **petit badge coloré 8×8 en haut à droite** du marker (emerald / amber / red ; aucun badge pour `unknown`).
- **Frontend `NodeMarker.tsx`** dérive `health` depuis `node.lastSync` avant de construire l'icône.
- **Frontend `NodeDetails.tsx`** :
  - Nouvelle section "Santé (vue CD)" avec badge fraîcheur + lastSync formaté + compteurs UP/DOWN en français.
  - Nouvelle section "Cibles d'upload (N)" qui liste les `targetComponentCode` cliquables vers les nodes cibles (fallback texte si le node cible n'est pas dans l'env courant).

**Tests :**
- API : 254 → **256/256** (+2 intégration : composant_stats persiste 2 EPs avec receivedMessages=755945/225023 pour CD1, message_upload_route persiste les cibles d'EP2).
- Web : 94 → **103/103** (+6 `healthStatusFromLastSync` : null/unparsable/<1h/1h-24h/>24h, +3 `NodeDetails` : Santé rendue / cachée sans stats / uploadTargets fallback texte, +1 icône avec badge santé coloré par statut).

**Breaking changes :** aucun — `GraphNode` gagne 4 champs nourris par le backend, `buildNodeDivIcon` a un 4ᵉ paramètre optionnel (default `'unknown'`).

### v2.0-alpha.14 — Slice 2m CDs partenaires en peering (synchronized_directories) (2026-04-23)

La carte affiche désormais les **CDs partenaires** de chaque Component Directory RTE (TERNA, APG, NG-UK, …) — lus depuis `synchronized_directories.csv`. Ils apparaissent comme nodes `EXTERNAL_CD` reliés au CD source par des edges **PEERING** en pointillé gris, distincts des edges BUSINESS (flux de messages métier). Le popup de la edge peering affiche mode de sync (`ONE_WAY` / `TWO_WAY`), statut et URL du CD partenaire (IPs privées RTE masquées).

**Highlights :**

- **Prisma** : nouvelle table `ImportedDirectorySync` avec `directoryCode`, `directorySyncMode`, `directoryType`, `directoryUrl`, `synchronizationStatus`, `synchronizationTimestamp` (migration `add_imported_directory_sync`).
- **`synchronized_directories.csv`** est retiré de `IGNORED_CSV_FILES` et ajouté à `USABLE_CSV_FILES`.
- **`CsvReaderService.readSynchronizedDirectories`** : nouveau parser du CSV.
- **`ImportBuilderService.buildDirectorySyncs`** : normalise `syncMode` à `ONE_WAY`/`TWO_WAY`, skip les lignes sans `directoryCode`, **masque les IPs privées RFC 1918** (10.x, 172.16-31.x, 192.168.x) dans `directoryUrl` via `maskPrivateIp()`. Les IPs publiques (Azure 20.x, neutre 90.x, etc.) et les DNS (csi.apg.at, ifa2ecptest.nationalgrid.com) sont préservés intacts.
- **`ImportsService` (branche CD)** : lit le CSV (si présent) et persiste via `RawPersisterService`.
- **`GraphService.getGraph`** :
  - Construit un `peeringByCd` global à partir de tous les `ImportedDirectorySync` de l'env.
  - Ajoute les `directoryCode` des CDs partenaires à l'`eicSet` → ils deviennent des nodes du graph même s'ils ne sont pas dumpés.
  - Les CDs partenaires hérite de `type = 'COMPONENT_DIRECTORY'` via une injection dans la cascade Registry quand le composant n'a ni import local ni entrée registry explicite.
  - Génère une edge `PEERING` par paire `(sourceCdEic, partnerCdEic)`, latest-wins.
- **`GraphEdge`** (shared) gagne 2 champs : `kind: 'BUSINESS' | 'PEERING'` + `peering: { syncMode, directoryType, directoryUrl, synchronizationStatus } | null`.
- **Frontend `EdgePath.tsx`** : les edges PEERING sont rendues en **gris neutre** (`#6b7280`), **dashArray `2 4`** (pointillé dense, distinct du `6 6` des flux BUSINESS inactifs), weight fixe 1.5 + opacité 0.7.
- **Frontend `EdgeDetails.tsx`** : rendu dédié pour PEERING — header "Peering CD ↔ CD", mode de sync avec badge (indigo TWO_WAY / slate ONE_WAY), URL partenaire, dernier sync, statut.

**Tests :**
- API : 243 → **254/254** (+6 `maskPrivateIp`, +4 `buildDirectorySyncs`, +1 intégration CD full → 8 CDs partenaires persistés, IPs privées masquées, URLs publiques préservées, syncMode TWO_WAY reconnu).
- Web : **94/94** inchangés (tests existants mis à jour avec `kind: 'BUSINESS'` + `peering: null` dans les fixtures `GraphEdge`).

**Breaking changes :** aucun pour le contrat fonctionnel. `GraphEdge` gagne 2 champs obligatoires dans le wire-format : les clients qui typent strict doivent intégrer `kind` et `peering`. Les edges legacy (avant cette version) sont toutes `BUSINESS` / `peering: null`.

### v2.0-alpha.13 — Slice 2l Volumes sur les edges (épaisseur + stats popup) (2026-04-23)

L'épaisseur d'une arête est désormais **proportionnelle au volume de messages** échangés sur la paire (somme bi-directionnelle `A→B + B→A`). Le popup flux détaille le volume total, les compteurs UP/DOWN, et la dernière activité DOWN en plus de l'UP.

**Highlights :**

- **`GraphEdge.activity`** (shared) gagne 3 champs : `sumMessagesUp`, `sumMessagesDown`, `totalVolume`.
- **`GraphService.buildEdges`** : les `ImportedMessagingStat` sont désormais sommées **dans les deux sens** pour une paire `(A, B)` donnée. Le dump A porte `A→B`, le dump B porte `B→A` — on les additionne (et on garde le `connectionStatus` / `lastMessage*` de la stat la plus récente des deux).
- **`EdgePath.tsx`** : nouvelle fonction `weightFromVolume(totalVolume)` — échelle log₁₀ clampée `[1, 6]` (0 msg → 1 px, 10 → 2, 100 → 3, 1 000 → 4, 10 000 → 5, 100 000+ → 6). Sélection : `+2` au weight calculé pour rester visible quand une petite edge est cliquée.
- **`EdgeDetails.tsx`** : 3 nouvelles lignes :
  - "Volume total" avec badge slate + séparateur français.
  - "Envoyés (UP)" / "Reçus (DOWN)" avec valeurs formatées `toLocaleString('fr-FR')`.
  - "Dernière msg DOWN" (complément de "Dernière msg UP" qui existait déjà).
  - Badge de statut coloré : vert pour `CONNECTED`, rouge pour `NOT_CONNECTED`, gris sinon.

**Tests :**
- API : **243/243** inchangés (les nouveaux champs sont nourris à chaque calcul de graph, les assertions existantes restent vraies puisque les stats des fixtures sont bien présentes).
- Web : 92 → **94/94** (+2 EdgeDetails : volumes rendus avec formats français, label "Aucun" quand totalVolume=0).

**Breaking changes :** aucun — les champs ajoutés à `GraphEdge.activity` sont nourris par le backend ; les clients qui typent strict devront intégrer les 3 nouveaux champs (valeurs par défaut `0` tolérées).

### v2.0-alpha.12 — Slice 2k Contacts, homeCdCode cliquable, Config ECP dans le popup (2026-04-23)

Le popup nœud de la carte expose désormais toutes les métadonnées humaines déjà parsées depuis le XML MADES et les dumps ECP : **contact** (personne responsable, email avec `mailto:`, téléphone avec `tel:`), **home CD** cliquable qui recentre la sélection sur le Component Directory parent, **config ECP** (statut `ACTIVE`, thème UI) lue depuis les `application_property.csv` / `.properties` du composant source.

**Highlights :**

- **`GraphNode`** (shared) gagne 7 champs : `personName`, `email`, `phone`, `homeCdCode`, `status` (`ecp.internal.status`), `appTheme` (`ecp.appTheme`). Tous nullables pour rester tolérants aux dumps incomplets.
- **`GraphService.toNode`** : peuple ces champs depuis le `GlobalComponent` (contacts + homeCdCode déjà en base depuis le XML) et depuis un nouveau `runtimePropsBySourceEic` construit à partir des `ImportedAppProperty`. Stratégie latest-wins : pour chaque EIC qui est `sourceComponentEic` d'au moins un Import, on récupère les dernières valeurs de `ecp.internal.status` et `ecp.appTheme`.
- **`NodeDetails`** frontend :
  - Ligne "Home CD" dans le tableau principal : EIC cliquable si le CD est un nœud du graph courant (clic → `selectNode(homeCdCode)`, recentre la carte sur le CD), texte plat + tooltip "CD pas présent dans l'env" sinon.
  - Nouvelle section "Contact" visible si au moins un champ parmi `personName` / `email` / `phone` est renseigné. Liens `mailto:` et `tel:` automatiques.
  - Nouvelle section "Config ECP" visible si `status` ou `appTheme` sont connus. Badge vert pour `ACTIVE`, grisé pour les autres statuts.
- **Query Prisma** : `findMany` de `Import` inclut maintenant `importedProps` (nécessaire pour extraire status/appTheme à la volée).

**Tests :**
- API : **243/243** inchangés (le nouveau champ est nullable, les assertions existantes restent valides).
- Web : 88 → **92/92** (+4 NodeDetails : section Contact rendue avec mailto/tel, section Contact masquée si vide, section Config avec badge ACTIVE, homeCdCode rendu comme texte plat quand CD absent).

**Breaking changes :** aucun pour le contrat API — champs ajoutés non-obligatoires côté lecture (les clients qui typent `GraphNode` doivent intégrer les nouveaux champs, valeur `null` tolérée).

### v2.0-alpha.11 — Slice 2i Upload couplé zip + configuration.properties (2026-04-23)

L'admin peut désormais uploader **zip + `<EIC>-configuration.properties` ensemble** sur `/upload`. Le `.properties` externe (exporté via `Admin ECP > Settings > Runtime Configuration > Export Configuration`) fournit les vraies valeurs courantes de configuration (`ecp.projectName`, `ecp.envName`, `ecp.natEnabled`, `ecp.appTheme`, URLs home CD, etc.) — elles écrasent les clés homonymes du CSV interne au zip. Un badge rouge ✗ / vert ✓ dans `/admin > Imports` signale les imports sans `.properties`.

**Highlights :**

- **Prisma** : `Import.hasConfigurationProperties Boolean @default(false)` (migration `add_has_configuration_properties`). Exposé dans `ImportSummary` + `ImportDetail` (shared).
- **Nouveau service** `PropertiesParserService` (`apps/api/src/ingestion/properties-parser.service.ts`) qui parse le format Java `.properties` : clé=valeur, espaces tolérés autour du `=`, commentaires `#` / `!`, CRLF, BOM UTF-8, valeurs vides préservées. Filtre automatique des clés sensibles (regex élargi pour capturer `keyStorePass` en plus de `password`, `secret`, `privateKey`, `credentials`).
- **`ImportsController.create`** : remplace `FileInterceptor` par `FileFieldsInterceptor` sur `[file, configurationProperties]`. Validations supplémentaires : extension `.properties`, taille max 128 kB, erreurs typées `PROPERTIES_INVALID_EXT` / `PROPERTIES_TOO_LARGE`.
- **`ImportsService.createImport`** : reçoit `configurationProperties?: { originalname, buffer }`. Parse le buffer, fusionne avec `application_property.csv` (external gagne sur les clés en conflit), propage au flux ENDPOINT et COMPONENT_DIRECTORY. Si absent → warning non-bloquant `CONFIGURATION_PROPERTIES_MISSING`.
- **Frontend UploadPage** : dropzone accepte maintenant `.zip` ET `.properties`. Les `.properties` sont indexés par EIC (pattern `<EIC>-configuration.properties`) dans `propertiesFiles` du store. Au `submitBatch`, chaque zip est apparié à son `.properties` par `sourceComponentEic.toUpperCase()` et envoyé ensemble via le même POST `/api/imports`. Chip violette "N fichier(s) .properties en attente" pour feedback immédiat.
- **Frontend ImportsAdminTable** : nouvelle colonne "Props" avec badge `✓` (vert, tooltip "fichier fourni") ou `✗` (rouge, tooltip "valeurs issues uniquement du CSV interne").
- **`api.createImport`** accepte un 6ᵉ paramètre optionnel `configurationProperties?: File`.

**Tests :**
- API : 241 → **243/243** (+2 tests d'intégration : ingestion avec `.properties` → `hasConfigurationProperties=true` + clés externes persistées ; sans `.properties` → warning `CONFIGURATION_PROPERTIES_MISSING`).
- **11 nouveaux tests unitaires** `PropertiesParserService` : parse simple, tolérance espaces/CRLF/BOM, commentaires, filtrage secrets, cas réel ECP.
- **3 nouveaux tests controller** : upload avec `.properties` valide, rejet extension invalide, rejet taille excessive.
- Web : **88/88** inchangés (les tests d'intégration dropzone ajoutent le champ `hasConfigurationProperties: false` dans les mocks `ImportDetail`).

**Breaking changes :** aucun pour le contrat public. `FileInterceptor` → `FileFieldsInterceptor` côté controller : les tests directs qui construisaient `ctrl.create(body, file)` doivent passer par `{ file: [file] }`.

### v2.0-alpha.10 — Slice 2j projectName / envName sur la carte (2026-04-23)

La carte affiche désormais le **nom humain ECP officiel** (ex. `INTERNET-EP1`, `ECP-CWERPN`, `PCN-EP1`) pour chaque composant, lu directement depuis la propriété `ecp.projectName` du dump — conformément à la convention admin ECP (Admin Guide §4.4 : `Endpoint | <projectName> | <envName>`). L'env name est exposé dans le popup.

**Highlights :**

- **Prisma** : nouvelle colonne `ImportedComponent.projectName String?` (migration `20260423071514_add_project_name_to_imported_component`). Renseignée uniquement pour le composant dont le dump est issu (`eic === sourceComponentEic`).
- **`ImportsService`** : extraction de `ecp.projectName` depuis `application_property.csv` au moment de l'ingestion, côté ENDPOINT et COMPONENT_DIRECTORY.
  - ENDPOINT : injecté sur le composant local (eic = `ecp.componentCode`).
  - COMPONENT_DIRECTORY : correctif supplémentaire — le CD utilise désormais son **vrai EIC** (`ecp.componentCode`) au lieu de l'id interne séquentiel `"1"` du CSV. Les dumps CD antérieurs n'étaient donc pas correctement chaînés avec les autres dumps de l'env.
- **Cascade `displayName`** (`apply-cascade.ts`) réordonnée : `Override → merged.projectName → ENTSOE → Registry → merged.displayName → EIC`. La source officielle ECP prend maintenant le pas sur les référentiels d'overlay (sauf override admin explicite). Les EICs partenaires sans projectName (TERNA, APG, etc.) continuent de passer par ENTSOE/Registry.
- **`GraphNode`** (shared) gagne 2 champs : `projectName: string | null` et `envName: string | null`.
- **`NodeDetails`** frontend affiche :
  - un chip violet "Projet ECP : INTERNET-EP1" sous le titre si `projectName` diffère du `displayName` (cas override / registry présent) ;
  - une ligne "Environnement" avec la valeur courante (`PFRFI`, `ACCEPTANCE`, etc.).
- **`GraphService.toNode`** reçoit l'`envName` courant et le propage sur chaque node.
- **`merge-components`** : `projectName` rejoint la liste des `OVERWRITABLE_FIELDS` (latest-wins comme les autres attributs non-coordonnées).

**Tests :**
- API : 225 + 2 (apply-cascade : projectName prime sur ENTSOE/Registry, override bat projectName) + 0 (les fixtures existantes couvrent le reste) = **227/227**.
- Web : 85 + 3 (NodeDetails : chip affiché quand distinct, chip caché quand identique, ligne envName rendue) = **88/88**.
- Nouveau check d'intégration dans `full-ingestion-v2.spec.ts` : les nodes RTE EP2 et CD1 ressortent avec `projectName` = `INTERNET-EP2` / `INTERNET-CD` et `envName = INTEG_OPF_V2`.

**Breaking changes :**
- `GraphNode` gagne 2 champs non-nullables dans le wire-format (mais tolérance `null`). Les clients qui typent `GraphNode` doivent mettre à jour.
- Les anciens dumps CD persistés avant cette version ont un composant synthetic avec `eic = "1"` ; l'ingestion d'un nouveau dump CD dans le même env ne viendra PAS écraser cette ligne (EIC différent). Recommandation : purger les imports CD legacy via `/admin > Danger Zone` avant de ré-ingérer.

### v2.0-alpha.9 — Slice 2h Migration fixtures vers EXPORT/ (2026-04-23)

Rétire les 2 anciens dossiers fixtures `17V...2026-04-17T21_27_17Z/` et `17V...2026-04-17T22_11_50Z/` (dont le contexte métier — nom du composant, environnement — avait été perdu) et bascule toute la suite de tests sur la nouvelle arborescence `tests/fixtures/EXPORT/PRFRI-*/`. Première pierre du plan d'enrichissement de la carte : les dumps sont désormais accompagnés de leur fichier `<EIC>-configuration.properties` (source future pour `ecp.projectName` / `ecp.envName`).

**Highlights :**

- **Nouvelle arborescence fixtures** : 7 dumps PRFRI (1 CD + 6 endpoints) dans `tests/fixtures/EXPORT/PRFRI-{CD1,CWERPN,EP1,EP2,PCN-EP1,PCN-EP2,PCN-EP3}/`. Chaque dossier contient le zip brut ECP **et** son `<EIC>-configuration.properties` (tracked, non-sensible).
- **`.gitignore` durci** : ajout de `tests/fixtures/EXPORT/**/*.zip` pour empêcher tout commit accidentel de zip — les zips contiennent les CSVs sensibles (`local_key_store.csv`, etc.) qu'un pattern CSV ne peut pas filtrer une fois empaquettés.
- **`apps/api/test/fixtures-loader.ts` refactorisé** : lecture du zip via `AdmZip` en mémoire (au lieu de `readdirSync` sur dossier décompressé), filtrage des CSVs sensibles, résolution `fixtureName → sous-dossier EXPORT/PRFRI-*/` via table statique. Constantes `ENDPOINT_FIXTURE` et `CD_FIXTURE` mises à jour avec les nouveaux noms de zip (mêmes EICs, nouveaux timestamps 2026-04-21/22).
- **Nouvelle fonction `readFixtureProperties()`** : lit le `<EIC>-configuration.properties` associé à une fixture, prête à être consommée par les futurs tests du slice 2i (upload couplé zip + properties).
- **Helper e2e partagé** `apps/web/e2e/helpers/fixtures.ts` : remplace la duplication de `buildFixtureZip` / `EXCLUDED` dans 5 fichiers e2e (`upload-to-map`, `upload-then-map`, `select-node`, `snapshot-switch`, `multi-upload`, `env-switch`).
- **`apps/api/src/ingestion/imports.service.spec.ts`** : assertions `sourceDumpTimestamp` alignées sur le nouveau timestamp (`'2026-04-21T14:33:05.000Z'` pour l'endpoint) et noms de zip hardcodés remplacés par `${ENDPOINT_FIXTURE}.zip` / `${CD_FIXTURE}.zip` pour suivre la constante.
- **Nettoyage artefacts** : suppression de `apps/api/test/fixtures-loader.{d.ts,js,js.map}` (compilation manuelle obsolète — vitest+swc résout `./fixtures-loader.js` → `.ts` à l'exécution). Ajout au `.gitignore` : `apps/api/test/*.{js,d.ts,js.map}`.
- **Docs synchronisées** : `CLAUDE.md` section *Test fixtures* documente les 7 dumps avec projectName + envName + rôle. `.claude/rules/02-stack.md` ajoute une section *Fixtures de test* qui renvoie vers CLAUDE.md.

**Tests :**
- 222/222 API et 85/85 Web inchangés après migration (aucune régression).
- Typecheck PASS sur les 4 workspaces.
- E2E Playwright non relancés dans ce slice (les 5 specs compilent ; validation complète attendue lors du slice 2i).

**Breaking changes :** aucun pour le contrat API. Impact dev : les 2 anciens dossiers fixtures sont supprimés — toute branche en cours qui les référence doit rebase sur cette version.

### v2.0-alpha.8 — Slice 2g Registry admin UI (2026-04-20)

Onglet **Registry RTE** activé dans `/admin` avec 2 sections opérationnelles :
édition persistée des couleurs de process et vue read-only des endpoints RTE
avec handoff vers l'onglet Composants.

**Highlights :**

- **Nouvelle table Prisma** `ProcessColorOverride { process @id, color, updatedAt }`
  (migration `20260420185349_add_process_color_override`). L'overlay JSON reste
  source par défaut ; une ligne DB prend le dessus via merge côté service.
- **4 endpoints backend** sous `/api/registry/*` :
  - `GET /api/registry/process-colors` : 8 process + flag isOverride
  - `PUT /api/registry/process-colors/:process` : body `{ color }` (zod strict,
    regex `^#[0-9a-fA-F]{6}$`, erreurs typées INVALID_PROCESS / INVALID_COLOR)
  - `DELETE /api/registry/process-colors/:process` : 204, idempotent
  - `GET /api/registry/rte-endpoints` : read-only, merge overlay.rteEndpoints
    avec ComponentOverride (displayName / lat / lng prennent l'override si
    présent, flag hasOverride exposé)
- **`RegistrySettingsService`** (nouveau module `apps/api/src/registry-settings/`) :
  5 méthodes (listProcessColors, getEffectiveProcessColors, upsertProcessColor,
  resetProcessColor, listRteEndpoints).
- **`GraphService` étendu** : inject `RegistrySettingsService`, `GraphResponse.mapConfig.processColors`
  reflète désormais les surcharges DB. Aucun changement wire-format pour le
  frontend (champ `processColors` ajouté à `MapConfig` côté shared).
- **3 nouveaux composants frontend** : `RegistryAdminTab` (compose les 2
  sections), `ProcessColorsEditor` (tableau + color picker html5 + boutons
  Enregistrer / Réinitialiser, reload graph après save), `RteEndpointsTable`
  (tableau read-only + bouton Modifier par ligne).
- **Handoff UX** : click "Modifier" dans le tab Registry switche automatiquement
  vers le tab Composants et ouvre le modal `ComponentOverrideModal` pré-rempli
  avec l'EIC cible (rien de dupliqué — même modal que la slice 2c-2).
- **`AdminTabs`** : `registry.enabled: true`, tooltip "Reporté" retiré.
- **Refactor mineur `colorFor`** : accepte un param optionnel `colors: ProcessColorMap`,
  EdgePath + MapPage légende lisent depuis `graph.mapConfig.processColors` avec
  fallback sur la constante hardcoded pour le premier paint.
- **Shared types** : `RegistryColorRow`, `RegistryRteEndpointRow`, `MapConfig.processColors`.

**Tests :**
- Backend : 12 `RegistrySettingsService` + 6 `RegistryAdminController` +
  1 test intégration GraphService override colors = **19 nouveaux** (222/222 total)
- Frontend : 3 `ProcessColorsEditor` + 2 `RteEndpointsTable` + 1 `RegistryAdminTab`
  + 1 `AdminPage` (handoff registry → components) = **7 nouveaux** (85/85 total)

**Breaking changes :** aucun. `MapConfig` gagne un champ `processColors` mais il
est toujours rempli par le backend ; les anciens clients continuent à ignorer
le champ.

### Maintenance — Cleanup dette tech v2.0 (2026-04-20, PR #14)

Trois incohérences détectées lors de la sync doc post-implémentation sont corrigées.

- **`ImportsController.list()`** : type de retour public corrigé (`Promise<ImportSummary[]>` -> `Promise<ImportDetail[]>`). Aucun changement wire-format — le service renvoyait déjà `ImportDetail[]` et le frontend le typait correctement.
- **`RegistryService.resolveComponent()`** supprimé : méthode morte (aucun appelant runtime depuis slice 2a, seuls les tests la consommaient). Type `ResolvedLocation` et 5 tests associés supprimés.
- **Specs `api/common/`** alignées : `SnapshotNotFoundException` / `SNAPSHOT_NOT_FOUND` -> `ImportNotFoundException` / `IMPORT_NOT_FOUND` (le code avait été renommé dès 2a, seule la doc restait désynchronisée).

**Impact tests :** 208 -> 203 API (5 tests `resolveComponent` supprimés), 78/78 web inchangés, typecheck PASS.
**Breaking changes :** aucun. Contrat API externe inchangé.

### Docs — Sync post-implémentation v2.0 (2026-04-20, PR #13)

Réécriture complète de `docs/specs/` pour refléter le code v2.0 mergé via PRs #6-#12.

- **16 specs créées** : `api/imports`, `api/overrides`, `api/admin`, `api/envs`, `web/admin`, `web/timeline-slider`, `web/env-selector`, `web/upload-batch-table` (spec-technique + spec-fonctionnel chacune).
- **12 specs réécrites** (v1 -> v2) : `api/ingestion` (pipeline v2 + DumpTypeDetector + routing 3 types), `api/graph` (compute-on-read + cascade 5 niveaux), `api/registry` (resolveEic, rteEicSet, mapConfig), `web/map` (divIcons Lucide + Polyline Bézier + timeline), `web/upload` (multi-file + inspect + batch), `shared/types`.
- **4 specs mises à jour mineur** : `api/common`, `web/detail-panel` (version 2.0.0 + références BDD v2).
- **4 specs supprimés** (obsolètes) : `api/snapshots/`, `web/snapshot-selector/`.
- **2 nouveaux documents d'architecture** : `docs/architecture/database/schema.md` (7 tables Prisma v2 + diagramme ASCII), `VERSIONNING.md` (historique versions v1.0 -> v2.0-alpha.7).

### v2.0-alpha.7 — Slice 2e Zone danger + Annuaire ENTSO-E (2026-04-20)

Deux onglets admin activés : **⚠ Zone danger** (3 purges avec typing-to-confirm) et **Annuaire ENTSO-E** (upload CSV officiel).

**Highlights :**

- **3 endpoints purge** : `DELETE /api/admin/purge-imports` (deletedCount + unlink zips disque), `DELETE /api/admin/purge-overrides`, `DELETE /api/admin/purge-all` (imports + overrides + entsoe).
- **2 endpoints ENTSO-E** : `POST /api/entsoe/upload` (multipart CSV, max 5 MB, parse format standard `EicCode;EicDisplayName;EicLongName;…;MarketParticipantIsoCountryCode;EicTypeFunctionList`) + `GET /api/entsoe/status` (count + refreshedAt).
- **`DangerService`** et **`EntsoeService`** backend dans `apps/api/src/admin/`.
- **`DangerZoneTab`** frontend avec typing-to-confirm : mot-clé `PURGER` pour les 2 purges ciblées, `RESET` pour le reset total. Modal bloquante + bouton confirmer disabled tant que le mot n'est pas exact.
- **`EntsoeAdminTab`** frontend : status display (count + dernier refresh) + upload `<input type=file>` + bouton.
- **AdminTabs** : `entsoe` et `danger` passent à `enabled: true` ; `registry` reste disabled (reporté, YAGNI — l'overlay JSON reste éditable via commit git).

**Tests :**
- Backend : 3 `DangerService` + 4 `EntsoeService` + 6 `AdminController` = 13 nouveaux (208/208 total)
- Frontend : 3 `EntsoeAdminTab` + 4 `DangerZoneTab` = 7 nouveaux

**Breaking changes :** aucun. Registry admin tab reste disabled avec tooltip "Reporté".

### v2.0-alpha.6 — Slice 2d Timeline slider UI (2026-04-20)

**Curseur temporel** au-dessus de la carte permet de rejouer l'état du réseau à une date passée. Chaque cran du slider = une `effectiveDate` distincte parmi les imports de l'env actif.

**Highlights :**

- **`TimelineSlider`** : composant React avec `<input type="range">` affichant N crans (1 par `effectiveDate` distincte), label "maintenant" à droite par défaut.
- **Store Zustand étendu** : `refDate: Date | null` (non persisté, session-only) + `setRefDate(date | null)` qui déclenche `loadGraph(env, date)`.
- **Bouton "⟲ Retour au présent"** visible quand `refDate !== null`.
- **Intégration `MapPage`** : slider inséré au-dessus de la zone `NetworkMap + DetailPanel`.
- **Backend** : zéro changement — `GET /api/graph?env&refDate` supporte déjà `refDate` depuis 2a.

**Tests :**
- 3 tests store (default null, setRefDate triggers loadGraph, setRefDate(null) clears)
- 4 tests `TimelineSlider` (hidden if <2 dates, "maintenant" label, formatted date label, retour présent button)

**Breaking changes :** aucun.

### v2.0-alpha.5 — Slice 2c-2 Admin composants surcharge EIC (2026-04-20)

**Onglet Composants** activé dans `/admin`. Permet à l'admin de surcharger manuellement les métadonnées d'un EIC (nom, type, organisation, pays, coordonnées, tags, notes). Répond au besoin concret : corriger les positions des composants qui tombent à Bruxelles par défaut (MONITORING, TSOs non-RTE, etc.).

**Highlights :**

- **3 endpoints backend** : `GET /api/admin/components` (liste EICs des imports + cascade + override), `PUT /api/overrides/:eic` (upsert zod strict 8 champs nullable), `DELETE /api/overrides/:eic` (retire).
- **Upsert idempotent via PUT** (ADR-036) : l'admin envoie l'état souhaité pour un EIC. Champs nullable = fallback cascade niveau 2+.
- **`OverridesService.listAdminComponents`** : réutilise `mergeComponentsLatestWins` + `applyCascade` du graph module pour calculer le `current` après cascade. Retourne `AdminComponentRow[]` triés par EIC.
- **`ComponentsAdminTable`** : liste des EICs rencontrés (dédupée), recherche sur EIC/nom/organisation/pays, toggle "Seulement surchargés", click pour ouvrir la modale.
- **`ComponentOverrideModal`** : 8 inputs (text, select, number, textarea), placeholders affichent les valeurs cascade courantes, submit ne PUT que les champs modifiés (diff-only patch), bouton "Retirer surcharge" avec confirm.
- **Types shared** : `AdminComponentRow`, `OverrideUpsertInput`.
- **ADR-036** : PUT upsert retenu vs POST+PATCH (idempotence + cohérence EIC PK).

**Tests :**
- Backend : 5 tests `OverridesService.upsert/delete` (create/update/null/404) + 3 tests `listAdminComponents` (empty, with imports, with overrides merged) + 6 tests `OverridesController` (routes + reject invalid body) = 14 nouveaux tests API (26 suites, 195/195 tests PASS)
- Frontend : 4 tests `ComponentsAdminTable` (render, search, filter surchargés, modal open) + 4 tests `ComponentOverrideModal` (title, save partial, retire visible, delete flow) = 8 nouveaux tests web (64/64 total)

**Breaking changes :** aucun.

### v2.0-alpha.4 — Slice 2c-1 Admin panel onglet Imports (2026-04-19)

**Panneau d'administration** accessible via le lien `Admin` du header. Répond à la demande du gros spec fonctionnel : *« Un panneau d'administration centralise upload, surcharge des données, gestion du registry, purge »*.

Cette slice livre uniquement **l'onglet Imports** (les 4 autres onglets sont visibles mais désactivés avec tooltip vers leur slice d'origine). Split original de la slice 2c en **2c-1 (imports)** et **2c-2 (composants surcharge — à venir)**.

**Highlights :**

- **Route `/admin`** avec `AdminTabs` à 5 onglets (Imports actif + 4 stubs désactivés).
- **`ImportsAdminTable`** : liste complète des imports avec filtre par `envName`, recherche texte client-side (label / fileName / sourceEic), édition inline du `label` (debounced 500ms) et de `effectiveDate` (onBlur), delete avec modale de confirmation custom.
- **Nouveau endpoint `PATCH /api/imports/:id`** : zod strict à 2 champs (`label`, `effectiveDate`), refuse tout extra (`dumpType`, `envName`, etc.) et body vide. Code `INVALID_BODY` sur erreur.
- **`GET /api/imports` étendu** : retourne désormais `ImportDetail[]` (superset de `ImportSummary`, ajoute `stats` et `warnings`) — évite un 2e fetch côté admin. Rétrocompatible côté callers existants.
- **Header** : lien `+ Importer` remplacé par `Admin`. L'upload reste accessible via le bouton « + Importer des dumps » dans `/admin`.
- **ADR-035** : `dumpType` immutable post-ingest (corriger un type mal détecté = delete + re-upload).

**Tests :**
- Backend : 2 tests `listImports` (stats + ordering) + 4 tests `updateImport` (label, date, combined, not found) + 6 tests `controller.update` (happy path × 2, reject extras × 2, reject invalid date, reject empty body) = 12 nouveaux tests API
- Frontend : 3 tests `AdminTabs`, 1 test `AdminPage` smoke, 5 tests `ImportsAdminTable`, 3 tests `debounce` = 12 nouveaux tests web

**Breaking changes :** aucun. L'élargissement de `listImports` vers `ImportDetail[]` est rétrocompatible.

### v2.0-alpha.3 — Slice 2f Icônes différenciées + badge isDefaultPosition (2026-04-19)

**Icônes cartographiques différenciées par type de composant ECP.** Répond à la demande initiale n°4 de l'utilisateur : distinguer visuellement broker / CD / endpoint sur la carte (plus juste un rond uniforme).

**Highlights :**

- **`buildNodeDivIcon(kind, isDefault, selected)`** : factory pure qui construit un `L.DivIcon` avec icône Lucide centrée (14px blanc) dans un cercle coloré (24px) selon le `NodeKind` :
  - `RTE_ENDPOINT` → `Zap` rouge `#e30613`
  - `RTE_CD` → `Network` rouge foncé `#b91c1c`
  - `BROKER` → `Router` noir `#111827`
  - `EXTERNAL_CD` → `Network` gris très foncé `#1f2937`
  - `EXTERNAL_ENDPOINT` → `Zap` gris `#6b7280`
- **Badge `⚠` orange `#f97316`** overlay coin bas-droit du marker quand `isDefaultPosition = true` (fallback Bruxelles). Tooltip enrichi d'une ligne explicite.
- **Halo bleu** `box-shadow` à la sélection, à la place de l'agrandissement de rayon v2a.
- **`NodeMarker`** réécrit : `CircleMarker` → `Marker + divIcon`. Couleurs conservées, pas de couleur par process sur les nodes (couleur process reste uniquement sur les edges).
- **Règle CSS globale** pour neutraliser le fond/bordure par défaut de `.leaflet-div-icon`.
- **4 tests unit** isolés sur `node-icon.tsx` (factory pure), pas de test React-Testing-Library sur `NodeMarker` (ROI faible, Leaflet context trop lourd à mocker).
- **1 ADR** : ADR-034 (divIcon + renderToStaticMarkup).

**Breaking changes :** aucun côté API ou shared. Le changement est purement visuel côté front.

**Performance :** `renderToStaticMarkup` est appelé une fois par marker à chaque update de props ; acceptable pour <500 markers. Si le graph grandit au-delà, envisager un cache par `(kind, isDefault, selected)`.

### v2.0-alpha.2 — Slice 2b Multi-upload + Detection fiable + Parser CD (2026-04-19)

**Multi-upload avec preview et confirmation** + **détection fiable** du type de dump basée sur la signature documentée ECP Admin Guide §4.20 + **parser CD complet** (`CsvPathReader`) qui lit directement `message_path.csv` (pas de XML côté CD).

**Highlights :**

- **DumpTypeDetectorV2** : inspection des noms de fichiers dans le ZIP (`synchronized_directories.csv` → CD, `messaging_statistics.csv` → ENDPOINT, `broker.xml` → BROKER, fallback CD). Retourne `{ dumpType, confidence: HIGH|FALLBACK, reason }` pour traçabilité frontend. Remplace la v1 naïve de 2a qui inspectait le contenu XML.
- **`ZipExtractor.listEntries`** : nouvelle méthode qui énumère les fichiers du ZIP sans charger les contenus en mémoire (utilisée par le détecteur + inspection).
- **CsvPathReaderService** : parser dédié `message_path.csv`, explose `allowedSenders × receivers` en N×M paths logiques. Supporte séparateurs `|`, `,`, `;` en fallback. Warnings pour `transportPattern` inconnu ou receivers vide.
- **`CsvReader.readMessagePaths`** : nouvelle méthode pour lire les paths CD au format CSV tabulaire.
- **ImportBuilder.buildFromCdCsv** : méthode dédiée dumps CD (composants depuis CSV pur, paths via `CsvPathReader`, stubs BROKER pour `intermediateBrokerCode` inconnus). Le type composant est inféré (`componentCode == id` → COMPONENT_DIRECTORY, sinon ENDPOINT).
- **Routing dans `ImportsService.createImport`** : branche ENDPOINT (pipeline v2a XML inchangé) / CD (pipeline 2b CSV) / BROKER (metadata-only avec warning `BROKER_DUMP_METADATA_ONLY`).
- **POST /api/imports/inspect** : preview multi-fichiers sans persistance (max 20 × 50MB par requête, check dédup scoped par env, retourne `InspectResult[]`).
- **POST /api/imports** étendu : `replaceImportId?` pour supprimer l'ancien puis créer le nouveau, avec validation `REPLACE_IMPORT_MISMATCH` si env diffère et `IMPORT_NOT_FOUND` si id inconnu.
- **UploadPage refondue** : dropzone `multiple: true` (max 20 fichiers), composant `UploadBatchTable` pour preview/édition (override dumpType, edit label, toggle Remplacer), bouton « Importer tout (N prêts) », résumé final avec lien vers la carte.
- **Store Zustand slice `uploadBatch`** : states `pending-inspect | inspected | uploading | done | skipped | error`, submit best-effort transactionnel par fichier. Non persisté entre sessions.
- **Tests** : 169 tests API (24 suites) + 40 tests web + 1 E2E Playwright (`multi-upload.spec.ts`). Typecheck api + web + shared PASS.
- **3 ADRs** : ADR-031 (détecteur via signatures CSV), ADR-032 (parser CD indépendant XML), ADR-033 (batch best-effort).

**Breaking changes :**
- Signature `detectDumpType` change : `(zipEntries, override?)` au lieu de `(csvRows, override)`. Callers internes mis à jour.
- Type `InspectResult` ajouté dans `@carto-ecp/shared`.
- `CsvReader.readMessagePaths` (buffer) renommée en `readEndpointMessagePaths` pour lever le conflit avec la nouvelle `readMessagePaths(extracted, warnings)` qui lit `message_path.csv` des CDs.

**Docs référencées :**
- `docs/officiel/ECP Administration Guide v4.16.0.pdf §4.20` — signature des tables backup par type de composant.
- `docs/officiel/ECP System Design v4.16.0.pdf §9.2.2` — Broker ne persiste pas en base SQL (file-system backup).

### v2.0-alpha.1 — Slice 2a Fondations (2026-04-19)

**Refonte architecturale majeure du modèle de données et du pipeline ECP.** L'hypothèse v1.2 « 1 snapshot = 1 vue complète du réseau » est remplacée par une logique cumulative : la carte agrège désormais `N imports` successifs par environnement, avec résolution à la lecture (compute-on-read) et cascade de priorité à 5 niveaux.

**Highlights :**

- **Nouveau modèle Prisma** : tables `Import`, `ImportedComponent(+Url)`, `ImportedPath`, `ImportedMessagingStat`, `ImportedAppProperty` (contributions brutes conservées) + `ComponentOverride` (surcharge admin globale par EIC, cross-env) + `EntsoeEntry` (annuaire ENTSO-E embarqué, vide en 2a). `lat/lng` nullable — fallback Bruxelles appliqué au rendu.
- **Pipeline d'ingestion refondu** : `ZipExtractor → CsvReader → XmlMadesParser → DumpTypeDetector (nouveau) → ImportBuilder (nouveau) → RawPersister (nouveau)`. La résolution registry est **déplacée au read** pour garantir la rétroactivité des changements de registry.
- **GraphService compute-on-read** : 3 fonctions pures isolées et testables (`mergeComponentsLatestWins`, `applyCascade` 5 niveaux, `mergePathsLatestWins`) composées à chaque requête. Timeline prête côté backend via `refDate` (slider front en slice 2d).
- **Cascade de priorité 5 niveaux par champ** : `ComponentOverride` > `EntsoeEntry` > registry RTE > latest-import > default Bruxelles.
- **Frontière `envName` first-class** : imports scopés par env, rendu carte scopé par env, overrides/ENTSO-E/registry globaux. Aucune fusion cross-env.
- **Nouveaux endpoints API** : `POST /api/imports`, `GET /api/imports[?env]`, `DELETE /api/imports/:id`, `GET /api/graph?env&refDate`, `GET /api/envs`. Endpoints legacy `/api/snapshots*` supprimés (reset DB total, dev-local).
- **Front refondu** : route `/` = carte (empty state différencié), `/map` redirige vers `/`, `/upload` conservé comme entrée secondaire. Nouveau `EnvSelector` component remplace `SnapshotSelector`. Store Zustand refondu (`activeEnv` persisté, suppression `activeSnapshotId`).
- **Tests** : 121 tests api (16+ suites dont 3 intégration) + 33 tests web + 3 E2E Playwright (empty-state, upload-then-map, env-switch). `typecheck` api + web + shared PASS.
- **ADRs fondateurs** : 7 ADRs rédigés en amont (ADR-023 à ADR-028, ADR-030).
- **Migrations Prisma** : `20260419135633_v2_fondations_raw_tables` + `20260419150916_drop_redundant_envname_index`.

**Breaking changes (dev-local uniquement) :**

- Schéma Prisma remplacé intégralement. Reset total de `dev.db`. Les anciens zips sous `storage/snapshots/` sont orphelins (dossier supprimable manuellement, le nouveau chemin est `storage/imports/`).
- Endpoints `/api/snapshots*` supprimés sans couche de compat.
- Types shared `SnapshotSummary` / `SnapshotDetail` supprimés au profit de `ImportSummary` / `ImportDetail`.

**Non-inclus (reporté aux slices suivantes, voir chapeau v2.0 §7) :**

- Upload multi-fichiers + détection auto avancée (slice 2b)
- Panneau admin (Imports + Composants + surcharge EIC) (slice 2c)
- Timeline slider UI (slice 2d)
- Refresh ENTSO-E + registry admin + purges (slice 2e)
- Icônes différenciées par type (slice 2f)

### Added

- **v2-2a T1 — 7 ADRs fondateurs slice 2a** : `docs/adr/ADR-023` (raw + compute on read), `ADR-024` (cascade 5 niveaux par champ), `ADR-025` (clé path 5 champs sans tri canonique), `ADR-026` (`effectiveDate` pilotante), `ADR-027` (`envName` first-class), `ADR-028` (suppression endpoints legacy `/api/snapshots*`), `ADR-030` (heuristique `DumpTypeDetector`). Commits `d948e2e`, `49f4148`, `08d068c`.
- **v2-2a T2 — Schéma Prisma v2.0 raw tables + reset DB** : réécriture intégrale de `apps/api/prisma/schema.prisma` avec 8 modèles nouveaux (`Import`, `ImportedComponent`, `ImportedComponentUrl`, `ImportedPath`, `ImportedMessagingStat`, `ImportedAppProperty`, `ComponentOverride`, `EntsoeEntry`). Migration `20260419135633_v2_fondations_raw_tables` appliquée. Types shared `ImportSummary`/`ImportDetail` ajoutés dans `packages/shared/src/graph.ts`. `SnapshotSummary`/`SnapshotDetail` supprimés. `lat`/`lng` rendus nullable sur `ImportedComponent` — le fallback Bruxelles sera appliqué au rendu via la cascade, plus à l'ingestion. Commit `59ed9de`.
- **v2-2a T3 — `filename-parser`** : fonction pure `parseDumpFilename()` extrait `{ sourceComponentEic, sourceDumpTimestamp }` des noms de fichier canoniques `{EIC}_{timestamp}.zip`. 5/5 tests. Commit `e6cf20f`.
- **v2-2a T4 — `DumpTypeDetector`** : heuristique 2a — présence `<?xml` dans un champ CSV → `ENDPOINT`, sinon `COMPONENT_DIRECTORY`. `BROKER` seulement via override explicite. 4/4 tests. Commit `818ec83`.
- **v2-2a T5-T7 — `ImportBuilderService`** : service sans DI, 4 méthodes pures. `buildFromLocalCsv` (contribution brute depuis CSV, sans cascade registry), `buildFromXml` (extraction composants + paths + stubs BROKER depuis le blob XML MADES, adapté à la structure réelle `MadesTree`), `buildMessagingStats` (parsing dates/numbers/booléens), `buildAppProperties` (filtrage regex clés sensibles case-insensitive). 9/9 tests. Commits `5335608`, `1e4c4c4`, `8becefa`.
- **v2-2a T8 — `RawPersisterService`** : écriture transactionnelle Prisma des `Import` + `ImportedComponent[]` + `ImportedComponentUrl[]` + `ImportedPath[]` + `ImportedMessagingStat[]` + `ImportedAppProperty[]`. Repackaging zip sans fichiers sensibles (P3-1 conservé). Cleanup zip disque sur rollback (P3-6 conservé). Zips archivés sous `storage/imports/{uuid}.zip`. 2/2 tests. Commit `4a078ba`.
- **v2-2a T9 — `ImportsService`** : orchestrateur pipeline (zip → csv → xml → detector → builder → persister). `createImport(input)` avec SHA256 du file buffer, dédup composants CSV↔XML (XML prioritaire), `effectiveDate = sourceDumpTimestamp ?? new Date()`. `listImports(env?)` + `deleteImport(id)` cascade + unlink zip. 3/3 tests. Commit `bdf2017`.
- **v2-2a T10 — `ImportsController`** : `POST /api/imports` (multipart) + `GET /api/imports?env=X` + `DELETE /api/imports/:id` (204). Validation zod `{envName, label, dumpType?}` + MIME check + magic bytes ZIP + limite 50 MB. 9/9 tests. Commit `a2f3d99`.

### Removed

- **v2-2a T11 — Suppression SnapshotsModule + legacy ingestion** : `apps/api/src/snapshots/` (module, controller, service, DTOs), `NetworkModelBuilderService`, `SnapshotPersisterService`, `IngestionService` (legacy orchestrateur), `SnapshotNotFoundException` renommée en `ImportNotFoundException`. Tests d'intégration v1.2 (`full-ingestion-cd`, `full-ingestion-endpoint`, `full-graph-endpoint`, `snapshots-controller`) supprimés — seront remplacés en T18-T19. `IngestionModule` recâblé avec les 6 nouveaux providers + `ImportsController`. 13 suites / 89 tests verts. Commit `18a090e`.

### Added — Phase 3+4 GraphService compute-on-read

- **v2-2a T12 — `mergeComponentsLatestWins`** : fonction pure dans `apps/api/src/graph/merge-components.ts` qui agrège les `ImportedComponent` par EIC, champ par champ, en privilégiant le latest `effectiveDate`. Les champs null ne remplacent jamais un non-null. `isDefaultPosition` passe à `false` dès qu'un import fournit des coord explicites (one-way latch). URLs : latest-wins sur l'ensemble. 6/6 tests. Commit `f2e4112`.
- **v2-2a T13 — `applyCascade`** : fonction pure dans `apps/api/src/graph/apply-cascade.ts` implémentant la cascade 5 niveaux par champ (override admin > ENTSO-E > registry RTE > merged-import > default Bruxelles). Helper `pickField(...values)` retourne la première valeur non-null. `isDefaultPosition = true` ssi lat/lng viennent du fallback. 7/7 tests. Commit `374205c`.
- **v2-2a T14 — `mergePathsLatestWins`** : fonction pure dans `apps/api/src/graph/merge-paths.ts` qui dédup les `ImportedPath` par clé 5 champs `(receiver, sender, messageType, transportPattern, intermediateBroker)` sans tri canonique. Latest `effectiveDate` gagne sur `validFrom/validTo/isExpired`. `process` laissé non-classifié (délégué au `GraphService`). 7/7 tests. Commit `26ab602`.
- **v2-2a T15 — `GraphService.getGraph(env, refDate?)` compute-on-read** : réécriture intégrale. Assemble `mergeComponentsLatestWins` → `applyCascade` → `mergePathsLatestWins` → `buildEdges` à chaque requête. `classifyMessageType` appliqué au read (garantit rétroactivité registry). `isRecent` calculé relativement au `effectiveDate` du latest import (reproductible historique). `RegistryService.resolveEic(eic)` ajoutée pour la cascade niveau 3. `mapConfig.defaultLat/defaultLng` (Bruxelles 50.8503, 4.3517) ajoutés dans `eic-rte-overlay.json` + type `MapConfig`. 6/6 tests intégration + 108/108 total. Commit `0b71665`.
- **v2-2a T16 — `GraphController GET /api/graph?env&refDate`** : nouvelle route avec validation query params (env requis, refDate ISO optionnel, 400 sur invalid). 5/5 tests + typecheck api PASS. Commit `2a7d30c`.
- **v2-2a T17 — `EnvsController GET /api/envs`** : endpoint liste distincte des `envName` présents dans la table `Import`, trié alphabétiquement. Nouveau module `EnvsModule` registered dans `AppModule`. 2/2 tests. Commit `c260f2d`.
- **v2-2a T18-T19 — Tests d'intégration v2** : `full-ingestion-v2.spec.ts` (upload 2 fixtures ENDPOINT+CD, agrégation sans doublons EIC, bounds cohérents, liste imports), `env-isolation.spec.ts` (2 envs indépendants, suppression OPF n'affecte pas PROD), `import-deletion.spec.ts` (cascade delete + zip unlink + NotFoundException sur id inconnu). 8 tests intégration verts / 121 tests total. Commits `28a0cb2`, `2d6bca5`.

### Added — Phase 5 Frontend

- **v2-2a T20 — Client API web v2** : `apps/web/src/lib/api.ts` réécrit pour `listEnvs`, `listImports(env?)`, `createImport(file, envName, label, dumpType?)`, `deleteImport(id)`, `getGraph(env, refDate?)`. URLSearchParams pour les query strings. Suppression des méthodes legacy `createSnapshot`/`listSnapshots`/`getGraph(id)`. Commit `7bcd34c`.
- **v2-2a T21 — Store Zustand refonte** : state `activeEnv` (persisté) + `envs` + `imports` + `graph`. Suppression de `activeSnapshotId`/`snapshots`/`setActiveSnapshot`. `loadEnvs()` avec fallback intelligent (persisted → premier env → null). `setActiveEnv()` parallèle `loadImports + loadGraph`. 5/5 tests. Commit `7e41a15`.
- **v2-2a T22 — `EnvSelector` component** : composant `<select>` synchronisé avec le store, fallback « Aucun env » si liste vide. Remplace `SnapshotSelector`. 4/4 tests. Commit `0ecfcc1`.
- **v2-2a T23 — `MapPage` empty state + consommation activeEnv** : route `/` entrée principale. Empty state différencié (pas d'env vs pas de composants). CTA « Importer un dump » vers `/upload?env=X`. `loadEnvs()` au mount. Commit `fbfae71`.
- **v2-2a T24 — `UploadPage` adaptations v2** : appelle `api.createImport`, lit `envName` depuis `?env=X` (default `OPF`), déclenche `loadEnvs()` post-succès, redirige vers `/`. Affiche `dumpType` et warnings. 10/10 tests. Commit `9661ff2`.
- **v2-2a T25 — `App.tsx` routes refondues** : `/` = MapPage, `/map` → redirect `/`, `/upload` = UploadPage, `*` → `/`. Header : titre + `EnvSelector` + lien `+ Importer`. **Suppression complète du dossier `SnapshotSelector/`**. 33/33 tests web + typecheck web PASS. Commit `0f136e3`.
- **v2-2a T26-T28 — 3 E2E Playwright** : `empty-state.spec.ts` (purge via API + vérif empty state + CTA), `upload-then-map.spec.ts` (upload fixture ENDPOINT → redirect `/` → marker leaflet visible), `env-switch.spec.ts` (2 uploads dans 2 envs → switch via selector, skip dynamique si <2 envs). Localisation confirmée à `apps/web/e2e/`. Commit `28fcc13`.

### Changed

- **v2-2a dette — Suppression index redondant `Import.envName`** : l'index simple `@@index([envName])` est couvert par le composite `@@index([envName, effectiveDate])` via leftmost-prefix scan B-tree. Migration `20260419150916_drop_redundant_envname_index` appliquée. Détecté par code-review quality de T2. Commit `14a6866`.

- **P3-1 — Re-packaging zip sans fichiers sensibles** : `SnapshotPersisterService.repackageWithoutSensitive(buffer)` retire `local_key_store.csv`, `registration_store.csv` et `registration_requests.csv` du zip avant écriture sur disque. Le zip archivé dans `storage/snapshots/` ne contient plus de données sensibles ECP.
- **P3-2 — Seuil `isRecent` configurable via env var** : `GraphService` lit `ISRECENT_THRESHOLD_MS` (défaut : `86400000` = 24h) via `parseThreshold()` dans le constructeur. Configurable sans modification du code pour les processus basse fréquence (UK-CC-IN, TP).
- **P3-3 — Pré-calcul `rteEicSet` dans `RegistryService`** : le `Set<string>` des EICs RTE est construit une seule fois dans `onModuleInit()` et exposé via `getRteEicSet()`. `NetworkModelBuilderService` consomme `this.registry.getRteEicSet()` au lieu de reconstruire le set à chaque appel de `build()`.
- **P3-4 — `mapConfig` externalisé dans `GraphResponse`** : `RegistryService` expose `getMapConfig()` depuis `eic-rte-overlay.json#mapConfig`. `GraphService` inclut `mapConfig` dans le `GraphResponse`. `useMapData.ts` consomme `graph.mapConfig` (plus de constantes `PARIS_LAT/PARIS_LNG/OFFSET_DEG` hardcodées). Nouveau type `MapConfig` dans `packages/shared/src/graph.ts`.
- **P3-5 — ADR-022 nestjs-zod (documentation)** : `docs/adr/ADR-022-nestjs-zod-validation-strategy.md` documente la décision de standardiser `nestjs-zod` pour les futurs endpoints (commit b6024f6).
- **P3-7 — Nettoyage whitelist `USABLE_CSV_FILES`** : `message_type.csv` et `message_upload_route.csv` retirés de `USABLE_CSV_FILES` dans `apps/api/src/ingestion/types.ts`. La whitelist reflète désormais exactement les CSV lus et parsés par le pipeline.

- **P1-1 — ESLint 9 flat config** : configs `eslint.config.mjs` créées pour `apps/api` et `apps/web` (suppression du legacy `.eslintrc.cjs`). Ruleset `recommended` + 5 règles type-aware (`consistent-type-imports`, `no-floating-promises`, `no-misused-promises`, `await-thenable`, `no-unused-vars`). Overrides permissifs pour les fichiers `spec/test`. 12 devDependencies ESLint ajoutées.
- **P1-3 — Garde-fou anti-désynchro palette** : `apps/web/src/lib/process-colors.sync.test.ts` — 2 tests Vitest qui lisent `packages/registry/eic-rte-overlay.json` et comparent les clés + valeurs hex avec `PROCESS_COLORS` du TS.
- **P2-1 — Tests unitaires api/snapshots** : 10 nouveaux cas Vitest dans `apps/api/src/snapshots/snapshots.controller.spec.ts` et `apps/api/src/snapshots/snapshots.service.spec.ts` couvrant : rejet MIME invalide, magic bytes erronés, label vide, 404 sur snapshot inexistant, list avec filtre envName, detail nominal. Suite api passe de 61 à 71 tests.
- **P2-2 — Tests unitaires SnapshotPersister** : 3 nouveaux cas dans `apps/api/src/ingestion/snapshot-persister.service.spec.ts` — cas nominal, échec transaction Prisma (zip nettoyé), échec cleanup (log warning). Suite api : 71 → 74 tests.
- **P2-3 — Test d'intégration GET /graph** : `apps/api/test/full-graph-endpoint.spec.ts` — 4 cas contre les fixtures réelles (Endpoint + CD) : HTTP 200, présence nodes/edges, cohérence bounds, 404 snapshot inconnu. Suite api : 74 → 79 tests.
- **P2-4 — Tests unitaires UploadPage** : 6 cas `@testing-library/react` dans `apps/web/src/pages/UploadPage.test.tsx` : soumission OK, état loading, affichage erreur API, affichage warnings, désactivation bouton sans fichier. Suite web passe de 2 à 8 tests.
- **P2-5 — Tests unitaires DetailPanel** : 10 cas dans `apps/web/src/components/DetailPanel/NodeDetails.test.tsx` (5) et `EdgeDetails.test.tsx` (5) — rendu champs null, badges, formatage dates, badge isDefaultPosition. Suite web : 8 → 18 tests.
- **P2-6 — Tests unitaires SnapshotSelector** : 3 cas dans `apps/web/src/components/SnapshotSelector/SnapshotSelector.test.tsx` — liste vide → lien upload, liste non vide → select avec valeur active, onChange déclenche setActiveSnapshot. Suite web : 18 → 23 tests (dont 2 de app-store).
- **P2-8 — Warning structuré CSV_PARSE_ERROR** : `CsvReaderService.readRaw` retourne `{ rows, parseError }` avec `fileName` param. 4 méthodes publiques acceptent un paramètre `warnings: Warning[]`. Helper privé `pushCsvWarning`. `IngestionService` collecte les `extractionWarnings` et les fusionne dans `networkSnapshot.warnings`.
- **Stack de test React** : `apps/web/vitest.config.ts` passe à `environment: 'happy-dom'` + `setupFiles: ['./src/test-setup.ts']`. Nouveau fichier `apps/web/src/test-setup.ts` (import `@testing-library/jest-dom` + `afterEach(cleanup)`). Dépendances ajoutées : `@testing-library/react@^16`, `@testing-library/jest-dom@^6`, `@testing-library/user-event@^14`, `happy-dom@^15`.

### Changed

- **P3-4 — `useMapData` consomme `graph.mapConfig`** : les constantes `PARIS_LAT`, `PARIS_LNG`, `OFFSET_DEG` et le seuil de proximité ne sont plus hardcodés dans `useMapData.ts` — ils proviennent désormais de `graph.mapConfig` retourné par `GET /api/snapshots/:id/graph`. Suppression de la dépendance sur `eic-rte-overlay.json` dans `packages/registry`.

- **P1-2 — REGISTRY_PATH env var** : `RegistryService` déplace la résolution du chemin dans `onModuleInit()`. Lit `process.env.REGISTRY_PATH` avec fallback sur `../../packages/registry`. Suppression de la constante module-level `REGISTRY_PACKAGE_ROOT`. Log `Registry root: <path>` au boot.
- **P2-1 — ESLint web** : override étendu aux `**/*.test.{ts,tsx}` et `**/*.spec.{ts,tsx}` dans `apps/web/eslint.config.mjs` pour autoriser les patterns de test.

### Fixed

- **P1-1 — Violations JSX/TS** : 10 violations `react/jsx-no-leaked-render` corrigées (pattern `{x && <C/>}` → `{x ? <C/> : null}`) dans 6 fichiers TSX. 2 violations `no-misused-promises` corrigées dans `UploadPage.tsx` (async `onClick` wrappé avec `void`).
- **P1-4 — HTTP 500 → HTTP 400 sur CSV vide** : `IngestionService` lève désormais `InvalidUploadException` (HTTP 400, code `INVALID_UPLOAD`) au lieu d'une `Error` native quand `component_directory.csv` est vide ou absent de l'archive.
- **P2-7 — Bascule activeSnapshotId invalide** : `loadSnapshots` dans `app-store.ts` vérifie si l'`activeSnapshotId` persisté dans localStorage est encore présent dans la liste retournée (`persistedStillValid`). Si non valide et `list.length > 0`, bascule automatiquement sur `list[0]`. Si valide et graphe non chargé, déclenche `setActiveSnapshot` au boot.

### Changed

- **Phase 4 — `EdgePath` réécrit avec `<Polyline>` sampled bezier** : `EdgePath.tsx` abandonne l'approche impérative `useEffect`/`useRef`/`L.curve` au profit d'un rendu déclaratif `<Polyline positions={sampleBezier(...)} pathOptions={...} eventHandlers={...} />`. Le helper `sampleBezier` génère N+1 points intermédiaires le long de la courbe quadratique. Deux tests Vitest (`EdgePath.test.tsx`) vérifient le nombre de points et le midpoint.

### Removed

- **Phase 4 — Suppression de `leaflet-curve`** : la dépendance `leaflet-curve` est retirée de `apps/web/package.json` et `pnpm-lock.yaml`. Le stub `declare module 'leaflet-curve'` est supprimé de `apps/web/src/env.d.ts`. Dette m10 résolue.

### BDD
