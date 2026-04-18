# Phase 3 Remédiation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer les 6 actions Phase 3 "quick wins & config" : sécurisation zip persisté, seuil isRecent configurable, rteEicSet pré-calculé, mapConfig dans GraphResponse, ADR validation, nettoyage whitelist.

**Architecture:** Branche `feat/phase3-remediation` depuis `feature/slice-1` (Phase 1 + Phase 2 + chore overlay déjà mergés). 6 commits conventional distincts, ordre par risque croissant (XS → S → M → ADR). TDD là où le code métier change.

**Tech Stack:** Node 20.11+, TypeScript 5.5, NestJS 10, Prisma 5.20, adm-zip, Vitest 2.1, React 18, Vite 5. Pas de nouvelle dépendance externe.

**Spec de référence :** `docs/superpowers/specs/2026-04-18-phase3-remediation-design.md`

---

## Task 0 : Branche de travail

- [ ] **Step 1 : Confirmer qu'on est sur `feat/phase3-remediation`**

Run :
```bash
git branch --show-current
```

Expected : `feat/phase3-remediation`. Si KO : `git checkout feat/phase3-remediation`.

---

# Partie A — P3-3 (rteEicSet pré-calculé, XS)

## Task 1 : Ajouter `getRteEicSet()` au `RegistryService` + test

**Files :**
- Modify : `apps/api/src/registry/registry.service.ts`
- Modify : `apps/api/src/registry/registry.service.spec.ts`

- [ ] **Step 1 : Ajouter le champ + getter dans RegistryService**

Dans `apps/api/src/registry/registry.service.ts` :

Après `private patternRegexes: ... = [];` :
```ts
  private rteEicSet!: Set<string>;
```

Dans `onModuleInit`, après le `await Promise.all([this.loadEntsoeIndex(), this.loadOverlay()])` et avant le log `Registry loaded` :
```ts
    this.rteEicSet = new Set<string>([
      ...this.overlay.rteEndpoints.map((e) => e.eic),
      this.overlay.rteComponentDirectory.eic,
    ]);
```

Ajouter une méthode publique après `getOverlay()` :
```ts
  getRteEicSet(): Set<string> {
    return this.rteEicSet;
  }
```

- [ ] **Step 2 : Ajouter le test**

Dans `apps/api/src/registry/registry.service.spec.ts`, à la fin du `describe` principal (avant la dernière accolade fermante) :

```ts
  describe('getRteEicSet', () => {
    it('returns a Set containing all rteEndpoints EICs plus the rteComponentDirectory EIC', () => {
      const set = service.getRteEicSet();
      expect(set).toBeInstanceOf(Set);
      expect(set.has('17V000000498771C')).toBe(true);
      expect(set.has('17V000002014106G')).toBe(true);
    });
  });
```

- [ ] **Step 3 : Run tests**

Run :
```bash
pnpm --filter @carto-ecp/api test -- registry.service
```

Expected : tous les tests registry passent (le nouveau inclus).

## Task 2 : Utiliser `getRteEicSet()` dans NetworkModelBuilder + commit

**Files :** Modify : `apps/api/src/ingestion/network-model-builder.service.ts:59-62`

- [ ] **Step 1 : Remplacer la construction locale**

Dans `apps/api/src/ingestion/network-model-builder.service.ts`, la méthode `build` contient :
```ts
    const rteEicSet = new Set<string>([
      ...overlay.rteEndpoints.map((e) => e.eic),
      overlay.rteComponentDirectory.eic,
    ]);
```

Remplacer par :
```ts
    const rteEicSet = this.registry.getRteEicSet();
```

- [ ] **Step 2 : Run tests api**

Run :
```bash
pnpm --filter @carto-ecp/api test
```

Expected : 79 tests + 1 nouveau = 80 tests, tous verts.

- [ ] **Step 3 : Lint + typecheck**

Run :
```bash
pnpm --filter @carto-ecp/api typecheck
pnpm --filter @carto-ecp/api lint
```

Expected : exit 0 pour les deux.

- [ ] **Step 4 : Commit P3-3**

