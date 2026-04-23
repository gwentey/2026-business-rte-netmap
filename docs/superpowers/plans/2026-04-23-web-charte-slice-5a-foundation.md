# Slice 5a — Foundation charte web/marketing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installer le système de tokens app-level (palette pure cyan/teal/dark) qui surcharge la palette corporate rouge du DS RTE, écrire le reset CSS moderne, poser l'ADR-039. Aucun composant métier n'est touché dans cette slice — les effets seront visibles partout car la surcharge est globale (le rouge RTE devient cyan automatiquement sur les composants DS).

**Architecture:** `styles/brand.scss` expose ~40 CSS custom properties (`--c-*`, `--r-*`, `--shadow-*`, `--motion-*`, `--t-*`, `--layout-*`). `styles/ds-override.scss` remappe les CSS vars du DS RTE (`--background-brand-default`, `--content-brand-default`, `--border-brand-default`, `--content-link-*`, etc.) vers ces tokens app. `styles/reset.scss` pose un reset moderne avec `box-sizing`, `focus-visible`, `prefers-reduced-motion`. `styles/globals.scss` orchestre l'ordre d'import.

**Tech Stack:** SCSS natif (pas de build step côté styles), CSS custom properties, Vitest pour les tests de ratios de contraste, `@design-system-rte/core@1.7.0` + `@design-system-rte/react@1.8.0` déjà installés.

---

## File Structure

Fichiers créés :
- `apps/web/src/styles/brand.scss` — tokens app (palette, radius, elevation, motion, typo, layout).
- `apps/web/src/styles/ds-override.scss` — remap CSS vars DS → `--c-*`.
- `apps/web/src/styles/reset.scss` — reset moderne (box-sizing, focus-visible, reduced-motion).
- `apps/web/src/styles/_contrast.ts` — petite lib util TS pour calculer le ratio WCAG (pour les tests).
- `apps/web/src/styles/brand.test.ts` — tests des ratios de contraste AA.
- `docs/adr/ADR-039-charte-web-marketing-surcharge-ds.md` — ADR justifiant l'écart.

Fichiers modifiés :
- `apps/web/src/styles/globals.scss` — orchestration d'import + reset body/html.
- `apps/web/src/styles/tokens.scss` — inchangé (forward DS), gardé tel quel.
- `apps/web/src/main.tsx` — vérifier l'ordre d'import (normalement pas de changement, globals charge tout).
- `CHANGELOG.md` — entrée `v3.0-alpha.15` avec description slice 5a.

---

## Task 1 : créer `brand.scss` avec tous les tokens app

**Files:**
- Create: `apps/web/src/styles/brand.scss`

- [ ] **Step 1.1 : Écrire le fichier brand.scss complet**

Create `apps/web/src/styles/brand.scss` :

