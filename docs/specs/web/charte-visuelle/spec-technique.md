# Spec Technique — web/charte-visuelle

| Champ  | Valeur                                             |
|--------|----------------------------------------------------|
| Module | web/charte-visuelle                                |
| Version| 3.0-alpha.17                                       |
| Date   | 2026-04-23                                         |
| Source | Slice 5c — Upload & Map chrome (base : Slice 5b)   |

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

### Fonctionnalités de slices ultérieures (5b–5e) non présentes en Slice 5a

Les éléments suivants sont décrits dans la design spec mais n'étaient pas implémentés en Slice 5a — c'est normal, ils font l'objet des prochaines slices :

- **Slice 5b** : `App.module.scss` header sombre, `EnvSelector.module.scss`, `MapPage.module.scss`. **[LIVRÉ — voir §11]**
- **Slice 5c** : `UploadPage.module.scss`, `NetworkMap.module.scss`, `BaFilter.module.scss`, `NodeMarker.module.scss`, `TimelineSlider.module.scss`. **[LIVRÉ — voir §12]**
- **Slice 5d** : tous les `Admin/*.module.scss`, `DetailPanel/*.module.scss`, `UploadBatchTable.module.scss`, composants UI maison.
- **Slice 5e** : composants `Skeleton`, `EmptyState`, intégration Toast DS, script `check:no-hex`, audit axe-core.

---

## 11. Slice 5b — Shell & navigation (v3.0-alpha.16)

### 11.1 Périmètre

La Slice 5b applique les tokens `brand.scss` (Slice 5a) à la couche shell de l'application : header principal, sous-header de la carte, footer légende et fallback EnvSelector. Aucun overlay map (`NetworkMap`, `BaFilter`, `NodeMarker`, `TimelineSlider`) n'est touché — ceux-ci sont réservés à la Slice 5c.

### 11.2 Pattern d'import dans les module.scss

Tous les fichiers `.module.scss` de shell ajoutés en Slice 5b commencent par :

```scss
@use "@/styles/brand" as *;
```

L'alias `@` est résolu vers `apps/web/src/` via la config Vite (`resolve.alias` dans `vite.config.ts`). Ce pattern permet d'utiliser les mixins typographiques (`@include t-body`, `@include t-h2`, etc.) et toutes les CSS vars `--c-*`/`--t-*`/`--r-*`/`--layout-*`/`--motion-*`/`--shadow-*` sans répétition de chemin relatif.

### 11.3 Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `apps/web/src/App.module.scss` | Refonte complète : header dark 56px, brand avec accent cyan, brandMark + brandTagline, adminLink avec hover state, `--layout-header-h`/`--layout-page-px` |
| `apps/web/src/App.tsx` | Ajout des spans `brandMark` + `brandTagline` dans le `<Link>` brand |
| `apps/web/src/pages/MapPage.module.scss` | Refonte shell : états loading/error/empty tokenisés, sous-header map, `snapshotLabel` pill teal, footer légende avec `--c-border-subtle`, swatch `--r-xs`, counter `@include t-mono` |
| `apps/web/src/components/EnvSelector/EnvSelector.module.scss` | Fallback `.empty` : passage de hex `#6b7280` à `rgba(255,255,255,0.72)` + `@include t-small` |

### 11.4 Tokens consommés par fichier

#### `App.module.scss`

| Token | Usage |
|-------|-------|
| `--layout-header-h` | Hauteur fixe du header (56px) |
| `--layout-page-px` | Padding horizontal desktop |
| `--layout-page-px-mobile` | Padding horizontal ≤640px |
| `--c-surface-dark` | Fond header dark |
| `--c-surface-sunken` | Fond root + main |
| `--c-text-inverse` | Texte sur fond dark |
| `--c-primary` | Accent bar vertical brand + flèche adminLink |
| `--r-pill` | Border-radius de la barre accent |
| `--r-sm` | Border-radius adminLink hover |
| `--motion-fast` | Transition hover adminLink |
| `--t-body-size` | Font-size adminLink |
| `--t-body-strong-weight` | Font-weight adminLink |
| `@mixin t-h2` | Styles brandMark |
| `@mixin t-small` | Styles brandTagline |