Run :
```bash
git add apps/api/src/registry/registry.service.ts apps/api/src/registry/registry.service.spec.ts apps/api/src/ingestion/network-model-builder.service.ts
git commit -m "$(cat <<'EOF'
feat(api/registry): pré-calculer rteEicSet dans onModuleInit (P3-3)

- RegistryService construit le Set<string> une fois au boot (rteEndpoints
  + rteComponentDirectory) au lieu de le reconstruire à chaque build()
- Nouveau getter public getRteEicSet()
- NetworkModelBuilderService utilise this.registry.getRteEicSet() à la place
  de la construction locale
- Test : set contient les EICs attendus

Refs: plan-remediation P3-3, dette m12.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Partie B — P3-7 (Whitelist CSV cleanup, XS)

## Task 3 : Retirer les 2 CSV sans reader + test

**Files :**
- Modify : `apps/api/src/ingestion/types.ts:8-15`
- Modify : `apps/api/src/ingestion/zip-extractor.service.spec.ts`

- [ ] **Step 1 : Modifier la whitelist**

Dans `apps/api/src/ingestion/types.ts`, remplacer :
```ts
export const USABLE_CSV_FILES = [
  'application_property.csv',
  'component_directory.csv',
  'message_path.csv',
  'messaging_statistics.csv',
  'message_type.csv',
  'message_upload_route.csv',
] as const;
```

par :
```ts
export const USABLE_CSV_FILES = [
  'application_property.csv',
  'component_directory.csv',
  'message_path.csv',
  'messaging_statistics.csv',
] as const;
```

- [ ] **Step 2 : Ajouter le test dans zip-extractor**

Ouvrir `apps/api/src/ingestion/zip-extractor.service.spec.ts`. À la fin du dernier `describe` principal (avant accolade fermante), ajouter :

```ts
  describe('whitelist cleanup (P3-7)', () => {
    it('does not load message_type.csv even if present in the zip', () => {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip();
      zip.addFile('application_property.csv', Buffer.from('key;value\n'));
      zip.addFile('component_directory.csv', Buffer.from('component_directory_id;name;country;componentType;componentCode;environmentName;organization;ecp.domain;ecp.componentCode;mades.id;mades.endpointUrl;mades.endpointVersion;mades.implementation;mades.implementationVersion;directoryContent\nid1;n;FR;ENDPOINT;c;E;RTE;d;ECP;mid;mUrl;mV;mI;mIV;<xml/>\n'));
      zip.addFile('message_type.csv', Buffer.from('col1;col2\nA;B\n'));
      zip.addFile('message_upload_route.csv', Buffer.from('col1;col2\nA;B\n'));
      const buffer = zip.toBuffer();

      const result = extractor.extract(buffer);
      expect(result.files.has('message_type.csv')).toBe(false);
      expect(result.files.has('message_upload_route.csv')).toBe(false);
    });
  });
```

Remplacer `require('adm-zip')` par l'import ESM standard ; en haut du fichier, vérifier qu'il y a déjà :
```ts
import AdmZip from 'adm-zip';
```

Si absent, ajouter cette ligne. Puis dans le test, remplacer la ligne `const AdmZip = require('adm-zip');` par rien (supprimer).

- [ ] **Step 3 : Run tests**

Run :
```bash
pnpm --filter @carto-ecp/api test -- zip-extractor
```

Expected : tous les tests zip-extractor passent (le nouveau inclus).

## Task 4 : Vérifier + commit P3-7

- [ ] **Step 1 : Typecheck + lint + test complet**

Run :
```bash
pnpm --filter @carto-ecp/api typecheck
pnpm --filter @carto-ecp/api lint
pnpm --filter @carto-ecp/api test
```

Expected : tous exit 0.

- [ ] **Step 2 : Commit**

Run :
```bash
git add apps/api/src/ingestion/types.ts apps/api/src/ingestion/zip-extractor.service.spec.ts
git commit -m "$(cat <<'EOF'
chore(api/ingestion): retirer message_type.csv et message_upload_route.csv de USABLE_CSV_FILES (P3-7)

