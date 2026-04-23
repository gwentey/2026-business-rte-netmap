# Slice 4a — Fondation du Design System RTE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installer `@design-system-rte/react@^1.8.0` + `@design-system-rte/core@^1.7.0`, retirer totalement Tailwind, câbler les tokens SCSS via Vite `css.preprocessorOptions`, charger la police officielle Nunito depuis `apps/web/public/fonts/`, rédiger ADR-037 + specs + CHANGELOG v3.0-alpha.6 — sans toucher aucun composant métier.

**Architecture:** Slice monolithique "Foundation strict" sur la branche `feat/ds-rte-foundation` (déjà créée depuis `main@fada20e`, contient commit `6d89fdc` avec le design doc). Le pipeline CSS passe de Tailwind+PostCSS vers SCSS natif Vite avec auto-import de tokens. Régression visuelle temporaire assumée jusqu'à Slice 4b — les `className="bg-rte..."` dans les 40+ composants métier deviennent des classes inertes (aucune modif de code métier en 4a).

**Tech Stack:** React 18.3 + Vite 5.4 + TypeScript 5.5 + SCSS + `@design-system-rte/react@^1.8.0` + `@design-system-rte/core@^1.7.0` + `sass@^1.85.1` + pnpm workspaces.

---

## File Structure

### Files to create (10)

| Path | Responsibility |
|---|---|
| `apps/web/src/styles/tokens.scss` | `@forward` tous les tokens SCSS du DS RTE core (spacing, radius, typography, elevation, opacity, layout) |
| `apps/web/src/styles/fonts.scss` | 4 × `@font-face` Nunito (300/400/600/700) pointant vers `/fonts/nunito-*.woff2` |
| `apps/web/src/styles/globals.scss` | Reset HTML + `font-family: tokens.$font-family-nunito` + override `.leaflet-div-icon.carto-node-marker` |
| `apps/web/public/fonts/nunito-light-300.woff2` | WOFF2 copié depuis `node_modules/@design-system-rte/core/assets/fonts/` |
| `apps/web/public/fonts/nunito-regular-400.woff2` | idem |
| `apps/web/public/fonts/nunito-semi-bold-600.woff2` | idem |
| `apps/web/public/fonts/nunito-bold-700.woff2` | idem |
| `docs/adr/ADR-037-adoption-design-system-rte.md` | ADR Zelian décision d'adopter le DS RTE |
| `docs/specs/web/ds-rte-foundation/spec-fonctionnel.md` | Spec T6 Zelian — contexte, règles, DoD |
| `docs/specs/web/ds-rte-foundation/spec-technique.md` | Spec T6 Zelian — pipeline CSS, contenu fichiers, packages, procédure |

### Files to modify (4)

| Path | Changes |
|---|---|
| `apps/web/package.json` | +dependencies: `@design-system-rte/react@^1.8.0`, `@design-system-rte/core@^1.7.0`. +devDependencies: `sass@^1.85.1`. −dependencies: 4× `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`. −devDependencies: `tailwindcss`, `postcss`, `autoprefixer`. |
| `apps/web/vite.config.ts` | +`css.preprocessorOptions.scss.additionalData` (fonction excluant `tokens.scss` et `fonts.scss`) |
| `apps/web/src/main.tsx` | Remplacer `import './styles/globals.css'` par 4 imports ordonnés (DS → Leaflet → fonts → globals) |
| `CHANGELOG.md` | Ajout entrée `v3.0-alpha.6` en tête de `[Unreleased]` |

`pnpm-workspace.yaml` : possible modification (ajout de `sass` à `onlyBuiltDependencies` SI `pnpm install` le demande — conditionnel, task dédiée).

### Files to delete (3)

| Path | Reason |
|---|---|
| `apps/web/tailwind.config.ts` | Tailwind retiré |
| `apps/web/postcss.config.cjs` | Plus de PostCSS, Vite SCSS natif |
| `apps/web/src/styles/globals.css` | Remplacé par `globals.scss` |

### Files explicitly untouched

- Tous les `.tsx` dans `apps/web/src/components/{Admin,Map,DetailPanel,EnvSelector,TimelineSlider,UploadBatchTable}/`
- Tous les `.tsx` dans `apps/web/src/pages/`
- `apps/web/tsconfig.json` (alias `@` déjà en place)
- `apps/web/src/env.d.ts` (déjà minimal, stub leaflet-curve inexistant)
- `apps/web/src/lib/process-colors.ts` (migré en 4c/4e)
- `apps/web/src/store/app-store.ts`
- Tous les `*.test.tsx` et `apps/web/e2e/*.spec.ts`

### Commits prévus (3)

1. `feat(web): slice 4a foundation — install DS RTE + pipeline SCSS + Nunito` (tasks 1–9)
2. `chore(web): slice 4a — retrait Tailwind + deps UI mortes` (tasks 10–12)
3. `docs(web): slice 4a — ADR-037 + specs ds-rte-foundation + CHANGELOG v3.0-alpha.6` (tasks 15–18)

Le smoke manuel (task 13) + anti-scope-creep (task 14) + PR MCP GitHub (task 19) sont des étapes de validation/livraison, pas des commits.

---

## Task 1: Preflight — vérifier état git

**Files:** aucun

- [ ] **Step 1.1: Vérifier la branche active**

Run:
```bash
git branch --show-current
```
Expected output: `feat/ds-rte-foundation`

Si la sortie est différente, stop et diagnostiquer (le brainstorming a créé cette branche depuis main@fada20e avec le commit 6d89fdc contenant le design doc).

- [ ] **Step 1.2: Vérifier le SHA HEAD**

Run:
```bash
git log --oneline -1
```
Expected output commence par `6d89fdc docs(web): spec design Slice 4a`.

- [ ] **Step 1.3: Vérifier git status propre**

Run:
```bash
git status --short
```
Expected output: vide (aucun fichier modifié ou non tracké).

- [ ] **Step 1.4: Vérifier que main est à fada20e**

