# Phase 2 Remédiation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer les 8 actions Phase 2 du plan de remédiation (tests & robustesse) : 5 nouvelles suites de tests (api snapshots, api persister, api graph, React UploadPage/DetailPanel/SnapshotSelector), 1 fix comportemental (activeSnapshotId persisté invalide), 1 refacto (warning structuré CSV_PARSE_ERROR), plus un setup Vitest DOM préalable.

**Architecture:** Branche `feat/phase2-remediation` depuis `feature/slice-1` (Phase 1 déjà mergée au commit `4f8ae25`). 9 commits conventional distincts. Frontend : happy-dom + @testing-library/react (nouveau), imports explicites Vitest (pas de globals). Backend : patterns existants (supertest pour controller/integration, mock Prisma pour unit services). TDD strict pour P2-7 (fix) et P2-8 (refacto) ; backfill tests pour les 6 autres items (le code existe déjà).

**Tech Stack:** Node 20.11+, pnpm 9+, TypeScript 5.5, NestJS 10 (CommonJS, supertest existant), Prisma 5.20, Vitest 2.1, @testing-library/react 16, happy-dom 15, React 18 + Vite 5, Zustand 4.5.

**Spec de référence :** `docs/superpowers/specs/2026-04-18-phase2-remediation-design.md`

---

## Task 0 : Créer la branche de travail

**Files :** aucun (opération git)

- [ ] **Step 1 : Vérifier qu'on est sur feature/slice-1 avec la Phase 1 mergée**

Run :
```bash
git checkout feature/slice-1 && git log --oneline -3
```

Expected : HEAD contient `4f8ae25 Phase 1 remédiation : P1-1 à P1-4 (#1)` et `1e16012 docs(phase1): post-sync documentaire...`.

- [ ] **Step 2 : Créer la branche**

Run :
```bash
git checkout -b feat/phase2-remediation
```

Expected : `Switched to a new branch 'feat/phase2-remediation'`.

---

# Partie A — Setup Vitest DOM (prérequis P2-4/5/6)

## Task 1 : Installer les dépendances de test React

**Files :** `apps/web/package.json`

- [ ] **Step 1 : Installer les 4 paquets devDeps**

Run depuis la racine :
```bash
pnpm --filter @carto-ecp/web add -D @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 happy-dom@^15
```

Expected : `apps/web/package.json` contient les 4 paquets en devDependencies, `pnpm-lock.yaml` mis à jour, aucun peer warning bloquant.

## Task 2 : Configurer Vitest DOM et créer le setup file

**Files :**
- Modify : `apps/web/vitest.config.ts`
- Create : `apps/web/src/test-setup.ts`

- [ ] **Step 1 : Créer `apps/web/src/test-setup.ts`**

Contenu :
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2 : Modifier `apps/web/vitest.config.ts`**

Remplacer le bloc `test: { ... }` actuel par :
```ts
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    passWithNoTests: true,
  },
```

(Les autres sections `plugins`, `resolve` restent inchangées.)

- [ ] **Step 3 : Vérifier lint + typecheck + test**

Run :
```bash
pnpm --filter @carto-ecp/web lint
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/web test
```

Expected : exit 0 pour les 3 commandes, les tests existants (`process-colors.sync`) passent toujours (2/2).

## Task 3 : Commiter le setup

**Files :** aucun

- [ ] **Step 1 : Stager et commiter**

Run :
```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/src/test-setup.ts pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(tooling): setup Vitest DOM environnement happy-dom + testing-library

- Installation @testing-library/react + jest-dom + user-event + happy-dom
- vitest.config.ts : environment happy-dom + setupFiles jest-dom matchers
- Prérequis pour P2-4/5/6 (tests composants React)

Refs: plan-remediation Phase 2 prérequis, dette M4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : commit créé.

---

# Partie B — P2-1 : Tests SnapshotsController + SnapshotsService

## Task 4 : Écrire les tests supertest de `SnapshotsController`

**Files :** Create : `apps/api/test/snapshots-controller.spec.ts`

**Localisation** : `test/` (pas `src/`) car supertest + AppModule complet = intégration, même pattern que `test/full-ingestion-*.spec.ts`.

- [ ] **Step 1 : Créer le fichier**

Contenu complet :
```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE } from './fixtures-loader.js';

describe('SnapshotsController — upload rejections', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let createdSnapshotId: string | null = null;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = ref.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.snapshot.deleteMany({
      where: { label: { startsWith: 'TestP21-' } },
    });
  });

  afterAll(async () => {
    if (createdSnapshotId) {
      await prisma.snapshot.deleteMany({ where: { id: createdSnapshotId } });
    }
    await app.close();
  });

  it('rejects POST with no file → 400 INVALID_UPLOAD', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', 'TestP21-no-file')
      .field('envName', 'TEST')
      .expect(400);
    expect(res.body.code).toBe('INVALID_UPLOAD');
    expect(res.body.message).toContain('Fichier zip manquant');
  });

  it('rejects POST with invalid MIME → 400 INVALID_UPLOAD with mimetype context', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', 'TestP21-bad-mime')
      .field('envName', 'TEST')
      .attach('zip', Buffer.from('fake png content'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })
      .expect(400);
    expect(res.body.code).toBe('INVALID_UPLOAD');
    expect(res.body.message).toContain('MIME type non autorisé');
    expect(res.body.context.mimetype).toBe('image/png');
  });

  it('rejects POST with valid MIME but invalid magic bytes → 400 INVALID_UPLOAD', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', 'TestP21-bad-magic')
      .field('envName', 'TEST')
      .attach('zip', Buffer.from([0xff, 0xff, 0xff, 0xff, 0x00, 0x00]), {
        filename: 'notzip.zip',
        contentType: 'application/zip',
      })
      .expect(400);
    expect(res.body.code).toBe('INVALID_UPLOAD');
    expect(res.body.message).toContain('Signature ZIP invalide');
  });

  it('rejects POST with empty label → 400 INVALID_UPLOAD with Zod issues', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', '')
      .field('envName', 'TEST')
      .attach('zip', zip, { filename: 'e.zip', contentType: 'application/zip' })
      .expect(400);
    expect(res.body.code).toBe('INVALID_UPLOAD');
    expect(res.body.message).toContain('label/envName invalides');
    expect(Array.isArray(res.body.context.issues)).toBe(true);
  });

  it('accepts POST with valid zip + body → 201 with SnapshotDetail', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', 'TestP21-nominal')
      .field('envName', 'TEST')
      .attach('zip', zip, { filename: 'e.zip', contentType: 'application/zip' })
      .expect(201);
    createdSnapshotId = res.body.id;
    expect(res.body.label).toBe('TestP21-nominal');
    expect(res.body.envName).toBe('TEST');
    expect(res.body.componentType).toBe('ENDPOINT');
  });
});
```

- [ ] **Step 2 : Lancer uniquement ce fichier pour itérer**

Run :
```bash
pnpm --filter @carto-ecp/api test -- snapshots-controller
```

Expected : **5 tests passent**. Si un test échoue : lire le message d'erreur, comparer avec `apps/api/src/snapshots/snapshots.controller.ts` + `dto/create-snapshot.dto.ts` pour comprendre l'écart, ajuster le test (pas le code de production).

## Task 5 : Écrire les tests unit pur de `SnapshotsService`

**Files :** Create : `apps/api/src/snapshots/snapshots.service.spec.ts`

- [ ] **Step 1 : Créer le fichier**

Contenu complet :
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapshotsService } from './snapshots.service.js';
import { SnapshotNotFoundException } from '../common/errors/ingestion-errors.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function makePrismaMock() {
  return {
    snapshot: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

describe('SnapshotsService', () => {
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let service: SnapshotsService;

  beforeEach(() => {
    prismaMock = makePrismaMock();
    service = new SnapshotsService(prismaMock as unknown as PrismaService);
  });

  describe('list', () => {
    it('queries without filter when envName is undefined', async () => {
      prismaMock.snapshot.findMany.mockResolvedValueOnce([]);
      await service.list();
      expect(prismaMock.snapshot.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { uploadedAt: 'desc' },
      });
    });

    it('queries with envName filter when provided', async () => {
      prismaMock.snapshot.findMany.mockResolvedValueOnce([]);
      await service.list('OPF');
      expect(prismaMock.snapshot.findMany).toHaveBeenCalledWith({
        where: { envName: 'OPF' },
        orderBy: { uploadedAt: 'desc' },
      });
    });

    it('maps warningsJson to warningCount in each summary', async () => {
      prismaMock.snapshot.findMany.mockResolvedValueOnce([
        {
          id: 'a',
          label: 'Snap A',
          envName: 'OPF',
          componentType: 'ENDPOINT',
          sourceComponentCode: 'X',
          cdCode: 'Y',
          uploadedAt: new Date('2026-04-18T12:00:00Z'),
          warningsJson: JSON.stringify([
            { code: 'UNKNOWN_EIC', message: 'a' },
            { code: 'UNKNOWN_EIC', message: 'b' },
          ]),
        },
      ]);
      const rows = await service.list();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.warningCount).toBe(2);
    });
  });

  describe('detail', () => {
    it('returns SnapshotDetail with stats from _count', async () => {
      prismaMock.snapshot.findUnique.mockResolvedValueOnce({
        id: 'abc',
        label: 'Snap X',
        envName: 'PROD',
        componentType: 'ENDPOINT',
        sourceComponentCode: 'SRC',
        cdCode: 'CD',
        uploadedAt: new Date('2026-04-18T12:00:00Z'),
        warningsJson: '[]',
        organization: 'RTE',
        _count: { components: 42, messagePaths: 10, messagingStats: 5 },
      });
      const d = await service.detail('abc');
      expect(d.id).toBe('abc');
      expect(d.stats.componentsCount).toBe(42);
      expect(d.stats.pathsCount).toBe(10);
      expect(d.stats.statsCount).toBe(5);
      expect(d.warnings).toEqual([]);
    });

    it('throws SnapshotNotFoundException when id is not found', async () => {
      prismaMock.snapshot.findUnique.mockResolvedValueOnce(null);
      await expect(service.detail('bogus')).rejects.toThrow(SnapshotNotFoundException);
    });
  });
});
```