```scss
// =============================================================================
// brand.scss — Charte visuelle web/marketing (cyan / teal / dark)
// Source unique de vérité des tokens app-level. Surcharge sélective du DS RTE
// dans `ds-override.scss`. Voir ADR-039.
// =============================================================================

:root {
  // ---------- Palette -------------------------------------------------------
  --c-primary: #00bded;
  --c-primary-hover: #00a7d1;
  --c-primary-pressed: #0090b4;
  --c-primary-soft: rgba(0, 189, 237, 0.08);

  --c-surface-dark: #10181d;
  --c-surface-deep: #0c3949;
  --c-surface: #ffffff;
  --c-surface-sunken: #f4f6f8;

  --c-border-subtle: #e3e8ec;
  --c-border-strong: #c7d0d6;

  --c-text: #10181d;
  --c-text-muted: #4a5a66;
  --c-text-disabled: #94a3b1;
  --c-text-inverse: #ffffff;
  --c-text-link: var(--c-primary-pressed);

  --c-error: #b3261e;
  --c-error-bg: #fdecea;
  --c-error-border: #e8a29c;

  // ---------- Radius --------------------------------------------------------
  --r-xs: 2px;
  --r-sm: 4px;
  --r-md: 6px;
  --r-lg: 10px;
  --r-pill: 9999px;

  // ---------- Elevation (shadows) ------------------------------------------
  --shadow-0: none;
  --shadow-1: 0 1px 2px rgba(16, 24, 29, 0.06), 0 1px 1px rgba(16, 24, 29, 0.04);
  --shadow-2: 0 2px 8px rgba(16, 24, 29, 0.08), 0 1px 2px rgba(16, 24, 29, 0.06);
  --shadow-3: 0 12px 32px rgba(16, 24, 29, 0.14), 0 4px 8px rgba(16, 24, 29, 0.08);
  --shadow-focus: 0 0 0 3px rgba(0, 189, 237, 0.35);
  --shadow-error-focus: 0 0 0 3px rgba(179, 38, 30, 0.28);

  // ---------- Motion --------------------------------------------------------
  --motion-fast: 120ms cubic-bezier(0.2, 0, 0, 1);
  --motion-std: 200ms cubic-bezier(0.2, 0, 0, 1);
  --motion-slow: 320ms cubic-bezier(0.2, 0, 0, 1);

  // ---------- Typography ----------------------------------------------------
  --font-family-base: "Nunito", system-ui, -apple-system, sans-serif;
  --font-family-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  --t-display-size: 28px;
  --t-display-weight: 700;
  --t-display-lh: 1.2;

  --t-h1-size: 22px;
  --t-h1-weight: 700;
  --t-h1-lh: 1.3;

  --t-h2-size: 18px;
  --t-h2-weight: 600;
  --t-h2-lh: 1.35;

  --t-h3-size: 15px;
  --t-h3-weight: 600;
  --t-h3-lh: 1.4;

  --t-body-size: 14px;
  --t-body-weight: 400;
  --t-body-lh: 1.55;

  --t-body-strong-weight: 600;

  --t-small-size: 12px;
  --t-small-weight: 400;
  --t-small-lh: 1.5;

  --t-caps-size: 11px;
  --t-caps-weight: 700;
  --t-caps-lh: 1.4;
  --t-caps-tracking: 0.08em;

  --t-mono-size: 13px;
  --t-mono-weight: 400;
  --t-mono-lh: 1.5;

  // ---------- Layout --------------------------------------------------------
  --layout-header-h: 56px;
  --layout-page-px: 24px;
  --layout-page-px-mobile: 16px;
  --layout-page-max-w: 960px;
  --layout-map-toolbar-gap: 12px;
}

// =============================================================================
// Mixins de composition typographique (usage dans les .module.scss)
// =============================================================================

@mixin t-display {
  font-size: var(--t-display-size);
  font-weight: var(--t-display-weight);
  line-height: var(--t-display-lh);
}

@mixin t-h1 {
  font-size: var(--t-h1-size);
  font-weight: var(--t-h1-weight);
  line-height: var(--t-h1-lh);
}

@mixin t-h2 {
  font-size: var(--t-h2-size);
  font-weight: var(--t-h2-weight);
  line-height: var(--t-h2-lh);
}

@mixin t-h3 {
  font-size: var(--t-h3-size);
  font-weight: var(--t-h3-weight);
  line-height: var(--t-h3-lh);
}

@mixin t-body {
  font-size: var(--t-body-size);
  font-weight: var(--t-body-weight);
  line-height: var(--t-body-lh);
}

@mixin t-body-strong {
  font-size: var(--t-body-size);
  font-weight: var(--t-body-strong-weight);
  line-height: var(--t-body-lh);
}

@mixin t-small {
  font-size: var(--t-small-size);
  font-weight: var(--t-small-weight);
  line-height: var(--t-small-lh);
}

@mixin t-caps {
  font-size: var(--t-caps-size);
  font-weight: var(--t-caps-weight);
  line-height: var(--t-caps-lh);
  letter-spacing: var(--t-caps-tracking);
  text-transform: uppercase;
}

@mixin t-mono {
  font-family: var(--font-family-mono);
  font-size: var(--t-mono-size);
  font-weight: var(--t-mono-weight);
  line-height: var(--t-mono-lh);
}
```

- [ ] **Step 1.2 : Commit**

```bash
git add apps/web/src/styles/brand.scss
git commit -m "$(cat <<'EOF'
feat(web): ajoute styles/brand.scss — tokens app charte cyan/teal/dark

Expose ~40 CSS custom properties (palette pure 4 couleurs, radius, elevation,
motion, typo Nunito, layout) plus 9 mixins SCSS de composition typographique.
Prépare la surcharge du DS RTE en Task 2. Voir ADR-039 (à créer en Task 5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 : créer `ds-override.scss` pour remapper les CSS vars du DS RTE

**Files:**
- Create: `apps/web/src/styles/ds-override.scss`

- [ ] **Step 2.1 : Écrire le fichier ds-override.scss**

Create `apps/web/src/styles/ds-override.scss` :

```scss
// =============================================================================
// ds-override.scss — Surcharge des CSS custom properties du DS RTE
// Remappe les tokens du DS corporate (rouge #C8102E) vers la charte app
// web/marketing (cyan). Appliqué après @import '@design-system-rte/react/style.css'.
// Voir ADR-039. Liste des vars consommées par le DS extraite depuis
// node_modules/@design-system-rte/react/dist/style.css (grep 'var(--[a-z-]+').
// =============================================================================