- Ces 2 fichiers étaient dans la whitelist mais sans reader associé
  (charge mémoire inutile à l'extraction)
- Test zip-extractor : si zip contient ces fichiers, ils sont filtrés

Refs: plan-remediation P3-7, dette m14.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Partie C — P3-2 (ISRECENT_THRESHOLD_MS env var, S)

## Task 5 : Rendre le seuil isRecent configurable via env var

**Files :**
- Modify : `apps/api/src/graph/graph.service.ts`
- Modify : `apps/api/src/graph/graph.service.spec.ts`

- [ ] **Step 1 : Écrire un test RED pour l'env var**

Ouvrir `apps/api/src/graph/graph.service.spec.ts`. Ajouter un nouveau `describe` à la fin (avant accolade fermante du describe principal) :

```ts
  describe('ISRECENT_THRESHOLD_MS env var (P3-2)', () => {
    const ORIGINAL_ENV = process.env.ISRECENT_THRESHOLD_MS;

    afterEach(() => {
      if (ORIGINAL_ENV === undefined) {
        delete process.env.ISRECENT_THRESHOLD_MS;
      } else {
        process.env.ISRECENT_THRESHOLD_MS = ORIGINAL_ENV;
      }
    });

    it('uses a custom threshold when ISRECENT_THRESHOLD_MS is set to 1h', async () => {
      process.env.ISRECENT_THRESHOLD_MS = String(60 * 60 * 1000);
      vi.resetModules();
      const { GraphService: FreshGraphService } = await import('./graph.service.js');
      const mockPrisma = {} as never;
      const mockRegistry = {} as never;
      const freshService = new FreshGraphService(mockPrisma, mockRegistry);
      const snapshot = {
        uploadedAt: new Date('2026-04-18T10:00:00Z'),
      } as Parameters<typeof freshService.buildGraph>[0];
      const components: Parameters<typeof freshService.buildGraph>[1] = [
        { eic: 'A', type: 'ENDPOINT', organization: 'RTE', displayName: 'A',
          country: 'FR', lat: 48.0, lng: 2.0, isDefaultPosition: false,
          networksCsv: '', process: null, sourceType: 'XML_CD',
          personName: null, email: null, phone: null,
          homeCdCode: 'X', creationTs: new Date(0), modificationTs: new Date(0),
          snapshotId: 'x', id: 1, urls: [] } as unknown as Parameters<typeof freshService.buildGraph>[1][number],
        { eic: 'B', type: 'ENDPOINT', organization: 'RTE', displayName: 'B',
          country: 'FR', lat: 48.1, lng: 2.1, isDefaultPosition: false,
          networksCsv: '', process: null, sourceType: 'XML_CD',
          personName: null, email: null, phone: null,
          homeCdCode: 'X', creationTs: new Date(0), modificationTs: new Date(0),
          snapshotId: 'x', id: 2, urls: [] } as unknown as Parameters<typeof freshService.buildGraph>[1][number],
      ];
      const paths: Parameters<typeof freshService.buildGraph>[2] = [
        { senderEicOrWildcard: 'A', receiverEic: 'B', direction: 'OUT',
          messageType: 'TP-X', process: 'TP', transportPattern: 'DIRECT',
          intermediateBrokerEic: null, validFrom: new Date(0), validTo: null,
          snapshotId: 'x', id: 1, source: 'LOCAL_CSV_PATHS', isExpired: false } as unknown as Parameters<typeof freshService.buildGraph>[2][number],
      ];
      const stats: Parameters<typeof freshService.buildGraph>[3] = [
        { sourceEndpointCode: 'A', remoteComponentCode: 'B',
          connectionStatus: 'OK', lastMessageUp: new Date('2026-04-18T08:00:00Z'),
          lastMessageDown: null, sumMessagesUp: 0, sumMessagesDown: 0,
          deleted: false, snapshotId: 'x', id: 1 } as unknown as Parameters<typeof freshService.buildGraph>[3][number],
      ];
      const graph = freshService.buildGraph(snapshot, components, paths, stats);
      expect(graph.edges[0]!.activity.isRecent).toBe(false);
    });
  });
```

Ce test est compact mais conforme : l'activité est à 2h de l'upload, le seuil à 1h → isRecent doit être `false`.

- [ ] **Step 2 : Lancer — doit FAIL**

Run :
```bash
pnpm --filter @carto-ecp/api test -- graph.service
```

Expected : le test FAIL car le service utilise toujours le seuil hardcodé 24h → isRecent serait `true`. RED confirmé.

- [ ] **Step 3 : Implémenter la lecture env var**

Dans `apps/api/src/graph/graph.service.ts`, en haut du fichier après les imports :

```ts
const DEFAULT_ISRECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function parseThreshold(): number {
  const raw = process.env.ISRECENT_THRESHOLD_MS;
  if (!raw) return DEFAULT_ISRECENT_THRESHOLD_MS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ISRECENT_THRESHOLD_MS;
}
```

Dans la classe `GraphService`, après `constructor(...)` :
```ts
  private readonly isRecentThreshold = parseThreshold();
```

Dans `buildGraph`, remplacer la ligne 105 :
```ts
        snapshotTime - stat.lastMessageUp.getTime() < 24 * 60 * 60 * 1000 &&
```

par :
```ts
        snapshotTime - stat.lastMessageUp.getTime() < this.isRecentThreshold &&
```

- [ ] **Step 4 : Lancer le test — doit PASS**

Run :
```bash
pnpm --filter @carto-ecp/api test -- graph.service
```

Expected : **tous les tests graph passent** incluant le nouveau. Si pas : vérifier que `vi.resetModules()` puis import dynamique picks up le nouveau code (le constructor lit env au boot du module).

- [ ] **Step 5 : Lint + typecheck**

Run :
```bash
pnpm --filter @carto-ecp/api typecheck
pnpm --filter @carto-ecp/api lint
```

Expected : exit 0.

- [ ] **Step 6 : Commit P3-2**

Run :
```bash
git add apps/api/src/graph/graph.service.ts apps/api/src/graph/graph.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api/graph): ISRECENT_THRESHOLD_MS configurable via env var (P3-2)

- Seuil isRecent lu depuis process.env.ISRECENT_THRESHOLD_MS au boot
- Fallback sur 24h (86400000 ms) si absent ou valeur invalide
- parseThreshold helper : parseInt avec garde-fou
- Test TDD : seuil 1h + activité à 2h → isRecent=false

Utile pour processus basse fréquence (UK-CC-IN, TP) qui dépassent 24h.

Refs: plan-remediation P3-2, dette m8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Partie D — P3-1 (Zip sans sensibles, M)

## Task 6 : Ajouter `repackageWithoutSensitive` + test

**Files :**
- Modify : `apps/api/src/ingestion/snapshot-persister.service.ts`
- Modify : `apps/api/src/ingestion/snapshot-persister.service.spec.ts`

- [ ] **Step 1 : Modifier le service**

Dans `apps/api/src/ingestion/snapshot-persister.service.ts` :

En haut du fichier, après les imports existants, ajouter :
```ts
import AdmZip from 'adm-zip';

const SENSITIVE_FILES_TO_STRIP = new Set<string>([
  'local_key_store.csv',
  'registration_store.csv',
  'registration_requests.csv',
]);
```

Ajouter la méthode privée en bas de la classe (avant `filterSensitive`) :
```ts
  private repackageWithoutSensitive(buffer: Buffer): Buffer {
    const src = new AdmZip(buffer);
    const dst = new AdmZip();
    for (const entry of src.getEntries()) {
      if (entry.isDirectory) continue;
      const name = entry.entryName.split('/').pop() ?? entry.entryName;
      if (SENSITIVE_FILES_TO_STRIP.has(name)) continue;
      dst.addFile(entry.entryName, entry.getData());
    }
    return dst.toBuffer();
  }
```

Dans `persist`, remplacer :
```ts
    await writeFile(zipPath, zipBuffer);
```

par :
```ts
    const safeBuffer = this.repackageWithoutSensitive(zipBuffer);
    await writeFile(zipPath, safeBuffer);
```

- [ ] **Step 2 : Ajouter le test**

Dans `apps/api/src/ingestion/snapshot-persister.service.spec.ts`, à la fin du `describe` principal :

```ts
  it('strips sensitive files from the persisted zip (P3-1)', async () => {
    const prismaMock = makePrismaMock('resolve');
    const service = new SnapshotPersisterService(prismaMock as unknown as PrismaService);
    const snap = buildMinimalNetworkSnapshot();

    const AdmZip = (await import('adm-zip')).default;
    const srcZip = new AdmZip();
    srcZip.addFile('application_property.csv', Buffer.from('key;value\n'));
    srcZip.addFile('local_key_store.csv', Buffer.from('SECRET_PRIVATE_KEY\n'));
    srcZip.addFile('registration_store.csv', Buffer.from('SECRET_REG\n'));
    srcZip.addFile('registration_requests.csv', Buffer.from('SECRET_REQ\n'));
    const srcBuffer = srcZip.toBuffer();

    await service.persist(snap, srcBuffer, 'label-p31');

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    const writtenBuffer = writeFileMock.mock.calls[0]![1] as Buffer;
    const writtenZip = new AdmZip(writtenBuffer);
    const entries = writtenZip.getEntries().map((e) => e.entryName);
    expect(entries).toContain('application_property.csv');
    expect(entries).not.toContain('local_key_store.csv');
    expect(entries).not.toContain('registration_store.csv');
    expect(entries).not.toContain('registration_requests.csv');
  });
```

- [ ] **Step 3 : Run tests persister**

Run :
```bash
pnpm --filter @carto-ecp/api test -- snapshot-persister.service
```

Expected : **4 tests passent** (3 existants + 1 nouveau).

## Task 7 : Vérifier + commit P3-1

- [ ] **Step 1 : Lint + typecheck + test complet**

Run :
```bash
pnpm --filter @carto-ecp/api typecheck
pnpm --filter @carto-ecp/api lint
pnpm --filter @carto-ecp/api test
```

Expected : tous exit 0.

- [ ] **Step 2 : Commit**

Run :
```bash
git add apps/api/src/ingestion/snapshot-persister.service.ts apps/api/src/ingestion/snapshot-persister.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api/ingestion): re-packager le zip persisté sans fichiers sensibles (P3-1)