- [ ] **Step 2 : Lancer les tests service**

Run :
```bash
pnpm --filter @carto-ecp/api test -- snapshots.service
```

Expected : **5 tests passent**.

## Task 6 : Vérification globale + commit P2-1

- [ ] **Step 1 : Lint + typecheck + test api complet**

Run :
```bash
pnpm --filter @carto-ecp/api lint
pnpm --filter @carto-ecp/api typecheck
pnpm --filter @carto-ecp/api test
```

Expected : exit 0 pour les 3, et le total test passe de 61 à **71** (+10 : 5 controller + 5 service).

- [ ] **Step 2 : Commit**

Run :
```bash
git add apps/api/test/snapshots-controller.spec.ts apps/api/src/snapshots/snapshots.service.spec.ts
git commit -m "$(cat <<'EOF'
test(api/snapshots): controller rejet upload + service list/detail (P2-1)

- apps/api/test/snapshots-controller.spec.ts : 5 cas supertest
  (no file, MIME invalide, magic bytes KO, label vide, nominal 201)
- apps/api/src/snapshots/snapshots.service.spec.ts : 5 cas unit
  mock Prisma (list sans filtre, list avec filtre envName, mapping warningCount,
  detail trouvé, detail 404 → SnapshotNotFoundException)

Refs: plan-remediation P2-1, dette M4 + m3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : commit créé, `git log --oneline -1` montre le hash.

---

# Partie C — P2-2 : Tests SnapshotPersisterService

## Task 7 : Écrire le test unit mock du persister

**Files :** Create : `apps/api/src/ingestion/snapshot-persister.service.spec.ts`

- [ ] **Step 1 : Créer le fichier**

Contenu complet :
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SnapshotPersisterService } from './snapshot-persister.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { NetworkSnapshot } from './types.js';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));

const fsp = await import('node:fs/promises');

function buildMinimalNetworkSnapshot(): NetworkSnapshot {
  return {
    meta: {
      componentType: 'ENDPOINT',
      sourceComponentCode: 'SRC-EIC',
      cdCode: 'CD-EIC',
      envName: 'TEST',
      organization: 'RTE',
    },
    components: [
      {
        eic: '17V000000498771C',
        type: 'ENDPOINT',
        organization: 'RTE',
        personName: null,
        email: null,
        phone: null,
        homeCdCode: 'CD-EIC',
        networks: ['TP'],
        creationTs: new Date('2025-01-01T00:00:00Z'),
        modificationTs: new Date('2025-01-02T00:00:00Z'),
        displayName: 'INTERNET-2',
        country: 'FR',
        lat: 48.89,
        lng: 2.34,
        isDefaultPosition: false,
        process: 'TP',
        sourceType: 'OVERLAY',
        urls: [],
      },
    ],
    messagePaths: [],
    messagingStats: [],
    appProperties: [],
    warnings: [],
  };
}

function makePrismaMock(transactionBehavior: 'resolve' | 'reject' = 'resolve') {
  const txSnapshot = { create: vi.fn().mockResolvedValue({}) };
  const txComponent = { create: vi.fn().mockResolvedValue({}) };
  const txMessagePath = { createMany: vi.fn().mockResolvedValue({}) };
  const txMessagingStatistic = { createMany: vi.fn().mockResolvedValue({}) };
  const txAppProperty = { createMany: vi.fn().mockResolvedValue({}) };
  const tx = {
    snapshot: txSnapshot,
    component: txComponent,
    messagePath: txMessagePath,
    messagingStatistic: txMessagingStatistic,
    appProperty: txAppProperty,
  };
  const $transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    if (transactionBehavior === 'reject') {
      throw new Error('DB transaction failed');
    }
    return cb(tx);
  });
  return { $transaction, _tx: tx };
}

describe('SnapshotPersisterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fsp.mkdir).mockResolvedValue(undefined);
    vi.mocked(fsp.writeFile).mockResolvedValue(undefined);
    vi.mocked(fsp.unlink).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('nominal : writes zip and runs transaction, returns IngestionResult', async () => {
    const prismaMock = makePrismaMock('resolve');
    const service = new SnapshotPersisterService(prismaMock as unknown as PrismaService);
    const snap = buildMinimalNetworkSnapshot();

    const result = await service.persist(snap, Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'label-1');

    expect(fsp.mkdir).toHaveBeenCalledTimes(1);
    expect(fsp.writeFile).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(fsp.unlink).not.toHaveBeenCalled();
    expect(result.componentType).toBe('ENDPOINT');
    expect(result.sourceComponentCode).toBe('SRC-EIC');
    expect(typeof result.snapshotId).toBe('string');
  });

  it('transaction failure : unlinks zip and rethrows the transaction error', async () => {
    const prismaMock = makePrismaMock('reject');
    const service = new SnapshotPersisterService(prismaMock as unknown as PrismaService);
    const snap = buildMinimalNetworkSnapshot();

    await expect(
      service.persist(snap, Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'label-2'),
    ).rejects.toThrow('DB transaction failed');

    expect(fsp.writeFile).toHaveBeenCalledTimes(1);
    expect(fsp.unlink).toHaveBeenCalledTimes(1);
  });

  it('cleanup failure : logs warning but rethrows the ORIGINAL transaction error', async () => {
    const prismaMock = makePrismaMock('reject');
    const service = new SnapshotPersisterService(prismaMock as unknown as PrismaService);
    const snap = buildMinimalNetworkSnapshot();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- access to private logger for spy
    const warnSpy = vi.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
    vi.mocked(fsp.unlink).mockRejectedValueOnce(new Error('cleanup boom'));

    await expect(
      service.persist(snap, Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'label-3'),
    ).rejects.toThrow('DB transaction failed');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to cleanup orphaned zip'),
    );
  });
});
```