:root {
  // ---------- Brand backgrounds (boutons primaires, tabs actifs, toggles) --
  --background-brand-default: var(--c-primary);
  --background-brand-hover: var(--c-primary-hover);
  --background-brand-pressed: var(--c-primary-pressed);
  --background-brand-inverse-hover: rgba(255, 255, 255, 0.08);
  --background-brand-inverse-pressed: rgba(255, 255, 255, 0.16);
  --background-brand-navigation-default: var(--c-surface-dark);
  --background-brand-navigation-hover: var(--c-surface-deep);
  --background-brand-navigation-pressed: var(--c-surface-deep);
  --background-brand-selected-default: var(--c-primary-soft);
  --background-brand-selected-hover: var(--c-primary-soft);
  --background-brand-unselected-default: transparent;
  --background-brand-unselected-hover: var(--c-primary-soft);

  // ---------- Surfaces génériques ------------------------------------------
  --background-default: var(--c-surface);
  --background-inverse: var(--c-surface-dark);
  --background-selected: var(--c-primary-soft);
  --background-hover: var(--c-primary-soft);
  --background-disabled: var(--c-surface-sunken);

  // ---------- Surfaces neutres (cards, panels) ------------------------------
  --background-neutral-regular-default: var(--c-surface);
  --background-neutral-regular-hover: var(--c-surface-sunken);
  --background-neutral-bold-default: var(--c-surface-dark);
  --background-neutral-bold-hover: var(--c-surface-deep);
  --background-neutral-navigation-default: var(--c-surface-dark);
  --background-neutral-navigation-hover: var(--c-surface-deep);

  // ---------- Statuts sémantiques (seulement error utilise la charte rouge)-
  --background-danger-default: var(--c-error);
  --background-danger-hover: #9a211a;
  --background-danger-pressed: #821c16;
  --background-info-default: var(--c-primary-soft);
  --background-success-default: rgba(12, 57, 73, 0.08);
  --background-warning-default: rgba(16, 24, 29, 0.06);

  // ---------- Borders brand -------------------------------------------------
  --border-brand-default: var(--c-primary);
  --border-brand-focused: var(--c-primary);
  --border-brand-navigation-active: var(--c-primary);
  --border-brand-navigation-divider: rgba(255, 255, 255, 0.12);

  // ---------- Borders neutres ----------------------------------------------
  --border-divider: var(--c-border-subtle);
  --border-inverse: rgba(255, 255, 255, 0.24);
  --border-primary: var(--c-border-strong);
  --border-secondary: var(--c-border-subtle);
  --border-tertiary: var(--c-border-subtle);
  --border-disabled: var(--c-border-subtle);

  // ---------- Borders statuts ----------------------------------------------
  --border-danger: var(--c-error);
  --border-info: var(--c-primary);
  --border-success: var(--c-surface-deep);
  --border-warning: var(--c-text-muted);

  // ---------- Content (texte) sur surfaces claires --------------------------
  --content-primary: var(--c-text);
  --content-secondary: var(--c-text-muted);
  --content-tertiary: var(--c-text-muted);
  --content-primary-inverse: var(--c-text-inverse);
  --content-disabled: var(--c-text-disabled);

  // ---------- Content brand (titres accent, icônes actives) -----------------
  --content-brand-default: var(--c-primary-pressed);
  --content-brand-hover: var(--c-primary);
  --content-brand-pressed: var(--c-primary-pressed);
  --content-brand-navigation-default: var(--c-text-inverse);
  --content-brand-navigation-hover: var(--c-primary);

  // ---------- Content statuts ----------------------------------------------
  --content-danger-default: var(--c-error);
  --content-info-default: var(--c-primary-pressed);
  --content-success-default: var(--c-surface-deep);
  --content-warning-default: var(--c-text);
  --content-status: var(--c-text);

  // ---------- Content links -------------------------------------------------
  --content-link-default: var(--c-text-link);
  --content-link-hover: var(--c-primary);
  --content-link-pressed: var(--c-primary-pressed);
  --content-link-primary: var(--c-text-link);
  --content-link-secondary: var(--c-text-muted);
  --content-link-visited-default: var(--c-text-link);
  --content-link-visited-hover: var(--c-primary);
  --content-link-visited-pressed: var(--c-primary-pressed);

  // ---------- Decorative (palette métier — neutralisée, non utilisée ici) --
  // On ne touche pas aux decoratives : ils servent aux illustrations/charts
  // qui ne sont pas dans notre scope. Les couleurs process métier
  // (lib/process-colors.ts) pilotent le rendu carto et sont data-driven.

  // ---------- Elevation shadows --------------------------------------------
  --elevation-shadow-ambient: var(--shadow-1);
  --elevation-shadow-key: var(--shadow-2);
  --elevation-shadow-ambient-brand: 0 0 0 3px rgba(0, 189, 237, 0.18);
  --elevation-shadow-key-brand: var(--shadow-focus);

  // ---------- Brand (alias racine) -----------------------------------------
  --brand-default: var(--c-primary);
}
```

- [ ] **Step 2.2 : Commit**

```bash
git add apps/web/src/styles/ds-override.scss
git commit -m "$(cat <<'EOF'
feat(web): ajoute styles/ds-override.scss — surcharge CSS vars DS RTE

Remappe ~60 CSS custom properties consommees par le DS RTE
(background-brand-*, content-brand-*, border-brand-*, content-link-*, etc.)
vers les tokens app-level (--c-primary cyan, --c-surface-* dark/deep/light).
Le DS RTE corporate rouge devient automatiquement cyan partout ou il est
utilise (Button, Modal, Tab, Toast, Accordion, Badge, etc.).