- repackageWithoutSensitive(buffer) retire local_key_store.csv,
  registration_store.csv, registration_requests.csv avant writeFile
- Le zip archivé sur disque ne contient plus de clés privées ECP
- Test unitaire vérifie que le buffer écrit ne contient aucun des 3 fichiers

Refs: plan-remediation P3-1, dette m5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Partie E — P3-4 (mapConfig dans GraphResponse, M)

## Task 8 : Ajouter `MapConfig` dans shared types + overlay

**Files :**
- Modify : `packages/shared/src/graph.ts`
- Modify : `packages/registry/eic-rte-overlay.json`

- [ ] **Step 1 : Ajouter le type `MapConfig`**

Dans `packages/shared/src/graph.ts`, avant `export type GraphResponse` :
```ts
export type MapConfig = {
  rteClusterLat: number;
  rteClusterLng: number;
  rteClusterOffsetDeg: number;
  rteClusterProximityDeg: number;
};
```

Modifier `GraphResponse` :
```ts
export type GraphResponse = {
  bounds: GraphBounds;
  nodes: GraphNode[];
  edges: GraphEdge[];
  mapConfig: MapConfig;
};
```

- [ ] **Step 2 : Ajouter `mapConfig` à l'overlay JSON**

Dans `packages/registry/eic-rte-overlay.json`, avant la dernière `}` fermante du root object, après `processColors`, ajouter une virgule après `processColors {...}` et insérer :

