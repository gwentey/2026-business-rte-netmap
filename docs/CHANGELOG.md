# CHANGELOG — Documents de référence projet

> Ce changelog trace **uniquement** les versions des documents de niveau 0 de `docs/` :
> - `00-note-cadrage.md`
> - `01-cahier-des-charges-macro.md`
>
> Les specs fonctionnelles par feature (`docs/specs/{module}/`) sont versionnées dans leur propre `VERSIONNING.md`.
> Le code applicatif est versionné dans `CHANGELOG.md` à la **racine du projet** (format Keep a Changelog).

---

## [Unreleased]

### Modifie

### Documentation

- `docs/specs/api/ingestion/spec-technique.md` v0.1.1 : ajout de la note sur `InvalidUploadException` (P1-4) dans les patterns, mise à jour date/version
- `docs/specs/api/registry/spec-technique.md` v0.1.1 : remplacement de la section "Résolution du chemin" pour refléter `REGISTRY_PATH` env var (P1-2), ajout section Tests avec les 2 nouveaux cas, mise à jour Notes de déploiement
- `docs/specs/web/map/spec-technique.md` v0.1.1 : mise à jour palette (synchronisation désormais automatisée via test P1-3), ajout `process-colors.sync.test.ts` dans le tableau Tests
- `docs/adr/ADR-020-eslint-flat-config-par-workspace.md` : nouvel ADR — ESLint 9 flat config par workspace (résultat de P1-1)
- `docs/retro/dette-technique.md` : items M1, M2, M3, M5, m6 marqués RESOLU (Phase 1, commit 4f8ae25)
- `docs/retro/plan-remediation.md` : P1-1, P1-2, P1-3, P1-4 marqués Livrés (commit 4f8ae25)
- `docs/specs/api/snapshots/spec-technique.md` v0.2.0 : section Tests réécrite — 10 nouveaux cas unitaires (P2-1)
- `docs/specs/api/ingestion/spec-technique.md` v0.2.0 : section Tests mise à jour — snapshot-persister (3 cas P2-2) + CSV_PARSE_ERROR (P2-8) ; section Patterns mise à jour (refacto CsvReaderService readRaw)
- `docs/specs/api/graph/spec-technique.md` v0.2.0 : section Tests mise à jour — test d'intégration GET /graph (4 cas P2-3)
- `docs/specs/web/upload/spec-technique.md` v0.2.0 : section Tests mise à jour — 6 cas @testing-library/react (P2-4)
- `docs/specs/web/detail-panel/spec-technique.md` v0.2.0 : section Tests mise à jour — NodeDetails 5 cas + EdgeDetails 5 cas (P2-5)
- `docs/specs/web/snapshot-selector/spec-technique.md` v0.2.0 : section Tests mise à jour (3 cas P2-6) ; section Store — action `loadSnapshots` mise à jour avec logique P2-7 (bascule activeSnapshotId invalide)
- `docs/adr/ADR-021-react-testing-stack.md` : nouvel ADR — stack de test React (@testing-library/react + happy-dom, imports explicites, afterEach cleanup)
- `docs/retro/dette-technique.md` : items M4, m1, m2, m3, m4, m7 marqués RESOLU (Phase 2, PR #2)
- `docs/retro/plan-remediation.md` : P2-1 à P2-8 marqués Livrés (PR #2)
- `docs/specs/api/registry/spec-technique.md` v0.3.0 : nouveau getter `getRteEicSet()` + `getMapConfig()`, pré-calcul `rteEicSet` au boot (P3-3, P3-4) ; mise à jour section Tests (+2 cas)
- `docs/specs/api/ingestion/spec-technique.md` v0.3.0 : `repackageWithoutSensitive` dans `SnapshotPersisterService` (P3-1) ; retrait de `message_type.csv` et `message_upload_route.csv` de `USABLE_CSV_FILES` (P3-7) ; mise à jour section Tests (+2 cas)
- `docs/specs/api/graph/spec-technique.md` v0.3.0 : `ISRECENT_THRESHOLD_MS` env var (P3-2) ; champ `mapConfig` dans `GraphResponse` (P3-4) ; mise à jour section Tests (+2 cas)
- `docs/specs/web/map/spec-technique.md` v0.2.0 : `useMapData` consomme `graph.mapConfig` — constantes `PARIS_LAT/PARIS_LNG/OFFSET_DEG` plus hardcodées (P3-4) ; mise à jour tableau Constantes notables
- `docs/retro/dette-technique.md` : items m5, m8, m11, m12, m13, m14 marqués RESOLU (Phase 3, PR #4)
- `docs/retro/plan-remediation.md` : P3-1, P3-2, P3-3, P3-4, P3-5, P3-7 marqués Livrés (PR #4) ; P3-6 Déféré (dépend auth) ; P3-8 À faire (spec séparée)
