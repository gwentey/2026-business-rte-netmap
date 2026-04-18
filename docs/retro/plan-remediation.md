# Plan de Remédiation — Carto ECP Network Map

> Date : 2026-04-17
> Source : Rétro-ingénierie slice #1 — retro-auditor
> Référence : docs/retro/dette-technique.md

---

## Stratégie

Il n'y a pas de bloquant fonctionnel en dev-local pour le slice #1 : l'application ingère des backups ECP réels et les affiche sur la carte. La priorité de remédiation suit deux axes : (1) corriger les points qui bloqueront la prochaine étape opérationnelle (déploiement Docker, élargissement de l'équipe) ; (2) renforcer la couverture de tests sur les modules frontend qui en sont totalement dépourvus, avant d'y ajouter de nouvelles features. Les dettes de sécurité mineures (zips avec fichiers sensibles, seuil isRecent non configurable) sont traitées en phase 3 car elles n'ont pas d'impact sur la stabilité du système actuel.

---

## Phase 1 — Corrections bloquantes avant déploiement (Sprint 1)

Ces actions doivent être terminées avant tout travail sur le Dockerfile, la CI ou l'élargissement de l'équipe.

| #   | Action                                                                                                   | Feature          | Effort | Prérequis | Réf. dette | Statut |
|-----|----------------------------------------------------------------------------------------------------------|------------------|--------|-----------|------------|--------|
| P1-1 | Câbler ESLint à la racine : ajouter le script `lint` dans `package.json` racine, vérifier que les deux workspaces api et web ont leurs configs ESLint opérationnelles, inclure le scope `test/**` dans le lint api. | Toutes | S | Aucun | M1, M5 | **Livré — commit 4f8ae25** |
| P1-2 | Corriger la résolution de chemin du RegistryService : déplacer le `resolve()` de `REGISTRY_PACKAGE_ROOT` dans `onModuleInit`, lire `process.env.REGISTRY_PATH` avec fallback sur le chemin relatif actuel `../../packages/registry`. | api/registry | XS | Aucun | M2 | **Livré — commit 4f8ae25** |
| P1-3 | Ajouter un script de validation de synchronisation `processColors` : un test Vitest ou un script `check-sync` qui lit `eic-rte-overlay.json` et `process-colors.ts` et lève une erreur si les palettes divergent. | web/map, api/registry | S | P1-1 (lint câblé) | M3 | **Livré — commit 4f8ae25** |
| P1-4 | Corriger le HTTP 500 sur `component_directory.csv` vide : lever une `InvalidUploadException` typée dans `IngestionService` au lieu de laisser remonter une `Error` native. | api/ingestion | XS | Aucun | m6 | **Livré — commit 4f8ae25** |

---

## Phase 2 — Stabilisation tests et comportements (Sprints 2-3)

Ces actions renforcent la fiabilité avant les prochains slices fonctionnels.

| #   | Action                                                                                                                    | Feature              | Effort | Prérequis | Réf. dette | Statut |
|-----|---------------------------------------------------------------------------------------------------------------------------|----------------------|--------|-----------|------------|--------|
| P2-1 | Ajouter des tests unitaires Vitest pour `SnapshotsController` et `SnapshotsService` : cas de rejet upload (MIME invalide, magic bytes, label vide), list avec filtre envName, detail avec 404. | api/snapshots | M | P1-1 | M4, m3 | **Livré — PR #2** |
| P2-2 | Ajouter un test unitaire pour `SnapshotPersisterService` : cas nominal, échec transaction (zip nettoyé), échec cleanup (log warning). | api/ingestion | M | Aucun | m1 | **Livré — PR #2** |
| P2-3 | Ajouter un test d'intégration pour `GET /api/snapshots/:id/graph` : vérifier le mapping Prisma → GraphResponse sur un snapshot réel (réutiliser les fixtures existantes). | api/graph | S | Aucun | m2 | **Livré — PR #2** |
| P2-4 | Ajouter des tests unitaires React (Vitest + @testing-library/react) pour `UploadPage` : soumission formulaire, état loading, affichage erreur API, affichage warnings. | web/upload | M | P1-1 | M4 | **Livré — PR #2** |
| P2-5 | Ajouter des tests unitaires React pour `NodeDetails` et `EdgeDetails` (composants de présentation purs) : rendu des champs null, formatage dates, badge isDefaultPosition. | web/detail-panel | S | P1-1 | M4 | **Livré — PR #2** |
| P2-6 | Ajouter des tests unitaires React pour `SnapshotSelector` : liste vide → lien upload, liste non vide → select avec valeur active, onChange déclenche setActiveSnapshot. | web/snapshot-selector | S | P1-1 | M4 | **Livré — PR #2** |
| P2-7 | Corriger la gestion du cas `activeSnapshotId` persisté invalide dans `loadSnapshots` : si l'id persisté n'est pas dans la liste retournée, basculer automatiquement sur `list[0]` au lieu de laisser `getGraph` échouer silencieusement. | web/snapshot-selector | XS | Aucun | m4 | **Livré — PR #2** |
| P2-8 | Exposer un warning structuré `CSV_PARSE_ERROR` quand un CSV optionnel ne peut pas être parsé, au lieu du seul `logger.warn` serveur. | api/ingestion | S | Aucun | m7 | **Livré — PR #2** |

---

## Phase 3 — Amélioration continue (Sprints 4+)

Ces actions améliorent la maintenabilité à long terme et préparent les slices suivants.

| #   | Action                                                                                                                         | Feature          | Effort | Prérequis       | Réf. dette | Statut |
|-----|--------------------------------------------------------------------------------------------------------------------------------|------------------|--------|-----------------|------------|--------|
| P3-1 | Re-packager le zip archivé en retirant les fichiers sensibles avant écriture sur disque. | api/ingestion | M | P2-2 (tests persister) | m5 | **Livré — PR #4** |
| P3-2 | Rendre le seuil `isRecent` configurable via variable d'environnement `ISRECENT_THRESHOLD_MS`. | api/graph | S | Aucun | m8 | **Livré — PR #4** |
| P3-3 | Pré-calculer le `rteEicSet` dans `RegistryService.onModuleInit()` au lieu de le reconstruire à chaque appel de `build()`. | api/registry, api/ingestion | XS | Aucun | m12 | **Livré — PR #4** |
| P3-4 | Externaliser `PARIS_LAT`, `PARIS_LNG`, `OFFSET_DEG` et le seuil de proximité depuis l'overlay RTE JSON vers le frontend via `mapConfig` dans `GraphResponse`. | web/map | M | Aucun | m13 | **Livré — PR #4** |
| P3-5 | Décider et documenter la stratégie de validation unifiée pour les futurs endpoints NestJS : ADR-022 — standardisation `nestjs-zod`. | api/snapshots, api/* | S | Aucun | m11 | **Livré — PR #4** (ADR-022 commit b6024f6) |
| P3-6 | Implémenter le rechargement à chaud du registry (hot reload) : endpoint `POST /api/registry/reload` avec guard admin. | api/registry | L | Auth (hors scope slice #1) | m9 | **Déféré — dépend de l'auth (hors scope slice #1)** |
| P3-7 | Nettoyer la whitelist `USABLE_CSV_FILES` : retirer `message_type.csv` et `message_upload_route.csv`. | api/ingestion | XS | Aucun | m14 | **Livré — PR #4** |
| P3-8 | Remplacer `leaflet-curve` par une solution `<SVGOverlay>` react-leaflet avec `<path>` SVG natifs, ou surveiller la publication de types officiels. | web/map | L | Aucun | m10 | **À faire — spec séparée** |

---

## Dépendances entre actions

```
P1-1 (lint câblé)
  └─→ P1-3 (check-sync colors, intégré au lint/CI)
  └─→ P2-1 (tests snapshots — lint doit couvrir les specs)
  └─→ P2-4 (tests UploadPage)
  └─→ P2-5 (tests DetailPanel)
  └─→ P2-6 (tests SnapshotSelector)

P1-2 (REGISTRY_PATH env var)
  └─→ débloque travail Dockerfile (hors plan mais prérequis opérationnel)

P2-2 (tests SnapshotPersister)
  └─→ P3-1 (re-packaging zip — modification sécurisée uniquement si tests en place)

P3-6 (hot-reload registry)
  └─→ Auth implémentée (hors scope slice #1 — dépendance externe)
```

---

## Hors scope de ce plan (volontairement déférés)

Les éléments suivants sont explicitement hors scope slice #1 et ne doivent pas être traités dans ce plan :

- Auth / JWT / gestion des rôles
- CI/CD (GitHub Actions ou équivalent)
- Dockerfile et déploiement VM/Nginx RTE
- Export CSV, filtres, recherche, layer toggles
- Diff view entre snapshots
- Historique de renommage / suppression de composants
- Admin registry (hot-reload) — dépend de l'auth
- Re-classification des snapshots existants après mise à jour registry
