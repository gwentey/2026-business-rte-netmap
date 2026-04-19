# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) · Versioning : [SemVer](https://semver.org/lang/fr/).

---

## [Unreleased]

### v2.0-alpha.1 — Slice 2a Fondations (2026-04-19)

**Refonte architecturale majeure du modèle de données et du pipeline ECP.** L'hypothèse v1.2 « 1 snapshot = 1 vue complète du réseau » est remplacée par une logique cumulative : la carte agrège désormais `N imports` successifs par environnement, avec résolution à la lecture (compute-on-read) et cascade de priorité à 5 niveaux.

**Highlights :**

- **Nouveau modèle Prisma** : tables `Import`, `ImportedComponent(+Url)`, `ImportedPath`, `ImportedMessagingStat`, `ImportedAppProperty` (contributions brutes conservées) + `ComponentOverride` (surcharge admin globale par EIC, cross-env) + `EntsoeEntry` (annuaire ENTSO-E embarqué, vide en 2a). `lat/lng` nullable — fallback Bruxelles appliqué au rendu.
- **Pipeline d'ingestion refondu** : `ZipExtractor → CsvReader → XmlMadesParser → DumpTypeDetector (nouveau) → ImportBuilder (nouveau) → RawPersister (nouveau)`. La résolution registry est **déplacée au read** pour garantir la rétroactivité des changements de registry.
- **GraphService compute-on-read** : 3 fonctions pures isolées et testables (`mergeComponentsLatestWins`, `applyCascade` 5 niveaux, `mergePathsLatestWins`) composées à chaque requête. Timeline prête côté backend via `refDate` (slider front en slice 2d).
- **Cascade de priorité 5 niveaux par champ** : `ComponentOverride` > `EntsoeEntry` > registry RTE > latest-import > default Bruxelles.
- **Frontière `envName` first-class** : imports scopés par env, rendu carte scopé par env, overrides/ENTSO-E/registry globaux. Aucune fusion cross-env.
- **Nouveaux endpoints API** : `POST /api/imports`, `GET /api/imports[?env]`, `DELETE /api/imports/:id`, `GET /api/graph?env&refDate`, `GET /api/envs`. Endpoints legacy `/api/snapshots*` supprimés (reset DB total, dev-local).
- **Front refondu** : route `/` = carte (empty state différencié), `/map` redirige vers `/`, `/upload` conservé comme entrée secondaire. Nouveau `EnvSelector` component remplace `SnapshotSelector`. Store Zustand refondu (`activeEnv` persisté, suppression `activeSnapshotId`).
- **Tests** : 121 tests api (16+ suites dont 3 intégration) + 33 tests web + 3 E2E Playwright (empty-state, upload-then-map, env-switch). `typecheck` api + web + shared PASS.
- **ADRs fondateurs** : 7 ADRs rédigés en amont (ADR-023 à ADR-028, ADR-030).
- **Migrations Prisma** : `20260419135633_v2_fondations_raw_tables` + `20260419150916_drop_redundant_envname_index`.

**Breaking changes (dev-local uniquement) :**

- Schéma Prisma remplacé intégralement. Reset total de `dev.db`. Les anciens zips sous `storage/snapshots/` sont orphelins (dossier supprimable manuellement, le nouveau chemin est `storage/imports/`).
- Endpoints `/api/snapshots*` supprimés sans couche de compat.
- Types shared `SnapshotSummary` / `SnapshotDetail` supprimés au profit de `ImportSummary` / `ImportDetail`.

**Non-inclus (reporté aux slices suivantes, voir chapeau v2.0 §7) :**

- Upload multi-fichiers + détection auto avancée (slice 2b)
- Panneau admin (Imports + Composants + surcharge EIC) (slice 2c)
- Timeline slider UI (slice 2d)
- Refresh ENTSO-E + registry admin + purges (slice 2e)
- Icônes différenciées par type (slice 2f)

### Added