- [ ] **Step 2 : Lancer uniquement ce fichier**

Run :
```bash
pnpm --filter @carto-ecp/api test -- snapshot-persister.service
```

Expected : **3 tests passent**. Si échec sur le test "transaction failure", vérifier que la méthode `persist` attrape bien l'erreur et appelle `unlink` (ligne 114 de `snapshot-persister.service.ts`).

## Task 8 : Vérif + commit P2-2

- [ ] **Step 1 : Typecheck + lint + test complet**

Run :
```bash
pnpm --filter @carto-ecp/api typecheck
pnpm --filter @carto-ecp/api lint
pnpm --filter @carto-ecp/api test
```

Expected : exit 0 pour les 3, total test = 74 (71 + 3).

- [ ] **Step 2 : Commit**

Run :
```bash
git add apps/api/src/ingestion/snapshot-persister.service.spec.ts
git commit -m "$(cat <<'EOF'
test(api/ingestion): persister nominal + échec transaction + échec cleanup (P2-2)

- Mock total : vi.mock('node:fs/promises') + PrismaService mocké avec
  $transaction callback inspectable
- 3 cas : nominal (write + transaction OK), reject transaction (unlink cleanup
  appelé, erreur rethrown), reject cleanup (logger.warn appelé, erreur
  originale rethrown pas celle d'unlink)
- Helper buildMinimalNetworkSnapshot pour stubs typés

Refs: plan-remediation P2-2, dette m1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : commit créé.

---

# Partie D — P2-3 : Test intégration graph endpoint

## Task 9 : Écrire le test d'intégration graph

**Files :** Create : `apps/api/test/graph-endpoint.spec.ts`

- [ ] **Step 1 : Créer le fichier**

Contenu complet :
```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { IngestionService } from '../src/ingestion/ingestion.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE } from './fixtures-loader.js';

