import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { AppModule } from '../src/app.module.js';
import { ImportsService } from '../src/ingestion/imports.service.js';
import { GraphService } from '../src/graph/graph.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE, CD_FIXTURE } from './fixtures-loader.js';

const TEST_ENV = 'INTEG_OPF_V2';

describe('Full ingestion v2 (integration)', () => {
  let imports: ImportsService;
  let graph: GraphService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    imports = app.get(ImportsService);
    graph = app.get(GraphService);
    prisma = app.get(PrismaService);

    // Clean up any leftover rows from a previous failed run
    await prisma.import.deleteMany({ where: { envName: TEST_ENV } });
  }, 60_000);

  afterAll(async () => {
    const rows = await prisma.import.findMany({ where: { envName: TEST_ENV } });
    for (const r of rows) {
      if (existsSync(r.zipPath)) {
        try { unlinkSync(r.zipPath); } catch { /* best effort */ }
      }
    }
    await prisma.import.deleteMany({ where: { envName: TEST_ENV } });
  }, 60_000);

  it('uploads 2 fixtures into the same env and aggregates the graph', async () => {
    const zipEndpoint = buildZipFromFixture(ENDPOINT_FIXTURE);
    const zipCd = buildZipFromFixture(CD_FIXTURE);

    const d1 = await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zipEndpoint },
      envName: TEST_ENV,
      label: 'endpoint-fixture',
    });
    const d2 = await imports.createImport({
      file: { originalname: `${CD_FIXTURE}.zip`, buffer: zipCd },
      envName: TEST_ENV,
      label: 'cd-fixture',
    });

    expect(d1.id).toBeTruthy();
    expect(d2.id).toBeTruthy();

    const g = await graph.getGraph(TEST_ENV);

    // At least the endpoint fixture produces nodes
    expect(g.nodes.length).toBeGreaterThanOrEqual(1);

    // No duplicate EICs in nodes — cascade+merge must produce one node per unique EIC
    const eics = new Set(g.nodes.map((n) => n.eic));
    expect(eics.size).toBe(g.nodes.length);

    // Bounds must be coherent (north > south, east > west)
    expect(g.bounds.north).toBeGreaterThan(g.bounds.south);
    expect(g.bounds.east).toBeGreaterThan(g.bounds.west);

    // At least 2 imports listed for this env
    const list = await imports.listImports(TEST_ENV);
    expect(list).toHaveLength(2);
  }, 30_000);

  it('list of envs includes TEST_ENV after the imports', async () => {
    const envs = await prisma.import.findMany({
      distinct: ['envName'],
      select: { envName: true },
    });
    expect(envs.map((e) => e.envName)).toContain(TEST_ENV);
  });
});