- **v2-2a T1 — 7 ADRs fondateurs slice 2a** : `docs/adr/ADR-023` (raw + compute on read), `ADR-024` (cascade 5 niveaux par champ), `ADR-025` (clé path 5 champs sans tri canonique), `ADR-026` (`effectiveDate` pilotante), `ADR-027` (`envName` first-class), `ADR-028` (suppression endpoints legacy `/api/snapshots*`), `ADR-030` (heuristique `DumpTypeDetector`). Commits `d948e2e`, `49f4148`, `08d068c`.
- **v2-2a T2 — Schéma Prisma v2.0 raw tables + reset DB** : réécriture intégrale de `apps/api/prisma/schema.prisma` avec 8 modèles nouveaux (`Import`, `ImportedComponent`, `ImportedComponentUrl`, `ImportedPath`, `ImportedMessagingStat`, `ImportedAppProperty`, `ComponentOverride`, `EntsoeEntry`). Migration `20260419135633_v2_fondations_raw_tables` appliquée. Types shared `ImportSummary`/`ImportDetail` ajoutés dans `packages/shared/src/graph.ts`. `SnapshotSummary`/`SnapshotDetail` supprimés. `lat`/`lng` rendus nullable sur `ImportedComponent` — le fallback Bruxelles sera appliqué au rendu via la cascade, plus à l'ingestion. Commit `59ed9de`.
- **v2-2a T3 — `filename-parser`** : fonction pure `parseDumpFilename()` extrait `{ sourceComponentEic, sourceDumpTimestamp }` des noms de fichier canoniques `{EIC}_{timestamp}.zip`. 5/5 tests. Commit `e6cf20f`.
- **v2-2a T4 — `DumpTypeDetector`** : heuristique 2a — présence `<?xml` dans un champ CSV → `ENDPOINT`, sinon `COMPONENT_DIRECTORY`. `BROKER` seulement via override explicite. 4/4 tests. Commit `818ec83`.
- **v2-2a T5-T7 — `ImportBuilderService`** : service sans DI, 4 méthodes pures. `buildFromLocalCsv` (contribution brute depuis CSV, sans cascade registry), `buildFromXml` (extraction composants + paths + stubs BROKER depuis le blob XML MADES, adapté à la structure réelle `MadesTree`), `buildMessagingStats` (parsing dates/numbers/booléens), `buildAppProperties` (filtrage regex clés sensibles case-insensitive). 9/9 tests. Commits `5335608`, `1e4c4c4`, `8becefa`.
- **v2-2a T8 — `RawPersisterService`** : écriture transactionnelle Prisma des `Import` + `ImportedComponent[]` + `ImportedComponentUrl[]` + `ImportedPath[]` + `ImportedMessagingStat[]` + `ImportedAppProperty[]`. Repackaging zip sans fichiers sensibles (P3-1 conservé). Cleanup zip disque sur rollback (P3-6 conservé). Zips archivés sous `storage/imports/{uuid}.zip`. 2/2 tests. Commit `4a078ba`.
- **v2-2a T9 — `ImportsService`** : orchestrateur pipeline (zip → csv → xml → detector → builder → persister). `createImport(input)` avec SHA256 du file buffer, dédup composants CSV↔XML (XML prioritaire), `effectiveDate = sourceDumpTimestamp ?? new Date()`. `listImports(env?)` + `deleteImport(id)` cascade + unlink zip. 3/3 tests. Commit `bdf2017`.
- **v2-2a T10 — `ImportsController`** : `POST /api/imports` (multipart) + `GET /api/imports?env=X` + `DELETE /api/imports/:id` (204). Validation zod `{envName, label, dumpType?}` + MIME check + magic bytes ZIP + limite 50 MB. 9/9 tests. Commit `a2f3d99`.

### Removed

- **v2-2a T11 — Suppression SnapshotsModule + legacy ingestion** : `apps/api/src/snapshots/` (module, controller, service, DTOs), `NetworkModelBuilderService`, `SnapshotPersisterService`, `IngestionService` (legacy orchestrateur), `SnapshotNotFoundException` renommée en `ImportNotFoundException`. Tests d'intégration v1.2 (`full-ingestion-cd`, `full-ingestion-endpoint`, `full-graph-endpoint`, `snapshots-controller`) supprimés — seront remplacés en T18-T19. `IngestionModule` recâblé avec les 6 nouveaux providers + `ImportsController`. 13 suites / 89 tests verts. Commit `18a090e`.

### Added — Phase 3+4 GraphService compute-on-read

