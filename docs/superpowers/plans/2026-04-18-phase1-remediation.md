# Phase 1 Remédiation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les 4 actions bloquantes du plan de remédiation (P1-1 à P1-4) pour débloquer la suite opérationnelle (Docker, CI, tests) du projet Carto ECP.

**Architecture:** Chaque item est implémenté dans un commit conventional distinct sur la branche `feat/phase1-remediation` issue de `feature/slice-1`. L'ordre est imposé : P1-1 (lint) d'abord pour que les commits suivants soient écrits sous lint. Les corrections sont minimales par conception (pas de refactor invasif).

**Tech Stack:** Node 20.11+, pnpm 9+, TypeScript 5.5, NestJS 10 (api CommonJS), React 18 + Vite 5 (web ESM), ESLint 9 flat config, typescript-eslint 8, Vitest 2.1, Prisma 5.20.

**Spec de référence :** `docs/superpowers/specs/2026-04-18-phase1-remediation-design.md`

---

## Task 0 : Créer la branche de travail

**Files :** aucun (opération git)

- [ ] **Step 1 : Vérifier l'état git propre**

Run :
```bash
git status --short
```

Expected : un hash de branche `feature/slice-1` sans modifications trackées (les fichiers untracked `.claude/`, `CHANGELOG.md`, etc. sont OK et resteront hors des commits de cette branche).

- [ ] **Step 2 : Créer la branche**

Run :
```bash
git checkout -b feat/phase1-remediation
```

Expected : `Switched to a new branch 'feat/phase1-remediation'`.

---

# Partie A — P1-1 : Câblage ESLint flat config

## Task 1 : Installer les dépendances ESLint dans `apps/api`

**Files :** `apps/api/package.json`

- [ ] **Step 1 : Installer les 4 paquets devDeps**

Run depuis la racine :
```bash
pnpm --filter @carto-ecp/api add -D eslint@^9 typescript-eslint@^8 @eslint/js@^9 globals@^15
```

Expected : `apps/api/package.json` contient les 4 paquets en `devDependencies`, le lockfile est mis à jour, pnpm résout sans warning de peer dep non-optionnel.

- [ ] **Step 2 : Vérifier la version d'ESLint installée**

Run :
```bash
pnpm --filter @carto-ecp/api exec eslint --version
```

Expected : `v9.x.x` (version exacte dépend du jour).

## Task 2 : Supprimer la config legacy et créer `eslint.config.mjs` dans `apps/api`

**Files :**
- Delete : `apps/api/.eslintrc.cjs`
- Create : `apps/api/eslint.config.mjs`

- [ ] **Step 1 : Supprimer la config legacy**

Run :
```bash
rm apps/api/.eslintrc.cjs
```

- [ ] **Step 2 : Créer la flat config**

Contenu de `apps/api/eslint.config.mjs` :

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

## Task 3 : Ajuster le script `lint` de l'api et lancer un premier passage

**Files :** `apps/api/package.json`

- [ ] **Step 1 : Modifier le script `lint`**

Dans `apps/api/package.json`, remplacer la ligne :
```json
"lint": "eslint src --ext .ts",
```
par :
```json
"lint": "eslint src test",
```

La flat config gère désormais les extensions via ses patterns, `--ext` est ignoré / déprécié.

- [ ] **Step 2 : Lancer ESLint et noter les violations**

Run :
```bash
pnpm --filter @carto-ecp/api lint
```

Expected : soit exit 0 (idéal), soit liste de violations. Noter le nombre total et le type (`no-floating-promises`, `consistent-type-imports`, `no-non-null-assertion`, etc.).

- [ ] **Step 3 : Décision sur le seuil**

- Si **≤ 20 violations totales** : passer à l'étape 4
- Si **> 20 violations totales** : stopper, le design doit être révisé (le seuil a été fixé en section 4.1 du spec). Remonter au dev lead.

## Task 4 : Corriger les violations ESLint dans `apps/api`

**Files :** variables selon les violations détectées

- [ ] **Step 1 : Traiter chaque violation**

Stratégie par type de violation :

