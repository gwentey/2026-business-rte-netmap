# Spec Technique — web/charte-visuelle

| Champ  | Valeur                                     |
|--------|--------------------------------------------|
| Module | web/charte-visuelle                        |
| Version| 3.0-alpha.15                               |
| Date   | 2026-04-23                                 |
| Source | Slice 5a — Foundation charte web/marketing |

Accompagne [`spec-fonctionnel.md`](./spec-fonctionnel.md). Documente l'architecture des fichiers, le pipeline CSS, les CSS vars exposées, les mixins et les tests de contraste.

---

## 1. Contexte et point de départ

La Slice 5a intervient après la migration DS RTE (Slices 4a → 4e, ADRs 037/038, commit `04ceb8b`). L'état du pipeline CSS au départ :

```
apps/web/src/main.tsx
  ├─ import '@design-system-rte/react/style.css'   (1) DS — palette rouge corporate
  ├─ import 'leaflet/dist/leaflet.css'              (2) Leaflet
  ├─ import './styles/fonts.scss'                   (3) @font-face Nunito
  └─ import './styles/globals.scss'                 (4) reset léger + marker Leaflet
```

Problème : le DS injecte ~60 CSS custom properties (`--background-brand-*`, `--content-brand-*`, etc.) avec des valeurs rouge corporate. Ces vars pilotent le rendu des 41 composants DS utilisés dans `apps/web/src/`.

---

## 2. Pipeline CSS — après Slice 5a

```
apps/web/src/main.tsx
  ├─ import '@design-system-rte/react/style.css'   (1) DS — palette rouge (inchangée)
  ├─ import 'leaflet/dist/leaflet.css'              (2) Leaflet (inchangé)
  ├─ import './styles/fonts.scss'                   (3) @font-face Nunito (inchangé)
  └─ import './styles/globals.scss'                 (4) orchestrateur — MODIFIÉ

apps/web/src/styles/globals.scss
  ├─ @use 'brand'         (A) tokens app — CSS vars --c-* sur :root
  ├─ @use 'ds-override'   (B) surcharge des CSS vars du DS vers --c-*
  └─ @use 'reset'         (C) reset moderne + focus-visible cyan
  + html/body/#root { height: 100%; }
  + .leaflet-div-icon.carto-node-marker { background: transparent; border: none; }
```

L'ordre des `@use` est critique : `brand` doit précéder `ds-override` (qui consomme `var(--c-*)` via cascade CSS) et `reset` (qui consomme `var(--c-primary)` pour le focus ring).

---

## 3. Inventaire des fichiers

### Créés

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `apps/web/src/styles/brand.scss` | 158 | Source unique des tokens app (`--c-*`, `--r-*`, `--shadow-*`, `--motion-*`, `--t-*`, `--layout-*`) — déclarés sur `:root`. Expose aussi 9 mixins SCSS typographiques. |
| `apps/web/src/styles/ds-override.scss` | 111 | Remapping des ~60 CSS custom properties du DS RTE vers les tokens `--c-*`. Appliqué en cascade après le CSS du DS. |
| `apps/web/src/styles/reset.scss` | 106 | Reset CSS moderne : box-model, typographie de base, focus-visible cyan universel, `prefers-reduced-motion`. |
| `apps/web/src/styles/_contrast.ts` | 30 | Lib TypeScript WCAG 2.1 : `contrastRatio(fg: string, bg: string): number`. Hex 6 chiffres seulement. Exported. |
| `apps/web/src/styles/brand.test.ts` | 104 | 13 assertions Vitest vérifiant les ratios AA/AA_LARGE des combinaisons text/fond critiques. 1 suite informationnelle (log only). |

### Modifiés

| Fichier | Nature de la modification |
|---------|--------------------------|
| `apps/web/src/styles/globals.scss` | Ajout des 3 `@use` (`brand`, `ds-override`, `reset`) avec commentaire d'ordre critique. Le contenu existant (height 100%, marker Leaflet) est conservé. |
| `CHANGELOG.md` | Entrée `v3.0-alpha.15` sous `[Unreleased]`. |

### Créés (docs)

| Fichier | Rôle |
|---------|------|
| `docs/adr/ADR-039-charte-web-marketing-surcharge-ds.md` | ADR justifiant l'Option A (surcharge CSS vars) vs fork vs duplication |
| `docs/superpowers/specs/2026-04-23-charte-web-marketing-design.md` | Design spec complète des 5 slices (5a → 5e) |
| `docs/superpowers/plans/2026-04-23-web-charte-slice-5a-foundation.md` | Plan d'exécution Slice 5a |

---

## 4. Détail de `brand.scss`

### 4.1 Structure interne

