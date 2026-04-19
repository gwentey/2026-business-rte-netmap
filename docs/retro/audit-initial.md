# Audit Initial — Carto ECP Network Map

| Champ             | Valeur                              |
|-------------------|-------------------------------------|
| Date              | 2026-04-17                          |
| Auditeur          | retro-auditor (Zelian Framework)    |
| Source            | Rétro-ingénierie — slice #1         |
| Features auditées | 10 (5 api + 4 web + 1 shared)       |
| ADRs identifiés   | 19                                  |

---

## Résumé exécutif

Le projet Carto ECP Network Map est un monorepo pnpm en bonne santé structurelle pour un slice #1 : le pipeline d'ingestion (chemin critique) est solide, documenté et couvert par des tests d'intégration sur des backups réels. Les décisions architecturales majeures (parsing tolérant, registry in-memory, isRecent relatif au snapshot, isolation réseau stricte) sont pertinentes et documentées par 19 ADRs. La dette technique identifiée est concentrée sur des sujets de livraison opérationnelle (lint non câblé, résolution de chemin fragile, absence de CI/CD) et de couverture de tests (modules frontend sans spec unitaire). Aucun bloquant fonctionnel n'est détecté pour le développement local slice #1 ; les risques deviennent critiques dès que l'équipe voudra déployer sur Docker ou élargir l'équipe de développement.

---

## Stack et architecture