Run:
```bash
git log main --oneline -1
```
Expected output commence par `fada20e feat(web): bouton "Tout exporter"`.

---

## Task 2: Installer les packages DS RTE

**Files:** `apps/web/package.json`, `pnpm-lock.yaml` (modifiés par pnpm)

- [ ] **Step 2.1: Installer @design-system-rte/react + core**

Run:
```bash
pnpm --filter @carto-ecp/web add @design-system-rte/react@^1.8.0 @design-system-rte/core@^1.7.0
```
Expected: `Progress: resolved X, reused Y, downloaded Z, added 2` + message pnpm sans erreur.

- [ ] **Step 2.2: Installer sass en devDependency**

Run:
```bash
pnpm --filter @carto-ecp/web add -D sass@^1.85.1
```
Expected: install sans erreur.

- [ ] **Step 2.3: Vérifier présence dans node_modules**

Run:
```bash
ls node_modules/@design-system-rte/
ls node_modules/@design-system-rte/core/assets/fonts/
```
Expected sortie 1: `core  react`
Expected sortie 2: 4 fichiers WOFF2 : `nunito-bold-700.woff2`, `nunito-light-300.woff2`, `nunito-regular-400.woff2`, `nunito-semi-bold-600.woff2` (+ éventuel `.DS_Store`).

- [ ] **Step 2.4: Vérifier `onlyBuiltDependencies` dans pnpm-workspace.yaml**

Run:
```bash
grep -A 10 "onlyBuiltDependencies" pnpm-workspace.yaml
```
Si la sortie du `pnpm add` précédent n'a PAS affiché de warning `Ignored build scripts` mentionnant sass, aucune modification requise. Sinon, ajouter `sass` à la liste.

Dans 99% des cas : sass est pure-JS, aucune action requise.

- [ ] **Step 2.5: Vérifier typecheck (Tailwind toujours présent à ce stade)**

Run:
```bash
pnpm --filter @carto-ecp/web typecheck
```
Expected: exit code 0, aucune erreur TypeScript.

---

## Task 3: Copier les 4 WOFF2 Nunito dans apps/web/public/fonts/

**Files:**
- Create: `apps/web/public/fonts/nunito-light-300.woff2`
- Create: `apps/web/public/fonts/nunito-regular-400.woff2`
- Create: `apps/web/public/fonts/nunito-semi-bold-600.woff2`
- Create: `apps/web/public/fonts/nunito-bold-700.woff2`

- [ ] **Step 3.1: Créer le dossier de destination**

Run:
```bash
mkdir -p apps/web/public/fonts
```
Expected: aucune sortie (ou warning "File exists" si déjà créé).

- [ ] **Step 3.2: Copier les 4 fichiers WOFF2**

Run:
```bash
cp node_modules/@design-system-rte/core/assets/fonts/nunito-light-300.woff2 apps/web/public/fonts/
cp node_modules/@design-system-rte/core/assets/fonts/nunito-regular-400.woff2 apps/web/public/fonts/
cp node_modules/@design-system-rte/core/assets/fonts/nunito-semi-bold-600.woff2 apps/web/public/fonts/
cp node_modules/@design-system-rte/core/assets/fonts/nunito-bold-700.woff2 apps/web/public/fonts/
```
Expected: aucune sortie (cp silencieux en cas de succès).

- [ ] **Step 3.3: Vérifier les 4 fichiers présents**

Run:
```bash
ls -la apps/web/public/fonts/
```
Expected: 4 fichiers WOFF2 listés avec taille > 0 (chacun ~20-30 KB).

---

## Task 4: Créer apps/web/src/styles/tokens.scss

**Files:**
- Create: `apps/web/src/styles/tokens.scss`

- [ ] **Step 4.1: Créer le fichier avec le contenu exact**

Créer `apps/web/src/styles/tokens.scss` avec :

```scss
// Forward tout ce que le DS RTE expose :
// - tokens publics : spacing, typography, border/radius, elevation, opacity, layout
// - abstractions : mixins neutral-shadow-*, brand-shadow-*, themes
@forward '@design-system-rte/core/design-tokens/main';
```

- [ ] **Step 4.2: Vérifier la création**

Run:
```bash
cat apps/web/src/styles/tokens.scss
```
Expected: le contenu ci-dessus affiché, 4 lignes au total.

---

## Task 5: Créer apps/web/src/styles/fonts.scss

**Files:**
- Create: `apps/web/src/styles/fonts.scss`

- [ ] **Step 5.1: Créer le fichier avec les 4 @font-face**

Créer `apps/web/src/styles/fonts.scss` avec :

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

- [ ] **Step 5.2: Vérifier le contenu**

Run:
```bash
cat apps/web/src/styles/fonts.scss
```
Expected: 4 blocs `@font-face` identiques au contenu ci-dessus.

---

## Task 6: Créer apps/web/src/styles/globals.scss

**Files:**
- Create: `apps/web/src/styles/globals.scss`

- [ ] **Step 6.1: Créer le fichier avec reset + override marker**

Créer `apps/web/src/styles/globals.scss` avec :

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

- [ ] **Step 6.2: Vérifier le contenu**

Run:
```bash
cat apps/web/src/styles/globals.scss
```
Expected: le contenu ci-dessus, 16 lignes.

---

## Task 7: Mettre à jour apps/web/vite.config.ts

**Files:**
- Modify: `apps/web/vite.config.ts`

- [ ] **Step 7.1: Remplacer le contenu du fichier**

Le fichier actuel ne contient PAS de bloc `css`. Remplacer le contenu complet de `apps/web/vite.config.ts` par :

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

- [ ] **Step 7.2: Vérifier le diff**

Run:
```bash
git diff apps/web/vite.config.ts
```
Expected: un bloc `css: { preprocessorOptions: ... }` ajouté entre `resolve` et `server`. Le reste inchangé.

---

## Task 8: Mettre à jour apps/web/src/main.tsx

**Files:**
- Modify: `apps/web/src/main.tsx`

Le fichier actuel (7 lignes utiles) :
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

- [ ] **Step 8.1: Remplacer l'import CSS par 4 imports ordonnés**

