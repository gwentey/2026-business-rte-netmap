# Carto ECP Network Map — Slice #1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un vertical slice fonctionnel upload d'un backup ECP (Endpoint ou Component Directory) → parsing → persistance SQLite → affichage carte Leaflet avec nœuds géolocalisés et liens colorés par process métier. Pas d'auth, dev local uniquement.

**Architecture:** Monorepo pnpm workspaces (`apps/api` NestJS + `apps/web` React/Vite + `packages/shared` types + `packages/registry` données ENTSO-E). Pipeline d'ingestion stateless découplé (ZipExtractor → CsvReader → XmlMadesParser → NetworkModelBuilder → SnapshotPersister) qui accepte les 2 types de backup via détection automatique du `componentType`. Registry EIC chargé en mémoire au boot (CSV ENTSO-E + overlay JSON RTE custom). Front minimaliste : UploadPage + MapPage avec React-Leaflet, leaflet-curve, zustand, shadcn/ui.

**Tech Stack:** Node 20 LTS, pnpm, TypeScript 5, NestJS 10, Prisma 5, SQLite, Zod, adm-zip, csv-parse/sync, fast-xml-parser, nestjs-pino, Helmet, @nestjs/throttler, React 18, Vite 5, Tailwind CSS, shadcn/ui, Radix, React Router v6, zustand, React-Leaflet v4, leaflet-curve, Vitest, Supertest, Playwright.

**Spec source:** `docs/superpowers/specs/2026-04-18-carto-ecp-slice-1-design.md` (v1.1, commit `7418570`).

---

## File Structure Overview

Le plan crée les fichiers suivants. Chaque fichier a une responsabilité claire et bornée.

### Monorepo root

| Fichier | Rôle |
| :---- | :---- |
| `package.json` | scripts top-level (dev, test, build, lint) |
| `pnpm-workspace.yaml` | déclare `apps/*` et `packages/*` comme workspaces |
| `tsconfig.base.json` | config TS partagée (strict, paths) |
| `.eslintrc.cjs` | ESLint flat ou legacy, règles uniformes |
| `.prettierrc` | format code |
| `.gitignore` | déjà présent (commit `d2fc800`) |
| `README.md` | doc d'usage développeur |

### `apps/api/` — NestJS backend

| Fichier | Rôle |
| :---- | :---- |
| `src/main.ts` | bootstrap NestJS + Helmet + CORS + pino |
| `src/app.module.ts` | imports des modules |
| `src/prisma/prisma.service.ts` | wrapper PrismaClient avec lifecycle hooks |
| `src/prisma/schema.prisma` | modèle DB (Snapshot, Component, ComponentUrl, MessagePath, MessagingStatistic, AppProperty) |
| `src/common/null-value-normalizer.ts` | `normalizeNull(v)` : `NULL_VALUE_PLACEHOLDER` → `null` |
| `src/common/date-parser.ts` | parse ISO nano (CSV) et ISO Z ms (XML) → `Date` |
| `src/common/errors/ingestion-errors.ts` | classes d'exceptions typées |
| `src/registry/registry.service.ts` | lookup EIC + classifier messageType, chargement au boot |
| `src/registry/registry.module.ts` | module Nest |
| `src/registry/types.ts` | types internes registry |
| `src/ingestion/types.ts` | DTOs intermédiaires du pipeline |
| `src/ingestion/zip-extractor.service.ts` | extrait le zip, whitelist fichiers |
| `src/ingestion/csv-reader.service.ts` | parse les CSV via `csv-parse/sync` |
| `src/ingestion/xml-mades-parser.service.ts` | parse le XML MADES |
| `src/ingestion/network-model-builder.service.ts` | construit `NetworkSnapshot` avec enrich registry + classify + direction |
| `src/ingestion/snapshot-persister.service.ts` | transaction Prisma + archive zip |
| `src/ingestion/ingestion.module.ts` | module Nest |
| `src/snapshots/snapshots.controller.ts` | POST /api/snapshots, GET, GET /:id |
| `src/snapshots/snapshots.service.ts` | orchestration upload + lectures |
| `src/snapshots/dto/create-snapshot.dto.ts` | Zod schema du form |
| `src/snapshots/snapshots.module.ts` | module Nest |
| `src/graph/graph.service.ts` | construit `GraphResponse` (nœuds + edges agrégés) |
| `src/graph/graph.controller.ts` | GET /api/snapshots/:id/graph |
| `src/graph/graph.module.ts` | module Nest |
| `test/fixtures-loader.ts` | helper pour reconstruire un zip depuis `tests/fixtures/` |

### `apps/web/` — React frontend

| Fichier | Rôle |
| :---- | :---- |
| `src/main.tsx` | bootstrap React + router + zustand |
| `src/App.tsx` | routes globales |
| `src/lib/api.ts` | fetch wrapper typé |
| `src/lib/process-colors.ts` | mapping process → couleur (hydraté depuis overlay via API registry ou dupliqué côté front) |
| `src/lib/format.ts` | helpers dates `dd/MM/yyyy HH:mm` |
| `src/store/app-store.ts` | zustand avec persist |
| `src/pages/UploadPage.tsx` | dropzone + form |
| `src/pages/MapPage.tsx` | layout header/map/footer/panel |
| `src/components/Map/NetworkMap.tsx` | `MapContainer` + bounds |
| `src/components/Map/NodeMarker.tsx` | rendu des nœuds par `kind` |
| `src/components/Map/EdgePath.tsx` | rendu des edges courbés |
| `src/components/Map/useMapData.ts` | offset radial Paris + bounds |
| `src/components/DetailPanel/DetailPanel.tsx` | panneau contextuel |
| `src/components/DetailPanel/NodeDetails.tsx` | fiche nœud |
| `src/components/DetailPanel/EdgeDetails.tsx` | fiche edge |
| `src/components/SnapshotSelector/SnapshotSelector.tsx` | picker snapshot actif |
| `src/components/ui/*.tsx` | composants shadcn/ui générés (button, card, sheet, etc.) |
| `src/styles/globals.css` | Tailwind directives + reset |

### `packages/shared/` — types TS partagés api ↔ web

| Fichier | Rôle |
| :---- | :---- |
| `src/index.ts` | re-exports |
| `src/graph.ts` | `Node`, `Edge`, `GraphResponse`, `NodeKind`, `EdgeDirection`, `ProcessKey` |
| `src/snapshot.ts` | `SnapshotSummary`, `SnapshotDetail`, `ComponentType`, `Warning` |
| `src/registry.ts` | `ProcessKey` union, `processColors` type |

### `packages/registry/` — données de référence (no code)

| Fichier | Rôle |
| :---- | :---- |
| `eic-entsoe.csv` | copie de `tests/fixtures/X_eicCodes.csv` |
| `eic-rte-overlay.json` | overlay RTE (voir spec §7.2) |
| `README.md` | doc de format + comment maintenir |

### Tests

| Fichier | Rôle |
| :---- | :---- |
| `apps/api/src/common/null-value-normalizer.spec.ts` | unit |
| `apps/api/src/common/date-parser.spec.ts` | unit |
| `apps/api/src/registry/registry.service.spec.ts` | unit |
| `apps/api/src/ingestion/zip-extractor.service.spec.ts` | unit |
| `apps/api/src/ingestion/csv-reader.service.spec.ts` | unit |
| `apps/api/src/ingestion/xml-mades-parser.service.spec.ts` | unit |
| `apps/api/src/ingestion/network-model-builder.service.spec.ts` | unit |
| `apps/api/src/graph/graph.service.spec.ts` | unit |
| `apps/api/test/full-ingestion-endpoint.spec.ts` | intégration Supertest |
| `apps/api/test/full-ingestion-cd.spec.ts` | intégration Supertest |
| `apps/web/e2e/upload-to-map.spec.ts` | Playwright smoke |
| `apps/web/e2e/select-node.spec.ts` | Playwright smoke |
| `apps/web/e2e/snapshot-switch.spec.ts` | Playwright smoke |

---

## Convention d'exécution

- Chaque task démarre par **écrire le test qui doit échouer**, puis le minimum de code pour le faire passer.
- Commits fréquents : en fin de chaque task.
- Les commandes `pnpm` s'exécutent à la racine du monorepo sauf mention contraire.
- Les commits utilisent `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` en trailer.
- Quand le plan demande "run test, expected PASS", si le test échoue, ne pas poursuivre — diagnostiquer.

---

## Phase A — Scaffolding du monorepo

### Task 1: Initialiser le monorepo pnpm workspaces

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.prettierrc`
- Create: `.editorconfig`

- [ ] **Step 1: Créer `package.json` racine**

```json
{
  "name": "carto-ecp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.11.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "dev": "pnpm -r --parallel --filter \"./apps/**\" dev",
    "dev:api": "pnpm --filter @carto-ecp/api dev",
    "dev:web": "pnpm --filter @carto-ecp/web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter @carto-ecp/web test:e2e",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\""
  },
  "devDependencies": {
    "prettier": "^3.3.3",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: Créer `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Créer `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "dist", "build"]
}
```

- [ ] **Step 4: Créer `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

- [ ] **Step 5: Créer `.editorconfig`**

```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 6: Installer les dev deps racine**

Run: `pnpm install`
Expected: `Done in Xs. pnpm-lock.yaml created.`

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .prettierrc .editorconfig pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore: init monorepo pnpm workspaces (Task 1)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Scaffold `packages/shared` (types TS partagés)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/registry.ts`
- Create: `packages/shared/src/graph.ts`
- Create: `packages/shared/src/snapshot.ts`

- [ ] **Step 1: Créer `packages/shared/package.json`**

```json
{
  "name": "@carto-ecp/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: Créer `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Créer `packages/shared/src/registry.ts`**

```ts
export const PROCESS_KEYS = [
  'TP',
  'UK-CC-IN',
  'CORE',
  'MARI',
  'PICASSO',
  'VP',
  'MIXTE',
  'UNKNOWN',
] as const;

export type ProcessKey = (typeof PROCESS_KEYS)[number];

export type ProcessColorMap = Record<ProcessKey, string>;
```

- [ ] **Step 4: Créer `packages/shared/src/snapshot.ts`**

```ts
export type ComponentType = 'ENDPOINT' | 'COMPONENT_DIRECTORY';

export type Warning = {
  code: string;
  message: string;
  context?: Record<string, unknown>;
};

export type SnapshotSummary = {
  id: string;
  label: string;
  envName: string;
  componentType: ComponentType;
  sourceComponentCode: string;
  cdCode: string | null;
  uploadedAt: string;
  warningCount: number;
};

export type SnapshotDetail = SnapshotSummary & {
  organization: string | null;
  stats: {
    componentsCount: number;
    pathsCount: number;
    statsCount: number;
  };
  warnings: Warning[];
};
```

- [ ] **Step 5: Créer `packages/shared/src/graph.ts`**

```ts
import type { ProcessKey } from './registry.js';

export type NodeKind =
  | 'RTE_ENDPOINT'
  | 'RTE_CD'
  | 'BROKER'
  | 'EXTERNAL_CD'
  | 'EXTERNAL_ENDPOINT';

export type EdgeDirection = 'IN' | 'OUT';

export type GraphNode = {
  id: string;
  eic: string;
  kind: NodeKind;
  displayName: string;
  organization: string;
  country: string | null;
  lat: number;
  lng: number;
  isDefaultPosition: boolean;
  networks: string[];
  process: ProcessKey | null;
  urls: { network: string; url: string }[];
  creationTs: string;
  modificationTs: string;
};

export type GraphEdge = {
  id: string;
  fromEic: string;
  toEic: string;
  direction: EdgeDirection;
  process: ProcessKey;
  messageTypes: string[];
  transportPatterns: ('DIRECT' | 'INDIRECT')[];
  intermediateBrokerEic: string | null;
  activity: {
    connectionStatus: string | null;
    lastMessageUp: string | null;
    lastMessageDown: string | null;
    isRecent: boolean;
  };
  validFrom: string;
  validTo: string | null;
};

export type GraphBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type GraphResponse = {
  bounds: GraphBounds;
  nodes: GraphNode[];
  edges: GraphEdge[];
};
```

- [ ] **Step 6: Créer `packages/shared/src/index.ts`**

```ts
export * from './registry.js';
export * from './snapshot.js';
export * from './graph.js';
```

- [ ] **Step 7: Vérifier le typecheck**

Run: `pnpm --filter @carto-ecp/shared typecheck`
Expected: `Done` (zéro erreur TS)

- [ ] **Step 8: Commit**

```bash
git add packages/shared
git commit -m "$(cat <<'EOF'
feat(shared): types TS partagés api/web (Task 2)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Scaffold `packages/registry` (données ENTSO-E + overlay)

**Files:**
- Create: `packages/registry/package.json`
- Create: `packages/registry/eic-entsoe.csv` (copie)
- Create: `packages/registry/eic-rte-overlay.json`
- Create: `packages/registry/README.md`

- [ ] **Step 1: Créer `packages/registry/package.json`**

```json
{
  "name": "@carto-ecp/registry",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "files": ["eic-entsoe.csv", "eic-rte-overlay.json"]
}
```

- [ ] **Step 2: Copier le CSV ENTSO-E depuis les fixtures**

Run: `cp tests/fixtures/X_eicCodes.csv packages/registry/eic-entsoe.csv`
Expected: fichier copié, ~14929 lignes.

Vérifier:
Run: `wc -l packages/registry/eic-entsoe.csv`
Expected: `14929 packages/registry/eic-entsoe.csv`

- [ ] **Step 3: Créer `packages/registry/eic-rte-overlay.json`**

```json
{
  "version": "2026-04-18",
  "rteEndpoints": [
    {
      "eic": "17V000000498771C",
      "code": "ECP-INTERNET-2",
      "displayName": "INTERNET-2",
      "process": "UK-CC-IN",
      "lat": 48.8918,
      "lng": 2.2378,
      "city": "Paris - La Défense"
    }
  ],
  "rteComponentDirectory": {
    "eic": "17V000002014106G",
    "displayName": "CD RTE",
    "lat": 48.8918,
    "lng": 2.2378
  },
  "rteBusinessApplications": [
    { "code": "OCAPPI", "criticality": "P1" },
    { "code": "PLANET", "criticality": "P2" },
    { "code": "CIA", "criticality": "P1" },
    { "code": "NOVA", "criticality": "P2" },
    { "code": "TACITE", "criticality": "P2" },
    { "code": "PROPHYL", "criticality": "P2" },
    { "code": "SMARDATA", "criticality": "P3" },
    { "code": "RDM", "criticality": "P2" },
    { "code": "KIWI", "criticality": "P3" },
    { "code": "SRA", "criticality": "P2" },
    { "code": "ECO2MIX", "criticality": "P3" },
    { "code": "TOTEM", "criticality": "P2" },
    { "code": "BOB", "criticality": "P2" },
    { "code": "TOP NIVEAU", "criticality": "P1" }
  ],
  "organizationGeocode": {
    "RTE":        { "lat": 48.8918, "lng": 2.2378,  "country": "FR" },
    "SwissGrid":  { "lat": 47.5596, "lng": 7.9086,  "country": "CH" },
    "Terna":      { "lat": 41.9028, "lng": 12.4964, "country": "IT" },
    "REE":        { "lat": 40.4168, "lng": -3.7038, "country": "ES" },
    "Elia":       { "lat": 50.8503, "lng": 4.3517,  "country": "BE" },
    "TenneT":     { "lat": 52.3702, "lng": 4.8952,  "country": "NL" },
    "Amprion":    { "lat": 51.5136, "lng": 7.4653,  "country": "DE" },
    "TransnetBW": { "lat": 48.7758, "lng": 9.1829,  "country": "DE" },
    "EirGrid":    { "lat": 53.3498, "lng": -6.2603, "country": "IE" },
    "ENTSO-E":    { "lat": 50.8503, "lng": 4.3517,  "country": "BE" },
    "Statnett":   { "lat": 59.9139, "lng": 10.7522, "country": "NO" },
    "Energinet":  { "lat": 55.6761, "lng": 12.5683, "country": "DK" }
  },
  "countryGeocode": {
    "FR":      { "lat": 46.6, "lng": 2.4 },
    "DE":      { "lat": 51.2, "lng": 10.4 },
    "BE":      { "lat": 50.5, "lng": 4.5 },
    "IT":      { "lat": 41.9, "lng": 12.5 },
    "ES":      { "lat": 40.4, "lng": -3.7 },
    "CH":      { "lat": 46.8, "lng": 8.2 },
    "NL":      { "lat": 52.1, "lng": 5.3 },
    "IE":      { "lat": 53.1, "lng": -7.7 },
    "NO":      { "lat": 60.5, "lng": 8.5 },
    "DK":      { "lat": 56.0, "lng": 9.5 },
    "DEFAULT": { "lat": 50.8503, "lng": 4.3517, "label": "Bruxelles (défaut)" }
  },
  "messageTypeClassification": {
    "exact": {
      "RSMD": "VP",
      "CAPVP": "VP",
      "IDCCOR": "CORE",
      "CGM": "CORE",
      "MARI-ENERGY-ACT": "MARI",
      "PICASSO-OFFER": "PICASSO"
    },
    "patterns": [
      { "match": "^VP-.*",    "process": "VP" },
      { "match": "^CORE-.*",  "process": "CORE" },
      { "match": "^TP-.*",    "process": "TP" },
      { "match": "^UK-CC-.*", "process": "UK-CC-IN" }
    ]
  },
  "processColors": {
    "TP":       "#3b82f6",
    "UK-CC-IN": "#f97316",
    "CORE":     "#a855f7",
    "MARI":     "#22c55e",
    "PICASSO":  "#f59e0b",
    "VP":       "#ec4899",
    "MIXTE":    "#4b5563",
    "UNKNOWN":  "#9ca3af"
  }
}
```

- [ ] **Step 4: Créer `packages/registry/README.md`**

```markdown
# @carto-ecp/registry

Données de référence chargées en mémoire au boot du backend.

## Fichiers

- `eic-entsoe.csv` — liste officielle ENTSO-E des codes EIC (~15k lignes, source publique).
- `eic-rte-overlay.json` — overlay RTE-custom : les 6 Endpoints RTE, le CD RTE, les BA, les coordonnées GPS par organisation et par pays, la classification `messageType → process`, la palette de couleurs.

## Maintenance

Le rechargement à chaud est reporté à un slice ultérieur. Pour l'instant : modifier les fichiers, commit, redémarrer l'API.