#### `MapPage.module.scss`

| Token | Usage |
|-------|-------|
| `--c-text-muted` | État loading, snapshotLink, counter |
| `--c-error`, `--c-error-bg`, `--c-error-border` | Bloc erreur |
| `--r-md` | Border-radius bloc erreur |
| `--c-surface-sunken` | Fond empty state |
| `--c-text` | Texte emptyText, legendItem |
| `--c-primary-pressed` | Mot fort dans emptyText |
| `--c-primary` | Fond emptyButton + dot snapshotLabel |
| `--c-primary-hover` | Hover emptyButton |
| `--shadow-1`, `--shadow-2` | Ombres emptyButton |
| `--r-sm` | Border-radius emptyButton, snapshotLink |
| `--motion-fast` | Transitions hover |
| `--c-surface` | Fond root + header + footer |
| `--c-surface-deep` | Fond snapshotLabel |
| `--c-border-subtle` | Séparateurs header/footer |
| `--layout-page-px` | Padding header + footer |
| `--r-pill` | Border-radius snapshotLabel |
| `--r-xs` | Border-radius legendSwatch |
| `--t-body-strong-weight` | Font-weight legendItem |
| `--t-body-size` | Font-size emptyButton |
| `@mixin t-body` | États loading, error, emptyButton |
| `@mixin t-h2` | emptyText |
| `@mixin t-small` | Footer légende, legendItem |
| `@mixin t-caps` | snapshotLabel |
| `@mixin t-mono` | counter |

#### `EnvSelector.module.scss`

| Token | Usage |
|-------|-------|
| `@mixin t-small` | Taille et line-height du texte `.empty` |