- **`consistent-type-imports`** → remplacer `import { Foo } from '...'` par `import type { Foo } from '...'` quand `Foo` n'est utilisé qu'en position de type. Fix automatique : `pnpm --filter @carto-ecp/api exec eslint src test --fix`.
- **`no-unused-vars`** → supprimer la variable ; si c'est un param, préfixer `_` (ex. `_unused`).
- **`no-floating-promises`** → ajouter `await` ou `void`.
- **`no-misused-promises`** → typer correctement ou `void`.
- **`no-non-null-assertion` (sur src/, après length-check légitime)** → si **≤ 3 occurrences** : ajouter `// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded by ... above` avec justification. Si **> 3 occurrences** : downgrade à warn dans la config en ajoutant `'@typescript-eslint/no-non-null-assertion': 'warn'` dans le bloc rules principal (les vrais bugs restent signalés, les patterns légitimes ne bloquent pas).

- [ ] **Step 2 : Re-lancer ESLint**

Run :
```bash
pnpm --filter @carto-ecp/api lint
```

Expected : exit 0.

- [ ] **Step 3 : Vérifier que les tests api passent encore**

Run :
```bash
pnpm --filter @carto-ecp/api test
```

Expected : tous les tests passent (aucun test nouvellement cassé par les fixes de lint).

## Task 5 : Installer les dépendances ESLint dans `apps/web`

**Files :** `apps/web/package.json`

- [ ] **Step 1 : Installer les 8 paquets devDeps**

Run depuis la racine :
```bash
pnpm --filter @carto-ecp/web add -D eslint@^9 typescript-eslint@^8 @eslint/js@^9 globals@^15 eslint-plugin-react@^7 eslint-plugin-react-hooks@^5 eslint-plugin-react-refresh@^0.4 eslint-plugin-jsx-a11y@^6
```

Expected : `apps/web/package.json` contient les 8 paquets en `devDependencies`, lockfile mis à jour, résolution sans peer warning.

- [ ] **Step 2 : Vérifier la version d'ESLint**

Run :
```bash
pnpm --filter @carto-ecp/web exec eslint --version
```

Expected : `v9.x.x`.

## Task 6 : Créer `eslint.config.mjs` dans `apps/web`

**Files :** Create : `apps/web/eslint.config.mjs`

- [ ] **Step 1 : Écrire la flat config**

Contenu de `apps/web/eslint.config.mjs` :

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

## Task 7 : Lancer ESLint web et corriger les violations

**Files :** variables selon les violations détectées

- [ ] **Step 1 : Premier passage**

Run :
```bash
pnpm --filter @carto-ecp/web lint
```

Expected : liste de violations (ou exit 0 si rien).

- [ ] **Step 2 : Décision sur le seuil**

- Si **≤ 20 violations** : passer à l'étape 3
- Si **> 20 violations** : stopper, remonter au dev lead.

- [ ] **Step 3 : Fixer les violations**

Stratégie (identique à Task 4) :

- Fix automatique : `pnpm --filter @carto-ecp/web exec eslint src --fix`
- Pour les fixes non automatiques (ex : `react-hooks/exhaustive-deps`) : ajouter la dépendance manquante si elle est légitime, ou désactiver ligne par ligne avec justification.
- Pour `react/jsx-no-leaked-render` : remplacer `{value && <Component />}` par `{value ? <Component /> : null}` quand `value` peut être `0` ou `''`.

- [ ] **Step 4 : Re-lancer ESLint**

Run :
```bash
pnpm --filter @carto-ecp/web lint
```

Expected : exit 0.

- [ ] **Step 5 : Vérifier que tests + typecheck passent**

Run :
```bash
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/web test
```

Expected : les deux commandes retournent exit 0. (`passWithNoTests: true` est activé dans `apps/web/vitest.config.ts`, donc ce sera trivialement OK avant Task 12.)

## Task 8 : Vérifier le lint à la racine et commiter P1-1

**Files :** aucun

- [ ] **Step 1 : Lancer `pnpm lint` depuis la racine**

Run :
```bash
pnpm lint
```

Expected : les deux workspaces lintent sans erreur, exit code 0 global.

- [ ] **Step 2 : Lancer `pnpm typecheck` depuis la racine**

Run :
```bash
pnpm typecheck
```