```
:root
  ├── Palette         (--c-primary, --c-primary-hover, --c-primary-pressed, --c-primary-soft)
  │                   (--c-surface-dark, --c-surface-deep, --c-surface, --c-surface-sunken)
  │                   (--c-border-subtle, --c-border-strong)
  │                   (--c-text, --c-text-muted, --c-text-disabled, --c-text-inverse, --c-text-link)
  │                   (--c-error, --c-error-bg, --c-error-border)
  ├── Radius          (--r-xs, --r-sm, --r-md, --r-lg, --r-pill)
  ├── Elevation       (--shadow-0 à --shadow-3, --shadow-focus, --shadow-error-focus)
  ├── Motion          (--motion-fast, --motion-std, --motion-slow)
  ├── Typography      (--font-family-base, --font-family-mono)
  │                   (--t-display-*, --t-h1-* à --t-h3-*, --t-body-*, --t-small-*, --t-caps-*, --t-mono-*)
  └── Layout          (--layout-header-h, --layout-page-px, --layout-page-px-mobile,
                       --layout-page-max-w, --layout-map-toolbar-gap)

Mixins SCSS (9)
  @mixin t-display
  @mixin t-h1 … t-h3
  @mixin t-body, @mixin t-body-strong
  @mixin t-small
  @mixin t-caps
  @mixin t-mono
```

### 4.2 Conventions de nommage des tokens

- `--c-*` : couleurs
- `--r-*` : radius
- `--shadow-*` : ombres / elevation
- `--motion-*` : durées d'animation
- `--t-*` : typographie (`t-<niveau>-<propriété>`)
- `--layout-*` : dimensions de mise en page globale
- `--font-family-*` : polices

### 4.3 Tokens typographiques

| Niveau | size | weight | line-height | Autre |
|--------|------|--------|-------------|-------|
| display | 28px | 700 | 1.2 | — |
| h1 | 22px | 700 | 1.3 | — |
| h2 | 18px | 600 | 1.35 | — |
| h3 | 15px | 600 | 1.4 | — |
| body | 14px | 400 | 1.55 | `--t-body-strong-weight: 600` |
| small | 12px | 400 | 1.5 | — |
| caps | 11px | 700 | 1.4 | `letter-spacing: 0.08em`, `text-transform: uppercase` |
| mono | 13px | 400 | 1.5 | `font-family: var(--font-family-mono)` |

---

## 5. Détail de `ds-override.scss`

Remapping exhaustif des CSS custom properties du DS RTE extraites par grep sur `node_modules/@design-system-rte/react/dist/style.css`. Groupées par catégorie :

| Groupe | Vars remappées | Vers |
|--------|---------------|------|
| `--background-brand-*` | 10 vars | `--c-primary*`, `--c-surface-dark`, `--c-surface-deep`, `--c-primary-soft` |
| `--background-*` (neutres) | 5 vars | `--c-surface*` |
| `--background-neutral-*` | 6 vars | `--c-surface*` |
| `--background-danger/info/success/warning` | 4 vars | `--c-error`, `--c-primary-soft`, teal, dark |
| `--border-brand-*` | 4 vars | `--c-primary`, `rgba(255,255,255,.12)` |
| `--border-*` (neutres et statuts) | 8 vars | `--c-border-*`, `--c-error` |
| `--content-primary/secondary/tertiary/inverse/disabled` | 5 vars | `--c-text*` |
| `--content-brand-*` | 5 vars | `--c-primary*`, `--c-text-inverse` |
| `--content-danger/info/success/warning/status` | 5 vars | `--c-error`, `--c-primary-pressed`, `--c-surface-deep`, `--c-text` |
| `--content-link-*` (8 variants) | 8 vars | `--c-text-link`, `--c-primary*` |
| `--elevation-shadow-*` | 4 vars | `--shadow-1`, `--shadow-2`, `--shadow-focus`, rgba cyan |
| `--brand-default` | 1 var | `--c-primary` |

**Non surchargés intentionnellement** : les `--decorative-*` (illustrations/charts DS), les `--process-*` (data-driven métier carto), les tokens de layout internes DS.

---

## 6. Détail de `reset.scss`

```
* { box-sizing: border-box }
html { -webkit-font-smoothing: antialiased; text-size-adjust: 100% }
body { margin: 0; font-family/size/weight/lh/color/background depuis tokens --c-* et --t-body-* }
*:focus { outline: none }
*:focus-visible { outline: 3px solid var(--c-primary); outline-offset: 2px; border-radius: var(--r-xs) }
h1…h6 { margin: 0; color: var(--c-text) }
p { margin: 0 }
a { color: var(--c-text); text-decoration-color: var(--c-primary); transition via --motion-fast }
a:hover { color: var(--c-primary-pressed) }
button { font-family/size/line-height: inherit }
input, textarea, select { font-family/font-size: inherit }
img, svg, video { max-width: 100%; height: auto; display: block }
@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important } }
```

---

## 7. Détail de `_contrast.ts` et `brand.test.ts`

