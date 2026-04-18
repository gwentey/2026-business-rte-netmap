# Phase 1 Remédiation — Design

| Champ              | Valeur                                              |
|--------------------|-----------------------------------------------------|
| Date               | 2026-04-18                                          |
| Auteur             | Claude Opus 4.7 (1M context) + revue humaine        |
| Source             | `docs/retro/plan-remediation.md` — Phase 1          |
| Portée             | 4 actions bloquantes pré-déploiement (P1-1 à P1-4)  |
| Branche cible      | `feat/phase1-remediation` depuis `feature/slice-1`  |
| Livraison          | 1 PR, 4 commits conventional                        |

---

## 1. Objectif et contexte

Le plan de remédiation issu de la rétro-ingénierie identifie 4 actions bloquantes avant tout chantier de déploiement Docker ou d'élargissement d'équipe :

- **P1-1** : câbler ESLint à la racine (lint inopérant aujourd'hui)
- **P1-2** : rendre la résolution de chemin du `RegistryService` compatible Docker via variable d'environnement
- **P1-3** : ajouter un garde-fou automatisé contre la désynchronisation de la palette `processColors` (dupliquée entre JSON registry et TS frontend)
- **P1-4** : typer l'exception levée quand `component_directory.csv` est vide (aujourd'hui HTTP 500 opaque)

Le présent document fixe l'architecture, les fichiers modifiés, les tests, les critères de succès et les décisions écartées pour cette Phase 1 uniquement. Les Phases 2 (tests) et 3 (améliorations continues) feront l'objet de specs distincts.

---

## 2. Décisions clés validées en brainstorming

| Décision | Valeur retenue | Alternatives écartées |
|----------|----------------|-----------------------|
| Découpage du plan de remédiation | 3 sous-projets (1 par phase) | Tout en un seul spec ; Phase 1 seule puis décision différée |
| Style de configuration ESLint | Flat config `eslint.config.mjs` par workspace, `eslint@^9` | Legacy `.eslintrc.cjs` ; preset flat racine partagé |
| Emplacement du test de sync palettes | Test Vitest dans `apps/web/src/lib/process-colors.sync.test.ts` | Test Vitest côté api ; script Node standalone à la racine |
| Rigueur du ruleset ESLint | Balanced : recommended + règles type-aware ciblées (`no-floating-promises`, `no-misused-promises`, `await-thenable`, `consistent-type-imports`, `no-unused-vars` strict) | Recommended minimal ; `recommended-type-checked` strict |

---

## 3. Architecture — empreinte des modifications

| Item | Fichiers créés | Fichiers modifiés | Fichiers supprimés | Dépendances npm |
|------|----------------|-------------------|--------------------|-----------------|
| P1-1 | `apps/api/eslint.config.mjs`, `apps/web/eslint.config.mjs` | `apps/api/package.json`, `apps/web/package.json` (scripts `lint` + devDeps) | `apps/api/.eslintrc.cjs` | +4 api, +8 web (voir §4.1) |
| P1-2 | — | `apps/api/src/registry/registry.service.ts` | — | — |
| P1-3 | `apps/web/src/lib/process-colors.sync.test.ts` | — | — | — |
| P1-4 | — | `apps/api/src/ingestion/ingestion.service.ts` | — | — |

**Principes transverses** :

- Aucun changement de comportement runtime en dehors de P1-4 (par conception, pour ne pas risquer de régression au-delà du scope)
- Flat config ESLint en ESM (`.mjs`) pour les deux workspaces, y compris `apps/api` qui est CommonJS — l'extension `.mjs` force le chargement ESM, ce qui est compatible avec le loader ESLint 9
- `.eslintrc.cjs` de `apps/api/` est supprimé : on ne laisse pas coexister deux formats de configuration
- Les fixes de lint détectés au premier passage sont inclus dans le scope de l'item P1-1, pas différés en dette

**Hors scope explicite** :

