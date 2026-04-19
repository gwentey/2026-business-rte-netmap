# Dette Technique — Carto ECP Network Map

> Classement par criticité : CRITIQUE > MAJEUR > MINEUR
> Date d'inventaire : 2026-04-17
> Source : Rétro-ingénierie slice #1 — retro-auditor

---

## CRITIQUE — À corriger immédiatement

Aucune dette critique identifiée. Le projet est fonctionnel en dev-local pour le périmètre slice #1.

---

## MAJEUR — À planifier dans les 2 prochains sprints

| #  | Description                                                                                     | Feature          | Fichier(s) concerné(s)                                                                 | Impact                                                                                          |
|----|-------------------------------------------------------------------------------------------------|------------------|----------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| M1 | `pnpm lint` échoue à la racine — ESLint non câblé. Les specs `.spec.ts` sont hors lint.        | Toutes           | `package.json` (racine), `apps/api/eslint.config.*`, `apps/web/eslint.config.*`        | Aucune détection automatique des erreurs de style, d'imports morts ou de patterns dangereux. La CI future ne peut pas inclure de gate lint. **[RESOLU — Phase 1, commit 4f8ae25]** |
| M2 | `RegistryService` résout `packages/registry/` via `process.cwd()` — fragile Docker.            | api/registry     | `apps/api/src/registry/registry.service.ts` (constante `REGISTRY_PACKAGE_ROOT`)        | Le backend ne démarre pas si le WORKDIR du conteneur diffère de `apps/api/`. Bloque tout déploiement Docker sans modification préalable. **[RESOLU — Phase 1, commit 4f8ae25]** |
| M3 | Palette `processColors` dupliquée sans synchronisation automatique entre JSON et TS.             | web/map          | `packages/registry/eic-rte-overlay.json`, `apps/web/src/lib/process-colors.ts`         | L'ajout d'un process dans l'overlay sans mise à jour du fichier TS produit un rendu gris UNKNOWN sur la carte, sans erreur compilation ni runtime. **[RESOLU — Phase 1, commit 4f8ae25]** |
| M4 | Zéro test unitaire sur les composants React — upload, map, detail-panel, snapshot-selector.    | web/*            | `apps/web/src/pages/UploadPage.tsx`, `apps/web/src/components/Map/*`, `apps/web/src/components/DetailPanel/*`, `apps/web/src/components/SnapshotSelector/*` | Les régressions sur les composants UI ne sont détectées que manuellement ou par les smoke E2E, qui ne couvrent pas les états d'erreur ni le rendu conditionnel. **[RESOLU — Phase 2, PR #2]** (upload, detail-panel, snapshot-selector couverts ; web/map hors scope Phase 2) |
| M5 | `apps/api/test/` exclu du lint (`tsconfig.build.json` exclut `test/**`) mais ce scope n'est pas inclus dans un lint dédié aux tests. | api/ingestion, api/graph | `apps/api/tsconfig.build.json`, `apps/api/vitest.config.ts` | Les specs backend peuvent contenir des patterns incorrects (ex. accès tableau sans guard avec `!`) sans détection automatique. **[RESOLU — Phase 1, commit 4f8ae25]** |

---

## MINEUR — À traiter en opportunité

| #  | Description                                                                                               | Feature              | Fichier(s) concerné(s)                                                                 | Impact                                                                                                     |
|----|-----------------------------------------------------------------------------------------------------------|----------------------|----------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| m1 | `snapshot-persister.service.ts` sans test unitaire dédié.                                                | api/ingestion        | `apps/api/src/ingestion/snapshot-persister.service.ts`                                | Les chemins d'erreur (échec transaction Prisma + cleanup zip orphelin) ne sont vérifiés qu'indirectement via les tests d'intégration full-pipeline. **[RESOLU — Phase 2, PR #2]** |
| m2 | Endpoint `GET /api/snapshots/:id/graph` sans test d'intégration.                                         | api/graph            | `apps/api/src/graph/graph.service.ts`, `apps/api/src/graph/graph.controller.ts`        | Le mapping Prisma → GraphResponse n'est pas vérifié contre la BDD réelle. Un bug de mapping ne serait détecté qu'en E2E. **[RESOLU — Phase 2, PR #2]** |
| m3 | `SnapshotsController` et `SnapshotsService` sans tests unitaires.                                        | api/snapshots        | `apps/api/src/snapshots/snapshots.controller.ts`, `apps/api/src/snapshots/snapshots.service.ts` | Les cas de rejet upload (MIME invalide, magic bytes erronés, label vide) ne sont pas testés unitairement. **[RESOLU — Phase 2, PR #2]** |
| m4 | `activeSnapshotId` persisté en localStorage peut pointer un snapshot supprimé — aucune gestion de ce cas dans `loadSnapshots`. | web/snapshot-selector | `apps/web/src/store/app-store.ts` (action `loadSnapshots`)                             | Au boot, l'appel `getGraph` échoue silencieusement. L'UI affiche un état d'erreur sans proposer de bascule automatique vers le dernier snapshot valide. **[RESOLU — Phase 2, PR #2]** |
| m5 | Zips archivés (`storage/snapshots/*.zip`) contiennent les fichiers sensibles ECP sur disque.             | api/ingestion        | `apps/api/src/ingestion/snapshot-persister.service.ts`                                | Un accès physique au répertoire `storage/` expose les clés privées et inventaires ECP. Aucun re-packaging du zip avant archivage. **[RESOLU — Phase 3, PR #4]** |
| m6 | `component_directory.csv` vide lève une `Error` native (HTTP 500) au lieu d'une `InvalidUploadException` (HTTP 400). | api/ingestion | `apps/api/src/ingestion/ingestion.service.ts`                                          | L'utilisateur reçoit une erreur 500 opaque sur un backup vide ou tronqué, sans code métier exploitable côté frontend. **[RESOLU — Phase 1, commit 4f8ae25]** |
| m7 | Les erreurs de parsing de CSVs optionnels (`message_path.csv` mal encodé, etc.) produisent un `logger.warn` serveur sans warning structuré retourné à l'API. | api/ingestion | `apps/api/src/ingestion/csv-reader.service.ts`                                         | L'utilisateur ne sait pas que ses chemins de messages ont été ignorés lors de l'ingestion. **[RESOLU — Phase 2, PR #2]** |
| m8 | Seuil `isRecent = 24h` hardcodé dans `GraphService.buildGraph`, non configurable et non différencié par process. | api/graph | `apps/api/src/graph/graph.service.ts`                                                  | Impossible d'ajuster le seuil sans modifier le code. Les processus basse fréquence (UK-CC-IN, TP) apparaissent systématiquement inactifs si leur cadence est supérieure à 24h. **[RESOLU — Phase 3, PR #4]** |
| m9 | Hot-reload registry reporté — toute modification de `eic-rte-overlay.json` ou `eic-entsoe.csv` requiert un redémarrage backend. | api/registry | `apps/api/src/registry/registry.service.ts`                                            | Friction opérationnelle si le registry est mis à jour entre deux ingestions sur un serveur sans capacité de redémarrage facile. |
| m10| `leaflet-curve` sans types TypeScript — cast `(L as unknown as { curve: ... })` fragile à la compilation. | web/map | `apps/web/src/components/Map/EdgePath.tsx`, `apps/web/src/env.d.ts`                    | Si l'API de `leaflet-curve` change, l'erreur sera silencieuse à la compilation et visible seulement au runtime (carte sans courbes). **[RESOLU — Phase 4, PR #5]** `leaflet-curve` retiré ; `EdgePath` réécrit avec `<Polyline>` + `sampleBezier`. |
| m11| Stratégie de validation mixte : Zod manuel dans `SnapshotsController` vs convention NestJS `ValidationPipe`. | api/snapshots | `apps/api/src/snapshots/snapshots.controller.ts`, `apps/api/src/snapshots/dto/create-snapshot.dto.ts` | Incohérence si d'autres endpoints sont ajoutés avec `ValidationPipe` + `class-validator`. Les paramètres `:id` et `?envName` ne passent pas par de pipe NestJS. **[RESOLU — Phase 3, PR #4]** (décision documentée dans ADR-022 : standardisation `nestjs-zod`) |
| m12| `rteEicSet` reconstruit à chaque appel de `NetworkModelBuilderService.build()` (boucle sur overlay).    | api/registry, api/ingestion | `apps/api/src/ingestion/network-model-builder.service.ts`                              | Négligeable aux volumes actuels (6 endpoints). Deviendra un hotspot si le nombre d'ingestions simultanées augmente ou si l'overlay grossit. **[RESOLU — Phase 3, PR #4]** |
| m13| Constante `PARIS_LAT/PARIS_LNG/OFFSET_DEG` hardcodée dans `useMapData.ts` — non synchronisée avec l'overlay JSON. | web/map | `apps/web/src/components/Map/useMapData.ts`                                            | Si RTE change de coordonnées dans l'overlay, le hook de dispersion radiale ne détectera plus le groupe automatiquement. **[RESOLU — Phase 3, PR #4]** |
| m14| `message_type.csv` et `message_upload_route.csv` dans la whitelist `USABLE_CSV_FILES` mais aucun service lecteur associé. | api/ingestion | `apps/api/src/ingestion/types.ts`                                                      | Ces fichiers sont lus en mémoire (extraction zip) sans être parsés ni persistés — charge mémoire inutile et whitelist trompeuse. **[RESOLU — Phase 3, PR #4]** |

---

## Métriques globales

| Indicateur                       | Valeur                                                    |
|----------------------------------|-----------------------------------------------------------|
| Dette CRITIQUE                   | 0 item                                                    |
| Dette MAJEUR                     | 5 items                                                   |
| Dette MINEUR                     | 14 items                                                  |
| Couverture tests backend estimée | >= 80 % sur `ingestion/` et `registry/` (unitaires + intégration) ; ~40 % sur `graph/` et `snapshots/` (intégration uniquement) |
| Couverture tests frontend estimée | ~15 % (smoke E2E uniquement, zéro unitaire)              |
| Features sans test unitaire dédié | 5 (api/snapshots, web/upload, web/map, web/detail-panel, web/snapshot-selector) |
| ADRs avec recommandation de reconsidération | 6 (RETRO-002, RETRO-006, RETRO-008, RETRO-013, RETRO-015, RETRO-016) |
| Lint fonctionnel                 | Non — `pnpm lint` échoue à la racine                     |
| CI/CD configurée                 | Non                                                       |
| Auth implémentée                 | Non (hors scope slice #1)                                 |
