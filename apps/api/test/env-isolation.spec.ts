import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ImportsService } from '../src/ingestion/imports.service.js';
import { GraphService } from '../src/graph/graph.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE } from './fixtures-loader.js';

describe('Env isolation', () => {
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
    await prisma.import.deleteMany({
      where: { envName: { in: ['ISO_OPF', 'ISO_PROD'] } },
    });
  }, 60_000);

  afterAll(async () => {
    const rows = await prisma.import.findMany({
      where: { envName: { in: ['ISO_OPF', 'ISO_PROD'] } },
    });
    const { existsSync, unlinkSync } = await import('node:fs');
    for (const r of rows) {
      if (existsSync(r.zipPath)) { try { unlinkSync(r.zipPath); } catch { /* best effort */ } }
    }
    await prisma.import.deleteMany({
      where: { envName: { in: ['ISO_OPF', 'ISO_PROD'] } },
    });
  }, 60_000);

  it('graph(OPF) and graph(PROD) are independent — same fixture in both envs', async () => {
    // Ensure clean state for this test
    await prisma.import.deleteMany({
      where: { envName: { in: ['ISO_OPF', 'ISO_PROD'] } },
    });

    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await imports.createImport({
      file: { originalname: 'x-opf.zip', buffer: zip },
      envName: 'ISO_OPF',
      label: 'opf',
    });
    await imports.createImport({
      file: { originalname: 'x-prod.zip', buffer: zip },
      envName: 'ISO_PROD',
      label: 'prod',
    });

    const gOpf = await graph.getGraph('ISO_OPF');
    const gProd = await graph.getGraph('ISO_PROD');

    expect(gOpf.nodes.length).toBeGreaterThan(0);
    expect(gProd.nodes.length).toBeGreaterThan(0);
    // Même fixture → même nombre de nodes dans chaque env
    expect(gOpf.nodes.length).toBe(gProd.nodes.length);

    // Les EIC sont les mêmes (même fixture) mais les nodes sont issus d'imports distincts
    const eicsOpf = new Set(gOpf.nodes.map((n) => n.eic));
    const eicsProd = new Set(gProd.nodes.map((n) => n.eic));
    expect(Array.from(eicsOpf).sort()).toEqual(Array.from(eicsProd).sort());
  }, 30_000);

  it('deleting import from OPF does not affect PROD', async () => {
    // Ensure clean state for this test
    await prisma.import.deleteMany({
      where: { envName: { in: ['ISO_OPF', 'ISO_PROD'] } },
    });

    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const opfImport = await imports.createImport({
      file: { originalname: 'x-opf.zip', buffer: zip },
      envName: 'ISO_OPF',
      label: 'opf',
    });
    await imports.createImport({
      file: { originalname: 'x-prod.zip', buffer: zip },
      envName: 'ISO_PROD',
      label: 'prod',
    });

    await imports.deleteImport(opfImport.id);

    const gOpf = await graph.getGraph('ISO_OPF');
    const gProd = await graph.getGraph('ISO_PROD');
    expect(gOpf.nodes).toHaveLength(0);
    expect(gProd.nodes.length).toBeGreaterThan(0);
  }, 30_000);
});