```json
  "mapConfig": {
    "rteClusterLat": 48.8918,
    "rteClusterLng": 2.2378,
    "rteClusterOffsetDeg": 0.6,
    "rteClusterProximityDeg": 0.01
  }
```

## Task 9 : Exposer `getMapConfig()` dans RegistryService

**Files :** Modify : `apps/api/src/registry/registry.service.ts` + `registry/types.ts` (type overlay)

- [ ] **Step 1 : Ajouter le type dans `apps/api/src/registry/types.ts`**

Ouvrir `apps/api/src/registry/types.ts`. Ajouter dans le type `RteOverlay` (qui décrit le schéma JSON) un champ `mapConfig` :

```ts
export type RteOverlay = {
  // ...champs existants...
  mapConfig: {
    rteClusterLat: number;
    rteClusterLng: number;
    rteClusterOffsetDeg: number;
    rteClusterProximityDeg: number;
  };
};
```

- [ ] **Step 2 : Ajouter `getMapConfig()` dans RegistryService**

Dans `apps/api/src/registry/registry.service.ts`, importer le type depuis shared :
```ts
import type { MapConfig } from '@carto-ecp/shared';
```

Ajouter la méthode publique après `getRteEicSet()` (ou `getOverlay`) :
```ts
  getMapConfig(): MapConfig {
    return this.overlay.mapConfig;
  }
```

- [ ] **Step 3 : Ajouter le test dans `registry.service.spec.ts`**

Dans `apps/api/src/registry/registry.service.spec.ts`, à la fin du `describe` principal :
```ts
  describe('getMapConfig (P3-4)', () => {
    it('returns the mapConfig block from the overlay', () => {
      const config = service.getMapConfig();
      expect(config.rteClusterLat).toBeCloseTo(48.8918);
      expect(config.rteClusterLng).toBeCloseTo(2.2378);
      expect(config.rteClusterOffsetDeg).toBeCloseTo(0.6);
      expect(config.rteClusterProximityDeg).toBeCloseTo(0.01);
    });
  });
```

## Task 10 : Inclure `mapConfig` dans `GraphResponse` (api)