Les CSS vars decoratives du DS (palette illustrations) ne sont pas touchees.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 : créer `reset.scss` (reset moderne + focus-visible)

**Files:**
- Create: `apps/web/src/styles/reset.scss`

- [ ] **Step 3.1 : Écrire reset.scss**

Create `apps/web/src/styles/reset.scss` :

```scss
// =============================================================================
// reset.scss — Reset CSS moderne
// - Box model prévisible
// - Typography base (Nunito, rendu optimisé)
// - Focus-visible cyan universel (accessibilité)
// - Respect de prefers-reduced-motion
// =============================================================================

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-size-adjust: 100%;
}

body {
  margin: 0;
  font-family: var(--font-family-base);
  font-size: var(--t-body-size);
  font-weight: var(--t-body-weight);
  line-height: var(--t-body-lh);
  color: var(--c-text);
  background: var(--c-surface);
}

// Supprime les outlines par défaut — remplacés par focus-visible cyan
*:focus {
  outline: none;
}

*:focus-visible {
  outline: 3px solid var(--c-primary);
  outline-offset: 2px;
  border-radius: var(--r-xs);
}

// Typographie de base — hiérarchie par défaut si pas de .module.scss
h1,
h2,
h3,
h4,
h5,
h6 {
  margin: 0;
  color: var(--c-text);
}

p {
  margin: 0;
}

// Liens globaux — peuvent être surchargés localement
a {
  color: var(--c-text);
  text-decoration: underline;
  text-decoration-color: var(--c-primary);
  text-underline-offset: 3px;
  text-decoration-thickness: 2px;
  transition: color var(--motion-fast), text-decoration-color var(--motion-fast);
}

a:hover {
  color: var(--c-primary-pressed);
  text-decoration-color: var(--c-primary-pressed);
}

// Boutons natifs : reset (les composants utilisent DS Button ou .module.scss)
button {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

// Inputs natifs : héritent de la typo
input,
textarea,
select {
  font-family: inherit;
  font-size: inherit;
}

// Images réactives par défaut
img,
svg,
video {
  max-width: 100%;
  height: auto;
  display: block;
}

// Respect du prefers-reduced-motion utilisateur
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3.2 : Commit**

```bash
git add apps/web/src/styles/reset.scss
git commit -m "$(cat <<'EOF'
feat(web): ajoute styles/reset.scss — reset moderne + focus-visible

- box-sizing universel
- typography base (Nunito, antialiased)
- focus-visible cyan --c-primary pour tous les elements interactifs
- prefers-reduced-motion respecte (transitions/animations -> 0.01ms)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 : orchestrer l'ordre d'import dans globals.scss

**Files:**
- Modify: `apps/web/src/styles/globals.scss`

- [ ] **Step 4.1 : Lire le fichier actuel**

Run: `cat apps/web/src/styles/globals.scss`

Expected: fichier court avec `html,body,#root { height:100%; margin:0; font-family: "Nunito" }` et une règle marker `.leaflet-div-icon.carto-node-marker`.

- [ ] **Step 4.2 : Remplacer globals.scss**

Replace `apps/web/src/styles/globals.scss` :

```scss
// =============================================================================
// globals.scss — Orchestration des styles globaux
// Ordre critique — chaque import surcharge le précédent :
//   1. brand.scss       → tokens app (CSS vars --c-*, mixins typo)
//   2. ds-override.scss → surcharge des CSS vars du DS RTE
//   3. reset.scss       → reset moderne + focus-visible
// =============================================================================

@use 'brand';
@use 'ds-override';
@use 'reset';

// App-level layout
html,
body,
#root {
  height: 100%;
}

// Markers Carto ECP — neutralise le fond/bordure par défaut de .leaflet-div-icon
// pour laisser visible le cercle coloré de buildNodeDivIcon
// (apps/web/src/components/Map/node-icon.tsx).
.leaflet-div-icon.carto-node-marker {
  background: transparent;
  border: none;
}
```

- [ ] **Step 4.3 : Lancer dev server pour vérification visuelle**

Run: `pnpm --filter @carto-ecp/web dev`