| Composant            | Valeur                                                             |
|----------------------|--------------------------------------------------------------------|
| Type de projet       | Monorepo pnpm workspaces — 4 packages                             |
| Node requis          | >= 20.11.0 / pnpm >= 9.0.0                                        |
| Backend              | NestJS 10.4 + Express, TypeScript 5.5, SQLite via Prisma 5.20     |
| Frontend             | React 18.3 + Vite 5.4, TypeScript 5.5, Leaflet 1.9               |
| UI                   | Tailwind CSS 3.4 + Radix UI + shadcn/ui                           |
| State management     | Zustand 4.5 + persist (localStorage)                              |
| Routing frontend     | React Router DOM 6.26                                             |
| Tests unitaires      | Vitest 2.1 (api + web), unplugin-swc côté api                     |
| Tests E2E            | Playwright 1.48 — 3 smoke tests (web uniquement)                  |
| Linter               | ESLint (non câblé à la racine)                                    |
| Formatter            | Prettier 3.3                                                      |
| CI/CD                | Absent (dev-local slice #1)                                       |
| Auth                 | Absente (hors scope slice #1)                                     |

**Patterns architecturaux identifiés :**

- Pipeline stateless 5 services (ZipExtractor → CsvReader → XmlMadesParser → NetworkModelBuilder → SnapshotPersister) orchestré par IngestionService
- Registry EIC singleton global in-memory (14 929 codes ENTSO-E + overlay JSON RTE)
- Parsing tolérant : erreurs bloquantes typées (`IngestionError`) + warnings non bloquants accumulés
- Thin Controller / Service pattern côté API
- Container/Presentational pattern côté frontend
- Store Zustand centralisé avec persist partiel (seul `activeSnapshotId` en localStorage)
- Package shared TypeScript-only sans build step (Vite et SWC résolvent le TS source directement)
- Monorepo ESM/CommonJS hybride : root `"type": "module"`, api override en `"type": "commonjs"`

---

## Cartographie fonctionnelle

| #  | Feature               | État        | Complexité | Tests unitaires | Tests intégration/E2E | Spec                              |
|----|-----------------------|-------------|------------|-----------------|----------------------|-----------------------------------|
| 1  | api/ingestion         | Fonctionnel | Haute      | Oui (4 fichiers)| Oui (2 full-pipeline)| docs/specs/api/ingestion/         |
| 2  | api/snapshots         | Fonctionnel | Moyenne    | Non (0 fichier) | Oui (via intégration)| docs/specs/api/snapshots/         |
| 3  | api/graph             | Fonctionnel | Moyenne    | Oui (1 fichier) | Non                  | docs/specs/api/graph/             |
| 4  | api/registry          | Fonctionnel | Moyenne    | Oui (1 fichier) | Non (les tests registry utilisent les vrais fichiers) | docs/specs/api/registry/ |
| 5  | api/common            | Fonctionnel | Faible     | Oui (2 fichiers)| N/A                  | docs/specs/api/common/            |
| 6  | web/upload            | Fonctionnel | Faible     | Non             | Oui (1 Playwright)   | docs/specs/web/upload/            |
| 7  | web/map               | Fonctionnel | Haute      | Non             | Oui (smoke partiel)  | docs/specs/web/map/               |
| 8  | web/detail-panel      | Fonctionnel | Faible     | Non             | Non                  | docs/specs/web/detail-panel/      |
| 9  | web/snapshot-selector | Fonctionnel | Faible     | Non             | Partiel (via upload) | docs/specs/web/snapshot-selector/ |
| 10 | shared/types          | Fonctionnel | Faible     | N/A (types only)| N/A                  | docs/specs/shared/types/          |

---

## Points forts

1. **Pipeline d'ingestion robuste et bien testé.** Les 5 services stateless sont testés unitairement et les deux tests d'intégration full-pipeline s'exécutent contre de vrais backups ECP — les cas réels (Endpoint et Component Directory) sont couverts.

2. **Modèle de sécurité cohérent.** Double mécanisme d'exclusion des données sensibles (whitelist fichiers zip + filtre regex AppProperty), validation upload en 3 couches (MIME / magic bytes / Zod), fichiers sensibles gitignorés. La philosophie est défense en profondeur.

3. **Décisions architecturales documentées et traçables.** 19 ADRs couvrent toutes les décisions non triviales. CLAUDE.md liste explicitement les friction points connus. Le code est conforme aux décisions documentées.

4. **Reproductibilité historique garantie par le modèle de données.** La classification `messageType → process` et le calcul `isRecent` relatif à `uploadedAt` (pas à `Date.now()`) sont résolus à l'ingestion et stockés en base — un snapshot historique reste interprétable tel quel indépendamment des évolutions du registry.

5. **Monorepo bien structuré.** Séparation claire api/web/shared/registry. Le package `shared` TypeScript-only sans build est idiomatique pour ce contexte Vite/SWC et élimine toute désynchronisation `dist/`. Le `tsconfig.base.json` avec `noUncheckedIndexedAccess: true` impose une discipline typée rigoureuse.

6. **Parsing tolérant adapté au cas d'usage.** Le choix de ne pas bloquer l'ingestion sur des EIC inconnus ou des messageTypes non classifiés (warnings accumulés) est cohérent avec la nature hétérogène des backups ECP de production réels.

---

## Risques identifiés

| #  | Risque                                              | Criticité | Impact                                                     | Feature(s)      |
|----|-----------------------------------------------------|-----------|------------------------------------------------------------|-----------------|
| R1 | `pnpm lint` non câblé à la racine — ESLint ne s'exécute pas | MAJEUR | Dette de qualité invisible ; les tests spec sont hors du lint | Toutes |
| R2 | `process.cwd()` dans RegistryService — fragile Docker | MAJEUR | Le backend ne démarre pas si WORKDIR Docker diffère de `apps/api/` | api/registry    |
| R3 | Duplication palette `processColors` JSON/TS sans guard automatisé | MAJEUR | Désynchronisation silencieuse : couleurs incorrectes sur la carte sans erreur | web/map, api/registry |
| R4 | Zéro test unitaire frontend (upload, map, detail-panel, snapshot-selector) | MAJEUR | Régressions invisibles sur les composants UI les plus utilisés | web/* |
| R5 | `snapshot-persister.service` sans test unitaire | MINEUR | Les chemins d'erreur (échec transaction + nettoyage zip) ne sont pas testés isolément | api/ingestion |
| R6 | Endpoint `GET /api/snapshots/:id/graph` sans test d'intégration | MINEUR | Le mapping Prisma → GraphResponse n'est pas vérifié contre la BDD réelle | api/graph |
| R7 | `activeSnapshotId` persisté pointant un snapshot supprimé → erreur silencieuse au boot | MINEUR | L'utilisateur voit l'application chargée mais le graphe ne s'affiche pas | web/snapshot-selector |
| R8 | Zips archivés contiennent les fichiers sensibles sur disque | MINEUR | Accès physique au serveur expose les clés privées ECP | api/ingestion |
| R9 | `component_directory.csv` à zéro ligne lève HTTP 500 au lieu de 400 | MINEUR | Message d'erreur opaque pour l'utilisateur sur un backup vide | api/ingestion |
| R10| Seuil `isRecent` 24h non configurable et non différencié par process | MINEUR | Impossible d'ajuster sans modification de code si le métier identifie des processus basse fréquence | api/graph |
| R11| Hot-reload registry reporté — tout changement overlay requiert un redémarrage | MINEUR | Friction opérationnelle si le registry est mis à jour fréquemment | api/registry |
| R12| `leaflet-curve` sans types TS — cast `as unknown` fragile | MINEUR | Régression silencieuse à la compilation si l'API leaflet-curve change | web/map |

---

## Recommandations stratégiques

1. **Câbler ESLint à la racine avant d'élargir l'équipe.** Le lint non fonctionnel signifie que toute la base de code est hors contrôle qualité automatisé. C'est le premier chantier à traiter, indépendamment de toute feature.

2. **Corriger la résolution de chemin du RegistryService avant tout travail sur le Dockerfile.** L'introduction d'une variable d'environnement `REGISTRY_PATH` avec fallback sur le chemin relatif actuel est une modification chirurgicale (< 5 lignes) qui débloquerait l'ensemble du chantier déploiement.

3. **Introduire au moins un test unitaire Vitest par composant React critique** (UploadPage, NetworkMap, DetailPanel). Les smoke tests Playwright couvrent le flux nominal mais ne détectent pas les régressions de rendu conditionnel ni les états d'erreur.