- Pas de migration vers une preset flat config partagée à la racine (retenu option B question 1)
- Pas d'intégration CI (explicitement hors scope selon le plan de remédiation)
- Pas d'intégration Prettier dans la chaîne ESLint (Prettier reste autonome via `pnpm format`)
- Pas de typage de l'erreur de boot si le registry est introuvable (hors scope P1-2)
- Pas de test unitaire dédié pour P1-4 (redondance prévue avec P2-1 Phase 2)

---

## 4. Détail par item

### 4.1. P1-1 — Câblage ESLint flat config

#### Livrables

1. Suppression de `apps/api/.eslintrc.cjs`
2. Création de `apps/api/eslint.config.mjs`
3. Création de `apps/web/eslint.config.mjs`
4. Mise à jour des scripts `lint` dans les deux `package.json`
5. Installation des dépendances dev dans chaque workspace
6. Correction des violations détectées au premier passage

#### Dépendances ajoutées

**`apps/api` (4 paquets)** :
- `eslint@^9`
- `typescript-eslint@^8` (paquet monolithique qui inclut parser + plugin + configs)
- `@eslint/js@^9`
- `globals@^15`

**`apps/web` (8 paquets)** :
- `eslint@^9`, `typescript-eslint@^8`, `@eslint/js@^9`, `globals@^15`
- `eslint-plugin-react@^7`
- `eslint-plugin-react-hooks@^5`
- `eslint-plugin-react-refresh@^0.4`
- `eslint-plugin-jsx-a11y@^6`

#### Config `apps/api/eslint.config.mjs`

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'prisma/migrations/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts', 'vitest.setup.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
```

Le bloc `files: [...]` override pour les tests autorise `array[i]!` (pattern imposé par `noUncheckedIndexedAccess` + documenté dans CLAUDE.md) et `any` pour les mocks.

#### Config `apps/web/eslint.config.mjs`

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'playwright-report/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      react,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react/jsx-no-leaked-render': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
```

#### Scripts `lint` mis à jour

- `apps/api/package.json` : `"lint": "eslint src test"`
- `apps/web/package.json` : `"lint": "eslint src"` (inchangé en comportement, la flat config détermine les extensions)
- Racine : `"lint": "pnpm -r lint"` (inchangé)

#### Stratégie pour les violations du premier passage

- **Fix simple** (imports inutilisés, `import type` manquant, `await` oublié sur une promesse) → corrigé dans le commit P1-1
- **Fix invasif** (ex: refactor de code métier pour lever une violation complexe) → désactivé localement avec `// eslint-disable-next-line <rule> -- <raison>`
- **Seuil de rupture** : si le premier passage remonte plus de 20 violations totales, l'implémentation stoppe et on revient au design (l'effort "S" initial serait invalidé)

### 4.2. P1-2 — RegistryService via `REGISTRY_PATH`

**Fichier** : `apps/api/src/registry/registry.service.ts`

Déplacer la résolution du chemin de module-load-time vers `onModuleInit` et introduire la variable d'environnement.

```ts
// Avant (ligne 12)
const REGISTRY_PACKAGE_ROOT = resolve(process.cwd(), '../../packages/registry');

// Après (dans la classe)
private registryRoot!: string;

async onModuleInit(): Promise<void> {
  this.registryRoot = process.env.REGISTRY_PATH
    ? resolve(process.env.REGISTRY_PATH)
    : resolve(process.cwd(), '../../packages/registry');
  this.logger.log(`Registry root: ${this.registryRoot}`);
  await Promise.all([this.loadEntsoeIndex(), this.loadOverlay()]);
  this.logger.log(
    `Registry loaded: ${this.eicIndex.size} ENTSO-E entries, overlay ${this.overlay.version}`,
  );
}
```

Les deux méthodes privées `loadEntsoeIndex` et `loadOverlay` remplacent `REGISTRY_PACKAGE_ROOT` par `this.registryRoot`.

**Contrat** :