Expected: le serveur démarre sur `http://localhost:5173` sans erreur SCSS. Les boutons DS existants (s'il y en a de visibles) sont maintenant cyan au lieu de rouge.

Stop the server once confirmed.

- [ ] **Step 4.4 : Commit**

```bash
git add apps/web/src/styles/globals.scss
git commit -m "$(cat <<'EOF'
feat(web): orchestre import brand + ds-override + reset dans globals.scss

Ordre d'import critique :
1. brand.scss       — tokens app (CSS vars + mixins)
2. ds-override.scss — surcharge DS RTE (rouge -> cyan)
3. reset.scss       — reset moderne + focus-visible

Effet : le DS RTE bascule de la palette corporate rouge vers la charte
web/marketing cyan sur tous les composants (Button, Modal, Tab, etc.).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 : écrire l'ADR-039

**Files:**
- Create: `docs/adr/ADR-039-charte-web-marketing-surcharge-ds.md`

- [ ] **Step 5.1 : Écrire l'ADR**

Create `docs/adr/ADR-039-charte-web-marketing-surcharge-ds.md` :

```markdown
# ADR-039 — Charte visuelle web/marketing : surcharge de la palette corporate du DS RTE

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | ADR-039                        |
| Statut     | Accepté                        |
| Date       | 2026-04-23                     |
| Auteur(s)  | Anthony + Claude               |
| Owner      | Anthony                        |
| Décideurs  | Anthony                        |
| Contexte   | Slice 5a — Foundation charte   |
| Remplace   | —                              |
| Complète   | ADR-037 (adoption DS), ADR-038 (couche ui/) |
| Features   | web/*                          |
| App        | web                            |

## Contexte

Après la migration DS RTE (Slices 4a → 4e, ADRs 037/038), le frontend `apps/web`
consomme `@design-system-rte/react@1.8.0` avec une palette corporate dominée par
le rouge RTE `#C8102E`. Cette palette est celle de la charte interne historique.

Le propriétaire demande un alignement sur la charte **web/marketing** de
`rte-france.com` : palette cyan (`#00bded`) / teal (`#0c3949`) / dark (`#10181d`)
/ white. Cette charte est plus moderne, plus "tech", correspond aux valeurs
affichées sur le site public : *clean industrialism, technological transparency,
modern institutionalism, geometric precision, human-centered infrastructure*.

Le constat avant cette slice :
- 492 hex hardcodés dans `apps/web/src/` sur 33 fichiers.
- 50 occurrences du rouge RTE dans 20 fichiers.
- Les tokens du DS RTE ne sont jamais consommés dans les `.module.scss` métier.
- Le style "Tailwind gris + rouge corporate" donne une impression "admin générique".

## Options considérées

| Option | Description | Effort | Avantages | Inconvénients |
|--------|-------------|--------|-----------|---------------|
| **A** — Surcharger par CSS custom properties au niveau app | `styles/brand.scss` + `styles/ds-override.scss` remappent les `--background-brand-*`, `--content-brand-*`, `--border-brand-*`, `--content-link-*` du DS vers les tokens app cyan/teal/dark | S | Aucun fork du DS, maintenable, réversible par 2 vars, n'affecte pas l'API DS | Dépend de la stabilité des noms de CSS vars du DS entre versions mineures |
| B — Forker `@design-system-rte/react` | Maintenance d'une version RTE-web en interne | XL | Contrôle total | Dette massive, maintenance à chaque upgrade DS |
| C — Duplication complète (abandon du DS, composants maison) | Repartir sans DS RTE | XL | Indépendance totale | Jette ADR-037 et 38, perte des 41 composants, régression a11y |

## Décision retenue

**Option A** : surcharge des CSS custom properties dans `apps/web/src/styles/ds-override.scss`, appliqué après le `@import '@design-system-rte/react/style.css'` dans `main.tsx`.

Les CSS vars surchargées ont été extraites du bundle `style.css` du DS
(`grep -oE 'var\(--[a-z-]+' node_modules/@design-system-rte/react/dist/style.css`)
et remappées vers les tokens `--c-*` exposés par `styles/brand.scss`.

Justifications :

1. **Respecte ADR-037** : on maintient l'usage du DS RTE officiel (composants React, a11y, structure SCSS). Seule la palette est localement adaptée.
2. **Réversibilité maximale** : désactiver `ds-override.scss` dans `globals.scss` restaure l'aspect corporate rouge en 1 commit.
3. **Effort minimal** : ~60 CSS vars à remapper, ~200 LOC SCSS au total sur Slice 5a.
4. **Compatibilité forward** : si le DS RTE publie une v2, seuls les noms de CSS vars potentiellement changés sont à auditer.
5. **Pas de fork** : aucune maintenance parallèle du DS RTE.

## Conséquences

### Positives

- Charte web/marketing respectée sans abandonner le DS RTE.
- 41 composants DS automatiquement rebrandés (Button, Modal, Tab, Toast, Badge, Popover, FileUpload, Drawer, Accordion, etc.).
- Point d'entrée unique pour les évolutions de palette : `styles/brand.scss` + `styles/ds-override.scss`.
- Contraste AA WCAG garanti (testé via `brand.test.ts` en Task 6).
- Suppression progressive des 492 hex hardcodés sur Slices 5b → 5e.

### Négatives

- Couplage aux noms de CSS vars du DS (`--background-brand-default`, etc.). Un rename amont casserait la surcharge.
- Léger risque visuel : certains composants du DS peuvent utiliser des hex compilés en dur dans leur SCSS (non remapables par CSS var). Audit à faire en Slice 5b lorsque des composants DS visibles (Button, Modal, Tab) sont effectivement utilisés dans l'UI.
- Les palettes decoratives du DS (`--decorative-bleu-*`, `--decorative-vert-*`, etc.) ne sont PAS surchargées : elles servent aux illustrations/charts et restent dans l'identité DS. Hors scope.

### Ce qu'on s'interdit désormais

- Hardcoder `#C8102E`, `#e30613`, `#b91c1c` ou toute variante du rouge RTE dans les `.module.scss` métier (à partir de Slice 5b).
- Ajouter de nouvelles hex values sans passer par un token `--c-*`. Exception : `lib/process-colors.ts` et `packages/registry/eic-rte-overlay.json` (data-driven).
- Désynchroniser `styles/brand.scss` et `styles/ds-override.scss` : si un nouveau token app est ajouté, tracer son remap DS dans le même commit.

## Ressources / Références

- **Brand source** : https://www.rte-france.com/
- **DS RTE Storybook** : https://opensource.rte-france.com/design-system-rte/
- **CSS vars du DS extraites** : `apps/web/node_modules/@design-system-rte/react/dist/style.css`
- **Spec Slice 5** : `docs/superpowers/specs/2026-04-23-charte-web-marketing-design.md`
- **Plan Slice 5a** : `docs/superpowers/plans/2026-04-23-web-charte-slice-5a-foundation.md`
- **ADRs liés** :
  - ADR-037 (adoption DS RTE)
  - ADR-038 (couche `components/ui/`)
```

- [ ] **Step 5.2 : Commit**

```bash
git add docs/adr/ADR-039-charte-web-marketing-surcharge-ds.md
git commit -m "$(cat <<'EOF'
docs(adr): ADR-039 — surcharge palette DS RTE vers charte web/marketing

Documente le choix de surcharger les CSS custom properties du DS RTE
(--background-brand-*, --content-brand-*, --border-brand-*, --content-link-*)
plutot que de forker ou dupliquer. Option A retenue : reversible, maintenable,
effort S, compatible forward.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 : tests de ratios de contraste WCAG AA

**Files:**
- Create: `apps/web/src/styles/_contrast.ts`
- Create: `apps/web/src/styles/brand.test.ts`

- [ ] **Step 6.1 : Écrire la lib de calcul de contraste**

Create `apps/web/src/styles/_contrast.ts` :

```typescript
// Calcul du ratio de contraste WCAG 2.1 entre deux couleurs RGB.
// Seuls les hex 6 chiffres sont supportés (pas rgba — on teste les tokens opaques).

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) {
    throw new Error(`Expected 6-digit hex, got "${hex}"`);
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(hexToRgb(fg));
  const l2 = relativeLuminance(hexToRgb(bg));
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}
```

- [ ] **Step 6.2 : Écrire le fichier de test**

Create `apps/web/src/styles/brand.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { contrastRatio } from './_contrast.js';

// Tokens miroir de brand.scss (source unique de vérité = ce fichier test
// garantit que toute modif de brand.scss doit refléter ici en priorité).
const TOKENS = {
  primary: '#00bded',
  primaryHover: '#00a7d1',
  primaryPressed: '#0090b4',
  surfaceDark: '#10181d',
  surfaceDeep: '#0c3949',
  surface: '#ffffff',
  surfaceSunken: '#f4f6f8',
  borderSubtle: '#e3e8ec',
  borderStrong: '#c7d0d6',
  text: '#10181d',
  textMuted: '#4a5a66',
  textDisabled: '#94a3b1',
  textInverse: '#ffffff',
  textLink: '#0090b4', // primaryPressed
  error: '#b3261e',
  errorBg: '#fdecea',
  errorBorder: '#e8a29c',
} as const;

const AA_TEXT = 4.5;
const AA_LARGE = 3.0;

describe('brand tokens — WCAG AA contrast', () => {
  it('text on surface (body text)', () => {
    expect(contrastRatio(TOKENS.text, TOKENS.surface)).toBeGreaterThan(AA_TEXT);
  });

  it('text-muted on surface (metadata)', () => {
    expect(contrastRatio(TOKENS.textMuted, TOKENS.surface)).toBeGreaterThan(AA_TEXT);
  });

  it('text on surface-sunken (body in sunken areas)', () => {
    expect(contrastRatio(TOKENS.text, TOKENS.surfaceSunken)).toBeGreaterThan(AA_TEXT);
  });

  it('text-inverse on surface-dark (header white text)', () => {
    expect(contrastRatio(TOKENS.textInverse, TOKENS.surfaceDark)).toBeGreaterThan(AA_TEXT);
  });

  it('text-inverse on surface-deep (secondary dark bandeau)', () => {
    expect(contrastRatio(TOKENS.textInverse, TOKENS.surfaceDeep)).toBeGreaterThan(AA_TEXT);
  });

  it('text on primary (primary button label)', () => {
    // Bouton primaire : texte --c-text sur fond --c-primary. AA text = 4.5.
    expect(contrastRatio(TOKENS.text, TOKENS.primary)).toBeGreaterThan(AA_TEXT);
  });

  it('text-inverse on primary-pressed (primary button pressed state, large text)', () => {
    // Pressed state autorisé à AA_LARGE uniquement si usage en bouton (text >= 18px/700).
    expect(contrastRatio(TOKENS.textInverse, TOKENS.primaryPressed)).toBeGreaterThan(AA_LARGE);
  });

  it('primary-pressed as link color on surface (body text link)', () => {
    // Lien = text-link = primary-pressed. AA text = 4.5.
    expect(contrastRatio(TOKENS.textLink, TOKENS.surface)).toBeGreaterThan(AA_TEXT);
  });

  it('text-disabled on surface (>= AA large = 3.0, disabled exempt from AA text)', () => {
    expect(contrastRatio(TOKENS.textDisabled, TOKENS.surface)).toBeGreaterThan(AA_LARGE);
  });

  it('error on surface (alert error text)', () => {
    expect(contrastRatio(TOKENS.error, TOKENS.surface)).toBeGreaterThan(AA_TEXT);
  });

  it('error on error-bg (error alert text on tinted bg)', () => {
    expect(contrastRatio(TOKENS.error, TOKENS.errorBg)).toBeGreaterThan(AA_TEXT);
  });

  it('text-inverse on error (danger button label)', () => {
    expect(contrastRatio(TOKENS.textInverse, TOKENS.error)).toBeGreaterThan(AA_TEXT);
  });
});

describe('brand tokens — informational contrasts (log only, not asserted)', () => {
  it('emits ratios for debug', () => {
    const pairs: Array<[string, string, string]> = [
      ['text on primary-hover', TOKENS.text, TOKENS.primaryHover],
      ['text-inverse on primary', TOKENS.textInverse, TOKENS.primary],
      ['primary on surface (decorative icon)', TOKENS.primary, TOKENS.surface],
    ];
    for (const [label, fg, bg] of pairs) {
      // eslint-disable-next-line no-console
      console.log(`${label}: ${contrastRatio(fg, bg).toFixed(2)}`);
    }
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 6.3 : Lancer les tests et vérifier qu'ils passent**

Run: `pnpm --filter @carto-ecp/web test -- brand.test`

Expected: `Test Files  1 passed (1)` — tous les asserts AA passent. Si un ratio échoue, ajuster la valeur hex dans `brand.scss` ET dans `TOKENS` du test, jusqu'à obtenir AA.

- [ ] **Step 6.4 : Commit**

```bash
git add apps/web/src/styles/_contrast.ts apps/web/src/styles/brand.test.ts
git commit -m "$(cat <<'EOF'
test(web): ratios contraste WCAG AA pour les tokens brand

Ajoute une lib _contrast.ts (calcul WCAG 2.1 relative luminance) et un fichier
brand.test.ts qui verifie 12 combinaisons text/background utilisees par l'app.
Tous les asserts passent a AA (4.5 pour texte courant, 3.0 pour texte large/
disabled).

Garantit qu'aucune future modif de la palette ne casse l'accessibilite.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 : mise à jour CHANGELOG + vérif typecheck/tests globaux

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 7.1 : Lire CHANGELOG.md**

Run: `head -40 CHANGELOG.md`

Expected: première entrée `### v3.0-alpha.14 — Slice 4e ...`.

- [ ] **Step 7.2 : Ajouter l'entrée v3.0-alpha.15**

Insérer **au-dessus** de l'entrée `v3.0-alpha.14` (sous la ligne `## [Unreleased]` si elle existe, sinon juste avant la version précédente) :

```markdown
### v3.0-alpha.15 — Slice 5a : Foundation charte web/marketing (cyan/teal/dark) (2026-04-23)

**Premiere slice de la refonte visuelle globale.** Aligne l'app sur la charte
web/marketing de rte-france.com (cyan #00bded, teal #0c3949, dark #10181d,
white) en surchargeant la palette corporate rouge du DS RTE via CSS custom
properties. Aucun composant metier n'est modifie dans cette slice — l'effet
est global via la surcharge des CSS vars du DS.

- `styles/brand.scss` : ~40 CSS custom properties app (palette, radius, elevation, motion, typo Nunito, layout) + 9 mixins SCSS.
- `styles/ds-override.scss` : remappe ~60 CSS vars consommees par le DS RTE (--background-brand-*, --content-brand-*, --border-brand-*, --content-link-*, etc.) vers --c-*.
- `styles/reset.scss` : reset moderne (box-sizing, Nunito antialiased, focus-visible cyan, prefers-reduced-motion).
- `styles/globals.scss` : orchestre import brand -> ds-override -> reset.
- `styles/brand.test.ts` : 12 tests de ratios de contraste WCAG AA (tous passent).
- `docs/adr/ADR-039-charte-web-marketing-surcharge-ds.md` : documente l'ecart assume au DS corporate.
```

- [ ] **Step 7.3 : Lancer typecheck + tests**

Run: `pnpm --filter @carto-ecp/web typecheck && pnpm --filter @carto-ecp/web test`

Expected: zéro erreur TypeScript, tous les tests Vitest passent (y compris `brand.test.ts`).

- [ ] **Step 7.4 : Vérifier que le dev server démarre sans erreur SCSS**

Run: `pnpm --filter @carto-ecp/web dev`

Expected: Vite démarre sur port 5173 sans erreur SCSS. Ouvrir manuellement `http://localhost:5173`, vérifier : pas d'écran blanc, header et pages s'affichent, focus sur un input/button donne un ring cyan.

Stop server.

- [ ] **Step 7.5 : Commit final**

```bash
git add CHANGELOG.md
git commit -m "$(cat <<'EOF'
docs(changelog): v3.0-alpha.15 Slice 5a Foundation charte web/marketing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 : Hook `update-writer-after-implement` + push

- [ ] **Step 8.1 : Déclencher le subagent update-writer-after-implement**

Selon la règle `.claude/rules/00-global.md` §3, le hook Stop doit appeler `update-writer-after-implement` automatiquement. Si ce n'est pas le cas, dispatcher manuellement :

```
@update-writer-after-implement pour la Slice 5a (SHA HEAD de la branche feat/web-charte-redesign). Specs a mettre a jour : aucune feature existante modifiee, mais creer docs/specs/web/charte-visuelle/spec-fonctionnel.md + spec-technique.md qui referencent brand.scss, ds-override.scss, reset.scss, brand.test.ts, ADR-039.
```

- [ ] **Step 8.2 : Créer la PR via MCP GitHub**

Via MCP `github` (rule 05-git-workflow.md) :

```
gh pr create --title "feat(web): slice 5a Foundation charte web/marketing (CHANGELOG v3.0-alpha.15)" --body "..."
```

Body template :

```markdown
## Summary
- Installe les tokens app-level (palette pure cyan/teal/dark) dans `styles/brand.scss`.
- Surcharge la palette corporate rouge du DS RTE via `styles/ds-override.scss` (60 CSS vars remappees).
- Pose le reset moderne avec focus-visible cyan et prefers-reduced-motion.
- Verifie les ratios de contraste AA WCAG via tests Vitest.
- Documente le choix avec ADR-039.

Aucun composant metier n'est modifie — l'effet est global sur le DS RTE, qui bascule automatiquement du rouge au cyan sur tous les composants utilises.

## Spec & Plan
- Spec : `docs/superpowers/specs/2026-04-23-charte-web-marketing-design.md`
- Plan : `docs/superpowers/plans/2026-04-23-web-charte-slice-5a-foundation.md`
- ADR : `docs/adr/ADR-039-charte-web-marketing-surcharge-ds.md`

## Test plan
- [x] `pnpm --filter @carto-ecp/web typecheck` passe
- [x] `pnpm --filter @carto-ecp/web test` passe (dont `brand.test.ts` = 12 asserts AA)
- [x] `pnpm --filter @carto-ecp/web dev` demarre sans erreur SCSS
- [ ] Smoke visuel manuel : le focus ring cyan apparait sur inputs/boutons
- [ ] Smoke visuel manuel : les composants DS visibles (EnvSelector Select, etc.) sont cyan et non rouge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Self-review

- **Spec coverage** :
  - §3.1 Palette → Task 1 (brand.scss) + Task 6 (tests)
  - §3.2 Radius → Task 1
  - §3.3 Elevation → Task 1
  - §3.4 Motion → Task 1
  - §3.5 Typographie → Task 1 (vars + mixins)
  - §3.6 Layout → Task 1
  - §3.7 Surcharge DS → Task 2 (ds-override.scss) + Task 5 (ADR-039)
  - §7 critère "contraste AA" → Task 6 tests
  - §8 rollout "CHANGELOG v3.0-alpha.15" → Task 7
  - §8 "ADR-039 en Slice 5a" → Task 5
  - §8 "hook update-writer" → Task 8
- **Placeholder scan** : aucun TBD, tous les blocs de code sont complets.
- **Type consistency** : `TOKENS.textLink` = `#0090b4` dans le test, `--c-text-link: var(--c-primary-pressed)` = `#0090b4` dans `brand.scss`. Cohérent.
- **Scope** : 8 tasks, ~6 commits, durée réaliste 1j.

---

## Slices suivantes (hors scope Slice 5a, planifiées séparément après merge 5a)

- **Slice 5b — Shell & navigation** : `App.module.scss`, `EnvSelector`, header/footer MapPage.
- **Slice 5c — Upload & Map chrome** : `UploadPage`, `Map/NetworkMap`, `Map/BaFilter`, `Map/NodeMarker`, `TimelineSlider`.
- **Slice 5d — Admin & DetailPanel** : tous les composants Admin + DetailPanel + UploadBatchTable + 4 composants maison `ui/`.
- **Slice 5e — Finitions UX** : `Skeleton`, `EmptyState`, intégration Toast DS, audit a11y final + check no-hex CI.

Chaque slice aura son plan `docs/superpowers/plans/2026-04-23-web-charte-slice-5X-*.md` écrit au début de sa mise en œuvre.
