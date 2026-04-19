# Discovery — Carto ECP Network Map

> Fichier généré automatiquement par retro-scanner. Usage interne uniquement.
> Ce fichier sera supprimé à la fin de la Phase 1-bis.

---

## Stack identifiée

| Composant        | Valeur                                                                 |
|------------------|------------------------------------------------------------------------|
| Type de projet   | Monorepo pnpm workspaces — 4 packages                                 |
| Node requis      | >= 20.11.0                                                             |
| Gestionnaire     | pnpm >= 9.0.0                                                          |
| **api** framework | NestJS 10.4 + Express (via `@nestjs/platform-express`)               |
| **api** version   | NestJS 10.4                                                           |
| **api** langage   | TypeScript 5.5, compilé en CommonJS                                   |
| **api** SGBD      | SQLite — fichier `apps/api/prisma/dev.db`                             |
| **api** ORM       | Prisma 5.20                                                           |
| **api** Auth      | Aucune (hors scope slice #1)                                          |
| **web** framework | React 18.3 + Vite 5.4                                                |
| **web** langage   | TypeScript 5.5                                                        |
| **web** UI        | Tailwind CSS 3.4 + Radix UI + shadcn/ui + lucide-react                |
| **web** state     | Zustand 4.5 + persist                                                 |
| **web** routing   | React Router DOM 6.26                                                 |
| **web** cartographie | Leaflet 1.9 + react-leaflet 4.2 + leaflet-curve 1.0              |
| Tests unitaires  | Vitest 2.1 (api + web), avec `unplugin-swc` côté api                  |
| Tests E2E        | Playwright 1.48 (web uniquement — 3 smoke tests)                      |
| Linter           | ESLint (non câblé à la racine — `pnpm lint` échoue en l'état)         |
| Formatter        | Prettier 3.3                                                          |
| CI/CD            | Non configuré (dev-local uniquement pour slice #1)                    |
| Docker           | Non configuré (hors scope slice #1)                                   |

---

## Packages du monorepo

| Package             | Root                  | Nature                                                       |
|---------------------|-----------------------|--------------------------------------------------------------|
| `@carto-ecp/api`    | `apps/api`            | Backend NestJS — pipeline d'ingestion + API REST              |
| `@carto-ecp/web`    | `apps/web`            | Frontend React — carte Leaflet + upload + panneau détail      |
| `@carto-ecp/shared` | `packages/shared`     | DTOs TypeScript partagés api/web, aucun build step            |
| `@carto-ecp/registry` | `packages/registry` | Données de référence uniquement (CSV ENTSO-E + overlay JSON)  |

---

## Features identifiées

### 1. api/ingestion — Pipeline ZIP vers graphe persisté

**Description :** Chaine de 5 services NestJS stateless qui transforme un zip de backup ECP (Endpoint ou Component Directory) en données exploitables : extraction du zip, lecture CSV, parsing du blob XML MADES, construction du modèle réseau enrichi via le registry, persistance SQLite + archivage du zip. C'est le chemin critique de l'application.

**Fichiers principaux :**
- `apps/api/src/ingestion/zip-extractor.service.ts`
- `apps/api/src/ingestion/csv-reader.service.ts`
- `apps/api/src/ingestion/xml-mades-parser.service.ts`
- `apps/api/src/ingestion/network-model-builder.service.ts`
- `apps/api/src/ingestion/snapshot-persister.service.ts`
- `apps/api/src/ingestion/types.ts`

---

### 2. api/snapshots — Gestion des snapshots uploadés

**Description :** Module NestJS exposant les endpoints REST pour créer un snapshot (POST multipart avec le zip + label + envName), lister les snapshots existants (avec filtre optionnel sur envName), et récupérer le détail d'un snapshot. Le type de backup (ENDPOINT vs COMPONENT_DIRECTORY) est détecté automatiquement à l'ingestion et stocké.

**Fichiers principaux :**
- `apps/api/src/snapshots/snapshots.controller.ts`
- `apps/api/src/snapshots/snapshots.service.ts`
- `apps/api/src/snapshots/snapshots.module.ts`
- `apps/api/src/snapshots/dto/create-snapshot.dto.ts`

---

### 3. api/graph — Construction et exposition du graphe réseau

**Description :** Service qui agrège les `MessagePath` persistés en Prisma en un graphe nodes/edges prêt à l'affichage. Applique les règles de dédoublonnage (1 edge par paire fromEic/toEic), détermine le process MIXTE si plusieurs processes coexistent sur une même paire, calcule le flag `isRecent` relativement à la date du snapshot (reproductibilité historique). Expose `GET /api/snapshots/:id/graph`.

**Fichiers principaux :**
- `apps/api/src/graph/graph.service.ts`
- `apps/api/src/graph/graph.controller.ts`
- `apps/api/src/graph/graph.module.ts`
- `packages/shared/src/graph.ts`

---

### 4. api/registry — Registry EIC en mémoire

**Description :** Singleton NestJS chargé au démarrage depuis les deux fichiers de référence (`packages/registry/eic-entsoe.csv` ~14 929 codes + `packages/registry/eic-rte-overlay.json`). Expose deux opérations utilisées par NetworkModelBuilder : `resolveComponent` (cascade 4 niveaux pour géocoder un EIC) et `classifyMessageType` (cascade exact → regex → UNKNOWN). Rechargement à chaud hors scope slice #1.

**Fichiers principaux :**
- `apps/api/src/registry/registry.service.ts`
- `apps/api/src/registry/registry.module.ts`
- `apps/api/src/registry/types.ts`
- `packages/registry/eic-rte-overlay.json`
- `packages/registry/eic-entsoe.csv`

---

### 5. api/common — Utilitaires transverses backend

**Description :** Deux utilitaires partagés entre les services d'ingestion : `date-parser.ts` gère deux formats de date coexistants (CSV ISO avec nanosecondes sans Z, XML ISO avec Z et millisecondes) via regex + troncature ; `null-value-normalizer.ts` convertit la chaîne `NULL_VALUE_PLACEHOLDER` en `null` natif. Les erreurs d'ingestion bloquantes sont typées dans `errors/ingestion-errors.ts`.

**Fichiers principaux :**
- `apps/api/src/common/date-parser.ts`
- `apps/api/src/common/null-value-normalizer.ts`
- `apps/api/src/common/errors/ingestion-errors.ts`

---

### 6. web/upload — Page d'upload de snapshot

**Description :** Page React avec drag & drop (react-dropzone) acceptant uniquement les fichiers `.zip` jusqu'à 50 MB. Expose deux champs : label (requis) et envName (texte libre, placeholder OPF/PROD/PFRFI). Après soumission, affiche les warnings retournés par l'API dans un accordéon et propose un bouton "Voir sur la carte" vers la MapPage.

**Fichiers principaux :**
- `apps/web/src/pages/UploadPage.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/store/app-store.ts`

---

### 7. web/map — Carte Leaflet interactive du réseau ECP

**Description :** Page principale de l'application. Affiche un fond OSM avec les composants ECP positionnés géographiquement : nœuds RTE (cercles/losanges rouges, regroupement radial à Paris-La Défense), nœuds externes (cercles colorés par process), edges courbés via `leaflet-curve` colorés par process métier (dashArray si inactif). Clic nœud ou edge ouvre le DetailPanel.

**Fichiers principaux :**
- `apps/web/src/pages/MapPage.tsx`
- `apps/web/src/components/Map/NetworkMap.tsx`
- `apps/web/src/components/Map/NodeMarker.tsx`
- `apps/web/src/components/Map/EdgePath.tsx`
- `apps/web/src/components/Map/useMapData.ts`

---

### 8. web/detail-panel — Panneau de détail nœud/edge

**Description :** Panneau latéral (400 px, collapsible) qui s'affiche au clic sur un nœud ou un edge de la carte. Pour un nœud : displayName, EIC, organisation, pays, networks, URLs, timestamps, process associé, liens IN/OUT. Pour un edge : sens, process, messageTypes, transport pattern, broker intermédiaire, activité (lastMessageUp/Down), validité.

**Fichiers principaux :**
- `apps/web/src/components/DetailPanel/DetailPanel.tsx`
- `apps/web/src/components/DetailPanel/NodeDetails.tsx`
- `apps/web/src/components/DetailPanel/EdgeDetails.tsx`

---

### 9. web/snapshot-selector — Sélecteur de snapshot actif

**Description :** Composant présent dans le header de MapPage permettant de basculer entre les snapshots uploadés. Persiste l'`activeSnapshotId` dans le store Zustand (avec `persist` via localStorage). Le changement de snapshot déclenche le rechargement du graphe.

**Fichiers principaux :**
- `apps/web/src/components/SnapshotSelector/SnapshotSelector.tsx`
- `apps/web/src/store/app-store.ts`

---

### 10. shared/types — DTOs TypeScript partagés api/web

**Description :** Bibliothèque TypeScript pure sans build step exposant les types partagés entre le backend et le frontend : `GraphResponse` (nodes, edges, bounds), `SnapshotSummary`/`SnapshotDetail`, types de registry (`ProcessKey`, `NodeKind`). Consommé directement via `main: ./src/index.ts` dans les deux apps.

**Fichiers principaux :**
- `packages/shared/src/graph.ts`
- `packages/shared/src/snapshot.ts`
- `packages/shared/src/registry.ts`
- `packages/shared/src/index.ts`

---

## Modèle de données Prisma (SQLite)

| Table                | Rôle                                                                          |
|----------------------|-------------------------------------------------------------------------------|
| `Snapshot`           | Métadonnées d'un upload : label, envName, componentType, sourceComponentCode, cdCode, uploadedAt, zipPath, warningsJson |
| `Component`          | Nœud du graphe : eic, type, organization, coordonnées géocodées, displayName, process, sourceType |
| `ComponentUrl`       | URLs AMQPS/HTTPS d'un composant (1 composant → N URLs)                        |
| `MessagePath`        | Chemin de message : receiverEic, senderEicOrWildcard, messageType, transportPattern, direction, process, isExpired |
| `MessagingStatistic` | Activité réelle : connectionStatus, lastMessageUp/Down, sumMessages           |
| `AppProperty`        | Clés de config du backup (clés sensibles filtrées avant insert)               |

---

## API REST exposée

| Méthode | Route                          | Description                                   |
|---------|--------------------------------|-----------------------------------------------|
| POST    | `/api/snapshots`               | Upload d'un zip + label + envName             |
| GET     | `/api/snapshots`               | Liste des snapshots (filtre `?envName=`)       |
| GET     | `/api/snapshots/:id`           | Détail d'un snapshot                          |
| GET     | `/api/snapshots/:id/graph`     | Graphe nodes/edges prêt pour Leaflet          |

---

## Décisions techniques clés

1. **Vertical slice first** — Le slice #1 livre la chaîne complète upload → parse → carte sans auth, pour valider la faisabilité technique du parser MADES contre des backups réels avant d'investir sur les features admin/auth/historique.

2. **SQLite embarqué** — Choix pragmatique pour éviter une demande d'infra PostgreSQL à RTE (délai long). Suffisant pour < 10 utilisateurs concurrents et ~100 snapshots. Migration vers PostgreSQL possible sans refonte du code (abstraction Prisma).

3. **Isolation réseau stricte** — L'application ne se connecte jamais aux ECP réels. Elle parse des backups uploadés manuellement. Contrainte d'isolation réseau RTE non négociable.

4. **Parsing tolérant / erreurs non bloquantes** — Les CSVs invalides ou manquants produisent des warnings stockés dans `warningsJson` sur le Snapshot, mais ne font jamais échouer l'ingestion (sauf fichiers obligatoires manquants ou namespace XML inconnu).

5. **Sécurité des données sensibles** — Trois fichiers CSV (`local_key_store.csv`, `registration_store.csv`, `registration_requests.csv`) ne sont jamais lus en mémoire. Les clés AppProperty sensibles (`password|secret|keystore.password|privateKey|credentials`) sont filtrées avant `createMany`. Le zip est conservé sur disque dans `storage/snapshots/{uuid}.zip` pour re-parsing éventuel.

6. **Registry in-memory boot-time** — Le registry EIC (ENTSO-E CSV + overlay JSON RTE) est chargé une fois au démarrage en mémoire comme singleton NestJS. Le rechargement à chaud est explicitement hors scope slice #1 — toute modification requiert un redémarrage backend.

7. **process résolu à l'ingestion** — La classification `messageType → process métier` est effectuée une fois au parsing et stockée en base. Elle n'est jamais recalculée à l'affichage, garantissant la reproductibilité historique des snapshots.

8. **isRecent relatif au snapshot** — L'activité d'un edge (`isRecent = lastMessageUp < 24h`) est calculée relativement à `uploadedAt` du snapshot, pas à `Date.now()`. Un snapshot historique reste donc interprétable tel quel.

9. **Monorepo ESM/CommonJS hybride** — La racine a `"type": "module"` mais `apps/api` surcharge en `"type": "commonjs"` pour satisfaire NestJS 10 avec `@nestjs/cli`. Ne pas tenter de migrer l'API en ESM.

10. **`noUncheckedIndexedAccess: true`** dans `tsconfig.base.json` — Tout accès tableau retourne `T | undefined`. Règle stricte qui impose des guards dans le code source et le cast `array[i]!` dans les tests.

---

## Évaluation qualité globale

| Critère               | État                                                                                             |
|-----------------------|--------------------------------------------------------------------------------------------------|
| Tests présents        | Oui — 10 fichiers `.spec.ts` unitaires + 2 tests d'intégration full-pipeline + 3 smoke Playwright |
| Couverture visée      | >= 90 % sur `ingestion/` et `registry/`, >= 70 % sur les autres services backend                 |
| Structure             | Organisée par feature (ingestion, graph, registry, snapshots) — conforme architecture NestJS modules |
| Gestion d'erreurs     | Hybride : erreurs bloquantes typées (`IngestionErrors`) + philosophie tolérante sur CSV invalides via warnings |
| Documentation         | Complète — CLAUDE.md, spec design v1.1, doc fonctionnel v1.2, stack doc, ADR, plans              |
| Fixtures de test      | Deux backups réels gitignorés partiellement (fichiers sensibles exclus) + fixtures synthétiques  |
| Friction identifiée   | `pnpm lint` non câblé à la racine ; `RegistryService` résout via `process.cwd()` (fragile en Docker) ; `leaflet-curve` sans types TS (stub manuel) |
| CI/CD                 | Absent — dev-local uniquement pour slice #1                                                      |
| Auth                  | Absente — explicitement hors scope slice #1, prévue en slice ultérieur (JWT + 3 rôles)           |
| Déploiement           | Non configuré — Dockerfile et Nginx RTE reportés à un slice ultérieur                            |
