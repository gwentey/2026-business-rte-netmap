# Spec Technique — web/ds-rte-foundation

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/ds-rte-foundation           |
| Version| 3.0-alpha.6                     |
| Date   | 2026-04-23                      |
| Source | Slice 4a — Foundation DS RTE    |

Accompagne [`spec-fonctionnel.md`](./spec-fonctionnel.md). Documente le pipeline technique, les fichiers créés/modifiés/supprimés, et les commandes de vérification.

---

## 1. Pipeline CSS — avant (main@fada20e)

```
apps/web/src/main.tsx
  └─ import './styles/globals.css'
       └─ @import 'leaflet/dist/leaflet.css'
       └─ @tailwind base
       └─ @tailwind components
       └─ @tailwind utilities
       └─ html/body { font-family: Inter, system-ui, sans-serif }

Vite → postcss.config.cjs → tailwindcss (via tailwind.config.ts) → autoprefixer
```

## 2. Pipeline CSS — après (fin Slice 4a)

```
apps/web/src/main.tsx
  ├─ import '@design-system-rte/react/style.css'   (1) DS composants
  ├─ import 'leaflet/dist/leaflet.css'              (2) Leaflet
  ├─ import './styles/fonts.scss'                   (3) @font-face Nunito
  └─ import './styles/globals.scss'                 (4) reset + overrides

Vite → css.preprocessorOptions.scss.additionalData
     → auto-inject `@use "@/styles/tokens" as tokens;` dans chaque *.module.scss
     → exceptions : tokens.scss (self-ref) et fonts.scss (pas besoin de tokens)

apps/web/src/styles/tokens.scss
  └─ @forward '@design-system-rte/core/design-tokens/main'

apps/web/src/styles/fonts.scss
  └─ 4 × @font-face Nunito → url('/fonts/nunito-*.woff2')

apps/web/src/styles/globals.scss
  └─ html/body/#root reset avec font-family: "Nunito", sans-serif
  └─ .leaflet-div-icon.carto-node-marker { background: transparent; border: none }

Servi statiquement par Vite :
  apps/web/public/fonts/nunito-{light-300,regular-400,semi-bold-600,bold-700}.woff2
```

**Note** : le plan initial référencait `tokens.$font-family-nunito` dans `globals.scss`. Ce token n'existe pas dans l'API publique de `@design-system-rte/core` (seuls les tokens composés comme `$heading-m-semibold-font-family` sont exposés). Le string literal `"Nunito", sans-serif` est utilisé à la place, à remplacer en Slice 4b.

---

## 3. Inventaire des fichiers

### Créés

- `apps/web/src/styles/tokens.scss` (4 lignes)
- `apps/web/src/styles/fonts.scss` (32 lignes, 4 `@font-face`)
- `apps/web/src/styles/globals.scss` (15 lignes)
- `apps/web/public/fonts/nunito-light-300.woff2` (~46 KB)
- `apps/web/public/fonts/nunito-regular-400.woff2` (~47 KB)
- `apps/web/public/fonts/nunito-semi-bold-600.woff2` (~47 KB)
- `apps/web/public/fonts/nunito-bold-700.woff2` (~46 KB)

### Modifiés

- `apps/web/package.json` — diff dependencies/devDependencies
- `apps/web/vite.config.ts` — ajout bloc `css.preprocessorOptions.scss.additionalData`
- `apps/web/src/main.tsx` — 4 imports CSS/SCSS ordonnés
- `CHANGELOG.md` — entrée `v3.0-alpha.6` en tête de `[Unreleased]`

### Supprimés

- `apps/web/tailwind.config.ts`
- `apps/web/postcss.config.cjs`
- `apps/web/src/styles/globals.css`

### Explicitement non touchés

Tous les fichiers `.tsx` dans `apps/web/src/components/` et `apps/web/src/pages/`, les tests, `tsconfig.json`, `env.d.ts`, `lib/`, `store/`.

---

## 4. Packages

### Installation

```bash
pnpm --filter @carto-ecp/web add @design-system-rte/react@^1.8.0 @design-system-rte/core@^1.7.0
pnpm --filter @carto-ecp/web add -D sass@^1.85.1
```

`sass` est résolu à `^1.99.0` par pnpm (range `^1.85.1` satisfait par la dernière version).

### Désinstallation

```bash
pnpm --filter @carto-ecp/web remove \
  @radix-ui/react-dialog @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-tooltip \
  class-variance-authority clsx tailwind-merge

pnpm --filter @carto-ecp/web remove -D tailwindcss postcss autoprefixer
```

Vérification préalable qu'aucun import n'existe :

