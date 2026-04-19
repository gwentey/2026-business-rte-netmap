# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) · Versioning : [SemVer](https://semver.org/lang/fr/).

---

## [Unreleased]

### Added

- **v2-2a T1 — 7 ADRs fondateurs slice 2a** : `docs/adr/ADR-023` (raw + compute on read), `ADR-024` (cascade 5 niveaux par champ), `ADR-025` (clé path 5 champs sans tri canonique), `ADR-026` (`effectiveDate` pilotante), `ADR-027` (`envName` first-class), `ADR-028` (suppression endpoints legacy `/api/snapshots*`), `ADR-030` (heuristique `DumpTypeDetector`). Commits `d948e2e`, `49f4148`, `08d068c`.
- **v2-2a T2 — Schéma Prisma v2.0 raw tables + reset DB** : réécriture intégrale de `apps/api/prisma/schema.prisma` avec 8 modèles nouveaux (`Import`, `ImportedComponent`, `ImportedComponentUrl`, `ImportedPath`, `ImportedMessagingStat`, `ImportedAppProperty`, `ComponentOverride`, `EntsoeEntry`). Migration `20260419135633_v2_fondations_raw_tables` appliquée. Types shared `ImportSummary`/`ImportDetail` ajoutés dans `packages/shared/src/graph.ts`. `SnapshotSummary`/`SnapshotDetail` supprimés. `lat`/`lng` rendus nullable sur `ImportedComponent` — le fallback Bruxelles sera appliqué au rendu via la cascade, plus à l'ingestion. Commit `59ed9de`.

### Changed

- **v2-2a dette — Suppression index redondant `Import.envName`** : l'index simple `@@index([envName])` est couvert par le composite `@@index([envName, effectiveDate])` via leftmost-prefix scan B-tree. Migration `20260419150916_drop_redundant_envname_index` appliquée. Détecté par code-review quality de T2. Commit `14a6866`.

- **P3-1 — Re-packaging zip sans fichiers sensibles** : `SnapshotPersisterService.repackageWithoutSensitive(buffer)` retire `local_key_store.csv`, `registration_store.csv` et `registration_requests.csv` du zip avant écriture sur disque. Le zip archivé dans `storage/snapshots/` ne contient plus de données sensibles ECP.
- **P3-2 — Seuil `isRecent` configurable via env var** : `GraphService` lit `ISRECENT_THRESHOLD_MS` (défaut : `86400000` = 24h) via `parseThreshold()` dans le constructeur. Configurable sans modification du code pour les processus basse fréquence (UK-CC-IN, TP).
- **P3-3 — Pré-calcul `rteEicSet` dans `RegistryService`** : le `Set<string>` des EICs RTE est construit une seule fois dans `onModuleInit()` et exposé via `getRteEicSet()`. `NetworkModelBuilderService` consomme `this.registry.getRteEicSet()` au lieu de reconstruire le set à chaque appel de `build()`.
- **P3-4 — `mapConfig` externalisé dans `GraphResponse`** : `RegistryService` expose `getMapConfig()` depuis `eic-rte-overlay.json#mapConfig`. `GraphService` inclut `mapConfig` dans le `GraphResponse`. `useMapData.ts` consomme `graph.mapConfig` (plus de constantes `PARIS_LAT/PARIS_LNG/OFFSET_DEG` hardcodées). Nouveau type `MapConfig` dans `packages/shared/src/graph.ts`.
- **P3-5 — ADR-022 nestjs-zod (documentation)** : `docs/adr/ADR-022-nestjs-zod-validation-strategy.md` documente la décision de standardiser `nestjs-zod` pour les futurs endpoints (commit b6024f6).
- **P3-7 — Nettoyage whitelist `USABLE_CSV_FILES`** : `message_type.csv` et `message_upload_route.csv` retirés de `USABLE_CSV_FILES` dans `apps/api/src/ingestion/types.ts`. La whitelist reflète désormais exactement les CSV lus et parsés par le pipeline.

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

- **P3-4 — `useMapData` consomme `graph.mapConfig`** : les constantes `PARIS_LAT`, `PARIS_LNG`, `OFFSET_DEG` et le seuil de proximité ne sont plus hardcodés dans `useMapData.ts` — ils proviennent désormais de `graph.mapConfig` retourné par `GET /api/snapshots/:id/graph`. Suppression de la dépendance sur `eic-rte-overlay.json` dans `packages/registry`.

- **P1-2 — REGISTRY_PATH env var** : `RegistryService` déplace la résolution du chemin dans `onModuleInit()`. Lit `process.env.REGISTRY_PATH` avec fallback sur `../../packages/registry`. Suppression de la constante module-level `REGISTRY_PACKAGE_ROOT`. Log `Registry root: <path>` au boot.
- **P2-1 — ESLint web** : override étendu aux `**/*.test.{ts,tsx}` et `**/*.spec.{ts,tsx}` dans `apps/web/eslint.config.mjs` pour autoriser les patterns de test.

### Fixed

- **P1-1 — Violations JSX/TS** : 10 violations `react/jsx-no-leaked-render` corrigées (pattern `{x && <C/>}` → `{x ? <C/> : null}`) dans 6 fichiers TSX. 2 violations `no-misused-promises` corrigées dans `UploadPage.tsx` (async `onClick` wrappé avec `void`).
- **P1-4 — HTTP 500 → HTTP 400 sur CSV vide** : `IngestionService` lève désormais `InvalidUploadException` (HTTP 400, code `INVALID_UPLOAD`) au lieu d'une `Error` native quand `component_directory.csv` est vide ou absent de l'archive.
- **P2-7 — Bascule activeSnapshotId invalide** : `loadSnapshots` dans `app-store.ts` vérifie si l'`activeSnapshotId` persisté dans localStorage est encore présent dans la liste retournée (`persistedStillValid`). Si non valide et `list.length > 0`, bascule automatiquement sur `list[0]`. Si valide et graphe non chargé, déclenche `setActiveSnapshot` au boot.

### Changed

- **Phase 4 — `EdgePath` réécrit avec `<Polyline>` sampled bezier** : `EdgePath.tsx` abandonne l'approche impérative `useEffect`/`useRef`/`L.curve` au profit d'un rendu déclaratif `<Polyline positions={sampleBezier(...)} pathOptions={...} eventHandlers={...} />`. Le helper `sampleBezier` génère N+1 points intermédiaires le long de la courbe quadratique. Deux tests Vitest (`EdgePath.test.tsx`) vérifient le nombre de points et le midpoint.

### Removed

- **Phase 4 — Suppression de `leaflet-curve`** : la dépendance `leaflet-curve` est retirée de `apps/web/package.json` et `pnpm-lock.yaml`. Le stub `declare module 'leaflet-curve'` est supprimé de `apps/web/src/env.d.ts`. Dette m10 résolue.

### BDD