- Si `REGISTRY_PATH` est défini → résolu via `path.resolve()` (absolu ou relatif au cwd du process)
- Sinon → chemin relatif courant (identique à aujourd'hui, zéro régression dev-local)
- Si le chemin résolu n'existe pas → `ENOENT` de `readFile` remonte telle quelle (comportement identique à aujourd'hui)

**Log ajouté** : une ligne `Registry root: <path>` au boot pour faciliter le debug en Docker.

### 4.3. P1-3 — Test de synchronisation des palettes `processColors`

**Fichier** : `apps/web/src/lib/process-colors.sync.test.ts` (nouveau)

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { PROCESS_COLORS } from './process-colors';

const OVERLAY_PATH = resolve(
  import.meta.dirname,
  '../../../../packages/registry/eic-rte-overlay.json',
);

describe('process-colors sync with registry overlay', () => {
  const overlay = JSON.parse(readFileSync(OVERLAY_PATH, 'utf-8')) as {
    processColors: Record<string, string>;
  };

  it('has identical keys in JSON and TS', () => {
    expect(Object.keys(PROCESS_COLORS).sort()).toEqual(
      Object.keys(overlay.processColors).sort(),
    );
  });

  it('has identical hex values for each key', () => {
    for (const [key, value] of Object.entries(overlay.processColors)) {
      expect(PROCESS_COLORS[key as keyof typeof PROCESS_COLORS]).toBe(value);
    }
  });
});
```

**Résolution du chemin** : `apps/web/src/lib/` → `../../../../packages/registry/` = 4 segments vers le haut (lib → src → web → apps → racine) puis descente vers `packages/registry/`. Validé cohérent avec l'arborescence pnpm workspaces.

**Critère de succès** : `pnpm --filter @carto-ecp/web test` inclut et passe ce nouveau test. Lancé à froid sur l'état actuel du repo, il doit passer (les palettes sont synchronisées aujourd'hui, vérifié durant l'exploration).

### 4.4. P1-4 — Exception typée sur `component_directory.csv` vide

**Fichier** : `apps/api/src/ingestion/ingestion.service.ts`

```ts
// Avant (ligne 33)
if (componentDirectoryRows.length === 0) {
  throw new Error('component_directory.csv contient aucune ligne de data');
}