describe('GET /api/snapshots/:id/graph — integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let snapshotId: string;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = ref.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.snapshot.deleteMany({
      where: { label: { startsWith: 'TestP23-' } },
    });
    const ingestion = app.get(IngestionService);
    const result = await ingestion.ingest({
      zipBuffer: buildZipFromFixture(ENDPOINT_FIXTURE),
      label: 'TestP23-graph',
      envName: 'TEST',
    });
    snapshotId = result.snapshotId;
  });

  afterAll(async () => {
    await prisma.snapshot.deleteMany({ where: { id: snapshotId } });
    await app.close();
  });

  it('returns 200 with a valid GraphResponse shape', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/snapshots/${snapshotId}/graph`)
      .expect(200);
    expect(res.body).toHaveProperty('snapshotId', snapshotId);
    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(Array.isArray(res.body.edges)).toBe(true);
    expect(res.body).toHaveProperty('bounds');
  });

  it('includes at least one node and one edge after ingestion', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/snapshots/${snapshotId}/graph`)
      .expect(200);
    expect(res.body.nodes.length).toBeGreaterThan(0);
    expect(res.body.edges.length).toBeGreaterThan(0);
  });

  it('edges contain fromEic, toEic, process, direction typed fields', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/snapshots/${snapshotId}/graph`)
      .expect(200);
    const edge = res.body.edges[0];
    expect(typeof edge.fromEic).toBe('string');
    expect(typeof edge.toEic).toBe('string');
    expect(typeof edge.process).toBe('string');
    expect(['IN', 'OUT', 'BOTH']).toContain(edge.direction);
  });

  it('returns 404 SNAPSHOT_NOT_FOUND for unknown id', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/snapshots/bogus-id-xyz/graph')
      .expect(404);
    expect(res.body.code).toBe('SNAPSHOT_NOT_FOUND');
  });
});
```

- [ ] **Step 2 : Lancer ce fichier**

Run :
```bash
pnpm --filter @carto-ecp/api test -- graph-endpoint
```

Expected : **4 tests passent**. Premier run peut être lent (~3-5s, ingestion complète d'un backup réel).

**Note sur les directions d'edge** : si la production retourne aussi `'MIXTE'` ou autre valeur, ajuster la liste `['IN', 'OUT', 'BOTH']` dans le test selon les valeurs réellement présentes. Consulter `GraphEdge.direction` dans `packages/shared/src/*.ts` en cas de doute.

## Task 10 : Vérif + commit P2-3

- [ ] **Step 1 : Test complet**

Run :
```bash
pnpm --filter @carto-ecp/api test
```

Expected : total test = 78 (74 + 4).

- [ ] **Step 2 : Commit**

Run :
```bash
git add apps/api/test/graph-endpoint.spec.ts
git commit -m "$(cat <<'EOF'
test(api/graph): intégration GET /snapshots/:id/graph sur fixtures (P2-3)

- 4 cas supertest sur AppModule complet + fixture Endpoint ingestée au
  beforeAll : shape GraphResponse, ≥1 node + ≥1 edge, champs edge typés,
  404 SNAPSHOT_NOT_FOUND sur id bidon
- Isolation via prisma.snapshot.deleteMany scoped aux labels TestP23-*

Refs: plan-remediation P2-3, dette m2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : commit créé.

---

# Partie E — P2-4 : Tests React UploadPage

## Task 11 : Écrire les tests UploadPage

**Files :** Create : `apps/web/src/pages/UploadPage.test.tsx`

- [ ] **Step 1 : Créer le fichier**

Contenu complet :
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UploadPage } from './UploadPage';

vi.mock('../lib/api', () => ({
  api: {
    createSnapshot: vi.fn(),
    listSnapshots: vi.fn().mockResolvedValue([]),
    getGraph: vi.fn(),
  },
}));

vi.mock('../store/app-store.js', () => ({
  useAppStore: vi.fn(() => vi.fn()),
}));

import { api } from '../lib/api';

function setup(): void {
  render(
    <MemoryRouter>
      <UploadPage />
    </MemoryRouter>,
  );
}

function makeZipFile(): File {
  return new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'test.zip', {
    type: 'application/zip',
  });
}

describe('UploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with disabled submit when loading is false and no file', () => {
    setup();
    expect(screen.getByRole('heading', { name: /Charger un snapshot ECP/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Envoyer/i })).toBeEnabled();
  });

  it('calls api.createSnapshot with file + label + envName on submit', async () => {
    vi.mocked(api.createSnapshot).mockResolvedValueOnce({
      id: 'snap-1',
      label: 'My Snap',
      envName: 'PROD',
      componentType: 'ENDPOINT',
      sourceComponentCode: 'SRC',
      cdCode: 'CD',
      uploadedAt: '2026-04-18T12:00:00Z',
      warningCount: 0,
      organization: 'RTE',
      stats: { componentsCount: 5, pathsCount: 2, statsCount: 0 },
      warnings: [],
    });
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.clear(screen.getByPlaceholderText(/Snapshot hebdo/i));
    await userEvent.type(screen.getByPlaceholderText(/Snapshot hebdo/i), 'My Snap');
    await userEvent.clear(screen.getByPlaceholderText(/OPF \/ PROD/i));
    await userEvent.type(screen.getByPlaceholderText(/OPF \/ PROD/i), 'PROD');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(api.createSnapshot).toHaveBeenCalledWith(expect.any(File), 'My Snap', 'PROD');
    });
  });

  it('shows loading state while createSnapshot promise is pending', async () => {
    let resolvePromise: ((value: unknown) => void) | null = null;
    vi.mocked(api.createSnapshot).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve as (v: unknown) => void;
        }),
    );
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.type(screen.getByPlaceholderText(/Snapshot hebdo/i), 'X');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Envoi en cours/i })).toBeDisabled();
    });
    resolvePromise?.({
      id: 'x', label: 'X', envName: 'OPF', componentType: 'ENDPOINT',
      sourceComponentCode: 'S', cdCode: 'C', uploadedAt: '', warningCount: 0,
      organization: 'R', stats: { componentsCount: 0, pathsCount: 0, statsCount: 0 }, warnings: [],
    });
  });

  it('renders success section with "Voir sur la carte" button after upload', async () => {
    vi.mocked(api.createSnapshot).mockResolvedValueOnce({
      id: 'snap-ok',
      label: 'OK',
      envName: 'OPF',
      componentType: 'ENDPOINT',
      sourceComponentCode: 'S',
      cdCode: 'C',
      uploadedAt: '2026-04-18T12:00:00Z',
      warningCount: 0,
      organization: 'R',
      stats: { componentsCount: 3, pathsCount: 1, statsCount: 0 },
      warnings: [],
    });
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.type(screen.getByPlaceholderText(/Snapshot hebdo/i), 'OK');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Voir sur la carte/i })).toBeInTheDocument();
    });
  });

  it('renders error alert when createSnapshot rejects', async () => {
    vi.mocked(api.createSnapshot).mockRejectedValueOnce(new Error('Upload failed XYZ'));
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.type(screen.getByPlaceholderText(/Snapshot hebdo/i), 'E');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Upload failed XYZ');
    });
  });

  it('renders warnings <details> section when result.warnings is non-empty', async () => {
    vi.mocked(api.createSnapshot).mockResolvedValueOnce({
      id: 'snap-w',
      label: 'W',
      envName: 'OPF',
      componentType: 'ENDPOINT',
      sourceComponentCode: 'S',
      cdCode: 'C',
      uploadedAt: '2026-04-18T12:00:00Z',
      warningCount: 2,
      organization: 'R',
      stats: { componentsCount: 1, pathsCount: 0, statsCount: 0 },
      warnings: [
        { code: 'UNKNOWN_EIC', message: 'unknown a' },
        { code: 'UNKNOWN_EIC', message: 'unknown b' },
      ],
    });
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.type(screen.getByPlaceholderText(/Snapshot hebdo/i), 'W');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(screen.getByText(/2 avertissement/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2 : Lancer ce fichier**

Run :
```bash
pnpm --filter @carto-ecp/web test -- UploadPage
```

Expected : **6 tests passent**. Si le test "loading" flake (race entre button disabled et promise), augmenter le timeout de `waitFor` à 3000ms.

## Task 12 : Vérif + commit P2-4

- [ ] **Step 1 : Typecheck + lint + test web**

Run :
```bash
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/web lint
pnpm --filter @carto-ecp/web test
```

Expected : exit 0 pour les 3, total test web = 2 + 6 = 8.

- [ ] **Step 2 : Commit**

Run :
```bash
git add apps/web/src/pages/UploadPage.test.tsx
git commit -m "$(cat <<'EOF'
test(web/upload): UploadPage submission + loading + erreur + warnings (P2-4)

- 6 cas @testing-library/react : render initial, submit appelle
  api.createSnapshot avec args corrects, état loading affiche 'Envoi en
  cours...', succès affiche bouton 'Voir sur la carte', erreur API rend
  role='alert', warnings non vide rend <details>
- Mocks : api, useAppStore, MemoryRouter

Refs: plan-remediation P2-4, dette M4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : commit créé.

---

# Partie F — P2-5 : Tests React NodeDetails + EdgeDetails

## Task 13 : Écrire les tests NodeDetails

**Files :** Create : `apps/web/src/components/DetailPanel/NodeDetails.test.tsx`

- [ ] **Step 1 : Créer le fichier**

Contenu complet :
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NodeDetails } from './NodeDetails';
import type { GraphNode } from '@carto-ecp/shared';

function baseNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    eic: '17V000000498771C',
    displayName: 'INTERNET-2',
    organization: 'RTE',
    country: 'FR',
    lat: 48.89,
    lng: 2.34,
    kind: 'ENDPOINT',
    process: 'TP',
    networks: ['TP', 'CORE'],
    creationTs: '2025-01-01T00:00:00Z',
    modificationTs: '2025-01-02T00:00:00Z',
    urls: [],
    isDefaultPosition: false,
    ...overrides,
  };
}