- **v2-2a T12 — `mergeComponentsLatestWins`** : fonction pure dans `apps/api/src/graph/merge-components.ts` qui agrège les `ImportedComponent` par EIC, champ par champ, en privilégiant le latest `effectiveDate`. Les champs null ne remplacent jamais un non-null. `isDefaultPosition` passe à `false` dès qu'un import fournit des coord explicites (one-way latch). URLs : latest-wins sur l'ensemble. 6/6 tests. Commit `f2e4112`.
- **v2-2a T13 — `applyCascade`** : fonction pure dans `apps/api/src/graph/apply-cascade.ts` implémentant la cascade 5 niveaux par champ (override admin > ENTSO-E > registry RTE > merged-import > default Bruxelles). Helper `pickField(...values)` retourne la première valeur non-null. `isDefaultPosition = true` ssi lat/lng viennent du fallback. 7/7 tests. Commit `374205c`.
- **v2-2a T14 — `mergePathsLatestWins`** : fonction pure dans `apps/api/src/graph/merge-paths.ts` qui dédup les `ImportedPath` par clé 5 champs `(receiver, sender, messageType, transportPattern, intermediateBroker)` sans tri canonique. Latest `effectiveDate` gagne sur `validFrom/validTo/isExpired`. `process` laissé non-classifié (délégué au `GraphService`). 7/7 tests. Commit `26ab602`.
- **v2-2a T15 — `GraphService.getGraph(env, refDate?)` compute-on-read** : réécriture intégrale. Assemble `mergeComponentsLatestWins` → `applyCascade` → `mergePathsLatestWins` → `buildEdges` à chaque requête. `classifyMessageType` appliqué au read (garantit rétroactivité registry). `isRecent` calculé relativement au `effectiveDate` du latest import (reproductible historique). `RegistryService.resolveEic(eic)` ajoutée pour la cascade niveau 3. `mapConfig.defaultLat/defaultLng` (Bruxelles 50.8503, 4.3517) ajoutés dans `eic-rte-overlay.json` + type `MapConfig`. 6/6 tests intégration + 108/108 total. Commit `0b71665`.
- **v2-2a T16 — `GraphController GET /api/graph?env&refDate`** : nouvelle route avec validation query params (env requis, refDate ISO optionnel, 400 sur invalid). 5/5 tests + typecheck api PASS. Commit `2a7d30c`.
- **v2-2a T17 — `EnvsController GET /api/envs`** : endpoint liste distincte des `envName` présents dans la table `Import`, trié alphabétiquement. Nouveau module `EnvsModule` registered dans `AppModule`. 2/2 tests. Commit `c260f2d`.
- **v2-2a T18-T19 — Tests d'intégration v2** : `full-ingestion-v2.spec.ts` (upload 2 fixtures ENDPOINT+CD, agrégation sans doublons EIC, bounds cohérents, liste imports), `env-isolation.spec.ts` (2 envs indépendants, suppression OPF n'affecte pas PROD), `import-deletion.spec.ts` (cascade delete + zip unlink + NotFoundException sur id inconnu). 8 tests intégration verts / 121 tests total. Commits `28a0cb2`, `2d6bca5`.

### Added — Phase 5 Frontend

- **v2-2a T20 — Client API web v2** : `apps/web/src/lib/api.ts` réécrit pour `listEnvs`, `listImports(env?)`, `createImport(file, envName, label, dumpType?)`, `deleteImport(id)`, `getGraph(env, refDate?)`. URLSearchParams pour les query strings. Suppression des méthodes legacy `createSnapshot`/`listSnapshots`/`getGraph(id)`. Commit `7bcd34c`.
- **v2-2a T21 — Store Zustand refonte** : state `activeEnv` (persisté) + `envs` + `imports` + `graph`. Suppression de `activeSnapshotId`/`snapshots`/`setActiveSnapshot`. `loadEnvs()` avec fallback intelligent (persisted → premier env → null). `setActiveEnv()` parallèle `loadImports + loadGraph`. 5/5 tests. Commit `7e41a15`.
- **v2-2a T22 — `EnvSelector` component** : composant `<select>` synchronisé avec le store, fallback « Aucun env » si liste vide. Remplace `SnapshotSelector`. 4/4 tests. Commit `0ecfcc1`.
- **v2-2a T23 — `MapPage` empty state + consommation activeEnv** : route `/` entrée principale. Empty state différencié (pas d'env vs pas de composants). CTA « Importer un dump » vers `/upload?env=X`. `loadEnvs()` au mount. Commit `fbfae71`.
- **v2-2a T24 — `UploadPage` adaptations v2** : appelle `api.createImport`, lit `envName` depuis `?env=X` (default `OPF`), déclenche `loadEnvs()` post-succès, redirige vers `/`. Affiche `dumpType` et warnings. 10/10 tests. Commit `9661ff2`.
- **v2-2a T25 — `App.tsx` routes refondues** : `/` = MapPage, `/map` → redirect `/`, `/upload` = UploadPage, `*` → `/`. Header : titre + `EnvSelector` + lien `+ Importer`. **Suppression complète du dossier `SnapshotSelector/`**. 33/33 tests web + typecheck web PASS. Commit `0f136e3`.
- **v2-2a T26-T28 — 3 E2E Playwright** : `empty-state.spec.ts` (purge via API + vérif empty state + CTA), `upload-then-map.spec.ts` (upload fixture ENDPOINT → redirect `/` → marker leaflet visible), `env-switch.spec.ts` (2 uploads dans 2 envs → switch via selector, skip dynamique si <2 envs). Localisation confirmée à `apps/web/e2e/`. Commit `28fcc13`.

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
