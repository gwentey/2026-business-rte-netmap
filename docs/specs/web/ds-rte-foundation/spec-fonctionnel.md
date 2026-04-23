# Spec Fonctionnelle — web/ds-rte-foundation

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/ds-rte-foundation           |
| Version| 3.0-alpha.6                     |
| Date   | 2026-04-23                      |
| Source | Slice 4a — Foundation DS RTE    |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-037](../../../adr/ADR-037-adoption-design-system-rte.md) | Adoption du Design System RTE | Actif |

---

## Contexte et objectif

Cette slice est la **première des cinq** (4a → 4e) de la migration totale du frontend `apps/web` vers le Design System officiel RTE (`@design-system-rte/react` + `@design-system-rte/core`). Son rôle : installer les packages, câbler les tokens SCSS, charger la police Nunito, et retirer Tailwind.

**Aucun composant métier n'est migré dans cette slice.** La régression visuelle est assumée jusqu'à fin Slice 4b — les `className="bg-rte..."` dans les ~40 composants métier restent en place mais deviennent inertes (aucun CSS ne les résout).

---

## Règles métier

1. **Aucun changement fonctionnel** — les workflows upload, carte, admin continuent d'être utilisables. Chaque bouton est cliquable, chaque requête API répond.

2. **Régression visuelle temporaire admise** — le site apparaît "brut" (sans styles personnalisés) entre le merge de cette slice et la fin de la Slice 4b. L'esthétique est restaurée progressivement.

3. **Ordre des imports CSS dans `main.tsx` fixe** :
   1. `@design-system-rte/react/style.css` (DS RTE composants pré-stylés + reset)
   2. `leaflet/dist/leaflet.css` (map library)
   3. `./styles/fonts.scss` (déclarations `@font-face` Nunito)
   4. `./styles/globals.scss` (reset projet + override marker Leaflet)

4. **Tokens auto-injectés** — chaque `*.module.scss` et `*.scss` (sauf `tokens.scss` et `fonts.scss`) reçoit automatiquement `@use "@/styles/tokens" as tokens;` en tête via `vite.config.ts css.preprocessorOptions.scss.additionalData`.

5. **Police Nunito servie localement** — les 4 WOFF2 (Light 300, Regular 400, SemiBold 600, Bold 700) sont stockés dans `apps/web/public/fonts/` et référencés via URLs absolues `/fonts/nunito-*.woff2`. Le DS est laissé libre de charger ses propres fonts — nos `@font-face` complètent.

---

## Cas d'usage

Aucun — slice d'infrastructure. Le spec des cas d'usage métier est inchangé (voir les specs existantes `web/map`, `web/upload`, `web/admin`).

---

## Dépendances

### Ajout
- `@design-system-rte/react@^1.8.0` (dependency)
- `@design-system-rte/core@^1.7.0` (dependency)
- `sass` (devDependency, résolu à `^1.99.0` par pnpm depuis le range `^1.85.1`)

### Retrait
- `tailwindcss`, `postcss`, `autoprefixer` (devDependencies)
- `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip` (dependencies)
- `class-variance-authority`, `clsx`, `tailwind-merge` (dependencies)

---

## Critères d'acceptation (DoD Standard)

### Machine green (bloquant)

- `pnpm --filter @carto-ecp/web typecheck` → exit 0 ✅
- `pnpm --filter @carto-ecp/web test` (vitest, 146 tests) → exit 0 ✅
- `pnpm --filter @carto-ecp/web build` → exit 0, `dist/fonts/*.woff2` présents ✅
- `pnpm --filter @carto-ecp/api test` → exit 0 (sanity backend, 313 tests) ✅
- `pnpm --filter @carto-ecp/web test:e2e` (playwright) → **1/7 specs vertes** (empty-state). Les 6 autres échecs sont pré-existants (Playwright 1.48→1.59 incompatibility + sélecteurs UI obsolètes) — hors scope 4a. À traiter dans une slice dédiée `fix/playwright-regression`.

### Smoke manuel (9 checkpoints)

Voir `docs/superpowers/plans/2026-04-23-ds-rte-slice-4a-foundation.md` task 13. Tous les 9 checkpoints validés manuellement par l'utilisateur, plus le bonus Nunito (4 WOFF2 servies en HTTP 200 depuis `/fonts/`, `font-family: Nunito` dans Computed styles).

### Anti-scope-creep

- `git diff main --name-only` ne liste aucun fichier dans `apps/web/src/components/{Admin,Map,DetailPanel,EnvSelector,TimelineSlider,UploadBatchTable}/` ni dans `apps/web/src/pages/` ✅
- `git diff main --name-only | grep -E "\.test\.|\.spec\."` vide ✅

---

## Transition vers Slice 4b

À la fin de 4a, `main` porte la version `v3.0-alpha.6`. La Slice 4b crée la couche `apps/web/src/components/ui/` (wrappers DS + composants maison `Table`, `RangeSlider`, `ColorField`, `DateTimeField`) et commence à restaurer l'esthétique en migrant le header global (`App.tsx` + `EnvSelector`). Elle doit notamment remplacer le string literal `font-family: "Nunito", sans-serif` de `globals.scss` par un token composé approprié du DS (ex: via `tokens.$heading-m-semibold-font-family` ou équivalent).