```bash
grep -rE "from '(@radix-ui|class-variance-authority|clsx|tailwind-merge)" apps/web/src
```

Doit retourner vide avant désinstallation. Vérifié ✅.

---

## 5. Copie des WOFF2

```bash
mkdir -p apps/web/public/fonts
cp node_modules/@design-system-rte/core/assets/fonts/nunito-light-300.woff2 apps/web/public/fonts/
cp node_modules/@design-system-rte/core/assets/fonts/nunito-regular-400.woff2 apps/web/public/fonts/
cp node_modules/@design-system-rte/core/assets/fonts/nunito-semi-bold-600.woff2 apps/web/public/fonts/
cp node_modules/@design-system-rte/core/assets/fonts/nunito-bold-700.woff2 apps/web/public/fonts/
```

Ces 4 fichiers sont **trackés dans git** (petits WOFF2, ~186 KB total).

---

## 6. Commandes de vérification

### Machine green

```bash
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/web test
pnpm --filter @carto-ecp/web build
pnpm --filter @carto-ecp/api test
```

### Playwright (partiel — regressions pré-existantes)

```bash
pnpm --filter @carto-ecp/web test:e2e
```

Seule `empty-state.spec.ts` passe. Les 6 autres specs ont des régressions pré-existantes :
- `multi-upload.spec.ts` : SyntaxError Playwright 1.59 vs tsconfig.playwright.json CommonJS
- `env-switch.spec.ts`, `select-node.spec.ts`, `snapshot-switch.spec.ts`, `upload-then-map.spec.ts`, `upload-to-map.spec.ts` : sélecteurs UploadPage obsolètes

Correction prévue dans slice séparée `fix/playwright-regression`.

### Anti-scope-creep

```bash
git diff main --stat | head -30
git diff main --name-only | grep -E "apps/web/src/(components|pages|lib|store)/" || echo "OK"
git diff main --name-only | grep -E "\.test\.|\.spec\." || echo "OK"
```

### Vérification Nunito chargée en runtime

DevTools navigateur → Network → filtre "font" → hard reload → les 4 `nunito-*.woff2` doivent être servis en HTTP 200 depuis `/fonts/`.
Elements → `<body>` → Computed → `font-family: Nunito`.

---

## 7. Risques techniques et mitigations

| Risque | Mitigation |
|---|---|
| `sass` en peer dep du DS core requiert build-script post-install | Observé : pnpm a résolu `sass@^1.99.0` sans alerte de build script. Pas d'action requise sur `onlyBuiltDependencies`. |
| Vite résout mal `url('@design-system-rte/...')` dans SCSS | Les 4 WOFF2 sont copiés dans `apps/web/public/fonts/` et référencés en chemin absolu `/fonts/` — pas de résolution node_modules dans `url()` |
| `additionalData` SCSS ré-injecte dans `tokens.scss` (self-reference Sass error) | La fonction `additionalData` exclut `tokens.scss` ET `fonts.scss`. Le `@use './tokens' as tokens;` initialement prévu dans `globals.scss` a été retiré après détection de collision double-namespace en code review. Le tokens namespace est désormais fourni par l'injection automatique uniquement. |
| `@design-system-rte/react/style.css` override nos `globals.scss` | Ordre imports main.tsx : DS en 1er, nos globals en 4e (dernier) — nos règles gagnent par cascade CSS |
| Tests E2E qui utilisent des classes Tailwind | Vérifié : aucun sélecteur Tailwind dans `apps/web/e2e/` (tout en `.leaflet-container`, `header select`, `aside`, `input[type="file"]` — HTML/Leaflet natifs) |
| Bundle size augmente (DS CSS + fonts) | Acceptable en dev-local. À re-évaluer en Slice 4e si la prod est envisagée. |
| Sass deprecation warnings (`legacy-js-api`) | Émis par `sass@1.99.0` car Vite 5.4 utilise l'ancienne Sass JS API. Pas d'impact — warnings seront résolus par une future version de Vite. |
| Token `$font-family-nunito` inexistant dans l'API publique du DS | String literal `"Nunito", sans-serif` utilisé temporairement dans `globals.scss`. À remplacer en Slice 4b par un token composé du DS. |

---

## 8. Transition vers Slice 4b

`feat/ds-rte-components-base` part de `main` @ `v3.0-alpha.6`. Elle crée `apps/web/src/components/ui/` (Button, TextInput, Textarea, Select, Checkbox, Badge, Tag, Chip, Modal, Tooltip, Tab, Loader, Toast, Banner, Drawer, Popover, FileUpload, Icon, Link) + composants maison (`Table`, `RangeSlider`, `ColorField`, `DateTimeField`) consommant les tokens SCSS mis en place par cette Slice 4a.