// Après
if (componentDirectoryRows.length === 0) {
  throw new InvalidUploadException(
    'component_directory.csv ne contient aucune ligne de données',
    { fileName: 'component_directory.csv' },
  );
}
```

Plus l'import en tête de fichier :

```ts
import { InvalidUploadException } from '../common/errors/ingestion-errors.js';
```

**Contrat HTTP** :

- Avant : HTTP 500, réponse non typée
- Après : HTTP 400, body `{ code: 'INVALID_UPLOAD', message: '...', context: { fileName: 'component_directory.csv' }, timestamp: '...' }`

**Cohérent avec** : les 6 autres sous-classes de `IngestionError` déjà utilisées dans le pipeline (`MissingRequiredCsvException`, `UnknownMadesNamespaceException`, etc.).

---

## 5. Tests et risques de régression

| Item | Test à ajouter | Tests existants à vérifier | Risque de régression |
|------|----------------|---------------------------|----------------------|
| P1-1 | Aucun (ESLint = outil de qualité, pas testé unitairement) | Tous les tests (`pnpm test`) doivent passer après fix des violations | Faible — fixes attendus sont cosmetic (imports, type imports, underscore-prefixed) |
| P1-2 | Aucun — le fallback préserve le comportement actuel | `registry.service.spec.ts` | Nul si fallback fonctionne ; vérifié via `pnpm --filter @carto-ecp/api test` |
| P1-3 | 2 cas dans `process-colors.sync.test.ts` (clés, valeurs) | Aucun | Nul — nouveau fichier isolé |
| P1-4 | Aucun test unitaire dédié (couvert par P2-1 Phase 2) | `full-ingestion.spec.ts` ne teste pas le cas CSV vide | Nul — on remplace un throw par un throw équivalent, même sémantique d'interruption |

**Décision assumée** : pas de test unitaire pour P1-4 en Phase 1. Les tests de cas de rejet de `SnapshotsController` sont explicitement dans le périmètre P2-1 Phase 2. Rédiger un test à cheval ici dégraderait la cohésion des deux phases.

---

## 6. Critères de succès globaux

Tous doivent être vrais avant merge :

1. `pnpm install` passe sans warning de peer deps
2. `pnpm lint` à la racine retourne exit 0
3. `pnpm typecheck` à la racine retourne exit 0
4. `pnpm test` à la racine retourne exit 0 (api + web, nouveau test `process-colors.sync` inclus)
5. `pnpm test:e2e` continue à passer (Playwright smoke — aucun impact fonctionnel attendu)
6. Boot manuel : `pnpm dev` démarre ; le log API montre `Registry root: <chemin>` ; l'upload d'un zip des fixtures fonctionne comme avant
7. Vérification manuelle P1-4 : upload d'un zip modifié avec `component_directory.csv` vide retourne HTTP 400 code `INVALID_UPLOAD`

---

## 7. Stratégie de commits

4 commits conventional dans un seul PR, ordre imposé :

```
feat(tooling): câbler ESLint 9 flat config sur api + web (P1-1)
fix(api/registry): résoudre REGISTRY_PATH via env var avec fallback (P1-2)
test(web/map): garde anti-désynchro palette processColors JSON/TS (P1-3)
fix(api/ingestion): HTTP 400 typé sur component_directory.csv vide (P1-4)
```

P1-1 est posé **en premier** pour que les 3 commits suivants s'écrivent dans du code déjà sous lint. Si P1-2/P1-3/P1-4 introduisent des violations, elles sont corrigées dans leur commit respectif.

Chaque commit termine par la ligne imposée par CLAUDE.md :

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 8. Écart identifié avec le plan de remédiation

Le plan `docs/retro/plan-remediation.md` classait P1-1 en effort **S**. L'exploration révèle que **aucune dépendance ESLint n'est installée** dans les deux workspaces (le `.eslintrc.cjs` de l'api est orphelin). L'effort réel de P1-1 est **M** :

- Création de 2 configs flat
- Installation de 12 paquets devDeps cumulés
- Fixes des violations du premier passage (estimés < 20)

Cet écart est noté dans le commit P1-1 et ne remet pas en cause la Phase 1 globale. Les 3 autres items (P1-2, P1-3, P1-4) sont conformes à l'effort annoncé par le plan (XS, S, XS).

---

## 9. ADR proposé

Conformément à la règle 5 de `.claude/rules/00-global.md`, une décision architecturale identifiée sera rédigée **en fin d'implémentation** (via le hook Stop → `update-writer-after-implement`), pas en amont :

- **ADR-XXX — ESLint flat config par workspace**
  - Statut : acceptée
  - Contexte : ESLint 9 force flat config, le projet a besoin d'activer le lint
  - Décision : `eslint.config.mjs` par workspace, pas de preset racine, ruleset recommended + type-aware balanced
  - Conséquences : toute future app devra créer son propre `eslint.config.mjs` ; reconsidérer un preset partagé si une 3ᵉ app arrive
  - Alternatives écartées : legacy `.eslintrc` (déprécié), preset racine (YAGNI à 2 workspaces)

Les 3 autres items (P1-2, P1-3, P1-4) sont des corrections opérationnelles sans poids architectural — commit message suffit, pas d'ADR.

---

## 10. Prochaines étapes

1. Validation de ce spec par le dev responsable
2. Invocation du skill `superpowers:writing-plans` pour produire le plan d'implémentation détaillé
3. Exécution du plan sur branche `feat/phase1-remediation`
4. Revue humaine de la PR
5. Merge vers `main` (pas vers `feature/slice-1`)
6. Lancement du spec Phase 2 (tests — 8 actions P2-1 à P2-8)