Expected : exit 0.

- [ ] **Step 3 : Lancer `pnpm test` depuis la racine**

Run :
```bash
pnpm test
```

Expected : toutes les suites Vitest passent (api ingestion, registry, common, graph).

- [ ] **Step 4 : Stager les fichiers P1-1**

Run :
```bash
git add apps/api/eslint.config.mjs apps/api/package.json apps/web/eslint.config.mjs apps/web/package.json pnpm-lock.yaml
git rm apps/api/.eslintrc.cjs
```

Si Task 4 ou 7 a modifié du code source pour fixer des violations, ajouter aussi ces fichiers :
```bash
git add <fichiers fixés>
```

- [ ] **Step 5 : Commit**

Run :
```bash
git commit -m "$(cat <<'EOF'
feat(tooling): câbler ESLint 9 flat config sur api + web (P1-1)

- Nouveaux eslint.config.mjs par workspace (api + web)
- Suppression du .eslintrc.cjs legacy de l'api
- Installation des deps ESLint 9 + typescript-eslint 8 + plugins React
- Ruleset balanced : recommended + règles type-aware ciblées
- Override no-non-null-assertion pour les specs (pattern array[i]! autorisé)
- Scripts lint ajustés : api = src test, web = src

Refs: plan-remediation P1-1, dette M1 + M5, ADR flat config à finaliser.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : commit créé, `git log --oneline -1` montre le hash + titre.

---

# Partie B — P1-2 : REGISTRY_PATH via variable d'environnement

## Task 9 : Écrire un test qui échoue pour REGISTRY_PATH

**Files :** Modify : `apps/api/src/registry/registry.service.spec.ts`

- [ ] **Step 1 : Ajouter un bloc `describe` pour la résolution de chemin**

Ajouter à la fin de `apps/api/src/registry/registry.service.spec.ts` (avant la dernière accolade fermante du `describe` principal) :

```ts
  describe('registry path resolution', () => {
    const ORIGINAL_ENV = process.env.REGISTRY_PATH;
    const ORIGINAL_CWD = process.cwd();

    afterEach(() => {
      if (ORIGINAL_ENV === undefined) {
        delete process.env.REGISTRY_PATH;
      } else {
        process.env.REGISTRY_PATH = ORIGINAL_ENV;
      }
      process.chdir(ORIGINAL_CWD);
    });

    it('loads the registry from REGISTRY_PATH env var when set', async () => {
      process.env.REGISTRY_PATH = resolve(ORIGINAL_CWD, '../../packages/registry');
      const moduleRef = await Test.createTestingModule({
        providers: [RegistryService],
      }).compile();
      const svc = moduleRef.get(RegistryService);
      await svc.onModuleInit();
      expect(svc.entsoeSize()).toBeGreaterThan(14000);
    });

    it('falls back to the relative path when REGISTRY_PATH is not set', async () => {
      delete process.env.REGISTRY_PATH;
      const moduleRef = await Test.createTestingModule({
        providers: [RegistryService],
      }).compile();
      const svc = moduleRef.get(RegistryService);
      await svc.onModuleInit();
      expect(svc.entsoeSize()).toBeGreaterThan(14000);
    });
  });