Pour ajouter une organisation partenaire : éditer `organizationGeocode` dans le JSON.
Pour ajouter une règle de classification : éditer `messageTypeClassification.exact` (prioritaire) ou `patterns`.
```

- [ ] **Step 5: Commit**

```bash
git add packages/registry
git commit -m "$(cat <<'EOF'
feat(registry): CSV ENTSO-E + overlay RTE avec 12 orgas preloaded (Task 3)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase B — Backend foundation

### Task 4: Scaffold `apps/api` (NestJS)

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/.eslintrc.cjs`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`

- [ ] **Step 1: Créer `apps/api/package.json`**

```json
{
  "name": "@carto-ecp/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "@carto-ecp/shared": "workspace:*",
    "@nestjs/common": "^10.4.4",
    "@nestjs/core": "^10.4.4",
    "@nestjs/platform-express": "^10.4.4",
    "@nestjs/throttler": "^6.2.1",
    "@prisma/client": "^5.20.0",
    "adm-zip": "^0.5.16",
    "csv-parse": "^5.5.6",
    "fast-xml-parser": "^4.5.0",
    "helmet": "^7.1.0",
    "multer": "^1.4.5-lts.1",
    "nestjs-pino": "^4.1.0",
    "pino": "^9.4.0",
    "pino-pretty": "^11.2.2",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "uuid": "^10.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.5",
    "@nestjs/testing": "^10.4.4",
    "@types/adm-zip": "^0.5.5",
    "@types/multer": "^1.4.12",
    "@types/node": "^20.14.9",
    "@types/supertest": "^6.0.2",
    "@types/uuid": "^10.0.0",
    "prisma": "^5.20.0",
    "supertest": "^7.0.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Créer `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "target": "ES2022",
    "outDir": "./dist",
    "rootDir": "./src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "types": ["node"],
    "noEmit": false
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Créer `apps/api/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 4: Créer `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/*.module.ts', 'src/main.ts'],
    },
    testTimeout: 15000,
  },
});
```

- [ ] **Step 5: Créer `apps/api/src/main.ts`**

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: false,
  });
  app.setGlobalPrefix('api');

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
}

void bootstrap();
```

- [ ] **Step 6: Créer `apps/api/src/app.module.ts`** (minimal, modules ajoutés par les tasks suivantes)

```ts
import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

- [ ] **Step 7: Créer `apps/api/.eslintrc.cjs`**

```js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  root: true,
  env: { node: true, es2022: true },
};
```

- [ ] **Step 8: Installer**

Run: `pnpm install`
Expected: tous les packages installés.

- [ ] **Step 9: Vérifier le build**

Run: `pnpm --filter @carto-ecp/api build`
Expected: `dist/main.js` créé, pas d'erreur TS.

- [ ] **Step 10: Commit**

```bash
git add apps/api package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(api): scaffold NestJS 10 avec Helmet/CORS/Throttler/Pino (Task 4)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Prisma schema + PrismaService

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/src/prisma/prisma.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Créer `apps/api/prisma/schema.prisma`**

```prisma
// This is your Prisma schema file, see https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Snapshot {
  id                  String   @id @default(uuid())
  label               String
  envName             String
  componentType       String   // 'ENDPOINT' | 'COMPONENT_DIRECTORY'
  sourceComponentCode String
  cdCode              String?
  organization        String?
  uploadedAt          DateTime @default(now())
  zipPath             String
  warningsJson        String   @default("[]")

  components        Component[]
  messagePaths      MessagePath[]
  messagingStats    MessagingStatistic[]
  appProperties     AppProperty[]

  @@index([envName])
  @@index([uploadedAt])
}

model Component {
  id                 String  @id @default(uuid())
  snapshotId         String
  snapshot           Snapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  eic                String
  type               String  // BROKER | ENDPOINT | COMPONENT_DIRECTORY
  organization       String
  personName         String?
  email              String?
  phone              String?
  homeCdCode         String?
  networksCsv        String  // CSV-joined list of networks
  creationTs         DateTime?
  modificationTs     DateTime?
  displayName        String
  country            String?
  lat                Float
  lng                Float
  isDefaultPosition  Boolean @default(false)
  process            String?
  sourceType         String  // 'XML_CD' | 'LOCAL_CSV'

  urls ComponentUrl[]

  @@unique([snapshotId, eic])
  @@index([snapshotId])
}

model ComponentUrl {
  id          String   @id @default(uuid())
  componentId String
  component   Component @relation(fields: [componentId], references: [id], onDelete: Cascade)
  network     String
  url         String

  @@index([componentId])
}

model MessagePath {
  id                     String   @id @default(uuid())
  snapshotId             String
  snapshot               Snapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  receiverEic            String
  senderEicOrWildcard    String   // "*" ou EIC
  messageType            String   // "*" ou libre
  transportPattern       String   // 'DIRECT' | 'INDIRECT'
  intermediateBrokerEic  String?
  validFrom              DateTime?
  validTo                DateTime?
  process                String   // ProcessKey incluant 'UNKNOWN'
  direction              String   // 'IN' | 'OUT'
  source                 String   // 'XML_CD_PATHS' | 'LOCAL_CSV_PATHS'
  isExpired              Boolean  @default(false)

  @@index([snapshotId])
  @@index([snapshotId, receiverEic])
}

model MessagingStatistic {
  id                   String   @id @default(uuid())
  snapshotId           String
  snapshot             Snapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  sourceEndpointCode   String
  remoteComponentCode  String
  connectionStatus     String?
  lastMessageUp        DateTime?
  lastMessageDown      DateTime?
  sumMessagesUp        Int       @default(0)
  sumMessagesDown      Int       @default(0)
  deleted              Boolean   @default(false)

  @@index([snapshotId])
  @@index([snapshotId, remoteComponentCode])
}

model AppProperty {
  id         String   @id @default(uuid())
  snapshotId String
  snapshot   Snapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  key        String
  value      String

  @@index([snapshotId])
}
```

- [ ] **Step 2: Créer `apps/api/.env` (local, non commit — déjà gitignored)**

```
DATABASE_URL="file:./dev.db"
```

- [ ] **Step 3: Générer le client Prisma et créer la migration initiale**

Run: `pnpm --filter @carto-ecp/api prisma migrate dev --name init`
Expected: `dev.db` créé, migration `prisma/migrations/XXXXXX_init/` créée, client Prisma généré.

- [ ] **Step 4: Créer `apps/api/src/prisma/prisma.service.ts`**

```ts
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- [ ] **Step 5: Créer `apps/api/src/prisma/prisma.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 6: Enregistrer `PrismaModule` dans `AppModule`**

Modifier `apps/api/src/app.module.ts` pour ajouter `PrismaModule` aux imports :

```ts
import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

- [ ] **Step 7: Vérifier le build**

Run: `pnpm --filter @carto-ecp/api build`
Expected: pas d'erreur TS.

- [ ] **Step 8: Ajouter `dev.db` + `dev.db-journal` au `.gitignore`** (déjà couvert par `*.db` existant). Rien à faire.

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma apps/api/src/prisma apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): Prisma schema + PrismaService (Task 5)

Snapshot, Component, ComponentUrl, MessagePath, MessagingStatistic, AppProperty.
Migration initiale créée localement.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Helpers `null-value-normalizer` et `date-parser`

**Files:**
- Create: `apps/api/src/common/null-value-normalizer.ts`
- Create: `apps/api/src/common/null-value-normalizer.spec.ts`
- Create: `apps/api/src/common/date-parser.ts`
- Create: `apps/api/src/common/date-parser.spec.ts`

- [ ] **Step 1: Écrire les tests `null-value-normalizer.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { normalizeNull, NULL_VALUE_PLACEHOLDER } from './null-value-normalizer.js';

describe('normalizeNull', () => {
  it('converts NULL_VALUE_PLACEHOLDER string to null', () => {
    expect(normalizeNull('NULL_VALUE_PLACEHOLDER')).toBeNull();
  });

  it('preserves non-placeholder strings as-is', () => {
    expect(normalizeNull('hello')).toBe('hello');
    expect(normalizeNull('')).toBe('');
    expect(normalizeNull('NULL')).toBe('NULL');
    expect(normalizeNull('null')).toBe('null');
  });

  it('preserves wildcard `*` unchanged', () => {
    expect(normalizeNull('*')).toBe('*');
  });

  it('preserves number and boolean values unchanged', () => {
    expect(normalizeNull(42)).toBe(42);
    expect(normalizeNull(true)).toBe(true);
  });

  it('exposes the placeholder constant', () => {
    expect(NULL_VALUE_PLACEHOLDER).toBe('NULL_VALUE_PLACEHOLDER');
  });
});
```

- [ ] **Step 2: Run test → doit échouer**

Run: `pnpm --filter @carto-ecp/api test -- null-value-normalizer`
Expected: FAIL avec "Cannot find module './null-value-normalizer.js'"

- [ ] **Step 3: Implémenter `apps/api/src/common/null-value-normalizer.ts`**

```ts
export const NULL_VALUE_PLACEHOLDER = 'NULL_VALUE_PLACEHOLDER';

export function normalizeNull<T>(value: T): T | null {
  if (typeof value === 'string' && value === NULL_VALUE_PLACEHOLDER) {
    return null;
  }
  return value;
}
```

- [ ] **Step 4: Run test → doit passer**

Run: `pnpm --filter @carto-ecp/api test -- null-value-normalizer`
Expected: PASS, 5 tests.

- [ ] **Step 5: Écrire les tests `date-parser.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseEcpDate } from './date-parser.js';

describe('parseEcpDate', () => {
  it('parses ISO nano CSV format (without Z)', () => {
    const d = parseEcpDate('2025-03-12T15:34:48.560980651');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2025-03-12T15:34:48.560Z');
  });

  it('parses ISO Z millisecond XML format', () => {
    const d = parseEcpDate('2025-03-18T15:00:00.000Z');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2025-03-18T15:00:00.000Z');
  });

  it('returns null for null input', () => {
    expect(parseEcpDate(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseEcpDate('')).toBeNull();
  });

  it('returns null for NULL_VALUE_PLACEHOLDER', () => {
    expect(parseEcpDate('NULL_VALUE_PLACEHOLDER')).toBeNull();
  });

  it('returns null for unparsable input', () => {
    expect(parseEcpDate('not-a-date')).toBeNull();
  });

  it('truncates nanoseconds to milliseconds precision', () => {
    const d = parseEcpDate('2025-03-12T15:34:48.999999999');
    expect(d?.getUTCMilliseconds()).toBe(999);
  });
});
```

- [ ] **Step 6: Run test → doit échouer**

Run: `pnpm --filter @carto-ecp/api test -- date-parser`
Expected: FAIL ("Cannot find module './date-parser.js'")

- [ ] **Step 7: Implémenter `apps/api/src/common/date-parser.ts`**

```ts
const ISO_WITH_NANOS = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})?$/;

export function parseEcpDate(input: string | null | undefined): Date | null {
  if (input == null) return null;
  if (input === '' || input === 'NULL_VALUE_PLACEHOLDER') return null;

  const match = ISO_WITH_NANOS.exec(input);
  if (!match) return null;

  const [, basePart, fractionalRaw, tzPart] = match;
  const fractional = fractionalRaw ? fractionalRaw.slice(0, 3).padEnd(3, '0') : '000';
  const tz = tzPart ?? 'Z';
  const iso = `${basePart}.${fractional}${tz}`;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return new Date(time);
}
```

- [ ] **Step 8: Run test → doit passer**

Run: `pnpm --filter @carto-ecp/api test -- date-parser`
Expected: PASS, 7 tests.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/common
git commit -m "$(cat <<'EOF'
feat(api): helpers normalizeNull + parseEcpDate (Task 6)

Gère NULL_VALUE_PLACEHOLDER et les 2 formats de dates ECP
(CSV ISO nano sans Z, XML ISO millisecondes avec Z).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Erreurs typées `ingestion-errors.ts`

**Files:**
- Create: `apps/api/src/common/errors/ingestion-errors.ts`

- [ ] **Step 1: Créer les classes d'erreur**

```ts
import { HttpException, HttpStatus } from '@nestjs/common';

type ErrorContext = Record<string, unknown>;

export class IngestionError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    public readonly context?: ErrorContext,
  ) {
    super({ code, message, context, timestamp: new Date().toISOString() }, status);
  }
}

export class InvalidUploadException extends IngestionError {
  constructor(message: string, context?: ErrorContext) {
    super('INVALID_UPLOAD', message, HttpStatus.BAD_REQUEST, context);
  }
}

export class MissingRequiredCsvException extends IngestionError {
  constructor(fileName: string) {
    super(
      'MISSING_REQUIRED_CSV',
      `Le fichier ${fileName} est absent du zip`,
      HttpStatus.BAD_REQUEST,
      { fileName },
    );
  }
}

export class UnknownMadesNamespaceException extends IngestionError {
  constructor(namespace: string | null) {
    super(
      'UNKNOWN_MADES_NAMESPACE',
      `Namespace XML MADES inconnu ou absent`,
      HttpStatus.BAD_REQUEST,
      { namespace },
    );
  }
}

export class PayloadTooLargeException extends IngestionError {
  constructor(sizeBytes: number) {
    super(
      'PAYLOAD_TOO_LARGE',
      `Fichier zip trop volumineux (> 50 MB)`,
      HttpStatus.PAYLOAD_TOO_LARGE,
      { sizeBytes },
    );
  }
}

export class SnapshotNotFoundException extends IngestionError {
  constructor(snapshotId: string) {
    super(
      'SNAPSHOT_NOT_FOUND',
      `Snapshot ${snapshotId} introuvable`,
      HttpStatus.NOT_FOUND,
      { snapshotId },
    );
  }
}
```

- [ ] **Step 2: Vérifier le build**

Run: `pnpm --filter @carto-ecp/api typecheck`
Expected: pas d'erreur TS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/common/errors
git commit -m "$(cat <<'EOF'
feat(api): classes d'exceptions typées (Task 7)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: RegistryService (lookup EIC + classifier messageType)

**Files:**
- Create: `apps/api/src/registry/types.ts`
- Create: `apps/api/src/registry/registry.service.ts`
- Create: `apps/api/src/registry/registry.service.spec.ts`
- Create: `apps/api/src/registry/registry.module.ts`
- Modify: `apps/api/src/app.module.ts` (import RegistryModule)

- [ ] **Step 1: Créer `apps/api/src/registry/types.ts`**

```ts
import type { ProcessKey } from '@carto-ecp/shared';

export type EntsoeEntry = {
  eic: string;
  displayName: string;
  longName: string;
  country: string | null;
  vatCode: string | null;
  functionList: string | null;
};

export type RteEndpointOverlay = {
  eic: string;
  code: string;
  displayName: string;
  process: ProcessKey;
  lat: number;
  lng: number;
  city: string;
};

export type RteOverlay = {
  version: string;
  rteEndpoints: RteEndpointOverlay[];
  rteComponentDirectory: { eic: string; displayName: string; lat: number; lng: number };
  rteBusinessApplications: { code: string; criticality: string }[];
  organizationGeocode: Record<string, { lat: number; lng: number; country: string }>;
  countryGeocode: Record<string, { lat: number; lng: number; label?: string }>;
  messageTypeClassification: {
    exact: Record<string, ProcessKey>;
    patterns: { match: string; process: ProcessKey }[];
  };
  processColors: Record<ProcessKey, string>;
};

export type ResolvedLocation = {
  displayName: string;
  country: string | null;
  lat: number;
  lng: number;
  isDefaultPosition: boolean;
};
```

- [ ] **Step 2: Écrire les tests `registry.service.spec.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { RegistryService } from './registry.service.js';

describe('RegistryService', () => {
  let service: RegistryService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RegistryService],
    }).compile();
    service = moduleRef.get(RegistryService);
    await service.onModuleInit();
  });

  describe('ENTSO-E index', () => {
    it('loads the ENTSO-E CSV with expected row count', () => {
      expect(service.entsoeSize()).toBeGreaterThan(14000);
    });

    it('resolves Terna by EIC', () => {
      const entry = service.lookupEntsoe('10X1001A1001A345');
      expect(entry?.displayName).toBe('ITALY_TSO');
      expect(entry?.country).toBe('IT');
    });

    it('returns null for unknown EIC', () => {
      expect(service.lookupEntsoe('XXNOTAREALCODE')).toBeNull();
    });
  });

  describe('resolveComponent', () => {
    it('resolves an RTE endpoint from the overlay precisely', () => {
      const res = service.resolveComponent('17V000000498771C', 'RTE');
      expect(res.displayName).toBe('INTERNET-2');
      expect(res.lat).toBeCloseTo(48.8918);
      expect(res.isDefaultPosition).toBe(false);
    });

    it('resolves the RTE CD from the overlay', () => {
      const res = service.resolveComponent('17V000002014106G', 'RTE');
      expect(res.displayName).toBe('CD RTE');
      expect(res.isDefaultPosition).toBe(false);
    });

    it('uses organization geocode when EIC is known to ENTSO-E', () => {
      const res = service.resolveComponent('10X1001A1001A345', 'Terna');
      expect(res.country).toBe('IT');
      expect(res.lat).toBeCloseTo(41.9028);
      expect(res.isDefaultPosition).toBe(false);
    });

    it('falls back to country geocode if organization is unknown', () => {
      const res = service.resolveComponent('10X1001A1001A248', 'Energinet');
      expect(res.country).toBe('DK');
      expect(res.isDefaultPosition).toBe(false);
    });

    it('falls back to default (Brussels) when EIC is totally unknown', () => {
      const res = service.resolveComponent('XXUNKNOWN_EIC', 'NoOrg');
      expect(res.isDefaultPosition).toBe(true);
      expect(res.lat).toBeCloseTo(50.8503);
    });
  });

  describe('classifyMessageType', () => {
    it('uses exact mapping first', () => {
      expect(service.classifyMessageType('RSMD')).toBe('VP');
      expect(service.classifyMessageType('IDCCOR')).toBe('CORE');
    });

    it('uses regex patterns as fallback', () => {
      expect(service.classifyMessageType('VP-CUSTOM-123')).toBe('VP');
      expect(service.classifyMessageType('UK-CC-SOMETHING')).toBe('UK-CC-IN');
    });

    it('returns UNKNOWN when no rule matches', () => {
      expect(service.classifyMessageType('TOTALLY-RANDOM-XYZ')).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for wildcards', () => {
      expect(service.classifyMessageType('*')).toBe('UNKNOWN');
    });
  });

  describe('processColor', () => {
    it('returns hex color for each process', () => {
      expect(service.processColor('VP')).toBe('#ec4899');
      expect(service.processColor('MIXTE')).toBe('#4b5563');
    });
  });
});
```

- [ ] **Step 3: Run test → doit échouer**

Run: `pnpm --filter @carto-ecp/api test -- registry.service`
Expected: FAIL

- [ ] **Step 4: Implémenter `apps/api/src/registry/registry.service.ts`**

```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import type { ProcessKey } from '@carto-ecp/shared';
import type {
  EntsoeEntry,
  ResolvedLocation,
  RteOverlay,
} from './types.js';

const REGISTRY_PACKAGE_ROOT = join(
  fileURLToPath(new URL('../../../../packages/registry/', import.meta.url)),
);

@Injectable()
export class RegistryService implements OnModuleInit {
  private readonly logger = new Logger(RegistryService.name);
  private eicIndex = new Map<string, EntsoeEntry>();
  private overlay!: RteOverlay;
  private patternRegexes: { regex: RegExp; process: ProcessKey }[] = [];

  async onModuleInit(): Promise<void> {
    await Promise.all([this.loadEntsoeIndex(), this.loadOverlay()]);
    this.logger.log(
      `Registry loaded: ${this.eicIndex.size} ENTSO-E entries, overlay ${this.overlay.version}`,
    );
  }

  entsoeSize(): number {
    return this.eicIndex.size;
  }

  lookupEntsoe(eic: string): EntsoeEntry | null {
    return this.eicIndex.get(eic) ?? null;
  }

  resolveComponent(eic: string, organization: string): ResolvedLocation {
    const rteEndpoint = this.overlay.rteEndpoints.find((e) => e.eic === eic);
    if (rteEndpoint) {
      return {
        displayName: rteEndpoint.displayName,
        country: 'FR',
        lat: rteEndpoint.lat,
        lng: rteEndpoint.lng,
        isDefaultPosition: false,
      };
    }

    if (this.overlay.rteComponentDirectory.eic === eic) {
      return {
        displayName: this.overlay.rteComponentDirectory.displayName,
        country: 'FR',
        lat: this.overlay.rteComponentDirectory.lat,
        lng: this.overlay.rteComponentDirectory.lng,
        isDefaultPosition: false,
      };
    }

    const entsoe = this.eicIndex.get(eic);
    if (entsoe) {
      const orgGeo = this.overlay.organizationGeocode[organization];
      if (orgGeo) {
        return {
          displayName: entsoe.displayName,
          country: orgGeo.country,
          lat: orgGeo.lat,
          lng: orgGeo.lng,
          isDefaultPosition: false,
        };
      }
      if (entsoe.country) {
        const ctryGeo = this.overlay.countryGeocode[entsoe.country];
        if (ctryGeo) {
          return {
            displayName: entsoe.displayName,
            country: entsoe.country,
            lat: ctryGeo.lat,
            lng: ctryGeo.lng,
            isDefaultPosition: false,
          };
        }
      }
    }

    const def = this.overlay.countryGeocode.DEFAULT;
    return {
      displayName: entsoe?.displayName ?? organization ?? eic,
      country: entsoe?.country ?? null,
      lat: def.lat,
      lng: def.lng,
      isDefaultPosition: true,
    };
  }

  classifyMessageType(messageType: string): ProcessKey {
    if (!messageType || messageType === '*') return 'UNKNOWN';
    const exact = this.overlay.messageTypeClassification.exact[messageType];
    if (exact) return exact;
    for (const { regex, process } of this.patternRegexes) {
      if (regex.test(messageType)) return process;
    }
    return 'UNKNOWN';
  }

  processColor(process: ProcessKey): string {
    return this.overlay.processColors[process];
  }

  getOverlay(): RteOverlay {
    return this.overlay;
  }

  private async loadEntsoeIndex(): Promise<void> {
    const csvPath = join(REGISTRY_PACKAGE_ROOT, 'eic-entsoe.csv');
    const content = await readFile(csvPath, 'utf-8');
    const rows = parseCsv(content, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    for (const row of rows) {
      const eic = row.EicCode;
      if (!eic) continue;
      this.eicIndex.set(eic, {
        eic,
        displayName: row.EicDisplayName ?? eic,
        longName: row.EicLongName ?? '',
        country: row.MarketParticipantIsoCountryCode?.trim() || null,
        vatCode: row.MarketParticipantVatCode?.trim() || null,
        functionList: row.EicTypeFunctionList ?? null,
      });
    }
  }

  private async loadOverlay(): Promise<void> {
    const jsonPath = join(REGISTRY_PACKAGE_ROOT, 'eic-rte-overlay.json');
    const content = await readFile(jsonPath, 'utf-8');
    this.overlay = JSON.parse(content) as RteOverlay;
    this.patternRegexes = this.overlay.messageTypeClassification.patterns.map((p) => ({
      regex: new RegExp(p.match),
      process: p.process,
    }));
  }
}
```

- [ ] **Step 5: Créer `apps/api/src/registry/registry.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { RegistryService } from './registry.service.js';

@Global()
@Module({
  providers: [RegistryService],
  exports: [RegistryService],
})
export class RegistryModule {}
```

- [ ] **Step 6: Enregistrer `RegistryModule` dans `AppModule`**

Ajouter à `apps/api/src/app.module.ts` l'import `import { RegistryModule } from './registry/registry.module.js';` et l'ajouter aux `imports` du `@Module`.

- [ ] **Step 7: Run test → doit passer**

Run: `pnpm --filter @carto-ecp/api test -- registry.service`
Expected: PASS, ~13 tests.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/registry apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(registry): RegistryService avec CSV ENTSO-E + overlay RTE (Task 8)

- Chargement bootstrap des 14929 EIC ENTSO-E en Map<eic, Entry>
- resolveComponent avec cascade overlay → orga → pays → Bruxelles
- classifyMessageType cascade exact → regex → UNKNOWN

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Ingestion types + ZipExtractor

**Files:**
- Create: `apps/api/src/ingestion/types.ts`
- Create: `apps/api/src/ingestion/zip-extractor.service.ts`
- Create: `apps/api/src/ingestion/zip-extractor.service.spec.ts`

- [ ] **Step 1: Créer `apps/api/src/ingestion/types.ts`**

```ts
import type { ComponentType, ProcessKey, Warning } from '@carto-ecp/shared';

export const REQUIRED_CSV_FILES = [
  'application_property.csv',
  'component_directory.csv',
] as const;

export const USABLE_CSV_FILES = [
  'application_property.csv',
  'component_directory.csv',
  'message_path.csv',
  'messaging_statistics.csv',
  'message_type.csv',
  'message_upload_route.csv',
] as const;

export const IGNORED_CSV_FILES = [
  'component_statistics.csv',
  'synchronized_directories.csv',
  'pending_edit_directories.csv',
  'pending_removal_directories.csv',
] as const;

export const SENSITIVE_CSV_FILES = [
  'local_key_store.csv',
  'registration_store.csv',
  'registration_requests.csv',
] as const;

export type ExtractedZip = {
  files: Map<string, Buffer>;
};

export type AppPropertyRow = {
  key: string;
  value: string | null;
  changedBy: string | null;
  createdDate: Date | null;
  modifiedDate: Date | null;
};

export type MessagePathRow = {
  allowedSenders: string | null;
  applied: boolean | null;
  intermediateBrokerCode: string | null;
  intermediateComponent: string | null;
  messagePathType: 'ACKNOWLEDGEMENT' | 'BUSINESS' | null;
  messageType: string | null;
  receiver: string | null;
  remote: boolean | null;
  status: string | null;
  transportPattern: 'DIRECT' | 'INDIRECT' | null;
  validFrom: Date | null;
  validTo: Date | null;
};

export type MessagingStatisticRow = {
  connectionStatus: string | null;
  deleted: boolean | null;
  lastMessageDown: Date | null;
  lastMessageUp: Date | null;
  localEcpInstanceId: string | null;
  remoteComponentCode: string | null;
  sumMessagesDown: number | null;
  sumMessagesUp: number | null;
};

export type ComponentDirectoryRow = {
  directoryContent: string;
  id: string;
  signature: string | null;
  version: string | null;
};

export type MadesPath = {
  senderComponent: string | null;
  messageType: string;
  transportPattern: 'DIRECT' | 'INDIRECT';
  brokerCode: string | null;
  validFrom: Date | null;
  validTo: Date | null;
};

export type MadesCertificate = {
  certificateID: string;
  type: string;
  validFrom: Date | null;
  validTo: Date | null;
};

export type MadesComponent = {
  organization: string;
  personName: string;
  email: string;
  phone: string;
  code: string;
  type: 'BROKER' | 'ENDPOINT' | 'COMPONENT_DIRECTORY';
  networks: string[];
  urls: { network: string; url: string }[];
  certificates: MadesCertificate[];
  creationTs: Date | null;
  modificationTs: Date | null;
  homeCdCode: string;
  paths: MadesPath[];
};

export type MadesTree = {
  cdCode: string;
  contentId: number;
  ttl: number;
  brokers: MadesComponent[];
  endpoints: MadesComponent[];
  componentDirectories: MadesComponent[];
};

export type ComponentRecord = {
  eic: string;
  type: 'BROKER' | 'ENDPOINT' | 'COMPONENT_DIRECTORY';
  organization: string;
  personName: string | null;
  email: string | null;
  phone: string | null;
  homeCdCode: string;
  networks: string[];
  urls: { network: string; url: string }[];
  creationTs: Date | null;
  modificationTs: Date | null;
  displayName: string;
  country: string | null;
  lat: number;
  lng: number;
  isDefaultPosition: boolean;
  process: ProcessKey | null;
  sourceType: 'XML_CD' | 'LOCAL_CSV';
};

export type MessagePathRecord = {
  receiverEic: string;
  senderEicOrWildcard: string;
  messageType: string;
  transportPattern: 'DIRECT' | 'INDIRECT';
  intermediateBrokerEic: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  process: ProcessKey;
  direction: 'IN' | 'OUT';
  source: 'XML_CD_PATHS' | 'LOCAL_CSV_PATHS';
  isExpired: boolean;
};

export type NetworkSnapshot = {
  meta: {
    envName: string;
    componentType: ComponentType;
    sourceComponentCode: string;
    cdCode: string | null;
    organization: string;
    networks: string[];
  };
  components: ComponentRecord[];
  messagePaths: MessagePathRecord[];
  messagingStats: MessagingStatisticRow[];
  appProperties: AppPropertyRow[];
  warnings: Warning[];
};

export type IngestionInput = {
  zipBuffer: Buffer;
  label: string;
  envName: string;
};

export type IngestionResult = {
  snapshotId: string;
  componentType: ComponentType;
  sourceComponentCode: string;
  cdCode: string | null;
  warnings: Warning[];
};
```

- [ ] **Step 2: Écrire les tests `zip-extractor.service.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import AdmZip from 'adm-zip';
import { ZipExtractorService } from './zip-extractor.service.js';
import { InvalidUploadException, MissingRequiredCsvException, PayloadTooLargeException } from '../common/errors/ingestion-errors.js';

function makeZip(entries: Record<string, string | Buffer>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(entries)) {
    zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(content));
  }
  return zip.toBuffer();
}

describe('ZipExtractorService', () => {
  const service = new ZipExtractorService();

  it('extracts whitelisted files and skips others', () => {
    const buffer = makeZip({
      'application_property.csv': 'key;value\nfoo;bar',
      'component_directory.csv': 'directoryContent\nx',
      'random_file.txt': 'ignored',
    });
    const result = service.extract(buffer);
    expect(result.files.has('application_property.csv')).toBe(true);
    expect(result.files.has('component_directory.csv')).toBe(true);
    expect(result.files.has('random_file.txt')).toBe(false);
  });

  it('excludes sensitive files from the in-memory map', () => {
    const buffer = makeZip({
      'application_property.csv': 'key;value',
      'component_directory.csv': 'directoryContent\nx',
      'local_key_store.csv': 'secret',
      'registration_store.csv': 'secret',
      'registration_requests.csv': 'secret',
    });
    const result = service.extract(buffer);
    expect(result.files.has('local_key_store.csv')).toBe(false);
    expect(result.files.has('registration_store.csv')).toBe(false);
    expect(result.files.has('registration_requests.csv')).toBe(false);
  });

  it('throws MissingRequiredCsvException if application_property.csv is absent', () => {
    const buffer = makeZip({ 'component_directory.csv': 'x' });
    expect(() => service.extract(buffer)).toThrowError(MissingRequiredCsvException);
  });

  it('throws MissingRequiredCsvException if component_directory.csv is absent', () => {
    const buffer = makeZip({ 'application_property.csv': 'x' });
    expect(() => service.extract(buffer)).toThrowError(MissingRequiredCsvException);
  });

  it('throws InvalidUploadException if the zip is corrupted', () => {
    const garbage = Buffer.from('not a zip file');
    expect(() => service.extract(garbage)).toThrowError(InvalidUploadException);
  });

  it('rejects entries larger than 50MB', () => {
    const huge = Buffer.alloc(51 * 1024 * 1024, 'a');
    const buffer = makeZip({
      'application_property.csv': 'x',
      'component_directory.csv': 'x',
      'message_path.csv': huge,
    });
    expect(() => service.extract(buffer)).toThrowError(PayloadTooLargeException);
  });
});
```

- [ ] **Step 3: Run test → doit échouer**

Run: `pnpm --filter @carto-ecp/api test -- zip-extractor`
Expected: FAIL.

- [ ] **Step 4: Implémenter `apps/api/src/ingestion/zip-extractor.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import AdmZip from 'adm-zip';
import {
  InvalidUploadException,
  MissingRequiredCsvException,
  PayloadTooLargeException,
} from '../common/errors/ingestion-errors.js';
import {
  IGNORED_CSV_FILES,
  REQUIRED_CSV_FILES,
  SENSITIVE_CSV_FILES,
  USABLE_CSV_FILES,
  type ExtractedZip,
} from './types.js';

const MAX_ENTRY_SIZE = 50 * 1024 * 1024;
const LOADABLE_FILES = new Set<string>([
  ...USABLE_CSV_FILES,
  ...IGNORED_CSV_FILES,
]);
const SENSITIVE = new Set<string>(SENSITIVE_CSV_FILES);

@Injectable()
export class ZipExtractorService {
  extract(buffer: Buffer): ExtractedZip {
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch (err) {
      throw new InvalidUploadException('Le fichier zip est corrompu ou illisible', {
        cause: (err as Error).message,
      });
    }

    const files = new Map<string, Buffer>();
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const name = entry.entryName.split('/').pop() ?? entry.entryName;
      if (SENSITIVE.has(name)) continue;
      if (!LOADABLE_FILES.has(name)) continue;

      const data = entry.getData();
      if (data.length > MAX_ENTRY_SIZE) {
        throw new PayloadTooLargeException(data.length);
      }
      files.set(name, data);
    }

    for (const required of REQUIRED_CSV_FILES) {
      if (!files.has(required)) {
        throw new MissingRequiredCsvException(required);
      }
    }

    return { files };
  }
}
```

- [ ] **Step 5: Run test → doit passer**

Run: `pnpm --filter @carto-ecp/api test -- zip-extractor`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ingestion/types.ts apps/api/src/ingestion/zip-extractor.service.ts apps/api/src/ingestion/zip-extractor.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): ZipExtractor avec whitelist + exclusion fichiers sensibles (Task 9)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: CsvReader

**Files:**
- Create: `apps/api/src/ingestion/csv-reader.service.ts`
- Create: `apps/api/src/ingestion/csv-reader.service.spec.ts`

- [ ] **Step 1: Écrire les tests `csv-reader.service.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { CsvReaderService } from './csv-reader.service.js';

describe('CsvReaderService', () => {
  const service = new CsvReaderService();

  describe('readApplicationProperties', () => {
    it('parses rows with NULL_VALUE_PLACEHOLDER → null', () => {
      const csv = Buffer.from(
        [
          'changedBy;createdDate;key;modifiedDate;value',
          'NULL_VALUE_PLACEHOLDER;"2025-03-12T15:34:48.560980651";"ecp.componentCode";"2025-03-12T15:34:48.576688688";"17V000000498771C"',
        ].join('\n'),
      );
      const rows = service.readApplicationProperties(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].changedBy).toBeNull();
      expect(rows[0].key).toBe('ecp.componentCode');
      expect(rows[0].value).toBe('17V000000498771C');
      expect(rows[0].createdDate).toBeInstanceOf(Date);
    });

    it('ignores malformed rows (records warning internally, does not throw)', () => {
      const csv = Buffer.from(
        [
          'changedBy;createdDate;key;modifiedDate;value',
          'too;few;cols',
        ].join('\n'),
      );
      const rows = service.readApplicationProperties(csv);
      expect(rows).toEqual([]);
    });
  });

  describe('readMessagePaths', () => {
    it('parses allowedSenders wildcard, DIRECT transport, and expired validity', () => {
      const csv = Buffer.from(
        [
          'allowedSenders;applied;intermediateBrokerCode;intermediateComponent;messagePathType;messageType;receiver;remote;status;transportPattern;validFrom;validTo',
          '"*";true;NULL_VALUE_PLACEHOLDER;NULL_VALUE_PLACEHOLDER;BUSINESS;"*";"17V000000498771C";false;ACTIVE;DIRECT;"2025-01-01T00:00:00.000000000";"2026-01-01T00:00:00.000000000"',
        ].join('\n'),
      );
      const rows = service.readMessagePaths(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].allowedSenders).toBe('*');
      expect(rows[0].applied).toBe(true);
      expect(rows[0].transportPattern).toBe('DIRECT');
      expect(rows[0].intermediateBrokerCode).toBeNull();
      expect(rows[0].validFrom).toBeInstanceOf(Date);
      expect(rows[0].validTo).toBeInstanceOf(Date);
    });
  });

  describe('readMessagingStatistics', () => {
    it('parses numeric counters and connection status', () => {
      const csv = Buffer.from(
        [
          'connectionStatus;deleted;lastMessageDown;lastMessageUp;localEcpInstanceId;remoteComponentCode;sumMessagesDown;sumMessagesUp',
          'CONNECTED;false;"2026-04-17T10:00:00.000000000";"2026-04-17T10:05:00.000000000";ID1;"17V000002014106G";42;17',
        ].join('\n'),
      );
      const rows = service.readMessagingStatistics(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].connectionStatus).toBe('CONNECTED');
      expect(rows[0].sumMessagesDown).toBe(42);
      expect(rows[0].sumMessagesUp).toBe(17);
      expect(rows[0].deleted).toBe(false);
    });
  });

  describe('readComponentDirectory', () => {
    it('returns the single-row blob XML', () => {
      const csv = Buffer.from(
        [
          'directoryContent;id;signature;version',
          '"<xml/>";ID1;SIG;V1',
        ].join('\n'),
      );
      const rows = service.readComponentDirectory(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0].directoryContent).toBe('<xml/>');
    });
  });
});
```

- [ ] **Step 2: Run test → doit échouer**

Run: `pnpm --filter @carto-ecp/api test -- csv-reader`
Expected: FAIL.

- [ ] **Step 3: Implémenter `apps/api/src/ingestion/csv-reader.service.ts`**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import { normalizeNull } from '../common/null-value-normalizer.js';
import { parseEcpDate } from '../common/date-parser.js';
import type {
  AppPropertyRow,
  ComponentDirectoryRow,
  MessagePathRow,
  MessagingStatisticRow,
} from './types.js';

type RawRow = Record<string, string>;

@Injectable()
export class CsvReaderService {
  private readonly logger = new Logger(CsvReaderService.name);

  private readRaw(buffer: Buffer): RawRow[] {
    try {
      return parseCsv(buffer.toString('utf-8'), {
        columns: true,
        delimiter: ';',
        skip_empty_lines: true,
        trim: true,
        quote: '"',
        relax_quotes: true,
        relax_column_count: false,
      }) as RawRow[];
    } catch (err) {
      this.logger.warn(`CSV parse error: ${(err as Error).message}`);
      return [];
    }
  }

  private str(row: RawRow, key: string): string | null {
    const v = row[key];
    if (v == null) return null;
    const n = normalizeNull(v);
    if (n == null) return null;
    return n === '' ? null : n;
  }

  private bool(row: RawRow, key: string): boolean | null {
    const s = this.str(row, key);
    if (s == null) return null;
    if (s === 'true') return true;
    if (s === 'false') return false;
    return null;
  }

  private num(row: RawRow, key: string): number | null {
    const s = this.str(row, key);
    if (s == null) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  private date(row: RawRow, key: string): Date | null {
    return parseEcpDate(this.str(row, key));
  }

  readApplicationProperties(buffer: Buffer): AppPropertyRow[] {
    return this.readRaw(buffer).map((row) => ({
      key: this.str(row, 'key') ?? '',
      value: this.str(row, 'value'),
      changedBy: this.str(row, 'changedBy'),
      createdDate: this.date(row, 'createdDate'),
      modifiedDate: this.date(row, 'modifiedDate'),
    }));
  }

  readComponentDirectory(buffer: Buffer): ComponentDirectoryRow[] {
    return this.readRaw(buffer).map((row) => ({
      directoryContent: this.str(row, 'directoryContent') ?? '',
      id: this.str(row, 'id') ?? '',
      signature: this.str(row, 'signature'),
      version: this.str(row, 'version'),
    }));
  }

  readMessagePaths(buffer: Buffer): MessagePathRow[] {
    return this.readRaw(buffer).map((row) => {
      const mpt = this.str(row, 'messagePathType');
      const tp = this.str(row, 'transportPattern');
      return {
        allowedSenders: this.str(row, 'allowedSenders'),
        applied: this.bool(row, 'applied'),
        intermediateBrokerCode: this.str(row, 'intermediateBrokerCode'),
        intermediateComponent: this.str(row, 'intermediateComponent'),
        messagePathType:
          mpt === 'ACKNOWLEDGEMENT' || mpt === 'BUSINESS' ? mpt : null,
        messageType: this.str(row, 'messageType'),
        receiver: this.str(row, 'receiver'),
        remote: this.bool(row, 'remote'),
        status: this.str(row, 'status'),
        transportPattern: tp === 'DIRECT' || tp === 'INDIRECT' ? tp : null,
        validFrom: this.date(row, 'validFrom'),
        validTo: this.date(row, 'validTo'),
      };
    });
  }

  readMessagingStatistics(buffer: Buffer): MessagingStatisticRow[] {
    return this.readRaw(buffer).map((row) => ({
      connectionStatus: this.str(row, 'connectionStatus'),
      deleted: this.bool(row, 'deleted'),
      lastMessageDown: this.date(row, 'lastMessageDown'),
      lastMessageUp: this.date(row, 'lastMessageUp'),
      localEcpInstanceId: this.str(row, 'localEcpInstanceId'),
      remoteComponentCode: this.str(row, 'remoteComponentCode'),
      sumMessagesDown: this.num(row, 'sumMessagesDown'),
      sumMessagesUp: this.num(row, 'sumMessagesUp'),
    }));
  }
}
```

- [ ] **Step 4: Run test → doit passer**

Run: `pnpm --filter @carto-ecp/api test -- csv-reader`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ingestion/csv-reader.service.ts apps/api/src/ingestion/csv-reader.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): CsvReader pour les 4 CSV exploités du backup (Task 10)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: XmlMadesParser

**Files:**
- Create: `apps/api/src/ingestion/xml-mades-parser.service.ts`
- Create: `apps/api/src/ingestion/xml-mades-parser.service.spec.ts`

- [ ] **Step 1: Écrire les tests `xml-mades-parser.service.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { UnknownMadesNamespaceException } from '../common/errors/ingestion-errors.js';

const VALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:components xmlns:ns2="http://mades.entsoe.eu/componentDirectory">
  <componentList>
    <broker>
      <organization>RTE</organization>
      <person>DSIT</person>
      <email>x@rte.fr</email>
      <phone>000</phone>
      <code>17VRTE-BROKER-01</code>
      <type>BROKER</type>
      <networks><network>internet</network></networks>
      <urls><url network="internet">amqps://10.0.0.1:5671</url></urls>
      <certificates/>
      <creationTimestamp>2025-01-15T13:53:00.163Z</creationTimestamp>
      <modificationTimestamp>2025-01-15T13:53:00.163Z</modificationTimestamp>
      <componentDirectory>17V000002014106G</componentDirectory>
    </broker>
    <endpoint>
      <organization>SwissGrid</organization>
      <person>OPS</person>
      <email>a@sg.ch</email>
      <phone>000</phone>
      <code>10X1001A1001A361</code>
      <type>ENDPOINT</type>
      <networks><network>internet</network></networks>
      <urls/>
      <certificates/>
      <creationTimestamp>2025-01-15T13:53:00.163Z</creationTimestamp>
      <modificationTimestamp>2025-01-15T13:53:00.163Z</modificationTimestamp>
      <componentDirectory>17V000002014106G</componentDirectory>
      <paths>
        <path>
          <senderComponent/>
          <messageType>RSMD</messageType>
          <path>INDIRECT:17VRTE-BROKER-01</path>
          <validFrom>2025-01-01T00:00:00.000Z</validFrom>
          <validTo>2026-01-01T00:00:00.000Z</validTo>
        </path>
        <path>
          <senderComponent>17V000000498771C</senderComponent>
          <messageType>CGM</messageType>
          <path>DIRECT</path>
          <validFrom>2025-01-01T00:00:00.000Z</validFrom>
        </path>
      </paths>
    </endpoint>
  </componentList>
  <metadata>
    <componentDirectoryMetadata>
      <componentDirectory>17V000002014106G</componentDirectory>
      <ttl>86400000</ttl>
      <contentID>42</contentID>
    </componentDirectoryMetadata>
  </metadata>
</ns2:components>`;

describe('XmlMadesParserService', () => {
  const service = new XmlMadesParserService();

  it('parses a valid MADES tree with brokers and endpoints', () => {
    const tree = service.parse(VALID_XML);
    expect(tree.cdCode).toBe('17V000002014106G');
    expect(tree.contentId).toBe(42);
    expect(tree.ttl).toBe(86400000);
    expect(tree.brokers).toHaveLength(1);
    expect(tree.endpoints).toHaveLength(1);
  });

  it('splits INDIRECT:{broker} path correctly', () => {
    const tree = service.parse(VALID_XML);
    const path = tree.endpoints[0].paths[0];
    expect(path.transportPattern).toBe('INDIRECT');
    expect(path.brokerCode).toBe('17VRTE-BROKER-01');
  });

  it('sets brokerCode = null for DIRECT path', () => {
    const tree = service.parse(VALID_XML);
    const directPath = tree.endpoints[0].paths[1];
    expect(directPath.transportPattern).toBe('DIRECT');
    expect(directPath.brokerCode).toBeNull();
  });

  it('treats missing validTo as null (perpetual)', () => {
    const tree = service.parse(VALID_XML);
    const perpetual = tree.endpoints[0].paths[1];
    expect(perpetual.validTo).toBeNull();
  });

  it('treats empty senderComponent as null (equivalent to wildcard)', () => {
    const tree = service.parse(VALID_XML);
    expect(tree.endpoints[0].paths[0].senderComponent).toBeNull();
  });

  it('throws UnknownMadesNamespaceException for wrong namespace', () => {
    const bad = VALID_XML.replace('mades.entsoe.eu', 'other.example.com');
    expect(() => service.parse(bad)).toThrowError(UnknownMadesNamespaceException);
  });

  it('throws UnknownMadesNamespaceException for non-XML input', () => {
    expect(() => service.parse('not xml')).toThrowError(UnknownMadesNamespaceException);
  });

  it('returns empty arrays when componentList is empty', () => {
    const empty = VALID_XML.replace(
      /<componentList>[\s\S]*<\/componentList>/,
      '<componentList/>',
    );
    const tree = service.parse(empty);
    expect(tree.brokers).toEqual([]);
    expect(tree.endpoints).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test → doit échouer**

Run: `pnpm --filter @carto-ecp/api test -- xml-mades-parser`
Expected: FAIL.

- [ ] **Step 3: Implémenter `apps/api/src/ingestion/xml-mades-parser.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { parseEcpDate } from '../common/date-parser.js';
import { UnknownMadesNamespaceException } from '../common/errors/ingestion-errors.js';
import type {
  MadesCertificate,
  MadesComponent,
  MadesPath,
  MadesTree,
} from './types.js';

const MADES_NS = 'http://mades.entsoe.eu/componentDirectory';

type AnyXml = Record<string, unknown>;

@Injectable()
export class XmlMadesParserService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: true,
    isArray: (name) =>
      ['broker', 'endpoint', 'componentDirectory', 'network', 'url', 'certificate', 'path'].includes(name),
    trimValues: true,
  });

  parse(xml: string): MadesTree {
    let doc: AnyXml;
    try {
      doc = this.parser.parse(xml) as AnyXml;
    } catch (err) {
      throw new UnknownMadesNamespaceException(null);
    }

    if (!xml.includes(MADES_NS)) {
      throw new UnknownMadesNamespaceException(this.extractNamespace(xml));
    }

    const components = (doc.components ?? {}) as AnyXml;
    const componentList = (components.componentList ?? {}) as AnyXml;
    const metadata = ((components.metadata as AnyXml)?.componentDirectoryMetadata ??
      {}) as AnyXml;

    const brokersRaw = (componentList.broker as AnyXml[] | undefined) ?? [];
    const endpointsRaw = (componentList.endpoint as AnyXml[] | undefined) ?? [];
    const cdsRaw = (componentList.componentDirectory as AnyXml[] | undefined) ?? [];

    return {
      cdCode: String(metadata.componentDirectory ?? ''),
      contentId: Number(metadata.contentID ?? 0),
      ttl: Number(metadata.ttl ?? 0),
      brokers: brokersRaw.map((b) => this.toComponent(b, 'BROKER')),
      endpoints: endpointsRaw.map((e) => this.toComponent(e, 'ENDPOINT')),
      componentDirectories: cdsRaw.map((c) => this.toComponent(c, 'COMPONENT_DIRECTORY')),
    };
  }

  private toComponent(
    raw: AnyXml,
    type: 'BROKER' | 'ENDPOINT' | 'COMPONENT_DIRECTORY',
  ): MadesComponent {
    const networks = ((raw.networks as AnyXml)?.network as string[] | undefined) ?? [];
    const urlEntries = ((raw.urls as AnyXml)?.url as AnyXml[] | undefined) ?? [];
    const certEntries =
      ((raw.certificates as AnyXml)?.certificate as AnyXml[] | undefined) ?? [];
    const pathEntries = ((raw.paths as AnyXml)?.path as AnyXml[] | undefined) ?? [];

    return {
      organization: String(raw.organization ?? ''),
      personName: String(raw.person ?? ''),
      email: String(raw.email ?? ''),
      phone: String(raw.phone ?? ''),
      code: String(raw.code ?? ''),
      type,
      networks: networks.map(String),
      urls: urlEntries.map((u) => ({
        network: String(u['@_network'] ?? ''),
        url: String(u['#text'] ?? u),
      })),
      certificates: certEntries.map((c) => this.toCertificate(c)),
      creationTs: parseEcpDate(String(raw.creationTimestamp ?? '') || null),
      modificationTs: parseEcpDate(String(raw.modificationTimestamp ?? '') || null),
      homeCdCode: String(raw.componentDirectory ?? ''),
      paths: pathEntries.map((p) => this.toPath(p)),
    };
  }

  private toCertificate(raw: AnyXml): MadesCertificate {
    return {
      certificateID: String(raw.certificateID ?? ''),
      type: String(raw.type ?? ''),
      validFrom: parseEcpDate(String(raw.validFrom ?? '') || null),
      validTo: parseEcpDate(String(raw.validTo ?? '') || null),
    };
  }

  private toPath(raw: AnyXml): MadesPath {
    const pathValue = String(raw.path ?? '').trim();
    let transportPattern: 'DIRECT' | 'INDIRECT' = 'DIRECT';
    let brokerCode: string | null = null;
    if (pathValue.startsWith('INDIRECT:')) {
      transportPattern = 'INDIRECT';
      brokerCode = pathValue.slice('INDIRECT:'.length) || null;
    } else if (pathValue === 'INDIRECT') {
      transportPattern = 'INDIRECT';
    }

    const senderRaw = raw.senderComponent;
    const sender =
      senderRaw == null || senderRaw === '' || typeof senderRaw === 'object'
        ? null
        : String(senderRaw);

    return {
      senderComponent: sender,
      messageType: String(raw.messageType ?? '*'),
      transportPattern,
      brokerCode,
      validFrom: parseEcpDate(String(raw.validFrom ?? '') || null),
      validTo: parseEcpDate(String(raw.validTo ?? '') || null),
    };
  }

  private extractNamespace(xml: string): string | null {
    const m = xml.match(/xmlns(?::[^=]+)?="([^"]+)"/);
    return m ? m[1] : null;
  }
}
```

- [ ] **Step 4: Run test → doit passer**

Run: `pnpm --filter @carto-ecp/api test -- xml-mades-parser`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ingestion/xml-mades-parser.service.ts apps/api/src/ingestion/xml-mades-parser.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): XmlMadesParser avec validation namespace MADES (Task 11)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: NetworkModelBuilder

**Files:**
- Create: `apps/api/src/ingestion/network-model-builder.service.ts`
- Create: `apps/api/src/ingestion/network-model-builder.service.spec.ts`

Ce service fait les choix métier importants : détection `componentType`, enrichissement registry, classification, direction IN/OUT. C'est le cœur de la carto.

- [ ] **Step 1: Écrire les tests `network-model-builder.service.spec.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { RegistryService } from '../registry/registry.service.js';
import { NetworkModelBuilderService } from './network-model-builder.service.js';
import type {
  AppPropertyRow,
  MadesTree,
  MessagePathRow,
  MessagingStatisticRow,
} from './types.js';

const endpointAppProps: AppPropertyRow[] = [
  { key: 'ecp.componentCode', value: '17V000000498771C', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.projectName', value: 'ECP-INTERNET-2', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.envName', value: 'OPF', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.company.organization', value: 'RTE', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.networks', value: 'internet', changedBy: null, createdDate: null, modifiedDate: null },
  {
    key: 'ecp.directory.client.synchronization.homeComponentDirectoryPrimaryCode',
    value: '17V000002014106G',
    changedBy: null, createdDate: null, modifiedDate: null,
  },
];

const cdAppProps: AppPropertyRow[] = [
  { key: 'ecp.componentCode', value: '17V000002014106G', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.envName', value: 'OPF', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.company.organization', value: 'RTE', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.networks', value: 'internet', changedBy: null, createdDate: null, modifiedDate: null },
];

function madesTreeStub(): MadesTree {
  return {
    cdCode: '17V000002014106G',
    contentId: 1,
    ttl: 60000,
    brokers: [
      {
        organization: 'RTE', personName: 'x', email: 'x@rte.fr', phone: '0',
        code: '17VRTE-BROKER-01', type: 'BROKER', networks: ['internet'],
        urls: [{ network: 'internet', url: 'amqps://10.0.0.1:5671' }],
        certificates: [],
        creationTs: new Date('2025-01-01'), modificationTs: new Date('2025-01-01'),
        homeCdCode: '17V000002014106G',
        paths: [],
      },
    ],
    endpoints: [
      {
        organization: 'RTE', personName: 'x', email: 'x@rte.fr', phone: '0',
        code: '17V000000498771C', type: 'ENDPOINT', networks: ['internet'],
        urls: [], certificates: [],
        creationTs: new Date('2025-01-01'), modificationTs: new Date('2025-01-01'),
        homeCdCode: '17V000002014106G',
        paths: [
          { senderComponent: null, messageType: 'RSMD', transportPattern: 'DIRECT', brokerCode: null, validFrom: new Date('2025-01-01'), validTo: null },
        ],
      },
      {
        organization: 'Terna', personName: 'y', email: 'y@terna.it', phone: '0',
        code: '10X1001A1001A345', type: 'ENDPOINT', networks: ['internet'],
        urls: [], certificates: [],
        creationTs: new Date('2025-01-01'), modificationTs: new Date('2025-01-01'),
        homeCdCode: '17V000002014106G',
        paths: [
          { senderComponent: null, messageType: 'CGM', transportPattern: 'INDIRECT', brokerCode: '17VRTE-BROKER-01', validFrom: new Date('2025-01-01'), validTo: null },
        ],
      },
    ],
    componentDirectories: [
      {
        organization: 'RTE', personName: 'x', email: 'x@rte.fr', phone: '0',
        code: '17V000002014106G', type: 'COMPONENT_DIRECTORY',
        networks: ['internet'], urls: [], certificates: [],
        creationTs: new Date('2025-01-01'), modificationTs: new Date('2025-01-01'),
        homeCdCode: '17V000002014106G', paths: [],
      },
    ],
  };
}

describe('NetworkModelBuilderService', () => {
  let service: NetworkModelBuilderService;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      providers: [NetworkModelBuilderService, RegistryService],
    }).compile();
    service = ref.get(NetworkModelBuilderService);
    await ref.get(RegistryService).onModuleInit();
  });

  it('detects componentType=ENDPOINT from appProperties', () => {
    const snap = service.build({
      appProperties: endpointAppProps,
      madesTree: madesTreeStub(),
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    expect(snap.meta.componentType).toBe('ENDPOINT');
    expect(snap.meta.sourceComponentCode).toBe('17V000000498771C');
    expect(snap.meta.cdCode).toBe('17V000002014106G');
    expect(snap.meta.organization).toBe('RTE');
  });

  it('detects componentType=COMPONENT_DIRECTORY', () => {
    const tree = madesTreeStub();
    const snap = service.build({
      appProperties: cdAppProps,
      madesTree: tree,
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    expect(snap.meta.componentType).toBe('COMPONENT_DIRECTORY');
    expect(snap.meta.sourceComponentCode).toBe('17V000002014106G');
    expect(snap.meta.cdCode).toBe('17V000002014106G');
  });

  it('enriches RTE endpoint with overlay coordinates (precise, not default)', () => {
    const snap = service.build({
      appProperties: endpointAppProps,
      madesTree: madesTreeStub(),
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    const rte = snap.components.find((c) => c.eic === '17V000000498771C');
    expect(rte?.isDefaultPosition).toBe(false);
    expect(rte?.lat).toBeCloseTo(48.8918);
  });

  it('assigns direction=IN when receiver is a RTE endpoint, OUT otherwise', () => {
    const tree = madesTreeStub();
    const snap = service.build({
      appProperties: endpointAppProps,
      madesTree: tree,
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    const rsmdPath = snap.messagePaths.find((p) => p.messageType === 'RSMD');
    expect(rsmdPath?.direction).toBe('IN');
    const cgmPath = snap.messagePaths.find((p) => p.messageType === 'CGM');
    expect(cgmPath?.direction).toBe('OUT');
  });

  it('classifies messageType via registry cascade', () => {
    const snap = service.build({
      appProperties: endpointAppProps,
      madesTree: madesTreeStub(),
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    expect(snap.messagePaths.find((p) => p.messageType === 'RSMD')?.process).toBe('VP');
    expect(snap.messagePaths.find((p) => p.messageType === 'CGM')?.process).toBe('CORE');
  });

  it('emits a warning when an EIC falls back to default position', () => {
    const tree = madesTreeStub();
    tree.endpoints.push({
      organization: 'UnknownOrg', personName: 'x', email: '', phone: '',
      code: 'XX-TOTALLY-UNKNOWN', type: 'ENDPOINT', networks: [],
      urls: [], certificates: [],
      creationTs: null, modificationTs: null, homeCdCode: '17V000002014106G',
      paths: [],
    });
    const snap = service.build({
      appProperties: endpointAppProps,
      madesTree: tree,
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    expect(snap.warnings.some((w) => w.code === 'EIC_UNKNOWN_IN_REGISTRY')).toBe(true);
  });

  it('tags a MessagePath as expired when validTo < current time', () => {
    const tree = madesTreeStub();
    tree.endpoints[0].paths = [
      { senderComponent: null, messageType: 'RSMD', transportPattern: 'DIRECT', brokerCode: null, validFrom: new Date('2020-01-01'), validTo: new Date('2021-01-01') },
    ];
    const snap = service.build({
      appProperties: endpointAppProps,
      madesTree: tree,
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    expect(snap.messagePaths[0].isExpired).toBe(true);
  });
});
```

- [ ] **Step 2: Run test → doit échouer**

Run: `pnpm --filter @carto-ecp/api test -- network-model-builder`
Expected: FAIL.

- [ ] **Step 3: Implémenter `apps/api/src/ingestion/network-model-builder.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import type { ComponentType, ProcessKey, Warning } from '@carto-ecp/shared';
import { RegistryService } from '../registry/registry.service.js';
import type {
  AppPropertyRow,
  ComponentRecord,
  MadesComponent,
  MadesTree,
  MessagePathRecord,
  MessagePathRow,
  MessagingStatisticRow,
  NetworkSnapshot,
} from './types.js';

type BuilderInput = {
  appProperties: AppPropertyRow[];
  madesTree: MadesTree;
  messagingStats: MessagingStatisticRow[];
  localMessagePaths: MessagePathRow[];
  envName: string;
};

@Injectable()
export class NetworkModelBuilderService {
  constructor(private readonly registry: RegistryService) {}

  build(input: BuilderInput): NetworkSnapshot {
    const warnings: Warning[] = [];
    const appsMap = new Map(input.appProperties.map((r) => [r.key, r.value] as const));

    const sourceCode = appsMap.get('ecp.componentCode') ?? '';
    const organization = appsMap.get('ecp.company.organization') ?? '';
    const networks = (appsMap.get('ecp.networks') ?? '').split(',').filter(Boolean);
    const cdFromAppProps =
      appsMap.get('ecp.directory.client.synchronization.homeComponentDirectoryPrimaryCode') ??
      null;

    const isCd =
      input.madesTree.componentDirectories.some((c) => c.code === sourceCode) ||
      sourceCode === input.madesTree.cdCode;
    const componentType: ComponentType = isCd ? 'COMPONENT_DIRECTORY' : 'ENDPOINT';
    const cdCode = isCd ? sourceCode : cdFromAppProps ?? input.madesTree.cdCode || null;

    const allMades: MadesComponent[] = [
      ...input.madesTree.brokers,
      ...input.madesTree.endpoints,
      ...input.madesTree.componentDirectories,
    ];

    const rteEicSet = new Set(
      allMades.filter((c) => c.organization === 'RTE' && c.code.startsWith('17V')).map((c) => c.code),
    );

    const components: ComponentRecord[] = allMades.map((raw) => {
      const loc = this.registry.resolveComponent(raw.code, raw.organization);
      if (loc.isDefaultPosition) {
        warnings.push({
          code: 'EIC_UNKNOWN_IN_REGISTRY',
          message: `EIC ${raw.code} (org ${raw.organization}) non trouvé dans le registry, position par défaut Bruxelles`,
          context: { eic: raw.code, organization: raw.organization },
        });
      }
      const overlayRte = this.registry.getOverlay().rteEndpoints.find((e) => e.eic === raw.code);
      return {
        eic: raw.code,
        type: raw.type,
        organization: raw.organization,
        personName: raw.personName || null,
        email: raw.email || null,
        phone: raw.phone || null,
        homeCdCode: raw.homeCdCode,
        networks: raw.networks,
        urls: raw.urls,
        creationTs: raw.creationTs,
        modificationTs: raw.modificationTs,
        displayName: loc.displayName,
        country: loc.country,
        lat: loc.lat,
        lng: loc.lng,
        isDefaultPosition: loc.isDefaultPosition,
        process: overlayRte ? overlayRte.process : null,
        sourceType: 'XML_CD',
      };
    });

    const snapshotTime = Date.now();
    const xmlPaths: MessagePathRecord[] = [];
    for (const ep of input.madesTree.endpoints) {
      for (const p of ep.paths) {
        const process = this.registry.classifyMessageType(p.messageType);
        if (process === 'UNKNOWN' && p.messageType !== '*') {
          warnings.push({
            code: 'MESSAGE_TYPE_UNCLASSIFIED',
            message: `messageType "${p.messageType}" non classé, fallback UNKNOWN`,
            context: { messageType: p.messageType },
          });
        }
        const direction: 'IN' | 'OUT' = rteEicSet.has(ep.code) ? 'IN' : 'OUT';
        const isExpired = p.validTo != null && p.validTo.getTime() < snapshotTime;
        xmlPaths.push({
          receiverEic: ep.code,
          senderEicOrWildcard: p.senderComponent ?? '*',
          messageType: p.messageType,
          transportPattern: p.transportPattern,
          intermediateBrokerEic: p.brokerCode,
          validFrom: p.validFrom,
          validTo: p.validTo,
          process,
          direction,
          source: 'XML_CD_PATHS',
          isExpired,
        });
      }
    }

    const localPaths: MessagePathRecord[] = input.localMessagePaths
      .filter((r) => r.receiver != null && r.messageType != null && r.transportPattern != null)
      .map((r) => {
        const process = this.registry.classifyMessageType(r.messageType ?? '*');
        const direction: 'IN' | 'OUT' = rteEicSet.has(r.receiver ?? '') ? 'IN' : 'OUT';
        const isExpired = r.validTo != null && r.validTo.getTime() < snapshotTime;
        return {
          receiverEic: r.receiver ?? '',
          senderEicOrWildcard: r.allowedSenders ?? '*',
          messageType: r.messageType ?? '*',
          transportPattern: r.transportPattern ?? 'DIRECT',
          intermediateBrokerEic: r.intermediateBrokerCode,
          validFrom: r.validFrom,
          validTo: r.validTo,
          process,
          direction,
          source: 'LOCAL_CSV_PATHS' as const,
          isExpired,
        };
      });

    return {
      meta: {
        envName: input.envName,
        componentType,
        sourceComponentCode: sourceCode,
        cdCode,
        organization,
        networks,
      },
      components,
      messagePaths: [...xmlPaths, ...localPaths],
      messagingStats: input.messagingStats,
      appProperties: input.appProperties,
      warnings,
    };
  }
}
```

- [ ] **Step 4: Run test → doit passer**

Run: `pnpm --filter @carto-ecp/api test -- network-model-builder`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ingestion/network-model-builder.service.ts apps/api/src/ingestion/network-model-builder.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): NetworkModelBuilder avec détection ENDPOINT/CD et enrichissement (Task 12)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: SnapshotPersister + IngestionModule

**Files:**
- Create: `apps/api/src/ingestion/snapshot-persister.service.ts`
- Create: `apps/api/src/ingestion/ingestion.module.ts`
- Create: `apps/api/src/ingestion/ingestion.service.ts`

- [ ] **Step 1: Créer `apps/api/src/ingestion/snapshot-persister.service.ts`**

```ts
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service.js';
import type { IngestionResult, NetworkSnapshot } from './types.js';

const STORAGE_DIR = join(process.cwd(), 'storage', 'snapshots');

@Injectable()
export class SnapshotPersisterService {
  constructor(private readonly prisma: PrismaService) {}

  async persist(
    snapshot: NetworkSnapshot,
    zipBuffer: Buffer,
    label: string,
  ): Promise<IngestionResult> {
    const snapshotId = uuid();
    const zipPath = join(STORAGE_DIR, `${snapshotId}.zip`);
    await mkdir(dirname(zipPath), { recursive: true });
    await writeFile(zipPath, zipBuffer);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.snapshot.create({
          data: {
            id: snapshotId,
            label,
            envName: snapshot.meta.envName,
            componentType: snapshot.meta.componentType,
            sourceComponentCode: snapshot.meta.sourceComponentCode,
            cdCode: snapshot.meta.cdCode,
            organization: snapshot.meta.organization,
            zipPath,
            warningsJson: JSON.stringify(snapshot.warnings),
          },
        });

        for (const c of snapshot.components) {
          await tx.component.create({
            data: {
              snapshotId,
              eic: c.eic,
              type: c.type,
              organization: c.organization,
              personName: c.personName,
              email: c.email,
              phone: c.phone,
              homeCdCode: c.homeCdCode,
              networksCsv: c.networks.join(','),
              creationTs: c.creationTs,
              modificationTs: c.modificationTs,
              displayName: c.displayName,
              country: c.country,
              lat: c.lat,
              lng: c.lng,
              isDefaultPosition: c.isDefaultPosition,
              process: c.process,
              sourceType: c.sourceType,
              urls: { create: c.urls.map((u) => ({ network: u.network, url: u.url })) },
            },
          });
        }

        if (snapshot.messagePaths.length > 0) {
          await tx.messagePath.createMany({
            data: snapshot.messagePaths.map((p) => ({
              snapshotId,
              receiverEic: p.receiverEic,
              senderEicOrWildcard: p.senderEicOrWildcard,
              messageType: p.messageType,
              transportPattern: p.transportPattern,
              intermediateBrokerEic: p.intermediateBrokerEic,
              validFrom: p.validFrom,
              validTo: p.validTo,
              process: p.process,
              direction: p.direction,
              source: p.source,
              isExpired: p.isExpired,
            })),
          });
        }

        if (snapshot.messagingStats.length > 0) {
          await tx.messagingStatistic.createMany({
            data: snapshot.messagingStats.map((s) => ({
              snapshotId,
              sourceEndpointCode: snapshot.meta.sourceComponentCode,
              remoteComponentCode: s.remoteComponentCode ?? '',
              connectionStatus: s.connectionStatus,
              lastMessageUp: s.lastMessageUp,
              lastMessageDown: s.lastMessageDown,
              sumMessagesUp: s.sumMessagesUp ?? 0,
              sumMessagesDown: s.sumMessagesDown ?? 0,
              deleted: s.deleted ?? false,
            })),
          });
        }

        if (snapshot.appProperties.length > 0) {
          await tx.appProperty.createMany({
            data: this.filterSensitive(snapshot.appProperties).map((p) => ({
              snapshotId,
              key: p.key,
              value: p.value ?? '',
            })),
          });
        }
      });
    } catch (err) {
      await unlink(zipPath).catch(() => undefined);
      throw err;
    }

    return {
      snapshotId,
      componentType: snapshot.meta.componentType,
      sourceComponentCode: snapshot.meta.sourceComponentCode,
      cdCode: snapshot.meta.cdCode,
      warnings: snapshot.warnings,
    };
  }

  private filterSensitive(
    props: NetworkSnapshot['appProperties'],
  ): NetworkSnapshot['appProperties'] {
    const deny = /password|secret|keystore\.password|privateKey|credentials/i;
    return props.filter((p) => !deny.test(p.key));
  }
}
```

- [ ] **Step 2: Créer `apps/api/src/ingestion/ingestion.service.ts`** (orchestration)

```ts
import { Injectable, Logger } from '@nestjs/common';
import { CsvReaderService } from './csv-reader.service.js';
import { NetworkModelBuilderService } from './network-model-builder.service.js';
import { SnapshotPersisterService } from './snapshot-persister.service.js';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { ZipExtractorService } from './zip-extractor.service.js';
import type { IngestionInput, IngestionResult } from './types.js';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly zipExtractor: ZipExtractorService,
    private readonly csvReader: CsvReaderService,
    private readonly xmlParser: XmlMadesParserService,
    private readonly builder: NetworkModelBuilderService,
    private readonly persister: SnapshotPersisterService,
  ) {}

  async ingest(input: IngestionInput): Promise<IngestionResult> {
    const startedAt = Date.now();
    this.logger.log(`ingestion.started (${input.zipBuffer.length} bytes)`);

    const extracted = this.zipExtractor.extract(input.zipBuffer);
    const appProperties = this.csvReader.readApplicationProperties(
      extracted.files.get('application_property.csv')!,
    );
    const componentDirectoryRows = this.csvReader.readComponentDirectory(
      extracted.files.get('component_directory.csv')!,
    );
    if (componentDirectoryRows.length === 0) {
      throw new Error('component_directory.csv contient aucune ligne de data');
    }
    const xmlBlob = componentDirectoryRows[0].directoryContent;
    const madesTree = this.xmlParser.parse(xmlBlob);

    const messagePathsBuf = extracted.files.get('message_path.csv');
    const statsBuf = extracted.files.get('messaging_statistics.csv');

    const localMessagePaths = messagePathsBuf ? this.csvReader.readMessagePaths(messagePathsBuf) : [];
    const messagingStats = statsBuf ? this.csvReader.readMessagingStatistics(statsBuf) : [];

    const networkSnapshot = this.builder.build({
      appProperties,
      madesTree,
      messagingStats,
      localMessagePaths,
      envName: input.envName,
    });

    const result = await this.persister.persist(networkSnapshot, input.zipBuffer, input.label);
    const duration = Date.now() - startedAt;
    this.logger.log(
      `ingestion.completed snapshotId=${result.snapshotId} components=${networkSnapshot.components.length} paths=${networkSnapshot.messagePaths.length} warnings=${networkSnapshot.warnings.length} duration=${duration}ms`,
    );
    return result;
  }
}
```

- [ ] **Step 3: Créer `apps/api/src/ingestion/ingestion.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { CsvReaderService } from './csv-reader.service.js';
import { IngestionService } from './ingestion.service.js';
import { NetworkModelBuilderService } from './network-model-builder.service.js';
import { SnapshotPersisterService } from './snapshot-persister.service.js';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { ZipExtractorService } from './zip-extractor.service.js';

@Module({
  providers: [
    ZipExtractorService,
    CsvReaderService,
    XmlMadesParserService,
    NetworkModelBuilderService,
    SnapshotPersisterService,
    IngestionService,
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
```

- [ ] **Step 4: Enregistrer `IngestionModule` dans `AppModule`**

Ajouter `import { IngestionModule } from './ingestion/ingestion.module.js';` et l'ajouter aux imports.

- [ ] **Step 5: Vérifier build**

Run: `pnpm --filter @carto-ecp/api build`
Expected: pas d'erreur TS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ingestion/snapshot-persister.service.ts apps/api/src/ingestion/ingestion.service.ts apps/api/src/ingestion/ingestion.module.ts apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): SnapshotPersister + IngestionService orchestration (Task 13)

Transaction Prisma + archive zip + blacklist clés sensibles.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: SnapshotsController (POST + GET list + GET detail)

**Files:**
- Create: `apps/api/src/snapshots/dto/create-snapshot.dto.ts`
- Create: `apps/api/src/snapshots/snapshots.service.ts`
- Create: `apps/api/src/snapshots/snapshots.controller.ts`
- Create: `apps/api/src/snapshots/snapshots.module.ts`

- [ ] **Step 1: Créer `apps/api/src/snapshots/dto/create-snapshot.dto.ts`**

```ts
import { z } from 'zod';

export const createSnapshotSchema = z.object({
  label: z.string().trim().min(1).max(200),
  envName: z.string().trim().min(1).max(50),
});

export type CreateSnapshotDto = z.infer<typeof createSnapshotSchema>;
```

- [ ] **Step 2: Créer `apps/api/src/snapshots/snapshots.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import type { SnapshotDetail, SnapshotSummary, Warning } from '@carto-ecp/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { SnapshotNotFoundException } from '../common/errors/ingestion-errors.js';

@Injectable()
export class SnapshotsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(envName?: string): Promise<SnapshotSummary[]> {
    const rows = await this.prisma.snapshot.findMany({
      where: envName ? { envName } : undefined,
      orderBy: { uploadedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      envName: r.envName,
      componentType: r.componentType as SnapshotSummary['componentType'],
      sourceComponentCode: r.sourceComponentCode,
      cdCode: r.cdCode,
      uploadedAt: r.uploadedAt.toISOString(),
      warningCount: (JSON.parse(r.warningsJson) as Warning[]).length,
    }));
  }

  async detail(id: string): Promise<SnapshotDetail> {
    const row = await this.prisma.snapshot.findUnique({
      where: { id },
      include: {
        _count: { select: { components: true, messagePaths: true, messagingStats: true } },
      },
    });
    if (!row) throw new SnapshotNotFoundException(id);
    const warnings = JSON.parse(row.warningsJson) as Warning[];
    return {
      id: row.id,
      label: row.label,
      envName: row.envName,
      componentType: row.componentType as SnapshotDetail['componentType'],
      sourceComponentCode: row.sourceComponentCode,
      cdCode: row.cdCode,
      uploadedAt: row.uploadedAt.toISOString(),
      warningCount: warnings.length,
      organization: row.organization,
      stats: {
        componentsCount: row._count.components,
        pathsCount: row._count.messagePaths,
        statsCount: row._count.messagingStats,
      },
      warnings,
    };
  }
}
```

- [ ] **Step 3: Créer `apps/api/src/snapshots/snapshots.controller.ts`**

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IngestionService } from '../ingestion/ingestion.service.js';
import { InvalidUploadException } from '../common/errors/ingestion-errors.js';
import { createSnapshotSchema } from './dto/create-snapshot.dto.js';
import { SnapshotsService } from './snapshots.service.js';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ZIP_MIME = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
]);
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

@Controller('snapshots')
export class SnapshotsController {
  constructor(
    private readonly ingestion: IngestionService,
    private readonly snapshots: SnapshotsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('zip', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!ZIP_MIME.has(file.mimetype)) {
          cb(new InvalidUploadException('MIME type non autorisé', { mimetype: file.mimetype }), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, string>,
  ) {
    if (!file) throw new InvalidUploadException('Fichier zip manquant');
    if (file.buffer.subarray(0, 4).compare(ZIP_MAGIC) !== 0) {
      throw new InvalidUploadException('Signature ZIP invalide (magic bytes)');
    }

    const parsed = createSnapshotSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidUploadException('Champs label/envName invalides', {
        issues: parsed.error.issues,
      });
    }

    const result = await this.ingestion.ingest({
      zipBuffer: file.buffer,
      label: parsed.data.label,
      envName: parsed.data.envName,
    });
    return this.snapshots.detail(result.snapshotId);
  }

  @Get()
  list(@Query('envName') envName?: string) {
    return this.snapshots.list(envName);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.snapshots.detail(id);
  }
}
```

- [ ] **Step 4: Créer `apps/api/src/snapshots/snapshots.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { IngestionModule } from '../ingestion/ingestion.module.js';
import { SnapshotsController } from './snapshots.controller.js';
import { SnapshotsService } from './snapshots.service.js';

@Module({
  imports: [IngestionModule],
  controllers: [SnapshotsController],
  providers: [SnapshotsService],
  exports: [SnapshotsService],
})
export class SnapshotsModule {}
```

- [ ] **Step 5: Enregistrer `SnapshotsModule` dans `AppModule`**

Ajouter `import { SnapshotsModule } from './snapshots/snapshots.module.js';` et l'ajouter aux imports.

- [ ] **Step 6: Vérifier build**

Run: `pnpm --filter @carto-ecp/api build`
Expected: pas d'erreur TS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/snapshots apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): SnapshotsController POST + GET list/detail (Task 14)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: GraphService (agrégation edges)

**Files:**
- Create: `apps/api/src/graph/graph.service.ts`
- Create: `apps/api/src/graph/graph.service.spec.ts`
- Create: `apps/api/src/graph/graph.controller.ts`
- Create: `apps/api/src/graph/graph.module.ts`

- [ ] **Step 1: Écrire les tests `graph.service.spec.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';
import { GraphService } from './graph.service.js';
import type { Component, MessagePath, MessagingStatistic, Snapshot } from '@prisma/client';

function makeComponent(overrides: Partial<Component>): Component {
  return {
    id: overrides.id ?? 'c1',
    snapshotId: overrides.snapshotId ?? 's1',
    eic: overrides.eic ?? 'EIC1',
    type: overrides.type ?? 'ENDPOINT',
    organization: overrides.organization ?? 'RTE',
    personName: overrides.personName ?? null,
    email: overrides.email ?? null,
    phone: overrides.phone ?? null,
    homeCdCode: overrides.homeCdCode ?? '',
    networksCsv: overrides.networksCsv ?? 'internet',
    creationTs: overrides.creationTs ?? new Date('2025-01-01'),
    modificationTs: overrides.modificationTs ?? new Date('2025-01-01'),
    displayName: overrides.displayName ?? 'X',
    country: overrides.country ?? 'FR',
    lat: overrides.lat ?? 48.9,
    lng: overrides.lng ?? 2.2,
    isDefaultPosition: overrides.isDefaultPosition ?? false,
    process: overrides.process ?? null,
    sourceType: overrides.sourceType ?? 'XML_CD',
  };
}

function makeMessagePath(overrides: Partial<MessagePath>): MessagePath {
  return {
    id: overrides.id ?? 'p1',
    snapshotId: overrides.snapshotId ?? 's1',
    receiverEic: overrides.receiverEic ?? 'EIC1',
    senderEicOrWildcard: overrides.senderEicOrWildcard ?? '*',
    messageType: overrides.messageType ?? 'RSMD',
    transportPattern: overrides.transportPattern ?? 'DIRECT',
    intermediateBrokerEic: overrides.intermediateBrokerEic ?? null,
    validFrom: overrides.validFrom ?? new Date('2025-01-01'),
    validTo: overrides.validTo ?? null,
    process: overrides.process ?? 'VP',
    direction: overrides.direction ?? 'IN',
    source: overrides.source ?? 'XML_CD_PATHS',
    isExpired: overrides.isExpired ?? false,
  };
}

describe('GraphService', () => {
  let service: GraphService;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      providers: [
        GraphService,
        RegistryService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    service = ref.get(GraphService);
    await ref.get(RegistryService).onModuleInit();
  });

  it('aggregates 2 paths with same process into 1 edge', () => {
    const snap = { id: 's1', uploadedAt: new Date() } as Snapshot;
    const components = [
      makeComponent({ eic: 'A', displayName: 'A' }),
      makeComponent({ eic: 'B', displayName: 'B' }),
    ];
    const paths = [
      makeMessagePath({ receiverEic: 'A', messageType: 'RSMD', process: 'VP', senderEicOrWildcard: 'B' }),
      makeMessagePath({ receiverEic: 'A', messageType: 'CAPVP', process: 'VP', senderEicOrWildcard: 'B' }),
    ];
    const graph = service.buildGraph(snap, components, paths, []);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].process).toBe('VP');
    expect(graph.edges[0].messageTypes.sort()).toEqual(['CAPVP', 'RSMD']);
  });

  it('skips paths where sender or receiver is a wildcard', () => {
    const snap = { id: 's1', uploadedAt: new Date() } as Snapshot;
    const components = [makeComponent({ eic: 'A' })];
    const paths = [makeMessagePath({ receiverEic: 'A', senderEicOrWildcard: '*' })];
    const graph = service.buildGraph(snap, components, paths, []);
    expect(graph.edges).toHaveLength(0);
  });

  it('marks edge as MIXTE when multiple processes coexist for same pair', () => {
    const snap = { id: 's1', uploadedAt: new Date() } as Snapshot;
    const components = [
      makeComponent({ eic: 'A' }),
      makeComponent({ eic: 'B' }),
    ];
    const paths = [
      makeMessagePath({ receiverEic: 'A', messageType: 'RSMD', process: 'VP', senderEicOrWildcard: 'B' }),
      makeMessagePath({ receiverEic: 'A', messageType: 'CGM', process: 'CORE', senderEicOrWildcard: 'B' }),
    ];
    const graph = service.buildGraph(snap, components, paths, []);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].process).toBe('MIXTE');
  });

  it('sets isRecent=true when lastMessageUp is within 24h of snapshot date', () => {
    const snapDate = new Date('2026-04-17T12:00:00.000Z');
    const snap = { id: 's1', uploadedAt: snapDate } as Snapshot;
    const components = [makeComponent({ eic: 'A' }), makeComponent({ eic: 'B' })];
    const paths = [makeMessagePath({ receiverEic: 'A', senderEicOrWildcard: 'B' })];
    const stats: MessagingStatistic[] = [
      {
        id: 's1-stat',
        snapshotId: 's1',
        sourceEndpointCode: 'A',
        remoteComponentCode: 'B',
        connectionStatus: 'CONNECTED',
        lastMessageUp: new Date('2026-04-17T08:00:00.000Z'),
        lastMessageDown: null,
        sumMessagesUp: 10,
        sumMessagesDown: 0,
        deleted: false,
      },
    ];
    const graph = service.buildGraph(snap, components, paths, stats);
    expect(graph.edges[0].activity.isRecent).toBe(true);
  });

  it('computes bounds from component positions with padding', () => {
    const snap = { id: 's1', uploadedAt: new Date() } as Snapshot;
    const components = [
      makeComponent({ eic: 'A', lat: 48.9, lng: 2.2 }),
      makeComponent({ eic: 'B', lat: 41.9, lng: 12.5 }),
    ];
    const graph = service.buildGraph(snap, components, [], []);
    expect(graph.bounds.north).toBeGreaterThanOrEqual(48.9);
    expect(graph.bounds.south).toBeLessThanOrEqual(41.9);
    expect(graph.bounds.east).toBeGreaterThanOrEqual(12.5);
    expect(graph.bounds.west).toBeLessThanOrEqual(2.2);
  });
});
```

- [ ] **Step 2: Run test → doit échouer**

Run: `pnpm --filter @carto-ecp/api test -- graph.service`
Expected: FAIL.

- [ ] **Step 3: Implémenter `apps/api/src/graph/graph.service.ts`**

```ts
import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  GraphBounds,
  GraphEdge,
  GraphNode,
  GraphResponse,
  NodeKind,
  ProcessKey,
} from '@carto-ecp/shared';
import type { Component, MessagePath, MessagingStatistic, Snapshot } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';
import { SnapshotNotFoundException } from '../common/errors/ingestion-errors.js';

@Injectable()
export class GraphService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RegistryService,
  ) {}

  async getGraph(snapshotId: string): Promise<GraphResponse> {
    const snapshot = await this.prisma.snapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshot) throw new SnapshotNotFoundException(snapshotId);

    const [components, paths, stats] = await Promise.all([
      this.prisma.component.findMany({
        where: { snapshotId },
        include: { urls: true },
      }),
      this.prisma.messagePath.findMany({ where: { snapshotId } }),
      this.prisma.messagingStatistic.findMany({ where: { snapshotId } }),
    ]);

    return this.buildGraph(snapshot, components, paths, stats);
  }

  buildGraph(
    snapshot: Snapshot,
    components: (Component & { urls?: { network: string; url: string }[] })[],
    paths: MessagePath[],
    stats: MessagingStatistic[],
  ): GraphResponse {
    const nodes = components.map((c) => this.toNode(c));
    const statKey = (source: string, remote: string) => `${source}::${remote}`;
    const statsMap = new Map<string, MessagingStatistic>();
    for (const s of stats) {
      statsMap.set(statKey(s.sourceEndpointCode, s.remoteComponentCode), s);
    }

    type Group = {
      fromEic: string;
      toEic: string;
      direction: 'IN' | 'OUT';
      processes: Set<ProcessKey>;
      messageTypes: Set<string>;
      transports: Set<'DIRECT' | 'INDIRECT'>;
      intermediateBroker: string | null;
      validFrom: Date | null;
      validTo: Date | null;
    };
    const groups = new Map<string, Group>();

    for (const p of paths) {
      const fromEic = p.direction === 'IN' ? p.senderEicOrWildcard : p.receiverEic;
      const toEic = p.direction === 'IN' ? p.receiverEic : p.senderEicOrWildcard;
      if (fromEic === '*' || toEic === '*') continue;
      const key = `${fromEic}::${toEic}`;
      const existing = groups.get(key);
      const process = p.process as ProcessKey;
      if (existing) {
        existing.processes.add(process);
        existing.messageTypes.add(p.messageType);
        existing.transports.add(p.transportPattern as 'DIRECT' | 'INDIRECT');
      } else {
        groups.set(key, {
          fromEic,
          toEic,
          direction: p.direction as 'IN' | 'OUT',
          processes: new Set([process]),
          messageTypes: new Set([p.messageType]),
          transports: new Set([p.transportPattern as 'DIRECT' | 'INDIRECT']),
          intermediateBroker: p.intermediateBrokerEic,
          validFrom: p.validFrom,
          validTo: p.validTo,
        });
      }
    }

    const edges: GraphEdge[] = Array.from(groups.values()).map((g) => {
      const processes = Array.from(g.processes);
      const process: ProcessKey = processes.length > 1 ? 'MIXTE' : processes[0];
      const hash = createHash('sha1')
        .update(`${g.fromEic}|${g.toEic}|${process}`)
        .digest('hex')
        .slice(0, 16);
      const stat =
        statsMap.get(statKey(g.fromEic, g.toEic)) ??
        statsMap.get(statKey(g.toEic, g.fromEic)) ??
        null;
      const snapshotTime = snapshot.uploadedAt.getTime();
      const isRecent =
        stat?.lastMessageUp != null &&
        snapshotTime - stat.lastMessageUp.getTime() < 24 * 60 * 60 * 1000 &&
        snapshotTime - stat.lastMessageUp.getTime() >= 0;

      return {
        id: hash,
        fromEic: g.fromEic,
        toEic: g.toEic,
        direction: g.direction,
        process,
        messageTypes: Array.from(g.messageTypes),
        transportPatterns: Array.from(g.transports),
        intermediateBrokerEic: g.intermediateBroker,
        activity: {
          connectionStatus: stat?.connectionStatus ?? null,
          lastMessageUp: stat?.lastMessageUp?.toISOString() ?? null,
          lastMessageDown: stat?.lastMessageDown?.toISOString() ?? null,
          isRecent: Boolean(isRecent),
        },
        validFrom: (g.validFrom ?? new Date(0)).toISOString(),
        validTo: g.validTo?.toISOString() ?? null,
      };
    });

    return { bounds: this.computeBounds(nodes), nodes, edges };
  }

  private toNode(
    c: Component & { urls?: { network: string; url: string }[] },
  ): GraphNode {
    return {
      id: c.eic,
      eic: c.eic,
      kind: this.kindOf(c),
      displayName: c.displayName,
      organization: c.organization,
      country: c.country,
      lat: c.lat,
      lng: c.lng,
      isDefaultPosition: c.isDefaultPosition,
      networks: c.networksCsv ? c.networksCsv.split(',') : [],
      process: c.process as ProcessKey | null,
      urls: (c.urls ?? []).map((u) => ({ network: u.network, url: u.url })),
      creationTs: (c.creationTs ?? new Date(0)).toISOString(),
      modificationTs: (c.modificationTs ?? new Date(0)).toISOString(),
    };
  }

  private kindOf(c: Component): NodeKind {
    const isRte = c.organization === 'RTE' && c.eic.startsWith('17V');
    if (c.type === 'BROKER') return 'BROKER';
    if (c.type === 'COMPONENT_DIRECTORY') return isRte ? 'RTE_CD' : 'EXTERNAL_CD';
    return isRte ? 'RTE_ENDPOINT' : 'EXTERNAL_ENDPOINT';
  }

  private computeBounds(nodes: GraphNode[]): GraphBounds {
    if (nodes.length === 0) {
      return { north: 60, south: 40, east: 20, west: -10 };
    }
    let north = -90, south = 90, east = -180, west = 180;
    for (const n of nodes) {
      if (n.lat > north) north = n.lat;
      if (n.lat < south) south = n.lat;
      if (n.lng > east) east = n.lng;
      if (n.lng < west) west = n.lng;
    }
    const pad = 2;
    return { north: north + pad, south: south - pad, east: east + pad, west: west - pad };
  }
}
```

- [ ] **Step 4: Run test → doit passer**

Run: `pnpm --filter @carto-ecp/api test -- graph.service`
Expected: PASS, 4 tests.

- [ ] **Step 5: Créer `apps/api/src/graph/graph.controller.ts`**

```ts
import { Controller, Get, Param } from '@nestjs/common';
import { GraphService } from './graph.service.js';

@Controller('snapshots')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get(':id/graph')
  getGraph(@Param('id') id: string) {
    return this.graphService.getGraph(id);
  }
}
```

- [ ] **Step 6: Créer `apps/api/src/graph/graph.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { GraphController } from './graph.controller.js';
import { GraphService } from './graph.service.js';

@Module({
  controllers: [GraphController],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule {}
```

- [ ] **Step 7: Enregistrer `GraphModule` dans `AppModule`**

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/graph apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): GraphService agrégation edges + MIXTE + bounds (Task 15)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Tests d'intégration (Endpoint + CD)

**Files:**
- Create: `apps/api/test/fixtures-loader.ts`
- Create: `apps/api/test/full-ingestion-endpoint.spec.ts`
- Create: `apps/api/test/full-ingestion-cd.spec.ts`

- [ ] **Step 1: Créer `apps/api/test/fixtures-loader.ts`**

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';

const REPO_ROOT = join(process.cwd(), '..', '..');
const FIXTURES_ROOT = join(REPO_ROOT, 'tests', 'fixtures');
const INGESTED_FILES = new Set([
  'application_property.csv',
  'component_directory.csv',
  'message_path.csv',
  'messaging_statistics.csv',
  'message_type.csv',
  'message_upload_route.csv',
  'component_statistics.csv',
  'synchronized_directories.csv',
  'pending_edit_directories.csv',
  'pending_removal_directories.csv',
]);

export function buildZipFromFixture(folderName: string): Buffer {
  const dir = join(FIXTURES_ROOT, folderName);
  const zip = new AdmZip();
  for (const entry of readdirSync(dir)) {
    if (!INGESTED_FILES.has(entry)) continue;
    zip.addFile(entry, readFileSync(join(dir, entry)));
  }
  return zip.toBuffer();
}

export const ENDPOINT_FIXTURE = '17V000000498771C_2026-04-17T21_27_17Z';
export const CD_FIXTURE = '17V000002014106G_2026-04-17T22_11_50Z';
```

- [ ] **Step 2: Créer `apps/api/test/full-ingestion-endpoint.spec.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE } from './fixtures-loader.js';

describe('Full ingestion — Endpoint', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = ref.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.snapshot.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  it('ingests the Endpoint backup and exposes a graph', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', 'Test Endpoint')
      .field('envName', 'OPF')
      .attach('zip', zip, { filename: 'endpoint.zip', contentType: 'application/zip' })
      .expect(201);

    expect(res.body.componentType).toBe('ENDPOINT');
    expect(res.body.sourceComponentCode).toBe('17V000000498771C');
    expect(res.body.cdCode).toBe('17V000002014106G');
    expect(res.body.stats.componentsCount).toBeGreaterThan(0);

    const graphRes = await request(app.getHttpServer())
      .get(`/api/snapshots/${res.body.id}/graph`)
      .expect(200);
    expect(graphRes.body.nodes.length).toBeGreaterThan(0);
    expect(graphRes.body.bounds.north).toBeGreaterThan(graphRes.body.bounds.south);
    for (const node of graphRes.body.nodes) {
      expect(Number.isFinite(node.lat)).toBe(true);
      expect(Number.isFinite(node.lng)).toBe(true);
    }
  });

  it('does not persist sensitive files (KeyStore / RegistrationStore)', async () => {
    const snapshots = await prisma.snapshot.findMany();
    const props = await prisma.appProperty.findMany({
      where: { snapshotId: snapshots[0].id },
    });
    for (const p of props) {
      expect(p.key).not.toMatch(/password|secret|privateKey/i);
    }
  });
});
```

- [ ] **Step 3: Créer `apps/api/test/full-ingestion-cd.spec.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, CD_FIXTURE } from './fixtures-loader.js';

describe('Full ingestion — Component Directory', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = ref.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.snapshot.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  it('ingests the CD backup and detects componentType=COMPONENT_DIRECTORY', async () => {
    const zip = buildZipFromFixture(CD_FIXTURE);
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', 'Test CD')
      .field('envName', 'OPF')
      .attach('zip', zip, { filename: 'cd.zip', contentType: 'application/zip' })
      .expect(201);

    expect(res.body.componentType).toBe('COMPONENT_DIRECTORY');
    expect(res.body.sourceComponentCode).toBe('17V000002014106G');
    expect(res.body.cdCode).toBe('17V000002014106G');

    const graphRes = await request(app.getHttpServer())
      .get(`/api/snapshots/${res.body.id}/graph`)
      .expect(200);
    const hasCdNode = graphRes.body.nodes.some(
      (n: { kind: string; eic: string }) => n.kind === 'RTE_CD' && n.eic === '17V000002014106G',
    );
    expect(hasCdNode).toBe(true);
  });
});
```

- [ ] **Step 4: Run les tests d'intégration**

Run: `pnpm --filter @carto-ecp/api test -- full-ingestion`
Expected: PASS, 3 tests au total (2 Endpoint + 1 CD).

- [ ] **Step 5: Commit**

```bash
git add apps/api/test
git commit -m "$(cat <<'EOF'
test(api): intégration full-ingestion Endpoint + CD contre fixtures réelles (Task 16)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase C — Frontend (React + Vite + Leaflet)

### Task 17: Scaffold `apps/web` (Vite + React + Tailwind)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.cjs`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles/globals.css`
- Create: `apps/web/components.json` (shadcn/ui config)

- [ ] **Step 1: Créer `apps/web/package.json`**

```json
{
  "name": "@carto-ecp/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 5173",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "@carto-ecp/shared": "workspace:*",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.1",
    "@radix-ui/react-tooltip": "^1.1.3",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "leaflet": "^1.9.4",
    "leaflet-curve": "^1.0.0",
    "lucide-react": "^0.452.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-dropzone": "^14.2.9",
    "react-leaflet": "^4.2.1",
    "react-router-dom": "^6.26.2",
    "tailwind-merge": "^2.5.3",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@types/leaflet": "^1.9.12",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.5.4",
    "vite": "^5.4.8",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Créer `apps/web/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

- [ ] **Step 3: Créer `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Créer `apps/web/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Créer `apps/web/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rte: '#e30613',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 6: Créer `apps/web/postcss.config.cjs`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: Créer `apps/web/src/styles/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import 'leaflet/dist/leaflet.css';

html, body, #root {
  height: 100%;
  margin: 0;
  font-family: Inter, system-ui, sans-serif;
}
```

- [ ] **Step 8: Créer `apps/web/index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Carto ECP — RTE</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Créer `apps/web/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

- [ ] **Step 10: Créer `apps/web/src/App.tsx`**

```tsx
import { Navigate, Route, Routes } from 'react-router-dom';
import { UploadPage } from './pages/UploadPage.js';
import { MapPage } from './pages/MapPage.js';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/upload" replace />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/map" element={<MapPage />} />
    </Routes>
  );
}
```

- [ ] **Step 11: Créer des placeholders `UploadPage` et `MapPage`** (à implémenter dans les tasks suivantes)

Créer `apps/web/src/pages/UploadPage.tsx` :

```tsx
export function UploadPage(): JSX.Element {
  return <div className="p-6">Upload (à implémenter — Task 19)</div>;
}
```

Créer `apps/web/src/pages/MapPage.tsx` :

```tsx
export function MapPage(): JSX.Element {
  return <div className="p-6">Carte (à implémenter — Task 20)</div>;
}
```

- [ ] **Step 12: Installer et vérifier**

Run: `pnpm install`
Expected: succès.

Run: `pnpm --filter @carto-ecp/web build`
Expected: `dist/` créé sans erreur.

- [ ] **Step 13: Commit**

```bash
git add apps/web package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(web): scaffold Vite + React 18 + Tailwind + placeholders pages (Task 17)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: lib/api, store zustand, lib/format, lib/process-colors

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/format.ts`
- Create: `apps/web/src/lib/process-colors.ts`
- Create: `apps/web/src/store/app-store.ts`

- [ ] **Step 1: Créer `apps/web/src/lib/api.ts`**

```ts
import type { GraphResponse, SnapshotDetail, SnapshotSummary } from '@carto-ecp/shared';

type JsonError = { code: string; message: string };

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as Partial<JsonError>;
    throw new Error(err.message ?? `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export const api = {
  listSnapshots: (envName?: string): Promise<SnapshotSummary[]> => {
    const qs = envName ? `?envName=${encodeURIComponent(envName)}` : '';
    return fetch(`/api/snapshots${qs}`).then((r) => parseJson<SnapshotSummary[]>(r));
  },
  getSnapshot: (id: string): Promise<SnapshotDetail> =>
    fetch(`/api/snapshots/${id}`).then((r) => parseJson<SnapshotDetail>(r)),
  getGraph: (id: string): Promise<GraphResponse> =>
    fetch(`/api/snapshots/${id}/graph`).then((r) => parseJson<GraphResponse>(r)),
  createSnapshot: async (file: File, label: string, envName: string): Promise<SnapshotDetail> => {
    const form = new FormData();
    form.append('zip', file);
    form.append('label', label);
    form.append('envName', envName);
    const res = await fetch('/api/snapshots', { method: 'POST', body: form });
    return parseJson<SnapshotDetail>(res);
  },
};
```

- [ ] **Step 2: Créer `apps/web/src/lib/format.ts`**

```ts
const FR_DT = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

export function formatDateTime(input: string | null | undefined): string {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return FR_DT.format(date);
}
```

- [ ] **Step 3: Créer `apps/web/src/lib/process-colors.ts`**

```ts
import type { ProcessColorMap, ProcessKey } from '@carto-ecp/shared';

export const PROCESS_COLORS: ProcessColorMap = {
  TP: '#3b82f6',
  'UK-CC-IN': '#f97316',
  CORE: '#a855f7',
  MARI: '#22c55e',
  PICASSO: '#f59e0b',
  VP: '#ec4899',
  MIXTE: '#4b5563',
  UNKNOWN: '#9ca3af',
};

export function colorFor(process: ProcessKey | null | undefined): string {
  if (!process) return PROCESS_COLORS.UNKNOWN;
  return PROCESS_COLORS[process];
}
```

- [ ] **Step 4: Créer `apps/web/src/store/app-store.ts`**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GraphResponse, SnapshotSummary } from '@carto-ecp/shared';
import { api } from '../lib/api.js';

type AppState = {
  activeSnapshotId: string | null;
  snapshots: SnapshotSummary[];
  graph: GraphResponse | null;
  selectedNodeEic: string | null;
  selectedEdgeId: string | null;
  loading: boolean;
  error: string | null;

  loadSnapshots: () => Promise<void>;
  setActiveSnapshot: (id: string) => Promise<void>;
  selectNode: (eic: string | null) => void;
  selectEdge: (id: string | null) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeSnapshotId: null,
      snapshots: [],
      graph: null,
      selectedNodeEic: null,
      selectedEdgeId: null,
      loading: false,
      error: null,

      loadSnapshots: async () => {
        set({ loading: true, error: null });
        try {
          const list = await api.listSnapshots();
          set({ snapshots: list, loading: false });
          const id = get().activeSnapshotId;
          if (!id && list.length > 0) {
            await get().setActiveSnapshot(list[0].id);
          }
        } catch (err) {
          set({ loading: false, error: (err as Error).message });
        }
      },

      setActiveSnapshot: async (id: string) => {
        set({ loading: true, error: null, selectedNodeEic: null, selectedEdgeId: null });
        try {
          const graph = await api.getGraph(id);
          set({ activeSnapshotId: id, graph, loading: false });
        } catch (err) {
          set({ loading: false, error: (err as Error).message });
        }
      },

      selectNode: (eic) => set({ selectedNodeEic: eic, selectedEdgeId: null }),
      selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeEic: null }),
    }),
    {
      name: 'carto-ecp-store',
      partialize: (s) => ({ activeSnapshotId: s.activeSnapshotId }),
    },
  ),
);
```

- [ ] **Step 5: Vérifier typecheck**

Run: `pnpm --filter @carto-ecp/web typecheck`
Expected: pas d'erreur.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib apps/web/src/store
git commit -m "$(cat <<'EOF'
feat(web): api fetcher + zustand store persisté + helpers format/couleurs (Task 18)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: UploadPage

**Files:**
- Modify: `apps/web/src/pages/UploadPage.tsx`

- [ ] **Step 1: Écrire `apps/web/src/pages/UploadPage.tsx`**

```tsx
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import type { SnapshotDetail, Warning } from '@carto-ecp/shared';
import { api } from '../lib/api.js';
import { useAppStore } from '../store/app-store.js';

const MAX_UPLOAD = 50 * 1024 * 1024;

export function UploadPage(): JSX.Element {
  const navigate = useNavigate();
  const setActive = useAppStore((s) => s.setActiveSnapshot);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [envName, setEnvName] = useState('OPF');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SnapshotDetail | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/zip': ['.zip'] },
    maxSize: MAX_UPLOAD,
    multiple: false,
    onDrop: (accepted) => {
      setFile(accepted[0] ?? null);
      setError(null);
    },
    onDropRejected: (rejections) => {
      setError(rejections[0]?.errors[0]?.message ?? 'Fichier rejeté');
    },
  });

  const submit = async (): Promise<void> => {
    if (!file || !label.trim() || !envName.trim()) {
      setError('Fichier, label et environnement sont requis');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.createSnapshot(file, label.trim(), envName.trim());
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const openMap = async (): Promise<void> => {
    if (!result) return;
    await setActive(result.id);
    navigate('/map');
  };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Charger un snapshot ECP</h1>
      <p className="mb-6 text-sm text-gray-600">
        Déposez un zip de backup ECP (Endpoint ou Component Directory).
      </p>

      <div
        {...getRootProps()}
        className={`mb-4 cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition ${
          isDragActive ? 'border-rte bg-red-50' : 'border-gray-300 bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <p>
            <strong>{file.name}</strong> — {(file.size / 1024).toFixed(1)} KB
          </p>
        ) : (
          <p>{isDragActive ? 'Déposez ici' : 'Cliquez ou déposez un .zip'}</p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Label</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            placeholder="ex: Snapshot hebdo PROD 17/04"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Environnement</span>
          <input
            type="text"
            value={envName}
            onChange={(e) => setEnvName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            placeholder="OPF / PROD / PFRFI"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="rounded bg-rte px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Envoi en cours…' : 'Envoyer'}
      </button>

      {error && (
        <p className="mt-4 rounded bg-red-100 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 rounded border border-gray-200 p-4">
          <p className="mb-2 text-sm text-gray-700">
            Snapshot créé : <strong>{result.label}</strong> — {result.componentType} —{' '}
            {result.stats.componentsCount} composants / {result.stats.pathsCount} paths
          </p>
          {result.warnings.length > 0 && (
            <details className="mb-3 text-sm text-gray-600">
              <summary>{result.warnings.length} avertissement(s)</summary>
              <ul className="mt-2 space-y-1">
                {result.warnings.slice(0, 20).map((w: Warning, idx) => (
                  <li key={idx}>
                    <code>{w.code}</code> — {w.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button
            type="button"
            onClick={openMap}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Voir sur la carte →
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier build**

Run: `pnpm --filter @carto-ecp/web build`
Expected: succès.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/UploadPage.tsx
git commit -m "$(cat <<'EOF'
feat(web): UploadPage avec dropzone + form + warnings (Task 19)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: NetworkMap + NodeMarker + EdgePath + useMapData

**Files:**
- Create: `apps/web/src/components/Map/NetworkMap.tsx`
- Create: `apps/web/src/components/Map/NodeMarker.tsx`
- Create: `apps/web/src/components/Map/EdgePath.tsx`
- Create: `apps/web/src/components/Map/useMapData.ts`

- [ ] **Step 1: Créer `apps/web/src/components/Map/useMapData.ts`** (offset radial Paris)

```ts
import { useMemo } from 'react';
import type { GraphNode, GraphResponse } from '@carto-ecp/shared';

const PARIS_LAT = 48.8918;
const PARIS_LNG = 2.2378;
const OFFSET_DEG = 0.6;

export function useMapData(graph: GraphResponse | null): {
  nodes: GraphNode[];
  edges: GraphResponse['edges'];
  bounds: GraphResponse['bounds'] | null;
} {
  return useMemo(() => {
    if (!graph) return { nodes: [], edges: [], bounds: null };
    const parisGroup = graph.nodes.filter(
      (n) => Math.abs(n.lat - PARIS_LAT) < 0.01 && Math.abs(n.lng - PARIS_LNG) < 0.01,
    );
    const offsetMap = new Map<string, { lat: number; lng: number }>();
    if (parisGroup.length > 1) {
      parisGroup.forEach((node, idx) => {
        const angle = (2 * Math.PI * idx) / parisGroup.length;
        offsetMap.set(node.eic, {
          lat: PARIS_LAT + OFFSET_DEG * Math.cos(angle),
          lng: PARIS_LNG + OFFSET_DEG * Math.sin(angle),
        });
      });
    }
    const nodes = graph.nodes.map((n) => {
      const off = offsetMap.get(n.eic);
      return off ? { ...n, lat: off.lat, lng: off.lng } : n;
    });
    return { nodes, edges: graph.edges, bounds: graph.bounds };
  }, [graph]);
}
```

- [ ] **Step 2: Créer `apps/web/src/components/Map/NodeMarker.tsx`**

```tsx
import { CircleMarker, Tooltip } from 'react-leaflet';
import type { GraphNode } from '@carto-ecp/shared';
import { colorFor } from '../../lib/process-colors.js';

type Props = {
  node: GraphNode;
  selected: boolean;
  onSelect: (eic: string) => void;
};

const STYLE_BY_KIND: Record<
  GraphNode['kind'],
  { radius: number; fill: string; stroke: string; weight: number }
> = {
  RTE_ENDPOINT: { radius: 10, fill: '#e30613', stroke: '#ffffff', weight: 2 },
  RTE_CD: { radius: 12, fill: '#b91c1c', stroke: '#ffffff', weight: 2 },
  BROKER: { radius: 6, fill: '#111827', stroke: '#ffffff', weight: 1 },
  EXTERNAL_CD: { radius: 9, fill: '#1f2937', stroke: '#ffffff', weight: 1 },
  EXTERNAL_ENDPOINT: { radius: 7, fill: '#6b7280', stroke: '#ffffff', weight: 1 },
};

export function NodeMarker({ node, selected, onSelect }: Props): JSX.Element {
  const style = STYLE_BY_KIND[node.kind];
  const processColor = colorFor(node.process);
  return (
    <CircleMarker
      center={[node.lat, node.lng]}
      radius={selected ? style.radius + 3 : style.radius}
      pathOptions={{
        color: node.kind.startsWith('EXTERNAL') ? processColor : style.stroke,
        weight: style.weight,
        fillColor: style.fill,
        fillOpacity: 0.9,
      }}
      eventHandlers={{ click: () => onSelect(node.eic) }}
    >
      <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
        <div className="text-xs">
          <strong>{node.displayName}</strong>
          <br />
          {node.eic} {node.country ? `— ${node.country}` : ''}
          {node.isDefaultPosition && (
            <>
              <br />
              <em>Position par défaut</em>
            </>
          )}
        </div>
      </Tooltip>
    </CircleMarker>
  );
}
```

- [ ] **Step 3: Créer `apps/web/src/components/Map/EdgePath.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-curve';
import type { GraphEdge, GraphNode } from '@carto-ecp/shared';
import { colorFor } from '../../lib/process-colors.js';

type Props = {
  edge: GraphEdge;
  nodes: Map<string, GraphNode>;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function EdgePath({ edge, nodes, selected, onSelect }: Props): null {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    const from = nodes.get(edge.fromEic);
    const to = nodes.get(edge.toEic);
    if (!from || !to) return;
    const mid: [number, number] = [
      (from.lat + to.lat) / 2 + (to.lng - from.lng) * 0.15,
      (from.lng + to.lng) / 2 - (to.lat - from.lat) * 0.15,
    ];
    const curve = (L as unknown as { curve: (path: unknown[], options: L.PathOptions) => L.Path }).curve(
      [
        'M',
        [from.lat, from.lng],
        'Q',
        mid,
        [to.lat, to.lng],
      ],
      {
        color: colorFor(edge.process),
        weight: selected ? 4 : 2,
        opacity: 0.85,
        dashArray: edge.activity.isRecent ? undefined : '6 6',
      },
    );
    curve.on('click', () => onSelect(edge.id));
    curve.addTo(map);
    layerRef.current = curve;
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [edge, nodes, selected, onSelect, map]);

  return null;
}
```

- [ ] **Step 4: Créer `apps/web/src/components/Map/NetworkMap.tsx`**

```tsx
import { useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { useAppStore } from '../../store/app-store.js';
import { useMapData } from './useMapData.js';
import { NodeMarker } from './NodeMarker.js';
import { EdgePath } from './EdgePath.js';

export function NetworkMap(): JSX.Element {
  const graph = useAppStore((s) => s.graph);
  const selectedNodeEic = useAppStore((s) => s.selectedNodeEic);
  const selectedEdgeId = useAppStore((s) => s.selectedEdgeId);
  const selectNode = useAppStore((s) => s.selectNode);
  const selectEdge = useAppStore((s) => s.selectEdge);
  const { nodes, edges, bounds } = useMapData(graph);
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.eic, n])), [nodes]);

  const center: [number, number] = bounds
    ? [(bounds.north + bounds.south) / 2, (bounds.east + bounds.west) / 2]
    : [50, 5];

  return (
    <MapContainer
      center={center}
      zoom={4}
      bounds={bounds ? [[bounds.south, bounds.west], [bounds.north, bounds.east]] : undefined}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {edges.map((edge) => (
        <EdgePath
          key={edge.id}
          edge={edge}
          nodes={nodesById}
          selected={selectedEdgeId === edge.id}
          onSelect={selectEdge}
        />
      ))}
      {nodes.map((node) => (
        <NodeMarker
          key={node.eic}
          node={node}
          selected={selectedNodeEic === node.eic}
          onSelect={selectNode}
        />
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Map
git commit -m "$(cat <<'EOF'
feat(web): NetworkMap React-Leaflet + NodeMarker + EdgePath courbé (Task 20)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: DetailPanel + SnapshotSelector + MapPage

**Files:**
- Create: `apps/web/src/components/DetailPanel/DetailPanel.tsx`
- Create: `apps/web/src/components/DetailPanel/NodeDetails.tsx`
- Create: `apps/web/src/components/DetailPanel/EdgeDetails.tsx`
- Create: `apps/web/src/components/SnapshotSelector/SnapshotSelector.tsx`
- Modify: `apps/web/src/pages/MapPage.tsx`

- [ ] **Step 1: Créer `apps/web/src/components/DetailPanel/NodeDetails.tsx`**

```tsx
import type { GraphNode } from '@carto-ecp/shared';
import { formatDateTime } from '../../lib/format.js';

export function NodeDetails({ node }: { node: GraphNode }): JSX.Element {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{node.displayName}</h2>
      <dl className="text-sm">
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">EIC</dt>
          <dd className="col-span-2 font-mono">{node.eic}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Type</dt>
          <dd className="col-span-2">{node.kind}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Organisation</dt>
          <dd className="col-span-2">{node.organization}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Pays</dt>
          <dd className="col-span-2">{node.country ?? '—'}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Networks</dt>
          <dd className="col-span-2">{node.networks.join(', ') || '—'}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Processus</dt>
          <dd className="col-span-2">{node.process ?? '—'}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Créé</dt>
          <dd className="col-span-2">{formatDateTime(node.creationTs)}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Modifié</dt>
          <dd className="col-span-2">{formatDateTime(node.modificationTs)}</dd>
        </div>
      </dl>
      {node.urls.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium">URLs</h3>
          <ul className="space-y-1 text-xs font-mono">
            {node.urls.map((u, idx) => (
              <li key={idx}>
                <span className="text-gray-500">{u.network}</span> — {u.url}
              </li>
            ))}
          </ul>
        </div>
      )}
      {node.isDefaultPosition && (
        <p className="rounded bg-yellow-50 p-2 text-xs text-yellow-800">
          Position par défaut (EIC non géolocalisé dans le registry)
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Créer `apps/web/src/components/DetailPanel/EdgeDetails.tsx`**

```tsx
import type { GraphEdge } from '@carto-ecp/shared';
import { formatDateTime } from '../../lib/format.js';

export function EdgeDetails({ edge }: { edge: GraphEdge }): JSX.Element {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Flux {edge.process}</h2>
      <dl className="text-sm">
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Sens</dt>
          <dd className="col-span-2">{edge.direction}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">De</dt>
          <dd className="col-span-2 font-mono">{edge.fromEic}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Vers</dt>
          <dd className="col-span-2 font-mono">{edge.toEic}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Transport</dt>
          <dd className="col-span-2">{edge.transportPatterns.join(', ')}</dd>
        </div>
        {edge.intermediateBrokerEic && (
          <div className="grid grid-cols-3 gap-2 py-1">
            <dt className="text-gray-500">Broker</dt>
            <dd className="col-span-2 font-mono">{edge.intermediateBrokerEic}</dd>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Statut</dt>
          <dd className="col-span-2">{edge.activity.connectionStatus ?? '—'}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Dernière msg UP</dt>
          <dd className="col-span-2">{formatDateTime(edge.activity.lastMessageUp)}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Actif récemment</dt>
          <dd className="col-span-2">{edge.activity.isRecent ? 'Oui' : 'Non'}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Validité</dt>
          <dd className="col-span-2">
            {formatDateTime(edge.validFrom)} → {formatDateTime(edge.validTo)}
          </dd>
        </div>
      </dl>
      <div>
        <h3 className="mb-1 text-sm font-medium">Message types ({edge.messageTypes.length})</h3>
        <div className="flex flex-wrap gap-1 text-xs">
          {edge.messageTypes.map((mt) => (
            <span key={mt} className="rounded bg-gray-100 px-2 py-0.5 font-mono">
              {mt}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Créer `apps/web/src/components/DetailPanel/DetailPanel.tsx`**

```tsx
import { useAppStore } from '../../store/app-store.js';
import { NodeDetails } from './NodeDetails.js';
import { EdgeDetails } from './EdgeDetails.js';

export function DetailPanel(): JSX.Element | null {
  const graph = useAppStore((s) => s.graph);
  const selectedNodeEic = useAppStore((s) => s.selectedNodeEic);
  const selectedEdgeId = useAppStore((s) => s.selectedEdgeId);
  const clearNode = useAppStore((s) => s.selectNode);
  const clearEdge = useAppStore((s) => s.selectEdge);

  if (!graph) return null;
  if (!selectedNodeEic && !selectedEdgeId) return null;

  const node = selectedNodeEic ? graph.nodes.find((n) => n.eic === selectedNodeEic) : undefined;
  const edge = selectedEdgeId ? graph.edges.find((e) => e.id === selectedEdgeId) : undefined;

  return (
    <aside className="h-full w-[400px] overflow-y-auto border-l bg-white p-4">
      <button
        type="button"
        onClick={() => (node ? clearNode(null) : clearEdge(null))}
        className="mb-3 text-sm text-gray-500 hover:text-gray-900"
      >
        × Fermer
      </button>
      {node && <NodeDetails node={node} />}
      {edge && <EdgeDetails edge={edge} />}
    </aside>
  );
}
```

- [ ] **Step 4: Créer `apps/web/src/components/SnapshotSelector/SnapshotSelector.tsx`**

```tsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/app-store.js';
import { formatDateTime } from '../../lib/format.js';

export function SnapshotSelector(): JSX.Element {
  const snapshots = useAppStore((s) => s.snapshots);
  const activeId = useAppStore((s) => s.activeSnapshotId);
  const load = useAppStore((s) => s.loadSnapshots);
  const setActive = useAppStore((s) => s.setActiveSnapshot);

  useEffect(() => {
    void load();
  }, [load]);

  if (snapshots.length === 0) {
    return (
      <Link to="/upload" className="text-sm text-rte underline">
        Aucun snapshot — charger
      </Link>
    );
  }

  return (
    <select
      value={activeId ?? ''}
      onChange={(e) => void setActive(e.target.value)}
      className="rounded border border-gray-300 px-2 py-1 text-sm"
    >
      {snapshots.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label} — {s.envName} — {formatDateTime(s.uploadedAt)}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 5: Remplacer `apps/web/src/pages/MapPage.tsx`**

```tsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NetworkMap } from '../components/Map/NetworkMap.js';
import { DetailPanel } from '../components/DetailPanel/DetailPanel.js';
import { SnapshotSelector } from '../components/SnapshotSelector/SnapshotSelector.js';
import { useAppStore } from '../store/app-store.js';
import { PROCESS_COLORS } from '../lib/process-colors.js';

export function MapPage(): JSX.Element {
  const graph = useAppStore((s) => s.graph);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const activeId = useAppStore((s) => s.activeSnapshotId);
  const snapshots = useAppStore((s) => s.snapshots);
  const active = snapshots.find((s) => s.id === activeId) ?? null;

  useEffect(() => {
    if (activeId && !graph) {
      void useAppStore.getState().setActiveSnapshot(activeId);
    }
  }, [activeId, graph]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="font-bold text-rte">Carto ECP</span>
          <SnapshotSelector />
          {active && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
              env {active.envName} — {active.componentType}
            </span>
          )}
        </div>
        <Link to="/upload" className="text-sm text-gray-600 hover:text-gray-900">
          + Charger un snapshot
        </Link>
      </header>

      {error && <div className="bg-red-100 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">{loading ? <SkeletonMap /> : <NetworkMap />}</div>
        <DetailPanel />
      </div>

      <footer className="flex items-center gap-4 border-t bg-white px-4 py-2 text-xs text-gray-600">
        {Object.entries(PROCESS_COLORS).map(([process, color]) => (
          <span key={process} className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded"
              style={{ backgroundColor: color }}
            />
            {process}
          </span>
        ))}
        {graph && (
          <span className="ml-auto">
            {graph.nodes.length} nœuds / {graph.edges.length} liens
          </span>
        )}
      </footer>
    </div>
  );
}

function SkeletonMap(): JSX.Element {
  return <div className="flex h-full items-center justify-center text-gray-400">Chargement…</div>;
}
```

- [ ] **Step 6: Vérifier build**

Run: `pnpm --filter @carto-ecp/web build`
Expected: succès.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components apps/web/src/pages/MapPage.tsx
git commit -m "$(cat <<'EOF'
feat(web): DetailPanel + SnapshotSelector + MapPage complète (Task 21)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase D — E2E Playwright + finalisation

### Task 22: Playwright setup + smoke tests

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/upload-to-map.spec.ts`
- Create: `apps/web/e2e/select-node.spec.ts`
- Create: `apps/web/e2e/snapshot-switch.spec.ts`

- [ ] **Step 1: Installer Playwright browsers**

Run: `pnpm --filter @carto-ecp/web exec playwright install chromium`
Expected: Chromium installé.

- [ ] **Step 2: Créer `apps/web/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @carto-ecp/api dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @carto-ecp/web dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
```

- [ ] **Step 3: Créer `apps/web/e2e/upload-to-map.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import AdmZip from 'adm-zip';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_DIR = join(__dirname, '..', '..', '..', 'tests', 'fixtures', '17V000000498771C_2026-04-17T21_27_17Z');

function buildFixtureZip(): Buffer {
  const zip = new AdmZip();
  for (const f of readdirSync(FIXTURE_DIR)) {
    if (f === 'local_key_store.csv' || f === 'registration_store.csv') continue;
    zip.addFile(f, readFileSync(join(FIXTURE_DIR, f)));
  }
  return zip.toBuffer();
}

test('upload a backup, then see the map rendered', async ({ page }) => {
  await page.goto('/upload');
  await page.setInputFiles('input[type=file]', {
    name: 'endpoint.zip',
    mimeType: 'application/zip',
    buffer: buildFixtureZip(),
  });
  await page.fill('input[placeholder*="hebdo"]', 'E2E Endpoint');
  await page.click('button:has-text("Envoyer")');
  await expect(page.locator('button:has-text("Voir sur la carte")')).toBeVisible({ timeout: 20_000 });
  await page.click('button:has-text("Voir sur la carte")');
  await expect(page).toHaveURL(/\/map/);
  await expect(page.locator('.leaflet-container')).toBeVisible();
});
```

- [ ] **Step 4: Créer `apps/web/e2e/select-node.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('click a map marker opens the detail panel with EIC info', async ({ page }) => {
  await page.goto('/map');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.waitForSelector('.leaflet-interactive');
  await page.locator('.leaflet-interactive').first().click();
  await expect(page.locator('aside h2')).toBeVisible();
  await expect(page.locator('aside').locator('text=/17V|10X|26X/')).toBeVisible();
});
```

- [ ] **Step 5: Créer `apps/web/e2e/snapshot-switch.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import AdmZip from 'adm-zip';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CD_DIR = join(__dirname, '..', '..', '..', 'tests', 'fixtures', '17V000002014106G_2026-04-17T22_11_50Z');

function buildCdZip(): Buffer {
  const zip = new AdmZip();
  for (const f of readdirSync(CD_DIR)) {
    if (['local_key_store.csv', 'registration_requests.csv'].includes(f)) continue;
    zip.addFile(f, readFileSync(join(CD_DIR, f)));
  }
  return zip.toBuffer();
}

test('upload a second snapshot (CD) and switch to it', async ({ page }) => {
  await page.goto('/upload');
  await page.setInputFiles('input[type=file]', {
    name: 'cd.zip',
    mimeType: 'application/zip',
    buffer: buildCdZip(),
  });
  await page.fill('input[placeholder*="hebdo"]', 'E2E CD');
  await page.click('button:has-text("Envoyer")');
  await expect(page.locator('button:has-text("Voir sur la carte")')).toBeVisible({ timeout: 20_000 });
  await page.click('button:has-text("Voir sur la carte")');
  const selector = page.locator('header select');
  const optionCount = await selector.locator('option').count();
  expect(optionCount).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 6: Lancer les smoke tests**

Pré-requis : avoir déjà uploadé au moins un snapshot Endpoint dans la DB locale via `/upload` OU désactiver manuellement le test `select-node` du premier run (cf. commentaire en tête de fichier). Alternative : exécuter les tests en séquence (le premier upload alimente les deux suivants).

Run: `pnpm --filter @carto-ecp/web test:e2e`
Expected: 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/e2e
git commit -m "$(cat <<'EOF'
test(web): Playwright 3 smoke tests upload/select/switch (Task 22)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 23: README + critères de fin

**Files:**
- Create: `README.md`

- [ ] **Step 1: Créer `README.md`**

```markdown
# Carto ECP Network Map — Slice #1

Application interne RTE pour visualiser le réseau ECP sur une carte d'Europe.
Première livraison : vertical slice upload → parser → carte, sans auth, dev local.

## Prérequis

- Node 20 LTS
- pnpm ≥ 9

## Installation

```bash
pnpm install
pnpm --filter @carto-ecp/api prisma migrate dev
```

## Développement local

```bash
pnpm dev
```

- API : http://localhost:3000/api
- Web : http://localhost:5173

## Tests

```bash
pnpm test           # unit + intégration backend + frontend
pnpm test:e2e       # Playwright (démarre dev servers)
```

## Charger un backup

1. Ouvrir http://localhost:5173
2. Cliquer sur "Charger un snapshot"
3. Déposer un zip de backup ECP (Endpoint ou CD)
4. Entrer un label + un environnement (ex. OPF)
5. Envoyer → cliquer "Voir sur la carte"

Deux backups réels sont dans `tests/fixtures/` pour tester.

## Attention — sécurité

Ce slice #1 n'a **pas d'authentification**. Ne jamais l'exposer sur Internet.
Les fichiers `local_key_store.csv`, `registration_store.csv` et `registration_requests.csv`
(clés privées + inventaire interne) ne sont **jamais** parsés ni persistés.

## Architecture

Monorepo pnpm :
- `apps/api/` — NestJS 10 + Prisma 5 + SQLite
- `apps/web/` — React 18 + Vite + Leaflet
- `packages/shared/` — types TypeScript partagés
- `packages/registry/` — données de référence (CSV ENTSO-E + overlay RTE)

Pipeline d'ingestion : `ZipExtractor → CsvReader → XmlMadesParser →
NetworkModelBuilder → SnapshotPersister`.

Voir `docs/superpowers/specs/2026-04-18-carto-ecp-slice-1-design.md` pour le design complet.
```

- [ ] **Step 2: Vérifier l'intégralité** — lancer toute la chaîne

```bash
pnpm install
pnpm --filter @carto-ecp/api prisma migrate dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: tout vert.

Puis `pnpm dev`, charger l'un des deux backups via l'UI, vérifier manuellement :

- Snapshot Endpoint s'affiche avec ≥ 1 nœud rouge (RTE) et plusieurs externes géolocalisés
- Couleurs des edges correspondent aux processus (VP rose, CORE violet…)
- Snapshot CD s'affiche avec ≥ 1 nœud losange rouge (CD RTE)
- Clic sur nœud → panneau détail avec EIC, pays, URLs
- Clic sur edge → panneau détail avec messageTypes et activité
- SnapshotSelector permet de basculer entre les 2 snapshots

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: README d'usage pour le slice #1 (Task 23)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-check final du slice #1

Avant de clore le slice, vérifier chacun des critères §14 du spec :

- [ ] `pnpm dev` lance api + web, UI accessible sur `localhost:5173`.
- [ ] `pnpm test` passe à vert (unit + intégration).
- [ ] `pnpm test:e2e` passe les 3 smoke tests Playwright.
- [ ] Upload du backup Endpoint (`17V000000498771C_2026-04-17T21_27_17Z/`) reconstitué en zip via UI → snapshot visible, nœuds RTE et externes géolocalisés, edges colorés par process.
- [ ] Upload du backup CD (`17V000002014106G_2026-04-17T22_11_50Z/`) reconstitué en zip via UI → `componentType='COMPONENT_DIRECTORY'`, ≥ 1 nœud `RTE_CD`.
- [ ] Les fichiers sensibles (`local_key_store.csv`, `registration_store.csv`, `registration_requests.csv`) ne sont jamais persistés (inspection Prisma Studio : `pnpm --filter @carto-ecp/api prisma:studio`).
- [ ] Le `README.md` décrit comment lancer le dev et charger un backup.

Si tous les critères sont validés → slice #1 livré. Sinon, diagnostiquer et corriger avant de clore.

---

*Fin du plan d'implémentation slice #1 — 2026-04-18*