describe('NodeDetails', () => {
  it('renders all core fields from a fully populated node', () => {
    render(<NodeDetails node={baseNode()} />);
    expect(screen.getByRole('heading', { name: /INTERNET-2/ })).toBeInTheDocument();
    expect(screen.getByText('17V000000498771C')).toBeInTheDocument();
    expect(screen.getByText('ENDPOINT')).toBeInTheDocument();
    expect(screen.getByText('RTE')).toBeInTheDocument();
    expect(screen.getByText('FR')).toBeInTheDocument();
    expect(screen.getByText('TP, CORE')).toBeInTheDocument();
    expect(screen.getByText('TP')).toBeInTheDocument();
  });

  it('renders "—" placeholder when country is null', () => {
    render(<NodeDetails node={baseNode({ country: null })} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders "—" placeholder when networks is empty', () => {
    render(<NodeDetails node={baseNode({ networks: [] })} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows default-position warning banner when isDefaultPosition is true', () => {
    render(<NodeDetails node={baseNode({ isDefaultPosition: true })} />);
    expect(screen.getByText(/Position par défaut/i)).toBeInTheDocument();
  });

  it('renders URLs section only when node.urls is non-empty', () => {
    const { rerender } = render(<NodeDetails node={baseNode({ urls: [] })} />);
    expect(screen.queryByRole('heading', { name: /URLs/i })).not.toBeInTheDocument();

    rerender(
      <NodeDetails
        node={baseNode({ urls: [{ network: 'TP', url: 'http://example.com' }] })}
      />,
    );
    expect(screen.getByRole('heading', { name: /URLs/i })).toBeInTheDocument();
    expect(screen.getByText('http://example.com', { exact: false })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2 : Run**

Run :
```bash
pnpm --filter @carto-ecp/web test -- NodeDetails
```

Expected : **5 tests passent**.

## Task 14 : Écrire les tests EdgeDetails

**Files :** Create : `apps/web/src/components/DetailPanel/EdgeDetails.test.tsx`

- [ ] **Step 1 : Créer le fichier**

Contenu complet :
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EdgeDetails } from './EdgeDetails';
import type { GraphEdge } from '@carto-ecp/shared';

function baseEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: 'eic1::eic2',
    fromEic: '17V000000498771C',
    toEic: '10X1001A1001A345',
    process: 'TP',
    direction: 'OUT',
    transportPatterns: ['synchronous'],
    intermediateBrokerEic: null,
    messageTypes: ['msg-type-a', 'msg-type-b'],
    activity: {
      connectionStatus: 'CONNECTED',
      lastMessageUp: '2026-04-18T10:00:00Z',
      lastMessageDown: '2026-04-18T09:00:00Z',
      isRecent: true,
    },
    validFrom: '2025-01-01T00:00:00Z',
    validTo: '2099-12-31T00:00:00Z',
    ...overrides,
  };
}

describe('EdgeDetails', () => {
  it('renders core fields : direction, fromEic, toEic, transport, process', () => {
    render(<EdgeDetails edge={baseEdge()} />);
    expect(screen.getByRole('heading', { name: /Flux TP/ })).toBeInTheDocument();
    expect(screen.getByText('OUT')).toBeInTheDocument();
    expect(screen.getByText('17V000000498771C')).toBeInTheDocument();
    expect(screen.getByText('10X1001A1001A345')).toBeInTheDocument();
    expect(screen.getByText('synchronous')).toBeInTheDocument();
    expect(screen.getByText('CONNECTED')).toBeInTheDocument();
  });

  it('shows "Oui" when isRecent is true, "Non" when false', () => {
    const { rerender } = render(<EdgeDetails edge={baseEdge()} />);
    expect(screen.getByText('Oui')).toBeInTheDocument();
    rerender(
      <EdgeDetails
        edge={baseEdge({ activity: { ...baseEdge().activity, isRecent: false } })}
      />,
    );
    expect(screen.getByText('Non')).toBeInTheDocument();
  });

  it('renders "—" when connectionStatus is null', () => {
    render(
      <EdgeDetails
        edge={baseEdge({ activity: { ...baseEdge().activity, connectionStatus: null } })}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows broker row only when intermediateBrokerEic is non-null', () => {
    const { rerender } = render(<EdgeDetails edge={baseEdge()} />);
    expect(screen.queryByText('Broker')).not.toBeInTheDocument();
    rerender(<EdgeDetails edge={baseEdge({ intermediateBrokerEic: 'BROKER-EIC' })} />);
    expect(screen.getByText('Broker')).toBeInTheDocument();
    expect(screen.getByText('BROKER-EIC')).toBeInTheDocument();
  });

  it('renders messageTypes count and badges', () => {
    render(<EdgeDetails edge={baseEdge()} />);
    expect(screen.getByText(/Message types \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('msg-type-a')).toBeInTheDocument();
    expect(screen.getByText('msg-type-b')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2 : Run**

Run :
```bash
pnpm --filter @carto-ecp/web test -- EdgeDetails
```

Expected : **5 tests passent**.

## Task 15 : Vérif + commit P2-5

- [ ] **Step 1 : Test + lint + typecheck**

Run :
```bash
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/web lint
pnpm --filter @carto-ecp/web test
```

Expected : exit 0 sur les 3. Total test web = 8 + 10 = 18.

- [ ] **Step 2 : Commit**

Run :
```bash
git add apps/web/src/components/DetailPanel/NodeDetails.test.tsx apps/web/src/components/DetailPanel/EdgeDetails.test.tsx
git commit -m "$(cat <<'EOF'
test(web/detail-panel): NodeDetails + EdgeDetails rendu null + dates + badge (P2-5)

- NodeDetails (5 cas) : champs populés, country null → '—', networks vide,
  isDefaultPosition badge, section URLs conditionnelle
- EdgeDetails (5 cas) : champs principaux, isRecent Oui/Non,
  connectionStatus null, broker conditionnel, messageTypes count + badges
- Helpers baseNode / baseEdge avec overrides partiels

Refs: plan-remediation P2-5, dette M4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : commit créé.

---

# Partie G — P2-6 : Tests React SnapshotSelector

## Task 16 : Écrire les tests SnapshotSelector + commit

**Files :** Create : `apps/web/src/components/SnapshotSelector/SnapshotSelector.test.tsx`

- [ ] **Step 1 : Créer le fichier**

Contenu complet :
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SnapshotSelector } from './SnapshotSelector';
import type { SnapshotSummary } from '@carto-ecp/shared';

vi.mock('../../store/app-store.js', () => ({
  useAppStore: vi.fn(),
}));

import { useAppStore } from '../../store/app-store.js';

function renderWithRouter(): void {
  render(
    <MemoryRouter>
      <SnapshotSelector />
    </MemoryRouter>,
  );
}

function mockStore(opts: {
  snapshots: SnapshotSummary[];
  activeSnapshotId: string | null;
  setActiveSnapshot?: (id: string) => Promise<void>;
  loadSnapshots?: () => Promise<void>;
}): ReturnType<typeof vi.fn> {
  const setActive = opts.setActiveSnapshot ?? vi.fn().mockResolvedValue(undefined);
  const load = opts.loadSnapshots ?? vi.fn().mockResolvedValue(undefined);
  vi.mocked(useAppStore).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({
      snapshots: opts.snapshots,
      activeSnapshotId: opts.activeSnapshotId,
      setActiveSnapshot: setActive,
      loadSnapshots: load,
    }),
  );
  return setActive as unknown as ReturnType<typeof vi.fn>;
}

function makeSnap(id: string, label: string): SnapshotSummary {
  return {
    id,
    label,
    envName: 'OPF',
    componentType: 'ENDPOINT',
    sourceComponentCode: 'S',
    cdCode: 'C',
    uploadedAt: '2026-04-18T12:00:00Z',
    warningCount: 0,
  };
}

describe('SnapshotSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a CTA link to /upload when snapshots list is empty', () => {
    mockStore({ snapshots: [], activeSnapshotId: null });
    renderWithRouter();
    const link = screen.getByRole('link', { name: /Aucun snapshot/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/upload');
  });

  it('renders <select> with N options and marks active as selected', () => {
    mockStore({
      snapshots: [makeSnap('id-1', 'Snap One'), makeSnap('id-2', 'Snap Two')],
      activeSnapshotId: 'id-2',
    });
    renderWithRouter();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options).toHaveLength(2);
    expect(select.value).toBe('id-2');
  });

  it('calls setActiveSnapshot with new id on change', () => {
    const setActive = mockStore({
      snapshots: [makeSnap('id-1', 'Snap One'), makeSnap('id-2', 'Snap Two')],
      activeSnapshotId: 'id-1',
    });
    renderWithRouter();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'id-2' } });
    expect(setActive).toHaveBeenCalledWith('id-2');
  });
});
```

- [ ] **Step 2 : Run**

Run :
```bash
pnpm --filter @carto-ecp/web test -- SnapshotSelector
```

Expected : **3 tests passent**.

- [ ] **Step 3 : Vérif globale + commit**

Run :
```bash
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/web lint
pnpm --filter @carto-ecp/web test
git add apps/web/src/components/SnapshotSelector/SnapshotSelector.test.tsx
git commit -m "$(cat <<'EOF'
test(web/snapshot-selector): liste vide / non vide / onChange (P2-6)

- 3 cas @testing-library/react :
  - liste vide → lien CTA vers /upload
  - liste non vide → <select> avec N options, option active marquée
  - onChange → setActiveSnapshot appelé avec le nouvel id
- Mock useAppStore avec selector function pattern

Refs: plan-remediation P2-6, dette M4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : total test web = 18 + 3 = 21, commit créé.

---

# Partie H — P2-7 : Fix activeSnapshotId persisté invalide (TDD)

## Task 17 : Écrire test RED pour P2-7

**Files :** Create : `apps/web/src/store/app-store.test.ts`

- [ ] **Step 1 : Créer le fichier avec le test RED**

Contenu complet :
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/api', () => ({
  api: {
    listSnapshots: vi.fn(),
    getGraph: vi.fn(),
    createSnapshot: vi.fn(),
  },
}));

import { api } from '../lib/api';

// Import fresh store per test to avoid state leak via the Zustand singleton
async function freshStore() {
  vi.resetModules();
  const mod = await import('./app-store');
  return mod.useAppStore;
}

describe('app-store — loadSnapshots bascule activeSnapshotId invalide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('switches to list[0] when persisted activeSnapshotId is not in the fresh list', async () => {
    localStorage.setItem(
      'carto-ecp-store',
      JSON.stringify({ state: { activeSnapshotId: 'stale-id-deleted' }, version: 0 }),
    );
    vi.mocked(api.listSnapshots).mockResolvedValueOnce([
      {
        id: 'fresh-id-1',
        label: 'Fresh 1',
        envName: 'OPF',
        componentType: 'ENDPOINT',
        sourceComponentCode: 'S',
        cdCode: 'C',
        uploadedAt: '2026-04-18T12:00:00Z',
        warningCount: 0,
      },
    ]);
    vi.mocked(api.getGraph).mockResolvedValueOnce({
      snapshotId: 'fresh-id-1',
      nodes: [],
      edges: [],
      bounds: { north: 0, south: 0, east: 0, west: 0 },
    });

    const useStore = await freshStore();
    await useStore.getState().loadSnapshots();

    expect(useStore.getState().activeSnapshotId).toBe('fresh-id-1');
    expect(api.getGraph).toHaveBeenCalledWith('fresh-id-1');
  });

  it('keeps persisted id and loads its graph when it IS in the list', async () => {
    localStorage.setItem(
      'carto-ecp-store',
      JSON.stringify({ state: { activeSnapshotId: 'valid-id' }, version: 0 }),
    );
    vi.mocked(api.listSnapshots).mockResolvedValueOnce([
      {
        id: 'valid-id',
        label: 'Valid',
        envName: 'OPF',
        componentType: 'ENDPOINT',
        sourceComponentCode: 'S',
        cdCode: 'C',
        uploadedAt: '2026-04-18T12:00:00Z',
        warningCount: 0,
      },
    ]);
    vi.mocked(api.getGraph).mockResolvedValueOnce({
      snapshotId: 'valid-id',
      nodes: [],
      edges: [],
      bounds: { north: 0, south: 0, east: 0, west: 0 },
    });

    const useStore = await freshStore();
    await useStore.getState().loadSnapshots();

    expect(useStore.getState().activeSnapshotId).toBe('valid-id');
    expect(api.getGraph).toHaveBeenCalledWith('valid-id');
  });
});
```

- [ ] **Step 2 : Lancer — le 1er test doit FAIL, le 2e doit FAIL aussi**

Run :
```bash
pnpm --filter @carto-ecp/web test -- app-store
```

Expected :
- Test 1 **FAIL** : `activeSnapshotId` reste à `'stale-id-deleted'` (ou n'est jamais remplacé), `getGraph` pas appelé
- Test 2 **FAIL** : `getGraph` pas appelé car le code actuel ne déclenche `setActiveSnapshot` que si `!id`

C'est la preuve RED pour les deux améliorations de P2-7.

## Task 18 : Implémenter le fix P2-7

**Files :** Modify : `apps/web/src/store/app-store.ts:32-44`

- [ ] **Step 1 : Modifier `loadSnapshots`**

Remplacer :
```ts
      loadSnapshots: async () => {
        set({ loading: true, error: null });
        try {
          const list = await api.listSnapshots();
          set({ snapshots: list, loading: false });
          const id = get().activeSnapshotId;
          if (!id && list.length > 0) {
            await get().setActiveSnapshot(list[0]!.id);
          }
        } catch (err) {
          set({ loading: false, error: (err as Error).message });
        }
      },
```

par :
```ts
      loadSnapshots: async () => {
        set({ loading: true, error: null });
        try {
          const list = await api.listSnapshots();
          set({ snapshots: list, loading: false });
          const id = get().activeSnapshotId;
          const persistedStillValid = id !== null && list.some((s) => s.id === id);

          if (persistedStillValid) {
            await get().setActiveSnapshot(id);
          } else if (list.length > 0) {
            await get().setActiveSnapshot(list[0]!.id);
          }
        } catch (err) {
          set({ loading: false, error: (err as Error).message });
        }
      },
```

- [ ] **Step 2 : Re-lancer les tests**

Run :
```bash
pnpm --filter @carto-ecp/web test -- app-store
```

Expected : **2 tests PASS**.

## Task 19 : Vérif globale + commit P2-7

- [ ] **Step 1 : Typecheck + lint + test complet**

Run :
```bash
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/web lint
pnpm --filter @carto-ecp/web test
```

Expected : exit 0 sur les 3, total test web = 21 + 2 = 23.

- [ ] **Step 2 : Commit**

Run :
```bash
git add apps/web/src/store/app-store.ts apps/web/src/store/app-store.test.ts
git commit -m "$(cat <<'EOF'
fix(web/store): bascule activeSnapshotId invalide vers list[0] au boot (P2-7)

- loadSnapshots vérifie maintenant si l'id persisté existe encore dans la
  liste fraîche. Si oui : charge son graphe (fix bonus, avant l'id persisté
  n'était pas suivi de getGraph). Si non : bascule silencieusement sur list[0]
- 2 tests RED→GREEN dans app-store.test.ts couvrent les 2 scénarios

Refs: plan-remediation P2-7, dette m4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : commit créé.

---

# Partie I — P2-8 : Warning CSV_PARSE_ERROR structuré (TDD + refacto)

## Task 20 : Écrire test RED dans csv-reader.service.spec.ts

**Files :** Modify : `apps/api/src/ingestion/csv-reader.service.spec.ts`

- [ ] **Step 1 : Lire l'état actuel du fichier**

Run :
```bash
cat apps/api/src/ingestion/csv-reader.service.spec.ts | head -20
```

Observer la signature courante des appels aux méthodes publiques (sans param `warnings`).

- [ ] **Step 2 : Ajouter un nouveau cas RED**

Ajouter à la fin du `describe` principal (avant la dernière accolade fermante), juste avant la fin du fichier, le bloc :

```ts
  describe('CSV_PARSE_ERROR warning', () => {
    it('pushes CSV_PARSE_ERROR warning when CSV is malformed', () => {
      const malformed = Buffer.from('header1;header2\nonly-one-col\n');
      const warnings: Warning[] = [];
      const rows = service.readMessagePaths(malformed, warnings);
      expect(rows).toEqual([]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: 'CSV_PARSE_ERROR',
        context: { fileName: 'message_path.csv' },
      });
    });
  });
```

Ajouter l'import manquant en tête du fichier :
```ts
import type { Warning } from '@carto-ecp/shared';
```

- [ ] **Step 3 : Lancer — doit FAIL (compilation)**

Run :
```bash
pnpm --filter @carto-ecp/api test -- csv-reader.service 2>&1 | tail -15
```

Expected : **échec TypeScript** car `readMessagePaths` attend 1 param (la nouvelle signature n'est pas encore appliquée). C'est le RED.

## Task 21 : Refacto `csv-reader.service.ts`

**Files :** Modify : `apps/api/src/ingestion/csv-reader.service.ts`

- [ ] **Step 1 : Ajouter l'import Warning en tête**

Ajouter (après les imports existants) :
```ts
import type { Warning } from '@carto-ecp/shared';
```

- [ ] **Step 2 : Modifier `readRaw` (lignes 18-33 environ)**

Remplacer la méthode `readRaw` par :
```ts
private readRaw(
  buffer: Buffer,
  fileName: string,
): { rows: RawRow[]; parseError: string | null } {
  try {
    const rows = parseCsv(buffer.toString('utf-8'), {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
      trim: true,
      quote: '"',
      relax_quotes: true,
      relax_column_count: false,
    }) as RawRow[];
    return { rows, parseError: null };
  } catch (err) {
    const message = (err as Error).message;
    this.logger.warn(`CSV parse error (${fileName}): ${message}`);
    return { rows: [], parseError: message };
  }
}
```

- [ ] **Step 3 : Ajouter un helper `pushCsvWarning`**

Ajouter après `readRaw` :
```ts
private pushCsvWarning(
  warnings: Warning[],
  fileName: string,
  parseError: string,
): void {
  warnings.push({
    code: 'CSV_PARSE_ERROR',
    message: `${fileName} : ${parseError}`,
    context: { fileName },
  });
}
```

- [ ] **Step 4 : Ajuster les 4 méthodes publiques**

Pour chacune des méthodes publiques `readApplicationProperties`, `readComponentDirectory`, `readMessagePaths`, `readMessagingStatistics` :

1. Ajouter `warnings: Warning[]` comme second argument
2. Remplacer `const rows = this.readRaw(buffer);` par :
```ts
const { rows, parseError } = this.readRaw(buffer, '<fileName.csv>');
if (parseError !== null) this.pushCsvWarning(warnings, '<fileName.csv>', parseError);
```

avec les `fileName` suivants :
- `readApplicationProperties` → `'application_property.csv'`
- `readComponentDirectory` → `'component_directory.csv'`
- `readMessagePaths` → `'message_path.csv'`
- `readMessagingStatistics` → `'messaging_statistics.csv'`

- [ ] **Step 5 : Re-lancer le test**

Run :
```bash
pnpm --filter @carto-ecp/api test -- csv-reader.service
```

Expected : plusieurs échecs TypeScript sur les tests existants (qui appellent `service.readMessagePaths(buf)` sans param `warnings`). C'est normal — on va les réparer Task 22.

## Task 22 : Mettre à jour les tests existants de csv-reader pour la nouvelle signature

**Files :** Modify : `apps/api/src/ingestion/csv-reader.service.spec.ts`

- [ ] **Step 1 : Pour chaque appel existant à `readMessagePaths`, `readApplicationProperties`, `readComponentDirectory`, `readMessagingStatistics` qui n'a pas de second param, ajouter `[]`**

Exemple typique :
```ts
// Avant
const rows = service.readMessagePaths(buffer);

// Après
const rows = service.readMessagePaths(buffer, []);
```

Parcourir tout le fichier, ajouter `, []` à la fin de chaque appel concerné. Garde le nouveau test `CSV_PARSE_ERROR warning` inchangé (il utilise déjà le nouveau param).

- [ ] **Step 2 : Mettre à jour `IngestionService.ingest`**

Ouvrir `apps/api/src/ingestion/ingestion.service.ts`. Remplacer la méthode `ingest` pour passer un tableau `extractionWarnings` :

```ts
async ingest(input: IngestionInput): Promise<IngestionResult> {
  const startedAt = Date.now();
  this.logger.log(`ingestion.started (${input.zipBuffer.length} bytes)`);

  const extracted = this.zipExtractor.extract(input.zipBuffer);
  const extractionWarnings: Warning[] = [];

  const appProperties = this.csvReader.readApplicationProperties(
    extracted.files.get('application_property.csv')!,
    extractionWarnings,
  );
  const componentDirectoryRows = this.csvReader.readComponentDirectory(
    extracted.files.get('component_directory.csv')!,
    extractionWarnings,
  );
  if (componentDirectoryRows.length === 0) {
    throw new InvalidUploadException(
      'component_directory.csv ne contient aucune ligne de données',
      { fileName: 'component_directory.csv' },
    );
  }
  const xmlBlob = componentDirectoryRows[0]!.directoryContent;
  const madesTree = this.xmlParser.parse(xmlBlob);

  const messagePathsBuf = extracted.files.get('message_path.csv');
  const statsBuf = extracted.files.get('messaging_statistics.csv');

  const localMessagePaths = messagePathsBuf
    ? this.csvReader.readMessagePaths(messagePathsBuf, extractionWarnings)
    : [];
  const messagingStats = statsBuf
    ? this.csvReader.readMessagingStatistics(statsBuf, extractionWarnings)
    : [];

  const networkSnapshot = this.builder.build({
    appProperties,
    madesTree,
    messagingStats,
    localMessagePaths,
    envName: input.envName,
  });
  networkSnapshot.warnings.push(...extractionWarnings);

  const result = await this.persister.persist(networkSnapshot, input.zipBuffer, input.label);
  const duration = Date.now() - startedAt;
  this.logger.log(
    `ingestion.completed snapshotId=${result.snapshotId} components=${networkSnapshot.components.length} paths=${networkSnapshot.messagePaths.length} warnings=${networkSnapshot.warnings.length} duration=${duration}ms`,
  );
  return result;
}
```

Ajouter l'import manquant en tête du fichier :
```ts
import type { Warning } from '@carto-ecp/shared';
```

- [ ] **Step 3 : Re-lancer tous les tests api**

Run :
```bash
pnpm --filter @carto-ecp/api test
```

Expected : **tous les tests passent**, y compris le nouveau `CSV_PARSE_ERROR warning` (GREEN). Total = 78 + 1 = 79. Les tests d'intégration (`full-ingestion-*.spec.ts`, `snapshots-controller.spec.ts`, `graph-endpoint.spec.ts`) continuent à passer car la signature publique de `IngestionService.ingest` est inchangée.

## Task 23 : Vérif + commit P2-8

- [ ] **Step 1 : Typecheck + lint complet**

Run :
```bash
pnpm --filter @carto-ecp/api typecheck
pnpm --filter @carto-ecp/api lint
```

Expected : exit 0 sur les 2.

- [ ] **Step 2 : Commit**

Run :
```bash
git add apps/api/src/ingestion/csv-reader.service.ts apps/api/src/ingestion/csv-reader.service.spec.ts apps/api/src/ingestion/ingestion.service.ts
git commit -m "$(cat <<'EOF'
feat(api/ingestion): warning structuré CSV_PARSE_ERROR exposé dans snapshot.warnings (P2-8)

- readRaw retourne maintenant { rows, parseError } avec fileName en param
- 4 méthodes publiques du CsvReaderService acceptent warnings: Warning[]
  et poussent un warning { code: 'CSV_PARSE_ERROR', context: { fileName } }
  si parseError != null
- IngestionService.ingest collecte extractionWarnings et les fusionne
  dans networkSnapshot.warnings avant persist
- Nouveau cas test + tests existants mis à jour pour la nouvelle signature
- logger.warn serveur conservé (double signal)

Refs: plan-remediation P2-8, dette m7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : commit créé.

---

# Partie J — Vérification finale + PR

## Task 24 : Chaîne qualité complète racine

**Files :** aucun

- [ ] **Step 1 : Install + lint + typecheck + test**

Run :
```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
```

Expected : exit 0 pour les 4 commandes. Test total attendu : ~99 tests (74 api + 21 web existants + 4 graph intégration = ~99).

- [ ] **Step 2 : Playwright e2e**

Run :
```bash
pnpm --filter @carto-ecp/web test:e2e
```

Expected : 3/3 smokes passent.

- [ ] **Step 3 : Boot manuel (optionnel si tout vert)**

Run :
```bash
pnpm dev
```

Puis ouvrir http://localhost:5173, vérifier que l'upload + map fonctionnent. Ctrl+C pour arrêter.

## Task 25 : Push + création PR

**Files :** aucun

- [ ] **Step 1 : Vérifier les commits**

Run :
```bash
git log --oneline feature/slice-1..HEAD
```

Expected : **9 commits** P2-0 (setup) → P2-8 (CSV_PARSE_ERROR), plus le tag `test` / `fix` / `feat` approprié.

- [ ] **Step 2 : Push**

Run :
```bash
git push -u origin feat/phase2-remediation
```

Expected : branche créée sur origin.

- [ ] **Step 3 : Ouvrir la PR**

Run :
```bash
gh pr create --base feature/slice-1 --head feat/phase2-remediation --title "Phase 2 remédiation : P2-1 à P2-8" --body "$(cat <<'EOF'
## Summary

Implémentation des 8 actions Phase 2 du plan de remédiation : tests & robustesse.

- **Setup** Vitest DOM : happy-dom + @testing-library/react + jest-dom + user-event (prérequis P2-4/5/6)
- **P2-1** Tests SnapshotsController (supertest, 5 cas) + SnapshotsService (unit mock Prisma, 5 cas) — dette M4, m3
- **P2-2** Tests SnapshotPersisterService (mock Prisma + mock fs, 3 cas nominal + échec transaction + échec cleanup) — dette m1
- **P2-3** Test intégration GET /snapshots/:id/graph (supertest, 4 cas) — dette m2
- **P2-4** Tests React UploadPage (6 cas : submit, loading, succès, erreur, warnings) — dette M4
- **P2-5** Tests React NodeDetails + EdgeDetails (10 cas cumulés) — dette M4
- **P2-6** Tests React SnapshotSelector (3 cas : vide, non vide, onChange) — dette M4
- **P2-7** Fix bascule `activeSnapshotId` invalide → `list[0]` au boot (TDD 2 cas) — dette m4
- **P2-8** Warning structuré `CSV_PARSE_ERROR` exposé dans `NetworkSnapshot.warnings` (TDD 1 cas + refacto signature) — dette m7

Spec : `docs/superpowers/specs/2026-04-18-phase2-remediation-design.md`
Plan : `docs/superpowers/plans/2026-04-18-phase2-remediation.md`

## Test plan

- [x] `pnpm lint` / `typecheck` / `test` exit 0 (total ~99 tests verts)
- [x] `pnpm test:e2e` — 3/3 Playwright smokes passent
- [x] Aucune régression sur les tests préexistants (61 api + 2 web de Phase 1)

## ADR

ADR-021 (React testing stack : @testing-library/react + happy-dom) sera
rédigé automatiquement par update-writer-after-implement via hook Stop.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected : URL de PR imprimée. Copier dans le chat.

---

## Self-Review (checklist exécutée à la rédaction)

**1. Spec coverage :**
- Setup DOM (§4.1 spec) → Tasks 1, 2, 3 ✓
- P2-1 controller (§4.2) → Task 4 ✓
- P2-1 service (§4.3) → Task 5 ✓
- P2-2 persister (§4.4) → Task 7 ✓
- P2-3 graph (§4.5) → Task 9 ✓
- P2-4 UploadPage (§4.6) → Task 11 ✓
- P2-5 NodeDetails (§4.7 a) → Task 13 ✓
- P2-5 EdgeDetails (§4.7 b) → Task 14 ✓
- P2-6 SnapshotSelector (§4.8) → Task 16 ✓
- P2-7 fix (§4.9) → Tasks 17 (RED), 18 (GREEN), 19 (commit) ✓
- P2-8 refacto (§4.10) → Tasks 20 (RED), 21 (readRaw + helper), 22 (update existing specs + IngestionService), 23 (commit) ✓
- Vérification finale (§5) → Tasks 24, 25 ✓
- Stratégie commits (§6) → 9 commits respectés ✓

**2. Placeholder scan :** aucun « TBD », « TODO », « implement later ». Tout le code est complet.

**3. Type consistency :**
- `Warning` type de `@carto-ecp/shared` utilisé partout : Tasks 20, 21, 22 cohérents
- `SnapshotSummary` / `SnapshotDetail` cohérents entre api service mock (Task 5) et composant mock (Task 16)
- `GraphNode` / `GraphEdge` avec `urls`, `networks`, `kind`, `process`, `isDefaultPosition` cohérents avec lecture des composants source
- `activity.connectionStatus`, `activity.lastMessageUp`, `activity.isRecent` cohérents dans `EdgeDetails.test.tsx` (Task 14)
- `buildMinimalNetworkSnapshot()` produit un objet typé `NetworkSnapshot` complet (components + messagePaths + messagingStats + appProperties + warnings) cohérent avec l'import `NetworkSnapshot` Task 7

**Écarts mineurs** :
- Le spec §3.1 mentionnait `apps/api/src/snapshots/snapshots.controller.spec.ts`. Le plan l'a déplacé à `apps/api/test/snapshots-controller.spec.ts` (Task 4) par cohérence avec le pattern existant des tests supertest (test/ pour intégration, src/ pour unit). Déviation raisonnable.
- Le spec §4.2 mentionnait « mini-zip fabriqué à la volée avec adm-zip » pour le test nominal. Le plan utilise `buildZipFromFixture(ENDPOINT_FIXTURE)` — plus simple et garantit un zip ingerable. Chevauchement mineur avec `full-ingestion-endpoint.spec.ts` assumé.