### `_contrast.ts`

Utilitaire TypeScript pur, sans dépendance externe :

```typescript
export function contrastRatio(fg: string, bg: string): number
```

- Accepte uniquement les hex 6 chiffres (`#rrggbb`). Lance une `Error` pour tout autre format.
- Implémente WCAG 2.1 : conversion sRGB → luminance relative → ratio `(L1 + 0.05) / (L2 + 0.05)`.
- Importé dans `brand.test.ts` via l'alias `./_contrast.js` (résolution ESM Vitest).

### `brand.test.ts`

- 2 suites Vitest : `'brand tokens — WCAG AA contrast'` (13 `it` avec assertions) + `'brand tokens — informational contrasts (log only, not asserted)'` (1 `it` informationnelle avec `console.log`).
- Les tokens sont miroirs des valeurs de `brand.scss` (déclarés en `const TOKENS` en tête du fichier).
- Constantes : `AA_TEXT = 4.5`, `AA_LARGE = 3.0`.
- La suite informationnelle logue les ratios de `text-inverse on primary` (2.9 — usage interdit comme texte body) et `primary on surface` (< 3.0 — usage décoratif icône uniquement).

**Résultat à l'exécution** : 13/13 assertions passent. La suite totale `apps/web` passe 157/160 tests (3 `.todo` sans lien avec cette slice).

---

## 8. Surcharge DS — mécanisme de cascade

Le DS RTE injecte ses CSS vars dans un sélecteur `:root` en tête de son `style.css`. `ds-override.scss`, appliqué après via `globals.scss`, redéclare les mêmes noms de vars dans un `:root` qui arrive plus tard dans la cascade CSS — le dernier `:root` gagne (spécificité égale, ordre source déterminant).

Cela signifie que **tout composant DS** qui consomme `var(--background-brand-default)` lira désormais `var(--c-primary)` = `#00bded`. Aucun composant DS n'a besoin d'être modifié.

**Limite connue** : certains composants DS peuvent avoir des hex ou des rgba compilés en dur dans leur SCSS interne (non exposés comme CSS vars). Ces cas seront identifiés et traités en Slice 5b lors du premier audit visuel des composants DS effectivement rendus.

---

## 9. Tests

### Tests écrits dans cette slice

| Fichier | Suite | Assertions |
|---------|-------|-----------|
| `apps/web/src/styles/brand.test.ts` | `brand tokens — WCAG AA contrast` | 13 |
| `apps/web/src/styles/brand.test.ts` | `brand tokens — informational contrasts` | 1 (log only) |

### Résultats

- `pnpm --filter @carto-ecp/web test` : 157 passed, 3 todo (les 3 todo sont dans d'autres modules, présents avant cette slice).
- `pnpm typecheck` : 0 erreurs.
- `pnpm --filter @carto-ecp/web build` : bundle Vite OK, CSS bundle ~190 KB gzippé.

---

## 10. Écarts spec/implémentation (Slice 5a uniquement)

### Écarts mineurs dans `brand.scss`

La spec `2026-04-23-charte-web-marketing-design.md` §3.1 indique `--c-text-link: var(--c-primary)`. L'implémentation utilise `--c-text-link: var(--c-primary-pressed)` (`#0090b4`). Ce choix est documenté dans les tests (`brand.test.ts` commentaire sur `primary-pressed as DS link color`) : `--c-primary` pur (`#00bded`) ne passe pas le seuil AA 3.0 sur fond blanc comme texte lien, tandis que `--c-primary-pressed` atteint AA_LARGE (ratio ≥ 3.0). Le remapping DS dans `ds-override.scss` utilise `--c-primary-pressed` pour `--content-link-default`.

La spec §3.1 indique `--c-text-disabled: #94a3b1`. L'implémentation utilise `#7a8a95`. Les deux valeurs ont été envisagées ; `#7a8a95` est plus proche du teal et passe quand même le seuil AA_LARGE (exempt WCAG pour les états disabled).

### Fonctionnalités de slices ultérieures (5b–5e) non présentes

Les éléments suivants sont décrits dans la design spec mais ne sont pas implémentés en Slice 5a — c'est normal, ils font l'objet des prochaines slices :

- **Slice 5b** : `App.module.scss` header sombre, `EnvSelector.module.scss`, `MapPage.module.scss`.
- **Slice 5c** : `UploadPage.module.scss`, `NetworkMap.module.scss`, `BaFilter.module.scss`, `TimelineSlider.module.scss`, `NodeMarker.module.scss`.
- **Slice 5d** : tous les `Admin/*.module.scss`, `DetailPanel/*.module.scss`, `UploadBatchTable.module.scss`, composants UI maison.
- **Slice 5e** : composants `Skeleton`, `EmptyState`, intégration Toast DS, script `check:no-hex`, audit axe-core.

---
