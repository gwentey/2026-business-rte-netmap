# Slice 4a — Fondation du Design System RTE

**Date** : 2026-04-23
**Branche cible** : `feat/ds-rte-foundation` (depuis `main` @ `fada20e`)
**Statut** : Design validé, prêt pour `writing-plans`
**Source** : Plan global `C:\Users\ANTHONY\.claude\plans\nous-allons-devoir-faire-immutable-bachman.md`
**Version cible** : `v3.0-alpha.6`

---

## 1. Contexte

Le frontend `apps/web` n'applique aucune conformité au Design System officiel RTE. Inventaire constaté sur `main` :

- **Tailwind inliné partout**, sans tokens, sans composants UI partagés (classes `bg-rte text-white px-4 py-2` réécrites à la main dans chaque fichier).
- **7 dépendances UI jamais importées** : `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `class-variance-authority`, `clsx`, `tailwind-merge` (vérifié par grep).
- **Modales, onglets, tooltips** bricolés à la main (`<div fixed inset-0>`, `<button aria-selected>`).
- **~20 couleurs hex hardcodées** dans `Map/`, `DetailPanel/`, `Admin/`.
- **Police Inter** en fallback système sans chargement explicite (aucun `<link>`, aucun `@import`, aucune WOFF2).
- **Incohérence `#e30613` vs `#C8102E`** entre `tailwind.config.ts` et `HomeCdOverlay.tsx`.

**Objectif de la Slice 4a** (première des 5 de la migration) : poser la fondation technique pour adopter `@design-system-rte/react@^1.8.0` + `@design-system-rte/core@^1.7.0` (packages npm officiels RTE, Apache-2.0, peer `react >= 18`). Installer les packages, câbler les tokens SCSS, charger la police Nunito, retirer Tailwind. **Aucun composant métier n'est migré dans 4a** — régression visuelle temporaire assumée jusqu'à fin Slice 4b.

---

## 2. Décisions validées en brainstorming