```

- [ ] **Step 2 : Ajouter les imports manquants**

En haut de `registry.service.spec.ts`, dans l'import existant `{ describe, it, expect, beforeAll }`, ajouter `afterEach` :

```ts
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
```

Et ajouter sous les autres imports :

```ts
import { resolve } from 'node:path';
```

- [ ] **Step 3 : Lancer les tests pour voir l'état actuel**

Run :
```bash
pnpm --filter @carto-ecp/api test -- registry.service
```

Expected : les 2 nouveaux tests **passent** déjà (la constante actuelle résout bien le chemin — mais ils ne testent PAS l'usage réel de `REGISTRY_PATH` tant que la constante est résolue au module-load). On va valider le vrai comportement en Task 10 après modification du service.

**Note importante :** `REGISTRY_PACKAGE_ROOT` est actuellement évaluée à l'import du module — donc le test `loads from REGISTRY_PATH` passe pour la mauvaise raison (il utilise toujours le fallback, quelle que soit la valeur de l'env var). Ce sera vrai après Task 10. Pour prouver la progression, Step 4 ci-dessous force une VRAIE détection d'échec.

- [ ] **Step 4 : Forcer un échec qui valide que REGISTRY_PATH est effectivement consulté**

Modifier temporairement le premier nouveau test pour pointer vers un chemin bidon :

```ts
it('loads the registry from REGISTRY_PATH env var when set', async () => {
  process.env.REGISTRY_PATH = '/tmp/nonexistent-registry';
  const moduleRef = await Test.createTestingModule({
    providers: [RegistryService],
  }).compile();
  const svc = moduleRef.get(RegistryService);
  await expect(svc.onModuleInit()).rejects.toThrow(/ENOENT/);
});
```

Run :
```bash
pnpm --filter @carto-ecp/api test -- registry.service
```

Expected : ce test **FAIL** avec `AssertionError: promise resolved "undefined" instead of rejecting` — parce que le service ignore `REGISTRY_PATH` aujourd'hui et charge depuis le fallback.

C'est le test RED de notre TDD.

## Task 10 : Implémenter la résolution via REGISTRY_PATH dans RegistryService

**Files :** Modify : `apps/api/src/registry/registry.service.ts`

- [ ] **Step 1 : Modifier le service**

Dans `apps/api/src/registry/registry.service.ts` :

Supprimer la ligne 12 :
```ts
const REGISTRY_PACKAGE_ROOT = resolve(process.cwd(), '../../packages/registry');
```

Ajouter une propriété privée `registryRoot` dans la classe (après `private patternRegexes`) :
```ts
private registryRoot!: string;
```

Remplacer `onModuleInit` par :
```ts
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

Dans `loadEntsoeIndex`, remplacer :
```ts
const csvPath = resolve(REGISTRY_PACKAGE_ROOT, 'eic-entsoe.csv');
```
par :
```ts
const csvPath = resolve(this.registryRoot, 'eic-entsoe.csv');
```

Dans `loadOverlay`, remplacer :
```ts
const jsonPath = resolve(REGISTRY_PACKAGE_ROOT, 'eic-rte-overlay.json');
```
par :
```ts
const jsonPath = resolve(this.registryRoot, 'eic-rte-overlay.json');
```

- [ ] **Step 2 : Lancer le test RED, vérifier qu'il passe maintenant**

Run :
```bash
pnpm --filter @carto-ecp/api test -- registry.service
```

Expected : le test `loads the registry from REGISTRY_PATH env var when set` passe (il assertait `rejects.toThrow(/ENOENT/)`).

- [ ] **Step 3 : Restaurer le test à sa forme définitive (positive)**

Remettre la version "positive" du test (qui charge depuis un chemin REGISTRY_PATH valide) :

```ts
it('loads the registry from REGISTRY_PATH env var when set', async () => {
  process.env.REGISTRY_PATH = resolve(ORIGINAL_CWD, '../../packages/registry');
  const moduleRef = await Test.createTestingModule({
    providers: [RegistryService],
  }).compile();
  const svc = moduleRef.get(RegistryService);
  await svc.onModuleInit();
  expect(svc.entsoeSize()).toBeGreaterThan(14000);
});
```

Note : on laisse aussi le test RED précédent sous une autre clause `it` pour couvrir le cas ENOENT :

```ts
it('throws ENOENT when REGISTRY_PATH points to a nonexistent directory', async () => {
  process.env.REGISTRY_PATH = '/tmp/nonexistent-registry-xyz-abc';
  const moduleRef = await Test.createTestingModule({
    providers: [RegistryService],
  }).compile();
  const svc = moduleRef.get(RegistryService);
  await expect(svc.onModuleInit()).rejects.toThrow(/ENOENT/);
});
```

- [ ] **Step 4 : Re-lancer les tests registry complet**

Run :
```bash
pnpm --filter @carto-ecp/api test -- registry.service
```

Expected : tous les tests passent (les préexistants + les 3 nouveaux).

## Task 11 : Vérifier typecheck, lint, tests, et commiter P1-2

**Files :** aucun

- [ ] **Step 1 : Typecheck + lint api**

