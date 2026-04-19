import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { AppModule } from '../src/app.module.js';
import { ImportsService } from '../src/ingestion/imports.service.js';
import { GraphService } from '../src/graph/graph.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE } from './fixtures-loader.js';

describe('Import deletion', () => {
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
    await prisma.import.deleteMany({ where: { envName: 'DEL_TEST' } });
  }, 60_000);

  afterAll(async () => {
    const rows = await prisma.import.findMany({ where: { envName: 'DEL_TEST' } });
    const { unlinkSync } = await import('node:fs');
    for (const r of rows) {
      if (existsSync(r.zipPath)) { try { unlinkSync(r.zipPath); } catch { /* best effort */ } }
    }
    await prisma.import.deleteMany({ where: { envName: 'DEL_TEST' } });
  }, 60_000);

  it('removes all rows (cascade) and zip file on delete', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const created = await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'DEL_TEST',
      label: 'to-delete',
    });

    // Before delete : graph populated, zip exists, DB rows exist
    const before = await graph.getGraph('DEL_TEST');
    expect(before.nodes.length).toBeGreaterThan(0);

    const row = await prisma.import.findUnique({ where: { id: created.id } });
    const zipPath = row!.zipPath;
    expect(existsSync(zipPath)).toBe(true);

    const componentsBefore = await prisma.importedComponent.count({ where: { importId: created.id } });
    expect(componentsBefore).toBeGreaterThan(0);

    await imports.deleteImport(created.id);

    // After delete : graph empty, zip removed, cascaded rows gone
    const after = await graph.getGraph('DEL_TEST');
    expect(after.nodes).toHaveLength(0);
    expect(existsSync(zipPath)).toBe(false);

    const componentsAfter = await prisma.importedComponent.count({ where: { importId: created.id } });
    expect(componentsAfter).toBe(0);
    const pathsAfter = await prisma.importedPath.count({ where: { importId: created.id } });
    expect(pathsAfter).toBe(0);
  }, 30_000);

  it('throws NotFoundException when deleting an unknown id', async () => {
    await expect(imports.deleteImport('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
  }, 10_000);
});
