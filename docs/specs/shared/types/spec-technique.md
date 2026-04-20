# Spec Technique — shared/types

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | shared/types                    |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## Architecture

`packages/shared/src/` contient les types TypeScript partagés entre `apps/api` et `apps/web`. Aucun build step — consommé directement via `main: ./src/index.ts`. Aucune dépendance npm externe.

### Fichiers

| Fichier | Contenu |
|---------|---------|
| `index.ts` | Réexporte tout depuis `registry.ts`, `snapshot.ts`, `graph.ts` |
| `registry.ts` | `PROCESS_KEYS`, `ProcessKey`, `ProcessColorMap` |
| `snapshot.ts` | `ComponentType`, `Warning` |
| `graph.ts` | Types GraphResponse, nodes, edges, imports, overrides, admin, entsoe |

---

## Types exportés

### `registry.ts`

```typescript
const PROCESS_KEYS = ['TP', 'UK-CC-IN', 'CORE', 'MARI', 'PICASSO', 'VP', 'MIXTE', 'UNKNOWN'] as const;
type ProcessKey = typeof PROCESS_KEYS[number];
type ProcessColorMap = Record<ProcessKey, string>;
```

### `snapshot.ts`

```typescript
type ComponentType = 'ENDPOINT' | 'COMPONENT_DIRECTORY';

type Warning = {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}
```

### `graph.ts`

#### Nœuds et edges

```typescript
type NodeKind = 'RTE_ENDPOINT' | 'RTE_CD' | 'BROKER' | 'EXTERNAL_CD' | 'EXTERNAL_ENDPOINT';
type EdgeDirection = 'IN' | 'OUT';

type GraphNode = {
  id: string; eic: string; kind: NodeKind;
  displayName: string; organization: string; country: string | null;
  lat: number; lng: number; isDefaultPosition: boolean;
  networks: string[]; process: ProcessKey | null;
  urls: { network: string; url: string }[];
  creationTs: string; modificationTs: string;
}

type GraphEdge = {
  id: string; fromEic: string; toEic: string;
  direction: EdgeDirection; process: ProcessKey;
  messageTypes: string[]; transportPatterns: ('DIRECT' | 'INDIRECT')[];
  intermediateBrokerEic: string | null;
  activity: {
    connectionStatus: string | null;
    lastMessageUp: string | null;
    lastMessageDown: string | null;
    isRecent: boolean;
  };
  validFrom: string; validTo: string | null;
}

type GraphBounds = { north: number; south: number; east: number; west: number; }

type MapConfig = {
  rteClusterLat: number; rteClusterLng: number;
  rteClusterOffsetDeg: number; rteClusterProximityDeg: number;
  defaultLat: number; defaultLng: number;
}

type GraphResponse = { bounds: GraphBounds; nodes: GraphNode[]; edges: GraphEdge[]; mapConfig: MapConfig; }
```

#### Imports

```typescript
type ImportSummary = {
  id: string; envName: string; label: string; fileName: string;
  dumpType: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
  sourceComponentEic: string | null; sourceDumpTimestamp: string | null;
  uploadedAt: string; effectiveDate: string;
}

type ImportDetail = ImportSummary & {
  warnings: Warning[];
  stats: { componentsCount: number; pathsCount: number; messagingStatsCount: number; }
}

type InspectResult = {
  fileName: string; fileSize: number; fileHash: string;
  sourceComponentEic: string | null; sourceDumpTimestamp: string | null;
  dumpType: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
  confidence: 'HIGH' | 'FALLBACK'; reason: string;
  duplicateOf: { importId: string; label: string; uploadedAt: string; } | null;
  warnings: Warning[];
}
```

#### Admin / Overrides

```typescript
type AdminComponentRow = {
  eic: string;
  current: { displayName: string; type: string; organization: string | null;
             country: string | null; lat: number; lng: number; isDefaultPosition: boolean; };
  override: {
    displayName: string | null; type: string | null; organization: string | null;
    country: string | null; lat: number | null; lng: number | null;
    tagsCsv: string | null; notes: string | null; updatedAt: string;
  } | null;
  importsCount: number;
}

type OverrideUpsertInput = {
  displayName?: string | null; type?: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER' | 'BA' | null;
  organization?: string | null; country?: string | null;
  lat?: number | null; lng?: number | null;
  tagsCsv?: string | null; notes?: string | null;
}
```

#### Admin ENTSO-E / Purges

```typescript
type EntsoeStatus = { count: number; refreshedAt: string | null; }
type PurgeResult = { deletedCount: number; }
type ResetAllResult = { imports: number; overrides: number; entsoe: number; }
```

---

## Types supprimés par rapport à v1

Les types suivants ont été supprimés et ne sont plus exportés :

| Type supprimé | Remplacé par |
|---------------|-------------|
| `SnapshotSummary` | `ImportSummary` |
| `SnapshotDetail` | `ImportDetail` |
| `SnapshotIngestionResult` | intégré dans `ImportDetail` |

---

## Dépendances

Aucune dépendance npm externe. Consommé en tant que workspace `@carto-ecp/shared` par `apps/api` et `apps/web`.

---

## Invariants

1. Aucun build step — les fichiers TypeScript sont importés directement.
2. Les types de ce package ne contiennent aucune logique (fonctions, classes) — uniquement des types et constantes.
3. `PROCESS_KEYS` comme `as const` permet à TypeScript d'inférer le type union `ProcessKey` directement depuis le tableau.

---

## Tests

Pas de tests directs dans ce package (types uniquement). La cohérence est vérifiée par le typecheck (`pnpm typecheck`).