Remplacer l'unique ligne `import './styles/globals.css';` par 4 lignes :

```tsx
// Ordre des styles — important :
import '@design-system-rte/react/style.css';  // 1. DS RTE : composants pré-stylés + reset
import 'leaflet/dist/leaflet.css';             // 2. Leaflet : pour la carte
import './styles/fonts.scss';                  // 3. Nunito @font-face
import './styles/globals.scss';                // 4. Overrides projet (passe en dernier)
```

Le fichier final de `apps/web/src/main.tsx` devient :

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

- [ ] **Step 8.2: Vérifier le diff**

Run:
```bash
git diff apps/web/src/main.tsx
```
Expected: 1 ligne supprimée (`import './styles/globals.css';`), 5 lignes ajoutées (le commentaire + 4 imports).

---

## Task 9: Green gate intermédiaire (avant suppression Tailwind) + premier commit

**Files:** aucun (vérifications)

À ce stade, le DS est installé, les fichiers SCSS existent, mais Tailwind est encore présent. L'app doit continuer de fonctionner — les deux systèmes coexistent temporairement. On vérifie cet état intermédiaire.

- [ ] **Step 9.1: Typecheck**

Run:
```bash
pnpm --filter @carto-ecp/web typecheck
```
Expected: exit 0.

Si erreur : l'import `import '@design-system-rte/react/style.css'` peut demander une déclaration module si TypeScript est strict. Dans ce cas, vérifier que le package expose bien des types (il le fait via son `types: ./dist/index.d.ts`). L'import CSS ne nécessite pas de déclaration car `vite/client` ambient types couvre `.css`.

- [ ] **Step 9.2: Build**

Run:
```bash
pnpm --filter @carto-ecp/web build
```
Expected: exit 0, dossier `apps/web/dist/` généré, 4 WOFF2 présents dans `apps/web/dist/fonts/`.

Vérifier :
```bash
ls apps/web/dist/fonts/ 2>/dev/null
```
Expected: 4 WOFF2 (Vite copie automatiquement `public/` → `dist/`).

- [ ] **Step 9.3: Vitest**

Run:
```bash
pnpm --filter @carto-ecp/web test
```
Expected: exit 0, ~144 tests verts.

- [ ] **Step 9.4: Premier commit (ajouts uniquement)**

Run:
```bash
git add apps/web/package.json pnpm-lock.yaml \
        apps/web/public/fonts/ \
        apps/web/src/styles/tokens.scss \
        apps/web/src/styles/fonts.scss \
        apps/web/src/styles/globals.scss \
        apps/web/vite.config.ts \
        apps/web/src/main.tsx
git status --short
```
Vérifier que la liste stagée correspond bien aux ajouts attendus (pas de fichier dans components/, pages/, etc.).

- [ ] **Step 9.5: Créer le commit 1**

Run:
```bash
git commit -m "$(cat <<'EOF'
feat(web): slice 4a foundation — install DS RTE + pipeline SCSS + Nunito

Installe @design-system-rte/react@^1.8.0 + @design-system-rte/core@^1.7.0
+ sass@^1.85.1. Met en place le pipeline SCSS avec tokens auto-injectés
via vite.config.ts (css.preprocessorOptions.scss.additionalData).

Charge la police officielle Nunito (4 poids : 300/400/600/700, WOFF2)
servie depuis apps/web/public/fonts/.

Crée apps/web/src/styles/{tokens,fonts,globals}.scss.
Modifie apps/web/src/main.tsx pour importer dans l'ordre :
DS RTE → Leaflet → fonts → globals.

À ce stade, Tailwind coexiste encore avec le DS — suppression en commit
suivant (task 10-12). Aucun composant métier touché.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit créé, output `1 file changed...` récap.

- [ ] **Step 9.6: Vérifier l'état git**

Run:
```bash
git log --oneline -3
git status --short
```
Expected log : le nouveau commit + `6d89fdc` design doc + ... Expected status : vide.

---

## Task 10: Retirer les 7 deps UI mortes

**Files:** `apps/web/package.json`, `pnpm-lock.yaml`

- [ ] **Step 10.1: Vérifier qu'aucune de ces deps n'est importée**

Run:
```bash
grep -rE "from '(@radix-ui|class-variance-authority|clsx|tailwind-merge)" apps/web/src 2>/dev/null
```
Expected output: vide (aucun résultat). Si match → STOP, les agents Explore ont missed un import ; ne pas continuer sans analyse.

- [ ] **Step 10.2: Désinstaller les 7 packages**

Run:
```bash
pnpm --filter @carto-ecp/web remove \
  @radix-ui/react-dialog \
  @radix-ui/react-slot \
  @radix-ui/react-tabs \
  @radix-ui/react-tooltip \
  class-variance-authority \
  clsx \
  tailwind-merge