*(Le fond dark du header est géré par `App.module.scss` — EnvSelector délègue au DS pour son rendu principal, les `--background-brand-*` surchargés en Slice 5a s'appliquent automatiquement.)*

### 11.5 Contrainte zero-hex

Zéro valeur hexadécimale codée en dur introduite en Slice 5b dans les fichiers de shell (conformément à l'objectif design spec §4.1). Exception documentée : `rgba(0, 189, 237, 0.12)` pour la bordure basse du header (accent cyan 12% opacité) — non tokenisé car valeur d'opacité non exposée en token. Cette exception sera revue en Slice 5e lors de l'audit `check:no-hex`.

### 11.6 Résultats des tests Slice 5b

- `pnpm --filter @carto-ecp/web test` : **157 passed**, 3 todo (inchangés).
- `pnpm typecheck` : 0 erreurs.
- `pnpm --filter @carto-ecp/web build` : bundle Vite OK, CSS **~194 KB** (vs ~190 KB Slice 5a).

---

## 12. Slice 5c — Upload & Map chrome (v3.0-alpha.17)

### 12.1 Périmètre

La Slice 5c tokenise les overlays de la vue Upload et de la vue Map qui n'avaient pas été touchés en Slice 5b. Elle couvre cinq fichiers `.module.scss` :

| Fichier | Composant | Avant 5c |
|---------|-----------|----------|
| `apps/web/src/pages/UploadPage.module.scss` | Page dépôt ZIP | Hex codés en dur, pas de tokens |
| `apps/web/src/components/Map/NetworkMap.module.scss` | Conteneur carte + toggle Hiérarchie CD | Couleur slate `#1e293b` codée en dur |
| `apps/web/src/components/Map/BaFilter.module.scss` | Popup filtres BA | Hex codés en dur, incohérence P2 ambre |
| `apps/web/src/components/Map/NodeMarker.module.scss` | Tooltip Leaflet (global) | Absent (styles inline ou hérités) |
| `apps/web/src/components/TimelineSlider/TimelineSlider.module.scss` | Slider temporal | Hex codés en dur, pas de custom track |

Le pattern d'import `@use "@/styles/brand" as *;` établi en Slice 5b est maintenu sans modification.

### 12.2 Détail par fichier

#### `UploadPage.module.scss` (286 lignes)

Refonte complète. Principaux éléments tokenisés :

| Élément | Token(s) |
|---------|---------|
| Dropzone zone — fond idle/hover/drag | `--c-surface-dark`, `--c-surface-deep`, `--c-primary` (border dashed cyan) |
| Dropzone animation pulse border cyan | `@keyframes` avec `--c-primary` (border-color) |
| Bouton primaire "Importer tout" | `--c-primary`, `--c-primary-hover`, `--c-primary-pressed`, `--shadow-1`, `--shadow-2` |
| Alertes (succès / erreur) | `--c-primary-soft`, `--c-error-bg`, `--c-error-border`, `--c-error` |
| Lien "Voir sur la carte" | `--c-surface-dark` (fond dark), `--c-primary` (flèche + accent), `--r-sm`, `--motion-fast` |
| Typographie | `@mixin t-h2`, `@mixin t-body`, `@mixin t-small`, `@mixin t-caps` |

#### `NetworkMap.module.scss`

Toggle "Hiérarchie CD" : fond idle remplacé de `#1e293b` (slate codé en dur) par `var(--c-surface-deep)` (teal dark `#0d2a31`). Cohérence garantie si le token est mis à jour.

#### `BaFilter.module.scss`

Popup de filtres BA refondue en dark pur :

| Élément | Token |
|---------|-------|
| Fond popup | `--c-surface-dark` |
| Texte items | `--c-text-inverse` (blanc) |
| Criticité P1 | `--c-error` (rouge) |
| Criticité P2 | `--c-primary` (teal cyan) — **résolution incohérence P2 ambre** |
| Criticité P3 | `--c-text-muted` (gris) |
| Séparateurs | `--c-border-subtle` |
| Border radius | `--r-md` |

**Résolution de l'incohérence P2** : avant 5c, la criticité P2 était rendue en ambre (`#f59e0b` ou équivalent) — couleur sans lien avec la palette projet. En Slice 5c, P2 est mappé sur `--c-primary` (cyan teal), cohérent avec la hiérarchie chromatique : P1=danger, P2=brand/teal, P3=muted.

#### `NodeMarker.module.scss`

Ajout d'un sélecteur `:global(.leaflet-tooltip)` pour styler les tooltips Leaflet en dark :

```scss
:global(.leaflet-tooltip) {
  background: var(--c-surface-dark);
  border-color: var(--c-border-subtle);
  color: var(--c-text-inverse);
  // ...
}
```

**Note technique** : les tooltips Leaflet sont montés par la bibliothèque en dehors du sous-arbre React du composant (dans `document.body`). CSS Modules scoped ne peut pas les atteindre. L'usage de `:global()` est intentionnel et documenté ici — c'est le seul moyen de styler ces éléments cross-subtree sans modifier le CSS global de `globals.scss`. Ce pattern est limité à `NodeMarker.module.scss` ; tout autre composant nécessitant un style global Leaflet doit procéder de la même façon plutôt que modifier `globals.scss`.

#### `TimelineSlider.module.scss`

Slider `<input type="range">` entièrement tokenisé :

| Élément | Token |
|---------|-------|
| Rail (track) | `--c-border-subtle` (fond) + `--c-primary` (portion remplie, WebKit `accent-color`) |
| Thumb | `--c-primary` fond, `--shadow-focus` au `:focus-visible` |
| Custom WebKit (`-webkit-slider-thumb`) | `background: var(--c-primary)`, `box-shadow: var(--shadow-focus)` |
| Custom Firefox (`-moz-range-thumb`) | Identique WebKit |
| Focus ring | `var(--c-primary)` outline via token `--shadow-focus` |
| Typographie label / compteur | `@mixin t-small`, `@mixin t-mono` |

### 12.3 Contrainte zero-hex

Slice 5c n'introduit aucun hex codé en dur dans les cinq fichiers modifiés. Exception héritée de Slice 5b : `rgba(0, 189, 237, 0.12)` pour la bordure basse du header dans `App.module.scss` — non concerné par cette slice, sera revu en Slice 5e.

### 12.4 Résultats des tests Slice 5c

- `pnpm --filter @carto-ecp/web test` : **157 passed**, 3 todo (inchangés).
- `pnpm typecheck` : 0 erreurs.
- `pnpm --filter @carto-ecp/web build` : bundle Vite OK, CSS **~203 KB** (+9 KB vs Slice 5b ~194 KB).

---
