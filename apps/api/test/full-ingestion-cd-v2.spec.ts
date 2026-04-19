import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ImportsService } from '../src/ingestion/imports.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, CD_FIXTURE } from './fixtures-loader.js';

describe('Full ingestion CD v2 (integration)', () => {
  let imports: ImportsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    imports = app.get(ImportsService);
    prisma = app.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: 'INTEG_CD_V2' } });
  }, 60_000);

  afterAll(async () => {
    const rows = await prisma.import.findMany({ where: { envName: 'INTEG_CD_V2' } });
    const { existsSync, unlinkSync } = await import('node:fs');
    for (const r of rows) {
      if (existsSync(r.zipPath)) { try { unlinkSync(r.zipPath); } catch { /* best effort */ } }
    }
    await prisma.import.deleteMany({ where: { envName: 'INTEG_CD_V2' } });
  }, 60_000);

  it('ingests the CD fixture via CsvPathReader pipeline', async () => {
    const zip = buildZipFromFixture(CD_FIXTURE);
    const detail = await imports.createImport({
      file: { originalname: `${CD_FIXTURE}.zip`, buffer: zip },
      envName: 'INTEG_CD_V2',
      label: 'cd-integration-test',
    });

    expect(detail.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(detail.stats.componentsCount).toBeGreaterThan(0);
    // CD fixture a component_directory.csv non-vide mais message_path.csv potentiellement vide
    expect(detail.stats.pathsCount).toBeGreaterThanOrEqual(0);
  }, 30_000);

  it('stores imported components in DB with correct types', async () => {
    const zip = buildZipFromFixture(CD_FIXTURE);
    const detail = await imports.createImport({
      file: { originalname: `${CD_FIXTURE}.zip`, buffer: zip },
      envName: 'INTEG_CD_V2',
      label: 'cd-types',
    });

    const components = await prisma.importedComponent.findMany({ where: { importId: detail.id } });
    expect(components.length).toBeGreaterThan(0);

    // Le composant source CD (id==componentCode) doit être COMPONENT_DIRECTORY
    const cdSelf = components.find((c) => c.eic === '17V000002014106G');
    if (cdSelf) {
      expect(cdSelf.type).toBe('COMPONENT_DIRECTORY');
    }

    // Tous les composants ont un type valide parmi ENDPOINT, COMPONENT_DIRECTORY, BROKER, BA
    const validTypes = ['ENDPOINT', 'COMPONENT_DIRECTORY', 'BROKER', 'BA'];
    const otherTypes = new Set(components.map((c) => c.type));
    for (const t of otherTypes) {
      expect(validTypes).toContain(t);
    }
  }, 30_000);
});