```
Expected: sortie pnpm `Progress: ...  -7 packages removed`.

- [ ] **Step 10.3: Vérifier l'absence dans package.json**

Run:
```bash
grep -E "@radix-ui|class-variance-authority|^\s+\"clsx\"|tailwind-merge" apps/web/package.json
```
Expected: vide (aucun match).

- [ ] **Step 10.4: Typecheck**

Run:
```bash
pnpm --filter @carto-ecp/web typecheck
```
Expected: exit 0.

---

## Task 11: Retirer Tailwind + supprimer les fichiers de config

**Files:**
- Modify: `apps/web/package.json`
- Delete: `apps/web/tailwind.config.ts`
- Delete: `apps/web/postcss.config.cjs`
- Delete: `apps/web/src/styles/globals.css`

- [ ] **Step 11.1: Désinstaller tailwindcss + postcss + autoprefixer**

Run:
```bash
pnpm --filter @carto-ecp/web remove -D tailwindcss postcss autoprefixer
```
Expected: `-3 packages removed`.

- [ ] **Step 11.2: Supprimer les 3 fichiers de config**

Run:
```bash
rm apps/web/tailwind.config.ts
rm apps/web/postcss.config.cjs
rm apps/web/src/styles/globals.css
```
Expected: aucune sortie (rm silencieux en cas de succès).

- [ ] **Step 11.3: Vérifier la suppression**

Run:
```bash
ls apps/web/tailwind.config.ts apps/web/postcss.config.cjs apps/web/src/styles/globals.css 2>&1
```
Expected: 3 messages "No such file or directory" ou équivalent.

```bash
ls apps/web/src/styles/
```
Expected: 3 fichiers `.scss` seulement (tokens, fonts, globals) — pas de `.css`.

---

## Task 12: Green gate finale + deuxième commit

**Files:** aucun (vérifications) + commit

- [ ] **Step 12.1: Typecheck**

Run:
```bash
pnpm --filter @carto-ecp/web typecheck
```
Expected: exit 0.

- [ ] **Step 12.2: Vitest**

Run:
```bash
pnpm --filter @carto-ecp/web test
```
Expected: exit 0, ~144 tests verts.

Si des tests échouent à cause d'imports cassés (ex: un test qui importe de `clsx` ou `tailwind-merge` alors que le grep step 10.1 était vide), diagnostiquer : probable chemin alternatif d'import. Corriger le test avant d'aller plus loin.

- [ ] **Step 12.3: Playwright e2e**

Run:
```bash
pnpm --filter @carto-ecp/web test:e2e
```
Expected: exit 0, ~7 specs verts. Durée ~30-60 secondes (boot dev server + scénarios).

- [ ] **Step 12.4: Build**

Run:
```bash
pnpm --filter @carto-ecp/web build
```
Expected: exit 0, `dist/` généré, 4 WOFF2 dans `dist/fonts/`.

- [ ] **Step 12.5: Sanity test backend**

Run:
```bash
pnpm --filter @carto-ecp/api test
```
Expected: exit 0, tous les tests API verts (doit être inchangé par cette slice).

- [ ] **Step 12.6: Créer le commit 2**

Run:
```bash
git add apps/web/package.json pnpm-lock.yaml
git rm apps/web/tailwind.config.ts apps/web/postcss.config.cjs apps/web/src/styles/globals.css
git status --short
```

Vérifier que le status liste uniquement ces fichiers (1 modifié + 3 supprimés + potentiellement pnpm-lock).

Créer le commit :

```bash
git commit -m "$(cat <<'EOF'
chore(web): slice 4a — retrait Tailwind + deps UI mortes

Désinstalle tailwindcss, postcss, autoprefixer (devDependencies).
Désinstalle @radix-ui/react-{dialog,slot,tabs,tooltip}, clsx,
tailwind-merge, class-variance-authority (dependencies) — aucun de ces
packages n'est importé dans apps/web/src (vérifié par grep).

Supprime :
- apps/web/tailwind.config.ts
- apps/web/postcss.config.cjs
- apps/web/src/styles/globals.css (remplacé par globals.scss dans le
  commit précédent)

Tests verts : typecheck, vitest (~144), playwright (~7), build, api.

Les classes Tailwind dans les ~40 fichiers .tsx métier deviennent
inertes (aucun CSS ne les résout). Remplacement en Slices 4c/4d/4e.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit créé.

---

## Task 13: Smoke manuel (9 checkpoints DoD Standard)

**Files:** aucun (validation humaine)

Cette task nécessite une **validation manuelle** par l'utilisateur ou un testeur humain. Claude peut préparer l'environnement mais ne peut pas cocher les checkpoints sans feedback.

- [ ] **Step 13.1: Démarrer l'environnement dev**

Run (fenêtre 1 ou background) :
```bash
pnpm dev
```
Expected : sortie parallèle `api: listening on :3000` + `web: Local: http://localhost:5173/`.

- [ ] **Step 13.2: Ouvrir http://localhost:5173 dans un navigateur avec DevTools → Console**

Aucune commande à lancer — action manuelle.