**Files :** Modify : `apps/api/src/graph/graph.service.ts`

- [ ] **Step 1 : Modifier `buildGraph` pour inclure mapConfig**

Dans `apps/api/src/graph/graph.service.ts`, ligne 128 :

Remplacer :
```ts
    return { bounds: this.computeBounds(nodes), nodes, edges };
```

par :
```ts
    return {
      bounds: this.computeBounds(nodes),
      nodes,
      edges,
      mapConfig: this.registry.getMapConfig(),
    };
```

- [ ] **Step 2 : Ajouter un test dans graph.service.spec.ts**

Dans `apps/api/src/graph/graph.service.spec.ts`, à la fin du `describe` principal :
```ts
  describe('mapConfig (P3-4)', () => {
    it('includes mapConfig from the registry in the graph response', () => {
      // Le test existant utilise déjà un setup. Réutiliser ce snapshot et
      // simplement vérifier la présence de mapConfig.
      const snapshot = { uploadedAt: new Date('2026-04-18T12:00:00Z') } as Parameters<typeof service.buildGraph>[0];
      const graph = service.buildGraph(snapshot, [], [], []);
      expect(graph.mapConfig).toBeDefined();
      expect(typeof graph.mapConfig.rteClusterLat).toBe('number');
      expect(typeof graph.mapConfig.rteClusterOffsetDeg).toBe('number');
    });
  });
```

- [ ] **Step 3 : Lancer tous les tests api**

Run :
```bash
pnpm --filter @carto-ecp/api test
```

Expected : tous les tests api passent (y compris les 3 nouveaux : registry getMapConfig, graph mapConfig, le test existant de buildGraph qui continue à passer).

## Task 11 : Consommer `mapConfig` dans `useMapData.ts` (web)

**Files :** Modify : `apps/web/src/components/Map/useMapData.ts`

- [ ] **Step 1 : Remplacer les constantes par les champs de `mapConfig`**

Remplacer tout le contenu de `apps/web/src/components/Map/useMapData.ts` par :

```ts
import { useMemo } from 'react';
import type { GraphNode, GraphResponse } from '@carto-ecp/shared';

export function useMapData(graph: GraphResponse | null): {
  nodes: GraphNode[];
  edges: GraphResponse['edges'];
  bounds: GraphResponse['bounds'] | null;
} {
  return useMemo(() => {
    if (!graph) return { nodes: [], edges: [], bounds: null };
    const { rteClusterLat, rteClusterLng, rteClusterOffsetDeg, rteClusterProximityDeg } =
      graph.mapConfig;
    const parisGroup = graph.nodes.filter(
      (n) =>
        Math.abs(n.lat - rteClusterLat) < rteClusterProximityDeg &&
        Math.abs(n.lng - rteClusterLng) < rteClusterProximityDeg,
    );
    const offsetMap = new Map<string, { lat: number; lng: number }>();
    if (parisGroup.length > 1) {
      parisGroup.forEach((node, idx) => {
        const angle = (2 * Math.PI * idx) / parisGroup.length;
        offsetMap.set(node.eic, {
          lat: rteClusterLat + rteClusterOffsetDeg * Math.cos(angle),
          lng: rteClusterLng + rteClusterOffsetDeg * Math.sin(angle),
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

- [ ] **Step 2 : Vérifier typecheck + lint + test web**

Run :
```bash
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/web lint
pnpm --filter @carto-ecp/web test
```

Expected : exit 0 pour les 3. Le test `process-colors.sync` et les 5 suites React existantes passent.

**Note** : si typecheck sur la web échoue avec "Property 'mapConfig' is missing", c'est que le test `app-store.test.ts` ou `UploadPage.test.tsx` crée un `GraphResponse` mock sans `mapConfig`. Ajouter dans ces mocks :
```ts
mapConfig: { rteClusterLat: 48.8918, rteClusterLng: 2.2378, rteClusterOffsetDeg: 0.6, rteClusterProximityDeg: 0.01 }
```

## Task 12 : Vérif racine + commit P3-4

- [ ] **Step 1 : Lint + typecheck + test racine**

Run :
```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected : tous exit 0.

- [ ] **Step 2 : Commit**