Run :
```bash
pnpm --filter @carto-ecp/api typecheck
pnpm --filter @carto-ecp/api lint
```

Expected : exit 0 pour les deux.

- [ ] **Step 2 : Smoke full pipeline**

Run :
```bash
pnpm --filter @carto-ecp/api test
```

Expected : tous les tests api passent, y compris les tests d'intégration `full-ingestion.spec.ts` (qui utilisent `RegistryService` avec le fallback par défaut).

- [ ] **Step 3 : Stager P1-2**

Run :
```bash
git add apps/api/src/registry/registry.service.ts apps/api/src/registry/registry.service.spec.ts
```

- [ ] **Step 4 : Commit**

Run :
```bash
git commit -m "$(cat <<'EOF'
fix(api/registry): résoudre REGISTRY_PATH via env var avec fallback (P1-2)

- REGISTRY_PACKAGE_ROOT déplacé de module-load vers onModuleInit
- Nouvelle variable d'env REGISTRY_PATH (fallback relatif inchangé)
- Log "Registry root: <path>" ajouté au boot pour debug Docker
- 2 nouveaux tests : env var respecté, ENOENT si chemin invalide

Débloque le chantier Dockerfile (WORKDIR != apps/api/ possible).

Refs: plan-remediation P1-2, dette M2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : commit créé.

---

# Partie C — P1-3 : Test de synchronisation palettes `processColors`

## Task 12 : Écrire le test de sync (RED par construction temporaire)

**Files :** Create : `apps/web/src/lib/process-colors.sync.test.ts`

- [ ] **Step 1 : Créer le fichier de test**

Contenu de `apps/web/src/lib/process-colors.sync.test.ts` :

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

- [ ] **Step 2 : Lancer le test — doit passer par construction**

Run :
```bash
pnpm --filter @carto-ecp/web test -- process-colors.sync
```

Expected : **2 tests PASS** (les palettes sont actuellement synchronisées, vérifié lors du brainstorming).

- [ ] **Step 3 : Forcer un échec temporaire pour prouver que le test détecte une désynchro**

Modifier temporairement `apps/web/src/lib/process-colors.ts` ligne 4 :
```ts
TP: '#3b82f6',
```
en :
```ts
TP: '#000000',
```

Run :
```bash
pnpm --filter @carto-ecp/web test -- process-colors.sync
```

Expected : le test `has identical hex values for each key` **FAIL** avec `expected "#000000" to be "#3b82f6"`. Le garde-fou fonctionne.

- [ ] **Step 4 : Restaurer la palette d'origine**

Remettre `TP: '#3b82f6'` dans `apps/web/src/lib/process-colors.ts`.

Run :
```bash
pnpm --filter @carto-ecp/web test -- process-colors.sync
```

Expected : les 2 tests PASS de nouveau.

## Task 13 : Vérifier lint + typecheck + commiter P1-3

**Files :** aucun

- [ ] **Step 1 : Lint + typecheck web**

Run :
```bash
pnpm --filter @carto-ecp/web lint
pnpm --filter @carto-ecp/web typecheck
```

Expected : exit 0 pour les deux.

- [ ] **Step 2 : Stager P1-3**

Run :
```bash
git add apps/web/src/lib/process-colors.sync.test.ts
```

- [ ] **Step 3 : Commit**

Run :
```bash
git commit -m "$(cat <<'EOF'
test(web/map): garde anti-désynchro palette processColors JSON/TS (P1-3)