- [ ] **Step 13.3: Checkpoint 1 — GET /**

Ouvrir `http://localhost:5173/`.
Attendu : carte Leaflet visible, markers présents, tuiles OpenStreetMap chargées, 0 erreur console (warnings tolérés).

- [ ] **Step 13.4: Checkpoint 2 — GET /upload**

Ouvrir `http://localhost:5173/upload`.
Attendu : page charge, dropzone présent (non stylé), 0 erreur console.

- [ ] **Step 13.5: Checkpoint 3 — GET /admin**

Ouvrir `http://localhost:5173/admin`.
Attendu : 6 onglets visibles et cliquables, 0 erreur console.

- [ ] **Step 13.6: Checkpoint 4 — onglet Imports**

Cliquer onglet "Imports".
Attendu : liste des imports charge depuis l'API, filtres env + texte cliquables.

- [ ] **Step 13.7: Checkpoint 5 — onglet Composants**

Cliquer onglet "Composants".
Attendu : liste des composants charge, recherche fonctionnelle.

- [ ] **Step 13.8: Checkpoint 6 — onglet Organisations**

Cliquer onglet "Organisations".
Attendu : liste organisations charge, boutons Importer/Exporter visibles.

- [ ] **Step 13.9: Checkpoint 7 — onglet ENTSO-E**

Cliquer onglet "ENTSO-E".
Attendu : status de l'annuaire charge.

- [ ] **Step 13.10: Checkpoint 8 — onglet Registry**

Cliquer onglet "Registry".
Attendu : process colors + endpoints RTE affichés.

- [ ] **Step 13.11: Checkpoint 9 — onglet Zone danger**

Cliquer onglet "⚠ Zone danger".
Attendu : 3 sections de purge visibles.

- [ ] **Step 13.12: Bonus Nunito — vérification chargement police**

DevTools → Network → filtre "font" → hard reload (`Ctrl+Shift+R`).
Attendu : les 4 `nunito-*.woff2` servis en HTTP 200 depuis `/fonts/`.

Puis Elements → sélectionner `<body>` → Computed → `font-family`.
Attendu : `Nunito` apparaît en tête de la stack.

- [ ] **Step 13.13: Arrêter le dev server**

`Ctrl+C` dans la fenêtre de `pnpm dev`.

- [ ] **Step 13.14: Consigner le résultat**

Si les 9 checkpoints + bonus passent → continuer à task 14.
Sinon → diagnostiquer, corriger, re-tester avant de continuer.

---

## Task 14: Vérifier absence de scope creep

**Files:** aucun (vérification)

- [ ] **Step 14.1: Lister les fichiers modifiés depuis main**

Run:
```bash
git diff main --stat
```
Expected: ~10-15 fichiers listés.

- [ ] **Step 14.2: Vérifier aucun fichier métier touché**

Run:
```bash
git diff main --name-only | grep -E "apps/web/src/(components|pages|lib|store)/" || echo "OK - aucun fichier métier touché"
```
Expected: `OK - aucun fichier métier touché`.

Si des fichiers sont listés → STOP, investiguer (scope creep). Revert les modifs parasites avant de continuer.

- [ ] **Step 14.3: Vérifier aucun test modifié**

Run:
```bash
git diff main --name-only | grep -E "\.test\.|\.spec\." || echo "OK - aucun test touché"
```
Expected: `OK - aucun test touché`.

---

## Task 15: Rédiger docs/adr/ADR-037-adoption-design-system-rte.md

**Files:**
- Create: `docs/adr/ADR-037-adoption-design-system-rte.md`

- [ ] **Step 15.1: Créer le fichier avec le contenu exact**

Créer `docs/adr/ADR-037-adoption-design-system-rte.md` avec :

```markdown
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

Le frontend `apps/web` n'applique aucune conformité au Design System officiel RTE. Inventaire constaté :

- **Tailwind inliné partout**, sans tokens, sans composants UI partagés. Chaque `className="bg-rte text-white px-4 py-2 hover:bg-red-700"` est réécrit à la main dans chaque fichier.
- **7 dépendances UI jamais utilisées** : `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `class-variance-authority`, `clsx`, `tailwind-merge`. Tout est dans le `package.json` mais zéro import.
- **Modales, onglets, tooltips** tous bricolés à la main avec `<div fixed inset-0 bg-black/40>`, `<button aria-selected>`, etc.
- **~20 couleurs hex hardcodées** dans `Map/`, `DetailPanel/`, `Admin/`.
- **Police Inter** en fallback système sans chargement explicite (aucun `<link>`, aucun `@import`, aucune WOFF2).
- **Incohérence `#e30613` vs `#C8102E`** entre `tailwind.config.ts` et `HomeCdOverlay.tsx`.

RTE publie officiellement son Design System sur npm depuis 2025 : `@design-system-rte/react@1.8.0` + `@design-system-rte/core@1.7.0`, Apache-2.0, peer `react >= 18.0.0`. Le DS expose 41 composants React (Button, TextInput, Modal, Tab, Badge, Drawer, FileUpload, Popover, Toast, ...), une police officielle Nunito (4 poids WOFF2), un système d'icônes SVG Material-like, et un ensemble de tokens SCSS (spacing 0→80px, radius none→pill, typography, elevation 1→6, opacity, layout).

## Options considérées

| Option | Description | Effort | Avantages | Inconvénients |
|--------|-------------|--------|-----------|---------------|
| **A** — Adopter `@design-system-rte/*` + SCSS/CSS Modules + suppression Tailwind | Migration totale sur 5 slices (4a–4e) | L | Conforme directive groupe, 41 composants DS prêts, a11y WCAG AA out-of-the-box, suppression de 7 deps UI mortes, tokens centralisés | Refactor lourd réparti sur ~15 jours, bundle augmenté (DS CSS + fonts), régression visuelle temporaire entre 4a et fin 4b |
| B — Garder Tailwind + custom classes mimant le DS | Tailwind theming avec tokens DS copiés en dur | M | Moins de refactor immédiat | Perpétue la divergence avec le DS officiel, pas les vrais composants, maintenance manuelle des tokens, directive groupe non respectée |
| C — Tailwind + DS en coexistence (hybride) | Deux systèmes en parallèle | M | Transition "douce" | Bundle doublé, règles CSS en conflit, confusion pour les développeurs, dette technique accrue, pas viable long terme |

## Décision retenue

**Option A : adoption totale de `@design-system-rte/react@^1.8.0` + `@design-system-rte/core@^1.7.0`, suppression complète de Tailwind, pipeline SCSS + CSS Modules, tokens RTE officiels.**

Justifications :
1. **Directive groupe** — RTE impose le DS officiel pour toute nouvelle app interne. Les options B et C ne respectent pas cette directive.
2. **Accès immédiat à 41 composants** — économise le développement/maintenance de primitives UI (Button, Modal, Tab, Drawer, Popover, FileUpload...).
3. **Accessibilité WCAG AA** — le DS fournit des composants a11y-ready, contrairement à nos DIV+aria-* faits main.
4. **Cleanup majeur** — la suppression de Tailwind + 7 deps UI mortes simplifie le bundle et la dépendance graph.
5. **SCSS + CSS Modules** — aligne avec la structure du DS core (SCSS natif), évite le mélange Tailwind+DS qui créerait des conflits.
6. **Police officielle Nunito** — marque RTE respectée, chargée depuis `apps/web/public/fonts/` pour contrôle local.

## Conséquences

### Positives

- Conformité visuelle RTE (charte, Nunito, tokens officiels)
- 41 composants DS accessibles out-of-the-box
- Tokens SCSS centralisés (`@design-system-rte/core/design-tokens/main`)
- Code cleanup majeur (suppression 7 deps UI mortes + Tailwind)
- A11y WCAG AA fournie par le DS
- Incohérence `#e30613` vs `#C8102E` résolue en Slice 4e par le token `$color-brand-primary` du DS

### Négatives

- Migration étalée sur 5 slices (~15j)
- Régression visuelle temporaire entre Slice 4a et fin de Slice 4b (les classes Tailwind dans les 40+ composants métier deviennent inertes)
- Bundle augmenté (DS CSS + 4 WOFF2 Nunito ~120 KB)
- Composant `Table` absent du DS → composant maison CSS Module (ADR dédié en Slice 4c)
- Composant `Slider` absent → `RangeSlider` maison pour le `TimelineSlider` (ADR dédié en 4c)
- Composant `ColorPicker` absent → `ColorField` maison pour `ProcessColorsEditor` (ADR dédié en 4c)

### Ce qu'on s'interdit désormais

- Rajouter `tailwindcss` ou des classes Tailwind dans le frontend
- Importer des composants UI tiers non-DS (shadcn/ui, MUI, Ant Design, Chakra, Radix UI direct...)
- Hardcoder des valeurs hex, font-size, spacing, radius, shadow dans les composants : tout passe par les tokens DS (`$color-*`, `$positive-spacing_*`, `$radius-*`, `$font-family-*`)
- Déclarer des `@font-face` sans WOFF2 servi depuis `apps/web/public/fonts/`
- Redéclarer la couleur `rte` dans un config local — la source unique est `$color-brand-primary` exposé par `@design-system-rte/core`

## Ressources / Références

- **Repo officiel** : <https://github.com/rte-france/design-system-rte>
- **Storybook** : <https://opensource.rte-france.com/design-system-rte/>
- **npm React package** : <https://www.npmjs.com/package/@design-system-rte/react>
- **npm Core package** : <https://www.npmjs.com/package/@design-system-rte/core>
- **Licence** : Apache-2.0 (compatible usage interne RTE et open-source)
- **Plan global de migration** : `C:\Users\ANTHONY\.claude\plans\nous-allons-devoir-faire-immutable-bachman.md`
- **Design doc Slice 4a** : `docs/superpowers/specs/2026-04-23-ds-rte-slice-4a-foundation-design.md`
- **Plan d'implémentation Slice 4a** : `docs/superpowers/plans/2026-04-23-ds-rte-slice-4a-foundation.md`
- **Related ADRs** :
  - ADR-034 (divIcon lucide-react markers) — sera amendé en Slice 4e (remplacement lucide par icônes DS)
  - ADR-038 à ADR-04X — à venir en Slices 4c/4d pour Table/Slider/ColorPicker maison
```

- [ ] **Step 15.2: Vérifier la création**

Run:
```bash
wc -l docs/adr/ADR-037-adoption-design-system-rte.md
head -20 docs/adr/ADR-037-adoption-design-system-rte.md
```
Expected: ~80-100 lignes, le tableau de métadonnées apparaît en tête.

---

## Task 16: Rédiger docs/specs/web/ds-rte-foundation/spec-fonctionnel.md

**Files:**
- Create: `docs/specs/web/ds-rte-foundation/spec-fonctionnel.md`

- [ ] **Step 16.1: Créer le dossier**

Run:
```bash
mkdir -p docs/specs/web/ds-rte-foundation
```
Expected: aucune sortie.

- [ ] **Step 16.2: Créer le fichier avec le contenu**

Créer `docs/specs/web/ds-rte-foundation/spec-fonctionnel.md` avec :

```markdown
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
- `sass@^1.85.1` (devDependency)

### Retrait
- `tailwindcss`, `postcss`, `autoprefixer` (devDependencies)
- `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip` (dependencies)
- `class-variance-authority`, `clsx`, `tailwind-merge` (dependencies)

---

## Critères d'acceptation (DoD Standard)

### Machine green (bloquant)

- `pnpm --filter @carto-ecp/web typecheck` → exit 0
- `pnpm --filter @carto-ecp/web test` (vitest, ~144 tests) → exit 0
- `pnpm --filter @carto-ecp/web test:e2e` (playwright, ~7 specs) → exit 0
- `pnpm --filter @carto-ecp/web build` → exit 0, `dist/fonts/*.woff2` présents
- `pnpm --filter @carto-ecp/api test` → exit 0 (sanity backend)

### Smoke manuel (9 checkpoints)

Voir `docs/superpowers/plans/2026-04-23-ds-rte-slice-4a-foundation.md` task 13.

### Anti-scope-creep

- `git diff main --name-only` ne liste aucun fichier dans `apps/web/src/components/{Admin,Map,DetailPanel,EnvSelector,TimelineSlider,UploadBatchTable}/` ni dans `apps/web/src/pages/`
- `git diff main --name-only | grep -E "\.test\.|\.spec\."` vide

---

## Transition vers Slice 4b

À la fin de 4a, `main` porte la version `v3.0-alpha.6`. La Slice 4b crée la couche `apps/web/src/components/ui/` (wrappers DS + composants maison `Table`, `RangeSlider`, `ColorField`, `DateTimeField`) et commence à restaurer l'esthétique en migrant le header global (`App.tsx` + `EnvSelector`).
```

- [ ] **Step 16.3: Vérifier**

Run:
```bash
wc -l docs/specs/web/ds-rte-foundation/spec-fonctionnel.md
head -15 docs/specs/web/ds-rte-foundation/spec-fonctionnel.md
```

---

## Task 17: Rédiger docs/specs/web/ds-rte-foundation/spec-technique.md

**Files:**
- Create: `docs/specs/web/ds-rte-foundation/spec-technique.md`

- [ ] **Step 17.1: Créer le fichier avec le contenu**

Créer `docs/specs/web/ds-rte-foundation/spec-technique.md` avec :

```markdown
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

apps/web/src/styles/tokens.scss
  └─ @forward '@design-system-rte/core/design-tokens/main'

apps/web/src/styles/fonts.scss
  └─ 4 × @font-face Nunito → url('/fonts/nunito-*.woff2')

apps/web/src/styles/globals.scss
  └─ @use './tokens' as tokens
  └─ html/body { font-family: tokens.$font-family-nunito }
  └─ .leaflet-div-icon.carto-node-marker { background: transparent; border: none }

Servi statiquement par Vite :
  apps/web/public/fonts/nunito-{light-300,regular-400,semi-bold-600,bold-700}.woff2
```

---

## 3. Inventaire des fichiers

### Créés

- `apps/web/src/styles/tokens.scss` (4 lignes)
- `apps/web/src/styles/fonts.scss` (32 lignes, 4 `@font-face`)
- `apps/web/src/styles/globals.scss` (16 lignes)
- `apps/web/public/fonts/nunito-light-300.woff2` (~20-30 KB)
- `apps/web/public/fonts/nunito-regular-400.woff2` (~20-30 KB)
- `apps/web/public/fonts/nunito-semi-bold-600.woff2` (~20-30 KB)
- `apps/web/public/fonts/nunito-bold-700.woff2` (~20-30 KB)

### Modifiés

- `apps/web/package.json` — diff dependencies/devDependencies
- `apps/web/vite.config.ts` — ajout bloc `css.preprocessorOptions.scss`
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

Versions alignées avec les peer deps (`sass@^1.85.1` requis par `@design-system-rte/core`).

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

Doit retourner vide avant désinstallation.

---

## 5. Copie des WOFF2

```bash
mkdir -p apps/web/public/fonts
cp node_modules/@design-system-rte/core/assets/fonts/nunito-light-300.woff2 apps/web/public/fonts/
cp node_modules/@design-system-rte/core/assets/fonts/nunito-regular-400.woff2 apps/web/public/fonts/
cp node_modules/@design-system-rte/core/assets/fonts/nunito-semi-bold-600.woff2 apps/web/public/fonts/
cp node_modules/@design-system-rte/core/assets/fonts/nunito-bold-700.woff2 apps/web/public/fonts/
```

Ces 4 fichiers sont **trackés dans git** (petits WOFF2, ~120 KB total).

---

## 6. Commandes de vérification

### Machine green

```bash
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/web test
pnpm --filter @carto-ecp/web test:e2e
pnpm --filter @carto-ecp/web build
pnpm --filter @carto-ecp/api test
```

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
| `sass` en peer dep du DS core requiert build-script post-install | Observer `pnpm install` — ajouter `sass` à `onlyBuiltDependencies` (pnpm-workspace.yaml) si alerte. En pratique `sass` est pure-JS, aucune action requise. |
| Vite résout mal `url('@design-system-rte/...')` dans SCSS | Les 4 WOFF2 sont copiés dans `apps/web/public/fonts/` et référencés en chemin absolu `/fonts/` — pas de résolution node_modules dans `url()` |
| `additionalData` SCSS ré-injecte dans `tokens.scss` (self-reference Sass error) | La fonction `additionalData` exclut `tokens.scss` ET `fonts.scss` |
| `@design-system-rte/react/style.css` override nos `globals.scss` | Ordre imports main.tsx : DS en 1er, nos globals en 4e (dernier) — nos règles gagnent par cascade CSS |
| Tests E2E qui utilisent des classes Tailwind | Vérifié : aucun sélecteur Tailwind dans `apps/web/e2e/` (tout en `.leaflet-container`, `header select`, `aside`, `input[type="file"]` — HTML/Leaflet natifs) |
| Bundle size augmente (DS CSS + fonts) | Acceptable en dev-local. À re-évaluer en Slice 4e si la prod est envisagée. |

---

## 8. Transition vers Slice 4b

`feat/ds-rte-components-base` part de `main` @ `v3.0-alpha.6`. Elle crée `apps/web/src/components/ui/` (Button, TextInput, Textarea, Select, Checkbox, Badge, Tag, Chip, Modal, Tooltip, Tab, Loader, Toast, Banner, Drawer, Popover, FileUpload, Icon, Link) + composants maison (`Table`, `RangeSlider`, `ColorField`, `DateTimeField`) consommant les tokens SCSS mis en place par cette Slice 4a.
```

- [ ] **Step 17.2: Vérifier**

Run:
```bash
wc -l docs/specs/web/ds-rte-foundation/spec-technique.md
```

---

## Task 18: Ajouter l'entrée CHANGELOG v3.0-alpha.6

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 18.1: Lire le début du CHANGELOG**

Run:
```bash
head -15 CHANGELOG.md
```
Repérer la ligne `## [Unreleased]` et la première entrée qui la suit (actuellement `### v3.0-alpha.5 — Slice 3d+ : coordonnées GPS...`).

- [ ] **Step 18.2: Insérer l'entrée v3.0-alpha.6 en tête de [Unreleased]**

Utiliser l'outil Edit pour insérer le bloc ci-dessous **juste après la ligne `## [Unreleased]`** (et sa ligne vide) et **avant** l'entrée `### v3.0-alpha.5`. Le contenu à insérer :

```markdown
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

**Note** : l'entrée doit être insérée AVANT `### v3.0-alpha.5 — Slice 3d+` (qui devient la 2e entrée sous `[Unreleased]`).

- [ ] **Step 18.3: Vérifier l'insertion**

Run:
```bash
head -40 CHANGELOG.md
```
Expected : `## [Unreleased]` → ligne vide → `### v3.0-alpha.6` en tête.

---

## Task 19: Commit 3 (documentation) + Push + PR MCP GitHub

**Files:** aucun (git operations)

- [ ] **Step 19.1: Stager les fichiers de documentation**

Run:
```bash
git add docs/adr/ADR-037-adoption-design-system-rte.md \
        docs/specs/web/ds-rte-foundation/spec-fonctionnel.md \
        docs/specs/web/ds-rte-foundation/spec-technique.md \
        CHANGELOG.md
git status --short
```
Expected : 4 fichiers stagés (A/M selon création/modification). Le plan d'implémentation a été committé en amont (commit dédié avant Task 1).

- [ ] **Step 19.2: Créer le commit 3**

Run:
```bash
git commit -m "$(cat <<'EOF'
docs(web): slice 4a — ADR-037 + specs ds-rte-foundation + CHANGELOG v3.0-alpha.6

- ADR-037 : adoption du Design System RTE (packages npm officiels,
  @design-system-rte/react@^1.8.0 + core@^1.7.0, Apache-2.0)
- docs/specs/web/ds-rte-foundation/{spec-fonctionnel,spec-technique}.md
  au format Zelian T6
- CHANGELOG v3.0-alpha.6 détaillant l'installation, les retraits et
  le pipeline SCSS
- plan d'implémentation superpowers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : commit créé.

- [ ] **Step 19.3: Vérifier les 4 commits de la branche**

Run:
```bash
git log --oneline main..HEAD
```
Expected :
```
<SHA4> docs(web): slice 4a — ADR-037 + specs ds-rte-foundation + CHANGELOG v3.0-alpha.6
<SHA3> chore(web): slice 4a — retrait Tailwind + deps UI mortes
<SHA2> feat(web): slice 4a foundation — install DS RTE + pipeline SCSS + Nunito
<SHA1> docs(web): spec design Slice 4a — foundation Design System RTE
```

- [ ] **Step 19.4: Push de la branche**

Run:
```bash
git push -u origin feat/ds-rte-foundation
```
Expected : `Branch 'feat/ds-rte-foundation' set up to track 'origin/feat/ds-rte-foundation'.`

- [ ] **Step 19.5: Créer la PR via MCP GitHub**

Conformément à `.claude/rules/05-git-workflow.md`, la PR est créée via le MCP GitHub (pas via `gh pr create`).

Utiliser l'outil MCP GitHub pour créer la PR :
- **Base** : `main`
- **Head** : `feat/ds-rte-foundation`
- **Title** : `feat(web): slice 4a — fondation Design System RTE`
- **Body** :

```markdown
## Slice 4a — Fondation du Design System RTE

Première des 5 slices de migration totale vers le DS RTE officiel
(`@design-system-rte/react@^1.8.0` + `@design-system-rte/core@^1.7.0`).

### Résumé
- Installe DS RTE + sass
- Retire Tailwind + 7 deps UI mortes (@radix-ui, cva, clsx, tailwind-merge)
- Crée pipeline SCSS + tokens auto-injectés via vite.config.ts
- Charge la police Nunito (4 WOFF2 dans apps/web/public/fonts/)
- Aucun composant métier touché — régression visuelle temporaire assumée

### Documentation
- [Design doc](./docs/superpowers/specs/2026-04-23-ds-rte-slice-4a-foundation-design.md)
- [Plan d'impl](./docs/superpowers/plans/2026-04-23-ds-rte-slice-4a-foundation.md)
- [ADR-037](./docs/adr/ADR-037-adoption-design-system-rte.md)
- [spec-fonctionnel](./docs/specs/web/ds-rte-foundation/spec-fonctionnel.md)
- [spec-technique](./docs/specs/web/ds-rte-foundation/spec-technique.md)

### Tests verts
- `pnpm --filter @carto-ecp/web typecheck` OK
- `pnpm --filter @carto-ecp/web test` OK (~144 tests vitest)
- `pnpm --filter @carto-ecp/web test:e2e` OK (~7 specs Playwright)
- `pnpm --filter @carto-ecp/web build` OK
- `pnpm --filter @carto-ecp/api test` OK (sanity)

### Smoke manuel (9/9 ✅)
1. `/` — carte Leaflet + markers
2. `/upload` — dropzone
3. `/admin` — 6 onglets cliquables
4-9. Chaque onglet admin charge sans erreur console
+ Bonus : Nunito chargée (4 WOFF2 servies depuis `/fonts/`)

### Régression visuelle
Assumée entre ce merge et la fin de Slice 4b. Les `className="bg-rte..."` dans les 40+ composants métier deviennent inertes. Restoration progressive en 4b.

### Rollback
`git revert <SHA-merge>` (slice monolithique, un seul revert suffit).

🤖 Generated with Claude Code + Zelian/Superpowers workflow
```

- [ ] **Step 19.6: Vérifier la PR créée**

Confirmer que la PR apparaît sur GitHub avec l'URL retournée par le MCP. La base est `main`, le head `feat/ds-rte-foundation`.

---

## Task 20: Fin de slice — hook Stop et suivi

**Files:** aucun

- [ ] **Step 20.1: Laisser le hook Stop déclencher `update-writer-after-implement`**

Le hook Stop Zelian (configuré dans `.claude/settings.json` ou équivalent) déclenche automatiquement le subagent `update-writer-after-implement` qui synchronise `docs/specs/` avec le code réellement implémenté. Laisser ce subagent produire ses éventuelles mises à jour de specs/ADRs.

- [ ] **Step 20.2: Attendre review humaine de la PR**

La PR doit recevoir au moins une review avant merge (voir `.claude/rules/05-git-workflow.md`).

- [ ] **Step 20.3: Après merge sur main**

Une fois la PR mergée :
- Supprimer la branche locale : `git branch -d feat/ds-rte-foundation`
- Supprimer la branche distante : `git push origin --delete feat/ds-rte-foundation`
- Pull main : `git checkout main && git pull`
- Vérifier `main` est bien à `v3.0-alpha.6`

La Slice 4b peut ensuite démarrer depuis ce nouveau point : `git checkout -b feat/ds-rte-components-base`.

---

## Récapitulatif

**Total tasks** : 20 (19 actives + 1 follow-up)

**Total commits sur la branche** : 4
1. `6d89fdc` — docs(web): spec design Slice 4a (déjà présent)
2. `<SHA2>` — feat(web): slice 4a foundation — install DS RTE + pipeline SCSS + Nunito
3. `<SHA3>` — chore(web): slice 4a — retrait Tailwind + deps UI mortes
4. `<SHA4>` — docs(web): slice 4a — ADR-037 + specs ds-rte-foundation + CHANGELOG v3.0-alpha.6

**Fichiers touchés (diff main)** : ~15 (10 créés + 4 modifiés + 3 supprimés + 4 docs créés)

**Durée estimée totale** : 3-4 heures (setup 1h + docs 1h + smoke manuel 30min + commit/PR 30min + marge).

**Critère de succès final** : PR mergée sur main, `v3.0-alpha.6` dans le CHANGELOG, tous les tests verts, 9 smoke checkpoints ✅, aucun composant métier touché.