Run :
```bash
git add packages/shared/src/graph.ts packages/registry/eic-rte-overlay.json apps/api/src/registry/registry.service.ts apps/api/src/registry/registry.service.spec.ts apps/api/src/registry/types.ts apps/api/src/graph/graph.service.ts apps/api/src/graph/graph.service.spec.ts apps/web/src/components/Map/useMapData.ts
# Si le typecheck a nécessité d'ajouter mapConfig dans des mocks de test, les ajouter aussi
# ex: git add apps/web/src/store/app-store.test.ts apps/web/src/pages/UploadPage.test.tsx

git commit -m "$(cat <<'EOF'
feat(api+web): externaliser rteCluster coords via mapConfig dans GraphResponse (P3-4)

- Nouveau type MapConfig dans @carto-ecp/shared (rteClusterLat, Lng,
  OffsetDeg, ProximityDeg)
- mapConfig ajouté à l'overlay eic-rte-overlay.json
- RegistryService expose getMapConfig(), GraphService l'inclut dans le
  GraphResponse
- useMapData.ts frontend consomme graph.mapConfig au lieu des constantes
  hardcodées PARIS_LAT/LNG/OFFSET_DEG
- 2 nouveaux tests : getMapConfig registry, mapConfig présent dans graph

Refs: plan-remediation P3-4, dette m13.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Partie F — P3-5 (ADR-022 validation strategy, S)

## Task 13 : Rédiger ADR-022 + commit P3-5

**Files :** Create : `docs/adr/ADR-022-validation-nestjs-zod-pour-futurs-endpoints.md`

- [ ] **Step 1 : Créer l'ADR**

Contenu complet de `docs/adr/ADR-022-validation-nestjs-zod-pour-futurs-endpoints.md` :

```markdown
# ADR-022 — Validation : adopter nestjs-zod pour les futurs endpoints NestJS

| Champ    | Valeur                                              |
|----------|-----------------------------------------------------|
| Date     | 2026-04-18                                          |
| Statut   | Acceptée                                            |
| Portée   | Tout nouvel endpoint NestJS ajouté au-delà du slice #1 |
| Source   | `docs/retro/plan-remediation.md` P3-5, dette m11    |

## Contexte

Le slice #1 a livré un seul endpoint de mutation (`POST /api/snapshots`) et
deux endpoints de lecture (`GET /api/snapshots`, `GET /api/snapshots/:id`,
`GET /api/snapshots/:id/graph`).

La validation actuelle :
- `POST /snapshots` : le body `label + envName` est parsé par
  `createSnapshotSchema.safeParse(body)` (Zod manuel) dans le body du
  controller, après le FileInterceptor et les checks MIME / magic bytes
- Les paramètres `:id` et `?envName` ne passent par **aucun** pipe NestJS :
  ils sont acceptés en string brute

Cette stratégie est hybride : Zod pour le body (cohérent avec le reste du
projet qui utilise Zod dans `packages/shared`), mais pas de validation pour
les params/query. Si d'autres endpoints sont ajoutés (filtres, export,
admin registry, diff view, etc.), deux directions sont possibles :
- `class-validator` (convention NestJS par défaut), avec `ValidationPipe`
  global activé dans `main.ts`
- `nestjs-zod` (adaptateur qui expose des DTO Zod via decorators + pipe)

## Décision

**Adopter `nestjs-zod` pour tout nouvel endpoint ajouté après le slice #1.**

- Les endpoints existants de `SnapshotsController` ne sont **pas** refactorés
  (risque disproportionné par rapport au bénéfice, les tests existants
  valident le comportement actuel)
- Tout nouvel endpoint utilisera `@nestjs/zod`, avec :
  - DTOs typés via `createZodDto(schema)` de `nestjs-zod`
  - Pipes de validation automatiques (body, query, params) via `ZodValidationPipe`
  - Schémas Zod réutilisables dans `packages/shared` ou spécifiques au module

## Conséquences

- **Positives** : cohérence Zod de bout en bout (shared types, API
  validation, tests), typage automatique, validation des params/query par
  défaut, moins de boilerplate que `class-validator` (pas de décorateurs
  manuels par champ)
- **Négatives** : dépendance supplémentaire (`nestjs-zod`), hétérogénéité
  temporaire avec `SnapshotsController` qui garde son approche manuelle
- **Mitigation** : documenter le pattern `nestjs-zod` dans un README du
  premier module qui l'adopte, pour guider les contributeurs

## Alternatives écartées

- **class-validator (canonique NestJS)** : impose des décorateurs par champ,
  typage moins fluide avec TypeScript strict, friction avec SWC + Prisma
  types, duplique les schémas déjà exprimés en Zod dans `@carto-ecp/shared`