| Sujet | Décision |
|---|---|
| Découpage 4a | **Monolithique** — régression visuelle assumée (pas de 4a.1/4a.2) |
| Définition de "done" | **Standard** — machine green + smoke manuel sur 9 checkpoints |
| Approche | **A — Foundation strict** — aucun `.tsx` métier touché |
| Remplacement Tailwind | SCSS + CSS Modules + tokens SCSS du DS (pas d'hybride Tailwind+DS) |
| Page `/dev/ui-kit` | **Non** — reportée à Slice 4b (si besoin) |
| Stub `leaflet-curve` dans `env.d.ts` | **Non pertinent** — déjà absent (CLAUDE.md périmé) |

---

## 3. Architecture cible des styles

### Pipeline CSS avant (main @ fada20e)

```
apps/web/src/main.tsx
  └─ import './styles/globals.css'
       └─ @import 'leaflet/dist/leaflet.css'
       └─ @tailwind base
       └─ @tailwind components
       └─ @tailwind utilities
       └─ html/body { font-family: Inter, system-ui, sans-serif }
       └─ .leaflet-div-icon.carto-node-marker { background: transparent; border: none }

Pipeline :
  Vite → postcss.config.cjs → tailwindcss (via tailwind.config.ts) → autoprefixer
```

### Pipeline CSS après (fin Slice 4a)

```
apps/web/src/main.tsx
  ├─ import '@design-system-rte/react/style.css'   (1) DS composants pré-stylés
  ├─ import 'leaflet/dist/leaflet.css'              (2) Leaflet map library
  ├─ import './styles/fonts.scss'                   (3) @font-face Nunito
  └─ import './styles/globals.scss'                 (4) reset + overrides projet

Pipeline SCSS (Vite natif, plus de postcss) :
  Vite → css.preprocessorOptions.scss.additionalData
       → auto-inject `@use "@/styles/tokens" as tokens;` dans chaque *.module.scss
       → sauf dans tokens.scss et fonts.scss (évite self-reference)

apps/web/src/styles/tokens.scss
  └─ @forward '@design-system-rte/core/design-tokens/main'
       └─ spacing (0→80px), radius (none→pill), typography (Nunito+Arial),
          elevation (1→6), opacity, layout, border/width, mixins shadow

apps/web/src/styles/fonts.scss
  └─ 4 × @font-face Nunito {300,400,600,700} → url('/fonts/nunito-*.woff2')

apps/web/src/styles/globals.scss
  └─ @use './tokens' as tokens
  └─ html/body { font-family: tokens.$font-family-nunito }
  └─ .leaflet-div-icon.carto-node-marker { ... }  (conservé)

Servi statiquement par Vite :
  apps/web/public/fonts/nunito-{light-300,regular-400,semi-bold-600,bold-700}.woff2
```

### Conséquences fonctionnelles

- Les 40+ fichiers `.tsx` métier n'importent rien : leurs `className="bg-rte..."` restent dans le DOM mais n'ont plus de CSS correspondant → **classes inertes**. Remplacées slice par slice en 4c/4d/4e.
- Le CSS `@design-system-rte/react/style.css` ne rend rien de visible tant qu'aucun composant DS n'est instancié (scope strict 4a).
- La police Nunito est chargée au boot, appliquée à `<html>`/`<body>` via token `$font-family-nunito`.
- Règle `.leaflet-div-icon.carto-node-marker` conservée — protège `buildNodeDivIcon()` (non migré en 4a).

---

## 4. Inventaire des fichiers

### Créés (6 fichiers + 4 WOFF2 = 10 items)

| Chemin | Contenu |
|---|---|
| `apps/web/src/styles/tokens.scss` | `@forward '@design-system-rte/core/design-tokens/main';` |
| `apps/web/src/styles/fonts.scss` | 4 × `@font-face` Nunito (poids 300/400/600/700) pointant vers `/fonts/nunito-*.woff2` |
| `apps/web/src/styles/globals.scss` | `@use './tokens' as tokens;` + reset `html/body/#root` + `.leaflet-div-icon.carto-node-marker` |
| `docs/specs/web/ds-rte-foundation/spec-fonctionnel.md` | Spec Zelian T6 |
| `docs/specs/web/ds-rte-foundation/spec-technique.md` | Spec Zelian T6 (détails techniques) |
| `docs/adr/ADR-037-adoption-design-system-rte.md` | ADR Zelian (numéro suivant, ADR-036 étant le dernier) |
| `apps/web/public/fonts/nunito-light-300.woff2` | Copié depuis `node_modules/@design-system-rte/core/assets/fonts/` |
| `apps/web/public/fonts/nunito-regular-400.woff2` | idem |
| `apps/web/public/fonts/nunito-semi-bold-600.woff2` | idem |
| `apps/web/public/fonts/nunito-bold-700.woff2` | idem |

### Modifiés (5 fichiers)

| Chemin | Changements |
|---|---|
| `apps/web/package.json` | **Add dependencies** : `@design-system-rte/react@^1.8.0`, `@design-system-rte/core@^1.7.0`. **Add devDependencies** : `sass@^1.85.1`. **Remove dependencies** : 4× `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`. **Remove devDependencies** : `tailwindcss`, `postcss`, `autoprefixer`. |
| `apps/web/vite.config.ts` | Ajout `css.preprocessorOptions.scss.additionalData` (fonction qui exclut `tokens.scss` et `fonts.scss`) |
| `apps/web/src/main.tsx` | Remplacer `import './styles/globals.css'` par 4 imports ordonnés (DS → Leaflet → fonts → globals) |
| `pnpm-workspace.yaml` | Ajouter `sass` à `onlyBuiltDependencies` **si** `pnpm install` demande un build script post-install (à vérifier, probablement non nécessaire car sass est pure-JS) |
| `CHANGELOG.md` | Ajout entrée `v3.0-alpha.6` en tête de `[Unreleased]` |

### Supprimés (3 fichiers)

| Chemin | Raison |
|---|---|
| `apps/web/tailwind.config.ts` | Tailwind retiré |
| `apps/web/postcss.config.cjs` | Plus de PostCSS (Vite SCSS natif) |
| `apps/web/src/styles/globals.css` | Remplacé par `globals.scss` |

### Explicitement non touchés

- Tous les `.tsx` de composants métier (Admin/, Map/, DetailPanel/, EnvSelector/, TimelineSlider/, UploadBatchTable/, pages/).
- `apps/web/src/env.d.ts` (déjà minimal).
- `apps/web/tsconfig.json` (alias `@` déjà configuré).
- `apps/web/src/lib/process-colors.ts` (hors scope — migré en 4c/4e).
- Tous les tests (`*.test.tsx`, `e2e/*.spec.ts`) — les sélecteurs E2E sont basés sur `.leaflet-container`, `header select`, `aside` (HTML/Leaflet natifs, inchangés).

**Diff estimé** : ~15 fichiers touchés, ~200 lignes changées.

---

## 5. Packages npm

### Installation

```bash
pnpm --filter @carto-ecp/web add @design-system-rte/react@^1.8.0 @design-system-rte/core@^1.7.0
pnpm --filter @carto-ecp/web add -D sass@^1.85.1
```

Versions choisies pour aligner avec les peer deps du DS (`sass@^1.85.1` est le minimum requis par `@design-system-rte/core`).

### Désinstallation

```bash
pnpm --filter @carto-ecp/web remove \
  @radix-ui/react-dialog @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-tooltip \
  class-variance-authority clsx tailwind-merge

pnpm --filter @carto-ecp/web remove -D tailwindcss postcss autoprefixer
```

### Conservés (non touchés en 4a)

- `lucide-react@^0.452.0` — retiré en Slice 4e uniquement
- `react-dropzone@^14.2.9` — conservé (comportement drag-drop complexe)
- `leaflet`, `react-leaflet` — cartographie
- `react`, `react-dom`, `react-router-dom`, `zustand` — cœur applicatif

---

## 6. Contenu exact des fichiers

### `apps/web/vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Auto-inject tokens dans chaque *.module.scss et *.scss,
        // SAUF tokens.scss et fonts.scss (évite références circulaires).
        additionalData: (content: string, filename: string) => {
          if (filename.endsWith('tokens.scss') || filename.endsWith('fonts.scss')) {
            return content;
          }
          return `@use "@/styles/tokens" as tokens;\n${content}`;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

### `apps/web/src/styles/tokens.scss`

```scss
// Forward tout ce que le DS RTE expose :
// - tokens publics : spacing, typography, border/radius, elevation, opacity, layout
// - abstractions : mixins neutral-shadow-*, brand-shadow-*, themes
@forward '@design-system-rte/core/design-tokens/main';
```

### `apps/web/src/styles/fonts.scss`

```scss
@font-face {
  font-family: 'Nunito';
  font-weight: 300;
  font-style: normal;
  font-display: swap;
  src: url('/fonts/nunito-light-300.woff2') format('woff2');
}

@font-face {
  font-family: 'Nunito';
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  src: url('/fonts/nunito-regular-400.woff2') format('woff2');
}

@font-face {
  font-family: 'Nunito';
  font-weight: 600;
  font-style: normal;
  font-display: swap;
  src: url('/fonts/nunito-semi-bold-600.woff2') format('woff2');
}

@font-face {
  font-family: 'Nunito';
  font-weight: 700;
  font-style: normal;
  font-display: swap;
  src: url('/fonts/nunito-bold-700.woff2') format('woff2');
}
```

### `apps/web/src/styles/globals.scss`

```scss
@use './tokens' as tokens;

html,
body,
#root {
  height: 100%;
  margin: 0;
  font-family: tokens.$font-family-nunito;
}

// Markers Carto ECP (conservé depuis globals.css) — neutralise le fond/bordure
// par défaut de .leaflet-div-icon pour laisser visible le cercle coloré de
// buildNodeDivIcon (apps/web/src/components/Map/node-icon.tsx).
.leaflet-div-icon.carto-node-marker {
  background: transparent;
  border: none;
}
```

### `apps/web/src/main.tsx`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';

// Ordre des styles — important :
import '@design-system-rte/react/style.css';  // 1. DS RTE : composants pré-stylés + reset
import 'leaflet/dist/leaflet.css';             // 2. Leaflet : pour la carte
import './styles/fonts.scss';                  // 3. Nunito @font-face
import './styles/globals.scss';                // 4. Overrides projet (passe en dernier)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

---

## 7. Documentation Zelian

### ADR-037 — squelette

```
# ADR-037 — Adoption du Design System RTE (packages npm officiels)

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | ADR-037                        |
| Statut     | Accepté                        |
| Date       | 2026-04-23                     |
| Auteur(s)  | Anthony + Claude               |
| Owner      | Anthony                        |
| Décideurs  | Anthony                        |
| Contexte   | Slice 4a — Foundation DS RTE   |
| Remplace   | —                              |
| Features   | web/*                          |
| App        | web                            |

## Contexte
(Voir section 1 du design doc)

## Options considérées
A. Adopter @design-system-rte/* + SCSS/CSS Modules + suppression Tailwind
B. Garder Tailwind + custom classes mimant le DS
C. Tailwind + DS en coexistence (hybride)

## Décision retenue
Option A. Conforme directive groupe, accès aux 41 composants DS, a11y WCAG AA, suppression de 7 deps UI mortes.

## Conséquences
### Positives
- Conformité visuelle RTE
- 41 composants accessibles
- Tokens SCSS centralisés
- Cleanup deps mortes

### Négatives
- Migration 5 slices (~15j)
- Régression visuelle temporaire 4a→fin 4b
- Table/Slider/ColorPicker absents du DS → composants maison à écrire (ADRs à venir en 4b/4c)

### Ce qu'on s'interdit désormais
- Rajouter tailwindcss ou classes Tailwind
- Importer shadcn/ui, MUI, Ant Design, etc.
- Hardcoder hex, font-size, spacing dans les composants
- Déclarer des @font-face sans WOFF2 servi depuis apps/web/public/fonts/
- Redéclarer la couleur rte dans un config

## Ressources
- https://github.com/rte-france/design-system-rte
- https://opensource.rte-france.com/design-system-rte/
- npm @design-system-rte/react, @design-system-rte/core
- Plan global : C:\Users\ANTHONY\.claude\plans\nous-allons-devoir-faire-immutable-bachman.md
- Related : ADR-034 (divIcon lucide-react markers — sera amendé en 4e)
```

### `docs/specs/web/ds-rte-foundation/spec-fonctionnel.md` — squelette

```
# Spec Fonctionnelle — web/ds-rte-foundation

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/ds-rte-foundation           |
| Version| 3.0-alpha.6                     |
| Date   | 2026-04-23                      |
| Source | Slice 4a — Foundation DS RTE    |

## ADRs
| ADR | Titre | Statut |
|---|---|---|
| ADR-037 | Adoption du Design System RTE | Actif |

## Contexte et objectif
Première des 5 slices de migration totale vers le DS RTE. Installe packages, tokens SCSS,
police Nunito, retire Tailwind. Aucun composant métier migré.

## Règles métier
- Aucun changement fonctionnel.
- Régression visuelle admise jusqu'à fin Slice 4b.
- Ordre des imports CSS dans main.tsx fixe (DS → Leaflet → fonts → globals).

## Cas d'usage
Aucun — slice infrastructure uniquement.

## Dépendances
Ajout : @design-system-rte/react@^1.8.0, @design-system-rte/core@^1.7.0, sass@^1.85.1
Retrait : tailwindcss, postcss, autoprefixer, 4× @radix-ui/*, cva, clsx, tailwind-merge

## Critères d'acceptation (DoD Standard)
Voir section 9 (plan de vérification) du design doc.
```

### `docs/specs/web/ds-rte-foundation/spec-technique.md`

Contient : diagramme pipeline CSS avant/après (section 3 du design doc), contenu exact des 3 fichiers SCSS et des modifs Vite/main.tsx (section 6), versions packages (section 5), procédure de copie WOFF2.

### CHANGELOG `v3.0-alpha.6` — entrée complète

Voir section 11 de ce design doc (entrée finale prête à coller dans `CHANGELOG.md` sous `[Unreleased]`).

---

## 8. Plan d'exécution (10 étapes)

1. **Preflight** : `git status` propre, `git checkout -b feat/ds-rte-foundation` depuis `main` @ `fada20e`.
2. **Installation DS** : `pnpm add @design-system-rte/react@^1.8.0 @design-system-rte/core@^1.7.0`, puis `pnpm add -D sass@^1.85.1`. `pnpm typecheck` passe à ce stade (Tailwind encore là).
3. **Copie WOFF2** : `mkdir -p apps/web/public/fonts && cp node_modules/@design-system-rte/core/assets/fonts/nunito-*.woff2 apps/web/public/fonts/`. Vérifier 4 fichiers présents.
4. **Création SCSS + config** : écrire `tokens.scss`, `fonts.scss`, `globals.scss`, mettre à jour `vite.config.ts` (preprocessorOptions), mettre à jour `main.tsx` (4 imports ordonnés).
5. **Suppression Tailwind** : `pnpm remove 4× @radix-ui/*, cva, clsx, tailwind-merge`, `pnpm remove -D tailwindcss postcss autoprefixer`, `rm apps/web/tailwind.config.ts apps/web/postcss.config.cjs apps/web/src/styles/globals.css`.
6. **Machine green gate (bloquant)** : `pnpm typecheck` OK, `pnpm test` OK, `pnpm test:e2e` OK, `pnpm build` OK, `pnpm --filter @carto-ecp/api test` OK (sanity).
7. **Smoke manuel** : `pnpm dev`, ouvrir http://localhost:5173, vérifier 9 checkpoints (section 9).
8. **Vérification anti-scope-creep** : `git diff main --stat` ne liste que ~15 fichiers, aucun dans `components/{Admin,Map,DetailPanel,...}/`.
9. **Rédaction docs** : ADR-037, specs fonctionnel + technique, entrée CHANGELOG.
10. **Commit + Push + PR MCP GitHub** : commit Conventional Commits français avec Co-Authored-By, push sur `origin feat/ds-rte-foundation`, PR via MCP GitHub vers `main`.

---

## 9. Critères d'acceptation (DoD Standard)

### Machine green (bloquant)

```bash
pnpm --filter @carto-ecp/web typecheck   # tsc --noEmit
pnpm --filter @carto-ecp/web test        # vitest (~144 tests)
pnpm --filter @carto-ecp/web test:e2e    # playwright (~7 specs)
pnpm --filter @carto-ecp/web build       # vite build
pnpm --filter @carto-ecp/api test        # sanity backend
```

### Smoke manuel (9 checkpoints)

`pnpm dev` puis http://localhost:5173 avec DevTools Console ouverte :

1. `GET /` → carte Leaflet visible, markers affichés, 0 erreur console
2. `GET /upload` → dropzone présent (non stylé), 0 erreur console
3. `GET /admin` → 6 onglets cliquables, 0 erreur console
4. Onglet Imports → liste charge, filtres cliquables
5. Onglet Composants → liste charge, recherche fonctionnelle
6. Onglet Organisations → liste charge, boutons Importer/Exporter visibles
7. Onglet ENTSO-E → status de l'annuaire charge
8. Onglet Registry → process colors + endpoints RTE affichés
9. Onglet Zone danger → 3 sections de purge visibles

**Bonus Nunito** : DevTools → Network filter `font` → recharger → les 4 `nunito-*.woff2` doivent être servis en 200 depuis `/fonts/`. Computed style `<body>` → `font-family: Nunito`.

### Anti-scope-creep

```bash
git diff main --stat | head -30
# Doit lister ~15 fichiers.
# Aucun fichier dans apps/web/src/components/{Admin,Map,DetailPanel,EnvSelector,TimelineSlider,UploadBatchTable}/
# Aucun fichier dans apps/web/src/pages/
```

---

## 10. Checklist Zelian

Conformément à `.claude/rules/00-global.md` :

- [ ] Branche `feat/ds-rte-foundation` créée depuis `main`
- [ ] `docs/specs/web/ds-rte-foundation/spec-fonctionnel.md` rédigé
- [ ] `docs/specs/web/ds-rte-foundation/spec-technique.md` rédigé
- [ ] `docs/adr/ADR-037-adoption-design-system-rte.md` rédigé
- [ ] Entrée `CHANGELOG.md` `v3.0-alpha.6` ajoutée en tête de `[Unreleased]`
- [ ] Tests verts (typecheck, vitest, playwright, build, api sanity)
- [ ] Smoke manuel 9/9 OK
- [ ] Anti-scope-creep vérifié (git diff stat ≤ 15 fichiers, aucun composant métier)
- [ ] Commit Conventional Commits français avec Co-Authored-By Claude Opus 4.7
- [ ] Push sur `origin feat/ds-rte-foundation`
- [ ] PR créée **via MCP GitHub** (obligatoire selon `rules/05-git-workflow.md`)
- [ ] Hook Stop déclenchera `update-writer-after-implement` automatiquement

---

## 11. Entrée CHANGELOG complète (prête à coller)

```
### v3.0-alpha.6 — Slice 4a : adoption du Design System RTE (foundation) (2026-04-23)

Installation des packages officiels `@design-system-rte/react@^1.8.0` + `@design-system-rte/core@^1.7.0` + `sass@^1.85.1`. Retrait de Tailwind CSS, PostCSS, autoprefixer, et des 7 dépendances UI mortes (`@radix-ui/react-{dialog,slot,tabs,tooltip}`, `class-variance-authority`, `clsx`, `tailwind-merge`). Mise en place du pipeline SCSS + CSS Modules + tokens DS. Police officielle Nunito chargée (4 poids : 300/400/600/700) via `apps/web/public/fonts/`.

**Highlights :**

- **Packages DS RTE installés** — `@design-system-rte/react` fournit 41 composants React (Button, TextInput, Modal, Tab, Badge, Drawer, FileUpload, ...). `@design-system-rte/core` fournit les tokens SCSS (spacing 0→80px, radius none→pill, typography Nunito/Arial, elevation 1→6, opacity, layout) et les icônes SVG Material-like. Apache-2.0.
- **Tailwind retiré totalement** — `tailwind.config.ts` et `postcss.config.cjs` supprimés. `tailwindcss`, `postcss`, `autoprefixer` retirés des devDependencies. Les classes `className="bg-rte p-4..."` dans les ~40 composants métier deviennent inertes — elles seront remplacées slice par slice en 4c/4d/4e.
- **Deps UI mortes purgées** — les 4 packages Radix UI, CVA, clsx et tailwind-merge ne sont jamais importés dans `apps/web/src/` (confirmé par grep). Retrait sans risque.
- **Pipeline SCSS** — `apps/web/src/styles/tokens.scss` (`@forward '@design-system-rte/core/design-tokens/main'`) + `apps/web/src/styles/fonts.scss` (4 `@font-face` Nunito) + `apps/web/src/styles/globals.scss` (remplace `globals.css`). Auto-import des tokens dans chaque `*.module.scss` via `vite.config.ts` `css.preprocessorOptions.scss.additionalData`.
- **Police Nunito** — 4 fichiers WOFF2 copiés dans `apps/web/public/fonts/` depuis `node_modules/@design-system-rte/core/assets/fonts/`. Servis statiquement par Vite en dev et prod. `font-display: swap` partout.
- **main.tsx** — ordre des imports CSS : DS RTE → Leaflet → fonts → globals.
- **Régression visuelle temporaire assumée** — le site reste fonctionnel (routing, upload, map, admin tous accessibles) mais visuellement dégradé. L'esthétique remonte progressivement à partir de Slice 4b quand la couche `components/ui/` prendra le relais.
- **Aucun composant métier touché** — scope strict foundation. Les Slices 4b à 4e migreront les composants et pages.

**Tests :**
- Web : typecheck OK, vitest OK, playwright OK (sélecteurs E2E basés sur `.leaflet-container`, `header select`, `aside` — inchangés).
- API : sanity OK (non touchée).

**Breaking changes :** aucun côté fonctionnel. Changement d'infrastructure de build uniquement.

**Fichiers clés :**
- `apps/web/package.json` (deps diff)
- `apps/web/vite.config.ts` (css.preprocessorOptions.scss)
- `apps/web/src/main.tsx` (4 imports CSS/SCSS)
- `apps/web/src/styles/tokens.scss` / `fonts.scss` / `globals.scss` (créés)
- `apps/web/public/fonts/nunito-{light-300,regular-400,semi-bold-600,bold-700}.woff2` (ajoutés)
- `docs/adr/ADR-037-adoption-design-system-rte.md`
- `docs/specs/web/ds-rte-foundation/{spec-fonctionnel,spec-technique}.md`
- `apps/web/tailwind.config.ts` (supprimé)
- `apps/web/postcss.config.cjs` (supprimé)
- `apps/web/src/styles/globals.css` (supprimé, remplacé par `.scss`)

**Décisions :**
- Tailwind retiré en une fois (pas de coexistence Tailwind+DS). ADR-037 tranche.
- SCSS + CSS Modules au lieu de Tailwind étendu avec tokens DS : aligné avec la structure du DS core (SCSS natif).
- Nunito servi depuis `apps/web/public/fonts/` (chemin custom `/fonts/`) plutôt que `/assets/fonts/` attendu par le DS : on prend le contrôle du serving, les `@font-face` de notre `fonts.scss` gagnent.
- Incohérence `#e30613` vs `#C8102E` non corrigée dans cette slice (aucune règle CSS métier touchée). Sera tranchée par la valeur du token `$color-brand-primary` du DS en Slice 4e.
```

---

## 12. Plan de rollback

Si régression bloquante après merge sur main :

```bash
git revert <SHA-merge-commit> --no-edit
git push origin main
pnpm install
```

Un seul revert suffit (slice monolithique). La branche `feat/ds-rte-foundation` reste disponible pour reprise.

---

## 13. Risques et mitigations

| Risque | Mitigation |
|---|---|
| `sass` en peer dep du DS core requiert build-script post-install | Vérifier `pnpm install` — ajouter `sass` à `onlyBuiltDependencies` si alerte |
| Vite résout mal `url('@design-system-rte/...')` dans SCSS | On ne référence pas `node_modules/` depuis fonts.scss : les WOFF2 sont copiés dans `public/fonts/` et référencés en chemin absolu `/fonts/` |
| `additionalData` SCSS ré-injecte dans tokens.scss (self-reference Sass error) | Fonction `additionalData` exclut `tokens.scss` ET `fonts.scss` |
| `@design-system-rte/react/style.css` override nos `globals.scss` | Ordre imports : DS en 1er, nos globals en 4e (dernier) — nos règles gagnent |
| Tests E2E qui utilisent des classes Tailwind | Vérifié : aucun sélecteur Tailwind dans `apps/web/e2e/` (tout en sélecteurs HTML/Leaflet natifs) |
| Bundle size augmente | Dev-local uniquement en 4a, surveillé en 4e et pendant la prod |

---

## 14. Transition vers Slice 4b

À la fin de 4a, `main` est en `v3.0-alpha.6`. La Slice 4b part de ce point avec :

- Packages DS installés et fonctionnels
- Tokens SCSS utilisables via `@use` dans chaque `*.module.scss`
- Police Nunito chargée
- 40+ fichiers `.tsx` métier en attente de migration

La Slice 4b créera la couche `apps/web/src/components/ui/` (wrappers DS + composants maison Table/RangeSlider/ColorField/DateTimeField) et commencera à restaurer l'esthétique.

---

**Fin du design.**