- Nouveau process-colors.sync.test.ts dans apps/web
- Lit eic-rte-overlay.json et PROCESS_COLORS, compare clés + valeurs hex
- Lancé avec la suite Vitest web existante, aucune config supplémentaire
- Échec du test prouvé par modification temporaire (TP: #000000)

Refs: plan-remediation P1-3, dette M3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : commit créé.

---

# Partie D — P1-4 : Exception typée sur `component_directory.csv` vide

## Task 14 : Remplacer le throw natif par `InvalidUploadException`

**Files :** Modify : `apps/api/src/ingestion/ingestion.service.ts`

- [ ] **Step 1 : Ajouter l'import**

En tête de `apps/api/src/ingestion/ingestion.service.ts`, ajouter :

```ts
import { InvalidUploadException } from '../common/errors/ingestion-errors.js';
```

Placer cet import dans le bloc d'imports existant (ordre alphabétique par chemin recommandé).

- [ ] **Step 2 : Remplacer le throw**

Dans `ingest()`, remplacer le bloc :

```ts
if (componentDirectoryRows.length === 0) {
  throw new Error('component_directory.csv contient aucune ligne de data');
}
```

par :

```ts
if (componentDirectoryRows.length === 0) {
  throw new InvalidUploadException(
    'component_directory.csv ne contient aucune ligne de données',
    { fileName: 'component_directory.csv' },
  );
}
```

- [ ] **Step 3 : Typecheck + lint**

Run :
```bash
pnpm --filter @carto-ecp/api typecheck
pnpm --filter @carto-ecp/api lint
```

Expected : exit 0 pour les deux.

- [ ] **Step 4 : Vérifier que les tests existants passent**

Run :
```bash
pnpm --filter @carto-ecp/api test
```

Expected : toutes les suites passent. Les tests `full-ingestion.spec.ts` ne couvrent pas le cas CSV vide, donc pas de régression attendue.

## Task 15 : Vérification manuelle du HTTP 400

**Files :** aucun (test manuel)

- [ ] **Step 1 : Démarrer l'api en mode dev**

Run :
```bash
pnpm --filter @carto-ecp/api dev
```

Attendre le log `Nest application successfully started` sur le port 3000.

- [ ] **Step 2 : Préparer un zip avec un `component_directory.csv` vide**

Depuis un nouveau terminal, créer un zip minimal :
```bash
mkdir -p /tmp/p1-4-test && cd /tmp/p1-4-test
# CSV minimal avec header seulement (0 lignes de data)
echo "component_directory_id;name;country;componentType;componentCode;environmentName;organization;ecp.domain;ecp.componentCode;mades.id;mades.endpointUrl;mades.endpointVersion;mades.implementation;mades.implementationVersion;directoryContent" > component_directory.csv
# AppProperty minimal
echo "key;value" > application_property.csv
zip -r empty-cd.zip application_property.csv component_directory.csv
```

- [ ] **Step 3 : Envoyer le zip à l'endpoint d'upload**

Run :
```bash
curl -s -w "\n%{http_code}\n" -X POST http://localhost:3000/api/snapshots \
  -F "file=@/tmp/p1-4-test/empty-cd.zip" \
  -F "label=TestP14" \
  -F "envName=TEST"
```

Expected : réponse body JSON + code HTTP **400** sur la dernière ligne :
```
{"code":"INVALID_UPLOAD","message":"component_directory.csv ne contient aucune ligne de données","context":{"fileName":"component_directory.csv"},"timestamp":"2026-04-18T..."}
400
```

- [ ] **Step 4 : Arrêter le dev server**

Dans le terminal qui exécute `pnpm dev`, Ctrl+C. Nettoyer `/tmp/p1-4-test` (optionnel).

## Task 16 : Commiter P1-4

**Files :** aucun

- [ ] **Step 1 : Stager P1-4**

Run :
```bash
git add apps/api/src/ingestion/ingestion.service.ts
```

- [ ] **Step 2 : Commit**

Run :
```bash
git commit -m "$(cat <<'EOF'
fix(api/ingestion): HTTP 400 typé sur component_directory.csv vide (P1-4)

- Remplace le throw Error natif (HTTP 500 opaque) par InvalidUploadException
- Code métier INVALID_UPLOAD exploitable côté frontend
- Context.fileName fourni pour diagnostic utilisateur
- Comportement vérifié manuellement via curl sur zip à CSV vide

Refs: plan-remediation P1-4, dette m6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : commit créé, `git log --oneline -4` montre les 4 commits de la Phase 1.

---

# Partie E — Vérification finale et PR

## Task 17 : Vérification intégrée avant PR

**Files :** aucun

- [ ] **Step 1 : Lancer toute la chaîne qualité depuis la racine**

Run (dans l'ordre, sequentially) :
```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
```

Expected : exit 0 pour chacune des 4 commandes.

- [ ] **Step 2 : Lancer les E2E Playwright**

Run :
```bash
pnpm test:e2e
```

Expected : les 3 smoke tests passent (upload, select, switch).

- [ ] **Step 3 : Boot manuel end-to-end**

Run :
```bash
pnpm dev
```

Dans un navigateur, ouvrir http://localhost:5173. Drag-drop un zip des fixtures `tests/fixtures/17V000000498771C_.../`, vérifier que l'upload réussit, cliquer "Voir sur la carte", vérifier que la carte s'affiche avec arêtes colorées.

Arrêter `pnpm dev` (Ctrl+C).

- [ ] **Step 4 : Vérifier le log `Registry root` dans la sortie API**

Relancer juste l'api :
```bash
pnpm dev:api
```

Expected : dans le log de boot, présence d'une ligne `Registry root: <chemin>` (ex. `.../packages/registry`). Ctrl+C pour arrêter.

## Task 18 : Pousser la branche et ouvrir la PR

**Files :** aucun

- [ ] **Step 1 : Vérifier les commits**

Run :
```bash
git log --oneline feature/slice-1..HEAD
```

Expected : 4 commits (P1-1, P1-2, P1-3, P1-4), dans cet ordre.

- [ ] **Step 2 : Pousser la branche**

Run :
```bash
git push -u origin feat/phase1-remediation
```

Expected : branche créée sur le remote.

- [ ] **Step 3 : Ouvrir la PR via `gh`**

Run :
```bash
gh pr create --base main --title "Phase 1 remédiation : P1-1 à P1-4" --body "$(cat <<'EOF'
## Summary
- Câblage ESLint 9 flat config pour les deux workspaces (P1-1, dette M1 + M5)
- REGISTRY_PATH env var avec fallback dev-local (P1-2, dette M2)
- Test anti-désynchro palette processColors JSON/TS (P1-3, dette M3)
- InvalidUploadException typée sur component_directory.csv vide (P1-4, dette m6)

Spec : `docs/superpowers/specs/2026-04-18-phase1-remediation-design.md`
Plan : `docs/superpowers/plans/2026-04-18-phase1-remediation.md`

## Test plan
- [x] `pnpm lint` exit 0 à la racine
- [x] `pnpm typecheck` exit 0
- [x] `pnpm test` exit 0 (toutes suites Vitest)
- [x] `pnpm test:e2e` exit 0 (3 smokes Playwright)
- [x] Boot manuel : `pnpm dev` + upload zip fixture + map affichée
- [x] Log `Registry root: <path>` visible au boot API
- [x] Curl sur zip à CSV vide : HTTP 400 code INVALID_UPLOAD

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected : URL de PR imprimée dans la sortie.

- [ ] **Step 4 : Reporter l'URL au dev lead**

Copier l'URL retournée par `gh pr create` dans le chat pour revue humaine.

---

## Self-Review (checklist exécutée à la rédaction de ce plan)

**Spec coverage :**
- P1-1 → Tasks 1-8 ✓
- P1-2 → Tasks 9-11 ✓
- P1-3 → Tasks 12-13 ✓
- P1-4 → Tasks 14-16 ✓
- Vérification finale §6 du spec → Task 17 ✓
- Stratégie de commits §7 (4 commits ordonnés) → respecté par la structure Parties A/B/C/D ✓
- Seuil > 20 violations § 4.1 → inclus en Tasks 3.3 et 7.2 ✓

**Placeholder scan :** aucune occurrence de "TBD", "TODO", "implement later", "add appropriate". Tous les blocs de code sont complets.

**Type consistency :**
- `InvalidUploadException` avec signature `(message: string, context?: ErrorContext)` — utilisée cohérente entre spec §4.4 et Task 14 ✓
- `REGISTRY_PATH` env var consultée une seule fois, dans `onModuleInit` — cohérent entre spec §4.2 et Task 10 ✓
- `import.meta.dirname` utilisé en Task 12 — cohérent avec la correction du spec auto-review ✓
- `project: './tsconfig.json'` (pas dual) utilisé en Task 2 — cohérent avec la correction du spec auto-review ✓

**Écarts identifiés avec le spec :** aucun.
