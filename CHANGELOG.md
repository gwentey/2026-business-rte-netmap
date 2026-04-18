# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) · Versioning : [SemVer](https://semver.org/lang/fr/).

---

## [Unreleased]

### Added

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

- **P1-2 — REGISTRY_PATH env var** : `RegistryService` déplace la résolution du chemin dans `onModuleInit()`. Lit `process.env.REGISTRY_PATH` avec fallback sur `../../packages/registry`. Suppression de la constante module-level `REGISTRY_PACKAGE_ROOT`. Log `Registry root: <path>` au boot.
- **P2-1 — ESLint web** : override étendu aux `**/*.test.{ts,tsx}` et `**/*.spec.{ts,tsx}` dans `apps/web/eslint.config.mjs` pour autoriser les patterns de test.

### Fixed

- **P1-1 — Violations JSX/TS** : 10 violations `react/jsx-no-leaked-render` corrigées (pattern `{x && <C/>}` → `{x ? <C/> : null}`) dans 6 fichiers TSX. 2 violations `no-misused-promises` corrigées dans `UploadPage.tsx` (async `onClick` wrappé avec `void`).
- **P1-4 — HTTP 500 → HTTP 400 sur CSV vide** : `IngestionService` lève désormais `InvalidUploadException` (HTTP 400, code `INVALID_UPLOAD`) au lieu d'une `Error` native quand `component_directory.csv` est vide ou absent de l'archive.
- **P2-7 — Bascule activeSnapshotId invalide** : `loadSnapshots` dans `app-store.ts` vérifie si l'`activeSnapshotId` persisté dans localStorage est encore présent dans la liste retournée (`persistedStillValid`). Si non valide et `list.length > 0`, bascule automatiquement sur `list[0]`. Si valide et graphe non chargé, déclenche `setActiveSnapshot` au boot.

### Removed

### BDD