- **Migration rétroactive des endpoints existants** : risque de régression
  pour 0 gain fonctionnel, le slice #1 est stable, les tests couvrent les 3
  cas de rejet upload
- **Ne rien faire / laisser chaque module choisir** : divergence prévisible,
  dette technique reportée, review plus difficile

## Implémentation future

Lorsque le premier nouvel endpoint sera ajouté :
1. `pnpm --filter @carto-ecp/api add nestjs-zod zod` (zod déjà présent)
2. Activer `ZodValidationPipe` globalement dans `main.ts` via
   `app.useGlobalPipes(new ZodValidationPipe())`
3. Créer un DTO avec `createZodDto(filterSchema)` importé d'un schéma Zod
4. Utiliser `@Query() filter: FilterDto` dans le controller

Pas de ticket spécifique ouvert : ce chantier démarrera avec la première
feature de slice #2 nécessitant validation étendue.
```

- [ ] **Step 2 : Commit**

Run :
```bash
git add docs/adr/ADR-022-validation-nestjs-zod-pour-futurs-endpoints.md
git commit -m "$(cat <<'EOF'
docs(adr): ADR-022 validation nestjs-zod pour futurs endpoints (P3-5)

Décision architecturale pour unifier la stratégie de validation :
- Les endpoints existants du slice #1 gardent leur Zod manuel (pas de
  refacto rétroactive, risque nul)
- Tout nouvel endpoint adopte nestjs-zod (DTO via createZodDto,
  ValidationPipe Zod global)

Alternatives écartées : class-validator (friction TS + duplication des
schémas shared), migration rétroactive (risque disproportionné).

Refs: plan-remediation P3-5, dette m11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Partie G — Vérification finale + push + PR

## Task 14 : Vérification finale

- [ ] **Step 1 : Chaîne qualité complète**

Run :
```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
```

Expected : exit 0 sur les 4.

- [ ] **Step 2 : Playwright**

Run :
```bash
pnpm --filter @carto-ecp/web test:e2e
```

Expected : 3/3 passent.

## Task 15 : Push + PR

- [ ] **Step 1 : Vérifier les commits**

Run :
```bash
git log --oneline feature/slice-1..HEAD
```

Expected : 7 commits (docs spec + 6 feat/chore/docs items dans l'ordre A-F).

- [ ] **Step 2 : Push**

Run :
```bash
git push -u origin feat/phase3-remediation
```

Expected : branche créée sur origin.

- [ ] **Step 3 : Ouvrir la PR**

Run :
```bash
gh pr create --base feature/slice-1 --head feat/phase3-remediation --title "Phase 3 remédiation : quick wins & config (P3-1/2/3/4/5/7)" --body "$(cat <<'EOF'
## Summary

Implémentation des 6 actions Phase 3 "quick wins & config" du plan de remédiation. Hors scope : P3-6 (hot-reload, dépend auth) et P3-8 (leaflet-curve, spec séparé).

- **P3-3** rteEicSet pré-calculé dans \`RegistryService.onModuleInit\` + getter \`getRteEicSet()\` — dette m12
- **P3-7** Nettoyage whitelist \`USABLE_CSV_FILES\` : retrait \`message_type.csv\` + \`message_upload_route.csv\` — dette m14
- **P3-2** \`ISRECENT_THRESHOLD_MS\` configurable via env var, fallback 24h — dette m8
- **P3-1** Re-packaging du zip persisté : retrait des 3 fichiers sensibles avant \`writeFile\` — dette m5
- **P3-4** \`mapConfig\` externalisé : nouveau type \`MapConfig\` dans \`@carto-ecp/shared\`, consommé par le frontend via \`graph.mapConfig\` — dette m13
- **P3-5** ADR-022 : adopter \`nestjs-zod\` pour futurs endpoints NestJS — dette m11

Spec : \`docs/superpowers/specs/2026-04-18-phase3-remediation-design.md\`
Plan : \`docs/superpowers/plans/2026-04-18-phase3-remediation.md\`

## Test plan

- [x] \`pnpm install --frozen-lockfile\` / lint / typecheck / test → exit 0
- [x] \`pnpm test:e2e\` → 3/3 Playwright smokes
- [x] 5 nouveaux tests (rteEicSet, whitelist, isRecent env var, getMapConfig, mapConfig dans graph)
- [x] 1 nouveau test P3-1 : repackage retire bien les 3 fichiers sensibles

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected : URL de PR imprimée.
